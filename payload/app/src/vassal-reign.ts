// 종속국 통치권(2026-11-05 사용자: Vassals Expanded and Reworked 모드를 「참고만」 해서 우리 식으로 직접 만든다 — 이름·변수·수치는 우리 것, 코드 복사 없음).
// 순수 규칙 — 앱: src/features/vassal-reign-app.ts · 화면: ui/vassal-reign.js(종속국 창) · 모드: tester-mod/common/scripted_effects/sllm_vassal_reign.txt
//   ① 괴뢰 통치자 앉히기: 종속국 지도자 한 명(영향력 150) 또는 우리 지도자 한 명(영향력 250, 그 나라로 넘어감)을 통치자로 앉힌다. 10년에 한 번.
//      새 통치자는 5년간 충성도 매달 +1.5(우리 사람이면 +2.5), 자치도 +8(우리 사람이면 +15). 밀려난 통치자는 궁정에 남아 원한을 품는다(3년간 충성도 매달 −0.5, 10년간 가끔 서신).
//   ② 대리전 지시: 종속국 이웃(우리 동맹·연방·방위조약·종속국이 아닌 나라)을 치라고 명한다(영향력 50, 종속국마다 2년에 한 번).
//      종속국 통치자는 충성도·자치도·전쟁 중 여부에 따라 수락·주저(지원금을 바람)·거절. 거절하면 자치도 +5. 결과는 서신·연대기·세계 소식.
//   ③ 간섭 반감: 우리가 종속국 일에 손댈 때마다(성계 가져오기·기술 원조·개명 칙령·동화 시작·윤리 이동·정책 동조·통치자 교체·대리전 지시) 「간섭 열기」가 쌓인다.
//      열기 2·5·9 = 반감 1·2·3단계(행성 안정도 −5·−10·−15, 파벌 지지 −5%·−10%·−20%). 충성스러운 종속국(60 이상)은 열기 절반·기간 180일,
//      충성도 20 미만은 열기 1.25배·540일, 그 밖 360일. 열기는 6달마다 1씩 식는다.
//   ④ 정책·종족 권리 동조: 동화 정책 중 5년마다(윤리 이동과 같은 때) 종속국 정책 하나, 그다음 종족 권리 하나(시민권·생활 수준)가 우리 쪽으로 한 걸음.
//   ⑤ 종속국 쟁탈 전쟁명분: 우리와 국경이 닿은 남의 종속국을 고르면(영향력 100) 그 종주국에 대한 전쟁명분(5년)이 생긴다.
//      그 명분으로 이기면 그 종속국이 우리 종속국이 되고, 그 나라 종족 가운데 새 통치자가 선다(①과 같은 「괴뢰 통치자」 수정자).
//   ⑥ 함대 징발(2026-11-05 사용자 「둘다 좋군」): 종속국 함대 하나를 2년간 우리 지휘 아래(give_fleet, 소유는 그대로). 영향력 25. 수락 = 우리가 고른 함대,
//      주저 = 가장 약한 함대만, 거절 = 자치도 +5. 징발 중 그 함대를 잃으면 종속국이 원망(자치도 +5, 서신). 끝나면 1년 쉬고 다시.
//   ⑦ 함대 헌납: 종속국 함대 하나를 아주 넘겨받는다(set_owner). 마지막 전투 함대는 안 된다. 영향력 75, 5년에 한 번.
//      수락 = 자치도 +10·충성도 매달 -1(2년) / 거절하면 「강제로 받아 내기」(자치도 +20·충성도 매달 -2(3년)·간섭 열기 큼·원한 서신) 또는 그만두기.
// 문구는 L(한, 영). LLM 은 서신만(새 통치자·밀려난 통치자·대리전 답).
import { L } from './i18n-pick';

export const VR = {
  installCost: 150, installOursCost: 250, installCoolYears: 10, puppetDays: 1800, installAuto: 8, installOursAuto: 15,
  grudgeYears: 10, grudgeChance: 1 / 24, grudgeDays: 1080,
  levyCost: 25, levyDays: 720, levyCoolYears: 1, levyRefuseAuto: 5, titheCost: 75, titheCoolYears: 5, titheAuto: 10, titheForceAuto: 20, titheDays: 720, titheForceDays: 1080,
  proxyCost: 50, proxyCoolYears: 2, proxyRefuseAuto: 5, bribeBase: 200, bribePerAuto: 5, bribeMax: 800, proxyCheckMonths: 1,
  prizeCost: 100, prizeDays: 1800,
  heat: { take: 3, tech: 1, rename: 3, assim: 2, shift: 2, align: 1, puppet: 5, proxy: 2, levy: 1, tithe: 4, force: 6 } as Record<string, number>,
  tiers: [2, 5, 9], decayMonths: 6, loyalHigh: 60, loyalLow: 20,
  listMax: 60,
} as const;
export type MeddleKind = 'take' | 'tech' | 'rename' | 'assim' | 'shift' | 'align' | 'puppet' | 'proxy' | 'levy' | 'tithe' | 'force';
export const MEDDLE_KINDS: MeddleKind[] = ['take', 'tech', 'rename', 'assim', 'shift', 'align', 'puppet', 'proxy', 'levy', 'tithe', 'force'];
export const MEDDLE_NAME: Record<MeddleKind, [string, string]> = {
  take: ['성계 가져오기', 'taking a system'], tech: ['기술 원조', 'technology aid'], rename: ['개명 칙령', 'a renaming edict'], assim: ['동화 정책 시작', 'starting assimilation'],
  shift: ['정부 윤리 이동', 'an ethics shift'], align: ['정책·권리 동조', 'policy alignment'], puppet: ['통치자 교체', 'replacing the ruler'], proxy: ['대리전 지시', 'a proxy-war order'],
  levy: ['함대 징발', 'levying a fleet'], tithe: ['함대 헌납', 'a fleet tithe'], force: ['함대 강제 헌납', 'seizing a fleet'],
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const yearsBetween = (a: string, b: string): number => { const p = (d: string) => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + Number(m[3]) : null; }; const x = p(a), y = p(b); return x === null || y === null ? Infinity : (y - x) / 360; };
export const yearsSince = yearsBetween;
/** 쿨다운이 남았는지(남은 해, 없으면 0). */
export function coolLeft(since: string | undefined, now: string, years: number): number { if (!since) return 0; const y = yearsBetween(since, now); return y >= years || y < 0 ? 0 : Math.ceil(years - y); }

// ---- ③ 간섭 반감 ----
export interface Heat { h: number; at: string; tier: number }
/** 충성도 → 열기 배수·기간(일). */
export function heatScale(loyalty: number | null): { f: number; days: number } {
  if (loyalty !== null && loyalty >= VR.loyalHigh) return { f: 0.5, days: 180 };
  if (loyalty !== null && loyalty < VR.loyalLow) return { f: 1.25, days: 540 };
  return { f: 1, days: 360 };
}
export const tierOf = (h: number): number => (h >= VR.tiers[2] ? 3 : h >= VR.tiers[1] ? 2 : h >= VR.tiers[0] ? 1 : 0);
/** at 부터 date 까지 식힌다(6달마다 −1). */
export function cool(hh: Heat, date: string): Heat {
  const months = Math.floor(Math.max(0, yearsBetween(hh.at, date)) * 12);
  if (!Number.isFinite(months) || months < VR.decayMonths) return hh;
  const steps = Math.floor(months / VR.decayMonths), h = Math.max(0, Math.round((hh.h - steps) * 100) / 100);
  return { ...hh, h, at: date };
}
/** 간섭 한 번: 식힌 뒤 열기를 더하고 새 단계·기간을 돌려준다. */
export function meddle(prev: Heat | undefined, kind: MeddleKind, loyalty: number | null, date: string): { heat: Heat; tier: number; days: number; changed: boolean } {
  const base = cool(prev ?? { h: 0, at: date, tier: 0 }, date), s = heatScale(loyalty);
  const h = Math.round((base.h + (VR.heat[kind] ?? 1) * s.f) * 100) / 100, tier = tierOf(h);
  return { heat: { h, at: date, tier }, tier, days: s.days, changed: tier !== base.tier || tier > 0 };
}
/** 화면용 한 줄. */
export function heatText(hh: Heat | undefined): string {
  if (!hh || hh.tier <= 0) return L('간섭 반감 없음', 'No resentment of meddling');
  const pen = [[-5, -5], [-10, -10], [-15, -20]][hh.tier - 1];
  return L(`간섭 반감 ${hh.tier}단계 — 행성 안정도 ${pen[0]}, 파벌 지지 ${pen[1]}% (열기 ${hh.h})`, `Meddling resentment tier ${hh.tier} — planet stability ${pen[0]}, faction approval ${pen[1]}% (heat ${hh.h})`);
}

// ---- ② 대리전 ----
export type ProxyAnswer = 'accept' | 'hesitate' | 'refuse';
/** 수락·주저·거절 확률. loyalty 모르면 30, autonomy 0~100. */
export function proxyOdds(loyalty: number | null, autonomy: number, atWar: boolean): { accept: number; refuse: number; hesitate: number } {
  const l = loyalty ?? 30, a = clamp(autonomy || 0, 0, 100);
  let accept = clamp(0.25 + l / 150 - a / 250 - (atWar ? 0.2 : 0), 0.05, 0.85);
  let refuse = clamp(0.25 - l / 200 + a / 150 + (atWar ? 0.15 : 0), 0.05, 0.8);
  if (accept + refuse > 0.95) { const k = 0.95 / (accept + refuse); accept *= k; refuse *= k; }
  return { accept: Math.round(accept * 100) / 100, refuse: Math.round(refuse * 100) / 100, hesitate: Math.round((1 - accept - refuse) * 100) / 100 };
}
export function proxyRoll(loyalty: number | null, autonomy: number, atWar: boolean, rnd: () => number = Math.random): ProxyAnswer {
  const o = proxyOdds(loyalty, autonomy, atWar), r = rnd();
  return r < o.accept ? 'accept' : r < o.accept + o.refuse ? 'refuse' : 'hesitate';
}
/** 주저할 때 바라는 지원금(에너지). */
export const bribeFor = (autonomy: number): number => Math.min(VR.bribeMax, Math.round((VR.bribeBase + VR.bribePerAuto * clamp(autonomy || 0, 0, 100)) / 10) * 10);
/** 서신에 줄 상황(영어, AI 만 읽음). */
export function proxySituation(ans: ProxyAnswer, target: string, bribe: number): string {
  if (ans === 'accept') return `Your overlord has ordered you to wage war on your neighbour ${target} on its behalf. You have agreed and your fleets are moving. Write to the overlord announcing that you obey and are declaring war.`;
  if (ans === 'refuse') return `Your overlord has ordered you to wage war on your neighbour ${target} on its behalf. You refuse: you will not bleed your people for the overlord's quarrel. Write a firm but careful refusal.`;
  return `Your overlord has ordered you to wage war on your neighbour ${target} on its behalf. You hesitate: your treasury and fleets are not ready. Write that you will go to war only if the overlord sends ${bribe} energy credits to fund the campaign.`;
}

// ---- 게임 명령(every_playable_country = 플레이어, sllm_vr_me = 우리, sllm_vr_t = 종속국) ----
const okReq = (r: number) => Number.isSafeInteger(r) && r >= 1;
const okSid = (s: string) => /^\d+$/.test(s);
const okIdx = (i: number) => Number.isSafeInteger(i) && i >= 1;
const okN = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= 100000;
function wrap(sid: string, idx: number, body: string): string {
  if (!okSid(sid) || !(idx === 0 || okIdx(idx))) throw new Error('INVALID_VR');
  const t = idx > 0 ? `random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } } save_event_target_as = sllm_vr_t } ` : '';
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } save_event_target_as = sllm_vr_me ${t}${body} }`;
}
/** ① 후보 지도자 목록: 종속국 지도자(지금 통치자 빼고) + 우리 지도자(통치자·후계자 빼고). 줄 VRLDR(n, side t|me, name, cls) … VRLEND. */
export function leadersCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VR'); return wrap(sid, idx, `sllm_vr_leaders = { REQ = ${req} }`); }
/** ① 통치자 앉히기. side t = 종속국 사람, me = 우리 사람. 회신 VRSET st: 0 없음 · 3 영향력 부족 · 6 게임이 받아들이지 않음 · 7 쿨다운 · 9 됨(old·new 이름). */
export function installCommand(req: number, sid: string, idx: number, n: number, side: 't' | 'me'): string {
  if (!okReq(req) || !okIdx(idx) || !okN(n) || (side !== 't' && side !== 'me')) throw new Error('INVALID_VR');
  return wrap(sid, idx, `sllm_vr_install = { REQ = ${req} N = ${n} OWNER = sllm_vr_${side} COST = ${side === 'me' ? VR.installOursCost : VR.installCost} MOD = sllm_vr_puppet${side === 'me' ? '_ours' : ''} MOVE = ${side === 'me' ? 'yes' : 'no'} DAYS = ${VR.puppetDays} }`);
}
/** ② 대리전 대상 목록(종속국의 이웃). 줄 VRTGT(n, name) … VRTEND. */
export function targetsCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VR'); return wrap(sid, idx, `sllm_vr_targets = { REQ = ${req} }`); }
/** ② 대리전 선포. cost = 영향력, energy = 지원금(주저 때). 회신 VRSET st: 0 대상 없음 · 3 영향력 부족 · 4 에너지 부족 · 6 선포 실패(돌려줌) · 9 됨. */
export function proxyCommand(req: number, sid: string, idx: number, n: number, cost: number, energy: number): string {
  if (!okReq(req) || !okIdx(idx) || !okN(n) || ![cost, energy].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 5000)) throw new Error('INVALID_VR');
  return wrap(sid, idx, `sllm_vr_proxy = { REQ = ${req} N = ${n} TID = ${idx} COST = ${cost} E = ${energy} }`);
}
/** ② 지시값(영향력)만 받기 — 주저·거절해도 지시는 내렸으니. 회신 VRSET st 3·9. */
export function payCommand(req: number, sid: string, cost: number): string {
  if (!okReq(req) || !Number.isSafeInteger(cost) || cost < 0 || cost > 5000) throw new Error('INVALID_VR');
  return wrap(sid, 0, `sllm_vr_pay = { REQ = ${req} COST = ${cost} }`);
}
/** ② 선포가 실제로 안 됐을 때 돌려주기. 회신 VRSET st 9. */
export function refundCommand(req: number, sid: string, idx: number, cost: number, energy: number): string {
  if (!okReq(req) || !okIdx(idx) || ![cost, energy].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 5000)) throw new Error('INVALID_VR');
  return wrap(sid, idx, `sllm_vr_refund = { REQ = ${req} COST = ${cost} E = ${energy} }`);
}
/** ② 대리전이 아직 이어지는지. 회신 VRPXW(war 1/0). */
export function proxyCheckCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VR'); return wrap(sid, idx, `sllm_vr_proxy_chk = { REQ = ${req} TID = ${idx} }`); }
/** ③ 반감 단계 걸기(0 = 치우기). 회신 VRSET st 9. */
export function meddleCommand(req: number, sid: string, idx: number, tier: number, days: number): string {
  if (!okReq(req) || !okIdx(idx) || !Number.isSafeInteger(tier) || tier < 0 || tier > 3 || !Number.isSafeInteger(days) || days < 1 || days > 3600) throw new Error('INVALID_VR');
  return wrap(sid, idx, `sllm_vr_meddle = { REQ = ${req} TIER = ${Math.max(1, tier)} DAYS = ${days} ON = ${tier > 0 ? 'yes' : 'no'} }`);
}
/** ④ 정책·종족 권리 한 걸음. 줄 VRALN(k, key, sp) + VRSET(st 9 = 바뀜, 0 = 더 맞출 것 없음). */
export function alignCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VR'); return wrap(sid, idx, `sllm_vr_align = { REQ = ${req} }`); }
/** ⑤ 쟁탈 후보: 우리와 국경이 닿은 남의 종속국. 줄 VRPZ(n, name, ov, cb) … VRPZEND. */
export function prizesCommand(req: number, sid: string): string { if (!okReq(req)) throw new Error('INVALID_VR'); return wrap(sid, 0, `sllm_vr_prizes = { REQ = ${req} }`); }
/** ⑤ 전쟁명분 얻기. 회신 VRSET st: 0 없음 · 3 영향력 부족 · 8 이미 있음 · 9 됨. */
export function prizeCommand(req: number, sid: string, n: number): string {
  if (!okReq(req) || !okN(n)) throw new Error('INVALID_VR');
  return wrap(sid, 0, `sllm_vr_prize_cb = { REQ = ${req} N = ${n} COST = ${VR.prizeCost} DAYS = ${VR.prizeDays} }`);
}

// ---- ④ 동조 결과 이름 ----
export const POLICY_ALIGN: Array<[string, string, [string, string]]> = [
  ['war_philosophy', 'unrestricted_wars', ['전쟁 철학: 무제한 전쟁', 'War philosophy: unrestricted wars']], ['war_philosophy', 'liberation_wars', ['전쟁 철학: 해방 전쟁', 'War philosophy: liberation wars']], ['war_philosophy', 'no_wars', ['전쟁 철학: 방어 전쟁만', 'War philosophy: defensive wars only']],
  ['orbital_bombardment', 'orbital_bombardment_selective', ['궤도 폭격: 선별', 'Orbital bombardment: selective']], ['orbital_bombardment', 'orbital_bombardment_indiscriminate', ['궤도 폭격: 무차별', 'Orbital bombardment: indiscriminate']],
  ['border_policy', 'border_policy_open', ['국경: 개방', 'Borders: open']], ['border_policy', 'border_policy_closed', ['국경: 폐쇄', 'Borders: closed']],
  ['first_contact_protocol', 'first_contact_proactive', ['첫 접촉: 적극', 'First contact: proactive']], ['first_contact_protocol', 'first_contact_cautious', ['첫 접촉: 신중', 'First contact: cautious']], ['first_contact_protocol', 'first_contact_attack_allowed', ['첫 접촉: 공격 허용', 'First contact: attack allowed']],
  ['slavery', 'slavery_not_allowed', ['노예제: 금지', 'Slavery: outlawed']], ['slavery', 'slavery_allowed', ['노예제: 허용', 'Slavery: allowed']],
  ['purge', 'purge_not_allowed', ['숙청: 금지', 'Purge: outlawed']], ['purge', 'purge_displacement_only', ['숙청: 추방만', 'Purge: displacement only']],
  ['artificial_intelligence_policy', 'ai_outlawed', ['인공지능: 금지', 'AI: outlawed']], ['artificial_intelligence_policy', 'ai_servitude', ['인공지능: 예속', 'AI: servitude']], ['artificial_intelligence_policy', 'ai_full_rights', ['인공지능: 완전한 권리', 'AI: full rights']],
  ['refugees', 'refugees_not_allowed', ['난민: 받지 않음', 'Refugees: not allowed']], ['refugees', 'refugees_only_citizens', ['난민: 시민만', 'Refugees: citizens only']], ['refugees', 'refugees_allowed', ['난민: 받음', 'Refugees: allowed']],
  ['population_controls', 'population_controls_not_allowed', ['인구 통제: 금지', 'Population controls: not allowed']], ['population_controls', 'population_controls_allowed', ['인구 통제: 허용', 'Population controls: allowed']],
  ['resettlement', 'resettlement_not_allowed', ['강제 이주: 금지', 'Resettlement: not allowed']], ['resettlement', 'resettlement_allowed', ['강제 이주: 허용', 'Resettlement: allowed']],
];
export const RIGHT_ALIGN: Array<[string, [string, string]]> = [
  ['citizenship_full', ['완전 시민권', 'full citizenship']], ['citizenship_limited', ['제한 시민권', 'residence']], ['citizenship_slavery', ['노예화', 'chattel slavery']],
  ['living_standard_good', ['생활 수준: 사회 복지', 'living standard: social welfare']], ['living_standard_normal', ['생활 수준: 보통', 'living standard: normal']], ['living_standard_subsistence', ['생활 수준: 최저 생계', 'living standard: subsistence']],
];
/** VRALN 한 줄 → 사람 말. k: 1..정책 번호, 100+권리 번호. sp = 종족 이름. */
export function alignText(k: number, sp: string): [string, string] | null {
  if (k >= 1 && k <= POLICY_ALIGN.length) return POLICY_ALIGN[k - 1][2];
  if (k >= 101 && k <= 100 + RIGHT_ALIGN.length) { const r = RIGHT_ALIGN[k - 101][1], s = String(sp || '').replace(/^\\/, '').slice(0, 40) || '?'; return [`${s} — ${r[0]}`, `${s} — ${r[1]}`]; }
  return null;
}

// ---- 줄 읽기 ----
const sv = (v: unknown) => String(v ?? '').replace(/^\\/, '').trim();
export interface VrLeader { n: number; side: 't' | 'me'; name: string; cls: string }
export function readLeader(kv: Record<string, string>): VrLeader | null {
  const sd = sv(kv.side), sn = Math.round(Number(sd)), side = sn === 1 ? 't' : sn === 2 ? 'me' : sd; // 연결 모드는 side 를 변수 번호(1 종속국 · 2 우리)로 찍는다(F-39). 글자로 와도 받는다.
  const n = Math.round(Number(sv(kv.n))), name = sv(kv.name).slice(0, 60), c = Math.round(Number(sv(kv.cls)));
  if (!okN(n) || (side !== 't' && side !== 'me') || !name) return null;
  return { n, side, name, cls: c === 1 ? 'official' : c === 2 ? 'commander' : c === 3 ? 'scientist' : 'other' };
}
export interface VrPick { n: number; name: string; ov?: string; cb?: boolean }
export function readPick(kv: Record<string, string>): VrPick | null {
  const n = Math.round(Number(sv(kv.n))), name = sv(kv.name).slice(0, 60); if (!okN(n) || !name) return null;
  const ov = sv(kv.ov).slice(0, 60); return { n, name, ...(ov ? { ov } : {}), ...(kv.cb !== undefined ? { cb: sv(kv.cb).startsWith('1') } : {}) };
}
export const CLASS_NAME: Record<string, [string, string]> = { official: ['관료', 'official'], commander: ['지휘관', 'commander'], scientist: ['과학자', 'scientist'], other: ['인물', 'leader'] };
/** VRSET st → 까닭(한·영). */
export function stText(st: number): string {
  return st === 9 ? L('적용했습니다.', 'Applied.') : st === 0 ? L('대상을 찾지 못했습니다. 목록을 다시 불러 주세요.', 'Target not found. Reload the list.') : st === 3 ? L('영향력이 모자랍니다.', 'Not enough influence.')
    : st === 4 ? L('에너지가 모자랍니다.', 'Not enough energy.') : st === 6 ? L('게임이 받아들이지 않았습니다(휴전·조약 등). 비용은 돌려받았습니다.', 'The game did not accept it (truce, treaty, etc.). The cost was refunded.')
    : st === 5 ? L('마지막 전투 함대는 넘겨받을 수 없습니다.', 'Cannot take their last combat fleet.') : st === 7 ? L('아직 다시 할 수 없습니다.', 'Not available again yet.') : st === 8 ? L('이미 그 전쟁명분이 있습니다.', 'You already have that casus belli.') : L('게임이 응답하지 않았습니다.', 'The game did not answer.');
}

// ---- ⑥ 함대 징발 · ⑦ 함대 헌납 ----
export type LevyAnswer = 'accept' | 'hesitate' | 'refuse';
/** 징발: 대리전보다 조금 쉽게 응한다(함대가 돌아오니까). 우리가 전쟁 중이면 종속국도 제 함대를 아껴 조금 덜 응한다. */
export function levyOdds(loyalty: number | null, autonomy: number, atWar: boolean): { accept: number; refuse: number; hesitate: number } {
  const o = proxyOdds(loyalty, autonomy, atWar); let accept = Math.min(0.9, o.accept + 0.1), refuse = Math.max(0.03, o.refuse - 0.05);
  if (accept + refuse > 0.97) { const k = 0.97 / (accept + refuse); accept *= k; refuse *= k; }
  return { accept: Math.round(accept * 100) / 100, refuse: Math.round(refuse * 100) / 100, hesitate: Math.round((1 - accept - refuse) * 100) / 100 };
}
export function levyRoll(loyalty: number | null, autonomy: number, atWar: boolean, rnd: () => number = Math.random): LevyAnswer {
  const o = levyOdds(loyalty, autonomy, atWar), r = rnd(); return r < o.accept ? 'accept' : r < o.accept + o.refuse ? 'refuse' : 'hesitate';
}
/** 헌납: 아주 빼앗기는 것이라 잘 응하지 않는다. 주저는 없다(받아들이거나 거절). */
export function titheChance(loyalty: number | null, autonomy: number): number {
  const l = loyalty ?? 30, a = clamp(autonomy || 0, 0, 100); return Math.round(clamp(0.1 + l / 120 - a / 150, 0.03, 0.75) * 100) / 100;
}
export function levySituation(ans: LevyAnswer, fleet: string, lost = false): string {
  if (lost) return `Your fleet "${fleet}", lent to the overlord under a levy, was destroyed fighting the overlord's battles. Write a grieving, resentful letter: your sailors died for someone else's war.`;
  if (ans === 'accept') return `Your overlord has levied one of your fleets ("${fleet}") to serve under its command for two years. You comply dutifully. Write a short letter handing it over.`;
  if (ans === 'hesitate') return `Your overlord demanded one of your best fleets for two years. You cannot spare it, so you send only your weakest fleet ("${fleet}") instead. Write an apologetic but firm letter explaining why.`;
  return `Your overlord has demanded one of your fleets for two years. You refuse: your own borders need it. Write a careful refusal.`;
}
export function titheSituation(kind: 'accept' | 'refuse' | 'force', fleet: string): string {
  if (kind === 'accept') return `Your overlord demanded that you hand over your fleet "${fleet}" for good. With heavy hearts you complied; the crews now fly the overlord's flag. Write a dignified, wounded letter.`;
  if (kind === 'refuse') return `Your overlord demanded that you hand over your fleet "${fleet}" for good. You refuse: a nation without a navy is no nation. Write a firm refusal.`;
  return `You refused to hand over your fleet "${fleet}", but the overlord seized it anyway. Your court is humiliated and furious. Write a bitter letter that barely stays within diplomatic bounds.`;
}
/** ⑥ 종속국 전투 함대 목록. 줄 VRFLT(n, name, pow) … VRFEND(cnt = 전투 함대 수). */
export function fleetsCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VR'); return wrap(sid, idx, `sllm_vr_fleets = { REQ = ${req} }`); }
/** ⑥ 징발(give_fleet). 회신 VRSET st: 0 없음 · 3 영향력 부족 · 9 됨. */
export function levyCommand(req: number, sid: string, idx: number, n: number, cost: number): string {
  if (!okReq(req) || !okIdx(idx) || !okN(n) || !Number.isSafeInteger(cost) || cost < 0 || cost > 5000) throw new Error('INVALID_VR');
  return wrap(sid, idx, `sllm_vr_levy = { REQ = ${req} N = ${n} COST = ${cost} DAYS = ${VR.levyDays} }`);
}
/** ⑥ 징발 점검: 표식 붙은 함대 중 살아 있는 수(left)·아직 빌려준 상태(leased). 회신 VRLVC. */
export function levyCheckCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VR'); return wrap(sid, idx, `sllm_vr_levy_chk = { REQ = ${req} }`); }
/** ⑦ 헌납(set_owner). force = 강제(수정자 더 무겁게). 회신 VRSET st: 0 없음 · 3 영향력 부족 · 5 마지막 함대 · 9 됨. */
export function titheCommand(req: number, sid: string, idx: number, n: number, cost: number, force: boolean): string {
  if (!okReq(req) || !okIdx(idx) || !okN(n) || !Number.isSafeInteger(cost) || cost < 0 || cost > 5000) throw new Error('INVALID_VR');
  return wrap(sid, idx, `sllm_vr_tithe = { REQ = ${req} N = ${n} COST = ${cost} MOD = sllm_vr_tithe${force ? '_forced' : ''} DAYS = ${force ? VR.titheForceDays : VR.titheDays} }`);
}
export interface VrFleet { n: number; name: string; pow: number }
export function readFleet(kv: Record<string, string>): VrFleet | null {
  const n = Math.round(Number(sv(kv.n))), name = sv(kv.name).slice(0, 60), pow = Math.max(0, Math.round(Number(sv(kv.pow).replace(/,/g, '')) || 0));
  return okN(n) && name ? { n, name, pow } : null;
}

// ---- 서신 상황(영어, AI 만 읽음) ----
export function newRulerSituation(name: string, ours: boolean, deposed: string): string {
  return `You are ${name}, newly installed as ruler of this subject by the overlord${ours ? ' (you were one of the overlord\'s own officials, sent to govern here)' : ''}, replacing ${deposed || 'the previous ruler'}. You owe your seat to the overlord. Write a warm, loyal first letter: gratitude, promises of obedience, and a hint that not everyone at court is happy.`;
}
export function grudgeSituation(name: string, ruler: string, years: number): string {
  return `You are ${name}, the former ruler of this subject, deposed ${years > 0 ? `${years} year(s) ago` : 'recently'} when the overlord put ${ruler || 'a puppet'} on your throne. You remain at court, powerless and bitter. Write to the overlord: veiled resentment, wounded pride, perhaps a quiet warning that the people remember. Do not threaten openly.`;
}
