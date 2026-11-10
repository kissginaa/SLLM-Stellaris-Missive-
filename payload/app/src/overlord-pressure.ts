// 역방향: AI 종주국이 플레이어에게(2026-11-05 사용자: 「플레이어가 AI에게 당할 때만 역으로 생기게 하자」). 순수 규칙.
// 앱: src/features/overlord-pressure-app.ts · 화면: ui/overlord-orders.js(종속국 창의 종주국 채널 「명령」 탭)
// 모드: 종속국 통치권 효과(sllm_vassal_reign.txt)를 「우리 = 종속국(sllm_vr_t), 종주국 = sllm_vr_me」로 뒤집어 그대로 쓴다 + sllm_vo_* 몇 개.
//   ① 대리전 명령: 우리 이웃을 치라 — 따르면 우리가 선전포고(대리전 전쟁 목표), 거절하면 종주국 관계 −60·우리 충성도 매달 −1(2년).
//   ② 함대 징발: 우리 가장 센 함대를 2년간 종주국 지휘 아래 — 거절 같음.
//   ③ 함대 헌납: 우리 가장 센 함대를 아주 — 거절 같음. 10년 안에 두 번 거절하면 종주국이 강제로 빼앗는다.
//   ④ 감시관 파견(통치자 교체의 순한 판): 종주국 감시관을 궁정에 들임 — 받으면 5년간 통합력 −10%·충성도 매달 +1, 거절 같음.
//   ⑤ 정책·종족 권리 동조: 종속된 지 5년마다 저절로 한 걸음(선택 없음).
//   ⑥ 간섭 반감: 우리가 받아들인 명령·동조마다 우리 백성이 반감(행성 안정도·파벌 지지, 종속국 쪽과 같은 단계).
//   ⑦ 종속국 쟁탈(AI → 우리): 우리 종속국과 국경이 닿은, 우리를 싫어하는 AI 가 그 종속국에 대한 전쟁명분을 얻는다(5년). AI 가 이기면 빼앗긴다.
// 명령은 60일 안에 답하지 않으면 거절로 친다. AI 종주국끼리·AI 종속국에게는 아무 일도 없다.
import { L } from './i18n-pick';
import { yearsSince } from './vassal-reign';

export const VO = {
  gapMonths: 12, answerDays: 60,
  proxy: { chance: 1 / 24, coolMonths: 36 }, levy: { chance: 1 / 24, coolMonths: 24, minFleets: 2 }, tithe: { chance: 1 / 48, coolMonths: 72, minFleets: 3 }, minder: { chance: 1 / 60, coolMonths: 120 },
  alignYears: 5, defyDays: 720, minderDays: 1800, forceAfter: 2, forceYears: 10,
  prize: { chance: 1 / 36, coolMonths: 24 },
} as const;
export type OrderType = 'proxy' | 'levy' | 'tithe' | 'minder';
export const ORDER_TYPES: OrderType[] = ['proxy', 'levy', 'tithe', 'minder'];
export interface Order { id: string; type: OrderType; at: string; due: string; target?: string; fleet?: string }
export const ORDER_NAME: Record<OrderType, [string, string]> = { proxy: ['대리전 명령', 'Proxy-war order'], levy: ['함대 징발', 'Fleet levy'], tithe: ['함대 헌납', 'Fleet tithe'], minder: ['감시관 파견', 'Court minder'] };
export const ORDER_ICON: Record<OrderType, string> = { proxy: '⚔', levy: '⚓', tithe: '⚑', minder: '◉' };

const monthsSince = (a: string | undefined, b: string): number => (a ? Math.floor(Math.max(0, yearsSince(a, b)) * 12) : Infinity);
/** 이번 달 어떤 명령이 올까(없으면 null). last = 종류별 마지막 명령 날짜, any = 아무 명령 마지막 날짜. fleets = 우리 이동 가능한 전투 함대 수. */
export function rollOrder(date: string, last: Partial<Record<OrderType, string>>, any: string | undefined, fleets: number, rnd: () => number = Math.random): OrderType | null {
  if (monthsSince(any, date) < VO.gapMonths) return null;
  for (const t of ORDER_TYPES) {
    const c = VO[t];
    if (monthsSince(last[t], date) < c.coolMonths) continue;
    if ((t === 'levy' && fleets < VO.levy.minFleets) || (t === 'tithe' && fleets < VO.tithe.minFleets)) continue;
    if (rnd() < c.chance) return t;
  }
  return null;
}
/** 헌납 거절이 10년 안에 두 번째면 강제로 빼앗는다. */
export function forceDue(refusals: string[], date: string): boolean { return refusals.filter((d) => yearsSince(d, date) < VO.forceYears).length >= VO.forceAfter; }
export const alignDue = (since: string | undefined, last: string | undefined, date: string): boolean => !!since && yearsSince(last || since, date) >= VO.alignYears;

/** 명령 한 줄(화면). */
export function orderText(o: Order, overlord: string): string {
  if (o.type === 'proxy') return L(`${overlord}이(가) 우리에게 이웃 ${o.target}을(를) 치라고 명합니다. 따르면 우리가 선전포고합니다.`, `${overlord} orders us to attack our neighbour ${o.target}. If we obey, we declare war.`);
  if (o.type === 'levy') return L(`${overlord}이(가) 우리 함대 「${o.fleet}」을(를) 2년간 내놓으라고 합니다(그 지휘 아래, 끝나면 돌아옴).`, `${overlord} demands our fleet "${o.fleet}" for 2 years (under its command; it returns afterwards).`);
  if (o.type === 'tithe') return L(`${overlord}이(가) 우리 함대 「${o.fleet}」을(를) 아주 바치라고 합니다.`, `${overlord} demands that we hand over our fleet "${o.fleet}" for good.`);
  return L(`${overlord}이(가) 자기 감시관을 우리 궁정에 들이라고 합니다(5년간 통합력 −10%, 충성도 매달 +1).`, `${overlord} demands that we accept its minder at our court (unity −10% and loyalty +1/month for 5 years).`);
}
export const refuseText = (): string => L('거절하면 종주국 관계 −60, 우리 충성도 매달 −1(2년). 헌납을 10년 안에 두 번 거절하면 강제로 빼앗깁니다.', 'Refusing: overlord opinion −60 and our loyalty −1/month for 2 years. Refusing a tithe twice within 10 years means it is seized anyway.');
/** 종주국 명령서(영어, AI 만 읽음). */
export function orderSituation(o: Order, us: string): string {
  if (o.type === 'proxy') return `You command your subject ${us} to wage war on its neighbour ${o.target} on your behalf. Write a formal order: why ${o.target} must be punished and what you expect.`;
  if (o.type === 'levy') return `You demand that your subject ${us} place its fleet "${o.fleet}" under your command for two years. Write a formal demand.`;
  if (o.type === 'tithe') return `You demand that your subject ${us} hand over its fleet "${o.fleet}" to you for good, as tribute. Write a formal, imperious demand.`;
  return `You will send one of your officials to sit at the court of your subject ${us} as a minder, to "advise" its ruler. Write a formal notice that brooks little argument.`;
}
export function answerSituation(o: Order, us: string, accepted: boolean, forced = false): string {
  if (forced) return `Your subject ${us} refused twice to hand over a fleet, so you seized the "${o.fleet}" by force. Write a cold notice of what was done and why.`;
  return accepted ? `Your subject ${us} obeyed your ${ORDER_NAME[o.type][1].toLowerCase()}. Write a short, condescending acknowledgement.` : `Your subject ${us} refused your ${ORDER_NAME[o.type][1].toLowerCase()}. Write a short, ominous rebuke.`;
}

// ---- 게임 명령: 「뒤집은」 감싸기 — sllm_vr_t = 우리(플레이어), sllm_vr_me = 우리 종주국 ----
const okReq = (r: number) => Number.isSafeInteger(r) && r >= 1;
export function revWrap(sid: string, body: string): string {
  if (!/^\d+$/.test(sid)) throw new Error('INVALID_VO');
  return `effect every_playable_country = { limit = { is_ai = no has_any_overlord = yes check_variable = { which = sllm_save_id value = ${sid} } } save_event_target_as = sllm_vr_t overlord = { save_event_target_as = sllm_vr_me } ${body} }`;
}
/** 거절: 종주국 관계 −60, 우리 충성도 매달 −1. 회신 VRSET st 9. */
export function defyCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vo_defy = { REQ = ${req} DAYS = ${VO.defyDays} }`); }
/** 감시관 받아들임. 회신 VRSET st 9. */
export function minderCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vo_minder = { REQ = ${req} DAYS = ${VO.minderDays} }`); }
/** 우리 이웃 목록(대리전 대상) — 종속국 쪽 sllm_vr_targets 를 뒤집어. 줄 VRTGT … VRTEND. */
export function revTargetsCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_targets = { REQ = ${req} }`); }
/** 따름: 우리가 선전포고(비용 없음, 대상 표식 sllm_vr_px_0). */
export function revProxyCommand(req: number, sid: string, n: number): string { if (!okReq(req) || !Number.isSafeInteger(n) || n < 1) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_proxy = { REQ = ${req} N = ${n} TID = 0 COST = 0 E = 0 }`); }
export function revProxyCheckCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_proxy_chk = { REQ = ${req} TID = 0 }`); }
/** 우리 함대 목록. 줄 VRFLT … VRFEND(cnt). */
export function revFleetsCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_fleets = { REQ = ${req} }`); }
export function revLevyCommand(req: number, sid: string, n: number, days: number): string { if (!okReq(req) || !Number.isSafeInteger(n) || n < 1) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_levy = { REQ = ${req} N = ${n} COST = 0 DAYS = ${Math.round(days)} }`); }
export function revLevyCheckCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_levy_chk = { REQ = ${req} }`); }
export function revTitheCommand(req: number, sid: string, n: number, force: boolean, days: number): string {
  if (!okReq(req) || !Number.isSafeInteger(n) || n < 1) throw new Error('INVALID_VO');
  return revWrap(sid, `sllm_vr_tithe = { REQ = ${req} N = ${n} COST = 0 MOD = sllm_vr_tithe${force ? '_forced' : ''} DAYS = ${Math.round(days)} }`);
}
export function revAlignCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VO'); return revWrap(sid, `sllm_vr_align = { REQ = ${req} }`); }
export function revMeddleCommand(req: number, sid: string, tier: number, days: number): string {
  if (!okReq(req) || !Number.isSafeInteger(tier) || tier < 0 || tier > 3 || !Number.isSafeInteger(days) || days < 1) throw new Error('INVALID_VO');
  return revWrap(sid, `sllm_vr_meddle = { REQ = ${req} TIER = ${Math.max(1, tier)} DAYS = ${days} ON = ${tier > 0 ? 'yes' : 'no'} }`);
}
/** ⑦ AI 이웃이 우리 종속국을 노린다(보통 감싸기: 우리 = sllm_vr_me). 줄 VOPZ(name 종속국, foe AI) + VRSET(st 9 생김 / 0 없음). */
export function aiPrizeCommand(req: number, sid: string): string {
  if (!okReq(req) || !/^\d+$/.test(sid)) throw new Error('INVALID_VO');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } save_event_target_as = sllm_vr_me sllm_vo_prize_ai = { REQ = ${req} DAYS = 1800 } }`;
}
