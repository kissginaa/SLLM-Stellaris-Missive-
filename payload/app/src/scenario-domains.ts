// 시나리오 「회랑의 삼파전」 귀족 영역다툼 · 귀족 외교(1단계) — 순수 규칙(2026-11-07).
// 설계: docs/SCENARIO_CORRIDOR_NOBLE_DIPLOMACY_DESIGN_20261107_KO.md (SLLM_Dev_20261016)
// 사용자 결정: 영지는 앱 안의 보이지 않는 선(게임은 제국 하나) · 1년에 한 번(연례 정보 회의 때) 움직인다 · 땅을 모두 잃은 귀족은 영구히 몰락.
// 성계 번호는 늘 「지도 번호」(SLLM_CR_SYS_<번호>, 세이브와 상관없이 같음). 귀족 번호 = 거점 지도 번호.
// 앱 연결: src/features/scenario-domains-app.ts
import { CR_MAP_SYS, CR_MAP_LANES, CR_MAP_SEATS } from './scenario-corridor-map-data';
import type { NobleRow, NSide } from './scenario-nobles';

export type PactKind = 'nap' | 'ally' | 'feud';
/** 반란 밀약(2단계): 주모자가 받아 둔 약속. 대가 — land 이기면 성계(sys)를 줌 · rank 새 나라의 2인자 · feud 함께 원수(tgt)를 침 */
export interface Pledge { who: number; k: 'land' | 'rank' | 'feud'; sys?: number; tgt?: number; since: number; seen: boolean }
export interface Plot { lead: number; since: number; pledges: Pledge[]; exposed: boolean; patron?: boolean } // patron: 회랑이 뒷배를 약속함
/** 국경 분쟁 청원: id 가 vs 에게 밀리고 있다며 군주에게 호소(y 해에) */
/** 성계 쟁탈 줄다리기(2026-11-07 사용자: 「하츠 오브 아이언 전투 현황판처럼 양옆 두 진영이 줄다리기」) */
export type AOp = 'bribe' | 'agitate' | 'settle' | 'force';
export type DOp = 'garrison' | 'appease';
export interface Front { by: number; p: number; mom: number; aOp: AOp; dOp: DOp; since: string; cool: number; aidA?: number; aidD?: number }
export interface Petition { id: number; vs: number; y: number; n: number; ai?: boolean; aided?: boolean; egged?: boolean } // ai: 플레이어가 아닌 군주에게 한 청원(다음 연례 판단 때 그 군주가 답함) · aided/egged: 회랑이 몰래 도움/상대를 부추김
export interface Pact { a: number; b: number; k: PactKind; since: number }
/** 하극상(2026-11-07 사용자: 「대표보다 강력해지면 그때는 도전」): 소가문 by 가 자기 세력 대표 vs 에게 도전. backA 도전자 편 · backD 대표 편 · took 대표에게서 빼앗은 성계 수 · aid 회랑의 돈 · crown 군주가 대표 편 */
/** 평화로운 독립 요구(2026-11-08 사용자: 「독립이란 기능」): 반란까지는 가지 않은 큰 귀족이 군주에게 제 영지를 놓아 달라고 청한다. back = 회랑이 뒤에서 밀어 줌. */
export interface Ind { id: number; side: NSide; y: number; back?: 1 }
export interface Gek { by: number; vs: number; side: NSide; fk: string; since: number; backA: number[]; backD: number[]; took: number; sc: number; tookY: number; aid?: 1; crown?: 1 } // sc: 판세(-100 대표 우세 ~ 100 도전자 우세) · tookY: 지난 판단 때까지 센 took
/** 영지 주인: 귀족 번호(≥0) · 얼라이언스 군주 직할 -1 · 제국 군주 직할 -2 */
export type Holder = number;
export const CROWN: Record<NSide, Holder> = { a: -1, b: -2 };
export interface DomLine { ko: string; en: string; grave?: boolean }
export interface DomainSave {
  v: 1;
  year: number;                                   // 마지막으로 연례 판단을 한 해(처음 -1)
  owner: Record<string, Holder>;                  // 지도 번호 → 영지 주인(귀족 영지와 직할령만, 회랑·빈 땅은 없음)
  init: Record<string, number>;                   // 귀족 → 처음 영지 크기
  pend: Record<string, { by: number; y: number }>; // 넘어갈 예정(한 해 더 이어지면 넘어감)
  dg: Record<string, number>;                     // 귀족 둘 사이 영역다툼에서 생긴 감정(호감도에 더함, 해마다 20%씩 옅어짐)
  pacts: Pact[];
  fallen: Record<string, { by: number; y: number; why?: DeathWhy }>; // 몰락(영구) · why 가 있으면 영구 사망(2026-11-08): 반란 실패 · 정복 · 처형 · 공개 처형 · 암살 · 거점 함락
  indRef?: Record<string, number>;                 // 독립 요구를 거절당한 해(귀족 번호 → 해) — 그 뒤 반란이 실패하면 공개 처형(2026-11-08)
  big: Record<string, true>;                      // 처음 크기의 150%를 넘어 견제를 받은 귀족(한 번만)
  amb: Record<string, number>;                    // 올해의 야심(0.8~1.3, 해마다 새로 굴림) — 같은 힘이라도 해마다 미는 기세가 다르다
  hist: Array<{ y: number; ch: Array<[number, Holder, Holder]>; lines: DomLine[] }>;
  grantY: number;                                 // 군주 하사를 마지막으로 쓴 해
  plots: Plot[];                                  // 2단계: 반란 밀약
  oaths: Record<string, number>;                  // 2단계: 군주 충성 서약(귀족 → 맺은 해)
  oathY: { y: number; n: number };                // 올해 받은 서약 수
  rvq: Array<{ lead: number; members: number[]; why: 'plot' | 'incite' | 'grant' }>; // 게임이 아직 준비 안 돼 미룬 반란
  lost: Record<string, true>;                     // 게임에서 이미 제국 밖으로 나간 성계(전쟁·점령) — 영지 계산에서 뺀다
  lock: Record<string, number>;                   // 이 해까지 넘어가지 않는 성계(군주가 편들어 줌)
  disp: Record<string, number>;                   // 「밀리는 귀족|미는 귀족」 국경 분쟁이 이어진 해 수
  pets: Petition[];                               // 국경 분쟁 청원(밀리는 귀족이 군주에게)
  arrestY: number;                                // 주모자 체포를 마지막으로 쓴 해
  boost: Record<string, number>;                  // 다음 해 야심에 곱할 값(회랑이 몰래 도움·부추김)
  front: Record<string, Front>;                   // 성계 쟁탈 줄다리기(달마다): 지도 번호 → 도전자·장악 진척도·공작
  lastM: string;                                  // 마지막으로 달 계산을 한 달(YYYY.MM)
  buf: { ch: Array<[number, Holder, Holder]>; lines: DomLine[] }; // 올해 달마다 넘어간 성계(연말 보고서에 모아 실음)
  medY: number;                                   // 중재를 마지막으로 쓴 해
  gar: Record<string, [number, number, number]>;  // 영지 수비대: 귀족 → 게임에 마지막으로 보낸 [방어 플랫폼 수, 민병대 수, 손 놓음 1/0]
  garY: number;                                   // 수비대를 마지막으로 다시 짠 해(연례 회의 때만)
  garOk: Partial<Record<NSide, 1>>;               // 그 강대국의 숨은 수비대 나라를 만들었음
  gek: Gek[];                                     // 진행 중인 하극상
  gekY: Record<string, number>;                   // 세력(「a_core」 꼴) → 마지막 하극상이 끝난 해(쉬는 기간)
  coreV?: 1;                                      // 수도 섹터 거점 귀족 넷에게 영지를 나눠 준 세이브(2026-11-08)
  rebel: Record<string, number>;                  // 반란으로 떨어져 나간 성계(지도 번호) → 반란 주모자(2026-11-08 — 지도에서 그 땅을 반란국으로)
  rebelY: Record<string, number>;                 // 반란 주모자 → 반란한 해
  rebelW: Record<string, string>;                 // 반란 주모자 → 왜 일어났나(incite = 회랑이 부추김 · plot = 스스로 밀약)
  rebelG: Record<string, number>;                 // 반란 주모자 → 회랑이 넘겨준 함대 수(함대 이양)
  ind: Ind[];                                     // 군주 앞에 걸린 평화로운 독립 요구(2026-11-08)
  indY: Record<string, number>;                   // 귀족 → 마지막으로 독립을 요구한 해(쉬는 기간)
}

export const DM = {
  hopMax: 7, decay: 0.75, keep: 1.1, flip: 1.1, contest: 0.85, napCut: 0.5, ambLo: 0.8, ambHi: 1.3,
  dgFade: 0.8, friction: -5, lossPer: -15, lossCap: -45, loyalLoss: -3, bigAt: 1.5, bigDg: -10, fallAllyDg: -20,
  nap: 20, napBreak: -10, ally: 60, allyBreak: 30, feud: -50, feudEnd: -20, napChance: 0.5, allyChance: 0.3, breakTrust: -5,
  allyBoost: 1.2, feudBoost: 1.25, grantLoyal: 8, grantLoser: -10, grantDg: -20, medDg: 20, medLoyal: -2, histKeep: 30,
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const pk = (a: number, b: number): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

// ---- 항로 그래프(처음 배치 지도, 고정) ----
const ADJ = new Map<number, number[]>();
for (const [a, b] of CR_MAP_LANES) { (ADJ.get(a) ?? ADJ.set(a, []).get(a)!).push(b); (ADJ.get(b) ?? ADJ.set(b, []).get(b)!).push(a); }
export const adjOf = (id: number): number[] => ADJ.get(id) ?? [];
const NAME = new Map(CR_MAP_SYS.map((r) => [r[0], [r[4], r[5]] as [string, string]]));
export const sysName = (id: number): [string, string] => NAME.get(id) ?? [String(id), String(id)];
const hopCache = new Map<number, Map<number, number>>();
/** 거점에서 항로로 몇 칸인지(hopMax 까지). */
export function hopsFrom(src: number): Map<number, number> {
  let m = hopCache.get(src); if (m) return m;
  m = new Map([[src, 0]]); const q = [src];
  for (let i = 0; i < q.length; i++) { const d = m.get(q[i])!; if (d >= DM.hopMax) continue; for (const n of adjOf(q[i])) if (!m.has(n)) { m.set(n, d + 1); q.push(n); } }
  hopCache.set(src, m); return m;
}

/** 처음 영지: 앱이 처음 배치 섹터 지도(buildSectorMap)로 나눈 결과를 넘겨준다. */
export function newDomainSave(owner: Record<string, Holder>): DomainSave {
  const init: Record<string, number> = {}; for (const v of Object.values(owner)) if (v >= 0) init[v] = (init[v] ?? 0) + 1;
  return { v: 1, year: -1, owner: { ...owner }, init, pend: {}, dg: {}, pacts: [], fallen: {}, big: {}, amb: {}, hist: [], grantY: -1, medY: -1, plots: [], oaths: {}, oathY: { y: -1, n: 0 }, rvq: [], lost: {}, lock: {}, disp: {}, pets: [], arrestY: -1, boost: {}, front: {}, lastM: '', buf: { ch: [], lines: [] }, gar: {}, garY: -1, garOk: {}, gek: [], gekY: {}, coreV: 1, rebel: {}, rebelY: {}, rebelW: {}, rebelG: {}, ind: [], indY: {} };
}
export function fixDomainSave(o: unknown, fresh: () => DomainSave): DomainSave {
  const x = o as Partial<DomainSave> | null; if (!x || typeof x !== 'object' || x.v !== 1 || !x.owner || typeof x.owner !== 'object') return fresh();
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const nums = (r: unknown) => { const out: Record<string, number> = {}; if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (Number.isFinite(Number(v))) out[k] = Number(v); return out; };
  const pacts = Array.isArray(x.pacts) ? x.pacts.filter((p) => p && Number.isFinite(p.a) && Number.isFinite(p.b) && (p.k === 'nap' || p.k === 'ally' || p.k === 'feud')).map((p) => ({ a: p.a, b: p.b, k: p.k, since: n(p.since, 0) })) : [];
  const recs = (r: unknown) => { const out: Record<string, { by: number; y: number; why?: DeathWhy }> = {}; if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (v && typeof v === 'object') { const w = (v as { why?: unknown }).why; out[k] = { by: n((v as { by: unknown }).by, -1), y: n((v as { y: unknown }).y, 0), ...(DEATH_WHY.includes(w as DeathWhy) ? { why: w as DeathWhy } : {}) }; } return out; };
  return {
    v: 1, year: n(x.year, -1), owner: nums(x.owner), init: nums(x.init), pend: recs(x.pend), dg: nums(x.dg), pacts, fallen: recs(x.fallen),
    big: x.big && typeof x.big === 'object' ? Object.fromEntries(Object.keys(x.big).map((k) => [k, true as const])) : {},
    amb: nums(x.amb),
    hist: Array.isArray(x.hist) ? x.hist.filter((h) => h && Number.isFinite(h.y) && Array.isArray(h.ch)).slice(-DM.histKeep) : [], grantY: n(x.grantY, -1), medY: n(x.medY, -1),
    plots: Array.isArray(x.plots) ? x.plots.filter((p) => p && Number.isFinite(p.lead) && Array.isArray(p.pledges)).map((p) => ({ lead: p.lead, since: n(p.since, 0), exposed: !!p.exposed, ...(p.patron ? { patron: true } : {}), pledges: p.pledges.filter((q) => q && Number.isFinite(q.who) && (q.k === 'land' || q.k === 'rank' || q.k === 'feud')).map((q) => ({ who: q.who, k: q.k, ...(Number.isFinite(q.sys) ? { sys: q.sys } : {}), ...(Number.isFinite(q.tgt) ? { tgt: q.tgt } : {}), since: n(q.since, 0), seen: !!q.seen })) })) : [],
    oaths: nums(x.oaths), oathY: x.oathY && typeof x.oathY === 'object' ? { y: n(x.oathY.y, -1), n: n(x.oathY.n, 0) } : { y: -1, n: 0 },
    lost: x.lost && typeof x.lost === 'object' ? Object.fromEntries(Object.keys(x.lost).map((k) => [k, true as const])) : {}, lock: nums(x.lock), disp: nums(x.disp), ...(x.indRef && typeof x.indRef === 'object' ? { indRef: nums(x.indRef) } : {}),
    pets: Array.isArray(x.pets) ? x.pets.filter((q) => q && Number.isFinite(q.id) && Number.isFinite(q.vs)).map((q) => ({ id: q.id, vs: q.vs, y: n(q.y, 0), n: n(q.n, 0), ...(q.ai ? { ai: true } : {}), ...(q.aided ? { aided: true } : {}), ...(q.egged ? { egged: true } : {}) })) : [], arrestY: n(x.arrestY, -1), boost: nums(x.boost),
    front: (() => { const out: Record<string, Front> = {}; const AO = ['bribe', 'agitate', 'settle', 'force'], DO = ['garrison', 'appease']; if (x.front && typeof x.front === 'object') for (const [k, v] of Object.entries(x.front)) { const f = v as Partial<Front>; if (!f || !Number.isFinite(f.by) || !Number.isFinite(f.p)) continue; out[k] = { by: Number(f.by), p: clamp(Number(f.p), 0, 100), mom: n(f.mom, 0), aOp: (AO.includes(String(f.aOp)) ? f.aOp : 'settle') as AOp, dOp: (DO.includes(String(f.dOp)) ? f.dOp : 'appease') as DOp, since: String(f.since ?? ''), cool: n(f.cool, 0), ...(f.aidA ? { aidA: n(f.aidA, 0) } : {}), ...(f.aidD ? { aidD: n(f.aidD, 0) } : {}) }; } return out; })(),
    lastM: String(x.lastM ?? ''), buf: x.buf && Array.isArray(x.buf.ch) && Array.isArray(x.buf.lines) ? { ch: x.buf.ch, lines: x.buf.lines } : { ch: [], lines: [] },
    gar: (() => { const out: Record<string, [number, number, number]> = {}; if (x.gar && typeof x.gar === 'object') for (const [k, v] of Object.entries(x.gar)) if (Array.isArray(v) && v.length === 3 && v.every((q) => Number.isFinite(q))) out[k] = [Number(v[0]), Number(v[1]), Number(v[2]) ? 1 : 0]; return out; })(),
    garY: n(x.garY, -1), garOk: x.garOk && typeof x.garOk === 'object' ? { ...((x.garOk as Record<string, unknown>).a ? { a: 1 as const } : {}), ...((x.garOk as Record<string, unknown>).b ? { b: 1 as const } : {}) } : {},
    gek: Array.isArray(x.gek) ? x.gek.filter((g) => g && Number.isFinite(g.by) && Number.isFinite(g.vs) && (g.side === 'a' || g.side === 'b')).map((g) => ({ by: g.by, vs: g.vs, side: g.side, fk: String(g.fk ?? ''), since: n(g.since, 0), backA: Array.isArray(g.backA) ? g.backA.filter((q) => Number.isFinite(q)) : [], backD: Array.isArray(g.backD) ? g.backD.filter((q) => Number.isFinite(q)) : [], took: n(g.took, 0), sc: n(g.sc, 0), tookY: n(g.tookY, 0), ...(g.aid ? { aid: 1 as const } : {}), ...(g.crown ? { crown: 1 as const } : {}) })) : [],
    gekY: nums(x.gekY), ...(x.coreV ? { coreV: 1 as const } : {}), ind: Array.isArray(x.ind) ? x.ind.filter((q) => q && Number.isFinite(q.id) && (q.side === 'a' || q.side === 'b')).map((q) => ({ id: q.id, side: q.side, y: n(q.y, 0), ...(q.back ? { back: 1 as const } : {}) })) : [], indY: nums(x.indY),
    rebel: nums(x.rebel), rebelY: nums(x.rebelY), rebelG: nums(x.rebelG), rebelW: (() => { const o: Record<string, string> = {}; if (x.rebelW && typeof x.rebelW === 'object') for (const [k, v] of Object.entries(x.rebelW)) if (typeof v === 'string') o[k] = v.slice(0, 16); return o; })(),
    rvq: Array.isArray(x.rvq) ? x.rvq.filter((r) => r && Number.isFinite(r.lead) && Array.isArray(r.members)).map((r) => ({ lead: r.lead, members: r.members.filter((m) => Number.isFinite(m)), why: r.why === 'incite' ? 'incite' as const : r.why === 'grant' ? 'grant' as const : 'plot' as const })) : [],
  };
}

// ---- 조회 ----
export const pactOf = (s: DomainSave, a: number, b: number): Pact | undefined => s.pacts.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
/** 영구 사망의 까닭(2026-11-08). 없으면 「몰락」(영지만 잃고 살아 있음 — 유배 포함). */
export type DeathWhy = 'revolt' | 'conquest' | 'executed' | 'public' | 'assassinated' | 'seat' | 'illness' | 'poison' | 'accident'; // 병사·독살·사고(2026-11-08 귀족 건강)
export const DEATH_WHY: DeathWhy[] = ['revolt', 'conquest', 'executed', 'public', 'assassinated', 'seat', 'illness', 'poison', 'accident'];
export const DEATH_NAME: Record<DeathWhy, [string, string]> = { revolt: ['반란 실패로 사망', 'Died in a failed revolt'], conquest: ['영지를 잃고 사망', 'Died with the lost domain'], executed: ['처형', 'Executed'], public: ['공개 처형', 'Publicly executed'], assassinated: ['암살', 'Assassinated'], seat: ['거점 함락 때 사망', 'Died when the seat fell'], illness: ['병사', 'Died of illness'], poison: ['독살', 'Poisoned'], accident: ['사고사', 'Died in an accident'] };
/** 하극상에 진 도전자 처형 · 체포 뒤 처형의 충성 흔들림(같은 세력/진영) */
export const DEATH = { gekFear: -3, execFear: -4, execScared: -10, publicFear: -5, publicInd: -10 };
export function sizeOf(s: DomainSave): Map<number, number> { const m = new Map<number, number>(); for (const [k, v] of Object.entries(s.owner)) if (v >= 0 && !s.lost?.[k]) m.set(v, (m.get(v) ?? 0) + 1); return m; }
/** 이 귀족의 영지(지도 번호들). */
export const domainOf = (s: DomainSave, id: number): number[] => Object.entries(s.owner).filter(([, v]) => v === id).map(([k]) => Number(k));
/** 두 귀족 영지가 항로로 맞닿았는지. */
export function neighbors(s: DomainSave): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  for (const [k, o] of Object.entries(s.owner)) { if (o < 0) continue; for (const n of adjOf(Number(k))) { const p = s.owner[n]; if (p === undefined || p < 0 || p === o) continue; (out.get(o) ?? out.set(o, new Set()).get(o)!).add(p); } }
  return out;
}

export interface DomCtx {
  nobles: NobleRow[];
  alive: (id: number) => boolean;        // 반란·귀순·몰락하지 않음
  loyal: (id: number) => number;         // 군주 충성(0~100)
  rel: (a: number, b: number) => number; // 귀족 장부의 친밀도(-100~100)
  fac: (n: NobleRow) => string;          // 세력 갈래
  /** 그 세력의 지금 대표(대행이면 acting). 없으면 위계 규칙을 쓰지 않는다(시험용). */
  lead?: (side: NSide, fk: string) => { id: number; acting: boolean } | null;
}
/** 호감도 = 귀족 장부의 친밀도 + 영역다툼 감정. */
export const opinion = (s: DomainSave, c: DomCtx, a: number, b: number): number => clamp(c.rel(a, b) + (s.dg[pk(a, b)] ?? 0), -100, 100);
const addDg = (s: DomainSave, a: number, b: number, d: number) => { const k = pk(a, b); s.dg[k] = clamp((s.dg[k] ?? 0) + d, -100, 100); };

/** 귀족의 힘. 성격: [명예, 자비, 관대, 용맹, 계산] */
export function powerOf(n: NobleRow, size: number, loyal: number): number {
  const [hon, , , dar, cal] = n.tr;
  let p = 10 + size * 0.6;
  if (dar > 0) p += 2 * dar; else if (dar < 0) p -= 1;     // 용맹하면 밀어붙이고, 신중하면 물러선다
  if (cal < 0) p += 2;                                     // 충동적
  if (hon < 0) p += 1;                                     // 교활함
  if (loyal < 40) p += 2;                                  // 불만이 있으면 땅 욕심이 커진다
  return p;
}

export interface Pressure { sys: number; owner: number; by: number; ratio: number; pending: boolean; a: number; d: number }
/** 지금 영향력으로 본 분쟁 성계(지도 표시와 연례 판단이 같이 쓴다). 거점·직할령·몰락한 귀족 땅 아님. */
export function pressures(s: DomainSave, c: DomCtx): Pressure[] {
  const sizes = sizeOf(s), byId = new Map(c.nobles.map((n) => [n.id, n] as [number, NobleRow]));
  const live = c.nobles.filter((n) => c.alive(n.id) && !s.fallen[n.id] && (sizes.get(n.id) ?? 0) > 0);
  const pow = new Map(live.map((n) => [n.id, powerOf(n, sizes.get(n.id) ?? 0, c.loyal(n.id)) * (s.amb[n.id] ?? 1)] as [number, number]));
  const hubs = new Set(c.nobles.map((n) => n.id));
  const feudOf = new Map<number, Set<number>>(), allyOf = new Map<number, Set<number>>();
  for (const p of s.pacts) { const m = p.k === 'feud' ? feudOf : p.k === 'ally' ? allyOf : null; if (!m) continue; (m.get(p.a) ?? m.set(p.a, new Set()).get(p.a)!).add(p.b); (m.get(p.b) ?? m.set(p.b, new Set()).get(p.b)!).add(p.a); }
  const out: Pressure[] = [];
  for (const [k, o] of Object.entries(s.owner)) {
    const sys = Number(k); if (o < 0 || hubs.has(sys) || !pow.has(o) || s.lost?.[k]) continue;
    const on = byId.get(o)!, inf = (id: number) => { const h = hopsFrom(id).get(sys); return (pow.get(id) ?? 0) * Math.pow(DM.decay, h ?? DM.hopMax + 1); };
    let mine = inf(o) * DM.keep;
    const ofk = c.fac(on), ld = c.lead?.(on.side, ofk) ?? null; // 위계(2026-11-07 사용자: 「소가문이 감히 가문 대표와?」)
    const gAsLeader = ld && ld.id === o ? s.gek?.find((g) => g.vs === o) : undefined; // 이 땅 주인이 도전받는 대표
    if (gAsLeader) mine *= gekD(gAsLeader);
    let best = -1, bv = 0;
    for (const n of live) {
      if (n.id === o || n.side !== on.side) continue;
      const h = hopsFrom(n.id).get(sys); if (h === undefined || h > 4) continue;
      let hk = 1;
      if (ld && c.fac(n) === ofk) {
        if (ld.id === o) { // 소가문은 자기 대표 땅을 밀지 않는다 — 하극상 중인 도전자와 그 편만
          if (!gAsLeader || (gAsLeader.by !== n.id && !gAsLeader.backA.includes(n.id))) continue;
          hk = gekA(gAsLeader);
        } else if (ld.id === n.id) { // 대표도 제 세력 소가문 땅을 거두지 않는다 — 자기에게 도전한 자들만 친다
          const g = s.gek?.find((x) => x.vs === n.id); if (!g || (g.by !== o && !g.backA.includes(o))) continue;
          hk = gekD(g);
        } // 소가문끼리는 그대로 다툰다 — 대표가 건재하면 기세만 느려진다(monthTick 의 orderDamp)
      }
      const p = pactOf(s, n.id, o); if (p && p.k === 'ally') continue; // 동맹의 땅은 밀지 않는다
      let v = inf(n.id); if (p && p.k === 'nap') v *= DM.napCut;       // 불가침 상대는 훨씬 덜 민다(깨지기 전까지)
      v *= hk;
      if (feudOf.get(n.id)?.has(o)) v *= DM.feudBoost;
      else if ([...(allyOf.get(n.id) ?? [])].some((x) => feudOf.get(x)?.has(o))) v *= DM.allyBoost; // 동맹의 원수
      if (v > bv) { bv = v; best = n.id; }
    }
    if (best < 0) continue;
    const ratio = bv / (mine || 1e-9), pend = s.pend[k]?.by === best;
    if (ratio >= DM.contest || pend || s.front?.[k]) out.push({ sys, owner: o, by: best, ratio, pending: pend, a: bv, d: mine });
  }
  return out;
}

export interface YearInput extends DomCtx { year: number; rand: () => number }
export interface YearResult { flips: Array<[number, Holder, Holder]>; loyal: Array<[number, number]>; fallen: Array<{ id: number; by: number }>; lines: DomLine[]; petitions?: Petition[] }
const nm = (c: DomCtx, id: number): [string, string] => { const n = c.nobles.find((x) => x.id === id); return n ? [n.ko, n.en] : [String(id), String(id)]; };
const sysList = (ids: number[]): [string, string] => [ids.slice(0, 3).map((i) => sysName(i)[0]).join('·') + (ids.length > 3 ? ` 외 ${ids.length - 3}` : ''), ids.slice(0, 3).map((i) => sysName(i)[1]).join(', ') + (ids.length > 3 ? ` and ${ids.length - 3} more` : '')];

/** 연례 귀족 판단(연례 정보 회의 때 한 번). 같은 해에 두 번 부르면 아무것도 안 한다. 처음이면 기준 해만 잡는다. */
export function yearTick(s: DomainSave, c: YearInput): YearResult | null {
  if (s.year >= c.year) return null;
  if (s.year < 0) { s.year = c.year; return null; }
  s.year = c.year;
  const res: YearResult = { flips: [], loyal: [], fallen: [], lines: [] };
  const L2 = (ko: string, en: string, grave = false) => res.lines.push(grave ? { ko, en, grave } : { ko, en });
  const feudKeys = new Set(s.pacts.filter((p) => p.k === 'feud').map((p) => pk(p.a, p.b)));
  // 1) 감정이 옅어진다(원한은 그대로)
  for (const k of Object.keys(s.dg)) { if (feudKeys.has(k)) continue; s.dg[k] = Math.round(s.dg[k] * DM.dgFade); if (!s.dg[k]) delete s.dg[k]; }
  // 올해의 야심(해마다 새로)
  for (const n of c.nobles) s.amb[n.id] = Math.round((DM.ambLo + (DM.ambHi - DM.ambLo) * c.rand()) * (s.boost[n.id] ?? 1) * 100) / 100;
  s.boost = {};
  // 2) 국경 마찰(감정) + 지난 한 해 동안 달마다 넘어간 성계를 연말 기록으로(2026-11-07: 성계 쟁탈은 매달 줄다리기 — monthTick)
  const pr = pressures(s, c);
  for (const p of pr) addDg(s, p.owner, p.by, DM.friction);
  res.flips.push(...s.buf.ch); res.lines.push(...s.buf.lines); s.buf = { ch: [], lines: [] };
  // 국경 분쟁이 2년 넘게 이어지면 밀리는 귀족이 군주에게 청원(2026-11-07). 지난 청원 중 답이 없는 것은 외면으로.
  for (const q of s.pets.filter((x) => x.y < c.year)) {
    const roll = c.rand(), ch: PetChoice = q.ai ? (roll < 0.2 ? 'back' : roll < 0.7 ? 'mediate' : 'ignore') : 'ignore';
    const r2 = answerPetition(s, c.year, q.id, ch); if (!r2) continue; res.loyal.push(...r2.loyal); const A = nm(c, q.id);
    if (q.aided && ch !== 'back') res.loyal.push([q.id, -4]); // 회랑은 도왔는데 군주는 —
    res.lines.push(ch === 'back' ? { ko: `군주가 ${A[0]} 가의 청원을 들어주어 국경을 지켜 주었습니다.`, en: `The sovereign granted House ${A[1]}'s petition and guarded its borders.` } : ch === 'mediate' ? { ko: `군주가 ${A[0]} 가의 청원에 중재를 명했습니다.`, en: `The sovereign answered House ${A[1]}'s petition by ordering mediation.` } : { ko: `${A[0]} 가의 청원에 군주가 답하지 않았습니다. 그 가문은 서운해합니다.`, en: `The sovereign never answered House ${A[1]}'s petition. The house feels slighted.` });
  }
  const seenD = new Set<string>();
  for (const p of pr) { const fr = s.front[p.sys]; if (!fr || fr.p < 25) continue; const dk = `${p.owner}|${p.by}`; if (seenD.has(dk)) continue; seenD.add(dk); s.disp[dk] = (s.disp[dk] ?? 0) + 1; } // 실제로 땅을 잃을 만큼 밀리는 국경만
  for (const k of Object.keys(s.disp)) if (!k.startsWith('p|') && !seenD.has(k)) delete s.disp[k];
  res.petitions = [];
  for (const [dk, yrs] of Object.entries(s.disp)) {
    if (dk.startsWith('p|') || yrs < 2) continue; const [id, vs] = dk.split('|').map(Number);
    const side = c.nobles.find((x) => x.id === id)?.side; if (!side) continue;
    if (!c.alive(id) || !c.alive(vs) || s.pets.some((q) => q.id === id) || (s.disp[`p|${id}`] ?? -99) > c.year - 3) continue; // 한 귀족은 3년에 한 번
    if (res.petitions.filter((q) => c.nobles.find((x) => x.id === q.id)?.side === side).length >= 2) continue; // 한 나라에 한 해 두 건까지
    s.disp[`p|${id}`] = c.year;
    const n0 = pr.filter((p) => p.owner === id && p.by === vs).length; const q = { id, vs, y: c.year, n: n0 }; s.pets.push(q); res.petitions.push(q);
    const A = nm(c, id), B = nm(c, vs); res.lines.push({ ko: `${A[0]} 가가 ${B[0]} 가에게 국경을 밀리고 있다며 군주에게 청원했습니다.`, en: `House ${A[1]} has petitioned the sovereign, complaining that House ${B[1]} is pressing its borders.` });
  }
  // 3) 너무 커진 귀족 견제
  const sizes = sizeOf(s);
  for (const n of c.nobles) {
    const sz = sizes.get(n.id) ?? 0, base = s.init[n.id] ?? 0;
    if (!base || s.big[n.id] || sz < base * DM.bigAt || !c.alive(n.id)) continue;
    s.big[n.id] = true; for (const o of c.nobles) if (o.id !== n.id && o.side === n.side && c.alive(o.id)) addDg(s, o.id, n.id, DM.bigDg);
    L2(`${n.ko} 가의 영지가 크게 불어났습니다. 다른 가문들이 경계하기 시작합니다.`, `House ${n.en}'s domain has swollen. The other houses grow wary.`);
  }
  // 4) 몰락: 거점 말고 땅을 모두 잃음 → 영구 소멸, 거점은 마지막에 빼앗은 귀족에게
  for (const n of c.nobles) {
    if (s.fallen[n.id] || !c.alive(n.id) || !(s.init[n.id] > 1)) continue;
    const mine = domainOf(s, n.id); if (mine.some((x) => x !== n.id)) continue;
    let by = -1; // 마지막으로 이 귀족의 땅을 가져간 귀족(올해 것부터, 없으면 지난 기록에서 — 군주 하사로 잃었을 수도)
    for (const f of [...res.flips].reverse()) if (f[1] === n.id) { by = f[2]; break; }
    if (by < 0) for (const h of [...s.hist].reverse()) { const f = [...h.ch].reverse().find((x) => x[1] === n.id); if (f) { by = f[2]; break; } }
    if (by >= 0 && (!c.alive(by) || s.fallen[by])) by = -1;
    if (by >= 0) for (const x of mine) s.owner[x] = by; else for (const x of mine) delete s.owner[x];
    s.fallen[n.id] = { by, y: c.year }; res.fallen.push({ id: n.id, by });
    for (const p of s.pacts) if (p.k === 'ally' && (p.a === n.id || p.b === n.id) && by >= 0) addDg(s, p.a === n.id ? p.b : p.a, by, DM.fallAllyDg);
    s.pacts = s.pacts.filter((p) => p.a !== n.id && p.b !== n.id);
    const b = by >= 0 ? nm(c, by) : ['', ''];
    L2(`${n.ko} 가가 몰락했습니다.${by >= 0 ? ` 마지막 거점까지 ${b[0]} 가에게 넘어갔습니다.` : ''} 이 가문은 다시 일어서지 못합니다.`, `House ${n.en} has fallen.${by >= 0 ? ` Its last seat passed to House ${b[1]}.` : ''} The house will not rise again.`, true);
  }
  // 5) 협약: 깨기 → 원한 → 불가침 → 동맹, 그리고 큰 귀족을 둘러싼 견제
  const live = c.nobles.filter((n) => c.alive(n.id) && !s.fallen[n.id]), nb = neighbors(s), byId = new Map(live.map((n) => [n.id, n] as [number, NobleRow]));
  const op = (a: number, b: number) => opinion(s, c, a, b);
  const keepP: Pact[] = [];
  for (const p of s.pacts) {
    if (!byId.has(p.a) || !byId.has(p.b)) continue;
    const v = op(p.a, p.b), A = nm(c, p.a), B = nm(c, p.b);
    if (p.k === 'nap' && v < DM.napBreak || p.k === 'ally' && v < DM.allyBreak) {
      const breaker = (sizes.get(p.a) ?? 0) >= (sizes.get(p.b) ?? 0) ? p.a : p.b, bn = nm(c, breaker), other = breaker === p.a ? B : A;
      for (const o of live) if (o.id !== breaker && o.side === byId.get(breaker)!.side) addDg(s, o.id, breaker, DM.breakTrust);
      L2(`${bn[0]} 가가 ${other[0]} 가와의 ${p.k === 'ally' ? '동맹' : '불가침'}을 깼습니다.`, `House ${bn[1]} has broken its ${p.k === 'ally' ? 'alliance' : 'non-aggression pact'} with House ${other[1]}.`);
      continue;
    }
    if (p.k === 'feud' && v > DM.feudEnd) { L2(`${A[0]} 가와 ${B[0]} 가의 원한이 풀렸습니다.`, `The feud between House ${A[1]} and House ${B[1]} has ended.`); continue; }
    keepP.push(p);
  }
  s.pacts = keepP;
  const commonFoe = (a: number, b: number) => s.pacts.some((p) => p.k === 'feud' && (p.a === a || p.b === a) && s.pacts.some((q) => q.k === 'feud' && (q.a === b || q.b === b) && [q.a, q.b].includes(p.a === a ? p.b : p.a)));
  const pairs: Array<[NobleRow, NobleRow]> = []; for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) if (live[i].side === live[j].side) pairs.push([live[i], live[j]]);
  for (const [x, y] of pairs) {
    const v = op(x.id, y.id), cur = pactOf(s, x.id, y.id), touch = !!nb.get(x.id)?.has(y.id);
    if (!cur && v < DM.feud && touch) { s.pacts.push({ a: x.id, b: y.id, k: 'feud', since: c.year }); L2(`${x.ko} 가와 ${y.ko} 가가 서로 원수가 되었습니다.`, `House ${x.en} and House ${y.en} are now sworn enemies.`); continue; }
    if (cur?.k === 'feud') continue;
    if (v >= DM.ally && (c.fac(x) === c.fac(y) || commonFoe(x.id, y.id)) && cur?.k !== 'ally' && c.rand() < DM.allyChance) {
      if (cur) cur.k = 'ally', cur.since = c.year; else s.pacts.push({ a: x.id, b: y.id, k: 'ally', since: c.year });
      L2(`${x.ko} 가와 ${y.ko} 가가 동맹을 맺었습니다.`, `House ${x.en} and House ${y.en} have formed an alliance.`); continue;
    }
    if (!cur && touch && v >= DM.nap && c.rand() < DM.napChance) { s.pacts.push({ a: x.id, b: y.id, k: 'nap', since: c.year }); L2(`${x.ko} 가와 ${y.ko} 가가 불가침을 약속했습니다.`, `House ${x.en} and House ${y.en} have agreed to non-aggression.`); }
  }
  // 큰 귀족(같은 진영 평균의 2배 이상)을 둘러싼 이웃끼리는 손잡기 쉬워진다
  for (const sd of ['a', 'b'] as NSide[]) {
    const ls = live.filter((n) => n.side === sd), avg = ls.reduce((t, n) => t + (sizes.get(n.id) ?? 0), 0) / (ls.length || 1);
    for (const g of ls) {
      if ((sizes.get(g.id) ?? 0) < avg * 2) continue;
      const around = [...(nb.get(g.id) ?? [])].filter((id) => byId.has(id));
      for (let i = 0; i < around.length; i++) for (let j = i + 1; j < around.length; j++) {
        const a = around[i], b = around[j]; if (pactOf(s, a, b) || op(a, b) < 10 || c.rand() >= 0.5) continue;
        s.pacts.push({ a, b, k: 'nap', since: c.year }); const A = nm(c, a), B = nm(c, b);
        L2(`${A[0]} 가와 ${B[0]} 가가 ${g.ko} 가를 견제하려 손을 잡았습니다.`, `House ${A[1]} and House ${B[1]} have joined hands to check House ${g.en}.`);
      }
    }
  }
  s.hist.push({ y: c.year, ch: res.flips, lines: res.lines }); if (s.hist.length > DM.histKeep) s.hist.splice(0, s.hist.length - DM.histKeep);
  return res;
}

// ---- 플레이어 개입 ----
export type GrantWhy = 'used' | 'side' | 'hub' | 'owner' | 'touch' | 'same';
/** 군주 하사: 같은 진영 귀족의 성계 하나를, 그 성계와 맞닿은 다른 귀족에게(1년 1번). */
export function canGrant(s: DomainSave, nobles: NobleRow[], year: number, sys: number, to: number): GrantWhy | null {
  if (s.grantY === year) return 'used';
  const from = s.owner[sys], tn = nobles.find((n) => n.id === to), fn = nobles.find((n) => n.id === from);
  if (from === undefined || from < 0 || !tn || !fn) return 'owner';
  if (from === to) return 'same';
  if (tn.side !== fn.side) return 'side';
  if (nobles.some((n) => n.id === sys)) return 'hub';
  if (!adjOf(sys).some((x) => s.owner[x] === to)) return 'touch';
  return null;
}
export function grant(s: DomainSave, nobles: NobleRow[], year: number, sys: number, to: number): { from: number; loyal: Array<[number, number]> } | GrantWhy {
  const why = canGrant(s, nobles, year, sys, to); if (why) return why;
  const from = s.owner[sys]; s.owner[sys] = to; delete s.pend[sys]; s.grantY = year; addDg(s, from, to, DM.grantDg);
  const h = s.hist[s.hist.length - 1]; if (h && h.y === year) h.ch.push([sys, from, to]); else s.hist.push({ y: year, ch: [[sys, from, to]], lines: [] });
  return { from, loyal: [[to, DM.grantLoyal], [from, DM.grantLoser]] };
}
/** 중재: 두 귀족의 감정을 누그러뜨리고, 원한이 풀릴 만하면 푼다(1년 1번). */
export function mediate(s: DomainSave, c: DomCtx, year: number, a: number, b: number): { ended: boolean; loyal: Array<[number, number]> } | 'used' | 'same' {
  if (s.medY === year) return 'used'; if (a === b) return 'same';
  s.medY = year; addDg(s, a, b, DM.medDg);
  const p = pactOf(s, a, b); let ended = false;
  if (p && p.k === 'feud' && opinion(s, c, a, b) > DM.feudEnd) { s.pacts = s.pacts.filter((x) => x !== p); ended = true; }
  return { ended, loyal: [[a, DM.medLoyal], [b, DM.medLoyal]] };
}

/** 동맹 덩어리(같은 동맹으로 이어진 귀족들) — 지도 「동맹 블록」 색. 귀족 번호 → 덩어리 대표 번호. */
export function blocs(s: DomainSave): Map<number, number> {
  const par = new Map<number, number>(); const f = (x: number): number => { const p = par.get(x); if (p === undefined || p === x) { par.set(x, x); return x; } const r = f(p); par.set(x, r); return r; };
  for (const p of s.pacts) if (p.k === 'ally') { const ra = f(p.a), rb = f(p.b); if (ra !== rb) par.set(ra, rb); }
  const out = new Map<number, number>(); for (const k of par.keys()) out.set(k, f(k)); return out;
}
export const SEATS = CR_MAP_SEATS;

// ==== 2단계: 반란 밀약 · 충성 서약 · 연합 반란(2026-11-07) ====
export const PL = {
  start: [0, 0, 0.15, 0.35, 1] as number[],   // 충성 단계별 주모자가 될 확률(불만 · 모반의 기미 · 반란 직전)
  recruitPerYear: 2, base: 0.15, landBonus: 0.15, landHate: 0.3, rankDaring: 0.2, rankPlain: 0.05, feudBonus: 0.35, oathCut: 0.3, minOp: 10,
  leakLoyal: 0.15, leakDiscontent: 0.04, leakOath: 0.15, leakLoyalGain: 5, leakBetray: -30,
  riseShare: 0.25, riseAge: 5, followBase: 0.5, followAlly: 0.2, followOath: 0.25, followExposed: 0.2, refuseDg: -30,
  oathPerYear: 3, oathMinLoyal: 40,
};
export const loyalStageOf = (v: number): number => (v >= 70 ? 0 : v >= 40 ? 1 : v >= 25 ? 2 : v >= 10 ? 3 : 4);
export const plotOf = (s: DomainSave, id: number): Plot | undefined => s.plots.find((p) => p.lead === id);
/** 이 귀족이 약속한 밀약(주모자 쪽). */
export const pledgedTo = (s: DomainSave, id: number): Plot | undefined => s.plots.find((p) => p.pledges.some((q) => q.who === id));
/** 이 진영의 귀족·직할령 성계 전체 수. */
export function sideTotal(s: DomainSave, nobles: NobleRow[], side: NSide): number {
  const sideOf = new Map(nobles.map((n) => [n.id, n.side] as [number, NSide])); let t = 0;
  for (const o of Object.values(s.owner)) if (o === CROWN[side] || (o >= 0 && sideOf.get(o) === side)) t++;
  return t;
}
export interface Rise { lead: number; members: number[]; refused: number[] }
export interface PlotResult { started: number[]; pledged: Array<[number, number]>; leaks: Array<{ lead: number; who: number; patron?: boolean }>; rises: Rise[]; loyal: Array<[number, number]>; lines: DomLine[] }

/** 연례 밀약 판단: 주모자 생김 → 약속 모으기 → 밀고 → 들고일어날지. yearTick 바로 뒤에 같은 해로 부른다. */
export function plotTick(s: DomainSave, c: YearInput): PlotResult {
  const res: PlotResult = { started: [], pledged: [], leaks: [], rises: [], loyal: [], lines: [] };
  const sizes = sizeOf(s), byId = new Map(c.nobles.map((n) => [n.id, n] as [number, NobleRow]));
  const okNoble = (id: number) => c.alive(id) && !s.fallen[id] && (sizes.get(id) ?? 0) > 0;
  // 죽은 밀약 정리
  s.plots = s.plots.filter((p) => okNoble(p.lead)); for (const p of s.plots) p.pledges = p.pledges.filter((q) => okNoble(q.who));
  const busy = () => { const b = new Set<number>(); for (const p of s.plots) { b.add(p.lead); for (const q of p.pledges) b.add(q.who); } return b; };
  // 1) 주모자
  for (const n of c.nobles) {
    if (!okNoble(n.id) || busy().has(n.id)) continue;
    const st = loyalStageOf(c.loyal(n.id)); if (c.rand() >= (PL.start[st] ?? 0)) continue;
    s.plots.push({ lead: n.id, since: c.year, pledges: [], exposed: false }); res.started.push(n.id);
  }
  const op = (a: number, b: number) => opinion(s, c, a, b);
  const feudsOf = (id: number) => s.pacts.filter((p) => p.k === 'feud' && (p.a === id || p.b === id)).map((p) => (p.a === id ? p.b : p.a));
  // 2) 약속 모으기
  for (const pl of s.plots) {
    const ln = byId.get(pl.lead)!; let got = 0;
    const cands = c.nobles.filter((n) => n.side === ln.side && n.id !== pl.lead && okNoble(n.id) && !busy().has(n.id)).sort((x, y) => op(pl.lead, y.id) - op(pl.lead, x.id));
    for (const cn of cands) {
      if (got >= PL.recruitPerYear) break;
      const v = op(pl.lead, cn.id), myFeuds = feudsOf(cn.id), shared = myFeuds.find((f) => op(pl.lead, f) < 0);
      if (v < PL.minOp && shared === undefined) continue;
      let price: Pledge, bonus: number;
      if (shared !== undefined) { price = { who: cn.id, k: 'feud', tgt: shared, since: c.year, seen: false }; bonus = PL.feudBonus; }
      else {
        let land = -1, hate = false;
        for (const x of domainOf(s, cn.id)) for (const y of adjOf(x)) { const o = s.owner[y]; if (o === undefined || o === cn.id || o === pl.lead || byId.has(y) || (o >= 0 && byId.get(o)?.side !== ln.side) || (o < 0 && o !== CROWN[ln.side])) continue; const hh = o < 0 || op(cn.id, o) < 0; if (land < 0 || (hh && !hate)) { land = y; hate = hh; } }
        if (land >= 0) { price = { who: cn.id, k: 'land', sys: land, since: c.year, seen: false }; bonus = hate ? PL.landHate : PL.landBonus; }
        else { price = { who: cn.id, k: 'rank', since: c.year, seen: false }; bonus = cn.tr[3] > 0 ? PL.rankDaring : PL.rankPlain; }
      }
      const chance = PL.base + bonus + Math.max(0, 40 - c.loyal(cn.id)) / 100 - (s.oaths[cn.id] !== undefined ? PL.oathCut : 0);
      if (c.rand() < chance) { pl.pledges.push(price); res.pledged.push([pl.lead, cn.id]); got++; }
    }
  }
  // 3) 밀고: 두려운 귀족이 군주에게 털어놓는다 → 그 약속은 드러나고 빠지며, 주모자가 알려진다
  for (const pl of s.plots) {
    pl.pledges = pl.pledges.filter((q) => {
      if (q.since === c.year) return true; // 올해 맺은 약속은 아직
      const ch = (c.loyal(q.who) >= 40 ? PL.leakLoyal : PL.leakDiscontent) + (s.oaths[q.who] !== undefined ? PL.leakOath : 0);
      if (c.rand() >= ch) return true;
      pl.exposed = true; res.leaks.push({ lead: pl.lead, who: q.who, ...(pl.patron ? { patron: true } : {}) }); res.loyal.push([q.who, PL.leakLoyalGain]); addDg(s, pl.lead, q.who, PL.leakBetray);
      const L1 = nm(c, q.who), L0 = nm(c, pl.lead);
      res.lines.push({ ko: `${L1[0]} 가가 ${L0[0]} 가의 반란 밀약을 군주에게 털어놓았습니다.`, en: `House ${L1[1]} has revealed House ${L0[1]}'s conspiracy to the sovereign.`, grave: true });
      return false;
    });
  }
  // 4) 들고일어날지
  const keep: Plot[] = [];
  for (const pl of s.plots) {
    const ln = byId.get(pl.lead)!, strength = (sizes.get(pl.lead) ?? 0) + pl.pledges.reduce((t, q) => t + (sizes.get(q.who) ?? 0), 0), total = sideTotal(s, c.nobles, ln.side) || 1;
    const st2 = strength + (pl.patron ? total * 0.1 : 0); // 회랑의 뒷배
    const go = st2 >= total * PL.riseShare || (loyalStageOf(c.loyal(pl.lead)) === 4 && pl.pledges.length >= 1) || (c.year - pl.since >= PL.riseAge && pl.pledges.length >= 2);
    if (!go) { keep.push(pl); continue; }
    res.rises.push(riseOf(s, c, pl));
  }
  s.plots = keep;
  return res;
}
/** 들고일어나는 순간: 약속한 귀족마다 정말 따라나설지. 따르지 않은 귀족에게 주모자는 원한. 밀약은 사라진다(호출하는 쪽이 지운다). */
export function riseOf(s: DomainSave, c: DomCtx & { rand: () => number }, pl: Plot): Rise {
  const r: Rise = { lead: pl.lead, members: [], refused: [] };
  for (const q of pl.pledges) {
    const ally = pactOf(s, pl.lead, q.who)?.k === 'ally';
    const p = clamp(PL.followBase + (pl.patron ? 0.1 : 0) + (opinion(s, c, pl.lead, q.who) - c.loyal(q.who)) / 200 + (ally ? PL.followAlly : 0) - (s.oaths[q.who] !== undefined ? PL.followOath : 0) - (pl.exposed ? PL.followExposed : 0), 0.05, 0.95);
    if (c.rand() < p) r.members.push(q.who); else { r.refused.push(q.who); addDg(s, pl.lead, q.who, PL.refuseDg); }
  }
  return r;
}
/** 반란이 실제로 일어난 뒤: 그 귀족들의 영지를 장부에서 뺀다(게임에서 새 나라 땅이 됨). 넘겨줄 성계(지도 번호) 목록을 돌려준다. 거점 귀족의 땅만, 직할령은 안 됨. */
export function takeDomains(s: DomainSave, ids: number[]): number[] {
  const set = new Set(ids), out: number[] = [];
  for (const [k, o] of Object.entries(s.owner)) if (o >= 0 && set.has(o)) { out.push(Number(k)); delete s.owner[k]; delete s.pend[k]; }
  s.pacts = s.pacts.filter((p) => !set.has(p.a) && !set.has(p.b));
  s.plots = s.plots.filter((p) => !set.has(p.lead)); for (const p of s.plots) p.pledges = p.pledges.filter((q) => !set.has(q.who));
  for (const id of ids) delete s.oaths[id];
  return out;
}
/** 충성 서약(군주 자리 플레이어가 자기 귀족에게, 1년 3번). */
export function takeOath(s: DomainSave, year: number, id: number, loyal: number): 'ok' | 'had' | 'low' | 'many' {
  if (s.oaths[id] !== undefined) return 'had';
  if (loyal < PL.oathMinLoyal) return 'low';
  if (s.oathY.y === year && s.oathY.n >= PL.oathPerYear) return 'many';
  s.oaths[id] = year; s.oathY = s.oathY.y === year ? { y: year, n: s.oathY.n + 1 } : { y: year, n: 1 };
  return 'ok';
}
/** 첩보(인연 캐기)로 이 귀족이 얽힌 밀약을 드러낸다. 드러난 수. */
export function revealPlots(s: DomainSave, id: number): number {
  let n = 0;
  for (const p of s.plots) for (const q of p.pledges) if ((q.who === id || p.lead === id) && !q.seen) { q.seen = true; n++; }
  return n;
}


// ==== 청원 · 주모자 체포 · 게임 영토(2026-11-07) ====
export type PetChoice = 'back' | 'mediate' | 'ignore';
export const PT = { backLoyal: 6, backVs: -3, backDg: -10, medDg: 15, medLoyal: 1, ignLoyal: -6, ignDg: -10 };
/** 청원에 답하기. back 편들어 줌(그 국경 성계 1년 고정) · mediate 중재 명령 · ignore 외면. */
export function answerPetition(s: DomainSave, year: number, id: number, choice: PetChoice): { loyal: Array<[number, number]>; locked: number[] } | null {
  const q = s.pets.find((x) => x.id === id); if (!q) return null;
  s.pets = s.pets.filter((x) => x !== q);
  const out = { loyal: [] as Array<[number, number]>, locked: [] as number[] };
  if (choice === 'back') {
    for (const [k, o] of Object.entries(s.owner)) if (o === id && adjOf(Number(k)).some((x) => s.owner[x] === q.vs)) { s.lock[k] = year + 1; delete s.pend[k]; if (s.front[k]) s.front[k].p = Math.max(0, s.front[k].p - 25); out.locked.push(Number(k)); }
    out.loyal.push([id, PT.backLoyal], [q.vs, PT.backVs]); addDg(s, id, q.vs, PT.backDg);
  } else if (choice === 'mediate') {
    addDg(s, id, q.vs, PT.medDg); for (const [k, p] of Object.entries(s.pend)) if (p.by === q.vs && s.owner[k] === id) delete s.pend[k]; for (const [k, f] of Object.entries(s.front)) if (f.by === q.vs && s.owner[k] === id) delete s.front[k];
    delete s.disp[`${id}|${q.vs}`]; out.loyal.push([id, PT.medLoyal]);
  } else { out.loyal.push([id, PT.ignLoyal]); addDg(s, id, q.vs, PT.ignDg); }
  return out;
}
export const ARREST = { base: 0.65, perPledge: 0.06, daring: 0.1, exposed: 0.1, min: 0.2, max: 0.85, pledgerFear: -5 };
export function arrestChance(s: DomainSave, n: NobleRow): number {
  const pl = plotOf(s, n.id); if (!pl) return 0;
  return clamp(ARREST.base - ARREST.perPledge * pl.pledges.length - (n.tr[3] > 0 ? ARREST.daring : 0) + (pl.exposed ? ARREST.exposed : 0), ARREST.min, ARREST.max);
}
/** 주모자 체포(그 나라 자리 플레이어, 1년 1번, 드러난 주모자만). 성공: 영지는 군주 직할로, 밀약은 깨짐, 약속했던 귀족들은 겁먹음. 실패: 그 자리에서 들고일어남. */
export function arrest(s: DomainSave, c: DomCtx & { rand: () => number }, year: number, lead: number): { ok: true; taken: number[]; scared: number[] } | { ok: false; rise: Rise } | 'used' | 'noplot' | 'hidden' {
  if (s.arrestY === year) return 'used';
  const pl = plotOf(s, lead), n = c.nobles.find((x) => x.id === lead); if (!pl || !n) return 'noplot';
  if (!pl.exposed && !pl.pledges.some((q) => q.seen)) return 'hidden';
  s.arrestY = year;
  if (c.rand() < arrestChance(s, n)) {
    const taken: number[] = []; for (const [k, o] of Object.entries(s.owner)) if (o === lead) { s.owner[k] = CROWN[n.side]; delete s.pend[k]; taken.push(Number(k)); }
    const scared = pl.pledges.map((q) => q.who); s.plots = s.plots.filter((p) => p !== pl); s.pacts = s.pacts.filter((p) => p.a !== lead && p.b !== lead);
    s.fallen[lead] = { by: -1, y: year };
    return { ok: true, taken, scared };
  }
  s.plots = s.plots.filter((p) => p !== pl);
  return { ok: false, rise: riseOf(s, c, pl) };
}
/** 게임 땅 주인 반영: 영지 장부에 있는 성계 중 지금 그 진영 나라 땅이 아닌 것(지도 번호). */
export function setLost(s: DomainSave, lost: number[]): boolean {
  const next: Record<string, true> = {}; for (const m of lost) if (s.owner[m] !== undefined) next[m] = true;
  const a = Object.keys(s.lost ?? {}).sort().join(','), b = Object.keys(next).sort().join(',');
  s.lost = next; return a !== b;
}


// ==== 회랑(외부 세력)의 끼어들기(2026-11-07 사용자: 「우린 귀족이 없잖아」) ====
export const MED = { aidCost: 400, aidRel: 15, aidLoyal: -4, aidBoost: 1.25, eggCost: 300, eggRel: 10, eggBoost: 1.25, eggDg: -10, patronCost: 800, patronRel: 15, warnRel: 20, sellRel: -30, sellSus: -10, warnCaught: 0.2, warnSus: 10, patronLeakSus: 15 };
/** 청원한 귀족을 몰래 돕기: 회랑과 가까워지고 자기 군주에겐 더 서운해진다 · 다음 해 그 귀족이 더 세게 버틴다. */
export function aidPetitioner(s: DomainSave, id: number): Petition | 'none' | 'done' { const q = s.pets.find((x) => x.id === id); if (!q) return 'none'; if (q.aided) return 'done'; q.aided = true; s.boost[id] = (s.boost[id] ?? 1) * MED.aidBoost; for (const [k, f] of Object.entries(s.front)) if (s.owner[k] === id && f.by === q.vs) f.aidD = 12; return q; }
/** 미는 쪽 귀족을 부추기기: 분쟁이 커진다. */
export function eggPresser(s: DomainSave, id: number): Petition | 'none' | 'done' { const q = s.pets.find((x) => x.id === id); if (!q) return 'none'; if (q.egged) return 'done'; q.egged = true; s.boost[q.vs] = (s.boost[q.vs] ?? 1) * MED.eggBoost; addDg(s, q.id, q.vs, MED.eggDg); for (const [k, f] of Object.entries(s.front)) if (s.owner[k] === q.id && f.by === q.vs) f.aidA = 12; return q; }
/** 반란 후원 약속: 밀약이 힘을 얻는다(들고일어날 문턱이 낮아지고, 약속한 귀족이 더 잘 따라나섬). */
export function backPlot(s: DomainSave, lead: number): Plot | 'none' | 'done' { const pl = plotOf(s, lead); if (!pl) return 'none'; if (pl.patron) return 'done'; pl.patron = true; return pl; }


// ==== 성계 쟁탈 줄다리기(매달, 2026-11-07) ====
// 영향력 비율(도전자 ÷ 지키는 쪽)이 1보다 크면 장악 진척도가 오르고, 작으면 내려간다. 공작이 더하고 뺀다. 100%가 되면 성계가 넘어간다.
export const FR = { gain: 15, maxStep: 12, aid: 3, coolOff: 3, coolDrop: 6, loss: -12, loyalLoss: -2, forceDg: -0.5, minShow: 0 };
export const A_OP: Record<AOp, number> = { bribe: 2.5, agitate: 2, settle: 1.5, force: 3 };
export const D_OP: Record<DOp, number> = { garrison: 2, appease: 1.5 };
/** 성격으로 고르는 공작 — [명예, 자비, 관대, 용맹, 계산] */
export const aOpOf = (n: NobleRow): AOp => (n.tr[3] > 0 ? 'force' : n.tr[2] > 0 || n.tr[4] > 0 ? 'bribe' : n.tr[0] < 0 ? 'agitate' : 'settle');
export const dOpOf = (n: NobleRow): DOp => (n.tr[3] < 0 || n.tr[4] > 0 ? 'garrison' : 'appease');
// ---- 영지 수비대(2026-11-07 사용자: 「귀족마다 자기 함대 — 차라리 전초기지·민방위군 같은 것」) ----
// 거점 성계의 방어 플랫폼(숨은 수비대 나라 소유, 제자리만 지킴)과 거점 행성의 민병대. 크기는 영지 크기·전문·용맹으로, 연례 회의 때만 게임에 맞춘다.
// 충성이 「모반의 기미」(3단계) 아래로 떨어지면 수비대가 손을 놓는다(교전 안 함 — 줄다리기에서도 힘을 못 보탠다).
// 2026-11-08 사용자 「파워가 너무 약해 — 명색이 몰락제국급」: 플랫폼 수를 늘리고(2~10기) 게임 쪽 나라 힘(sllm_cr_gar_might)으로 한 기 한 기를 키웠다. 줄다리기 몫은 기당 줄였다.
export const GAR = { base: 2, perSys: 3, fortress: 3, forge: 2, dar: 1, max: 10, milBase: 2, milFortress: 2, milPerSys: 6, milMax: 6, refit: 5, passiveAt: 3, defPer: 0.25, defHop: 2, forcePer: 0.2 };
export interface Garrison { p: number; c: number; passive: boolean }
/** 귀족 하나의 수비대(살아 있고 영지가 있을 때만). */
export function garrisonOf(n: NobleRow, size: number, loyal: number): Garrison {
  if (size <= 0) return { p: 0, c: 0, passive: false };
  const p = clamp(GAR.base + Math.floor(size / GAR.perSys) + (n.spec === 'fortress' ? GAR.fortress : n.spec === 'forge' ? GAR.forge : 0) + (n.tr[3] > 0 ? GAR.dar : 0), 1, GAR.max);
  const c = clamp(GAR.milBase + (n.spec === 'fortress' ? GAR.milFortress : 0) + Math.floor(size / GAR.milPerSys), 1, GAR.milMax);
  return { p, c, passive: loyalStageOf(loyal) >= GAR.passiveAt };
}
/** 줄다리기에 수비대가 보태는 값: 지키는 쪽은 거점에서 GAR.defHop 칸 안이면 플랫폼마다, 미는 쪽은 「무력 시위」일 때만. 손 놓은 수비대는 0. */
function garPush(c: DomCtx, s: DomainSave, sys: number, by: number, owner: number, aOp: AOp, sizes: Map<number, number>): { a: number; d: number } {
  const an = c.nobles.find((n) => n.id === by), dn = c.nobles.find((n) => n.id === owner);
  const ga = an ? garrisonOf(an, sizes.get(by) ?? 0, c.loyal(by)) : null, gd = dn ? garrisonOf(dn, sizes.get(owner) ?? 0, c.loyal(owner)) : null;
  const near = (hopsFrom(owner).get(sys) ?? 99) <= GAR.defHop;
  const d = gd && !gd.passive && near ? Math.round(gd.p * GAR.defPer * 10) / 10 : 0;
  const a = ga && !ga.passive && aOp === 'force' ? Math.round(ga.p * GAR.forcePer * 10) / 10 : 0;
  void s; return { a, d };
}
const momOf = (s: DomainSave, k: string, f: Front, ratio: number, g: { a: number; d: number } = { a: 0, d: 0 }): number => clamp((ratio - 1) * FR.gain + A_OP[f.aOp] - D_OP[f.dOp] + (f.aidA ? FR.aid : 0) - (f.aidD ? FR.aid : 0) + g.a - g.d, -FR.maxStep, FR.maxStep) * ((s.lock[k] ?? -1) >= 0 ? 1 : 1);
// ---- 하극상(2026-11-07) ----
// 대표가 건재하면 같은 세력 소가문끼리의 다툼은 느려지고(GK.damp), 대표 땅은 성역이다. 소가문이 대표보다 확실히 강해지면(GK.start) 도전할 수 있다.
// 세력의 다른 소가문은 호감·밀약으로 편을 고른다. 대표 성계를 GK.winTake 곳 빼앗거나 대표가 몰락하면 도전자가 대표가 된다. GK.maxYears 안에 못 이기거나 힘이 꺾이면 실패.
export const GK = { damp: 0.8, orderLoyal: 40, prestige: 1.3, start: 0.9, chance: 0.3, feudX: 2, honorBar: 2, cool: 8, back: 0.3, aid: 1.15, crown: 1.2, winTake: 2, winSc: 50, loseSc: -40, endSc: 25, maxYears: 4, scStep: 60, scCap: 30, tookSc: 20, sideA: 20, sideD: -10, needBack: 1, winDg: -10, loseDg: -15, loseLoyal: -6, loseLeadLoyal: -4, winLoyal: 3, territory: 1.1 };
const gekA = (g: Gek): number => (g.aid ? GK.aid : 1) * GK.territory;
const gekD = (g: Gek): number => (g.crown ? GK.crown : 1) * GK.territory;
export const gekOf = (s: DomainSave, id: number): Gek | undefined => s.gek.find((g) => g.by === id || g.vs === id);
/** 하극상 양쪽 세: 도전자(와 편든 가문들의 30%) 대 대표(권위 ×1.3, 편든 가문들의 30%). 회랑 돈·군주 편들기가 곱해진다. */
export function gekStrength(s: DomainSave, c: DomCtx, g: Pick<Gek, 'by' | 'vs' | 'backA' | 'backD' | 'aid' | 'crown'>): { A: number; D: number } {
  const sizes = sizeOf(s), P = (id: number, sz?: number) => { const n = c.nobles.find((x) => x.id === id); return n && c.alive(id) && !s.fallen[id] ? powerOf(n, sz ?? sizes.get(id) ?? 0, c.loyal(id)) * (s.amb[id] ?? 1) : 0; };
  // 대표는 궁정의 자리(수도 섹터 대표는 영지가 없다): 영지가 세력 평균보다 작으면 평균만큼 쳐 준다
  const ln = c.nobles.find((x) => x.id === g.vs), mates = ln ? c.nobles.filter((x) => x.side === ln.side && c.fac(x) === c.fac(ln) && x.id !== ln.id && (sizes.get(x.id) ?? 0) > 0) : [];
  const avg = mates.length ? mates.reduce((t, x) => t + (sizes.get(x.id) ?? 0), 0) / mates.length : 0;
  const A = (P(g.by) + GK.back * g.backA.reduce((t, id) => t + P(id), 0)) * (g.aid ? GK.aid : 1);
  const D = (P(g.vs, Math.max(sizes.get(g.vs) ?? 0, Math.round(avg))) * GK.prestige + GK.back * g.backD.reduce((t, id) => t + P(id), 0)) * (g.crown ? GK.crown : 1);
  return { A: Math.round(A * 10) / 10, D: Math.round(D * 10) / 10 };
}
/** 같은 세력 소가문끼리의 다툼: 대표가 건재하면(대행이 아니고 충성 40 이상) 달마다 기세가 GK.damp 배. */
function orderDamp(c: DomCtx, by: number, owner: number): number {
  if (!c.lead) return 1;
  const a = c.nobles.find((n) => n.id === by), o = c.nobles.find((n) => n.id === owner); if (!a || !o || a.side !== o.side || c.fac(a) !== c.fac(o)) return 1;
  const ld = c.lead(o.side, c.fac(o)); return ld && !ld.acting && ld.id !== by && ld.id !== owner && c.loyal(ld.id) >= GK.orderLoyal ? GK.damp : 1;
}
export interface GekResult { started: Gek[]; won: Gek[]; lost: Gek[]; loyal: Array<[number, number]>; lines: DomLine[] }
/** 연례 하극상 판단(yearTick·plotTick 뒤, 같은 해). 이긴 도전자는 앱이 세력 대표로 올린다(NobleSave.flead). */
export function gekTick(s: DomainSave, c: YearInput): GekResult {
  const res: GekResult = { started: [], won: [], lost: [], loyal: [], lines: [] };
  if (!c.lead) return res;
  const sizes = sizeOf(s);
  const L2 = (ko: string, en: string, grave = false) => res.lines.push(grave ? { ko, en, grave } : { ko, en });
  // 1) 진행 중인 것: 판세를 움직이고 끝낼지
  for (const g of [...s.gek]) {
    const A = nm(c, g.by), B = nm(c, g.vs), fk = `${g.side}_${g.fk}`;
    const byOk = c.alive(g.by) && !s.fallen[g.by], vsOk = c.alive(g.vs) && !s.fallen[g.vs];
    const end = () => { s.gek = s.gek.filter((x) => x !== g); s.gekY[fk] = c.year; };
    if (!byOk) { end(); continue; } // 도전자가 사라짐(반란·몰락)
    g.backA = g.backA.filter((id) => c.alive(id) && !s.fallen[id]); g.backD = g.backD.filter((id) => c.alive(id) && !s.fallen[id]);
    const st = gekStrength(s, c, g);
    g.sc = clamp(g.sc + clamp((st.A / (st.D || 1) - 1) * GK.scStep, -GK.scCap, GK.scCap) + (g.took - g.tookY) * GK.tookSc, -100, 100); g.tookY = g.took;
    const age = c.year - g.since;
    if (!vsOk || g.took >= GK.winTake || g.sc >= GK.winSc || (age >= GK.maxYears && g.sc >= GK.endSc)) {
      end(); res.won.push(g);
      for (const m of g.backD) addDg(s, m, g.by, GK.winDg);
      res.loyal.push([g.by, GK.winLoyal]); if (vsOk) res.loyal.push([g.vs, GK.loseLeadLoyal]);
      L2(`하극상: ${A[0]} 가가 세력 대표 ${B[0]} 가를 꺾고 대표 자리를 차지했습니다.`, `Usurpation: House ${A[1]} has overthrown its faction leader, House ${B[1]}, and taken the leadership.`, true);
      continue;
    }
    if (g.sc <= GK.loseSc || age >= GK.maxYears) {
      end(); res.lost.push(g);
      for (const m of g.backA) addDg(s, m, g.vs, GK.winDg);
      // 2026-11-08 사용자(영구 사망): 대표 자리를 노렸다 진 도전자는 처형 — 영지는 이긴 대표에게, 같은 세력 귀족들은 본보기에 움츠러든다
      s.fallen[g.by] = { by: g.vs, y: c.year, why: 'executed' };
      for (const [k, o] of Object.entries(s.owner)) if (o === g.by) { s.owner[k] = vsOk ? g.vs : CROWN[g.side]; delete s.pend[k]; }
      s.pacts = s.pacts.filter((p) => p.a !== g.by && p.b !== g.by); s.plots = s.plots.filter((p) => p.lead !== g.by);
      for (const n of c.nobles) if (n.id !== g.by && n.side === g.side && c.fac(n) === g.fk && c.alive(n.id) && !s.fallen[n.id]) res.loyal.push([n.id, DEATH.gekFear]);
      L2(`하극상 실패: ${A[0]} 가가 세력 대표 ${B[0]} 가에게 도전했다가 패했습니다. ${A[0]}은(는) 처형되었고, 영지는 ${B[0]} 가에게 넘어갔습니다.`, `A failed usurpation: House ${A[1]} challenged its faction leader, House ${B[1]}, and lost. ${A[1]} has been executed and the domain passes to House ${B[1]}.`, true);
      continue;
    }
    L2(`하극상 진행: ${A[0]} 가 대 대표 ${B[0]} 가 — ${g.sc > 15 ? '도전자가 기세를 잡았습니다' : g.sc < -15 ? '대표가 도전을 누르고 있습니다' : '팽팽합니다'}.`, `Usurpation underway: House ${A[1]} against its leader, House ${B[1]} — ${g.sc > 15 ? 'the challenger has the momentum' : g.sc < -15 ? 'the leader is holding the challenge down' : 'evenly poised'}.`);
  }
  // 2) 새 도전: 대표보다 세가 확실히 커졌을 때(편들 가문을 세어 보고), 명예로운 가문·동맹·서약한 가문은 거의 안 나선다
  const facs = new Map<string, NobleRow[]>();
  for (const n of c.nobles) { if (!c.alive(n.id) || s.fallen[n.id]) continue; const k = `${n.side}_${c.fac(n)}`; (facs.get(k) ?? facs.set(k, []).get(k)!).push(n); }
  for (const [fk, ms] of facs) {
    const side = ms[0].side, key = c.fac(ms[0]), ld = c.lead(side, key); if (!ld || ld.acting) continue;
    if (s.gek.some((g) => g.side === side && g.fk === key) || c.year - (s.gekY[fk] ?? -99) < GK.cool) continue;
    const cands = ms.filter((m) => m.id !== ld.id && m.tr[0] < GK.honorBar && pactOf(s, m.id, ld.id)?.k !== 'ally' && (sizes.get(m.id) ?? 0) > 0)
      .sort((x, y) => (sizes.get(y.id) ?? 0) - (sizes.get(x.id) ?? 0));
    for (const m of cands) {
      const g: Gek = { by: m.id, vs: ld.id, side, fk: key, since: c.year, backA: [], backD: [], took: 0, sc: 0, tookY: 0 };
      for (const o of ms) {
        if (o.id === m.id || o.id === ld.id) continue;
        const pl = s.plots.find((p) => p.lead === m.id && p.pledges.some((q) => q.who === o.id));
        const sc = opinion(s, c, o.id, m.id) - opinion(s, c, o.id, ld.id) + (pl ? 40 : 0);
        if (sc > GK.sideA) g.backA.push(o.id); else if (sc < GK.sideD || c.loyal(o.id) >= 90) g.backD.push(o.id); // 군주에게 깊이 충성하는 가문은 대표 편
      }
      const hate = opinion(s, c, m.id, ld.id) <= -30 || pactOf(s, m.id, ld.id)?.k === 'feud';
      if (g.backA.length < GK.needBack && !hate) continue; // 편들어 줄 가문 하나 없이는 나서지 않는다(원한이 깊으면 혼자라도)
      const st = gekStrength(s, c, g); if (st.A < st.D * GK.start) continue;
      let ch = GK.chance; if (hate) ch *= GK.feudX; if (m.tr[3] > 0) ch *= 1.3; if (m.tr[4] > 0) ch *= 0.8; if (s.oaths[m.id] !== undefined) ch *= 0.5;
      if (c.rand() >= ch) continue;
      s.gek.push(g); res.started.push(g);
      const A = nm(c, m.id), B = nm(c, ld.id);
      L2(`하극상: ${A[0]} 가가 자기 세력 대표 ${B[0]} 가에게 도전장을 내밀었습니다(도전자 편 ${g.backA.length} · 대표 편 ${g.backD.length}).`, `Usurpation: House ${A[1]} has challenged its own faction leader, House ${B[1]} (${g.backA.length} houses with the challenger, ${g.backD.length} with the leader).`, true);
      break;
    }
  }
  return res;
}
/** 회랑이 도전자에게 돈을 댐 / 군주가 대표 편에 섬(도전 하나에 한 번씩). */
export function gekBack(s: DomainSave, id: number, k: 'aid' | 'crown'): Gek | 'none' | 'done' {
  const g = gekOf(s, id); if (!g) return 'none'; if (g[k]) return 'done'; g[k] = 1;
  for (const [sys, f] of Object.entries(s.front)) if (s.owner[sys] === g.vs && (f.by === g.by || g.backA.includes(f.by))) { if (k === 'aid') f.aidA = 12; else f.aidD = 12; }
  return g;
}
// ---- 평화로운 독립(2026-11-08) ----
// 충성이 「불만」(25~39)이거나, 「평온」이어도 영지가 세력 평균보다 훨씬 큰 귀족이 해마다 낮은 확률로 군주에게 독립을 청한다(진영마다 한 해 하나).
// 군주가 플레이어면 플레이어가 답하고(2년 안에 답하지 않으면 거절로 친다), AI 군주면 다음 연례 판단 때 정한다 — 큰 귀족일수록, 회랑이 밀어 줄수록 허락하기 쉽다.
// 허락 → 전쟁 없는 분리(반란국과 같은 길, 독립 전쟁 없음). 거절 → 충성 크게 하락(반란 밀약으로 가기 쉬워진다).
export const IND = { chance: 0.15, minSize: 6, sizeX: 1.2, bigX: 1.6, cool: 6, answerYears: 2, aiBase: 0.15, aiBig: 0.3, aiBack: 0.25, aiMax: 0.7, refuseLoyal: -15, refuseRel: -20, grantLoyal: 0 };
export interface IndResult { started: Ind[]; granted: Ind[]; refused: Ind[]; lines: DomLine[] }
export function indTick(s: DomainSave, c: YearInput, seatSide: NSide | null): IndResult {
  const res: IndResult = { started: [], granted: [], refused: [], lines: [] };
  const sizes = sizeOf(s), live = c.nobles.filter((n) => c.alive(n.id) && !s.fallen[n.id] && (sizes.get(n.id) ?? 0) > 0);
  const avg = (sd: NSide) => { const xs = live.filter((n) => n.side === sd).map((n) => sizes.get(n.id) ?? 0); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; };
  const L2 = (ko: string, en: string, grave = false) => res.lines.push(grave ? { ko, en, grave } : { ko, en });
  // 1) 걸려 있는 요구에 답하기
  for (const q of [...s.ind]) {
    const A = nm(c, q.id);
    if (!c.alive(q.id) || s.fallen[q.id]) { s.ind = s.ind.filter((x) => x !== q); continue; }
    if (q.side === seatSide) { if (c.year - q.y >= IND.answerYears) { s.ind = s.ind.filter((x) => x !== q); res.refused.push(q); (s.indRef ??= {})[q.id] = c.year; L2(`${A[0]} 가의 독립 요구는 답을 받지 못한 채 묻혔습니다.`, `House ${A[1]}'s plea for independence was left unanswered and buried.`); } continue; }
    if (q.y >= c.year) continue;
    const big = Math.max(0, (sizes.get(q.id) ?? 0) / (avg(q.side) || 1) - 1);
    const p = Math.min(IND.aiMax, IND.aiBase + IND.aiBig * big + (q.back ? IND.aiBack : 0));
    s.ind = s.ind.filter((x) => x !== q);
    if (c.rand() < p) { res.granted.push(q); L2(`군주가 ${A[0]} 가의 독립을 허락했습니다. 그 영지가 전쟁 없이 떨어져 나갑니다.`, `The sovereign has granted House ${A[1]} its independence. Its domain departs without war.`, true); }
    else { res.refused.push(q); (s.indRef ??= {})[q.id] = c.year; L2(`군주가 ${A[0]} 가의 독립 요구를 물리쳤습니다. 그 가문은 앙심을 품었습니다.`, `The sovereign has refused House ${A[1]}'s plea for independence. The house now nurses a grudge.`); }
  }
  // 2) 새 요구(진영마다 한 해 하나)
  for (const sd of ['a', 'b'] as NSide[]) {
    if (s.ind.some((q) => q.side === sd && q.y === c.year)) continue;
    const av = avg(sd);
    const cands = live.filter((n) => n.side === sd && !s.ind.some((q) => q.id === n.id) && !s.plots.some((p) => p.lead === n.id) && !s.gek.some((g) => g.by === n.id || g.vs === n.id)
      && s.oaths[n.id] === undefined && c.year - (s.indY[n.id] ?? -99) >= IND.cool && (sizes.get(n.id) ?? 0) >= Math.max(IND.minSize, av * IND.sizeX)
      && (() => { const st = loyalStageOf(c.loyal(n.id)); return st === 2 || (st === 1 && (sizes.get(n.id) ?? 0) >= av * IND.bigX); })())
      .sort((x, y) => (sizes.get(y.id) ?? 0) - (sizes.get(x.id) ?? 0));
    for (const n of cands) {
      let ch = IND.chance; if (n.tr[3] > 0) ch *= 1.3; if (n.tr[0] >= 2) ch *= 1.2; // 용맹한 가문, 명예로운 가문(반란 대신 정식으로 청한다)
      if (c.rand() >= ch) continue;
      const q: Ind = { id: n.id, side: sd, y: c.year }; s.ind.push(q); s.indY[n.id] = c.year; res.started.push(q);
      L2(`${n.ko} 가가 군주에게 제 영지를 놓아 달라며 정식으로 독립을 청했습니다.`, `House ${n.en} has formally asked its sovereign to let its domain go free.`, true);
      break;
    }
  }
  return res;
}
/** 플레이어 군주의 답. 걸린 요구를 지우고 돌려준다(없으면 null). */
export function answerInd(s: DomainSave, id: number): Ind | null { const q = s.ind.find((x) => x.id === id); if (!q) return null; s.ind = s.ind.filter((x) => x !== q); return q; }
export interface MonthResult { flips: Array<[number, Holder, Holder]>; loyal: Array<[number, number]>; fallen: Array<{ id: number; by: number }> }
/** 달마다 한 번(같은 달에 두 번 부르면 아무것도 안 함). year 는 그 달의 해(성계 고정 확인용). */
export function monthTick(s: DomainSave, c: DomCtx, mk: string, year: number): MonthResult | null {
  if (s.lastM === mk) return null; s.lastM = mk;
  const res: MonthResult = { flips: [], loyal: [], fallen: [] };
  const byId = new Map(c.nobles.map((n) => [n.id, n] as [number, NobleRow]));
  const pr = pressures(s, c), seen = new Set<string>(), sizes = sizeOf(s);
  for (const p of pr) {
    const k = String(p.sys); seen.add(k);
    let f = s.front[k];
    if (!f || f.by !== p.by) { const an = byId.get(p.by), dn = byId.get(p.owner); if (!an || !dn) continue; f = s.front[k] = { by: p.by, p: f && f.by !== p.by ? 0 : 0, mom: 0, aOp: aOpOf(an), dOp: dOpOf(dn), since: mk, cool: 0 }; }
    f.cool = 0;
    if ((s.lock[k] ?? -1) >= year) { f.mom = 0; continue; } // 군주가 편들어 준 성계는 그대로
    { const m0 = momOf(s, k, f, p.ratio, garPush(c, s, p.sys, p.by, p.owner, f.aOp, sizes)); f.mom = Math.round((m0 > 0 ? m0 * orderDamp(c, p.by, p.owner) : m0) * 10) / 10; }
    f.p = clamp(f.p + f.mom, 0, 100);
    if (f.p <= 0 && p.ratio < DM.contest) { delete s.front[k]; continue; } // 밀리던 도전이 완전히 꺾임
    if (f.aidA) f.aidA = f.aidA - 1 || undefined; if (f.aidD) f.aidD = f.aidD - 1 || undefined;
    if (f.aOp === 'force') addDg(s, p.owner, p.by, FR.forceDg);
    if (f.p >= 100) {
      s.owner[k] = p.by; delete s.front[k]; delete s.pend[k]; res.flips.push([p.sys, p.owner, p.by]);
      for (const g of s.gek ?? []) { if (g.vs === p.owner && (g.by === p.by || g.backA.includes(p.by))) g.took++; else if (g.vs === p.by && (g.by === p.owner || g.backA.includes(p.owner))) g.took = Math.max(0, g.took - 1); }
      addDg(s, p.owner, p.by, FR.loss); res.loyal.push([p.owner, FR.loyalLoss]);
      const A = nm(c, p.by), B = nm(c, p.owner), sn = sysName(p.sys);
      s.buf.ch.push([p.sys, p.owner, p.by]); s.buf.lines.push({ ko: `${mk} ${A[0]} 가가 ${B[0]} 가의 ${sn[0]}을(를) 손에 넣었습니다.`, en: `${mk} House ${A[1]} has taken ${sn[1]} from House ${B[1]}.` });
      if (s.buf.lines.length > 60) s.buf.lines.splice(0, s.buf.lines.length - 60);
    }
  }
  for (const [k, f] of Object.entries(s.front)) if (!seen.has(k)) { f.cool++; f.mom = -FR.coolDrop; f.p = Math.max(0, f.p - FR.coolDrop); if (f.cool >= FR.coolOff || f.p <= 0) delete s.front[k]; }
  // 몰락: 거점 말고 땅을 모두 잃음(이번 달에 잃은 귀족만 본다)
  for (const [, from, by] of res.flips) {
    const n = byId.get(from); if (!n || s.fallen[from] || !c.alive(from) || !(s.init[from] > 1)) continue;
    const mine = domainOf(s, from); if (mine.some((x) => x !== from)) continue;
    for (const x of mine) s.owner[x] = by; s.fallen[from] = { by, y: year }; res.fallen.push({ id: from, by });
    for (const p of s.pacts) if (p.k === 'ally' && (p.a === from || p.b === from)) addDg(s, p.a === from ? p.b : p.a, by, DM.fallAllyDg);
    s.pacts = s.pacts.filter((p) => p.a !== from && p.b !== from);
    const A = nm(c, from), B = nm(c, by); s.buf.lines.push({ ko: `${A[0]} 가가 몰락했습니다. 마지막 거점까지 ${B[0]} 가에게 넘어갔습니다. 이 가문은 다시 일어서지 못합니다.`, en: `House ${A[1]} has fallen. Its last seat passed to House ${B[1]}. The house will not rise again.`, grave: true });
  }
  return res;
}
/** 전투 현황판에 줄 한 전선의 자세한 내용: 양쪽 영향력과 그 몫, 장악 진척도, 달마다 움직임, 그 움직임을 만든 요인들. */
export interface FrontRow { k: string; v: number; kind: 'mul' | 'add' | 'base' }
export function frontDetail(s: DomainSave, c: DomCtx, sys: number): { sys: number; owner: number; by: number; share: number; p: number; mom: number; aOp: AOp; dOp: DOp; a: FrontRow[]; d: FrontRow[]; A: number; D: number; locked: boolean; since: string; gek: { by: number; vs: number } | null } | null {
  const k = String(sys), f = s.front[k], o = s.owner[k]; if (!f || o === undefined || o < 0) return null;
  const pr = pressures(s, c).find((p) => p.sys === sys);
  const an = c.nobles.find((n) => n.id === f.by), dn = c.nobles.find((n) => n.id === o); if (!an || !dn) return null;
  const sizes = sizeOf(s), ha = hopsFrom(f.by).get(sys) ?? DM.hopMax + 1, hd = hopsFrom(o).get(sys) ?? DM.hopMax + 1, pact = pactOf(s, f.by, o);
  const pa = powerOf(an, sizes.get(f.by) ?? 0, c.loyal(f.by)), pd = powerOf(dn, sizes.get(o) ?? 0, c.loyal(o));
  const a: FrontRow[] = [{ k: 'power', v: Math.round(pa * 10) / 10, kind: 'base' }, { k: 'ambition', v: s.amb[f.by] ?? 1, kind: 'mul' }, { k: 'distance', v: Math.round(Math.pow(DM.decay, ha) * 100) / 100, kind: 'mul' }];
  if (pact?.k === 'feud') a.push({ k: 'feud', v: DM.feudBoost, kind: 'mul' }); if (pact?.k === 'nap') a.push({ k: 'nap', v: DM.napCut, kind: 'mul' });
  const g = garPush(c, s, sys, f.by, o, f.aOp, sizes);
  const gk = s.gek.find((x) => (x.vs === o && (x.by === f.by || x.backA.includes(f.by))) || (x.vs === f.by && (x.by === o || x.backA.includes(o))));
  { const od = orderDamp(c, f.by, o); if (od !== 1) a.push({ k: 'order', v: od, kind: 'mul' }); }
  if (gk) { if (gk.vs === o) { a.push({ k: 'gek_a', v: Math.round(gekA(gk) * 100) / 100, kind: 'mul' }); } else { a.push({ k: 'gek_d', v: Math.round(gekD(gk) * 100) / 100, kind: 'mul' }); } }
  a.push({ k: 'op_' + f.aOp, v: A_OP[f.aOp], kind: 'add' }); if (g.a) a.push({ k: 'garrison', v: g.a, kind: 'add' }); if (f.aidA) a.push({ k: 'corridor', v: FR.aid, kind: 'add' });
  const d: FrontRow[] = [{ k: 'power', v: Math.round(pd * 10) / 10, kind: 'base' }, { k: 'ambition', v: s.amb[o] ?? 1, kind: 'mul' }, { k: 'distance', v: Math.round(Math.pow(DM.decay, hd) * 100) / 100, kind: 'mul' }, { k: 'home', v: DM.keep, kind: 'mul' }, { k: 'op_' + f.dOp, v: D_OP[f.dOp], kind: 'add' }];
  if (g.d) d.push({ k: 'garrison', v: g.d, kind: 'add' });
  if (gk && gk.vs === o) d.push({ k: 'gek_d', v: Math.round(gekD(gk) * 100) / 100, kind: 'mul' });
  if (f.aidD) d.push({ k: 'corridor', v: FR.aid, kind: 'add' });
  const A = pr ? pr.a : 0, D = pr ? pr.d : 1;
  return { sys, owner: o, by: f.by, share: Math.round((A / ((A + D) || 1)) * 100), p: Math.round(f.p), mom: f.mom, aOp: f.aOp, dOp: f.dOp, a, d, A: Math.round(A * 10) / 10, D: Math.round(D * 10) / 10, locked: (s.lock[k] ?? -1) >= 0, since: f.since, gek: gk ? { by: gk.by, vs: gk.vs } : null };
}
