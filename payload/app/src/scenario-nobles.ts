// 시나리오 「회랑의 삼파전」 귀족 — 충성도·친밀도·인연 규칙(순수, 2026-11-06). 설계: docs/SCENARIO_NOBLES_DESIGN_KO.md(SLLM_Dev_20261016)
// 사용자 결정: 계산은 전부 앱에서(게임은 섹터 보고와, 앱이 부를 때만 반란·귀순 실행) · 분기(게임 90일)마다 한 번 · 시작 충성도 100(국경 거점만 70~80)
//   · 성격 5가지(배너로드식) · 친밀도와 인연(삼국지13식, 이름은 스텔라리스식) · 서약·협약·비밀 회선과 정확한 충성도는 알아내야 보임.
// 데이터: src/scenario-nobles-data.ts(자동 생성, gen_nobles.py). 앱 연결: src/features/scenario-nobles-app.ts.
export type Pair = [string, string]; // [한국어, 영어]
export type NSide = 'a' | 'b';
export type BondKind = 'oath' | 'union' | 'accord' | 'rival' | 'back';
/** [명예, 자비, 관대, 용맹, 계산] — 각 -2~+2 */
export type Traits = [number, number, number, number, number];
export interface NobleRow { id: number; side: NSide; cls: string; g: 'm' | 'f' | 'x'; spec: string; border: boolean; /** 수도에서 가까운 순 묶음 1~3(지도 거점 단계, 연감 세력판의 지역 갈래) */ t?: number; tr: Traits; ko: string; en: string }
export type BondRow = [BondKind, number, number];

/** 사람 번호: 귀족은 거점 지도 번호, 통치자는 'A'·'B'·'P'. */
export type Who = number | 'A' | 'B' | 'P';
export const rulerOf = (s: NSide): 'A' | 'B' => (s === 'a' ? 'A' : 'B');
export const pairKey = (x: Who, y: Who): string => { const a = String(x), b = String(y); return a < b ? `${a}|${b}` : `${b}|${a}`; };

export const TRAIT_NAME: Array<[Pair, Pair]> = [
  [['명예로움', 'Honorable'], ['교활함', 'Devious']],
  [['자비로움', 'Merciful'], ['잔혹함', 'Cruel']],
  [['관대함', 'Generous'], ['인색함', 'Closefisted']],
  [['용맹함', 'Daring'], ['신중함', 'Cautious']],
  [['계산적', 'Calculating'], ['충동적', 'Impulsive']],
];
export const BOND_NAME: Record<BondKind, Pair> = { oath: ['서약', 'Oathbound'], union: ['혼약', 'Union'], accord: ['협약', 'Accord'], rival: ['경쟁자', 'Rival'], back: ['비밀 회선', 'Back Channel'] };
/** 처음부터 보이는 인연(공식) — 나머지는 알아내야 보인다. */
export const BOND_PUBLIC: Record<BondKind, boolean> = { oath: false, union: true, accord: false, rival: true, back: false };
/** 인연이 정해 주는 친밀도 시작값 */
export const BOND_START: Record<BondKind, number> = { oath: 85, union: 75, accord: 65, rival: -40, back: 45 };

// ---- 친밀도 단계(-100~100) ----
export const INTIMACY_STAGE: Array<{ min: number; name: Pair }> = [
  { min: 80, name: ['서약', 'Oathbound'] }, { min: 60, name: ['협약', 'Accord'] }, { min: 40, name: ['신뢰', 'Trusted'] },
  { min: 20, name: ['우호', 'Cordial'] }, { min: 0, name: ['접촉', 'Contact'] }, { min: -29, name: ['냉담', 'Cold'] },
  { min: -59, name: ['경쟁자', 'Rival'] }, { min: -100, name: ['숙적', 'Nemesis'] },
];
export function intimacyStage(v: number): Pair { for (const s of INTIMACY_STAGE) if (v >= s.min) return s.name; return INTIMACY_STAGE[INTIMACY_STAGE.length - 1].name; }

// ---- 충성도 단계(0~100) ----
export type LoyalStage = 0 | 1 | 2 | 3 | 4; // 충성 · 평온 · 불만 · 모반의 기미 · 반란 직전
export const LOYAL_STAGE: Pair[] = [['충성', 'Loyal'], ['평온', 'Content'], ['불만', 'Discontent'], ['모반의 기미', 'Conspiring'], ['반란 직전', 'On the Brink']];
export function loyalStage(v: number): LoyalStage { return v >= 70 ? 0 : v >= 40 ? 1 : v >= 25 ? 2 : v >= 10 ? 3 : 4; }

export const NB = { quarterDays: 90, brinkChance: 0.3, keepNotes: 300 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---- 저장 ----
export type Fate = 'rebel' | 'defect_p' | 'defect_other' | 'fallen'; // fallen: 영역다툼에서 땅을 모두 잃고 영구히 몰락(2026-11-07)
export interface NobleNote { d: string; id: number; kind: 'stage' | 'fate' | 'shift' | 'cascade' | 'reveal' | 'faction'; ko: string; en: string }
export interface NobleSave {
  v: 1;
  last: number;                 // 마지막으로 분기 계산을 한 게임 날(dayNo), 처음엔 -1
  date: string;                 // 마지막 계산 날짜(게임 날짜 문자열)
  loyal: Record<string, number>; // 귀족 번호 → 충성도
  fate: Record<string, Fate>;   // 이미 떨어져 나간 귀족(반란·귀순) — 더 계산하지 않는다
  pending: Record<string, Fate>; // 반란·귀순이 정해졌지만 게임에 아직 실행 안 됨(앱이 실행하면 fate 로 옮김)
  rel: Record<string, number>;  // pairKey → 친밀도
  known: Record<string, true>;  // 알아낸 인연(pairKey)
  knownLoyal: Record<string, true>; // 정확한 충성도를 알아낸 귀족
  notes: NobleNote[];
  flead?: Record<string, number>; // 하극상으로 바뀐 세력 대표(「a_core」 꼴 → 귀족 번호, 2026-11-07 — scenario-domains 의 gekTick)
}

/** 세이브 번호와 귀족 번호로 늘 같은 0~1 수(국경 시작값 등). */
export function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function newNobleSave(sid: string, nobles: NobleRow[], bonds: BondRow[]): NobleSave {
  const s: NobleSave = { v: 1, last: -1, date: '', loyal: {}, fate: {}, pending: {}, rel: {}, known: {}, knownLoyal: {}, notes: [] };
  for (const n of nobles) {
    s.loyal[n.id] = n.border ? 70 + Math.floor(hash01(`${sid}|loyal|${n.id}`) * 11) : 100;
    s.rel[pairKey(n.id, rulerOf(n.side))] = clamp(40 + n.tr[0] * 5, -100, 100); // 소속 통치자: 기본 신뢰, 명예로울수록 높다
    s.rel[pairKey(n.id, 'P')] = 0;                                              // 플레이어 나라 통치자: 접촉
  }
  for (const [k, a, b] of bonds) s.rel[pairKey(a, b)] = BOND_START[k];
  return s;
}

export function fixNobleSave(o: unknown, sid: string, nobles: NobleRow[], bonds: BondRow[]): NobleSave {
  const x = o as Partial<NobleSave> | null;
  const base = newNobleSave(sid, nobles, bonds);
  if (!x || typeof x !== 'object' || x.v !== 1) return base;
  const num = (r: unknown, lo: number, hi: number) => { const out: Record<string, number> = {}; if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (Number.isFinite(Number(v))) out[k] = clamp(Number(v), lo, hi); return out; };
  const fates = (r: unknown) => { const out: Record<string, Fate> = {}; if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (v === 'rebel' || v === 'defect_p' || v === 'defect_other' || v === 'fallen') out[k] = v; return out; };
  const flags = (r: unknown) => { const out: Record<string, true> = {}; if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (v === true) out[k] = true; return out; };
  return {
    v: 1, last: Number.isFinite(Number(x.last)) ? Number(x.last) : -1, date: String(x.date ?? ''),
    loyal: { ...base.loyal, ...num(x.loyal, 0, 100) }, fate: fates(x.fate), pending: fates(x.pending),
    rel: { ...base.rel, ...num(x.rel, -100, 100) }, known: flags(x.known), knownLoyal: flags(x.knownLoyal),
    notes: Array.isArray(x.notes) ? (x.notes as NobleNote[]).filter((n) => n && typeof n.ko === 'string').slice(-NB.keepNotes) : [],
    ...(x.flead && typeof x.flead === 'object' ? { flead: num(x.flead, 0, 1e9) } : {}),
  };
}

const note = (s: NobleSave, n: NobleNote) => { s.notes.push(n); if (s.notes.length > NB.keepNotes) s.notes.splice(0, s.notes.length - NB.keepNotes); };
const active = (s: NobleSave, id: number) => !s.fate[id] && !s.pending[id];

// ---- 분기 계산 ----
export interface QuarterInput {
  day: number;                  // 이번 보고의 게임 날(dayNo)
  date: string;
  lost: Set<number>;            // 섹터 보고에 자기 거점 섹터가 안 보이는(빼앗겼거나 점령된) 귀족
  war: Partial<Record<NSide, 'losing' | 'winning' | 'even' | 'none'>>;
  tensionStage: number;         // 대립 긴장도 단계(0 평온 ~ 5 개전 명분)
  rand: () => number;           // 0~1 (시험에서는 고정)
}
export interface QuarterResult { ran: boolean; changed: Array<{ id: number; from: number; to: number }>; stageUp: number[]; outcomes: Array<{ id: number; fate: Fate }> }

/** 성격으로 정해지는 기준값(시간이 지나면 이쪽으로 1씩 돌아간다). */
export function baselineOf(n: NobleRow, rulerRel: number): number { return clamp(Math.round(75 + n.tr[0] * 5 + rulerRel / 8), 30, 100); }

export function quarterTick(s: NobleSave, nobles: NobleRow[], bonds: BondRow[], q: QuarterInput): QuarterResult {
  const res: QuarterResult = { ran: false, changed: [], stageUp: [], outcomes: [] };
  if (s.last >= 0 && q.day - s.last < NB.quarterDays) return res;
  // 처음 계산이면 기준 날만 잡는다(시작하자마자 깎이지 않게)
  if (s.last < 0) { s.last = q.day; s.date = q.date; return res; }
  res.ran = true; s.last = q.day; s.date = q.date;
  for (const n of nobles) {
    if (!active(s, n.id)) continue;
    const [hon, , , , cal] = n.tr, from = s.loyal[n.id] ?? 100;
    let d = 0;
    const base = baselineOf(n, s.rel[pairKey(n.id, rulerOf(n.side))] ?? 0);
    if (from < base) d += 1; else if (from > base) d -= 1;
    if (q.lost.has(n.id)) d -= 6;
    const w = q.war[n.side];
    if (w === 'losing') d -= 3 + Math.max(0, cal);           // 계산적일수록 지는 싸움에 등을 돌린다
    else if (w === 'winning') d += 3;
    if (q.tensionStage >= 3) d += n.side === 'a' ? -1 : 1;  // 얼라이언스는 전쟁이 싫고, 제국은 동원이 반갑다
    const to = clamp(from + d, 0, 100);
    if (to !== from) { s.loyal[n.id] = to; res.changed.push({ id: n.id, from, to }); }
    if (loyalStage(to) > loyalStage(from)) {
      res.stageUp.push(n.id);
      const st = LOYAL_STAGE[loyalStage(to)];
      note(s, { d: q.date, id: n.id, kind: 'stage', ko: `${n.ko}: ${st[0]}`, en: `${n.en}: ${st[1]}` });
    }
    if (loyalStage(to) === 4) {
      const chance = NB.brinkChance * (hon >= 2 ? 0.5 : 1); // 명예로운 귀족은 쉽게 칼을 들지 않는다
      if (q.rand() < chance) {
        const fate = decideFate(s, n, bonds);
        s.pending[n.id] = fate; res.outcomes.push({ id: n.id, fate });
        note(s, { d: q.date, id: n.id, kind: 'fate', ko: `${n.ko}: ${FATE_NAME[fate][0]}`, en: `${n.en}: ${FATE_NAME[fate][1]}` });
      }
    }
  }
  return res;
}

export const FATE_NAME: Record<Fate, Pair> = { rebel: ['반란', 'Rebellion'], defect_p: ['플레이어 나라로 귀순', 'Defects to the player'], defect_other: ['상대 세력으로 귀순', 'Defects to the rival power'], fallen: ['몰락', 'Fallen'] };

/** 반란할지, 어디로 귀순할지. 플레이어와 신뢰 이상이면 플레이어에게, 계산적이고 진영을 넘는 비밀 회선이 깊으면 상대 세력에게, 아니면 독립 반란. */
export function decideFate(s: NobleSave, n: NobleRow, bonds: BondRow[]): Fate {
  if ((s.rel[pairKey(n.id, 'P')] ?? 0) >= 40) return 'defect_p';
  const cal = n.tr[4];
  if (cal >= 1) for (const [k, a, b] of bonds) if (k === 'back' && (a === n.id || b === n.id) && (s.rel[pairKey(a, b)] ?? 0) >= 60) return 'defect_other';
  return 'rebel';
}

// ---- 연쇄(누가 떨어져 나가면 인연으로 엮인 귀족이 흔들린다) ----
export const CASCADE: Record<BondKind, number> = { oath: -20, union: -15, accord: -10, rival: 8, back: 0 };
export function cascade(s: NobleSave, nobles: NobleRow[], bonds: BondRow[], id: number, date: string): Array<{ id: number; from: number; to: number }> {
  const out: Array<{ id: number; from: number; to: number }> = [];
  const by = new Map(nobles.map((n) => [n.id, n] as [number, NobleRow]));
  const src = by.get(id); if (!src) return out;
  for (const [k, a, b] of bonds) {
    if (a !== id && b !== id) continue;
    const other = a === id ? b : a, o = by.get(other);
    if (!o || !active(s, other) || o.side !== src.side || !CASCADE[k]) continue; // 같은 진영 안에서만 흔들린다
    const from = s.loyal[other] ?? 100, to = clamp(from + CASCADE[k], 0, 100);
    if (to === from) continue;
    s.loyal[other] = to; out.push({ id: other, from, to });
    note(s, { d: date, id: other, kind: 'cascade', ko: `${o.ko}: ${src.ko}의 일로 ${BOND_NAME[k][0]} 관계가 흔들림`, en: `${o.en}: shaken by ${src.en} (${BOND_NAME[k][1]})` });
  }
  return out;
}

/** 게임이 반란·귀순을 실제로 실행했을 때(앱이 확인한 뒤) 부른다: pending → fate, 연쇄. */
export function confirmFate(s: NobleSave, nobles: NobleRow[], bonds: BondRow[], id: number, date: string): Array<{ id: number; from: number; to: number }> {
  const f = s.pending[id]; if (!f) return [];
  delete s.pending[id]; s.fate[id] = f;
  return cascade(s, nobles, bonds, id, date);
}

// ---- 친밀도·충성도 바꾸기(접견·계략·선물 등에서) ----
export function shiftRel(s: NobleSave, x: Who, y: Who, d: number): number { const k = pairKey(x, y); const v = clamp((s.rel[k] ?? 0) + d, -100, 100); s.rel[k] = v; return v; }
export function shiftLoyal(s: NobleSave, id: number, d: number): number { if (!active(s, id)) return s.loyal[id] ?? 0; const v = clamp((s.loyal[id] ?? 100) + d, 0, 100); s.loyal[id] = v; return v; }

// ---- 공개 범위 ----
export const bondVisible = (s: NobleSave, k: BondKind, a: number, b: number): boolean => BOND_PUBLIC[k] || !!s.known[pairKey(a, b)];
export function reveal(s: NobleSave, a: number, b: number): boolean { const k = pairKey(a, b); if (s.known[k]) return false; s.known[k] = true; return true; }
/** 화면에 줄 충성도: 알아낸 귀족만 숫자, 아니면 단계만. */
export function loyalView(s: NobleSave, id: number): { stage: LoyalStage; v?: number } {
  const v = s.loyal[id] ?? 100; return s.knownLoyal[id] ? { stage: loyalStage(v), v } : { stage: loyalStage(v) };
}

/** AI 프롬프트용 한 덩어리(접견 상대 귀족). 알아낸 것만 넣지 않고, 귀족 본인의 마음이므로 실제 값을 쓴다(귀족이 자기 마음을 아는 것은 당연). */
export function noblePrompt(s: NobleSave, n: NobleRow, nobles: NobleRow[], bonds: BondRow[]): string {
  const tr = n.tr.map((v, i) => (v ? `${TRAIT_NAME[i][v > 0 ? 0 : 1][1]}${Math.abs(v) === 2 ? ' (strongly)' : ''}` : '')).filter(Boolean).join(', ') || 'balanced';
  const by = new Map(nobles.map((x) => [x.id, x] as [number, NobleRow]));
  const ties = bonds.filter(([, a, b]) => a === n.id || b === n.id).map(([k, a, b]) => `${BOND_NAME[k][1]} with ${by.get(a === n.id ? b : a)?.en ?? '?'}`).join('; ') || 'none';
  const lv = s.loyal[n.id] ?? 100, st = LOYAL_STAGE[loyalStage(lv)][1];
  const ruler = intimacyStage(s.rel[pairKey(n.id, rulerOf(n.side))] ?? 0)[1], me = intimacyStage(s.rel[pairKey(n.id, 'P')] ?? 0)[1];
  return `[Noble] ${n.en}, hereditary governor of the ${n.spec} hub sector (${n.side === 'a' ? 'Galactic Alliance' : 'Human Empire'}), 800-year noble house. Personality: ${tr}. Loyalty to own realm: ${st} (${lv}/100). Feeling toward own ruler: ${ruler}; toward the player's ruler: ${me}. Personal ties: ${ties}. Never reveal secret ties (Oathbound, Accord, Back Channel) unless trust is Trusted or higher.`;
}
