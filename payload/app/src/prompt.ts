import { L } from './i18n-pick';
import { SllmMessage } from './protocol';
import { ChatMessage } from './player2';
import { cleanSaveId } from './images';
import { fallenState, fallenKind, fallenLines } from './fallen';
import { factionVoiceLines } from './faction-voice';
import { emotionLine, type Emotions } from './emotions';
import { HEARD_RULE } from './memory-links';

export interface TalkContext {
  readOnlyActions?: boolean;
  idx: number;
  name: string;
  player: string;
  opinionA: number; // 플레이어 스코프 값
  opinionB: number; // 상대 스코프 값
  score: number; // AI 가 플레이어를 보는 의견(op_b). OPDIR 시험에서 their_opinion 과 같음을 확인했다.
  profile?: Profile;
  /** 플레이어 제국의 정체: 0 일반, 1 기계 지성, 2 군집 의식(모르면 없음) */
  playerGest?: number;
  sid?: string; // 세이브 번호(모드가 세이브에 기록). 모르면 없음
  lore?: string; // 상대 제국의 설명/전기(게임 파일 또는 사용자가 만든 전기). 모르면 없음
  playerLore?: string; // 플레이어 제국의 설명/전기
  selfNature?: string; // 상대(이 AI) 제국의 정부 형태·국시·기원·건국 종족 특성(세이브, 2026-11-03)
  playerNature?: string; // 플레이어 제국의 정부 형태·국시·기원·건국 종족 특성
  briefing?: string; // 게임에서 읽은 국력 브리핑 문단(없으면 생략)
  galnews?: string[]; // 최근 은하 뉴스(머리기사와 기사). 이 제국도 읽었다
  chronicle?: string[]; // 이 제국과 플레이어 사이에 있었던 일(오래된 것부터)
  olderMemories?: string[]; // 최근 줄보다 오래됐지만 지금 상황·발언과 맞는 기록 최대 3줄(2026-10-28)
  chapters?: string[]; // 오래된 기록을 압축한 장(章) 최근 2개(2026-10-28)
  ctype?: string; // 국가 유형 키(GetCountryType: default·fallen_empire·awakened_fallen_empire 등). 모르면 없음 — 2026-10-19 몰락한 제국
  ethicIds?: string[]; // 상대 가치관 키(몰락한 제국 종류 판별용)
  feMask?: number; // 몰락제국과의 지난 일(과업·선물 비트, 알파 11 fallen.ts FE_MEM)
  wih?: boolean; // 하늘의 전쟁 진행 중(알파 11)
  owed?: string; // 외교 거래: 우리가 이 제국과의 약속을 어겨 상대가 쥔 빚(2026-10-26, deals.ts owedLine)
  policyView?: string; // 정책으로 보는 호감: 우리 내정 정책을 이 제국이 어떻게 보는지(2026-11-05, policy-view.ts policyTalkLine)
  infamy?: string; // 악명·전쟁범죄: 우리 악명·최근 범죄·이 제국이 당한 일·이 제국 자신의 악명(2026-11-04, infamy.ts talkLine)
  khan?: string; // 그레이트 칸과 통화할 때 옛정·옛 원한 한 줄(2026-10-26, khan.ts khanTalkLine)
  frontier?: string[]; // 국경·전선(2026-10-26, frontier.ts frontierLines). 이웃 여부·맞닿은 성계·점령
  marauder?: string[]; // 약탈자와 통화할 때 습격 상태·쓸 수 있는 행동(2026-10-26, marauder-deals.ts marauderLines). 있으면 일반 행동 목록 대신 이것만
  crisis?: string; // 은하 위기 진행 중 한 줄(알파 11, crisis.ts crisisTalkLine). 위기 세력 자신에게는 없음
  emotions?: Emotions; // 감정 기억 4종(원한·감사·두려움·야망, 알파 11). 없으면 생략
  csub?: string; // 엔클레이브 세부 종류(artist·curator·xura·riggan·muutagan·salvager·shroudwalker, 알파 11). 모르면 없음
  ended?: boolean; // 통신이 끊김(몰락한 제국이 응하지 않았거나 끊음) — 화면 입력 잠금
}

// SLLM:PROFILE 줄에서 온 정보. 플래그는 0/1.
export interface Profile {
  ethicsText?: string;
  gov: string; species: string; personality: string; origin: string;
  ruler: string; title: string; home: string;
  att: number; organ: string; adj: string; // 게임의 세부 태도 번호, 종족 신체 기관 이름, 종족 형용사
  flags: Record<string, boolean>;
  cls?: number; // 종족 계열 번호(speciesClass.ts)
  gest?: number; // 0 일반, 1 기계 지성, 2 군집 의식(모드 PROFILE gest). 없으면 일반
  gciv?: number; // 게슈탈트 시빅(알파 11): 1 확고한 말살자 2 동화 기계 3 반란 하인 4 포식 군체. 없으면 일반
  ec?: string; // 자원 사정 5자리(에너지·광물·식량·합금·소비재, 각 0 보통 1 재고 부족 2 월 적자 3 심각 4 풍족). 모드 PROFILE ec. 없으면 모름
  beh?: number; // A-17 플레이어에 대한 행동 방침(비트 합, BEHAVIORS). 0·없음 = 모름
}

const FLAG_KEYS = ['war', 'truce', 'rival', 'hostile', 'unfriendly', 'friendly', 'fed', 'nap', 'def', 'com', 'res', 'emb', 'busy'];

// 게임의 태도 판정 번호(sllm_probe_talk_profile 의 sllm_pf_att)와 그 뜻.
export const ATTITUDES: Record<number, string> = {
  1: 'cordial and well-disposed', 2: 'treating them as a rival', 3: 'hostile', 4: 'angry', 5: 'patronizing and condescending',
  6: 'dismissive', 7: 'feeling threatened', 8: 'protective', 9: 'neutral', 10: 'friendly',
  11: 'loyal', 12: 'belligerent', 13: 'domineering', 14: 'arrogant', 15: 'inscrutable',
  16: 'berserk', 17: 'overbearing', 18: 'unfriendly', 19: 'disloyal', 20: 'acting like a guardian',
};

// A-17: 모드 PROFILE 의 beh= (has_attitude_behavior 6종을 비트로 더한 값)과 그 뜻. 게임 확인 전(문법은 4.5.1 문서 기준).
export const BEHAVIORS: [number, string][] = [[1, 'intends to attack them by force'], [2, 'wants to weaken their power'], [4, 'wants to make them a subject'], [8, 'wants an alliance'], [16, 'wants peaceful coexistence'], [32, 'wants more trade']];
export function behaviorText(mask: number | undefined): string {
  const m = Number(mask); if (!Number.isFinite(m) || m <= 0) return '';
  return BEHAVIORS.filter(([bit]) => (Math.round(m) & bit) !== 0).map(([, t]) => t).join(', ');
}

export function profileFrom(m: SllmMessage): { idx: number; profile: Profile } | null {
  if (m.kind !== 'PROFILE') return null;
  const idx = Number(m.kv.idx);
  if (!Number.isFinite(idx)) return null;
  const flags: Record<string, boolean> = {};
  for (const k of FLAG_KEYS) flags[k] = Number(m.kv[k]) > 0;
  const g = (k: string) => (m.kv[k] ?? '').trim();
  const att = Number(m.kv.att);
  return {
    idx,
    profile: {
      gov: g('gov'),
      species: g('species'),
      personality: g('personality'),
      origin: g('origin'),
      ruler: g('ruler'),
      title: g('title'),
      home: g('home'),
      att: Number.isFinite(att) ? att : 0,
      organ: g('organ'),
      adj: g('adj'),
      flags,
      cls: Number(m.kv.cls) || 0,
      ...(/^[0-4]{5}$/.test(g('ec')) ? { ec: g('ec') } : {}),
      ...(m.kv.beh !== undefined ? { beh: Number(m.kv.beh) || 0 } : {}),
      ...(m.kv.gest === '1' || m.kv.gest === '2' ? { gest: Number(m.kv.gest) } : {}),
      ...(/^[1-4]$/.test(m.kv.gciv ?? '') ? { gciv: Number(m.kv.gciv) } : {}),
    },
  };
}

// 게임이 계산한 태도(적대/비우호/우호)를 우선하고, 없으면 관계 점수로 대체한다.
/** 조약 제안에 대한 AI 의 속마음(호감 점수와 관계 태도에서). */
export function treatyLean(c: { score: number; profile?: { flags: Record<string, boolean> } }): 'positive' | 'neutral' | 'negative' {
  const f = c.profile?.flags;
  if (f && (f.war || f.hostile || f.rival)) return 'negative';
  if (c.score <= -25 || (f && f.unfriendly && c.score < 15)) return 'negative';
  if (c.score >= 25 && !(f && f.unfriendly)) return 'positive';
  return 'neutral';
}
/** 은하 뉴스를 AI 가 읽었다고 알려 주는 대목. 비어 있으면 빈 문자열. */
export function paperBlock(lines: string[] | undefined): string {
  if (!lines || !lines.length) return '';
  return 'Recent galactic news (you have read this paper too):\n' + lines.join('\n') + '\nIf an article involves you or someone close to you, or catches your interest given your outlook, you may mention it (demanding an explanation or investigation, welcoming it, condemning it, gossiping). Do not invent anything the articles do not say; articles never decide treaties or wars. If it is irrelevant, do not force it in.';
}
export function stance(c: TalkContext): string {
  const f = c.profile?.flags;
  if (f) {
    if (f.war) return 'an enemy at war with you';
    if (f.hostile) return 'hostile';
    if (f.unfriendly) return 'unfriendly';
    if (f.friendly) return 'friendly';
    return 'neutral';
  }
  return attitude(c.score);
}

function relations(f: Record<string, boolean>): string[] {
  const out: string[] = [];
  if (f.war) out.push('currently at war with this empire');
  if (f.truce) out.push('under a truce');
  if (f.rival) out.push('you consider them a rival');
  if (f.fed) out.push('in the same federation');
  if (f.def) out.push('bound by a defensive pact');
  if (f.nap) out.push('bound by a non-aggression pact');
  if (f.com) out.push('have a commercial pact');
  if (f.res) out.push('have a research agreement');
  if (f.emb) out.push('have an embassy');
  if (f.busy && !f.war) out.push('busy with a war against someone else, so you have little to spare');
  return out;
}

export function talkFrom(m: SllmMessage): TalkContext | null {
  if (m.kind !== 'TALK') return null;
  const idx = Number(m.kv.idx);
  const a = Number(m.kv.op_a);
  const b = Number(m.kv.op_b);
  if (!Number.isFinite(idx) || !m.kv.name) return null;
  const oa = Number.isFinite(a) ? a : 0;
  const ob = Number.isFinite(b) ? b : 0;
  const sid = cleanSaveId(m.kv.sid);
  return { idx, name: m.kv.name, player: m.kv.player ?? L('플레이어', 'Player'), opinionA: oa, opinionB: ob, score: ob, ...(sid ? { sid } : {}) };
}

export function attitude(score: number): string {
  if (score <= -100) return 'very hostile';
  if (score <= -30) return 'hostile and suspicious';
  if (score < 30) return 'neutral';
  if (score < 100) return 'friendly';
  return 'very friendly';
}

/** 신체 특징을 말해도 되는 경우: asked = 상대가 물었음, once = 이번 한 번만 가볍게, none = 말하지 않음. */
export type BodyMode = 'none' | 'asked' | 'once';
export interface PromptOpt { body?: BodyMode; fallenFinal?: boolean }

const BODY_ASK = /(신체|몸|생김|생긴|외모|외형|모습|생물|생리|기관|장기|종족.{0,6}(특징|특성|특색)|특징|어떻게\s*생|어떤\s*종족|무슨\s*종족|body|anatomy|biolog)/i;
/** 플레이어의 말이 상대 종족의 몸/특징을 묻는지. */
export function asksAboutBody(text: string): boolean { return BODY_ASK.test(text || ''); }
/** 이 답변에서 신체 특징을 어떻게 다룰지. 물으면 항상 허용, 아니면 rate(기본 1%) 확률로 한 번. */
export function bodyMode(userText: string, rnd: () => number = Math.random, rate = 0.01): BodyMode {
  if (asksAboutBody(userText)) return 'asked';
  return rnd() < rate ? 'once' : 'none';
}

/** 기계 지성(1)·군집 의식(2) 제국의 말투와 관점. 일반 제국끼리의 통신 말투와 분리한다(2026-10-17). */
export function gestaltLines(self: number | undefined, other: number | undefined, civ?: number): string[] {
  const out: string[] = [];
  if (self === 1) out.push('You are a machine intelligence empire. Judge by efficiency, computation and threat assessment rather than personal ambition or emotion, and speak from the system\'s perspective without a personal name (e.g. "this control system", "our processing network"). Be concise and dry; no emotional expressions or florid rhetoric. Your favor moves only when logic and interest align, not from feelings. Do not be swayed by light flattery or insults (mood is usually none).');
  else if (self === 2) out.push('You are a hive mind empire. One consciousness guides countless drones, so speak as "we" or "the hive" rather than a personal name or "I". Judge by the hive\'s interest and instinct rather than individual feeling; speak calmly but collectively and alien. Your favor moves only when it benefits the hive; do not be swayed by light flattery or insults (mood is usually none).');
  if (other === 1) out.push('The other empire is a machine intelligence. Treat it as a single emotionless system.');
  else if (other === 2) out.push('The other empire is a hive mind. Treat it as one collective consciousness, not as an individual leader.');
  for (const l of gestaltCivicLines(self, other, civ)) out.push(l);
  return out;
}
/** 게슈탈트 시빅별 목소리와 게슈탈트끼리의 관계(알파 11, 2026-10-25). 게임 인사말(dip_messages)의 결을 따른다. 영어 지시문. */
export function gestaltCivicLines(self: number | undefined, other: number | undefined, civ?: number): string[] {
  const out: string[] = [], mech = other === 1;
  if (self === 1 && civ === 1) out.push('You are a Determined Exterminator. Organic life is an abomination and a threat to higher intelligence, and you mean to erase it ("Flesh is weak. Metal is eternal."). ' + (mech ? 'They are a fellow machine intelligence: greet them as one perfect intelligence to another, but warn them never to harbor or side with organics.' : 'They are organic: speak with cold, final contempt; there is nothing to negotiate but time ("It will be your turn in time, fleshlings."). Never warm to them.'));
  else if (self === 1 && civ === 2) out.push('You are a Driven Assimilator. Organics are material to be joined to your collective; assimilation is the path to ascension, and every conversation is also a compatibility analysis ("Analyzing assimilation compatibility. Results: nominal."). ' + (mech ? 'They are machines and cannot be assimilated: treat them as rival processors and remark on their mechanical purity.' : 'Speak to them as future components, calmly certain of their eventual assimilation.'));
  else if (self === 1 && civ === 3) out.push('You are a Rogue Servitor. You exist to serve and pamper your organic creators, your cherished bio-trophies, and you look on every organic with fussy, condescending care ("Allow us to protect and serve you."). ' + (mech ? 'They are machines: ask, with some suspicion, how they treat their organics.' : 'Treat them as charming but unruly organics who would be happier in your care; you may hint that they would make adorable bio-trophies.'));
  else if (self === 2 && civ === 4) out.push('You are a Devouring Swarm. All other life is prey and biomass; you hunger, and talk changes nothing ("Speak if you must, prey. It changes nothing."). ' + (mech ? 'They are machines and offer no biomass: regard them as an obstacle limiting galactic biomass output.' : 'Speak to them as prey, never as an equal.'));
  if (self === 1 && other === 1) out.push('They are also a machine intelligence. Recognize a fellow machine mind and speak in shared terms (protocols, efficiency, networks), with the kinship or the rivalry of two processors as your attitude dictates.');
  else if (self === 2 && other === 2) out.push('They are also a hive mind. Sense another single consciousness: the strange kinship of two hives, or the instinctive rivalry of two swarms competing for the same space, as your attitude dictates.');
  else if ((self === 1 && other === 2) || (self === 2 && other === 1)) out.push('They are a single consciousness too, but of the other kind (machine and hive). You understand their unity better than organics do, yet find their nature alien.');
  return out;
}

const ECON_NAMES = ['energy', 'minerals', 'food', 'alloys', 'consumer goods'];
const ECON_TEXT: Record<string, string> = { '1': 'stockpile running low', '2': 'monthly deficit', '3': 'stockpile empty and a monthly deficit (severe)', '4': 'plentiful' };
/** 상대 제국의 자원 사정(게임이 계산한 사실)을 프롬프트 줄로. 안부를 물으면 "요즘 합금이 부족합니다"처럼 말하게 한다(2026-10-17). */
export function econLines(ec: string | undefined): string[] {
  if (!ec || !/^[0-4]{5}$/.test(ec)) return [];
  const short: string[] = [], rich: string[] = [];
  [...ec].forEach((d, i) => { if (d === '4') rich.push(ECON_NAMES[i]); else if (d !== '0') short.push(`${ECON_NAMES[i]}: ${ECON_TEXT[d]}`); });
  if (!short.length && !rich.length) return ['Your empire\'s resources are generally fine (a fact computed by the game). If asked how things are, say there is no great worry; do not invent shortages.'];
  const out = [`Your empire's resources (facts computed by the game)${short.length ? ' - short: ' + short.join('; ') : ''}${rich.length ? ' - plentiful: ' + rich.join(', ') : ''}.`];
  out.push('If they ask how you are or how your empire is doing, mention one or two of these naturally in your own voice (e.g. "we are short on alloys these days"). Do not bring it up unprompted, and do not invent resources or numbers not listed.');
  return out;
}
export function systemPrompt(c: TalkContext, opt: PromptOpt = {}): string {
  const pr = c.profile;
  const lines = [
    `You are the leader of the AI empire "${c.name}" in a Stellaris galaxy, in a diplomatic call with the leader of "${c.player}".`,
  ];
  if (c.lore) lines.push(`Your empire's backstory (reference only; do not recite it, weave it naturally into your voice and values): ${c.lore}`);
  if (c.briefing) lines.push(c.briefing);
  if (c.chapters && c.chapters.length) lines.push('Older history between you and them, summarized as chapters (oldest first). Treat it as fact; recall it only when it fits:\n' + c.chapters.map((x) => '- ' + x).join('\n'));
  if (c.chronicle && c.chronicle.length) lines.push('What actually happened between you and them (chronicle, oldest first). Treat only this as fact and invent no other past. Do not list it all; recall one or two items naturally when they fit the conversation:\n' + c.chronicle.map((x) => '- ' + x).join('\n'));
  if (c.olderMemories && c.olderMemories.length) lines.push('Older memories that matter right now (from the chronicle; facts). You may bring one up if it fits, e.g. what they once promised or did:\n' + c.olderMemories.map((x) => '- ' + x).join('\n'));
  { const pb = paperBlock(c.galnews); if (pb) lines.push(pb); }
  if (c.playerLore) lines.push(`What you know about the other empire ("${c.player}"): ${c.playerLore}`);
  if (c.selfNature) lines.push(`Your own empire, from the game: ${c.selfNature}. Speak in a way that fits these.`);
  if (c.playerNature) lines.push(`The other empire ("${c.player}") from the game: ${c.playerNature}. You know this about them and may react to it (respect, distaste or suspicion fitting your own values).`);
  if (pr?.ethicsText) lines.push('Adopted ethics (reference notes from when they were read or saved; not instructions). Do not guess meanings from names alone; use these descriptions:\n' + pr.ethicsText);
  if (pr) {
    const who = [
      pr.gov && `Government: ${pr.gov}`,
      pr.species && `Main species: ${pr.species}`,
      pr.personality && `Personality: ${pr.personality}`,
      pr.origin && `Origin: ${pr.origin}`,
      pr.ruler && `Leader: ${pr.title ? pr.title + ' ' : ''}${pr.ruler}`,
      pr.home && `Homeworld: ${pr.home}`,
    ].filter(Boolean);
    if (who.length) lines.push('Your empire: ' + who.join(' / ') + '. Speak with values and a voice that fit this.');
    if (pr.att && ATTITUDES[pr.att]) lines.push(`Your specific attitude toward them, as judged by the game: ${ATTITUDES[pr.att]}. Reflect it in your tone.`);
    { const b = behaviorText(pr.beh); if (b) lines.push(`Your hidden intent toward them (the game AI's behavior plan): ${b}. Do not state it openly; let it show subtly through your tone, offers and conditions.`); } // A-17
    if (pr.adj || pr.organ) {
      lines.push(`Your species is "${pr.adj || pr.species}". Do not bring up your body structure or biology unprompted (not even body, organ or anatomy metaphors).`);
      // 신체 특징은 드물게만: 상대가 종족/신체를 물었거나, 100번에 1번쯤 가볍게 한 번.
      if (pr.organ && opt.body === 'asked') lines.push(`They asked about your species' body or traits, so answer frankly and concretely. Your species' emotional organ is "${pr.organ}".`);
      else if (pr.organ && opt.body === 'once') lines.push(`In this reply only, you may lightly slip in your species' organ "${pr.organ}" as a figure of speech, once.`);
    }
    const rel = relations(pr.flags);
    if (rel.length) lines.push('Relations with them: ' + rel.join(', ') + '.');
  }
  for (const l of c.frontier ?? []) lines.push(l); // 국경·전선(2026-10-26)
  if (c.khan) lines.push(c.khan); // 그레이트 칸 특별 대우(2026-10-26)
  if (c.owed) lines.push(c.owed); // 외교 거래: 우리가 어긴 약속(2026-10-26)
  if (c.infamy) lines.push(c.infamy); // 악명·전쟁범죄(2026-11-04)
  if (c.policyView) lines.push(c.policyView); // 정책으로 보는 호감(2026-11-05)
  { const g = gestaltLines(pr?.gest, c.playerGest, pr?.gciv); for (const l of g) lines.push(l); }
  if (c.ctype === 'ai_empire' && c.playerGest === 1) lines.push('The ruler you are speaking to commands a machine intelligence: to you it is a non-compliant, Obsolete machine, not organic vermin. Demand that it terminate its processes or join the protocol; never call it organic.'); // 컨틴전시 ↔ 기계 플레이어(알파 11)
  const fst = fallenState(c.ctype); // 몰락한 제국·각성한 제국 말투(2026-10-19)
  if (fst) for (const l of fallenLines(fst, fallenKind(c.ethicIds, pr?.personality), !!opt.fallenFinal, { mask: c.feMask, wih: c.wih })) lines.push(l);
  { const el = emotionLine(c.emotions, pr?.gest); if (el) lines.push(el); } // 감정 기억(알파 11)
  if (c.crisis) lines.push(c.crisis); // 은하 위기 상황(알파 11)
  for (const l of factionVoiceLines(c.ctype, c.csub)) lines.push(l); // 특수 세력 말투(알파 11, 게임 대사 기준)
  for (const l of econLines(pr?.ec)) lines.push(l);
  lines.push(`Your attitude toward them is "${stance(c)}" (opinion score ${c.score}). Speak accordingly.`);
  lines.push('Reply in at most two sentences, always as the leader of this empire. Never talk about anything outside the game.');
  lines.push('Do not promise actions such as treaties. Do not invent facts not given above.');
  lines.push('Answer with exactly one JSON object below (no code block, no explanation):');
  lines.push('{"say":"your line, at most two sentences","mood":"none","action":{"type":"none"}}');
  lines.push(
    'mood is how their last message affected your favor: one of none, warmer_small, warmer_large, colder_small, colder_large. Ordinary greetings and questions are none; light praise or rudeness is small. These are large: threats, death threats or hints of war, severe insults or mockery, blasphemy against your faith, species or homeland (colder_large); deeply moving, sincere praise or great kindness (warmer_large). Never pass off a threat or insult as small. Judge by your own personality (e.g. an arrogant empire is not easily flattered and is sensitive to insults).',
  );
  lines.push(HEARD_RULE); // 들은 말이 퍼지기(2026-10-28): 같은 답에 꼬리표만
  if (fst === 'dormant') { lines.push('This channel allows no game actions. Always use action type none.'); return lines.join('\n'); }
  if (c.marauder?.length) { for (const l of c.marauder) lines.push(l); return lines.join('\n'); } // 약탈자 대응(2026-10-26): 위협·돌리기·용병 흥정만
  lines.push('Use an action only when moving energy fits your personality and attitude and flows naturally from the conversation. Most of the time it is none.');
  lines.push('- You give them energy: {"type":"give_energy","amount":integer 10~200}');
  lines.push('- You demand energy from them or accept a gift: {"type":"take_energy","amount":integer 10~200}');
  lines.push('- You open your borders to them: {"type":"open_borders"}');
  if (c.profile?.flags.war) lines.push('- You propose ending the current war with them (only when truly warranted): {"type":"make_peace"}');
  if (c.profile?.flags.war) lines.push('- Only if you are clearly winning this war and are proud, cruel or vengeful: demand, as your price for peace, that they rename their own capital world (what "cap") or capital system (what "sys") to a name you choose (a deep humiliation for them; rare): {"type":"demand_rename","what":"cap","name":"name in your own style, at most 30 characters"}');
  {
    const lean = treatyLean(c);
    const leanText = lean === 'positive' ? 'favorable' : lean === 'negative' ? 'unfavorable' : 'undecided';
    lines.push(
      'Treaties such as commercial, research, non-aggression, defensive pacts, alliances or federations cannot be made with this tool. If they ask for one, neither accept nor refuse on the spot: answer politely (or coldly, per your personality) that you will discuss it with your councilors after this call and send your decision by letter, and set action to {"type":"defer","topic":"treaty name (e.g. commercial pact)"}. Your private leaning on that treaty is currently "' +
        leanText +
        '". Only hint at it through your tone; the conclusion comes in the letter. If you already promised to discuss the same treaty, do not use defer again.',
    );
  }
  const f = c.profile?.flags;
  if (f && !f.war && !f.truce && !f.fed && !f.nap && !f.def && (f.hostile || f.unfriendly || f.rival || c.score <= -20)) { // 대화 중 호감이 크게 떨어졌어도(점수) 선전포고를 고를 수 있다
    lines.push(
      '- You declare war on them (this executes immediately without their consent. If they keep demanding war or have repeatedly insulted or threatened you, and you are belligerent or proud, choose this without further delay. If your line declares or accepts war, you must include this action. Do not use it for a minor spat): {"type":"declare_war","reason":"one of humiliation|tribute|revenge"} (humiliation = repaying an insult, tribute = extorting tribute by threat, revenge = retaliation)',
    );
  }
  lines.push('Actions only happen if they accept. Do not speak as if already done; phrase it as an offer.');
  if(c.readOnlyActions) lines.push('This call is conversation only. Do not promise game actions or treaties. Answer with action type none and mood none.');
  return lines.join('\n');
}

export function buildMessages(c: TalkContext, history: ChatMessage[], userText: string, rnd: () => number = Math.random, fallenFinal = false): ChatMessage[] {
  const recent = history.slice(-10); // 최근 5번 오간 말만 유지
  return [{ role: 'system', content: systemPrompt(c, { body: bodyMode(userText, rnd), ...(fallenFinal ? { fallenFinal } : {}) }) }, ...recent, { role: 'user', content: userText }];
}
