// 감청 방송(2026-11-03 사용자 결정 ④): 무선 통신이 있는 원시문명(산업 시대 이상)을 우리 관측소가 지켜보고 있으면 그들의 방송을 엿듣는다.
// 시대가 매체를 정하고(산업·기계 = 라디오, 원자력 = TV, 초기 우주 = 위성 방송), 인지도가 내용을 바꾼다(하늘의 이상한 빛 → 외계인 소문 → 우리를 향한 메시지).
// 「슈뢰딩거」: 자동으로 받지 않는다. 플레이어가 「방송 감청」을 누를 때만 만들고(게임 명령 없음, 저장된 관측 정보만 씀), 한 문명당 게임 1달에 한 번.
// 틀 문장이 기본이고, 보고서와 같은 「AI가 쓰기」를 켜면 LLM 이 방송 대본을 쓴다. 앱: src/features/preftl-app.ts. 화면: ui/office-preftl.js.
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';
import { type Civ, RADIO_AGE, AGES, AWARE, SITUATION, ageEn } from './preftl';
import { monthsBetween } from './letters';

export interface Broadcast { date: string; title: string; body: string; llm: boolean; age: number; lv: number }
export const BROADCAST_GAP_MONTHS = 1;
export const BROADCAST_KEEP = 12;
export const BROADCAST_MAX_TOKENS = 700;

/** 감청할 수 있나: 무선 시대 + 우리 관측소 + 아직 원시문명. */
export function canIntercept(c: Civ): boolean { return !c.gone && c.age >= RADIO_AGE && c.obs === 1; }
/** 같은 문명은 게임 1달에 한 번. 남은 이유(화면 문구) 또는 ''. */
export function interceptBlock(c: Civ, last: Broadcast | undefined, date: string): string {
  if (c.gone) return L('더는 원시문명이 아닙니다.', 'They are no longer a pre-FTL civilization.');
  if (c.age < RADIO_AGE) return L(`무선 통신은 ${L(AGES[RADIO_AGE - 1].ko, AGES[RADIO_AGE - 1].en)}부터 씁니다.`, `They will not use radio until the ${AGES[RADIO_AGE - 1].en}.`);
  if (c.obs !== 1) return L('우리 관측소가 있어야 방송을 잡을 수 있습니다.', 'We need our own observation post to pick up their broadcasts.');
  if (last && monthsBetween(last.date, date) < BROADCAST_GAP_MONTHS) return L('이번 달 방송은 이미 들었습니다.', 'We have already listened in this month.');
  return '';
}

/** 시대별 매체. */
export function medium(age: number): { ko: string; en: string; desc: string } {
  if (age >= 10) return { ko: '위성 방송', en: 'Satellite broadcast', desc: 'satellite television relayed around the planet' };
  if (age >= 9) return { ko: 'TV', en: 'Television', desc: 'early black-and-white or colour television' };
  if (age >= 8) return { ko: '라디오', en: 'Radio', desc: 'mature radio networks with news, dramas and advertisements' };
  return { ko: '라디오', en: 'Radio', desc: 'crackling early radio, mostly news bulletins and speeches' };
}
type T2 = [string, string];
const pick = <T>(a: readonly T[], rng: () => number): T => a[Math.floor(rng() * a.length) % a.length];
const fill = (s: string, c: Civ) => s.replace(/\{name\}/g, c.name).replace(/\{planet\}/g, c.planet || c.name).replace(/\{species\}/g, c.species || c.name);

const PROGRAMS: Record<string, T2[]> = {
  radio: [['저녁 뉴스', 'Evening News'], ['정부 담화', 'Government Address'], ['주간 시사 대담', 'Weekly Current Affairs'], ['농업 소식', 'Farm Report']],
  radio2: [['연속 라디오극', 'Radio Serial'], ['저녁 뉴스', 'Evening News'], ['광고 시간', 'Commercial Break'], ['과학 교양', 'Science Hour']],
  tv: [['9시 뉴스', 'Nine O\'Clock News'], ['국가 선전 영상', 'State Newsreel'], ['인기 퀴즈쇼', 'Popular Quiz Show'], ['특집 다큐멘터리', 'Special Documentary']],
  sat: [['우주 계획 생중계', 'Space Programme Live'], ['전 지구 뉴스', 'Global News'], ['위성 토론회', 'Satellite Debate'], ['과학 특집', 'Science Special']],
};
const OPEN: T2[] = [
  ['「{planet}의 여러분, 안녕하십니까. 오늘의 소식입니다.」', '"Good evening, people of {planet}. Here is today\'s news."'],
  ['「지금부터 {name} 공영 방송을 보내 드립니다.」', '"This is the {name} public broadcast."'],
  ['잡음 사이로 진행자의 목소리가 또렷해진다.', 'Through the static, a presenter\'s voice comes into focus.'],
];
const TOPIC: Record<number, T2[]> = {
  7: [['「새 공장 지대가 완공되어 일자리 수천 개가 생겼습니다.」', '"The new factory district is complete, bringing thousands of jobs."'], ['「철도가 수도와 남부 항구를 처음으로 이었습니다.」', '"For the first time, the railway links the capital with the southern ports."'], ['「노동자 단체가 내일 총파업을 예고했습니다.」', '"Workers\' unions have announced a general strike for tomorrow."']],
  8: [['「자동 기계가 들어온 공장에서 생산량이 두 배가 되었습니다.」', '"Output has doubled in the factories that installed automatic machines."'], ['「국경 지대의 긴장이 높아지고 있습니다. 군은 동원령을 검토 중입니다.」', '"Tension is rising on the border. The army is considering mobilisation."'], ['「오늘 밤 방송될 연속극 마지막 회, 놓치지 마십시오!」', '"Don\'t miss tonight\'s final episode of the serial!"']],
  9: [['「새 원자로가 수도의 전기를 모두 맡게 되었습니다.」', '"The new reactor now powers the entire capital."'], ['「적대국의 핵실험 소식에 시민들은 방공호 훈련에 나섰습니다.」', '"After news of a rival\'s nuclear test, citizens took part in shelter drills."'], ['「첫 인공위성 발사가 내년으로 예정되어 있습니다.」', '"The first artificial satellite is scheduled to launch next year."']],
  10: [['「유인 우주선이 궤도를 세 바퀴 돌고 무사히 돌아왔습니다.」', '"The crewed capsule completed three orbits and returned safely."'], ['「위성 통신망이 완성되어 지구 반대편과 실시간으로 이어졌습니다.」', '"The satellite network is complete; the far side of the world is now live on air."'], ['「달 탐사 계획에 국가 예산의 3분의 1이 들어갑니다.」', '"A third of the national budget will go to the lunar programme."']],
};
const SKY: T2[][] = [
  [['「내일은 맑겠습니다. 밤하늘의 별이 잘 보이겠습니다.」', '"Clear skies tomorrow; the stars will be easy to see."'], ['일기 예보가 이어진다. 하늘 이야기는 날씨뿐이다.', 'The weather forecast follows. The only talk of the sky is the weather.']],
  [['「어젯밤 북쪽 하늘에서 움직이는 빛을 봤다는 제보가 있었습니다. 기상 관측소는 유성이라고 밝혔습니다.」', '"Listeners reported a moving light in the northern sky last night. The weather office says it was a meteor."'], ['진행자가 웃으며 덧붙인다. 「하늘의 불빛을 본 분이 또 계시네요. 다들 너무 피곤하신가 봅니다.」', 'The presenter adds with a laugh: "Another caller who saw lights in the sky. Everyone must be tired."']],
  [['「하늘의 방문자를 믿는 시민 모임이 오늘 수도에서 집회를 열었습니다.」', '"A citizens\' group that believes in visitors from the sky held a rally in the capital today."'], ['패널 한 명이 말한다. 「정부는 무언가를 숨기고 있어요. 그 빛은 자연 현상이 아닙니다.」', 'A panellist says: "The government is hiding something. Those lights are not natural."']],
  [['「국방부는 오늘, 궤도 위에서 정체를 알 수 없는 물체를 추적하고 있다고 처음으로 인정했습니다.」', '"Today the defence ministry admitted for the first time that it is tracking an unidentified object in orbit."'], ['「과학자들은 그 물체가 우리를 관찰하고 있을 가능성을 진지하게 검토하고 있습니다.」', '"Scientists are seriously considering that the object may be watching us."']],
  [['「하늘 위의 이웃이여, 이 방송이 들린다면 응답해 주십시오. 우리는 평화를 원합니다.」', '"Neighbours above our sky: if you can hear this broadcast, please answer. We come in peace."'], ['방송 끝에 같은 신호가 몇 번이고 되풀이된다. 우리를 향한 인사다.', 'At the end of the broadcast the same signal repeats again and again. It is a greeting meant for us.']],
];
const SIT: Record<number, T2> = {
  1: ['「역병 확산을 막기 위해 오늘부터 도시 간 이동이 금지됩니다.」', '"To stop the plague spreading, travel between cities is banned from today."'],
  2: ['「새 연산 기계가 스스로 판단을 내린다는 보고에 정부가 조사에 나섰습니다.」', '"The government has opened an inquiry after reports that the new computing machines are making their own decisions."'],
  3: ['「세계 통합 정부 수립 협상이 막바지에 이르렀습니다.」', '"Talks on founding a single world government are in their final stage."'],
};
const CLOSE: T2[] = [['신호가 흐려지며 음악이 흘러나온다.', 'The signal fades into music.'], ['「이상으로 방송을 마칩니다.」 그리고 잡음.', '"That concludes our broadcast." Then static.'], ['광고 음악이 시작되자 관측소 기술자가 녹음을 멈춘다.', 'An advertising jingle begins, and the post technician stops the recording.']];

/** 틀 문장 방송(화면 언어). */
export function templateBroadcast(c: Civ, date: string, rng: () => number = Math.random): Broadcast {
  const m = medium(c.age), progs = c.age >= 10 ? PROGRAMS.sat : c.age >= 9 ? PROGRAMS.tv : c.age >= 8 ? PROGRAMS.radio2 : PROGRAMS.radio;
  const p = pick(progs, rng), T = (x: T2) => fill(L(x[0], x[1]), c);
  const lines = [T(pick(OPEN, rng)), T(pick(TOPIC[Math.min(10, Math.max(7, c.age))], rng))];
  if (c.sit && SIT[c.sit]) lines.push(T(SIT[c.sit]));
  lines.push(T(pick(SKY[Math.min(4, Math.max(0, c.lv))], rng)), T(pick(CLOSE, rng)));
  if (c.hive) lines.unshift(L('(군체 문명이라 방송은 하나의 목소리로 이어진다. 개인의 이름은 나오지 않는다.)', '(A hive civilization: the broadcast speaks with one voice. No individual names are heard.)'));
  return { date, llm: false, age: c.age, lv: c.lv, title: `[${L(m.ko, m.en)}] ${L(p[0], p[1])}`, body: lines.join('\n') };
}

/** LLM 방송 대본 요청(영어 지시, 답은 화면 언어 — aiclient 가 언어 지시를 붙인다). */
export function broadcastMessages(c: Civ, date: string, recent: Broadcast[]): ChatMessage[] {
  const m = medium(c.age);
  const facts = [
    `Civilization: ${c.name}${c.species ? `, species ${c.species}` : ''}${c.planet ? `, homeworld ${c.planet}` : ''}${c.hive ? ' (a hive mind: one collective voice, no individual names)' : ''}.`,
    `Stage: ${ageEn(c.age)}. Medium: ${m.desc}.`,
    `Their awareness of alien observers: ${AWARE[c.lv]?.en ?? '?'} — ${AWARE[c.lv]?.desc ?? ''}.`,
    ...(c.sit && SITUATION[c.sit] ? [`Ongoing crisis on their world: ${SITUATION[c.sit].en}.`] : []),
    ...(recent.length ? ['Earlier intercepts (do not repeat them): ' + recent.slice(-3).map((b) => b.title).join('; ') + '.'] : []),
  ];
  return [
    { role: 'system', content: [
      'You write short excerpts of broadcasts intercepted by a star empire\'s secret observation post orbiting a primitive (pre-FTL) world in Stellaris. Date of interception: ' + date + '.',
      'Output: first line "[Medium] Programme name", then the transcript excerpt (70-140 words): presenters, guests, announcements, maybe an advert, as they would really sound on their world. Plain text, no markdown.',
      'How much the broadcast mentions the sky or visitors must match their awareness exactly: None = nothing at all; Low = odd lights explained away; Medium = popular rumours and debate; High = officials admitting something is up there; Full = messages addressed to the watchers.',
      'Never let them know facts about us they could not know. Invent local names and details that fit their stage. No narration outside the broadcast except at most one short bracketed sound cue.',
    ].join('\n') },
    { role: 'user', content: facts.join('\n') },
  ];
}
/** LLM 답 → 방송(첫 줄 제목). 비면 null. */
export function parseBroadcast(raw: string, c: Civ, date: string, fallbackTitle: string): Broadcast | null {
  const t = String(raw ?? '').replace(/\r/g, '').replace(/^```[a-z]*\n?|```$/g, '').replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim();
  if (t.length < 40) return null;
  const lines = t.split('\n'), first = lines[0].trim(), ok = first.length > 0 && first.length <= 80;
  const body = (ok ? lines.slice(1) : lines).join('\n').trim().slice(0, 2000);
  return body ? { date, llm: true, age: c.age, lv: c.lv, title: (ok ? first : fallbackTitle).slice(0, 80), body } : null;
}
/** 비서가 알 수 있는 사실(영어). */
export function broadcastFact(name: string, b: Broadcast): string { return `Latest intercepted broadcast from ${name} (${b.date}): ${b.title}.`; }
