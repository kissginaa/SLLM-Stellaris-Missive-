// 타국 주최 만찬 초대(05·43·44)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 제국별 매월 기본 5%, 관계 나쁘면 0%, 좋을수록 최대 20% / 완료 뒤 그 제국 3년 재초대 금지 / 응답 기한 1개월(만료·거절 → 1년 금지) / 수락일 + 3개월 방문 /
//   접대 = 성대·평범·굴욕(드문 예외) / 초대장·일정·접대 판정은 LLM 없이.
// 게임 자료 근거: 상대 제국은 CONTACT 묶음(sllm_idx·score(관계 점수)·type·ct). 몰락한 제국·괴물·특수 세력은 mod-compat 의 접촉 정책이 이미 거른다 → 초대 자격도 같은 정책을 쓴다.
// 「관계가 나쁨」경계와 보간은 미정 → 아래 REL 상수를 자리값으로 두고 score(CONTACT 의 relation score) 를 입력으로 받는다.
import { addMonths, addYears, cmpDate } from './gamedate';
import type { Pid } from './relations';

export const FB = {
  monthlyBase: 0.05, monthlyMax: 0.2,
  /** 자리값: score 가 badBelow 미만이면 0%, 0 에서 5%, goodAt 이상이면 20%(그 사이 선형). CONTACT score 척도는 집컴 최신 수집값으로 확정. */
  rel: { badBelow: 0, goodAt: 100 },
  replyMonths: 1, visitMonths: 3, retryAfterDeclineYears: 1, retryAfterDoneYears: 3,
  /** 방문일이 지나고 이만큼 들어가지 않으면 놓친 것으로(05: 기한 자체는 미정 → 자리값). */ arrivedGraceMonths: 1,
} as const;

/** 월별 초대 확률(43). */
export function inviteChance(score: number): number {
  if (!Number.isFinite(score) || score < FB.rel.badBelow) return 0;
  const t = Math.max(0, Math.min(1, (score - FB.rel.badBelow) / (FB.rel.goodAt - FB.rel.badBelow)));
  return FB.monthlyBase + (FB.monthlyMax - FB.monthlyBase) * t;
}
export interface ForeignBanquetInvite {
  id: string; sid: string; empireIdx: number; empireName: string; host: Pid; recipient: Pid;
  sentOn: string; replyBy: string; state: 'offered' | 'accepted' | 'scheduled' | 'arrived' | 'completed' | 'declined' | 'cancelled' | 'expired';
  cancelledOn?: string;
  /** 취소 사유(05): 방문일 놓침 / 통치자 교체 / 방문일에 전쟁·주최국 연락 두절. */ cancelReason?: 'missed' | 'ruler_changed' | 'hostile' | 'host_gone';
  reason: string; acceptedOn?: string; visitOn?: string; completedOn?: string; declinedOn?: string; expiredOn?: string;
  hospitality?: 'grand' | 'plain' | 'humiliating'; needsReconfirm?: boolean;
  /** 교류 기록(44): 소개받은 인물·연락처 교환·선물·약속. 종료 때 한 번. */
  record?: { met: Pid[]; contacts: Pid[]; gifts: string[]; promises: string[] };
}
export interface ForeignBanquetBook {
  sid: string; invites: Record<string, ForeignBanquetInvite>;
  /** 제국별 재초대 가능 날짜(43: 완료 +3년, 거절·만료 +1년). */
  retryAfter: Record<string, string>;
  /** 월별 판정 기록 `${year}.${month}` → idx[] (재추첨 방지). */
  rolled: Record<string, number[]>;
}
export const emptyFbBook = (sid: string): ForeignBanquetBook => ({ sid, invites: {}, retryAfter: {}, rolled: {} });
const monthKey = (date: string) => { const m = /^(\d+)\.(\d+)\./.exec(date); return m ? `${m[1]}.${m[2]}` : date; };
const hasOpen = (b: ForeignBanquetBook, idx: number) => Object.values(b.invites).some((i) => i.empireIdx === idx && ['offered', 'accepted', 'scheduled', 'arrived'].includes(i.state));

/** 매월 한 제국의 초대 판정(43): 자격(contactable)·대기 종료·진행 중 초대 없음 → 확률. 같은 달·같은 제국은 한 번만. */
export function monthlyInviteRoll(b: ForeignBanquetBook, e: { idx: number; name: string; score: number; contactable: boolean; rulerPid: Pid; recipient: Pid }, today: string, rng: () => number): ForeignBanquetInvite | null {
  const mk = monthKey(today); for (const k of Object.keys(b.rolled)) if (k !== mk) delete b.rolled[k]; // 같은 달 재추첨 방지에만 쓰므로 지난달 기록은 정리
  const done = (b.rolled[mk] ??= []);
  if (done.includes(e.idx)) return null; done.push(e.idx);
  if (!e.contactable || hasOpen(b, e.idx)) return null;
  const wait = b.retryAfter[String(e.idx)]; if (wait && cmpDate(today, wait) < 0) return null;
  if (rng() >= inviteChance(e.score)) return null;
  const inv: ForeignBanquetInvite = { id: `fb:${b.sid}:${e.idx}:${today}`, sid: b.sid, empireIdx: e.idx, empireName: e.name, host: e.rulerPid, recipient: e.recipient, sentOn: today, replyBy: addMonths(today, FB.replyMonths), state: 'offered', reason: 'relations' };
  b.invites[inv.id] = inv; return inv;
}
export function acceptInvite(_b: ForeignBanquetBook, inv: ForeignBanquetInvite, today: string): boolean {
  if (inv.state !== 'offered') return false;
  inv.state = 'scheduled'; inv.acceptedOn = today; inv.visitOn = addMonths(today, FB.visitMonths); return true;
}
export function declineInvite(b: ForeignBanquetBook, inv: ForeignBanquetInvite, today: string): boolean {
  if (inv.state !== 'offered') return false;
  inv.state = 'declined'; inv.declinedOn = today; b.retryAfter[String(inv.empireIdx)] = addYears(today, FB.retryAfterDeclineYears); return true;
}
/** 날짜 갱신 때(43): 기한 지난 미응답은 만료(+1년), 수락한 초대는 만료시키지 않는다. 방문일이 되면 arrived. */
export function tickInvites(b: ForeignBanquetBook, today: string): { expired: ForeignBanquetInvite[]; arrived: ForeignBanquetInvite[] } {
  const expired: ForeignBanquetInvite[] = [], arrived: ForeignBanquetInvite[] = [];
  for (const inv of Object.values(b.invites)) {
    if (inv.state === 'offered' && cmpDate(today, inv.replyBy) > 0) { inv.state = 'expired'; inv.expiredOn = today; b.retryAfter[String(inv.empireIdx)] = addYears(today, FB.retryAfterDeclineYears); expired.push(inv); }
    else if (inv.state === 'scheduled' && inv.visitOn && cmpDate(today, inv.visitOn) >= 0) { inv.state = 'arrived'; arrived.push(inv); }
    else if (inv.state === 'arrived' && inv.visitOn && cmpDate(today, addMonths(inv.visitOn, FB.arrivedGraceMonths)) > 0) { inv.state = 'cancelled'; inv.cancelledOn = today; inv.cancelReason = 'missed'; b.retryAfter[String(inv.empireIdx)] = addYears(today, FB.retryAfterDeclineYears); expired.push(inv); } // 방문일을 놓침(05): 영원히 「도착」으로 남지 않게. 거절·만료와 같은 1년 대기
  }
  return { expired, arrived };
}
/** 접대 수준(43): 관계가 좋을수록 성대. 굴욕은 초대 뒤 관계가 크게 나빠졌거나 주최자가 의도적으로 무례할 때만(드문 예외). 확률은 자리값. */
export function hospitality(scoreNow: number, scoreAtInvite: number, hostRude: boolean, rng: () => number): 'grand' | 'plain' | 'humiliating' {
  if (hostRude || scoreNow < FB.rel.badBelow && scoreAtInvite - scoreNow >= 50) return 'humiliating';
  const t = Math.max(0, Math.min(1, (scoreNow - FB.rel.badBelow) / (FB.rel.goodAt - FB.rel.badBelow)));
  return rng() < 0.2 + 0.6 * t ? 'grand' : 'plain';
}
/** 통치자 교체(05): 전임 통치자가 받은 초대는 새 통치자에게 자동 승계하지 않는다 → 취소(주최국은 대기 없이 새 통치자를 다시 초대할 수 있다). 한 번만 알린다. */
export function onRulerChange(b: ForeignBanquetBook, newRuler: Pid, today = ''): ForeignBanquetInvite[] {
  const out: ForeignBanquetInvite[] = [];
  for (const inv of Object.values(b.invites)) if (inv.recipient !== newRuler && (inv.state === 'scheduled' || inv.state === 'accepted' || inv.state === 'arrived') && !inv.needsReconfirm) { inv.needsReconfirm = true; inv.state = 'cancelled'; inv.cancelledOn = today; inv.cancelReason = 'ruler_changed'; out.push(inv); }
  return out;
}
/** 직접 종료(44): 교류 기록을 한 번만 남기고 완료 → 그 제국 3년 대기. */
export function finishBanquet(b: ForeignBanquetBook, inv: ForeignBanquetInvite, today: string, record: NonNullable<ForeignBanquetInvite['record']>): boolean {
  if (inv.state !== 'arrived') return false;
  inv.state = 'completed'; inv.completedOn = today; inv.record = { met: [...new Set(record.met)], contacts: [...new Set(record.contacts)], gifts: [...record.gifts], promises: [...record.promises] };
  b.retryAfter[String(inv.empireIdx)] = addYears(today, FB.retryAfterDoneYears); return true;
}
/** 연락처 교환(44): 같은 인물은 한 번만, 지인(acquainted)부터. 친분·연애·기밀 접근은 주지 않는다. */
export function exchangeContact(inv: ForeignBanquetInvite, who: Pid): boolean {
  if (inv.state !== 'arrived') return false;
  inv.record ??= { met: [], contacts: [], gifts: [], promises: [] };
  if (inv.record.contacts.includes(who)) return false;
  inv.record.contacts.push(who); if (!inv.record.met.includes(who)) inv.record.met.push(who); return true;
}
