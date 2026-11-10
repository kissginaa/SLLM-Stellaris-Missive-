// AI 제국의 감정 기억 4종(알파 11, 2026-10-25, 群星AI mod 의 아이디어를 앱 쪽 규칙으로). 순수 규칙. 앱: src/features/emotions-app.ts.
// 원한·감사·두려움·야망을 「실제로 일어난 일」로만 쌓고 시간이 지나면 옅어진다. 대화 말투·먼저 오는 편지에 쓰고,
//   실제 게임 행동(위협·포위 심리·원조·도움 요청·선전포고)은 src/emotion-acts.ts(2026-10-25 사용자 결정 「다 넣어」). LLM 호출 없음.
// 재료: 통신 목록(3달마다, 모드 CONTACT 의 war·rv·pw) + 대화 결과(호감 변화 단계).
export type EmotionKey = 'grudge' | 'gratitude' | 'fear' | 'ambition';
export const EMOTIONS: readonly EmotionKey[] = ['grudge', 'gratitude', 'fear', 'ambition'];
export type Emotions = Record<EmotionKey, number>;
export interface EmotionEntry { e: Emotions; last?: string; hot: Partial<Record<EmotionKey, boolean>> }
export const EMO = { max: 100, decay: 0.9, notable: 20, hot: 40, cool: 30 } as const;
export const zero = (): Emotions => ({ grudge: 0, gratitude: 0, fear: 0, ambition: 0 });
const clamp = (n: number) => Math.max(0, Math.min(EMO.max, Math.round(n * 10) / 10));

/** 위기 연동(알파 11, 사용자 확정 2026-10-25): 위기 전선에서 싸우는 나라에 감사 +2, 위기 중에 우리와 전쟁하는 나라에 원한 +3(분기마다). */
export const EMO_CRISIS = { front: 2, betray: 3, pact: 3, pactBetray: 40 } as const; // pact·pactBetray: 공동 대응 협약(사용자 확정 2026-10-25)
/** 3달마다 한 번(통신 목록이 올 때): 옅어짐 → 지금 상황으로 쌓임. war 우리와 전쟁 중 · rival 경쟁자 · pw 1 상대 함대가 열세(두려움) 2 우세(야망) · front 위기 세력과 국경을 맞댐 · crisisOn 은하 위기 진행 중. */
export function quarterTick(en: EmotionEntry, s: { war: boolean; rival: boolean; pw: 0 | 1 | 2; front?: boolean; /** 공동 대응 협약 중(알파 11) */ pact?: boolean }, crisisOn = false): void {
  const e = en.e;
  for (const k of EMOTIONS) e[k] = clamp(e[k] * EMO.decay);
  // 옅어짐 10%와 맞물린 상한(더해지는 값 × 10): 전쟁만으로 원한 50(약 4년이면 「강함」), 평시 경쟁·열세·우세는 25(「눈에 띔」까지만).
  if (s.war) { e.grudge = clamp(e.grudge + 5); e.fear = clamp(e.fear + 1); }
  if (s.rival) e.grudge = clamp(e.grudge + 2.5);
  if (s.pw === 1) e.fear = clamp(e.fear + (s.war ? 4 : 2.5));
  if (s.pw === 2) e.ambition = clamp(e.ambition + (s.war ? 5 : 2.5));
  // 위기: 전선에서 싸우는 나라(우리와 전쟁 중이 아닐 때)는 상한 20(「눈에 띔」), 위기 중 침공은 전쟁 원한에 더해 상한 80.
  if (s.front && !s.war) e.gratitude = clamp(e.gratitude + EMO_CRISIS.front);
  if (s.war && crisisOn) e.grudge = clamp(e.grudge + EMO_CRISIS.betray);
  if (s.pact && !s.war) e.gratitude = clamp(e.gratitude + EMO_CRISIS.pact); // 공동 대응 협약: 함께 싸우는 동안(전선 감사와 합치면 상한 50)
}
/** 한 번에 더하기(공동 대응 협약 배신 원한 등). */
export function bump(en: EmotionEntry, k: EmotionKey, n: number): void { en.e[k] = clamp(en.e[k] + n); }
/** 대화 결과: 1 조금 따뜻 · 2 많이 따뜻 · 3 조금 차갑 · 4 많이 차갑(chat 의 mood 단계). */
export function talkOutcome(en: EmotionEntry, mood: number): void {
  const e = en.e;
  if (mood === 1) { e.gratitude = clamp(e.gratitude + 2); e.grudge = clamp(e.grudge - 1); }
  else if (mood === 2) { e.gratitude = clamp(e.gratitude + 6); e.grudge = clamp(e.grudge - 3); }
  else if (mood === 3) e.grudge = clamp(e.grudge + 2);
  else if (mood === 4) { e.grudge = clamp(e.grudge + 6); e.gratitude = clamp(e.gratitude - 3); }
}
/** 새로 「뜨거워진」 감정(처음 hot 을 넘은 것). 식으면(cool 아래) 다시 넘을 수 있게 표시를 지운다. */
export function newlyHot(en: EmotionEntry): EmotionKey[] {
  const out: EmotionKey[] = [];
  for (const k of EMOTIONS) { if (en.e[k] >= EMO.hot && !en.hot[k]) { en.hot[k] = true; out.push(k); } else if (en.e[k] < EMO.cool && en.hot[k]) delete en.hot[k]; }
  return out;
}
const WHY: Record<EmotionKey, [string, string]> = {
  grudge: ['a deep grudge against them for what they have done to you (war, hostility)', 'You hold a deep grudge'],
  gratitude: ['real gratitude toward them for their past kindness', 'You feel real gratitude'],
  fear: ['fear of them: their fleets outclass yours', 'You fear them'],
  ambition: ['ambition toward them: your fleets outclass theirs and you see opportunity', 'You feel ambitious toward them'],
};
// 게슈탈트식 읽기(알파 11, 2026-10-25): 수치는 같고 이름과 말만 바꾼다. 기계 = 계산값, 군체 = 본능.
const WHY_G: Record<1 | 2, Record<EmotionKey, string>> = {
  1: { grudge: 'an elevated threat priority assigned to them for what they have done to you (war, hostility)', gratitude: 'a high cooperation value computed from their past conduct', fear: 'a high risk assessment: their fleets outclass yours', ambition: 'an expansion opportunity: your fleets outclass theirs' },
  2: { grudge: 'a hostile instinct against them, stirred by what they have done to the hive (war, hostility)', gratitude: 'a symbiotic instinct toward them, born of their past kindness', fear: 'a wary instinct: their fleets outclass the swarm', ambition: 'a predatory instinct: your swarm outclasses them' },
};
/** 대화 system 프롬프트 한 줄(영어). 눈에 띄는 감정(≥20)만, 센 것부터. 없으면 빈 글. gest 1 기계·2 군체면 그 말로. */
export function emotionLine(e: Emotions | undefined, gest?: number): string {
  if (!e) return '';
  const ks = EMOTIONS.filter((k) => e[k] >= EMO.notable).sort((a, b) => e[b] - e[a]);
  if (!ks.length) return '';
  const lvl = (n: number) => (n >= 70 ? 'overwhelming' : n >= EMO.hot ? 'strong' : 'noticeable');
  if (gest === 1 || gest === 2) return `${gest === 1 ? 'Your standing assessments of them, computed from what actually happened' : 'The hive\'s lasting instincts toward them, shaped by what actually happened'}: ${ks.map((k) => `${lvl(e[k])} ${WHY_G[gest][k]}`).join('; ')}. Let these shape your stance naturally; do not list them${gest === 1 ? ' and do not call them feelings' : ''}.`;
  return `Your lasting feelings toward them, built from what actually happened: ${ks.map((k) => `${lvl(e[k])} ${WHY[k][0]}`).join('; ')}. Let these color your tone and choices naturally; do not list them.`;
}
/** 먼저 보내는 편지의 사유(영어, 기존 서신 기능 writeLetter 의 why). */
export function emotionLetterWhy(k: EmotionKey, gest?: number): string {
  if (gest === 1) return ({ grudge: 'Your threat priority for them has crossed the action threshold. Transmit a formal notice: a warning, a demand or a list of their violations.', gratitude: 'Your cooperation value for them has risen. Transmit a proposal for closer coordination.', fear: 'Your risk assessment of their power has crossed the threshold. Transmit a cautious query: seek assurances or probe their intentions.', ambition: 'Your models rate them as weaker. Transmit a confident message: test them or press a demand.' } as Record<EmotionKey, string>)[k];
  if (gest === 2) return ({ grudge: 'The hive\'s hostile instinct toward them can no longer stay silent. Send them a warning, a demand or a cold reproach, as one consciousness.', gratitude: 'The hive senses a growing symbiosis with them. Reach out warmly, as one consciousness, perhaps offering closer ties.', fear: 'The hive senses danger in their power. Reach out warily: seek reassurance or probe their intentions.', ambition: 'The hive senses weakness in them. Reach out as a predator would: test them or press a demand.' } as Record<EmotionKey, string>)[k];
  return ({ grudge: 'Your grudge against them has grown too strong to keep silent. Write to them about it: a warning, a demand or a bitter reproach, as fits your personality.', gratitude: 'Your gratitude toward them has grown. Write warmly, perhaps offering closer ties.', fear: 'You have come to fear their power. Write cautiously: seek reassurance, offer appeasement or quietly probe their intentions.', ambition: 'You see them as weaker than you. Write with confident ambition: test them, press a demand or hint at your strength.' } as Record<EmotionKey, string>)[k];
}
export function sanitizeEmotions(v: unknown): Record<string, EmotionEntry> {
  const out: Record<string, EmotionEntry> = {}; if (!v || typeof v !== 'object') return out;
  for (const [idx, x] of Object.entries(v as Record<string, any>)) {
    if (!/^\d{1,6}$/.test(idx) || !x || typeof x.e !== 'object') continue;
    const e = zero(); for (const k of EMOTIONS) { const n = Number(x.e[k]); e[k] = Number.isFinite(n) ? clamp(n) : 0; }
    const hot: Partial<Record<EmotionKey, boolean>> = {}; if (x.hot && typeof x.hot === 'object') for (const k of EMOTIONS) if (x.hot[k] === true) hot[k] = true;
    out[idx] = { e, hot, ...(typeof x.last === 'string' ? { last: x.last.slice(0, 12) } : {}) };
  }
  return out;
}
