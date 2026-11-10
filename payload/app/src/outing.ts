// 「외출」(2026-10-30 사용자 결정, 계획서 10번). 순수 자료·규칙(electron 없이 selftest).
// 집무실 책상 위 가죽 지갑 + 외출 패스 → 외출 화면(수도 지도, 저녁). 지도 위 빛나는 표시를 눌러 장소로 감(출발 때 셔틀 승강장 장면).
// 지금은 수도 하나, 나중에 행성 여러 곳으로 넓힘 → 「지도 목록 → 그 지도의 장소」 구조(지도 하나 더하기 = 그림 1장 + 아래 자료).
// 그림: ui/assets/outing/<성향>-city.webp(03_외출_그림_의뢰서.md, 8장 같은 구도). 없으면 앱이 그린 저녁 도시.
// 동행(사용자 결정): 혼자 · 연인/배우자 · 우리 지도자 한 명. 데이트 진입(사용자 결정): 인물 카드 버튼과 외출의 공원 둘 다.

export type PlaceId = 'park' | 'petshop' | 'store' | 'special' | 'stadium' | 'tavern' | 'blackmarket' | 'casino';
export interface Place { id: PlaceId; ko: string; en: string; x: number; y: number; ready: boolean; aboutKo: string; aboutEn: string }
export interface OutingMap { id: string; ko: string; en: string; places: Place[] }

/** 장소 자리(화면 %) — 2026-10-30 받은 수도 지도 8장(1672×941, 같은 구도)에 맞춰 잼. ready: 지금 갈 수 있는 곳. */
export const CAPITAL: OutingMap = {
  id: 'capital', ko: '수도', en: 'Capital',
  places: [
    { id: 'park', ko: '도시 공원(데이트)', en: 'City park (date)', x: 23, y: 50, ready: true, aboutKo: '호수와 나무가 있는 큰 공원. 연인·배우자와 함께 오면 데이트 지도가 열립니다.', aboutEn: 'A large park with a lake and trees. Come with a partner or spouse to open the date map.' },
    { id: 'petshop', ko: '펫샵', en: 'Pet shop', x: 27, y: 68, ready: true, aboutKo: '골목의 아늑한 펫샵 — 수조 벽의 물고기, 동물 코너의 애완동물, 날마다 하나씩 들어오는 희귀종.', aboutEn: 'A cosy pet shop in the alleys — fish along the tank wall, pets in the animal corner, and a rare arrival each day.' },
    { id: 'store', ko: '백화점', en: 'Department store', x: 50, y: 44, ready: true, aboutKo: '43층 유리 고층 백화점. 통치자는 40~43층 귀빈층만 — 리빙관·패션·주얼리관·갤러리관·스카이 라운지.', aboutEn: 'A 43-storey glass tower. The ruler may use the VIP floors 40–43 only — Home & Living, Fashion & Jewelry, Gallery and the Sky Lounge.' },
    { id: 'special', ko: '성향별 특별한 곳', en: 'Landmark', x: 54, y: 18, ready: true, aboutKo: '제국 성향마다 다른 랜드마크.', aboutEn: 'A landmark that differs with the empire\'s ethics.' },
    { id: 'stadium', ko: '우주 경기장', en: 'Space stadium', x: 79, y: 45, ready: true, aboutKo: '레전드 오브 갤럭시 — 리그 관람·구단 후원·스포츠토토.', aboutEn: 'Legend of Galaxy — watch the league, sponsor a club, sports toto.' },
    { id: 'tavern', ko: '뒷골목 선술집', en: 'Back-alley tavern', x: 66, y: 72, ready: true, aboutKo: '네온과 비, 낡은 크롬의 허름한 술집. 변장하고 혼자 들어가 시민들 이야기를 엿듣습니다(들키면 소동).', aboutEn: 'A shabby bar of neon, rain and old chrome. Go in alone and in disguise to overhear ordinary citizens (if recognised, chaos).' },
    { id: 'blackmarket', ko: '암시장 골목', en: 'Black market alley', x: 87, y: 72, ready: true, aboutKo: '비 젖은 골목의 노점들 — 희귀·위험한 외계 생물, 밀수품·골동품, 정보상. 혼자 후드를 쓰고 갑니다(흥정·가짜·단속 주의).', aboutEn: 'Stalls in a rain-soaked alley — rare and dangerous creatures, smuggled antiques, an information broker. Go alone, hooded (haggling, fakes and raids).' },
    { id: 'casino', ko: '카지노 정거장', en: 'Casino station', x: 83, y: 11, ready: true, aboutKo: '궤도에 뜬 고리형 카지노 — 슬롯머신·룰렛·성간 주사위·블랙잭·포커. 판돈은 통치자 개인 금고에서.', aboutEn: 'A ring-shaped casino in orbit — slots, roulette, stellar dice, blackjack and poker. Stakes come from the ruler\'s private vault.' },
  ],
};
export const OUTING_MAPS: OutingMap[] = [CAPITAL];

/** 성향별 특별한 곳(계획서 표, 사용자 결정: 지금은 게임 효과 없이 대화·이야기만). */
export const SPECIAL_PLACES: Record<string, { ko: string; en: string; doKo: string; doEn: string }> = {
  spiritualist: { ko: '대성전', en: 'Grand Cathedral', doKo: '예배 참석, 대사제와 대화, 고해', doEn: 'Attend a service, talk with the high priest, confession' },
  militarist: { ko: '제국 사관학교', en: 'Imperial Military Academy', doKo: '생도 사열, 교관·우수 생도와 대화, 졸업식 축사', doEn: 'Review the cadets, talk with instructors and top cadets, graduation address' },
  pacifist: { ko: '평화의 광장', en: 'Plaza of Peace', doKo: '추모비 헌화, 시민 평화 집회 연설', doEn: 'Lay flowers at the memorial, speak at a peace rally' },
  authoritarian: { ko: '개선 광장', en: 'Triumphal Square', doKo: '근위대 사열, 군중 앞 발코니 연설', doEn: 'Review the guard, balcony speech to the crowd' },
  egalitarian: { ko: '시민 회관', en: "Citizens' Hall", doKo: '타운홀 미팅(시민 질문에 답하기)', doEn: "Town hall meeting (answer citizens' questions)" },
  xenophile: { ko: '은하 문화 교류관', en: 'Galactic Cultural Exchange', doKo: '외계 문화 전시·축제, 외국 손님과 만남', doEn: 'Alien culture exhibits and festivals, meet foreign guests' },
  xenophobe: { ko: '순혈 기념관', en: 'Heritage Bastion', doKo: '건국 기념 의식, 국경 방어선 시찰', doEn: 'Founding ceremony, inspect the border defenses' },
  materialist: { ko: '과학 아카데미', en: 'Academy of Sciences', doKo: '연구 견학, 학자와 대화, 신기술 시연', doEn: 'Lab tours, talk with scholars, new tech demos' },
};
export const SPECIAL_KEYS = Object.keys(SPECIAL_PLACES);
export const ETHIC_NAMES: Record<string, [string, string]> = {
  spiritualist: ['정신주의', 'Spiritualist'], militarist: ['군국주의', 'Militarist'], pacifist: ['평화주의', 'Pacifist'], authoritarian: ['권위주의', 'Authoritarian'],
  egalitarian: ['평등주의', 'Egalitarian'], xenophile: ['외계인 친화', 'Xenophile'], xenophobe: ['외계인 혐오', 'Xenophobe'], materialist: ['물질주의', 'Materialist'],
};
/** 고를 수 있는 성향: 우리 제국이 가진 성향(광신 포함). 단일 의식이면 없음. */
export function ethicChoices(ethics: string[] | null | undefined): string[] {
  const e = (ethics ?? []).map((x) => String(x || '').toLowerCase());
  if (e.some((x) => x.includes('gestalt'))) return [];
  return SPECIAL_KEYS.filter((k) => e.includes('ethic_' + k) || e.includes('ethic_fanatic_' + k));
}
/** 쓸 성향(사용자 결정): 기본은 가장 강한 성향(autoKey), 플레이어가 고른 값(pick)이 우리 성향 중 하나면 그것. */
export function specialKey(autoKey: string, choices: string[], pick?: string | null): string | null {
  if (pick && choices.includes(pick)) return pick;
  if (SPECIAL_PLACES[autoKey]) return autoKey;
  return choices[0] ?? null;
}
export type CompanionKind = 'alone' | 'partner' | 'leader';
export interface Companion { kind: CompanionKind; key: string; name: string }
export const ALONE: Companion = { kind: 'alone', key: '', name: '' };
/** 저장된 동행이 아직 유효한지(연인 관계가 끝났거나 지도자가 떠났으면 혼자로). */
export function validCompanion(c: Companion | undefined, partners: Companion[], leaders: Companion[]): Companion {
  if (!c || c.kind === 'alone') return ALONE;
  const pool = c.kind === 'partner' ? partners : leaders;
  return pool.find((x) => x.key === c.key) ?? ALONE;
}
/** 장소에 갈 수 있는지(지금 붙어 있는 곳만). 공원은 연인·배우자와 함께여야 데이트. */
export function canGo(place: Place, comp: Companion, special: string | null): { ok: boolean; whyKo: string; whyEn: string } {
  if (place.id === 'special' && !special) return { ok: false, whyKo: '단일 의식 제국에는 이 장소가 없습니다.', whyEn: 'Gestalt empires have no such place.' };
  if (!place.ready) return { ok: false, whyKo: '아직 준비 중인 곳입니다.', whyEn: 'This place is not open yet.' };
  if (place.id === 'blackmarket' && comp.kind !== 'alone') return { ok: false, whyKo: '암시장은 혼자 후드를 쓰고 가야 합니다(동행이 있으면 눈에 띕니다). 위에서 「혼자」를 고르세요.', whyEn: 'The black market is for you alone, hooded (a companion draws attention). Choose "Alone" above.' };
  if (place.id === 'tavern' && comp.kind !== 'alone') return { ok: false, whyKo: '변장 잠행은 혼자만 갈 수 있습니다(동행이 있으면 눈에 띕니다). 위에서 「혼자」를 고르세요.', whyEn: 'Going in disguise is for you alone (a companion draws attention). Choose "Alone" above.' };
  if (place.id === 'park' && comp.kind !== 'partner') return { ok: false, whyKo: '데이트는 연인·배우자와 함께 가야 합니다. 위에서 동행을 고르세요.', whyEn: 'A date needs a partner or spouse. Choose a companion above.' };
  return { ok: true, whyKo: '', whyEn: '' };
}
