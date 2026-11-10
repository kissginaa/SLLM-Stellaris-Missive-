// 알파 10 동적 일상 분위기(2026-10-28 사용자 확정 — 1028_집컴_옮기기/일상분위기_SNS_설계.md 1·2장, 그날 제안 수치) — 순수 규칙.
//  ① 분위기 태그: 전시/평화 · 경기(인터넷의 호황~공황 5단계) · 안정/불안(평균 안정도 40 미만 또는 시위) · 경사/애도/술렁임(사건으로 잠깐) · 위기.
//     경사(아이 탄생·정략결혼·승전·행성 기념일) 2개월, 애도(통치자·가족 사망·패전) 3개월, 술렁임(음모가 드러남) 2개월.
//     같은 태그라도 제국 성향(군국·평화·정신·물질·권위·평등)으로 어조가 갈린다.
//  ② 비서의 아침 인사: 게임 달이 바뀐 뒤 처음 부를 때 한 줄(틀 문장).
//  ③ 라디오 짧은 꼭지: AI 방송 사이(1분 지점)에 행성 날씨·생활 소식·짧은 광고 중 하나. 30%는 청취자 전화 연결(시민 이름은 종족 이름 표, 성향에 따라 반응이 갈림).
// LLM 없음, 게임 명령 없음. 문구는 한/영 짝(언어 팩 호환은 부르는 쪽의 L).
export type Tone = 'militarist' | 'pacifist' | 'spiritualist' | 'materialist' | 'authoritarian' | 'egalitarian' | 'plain';
export type Econ = 'boom' | 'normal' | 'slow' | 'recession' | 'depression';
export type Flash = 'joy' | 'grief' | 'stir';
export type MainTag = 'crisis' | 'grief' | 'war' | 'stir' | 'unrest' | 'joy' | 'boom' | 'slump' | 'peace';
export interface DayTags { war: boolean; econ: Econ; unrest: boolean; crisis: boolean; flash: Flash | null; flashWhy?: string; tone: Tone; main: MainTag }
export const DAYMOOD = { lowStability: 40, joyMonths: 2, griefMonths: 3, stirMonths: 2, callChance: 0.3, segmentGapMs: 60000 } as const;
export const FLASH_MONTHS: Record<Flash, number> = { joy: DAYMOOD.joyMonths, grief: DAYMOOD.griefMonths, stir: DAYMOOD.stirMonths };
/** 잠깐 켜지는 태그의 우선순위(겹치면 무거운 쪽): 애도 > 술렁임 > 경사. */
const FLASH_RANK: Record<Flash, number> = { grief: 3, stir: 2, joy: 1 };
export interface FlashMark { kind: Flash; until: string; why: string }
/** 새 사건이 들어올 때: 더 무거운 것이거나 지금 것이 끝났으면 바꾼다. */
export function addFlash(cur: FlashMark | null, kind: Flash, why: string, today: string, until: string, cmp: (a: string, b: string) => number): FlashMark {
  if (cur && cmp(today, cur.until) < 0 && FLASH_RANK[cur.kind] > FLASH_RANK[kind]) return cur;
  return { kind, until, why: why.slice(0, 80) };
}
/** 제국 가치관 비트(faction-meeting ETHIC_BITS) → 어조. 광적인 쪽 구분 없이 첫 번째로 보이는 축. */
const BIT_TONE: Array<[number, Tone]> = [[1, 'militarist'], [2, 'pacifist'], [128, 'spiritualist'], [64, 'materialist'], [4, 'authoritarian'], [8, 'egalitarian']];
export const toneOf = (bits: number | undefined): Tone => { if (!bits) return 'plain'; for (const [b, t] of BIT_TONE) if (bits & b) return t; return 'plain'; };
export function mainTag(t: Omit<DayTags, 'main'>): MainTag {
  if (t.crisis) return 'crisis';
  if (t.flash === 'grief') return 'grief';
  if (t.war) return 'war';
  if (t.flash === 'stir') return 'stir';
  if (t.unrest) return 'unrest';
  if (t.flash === 'joy') return 'joy';
  if (t.econ === 'boom') return 'boom';
  if (t.econ === 'recession' || t.econ === 'depression') return 'slump';
  return 'peace';
}
export function computeTags(o: { war: boolean; econ: Econ; avgStability: number | null; protests: number; crisis: boolean; flash: FlashMark | null; today: string; ethBits?: number }, cmp: (a: string, b: string) => number): DayTags {
  const flash = o.flash && cmp(o.today, o.flash.until) < 0 ? o.flash : null;
  const base = { war: o.war, econ: o.econ, unrest: o.protests > 0 || (o.avgStability !== null && o.avgStability < DAYMOOD.lowStability), crisis: o.crisis, flash: flash?.kind ?? null, ...(flash ? { flashWhy: flash.why } : {}), tone: toneOf(o.ethBits) };
  return { ...base, main: mainTag(base) };
}

// ---- 글
type P = [string, string]; // [한, 영]
const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

/** 비서의 아침 인사: 태그별 기본 문장 + 몇몇 태그는 성향별 문장. {cap} = 수도. */
const GREET: Record<MainTag, P[]> = {
  crisis: [['오늘 {cap}는 은하 위기 속보에 귀를 기울이고 있습니다.', 'Today {cap} is glued to the news of the galactic crisis.'], ['밤사이 위기 대응 회의 요청이 몇 건 더 들어왔습니다. 모두 긴장한 얼굴입니다.', 'More requests for crisis meetings came in overnight. Everyone looks tense.']],
  grief: [['오늘 {cap}에는 조기가 걸려 있습니다. 거리가 조용합니다.', 'Flags fly at half-mast over {cap} today. The streets are quiet.'], ['궁 안이 아직 슬픔에 잠겨 있습니다. 오늘 일정은 가볍게 잡아 두었습니다.', 'The palace is still in mourning. I kept today\'s schedule light.']],
  war: [['오늘 {cap}는 전선 소식으로 하루를 시작했습니다.', 'Today {cap} woke up to news from the front.'], ['보급 부서가 새벽부터 바쁩니다. 오늘도 전황 보고가 먼저 올라올 겁니다.', 'Logistics has been busy since dawn. The war report will come first again today.']],
  stir: [['궁정 복도에 수군거림이 많습니다. 다들 말을 아끼는 눈치입니다.', 'There is a lot of whispering in the palace halls. People are guarding their words.'], ['오늘 {cap}의 조간은 모두 궁정 소식뿐입니다.', 'Every morning paper in {cap} is about the court today.']],
  unrest: [['오늘도 {cap} 광장에 사람들이 모였다는 보고입니다. 경비를 늘려 두었습니다.', 'Reports say crowds gathered in the squares of {cap} again. I increased the guard.'], ['거리 분위기가 날카롭습니다. 오늘 이동하실 때는 경호를 붙이겠습니다.', 'The mood on the streets is tense. I will have an escort with you today.']],
  joy: [['오늘 {cap}는 축하 분위기입니다. 창밖에 깃발이 가득합니다.', 'There is a festive air in {cap} today. Banners fill the view outside.'], ['좋은 소식 덕에 궁 안 사람들 표정이 밝습니다.', 'Thanks to the good news, everyone in the palace is smiling.']],
  boom: [['시장이 활기찹니다. {cap}의 새 상점가가 오늘 문을 연다고 합니다.', 'The markets are lively. A new shopping arcade opens in {cap} today.'], ['수입 보고가 좋습니다. 오늘은 기분 좋게 시작하셔도 되겠습니다.', 'The income reports look good. A pleasant start to the day.']],
  slump: [['요즘 {cap} 시장의 물가 불평이 늘었습니다. 상점 몇 곳이 문을 닫았다는 소식도 있습니다.', 'Complaints about prices are growing in {cap}. A few shops have closed, I hear.'], ['살림이 빠듯하다는 목소리가 많습니다. 경제 보고를 먼저 올리겠습니다.', 'Many say times are tight. I will put the economic report on top.']],
  peace: [['오늘 {cap}는 평온합니다. 특별한 소란 없이 하루가 시작되었습니다.', 'All is calm in {cap} today. The day began without any fuss.'], ['좋은 아침입니다. 오늘 {cap} 하늘은 맑습니다.', 'Good morning. The skies over {cap} are clear today.']],
};
const GREET_TONE: Partial<Record<MainTag, Partial<Record<Tone, P[]>>>> = {
  war: {
    militarist: [['오늘 {cap}는 출정식 준비로 분주합니다.', 'Today {cap} is busy preparing a send-off for the troops.']],
    pacifist: [['오늘 {cap}는 모두 숨죽여 전선 소식을 기다리고 있습니다.', 'Today {cap} is holding its breath for news from the front.']],
    spiritualist: [['사원마다 출정한 이들을 위한 기도가 이어지고 있습니다.', 'Every temple is holding prayers for those at the front.']],
    egalitarian: [['시민 의회 앞에 전쟁 소식을 듣겠다는 사람들이 줄을 섰습니다.', 'People are lining up outside the citizens\' assembly to hear about the war.']],
  },
  peace: {
    militarist: [['오늘 아침에도 {cap} 연병장 함성이 들립니다. 평화로운 날입니다.', 'You can hear the drill yards of {cap} again this morning. A peaceful day.']],
    spiritualist: [['아침 예불 종소리가 {cap}에 울렸습니다. 고요한 하루입니다.', 'The morning bells rang over {cap}. A serene day.']],
    materialist: [['오늘 {cap} 연구 단지에서 새 실험 발표가 있다고 합니다.', 'The research district of {cap} has a new experiment to announce today.']],
    authoritarian: [['오늘도 {cap}의 모든 부서가 시간 맞춰 문을 열었습니다.', 'Every office in {cap} opened right on schedule again today.']],
    egalitarian: [['오늘 {cap} 광장에서 시민 토론회가 열린다고 합니다.', 'A citizens\' forum is being held in the squares of {cap} today.']],
  },
  joy: { spiritualist: [['사원마다 감사 예식이 열리고 있습니다.', 'Every temple is holding a thanksgiving rite.']], militarist: [['군악대가 아침부터 {cap} 거리를 행진하고 있습니다.', 'Military bands have been marching through {cap} since morning.']] },
};
export function greeting(t: DayTags, cap: string, r: () => number, L: (ko: string, en: string) => string): string {
  const pool = [...(GREET_TONE[t.main]?.[t.tone] ?? []), ...(GREET_TONE[t.main]?.[t.tone] ?? []), ...GREET[t.main]]; // 성향 문장을 두 배로
  const [ko, en] = pick(r, pool);
  return fill(L(ko, en), { cap: cap || L('수도', 'the capital') });
}

// ---- 라디오 짧은 꼭지
export type SegKind = 'weather' | 'life' | 'ad' | 'call';
export interface SegLine { who: 'announcer' | 'reporter'; text: string }
export interface Segment { kind: SegKind; lines: SegLine[]; caller?: string }
/** 행성 종류 묶음(planets.ts PC_KO 순서) → 날씨 문장. {p} = 행성 이름. */
const WEATHER: Record<string, P[]> = {
  desert: [['{p} 사막 지대는 오늘도 모래바람이 붑니다. 외출 때 보호경을 챙기세요.', 'Sandstorms again over the deserts of {p}. Bring your goggles if you head out.'], ['{p}는 낮 기온이 크게 오르겠습니다. 물을 자주 드세요.', 'Daytime temperatures will soar on {p}. Drink plenty of water.']],
  savanna: [['{p} 초원에는 오후 늦게 소나기가 지나가겠습니다.', 'A late-afternoon shower will sweep the grasslands of {p}.'], ['{p}는 바람이 선선해 산책하기 좋은 날입니다.', 'A cool breeze on {p} makes for a good day to walk.']],
  continental: [['{p}는 맑다가 저녁에 구름이 끼겠습니다.', 'Clear on {p}, clouding over in the evening.'], ['{p}의 가을 같은 날씨가 며칠 더 이어지겠습니다.', 'The autumn-like weather on {p} will last a few more days.']],
  tropical: [['{p}는 습도가 높고 오후에 열대성 소나기가 내리겠습니다.', 'Humid on {p}, with tropical downpours in the afternoon.'], ['{p} 정글 지대에 짙은 안개가 끼었습니다. 운항에 주의하세요.', 'Thick fog over the jungles of {p}. Fly with care.']],
  ocean: [['{p} 해상에는 높은 파도가 일겠습니다. 소형 선박은 출항을 미루세요.', 'High waves on the seas of {p}. Small craft should stay in port.'], ['{p}의 수상 도시들은 오늘 잔잔한 바다를 만나겠습니다.', 'The floating cities of {p} will enjoy calm seas today.']],
  arctic: [['{p}에 눈보라 주의보가 내려졌습니다. 난방 점검을 잊지 마세요.', 'A blizzard warning is out for {p}. Check your heating.'], ['{p}는 오늘도 영하권이지만 오로라가 보이겠습니다.', 'Below freezing on {p} again, but the auroras will be out.']],
  alpine: [['{p} 고산 도로에 낙석 주의가 내려졌습니다.', 'Rockfall warnings on the mountain roads of {p}.'], ['{p}의 높은 봉우리마다 첫눈이 쌓였습니다.', 'First snow has settled on the high peaks of {p}.']],
  toxic: [['{p} 대기 독성 수치가 오늘 다소 높습니다. 필터 마스크를 쓰세요.', 'Atmospheric toxicity on {p} is a little high today. Wear a filter mask.']],
  molten: [['{p} 용암 지대 분출 예보가 있습니다. 방열 구역 밖으로 나가지 마세요.', 'Eruptions forecast in the lava fields of {p}. Stay inside the heat shields.']],
  barren: [['{p} 돔 바깥은 오늘도 먼지 폭풍입니다. 돔 안은 쾌적합니다.', 'Dust storms outside the domes of {p} again; comfortable inside.']],
  city: [['{p} 도시 구역은 오늘 공기 정화 점검이 있어 상층부 바람이 조금 셉니다.', 'Air-scrubber maintenance on {p} today; the upper levels will be a bit breezy.'], ['{p}의 인공 조명 주기가 오늘부터 여름 모드로 바뀝니다.', 'The artificial daylight on {p} switches to summer mode today.']],
  station: [['{p} 궤도는 오늘 미세 운석 경보가 없습니다. 쾌청한 우주입니다.', 'No micrometeor alerts around {p} today. Clear space.'], ['{p} 회전 구역의 중력 보정 점검이 오후에 있습니다.', 'Gravity calibration in the spin ring of {p} this afternoon.']],
  gaia: [['{p}는 오늘도 완벽한 날씨입니다. 정말 부러운 행성이죠.', 'Perfect weather on {p} again. What a lucky world.']],
};
const PC_WEATHER: Record<number, string> = { 1: 'desert', 19: 'desert', 2: 'savanna', 3: 'continental', 4: 'tropical', 5: 'ocean', 6: 'arctic', 21: 'arctic', 7: 'alpine', 11: 'toxic', 10: 'molten', 8: 'barren', 9: 'barren', 14: 'city', 18: 'city', 15: 'station', 16: 'station', 20: 'gaia' };
export const weatherKind = (pc: number): string => PC_WEATHER[pc] ?? 'continental';
const LIFE: Record<MainTag, P[]> = {
  crisis: [['대피소 안내 방송이 시험 송출됩니다. 가까운 대피소 위치를 확인해 두세요.', 'Shelter announcements are being tested. Check where your nearest shelter is.'], ['생필품 사재기가 늘었다는 소식입니다. 정부는 공급이 충분하다고 밝혔습니다.', 'Panic buying is up. The government says supplies are sufficient.']],
  grief: [['전국 극장들이 오늘 저녁 공연을 취소했습니다.', 'Theaters across the empire have cancelled tonight\'s shows.'], ['추모 꽃을 놓으려는 시민들로 궁 앞이 붐빕니다.', 'Citizens are crowding the palace gates to leave flowers.']],
  war: [['전시 배급표 신청이 오늘부터 시작됩니다.', 'Applications for wartime ration cards open today.'], ['퇴근길 역마다 함대 소식을 보려는 사람들이 모여 있습니다.', 'Crowds gather in every station on the way home to catch fleet news.']],
  stir: [['궁정 소식에 대한 소문이 커지고 있습니다. 확인되지 않은 이야기는 퍼뜨리지 말아 주세요.', 'Rumors about the court are spreading. Please don\'t pass on unconfirmed stories.']],
  unrest: [['오늘 도심 일부 노선이 시위로 우회 운행합니다.', 'Some downtown lines are rerouted today because of protests.'], ['상인회가 광장 주변 가게 문을 일찍 닫겠다고 밝혔습니다.', 'The merchants\' guild says shops around the square will close early.']],
  joy: [['축하 행사로 오늘 밤 불꽃놀이가 있습니다. 명당은 일찍 잡으세요.', 'Fireworks tonight for the celebrations. Get a good spot early.'], ['기념 우표가 발행되자마자 매진됐다고 합니다.', 'The commemorative stamps sold out the moment they were issued.']],
  boom: [['새 상점가 개장 첫날, 줄이 블록을 한 바퀴 돌았다는 소식입니다.', 'On opening day, the line at the new arcade wrapped around the block.'], ['신혼부부 주택 청약 경쟁률이 역대 최고를 찍었습니다.', 'Housing applications for newlyweds hit a record high.']],
  slump: [['장바구니 물가가 또 올랐습니다. 오늘의 알뜰 장보기 정보를 이어서 전해 드립니다.', 'Grocery prices are up again. Stay tuned for today\'s budget shopping tips.'], ['구직 박람회에 사람들이 몰렸다는 소식입니다.', 'Job fairs are packed, we hear.']],
  peace: [['주말 행성 간 여객선 표가 거의 다 팔렸습니다.', 'Weekend interplanetary ferry tickets are nearly sold out.'], ['동네 공원마다 저중력 놀이 기구를 새로 들였습니다.', 'Neighborhood parks are getting new low-gravity play gear.'], ['요즘 이종족 요리 교실이 인기라고 합니다.', 'Xeno-cuisine cooking classes are all the rage these days.']],
};
const AD: Record<Tone, P[]> = {
  militarist: [['조국이 당신을 부릅니다! 함대 사관학교 신입생 모집 중.', 'Your nation needs you! The fleet academy is enrolling now.'], ['전시 채권으로 함대를 지키세요. 가까운 은행에서.', 'Guard the fleet with war bonds. At your nearest bank.']],
  pacifist: [['평화 박람회 개막! 이웃 제국의 문화를 만나 보세요.', 'The Peace Expo opens! Meet the cultures of our neighbors.']],
  spiritualist: [['성지 순례 단체 여행 접수 중. 영혼의 쉼표를.', 'Group pilgrimages now booking. A rest for the soul.']],
  materialist: [['최신 가정용 보조 로봇, 이번 달 할인!', 'The newest home assistant robots, on sale this month!'], ['과학관 야간 개장! 아이와 함께 별을 보세요.', 'Science museum open at night! Stargaze with the kids.']],
  authoritarian: [['질서 있는 시민, 강한 제국. 이웃 감시단 모집.', 'Orderly citizens, a strong empire. Join the neighborhood watch.']],
  egalitarian: [['당신의 목소리를 내세요. 시민 의회 방청 신청 접수 중.', 'Make your voice heard. Sign up to attend the citizens\' assembly.']],
  plain: [['오늘만 이 가격! 성간 택배 첫 배송 무료.', 'Today only! Free first delivery with interstellar parcel service.'], ['피곤한 하루 끝엔 저중력 스파로.', 'End a long day at the low-gravity spa.']],
};
const AD_SLUMP: P[] = [['폐업 정리 세일! 전 품목 반값.', 'Closing-down sale! Everything half off.'], ['알뜰 식단 꾸러미, 한 주 식비를 줄여 드립니다.', 'Budget meal kits that cut a week\'s food bill.']];
const AD_BOOM: P[] = [['한정판 고급 우주 요트, 사전 예약 시작.', 'Limited-edition luxury space yachts, pre-orders open.']];
const AD_WAR: P[] = [['정부 공익광고: 전시 채권 한 장이 함선 한 척을 지킵니다.', 'Public notice: one war bond keeps one ship in the fight.']];
const AD_UNREST: P[] = [['정부 공익광고: 질서를 지킵시다. 이웃과 대화로 풉시다.', 'Public notice: keep the peace. Talk it out with your neighbors.']];
/** 전화 연결: 진행자 소개 → 시민 한마디(성향 × 분위기) → 진행자 마무리. */
const CALL_IN: P[] = [['청취자 전화 연결해 보겠습니다. {planet}의 {name}님, 안녕하세요?', 'Let\'s take a call. {name} from {planet}, hello?'], ['전화 주신 분이 계십니다. {planet}에 사시는 {name}님, 말씀하세요.', 'We have a caller. {name}, living on {planet}, go ahead.']];
const CALL_OUT: P[] = [['네, 소중한 말씀 감사합니다.', 'Thank you for sharing that.'], ['좋은 하루 보내세요, {name}님. 다음 소식입니다.', 'Have a good day, {name}. On to the next story.'], ['그런 목소리도 있군요. 전화 감사합니다.', 'Interesting point. Thanks for calling.']];
type Lean = 'prog' | 'cons' | 'neu';
const CALL_SAY: Record<MainTag, Record<Lean, P[]>> = {
  crisis: { prog: [['이럴 때일수록 이웃 제국과 힘을 모아야 해요.', 'Now more than ever we need to work with our neighbors.']], cons: [['국경부터 단단히 막아야 합니다. 남 걱정할 때가 아니에요.', 'Seal the borders first. This is no time to worry about others.']], neu: [['솔직히 무서워요. 아이들이 밤에 잠을 못 자요.', 'Honestly, I\'m scared. The kids can\'t sleep at night.']] },
  grief: { prog: [['함께 슬퍼하는 사람들이 이렇게 많다니 위로가 돼요.', 'It helps to see so many people grieving together.']], cons: [['이럴 때 나라가 흔들리면 안 됩니다. 마음을 다잡아야죠.', 'The nation can\'t waver at a time like this. We must stay steady.']], neu: [['꽃집이 다 문을 닫았더라고요. 다들 같은 마음인가 봐요.', 'All the flower shops are sold out. I guess we all feel the same.']] },
  war: { prog: [['하루빨리 협상 자리에 앉았으면 좋겠어요. 우리 아들이 전선에 있어요.', 'I hope they sit down to talk soon. My son is at the front.']], cons: [['이번에 확실히 보여 줘야 합니다. 우리 함대 믿습니다!', 'We need to show them this time. I trust our fleet!']], neu: [['배급이 줄어서 걱정이지만 다들 버티고 있어요.', 'The rations are smaller, but everyone\'s holding on.']] },
  stir: { prog: [['궁정에서 무슨 일이 있었는지 투명하게 밝혔으면 해요.', 'I want them to be open about what happened at court.']], cons: [['배신자는 엄하게 다스려야죠.', 'Traitors should be dealt with harshly.']], neu: [['소문이 하도 많아서 뭘 믿어야 할지 모르겠어요.', 'There are so many rumors, I don\'t know what to believe.']] },
  unrest: { prog: [['시위대 말도 좀 들어 줬으면 해요. 다 이유가 있잖아요.', 'I wish someone would listen to the protesters. They have their reasons.']], cons: [['출근길이 막혀서 미치겠어요. 질서가 먼저입니다.', 'My commute is a mess. Order comes first.']], neu: [['가게 문을 일찍 닫아야 해서 손님이 줄었어요.', 'We have to close early, so we\'re losing customers.']] },
  joy: { prog: [['이런 날은 모두가 하나가 되는 느낌이에요!', 'Days like this make us all feel like one!']], cons: [['제국의 영광입니다! 오늘은 다 같이 축배를!', 'Glory to the empire! A toast for everyone today!']], neu: [['아이들이랑 불꽃놀이 보러 가려고요.', 'I\'m taking the kids to see the fireworks.']] },
  boom: { prog: [['돈이 도는 만큼 노동자 몫도 늘었으면 해요.', 'If money is flowing, workers should get their share.']], cons: [['역시 잘 하고 있어요. 이대로만 가면 됩니다.', 'They\'re doing well. Just keep it up.']], neu: [['월급이 조금 올랐어요. 오랜만에 외식했죠.', 'Got a small raise. We finally ate out.']] },
  slump: { prog: [['서민 지원책이 더 필요해요. 장보기가 무서워요.', 'We need more support for ordinary people. I\'m scared to go shopping.']], cons: [['허리띠 졸라매면 지나갑니다. 불평만 하지 맙시다.', 'Tighten our belts and it\'ll pass. Let\'s not just complain.']], neu: [['가게 셋 중 하나는 문을 닫았더라고요.', 'One in three shops on my street has closed.']] },
  peace: { prog: [['요즘 이웃 종족 친구가 생겼어요. 세상 참 좋아졌죠.', 'I made a friend from another species lately. The world\'s gotten better.']], cons: [['평화로울 때 군비를 갖춰야죠. 방심은 금물입니다.', 'We should arm up while it\'s peaceful. Never let your guard down.']], neu: [['날씨도 좋고 별일 없어요. 그냥 인사드리고 싶었어요.', 'Nice weather, nothing special. I just wanted to say hello.']] },
};
export interface SegInput { tags: DayTags; planets: Array<{ name: string; pc: number }>; callerName: string; callerLean: Lean; r: () => number; L: (ko: string, en: string) => string; force?: SegKind }
/** 꼭지 하나(30%는 전화 연결, 나머지는 날씨·생활·광고). */
export function makeSegment(i: SegInput): Segment {
  const { r, L, tags } = i;
  const kind: SegKind = i.force ?? (r() < DAYMOOD.callChance ? 'call' : pick(r, ['weather', 'life', 'ad'] as const));
  const a = (p: P, v: Record<string, string> = {}): SegLine => ({ who: 'announcer', text: fill(L(p[0], p[1]), v) });
  if (kind === 'call') {
    const pl = i.planets.length ? pick(r, i.planets).name : L('수도', 'the capital');
    const v = { name: i.callerName || L('익명의 청취자', 'an anonymous listener'), planet: pl };
    const say = pick(r, CALL_SAY[tags.main][i.callerLean]);
    return { kind, caller: v.name, lines: [a(pick(r, CALL_IN), v), { who: 'reporter', text: fill(L(say[0], say[1]), v) }, a(pick(r, CALL_OUT), v)] };
  }
  if (kind === 'weather' && i.planets.length) {
    const p = pick(r, i.planets), w = WEATHER[weatherKind(p.pc)] ?? WEATHER.continental;
    return { kind, lines: [a(['행성 날씨입니다.', 'Planetary weather.']), a(pick(r, w), { p: p.name })] };
  }
  if (kind === 'ad') {
    const pool = [...AD[tags.tone], ...AD.plain, ...(tags.main === 'slump' ? AD_SLUMP : []), ...(tags.main === 'boom' ? AD_BOOM : []), ...(tags.war ? AD_WAR : []), ...(tags.unrest ? AD_UNREST : [])];
    return { kind, lines: [a(['잠시 광고 듣고 오겠습니다.', 'A quick word from our sponsors.']), a(pick(r, pool))] };
  }
  return { kind: 'life', lines: [a(['생활 소식입니다.', 'Life around the empire.']), a(pick(r, LIFE[tags.main]))] };
}
export const SEG_LABEL: Record<SegKind, P> = { weather: ['행성 날씨', 'Planetary weather'], life: ['생활 소식', 'Daily life'], ad: ['광고', 'Ad break'], call: ['청취자 전화 연결', 'Listener call-in'] };
/** 검사용: 모든 태그·성향에 문장이 있는가. */
export const _tables = { GREET, LIFE, CALL_SAY, AD, WEATHER };
