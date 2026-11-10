// 통치자 개인 금고(2026-10-30 사용자 결정, 계획: 1030_집컴_옮기기/00_새기능_계획.md 9번).
// - 게임의 에너지 크레딧을 금고에 넣어야만 백화점·펫샵·카지노·스포츠토토에서 쓸 수 있다(돈은 금고에서만 나감, 딴 돈은 금고로).
// - 금고 → 국고로 돌려놓을 수 있다. 한 번에 넣는 양에 상한 없음.
// - 에너지 월 수지가 적자일 때 넣으면 아주 낮은 확률로 「부패 낌새」가 쌓인다(흑자일 때 넣기·돌려놓기는 쌓이지 않음) → 궁정 「부패」 음모 후보 가중치.
// 순수 모듈: 게임 명령 문자열과 장부 계산만(전자·파일 없음). 화면은 침실(금고가 있는 곳)에서 붙인다.

export const VAULT = {
  /** 적자일 때 넣을 때마다 부패 낌새가 1 오를 확률(초기 조정값 — 「아주 낮은 확률로 서서히」). */
  suspicionChance: 0.04,
  suspicionMax: 10,
  /** 부패 낌새 1당 궁정 「부패」 음모 후보 가중치 증가(기본 1 → 낌새 10이면 3.5). */
  graftPerSuspicion: 0.25,
  /** 낌새가 저절로 옅어지는 간격(달). 흑자로 돌아서 오래 지나면 조금씩 잊힌다. */
  fadeMonths: 24,
  maxLog: 120,
  maxAmount: 1_000_000,
} as const;

export type VaultDir = 'in' | 'out';
export interface VaultEntry { d: string; k: 'in' | 'out' | 'spend' | 'earn'; amt: number; what?: string; def?: boolean }
export interface VaultPending { cid: string; dir: VaultDir; amt: number; since: string }
export interface VaultSave { bal: number; susp: number; suspAt?: string; log: VaultEntry[]; pending?: VaultPending | null }
export const emptyVault = (): VaultSave => ({ bal: 0, susp: 0, log: [], pending: null });

export function sanitizeVault(raw: unknown): VaultSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<VaultSave>;
  const n = (v: unknown, lo: number, hi: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo; };
  const log = Array.isArray(r.log) ? r.log.filter((e): e is VaultEntry => !!e && typeof e === 'object' && ['in', 'out', 'spend', 'earn'].includes(String((e as VaultEntry).k)) && Number.isFinite(Number((e as VaultEntry).amt))).slice(-VAULT.maxLog) : [];
  const p = r.pending && typeof r.pending === 'object' && /^[a-f0-9]{32}$/.test(String(r.pending.cid)) && (r.pending.dir === 'in' || r.pending.dir === 'out') ? { cid: String(r.pending.cid), dir: r.pending.dir, amt: n(r.pending.amt, 1, VAULT.maxAmount), since: String(r.pending.since ?? '') } : null;
  return { bal: n(r.bal, 0, 1e12), susp: n(r.susp, 0, VAULT.suspicionMax), ...(r.suspAt ? { suspAt: String(r.suspAt) } : {}), log, pending: p };
}

/** 금고 넣기·빼기 게임 명령. 같은 cid 는 한 번만(다시 보내도 duplicate). 회신: SLLM:VAULT req·sid·cid·dir·status(applied|short|duplicate)·def(넣을 때 에너지 월 수지 적자면 1). */
export function vaultCommand(req: number, sid: string, cid: string, dir: VaultDir, amt: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !/^[a-f0-9]{32}$/.test(cid) || (dir !== 'in' && dir !== 'out') || !Number.isSafeInteger(amt) || amt < 1 || amt > VAULT.maxAmount) throw new Error('INVALID_VAULT');
  const mark = `sllm_vlt_${cid}`;
  const log = (status: string, def = '0') => `log = "SLLM:VAULT/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/dir=${dir}/;/status=${status}/;/def=${def}"`;
  const done = (def: string) => `set_variable = { which = ${mark} value = 1 } add_resource = { energy = ${dir === 'in' ? -amt : amt} } ${log('applied', def)}`;
  const apply = dir === 'in'
    ? `if = { limit = { NOT = { resource_stockpile_compare = { resource = energy value >= ${amt} } } } ${log('short')} } else_if = { limit = { resource_income_compare = { resource = energy value < 0 } } ${done('1')} } else = { ${done('0')} }`
    : done('0');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { ${apply} } }`;
}

/** 게임 회신을 장부에 반영. 돌려줌: 금고에서 실제로 움직인 양, 이번에 부패 낌새가 올랐는지. */
export function applyVaultResult(v: VaultSave, p: VaultPending, status: string, deficit: boolean, date: string, rng: () => number): { moved: number; suspicion: boolean } {
  if (status !== 'applied' && status !== 'duplicate') return { moved: 0, suspicion: false };
  if (v.pending?.cid !== p.cid) return { moved: 0, suspicion: false }; // 이미 반영한 결정(중복 회신)
  v.pending = null;
  // duplicate = 게임은 예전에 이미 반영(앱이 회신을 놓쳤던 경우) → 장부도 맞춘다
  if (p.dir === 'in') v.bal += p.amt; else v.bal = Math.max(0, v.bal - p.amt);
  v.log.push({ d: date, k: p.dir, amt: p.amt, ...(p.dir === 'in' && deficit ? { def: true } : {}) }); v.log = v.log.slice(-VAULT.maxLog);
  let suspicion = false;
  if (p.dir === 'in' && deficit && status === 'applied' && v.susp < VAULT.suspicionMax && rng() < VAULT.suspicionChance) { v.susp += 1; v.suspAt = date; suspicion = true; }
  return { moved: p.amt, suspicion };
}
/** 금고에서 쓰기(백화점·펫샵·카지노 판돈·토토). 모자라면 false. */
export function vaultSpend(v: VaultSave, amt: number, what: string, date: string): boolean {
  if (!Number.isSafeInteger(amt) || amt < 1 || v.bal < amt) return false;
  v.bal -= amt; v.log.push({ d: date, k: 'spend', amt, what: what.slice(0, 80) }); v.log = v.log.slice(-VAULT.maxLog); return true;
}
/** 금고로 들어오기(카지노·토토 당첨). */
export function vaultEarn(v: VaultSave, amt: number, what: string, date: string): boolean {
  if (!Number.isSafeInteger(amt) || amt < 1) return false;
  v.bal += amt; v.log.push({ d: date, k: 'earn', amt, what: what.slice(0, 80) }); v.log = v.log.slice(-VAULT.maxLog); return true;
}
const monthsBetween = (a: string, b: string): number => { const m = /^(\d+)\.(\d+)/.exec(a), n = /^(\d+)\.(\d+)/.exec(b); return m && n ? (Number(n[1]) - Number(m[1])) * 12 + (Number(n[2]) - Number(m[2])) : 0; };
/** 매달: 마지막으로 낌새가 오른 뒤 fadeMonths 가 지나면 1씩 옅어진다. */
export function fadeSuspicion(v: VaultSave, today: string): boolean {
  if (v.susp <= 0 || !v.suspAt || monthsBetween(v.suspAt, today) < VAULT.fadeMonths) return false;
  v.susp -= 1; v.suspAt = today; return true;
}
/** 궁정 「부패」 음모 후보 가중치(기본 1). */
export const graftWeight = (susp: number): number => 1 + Math.max(0, Math.min(VAULT.suspicionMax, susp)) * VAULT.graftPerSuspicion;
