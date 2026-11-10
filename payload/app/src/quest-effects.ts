// 퀘스트 효과 엔진(2026-10-26 작업컴 초안, docs/QUEST_EFFECT_ENGINE_DESIGN_KO.md). 순수 로직만(electron 없이 selftest).
// AI 가 퀘스트 보상·불이익을 { id, amount, days } 로 정하면 → 이 파일이 허용 목록·범위로 검증하고 잘라서(planQuestEffects)
// → 콘솔 effect 명령을 만든다(questApplyCommand). 모드 쪽은 1단위 정적 수정자(sllm_q<자리>_<id>_p|n)만 있으면 되고,
// 크기는 add_modifier 의 multiplier(4.5.1 덤프 확인: <float>/<variable>)로 건다.
// 사용자 확정(2026-10-26): 퍼센트 효과는 퀘스트 1개당 ±15%까지, 중첩 상한 없음(퀘스트 자리마다 다른 수정자 이름).
import { L } from './i18n-pick';
import { QUEST_EFFECTS, QUEST_RESOURCES, QUEST_ALIASES, QUEST_SLOTS, type QuestEffectEntry, type QuestResourceEntry } from './quest-catalog';

export type QuestGiver = 'ruler' | 'minister' | 'governor' | 'admiral' | 'foreign' | 'petition';
/** 대상: 제국 전체 / 행성 k(every_owned_colony 순서, 1부터 — 총독 화면·청원과 같은 순서) / 총독 구역(총독 sllm_lid) / 함대(제독 sllm_lid). */
export type QuestTarget = { kind: 'country' } | { kind: 'planet'; k: number } | { kind: 'sector'; lid: number } | { kind: 'fleet'; lid: number };
export type QuestDir = 'p' | 'n';
export interface PlannedEffect { id: string; dir: QuestDir; steps: number; days: number; entry: QuestEffectEntry }
export interface PlannedResource { id: string; dir: QuestDir; steps: number; months: number; min: number; max: number; entry: QuestResourceEntry }
export interface QuestPlan { effects: PlannedEffect[]; resources: PlannedResource[]; dropped: Array<{ id: string; reason: string }>; clamped: Array<{ id: string; from: number; to: number }> }
export interface QuestPlanContext {
  giver: QuestGiver; target: QuestTarget;
  /** 장관이면 자기 직책 분야 묶음만(예: ['fleet','army']). 없으면 제한 없음. */
  groups?: string[];
  /** 게임 연도(자원 상한 배율). 없으면 2200. */
  year?: number;
  /** 고를 수 있는 자원 key(DLC 없는 자원 제외용). 없으면 menace 만 빼고 전부. */
  resources?: string[];
}

export const QUEST_DAYS_MIN = 180, QUEST_DAYS_MAX = 1080, QUEST_DAYS_REWARD = 720, QUEST_DAYS_PENALTY = 360;
/** 자원 1단계 = 월 수입 0.4개월(15단계 = 6개월). 제안값 — 사용자 확인 전. */
export const QUEST_RES_MONTHS_PER_STEP = 0.4;
export const QUEST_RES_STEPS_MAX = 15;
/** 총독 구역은 넓게 걸리므로 행성 하나일 때 상한의 2/3(제안). */
export const SECTOR_CAP_RATIO = 2 / 3;

const BY_ID = new Map(QUEST_EFFECTS.map((e) => [e.id, e]));
const RES_BY_KEY = new Map(QUEST_RESOURCES.map((r) => [r.key, r]));
const RES_BY_ID = new Map(QUEST_RESOURCES.map((r) => [r.id, r]));
const GIVER_TARGETS: Record<QuestGiver, QuestTarget['kind'][]> = {
  ruler: ['country'], minister: ['country'], foreign: ['country'], governor: ['planet', 'sector'], admiral: ['fleet'], petition: ['planet'],
};

export function questEffectById(raw: string): QuestEffectEntry | undefined {
  const id = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return BY_ID.get(QUEST_ALIASES[id] ?? id);
}
export function questResourceById(raw: string): QuestResourceEntry | undefined {
  const id = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return RES_BY_ID.get(id) ?? RES_BY_ID.get('res_' + id) ?? RES_BY_KEY.get(id);
}
/** 이 대상에 걸 수 있나. 행성·구역 = 행성 범위 효과만, 함대 = 함대용 함선 효과만, 제국 = 전부. */
export function effectFitsTarget(e: QuestEffectEntry, t: QuestTarget): boolean {
  if (t.kind === 'country') return true;
  if (t.kind === 'fleet') return e.fleet;
  return e.scope === 'planet';
}
/** 이 대상에서의 단계 상한. */
export function effectCap(e: QuestEffectEntry, t: QuestTarget): number {
  return t.kind === 'sector' ? Math.max(e.min, Math.floor(e.max * SECTOR_CAP_RATIO)) : e.max;
}
/** 자원 상한 연도 배율(제안): 2250 전 ×1, 2300 전 ×2, 그 뒤 ×3. */
export function questYearFactor(year?: number): number {
  const y = Number.isFinite(year) ? Number(year) : 2200;
  return y < 2250 ? 1 : y < 2300 ? 2 : 3;
}
/** AI 가 준 크기를 단계 수로: 퍼센트 효과에 0.06 처럼 비율로 오면 6 으로. 부호는 버린다(방향은 reward/penalty 목록이 정함). */
export function amountToSteps(e: { show: 'pct' | 'num'; step: number }, raw: unknown): number {
  let v = Math.abs(Number(raw));
  if (!Number.isFinite(v) || v === 0) return 0;
  if (e.show === 'pct' && v < 1) v *= 100; // 0.06 → 6(%)
  else if (e.show === 'num' && e.step < 1 && v < 1) v /= e.step; // 신뢰 0.1 → 10단계
  // 그 밖에는 이미 단계 수(메뉴가 "amount is in steps" 라고 알려 줌). 저장 한도 30 = 3,000.
  return Math.round(v);
}
const clampDays = (raw: unknown, dir: QuestDir) => {
  const d = Math.round(Number(raw));
  if (!Number.isFinite(d) || d <= 0) return dir === 'p' ? QUEST_DAYS_REWARD : QUEST_DAYS_PENALTY;
  return Math.min(QUEST_DAYS_MAX, Math.max(QUEST_DAYS_MIN, d));
};

/** JSON 글(``` 감싸기·앞뒤 잡글 허용) 또는 객체 → { reward: [], penalty: [] }. */
export function parseQuestEffectReply(raw: unknown): { reward: any[]; penalty: any[] } {
  let j: any = raw;
  if (typeof raw === 'string') {
    const m = /\{[\s\S]*\}/.exec(raw.replace(/```(?:json)?/gi, ''));
    try { j = m ? JSON.parse(m[0]) : {}; } catch { j = {}; }
  }
  const arr = (x: unknown) => (Array.isArray(x) ? x : x && typeof x === 'object' ? [x] : []);
  return { reward: arr(j?.reward ?? j?.rewards), penalty: arr(j?.penalty ?? j?.penalties) };
}

/** 검증·자르기·합치기. 같은 (id, 방향)은 합친 뒤 상한으로 자른다(퀘스트 1개 안에서 ±15% 넘지 않게). */
export function planQuestEffects(raw: unknown, ctx: QuestPlanContext): QuestPlan {
  const { reward, penalty } = parseQuestEffectReply(raw);
  const plan: QuestPlan = { effects: [], resources: [], dropped: [], clamped: [] };
  if (!GIVER_TARGETS[ctx.giver]?.includes(ctx.target.kind)) { plan.dropped.push({ id: '*', reason: 'giver_target' }); return plan; }
  const allowRes = new Set(ctx.resources ?? QUEST_RESOURCES.filter((r) => r.key !== 'menace').map((r) => r.key));
  const fx = new Map<string, { e: QuestEffectEntry; dir: QuestDir; steps: number; days: number }>();
  const rs = new Map<string, { r: QuestResourceEntry; dir: QuestDir; steps: number }>();
  const take = (item: any, dir: QuestDir) => {
    const rid = String(item?.id ?? item?.effect ?? item?.resource ?? '');
    const isRes = item?.resource !== undefined || /^res_/i.test(rid);
    if (isRes) {
      const r = questResourceById(rid);
      if (!r) return plan.dropped.push({ id: rid, reason: 'unknown' });
      if (!allowRes.has(r.key)) return plan.dropped.push({ id: r.id, reason: 'resource_unavailable' });
      const steps = amountToSteps({ show: 'num', step: 1 }, item?.amount ?? item?.steps);
      if (!steps) return plan.dropped.push({ id: r.id, reason: 'zero' });
      const k = r.id + ':' + dir, prev = rs.get(k);
      rs.set(k, { r, dir, steps: (prev?.steps ?? 0) + steps });
      return;
    }
    const e = questEffectById(rid);
    if (!e) return plan.dropped.push({ id: rid, reason: 'unknown' });
    if (!effectFitsTarget(e, ctx.target)) return plan.dropped.push({ id: e.id, reason: 'scope' });
    if (ctx.groups && !ctx.groups.includes(e.group)) return plan.dropped.push({ id: e.id, reason: 'group' });
    const steps = amountToSteps(e, item?.amount ?? item?.value);
    if (!steps) return plan.dropped.push({ id: e.id, reason: 'zero' });
    const k = e.id + ':' + dir, prev = fx.get(k);
    fx.set(k, { e, dir, steps: (prev?.steps ?? 0) + steps, days: Math.max(prev?.days ?? 0, clampDays(item?.days, dir)) });
  };
  reward.forEach((x) => take(x, 'p'));
  penalty.forEach((x) => take(x, 'n'));
  for (const { e, dir, steps, days } of fx.values()) {
    const cap = effectCap(e, ctx.target), s = Math.min(cap, Math.max(e.min, steps));
    if (s !== steps) plan.clamped.push({ id: e.id, from: steps, to: s });
    plan.effects.push({ id: e.id, dir, steps: s, days, entry: e });
  }
  const f = questYearFactor(ctx.year);
  for (const { r, dir, steps } of rs.values()) {
    const s = Math.min(QUEST_RES_STEPS_MAX, steps);
    if (s !== steps) plan.clamped.push({ id: r.id, from: steps, to: s });
    plan.resources.push({ id: r.id, dir, steps: s, months: Math.round(s * QUEST_RES_MONTHS_PER_STEP * 100) / 100, min: r.min * f, max: r.max * f, entry: r });
  }
  return plan;
}

// ── 게임 명령 ──
export const questModifierName = (slot: number, id: string, dir: QuestDir) => `sllm_q${slot}_${id}_${dir}`;
const okArgs = (req: number, sid: string, cid: string, slot: number) =>
  Number.isSafeInteger(req) && req >= 1 && /^\d+$/.test(sid) && /^[a-f0-9]{32}$/.test(cid) && Number.isSafeInteger(slot) && slot >= 1 && slot <= QUEST_SLOTS;
const okTarget = (t: QuestTarget) => t.kind === 'country' || (t.kind === 'planet' ? Number.isSafeInteger(t.k) && t.k >= 1 : Number.isSafeInteger((t as any).lid) && (t as any).lid >= 1);
const player = (sid: string, body: string) => `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;
const addMod = (name: string, days: number, steps: number) => `remove_modifier = ${name} add_modifier = { modifier = ${name} days = ${days} multiplier = ${steps} }`;

/** 대상 범위로 감싸기. 국가 범위 몸통(country)과 행성 범위 몸통(planet)을 받아 대상에 맞게 붙인다. 찾으면 sllm_q_ok = 1. */
function onTarget(t: QuestTarget, country: string, planet: string, fleet: string): string {
  const ok = 'set_variable = { which = sllm_q_ok value = 1 }';
  switch (t.kind) {
    case 'country':
      return `${ok} ${country}${planet ? ` every_owned_colony = { ${planet} }` : ''}`;
    case 'planet':
      return `set_variable = { which = sllm_q_n value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_q_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_q_n value = ${t.k} } } } ${planet} prev = { ${ok} } } } clear_variable = sllm_q_n`;
    case 'sector':
      // 2026-10-27 테스터 error.log: 구역(sector) 범위에서는 leader 로 넘어갈 수 없다(4.5 scopes.log). 그 총독이 맡은 식민지를 행성 쪽 leader 로 찾는다.
      { const gov = `exists = leader leader = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${t.lid} } }`;
        return `every_owned_colony = { limit = { ${gov} } ${planet} } if = { limit = { any_owned_colony = { ${gov} } } ${ok} }`; }
    case 'fleet':
      return `every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${t.lid} } exists = fleet } fleet = { ${fleet} } prev = { ${ok} } }`;
  }
}

/** 자원 지급·차감(국가 범위). 양 = 월 수입 × months 를 [min, max] 로 자름. 차감은 창고에 있는 만큼까지만. */
function resourceBody(req: number, r: PlannedResource): string {
  const k = r.entry.key, v = 'sllm_q_r', s = 'sllm_q_s';
  const calc = `set_variable = { which = ${v} value = 0 } export_resource_income_to_variable = { resource = ${k} variable = ${v} } multiply_variable = { which = ${v} value = ${r.months} }`
    + ` if = { limit = { check_variable = { which = ${v} value < ${r.min} } } set_variable = { which = ${v} value = ${r.min} } }`
    + ` if = { limit = { check_variable = { which = ${v} value > ${r.max} } } set_variable = { which = ${v} value = ${r.max} } } round_variable = ${v}`;
  const neg = r.dir === 'n'
    ? ` set_variable = { which = ${s} value = 0 } export_resource_stockpile_to_variable = { resource = ${k} variable = ${s} } if = { limit = { check_variable = { which = ${v} value > ${s} } } set_variable = { which = ${v} value = ${s} } } floor_variable = ${v}`
    : '';
  const logLine = `log = "SLLM:QUESTRES/;/req=${req}/;/res=${k}/;/dir=${r.dir}/;/amt=\\[This.${v}]"`;
  const apply = r.dir === 'n' ? `multiply_variable = { which = ${v} value = -1 } add_resource = { ${k} = 1 mult = ${v} }` : `add_resource = { ${k} = 1 mult = ${v} }`;
  return `${calc}${neg} ${logLine} ${apply} clear_variable = ${v}${r.dir === 'n' ? ` clear_variable = ${s}` : ''}`;
}

/** 퀘스트 결과를 게임에 건다. slot = 퀘스트 자리(1~8, 동시에 진행 중인 퀘스트끼리 겹치지 않게). 같은 결정(cid)은 한 번만. 응답: SLLM:QUESTAPPLY applied|duplicate|no_target. */
export function questApplyCommand(req: number, sid: string, cid: string, slot: number, target: QuestTarget, plan: QuestPlan): string {
  if (!okArgs(req, sid, cid, slot) || !okTarget(target) || !plan.effects.every((p) => effectFitsTarget(p.entry, target))) throw new Error(L('퀘스트 효과 인자가 올바르지 않습니다.', 'Invalid quest effect arguments.'));
  const log = (status: string) => `log = "SLLM:QUESTAPPLY/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/slot=${slot}/;/status=${status}"`;
  const mark = `sllm_qa_${cid}`;
  const country = plan.effects.filter((p) => p.entry.scope === 'country').map((p) => addMod(questModifierName(slot, p.id, p.dir), p.days, p.steps)).join(' ');
  const planet = plan.effects.filter((p) => p.entry.scope === 'planet').map((p) => addMod(questModifierName(slot, p.id, p.dir), p.days, p.steps)).join(' ');
  const fleet = plan.effects.map((p) => addMod(questModifierName(slot, p.id, p.dir), p.days, p.steps)).join(' ');
  const res = plan.resources.map((r) => resourceBody(req, r)).join(' ');
  const body = `set_variable = { which = sllm_q_ok value = 0 } ${onTarget(target, country, planet, fleet)} if = { limit = { check_variable = { which = sllm_q_ok value = 1 } } ${res ? res + ' ' : ''}${log('applied')} } else = { ${log('no_target')} } clear_variable = sllm_q_ok`;
  return player(sid, `if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } ${body} }`);
}

/** 퀘스트 취소·전환: 그 자리에 건 수정자를 지운다(자원은 되돌리지 않음). applied = 그때 건 (id, 방향) 목록(앱이 저장). */
export function questClearCommand(req: number, sid: string, cid: string, slot: number, target: QuestTarget, applied: Array<{ id: string; dir: QuestDir }>): string {
  const entries = applied.map((a) => ({ a, e: BY_ID.get(a.id) }));
  if (!okArgs(req, sid, cid, slot) || !okTarget(target) || entries.some((x) => !x.e || (x.a.dir !== 'p' && x.a.dir !== 'n'))) throw new Error(L('퀘스트 효과 해제 인자가 올바르지 않습니다.', 'Invalid quest effect clear arguments.'));
  const log = (status: string) => `log = "SLLM:QUESTCLEAR/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/slot=${slot}/;/status=${status}"`;
  const mark = `sllm_qc_${cid}`;
  const rm = (f: (e: QuestEffectEntry) => boolean) => entries.filter((x) => f(x.e!)).map((x) => `remove_modifier = ${questModifierName(slot, x.a.id, x.a.dir)}`).join(' ');
  const body = `set_variable = { which = sllm_q_ok value = 0 } ${onTarget(target, rm((e) => e.scope === 'country'), rm((e) => e.scope === 'planet'), rm(() => true))} if = { limit = { check_variable = { which = sllm_q_ok value = 1 } } ${log('cleared')} } else = { ${log('no_target')} } clear_variable = sllm_q_ok`;
  return player(sid, `if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } ${body} }`);
}

/** 쓰지 않는 퀘스트 자리(1~8) 하나. busy = 진행 중인 퀘스트가 쓰는 자리. 다 차면 0. */
export function freeQuestSlot(busy: number[]): number {
  for (let s = 1; s <= QUEST_SLOTS; s++) if (!busy.includes(s)) return s;
  return 0;
}

// ── 글 ──
/** "인구 행복 +6% · 720일" / "Pop Happiness +6% · 720 days". t = 고르기(화면은 L). */
export function questEffectText(p: PlannedEffect, t: (ko: string, en: string) => string = L): string {
  const v = p.steps * p.entry.step * (p.dir === 'p' ? p.entry.good : -p.entry.good);
  const val = p.entry.show === 'pct' ? `${v > 0 ? '+' : ''}${Math.round(v * 10000) / 100}%` : `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100}`;
  return `${t(p.entry.ko, p.entry.en)} ${val} · ${t(`${p.days}일`, `${p.days} days`)}`;
}
export function questResourceText(r: PlannedResource, t: (ko: string, en: string) => string = L): string {
  const sign = r.dir === 'p' ? '+' : '−';
  return `${t(r.entry.ko, r.entry.en)} ${sign}${t(`월 수입 ${r.months}개월분(${r.min}~${r.max})`, `${r.months} months of income (${r.min}–${r.max})`)}`;
}
/** AI 프롬프트용 메뉴(영어 고정 — 프롬프트 규칙). 이 주는 사람·대상에 맞는 것만, 묶음별 한 줄. */
export function questEffectMenu(ctx: Pick<QuestPlanContext, 'giver' | 'target' | 'groups' | 'resources'>): string {
  if (!GIVER_TARGETS[ctx.giver]?.includes(ctx.target.kind)) return '';
  const lines = new Map<string, string[]>();
  for (const e of QUEST_EFFECTS) {
    if (!effectFitsTarget(e, ctx.target) || (ctx.groups && !ctx.groups.includes(e.group))) continue;
    const cap = effectCap(e, ctx.target);
    (lines.get(e.group) ?? lines.set(e.group, []).get(e.group)!).push(`${e.id}(${e.en}, ${e.min}-${cap}${e.show === 'pct' ? '%' : ''})`);
  }
  const allowRes = new Set(ctx.resources ?? QUEST_RESOURCES.filter((r) => r.key !== 'menace').map((r) => r.key));
  const res = QUEST_RESOURCES.filter((r) => allowRes.has(r.key)).map((r) => r.id).join(', ');
  return ['Effects (id(name, steps)) — amount is in steps; % effects: 1 step = 1%:', ...[...lines].map(([g, l]) => `- ${g}: ${l.join('; ')}`),
    `One-time resources (amount 1-${QUEST_RES_STEPS_MAX}, 1 step = ${QUEST_RES_MONTHS_PER_STEP} months of income): ${res}`,
    `days ${QUEST_DAYS_MIN}-${QUEST_DAYS_MAX}. Reply JSON: {"reward":[{"id":"...","amount":N,"days":N}],"penalty":[...]}`].join('\n');
}
