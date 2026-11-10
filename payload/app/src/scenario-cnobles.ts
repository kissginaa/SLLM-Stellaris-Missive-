// 회랑의 귀족(시나리오 「회랑의 삼파전」, 2026-11-08) — 순수 규칙. 앱 쪽: src/features/scenario-cnobles-app.ts
// 설계: docs/SCENARIO_CORRIDOR_DEATH_AND_CORRIDOR_NOBLES_DESIGN_20261108_KO.md 3장.
// 플레이어가 회랑 자리일 때, 강대국 땅(귀족 영지·군주 직할)을 차지하면 그 땅을 원래 주인 단위(묶음 = 원래 귀족 번호, 직할령 -1/-2)로 묶어
// 「정복지 처분」을 기다린다: ① 괴뢰국 ② 우리 지도자를 귀족으로 앉히기 ③ 직할령.
// 성격 점수(2026-11-08 사용자: 「특성은 찍으면 영구적인걸로 해. 다른 요소로 추가적으로 얻는게 아니라, 4점 디폴트고 부정적찍으면 +1점씩인걸로」):
//   기본 4점. 다섯 축(강대국 귀족과 같은 축: 명예·자비·관대·용맹·계산)마다 −2~+2. 긍정(+) 1칸에 1점을 쓰고, 부정(−) 1칸마다 1점을 더 받는다.
//   임명할 때 한 번만 찍고 영구(다시 찍기·추가 점수 없음). 게임 지도자 특성(자비 등)은 읽지 않는다.
import type { Traits } from './scenario-nobles';

export const CN = {
  base: 4,            // 기본 점수
  loyalStart: 62,     // 처음 충성(성격으로 더하고 뺀다)
  drift: 0.25,        // 해마다 목표 충성으로 다가가는 몫
  warnAt: 45,         // 이 아래 「불온」
  riskAt: 30,         // 이 아래면 해마다 배신 굴림
  betrayMax: 0.6,
  talkLoyal: 3,       // 접견 한 번의 말솜씨(warmth −2~+2)마다 충성
  talkCapYear: 12,    // 한 해에 접견으로 올릴 수 있는 충성 한도
  keepLog: 60,
  // 우리 쪽도 당한다(2026-11-08): 의심이 높은 강대국이 우리 귀족 곁의 하인을 매수한다. 들어오면 충성의 자리 −8, 「내부 단속」(에너지)으로 걷어낸다
  spyBase: 0.08, spySus: 1 / 400, spyLoyal: 8, purgeCost: 300, purgeLoyal: -2,
  // 관계망(2026-11-08 사용자: 「회랑의 귀족도 그들 사이에 낄 수 있게」): 소개로 친분, 접견에서 「정략 혼인」을 명하면 혼인.
  // 친분·혼인 상대의 속마음(충성)을 해마다 알게 되고, 혼인 상대는 해마다 자기 군주에게서 조금씩 멀어진다. 대신 혼인 상대가 몰락하면 우리 귀족이 흔들린다.
  matchLoyal: 45,     // 이 충성 아래면 「나를 흥정거리로 쓰냐」며 거절(충성 −3)
  matchRel: 30, matchTargetLoyal: 50, // 상대 가문이 받는 조건: 플레이어와 친밀 30 이상, 또는 상대 충성 50 아래
  matchBonus: 10, matchPull: -5, tiePull: -2, tieGrief: -10, maxTies: 3,
};

export type CnState = 'pending' | 'noble' | 'direct';
export type CnGone = 'betray' | 'free' | 'dead' | 'dismissed' | 'lost';
export interface CnNoble { lid: number; name: string; key: number; tr: Traits; loyal: number; since: string; talkY?: number; talkN?: number; gone?: { why: CnGone; d: string; to?: 'a' | 'b' }; /** 강대국이 심어 둔 첩자(그 강대국) */ spy?: 'a' | 'b'; /** 강대국 귀족과의 인연(2026-11-08): friend 친분(소개로) · union 혼인(정략 혼인) */ ties?: CnTie[] }
export interface CnTie { id: number; k: 'friend' | 'union'; d: string; g?: 1 /* 혼인 상대가 몰락해 이미 흔들린 뒤 */ }
export interface CnGroup { st: CnState; since: string; lid?: number; told?: 1 }
export interface CnSave {
  v: 1;
  land: Record<string, number>;      // 회랑이 차지한 강대국 땅: 지도 번호 → 묶음(원래 주인: 귀족 번호, 군주 직할 -1/-2)
  grp: Record<string, CnGroup>;      // 묶음 → 처분 상태
  nobles: Record<string, CnNoble>;   // 지도자 번호(lid) → 회랑의 귀족(떠난 사람도 gone 으로 남김)
  puppets: Array<{ key: number; d: string; prev: boolean; sys?: number[] }>; // sys: 떼어 준 성계(지도 번호, 2026-11-08 — 지도에 속국 영역을 그린다)
  y: number;                         // 마지막 연례 판단 해
  log: Array<{ d: string; ko: string; en: string; grave?: boolean }>;
  realm?: string;                    // 우리 나라를 부르는 이름(2026-11-08 사용자: 「회랑 직할」·「회랑의 귀족」을 「OO 직할」·「OO의 귀족」으로). 비면 게임 속 나라 이름
}
export const newCnSave = (): CnSave => ({ v: 1, land: {}, grp: {}, nobles: {}, puppets: [], y: -1, log: [] });

const int = (x: unknown, lo: number, hi: number): number | null => { const n = Number(x); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
export function fixCnSave(o: unknown): CnSave {
  const s = (o && typeof o === 'object' ? o : {}) as Partial<CnSave>, out = newCnSave();
  if (s.land && typeof s.land === 'object') for (const [k, v] of Object.entries(s.land)) { const m = int(k, 0, 99999), g = int(v, -2, 99999); if (m !== null && g !== null) out.land[m] = g; }
  if (s.grp && typeof s.grp === 'object') for (const [k, v] of Object.entries(s.grp)) {
    const g = int(k, -2, 99999), x = (v ?? {}) as Partial<CnGroup>; if (g === null || !['pending', 'noble', 'direct'].includes(String(x.st))) continue;
    out.grp[g] = { st: x.st as CnState, since: String(x.since ?? ''), ...(int(x.lid, 0, 1e12) !== null ? { lid: Number(x.lid) } : {}), ...(x.told ? { told: 1 as const } : {}) };
  }
  if (s.nobles && typeof s.nobles === 'object') for (const [k, v] of Object.entries(s.nobles)) {
    const lid = int(k, 0, 1e12), x = (v ?? {}) as Partial<CnNoble>, tr = fixTraits(x.tr); if (lid === null || !tr) continue;
    const g = x.gone && typeof x.gone === 'object' ? x.gone : undefined;
    out.nobles[lid] = { lid, name: String(x.name ?? '').slice(0, 80), key: int(x.key, -2, 99999) ?? -1, tr, loyal: Math.max(0, Math.min(100, Number(x.loyal) || 0)), since: String(x.since ?? ''),
      ...(int(x.talkY, -1, 99999) !== null ? { talkY: Number(x.talkY), talkN: Math.max(0, Number(x.talkN) || 0) } : {}), ...(x.spy === 'a' || x.spy === 'b' ? { spy: x.spy } : {}),
      ...(Array.isArray(x.ties) && x.ties.length ? { ties: x.ties.filter((t) => t && Number.isInteger(Number(t.id)) && (t.k === 'friend' || t.k === 'union')).slice(0, 6).map((t) => ({ id: Number(t.id), k: t.k, d: String(t.d ?? '').slice(0, 20), ...(t.g ? { g: 1 as const } : {}) })) } : {}),
      ...(g && ['betray', 'free', 'dead', 'dismissed', 'lost'].includes(String(g.why)) ? { gone: { why: g.why as CnGone, d: String(g.d ?? ''), ...(g.to === 'a' || g.to === 'b' ? { to: g.to } : {}) } } : {}) };
  }
  if (Array.isArray(s.puppets)) for (const p of s.puppets) { const k = int(p?.key, -2, 99999); if (k !== null) { const sys = Array.isArray(p.sys) ? p.sys.map((x: unknown) => int(x, 0, 99999)).filter((x: number | null): x is number => x !== null).slice(0, 400) : []; out.puppets.push({ key: k, d: String(p.d ?? ''), prev: !!p.prev, ...(sys.length ? { sys } : {}) }); } }
  out.y = int(s.y, -1, 99999) ?? -1;
  if (typeof s.realm === 'string' && s.realm.trim()) out.realm = s.realm.replace(/[\r\n\t]/g, ' ').trim().slice(0, 24);
  if (Array.isArray(s.log)) out.log = s.log.filter((l) => l && typeof l.ko === 'string').slice(-CN.keepLog).map((l) => ({ d: String(l.d ?? ''), ko: String(l.ko), en: String(l.en ?? l.ko), ...(l.grave ? { grave: true } : {}) }));
  return out;
}

// ---- 성격 점수 ----
export function fixTraits(x: unknown): Traits | null {
  if (!Array.isArray(x) || x.length !== 5) return null;
  const t = x.map((v) => int(v, -2, 2)); if (t.some((v) => v === null)) return null;
  return t as Traits;
}
/** 받은 점수(기본 + 부정 칸마다 1) · 쓴 점수(긍정 칸마다 1) · 남은 점수. */
export function pointsOf(tr: Traits): { have: number; used: number; left: number } {
  let have = CN.base, used = 0; for (const v of tr) { if (v < 0) have += -v; else used += v; }
  return { have, used, left: have - used };
}
/** 임명할 때 받는 성격: 칸이 바르고 점수를 넘기지 않아야. 못 쓰면 이유. */
export function checkTraits(x: unknown): Traits | 'bad' | 'over' { const t = fixTraits(x); if (!t) return 'bad'; return pointsOf(t).left < 0 ? 'over' : t; }

// ---- 충성·배신 ----
// 축: 0 명예(+)/교활(−) · 1 자비/잔혹 · 2 관대/인색 · 3 용맹(야심)/신중 · 4 계산(침착)/충동
/** 성격이 정하는 충성의 자리(해마다 여기로 다가간다). press: 바깥 압력 0~1(강대국과의 긴장·전쟁). */
export function loyalTarget(tr: Traits, press: number): number {
  return Math.max(5, Math.min(95, 60 + tr[0] * 9 + tr[4] * 4 - tr[3] * 5 + (tr[2] > 0 ? 2 : 0) - Math.round(press * (12 - tr[0] * 3 - tr[4] * 2))));
}
export const loyalStart = (tr: Traits): number => Math.max(20, Math.min(95, CN.loyalStart + tr[0] * 8 + tr[4] * 3 - tr[3] * 2));
/** 한 해 배신 확률(충성이 riskAt 아래일 때만). 교활·야심은 올리고, 명예·계산은 내린다. */
export function betrayChance(n: CnNoble): number {
  if (n.loyal >= CN.riskAt) return 0;
  const tr = n.tr;
  const p = (CN.riskAt - n.loyal) / 60 + (tr[0] < 0 ? -tr[0] * 0.08 : -tr[0] * 0.04) + (tr[3] > 0 ? tr[3] * 0.06 : 0) - (tr[4] > 0 ? tr[4] * 0.05 : 0) + (tr[4] < 0 ? -tr[4] * 0.03 : 0);
  return Math.max(0, Math.min(CN.betrayMax, p));
}
/** 배신의 모양: 원래 귀족 영지였고 야심(용맹)이 있거나 충동적이면 독립, 아니면 그 땅의 원래 강대국으로 귀순. */
export function betrayKind(n: CnNoble, roll: number): 'free' | 'betray' { return n.key >= 0 && (n.tr[3] > 0 || n.tr[4] < 0 || roll < 0.3) ? 'free' : 'betray'; }
/** 땅의 원래 강대국. 귀족 영지면 그 귀족의 진영(sideOf 로 받음). */
export const sideOfKey = (key: number, sideOf: (id: number) => 'a' | 'b' | undefined): 'a' | 'b' => (key === -1 ? 'a' : key === -2 ? 'b' : sideOf(key) ?? 'a');
export const loyalWord = (v: number): [string, string] => (v >= 70 ? ['충성', 'Loyal'] : v >= CN.warnAt ? ['평온', 'Content'] : v >= CN.riskAt ? ['불온', 'Restless'] : ['배신 위험', 'Treacherous']);

/** 연례: 충성을 성격의 자리로 끌고(약간 흔들림), 배신할 사람을 고른다. rnd(키) → 0~1(세이브·해·사람마다 같은 값). */
export function cnYear(s: CnSave, year: number, press: (n: CnNoble) => number, rnd: (k: string) => number, sus: { a: number; b: number } = { a: 0, b: 0 }, spied: Array<{ n: CnNoble; by: 'a' | 'b' }> = []): Array<{ n: CnNoble; kind: 'free' | 'betray' }> {
  if (s.y === year) return []; s.y = year;
  const out: Array<{ n: CnNoble; kind: 'free' | 'betray' }> = [];
  for (const n of Object.values(s.nobles)) {
    if (n.gone) continue;
    if (!n.spy) { const by: 'a' | 'b' = sus.b > sus.a ? 'b' : 'a'; /* 우리를 더 의심하는 강대국이 */ if (sus[by] >= 30 && rnd(`s${n.lid}:${year}`) < CN.spyBase + sus[by] * CN.spySus) { n.spy = by; spied.push({ n, by }); } }
    const t = loyalTarget(n.tr, press(n)) - (n.spy ? CN.spyLoyal : 0), j = Math.round((rnd(`j${n.lid}:${year}`) - 0.5) * 8);
    n.loyal = Math.max(0, Math.min(100, Math.round(n.loyal + (t - n.loyal) * CN.drift + j)));
    const p = betrayChance(n); if (p > 0 && rnd(`b${n.lid}:${year}`) < p) out.push({ n, kind: betrayKind(n, rnd(`k${n.lid}:${year}`)) });
  }
  return out;
}
/** 접견 말솜씨로 충성(한 해 한도). 움직인 값. */
export function talkLoyal(n: CnNoble, warmth: number, year: number): number {
  if (n.talkY !== year) { n.talkY = year; n.talkN = 0; }
  const want = Math.max(-2, Math.min(2, Math.round(warmth))) * CN.talkLoyal;
  const d = want > 0 ? Math.min(want, CN.talkCapYear - (n.talkN ?? 0)) : want; if (!d) return 0;
  if (d > 0) n.talkN = (n.talkN ?? 0) + d;
  const v = Math.max(0, Math.min(100, n.loyal + d)), moved = v - n.loyal; n.loyal = v; return moved;
}

// ---- 정복지 ----
/** 세이브의 성계 주인으로 회랑이 차지한 강대국 땅을 맞춘다. owner: 영지 장부(지도 번호 → 원래 주인). 돌려줌: 새로 생긴 묶음 · 땅을 모두 잃은 묶음 · 이미 처분한 묶음에 새로 붙은 성계. */
export function cnSeeLand(s: CnSave, systems: Array<{ m: number; o: number }>, owner: Record<string, number>, me: number, date: string): { fresh: number[]; emptied: number[]; added: Array<{ g: number; m: number }> } {
  const before = new Set(Object.values(s.land)), fresh = new Set<number>(), added: Array<{ g: number; m: number }> = [];
  for (const q of systems) {
    if (q.m < 0) continue; const k = String(q.m);
    if (q.o === me) { if (s.land[k] === undefined && owner[k] !== undefined) { const g = owner[k]; s.land[k] = g; if (!s.grp[g]) { s.grp[g] = { st: 'pending', since: date }; fresh.add(g); } else if (s.grp[g].st !== 'pending' && !fresh.has(g)) added.push({ g, m: q.m }); } }
    else if (s.land[k] !== undefined) delete s.land[k];
  }
  const now = new Set(Object.values(s.land)), emptied: number[] = [];
  for (const g of before) if (!now.has(g)) emptied.push(g);
  for (const g of Object.keys(s.grp).map(Number)) if (!now.has(g)) delete s.grp[g];
  return { fresh: [...fresh].filter((g) => now.has(g)), emptied, added: added.filter((x) => now.has(x.g)) };
}
export const sysOf = (s: CnSave, key: number): number[] => Object.entries(s.land).filter(([, g]) => g === key).map(([m]) => Number(m)).sort((a, b) => a - b);
/** 이미 다른 묶음을 맡은 귀족인가. */
export const busyLid = (s: CnSave, lid: number): boolean => !!s.nobles[lid] && !s.nobles[lid].gone;
