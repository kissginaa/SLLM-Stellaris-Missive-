// 양당 정치(2026-11-06 사용자: 「민주정일 때 더더욱 느낌이 살게」 — ① 지지율을 정치의 통화로 ② 먼저 움직이는 야당 ④ 총선).
// 의회(parliament.ts)의 파벌 의석 위에 「두 거대 정당」 층을 얹는다: 여당 쪽 파벌(여당·연정·거래) = 집권당, 제1야당 쪽 파벌 = 제1야당, 파벌은 당 안의 계파.
// 자유 정부(civic 'free')에서만. 민주정(auth 1)은 흔들림 1.5배·총선 6년마다, 과두정 등은 10년마다.
// 순수 규칙(electron 없이 selftest). 앱: src/features/twoparty-app.ts · 화면: ui/office-twoparty.js(집무실 「의회」 맨 위).
// AI 는 대정부 질문 판정·후보 토론에만(LLM 최소화). 질문·공약·성명은 미리 쓴 틀 문장.
import type { ChatMessage } from './player2';

export type Pair = [string, string]; // [한국어, 영어]
export type Side = 'gov' | 'opp';
export const DUO = {
  everyDemo: 6, everyOther: 10, campaignMonths: 6, firstMinMonths: 18,
  honeymoonMonths: 12, honeymoon: 4, fatiguePerYear: 0.7, fatigueCap: 6,
  approvalPull: 0.3, baseRate: 0.15, swingCap: 20, demoMult: 1.5, impDecay: 0.9, impCap: 12,
  // 대정부 질문: 4년마다(2026-11-06 사용자: 몇 달마다는 너무 잦음), 처음 것은 1~4년 사이
  qtEveryMonths: 48, qtFirstMin: 12, qtDueMonths: 2, qtIgnore: -3, qtScore: 1.5,
  debateTurns: 2, debateScore: 1.5, tokens: 700,
  pledges: 3, pledgeKept: 2.5, pledgeBroken: -3.5, seatPower: 1.5, undMin: 6,
  warRallyMonths: 6, warRally: 2.5, warLongMonths: 24, warLong: -2.5,
};

// ---- 당 이름(제국 성향 파벌의 가치관마다 둘: 집권당은 앞, 같은 가치관 야당은 뒤) ----
export const PARTY_NAMES: Record<string, [Pair, Pair]> = {
  militarist: [['국가수호당', 'National Defence Party'], ['강군연대', 'Strong Arms League']],
  pacifist: [['평화민주당', 'Peace Democratic Party'], ['화합연합', 'Concord Union']],
  authoritarian: [['질서당', 'Party of Order'], ['국가재건당', 'National Renewal Party']],
  egalitarian: [['자유민주연합', 'Liberal Democratic Alliance'], ['시민평등당', 'Civic Equality Party']],
  xenophile: [['은하개방당', 'Open Galaxy Party'], ['우호연합', 'Friendship Coalition']],
  xenophobe: [['순혈전선', 'Homeworld Front'], ['종족보존당', 'Kin First Party']],
  materialist: [['진보과학당', 'Progress & Science Party'], ['미래당', 'Future Party']],
  spiritualist: [['신앙공동체당', 'Faith Community Party'], ['영혼의 길', 'Path of the Soul']],
  '': [['민주연합', 'Democratic Union'], ['국민의 소리', "People's Voice"]],
};
export function partyNames(govEthic: string, oppEthic: string): { gov: Pair; opp: Pair } {
  const g = PARTY_NAMES[govEthic] || PARTY_NAMES[''], o = PARTY_NAMES[oppEthic] || PARTY_NAMES[''];
  return { gov: g[0], opp: govEthic === oppEthic || !PARTY_NAMES[oppEthic] ? o[1] : o[0] };
}

// ---- 파벌 → 당 ----
export interface SeatIn { key: string; name: string; ethic: string; seats: number; side: 'ruling' | 'coalition' | 'deal' | 'opposition' | 'ind'; approval: number | null; support?: number }
export const OPPOSITE: Record<string, string> = { militarist: 'pacifist', pacifist: 'militarist', authoritarian: 'egalitarian', egalitarian: 'authoritarian', xenophile: 'xenophobe', xenophobe: 'xenophile', materialist: 'spiritualist', spiritualist: 'materialist' };
/** 파벌을 두 당에 나눈다. 여당·연정·거래 = 집권당, 제1야당 = 야당, 나머지는 지난번 자리를 지키고, 처음이면 가치관(여당과 정반대·제1야당과 같으면 야당)과 정부 승인도(50 이상이면 집권당 쪽)로. */
export function assignBlocs(seats: SeatIn[], ruling: string | null, opp: string | null, prev: Record<string, Side> = {}): Record<string, Side> {
  const out: Record<string, Side> = {}, re = seats.find((x) => x.key === ruling)?.ethic ?? '', oe = seats.find((x) => x.key === opp)?.ethic ?? '';
  for (const x of seats) {
    if (x.side === 'ind') continue;
    if (x.side === 'ruling' || x.side === 'coalition' || x.side === 'deal') out[x.key] = 'gov';
    else if (x.key === opp) out[x.key] = 'opp';
    else if (prev[x.key]) out[x.key] = prev[x.key];
    else out[x.key] = x.ethic && (x.ethic === OPPOSITE[re] || x.ethic === oe) ? 'opp' : (x.approval ?? 50) >= 50 ? 'gov' : 'opp';
  }
  return out;
}
export interface BlocSum { seats: Record<Side, number>; ind: number; support: Record<Side, number>; members: Record<Side, Array<{ key: string; name: string; ethic: string; seats: number }>> }
export function sumBlocs(seats: SeatIn[], bloc: Record<string, Side>): BlocSum {
  const r: BlocSum = { seats: { gov: 0, opp: 0 }, ind: 0, support: { gov: 0, opp: 0 }, members: { gov: [], opp: [] } };
  for (const x of seats) {
    const b = bloc[x.key]; if (!b) { r.ind += x.seats; continue; }
    r.seats[b] += x.seats; r.support[b] += x.support ?? 0; r.members[b].push({ key: x.key, name: x.name, ethic: x.ethic, seats: x.seats });
  }
  for (const b of ['gov', 'opp'] as Side[]) r.members[b].sort((a, c) => c.seats - a.seats);
  return r;
}

// ---- 지지율 ----
export interface Poll { gov: number; opp: number; und: number }
/** 정당 지지율. base = 파벌 지지율 합(게임 값, %), swing = 집권당 쪽 흐름(+면 집권당이 오름, 야당은 그 0.7배만큼 내려감). */
export function pollOf(base: { gov: number; opp: number }, swing: number): Poll {
  let g = Math.max(0, base.gov), o = Math.max(0, base.opp);
  if (g + o <= 0) { g = 40; o = 40; }
  const room = 100 - DUO.undMin; if (g + o > room) { const k = room / (g + o); g *= k; o *= k; }
  g += swing; o -= swing * 0.7;
  g = Math.max(3, Math.min(90, g)); o = Math.max(3, Math.min(90, o));
  if (g + o > 100 - 2) { const k = (100 - 2) / (g + o); g *= k; o *= k; }
  const gr = Math.round(g), orr = Math.round(o);
  return { gov: gr, opp: orr, und: Math.max(0, 100 - gr - orr) };
}
export interface Imp { v: number; d: string; why: Pair }
export interface SwingIn { approval: number | null; monthsSinceElection: number | null; yearsInOffice: number; demo: boolean; warMonths: number }
/** 이번 달 흐름. base 는 지지도(국정 승인도)를 천천히 따라가고, 충격(imp)은 달마다 10%씩 잦아든다. 돌려주는 값 = 이번 달 흐름(±20). */
export function tickSwing(st: { base: number; imp: Imp[] }, a: SwingIn): number {
  const target = a.approval === null ? 0 : (a.approval - 50) * DUO.approvalPull;
  st.base = Math.round((st.base + (target - st.base) * DUO.baseRate) * 100) / 100;
  st.imp = st.imp.map((x) => ({ ...x, v: Math.round(x.v * DUO.impDecay * 100) / 100 })).filter((x) => Math.abs(x.v) >= 0.3).slice(-12);
  return swingNow(st, a);
}
/** 지금 흐름(달을 넘기지 않고 계산만). */
export function swingNow(st: { base: number; imp: Imp[] }, a: SwingIn): number {
  const honey = a.monthsSinceElection !== null && a.monthsSinceElection < DUO.honeymoonMonths ? DUO.honeymoon * (1 - a.monthsSinceElection / DUO.honeymoonMonths) : 0;
  const fatigue = Math.min(DUO.fatigueCap, a.yearsInOffice * DUO.fatiguePerYear);
  const war = a.warMonths > 0 && a.warMonths <= DUO.warRallyMonths ? DUO.warRally : a.warMonths > DUO.warLongMonths ? DUO.warLong : 0;
  const imp = st.imp.reduce((s, x) => s + x.v, 0);
  const raw = (st.base + honey - fatigue + war + imp) * (a.demo ? DUO.demoMult : 1);
  return Math.round(Math.max(-DUO.swingCap, Math.min(DUO.swingCap, raw)) * 10) / 10;
}
export function addImp(st: { imp: Imp[] }, v: number, d: string, why: Pair): void {
  const x = Math.max(-DUO.impCap, Math.min(DUO.impCap, Math.round(v * 10) / 10)); if (!x) return;
  st.imp = [...st.imp, { v: x, d, why }].slice(-12);
}

// ---- 총선 ----
/** 표: 무당층은 대략 반반(±15%p 흔들림)으로 나뉘고, 양쪽에 ±2 잡음. */
export function votesOf(p: Poll, rng: () => number): { gov: number; opp: number } {
  const split = 0.5 + (rng() - 0.5) * 0.3;
  let g = p.gov + p.und * split + (rng() - 0.5) * 4, o = p.opp + p.und * (1 - split) + (rng() - 0.5) * 4;
  g = Math.max(1, g); o = Math.max(1, o); const t = g + o;
  return { gov: Math.round(g / t * 1000) / 10, opp: Math.round(o / t * 1000) / 10 };
}
/** 의석: 소선거구처럼 이긴 쪽이 조금 더 가져간다(득표율 1.5제곱 비례). total = 두 당이 나눌 의석(무소속 제외). */
export function seatsOf(v: { gov: number; opp: number }, total: number): { gov: number; opp: number } {
  const g = Math.pow(Math.max(0, v.gov), DUO.seatPower), o = Math.pow(Math.max(0, v.opp), DUO.seatPower);
  const gs = g + o > 0 ? Math.round(total * g / (g + o)) : Math.round(total / 2);
  return { gov: gs, opp: total - gs };
}
/** 의석 증감을 당 안의 계파(파벌)에 의석 비례로 나눈다. 줄 때는 0 밑으로 가지 않는다. 합은 정확히 delta. */
export function spread(delta: number, members: Array<{ key: string; seats: number }>): Record<string, number> {
  const out: Record<string, number> = {}; if (!delta || !members.length) return out;
  const tot = members.reduce((a, m) => a + Math.max(0, m.seats), 0) || members.length;
  const raw = members.map((m) => ({ key: m.key, cap: delta < 0 ? m.seats : Infinity, q: Math.abs(delta) * (tot ? Math.max(0, m.seats) / tot : 1 / members.length) }));
  let left = Math.abs(delta);
  for (const r of raw) { const n = Math.min(r.cap, Math.floor(r.q)); if (n > 0) { out[r.key] = n; left -= n; } }
  for (const r of raw.slice().sort((a, b) => (b.q - Math.floor(b.q)) - (a.q - Math.floor(a.q)))) { if (left <= 0) break; if ((out[r.key] ?? 0) < r.cap) { out[r.key] = (out[r.key] ?? 0) + 1; left--; } }
  for (const r of raw) { if (left <= 0) break; while (left > 0 && (out[r.key] ?? 0) < r.cap) { out[r.key] = (out[r.key] ?? 0) + 1; left--; } }
  if (delta < 0) for (const k of Object.keys(out)) out[k] = -out[k];
  return out;
}

// ---- 공약(집권당: 플레이어가 고름, 다음 총선 때 성적표) ----
export interface Metrics { stab: number | null; unrest: number | null; wars: number; approval: number | null; facApproval: number | null }
export interface Pledge { id: string; ko: string; en: string; need?: (m: Metrics) => boolean; check: (base: Metrics, now: Metrics, t: { newWar: boolean }) => boolean; goal: Pair }
export const PLEDGES: Pledge[] = [
  { id: 'stab', ko: '행성 안정도를 끌어올리겠습니다', en: 'We will raise stability on our worlds', goal: ['평균 안정도 +5 이상', 'average stability +5 or more'], check: (b, n) => n.stab !== null && b.stab !== null && n.stab >= b.stab + 5 },
  { id: 'unrest', ko: '불안한 행성을 하나도 남기지 않겠습니다', en: 'Not a single world left in unrest', goal: ['불안 행성 0곳', 'no worlds in unrest'], check: (_b, n) => n.unrest === 0 },
  { id: 'peace', ko: '새 전쟁은 없습니다', en: 'No new wars', goal: ['임기 중 새 전쟁 없음', 'no new war this term'], check: (_b, _n, t) => !t.newWar },
  { id: 'endwar', ko: '이 전쟁을 끝내겠습니다', en: 'We will end this war', goal: ['다음 총선 전에 모든 전쟁 끝', 'all wars over by the next election'], need: (m) => m.wars > 0, check: (_b, n) => n.wars === 0 },
  { id: 'approval', ko: '국민의 신뢰를 되찾겠습니다', en: "We will win back the people's trust", goal: ['국정 승인도 55 이상', 'government approval 55 or more'], check: (_b, n) => n.approval !== null && n.approval >= 55 },
  { id: 'unity', ko: '모든 정파와 함께 가겠습니다', en: 'We will govern with every faction', goal: ['파벌 평균 승인도 +5 또는 60 이상', 'average faction approval +5, or 60+'], check: (b, n) => n.facApproval !== null && (n.facApproval >= 60 || (b.facApproval !== null && n.facApproval >= b.facApproval + 5)) },
];
export const pledgeOf = (id: string) => PLEDGES.find((p) => p.id === id);
export function pledgeChoices(m: Metrics): Pledge[] { return PLEDGES.filter((p) => !p.need || p.need(m)); }
/** 당이 대신 고르는 공약(마감까지 안 고르면). */
export function autoPledges(m: Metrics): string[] {
  const pick: string[] = [];
  if (m.wars > 0) pick.push('endwar'); else pick.push('peace');
  if ((m.unrest ?? 0) > 0) pick.push('unrest'); else pick.push('stab');
  pick.push((m.approval ?? 50) < 55 ? 'approval' : 'unity');
  return pick.slice(0, DUO.pledges);
}
export function scorePledges(ids: string[], base: Metrics, now: Metrics, newWar: boolean): { kept: string[]; broken: string[]; imp: number } {
  const kept: string[] = [], broken: string[] = [];
  for (const id of ids) { const p = pledgeOf(id); if (!p) continue; (p.check(base, now, { newWar }) ? kept : broken).push(id); }
  return { kept, broken, imp: kept.length * DUO.pledgeKept + broken.length * DUO.pledgeBroken };
}
/** 야당 공약(가치관별 틀 문장, 표시만). */
const OPP_PLEDGES: Record<string, Pair[]> = {
  militarist: [['함대를 두 배로', 'Double the fleet'], ['국경을 지키는 강한 나라', 'A strong nation that guards its borders']],
  pacifist: [['전쟁 대신 협상', 'Talks, not wars'], ['군비를 줄여 민생으로', 'Cut arms spending, fund daily life']],
  authoritarian: [['흔들리지 않는 질서', 'Order that does not waver'], ['강한 지도력', 'Strong leadership']],
  egalitarian: [['모든 시민에게 같은 권리', 'Equal rights for every citizen'], ['권력을 시민에게', 'Power to the citizens']],
  xenophile: [['이웃 종족과의 교류 확대', 'More exchange with our neighbours'], ['이민의 문을 넓게', 'Open the doors to migrants']],
  xenophobe: [['우리 종족이 먼저', 'Our kind first'], ['외계 영향력 차단', 'Shut out alien influence']],
  materialist: [['연구 예산 확대', 'Bigger research budgets'], ['기술로 여는 미래', 'A future built on technology']],
  spiritualist: [['신앙과 전통의 회복', 'Restore faith and tradition'], ['영혼을 잃지 않는 정치', 'Politics that keeps its soul']],
  '': [['정권 교체', 'Time for a change'], ['서민 경제 살리기', 'Revive the everyday economy']],
};
export function oppPledges(ethic: string, m: Metrics): Pair[] {
  const out: Pair[] = [...(OPP_PLEDGES[ethic] || OPP_PLEDGES[''])];
  if (m.wars > 0) out.push(['당장 전쟁을 끝낸다', 'End the war now']);
  else if ((m.unrest ?? 0) > 0) out.push(['불안한 행성부터 살린다', 'Rescue the restless worlds first']);
  else out.push(OPP_PLEDGES[''][1]);
  return out.slice(0, DUO.pledges);
}

// ---- 대정부 질문(야당이 먼저: 틀 문장 + 실제 사실) ----
export interface QtFacts { approval: number | null; unrest: number | null; wars: number; deal: boolean; rammed: boolean; gov: number; majority: boolean; poll: Poll }
export function pickQuestion(f: QtFacts, rng: () => number): { topic: string; q: Pair } {
  const pool: Array<{ topic: string; q: Pair; w: number }> = [];
  if (f.wars > 0) pool.push({ topic: 'war', w: 3, q: ['전쟁이 길어지고 있습니다. 정부는 언제, 어떻게 이 전쟁을 끝낼 생각입니까? 전사자 가족들에게 무엇이라 말하겠습니까?', 'The war drags on. When and how does the government intend to end it, and what will it say to the families of the fallen?'] });
  if ((f.unrest ?? 0) > 0) pool.push({ topic: 'unrest', w: 3, q: [`지금 행성 ${f.unrest}곳이 불안에 빠져 있습니다. 이것이 정부가 말하던 안정입니까?`, `${f.unrest} of our worlds are in unrest right now. Is this the stability the government promised?`] });
  if (f.approval !== null && f.approval < 45) pool.push({ topic: 'approval', w: 3, q: [`국정 승인도가 ${f.approval}입니다. 국민이 등을 돌렸다는 사실을 정부는 인정합니까?`, `Government approval stands at ${f.approval}. Does the government admit the people have turned their backs on it?`] });
  if (f.deal) pool.push({ topic: 'deal', w: 2, q: ['정부는 야당 일부의 숙원 법안을 들어주고 표를 샀습니다. 이것이 거래 정치가 아니면 무엇입니까?', 'The government bought votes by granting part of the opposition its pet bill. If that is not horse-trading, what is?'] });
  if (f.rammed) pool.push({ topic: 'ram', w: 2, q: ['지난번 법안은 날치기로 처리됐습니다. 정부는 의회를 존중할 생각이 있기는 합니까?', 'The last bill was rammed through. Does the government have any respect for parliament at all?'] });
  if (!f.majority) pool.push({ topic: 'minority', w: 2, q: [`정부 쪽 의석은 ${f.gov}석으로 과반이 안 됩니다. 국민이 맡기지 않은 권력을 어떻게 쓰겠다는 겁니까?`, `The government side holds only ${f.gov} seats, short of a majority. How does it mean to wield power the people did not grant it?`] });
  if (f.poll.opp > f.poll.gov) pool.push({ topic: 'poll', w: 1, q: [`여론조사에서 우리 당이 ${f.poll.opp}% 대 ${f.poll.gov}%로 앞섭니다. 정부는 민심의 경고를 듣고 있습니까?`, `The polls have us ahead, ${f.poll.opp}% to ${f.poll.gov}%. Is the government listening to the warning?`] });
  pool.push({ topic: 'priority', w: 1, q: ['정부가 이번 회기에 가장 먼저 하려는 일은 무엇입니까? 구체적으로 답해 주십시오.', 'What is the government\'s first priority this session? Please be specific.'] });
  pool.push({ topic: 'budget', w: 1, q: ['세금은 어디로 가고 있습니까? 국민이 낸 돈이 제대로 쓰이고 있다고 장담할 수 있습니까?', "Where is the tax money going? Can the government guarantee the people's money is well spent?"] });
  const tot = pool.reduce((a, p) => a + p.w, 0); let r = rng() * tot;
  for (const p of pool) { r -= p.w; if (r < 0) return { topic: p.topic, q: p.q }; }
  return { topic: pool[0].topic, q: pool[0].q };
}

// ---- AI(판정만) ----
export interface PolCtx { empire: string; date: string; govParty: string; oppParty: string; oppLeader: string; oppEthic: string; poll: Poll; seats: Record<Side, number>; facts: string[] }
const head = (c: PolCtx) => [
  `Stellaris. Parliament of ${c.empire}, ${c.date}. Two big parties: the governing ${c.govParty} (${c.seats.gov} seats, polling ${c.poll.gov}%) and the opposition ${c.oppParty} (${c.seats.opp} seats, polling ${c.poll.opp}%), undecided ${c.poll.und}%.`,
  `You are ${c.oppLeader}, leader of the ${c.oppParty}${c.oppEthic ? ` (${c.oppEthic} ideals)` : ''}. A sharp, experienced politician: you attack weak answers, but you concede a point when the government answers honestly and concretely. Do not invent events that are not in the facts.`,
  ...(c.facts.length ? ['Facts: ' + c.facts.join(' | ')] : []),
].join('\n');
/** 대정부 질문 답변 판정. score −3..3 = 국민이 보기에 정부가 얼마나 잘 받아쳤나. */
export function qtMessages(c: PolCtx, question: string, answer: string): ChatMessage[] {
  return [
    { role: 'system', content: head(c) + '\nThis is question time. You asked the question below; the head of government has answered. Reply ONLY with JSON: {"rebuttal":"your follow-up in the chamber, 1-3 sentences","score":-3..3,"headline":"a short newspaper headline about this exchange"}. score: +3 = the government clearly won the exchange in the public eye, 0 = even, -3 = a disaster for the government (evasive, arrogant, or caught out).' },
    { role: 'assistant', content: JSON.stringify({ question }) },
    { role: 'user', content: answer },
  ];
}
/** 후보 토론(선거전). turns = 지금까지. 마지막 차례면 final: true 로 총평. */
export function debateMessages(c: PolCtx, opening: string, turns: Array<{ who: 'us' | 'them'; text: string }>, say: string, final: boolean): ChatMessage[] {
  const msgs: ChatMessage[] = [
    { role: 'system', content: head(c) + `\nThis is the televised election debate. You opened with the statement below. ${final ? 'This is the government\'s closing statement: answer with your own short closing line.' : 'Answer the government\'s point and press your attack.'} Reply ONLY with JSON: {"reply":"what you say, 1-3 sentences","score":-3..3,"headline":"${final ? 'a short headline about who won the debate' : ''}"}. score = how the government did in this exchange in the voters' eyes.` },
    { role: 'assistant', content: JSON.stringify({ reply: opening, score: 0 }) },
  ];
  for (const t of turns) msgs.push(t.who === 'us' ? { role: 'user', content: t.text } : { role: 'assistant', content: JSON.stringify({ reply: t.text, score: 0 }) });
  msgs.push({ role: 'user', content: say });
  return msgs;
}
export function parseJudge(raw: string): { text: string; score: number; headline: string } | null {
  const t = String(raw ?? ''); const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null;
  try {
    const v = JSON.parse(t.slice(i, j + 1)) as Record<string, unknown>; const text = String(v.rebuttal ?? v.reply ?? '').trim().slice(0, 700); if (!text) return null;
    return { text, score: Math.max(-3, Math.min(3, Math.round(Number(v.score)) || 0)), headline: String(v.headline ?? '').trim().slice(0, 120) };
  } catch { return null; }
}
/** 토론 첫마디(틀 문장, AI 없음). */
export function debateOpening(oppParty: Pair, pledges: Pair[], f: QtFacts): Pair {
  const attack: Pair = f.wars > 0 ? ['이 정부는 전쟁 하나 끝내지 못했습니다.', 'This government could not even end one war.']
    : (f.unrest ?? 0) > 0 ? [`행성 ${f.unrest}곳이 불안에 떨고 있습니다.`, `${f.unrest} worlds are in unrest.`]
      : f.approval !== null && f.approval < 50 ? ['국민의 절반 이상이 이 정부를 믿지 않습니다.', 'More than half the people do not trust this government.']
        : ['이 정부는 자기 자랑만 늘어놓았습니다.', 'This government has done nothing but praise itself.'];
  return [`${attack[0]} 우리 ${oppParty[0]}은(는) 약속합니다: ${pledges.map((p) => p[0]).join(', ')}. 이제 바꿀 때입니다.`, `${attack[1]} We, the ${oppParty[1]}, promise this: ${pledges.map((p) => p[1]).join(', ')}. It is time for a change.`];
}

// ---- 날짜 ----
const DR = /^(\d+)\.(\d+)\.(\d+)/;
export const monthNo = (d: string | undefined): number | null => { const m = DR.exec(d || ''); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };
export const monthsBetween = (a: string | undefined, b: string | undefined): number => { const x = monthNo(a), y = monthNo(b); return x === null || y === null ? 0 : y - x; };
export function addMonths(d: string, n: number): string { const m = DR.exec(d || ''); if (!m) return d; const t = Number(m[1]) * 12 + Number(m[2]) - 1 + n; return `${Math.floor(t / 12)}.${String((t % 12) + 1).padStart(2, '0')}.${m[3].padStart(2, '0')}`; }
