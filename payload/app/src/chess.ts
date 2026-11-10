// 지도자와 체스(2026-10-30 사용자 결정, 계획: 1030_집컴_옮기기/00_새기능_계획.md).
// 규칙·AI·판 상황 풀어 쓰기만 있는 순수 모듈(전자·파일·게임 없음). 외부 라이브러리 없이 새로 썼다(라이선스 걱정 없음).
// 판: 64칸 배열, 칸 번호 = 가로줄(0=1줄, 백 쪽)*8 + 세로줄(0=a). 기물: 대문자 백(PNBRQK), 소문자 흑, '' 빈칸.
// 대국 기록(기보)은 앱이 실시간으로 들고 있다가 판이 끝나면 결과만 남긴다(chess-app). 여기 함수는 기록을 저장하지 않는다.

export type Color = 'w' | 'b';
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export interface Move { from: number; to: number; piece: string; capt?: string; promo?: PieceType; ep?: boolean; castle?: 'K' | 'Q' }
export interface Pos { b: string[]; turn: Color; castle: { K: boolean; Q: boolean; k: boolean; q: boolean }; ep: number; half: number; full: number; keys: string[] }
export type Status = 'play' | 'checkmate' | 'stalemate' | 'fifty' | 'repetition' | 'material';

export const VALUE: Record<PieceType, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const N_OFF = [-17, -15, -10, -6, 6, 10, 15, 17], K_OFF = [-9, -8, -7, -1, 1, 7, 8, 9];
const B_DIR: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]], R_DIR: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const colorOf = (p: string): Color | null => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
export const typeOf = (p: string): PieceType => p.toUpperCase() as PieceType;
const fileOf = (s: number) => s & 7, rankOf = (s: number) => s >> 3;
export const sqName = (s: number): string => 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1);
export const sqOf = (n: string): number => { const m = /^([a-h])([1-8])$/.exec(n); return m ? (Number(m[2]) - 1) * 8 + 'abcdefgh'.indexOf(m[1]) : -1; };
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function newGame(): Pos {
  const b: string[] = Array(64).fill('');
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) { b[f] = back[f]; b[8 + f] = 'P'; b[48 + f] = 'p'; b[56 + f] = back[f].toLowerCase(); }
  const p: Pos = { b, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0, full: 1, keys: [] };
  p.keys.push(posKey(p)); return p;
}
export const clonePos = (p: Pos): Pos => ({ b: p.b.slice(), turn: p.turn, castle: { ...p.castle }, ep: p.ep, half: p.half, full: p.full, keys: p.keys.slice() });
export const posKey = (p: Pos): string => p.b.map((x) => x || '.').join('') + p.turn + (p.castle.K ? 'K' : '') + (p.castle.Q ? 'Q' : '') + (p.castle.k ? 'k' : '') + (p.castle.q ? 'q' : '') + p.ep;

/** sq 칸을 by 쪽이 공격하는가. */
export function attacked(b: string[], sq: number, by: Color): boolean {
  const f = fileOf(sq), r = rankOf(sq);
  const pawn = by === 'w' ? 'P' : 'p', pr = by === 'w' ? r - 1 : r + 1;
  if (pr >= 0 && pr < 8) for (const df of [-1, 1]) { const ff = f + df; if (ff >= 0 && ff < 8 && b[pr * 8 + ff] === pawn) return true; }
  const kn = by === 'w' ? 'N' : 'n';
  for (const o of N_OFF) { const t = sq + o; if (t < 0 || t > 63 || Math.abs(fileOf(t) - f) > 2) continue; if (b[t] === kn) return true; }
  const kg = by === 'w' ? 'K' : 'k';
  for (const o of K_OFF) { const t = sq + o; if (t < 0 || t > 63 || Math.abs(fileOf(t) - f) > 1) continue; if (b[t] === kg) return true; }
  const slide = (dirs: Array<[number, number]>, kinds: string) => {
    for (const [df, dr] of dirs) { let ff = f + df, rr = r + dr; while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { const x = b[rr * 8 + ff]; if (x) { if (colorOf(x) === by && kinds.includes(typeOf(x))) return true; break; } ff += df; rr += dr; } }
    return false;
  };
  return slide(B_DIR, 'BQ') || slide(R_DIR, 'RQ');
}
export const kingSq = (b: string[], c: Color): number => b.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (p: Pos, c: Color = p.turn): boolean => { const k = kingSq(p.b, c); return k >= 0 && attacked(p.b, k, other(c)); };

function pseudo(p: Pos): Move[] {
  const out: Move[] = [], b = p.b, me = p.turn;
  const add = (from: number, to: number, extra: Partial<Move> = {}) => { const capt = b[to] || undefined; out.push({ from, to, piece: b[from], ...(capt ? { capt } : {}), ...extra }); };
  for (let s = 0; s < 64; s++) {
    const x = b[s]; if (!x || colorOf(x) !== me) continue;
    const t = typeOf(x), f = fileOf(s), r = rankOf(s);
    if (t === 'P') {
      const dir = me === 'w' ? 1 : -1, start = me === 'w' ? 1 : 6, last = me === 'w' ? 7 : 0, one = s + dir * 8;
      const push = (to: number, extra: Partial<Move> = {}) => { if (rankOf(to) === last) for (const pr of ['Q', 'R', 'B', 'N'] as PieceType[]) add(s, to, { ...extra, promo: pr }); else add(s, to, extra); };
      if (one >= 0 && one < 64 && !b[one]) { push(one); const two = s + dir * 16; if (r === start && !b[two]) add(s, two); }
      for (const df of [-1, 1]) {
        const ff = f + df; if (ff < 0 || ff > 7) continue; const to = (r + dir) * 8 + ff; if (to < 0 || to > 63) continue;
        if (b[to] && colorOf(b[to]) !== me) push(to);
        else if (to === p.ep) out.push({ from: s, to, piece: x, capt: me === 'w' ? 'p' : 'P', ep: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const o of t === 'N' ? N_OFF : K_OFF) { const to = s + o; if (to < 0 || to > 63 || Math.abs(fileOf(to) - f) > (t === 'N' ? 2 : 1)) continue; if (!b[to] || colorOf(b[to]) !== me) add(s, to); }
      if (t === 'K' && !inCheck(p, me)) {
        const home = me === 'w' ? 4 : 60, ok = (sq: number) => !attacked(b, sq, other(me));
        if (s === home) {
          const R = me === 'w' ? 'R' : 'r';
          if ((me === 'w' ? p.castle.K : p.castle.k) && b[home + 3] === R && !b[home + 1] && !b[home + 2] && ok(home + 1) && ok(home + 2)) out.push({ from: s, to: home + 2, piece: x, castle: 'K' });
          if ((me === 'w' ? p.castle.Q : p.castle.q) && b[home - 4] === R && !b[home - 1] && !b[home - 2] && !b[home - 3] && ok(home - 1) && ok(home - 2)) out.push({ from: s, to: home - 2, piece: x, castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'B' ? B_DIR : t === 'R' ? R_DIR : [...B_DIR, ...R_DIR];
      for (const [df, dr] of dirs) { let ff = f + df, rr = r + dr; while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { const to = rr * 8 + ff; if (b[to]) { if (colorOf(b[to]) !== me) add(s, to); break; } add(s, to); ff += df; rr += dr; } }
    }
  }
  return out;
}
/** 수를 둔 새 판(원래 판은 그대로). */
export function play(p: Pos, m: Move): Pos {
  const q = clonePos(p), b = q.b, me = p.turn;
  b[m.to] = m.promo ? (me === 'w' ? m.promo : m.promo.toLowerCase()) : b[m.from]; b[m.from] = '';
  if (m.ep) b[m.to + (me === 'w' ? -8 : 8)] = '';
  if (m.castle) { const home = me === 'w' ? 4 : 60; if (m.castle === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = ''; } else { b[home - 1] = b[home - 4]; b[home - 4] = ''; } }
  const t = typeOf(m.piece);
  if (t === 'K') { if (me === 'w') q.castle.K = q.castle.Q = false; else q.castle.k = q.castle.q = false; }
  for (const [sq, k] of [[0, 'Q'], [7, 'K'], [56, 'q'], [63, 'k']] as Array<[number, 'K' | 'Q' | 'k' | 'q']>) if (m.from === sq || m.to === sq) q.castle[k] = false;
  q.ep = t === 'P' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  q.half = t === 'P' || m.capt ? 0 : p.half + 1;
  if (me === 'b') q.full = p.full + 1;
  q.turn = other(me); q.keys.push(posKey(q));
  return q;
}
export function legalMoves(p: Pos): Move[] { return pseudo(p).filter((m) => !inCheck(play(p, m), p.turn)); }

function insufficient(b: string[]): boolean {
  const rest = b.filter((x) => x && typeOf(x) !== 'K');
  if (rest.length === 0) return true;
  return rest.length === 1 && (typeOf(rest[0]) === 'N' || typeOf(rest[0]) === 'B');
}
export function statusOf(p: Pos): Status {
  if (legalMoves(p).length === 0) return inCheck(p) ? 'checkmate' : 'stalemate';
  if (p.half >= 100) return 'fifty';
  const k = p.keys[p.keys.length - 1]; if (p.keys.filter((x) => x === k).length >= 3) return 'repetition';
  if (insufficient(p.b)) return 'material';
  return 'play';
}

/** 사람이 읽는 수 표기(간단한 SAN). */
export function san(p: Pos, m: Move): string {
  if (m.castle) return (m.castle === 'K' ? 'O-O' : 'O-O-O') + suffix(p, m);
  const t = typeOf(m.piece);
  let s = '';
  if (t === 'P') { if (m.capt) s = 'abcdefgh'[fileOf(m.from)] + 'x'; s += sqName(m.to); if (m.promo) s += '=' + m.promo; }
  else {
    const twins = legalMoves(p).filter((o) => o.to === m.to && o.piece === m.piece && o.from !== m.from);
    let dis = '';
    if (twins.length) { if (twins.every((o) => fileOf(o.from) !== fileOf(m.from))) dis = 'abcdefgh'[fileOf(m.from)]; else if (twins.every((o) => rankOf(o.from) !== rankOf(m.from))) dis = String(rankOf(m.from) + 1); else dis = sqName(m.from); }
    s = t + dis + (m.capt ? 'x' : '') + sqName(m.to);
  }
  return s + suffix(p, m);
}
function suffix(p: Pos, m: Move): string { const q = play(p, m); if (!inCheck(q)) return ''; return legalMoves(q).length === 0 ? '#' : '+'; }

// ---------------- AI ----------------
// 칸 점수(백 기준, a1 이 0번). 흑은 위아래를 뒤집어 쓴다. 단순한 표 — 사람다운 수를 두게 하는 정도.
const PST: Record<PieceType, number[]> = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
};
/** 백 기준 평가(센티폰). */
export function evaluate(b: string[]): number {
  let s = 0;
  for (let i = 0; i < 64; i++) { const x = b[i]; if (!x) continue; const t = typeOf(x); if (colorOf(x) === 'w') s += VALUE[t] + PST[t][i]; else s -= VALUE[t] + PST[t][(7 - rankOf(i)) * 8 + fileOf(i)]; }
  return s;
}
export const material = (b: string[], c: Color): number => b.reduce((a, x) => a + (x && colorOf(x) === c ? VALUE[typeOf(x)] : 0), 0);

/** 인물의 실력·버릇(앱이 레벨·특성으로 정한다). */
export interface Style { depth: number; blunder: number; aggr: number; caution: number }
const STRONG = /strateg|tactic|genius|brilliant|meticulous|careful|cautious|analytical|전략|전술|천재|꼼꼼|신중|분석/i;
const RECKLESS = /reckless|aggress|hothead|impuls|bold|warmonger|무모|공격|성급|충동|대담|호전/i;
const SCHOLAR = /scien|scholar|archiv|research|학자|과학|연구/i;
/** 레벨(1~10)과 특성 이름으로 실력을 정한다. 레벨이 높을수록 깊게 읽고 실수가 적다. */
export function styleFor(lv: number | undefined, traits: string[] = [], role = ''): Style {
  const L = Math.max(1, Math.min(10, Math.round(lv ?? 1)));
  const t = traits.join(' ') + ' ' + role;
  const st: Style = { depth: L >= 7 ? 3 : L >= 3 ? 2 : 1, blunder: Math.max(0.03, 0.22 - L * 0.02), aggr: 0, caution: 0 };
  if (STRONG.test(t)) { st.blunder = Math.max(0.02, st.blunder - 0.05); st.caution = 1; }
  if (RECKLESS.test(t)) { st.aggr = 1; st.blunder = Math.min(0.35, st.blunder + 0.06); }
  if (SCHOLAR.test(t)) st.blunder = Math.max(0.02, st.blunder - 0.03);
  return st;
}

const NODE_CAP = 12000; // 한 수 생각 상한(약 0.5초 안팎, 작업자 스레드에서 돈다)
function ordered(p: Pos, ms: Move[]): Move[] { return ms.map((m) => ({ m, k: (m.capt ? VALUE[typeOf(m.capt)] * 10 - VALUE[typeOf(m.piece)] / 10 : 0) + (m.promo ? 800 : 0) })).sort((a, c) => c.k - a.k).map((x) => x.m); }
function quiesce(p: Pos, alpha: number, beta: number, n: { c: number }, depth = 0): number {
  const sign = p.turn === 'w' ? 1 : -1, stand = sign * evaluate(p.b);
  if (stand >= beta || depth > 4 || n.c > NODE_CAP) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of ordered(p, legalMoves(p).filter((x) => x.capt || x.promo))) { n.c++; const v = -quiesce(play(p, m), -beta, -alpha, n, depth + 1); if (v >= beta) return v; if (v > alpha) alpha = v; }
  return alpha;
}
function negamax(p: Pos, depth: number, alpha: number, beta: number, n: { c: number }, ply: number): number {
  const ms = legalMoves(p);
  if (ms.length === 0) return inCheck(p) ? -100000 + ply : 0;
  if (depth <= 0) return quiesce(p, alpha, beta, n);
  let best = -Infinity;
  for (const m of ordered(p, ms)) { n.c++; const v = -negamax(play(p, m), depth - 1, -beta, -alpha, n, ply + 1); if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta || n.c > NODE_CAP * 2) break; }
  return best;
}
/** 인물이 둘 수. rng 는 시험용으로 바꿀 수 있다. */
export function chooseMove(p: Pos, st: Style, rng: () => number = Math.random): Move | null {
  const ms = legalMoves(p); if (!ms.length) return null;
  const n = { c: 0 };
  const scored = ordered(p, ms).map((m) => {
    const q = play(p, m); let v = -negamax(q, st.depth - 1, -Infinity, Infinity, n, 1);
    if (st.aggr && (m.capt || inCheck(q))) v += 25 * st.aggr; // 공격적인 인물: 잡고 체크하는 수를 좋아함
    if (st.caution && typeOf(m.piece) === 'K' && !m.castle) v -= 20 * st.caution; // 신중한 인물: 괜히 왕을 움직이지 않음
    return { m, v: v + (rng() - 0.5) * 8 }; // 같은 점수면 매번 같은 수가 되지 않게
  }).sort((a, c) => c.v - a.v);
  if (rng() < st.blunder && scored.length > 1) { // 사람 같은 실수: 상위 몇 수 중 하나, 아주 드물게 아무 수
    const pool = rng() < 0.2 ? scored : scored.slice(1, Math.min(scored.length, 4));
    return pool[Math.floor(rng() * pool.length)].m;
  }
  return scored[0].m;
}

// ---------------- 판 상황 풀어 쓰기 (AI 프롬프트용, 영어) ----------------
export interface ChessEvent { ply: number; by: 'player' | 'them'; san: string; capt?: PieceType; promo?: PieceType; check?: boolean; mate?: boolean; castle?: boolean }
const PIECE_EN: Record<PieceType, string> = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
export const pieceEn = (t: PieceType): string => PIECE_EN[t];
/** 판이 끝났을 때 이름(영어, 프롬프트·기록용). */
export const STATUS_EN: Record<Status, string> = { play: 'in progress', checkmate: 'checkmate', stalemate: 'stalemate (draw)', fifty: 'draw by the fifty-move rule', repetition: 'draw by threefold repetition', material: 'draw by insufficient material' };

/** 지금 판을 사람 말로(영어). me = 인물 쪽 색. 기보 전체는 넘기지 않는다. */
export function boardStory(p: Pos, ev: ChessEvent[], me: Color, oppName: string, leaderName = 'the leader'): string {
  const you = other(me), lead = material(p.b, me) - material(p.b, you);
  const plies = ev.length, last = ev.slice(-8);
  const ago = (e: ChessEvent) => { const d = plies - e.ply; return d === 0 ? 'just now' : d === 1 ? '1 move ago' : `${d} moves ago`; };
  const who = (e: ChessEvent) => (e.by === 'them' ? 'you' : leaderName);
  const lines: string[] = [];
  lines.push(`[The chess game you are playing right now] You (${oppName}) play ${me === 'w' ? 'White' : 'Black'}; ${leaderName} plays ${you === 'w' ? 'White' : 'Black'}. Move ${p.full}, ${plies} half-moves so far.`);
  lines.push(`Material: ${lead === 0 ? 'even' : lead > 0 ? `you are ahead by about ${Math.round(lead / 100)} pawn(s) worth` : `${leaderName} is ahead by about ${Math.round(-lead / 100)} pawn(s) worth`}.`);
  const lost = (c: Color) => { const start: Record<PieceType, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1 }; const now: Record<string, number> = {}; for (const x of p.b) if (x && colorOf(x) === c) now[typeOf(x)] = (now[typeOf(x)] ?? 0) + 1; return (['Q', 'R', 'B', 'N', 'P'] as PieceType[]).map((t) => { const k = start[t] - (now[t] ?? 0); return k > 0 ? `${k} ${PIECE_EN[t]}${k > 1 ? 's' : ''}` : ''; }).filter(Boolean).join(', '); };
  lines.push(`Pieces you have lost: ${lost(me) || 'none'}. Pieces ${leaderName} has lost: ${lost(you) || 'none'}.`);
  const notable = last.filter((e) => e.capt || e.check || e.mate || e.promo || e.castle);
  if (notable.length) lines.push('Recent notable moments:\n' + notable.map((e) => `- ${ago(e)}: ${who(e)} ${e.mate ? 'delivered checkmate' : e.capt ? `took a ${PIECE_EN[e.capt]}` : e.promo ? `promoted a pawn to a ${PIECE_EN[e.promo]}` : e.castle ? 'castled' : 'moved'}${e.check && !e.mate ? ' with check' : ''} (${e.san})`).join('\n'));
  if (last.length) lines.push(`Last moves: ${last.map((e) => `${e.by === 'them' ? 'you' : 'leader'} ${e.san}`).join(', ')}.`);
  const st = statusOf(p);
  lines.push(st !== 'play' ? `The game is over: ${STATUS_EN[st]}.` : `It is ${p.turn === me ? 'your' : `${leaderName}'s`} turn.${inCheck(p) ? ` ${p.turn === me ? 'You are' : `${leaderName} is`} in check.` : ''}`);
  lines.push('Only refer to what is described above about the board; never invent moves or pieces. Talk like you are sitting across the board, briefly.');
  return lines.join('\n');
}
