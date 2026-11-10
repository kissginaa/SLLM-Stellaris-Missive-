// 은하 월드 챔피언십 대진·경기 계산(2026-10-30). 앱 본체를 멈추지 않도록 작업 스레드에서 돈다(같은 씨앗이면 어디서 돌려도 같은 결과).
// 방식(사용자 결정, 롤 월즈식 + 참가 수에 맞춘 크기):
//   22팀 이상: 플레이인 8팀(단판 → 3판 2선승, 2팀 진출) → 본선 16팀 스위스(3승 진출·3패 탈락) → 8강부터 5판 3선승
//   12~21팀: 플레이인 없이 모두 스위스(16팀 이상이면 3승·3패, 아래면 2승·2패) → 진출 8팀(모자라면 전적 순으로 채움) → 8강부터 5판 3선승
//   6~11팀: 조별 풀리그(단판) → 상위 4팀 4강·결승 5판 3선승
//   스위스 1라운드는 시드끼리 짝(1시드 ↔ 낮은 시드) — 높은 시드의 이점.
import { parentPort, workerData } from 'worker_threads';
import { type Role, type TeamDef, type Strategy, seeded, hashSeed, playOut, ENGINE } from './log-game';
import { type Player, type MetaState, autoDraft, conditions, teamDef, patchedMods } from './log-club';

export interface WTeam { name: string; region: string; ours: boolean; seed: number; teamId?: string; /** 회원국 구단의 나라(sllm_idx, LoG ↔ 나라 연동) */ nation?: number; logo?: { e: number; s: number; p: number; c: number }; lineup: Record<Role, Player>; strat: Strategy; gear: number }
export interface WGame { seed: number; defs: [TeamDef, TeamDef]; winner: 0 | 1; kills: [number, number]; eng?: number }
export interface WSeries { a: number; b: number; bo: number; games: WGame[]; winner: number; stage: string; /** 전쟁 중인 나라와의 경기를 우리가 거부(기권패) */ forfeit?: true }
export type WFormat = 'full' | 'swiss' | 'groups';
export interface Worlds { year: number; format: WFormat; teams: WTeam[]; series: WSeries[]; swiss: Record<number, [number, number]>; group: Record<number, [number, number]>; champion: number; runner: number; semis: number[]; quarters: number[]; /** 앱이 한 달에 한 단계씩 공개(없으면 다 공개된 옛 기록) */ shown?: number; at?: string }
export interface WorldsInput { sid: string; year: number; teams: WTeam[]; playin: number[]; pool: string[]; meta?: MetaState; /** 전쟁 중이라 우리 구단이 경기를 거부할 나라(sllm_idx) — 만나면 기권패(2026-10-31) */ refuse?: number[] }

export function formatFor(n: number): WFormat { return n >= 22 ? 'full' : n >= 12 ? 'swiss' : 'groups'; }

export function runBracket(inp: WorldsInput): Worlds {
  const { sid, year } = inp, W: Worlds = { year, format: formatFor(inp.teams.length), teams: inp.teams, series: [], swiss: {}, group: {}, champion: -1, runner: -1, semis: [], quarters: [] };
  const r = seeded(hashSeed(`${sid}:worlds:${year}:bracket`)), shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mods = (w: string) => patchedMods(inp.meta, w);
  const series = (a: number, b: number, bo: number, stage: string): number => {
    const TA = W.teams[a], TB = W.teams[b], refused = (x: WTeam, y: WTeam) => x.ours && !y.ours && y.nation !== undefined && !!inp.refuse?.includes(y.nation);
    if (refused(TA, TB) || refused(TB, TA)) { const winner = refused(TA, TB) ? b : a; W.series.push({ a, b, bo, games: [], winner, stage, forfeit: true }); return winner; }
    const need = Math.ceil(bo / 2), wins = [0, 0], games: WGame[] = [];
    for (let g = 0; wins[0] < need && wins[1] < need; g++) {
      const seed = hashSeed(`${sid}:worlds:${year}:${W.series.length}:${g}`), rr = seeded(seed ^ 0x1234567), A = W.teams[a], B = W.teams[b], d = autoDraft(A.lineup, B.lineup, rr, inp.pool);
      const defs: [TeamDef, TeamDef] = [teamDef(`w${a}`, A.name, A.lineup, d.picks[0], A.strat, { big: true }, { mods, conds: conditions(A.lineup, rr), foe: d.picks[1], side: 0, gear: A.gear }), teamDef(`w${b}`, B.name, B.lineup, d.picks[1], B.strat, { big: true }, { mods, conds: conditions(B.lineup, rr), foe: d.picks[0], side: 1, gear: B.gear })];
      const res = playOut(defs[0], defs[1], seed); wins[res.winner]++; games.push({ seed, defs, winner: res.winner, kills: res.kills, eng: ENGINE });
    }
    const winner = wins[0] > wins[1] ? a : b; W.series.push({ a, b, bo, games, winner, stage }); return winner;
  };
  const knockout = (top: number[]) => { // top: 성적 순 8팀 또는 4팀
    let semi: number[];
    if (top.length >= 8) { W.quarters = top.slice(0, 8); semi = [[0, 7], [3, 4], [1, 6], [2, 5]].map(([x, y]) => series(top[x], top[y], 5, 'quarter')); }
    else semi = [top[0], top[3], top[1], top[2]];
    W.semis = semi.slice(); const f = [series(semi[0], semi[1], 5, 'semi'), series(semi[2], semi[3], 5, 'semi')];
    W.champion = series(f[0], f[1], 5, 'final'); W.runner = W.champion === f[0] ? f[1] : f[0];
  };
  const all = inp.teams.map((_, i) => i);
  if (W.format === 'groups') {
    for (const t of all) W.group[t] = [0, 0];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const w = series(all[i], all[j], 1, 'group'), l = w === all[i] ? all[j] : all[i]; W.group[w][0]++; W.group[l][1]++; }
    const ord = all.slice().sort((x, y) => W.group[y][0] - W.group[x][0] || W.teams[x].seed - W.teams[y].seed);
    knockout(ord.slice(0, 4)); return W;
  }
  let main = all;
  if (W.format === 'full') { // 플레이인
    let pin = shuffle(inp.playin.slice());
    while (pin.length > 2) { const next: number[] = [], bo = pin.length > 4 ? 1 : 3; for (let i = 0; i + 1 < pin.length; i += 2) next.push(series(pin[i], pin[i + 1], bo, 'playin')); if (pin.length % 2) next.push(pin[pin.length - 1]); pin = next; }
    main = [...all.filter((t) => !inp.playin.includes(t)), ...pin];
  }
  const th = main.length >= 16 ? 3 : 2;
  for (const t of main) W.swiss[t] = [0, 0];
  const bye = new Set<number>();
  for (let round = 0; round < 2 * th + 1; round++) {
    const live = main.filter((t) => W.swiss[t][0] < th && W.swiss[t][1] < th); if (live.length < 2) break;
    if (main.filter((t) => W.swiss[t][0] >= th).length >= 8) break;
    const pairs: Array<[number, number]> = [];
    // 줄 세우기: 1라운드는 시드 순, 그다음은 전적 좋은 순(같은 전적끼리는 섞음). 홀수면 아직 쉰 적 없는 맨 뒤 팀이 한 번 쉼(승패 없음).
    const line = round === 0 ? shuffle(live.slice()).sort((x, y) => W.teams[x].seed - W.teams[y].seed) : shuffle(live.slice()).sort((x, y) => W.swiss[y][0] - W.swiss[x][0] || W.swiss[x][1] - W.swiss[y][1]);
    if (line.length % 2) { let k = line.length - 1; while (k > 0 && bye.has(line[k])) k--; bye.add(line[k]); line.splice(k, 1); }
    if (round === 0) while (line.length >= 2) pairs.push([line.shift()!, line.pop()!]); // 높은 시드 ↔ 낮은 시드
    else for (let i = 0; i + 1 < line.length; i += 2) pairs.push([line[i], line[i + 1]]);
    for (const [a, b] of pairs) { const [w, l] = W.swiss[a], bo = w === th - 1 || l === th - 1 ? 3 : 1, win = series(a, b, bo, `swiss${round + 1}`), lose = win === a ? b : a; W.swiss[win][0]++; W.swiss[lose][1]++; }
  }
  const rank = (x: number, y: number) => W.swiss[y][0] - W.swiss[x][0] || W.swiss[x][1] - W.swiss[y][1] || W.teams[x].seed - W.teams[y].seed;
  knockout(main.slice().sort(rank).slice(0, 8));
  return W;
}

// 작업 스레드로 실행됐을 때
if (parentPort && workerData?.logWorlds) {
  try { parentPort.postMessage({ ok: true, worlds: runBracket(workerData.logWorlds as WorldsInput) }); }
  catch (e) { parentPort.postMessage({ ok: false, error: String((e as Error)?.message || e) }); }
}
