// 정치 시스템 초기 범위(16·17): 두 수치(주민 지지도·정치적 지위)와 다섯 사건, 변동 이유 표시. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 사건 종류와 방향만. 수치 크기·초깃값·상한은 미정 → DELTA 를 초기 조정값으로 두고 미확인은 undefined 로 남긴다(0 이나 추정값으로 채우지 않는다).
// 같은 성과 묶음(causeGroup)은 수치마다 한 번만(청원 해결 = 약속 이행이면 한 묶음). 국민청원의 기본 성과는 플레이어 민심(17) → 여기서는 총독 기여가 확인된 경우(contributed)만.
import { L } from './i18n-pick';
import type { Pid } from './relations';

export type StandingKind = 'petition_resolved' | 'promise_kept' | 'promise_broken' | 'proposal_success' | 'public_recognition' | 'protest_advocate' | 'protest_hardline';
export interface StandingEvent {
  id: string; kind: StandingKind; pid: Pid; planet?: string; date: string;
  /** 같은 성과 묶음 ID(16). 청원 해결과 약속 이행이 같은 성과면 같은 값. */
  causeGroup: string;
  /** 주민에게 도움이 됐는가(16: promise_kept·proposal_success 의 지지도 조건). 미확인이면 undefined → 지지도 변화 없음. */
  helpedResidents?: boolean;
  /** 공개적으로 인정·문제됐는가(16: petition_resolved 의 지위, promise_broken 의 지위 조건). */
  publicly?: boolean;
  /** 총독의 실제 기여가 확인됐는가(17: 청원은 플레이어 성과가 기본). */
  contributed?: boolean;
}
export interface StandingLedger {
  sid: string;
  support: Record<string, number | undefined>; // 키 `${pid}|${planet}` → 0~100
  standing: Record<Pid, number | undefined>;    // 0~100
  changes: StandingChange[];
}
export interface StandingChange { id: string; pid: Pid; metric: 'support' | 'standing'; planet?: string; before?: number; delta: number; after: number; reason: StandingKind; causeGroup: string; date: string; rulesVersion: string }
export const STANDING_RULES_VERSION = '2026-10-23.a';
/** 초기 조정값(미확정). */
export const DELTA = { support: { up: 5, down: 5 }, standing: { up: 5, down: 5 }, initial: 50 } as const;
/** 시위 총독 입장(사용자 확정 2026-10-23): 시민 편 = 지역 민심 +10(통치자 신뢰 −5), 강경 = 지역 민심 −5(통치자 신뢰 +5). 신뢰는 relations 쪽(protests.ts governorRelationChange). */
export const PROTEST_DELTA = { advocateSupport: 10, hardlineSupport: 5, trust: 5 } as const;
export const emptyStanding = (sid: string): StandingLedger => ({ sid, support: {}, standing: {}, changes: [] });
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** 사건 하나 → 두 수치 변화(16 표). 묶음·수치당 한 번. 돌려주는 값은 실제로 적용된 변화들. */
export function applyStandingEvent(led: StandingLedger, ev: StandingEvent): StandingChange[] {
  const plan: Array<['support' | 'standing', number]> = [];
  switch (ev.kind) {
    case 'petition_resolved': if (ev.contributed) { plan.push(['support', +DELTA.support.up]); if (ev.publicly) plan.push(['standing', +DELTA.standing.up]); } break;
    case 'promise_kept': if (ev.helpedResidents) plan.push(['support', +DELTA.support.up]); plan.push(['standing', +DELTA.standing.up]); break;
    case 'promise_broken': plan.push(['support', -DELTA.support.down]); if (ev.publicly) plan.push(['standing', -DELTA.standing.down]); break;
    case 'proposal_success': if (ev.helpedResidents) plan.push(['support', +DELTA.support.up]); plan.push(['standing', +DELTA.standing.up]); break;
    case 'public_recognition': plan.push(['standing', +DELTA.standing.up]); break;
    case 'protest_advocate': plan.push(['support', +PROTEST_DELTA.advocateSupport]); break;
    case 'protest_hardline': plan.push(['support', -PROTEST_DELTA.hardlineSupport]); break;
  }
  const out: StandingChange[] = [];
  for (const [metric, delta] of plan) {
    if (metric === 'support' && !ev.planet) continue;
    if (led.changes.some((c) => c.causeGroup === ev.causeGroup && c.pid === ev.pid && c.metric === metric && (metric === 'standing' || c.planet === ev.planet))) continue; // 같은 묶음 중복 금지
    const key = metric === 'support' ? `${ev.pid}|${ev.planet}` : ev.pid;
    const before = metric === 'support' ? led.support[key] : led.standing[ev.pid];
    const after = clamp((before ?? DELTA.initial) + delta);
    if (metric === 'support') led.support[key] = after; else led.standing[ev.pid] = after;
    const ch: StandingChange = { id: `${ev.id}:${metric}`, pid: ev.pid, metric, ...(ev.planet ? { planet: ev.planet } : {}), ...(before !== undefined ? { before } : {}), delta, after, reason: ev.kind, causeGroup: ev.causeGroup, date: ev.date, rulesVersion: STANDING_RULES_VERSION };
    led.changes.push(ch); out.push(ch);
  }
  return out;
}
/** 화면 표시(16): 수치 없으면 「미확인」, 변동 원인 한 줄. */
export const REASON_TEXT: Record<StandingKind, { ko: string; en: string }> = {
  petition_resolved: { ko: '주민 청원 해결', en: 'Resolved a residents\' petition' },
  promise_kept: { ko: '회의 약속 이행', en: 'Kept a council promise' },
  promise_broken: { ko: '약속 불이행', en: 'Broke a promise' },
  proposal_success: { ko: '제안 채택 뒤 성과 확인', en: 'Proposal adopted and its result confirmed' },
  protest_advocate: { ko: '시위에서 시민 편에 섬', en: 'Sided with protesters' },
  protest_hardline: { ko: '시위 강경 대응 주장', en: 'Called for a crackdown on protesters' },
  public_recognition: { ko: '공개 표창·지지', en: 'Public recognition or endorsement' },
};
export function standingView(led: StandingLedger, pid: Pid, planets: string[]): { standing: string; support: Array<{ planet: string; value: string }>; recent: string[] } {
  const fmt = (v: number | undefined) => (v === undefined ? L('미확인', 'Unknown') : String(v));
  const recent = led.changes.filter((c) => c.pid === pid).slice(-5).reverse().map((c) => `${L(REASON_TEXT[c.reason].ko, REASON_TEXT[c.reason].en)}: ${c.delta > 0 ? '+' : ''}${c.delta}`);
  return { standing: fmt(led.standing[pid]), support: planets.map((p) => ({ planet: p, value: fmt(led.support[`${pid}|${p}`]) })), recent };
}
