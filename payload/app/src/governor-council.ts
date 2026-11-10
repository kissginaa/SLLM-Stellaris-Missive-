// 행성총독회의(13)·정치적 지위(14·15·16·17)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 격년 11월 정기 개최 / 전쟁 중이면 불이익 없이 건너뜀 / 평시 불참은 안정도 디버프 / 별도 긴급 소집 / 체제에 따라 총독 영향력·발언 태도 차이.
// 게임 자료 근거:
//  - 전쟁 상태: 국가 트리거 is_at_war = yes (policy.ts 가 이미 sllm_pm_war 로 읽는다). 11월 마감 시점의 실제 값으로 판정.
//  - 체제: has_authority = auth_democratic / auth_oligarchic / auth_dictatorial / auth_imperial / auth_corporate / auth_hive_mind / auth_machine_intelligence
//    (secretary·terminal probe 가 이미 has_authority 를 쓴다). 모드 STATE 묶음에 auth 한 글자를 더 보내면 된다(mod/ 초안).
//  - 총독: 행성 scope 에서 exists = leader 로 담당 총독을 읽어 SLLM:GOV 로 보내고 있다(sllm_probe_planets.txt). 같은 사람이 여러 행성을 맡으면 같은 이름·같은 lid.
//  - 안정도 디버프: 국가 scope 정적 수정자에 planet_stability_add (정책 불이익이 이미 같은 방식) → 모든 행성. 범위·수치·기간은 미정이라 모드 파일 값.
import { cmpDate } from './gamedate';
import { L } from './i18n-pick';
import { loyaltyLine, promisesLine } from './gov-pledges';

export type Authority = 'auth_democratic' | 'auth_oligarchic' | 'auth_dictatorial' | 'auth_imperial' | 'auth_corporate' | 'auth_hive_mind' | 'auth_machine_intelligence' | string;
export type Regime = 'democratic' | 'oligarchic' | 'autocratic' | 'neutral';
/** 체제 → 회의 발언 환경(13). 기업·군체·기계·모드 체제는 억지로 넣지 않고 neutral. */
export function regimeOf(auth: Authority | undefined): Regime {
  switch (auth) {
    case 'auth_democratic': return 'democratic';
    case 'auth_oligarchic': return 'oligarchic';
    case 'auth_dictatorial': case 'auth_imperial': return 'autocratic';
    default: return 'neutral';
  }
}
/** 체제별 발언 환경(13 표): 영향력 가중·공개 반론 허용·건의 방식. 계수는 초기 제안값. */
export const REGIME_PROFILE: Record<Regime, { influence: number; openRebuttal: boolean; style: { ko: string; en: string } }> = {
  democratic: { influence: 1.0, openRebuttal: true, style: { ko: '주민의 요구와 대표성을 내세워 공개 반론·형평성 추궁이 활발함', en: 'Cites residents and representation; open rebuttals and fairness challenges are common' } },
  oligarchic: { influence: 0.8, openRebuttal: true, style: { ko: '산업·연구·인적 기반 등 이해집단과 실적을 내세운 거래·연합·협상', en: 'Trades, coalitions and bargaining backed by industrial, research and personnel blocs' } },
  autocratic: { influence: 0.5, openRebuttal: false, style: { ko: '공개 반박은 줄고 통치자의 판단을 존중하는 형식의 건의; 불만은 완곡한 경고·비공개 보고', en: 'Fewer open rebuttals; deferential petitions, concerns voiced as cautious warnings or private reports' } },
  neutral: { influence: 0.7, openRebuttal: true, style: { ko: '체제 특성을 단정하지 않는 중립적 회의 환경', en: 'Neutral council setting without assuming a regime type' } },
};

/** 정기 회차(13): 기준 연도 anchorYear 에서 2년마다 11월. 기준은 캠페인당 한 번 저장하고 옮기지 않는다. */
export interface CouncilSchedule { sid: string; anchorYear: number; rounds: Record<string, CouncilRound> }
export type RoundState = 'due' | 'in_progress' | 'fulfilled' | 'skipped_wartime' | 'missed_peacetime' | 'pending_review';
export interface CouncilRound { year: number; state: RoundState; openedOn?: string; closedOn?: string; penaltyReq?: number; penalty?: 'pending' | 'applied' | 'unknown' }
export const scheduleKey = (sid: string, year: number): string => `gc:${sid}:${year}`;
export function isCouncilYear(s: CouncilSchedule, year: number): boolean { return year >= s.anchorYear && (year - s.anchorYear) % 2 === 0; }
/** 11월에 들어서면 그 회차를 due 로 만든다(앱이 11월 1일에 켜져 있지 않아도 11월 중 아무 때나 복구). */
export function councilDue(s: CouncilSchedule, today: string): CouncilRound | null {
  const m = /^(\d+)\.(\d+)\./.exec(today); if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]); if (mo !== 11 || !isCouncilYear(s, y)) return null;
  const k = String(y); if (!s.rounds[k]) s.rounds[k] = { year: y, state: 'due' };
  return s.rounds[k];
}
/** 11월이 지났는데 due 로 남은 회차 마감(13): 마감 시점 실제 전쟁 상태로 판정. 당시 전쟁 상태를 모르면 pending_review(벌주지 않는다). */
export function closeOverdue(s: CouncilSchedule, today: string, atWarAtDeadline: boolean | null): CouncilRound[] {
  const m = /^(\d+)\.(\d+)\./.exec(today); if (!m) return [];
  const y = Number(m[1]), mo = Number(m[2]); const out: CouncilRound[] = [];
  for (const r of Object.values(s.rounds)) {
    if (r.state !== 'due' && r.state !== 'in_progress') continue;
    if (r.year > y || (r.year === y && mo <= 11)) continue;
    if (r.state === 'in_progress') { r.state = 'pending_review'; out.push(r); continue; } // 시스템 장애와 고의 불참을 구분(13)
    r.state = atWarAtDeadline === null ? 'pending_review' : atWarAtDeadline ? 'skipped_wartime' : 'missed_peacetime';
    r.closedOn = today; out.push(r);
  }
  return out;
}
/** 플레이어가 11월 중 직접 건너뛰기(13): 전쟁 중이면 면제, 평시면 예상 불이익을 안내한 뒤 확정. */
export function skipRound(r: CouncilRound, today: string, atWar: boolean): { state: RoundState; warn?: string } {
  if (r.state !== 'due') return { state: r.state };
  r.state = atWar ? 'skipped_wartime' : 'missed_peacetime'; r.closedOn = today;
  return { state: r.state, ...(atWar ? {} : { warn: L('평시에 정기 총독회의를 건너뛰면 안정도가 내려갑니다.', 'Skipping the regular governors\' council in peacetime lowers stability.') }) };
}
export function fulfillRound(r: CouncilRound, today: string): boolean { if (r.state !== 'due' && r.state !== 'in_progress') return false; r.state = 'fulfilled'; r.closedOn = today; return true; }
/** 평시 불참 디버프 명령(13): 국가 scope 수정자(모든 행성 안정도). 회차당 한 번. 수치·기간은 모드 파일(sllm_political_modifiers.txt). */
export function councilPenaltyCommand(req: number, sid: string, year: number, modifier = 'sllm_council_absent', days = 360): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(year)) throw new Error('총독회의 불이익 인자가 올바르지 않습니다.');
  const mark = `sllm_gc_pen_${year}`, log = (s: string) => `log = "SLLM:COUNCILPEN/;/req=${req}/;/sid=${sid}/;/year=${year}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} has_modifier = ${modifier} } ${log('duplicate')} } else = { remove_modifier = ${modifier} add_modifier = { modifier = ${modifier} days = ${days} } if = { limit = { has_modifier = ${modifier} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } else = { ${log('missing')} } } }`; // 2026-10-24 실플레이: 낡은 모드엔 수정자가 없어 붙지 않았는데도 applied 로 기록됨 → 실제로 붙었는지 확인(missing = 모드가 낡음, 표시 안 남겨 다음에 다시)
}

/** 총독 요구(13): raised → discussed → promised / declined / deferred → observed_fulfilled / withdrawn / superseded. */
export type RequestState = 'raised' | 'discussed' | 'promised' | 'declined' | 'deferred' | 'observed_fulfilled' | 'broken' | 'withdrawn' | 'superseded'; // broken: 약속 불이행(알파 11 총독 약속 문서)
export interface GovernorRequest { id: string; sid: string; planet: string; requester: string; field: string; evidence: string[]; state: RequestState; raisedOn: string; promisedOn?: string; due?: string; fulfilledOn?: string; brokenOn?: string; docId?: string; decidedBy?: string; exclusiveWith?: string[] }
const NEXT: Record<RequestState, RequestState[]> = { raised: ['discussed', 'withdrawn', 'superseded'], discussed: ['promised', 'declined', 'deferred', 'withdrawn', 'superseded'], promised: ['observed_fulfilled', 'broken', 'withdrawn', 'superseded'], declined: [], deferred: ['discussed', 'withdrawn', 'superseded'], observed_fulfilled: [], broken: [], withdrawn: [], superseded: [] };
export function moveRequest(r: GovernorRequest, to: RequestState, today: string): boolean {
  if (!NEXT[r.state].includes(to)) return false;
  r.state = to; if (to === 'promised') r.promisedOn = today; if (to === 'observed_fulfilled') r.fulfilledOn = today; if (to === 'broken') r.brokenOn = today; return true;
}
/** 약속 위반 판정(16): 기한이 「정해진」 약속만, 기한이 지났고 이행 관측이 없을 때. 기한 없는 약속은 자동 위약 아님. */
export function promiseBroken(r: GovernorRequest, today: string): boolean { return r.state === 'promised' && !!r.due && cmpDate(today, r.due) > 0; }

// ---- 2026-10-23 집 PC 초안: 행성 자료 → 참가 총독·요구·발언 프롬프트·이행 관측 ----
/** 체제 번호(모드 COUNCILAG auth=) → 게임 체제 키. 0·모름은 undefined(→ neutral). */
export const AUTH_CODE: Record<number, Authority> = { 1: 'auth_democratic', 2: 'auth_oligarchic', 3: 'auth_dictatorial', 4: 'auth_imperial', 5: 'auth_corporate' };
/** 회의에 쓰는 행성 자료(앱 planets.ts Planet 의 필요한 부분). 값이 없으면 null — 0 으로 보지 않는다(13). */
export interface GcPlanet { /** 단일 의식 제국의 이탈(게임 planet_crime, 알파 11). 일반 제국·모름이면 없음 */ deviancy?: number; name: string; governor: string | null; pops: number | null; stability: number | null; amenities: number | null; housing: number | null; capital: boolean; type: string }
export interface GcGovernor { name: string; lid?: number; planets: string[] }
/** 총독 묶기(13): 같은 사람이 여러 행성을 맡으면 한 사람(담당 행성 목록). 총독 없는 행성은 「미배정」으로 따로. */
export function governorsFrom(planets: GcPlanet[], people: { lid: number; name: string; gone?: string }[]): { governors: GcGovernor[]; unassigned: string[] } {
  const by = new Map<string, GcGovernor>(), unassigned: string[] = [];
  for (const p of planets) {
    const g = (p.governor ?? '').trim(); if (!g) { unassigned.push(p.name); continue; }
    let e = by.get(g); if (!e) { const per = people.find((x) => x.name === g && !x.gone); e = { name: g, ...(per ? { lid: per.lid } : {}), planets: [] }; by.set(g, e); }
    e.planets.push(p.name);
  }
  return { governors: [...by.values()], unassigned };
}
/** 회의 자리(사용자 확정 2026-10-23): 행성은 200개 넘게도 늘지만 회의실 자리는 8개. 총독마다 참석을 신청할 확률은 맡은 행성 중 가장 낮은 안정도로 정한다
 *  (안정도가 낮을수록 높게 — 20 이하 95%, 90 이상 15%, 그 사이는 직선, 안정도를 모르면 50으로 본다). 신청한 총독 가운데 필요성이 큰(안정도가 낮은) 8명만 승인된다.
 *  아무도 신청하지 않으면 가장 급한 한 명을 부른다(회의가 비지 않게). */
export const GC_SEATS = 8;
export function attendChance(stab: number | null): number { const s = stab === null || !Number.isFinite(stab) ? 50 : stab; return Math.max(0.15, Math.min(0.95, 0.95 - (s - 20) * (0.8 / 70))); }
export function selectAttendees(govs: GcGovernor[], planets: GcPlanet[], rng: () => number, seats: number = GC_SEATS): { approved: GcGovernor[]; applied: number } {
  const need = (g: GcGovernor) => { const st = planets.filter((p) => g.planets.includes(p.name)).map((p) => (p.stability === null ? 50 : p.stability)); return st.length ? Math.min(...st) : 50; };
  const ranked = govs.map((g) => ({ g, s: need(g) })).sort((a, b) => a.s - b.s || a.g.name.localeCompare(b.g.name));
  const applied = ranked.filter((x) => rng() < attendChance(x.s));
  const approved = (applied.length ? applied : ranked.slice(0, 1)).slice(0, seats).map((x) => x.g);
  return { approved, applied: applied.length };
}
export type GcField = 'housing' | 'amenities' | 'order' | 'development';
export const GC_FIELD: Record<GcField, { ko: string; en: string }> = {
  housing: { ko: '주거 확충', en: 'More housing' }, amenities: { ko: '편의시설 확충', en: 'More amenities' },
  order: { ko: '치안·안정 지원', en: 'Order and stability support' }, development: { ko: '개발 투자', en: 'Development investment' },
};
/** 행성 한 곳의 현안(근거와 함께). 확인된 값만 쓴다. 문제가 없으면 개발 투자(이행 관측 없음 — 플레이어가 판단). */
export function planetIssue(p: GcPlanet): { field: GcField; evidence: string; severity: number } {
  if (p.housing !== null && p.housing < 0) return { field: 'housing', evidence: `housing deficit ${p.housing}`, severity: 3 + Math.min(3, -p.housing / 5) };
  if (p.amenities !== null && p.amenities < 0) return { field: 'amenities', evidence: `amenities deficit ${p.amenities}`, severity: 2.5 + Math.min(3, -p.amenities / 10) };
  if (p.deviancy !== undefined && p.deviancy >= 30) return { field: 'order', evidence: `deviancy ${Math.round(p.deviancy)}`, severity: 2.5 + Math.min(3, (p.deviancy - 30) / 10) }; // 이탈 노드(알파 11, 기준 30 사용자 확정)
  if (p.stability !== null && p.stability < 40) return { field: 'order', evidence: `stability ${p.stability}`, severity: 2 + (40 - p.stability) / 10 };
  return { field: 'development', evidence: p.pops !== null ? `${p.pops} pops, no shortage recorded` : 'no shortage recorded', severity: 1 };
}
/** 총독마다 요구 하나(맡은 행성 중 가장 급한 곳). 같은 행성·분야의 열린 요구가 있으면 새로 만들지 않는다. */
export function deriveRequests(sid: string, govs: GcGovernor[], planets: GcPlanet[], open: GovernorRequest[], today: string): GovernorRequest[] {
  const out: GovernorRequest[] = [];
  for (const g of govs) {
    const mine = planets.filter((p) => g.planets.includes(p.name)).map((p) => ({ p, i: planetIssue(p) })).sort((a, b) => b.i.severity - a.i.severity)[0]; if (!mine) continue;
    if (open.some((r) => r.planet === mine.p.name && r.field === mine.i.field && !['declined', 'observed_fulfilled', 'withdrawn', 'superseded'].includes(r.state))) continue;
    out.push({ id: `gr:${sid}:${today}:${mine.p.name}:${mine.i.field}`, sid, planet: mine.p.name, requester: g.lid ? `p:${g.lid}` : `gov:${g.name}`, field: mine.i.field, evidence: [`${today}: ${mine.i.evidence}`], state: 'raised', raisedOn: today });
  }
  return out;
}
/** 약속한 요구가 게임 자료로 이루어졌는지(13: 「관측상 충족」 — 플레이어 덕분이라고 단정하지 않는다). 개발 투자는 관측 기준이 없어 자동 판정하지 않는다. */
export function requestObserved(r: GovernorRequest, p: GcPlanet | undefined): boolean {
  if (r.state !== 'promised' || !p) return false;
  if (r.field === 'housing') return p.housing !== null && p.housing >= 0;
  if (r.field === 'amenities') return p.amenities !== null && p.amenities >= 0;
  if (r.field === 'order') return p.stability !== null && p.stability >= 50 && (p.deviancy === undefined || p.deviancy < 30); // 단일 의식: 이탈도 30 미만이어야
  return false;
}
/** 회의 발언 프롬프트(영어 지시, 응답 언어는 aiclient). 총독은 자기 행성 자료 + 회의 공유 비교표만 안다. */
export type GcMode = 'named' | 'primary' | 'rebuttal' | 'roll_call';
export function councilMessages(a: { empire: string; ruler: string; date: string; regime: Regime; topic: string; kind: 'regular' | 'emergency' }, sp: { name: string; planets: GcPlanet[]; traits: string[]; persona?: string; trust?: number; loyal?: number; pledges?: { field: string; planet: string; state: string }[] }, shared: GcPlanet[], reqs: { planet: string; field: GcField; state: RequestState; by: string }[], recent: string[], mode: GcMode, userText: string): { role: 'system' | 'user'; content: string }[] {
  const prof = REGIME_PROFILE[a.regime];
  const row = (p: GcPlanet) => `${p.name}${p.capital ? ' (capital)' : ''}: ${p.type || 'planet'}; pops ${p.pops ?? 'unknown'}; stability ${p.stability ?? 'unknown'}; housing ${p.housing ?? 'unknown'}; amenities ${p.amenities ?? 'unknown'}`;
  const modeLine = mode === 'rebuttal' ? (prof.openRebuttal ? 'Another governor just made a claim. Push back from your own planets\' interest or the empire\'s fairness, citing only the shared table — or concede if they are right.' : 'Another governor just spoke. Under this regime you avoid open confrontation: voice any disagreement as a cautious, respectful note to the ruler.')
    : mode === 'roll_call' ? 'The ruler asked every governor for their position. State yours in 2-3 sentences.'
    : mode === 'named' ? 'The ruler addressed you directly. Answer the ruler.' : 'The ruler spoke to the whole council; you answer first because it concerns your planets most.';
  const sys = [
    `You are ${sp.name}, governor of ${sp.planets.map((p) => p.name).join(', ')} in the Stellaris empire "${a.empire || 'our empire'}", attending a ${a.kind === 'regular' ? 'regular biennial' : 'emergency'} governors' council by hologram. Date: ${a.date || 'unknown'}.`,
    `Council climate under this government: ${prof.style.en}.`,
    a.topic ? `Agenda set by the ruler (the ruler's own words): "${a.topic}".` : '',
    `[Your planets]\n${sp.planets.map(row).join('\n')}`,
    `[Shared comparison table — everyone at the council sees this]\n${shared.map(row).join('\n')}`,
    reqs.length ? `[Requests on the table]\n${reqs.map((r) => `- ${r.by} for ${r.planet}: ${GC_FIELD[r.field].en} (${r.state})`).join('\n')}` : '',
    sp.traits.length ? `Your traits: ${sp.traits.slice(0, 4).join(', ')}.` : '', sp.persona ? `Your manner: ${sp.persona}` : '', sp.trust !== undefined ? `Your trust in the ruler: ${sp.trust} (−100..100).` : '', loyaltyLine(sp.loyal), promisesLine(sp.pledges ?? []), // 충성·약속 이력(알파 11 총독 약속 문서)
    recent.length ? `[Recent discussion]\n${recent.slice(-8).join('\n')}` : '',
    modeLine,
    // 2026-10-24 사용자 확정: 행성 수치는 통치자가 물어볼 때만 — 안부·잡담에는 짧게 사람답게 답한다(TMI 금지).
    mode === 'rebuttal' || mode === 'roll_call'
      ? 'Use the planet data above only where it supports your point.'
      : 'Answer exactly what the ruler said. If it is a greeting or small talk (e.g. "How are you?"), reply briefly and in character in 1-2 sentences, with NO planet figures, statistics or requests. Bring up planet data or requests only when the ruler asks about your planets, the agenda, problems, needs or requests.',
    'Unknown values stay unknown — never treat them as zero, and never claim a facility exists unless the data shows it. Do not invent riots, deficits or past aid. Promises made here are not yet carried out in the game. At most 4 sentences. Never write lines for the ruler or other governors.',
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: String(userText ?? '').slice(0, 800) || '(The ruler waits for your view.)' }];
}
