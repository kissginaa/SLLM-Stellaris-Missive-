// 성향별 특별한 곳(랜드마크, 2026-10-30, 계획서 10번 외출). 순수 자료·규칙·프롬프트(electron 없이 selftest).
// 제국 성향마다 다른 곳 8개(outing.ts SPECIAL_PLACES 와 같은 키). 할 수 있는 일 셋:
//   ① 의식(AI 없음): 그곳의 행사에 참석 — 정해진 장면 글. 해마다 한 번 민심 +1(잠깐, mood-app moodNudge).
//   ② 대화: 그곳의 인물(대사제·교관·…)과 이야기(물을 때만 AI 한 번).
//   ③ 공개 연설·문답: 군중 앞에서 한마디(AI 한 번: 군중 반응 + 점수 −2~+3) → 해마다 한 번 민심에 그 점수(잠깐, 1년에 걸쳐 사라짐).
// 그림: assets/outing/<성향>-landmark.webp(외출 그림) · 인물 landmark/figures/<성향> (13_랜드마크_그림_의뢰서.md). 없으면 앱이 그린 장면.

export type EthicKey = 'spiritualist' | 'militarist' | 'pacifist' | 'authoritarian' | 'egalitarian' | 'xenophile' | 'xenophobe' | 'materialist';
type Pair = [string, string];
export interface Landmark {
  key: EthicKey; color: string; color2: string;
  ritual: { ko: string; en: string; sceneKo: string; sceneEn: string };
  figure: { ko: string; en: string; promptEn: string; greetKo: string; greetEn: string };
  address: { ko: string; en: string; promptKo: string; promptEn: string; crowdEn: string };
}
const LM = (key: EthicKey, color: string, color2: string, ritual: Landmark['ritual'], figure: Landmark['figure'], address: Landmark['address']): Landmark => ({ key, color, color2, ritual, figure, address });
export const LANDMARKS: Record<EthicKey, Landmark> = {
  spiritualist: LM('spiritualist', '#b98cff', '#ffd27a',
    { ko: '예배 참석', en: 'Attend the service', sceneKo: '성가가 둥근 천장에 울립니다. 수천 개의 촛불이 일렁이고, 신도들이 통치자를 알아보고 조용히 고개를 숙입니다. 잠시나마 마음이 가라앉습니다.', sceneEn: 'Hymns echo through the dome. Thousands of candles flicker; the faithful recognise you and bow their heads in silence. For a moment, your mind is still.' },
    { ko: '대사제', en: 'High Priest', promptEn: 'the High Priest of the Grand Cathedral, serene and wise, devoted to the faith, speaks in measured, gentle words with spiritual imagery', greetKo: '"통치자여, 이 성전에 오신 것을 환영합니다. 무엇이 당신의 마음을 무겁게 합니까?"', greetEn: '"Ruler, welcome to this sanctuary. What weighs upon your heart?"' },
    { ko: '신도들에게 한마디', en: 'Address the faithful', promptKo: '예배가 끝나고 신도들이 통치자의 말을 기다립니다.', promptEn: 'After the service, the faithful wait for your words.', crowdEn: 'devout worshippers in the Grand Cathedral' }),
  militarist: LM('militarist', '#ff6a4a', '#c8d0dc',
    { ko: '생도 사열', en: 'Review the cadets', sceneKo: '군악대의 북소리에 맞춰 생도들이 한 치 흐트러짐 없이 행진합니다. 통치자가 지나가자 경례 소리가 연병장을 가릅니다.', sceneEn: 'Cadets march in perfect step to the drums. As you pass, the crack of their salute splits the parade ground.' },
    { ko: '수석 교관', en: 'Chief Instructor', promptEn: 'the Chief Instructor of the Imperial Military Academy, a scarred veteran, blunt, disciplined, proud of the cadets, speaks in short military phrases', greetKo: '"각하! 생도들이 오늘을 기다렸습니다. 말씀하십시오."', greetEn: '"Excellency! The cadets have waited for this day. Speak, sir."' },
    { ko: '졸업식 축사', en: 'Graduation address', promptKo: '연병장에 졸업 생도들이 정렬해 통치자의 축사를 기다립니다.', promptEn: 'Graduating cadets stand in formation, awaiting your address.', crowdEn: 'graduating military cadets and their officers' }),
  pacifist: LM('pacifist', '#8fd8ff', '#ffffff',
    { ko: '추모비 헌화', en: 'Lay flowers at the memorial', sceneKo: '하얀 추모비 앞에 꽃을 내려놓습니다. 분수 소리와 새소리만 들립니다. 지나가던 시민들이 하나둘 멈춰 함께 묵념합니다.', sceneEn: 'You lay flowers before the white memorial. Only fountains and birdsong. Passers-by stop one by one to bow their heads with you.' },
    { ko: '평화 운동가', en: 'Peace activist', promptEn: 'a respected elderly peace activist who lost family in a past war, warm but unafraid to question power, speaks plainly about the cost of violence', greetKo: '"오셨군요. 이 광장에 서면, 우리가 무엇을 지키려 하는지 잊지 않게 되지요."', greetEn: '"You came. Standing in this square, we never forget what we are trying to protect."' },
    { ko: '평화 집회 연설', en: 'Speak at the peace rally', promptKo: '광장의 평화 집회. 시민들이 통치자의 말을 듣기 위해 모였습니다.', promptEn: 'A peace rally in the plaza. Citizens gather to hear you.', crowdEn: 'citizens at a peace rally, idealistic and wary of militarism' }),
  authoritarian: LM('authoritarian', '#ff3a4a', '#ffd27a',
    { ko: '근위대 사열', en: 'Review the guard', sceneKo: '진홍빛 깃발 아래 근위대가 창을 세웁니다. 장화 소리가 일제히 멈추고, 광장 전체가 통치자 한 사람을 향합니다.', sceneEn: 'Beneath crimson banners the guard raises its spears. Boots halt in unison, and the whole square turns toward you alone.' },
    { ko: '근위대장', en: 'Captain of the Guard', promptEn: 'the Captain of the Imperial Guard, utterly loyal, formal, speaks with deference and talks about order and the security of the realm', greetKo: '"폐하. 광장은 완벽히 통제되어 있습니다. 분부만 내리십시오."', greetEn: '"Your Majesty. The square is fully secured. Command me."' },
    { ko: '발코니 연설', en: 'Balcony speech', promptKo: '개선 광장을 가득 메운 군중이 발코니를 올려다봅니다.', promptEn: 'The crowd filling the Triumphal Square looks up at the balcony.', crowdEn: 'a vast orderly crowd in the Triumphal Square, expecting strength and grandeur' }),
  egalitarian: LM('egalitarian', '#7be0a0', '#ffd27a',
    { ko: '시민 회관 둘러보기', en: 'Walk the Citizens\' Hall', sceneKo: '시민 의회의 둥근 객석을 둘러봅니다. 누구나 앉을 수 있는 자리마다 손때가 묻어 있습니다. 아이들이 통치자에게 손을 흔듭니다.', sceneEn: 'You walk the round benches of the citizens\' assembly. Every seat, open to anyone, is worn by use. Children wave at you.' },
    { ko: '시민 대표', en: 'Citizens\' delegate', promptEn: 'an elected citizens\' delegate, direct, practical, unimpressed by titles, presses the ruler on everyday issues', greetKo: '"오, 통치자님. 직접 오셨네요. 다들 묻고 싶은 게 많아요."', greetEn: '"Oh, Ruler — you came in person. Everyone has a lot to ask."' },
    { ko: '타운홀 미팅', en: 'Town hall meeting', promptKo: '시민들이 손을 들고 질문합니다. "솔직히 말씀해 주세요. 요즘 나라 사정이 어떻습니까?"', promptEn: 'Citizens raise their hands. "Tell us honestly — how is the realm doing?"', crowdEn: 'ordinary citizens at an open town hall, expecting honesty and accountability' }),
  xenophile: LM('xenophile', '#ff8fd8', '#7fd8ff',
    { ko: '문화 축제 관람', en: 'Visit the culture festival', sceneKo: '열두 종족의 음악이 한꺼번에 울립니다. 낯선 향신료 냄새, 이해할 수 없는 웃음소리. 외계 아이가 통치자에게 빛나는 꽃을 건넵니다.', sceneEn: 'The music of twelve species plays at once. Strange spices, laughter you cannot parse. An alien child hands you a glowing flower.' },
    { ko: '문화 교류관장', en: 'Director of the Exchange', promptEn: 'the Director of the Galactic Cultural Exchange, a curious and cheerful alien scholar, loves comparing cultures and gently corrects misconceptions', greetKo: '"환영합니다! 오늘은 세 종족의 사절이 와 있어요. 무엇이든 물어보세요."', greetEn: '"Welcome! Envoys of three species are here today. Ask me anything."' },
    { ko: '외국 손님 환영사', en: 'Welcome the foreign guests', promptKo: '여러 종족의 손님들이 통치자의 환영사를 기다립니다.', promptEn: 'Guests of many species await your words of welcome.', crowdEn: 'alien guests and diplomats of many species at a cultural festival' }),
  xenophobe: LM('xenophobe', '#8fa8c8', '#ff6a4a',
    { ko: '건국 기념 의식', en: 'Founding ceremony', sceneKo: '선조들의 이름이 새겨진 성벽 앞에 횃불이 켜집니다. 단 하나의 종족, 단 하나의 기억. 군중이 낮게 맹세를 읊습니다.', sceneEn: 'Torches are lit before walls carved with the names of the founders. One people, one memory. The crowd murmurs its oath.' },
    { ko: '기념관 관장', en: 'Curator of the Bastion', promptEn: 'the Curator of the Heritage Bastion, a fierce guardian of the people\'s history, suspicious of outsiders, proud and sentimental', greetKo: '"우리의 피와 역사를 지키는 곳에 오셨군요, 통치자님."', greetEn: '"You stand where our blood and history are kept, Ruler."' },
    { ko: '국경 방어선 연설', en: 'Speech at the border defenses', promptKo: '방어선의 병사들과 시민들이 통치자의 말을 기다립니다.', promptEn: 'Soldiers and citizens on the defensive line await your words.', crowdEn: 'soldiers and citizens at the fortified border, wary of outsiders' }),
  materialist: LM('materialist', '#33e6ff', '#c8f0ff',
    { ko: '연구 견학', en: 'Tour the labs', sceneKo: '입자 가속기가 낮게 웅웅거리고, 홀로그램 방정식이 공중에 떠 있습니다. 연구원들이 앞다투어 자기 실험을 설명합니다.', sceneEn: 'A particle accelerator hums; holographic equations float in the air. Researchers jostle to explain their experiments.' },
    { ko: '아카데미 원장', en: 'President of the Academy', promptEn: 'the President of the Academy of Sciences, brilliant, rational, a little impatient, excited about breakthroughs and frank about funding needs', greetKo: '"마침 잘 오셨습니다. 보여 드릴 게 있어요 — 아, 예산 얘기는 나중에."', greetEn: '"Perfect timing. There\'s something you must see — oh, the budget talk can wait."' },
    { ko: '신기술 시연회 축사', en: 'Address at the tech demo', promptKo: '신기술 시연회. 학자들과 기자들이 통치자의 말을 기다립니다.', promptEn: 'A new technology demonstration. Scholars and reporters await your words.', crowdEn: 'scientists, engineers and science reporters at a technology demonstration' }),
};
export const isEthicKey = (k: unknown): k is EthicKey => typeof k === 'string' && k in LANDMARKS;
export const SPEECH = { min: -2, max: 3, ritualMood: 1 } as const;
export const clampScore = (n: unknown): number => Math.max(SPEECH.min, Math.min(SPEECH.max, Math.round(Number(n) || 0)));
/** 해마다 한 번만(같은 랜드마크·같은 종류). */
export const yearOf = (d: string): number => Number(/^(\d+)\./.exec(d || '')?.[1] ?? NaN);

const langName = (ko: boolean) => (ko ? 'Korean' : 'English');
export function figureMessages(o: { key: EthicKey; place: string; ruler: string; empire: string; mood: string; wars: string[]; companion: string; lines: Array<{ who: 'me' | 'them'; text: string }>; text: string; ko: boolean }): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const lm = LANDMARKS[o.key];
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: [
    `You are ${lm.figure.promptEn}, at ${o.place} in the capital of ${o.empire || 'the empire'}. You are speaking in person with the empire's ruler ${o.ruler || ''} (the player)${o.companion ? `, who came with ${o.companion}` : ''}.`,
    o.mood || '', o.wars.length ? `The empire is at war: ${o.wars.join('; ')}.` : 'The empire is at peace.',
    'Stay in character. Be respectful to the ruler but have your own views. Do not invent game numbers or events. Reply in one to three sentences.',
    `Reply in ${langName(o.ko)}. Output only JSON: {"reply":"..."}`,
  ].filter(Boolean).join('\n') }];
  for (const l of o.lines.slice(-12)) msgs.push({ role: l.who === 'me' ? 'user' : 'assistant', content: l.text });
  msgs.push({ role: 'user', content: o.text });
  return msgs;
}
/** 공개 연설·문답: 군중 반응 + 점수(−2~+3). JSON {"reaction":"...","score":0} */
export function addressMessages(o: { key: EthicKey; place: string; ruler: string; empire: string; mood: string; wars: string[]; speech: string; ko: boolean }): Array<{ role: 'system' | 'user'; content: string }> {
  const lm = LANDMARKS[o.key];
  return [
    { role: 'system', content: [
      `You narrate how a crowd reacts to a short public address by the ruler of ${o.empire || 'a space empire'} at ${o.place}. The crowd: ${lm.address.crowdEn}.`,
      o.mood || '', o.wars.length ? `The empire is at war: ${o.wars.join('; ')}.` : 'The empire is at peace.',
      'Judge the speech by how well it fits this crowd\'s values and the current situation, its sincerity and its tone. A short or generic speech gets a lukewarm reaction; an insulting or tone-deaf one gets booed.',
      'Write the reaction as 2-3 vivid sentences of narration (cheers, murmurs, shouts from the crowd — you may quote one person). Then give "score": an integer from -2 (angry) to 3 (rapturous).',
      'Do not invent game numbers or events.',
      `Write in ${langName(o.ko)}. Output only JSON: {"reaction":"...","score":0}`,
    ].filter(Boolean).join('\n') },
    { role: 'user', content: `The ruler ${o.ruler || ''} says:\n"""${o.speech}"""` },
  ];
}
export const SCORE_WORD: Record<string, Pair> = { '-2': ['야유', 'Booed'], '-1': ['싸늘함', 'Cold'], '0': ['미지근함', 'Lukewarm'], '1': ['박수', 'Applause'], '2': ['환호', 'Cheers'], '3': ['열광', 'Rapture'] };
