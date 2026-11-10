// 뒷골목 선술집 — 변장 잠행(2026-10-30 사용자 결정, 계획서 10번). 순수 자료·규칙(electron 없이 selftest).
// 분위기: 사이버펑크 뒷골목의 허름한 술집(네온·비·낡은 크롬, 사용자 결정). 배경 1장.
// 혼자만(동행이 있으면 눈에 띔). 들어가기 전에 변장 고르기 → 손님 테이블 4개를 엿듣기(들어갈 때 LLM 한 번으로 네 테이블 수다를 한꺼번에, 같은 날은 다시 부르지 않음 — 실패하면 틀 문장).
// 한 잔 돌리기(금고에서 조금) → 속 이야기 + 의심 조금 내림. 합석해서 말 걸기(물을 때만 LLM, 상대는 통치자인 줄 모름).
// 의심 게이지가 차면 정체 탄로 → 궁으로 돌아감, 기록만 남김(사용자 결정: 게임·민심 효과 없음 — 나중에 파파라치와 이음).
// 그림: 11_선술집_그림_의뢰서.md → ui/tavern/(bg · bartender · tables/<key> · disguise/<id>). 없으면 앱이 그린 모양.

export type DisguiseId = 'merchant' | 'dockworker' | 'veteran';
export type TableKey = 'workers' | 'traders' | 'students' | 'families';
export type MoodBand = 'good' | 'mid' | 'bad';

export const DISGUISES: Array<{ id: DisguiseId; ko: string; en: string; aboutKo: string; aboutEn: string; risk: number; fits: TableKey; promptEn: string }> = [
  { id: 'merchant', ko: '떠돌이 상인', en: 'Travelling merchant', aboutKo: '무난한 변장. 장사꾼 테이블과 말이 잘 통합니다.', aboutEn: 'A safe disguise. Gets along with the traders\' table.', risk: 1, fits: 'traders', promptEn: 'a travelling merchant in a worn long coat' },
  { id: 'dockworker', ko: '부두 노동자', en: 'Dockworker', aboutKo: '가장 눈에 안 띕니다. 다만 고상한 말투를 쓰면 금방 의심을 삽니다.', aboutEn: 'The least noticeable. But speak too grandly and suspicion rises fast.', risk: 0.8, fits: 'workers', promptEn: 'a tired spaceport dockworker in a grease-stained jacket' },
  { id: 'veteran', ko: '퇴역 군인', en: 'Retired soldier', aboutKo: '군인 가족 테이블이 마음을 엽니다. 군 출신 손님이 얼굴을 알아볼 위험이 조금 있습니다.', aboutEn: 'The soldiers\' families open up. Ex-military patrons might recognise your face.', risk: 1.15, fits: 'families', promptEn: 'a retired soldier with an old service jacket and a cybernetic knee' },
];
export const disguiseOf = (id: string) => DISGUISES.find((d) => d.id === id);

export const TABLES: Array<{ key: TableKey; ko: string; en: string; whoKo: string; whoEn: string; promptEn: string }> = [
  { key: 'workers', ko: '노동자 테이블', en: 'Workers\' table', whoKo: '야간 교대를 마친 공장·부두 노동자 셋', whoEn: 'Three factory and dock workers off the night shift', promptEn: 'three factory and dock workers just off the night shift, blunt and tired' },
  { key: 'traders', ko: '장사꾼 테이블', en: 'Traders\' table', whoKo: '노점상과 밀수 냄새 나는 중개인', whoEn: 'A street vendor and a broker who smells of smuggling', promptEn: 'a street-food vendor and a shady goods broker, always talking prices and deals' },
  { key: 'students', ko: '학생 테이블', en: 'Students\' table', whoKo: '정치 이야기에 열을 올리는 대학생 무리', whoEn: 'University students arguing about politics', promptEn: 'a group of university students, idealistic and loud about politics' },
  { key: 'families', ko: '군인 가족 테이블', en: 'Soldiers\' families\' table', whoKo: '전선에 가족을 보낸 사람들', whoEn: 'People with family at the front', promptEn: 'relatives of serving soldiers (a mother, an older brother), worried and proud' },
];
export const tableOf = (k: string) => TABLES.find((t) => t.key === k);

export const SUS = { max: 100, listen: 2, talk: 6, mismatch: 1.5, perFlag: 6, round: -10, roundCost: 30 } as const;
/** 말 한 번의 의심: 기본 × 변장 위험 × (안 맞는 테이블이면 1.5) + LLM이 본 수상함(0~3) × 6. */
export function talkSuspicion(d: DisguiseId, table: TableKey, flag: number): number {
  const g = disguiseOf(d)!; const f = Math.max(0, Math.min(3, Math.round(Number(flag) || 0)));
  return Math.round(SUS.talk * g.risk * (g.fits === table ? 1 : SUS.mismatch) + f * SUS.perFlag);
}
export const clampSus = (n: number): number => Math.max(0, Math.min(SUS.max, Math.round(n)));
export const bandOf = (level: string | null | undefined): MoodBand => (level === 'jubilant' || level === 'content' ? 'good' : level === 'discontent' || level === 'unrest' ? 'bad' : 'mid');

/** 엿듣기 틀 문장(LLM이 꺼졌거나 실패할 때). [ko, en] */
type Pair = [string, string];
const T = (ko: string, en: string): Pair => [ko, en];
export const FALLBACK: Record<TableKey, Record<MoodBand | 'war' | 'deep', Pair[]>> = {
  workers: {
    good: [T('"요즘은 야근 수당이 제때 나오더라."', '"Overtime actually gets paid on time these days."'), T('"딸내미가 새 학교에 들어갔어. 살 만해."', '"My girl got into the new school. Life\'s alright."')],
    mid: [T('"월급은 그대로인데 합성 고기 값만 또 올랐어."', '"Wages stay put but synth-meat went up again."'), T('"뭐, 더 나빠지지만 않으면 됐지."', '"Well, as long as it doesn\'t get worse."')],
    bad: [T('"교대 시간을 또 늘렸대. 궁에 있는 양반들은 알기나 할까."', '"They lengthened the shifts again. Do the palace folk even know?"'), T('"다음 달엔 파업 얘기가 나올 거야, 두고 봐."', '"Mark my words, there\'ll be strike talk next month."')],
    war: [T('"공장이 전부 탄약 라인으로 바뀌었어. 손이 모자라."', '"Every line\'s making munitions now. We\'re short-handed."')],
    deep: [T('"솔직히… 통치자가 한 번이라도 여기 와서 우리 얘기를 들어 봤으면 좋겠어."', '"Honestly… I wish the ruler would come down here once and hear us out."')],
  },
  traders: {
    good: [T('"손님이 넘쳐. 이번 분기엔 노점을 하나 더 낼까 봐."', '"Customers everywhere. Might open a second stall this quarter."'), T('"세관이 요즘 덜 깐깐해. 좋은 징조지."', '"Customs are easing up lately. Good sign."')],
    mid: [T('"장사가 그럭저럭이야. 크게 남지도 망하지도 않고."', '"Business is so-so. Not booming, not dying."'), T('"수입 부품 값이 들쭉날쭉해서 원."', '"Imported parts prices are all over the place."')],
    bad: [T('"세금이 또 올랐어. 이러다 다들 뒷거래로 넘어간다."', '"Taxes up again. Everyone\'ll go under the table at this rate."'), T('"요즘은 현금 대신 물건으로 받아. 크레딧을 못 믿겠거든."', '"I take goods instead of cash now. Can\'t trust the credits."')],
    war: [T('"전쟁 나면 장사꾼만 돈 번다고? 보급선 막혀서 죽을 맛이야."', '"War makes traders rich? The supply lanes are choked, we\'re dying."')],
    deep: [T('"이건 비밀인데, 암시장 쪽 물건이 궁 창고에서 나온다는 소문이 있어."', '"Between us — rumour says some black-market goods come out of palace storerooms."')],
  },
  students: {
    good: [T('"이번 개혁안은 꽤 괜찮던데? 우리 의견이 좀 반영됐어."', '"The new reform\'s not bad, actually. Some of our ideas got in."'), T('"졸업하면 연구소에 들어갈 거야. 요즘 자리가 많대."', '"After graduation I\'m joining a lab. Lots of openings now."')],
    mid: [T('"정부는 늘 말뿐이야. 실제로 바뀌는 건 없잖아."', '"The government is all talk. Nothing really changes."'), T('"다음 집회 때 피켓 문구 뭘로 하지?"', '"What do we write on the placards for the next rally?"')],
    bad: [T('"검열이 심해졌어. 학보 기사가 또 내려갔대."', '"Censorship\'s worse. They pulled another campus paper article."'), T('"이대로면 거리로 나가는 수밖에 없어."', '"If this goes on, the streets are the only option."')],
    war: [T('"이 전쟁은 누구를 위한 거야? 징집 명단에 우리 과 선배 이름이 있었어."', '"Who is this war even for? A senior from our department was on the draft list."')],
    deep: [T('"사실 통치자가 직접 학생들이랑 토론하면 다들 놀랄걸. 의외로 들어 줄지도 모르잖아."', '"If the ruler debated students in person everyone\'d be shocked. Maybe they\'d actually listen."')],
  },
  families: {
    good: [T('"아들이 휴가 나왔어. 부대 밥이 좋아졌다더라."', '"My son\'s home on leave. Says the mess food got better."'), T('"요즘은 국경이 조용해서 다행이야."', '"Thank the stars the border\'s quiet lately."')],
    mid: [T('"편지가 한 달째 안 와. 별일 없겠지…"', '"No letter for a month. I\'m sure it\'s nothing…"'), T('"연금이 조금 늦게 나왔어. 늘 그렇지 뭐."', '"The pension came a bit late. As always."')],
    bad: [T('"부상병 연금이 깎였대. 나라를 지킨 대가가 이거야?"', '"They cut the wounded veterans\' pension. Is that the thanks for defending the realm?"'), T('"군 병원 줄이 끝이 안 보여."', '"The line at the military hospital never ends."')],
    war: [T('"전선 소식만 나오면 손이 떨려. 우리 애 부대 이름이 나올까 봐."', '"My hands shake at every front-line report. I\'m afraid to hear his unit\'s name."')],
    deep: [T('"통치자도 자식이 있다던데… 그럼 우리 마음을 조금은 알겠지."', '"They say the ruler has children too… then maybe they understand a little."')],
  },
};
/** 틀 문장으로 엿듣기(테이블마다 3줄 + 속 이야기 1줄). */
export function fallbackOverheard(band: MoodBand, atWar: boolean): Record<TableKey, { lines: Pair[]; deep: Pair[] }> {
  const out = {} as Record<TableKey, { lines: Pair[]; deep: Pair[] }>;
  for (const t of TABLES) { const f = FALLBACK[t.key]; out[t.key] = { lines: [...f[band], ...(atWar ? f.war : [f[band === 'good' ? 'mid' : band === 'bad' ? 'mid' : 'good'][0]])].slice(0, 3), deep: f.deep }; }
  return out;
}

export const BARTENDER = { ko: '잭스', en: 'Jax' };
export const BAR_LINES: Record<'greet' | 'noRumor' | 'round' | 'exposed' | 'banned' | 'leave', Pair> = {
  greet: T('크롬 팔 바텐더가 잔을 닦으며 고개를 까딱합니다. "뭘로 줄까, {who}? 여긴 질문 안 하는 집이야."', 'The chrome-armed bartender nods, polishing a glass. "What\'ll it be, {who}? We don\'t ask questions here."'),
  noRumor: T('"요즘은 조용해. 비만 오지."', '"Quiet lately. Just the rain."'),
  round: T('"{table}에 한 잔씩 돌렸어. 다들 표정이 풀리네."', '"A round for the {table}. Faces are loosening up."'),
  exposed: T('누군가 잔을 떨어뜨립니다. "어…? 저 얼굴… 통치자님?!" 술집이 순식간에 술렁이고, 경호원이 문을 박차고 들어옵니다.', 'Someone drops a glass. "Wait… that face… Your Excellency?!" The bar erupts, and your guards burst through the door.'),
  banned: T('오늘은 골목에 소문이 너무 돌았습니다. 경호실이 선술집 출입을 막았습니다(내일 다시).', 'Word has spread through the alleys today. Security won\'t let you back in (try tomorrow).'),
  leave: T('비 내리는 골목으로 조용히 빠져나와 궁으로 돌아갑니다.', 'You slip out into the rainy alley and head back to the palace.'),
};

const langName = (ko: boolean) => (ko ? 'Korean' : 'English');
/** 엿듣기(LLM 한 번): 네 테이블의 수다 각 3줄 + 한 잔 돌리면 나오는 속 이야기 각 1~2줄. JSON {"tables":{"workers":{"lines":[..],"deep":[..]},...}} */
export function overhearMessages(o: { date: string; mood: string; wars: string[]; recent: string[]; empire: string; ruler: string; ko: boolean }): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: [
      'You write overheard bar chatter for a Stellaris-like space empire game. The setting is a shabby cyberpunk back-alley bar in the capital: neon signs, rain on the window, cheap synth-liquor, old chrome.',
      'Four tables of ordinary citizens talk among themselves. They do NOT know the ruler is listening. Write natural, specific, slightly rough everyday talk that reflects how ordinary people feel about the current situation.',
      `Tables: ${TABLES.map((t) => `${t.key} = ${t.promptEn}`).join('; ')}.`,
      'For each table give "lines": exactly 3 short quoted lines (each one speaker, one or two sentences), and "deep": 1 or 2 more candid lines they only say after someone buys them a round.',
      'Ground everything in the given situation. Do not invent game numbers, battles or names that are not given. Opinions may be unfair, mixed, or grumbling — real people.',
      `Write in ${langName(o.ko)}. Output only JSON: {"tables":{"workers":{"lines":["..","..",".."],"deep":[".."]},"traders":{...},"students":{...},"families":{...}}}`,
    ].join('\n') },
    { role: 'user', content: [
      `Date: ${o.date || 'unknown'}. Empire: ${o.empire || 'the empire'}. Ruler: ${o.ruler || 'the ruler'}.`,
      o.mood || 'Public mood: unknown.',
      o.wars.length ? `Wars now: ${o.wars.join('; ')}.` : 'The empire is at peace.',
      o.recent.length ? `Recent news people may have heard: ${o.recent.join(' | ')}` : '',
    ].filter(Boolean).join('\n') },
  ];
}
/** LLM 답 정리: 테이블마다 문자열 배열만, 길이 제한. 모자라면 null(틀 문장으로). */
export function cleanOverheard(j: unknown): Record<TableKey, { lines: string[]; deep: string[] }> | null {
  const t = (j && typeof j === 'object' ? (j as { tables?: unknown }).tables : null) as Record<string, { lines?: unknown; deep?: unknown }> | null; if (!t || typeof t !== 'object') return null;
  const arr = (x: unknown, n: number) => (Array.isArray(x) ? x : []).map((s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)).filter(Boolean).slice(0, n);
  const out = {} as Record<TableKey, { lines: string[]; deep: string[] }>;
  for (const k of TABLES) { const v = t[k.key]; const lines = arr(v?.lines, 3), deep = arr(v?.deep, 2); if (lines.length < 2) return null; out[k.key] = { lines, deep: deep.length ? deep : [] }; }
  return out;
}
/** 합석 대화(물을 때만 LLM). 상대는 통치자를 모름. JSON {"reply":"...","suspicion":0-3} */
export function talkMessages(o: { table: TableKey; disguise: DisguiseId; heard: string[]; lines: Array<{ who: 'me' | 'them'; text: string }>; text: string; mood: string; wars: string[]; ko: boolean }): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const t = tableOf(o.table)!, d = disguiseOf(o.disguise)!;
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: [
    `You are ${t.promptEn}, drinking at a shabby cyberpunk back-alley bar in the empire's capital. Several of you may speak; prefix each speaker naturally if more than one talks.`,
    `A stranger who looks like ${d.promptEn} has joined your table. You have no idea this stranger is actually the empire's ruler in disguise.`,
    o.mood || '', o.wars.length ? `The empire is at war: ${o.wars.join('; ')}.` : 'The empire is at peace.',
    o.heard.length ? `Earlier at your table you were saying: ${o.heard.join(' / ')}` : '',
    'Talk like real, ordinary people: casual, sometimes rude or funny, honest about the government and the ruler (you think the ruler is not here). Do not invent game numbers or events. Reply in one to three sentences.',
    `Also judge how suspicious the stranger just sounded, 0-3: 0 = normal, 1 = a bit odd, 2 = talks like a noble or official, 3 = basically reveals being the ruler or knows palace secrets.`,
    `Reply in ${langName(o.ko)}. Output only JSON: {"reply":"...","suspicion":0}`,
  ].filter(Boolean).join('\n') }];
  for (const l of o.lines.slice(-12)) msgs.push({ role: l.who === 'me' ? 'user' : 'assistant', content: l.text });
  msgs.push({ role: 'user', content: o.text });
  return msgs;
}
