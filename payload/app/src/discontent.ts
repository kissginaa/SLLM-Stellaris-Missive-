// 인간관계 불만 특성(32·33·35·36)의 게임 연결과 갈등 생성 규칙. 2026-10-23 Claude 사전 설계.
// 게임 자료 근거(집 PC 게임 폴더에서 확인한 것):
//  - 지도자 특성은 모드 common/traits 에 정의하고 add_trait / remove_trait 로 붙였다 뗀다(sllm_admiral_traits.txt 의 질책 특성이 이미 fleet_modifier ship_weapon_damage = -0.05 로 작동 중).
//  - 지도자는 sllm_lid 변수로 찾는다: every_owned_leader = { limit = { check_variable = { which = sllm_lid value = N } } … } (letters.ts favorCommand 와 같은 틀).
//  - 지도자 클래스는 commander / official / scientist 세 가지(4.x). 특성의 leader_class 로 어느 클래스에 붙는지 정한다.
// 함대 지휘관 -5% 는 사용자 확정. 관료(총독)·과학자의 -5% 키는 아래 제안값이며 게임 정의(common/traits/00_*_traits.txt) 대조가 필요하다.
import type { Pid, Conflict, RelationLedger } from './relations';
import { pairKey } from './relations';

export type LeaderClass = 'commander' | 'official' | 'scientist';
/** 클래스별 특성 키(mod/common/traits/sllm_relation_traits.txt). */
export const DISCONTENT_TRAIT: Record<LeaderClass, string> = {
  commander: 'sllm_trait_rel_discontent_commander',
  official: 'sllm_trait_rel_discontent_official',
  scientist: 'sllm_trait_rel_discontent_scientist',
};
/** 화면용 효과 설명(33): 직책별 적용 범위. 검증 전 클래스는 「검증 대기」로 보인다. */
export const DISCONTENT_EFFECT: Record<LeaderClass, { ko: string; en: string; verified: boolean }> = {
  commander: { ko: '지휘 함대·지상군 피해 −5%', en: 'Commanded fleet and army damage −5%', verified: true },
  official: { ko: '맡은 행성 직업 산출 −5% (게임 검증 대기)', en: 'Governed planet job output −5% (pending game check)', verified: false },
  scientist: { ko: '탐사·이상 현상 조사 속도 −5%, 평의회에 있으면 연구 속도 −5% (게임 검증 대기)', en: 'Survey and anomaly research speed −5%, research speed −5% on the council (pending game check)', verified: false },
};

const okArgs = (req: number, sid: string, lid: number) => Number.isSafeInteger(req) && req >= 1 && /^\d+$/.test(sid) && Number.isSafeInteger(lid) && lid >= 1;
/** 특성 붙이기/떼기 명령. 같은 요청(reqKey)은 한 번만 — 국가 변수 표식. THIS = 그 인물, PREV = 플레이어 국가. */
export function discontentCommand(req: number, sid: string, lid: number, cls: LeaderClass, add: boolean, reqKey: string): string {
  if (!okArgs(req, sid, lid) || !/^[a-z0-9_]{1,40}$/.test(reqKey)) throw new Error('불만 특성 명령 인자가 올바르지 않습니다.');
  const trait = DISCONTENT_TRAIT[cls], mark = `sllm_disc_${reqKey}`;
  const log = (s: string) => `log = "SLLM:DISCONTENT/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/op=${add ? 'add' : 'remove'}/;/status=${s}"`;
  const act = add
    ? `if = { limit = { NOT = { has_trait = ${trait} } } add_trait = ${trait} } ${log('applied')}`
    : `if = { limit = { has_trait = ${trait} } remove_trait = ${trait} } ${log('applied')}`;
  const body = `if = { limit = { prev = { is_variable_set = ${mark} } } ${log('duplicate')} } else = { prev = { set_variable = { which = ${mark} value = 1 } } ${act} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_disc_found value = 0 } every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${lid} } } prev = { set_variable = { which = sllm_disc_found value = 1 } } set_variable = { which = sllm_tr_m value = 12 } ${body} } if = { limit = { check_variable = { which = sllm_disc_found value = 0 } } ${log('no_target')} } clear_variable = sllm_disc_found }`;
}
/** 모드 회신 한 줄 → 상태. */
export function parseDiscontentReply(kv: Record<string, string>): { req: number; lid: number; op: 'add' | 'remove'; status: 'applied' | 'duplicate' | 'no_target' } | null {
  const req = Number(kv.req), lid = Number(kv.lid), op = kv.op, status = kv.status;
  if (!Number.isInteger(req) || !Number.isInteger(lid) || (op !== 'add' && op !== 'remove') || !['applied', 'duplicate', 'no_target'].includes(status)) return null;
  return { req, lid, op, status: status as 'applied' | 'duplicate' | 'no_target' };
}

/** 공적 인정 누락(35): 확인된 공동 기여 사건에서 한 사람만 인정받았을 때, 빠진 기여자를 후보로. 근거 없는 사건은 제외. 발생 확률은 미정이라 p 로 받는다. */
export function creditOmissionConflicts(ledger: RelationLedger, ev: { id: string; contributors: Pid[]; recognized: Pid[]; decidedBy: Pid; date: string }, p: number, rng: () => number): Conflict[] {
  if (ev.contributors.length < 2 || !ev.recognized.length) return [];
  const out: Conflict[] = [];
  for (const who of ev.contributors) {
    if (ev.recognized.includes(who)) continue;
    const id = `cr:${ev.id}:${who}`; if (ledger.conflicts[id]) continue; // 같은 인정 사건 재조회로 다시 뽑지 않는다
    if (rng() >= p) continue;
    // 책임 대상은 인정을 결정한 사람(통치자). 칭찬받은 동료의 잘못으로 자동 기록하지 않는다(35).
    const c: Conflict = { id, sid: ledger.sid, kind: 'credit', a: who, b: ev.decidedBy, createdOn: ev.date, cause: { contribution: ev.id, recognized: ev.recognized.join(',') }, visibility: 'player', reconcileTried: [] };
    ledger.conflicts[id] = c; out.push(c);
  }
  return out;
}
/** 정책·배분 갈등(36): 양립 불가(exclusive)인 두 요청 중 한쪽만 지원했을 때, 탈락한 요청자 → 결정자 불만 후보. 단순히 다른 행성이 지원받은 것만으로는 만들지 않는다. */
export function allocationConflict(ledger: RelationLedger, d: { decisionId: string; exclusive: boolean; chosen: { requester: Pid; reqId: string }; rejected: { requester: Pid; reqId: string }; decidedBy: Pid; date: string; obstructedBy?: Pid }, p: number, rng: () => number): Conflict[] {
  if (!d.exclusive) return [];
  const out: Conflict[] = [];
  const id = `al:${d.decisionId}`; if (!ledger.conflicts[id] && rng() < p) {
    const c: Conflict = { id, sid: ledger.sid, kind: 'policy', a: d.rejected.requester, b: d.decidedBy, createdOn: d.date, cause: { chosen: d.chosen.reqId, rejected: d.rejected.reqId }, visibility: 'player', reconcileTried: [] };
    ledger.conflicts[id] = c; out.push(c);
  }
  // 상대 총독이 공개적으로 방해한 실제 사건이 있을 때만 두 총독 사이 갈등(36).
  if (d.obstructedBy && d.obstructedBy === d.chosen.requester) {
    const id2 = `al:${d.decisionId}:obstruct`;
    if (!ledger.conflicts[id2]) { const c2: Conflict = { id: id2, sid: ledger.sid, kind: 'policy', a: d.rejected.requester, b: d.chosen.requester, createdOn: d.date, cause: { obstruction: d.decisionId }, visibility: 'player', reconcileTried: [] }; ledger.conflicts[id2] = c2; out.push(c2); }
  }
  return out;
}
/** 연락처 「인간관계」 칸(33): 플레이어가 아는 것만. */
export function relationCard(ledger: RelationLedger, pid: Pid, rulerPid: Pid, names: Record<Pid, string>, cls?: LeaderClass): { friends: Pid[]; rivals: Pid[]; partner?: Pid; conflicts: Conflict[]; discontent?: { since: string; effect: string; causes: Conflict[]; game: string } } {
  const nm = (p: Pid) => names[p] ?? p; void nm;
  const friends: Pid[] = [], rivals: Pid[] = []; let partner: Pid | undefined;
  for (const r of Object.values(ledger.pairs)) {
    if (r.a !== pid && r.b !== pid) continue; const other = r.a === pid ? r.b : r.a;
    const vis = r.a === rulerPid || r.b === rulerPid || r.visibility === 'public' || r.visibility === 'player' || ledger.playerKnows.pairs.includes(r.key);
    if (!vis) continue;
    if (r.friend === 'friendly' || r.friend === 'close') friends.push(other);
    if (r.rival !== 'none') rivals.push(other);
    if ((r.romance === 'dating' || r.romance === 'engaged' || r.romance === 'married') && (r.a === rulerPid || r.b === rulerPid || r.visibility === 'public' || r.visibility === 'player')) partner = other; // 33·39: 소개로 알게 된 사이라도 비공개 교제는 보이지 않는다
  }
  const conflicts = Object.values(ledger.conflicts).filter((c) => !c.resolved && (c.a === pid || c.b === pid) && (c.a === rulerPid || c.b === rulerPid || c.visibility === 'public' || c.visibility === 'player' || ledger.playerKnows.conflicts.includes(c.id)));
  const d = ledger.discontent[pid];
  const discontent = d && d.game !== 'cleared' ? { since: d.since, effect: cls ? (DISCONTENT_EFFECT[cls].verified ? DISCONTENT_EFFECT[cls].ko : DISCONTENT_EFFECT[cls].ko) : '', causes: d.causes.map((id) => ledger.conflicts[id]).filter((c): c is Conflict => !!c && conflicts.includes(c)), game: d.game } : undefined;
  return { friends, rivals, ...(partner ? { partner } : {}), conflicts, ...(discontent ? { discontent } : {}) };
}
/** 두 사람 중재 진입 가능?(33) 둘 사이 미해결 갈등이 있고 플레이어가 그 갈등을 알 때. */
export function canMediate(ledger: RelationLedger, a: Pid, b: Pid, rulerPid: Pid): Conflict | null {
  const k = pairKey(a, b);
  return Object.values(ledger.conflicts).find((c) => !c.resolved && pairKey(c.a, c.b) === k && (c.a === rulerPid || c.b === rulerPid || c.visibility !== 'hidden' && c.visibility !== 'parties' || ledger.playerKnows.conflicts.includes(c.id))) ?? null;
}
