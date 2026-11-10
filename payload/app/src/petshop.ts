// 펫샵(2026-10-30 사용자 결정, 계획서 8·10번) — 순수 자료·규칙(electron 없이 selftest).
// 수도 골목의 아늑한 동네 가게 하나(층 없음). 왼쪽 수조 벽 = 물고기 15 · 오른쪽 동물 코너 = 애완동물 15 · 가운데 계산대 = 가게 주인(정해진 대사, AI 없음).
// 「오늘 들어온 아이」: 날마다 그날만 파는 희귀종 하나(사용자 결정 — 할인이 아니라 희귀종). 돌봄 없음 — 들여놓기만(침실 어항·동물 자리).
// 한도: 어항 물고기 8 · 애완동물 3. 애완동물은 살 때 이름을 지음(물고기는 골라서).
// 연인·배우자와 오면 동물마다 취향 반응 한 줄, 마음에 들어 한 아이를 사면 호감 조금(같은 날 두 번째부터는 반).
// 그림: 10_펫샵_그림_의뢰서.md → ui/petshop/(bg.webp · keeper.png · items/(id).png). 없으면 앱이 그린 모양.

export type Kind = 'fish' | 'pet';
export type PTag = 'cute' | 'graceful' | 'exotic' | 'calm' | 'lively' | 'shiny';
export interface Animal { id: string; kind: Kind; ko: string; en: string; price: number; tags: PTag[]; aboutKo: string; aboutEn: string; rare?: true }

const A = (kind: Kind, id: string, ko: string, en: string, price: number, tags: PTag[], aboutKo: string, aboutEn: string, rare?: true): Animal => ({ id, kind, ko, en, price, tags, aboutKo, aboutEn, ...(rare ? { rare } : {}) });
export const ANIMALS: Animal[] = [
  // 수조 벽 — 물고기 15(계획서 초안 21~30 + 새 5)
  A('fish', 'goldfish', '금붕어', 'Goldfish', 20, ['cute', 'calm'], '어디서나 잘 사는 지구의 오랜 친구.', 'An old friend from Earth that thrives anywhere.'),
  A('fish', 'betta', '베타', 'Betta fish', 35, ['graceful', 'lively'], '지느러미가 비단 깃발처럼 펄럭입니다.', 'Fins that ripple like silk banners.'),
  A('fish', 'angelfish', '엔젤피시', 'Angelfish', 45, ['graceful', 'calm'], '천천히 미끄러지는 우아한 줄무늬.', 'Elegant stripes gliding slowly.'),
  A('fish', 'jellyfish', '해파리', 'Jellyfish', 70, ['graceful', 'exotic'], '물속에서 숨 쉬듯 오르내립니다.', 'Rises and falls as if breathing.'),
  A('fish', 'seahorse', '해마', 'Seahorse', 60, ['cute', 'calm'], '꼬리로 수초를 감고 졸고 있습니다.', 'Dozing with its tail curled round a plant.'),
  A('fish', 'plankton', '발광 플랑크톤 떼', 'Glowing plankton swarm', 50, ['shiny', 'calm'], '불을 끄면 어항이 은하처럼 빛납니다.', 'Turn off the lights and the tank glows like a galaxy.'),
  A('fish', 'crystal_fish', '결정 비늘 물고기', 'Crystal-scale fish', 120, ['shiny', 'exotic'], '비늘이 빛을 무지개로 쪼갭니다.', 'Its scales split light into rainbows.'),
  A('fish', 'cave_fish', '세 눈 동굴어', 'Three-eyed cave fish', 90, ['exotic', 'lively'], '세 눈이 따로따로 주인을 봅니다.', 'Each of its three eyes watches you separately.'),
  A('fish', 'void_eel', '소형 공허 장어', 'Miniature void eel', 200, ['exotic', 'graceful'], '몸 안쪽이 밤하늘처럼 까맣고 깊습니다.', 'Its body is dark and deep as the night sky.'),
  A('fish', 'baby_kraken', '꼬마 크라켄', 'Baby kraken', 350, ['cute', 'exotic'], '촉수로 유리를 톡톡 두드립니다.', 'Taps the glass with its tentacles.'),
  A('fish', 'clownfish', '흰동가리', 'Clownfish', 30, ['cute', 'lively'], '말미잘 사이를 바쁘게 들락날락.', 'Busily darts in and out of the anemones.'),
  A('fish', 'koi', '비단잉어', 'Koi', 80, ['graceful', 'calm'], '오래 살수록 무늬가 깊어진다는 물고기.', 'They say its patterns deepen with age.'),
  A('fish', 'pufferfish', '복어', 'Pufferfish', 40, ['cute', 'lively'], '놀라면 동그랗게 부풉니다(귀엽지만 만지지 마세요).', 'Puffs up when startled (cute, but do not touch).'),
  A('fish', 'nebula_ray', '성운 가오리', 'Nebula ray', 160, ['graceful', 'shiny'], '등에 성운 무늬가 천천히 흐릅니다.', 'Nebula patterns drift slowly across its back.'),
  A('fish', 'bubble_snail', '거품 달팽이', 'Bubble snail', 25, ['cute', 'calm'], '유리를 닦으며 작은 거품을 뿜습니다.', 'Cleans the glass and puffs tiny bubbles.'),
  // 동물 코너 — 애완동물 15(계획서 초안 31~40 + 새 5)
  A('pet', 'cat', '고양이', 'Cat', 120, ['cute', 'calm'], '궁전의 가장 좋은 쿠션을 이미 찜했습니다.', 'Has already claimed the best cushion in the palace.'),
  A('pet', 'dog', '개', 'Dog', 120, ['cute', 'lively'], '통치자를 보자마자 꼬리가 멈추지 않습니다.', 'Its tail has not stopped since it saw you.'),
  A('pet', 'parrot', '앵무새', 'Parrot', 100, ['lively', 'shiny'], '어전 회의 말투를 금세 따라 할 겁니다.', 'It will pick up the council\'s phrases in no time.'),
  A('pet', 'tortoise', '거북', 'Tortoise', 80, ['calm'], '통치자의 치세보다 오래 살지도 모릅니다.', 'It may well outlive your reign.'),
  A('pet', 'hamster', '햄스터', 'Hamster', 40, ['cute', 'lively'], '볼에 씨앗을 가득 채우고 쳐다봅니다.', 'Stares at you with cheeks full of seeds.'),
  A('pet', 'puffball', '솜뭉치 퍼프', 'Puffball', 90, ['cute', 'exotic'], '쓰다듬으면 작게 웅웅 웁니다.', 'Hums softly when petted.'),
  A('pet', 'tiyanki_calf', '꼬마 티얀키', 'Tiyanki calf', 400, ['graceful', 'exotic'], '방 안을 천천히 떠다니는 아기 우주 고래.', 'A baby space whale drifting slowly round the room.'),
  A('pet', 'crystal_spider', '결정 거미', 'Crystal spider', 150, ['shiny', 'exotic'], '거미줄이 유리 실처럼 반짝입니다.', 'Its web glitters like glass thread.'),
  A('pet', 'sky_jelly', '공중 해파리', 'Floating sky-jelly', 180, ['graceful', 'shiny'], '물 없이 공중을 헤엄칩니다.', 'Swims through the air without water.'),
  A('pet', 'singing_moss', '노래하는 이끼', 'Singing moss', 70, ['calm', 'exotic'], '해가 지면 낮게 노래합니다.', 'Hums a low song at sunset.'),
  A('pet', 'rabbit', '토끼', 'Rabbit', 60, ['cute', 'calm'], '코를 쉴 새 없이 씰룩입니다.', 'Its nose never stops twitching.'),
  A('pet', 'fox', '사막여우', 'Fennec fox', 220, ['cute', 'lively'], '귀가 몸의 절반입니다.', 'Its ears are half its body.'),
  A('pet', 'owl', '부엉이', 'Owl', 140, ['graceful', 'calm'], '밤 늦게까지 서류 보는 통치자의 친구.', 'A friend for rulers who read papers late into the night.'),
  A('pet', 'glow_lizard', '빛 도마뱀', 'Glow lizard', 110, ['shiny', 'lively'], '기분이 좋으면 몸 색이 바뀝니다.', 'Changes colour when it is happy.'),
  A('pet', 'pocket_drake', '주머니 용', 'Pocket drake', 300, ['exotic', 'lively'], '손바닥만 한 용. 재채기하면 작은 불꽃이 나옵니다.', 'A palm-sized dragon that sneezes tiny sparks.'),
];
/** 「오늘 들어온 아이」 — 그날만 파는 희귀종(날마다 하나). */
export const RARES: Animal[] = [
  A('fish', 'starlight_koi', '별빛 비단잉어', 'Starlight koi', 600, ['shiny', 'graceful'], '비늘마다 작은 별이 박혀 있습니다.', 'A tiny star set in every scale.', true),
  A('fish', 'mini_leviathan', '아기 리바이어던', 'Leviathan hatchling', 900, ['exotic', 'graceful'], '언젠가는 어항이 좁아질지도… 지금은 손가락만 합니다.', 'Someday the tank may be too small… for now it is finger-sized.', true),
  A('fish', 'prism_seahorse', '프리즘 해마', 'Prism seahorse', 450, ['shiny', 'cute'], '움직일 때마다 색이 바뀝니다.', 'Changes colour every time it moves.', true),
  A('pet', 'phoenix_chick', '불새 병아리', 'Phoenix chick', 1200, ['shiny', 'lively'], '깃털 끝이 늘 따뜻합니다.', 'The tips of its feathers are always warm.', true),
  A('pet', 'moon_cat', '달 고양이', 'Moon cat', 800, ['cute', 'graceful'], '어둠 속에서 은은하게 빛나는 털.', 'Fur that glows softly in the dark.', true),
  A('pet', 'nebula_fox', '성운 여우', 'Nebula fox', 950, ['exotic', 'cute'], '꼬리에 작은 성운이 흐릅니다.', 'A small nebula drifts through its tail.', true),
  A('pet', 'shard_golem', '조각 골렘', 'Shard golem pup', 700, ['exotic', 'calm'], '돌 조각이 모여 만든 작은 친구. 아주 순합니다.', 'A tiny friend made of stone shards. Very gentle.', true),
];
export const ALL_ANIMALS: Animal[] = [...ANIMALS, ...RARES];
export const animalById = (id: string): Animal | undefined => ALL_ANIMALS.find((x) => x.id === id);
export const FISH_MAX = 8, PET_MAX = 3;

const hash = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** 그날의 희귀종(세이브·날짜로 고정 — 저장 없이 그날은 늘 같음). */
export const rareOfDay = (sid: string, day: string): Animal => RARES[hash(`${sid}|${day}`) % RARES.length];

const ALL_TAGS: PTag[] = ['cute', 'graceful', 'exotic', 'calm', 'lively', 'shiny'];
/** 인물마다 정해진 동물 취향(인물 key 로 고정). */
export function petLikesOf(key: string): PTag[] {
  const h = hash(`pet:${key}`), a = ALL_TAGS[h % 6], b = ALL_TAGS[(Math.floor(h / 6) % 5 + 1 + (h % 6)) % 6]; return a === b ? [a] : [a, b];
}
export function petReactionOf(an: Animal, liked: PTag[], name: string): { hit: number; line: [string, string] } {
  const hit = an.tags.filter((t) => liked.includes(t)).length;
  if (hit >= 2) return { hit, line: [`${name}: "어머, 이 아이 데려가요! 꼭이요!"`, `${name}: "Oh, let's take this one home! Please!"`] };
  if (hit === 1) return { hit, line: [`${name}: "이 아이 귀엽네요."`, `${name}: "This one's lovely."`] };
  return { hit, line: [`${name}: "음… 저는 잘 모르겠어요."`, `${name}: "Hmm… I'm not sure about this one."`] };
}
/** 함께 고르기 호감: 마음에 들어 하면 +1(아주 좋아하면 +2), 같은 날 두 번째부터는 반(내림). */
export const pickDelta = (hit: number, repeatToday: boolean): number => { const d = hit >= 2 ? 2 : hit === 1 ? 1 : 0; return repeatToday ? Math.floor(d / 2) : d; };

/** 이름: 앞뒤 공백·줄바꿈 정리, 24자. 애완동물은 꼭, 물고기는 비어도 됨. */
export const cleanName = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);

/** 가게 주인(모포) — 정해진 대사. */
export const KEEPER = { ko: '모포', en: 'Mopo' };
export const KEEPER_LINES: Record<'greet' | 'greetWith' | 'rare' | 'buy' | 'fullFish' | 'fullPet' | 'bye', [string, string]> = {
  greet: ['어서 오세요! 아이고, 통치자님이 직접 오시다니… 천천히 둘러보세요.', 'Welcome! Goodness, the ruler in person… take your time and look around.'],
  greetWith: ['어서 오세요! {name} 님도 함께 오셨네요. 마음에 드는 아이가 있으면 말씀만 하세요.', 'Welcome! And {name} too. Just say the word if one of them catches your eye.'],
  rare: ['오늘 들어온 아이는 {animal}예요. 오늘만 있어요 — 내일이면 다른 손님 품으로 갈 거예요.', 'Today\'s arrival is the {animal}. Only today — tomorrow it will be in someone else\'s arms.'],
  buy: ['좋은 선택이에요! {name}(은)는 궁으로 바로 보내 드릴게요.', 'Lovely choice! I\'ll send {name} straight to the palace.'],
  fullFish: ['어항이 벌써 꽉 찼어요(최대 {n}마리). 집이 좁으면 아이들이 힘들어해요.', 'Your tank is already full ({n} max). They get stressed when it\'s crowded.'],
  fullPet: ['궁에 이미 {n}마리나 있잖아요. 집이 좁을 텐데요.', 'You already have {n} at the palace. It\'ll be crowded.'],
  bye: ['또 오세요! 아이들이 기다릴 거예요.', 'Come again! The little ones will be waiting.'],
};
/** 구경할 때 반응(쓰다듬기·먹이 구경) — 종류별 몇 줄, 돌려 씀. */
export const TOUCH_LINES: Record<Kind, Array<[string, string]>> = {
  fish: [['유리를 톡 두드리자 {name}(이)가 다가옵니다.', 'You tap the glass and the {name} swims closer.'], ['먹이를 조금 뿌리자 {name}(이)가 신나게 받아먹습니다.', 'You sprinkle a little food and the {name} gobbles it up.'], ['{name}(이)가 수초 사이로 숨었다가 빼꼼 내다봅니다.', 'The {name} hides among the plants, then peeks out.']],
  pet: [['{name}(이)가 손에 머리를 비빕니다.', 'The {name} nuzzles your hand.'], ['간식을 내밀자 {name}(이)가 조심스럽게 받아 갑니다.', 'You offer a treat and the {name} takes it carefully.'], ['{name}(이)가 통치자를 빤히 올려다봅니다.', 'The {name} stares up at you.']],
};
