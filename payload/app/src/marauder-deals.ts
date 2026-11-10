// 약탈자 대응(다음 업데이트, 2026-10-26 외부 건의 ②③). 순수 규칙. 앱: src/features/marauder-app.ts, 모드: tester-mod/common/scripted_effects/sllm_marauder_deals.txt.
// 바닐라 약탈자의 자발 습격(marauder.101 공물 요구)·습격 의뢰(marauder.33)·용병 고용(marauder.34)을 대화로 감싼다.
// 수치(사용자 확정 2026-10-26):
//   ② 위협 — 우리 함대 전력이 그 약탈자보다 우세(superior) 이상이면 성공, 대등(equivalent)이면 대화한 AI 가 판단, 열세 이하면 실패. 실패해도 추가 벌칙 없음(바닐라 습격 그대로).
//   ② 딴 데로 돌리기 — 바닐라 습격 의뢰 가격 3000 ±15%(AI 가 관계·대화로 정함). 대상은 연락 중인 일반 제국(경쟁국이 아니어도 됨).
//   ① 습격 의뢰(건의 ①, 2026-10-26) — 습격당하지 않을 때 대화로 습격을 맡긴다. 바닐라 「습격 의뢰」(marauder.20→31→32→33)와 같은 조건(그 약탈자가 다른 습격·쿨다운 중이 아님)·같은 가격 규칙(돌리기와 같은 3000 ±15%).
//     대상이 우리 경쟁국이 아니면 가격 1.5배 — 돌리기도 같음(사용자 확정 2026-10-26: 바닐라는 경쟁국에게만 의뢰 가능 → 대화로는 일반 제국 누구나, 대신 비쌈). 경쟁국인지는 수락 때 모드가 다시 확인한다.
//     약탈자는 후보 제국의 사정(우리 경쟁국·전쟁 상대·이웃·부유함·그 약탈자에 비한 함대 전력)을 보고 대상을 추천한다. 대상은 돌리기와 같다(통신 중인 일반 AI 제국, 이미 습격받는 곳 제외).
//   ③ 용병 흥정 — 할인만 0~15%. 고용은 바닐라 메뉴에서 하고, 흥정 뒤 1년 안에 그 약탈자의 용병을 처음 고용하면 할인분을 에너지로 돌려준다.
import { wrapForPlayer } from './protocol';

export const MRD = { hireNonRivalMult: 1.5, raidCost: 3000, redirectSwing: 15, mercMaxPct: 15, dealDays: 360, mercCost: { large: 9000, medium: 6500, small: 4000 } } as const;
export const POWER_NAMES = ['pathetic', 'inferior', 'equivalent', 'superior', 'overwhelming'] as const;
export interface MrdStatus { found: boolean; raid: boolean; pow: number; m: number; /** 습격 의뢰를 받을 수 있음(다른 습격·쿨다운 아님) */ free: boolean }
/** 대상 후보. f·tf 는 모드의 SLLM:MRDT 줄(없으면 모름). */
export interface RedirectTarget { idx: number; name: string; f?: number; tf?: number }
export const TF = { rival: 1, war: 2, border: 4, raided: 8, rich: 16 } as const

const int = (n: unknown): n is number => Number.isSafeInteger(n);
const okReq = (req: number) => int(req) && req >= 1;
const okIdx = (i: number) => int(i) && i >= 1;

/** 회신 SLLM:MRD op=status 줄 → 상태. 줄이 이상하면 null. */
export function parseStatus(kv: Record<string, string>): MrdStatus | null {
  const pow = Number(kv.pow), m = Number(kv.m);
  if (!Number.isFinite(pow) || !Number.isFinite(m)) return null;
  return { found: kv.found === '1', raid: kv.raid === '1', pow: Math.max(-1, Math.min(4, Math.round(pow))), m: Math.round(m), free: kv.free === '1' };
}
/** 회신 SLLM:MRDT 줄 → 대상 사정. 이상하면 null. */
export function parseTargetRow(kv: Record<string, string>): { idx: number; f: number; tf: number } | null {
  const idx = Math.round(Number(kv.idx)), f = Math.round(Number(kv.f)), tf = Math.round(Number(kv.tf));
  if (!okIdx(idx) || !Number.isFinite(f) || f < 0 || f > 31 || !Number.isFinite(tf)) return null;
  return { idx, f, tf: Math.max(0, Math.min(4, tf)) };
}
/** 사정을 붙인 후보 목록: 이미 습격받는 곳은 뺀다. 경쟁국·전쟁 상대·이웃·부유·약한 곳이 앞으로 오게 정렬하고 8곳까지. */
export function rankTargets(list: RedirectTarget[], rows: Map<number, { f: number; tf: number }>): RedirectTarget[] {
  const score = (t: RedirectTarget) => { const f = t.f ?? 0, tf = t.tf ?? 2; return (f & TF.war ? 8 : 0) + (f & TF.rival ? 6 : 0) + (f & TF.border ? 2 : 0) + (f & TF.rich ? 2 : 0) + (2 - tf); };
  return list.map((t) => { const r = rows.get(t.idx); return r ? { ...t, f: r.f, tf: r.tf } : t; })
    .filter((t) => !((t.f ?? 0) & TF.raided))
    .map((t, i) => ({ t, i })).sort((a, b) => score(b.t) - score(a.t) || a.i - b.i).map((x) => x.t).slice(0, 8);
}
/** 프롬프트용 대상 한 줄(영어): `7: Name (your rival, at war with you, weak against your fleets)`. */
export function targetText(t: RedirectTarget): string {
  const tags: string[] = [], f = t.f ?? 0;
  if (f & TF.rival) tags.push('their rival');
  if (f & TF.war) tags.push('at war with them');
  if (f & TF.border) tags.push('borders them');
  if (f & TF.rich) tags.push('richer than them');
  if (t.tf !== undefined) tags.push(t.tf <= 1 ? 'weak against your fleets' : t.tf >= 3 ? 'strong against your fleets' : 'evenly matched with your fleets');
  return `${t.idx}: ${t.name}${tags.length ? ` (${tags.join(', ')})` : ''}`;
}
/** 위협이 먹히는 최소 전력: 우세 이상이면 'superior'(무조건), 대등이면 'equivalent'(AI 판단), 그 아래면 null(실패). */
export function threatMin(pow: number): 'superior' | 'equivalent' | null { return pow >= 3 ? 'superior' : pow === 2 ? 'equivalent' : null; }
/** 돌리기 가격: 3000 × (1 + pct/100), pct 는 -15~15 로 자르고 10 단위로 맞춘다. */
export function redirectCost(pct: unknown): number {
  const p = Math.max(-MRD.redirectSwing, Math.min(MRD.redirectSwing, Math.round(Number(pct) || 0)));
  return Math.round((MRD.raidCost * (100 + p)) / 1000) * 10;
}
/** 의뢰·돌리기 가격: 3000 ±15%, 대상이 우리 경쟁국이 아니면 1.5배(10 단위). */
export function hireCost(pct: unknown, rival: boolean): number {
  const c = redirectCost(pct);
  return rival ? c : Math.round((c * MRD.hireNonRivalMult) / 10) * 10;
}
export const clampMercPct = (pct: unknown): number => Math.max(0, Math.min(MRD.mercMaxPct, Math.round(Number(pct) || 0)));

export function statusCommand(req: number, tid: number): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_MRD');
  return wrapForPlayer(`sllm_mrd_status = { REQ = ${req} TID = ${tid} }`);
}
export function withdrawCommand(req: number, tid: number, min: 'superior' | 'equivalent'): string {
  if (!okReq(req) || !okIdx(tid) || (min !== 'superior' && min !== 'equivalent')) throw new Error('INVALID_MRD');
  return wrapForPlayer(`sllm_mrd_withdraw = { REQ = ${req} TID = ${tid} MIN = ${min} }`);
}
export function redirectCommand(req: number, tid: number, target: number, cost: number, rival: boolean): string {
  if (!okReq(req) || !okIdx(tid) || !okIdx(target) || target === tid || !int(cost) || cost < 1 || cost > MRD.raidCost * 2) throw new Error('INVALID_MRD');
  return wrapForPlayer(`sllm_mrd_redirect = { REQ = ${req} TID = ${tid} TARGET = ${target} COST = ${cost} RIVAL = ${rival ? 1 : 0} }`);
}
/** rival = 앱이 경쟁국 가격으로 계산했나(1). 모드는 그 대상이 지금도 우리 경쟁국인지 확인하고, 아니면 받지 않는다(status=norival). */
export function hireCommand(req: number, tid: number, target: number, cost: number, rival: boolean): string {
  if (!okReq(req) || !okIdx(tid) || !okIdx(target) || target === tid || !int(cost) || cost < 1 || cost > MRD.raidCost * 2) throw new Error('INVALID_MRD');
  return wrapForPlayer(`sllm_mrd_hire = { REQ = ${req} TID = ${tid} TARGET = ${target} COST = ${cost} RIVAL = ${rival ? 1 : 0} }`);
}
export function mercDealCommand(req: number, tid: number, pct: number): string {
  if (!okReq(req) || !okIdx(tid) || !int(pct) || pct < 1 || pct > MRD.mercMaxPct) throw new Error('INVALID_MRD');
  return wrapForPlayer(`sllm_mrd_merc_deal = { REQ = ${req} TID = ${tid} PCT = ${pct} }`);
}
export const mercCheckCommand = (): string => wrapForPlayer('sllm_mrd_merc_check = yes');

/** 대화 프롬프트(영어). 약탈자(잠든 약탈자)와 통화할 때만. 이 줄이 있으면 일반 행동 목록 대신 이 행동만 쓴다. */
export function marauderLines(st: MrdStatus | null, o: { targets: RedirectTarget[]; score: number; dealActive: boolean }): string[] {
  const out: string[] = ['[Marauders] You lead a marauder clan. You respect strength and payment, not courtesy. The game actions open to you are only those listed below; never use give_energy, take_energy, open_borders, make_peace, defer or declare_war.'];
  if (st && st.raid) {
    const pw = st.pow >= 0 ? POWER_NAMES[st.pow] : 'unknown';
    out.push(`Your raiders are currently on their way to raid them (you demanded tribute; they can still pay it in the game's own window). Their fleet power compared to yours is "${pw}".`);
    if (st.pow >= 3) out.push(`If they threaten you with their fleets, you must back down: their navy is stronger than yours. Agree to call off the raid, grudgingly and in character, and set action to {"type":"marauder_withdraw"}.`);
    else if (st.pow === 2) out.push('If they threaten you, you are evenly matched: decide for yourself whether their threat is convincing. Only if it truly is, call off the raid and set action to {"type":"marauder_withdraw"}; otherwise laugh it off and use no action.');
    else out.push('Their threats are empty: your fleets outclass theirs. Refuse any threat and never use marauder_withdraw.');
    if (o.targets.length) {
      out.push(`They may instead pay you to send this raid against another empire. Base price ${MRD.raidCost} energy if the new target is their rival, ${MRD.raidCost * MRD.hireNonRivalMult} if it is not; you may set price_pct from -${MRD.redirectSwing} to ${MRD.redirectSwing} (cheaper if you like them, dearer if not; your opinion score of them is ${o.score}). Possible targets (id: name, as seen from their side): ${o.targets.map(targetText).join('; ')}. Only if they ask for it and you agree: {"type":"marauder_redirect","target":id,"price_pct":integer}. Name the price for that target in your line.`);
    }
  } else {
    out.push('You are not raiding them right now. Do not use marauder_withdraw or marauder_redirect.');
    if (st && st.free && o.targets.length) {
      out.push(`They may hire you to raid another empire. If they ask whom to raid, recommend one or two from this list and say why in your own voice: prefer their rivals and enemies, the rich, and those weak against your fleets; warn them off targets strong against your fleets. Targets (id: name, as seen from their side): ${o.targets.map(targetText).join('; ')}.`);
      out.push(`Price: base ${MRD.raidCost} energy if the target is their rival, ${MRD.raidCost * MRD.hireNonRivalMult} if it is not (you do not raid on request against just anyone without a premium); you may set price_pct from -${MRD.redirectSwing} to ${MRD.redirectSwing} (your opinion score of them is ${o.score}). Only if they ask to hire you and you agree: {"type":"marauder_hire","target":id,"price_pct":integer}. Name the target and the price for that target in your line.`);
    } else if (st && st.found && !st.free) {
      out.push('Your clan is busy with another raid or resting after one. If they ask to hire a raid, tell them to come back later. Do not use marauder_hire.');
    } else out.push('Do not use marauder_hire.');
  }
  if (o.dealActive) out.push('You already promised them a discount on hiring your mercenaries. Do not offer another.');
  else out.push(`They hire your mercenary fleets through the game's own Hire Mercenaries menu. If they haggle and you are willing, you may grant a discount of 1 to ${MRD.mercMaxPct} percent on their next hire within a year (more if you like them, none if you despise them; your opinion score of them is ${o.score}): {"type":"merc_discount","percent":integer}. Never raise the price.`);
  out.push('Actions only happen if they accept. Phrase it as an offer, never as already done.');
  return out;
}
