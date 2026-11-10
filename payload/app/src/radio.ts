// 성간 라디오: 플레이어가 켰을 때만, 게임에서 일어난 사건(SLLM:EVT)을 모아 2분 간격으로 아나운서와 기자가 일방적으로 방송한다.
import type { ChatMessage } from './player2';
import type { SllmMessage } from './protocol';
import * as fs from 'fs';
import { logDiagnostic } from './diagnostics';
import { dayNo } from './gamedate';
import { PAPERS, Paper, paperPrompt } from './galnews';
import type { ChronEntry } from './chronicle';
import { L } from './i18n-pick';

export const RADIO_STATIONS = [
  { id: 'stn', name: '성간방송 STN', paper: 0, outlook: '보수 · 안보와 군사력 중시', announcer: '아나운서 하르벤', cohost: '아나운서 이렌', reporter: '현장 기자 솔라' },
  { id: 'starcluster', name: '별무리 라디오', paper: 1, outlook: '진보 · 평화와 종족 간 협력 중시', announcer: '아나운서 세린', cohost: '아나운서 다온', reporter: '현장 기자 루미' },
  { id: 'void', name: '공허 공영방송', paper: 2, outlook: '중립 · 확인된 사실 중심', announcer: '아나운서 베일', cohost: '아나운서 리스', reporter: '현장 기자 노아' },
] as const;
// 한국어가 아닌 언어로 방송할 때 AI 가 쓸 이름 표기(2026-10-18 QA: 영어 방송에 한글 진행자 이름이 섞이던 문제). 화면 표기는 ui/i18n-catalog.js 와 같다.
const NAMES_EN: Record<string, { name: string; announcer: string; cohost: string; reporter: string }> = {
  stn: { name: 'Interstellar Broadcasting STN', announcer: 'Harven', cohost: 'Iren', reporter: 'Sola' },
  starcluster: { name: 'Starcluster Radio', announcer: 'Serin', cohost: 'Daon', reporter: 'Lumi' },
  void: { name: 'Void Public Broadcasting', announcer: 'Veil', cohost: 'Lis', reporter: 'Noah' },
};
const PAPER_EN: Record<string, string> = { '성간일보': 'Interstellar Times', '별무리 속보': 'Starcluster Flash', '공허 통신': 'Void Wire' };
/** 프롬프트용 한 줄: 한국어 외 언어로 쓸 때의 이름 표기. 사용자가 바꾼 이름은 그대로 둔다. */
export function radioNameNote(stationId: string, paperName: string, configuredName?: string): string {
  const station = radioStation(stationId), en = NAMES_EN[station.id];
  if (!en) return '';
  const parts = [`announcer "${en.announcer}"`, `cohost "${en.cohost}"`, `reporter "${en.reporter}"`];
  if (!configuredName || configuredName === station.name) parts.unshift(`station "${en.name}"`);
  if (PAPER_EN[paperName]) parts.unshift(`newspaper "${PAPER_EN[paperName]}"`);
  return `When writing lines in a language other than Korean, do not use the Hangul names; use these forms instead: ${parts.join(', ')}. (You may transliterate them into that language's script.) When writing in Korean, use the original names above.`;
}
export function radioStation(id: unknown) { return RADIO_STATIONS.find((s) => s.id === id) ?? RADIO_STATIONS[0]; }
export function radioStationViews() { return RADIO_STATIONS.map((s) => ({ ...s, parent: PAPERS[s.paper].name })); }


/** id: 방송 중복을 막는 표식(라디오 연대기의 uid 와 같게 둔다). */
export interface RadioEvent { kind: string; date: string; text: string; n: number; id?: string }
export interface RadioLine { who: 'announcer' | 'reporter' | 'cohost'; text: string }
export const ANNOUNCER = '아나운서 하르벤', REPORTER = '현장 기자 솔라';
const MAX_QUEUE = 40;

const clean = (s: string | undefined) => String(s ?? '').replace(/§[A-Za-z!]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

/** SLLM:EVT 줄을 사건 한 개로. 알 수 없는 종류는 버린다. */
export function parseEvent(m: SllmMessage): RadioEvent | null {
  if (m.kind !== 'EVT') return null;
  const k = m.kv.kind || ''; const g = (x: string) => clean(m.kv[x]); const date = g('date');
  const T: Record<string, string> = {
    tech: L(`연구 성과: ${g('who')}의 기술 단계가 올랐다`, `Research: ${g('who')} advanced a technology tier`),
    tradition: L(`전통 선택: ${g('who')}가 새 전통을 골랐다`, `Tradition: ${g('who')} adopted a new tradition`),
    ascension: L(`승천 특전: ${g('who')}가 승천 특전을 골랐다`, `Ascension perk: ${g('who')} chose an ascension perk`),
    ruler_set: L(`새 통치자: ${g('who')}에 새 통치자가 섰다`, `New ruler: ${g('who')} has a new ruler`),
    ruler_removed: L(`통치자 퇴진: ${g('who')}의 통치자 ${g('leader')}이(가) 물러났다`, `Ruler stepped down: ${g('leader')}, ruler of ${g('who')}, left office`),
    leader_death: L(`지도자 이탈: ${g('who')}의 지도자 ${g('leader')}이(가) 지도자 명단에서 빠졌다(사망인지 은퇴인지는 확인되지 않음)`, `Leader departed: ${g('leader')} of ${g('who')} left the leader roster (death or retirement not confirmed)`), // 게임의 on_leader_death 는 은퇴 때도 불린다(paragon.590)
    leader_level: L(`지도자 승급: ${g('who')}의 지도자 ${g('leader')}이(가) 승급했다`, `Leader promoted: ${g('leader')} of ${g('who')} was promoted`),
    leader_hired: L(`지도자 영입: ${g('leader')}이(가) 새로 고용됐다`, `Leader recruited: ${g('leader')} was newly hired`),
    megastructure: L(`거대구조물 완공: ${g('system')} 성계의 ${g('what')}`, `Megastructure completed: ${g('what')} in the ${g('system')} system`),
    survey_system: L(`성계 탐사 완료: ${g('system')}`, `System surveyed: ${g('system')}`),
    survey_planet: L(`행성 조사 완료: ${g('planet')}`, `Planet surveyed: ${g('planet')}`),
    election: L(`선거 종료: ${g('who')}에서 선거가 끝났다`, `Election over: an election ended in ${g('who')}`),
    war_start: L(`전쟁 개시: ${g('war')} (${g('who')} 참전)`, `War begun: ${g('war')} (${g('who')} joined)`),
    war_won: L(`전쟁 승리: ${g('this')}이(가) ${g('other')}과(와)의 ${g('war')}에서 이겼다`, `War won: ${g('this')} won ${g('war')} against ${g('other')}`),
    war_lost: L(`전쟁 패배: ${g('this')}이(가) ${g('other')}과(와)의 ${g('war')}에서 졌다`, `War lost: ${g('this')} lost ${g('war')} against ${g('other')}`),
    // on_war_ended 는 현상 유지(백지평화) 때도 불리고 그때도 한쪽을 '패자'로 넘긴다(2026-10-18 제보: 평화도 늘 패배로 묘사). 승패는 war_won·war_lost·war_sq 가 따로 알려 준다.
    war_end: L(`전쟁 종결: ${g('loser')}과(와) ${g('winner')} 사이의 전쟁이 끝났다(이 소식만으로는 승패를 알 수 없다. 승리·패배 소식이 따로 없으면 단정하지 않는다)`, `War ended: the war between ${g('loser')} and ${g('winner')} is over (this alone does not tell who won; do not assume unless a separate win/loss item exists)`),
    war_sq: ((x, y) => L(`현상 유지 강화: ${x}과(와) ${y}이(가) 승패 없이 전쟁을 끝냈다(어느 쪽도 지지 않았다)`, `Status quo peace: ${x} and ${y} ended their war with no winner (neither side lost)`))(...[g('a'), g('b')].sort() as [string, string]), // 양쪽에서 한 번씩 와도 같은 사건이 되게 이름을 정렬
    first_contact: L(`첫 접촉: ${g('a')}와(과) ${g('b')}이(가) 서로를 발견했다`, `First contact: ${g('a')} and ${g('b')} discovered each other`),
    occupied: L(`행성 점령: ${g('planet')} (소유 ${g('owner')}, 점령 ${g('occupier')})`, `Planet occupied: ${g('planet')} (owner ${g('owner')}, occupier ${g('occupier')})`),
  };
  const text = T[k]; if (!text) return null;
  const n = Number(m.kv.n) || 0;
  return { kind: k, date, text, n, id: `${k}|${date}|${n}|${text}` };
}

/** 켜져 있는 동안 쌓이는 사건 대기열. 방송 사이에 너무 많이 쌓이면 오래된 것부터 버린다. */
export class RadioQueue {
  private q: RadioEvent[] = [];
  private last: RadioEvent[] = [];
  /** 같은 id 가 이미 대기 중이면 넣지 않는다. 넣었으면 true. */
  push(e: RadioEvent): boolean { if (e.id && this.q.some((x) => x.id === e.id)) return false; this.q.push(e); if (this.q.length > MAX_QUEUE * 4) this.q.splice(0, this.q.length - MAX_QUEUE * 4); return true; }
  get size() { return this.q.length; }
  clear() { this.q = []; this.last = []; }
  /** 마지막 take() 로 꺼낸 사건(방송 성공 뒤 '방송함' 기록용). */
  get taken(): RadioEvent[] { return this.last.slice(); }
  /** 방송이 실패하면 마지막으로 꺼낸 사건을 맨 앞에 되돌려 놓는다(유실 방지). */
  putBack(): void { if (!this.last.length) return; const back = this.last.filter((e) => !e.id || !this.q.some((x) => x.id === e.id)); this.q.unshift(...back); this.last = []; if (this.q.length > MAX_QUEUE * 4) this.q.splice(MAX_QUEUE * 4); }
  /** 오래된 것부터 방송 줄 max 개 분량을 꺼낸다. 같은 종류가 많으면(연구·탐사) 한 줄로 묶는다. 나머지는 다음 방송에 남긴다. */
  take(max = 6): string[] {
    const AGG = ['tech', 'survey_planet', 'survey_system'];
    const items: RadioEvent[] = []; const kinds = new Set<string>(); let lines = 0, i = 0;
    for (; i < this.q.length; i++) {
      const e = this.q[i]; const agg = AGG.includes(e.kind);
      if (agg && kinds.has(e.kind)) { items.push(e); continue; }
      if (lines >= max) break;
      lines++; if (agg) kinds.add(e.kind); items.push(e);
    }
    this.q.splice(0, i); this.last = items;
    const out: string[] = []; const agg = new Map<string, RadioEvent[]>();
    for (const e of items) { if (AGG.includes(e.kind)) { (agg.get(e.kind) ?? agg.set(e.kind, []).get(e.kind)!).push(e); } else out.push(`[${e.date}] ${e.text}`); }
    for (const [k, v] of agg) { if (v.length === 1) out.push(`[${v[0].date}] ${v[0].text}`); else out.push(`[${v[v.length - 1].date}] ${L(`${k === 'tech' ? '연구 성과' : k === 'survey_planet' ? '행성 조사' : '성계 탐사'} ${v.length}건 (예: ${v.slice(-2).map((x) => x.text.replace(/^[^:]*:\s*/, '')).join(' / ')})`, `${k === 'tech' ? 'Research' : k === 'survey_planet' ? 'Planet surveys' : 'System surveys'}: ${v.length} items (e.g. ${v.slice(-2).map((x) => x.text.replace(/^[^:]*:\s*/, '')).join(' / ')})`)}`); }
    return out.slice(-MAX_QUEUE);
  }
}

export function radioMessages(player: string, date: string, facts: string[], recent: string[], stationId: string = 'stn', configuredPaper?: Paper, configuredName?: string, format: 'studio' | 'field' = 'field', recap = false, background: string[] = []): ChatMessage[] {
  const station = radioStation(stationId), paper = configuredPaper ?? PAPERS[station.paper], pp = paperPrompt(paper);
  if (!facts.length) {
    const second = format === 'studio' ? 'cohost' : 'reporter';
    const secondName = format === 'studio' ? station.cohost : station.reporter;
    return [
      { role: 'system', content: [
        `You write the fictional "everyday life" segment for "${configuredName || station.name}", a station owned by the newspaper "${paper.name}". There are no real events this time, so this episode is a made-up entertainment broadcast unrelated to game facts.`,
        `The hosts are "${station.announcer}" (announcer) and "${secondName}" (${second}). The listener is the leader of ${player || 'the player empire'}.`,
        radioNameNote(station.id, paper.name, configuredName),
        `Reflect the newspaper's persona in the tone and jokes: ${pp.slant}. Style: ${pp.tone}. In this segment, instead of factual reporting, you invent clearly labeled fictional everyday stories.`,
        paper.comments ? 'The two hosts trade short reactions and jokes in line with the station\'s viewpoint.' : 'A station that allows no commentary reports with calm observation and dry humor, with no political judgments or taking sides.',
        'In the first line, briefly announce that this is the fictional everyday-life segment. Invent 1-2 new trivial everyday mishaps of unnamed galactic residents. Examples: a lithoid neighbor\'s noise complaint, a fungoid baking club, a robot\'s botched vacation request. Do not reuse the examples every time.',
        'Do not invent anything that could be mistaken for real game state, such as wars, treaties, elections, leaders, territory or resource changes. Do not present anything as an official act of a real empire or a confirmed interview. Do not include real-world people or organizations. No gruesome descriptions.',
        'The hosts keep a back-and-forth of questions, answers and reactions. Do not ask the listener for a reply. One or two sentences per line, structured as: 1st intro and response → 2nd question and explanation → 3rd reaction and follow-up → 4th wrap-up and sign-off.',
        `Exactly 8 lines: repeat the order announcer → ${second} 4 times. Output one JSON only: {"lines":[{"who":"announcer","text":"..."},{"who":"${second}","text":"..."}, ...]}. The real JSON must contain 8 lines with no ellipsis.`,
        'Avoid the same topics or endings as recent fictional broadcasts. Recent broadcasts are not game facts.',
      ].join('\n') },
      { role: 'user', content: '[Recent fictional everyday broadcasts]\n' + (recent.length ? recent.slice(-8).join('\n') : '(none)') + '\nWrite a new fictional everyday-life segment for this episode.' },
    ];
  }
  return [
    { role: 'system', content: [
      `You are the radio script writer for "${configuredName || station.name}", a station owned by the newspaper "${paper.name}". You broadcast one-way to the listener and never ask them to reply.`,
      format === 'studio'
        ? `The hosts are two studio announcers: "${station.announcer}" (announcer, introduces the news and asks questions) and "${station.cohost}" (cohost, picks up the colleague's lines, explains and sums up the facts).`
        : `The hosts are "${station.announcer}" (announcer, runs the studio) and "${station.reporter}" (reporter, reports based on the event list). Do not invent eyewitness accounts or interviews as if the reporter were on site.`,
      `The listener is the leader of "${player || 'the player empire'}". The date is ${date || 'unknown'}.`,
      radioNameNote(station.id, paper.name, configuredName),
      `The broadcast follows the parent newspaper's leaning: ${pp.slant.replace('comment 필드는 빈 문자열로 둡니다.', 'Do not add opinions or speculation.')}`,
      paper.comments ? `Turn the newspaper's style (${pp.tone}) into natural spoken broadcast language. Keep judgments separate from confirmed facts, and make clear that judgments are the station's view.` : 'Neutral broadcast: calmly and concisely report only confirmed facts. No cynical judgments, support, criticism or speculation.',
      'Rule: say only what is in the [Event list] below. Do not invent names, numbers or causes that are not in the list. If there are only a few events, keep it short.',
      'Lines are spoken broadcast style, one or two sentences each. Write exactly 4 rounds of back-and-forth, i.e. exactly 8 lines. 1st: introduce the news and respond, 2nd: fact-checking question and explanation, 3rd: follow-up question and supplement, 4th: summary and sign-off. React naturally to the previous line; if facts are few, explain only the confirmed part briefly. Do not ask the listener questions or ask for a reply.',
      `The speaker order must repeat announcer → ${format === 'studio' ? 'cohost' : 'reporter'} 4 times. The same speaker must never speak twice in a row.`,
      background.length && !recap ? '[Background] holds earlier, already-aired news connected to this event list. If an event follows up on the background, report it as a continuation ("following up on what we reported earlier about ..."). Do not present background items as new news, and do not invent developments, causes or numbers not in the background or event list (if the developments are unknown, say so).' : '',
      recap ? 'There is no new news this episode, so this is a "recap rebroadcast" of the main news of the past year. Say so in the first line and present the listed items as past events. Do not speak as if they just happened.' : 'Do not simply repeat what has already been aired (see [Recent broadcasts]).',
      `Output one JSON only: {"lines":[{"who":"announcer","text":"..."},{"who":"${format === 'studio' ? 'cohost' : 'reporter'}","text":"..."}, ...]} — the real output must contain exactly 8 lines with no ellipsis.`,
    ].filter(Boolean).join('\n') },
    { role: 'user', content: `[Event list]\n${facts.map((f) => '- ' + f).join('\n')}\n\n${background.length && !recap ? '[Background — earlier news already aired]\n' + background.map((f) => '- ' + f).join('\n') + '\n\n' : ''}[Recent broadcasts]\n${recent.length ? recent.slice(-6).join('\n') : '(none)'}` },
  ];
}

/** 방송 대본 해석: JSON(조각나도 가능한 만큼). 실패하면 빈 배열. */
/** 화자 이름표를 announcer/cohost/reporter 로 맞춘다(대소문자·띄어쓰기·한국어·동의어). 모르면 null. */
function radioRole(v: unknown): RadioLine['who'] | null {
  const k = String(v ?? '').toLowerCase().replace(/[\s_\-*:.()[\]"']/g, '');
  if (!k) return null;
  if (/^(announcer|anchor|host|mainhost|presenter|newscaster|아나운서|앵커|진행자|사회자)/.test(k)) return 'announcer';
  if (/^(cohost|co|secondhost|guest|analyst|commentator|panelist|공동진행자|패널|해설자|게스트)/.test(k)) return 'cohost';
  if (/^(reporter|fieldreporter|correspondent|journalist|기자|현장기자|특파원|리포터)/.test(k)) return 'reporter';
  return null;
}
const RADIO_TEXT_KEYS = ['text', 'line', 'content', 'dialogue', 'dialog', 'say', 'says', 'message', 'speech', 'utterance'];
const RADIO_WHO_KEYS = ['who', 'speaker', 'role', 'name', 'character', 'host', 'voice'];
/** 2026-10-22 실제 로그: Player2 가 1,300~1,600자를 돌려줬는데 정해진 모양("who" 바로 뒤 "text", 소문자 역할)이 아니어서 0줄로 버려졌다.
 * JSON(이중 인코딩 포함)을 실제로 읽고, 키 이름·순서·역할 표기가 달라도 받아들인다. 마지막으로 "Announcer: …" 같은 일반 글도 읽는다.
 * format 을 주면, 8줄이 다 있는데 역할 표시만 빠지거나 틀린 경우 순서대로(진행자 → 상대) 역할을 붙인다. */
export function parseRadio(raw: string, format?: 'studio' | 'field'): RadioLine[] {
  let t = String(raw ?? '').replace(/```(?:json)?/gi, '').trim();
  const lines: { who: RadioLine['who'] | null; text: string }[] = [];
  const add = (who: unknown, text: unknown) => { const s = typeof text === 'string' ? text.replace(/^[\s*_]+|[\s*_]+$/g, '').trim() : ''; if (s) lines.push({ who: radioRole(who), text: s.slice(0, 300) }); };
  const fromValue = (v: unknown): boolean => {
    if (typeof v === 'string') { try { return fromValue(JSON.parse(v)); } catch { return false; } } // 이중 인코딩된 JSON
    let arr: unknown = v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      arr = o.lines ?? o.script ?? o.dialogue ?? o.dialog ?? o.conversation ?? o.broadcast ?? Object.values(o).find(Array.isArray);
      if (!Array.isArray(arr) && arr && typeof arr === 'object') return fromValue(arr);
    }
    if (!Array.isArray(arr)) return false;
    for (const item of arr) {
      if (typeof item === 'string') { const m = /^\s*\**\s*([^:：]{1,30}?)\s*\**\s*[:：]\s*(.+)$/s.exec(item); if (m) add(m[1], m[2]); else add(null, item); continue; }
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>, keys = Object.keys(o), lower = (k: string) => keys.find((x) => x.toLowerCase() === k);
      const textKey = RADIO_TEXT_KEYS.map(lower).find(Boolean), whoKey = RADIO_WHO_KEYS.map(lower).find(Boolean);
      if (textKey) { add(whoKey ? o[whoKey] : null, o[textKey]); continue; }
      if (keys.length === 1) add(keys[0], o[keys[0]]); // {"announcer": "…"}
    }
    return lines.length > 0;
  };
  const a = t.search(/[[{]/), z = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  let parsed = false;
  for (const candidate of [t, a >= 0 && z > a ? t.slice(a, z + 1) : '']) { if (!candidate || parsed) continue; try { parsed = fromValue(JSON.parse(candidate)); } catch { /* 아래 방식으로 */ } }
  if (!parsed) {
    if (/\\"/.test(t) && !/[^\\]"who"/.test(t)) t = t.replace(/\\"/g, '"'); // 따옴표가 한 번 더 이스케이프된 조각
    const re = /"(?:who|speaker|role)"\s*:\s*"([^"]{1,30})"\s*,\s*"(?:text|line|content)"\s*:\s*"((?:[^"\\]|\\.)*)"|"(?:text|line|content)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"(?:who|speaker|role)"\s*:\s*"([^"]{1,30})"/gi; let m: RegExpExecArray | null;
    while ((m = re.exec(t))) { const who = m[1] ?? m[4], body = m[2] ?? m[3]; let s = body; try { s = JSON.parse('"' + body + '"'); } catch { /* 그대로 */ } add(who, s); }
    if (!lines.length) for (const row of t.split(/\r?\n/)) { const m2 = /^\s*[-*]*\s*\**\s*([^:：*]{1,30}?)\s*\**\s*[:：]\s*(.+)$/.exec(row); if (m2 && radioRole(m2[1])) add(m2[1], m2[2]); }
  }
  const out = lines.slice(0, 8);
  if (format && out.length === 8) { // 두 사람이 번갈아 말하는 대본: 역할 표시가 빠졌거나 어긋났으면 순서로 정한다
    const second = format === 'studio' ? 'cohost' : 'reporter';
    out.forEach((l, i) => { l.who = i % 2 === 0 ? 'announcer' : second; });
  }
  return out.filter((l): l is RadioLine => l.who !== null);
}

/** 네 차례의 왕복 대화가 완성된 경우에만 방송한다. */
export function completeRadio(lines: RadioLine[], format: 'studio' | 'field'): boolean {
  const second = format === 'studio' ? 'cohost' : 'reporter';
  return lines.length === 8 && lines.every((line, i) => line.who === (i % 2 === 0 ? 'announcer' : second) && !!line.text.trim());
}

/** 'YYYY.MM.DD' → 일 수(스텔라리스 달력: 한 달 30일, 한 해 360일). */
const radioDay = dayNo; // F-28: gamedate.ts 와 같은 계산
/** 라디오 연대기 항목의 방송 id(uid 가 없으면 항목 번호로). */
export const chronRadioId = (e: ChronEntry): string => e.uid || `chron:${e.id}`;
/** 라디오 연대기에서 오늘부터 days 일 안의 항목을 오래된 순으로(날짜를 모르는 항목은 뺀다). */
export function recentRadioEntries(items: ChronEntry[], today: string, days = 360): ChronEntry[] {
  const t = radioDay(today); if (t === null) return [];
  return items.filter((e) => { const d = radioDay(e.date); return d !== null && d <= t && d >= t - days; })
    .sort((a, b) => (radioDay(a.date)! - radioDay(b.date)!) || a.id - b.id);
}
/** 라디오를 켤 때 채울 사건: 최근 days 일 중 아직 방송하지 않은 것. */
export function backlogEvents(items: ChronEntry[], today: string, aired: (id: string) => boolean, days = 360): RadioEvent[] {
  return recentRadioEntries(items, today, days).filter((e) => !aired(chronRadioId(e)))
    .map((e) => ({ kind: (e.uid || '').split('|')[0] || 'chron', date: e.date, text: e.text, n: e.id, id: chronRadioId(e) }));
}
/** 새 사건이 없을 때의 "최근 1년 요약 재방송" 재료: 최근 days 일의 마지막 max 건. */
export function recapFacts(items: ChronEntry[], today: string, max = 6, days = 360): string[] {
  return recentRadioEntries(items, today, days).slice(-max).map((e) => `[${e.date}] ${e.text}`);
}

/** 이름·제목을 가르는 낱말(조사 제거, 사건 이름표와 흔한 낱말 제외). */
const FOLLOW_STOP = new Set(['연구', '성과', '기술', '단계', '올랐다', '전통', '선택', '골랐다', '승천', '특전', '통치자', '퇴진', '물러났다', '지도자', '이탈', '명단', '빠졌다', '사망', '은퇴', '확인', '승급', '영입', '고용', '고용됐다', '거대구조물', '완공', '성계', '탐사', '완료', '행성', '조사', '선거', '종료', '끝났다', '전쟁', '개시', '참전', '승리', '패배', '이겼다', '졌다', '종결', '패자', '승자', '첫', '접촉', '서로를', '발견했다', '점령', '소유', '제국', '연설', '국민', '분위기', '만찬', '선물했다', '대보관소', '표본', '요구', '거절했다', '세계', '소식', '관계', '관련',
  // 영어 기록(인터페이스 언어가 영어일 때 쌓인 줄, 2026-10-19)
  'research', 'advanced', 'technology', 'tier', 'tradition', 'adopted', 'new', 'ascension', 'perk', 'chose', 'ruler', 'stepped', 'down', 'left', 'office', 'leader', 'departed', 'roster', 'death', 'retirement', 'not', 'confirmed', 'promoted', 'was', 'recruited', 'newly', 'hired', 'megastructure', 'completed', 'system', 'surveyed', 'planet', 'election', 'over', 'ended', 'war', 'begun', 'joined', 'won', 'lost', 'against', 'the', 'and', 'between', 'first', 'contact', 'discovered', 'each', 'other', 'occupied', 'owner', 'occupier', 'empire', 'about', 'status', 'quo', 'peace', 'with', 'winner', 'neither', 'side', 'has', 'of', 'in', 'an', 'a', 'to', 'for', 'its', 'their']);
/** 라디오 사본 줄 '○○ 관련: x' / 'About ○○: x' 를 [제국, 문장]으로(기록 언어가 둘 중 어느 쪽이든). 아니면 null. */
export const ABOUT_RX = /^(?:(.{1,80}?) 관련|About (.{1,80}?)): (.*)$/;
export function splitAbout(t: string): [string, string] | null { const m = ABOUT_RX.exec(t); return m ? [m[1] ?? m[2], m[3]] : null; }
const PARTICLE = /(?:에서|으로|이라|이며|은|는|이|가|을|를|의|와|과|에|로|도|만)$/;
function followTokens(text: string): Set<string> {
  const body = text.replace(/^[^:]{1,30}:\s*/, ''); const out = new Set<string>(); // 영어 이름표('Megastructure completed:')는 더 길다
  for (const raw of body.split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || /^\d+$/.test(raw)) continue;
    let w = raw; const s = w.replace(PARTICLE, ''); if (s.length >= 2 && s !== w) w = s;
    if (w.length >= 2 && !FOLLOW_STOP.has(w) && !FOLLOW_STOP.has(raw) && !FOLLOW_STOP.has(w.toLowerCase())) out.add(w);
  }
  return out;
}
/** 이번 방송 사건(taken)과 이어지는, 이미 방송한 지난 소식(최대 max 건, 오래된 순). 전쟁 이름·제국·행성·지도자 이름처럼 눈에 띄는 낱말이 겹칠 때만 잇는다. */
export function followUpBackground(taken: RadioEvent[], history: ChronEntry[], today: string, aired: (id: string) => boolean, max = 5, days = 360): string[] {
  if (!taken.length) return [];
  const t = radioDay(today); if (t === null) return [];
  const takenIds = new Set(taken.map((e) => e.id).filter(Boolean) as string[]), takenText = new Set(taken.map((e) => e.text));
  const topics = taken.map((e) => followTokens(e.text));
  const scored: { e: ChronEntry; score: number; day: number }[] = [];
  for (const e of history) {
    const d = radioDay(e.date); if (d === null || d > t || d < t - days) continue;
    const id = chronRadioId(e); if (takenIds.has(id) || takenText.has(e.text) || !aired(id)) continue;
    const et = followTokens(e.text); let best = 0;
    for (const tp of topics) { let s = 0; for (const w of tp) if (et.has(w)) s += w.length; if (s > best) best = s; }
    if (best >= 3) scored.push({ e, score: best, day: d });
  }
  scored.sort((a, b) => b.score - a.score || b.day - a.day);
  return scored.slice(0, max).sort((a, b) => a.day - b.day || a.e.id - b.e.id).map((x) => `[${x.e.date}] ${x.e.text}`);
}
/** 신문 연대기(제국별 기록)에는 있는데 라디오 연대기에 없는 기록을 채울 계획: 최근 days 일, 같은 날 같은 문장은 건너뛴다. */
export function radioMirrorPlan(groups: { idx: number; name: string; items: ChronEntry[] }[], radioItems: ChronEntry[], today: string, radioIdx: number, days = 360): { date: string; text: string; uid: string }[] {
  const t = radioDay(today); if (t === null) return [];
  // 같은 사실은 날짜 표기가 조금 달라도(모드 날짜 vs 앱 날짜) 한 번만: 31일 안에 같은 제국의 같은 문장, 또는 제국 머리 없는 같은 세계 소식이 있으면 건너뛴다.
  // 다른 제국의 같은 문장(예: 둘 다 '식민지 건설')은 서로 다른 사건이라 합치지 않는다. 이번에 넣는 항목도 바로 반영한다(2026-10-18).
  const split = (s: string): [string, string] => { const m = splitAbout(s); return m ? [m[0], m[1].replace(/\s+/g, ' ').trim()] : ['', s.replace(/\s+/g, ' ').trim()]; };
  const seen = new Map<string, number[]>(), byDate = new Map<string, string[]>(), uids = new Set(radioItems.map((e) => e.uid).filter(Boolean) as string[]);
  const remember = (date: string, text: string) => { const d = radioDay(date); if (d !== null) { const [who, body] = split(text), k = who + '|' + body; (seen.get(k) ?? seen.set(k, []).get(k)!).push(d); } (byDate.get(date) ?? byDate.set(date, []).get(date)!).push(text); };
  const near = (k: string, d: number) => (seen.get(k) ?? []).some((x) => Math.abs(x - d) <= 31);
  for (const e of radioItems) remember(e.date, e.text);
  const out: { date: string; text: string; uid: string }[] = [];
  for (const g of groups) {
    if (g.idx === radioIdx) continue;
    for (const e of g.items) {
      if (e.text.startsWith('지도자 사망:')) continue; // 은퇴도 사망으로 적던 옛 줄(신문과 같은 기준으로 거른다)
      const d = radioDay(e.date); if (d === null || d > t || d < t - days) continue;
      const uid = `news|${g.idx}|${e.id}`; if (uids.has(uid)) continue;
      const text = g.idx >= 9000 ? e.text : L(`${g.name} 관련: ${e.text}`, `About ${g.name}: ${e.text}`);
      const body = e.text.replace(/\s+/g, ' ').trim(), who = g.idx >= 9000 ? '' : g.name;
      if (near(who + '|' + body, d) || near('|' + body, d) || (byDate.get(e.date) ?? []).some((h) => h === e.text || h === text || h.endsWith(e.text))) continue;
      out.push({ date: e.date, text, uid }); uids.add(uid); remember(e.date, text);
    }
  }
  return out;
}

/** 세이브별로 이미 방송한 사건 id. 앱 파일에 저장해 라디오를 껐다 켜도 같은 사건을 다시 방송하지 않는다. */
export class RadioAiredStore {
  private data: Record<string, string[]> = {};
  constructor(private file: string, private cap = 3000) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j && typeof j === 'object')
        for (const [k, v] of Object.entries(j)) if (Array.isArray(v)) this.data[k] = v.filter((x) => typeof x === 'string');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        logDiagnostic('warn', 'storage.read_failed', { store: 'radio_aired', file, error });
    } // 없으면 조용히, 깨졌으면 기록을 남기고 빈 기록으로 시작(F-33 B)
  }
  /** 찾기용 집합(배열은 저장 순서용). 대기열 채우기·후속 보도가 연대기 항목마다 부르므로 배열 includes 대신 쓴다(2026-10-18). */
  private sets = new Map<string, Set<string>>();
  private setOf(k: string): Set<string> { let s = this.sets.get(k); if (!s) { s = new Set(this.data[k] ?? []); this.sets.set(k, s); } return s; }
  has(sid: string, id: string): boolean { return this.setOf(sid || 'nosave').has(id); }
  mark(sid: string, ids: string[]): void {
    const k = sid || 'nosave';
    const arr = (this.data[k] ??= []), set = this.setOf(k);
    let changed = false;
    for (const id of ids)
      if (id && !set.has(id)) {
        arr.push(id); set.add(id);
        changed = true;
      }
    if (!changed) return;
    if (arr.length > this.cap) { for (const old of arr.splice(0, arr.length - this.cap)) set.delete(old); }
    try {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (error) {
      logDiagnostic('error', 'storage.write_failed', { store: 'radio_aired', file: this.file, error });
    } // 저장 실패해도 이번 실행 동안은 기억한다. 다시 켜면 같은 사건이 다시 방송될 수 있어 기록을 남김(F-33 B)
  }
}

/** A-15 "지금 듣기" 버튼: 바로 방송을 만들 수 없으면 이유를, 가능하면 null. 연타로 LLM을 반복 호출하지 않도록 직전 방송 뒤 쿨다운을 둔다. */
export const RADIO_NOW_COOLDOWN_MS = 15000;
export function radioNowBlock(s: { on: boolean; busy: boolean; gameRunning: boolean; lastEnd: number; now: number }): string | null {
  if (!s.on) return L('라디오가 꺼져 있습니다.', 'The radio is off.');
  if (s.busy) return L('방송을 준비하는 중입니다.', 'A broadcast is being prepared.');
  if (!s.gameRunning) return L('게임이 실행 중일 때만 방송할 수 있습니다.', 'Broadcasts are only available while the game is running.');
  const left = s.lastEnd + RADIO_NOW_COOLDOWN_MS - s.now;
  if (s.lastEnd > 0 && left > 0) return L(`방금 방송했습니다. ${Math.ceil(left / 1000)}초 뒤에 다시 들을 수 있습니다.`, `Just aired. You can listen again in ${Math.ceil(left / 1000)} s.`);
  return null;
}
/** 라디오가 "게임이 실행 중"으로 볼지. 개발자 시험(src/features/dev-tools.ts)이 켠 우회는 개발자 모드일 때만 통한다. 정상 플레이에서는 gameRunning 그대로. */
export function radioGameLive(gameRunning: boolean, devMode: boolean, devBypass: boolean): boolean { return gameRunning || (devMode && devBypass); }
