// 양당 정치(2026-11-06) — 앱 쪽. 규칙·문구: src/twoparty.ts · 화면: ui/office-twoparty.js(집무실 「의회」 맨 위 「양당」 칸).
// 의회(parliament-app)의 파벌 의석을 두 거대 정당으로 묶고, 매달(월간 상황) 정당 지지율·흐름을 계산한다.
// 야당이 먼저 움직인다: 4년마다 대정부 질문(답은 플레이어가 쓰고 AI 가 판정) · 총선 6개월 전 선거전(공약 3개·후보 토론) · 총선(득표·의석 → 의회 의석 이동).
// 자유 정부(civic 'free')에서만. 민주정은 흔들림 1.5배·총선 6년마다, 그 밖의 자유 정부는 10년마다. 저장: sllm_twoparty.json { saves: { [세이브]: DuoSave } }
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import type { StateSnapshot } from '../gamestate';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { redactKey } from '../aiclient';
import { onGameSnapshot, gameState } from './gamestate-app';
import { moodView, moodNudge } from './mood-app';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { civicRegimeNow } from './civic-app';
import { office } from './office-app';
import { parlNow, parlShiftSeats } from './parliament-app';
import {
  type Pair, type Side, type Imp, type Metrics, type Poll, type PolCtx, type QtFacts, type SeatIn,
  DUO, partyNames, assignBlocs, sumBlocs, pollOf, tickSwing, swingNow, addImp, votesOf, seatsOf, spread,
  PLEDGES, pledgeOf, pledgeChoices, autoPledges, scorePledges, oppPledges, pickQuestion, qtMessages, debateMessages, parseJudge, debateOpening,
  monthsBetween, addMonths,
} from '../twoparty';

interface Turn { who: 'us' | 'them'; text: string }
export interface DuoSave {
  bloc: Record<string, Side>; names?: { gov: Pair; opp: Pair }; base: number; imp: Imp[];
  firstSeen?: string; lastElection?: string; nextElection?: string; inOffice?: string; warSince?: string; newWar?: boolean; lastWars?: number; lastSeen?: string;
  campaign?: { started: string; pledges?: string[]; auto?: boolean; opp: Pair[]; report?: { kept: string[]; broken: string[] }; debate?: { opening: Pair; turns: Turn[]; score: number; done?: boolean; headline?: string } };
  term?: { pledges: string[]; base: Metrics; since: string };
  qt?: { topic: string; q: Pair; asked: string; due: string; answer?: string; rebuttal?: string; score?: number; headline?: string; ignored?: boolean };
  nextQt?: string;
  polls: Array<{ d: string; gov: number; opp: number; und: number }>;
  history: Array<{ date: string; vote: { gov: number; opp: number }; seats: { gov: number; opp: number }; names: { gov: Pair; opp: Pair }; kept?: number; broken?: number }>;
  log: Array<{ d: string; t: Pair }>;
}
const empty = (): DuoSave => ({ bloc: {}, base: 0, imp: [], polls: [], history: [], log: [] });

const file = () => path.join(app.getPath('userData'), 'sllm_twoparty.json');
let store: Record<string, DuoSave> | null = null;
const isPair = (v: unknown): v is Pair => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string';
function fix(v: unknown): DuoSave {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<DuoSave>, s = empty();
  if (o.bloc && typeof o.bloc === 'object') for (const [k, b] of Object.entries(o.bloc)) if (b === 'gov' || b === 'opp') s.bloc[k] = b;
  if (o.names && isPair(o.names.gov) && isPair(o.names.opp)) s.names = { gov: o.names.gov, opp: o.names.opp };
  s.base = Number.isFinite(Number(o.base)) ? Number(o.base) : 0;
  s.imp = Array.isArray(o.imp) ? o.imp.filter((x) => x && Number.isFinite(Number(x.v)) && isPair(x.why)).slice(-12) : [];
  for (const k of ['firstSeen', 'lastElection', 'nextElection', 'inOffice', 'warSince', 'lastSeen', 'nextQt'] as const) if (typeof o[k] === 'string') (s as unknown as Record<string, unknown>)[k] = o[k];
  s.newWar = !!o.newWar; s.lastWars = Number(o.lastWars) || 0;
  if (o.campaign && typeof o.campaign.started === 'string') s.campaign = { ...o.campaign, opp: Array.isArray(o.campaign.opp) ? o.campaign.opp.filter(isPair) : [] };
  if (o.term && Array.isArray(o.term.pledges) && o.term.base) s.term = o.term;
  if (o.qt && isPair(o.qt.q) && typeof o.qt.due === 'string') s.qt = o.qt;
  s.polls = Array.isArray(o.polls) ? o.polls.filter((p) => p && typeof p.d === 'string').slice(-60) : [];
  s.history = Array.isArray(o.history) ? o.history.slice(-12) : [];
  s.log = Array.isArray(o.log) ? o.log.filter((x) => x && isPair(x.t)).slice(-30) : [];
  return s;
}
function all(): Record<string, DuoSave> {
  if (store) return store; store = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && j.saves && typeof j.saves === 'object') for (const [k, v] of Object.entries(j.saves)) store[safeKey(k)] = fix(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'twoparty', error: e }); }
  return store;
}
let timer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (timer) return; timer = setTimeout(() => { timer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'twoparty', error: e }); } }, 1500); }
const entry = (sid: string): DuoSave => (all()[safeKey(sid)] ??= empty());
const note = (s: DuoSave, t: Pair) => { s.log = [...s.log, { d: ctx.gameDate || '', t }].slice(-30); };
const world = (t: Pair) => { try { chronNoteWorld(`${ctx.gameDate || ''} ${L(...t)}`, true); } catch { /* 연대기는 덤 */ } };
const toast = (title: Pair, body: Pair) => { (office as { toastGo: string }).toastGo = 'parliament' as never; ctx.notify({ kind: 'office', title: L(...title), body: L(...body), action: L('의회', 'Parliament') }); };

const snapOf = (sid: string): StateSnapshot | null => (gameState.last && gameState.last.sid === sid ? gameState.last : null);
const demo = (sid: string) => snapOf(sid)?.authority === 1;
const every = (sid: string) => (demo(sid) ? DUO.everyDemo : DUO.everyOther);
const approvalNow = (): number | null => { const v = moodView(); const a = v.parts?.approval ?? v.score; return a === null || a === undefined ? null : Math.round(a); };
function metrics(sid: string): Metrics {
  const sn = snapOf(sid), m = sn?.mood, facs = sn?.factions ?? [];
  return {
    stab: m && m.cnt > 0 ? Math.round(m.sum / m.cnt) : null, unrest: m ? m.low : null, wars: sn?.wars.length ?? 0, approval: approvalNow(),
    facApproval: facs.length ? Math.round(facs.reduce((a, f) => a + f.approval, 0) / facs.length * 100) : null,
  };
}

/** 지금 두 당(의회 의석·지지율). 자유 정부가 아니거나 의회 자료가 없으면 null. */
function current(sid: string) {
  const p = parlNow(sid); if (!p) return null;
  const s = entry(sid), seats: SeatIn[] = p.c.seats.map((x) => ({ ...x, approval: p.facs.find((f) => f.key === x.key)?.approval ?? null, support: p.facs.find((f) => f.key === x.key)?.support ?? 0 }));
  const bloc = assignBlocs(seats, p.c.ruling, p.c.opp, s.bloc), sum = sumBlocs(seats, bloc);
  const gEth = seats.find((x) => x.key === p.c.ruling)?.ethic ?? '', oEth = seats.find((x) => x.key === p.c.opp)?.ethic ?? '';
  const names = s.names ?? partyNames(gEth, oEth);
  const date = ctx.gameDate || '';
  const sw = swingNow(s, { approval: approvalNow(), monthsSinceElection: s.lastElection ? monthsBetween(s.lastElection, date) : null, yearsInOffice: Math.floor(monthsBetween(s.inOffice || date, date) / 12), demo: demo(sid), warMonths: s.warSince ? monthsBetween(s.warSince, date) : 0 });
  const poll = pollOf(sum.support, sw);
  return { p, s, seats, bloc, sum, names, gEth, oEth, poll, swing: sw };
}
type Cur = NonNullable<ReturnType<typeof current>>;
function polCtx(sid: string, c: Cur): PolCtx {
  const m = metrics(sid);
  const facts = [
    `government approval ${m.approval ?? '?'}`, ...(m.stab !== null ? [`average planetary stability ${m.stab}`] : []), ...(m.unrest ? [`${m.unrest} worlds in unrest`] : []),
    ...(m.wars ? [`${m.wars} war(s) ongoing`] : ['at peace']), c.p.c.majority ? 'the government side has a majority' : 'the government side has NO majority',
    ...c.p.log.slice(-3),
  ];
  return { empire: ctx.playerName || 'the empire', date: ctx.gameDate || '', govParty: c.names.gov[1], oppParty: c.names.opp[1], oppLeader: c.p.oppLeader, oppEthic: c.oEth, poll: c.poll, seats: c.sum.seats, facts };
}
function qtFacts(sid: string, c: Cur): QtFacts {
  const m = metrics(sid); return { approval: m.approval, unrest: m.unrest, wars: m.wars, deal: c.p.deal, rammed: c.p.log.some((t) => /날치기|rammed/.test(t)), gov: c.p.c.gov, majority: c.p.c.majority, poll: c.poll };
}

// ---- 매달 ----
function onSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId) return;
  setTimeout(() => { try { tick(snap); } catch (err) { logDiagnostic('warn', 'twoparty.tick_failed', { error: String(err) }); } }, 0);
}
function tick(snap: StateSnapshot): void {
  if (snap.sid !== ctx.curSaveId || civicRegimeNow() !== 'free') return;
  const sid = snap.sid, date = snap.date, s = entry(sid); if (!date || s.lastSeen === date) return;
  const c0 = current(sid); if (!c0) return;
  s.lastSeen = date;
  if (!s.firstSeen) { // 처음 본 세이브: 첫 총선은 1년 반~한 임기 뒤
    s.firstSeen = date; s.inOffice = date; s.names = c0.names;
    s.nextElection = addMonths(date, Math.max(DUO.firstMinMonths, Math.floor(every(sid) * 12 * (0.4 + Math.random() * 0.6))));
    s.nextQt = addMonths(date, DUO.qtFirstMin + Math.floor(Math.random() * (DUO.qtEveryMonths - DUO.qtFirstMin + 1)));
    note(s, ['양당 체제: 집권당과 제1야당이 맞서는 의회가 자리를 잡았다.', 'Two-party system: a parliament of a governing party and a main opposition took shape.']);
  }
  s.bloc = c0.bloc;
  { // 예전(몇 달 간격)에 잡아 둔 다음 질문 날짜를 4년 간격으로 늦춘다
    const floor = s.qt ? addMonths(s.qt.asked, DUO.qtEveryMonths) : s.firstSeen ? addMonths(s.firstSeen, DUO.qtFirstMin) : '';
    if (floor && (!s.nextQt || monthsBetween(s.nextQt, floor) > 0)) s.nextQt = floor;
  }
  // 전쟁 흐름
  const wars = snap.wars.length;
  if (wars > 0 && !s.warSince) s.warSince = date; if (wars === 0) delete s.warSince;
  if (wars > (s.lastWars ?? 0)) s.newWar = true; s.lastWars = wars;
  tickSwing(s, { approval: approvalNow(), monthsSinceElection: s.lastElection ? monthsBetween(s.lastElection, date) : null, yearsInOffice: Math.floor(monthsBetween(s.inOffice || date, date) / 12), demo: demo(sid), warMonths: s.warSince ? monthsBetween(s.warSince, date) : 0 });
  const c = current(sid)!;
  s.polls = [...s.polls.filter((p) => p.d.slice(0, 7) !== date.slice(0, 7)), { d: date, ...c.poll }].slice(-60);
  // 대정부 질문: 기한이 지나면 「답변 회피」, 때가 되면 새 질문(선거전 중에는 쉼)
  if (s.qt && !s.qt.answer && !s.qt.ignored && monthsBetween(s.qt.due, date) >= 0) {
    s.qt.ignored = true; addImp(s, DUO.qtIgnore, date, ['대정부 질문 답변 회피', 'Dodged question time']);
    const t: Pair = [`${c.p.oppLeader} 야당 대표의 대정부 질문에 정부가 끝내 답하지 않았다. 야당은 "국민을 무시한 처사"라고 비판했다.`, `The government never answered opposition leader ${c.p.oppLeader}'s question. The opposition called it "contempt for the people".`];
    note(s, t); world(t);
  }
  if (!s.campaign && (!s.qt || s.qt.answer || s.qt.ignored) && s.nextQt && monthsBetween(s.nextQt, date) >= 0) {
    const q = pickQuestion(qtFacts(sid, c), Math.random);
    s.qt = { topic: q.topic, q: q.q, asked: date, due: addMonths(date, DUO.qtDueMonths) };
    s.nextQt = addMonths(date, DUO.qtEveryMonths);
    note(s, [`${c.p.oppLeader} 야당 대표가 대정부 질문에 나섰다.`, `Opposition leader ${c.p.oppLeader} rose for question time.`]);
    toast(['대정부 질문', 'Question time'], [`${c.p.oppLeader}(${c.names.opp[0]}): ${q.q[0]} — ${DUO.qtDueMonths}개월 안에 답하세요.`, `${c.p.oppLeader} (${c.names.opp[1]}): ${q.q[1]} — answer within ${DUO.qtDueMonths} months.`]);
  }
  // 선거전 시작
  if (!s.campaign && s.nextElection && monthsBetween(date, s.nextElection) <= DUO.campaignMonths) startCampaign(sid, s, c);
  // 선거전: 공약 마감(두 달 안에 안 고르면 당이 정함)
  if (s.campaign && !s.campaign.pledges && monthsBetween(s.campaign.started, date) >= 2) {
    s.campaign.pledges = autoPledges(metrics(sid)); s.campaign.auto = true;
    note(s, ['정부가 공약을 고르지 않아 당 지도부가 대신 공약을 발표했다.', 'With no word from the government, the party leadership announced the pledges itself.']);
  }
  // 총선
  if (s.nextElection && monthsBetween(s.nextElection, date) >= 0) election(sid, s);
  save(); push();
}
function startCampaign(sid: string, s: DuoSave, c: Cur): void {
  const date = ctx.gameDate || '', m = metrics(sid);
  s.campaign = { started: date, opp: oppPledges(c.oEth, m) };
  if (s.term) { // 지난 임기 공약 성적표
    const r = scorePledges(s.term.pledges, s.term.base, m, !!s.newWar);
    s.campaign.report = { kept: r.kept, broken: r.broken };
    addImp(s, r.imp, date, ['지난 공약 성적표', 'Report card on last pledges']);
    const t: Pair = [`언론이 집권당의 지난 공약 성적표를 냈다: 지킨 약속 ${r.kept.length}개, 어긴 약속 ${r.broken.length}개.`, `The press published the governing party's report card: ${r.kept.length} pledge(s) kept, ${r.broken.length} broken.`];
    note(s, t); world(t);
  }
  const t: Pair = [`총선이 ${DUO.campaignMonths}개월 앞으로 다가왔다. ${c.names.gov[0]}과(와) ${c.names.opp[0]}의 선거전이 시작됐다.`, `The general election is ${DUO.campaignMonths} months away. The campaign between the ${c.names.gov[1]} and the ${c.names.opp[1]} has begun.`];
  note(s, t); world(t);
  toast(['선거전 시작', 'Campaign begins'], [`${s.nextElection} 총선. 의회 화면에서 공약 ${DUO.pledges}개를 골라 발표하고, 후보 토론에 나가세요.`, `Election on ${s.nextElection}. Pick ${DUO.pledges} pledges in Parliament and take part in the debate.`]);
}
function election(sid: string, s: DuoSave): void {
  const c = current(sid); if (!c) return;
  const date = ctx.gameDate || '', total = c.sum.seats.gov + c.sum.seats.opp;
  const v = votesOf(c.poll, Math.random), seat = seatsOf(v, total);
  const dGov = seat.gov - c.sum.seats.gov;
  const moves = { ...spread(dGov, c.sum.members.gov), ...spread(-dGov, c.sum.members.opp) };
  const won = v.gov >= v.opp, need = 101, govSide = c.p.c.gov + dGov;
  const result: Pair = won
    ? [`${date} 총선: ${c.names.gov[0]} ${v.gov}% · ${c.names.opp[0]} ${v.opp}%. 집권당이 이겼다(${seat.gov}석 대 ${seat.opp}석).`, `${date} general election: ${c.names.gov[1]} ${v.gov}%, ${c.names.opp[1]} ${v.opp}%. The governing party won (${seat.gov} seats to ${seat.opp}).`]
    : [`${date} 총선: ${c.names.opp[0]} ${v.opp}% · ${c.names.gov[0]} ${v.gov}%. 야당이 이겼다(${seat.opp}석 대 ${seat.gov}석).`, `${date} general election: ${c.names.opp[1]} ${v.opp}%, ${c.names.gov[1]} ${v.gov}%. The opposition won (${seat.opp} seats to ${seat.gov}).`];
  parlShiftSeats(sid, moves, L(...result));
  const speech: Pair = won
    ? [`${c.p.oppLeader} 야당 대표가 패배를 인정했다: "국민의 뜻을 겸허히 받아들입니다. 그러나 우리는 지켜볼 것입니다."`, `Opposition leader ${c.p.oppLeader} conceded: "We humbly accept the people's verdict. But we will be watching."`]
    : [`${c.p.oppLeader} 야당 대표가 승리를 선언했다: "국민이 바꾸라고 명령했습니다. 이 정부는 이제 우리 앞에서 답해야 합니다."`, `Opposition leader ${c.p.oppLeader} declared victory: "The people have ordered change. This government must now answer to us."`];
  note(s, result); note(s, speech); world(result); world(speech);
  s.history = [...s.history, { date, vote: v, seats: seat, names: c.names, ...(s.campaign?.report ? { kept: s.campaign.report.kept.length, broken: s.campaign.report.broken.length } : {}) }].slice(-12);
  s.term = { pledges: s.campaign?.pledges ?? autoPledges(metrics(sid)), base: metrics(sid), since: date };
  s.lastElection = date; s.nextElection = addMonths(date, every(sid) * 12); s.newWar = false; s.campaign = undefined;
  s.imp = s.imp.filter((x) => x.why[1] !== 'Report card on last pledges'); s.base = 0;
  if (won) moodNudge(3, L('총선 승리', 'Election victory')); else moodNudge(-3, L('총선 패배', 'Election defeat'));
  toast(won ? ['총선 승리', 'Election won'] : ['총선 패배', 'Election lost'], won
    ? [`득표 ${v.gov}% 대 ${v.opp}%. 정부 쪽 의석 약 ${govSide}석.`, `Vote ${v.gov}% to ${v.opp}%. Government side now about ${govSide} seats.`]
    : [`득표 ${v.gov}% 대 ${v.opp}%. 정부 쪽 의석 약 ${govSide}석${govSide < need ? ' — 여소야대, 법안 통과가 어려워집니다' : ''}.`, `Vote ${v.gov}% to ${v.opp}%. Government side now about ${govSide} seats${govSide < need ? ' — a hostile parliament; bills will be hard to pass' : ''}.`]);
}

// ---- 플레이어 행동 ----
function guard(): { sid: string; s: DuoSave; c: Cur } {
  const sid = ctx.curSaveId || ''; if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (civicRegimeNow() !== 'free') throw new Error(L('자유로운 의회가 있는 정부 형태에서만 할 수 있습니다.', 'Only possible under a government with a free parliament.'));
  const c = current(sid); if (!c) throw new Error(L('의회 자료가 아직 없습니다. 한 달 뒤에 다시 해 주세요.', 'No parliament data yet. Try again next month.'));
  return { sid, s: entry(sid), c };
}
async function choosePledges(idsIn: unknown): Promise<string> {
  const { sid, s, c } = guard(); if (!s.campaign) throw new Error(L('선거전 중에만 공약을 발표할 수 있습니다.', 'Pledges can only be announced during a campaign.'));
  if (s.campaign.pledges) throw new Error(L('공약은 이미 발표했습니다.', 'The pledges have already been announced.'));
  const ok = new Set(pledgeChoices(metrics(sid)).map((p) => p.id));
  const ids = [...new Set((Array.isArray(idsIn) ? idsIn : []).map(String))].filter((x) => ok.has(x));
  if (ids.length !== DUO.pledges) throw new Error(L(`공약을 ${DUO.pledges}개 골라 주세요.`, `Pick ${DUO.pledges} pledges.`));
  s.campaign.pledges = ids;
  const list = ids.map((i) => pledgeOf(i)!);
  const t: Pair = [`${c.names.gov[0]}이(가) 공약을 발표했다: ${list.map((p) => `「${p.ko}」`).join(', ')}.`, `The ${c.names.gov[1]} announced its pledges: ${list.map((p) => `"${p.en}"`).join(', ')}.`];
  note(s, t); world(t); save(); push();
  return L(`공약을 발표했습니다. 다음 총선 때 언론이 지켰는지 따집니다.`, 'Pledges announced. At the next election the press will check whether you kept them.');
}
async function answer(textIn: unknown): Promise<string> {
  const { sid, s, c } = guard(), q = s.qt; if (!q || q.answer || q.ignored) throw new Error(L('답할 질문이 없습니다.', 'There is no question to answer.'));
  const text = String(textIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200), date = ctx.gameDate || '';
  if (!text) { // 답변 거부
    q.ignored = true; addImp(s, DUO.qtIgnore, date, ['대정부 질문 답변 거부', 'Refused to answer question time']);
    const t: Pair = [`정부가 ${c.p.oppLeader} 야당 대표의 질문에 답변을 거부했다.`, `The government refused to answer opposition leader ${c.p.oppLeader}.`]; note(s, t); world(t); save(); push();
    return L('답변을 거부했습니다. 지지율이 조금 떨어집니다.', 'You refused to answer. Support dips a little.');
  }
  let r: ReturnType<typeof parseJudge> = null;
  try { r = parseJudge(await ctx.ai.chat(qtMessages(polCtx(sid, c), q.q[1], text), { purpose: 'parliament-qt', json: true, maxTokens: DUO.tokens })); }
  catch (err) { throw new Error(L('AI가 답하지 못했습니다: ', 'The AI did not answer: ') + redactKey((err as Error).message)); }
  if (!r) throw new Error(L('판정을 읽지 못했습니다. 다시 답해 보세요.', 'Could not read the verdict. Try answering again.'));
  q.answer = text; q.rebuttal = r.text; q.score = r.score; q.headline = r.headline;
  addImp(s, r.score * DUO.qtScore, date, ['대정부 질문', 'Question time']);
  const t: Pair = [`대정부 질문: ${r.headline || (r.score > 0 ? '정부가 판정승' : r.score < 0 ? '정부, 진땀' : '팽팽한 공방')}`, `Question time: ${r.headline || (r.score > 0 ? 'the government came out ahead' : r.score < 0 ? 'the government squirmed' : 'an even exchange')}`];
  note(s, t); world(t); save(); push();
  return L(r.score > 0 ? '잘 받아쳤습니다. 집권당 지지율이 오릅니다.' : r.score < 0 ? '야당에 밀렸습니다. 집권당 지지율이 떨어집니다.' : '팽팽했습니다.', r.score > 0 ? 'Well handled. Support for the governing party rises.' : r.score < 0 ? 'The opposition got the better of you. Support falls.' : 'An even exchange.');
}
async function debate(textIn: unknown): Promise<string> {
  const { sid, s, c } = guard(), cp = s.campaign; if (!cp) throw new Error(L('선거전 중에만 토론이 열립니다.', 'Debates are held only during a campaign.'));
  if (!cp.pledges) throw new Error(L('먼저 공약을 발표해 주세요.', 'Announce your pledges first.'));
  const d = cp.debate ??= { opening: debateOpening(c.names.opp, cp.opp, qtFacts(sid, c)), turns: [], score: 0 };
  if (d.done) throw new Error(L('토론은 이미 끝났습니다.', 'The debate is already over.'));
  const say = String(textIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000); if (!say) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
  const final = d.turns.filter((t) => t.who === 'us').length + 1 >= DUO.debateTurns;
  let r: ReturnType<typeof parseJudge> = null;
  try { r = parseJudge(await ctx.ai.chat(debateMessages(polCtx(sid, c), d.opening[1], d.turns, say, final), { purpose: 'parliament-debate', json: true, maxTokens: DUO.tokens })); }
  catch (err) { throw new Error(L('AI가 답하지 못했습니다: ', 'The AI did not answer: ') + redactKey((err as Error).message)); }
  if (!r) throw new Error(L('답을 읽지 못했습니다. 다시 말해 보세요.', 'Could not read the reply. Try again.'));
  d.turns.push({ who: 'us', text: say }, { who: 'them', text: r.text }); d.score += r.score;
  if (final) {
    d.done = true; d.headline = r.headline; const date = ctx.gameDate || '';
    addImp(s, d.score * DUO.debateScore / DUO.debateTurns, date, ['후보 토론', 'Election debate']);
    const t: Pair = [`후보 토론: ${r.headline || (d.score > 0 ? '정부 쪽 판정승' : d.score < 0 ? '야당 대표가 토론을 주도' : '승부를 가리지 못함')}`, `Election debate: ${r.headline || (d.score > 0 ? 'the government side won on points' : d.score < 0 ? 'the opposition leader dominated' : 'no clear winner')}`];
    note(s, t); world(t);
  }
  save(); push();
  return final ? L(d.score > 0 ? '토론에서 이겼습니다.' : d.score < 0 ? '토론에서 밀렸습니다.' : '토론은 팽팽하게 끝났습니다.', d.score > 0 ? 'You won the debate.' : d.score < 0 ? 'You lost the debate.' : 'The debate ended even.') : '';
}

/** 다른 기능이 집권당 흐름을 흔든다(추문 −, 큰 성과 + 등). v −12..12. */
export function duoBump(v: number, why: Pair): void { const sid = ctx.curSaveId; if (!sid || civicRegimeNow() !== 'free') return; addImp(entry(sid), v, ctx.gameDate || '', why); save(); }

export function duoView() {
  const sid = ctx.curSaveId || '', reg = civicRegimeNow(); if (!sid) return { sid: '', regime: reg };
  if (reg !== 'free') return { sid, regime: reg, on: false };
  const c = current(sid); if (!c) return { sid, regime: reg, on: false, wait: true };
  const s = c.s, date = ctx.gameDate || '', m = metrics(sid);
  const party = (b: Side) => ({ name: c.names[b], seats: c.sum.seats[b], poll: c.poll[b], leader: b === 'opp' ? c.p.oppLeader : '', members: c.sum.members[b].map((x) => ({ name: x.name, seats: x.seats, ethic: x.ethic })) });
  const plist = (ids?: string[]) => (ids ?? []).map((i) => pledgeOf(i)).filter(Boolean).map((p) => ({ id: p!.id, ko: p!.ko, en: p!.en, goal: p!.goal }));
  const termLive = s.term ? scorePledges(s.term.pledges, s.term.base, m, !!s.newWar) : null;
  return {
    sid, regime: reg, on: true, date, demo: demo(sid), every: every(sid), gov: party('gov'), opp: party('opp'), und: c.poll.und, ind: c.sum.ind, swing: c.swing,
    majority: c.p.c.majority, govSide: c.p.c.gov,
    nextElection: s.nextElection || '', monthsLeft: s.nextElection ? monthsBetween(date, s.nextElection) : null,
    polls: s.polls.slice(-24),
    campaign: s.campaign ? {
      started: s.campaign.started, pledges: plist(s.campaign.pledges), auto: !!s.campaign.auto, opp: s.campaign.opp,
      choices: s.campaign.pledges ? [] : pledgeChoices(m).map((p) => ({ id: p.id, ko: p.ko, en: p.en, goal: p.goal })), need: DUO.pledges,
      report: s.campaign.report ? { kept: plist(s.campaign.report.kept), broken: plist(s.campaign.report.broken) } : null,
      debate: s.campaign.debate ? { opening: s.campaign.debate.opening, turns: s.campaign.debate.turns, done: !!s.campaign.debate.done, headline: s.campaign.debate.headline || '', score: s.campaign.debate.score, left: DUO.debateTurns - s.campaign.debate.turns.filter((t) => t.who === 'us').length }
        : { opening: debateOpening(c.names.opp, s.campaign.opp, qtFacts(sid, c)), turns: [], done: false, headline: '', score: 0, left: DUO.debateTurns },
    } : null,
    term: s.term ? { since: s.term.since, pledges: plist(s.term.pledges).map((p) => ({ ...p, ok: !!termLive?.kept.includes(p.id) })) } : null,
    qt: s.qt ? { q: s.qt.q, asked: s.qt.asked, due: s.qt.due, answer: s.qt.answer || '', rebuttal: s.qt.rebuttal || '', headline: s.qt.headline || '', score: s.qt.score ?? null, ignored: !!s.qt.ignored, open: !s.qt.answer && !s.qt.ignored } : null,
    history: s.history.slice(-5).reverse(), log: s.log.slice(-8).reverse(),
  };
}
function push(): void { try { const v = duoView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('duoUpdate', v); } catch { /* 창 없음 */ } }

export function registerTwoParty(): void {
  onGameSnapshot(onSnapshot, 'parliament');
  registerSecFacts({ id: 'Two-party politics', kw: ['정당', '집권당', '야당', '선거', '총선', '공약', '지지율', '여론조사', 'party', 'election', 'pledge', 'poll', 'opposition'], facts: (sid) => {
    if (sid !== ctx.curSaveId) return []; const v = duoView() as ReturnType<typeof duoView> & { on?: boolean; gov?: { name: Pair; poll: number; seats: number }; opp?: { name: Pair; poll: number; seats: number; leader: string } };
    if (!v.on || !v.gov || !v.opp) return [];
    return [`Parties: governing ${v.gov.name[1]} ${v.gov.poll}% (${v.gov.seats} seats) vs opposition ${v.opp.name[1]} led by ${v.opp.leader} ${v.opp.poll}% (${v.opp.seats} seats); undecided ${(v as { und?: number }).und}%. Next general election ${(v as { nextElection?: string }).nextElection || '?'}.`];
  } });
  ipcMain.handle('duoState', async () => duoView());
  const wrap = (fn: () => Promise<string>) => async () => { try { const t = await fn(); return { ok: true, text: t, state: duoView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: duoView() }; } };
  ipcMain.handle('duoPledge', async (_e, ids: unknown) => wrap(() => choosePledges(ids))());
  ipcMain.handle('duoAnswer', async (_e, text: unknown) => wrap(() => answer(text))());
  ipcMain.handle('duoDebate', async (_e, text: unknown) => wrap(() => debate(text))());
}
// 순수 검사용
export const duoTest = { fix, PLEDGES };
