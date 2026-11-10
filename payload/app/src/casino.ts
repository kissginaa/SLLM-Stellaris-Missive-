// 우주 카지노(2026-10-30 사용자 결정, 계획 2번). 게임 다섯 가지의 규칙·판정만 있는 순수 모듈(전자·파일 없음, 그림 없음).
// 판돈은 통치자 개인 금고에서만(casino-app). 결과를 소문·기사로 엮는 건 「파파라치」 때 정함.
// 확률·배당은 실제 카지노 규칙을 따른다(카지노에 약간 유리 — 손대려면 여기 숫자만).

export type Rng = () => number;
const pickW = <T>(items: Array<[T, number]>, rng: Rng): T => { const s = items.reduce((n, [, w]) => n + w, 0); let r = rng() * s; for (const [x, w] of items) { r -= w; if (r < 0) return x; } return items[items.length - 1][0]; };

// ---------------- 1. 슬롯머신 (릴 3개) ----------------
export type SlotSym = 'star' | 'planet' | 'comet' | 'crystal' | 'ship' | 'nebula';
export const SLOT_REEL: Array<[SlotSym, number]> = [['nebula', 30], ['crystal', 24], ['comet', 20], ['planet', 14], ['ship', 8], ['star', 4]];
/** 세 개가 같을 때 배당(판돈의 몇 배), 「성운」 두 개 이상은 작은 보상. */
export const SLOT_PAY: Record<SlotSym, number> = { star: 400, ship: 130, planet: 45, comet: 22, crystal: 13, nebula: 8 }; // 이론상 약 95% 돌려줌(slotRtp)
export const SLOT_TWO_NEBULA = 1;
export function slotPayout(r: SlotSym[]): number {
  if (r[0] === r[1] && r[1] === r[2]) return SLOT_PAY[r[0]];
  const neb = r.filter((x) => x === 'nebula').length; return neb >= 2 ? SLOT_TWO_NEBULA : 0;
}
export function spinSlots(bet: number, rng: Rng): { reels: SlotSym[]; win: number } {
  const reels = [0, 1, 2].map(() => pickW(SLOT_REEL, rng)); return { reels, win: bet * slotPayout(reels) };
}
/** 이론상 돌려주는 비율(시험용). */
export function slotRtp(): number {
  const tot = SLOT_REEL.reduce((n, [, w]) => n + w, 0); let rtp = 0;
  for (const [a, wa] of SLOT_REEL) for (const [b, wb] of SLOT_REEL) for (const [c, wc] of SLOT_REEL) rtp += (wa * wb * wc) / tot ** 3 * slotPayout([a, b, c]);
  return rtp;
}

// ---------------- 2. 룰렛 (유럽식 0 하나) ----------------
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export type RouletteBet = { kind: 'number'; n: number; amt: number } | { kind: 'red' | 'black' | 'odd' | 'even' | 'low' | 'high'; amt: number } | { kind: 'dozen' | 'column'; n: 1 | 2 | 3; amt: number };
export function rouletteWin(b: RouletteBet, x: number): number {
  if (b.kind === 'number') return x === b.n ? b.amt * 36 : 0; // 35배 + 원금
  if (x === 0) return 0;
  const hit = b.kind === 'red' ? RED.has(x) : b.kind === 'black' ? !RED.has(x) : b.kind === 'odd' ? x % 2 === 1 : b.kind === 'even' ? x % 2 === 0 : b.kind === 'low' ? x <= 18 : b.kind === 'high' ? x >= 19
    : b.kind === 'dozen' ? Math.ceil(x / 12) === b.n : ((x - 1) % 3) + 1 === (b as { n: number }).n;
  if (!hit) return 0;
  return b.kind === 'dozen' || b.kind === 'column' ? b.amt * 3 : b.amt * 2;
}
export function validRouletteBet(b: unknown): b is RouletteBet {
  const x = b as RouletteBet; if (!x || !Number.isSafeInteger(x.amt) || x.amt < 1) return false;
  if (x.kind === 'number') return Number.isInteger(x.n) && x.n >= 0 && x.n <= 36;
  if (x.kind === 'dozen' || x.kind === 'column') return x.n === 1 || x.n === 2 || x.n === 3;
  return ['red', 'black', 'odd', 'even', 'low', 'high'].includes(x.kind);
}
export function spinRoulette(bets: RouletteBet[], rng: Rng): { n: number; win: number } {
  const n = Math.floor(rng() * 37); return { n, win: bets.reduce((s, b) => s + rouletteWin(b, n), 0) };
}

// ---------------- 3. 성간 주사위 (주사위 3개, 대·소·합·트리플) ----------------
export type DiceBet = { kind: 'small' | 'big'; amt: number } | { kind: 'total'; n: number; amt: number } | { kind: 'triple'; amt: number };
/** 합 맞히기 배당(원금 제외). */
export const DICE_TOTAL_PAY: Record<number, number> = { 4: 50, 5: 18, 6: 14, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 14, 16: 18, 17: 50 };
export function diceWin(b: DiceBet, d: number[]): number {
  const sum = d[0] + d[1] + d[2], triple = d[0] === d[1] && d[1] === d[2];
  if (b.kind === 'triple') return triple ? b.amt * 31 : 0;
  if (b.kind === 'total') return sum === b.n ? b.amt * ((DICE_TOTAL_PAY[b.n] ?? 0) + 1) : 0;
  if (triple) return 0; // 대·소는 트리플이면 짐
  return (b.kind === 'small' ? sum >= 4 && sum <= 10 : sum >= 11 && sum <= 17) ? b.amt * 2 : 0;
}
export function validDiceBet(b: unknown): b is DiceBet {
  const x = b as DiceBet; if (!x || !Number.isSafeInteger(x.amt) || x.amt < 1) return false;
  return x.kind === 'total' ? Number.isInteger(x.n) && DICE_TOTAL_PAY[x.n] !== undefined : x.kind === 'small' || x.kind === 'big' || x.kind === 'triple';
}
export function rollDice(bets: DiceBet[], rng: Rng): { dice: number[]; win: number } {
  const dice = [0, 1, 2].map(() => 1 + Math.floor(rng() * 6)); return { dice, win: bets.reduce((s, b) => s + diceWin(b, dice), 0) };
}

// ---------------- 카드 (블랙잭·포커 공용) ----------------
export type Card = string; // 'As' 'Td' '9h' ... (끗수 + 무늬 s h d c)
export const RANKS = '23456789TJQKA', SUITS = 'shdc';
export function newDeck(decks = 1): Card[] { const d: Card[] = []; for (let k = 0; k < decks; k++) for (const s of SUITS) for (const r of RANKS) d.push(r + s); return d; }
export function shuffle<T>(a: T[], rng: Rng): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------- 4. 블랙잭 (6덱, 딜러 소프트 17에서 멈춤, 블랙잭 3:2, 더블다운, 스플릿 없음) ----------------
export function bjValue(h: Card[]): { total: number; soft: boolean } {
  let t = 0, aces = 0; for (const c of h) { const r = c[0]; if (r === 'A') { aces++; t += 11; } else t += 'TJQK'.includes(r) ? 10 : Number(r); }
  while (t > 21 && aces > 0) { t -= 10; aces--; } return { total: t, soft: aces > 0 };
}
export const isBlackjack = (h: Card[]): boolean => h.length === 2 && bjValue(h).total === 21;
export interface BjState { shoe: Card[]; player: Card[]; dealer: Card[]; bet: number; doubled: boolean; done: boolean; result?: 'blackjack' | 'win' | 'push' | 'lose' | 'bust'; payout?: number }
export function bjDeal(bet: number, rng: Rng, shoe?: Card[]): BjState {
  const s = shoe && shoe.length > 52 ? shoe : shuffle(newDeck(6), rng);
  const st: BjState = { shoe: s, player: [s.pop()!, s.pop()!], dealer: [s.pop()!, s.pop()!], bet, doubled: false, done: false };
  if (isBlackjack(st.player) || isBlackjack(st.dealer)) bjSettle(st);
  return st;
}
function bjSettle(st: BjState): void {
  const p = bjValue(st.player).total;
  if (p > 21) { st.result = 'bust'; st.payout = 0; st.done = true; return; }
  if (isBlackjack(st.player) && !isBlackjack(st.dealer)) { st.result = 'blackjack'; st.payout = st.bet + Math.floor(st.bet * 1.5); st.done = true; return; }
  if (!isBlackjack(st.player) || !isBlackjack(st.dealer)) while (bjValue(st.dealer).total < 17) st.dealer.push(st.shoe.pop()!);
  const d = bjValue(st.dealer).total, b = st.bet * (st.doubled ? 2 : 1);
  if (isBlackjack(st.dealer) && !isBlackjack(st.player)) { st.result = 'lose'; st.payout = 0; }
  else if (d > 21 || p > d) { st.result = 'win'; st.payout = b * 2; }
  else if (p === d) { st.result = 'push'; st.payout = b; }
  else { st.result = 'lose'; st.payout = 0; }
  st.done = true;
}
/** 플레이어 행동. 더블다운은 처음 두 장일 때만(추가 판돈은 부르는 쪽이 금고에서 미리 뺌). */
export function bjAct(st: BjState, a: 'hit' | 'stand' | 'double'): BjState {
  if (st.done) return st;
  if (a === 'double') { if (st.player.length !== 2 || st.doubled) return st; st.doubled = true; st.player.push(st.shoe.pop()!); bjSettle(st); return st; }
  if (a === 'hit') { st.player.push(st.shoe.pop()!); if (bjValue(st.player).total >= 21) bjSettle(st); return st; }
  bjSettle(st); return st;
}

// ---------------- 5. 포커 (텍사스 홀덤, 2~6명, 고정 베팅) ----------------
const RV = (c: Card) => RANKS.indexOf(c[0]) + 2;
/** 5장 패 점수(클수록 셈). [족보, 끗수…]를 한 숫자로. 족보: 8 스트레이트 플러시 … 0 하이카드. */
function score5(cs: Card[]): number {
  const v = cs.map(RV).sort((a, b) => b - a), fl = cs.every((c) => c[1] === cs[0][1]);
  const uniq = [...new Set(v)]; let straightHi = 0;
  if (uniq.length === 5) { if (v[0] - v[4] === 4) straightHi = v[0]; else if (v[0] === 14 && v[1] === 5) straightHi = 5; }
  const cnt = new Map<number, number>(); for (const x of v) cnt.set(x, (cnt.get(x) ?? 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]), shape = groups.map((g) => g[1]).join('');
  const enc = (cat: number, ks: number[]) => ks.concat([0, 0, 0, 0, 0]).slice(0, 5).reduce((n, k) => n * 15 + k, cat); // 끗수 5칸 고정(족보끼리 비교가 맞게)
  if (straightHi && fl) return enc(8, [straightHi]);
  if (shape === '41') return enc(7, groups.map((g) => g[0]));
  if (shape === '32') return enc(6, groups.map((g) => g[0]));
  if (fl) return enc(5, v);
  if (straightHi) return enc(4, [straightHi]);
  if (shape === '311') return enc(3, groups.map((g) => g[0]));
  if (shape === '221') return enc(2, groups.map((g) => g[0]));
  if (shape === '2111') return enc(1, groups.map((g) => g[0]));
  return enc(0, v);
}
/** 5~7장 중 가장 좋은 5장 점수. */
export function bestHand(cs: Card[]): number {
  if (cs.length <= 5) return score5(cs);
  let best = 0; const n = cs.length, pick: Card[] = [];
  const go = (from: number) => { if (pick.length === 5) { const v = score5(pick); if (v > best) best = v; return; } for (let i = from; i <= n - (5 - pick.length); i++) { pick.push(cs[i]); go(i + 1); pick.pop(); } };
  go(0); return best;
}
export const HAND_NAMES: Array<[string, string]> = [['하이카드', 'High card'], ['원페어', 'One pair'], ['투페어', 'Two pair'], ['트리플', 'Three of a kind'], ['스트레이트', 'Straight'], ['플러시', 'Flush'], ['풀하우스', 'Full house'], ['포카드', 'Four of a kind'], ['스트레이트 플러시', 'Straight flush']];
export const handCategory = (score: number): number => Math.floor(score / 15 ** 5);
/** 승률 추정(몬테카를로). opp = 남은 상대 수. */
export function equity(hole: Card[], board: Card[], opp: number, rng: Rng, sims = 200): number {
  const seen = new Set([...hole, ...board]), deck = newDeck().filter((c) => !seen.has(c)); let win = 0;
  for (let i = 0; i < sims; i++) {
    const d = shuffle(deck.slice(), rng), b = board.concat(d.splice(0, 5 - board.length)), me = bestHand(hole.concat(b));
    let best = 0, tie = 0; for (let k = 0; k < opp; k++) { const s = bestHand([d.pop()!, d.pop()!].concat(b)); if (s > best) { best = s; tie = 0; } if (s === best) tie++; }
    if (me > best) win += 1; else if (me === best) win += 1 / (tie + 1);
  }
  return win / sims;
}
export interface PokerSeat { id: string; name: string; chips: number; hole: Card[]; folded: boolean; bet: number; allIn: boolean; style: { aggr: number; caution: number; bluff: number }; you?: boolean }
export interface PokerHand { seats: PokerSeat[]; deck: Card[]; board: Card[]; pot: number; street: 0 | 1 | 2 | 3 | 4; toAct: number; dealer: number; small: number; big: number; raises: number; acted: Set<string> | string[]; done: boolean; winners?: string[]; log: Array<{ id: string; act: string; amt?: number }> }
/** 고정 베팅: 프리플랍·플랍은 big, 턴·리버는 big×2, 한 라운드 올리기 최대 3번. */
export const POKER = { maxRaises: 3 } as const;
const betSize = (h: PokerHand) => (h.street >= 2 ? h.big * 2 : h.big);
const live = (h: PokerHand) => h.seats.filter((s) => !s.folded);
const maxBet = (h: PokerHand) => Math.max(...h.seats.map((s) => s.bet));
function acted(h: PokerHand): Set<string> { if (!(h.acted instanceof Set)) h.acted = new Set(h.acted); return h.acted as Set<string>; }
function put(h: PokerHand, s: PokerSeat, amt: number): number { const a = Math.min(amt, s.chips); s.chips -= a; s.bet += a; h.pot += a; if (s.chips === 0) s.allIn = true; return a; }
export function pokerDeal(seats: PokerSeat[], dealer: number, small: number, big: number, rng: Rng): PokerHand {
  const deck = shuffle(newDeck(), rng);
  for (const s of seats) { s.hole = s.chips > 0 ? [deck.pop()!, deck.pop()!] : []; s.folded = s.chips <= 0; s.bet = 0; s.allIn = false; }
  const h: PokerHand = { seats, deck, board: [], pot: 0, street: 0, toAct: 0, dealer, small, big, raises: 0, acted: new Set(), done: false, log: [] };
  const order = (from: number) => { const n = seats.length; for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (!seats[i].folded) return i; } return from; };
  const sb = order(dealer), bb = order(sb);
  put(h, seats[sb], small); h.log.push({ id: seats[sb].id, act: 'small', amt: small });
  put(h, seats[bb], big); h.log.push({ id: seats[bb].id, act: 'big', amt: big });
  h.toAct = order(bb);
  return h;
}
export type PokerAct = 'fold' | 'check' | 'call' | 'raise';
export function legalPoker(h: PokerHand): PokerAct[] {
  const s = h.seats[h.toAct], need = maxBet(h) - s.bet, out: PokerAct[] = ['fold'];
  out.push(need > 0 ? 'call' : 'check'); if (h.raises < POKER.maxRaises && s.chips > need) out.push('raise'); return out;
}
function nextSeat(h: PokerHand): void { const n = h.seats.length; for (let k = 1; k <= n; k++) { const i = (h.toAct + k) % n; if (!h.seats[i].folded && !h.seats[i].allIn) { h.toAct = i; return; } } }
function roundOver(h: PokerHand): boolean {
  const mb = maxBet(h), A = acted(h);
  return h.seats.every((s) => s.folded || s.allIn || (A.has(s.id) && s.bet === mb));
}
function showdown(h: PokerHand): void {
  while (h.board.length < 5) h.board.push(h.deck.pop()!);
  const ls = live(h), sc = ls.map((s) => bestHand(s.hole.concat(h.board))), top = Math.max(...sc), win = ls.filter((_, i) => sc[i] === top);
  const share = Math.floor(h.pot / win.length); for (const w of win) w.chips += share; win[0].chips += h.pot - share * win.length;
  h.winners = win.map((w) => w.id); h.done = true; h.street = 4;
}
/** 한 사람의 행동을 반영하고, 라운드·판이 끝나면 다음으로 넘긴다. */
export function pokerAct(h: PokerHand, a: PokerAct): PokerHand {
  if (h.done) return h;
  const s = h.seats[h.toAct], need = maxBet(h) - s.bet, A = acted(h);
  if (!legalPoker(h).includes(a)) a = need > 0 ? 'fold' : 'check';
  if (a === 'fold') s.folded = true;
  else if (a === 'call') put(h, s, need);
  else if (a === 'raise') { put(h, s, need + betSize(h)); h.raises++; A.clear(); }
  A.add(s.id); h.log.push({ id: s.id, act: a, ...(a === 'call' || a === 'raise' ? { amt: s.bet } : {}) });
  const ls = live(h);
  if (ls.length === 1) { ls[0].chips += h.pot; h.winners = [ls[0].id]; h.done = true; return h; }
  if (roundOver(h)) {
    if (ls.filter((x) => !x.allIn).length <= 1 || h.street === 3) { showdown(h); return h; }
    for (const x of h.seats) x.bet = 0; h.raises = 0; A.clear();
    h.street = (h.street + 1) as PokerHand['street'];
    h.deck.pop(); h.board.push(...h.deck.splice(-(h.street === 1 ? 3 : 1)));
    h.toAct = h.dealer; nextSeat(h); return h;
  }
  nextSeat(h); return h;
}
/** AI 행동: 승률·팟 배당·성격(공격성·신중·허세). */
export function pokerAi(h: PokerHand, rng: Rng): PokerAct {
  const s = h.seats[h.toAct], legal = legalPoker(h), need = maxBet(h) - s.bet;
  const eq = equity(s.hole, h.board, live(h).length - 1, rng, 120), odds = need > 0 ? need / (h.pot + need) : 0;
  const bluff = rng() < s.style.bluff * 0.15;
  const strong = eq > 0.62 - s.style.aggr * 0.08 + s.style.caution * 0.05;
  if ((strong || bluff) && legal.includes('raise')) return 'raise';
  if (need === 0) return 'check';
  if (eq + s.style.aggr * 0.04 - s.style.caution * 0.04 >= odds) return 'call';
  return 'fold';
}
/** 지금 판을 사람 말로(영어, AI 프롬프트용 — 상대 손패는 숨김). */
export function pokerStory(h: PokerHand, meId: string, leaderName = 'the leader'): string {
  const me = h.seats.find((s) => s.id === meId), you = h.seats.find((s) => s.you);
  const st = ['pre-flop', 'flop', 'turn', 'river', 'showdown'][h.street];
  const lines = [`[The poker hand you are playing right now at the casino table] Texas hold'em, ${h.seats.length} players. Street: ${st}. Pot: ${h.pot} credits.`];
  if (me) lines.push(`Your cards: ${me.hole.join(' ')} (keep them secret unless the hand is over). Your chips: ${me.chips}.${me.folded ? ' You folded this hand.' : ''}`);
  if (h.board.length) lines.push(`Board: ${h.board.join(' ')}.`);
  if (you) lines.push(`${leaderName}'s chips: ${you.chips}.${you.folded ? ` ${leaderName} folded.` : ''}`);
  const last = h.log.slice(-6).map((l) => `${h.seats.find((s) => s.id === l.id)?.you ? leaderName : h.seats.find((s) => s.id === l.id)?.id === meId ? 'you' : h.seats.find((s) => s.id === l.id)?.name ?? '?'} ${l.act}${l.amt ? ' ' + l.amt : ''}`);
  if (last.length) lines.push(`Recent actions: ${last.join(', ')}.`);
  if (h.done && h.winners) lines.push(`The hand is over; winner(s): ${h.winners.map((id) => (h.seats.find((s) => s.id === id)?.you ? leaderName : id === meId ? 'you' : h.seats.find((s) => s.id === id)?.name)).join(', ')}.`);
  lines.push('Only refer to what is described above; never invent cards. You may bluff or tease like a poker player, briefly.');
  return lines.join('\n');
}
