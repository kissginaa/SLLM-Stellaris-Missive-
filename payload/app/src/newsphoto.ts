// 신문 사진 고르기(2026-11-10 사용자: 「사진을 먼저 게시하고, 그 사진과 정보를 토대로 LLM 이 글을 쓴다」). 순수 규칙 — electron 없이 selftest.
// 그림: ui/news/photos/ (index.json — GPT 종족별 보도사진 2·3차 + 1차 종족 없는 사진). 설계: 1110_집컴_옮기기/신문_사진먼저_설계_20261110.md
// 흐름: 사실(연대기 한 줄)마다 장면을 정한다(글 규칙) → 그 사실의 제국으로 종족 계열을 정한다 → 사진 한 장을 고른다 → 사진의 영어 장면 설명을 LLM 에 준다.
// 종족 계열: 사람 중심 사건(즉위·결혼·연설 등)은 그 제국의 주 종족, 민간 사건(시위·축제·개표 등)은 그 제국의 종족 인구 비율대로 무작위(사용자 2026-11-10).
// 모르면 인간(모드 종족 대비, 사용자 2026-11-10). 기계 지성 = 로봇, 군체 의식 = 종족 사진 없이 종족 없는 사진만.

export interface PhotoEntry { file: string; cls: string; scene: string; desc: string; kind?: string }
/** 그 사실의 제국에 대해 앱이 아는 것. mix = 종족 인구 비율(계열 키, 합 1). gest: 0 일반 1 기계 2 군체. */
export interface EmpireLook { cls?: string | null; gest?: number; mix?: { k: string; s: number }[]; /** 고유 함선을 쓰는 세력(몰락 제국·은하 위기, 2026-11-10) — shipKeyOf */ ship?: string | null }
export interface PhotoPick { id: string; file: string; desc: string; scene: string; cls: string; fact: number }

/** 우리 사진이 있는 종족 계열. 이 밖의 계열(모드 종족 등)은 인간. */
export const PHOTO_CLASSES = ['human', 'mammalian', 'reptilian', 'avian', 'arthropoid', 'molluscoid', 'fungoid', 'plantoid', 'lithoid', 'necroid', 'aquatic', 'toxoid', 'infernal', 'robot', 'cybernetic', 'psionics'] as const;
/** 앱 계열 키(speciesClass.ts) → 사진 계열. machine(기계 지성) 은 로봇. */
export function photoClass(k: string | null | undefined): string {
  if (!k) return 'human';
  if (k === 'machine') return 'robot';
  return (PHOTO_CLASSES as readonly string[]).includes(k) ? k : 'human';
}

/** 민간 장면(종족이 정해지지 않은 일 — 비율대로 무작위). 나머지 종족 장면은 그 제국의 주 종족. */
export const CIVIL_SCENES = new Set(['celebration', 'protest', 'memorial', 'market', 'ground_parade', 'laboratory', 'soiree', 'election_night', 'aid_cargo', 'independence', 'pardon']);
/** 함선이 주인공인 장면(2026-11-10): 그 계열 사진이 없을 때 인간 함대로 메우지 않는다. */
export const SHIP_SCENES = new Set(['battle', 'war_fleet', 'fleet_review', 'victory_return', 'two_fleets', 'towed_warship', 'archaeology', 'bombardment', 'first_contact']);
/** 함선 장면에 실제 장면 사진이 없을 때 쓰는 그 계열의 「자료사진」(2026-11-10 GPT 1차 정지 사진: file_fleet·file_corvette·file_science). 개선 귀환은 자료사진 대신 다음 후보(축하). */
const FILE_FOR: Record<string, string[]> = {
  battle: ['file_fleet', 'file_corvette'], war_fleet: ['file_fleet', 'file_corvette'], fleet_review: ['file_fleet', 'file_corvette'], two_fleets: ['file_fleet'],
  towed_warship: ['file_fleet'], bombardment: ['file_fleet'], archaeology: ['file_science'], first_contact: ['file_science'],
};
/** 그 계열에 이 장면 사진이 아직 없을 때 대신 쓰는 같은 계열의 비슷한 장면(함선 모양은 그 제국 그대로). GPT 남은 사진이 오면 자연히 진짜 장면이 먼저 뽑힌다. */
const SHIP_SUBS: Record<string, string[]> = {
  two_fleets: ['fleet_review', 'war_fleet'], towed_warship: ['victory_return', 'fleet_review'], first_contact: ['archaeology'], archaeology: ['first_contact'],
  victory_return: ['fleet_review'], fleet_review: ['war_fleet'], war_fleet: ['fleet_review'], battle: ['war_fleet'], bombardment: ['battle'],
};
/** 고유 함선 세력(사용자 2026-11-10: 몰락 제국·프레소린 같은 특수 함선은 그들만의 사진, 판별은 함선 양식이 아니라 그 제국으로).
 *  게임 나라 종류가 먼저, 모르면 제국 이름. 일반 제국이 모드로 같은 함선을 써도 여기 걸리지 않는다. */
export function shipKeyOf(type: string | null | undefined, gest: number | null | undefined, name: string | null | undefined): string | null {
  const t = type || '';
  if (t === 'fallen_empire' || t === 'awakened_fallen_empire') return gest === 1 ? 'fallen_machine' : 'fallen';
  if (t === 'swarm') return 'prethoryn';
  if (t === 'ai_empire') return 'contingency';
  if (/^extradimensional/.test(t)) return 'unbidden';
  if (t === 'synth_queen') return 'synth_queen';
  if (t && t !== 'default') return null;
  const n = name || '';
  if (/프레소린|prethoryn/i.test(n)) return 'prethoryn';
  if (/컨틴전시|contingency/i.test(n)) return 'contingency';
  if (/언비든|unbidden|aberrant|vehement/i.test(n)) return 'unbidden';
  if (/신스 ?퀸|synth ?queen/i.test(n)) return 'synth_queen';
  return null;
}
/** 함선 장면의 계열: 고유 함선 세력 → 그 키, 기계 지성 → robot, 군체도 일반 제국처럼 주 종족 양식(군체 사진 없음 규칙의 예외). */
export function shipClassFor(look: EmpireLook | null | undefined): string {
  if (look?.ship) return look.ship;
  if (look?.gest === 1) return 'robot';
  return photoClass(look?.cls ?? look?.mix?.[0]?.k);
}
/** 군체 제국일 때 종족 장면 대신 쓰는 종족 없는 장면(없으면 사진 없음). */
const HIVE_FALLBACK: Record<string, string> = {
  speech: 'n_speech_crowd', press_conference: 'n_press_conference', parliament: 'n_parliament', protest: 'n_protest', coronation: 'n_ruler_podium',
  treaty_signing: 'n_peace_signing', handshake: 'n_federation_hall', celebration: 'n_speech_crowd', election_night: 'n_polling', laboratory: 'n_laboratory',
  soiree: 'n_reception', market: 'n_cargo_dock', aid_cargo: 'n_cargo_dock', ground_parade: 'n_parade_flyover', trial: 'neutral_galactic_court_exterior',
};

/** 사실 한 줄 → 장면 후보(앞이 우선). 「n_」·「neutral_」로 시작하면 종족 없는 사진. 한국어·영어 연대기 줄 모두. */
const RULES: Array<[RegExp, string[]]> = [
  [/은하 위기|galactic crisis/i, ['n_dark_swarm']],
  [/멸망했다|was destroyed/i, ['n_ruined_capital']],
  [/조공국|속국|became a subject/i, ['n_kneeling_envoys']],
  [/폭격|bombard/i, ['bombardment', 'neutral_bombarded_colony']], // 폭격하는 쪽 제국의 함선 사진(2026-11-10)
  [/함대를 격파|defeated a fleet/i, ['battle', 'n_two_fleets']], // 제독의 전투 승리(2026-11-10)
  [/고고학|archaeolog/i, ['archaeology', 'n_laboratory']], // 고고학 유적 발굴(2026-11-10)
  [/원시문명|pre-?ftl|primitive/i, ['neutral_primitive_observation']],
  [/결혼|혼인|wedding|married/i, ['wedding']],
  [/포로|사로잡았다|제독 .*(처형|전향)|captive|captured .*leader|captured admiral|admiral .*(executed|defected)/i, ['prisoner']],
  [/거대 구조물|megastructure/i, ['n_laboratory']],
  [/은하 공동체가 창설|Galactic Community was founded|연방 의장국|president of its federation/i, ['n_federation_hall']],
  [/정부를 .*개편|정부 형태를 바꿨|reformed its government|form of government/i, ['parliament', 'n_parliament']],
  [/은하재판소|galactic court|tribunal/i, ['trial', 'neutral_galactic_court_exterior']],
  [/청문회|국정감사|hearing|audit/i, ['trial']],
  [/매수|뇌물|폭로|bribe|exposed|\[exposed\]/i, ['bribe']],
  [/특별사면|사면|pardon/i, ['pardon']],
  [/총선|선거|불신임|election|no-confidence/i, ['election_night', 'parliament']],
  [/인플루언서|influencer/i, ['influencer']],
  [/물자 지원|물자를|lend-?lease|supplies to/i, ['aid_cargo']],
  [/감독관|overseer/i, ['overseer']],
  [/독립했다|독립을|independen/i, ['independence']],
  [/시위|protest/i, ['protest']],
  [/사교회|연회|soir[ée]e|banquet/i, ['soiree']],
  [/예산 회의|야당 .*회담|budget meeting|opposition leader/i, ['cabinet']],
  [/성간 임시회의|interstellar (council|assembly)/i, ['speech', 'neutral_interstellar_assembly_exterior']],
  [/새 지도자|즉위|new leader|new ruler|crowned/i, ['coronation']],
  [/연방에 가입|joined the federation/i, ['handshake', 'n_federation_hall']],
  [/연방을 떠났|left the federation|연합\(동맹\)이 깨졌|alliance .* broke/i, ['n_walkout']],
  [/통상 협정|commercial pact/i, ['treaty_signing', 'n_cargo_dock']],
  [/방위 협정|defensive pact|연합\(동맹\)을 맺|formed an alliance/i, ['handshake', 'two_fleets', 'n_two_fleets']],
  [/현상 유지|status quo|전쟁이 끝났|war .* ended|평화/i, ['treaty_signing', 'n_peace_signing']],
  [/이겼다|승리|won the war/i, ['victory_return', 'celebration']],
  [/행성 .*차지|took .* planet|planets? from/i, ['towed_warship', 'n_towed_warship', 'neutral_bombarded_colony']],
  [/참전|선전포고|declared war|joined on the|^War "|^전쟁 "/i, ['war_fleet', 'n_war_fleet', 'n_two_fleets']],
  [/처음으로 통신|first contact/i, ['first_contact', 'n_first_contact']],
  [/연설|speech|address/i, ['speech']],
  [/기자회견|press conference/i, ['press_conference']],
  [/의회|parliament/i, ['parliament']],
  [/추모|사망|서거|memorial|died|funeral/i, ['memorial']],
  [/축제|기념일|festival|holiday|celebrat/i, ['celebration']],
  [/열병식|parade/i, ['ground_parade', 'fleet_review', 'n_parade_flyover']],
  [/폭풍|재해|재난|storm|disaster/i, ['n_storm_rescue']],
  [/연구|과학|research|science/i, ['laboratory']],
  [/식민지|colony|정착/i, ['n_colony_domes']],
  [/무역|교역|trade route|상선/i, ['n_hyperlane_gate', 'market']],
  [/경기|올림픽|LoG|레전드 오브|sports|olympic/i, ['n_arena']],
];
export function scenesOf(text: string): string[] {
  for (const [re, sc] of RULES) if (re.test(text)) return sc;
  return [];
}

/** 0..1 무작위를 씨앗으로(같은 호·같은 사실이면 같은 사진). */
export function seeded(seed: string): () => number {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
/** 장면에 쓸 종족 계열. 군체면 null(종족 사진 안 씀). */
export function classFor(scene: string, look: EmpireLook | null | undefined, rnd: () => number): string | null {
  if (look?.gest === 2) return null;
  if (look?.gest === 1) return 'robot';
  if (CIVIL_SCENES.has(scene) && look?.mix && look.mix.length > 1) { // 민간 사건: 종족 인구 비율대로
    let r = rnd() * look.mix.reduce((a, m) => a + m.s, 0);
    for (const m of look.mix) { r -= m.s; if (r <= 0) return photoClass(m.k); }
  }
  return photoClass(look?.cls ?? look?.mix?.[0]?.k);
}

/** 사진 한 장을 고른다. recent = 최근 호에 실린 파일(되도록 피함). 못 고르면 null. */
export function pickPhoto(index: PhotoEntry[], scenes: string[], look: EmpireLook | null | undefined, rnd: () => number, recent: Set<string> = new Set()): PhotoEntry | null {
  for (const sc0 of scenes) {
    let sc = sc0, cands: PhotoEntry[];
    if (/^(n|neutral)_/.test(sc)) cands = index.filter((p) => p.file.replace(/\.\w+$/, '') === sc);
    else if (SHIP_SCENES.has(sc)) { // 함선 장면(2026-11-10): 그 계열 현장 사진 → 그 계열 자료사진 → 다음 후보(종족 없는 사진). 인간 함대로 메우지 않음
      const cls = shipClassFor(look);
      cands = index.filter((p) => p.cls === cls && p.scene === sc && p.kind !== 'ad');
      for (const alt of SHIP_SUBS[sc] ?? []) { if (cands.length) break; cands = index.filter((p) => p.cls === cls && p.scene === alt && p.kind !== 'ad'); } // 같은 계열의 비슷한 장면(2026-11-10 사용자: 빈 장면은 임시로 채우기)
      if (!cands.length && FILE_FOR[sc]) cands = index.filter((p) => p.cls === cls && FILE_FOR[sc].includes(p.scene) && p.kind !== 'ad');
    }
    else {
      const cls = classFor(sc, look, rnd);
      if (cls === null) { sc = HIVE_FALLBACK[sc] ?? ''; if (!sc) continue; cands = index.filter((p) => p.file.replace(/\.\w+$/, '') === sc); }
      else cands = index.filter((p) => p.cls === cls && p.scene === sc && p.kind !== 'ad');
      if (!cands.length) cands = index.filter((p) => p.cls === 'human' && p.scene === sc && p.kind !== 'ad'); // 그 계열에 그 장면이 없으면 인간
    }
    const fresh = cands.filter((p) => !recent.has(p.file));
    const pool = fresh.length ? fresh : cands;
    if (pool.length) return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  }
  return null;
}

/** 한 호의 사진 후보 목록(P1…): 사실마다 많아야 한 장, 같은 파일 두 번 없음. lookOf(i) = 사실 i 의 제국. */
export function photoMenu(index: PhotoEntry[], facts: Array<{ text: string }>, lookOf: (i: number) => EmpireLook | null, seed: string, recent: Set<string> = new Set(), max = 6): PhotoPick[] {
  const out: PhotoPick[] = []; const used = new Set(recent);
  for (let i = facts.length - 1; i >= 0 && out.length < max; i--) { // 최근 사실부터
    const sc = scenesOf(facts[i].text); if (!sc.length) continue;
    const rnd = seeded(seed + '|' + i);
    const p = pickPhoto(index, sc, lookOf(i), rnd, used); if (!p || out.some((o) => o.file === p.file)) continue;
    used.add(p.file);
    out.push({ id: 'P' + (out.length + 1), file: p.file, desc: p.desc, scene: p.scene, cls: p.cls, fact: i });
  }
  return out;
}

/** 프롬프트 줄: 사진 후보와 어느 사실에 맞는지. */
export function photoPromptLines(menu: PhotoPick[], facts: Array<{ text: string }>): string[] {
  return menu.map((m) => `- ${m.id}: ${m.desc} (taken for: ${facts[m.fact]?.text.slice(0, 120) ?? ''})`);
}

/** 광고 사진 장면(종족 광고 모델). 기계는 정비 제품. */
export const AD_SCENES = ['cosmetics', 'energy_drink', 'holiday', 'fashion', 'family_meal', 'finance'];
export const AD_SCENES_ROBOT = ['maintenance_oil', 'energy_drink', 'virtual_holiday', 'exterior_coating', 'charging_lounge', 'finance'];
/** 독자 제국(플레이어)의 종족 비율로 광고 모델 사진 하나. 군체면 null(종족 없는 인쇄 광고를 씀). */
export function pickAd(index: PhotoEntry[], look: EmpireLook | null | undefined, rnd: () => number): PhotoEntry | null {
  const cls = classFor('celebration', look, rnd); if (cls === null) return null;
  let cands = index.filter((p) => p.kind === 'ad' && p.cls === cls);
  if (!cands.length) cands = index.filter((p) => p.kind === 'ad' && p.cls === 'human');
  return cands.length ? cands[Math.min(cands.length - 1, Math.floor(rnd() * cands.length))] : null;
}

/** 홈페이지 분야 탭(2026-11-10 사용자: 「홈은 큰 것 3개, 분야를 누르면 그 분야 것만 3개 따로 생성」). 연대기 한 줄 → 탭. 안 걸리면 은하(사회·과학·부고 등).
 *  ui/paper.html 의 TAB_RULES 와 같은 규칙(signal-check 가 둘이 같은지 본다). */
export const NEWS_TABS = ['war', 'diplomacy', 'politics', 'economy', 'galaxy', 'sports'] as const;
export type NewsTab = typeof NEWS_TABS[number];
export const TAB_RULES: Array<[NewsTab, RegExp]> = [
  ['sports', /경기|올림픽|선수|LoG|레전드 오브|sport|olympic|tournament/i],
  ['war', /전쟁|선전포고|참전|함대|침공|교전|폭격|포로|사로잡|제독|차지했다|\bwar\b|fleet|invad|battle|bombard|captive|captured|admiral|took .* planet/i],
  ['diplomacy', /협정|조약|연방|외교|동맹|사절|처음으로 통신|조공국|속국|독립|감독관|물자 지원|성간 임시회의|은하재판소|pact|treaty|federation|alliance|envoy|first contact|subject|independen|overseer|lend-?lease|galactic court/i],
  ['politics', /의회|선거|통치자|지도자|즉위|정부|내각|총리|재판|청문회|국정감사|불신임|사면|뇌물|매수|폭로|파벌|시위|인플루언서|사교회|결혼|parliament|election|ruler|leader|government|hearing|audit|pardon|bribe|faction|protest|influencer|soir[ée]e|wedding|married/i],
  ['economy', /무역|교역|경제|시장|상선|에너지|합금|생산|크레딧|trade|market|econom|credit|alloy|production/i],
];
export function tabOf(text: string): NewsTab { for (const [t, re] of TAB_RULES) if (re.test(text)) return t; return 'galaxy'; }
export const TAB_NAMES: Record<NewsTab, string> = { war: 'War', diplomacy: 'Diplomacy', politics: 'Politics', economy: 'Economy', galaxy: 'Galaxy (society, science, obituaries)', sports: 'Sports' };

