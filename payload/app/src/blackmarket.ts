// 암시장 골목(2026-10-30, 계획서 10번 외출). 순수 자료·규칙(electron 없이 selftest).
// 혼자 후드를 쓰고 들어가는 비 젖은 골목 시장. 노점 셋: 희귀 생물상(펫샵에 없는 위험한 외계 생물) · 밀수품·골동품상 · 정보상(궁정 음모 단서·감정).
// 값은 흥정(AI 없음): 상인마다 숨겨진 최저가와 성격. 위험: 가짜 물건(감정하면 드러남) · 단속(순찰 열기가 차면 도망, 그날 재입장 불가).
// 결과는 기록만(게임·민심 효과 없음). 정보상의 음모 단서만 기존 궁정 음모(court-app)의 「수상한 낌새」를 미리 켬.
// 그림: 12_암시장_그림_의뢰서.md → ui/blackmarket/(bg · merchants/<stall> · items/<id>). 없으면 앱이 그린 장면.

export type StallId = 'creatures' | 'smuggler' | 'broker';
export interface BmItem { id: string; stall: 'creatures' | 'smuggler'; ko: string; en: string; ask: number; aboutKo: string; aboutEn: string; fakeKo: string; fakeEn: string }
const I = (stall: BmItem['stall'], id: string, ko: string, en: string, ask: number, aboutKo: string, aboutEn: string, fakeKo: string, fakeEn: string): BmItem => ({ id, stall, ko, en, ask, aboutKo, aboutEn, fakeKo, fakeEn });
export const ITEMS: BmItem[] = [
  I('creatures', 'void_leech', '공허 거머리', 'Void leech', 420, '빛을 빨아먹습니다. 어항 근처 조명이 어두워집니다.', 'It drinks light. Lamps near its tank grow dim.', '검게 칠한 민물 거머리', 'A freshwater leech painted black'),
  I('creatures', 'acid_slime', '산성 슬라임', 'Acid slime', 360, '전용 유리병에서만 삽니다. 뚜껑을 열지 마세요.', 'Lives only in its own glass jar. Do not open the lid.', '형광 젤리', 'Glow-in-the-dark jelly'),
  I('creatures', 'tentacle_imp', '꼬마 촉수 괴물', 'Tentacle imp', 680, '장난을 좋아합니다. 서랍을 자꾸 엽니다.', 'Loves mischief. Keeps opening drawers.', '촉수를 붙인 문어 인형', 'A plush octopus with glued tentacles'),
  I('creatures', 'mind_moth', '정신 나방', 'Mind moth', 540, '날개 무늬를 보면 잠깐 꿈을 꿉니다.', 'Look at its wing patterns and you briefly dream.', '그림 그린 보통 나방', 'An ordinary moth with painted wings'),
  I('creatures', 'ember_salamander', '불씨 도롱뇽', 'Ember salamander', 760, '몸이 늘 따뜻합니다. 겨울 침실에 좋습니다.', 'Always warm. Nice for a winter bedroom.', '발열 패치를 붙인 도마뱀', 'A lizard with a heat patch stuck on'),
  I('creatures', 'glass_scorpion', '유리 전갈', 'Glass scorpion', 900, '속이 다 비칩니다. 독침은 뽑았다고 합니다(아마도).', 'Completely see-through. The stinger was removed (probably).', '유리 공예품(움직이지 않음)', 'A glass ornament (does not move)'),
  I('creatures', 'star_eater', '별먹이 아메바', 'Star-eater amoeba', 1300, '밤하늘 사진을 먹고 반짝입니다.', 'Eats photographs of the night sky and sparkles.', '반짝이 가루를 섞은 물', 'Water with glitter mixed in'),
  I('creatures', 'shadow_cat', '그림자 고양이', 'Shadow cat', 1600, '어두운 데서는 안 보입니다. 이름을 부르면 옵니다.', 'Invisible in the dark. Comes when called.', '검은 길고양이', 'A black alley cat'),
  I('smuggler', 'cockpit_chair', '해체된 전투기 조종석 의자', 'Salvaged fighter cockpit seat', 520, '격추된 전투기에서 뜯어 왔습니다. 안락의자로 개조.', 'Ripped from a downed fighter, refitted as an armchair.', '플라스틱 게임 의자', 'A plastic gaming chair'),
  I('smuggler', 'throne_shard', '멸망한 제국의 왕좌 조각', 'Shard of a fallen throne', 1800, '어느 사라진 제국의 옥좌 팔걸이라고 합니다.', 'Said to be the armrest of a vanished empire\'s throne.', '금색 페인트를 칠한 의자 다리', 'A chair leg painted gold'),
  I('smuggler', 'banned_holo', '금지된 선전 홀로그램', 'Banned propaganda hologram', 300, '옛 정권의 선전 영상이 돌아갑니다. 소리는 끔.', 'Loops an old regime\'s propaganda. Sound off.', '고장 난 광고판 조각', 'A broken billboard panel'),
  I('smuggler', 'xeno_idol', '외계 우상', 'Xeno idol', 950, '어느 원시 행성에서 가져온 신상. 밤에 눈이 빛납니다.', 'A god-statue from a primitive world. Its eyes glow at night.', '관광지 기념품', 'A tourist souvenir'),
  I('smuggler', 'general_helm', '적국 장군의 투구', 'Enemy general\'s helm', 1200, '전장에서 주웠다는 투구. 흠집이 그대로.', 'Supposedly picked up on a battlefield. Dents and all.', '연극 소품 투구', 'A theatre prop helmet'),
  I('smuggler', 'pirate_chart', '해적 성도', 'Pirate star chart', 680, '숨겨진 항로가 표시된 낡은 홀로 지도.', 'An old holo-map marking hidden lanes.', '아무 데나 그린 낙서 지도', 'A doodled map of nowhere'),
  I('smuggler', 'ai_core', '꺼진 고대 AI 핵', 'Dormant ancient AI core', 2400, '켜지 마세요. 진심입니다.', 'Do not switch it on. Seriously.', '빛나는 유리 공', 'A glowing glass ball'),
  I('smuggler', 'precursor_vase', '선구자 항아리', 'Precursor vase', 2000, '선구자 문명의 무늬가 새겨진 항아리.', 'A vase carved with precursor patterns.', '어제 구운 도자기', 'Pottery fired yesterday'),
];
export const itemOf = (id: string) => ITEMS.find((x) => x.id === id);
export const STALLS: Array<{ id: StallId; ko: string; en: string; whoKo: string; whoEn: string; greetKo: string; greetEn: string; temper: number }> = [
  { id: 'creatures', ko: '희귀 생물상', en: 'Rare creature dealer', whoKo: '비늘 피부의 상인 벡스', whoEn: 'Vex, a scaly-skinned dealer', greetKo: '"쉿. 펫샵엔 없는 애들이야. 만지면 책임 못 져."', greetEn: '"Shh. You won\'t find these at the pet shop. Touch at your own risk."', temper: 0.62 },
  { id: 'smuggler', ko: '밀수품·골동품상', en: 'Smuggler & antiques', whoKo: '외눈 안경의 노파 맥스 할멈', whoEn: 'Old Mags, with a monocle', greetKo: '"어디서 났는지는 묻지 말고, 마음에 들면 값을 불러 봐."', greetEn: '"Don\'t ask where it came from. If you like it, name a price."', temper: 0.7 },
  { id: 'broker', ko: '정보상', en: 'Information broker', whoKo: '얼굴을 홀로그램으로 가린 「그림자」', whoEn: '"Shade", face hidden behind a hologram', greetKo: '"궁 안 소문이든, 물건 진짜 가짜든… 다 값이 있지."', greetEn: '"Palace whispers, real or fake goods… everything has a price."', temper: 0 },
];
export const stallOf = (id: string) => STALLS.find((s) => s.id === id);

export const BM = { heatMax: 100, offerHeat: 6, buyHeat: 12, brokerHeat: 8, raidFrom: 60, raidChance: 0.12, patience: 3, tipCost: 400, tipNone: 100, appraiseCost: 30, fakeCreature: 0.1, fakeGoods: 0.2, maxCreatures: 2 } as const;
const hash = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** 숨겨진 최저가: 부르는 값 × (상인 성격 ± 물건·날짜마다 조금). */
export function floorOf(it: BmItem, day: string): number { const st = stallOf(it.stall)!, j = ((hash(`${it.id}|${day}`) % 21) - 10) / 100; return Math.round(it.ask * Math.max(0.45, Math.min(0.9, st.temper + j))); }
export interface Deal { ask: number; patience: number; closed?: boolean }
export type OfferResult = { kind: 'accept'; price: number } | { kind: 'counter'; ask: number } | { kind: 'insult'; ask: number } | { kind: 'walk' };
/** 흥정 한 번: 부르는 값 이상이면 그 값에 · 최저가 이상이면 받아들임 · 그 아래면 반값쯤 깎아 되부름 · 너무 낮으면(최저가 70% 미만) 기분 상해 값을 올림. 참을성이 다하면 그날은 그 물건 안 팜. */
export function offer(d: Deal, price: number, floor: number): { deal: Deal; r: OfferResult } {
  const p = Math.max(0, Math.round(price)); if (d.closed || d.patience <= 0) return { deal: { ...d, closed: true }, r: { kind: 'walk' } };
  if (p >= d.ask) return { deal: { ...d, closed: true }, r: { kind: 'accept', price: d.ask } };
  if (p >= floor) return { deal: { ...d, closed: true }, r: { kind: 'accept', price: p } };
  if (p < floor * 0.7) { const pat = d.patience - 2, ask = Math.round(d.ask * 1.1); return pat <= 0 ? { deal: { ask, patience: 0, closed: true }, r: { kind: 'walk' } } : { deal: { ask, patience: pat }, r: { kind: 'insult', ask } }; }
  const pat = d.patience - 1, ask = Math.max(floor, Math.round((d.ask + p) / 2 + (d.ask - floor) * 0.1));
  return pat <= 0 ? { deal: { ask, patience: 0, closed: true }, r: { kind: 'walk' } } : { deal: { ask, patience: pat }, r: { kind: 'counter', ask } };
}
export const fakeChance = (it: BmItem): number => (it.stall === 'creatures' ? BM.fakeCreature : BM.fakeGoods);
export const clampHeat = (n: number): number => Math.max(0, Math.min(BM.heatMax, Math.round(n)));
/** 단속: 열기가 다 차면 반드시, 60부터는 행동마다 12% 확률. */
export const raidNow = (heat: number, roll: number): boolean => heat >= BM.heatMax || (heat >= BM.raidFrom && roll < BM.raidChance);

type Pair = [string, string];
export const LINES: Record<'counter' | 'insult' | 'walk' | 'accept' | 'full' | 'tipNone' | 'tip' | 'appraiseReal' | 'appraiseFake' | 'raid' | 'banned' | 'drone', Pair> = {
  counter: ['"{ask}. 그 아래론 안 돼."', '"{ask}. Not a credit less."'],
  insult: ['"장난해? 이제 {ask}야. 한 번만 더 그러면 끝이야."', '"Are you joking? Now it\'s {ask}. Do that again and we\'re done."'],
  walk: ['"됐어, 오늘은 너한테 안 팔아."', '"Forget it. Not selling to you today."'],
  accept: ['"좋아, {price}. 거래 끝. 조용히 들고 가."', '"Fine, {price}. Deal. Carry it quietly."'],
  full: ['"우리에 이미 둘이나 있잖아. 더 데려가면 소문 나."', '"You already keep two. Take more and people will talk."'],
  tipNone: ['"요즘 궁은 조용해. 상담료만 받을게."', '"The palace is quiet these days. I\'ll just take a consultation fee."'],
  tip: ['그림자가 몸을 숙입니다. "궁에서 {name} 쪽이 움직이고 있어. {kind}… 그 정도만 말해 두지."', 'Shade leans in. "Someone near {name} is moving in the palace. {kind}… that\'s all I\'ll say."'],
  appraiseReal: ['"{item}? 진짜야. 운이 좋네."', '"{item}? Genuine. Lucky you."'],
  appraiseFake: ['"{item}… 이건 {fake}잖아. 속았네."', '"{item}… this is {fake}. You got conned."'],
  raid: ['사이렌! 순찰 드론의 탐조등이 골목을 훑고, 상인들이 방수포를 걷어 던지며 흩어집니다. 후드를 깊이 눌러쓰고 뒷길로 뛰어 빠져나갑니다.', 'Sirens! Patrol drone searchlights sweep the alley and the dealers scatter, tarps flying. You pull your hood down and run for the back lanes.'],
  banned: ['오늘은 골목에 단속이 깔렸습니다. 경호실이 막습니다(내일 다시).', 'The alley is crawling with patrols today. Security won\'t allow it (try tomorrow).'],
  drone: ['머리 위로 순찰 드론이 낮게 지나갑니다.', 'A patrol drone glides low overhead.'],
};
