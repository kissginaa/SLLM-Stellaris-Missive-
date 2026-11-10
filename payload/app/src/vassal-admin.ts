// 종속국 행정(2026-11-04 사용자: 다른 모드 「Subject Administration」에서 1·2·3 채용) — 순수 규칙. 앱: src/features/vassal-admin-app.ts · 화면: ui/vassal-admin.js · 모드: common/scripted_effects/sllm_vassal_admin.txt
// ① 성계 이양: 종속국 성계를 가져오거나 우리 성계를 준다(국경이 붙지 않아도 됨). 영향력 25 + 식민지당 50. 가져오면 자치도 +10(반감), 주면 자치도 -6(감사).
//    수도가 있는 성계·점령당한 행성이 있는 성계는 안 됨. 같은 성계는 5년에 한 번. 평화 때만(종속국). 외교 거래 「성계 할양」도 같은 게임 명령(수수료 없음).
// ② 기술 원조: 영향력 100 → 우리 월 연구량 6달 치를 종속국 연구에 보탠다(모든 기술을 통째로 주는 대신 — 게임에 「기술 목록을 훑는」 명령이 없음). 자치도 -8. 종속국마다 3년에 한 번.
// ③ 동화 정책: 영향력 50으로 시작. 종속국 인구가 우리 윤리에 끌리고(+100%) 반대 윤리는 덜 끌린다(-75%). 5년마다 종속국 정부 윤리가 우리 쪽으로 한 걸음.
//    하는 동안 해마다 자치도 +3(반감). 군체·기계 지성(게슈탈트)에는 못 건다. 멈추면 끌림은 사라지고 이미 바뀐 윤리는 남는다.
// 게임 명령은 누를 때·월 점검(동화 갱신·윤리 이동) 때만. 성계 목록은 그때그때 게임에 물어본다(VADMSYS 줄).

export const VADM = {
  sysBase: 25, sysPerCol: 50, takeAuto: 10, giveAuto: -6, sysCoolYears: 5,
  techCost: 100, techMonths: 6, techCap: 20000, techAuto: -8, techCoolYears: 3,
  assimCost: 50, assimShiftYears: 5, assimAutoYear: 3, assimDays: 400,
  listMax: 80,
} as const;
export const ETHICS = ['authoritarian', 'egalitarian', 'xenophobe', 'xenophile', 'militarist', 'pacifist', 'materialist', 'spiritualist'] as const;
export type Ethic = typeof ETHICS[number];
export const OPPOSITE: Record<Ethic, Ethic> = { authoritarian: 'egalitarian', egalitarian: 'authoritarian', xenophobe: 'xenophile', xenophile: 'xenophobe', militarist: 'pacifist', pacifist: 'militarist', materialist: 'spiritualist', spiritualist: 'materialist' };
/** 게임 윤리 키(ethic_fanatic_militarist 등) → 축 이름. 군체(gestalt)는 빈 목록. */
export function baseEthics(keys: string[]): Ethic[] {
  const out: Ethic[] = [];
  for (const k of keys) { const m = /^ethic_(?:fanatic_)?(\w+)$/.exec(String(k).trim()); const e = m?.[1] as Ethic | undefined; if (e && (ETHICS as readonly string[]).includes(e) && !out.includes(e)) out.push(e); }
  return out;
}
export const sysFee = (col: number): number => VADM.sysBase + VADM.sysPerCol * Math.max(0, Math.round(col));

const okReq = (r: number) => Number.isSafeInteger(r) && r >= 1;
const okSid = (s: string) => /^\d+$/.test(s);
const okIdx = (i: number) => Number.isSafeInteger(i) && i >= 1;
/** 플레이어 범위 + 대상 나라를 sllm_va_t 로 저장한 뒤 body 를 부르는 명령. idx = 0 이면 대상 = 우리. */
function wrap(sid: string, idx: number, body: string): string {
  const target = idx > 0 ? `random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } } save_event_target_as = sllm_va_t } ` : 'save_event_target_as = sllm_va_t ';
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } save_event_target_as = sllm_va_me ${target}${body} }`;
}
/** 성계 목록(idx 나라 소유, 0 = 우리). 줄: VADMSYS(req,n,col,cap,name) … VADMEND. */
export function listCommand(req: number, sid: string, idx: number): string {
  if (!okReq(req) || !okSid(sid) || !(idx === 0 || okIdx(idx))) throw new Error('INVALID_VADM');
  return wrap(sid, idx, `sllm_va_list = { REQ = ${req} }`);
}
/** 성계 하나 옮기기. take = 대상(종속국·외국) → 우리, give = 우리 → 대상. fee = 영향력(거래는 0). 회신 VADMSET st: 0 없음 · 1 주인 아님 · 2 수도·점령·정거장 없음 · 3 영향력 부족 · 9 됨 */
export function transferCommand(req: number, sid: string, idx: number, n: number, dir: 'take' | 'give', fee: number): string {
  if (!okReq(req) || !okSid(sid) || !okIdx(idx) || !okIdx(n) || (dir !== 'take' && dir !== 'give') || !Number.isSafeInteger(fee) || fee < 0 || fee > 5000) throw new Error('INVALID_VADM');
  const [donor, recip] = dir === 'take' ? ['sllm_va_t', 'sllm_va_me'] : ['sllm_va_me', 'sllm_va_t'];
  return wrap(sid, idx, `sllm_va_transfer = { REQ = ${req} N = ${n} DONOR = ${donor} RECIP = ${recip} FEE = ${fee} }`);
}
/** 우리 월 연구량 읽기 → VADMRES(p,s,e). */
export function researchCommand(req: number, sid: string): string {
  if (!okReq(req) || !okSid(sid)) throw new Error('INVALID_VADM');
  return wrap(sid, 0, `sllm_va_research = { REQ = ${req} }`);
}
/** 월 연구량 → 원조 양(6달 치, 분야마다 상한). */
export function techAmounts(p: number, s: number, e: number): { p: number; s: number; e: number } {
  const f = (v: number) => Math.max(0, Math.min(VADM.techCap, Math.round((Number.isFinite(v) ? v : 0) * VADM.techMonths)));
  return { p: f(p), s: f(s), e: f(e) };
}
export function techCommand(req: number, sid: string, idx: number, a: { p: number; s: number; e: number }): string {
  if (!okReq(req) || !okSid(sid) || !okIdx(idx) || ![a.p, a.s, a.e].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= VADM.techCap)) throw new Error('INVALID_VADM');
  return wrap(sid, idx, `sllm_va_tech = { REQ = ${req} P = ${a.p} S = ${a.s} E = ${a.e} COST = ${VADM.techCost} }`);
}
/** 동화: start(영향력 확인·끌림 걸기) · renew(끌림 갱신, 비용 없음) · stop(끌림 치우기) · shift(정부 윤리 한 걸음). 회신 VADMSET st: 3 영향력 부족 · 4 군체 · 9 됨 */
export function assimCommand(req: number, sid: string, idx: number, op: 'start' | 'renew' | 'stop' | 'shift', eth: Ethic[]): string {
  if (!okReq(req) || !okSid(sid) || !okIdx(idx) || !['start', 'renew', 'stop', 'shift'].includes(op) || !eth.every((x) => (ETHICS as readonly string[]).includes(x))) throw new Error('INVALID_VADM');
  if (op === 'stop') return wrap(sid, idx, `sllm_va_assim_stop = { REQ = ${req} }`);
  if (!eth.length) throw new Error('INVALID_VADM');
  if (op === 'shift') return wrap(sid, idx, `sllm_va_assim_shift = { REQ = ${req} E = ${eth[0]} }`);
  const a = [...eth.slice(0, 3), 'none', 'none', 'none'].slice(0, 3); // 윤리는 최대 3(광신 1 + 1 또는 보통 3). 빈 칸 = 아무 효과 없는 sllm_va_assim_none
  return wrap(sid, idx, `sllm_va_assim_go = { REQ = ${req} COST = ${op === 'start' ? VADM.assimCost : 0} A1 = ${a[0]} A2 = ${a[1]} A3 = ${a[2]} DAYS = ${VADM.assimDays} MARK = ${op === 'start' ? 'yes' : 'no'} }`);
}
/** 동화 이번 걸음에 밀 윤리: 우리 윤리 중 종속국에 아직 없는 것(차례로). 없으면 null. */
export function nextShift(ours: Ethic[], theirs: Ethic[]): Ethic | null { return ours.find((e) => !theirs.includes(e)) ?? null; }

export interface VaSys { n: number; name: string; col: number; cap: boolean }
export function readSys(kv: Record<string, string>): VaSys | null {
  const n = Math.round(Number(String(kv.n ?? '').replace(/^\\/, ''))), col = Math.round(Number(String(kv.col ?? '0').replace(/^\\/, '')));
  const name = String(kv.name ?? '').replace(/^\\/, '').trim().slice(0, 60);
  if (!okIdx(n) || !name) return null;
  return { n, name, col: Number.isFinite(col) && col > 0 ? col : 0, cap: String(kv.cap ?? '').replace(/^\\/, '').startsWith('1') };
}
/** VADMSET st → 까닭(한·영). */
export function stText(st: number, L: (k: string, e: string) => string): string {
  return st === 9 ? L('적용했습니다.', 'Applied.') : st === 0 ? L('그 성계를 찾지 못했습니다.', 'That system was not found.') : st === 1 ? L('그 성계의 주인이 바뀌었습니다. 목록을 다시 불러 주세요.', 'That system has changed hands. Reload the list.')
    : st === 2 ? L('수도가 있거나, 점령당한 행성이 있거나, 정거장이 없는 성계는 옮길 수 없습니다.', 'Systems with a capital, an occupied planet or no starbase cannot be transferred.') : st === 3 ? L('영향력이 모자랍니다.', 'Not enough influence.')
    : st === 4 ? L('군체·기계 지성에게는 동화 정책을 쓸 수 없습니다.', 'Gestalt subjects cannot be assimilated.') : L('게임이 응답하지 않았습니다.', 'The game did not answer.');
}
const yearsBetween = (a: string, b: string): number => { const p = (d: string) => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + Number(m[3]) : null; }; const x = p(a), y = p(b); return x === null || y === null ? Infinity : (y - x) / 360; };
/** 쿨다운이 남았는지(남은 해, 없으면 0). */
export function coolLeft(since: string | undefined, now: string, years: number): number { if (!since) return 0; const y = yearsBetween(since, now); return y >= years || y < 0 ? 0 : Math.ceil(years - y); }
export const yearsSince = yearsBetween;
