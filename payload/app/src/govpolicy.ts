// 총독에게 행성 맡기기(2026-11-03 사용자). 순수 규칙 — 앱: src/features/govpolicy-app.ts · 화면: ui/office-govpolicy.js
// 게임 쪽: 연결 모드가 직접 짓는다(2026-11-03 사용자: 게임 행성 자동화는 플레이어가 켜야만 돌아서 그만 씀).
// 방침을 맡기면 앱이 행성에 표식(planet flag sllm_gov_<id>)을 붙이고, 매달 sllm_gov.1 → sllm_gov_build_tick 이 방침대로 하나씩 짓는다.
// 목록·비용·기간은 게임 데이터에서 만든 tester-mod/common/scripted_effects·scripted_triggers/sllm_gov_build_gen.txt(생성기 tools/gen-gov-build.js).
// 1단계: 기본 방침 8개만(편집기 없음). 재건 보고는 총독을 눌렀을 때만, 효과는 이야기뿐(사용자 2026-11-03).

export interface GovPolicy { id: string; n: number; ko: string; en: string; icon: string; des: number[] }
/** n = 행성 목록 줄의 gpol 번호(0 = 맡기지 않음). des = 이 방침을 권하는 행성 지정 번호(src/planets.ts Planet.des). */
export const GOV_POLICIES: GovPolicy[] = [
  { id: 'research', n: 1, ko: '연구', en: 'Research', icon: '🔬', des: [5] },
  { id: 'foundry', n: 2, ko: '합금', en: 'Alloys', icon: '⚙️', des: [6, 9] },
  { id: 'factory', n: 3, ko: '소비재', en: 'Consumer goods', icon: '📦', des: [6, 12] },
  { id: 'mining', n: 4, ko: '광업', en: 'Mining', icon: '⛏️', des: [2] },
  { id: 'generator', n: 5, ko: '발전', en: 'Energy', icon: '⚡', des: [4, 7] },
  { id: 'farming', n: 6, ko: '농업', en: 'Farming', icon: '🌾', des: [3] },
  { id: 'urban', n: 7, ko: '도시·교역', en: 'Urban & trade', icon: '🏙️', des: [7, 12, 1] },
  { id: 'fortress', n: 8, ko: '요새', en: 'Fortress', icon: '🛡️', des: [9] },
];
/** 준비만 해 둔 방침(2026-11-04, Sector Command 모드 참고: 통합력·교역). 연결 모드 쪽 표식·버프·문구·행성 목록 번호(9·10)는 이미 있다.
 * 건설 목록(sllm_gov_build_gen.txt 의 sllm_gov_pick_unity / sllm_gov_pick_trade + sllm_gov_pick 분기, 생성기 tools/gen-gov-build.js)이 생기면 GOV_POLICIES 로 옮긴다 — 그 전엔 화면에 안 나온다. */
export const GOV_POLICIES_NEXT: GovPolicy[] = [
  { id: 'unity', n: 9, ko: '통합력', en: 'Unity', icon: '🏛️', des: [8] },
  { id: 'trade', n: 10, ko: '교역', en: 'Trade', icon: '💰', des: [7] },
];
const ALL_POLICIES = (): GovPolicy[] => [...GOV_POLICIES, ...GOV_POLICIES_NEXT];
export const policyById = (id: string): GovPolicy | undefined => GOV_POLICIES.find((p) => p.id === id);
export const policyByN = (n: number | undefined): GovPolicy | undefined => ALL_POLICIES().find((p) => p.n === n);

/** 총독 기질(이름으로 고정): 꼼꼼 = 광물 1,000 아래면 멈춤, 보통 = 300, 대담 = 늘 짓기. 행성 표식 sllm_gov_frugal / (없음) / sllm_gov_bold. */
export type Temper = 'frugal' | 'normal' | 'bold';
export const TEMPER_STOCK: Record<Temper, number> = { frugal: 1000, normal: 300, bold: 0 };
const hash = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const temperOf = (governor: string): Temper => (['frugal', 'normal', 'bold'] as Temper[])[hash(governor || '?') % 3];

/** 권하는 방침(앞일수록 강하게): 행성 지정에 맞는 것 → 수도면 연구·도시 → 나머지는 연구·합금·발전. 최대 3개. */
export function recommend(des: number | undefined, capital = false): string[] {
  const out: string[] = [];
  for (const p of GOV_POLICIES) if (des !== undefined && p.des.includes(des)) out.push(p.id);
  for (const id of capital ? ['research', 'urban'] : ['research', 'foundry', 'generator']) if (!out.includes(id)) out.push(id);
  return out.slice(0, 3);
}

// ---- 버프(2026-11-03 사용자: 자동화 손해를 메우는 소폭). 연결 모드 common/static_modifiers/sllm_gov_modifiers.txt 와 같은 값.
export const GOV_MODS = { mandate: (id: string) => `sllm_gov_mandate_${id}`, frugal: 'sllm_gov_temper_frugal', bold: 'sllm_gov_temper_bold', veteran: 'sllm_gov_veteran' } as const;
export const GOV_BUFF = { build: 15, prod: 3, frugalCost: 5, boldBuild: 10, vetBuild: 10, vetProd: 3 } as const;
/** 맡긴 지 이만큼 지나면 숙련(「짬바」, 사용자 2026-11-03: 1년). */
export const GOV_VETERAN_DAYS = 360;
/** 게임에 보낼 명령: 고유 번호 idx 행성의 방침 표식을 모두 떼고(off면 거기서 끝) 새 방침 + 기질 표식. */
export function govPolicyCommand(req: number, sid: string, idx: number, policy: string | null, temper: Temper): string {
  const p = policy ? policyById(policy) : null;
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(idx) || idx < 1 || (policy && !p)) throw new Error('INVALID_GOVPOL');
  // 방침을 바꾸거나 거두면 숙련도 처음부터(새 방침은 다시 익혀야 함). 맡기면 360일짜리 「새내기」 표식 → 지나면 연결 모드가 「숙련된 총독」을 붙인다.
  const clear = [...ALL_POLICIES().map((x) => `remove_planet_flag = sllm_gov_${x.id} remove_modifier = ${GOV_MODS.mandate(x.id)}`), 'remove_planet_flag = sllm_gov_frugal', 'remove_planet_flag = sllm_gov_bold', 'remove_planet_flag = sllm_gov_new', 'remove_planet_flag = sllm_gov_idle' /* 쉬던 총독도 새 방침이면 바로 */, 'clear_variable = sllm_gov_dm' /* 헐기 달 수도 처음부터 */,
    `remove_modifier = ${GOV_MODS.frugal}`, `remove_modifier = ${GOV_MODS.bold}`, `remove_modifier = ${GOV_MODS.veteran}`].join(' ');
  const set = p ? ` set_planet_flag = sllm_gov_${p.id} add_modifier = { modifier = ${GOV_MODS.mandate(p.id)} days = -1 }` + (temper === 'normal' ? '' : ` set_planet_flag = sllm_gov_${temper} add_modifier = { modifier = ${GOV_MODS[temper]} days = -1 }`) + ` set_timed_planet_flag = { flag = sllm_gov_new days = ${GOV_VETERAN_DAYS} }` + ' planet_event = { id = sllm_gov.10 }' : ''; // 게임 안 총독 창(초상화·한마디, 2026-11-04)
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } }${p ? ' set_country_flag = sllm_gov_any' : ''} every_owned_colony = { limit = { check_variable = { which = sllm_pl_idx value = ${idx} } } ${clear}${set} } log = "SLLM:GOVPOL/;/req=${req}/;/sid=${sid}/;/idx=${idx}/;/pol=${p ? p.n : 0}/;/status=applied" }`;
}

// ---- 총독 보고(틀 문장, LLM 없음). {g} 총독 {p} 행성 {pol} 방침
const pickBy = <T>(arr: T[], seed: string): T => arr[hash(seed) % arr.length];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
export const GOV_LINES = {
  propose: [
    ['{p}을(를) 보니 {pol} 쪽이 가장 낫겠습니다. 맡겨 주시면 그렇게 꾸리겠습니다.', 'Looking at {p}, {pol} suits it best. Leave it to me and I will build it that way.'],
    ['제 생각엔 {pol} 행성입니다. 다른 길도 있지만, 이쪽이 제일 덜 헤맵니다.', 'I see a {pol} world here. There are other paths, but this one wastes the least.'],
    ['{p}의 지구 배치를 보면 {pol}이(가) 자연스럽습니다.', 'The way {p} is laid out, {pol} comes naturally.'],
  ],
  accept: [
    ['알겠습니다. {p}은(는) 오늘부터 {pol} 행성입니다. 공사는 제가 챙기겠습니다.', 'Understood. From today {p} is a {pol} world. I will see to the construction.'],
    ['맡겨 주셔서 감사합니다. {pol} 방침대로 하나씩 올리겠습니다.', 'Thank you for trusting me. I will raise it step by step, {pol} first.'],
  ],
  temper: {
    frugal: ['다만 국고 광물이 1,000 아래로 내려가면 공사를 멈추겠습니다. 빚지고 짓는 건 제 방식이 아닙니다.', 'But if the treasury drops below 1,000 minerals I will pause. Building on debt is not my way.'],
    normal: ['국고 광물이 300 아래로 내려가면 잠시 쉬어 가겠습니다.', 'If the treasury drops below 300 minerals I will hold off for a while.'],
    bold: ['자원 사정은 신경 쓰지 않고 밀어붙이겠습니다. 멈추라 하실 때까지요.', 'I will push ahead whatever the stockpile says — until you tell me to stop.'],
  } as Record<Temper, [string, string]>,
  recall: [
    ['방침을 거두셨군요. {p}은(는) 이제 직접 챙기셔야 합니다.', 'You have withdrawn the mandate. {p} is in your hands again.'],
    ['알겠습니다. 짓던 것까지만 마무리하고 손을 떼겠습니다.', 'Understood. I will finish what is underway and step back.'],
  ],
  veteran: [
    ['{p}을(를) 맡은 지 1년이 넘었습니다. 이제 어디에 무엇을 지어야 할지 눈 감고도 압니다.', 'It has been over a year since you gave me {p}. I could plan its next build with my eyes closed.'],
    ['처음엔 헤맸지만, 이제 {p} 공사판은 제 손바닥 안입니다.', 'I stumbled at first, but {p}\'s building sites are in the palm of my hand now.'],
  ],
  report: [
    ['{p}은(는) {pol} 방침대로 가고 있습니다. 빈 칸이 생기는 대로 채우고 있습니다.', '{p} is following the {pol} mandate. I fill each free slot as it opens.'],
    ['{pol} 쪽 공사가 이어지고 있습니다. 전쟁으로 틀어진 곳이 있으면 다시 세우겠습니다.', 'Work toward {pol} continues. If war has bent anything out of shape, I will rebuild it.'],
  ],
} as const;
export function govLine(kind: 'propose' | 'accept' | 'recall' | 'report' | 'veteran', ko: boolean, v: { g: string; p: string; pol: string }, seed = ''): string {
  const pair = pickBy(GOV_LINES[kind] as unknown as Array<[string, string]>, kind + v.g + v.p + seed);
  return fill(ko ? pair[0] : pair[1], v);
}
export const temperLine = (t: Temper, ko: boolean): string => GOV_LINES.temper[t][ko ? 0 : 1];

// ---- 총독이 지은 것(2026-11-05 사용자 「행성총독 자동화 개선」): 연결 모드 로그 SLLM:GOVBUILD/;/kind/;/key/;/ok/;/why/;/pl
// why = 무엇 때문에 지었나. 0 방침대로 · 급한 일(주거 부족 → 자원 적자 → 편의 부족 → 범죄) — 생성기 tools/gen-gov-build.js FIXES 와 같은 이름.
export type GovWhy = 'mandate' | 'housing' | 'energy' | 'food' | 'minerals' | 'amenity' | 'crime';
export const GOV_WHY: Record<GovWhy, [string, string]> = {
  mandate: ['방침대로', 'as the mandate says'],
  housing: ['주거가 모자라서', 'because housing ran short'],
  energy: ['나라 에너지가 달마다 적자라서', 'because the realm was losing energy every month'],
  food: ['나라 식량이 달마다 적자라서', 'because the realm was losing food every month'],
  minerals: ['나라 광물이 달마다 적자라서', 'because the realm was losing minerals every month'],
  amenity: ['편의가 모자라서', 'because amenities ran short'],
  crime: ['범죄가 높아서', 'because crime was climbing'],
};
/** why 번호(생성기 FIXES 의 why) → 이름 */
export const GOV_WHY_N: GovWhy[] = ['mandate', 'housing', 'energy', 'food', 'minerals', 'amenity', 'crime'];
export interface GovBuild { kind: 'district' | 'zone' | 'building' | 'upgrade' | 'replan' | 'demolish'; key: string; ok: boolean; why: GovWhy; pl: string; d: string }
export function parseGovBuild(kv: Record<string, string>, d: string): GovBuild | null {
  const kind = kv.kind, key = kv.key || '', pl = (kv.pl || '').trim();
  if ((kind !== 'district' && kind !== 'zone' && kind !== 'building' && kind !== 'upgrade' && kind !== 'replan' && kind !== 'demolish') || !/^[a-z0-9_]+$/.test(key) || !pl) return null;
  const wn = Number(kv.why); // 연결 모드는 why 를 변수 sllm_gov_why 번호로 찍는다(로그 문자열에 매개변수 금지 F-39). 글자로 와도 받는다.
  const why = (Number.isFinite(wn) ? GOV_WHY_N[Math.round(wn)] ?? 'mandate' : kv.why && kv.why in GOV_WHY ? kv.why : 'mandate') as GovWhy;
  return { kind, key, ok: kv.ok === '1', why, pl, d };
}
/** 보고에 쓸 이름(자주 짓는 것만, 나머지는 종류로). */
const BUILD_NAME: Record<string, [string, string]> = {
  district_city: ['도시 지구', 'a city district'], district_hive: ['군체 지구', 'a hive district'], district_nexus: ['연결 지구', 'a nexus district'],
  district_arcology_housing: ['주거 아콜로지', 'an arcology housing district'], district_rw_city: ['고리 세계 도시', 'a ring-world city segment'], district_hab_housing: ['거주 구획', 'a habitation district'],
  district_generator: ['발전 지구', 'a generator district'], district_hab_energy: ['발전 구획', 'a reactor district'], district_mining: ['광산 지구', 'a mining district'], district_hab_mining: ['채굴 구획', 'an asteroid mining district'],
  district_farming: ['농업 지구', 'a farming district'],
  building_luxury_residence: ['고급 주거지', 'luxury residences'], building_communal_housing: ['공동 주거지', 'communal housing'], building_holo_theatres: ['홀로 극장', 'holo-theatres'],
  building_medical_1: ['의료 시설', 'a medical facility'], building_drone_storage: ['드론 보관소', 'drone storage'], building_hive_warren: ['군체 굴', 'hive warrens'],
  // 헐기 대상(2026-11-05, 생성기 PRUNABLE)
  building_physics_lab_1: ['물리 실험실', 'a physics lab'], building_biolab_1: ['생물 실험실', 'a biology lab'], building_engineering_facility_1: ['공학 시설', 'an engineering facility'],
  building_foundry_1: ['합금 공장', 'a foundry'], building_factory_1: ['민수 공장', 'a civilian factory'], building_commercial_zone: ['상업 시설', 'a commercial zone'],
  building_commercial_megaplex: ['상업 메가플렉스', 'a commercial megaplex'], building_stronghold: ['주둔지', 'a stronghold'],
  // 개량(2026-11-05) — key 는 새 건물
  building_physics_lab_2: ['물리 연구소', 'a physics research complex'], building_physics_lab_3: ['물리 연구 단지', 'a physics research nexus'],
  building_biolab_2: ['생물 연구소', 'a biology research complex'], building_biolab_3: ['생물 연구 단지', 'a biology research nexus'],
  building_engineering_facility_2: ['공학 연구소', 'an engineering research complex'], building_engineering_facility_3: ['공학 연구 단지', 'an engineering research nexus'],
  building_foundry_2: ['합금 공장 2단계', 'the second-stage foundry'], building_foundry_3: ['합금 공장 3단계', 'the third-stage foundry'],
  building_factory_2: ['민수 공장 2단계', 'the second-stage factory'], building_factory_3: ['민수 공장 3단계', 'the third-stage factory'],
  building_energy_nexus: ['에너지 넥서스', 'an energy nexus'], building_mineral_purification_hub: ['광물 정제 허브', 'a mineral purification hub'], building_food_processing_center: ['식량 가공 센터', 'a food processing center'],
  building_paradise_dome: ['낙원 돔', 'a paradise dome'], building_communal_housing_large: ['대형 공동 주거지', 'large communal housing'], building_hyper_entertainment_forum: ['초엔터테인먼트 포럼', 'a hyper-entertainment forum'],
  building_drone_megastorage: ['대형 드론 보관소', 'drone megastorage'], building_expanded_warren: ['확장 군체 굴', 'expanded warrens'], building_hall_judgment: ['심판의 전당', 'a hall of judgment'],
  building_center_of_guidance: ['지도 센터', 'a center of guidance'], building_fortress: ['요새', 'a fortress'],
  building_precinct_house: ['치안 본부', 'a precinct house'], building_state_academy: ['국립 교육원', 'a state academy'], building_sentinel_posts: ['감시 초소', 'sentinel posts'],
};
const KIND_NAME: Record<GovBuild['kind'], [string, string]> = { district: ['지구 하나', 'a district'], zone: ['구역 하나', 'a zone'], building: ['건물 하나', 'a building'], upgrade: ['한 단계 위 건물', 'the next tier'], replan: ['공사 계획', 'the build plan'], demolish: ['건물 하나', 'a building'] };
export const govBuildName = (b: Pick<GovBuild, 'kind' | 'key'>, ko: boolean): string => (BUILD_NAME[b.key] ?? KIND_NAME[b.kind])[ko ? 0 : 1];
/** 총독이 최근에 한 일 한 문장(틀 문장). 못 지었으면(칸이 없어 돌려받음) 그렇게 말한다. */
export function govBuildLine(b: GovBuild, ko: boolean): string {
  const what = govBuildName(b, ko), why = GOV_WHY[b.why][ko ? 0 : 1];
  if (b.kind === 'demolish') return ko ? `방침과 맞지 않고 일할 사람도 없던 ${what}을(를) 헐었습니다. 그 자리는 방침대로 채우겠습니다.` : `I tore down ${what} — it did not fit the mandate and no one was working there. I will fill the space as the mandate says.`; // 헐기(sllm_gov_prune)
  if (b.kind === 'replan') return ko ? '행성 환경이 바뀌어 공사 계획을 처음부터 다시 짰습니다. 막혀 있던 공사도 다시 살펴보겠습니다.' : 'The world itself has changed, so I redrew the build plan from scratch — including the projects that were stuck.'; // 행성 등급 바뀜(sllm_gov.20)
  if (b.kind === 'upgrade') { // 개량: 옛 건물을 새 건물로 바꿈
    if (!b.ok) return ko ? `${why} 건물을 ${what}(으)로 개량하려 했는데 자리가 맞지 않아 비용을 돌려받았습니다.` : `I tried to upgrade a building to ${what} ${why}, but it would not fit, so the cost came back.`;
    return b.why === 'mandate' ? (ko ? `방침대로 건물을 ${what}(으)로 개량했습니다.` : `I upgraded a building to ${what}, as the mandate says.`)
      : (ko ? `${why} 방침보다 먼저 건물을 ${what}(으)로 개량했습니다.` : `I upgraded a building to ${what} ahead of the mandate, ${why}.`);
  }
  if (!b.ok) return ko ? `${why} ${what}을(를) 올리려 했는데 자리가 없어 비용을 돌려받았습니다. 한동안은 다른 일을 보겠습니다.` : `I tried to raise ${what} ${why}, but there was no room, so the cost came back. I will look elsewhere for a while.`;
  if (b.why === 'mandate') return ko ? `방침대로 ${what}을(를) 올렸습니다.` : `I raised ${what}, as the mandate says.`;
  return ko ? `${why} 방침보다 먼저 ${what}을(를) 올렸습니다.` : `I raised ${what} ahead of the mandate, ${why}.`;
}

// ---- 행성 할당량(2026-11-05 사용자, Advanced Policies 「Planetary Quota」 참고 — 이름·단계·수치는 우리식)
// 방침을 맡긴 행성에 할당량을 매기면 준비 → 1·2·3단계 → 마무리. 연결 모드 common/scripted_effects/sllm_gov_quota.txt · static_modifiers/sllm_gov_modifiers.txt 와 같은 값.
export const GOV_QUOTA = {
  months: [6, 24, 24, 24], // 단계별 길이(달)
  prod: [0, 10, 20, 30], // 모든 직업 생산 +%
  stab: [2, 5, 10, 15], // 안정도 -
  done: { stab: 5, days: 720 }, fail: { stab: 5, prod: 5, days: 720 }, failBelow: 10, failMonths: 3, strainBelow: 25,
  reward: {
    research: [['physics_research', 1000], ['society_research', 1000], ['engineering_research', 1000]], foundry: [['alloys', 1500]], factory: [['consumer_goods', 2000]],
    mining: [['minerals', 4000]], generator: [['energy', 4000]], farming: [['food', 3000]], urban: [['energy', 3000]], fortress: [['alloys', 1000], ['unity', 500]],
  } as Record<string, Array<[string, number]>>,
} as const;
const RES_NAME: Record<string, [string, string]> = {
  physics_research: ['물리학', 'physics'], society_research: ['사회학', 'society'], engineering_research: ['공학', 'engineering'], alloys: ['합금', 'alloys'],
  consumer_goods: ['소비재', 'consumer goods'], minerals: ['광물', 'minerals'], energy: ['에너지', 'energy'], food: ['식량', 'food'], unity: ['통합력', 'unity'],
};
export const quotaRewardText = (policy: string, ko: boolean): string => (GOV_QUOTA.reward[policy] ?? []).map(([r, n]) => `${(RES_NAME[r] ?? [r, r])[ko ? 0 : 1]} ${n.toLocaleString()}`).join(', ');
/** 할당량 매기기(on)·거두기. 방침이 없거나 이미 있으면 refused. */
export function govQuotaCommand(req: number, sid: string, idx: number, on: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(idx) || idx < 1) throw new Error('INVALID_GOVQUOTA');
  const act = on ? 'if = { limit = { sllm_gov_has_mandate = yes NOT = { has_planet_flag = sllm_quota_on } } sllm_quota_begin = yes prev = { set_country_flag = sllm_quota_ok } }'
    : 'if = { limit = { has_planet_flag = sllm_quota_on } sllm_quota_clear = yes prev = { set_country_flag = sllm_quota_ok } }';
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } every_owned_colony = { limit = { check_variable = { which = sllm_pl_idx value = ${idx} } } ${act} } if = { limit = { has_country_flag = sllm_quota_ok } remove_country_flag = sllm_quota_ok log = "SLLM:GOVQUOTA/;/req=${req}/;/status=applied" } else = { log = "SLLM:GOVQUOTA/;/req=${req}/;/status=refused" } }`;
}
export type QuotaEv = 'start' | 'phase' | 'strain' | 'done' | 'fail' | 'cancel' | 'withdraw';
/** 총독 말(틀 문장). {g} 총독 {p} 행성 {r} 보상 {n} 단계 */
const QUOTA_LINES: Record<QuotaEv, Array<[string, string]>> = {
  start: [['알겠습니다. {p}에 할당량을 매기겠습니다. 반년 동안 바탕을 깔고, 그다음 세 단계로 끌어올리겠습니다. 주민들이 좋아하진 않을 겁니다.', 'Understood. I will levy the quota on {p}. Six months to lay the groundwork, then three phases to push it up. The people will not like it.'],
    ['할당량이라… 해 보겠습니다. 끝까지 버티면 {r}을(를) 보내 드리겠습니다.', 'A quota… I will see it through. Hold out to the end and I will send you {r}.']],
  phase: [['{p} 할당량이 {n}단계에 들어섰습니다. 생산이 오르는 만큼 주민들의 불만도 오릅니다.', 'The quota on {p} has entered phase {n}. Output climbs, and so does the grumbling.'],
    ['{n}단계입니다. 공장마다 교대가 늘었고, 거리는 조용해졌습니다. 좋은 조용함은 아닙니다.', 'Phase {n}. Every shift runs longer, and the streets have gone quiet — not the good kind of quiet.']],
  strain: [['{p}이(가) 버거워합니다. 안정도가 많이 떨어졌습니다. 이대로 가면 할당량이 무너질 수 있습니다.', '{p} is buckling. Stability has fallen hard; if this goes on, the quota may collapse.'],
    ['주민들이 지쳤습니다. 무언가 숨 돌릴 거리를 주시든지, 할당량을 거두시든지 정하셔야 합니다.', 'The people are worn out. Either give them some relief or withdraw the quota — it is your call.']],
  done: [['할당량을 다 채웠습니다! 마지막 물자 {r}을(를) 보냈습니다. {p}은(는) 이제 한숨 돌립니다.', 'The quota is fulfilled! The last shipment — {r} — is on its way. {p} can finally breathe.'],
    ['끝났습니다. 몇 년을 버틴 보람이 있습니다. {r}이(가) 국고에 들어갔습니다.', 'It is done. The years of strain paid off: {r} went into the treasury.']],
  fail: [['죄송합니다. {p} 할당량이 무너졌습니다. 주민들이 더는 버티지 못했습니다.', 'I am sorry. The quota on {p} has collapsed. The people could not hold out any longer.']],
  cancel: [['방침을 거두셔서 할당량도 그만두었습니다. 모은 것은 없습니다.', 'With the mandate withdrawn, the quota ends too. Nothing was delivered.']],
  withdraw: [['할당량을 거두었습니다. {p} 주민들이 안도하겠지만, 그동안 쌓은 건 남지 않습니다.', 'The quota is withdrawn. {p} will be relieved, but nothing of the effort carries over.']],
};
export function quotaLine(ev: QuotaEv, ko: boolean, v: { g: string; p: string; r: string; n?: number }, seed = ''): string {
  const pair = pickBy(QUOTA_LINES[ev], ev + v.g + v.p + seed);
  return fill(ko ? pair[0] : pair[1], { g: v.g, p: v.p, r: v.r, n: String(v.n ?? '') });
}
