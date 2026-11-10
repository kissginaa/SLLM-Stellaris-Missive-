// 우주 카지노(앱 쪽, 2026-10-30 — 시스템만). 규칙: src/casino.ts. 화면·그림(AI 그림 예정)은 나중에 「외출 → 카지노 정거장」에서 붙인다.
// 판돈은 통치자 개인 금고에서만 나가고(spendFromVault), 딴 돈은 금고로(earnToVault). 결과를 소문·기사로 엮는 건 「파파라치」 때.
// 화면(2026-10-30 집컴): ui/casino.html — 외출 지도 → 카지노 정거장(openCasino). 그림(08_카지노_그림_의뢰서.md)은 ui/casino/ 아래, 없으면 앱이 그린 모양.
// 포커: 우리 지도자 한 명을 데려가 같은 테이블에 앉힐 수 있다(체스처럼 물을 때만 AI 한 번, 말은 평소 대화와 똑같이 셈 — persona-app sayInPerson).
import { app, ipcMain, BrowserWindow, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { peopleOf } from './people-app';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { vaultBalance, spendFromVault, earnToVault } from './vault-app';
import { paparazziSnap } from './paparazzi-app';
import { registerStellaChess, scHooks } from './stellachess-app'; // 스텔라체스(함대 오토배틀러, 2026-10-31)
import { casinoKind } from '../paparazzi';
import { personOf, sayInPerson } from './persona-app';
import { gameName } from './namegen-app';
import { styleFor } from '../chess';
import type { Talk } from '../persona';
import { spinSlots, spinRoulette, rollDice, validRouletteBet, validDiceBet, bjDeal, bjAct, bjValue, pokerDeal, pokerAct, pokerAi, legalPoker, pokerStory, handCategory, bestHand, HAND_NAMES, type RouletteBet, type DiceBet, type BjState, type PokerSeat, type PokerHand, type PokerAct, type Card } from '../casino';

export const CASINO = { maxBet: 100_000, pokerSmall: 10, pokerBig: 20, pokerMinBuyIn: 200, maxCompanions: 5, minSeats: 4 } as const; // 테이블 최대 6자리(나 + 지도자 5), 4자리보다 적으면 손님으로 채움
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };
const amountOk = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= CASINO.maxBet;
const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: casinoView() });
/** 한 번 들른 동안의 따고 잃은 합(파파라치 사진감, 2026-10-31). */
let sess = { sid: '', net: 0 };
function pay(sid: string, total: number, what: string): void { if (!Number.isSafeInteger(total) || total < 1) throw new Error('BAD_TOTAL'); if (!spendFromVault(sid, total, what)) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${total}).`, `Not enough credits in the vault (need ${total}).`)); if (sess.sid === sid) sess.net -= total; }
const win = (sid: string, amt: number, what: string) => { if (amt > 0) { earnToVault(sid, amt, what); if (sess.sid === sid) sess.net += amt; } };

// ---- 블랙잭·포커 진행 상태(메모리)
let bj: { sid: string; st: BjState } | null = null;
interface Table { sid: string; seats: PokerSeat[]; hand: PokerHand | null; dealer: number; companions: string[]; talks: Record<string, Talk>; lastTo: string; chat: Array<{ who: 'me' | 'them' | 'sys'; text: string; name?: string }>; asking: boolean }
let table: Table | null = null;
const YOU = 'you';

function bjView() { if (!bj) return null; const s = bj.st; return { player: s.player, dealer: s.done ? s.dealer : [s.dealer[0], '??'], total: bjValue(s.player).total, dealerTotal: s.done ? bjValue(s.dealer).total : null, bet: s.bet, doubled: s.doubled, done: s.done, result: s.result ?? null, payout: s.payout ?? 0 }; }
function pokerView() {
  if (!table) return null; const h = table.hand;
  return {
    seats: table.seats.map((s) => ({ id: s.id, name: s.name, chips: s.chips, bet: s.bet, folded: s.folded, allIn: s.allIn, you: !!s.you, companion: table!.companions.includes(s.id), hole: s.you || (h?.done && !s.folded) ? s.hole : s.hole.length ? ['??', '??'] : [] })),
    board: h?.board ?? [], pot: h?.pot ?? 0, street: h?.street ?? null, done: h?.done ?? true, toAct: h && !h.done ? table.seats[h.toAct].id : null,
    legal: h && !h.done && table.seats[h.toAct].you ? legalPoker(h) : [], winners: h?.winners ?? [],
    youHand: h && h.board.length >= 3 ? (() => { const y = table!.seats.find((s) => s.you)!; if (!y.hole.length) return ''; const c = handCategory(bestHand(y.hole.concat(h.board))); return L(HAND_NAMES[c][0], HAND_NAMES[c][1]); })() : '',
    chat: table.chat.slice(-40), asking: table.asking, talkable: table.companions.length > 0, companions: table.companions.map((k) => ({ key: k, name: table!.seats.find((x) => x.id === k)?.name ?? '' })),
  };
}
const artSeen = new Map<string, boolean>();
const art = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
// 사람 그림: 2026-10-30 받은 것은 webp(용량), 없으면 png
const ART_BG = ['lobby', 'slots', 'roulette', 'dice', 'blackjack', 'poker'], ART_ICONS = ['sym_nebula', 'sym_crystal', 'sym_comet', 'sym_planet', 'sym_ship', 'sym_star', 'chip_white', 'chip_red', 'chip_blue', 'chip_green', 'chip_black', 'chip_purple', 'card_back', 'dealer_button', 'station_emblem'];
function artView() {
  const bg: Record<string, string | null> = {}; for (const k of ART_BG) bg[k] = art(`casino/bg/${k}.webp`) ?? (k === 'lobby' ? art('assets/outing/outing-casino.webp') : null); // 로비 전용 그림이 없으면 외출 카지노 그림
  const icons: Record<string, string | null> = {}; for (const k of ART_ICONS) icons[k] = art(`casino/icons/${k}.png`);
  return { bg, icons, dealers: ['D01', 'D02', 'D03'].map((d) => art(`casino/dealers/${d}.webp`) ?? art(`casino/dealers/${d}.png`)), dealersCut: ['D01', 'D02', 'D03'].map((d) => art(`casino/dealers/${d}_cut.webp`)), guests: Array.from({ length: 12 }, (_, i) => { const g = `casino/guests/G${String(i + 1).padStart(2, '0')}`; return art(`${g}.webp`) ?? art(`${g}.png`); }) };
}
const leadersOf = (sid: string) => peopleOf(sid).filter((p) => !p.gone && !p.ruler).sort((a, b) => b.lv - a.lv).map((p) => ({ key: `p:${p.lid}`, name: p.name }));
export function casinoView() { const sid = ctx.curSaveId; return { sid: sid ?? '', balance: sid ? vaultBalance(sid) : 0, art: artView(), leaders: sid ? leadersOf(sid) : [], limits: { maxBet: CASINO.maxBet, minBuyIn: CASINO.pokerMinBuyIn, blinds: [CASINO.pokerSmall, CASINO.pokerBig], maxCompanions: CASINO.maxCompanions }, blackjack: bj && bj.sid === sid ? bjView() : null, poker: table && table.sid === sid ? pokerView() : null }; }
let cwin: BrowserWindow | null = null;
/** 카지노 창(외출 → 카지노 정거장). */
export function openCasino(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 갈 수 있습니다.', 'Load a save first.') };
  artSeen.clear();
  if (cwin && !cwin.isDestroyed()) { cwin.show(); cwin.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#0a0716', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  cwin = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'casino.html'));
  sess = { sid: ctx.curSaveId, net: 0 };
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (cwin === w) cwin = null; const k = casinoKind(sess.net); if (k && sess.sid === ctx.curSaveId) paparazziSnap(k, { amount: Math.abs(sess.net).toLocaleString() }); sess = { sid: '', net: 0 }; });
  return { ok: true };
}
function push(): void { const s = casinoView(); for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('casinoUpdate', s); }

// ---- 포커 진행: 플레이어 차례가 오거나 판이 끝날 때까지 AI 가 둔다
function runAi(t: Table): void {
  let guard = 0; const h = t.hand; if (!h) return;
  while (!h.done && !t.seats[h.toAct].you && guard++ < 200) pokerAct(h, pokerAi(h, Math.random));
  if (h.done) {
    const names = (h.winners ?? []).map((id) => t.seats.find((s) => s.id === id)?.name ?? id).join(', ');
    t.chat.push({ who: 'sys', text: L(`이번 판 승자: ${names}`, `Hand won by: ${names}`) });
  }
}
function newHand(t: Table): { ok: boolean; error?: string } {
  const you = t.seats.find((s) => s.you)!;
  if (you.chips <= 0) return { ok: false, error: L('칩이 없습니다. 자리에서 일어나 다시 앉으세요.', 'You are out of chips. Leave and sit down again.') };
  for (const s of t.seats) if (!s.you && s.chips <= 0) { s.chips = CASINO.pokerMinBuyIn * 2; if (!t.companions.includes(s.id)) s.name = houseName(); } // 빈털터리 손님은 새 손님으로(동행 지도자는 이름 그대로 칩만 다시 — 2026-10-31 감사)
  t.dealer = (t.dealer + 1) % t.seats.length;
  t.hand = pokerDeal(t.seats, t.dealer, CASINO.pokerSmall, CASINO.pokerBig, Math.random); runAi(t); return { ok: true };
}
const houseName = () => gameName(Math.random() < 0.5 ? 'm' : 'f') ?? L('손님', 'Guest');
const leaderName = () => (ctx.playerName ? `the leader of ${ctx.playerName}` : 'the leader');

export function registerCasino(): void {
  registerStellaChess(); scHooks.net = (sid, d) => { if (sess.sid === sid) sess.net += d; }; // 스텔라체스 바이인·배당도 파파라치 사진감(카지노 합계)에
  app.on('before-quit', () => { // 앱을 끄면 포커 칩·진행 중인 블랙잭 판돈을 금고로(메모리에만 있어서 사라지던 문제 — 2026-10-31 감사)
    try { if (table) { const you = table.seats.find((x) => x.you); if (you && you.chips > 0) earnToVault(table.sid, you.chips, 'poker cash-out'); table = null; } if (bj && !bj.st.done && bj.st.bet > 0) { earnToVault(bj.sid, bj.st.bet * (bj.st.doubled ? 2 : 1), 'blackjack refund'); bj = null; } } catch (e) { logDiagnostic('warn', 'casino.quit_refund_failed', { error: String(e) }); }
  });
  ipcMain.handle('casinoState', () => casinoView());
  ipcMain.handle('casinoOpen', () => openCasino());
  ipcMain.handle('casinoClose', () => { if (table && table.sid !== ctx.curSaveId) { const you = table.seats.find((s) => s.you); if (you && you.chips > 0) earnToVault(table.sid, you.chips, 'poker cash-out'); table = null; } // 다른 세이브의 테이블은 자동 캐시아웃(2026-10-31 감사: 창을 못 닫던 문제)
    if (table) return { ok: false, error: L('포커 테이블에서 먼저 일어나세요(남은 칩은 금고로).', 'Leave the poker table first (your chips go back to the vault).') }; if (cwin && !cwin.isDestroyed()) cwin.close(); cwin = null; return { ok: true }; });
  ipcMain.handle('casinoSlots', (_e, bet: unknown) => { try { const sid = need(), b = Math.round(Number(bet)); if (!amountOk(b)) throw new Error(L('판돈을 확인해 주세요.', 'Check the bet.')); pay(sid, b, 'slots'); const r = spinSlots(b, Math.random); win(sid, r.win, 'slots'); push(); return { ok: true, ...r, state: casinoView() }; } catch (e) { return err(e); } });
  ipcMain.handle('casinoRoulette', (_e, bets: unknown) => { try { const sid = need(), list = (Array.isArray(bets) ? bets : []).slice(0, 20) as RouletteBet[]; if (!list.length || !list.every(validRouletteBet)) throw new Error(L('판돈을 확인해 주세요.', 'Check the bets.')); const tot = list.reduce((n, b) => n + b.amt, 0); if (!amountOk(tot)) throw new Error(L('판돈이 너무 큽니다.', 'The total bet is too large.')); pay(sid, tot, 'roulette'); const r = spinRoulette(list, Math.random); win(sid, r.win, 'roulette'); push(); return { ok: true, ...r, state: casinoView() }; } catch (e) { return err(e); } });
  ipcMain.handle('casinoDice', (_e, bets: unknown) => { try { const sid = need(), list = (Array.isArray(bets) ? bets : []).slice(0, 20) as DiceBet[]; if (!list.length || !list.every(validDiceBet)) throw new Error(L('판돈을 확인해 주세요.', 'Check the bets.')); const tot = list.reduce((n, b) => n + b.amt, 0); if (!amountOk(tot)) throw new Error(L('판돈이 너무 큽니다.', 'The total bet is too large.')); pay(sid, tot, 'stellar dice'); const r = rollDice(list, Math.random); win(sid, r.win, 'stellar dice'); push(); return { ok: true, ...r, state: casinoView() }; } catch (e) { return err(e); } });
  ipcMain.handle('casinoBjDeal', (_e, bet: unknown) => {
    try { const sid = need(), b = Math.round(Number(bet)); if (bj && bj.sid === sid && !bj.st.done) throw new Error(L('진행 중인 판이 있습니다.', 'A hand is in progress.')); if (!amountOk(b)) throw new Error(L('판돈을 확인해 주세요.', 'Check the bet.')); pay(sid, b, 'blackjack');
      bj = { sid, st: bjDeal(b, Math.random, bj?.st.shoe) }; if (bj.st.done) win(sid, bj.st.payout ?? 0, 'blackjack'); push(); return { ok: true, state: casinoView() }; } catch (e) { return err(e); }
  });
  ipcMain.handle('casinoBjAct', (_e, act: unknown) => {
    try { const sid = need(); if (!bj || bj.sid !== sid || bj.st.done) throw new Error(L('진행 중인 판이 없습니다.', 'No hand in progress.')); const a = act === 'double' ? 'double' : act === 'hit' ? 'hit' : 'stand';
      if (a === 'double') { if (bj.st.player.length !== 2) throw new Error(L('처음 두 장일 때만 더블다운할 수 있습니다.', 'You can only double on your first two cards.')); pay(sid, bj.st.bet, 'blackjack double'); }
      bjAct(bj.st, a); if (bj.st.done) win(sid, bj.st.payout ?? 0, 'blackjack'); push(); return { ok: true, state: casinoView() }; } catch (e) { return err(e); }
  });
  /** 포커 테이블 앉기: 바이인을 금고에서 칩으로. companions = 데려온 우리 지도자 인물 key 목록(0~5명, 2026-10-30 사용자: 한 명 이상 데려갈 수 있게). */
  ipcMain.handle('casinoPokerSit', (_e, a: { buyIn?: unknown; companions?: unknown }) => {
    try {
      const sid = need(); if (table && table.sid === sid) throw new Error(L('이미 테이블에 앉아 있습니다.', 'You are already at the table.'));
      const buy = Math.round(Number(a?.buyIn)); if (!amountOk(buy) || buy < CASINO.pokerMinBuyIn) throw new Error(L(`바이인은 ${CASINO.pokerMinBuyIn} 이상이어야 합니다.`, `The buy-in must be at least ${CASINO.pokerMinBuyIn}.`));
      const keys = [...new Set((Array.isArray(a?.companions) ? a.companions : []).filter((k): k is string => typeof k === 'string' && !!k))];
      if (keys.length > CASINO.maxCompanions) throw new Error(L(`함께 앉을 수 있는 지도자는 ${CASINO.maxCompanions}명까지입니다.`, `Up to ${CASINO.maxCompanions} leaders can sit with you.`));
      const comps = keys.map((k) => ({ k, p: personOf(k) })); if (comps.some((c) => !c.p)) throw new Error(L('그 인물을 찾지 못했습니다.', 'That person was not found.'));
      pay(sid, buy, 'poker buy-in');
      const seats: PokerSeat[] = [{ id: YOU, name: L('지도자', 'You'), chips: buy, hole: [], folded: false, bet: 0, allIn: false, style: { aggr: 0, caution: 0, bluff: 0 }, you: true }];
      for (const { k, p } of comps) { const st = styleFor(p!.lv, p!.traits ?? [], p!.role); seats.push({ id: k, name: p!.name, chips: buy, hole: [], folded: false, bet: 0, allIn: false, style: { aggr: st.aggr, caution: st.caution, bluff: st.aggr ? 0.8 : 0.3 } }); } // 데려온 지도자의 칩은 그 사람 몫(금고에서 나가지 않음)
      while (seats.length < CASINO.minSeats) { const i = seats.length; seats.push({ id: `house${i}`, name: houseName(), chips: Math.max(buy, CASINO.pokerMinBuyIn * 2), hole: [], folded: false, bet: 0, allIn: false, style: { aggr: Math.random() < 0.4 ? 1 : 0, caution: Math.random() < 0.4 ? 1 : 0, bluff: Math.random() * 0.6 } }); }
      const talks: Record<string, Talk> = {}; for (const k of keys) talks[k] = { key: k, lines: [], moved: 0, opened: ctx.gameDate || '' };
      table = { sid, seats, hand: null, dealer: seats.length - 1, companions: keys, talks, lastTo: keys[0] ?? '', chat: [], asking: false };
      table.chat.push({ who: 'sys', text: L(`포커 테이블에 앉았습니다. 블라인드 ${CASINO.pokerSmall}/${CASINO.pokerBig}.`, `You sit down at the poker table. Blinds ${CASINO.pokerSmall}/${CASINO.pokerBig}.`) });
      const r = newHand(table); push(); logDiagnostic('info', 'casino.poker_sit', { buyIn: buy, companions: keys.length }); return { ok: r.ok, error: r.error, state: casinoView() };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('casinoPokerAct', (_e, act: unknown) => {
    try { const sid = need(), t = table; if (!t || t.sid !== sid || !t.hand || t.hand.done) throw new Error(L('진행 중인 판이 없습니다.', 'No hand in progress.')); if (!t.seats[t.hand.toAct].you) throw new Error(L('지도자 차례가 아닙니다.', 'It is not your turn.'));
      const a = String(act) as PokerAct; if (!legalPoker(t.hand).includes(a)) throw new Error(L('지금 할 수 없는 행동입니다.', 'That action is not allowed now.'));
      pokerAct(t.hand, a); runAi(t); push(); return { ok: true, state: casinoView() }; } catch (e) { return err(e); }
  });
  ipcMain.handle('casinoPokerNext', () => { try { const sid = need(), t = table; if (!t || t.sid !== sid) throw new Error(L('테이블에 앉아 있지 않습니다.', 'You are not at the table.')); if (t.hand && !t.hand.done) throw new Error(L('아직 판이 끝나지 않았습니다.', 'The hand is not over yet.')); const r = newHand(t); push(); return { ok: r.ok, error: r.error, state: casinoView() }; } catch (e) { return err(e); } });
  /** 일어나기: 남은 칩을 금고로(판 중간이면 그 판은 포기 — 이미 건 칩은 잃음). */
  ipcMain.handle('casinoPokerLeave', () => {
    try { const sid = need(), t = table; if (!t || t.sid !== sid) return { ok: true, state: casinoView() }; const you = t.seats.find((s) => s.you)!; if (t.hand && !t.hand.done) you.folded = true;
      win(sid, you.chips, 'poker cash-out'); logDiagnostic('info', 'casino.poker_leave', { chips: you.chips }); table = null; push(); return { ok: true, state: casinoView() }; } catch (e) { return err(e); }
  });
  /** 데려온 지도자에게 말 걸기(물을 때만 AI 한 번). to = 누구에게(여럿이면 고름, 없으면 마지막으로 말한 사람). 그 인물의 패는 프롬프트에만(화면엔 숨김). */
  ipcMain.handle('casinoPokerAsk', async (_e, text: unknown, to?: unknown) => {
    const t = table, s = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!t || !t.companions.length) return { ok: false, error: L('함께 앉은 지도자가 없습니다.', 'No leader is sitting with you.'), state: casinoView() };
    if (!s) return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.'), state: casinoView() };
    if (t.asking) return { ok: false, error: L('이미 대답을 기다리는 중입니다.', 'Already waiting for a reply.'), state: casinoView() };
    const k = typeof to === 'string' && t.companions.includes(to) ? to : t.companions.includes(t.lastTo) ? t.lastTo : t.companions[0];
    const nm = t.seats.find((x) => x.id === k)?.name ?? '';
    t.asking = true; t.lastTo = k; t.chat.push({ who: 'me', text: s, name: nm }); push();
    try {
      const others = t.companions.filter((x) => x !== k).map((x) => t.seats.find((y) => y.id === x)?.name).filter(Boolean);
      const board = t.hand ? pokerStory(t.hand, k, leaderName()) : '';
      const scene = 'You are sitting at a poker table in an orbital casino with the empire\'s leader (the player), face to face, playing Texas hold\'em with a few other guests.' + (others.length ? ` Other leaders of your empire are at the table too: ${others.join(', ')}. The leader is talking to you right now.` : '');
      const r = await sayInPerson(t.sid, k, t.talks[k], s, { scene, board });
      if (table !== t) return { ok: false, state: casinoView() };
      if (!r.ok) { t.chat.pop(); return { ok: false, error: String(r.error ?? ''), state: casinoView() }; }
      t.chat.push({ who: 'them', text: String(r.reply ?? ''), name: nm }); return { ok: true, state: casinoView() };
    } catch (e) { t.chat.pop(); return err(e); }
    finally { t.asking = false; push(); }
  });
}
/** 시험용: 포커 패를 화면에서 숨기는지 등. */
export const _casinoTest = { YOU, holeHidden: (c: Card[]) => c.map(() => '??') };
