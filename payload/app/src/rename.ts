// 이름의 정치(2026-11-04 사용자): 굴욕 조항 「개명 요구」·「이름 반환」(외교 거래), AI 가 우리에게 거는 개명 요구, 종속국 개명 칙령.
// 순수 규칙 — 앱 장부: src/features/rename-ledger.ts · 외교 거래: src/deals.ts·features/deals-app.ts · 종속국: features/vassal-app.ts
// 바꾸는 것은 수도 행성(cap) 또는 수도 성계(sys) 둘 중 하나. 바꾸기 전 이름을 게임이 먼저 알려 주고(RENAMEOLD), 앱이 장부에 남겨 나중에 돌려줄 수 있다.

export type RenameWhat = 'cap' | 'sys';
export type RenameBy = 'deal' | 'vassal' | 'demand';
/** 장부 한 줄: 누가(by) 어느 제국(tid, 0 = 우리)의 무엇을 old → name 으로. restored = 돌려준 날. */
export interface RenameRec { id: string; tid: number; empire: string; what: RenameWhat; old: string; name: string; date: string; by: RenameBy; restored?: string }
export const RENAME = { nameMax: 40, keep: 200 } as const;
export const isWhat = (v: unknown): v is RenameWhat => v === 'cap' || v === 'sys';

/** 게임에 보낼 이름 다듬기(따옴표·괄호·게임 서식 문자·줄바꿈 제거). 비면 null. */
export function cleanGameName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\r\n\t]+/g, ' ').replace(/["\\§£$\[\]{}<>|/;=#]/g, '').replace(/\s+/g, ' ').trim().slice(0, RENAME.nameMax).trim();
  return s ? s : null;
}

/** 대상: foreign = 일반 AI 제국(제국 번호), subject = 우리 종속국(제국 번호), self = 우리 제국. */
export type RenameTarget = { kind: 'foreign'; tid: number } | { kind: 'subject'; tid: number } | { kind: 'self' };
/** 게임 명령: 바꾸기 전 이름을 RENAMEOLD 로 알리고 이름을 바꾼 뒤 RENAME(status=applied | target). */
export function renameCommand(req: number, sid: string, t: RenameTarget, what: RenameWhat, name: string): string {
  const v = cleanGameName(name);
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !isWhat(what) || !v) throw new Error('INVALID_RENAME');
  if (t.kind !== 'self' && (!Number.isSafeInteger(t.tid) || t.tid < 1)) throw new Error('INVALID_RENAME');
  const tag = `req=${req}/;/sid=${sid}/;/what=${what}`;
  const body = (what === 'cap' ? 'capital_scope = { ' : 'capital_scope = { solar_system = { ')
    + `log = "SLLM:RENAMEOLD/;/${tag}/;/old=\\\\[This.GetName]" set_name = "${v}" event_target:sllm_rn_p = { set_variable = { which = sllm_rn_ok value = 1 } } `
    + (what === 'cap' ? '}' : '} }');
  const find = t.kind === 'self' ? body
    : t.kind === 'subject' ? `every_subject = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${t.tid} } } ${body} }`
    : `random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${t.tid} } sllm_is_empire = yes is_ai = yes } ${body} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } save_event_target_as = sllm_rn_p set_variable = { which = sllm_rn_ok value = 0 } ${find} `
    + `if = { limit = { check_variable = { which = sllm_rn_ok value = 1 } } log = "SLLM:RENAME/;/${tag}/;/status=applied" } else = { log = "SLLM:RENAME/;/${tag}/;/status=target" } clear_variable = sllm_rn_ok }`;
}

/** 그 제국에게서 빼앗은 이름 가운데 아직 돌려주지 않은 것(최근 것부터). */
export const restorable = (recs: RenameRec[], tid: number): RenameRec[] => recs.filter((r) => r.tid === tid && r.by !== 'demand' && !r.restored && r.old).slice().reverse();
/** 같은 자리(제국·무엇)에 아직 돌려주지 않은 개명이 있으면 원래 이름은 그 첫 기록의 old(두 번 바꿔도 처음 이름을 돌려준다). */
export function originalName(recs: RenameRec[], tid: number, what: RenameWhat, old: string): string {
  const first = recs.find((r) => r.tid === tid && r.what === what && !r.restored);
  return first ? first.old : old;
}
export const whatText = (w: RenameWhat, L: (ko: string, en: string) => string): string => (w === 'cap' ? L('수도 행성', 'capital world') : L('수도 성계', 'capital system'));
