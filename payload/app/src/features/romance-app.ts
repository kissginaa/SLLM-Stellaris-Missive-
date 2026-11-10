// 통치자 본인의 연애·청혼·결혼식(23~28, 2026-10-23 집 PC 초안). 규칙: src/romance.ts(데이트·고백·청혼)·src/wedding.ts(예식·비용·환불).
// 관계 단계와 호감(0~100, 비서와 같은 척도)은 인물 관계 장부(relations-app) 한 곳에 둔다. 데이트·예식 기록은 userData/romance/<세이브>.json.
// 화면: 집무실 인물 카드 「인간관계」 칸의 버튼(ui/office-relations.js) → 데이트 지도(ui/date-park.html).
// AI 는 데이트 장소에서 상대의 대사와 「결과 후보」만 쓴다. 결과 확정·호감 반영·고백/청혼 수락·예식 비용은 앱이 한다.
// 이번 초안 범위: 우리 제국 지도자. 비서와의 연애는 비서 기능의 기존 호감 체계를 따로 쓰고 있어 다음 단계에서 잇는다. 타국 지도자 연애는 보류(23).
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { emitRulerRomanceEvent } from '../secretary-jealousy'; // 비서가 알 수 있는 공개 사건만(22)
import { peopleOf } from './people-app';
import { classKey } from '../speciesClass';
import { relBookOf, saveRelations, onRelationDeath } from './relations-app';
import { getPair, type Pid, type PairRelation } from '../relations';
import { type DateEvent, type SpotId, ROMANCE, DATE_SPOTS, spotOf, dateMessages, parseDateReply, finishDate, outcomeLabel, canConfess, confess, canProposeNow, propose } from '../romance';
import { type Wedding, type WeddingScale, WEDDING_COST, newWedding, confirmPreparation, weddingDue, completeWedding, cancelWedding, weddingPayCommand, weddingRefundCommand, endRelationship } from '../wedding';

interface RomBook { sid: string; dates: DateEvent[]; weddings: (Wedding & { dueNotified?: boolean })[] }
const dir = () => path.join(app.getPath('userData'), 'romance');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, RomBook>();
export function sanitizeRomBook(x: unknown, sid: string): RomBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<RomBook>;
  const dates = (Array.isArray(o.dates) ? o.dates : []).filter((d): d is DateEvent => !!d && typeof d === 'object' && typeof d.id === 'string' && Array.isArray(d.spots)).slice(-60)
    .map((d) => (d.state === 'open' ? { ...d, state: 'cancelled' as const } : d)); // 앱을 다시 켜면 열린 데이트는 반영 없이 끝난 것으로(결과를 지어내지 않는다)
  const weddings = (Array.isArray(o.weddings) ? o.weddings : []).filter((w): w is Wedding => !!w && typeof w === 'object' && typeof w.id === 'string' && typeof w.partner === 'string').slice(-20);
  return { sid, dates, weddings };
}
function bookOf(sid: string): RomBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeRomBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'romance', error: e }); b = sanitizeRomBook(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ ...b, dates: b.dates.slice(-60), weddings: b.weddings.slice(-20) }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'romance', error: e }); }
}

/** 인물 말투·기억(persona-app). main.ts 가 꽂는다. */
export interface RomancePersona { mem(sid: string, key: string): { persona?: string; mems?: { text: string }[] } | null; note(sid: string, key: string, text: string, delta?: number): void }
let persona: RomancePersona | null = null;
export function setRomancePersona(p: RomancePersona): void { persona = p; }
/** 비서와의 데이트(2026-10-23, GPT 그림 작업과 이음): 상대 키 'sec'. 비서의 호감·기억은 비서 기능(secretary-app)이 갖고 있어 이 다리로만 읽고 쓴다(모듈끼리 서로 가져오지 않게). */
export const SEC_KEY = 'sec';
export interface SecretaryDateBridge {
  /** 지금 통치자와 비서의 데이트 정보. ok=false 면 why 에 이유. */
  profile(sid: string): { ok: boolean; why: string; locked: boolean; name: string; stage: string; affection: number; persona: string; memories: string[] } | null;
  /** 데이트 결과를 비서 호감·기억에 한 번 반영. */
  apply(sid: string, r: { result: string; label: string; delta: number; affection: number; spots: string }): void;
  /** 비서가 지금 통치자의 연인·배우자인가(일부다처 2026-10-24: 막지 않고, 데이트 상대에게 「다른 연인」으로 알려 줄 때만 쓴다). */
  isPartner(sid: string): boolean;
  /** 비서 예식(2026-10-24 사용자 확정): 예식을 올리면 배우자로, 약혼·준비를 접으면 약혼 해제. */
  marry(sid: string, today: string): void;
  disengage(sid: string, today: string): void;
}
/** 비서 청혼 수락 → 약혼 레코드(secretary-app 가 부른다). 통치자 개인 ID 기준. */
export function secretaryEngaged(sid: string): boolean {
  const r = rulerOf(sid); if (!r) return false; const rp = `p:${r.lid}`; if (activeWedding(sid, rp, SEC_KEY)) return true;
  bookOf(sid).weddings.push(newWedding(sid, rp, SEC_KEY, ctx.gameDate || '')); save(sid);
  noteRivals(sid, rp, SEC_KEY, secBridge?.profile(sid)?.name ?? L('비서', 'the secretary'), 'engaged'); return true;
}
/** 비서 화면용 예식 상태. */
export function secretaryWeddingInfo(sid: string) {
  const r = rulerOf(sid); if (!r) return null; const w = activeWedding(sid, `p:${r.lid}`, SEC_KEY); if (!w) return null;
  return { state: w.state, scale: w.scale ?? '', scheduledOn: w.scheduledOn ?? '', due: weddingDue(w, ctx.gameDate || ''), cost: WEDDING_COST };
}
let secBridge: SecretaryDateBridge | null = null;
export function setSecretaryDateBridge(b: SecretaryDateBridge): void { secBridge = b; }
/** 비서 데이트 가능 여부(비서 화면 단추용). 일부다처(2026-10-24): 통치자에게 지도자 연인·배우자가 있어도 막지 않는다. */
export function secretaryDateCheck(sid: string): { ok: boolean; why: string; locked: boolean } {
  const pr = secBridge?.profile(sid); if (!pr) return { ok: false, why: '', locked: true };
  if (!pr.ok) return { ok: false, why: pr.why, locked: pr.locked };
  const r = rulerOf(sid); if (!r) return { ok: false, why: L('우리 통치자를 아직 확인하지 못했습니다.', 'Our ruler is not confirmed yet.'), locked: false };
  return { ok: true, why: '', locked: false };
}

const live = (sid: string) => peopleOf(sid).filter((p) => !p.gone);
const rulerOf = (sid: string) => live(sid).find((p) => p.ruler);
const personOf = (sid: string, key: Pid) => live(sid).find((p) => `p:${p.lid}` === key);
/** 이 통치자의 현재 연인·배우자 전부(통치자 개인 ID 기준 — 후임이 물려받지 않는다). 일부다처(2026-10-24 사용자 확정): 인원 제한 없음. */
function rulerPartners(sid: string, ruler: Pid): PairRelation[] {
  return Object.values(relBookOf(sid).ledger.pairs).filter((r) => (r.a === ruler || r.b === ruler) && ['dating', 'engaged', 'married'].includes(r.romance));
}
const otherOf = (r: PairRelation, ruler: Pid): Pid => (r.a === ruler ? r.b : r.a);
/** 외출 동행 후보(2026-10-30 외출): 지금 통치자의 연인·배우자(+ 연인인 비서). */
export function outingPartners(sid: string): Array<{ kind: 'partner'; key: string; name: string; stage: string }> {
  const r = rulerOf(sid); if (!r) return [];
  const rp = `p:${r.lid}` as Pid, out = rulerPartners(sid, rp).map((x) => ({ kind: 'partner' as const, key: otherOf(x, rp) as string, name: personOf(sid, otherOf(x, rp))?.name ?? '', stage: x.romance })).filter((x) => x.name);
  try { if (secBridge?.isPartner(sid)) { const n = secBridge.profile(sid)?.name; if (n) out.push({ kind: 'partner', key: SEC_KEY, name: n, stage: 'dating' }); } } catch { /* 비서 없음 */ }
  return out;
}
/** 백화점 선물(2026-10-30): 지금 연인·배우자에게 호감 +delta(0~100). 비서는 비서 쪽 저장소라 여기서는 안 함. */
export function giftToPartner(sid: string, key: string, delta: number): { ok: boolean; affection?: number; error?: string } {
  const r = rulerOf(sid); if (!r) return { ok: false, error: L('우리 통치자를 아직 확인하지 못했습니다.', 'Our ruler is not confirmed yet.') };
  if (key === SEC_KEY) return { ok: false, error: L('비서에게는 집무실에서 선물하세요.', 'Give gifts to the secretary in the office.') };
  const rp = `p:${r.lid}` as Pid, pr = rulerPartners(sid, rp).find((x) => otherOf(x, rp) === key); if (!pr) return { ok: false, error: L('지금 연인·배우자가 아닙니다.', 'Not your partner or spouse now.') };
  pr.affection = Math.max(0, Math.min(100, (pr.affection ?? 0) + Math.round(delta))); pr.revision++; saveRelations(sid); return { ok: true, affection: pr.affection };
}
/** 외출 → 공원: 그 동행과 데이트 지도 열기(인물 카드의 「데이트」와 같은 길). */
export function openDateFromOuting(sid: string, key: string): void { startDate(sid, key === SEC_KEY ? SEC_KEY : (key as Pid)); openDateWindow(); }
/** 데이트 상대에게 알려 줄 통치자의 다른 연인·배우자(공개된 약혼·혼인만 — 교제는 비공개라 모른다). 비서가 연인·배우자면 함께 넣는다. 질투는 사소하게만(관계·호감 변화 없음). */
function knownRivals(sid: string, ruler: Pid, except: Pid): string[] {
  const out = rulerPartners(sid, ruler).filter((r) => r.romance !== 'dating' && otherOf(r, ruler) !== except)
    .map((r) => { const n = personOf(sid, otherOf(r, ruler))?.name; return n ? `${n} (${r.romance === 'married' ? 'spouse' : 'betrothed'})` : ''; }).filter(Boolean);
  if (except !== SEC_KEY && secBridge?.isPartner(sid)) { const n = secBridge.profile(sid)?.name; if (n) out.push(`${n} (the office secretary)`); }
  return out;
}
/** 통치자의 공개 연애 소식(약혼·결혼)을 다른 연인·배우자 지도자의 기억에 한 줄 — 사소한 질투만, 호감·관계 변화 없음(2026-10-24). */
function noteRivals(sid: string, ruler: Pid, partner: Pid, name: string, kind: 'engaged' | 'wedding'): void {
  for (const r of rulerPartners(sid, ruler)) { const o = otherOf(r, ruler); if (o === partner || o === SEC_KEY) continue;
    if (kind === 'engaged') note(sid, o, `통치자가 ${name}와(과) 약혼했다는 소식에 살짝 질투가 났다`, `Felt a small pang of jealousy hearing the ruler got engaged to ${name}`);
    else note(sid, o, `통치자와 ${name}의 결혼식 소식에 조금 샘이 났지만 마음은 그대로다`, `Felt a little jealous of the ruler's wedding to ${name}, but nothing has changed between them`); }
}
function otherPartner(sid: string, key: Pid, ruler: Pid): boolean {
  for (const r of Object.values(relBookOf(sid).ledger.pairs)) if ((r.a === key || r.b === key) && r.a !== ruler && r.b !== ruler && ['dating', 'engaged', 'married'].includes(r.romance)) return true;
  return false;
}
const activeWedding = (sid: string, ruler: Pid, partner: Pid) => bookOf(sid).weddings.find((w) => w.ruler === ruler && w.partner === partner && (w.state === 'engaged' || w.state === 'preparing')) ?? null;
const STAGE_EN: Record<string, string> = { none: 'acquaintances', interest: 'mutual interest', dating: 'dating', engaged: 'engaged', married: 'married', ended: 'former partners' };

/** 인물 카드용: 이 사람과 통치자의 연애 상태와 지금 할 수 있는 일(이유와 함께). */
export function romanceInfo(sid: string, key: Pid) {
  const ruler = rulerOf(sid), p = personOf(sid, key);
  if (!ruler || !p || p.ruler) return null;
  const rp = `p:${ruler.lid}`, led = relBookOf(sid).ledger, r = led.pairs[[rp, key].sort().join('|')] ?? null;
  const today = ctx.gameDate || '', dates = bookOf(sid).dates.filter((d) => d.ruler === rp && d.partner === key && d.state === 'done');
  const other = otherPartner(sid, key, rp), stage = r?.romance ?? 'none', w = activeWedding(sid, rp, key);
  if (gameState.last?.gestalt) return null; // 군체·기계 제국: 연애 자격 확정 불가(23) — 카드에 연애 칸을 두지 않는다
  // 일부다처(2026-10-24 사용자 확정): 비서가 연인·배우자여도(호감과 무관) 지도자 데이트를 막지 않는다 — 질투는 사소하게만.
  const dateBlock = other ? L('상대에게 이미 만나는 사람이 있습니다.', 'They are already seeing someone.') : '';
  const cf = r ? canConfess(r, today, other) : { ok: false, reason: L('아직 마음이 충분히 가까워지지 않은 것 같습니다.', 'Their feelings do not seem close enough yet.') };
  const pr = r ? canProposeNow(r, today) : { ok: false, reason: '' };
  return {
    stage, affection: r?.affection ?? null, dates: dates.length, last: dates.length ? { on: dates[dates.length - 1].on, result: outcomeLabel(dates[dates.length - 1].result!) } : null,
    canDate: !dateBlock, dateWhy: dateBlock,
    canConfess: stage !== 'dating' && stage !== 'engaged' && stage !== 'married' ? cf : null,
    canPropose: stage === 'dating' ? pr : null,
    wedding: w ? { state: w.state, scale: w.scale ?? '', scheduledOn: w.scheduledOn ?? '', due: weddingDue(w, today), cost: WEDDING_COST } : null,
    canBreakup: ['dating', 'engaged', 'married'].includes(stage),
  };
}

// ---- 데이트
export const dt = { win: null as BrowserWindow | null, id: '' as string, busy: false };
const openDate = (sid: string) => bookOf(sid).dates.find((d) => d.id === dt.id && d.state === 'open') ?? null;
function dateView() {
  const sid = ctx.curSaveId || '', d = sid ? openDate(sid) : null; if (!d) return { open: false };
  const isSec = d.partner === SEC_KEY, sp = isSec ? secBridge?.profile(sid) : null;
  const p = isSec ? (sp ? { name: sp.name, cls: '' } : { name: '', cls: '' }) : peopleOf(sid).find((x) => `p:${x.lid}` === d.partner), r = isSec ? null : relBookOf(sid).ledger.pairs[[d.ruler, d.partner].sort().join('|')];
  const cur = d.spots[d.spots.length - 1];
  return {
    open: true, id: d.id, date: ctx.gameDate || d.on, busy: dt.busy, playerCls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human',
    partner: { key: d.partner, name: p?.name ?? '', cls: p?.cls ?? '' }, ruler: rulerOf(sid)?.name ?? '', stage: isSec ? (sp?.stage ?? '') : r?.romance ?? 'none', affection: isSec ? (sp?.affection ?? null) : r?.affection ?? null,
    spots: DATE_SPOTS.filter((s) => !s.retired).map((s) => ({ id: s.id, name: L(s.ko, s.en), locked: !!s.locked, visited: d.spots.some((x) => x.id === s.id) })),
    left: ROMANCE.spotsPerDate - d.spots.length, turnsLeft: cur ? ROMANCE.turnsPerSpot - cur.talk.filter((t) => t.who === 'ruler').length : 0,
    spot: cur ? { id: cur.id, name: L(spotOf(cur.id)!.ko, spotOf(cur.id)!.en), talk: cur.talk } : null,
  };
}
const push = () => safeSend(dt.win, 'dateState', dateView());
function openDateWindow(): void {
  if (dt.win && !dt.win.isDestroyed()) { dt.win.show(); dt.win.focus(); push(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.88)) };
  const ow = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL())), ob = ow ? ow.getBounds() : null;
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#0b1020', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  dt.win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'date-park.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (dt.win === w) dt.win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
}
function startDate(sid: string, key: Pid): DateEvent {
  if (key === SEC_KEY) { const c = secretaryDateCheck(sid); if (!c.ok) throw new Error(c.why || L('지금은 비서와 나갈 수 없습니다.', 'You cannot go out with your secretary now.')); }
  else { const info = romanceInfo(sid, key); if (!info) throw new Error(L('그 인물과는 데이트할 수 없습니다.', 'You cannot date that person.'));
  if (!info.canDate) throw new Error(info.dateWhy); }
  const rp = `p:${rulerOf(sid)!.lid}`, b = bookOf(sid);
  for (const d of b.dates) if (d.state === 'open' && d.partner !== key) d.state = 'cancelled';
  let d = b.dates.find((x) => x.state === 'open' && x.partner === key && x.ruler === rp);
  if (!d) { d = { id: `date:${randomUUID().slice(0, 12)}`, ruler: rp, partner: key, on: ctx.gameDate || '', spots: [], state: 'open' }; b.dates.push(d); }
  dt.id = d.id; save(sid); return d;
}
async function speak(sid: string, d: DateEvent, said: string): Promise<string> {
  const cur = d.spots[d.spots.length - 1]; if (!cur) throw new Error(L('먼저 장소를 고르세요.', 'Pick a place first.'));
  const isSec = d.partner === SEC_KEY, sp = isSec ? secBridge?.profile(sid) : null;
  const p = isSec ? (sp ? { name: sp.name, cls: '', traits: [] as string[] } : null) : personOf(sid, d.partner); if (!p) throw new Error(L('상대를 찾을 수 없습니다.', 'They could not be found.'));
  const r = isSec ? null : getPair(relBookOf(sid).ledger, d.ruler, d.partner), mem = isSec ? { persona: sp!.persona, mems: sp!.memories.map((text) => ({ text })) } : persona?.mem(sid, d.partner);
  dt.busy = true; push();
  try {
    if (said) cur.talk.push({ who: 'ruler', text: said });
    const raw = String(await ctx.ai.chat(dateMessages({ empire: ctx.playerName, ruler: rulerOf(sid)?.name ?? '', date: ctx.gameDate || d.on }, { name: p.name, cls: p.cls, traits: p.traits ?? [], persona: mem?.persona, stage: isSec ? sp!.stage : STAGE_EN[r!.romance] ?? r!.romance, affection: isSec ? sp!.affection : r!.affection, memories: (mem?.mems ?? []).map((m) => m.text), others: knownRivals(sid, d.ruler, d.partner), ...(isSec ? { who: `"${p.name}", the android secretary built in secret for the ruler's office (she does not age and serves successive rulers)` } : {}) }, cur.id, said ? cur.talk.slice(0, -1) : cur.talk, said), { maxTokens: 500, purpose: 'romance-date', json: true }) ?? '');
    const rep = parseDateReply(raw); if (!rep) throw new Error(L('상대의 대답을 읽지 못했습니다. 다시 말해 주세요.', 'Could not read their reply. Please try again.'));
    if (dt.id !== d.id || d.state !== 'open') throw new Error(L('데이트가 끝나 답을 버렸습니다.', 'The date ended, so the reply was discarded.'));
    cur.talk.push({ who: 'partner', text: rep.say }); cur.moods.push(rep.mood);
    return rep.say;
  } catch (e) { if (said && cur.talk[cur.talk.length - 1]?.who === 'ruler' && cur.talk[cur.talk.length - 1].text === said) cur.talk.pop(); throw e; }
  finally { dt.busy = false; save(sid); push(); }
}

// ---- 게임 명령(결혼식 비용)
async function payWedding(sid: string, w: Wedding, scale: WeddingScale): Promise<'applied' | 'short' | 'unknown'> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 준비를 확정할 수 있습니다.', 'The game must be running to confirm.'));
  const req = ++link.reqCounter;
  try { const st = (await terminalRequest(weddingPayCommand(req, sid, w.id, scale), 'WEDPAY', req)).kv.status; return st === 'applied' || st === 'duplicate' ? 'applied' : st === 'short' ? 'short' : 'unknown'; }
  catch (e) { logDiagnostic('warn', 'wedding.pay_failed', { error: (e as Error).message }); return 'unknown'; }
}
async function refundWedding(sid: string, w: Wedding): Promise<void> {
  if (!w.refunded || w.refundDone) return;
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) { logDiagnostic('warn', 'wedding.refund_deferred', { id: w.id }); return; } // 게임이 켜지면 onGameSnapshot 에서 다시(26: 환불 유실 방지, 모드 표식으로 중복 없음)
  const req = ++link.reqCounter; w.refundReq = req;
  try { const st = (await terminalRequest(weddingRefundCommand(req, sid, w.id, w.refunded), 'WEDREFUND', req)).kv.status; if (st === 'applied' || st === 'duplicate') w.refundDone = true; else logDiagnostic('warn', 'wedding.refund_status', { id: w.id, status: st }); }
  catch (e) { logDiagnostic('warn', 'wedding.refund_failed', { error: (e as Error).message }); }
}

function note(sid: string, key: Pid, ko: string, en: string, delta = 0): void { persona?.note(sid, key, L(ko, en), delta); }
function toast(title: string, body: string): void { (office as { toastGo: string }).toastGo = 'contacts'; ctx.notify({ kind: 'office', title, body, action: L('집무실', 'Office') }); }

export function registerRomance(): void {
  onGameSnapshot((snap) => {
    const sid = snap.sid; if (!sid || sid !== ctx.curSaveId) return;
    const b = bookOf(sid); let ch = false;
    for (const w of b.weddings) if (w.state === 'cancelled' && w.refunded && !w.refundDone && ctx.gameRunning) { void refundWedding(sid, w).then(() => save(sid)); } // 미뤄 둔 환불 다시
    for (const w of b.weddings) if (weddingDue(w, snap.date) && !w.dueNotified) { w.dueNotified = true; ch = true; const p = w.partner === SEC_KEY ? { name: secBridge?.profile(sid)?.name ?? L('비서', 'the secretary') } : peopleOf(sid).find((x) => `p:${x.lid}` === w.partner); toast(L('결혼식 날이 왔습니다', 'Your wedding day has come'), L(`${p?.name ?? ''}와(과)의 예식 준비가 끝났습니다. 집무실 인물 카드에서 예식을 올릴 수 있습니다.`, `Preparations for your wedding with ${p?.name ?? ''} are complete. Hold the ceremony from their card in the office.`)); }
    if (ch) save(sid);
  });
  const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e) });
  const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); const r = rulerOf(sid); if (!r) throw new Error(L('우리 통치자를 아직 확인하지 못했습니다.', 'Our ruler is not confirmed yet.')); return { sid, rp: `p:${r.lid}` }; };
  const keyOf = (k: unknown) => { const s = String(k ?? ''); if (!/^p:\d+$/.test(s)) throw new Error(L('인물을 찾을 수 없습니다.', 'Person not found.')); return s; };
  const wedKey = (k: unknown) => (k === SEC_KEY ? SEC_KEY : keyOf(k)); // 예식 IPC 는 비서('sec')도 받는다
  const infoOf = (sid: string, k: string) => (k === SEC_KEY ? { secretary: secretaryWeddingInfo(sid) } : romanceInfo(sid, k));
  const nameOfKey = (sid: string, k: string) => (k === SEC_KEY ? (secBridge?.profile(sid)?.name ?? L('비서', 'the secretary')) : (personOf(sid, k)?.name ?? ''));
  ipcMain.handle('romanceInfo', (_e, key: unknown) => { try { const sid = ctx.curSaveId; return sid ? romanceInfo(sid, keyOf(key)) : null; } catch { return null; } });
  ipcMain.handle('dateOpen', (_e, key: unknown) => { try { const { sid } = need(); startDate(sid, key === SEC_KEY ? SEC_KEY : keyOf(key)); openDateWindow(); return { ok: true }; } catch (e) { return err(e); } });
  ipcMain.handle('dateState', () => dateView());
  ipcMain.handle('dateGo', async (_e, spot: unknown) => {
    try {
      const { sid } = need(), d = openDate(sid); if (!d) throw new Error(L('열린 데이트가 없습니다.', 'No date is open.'));
      if (dt.busy) throw new Error(L('잠시만요…', 'One moment…'));
      const s = spotOf(String(spot)); if (!s || s.retired) throw new Error(L('그런 장소는 없습니다.', 'No such place.'));
      if (s.locked) throw new Error(L('유물전시관은 다음 마이너 패치 때 공개될 예정입니다.', 'The Relic Gallery will open in the next minor patch.'));
      if (d.spots.some((x) => x.id === s.id)) throw new Error(L('이번 데이트에서 이미 들른 곳입니다.', 'You already visited this place on this date.'));
      if (d.spots.length >= ROMANCE.spotsPerDate) throw new Error(L('이번 데이트에서 들를 곳을 다 들렀습니다. 데이트를 마쳐 주세요.', 'You have visited enough places for this date. Please end it.'));
      d.spots.push({ id: s.id as SpotId, moods: [], talk: [] }); save(sid);
      const say = await speak(sid, d, ''); return { ok: true, say, state: dateView() };
    } catch (e) { return { ...err(e), state: dateView() }; }
  });
  ipcMain.handle('dateSay', async (_e, text: unknown) => {
    try {
      const { sid } = need(), d = openDate(sid); if (!d) throw new Error(L('열린 데이트가 없습니다.', 'No date is open.'));
      const t = String(text ?? '').trim().slice(0, 600); if (!t) throw new Error(L('할 말을 적어 주세요.', 'Write something to say.'));
      const cur = d.spots[d.spots.length - 1]; if (!cur) throw new Error(L('먼저 장소를 고르세요.', 'Pick a place first.'));
      if (cur.talk.filter((x) => x.who === 'ruler').length >= ROMANCE.turnsPerSpot) throw new Error(L('여기서는 충분히 이야기했습니다. 다른 곳으로 가거나 데이트를 마쳐 주세요.', 'You have talked enough here. Move on or end the date.'));
      if (dt.busy) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for their reply.'));
      const say = await speak(sid, d, t); return { ok: true, say, state: dateView() };
    } catch (e) { return { ...err(e), state: dateView() }; }
  });
  ipcMain.handle('dateEnd', () => {
    try {
      const { sid } = need(), d = openDate(sid); if (!d) throw new Error(L('열린 데이트가 없습니다.', 'No date is open.'));
      if (!d.spots.length) { d.state = 'cancelled'; dt.id = ''; save(sid); push(); return { ok: true, cancelled: true }; }
      if (d.partner === SEC_KEY) { // 비서: 관계 장부가 아니라 비서 호감에 한 번 반영
        const sp = secBridge?.profile(sid); if (!sp || !secBridge) throw new Error(L('비서 정보를 읽지 못했습니다.', 'Could not read the secretary.'));
        const tmp = { affection: sp.affection, evidence: [] as string[], revision: 0 } as unknown as PairRelation;
        const res = finishDate(d, tmp, bookOf(sid).dates)!; save(sid); dt.id = '';
        const spots = d.spots.map((s) => L(spotOf(s.id)!.ko, spotOf(s.id)!.en)).join(', ');
        secBridge.apply(sid, { result: res.result, label: outcomeLabel(res.result), delta: res.delta, affection: res.affection, spots });
        logDiagnostic('info', 'romance.secretary_date', { result: res.result, delta: res.delta });
        push(); return { ok: true, result: res.result, label: outcomeLabel(res.result), delta: res.delta, affection: res.affection };
      }
      const led = relBookOf(sid).ledger, r = getPair(led, d.ruler, d.partner);
      const res = finishDate(d, r, bookOf(sid).dates)!;
      if (r.visibility === 'hidden') r.visibility = 'parties';
      saveRelations(sid); save(sid); dt.id = '';
      if (r.romance === 'married') emitRulerRomanceEvent(sid, d.ruler, { id: `out:${d.partner}:${d.on ?? ctx.gameDate ?? ''}`, kind: 'outing', partner: personOf(sid, d.partner)?.name ?? '', date: ctx.gameDate || '' }); // 결혼 전 데이트는 비공개라 비서가 모른다
      const spots = d.spots.map((s) => L(spotOf(s.id)!.ko, spotOf(s.id)!.en)).join(', ');
      note(sid, d.partner, `통치자와 데이트(${spots}) — ${outcomeLabel(res.result)}`, `A date with the ruler (${spots}) — ${outcomeLabel(res.result)}`);
      logDiagnostic('info', 'romance.date', { result: res.result, delta: res.delta });
      push(); return { ok: true, result: res.result, label: outcomeLabel(res.result), delta: res.delta, affection: res.affection };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('dateClose', () => { if (dt.win && !dt.win.isDestroyed()) dt.win.close(); dt.win = null; return true; });
  ipcMain.handle('romanceConfess', (_e, key: unknown) => {
    try {
      const { sid, rp } = need(), k = keyOf(key), info = romanceInfo(sid, k); if (!info?.canConfess?.ok) throw new Error(info?.canConfess?.reason || L('지금은 고백할 수 없습니다.', 'You cannot confess now.'));
      const r = getPair(relBookOf(sid).ledger, rp, k), yes = confess(r, ctx.gameDate || '', Math.random); saveRelations(sid);
      const p = personOf(sid, k)!;
      note(sid, k, yes ? '통치자의 고백을 받아들였다' : '통치자의 고백을 정중히 거절했다', yes ? 'Accepted the ruler\'s confession' : 'Politely turned down the ruler\'s confession');
      if (yes) chronNoteWorld(L(`${ctx.gameDate} 통치자와 ${p.name}의 교제가 시작되었다`, `${ctx.gameDate} The ruler and ${p.name} began seeing each other`), false);
      return { ok: true, accepted: yes, text: yes ? L(`${p.name}이(가) 수줍게 고개를 끄덕였습니다. 두 사람은 이제 교제 중입니다.`, `${p.name} nodded shyly. The two of you are now together.`) : L(`${p.name}은(는) 미안한 얼굴로 아직은 마음이 준비되지 않았다고 했습니다. 호감은 그대로입니다.`, `${p.name} looked apologetic and said they are not ready yet. Their affection is unchanged.`), info: romanceInfo(sid, k) };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('romancePropose', (_e, key: unknown) => {
    try {
      const { sid, rp } = need(), k = keyOf(key), r = getPair(relBookOf(sid).ledger, rp, k), c = canProposeNow(r, ctx.gameDate || ''); if (!c.ok) throw new Error(c.reason);
      const yes = propose(r, ctx.gameDate || '', Math.random); saveRelations(sid); const p = personOf(sid, k)!;
      if (yes) { r.evidence.push('ruler_engaged'); bookOf(sid).weddings.push(newWedding(sid, rp, k, ctx.gameDate || '')); save(sid); emitRulerRomanceEvent(sid, rp, { id: `eng:${k}:${ctx.gameDate || ''}`, kind: 'engaged', partner: p.name, date: ctx.gameDate || '' }); noteRivals(sid, rp, k, p.name, 'engaged'); chronNoteWorld(L(`${ctx.gameDate} 통치자와 ${p.name}이(가) 약혼했다`, `${ctx.gameDate} The ruler and ${p.name} became engaged`), true); }
      note(sid, k, yes ? '통치자의 청혼을 받아들였다' : '통치자의 청혼에 아직은 답하지 못했다', yes ? 'Accepted the ruler\'s proposal' : 'Could not yet say yes to the ruler\'s proposal');
      return { ok: true, accepted: yes, text: yes ? L(`${p.name}이(가) 청혼을 받아들였습니다. 이제 결혼식 규모를 정할 수 있습니다.`, `${p.name} accepted. You can now choose the scale of the wedding.`) : L(`${p.name}은(는) 조금 더 시간이 필요하다고 했습니다. 교제는 그대로입니다.`, `${p.name} said they need a little more time. You are still together.`), info: romanceInfo(sid, k) };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('weddingPrepare', async (_e, key: unknown, scale: unknown) => {
    try {
      const { sid, rp } = need(), k = wedKey(key), w = activeWedding(sid, rp, k); if (!w || w.state !== 'engaged') throw new Error(L('약혼 상태가 아닙니다.', 'Not engaged.'));
      const sc: WeddingScale = scale === 'state' ? 'state' : 'informal', pay = await payWedding(sid, w, sc);
      const r = confirmPreparation(w, sc, ctx.gameDate || '', pay, link.reqCounter); save(sid);
      if (!r.ok) throw new Error(r.reason);
      chronNoteWorld(L(`${ctx.gameDate} ${sc === 'state' ? '국가공인' : '비공식'} 결혼식 준비 시작 — ${w.scheduledOn} 예정`, `${ctx.gameDate} ${sc === 'state' ? 'State' : 'Informal'} wedding preparations began — set for ${w.scheduledOn}`), sc === 'state');
      return { ok: true, info: infoOf(sid, k) };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('weddingHold', (_e, key: unknown) => {
    try {
      const { sid, rp } = need(), k = wedKey(key), w = activeWedding(sid, rp, k), today = ctx.gameDate || ''; if (!w || !weddingDue(w, today)) throw new Error(L('아직 예식 날이 아닙니다.', 'It is not the wedding day yet.'));
      const led = relBookOf(sid).ledger, alive = new Set(live(sid).map((p) => `p:${p.lid}`));
      const guests = w.scale === 'state' ? live(sid).filter((p) => p.council && `p:${p.lid}` !== k && !p.ruler).map((p) => `p:${p.lid}`) // 국가공인: 평의회 의무 참석(26)
        : Object.values(led.pairs).filter((r) => (r.a === rp || r.b === rp) && (r.friend === 'friendly' || r.friend === 'close')).map((r) => (r.a === rp ? r.b : r.a)).filter((x) => x !== k && alive.has(x)); // 비공식: 통치자의 친구(초대장 절차는 다음 단계)
      if (!completeWedding(w, today, guests, !!gameState.last?.wars?.length)) throw new Error(L('예식을 올리지 못했습니다.', 'The ceremony could not be held.'));
      const pname = nameOfKey(sid, k), names = peopleOf(sid);
      if (k === SEC_KEY) { secBridge?.marry(sid, today); noteRivals(sid, rp, SEC_KEY, pname, 'wedding'); } // 비서: 비서 저장소에 배우자로(비서 자신에게는 질투 알림 없음, 다른 연인·배우자 지도자에게만 사소한 질투 한 줄)
      else { const r = getPair(led, rp, k); r.romance = 'married'; r.marriedOn = today; r.visibility = 'public'; r.revision++; saveRelations(sid); emitRulerRomanceEvent(sid, rp, { id: `wed:${k}:${today}`, kind: 'wedding', partner: pname, date: today }); note(sid, k, '통치자와 결혼했다', 'Married the ruler'); noteRivals(sid, rp, k, pname, 'wedding'); }
      save(sid);
      chronNoteWorld(L(`${today} 통치자와 ${pname}의 ${w.scale === 'state' ? '국가공인' : '비공식'} 결혼식${w.wartime ? '(전시)' : ''}`, `${today} The ruler and ${pname} were married in a${w.scale === 'state' ? ' state' : 'n informal'} ceremony${w.wartime ? ' (wartime)' : ''}`), true);
      return { ok: true, guests: guests.map((g) => names.find((x) => `p:${x.lid}` === g)?.name ?? '').filter(Boolean), wartime: !!w.wartime, info: infoOf(sid, k) };
    } catch (e) { return err(e); }
  });
  // 약혼·준비 취소(26): 이별이 아니라 예식만 접는다. 준비 중이면 납부 자원의 50% 환불. 교제는 그대로.
  ipcMain.handle('weddingCancel', async (_e, key: unknown) => {
    try {
      const { sid, rp } = need(), k = wedKey(key), w = activeWedding(sid, rp, k), today = ctx.gameDate || ''; if (!w) throw new Error(L('취소할 예식이 없습니다.', 'There is no wedding to cancel.'));
      const refund = cancelWedding(w, today, 'cancel').refund; save(sid); await refundWedding(sid, w); save(sid);
      if (k === SEC_KEY) secBridge?.disengage(sid, today);
      else { const r = getPair(relBookOf(sid).ledger, rp, k); if (r.romance === 'engaged') { r.romance = 'dating'; r.evidence = r.evidence.filter((x) => x !== 'ruler_engaged'); r.evidence.push(`wedding_cancelled:${today}`); r.revision++; saveRelations(sid); } note(sid, k, '결혼식을 미루기로 했다', 'Decided to put the wedding off'); }
      chronNoteWorld(L(`${today} 통치자와 ${nameOfKey(sid, k)}의 결혼식 준비를 접음`, `${today} The ruler and ${nameOfKey(sid, k)} called off the wedding preparations`), false);
      return { ok: true, refund, info: infoOf(sid, k) };
    } catch (e) { return err(e); }
  });
  // 사별(28·26): 연인·약혼자·배우자가 죽으면 관계는 relations-app 가 끝내고, 여기서는 준비 중인 예식을 접고 환불한다. 통치자 본인이 죽은 경우도 같다.
  onRelationDeath((sid, dead, date) => {
    const b = bookOf(sid); let ch = false;
    for (const w of b.weddings) if ((w.ruler === dead || w.partner === dead) && (w.state === 'engaged' || w.state === 'preparing')) { cancelWedding(w, date, 'death'); ch = true; void refundWedding(sid, w).then(() => save(sid)); if (w.partner === SEC_KEY) secBridge?.disengage(sid, date); }
    if (ch) save(sid);
  });
  ipcMain.handle('romanceBreakup', async (_e, key: unknown) => {
    try {
      const { sid, rp } = need(), k = keyOf(key), r = getPair(relBookOf(sid).ledger, rp, k), today = ctx.gameDate || '';
      const wasMarried = r.romance === 'married';
      if (!endRelationship(r, today, wasMarried ? 'divorce' : 'breakup')) throw new Error(L('정리할 관계가 없습니다.', 'There is no relationship to end.'));
      r.revision++; saveRelations(sid);
      const w = activeWedding(sid, rp, k); let refund = null;
      if (w) { refund = cancelWedding(w, today, 'breakup').refund; save(sid); await refundWedding(sid, w); save(sid); }
      note(sid, k, wasMarried ? '통치자와 이혼했다' : '통치자와 헤어졌다', wasMarried ? 'Divorced the ruler' : 'Broke up with the ruler');
      chronNoteWorld(L(`${today} 통치자와 ${personOf(sid, k)?.name ?? ''}의 관계가 끝났다`, `${today} The ruler and ${personOf(sid, k)?.name ?? ''} parted ways`), false);
      return { ok: true, refund, info: romanceInfo(sid, k) };
    } catch (e) { return err(e); }
  });
}
