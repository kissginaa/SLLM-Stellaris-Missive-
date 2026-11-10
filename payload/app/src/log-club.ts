// 레전드 오브 갤럭시 — 구단·선수·밴픽·시즌·토토·올림픽 규칙(2026-10-30 사용자 결정, 팀파이트 매니저 참고). 순수 모듈.
// 경기 자체는 log-game.ts, 고정 명단·무기는 log-data.ts. 여기서는 「누가 어떤 무기로 얼마나 잘하는지」를 계산해 TeamDef 를 만든다.
// 2026-10-30 사용자 수정: 나라가 구단을 직접 운영하지 않고 「후원」(구단 운영은 AI, 플레이어는 등급만큼 요청), 영웅 대신 「무기」 밴픽, 고정 선수 200명(레전드 20).
import { type Role, type TeamDef, type PlayerDef, type Strategy, type WeaponMods, type Rules, ROLES, ENGINE, seeded, hashSeed, playOut, teamRating, winChance, odds } from './log-game';
import { WEAPONS, weaponById, EPITHETS, type RosterEntry } from './log-data';

export type Rng = () => number;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const ri = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

// ---------------- 무기(증강현실 무기 100개) — log-data.ts ----------------
export { WEAPONS, weaponById, KIND_NAME, ROSTER, START_ACTIVE, isLegend, EPITHETS, EXTRA_PORTRAITS, SPECIES_CLASS, NICK_COUNT, nickname, FIRST_NICKS, MASCOTS, COMPANY_COUNT, companyName, brandOf, BRAND_LIST, EMBLEMS, LOGO_SHAPES, LOGO_PATTERNS, LOGO_COLORS, LOGO_COUNT, type Logo, type WeaponDef, type RosterEntry } from './log-data';

// ---------------- 선수 ----------------
export type Trait = 'clutch' | 'showman' | 'fragile' | 'leader' | 'grinder' | 'prodigy' | 'late' | 'fader' | 'vanguard' | 'bloodlust' | 'ironskin' | 'coward' | 'moodmaker' | 'optimist' | 'pessimist' | 'bluefan' | 'redfan' | 'lazy';
/** 특성 18개(2026-10-30 팀파이트 매니저 참고로 12개 추가). 이름(한·영), 설명(한·영). */
export const TRAITS: Record<Trait, [string, string, string, string]> = {
  clutch: ['클러치', 'Clutch', '결승·올림픽 같은 큰 경기에 강함', 'Stronger in finals and the Olympics'],
  showman: ['쇼맨', 'Showman', '관중 앞에서 신이 남(홈 경기 +)', 'Thrives in front of a crowd (home games +)'],
  fragile: ['유리멘탈', 'Fragile', '큰 경기에 약함', 'Weaker in big matches'],
  leader: ['리더', 'Leader', '팀 전체의 팀워크를 올림', 'Raises the whole team\'s teamwork'],
  grinder: ['노력파', 'Grinder', '훈련으로 더 많이 성장', 'Grows more from training'],
  prodigy: ['천재', 'Prodigy', '잠재력이 높고 빨리 큼', 'High potential, grows fast'],
  late: ['대기만성', 'Late Bloomer', '경기 초반엔 약하지만 갈수록 강해짐', 'Weak early, stronger as the match goes on'],
  fader: ['용두사미', 'Fast Starter', '초반엔 강하지만 갈수록 힘이 빠짐', 'Strong early, fades as the match goes on'],
  vanguard: ['선봉장', 'Vanguard', '우리 팀 첫 처치 전까지 강함', 'Stronger until the team\'s first kill'],
  bloodlust: ['피 냄새', 'Bloodlust', '처치할 때마다 공격이 세짐', 'Hits harder with every kill'],
  ironskin: ['강철피부', 'Ironskin', '받는 피해가 줄어듦', 'Takes less damage'],
  coward: ['바퀴벌레', 'Survivor', '체력이 조금만 줄어도 일찍 물러남', 'Retreats early when hurt'],
  moodmaker: ['분위기 메이커', 'Mood Maker', '함께 뛰는 동료의 컨디션을 한 단계 올림', 'Lifts teammates\' condition by one step'],
  optimist: ['낙천적', 'Optimist', '컨디션이 「보통」 아래로 떨어지지 않음', 'Condition never drops below Normal'],
  pessimist: ['비관적', 'Pessimist', '컨디션이 「좋음」 위로 오르지 않음', 'Condition never rises above Good'],
  bluefan: ['파랑 진영 선호', 'Blue Side Lover', '파랑 진영에서 강함', 'Stronger on the blue side'],
  redfan: ['빨강 진영 선호', 'Red Side Lover', '빨강 진영에서 강함', 'Stronger on the red side'],
  lazy: ['태만', 'Lazy', '훈련으로 덜 성장', 'Grows less from training'],
};
/** 경기 엔진이 직접 쓰는 특성(시간·킬에 따라 변함). */
export const ENGINE_TRAITS: Trait[] = ['late', 'fader', 'vanguard', 'bloodlust', 'ironskin', 'coward'];
const CLASH: Array<[Trait, Trait]> = [['clutch', 'fragile'], ['late', 'fader'], ['optimist', 'pessimist'], ['bluefan', 'redfan'], ['grinder', 'lazy']];
const fits = (traits: Trait[], t: Trait) => !traits.includes(t) && !CLASH.some(([a, b]) => (t === a && traits.includes(b)) || (t === b && traits.includes(a)));
export interface Stats { phys: number; judg: number; team: number; ment: number }
/** id = 명단 번호(2세대부터 rid~세대), legend = 레전드(전용 초상화, 1세대만). pool = 무기 숙련(무기 id → 0~100). */
/** real = 본명(게임 이름 표로, 한·영 — 데뷔 때 지음, 재료가 없으면 나중에). feats = 실적(리그 우승·올림픽 메달·경기 MVP). home = 직접 키운 레전드(별명·초상화를 따로 가짐). */
export interface Feats { titles: number; medals: number; mvps: number }
export interface Player { id: string; rid: string; gen: number; legend: boolean; name: string; g: 'm' | 'f'; real?: { ko: string; en: string }; feats?: Feats; home?: { epithet: [string, string]; portrait: string }; age: number; role: Role; st: Stats; pot: number; traits: Trait[]; pool: Record<string, number>; salary: number; until: number; club: string | null; form: number }
export const overall = (p: Pick<Player, 'st'>): number => Math.round(p.st.phys * 0.35 + p.st.judg * 0.3 + p.st.team * 0.2 + p.st.ment * 0.15);
/** 연봉(시즌당, 구단 예산에서): 실력이 높을수록 비쌈. 레전드는 웃돈. */
export const salaryFor = (p: Pick<Player, 'st' | 'age' | 'pot'> & { legend?: boolean }): number => { const o = overall(p); return Math.round(Math.max(60, (o - 35) ** 2 * 0.55 + (p.age <= 20 ? (p.pot - o) * 2 : 0)) * (p.legend ? 1.25 : 1) / 10) * 10; };
const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
/** 명단의 한 사람 → 선수. 1세대는 모든 세이브에서 같은 능력(rid 씨앗), 2세대부터는 이름을 물려받은 새 신인(레전드 아님). */
export function playerFromRoster(e: RosterEntry, gen: number, rookie: boolean): Player {
  const r = seeded(hashSeed(gen > 1 ? `${e.rid}~${gen}` : e.rid)), legend = !!e.legend && gen === 1;
  const base = legend ? (rookie ? ri(r, 56, 62) : ri(r, 78, 85)) : rookie ? ri(r, 35, 58) : ri(r, 45, 76);
  const age = rookie ? ri(r, 17, 19) : legend ? ri(r, 21, 25) : ri(r, 19, 28);
  const v = () => clamp(base + ri(r, legend ? -4 : -9, legend ? 6 : 9), 25, 95);
  const all = Object.keys(TRAITS) as Trait[], traits: Trait[] = [];
  if (legend) { const good: Trait[] = ['clutch', 'leader', 'showman', 'grinder']; traits.push(good[Math.floor(r() * good.length)]); if (rookie) traits.push('prodigy'); }
  else { if (r() < 0.6) traits.push(all[Math.floor(r() * all.length)]); if (r() < 0.2) { const t = all[Math.floor(r() * all.length)]; if (fits(traits, t)) traits.push(t); } }
  const st = { phys: v(), judg: v(), team: v(), ment: v() };
  const pot = legend ? ri(r, 94, 99) : clamp(Math.max(base + 5, ri(r, 55, 90) + (traits.includes('prodigy') ? 8 : 0)), 40, 97);
  const pool: Record<string, number> = {}, mine = WEAPONS.filter((w) => w.role === e.role);
  if (legend && e.legend) pool[e.legend.sig] = 95;
  const n = legend ? 4 : ri(r, 3, 6);
  for (const w of mine.slice().sort(() => r() - 0.5)) { if (Object.keys(pool).length >= n) break; if (!pool[w.id]) pool[w.id] = legend ? ri(r, 70, 86) : ri(r, 40, 85); }
  if (r() < 0.25) { const o = WEAPONS.filter((w) => w.role !== e.role); pool[o[Math.floor(r() * o.length)].id] = ri(r, 30, 60); }
  const p: Player = { id: gen > 1 ? `${e.rid}~${gen}` : e.rid, rid: e.rid, gen, legend, name: e.handle + (ROMAN[gen] ?? ` ${gen}`), g: gen > 1 ? (r() < 0.5 ? 'm' : 'f') : e.g, age, role: e.role, st, pot, traits, pool, salary: 0, until: 0, club: null, form: 0 };
  p.salary = salaryFor(p); return p;
}
/** 명단 밖 선수(올림픽 외국 대표 등). */
export function newPlayer(id: string, name: string, role: Role, r: Rng, rookie = false): Player {
  const base = rookie ? ri(r, 35, 58) : ri(r, 45, 78), age = rookie ? ri(r, 17, 19) : ri(r, 19, 28), v = () => clamp(base + ri(r, -9, 9), 25, 95);
  const st = { phys: v(), judg: v(), team: v(), ment: v() }, pool: Record<string, number> = {};
  for (const w of WEAPONS.filter((x) => x.role === role)) if (r() < 0.25) pool[w.id] = ri(r, 40, 85);
  if (!Object.keys(pool).length) { const m = WEAPONS.filter((x) => x.role === role); pool[m[Math.floor(r() * m.length)].id] = ri(r, 55, 85); }
  const p: Player = { id, rid: id, gen: 1, legend: false, name, g: r() < 0.5 ? 'm' : 'f', age, role, st, pot: clamp(base + ri(r, 5, 25), 40, 97), traits: [], pool, salary: 0, until: 0, club: null, form: 0 };
  p.salary = salaryFor(p); return p;
}
/** 경기에서의 실력. 선수 능력(종합·팀워크·컨디션)이 대부분이고, 무기 숙련은 ±6 정도 보탬(무기 자체 성질은 경기 엔진에서 ±12~16%). big = 결승·올림픽. */
/** cond = 오늘 컨디션(0 최악 ~ 4 최상, 없으면 평소 기세 form), side = 진영, counter = 맞상대 무기 상성(+1 유리, −1 불리), gear = 후원 장비 보너스. */
export interface SkillCtx { big?: boolean; home?: boolean; cond?: number; side?: 0 | 1; counter?: number; gear?: number }
export function effSkill(p: Player, weapon: string, role: Role, teamAvgTeamwork: number, ctx: SkillCtx = {}): number {
  let s = overall(p) + (teamAvgTeamwork - 60) / 5 + (ctx.cond === undefined ? p.form : (ctx.cond - 2) * 2) + (ctx.counter ?? 0) * COUNTER_BONUS + (ctx.gear ?? 0);
  if (ctx.side === 0 && p.traits.includes('bluefan')) s += 3; if (ctx.side === 1 && p.traits.includes('redfan')) s += 3;
  if (p.role !== role) s -= 15;
  const prof = p.pool[weapon] ?? 25; s += (prof - 55) / 5;
  if (ctx.big && p.traits.includes('clutch')) s += 4; if (ctx.big && p.traits.includes('fragile')) s -= 4; if (ctx.home && p.traits.includes('showman')) s += 2;
  return clamp(Math.round(s), 20, 99);
}

// ---------------- 무기 상성·컨디션 (2026-10-30 팀파이트 매니저 참고) ----------------
/** 상성 고리(같은 자리 맞상대끼리): 폭발형 > 사냥형 > 밀기형 > 탱커형 > 공격형 > 방어형 > 폭발형. 균형형은 상성 없음. 선수 역량이 더 크므로 약하게(±3). */
export const COUNTER_RING = ['X', 'O', 'P', 'T', 'A', 'D'];
export const COUNTER_BONUS = 3;
export function counterOf(myWeapon: string | undefined, foeWeapon: string | undefined): number {
  const a = myWeapon ? weaponById(myWeapon)?.kind : undefined, b = foeWeapon ? weaponById(foeWeapon)?.kind : undefined; if (!a || !b) return 0;
  const i = COUNTER_RING.indexOf(a), j = COUNTER_RING.indexOf(b); if (i < 0 || j < 0) return 0;
  return (i + 1) % COUNTER_RING.length === j ? 1 : (j + 1) % COUNTER_RING.length === i ? -1 : 0;
}
/** 컨디션 5단계(0 최악 · 1 나쁨 · 2 보통 · 3 좋음 · 4 최상): 평소 기세(form) + 그날 운. 낙천적·비관적, 분위기 메이커(동료 +1). */
export const COND_NAMES: Array<[string, string]> = [['최악', 'Awful'], ['나쁨', 'Poor'], ['보통', 'Normal'], ['좋음', 'Good'], ['최상', 'Great']];
export function conditions(lineup: Record<Role, Player>, r: Rng): Record<string, number> {
  const out: Record<string, number> = {}, ps = ROLES.map((x) => lineup[x]).filter(Boolean);
  for (const p of ps) { let c = Math.round(p.form / 2) + 2 + (r() < 0.25 ? -1 : r() < 0.33 ? 1 : 0); out[p.id] = c; }
  for (const p of ps) { if (ps.some((q) => q.id !== p.id && q.traits.includes('moodmaker'))) out[p.id]++; if (p.traits.includes('optimist')) out[p.id] = Math.max(2, out[p.id]); if (p.traits.includes('pessimist')) out[p.id] = Math.min(3, out[p.id]); out[p.id] = clamp(out[p.id], 0, 4); }
  return out;
}

// ---------------- 밴픽(무기) ----------------
/** 순서: 밴 A,B,A,B → 픽 A,B,B,A,A,B,B,A,A,B. 밴·픽 대상은 무기(사용자 결정 2026-10-30). */
export const DRAFT_ORDER: Array<{ side: 0 | 1; kind: 'ban' | 'pick' }> = [
  { side: 0, kind: 'ban' }, { side: 1, kind: 'ban' }, { side: 0, kind: 'ban' }, { side: 1, kind: 'ban' },
  ...([0, 1, 1, 0, 0, 1, 1, 0, 0, 1] as Array<0 | 1>).map((side) => ({ side, kind: 'pick' as const })),
];
/** pool = 이번 경기에 쓸 수 있는 무기(출시된 것 − 글로벌 밴). 없으면 전부. */
export interface Draft { step: number; bans: [string[], string[]]; picks: [Array<{ role: Role; weapon: string }>, Array<{ role: Role; weapon: string }>]; pool?: string[] }
export const emptyDraft = (pool?: string[]): Draft => ({ step: 0, bans: [[], []], picks: [[], []], ...(pool ? { pool } : {}) });
const inPool = (d: Draft, id: string) => !d.pool || d.pool.includes(id);
export const taken = (d: Draft): Set<string> => new Set([...d.bans[0], ...d.bans[1], ...d.picks[0].map((x) => x.weapon), ...d.picks[1].map((x) => x.weapon)]);
export const draftDone = (d: Draft): boolean => d.step >= DRAFT_ORDER.length;
/** 한 수 두기(밴이면 weapon, 픽이면 role+weapon). 잘못된 수면 false. */
export function draftMove(d: Draft, weapon: string, role?: Role): boolean {
  if (draftDone(d)) return false; const o = DRAFT_ORDER[d.step], w = weaponById(weapon); if (!w || taken(d).has(weapon) || !inPool(d, weapon)) return false;
  if (o.kind === 'ban') { d.bans[o.side].push(weapon); d.step++; return true; }
  const r = role ?? w.role; if (d.picks[o.side].some((x) => x.role === r)) return false;
  d.picks[o.side].push({ role: r, weapon }); d.step++; return true;
}
/** AI 밴픽: 밴 = 상대 선발 선수가 가장 잘 다루는 무기, 픽 = 아직 안 고른 자리에서 우리 선수가 가장 잘 다루는 무기(상대가 먼저 고른 맞상대를 이기는 무기면 더 좋게). */
export function draftAi(d: Draft, mine: Record<Role, Player>, theirs: Record<Role, Player>, r: Rng): { weapon: string; role?: Role } {
  const o = DRAFT_ORDER[d.step], used = new Set([...taken(d), ...WEAPONS.filter((w) => !inPool(d, w.id)).map((w) => w.id)]), foePicks = d.picks[1 - o.side];
  if (o.kind === 'ban') {
    const cands = ROLES.flatMap((role) => Object.entries(theirs[role]?.pool ?? {}).filter(([w]) => !used.has(w) && weaponById(w)?.role === role).map(([w, v]) => ({ w, v: v + overall(theirs[role]) / 4 + r() * 6 })));
    cands.sort((a, b) => b.v - a.v); return { weapon: cands[0]?.w ?? WEAPONS.find((x) => !used.has(x.id))!.id };
  }
  const open = ROLES.filter((role) => !d.picks[o.side].some((x) => x.role === role));
  let best: { weapon: string; role: Role; v: number } | null = null;
  for (const role of open) for (const w of WEAPONS.filter((x) => x.role === role && !used.has(x.id))) { const v = (mine[role]?.pool[w.id] ?? 25) + counterOf(w.id, foePicks.find((x) => x.role === role)?.weapon) * 15 + r() * 4; if (!best || v > best.v) best = { weapon: w.id, role, v }; }
  return best ? { weapon: best.weapon, role: best.role } : { weapon: WEAPONS.find((x) => !used.has(x.id))!.id };
}
export function autoDraft(mine: Record<Role, Player>, theirs: Record<Role, Player>, r: Rng, pool?: string[]): Draft {
  const d = emptyDraft(pool); let g = 0;
  while (!draftDone(d) && g++ < 40) { const side = DRAFT_ORDER[d.step].side; const m = draftAi(d, side === 0 ? mine : theirs, side === 0 ? theirs : mine, r); if (!draftMove(d, m.weapon, m.role)) d.step++; }
  return d;
}
/** 선발 5명 + 밴픽 결과 → 경기 엔진 팀. */
/** opts: mods = 패치된 무기 배율, conds = 오늘 컨디션, foe = 상대 픽(상성), side = 진영, gear = 후원 장비 보너스. */
export interface TeamOpts { mods?: (weapon: string) => WeaponMods | undefined; conds?: Record<string, number>; foe?: Array<{ role: Role; weapon: string }>; side?: 0 | 1; gear?: number }
export function teamDef(id: string, name: string, lineup: Record<Role, Player>, picks: Array<{ role: Role; weapon: string }>, strat: Strategy, ctx: { big?: boolean; home?: boolean } = {}, opts: TeamOpts = {}): TeamDef {
  const lead = ROLES.some((r) => lineup[r]?.traits.includes('leader')) ? 4 : 0;
  const tw = ROLES.reduce((n, r) => n + (lineup[r]?.st.team ?? 50), 0) / 5 + lead;
  const players: PlayerDef[] = ROLES.map((role) => { const p = lineup[role], pk = picks.find((x) => x.role === role), w = pk ? weaponById(pk.weapon) : undefined, sc: SkillCtx = { ...ctx, cond: p && opts.conds ? opts.conds[p.id] : undefined, side: opts.side, counter: counterOf(w?.id, opts.foe?.find((x) => x.role === role)?.weapon), gear: opts.gear }; return { name: p?.name ?? role, role, skill: p ? effSkill(p, w?.id ?? '', role, tw, sc) : 40, ...(w ? { weapon: w.id, mods: (opts.mods && opts.mods(w.id)) || w.m, uk: w.kind } : {}), ...(p ? { tr: p.traits.filter((t) => ENGINE_TRAITS.includes(t)) } : {}), ...(sc.cond !== undefined ? { cond: sc.cond } : {}) }; });
  return { id, name, players, strat };
}
/** 선발: 자리마다 overall 이 가장 높은 선수(주 포지션 우선). */
export function bestLineup(roster: Player[]): Record<Role, Player> {
  const used = new Set<string>(), out = {} as Record<Role, Player>;
  for (const role of ROLES) { const c = roster.filter((p) => !used.has(p.id)).sort((a, b) => (b.role === role ? 20 : 0) + overall(b) - ((a.role === role ? 20 : 0) + overall(a)))[0]; if (c) { out[role] = c; used.add(c.id); } }
  return out;
}

// ---------------- 성장·나이·훈련 ----------------
export type Focus = keyof Stats | 'balanced';
/** 분기마다: 훈련 방향으로 성장, 27살부터 조금씩 하락. weapon = 연습시킬 무기(숙련 +). */
export function trainQuarter(p: Player, focus: Focus, r: Rng, weapon?: string, boost = 1): void {
  const late = boost > 1 ? 2 : 0; // 육성 선수: 늦게까지 크고 늦게 꺾임
  const o = overall(p), room = Math.max(0, p.pot + (boost > 1 ? 4 : 0) - o) /* 육성 선수는 잠재력보다 4까지 더 */, young = p.age <= 23 + late ? 1.3 : p.age <= 26 + late ? 1 : 0.5, g = (p.traits.includes('grinder') ? 1.3 : 1) * (p.traits.includes('prodigy') ? 1.2 : 1) * (p.traits.includes('lazy') ? 0.7 : 1) * boost;
  for (const k of ['phys', 'judg', 'team', 'ment'] as Array<keyof Stats>) {
    let d = (room / 40) * young * g * (focus === k ? 2.2 : focus === 'balanced' ? 0.9 : 0.5) * (0.6 + r() * 0.8);
    if (p.age >= 27 + late) d -= (p.age - 26 - late) * 0.35 * r();
    p.st[k] = clamp(Math.round((p.st[k] + d) * 10) / 10, 20, 99);
  }
  if (weapon && weaponById(weapon)) { const v = p.pool[weapon] ?? 25; p.pool[weapon] = clamp(Math.round(v + (100 - v) * (0.06 + r() * 0.08) * boost), 0, 100); } // 높을수록 천천히(100에 금방 닿지 않게)
  p.form = clamp(Math.round((p.form + (r() - 0.5) * 2) * 10) / 10, -4, 4);
}
export const ageYear = (p: Player): void => { p.age++; };

// ---------------- 시즌 일정 ----------------
/** 1년 한 시즌, 3달마다 2경기(라운드): 2·3·5·6·8·9·11·12월. 8팀, 1~7라운드 풀리그, 8라운드 결승·3위전. */
export const ROUND_MONTHS = [2, 3, 5, 6, 8, 9, 11, 12] as const;
/** 8팀 풀리그 7라운드 대진(원형 돌리기). 결과: 라운드마다 [홈, 원정] 4쌍(팀 번호 0~7). */
export function roundRobin(n = 8): Array<Array<[number, number]>> {
  const ids = Array.from({ length: n }, (_, i) => i), rounds: Array<Array<[number, number]>> = [];
  for (let r = 0; r < n - 1; r++) { const pairs: Array<[number, number]> = []; for (let i = 0; i < n / 2; i++) { const a = ids[i], b = ids[n - 1 - i]; pairs.push(r % 2 ? [b, a] : [a, b]); } rounds.push(pairs); ids.splice(1, 0, ids.pop()!); }
  return rounds;
}
export interface MatchRec { a: number; b: number; seed: number; winner?: 0 | 1; kills?: [number, number]; ticks?: number; mvp?: string; defs?: [TeamDef, TeamDef]; draft?: Draft; eng?: number } // eng: 치른 경기 엔진 판(없으면 1)
export interface Standing { w: number; l: number; k: number; d: number }
export function standings(rounds: MatchRec[][], teams: number): Standing[] {
  const s = Array.from({ length: teams }, () => ({ w: 0, l: 0, k: 0, d: 0 }));
  for (const rd of rounds.slice(0, 7)) for (const m of rd) if (m.winner !== undefined && m.kills) { const W = m.winner === 0 ? m.a : m.b, Lo = m.winner === 0 ? m.b : m.a; s[W].w++; s[Lo].l++; s[m.a].k += m.kills[0]; s[m.a].d += m.kills[1]; s[m.b].k += m.kills[1]; s[m.b].d += m.kills[0]; }
  return s;
}
export const rankOrder = (st: Standing[]): number[] => st.map((x, i) => ({ i, x })).sort((p, q) => q.x.w - p.x.w || (q.x.k - q.x.d) - (p.x.k - p.x.d) || p.i - q.i).map((v) => v.i);

// ---------------- 돈·후원 ----------------
/** 구단 상금(구단 예산으로). 후원사는 그중 몫(share)을 금고로 받음 — 작게. */
export const PRIZE = { win: 120, champion: 2500, runnerUp: 1200, third: 600 } as const;
/** 후원 등급(사용자 결정 2026-10-30: 한 팀, 등급제). fee = 시즌마다 금고에서, budget = 구단 예산에 더해짐.
 *  1 후원사: 후원명 + 전략·훈련·무기 연습 요청 · 2 주요 후원사: + 영입 추천 · 3 메인 스폰서: + 팀 이름·로고 바꾸기(명명권) + 직접 밴픽. */
export const SPONSOR = { baseBudget: 4200, tiers: [{ fee: 400, share: 0.15 }, { fee: 1200, share: 0.25 }, { fee: 3000, share: 0.35 }] } as const;
export type Tier = 1 | 2 | 3;
export const tierCan = (tier: number, what: 'request' | 'scout' | 'rename' | 'draft' | 'logo'): boolean => tier >= ({ request: 1, scout: 2, rename: 3, draft: 3, logo: 3 } as const)[what];
/** 레전드 양성(사용자 결정 2026-10-30): 후원 구단 유망주 한 명(21살 이하·잠재력 85 이상)을 육성 선수로 — 육성비(시즌마다 금고), 성장 2배·전성기 2년 길게·잠재력 +4까지.
 *  종합 85 이상 + 큰 실적(리그 우승 또는 올림픽 메달)이면 레전드로 승격(별명 자동, 초상화는 예비 그림·내 그림에서 고름). */
export const FOSTER = { fee: 500, boost: 2, maxAge: 21, minPot: 85, legendOvr: 85 } as const;
export const canFoster = (p: Player): boolean => !p.legend && p.age <= FOSTER.maxAge && p.pot >= FOSTER.minPot;
export const readyForLegend = (p: Player): boolean => !p.legend && overall(p) >= FOSTER.legendOvr && !!p.feats && (p.feats.titles > 0 || p.feats.medals > 0);
/** 자동 별명: 자리별 후보 중 아직 안 쓴 것(선수 id로 고름). */
export function pickEpithet(p: Player, used: Set<string>): [string, string] {
  const c = EPITHETS[p.role].filter((x) => !used.has(x[1])), all = c.length ? c : EPITHETS[p.role];
  return all[hashSeed(p.id) % all.length];
}
export const signingFee = (p: Player): number => Math.round(p.salary * 0.5 / 10) * 10;

// ---------------- 토토 ----------------
export interface TotoPick { round: number; match: number; side: 0 | 1 }
export interface TotoSlip { id: string; picks: TotoPick[]; stake: number; odds: number; settled?: boolean; won?: boolean; /** 국제 대회 토토: w 월즈(round = 시리즈 번호) · o 올림픽(round = 경기 번호). yr = 그 대회(월즈 연도 · 올림픽 첫 경기 씨앗) */ intl?: 'w' | 'o'; yr?: number }
export function slipOdds(picks: TotoPick[], ratings: (round: number, match: number) => [number, number]): number {
  let o = 1; for (const p of picks) { const [ra, rb] = ratings(p.round, p.match), pa = winChance(ra, rb); o *= odds(p.side === 0 ? pa : 1 - pa); }
  return Math.min(100, Math.round(o * 100) / 100);
}

// ---------------- 올림픽 ----------------
export const OLYMPIC = { every: 10, bidFee: 500, medalMood: { gold: 2, silver: 1, bronze: 0 }, hostMood: 3, bidFailMood: -1, voteBias: 0.25 } as const;
/** 개최국 투표: 회원국이 외교 가중치로, 신청국마다 호감(−1~1)을 더해 고름. 과반이 없으면 꼴찌를 빼고 다시. */
export function hostVote(bidders: number[], voters: Array<{ idx: number; weight: number; like: (bidder: number) => number }>, r: Rng): { host: number; rounds: Array<Record<number, number>>; ballots: Record<number, number> } {
  let left = bidders.slice(); const rounds: Array<Record<number, number>> = []; let ballots: Record<number, number> = {}; // ballots: 마지막 투표에서 나라(idx) → 고른 신청국(표 준 나라에 고마움, 2026-10-31)
  while (left.length > 1) {
    const tally: Record<number, number> = {}; for (const b of left) tally[b] = 0; ballots = {};
    for (const v of voters) { const choice = left.map((b) => ({ b, s: (b === v.idx ? 2 : 0) + v.like(b) + r() * OLYMPIC.voteBias })).sort((x, y) => y.s - x.s)[0]; tally[choice.b] += v.weight; ballots[v.idx] = choice.b; }
    rounds.push(tally); const tot = Object.values(tally).reduce((n, x) => n + x, 0), top = left.slice().sort((x, y) => tally[y] - tally[x]);
    if (tally[top[0]] * 2 > tot || left.length === 2) return { host: top[0], rounds, ballots };
    left = top.slice(0, -1);
  }
  return { host: left[0] ?? -1, rounds, ballots };
}
/** 8개국 토너먼트: 8강·4강·결승·3위전. 결과: 금·은·동 나라 번호. */
export function olympicBracket(teams: TeamDef[], seedBase: number): { games: Array<{ a: number; b: number; seed: number; winner: 0 | 1; eng?: number }>; gold: number; silver: number; bronze: number } {
  const games: Array<{ a: number; b: number; seed: number; winner: 0 | 1; eng?: number }> = [];
  const play = (a: number, b: number) => { const seed = hashSeed(`${seedBase}:${a}:${b}:${games.length}`), r = playOut(teams[a], teams[b], seed); games.push({ a, b, seed, winner: r.winner, eng: ENGINE }); return r.winner === 0 ? [a, b] : [b, a]; };
  const order = teams.map((t, i) => ({ i, r: teamRating(t) })).sort((x, y) => y.r - x.r).map((x) => x.i);
  const qf = [[order[0], order[7]], [order[3], order[4]], [order[1], order[6]], [order[2], order[5]]].map(([a, b]) => play(a, b)[0]);
  const s1 = play(qf[0], qf[1]), s2 = play(qf[2], qf[3]), f = play(s1[0], s2[0]), br = play(s1[1], s2[1]);
  return { games, gold: f[0], silver: f[1], bronze: br[0] };
}
export { seeded, hashSeed, playOut, teamRating, winChance, odds, ROLES };

// ---------------- 메타 패치·무기 순차 출시·글로벌 밴 (2026-10-30 팀파이트 매니저 참고) ----------------
/** 처음엔 자리마다 8개(40개)만. 밸런스 패치는 1년에 2번(시즌 시작·중반), 새 무기는 5년마다 6개(사용자 결정 2026-10-30) — 약 50년이면 100개가 다 나옴. */
export const META = { firstPerRole: 8, newPerPatch: 6, releaseEvery: 5, minGames: 6, hiWin: 0.56, loWin: 0.44, hiBan: 0.35, step: [0.03, 0.06] as [number, number], cap: 0.15, globalBanChance: 0.06 } as const;
export interface WeaponStat { picks: number; wins: number; bans: number }
export interface MetaState { since?: number; patch: number; released: string[]; adj: Record<string, { atk: number; def: number }>; stats: Record<string, WeaponStat>; games: number; notes: Array<{ patch: number; season: number; lines: Array<[string, string]> }>; globalBan?: { weapon: string; round: number; season: number } }
export function firstRelease(seedStr: string): string[] {
  const r = seeded(hashSeed(seedStr)); return ROLES.flatMap((role) => WEAPONS.filter((w) => w.role === role).map((w) => ({ w, k: r() })).sort((a, b) => a.k - b.k).slice(0, META.firstPerRole).map((x) => x.w.id));
}
/** 패치 배율 적용된 무기 성질. */
export function patchedMods(meta: MetaState | undefined, id: string): WeaponMods | undefined {
  const w = weaponById(id); if (!w) return undefined; const a = meta?.adj[id]; if (!a) return w.m;
  return { ...w.m, atk: +(w.m.atk * (1 + a.atk)).toFixed(3), def: +(w.m.def * (1 + a.def)).toFixed(3) };
}
/** 패치 하나: 승률·밴율을 보고 너프/버프(무작위 폭), release 면 새 무기 출시, 통계 초기화. 결과: 패치 노트 줄(한·영). */
export function runPatch(meta: MetaState, season: number, r: Rng, release = true): Array<[string, string]> {
  const lines: Array<[string, string]> = [], g = Math.max(1, meta.games), nm = (id: string) => weaponById(id)!;
  for (const id of meta.released) {
    const st = meta.stats[id]; if (!st) continue; const wr = st.picks >= META.minGames ? st.wins / st.picks : 0.5, br = st.bans / g;
    let dir = 0; if (wr >= META.hiWin || br >= META.hiBan) dir = -1; else if (st.picks >= META.minGames && wr <= META.loWin) dir = 1; if (!dir) continue;
    const a = (meta.adj[id] ??= { atk: 0, def: 0 }), key = r() < 0.5 ? 'atk' : 'def', amt = META.step[0] + r() * (META.step[1] - META.step[0]);
    a[key] = Math.max(-META.cap, Math.min(META.cap, a[key] + dir * amt)); const pct = Math.round(amt * 100), w = nm(id);
    lines.push(dir < 0 ? [`${w.ko} 하향: ${key === 'atk' ? '공격' : '방어'} −${pct}% (승률 ${Math.round(wr * 100)}% · 밴 ${Math.round(br * 100)}%)`, `${w.en} nerfed: ${key === 'atk' ? 'attack' : 'defense'} −${pct}% (win ${Math.round(wr * 100)}% · ban ${Math.round(br * 100)}%)`]
      : [`${w.ko} 상향: ${key === 'atk' ? '공격' : '방어'} +${pct}% (승률 ${Math.round(wr * 100)}%)`, `${w.en} buffed: ${key === 'atk' ? 'attack' : 'defense'} +${pct}% (win ${Math.round(wr * 100)}%)`]);
  }
  const unreleased = release ? WEAPONS.filter((w) => !meta.released.includes(w.id)).sort(() => r() - 0.5).slice(0, META.newPerPatch) : [];
  for (const w of unreleased) { meta.released.push(w.id); lines.push([`새 무기: ${w.ko}`, `New weapon: ${w.en}`]); }
  meta.patch++; meta.stats = {}; meta.games = 0; meta.notes.push({ patch: meta.patch, season, lines }); meta.notes = meta.notes.slice(-12);
  return lines;
}
/** 경기 결과를 무기 통계에 넣음(픽·승·밴). */
export function recordDraft(meta: MetaState, d: Draft, winner: 0 | 1): void {
  meta.games++;
  for (const side of [0, 1] as const) { for (const p of d.picks[side]) { const st = (meta.stats[p.weapon] ??= { picks: 0, wins: 0, bans: 0 }); st.picks++; if (side === winner) st.wins++; } for (const b of d.bans[side]) (meta.stats[b] ??= { picks: 0, wins: 0, bans: 0 }).bans++; }
}

// ---------------- 후원 미션 (구단이 후원사에게 시즌 목표 제시) ----------------
export type MissionKind = 'top4' | 'final' | 'champion' | 'winning' | 'kills' | 'mvps' | 'warden';
/** 목표(한·영 문구), 보상 = 후원금 × mult. 팀 전력 순위에 맞춰 고름(강팀일수록 어려운 목표). */
export const MISSIONS: Record<MissionKind, { ko: (n: number) => string; en: (n: number) => string; mult: number }> = {
  champion: { ko: () => '리그 우승', en: () => 'Win the league', mult: 1.6 },
  final: { ko: () => '결승 진출(정규 시즌 2위 안)', en: () => 'Reach the final (top 2 in the regular season)', mult: 1.1 },
  top4: { ko: () => '4강(정규 시즌 4위 안)', en: () => 'Finish in the top 4', mult: 0.8 },
  winning: { ko: (n) => `정규 시즌 ${n}승 이상`, en: (n) => `Win ${n}+ regular-season matches`, mult: 0.6 },
  kills: { ko: (n) => `시즌 킬 ${n} 이상`, en: (n) => `${n}+ kills this season`, mult: 0.5 },
  mvps: { ko: (n) => `경기 MVP ${n}번 이상`, en: (n) => `${n}+ match MVPs`, mult: 0.6 },
  warden: { ko: (n) => `심연 수호자 ${n}번 이상 처치`, en: (n) => `Slay the Abyssal Warden ${n}+ times`, mult: 0.5 },
};
export function pickMission(rank: number, r: Rng): { kind: MissionKind; n: number } {
  const pool: Array<{ kind: MissionKind; n: number }> = rank <= 1 ? [{ kind: 'champion', n: 0 }, { kind: 'final', n: 0 }, { kind: 'mvps', n: 6 }] : rank <= 3 ? [{ kind: 'final', n: 0 }, { kind: 'top4', n: 0 }, { kind: 'kills', n: 120 }, { kind: 'warden', n: 10 }] : [{ kind: 'top4', n: 0 }, { kind: 'winning', n: 4 }, { kind: 'kills', n: 100 }, { kind: 'mvps', n: 4 }, { kind: 'warden', n: 7 }];
  return pool[Math.floor(r() * pool.length)];
}

// ---------------- 장비 후원 (증강현실 장비, 팀 전체) ----------------
export type GearSlot = 'visor' | 'gloves' | 'chair' | 'suit';
export const GEAR: Record<GearSlot, [string, string]> = { visor: ['증강현실 바이저', 'AR Visor'], gloves: ['반응 장갑', 'Reflex Gloves'], chair: ['신경 동조 의자', 'Neural Chair'], suit: ['전술 전투복', 'Tactical Suit'] };
export const GEAR_GRADES: Array<{ ko: string; en: string; cost: number; bonus: number }> = [
  { ko: '일반', en: 'Common', cost: 300, bonus: 0.4 }, { ko: '고급', en: 'Fine', cost: 800, bonus: 0.8 }, { ko: '희귀', en: 'Rare', cost: 2000, bonus: 1.2 }, { ko: '전설', en: 'Legendary', cost: 5000, bonus: 1.6 },
];
export const GEAR_SEASONS = 2; // 장비는 2시즌 쓰면 낡음
/** 팀 장비 보너스(실력 +, 4종 전설이면 +6.4). */
export const gearBonus = (gear: Partial<Record<GearSlot, { grade: number; until: number }>> | undefined, season: number): number => Object.values(gear ?? {}).reduce((n, g) => n + (g && g.until >= season ? GEAR_GRADES[g.grade]?.bonus ?? 0 : 0), 0);

// ---------------- 이벤트 매치(올스타전) 규칙 ----------------
export const ALLSTAR_RULES: Array<{ id: string; ko: string; en: string; descKo: string; descEn: string; rules: Rules; banKind?: string }> = [
  { id: 'fortress', ko: '철벽', en: 'Fortress', descKo: '모두 방어 3배', descEn: 'Everyone\'s defense ×3', rules: { def: 3 } },
  { id: 'brawl', ko: '난타전', en: 'Brawl', descKo: '모두 공격 1.5배', descEn: 'Everyone\'s attack ×1.5', rules: { atk: 1.5 } },
  { id: 'mustang', ko: '야생마', en: 'Wild Horses', descKo: '이동 1.3배', descEn: 'Movement ×1.3', rules: { speed: 1.3 } },
  { id: 'speed', ko: '스피드 게임', en: 'Speed Game', descKo: '핵 체력 절반', descEn: 'Cores at half health', rules: { coreHp: 80 } },
  { id: 'onepunch', ko: '묵직한 한 방', en: 'Heavy Hitter', descKo: '큰 한 방 피해 2배', descEn: 'Critical hits deal double', rules: { crit: 2 } },
  { id: 'warden', ko: '수호자 축제', en: 'Warden Festival', descKo: '심연 수호자가 자주 나옴', descEn: 'The Abyssal Warden returns often', rules: { objEvery: 120 } },
  { id: 'noburst', ko: '폭발형 금지', en: 'No Burst', descKo: '폭발형 무기 금지', descEn: 'Burst weapons banned', rules: {}, banKind: 'X' },
  { id: 'notank', ko: '탱커형 금지', en: 'No Tanks', descKo: '탱커형 무기 금지', descEn: 'Tank weapons banned', rules: {}, banKind: 'T' },
];
