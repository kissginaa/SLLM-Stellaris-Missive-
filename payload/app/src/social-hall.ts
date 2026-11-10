// 사교회 연회장(2026-10-23 사용자 요청: 「대화하기를 누르면 딸깍이 아니라 그 사람들과 실제로 대화를 나눈다」 · 29 문서 「모임 합류 → 실제 대화 요청 때만 LLM」).
// 앱: src/features/relations-app.ts(IPC·저장), 화면: ui/social-hall.html(AI 배경 그림 위 대화 모임). 이 파일은 순수 규칙만 둔다(시험: selftest-plans).
// - 손님을 연회장 자리(창가·음식 탁자·바·소파·발코니·피아노)별 작은 모임으로 나눈다. 행사 ID 로 고정 — 다시 열어도 같은 배치.
// - 통치자가 모임에 말을 걸면 그 모임 사람들만 답한다(여러 명이 서로 이어 말할 수 있음). 통치자 대사는 AI 가 쓰지 않는다.
// - 자리를 뜰 때 한 번만 분위기를 판정(warm/neutral/tense)하고, 결과(가까워짐·변화 없음·마찰)는 앱이 확률표로 정한다 — 같은 모임에 다시 가도 재판정하지 않는다.
import { createHash } from 'crypto';
import type { Pid } from './relations';
import type { ExchangeResult } from './social-event';
import { SOCIAL, exchangeTable } from './social-event';

export type HallSpot = 'window' | 'buffet' | 'bar' | 'lounge' | 'balcony' | 'piano';
/** 자리 순서 = 그림 주문서의 번호(1~6). 모임 수가 적으면 앞에서부터 쓴다. */
export const HALL_SPOTS: HallSpot[] = ['buffet', 'window', 'bar', 'lounge', 'piano', 'balcony'];
export const HALL = { groupSize: 3, maxPerGroup: 5, maxLines: 40, maxTurnChars: 400 } as const;
export type Mood = 'warm' | 'neutral' | 'tense';

/** 행사 ID 로 고정된 의사 난수(같은 행사 = 같은 배치). */
function seeded(seed: string): () => number {
  let h = createHash('sha256').update(seed).digest().readUInt32LE(0) || 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}
/** 손님을 모임으로 나눈다: 세 명 안팎, 자리 6곳까지. 넘치면 기존 모임에 한 명씩 더 앉히고(최대 5), 그래도 남으면 군중 속(모임 밖). */
export function hallGroups(eventId: string, guests: Pid[]): { spot: HallSpot; members: Pid[] }[] {
  const rng = seeded('hall:' + eventId), list = [...new Set(guests)].sort();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  if (!list.length) return [];
  const n = Math.max(1, Math.min(HALL_SPOTS.length, Math.round(list.length / HALL.groupSize)));
  const groups: Pid[][] = Array.from({ length: n }, () => []);
  list.forEach((p, i) => { const g = groups[i % n]; if (g.length < HALL.maxPerGroup) g.push(p); });
  return groups.filter((g) => g.length).map((members, i) => ({ spot: HALL_SPOTS[i], members }));
}

export interface HallLine { who: 'ruler' | Pid; name: string; text: string }
export interface HallMember { pid: Pid; name: string; cls: string; traits: string[]; persona?: string; withRuler: string; withOthers: string[] }
const SPOT_EN: Record<HallSpot, string> = { window: 'by the tall windows overlooking the capital', buffet: 'beside the buffet table', bar: 'at the bar counter', lounge: 'on the sofas in the lounge corner', balcony: 'out on the balcony', piano: 'near the piano' };
const QUALITY_EN = { normal: 'The hall is lavish: fine food, music and warm light.', poor: 'Food is short this year, so the hospitality is modest — thin platters and fewer lights. Guests notice but stay polite.' };

/** 모임 대화 프롬프트(영어 지시, 응답 언어는 aiclient 가 붙인다). 출력 = 「이름: 대사」 줄 1~3개. */
export function hallTalkMessages(a: { empire: string; ruler: string; date: string; quality: 'normal' | 'poor' }, spot: HallSpot, members: HallMember[], history: HallLine[], text: string, toName?: string): { role: 'system' | 'user'; content: string }[] {
  const sys = [
    `You voice the guests at the annual social gathering of the Stellaris empire "${a.empire || 'our empire'}". Date: ${a.date || 'unknown'}. ${QUALITY_EN[a.quality]}`,
    `A small circle of leaders is chatting ${SPOT_EN[spot]}. The ruler ${a.ruler || ''} has joined them. This is a relaxed party, not a council meeting — small talk, stories, jokes, opinions, gentle teasing are all natural.`,
    '[People in this circle]',
    ...members.map((m) => `- ${m.name} (${m.cls})${m.traits.length ? `; traits: ${m.traits.slice(0, 4).join(', ')}` : ''}${m.persona ? `; manner: ${m.persona}` : ''}; toward the ruler: ${m.withRuler}${m.withOthers.length ? `; with the others: ${m.withOthers.join(', ')}` : ''}`),
    toName ? `The ruler is speaking mainly to ${toName}; ${toName} answers first, others may chime in.` : 'The ruler is speaking to the whole circle; whoever fits best answers, others may chime in.',
    'Reply with 1-3 lines in total, each on its own line in the exact form "Name: what they say". Use only the names listed above. Each line 1-3 sentences. Guests may react to each other, not only to the ruler.',
    'Never write lines or actions for the ruler. Do not invent game facts, numbers or events. Nobody agrees to treaties, transfers or orders here — it is only conversation. Keep any romance at most a faint hint.',
  ].join('\n');
  const msgs: { role: 'system' | 'user'; content: string }[] = [{ role: 'system', content: sys }];
  const past = history.slice(-12).map((l) => `${l.who === 'ruler' ? `${a.ruler || 'The ruler'} (ruler)` : l.name}: ${l.text}`).join('\n');
  msgs.push({ role: 'user', content: `${past ? `[Conversation so far]\n${past}\n\n` : ''}[The ruler now says${toName ? ` to ${toName}` : ''}]\n${String(text ?? '').slice(0, HALL.maxTurnChars)}` });
  return msgs;
}
/** 「이름: 대사」 줄을 모임 사람에게 나눈다. 이름이 맞지 않는 줄은 앞 줄에 붙이고, 아무도 못 찾으면 상대(또는 첫 사람)의 말로 본다. 통치자 줄은 버린다. */
export function parseHallReply(raw: string, members: { pid: Pid; name: string }[], fallback?: Pid, ruler?: string): HallLine[] {
  const t = String(raw ?? '').replace(/\s*…\((잘림|cut off)\)\s*$/, '').trim(); if (!t) return [];
  const clean = (s: string) => s.replace(/^[\s*_"“]+|[\s*_"”]+$/g, '').trim();
  const find = (n: string) => { const k = clean(n).toLowerCase(); return members.find((m) => m.name.toLowerCase() === k) ?? members.find((m) => k && (m.name.toLowerCase().startsWith(k) || k.startsWith(m.name.toLowerCase()))); };
  const out: HallLine[] = []; let dropping = false;
  for (const line of t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^\**([^:：]{1,40}?)\**\s*[:：]\s*(.+)$/.exec(line), who = m ? find(m[1]) : undefined;
    if (who) { out.push({ who: who.pid, name: who.name, text: clean(m![2]) }); dropping = false; continue; }
    if (m && (/ruler|통치자/i.test(m[1]) || (!!ruler && clean(m[1]).toLowerCase() === ruler.trim().toLowerCase()))) { dropping = true; continue; } // AI 가 통치자 대사를 쓴 줄
    if (dropping) continue;
    if (out.length) out[out.length - 1].text += ' ' + clean(line);
    else { const f = members.find((x) => x.pid === fallback) ?? members[0]; if (f) out.push({ who: f.pid, name: f.name, text: clean(line) }); }
  }
  return out.filter((l) => l.text).slice(0, 3).map((l) => ({ ...l, text: l.text.slice(0, 700) }));
}

/** 자리를 뜰 때 분위기 판정 프롬프트(JSON). */
export function hallMoodMessages(ruler: string, members: { name: string }[], lines: HallLine[]): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    'You judge how a short party conversation went between a ruler and each guest. Judge only from what was actually said.',
    'For each guest give one of: "warm" (they enjoyed it, felt respected or connected), "neutral" (polite, nothing special) or "tense" (they were offended, argued, or felt slighted).',
    `Answer with JSON only: {"moods":{${members.map((m) => `"${m.name}":"warm|neutral|tense"`).join(',')}}}`,
  ].join('\n') }, { role: 'user', content: lines.slice(-30).map((l) => `${l.who === 'ruler' ? `${ruler || 'Ruler'} (ruler)` : l.name}: ${l.text}`).join('\n') }];
}
export function parseHallMoods(raw: string, members: { pid: Pid; name: string }[]): Record<Pid, Mood> {
  const out: Record<Pid, Mood> = {}; let j: unknown = null;
  try { const m = String(raw ?? '').match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
  const src = (j && typeof j === 'object' ? ((j as { moods?: unknown }).moods ?? j) : {}) as Record<string, unknown>;
  for (const mem of members) { const v = Object.entries(src).find(([k]) => k.trim().toLowerCase() === mem.name.toLowerCase())?.[1]; out[mem.pid] = v === 'warm' || v === 'tense' ? v : 'neutral'; }
  return out;
}
/** 분위기 → 결과 확률표. 보통은 기본표(60/30/10), 따뜻함은 마찰 없이 친분 쪽, 험악함은 마찰 쪽. 식량 부족 보정(친분 −10%p → 변화 없음)은 한 번만. */
export function moodTable(quality: 'normal' | 'poor', mood: Mood): { good: number; none: number; friction: number } {
  if (mood === 'neutral') return exchangeTable(quality);
  let t = mood === 'warm' ? { good: 85, none: 15, friction: 0 } : { good: 10, none: 40, friction: 50 };
  if (quality === 'poor') { const mv = Math.min(SOCIAL.shortageShift, t.good); t = { good: t.good - mv, none: t.none + mv, friction: t.friction }; }
  return t;
}
export function rollMood(quality: 'normal' | 'poor', mood: Mood, rng: () => number): ExchangeResult {
  const t = moodTable(quality, mood), x = rng() * 100;
  return x < t.good ? 'good' : x < t.good + t.none ? 'none' : 'friction';
}
