// 백화점(2026-10-30 사용자 결정, 계획서 9번) — 순수 자료·규칙(electron 없이 selftest).
// 43층 건물, 통치자는 40~43층 귀빈 전용층만(1~39층은 시민이 붐벼 경호실이 막음). 첫 화면은 전용 엘리베이터.
// 40 리빙관(가구·장식, 침실 꾸미기) · 41 패션·주얼리관(선물 → 호감) · 42 갤러리관(그림·조각) · 43 스카이 라운지(머무는 곳 — 함께 온 사람과 식사 대화).
// 값은 통치자 개인 금고에서. 귀빈 등급(누적 구매) → 할인·한정품. 연인·배우자와 오면 물건마다 취향 반응 한 줄(AI 없음).
// 그림: 09_백화점_그림_의뢰서.md → ui/store/(bg·items·concierge). 없으면 앱이 그린 모양.

export type Floor = 40 | 41 | 42;
export type Tag = 'cozy' | 'elegant' | 'romantic' | 'shiny' | 'practical' | 'art' | 'exotic' | 'classic';
export type Tier = 0 | 1 | 2 | 3;
export interface Item { id: string; floor: Floor; ko: string; en: string; price: number; tags: Tag[]; vip?: Tier }

const I = (floor: Floor, id: string, ko: string, en: string, price: number, tags: Tag[], vip?: Tier): Item => ({ id, floor, ko, en, price, tags, ...(vip ? { vip } : {}) });
export const ITEMS: Item[] = [
  // 40층 리빙관(계획서 초안 1~12·18~20 + 새 5개)
  I(40, 'canopy_bed', '천개 달린 침대', 'Canopy bed', 400, ['romantic', 'classic']), I(40, 'sleep_pod', '무중력 수면 캡슐', 'Zero-g sleep pod', 650, ['exotic', 'practical'], 2),
  I(40, 'armchair', '고급 가죽 안락의자', 'Leather armchair', 180, ['cozy', 'classic']), I(40, 'holo_fireplace', '홀로그램 벽난로', 'Holographic fireplace', 300, ['cozy', 'romantic']),
  I(40, 'dresser', '원목 서랍장', 'Hardwood dresser', 150, ['practical', 'classic']), I(40, 'starmap_lamp', '별자리 투영 천장등', 'Star-map ceiling lamp', 220, ['romantic', 'exotic']),
  I(40, 'mirror', '전신 거울', 'Full-length mirror', 90, ['elegant', 'practical']), I(40, 'reading_nook', '창가 독서 의자', 'Window reading nook', 160, ['cozy']),
  I(40, 'bookshelf', '작은 서재 책장', 'Bedside bookshelf', 120, ['practical', 'classic']), I(40, 'chess_table', '접이식 체스 탁자', 'Folding chess table', 140, ['classic']),
  I(40, 'starweave_rug', '성간 무늬 융단', 'Starweave rug', 110, ['cozy', 'exotic']), I(40, 'gramophone', '기계식 축음기 탁자', 'Gramophone stand', 130, ['classic', 'romantic']),
  I(40, 'alien_vine', '외계 덩굴 화분', 'Potted alien vine', 60, ['exotic', 'cozy']), I(40, 'music_box', '오르골', 'Music box', 70, ['romantic', 'cozy']),
  I(40, 'ship_model', '함선 모형', 'Starship model', 150, ['practical', 'art']), I(40, 'nightstand', '침대 협탁', 'Bedside nightstand', 90, ['practical']),
  I(40, 'nebula_lamp', '성운 무드등', 'Nebula mood lamp', 110, ['romantic', 'cozy']), I(40, 'silk_curtains', '실크 커튼', 'Silk curtains', 130, ['elegant']),
  I(40, 'cushion_set', '쿠션 세트', 'Cushion set', 50, ['cozy']), I(40, 'candle_set', '향초 세트', 'Scented candle set', 40, ['romantic', 'cozy']),
  // 41층 패션·주얼리관(선물)
  I(41, 'silk_gown', '실크 드레스', 'Silk evening gown', 900, ['elegant', 'romantic']), I(41, 'tailored_suit', '맞춤 정장', 'Tailored suit', 850, ['elegant', 'classic']),
  I(41, 'nebula_scarf', '성운 비단 스카프', 'Nebula silk scarf', 220, ['elegant', 'exotic']), I(41, 'star_necklace', '별빛 목걸이', 'Starlight necklace', 1600, ['shiny', 'romantic']),
  I(41, 'crystal_earrings', '결정 귀걸이', 'Crystal earrings', 700, ['shiny', 'elegant']), I(41, 'ring', '반지', 'Ring', 2400, ['shiny', 'romantic'], 1),
  I(41, 'watch', '손목시계', 'Wristwatch', 1200, ['practical', 'classic']), I(41, 'perfume', '향수', 'Perfume', 260, ['romantic', 'elegant']),
  I(41, 'alien_bouquet', '외계 꽃다발', 'Alien bouquet', 80, ['romantic', 'exotic']), I(41, 'chocolates', '초콜릿 상자', 'Box of chocolates', 45, ['cozy', 'romantic']),
  I(41, 'feather_hat', '깃털 모자', 'Feathered hat', 300, ['elegant', 'exotic']), I(41, 'leather_gloves', '가죽 장갑', 'Leather gloves', 160, ['practical', 'classic']),
  I(41, 'cloak', '망토', 'Ceremonial cloak', 650, ['classic', 'elegant']), I(41, 'tiara', '티아라', 'Tiara', 3500, ['shiny', 'elegant'], 2),
  I(41, 'cufflinks', '커프스 단추', 'Cufflinks', 240, ['shiny', 'classic']), I(41, 'shoes', '구두', 'Shoes', 380, ['elegant', 'practical']),
  I(41, 'handbag', '핸드백', 'Handbag', 950, ['elegant', 'practical']), I(41, 'holo_card', '홀로그램 편지 카드', 'Holographic card', 20, ['romantic']),
  I(41, 'planet_brooch', '행성 모양 브로치', 'Planet brooch', 420, ['shiny', 'exotic']), I(41, 'hand_mirror', '손거울', 'Hand mirror', 90, ['elegant', 'classic']),
  // 42층 갤러리관
  I(42, 'galaxy_map_frame', '은하 지도 액자', 'Framed galaxy map', 80, ['art', 'practical']), I(42, 'homeworld_painting', '고향 행성 풍경화', 'Homeworld landscape', 100, ['art', 'cozy']),
  I(42, 'empty_frame', '빈 액자(직접 넣는 그림)', 'Empty frame (your own picture)', 40, ['art']), I(42, 'crystal_sculpture', '결정 조각상', 'Crystal sculpture', 260, ['art', 'shiny']),
  I(42, 'relic_replica', '고대 유물 복제품', 'Ancient relic replica', 300, ['art', 'exotic']), I(42, 'nebula_oil', '성운 유화', 'Nebula oil painting', 450, ['art', 'romantic']),
  I(42, 'holo_abstract', '추상 홀로그램 작품', 'Abstract hologram piece', 520, ['art', 'exotic']), I(42, 'bust', '대리석 흉상', 'Marble bust', 380, ['art', 'classic']),
  I(42, 'ancient_vase', '고대 도자기', 'Ancient vase', 600, ['art', 'classic']), I(42, 'constellation_tapestry', '별자리 태피스트리', 'Constellation tapestry', 240, ['art', 'cozy']),
  I(42, 'meteorite', '운석 조각', 'Meteorite fragment', 330, ['exotic', 'shiny']), I(42, 'fossil', '외계 화석', 'Alien fossil', 410, ['exotic', 'art']),
  I(42, 'voyage_painting', '옛 항해 시대 함선 그림', 'Sailing-era starship painting', 360, ['art', 'classic']), I(42, 'scroll', '고문서 두루마리', 'Ancient scroll', 280, ['classic', 'art']),
  I(42, 'alien_mask', '외계 의식용 가면', 'Alien ceremonial mask', 230, ['exotic', 'art']), I(42, 'candelabra', '은 촛대', 'Silver candelabra', 190, ['elegant', 'romantic']),
  I(42, 'grav_hourglass', '중력 모래시계', 'Gravity hourglass', 270, ['exotic', 'practical']), I(42, 'orrery', '소형 행성 오러리', 'Planetary orrery', 1800, ['art', 'shiny'], 3),
  I(42, 'coin_case', '옛 동전 수집함', 'Antique coin case', 210, ['classic']), I(42, 'portrait_frame', '초상화용 금 액자', 'Gilded portrait frame', 150, ['art', 'elegant']),
];
export const itemById = (id: string): Item | undefined => ITEMS.find((x) => x.id === id);

export const FLOORS: Array<{ n: 40 | 41 | 42 | 43; ko: string; en: string; aboutKo: string; aboutEn: string }> = [
  { n: 40, ko: '리빙관', en: 'Home & Living', aboutKo: '가구·조명·장식 — 모은 종류만큼 개인실이 편안해집니다(가구 편의: 통치자 컨디션).', aboutEn: 'Furniture, lighting and decor — each new kind makes your private rooms more comfortable (furniture comfort: the ruler\'s condition).' },
  { n: 41, ko: '패션·주얼리관', en: 'Fashion & Jewelry', aboutKo: '옷·장신구·향수·꽃 — 함께 온 연인·배우자에게 바로 선물할 수 있습니다.', aboutEn: 'Clothes, jewelry, perfume and flowers — give them straight to the partner who came with you.' },
  { n: 42, ko: '갤러리관', en: 'Gallery', aboutKo: '그림·조각·유물 복제품 — 모은 종류만큼 개인실이 편안해집니다(가구 편의).', aboutEn: 'Paintings, sculptures and replicas — each new kind adds to furniture comfort.' },
  { n: 43, ko: '스카이 라운지', en: 'Sky Lounge', aboutKo: '꼭대기 층 전망 레스토랑. 함께 온 사람과 식사하며 이야기합니다.', aboutEn: 'A rooftop restaurant. Dine and talk with whoever came with you.' },
];
/** 다른 층을 누르면(경호실). 번갈아 보여 줌. */
export const BLOCKED_LINES: Array<[string, string]> = [
  ['경호실 권고로 정차하지 않습니다.', 'Not stopping on the security detail\'s advice.'],
  ['일반 매장층입니다. 통치자께서는 귀빈층만 이용하실 수 있습니다.', 'That is a public floor. Your Excellency may use the VIP floors only.'],
  ['그 층은 지금 시민들로 붐빕니다. 경호실이 정차를 막았습니다.', 'That floor is crowded with citizens. Security has blocked the stop.'],
  ['죄송합니다, 귀빈 전용 엘리베이터는 40층부터 정차합니다.', 'Sorry, the VIP elevator only stops from the 40th floor up.'],
];

/** 귀빈 등급: 누적 구매액 → 할인. */
export const TIERS: Array<{ tier: Tier; ko: string; en: string; spent: number; off: number }> = [
  { tier: 0, ko: '일반 귀빈', en: 'Guest', spent: 0, off: 0 }, { tier: 1, ko: '실버', en: 'Silver', spent: 3000, off: 0.03 },
  { tier: 2, ko: '골드', en: 'Gold', spent: 12000, off: 0.06 }, { tier: 3, ko: '플래티넘', en: 'Platinum', spent: 40000, off: 0.1 },
];
export function tierOf(spent: number): Tier { let t: Tier = 0; for (const x of TIERS) if (spent >= x.spent) t = x.tier; return t; }
export const priceFor = (it: Item, tier: Tier): number => Math.max(1, Math.round(it.price * (1 - TIERS[tier].off)));
export const canBuy = (it: Item, tier: Tier): boolean => (it.vip ?? 0) <= tier;

/** 선물 호감: 기본 +1(값이 크면 조금 더, 최대 +3) + 취향 태그가 맞으면 +2. 같은 날 같은 물건은 반만(올림 없음). */
export function giftDelta(it: Item, liked: Tag[], repeatToday: boolean): number {
  const base = Math.min(3, Math.max(1, Math.floor(Math.log10(Math.max(10, it.price))) - 1)), like = it.tags.some((t) => liked.includes(t)) ? 2 : 0;
  const d = base + like; return repeatToday ? Math.floor(d / 2) : d;
}
const ALL_TAGS: Tag[] = ['cozy', 'elegant', 'romantic', 'shiny', 'practical', 'art', 'exotic', 'classic'];
/** 인물마다 정해진 취향(인물 key 로 고정 — 저장 없이 늘 같음). */
export function likesOf(key: string): Tag[] {
  let h = 2166136261; for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const a = ALL_TAGS[h % 8], b = ALL_TAGS[(Math.floor(h / 8) % 7 + 1 + (h % 8)) % 8]; return a === b ? [a] : [a, b];
}
/** 함께 온 연인·배우자의 반응 한 줄(틀 문장). */
export function reactionOf(it: Item, liked: Tag[], name: string): [string, string] {
  const hit = it.tags.filter((t) => liked.includes(t)).length;
  if (hit >= 2) return [`${name}: "이건 정말 제 취향이에요!"`, `${name}: "This is exactly my taste!"`];
  if (hit === 1) return [`${name}: "이건 마음에 드네요."`, `${name}: "I like this one."`];
  return [`${name}: "음… 나쁘지 않네요."`, `${name}: "Hmm… not bad."`];
}
