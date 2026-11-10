// 하늘의 목소리(2026-11-03 사용자 결정 ②, 수정): 인지도가 「완전」이 되기 전이면 어느 단계에서든 우리 관측소로 원시문명에게 말을 건다.
// 우리를 잘 모를수록 그들은 신·정령·예언의 목소리로 받아들인다 → 「신 놀이」. 대신 위험이 있다:
//   말 한마디마다 LLM 이 위험도 0~3 을 매기고(조용히 한 사람에게 속삭임 0 … 온 세상이 하늘을 올려다보게 함 3), 교신을 마칠 때 그 합만큼 인지도가 오른다(2026-11-03 사용자: 기본 상승 없이 위험도 = 인지도).
//   인지도가 「완전」에 닿으면 게임이 정식 통신을 연다. 쓸모 있는 지식을 가르치면(teach) 그만큼 다음 시대까지의 기술 진척이 조금 오른다(게임 상황 pre_ftl_tech_progress_situation, 시대당 1920).
//   교신이 끝나면 LLM 이 그들 사회의 「후일담」(계시를 받았다는 주장·미치광이 취급·현자 추앙 등)을 쓴다.
//   그들은 목소리를 섬기는 신앙(이름·열성도)을 만들고, 그 신앙이 관찰 보고서·감청 방송에 나타난다. 은하 공동체 결의안 경고는 개입과 같다.
// 한 문명당 교신은 게임 1달에 한 번, 교신 한 번에 말 6번까지. LLM 이 꼭 필요하다(틀 문장 없음). 앱: src/features/preftl-app.ts. 화면: ui/office-preftl.js.
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';
import { type Civ, AWARE, SITUATION, ageEn } from './preftl';
import { monthsBetween } from './letters';

export const VOICE = { turns: 6, gapMonths: 1, maxAw: 18, maxTokens: 900, keepNotes: 8, teachStep: 48, teachMax: 240, keepAfter: 12 };
export type Mood = 'awe' | 'joy' | 'fear' | 'doubt' | 'defiance';
const MOODS: Mood[] = ['awe', 'joy', 'fear', 'doubt', 'defiance'];
export const MOOD_NAME: Record<Mood, [string, string]> = { awe: ['경외', 'Awe'], joy: ['환희', 'Joy'], fear: ['두려움', 'Fear'], doubt: ['의심', 'Doubt'], defiance: ['반발', 'Defiance'] };

export interface Faith { name: string; devotion: number; sessions: number; last?: string; notes: string[] }
export interface VoiceTurn { who: 'us' | 'them'; text: string; speaker?: string; mood?: Mood; risk?: number; teach?: number }
export interface VoiceSession { id: number; date: string; turns: VoiceTurn[]; speaker: string; risk: number; teach: number }

export function emptyFaith(): Faith { return { name: '', devotion: 0, sessions: 0, notes: [] }; }
/** 지금 교신할 수 없는 이유 또는 ''. */
export function voiceBlock(c: Civ, f: Faith | undefined, date: string): string {
  if (c.gone) return L('더는 원시문명이 아닙니다.', 'They are no longer a pre-FTL civilization.');
  if (c.obs !== 1) return L('우리 관측소가 있어야 하늘에서 말을 걸 수 있습니다.', 'We need our own observation post to speak from the sky.');
  if (c.lv >= 4) return L('그들이 우리를 완전히 압니다. 이제는 외교 단말기로 정식 통신을 하세요.', 'They know us fully now. Use the diplomatic terminal for open contact.');
  if (f?.last && monthsBetween(f.last, date) < VOICE.gapMonths) return L('이번 달에는 이미 하늘에서 말을 걸었습니다.', 'We have already spoken from the sky this month.');
  return '';
}
/** 교신을 마칠 때 오를 인지도 = 말마다 매긴 위험도(0~3)의 합(최대 18). */
export function voiceAwareness(risk: number): number { return Math.max(0, Math.min(VOICE.maxAw, Math.round(risk))); }
/** 가르친 지식(말마다 0~2의 합) → 기술 진척(시대당 1920 중, 한 점에 48 = 2.5%, 최대 240). */
export function teachProgress(teach: number): number { return Math.max(0, Math.min(VOICE.teachMax, Math.round(teach) * VOICE.teachStep)); }

/** 인지도 단계별로 그들이 목소리를 받아들이는 방식(영어, LLM 지시). */
const FRAME = [
  'They have no concept of beings from space. A voice from the sky can only be a god, a spirit or an ancestor speaking. Whoever hears it is shaken to the core.',
  'A few have seen odd lights, but nobody believes in visitors. The voice will most likely be taken as divine or as madness.',
  'Rumours of sky-visitors exist. Some will call the voice a god, others will suspect a trick, a foreign power, or beings from the stars.',
  'They are fairly sure something is watching them from orbit. Educated people will suspect an alien intelligence, though believers may still call it divine.',
];

/** 대화 요청. 상대(누가 듣는지)는 첫 답에서 LLM 이 정하고, 그 뒤로 이어 간다. */
export function voiceMessages(c: Civ, f: Faith, s: VoiceSession, empire: string, sayNow: string): ChatMessage[] {
  const facts = [
    `Civilization: ${c.name}${c.species ? `, species ${c.species}` : ''}${c.planet ? `, homeworld ${c.planet}` : ''}${c.hive ? ' (a hive mind: the listener is a node or the collective itself, not an individual)' : ''}.`,
    `Stage: ${ageEn(c.age)}. Awareness of outsiders: ${AWARE[c.lv]?.en ?? '?'} — ${FRAME[Math.max(0, Math.min(3, c.lv))]}`,
    ...(c.sit && SITUATION[c.sit] ? [`Their world is suffering: ${SITUATION[c.sit].en}.`] : []),
    f.sessions > 0 ? `The voice has spoken to them ${f.sessions} time(s) before. ${f.name ? `They call it "${f.name}". ` : ''}Devotion to it: ${f.devotion}/100.${f.notes.length ? ' What happened before: ' + f.notes.slice(-4).join(' | ') : ''}` : 'This is the first time any voice has spoken to them from the sky.',
    s.speaker ? `The listener in this conversation: ${s.speaker}. Keep them.` : `Choose ONE listener who fits their stage (a shaman, priest, ruler, scholar, radio operator, scientist...) and keep them for this conversation.`,
  ];
  const msgs: ChatMessage[] = [
    { role: 'system', content: [
      `In Stellaris, the star empire ${empire} secretly speaks to a primitive (pre-FTL) people through its observation post, as a "voice from the sky". You play the people's side only: the listener and, briefly, what happens around them.`,
      'Stay true to their stage and awareness: they cannot understand starships, other empires or anything they have no words for. Translate everything the voice says into their own concepts (gods, omens, machines, broadcasts).',
      'Reply ONLY with JSON: {"speaker":"name and role of the listener","reply":"what the listener says or does, 1-4 sentences, may include a short description of the scene","mood":"awe|joy|fear|doubt|defiance","risk":0-3,"name":"what they call the voice (only if new or changed, else empty)","devotion":-10..10,"teach":0-2,"note":"one short English line: what this exchange will change among them"}.',
      'teach: how much genuinely usable knowledge the voice just gave them that fits one step above their stage (0 = none or nothing they could use; 1 = a practical idea; 2 = a clear, workable technique). Knowledge far beyond their stage is not usable (0).',
      'risk measures how likely this exchange is to expose the watchers: 0 = quiet words to one person; 1 = others overheard or it gets written down; 2 = a public sign, a demand, a prophecy that can be checked; 3 = a miracle, threat, call to war or anything that makes the whole world look up. Be strict: grand gestures carry risk.',
      'devotion: how much their faith in the voice grows (+) or breaks (-). Cruel, petty or false words lower it. Never let them obey blindly if it would be absurd for them.',
    ].join('\n') },
    { role: 'user', content: facts.join('\n') },
  ];
  for (const t of s.turns) msgs.push(t.who === 'us' ? { role: 'user', content: 'THE VOICE: ' + t.text } : { role: 'assistant', content: JSON.stringify({ speaker: t.speaker ?? '', reply: t.text, mood: t.mood ?? 'awe', risk: t.risk ?? 0, teach: t.teach ?? 0 }) });
  msgs.push({ role: 'user', content: 'THE VOICE: ' + sayNow });
  return msgs;
}

export interface VoiceReply { speaker: string; reply: string; mood: Mood; risk: number; teach: number; name: string; devotion: number; note: string }
const jsonPart = (raw: string): Record<string, unknown> | null => {
  const t = String(raw ?? ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null;
  try { const v = JSON.parse(t.slice(a, b + 1)); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; }
};
const str = (v: unknown, n: number) => String(v ?? '').replace(/[\r\t]+/g, ' ').trim().slice(0, n);
export function parseVoice(raw: string): VoiceReply | null {
  const v = jsonPart(raw); if (!v) return null;
  const reply = str(v.reply, 900); if (!reply) return null;
  const mood = MOODS.includes(v.mood as Mood) ? v.mood as Mood : 'awe';
  const risk = Math.max(0, Math.min(3, Math.round(Number(v.risk)) || 0));
  const dev = Math.max(-10, Math.min(10, Math.round(Number(v.devotion)) || 0));
  const teach = Math.max(0, Math.min(2, Math.round(Number(v.teach)) || 0));
  return { speaker: str(v.speaker, 80), reply, mood, risk, teach, name: str(v.name, 40), devotion: dev, note: str(v.note, 160) };
}

/** 교신 결과를 신앙에 반영(말 한 번마다). */
export function applyReply(f: Faith, r: VoiceReply): void {
  if (r.name && r.name.length >= 2) f.name = r.name;
  f.devotion = Math.max(0, Math.min(100, f.devotion + r.devotion));
  if (r.note) f.notes = [...f.notes, r.note].slice(-VOICE.keepNotes);
}
/** 보고서·방송 LLM 지시에 넣는 한 줄(영어). 교신이 없었으면 ''. */
export function faithLine(f: Faith | undefined): string {
  if (!f || !f.sessions) return '';
  const lvl = f.devotion >= 70 ? 'a fervent, organised faith' : f.devotion >= 35 ? 'a growing cult' : f.devotion > 0 ? 'a small circle of believers' : 'mostly forgotten or dismissed';
  return `A "voice from the sky" (really us) has spoken to them ${f.sessions} time(s)${f.name ? `; they call it "${f.name}"` : ''}. It is now ${lvl} (devotion ${f.devotion}/100).${f.notes.length ? ' Latest: ' + f.notes[f.notes.length - 1] : ''}`;
}
/** 틀 문장 방송·보고서에 붙이는 한 줄(화면 언어). */
export function faithText(f: Faith | undefined): string {
  if (!f || !f.sessions || f.devotion <= 0) return '';
  const nm = f.name || L('하늘의 목소리', 'the Voice from the Sky');
  if (f.devotion >= 70) return L(`「${nm}」을(를) 섬기는 신앙이 세력을 이루었다(열성도 ${f.devotion}).`, `The faith of "${nm}" has become a real power (devotion ${f.devotion}).`);
  if (f.devotion >= 35) return L(`「${nm}」을(를) 따르는 무리가 늘고 있다(열성도 ${f.devotion}).`, `Followers of "${nm}" are growing in number (devotion ${f.devotion}).`);
  return L(`「${nm}」의 목소리를 들었다는 사람들이 조용히 모인다(열성도 ${f.devotion}).`, `A few who claim to have heard "${nm}" meet quietly (devotion ${f.devotion}).`);
}
/** 교신 끝 명령: 인지도 + 기술 진척. 회신 PFTLACT w=21. */
export function voiceCommand(req: number, sid: string, id: number, aw: number, prog = 0): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(aw) || aw < 0 || aw > VOICE.maxAw || !Number.isSafeInteger(prog) || prog < 0 || prog > VOICE.teachMax) throw new Error(L('하늘의 목소리 명령 인자가 올바르지 않습니다.', 'Invalid voice-from-the-sky command arguments.'));
  const body = (aw ? `add_awareness = ${aw} ` : '') + (prog ? `every_situation = { limit = { is_situation_type = pre_ftl_tech_progress_situation } add_situation_progress = ${prog} } ` : '');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } every_country = { limit = { is_primitive = yes check_variable = { which = sllm_pf_id value = ${id} } } ${body}} log = "SLLM:PFTLACT/;/req=${req}/;/w=21/;/st=1" }`;
}

/** 후일담(교신 뒤 그들 사회에서 벌어지는 일). 종류는 앱이 고르고(다양하게), 글은 LLM 이 쓴다. */
export type AfterKind = 'prophet' | 'madman' | 'sage' | 'cult' | 'heresy' | 'skeptic' | 'scripture' | 'inquiry';
export const AFTER: Record<AfterKind, { ko: string; en: string; desc: string; dev: number }> = {
  prophet: { ko: '계시를 받았다는 주장', en: 'A claim of revelation', desc: 'the listener (or someone close) publicly claims to have received a revelation from the sky', dev: 3 },
  madman: { ko: '미치광이 취급', en: 'Called a madman', desc: 'people dismiss the listener as mad, drunk or lying; they are mocked or locked away', dev: -4 },
  sage: { ko: '현자로 추앙', en: 'Hailed as a sage', desc: 'the listener is respected as a wise one; rulers or scholars start asking them for counsel', dev: 4 },
  cult: { ko: '추종자 무리', en: 'A band of followers', desc: 'a small group gathers around the words of the voice, with rituals and a name', dev: 5 },
  heresy: { ko: '이단 박해', en: 'Persecuted as heresy', desc: 'the established priests or rulers condemn it as heresy and persecute the believers', dev: -2 },
  skeptic: { ko: '학자들의 반박', en: 'Scholars object', desc: 'thinkers argue it was a natural phenomenon, a hoax or a mass delusion', dev: -3 },
  scripture: { ko: '말씀이 기록됨', en: 'The words are written down', desc: 'the words are copied, painted, sung or printed and begin to spread as sacred text', dev: 3 },
  inquiry: { ko: '당국의 조사', en: 'An official inquiry', desc: 'the authorities (or scientists) quietly investigate the source of the voice', dev: 0 },
};
export interface Aftermath { date: string; kind: AfterKind; headline: string; body: string; llm: boolean }
/** 후일담 종류 고르기: 위험도·인지도·신앙에 따라 가중치. */
export function pickAfter(lv: number, risk: number, devotion: number, rng: () => number = Math.random): AfterKind {
  const w: Record<AfterKind, number> = { prophet: 3, madman: 3, sage: 2, cult: devotion >= 20 ? 3 : 1, heresy: devotion >= 30 ? 2 : 0.5, skeptic: lv >= 1 ? 2 : 1, scripture: devotion >= 15 ? 2 : 0.5, inquiry: lv >= 2 || risk >= 4 ? 2.5 : 0.3 };
  if (risk === 0) { w.madman += 1; w.prophet += 1; }
  const keys = Object.keys(w) as AfterKind[], sum = keys.reduce((a, k) => a + w[k], 0); let x = rng() * sum;
  for (const k of keys) { x -= w[k]; if (x <= 0) return k; } return 'prophet';
}
export const AFTER_MAX_TOKENS = 600;
export function afterMessages(c: Civ, f: Faith, s: VoiceSession, kind: AfterKind, date: string): ChatMessage[] {
  const said = s.turns.filter((t) => t.who === 'us').map((t) => t.text).join(' / ').slice(0, 900);
  return [
    { role: 'system', content: [
      `Stellaris. A star empire secretly spoke to a primitive (pre-FTL) people as a "voice from the sky". Write what happened afterwards in their society, dated ${date}.`,
      `What happens: ${AFTER[kind].desc}.`,
      'Write it as a short item from their own news of the time (a town crier, a chronicle, a pamphlet, a newspaper or a broadcast, whatever fits their stage).',
      'Reply ONLY with JSON: {"headline":"short headline in their style","body":"2-4 sentences","note":"one short English line for our records"}. Use their own concepts; never name us or starships.',
    ].join('\n') },
    { role: 'user', content: [
      `Civilization: ${c.name}${c.species ? ` (${c.species})` : ''}, ${ageEn(c.age)}${c.hive ? ', a hive mind' : ''}. Awareness of outsiders: ${AWARE[c.lv]?.en ?? '?'}.`,
      `Listener: ${s.speaker || 'unknown'}. The voice said: ${said}`,
      f.name ? `They call the voice "${f.name}". Devotion ${f.devotion}/100.` : '',
    ].filter(Boolean).join('\n') },
  ];
}
export function parseAfter(raw: string, kind: AfterKind, date: string): Aftermath | null {
  const v = jsonPart(raw); if (!v) return null; const headline = str(v.headline, 120), body = str(v.body, 900);
  return headline && body ? { date, kind, headline, body, llm: true } : null;
}
export function afterNote(raw: string): string { const v = jsonPart(raw); return v ? str(v.note, 160) : ''; }
/** LLM 없을 때 후일담(화면 언어). */
export function templateAfter(c: Civ, s: VoiceSession, kind: AfterKind, date: string): Aftermath {
  const who = s.speaker || L('그 목소리를 들은 이', 'the one who heard the voice'), A = AFTER[kind];
  const B: Record<AfterKind, [string, string]> = {
    prophet: [`${who}이(가) 하늘에서 말씀을 들었다고 사람들 앞에서 외쳤다.`, `${who} proclaimed before the people that words had come from the sky.`],
    madman: [`사람들은 ${who}이(가) 미쳤다고 수군거렸다. 몇몇은 돌을 던졌다.`, `People whispered that ${who} had gone mad. Some threw stones.`],
    sage: [`${who}의 말을 들으려고 먼 곳에서도 사람들이 찾아오기 시작했다.`, `People began travelling from afar to hear what ${who} had to say.`],
    cult: [`${who}의 곁에 사람들이 모여 밤마다 하늘을 향해 노래한다.`, `People gather around ${who} and sing to the sky every night.`],
    heresy: [`권력자들은 이를 이단이라 선언하고 믿는 자들을 잡아들였다.`, `The powerful declared it heresy and rounded up the believers.`],
    skeptic: [`학자들은 그것이 바람 소리나 착각이었다고 반박했다.`, `Scholars argued it was only the wind or a delusion.`],
    scripture: [`그 말씀이 기록되어 몰래 베껴 쓰이며 퍼지고 있다.`, `The words were written down and are spreading in secret copies.`],
    inquiry: [`당국이 목소리의 출처를 조용히 조사하기 시작했다.`, `The authorities have quietly begun investigating where the voice came from.`],
  };
  return { date, kind, llm: false, headline: L(A.ko, A.en), body: L(...B[kind]) };
}
/** 비서가 알 수 있는 사실(영어). */
export function faithFact(name: string, f: Faith): string { return `We have secretly spoken to the pre-FTL ${name} as a voice from the sky ${f.sessions} time(s)${f.name ? `; they call us "${f.name}"` : ''}; devotion ${f.devotion}/100.`; }
