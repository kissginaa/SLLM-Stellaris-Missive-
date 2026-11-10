// 처형(06 최신 확정)의 사건·인지·반응 규칙. 명령 문자열은 session-machines.ts executionCommand. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 대상 = 우리 제국 현직 지도자만(타국·은퇴·비서 제외, 통치자 자신은 미정 → 초기에는 막는다) /
//   사유 = 반역·부패·책임·기타(직접 작성), 사유는 혐의 분류일 뿐 입증 아님 / 공개·비공개 선택 /
//   실제로 아는 인물만 지지·유보·반발 판정(앱), 감정은 별도 표현 / 반발만으로 반란·해임·수치 효과를 자동 실행하지 않는다.
// 정확한 가중치·수치는 미정 → 아래 STANCE_W 는 자리값.
import { L } from './i18n-pick';
import { pairKey, type Pid, type RelationLedger } from './relations';

export type ExecReason = 'treason' | 'corruption' | 'responsibility' | 'other';
export const reasonLabel = (r: ExecReason): string => ({ treason: L('반역·반란 가담', 'Treason or rebellion'), corruption: L('부패·직권남용', 'Corruption or abuse of power'), responsibility: L('군사·행정적 책임', 'Military or administrative failure'), other: L('기타', 'Other') })[r];

export interface ExecutionCase {
  id: string; sid: string; target: Pid; targetName: string; rulerPid: Pid;
  reason: ExecReason; note: string;
  /** 플레이어가 고른 사유·설명은 늘 「플레이어 주장」. 근거 사건이 있으면 ID 로만 연결. */
  noteSource: 'player'; evidenceEventIds: string[];
  publicity: 'public' | 'private';
  state: 'preparing' | 'requested' | 'applied' | 'outcome_unknown' | 'rejected' | 'cancelled';
  requestId?: string; appliedOn?: string;
  /** 앎 기록: 사망 사실만 아는 것과 처형 진상을 아는 것을 나눈다. */
  knows: Record<Pid, { level: 'death_only' | 'execution'; since: string; via: 'announcement' | 'present' | 'disclosure' | 'player' }>;
  /** 비공개 처형이 나중에 알려진 사건(정보 공개 사건). */
  disclosures: { id: string; on: string; to: Pid[] }[];
  reactions: Record<Pid, Reaction[]>;
}
export interface Reaction { stance: 'support' | 'reserve' | 'oppose'; emotion: 'grief' | 'anxiety' | 'relief' | 'anger' | 'none'; basis: string[]; on: string; knowledgeRev: number }

/** 후보 자격(06): 실행 직전에도 같은 검사. 명단 누락·연락 불가는 사망으로 추정하지 않는다 → 'unknown' 이면 막는다. */
export function executionEligible(t: { pid: Pid; ownEmpire: boolean; status: 'active' | 'retired' | 'dead' | 'unknown'; isRuler: boolean; isSecretary: boolean }): { ok: boolean; why?: string } {
  if (t.isSecretary || t.pid === 'sec') return { ok: false, why: L('비서는 처형 대상이 아닙니다.', 'The secretary cannot be executed.') };
  if (!t.ownEmpire || t.pid.startsWith('f:')) return { ok: false, why: L('우리 제국 지도자만 대상입니다.', 'Only leaders of your own empire can be targeted.') };
  if (t.isRuler) return { ok: false, why: L('통치자 자신은 아직 대상이 아닙니다.', 'The ruler cannot be targeted yet.') };
  if (t.status !== 'active') return { ok: false, why: t.status === 'unknown' ? L('현직 여부를 확인할 수 없습니다.', 'Cannot confirm the leader is in office.') : L('현직 지도자가 아닙니다.', 'Not a current leader.') };
  return { ok: true };
}
export function newCase(id: string, sid: string, target: Pid, targetName: string, rulerPid: Pid, reason: ExecReason, note: string, publicity: 'public' | 'private', evidenceEventIds: string[]): ExecutionCase | { error: string } {
  const n = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (reason === 'other' && !n) return { error: L('기타 사유는 직접 적어 주세요.', 'Describe the reason for "Other".') };
  return { id, sid, target, targetName, rulerPid, reason, note: n, noteSource: 'player', evidenceEventIds: [...new Set(evidenceEventIds)], publicity, state: 'preparing', knows: {}, disclosures: [], reactions: {} };
}
/** 최종 확인 문구(06): 이름·사유·근거 상태·공개 방식·되돌릴 수 없음. */
export function finalConfirmText(c: ExecutionCase): string {
  const ev = c.evidenceEventIds.length ? L(`확인된 근거 ${c.evidenceEventIds.length}건`, `${c.evidenceEventIds.length} confirmed record(s)`) : L('확인된 근거 없음(플레이어 주장)', 'No confirmed record (your claim)');
  const pub = c.publicity === 'public' ? L('공개 처형 — 사유를 공식 발표합니다', 'Public — the reason will be announced') : L('비공개 처형 — 공식 발표 없음', 'Private — no announcement');
  return L(`${c.targetName} 처형\n사유: ${reasonLabel(c.reason)}${c.note ? ` — ${c.note}` : ''}\n근거: ${ev}\n방식: ${pub}\n게임에서 이 지도자가 제거되며 되돌릴 수 없습니다.`,
    `Execute ${c.targetName}\nReason: ${reasonLabel(c.reason)}${c.note ? ` — ${c.note}` : ''}\nEvidence: ${ev}\nMethod: ${pub}\nThe leader will be removed from the game. This cannot be undone.`);
}
/** 게임 결과(06): applied 확인 전에는 발표·기사·반응을 만들지 않는다. LEADEROUT why=death 는 같은 사건으로 묶는다. */
export function settleCase(c: ExecutionCase, status: 'applied' | 'rejected' | 'outcome_unknown' | 'no_target', today: string): boolean {
  if (c.state !== 'requested' && c.state !== 'outcome_unknown') return false;
  if (status === 'applied') { c.state = 'applied'; c.appliedOn = today; } else if (status === 'outcome_unknown') c.state = 'outcome_unknown'; else c.state = 'rejected';
  return true;
}
/** LEADEROUT why=death 가 처형 대상에게 왔고 처형 요청이 진행 중이면 처형 사건의 결과로 본다(추모·사망 알림과 중복 금지). */
export const deathBelongsToCase = (c: ExecutionCase, lidPid: Pid): boolean => c.target === lidPid && (c.state === 'requested' || c.state === 'outcome_unknown' || c.state === 'applied');

/** 앎 퍼뜨리기(06): 공개면 announced 대상(앱이 매체 전달 범위로 고른 사람)이 「처형」을 안다. 비공개면 present(현장·결정에 관여한 사람)만.
 *  그 밖에 사망 사실만 아는 사람은 death_only — 진상 반응을 만들지 않는다. 이미 더 많이 알면 낮추지 않는다. */
export function spreadKnowledge(c: ExecutionCase, today: string, who: { announced?: Pid[]; present?: Pid[]; deathOnly?: Pid[] }): Pid[] {
  if (c.state !== 'applied') return [];
  const changed: Pid[] = [];
  const set = (p: Pid, level: 'death_only' | 'execution', via: 'announcement' | 'present' | 'disclosure' | 'player') => {
    if (p === c.target || p === c.rulerPid) return; const cur = c.knows[p];
    if (cur && (cur.level === 'execution' || level === 'death_only')) return;
    c.knows[p] = { level, since: today, via }; changed.push(p);
  };
  if (c.publicity === 'public') for (const p of who.announced ?? []) set(p, 'execution', 'announcement');
  for (const p of who.present ?? []) set(p, 'execution', 'present');
  for (const p of who.deathOnly ?? []) set(p, 'death_only', 'player');
  return changed;
}
/** 비공개 처형이 나중에 알려짐(06): 정보 공개 사건으로 남긴다. 유출 확률은 없음(후속 결정). */
export function disclose(c: ExecutionCase, id: string, today: string, to: Pid[]): Pid[] {
  if (c.disclosures.some((d) => d.id === id)) return [];
  c.disclosures.push({ id, on: today, to: [...to] });
  const changed: Pid[] = [];
  for (const p of to) { if (p === c.target || p === c.rulerPid || c.knows[p]?.level === 'execution') continue; c.knows[p] = { level: 'execution', since: today, via: 'disclosure' }; changed.push(p); }
  return changed;
}

/** 자리값 가중치(06: 「정확한 가중치 미정」). 양수 = 지지 쪽. */
export const STANCE_W = { evidence: 1, noEvidence: -1, spouseOrLover: -3, friend: -1.5, rival: 1, sameFaction: -1, loyalty: 1 } as const;
/** 지지·유보·반발 판정(06): 실제로 「처형」을 아는 인물만. 관계·성향·근거를 함께. 같은 인지 수준에서는 다시 판정하지 않는다(기록 보존·수치 중복 없음). */
export function judgeReaction(c: ExecutionCase, led: RelationLedger, who: Pid, ctx: { sameFaction: boolean; loyalty: -1 | 0 | 1; knowsEvidence: boolean }, today: string, rng: () => number): Reaction | null {
  const k = c.knows[who]; if (!k || k.level !== 'execution' || c.state !== 'applied') return null;
  const rev = c.disclosures.length + (ctx.knowsEvidence ? 1 : 0);
  const hist = (c.reactions[who] ??= []); if (hist.length && hist[hist.length - 1].knowledgeRev === rev) return null;
  const r = led.pairs[pairKey(who, c.target)];
  const basis: string[] = []; let s = 0;
  if (ctx.knowsEvidence && c.evidenceEventIds.length) { s += STANCE_W.evidence; basis.push('evidence'); } else { s += STANCE_W.noEvidence; basis.push('no_evidence'); }
  const lover = !!r && ['interest', 'dating', 'engaged', 'married'].includes(r.romance);
  if (lover) { s += STANCE_W.spouseOrLover; basis.push('partner'); }
  else if (r && (r.friend === 'friendly' || r.friend === 'close')) { s += STANCE_W.friend; basis.push('friend'); }
  if (r && r.rival !== 'none') { s += STANCE_W.rival; basis.push('rival'); }
  if (ctx.sameFaction) { s += STANCE_W.sameFaction; basis.push('faction'); }
  if (ctx.loyalty) { s += STANCE_W.loyalty * ctx.loyalty; basis.push(ctx.loyalty > 0 ? 'loyal' : 'disloyal'); }
  // 관계만으로 고정하지 않는다: ±0.5 흔들림.
  s += rng() - 0.5;
  const stance: Reaction['stance'] = s >= 0.75 ? 'support' : s <= -0.75 ? 'oppose' : 'reserve';
  const emotion: Reaction['emotion'] = lover ? 'grief' : basis.includes('rival') && stance !== 'oppose' ? 'relief' : stance === 'oppose' ? (basis.includes('friend') ? 'anger' : 'anxiety') : basis.includes('no_evidence') ? 'anxiety' : 'none';
  const out: Reaction = { stance, emotion, basis, on: today, knowledgeRev: rev }; hist.push(out); return out;
}
export const stanceLabel = (s: Reaction['stance']): string => ({ support: L('지지', 'Support'), reserve: L('유보', 'Reserved'), oppose: L('반발', 'Oppose') })[s];
/** AI 에 줄 맥락(06): 그 인물이 아는 것만. death_only 면 진상·사유를 넣지 않는다. */
export function reactionContext(c: ExecutionCase, who: Pid): { knowsExecution: boolean; reason?: string; claimed?: boolean; publicity?: string } {
  const k = c.knows[who]; if (!k || k.level !== 'execution') return { knowsExecution: false };
  return { knowsExecution: true, reason: reasonLabel(c.reason) + (c.note && (c.publicity === 'public' || k.via !== 'announcement') ? ` — ${c.note}` : ''), claimed: !c.evidenceEventIds.length, publicity: c.publicity };
}
