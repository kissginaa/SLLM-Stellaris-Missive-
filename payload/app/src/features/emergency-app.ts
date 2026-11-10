// 긴급회의(02 최신 확정, 2026-10-23 초안): 수동 소집만 · 무료 · 재소집 제한 없음 · 참석자 = 지금 평의회(내각 회의와 같은 평의원) ·
// 지목하면 그 사람 / 전체에게 묻으면 관련 담당 1명 + 원하면 다른 1명 보충 / 「전원 의견 듣기」는 한 번씩 · 총 발언 무제한 · 플레이어가 직접 종료 ·
// 같은 의제는 기록에서 재개 · 통치자가 명시한 결정·약속만 기록(게임 실행 아님). 규칙: src/emergency-council.ts. 화면: ui/emergency-room.html.
// 13 행성총독회의·46 성간제국통신임시회의와 상태·ID 를 나누지 않는다. 화자 선택·자격·기록은 앱, 실제 대사만 AI.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import { pick, selectedLanguage } from './settings-ui';
import { peopleOf } from './people-app';
import { relBookOf } from './relations-app';
import { pairKey } from '../relations';
import { chronNoteWorld } from './chronicle-app';
import { gameState } from './gamestate-app';
import { classKey } from '../speciesClass';
import { traitLoc, traitLabel } from '../trait-names';
import { cabMembersFrom, DOMAIN_KO, type CabMember } from '../cabinet-meeting';
import { liveFacts } from './secretary-live';
import { type EmergencyMeeting, type Councilor, type SpeakMode, type SpeakerInfo, convene, pickSpeakers, recordTurn, recordDecision, closeMeeting, resumeMeeting, seatPages, emergencyMessages, emLooksCut, emTrimCut, sanitizeMeetings, CAB_TO_DOMAIN, EMERGENCY_SEATS } from '../emergency-council';

const L = pick;
const T = (x: [string, string]) => L(x[0], x[1]);
/** 장관 말투·신뢰(persona-app). main.ts 가 내각 회의와 같은 함수를 꽂는다(가져오기 고리를 만들지 않으려고). */
export interface EmergencyPersona { mem(sid: string, key: string): { persona?: string; trust: number } | null }
let persona: EmergencyPersona | null = null;
export function setEmergencyPersona(p: EmergencyPersona): void { persona = p; }

const dir = () => path.join(app.getPath('userData'), 'emergency');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const stores = new Map<string, EmergencyMeeting[]>();
function meetingsOf(sid: string): EmergencyMeeting[] {
  let a = stores.get(sid); if (a) return a;
  try { a = sanitizeMeetings(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'emergency', error: e }); a = []; }
  stores.set(sid, a); return a;
}
function save(sid: string): void {
  const a = stores.get(sid); if (!a) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(a.slice(-30)), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'emergency', error: e }); }
}

export const em = { win: null as BrowserWindow | null, active: '' as string, busy: false, page: 0 };
const rulerOf = (sid: string) => peopleOf(sid).find((p) => p.ruler && !p.gone);
const rulerPid = (sid: string) => { const r = rulerOf(sid); return r ? `p:${r.lid}` : 'ruler'; };
function membersNow(sid: string): CabMember[] {
  const people = peopleOf(sid), loc = traitLoc(ctx.flagProv.game(), selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
  return cabMembersFrom(people).map((m) => { const p = people.find((x) => x.lid === m.lid), mem = persona?.mem(sid, 'p:' + m.lid) ?? null; return { ...m, traits: (p?.traits ?? []).map((k) => traitLabel(loc.names, k)), ...(p?.asg ? { away: p.fleet || '1' } : {}), ...(mem ? { persona: mem.persona, trust: mem.trust } : {}) }; });
}
const councilOf = (ms: CabMember[]): Councilor[] => ms.map((m) => ({ pid: `p:${m.lid}`, name: m.name, domains: CAB_TO_DOMAIN[m.domain] ?? [] }));
const speakerOf = (m: CabMember): SpeakerInfo => ({ pid: `p:${m.lid}`, name: m.name, title: T(m.title), traits: m.traits, ...(m.persona ? { persona: m.persona } : {}), ...(m.trust !== undefined ? { trust: m.trust } : {}), ...(m.away ? { away: m.away === '1' ? 'on assignment' : m.away } : {}), ...(relationLine(m) ? { relation: relationLine(m) } : {}) });
/** 인맥 한 줄(31): 플레이어가 알든 모르든 인물 자신은 자기 관계를 안다 — 통치자와의 친분·경쟁, 같은 회의의 다른 평의원과의 공개된 친분·경쟁·배우자. */
const STAGE_EN: Record<string, string> = { acquainted: 'acquainted', friendly: 'on friendly terms', close: 'close friends' };
function relationLine(m: CabMember): string {
  const sid = ctx.curSaveId; if (!sid) return ''; const led = relBookOf(sid).ledger, me = `p:${m.lid}`, r0 = rulerOf(sid), rp = r0 ? `p:${r0.lid}` : '';
  const desc = (r: { friend: string; rival: string; romance: string }) => [STAGE_EN[r.friend] ?? '', r.rival === 'rival' ? 'open rivals' : r.rival === 'tense' ? 'some tension' : '', r.romance === 'married' ? 'married' : r.romance === 'dating' || r.romance === 'engaged' ? 'a couple' : ''].filter(Boolean).join(', ');
  const out: string[] = [];
  if (rp) { const r = led.pairs[pairKey(me, rp)]; const d = r ? desc(r) : ''; if (d) out.push(`With the ruler: ${d}.`); }
  for (const o of membersNow(sid)) { if (o.lid === m.lid) continue; const r = led.pairs[pairKey(me, `p:${o.lid}`)]; const d = r ? desc(r) : ''; if (d) out.push(`With ${o.name}: ${d}.`); }
  return out.slice(0, 5).join(' ');
}
const activeMeeting = (): EmergencyMeeting | null => { const sid = ctx.curSaveId; if (!sid || !em.active) return null; return meetingsOf(sid).find((m) => m.id === em.active) ?? null; };
/** 게임에서 확인된 사실 몇 줄(전쟁 여부·민심 단계는 앱이 이미 받은 자료). 플레이어가 적은 위기 설명과 섞지 않는다. */
function factsNow(): string[] {
  const s = gameState.last; if (!s || s.sid !== ctx.curSaveId) return [];
  const out: string[] = []; out.push(s.wars.length ? `The empire is at war (${s.wars.length} war(s)).` : 'The empire is at peace.');
  const m = activeMeeting(); if (m) out.push(...liveFacts(s.sid, m.topic, 2).slice(1)); // 의제와 관련된 앱 기록(LoG 유치·민심 등, 2026-10-31)
  return out;
}

function view() {
  const sid = ctx.curSaveId || '', ms = sid ? membersNow(sid) : [], m = activeMeeting();
  const byPid = new Map(ms.map((x) => [`p:${x.lid}`, x]));
  const pages = seatPages(ms.map((x) => `p:${x.lid}`)); em.page = Math.min(em.page, Math.max(0, pages.length - 1));
  const shown = new Set(pages[em.page] ?? []);
  const nameOf = (pid: string, name?: string) => name || (pid === m?.rulerPid ? (rulerOf(sid)?.name || L('통치자', 'Ruler')) : byPid.get(pid)?.name ?? L('(자리를 떠난 평의원)', '(a former councilor)'));
  return {
    sid, empire: ctx.playerName || '', date: ctx.gameDate || '', busy: em.busy, playerCls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human',
    members: ms.filter((x) => shown.has(`p:${x.lid}`)).map((x) => ({ lid: x.lid, name: x.name, cls: x.cls, lv: x.lv, domain: x.domain, title: T(x.title), domainName: T(DOMAIN_KO[x.domain]), away: x.away ? (x.away === '1' ? L('임무 중', 'On assignment') : x.away) : '', present: !!m && m.participants.includes(`p:${x.lid}`) })),
    page: em.page, pages: pages.length, seats: EMERGENCY_SEATS, total: ms.length,
    meeting: m ? { id: m.id, topic: m.topic, state: m.state, openedOn: m.openedOn, resumed: m.resumedOn.length, decisions: m.decisions, turns: m.turns.slice(-60).map((t) => ({ who: nameOf(t.speaker, t.name), lid: Number(t.speaker.slice(2)) || 0, ruler: t.speaker === m.rulerPid, mode: t.mode, text: t.text ?? '', on: t.on })) } : null,
    past: sid ? meetingsOf(sid).filter((x) => x.id !== em.active).slice(-8).reverse().map((x) => ({ id: x.id, topic: x.topic, openedOn: x.openedOn, decisions: x.decisions.length })) : [],
  };
}
const push = () => safeSend(em.win, 'emState', view());

export function openEmergency(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  if (em.win && !em.win.isDestroyed()) { em.win.show(); em.win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
  const ow = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL())), ob = ow ? ow.getBounds() : null; // 집무실 자리 그대로(내각 회의와 같음)
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  em.win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'emergency-room.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (em.win === w) em.win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
  return { ok: true };
}

async function say(text: string, mode: { kind: 'named'; lid: number } | { kind: 'all'; supplement: boolean } | { kind: 'roll_call' }) {
  const sid = ctx.curSaveId, m = activeMeeting(); if (!sid || !m || m.state !== 'active') throw new Error(L('열린 긴급회의가 없습니다.', 'No emergency meeting is open.'));
  if (em.busy) throw new Error(L('평의원들이 말하는 중입니다.', 'The councilors are speaking.'));
  const ms = membersNow(sid), council = councilOf(ms);
  // 참석자 자격 다시 확인(교체·사망·자리 변경): 지금 평의회와 다르면 회의 참석자를 맞춘다(과거 발언은 그대로)
  const now = council.map((c) => c.pid); if (now.length !== m.participants.length || now.some((p) => !m.participants.includes(p))) resumeMeeting(m, council, ctx.gameDate || m.openedOn);
  const msg = String(text ?? '').trim().slice(0, 800);
  const ask = mode.kind === 'named' ? { kind: 'named' as const, pid: `p:${mode.lid}` } : mode.kind === 'all' ? { kind: 'all' as const, text: msg + ' ' + m.topic, wantSupplement: mode.supplement } : { kind: 'roll_call' as const };
  const speakers = pickSpeakers(m, council, ask); if (!speakers.length) throw new Error(L('답할 평의원이 없습니다.', 'No councilor can answer.'));
  const today = ctx.gameDate || m.openedOn, rev = m.snapshotRevision, uid = randomUUID().slice(0, 8);
  if (msg) m.turns.push({ id: `${uid}:ruler`, speaker: m.rulerPid, mode: 'named', on: today, text: msg, name: rulerOf(sid)?.name || '' }); // 통치자 말(참석자 목록 밖이라 직접 남긴다 — AI 가 통치자 대사를 만들지는 않는다)
  em.busy = true; push();
  const replies: { lid: number; say: string }[] = [], infos = ms.map(speakerOf);
  try {
    for (const s of speakers) {
      const mem = ms.find((x) => `p:${x.lid}` === s.pid); if (!mem) continue;
      const msgs = emergencyMessages(m, speakerOf(mem), s.mode, { empire: ctx.playerName, ruler: rulerOf(sid)?.name ?? '', date: today, facts: factsNow() }, msg, infos);
      let raw = String(await ctx.ai.chat(msgs, { maxTokens: 1200, purpose: 'emergency-meeting' }) ?? '').trim();
      if (raw && emLooksCut(raw) && em.active === m.id && m.snapshotRevision === rev) { // 문장 중간에서 끊김 → 한 번만 짧게 다시
        const again = String(await ctx.ai.chat([...msgs, { role: 'assistant', content: raw }, { role: 'user', content: '[System notice] Your last reply was cut off mid-sentence. Say the same thing again in two or three short, complete sentences.' }], { maxTokens: 1200, purpose: 'emergency-meeting' }) ?? '').trim();
        if (again) raw = again;
      }
      raw = emTrimCut(raw);
      if (!raw || em.active !== m.id || m.snapshotRevision !== rev) break; // 늦은 답·회의 변경은 버린다
      if (recordTurn(m, { id: `${uid}:${s.mode}:${s.pid}`, speaker: s.pid, mode: s.mode, on: today, text: raw.slice(0, 1600) }, rev)) replies.push({ lid: mem.lid, say: raw.slice(0, 1600) });
    }
  } finally { em.busy = false; save(sid); push(); }
  return replies;
}

export function registerEmergency(): void {
  ipcMain.handle('emOpen', () => openEmergency());
  ipcMain.handle('emState', () => view());
  ipcMain.handle('emPage', (_e, p: unknown) => { const n = Number(p); if (Number.isSafeInteger(n) && n >= 0) em.page = n; push(); return view(); });
  ipcMain.handle('emConvene', (_e, topic: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const ms = membersNow(sid), r = convene(`em:${randomUUID()}`, sid, String(topic ?? ''), rulerPid(sid), councilOf(ms), ctx.gameDate || '');
      if ('error' in r) throw new Error(r.error);
      meetingsOf(sid).push(r); em.active = r.id; save(sid);
      logDiagnostic('info', 'emergency.convene', { sid, members: r.participants.length });
      chronNoteWorld(L(`${ctx.gameDate} 긴급회의 소집 — ${r.topic}`, `${ctx.gameDate} Emergency council convened — ${r.topic}`), true);
      push(); return { ok: true, state: view() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; }
  });
  ipcMain.handle('emResume', (_e, id: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const m = meetingsOf(sid).find((x) => x.id === String(id)); if (!m) throw new Error(L('그 회의 기록을 찾을 수 없습니다.', 'That meeting record was not found.'));
      const cur = activeMeeting(); if (cur && cur.id !== m.id && cur.state === 'active') closeMeeting(cur, ctx.gameDate || cur.openedOn);
      const ch = resumeMeeting(m, councilOf(membersNow(sid)), ctx.gameDate || m.openedOn); em.active = m.id; save(sid);
      return { ok: true, state: view(), changed: ch };
    } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; }
  });
  ipcMain.handle('emSay', async (_e, r: { text?: unknown; to?: unknown; supplement?: unknown; rollCall?: unknown }) => {
    try {
      const to = Number(r?.to), mode = r?.rollCall ? { kind: 'roll_call' as const } : Number.isSafeInteger(to) && to > 0 ? { kind: 'named' as const, lid: to } : { kind: 'all' as const, supplement: !!r?.supplement };
      if (mode.kind !== 'roll_call' && !String(r?.text ?? '').trim()) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
      return { ok: true, replies: await say(String(r?.text ?? ''), mode), state: view() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; }
  });
  ipcMain.handle('emDecide', (_e, r: { text?: unknown; kind?: unknown }) => {
    const sid = ctx.curSaveId, m = activeMeeting(); if (!sid || !m) return { ok: false, error: L('열린 긴급회의가 없습니다.', 'No emergency meeting is open.'), state: view() };
    const ok = recordDecision(m, { id: randomUUID(), text: String(r?.text ?? '').slice(0, 300), on: ctx.gameDate || m.openedOn, kind: r?.kind === 'promise' ? 'promise' : 'decision' });
    if (ok) { save(sid); chronNoteWorld(L(`${ctx.gameDate} 긴급회의 결정 — ${String(r?.text ?? '').slice(0, 120)}`, `${ctx.gameDate} Emergency council decision — ${String(r?.text ?? '').slice(0, 120)}`), true); }
    push(); return { ok, state: view(), ...(ok ? {} : { error: L('결정 내용을 적어 주세요.', 'Write the decision.') }) };
  });
  ipcMain.handle('emEnd', () => { const sid = ctx.curSaveId, m = activeMeeting(); if (sid && m && closeMeeting(m, ctx.gameDate || m.openedOn)) save(sid); em.active = ''; push(); return { ok: true, state: view() }; });
  ipcMain.handle('emClose', () => { if (em.win && !em.win.isDestroyed()) em.win.close(); em.win = null; return true; });
}
export type { SpeakMode };
