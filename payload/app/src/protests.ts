// 시위 시스템(사용자 기획 2026-10-23, 문서 90/시위시스템_설계.md)의 순수 규칙. Claude 사전 설계.
// 사용자 확정: 시민·파벌 성향 ≠ 제국 공식 성향 / 원인은 앱이 읽은 실제 자료만(AI 가 차별·정책을 지어내지 않음) /
//   대응 5가지(대표단 대화=유일한 LLM, 개선 약속, 실제 지원, 무시, 해산) / 총독 입장(대변·중재·강경) / 행성당 시위 하나·핵심 요구 하나 /
//   앱이 주기적으로 발생·진행 판정, 볼 때만 생성(슈뢰딩거의 토큰) / 같은 사건에 파벌별 다른 반응 /
//   해산 = 안정도 +5 회복 + 불씨 소폭 증가 / 군체·기계 제국은 시위 없음 / 약속 기본 기한 1년 /
//   빈도: 「길지만 존재감은 있는」 정도 — 아래 PROTEST 의 Claude 제안값(평균 1~2년에 한 번, 동시 최대 2).
// 게임 근거(4.5.1): every_pop_faction·is_pop_faction_type·support·faction_approval / planet_stability·planet_crime·free_housing·free_amenities·num_unemployed /
//   has_citizenship_type·has_purge_type·has_slavery_type·has_living_standard / is_at_war·전쟁 피로도·years_of_peace / 지도자 support(파벌 지지). 모드 초안 mod/patches/05.
import { L } from './i18n-pick';
import { addMonths, addYears, cmpDate } from './gamedate';
import { getPair, type Pid, type RelationLedger } from './relations';
import type { StateSnapshot } from './gamestate';
import type { ChatMessage } from './player2';
import { PROTEST_DELTA, type StandingEvent } from './standing';

export type Ethic = 'egalitarian' | 'authoritarian' | 'xenophile' | 'xenophobe' | 'pacifist' | 'militarist' | 'spiritualist' | 'materialist';
export const OPPOSITE: Record<Ethic, Ethic> = { egalitarian: 'authoritarian', authoritarian: 'egalitarian', xenophile: 'xenophobe', xenophobe: 'xenophile', pacifist: 'militarist', militarist: 'pacifist', spiritualist: 'materialist', materialist: 'spiritualist' };

/** 빈도·기간(사용자 확정 + Claude 제안). */
export const PROTEST = {
  maxActive: 2,                 // 제국 전체 동시 진행(제안)
  empireGapMonths: 12,          // 새 시위는 직전 시위 시작 뒤 최소 1년(제안) → 체감 1~2년에 한 번
  planetCooldownYears: 5,       // 같은 행성 재발생 대기(제안)
  baseMonthly: 0.02,            // 원인이 있는 행성의 월 기본 확률 × 원인 세기(제안)
  emberBonus: 0.25,             // 불씨 1단계당 확률 ×1.25(소폭)
  maxEmber: 3,
  escalateMonths: 3,            // 방치 3개월이면 한 단계 커짐(한 번만)
  fadeMonths: 6,                // 방치 6개월이면 저절로 잦아듦 → 불씨 +1
  promiseYears: 1,              // 약속 기본 기한(확정)
  minFactionShare: 0.2,         // 그 행성 인구 중 그 파벌 비율 20% 이상이어야 시위 주체(제안)
  unemployedShare: 0.05,        // 실업이 인구의 5% 이상일 때만 생계 원인(4.x 인구 단위가 커서 1명 실업으로 시위가 나지 않게, 제안)
  /** 안정도 보정(사용자 확정 2026-10-23): 40 미만 ×1 → 50 ×0.5 → 60 ×0.3 → 80 이상 0(시위 없음). 구간 사이 직선. */
  stabilityCurve: [[40, 1], [50, 0.5], [60, 0.3], [80, 0], [100, 0]] as ReadonlyArray<readonly [number, number]>,
  dispersal: { modifier: 'sllm_protest_dispersed', stability: 5, days: 180 }, // 안정도 +5 확정, 기간은 제안
} as const;

/** 요구 종류와 충족 조건(앱이 게임 자료로만 판정). */
export type DemandKind = 'end_war' | 'stop_war_humiliation' | 'species_rights' | 'living_conditions' | 'order' | 'limit_aliens' | 'faith' | 'research';
export interface DemandSpec { kind: DemandKind; ethic: Ethic | 'any'; target?: string }
export const DEMAND_LABEL: Record<DemandKind, () => string> = {
  end_war: () => L('전쟁 종결', 'End the war'), stop_war_humiliation: () => L('굴욕적 외교 중단·국방 강화', 'Stop humiliating diplomacy, strengthen defense'),
  species_rights: () => L('차별 철폐·시민권 보장', 'End discrimination, guarantee citizenship'), living_conditions: () => L('생활 여건 개선', 'Better living conditions'),
  order: () => L('혼란 수습·질서 회복', 'Restore order'), limit_aliens: () => L('외계 영향 제한', 'Limit alien influence'),
  faith: () => L('신앙 전통 보호', 'Protect religious tradition'), research: () => L('연구 투자 확대', 'More research investment'),
};
export const ETHIC_LABEL: Record<Ethic, () => string> = {
  egalitarian: () => L('평등주의', 'Egalitarian'), authoritarian: () => L('권위주의', 'Authoritarian'), xenophile: () => L('외계종 선호', 'Xenophile'), xenophobe: () => L('외계종 혐오', 'Xenophobe'),
  pacifist: () => L('평화주의', 'Pacifist'), militarist: () => L('군국주의', 'Militarist'), spiritualist: () => L('정신주의', 'Spiritualist'), materialist: () => L('물질주의', 'Materialist'),
};

/** 모드가 보내는 자료(월간). 없는 값은 undefined = 미확인 → 그 원인은 만들지 않는다. */
export interface PlanetSnap { k: number; name: string; pops?: number; stability?: number; crime?: number; freeHousing?: number; freeAmenities?: number; unemployed?: number; governor?: Pid; factionShare: Partial<Record<Ethic, number>> }
export interface EmpireSnap {
  gestalt: boolean; ethics: Ethic[]; date: string; atWar?: boolean; warMonths?: number; warExhaustion?: number;
  /** 종족별 권리(모드가 시민권 유형 키를 그대로 보냄). 2등 시민·노예·숙청이면 차별 근거. */
  speciesRights: { species: string; citizenship?: string; purge?: boolean; slavery?: boolean }[];
  factions: Partial<Record<Ethic, { support?: number; approval?: number }>>;
  governorSupport: Record<Pid, Ethic[]>; // 지도자 support 로 확인된 지지 파벌
}
/** 근거(①): AI 에 넘기는 것은 이것뿐. 값과 관측 날짜. */
export interface Evidence { key: string; text: string; on: string }
export interface Cause { planetK: number; ethic: Ethic | 'any'; demand: DemandSpec; strength: number; evidence: Evidence[] }

const DISCRIM = /second|limited|residence|slave|purge|undesirable/i;
/** 원인 찾기(앱 규칙, LLM 없음). 확인된 값으로만. */
export function findCauses(e: EmpireSnap, p: PlanetSnap): Cause[] {
  if (e.gestalt) return [];
  const out: Cause[] = []; const share = (x: Ethic) => p.factionShare[x] ?? 0;
  const push = (ethic: Ethic | 'any', demand: DemandSpec, strength: number, evidence: Evidence[]) => {
    if (ethic !== 'any' && share(ethic) < PROTEST.minFactionShare) return;
    out.push({ planetK: p.k, ethic, demand, strength: Math.max(0, Math.min(1, strength)), evidence });
  };
  if (e.atWar && e.warMonths !== undefined && e.warMonths >= 24) push('pacifist', { kind: 'end_war', ethic: 'pacifist' }, e.warMonths / 72 + (e.warExhaustion ?? 0) * 0.5, [{ key: 'war', text: L(`전쟁 ${Math.floor(e.warMonths / 12)}년째`, `At war for ${Math.floor(e.warMonths / 12)} years`) + (e.warExhaustion !== undefined ? L(`, 전쟁 피로도 ${Math.round(e.warExhaustion * 100)}%`, `, war exhaustion ${Math.round(e.warExhaustion * 100)}%`) : ''), on: e.date }]);
  for (const s of e.speciesRights) {
    const bad = s.purge || s.slavery || (s.citizenship !== undefined && DISCRIM.test(s.citizenship)); if (!bad) continue;
    const ev = [{ key: `rights:${s.species}`, text: L(`${s.species}: ${s.purge ? '숙청 대상' : s.slavery ? '노예' : '제한된 시민권'}`, `${s.species}: ${s.purge ? 'targeted for purge' : s.slavery ? 'enslaved' : 'restricted citizenship'}`), on: e.date }];
    push('egalitarian', { kind: 'species_rights', ethic: 'egalitarian', target: s.species }, s.purge ? 1 : s.slavery ? 0.8 : 0.5, ev);
    push('xenophile', { kind: 'species_rights', ethic: 'xenophile', target: s.species }, s.purge ? 1 : s.slavery ? 0.7 : 0.4, ev);
  }
  const lack: Evidence[] = [];
  if (p.freeHousing !== undefined && p.freeHousing < 0) lack.push({ key: 'housing', text: L(`주거 부족 ${-p.freeHousing}`, `Housing shortage ${-p.freeHousing}`), on: e.date });
  if (p.freeAmenities !== undefined && p.freeAmenities < 0) lack.push({ key: 'amenities', text: L(`편의시설 부족 ${-p.freeAmenities}`, `Amenities shortage ${-p.freeAmenities}`), on: e.date });
  if (p.unemployed !== undefined && p.unemployed > 0 && (p.pops === undefined || p.pops <= 0 || p.unemployed / p.pops >= PROTEST.unemployedShare)) lack.push({ key: 'jobs', text: L(`실업 ${p.unemployed}`, `Unemployed ${p.unemployed}`), on: e.date });
  if (lack.length) push('any', { kind: 'living_conditions', ethic: 'any' }, 0.3 * lack.length, lack);
  if ((p.crime !== undefined && p.crime >= 30) || (p.stability !== undefined && p.stability < 35)) push('authoritarian', { kind: 'order', ethic: 'authoritarian' }, ((p.crime ?? 0) / 100) + (p.stability !== undefined && p.stability < 35 ? 0.4 : 0), [{ key: 'order', text: L(`범죄 ${p.crime ?? '?'}, 안정도 ${p.stability ?? '?'}`, `Crime ${p.crime ?? '?'}, stability ${p.stability ?? '?'}`), on: e.date }]);
  // 파벌 만족도가 매우 낮으면(게임이 이미 그 파벌의 불만을 말해 줌) 그 성향의 대표 요구로 — 근거 = 만족도 수치.
  for (const [x, f] of Object.entries(e.factions) as [Ethic, { approval?: number }][]) {
    if (f.approval === undefined || f.approval >= 0.35) continue;
    const kind: DemandKind | null = x === 'militarist' ? 'stop_war_humiliation' : x === 'xenophobe' ? 'limit_aliens' : x === 'spiritualist' ? 'faith' : x === 'materialist' ? 'research' : null;
    if (kind) push(x, { kind, ethic: x }, (0.35 - f.approval) * 2, [{ key: `approval:${x}`, text: L(`${ETHIC_LABEL[x]()} 파벌 만족도 ${Math.round(f.approval * 100)}%`, `${ETHIC_LABEL[x]()} faction approval ${Math.round(f.approval * 100)}%`), on: e.date }]);
  }
  return out;
}
/** 안정도 보정(사용자 확정: 높을수록 엄청 적게). 값이 없으면 ×1(근거 없이 깎지도 올리지도 않음). */
export function stabilityFactor(stability: number | undefined): number {
  if (stability === undefined || !Number.isFinite(stability)) return 1;
  const c = PROTEST.stabilityCurve; if (stability < c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) { const [x0, y0] = c[i - 1], [x1, y1] = c[i]; if (stability <= x1) return y0 + (y1 - y0) * (stability - x0) / (x1 - x0); }
  return c[c.length - 1][1];
}
/** 체제와 시위 성향(⑤): 제국 공식 성향과 반대 → 덜 자주, 더 세게. */
export function regimeFactor(e: EmpireSnap, ethic: Ethic | 'any'): { chance: number; intensity: number } {
  if (ethic === 'any') return { chance: 1, intensity: 0 };
  if (e.ethics.includes(OPPOSITE[ethic])) return { chance: 0.6, intensity: 1 };
  if (e.ethics.includes(ethic)) return { chance: 1.2, intensity: 0 };
  return { chance: 1, intensity: 0 };
}

export type ProtestState = 'active' | 'promised' | 'resolved' | 'dispersed' | 'faded' | 'broken';
export interface Protest {
  id: string; sid: string; planetK: number; planetName: string; ethic: Ethic | 'any'; demand: DemandSpec;
  evidence: Evidence[]; startedOn: string; intensity: 1 | 2 | 3; escalated: boolean; state: ProtestState; endedOn?: string;
  /** 대표단(⑧): 시위마다 고정 RP 인물. 이름은 처음 볼 때 한 번 생성. */
  delegate: { id: string; name?: string; provenance: 'rp' };
  promise?: { on: string; due: string; text: string };
  governorStance?: 'advocate' | 'mediate' | 'hardline'; governor?: Pid;
  log: { on: string; what: string }[];
  /** 이 시위를 낳은 사건(④ 반응표) */
  sourceEventId?: string;
  /** 대표단과 나눈 말(대표단 대화만 LLM). 최근 것만 남긴다. */
  talk?: { who: 'ruler' | 'delegate'; text: string; on: string }[];
}
export interface ProtestBook { sid: string; protests: Record<string, Protest>; ember: Record<string, number>; lastStart?: string; planetCooldown: Record<string, string>; celebrations: { id: string; planetK: number; planetName?: string; ethic: Ethic; eventId: string; on: string }[];
  /** 게임 자료 연결(앱 합침): 전쟁 시작일·직전 전쟁 상태, 종족 시민권 직전 값, 사건 반응의 대기 원인(1년), 시위 시작 때 기준 자료(요구 충족 판정용). */
  warSince?: string; lastWar?: { atWar: boolean; own: number; foe: number }; rights?: Record<string, number>;
  pending?: (Cause & { until: string; eventId: string })[]; base?: Record<string, { e: EmpireSnap; p: PlanetSnap }>;
  /** 행성별 마지막 성향 비율·인구(2026-10-24 렉 줄이기): 모드가 성향별 인구를 3달에 한 번만 보내므로(pg=0 인 달) 그 사이에는 이 값을 쓴다. 행성 이름 → 값. */
  shares?: Record<string, { share: PlanetSnap['factionShare']; pops?: number }>; }
export const emptyProtestBook = (sid: string): ProtestBook => ({ sid, protests: {}, ember: {}, planetCooldown: {}, celebrations: [] });
const isOpen = (p: Protest) => p.state === 'active' || p.state === 'promised';
export const openProtests = (b: ProtestBook): Protest[] => Object.values(b.protests).filter(isOpen);

/** 발생 가능(⑨): 군체·기계 없음, 동시 상한, 제국 간격, 행성 대기, 행성당 하나. */
export function canStart(b: ProtestBook, e: EmpireSnap, k: number, today: string): boolean {
  if (e.gestalt || openProtests(b).length >= PROTEST.maxActive) return false;
  if (b.lastStart && cmpDate(today, addMonths(b.lastStart, PROTEST.empireGapMonths)) < 0) return false;
  const cd = b.planetCooldown[String(k)]; if (cd && cmpDate(today, cd) < 0) return false;
  return !openProtests(b).some((p) => p.planetK === k);
}
/** 월간 판정: 원인이 있는 행성만, 가장 강한 원인 하나로(행성당 요구 하나). */
export function monthlyRoll(b: ProtestBook, e: EmpireSnap, planets: PlanetSnap[], today: string, rng: () => number, idGen: (k: number) => string, eventCauses: Cause[] = []): Protest | null {
  for (const p of planets) {
    if (!canStart(b, e, p.k, today)) continue;
    const c = [...findCauses(e, p), ...eventCauses.filter((x) => x.planetK === p.k)].sort((x, y) => y.strength - x.strength)[0]; if (!c || c.strength <= 0) continue; // 사건 반응표의 반발도 원인으로
    const ember = Math.min(PROTEST.maxEmber, b.ember[String(p.k)] ?? 0); const rf = regimeFactor(e, c.ethic);
    const chance = PROTEST.baseMonthly * c.strength * rf.chance * (1 + PROTEST.emberBonus * ember) * stabilityFactor(p.stability);
    if (rng() >= chance) continue;
    const pr: Protest = { id: idGen(p.k), sid: b.sid, planetK: p.k, planetName: p.name, ethic: c.ethic, demand: c.demand, evidence: c.evidence, startedOn: today, intensity: Math.min(3, 1 + rf.intensity + (ember >= 2 ? 1 : 0)) as 1 | 2 | 3, escalated: false, state: 'active', delegate: { id: `dlg:${idGen(p.k)}`, provenance: 'rp' }, log: [{ on: today, what: 'started' }] };
    b.protests[pr.id] = pr; b.lastStart = today; return pr; // 한 달에 하나만
  }
  return null;
}

/** 요구 충족 판정(②): 게임 자료로만. undefined = 판단 불가(충족 아님). */
export function demandMet(d: DemandSpec, e: EmpireSnap, p: PlanetSnap, base: { e: EmpireSnap; p: PlanetSnap }): boolean | undefined {
  switch (d.kind) {
    case 'end_war': return e.atWar === undefined ? undefined : !e.atWar;
    case 'species_rights': { const s = e.speciesRights.find((x) => x.species === d.target); if (!s) return undefined; return !s.purge && !s.slavery && !(s.citizenship && DISCRIM.test(s.citizenship)); }
    case 'living_conditions': return (p.freeHousing ?? -1) >= 0 && (p.freeAmenities ?? -1) >= 0 && (p.unemployed === undefined ? false : p.unemployed === 0 || (p.pops !== undefined && p.pops > 0 && p.unemployed / p.pops < PROTEST.unemployedShare));
    case 'order': return p.crime === undefined && p.stability === undefined ? undefined : (p.crime ?? 0) < 30 && (p.stability ?? 100) >= 35;
    default: { // 만족도 기반 요구: 처음보다 만족도가 0.15 이상 올랐으면 충족
      const x = d.ethic as Ethic; const now = e.factions[x]?.approval, was = base.e.factions[x]?.approval;
      return now === undefined || was === undefined ? undefined : now - was >= 0.15;
    }
  }
}

/** 플레이어 대응(사용자 확정 5가지). talk 는 앱이 상태만 바꾸고 LLM 은 호출 쪽(대표단 대화)에서. */
export type Response = { kind: 'talk' } | { kind: 'promise'; text: string; dueYears?: number } | { kind: 'support'; effectRequestId: string } | { kind: 'ignore' } | { kind: 'disperse'; effectRequestId: string };
export function respond(b: ProtestBook, pr: Protest, r: Response, today: string): { ok: boolean; command?: 'dispersal'; why?: string } {
  if (!isOpen(pr)) return { ok: false, why: L('이미 끝난 시위입니다.', 'This protest has already ended.') };
  pr.log.push({ on: today, what: r.kind });
  switch (r.kind) {
    case 'talk': case 'ignore': return { ok: true };
    case 'promise': {
      if (pr.state === 'promised') return { ok: false, why: L('이미 약속한 시위입니다.', 'You already made a promise here.') };
      const text = String(r.text ?? '').trim().slice(0, 200) || DEMAND_LABEL[pr.demand.kind]();
      pr.promise = { on: today, due: addYears(today, r.dueYears ?? PROTEST.promiseYears), text }; pr.state = 'promised'; return { ok: true };
    }
    case 'support': pr.log.push({ on: today, what: `support_req:${r.effectRequestId}` }); return { ok: true }; // 실제 효과 확인 뒤 tick 이 충족 판정
    case 'disperse': end(b, pr, 'dispersed', today, 1); pr.log.push({ on: today, what: `dispersal_req:${r.effectRequestId}` }); return { ok: true, command: 'dispersal' };
  }
}
function end(b: ProtestBook, pr: Protest, st: ProtestState, today: string, emberAdd: number): void {
  pr.state = st; pr.endedOn = today; const k = String(pr.planetK);
  if (emberAdd) b.ember[k] = Math.min(PROTEST.maxEmber, (b.ember[k] ?? 0) + emberAdd);
  else if (st === 'resolved') b.ember[k] = Math.max(0, (b.ember[k] ?? 0) - 1);
  b.planetCooldown[k] = addYears(today, PROTEST.planetCooldownYears);
}
/** 시위 행성을 이번 달 목록에서 찾기: 이름이 같으면 그 행성(순서가 바뀌어도), 이름이 바뀌었으면 예전 순서 번호. */
export function planetOf<P extends { k: number; name: string }>(planets: P[], pr: { planetK: number; planetName: string }): P | undefined {
  return planets.find((x) => x.name === pr.planetName) ?? planets.find((x) => x.k === pr.planetK);
}
/** 월간 진행(③): 충족 → 해결(약속이면 약속 이행) / 약속 기한 넘김 → 약속 불이행 + 불씨 / 방치 3개월 → 한 단계 커짐 / 6개월 → 잦아듦 + 불씨.
 *  정치적 지위로 넘길 사건(standing.ts 의 promise_kept/broken)을 돌려준다. */
export function tick(b: ProtestBook, e: EmpireSnap, planets: PlanetSnap[], base: Record<string, { e: EmpireSnap; p: PlanetSnap }>, today: string): { resolved: Protest[]; broken: Protest[]; faded: Protest[]; escalated: Protest[]; standing: { kind: 'promise_kept' | 'promise_broken'; protestId: string }[] } {
  const out = { resolved: [] as Protest[], broken: [] as Protest[], faded: [] as Protest[], escalated: [] as Protest[], standing: [] as { kind: 'promise_kept' | 'promise_broken'; protestId: string }[] };
  for (const pr of openProtests(b)) {
    const p = planetOf(planets, pr); if (p) pr.planetK = p.k; const b0 = base[pr.id]; // 이름으로 먼저 찾는다: 새 식민지·잃은 행성으로 순서(k)가 바뀐다
    const met = p && b0 ? demandMet(pr.demand, e, p, b0) : undefined;
    if (met === true) { const kept = pr.state === 'promised'; end(b, pr, 'resolved', today, 0); out.resolved.push(pr); if (kept) out.standing.push({ kind: 'promise_kept', protestId: pr.id }); continue; }
    if (pr.state === 'promised' && pr.promise && cmpDate(today, pr.promise.due) > 0) { end(b, pr, 'broken', today, 2); out.broken.push(pr); out.standing.push({ kind: 'promise_broken', protestId: pr.id }); continue; }
    if (pr.state !== 'active') continue;
    const lastAct = [...pr.log].reverse().find((l) => l.what !== 'ignore' && l.what !== 'escalated')?.on ?? pr.startedOn;
    if (cmpDate(today, addMonths(lastAct, PROTEST.fadeMonths)) >= 0) { end(b, pr, 'faded', today, 1); out.faded.push(pr); continue; }
    if (!pr.escalated && pr.intensity < 3 && cmpDate(today, addMonths(pr.startedOn, PROTEST.escalateMonths)) >= 0 && lastAct === pr.startedOn) { pr.intensity = (pr.intensity + 1) as 2 | 3; pr.escalated = true; pr.log.push({ on: today, what: 'escalated' }); out.escalated.push(pr); }
  }
  return out;
}

/** 총독 입장(⑥): 확인된 파벌 지지로. 시위 파벌 지지 → 대변, 반대 파벌 지지 → 강경, 그 밖/미확인 → 중재. 생계 시위는 강경 근거가 없으면 중재. */
export function governorStance(e: EmpireSnap, pr: Protest, gov: Pid | undefined): Protest['governorStance'] | undefined {
  if (!gov) return undefined; const sup = e.governorSupport[gov] ?? [];
  if (pr.ethic === 'any') return sup.includes('authoritarian') ? 'hardline' : 'mediate';
  if (sup.includes(pr.ethic)) return 'advocate';
  if (sup.includes(OPPOSITE[pr.ethic])) return 'hardline';
  return 'mediate';
}
/** 대변한 총독(⑥): 지역 민심↑·통치자 신뢰↓ 힌트(수치는 standing 쪽 규칙). 시위마다 한 번. */
export function governorStandingHint(pr: Protest): { kind: 'governor_advocated' | 'governor_hardline'; pid: Pid; planetK: number; causeGroup: string } | null {
  if (!pr.governor || !pr.governorStance || pr.governorStance === 'mediate') return null;
  return { kind: pr.governorStance === 'advocate' ? 'governor_advocated' : 'governor_hardline', pid: pr.governor, planetK: pr.planetK, causeGroup: `protest:${pr.id}` };
}

/** 총독 입장의 결과(사용자 확정): 시민 편 = 지역 민심 +10·통치자 신뢰 −5, 강경 = 지역 민심 −5·통치자 신뢰 +5, 중재 = 없음.
 *  지위 쪽은 StandingEvent 로 돌려주고(standing.ts 가 묶음 중복을 막음), 신뢰는 총독→통치자 방향 값(0~100)에 시위마다 한 번. */
export function governorRelationChange(led: RelationLedger, pr: Protest, rulerPid: Pid, today: string): { standing: StandingEvent | null; trustDelta: number } {
  const h = governorStandingHint(pr); if (!h) return { standing: null, trustDelta: 0 };
  const r = getPair(led, h.pid, rulerPid); const evId = `protest-stance:${pr.id}`;
  let trustDelta = 0;
  if (!r.evidence.includes(evId)) {
    trustDelta = h.kind === 'governor_advocated' ? -PROTEST_DELTA.trust : +PROTEST_DELTA.trust;
    r.trust[h.pid] = Math.max(0, Math.min(100, (r.trust[h.pid] ?? 50) + trustDelta)); r.evidence.push(evId); r.revision++;
  }
  return { standing: { id: evId, kind: h.kind === 'governor_advocated' ? 'protest_advocate' : 'protest_hardline', pid: h.pid, planet: pr.planetName, date: today, causeGroup: h.causeGroup }, trustDelta };
}

/** 사건 반응표(④): 같은 사건에 파벌별 환영/반발. 반발은 그 파벌이 강한 행성의 시위 원인(세기 가산), 환영은 축하 집회(요구 없음·상한 미적용·기록만). */
export type ReactEvent = 'war_declared' | 'war_ended_victory' | 'war_ended_status_quo' | 'war_ended_defeat' | 'rights_improved' | 'rights_reduced' | 'execution_public';
export const REACTIONS: Record<ReactEvent, Partial<Record<Ethic, 'welcome' | 'oppose'>>> = {
  war_declared: { militarist: 'welcome', pacifist: 'oppose' },
  war_ended_victory: { militarist: 'welcome', pacifist: 'welcome' },
  war_ended_status_quo: { pacifist: 'welcome', militarist: 'oppose' },
  war_ended_defeat: { pacifist: 'welcome', militarist: 'oppose', authoritarian: 'oppose' },
  rights_improved: { egalitarian: 'welcome', xenophile: 'welcome', xenophobe: 'oppose' },
  rights_reduced: { xenophobe: 'welcome', egalitarian: 'oppose', xenophile: 'oppose' },
  execution_public: { authoritarian: 'welcome', egalitarian: 'oppose' },
};
const OPPOSE_DEMAND: Partial<Record<Ethic, DemandKind>> = { pacifist: 'end_war', militarist: 'stop_war_humiliation', authoritarian: 'order', egalitarian: 'species_rights', xenophile: 'species_rights', xenophobe: 'limit_aliens' };
/** 사건 하나 → 행성별 반응. 각 행성에서 가장 비중 큰 「반응 있는」 파벌 하나만(행성당 하나 원칙). 같은 사건은 한 번만. */
export function reactToEvent(b: ProtestBook, e: EmpireSnap, ev: { id: string; kind: ReactEvent; on: string; label: string; target?: string }, planets: PlanetSnap[]): { celebrations: number[]; grievances: Cause[] } {
  if (e.gestalt || b.celebrations.some((c) => c.eventId === ev.id)) return { celebrations: [], grievances: [] };
  const table = REACTIONS[ev.kind]; const celebrations: number[] = [], grievances: Cause[] = [];
  for (const p of planets) {
    const top = (Object.keys(table) as Ethic[]).filter((x) => (p.factionShare[x] ?? 0) >= PROTEST.minFactionShare).sort((a, c) => (p.factionShare[c] ?? 0) - (p.factionShare[a] ?? 0))[0];
    if (!top) continue;
    if (table[top] === 'welcome') { b.celebrations.push({ id: `cel:${ev.id}:${p.k}`, planetK: p.k, planetName: p.name, ethic: top, eventId: ev.id, on: ev.on }); celebrations.push(p.k); }
    else { const kind = OPPOSE_DEMAND[top]; if (kind) grievances.push({ planetK: p.k, ethic: top, demand: { kind, ethic: top, ...(ev.target ? { target: ev.target } : {}) }, strength: 0.8, evidence: [{ key: `event:${ev.id}`, text: ev.label, on: ev.on }] }); }
  }
  return { celebrations, grievances };
}

/** AI 맥락(대표단 대화·현장 보기): 근거·요구·성향·약속·총독 입장만. 근거에 없는 사실은 넣지 않는다. */
export function protestContext(pr: Protest): string[] {
  const out = [L(`시위 성향: ${pr.ethic === 'any' ? '여러 계층' : ETHIC_LABEL[pr.ethic]()}`, `Protesters: ${pr.ethic === 'any' ? 'mixed groups' : ETHIC_LABEL[pr.ethic]()}`), L(`핵심 요구: ${DEMAND_LABEL[pr.demand.kind]()}${pr.demand.target ? ` (${pr.demand.target})` : ''}`, `Core demand: ${DEMAND_LABEL[pr.demand.kind]()}${pr.demand.target ? ` (${pr.demand.target})` : ''}`), L(`강도: ${pr.intensity}/3`, `Intensity: ${pr.intensity}/3`)];
  for (const e of pr.evidence) out.push(L(`확인된 사실(${e.on}): ${e.text}`, `Confirmed fact (${e.on}): ${e.text}`));
  if (pr.promise) out.push(L(`통치자의 약속: ${pr.promise.text} (기한 ${pr.promise.due})`, `Ruler's promise: ${pr.promise.text} (due ${pr.promise.due})`));
  out.push(L('위 사실 밖의 차별·정책·사건을 사실처럼 말하지 않는다.', 'Do not state discrimination, policies or events beyond the facts above as true.'));
  return out;
}

/** 해산 명령(사용자 확정: 안정도 +5 회복). 행성 k 번째, 시위 ID 표식으로 한 번만. */
export function dispersalCommand(req: number, sid: string, k: number, protestKey: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(k) || k < 1 || !/^[a-z0-9_]{1,40}$/.test(protestKey)) throw new Error('해산 명령 인자가 올바르지 않습니다.');
  const { modifier, days } = PROTEST.dispersal; const mark = `sllm_pd_${protestKey}`;
  const log = (s: string) => `log = "SLLM:PROTESTDISPERSE/;/req=${req}/;/sid=${sid}/;/k=${k}/;/status=${s}"`;
  const loop = `set_variable = { which = sllm_pt_n value = 0 } set_variable = { which = sllm_pt_ok value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_pt_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_pt_n value = ${k} } } } if = { limit = { is_variable_set = ${mark} } prev = { set_variable = { which = sllm_pt_ok value = 2 } } } else = { set_variable = { which = ${mark} value = 1 } remove_modifier = ${modifier} add_modifier = { modifier = ${modifier} days = ${days} } prev = { set_variable = { which = sllm_pt_ok value = 1 } } } } }`;
  const done = `if = { limit = { check_variable = { which = sllm_pt_ok value = 1 } } ${log('applied')} } else_if = { limit = { check_variable = { which = sllm_pt_ok value = 2 } } ${log('duplicate')} } else = { ${log('no_target')} } clear_variable = sllm_pt_n clear_variable = sllm_pt_ok`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${loop} ${done} }`;
}

// ======================================================================================
// 게임 자료 연결(2026-10-23 앱 합침). 모드: tester-mod/common/scripted_effects/sllm_probe_protest.txt — 월간 상황 묶음(STATE_BEGIN..STATE_END) 안의
// SLLM:PROTPLANET(행성마다) · SLLM:RIGHTS(종족마다). 행성 순서(k)는 every_owned_colony 순서라 해산 명령과 같다.
// ======================================================================================
/** e1..e8·총독 파벌 번호 → 성향(모드와 같은 순서). */
export const ETH_CODE: Ethic[] = ['militarist', 'pacifist', 'authoritarian', 'egalitarian', 'xenophile', 'xenophobe', 'materialist', 'spiritualist'];
/** RIGHTS cit 번호 → 시민권 유형 키(집 PC 게임 common/species_rights/citizenship_types 로 확인). */
export const CIT_KEYS = ['', 'citizenship_full', 'citizenship_full_machine', 'citizenship_assimilation', 'citizenship_limited', 'citizenship_slavery', 'citizenship_robot_servitude', 'citizenship_purge', 'citizenship_purge_machine'] as const;
/** 권리 순위(높을수록 나쁨): 완전·동화 0, 제한 1, 노예·로봇예속 2, 숙청 3. 모르면 undefined. */
export function rightsRank(code: number): number | undefined { return code === 1 || code === 2 || code === 3 ? 0 : code === 4 ? 1 : code === 5 || code === 6 ? 2 : code === 7 || code === 8 ? 3 : undefined; }
export interface ProtestScan { n: string; planets: PlanetSnap[]; rights: { species: string; code: number }[] }
const fnum = (v: string | undefined): number | undefined => { if (v === undefined || v.trim() === '') return undefined; const n = Number(v.trim()); return Number.isFinite(n) ? n : undefined; };
/** 월간 상황 묶음 안의 시위 자료 줄을 모은다(STATE_END 에서 돌려줌). 다른 줄은 무시. */
export class ProtestScanCollector {
  private cur: ProtestScan | null = null;
  private seen = 0; // 이번 묶음에서 받은 PROTPLANET 줄 수(이름을 못 읽어 건너뛴 행성도 센다 — 게임의 every_owned_colony 순서 k 와 맞추려고, 2026-10-29 테스터 「행성을 찾지 못함」)
  feed(m: { kind: string; kv: Record<string, string> }): ProtestScan | null {
    const kv = m.kv;
    if (m.kind === 'STATE_BEGIN') { this.cur = { n: kv.n ?? '', planets: [], rights: [] }; this.seen = 0; return null; }
    const c = this.cur; if (!c) return null;
    if (kv.n !== undefined && kv.n !== c.n && m.kind !== 'STATE_END') return null;
    if (m.kind === 'PROTPLANET') {
      const k = ++this.seen;
      const name = String(kv.name ?? '').trim(); if (!name || /[\[\]$]/.test(name)) return null;
      const t = fnum(kv.t), share: Partial<Record<Ethic, number>> = {};
      if (t !== undefined && t > 0) ETH_CODE.forEach((e, i) => { const v = fnum(kv['e' + (i + 1)]); if (v !== undefined && v > 0) share[e] = Math.min(1, v / t); });
      const ho = fnum(kv.ho), am = fnum(kv.am), gl = fnum(kv.gl), ge = fnum(kv.ge);
      const p: PlanetSnap = { k, name, factionShare: share };
      if (kv.pg === '0') (p as PlanetSnap & { stale?: boolean }).stale = true; // 이번 달은 성향별 인구를 안 셈(3달에 한 번) — fillStaleShares 가 지난 값으로 채운다
      else if (t !== undefined) p.pops = t; const st = fnum(kv.st); if (st !== undefined) p.stability = st; const cr = fnum(kv.cr); if (cr !== undefined) p.crime = cr; const un = fnum(kv.un); if (un !== undefined) p.unemployed = un;
      if (ho !== undefined) p.freeHousing = ho / 100; if (am !== undefined) p.freeAmenities = am / 100; // 게임이 100배로 보낸다(planets.ts scale100 과 같음)
      if (gl !== undefined && gl > 0 && Number.isSafeInteger(gl)) { p.governor = `p:${gl}`; (p as PlanetSnap & { govEthic?: Ethic }).govEthic = ge !== undefined && ge >= 1 && ge <= 8 ? ETH_CODE[ge - 1] : undefined; }
      c.planets.push(p);
    } else if (m.kind === 'RIGHTS') {
      const sp = String(kv.sp ?? '').trim(), code = fnum(kv.cit);
      if (sp && !/[\[\]$]/.test(sp) && code !== undefined && Number.isSafeInteger(code) && code >= 0 && code <= 8 && !c.rights.some((r) => r.species === sp)) c.rights.push({ species: sp, code });
    } else if (m.kind === 'STATE_END') { const done = c; this.cur = null; return done; }
    return null;
  }
}
/** 성향별 인구가 빠진 달(pg=0) 채우기(2026-10-24 렉 줄이기). 센 달에는 행성별 값을 장부(b.shares)에 남기고, 안 센 달에는 그 값을 넣는다.
 *  지난 값을 모르는 행성이 하나라도 있으면 false — 그 달은 판정하지 않는다(성향을 지어내지 않는다). 없어진 행성의 값은 지운다. */
export function fillStaleShares(b: ProtestBook, scan: ProtestScan): boolean {
  const keep: NonNullable<ProtestBook['shares']> = {}, old = b.shares ?? {}; let ok = true;
  for (const p of scan.planets) {
    if ((p as PlanetSnap & { stale?: boolean }).stale) {
      const o = old[p.name]; if (!o) { ok = false; continue; }
      p.factionShare = { ...o.share }; if (o.pops !== undefined) p.pops = o.pops; delete (p as PlanetSnap & { stale?: boolean }).stale; keep[p.name] = o;
    } else keep[p.name] = { share: { ...p.factionShare }, ...(p.pops !== undefined ? { pops: p.pops } : {}) };
  }
  b.shares = keep; return ok;
}
const ETH_BITS: [number, Ethic][] = [[1, 'militarist'], [2, 'pacifist'], [4, 'authoritarian'], [8, 'egalitarian'], [16, 'xenophile'], [32, 'xenophobe'], [64, 'materialist'], [128, 'spiritualist']];
const ym = (d: string): number | null => { const m = /^(\d+)\.(\d+)\./.exec(d); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };
/** 앱의 월간 상황 + 시위 자료 → 규칙 입력. 없는 값은 비워 둔다(지어내지 않음). */
export function empireFromState(s: StateSnapshot & { empireEth?: number }, scan: ProtestScan | null, b: ProtestBook): EmpireSnap {
  const eth = s.empireEth, ethics = eth === undefined ? [] : ETH_BITS.filter(([bit]) => (eth & bit) !== 0).map(([, e]) => e);
  const atWar = s.wars.length > 0, own = s.wars.length ? Math.max(...s.wars.map((w) => (w.side === 'att' ? w.ax : w.dx))) : 0;
  const since = atWar ? b.warSince ?? s.date : undefined, a = since ? ym(since) : null, z = ym(s.date);
  const factions: EmpireSnap['factions'] = {};
  for (const f of s.factions) { const e = f.ethic as Ethic; if (!ETH_CODE.includes(e)) continue; const cur = factions[e]; factions[e] = { support: (cur?.support ?? 0) + f.support, approval: cur?.approval === undefined ? f.approval : Math.min(cur.approval, f.approval) }; }
  const governorSupport: Record<Pid, Ethic[]> = {};
  for (const p of scan?.planets ?? []) { const g = (p as PlanetSnap & { govEthic?: Ethic }).govEthic; if (p.governor && g) governorSupport[p.governor] = [g]; }
  const speciesRights = (scan?.rights ?? []).map((r) => ({ species: r.species, citizenship: CIT_KEYS[r.code] || undefined, purge: r.code === 7 || r.code === 8, slavery: r.code === 5 || r.code === 6 }));
  return { gestalt: !!s.gestalt, ethics, date: s.date, atWar, ...(atWar && a !== null && z !== null ? { warMonths: Math.max(0, z - a) } : {}), ...(atWar ? { warExhaustion: own } : {}), speciesRights, factions, governorSupport };
}
export const WAR_OUTCOME_MARGIN = 0.15; // gamestate TUNE.war.outlookMargin 과 같은 값
/** 한 달 처리(앱이 월간 상황마다 부름, LLM 없음): 사건 반응 → 진행 판정 → 새 시위 한 건. 상태는 b 에 남는다. */
export function protestMonth(b: ProtestBook, s: StateSnapshot & { empireEth?: number }, scan: ProtestScan, rng: () => number, idGen: (k: number) => string): { started: Protest | null; tick: ReturnType<typeof tick> | null; events: { id: string; kind: ReactEvent; target?: string }[]; celebrations: number[] } {
  const today = s.date; const none = { started: null, tick: null, events: [], celebrations: [] };
  if (s.gestalt || !today) return none;
  const e = empireFromState(s, scan, b), planets = scan.planets;
  const foe = s.wars.length ? Math.max(...s.wars.map((w) => (w.side === 'att' ? w.dx : w.ax))) : 0;
  // 사건 찾기: 전쟁 시작·종료(피로도 차로 승패 추정), 종족 시민권 변화
  const events: { id: string; kind: ReactEvent; target?: string; label: string }[] = [];
  const was = b.lastWar;
  if (was && !was.atWar && e.atWar) events.push({ id: `${today}:war_declared`, kind: 'war_declared', label: L('전쟁 발발', 'War broke out') });
  if (was && was.atWar && !e.atWar) {
    const d = was.foe - was.own, kind: ReactEvent = d >= WAR_OUTCOME_MARGIN ? 'war_ended_victory' : -d >= WAR_OUTCOME_MARGIN ? 'war_ended_defeat' : 'war_ended_status_quo';
    events.push({ id: `${today}:${kind}`, kind, label: kind === 'war_ended_victory' ? L('승전으로 끝난 전쟁', 'A war ended in victory') : kind === 'war_ended_defeat' ? L('패전으로 끝난 전쟁', 'A war ended in defeat') : L('현상 유지로 끝난 전쟁', 'A war ended in a white peace') });
  }
  const prevRights = b.rights ?? {}, nowRights: Record<string, number> = {};
  for (const r of scan.rights) {
    nowRights[r.species] = r.code; const before = prevRights[r.species]; if (before === undefined) continue;
    const r0 = rightsRank(before), r1 = rightsRank(r.code); if (r0 === undefined || r1 === undefined || r0 === r1) continue;
    events.push({ id: `${today}:rights:${r.species}`, kind: r1 < r0 ? 'rights_improved' : 'rights_reduced', target: r.species, label: r1 < r0 ? L(`${r.species} 권리 확대`, `Rights expanded for ${r.species}`) : L(`${r.species} 권리 축소`, `Rights reduced for ${r.species}`) });
  }
  const celebrations: number[] = [];
  b.pending = (b.pending ?? []).filter((c) => cmpDate(today, c.until) <= 0);
  for (const ev of events) {
    const r = reactToEvent(b, e, { id: ev.id, kind: ev.kind, on: today, label: ev.label, ...(ev.target ? { target: ev.target } : {}) }, planets);
    celebrations.push(...r.celebrations);
    for (const g of r.grievances) b.pending.push({ ...g, until: addMonths(today, 12), eventId: ev.id });
  }
  b.base ??= {};
  const t = tick(b, e, planets, b.base, today);
  for (const id of Object.keys(b.base)) if (!b.protests[id] || !openProtests(b).some((x) => x.id === id)) delete b.base[id];
  const started = monthlyRoll(b, e, planets, today, rng, idGen, b.pending);
  if (started) {
    const p = planets.find((x) => x.k === started.planetK);
    if (p) { b.base[started.id] = { e, p }; const st = governorStance(e, started, p.governor); if (p.governor && st) { started.governor = p.governor; started.governorStance = st; } }
    const used = b.pending.findIndex((c) => c.planetK === started.planetK && c.demand.kind === started.demand.kind); if (used >= 0) { started.sourceEventId = b.pending[used].eventId; b.pending.splice(used, 1); }
  }
  b.warSince = e.atWar ? b.warSince ?? today : undefined; if (!e.atWar) delete b.warSince;
  b.lastWar = { atWar: e.atWar === true, own: e.warExhaustion ?? 0, foe }; b.rights = nowRights;
  return { started, tick: t, events: events.map(({ id, kind, target }) => ({ id, kind, ...(target ? { target } : {}) })), celebrations };
}
/** 대표단 대화(유일한 LLM 사용): 근거·요구·약속·이전 대화만. 영어 지시문(응답 언어는 AI 호출 쪽이 붙인다). */
export function delegateMessages(pr: Protest, a: { empire: string; ruler: string; date: string }, userText: string): ChatMessage[] {
  const facts = pr.evidence.map((e) => `- (${e.on}) ${e.text}`).join('\n');
  const stance = pr.governorStance === 'advocate' ? 'The planetary governor has publicly sided with the protesters.' : pr.governorStance === 'hardline' ? 'The planetary governor is calling for a crackdown.' : pr.governorStance === 'mediate' ? 'The planetary governor is trying to mediate.' : '';
  const sys = [
    `You are ${pr.delegate.name || 'the spokesperson'}, the elected spokesperson of a protest on the planet "${pr.planetName}" in the Stellaris empire "${a.empire || 'our empire'}". You are meeting the ruler ${a.ruler || '(Your Excellency)'} face to face. Date: ${a.date || 'unknown'}.`,
    `The protesters' values: ${pr.ethic === 'any' ? 'a mix of ordinary citizens' : pr.ethic}. Their one core demand: ${DEMAND_LABEL[pr.demand.kind]()}${pr.demand.target ? ` (${pr.demand.target})` : ''}. Intensity ${pr.intensity}/3.`,
    `[Confirmed facts — the only facts you may state as true]\n${facts || '- (none)'}`,
    pr.promise ? `The ruler already promised: "${pr.promise.text}" (deadline ${pr.promise.due}). Remember it and hold the ruler to it.` : '',
    stance,
    'Speak as a real citizen leader: firm but not violent, concrete about daily life, 2-5 sentences. You may negotiate and accept reasonable promises. Do not invent discrimination, policies, numbers or events beyond the facts above. Do not claim that anything was already done in the game. Never write the ruler\'s lines.',
  ].filter(Boolean).join('\n');
  const hist: ChatMessage[] = (pr.talk ?? []).slice(-10).map((x) => ({ role: x.who === 'ruler' ? 'user' : 'assistant', content: x.text }) as ChatMessage);
  return [{ role: 'system', content: sys }, ...hist, { role: 'user', content: String(userText ?? '').slice(0, 800) }];
}
/** 대화 기록 더하기(최근 30개만). */
export function addTalk(pr: Protest, who: 'ruler' | 'delegate', text: string, on: string): void { (pr.talk ??= []).push({ who, text: String(text ?? '').slice(0, 1200), on }); if (pr.talk.length > 30) pr.talk = pr.talk.slice(-30); }
/** 저장 파일 읽기 정리(망가진 값은 버리고 빈 장부로). */
export function sanitizeProtestBook(x: unknown, sid: string): ProtestBook {
  const b = x as ProtestBook; if (!b || typeof b !== 'object' || b.sid !== sid || typeof b.protests !== 'object' || !b.protests) return emptyProtestBook(sid);
  return { ...emptyProtestBook(sid), ...b, celebrations: Array.isArray(b.celebrations) ? b.celebrations.slice(-60) : [] };
}
