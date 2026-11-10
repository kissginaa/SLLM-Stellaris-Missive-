// 정책 파벌 심사(2026-10-19 사용자 결정): 파벌이 생기기 전에는 정책이 그대로 통과되지만, 파벌이 생기면 정책을 선포할 때 파벌의 심사를 거친다.
// 정부 형태별: 민주정 = 파벌 지지율 가중 과반 찬성이 있어야 통과(강행 불가). 독재정 = 심사 없음. 제국정 = 부결돼도 강행 가능하지만 반대 파벌 승인도 하락(1년).
// 과두정·기업 정부는 제국정처럼(강행 가능·승인도 하락), 군체·기계는 파벌이 없어 심사 없음. 정부 형태를 모르면(옛 모드) 제국정처럼 다룬다(막지 않고 대가만).
// 표결은 앱이 정한다(AI 없음): 파벌 가치관과 정책의 버프 분야·조건이 맞는지 점수를 매기고, 불만인 파벌(승인도 35% 미만)은 한 단계 더 반대 쪽으로.
// 순수 로직만 둔다. 앱은 features/policy-app.ts(policyReview·policyEnact), 화면은 ui/office-policy.js(조건 확인 단계).
import type { FactionEthic } from './gamestate';
import { L } from './i18n-pick';

export type ReviewRule = 'none' | 'vote' | 'force';
/** 정부 형태 번호(모드 sllm_probe_secretary auth: 1 민주 2 과두 3 독재 4 제국 5 기업 6 군체 7 기계, 0·없음 = 모름) → 심사 규칙. */
export function reviewRule(auth: number | null | undefined): ReviewRule {
  if (auth === 1) return 'vote';
  if (auth === 3 || auth === 6 || auth === 7) return 'none';
  return 'force';
}
export const RULE_TEXT: Record<ReviewRule, [string, string]> = {
  vote: ['민주정: 파벌 표결에서 과반 찬성을 얻어야 선포할 수 있습니다(강행 불가).', 'Democracy: the factions must approve by majority before you can proclaim (no forcing).'],
  force: ['파벌 표결에서 부결돼도 강행할 수 있지만, 반대한 파벌의 승인도가 1년 동안 떨어집니다.', 'You may force it through even if the factions reject it, but the opposing factions lose approval for a year.'],
  none: ['독재정: 파벌 심사 없이 선포합니다.', 'Dictatorship: proclaimed without faction review.'],
};
/** 강행했을 때 반대 파벌에 거는 승인도 하락(모드 sllm_policy_review_modifiers.txt). */
export const FORCED_MOD = 'sllm_policy_forced', FORCED_DAYS = 360, DISGRUNTLED = 0.35;

type Ethic = Exclude<FactionEthic, ''>;
/** 가치관 × 버프 분야 점수(−2..2). */
const GROUP_AFFINITY: Record<Ethic, Record<string, number>> = {
  militarist: { fleet: 2, army: 2, build: 1, explore: 1, diplomacy: -1 },
  pacifist: { fleet: -2, army: -2, diplomacy: 2, society: 1, economy: 1 },
  authoritarian: { empire: 2, leader: 1, army: 1, society: -1 },
  egalitarian: { society: 2, research: 1, economy: 1, empire: -1 },
  xenophile: { diplomacy: 2, trade: 2, explore: 1, army: -1 },
  xenophobe: { army: 1, fleet: 1, build: 1, diplomacy: -1, trade: -1 },
  materialist: { research: 2, build: 1, economy: 1, explore: 1 },
  spiritualist: { society: 2, empire: 1, research: -1 },
};
/** 가치관 × 정책 조건 점수. */
const COND_AFFINITY: Record<Ethic, Record<string, number>> = {
  militarist: { rival: 2, naval: 1, friend: -1, peace: -2 },
  pacifist: { peace: 2, friend: 1, federation: 1, galcom: 1, pact: 1, rival: -2, naval: -1 },
  authoritarian: { subjects: 1, capstab: 1 },
  egalitarian: { galcom: 1, capstab: 1 },
  xenophile: { friend: 2, federation: 1, galcom: 1, pact: 1, rival: -1 },
  xenophobe: { rival: 2, friend: -2, federation: -1, galcom: -1, pact: -1 },
  materialist: { income: 1, pact: 1 },
  spiritualist: { capstab: 1, peace: 1 },
};
export const GROUP_KO: Record<string, [string, string]> = {
  economy: ['경제', 'economy'], research: ['연구', 'research'], society: ['사회', 'society'], build: ['건설', 'construction'], empire: ['제국 운영', 'administration'], leader: ['지도자', 'leaders'],
  explore: ['탐사', 'exploration'], diplomacy: ['외교', 'diplomacy'], fleet: ['함대', 'the fleet'], army: ['지상군', 'armies'], trade: ['교역', 'trade'],
};
export const COND_KO: Record<string, [string, string]> = {
  rival: ['경쟁 상대 압박', 'pressuring a rival'], friend: ['우호 관계', 'friendship'], peace: ['평화 유지', 'keeping the peace'], naval: ['해군 증강', 'naval buildup'], federation: ['연방', 'the federation'],
  galcom: ['은하 공동체', 'the Galactic Community'], pact: ['협약', 'pacts'], subjects: ['종속국', 'subjects'], capstab: ['수도 안정', 'capital stability'], income: ['수입 증대', 'income growth'],
};
export interface FactionIn { fid?: number; name: string; ethic: FactionEthic; support: number; approval: number }
export interface Vote { fid?: number; name: string; ethic: FactionEthic; support: number; vote: 'yes' | 'no' | 'abstain'; score: number; why: Array<[string, string]> }
export interface Review { votes: Vote[]; yes: number; no: number; abstain: number; passed: boolean }
/** 파벌 표결. groups = 고른 버프 분야 2개, conds = 뽑힌 조건 종류. 파벌이 없으면 null(심사 없이 통과). */
/** 의회 진영(2026-11-03 여당·야당): 파벌 열쇠(parliament facKey: 'f'+fid 또는 'n:'+이름) → 진영. 연정·거래 약속은 찬성 쪽, 야당 대표와의 관계는 제1야당 표에 반영. */
export interface ParlBloc { side: Record<string, 'ruling' | 'coalition' | 'deal' | 'opposition'>; oppLead: string | null; relation: number; seats?: Record<string, number> }
/** filiSeats: 반대한 야당 의석이 이만큼(200석 중 3분의 1) 넘으면 필리버스터. filiDays: 기다리면 이만큼 늦게 선포. ramMood·ramRelation: 날치기 통과의 대가. */
export const PARL_VOTE = { ruling: 1, coalition: 1, deal: 2, relationAt: 25, filiSeats: 67, filiDays: 60, ramMood: -3, ramRelation: -20 };
/** 필리버스터(2026-11-03 원내 공방): 표결은 통과했지만 반대한 야당 의석이 3분의 1을 넘고 야당 대표와의 관계가 좋지 않으면(+25 미만) 야당이 의사 진행을 막는다. */
export function filibusterOf(r: Review | null, bloc: ParlBloc | null): { seats: number; by: string[] } | null {
  if (!r || !r.passed || !bloc || !bloc.seats || bloc.relation >= PARL_VOTE.relationAt) return null;
  const no = r.votes.filter((v) => v.vote === 'no' && bloc.side[blocKey(v)] === 'opposition');
  const seats = no.reduce((a, v) => a + (bloc.seats![blocKey(v)] ?? 0), 0);
  return seats >= PARL_VOTE.filiSeats ? { seats, by: no.map((v) => v.name) } : null;
}
export const blocKey = (f: { fid?: number; name: string }) => (f.fid ? 'f' + f.fid : 'n:' + f.name);
export function reviewPolicy(factions: FactionIn[], groups: string[], conds: string[], bloc: ParlBloc | null = null): Review | null {
  const fs = factions.filter((f) => f && f.name && f.support > 0); if (!fs.length) return null;
  const votes: Vote[] = fs.map((f) => {
    let score = 0; const why: Array<[string, string]> = [];
    if (f.ethic) {
      const e = f.ethic as Ethic;
      for (const g of groups) { const v = GROUP_AFFINITY[e]?.[g] ?? 0; if (v) { score += v; const n = GROUP_KO[g] ?? [g, g]; why.push(v > 0 ? [`${n[0]} 강화 환영`, `welcomes more ${n[1]}`] : [`${n[0]} 강화 반대`, `opposes more ${n[1]}`]); } }
      for (const c of conds) { const v = COND_AFFINITY[e]?.[c] ?? 0; if (v) { score += v; const n = COND_KO[c] ?? [c, c]; why.push(v > 0 ? [`${n[0]} 지지`, `supports ${n[1]}`] : [`${n[0]} 반대`, `opposes ${n[1]}`]); } }
    }
    if (f.approval < DISGRUNTLED) { score -= 1; why.push(['정부에 불만', 'unhappy with the government']); }
    if (bloc) {
      const k = blocKey(f), side = bloc.side[k];
      if (side === 'ruling') { score += PARL_VOTE.ruling; why.push(['여당', 'ruling party']); }
      else if (side === 'coalition') { score += PARL_VOTE.coalition; why.push(['연정 약속', 'coalition partner']); }
      else if (side === 'deal') { score += PARL_VOTE.deal; why.push(['법안 거래 약속', 'bound by a legislative deal']); }
      else if (k === bloc.oppLead && bloc.relation <= -PARL_VOTE.relationAt) { score -= 1; why.push(['야당 대표와 대립', 'at odds with the opposition leader']); }
      else if (k === bloc.oppLead && bloc.relation >= PARL_VOTE.relationAt) { score += 1; why.push(['영수회담의 신뢰', 'trust from the leaders\' summit']); }
    }
    return { ...(f.fid !== undefined ? { fid: f.fid } : {}), name: f.name, ethic: f.ethic, support: f.support, vote: score > 0 ? 'yes' : score < 0 ? 'no' : 'abstain', score, why };
  });
  const sum = (k: Vote['vote']) => Math.round(votes.filter((v) => v.vote === k).reduce((a, v) => a + v.support, 0) * 1000) / 1000;
  const yes = sum('yes'), no = sum('no'), abstain = sum('abstain');
  return { votes, yes, no, abstain, passed: yes > no };
}
/** 강행: 반대한 파벌(sllm_f_id)에 승인도 하락 1년 → SLLM:POLICYFORCE req·sid·status. */
export function forcedCommand(req: number, sid: string, fids: number[]): string {
  const ids = fids.filter((x) => Number.isSafeInteger(x) && x > 0);
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !ids.length) throw new Error(L('강행 인자가 올바르지 않습니다.', 'Invalid force-through arguments.'));
  const log = (status: string) => `log = "SLLM:POLICYFORCE/;/req=${req}/;/sid=${sid}/;/status=${status}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } every_pop_faction = { limit = { OR = { ${ids.map((i) => `check_variable = { which = sllm_f_id value = ${i} }`).join(' ')} } } remove_modifier = ${FORCED_MOD} add_modifier = { modifier = ${FORCED_MOD} days = ${FORCED_DAYS} } } ${log('applied')} }`;
}
