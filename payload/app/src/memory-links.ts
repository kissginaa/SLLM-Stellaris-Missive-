// ChatSyncAuto(배너로드 AI Influence 동반 앱) 참고 기억 기능 4가지(2026-10-28 사용자 채용 — 1028_집컴_옮기기/기타_다른게임참고.md). 코드는 가져오지 않고 아이디어만(GPLv3).
//  1. 들은 말이 퍼지기: 외교 대화의 같은 답 JSON 에 "heard" 꼬리표(약속·위협·험담)만 더 받는다(LLM 호출 추가 없음).
//     꼬리표 붙은 말 하나당, 상대의 동맹·우호국마다 기본 3%. 그 제국과 상대 사이에 대사관 +2%p, 첩보 수준이 높으면 +2%p, 최대 8%.
//  2. 관련 있는 기억 꺼내기: 최근 기록 말고, 지금 상황과 꼬리표(제국 이름·사건 낱말)가 맞는 오래된 기록 3개.
//  3. 오래된 기록을 「장(章)」으로: 연대기 상한(제국마다 60줄)에서 밀려나는 줄을 모아 과거형 한 장으로 압축(그때만 LLM), 원문은 따로 보관.
//  4. 인물 성격 편집·내보내기: backstory.ts(제국)·persona.ts(인물)의 말투·비밀 칸 + 화면의 내보내기/가져오기.
import type { ChatMessage } from './player2';

export type HeardKind = 'promise' | 'threat' | 'insult';
export interface Heard { kind: HeardKind; about: string; text: string }
const KINDS: HeardKind[] = ['promise', 'threat', 'insult'];
const clean = (s: unknown, max: number): string => String(s ?? '').replace(/[\r\n\t"\\[\]{}$§£]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** 답 JSON 의 heard 칸 → 꼬리표. 없거나 이상하면 null. */
export function parseHeard(j: unknown): Heard | null {
  const h = (j && typeof j === 'object' ? (j as { heard?: unknown }).heard : null) as { kind?: unknown; about?: unknown; text?: unknown } | null;
  if (!h || typeof h !== 'object') return null;
  const kind = String(h.kind ?? '').toLowerCase() as HeardKind; const text = clean(h.text, 120);
  if (!KINDS.includes(kind) || text.length < 2) return null;
  return { kind, about: clean(h.about, 60), text };
}
/** 외교 대화 시스템 프롬프트에 붙이는 한 줄(영어 지시문, 답의 언어는 따로). */
export const HEARD_RULE = 'Optional: if their last message contained a clear promise, threat or insult (toward you, or about another empire), also add "heard":{"kind":"promise|threat|insult","about":"the other empire it concerns, or empty","text":"a short paraphrase of what they said, at most 15 words"} to the JSON. Leave "heard" out for ordinary talk.';

export const RUMOR = { base: 0.03, embassy: 0.02, intel: 0.02, max: 0.08 } as const;
export const rumorChance = (f: { emb?: boolean; intel?: boolean }): number => Math.min(RUMOR.max, RUMOR.base + (f.emb ? RUMOR.embassy : 0) + (f.intel ? RUMOR.intel : 0));
const KIND_KO: Record<HeardKind, string> = { promise: '약속', threat: '위협', insult: '험담' };
/** 들은 제국 자신의 연대기 한 줄(나중 대화에서 「그때 약속하지 않았소」의 재료). */
export function saidLine(h: Heard, player: string, ko: boolean): string {
  const v = ko ? { promise: '약속했다', threat: '위협했다', insult: '험담했다' }[h.kind] : { promise: 'promised', threat: 'threatened', insult: 'insulted' }[h.kind];
  const about = h.about ? (ko ? `(${h.about} 관련)` : ` (about ${h.about})`) : '';
  return ko ? `${player}이(가) 대화 중 「${h.text}」라고 ${v}${about}` : `${player} ${v} in a talk: "${h.text}"${about}`;
}
/** 받은 제국의 연대기에 남길 「전해 들은 말」 한 줄(기록 당시 인터페이스 언어). */
export function heardLine(h: Heard, player: string, listener: string, ko: boolean): string {
  const about = h.about && h.about !== listener ? h.about : '';
  return ko ? `전해 들은 말: ${player}이(가) ${listener}에게 「${h.text}」라고 했다고 한다(${KIND_KO[h.kind]}${about ? ', ' + about + ' 관련' : ''})`
    : `Word reached us: ${player} reportedly told ${listener} "${h.text}" (${h.kind}${about ? ', about ' + about : ''})`;
}
const okIdx = (n: number) => Number.isSafeInteger(n) && n > 0;
/** 상대(listener)의 동맹·우호국 목록을 게임에 묻는다: 우호(is_friendly_to)·같은 연방·방위 협정. 친구마다 RUMORNET 한 줄(대사관·첩보 수준 60 이상), 끝에 RUMORNETEND. */
export function rumorNetCommand(req: number, listener: number): string {
  if (!okIdx(req) || !okIdx(listener)) throw new Error('rumor net: bad args');
  const src = 'event_target:sllm_rn_src';
  const friend = `every_country = { limit = { is_ai = yes is_country_type = default is_variable_set = sllm_idx NOT = { is_same_value = ${src} } OR = { is_friendly_to = ${src} is_in_federation_with = ${src} has_defensive_pact = ${src} } } set_variable = { which = sllm_rn_e value = 0 } set_variable = { which = sllm_rn_i value = 0 } if = { limit = { has_embassy = prev } set_variable = { which = sllm_rn_e value = 1 } } if = { limit = { intel = { who = prev value >= 60 } } set_variable = { which = sllm_rn_i value = 1 } } log = "SLLM:RUMORNET/;/req=${req}/;/idx=\\[This.sllm_idx]/;/emb=\\[This.sllm_rn_e]/;/intel=\\[This.sllm_rn_i]/;/name=\\[This.GetName]" }`;
  return `effect every_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${listener} } } save_event_target_as = sllm_rn_src ${friend} } log = "SLLM:RUMORNETEND/;/req=${req}"`;
}
export interface Friend { idx: number; name: string; emb: boolean; intel: boolean }
export function friendFrom(kv: Record<string, string>): Friend | null {
  const idx = Number(kv.idx); if (!okIdx(idx)) return null;
  return { idx, name: clean(kv.name, 60), emb: kv.emb === '1', intel: kv.intel === '1' };
}
/** 퍼질 곳 고르기: 친구마다 따로 굴린다(말한 상대·플레이어는 뺀다). */
export function rollSpread(friends: Friend[], skip: number[], rand: () => number): Friend[] {
  const seen = new Set<number>(); const out: Friend[] = [];
  for (const f of friends) { if (seen.has(f.idx) || skip.includes(f.idx)) continue; seen.add(f.idx); if (rand() < rumorChance(f)) out.push(f); }
  return out;
}

// ---- 2. 관련 있는 오래된 기억
export interface MemEntry { date: string; text: string }
/** 최근 recent 줄은 이미 프롬프트에 있으니 그보다 오래된 것 중에서, 꼬리표(이름·낱말)가 맞는 것을 최대 max 개(오래된 순서로). */
export function pickOlder(entries: MemEntry[], recent: number, keys: { names: string[]; words: string[] }, max = 3): string[] {
  const old = entries.slice(0, Math.max(0, entries.length - recent));
  const names = [...new Set(keys.names.map((n) => n.trim()).filter((n) => n.length >= 2))];
  const words = [...new Set(keys.words.map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2))];
  if (!old.length || (!names.length && !words.length)) return [];
  const scored = old.map((e, i) => { const t = e.text.toLowerCase(); let s = 0; for (const n of names) if (e.text.includes(n)) s += 2; for (const w of words) if (t.includes(w)) s += 1; return { e, i, s }; }).filter((x) => x.s > 0);
  scored.sort((a, b) => b.s - a.s || b.i - a.i);
  return scored.slice(0, max).sort((a, b) => a.i - b.i).map((x) => (x.e.date ? `[${x.e.date}] ` : '') + x.e.text);
}
/** 지금 상황에서 뽑는 낱말: 관계(전쟁·경쟁·연방·협정)와 플레이어 발언에 나온 말(약속·배신·전쟁·평화·선물). 한/영 둘 다. */
export function situationWords(flags: Record<string, boolean> | undefined, said: string): string[] {
  const w: string[] = []; const f = flags ?? {};
  if (f.war || f.truce) w.push('전쟁', '선전포고', '평화', 'war', 'peace');
  if (f.rival || f.hostile) w.push('경쟁', '위협', '험담', 'rival', 'threat', 'insult');
  if (f.fed || f.def || f.nap) w.push('연방', '협정', '동맹', 'federation', 'pact', 'alliance');
  const s = said.toLowerCase();
  const pairs: Array<[RegExp, string[]]> = [
    [/약속|맹세|promise|swear|vow/, ['약속', 'promise']], [/배신|배반|betray|traitor/, ['배신', 'betray']], [/전쟁|공격|침공|war|attack|invade/, ['전쟁', 'war']],
    [/평화|휴전|peace|truce/, ['평화', 'peace']], [/선물|에너지|gift|energy/, ['에너지', 'energy', '선물', 'gift']], [/만찬|연회|banquet|dinner/, ['만찬', 'banquet']],
  ];
  for (const [re, ws] of pairs) if (re.test(s)) w.push(...ws);
  return w;
}

// ---- 3. 장(章)
export const CHAPTER = { batch: 20, keep: 12, inPrompt: 2 } as const;
export interface Chapter { from: string; to: string; text: string }
export function chapterMessages(empire: string, player: string, entries: MemEntry[], lang: 'ko' | 'en'): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Below are old chronicle entries of what happened between the empire "${empire}" and the player empire "${player}" in a Stellaris galaxy.`,
      `Compress them into one chapter of history told in the past tense, 3 to 5 sentences, in ${lang === 'ko' ? 'Korean' : 'English'}. Keep names, the key turns (wars, treaties, gifts, insults, promises) and their order. Do not add anything that is not in the entries.`,
      'Output only one JSON: {"chapter":"..."}',
    ].join('\n') },
    { role: 'user', content: entries.map((e) => `- ${e.date} ${e.text}`).join('\n').slice(0, 6000) },
  ];
}
export const chapterLines = (cs: Chapter[], n: number = CHAPTER.inPrompt): string[] => cs.slice(-n).map((c) => `[${c.from} ~ ${c.to}] ${c.text}`);

// ---- 4. 인물 카드(성격·말투·비밀) 내보내기 형식
export interface CharacterCard { format: 'sllm-character'; v: 1; kind: 'empire' | 'person'; name: string; bio: string; voice: string; secret: string }
export const CARD_MAX = { voice: 300, secret: 600 } as const;
export const cleanCard = (s: unknown, max: number): string => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim().slice(0, max);
/** 말투·비밀 프롬프트 덩어리(없으면 ''). who: 'empire' 면 제국 지도자로서. */
export function cardPrompt(c: { voice?: string; secret?: string } | null | undefined): string {
  if (!c) return ''; const out: string[] = [];
  if (c.voice && c.voice.trim()) out.push(`[Your way of speaking - set by the player; keep it] ${c.voice.trim().slice(0, CARD_MAX.voice)}`);
  if (c.secret && c.secret.trim()) out.push(`[Your secret - never state it outright; reveal it only if the conversation truly corners you, and let it shade your choices] ${c.secret.trim().slice(0, CARD_MAX.secret)}`);
  return out.join('\n');
}
