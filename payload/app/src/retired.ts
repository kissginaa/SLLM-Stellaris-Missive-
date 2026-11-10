// 은퇴 지도자의 앱 내 생활(18·19·20·21)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 사망하지 않고 은퇴가 확인된 모든 대상은 앱이 생활·나이·연락을 관리(게임 생존 추적은 조건이 아님) / 일반 지도자는 「연락처 유지하기」 선택 + 은퇴 사유로 연락 가능 판정 /
//   배우자는 근무·파견 중이 아니면 개인실에 함께 / 자동 사망 방식은 미정(여기서는 넣지 않는다).
// 게임 자료 근거:
//  - 모드가 이미 보내는 사건: SLLM:LEADEROUT why=death | fired (on_leader_death / on_leader_fired, This = 국가, From = 지도자). 명단 누락은 gone 날짜로만 남는다(people.ts).
//  - 통치자 교체: on_ruler_set → SLLM:NEWS kind=ruler. 전임 통치자가 명단에 계속 있으면 「다른 직책 재임」, 사라지면 why 가 있을 때만 은퇴/사망.
//  - 나이·수명(4.5.1 triggers.log 확인): leader_age, leader_lifespan, is_immortal, leader_years_of_service — 모두 leader scope.
//    export_trigger_value_to_variable(leader scope 지원)로 LEADER 줄에 age·life·svc·imm 을 보낸다(mod/patches/01).
import { dayNo } from './gamedate';
import { L } from './i18n-pick';
import type { Pid } from './relations';

/** 떠난 사유 코드(19). 게임이 준 why 와 명단 상태로만 정한다. 모르면 unknown. */
export type DepartureReason = 'death' | 'fired' | 'retired' | 'vanished' | 'unknown';
export type Eligibility = 'eligible' | 'unavailable' | 'unknown';
export function departureFromSignals(s: { why?: 'death' | 'fired'; stillListed: boolean; wasRuler: boolean; rulerChanged: boolean }): DepartureReason {
  if (s.why === 'death') return 'death';
  if (s.why === 'fired') return 'fired';
  if (s.stillListed) return 'unknown'; // 아직 명단에 있다 = 떠나지 않음(다른 직책 재임 포함)
  if (s.wasRuler && s.rulerChanged) return 'retired'; // 임기 종료로 명단에서 사라진 통치자
  return 'vanished';
}
/** 연락 가능 판정(19 표): 사망 = 불가(추모), 해임·은퇴 = 가능, 실종·미확인 = 보류. */
export function contactEligibility(r: DepartureReason): Eligibility {
  switch (r) { case 'death': return 'unavailable'; case 'fired': case 'retired': return 'eligible'; default: return 'unknown'; }
}
export interface RetiredRecord {
  pid: Pid; sid: string; name: string; cls: string; lastRole: string; wasRuler: boolean;
  retiredOn: string; reason: DepartureReason; eligibility: Eligibility; keepRequested: boolean;
  /** 은퇴 당시 나이(게임 age 트리거로 읽은 값). 모르면 undefined → 현재 나이도 미확인. */
  ageAtRetire?: number; immortal?: boolean;
  /** 은퇴 당시 게임 수명(leader_lifespan). 앱 수명 정책의 기준 자료 — 자동 사망 규칙은 미정(18). */
  lifespanAtRetire?: number; yearsOfService?: number;
  /** 앱 RP 생애 종료(18: 방식 미정, 여기서는 수동/후속 규칙으로만 세팅). */
  lifeEndedOn?: string;
  household?: { partner: Pid; cohabit: boolean; since: string };
  snapshot: { traits?: string[]; portrait?: string; standing?: number };
}
/** 연락처로 넣을 수 있나(19): 유지 선택 + 연락 가능 + 생애 종료 전. */
export const canContact = (r: RetiredRecord): boolean => r.keepRequested && r.eligibility === 'eligible' && !r.lifeEndedOn;
/** 현재 나이(18): 은퇴 당시 나이 + 경과 게임 연수(360일 = 1년). 미확인이면 null. 불멸이면 나이 표시는 하되 노화 사망 대상이 아니다. */
export function ageNow(r: RetiredRecord, today: string): number | null {
  if (r.ageAtRetire === undefined) return null;
  const a = dayNo(r.retiredOn), b = dayNo(today); if (a === null || b === null) return null;
  return r.ageAtRetire + Math.max(0, Math.floor((b - a) / 360));
}
/** 남은 수명 표시(18): 수명·나이를 알 때만. 불멸이면 null. 자동 사망 판정에 쓰지 않는다(방식 미정). */
export function yearsLeftHint(r: RetiredRecord, today: string): number | null {
  if (r.immortal || r.lifespanAtRetire === undefined) return null;
  const a = ageNow(r, today); return a === null ? null : r.lifespanAtRetire - a;
}
/** 모드 LEADER 줄의 age·life·svc·imm 읽기(값이 없거나 이상하면 undefined). */
export function parseLeaderAge(kv: Record<string, string>): { age?: number; life?: number; svc?: number; immortal?: boolean } {
  const n = (v: string | undefined) => { const x = Number(v); return v !== undefined && v !== '' && Number.isFinite(x) && x >= 0 && x < 100000 ? Math.round(x) : undefined; };
  const out: { age?: number; life?: number; svc?: number; immortal?: boolean } = {};
  const age = n(kv.age), life = n(kv.life), svc = n(kv.svc);
  if (age !== undefined) out.age = age; if (life !== undefined) out.life = life; if (svc !== undefined) out.svc = svc;
  if (kv.imm === '1') out.immortal = true; else if (kv.imm === '0') out.immortal = false;
  return out;
}
/** 목록 구분(19). */
export function retiredListing(r: RetiredRecord): { ko: string; en: string } {
  if (r.lifeEndedOn || r.reason === 'death') return { ko: '추모 기록', en: 'In memoriam' };
  if (canContact(r)) return { ko: '은퇴 후 연락 가능', en: 'Retired, reachable' };
  if (r.eligibility === 'unknown') return { ko: '연락 불가·확인 필요', en: 'Unreachable, needs confirmation' };
  return { ko: '연락 안 함', en: 'Not kept in contacts' };
}
/** 연락 장면 선택(20): 본인 / 동반자 대리 응답 / 둘 다. 비율은 미정 → 균등. 비공개 관계면 본인 응답으로. */
export function pickResponder(r: RetiredRecord, partnerKnownToCaller: boolean, rng: () => number): 'self' | 'partner' | 'both' {
  if (!r.household?.cohabit || !partnerKnownToCaller) return 'self';
  const x = rng(); return x < 1 / 3 ? 'self' : x < 2 / 3 ? 'partner' : 'both';
}
/** 배우자의 개인실 재실(21): 혼인 중 + 근무·파견이 「확인」되지 않았을 때만. 확인 불가를 부재로 바꾸지 않는다. */
export function spousePresent(s: { married: boolean; onDuty: boolean | null; lifeEnded: boolean }): 'present' | 'away' | 'none' {
  if (!s.married || s.lifeEnded) return 'none';
  return s.onDuty === true ? 'away' : 'present';
}
export const dutyLabel = (onDuty: boolean | null): string => (onDuty === true ? L('근무·파견 중', 'On duty') : onDuty === false ? L('재실', 'At home') : L('일정 미확인', 'Schedule unknown'));
