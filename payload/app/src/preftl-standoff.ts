// 원시문명 핵 대치(2026-11-05 사용자: Expanded Espionage and Diplomacy 모드의 「냉전」을 참고만 해서 우리 식으로 직접 만든다 — 이름·변수·수치는 우리 것).
// 원자력 시대(9)·초기 우주 시대(10) 원시문명은 처음 관측될 때 한 번 주사위(60%)로 「핵 대치」에 들어간다. 긴장도 0~100(시작 50).
//   0~33 해빙(매달 −1.2) · 34~66 대치(+0.3) · 67~100 일촉즉발(+1.2) + 그 문명의 성향(군국 +·평화 −·외계인혐오 +·외계인애호 −) + 군체 −0.3
//   + 인지도가 높으면(3단계 이상) 하늘의 공통된 위협 앞에서 −0.5 + 매달 흔들림 ±0.6.
// 100에 닿으면 핵전쟁: 수도 행성 인구 절반·황폐화 50·두 시대 후퇴(원자력 → 산업, 초기 우주 → 기계). 0에 닿으면 평화적 종결.
//   우리가 완화 쪽으로 20 이상 보탰으면 평화 때 통합력 +150(우리 공) — 그들이 별의 세계로 나오면 기억에 남는다(변화 기록).
// 우리 개입(관측소 필요, preftl-act.ts ACTS): 긴장 완화 공작 −15 · 긴장 고조 공작 +15 · 핵무기 무력화(일촉즉발일 때만, 70% 성공 −35 / 실패 +10·인지도 +15).
// 하늘의 목소리: 대치 중이면 LLM 이 말 한 번마다 calm(−2~+2)을 매기고, 교신이 끝날 때 합 × 5(±20 안)만큼 긴장이 내려가거나 오른다.
// 「슈뢰딩거」: 게임 명령은 결말 때 한 번뿐. 긴장도 계산은 앱만 하고(게임 달이 바뀔 때·관측할 때), 방송 감청·인터넷 염탐·보고서 글에 상황이 묻어난다.
// 앱: src/features/preftl-app.ts · 모드: sllm_probe_preftl.txt(pe·px 칸, sllm_preftl_so_end) · 화면: ui/office-preftl.js
import { L } from './i18n-pick';
import type { Civ } from './preftl';
import { monthsBetween } from './letters';

export const SO = {
  ages: [9, 10], startChance: 0.6, start: 50, easeMax: 33, brinkMin: 67,
  drift: { ease: -1.2, standoff: 0.3, brink: 1.2 }, noise: 0.6,
  pe: { 1: 0.4, 2: 0.8, [-1]: -0.6, [-2]: -1.0 } as Record<number, number>,
  px: { 1: 0.2, 2: 0.4, [-1]: -0.3, [-2]: -0.6 } as Record<number, number>,
  hive: -0.3, aware: -0.5, catchUpMonths: 240,
  act: { calm: -15, stoke: 15, disarmOk: -35, disarmFail: 10, disarmChance: 0.7 },
  voicePer: 5, voiceCap: 20, creditFor: 20, bonusUnity: 150,
} as const;
export type SoStage = 0 | 1 | 2; // 0 해빙 · 1 대치 · 2 일촉즉발
export interface Standoff {
  /** 주사위를 굴렸지만 대치가 없는 문명 = false. 대치 중·끝난 문명 = true */
  on: boolean;
  t: number; since: string; at: string;
  end?: 'war' | 'peace'; endAt?: string;
  /** 우리가 완화 쪽으로 보탠 양(양수) */
  ours: number;
  /** 결말을 게임에 반영했다 */
  applied?: boolean;
}

export const soStage = (t: number): SoStage => (t <= SO.easeMax ? 0 : t >= SO.brinkMin ? 2 : 1);
export const STAGE_NAME: Record<SoStage, [string, string]> = { 0: ['해빙', 'Thaw'], 1: ['대치', 'Standoff'], 2: ['일촉즉발', 'On the brink'] };
export const stageName = (s: SoStage) => L(...STAGE_NAME[s]);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 원시문명 성향(모드 pe·px): 군국 1·2 / 평화 −1·−2, 외계인혐오 1·2 / 외계인애호 −1·−2. 모르면 0. */
export function monthlyDrift(c: Pick<Civ, 'hive' | 'lv'> & { pe?: number; px?: number }, t: number): number {
  const st = soStage(t);
  let d = st === 0 ? SO.drift.ease : st === 2 ? SO.drift.brink : SO.drift.standoff;
  d += SO.pe[c.pe ?? 0] ?? 0;
  d += SO.px[c.px ?? 0] ?? 0;
  if (c.hive) d += SO.hive;
  if ((c.lv ?? 0) >= 3) d += SO.aware;
  return d;
}

/** 처음 원자력·초기 우주 시대로 관측될 때 한 번만 주사위. 이미 굴렸으면 그대로. */
export function soMaybeStart(prev: Standoff | undefined, c: Civ, date: string, rnd: () => number = Math.random): Standoff | undefined {
  if (prev) return prev;
  if (c.gone || !(SO.ages as readonly number[]).includes(c.age)) return undefined;
  if (rnd() >= SO.startChance) return { on: false, t: 0, since: date, at: date, ours: 0 };
  return { on: true, t: clamp(Math.round(SO.start + (rnd() - 0.5) * 16), 40, 60), since: date, at: date, ours: 0 };
}

/** at 부터 date 까지 한 달씩 흘린다(최대 catchUpMonths). 끝나면 end·endAt. 단계가 바뀐 달들을 돌려준다(변화 기록용). */
export function soAdvance(so: Standoff, c: Pick<Civ, 'hive' | 'lv' | 'gone'> & { pe?: number; px?: number }, date: string, rnd: () => number = Math.random): { so: Standoff; stages: SoStage[]; ended: boolean } {
  if (!so.on || so.end || c.gone) return { so: { ...so, at: date }, stages: [], ended: false };
  const months = Math.min(SO.catchUpMonths, Math.max(0, monthsBetween(so.at, date)));
  let t = so.t; const stages: SoStage[] = [];
  for (let i = 0; i < months; i++) {
    const before = soStage(t);
    t = clamp(t + monthlyDrift(c, t) + (rnd() * 2 - 1) * SO.noise, 0, 100);
    const after = soStage(t); if (after !== before) stages.push(after);
    if (t >= 100 || t <= 0) break;
  }
  const out: Standoff = { ...so, t: r1(t), at: date };
  if (t >= 100) { out.end = 'war'; out.endAt = date; out.t = 100; }
  else if (t <= 0) { out.end = 'peace'; out.endAt = date; out.t = 0; }
  return { so: out, stages, ended: !!out.end };
}

/** 우리 개입·하늘의 목소리로 긴장을 옮긴다(delta 음수 = 완화). 끝나면 end. */
export function soPush(so: Standoff, delta: number, date: string): Standoff {
  if (!so.on || so.end || !delta) return so;
  const t = clamp(so.t + delta, 0, 100), out: Standoff = { ...so, t: r1(t), ours: r1(so.ours + Math.max(0, so.t - t)) };
  if (t >= 100) { out.end = 'war'; out.endAt = date; out.t = 100; }
  else if (t <= 0) { out.end = 'peace'; out.endAt = date; out.t = 0; }
  return out;
}
export const soActive = (so: Standoff | undefined): so is Standoff => !!so && so.on && !so.end;
/** 하늘의 목소리 한 번의 calm 합 → 긴장 변화(완화 = 음수). */
export const voiceDelta = (calmSum: number): number => -clamp(Math.round(calmSum) * SO.voicePer, -SO.voiceCap, SO.voiceCap);
/** LLM JSON 의 calm 칸(−2~2). 없으면 0. */
export function parseCalm(raw: string): number {
  const t = String(raw ?? ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return 0;
  try { const v = JSON.parse(t.slice(a, b + 1)); return clamp(Math.round(Number(v?.calm)) || 0, -2, 2); } catch { return 0; }
}
/** 평화 때 우리 공이 있나. */
export const soCredit = (so: Standoff): boolean => so.end === 'peace' && so.ours >= SO.creditFor;

// ---- 글 ----
/** LLM 사실 줄(영어). 대치가 없으면 ''. */
export function soFact(so: Standoff | undefined): string {
  if (!so || !so.on) return '';
  if (so.end === 'war') return `Their great powers fought a nuclear war (${so.endAt}). Cities lie in ruins, half the people died and they were thrown back two ages; survivors live with fallout, grief and blame.`;
  if (so.end === 'peace') return `Their nuclear standoff ended peacefully (${so.endAt}); arms treaties and cautious hope shape their world now.`;
  const st = soStage(so.t);
  return st === 2 ? `Their rival powers are on the brink of nuclear war (tension ${Math.round(so.t)}/100): alerts, drills, bunkers, and a single incident could end it all.`
    : st === 1 ? `Their rival powers are locked in a nuclear standoff (tension ${Math.round(so.t)}/100): arms race, spies, propaganda and proxy quarrels.`
      : `Their nuclear standoff is thawing (tension ${Math.round(so.t)}/100): talks, hotlines and fragile détente.`;
}
/** 화면 한 줄. */
export function soText(so: Standoff | undefined): string {
  if (!so || !so.on) return '';
  if (so.end === 'war') return L(`핵전쟁이 일어났다(${so.endAt}). 인구 절반을 잃고 두 시대 뒤로 물러났다.`, `A nuclear war broke out (${so.endAt}). They lost half their people and fell back two ages.`);
  if (so.end === 'peace') return L(`핵 대치가 평화롭게 끝났다(${so.endAt}).${soCredit(so) ? ' 우리 공이 컸다.' : ''}`, `The nuclear standoff ended peacefully (${so.endAt}).${soCredit(so) ? ' Our hand was in it.' : ''}`);
  return L(`핵 대치 — ${stageName(soStage(so.t))} (긴장 ${Math.round(so.t)}/100)`, `Nuclear standoff — ${stageName(soStage(so.t))} (tension ${Math.round(so.t)}/100)`);
}
/** 화면용 묶음. */
export function soView(so: Standoff | undefined, c: Pick<Civ, 'hive' | 'lv'> & { pe?: number; px?: number }) {
  if (!so || !so.on) return null;
  return { t: Math.round(so.t), stage: soStage(so.t), stageName: stageName(soStage(so.t)), trend: so.end ? 0 : r1(monthlyDrift(c, so.t)), end: so.end ?? null, endAt: so.endAt ?? null, ours: Math.round(so.ours), text: soText(so) };
}

/** 결말을 게임에 반영(관측소 필요 없음). war = 핵전쟁 피해, bonus = 우리 통합력. 회신 PFTLACT w=30. */
export function soEndCommand(req: number, sid: string, id: number, war: boolean, bonus: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(id) || id < 1) throw new Error('INVALID_SO');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } sllm_preftl_so_end = { REQ = ${req} ID = ${id} WAR = ${war ? 'yes' : 'no'} BONUS = ${bonus ? 'yes' : 'no'} } }`;
}
