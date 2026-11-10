// 상인 수집품 구매 · 골동품 진열장 · 국가 문서함 연결(알파 11, 2026-10-25).
// 규칙: src/collectibles-shop.ts(구매·진열), src/state-docs.ts(문서·글). 화면: ui/terminal-ui.js(상점), ui/private-rooms.js(진열장), ui/office-docs.js(문서함), ui/state-docs.js(문서 서식).
// AI 호출 없음. 게임 효과는 결제(에너지 차감) 하나뿐 — 같은 물건은 게임 표시 변수로 두 번 차감되지 않는다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { pick } from './settings-ui';
import { terminal, terminalRequest, terminalReplies } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import type { SllmMessage } from '../protocol';
import { COLLECTIBLES, COLLECTIBLE_CLASS, COLLECTIBLE_GRADE, collectibleImage, type CollectibleMerchant } from '../collectibles-data';
import { type ShopBook, emptyShop, sanitizeShop, forSale, soldOut, colPayCommand, recordPurchase, placeItem, isShopMerchant, SHOWCASE_SLOTS } from '../collectibles-shop';
import { type DocBook, emptyBook, sanitizeBook, addDoc, nextDocNo, renderDoc, docSummary } from '../state-docs';
import { type LoanBook, emptyLoans, sanitizeLoans, currentLoan, isOnLoan, startLoan, loanDue, finishLoan, loanBonusCommand } from '../curator-loan';
import { LOAN_BONUS, LOAN_BONUS_DAYS, specimenGrade } from '../appraisal-text';
import { SPEC_BY_KEY } from '../archive';
import { latestArchive, scanArchive } from './archive-app';
import { onGameSnapshot, gameState } from './gamestate-app';
import { type TourBook, emptyTours, sanitizeTours, tourCommand, TOUR_COST, TOUR_DAYS, TOUR_MIN_SCORE } from '../artist-tour';
import { addMonths, cmpDate } from '../gamedate';

const L = pick;
interface SaveEntry { shop: ShopBook; docs: DocBook; loans: LoanBook; tours: TourBook }
const file = () => path.join(app.getPath('userData'), 'sllm_collectibles.json');
let store: Record<string, SaveEntry> | null = null;
function all(): Record<string, SaveEntry> {
  if (store) return store;
  store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, any>)) store[k] = { shop: sanitizeShop(v?.shop), docs: sanitizeBook(v?.docs), loans: sanitizeLoans(v?.loans), tours: sanitizeTours(v?.tours) }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'collectibles', error: e }); }
  return store;
}
function save(): void {
  try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); }
  catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'collectibles', error: e }); }
}
const entry = (sid: string): SaveEntry => (all()[safeKey(sid)] ??= { shop: emptyShop(), docs: emptyBook(), loans: emptyLoans(), tours: emptyTours() });
const uiDir = () => path.join(__dirname, '..', '..', 'ui');
const imgFor = (id: string): string | null => { const p = collectibleImage(id); try { return fs.existsSync(path.join(uiDir(), p)) ? p : null; } catch { return null; } };
function push(): void { for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) { bw.webContents.send('colUpdate'); bw.webContents.send('docsUpdate'); bw.webContents.send('loanUpdate'); bw.webContents.send('tourUpdate'); } }

/** 그 상인 엔클레이브가 지금 세이브의 통신 목록에 있나(단절한 상대는 없다). */
const merchantReachable = (m: CollectibleMerchant | 'curator' | 'artist'): boolean => terminal.sid === ctx.curSaveId && terminal.items.some((c) => c.type === 'enclave' && c.sub === m);
const itemView = (id: string) => {
  const c = COLLECTIBLES.find((x) => x.id === id)!;
  return { id: c.id, m: c.m, g: c.g, grade: L(COLLECTIBLE_GRADE[c.g][0], COLLECTIBLE_GRADE[c.g][1]), price: c.price, name: L(c.n[0], c.n[1]), cls: L(COLLECTIBLE_CLASS[c.c][0], COLLECTIBLE_CLASS[c.c][1]), origin: L(c.o[0], c.o[1]), desc: L(c.d[0], c.d[1]), img: imgFor(c.id) };
};
export function shopView(m: CollectibleMerchant) {
  const sid = ctx.curSaveId; if (!sid) return { ok: false as const, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  const e = entry(sid);
  return { ok: true as const, sid, merchant: m, reachable: merchantReachable(m), pending: e.shop.pending?.id ?? null, items: forSale(e.shop, m).map((c) => itemView(c.id)), sold: soldOut(e.shop, m).map((c) => itemView(c.id)) };
}
export function showcaseView() {
  const sid = ctx.curSaveId; if (!sid) return { ok: false as const, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  const e = entry(sid);
  return { ok: true as const, sid, slots: SHOWCASE_SLOTS, items: Object.entries(e.shop.owned).map(([id, o]) => ({ ...itemView(id), date: o.date, slot: o.slot, onLoan: isOnLoan(e.loans, id) ? (currentLoan(e.loans)?.due ?? '') : null, bonus: LOAN_BONUS[COLLECTIBLES.find((c) => c.id === id)!.g], docId: o.docId ?? null, appraisalId: e.docs.docs.find((d) => d.kind === 'appraisal' && d.refKind === 'col' && d.ref === id)?.id ?? null })) };
}
export function docsView() {
  const sid = ctx.curSaveId; if (!sid) return { ok: false as const, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  return { ok: true as const, sid, docs: [...entry(sid).docs.docs].reverse().map(docSummary) };
}
export function docOpen(id: unknown) {
  const sid = ctx.curSaveId; if (!sid || typeof id !== 'string') return { ok: false as const, error: L('문서를 찾지 못했습니다.', 'Document not found.') };
  const d = entry(sid).docs.docs.find((x) => x.id === id); const v = d && renderDoc(d);
  if (!v) return { ok: false as const, error: L('문서를 찾지 못했습니다.', 'Document not found.') };
  let emblem: string | null = null; try { emblem = ctx.playerIdx >= 0 ? ctx.flagProv.emblemFor(ctx.playerIdx) : null; } catch { emblem = null; }
  const img = d.ref && (d.kind === 'warranty' || d.refKind === 'col') ? imgFor(d.ref) : null;
  return { ok: true as const, doc: { ...v, ...(img ? { img } : {}), emblem, nation: ctx.playerName || '' } };
}
/** 다른 기능(큐레이터 대여 등)이 문서를 넣는다. */
/** 문서 상태 바꾸기(총독 약속의 이행·불이행, 알파 11). 없는 문서면 false. */
export function setDocStatus(sid: string, id: string, status: 'active' | 'kept' | 'broken' | 'record', closedOn?: string): boolean {
  const d = entry(sid).docs.docs.find((x) => x.id === id); if (!d) return false;
  d.status = status; if (closedOn) d.closedOn = closedOn; save(); push(); return true;
}
export function issueDoc(sid: string, d: Omit<Parameters<typeof addDoc>[1], 'no' | 'id'> & { issuer: Parameters<typeof nextDocNo>[1] }): string {
  const e = entry(sid), { issuer, ...rest } = d; const no = nextDocNo(e.docs, issuer, rest.date);
  const doc = addDoc(e.docs, { ...rest, id: `${rest.kind}:${no}`, no }); save(); push(); return doc.id;
}

let busy = false;
export async function buyCollectible(id: unknown) {
  const sid = ctx.curSaveId, c = COLLECTIBLES.find((x) => x.id === id);
  if (!c) return { ok: false as const, error: L('없는 물건입니다.', 'No such article.') };
  if (!ctx.gameRunning || !sid) return { ok: false as const, error: L('게임이 켜져 있어야 살 수 있습니다.', 'The game must be running to buy.') };
  if (!merchantReachable(c.m)) return { ok: false as const, error: L('이 상인과 통신이 닿지 않습니다. 단말기 목록을 갱신해 주세요.', 'This merchant cannot be reached. Refresh the terminal list.') };
  if (busy || ctx.pend || ctx.pending) return { ok: false as const, error: L('진행 중인 통신과 제안을 마친 뒤 해 주세요.', 'Finish the ongoing call and proposals first.') };
  const e = entry(sid); if (e.shop.owned[c.id]) return { ok: false as const, error: L('이미 소장한 물건입니다.', 'You already own this article.') };
  busy = true; const req = ++link.reqCounter; e.shop.pending = { id: c.id, req, date: ctx.gameDate || '' }; save();
  try {
    const st = (await terminalRequest(colPayCommand(req, sid, c.id), 'COLPAY', req)).kv.status;
    if (st === 'short') { delete e.shop.pending; save(); return { ok: false as const, error: L(`에너지 크레딧이 모자랍니다(${c.price.toLocaleString('en-US')} 필요). 차감된 것은 없습니다.`, `Not enough energy credits (${c.price.toLocaleString('en-US')} needed). Nothing was charged.`) }; }
    if (st !== 'paid' && st !== 'duplicate') return { ok: false as const, error: L('결제 결과를 확인하지 못했습니다. 다시 누르면 이미 결제된 경우 두 번 차감되지 않습니다.', 'Payment result unknown. Trying again never charges twice if it was already paid.') };
    const date = ctx.gameDate || e.shop.pending?.date || '';
    const docId = issueDoc(sid, { issuer: c.m, kind: 'warranty', date, ref: c.id, refKind: 'col', price: c.price, buyer: ctx.playerName || undefined });
    recordPurchase(e.shop, c.id, date, docId); save(); push();
    chronNoteWorld(L(`${date} 「${c.n[0]}」을(를) 사들여 골동품 진열장에 들였다`, `${date} Acquired "${c.n[1]}" for the antiques showcase`), true);
    logDiagnostic('info', 'collectible.bought', { id: c.id, price: c.price, status: st });
    return { ok: true as const, docId, state: shopView(c.m) };
  } catch (err) { return { ok: false as const, error: (err as Error).message }; }
  finally { busy = false; }
}

// ---- 큐레이터 대여(알파 11, 2026-10-25) ----
const specName = (k: string) => { const r = SPEC_BY_KEY.get(k); return r ? L(r[3], r[4]) : k; };
function loanView(spec: Array<{ key: string; rarity: string }> | null) {
  const sid = ctx.curSaveId; if (!sid) return { ok: false as const, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  const e = entry(sid), cur = currentLoan(e.loans);
  const nameOf = (ref: string, kind: 'col' | 'spec') => (kind === 'col' ? itemView(ref).name : specName(ref));
  const cands = [
    ...Object.keys(e.shop.owned).filter((id) => !isOnLoan(e.loans, id)).map((id) => { const c = COLLECTIBLES.find((x) => x.id === id)!; return { ref: id, kind: 'col' as const, name: itemView(id).name, grade: c.g, gradeName: L(COLLECTIBLE_GRADE[c.g][0], COLLECTIBLE_GRADE[c.g][1]), bonus: LOAN_BONUS[c.g], img: imgFor(id) }; }),
    ...(spec ?? []).filter((s) => SPEC_BY_KEY.has(s.key) && !isOnLoan(e.loans, s.key)).map((s) => { const g = specimenGrade(SPEC_BY_KEY.get(s.key)![2]); return { ref: s.key, kind: 'spec' as const, name: specName(s.key), grade: g, gradeName: L(COLLECTIBLE_GRADE[g][0], COLLECTIBLE_GRADE[g][1]), bonus: LOAN_BONUS[g], img: null }; }),
  ].sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name));
  return { ok: true as const, sid, reachable: merchantReachable('curator'), days: LOAN_BONUS_DAYS, specKnown: !!spec,
    current: cur ? { n: cur.n, name: nameOf(cur.ref, cur.refKind), grade: cur.grade, bonus: LOAN_BONUS[cur.grade], start: cur.start, due: cur.due } : null,
    history: e.loans.loans.filter((l) => l.state === 'returned').slice(-10).reverse().map((l) => ({ name: nameOf(l.ref, l.refKind), bonus: LOAN_BONUS[l.grade], returnedOn: l.returnedOn ?? '', docId: l.docId ?? null })),
    candidates: cands };
}
async function lend(kind: unknown, ref: unknown) {
  const sid = ctx.curSaveId; if (!sid || (kind !== 'col' && kind !== 'spec') || typeof ref !== 'string') return { ok: false as const, error: L('빌려줄 물건을 찾지 못했습니다.', 'Item not found.') };
  if (!merchantReachable('curator')) return { ok: false as const, error: L('큐레이터 기사단과 통신이 닿지 않습니다. 단말기 목록을 갱신해 주세요.', 'The Curator Order cannot be reached. Refresh the terminal list.') };
  const e = entry(sid); let grade: 1 | 2 | 3;
  if (kind === 'col') { const c = COLLECTIBLES.find((x) => x.id === ref); if (!c || !e.shop.owned[ref]) return { ok: false as const, error: L('소장하지 않은 물건입니다.', 'You do not own this article.') }; grade = c.g; }
  else { const a = latestArchive(); const r = SPEC_BY_KEY.get(ref); if (!r || !a?.items.some((i) => i.key === ref)) return { ok: false as const, error: L('대보관소에 그 표본이 없습니다. 목록을 다시 불러와 주세요.', 'That specimen is not in the Grand Archive. Reload the list.') }; grade = specimenGrade(r[2]); }
  const date = ctx.gameDate || ''; const r = startLoan(e.loans, ref, kind, grade, date);
  if (!r.ok) return { ok: false as const, error: r.why === 'busy' ? L('이미 큐레이터 기사단에 빌려준 물건이 있습니다. 한 번에 한 점만 빌려줄 수 있습니다.', 'You already have an item on loan to the Curators. Only one at a time.') : L('게임 날짜를 알 수 없습니다. 게임을 켠 뒤 다시 해 주세요.', 'The game date is unknown. Try again with the game running.') };
  if (kind === 'col' && e.shop.owned[ref]) e.shop.owned[ref].slot = null; // 빌려준 동안 진열장에서 내림
  save(); push();
  const nm = kind === 'col' ? itemView(ref).name : specName(ref);
  chronNoteWorld(L(`${date} 「${nm}」을(를) 큐레이터 기사단에 1년 동안 빌려주었다`, `${date} Lent "${nm}" to the Curator Order for one year`), true);
  logDiagnostic('info', 'loan.start', { ref, kind, grade, due: r.loan.due });
  return { ok: true as const, state: loanView(latestArchive()?.items ?? null) };
}
let returning = false;
/** 매달: 기한이 된 대여를 돌려받는다(연구 보너스 명령 → 감정서 → 진열장 복귀). 게임이 꺼져 있으면 다음 달에 다시. */
async function settleLoans(sid: string, today: string): Promise<void> {
  if (returning || !ctx.gameRunning || sid !== ctx.curSaveId) return; const e = entry(sid), l = currentLoan(e.loans); if (!l || !loanDue(l, today)) return;
  returning = true;
  try {
    const req = ++link.reqCounter; const st = (await terminalRequest(loanBonusCommand(req, sid, l.n, l.grade), 'LOANBONUS', req)).kv.status;
    if (st !== 'applied' && st !== 'duplicate') return;
    const docId = issueDoc(sid, { issuer: 'curator', kind: 'appraisal', date: today, ref: l.ref, refKind: l.refKind, nation: ctx.playerName || undefined, years: 1 });
    finishLoan(l, today, docId);
    if (l.refKind === 'col' && e.shop.owned[l.ref] && e.shop.owned[l.ref].slot === null) { const used = new Set(Object.values(e.shop.owned).map((o) => o.slot)); for (let i = 0; i < SHOWCASE_SLOTS; i++) if (!used.has(i)) { e.shop.owned[l.ref].slot = i; break; } }
    save(); push();
    const nm = l.refKind === 'col' ? itemView(l.ref).name : specName(l.ref);
    ctx.notify({ kind: 'info', title: L('큐레이터 기사단이 대여품을 돌려보냈습니다', 'The Curator Order has returned your loan'), body: L(`「${nm}」과(와) 함께 감정서가 도착했습니다. 1년 동안 모든 연구 속도 +${LOAN_BONUS[l.grade]}%.`, `"${nm}" came back with an appraisal. All research speed +${LOAN_BONUS[l.grade]}% for a year.`) });
    chronNoteWorld(L(`${today} 큐레이터 기사단이 「${nm}」을(를) 감정서와 함께 돌려보냈다 — 연구 속도 +${LOAN_BONUS[l.grade]}%`, `${today} The Curator Order returned "${nm}" with an appraisal: research speed +${LOAN_BONUS[l.grade]}%`), true);
    logDiagnostic('info', 'loan.returned', { ref: l.ref, grade: l.grade, status: st });
  } catch (err) { logDiagnostic('warn', 'loan.return_failed', { error: (err as Error).message }); }
  finally { returning = false; }
}

// ---- 예술가 극단 순회 공연(알파 11, 2026-10-25) ----
const tourUntil = (start: string) => addMonths(start, TOUR_DAYS / 30); // 게임 한 달 = 30일
function tourView() {
  const sid = ctx.curSaveId; if (!sid) return { ok: false as const, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  const e = entry(sid), last = e.tours.tours[e.tours.tours.length - 1], today = ctx.gameDate || '';
  const until = last ? tourUntil(last.start) : '', active = !!last && !!today && cmpDate(today, until) < 0;
  const c = terminal.sid === sid ? terminal.items.find((x) => x.type === 'enclave' && x.sub === 'artist') : undefined;
  const fest = gameState.last?.sid === sid ? !!gameState.last.enclave?.fest : false;
  return { ok: true as const, reachable: !!c, score: c ? Math.round(c.score) : null, cost: TOUR_COST, days: TOUR_DAYS, active, until: active ? until : '', festival: fest, refused: !!c && c.score < TOUR_MIN_SCORE,
    history: [...e.tours.tours].reverse().slice(0, 5).map((t) => ({ start: t.start, until: tourUntil(t.start), docId: e.docs.docs.find((d) => d.kind === 'contract' && d.date === t.start)?.id ?? null })) };
}
let touring = false;
async function requestTour() {
  const sid = ctx.curSaveId; const v = tourView(); if (!v.ok || !sid) return { ok: false as const, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  if (!ctx.gameRunning) return { ok: false as const, error: L('게임이 켜져 있어야 의뢰할 수 있습니다.', 'The game must be running to commission a tour.') };
  if (!v.reachable) return { ok: false as const, error: L('예술가 극단과 통신이 닿지 않습니다. 단말기 목록을 갱신해 주세요.', 'The Artisan Troupe cannot be reached. Refresh the terminal list.') };
  if (v.refused) return { ok: false as const, error: L('극단이 정중히 거절했습니다. 「지금은 귀국의 무대에 설 마음이 들지 않는군요.」(관계를 개선한 뒤 다시 부탁해 보세요)', 'The Troupe politely declined: “We do not feel moved to perform on your stage just now.” (Improve relations and ask again.)') };
  if (v.active || v.festival) return { ok: false as const, error: L('이미 세계의 축제나 순회 공연이 진행 중입니다. 극단원은 한 번에 한 무대에만 섭니다.', 'A Festival of Worlds or a tour is already under way. The artists stand on one stage at a time.') };
  if (touring || ctx.pend || ctx.pending) return { ok: false as const, error: L('진행 중인 통신과 제안을 마친 뒤 해 주세요.', 'Finish the ongoing call and proposals first.') };
  touring = true; const e = entry(sid), n = e.tours.seq + 1, req = ++link.reqCounter;
  try {
    const st = (await terminalRequest(tourCommand(req, sid, n), 'ARTTOUR', req)).kv.status;
    if (st === 'short') return { ok: false as const, error: L(`에너지 크레딧이 모자랍니다(${TOUR_COST} 필요). 차감된 것은 없습니다.`, `Not enough energy credits (${TOUR_COST} needed). Nothing was charged.`) };
    if (st === 'busy') return { ok: false as const, error: L('게임에 이미 세계의 축제나 순회 공연 효과가 있습니다. 차감된 것은 없습니다.', 'The game already has a Festival of Worlds or tour in effect. Nothing was charged.') };
    if (st !== 'applied' && st !== 'duplicate') return { ok: false as const, error: L('결과를 확인하지 못했습니다. 다시 눌러도 두 번 차감되지 않습니다.', 'Result unknown. Trying again never charges twice.') };
    const date = ctx.gameDate || ''; e.tours.seq = n; e.tours.tours = [...e.tours.tours, { n, start: date }].slice(-50);
    const docId = issueDoc(sid, { issuer: 'artist', kind: 'contract', date, ref: 'tour', price: TOUR_COST, nation: ctx.playerName || undefined, due: tourUntil(date) });
    save(); push();
    chronNoteWorld(L(`${date} 예술가 극단의 순회 공연이 시작되었다(900일)`, `${date} The Artisan Troupe began a touring season (900 days)`), true);
    ctx.notify({ kind: 'news', title: L('예술가 극단의 순회 공연이 시작되었습니다', 'The Artisan Troupe\'s tour has begun'), body: L('900일 동안 제국 전역의 행복도 +4% · 인구 증가 +2.5%. 계약서가 국가 문서함에 들어갔습니다.', 'For 900 days: empire-wide happiness +4%, population growth +2.5%. The contract is in the State archive.') });
    logDiagnostic('info', 'tour.start', { n, status: st });
    return { ok: true as const, docId, state: tourView() };
  } catch (err) { return { ok: false as const, error: (err as Error).message }; }
  finally { touring = false; }
}

export function registerCollectibles(router: LogRouter): void {
  ipcMain.handle('tourState', () => tourView());
  ipcMain.handle('tourRequest', () => requestTour());
  onGameSnapshot((snap) => { if (snap.sid && snap.sid === ctx.curSaveId) void settleLoans(snap.sid, snap.date || ctx.gameDate); });
  ipcMain.handle('loanState', async (_e, rescan: unknown) => { let a = latestArchive(); if ((!a || rescan) && ctx.gameRunning) { const r = await scanArchive().catch(() => null); if (r?.snapshot) a = r.snapshot; } return loanView(a?.items ?? null); });
  ipcMain.handle('loanStart', (_e, kind: unknown, ref: unknown) => lend(kind, ref));
  router.on(SLOT.ENCLAVE_SHOP, 'collectibles:pay', (m: SllmMessage) => { if (m.kind === 'COLPAY' || m.kind === 'LOANBONUS' || m.kind === 'ARTTOUR') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); });
  ipcMain.handle('colShop', (_e, m: unknown) => (isShopMerchant(m) ? shopView(m) : { ok: false, error: 'bad merchant' }));
  ipcMain.handle('colBuy', (_e, id: unknown) => buyCollectible(id));
  ipcMain.handle('colShowcase', () => showcaseView());
  ipcMain.handle('colPlace', (_e, id: unknown, slot: unknown) => {
    const sid = ctx.curSaveId; if (!sid || typeof id !== 'string') return { ok: false, error: L('물건을 찾지 못했습니다.', 'Article not found.') };
    const e = entry(sid); if (isOnLoan(e.loans, id)) return { ok: false, error: L('큐레이터 기사단에 빌려준 물건입니다. 돌아온 뒤 옮길 수 있습니다.', 'This item is on loan to the Curators. Move it after it returns.') };
    const ok = placeItem(e.shop, id, slot === null ? null : Number(slot)); if (ok) { save(); push(); }
    return ok ? { ok: true, state: showcaseView() } : { ok: false, error: L('그 자리에 놓을 수 없습니다.', 'It cannot be placed there.') };
  });
  ipcMain.handle('docsList', () => docsView());
  ipcMain.handle('docsOpen', (_e, id: unknown) => docOpen(id));
}
