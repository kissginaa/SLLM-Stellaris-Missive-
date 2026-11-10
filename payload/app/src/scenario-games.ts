// 시나리오 「화합 대회」(순수 규칙, 2026-11-06 사용자: 「올림픽·월즈는 이벤트처럼 따로 개설 — 우리가 제안해야, 초청 같은 거」).
// 회랑의 삼파전에는 은하 공동체가 없으니(게임이 설립을 막는다) 올림픽·월즈가 저절로 열리지 않는다. 대신 우리가 다른 두 자리를 초청해 연다.
//   우리 = 개최국(투표 없음, 개최 준비는 우주 경기장에서 본편 그대로). 초청받은 나라는 앱이 받아들일지 정한다(같은 세이브·같은 해면 늘 같은 답).
//   두 거대 세력이 함께 오면 긴장이 내려가고, 한쪽이 보이콧하면 오히려 오른다. 한 번에 대회 하나만, 같은 대회는 쉬는 해가 지나야 다시.
// 앱: src/features/scenario-games-app.ts · 경기·개최 준비: src/features/log-app.ts(scnHostGames) · 화면: ui/office-games.js(집무실 「회랑의 삼파전」 칸)
export type GamesKind = 'oly' | 'worlds';
export type GSide = 'a' | 'b' | 'p';
export interface GameCostG { energy?: number; influence?: number }

export const GAMES = {
  cost: { oly: { influence: 150, energy: 1500 }, worlds: { influence: 80, energy: 800 } } as Record<GamesKind, GameCostG>,
  rest: { oly: 8, worlds: 4 } as Record<GamesKind, number>, // 대회가 열린(열기로 한) 해부터 쉬는 해
  retry: 1,                          // 모두 거절하면 1년 뒤에 다시
  maxStage: 3,                       // 긴장 단계 3(동원)까지만 초청할 수 있다. 4 일촉즉발 · 5 개전 명분이면 아무도 오지 않는다
  base: { a: 0.85, b: 0.55, p: 0.8 } as Record<GSide, number>, // 얼라이언스는 잘 오고, 제국은 체면 때문에 망설인다
  perStage: 0.1, abWar: 0.3,         // 긴장 단계마다 −10%p · 두 거대 세력이 전쟁 중이면 −30%p
  weight: { a: 500, b: 500, p: 150 } as Record<GSide, number>, // 경기 전력(본편 회원국 국력 자리)
  tension: { together: -6, boycott: 2 }, // 두 거대 세력이 한자리에 = −6 · 한쪽만 오면 +2
  keepLog: 30,
};

export interface GamesSave { v: 1; held: Partial<Record<GamesKind, number>>; tried: Partial<Record<GamesKind, number>>; log: Array<{ y: number; kind: GamesKind; came: GSide[]; refused: GSide[] }> }
export const newGamesSave = (): GamesSave => ({ v: 1, held: {}, tried: {}, log: [] });
export function fixGamesSave(o: unknown): GamesSave {
  const s = (o && typeof o === 'object' ? o : {}) as Partial<GamesSave>, out = newGamesSave();
  const yrs = (x: unknown) => { const r: Partial<Record<GamesKind, number>> = {}; if (x && typeof x === 'object') for (const k of ['oly', 'worlds'] as GamesKind[]) { const v = Number((x as Record<string, unknown>)[k]); if (Number.isInteger(v) && v > 0) r[k] = v; } return r; };
  out.held = yrs(s.held); out.tried = yrs(s.tried);
  const sides = (x: unknown) => (Array.isArray(x) ? x.filter((v) => v === 'a' || v === 'b' || v === 'p') as GSide[] : []);
  if (Array.isArray(s.log)) out.log = s.log.filter((l) => l && Number.isInteger(Number(l.y)) && (l.kind === 'oly' || l.kind === 'worlds')).map((l) => ({ y: Number(l.y), kind: l.kind, came: sides(l.came), refused: sides(l.refused) })).slice(-GAMES.keepLog);
  return out;
}

/** 초청받는 자리: 우리 자리를 뺀 나머지(시나리오 좌석 a·b·p). */
export const guestSides = (seat: string): GSide[] => (['a', 'b', 'p'] as GSide[]).filter((x) => x !== seat);

export interface InviteCtx { year: number; seat: string; stage: number; abWar: boolean; warWithUs: Partial<Record<GSide, boolean>>; busy: boolean; known: Partial<Record<GSide, boolean>> }
/** 지금 이 대회에 초청장을 보낼 수 있나. 안 되면 까닭 코드(문구는 앱이 L(한, 영)으로 — 언어 팩이 모을 수 있게)와 다시 열 수 있는 해. */
export type InviteBlock = 'busy' | 'unknown' | 'tension' | 'rest' | 'declined';
export function canInvite(sv: GamesSave, kind: GamesKind, c: InviteCtx): { ok: true } | { ok: false; why: InviteBlock; from?: number } {
  if (c.busy) return { ok: false, why: 'busy' };
  if (!guestSides(c.seat).some((x) => c.known[x])) return { ok: false, why: 'unknown' };
  if (c.stage > GAMES.maxStage) return { ok: false, why: 'tension' };
  const h = sv.held[kind]; if (h && c.year < h + GAMES.rest[kind]) return { ok: false, why: 'rest', from: h + GAMES.rest[kind] };
  const t = sv.tried[kind]; if (t && c.year < t + GAMES.retry) return { ok: false, why: 'declined', from: t + GAMES.retry };
  return { ok: true };
}

function hash01(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }
/** 받아들일 확률(화면 예상용으로도 씀). 우리와 전쟁 중이면 0. */
export function acceptChance(side: GSide, c: Pick<InviteCtx, 'stage' | 'abWar' | 'warWithUs'>): number {
  if (c.warWithUs[side]) return 0;
  let p = GAMES.base[side] - GAMES.perStage * Math.max(0, c.stage);
  if (c.abWar && side !== 'p') p -= GAMES.abWar;
  return Math.max(0, Math.min(0.95, p));
}
/** 확률을 화면 말 단계로(숫자를 그대로 보이지 않는다). */
export type ChanceWord = 'none' | 'likely' | 'even' | 'hard';
export const chanceWord = (p: number): ChanceWord => (p <= 0 ? 'none' : p >= 0.7 ? 'likely' : p >= 0.4 ? 'even' : 'hard');
/** 초청 결과(같은 세이브·대회·해면 같은 답). */
export function decideGuests(sid: string, kind: GamesKind, c: InviteCtx): { came: GSide[]; refused: GSide[] } {
  const came: GSide[] = [], refused: GSide[] = [];
  for (const x of guestSides(c.seat)) { if (!c.known[x]) continue; (hash01(`${sid}:scngames:${kind}:${c.year}:${x}`) < acceptChance(x, c) ? came : refused).push(x); }
  return { came, refused };
}
/** 긴장 변화: 두 거대 세력이 모두 오면 내려가고, 거대 세력 하나만 오면 오른다(우리가 거대 세력이면 상대가 오는지만 본다). */
export function tensionDelta(seat: string, came: GSide[], refused: GSide[]): number {
  const big = (x: GSide) => x === 'a' || x === 'b';
  const bigCame = came.filter(big).length + (big(seat as GSide) ? 1 : 0), bigRefused = refused.filter(big).length;
  if (bigCame >= 2) return GAMES.tension.together;
  if (bigCame === 1 && bigRefused >= 1) return GAMES.tension.boycott;
  return 0;
}
/** 대회 날짜: 올림픽은 다음 해 6월, 월즈는 올해 12월(8월이 지났으면 다음 해 12월) — 개최 준비할 시간을 남긴다. */
export function eventYear(kind: GamesKind, y: number, m: number): number { return kind === 'oly' ? y + 1 : m <= 8 ? y : y + 1; }
export function recordInvite(sv: GamesSave, kind: GamesKind, y: number, came: GSide[], refused: GSide[], held: number | null): void {
  if (held !== null) sv.held[kind] = held; else sv.tried[kind] = y;
  sv.log.push({ y, kind, came, refused }); if (sv.log.length > GAMES.keepLog) sv.log.splice(0, sv.log.length - GAMES.keepLog);
}
