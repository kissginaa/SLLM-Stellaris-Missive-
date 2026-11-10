// 통치자의 연애·청혼·결혼식(23·25·26·27·28)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 청혼은 교제 중 + 호감 90 이상 / 예식 국가공인(에너지 500·식량 2500·광물 200) 또는 비공식(200·500·100) / 준비 게임 1년 /
//   준비 확정 때 납부 → 1년 뒤 예약 / 취소·이별·사망 시 납부분 50% 환불 / 전쟁 중에도 진행(분위기만 바뀜).
// 게임 자료 근거: add_resource = { energy = -N food = -N minerals = -N } 와 resource_stockpile_compare 로 납부·잔액 확인(petition.ts·letters.ts 와 같은 틀).
import { addYears, cmpDate } from './gamedate';
import { L } from './i18n-pick';
import type { Pid } from './relations';

export type WeddingScale = 'state' | 'informal';
export interface Cost { energy: number; food: number; minerals: number }
export const WEDDING_COST: Record<WeddingScale, Cost> = { state: { energy: 500, food: 2500, minerals: 200 }, informal: { energy: 200, food: 500, minerals: 100 } };
export const WEDDING_PREP_YEARS = 1;
export const PROPOSAL_MIN_AFFECTION = 90;
export const REFUND_RATIO = 0.5;
export const refund = (c: Cost): Cost => ({ energy: Math.floor(c.energy * REFUND_RATIO), food: Math.floor(c.food * REFUND_RATIO), minerals: Math.floor(c.minerals * REFUND_RATIO) });

/** 청혼 제안 가능?(25) 교제 중이고 그 관계의 호감이 90 이상(포함). 호감 정보가 없으면 불가. 수락은 별개. */
export function canPropose(a: { romance: string; affection?: number }): { ok: boolean; reason?: string } {
  if (a.romance !== 'dating') return { ok: false, reason: L('교제 중인 상대에게만 청혼할 수 있습니다.', 'You can only propose to someone you are dating.') };
  if (a.affection === undefined) return { ok: false, reason: L('호감도를 아직 알 수 없습니다.', 'Affection is not known yet.') };
  if (a.affection < PROPOSAL_MIN_AFFECTION) return { ok: false, reason: L(`호감도가 ${PROPOSAL_MIN_AFFECTION} 이상이어야 합니다.`, `Affection must be at least ${PROPOSAL_MIN_AFFECTION}.`) };
  return { ok: true };
}

/** 예식 레코드. 상태: engaged(약혼) → preparing(납부 완료·예약) → done / cancelled. 비용 요청은 reqId 하나로. */
export interface Wedding {
  id: string; sid: string; ruler: Pid; partner: Pid;
  scale?: WeddingScale; state: 'engaged' | 'preparing' | 'done' | 'cancelled';
  engagedOn: string; confirmedOn?: string; scheduledOn?: string; doneOn?: string; cancelledOn?: string;
  paid?: Cost; payReq?: number; refunded?: Cost; refundReq?: number; /** 환불 명령이 게임에 적용됨(applied/duplicate). 없으면 게임이 켜질 때 다시 보낸다. */ refundDone?: boolean;
  guests?: Pid[]; speaker?: Pid; attendedGuests?: Pid[];
  /** 전쟁 중 예식(26): 분위기 표시용. */
  wartime?: boolean;
}
export const newWedding = (sid: string, ruler: Pid, partner: Pid, on: string): Wedding => ({ id: `wed:${sid}:${ruler}:${on}`, sid, ruler, partner, state: 'engaged', engagedOn: on });

/** 준비 확정(26): 규모를 고르고 납부가 확인되면 1년 뒤로 예약. 납부 전에는 약혼 유지. */
export function confirmPreparation(w: Wedding, scale: WeddingScale, today: string, payResult: 'applied' | 'short' | 'unknown', req: number): { ok: boolean; reason?: string } {
  if (w.state !== 'engaged') return { ok: false, reason: L('약혼 상태가 아닙니다.', 'Not engaged.') };
  w.scale = scale; w.payReq = req;
  if (payResult === 'short') return { ok: false, reason: L('자원이 모자라 준비를 확정하지 못했습니다. 약혼은 유지됩니다.', 'Not enough resources to confirm. You remain engaged.') };
  if (payResult === 'unknown') return { ok: false, reason: L('납부 결과를 확인하지 못했습니다. 다시 확인해 주세요.', 'Payment result unknown. Please check again.') };
  w.paid = { ...WEDDING_COST[scale] }; w.state = 'preparing'; w.confirmedOn = today; w.scheduledOn = addYears(today, WEDDING_PREP_YEARS);
  return { ok: true };
}
/** 예정일 도래?(26) 앱이 꺼져 있었으면 돌아온 뒤 「미처리 예식」으로 안내(과거에 자동 완료로 꾸미지 않는다). */
export const weddingDue = (w: Wedding, today: string): boolean => w.state === 'preparing' && !!w.scheduledOn && cmpDate(today, w.scheduledOn) >= 0;
export function completeWedding(w: Wedding, today: string, attended: Pid[], atWar: boolean): boolean {
  if (!weddingDue(w, today)) return false;
  w.state = 'done'; w.doneOn = today; w.attendedGuests = attended; w.wartime = atWar; return true;
}
/** 취소(26·28): 준비 중(납부 뒤)이면 납부분 50% 환불. 약혼만 한 상태면 환불 없음. 완료된 예식은 취소 불가. 같은 취소에 환불 중복 없음. */
export function cancelWedding(w: Wedding, today: string, why: 'cancel' | 'breakup' | 'death', refundReq?: number): { refund: Cost | null } {
  if (w.state === 'done' || w.state === 'cancelled') return { refund: null };
  const r = w.state === 'preparing' && w.paid && !w.refunded ? refund(w.paid) : null;
  w.state = 'cancelled'; w.cancelledOn = today; if (r) { w.refunded = r; w.refundReq = refundReq; }
  void why; return { refund: r };
}

const okArgs = (req: number, sid: string) => Number.isSafeInteger(req) && req >= 1 && /^\d+$/.test(sid);
const esc = (s: string) => s.replace(/[^a-z0-9_]/gi, '_').slice(0, 40);
/** 납부 명령: 세 자원이 모두 있어야 한 묶음으로 차감. 같은 예식 ID 는 한 번만. 회신 SLLM:WEDPAY status=applied|short|duplicate. */
export function weddingPayCommand(req: number, sid: string, weddingId: string, scale: WeddingScale): string {
  if (!okArgs(req, sid)) throw new Error('결혼식 납부 인자가 올바르지 않습니다.');
  const c = WEDDING_COST[scale], mark = `sllm_wed_${esc(weddingId)}`;
  const log = (s: string) => `log = "SLLM:WEDPAY/;/req=${req}/;/sid=${sid}/;/wid=${esc(weddingId)}/;/status=${s}"`;
  const short = `OR = { resource_stockpile_compare = { resource = energy value < ${c.energy} } resource_stockpile_compare = { resource = food value < ${c.food} } resource_stockpile_compare = { resource = minerals value < ${c.minerals} } }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { ${short} } ${log('short')} } else = { add_resource = { energy = -${c.energy} food = -${c.food} minerals = -${c.minerals} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}
/** 환불 명령(50%): 같은 예식 ID 는 한 번만. 회신 SLLM:WEDREFUND. */
export function weddingRefundCommand(req: number, sid: string, weddingId: string, r: Cost): string {
  if (!okArgs(req, sid)) throw new Error('결혼식 환불 인자가 올바르지 않습니다.');
  const mark = `sllm_wedref_${esc(weddingId)}`;
  const log = (s: string) => `log = "SLLM:WEDREFUND/;/req=${req}/;/sid=${sid}/;/wid=${esc(weddingId)}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { add_resource = { energy = ${r.energy} food = ${r.food} minerals = ${r.minerals} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}

/** 데이트 결과 → 호감 변화 방향(25). 수치는 미정이라 단계만 돌려준다; 반복 감쇠(같은 장소·선택)는 호출 쪽이 count 로 넘긴다. */
export type DateOutcome = 'special' | 'fun' | 'plain' | 'awkward' | 'rude';
export function dateAffectionStep(o: DateOutcome, repeats = 0): { dir: 1 | 0 | -1; size: 'big' | 'mid' | 'small' | 'none'; decayed: boolean } {
  const decayed = repeats > 0;
  switch (o) {
    case 'special': return { dir: 1, size: decayed ? 'mid' : 'big', decayed };
    case 'fun': return { dir: 1, size: decayed ? 'small' : 'mid', decayed };
    case 'plain': return { dir: 1, size: 'small', decayed };
    case 'awkward': return { dir: 0, size: 'none', decayed };
    case 'rude': return { dir: -1, size: 'small', decayed };
  }
}
/** 이별·이혼·사별(28): 현재 관계만 끝내고 이력은 남긴다. 예식 준비 중이면 cancelWedding 을 따로 부른다(50% 환불). */
export function endRelationship(r: { romance: string; endedOn?: string }, today: string, why: 'breakup' | 'divorce' | 'bereavement'): boolean {
  if (r.romance === 'none' || r.romance === 'ended') return false;
  r.romance = 'ended'; r.endedOn = today; void why; return true;
}
