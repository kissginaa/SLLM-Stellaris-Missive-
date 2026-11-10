// 예산 회의(2026-11-04 사용자 결정): 통치자가 직접 소집(쿨타임·효과 기간은 내각 회의 의제와 같은 1년 = 360일), 장관마다 자기 분야 예산 1건을 요청한다.
// 통치자는 전액(효과·비용 100%)·삭감(50%)·거절. 분야마다 예산은 하나만 집행 중. 비용은 게임 스크립트가 매달 에너지 창고에서 빼고, 모자라면 그 예산을 멈춘다(sllm_budget.txt).
// 장관마다 상시 지시 한 줄(예: "함선 기술 위주로")을 둘 수 있고, 소집 때 LLM 1번이 지시·상황·말투를 보고 항목을 고르고 요청 발언을 쓴다(못 읽으면 틀 문장으로).
// 순수 로직. 앱: features/budget-app.ts, 화면: ui/office-budget.js, 모드: static_modifiers/sllm_budget_modifiers.txt(항목 이름이 여기 BUD_ITEMS 와 같아야 한다).
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';
import type { Domain } from './cabinet-meeting';
import { wrapForPlayer, type SllmMessage } from './protocol';

export const BUD = { days: 360, coolMonths: 12, pctFull: 0.06, pctHalf: 0.03, minCost: 5, maxCost: 3000, keep: 30 } as const;
export const DOMAIN_CODE: Record<Domain, number> = { defense: 1, research: 2, state: 3, economy: 4, interior: 5 };
export const CODE_DOMAIN: Record<number, Domain> = { 1: 'defense', 2: 'research', 3: 'state', 4: 'economy', 5: 'interior' };
/** pct: 수치가 비율(%)인가. full·half = 수정자 값(모드와 같게). */
export interface BudItem { id: string; domain: Domain; full: number; half: number; ko: string; en: string; pct: boolean }
export const BUD_ITEMS: BudItem[] = [
  { id: 'res_voidcraft', domain: 'research', full: 0.15, half: 0.08, ko: '함선 설계 연구', en: 'Voidcraft research', pct: true },
  { id: 'res_propulsion', domain: 'research', full: 0.15, half: 0.08, ko: '추진 연구', en: 'Propulsion research', pct: true },
  { id: 'res_particles', domain: 'research', full: 0.15, half: 0.08, ko: '입자 연구', en: 'Particles research', pct: true },
  { id: 'res_computing', domain: 'research', full: 0.15, half: 0.08, ko: '컴퓨팅 연구', en: 'Computing research', pct: true },
  { id: 'res_field', domain: 'research', full: 0.15, half: 0.08, ko: '장 조작 연구', en: 'Field manipulation research', pct: true },
  { id: 'res_materials', domain: 'research', full: 0.15, half: 0.08, ko: '재료 연구', en: 'Materials research', pct: true },
  { id: 'res_industry', domain: 'research', full: 0.15, half: 0.08, ko: '산업 연구', en: 'Industry research', pct: true },
  { id: 'res_military', domain: 'research', full: 0.15, half: 0.08, ko: '군사 이론 연구', en: 'Military theory research', pct: true },
  { id: 'res_biology', domain: 'research', full: 0.15, half: 0.08, ko: '생물학 연구', en: 'Biology research', pct: true },
  { id: 'res_newworlds', domain: 'research', full: 0.15, half: 0.08, ko: '신세계 연구', en: 'New worlds research', pct: true },
  { id: 'res_statecraft', domain: 'research', full: 0.15, half: 0.08, ko: '통치술 연구', en: 'Statecraft research', pct: true },
  { id: 'res_psionics', domain: 'research', full: 0.15, half: 0.08, ko: '사이오닉스 연구', en: 'Psionics research', pct: true },
  { id: 'res_archaeo', domain: 'research', full: 0.15, half: 0.08, ko: '고고학 연구', en: 'Archaeostudies research', pct: true },
  { id: 'def_weapons', domain: 'defense', full: 0.1, half: 0.05, ko: '함선 무기 피해', en: 'Ship weapon damage', pct: true },
  { id: 'def_navalcap', domain: 'defense', full: 20, half: 10, ko: '함대 한도', en: 'Naval capacity', pct: false },
  { id: 'def_upkeep', domain: 'defense', full: -0.15, half: -0.08, ko: '함선 유지비', en: 'Ship upkeep', pct: true },
  { id: 'sta_weight', domain: 'state', full: 0.15, half: 0.08, ko: '외교 비중', en: 'Diplomatic weight', pct: true },
  { id: 'sta_decrypt', domain: 'state', full: 2, half: 1, ko: '암호 해독', en: 'Decryption', pct: false },
  { id: 'sta_influence', domain: 'state', full: 0.1, half: 0.05, ko: '영향력 생산', en: 'Influence output', pct: true },
  { id: 'eco_build', domain: 'economy', full: 0.2, half: 0.1, ko: '건물 건설 속도', en: 'Building speed', pct: true },
  { id: 'eco_upkeep', domain: 'economy', full: -0.1, half: -0.05, ko: '행성 유지비', en: 'Planet upkeep', pct: true },
  { id: 'eco_minerals', domain: 'economy', full: 0.1, half: 0.05, ko: '광물 일자리 생산', en: 'Mineral job output', pct: true },
  { id: 'int_stability', domain: 'interior', full: 4, half: 2, ko: '행성 안정도', en: 'Planet stability', pct: false },
  { id: 'int_crime', domain: 'interior', full: -10, half: -5, ko: '범죄', en: 'Crime', pct: false },
  { id: 'int_amenities', domain: 'interior', full: 4, half: 2, ko: '편의시설', en: 'Amenities', pct: false },
];
export const itemById = (id: string) => BUD_ITEMS.find((x) => x.id === id);
export type BudTier = 'f' | 'h';
export const budModifier = (id: string, tier: BudTier) => `sllm_bud_${id}_${tier}`;
const fmtVal = (it: BudItem, v: number) => (v > 0 ? '+' : '−') + (it.pct ? `${Math.round(Math.abs(v) * 100)}%` : `${Math.abs(v)}`);
/** 화면 문구: "함선 설계 연구 속도 +15%" */
export function itemLabel(it: BudItem, tier: BudTier): string {
  const v = tier === 'f' ? it.full : it.half, sp = it.domain === 'research';
  return L(`${it.ko}${sp ? ' 속도' : ''} ${fmtVal(it, v)}`, `${it.en}${sp ? ' speed' : ''} ${fmtVal(it, v)}`);
}
/** 월 비용(에너지): 월 수입의 6%(삭감 3%), 최소 5. 수입이 0 이하면 최소값. */
export function monthlyCost(income: number, tier: BudTier): number {
  const p = tier === 'f' ? BUD.pctFull : BUD.pctHalf;
  return Math.max(BUD.minCost, Math.min(BUD.maxCost, Math.round(Math.max(0, income) * p)));
}
export function ctxCommand(req: number): string { if (!Number.isSafeInteger(req) || req < 1) throw new Error('req'); return wrapForPlayer(`sllm_bud_ctx = { REQ = ${req} }`); }
export function applyCommand(req: number, sid: string, id: string, tier: BudTier, cost: number): string {
  const it = itemById(id); if (!it || !Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || (tier !== 'f' && tier !== 'h')) throw new Error(L('잘못된 예산 요청입니다.', 'Invalid budget request.'));
  const c = Math.max(BUD.minCost, Math.min(BUD.maxCost, Math.round(cost)));
  return wrapForPlayer(`if = { limit = { check_variable = { which = sllm_save_id value = ${sid} } } sllm_bud_apply = { REQ = ${req} D = ${DOMAIN_CODE[it.domain]} MOD = ${budModifier(id, tier)} COST = ${c} } }`);
}
export function cancelCommand(req: number, sid: string, domain: Domain): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error('req');
  return wrapForPlayer(`if = { limit = { check_variable = { which = sllm_save_id value = ${sid} } } sllm_bud_cancel = { REQ = ${req} D = ${DOMAIN_CODE[domain]} } }`);
}
/** 게임 변수 글자(1234.5, 12.3K) → 수 */
export const gnum = (v: string | undefined) => { const m = String(v ?? '').trim().replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([KkMm])?$/); return m ? Number(m[1]) * (m[2] ? (/[Kk]/.test(m[2]) ? 1e3 : 1e6) : 1) : 0; };
/** 함대 한도(2026-11-05): nc 최대·nu 쓴 것. 옛 모드면 naval 없음. */
export function parseCtx(m: SllmMessage): { inc: number; stock: number; war: boolean; naval?: { used: number; max: number } } {
  const nc = Math.round(gnum(m.kv.nc)), nu = Math.round(gnum(m.kv.nu));
  return { inc: Math.round(gnum(m.kv.inc)), stock: Math.round(gnum(m.kv.stock)), war: Math.round(gnum(m.kv.war)) === 1, ...(m.kv.nc !== undefined && nc > 0 ? { naval: { used: Math.max(0, nu), max: nc } } : {}) };
}
/** 함대 한도를 90% 넘게 쓰고 있나. */
export const navalTight = (n?: { used: number; max: number }): boolean => !!n && n.max > 0 && n.used / n.max >= 0.9;

// ── 소집: 장관마다 요청 1건 ──
export interface BudMember { lid: number; name: string; domain: Domain; title: [string, string]; persona?: string; trust?: number; directive?: string }
export interface BudRequest { lid: number; name: string; domain: Domain; item: string; say: string; cost: number; half: number; choice?: 'full' | 'half' | 'no' }
/** 지시·상황이 없을 때 고르는 기본 항목(전쟁 중이면 군사 쪽, 아니면 분야 첫 항목). 같은 분야 장관이 둘이면 겹치지 않게. */
export function defaultItem(domain: Domain, war: boolean, taken: Set<string>, tight = false): string {
  const pref: Record<Domain, string[]> = {
    research: war ? ['res_voidcraft', 'res_military', 'res_particles', 'res_materials'] : ['res_computing', 'res_industry', 'res_biology', 'res_newworlds', 'res_voidcraft'],
    defense: tight ? ['def_navalcap', 'def_weapons', 'def_upkeep'] : war ? ['def_weapons', 'def_navalcap', 'def_upkeep'] : ['def_upkeep', 'def_navalcap', 'def_weapons'],
    state: ['sta_weight', 'sta_influence', 'sta_decrypt'], economy: ['eco_build', 'eco_minerals', 'eco_upkeep'], interior: ['int_stability', 'int_amenities', 'int_crime'],
  };
  return pref[domain].find((x) => !taken.has(x)) ?? pref[domain][0];
}
export function budMessages(a: { empire: string; date: string; war: boolean; income: number; members: BudMember[]; active: string[]; naval?: { used: number; max: number } }): ChatMessage[] {
  const list = (d: Domain) => BUD_ITEMS.filter((x) => x.domain === d).map((x) => `${x.id} (${x.en})`).join(', ');
  return [
    { role: 'system', content: [
      `Stellaris. Budget meeting of ${a.empire} (date ${a.date}). Each minister asks the ruler for ONE budget line from their own portfolio, to be paid every month in energy credits for a year.`,
      'For each minister pick exactly one item id from that minister\'s list. Follow the ruler\'s standing directive for that minister when there is one; otherwise pick what the situation calls for (war, economy). Ministers in the same portfolio should not ask for the same item.',
      'say: the minister\'s pitch to the ruler, 2-3 sentences, in their own voice, concrete about why this item now. Do not state game numbers or costs.',
      'Reply ONLY with JSON: {"requests":[{"lid":number,"item":"id","say":"..."}]}  One request for every listed minister.',
    ].join('\n') },
    { role: 'user', content: [
      a.war ? 'We are at war.' : 'We are at peace.', `Monthly energy income: about ${Math.round(a.income)}.`,
      ...(a.naval ? [`Naval capacity: ${a.naval.used} of ${a.naval.max} used${navalTight(a.naval) ? ' (nearly full: the fleet cannot grow without more capacity)' : ''}.`] : []),
      a.active.length ? `Budgets still running: ${a.active.join('; ')}.` : 'No budget is running.',
      'Ministers:', ...a.members.map((m) => `- lid ${m.lid}: ${m.name}, ${m.title[1]} (portfolio ${m.domain})${m.persona ? '; voice: ' + m.persona : ''}${m.directive ? '; ruler\'s standing directive: ' + m.directive : ''}. Items: ${list(m.domain)}`),
    ].join('\n') },
  ];
}
const jsonPart = (raw: string): Record<string, unknown> | null => { const t = String(raw ?? ''); const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null; try { const v = JSON.parse(t.slice(i, j + 1)); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; } };
/** LLM 답 → 요청(못 읽은 장관은 기본 항목·틀 문장). 비용은 앱이 매긴다. */
export function buildRequests(raw: string | null, members: BudMember[], war: boolean, income: number, tight = false): BudRequest[] {
  const v = raw ? jsonPart(raw) : null, got = Array.isArray(v?.requests) ? v!.requests as Array<Record<string, unknown>> : [];
  const taken = new Set<string>();
  return members.map((m) => {
    const r = got.find((x) => Number(x?.lid) === m.lid), id = typeof r?.item === 'string' ? r.item : '';
    let item = itemById(id) && itemById(id)!.domain === m.domain && !taken.has(id) ? id : defaultItem(m.domain, war, taken, tight); taken.add(item);
    const it = itemById(item)!, say = String(r?.say ?? '').trim().slice(0, 500) || L(`${it.ko}에 1년 예산을 배정해 주십시오. 지금 우리에게 필요한 투자입니다.`, `Please fund ${it.en.toLowerCase()} for a year. It is the investment we need now.`);
    return { lid: m.lid, name: m.name, domain: m.domain, item, say, cost: monthlyCost(income, 'f'), half: monthlyCost(income, 'h') };
  });
}
export const budFact = (active: Array<{ name: string; item: string; tier: BudTier; cost: number; until: string }>): string[] =>
  active.map((x) => { const it = itemById(x.item); return `Budget running until ${x.until}: ${it?.en ?? x.item}${x.tier === 'h' ? ' (cut to half)' : ''}, requested by ${x.name}, ${x.cost} energy a month.`; });
