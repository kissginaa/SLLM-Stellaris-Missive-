// 레전드 오브 갤럭시(Legend of Galaxy) 경기 엔진(2026-10-30 사용자 결정, 계획 12번). 순수 모듈(전자·파일·게임 없음).
// 경기장 한가운데 증강현실로 띄운 전장: 길 3갈래(위·가운데·아래), 팀마다 길당 방어탑 2개 + 「핵」, 가운데 아래쪽에 중립 괴수 「심연 수호자」.
// 양 팀 5명(위·숲·가운데·아래·지원)이 단순한 규칙으로 움직인다. 같은 씨앗(seed)이면 언제 돌려도 같은 경기(다시 보기 = 같은 결과).
// 좌표는 0~100 정사각형. 파랑 기지 (8,92), 빨강 기지 (92,8). 그림(맵·초상화)은 나중에 AI 그림으로 바꿔 끼움.

export type Side = 0 | 1; // 0 파랑, 1 빨강
export type Lane = 0 | 1 | 2; // 위·가운데·아래
export type Role = 'top' | 'jungle' | 'mid' | 'bot' | 'support';
export const ROLES: Role[] = ['top', 'jungle', 'mid', 'bot', 'support'];
/** 고른 무기(증강현실 무기)의 성질: 공격·방어·밀기·괴수 사냥 배율(1 = 보통). 선수 실력이 더 크게 작용하고 무기는 보탬(2026-10-30 사용자 결정: 영웅 대신 무기). */
export interface WeaponMods { atk: number; def: number; push: number; obj: number }
/** tr = 경기 중에 작용하는 특성(2026-10-30 팀파이트 매니저 참고): late 대기만성, fader 용두사미, vanguard 선봉장, bloodlust 피 냄새, ironskin 강철피부, coward 바퀴벌레. */
export interface PlayerDef { name: string; role: Role; skill: number; weapon?: string; mods?: WeaponMods; uk?: string; // uk = 무기 성향(궁극기 종류)
  tr?: string[]; cond?: number } // cond = 오늘 컨디션(화면 표시용)
/** 이벤트 매치(올스타전) 특수 규칙: 배율·핵 체력·수호자 간격·큰 한 방 배율. 리그 경기는 없음(기본값). */
export interface Rules { atk?: number; def?: number; speed?: number; coreHp?: number; objEvery?: number; crit?: number; v?: number }
/** 경기 엔진 판(2026-10-31): 2 = 「성운 거신」 추가·수호자 가호 강화. 그 전에 치른 경기는 v 없이 저장돼 있어 v: 1로 다시 봄(다시 보기 = 같은 결과). */
export const ENGINE = 6; // 6 = 이변(2026-10-31): 경기마다 선수 컨디션 흔들림 · 뒤지는 팀 역전 보정 · 큰 한 방 변동 ↑ (강팀 승률 97% → 85% 안팎)
// 5 // 5 = 정글 몹(2026-10-31): 숲마다 몹 진영 3곳씩, 정글러가 잡아 경험치·체력을 얻고 없을 때만 갱킹
// 4 // 4 = 무기 궁극기(레벨 6부터) · 빨피면 귀환해서 풀피로 복귀, 적이 붙어 있으면 끝까지 싸움(2026-10-31)
// 3 // 3 = 경기 안 레벨(2026-10-31): 처치·병사·탑·괴수·시간으로 경험치 → 레벨마다 공격·버팀·밀기 강화
/** 경기 전략: aggr −1(후반 운영)~1(초반 공세), obj 0~1(심연 수호자 집중). */
export interface Strategy { aggr: number; obj: number }
export interface TeamDef { id: string; name: string; players: PlayerDef[]; strat?: Strategy }
export type EvKind = 'first_blood' | 'kill' | 'tower' | 'objective' | 'ace' | 'core' | 'start' | 'inhib' | 'boss' | 'ult';
export interface GameEvent { t: number; kind: EvKind; side: Side; who?: string; victim?: string; lane?: Lane; u?: string } // u = 궁극기 종류
export interface Hero { side: Side; role: Role; name: string; weapon: string; skill: number; m: WeaponMods; tr: string[]; x: number; y: number; hp: number; dead: number; kills: number; deaths: number; xp: number; lv: number; form: number; uk: string; ucd: number; ua: number; um: number; sh: number; stun: number; rc: number } // 궁극기: ucd 대기, ua·um 강화 틱·배율, sh 보호막 틱, stun 기절 틱, rc 귀환 남은 틱
export interface Wave { side: Side; lane: Lane; p: number; n: number }
/** 관람 화면용 효과(경기 결과에는 영향 없음 — 난수를 더 쓰지 않음). a = 때린 영웅 번호(탑이면 -1-탑번호), b = 맞은 영웅 번호 또는 'tower'/'core'/'obj'/'wave' 와 그 번호. */
export interface Fx { a: number; b: number; // 'obj'는 b = 0 수호자, 1 성운 거신 · 'ult'는 b = 궁극기 종류 번호(ULT_KINDS) · 'stun'·'recall'은 a = 영웅
  k: 'hit' | 'crit' | 'shot' | 'tower' | 'core' | 'obj' | 'wave' | 'ult' | 'stun' | 'recall' }
/** heroes: [x, y, hp, side, 부활까지 남은 틱, 킬, 데스, 레벨, 궁극기(−1 잠김 · 0 준비 · n 남은 틱)]. */
export interface Frame { t: number; heroes: Array<[number, number, number, number, number, number, number, number, number]>; fx: Fx[]; waves: Array<[number, number, number, number]>; towers: number[]; cores: [number, number]; obj: [number, number]; kills: [number, number]; buff: [number, number]; fin?: [number, number]; boss?: [number, number]; bb?: [number, number]; camps?: number[] }
export interface GameState {
  t: number; rng: () => number; rules: Rules; heroes: Hero[]; strat: [Strategy, Strategy]; waves: Wave[]; towers: number[]; cores: [number, number]; obj: { alive: boolean; hp: number; next: number; by: [number, number] };
  buff: [number, number]; kills: [number, number]; events: GameEvent[]; done: boolean;
  /** 성운 거신(엔진 2): 잡은 팀은 한동안 병사가 커지고 탑·핵을 두 배로 부숨(경기를 끝내는 괴수). bb = 거신 가호 남은 틱. */
  boss: { alive: boolean; hp: number; next: number; by: [number, number] }; bb: [number, number];
  /** 정글 몹(엔진 5): 진영마다 남은 체력(0 = 비었음)과 다시 나오는 틱. cb = 큰 진영 가호(정글러 공격 +10%) 남은 틱. */
  camps: Array<{ hp: number; next: number }>; cb: [number, number]; winner?: Side; firstBlood: boolean; fx: Fx[];
  /** 마지막 돌격(2026-10-31): 승패는 이미 정해졌고, 이긴 팀이 진짜로 핵에 가서 부수는 장면. 난수를 쓰지 않아 결과(승자·킬)는 그대로. */
  fin?: { left: number; loser: Side; hp: number };
}

export const LOG = { ticks: 1500, cap: 1900, waveEvery: 30, waveN: 4, waveSpeed: 0.0125, towerHp: 100, coreHp: 160, objHp: 60, objFirst: 300, finale: 60, campFirst: 40, campEvery: 100, campBuff: 60, maxLv: 18, bossHp: 150, bossFirst: 600, bossEvery: 420, bossTicks: 220, buffTicks2: 200, objEvery: 330, buffTicks: 140, respawnBase: 18, heroRange: 9, towerRange: 9 } as const;
const BASE: Array<[number, number]> = [[8, 92], [92, 8]];
/** 길 위 위치 p(0 = 파랑 기지, 1 = 빨강 기지) → 좌표. */
export function lanePos(lane: Lane, p: number): [number, number] {
  const q = Math.max(0, Math.min(1, p));
  if (lane === 1) return [8 + 84 * q, 92 - 84 * q];
  const corner: [number, number] = lane === 0 ? [8, 8] : [92, 92];
  if (q < 0.5) { const k = q / 0.5; return [8 + (corner[0] - 8) * k, 92 + (corner[1] - 92) * k]; }
  const k = (q - 0.5) / 0.5; return [corner[0] + (92 - corner[0]) * k, corner[1] + (8 - corner[1]) * k];
}
/** 탑 6개씩: 순서 [파랑 위1,위2, 가운데1,2, 아래1,2, 빨강 위1,위2, …]. 1 = 바깥 탑. */
export const TOWER_P = [0.36, 0.2, 0.64, 0.8] as const;
export const towerIndex = (side: Side, lane: Lane, inner: 0 | 1) => side * 6 + lane * 2 + inner;
export const towerPos = (side: Side, lane: Lane, inner: 0 | 1): [number, number] => lanePos(lane, side === 0 ? TOWER_P[inner] : TOWER_P[2 + inner]);
export const OBJ: [number, number] = [66, 66];
export const BOSS: [number, number] = [34, 34]; // 성운 거신: 강 건너 반대편(엔진 2)
/** 정글 몹 진영(엔진 5): 0~2 파랑 숲, 3~5 빨강 숲(파랑 숲을 가운데 기준으로 뒤집은 자리). [x, y, 체력, 경험치]. 마지막은 큰 진영(잡으면 잠깐 공격 +10%). */
export const CAMPS: Array<[number, number, number, number]> = [[22, 62, 24, 38], [40, 80, 24, 38], [44, 60, 40, 60], [78, 38, 24, 38], [60, 20, 24, 38], [56, 40, 40, 60]];
const LANE_OF: Record<Role, Lane | -1> = { top: 0, jungle: -1, mid: 1, bot: 2, support: 2 };

/** 씨앗 고정 난수(같은 씨앗 → 같은 경기). */
export function seeded(seed: number): () => number { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function newGame(a: TeamDef, b: TeamDef, seed: number, rules: Rules = {}): GameState {
  const heroes: Hero[] = [];
  for (const [side, t] of [[0, a], [1, b]] as Array<[Side, TeamDef]>) for (const r of ROLES) { const p = t.players.find((x) => x.role === r) ?? { name: r, role: r, skill: 50 }; heroes.push({ side, role: r, name: p.name, weapon: p.weapon ?? '', tr: p.tr ?? [], skill: Math.max(20, Math.min(99, p.skill)), m: p.mods ?? { atk: 1, def: 1, push: 1, obj: 1 }, x: BASE[side][0], y: BASE[side][1], hp: 100, dead: 0, kills: 0, deaths: 0, xp: 0, lv: 1, form: 1, uk: p.uk ?? kindOf(p.mods), ucd: 0, ua: 0, um: 1, sh: 0, stun: 0, rc: 0 }); }
  const st = (x?: Strategy): Strategy => ({ aggr: Math.max(-1, Math.min(1, x?.aggr ?? 0)), obj: Math.max(0, Math.min(1, x?.obj ?? 0.5)) });
  const core = rules.coreHp ?? LOG.coreHp, rng = seeded(seed);
  if ((rules.v ?? ENGINE) >= 6) for (const h of heroes) h.form = 0.82 + rng() * 0.36; // 오늘 컨디션(0.82~1.18) — 같은 씨앗이면 같음
  return { t: 0, rng, rules, heroes, strat: [st(a.strat), st(b.strat)], waves: [], towers: Array(12).fill(LOG.towerHp), cores: [core, core], obj: { alive: false, hp: LOG.objHp, next: LOG.objFirst, by: [0, 0] }, buff: [0, 0], kills: [0, 0], events: [{ t: 0, kind: 'start', side: 0 }], done: false, firstBlood: false, fx: [], boss: { alive: false, hp: LOG.bossHp, next: LOG.bossFirst, by: [0, 0] }, bb: [0, 0], camps: CAMPS.map(() => ({ hp: 0, next: LOG.campFirst })), cb: [0, 0] };
}
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
/** 경기 중 특성 배율(난수 없음): 대기만성은 시간이 갈수록, 용두사미는 처음에, 선봉장은 우리 팀 첫 킬 전까지, 피 냄새는 자기 킬마다. */
/** 경기 안 레벨(엔진 3). 엔진 2 이하 경기는 레벨 없음(배율 1, 경험치도 안 쌓임 → 옛 경기 다시 보기 그대로). */
const V3 = (g: GameState) => (g.rules.v ?? ENGINE) >= 3;
const V4 = (g: GameState) => (g.rules.v ?? ENGINE) >= 4;
const V5 = (g: GameState) => (g.rules.v ?? ENGINE) >= 5;
const V6 = (g: GameState) => (g.rules.v ?? ENGINE) >= 6;
/** 역전 보정(엔진 6): 킬·탑에서 많이 뒤진 팀은 공격 +, 경험치 +(롤의 현상금처럼). */
function behind(g: GameState, s: Side): number { if (!V6(g)) return 0; const o = (1 - s) as Side, tw = (x: Side) => g.towers.filter((v, i) => v <= 0 && (i < 6 ? 0 : 1) === x).length; const d = (g.kills[o] - g.kills[s]) + (tw(s) - tw(o)) * 2; return d >= 3 ? Math.min(0.25, 0.04 * (d - 1)) : 0; }
/** 궁극기 종류 = 무기 성향(A 공격 난사 · X 폭발 처형 · D 방어 보호막 · T 탱커 기절 · P 밀기 공성 · O 사냥 강타 · B 균형 회복). */
export const ULT_KINDS = ['A', 'X', 'D', 'T', 'P', 'O', 'B'] as const;
export const ULT_LV = 6;
/** 무기 성향을 모를 때(옛 기록) 배율로 짐작. */
function kindOf(m?: WeaponMods): string { if (!m) return 'B'; if (m.obj >= 1.1) return 'O'; if (m.push >= 1.1) return 'P'; if (m.def >= 1.14) return 'T'; if (m.def >= 1.08) return 'D'; if (m.atk >= 1.14) return 'X'; if (m.atk >= 1.08) return 'A'; return 'B'; }
export const xpNeed = (lv: number): number => 60 + 30 * (lv - 1); // 다음 레벨까지
const lvAtk = (g: GameState, h: Hero) => (V3(g) ? 1 + 0.045 * (h.lv - 1) : 1), lvDef = (g: GameState, h: Hero) => (V3(g) ? 1 + 0.03 * (h.lv - 1) : 1), lvPush = (g: GameState, h: Hero) => (V3(g) ? 1 + 0.035 * (h.lv - 1) : 1);
function gainXp(g: GameState, h: Hero, x: number): void {
  if (!V3(g)) return; h.xp += x;
  while (h.lv < LOG.maxLv && h.xp >= xpNeed(h.lv)) { h.xp -= xpNeed(h.lv); h.lv++; if (h.hp > 0) h.hp = Math.min(100, h.hp + 8); }
  if (h.lv >= LOG.maxLv) h.xp = 0;
}
function traitMul(g: GameState, h: Hero): number {
  if (!h.tr.length) return 1; let m = 1; const k = Math.min(1, g.t / 1500);
  if (h.tr.includes('late')) m *= 0.9 + 0.25 * k; if (h.tr.includes('fader')) m *= 1.12 - 0.25 * k;
  if (h.tr.includes('vanguard') && g.kills[h.side] === 0) m *= 1.1; if (h.tr.includes('bloodlust')) m *= 1 + Math.min(0.2, h.kills * 0.02);
  return m;
}
/** 매 틱 움직이는 순서를 섞는다(먼저 움직이는 쪽이 늘 유리하지 않게). */
function order<T>(a: T[], R: () => number): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function stepTo(h: Hero, x: number, y: number, speed: number): void { const d = dist(h.x, h.y, x, y); if (d <= speed) { h.x = x; h.y = y; return; } h.x += ((x - h.x) / d) * speed; h.y += ((y - h.y) / d) * speed; }
/** 그 길에서 우리 쪽이 지켜야 할 가장 바깥의 살아 있는 탑 위치(p). 없으면 기지 앞. */
function guardP(g: GameState, side: Side, lane: Lane): number { for (const inner of [0, 1] as const) if (g.towers[towerIndex(side, lane, inner)] > 0) return side === 0 ? TOWER_P[inner] : TOWER_P[2 + inner]; return side === 0 ? 0.08 : 0.92; }
/** 길의 최전선(양 팀 병사 무리가 맞붙는 곳). */
function frontP(g: GameState, lane: Lane, side: Side): number {
  const mine = g.waves.filter((w) => w.lane === lane && w.side === side).map((w) => w.p);
  if (!mine.length) return guardP(g, side, lane);
  return side === 0 ? Math.max(...mine) : Math.min(...mine);
}
const laneDone = (g: GameState, side: Side, lane: Lane) => g.towers[towerIndex(side, lane, 0)] <= 0 && g.towers[towerIndex(side, lane, 1)] <= 0;

export function tick(g: GameState): void {
  if (g.done) return;
  if (g.fin) { finale(g); return; }
  const R = g.rng; g.t++; g.fx = [];
  const hi = (h: Hero) => g.heroes.indexOf(h);
  const late = g.t > 700 ? 1 + (g.t - 700) / 350 : 1; // 길어지면 병사가 세져서 끝이 남(약 5분 안팎)
  const hit = [false, false], V2 = (g.rules.v ?? ENGINE) >= 2, bb = (s: Side) => (V2 && g.bb[s] > 0 ? 2 : 1); // bb: 거신 가호면 탑·핵 피해 두 배 // 이번 틱에 누가 실제로 핵을 때렸는지(아니면 마지막 돌격 장면을 보여 줌)
  // 병사 무리
  if (g.t % LOG.waveEvery === 1) for (const side of [0, 1] as Side[]) for (const lane of [0, 1, 2] as Lane[]) g.waves.push({ side, lane, p: side === 0 ? 0.04 : 0.96, n: (LOG.waveN + (g.buff[side] > 0 ? (V2 ? 2 : 1) : 0)) * late * (laneDone(g, (1 - side) as Side, lane) ? 1.8 : 1) * (V2 && g.bb[side] > 0 ? 1.6 : 1) }); // 상대 길의 탑을 다 부순 쪽은 큰 병사
  const loss = new Map<Wave, number>();
  for (const w of order(g.waves, R)) {
    const foe = g.waves.find((o) => o.lane === w.lane && o.side !== w.side && Math.abs(o.p - w.p) < 0.03);
    if (foe) { loss.set(w, (loss.get(w) ?? 0) + 0.035 * foe.n * (0.8 + R() * 0.4)); continue; } // 센 무리가 이긴다(손실은 동시에 반영)
    const enemySide = (1 - w.side) as Side;
    // 앞의 적 탑
    let blocked = false;
    for (const inner of [0, 1] as const) {
      const ti = towerIndex(enemySide, w.lane, inner); if (g.towers[ti] <= 0) continue;
      const tp = enemySide === 0 ? TOWER_P[inner] : TOWER_P[2 + inner];
      if (Math.abs(tp - w.p) < 0.035) { g.towers[ti] -= 0.1 * w.n * bb(w.side); w.n -= 0.05; blocked = true; if (g.towers[ti] <= 0) towerFell(g, w.side, w.lane); break; }
    }
    if (!blocked) {
      const coreP = w.side === 0 ? 0.97 : 0.03;
      if (laneDone(g, enemySide, w.lane) && Math.abs(coreP - w.p) < 0.04) { g.cores[enemySide] -= 0.08 * w.n * bb(w.side); w.n -= 0.04; hit[enemySide] = true; }
      else w.p += (w.side === 0 ? 1 : -1) * LOG.waveSpeed;
    }
  }
  for (const [w, l] of loss) w.n -= l;
  g.waves = g.waves.filter((w) => w.n > 0.05 && w.p > 0 && w.p < 1);
  // 심연 수호자
  if (!g.obj.alive && g.t >= g.obj.next) { g.obj.alive = true; g.obj.hp = LOG.objHp; g.obj.by = [0, 0]; }
  for (const s of [0, 1] as Side[]) if (g.buff[s] > 0) g.buff[s]--;
  if (V2) { if (!g.boss.alive && g.t >= g.boss.next) { g.boss.alive = true; g.boss.hp = LOG.bossHp; g.boss.by = [0, 0]; } for (const s of [0, 1] as Side[]) if (g.bb[s] > 0) g.bb[s]--; }
  // 영웅
  if (V4(g)) for (const h of g.heroes) { if (h.ucd > 0) h.ucd--; if (h.ua > 0) h.ua--; if (h.sh > 0) h.sh--; }
  if (V5(g)) { g.camps.forEach((c, i) => { if (c.hp <= 0 && g.t >= c.next) c.hp = CAMPS[i][2]; }); for (const s of [0, 1] as Side[]) if (g.cb[s] > 0) g.cb[s]--; }
  for (const h of order(g.heroes, R)) {
    if (h.hp <= 0) { if (--h.dead <= 0) { h.hp = 100; h.x = BASE[h.side][0]; h.y = BASE[h.side][1]; h.stun = 0; h.rc = 0; } continue; }
    gainXp(g, h, 0.6); // 살아 있으면 조금씩
    if (V4(g) && h.stun > 0) { h.stun--; continue; } // 기절
    const sp = (1.05 + h.skill / 200) * (g.rules.speed ?? 1);
    const S = g.strat[h.side], early = g.t < 700 ? S.aggr : -S.aggr; // 초반 공세 팀은 초반에 세고 후반에 약간 약함
    if (V4(g)) { // 빨피: 적이 붙어 있으면 끝까지 싸우고(+15%), 없으면 그 자리에서 귀환 → 기지에서 풀피로 다시 출전
      const near = g.heroes.some((o) => o.side !== h.side && o.hp > 0 && dist(o.x, o.y, h.x, h.y) < LOG.heroRange), low = h.hp < (h.tr.includes('coward') ? 40 : 30);
      const atBase = dist(h.x, h.y, BASE[h.side][0], BASE[h.side][1]) < 4;
      if (low && !near && !atBase) { if (h.rc === 0) h.rc = 9; if (--h.rc <= 0) { h.x = BASE[h.side][0]; h.y = BASE[h.side][1]; h.hp = 100; h.rc = 0; } else g.fx.push({ a: hi(h), b: 0, k: 'recall' }); continue; }
      h.rc = 0; if (atBase && h.hp < 100) h.hp = Math.min(100, h.hp + 12);
      if (low && near && h.tr.includes('coward')) { stepTo(h, BASE[h.side][0], BASE[h.side][1], sp); continue; } // 겁쟁이 특성만 도망
      if (useUlt(g, h, near)) hit[(1 - h.side) as Side] = true;
    } else if (h.hp < (h.tr.includes('coward') ? 30 : 16)) { stepTo(h, BASE[h.side][0], BASE[h.side][1], sp); if (dist(h.x, h.y, BASE[h.side][0], BASE[h.side][1]) < 4) h.hp = Math.min(100, h.hp + 6); continue; }
    if (dist(h.x, h.y, BASE[h.side][0], BASE[h.side][1]) < 4 && h.hp < 100) h.hp = Math.min(100, h.hp + 3);
    // 가까운 적 영웅
    const foes = g.heroes.filter((o) => o.side !== h.side && o.hp > 0 && dist(o.x, o.y, h.x, h.y) < LOG.heroRange);
    if (foes.length) {
      const tgt = foes.sort((a, b) => a.hp - b.hp)[0];
      const roll = V6(g) ? 0.35 + R() * 1.3 : 0.5 + R(), crit = R() < 0.08 + h.skill / 1000; // 난수 쓰는 순서는 예전과 같음(같은 씨앗 = 같은 경기)
      const dmg = (2.2 + h.skill / 30) * h.m.atk * (1 + early * 0.03) * roll * (g.buff[h.side] > 0 ? (V2 ? 1.25 : 1.12) : 1) * (V2 && g.bb[h.side] > 0 ? 1.15 : 1) * (V2 && g.buff[tgt.side] > 0 ? 0.85 : 1) * (crit ? 2.5 * (g.rules.crit ?? 1) : 1) * traitMul(g, h) * lvAtk(g, h) / lvDef(g, tgt) * (h.ua > 0 ? h.um : 1) * (tgt.sh > 0 ? 0.5 : 1) * (V4(g) && h.hp < 30 ? 1.15 : 1) * (V5(g) && h.role === 'jungle' && g.cb[h.side] > 0 ? 1.1 : 1) * h.form * (1 + behind(g, h.side)) * (g.rules.atk ?? 1) / (g.rules.def ?? 1) / (tgt.tr.includes('ironskin') ? 1 / 0.95 : 1) / tgt.m.def / (1 + (g.t < 700 ? g.strat[tgt.side].aggr : 0) * -0.03); // 초반 공세 팀은 초반에 덜 버팀. 가끔 큰 한 방(실력이 높을수록 자주)
      tgt.hp -= dmg; g.fx.push({ a: hi(h), b: hi(tgt), k: crit ? 'crit' : 'hit' });
      if (tgt.hp <= 0) heroDied(g, tgt, h);
      else if (tgt.hp < 16 && dist(h.x, h.y, tgt.x, tgt.y) > 3) stepTo(h, tgt.x, tgt.y, 1.2); // 도망치는 상대를 쫓음
      continue;
    }
    { // 적 영웅이 없으면 근처 적 병사를 친다(실력 좋은 쪽이 길을 밀어낸다)
      const w = g.waves.find((x) => x.side !== h.side && dist(...lanePos(x.lane, x.p), h.x, h.y) < LOG.heroRange);
      if (w) { w.n -= (0.08 + h.skill / 600) * h.m.push * lvPush(g, h); gainXp(g, h, 3); g.fx.push({ a: hi(h), b: g.waves.indexOf(w), k: 'wave' }); }
    }
    // 목표 정하기
    const lane = LANE_OF[h.role];
    let tx: number, ty: number;
    const goBoss = V2 && g.boss.alive && (h.role === 'jungle' || g.t > 1000 || (h.role !== 'bot' && R() < 0.25 + S.obj * 0.4)); // 성운 거신이 나오면 수호자보다 먼저
    const goObj = !goBoss && g.obj.alive && (h.role === 'jungle' || (h.role === 'support' && R() < 0.4 + S.obj * 0.6) || (h.role === 'mid' && R() < S.obj) || g.t > 900);
    if (goBoss) { [tx, ty] = BOSS; if (dist(h.x, h.y, tx, ty) < 5) { const dmg = (1 + h.skill / 60) * h.m.obj * lvPush(g, h); g.boss.hp -= dmg; g.fx.push({ a: hi(h), b: 1, k: 'obj' }); g.boss.by[h.side] += dmg; if (g.boss.hp <= 0) bossTaken(g); } }
    else if (goObj) { [tx, ty] = OBJ; if (dist(h.x, h.y, tx, ty) < 5) { const dmg = (1 + h.skill / 60) * h.m.obj * lvPush(g, h); g.obj.hp -= dmg; g.fx.push({ a: hi(h), b: 0, k: 'obj' }); g.obj.by[h.side] += dmg; if (g.obj.hp <= 0) objTaken(g); } }
    else if (lane === -1 && V5(g) && jungleCamp(g, h) >= 0) { // 정글러: 우리 숲 몹부터(다 비면 상대 숲, 그것도 없으면 갱킹)
      const ci = jungleCamp(g, h); [tx, ty] = [CAMPS[ci][0], CAMPS[ci][1]];
      if (dist(h.x, h.y, tx, ty) < 5) { const c = g.camps[ci]; c.hp -= (1.2 + h.skill / 60) * h.m.obj * lvPush(g, h); h.hp = Math.max(1, h.hp - 0.5); g.fx.push({ a: hi(h), b: 2 + ci, k: 'obj' }); // 몹도 맞서 싸움(몹에게 죽지는 않음 — 빨피면 귀환)
        if (c.hp <= 0) { c.hp = 0; c.next = g.t + LOG.campEvery; gainXp(g, h, CAMPS[ci][3]); h.hp = Math.min(100, h.hp + 12); if (ci % 3 === 2) g.cb[h.side] = LOG.campBuff; } } }
    else if (lane === -1) { const l = (Math.floor(g.t / 120) % 3) as Lane; [tx, ty] = lanePos(l, (frontP(g, l, h.side) + guardP(g, h.side, l)) / 2); }
    else {
      const f = frontP(g, lane, h.side), back = h.side === 0 ? -0.03 : 0.03;
      [tx, ty] = lanePos(lane, f + back);
      // 적 탑 근처면 우리 병사가 있을 때만 탑을 친다
      const enemy = (1 - h.side) as Side;
      for (const inner of [0, 1] as const) {
        const ti = towerIndex(enemy, lane, inner); if (g.towers[ti] <= 0) continue;
        const [px, py] = towerPos(enemy, lane, inner);
        if (dist(h.x, h.y, px, py) < LOG.towerRange) { const cover = g.waves.some((w) => w.side === h.side && w.lane === lane && dist(...lanePos(lane, w.p), px, py) < LOG.towerRange); if (cover) { g.towers[ti] -= (0.5 + h.skill / 120) * h.m.push * (V2 && g.buff[h.side] > 0 ? 1.5 : 1) * bb(h.side) * lvPush(g, h); g.fx.push({ a: hi(h), b: ti, k: 'tower' }); if (g.towers[ti] <= 0) towerFell(g, h.side, lane); } else { h.hp -= 2.2; if (h.hp <= 0) heroDied(g, h, null); [tx, ty] = lanePos(lane, f + back * 3); } }
        break;
      }
      if (laneDone(g, enemy, lane)) { const [cx, cy] = BASE[enemy]; if (dist(h.x, h.y, cx, cy) < 10 && g.waves.some((w) => w.side === h.side && w.lane === lane && Math.abs(w.p - (h.side === 0 ? 0.97 : 0.03)) < 0.08)) { g.cores[enemy] -= (0.4 + h.skill / 150) * bb(h.side) * lvPush(g, h); hit[enemy] = true; g.fx.push({ a: hi(h), b: enemy, k: 'core' }); } }
    }
    stepTo(h, tx + (R() - 0.5) * 1.5, ty + (R() - 0.5) * 1.5, sp);
  }
  // 탑은 가까운 적 영웅을 쏜다
  for (let ti = 0; ti < 12; ti++) {
    if (g.towers[ti] <= 0) continue; const side = (ti < 6 ? 0 : 1) as Side, lane = (Math.floor((ti % 6) / 2)) as Lane, inner = (ti % 2) as 0 | 1, [px, py] = towerPos(side, lane, inner);
    const v = g.heroes.find((o) => o.side !== side && o.hp > 0 && dist(o.x, o.y, px, py) < LOG.towerRange * 0.8);
    if (v && !g.waves.some((w) => w.side !== side && w.lane === lane && dist(...lanePos(lane, w.p), px, py) < LOG.towerRange)) { v.hp -= 3 / (V3(g) ? 1 + 0.02 * (v.lv - 1) : 1); g.fx.push({ a: -1 - ti, b: g.heroes.indexOf(v), k: 'shot' }); if (v.hp <= 0) heroDied(g, v, null); }
  }
  const pre: [number, number] = [g.cores[0], g.cores[1]];
  if (g.t > 800) for (const s of [0, 1] as Side[]) { const lost = g.towers.filter((x, i) => x <= 0 && (i < 6 ? 0 : 1) === s).length; g.cores[s] -= 0.045 * lost * late; } // 밀린 쪽 핵이 서서히 무너짐(경기가 5분 안팎에 끝나게)
  for (const s of [0, 1] as Side[]) if (g.cores[s] <= 0 && !g.done && !g.fin) {
    g.winner = (1 - s) as Side;
    if (hit[s]) { g.done = true; g.events.push({ t: g.t, kind: 'core', side: g.winner }); } // 실제로 때려서 부숨
    else startFinale(g, s, pre[s]); // 저절로 무너질 차례 → 이긴 팀이 가서 부수는 장면
  }
  if (!g.done && !g.fin && g.t >= LOG.cap) { // 너무 길면: 탑·킬로 판정 → 이긴 팀이 핵으로 돌격
    const score = (s: Side) => g.towers.filter((x, i) => x <= 0 && (i < 6 ? 0 : 1) !== s).length * 3 + g.kills[s];
    g.winner = score(0) > score(1) ? 0 : score(1) > score(0) ? 1 : (R() < 0.5 ? 0 : 1); const lo = (1 - g.winner) as Side; startFinale(g, lo, g.cores[lo]);
  }
}
function startFinale(g: GameState, loser: Side, from: number): void { const hp = Math.max(40, Math.min(LOG.coreHp, from)); g.cores[loser] = hp; g.fin = { left: LOG.finale, loser, hp }; }
/** 마지막 돌격 한 틱(난수 없음): 이긴 팀 영웅·병사가 진 쪽 핵으로 몰려가 부숨. 진 팀은 핵 앞에서 버팀. */
function finale(g: GameState): void {
  const f = g.fin!, win = (1 - f.loser) as Side, [cx, cy] = BASE[f.loser]; g.t++; g.fx = []; f.left--;
  g.heroes.forEach((h, i) => {
    if (h.hp <= 0) { if (h.side === win && --h.dead <= 0) { h.hp = 100; h.x = BASE[win][0]; h.y = BASE[win][1]; } return; }
    if (h.side === win) {
      const ang = i * 1.2566, r = 5 + (i % 3);
      stepTo(h, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 1.9);
      if (dist(h.x, h.y, cx, cy) < 11) {
        const foe = g.heroes.findIndex((o) => o.side === f.loser && o.hp > 0 && dist(o.x, o.y, h.x, h.y) < LOG.heroRange);
        if (foe >= 0 && (g.t + i) % 3 === 0) { const o = g.heroes[foe]; o.hp -= 9; g.fx.push({ a: i, b: foe, k: 'hit' }); if (o.hp <= 0) { o.hp = 0; o.dead = Math.max(1, f.left); } }
        else g.fx.push({ a: i, b: f.loser, k: 'core' });
      }
    } else stepTo(h, cx + (win === 0 ? -3 : 3) + (i % 5) - 2, cy + (win === 0 ? 3 : -3), 1.2); // 진 팀은 핵 앞에서 버팀
  });
  for (const w of g.waves) { if (w.side === win) { const cp = win === 0 ? 0.97 : 0.03; if (Math.abs(w.p - cp) > 0.02) w.p += (cp > w.p ? 1 : -1) * Math.min(0.02, Math.abs(cp - w.p)); } else w.n -= 0.08; }
  g.waves = g.waves.filter((w) => w.n > 0.05);
  g.cores[f.loser] = f.hp * Math.max(0, f.left) / LOG.finale;
  if (f.left <= 0) { g.cores[f.loser] = 0; g.fin = undefined; g.done = true; g.events.push({ t: g.t, kind: 'core', side: win }); }
}
/** 궁극기(엔진 4, 레벨 6부터, 난수 없음). 쓰면 true가 아니라 「핵을 때렸는지」를 돌려줌. */
function useUlt(g: GameState, h: Hero, near: boolean): boolean {
  if (h.lv < ULT_LV || h.ucd > 0) return false;
  const i = g.heroes.indexOf(h), enemy = (1 - h.side) as Side, foes = g.heroes.filter((o) => o.side !== h.side && o.hp > 0 && dist(o.x, o.y, h.x, h.y) < LOG.heroRange + 2).sort((a, b) => a.hp - b.hp);
  const allies = g.heroes.filter((o) => o.side === h.side && o.hp > 0 && dist(o.x, o.y, h.x, h.y) < 14);
  let fired = false, core = false;
  switch (h.uk) {
    case 'X': if (foes[0] && foes[0].hp < 55) { const t = foes[0]; t.hp -= 45 * lvAtk(g, h) / lvDef(g, t) * (t.sh > 0 ? 0.5 : 1); g.fx.push({ a: i, b: g.heroes.indexOf(t), k: 'crit' }); if (t.hp <= 0) heroDied(g, t, h); fired = true; } break;
    case 'A': if (near) { h.ua = 25; h.um = 1.6; fired = true; } break;
    case 'B': if (near && h.hp < 55) { h.hp = Math.min(100, h.hp + 45); h.ua = 20; h.um = 1.3; fired = true; } break;
    case 'D': if (near && allies.some((o) => o.hp < 50)) { for (const o of allies) { o.sh = 25; o.hp = Math.min(100, o.hp + 15); } fired = true; } break;
    case 'T': { const close = foes.filter((o) => dist(o.x, o.y, h.x, h.y) < 10); if (close.length >= 2 || (close.length === 1 && allies.length >= 2)) { for (const o of close) { o.stun = 10; g.fx.push({ a: g.heroes.indexOf(o), b: 0, k: 'stun' }); } h.sh = 15; fired = true; } break; }
    case 'P': { for (let ti = 0; ti < 12 && !fired; ti++) { if (g.towers[ti] <= 0 || (ti < 6 ? 0 : 1) !== enemy) continue; const lane = Math.floor((ti % 6) / 2) as Lane, [px, py] = towerPos(enemy, lane, (ti % 2) as 0 | 1); if (dist(h.x, h.y, px, py) < LOG.towerRange * 1.3) { g.towers[ti] -= 30 * lvPush(g, h); g.fx.push({ a: i, b: ti, k: 'tower' }); if (g.towers[ti] <= 0) towerFell(g, h.side, lane); fired = true; } }
      if (!fired) { const [cx, cy] = BASE[enemy]; if (dist(h.x, h.y, cx, cy) < 12 && [0, 1, 2].some((l) => laneDone(g, enemy, l as Lane))) { g.cores[enemy] -= 8 * lvPush(g, h); g.fx.push({ a: i, b: enemy, k: 'core' }); fired = true; core = true; } }
      if (fired) for (const w of g.waves) if (w.side !== h.side && dist(...lanePos(w.lane, w.p), h.x, h.y) < LOG.heroRange) w.n = 0.01; break; }
    case 'O': { const tryObj = (alive: boolean, pos: [number, number], hit: () => void) => { if (!fired && alive && dist(h.x, h.y, pos[0], pos[1]) < 6) { hit(); fired = true; } };
      tryObj(g.boss.alive, BOSS, () => { const d = 30 * lvPush(g, h); g.boss.hp -= d; g.boss.by[h.side] += d; g.fx.push({ a: i, b: 1, k: 'obj' }); if (g.boss.hp <= 0) bossTaken(g); });
      tryObj(g.obj.alive, OBJ, () => { const d = 30 * lvPush(g, h); g.obj.hp -= d; g.obj.by[h.side] += d; g.fx.push({ a: i, b: 0, k: 'obj' }); if (g.obj.hp <= 0) objTaken(g); });
      if (!fired && foes[0] && foes[0].hp < 25) { const t = foes[0]; t.hp = 0; heroDied(g, t, h); fired = true; } break; }
  }
  if (!fired) return false;
  h.ucd = Math.max(120, 200 - 5 * (h.lv - ULT_LV)); g.fx.push({ a: i, b: ULT_KINDS.indexOf(h.uk as typeof ULT_KINDS[number]), k: 'ult' }); g.events.push({ t: g.t, kind: 'ult', side: h.side, who: h.name, u: h.uk });
  return core;
}
/** 정글러가 갈 몹 진영: 살아 있는 우리 숲 진영 중 가장 가까운 곳. 없으면 공세 전략일 때만 상대 숲. 없으면 −1(갱킹). */
function jungleCamp(g: GameState, h: Hero): number {
  const near = (ids: number[]) => ids.filter((i) => g.camps[i].hp > 0).sort((a, b) => dist(h.x, h.y, CAMPS[a][0], CAMPS[a][1]) - dist(h.x, h.y, CAMPS[b][0], CAMPS[b][1]))[0] ?? -1;
  const own = h.side === 0 ? [0, 1, 2] : [3, 4, 5], foe = h.side === 0 ? [3, 4, 5] : [0, 1, 2];
  const a = near(own); if (a >= 0) return a; return g.strat[h.side].aggr > 0.3 ? near(foe) : -1;
}
function heroDied(g: GameState, v: Hero, by: Hero | null): void {
  v.stun = 0; v.rc = 0; v.ua = 0; v.sh = 0;
  v.hp = 0; v.deaths++; v.dead = LOG.respawnBase + Math.floor(g.t / 150) * 2;
  const killer = (1 - v.side) as Side; g.kills[killer]++;
  if (by) by.kills++;
  if (V3(g)) { if (by) gainXp(g, by, (50 + 15 * Math.max(0, v.lv - by.lv)) * (1 + behind(g, by.side) * 2)); for (const o of g.heroes) if (o !== by && o.side === killer && o.hp > 0 && dist(o.x, o.y, v.x, v.y) < LOG.heroRange * 1.5) gainXp(g, o, 25); } // 처치·도움 경험치(높은 레벨을 잡으면 현상금)
  g.events.push({ t: g.t, kind: g.firstBlood ? 'kill' : 'first_blood', side: killer, who: by?.name, victim: v.name }); g.firstBlood = true;
  if (g.heroes.filter((h) => h.side === v.side).every((h) => h.hp <= 0)) g.events.push({ t: g.t, kind: 'ace', side: killer });
}
function towerFell(g: GameState, by: Side, lane: Lane): void { for (const o of g.heroes) if (o.side === by) gainXp(g, o, 30); g.events.push({ t: g.t, kind: laneDone(g, (1 - by) as Side, lane) ? 'inhib' : 'tower', side: by, lane }); }
function bossTaken(g: GameState): void {
  const s: Side = g.boss.by[0] >= g.boss.by[1] ? 0 : 1; g.boss.alive = false; g.boss.next = g.t + LOG.bossEvery; g.bb[s] = LOG.bossTicks; for (const o of g.heroes) if (o.side === s) gainXp(g, o, 100);
  g.events.push({ t: g.t, kind: 'boss', side: s });
}
function objTaken(g: GameState): void {
  const s: Side = g.obj.by[0] >= g.obj.by[1] ? 0 : 1; g.obj.alive = false; g.obj.next = g.t + (g.rules.objEvery ?? LOG.objEvery); g.buff[s] = (g.rules.v ?? ENGINE) >= 2 ? LOG.buffTicks2 : LOG.buffTicks; for (const o of g.heroes) if (o.side === s) gainXp(g, o, 60);
  g.events.push({ t: g.t, kind: 'objective', side: s });
}
export function frame(g: GameState): Frame {
  // heroes: [x, y, hp, side] — 영웅 이름·선수 이름은 시작할 때 따로 보냄(roster)
  return { t: g.t, fx: g.fx, heroes: g.heroes.map((h) => [Math.round(h.x * 10) / 10, Math.round(h.y * 10) / 10, Math.max(0, Math.round(h.hp)), h.side, h.hp > 0 ? 0 : h.dead, h.kills, h.deaths, h.lv, !V4(g) || h.lv < ULT_LV ? -1 : h.ucd]), waves: g.waves.map((w) => { const [x, y] = lanePos(w.lane, w.p); return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, w.side, Math.round(w.n * 10) / 10]; }),
    towers: g.towers.map((x) => Math.max(0, Math.round(x))), cores: [Math.max(0, Math.round(g.cores[0])), Math.max(0, Math.round(g.cores[1]))], obj: [g.obj.alive ? 1 : 0, Math.max(0, Math.round(g.obj.hp))], kills: [g.kills[0], g.kills[1]], buff: [g.buff[0], g.buff[1]], ...(g.fin ? { fin: [g.fin.left, g.fin.loser] as [number, number] } : {}), ...((g.rules.v ?? ENGINE) >= 5 ? { camps: g.camps.map((c) => Math.max(0, Math.round(c.hp))) } : {}), ...((g.rules.v ?? ENGINE) >= 2 ? { boss: [g.boss.alive ? 1 : 0, Math.max(0, Math.round(g.boss.hp))] as [number, number], bb: [g.bb[0], g.bb[1]] as [number, number] } : {}) };
}
/** 결과만 빠르게(보지 않은 경기·토토 정산). */
export function playOut(a: TeamDef, b: TeamDef, seed: number, rules: Rules = {}): { winner: Side; kills: [number, number]; ticks: number; mvp: string; events: GameEvent[]; stats: Array<{ name: string; side: Side; weapon: string; kills: number; deaths: number }> } {
  const g = newGame(a, b, seed, rules); while (!g.done) tick(g);
  const best = g.heroes.filter((h) => h.side === g.winner).sort((x, y) => y.kills - x.kills || x.deaths - y.deaths)[0];
  return { winner: g.winner!, kills: g.kills, ticks: g.t, mvp: best?.name ?? '', events: g.events, stats: g.heroes.map((h) => ({ name: h.name, side: h.side, weapon: h.weapon, kills: h.kills, deaths: h.deaths })) };
}
/** 팀 전력(선수 실력 평균). */
export const teamRating = (t: TeamDef): number => t.players.reduce((n, p) => n + p.skill, 0) / Math.max(1, t.players.length);
/** 이길 확률 근사(배당용). 전력 차 10이면 약 65%. */
export const winChance = (ra: number, rb: number): number => 1 / (1 + Math.pow(10, (rb - ra) / 22));
/** 토토 배당(카지노처럼 약간 낮춤, 1.05~20배). */
export const odds = (p: number): number => Math.max(1.05, Math.min(20, Math.round((0.92 / Math.max(0.01, p)) * 100) / 100));
