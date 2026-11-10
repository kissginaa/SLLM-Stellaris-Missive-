// 통치자 본인의 연애(23·24·25·28, 2026-10-23 집 PC 초안)의 순수 규칙: 데이트 장소·결과·호감도·고백·청혼·관계 정리.
// 결혼식(규모·비용·1년 준비·50% 환불)은 wedding.ts. 관계 단계·호감은 relations.ts PairRelation(romance·affection) 한 곳에 둔다.
// 사용자 확정: 데이트 결과 5단계 방향(25) / 청혼은 교제 중 + 호감 90 이상(포함, 자동 수락 아님) / 유물전시관만 시설 조건, 나머지 장소는 처음부터(24) /
//   고백 거절이 호감을 자동으로 깎지 않고 자동 재고백 없음(23) / 관계는 통치자 개인 ID 에 귀속(후임 승계 없음) / 이별·이혼은 명시 확인 뒤(28).
// 미정이라 자리값(ROMANCE)으로 둔 것: 호감 증감 크기, 고백·청혼 수락 확률, 장소 수, 반복 감쇠, 재시도 대기. 호감 척도는 비서와 같은 0~100.
import { L } from './i18n-pick';
import { addYears, cmpDate } from './gamedate';
import type { Pid, PairRelation } from './relations';
import type { DateOutcome } from './wedding';
import { dateAffectionStep, canPropose } from './wedding';

export const ROMANCE = {
  /** 호감 증감(자리값). size → 값. 감소는 rude 한 가지. */
  step: { big: 15, mid: 10, small: 5, none: 0 }, rudeDrop: 5,
  /** 한 번의 데이트에서 들를 수 있는 장소 수·장소마다 대화 수(자리값). */
  spotsPerDate: 3, turnsPerSpot: 4,
  /** 고백(2026-10-24 사용자 확정): 데이트 의무 없음·호감 30 이상, 수락 확률 = 50% + (호감 − 30) × 0.5/70 → 30이면 50%, 100이면 100%. 거절 뒤 1년은 다시 고백하지 않는다. */
  confessMinAffection: 30, confessBase: 0.5, confessPerPoint: 0.5 / 70, retryYears: 1,
  /** 청혼 수락 확률(자리값) = 0.6 + (호감 − 90) × 0.04 → 90이면 60%, 100이면 100%. */
  proposeBase: 0.6, proposePerPoint: 0.04,
} as const;

export type SpotId = 'gate' | 'rides' | 'stalls' | 'garden' | 'wheel' | 'tower' | 'restaurant' | 'relics';
export const DATE_SPOTS: { id: SpotId; ko: string; en: string; sceneEn: string; locked?: 'relic_facility'; retired?: boolean }[] = [
  { id: 'gate', ko: '입구 광장', en: 'Entrance Plaza', sceneEn: 'the bright entrance plaza of a starport amusement park, crowds and banners' },
  { id: 'rides', retired: true, ko: '놀이기구 구역', en: 'Ride Zone', sceneEn: 'the ride zone, with gravity coasters roaring overhead' },
  { id: 'stalls', ko: '노점 거리', en: 'Food Stall Street', sceneEn: 'a street of food stalls from many worlds, smells of grilled snacks' },
  { id: 'garden', ko: '정원 산책로', en: 'Garden Walk', sceneEn: 'a quiet garden walk under artificial twilight' },
  { id: 'wheel', ko: '관람차', en: 'Ferris Wheel', sceneEn: 'a slow ferris wheel cabin rising above the station lights' },
  { id: 'tower', ko: '전망대', en: 'Observation Deck', sceneEn: 'an observation deck looking out over the stars and the capital' },
  { id: 'restaurant', ko: '식당', en: 'Restaurant', sceneEn: 'a restaurant table, the two of you seated across from each other' },
  { id: 'relics', ko: '유물전시관', en: 'Relic Gallery', sceneEn: 'a hushed gallery of ancient relics', locked: 'relic_facility' },
];
export const spotOf = (id: string) => DATE_SPOTS.find((s) => s.id === id) ?? null;

/** 데이트 한 번(사건 ID 기준 한 번만 반영). */
export interface DateEvent {
  id: string; ruler: Pid; partner: Pid; on: string;
  spots: { id: SpotId; moods: DateOutcome[]; talk: { who: 'ruler' | 'partner'; text: string }[] }[];
  state: 'open' | 'done' | 'cancelled'; result?: DateOutcome; delta?: number; applied?: boolean;
}
export const OUTCOME_ORDER: DateOutcome[] = ['rude', 'awkward', 'plain', 'fun', 'special'];
const OUTCOME_LABEL: Record<DateOutcome, [string, string]> = { special: ['특별히 마음이 통함', 'Truly connected'], fun: ['즐겁게 보냄', 'Had fun'], plain: ['무난하게 마침', 'Went fine'], awkward: ['어색하게 끝남', 'Ended awkwardly'], rude: ['무례하거나 불편했음', 'Rude or uncomfortable'] };
export const outcomeLabel = (o: DateOutcome) => L(OUTCOME_LABEL[o][0], OUTCOME_LABEL[o][1]);

/** 데이트 결과(합산 방식 — 25 미정 → 제안): 한 번이라도 무례가 있었으면 rude, 아니면 장소마다 마지막 분위기 중 가장 좋은 것. 대화가 없으면 plain. */
export function dateResult(d: DateEvent): DateOutcome {
  const all = d.spots.flatMap((s) => s.moods); if (all.includes('rude')) return 'rude';
  const lasts = d.spots.map((s) => s.moods[s.moods.length - 1]).filter((x): x is DateOutcome => !!x);
  if (!lasts.length) return 'plain';
  return lasts.reduce((a, b) => (OUTCOME_ORDER.indexOf(b) > OUTCOME_ORDER.indexOf(a) ? b : a));
}
/** 반복 감쇠: 이번 데이트 장소가 모두 전에 같은 상대와 가 본 곳이면 감쇠(25: 같은 장소 반복). */
export function repeatsOf(past: DateEvent[], d: DateEvent): number {
  const been = new Set(past.filter((x) => x.id !== d.id && x.partner === d.partner && x.state === 'done').flatMap((x) => x.spots.map((s) => s.id)));
  return d.spots.length && d.spots.every((s) => been.has(s.id)) ? 1 : 0;
}
export function affectionDelta(o: DateOutcome, repeats: number): number {
  const st = dateAffectionStep(o, repeats);
  return st.dir < 0 ? -ROMANCE.rudeDrop : st.dir === 0 ? 0 : ROMANCE.step[st.size];
}
/** 데이트 마치기: 결과를 한 번만 관계 호감에 반영(0~100). 호감이 없던 관계는 첫 데이트에서 0부터 시작. */
export function finishDate(d: DateEvent, r: PairRelation, past: DateEvent[]): { result: DateOutcome; delta: number; affection: number } | null {
  if (d.state !== 'open' || d.applied) return null;
  const result = dateResult(d), delta = affectionDelta(result, repeatsOf(past, d));
  r.affection = Math.max(0, Math.min(100, (r.affection ?? 0) + delta));
  if (!r.evidence.includes(`date:${d.id}`)) r.evidence.push(`date:${d.id}`);
  r.revision++; d.state = 'done'; d.result = result; d.delta = delta; d.applied = true;
  return { result, delta, affection: r.affection };
}

/** AI 데이트 응답(JSON) 읽기. mood 는 후보일 뿐 — 앱이 허용 범위로 받는다. 읽지 못하면 null(대사를 지어내지 않는다). */
export function parseDateReply(raw: string): { say: string; mood: DateOutcome } | null {
  const clean = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let o: unknown; try { o = JSON.parse(clean); } catch { const m = /\{[\s\S]*\}/.exec(clean); if (!m) return null; try { o = JSON.parse(m[0]); } catch { return null; } }
  const say = String((o as { say?: unknown })?.say ?? '').trim().slice(0, 900), mood = (o as { mood?: unknown })?.mood;
  if (!say || !OUTCOME_ORDER.includes(mood as DateOutcome)) return null;
  return { say, mood: mood as DateOutcome };
}
/** 데이트 장면 프롬프트(영어 지시, 응답 언어는 aiclient). 상대 한 사람만 연기한다. 결과 후보만 내고 확정은 앱. */
export function dateMessages(a: { empire: string; ruler: string; date: string }, p: { name: string; cls: string; traits: string[]; persona?: string; stage: string; affection?: number; memories: string[]; /** 지도자가 아닌 상대(비서 등)의 정체 한 줄(영어). 없으면 지도자 문장. */ who?: string; /** 통치자의 다른 연인·배우자(일부다처, 이 사람이 알 수 있는 공개된 관계만) — 예: 'Ara (spouse)'. */ others?: string[] }, spot: SpotId, talk: { who: 'ruler' | 'partner'; text: string }[], said: string): { role: 'system' | 'user'; content: string }[] {
  const s = spotOf(spot)!;
  return [{ role: 'system', content: [
    `You are ${p.who ?? `${p.name}, a ${p.cls} leader of the Stellaris empire "${a.empire || 'our empire'}"`}, on a date with the ruler ${a.ruler || ''}. Date: ${a.date || 'unknown'}. Scene: ${s.sceneEn}.`,
    `Your relationship with the ruler: ${p.stage}${p.affection !== undefined ? ` (affection ${p.affection}/100)` : ''}.`,
    p.others?.length ? `The ruler also has other partners: ${p.others.slice(0, 6).join(', ')}. Multiple partners are accepted in this realm. You may let a small, light pang of jealousy show now and then (a pout, a teasing remark, wanting a bit more of the ruler's time) — never hostility, never coldness, and it does not change your feelings or the relationship. Do not judge a moment "awkward" or "rude" because of this alone.` : '',
    p.traits.length ? `Your traits: ${p.traits.slice(0, 4).join(', ')}.` : '', p.persona ? `Your manner: ${p.persona}` : '',
    p.memories.length ? `[Shared memories]\n${p.memories.slice(-4).map((m) => '- ' + m).join('\n')}` : '',
    talk.length ? `[This date so far]\n${talk.slice(-8).map((t) => `${t.who === 'ruler' ? a.ruler || 'Ruler' : p.name}: ${t.text.slice(0, 240)}`).join('\n')}` : '',
    'Reply in character with 1-3 sentences (a short action in asterisks is fine). React honestly: you may disagree, tease or be shy. Never write the ruler\'s lines. Do not invent game facts or numbers. Content limit: up to flutters, expressions of affection and holding hands.',
    'Then judge how this moment feels to you: "special" (truly connected), "fun", "plain", "awkward", or "rude" (only if the ruler was disrespectful or made you uncomfortable). Respectful disagreement can still be good.',
    'Output only JSON: {"say": "...", "mood": "special|fun|plain|awkward|rude"}',
  ].filter(Boolean).join('\n') }, { role: 'user', content: String(said ?? '').slice(0, 600) || '(You arrive at this spot together.)' }];
}

/** 고백(23·2026-10-24): 호감 30 이상·상대에게 다른 연인 없음·최근 1년 거절 없음. 데이트 횟수는 따지지 않는다.
 *  일부다처(2026-10-24 사용자 확정): 통치자에게 이미 연인·배우자가 있어도 고백할 수 있다(인원 제한 없음). 거절해도 호감은 그대로. */
export function canConfess(r: PairRelation, today: string, partnerTaken: boolean): { ok: boolean; reason?: string } {
  if (r.romance === 'dating' || r.romance === 'engaged' || r.romance === 'married') return { ok: false, reason: L('이미 교제 중입니다.', 'You are already together.') };
  if (partnerTaken) return { ok: false, reason: L('상대에게 이미 만나는 사람이 있습니다.', 'They are already seeing someone.') };
  if ((r.affection ?? -1) < ROMANCE.confessMinAffection) return { ok: false, reason: L('아직 마음이 충분히 가까워지지 않은 것 같습니다.', 'Their feelings do not seem close enough yet.') };
  const last = [...r.evidence].reverse().find((e) => e.startsWith('confess_no:'));
  if (last && cmpDate(today, addYears(last.slice(11), ROMANCE.retryYears)) < 0) return { ok: false, reason: L('얼마 전에 마음을 전했습니다. 시간을 두고 기다려 주세요.', 'You confessed not long ago. Give it time.') };
  return { ok: true };
}
/** 고백 수락 확률(0~1): 호감 30이면 50%, 100이면 100%. */
export const confessChance = (affection: number): number => Math.max(0, Math.min(1, ROMANCE.confessBase + (affection - ROMANCE.confessMinAffection) * ROMANCE.confessPerPoint));
export function confess(r: PairRelation, today: string, rng: () => number): boolean {
  const p = r.affection === undefined ? 0 : confessChance(r.affection);
  if (rng() < p) { r.romance = 'dating'; r.datingSince = today; r.visibility = 'parties'; r.revision++; return true; }
  r.evidence.push(`confess_no:${today}`); r.revision++; return false;
}
/** 청혼(25): canPropose(교제 + 호감 90) 뒤 수락 판정. 거절 뒤 1년 대기. 수락하면 약혼(예식 레코드는 wedding.ts newWedding). */
export function canProposeNow(r: PairRelation, today: string): { ok: boolean; reason?: string } {
  const c = canPropose({ romance: r.romance, affection: r.affection }); if (!c.ok) return c;
  const last = [...r.evidence].reverse().find((e) => e.startsWith('propose_no:'));
  if (last && cmpDate(today, addYears(last.slice(11), ROMANCE.retryYears)) < 0) return { ok: false, reason: L('얼마 전에 청혼했습니다. 시간을 두고 기다려 주세요.', 'You proposed not long ago. Give it time.') };
  return { ok: true };
}
export function propose(r: PairRelation, today: string, rng: () => number): boolean {
  const p = Math.max(0, Math.min(1, ROMANCE.proposeBase + ((r.affection ?? 0) - 90) * ROMANCE.proposePerPoint));
  if (rng() < p) { r.romance = 'engaged'; r.engagedOn = today; r.revision++; return true; }
  r.evidence.push(`propose_no:${today}`); r.revision++; return false;
}
