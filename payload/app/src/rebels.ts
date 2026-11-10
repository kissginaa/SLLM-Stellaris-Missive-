// 반란과 공작(2026-11-05 사용자: Potent Rebellions(창작마당 3666568798)를 참고만 해서 우리 식으로 — 「2,3,4 좋기는하네」). 순수 규칙.
// 앱: src/features/rebels-app.ts · 화면: ui/office-rebels.js(집무실 「첩보 보고」) · 모드: common/scripted_effects/sllm_rebels.txt
//   ② 반란군 후원: 이웃 나라에서 반란이 성공하면, 그 나라를 싫어하는 우리에게 새 반란국이 지원을 청한다(서신). 매달 에너지·광물을 보내고,
//      해마다 원래 나라에 들킬 수 있다. 반대로 우리 땅의 반란군을 우리를 싫어하는 AI 가 돕고, 우리 첩보가 그걸 잡아낼 수 있다.
//   ③ 취약 국가: 강한(함대 압도적) 적대 이웃 옆에서 함대 한도를 90% 미만으로 쓰면 백성이 흔들린다(행성 안정도·파벌 지지). 3달마다 판정.
//   ④ 선동 공작: 첩보망이 있는 나라의 행성 하나에 불안을 심는다(영향력). 발각되면 관계가 나빠진다. AI 도 가끔 우리에게 한다.
// AI 끼리는 아무 일도 없다(플레이어가 하거나 당할 때만).
// 가까운 나라만(2026-11-05, We Require Borders 참고): AI 의 후원·선동, 후원 요청은 우리와 국경이 닿거나 한 칸 안인 나라만. 3달마다 sllm_near_@<우리> 깃발로 기억해 둔다.
//   우리가 하는 선동은 첩보망만 있으면 거리와 상관없다.
import { L } from './i18n-pick';

export const RB = {
  /** 후원 단계: 매달 에너지·광물 각각 */
  tiers: [25, 50, 100] as const,
  aidMonths: 60, askDays: 180, waitMonths: 24, maxAid: 2, shortMax: 2,
  /** 해마다(1월) 원래 나라에 들킬 확률(단계별) */
  detect: [0.15, 0.25, 0.4] as const,
  /** 우리 반란군을 AI 가 도울 확률 · 한 번에 주는 자원 · 우리 첩보가 잡아낼 기본 확률(그 나라에 첩보망이 있으면 +0.3) */
  aiFundChance: 0.6, aiFundAmt: 400, aiFundSpot: 0.4,
  /** 취약 판정 간격(달) · 수정자 기간(일, 다음 판정까지 이어지게) */
  vulnEvery: 3, vulnDays: 100,
  /** 선동: 영향력 · 기간(일) · 대상별 재사용 대기(달) · 동시에 */
  sowInf: 50, sowDays: 1080, sowCoolMonths: 24, sowMax: 3,
  /** AI 가 우리에게 선동: 매달 확률 · 한 번 당한 뒤 대기(달) · 우리가 알아챌 기본 확률(그 나라에 첩보망이 있으면 +0.25) */
  aiSowChance: 1 / 48, aiSowCoolMonths: 36, aiSowSpot: 0.5,
  /** 우리가 불안을 심은 나라에서 이만큼 안에 반란이 나면 반란국이 그 일을 안다 */
  sownYears: 5,
  keep: 30,
} as const;
export type Tier = 1 | 2 | 3;
export const TIER_NAME: Record<Tier, [string, string]> = { 1: ['조금', 'Token'], 2: ['넉넉히', 'Generous'], 3: ['크게', 'Lavish'] };

const ymd = (d: string): number | null => { const m = /^(\d{3,5})\.(\d{1,2})\.(\d{1,2})/.exec(String(d || '')); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : null; };
/** 두 날짜 사이 달 수(모르면 큰 수). */
export function monthsBetween(a: string | undefined, b: string): number { const x = a ? ymd(a) : null, y = ymd(b); return x === null || y === null ? 9999 : Math.floor((y - x) / 30); }
export function addDaysTo(d: string, days: number): string {
  const n = ymd(d); if (n === null) return d; const t = n + Math.round(days), y = Math.floor(t / 360), r = t - y * 360, m = Math.floor(r / 30) + 1, dd = r - (m - 1) * 30 + 1;
  return `${y}.${String(m).padStart(2, '0')}.${String(dd).padStart(2, '0')}`;
}
export const isTier = (v: unknown): v is Tier => v === 1 || v === 2 || v === 3;
export const tierAmt = (t: Tier): number => RB.tiers[t - 1];
/** 해마다 들킬 확률. */
export const aidDetect = (t: Tier): number => RB.detect[t - 1];
/** 우리 공작이 들킬 확률: 첩보망이 셀수록 낮다(0.1~0.45). */
export const sowDetect = (power: number): number => Math.max(0.1, Math.min(0.45, 0.45 - Math.max(0, power) / 250));
/** AI 공작을 우리가 알아챌 확률. */
export const aiSowSpot = (haveNet: boolean): number => Math.min(0.9, RB.aiSowSpot + (haveNet ? 0.25 : 0));
export const aiFundSpot = (haveNet: boolean): number => Math.min(0.9, RB.aiFundSpot + (haveNet ? 0.3 : 0));

// ---- 장부 ----
export interface AidAsk { country: string; from: string; at: string; state: 'wait' | 'ask' | 'skip' | 'ignored' | 'declined' | 'taken' | 'expired'; due?: string; sown?: boolean }
export interface Aid { country: string; from: string; tier: Tier; since: string; until: string; paid: number; short: number; caught: boolean; state: 'on' | 'done' | 'lapsed' | 'stopped' | 'gone'; lastCheck?: string;
  /** 정기 송금(2026-11-09): 모드 칸 묶음 번호 · 이번 세션에 적었나 · 모드가 못 냈다고 알린 달 · 칸이 모자라 앱이 매달 보냄 · 불러온 뒤 확인만 할 차례(게임에 칸이 없으면 끝난 것) */ g?: number; reg?: boolean; sm?: string; legacy?: boolean; chk?: boolean }
export interface OurRebel { country: string; at: string; state: 'wait' | 'done' | 'expired'; foe?: string; spotted?: boolean }
export interface Sow { target: string; idx: number; planet: string; at: string; until: string; caught: boolean }
export interface AiSow { foe: string; planet: string; at: string; until: string; spotted: boolean }
export interface Vuln { on: boolean; since?: string; foe?: string; use?: number; last?: string }
export interface RbSave { asks: AidAsk[]; aids: Aid[]; ours: OurRebel[]; sows: Sow[]; aiSows: AiSow[]; vuln: Vuln; lastAiSow?: string }
export const emptySave = (): RbSave => ({ asks: [], aids: [], ours: [], sows: [], aiSows: [], vuln: { on: false } });
export function fixSave(v: Partial<RbSave> | undefined): RbSave {
  const s = { ...emptySave(), ...(v ?? {}) } as RbSave;
  for (const k of ['asks', 'aids', 'ours', 'sows', 'aiSows'] as const) if (!Array.isArray(s[k])) (s as unknown as Record<string, unknown[]>)[k] = [];
  if (!s.vuln || typeof s.vuln !== 'object') s.vuln = { on: false };
  return s;
}
const trim = <T>(a: T[]) => { if (a.length > RB.keep) a.splice(0, a.length - RB.keep); };
const norm = (s: string | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** 반란 성공(ORIGIN rebels) 하나를 장부에 넣는다. 우리에게서 갈라졌으면 ours, 남의 일이면 asks. 같은 나라는 한 번만. */
export function noteRebellion(s: RbSave, o: { country: string; from: string; date: string }, player: string, date: string): 'ours' | 'ask' | null {
  const c = norm(o.country), f = norm(o.from), p = norm(player); if (!c || !f || c === f || !p || c === p) return null;
  if (f === p) { if (s.ours.some((r) => r.country === c)) return null; s.ours.push({ country: c, at: o.date || date, state: 'wait' }); trim(s.ours); return 'ours'; }
  if (s.asks.some((r) => r.country === c)) return null;
  const sown = s.sows.some((w) => w.target === f && monthsBetween(w.at, date) <= RB.sownYears * 12);
  s.asks.push({ country: c, from: f, at: o.date || date, state: 'wait', ...(sown ? { sown: true } : {}) }); trim(s.asks); return 'ask';
}
export const activeAids = (s: RbSave): Aid[] => s.aids.filter((a) => a.state === 'on');
export const activeSows = (s: RbSave, date: string): Sow[] => s.sows.filter((w) => (ymd(w.until) ?? 0) > (ymd(date) ?? 0));
/** 이 나라에 지금 불안을 심을 수 있나(대기·동시 한도). 안 되면 까닭. */
export function sowBlock(s: RbSave, target: string, date: string): string | null {
  const last = [...s.sows].reverse().find((w) => w.target === target);
  if (last && monthsBetween(last.at, date) < RB.sowCoolMonths) return L(`${last.at}에 공작한 나라입니다(${RB.sowCoolMonths}달 대기).`, `We ran an operation here on ${last.at} (${RB.sowCoolMonths}-month wait).`);
  if (activeSows(s, date).length >= RB.sowMax) return L(`진행 중인 공작이 이미 ${RB.sowMax}건입니다.`, `${RB.sowMax} operations are already running.`);
  return null;
}
/** 이번 달 AI 가 우리에게 선동하나. */
export function aiSowRoll(s: RbSave, date: string, rnd: () => number = Math.random): boolean { return monthsBetween(s.lastAiSow, date) >= RB.aiSowCoolMonths && rnd() < RB.aiSowChance; }

// ---- 화면 문구 ----
export function stText(st: number): string {
  if (st === 0 || st === 1) return L('적용했습니다.', 'Done.');
  if (st === 3) return L('자원이 모자랍니다.', 'Not enough resources.');
  if (st === 4) return L('상대 나라를 찾을 수 없습니다(사라졌거나 연락이 끊김).', 'The other empire could not be found (gone, or out of contact).');
  if (st === 5) return L('불안을 심을 행성이 없습니다(수도 말고, 이미 공작 중인 곳 말고).', 'No planet to target (capital excluded, and none already under an operation).');
  return L('게임이 응답하지 않았습니다.', 'The game did not respond.');
}
export function vulnText(v: Vuln): string {
  if (!v.on) return L('주변에 우리를 압도하는 적대 세력이 없거나, 함대 한도를 충분히 채우고 있습니다.', 'No overwhelming hostile neighbour, or our naval capacity is well used.');
  return L(`${v.foe || '이웃 적대 세력'}의 함대가 우리를 압도하는데 함대 한도를 ${v.use ?? '?'}%만 쓰고 있어 백성이 흔들립니다(행성 안정도 −5, 파벌 지지 −10%). 함대 한도를 90% 넘게 채우면 풀립니다.`,
    `${v.foe || 'A hostile neighbour'} overwhelmingly outguns us while we use only ${v.use ?? '?'}% of our naval capacity, and our people are uneasy (stability −5, faction approval −10%). Fill naval capacity past 90% to end it.`);
}

// ---- 게임 명령: 플레이어 감싸기(This = 플레이어, event_target:sllm_rb_me) ----
const okN = (n: number, lo = 1) => Number.isSafeInteger(n) && n >= lo;
export function rbWrap(sid: string, body: string): string {
  if (!/^\d+$/.test(sid)) throw new Error('INVALID_RB');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } save_event_target_as = sllm_rb_me ${body} }`;
}
const chk = (...ns: number[]) => { if (!ns.every((n) => okN(n))) throw new Error('INVALID_RB'); };
/** 이 반란국이 우리에게 청할 만한가(연락 · 원래 나라와 사이가 나쁨). 회신 RBQ ok. */
export function aidQueryCommand(req: number, sid: string, tid: number, pid: number): string { chk(req, tid, pid); return rbWrap(sid, `sllm_rb_aid_q = { REQ = ${req} TID = ${tid} PID = ${pid} }`); }
export function aidStartCommand(req: number, sid: string, tid: number, tier: Tier): string { chk(req, tid); if (!isTier(tier)) throw new Error('INVALID_RB'); return rbWrap(sid, `sllm_rb_aid_start = { REQ = ${req} TID = ${tid} TIER = ${tier} }`); }
export function aidPayCommand(req: number, sid: string, tid: number, amt: number): string { chk(req, tid, amt); return rbWrap(sid, `sllm_rb_pay = { REQ = ${req} TID = ${tid} AMT = ${amt} }`); }
export function aidCaughtCommand(req: number, sid: string, pid: number, tier: Tier): string { chk(req, pid); if (!isTier(tier)) throw new Error('INVALID_RB'); return rbWrap(sid, `sllm_rb_aid_caught = { REQ = ${req} PID = ${pid} TIER = ${tier} }`); }
/** 우리 반란군을 AI 가 돕는다. 회신 RBAF st(1 도움) foe. */
export function aiFundCommand(req: number, sid: string, tid: number): string { chk(req, tid); return rbWrap(sid, `sllm_rb_ai_fund = { REQ = ${req} TID = ${tid} AMT = ${RB.aiFundAmt} }`); }
/** 취약 판정을 모드에 맡기기(2026-11-09 회랑 방식): 모드가 3달마다 스스로 판정하고, 상태가 바뀐 때만 RBV(req=0)를 남긴다. 회신 RBSET st 0. */
export function vulnAutoCommand(req: number, sid: string): string { chk(req); return rbWrap(sid, `sllm_rb_auto_on = { REQ = ${req} }`); }
/** 취약 판정(수정자도 모드가 붙이고 뗀다). 회신 RBV st use foe. 옛 방식 — 모드에 맡기지 못했을 때만. */
export function vulnCommand(req: number, sid: string): string { chk(req); return rbWrap(sid, `sllm_rb_vuln = { REQ = ${req} DAYS = ${RB.vulnDays} }`); }
/** 선동. DET = 들킴(앱이 굴림). 회신 RBSOW st planet. */
export function sowCommand(req: number, sid: string, tid: number, caught: boolean): string { chk(req, tid); return rbWrap(sid, `sllm_rb_sow = { REQ = ${req} TID = ${tid} INF = ${RB.sowInf} DAYS = ${RB.sowDays} DET = ${caught ? 'yes' : 'no'} }`); }
/** AI 가 우리 행성에 선동. 회신 RBAS st(1 당함) foe planet. */
export function aiSowCommand(req: number, sid: string): string { chk(req); return rbWrap(sid, `sllm_rb_ai_sow = { REQ = ${req} DAYS = ${RB.sowDays} }`); }

// ---- 서신(영어, AI 만 읽음) ----
export function askSituation(a: AidAsk, us: string): string {
  return [`You are the leadership of ${a.country}, a nation just born in a revolt against ${a.from}. ${a.from} still threatens you with everything it has.`,
    a.sown ? `You know that ${us} quietly stirred the unrest that made your revolution possible, and you are grateful.` : `${us} is known to have no love for ${a.from}.`,
    `Write a formal but urgent letter to ${us} asking for monthly support in energy and minerals to keep your young state alive. Do not name specific amounts. Do not promise treaties.`].join(' ');
}
export function thanksSituation(a: Aid, us: string): string { return `${us} has agreed to send you ${tierAmt(a.tier)} energy and ${tierAmt(a.tier)} minerals every month for five years to help you resist ${a.from}. Write a short, heartfelt letter of thanks.`; }
export function caughtSituation(a: Aid, us: string): string { return `You (${a.from}) have discovered that ${us} is secretly funding ${a.country}, the rebels who tore territory from you. Write a cold, furious diplomatic protest.`; }
export function sowCaughtSituation(w: Sow, us: string): string { return `Your security services caught agents of ${us} stirring unrest on your planet ${w.planet}. Write a sharp diplomatic protest demanding it stop.`; }
