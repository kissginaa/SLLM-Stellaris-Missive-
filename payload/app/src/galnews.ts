import { logDiagnostic } from './diagnostics';
// 은하 뉴스: 해마다 제국별 연대기에 쌓인 사실로 신문 한 호를 만든다. 연대기에 없는 일은 쓰지 않는다.
// 엿들은 소문(게임 사실이 아님)은 재료가 아니다. 되감기(시간선)를 따라가도록 호마다 분기 번호를 둔다.
import * as fs from 'fs';
import { ChatMessage } from './player2';
import { cmpDate } from './mail';
import type { ChronEntry } from './chronicle';

export interface Article { title: string; body: string; comment?: string; reporter?: string; /** 사진(ui/news/photos 의 파일 이름, 2026-11-10 사진 먼저) */ photo?: string; /** 사진 설명(LLM 이 그 사진에 맞춰 씀) */ caption?: string }
export interface Issue { id: number; sid: string; date: string; headline: string; articles: Article[]; briefs: string[]; branch?: number; paper?: number; extra?: boolean; /** 지면 광고 사진(ui/news/photos, 독자 제국 종족 비율로, 2026-11-10). 없으면 종족 없는 인쇄 광고 */ ad?: string; /** 홈페이지 분야 탭 기사(탭 → 기사, 빈 배열 = 그 분야 소식 없음, 2026-11-10) */ sections?: Record<string, Article[]> } // extra: 호외(한 줄 기사 한 건짜리 속보)
/** 신문사. 해마다 이 중 하나를 무작위로 고른다(LLM 을 쓰지 않는다). tone 은 글의 어조 지시다. */
export interface Paper { name: string; sub: string; wire: string; bg: string; ink: string; accent: string; tone: string; slant: string; comments: boolean; briefsFact: boolean } // briefsFact: 한 줄 소식도 사실만 쓰는 신문사
export const PAPERS: Paper[] = [
  { briefsFact: false, name: '성간일보', sub: 'INTERSTELLAR TIMES · 별빛 너머의 소식', wire: '성간 통신망 STN 제휴', bg: '#ece3cd', ink: '#1d1a14', accent: '#8a2a1c', comments: true,
    tone: '차분하고 격식 있는 정통 일간지 문체',
    slant: '보수적인 신문입니다. 평화주의적인 행보와 외계 종족에 우호적인 행보(예: 다른 종족이 많은 제국과의 동맹·협정)에는 비관적이고 우려하는 논조로 쓰고, 플레이어 제국의 군사적 행동에는 찬성하는 논조로 씁니다. 외계 종족에 배타적인 시각을 드러내되 욕설이나 모욕 표현은 쓰지 않습니다. 사실 자체를 바꾸지는 않고 평가와 어조에만 반영합니다.' },
  { briefsFact: false, name: '별무리 속보', sub: 'STARCLUSTER FLASH · 지금 이 순간의 은하', wire: '별무리 속보국', bg: '#dde7ec', ink: '#13202a', accent: '#0a5c8a', comments: true,
    tone: '핵심부터 쓰는 속보 문체이되 짧지 않고 충분히 설명한다',
    slant: '진보적인 신문입니다. 평화주의적이고 외계 종족에 우호적인 행보는 환영하고, 외계 종족에 배타적인 사건과 전쟁에는 비관적·비판적인 논조로 씁니다. 때로는 외계 종족 친화적인 발언을 거리낌 없이 합니다. 사실 자체를 바꾸지는 않고 평가와 어조에만 반영합니다.' },
  { briefsFact: true, name: '공허 통신', sub: 'VOID WIRE · 아무도 말하지 않는 것', wire: '공허 통신 특파원단', bg: '#dcd5c4', ink: '#221c28', accent: '#6a2a8a', comments: false,
    tone: '냉소적이고 날카로운 시사 주간지 문체',
    slant: '중립적인 신문입니다. 어느 편도 들지 않고 사실을 가장 정확하게 씁니다. 기자의 의견은 싣지 않고 사실만 씁니다.' },
];
/** 프롬프트용 영어 문체·성향(기본 신문사 글일 때만 바꾼다. 사용자가 고친 페르소나는 그대로 보낸다 — 2026-10-19 프롬프트 영어화). */
const PAPER_PROMPT_EN: Record<string, string> = {
  [PAPERS[0].tone]: 'calm, formal style of a traditional daily newspaper',
  [PAPERS[0].slant]: 'A conservative newspaper. It writes pessimistically and with concern about pacifist moves and alien-friendly moves (e.g. alliances or pacts with empires of many species), and approvingly about the player empire\'s military actions. It shows a xenophobic view but never uses slurs or insults. It never changes the facts themselves; the leaning shows only in judgments and tone.',
  [PAPERS[1].tone]: 'breaking-news style that leads with the key point, yet explains fully rather than tersely',
  [PAPERS[1].slant]: 'A progressive newspaper. It welcomes pacifist and alien-friendly moves, and writes pessimistically and critically about xenophobic events and wars. At times it speaks openly in favor of aliens. It never changes the facts themselves; the leaning shows only in judgments and tone.',
  [PAPERS[2].tone]: 'cynical, sharp style of a current-affairs weekly',
  [PAPERS[2].slant]: 'A neutral newspaper. It takes no side and reports the facts as accurately as possible. It prints no reporter opinions, only facts.',
  '아래 페르소나에 지정된 문체와 관점을 따릅니다.': 'Follow the style and viewpoint given in the persona below.',
};
/** 프롬프트에 넣을 문체·성향(기본 글이면 영어로, 사용자 글이면 그대로). */
export const paperPrompt = (p: Paper): { tone: string; slant: string } => ({ tone: PAPER_PROMPT_EN[p.tone] ?? p.tone, slant: PAPER_PROMPT_EN[p.slant] ?? p.slant });
export const REPORTERS = ['오르비스 카엘', '세렌 도하', '마르쿠 벨', '이사 노르윈', '타리 쿤', '레베카 오스', '둔 하르마', '넬 이시다'];
/** 직전 호와 다른 신문사 번호를 고른다. */
export function pickPaper(last: number | undefined, rnd: () => number = Math.random, enabled?: boolean[]): number {
  const on = PAPERS.map((_, i) => i).filter((i) => !enabled || enabled[i] !== false);
  if (!on.length) return -1;
  const pool = on.filter((i) => i !== last);
  const use = pool.length ? pool : on; // 켜진 신문사가 하나뿐이면 계속 그곳
  return use[Math.min(use.length - 1, Math.floor(rnd() * use.length))];
}
/** 기사마다 기자 이름을 붙인다(같은 호 안에서 겹치지 않게). */
export function assignReporters(articles: Article[], seed: number): Article[] {
  return articles.map((a, i) => ({ ...a, reporter: REPORTERS[(seed + i * 3) % REPORTERS.length] }));
}
export interface Fact { date: string; text: string; who: string }

/** 한 호의 기사 수 상한(2026-10-17 사용자 확정: 항상 최대 3건). */
export const MAX_ARTICLES = 3;
export const MIN_FACTS = 0; // 사실이 없어도 "조용한 한 해" 호를 낸다
export const FEW_FACTS = 3;

export class IssueStore {
  private data: { next: number; items: Issue[] } = { next: 1, items: [] };
  constructor(private file: string, private branchOf: (sid: string) => number) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j && Array.isArray(j.items)) this.data = { next: Number(j.next) || 1, items: j.items };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        logDiagnostic('warn', 'storage.read_failed', { store: 'newspaper', file, error });
    }
  }
  // 쓰다가 꺼져도 지난 신문이 다 사라지지 않게 임시 파일에 쓴 뒤 바꾼다(2026-10-18)
  private save(): void { try { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8'); fs.renameSync(tmp, this.file); } catch(error) { logDiagnostic('error','storage.write_failed',{store:'newspaper',file:this.file,error}); } }
  list(sid: string): Issue[] { return this.data.items.filter((i) => i.sid === sid); }
  /** 같은 날짜의 호가 이 시간선에 이미 있는가. */
  has(sid: string, date: string): boolean { const br = this.branchOf(sid); return this.data.items.some((i) => i.sid === sid && !i.extra && i.date === date && (i.branch ?? 1) === br); } // 호외는 정기 호와 날짜가 겹쳐도 막지 않는다
  /** 이 시간선에서 그 해(YYYY)에 낸 호외 수 */
  extraCount(sid: string, year: string): number { const br = this.branchOf(sid); return this.data.items.filter((i) => i.sid === sid && i.extra && i.date.slice(0, 4) === year && (i.branch ?? 1) === br).length; }
  add(sid: string, date: string, body: { headline: string; articles: Article[]; briefs: string[]; ad?: string }, paper = 0, extra = false): Issue {
    const id = this.data.next++;
    const it: Issue = { id, sid, date, ...body, articles: assignReporters(body.articles, id), paper, branch: this.branchOf(sid), ...(extra ? { extra: true } : {}) };
    if (!it.ad) delete it.ad;
    this.data.items.push(it); while (this.data.items.length > 200) this.data.items.shift();
    this.save(); return it;
  }
  /** 홈페이지 분야 탭 기사를 그 호에 붙인다(한 번 만들면 다시 만들지 않는다). */
  setSection(id: number, tab: string, arts: Article[]): Issue | null {
    const it = this.data.items.find((i) => i.id === id); if (!it) return null;
    it.sections = { ...(it.sections || {}), [tab]: assignReporters(arts, id * 10 + Object.keys(it.sections || {}).length + 1) };
    this.save(); return it;
  }
}

/** 홈페이지 실시간 소식(2026-11-10 사용자: 「속보는 연대기 줄 그대로, 보려고 누르면 그때 LLM」): 누른 사건 하나로 쓴 온라인 기사. 세이브·시간선별로 저장. */
export interface LiveStory { sid: string; key: string; date: string; fact: string; article: Article; paper: number; branch?: number }
export const liveKey = (f: { date: string; text: string }): string => f.date + '|' + f.text;
/** 분야 탭 기사를 호에 저장할 이름: 그 호를 낸 신문사면 탭 이름 그대로, 다른 신문사 홈페이지면 「탭#신문사」 */
export const sectionKey = (tab: string, paper: number | undefined, issuePaper: number | undefined): string => (paper === undefined || paper === (issuePaper ?? 0) ? tab : tab + '#' + paper);
export class LiveStore {
  private items: LiveStory[] = [];
  constructor(private file: string, private branchOf: (sid: string) => number) {
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (Array.isArray(j?.items)) this.items = j.items; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'news_live', file, error }); }
  }
  private save(): void { try { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ items: this.items }), 'utf8'); fs.renameSync(tmp, this.file); } catch (error) { logDiagnostic('error', 'storage.write_failed', { store: 'news_live', file: this.file, error }); } }
  /** 지금 시간선의 기사(최신순) */
  list(sid: string): LiveStory[] { const br = this.branchOf(sid); return this.items.filter((s) => s.sid === sid && (s.branch ?? 1) === br).slice().reverse(); }
  /** paper 를 주면 그 신문사가 쓴 기사만(2026-11-10: 신문사 홈페이지마다 같은 사건을 따로 쓴다) */
  get(sid: string, key: string, paper?: number): LiveStory | undefined { return this.list(sid).find((s) => s.key === key && (paper === undefined || (s.paper ?? 0) === paper)); }
  add(s: Omit<LiveStory, 'branch'>): LiveStory {
    const it: LiveStory = { ...s, article: assignReporters([s.article], s.key.length + s.date.length)[0], branch: this.branchOf(s.sid) };
    this.items.push(it); while (this.items.length > 300) this.items.shift(); this.save(); return it;
  }
}

/** 호외가 될 만한 큰 사건 종류와 우선순위(클수록 먼저). 한 달에 하나, 한 해에 설정한 횟수까지만 낸다. */
export const EXTRA_KINDS: Record<string, number> = { destroyed: 5, war: 4, crisis: 4, subject: 3, war_end: 3, war_sq: 3, scandal: 3, expel: 3, festival: 2, festival_outrage: 3 }; // festival·festival_outrage: 세계의 축제 개막·인파 사고(알파 11, 2026-10-25) // expel: 대사 추방(2026-10-20) // scandal: 비방 공작 추문(2026-10-20)
/** 호외: 사건 한 건을 헤드라인 한 줄과 기사 한 건으로만 쓴다(나머지 지면은 화면에서 가짜 글씨로 채운다). */
/** 전쟁 편 가르기 규칙(2026-11-09 테스터 신고): 방어 측을 선전포고한 쪽처럼 쓰지 않는다. 신문·호외 공통. */
export const WAR_SIDE_RULE = 'If a fact says an empire joined a war on the attacking side or the defending side, keep the sides straight: the attacking side declared the war; never write that an empire on the defending side declared, started, chose or decided to enter that war (it was declared on and had to fight). If the side is not given, do not guess who started the war.';
/** 사진 먼저(2026-11-10): 앱이 고른 사진 후보를 보여 주고, 기사마다 맞는 사진 하나와 그 사진에 맞는 설명을 쓰게 한다. */
export const PHOTO_RULE = 'Photos: the newspaper already has the photos listed under "Photos" (each with a description of exactly what it shows). For each article you may attach at most one photo whose subject matches that article, by its id (e.g. "P1"); never use one photo twice; use "" when none fits. When you attach a photo, also write "caption": one short photo caption (under about 60 characters) in the same language as the article, describing what is visible in that photo as part of this story (who/where, as the facts allow). Never describe things the photo does not show and never invent facts. The lead article should get a photo if any fits.';
export function extraMessages(player: string, date: string, fact: string, paper: Paper = PAPERS[0], info: string[] = [], photo = ''): ChatMessage[] {
  const pp = paperPrompt(paper);
  const system = [
    `You are the editor of the newspaper "${paper.name}". You are writing a one-page extra (breaking news) edition dated ${date}. Style: ${pp.tone}. The reader is the leader of ${player}.`,
    `The newspaper's leaning: ${pp.slant}`,
    `Write only about the single "Event" below. Do not invent events, numbers, people or reasons. "We/our" in the text means ${player} (write ${player} by name in the article).`,
    WAR_SIDE_RULE,
    paper.comments ? 'You may add one sentence of the reporter\'s subjective opinion at the end of the article body.' : 'Write facts only; add no opinion.',
    photo ? 'The extra runs one photo that shows: ' + photo + ' Write "caption": one short photo caption (under about 60 characters) in the same language as the article, describing what is visible in that photo as part of this story. Never describe things the photo does not show.' : '',
    'Reply with one JSON only: {"headline":"one-line extra headline","title":"article title","body":"two or three sentences"' + (photo ? ',"caption":"photo caption"' : '') + '}',
  ].filter(Boolean).join('\n');
  const user = (info.length ? 'Related empire information (for judging tone only; do not report it as fact):\n' + info.join('\n') + '\n\n' : '') + 'Event:\n- ' + fact;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
export function parseExtra(raw: string): { headline: string; articles: Article[]; briefs: string[] } | null {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s < 0 || e <= s) return null;
  let o: any; try { o = JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const headline = str(o?.headline, 120), body = str(o?.body, 500), title = str(o?.title, 80) || headline, caption = str(o?.caption, 90);
  if (!headline || !body) return null;
  return { headline, articles: [{ title, body, ...(caption ? { caption } : {}) }], briefs: [] };
}

/** 제국별 연대기 묶음에서 since 이후의 사실을 모은다(세계 소식은 같은 날짜·같은 문장을 한 번만, 제국별 기록은 제국마다). */
export function collectFacts(groups: Array<{ name: string; items: ChronEntry[] }>, since: string, max = 40, until = ''): Fact[] {
  const seen = new Set<string>(); const out: Fact[] = [];
  for (const g of groups) for (const e of g.items) {
    if (!e.date || cmpDate(e.date, since) < 0 || (until && cmpDate(e.date, until) > 0)) continue;
    const k = e.date + '|' + e.text + '|' + (e.world ? '' : g.name); // 세계 소식은 여러 제국에 같은 글이 있으니 합치고, 제국별 기록은 따로 둔다
    if (seen.has(k)) continue; seen.add(k);
    out.push({ date: e.date, text: e.text, who: g.name });
  }
  out.sort((a, b) => cmpDate(a.date, b.date));
  return mergePlanetFacts(mergeWarFacts(out)).slice(-max);
}

// 참전 줄은 기록 당시 인터페이스 언어로 쌓인다(mail.ts): 한국어 '전쟁 "x": y이(가) 참전했다' / 영어 'War "x": y joined'(2026-10-19).
const WAR_JOIN = /^(?:전쟁 "(.+)": (.+?)이\(가\) (?:(공격|방어) 측\([^)]*\)으로 )?참전했다|War "(.+)": (.+?) joined(?: on the (attacking|defending) side \([^)]*\))?)$/;
/** 같은 전쟁에 참전한 제국들의 사실(참전국마다 따로 남은 줄)을 한 줄로 묶는다. 날짜는 처음 참전한 날.
 *  2026-11-09: 공격 측(선전포고한 쪽)·방어 측이 적힌 줄은 편을 갈라 묶는다(몰락 제국이 선전포고했는데 신문이 플레이어가 먼저 한 것처럼 쓴 신고). */
export function mergeWarFacts(facts: Fact[]): Fact[] {
  const out: Fact[] = []; const at = new Map<string, { i: number; en: boolean; att: string[]; def: string[]; any: string[] }>();
  const text = (war: string, g: { en: boolean; att: string[]; def: string[]; any: string[] }): string => {
    if (!g.att.length && !g.def.length) return g.en ? `War "${war}": ${g.any.join(', ')} joined` : `전쟁 "${war}": ${g.any.join(', ')}이(가) 참전했다`;
    const parts = g.en
      ? [g.att.length ? `attackers (declared the war) ${g.att.join(', ')}` : '', g.def.length ? `defenders (were declared on) ${g.def.join(', ')}` : '', g.any.length ? `also joined ${g.any.join(', ')}` : '']
      : [g.att.length ? `공격 측(선전포고한 쪽) ${g.att.join(', ')}` : '', g.def.length ? `방어 측(선전포고를 받은 쪽) ${g.def.join(', ')}` : '', g.any.length ? `그 밖의 참전 ${g.any.join(', ')}` : ''];
    return (g.en ? `War "${war}": ` : `전쟁 "${war}": `) + parts.filter(Boolean).join(g.en ? '; ' : ' · ');
  };
  for (const f of facts) {
    const r = WAR_JOIN.exec(f.text);
    if (!r) { out.push(f); continue; }
    const en = r[4] !== undefined, war = en ? r[4] : r[1], who = en ? r[5] : r[2], side = en ? (r[6] === 'attacking' ? 'att' : r[6] === 'defending' ? 'def' : '') : (r[3] === '공격' ? 'att' : r[3] === '방어' ? 'def' : '');
    let g = at.get(war);
    const first = !g;
    if (!g) { g = { i: out.length, en, att: [], def: [], any: [] }; at.set(war, g); out.push({ ...f }); }
    const list = side === 'att' ? g.att : side === 'def' ? g.def : g.any;
    if (![...g.att, ...g.def, ...g.any].includes(who)) list.push(who);
    if (first) continue;
    out[g.i] = { ...out[g.i], text: text(war, g), who: out[g.i].who === f.who ? f.who : (en ? 'several empires' : '여러 제국') };
  }
  return out;
}

// 행성 주인 바뀜(2026-10-28 X4 참고): 같은 두 나라 사이의 줄을 한 기사 재료로 묶는다(한국어·영어, mail.newsText 와 같은 꼴).
const PLANET_TOOK = /^(?:(.+)이\(가\) (.+)의 행성 (.+)을\(를\) 차지했다|(.+) took the planet (.+) from (.+))$/;
const PLANET_PASS = /^(?:행성 (.+)이\(가\) (.+)에서 (.+)\(으\)로 넘어갔다|The planet (.+) passed from (.+) to (.+))$/;
/** 같은 두 나라 사이의 행성 주인 바뀜을 한 줄로: 「A이(가) B의 행성 3곳(X, Y, Z)을 차지했다」. 날짜는 처음 것. */
export function mergePlanetFacts(facts: Fact[]): Fact[] {
  const out: Fact[] = []; const at = new Map<string, { i: number; ps: string[]; en: boolean; war: boolean; a: string; b: string }>();
  for (const f of facts) {
    let a = '', b = '', p = '', en = false, war = true;
    const t = PLANET_TOOK.exec(f.text), q = t ? null : PLANET_PASS.exec(f.text);
    if (t) { en = t[4] !== undefined; [a, b, p] = en ? [t[4], t[6], t[5]] : [t[1], t[2], t[3]]; }
    else if (q) { war = false; en = q[4] !== undefined; [p, b, a] = en ? [q[4], q[5], q[6]] : [q[1], q[2], q[3]]; }
    else { out.push(f); continue; }
    const k = `${en ? 'e' : 'k'}|${war ? 'w' : 'd'}|${a}|${b}`, g = at.get(k);
    if (!g) { at.set(k, { i: out.length, ps: [p], en, war, a, b }); out.push({ ...f }); continue; }
    if (!g.ps.includes(p)) g.ps.push(p);
    const list = g.ps.length > 4 ? g.ps.slice(0, 4).join(', ') + (g.en ? ', …' : ' 등') : g.ps.join(', ');
    out[g.i] = { ...out[g.i], text: g.war
      ? (g.en ? `${g.a} took ${g.ps.length} planets from ${g.b} (${list})` : `${g.a}이(가) ${g.b}의 행성 ${g.ps.length}곳(${list})을 차지했다`)
      : (g.en ? `${g.ps.length} planets passed from ${g.b} to ${g.a} (${list})` : `행성 ${g.ps.length}곳(${list})이 ${g.b}에서 ${g.a}(으)로 넘어갔다`) };
  }
  return out;
}

export function newsMessages(player: string, date: string, facts: Fact[], paper: Paper = PAPERS[0], info: string[] = [], photos: string[] = []): ChatMessage[] {
  const pp = paperPrompt(paper);
  const system = [
    `You are the editor of the newspaper "${paper.name}". You are writing one issue dated ${date}. Style: ${pp.tone}. The reader is the leader of ${player}.`,
    `The newspaper's leaning: ${pp.slant}`,
    `Write only about what is in "Facts of the past year" below. Do not invent events, numbers, people or reasons. "We/our" in the text means ${player} (write ${player} by name in the articles).`,
    WAR_SIDE_RULE,
    paper.comments
      ? 'Each article body reports the facts, with this newspaper\'s leaning coloring the tone. End each article body with one sentence of the reporter\'s subjective opinion (there is no separate commentary field). An opinion is only an opinion: do not invent events or numbers not in the chronicle, and speak of the future only as "might ...".'
      : 'Article bodies report facts only; add no opinion.',
    'If the facts include a war, federation, pact or alliance between other empires that does not involve the player empire, at least one of them must be an article. Do not fill the paper only with the player empire.',
    `For wars, victories and planets changing hands between other empires, let the tone follow how that empire stands with ${player} (see the empire notes): glad when a friend, partner or ally gains, wary when a rival or hostile empire gains, detached for empires with no ties.`,
    photos.length ? PHOTO_RULE : '',
    'Reply with one JSON only: {"headline":"one-line lead headline","articles":[{"title":"title","body":"about three sentences"' + (photos.length ? ',"photo":"P1 or empty","caption":"photo caption or empty"' : '') + '}],"briefs":["one-line item"]}',
    facts.length >= FEW_FACTS
      ? 'articles: 2-3. If facts are about different things, write a separate article per event; only group truly same-kind items (e.g. first contact with several empires) into one article.'
      : 'This year is a "quiet year" with few recorded facts. Write only as many articles as there are facts (0-' +
        Math.max(1, facts.length) +
        '); if there are no facts, leave articles as an empty array. The headline should say it was a quiet year without inventing events. That nothing happened is itself a fact and may be written.',
    paper.briefsFact
      ? 'briefs is the "one-liners" column at the bottom. This newspaper writes only facts here too. Write exactly 3 facts that did not make it into the articles, one short sentence each (under about 50 characters), and include no made-up stories at all.'
      : 'briefs is the "one-liners" column at the bottom. This column contains no facts at all. Write exactly 3 made-up funny items, one very short sentence each (under about 50 characters), stating just the incident with no explanation. Mix two kinds: (1) rumors in a "word is that ..." tone (do not use the words "hearsay" or "rumor has it"), (2) everyday mishaps (e.g. black comedy like a human neighbor caught trying to mine away a lithoid resident over floor noise). Do not mention or imitate events from the facts above (wars, treaties, alliances, leaders\' actions, etc.); write only about trivial everyday quirks of unnamed residents. Empire names and species may be used as background. No real-world people or organizations. No gruesome descriptions; keep it to laughs.',
  ].filter(Boolean).join('\n');
  const user = (info.length ? 'Related empire information (for judging tone only; do not report it as fact):\n' + info.join('\n') + '\n\n' : '') + (photos.length ? 'Photos:\n' + photos.join('\n') + '\n\n' : '') + 'Facts of the past year:\n' + (facts.length ? '' : '(no recorded events)') + facts.map((f) => `- ${f.date} (${f.who}) ${f.text}`).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

export function parseIssue(raw: string): { headline: string; articles: Article[]; briefs: string[] } | null {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s < 0 || e <= s) return null;
  let o: any; try { o = JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const headline = str(o?.headline, 120);
  const articles: Article[] = (Array.isArray(o?.articles) ? o.articles : [])
    .map((a: any) => ({ title: str(a?.title, 80), body: str(a?.body, 500), comment: str(a?.comment, 200), photo: /^P\d{1,2}$/.test(str(a?.photo, 4)) ? str(a?.photo, 4) : '', caption: str(a?.caption, 90) }))
    .filter((a: Article) => a.title && a.body)
    .map((a: Article) => { const o: Article = { title: a.title, body: a.body }; if (a.comment) o.comment = a.comment; if (a.photo) { o.photo = a.photo; if (a.caption) o.caption = a.caption; } return o; })
    .slice(0, MAX_ARTICLES);
  const briefs: string[] = (Array.isArray(o?.briefs) ? o.briefs : []).map((b: unknown) => str(b, 60)).filter(Boolean).slice(0, 3); // 한 줄 소식은 3개까지(2026-11-03: LLM 낭비 줄이기)
  if (!headline || (!articles.length && !briefs.length)) return null;
  return { headline, articles, briefs };
}

/** 홈페이지 분야 탭 기사(2026-11-10): 그해 사실 가운데 그 분야 것만으로 많아야 3건. 첫 면에 실린 기사와 겹치지 않게. 사실이 적으면 그만큼만. */
export function sectionMessages(player: string, date: string, tab: string, facts: Fact[], avoid: string[], paper: Paper = PAPERS[0], info: string[] = [], photos: string[] = []): ChatMessage[] {
  const pp = paperPrompt(paper);
  const system = [
    `You are the editor of the newspaper "${paper.name}". You are writing the "${tab}" section of the newspaper's website for the year ending ${date}. Style: ${pp.tone}. The reader is the leader of ${player}.`,
    `The newspaper's leaning: ${pp.slant}`,
    `Write only about what is in "Facts" below (all of them belong to this section). Do not invent events, numbers, people or reasons. "We/our" in the text means ${player} (write ${player} by name).`,
    `Write at most 3 articles, one per distinct event (group only truly same-kind items). If there are fewer facts, write fewer articles; never pad. If none of the facts is worth an article, leave articles empty.`,
    avoid.length ? 'The front page already ran these stories; do not write them again: ' + avoid.join(' / ') : '',
    WAR_SIDE_RULE,
    paper.comments ? 'End each article body with one sentence of the reporter\'s subjective opinion. An opinion is only an opinion: do not invent events or numbers.' : 'Article bodies report facts only; add no opinion.',
    photos.length ? PHOTO_RULE : '',
    'Reply with one JSON only: {"articles":[{"title":"title","body":"about three sentences"' + (photos.length ? ',"photo":"P1 or empty","caption":"photo caption or empty"' : '') + '}]}',
  ].filter(Boolean).join('\n');
  const user = (info.length ? 'Related empire information (for judging tone only; do not report it as fact):\n' + info.join('\n') + '\n\n' : '') + (photos.length ? 'Photos:\n' + photos.join('\n') + '\n\n' : '') + 'Facts:\n' + facts.map((f) => `- [${f.date}] ${f.text}`).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
export function parseSection(raw: string): Article[] | null {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s < 0 || e <= s) return null;
  let o: any; try { o = JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
  if (!Array.isArray(o?.articles)) return null;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  return o.articles.map((a: any) => ({ title: str(a?.title, 80), body: str(a?.body, 500), photo: /^P\d{1,2}$/.test(str(a?.photo, 4)) ? str(a?.photo, 4) : '', caption: str(a?.caption, 90) }))
    .filter((a: Article) => a.title && a.body).slice(0, 3)
    .map((a: Article) => { const r: Article = { title: a.title, body: a.body }; if (a.photo) { r.photo = a.photo; if (a.caption) r.caption = a.caption; } return r; });
}

/** 프롬프트에 넣을 줄들: 머리기사 한 줄과 기사 제목·본문. 너무 길면 자른다. */
export function paperLines(it: Issue | undefined, max = 700): string[] {
  if (!it) return [];
  const out = [`[${it.date}] ${it.headline}`]; let n = out[0].length; // 기자 논평은 의견이라 AI 가 읽는 요약에 넣지 않는다
  for (const a of it.articles) { const l = `- ${a.title}: ${a.body}`; if (n + l.length > max) break; out.push(l); n += l.length; }
  return out;
}
