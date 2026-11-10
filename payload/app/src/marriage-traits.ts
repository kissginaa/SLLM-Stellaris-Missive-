// NPC 지도자 부부의 결혼·사별 특성(2026-10-23 사용자 확정). 앱: src/features/relations-app.ts(syncMarriage), 모드: tester-mod/common/traits/sllm_marriage_traits.txt.
// 사용자 확정: NPC 둘이 결혼하면 둘 다 「결혼함」 특성 + 자기 직업에 맞는 버프 +10% / 둘 중 한 명이 죽으면 남은 사람에게 부정적 특성 2개.
// 이번 초안(자리값): 부정 특성 = 「사별의 슬픔」(직업 효과 −10%) + 「상실감」(지도자 경험치 획득 −25%), 기간 없음(영구). 이혼·결별이면 「결혼함」만 뗀다.
// 통치자 본인의 결혼은 이 규칙에 넣지 않는다(청혼 흐름 wedding.ts·romance-app). 명령은 sllm_lid 로 지도자를 찾고, 같은 요청 키는 한 번만 적용한다.
import type { LeaderClass } from './discontent';
import type { Pid, PairRelation, RelationLedger } from './relations';

export const CLASSES: LeaderClass[] = ['commander', 'official', 'scientist'];
export const MARRIED_TRAIT: Record<LeaderClass, string> = { commander: 'sllm_trait_married_commander', official: 'sllm_trait_married_official', scientist: 'sllm_trait_married_scientist' };
export const GRIEF_TRAIT: Record<LeaderClass, string> = { commander: 'sllm_trait_widowed_grief_commander', official: 'sllm_trait_widowed_grief_official', scientist: 'sllm_trait_widowed_grief_scientist' };
export const HEARTBROKEN_TRAIT = 'sllm_trait_widowed_heartbroken';
export const MARRIAGE_EFFECT: Record<LeaderClass, { ko: string; en: string }> = {
  commander: { ko: '지휘하는 함대·지상군 피해 +10%', en: 'Fleet and army damage +10%' },
  official: { ko: '맡은 행성의 직업 산출 +10%', en: 'Job output on the governed planet +10%' },
  scientist: { ko: '탐사·이상 현상 조사 속도 +10%, 평의회에 있으면 연구 속도 +10%', en: 'Survey and anomaly speed +10%; research speed +10% while on the council' },
};

/** 앱이 바라는 특성 상태(사람마다). game: 게임에 보냈는지. */
export type MarriageWant = 'married' | 'widowed' | 'none';
export interface MarriageMark { pid: Pid; want: MarriageWant; since: string; partner?: Pid; game: 'pending' | 'applied' | 'unknown' }
export const isLeaderClass = (c: unknown): c is LeaderClass => CLASSES.includes(c as LeaderClass);

/** 바라는 상태 → 붙일 특성·뗄 특성. 결혼·사별 특성은 직업이 바뀌어도 남지 않게 세 직업 것을 모두 뗀 뒤 붙인다. */
export function traitPlan(cls: LeaderClass, want: MarriageWant): { add: string[]; remove: string[] } {
  const allMarried = CLASSES.map((c) => MARRIED_TRAIT[c]);
  if (want === 'married') return { add: [MARRIED_TRAIT[cls]], remove: allMarried.filter((t) => t !== MARRIED_TRAIT[cls]) };
  if (want === 'widowed') return { add: [GRIEF_TRAIT[cls], HEARTBROKEN_TRAIT], remove: allMarried };
  return { add: [], remove: allMarried };
}
const okArgs = (req: number, sid: string, lid: number) => Number.isInteger(req) && req > 0 && /^\d{1,12}$/.test(sid) && Number.isInteger(lid) && lid >= 0;
/** 게임 명령(콘솔 effect). 회신: SLLM:MARRYTRAIT req·lid·want·status(applied|duplicate|no_target). */
export function marriageTraitCommand(req: number, sid: string, lid: number, cls: LeaderClass, want: MarriageWant, reqKey: string): string {
  if (!okArgs(req, sid, lid) || !/^[a-z0-9_]{1,40}$/.test(reqKey) || !isLeaderClass(cls)) throw new Error('결혼 특성 명령 인자가 올바르지 않습니다.');
  const plan = traitPlan(cls, want), mark = `sllm_mt_${reqKey}`;
  const log = (s: string) => `log = "SLLM:MARRYTRAIT/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/want=${want}/;/status=${s}"`;
  const act = [...plan.remove.map((t) => `if = { limit = { has_trait = ${t} } remove_trait = ${t} }`), ...plan.add.map((t) => `if = { limit = { NOT = { has_trait = ${t} } } add_trait = ${t} }`)].join(' ') + ' ' + log('applied');
  const body = `if = { limit = { prev = { is_variable_set = ${mark} } } ${log('duplicate')} } else = { prev = { set_variable = { which = ${mark} value = 1 } } ${act} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_mt_found value = 0 } every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${lid} } } prev = { set_variable = { which = sllm_mt_found value = 1 } } set_variable = { which = sllm_tr_m value = 12 } ${body} } if = { limit = { check_variable = { which = sllm_mt_found value = 0 } } ${log('no_target')} } clear_variable = sllm_mt_found }`;
}
export function parseMarriageTraitReply(kv: Record<string, string>): { req: number; lid: number; want: MarriageWant; status: 'applied' | 'duplicate' | 'no_target' } | null {
  const req = Number(kv.req), lid = Number(kv.lid), want = kv.want as MarriageWant, status = kv.status;
  if (!Number.isInteger(req) || !Number.isInteger(lid) || !['married', 'widowed', 'none'].includes(want) || !['applied', 'duplicate', 'no_target'].includes(status)) return null;
  return { req, lid, want, status: status as 'applied' | 'duplicate' | 'no_target' };
}

/** NPC 부부인가(통치자 본인이 낀 쌍은 제외). */
export const npcCouple = (r: PairRelation, rulerPid: Pid): boolean => r.a !== rulerPid && r.b !== rulerPid;
/** 결혼 완료 → 두 사람 모두 「결혼함」. */
export function markMarried(marks: Record<Pid, MarriageMark>, r: PairRelation, today: string): void {
  for (const [p, q] of [[r.a, r.b], [r.b, r.a]] as const) marks[p] = { pid: p, want: 'married', since: today, partner: q, game: 'pending' };
}
/** 한쪽 사망(28·사용자 확정): 혼인을 사별로 끝내고 남은 사람에게 사별 특성. 이미 끝난 관계·통치자 부부는 건드리지 않는다. 남은 사람 pid 를 돌려준다. */
export function markBereaved(ledger: RelationLedger, marks: Record<Pid, MarriageMark>, dead: Pid, rulerPid: Pid, today: string): Pid | null {
  const r = Object.values(ledger.pairs).find((x) => x.romance === 'married' && (x.a === dead || x.b === dead));
  delete marks[dead];
  if (!r || !npcCouple(r, rulerPid)) return null;
  const survivor = r.a === dead ? r.b : r.a;
  r.romance = 'ended'; r.endedOn = today; r.revision++; r.evidence.push(`bereaved:${today}`);
  marks[survivor] = { pid: survivor, want: 'widowed', since: today, partner: dead, game: 'pending' };
  return survivor;
}
/** 결별·이혼으로 끝난 부부: 「결혼함」만 뗀다(사별 특성 없음). */
export function markSeparated(marks: Record<Pid, MarriageMark>, a: Pid, b: Pid, today: string): void {
  for (const p of [a, b]) if (marks[p]?.want === 'married') marks[p] = { pid: p, want: 'none', since: today, game: 'pending' };
}
export function sanitizeMarks(v: unknown): Record<Pid, MarriageMark> {
  const out: Record<Pid, MarriageMark> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, m] of Object.entries(v as Record<string, Partial<MarriageMark>>)) if (/^p:\d{1,12}$/.test(k) && m && ['married', 'widowed', 'none'].includes(String(m.want)) && ['pending', 'applied', 'unknown'].includes(String(m.game))) out[k] = { pid: k, want: m.want as MarriageWant, since: String(m.since ?? ''), ...(typeof m.partner === 'string' ? { partner: m.partner } : {}), game: m.game as MarriageMark['game'] };
  return out;
}
