// 그레이트 칸 특별 대우(다음 업데이트, 2026-10-26 외부 건의 ④). 순수 규칙. 앱: src/features/khan-app.ts, 모드: tester-mod/events/sllm_khan_events.txt.
// 사용자 확정(2026-10-26):
//   · 판단 기준: 그레이트 칸이 나온 그 약탈자 부족과 전투한 적이 없고(우주 전투 — 이김·짐·습격 방어 모두, 모드 표식 sllm_fought_marauder_N),
//     관계가 좋았음 = 그레이트 칸 등장 때 그의 호감 +50 이상 또는 거래 이력(습격 의뢰 hired@, 용병 고용, 앱의 약탈자 거래).
//   · 대우: 그레이트 칸의 사자 통신·특별 대화 + 선물(합금 월수입 6개월치, 퀘스트 엔진 자원 규칙) + 우대 태수국(칸의 총애: 기본 자원 생산 +15%, 그레이트 칸의 태수국인 동안).
//   · 바닐라 태수국 조건(기본 자원 30%)은 그대로 — 다른 바닐라 약탈자 이벤트가 preset_satrapy 를 검사한다.
// 이 업데이트 전에 한 전투는 기록이 없으므로 「싸운 적 없음」으로 본다.
import { L } from './i18n-pick';
import { QUEST_RESOURCES } from './quest-catalog';
import { questYearFactor } from './quest-effects';

export const KHAN = { minOpinion: 50, giftMonths: 6, favorPct: 15 } as const;
export interface KhanCheck { found: boolean; clan: number; fought: boolean; hired: boolean; sat: boolean; fav: boolean; op: number; idx: number; name: string }
export interface KhanSave { checked: boolean; eligible: boolean; clan: number; idx: number; name: string; on: string; gift?: number; fought?: boolean }

const okSid = (sid: string) => /^\d+$/.test(sid);
const player = (sid: string, body: string) => `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;

/** 그레이트 칸 조사: 그레이트 칸(각성한 약탈자) · 부족 번호 · 우리가 그 부족과 싸웠나 · 거래 이력 · 이미 태수국인가 · 총애 표식 · 그레이트 칸의 우리 호감. 회신 SLLM:KHAN. */
export function khanCheckCommand(req: number, sid: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !okSid(sid)) throw new Error('INVALID_KHAN');
  const v = (n: string, x: number | string) => `set_variable = { which = ${n} value = ${x} }`;
  const body = [
    `save_event_target_as = sllm_kh_p ${v('sllm_kh_ok', 0)} ${v('sllm_kh_clan', 0)} ${v('sllm_kh_f', 0)} ${v('sllm_kh_h', 0)} ${v('sllm_kh_s', 0)} ${v('sllm_kh_v', 0)}`,
    `random_country = { limit = { is_country_type = awakened_marauders } save_event_target_as = sllm_kh_k prev = { ${v('sllm_kh_ok', 1)} } if = { limit = { has_country_flag = marauder_1 } prev = { ${v('sllm_kh_clan', 1)} } } else_if = { limit = { has_country_flag = marauder_2 } prev = { ${v('sllm_kh_clan', 2)} } } else_if = { limit = { has_country_flag = marauder_3 } prev = { ${v('sllm_kh_clan', 3)} } } }`,
    'if = { limit = { check_variable = { which = sllm_kh_ok value = 1 } }',
    ...[1, 2, 3].map((n) => ` if = { limit = { check_variable = { which = sllm_kh_clan value = ${n} } has_country_flag = sllm_fought_marauder_${n} } ${v('sllm_kh_f', 1)} }`),
    ` if = { limit = { OR = { has_country_flag = hired@event_target:sllm_kh_k any_owned_fleet = { sllm_mrd_is_merc_fleet = yes } } } ${v('sllm_kh_h', 1)} }`,
    ` if = { limit = { exists = overlord overlord = { is_same_value = event_target:sllm_kh_k } } ${v('sllm_kh_s', 1)} }`,
    ` if = { limit = { has_country_flag = sllm_khan_favored } ${v('sllm_kh_v', 1)} }`,
    ` event_target:sllm_kh_k = { export_trigger_value_to_variable = { trigger = opinion parameters = { who = event_target:sllm_kh_p } variable = sllm_kh_op } log = "SLLM:KHAN/;/req=${req}/;/sid=${sid}/;/found=1/;/clan=\\[Prev.sllm_kh_clan]/;/fought=\\[Prev.sllm_kh_f]/;/hired=\\[Prev.sllm_kh_h]/;/sat=\\[Prev.sllm_kh_s]/;/fav=\\[Prev.sllm_kh_v]/;/op=\\[This.sllm_kh_op]/;/idx=\\[This.sllm_idx]/;/name=\\[This.GetName]" }`,
    '}',
    `else = { log = "SLLM:KHAN/;/req=${req}/;/sid=${sid}/;/found=0" }`,
  ].join(' ');
  return player(sid, body);
}
export function parseKhan(kv: Record<string, string>): KhanCheck {
  const n = (x: unknown) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
  return { found: kv.found === '1', clan: Math.round(n(kv.clan)), fought: kv.fought === '1', hired: kv.hired === '1', sat: kv.sat === '1', fav: kv.fav === '1', op: Math.round(n(kv.op)), idx: Math.max(0, Math.round(n(kv.idx))), name: String(kv.name ?? '').replace(/[\r\n"]/g, ' ').trim().slice(0, 80) };
}
/** 특별 대우 자격: 그 부족과 싸운 적 없음 + (호감 +50 이상 또는 거래 이력). appDeal = 앱의 약탈자 거래 기록(습격 돌리기·용병 흥정). */
export const khanEligible = (c: KhanCheck, appDeal = false): boolean => c.found && c.clan > 0 && !c.fought && (c.op >= KHAN.minOpinion || c.hired || appDeal);

/** 선물·총애 표식. 합금 = 월수입 × 6개월(엔진 상한 [50, 1500] × 연도 배율). 한 세이브에 한 번(표식). 회신 SLLM:KHANGIFT status=given|duplicate amt=. */
export function khanBlessCommand(req: number, sid: string, year?: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !okSid(sid)) throw new Error('INVALID_KHAN');
  const r = QUEST_RESOURCES.find((x) => x.key === 'alloys')!, f = questYearFactor(year), min = r.min * f, max = r.max * f, x = 'sllm_kh_g';
  const log = (st: string) => `log = "SLLM:KHANGIFT/;/req=${req}/;/sid=${sid}/;/status=${st}/;/amt=\\[This.${x}]"`;
  const give = `set_variable = { which = ${x} value = 0 } export_resource_income_to_variable = { resource = alloys variable = ${x} } multiply_variable = { which = ${x} value = ${KHAN.giftMonths} }`
    + ` if = { limit = { check_variable = { which = ${x} value < ${min} } } set_variable = { which = ${x} value = ${min} } } if = { limit = { check_variable = { which = ${x} value > ${max} } } set_variable = { which = ${x} value = ${max} } } round_variable = ${x}`
    + ` add_resource = { alloys = 1 mult = ${x} } set_country_flag = sllm_khan_favored`;
  return player(sid, `if = { limit = { has_country_flag = sllm_khan_favored } set_variable = { which = ${x} value = 0 } ${log('duplicate')} } else = { ${give} ${log('given')} }`);
}

/** 그레이트 칸과 통화할 때의 영어 줄(우리가 그레이트 칸에게 어떤 기억으로 남았나). */
export function khanTalkLine(s: KhanSave | null | undefined): string {
  if (!s || !s.checked) return '';
  if (s.eligible) return `[Old ties] Before you rose as the Great Khan, their empire never raised arms against your clan and dealt honestly with it. You remember this and treat them as an old friend among lesser peoples. You have already sent them a gift of alloys. If they submit as your satrapy, you grant them the Khan's Favor: +${KHAN.favorPct}% basic resource output for as long as they remain your satrapy (the usual satrapy tribute still applies). Submission itself goes through your Horde's usual offer in the game; you may urge it warmly, never as a threat.`;
  if (s.fought) return '[Old grudge] Their fleets have fought your clan before you rose as the Great Khan. You remember every battle.';
  return '';
}
/** 사자 통신 글(LLM 없음, 한/영). */
export const khanText = {
  title: (khan: string) => L(`그레이트 칸의 사자: ${khan}`, `Envoy of the Great Khan: ${khan}`),
  body: (khan: string, amt: number) => L(
    `그레이트 칸의 사자가 도착했습니다. 「그레이트 칸께서는 그대들이 우리 부족에게 칼을 겨눈 적이 없음을 기억하신다. 옛정의 표시로 합금 ${amt}을(를) 보내신다. 그대들이 태수국으로 무릎을 꿇는다면, 그레이트 칸께서는 그대들의 짐을 덜어 주실 것이다.」 (태수국이 되면 칸의 총애: 기본 자원 생산 +${KHAN.favorPct}%)`,
    `An envoy of the Great Khan has arrived: “The Great Khan remembers that you never raised arms against our clan. As a token of old ties he sends you ${amt} alloys. Should you bend the knee as a satrapy, the Khan will ease your burden.” (As a satrapy: the Khan's Favor, +${KHAN.favorPct}% basic resource output)`),
  chron: (khan: string, amt: number) => L(`그레이트 칸 ${khan}의 사자가 옛정을 기억한다며 합금 ${amt}을(를) 보내왔다`, `An envoy of the Great Khan ${khan} sent ${amt} alloys in memory of old ties`),
  favorOn: () => L('칸의 총애: 그레이트 칸의 태수국이 되어 기본 자원 생산 +15%를 받습니다.', 'The Khan\'s Favor: as the Khan\'s satrapy you now receive +15% basic resource output.'),
  favorOff: () => L('칸의 총애가 끝났습니다(태수국이 아니거나 그레이트 칸이 사라짐).', 'The Khan\'s Favor has ended (no longer his satrapy, or the Khan is gone).'),
};
export function sanitizeKhan(v: unknown): KhanSave | null {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : null; if (!o || typeof o.checked !== 'boolean') return null;
  const int = (x: unknown) => (Number.isSafeInteger(x) ? (x as number) : 0);
  return { checked: o.checked, eligible: o.eligible === true, clan: int(o.clan), idx: int(o.idx), name: String(o.name ?? '').slice(0, 80), on: String(o.on ?? '').slice(0, 12), ...(Number.isFinite(o.gift) ? { gift: Number(o.gift) } : {}), ...(o.fought === true ? { fought: true } : {}) };
}
