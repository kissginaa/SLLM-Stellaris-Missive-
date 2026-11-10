// A-00b 6번: 은하 의회(앱 쪽) — 안건 알림·회원 정보 수집(RESOLUTION·RESKEY·GCMEMBER·GCPOS·GCFORCE·GCSTATE), 회의 창, 토론, 강제 결정.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음) + A-16 연결: 회의 창을 열 때 councilState.open, 토론 결과마다 noteDebate,
// 강제 결정 맨 앞에서 check(모르는 회의면 state 'refused'로 거절, 게임에 아무것도 안 보냄 — 80%·정보 완전성 잠금은 2026-10-29에 없앰), 창을 닫을 때 clear.
// 라디오 사건(EVT)도 원래 onAgendaSignal 안에서 처리하던 것을 그대로 옮겼다(SLOT.AGENDA).
import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { logDiagnostic, writeRawDiagnostic } from '../diagnostics';
import { agendaTitle, crisisAgendaText } from '../agenda';
import { resolutionText } from '../reslocal';
import { debateMessages, parseDebate, DebateReq, DebateSpeaker, withDeltas } from '../councilai';
import { CouncilState } from '../council-state';
import { parseEvent } from '../radio';
import { RADIO_IDX } from '../chronicle';
import { gcLiveEffect, gcStatusEffect, forceResolutionEffect, councilReceiptMatches, SllmMessage } from '../protocol';
import { classKey, seatMix } from '../speciesClass';
import { ATTITUDES } from '../prompt';
import { clipLore } from '../lore';
import { settings, COUNCIL_MAX_SPEAKERS } from '../app/settings';
import { enqueue, sendConsole, holdBusy, setBusyMsg, link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { chronPut, chronNoteByName, chronNoteWorld } from './chronicle-app';
import { radio, radioAired } from './radio-app';
import { ctx } from '../app/ctx';
import { pick, locFolder } from './settings-ui';
import { isXenophobe, rulerLibraryItem } from './portrait-lib-app';
import { scenarioLocked } from './scenario-locks-app'; // 시나리오에서는 은하 의회를 치운다(2026-11-06)

/** 앱이 여는 비(非)게임 안건(국제 대회 개최지 선정 회의, 2026-10-31): 설득 결과를 받아 7월 투표에 반영. 키가 sllm_host_ 로 시작. */
export const councilHooks: { debated: (key: string, moves: Array<{ gi: number; delta: number }>) => void } = { debated: () => {} };
export const council = {
  win: null as BrowserWindow | null,
  /** 표결 중인 안건(알림·트레이 메뉴·회의 창이 쓴다) */
  pendingAgenda: null as AgendaInfo | null,
};
/** A-16: 앱이 들고 있는 지금 회의의 집계(회의 창과 같은 규칙) */
export const councilState = new CouncilState();
/** 개발자 고정 집계 중인가(council.html fixedVotes 와 같은 조건) */
const devFixedVotes = () => settings.devMode === true && (settings.devCouncilVote === 'for' || settings.devCouncilVote === 'against');

// 모드가 알려 주는 안건 정보(SLLM:RESOLUTION 제안국·대상국, SLLM:RESKEY 안건 코드, SLLM:GCMEMBER 참석 제국과 외교 가중치)를 모아 두었다가 회의 창에 넘긴다.
// 의회 창은 참석 제국과 가중치를 실제로 쓰고, 찬반은 아직 게임에서 읽지 못해 가상으로 정한다.
export interface AgendaInfo { title?: string; desc?: string; reliable?: boolean; fresh?: boolean; key: string; proposer: string; target: string; date: string; demo: boolean; members: { idx: number; name: string; weight: number; ai: boolean; council: boolean; cls?: string; pos?: number; mix?: { k: string; s: number }[]; xeno?: boolean; rulerItem?: string }[]; pos?: Record<number, number> }
let lastMemberAt = 0;
let lastKeyNotice = '';
const gcWaiters = new Map<number, (m: SllmMessage) => void>(); // 강제 결정·상태 확인의 요청 번호별 응답 대기
// 강제 결정 중복 방지(2026-10-18): 보내는 중에는 다시 받지 않고, 결과를 확인하지 못한 안건은 [정보 다시 읽기] 전까지 다시 보내지 않는다(화면 버튼만 막던 것을 앱에서도 막음).
let forceInFlight = false;
const forceUnknown = new Set<string>();
let agendaTimer: ReturnType<typeof setTimeout> | null = null;
export const JOIN_LABEL = '안건 회의 직접 참여하기';
/** 알림·트레이 메뉴 표시용(한/영·언어 팩, 2026-10-19). */
export const joinLabel = (): string => pick(JOIN_LABEL, 'Join the resolution meeting');
export function clearAgenda() { if (agendaTimer) { clearTimeout(agendaTimer); agendaTimer = null; } council.pendingAgenda = null; ctx.refreshTray(); }
export function announceAgenda() {
  const a = council.pendingAgenda; if (!a) return;
  if (scenarioLocked('galcouncil')) { clearAgenda(); return; } // 회랑의 삼파전: 은하 의회 없음
  ctx.refreshTray();
  { const t = resolutionText(a.key, ctx.flagProv.game(), locFolder())?.title ?? agendaTitle(a.key), pr = a.proposer || '?', tg = a.target ? pick(', 대상: ', ', target: ') + a.target : '';
    ctx.notify({ kind: 'event', title: pick('은하 공동체 안건', 'Galactic Community resolution'), body: pick(`${t}이(가) 표결에 올랐습니다 (제안: ${pr}${tg})`, `${t} is up for a vote (proposed by ${pr}${tg})`), action: joinLabel() }); }
}
/** 게임 로그의 안건 줄을 받는다. 표결이 시작되면 안건 정보를 모으기 시작하고(코드와 참석 제국 줄이 뒤따라 오므로 잠깐 기다린다), 통과·부결되면 비운다. */
export function onAgendaSignal(m: SllmMessage) {
  if (m.kind === 'RESOLUTION') {
    // F-42: 불러오기·매월 다시 찍는 줄(resume=1). 이미 알고 있는 안건이면 그대로 두고(알림 한 번), 표결이 없으면(stage=none) 비운다.
    if (m.kv.resume === '1' && m.kv.stage === 'vote' && (council.pendingAgenda || agendaTimer)) return;
    if (m.kv.resume === '1' && m.kv.stage !== 'vote') { if (council.pendingAgenda || agendaTimer) clearAgenda(); return; }
    if (m.kv.stage === 'vote') {
      if (agendaTimer) clearTimeout(agendaTimer);
      council.pendingAgenda = { key: '', proposer: m.kv.pname ?? '', target: m.kv.tname ?? '', date: m.kv.date ?? '', demo: false, members: [] };
      agendaTimer = setTimeout(() => { agendaTimer = null; announceAgenda(); }, 1500);
    } else clearAgenda();
  } else if (m.kind === 'RESKEY') {
    if (council.pendingAgenda && (!council.pendingAgenda.key || council.pendingAgenda.key === 'unknown') && m.kv.key) council.pendingAgenda.key = m.kv.key; // 처음엔 못 읽어도('unknown') 나중 줄로 채운다
    { const ct = crisisAgendaText(m.kv.key ?? '', council.pendingAgenda?.target ?? ''); if (ct) chronNoteWorld(ct, true); } // 은하 위기는 의회 안건으로 알 수 있다
  } else if (m.kind === 'EVT') { // 성간 라디오: 켜져 있을 때만 사건을 모은다(꺼져 있으면 아무것도 쌓지 않는다)
    { const ev = parseEvent(m); if (ev) { chronPut(RADIO_IDX, ev.date, ev.text, false, { name: '성간라디오 전용 연대기', world: true, uid: `${ev.kind}|${ev.date}|${ev.n}|${ev.text}` }); if (['ruler_set', 'ruler_removed'].includes(ev.kind) && m.kv.who) chronNoteByName(m.kv.who, ev.text); } } // leader_death 는 제국 연대기(신문 재료)에 넣지 않는다: 게임의 on_leader_death 는 은퇴·명단에서 빠짐에도 불려 '살아 있는 지도자 사망' 기사가 났다(2026-10-17 테스터 제보). 통치자 교체는 ruler_removed 로 남는다. // 라디오가 꺼져 있어도 모든 사건을 날짜별로 기록한다. 세이브 번호를 알기 전 사건은 대기열에 두었다가 번호를 알면 넣는다
    if (radio.on) { const ev = parseEvent(m); if (ev && !(ev.id && radioAired().has(ctx.curSaveId, ev.id))) { radio.q.push(ev); radio.win?.webContents.send('radioQueue', radio.q.size); } } // 이미 방송한 사건(로그를 다시 읽은 경우)은 넣지 않는다
  } else if (m.kind === 'GCFORCE' || m.kind === 'GCSTATE') {
    const w = gcWaiters.get(Number(m.kv.req)); if (w) w(m);
  } else if (m.kind === 'GCPOS') { // 회원국의 입장: 1 지지, 2 반대, 3 기권, 0 모름
    const ii = Number(m.kv.idx), pp = Number(m.kv.pos);
    if (council.pendingAgenda && Number.isFinite(ii) && Number.isFinite(pp)) (council.pendingAgenda.pos ??= {})[ii] = pp;
  } else if (m.kind === 'GCMEMBER') {
    const w = Number(m.kv.weight);
    if (council.pendingAgenda && m.kv.name) {
      const mb = { idx: Number(m.kv.idx) || 0, name: m.kv.name, weight: Number.isFinite(w) ? w : 0, ai: m.kv.ai !== '0', council: m.kv.council === '1' };
      const at = council.pendingAgenda.members.findIndex((x) => x.idx === mb.idx); // 소집할 때 다시 읽은 값이 오면 갈아 끼운다
      if (at >= 0) council.pendingAgenda.members[at] = mb; else council.pendingAgenda.members.push(mb);
      lastMemberAt = Date.now();
    }
  }
}

export function closeCouncil() { if (council.win && !council.win.isDestroyed()) council.win.close(); council.win = null; }
/** 회의 창을 열기 전에 게임에 회원국의 현재 입장을 물어 로그로 받는다(최대 4초). 못 받으면 입장 없이(가상 값으로) 연다. */
/** 게임에서 읽은 의회 정보가 강제 결정에 쓸 만큼 완전한가(명단 수집 완료·유효한 가중치·플레이어 1명·모든 AI의 찬반 확인). */
export function councilDataComplete(a: AgendaInfo): boolean {
  const ai = a.members.filter((mb) => mb.ai), me = a.members.filter((mb) => !mb.ai);
  return !a.demo && a.fresh === true && /^resolution_[a-z0-9_]+$/.test(a.key || '') && a.members.length >= 2 && a.members.every((mb) => Number.isFinite(mb.weight) && mb.weight > 0) && ai.length >= 1 && me.length === 1 && ai.every((mb) => { const v = a.pos?.[mb.idx]; return v === 1 || v === 2 || v === 3; });
}
/** 게임에 회원국 명단·가중치·프로필·입장을 한 번 물어 a에 채운다. 불완전하면 false. */
export async function readCouncilOnce(a: AgendaInfo): Promise<boolean> {
  a.fresh = false; a.members = []; a.pos = {}; // 새로 읽은 명단으로 통째로 바꾼다(그사이 탈퇴한 제국이 남지 않게)
  const stamp = Date.now(); lastMemberAt = 0;
  await enqueue(() => sendConsole(gcLiveEffect()));
  const t0 = Date.now();
  // 명단이 도착하고 입장이 거의 다 모일 때까지, 새 줄이 더는 안 올 때까지 기다린다(최대 8초)
  while (Date.now() - t0 < 8000) {
    await new Promise((r) => setTimeout(r, 250));
    const got = lastMemberAt >= stamp, posOk = Object.keys(a.pos!).length >= Math.max(2, a.members.length - 1);
    if (got && posOk && Date.now() - lastMemberAt > 800) break;
  }
  a.fresh = lastMemberAt >= stamp && a.members.length >= 2;
  return councilDataComplete(a);
}
const COUNCIL_TRIES = 3;
/** 불완전하면 자동으로 다시 읽는다(최대 3회). 끝내 못 읽으면 이전 값을 두고 false를 돌려준다(그때는 강제 결정이 잠긴다). */
export async function readCouncilWithRetry(a: AgendaInfo, setText: (t: string) => void): Promise<boolean> {
  const old = a.members, oldPos = a.pos;
  for (let n = 1; n <= COUNCIL_TRIES; n++) {
    setText(n === 1 ? pick('의회를 소집하는 중… 각 제국의 외교 가중치와 입장을 게임에서 읽고 있습니다 · 키보드와 마우스를 만지지 마세요', 'Convening the council… reading each empire\'s diplomatic weight and stance from the game · do not touch the keyboard or mouse') : pick(`정보가 불완전해 자동으로 다시 읽는 중입니다(${n}/${COUNCIL_TRIES}) · 키보드와 마우스를 만지지 마세요`, `The information was incomplete; reading again automatically (${n}/${COUNCIL_TRIES}) · do not touch the keyboard or mouse`));
    try { if (await readCouncilOnce(a)) return true; } catch (e) { ctx.toUi('event', pick('의회 정보 읽기 실패: ', 'Could not read the council: ') + (e as Error).message); }
    if (n < COUNCIL_TRIES) await new Promise((r) => setTimeout(r, 600));
  }
  if (a.members.length < 2) { a.members = old; a.pos = oldPos; } // 명단 자체를 못 읽었으면 이전 값으로 연다(강제 결정은 잠김)
  return false;
}
export async function openCouncilLive() {
  const a = council.pendingAgenda; if (!a) return;
  if (scenarioLocked('galcouncil')) { clearAgenda(); return; }
  if (ctx.gameRunning) {
    const release = holdBusy(pick('의회를 소집하는 중…', 'Convening the council…'));
    try { const ok = await readCouncilWithRetry(a, setBusyMsg); if (!ok) ctx.toUi('event', pick('의회 정보를 끝내 완전히 읽지 못했습니다. 강제 결정은 잠기고 토론만 가능합니다. 회의 창의 "정보 다시 읽기"로 다시 시도할 수 있습니다.', 'Could not fully read the council. Forced decisions are locked and only debate is available. Try again with "Re-read information" in the meeting window.')); }
    finally { release(); }
  }
  openCouncil('', a);
}
export function openCouncil(agenda?: string, info?: AgendaInfo | null) {
  if (info) { const rt = resolutionText(info.key, ctx.flagProv.game(), locFolder()); if (rt) info = { ...info, title: rt.title, desc: rt.desc }; }
  if (info) info = { ...info, members: info.members.map((mb) => ({ ...mb, pos: info!.pos?.[mb.idx], cls: mb.ai ? (classKey(ctx.profiles.get(mb.idx)?.cls) ?? '') : (classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? '') })).map((mb) => ({ ...mb, mix: seatMix(ctx.flagProv.portraitInfoFor(mb.idx), mb.cls), xeno: isXenophobe(mb.idx), rulerItem: rulerLibraryItem(mb.idx)?.id ?? '' })) } as AgendaInfo; // 의원 초상화: 계열 기본 그림, A-09 의석은 세이브 종족 비율대로 나눔
  if (info) { // 게임에서 제대로 읽은 정보인가: 강제 결정은 이때만 열어 준다(가상 값이 실제 결과를 정하지 않게)
    info = { ...info, reliable: councilDataComplete({ ...info, pos: info.pos }) };
  }
  councilState.open(ctx.curSaveId, info && !info.demo ? info : null); // A-16: 회의 창과 같은 정보로 앱도 집계를 든다(시연판·정보 없음이면 비움)
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1700, Math.round(area.width * 0.94)), height: Math.min(960, Math.round(area.height * 0.9)) }; // 참석 제국의 초상화를 모두 늘어놓으려고 화면 대부분을 쓴다
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  if (council.win && !council.win.isDestroyed()) { council.win.show(); council.win.focus(); council.win.webContents.send('councilInit', { agenda: agenda || '', info: info ?? null }); return true; }
  council.win = new BrowserWindow({
    ...sz, x, y, minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
  });
  council.win.setAlwaysOnTop(true, 'screen-saver', 1);
  council.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'council.html'));
  council.win.once('ready-to-show', () => { council.win?.show(); council.win?.webContents.send('councilInit', { agenda: agenda || '', info: info ?? null }); });
  council.win.on('closed', () => { council.win = null; councilState.clear(); }); // A-16: 창을 닫으면 집계 상태도 비운다
  return true;
}

const nmEq = (a: string, b: unknown) => typeof b === 'string' && b.length > 0 && a.trim() === b.trim();
const recordOf = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
// 의회 강제 결정: 보내고 → 모드의 결과 줄(GCFORCE)을 기다리고 → 없으면 재전송하지 않고 상태부터 읽는다.
// 결과 상태: done(적용 확인) / stale(이미 끝났거나 바뀐 안건: 명령을 실행하지 않음) / gone(전송됨, 더는 표결 중이 아님: 적용 여부 확인 필요)
//           / pending(전송됐지만 아직 표결 중) / unknown(전송됨, 상태를 못 읽음) / error(전송 실패)

export function registerCouncil(router: LogRouter): void {
  router.on(SLOT.RESOLUTION, 'council:resolution', (m: SllmMessage) => {
    // stage=none(매달 「지금 표결 없음」 확인)·resume(이어 읽기)는 알림이 아니다(2026-10-19 집 PC 검수: 매달 「부결되었습니다 (제안: ?)」가 떴다)
    if (m.kind === 'RESOLUTION' && (m.kv.stage === 'vote' || m.kv.stage === 'passed' || m.kv.stage === 'failed') && m.kv.resume !== '1') {
      const pn = m.kv.pname ?? '?', tg = m.kv.tname ? pick(', 대상: ', ', target: ') + m.kv.tname : '';
      ctx.toUi('event', m.kv.stage === 'vote' ? pick(`은하 공동체 안건이 표결에 올라왔습니다 (제안: ${pn}${tg})`, `A Galactic Community resolution is up for a vote (proposed by ${pn}${tg})`)
        : m.kv.stage === 'passed' ? pick(`은하 공동체 안건이 통과되었습니다 (제안: ${pn}${tg})`, `A Galactic Community resolution passed (proposed by ${pn}${tg})`)
        : pick(`은하 공동체 안건이 부결되었습니다 (제안: ${pn}${tg})`, `A Galactic Community resolution was rejected (proposed by ${pn}${tg})`));
    }
  });
  router.on(SLOT.AGENDA, 'council:agenda', (m: SllmMessage) => {
    onAgendaSignal(m);
  });
  router.on(SLOT.RESKEY, 'council:reskey', (m: SllmMessage) => {
    if (m.kind === 'RESKEY' && m.kv.key !== lastKeyNotice) { lastKeyNotice = m.kv.key ?? ''; ctx.toUi('event', pick('안건 종류: ', 'Resolution type: ') + (m.kv.key ?? '?')); } // 회의를 열며 다시 읽은 같은 키는 한 번만 알림
  });
  ipcMain.handle('devAgendaAlert', async () => { if (!settings.devMode) return false; council.pendingAgenda = { key: 'resolution_demo_condemn_aggression', proposer: pick('중립 평의회', 'Neutral council'), target: '', date: '', demo: true, members: [] }; announceAgenda(); return true; });
  ipcMain.handle('devCouncil', async (_e, agenda?: unknown) => { if (!settings.devMode) return false; openCouncil(typeof agenda === 'string' ? agenda.slice(0, 40) : ''); return true; }); // F-14: 개발자 모드에서만
  ipcMain.handle('councilDebate', async (_e, input: unknown) => {
    try {
      const req = recordOf(input), tally = recordOf(req.tally);
      const sp = Array.isArray(req?.speakers) ? req.speakers.slice(0, COUNCIL_MAX_SPEAKERS) : [];
      const speakers = sp.map(recordOf).filter(x => Number.isSafeInteger(Number(x.id)) && Number(x.id) >= 0).map<DebateSpeaker>((x) => {
        const pr = ctx.profileWithEthics(ctx.profiles.get(Number(x.gi)),Number(x.gi)); const fl = pr ? Object.entries(pr.flags).filter(([, v]) => v).map(([k]) => k).join(',') : '';
        return { id: Number(x.id), name: String(x.name || '').slice(0, 60), weight: Number(x.weight) || 1, stance: x.stance === 'f' || x.stance === 'a' ? x.stance : 'u', firm: Math.max(0, Math.min(1, Number(x.firm) || 0.5)), score: Math.max(-100, Math.min(100, Number(x.score) || 0)), notes: Array.isArray(x.notes) ? x.notes.slice(-3).map((n: unknown) => String(n).slice(0, 50)) : [], personality: [pr?.personality,pr?.ethicsText].filter(Boolean).join(' · ').slice(0,2500), gov: pr?.gov || '', species: pr?.species || '', rel: fl, origin: pr?.origin || '', ruler: pr ? `${pr.title || ''} ${pr.ruler || ''}`.trim() : '', att: pr ? (ATTITUDES[pr.att] ?? '') : '', lore: (() => { try { const nm = String(x.name || ''); const b = ctx.flagProv.bioFor(Number(x.gi)); const l = ctx.modCompatibility.empire(nm)?.lore || (b ? clipLore(ctx.modCompatibility.biography(b)) : (ctx.modCompatibility.lore(nm) ?? ctx.loreStore.lookup(nm, ctx.flagProv.game()))?.text); return l ? String(l).slice(0, 300) : ''; } catch { return ''; } })(), role: nmEq(String(x.name || ''), req.proposer) ? '제안국' : nmEq(String(x.name || ''), req.target) ? '대상국' : '' };
      });
      if (!speakers.length) return { ok: false, error: pick('답할 제국이 없습니다', 'No empire is left to answer') };
      if (settings.devMode && settings.devCouncilNoAi) councilState.noteDebate(ctx.curSaveId, councilState.view()?.key ?? '', req?.dir === 'a' ? 'a' : 'f', [], devFixedVotes()); // A-16: AI 없이 진행해도 플레이어가 민 방향은 기록
      if (settings.devMode && settings.devCouncilNoAi) return { ok: true, replies: speakers.map((s) => ({ id: s.id, text: s.stance === 'f' ? pick('이 안건에 찬성합니다.', 'We support this resolution.') : s.stance === 'a' ? pick('이 안건에 반대합니다.', 'We oppose this resolution.') : pick('판단을 유보하겠습니다.', 'We reserve judgement.'), shift: 0, delta: 0, reason: pick('개발자 모드 · AI 호출 생략', 'Developer mode · AI call skipped') })) };
      const r: DebateReq = { title: String(req.title || '').slice(0, 120), desc: String(req.desc || '').slice(0, 1200), proposer: String(req.proposer || '').slice(0, 60), target: String(req.target || '').slice(0, 60), player: ctx.playerName, dir: req.dir === 'a' ? 'a' : 'f', text: String(req.text || '').slice(0, 600), repeat: !!req.repeat, ...(req.to ? { to: String(req.to).slice(0, 60) } : {}), speakers, history: Array.isArray(req.history) ? req.history.slice(-8).map((h: unknown) => String(h).slice(0, 200)) : [], tally: { f: Number(tally.f) || 0, a: Number(tally.a) || 0, u: Number(tally.u) || 0 } };
      const ids = speakers.map((x: { id: number }) => x.id);
      const logRaw = (tag: string, raw: string) => { writeRawDiagnostic('sllm_councilraw.log',new Date().toISOString()+' '+tag+'\n'+raw+'\n'); };
      const replies = await ctx.ai.session(async (chat) => { // 재요청까지 같은 연결로
        let raw = await chat(debateMessages(r), { maxTokens: 4500, json: true }); // 2026-11-04: 발언이 2~4문장으로 길어짐
        let rp = parseDebate(raw, ids);
        if (!rp.length) { logRaw('1차 해석 실패', raw); raw = await chat(debateMessages(r), { maxTokens: 4500 }); rp = parseDebate(raw, ids); if (!rp.length) logRaw('2차 해석 실패', raw); }
        return rp;
      });
      if (!replies.length) return { ok: false, error: pick('답을 해석하지 못했습니다(sllm_councilraw.log 참고)', 'Could not parse the replies (see sllm_councilraw.log)') };
      const out = withDeltas(replies, speakers, r.dir, r.repeat);
      const hostKey = String(req.hostKey || ''); if (/^sllm_host_(oly|worlds)_\d+$/.test(hostKey)) { const giOf = new Map(sp.map(recordOf).map((x) => [Number(x.id), Number(x.gi)])); try { councilHooks.debated(hostKey, out.map((o) => ({ gi: giOf.get(o.id) ?? -9, delta: Number(o.delta) || 0 })).filter((x) => Number.isSafeInteger(x.gi) && x.gi >= 0)); } catch (e) { logDiagnostic('warn', 'council.host_hook_failed', { error: String(e) }); } } // 개최지 선정 회의(2026-10-31)
      councilState.noteDebate(ctx.curSaveId, councilState.view()?.key ?? '', r.dir, out, devFixedVotes()); // A-16: 화면과 같은 설득 변화를 앱 집계에도
      return { ok: true, replies: out };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('councilReread', async () => { // 회의 창의 "정보 다시 읽기": 게임에서 다시 읽고 창을 새 정보로 다시 연다(토론 기록은 초기화됨)
    const a = council.pendingAgenda; if (!a || !ctx.gameRunning) return false;
    const release = holdBusy(pick('의회 정보를 다시 읽는 중…', 'Re-reading the council information…'));
    forceUnknown.clear();
    try { const ok = await readCouncilWithRetry(a, setBusyMsg); openCouncil('', a); return ok; } catch { return false; } finally { release(); }
  });
  ipcMain.handle('councilForce', async (_e, key: unknown, pass: unknown) => {
    if (forceInFlight) return { ok: false, state: 'refused', error: pick('강제 결정을 이미 보내는 중입니다.', 'A forced decision is already being sent.') };
    const k0 = String(key || ''), fk = ctx.curSaveId + '|' + k0;
    if (forceUnknown.has(fk)) return { ok: false, state: 'refused', error: pick('이 안건의 이전 강제 결정 결과를 확인하지 못했습니다. 게임에서 안건 상태를 확인하고 [정보 다시 읽기]를 누른 뒤 다시 시도하세요.', 'The result of the previous forced decision on this resolution could not be confirmed. Check the resolution in game, press [Reread info], then try again.') };
    forceInFlight = true;
    try {
      const r = await forceResolution(k0, pass);
      if (r.state === 'unknown') forceUnknown.add(fk);
      return r;
    } finally { forceInFlight = false; }
  });
  async function forceResolution(key: unknown, pass: unknown): Promise<{ ok: boolean; state: string; error?: string }> {
    const k = String(key || ''), isPass = pass === true, sid = ctx.curSaveId;
    { // A-16: 게임에 무엇이든 보내기 전에 지금 이 회의(세이브·안건)가 맞는지 확인한다. 80%·정보 완전성 잠금은 2026-10-29 사용자 결정으로 없앰
      const chk = councilState.check(ctx.curSaveId, k, isPass, settings.devMode ? { vote: settings.devCouncilVote, percent: settings.devCouncilPercent } : null);
      if (!chk.ok) { logDiagnostic('warn', 'council.force.refused', { key: k, pass: isPass, reason: chk.reason, pct: chk.pct }); return { ok: false, state: 'refused', error: chk.reason }; }
    }
    if (settings.devMode && settings.devCouncilVote !== 'normal' && isPass !== (settings.devCouncilVote === 'for')) return { ok: false, state: 'error', error: pick('개발자 고정 집계와 다른 결과입니다. 설정을 확인해 주세요.', 'This differs from the developer\'s fixed tally. Check the settings.') };
    const waitFor = (req: number, ms: number, kind: 'GCFORCE' | 'GCSTATE') => {
      let cancel = () => {};
      const promise = new Promise<SllmMessage | null>((resolve) => {
        const finish = (m: SllmMessage | null) => { clearTimeout(timer); gcWaiters.delete(req); resolve(m); };
        const timer = setTimeout(() => finish(null), ms);
        cancel = () => finish(null);
        gcWaiters.set(req, (m) => {
          if (ctx.curSaveId !== sid) { finish(null); return; }
          if (councilReceiptMatches(m, { sid, req, key: k, kind, mode: isPass ? 'pass' : 'cancel' })) finish(m);
        });
      });
      return { promise, cancel };
    };
    const status = async (): Promise<'voting' | 'ended' | 'unknown'> => {
      if (ctx.curSaveId !== sid) return 'unknown';
      const rq = ++link.reqCounter, cmd = gcStatusEffect(k, rq); if (!cmd) return 'unknown';
      const w = waitFor(rq, 8000, 'GCSTATE');
      try { await enqueue(() => sendConsole(cmd)); } catch { w.cancel(); return 'unknown'; }
      const m = await w.promise; return !m || ctx.curSaveId !== sid ? 'unknown' : m.kv.voting === '1' ? 'voting' : 'ended';
    };
    const rq = ++link.reqCounter, cmd = forceResolutionEffect(k, isPass, rq);
    if (!cmd) return { ok: false, state: 'error', error: pick('안건 코드를 모릅니다', 'Unknown resolution code') };
    if (!ctx.gameRunning) return { ok: false, state: 'error', error: pick('게임이 실행 중이 아닙니다', 'The game is not running') };
    const w = waitFor(rq, 9000, 'GCFORCE');
    try { await enqueue(() => sendConsole(cmd)); } catch (e) { w.cancel(); return { ok: false, state: 'error', error: (e as Error).message }; }
    const m = await w.promise;
    if (ctx.curSaveId !== sid) return { ok: false, state: 'unknown', error: pick('세이브가 바뀌었습니다. 이전 요청의 결과는 게임에서 확인해 주세요.', 'The save changed. Check the result of the earlier request in the game.') };
    if (m) {
      const st = m.kv.state;
      if (st === 'stale') return { ok: true, state: 'stale' };
      if (st === 'done') return { ok: true, state: 'done' };
      const s2 = await status(); // unconfirmed
      return { ok: true, state: s2 === 'ended' ? 'gone' : s2 === 'voting' ? 'pending' : 'unknown' };
    }
    const s3 = await status(); // 응답이 없다: 바로 다시 보내지 않고 현재 상태부터 읽는다(이미 적용됐을 수 있다)
    return { ok: true, state: s3 === 'ended' ? 'gone' : s3 === 'voting' ? 'pending' : 'unknown' };
  }
  ipcMain.handle('councilClose', async () => { closeCouncil(); return true; });
}
