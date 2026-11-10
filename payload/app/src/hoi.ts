// 하츠 오브 아이언 4 참고 외교 3가지(2026-10-28 사용자 확정 — 1028_집컴_옮기기/외교_하츠참고_설계.md, 수치는 그날 제안안 그대로 승인).
//  ① 물자 지원(랜드리스): 전쟁 중인 제국에 참전 없이 매달 자원. 받는 쪽 호감 +30(시작) · 지원하는 동안 해마다 +10, 그 적국 -20(첩보 수준 30 이상이면 바로 앎, 아니면 해마다 20%).
//     최소 = 우리 그 자원 월수입 5%, 최대 = 20%(외교 거래와 같은 상한), 기간 1~5년. 참전 요청에 물자 지원으로 답하면 거절 감점 -30 → -10.
//  ② 상대국 파벌 지원·공작: 첩보 수준 30 이상(보고서 「보통」), 영향력 100 + 에너지 500. 2년.
//     그 나라 해당 이념 매력도 +15%, 수도 안정도 -5. 「지지도 해마다 +10%」는 바닐라 4.x 에 파벌 지지도를 직접 바꾸는 효과 사용례가 없어(게임 파일 확인)
//     2년째에 매력도 +10% 를 더하는 것으로 갈음한다. 발각: 해마다 15%(첩보 수준 60 이상이면 10%) → 상대 호감 -50, 은하재판소 고발(60%).
//     우리가 당하면: 시위 원인에 「외세 개입」, 그 제국 첩보 보고(첩보 수준 30 이상)로 배후가 드러난다.
//  ③ 종속국 자치도(0~100, 앱 계산): 불만(충성도 낮음)·종주국 패전·오래 이어진 평화 → 오름 / 지원·청원 승인·충성 → 내림.
//     40 이상: 권리 확대 요구(들어주면 -10, 거절 +10) · 70 이상: 독립 요구 서신 · 90 이상이 2년 = 실제 독립(set_subject_of none), 대화로 달래면 막을 수 있다.
import { wrapForPlayer } from './protocol';
import type { DealRes } from './deals';

const int = (n: unknown): n is number => Number.isSafeInteger(n);
const okReq = (r: number) => int(r) && r >= 1;
const okIdx = (i: number) => int(i) && i >= 1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---- ① 물자 지원
export const AID = { minShare: 0.05, maxShare: 0.2, minYears: 1, maxYears: 5, learnChance: 0.2, missLimit: 2 } as const;
export const HOI_MODS = { aidStart: 'sllm_aid_start', aidYear: 'sllm_aid_year', aidEnemy: 'sllm_aid_enemy', ctaAid: 'sllm_deal_cta_aid', fsupExposed: 'sllm_fsup_exposed' } as const;
export interface AidEnemy { idx: number; name: string; knows: boolean }
export interface Aid { id: string; tid: number; name: string; res: DealRes; amt: number; left: number; since: string; nextYear: string; miss: number; enemies: AidEnemy[]; done?: boolean; why?: string;
  /** 정기 송금(2026-11-09, sllm_mt 기능 3): 묶음 번호 · 이번 세션에 모드에 적었나 · 적은 달(그달은 세지 않음) · 모드가 못 냈다고 알린 달 · 칸이 모자라 앱이 매달 보냄 · 불러온 뒤 확인만 할 차례 */
  g?: number; reg?: boolean; rm?: string; sm?: string; legacy?: boolean; chk?: boolean }
/** 시작할 수 있는가: 양은 월수입의 5~20%, 기간 1~5년. 까닭 코드 목록(빈 목록 = 됨). */
export function aidCheck(amt: number, years: number, income: number, atWar: boolean): string[] {
  const err: string[] = [];
  if (!atWar) err.push('nowar');
  if (!int(years) || years < AID.minYears || years > AID.maxYears) err.push('years');
  const lo = Math.max(1, Math.ceil(Math.max(0, income) * AID.minShare)), hi = Math.floor(Math.max(0, income) * AID.maxShare);
  if (hi < lo) err.push('income');
  else if (!int(amt) || amt < lo || amt > hi) err.push('amount');
  return err;
}
export const aidRange = (income: number): { lo: number; hi: number } => ({ lo: Math.max(1, Math.ceil(Math.max(0, income) * AID.minShare)), hi: Math.floor(Math.max(0, income) * AID.maxShare) });
/** 참전 요청에 물자 지원으로 답할 때 기본안: 에너지, 월수입 5%(최소 10), 2년. */
export const ctaAidDefault = (energyIncome: number): { res: DealRes; amt: number; years: number } => ({ res: 'energy', amt: Math.max(10, Math.ceil(Math.max(0, energyIncome) * AID.minShare)), years: 2 });
/** 적국이 이번 해에 알게 되는가(첩보 수준 30 이상이면 처음부터 앎). */
export const enemyLearns = (rand: () => number): boolean => rand() < AID.learnChance;
export function aidEnemiesCommand(req: number, tid: number): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_AID');
  return wrapForPlayer(`sllm_aid_enemies = { REQ = ${req} TID = ${tid} }`);
}
/** sllm_deal_opinion 을 그대로 쓰되(같은 대상 찾기·중복 막기), 이 기능의 호감 수정자만 받는다. */
export function hoiOpinionCommand(req: number, tid: number, mod: string): string {
  if (!okReq(req) || !okIdx(tid) || !Object.values(HOI_MODS).includes(mod as never)) throw new Error('INVALID_AID');
  return wrapForPlayer(`sllm_deal_opinion = { REQ = ${req} TID = ${tid} MOD = ${mod} }`);
}

// ---- ② 파벌 지원·공작
/** 모드 파벌 가치관 번호(sllm_probe_embassy EMBFAC eth) → 바닐라 이념 키. */
export const ETH_KEYS = ['', 'militarist', 'pacifist', 'authoritarian', 'egalitarian', 'xenophile', 'xenophobe', 'materialist', 'spiritualist'] as const;
export type EthKey = Exclude<(typeof ETH_KEYS)[number], ''>;
export const isEth = (x: unknown): x is EthKey => typeof x === 'string' && x !== '' && (ETH_KEYS as readonly string[]).includes(x);
export const FSUP = { cost: { influence: 100, energy: 500 }, minIntel: 2, highIntel: 3, years: 2, expose: 0.15, exposeHigh: 0.1, accuse: 0.6, foreignChance: 0.04, foreignMax: 1, revealIntel: 2 } as const;
export const exposeChance = (intelBand: number): number => (intelBand >= FSUP.highIntel ? FSUP.exposeHigh : FSUP.expose);
export interface FsupOp { id: string; tid: number; name: string; eth: EthKey; faction: string; since: string; until: string; nextYear: string; year: number; exposed?: string; done?: boolean }
export function fsupStartCommand(req: number, tid: number, eth: EthKey): string {
  if (!okReq(req) || !okIdx(tid) || !isEth(eth)) throw new Error('INVALID_FSUP');
  return wrapForPlayer(`sllm_fsup_start = { REQ = ${req} TID = ${tid} ETH = ${eth} }`);
}
export function fsupMoreCommand(req: number, tid: number, eth: EthKey): string {
  if (!okReq(req) || !okIdx(tid) || !isEth(eth)) throw new Error('INVALID_FSUP');
  return wrapForPlayer(`sllm_fsup_more = { REQ = ${req} TID = ${tid} ETH = ${eth} }`);
}
/** AI 가 우리 파벌을 지원(우리에게 같은 수정자). */
export function fsupOnUsCommand(req: number, eth: EthKey): string {
  if (!okReq(req) || !isEth(eth)) throw new Error('INVALID_FSUP');
  return wrapForPlayer(`sllm_fsup_onus = { REQ = ${req} ETH = ${eth} }`);
}
/** 우리를 노릴 이념: 우리 정부 이념과 반대쪽(없으면 아무 쪽). */
const OPP: Record<EthKey, EthKey> = { militarist: 'pacifist', pacifist: 'militarist', authoritarian: 'egalitarian', egalitarian: 'authoritarian', xenophile: 'xenophobe', xenophobe: 'xenophile', materialist: 'spiritualist', spiritualist: 'materialist' };
export function foreignTargetEthic(ourEthics: string[], rand: () => number): EthKey {
  const opp = ourEthics.filter(isEth).map((e) => OPP[e]);
  const pool: EthKey[] = opp.length ? opp : (ETH_KEYS.filter(isEth) as EthKey[]);
  return pool[Math.floor(rand() * pool.length) % pool.length];
}
export interface ForeignOp { id: string; by: number; name: string; eth: EthKey; since: string; until: string; revealed?: string }

// ---- ③ 종속국 자치도
export const AUTO = { start: 20, rights: 40, independence: 70, breakaway: 90, breakawayMonths: 24, rightsYes: -10, rightsNo: 10, petitionYes: -5, aidMonth: -1, calm: -3, warLost: 10, peaceMonth: 0.15, peaceAfterMonths: 60 } as const;
export interface Autonomy { idx: number; name: string; v: number; peaceMonths: number; highSince?: string; rightsAsked?: string; rightsPending?: boolean; indepSent?: string; calmMonth?: string; free?: boolean }
/** 한 달 변화(순수). loyalty: 게임 충성도(대략 -100~100), atWar: 우리 전쟁 중, aidThisMonth: 이 종속국에 물자 지원 중. */
export function autonomyMonth(a: Autonomy, o: { loyalty: number; atWar: boolean; aided: boolean }): Autonomy {
  let d = 0;
  d += -clamp(o.loyalty, -100, 100) / 100; // 불만이면 +1/월까지, 충성스러우면 -1/월까지
  const peace = o.atWar ? 0 : a.peaceMonths + 1;
  if (!o.atWar && peace > AUTO.peaceAfterMonths) d += AUTO.peaceMonth; // 오래 이어진 평화(5년 넘게)
  if (o.aided) d += AUTO.aidMonth;
  return { ...a, v: Math.round(clamp(a.v + d, 0, 100) * 100) / 100, peaceMonths: peace };
}
export const autonomyAdd = (a: Autonomy, n: number): Autonomy => ({ ...a, v: Math.round(clamp(a.v + n, 0, 100) * 100) / 100 });
export type AutoStage = 'calm' | 'rights' | 'independence' | 'breakaway';
export const autoStage = (v: number): AutoStage => (v >= AUTO.breakaway ? 'breakaway' : v >= AUTO.independence ? 'independence' : v >= AUTO.rights ? 'rights' : 'calm');
export function autoFreeCommand(req: number, tid: number): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_AUTO');
  return wrapForPlayer(`sllm_auto_free = { REQ = ${req} TID = ${tid} }`);
}
