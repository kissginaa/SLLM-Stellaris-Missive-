// 성간제국통신임시회의(03·46 최신 확정, 2026-10-23 집 PC 초안). 규칙: src/interstellar-council.ts. 화면: ui/isc-room.html. 입구: 집무실 아이콘(ui/office-isc.js).
// 플레이어만 소집 · 각국 현직 통치자끼리 · 플레이어 포함 3~5개국 · 수락은 앱이 즉시 한 번 판정(재추첨 없음) · 다른 나라 2개 미만 수락이면 양자 통신 안내 ·
// 같은 구성은 게임 1개월에 새 회의 한 번(기간 안은 이어 말하기) · 지목 → 그 통치자 / 전체 → 관련 1명 + 원하면 1명 / 「모든 참가국 입장」 → 각국 1회 ·
// 통치자 교체는 표시만(후임으로 바꾸지 않음) · 합의안 기능 보류(대화의 동의 ≠ 게임 조약). 참가 후보는 게임에 직접 묻는다(SLLM:ISCSEAT·ISC_END).
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { peopleOf } from './people-app';
import { chronNoteWorld } from './chronicle-app';
import { terminalRequest, terminalReplies } from './terminal';
import { classKey } from '../speciesClass';
import { emLooksCut, emTrimCut } from '../emergency-council';
import { refreshFrontier, frontierFor } from './frontier-app'; // 국경·전선(2026-10-26)
import { frontierLines } from '../frontier';
import { offerAtClose, questView, acceptQuest, declineQuest, setQuestPush, registerIscQuests } from './isc-quest-app'; // 회의 과제(2026-10-26)
import { type IscMeeting, type IscSeatRow, type IscSpeaker, ISC, convene, continueMeeting, closeMeeting, updateSeat, pickSpeakers, recordTurn, presentCount, iscSeatFrom, inviteeFrom, topicKindOf, relevanceOf, iscMessages, sanitizeIsc, foreignRulerPid } from '../interstellar-council';

const L = pick;
const dir = () => path.join(app.getPath('userData'), 'isc');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const stores = new Map<string, IscMeeting[]>();
function meetingsOf(sid: string): IscMeeting[] {
  let a = stores.get(sid); if (a) return a;
  try { a = sanitizeIsc(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'isc', error: e }); a = []; }
  stores.set(sid, a); return a;
}
function save(sid: string): void {
  const a = stores.get(sid); if (!a) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(a.slice(-30)), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'isc', error: e }); }
}

export const isc = { win: null as BrowserWindow | null, active: '' as string, busy: false, roster: [] as IscSeatRow[], rosterSid: '', rosterOn: '' };

// ---- 게임에 참가 후보 묻기(통신 중인 일반 AI 제국 + 통치자 이름·전쟁·호감)
const rowsOf = new Map<string, IscSeatRow[]>();
export function registerIscLog(router: LogRouter): void {
  router.on(SLOT.ISC, 'isc', (m: SllmMessage) => {
    if (m.kind === 'ISCSEAT') { const list = rowsOf.get(String(m.kv.req)), r = iscSeatFrom(m.kv); if (list && r && m.kv.sid === ctx.curSaveId && list.length < 200 && !list.some((x) => x.idx === r.idx)) list.push(r); }
    else if (m.kind === 'ISC_END') terminalReplies.get('ISC_END:' + m.kv.req)?.(m);
  });
}
/** 명령 문자열(시험용으로 따로). 플레이어 나라 범위에서 sllm_probe_isc 를 부른다. */
export const iscRosterCommand = (req: number): string => 'effect every_playable_country = { limit = { is_ai = no } sllm_probe_isc = { REQ = ' + req + ' } }';
export async function readRoster(): Promise<IscSeatRow[]> { // 타국 만찬 초대(fbanquet-app)도 같은 명단을 쓴다
  if (!ctx.gameRunning) throw new Error(L('게임이 켜져 있어야 참가국을 확인할 수 있습니다.', 'The game must be running to check the attending empires.'));
  const sid = ctx.curSaveId, req = ++link.reqCounter, key = String(req); rowsOf.set(key, []);
  try {
    const end = await terminalRequest(iscRosterCommand(req), 'ISC_END', req);
    if (end.kv.sid !== sid || ctx.curSaveId !== sid) throw new Error(L('세이브가 바뀌어 결과를 쓰지 않았습니다.', 'The save changed, so the result was not used.'));
    const rows = rowsOf.get(key) ?? [];
    isc.roster = rows; isc.rosterSid = sid; isc.rosterOn = ctx.gameDate || '';
    return rows;
  } finally { rowsOf.delete(key); }
}
const rosterNow = (): IscSeatRow[] => (isc.rosterSid === ctx.curSaveId ? isc.roster : []);
/** 게임에 묻지 않고 마지막으로 읽은 명단(같은 세이브일 때만). 타국 만찬의 매달 추첨용(2026-10-31). */
export const rosterCached = rosterNow;

const rulerOf = (sid: string) => peopleOf(sid).find((p) => p.ruler && !p.gone);
const hostIdx = () => ctx.playerIdx || 0;
const activeMeeting = (): IscMeeting | null => { const sid = ctx.curSaveId; if (!sid || !isc.active) return null; return meetingsOf(sid).find((m) => m.id === isc.active) ?? null; };
function speakerOf(m: IscMeeting, idx: number): IscSpeaker {
  const s = m.seats[String(idx)], r = rosterNow().find((x) => x.idx === idx), p = ctx.profileWithEthics(ctx.profiles.get(idx), idx) as unknown as Record<string, unknown> | undefined;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : undefined);
  return { idx, empire: s?.empire || r?.empire || `#${idx}`, ruler: s?.name || r?.ruler || L('통치자', 'Ruler'), title: s?.title || r?.title || '', atWar: !!r?.atWar, score: r?.score ?? 0, personality: str(p?.personality), ethics: str(p?.ethicsText), government: str(p?.gov), frontier: frontierLines(frontierFor(idx), { atWar: !!r?.atWar }) };
}
/** 최신 명단으로 자리 상태를 맞춘다: 명단에 없으면 이탈(통신 끊김·멸망을 구별할 수 없어 「이탈」), 통치자 이름이 바뀌면 교체 표시. */
function syncSeats(m: IscMeeting, rows: IscSeatRow[]): string[] {
  const out: string[] = [];
  for (const [k, s] of Object.entries(m.seats)) {
    const idx = Number(k); if (idx === m.hostIdx || s.status !== 'present') continue;
    const r = rows.find((x) => x.idx === idx);
    const ch = !r ? updateSeat(m, idx, { left: true }) : updateSeat(m, idx, { rulerNow: r.hasRuler ? foreignRulerPid(idx, r.ruler) : 'none' });
    if (ch) out.push(!r ? L(`${s.empire ?? idx} 이(가) 회의에서 빠졌습니다.`, `${s.empire ?? idx} left the summit.`) : L(`${s.empire ?? idx} 의 통치자가 바뀌어 자리를 비웁니다(후임은 자동으로 들어오지 않습니다).`, `${s.empire ?? idx} has a new ruler; the seat stays empty (successors are not seated automatically).`));
  }
  return out;
}

function view() {
  const sid = ctx.curSaveId || '', m = activeMeeting(), host = rulerOf(sid)?.name || L('통치자', 'Ruler');
  const nameOf = (idx: number) => (m && idx === m.hostIdx ? host : m?.seats[String(idx)]?.name || `#${idx}`);
  const empOf = (idx: number) => (m && idx === m.hostIdx ? ctx.playerName || '' : m?.seats[String(idx)]?.empire || rosterNow().find((r) => r.idx === idx)?.empire || `#${idx}`);
  return {
    sid, empire: ctx.playerName || '', hostRuler: host, date: ctx.gameDate || '', busy: isc.busy, gameRunning: !!ctx.gameRunning, playerCls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human',
    limits: { min: ISC.minEmpires, max: ISC.maxEmpires },
    roster: rosterNow().map((r) => ({ idx: r.idx, empire: r.empire, ruler: r.ruler, title: r.title, hasRuler: r.hasRuler, atWar: r.atWar, score: r.score, cls: classKey(ctx.profiles.get(r.idx)?.cls) ?? '' })), rosterOn: isc.rosterSid === sid ? isc.rosterOn : '',
    meeting: m ? {
      id: m.id, topic: m.topic, topicKind: m.topicKind, state: m.state, openedOn: m.openedOn, nextAllowedOn: m.nextAllowedOn, segments: m.segments.length,
      results: m.invited.map((idx) => ({ idx, empire: empOf(idx), result: m.results[String(idx)] ?? 'declined' })),
      seats: Object.entries(m.seats).map(([k, s]) => ({ idx: Number(k), host: Number(k) === m.hostIdx, empire: empOf(Number(k)), ruler: Number(k) === m.hostIdx ? host : s.name || '', title: s.title || '', status: s.status, cls: classKey(ctx.profiles.get(Number(k))?.cls) ?? '' })),
      turns: m.turns.slice(-60).map((t) => ({ who: nameOf(t.speakerIdx), empire: empOf(t.speakerIdx), idx: t.speakerIdx, host: t.speakerIdx === m.hostIdx, mode: t.mode, text: t.text ?? '', on: t.on, to: t.to ? empOf(t.to) : '' })),
    } : null,
    quests: questView(), // 회의 과제(2026-10-26)
    past: sid ? meetingsOf(sid).filter((x) => x.id !== isc.active).slice(-8).reverse().map((x) => ({ id: x.id, topic: x.topic, openedOn: x.openedOn, state: x.state, nextAllowedOn: x.nextAllowedOn, canContinue: !!ctx.gameDate && ctx.gameDate < x.nextAllowedOn && x.state !== 'too_small', empires: Object.values(x.seats).map((s) => s.empire).filter(Boolean) })) : [],
  };
}
const push = () => safeSend(isc.win, 'iscState', view());

export function openIsc(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  if (isc.win && !isc.win.isDestroyed()) { isc.win.show(); isc.win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
  const ow = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL())), ob = ow ? ow.getBounds() : null; // 집무실 자리 그대로(긴급회의와 같음)
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  isc.win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'isc-room.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (isc.win === w) isc.win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
  return { ok: true };
}

async function doConvene(topic: string, invited: number[]): Promise<{ meeting?: IscMeeting; resumeId?: string; notice?: string }> {
  const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
  const ruler = rulerOf(sid); if (!ruler) throw new Error(L('우리 통치자를 아직 확인하지 못했습니다. 한 달 뒤 다시 시도해 주세요.', 'Our ruler is not confirmed yet. Try again after a month.'));
  const rows = await readRoster(), kind = topicKindOf(topic), ids = [...new Set(invited.map(Number).filter((x) => Number.isSafeInteger(x) && x > 0 && x !== hostIdx()))];
  const invitees = ids.map((idx) => { const r = rows.find((x) => x.idx === idx); return r ? inviteeFrom(r, kind) : { idx, name: `#${idx}`, rulerPid: '', contactable: false, hasRuler: false, hostScore: 0, atWarWithHost: false, relevance: 0, hostileTo: [] }; });
  const r = convene(`isc:${randomUUID()}`, sid, { idx: hostIdx(), ruler: `p:${ruler.lid}` }, topic, kind, invitees, meetingsOf(sid), ctx.gameDate || '', Math.random);
  if ('error' in r) return r.resume ? { resumeId: r.resume.id, notice: r.error } : (() => { throw new Error(r.error); })();
  for (const [k, s] of Object.entries(r.seats)) { const row = rows.find((x) => x.idx === Number(k)); if (row) { s.name = row.ruler; s.empire = row.empire; s.title = row.title; } }
  meetingsOf(sid).push(r); save(sid);
  const acc = Object.values(r.results).filter((x) => x === 'accepted').length;
  logDiagnostic('info', 'isc.convene', { sid, invited: r.invited.length, accepted: acc, kind, state: r.state });
  if (r.state === 'too_small') { isc.active = r.id; return { meeting: r, notice: acc === 1 ? L('한 나라만 응했습니다. 그 나라와는 기존 양자 통신을 이용하세요.', 'Only one empire accepted. Use the regular one-on-one channel with them.') : L('응한 나라가 부족해 회의를 열지 못했습니다.', 'Too few empires accepted, so the summit did not open.') }; }
  isc.active = r.id;
  chronNoteWorld(L(`${ctx.gameDate} 성간 임시회의 소집 — ${r.topic}`, `${ctx.gameDate} Extraordinary interstellar summit convened — ${r.topic}`), true);
  return { meeting: r };
}

async function say(text: string, mode: { kind: 'named'; idx: number } | { kind: 'all'; supplement: boolean } | { kind: 'roll_call' }) {
  const sid = ctx.curSaveId, m = activeMeeting(); if (!sid || !m || m.state !== 'active') throw new Error(L('열린 임시회의가 없습니다.', 'No summit is open.'));
  if (isc.busy) throw new Error(L('통치자들이 말하는 중입니다.', 'The rulers are speaking.'));
  const notes: string[] = [];
  if (ctx.gameRunning) { try { notes.push(...syncSeats(m, await readRoster())); } catch (e) { logDiagnostic('warn', 'isc.roster.failed', { error: (e as Error).message }); } }
  if (m.state !== 'active') { save(sid); push(); throw new Error([...notes, L('참가국이 3개국 미만이 되어 회의를 이어갈 수 없습니다.', 'Fewer than 3 empires remain, so the summit cannot continue.')].join(' ')); }
  const msg = String(text ?? '').trim().slice(0, 800);
  const ask = mode.kind === 'named' ? { kind: 'named' as const, idx: mode.idx } : mode.kind === 'all' ? { kind: 'all' as const, relevance: Object.fromEntries(Object.keys(m.seats).map((k) => { const r = rosterNow().find((x) => x.idx === Number(k)); return [k, r ? relevanceOf(r, m.topicKind) : 0]; })), wantSupplement: mode.supplement } : { kind: 'roll_call' as const };
  const speakers = pickSpeakers(m, ask); if (!speakers.length) throw new Error(L('답할 통치자가 없습니다.', 'No ruler can answer.'));
  await refreshFrontier(speakers.map((s) => s.idx)).catch(() => {}); // 국경·전선(2026-10-26): 말할 통치자만, 같은 날짜면 다시 읽지 않음
  const today = ctx.gameDate || m.openedOn, rev = m.snapshotRevision, uid = randomUUID().slice(0, 8);
  if (msg) m.turns.push({ key: `${m.id}|${uid}|host`, speakerIdx: m.hostIdx, mode: 'named', on: today, text: msg, ...(mode.kind === 'named' ? { to: mode.idx } : {}) }); // 개최국 통치자 말(AI 가 만들지 않는다)
  isc.busy = true; push();
  const replies: { idx: number; say: string }[] = [];
  const live = Object.entries(m.seats).filter(([k, s]) => s.status === 'present' && Number(k) !== m.hostIdx).map(([k]) => speakerOf(m, Number(k)));
  const a = { hostEmpire: ctx.playerName || '', hostRuler: rulerOf(sid)?.name || '', date: today };
  try {
    for (const s of speakers) {
      const msgs = iscMessages(m, speakerOf(m, s.idx), s.mode, a, msg, live);
      let raw = String(await ctx.ai.chat(msgs, { maxTokens: 1200, purpose: 'interstellar-summit' }) ?? '').trim();
      if (raw && emLooksCut(raw) && isc.active === m.id && m.snapshotRevision === rev) { const again = String(await ctx.ai.chat([...msgs, { role: 'assistant', content: raw }, { role: 'user', content: '[System notice] Your last reply was cut off mid-sentence. Say the same thing again in two or three short, complete sentences.' }], { maxTokens: 1200, purpose: 'interstellar-summit' }) ?? '').trim(); if (again) raw = again; } // 긴급회의와 같은 끊김 보정(2026-10-24)
      raw = emTrimCut(raw);
      if (!raw || isc.active !== m.id || m.snapshotRevision !== rev) break; // 늦은 답·회의 변경은 버린다
      if (recordTurn(m, uid, s.idx, s.mode, rev, today, raw.slice(0, 1600))) replies.push({ idx: s.idx, say: raw.slice(0, 1600) });
    }
  } finally { isc.busy = false; save(sid); push(); }
  return { replies, notes };
}

export function registerIsc(router: LogRouter): void {
  registerIscLog(router);
  registerIscQuests(router); setQuestPush(push); // 회의 과제: 측정·건네기·효과 응답 + 매달 판정(2026-10-26)
  ipcMain.handle('iscOpen', () => openIsc());
  ipcMain.handle('iscState', () => view());
  ipcMain.handle('iscRoster', async () => { try { await readRoster(); push(); return { ok: true, state: view() }; } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; } });
  ipcMain.handle('iscConvene', async (_e, r: { topic?: unknown; invited?: unknown }) => {
    try {
      const inv = Array.isArray(r?.invited) ? (r.invited as unknown[]).map(Number) : [];
      const out = await doConvene(String(r?.topic ?? ''), inv);
      if (out.resumeId) { const m = meetingsOf(ctx.curSaveId).find((x) => x.id === out.resumeId); if (m) { const c = continueMeeting(m, ctx.gameDate || m.openedOn); if (c.ok) { isc.active = m.id; save(ctx.curSaveId); } } }
      push(); return { ok: true, notice: out.notice ?? '', state: view() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; }
  });
  ipcMain.handle('iscResume', async (_e, id: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const m = meetingsOf(sid).find((x) => x.id === String(id)); if (!m) throw new Error(L('그 회의 기록을 찾을 수 없습니다.', 'That summit record was not found.'));
      const cur = activeMeeting(); if (cur && cur.id !== m.id) closeMeeting(cur);
      const notes = ctx.gameRunning ? syncSeats(m, await readRoster().catch(() => rosterNow())) : [];
      const c = continueMeeting(m, ctx.gameDate || m.openedOn); save(sid);
      if (!c.ok) throw new Error([...notes, c.why].filter(Boolean).join(' '));
      isc.active = m.id; push(); return { ok: true, notice: notes.join(' '), state: view() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; }
  });
  ipcMain.handle('iscSay', async (_e, r: { text?: unknown; to?: unknown; supplement?: unknown; rollCall?: unknown }) => {
    try {
      const to = Number(r?.to), mode = r?.rollCall ? { kind: 'roll_call' as const } : Number.isSafeInteger(to) && to > 0 ? { kind: 'named' as const, idx: to } : { kind: 'all' as const, supplement: !!r?.supplement };
      if (mode.kind !== 'roll_call' && !String(r?.text ?? '').trim()) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
      const out = await say(String(r?.text ?? ''), mode);
      return { ok: true, replies: out.replies, notice: out.notes.join(' '), state: view() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: view() }; }
  });
  ipcMain.handle('iscEnd', async () => {
    const sid = ctx.curSaveId, m = activeMeeting(), closed = !!(sid && m && closeMeeting(m)); if (closed) save(sid); isc.active = ''; push();
    // 회의 과제(2026-10-26 사용자 확정): 회의를 끝낼 때 주제에 가장 관련 깊은 참석 통치자가 과제 1개를 제안한다(LLM 1회).
    let notice = '';
    if (closed && m) { isc.busy = true; push(); try { const rows = ctx.gameRunning ? await readRoster().catch(() => rosterNow()) : rosterNow(); notice = await offerAtClose(m, rows, { empire: ctx.playerName || '', ruler: rulerOf(sid)?.name || '' }); } catch (e) { logDiagnostic('warn', 'iscq.offer_failed', { error: (e as Error).message }); } finally { isc.busy = false; push(); } }
    return { ok: true, notice, state: view() };
  });
  ipcMain.handle('iscQuestAccept', async (_e, id: unknown) => { const r = await acceptQuest(id); return { ...r, state: view() }; });
  ipcMain.handle('iscQuestDecline', (_e, id: unknown) => { const r = declineQuest(id); return { ...r, state: view() }; });
  ipcMain.handle('iscClose', () => { if (isc.win && !isc.win.isDestroyed()) isc.win.close(); isc.win = null; return true; });
}
export { presentCount };
