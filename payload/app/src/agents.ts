// 첩보 자산 인물화(2026-10-20 알파 9 ④): 첩보망 하나 = 그 나라에 심은 공작원 한 명.
//  - 이름은 상대 제국 종족 이름 표에서(위장 신분이 그럴듯하게) — features/namegen-app.ts. AI 는 이름을 짓지 않는다.
//  - 암호명·위장 직업·말투는 아래 표에서 고른다(한/영 짝, 번호로 저장 → 화면 언어가 바뀌어도 맞게 보인다).
//  - 첩보망이 두 달 연속 사라지면 연락 두절(추모관 「떠난 사람들」, 행방 불명). 다시 첩보망을 세우면 새 공작원이 부임한다.
//  - 10년 넘게 근무하면 베테랑(보고서 말투만, 수치 효과 없음). 게임 숫자는 건드리지 않는다.
// 앱: features/agents-app.ts. 보고서: embassy.ts spyReportMessages(agentLine).
import { dayNo } from './gamedate';

type Pair = readonly [string, string];
export const CODE_ADJ: readonly Pair[] = [['회색', 'Grey'], ['붉은', 'Crimson'], ['고요한', 'Silent'], ['푸른', 'Azure'], ['검은', 'Black'], ['은빛', 'Silver'], ['늙은', 'Old'], ['외눈', 'One-eyed'], ['겨울', 'Winter'], ['잿빛', 'Ashen']];
export const CODE_NOUN: readonly Pair[] = [['왜가리', 'Heron'], ['여우', 'Fox'], ['까마귀', 'Raven'], ['나방', 'Moth'], ['올빼미', 'Owl'], ['족제비', 'Weasel'], ['도마뱀', 'Lizard'], ['해파리', 'Jellyfish'], ['매', 'Hawk'], ['거미', 'Spider']];
export const COVERS: readonly Pair[] = [['무역상', 'trader'], ['대사관 서기', 'embassy clerk'], ['화물선 항해사', 'freighter navigator'], ['학술 교류 연구원', 'exchange researcher'], ['순례자', 'pilgrim'], ['언론 특파원', 'foreign correspondent'], ['광산 회사 감독관', 'mining company overseer'], ['통역사', 'interpreter'], ['요리사', 'chef'], ['보험 조사원', 'insurance investigator']];
export const MANNERS: readonly Pair[] = [['짧고 건조한', 'terse and dry'], ['꼼꼼하고 신중한', 'meticulous and cautious'], ['냉소적인', 'sardonic'], ['차분하고 정중한', 'calm and courteous'], ['초조하고 날카로운', 'nervous and sharp'], ['노련하고 느긋한', 'seasoned and unhurried']];
export const VETERAN_YEARS = 10;
export const MISS_TO_LOSE = 2;

export interface Agent { key: string; target: string; idx: number; name: string; gender: 'm' | 'f'; code: number; cover: number; manner: number; since: string; status: 'active' | 'lost' | 'recalled'; miss: number; gone?: string; /** 외교관 위장(대사관 무관, 2026-10-20): 첩보 신뢰도↑, 발각되면 대사 추방 */ dip?: boolean;
  /** 현지 협력자 = 게임 첩보 자산(2026-10-20) */ contacts?: Contact[]; /** 다음 서신 때 쓸 일(협력자 포섭·이탈·베테랑) */ pend?: Array<{ kind: AgentLetterKind; detail: string }> }
const pick = (p: Pair, ko: boolean) => (ko ? p[0] : p[1]);
export const codename = (a: Pick<Agent, 'code'>, ko: boolean): string => `${pick(CODE_ADJ[Math.floor(a.code / 10) % 10], ko)} ${pick(CODE_NOUN[a.code % 10], ko)}`;
export const DIP_COVER: Pair = ['대사관 무관', 'embassy attaché'];
export const coverName = (a: Pick<Agent, 'cover'> & { dip?: boolean }, ko: boolean): string => pick(a.dip ? DIP_COVER : COVERS[a.cover % COVERS.length], ko);
export const mannerName = (a: Pick<Agent, 'manner'>, ko: boolean): string => pick(MANNERS[a.manner % MANNERS.length], ko);
/** 근무 햇수(게임 달력 360일 = 1년). 날짜를 모르면 0. */
export function yearsServed(since: string, now: string): number { const a = dayNo(since), b = dayNo(now); return a === null || b === null || b < a ? 0 : Math.floor((b - a) / 360); }
export const isVeteran = (a: Pick<Agent, 'since'>, now: string): boolean => yearsServed(a.since, now) >= VETERAN_YEARS;
/** 새 공작원. 같은 세이브 안에서 이미 쓴 암호명은 피한다. rand 는 0..1. */
export function newAgent(target: string, idx: number, date: string, name: string, gender: 'm' | 'f', used: number[], rand: () => number, seq: number): Agent {
  const free = Array.from({ length: 100 }, (_, i) => i).filter((i) => !used.includes(i)); const pool = free.length ? free : Array.from({ length: 100 }, (_, i) => i);
  return { key: `agent:${seq}`, target, idx, name, gender, code: pool[Math.floor(rand() * pool.length) % pool.length], cover: Math.floor(rand() * COVERS.length) % COVERS.length, manner: Math.floor(rand() * MANNERS.length) % MANNERS.length, since: date, status: 'active', miss: 0 };
}
/** 월간 첩보망 목록으로 공작원 명부를 맞춘다. born: 새로 부임할 첩보망 대상, lost: 이번에 연락이 끊긴 공작원.
 * 자료가 빈 달(첩보망 0개)에 활동 중 공작원이 2명 이상이면 옛 모드·자료 누락일 수 있어 세지 않는다. */
// 2026-10-27 테스터 로그: 게임은 접촉한 모든 나라에 침투 0 의 첩보망을 둔다(한 세이브에 116개 중 110개가 pow=0).
// 그래서 공작원은 침투 수준이 1 이상인 첩보망에만 부임하고, 첩보망은 남았는데 침투가 0 으로 떨어지면 조용히 소환한다(추모관·청문회 없음).
// power 가 없는 옛 줄(모드가 pow 를 안 보낸 경우)은 살아 있는 첩보망으로 본다.
export function syncAgents(list: Agent[], nets: Array<{ target: string; power?: number }>, date: string): { born: string[]; lost: Agent[]; recalled: Agent[] } {
  const seen = new Set(nets.map((n) => n.target).filter(Boolean));
  const live = new Set(nets.filter((n) => n.target && (n.power === undefined || n.power > 0)).map((n) => n.target));
  const active = list.filter((a) => a.status === 'active');
  const born = [...live].filter((t) => !active.some((a) => a.target === t)), lost: Agent[] = [], recalled: Agent[] = [];
  if (!seen.size && active.length >= 2) return { born, lost, recalled };
  for (const a of active) {
    if (live.has(a.target)) { a.miss = 0; continue; }
    if (seen.has(a.target)) { a.status = 'recalled'; a.gone = date; a.miss = 0; delete a.dip; recalled.push(a); continue; }
    a.miss += 1; if (a.miss >= MISS_TO_LOSE) { a.status = 'lost'; a.gone = date; lost.push(a); }
  }
  return { born, lost, recalled };
}
/** 첩보 보고서 AI 요청에 넣을 공작원 신분(영어). 이름은 우리가 정한 것을 그대로 쓰게 한다. */
export function agentPromptLine(a: Agent, now: string): string {
  const y = yearsServed(a.since, now);
  return `You are our field agent ${a.name}, codename "${codename(a, false)}", living undercover as a ${coverName(a, false)} inside ${a.target} since ${a.since || 'some years ago'}${y >= VETERAN_YEARS ? ` — a veteran of ${y} years in the field` : y > 0 ? ` (${y} years in the field)` : ''}. ${a.dip ? ' You work inside our embassy under diplomatic cover, so you can confirm what others only hear as rumor.' : ''} Your manner: ${mannerName(a, false)}. Use these names exactly; sign the report with your codename only.`;
}
// ---- 현지 협력자(게임 첩보 자산 16+20종, 2026-10-20 알파 9 ④) ----
// 모드 SPYASSET 줄(첩보망마다 가진 자산)로 맞춘다. 사람 자산은 상대 제국 종족 이름 표로 이름을 짓고, 군체·기계 자산(드론·노드)은 일련번호.
// 이름은 게임 용어(한국어판·영어판 지역화)를 그대로 쓴다.
export const ASSETS: Record<string, { n: Pair; person: boolean }> = {
  bureaucrat: { n: ['관료', 'Bureaucrat'], person: true }, clerk: { n: ['사무원', 'Clerk'], person: true }, economist: { n: ['경제학자', 'Economist'], person: true }, scientist: { n: ['과학자', 'Scientist'], person: true },
  junior_officer: { n: ['하급 장교', 'Junior Officer'], person: true }, criminal_underling: { n: ['범죄자 졸개', 'Criminal Underling'], person: true }, attache: { n: ['주재관', 'Attache'], person: true }, laborer: { n: ['인부', 'Laborer'], person: true },
  hacker: { n: ['해커', 'Hacker'], person: true }, arms_smuggler: { n: ['무기 밀수꾼', 'Arms Smuggler'], person: true }, agitator: { n: ['운동가', 'Agitator'], person: true }, newscaster: { n: ['뉴스캐스터', 'Newscaster'], person: true },
  pop_icon: { n: ['팝스타', 'Pop Icon'], person: true }, academic: { n: ['학자', 'Academic'], person: true }, veteran: { n: ['참전 용사', 'Veteran'], person: true }, internal_organs: { n: ['내장 기관', 'Internal Organs'], person: false },
  synapse_drone: { n: ['시냅스 드론', 'Synapse Drone'], person: false }, ephapse_relay: { n: ['전기 시냅스 중계기', 'Ephapse Relay'], person: false }, labor_drone: { n: ['노동 드론', 'Labor Drone'], person: false }, research_drone: { n: ['연구 드론', 'Research Drone'], person: false },
  warrior_drone: { n: ['전사 드론', 'Warrior Drone'], person: false }, behavioral_regulator: { n: ['행동 조정기', 'Behavioral Regulator'], person: false }, pheromone_emitter: { n: ['페로몬 방출기', 'Pheromone Emitter'], person: false }, resource_distribution_node: { n: ['자원 분배 노드', 'Resource Distribution Node'], person: false },
  cortex_node: { n: ['피질 노드', 'Cortex Node'], person: false }, subspace_tendril: { n: ['아공간 덩굴손', 'Subspace Tendril'], person: false }, coordination_system: { n: ['조정 체계', 'Coordination System'], person: false }, engagement_protocol: { n: ['교신 프로토콜', 'Engagement Protocol'], person: false },
  logistics_system: { n: ['물류 체계', 'Logistics System'], person: false }, research_database: { n: ['연구 데이터베이스', 'Research Database'], person: false }, war_algorithm: { n: ['전쟁 알고리즘', 'War Algorithm'], person: false }, command_relay: { n: ['명령 중계기', 'Command Relay'], person: false },
  dispatch_uplink: { n: ['송신 업링크', 'Dispatch Uplink'], person: false }, resource_pylon: { n: ['자원 탑', 'Resource Pylon'], person: false }, memory_cache: { n: ['메모리 캐시', 'Memory Cache'], person: false }, weapons_platform: { n: ['무기 플랫폼', 'Weapons Platform'], person: false },
};
export const ASSET_KEYS = Object.keys(ASSETS);
export interface Contact { a: string; name: string; since: string; gone?: string }
export const assetName = (a: string, ko: boolean): string => (ASSETS[a] ? pick(ASSETS[a].n, ko) : a);
/** 사람이 아닌 자산의 이름: 일련번호(예: 7-312). */
export const unitName = (rand: () => number): string => `${1 + Math.floor(rand() * 9)}-${String(Math.floor(rand() * 1000)).padStart(3, '0')}`;
/** 이번 달 자산 목록으로 협력자를 맞춘다. 새 자산 = 새 협력자(포섭), 사라진 자산 = 이탈. assets 가 undefined(옛 모드)면 아무것도 하지 않는다. */
export function syncContacts(a: Agent, assets: string[] | undefined, date: string, nameOf: (asset: string) => string): { added: Contact[]; lost: Contact[] } {
  if (!assets) return { added: [], lost: [] };
  const first = a.contacts === undefined; // 처음 맞출 때(기능이 생기기 전부터 있던 자산)는 서신 거리로 삼지 않는다
  const now = new Set(assets.filter((x) => ASSETS[x])), list = (a.contacts ??= []), added: Contact[] = [], lost: Contact[] = [];
  for (const c of list) if (!c.gone && !now.has(c.a)) { c.gone = date; lost.push(c); }
  for (const x of now) if (!list.some((c) => !c.gone && c.a === x)) { const c: Contact = { a: x, name: nameOf(x), since: date }; list.push(c); added.push(c); }
  if (list.length > 24) list.splice(0, list.length - 24);
  if (first) return { added, lost };
  const pend = (a.pend ??= []);
  for (const c of added) pend.push({ kind: 'recruit', detail: c.a + '|' + c.name });
  for (const c of lost) pend.push({ kind: 'contact_lost', detail: c.a + '|' + c.name });
  if (pend.length > 4) pend.splice(0, pend.length - 4);
  return { added, lost };
}
export const activeContacts = (a: Agent): Contact[] => (a.contacts ?? []).filter((c) => !c.gone);

// ---- 공작원 서신(요원 연작, 2026-10-20 알파 9 ④) — 이야기만, 게임 효과 없음 ----
// 2년마다 한 번 뽑는다(게임의 「무작위 첩보망 이벤트」가 2년마다 굴러가는 것과 맞춤). 공작원마다 확률로, 안 읽은 서신은 세이브당 MAX 통까지.
// 협력자 포섭·이탈·베테랑이 된 일은 먼저 쓰고, 없으면 게임 첩보 이벤트에서 따온 사연(배신했던 요원·뜻밖의 수확·주운 암호·흘러나간 통신문·음모의 냄새·조용한 계절).
// 본문은 플레이어가 봉투를 열 때 AI 가 한 번 쓴다.
export type AgentLetterKind = 'recruit' | 'contact_lost' | 'leak' | 'veteran' | 'disavowed' | 'close_call' | 'cipher' | 'stray' | 'plot' | 'quiet';
export const AGENT_LETTER_GAP_MONTHS = 24, AGENT_LETTER_CHANCE = 0.45, AGENT_MAX_UNREAD = 3, AGENT_MAX_LETTERS = 40;
export const LETTER_KIND_NAME: Record<AgentLetterKind, Pair> = {
  recruit: ['새 협력자 포섭', 'A new collaborator'], contact_lost: ['협력자와 연락 끊김', 'A collaborator lost'], leak: ['방송국에서 흘러나온 소식', 'Word from the newsroom'], veteran: ['현장 10년', 'Ten years in the field'],
  disavowed: ['돌아온 배신자', 'The disavowed operative'], close_call: ['들킬 뻔한 날', 'A close call'], cipher: ['주운 암호표', 'Finders keepers'], stray: ['흘러나간 통신문', 'A stray communiqué'], plot: ['음모의 냄새', 'The smell of a plot'], quiet: ['조용한 계절', 'A quiet season'],
};
const STORY_KINDS: AgentLetterKind[] = ['disavowed', 'close_call', 'cipher', 'stray', 'plot', 'quiet', 'quiet'];
export interface AgentLetter { id: number; key: string; kind: AgentLetterKind; detail: string; date: string; read: boolean; title?: string; body?: string }
const monthsOf = (d: string) => { const n = dayNo(d); return n === null ? null : Math.floor(n / 30); };
/** 2년이 지났으면 서신을 뽑는다. 처음 보는 세이브는 기준 날짜만 잡는다(불러오자마자 쏟아지지 않게). */
export function drawAgentLetters(sv: { agents: Agent[]; letters?: AgentLetter[]; lastDraw?: string; next?: number }, date: string, rand: () => number = Math.random): AgentLetter[] {
  const now = monthsOf(date); if (now === null) return [];
  // 베테랑이 된 공작원은 다음 서신에 쓴다(한 번만)
  for (const a of sv.agents) if (a.status === 'active' && isVeteran(a, date) && !(a.pend ?? []).some((p) => p.kind === 'veteran') && !(sv.letters ?? []).some((l) => l.key === a.key && l.kind === 'veteran')) (a.pend ??= []).push({ kind: 'veteran', detail: String(yearsServed(a.since, date)) });
  const last = sv.lastDraw ? monthsOf(sv.lastDraw) : null;
  if (last === null) { sv.lastDraw = date; return []; }
  if (now - last < AGENT_LETTER_GAP_MONTHS) return [];
  sv.lastDraw = date;
  const letters = (sv.letters ??= []), out: AgentLetter[] = [];
  const active = sv.agents.filter((a) => a.status === 'active').map((a) => ({ a, r: rand() })).sort((x, y) => x.r - y.r).map((x) => x.a);
  for (const a of active) {
    if (letters.filter((l) => !l.read).length + out.length >= AGENT_MAX_UNREAD) break;
    const pend = a.pend ?? [];
    if (!pend.length && rand() >= AGENT_LETTER_CHANCE) continue;
    let kind: AgentLetterKind, detail = '';
    if (pend.length) { const p = pend.shift()!; kind = p.kind; detail = p.detail; }
    else {
      const caster = activeContacts(a).find((c) => c.a === 'newscaster');
      if (caster && rand() < 0.5) { kind = 'leak'; detail = 'newscaster|' + caster.name; }
      else kind = STORY_KINDS[Math.floor(rand() * STORY_KINDS.length) % STORY_KINDS.length];
    }
    sv.next = (sv.next ?? 0) + 1;
    out.push({ id: sv.next, key: a.key, kind, detail, date, read: false });
  }
  letters.push(...out);
  // 오래된 읽은 서신부터 정리
  while (letters.length > AGENT_MAX_LETTERS) { const i = letters.findIndex((l) => l.read); letters.splice(i >= 0 ? i : 0, 1); }
  return out;
}
const KIND_EN: Record<AgentLetterKind, (d: string) => string> = {
  recruit: (d) => `You have just recruited a new local collaborator: ${detailEn(d)}. Tell how you found and turned them, and what they may be good for.`,
  contact_lost: (d) => `Your local collaborator ${detailEn(d)} has gone silent — arrested, fled or simply vanished; you do not know which. Report it, with the feeling of losing someone you relied on.`,
  leak: (d) => `Your collaborator, ${detailEn(d)}, has slipped you what the host empire's newsroom is not allowed to broadcast. Pass it on as backstage gossip about the host society and the mood in their capital — never invent wars, treaties, numbers or named officials.`,
  veteran: (d) => `You have now spent ${d || 'ten'} years in the field. Reflect on what it has cost you and what keeps you here.`,
  disavowed: () => 'An operative our service once disavowed has resurfaced in the host empire and reached out to you. You cannot tell whether it is a genuine offer or a trap, and you ask the ruler\'s guidance.',
  close_call: () => 'Local security nearly exposed you this season. Describe the close call and how you slipped away.',
  cipher: () => 'By sheer luck you came across discarded cipher material. It may help our codebreakers.',
  stray: () => 'One of our messages went astray. You fear our codes may be compromised and you are lying low for a while.',
  plot: () => 'You smell a plot brewing in the host capital, but you cannot yet tell who is behind it or whom it targets.',
  quiet: () => 'A quiet season. Write about daily life undercover and small things you noticed about the host people.',
};
function detailEn(d: string): string { const [a, name] = d.split('|'); return name ? `${name} (${ASSETS[a] ? ASSETS[a].n[1].toLowerCase() : a})` : d; }
/** 서신 본문(봉투를 열 때 한 번). 이야기만 — 게임 숫자·효과를 지어내지 않는다. */
export function agentLetterMessages(a: Agent, l: AgentLetter, empire: string, now: string): Array<{ role: 'system' | 'user'; content: string }> {
  const cs = activeContacts(a).map((c) => `${c.name} (${ASSETS[c.a] ? ASSETS[c.a].n[1].toLowerCase() : c.a})`);
  const sys = [
    agentPromptLine(a, now),
    `You are writing a private coded dispatch home to the ruler of ${empire || 'the player empire'}, dated ${l.date || now}. It is a personal story letter, not a status report.`,
    cs.length ? `Your local collaborators (use these names exactly; do not invent others): ${cs.join(', ')}.` : 'You have no named local collaborators; do not invent named people.',
    `[Why you are writing] ${KIND_EN[l.kind](l.detail)}`,
    'Rules: this is narration only. Never invent game numbers, fleet sizes, wars, treaties or named officials of the host empire. Do not claim any game effect. 4-7 sentences, letter form, signed with your codename only.',
    'Output only one JSON: {"title":"short title","body":"..."} (line breaks as \\n)',
  ].join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: 'Write the dispatch.' }];
}
export function parseAgentLetter(raw: string): { title: string; body: string } | null {
  const m = String(raw ?? '').match(/\{[\s\S]*\}/); if (!m) return null;
  try { const j = JSON.parse(m[0]); const body = typeof j.body === 'string' ? j.body.trim().slice(0, 4000) : ''; if (!body) return null; return { title: typeof j.title === 'string' ? j.title.trim().slice(0, 120) : '', body }; } catch { return null; }
}

export interface AgentStore { saves: Record<string, { seq: number; agents: Agent[]; letters?: AgentLetter[]; lastDraw?: string; next?: number }> }
export function sanitizeAgents(v: unknown): AgentStore {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, saves: AgentStore['saves'] = {};
  const n = (x: unknown, max: number) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < max ? x : 0);
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) for (const [sid, sv] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
    const s = (sv && typeof sv === 'object' ? sv : {}) as Record<string, unknown>; const agents: Agent[] = [];
    for (const d of (Array.isArray(s.agents) ? s.agents : []).slice(-200)) {
      const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      if (typeof x.key !== 'string' || typeof x.target !== 'string' || typeof x.name !== 'string' || !x.name) continue;
      agents.push({ key: x.key.slice(0, 40), target: x.target.slice(0, 80), idx: n(x.idx, 1e6), name: x.name.slice(0, 40), gender: x.gender === 'f' ? 'f' : 'm', code: n(x.code, 100), cover: n(x.cover, COVERS.length), manner: n(x.manner, MANNERS.length), since: typeof x.since === 'string' ? x.since.slice(0, 20) : '', status: x.status === 'lost' ? 'lost' : x.status === 'recalled' ? 'recalled' : 'active', miss: n(x.miss, 100), ...(typeof x.gone === 'string' ? { gone: x.gone.slice(0, 20) } : {}), ...(x.dip === true ? { dip: true } : {}),
        ...(Array.isArray(x.contacts) ? { contacts: (x.contacts as unknown[]).slice(-24).flatMap((c) => { const y = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>; return typeof y.a === 'string' && ASSETS[y.a] && typeof y.name === 'string' && y.name ? [{ a: y.a, name: y.name.slice(0, 40), since: typeof y.since === 'string' ? y.since.slice(0, 20) : '', ...(typeof y.gone === 'string' ? { gone: y.gone.slice(0, 20) } : {}) }] : []; }) } : {}),
        ...(Array.isArray(x.pend) ? { pend: (x.pend as unknown[]).slice(-4).flatMap((p) => { const y = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>; return typeof y.kind === 'string' && y.kind in LETTER_KIND_NAME ? [{ kind: y.kind as AgentLetterKind, detail: typeof y.detail === 'string' ? y.detail.slice(0, 80) : '' }] : []; }) } : {}) });
    }
    const letters: AgentLetter[] = [];
    for (const d of (Array.isArray(s.letters) ? s.letters : []).slice(-AGENT_MAX_LETTERS)) {
      const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      if (typeof x.key !== 'string' || typeof x.kind !== 'string' || !(x.kind in LETTER_KIND_NAME) || !Number.isSafeInteger(x.id)) continue;
      letters.push({ id: x.id as number, key: x.key.slice(0, 40), kind: x.kind as AgentLetterKind, detail: typeof x.detail === 'string' ? x.detail.slice(0, 80) : '', date: typeof x.date === 'string' ? x.date.slice(0, 20) : '', read: x.read === true, ...(typeof x.title === 'string' ? { title: x.title.slice(0, 120) } : {}), ...(typeof x.body === 'string' ? { body: x.body.slice(0, 4000) } : {}) });
    }
    saves[sid.slice(0, 60)] = { seq: n(s.seq, 1e9) || agents.length, agents, ...(letters.length ? { letters } : {}), ...(typeof s.lastDraw === 'string' ? { lastDraw: s.lastDraw.slice(0, 20) } : {}), ...(Number.isSafeInteger(s.next) ? { next: s.next as number } : {}) };
  }
  return { saves };
}
