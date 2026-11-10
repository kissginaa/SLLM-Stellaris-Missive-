// 타국 주최 만찬 초대(05·43·44, 2026-10-23 집 PC 초안). 규칙: src/foreign-banquet.ts. 화면: 집무실 「초대장」(ui/office-fbanquet.js) → 만찬장(기존 지도자 만찬 화면 ui/banquet.html?mode=foreign + ui/banquet-foreign.js).
// 사용자 확정: 제국별 매월 5%(관계 나쁘면 0%, 좋을수록 최대 20%) / 응답 기한 1개월 / 수락 + 3개월 방문 / 완료 뒤 그 제국 3년, 거절·만료 뒤 1년 재초대 없음 /
//   접대 = 성대·평범·굴욕(드문 예외) / 초대 판정·초대장·일정은 LLM 없이, 만찬장에서 실제로 말을 걸 때만 AI.
// 참석자는 게임에서 그 제국의 실제 지도자를 읽어 온다(가상 인물을 만들지 않는다). 연락처를 바꾼 사람은 「타국 지인」으로 남아 다음 단계(개인 서신 45)에서 쓴다.
// 몰림 방지: 동시에 답을 기다리는 초대는 1통(자리값), 모든 제국을 합쳐 새 초대는 1년에 1통(사용자 확정 2026-10-23 — 마지막 새 초대일 + 1년부터 다시 판정).
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf } from './people-app';
import { readRoster, rosterCached } from './isc-app';
import { terminal } from './terminal';
import { contactCategory } from '../terminal-contacts';
import { classKey } from '../speciesClass';
import { foreignPid, type Pid } from '../relations';
import type { IscSeatRow } from '../interstellar-council';
import { cmpDate, addYears } from '../gamedate';
import { type ForeignBanquetBook, type ForeignBanquetInvite, emptyFbBook, monthlyInviteRoll, acceptInvite, declineInvite, tickInvites, hospitality, onRulerChange, finishBanquet, exchangeContact, FB } from '../foreign-banquet';

export const FB_LIMIT = { openOffers: 1, gapYears: 1 } as const;
type Guest = { pid: Pid; name: string; cls: string; council: boolean; /** 게임이 붙인 타국 지인 표시 번호(sllm_fgid, 생사 확인용). */ fg?: number };
type Line = { who: 'ruler' | 'host' | 'guest'; name: string; text: string; to?: string };
type Extra = { hostName?: string; hostTitle?: string; scoreAtInvite?: number; guests?: Guest[]; talk?: Line[]; introduced?: Pid[] };
export interface ForeignContact { pid: Pid; name: string; empireIdx: number; empireName: string; cls: string; metOn: string; via: string; /** 생사 확인 번호(없으면 확인 불가 — 이 기능 전에 바꾼 연락처). */ fg?: number; /** 마지막 확인 결과(2026-10-23): gone = 게임 지도자 목록에서 사라짐(사망·은퇴 등, 구분 불가). */ status?: 'alive' | 'gone'; checkedOn?: string; goneOn?: string }
interface FbStore extends ForeignBanquetBook { extra: Record<string, Extra>; contacts: Record<string, ForeignContact>; lastNewOn?: string; /** 타국 지인 생사 확인을 마지막으로 한 해. */ aliveYear?: number }
const dir = () => path.join(app.getPath('userData'), 'foreign-banquet');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, FbStore>();
export function sanitizeFbStore(x: unknown, sid: string): FbStore {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<FbStore>, base = emptyFbBook(sid), obj = <T>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : d);
  const invites: Record<string, ForeignBanquetInvite> = {};
  for (const [k, v] of Object.entries(obj<Record<string, ForeignBanquetInvite>>(o.invites, {}))) if (v && typeof v === 'object' && typeof v.empireIdx === 'number' && typeof v.state === 'string') invites[k] = v;
  return { ...base, invites, retryAfter: obj(o.retryAfter, {}), rolled: obj(o.rolled, {}), extra: obj(o.extra, {}), contacts: obj(o.contacts, {}), ...(Number.isInteger(o.aliveYear) ? { aliveYear: o.aliveYear } : {}), ...(typeof o.lastNewOn === 'string' && /^\d{1,4}\.\d{2}\.\d{2}$/.test(o.lastNewOn) ? { lastNewOn: o.lastNewOn } : {}) };
}
function bookOf(sid: string): FbStore {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeFbStore(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'foreign-banquet', error: e }); b = sanitizeFbStore(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  const done = Object.values(b.invites).filter((i) => ['completed', 'declined', 'expired', 'cancelled'].includes(i.state) && !(i.record?.contacts.length)) // 연락처를 바꾼 만찬은 서신 근거라 지우지 않는다.sort((a, c) => (a.sentOn < c.sentOn ? 1 : -1));
  for (const old of done.slice(30)) { delete b.invites[old.id]; delete b.extra[old.id]; } // 끝난 초대는 최근 30통만
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'foreign-banquet', error: e }); }
}
/** 다른 기능(타국 지인 서신)이 쓰는 지인 목록. */
export const foreignContactsOf = (sid: string): ForeignContact[] => Object.values(bookOf(sid).contacts);
/** 만찬 기록(타국 지인 서신의 연락처 근거·공동 추억). */
export const fbInvitesOf = (sid: string): ForeignBanquetInvite[] => Object.values(bookOf(sid).invites);

const rulerPid = (sid: string): Pid => { const r = peopleOf(sid).find((p) => p.ruler && !p.gone); return r ? `p:${r.lid}` : ''; };
const rulerName = (sid: string) => peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? '';
/** 기본 초대장(43: LLM 없이 정형 서신). */
export function inviteLetter(inv: ForeignBanquetInvite, host: string, title: string, to: string): string {
  return L(`${to} 귀하.\n${inv.empireName}의 ${title ? title + ' ' : ''}${host}이(가) 사적인 만찬에 초대합니다. 양국의 관계와 서로의 관심사를 편히 나누고 싶습니다.\n수락하시면 3개월 뒤에 모시겠습니다. ${inv.replyBy}까지 답을 주십시오.`,
    `To ${to},\n${title ? title + ' ' : ''}${host} of ${inv.empireName} invites you to a private dinner, to speak freely of our two realms and our shared interests.\nIf you accept, we will host you three months from then. Kindly reply by ${inv.replyBy}.`);
}

// ---- 게임 응답(참석자)
const guestRows = new Map<string, Guest[]>();
const aliveRows = new Map<string, Map<number, number>>();
export function registerFbLog(router: LogRouter): void {
  router.on(SLOT.FOREIGN_BANQUET, 'foreign-banquet', (m: SllmMessage) => {
    if (m.kind === 'FBGUEST') { const list = guestRows.get(String(m.kv.req)), name = String(m.kv.name ?? '').trim(), fg = Math.round(Number(m.kv.fg)); if (list && name && list.length < 6) list.push({ pid: '', name: name.slice(0, 60), cls: String(m.kv.cls ?? 'official'), council: m.kv.council === '1', ...(fg > 0 ? { fg } : {}) }); }
    else if (m.kind === 'FGALIVE') { const set = aliveRows.get(String(m.kv.req)), fg = Math.round(Number(m.kv.fg)), idx = Math.round(Number(m.kv.idx)); if (set && fg > 0 && set.size < 2000) set.set(fg, Number.isFinite(idx) ? idx : -1); }
    else if (m.kind === 'FGALIVE_END') terminalReplies.get('FGALIVE_END:' + m.kv.req)?.(m);
    else if (m.kind === 'FBGUEST_END') terminalReplies.get('FBGUEST_END:' + m.kv.req)?.(m);
  });
}
async function readGuests(idx: number): Promise<Guest[]> {
  if (!ctx.gameRunning) return [];
  const req = ++link.reqCounter; guestRows.set(String(req), []);
  try { await terminalRequest(`effect every_playable_country = { limit = { is_ai = no } sllm_probe_fbguests = { REQ = ${req} TID = ${idx} } }`, 'FBGUEST_END', req); return (guestRows.get(String(req)) ?? []).map((g) => ({ ...g, pid: foreignPid(idx, g.name) })); }
  catch (e) { logDiagnostic('warn', 'fbanquet.guests_failed', { error: (e as Error).message }); return []; }
  finally { guestRows.delete(String(req)); }
}

function toast(title: string, body: string): void { (office as { toastGo: string }).toastGo = 'fbanquet'; ctx.notify({ kind: 'office', title, body, action: L('집무실', 'Office') }); }
/** 한 달: 만료·방문일 처리 → (게임이 켜져 있으면) 통신 명단으로 새 초대 판정. 열려 있는 초대가 있거나 마지막 새 초대 뒤 1년이 안 됐으면 새로 뽑지 않는다(몰림 방지). */
export function fbMonth(b: FbStore, rows: IscSeatRow[], today: string, recipient: Pid, rng: () => number, allowed: (idx: number) => boolean): { expired: ForeignBanquetInvite[]; arrived: ForeignBanquetInvite[]; offered: ForeignBanquetInvite | null } {
  const t = tickInvites(b, today); let offered: ForeignBanquetInvite | null = null;
  // 방문일 재검사(05·43): 전쟁 중이거나 주최국·주최자 소식이 없으면 그 만찬은 열리지 않는다(취소, 1년 대기)
  if (rows.length) for (const inv of t.arrived.slice()) { const r = rows.find((x) => x.idx === inv.empireIdx); const bad = !r || !r.hasRuler ? 'host_gone' : r.atWar ? 'hostile' : null; if (bad) { inv.state = 'cancelled'; inv.cancelledOn = today; inv.cancelReason = bad; b.retryAfter[String(inv.empireIdx)] = addYears(today, FB.retryAfterDeclineYears); t.arrived.splice(t.arrived.indexOf(inv), 1); t.expired.push(inv); } }
  const open = Object.values(b.invites).filter((i) => i.state === 'offered').length;
  if (recipient && open < FB_LIMIT.openOffers && (!b.lastNewOn || cmpDate(today, addYears(b.lastNewOn, FB_LIMIT.gapYears)) >= 0)) {
    const order = [...rows].sort(() => rng() - 0.5);
    for (const r of order) {
      const inv = monthlyInviteRoll(b, { idx: r.idx, name: r.empire, score: r.score, contactable: r.hasRuler && !r.atWar && allowed(r.idx), rulerPid: foreignPid(r.idx, r.ruler), recipient }, today, rng);
      if (inv) { b.extra[inv.id] = { hostName: r.ruler, hostTitle: r.title, scoreAtInvite: r.score }; b.lastNewOn = today; offered = inv; break; }
    }
  }
  return { ...t, offered };
}
/** 타국 지인 생사(사용자 확정 2026-10-23: 연락처를 바꾼 사람만). 게임이 알려 준 표시 번호 목록과 비교한다. 목록에 없으면 「소식 끊김」(사망·은퇴 구분 없음), 다시 보이면 되살린다. */
export function applyAlive(b: FbStore, alive: Map<number, number>, date: string): ForeignContact[] {
  const lost: ForeignContact[] = [];
  for (const c of Object.values(b.contacts)) {
    if (!c.fg) continue;
    c.checkedOn = date;
    if (alive.has(c.fg)) { c.status = 'alive'; delete c.goneOn; const idx = alive.get(c.fg)!; if (idx >= 0 && idx !== c.empireIdx) c.empireIdx = idx; }
    else if (c.status !== 'gone') { c.status = 'gone'; c.goneOn = date; lost.push(c); }
  }
  return lost;
}
/** 게임에 묻기(1년에 한 번·편지 보낼 때). 연락처에 표시 번호가 하나도 없으면 묻지 않는다. */
export async function checkContactsAlive(sid: string, date: string): Promise<ForeignContact[] | null> {
  const b = bookOf(sid); if (!Object.values(b.contacts).some((c) => c.fg)) return []; if (!ctx.gameRunning) return null;
  const req = ++link.reqCounter, set = new Map<number, number>(); aliveRows.set(String(req), set);
  try { await terminalRequest(`effect every_playable_country = { limit = { is_ai = no } sllm_probe_fgalive = { REQ = ${req} } }`, 'FGALIVE_END', req); }
  catch (e) { logDiagnostic('warn', 'fbanquet.alive_failed', { error: (e as Error).message }); return null; }
  finally { aliveRows.delete(String(req)); }
  const lost = applyAlive(b, set, date); save(sid); pushList();
  for (const c of lost) chronNoteWorld(L(`${date} ${c.empireName}의 지인 ${c.name}의 소식이 끊겼습니다`, `${date} No more word from ${c.name}, your acquaintance in ${c.empireName}`), false);
  return lost;
}
/** 매달 쓰는 명단 — 게임에 명령을 보내지 않고(2026-10-31 사용자: 매달 게임이 멈칫하는 것이 거슬림) 이미 아는 것으로: 최근 읽은 참가국 명단(같은 세이브) 없으면 통신 단말기 연락처(모드가 3개월마다 보냄). */
function rowsOffline(): IscSeatRow[] {
  const c = rosterCached(); if (c.length) return c;
  if (terminal.sid !== ctx.curSaveId) return [];
  return terminal.items.filter((x) => contactCategory(x.type) === 'empire' && !x.gest).map((x) => ({ idx: x.idx, empire: x.name, ruler: '', title: '', hasRuler: true, atWar: !!x.em?.war, score: x.score }));
}
async function onMonth(sid: string, date: string): Promise<void> {
  const b = bookOf(sid);
  // 게임에 묻는 것은 만찬 날(주최국 전쟁·통치자 확인)뿐 — 초대 추첨은 아는 명단으로, 당첨됐을 때만 아래서 한 번 확인
  const arriving = Object.values(b.invites).some((i) => i.state === 'scheduled' && !!i.visitOn && cmpDate(date, i.visitOn) >= 0);
  let rows: IscSeatRow[] = rowsOffline();
  if (arriving && ctx.gameRunning) { try { rows = await readRoster(); } catch (e) { logDiagnostic('warn', 'fbanquet.roster_failed', { error: (e as Error).message }); } }
  const rp = rulerPid(sid);
  if (rp) for (const inv of onRulerChange(b, rp, date)) toast(L('만찬 초대 취소', 'Dinner invitation cancelled'), L(`${inv.empireName}의 만찬은 전임 통치자가 받은 초대라 취소되었습니다. 주최국은 새 통치자를 다시 초대할 수 있습니다.`, `The dinner with ${inv.empireName} was cancelled: the former ruler accepted it. Its host may invite the new ruler again.`));
  const allowed = (idx: number) => { const r = rows.find((x) => x.idx === idx); return !!r; };
  const lastNew = b.lastNewOn, r = fbMonth(b, rows, date, rp, Math.random, allowed);
  if (r.offered && ctx.gameRunning) { // 당첨: 그제야 게임에 한 번 물어 주최국 통치자 이름·전쟁을 확인(없어졌거나 전쟁 중이면 초대 없던 일로)
    try { const live = await readRoster(), h = live.find((x) => x.idx === r.offered!.empireIdx);
      if (!h || !h.hasRuler || h.atWar) { delete b.invites[r.offered.id]; delete b.extra[r.offered.id]; b.lastNewOn = lastNew; r.offered = null; }
      else b.extra[r.offered.id] = { hostName: h.ruler, hostTitle: h.title, scoreAtInvite: h.score }; }
    catch (e) { logDiagnostic('warn', 'fbanquet.roster_failed', { error: (e as Error).message }); }
  }
  if (r.offered) { const x = b.extra[r.offered.id]; toast(L(`${r.offered.empireName}에서 만찬 초대장이 왔습니다`, `A dinner invitation from ${r.offered.empireName}`), L(`${x.hostName ?? ''}이(가) 사적인 만찬에 초대했습니다. ${r.offered.replyBy}까지 집무실 「초대장」에서 답해 주세요.`, `${x.hostName ?? ''} invites you to a private dinner. Reply from the office "Invitations" by ${r.offered.replyBy}.`)); chronNoteWorld(L(`${date} ${r.offered.empireName}에서 만찬 초대장 도착`, `${date} Dinner invitation from ${r.offered.empireName}`), false); }
  for (const inv of r.arrived) toast(L(`오늘은 ${inv.empireName} 만찬 날입니다`, `Today is the dinner with ${inv.empireName}`), L('집무실 「초대장」에서 만찬장에 들어갈 수 있습니다.', 'Enter the banquet hall from the office "Invitations".'));
  for (const inv of r.expired) chronNoteWorld(L(`${date} ${inv.empireName}의 만찬 초대에 답하지 못해 지나갔습니다`, `${date} The dinner invitation from ${inv.empireName} lapsed unanswered`), false);
  const y = Number(date.slice(0, date.indexOf('.')));
  if (Number.isFinite(y) && b.aliveYear !== y) { const lost = await checkContactsAlive(sid, date); if (lost) b.aliveYear = y; if (lost?.length) toast(L('타국 지인의 소식이 끊겼습니다', 'Lost touch with a foreign acquaintance'), L(`${lost.map((c) => `${c.name}(${c.empireName})`).join(', ')}의 소식이 더 이상 들리지 않습니다. 세상을 떠났거나 공직에서 물러났을 수 있습니다.`, `${lost.map((c) => `${c.name} (${c.empireName})`).join(', ')} can no longer be reached. They may have passed away or left public life.`)); }
  save(sid); pushList();
}

// ---- 목록 화면(집무실)
export function invitesView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', items: [] };
  const b = bookOf(sid), to = rulerName(sid);
  const items = Object.values(b.invites).sort((a, c) => (a.sentOn < c.sentOn ? 1 : -1)).slice(0, 12).map((i) => { const x = b.extra[i.id] ?? {}; return { id: i.id, empire: i.empireName, host: x.hostName ?? '', state: i.state, sentOn: i.sentOn, replyBy: i.replyBy, visitOn: i.visitOn ?? '', needsReconfirm: !!i.needsReconfirm, letter: inviteLetter(i, x.hostName ?? '', x.hostTitle ?? '', to), hospitality: i.hospitality ?? '' }; });
  return { sid, date: ctx.gameDate || '', items, contacts: Object.values(b.contacts).map((c) => ({ name: c.name, empire: c.empireName, metOn: c.metOn, gone: c.status === 'gone', goneOn: c.goneOn ?? '' })) };
}
function pushList(): void { try { const v = invitesView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('fbInvitesUpdate', v); } catch { /* 창 없음 */ } }

// ---- 만찬장
export const fbw = { win: null as BrowserWindow | null, id: '' as string, busy: false };
function hallView() {
  const sid = ctx.curSaveId || '', b = sid ? bookOf(sid) : null, inv = b?.invites[fbw.id]; if (!b || !inv) return { open: false };
  const x = b.extra[inv.id] ?? {};
  return { open: inv.state === 'arrived', id: inv.id, empire: inv.empireName, empireIdx: inv.empireIdx, host: x.hostName ?? '', hostTitle: x.hostTitle ?? '', ruler: rulerName(sid), hospitality: inv.hospitality ?? 'plain', busy: fbw.busy, playerCls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human', hostCls: classKey(ctx.profiles.get(inv.empireIdx)?.cls) ?? '',
    guests: (x.guests ?? []).map((g) => ({ ...g, introduced: (x.introduced ?? []).includes(g.pid), contact: !!b.contacts[g.pid] || (inv.record?.contacts ?? []).includes(g.pid) })), talk: (x.talk ?? []).slice(-40), date: ctx.gameDate || '' };
}
const pushHall = () => safeSend(fbw.win, 'fbHall', hallView());
async function enter(sid: string, id: string): Promise<void> {
  const b = bookOf(sid), inv = b.invites[id]; if (!inv || inv.state !== 'arrived') throw new Error(L('아직 만찬 날이 아닙니다.', 'It is not the dinner day yet.'));
  if (inv.recipient !== rulerPid(sid)) throw new Error(L('이 초대는 전임 통치자가 받은 것입니다.', 'This invitation was accepted by the former ruler.'));
  const x = (b.extra[inv.id] ??= {});
  if (!inv.hospitality) { // 접대는 처음 들어갈 때 한 번 정한다(43: 대사로 다시 뽑지 않음)
    let now = x.scoreAtInvite ?? 0; try { const rows = ctx.gameRunning ? await readRoster() : []; const r = rows.find((y) => y.idx === inv.empireIdx); if (r) now = r.score; } catch { /* 지난 값 */ }
    inv.hospitality = hospitality(now, x.scoreAtInvite ?? now, false, Math.random);
  }
  if (!x.guests) x.guests = await readGuests(inv.empireIdx);
  fbw.id = inv.id; save(sid);
  if (fbw.win && !fbw.win.isDestroyed()) { fbw.win.show(); fbw.win.focus(); pushHall(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.88)) };
  const ow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.isVisible() && /office\.html$/i.test(w.webContents.getURL())), ob = ow ? ow.getBounds() : null;
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#10191e', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  fbw.win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'banquet.html'), { query: { mode: 'foreign' } }); // 기존 「지도자 만찬」 화면을 그대로 쓴다(2026-10-23 사용자 결정, ui/banquet-foreign.js)
  w.once('ready-to-show', () => { w.show(); pushHall(); });
  w.on('closed', () => { if (fbw.win === w) fbw.win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
}
const HOSP_EN: Record<string, string> = { grand: 'You prepared a grand welcome: honour guard, the finest table, warm words.', plain: 'You offer ordinary, correct hospitality.', humiliating: 'Relations have soured since you sent the invitation; you deliberately keep the guest waiting and treat them coldly (stay civil in words but let the slight show).' };
/** 만찬장 대사(영어 지시, 응답 언어는 aiclient). 주최자 또는 소개받은 참석자 한 사람. 약속은 조약이 아니다. */
export function fbMessages(a: { hostEmpire: string; guestEmpire: string; guestRuler: string; date: string; hospitality: string }, sp: { name: string; role: string; personality?: string; ethics?: string }, talk: Line[], said: string, intro: boolean): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    `You are ${sp.name}, ${sp.role} of the Stellaris empire "${a.hostEmpire}". Tonight your ruler hosts a private dinner for ${a.guestRuler || 'the ruler'} of "${a.guestEmpire || 'their empire'}". Date: ${a.date || 'unknown'}.`,
    sp.role.includes('ruler') ? `Hospitality you chose: ${HOSP_EN[a.hospitality] ?? HOSP_EN.plain}` : 'Your ruler has just introduced you to the guest.',
    sp.ethics ? `Your empire's ethics: ${sp.ethics}.` : '', sp.personality ? `Your empire's diplomatic personality: ${sp.personality}.` : '',
    talk.length ? `[Conversation so far]\n${talk.slice(-10).map((t) => `${t.name}: ${t.text.slice(0, 240)}`).join('\n')}` : '',
    intro ? 'Greet the guest briefly in character (1-2 sentences).' : 'Reply in character, 1-4 sentences. Talk about your empire\'s interests, the relationship between the two realms, or personal matters — your own opinion, not an official treaty position.',
    'Never claim a treaty, resource transfer or game action was made; spoken promises are only promises. Do not reveal state secrets. Do not invent game facts or numbers. Never write the guest\'s lines.',
  ].filter(Boolean).join('\n') }, { role: 'user', content: String(said ?? '').slice(0, 600) || '(The guest is listening.)' }];
}
async function say(sid: string, text: string, to: string): Promise<Line> {
  const b = bookOf(sid), inv = b.invites[fbw.id]; if (!inv || inv.state !== 'arrived') throw new Error(L('만찬장이 열려 있지 않습니다.', 'The banquet is not open.'));
  if (fbw.busy) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for a reply.'));
  const x = (b.extra[inv.id] ??= {}), guest = to ? (x.guests ?? []).find((g) => g.pid === to) : null;
  if (to && (!guest || !(x.introduced ?? []).includes(guest.pid))) throw new Error(L('먼저 소개를 받아야 합니다.', 'You need an introduction first.'));
  const intro = !text && !!guest, p = ctx.profileWithEthics(ctx.profiles.get(inv.empireIdx), inv.empireIdx) as unknown as Record<string, unknown> | undefined, str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : undefined);
  const me = rulerName(sid); x.talk ??= [];
  if (text) x.talk.push({ who: 'ruler', name: me, text, ...(guest ? { to: guest.name } : {}) });
  fbw.busy = true; pushHall();
  try {
    const sp = guest ? { name: guest.name, role: `${guest.council ? 'a councilor' : 'a leader'} (${guest.cls})` } : { name: x.hostName || 'the host', role: `${x.hostTitle || 'ruler'} (the host ruler)` };
    const raw = String(await ctx.ai.chat(fbMessages({ hostEmpire: inv.empireName, guestEmpire: ctx.playerName, guestRuler: me, date: ctx.gameDate || '', hospitality: inv.hospitality ?? 'plain' }, { ...sp, personality: str(p?.personality), ethics: str(p?.ethicsText) }, x.talk.slice(0, text ? -1 : undefined), text, intro), { maxTokens: 600, purpose: 'foreign-banquet' }) ?? '').trim();
    if (!raw) throw new Error(L('대답이 오지 않았습니다.', 'No reply came.'));
    const line: Line = { who: guest ? 'guest' : 'host', name: sp.name, text: raw.slice(0, 1400) }; x.talk.push(line); x.talk = x.talk.slice(-60); return line;
  } catch (e) { if (text && x.talk[x.talk.length - 1]?.text === text) x.talk.pop(); throw e; }
  finally { fbw.busy = false; save(sid); pushHall(); }
}

export function registerFbanquet(router: LogRouter): void {
  registerFbLog(router);
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId || snap.gestalt) return; void onMonth(snap.sid, snap.date).catch((e) => logDiagnostic('warn', 'fbanquet.month_failed', { error: (e as Error).message })); }, 'invite');
  const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: invitesView() });
  const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return sid; };
  ipcMain.handle('fbInvites', () => invitesView());
  ipcMain.handle('fbReply', (_e, id: unknown, yes: unknown) => {
    try {
      const sid = need(), b = bookOf(sid), inv = b.invites[String(id)]; if (!inv) throw new Error(L('그 초대장을 찾을 수 없습니다.', 'That invitation was not found.'));
      const today = ctx.gameDate || '', ok = yes ? acceptInvite(b, inv, today) : declineInvite(b, inv, today);
      if (!ok) throw new Error(L('이미 답한 초대이거나 기한이 지났습니다.', 'Already answered, or the deadline has passed.'));
      chronNoteWorld(yes ? L(`${today} ${inv.empireName}의 만찬 초대 수락 — ${inv.visitOn} 방문`, `${today} Accepted the dinner invitation from ${inv.empireName} — visit on ${inv.visitOn}`) : L(`${today} ${inv.empireName}의 만찬 초대를 정중히 사양`, `${today} Politely declined the dinner invitation from ${inv.empireName}`), false);
      save(sid); pushList(); return { ok: true, state: invitesView() };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('fbEnter', async (_e, id: unknown) => { try { await enter(need(), String(id)); return { ok: true, state: invitesView() }; } catch (e) { return err(e); } });
  ipcMain.handle('fbHall', () => hallView());
  ipcMain.handle('fbSay', async (_e, text: unknown, to: unknown) => { try { const line = await say(need(), String(text ?? '').trim().slice(0, 600), String(to ?? '')); return { ok: true, line, state: hallView() }; } catch (e) { return { ok: false, error: (e as Error).message, state: hallView() }; } });
  ipcMain.handle('fbIntroduce', async (_e, pid: unknown) => {
    try {
      const sid = need(), b = bookOf(sid), inv = b.invites[fbw.id], x = inv ? (b.extra[inv.id] ??= {}) : null; if (!inv || !x) throw new Error(L('만찬장이 열려 있지 않습니다.', 'The banquet is not open.'));
      const g = (x.guests ?? []).find((y) => y.pid === String(pid)); if (!g) throw new Error(L('그런 참석자는 없습니다.', 'No such guest.'));
      x.introduced ??= []; if (!x.introduced.includes(g.pid)) { x.introduced.push(g.pid); inv.record ??= { met: [], contacts: [], gifts: [], promises: [] }; if (!inv.record.met.includes(g.pid)) inv.record.met.push(g.pid); x.talk ??= []; x.talk.push({ who: 'host', name: x.hostName ?? '', text: L(`이쪽은 우리 제국의 ${g.council ? '평의원' : '지도자'} ${g.name}입니다.`, `May I introduce ${g.name}, one of our ${g.council ? 'councilors' : 'leaders'}.`) }); }
      save(sid); const line = await say(sid, '', g.pid); return { ok: true, line, state: hallView() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: hallView() }; }
  });
  ipcMain.handle('fbExchange', (_e, pid: unknown) => {
    const sid = ctx.curSaveId, b = sid ? bookOf(sid) : null, inv = b?.invites[fbw.id], x = inv ? b!.extra[inv.id] : null, g = x?.guests?.find((y) => y.pid === String(pid));
    if (!sid || !b || !inv || !g || !(x?.introduced ?? []).includes(g.pid)) return { ok: false, error: L('소개받은 사람과만 연락처를 바꿀 수 있습니다.', 'You can only exchange contacts with someone you were introduced to.'), state: hallView() };
    if (exchangeContact(inv, g.pid) && !b.contacts[g.pid]) b.contacts[g.pid] = { pid: g.pid, name: g.name, empireIdx: inv.empireIdx, empireName: inv.empireName, cls: g.cls, metOn: ctx.gameDate || '', via: inv.id, ...(g.fg ? { fg: g.fg, status: 'alive' as const, checkedOn: ctx.gameDate || '' } : {}) }; // 지인부터(44): 친분·연애·기밀 접근은 주지 않는다
    save(sid); pushHall(); return { ok: true, state: hallView() };
  });
  ipcMain.handle('fbFinish', () => {
    const sid = ctx.curSaveId, b = sid ? bookOf(sid) : null, inv = b?.invites[fbw.id]; if (!sid || !b || !inv) return { ok: false };
    const ok = finishBanquet(b, inv, ctx.gameDate || '', inv.record ?? { met: [], contacts: [], gifts: [], promises: [] });
    if (ok) chronNoteWorld(L(`${ctx.gameDate} ${inv.empireName}의 만찬에 다녀왔습니다${inv.hospitality === 'grand' ? ' — 성대한 환영' : inv.hospitality === 'humiliating' ? ' — 냉대' : ''}`, `${ctx.gameDate} Attended a dinner hosted by ${inv.empireName}${inv.hospitality === 'grand' ? ' — a grand welcome' : inv.hospitality === 'humiliating' ? ' — a cold reception' : ''}`), true);
    save(sid); pushList(); fbw.id = ''; if (fbw.win && !fbw.win.isDestroyed()) fbw.win.close(); return { ok, state: invitesView() };
  });
  ipcMain.handle('fbClose', () => { if (fbw.win && !fbw.win.isDestroyed()) fbw.win.close(); return true; });
}
