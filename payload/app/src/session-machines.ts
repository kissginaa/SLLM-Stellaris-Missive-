// 긴급회의(02)·다자 통신(03)·타국 만찬 초대(05)·처형(06)·기자회견 침투(11) 의 세션 상태 기계와 게임 효과 요청 계약(08). 2026-10-23 Claude 사전 설계.
// 상태 전이는 전부 앱이 하고 AI 는 발언만 만든다. 늦은 응답(snapshotRevision 불일치)은 버린다. 비가역 효과는 requestId 로 한 번만.
// 게임 자료 근거:
//  - 다른 제국에 효과 걸기: every_country = { limit = { check_variable = { which = sllm_idx value = N } } add_modifier = … } (ETHIC·대사관 probe 가 같은 방식으로 상대 제국을 찾는다).
//  - 처형(4.5.1 effects.log 확인): kill_leader = { show_notification = yes/no fire = yes(→on_leader_fired) } — leader scope 에서 그 사람만. 기본은 on_leader_death 가 불려
//    기존 SLLM:LEADEROUT why=death 가 따라온다 → 앱은 처형 요청과 같은 원인 사건으로 묶는다. 외국 지도자는 sllm_lid 가 없어 대상 불가 → 우리 제국 인물만.
//  - 전쟁 발발·독립·반란은 이미 SLLM:NEWS 로 받지만 02 최신 확정으로 긴급회의 자동 제안은 하지 않는다(향후 확장 참고).
import type { Pid } from './relations';

export interface EffectRequest { requestId: string; sid: string; source: string; effectKey: string; targetIds: string[]; createdAt: string; status: 'pending' | 'applied' | 'rejected' | 'outcome_unknown'; reason?: string }
/** 허용 효과 키(08): 호스트에서 검증한 것만. LLM 자유 입력 불가. */
export const EFFECT_ALLOWLIST = new Set(['discontent_add', 'discontent_remove', 'wedding_pay', 'wedding_refund', 'social_cost', 'holiday_visit', 'council_penalty', 'press_infiltration_debuff', 'execute_leader']);
export function newEffectRequest(sid: string, source: string, effectKey: string, targetIds: string[], createdAt: string, id: string): EffectRequest | null {
  if (!EFFECT_ALLOWLIST.has(effectKey)) return null;
  return { requestId: id, sid, source, effectKey, targetIds, createdAt, status: 'pending' };
}
/** 회신 반영: 같은 요청은 한 번만. 회신이 없으면 outcome_unknown 으로 두고 자동 재전송하지 않는다. */
export function settleEffect(r: EffectRequest, status: 'applied' | 'rejected' | 'duplicate' | 'no_target' | 'short', reason?: string): boolean {
  if (r.status !== 'pending' && r.status !== 'outcome_unknown') return false;
  r.status = status === 'applied' || status === 'duplicate' ? 'applied' : 'rejected'; if (reason) r.reason = reason; return true;
}

/** 공통 세션 틀. */
export interface Session<S extends string> { id: string; sid: string; feature: string; state: S; participants: Pid[]; snapshotRevision: number; sourceEventIds: string[]; openedOn: string; closedOn?: string }
export function transition<S extends string>(s: Session<S>, table: Record<S, S[]>, to: S, today?: string): boolean {
  if (!table[s.state].includes(to)) return false;
  s.state = to; if (today && isTerminal(table, to)) s.closedOn = today; return true;
}
const isTerminal = <S extends string>(table: Record<S, S[]>, st: S) => table[st].length === 0;
/** AI 응답이 지금 세션에 맞는가(08): 세션·버전·화자가 참가자. */
export function acceptAiReply<S extends string>(s: Session<S>, reply: { sessionId: string; snapshotRevision: number; speakerId: Pid }): boolean {
  return reply.sessionId === s.id && reply.snapshotRevision === s.snapshotRevision && s.participants.includes(reply.speakerId);
}
/** 참가자 변경(02·03): 세션 버전을 올리고 발언 근거는 바꾸지 않는다. 사라진 참가자는 뺀다. */
export function reviseParticipants<S extends string>(s: Session<S>, alive: Pid[]): Pid[] {
  const before = s.participants; s.participants = before.filter((p) => alive.includes(p));
  if (s.participants.length !== before.length) s.snapshotRevision++;
  return before.filter((p) => !alive.includes(p));
}

// 02 긴급회의 → emergency-council.ts(02 최신 확정: 수동 소집만). 자동 제안(EMERGENCY_TRIGGERS·proposeEmergency)은 초기 범위에서 빠져 지웠다.

// 03 다자 통신
export type MultiState = 'draft' | 'inviting' | 'ready' | 'active' | 'ended' | 'cancelled';
export const MULTI: Record<MultiState, MultiState[]> = { draft: ['inviting', 'cancelled'], inviting: ['ready', 'cancelled'], ready: ['active', 'cancelled'], active: ['ended'], ended: [], cancelled: [] };
// 인원·소집·발언 규칙은 46 최신 확정(3~5개국·플레이어만 소집·즉시 판정·1개월) → interstellar-council.ts. 아래 상태표·nextSpeaker 는 예전 초안(참고용).
/** 라운드 화자 고르기(03): 앱이 순서를 정한다. 같은 화자 독점 방지 — 직전 화자는 제외. */
export function nextSpeaker(participants: Pid[], last: Pid | null, rng: () => number): Pid | null {
  const pool = participants.filter((p) => p !== last); if (!pool.length) return participants[0] ?? null;
  return pool[Math.floor(rng() * pool.length)];
}

// 05 타국 만찬 초대
export type ForeignBanquetState = 'offered' | 'accepted' | 'scheduled' | 'arrived' | 'completed' | 'declined' | 'cancelled' | 'expired';
export const FOREIGN_BANQUET: Record<ForeignBanquetState, ForeignBanquetState[]> = { offered: ['accepted', 'declined', 'expired', 'cancelled'], accepted: ['scheduled', 'cancelled'], scheduled: ['arrived', 'cancelled'], arrived: ['completed', 'cancelled'], completed: [], declined: [], cancelled: [], expired: [] };
/** 통치자 교체 시(05): 자동으로 새 통치자 방문으로 바꾸지 않고 재확정 필요 표시. */
export function banquetOnRulerChange(s: Session<ForeignBanquetState> & { recipient: Pid; needsReconfirm?: boolean }, newRuler: Pid): void {
  if (s.recipient !== newRuler && (s.state === 'accepted' || s.state === 'scheduled')) s.needsReconfirm = true;
}

// 06 처형
export type ExecutionState = 'selected' | 'confirming' | 'requested' | 'applied' | 'outcome_unknown' | 'rejected' | 'cancelled';
export const EXECUTION: Record<ExecutionState, ExecutionState[]> = { selected: ['confirming', 'cancelled'], confirming: ['requested', 'cancelled'], requested: ['applied', 'outcome_unknown', 'rejected'], outcome_unknown: ['applied', 'rejected'], applied: [], rejected: [], cancelled: [] };
/** 최종 확인 문구에 대상 이름과 효과를 넣는다(06·08). 요청 전 대상 생존·동일 인물 재검사는 호출 쪽. */
export function executionConfirmText(name: string, lang: 'ko' | 'en'): string {
  return lang === 'ko' ? `${name}을(를) 처형합니다. 이 결정은 되돌릴 수 없습니다. 게임에서 이 지도자가 제거됩니다.` : `Execute ${name}. This cannot be undone; the leader will be removed from the game.`;
}

/** 처형 명령(06): sllm_lid 로 대상, 요청 표식으로 한 번만. 통치자 자신은 06 에서 미정 → 앱은 allowRuler=false 로만 부른다(execution-case.ts executionEligible). 게임 쪽에서도 is_ruler 를 다시 막는다. */
export function executionCommand(req: number, sid: string, lid: number, reqKey: string, allowRuler: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(lid) || lid < 1 || !/^[a-z0-9_]{1,40}$/.test(reqKey)) throw new Error('처형 명령 인자가 올바르지 않습니다.');
  const mark = `sllm_exe_${reqKey}`, log = (s: string) => `log = "SLLM:EXECUTE/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/status=${s}"`;
  const guard = allowRuler ? '' : `if = { limit = { is_ruler = yes } ${log('ruler_blocked')} } else = { `;
  const act = `prev = { set_variable = { which = ${mark} value = 1 } } ${log('applied')} kill_leader = { show_notification = yes }`;
  const body = `if = { limit = { prev = { is_variable_set = ${mark} } } ${log('duplicate')} } else = { ${guard}${act}${allowRuler ? '' : ' }'} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_exe_found value = 0 } every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${lid} } } prev = { set_variable = { which = sllm_exe_found value = 1 } } ${body} } if = { limit = { check_variable = { which = sllm_exe_found value = 0 } } ${log('no_target')} } clear_variable = sllm_exe_found }`;
}

// 11 기자회견 침투
export type InfiltrationGameState = 'ready' | 'reserved' | 'consumed' | 'revoked';
export type InfiltrationState = 'available' | 'dispatch_pending' | 'active' | 'judging' | 'result_pending' | 'completed' | 'aborted';
export const INFILTRATION: Record<InfiltrationState, InfiltrationState[]> = { available: ['dispatch_pending'], dispatch_pending: ['active', 'available'], active: ['judging', 'aborted'], judging: ['result_pending'], result_pending: ['completed'], completed: [], aborted: [] };
/** 혼란 등급(11): 질문별 판정(questionId 로 한 번)을 합산해 등급. 상한·회차 제한은 앱 규칙. 수치는 초기 제안. */
export type ChaosGrade = 'none' | 'minor' | 'confusion' | 'crisis';
export function chaosGrade(scores: Record<string, number>, maxQuestions = 5, perQuestionCap = 20): { total: number; grade: ChaosGrade } {
  const vals = Object.values(scores).slice(0, maxQuestions).map((v) => Math.max(0, Math.min(perQuestionCap, Math.round(v))));
  const total = vals.reduce((a, b) => a + b, 0);
  const grade: ChaosGrade = total >= 70 ? 'crisis' : total >= 40 ? 'confusion' : total >= 15 ? 'minor' : 'none';
  return { total, grade };
}
/** 상대 제국 디버프 명령(11): 그 제국(sllm_idx)에 국가 scope 수정자. 등급별 수정자 키는 모드 파일. 같은 작전 ID 는 한 번만. */
export function infiltrationDebuffCommand(req: number, sid: string, targetIdx: number, operationId: string, modifier: string, days: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(targetIdx) || targetIdx < 1 || !/^[a-z0-9_]{1,40}$/.test(operationId) || !/^[a-z0-9_]+$/.test(modifier) || !Number.isSafeInteger(days) || days < 1) throw new Error('침투 결과 인자가 올바르지 않습니다.');
  const mark = `sllm_inf_${operationId}`, log = (s: string) => `log = "SLLM:INFILTRATE/;/req=${req}/;/sid=${sid}/;/idx=${targetIdx}/;/op=${operationId}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } set_variable = { which = sllm_inf_found value = 0 } every_country = { limit = { check_variable = { which = sllm_idx value = ${targetIdx} } } remove_modifier = ${modifier} add_modifier = { modifier = ${modifier} days = ${days} } prev = { set_variable = { which = sllm_inf_found value = 1 } } } if = { limit = { check_variable = { which = sllm_inf_found value = 1 } } ${log('applied')} } else = { ${log('no_target')} } clear_variable = sllm_inf_found } }`;
}
