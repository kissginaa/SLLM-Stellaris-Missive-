// (실험) AI 가 먼저 보내는 편지. 게임은 매년 연락 중인 제국 목록(MAILC)과 사건(NEWS)만 알려 주고,
// 누가 쓸지 고르기·편지 쓰기·알림은 앱이 한다. 편지는 플레이어가 열 때만 게임에 들어간다(당겨 받기).
import { SllmMessage } from './protocol';
import { Profile, TalkContext, systemPrompt, stance, paperBlock } from './prompt';
import { ChatMessage } from './player2';
import { Action } from './action';
import { L } from './i18n-pick';
import { SYSTEM_PREFIX } from './transcript';

export interface MailCountry { idx: number; name: string; op: number; profile: Profile }
export interface News { kind: string; date: string; a?: number; aname?: string; b?: number; bname?: string; war?: string; ruler?: string; /** 전쟁 시작(2026-11-09): 이 나라가 공격 측(선전포고한 쪽)인지 방어 측인지. 옛 기록·옛 모드는 없음 */ side?: 'att' | 'def'; /** 행성 주인 바뀜(2026-10-28): 행성 이름 · 전쟁 중(war)인지 거래·할양(deal)인지 */ planet?: string; via?: 'war' | 'deal'; /** 실시간 신문 소식(2026-11-10): 거대 구조물 이름·성계/행성 이름·새 정부 이름·사로잡힌 지도자 */ what?: string; where?: string; gov?: string; leader?: string }
export interface Writer { idx: number; why: string; month: number }
export interface Letter {
  id: number; idx: number; name: string; date: string; text: string;
  sourceId?: string;
  proposal: Action | null; expires: string; read: boolean;
}

const FLAG_KEYS = ['war', 'truce', 'rival', 'hostile', 'unfriendly', 'friendly', 'fed', 'nap', 'def'];
// 편지에 붙일 수 있는 제안(선전포고·평화는 편지로 하지 않는다)
export const LETTER_ACTIONS = new Set(['give_energy', 'take_energy', 'open_borders']);

/** SLLM:MAILC 줄 → 제국 정보. 관계 플래그는 플레이어를 향한 것. */
export function mailCountryFrom(m: SllmMessage): MailCountry | null {
  if (m.kind !== 'MAILC') return null;
  const idx = Number(m.kv.idx);
  if (!Number.isFinite(idx) || idx <= 0) return null;
  const g = (k: string) => (m.kv[k] ?? '').trim();
  const flags: Record<string, boolean> = {};
  for (const k of FLAG_KEYS) flags[k] = Number(m.kv[k]) > 0;
  const op = Number(m.kv.op);
  return {
    idx, name: g('name'), op: Number.isFinite(op) ? Math.round(op) : 0,
    profile: { gov: g('gov'), species: g('species'), personality: g('personality'), origin: g('origin'), ruler: g('ruler'), title: g('title'), home: g('home'), att: 0, organ: g('organ'), adj: g('adj'), flags, cls: Number(m.kv.cls) || 0 },
  };
}

/** 게임이 이름 대신 번역 키(NAME_dead_leader_country 같은 것)를 그대로 보낸 나라: 해적·이미 사라진 나라 같은 게임 내부 나라라 사건으로 다루지 않는다(2026-10-19 호외에 키가 그대로 나온 문제). */
export const RAW_NAME_KEY = /(^|\s)NAME_[A-Za-z0-9_]+/;
/** SLLM:NEWS 줄 → 사건. */
export function newsFrom(m: SllmMessage): News | null {
  if (m.kind !== 'NEWS' || !m.kv.kind) return null;
  const num = (k: string) => { const n = Number(m.kv[k]); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const g = (k: string) => (m.kv[k] ?? '').trim() || undefined;
  const n: News = { kind: m.kv.kind, date: g('date') ?? '', a: num('a'), aname: g('aname'), b: num('b'), bname: g('bname'), war: g('war'), ruler: g('ruler') };
  if (n.kind === 'war' && (m.kv.side === 'att' || m.kv.side === 'def')) n.side = m.kv.side;
  if (n.kind === 'planet') { n.planet = g('planet'); n.via = m.kv.via === 'war' ? 'war' : 'deal'; if (!n.planet || RAW_NAME_KEY.test(n.planet)) return null; }
  for (const k of ['what', 'where', 'gov', 'leader'] as const) { const v = g(k); if (v && !RAW_NAME_KEY.test(v)) n[k] = v.slice(0, 80); } // 실시간 신문 소식(sllm_news_events)
  if ((n.kind === 'mega' && !n.what) || ((n.kind === 'bombed' || n.kind === 'captured') && !n.where && !n.leader)) return null;
  if ((n.kind === 'battle' && !n.leader) || ((n.kind === 'arch' || n.kind === 'bomb_start' || n.kind === 'bomb_dead') && !n.where)) return null; // 2026-11-10 전투 승리·고고학·궤도 폭격
  if (RAW_NAME_KEY.test(n.aname ?? '') || RAW_NAME_KEY.test(n.bname ?? '')) return null;
  // 현상 유지는 게임이 양쪽에서 한 번씩 부를 수 있다 → 두 나라 순서를 이름순으로 맞춰 같은 사건으로 만든다(2026-10-18)
  if (n.kind === 'war_sq' && (n.aname ?? '') > (n.bname ?? '')) { [n.a, n.b] = [n.b, n.a]; [n.aname, n.bname] = [n.bname, n.aname]; }
  return n;
}

/** AI 끼리의 일 중 연대기와 신문에 남길 큰 사건인가(전쟁·연방·연합·협정·위기·멸망·조공국화). 플레이어가 낀 일은 이 기준과 상관없이 늘 남긴다. */
/** 플레이어가 아는(통신이 있는) 나라인지(2026-11-10 사용자 제보: 게임 초반 접촉도 없는데 신문에 은하 판세·남의 나라 멸망이 나옴).
 *  countries = 해마다 통신 있는 AI 제국 목록(MAILC), contacts = 통신 단말기 목록(열었을 때). 번호가 없으면 이름으로. */
export function knownEmpire(idx: number | undefined, name: string | undefined, countries: Map<number, { name: string }>, contacts: ReadonlyArray<{ idx: number; name: string }>): boolean {
  if (idx !== undefined && idx > 0 && (countries.has(idx) || contacts.some((c) => c.idx === idx))) return true;
  if (name && ([...countries.values()].some((c) => c.name === name) || contacts.some((c) => c.name === name))) return true;
  return false;
}
/** 접촉과 상관없이 온 은하가 아는 사건(위기 시작·은하 공동체 창설). */
export const GALAXY_WIDE = new Set(['crisis', 'galcom']);
export const MAJOR_WORLD = new Set(['war', 'war_end', 'war_sq', 'war_won', 'planet', 'fed_join', 'fed_leave', 'ally_join', 'ally_leave', 'pact_com', 'pact_def', 'destroyed', 'subject', 'crisis', 'mega', 'gov', 'captured', 'bombed', 'fed_lead', 'galcom', 'battle', 'arch', 'bomb_start', 'bomb_dead']); // 뒤 열: 실시간 신문 소식(2026-11-10)
/** 한 나라만 나오는 사건(우리 나라 일이어도 연대기에 남긴다). */
export const SOLO_NEWS = new Set(['mega', 'gov', 'bombed', 'fed_lead', 'galcom', 'ruler', 'crisis', 'destroyed', 'arch']);
/** 라디오 대기열에 넣지 않는 세계 사건(2026-10-28 X4 참고: 라디오는 큰 것만 — 행성 하나하나의 주인 바뀜은 신문에서 묶어 다룬다). */
export const NOT_ON_RADIO = new Set(['planet', 'mega', 'gov', 'captured', 'bombed', 'fed_lead', 'galcom', 'battle', 'arch', 'bomb_start', 'bomb_dead']); // 실시간 신문 소식은 라디오가 따로 받는다(우리 일은 라디오 EVT)
/** 사건을 한 문장으로(기록 당시 인터페이스 언어 — 연대기·호외에 그대로 쌓이고 AI 에게도 간다, 2026-10-19). */
export function newsText(n: News): string {
  const a = n.aname ?? L('어느 제국', 'an empire'), b = n.bname ?? L('어느 제국', 'an empire');
  switch (n.kind) {
    case 'war': return n.side === 'att' ? L(`전쟁 "${n.war ?? '?'}": ${a}이(가) 공격 측(선전포고한 쪽)으로 참전했다`, `War "${n.war ?? '?'}": ${a} joined on the attacking side (declared the war)`)
      : n.side === 'def' ? L(`전쟁 "${n.war ?? '?'}": ${a}이(가) 방어 측(선전포고를 받은 쪽)으로 참전했다`, `War "${n.war ?? '?'}": ${a} joined on the defending side (was declared on)`)
      : L(`전쟁 "${n.war ?? '?'}": ${a}이(가) 참전했다`, `War "${n.war ?? '?'}": ${a} joined`); // 앞머리를 전쟁 이름으로 두어 참전국들을 한 사건으로 묶을 수 있게 한다(galnews.mergeWarFacts)
    case 'war_end': return L(`${a}과(와) ${b}의 전쟁이 끝났다(승패 미확인 — 현상 유지 강화일 수도 있다)`, `The war between ${a} and ${b} ended (outcome unknown - possibly a status quo peace)`); // on_war_ended 는 백지평화에도 불린다(2026-10-18)
    case 'war_sq': return L(`${a}과(와) ${b}이(가) 현상 유지 강화로 전쟁을 끝냈다(승패 없음)`, `${a} and ${b} ended their war with a status quo peace (no winner)`);
    case 'war_won': return L(`${a}이(가) ${n.war ? `전쟁 "${n.war}"에서 ` : ''}${b}에게 이겼다`, `${a} won ${n.war ? `the war "${n.war}" ` : 'the war '}against ${b}`);
    case 'planet': return n.via === 'war' ? L(`${a}이(가) ${b}의 행성 ${n.planet ?? '?'}을(를) 차지했다`, `${a} took the planet ${n.planet ?? '?'} from ${b}`) : L(`행성 ${n.planet ?? '?'}이(가) ${b}에서 ${a}(으)로 넘어갔다`, `The planet ${n.planet ?? '?'} passed from ${b} to ${a}`); // galnews.mergePlanetFacts 가 같은 두 나라 줄을 묶는다
    case 'ruler': return L(`${a}에 새 지도자 ${n.ruler ?? '?'}이(가) 올랐다`, `${a} has a new leader, ${n.ruler ?? '?'}`);
    case 'fed_join': return L(`${a}이(가) ${b}이(가) 이끄는 연방에 가입했다`, `${a} joined the federation led by ${b}`);
    case 'fed_leave': return L(`${a}이(가) ${b}이(가) 이끄는 연방을 떠났다`, `${a} left the federation led by ${b}`);
    case 'pact_com': return L(`${a}과(와) ${b}이(가) 통상 협정을 맺었다`, `${a} and ${b} signed a commercial pact`);
    case 'pact_def': return L(`${a}과(와) ${b}이(가) 방위 협정을 맺었다`, `${a} and ${b} signed a defensive pact`);
    case 'ally_join': return L(`${a}과(와) ${b}이(가) 연합(동맹)을 맺었다`, `${a} and ${b} formed an alliance`);
    case 'ally_leave': return L(`${a}과(와) ${b}의 연합(동맹)이 깨졌다`, `The alliance between ${a} and ${b} broke up`);
    case 'destroyed': return L(`${a}이(가) 멸망했다${n.bname ? '(' + b + '에 의해)' : ''}`, `${a} was destroyed${n.bname ? ' (by ' + b + ')' : ''}`);
    case 'subject': return L(`${a}이(가) ${b}의 조공국(속국)이 되었다`, `${a} became a subject of ${b}`);
    case 'crisis': return L(`${a}: 은하 위기가 시작되었다`, `${a}: a galactic crisis has begun`);
    // 실시간 신문 소식(2026-11-10, 모드 sllm_news_events)
    case 'mega': return L(`${a}이(가) ${n.where ? n.where + ' 성계에 ' : ''}거대 구조물 「${n.what ?? '?'}」을(를) 완공했다`, `${a} completed the megastructure "${n.what ?? '?'}"${n.where ? ' in the ' + n.where + ' system' : ''}`);
    case 'gov': return n.gov ? L(`${a}이(가) 정부를 「${n.gov}」(으)로 개편했다`, `${a} reformed its government into "${n.gov}"`) : L(`${a}이(가) 정부 형태를 바꿨다`, `${a} changed its form of government`);
    case 'captured': return L(`${a}이(가) ${n.where ? n.where + ' 성계에서 ' : ''}${b}의 지도자 ${n.leader ?? '?'}을(를) 사로잡았다`, `${a} captured ${b}'s leader ${n.leader ?? '?'}${n.where ? ' in the ' + n.where + ' system' : ''}`);
    case 'bombed': return L(`${a}의 폭격으로 행성 ${n.where ?? '?'}의 식민지가 사라졌다`, `${a}'s bombardment wiped out the colony on ${n.where ?? '?'}`);
    case 'fed_lead': return L(`${a}이(가) 연방 의장국이 되었다`, `${a} became the president of its federation`);
    case 'galcom': return L(`은하 공동체가 창설되었다(첫 회원국: ${a})`, `The Galactic Community was founded (first member: ${a})`);
    // 2026-11-10 전투 승리·고고학·궤도 폭격(모드 sllm_news.7~10)
    case 'battle': return L(`제독 ${n.leader ?? '?'}이(가) 이끄는 ${a}의 ${n.what ? '「' + n.what + '」 ' : ''}함대가 ${b}의 함대를 격파했다`, `${a}'s ${n.what ? '"' + n.what + '" ' : ''}fleet under Admiral ${n.leader ?? '?'} defeated a fleet of ${b}`);
    case 'arch': return L(`${a}${n.leader ? '의 과학자 ' + n.leader + '이(가)' : '이(가)'} 고고학 유적 「${n.where ?? '?'}」의 발굴을 마쳤다`, `${n.leader ? a + "'s scientist " + n.leader : a} finished excavating the archaeological site "${n.where ?? '?'}"`);
    case 'bomb_start': return L(`${a}이(가) ${b}의 행성 ${n.where ?? '?'}에 궤도 폭격을 시작했다`, `${a} began an orbital bombardment of ${b}'s planet ${n.where ?? '?'}`);
    case 'bomb_dead': return L(`${a}의 궤도 폭격으로 ${b}의 행성 ${n.where ?? '?'}에서 사상자가 나왔다`, `${a}'s orbital bombardment caused casualties on ${b}'s planet ${n.where ?? '?'}`);
    default: return `${a}: ${n.kind}`;
  }
}

/** 이 제국과 관련된 사건인가(번호 또는 이름으로). */
export function involves(n: News, c: { idx: number; name: string }): boolean {
  return n.a === c.idx || n.b === c.idx || n.aname === c.name || n.bname === c.name;
}

// F-28: 날짜 계산은 gamedate.ts 한 곳에(옛 이름은 그대로 내보냄)
export { addYears, cmpDate } from './gamedate';
export function monthOf(date: string): number {
  const m = /^\d+\.(\d+)\./.exec(date.trim());
  return m ? Number(m[1]) : 0;
}

/** 1단계: 올해 편지를 쓸 제국 고르기(한 번의 호출). */
export function pickMessages(player: string, date: string, countries: MailCountry[], news: News[], paper?: string[]): ChatMessage[] {
  const rows = countries.map((c) => {
    const ctx: TalkContext = { idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: c.profile };
    const rel = Object.entries(c.profile.flags).filter(([, v]) => v).map(([k]) => k).join(',') || 'none';
    const ev = news.filter((n) => involves(n, c)).map(newsText);
    return `- id ${c.idx}: ${c.name} / personality ${c.profile.personality || '?'} / government ${c.profile.gov || '?'} / attitude toward the player ${stance(ctx)} (score ${c.op}) / relations ${rel} / related events this year: ${ev.length ? ev.join('; ') : 'none'}`;
  });
  const sys = [
    'You are the diplomatic editor of a space strategy game. Decide whether each AI empire has a reason to send the player empire a diplomatic letter this year on its own initiative.',
    'Pick only empires with a clear reason: their relations changed, a related event happened, or their personality gives them something to say. If they have nothing to say, do not pick them. If nobody qualifies, return an empty list.',
    'Answer with exactly one JSON: {"writers":[{"idx":id number,"why":"one sentence: why they write"}]}',
  ].join('\n');
  const user = `Date: ${date}\nPlayer empire: ${player}\nEmpires:\n${rows.join('\n')}\n\nAll events:\n${news.map((n) => '- ' + n.date + ' ' + newsText(n)).join('\n') || '- none'}` + (paper && paper.length ? `\n\nRecent galactic news (read by every empire; an empire named in an article, or one sensitive to it, may have a reason to write):\n${paper.join('\n')}` : '');
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

/** 고르기 답을 해석한다. 목록에 없는 번호는 버리고, 도착 달을 1~12 중에서 흩는다. */
export function parsePick(raw: string, allowed: number[], rand: () => number = Math.random): Writer[] {
  let obj: any = null;
  try { obj = JSON.parse(raw); } catch {
    const m = /\{[\s\S]*\}/.exec(raw);
    if (m) { try { obj = JSON.parse(m[0]); } catch { obj = null; } }
  }
  const list: any[] = Array.isArray(obj?.writers) ? obj.writers : [];
  const seen = new Set<number>();
  const out: Writer[] = [];
  for (const w of list) {
    const idx = Number(w?.idx);
    if (!allowed.includes(idx) || seen.has(idx)) continue;
    seen.add(idx);
    out.push({ idx, why: String(w?.why ?? '').slice(0, 200), month: 1 + Math.floor(rand() * 12) });
  }
  return out;
}

/** 2단계: 한 제국의 편지 쓰기. 같은 대화 형식(JSON)을 쓰고, 이번만 편지 길이로 쓰게 한다. */
export function letterMessages(player: string, date: string, c: MailCountry, why: string, news: News[], paper?: string[]): ChatMessage[] {
  const ctx: TalkContext = { idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: c.profile, ...(paper && paper.length ? { galnews: paper } : {}) };
  const ev = news.filter((n) => involves(n, c)).map((n) => '- ' + n.date + ' ' + newsText(n));
  const user = [
    `${SYSTEM_PREFIX}It is now ${date}. This time they did not speak to you; you are sending ${player} a diplomatic letter first.`,
    `Why you write: ${why || 'you have something to say given your personality and relations'}`,
    ev.length ? `Recent related news:\n${ev.join('\n')}` : 'Recent related news: none',
    'For this reply only, write say as a 3-6 sentence letter instead of the two-sentence limit. Open with a short greeting and sign off with your title and name.',
    'Leave mood as none. Do not declare war or propose peace by letter. Use one of give_energy, take_energy or open_borders as the action only when an offer feels natural.',
  ].join('\n');
  return [{ role: 'system', content: systemPrompt(ctx) }, { role: 'user', content: user }];
}

/** 조약 얼버무리기의 서신: 대화에서 "의원들과 논의해 서신으로 알리겠다"고 한 일의 결과를, 그때의 속마음(lean)대로 알린다. */
export function treatyLetterMessages(player: string, date: string, c: MailCountry, topic: string, lean: 'positive' | 'neutral' | 'negative', news: News[]): ChatMessage[] {
  const ctx: TalkContext = { idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: c.profile };
  const ev = news.filter((n) => involves(n, c)).map((n) => '- ' + n.date + ' ' + newsText(n));
  const verdict = lean === 'positive'
    ? 'The conclusion is favorable. Say you discussed it with your councilors and looked on it kindly, but make clear this letter does not conclude the treaty and that a formal proposal should be sent through the diplomacy window.'
    : lean === 'negative'
      ? 'The conclusion is unfavorable. In keeping with your personality (politely or coldly), say you cannot accept it now. Do not invent new facts or reasons; base it on your relations and personality.'
      : 'You have not reached a conclusion yet. Say you discussed it but will watch a while longer. Do not invent specific conditions or facts.';
  const user = [
    `${SYSTEM_PREFIX}It is now ${date}. Earlier, when ${player} asked for "${topic}", you promised to discuss it with your councilors and answer by letter. Now you write that letter.`,
    verdict,
    ev.length ? `Recent related news:\n${ev.join('\n')}` : 'Recent related news: none',
    'For this reply only, write say as a 3-6 sentence letter instead of the two-sentence limit. Open with a short greeting and sign off with your title and name.',
    'Leave mood as none and action as {"type":"none"}. Do not write that the treaty has already been concluded.',
  ].join('\n');
  return [{ role: 'system', content: systemPrompt(ctx) }, { role: 'user', content: user }];
}

/** 올해의 편지 일정. MONTH 신호마다 그 달에 도착할 편지를 꺼낸다. */
export class MailPlan {
  private writers: Writer[] = [];
  private year = '';
  set(yearDate: string, writers: Writer[]) { this.year = yearDate; this.writers = writers.slice(); }
  /** date 의 달이 된(또는 지난) 편지를 꺼낸다. 해가 바뀌었으면 남은 것을 모두 꺼낸다. */
  due(date: string): Writer[] {
    if (!this.writers.length) return [];
    const sameYear = this.year && date.split('.')[0] === this.year.split('.')[0];
    const mon = monthOf(date);
    const now = this.writers.filter((w) => !sameYear || w.month <= mon);
    this.writers = this.writers.filter((w) => !now.includes(w));
    return now;
  }
  /** 실시간 타이머용: 순서와 상관없이 가장 먼저 잡힌 편지 하나. */
  takeOne(): Writer | null { return this.writers.shift() ?? null; }
  /** 해마다 정한 편지 말고 따로 끼워 넣는 편지(감정 기억, 2026-10-25 알파 11). 같은 나라가 이미 줄에 있으면 넣지 않는다. */
  add(w: Writer): boolean { if (this.writers.some((x) => x.idx === w.idx)) return false; this.writers.push(w); return true; }
  get size() { return this.writers.length; }
}
