// 외교 노선(2026-11-04 사용자 결정: 자연 누적 + 직접 공작). 순수 규칙 — 앱: src/features/temper-app.ts, 게임: tester-mod/common/scripted_effects/sllm_temper.txt.
// AI 제국마다 「노선 압력」 −100(강경)~+100(온건)이 쌓이고, 문턱(±60)을 넘으면 게임 안 외교 성향(ai_personality)이 실제로 바뀐다.
// 쌓이는 곳: 외교 대화의 호감 변화(존중 → 온건, 위협·모욕 → 강경) · 외교 거래(성사 → 온건, 우리가 약속을 깸 → 강경) · 해마다 은하 판세 · 첩보 「노선 공작」.
// 성향 이름은 게임이 찍어 준 이름(게임 언어)을 그대로 보여 준다. LLM 은 쓰지 않는다(틀 문장).
import { L } from './i18n-pick';

export type Dir = 1 | 2; // 1 온건 · 2 강경
export const TEMPER = {
  min: -100, max: 100,
  threshold: 60,        // 이만큼 쌓이면 노선이 바뀐다
  coolYears: 5,         // 바뀐 뒤 이 기간 동안은 다시 바뀌지 않는다(압력은 쌓임)
  decay: 10,            // 해마다 0 쪽으로 이만큼 옅어짐
  talkMult: 0.4, talkCap: 10, // 대화 한 번의 호감 변화(±5·±15 단계 합) × 0.4, 최대 ±10
  dealStruck: 5, dealBroken: -20,
  // 판세(해마다): 우리가 1위이고 상대가 열세 → 결속(온건 +4) · AI 1위가 우리보다 우세 → 오만(강경 −6) · 1위와 대등한 2~3위 → 경쟁(강경 −3)
  boxed: 4, hegemon: -6, rival: -3,
  op: { energy: 300, influence: 50, chance: 0.6, push: 35, caught: 0.25, coolMonths: 12 }, // 노선 공작
  keep: 40,
} as const;
export const clampP = (n: number): number => Math.max(TEMPER.min, Math.min(TEMPER.max, Math.round(n)));
export const dirOf = (p: number): Dir | 0 => (p >= TEMPER.threshold ? 1 : p <= -TEMPER.threshold ? 2 : 0);
/** 해마다 옅어짐. */
export const decayP = (p: number): number => (p > 0 ? Math.max(0, p - TEMPER.decay) : Math.min(0, p + TEMPER.decay));
/** 외교 대화 한 번(호감 변화 합 dl) → 압력. */
export const talkPush = (dl: number): number => (Number.isFinite(dl) ? Math.max(-TEMPER.talkCap, Math.min(TEMPER.talkCap, Math.round(dl * TEMPER.talkMult))) : 0);

/** 게임 줄 TMPC 하나. rp = 우리 대비 그 나라 국력(1 하찮음 · 2 열세 · 3 대등 · 4 우세 · 5 압도). cls = 지금 성향의 노선(1 온건 · 2 강경 · 0 그 밖). */
export interface TmpEmpire { idx: number; name: string; pers: string; cls: 0 | 1 | 2; ok: boolean; rp: number; pac: boolean; war: boolean }
export interface TmpTop { rank: number; idx: number; us: boolean; name: string; fp?: number }
export const gnum = (v: unknown): number => { const s = String(v ?? '').trim().replace(/,/g, ''); const m = /^(-?[\d.]+)\s*([kKmM]?)$/.exec(s); if (!m) return Number(s) || 0; return Number(m[1]) * (m[2] === 'k' || m[2] === 'K' ? 1e3 : m[2] ? 1e6 : 1); };
export function parseEmpire(kv: Record<string, unknown>): TmpEmpire | null {
  const idx = Math.round(gnum(kv.idx)); if (!Number.isSafeInteger(idx) || idx < 0) return null;
  const cls = Math.round(gnum(kv.cls));
  return { idx, name: String(kv.name ?? '').slice(0, 80), pers: String(kv.pers ?? '').slice(0, 60), cls: cls === 1 || cls === 2 ? cls : 0, ok: Math.round(gnum(kv.ok)) === 1, rp: Math.max(1, Math.min(5, Math.round(gnum(kv.rp)) || 3)), pac: Math.round(gnum(kv.pac)) === 1, war: Math.round(gnum(kv.war)) === 1 };
}
export function parseTop(kv: Record<string, unknown>): TmpTop | null {
  const rank = Math.round(gnum(kv.rank)); if (!(rank >= 0 && rank < 5)) return null;
  const fp = Math.round(gnum(kv.fp));
  return { rank, idx: Math.round(gnum(kv.idx)), us: Math.round(gnum(kv.us)) === 1, name: String(kv.name ?? '').slice(0, 80), ...(fp > 0 ? { fp } : {}) };
}

/** 해마다 판세에서 오는 압력(난수 없음). top 은 함대 전력 순. */
export function yearPush(e: TmpEmpire, top: TmpTop[]): { d: number; why: [string, string] } | null {
  if (!e.ok) return null;
  const first = top.find((t) => t.rank === 0), pos = top.find((t) => !t.us && t.idx === e.idx);
  if (first?.us && e.rp <= 2) return { d: TEMPER.boxed, why: ['우리 패권 앞에서 결속을 찾음', 'seeking safety in numbers before our dominance'] };
  if (pos?.rank === 0 && e.rp >= 4) return { d: TEMPER.hegemon, why: ['은하 최강국의 오만', 'the arrogance of the galaxy’s strongest power'] };
  if (pos && pos.rank <= 2 && pos.rank > 0 && e.rp >= 3) return { d: TEMPER.rival, why: ['정상을 넘보는 경쟁심', 'the ambition of a power close to the top'] };
  return null;
}

// ---- 게임 명령 ----
const okReq = (req: number) => Number.isSafeInteger(req) && req >= 1;
export function ctxCommand(req: number): string { if (!okReq(req)) throw new Error('INVALID_TMP'); return `effect every_playable_country = { limit = { is_ai = no } sllm_tmp_ctx = { REQ = ${req} } }`; }
export function shiftCommand(req: number, tid: number, dir: Dir): string {
  if (!okReq(req) || !Number.isSafeInteger(tid) || tid < 0 || (dir !== 1 && dir !== 2)) throw new Error('INVALID_TMP');
  return `effect every_playable_country = { limit = { is_ai = no } sllm_tmp_shift = { REQ = ${req} TID = ${tid} DIR = ${dir} } }`;
}
export function caughtCommand(req: number, tid: number): string {
  if (!okReq(req) || !Number.isSafeInteger(tid) || tid < 0) throw new Error('INVALID_TMP');
  return `effect every_playable_country = { limit = { is_ai = no } sllm_tmp_caught = { REQ = ${req} TID = ${tid} } }`;
}
export function payCommand(req: number, sid: string, payId: string): string {
  if (!okReq(req) || !/^\d+$/.test(sid) || !/^[a-z0-9_]{1,40}$/.test(payId)) throw new Error('INVALID_TMP');
  const { energy, influence } = TEMPER.op, mark = `sllm_tmppay_${payId}`, log = (s: string) => `log = "SLLM:TMPPAY/;/req=${req}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { OR = { resource_stockpile_compare = { resource = energy value < ${energy} } resource_stockpile_compare = { resource = influence value < ${influence} } } } ${log('short')} } else = { add_resource = { energy = -${energy} influence = -${influence} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}

// ---- 문장 ----
export const dirName = (d: Dir): string => (d === 1 ? L('온건', 'moderate') : L('강경', 'hardline'));
export const leanText = (p: number): string => (p >= 40 ? L('온건 쪽으로 크게 기욺', 'leaning strongly moderate') : p >= 15 ? L('온건 쪽으로 기욺', 'leaning moderate') : p <= -40 ? L('강경 쪽으로 크게 기욺', 'leaning strongly hardline') : p <= -15 ? L('강경 쪽으로 기욺', 'leaning hardline') : L('흔들림 없음', 'steady'));
export const RP_NAME: Record<number, [string, string]> = { 1: ['하찮음', 'pathetic'], 2: ['열세', 'inferior'], 3: ['대등', 'equivalent'], 4: ['우세', 'superior'], 5: ['압도', 'overwhelming'] };
export function shiftHeadline(name: string, from: string, to: string, d: Dir): string {
  return d === 1
    ? L(`${name}, 외교 노선을 온건으로 틀다 — 「${from}」에서 「${to}」로`, `${name} turns to a moderate foreign policy — from "${from}" to "${to}"`)
    : L(`${name}, 외교 노선을 강경으로 틀다 — 「${from}」에서 「${to}」로`, `${name} turns to a hardline foreign policy — from "${from}" to "${to}"`);
}
/** 함대 전력 숫자 짧게(12,345 → 12.3K). */
export const fpText = (n?: number): string => (!n ? '' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
/** 「올해의 판세」 기사 한 줄(틀 문장). */
export function yearHeadline(year: string, top: TmpTop[], us: string): string {
  const t = top.slice().sort((a, b) => a.rank - b.rank).slice(0, 3).map((x) => ((x.us ? us : x.name) + (x.fp ? ` (${fpText(x.fp)})` : ''))).filter(Boolean);
  if (!t.length) return '';
  return L(`${year}년 은하 판세: 함대 전력 1위 ${t[0]}${t[1] ? `, 2위 ${t[1]}` : ''}${t[2] ? `, 3위 ${t[2]}` : ''}`, `${year} balance of power: strongest fleets — 1. ${t[0]}${t[1] ? `, 2. ${t[1]}` : ''}${t[2] ? `, 3. ${t[2]}` : ''}`);
}
/** 비서·대화 프롬프트용 사실(영어). */
export function temperFact(list: Array<{ name: string; pers: string; p: number }>): string[] {
  const moving = list.filter((x) => Math.abs(x.p) >= 30).slice(0, 5);
  return moving.map((x) => `${x.name} (diplomatic personality "${x.pers}") is drifting toward a more ${x.p > 0 ? 'moderate, peaceful' : 'hardline, aggressive'} foreign policy (pressure ${x.p}/${x.p > 0 ? TEMPER.threshold : -TEMPER.threshold}).`);
}
