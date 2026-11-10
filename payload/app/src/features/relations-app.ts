// 인물 관계 묶음(2026-10-23 집 PC 초안): 관계 장부 + 해마다 한 번 열리는 사교회 + 인간관계 불만 특성.
// 규칙: src/relations.ts(장부)·src/social-event.ts(사교회·연애·화해·불만 판정)·src/discontent.ts(게임 특성). 화면: ui/office-social.js(집무실 「사교회」), ui/office-relations.js(인물 카드 「인간관계」).
// 슈뢰딩거의 토큰(30): 초대·교류·연애·화해·불만은 모두 앱 난수와 저장 상태로 판정한다. AI 는 통치자가 대화에 합류한 장면 서술에만 쓴다.
// 사용자 확정 수치는 SOCIAL(식량 20·기본 2월·교류 60/30/10 등). 비서는 사교회에 오지 않는다(29). 통치자 본인 연애·청혼은 wedding.ts(다음 단계).
import { app, ipcMain, BrowserWindow, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { addReservedMonths, officialHolidayMonths } from './official-holidays-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf, onLeaderOut } from './people-app';
import type { StateSnapshot } from '../gamestate';
import { type RelationLedger, type Pid, emptyLedger, pairKey, getPair } from '../relations';
import { type SocialSeason, type Attendee, type Exchange, type ExchangeResult, SOCIAL, eligibleForRomance, newSeason, socialDue, canSetSocialMonth, inviteOutcome, attendees, rollExchange, applyExchange, romanceInterestCheck, datingCheck, pickBackgroundPairs, finishSeason, autoFinish, breakupYearly, breakupTick, npcWeddingDue, socialCostCommand } from '../social-event';
import { type LeaderClass, DISCONTENT_EFFECT, discontentCommand, parseDiscontentReply, relationCard } from '../discontent';
import { type MedParty, MED, conflictBrief, storyMessages, mediationMessages, verdictMessages, parseVerdict } from '../mediation-talk';
import { resolveConflict } from '../relations';
import { canMediate } from '../discontent';
import { buildRelGraph } from '../relgraph'; // 인물 관계도(2026-11-09)
import { selectedLanguage } from './settings-ui';
import { type HallSpot, type HallLine, type HallMember, type Mood, HALL, hallGroups, hallTalkMessages, parseHallReply, hallMoodMessages, parseHallMoods, rollMood } from '../social-hall';
import { classKey } from '../speciesClass';
import { type MarriageMark, MARRIAGE_EFFECT, isLeaderClass, marriageTraitCommand, parseMarriageTraitReply, markMarried, markBereaved, markSeparated, sanitizeMarks } from '../marriage-traits';

/** 행동 횟수 제한 없음(29 「자유 이동·플레이어 직접 종료」 확정). 같은 모임·같은 두 사람은 행사당 한 번만 판정한다. */
interface HallTalk { lines: HallLine[]; judged: boolean; outcome?: { pid: Pid; result: ExchangeResult }[] }

interface RelBook { sid: string; ledger: RelationLedger; seasons: SocialSeason[]; scene: Record<string, { turns: { who: string; text: string; result: ExchangeResult; kind: 'join' | 'intro' }[]; used: number; /** 연회장 모임 배치(행사 ID 로 고정). */ groups?: { spot: HallSpot; members: Pid[] }[]; /** 모임별 실제 대화(자리 → 대화). */ talks?: Record<string, HallTalk> }>; /** NPC 부부 결혼·사별 특성(사용자 확정 2026-10-23). */ marks: Record<Pid, MarriageMark>; /** 통치자의 만남 주선 기록: 연도 → 횟수. */ arranged: Record<string, number>; /** 사교회 개최 월(29: 기본 2월, 국가기념일 화면에서 월만 바꿀 수 있음). 저장된 값은 로드 때 2월로 덮어쓰지 않는다. */ socialMonth?: number }
const dir = () => path.join(app.getPath('userData'), 'relations');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, RelBook>();
/** 앱을 켤 때 열려 있던 행사(38: 진행 중 앱 종료 → 다음 실행에서 이어 가지 않고 배경 교류로 마무리). */
const staleOpen = new Set<string>();
/** 저장 정리: 장부 모양만 확인하고, 열려 있던 행사는 그대로 둔다(같은 행사 ID 로 이어서). 행사는 최근 10개. */
export function sanitizeRelBook(x: unknown, sid: string): RelBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<RelBook>, base = emptyLedger(sid);
  const lg = (o.ledger && typeof o.ledger === 'object' ? o.ledger : {}) as Partial<RelationLedger>;
  const obj = <T>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : d);
  const ledger: RelationLedger = { ...base, pairs: obj(lg.pairs, {}), conflicts: obj(lg.conflicts, {}), discontent: obj(lg.discontent, {}), discontentJudged: obj(lg.discontentJudged, {}), playerKnows: { pairs: Array.isArray(lg.playerKnows?.pairs) ? lg.playerKnows!.pairs : [], conflicts: Array.isArray(lg.playerKnows?.conflicts) ? lg.playerKnows!.conflicts : [] }, sid };
  const seasons = (Array.isArray(o.seasons) ? o.seasons : []).filter((s): s is SocialSeason => !!s && typeof s === 'object' && typeof s.eventId === 'string' && Number.isInteger(s.year) && Array.isArray(s.exchanges)).slice(-10);
  const sm = Number(o.socialMonth); return { sid, ledger, seasons, scene: obj(o.scene, {}), marks: sanitizeMarks(o.marks), arranged: obj(o.arranged, {}), ...(Number.isInteger(sm) && sm >= 1 && sm <= 12 ? { socialMonth: sm } : {}) };
}
export function relBookOf(sid: string): RelBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeRelBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); for (const s of b.seasons) if (s.stage !== 'closed') staleOpen.add(s.eventId); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'relations', error: e }); b = sanitizeRelBook(null, sid); }
  books.set(sid, b); return b;
}
export function saveRelations(sid: string): void { save(sid); }
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  b.seasons = b.seasons.slice(-10); for (const k of Object.keys(b.scene)) if (!b.seasons.some((s) => s.eventId === k)) delete b.scene[k];
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'relations', error: e }); }
}

// ---- 사람
const live = (sid: string) => peopleOf(sid).filter((p) => !p.gone);
const rulerOf = (sid: string) => live(sid).find((p) => p.ruler);
const rulerPidOf = (sid: string): Pid => { const r = rulerOf(sid); return r ? `p:${r.lid}` : ''; };
const namesOf = (sid: string): Record<Pid, string> => Object.fromEntries(peopleOf(sid).map((p) => [`p:${p.lid}`, p.name]));
const partnerOf = (led: RelationLedger, pid: Pid): Pid | undefined => { for (const r of Object.values(led.pairs)) if ((r.a === pid || r.b === pid) && (r.romance === 'dating' || r.romance === 'engaged' || r.romance === 'married')) return r.a === pid ? r.b : r.a; return undefined; };
/** 참석 후보: 지금 살아 있는 우리 지도자. 통치자 본인 연애는 청혼 흐름(wedding.ts)에서만 → 사교회 연애 판정에서는 빠진다. */
/** 연락 가능한 은퇴 인물(29: 사교회 초대 대상, 수락 50%). retired-app 가 등록한다(가져오기 순환 없이). */
export interface GuestLite { pid: Pid; name: string; cls: string; traits: string[] }
let retiredGuests: (sid: string) => GuestLite[] = () => [];
export function setRetiredGuests(fn: (sid: string) => GuestLite[]): void { retiredGuests = fn; }
/** 현직이든 은퇴자든 이름·직종·특성(없으면 이름표만). */
function personLite(sid: string, pid: Pid): GuestLite { const p = live(sid).find((x) => `p:${x.lid}` === pid); if (p) return { pid, name: p.name, cls: p.cls, traits: p.traits ?? [] }; const r = retiredGuests(sid).find((x) => x.pid === pid); return r ?? { pid, name: namesOf(sid)[pid] ?? pid, cls: 'leader', traits: [] }; }
function pool(sid: string, led: RelationLedger): Attendee[] {
  const cur = live(sid).map((p) => { const pid = `p:${p.lid}`, pt = partnerOf(led, pid); return { pid, name: p.name, romanceOk: !p.ruler, ...(pt ? { partner: pt } : {}) }; });
  const have = new Set(cur.map((x) => x.pid));
  const ret = retiredGuests(sid).filter((r) => !have.has(r.pid)).map((r) => { const pt = partnerOf(led, r.pid); return { pid: r.pid, name: r.name, romanceOk: true, retired: true, ...(pt ? { partner: pt } : {}) }; });
  return [...cur, ...ret];
}
const yearOf = (d: string) => Number(/^(\d+)\./.exec(d)?.[1] ?? NaN);
const monthOf = (d: string) => Number(/^\d+\.(\d+)\./.exec(d)?.[1] ?? NaN);

// ---- 게임 응답(식량 20 납부·불만 특성)
export function registerRelationsLog(router: LogRouter): void {
  router.on(SLOT.RELATIONS, 'relations', (m: SllmMessage) => {
    if (m.kind === 'SOCIALPAY' || m.kind === 'DISCONTENT' || m.kind === 'WEDPAY' || m.kind === 'WEDREFUND' || m.kind === 'COUNCILPEN' || m.kind === 'HOLIDAYVISIT' || m.kind === 'EXECUTE' || m.kind === 'MARRYTRAIT' || m.kind === 'NETPROMO' || m.kind === 'LOGNAT' || m.kind === 'PAPOP' || m.kind === 'LOGPAY' || m.kind === 'BEDCOMF' || m.kind === 'PARTYFX' || m.kind === 'PARTYFG') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
}
async function payFood(s: SocialSeason): Promise<void> {
  if (s.paid !== 'pending') return;
  if (!ctx.gameRunning || !/^\d+$/.test(s.sid)) { s.paid = 'unknown'; return; }
  const req = ++link.reqCounter;
  try { const r = await terminalRequest(socialCostCommand(req, s.sid, s.year), 'SOCIALPAY', req); const st = r.kv.status; s.paid = st === 'applied' || st === 'duplicate' ? 'applied' : st === 'short' ? 'short' : 'unknown'; }
  catch (e) { s.paid = 'unknown'; logDiagnostic('warn', 'social.pay_failed', { error: (e as Error).message }); }
  if (s.paid === 'short') s.quality = 'poor'; // 38: 식량이 모자라도 취소하지 않고 「불만족」 행사
}
/** 불만 특성 붙이기·떼기(게임). 대기(pending)·해제 대기(clear_pending)만 보낸다. 한 달에 한 번 월간 묶음 뒤에. */
async function syncDiscontent(sid: string): Promise<void> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return;
  const b = relBookOf(sid), byPid = new Map(live(sid).map((p) => [`p:${p.lid}`, p]));
  for (const d of Object.values(b.ledger.discontent)) {
    if (d.game !== 'pending' && d.game !== 'clear_pending') continue;
    const p = byPid.get(d.pid); if (!p) { if (d.game === 'clear_pending') d.game = 'cleared'; continue; }
    const add = d.game === 'pending', req = ++link.reqCounter, key = `${add ? 'a' : 'r'}${p.lid}_${String(d.since).replace(/\D/g, '')}`;
    try {
      const r = parseDiscontentReply((await terminalRequest(discontentCommand(req, sid, p.lid, p.cls as LeaderClass, add, key), 'DISCONTENT', req)).kv);
      if (!r || r.status === 'no_target') d.game = add ? 'unknown' : 'cleared'; else d.game = add ? 'applied' : 'cleared';
      if (r && r.status !== 'no_target') chronNoteWorld(add ? L(`${ctx.gameDate} ${p.name} — 인간관계 불만으로 일에 집중하지 못함`, `${ctx.gameDate} ${p.name} — distracted by personal conflicts`) : L(`${ctx.gameDate} ${p.name} — 마음의 짐을 덜었다`, `${ctx.gameDate} ${p.name} — relieved of a personal burden`), false);
    } catch (e) { logDiagnostic('warn', 'relations.discontent_failed', { error: (e as Error).message }); break; }
  }
  save(sid);
}

/** 결혼·사별 특성 붙이기(게임). 대기(pending)만 보낸다. 게임 명단에 없는 사람(은퇴·사망)은 보내지 않고 확인 불가로 둔다. */
async function syncMarriage(sid: string): Promise<void> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return;
  const b = relBookOf(sid), byPid = new Map(live(sid).map((p) => [`p:${p.lid}`, p]));
  for (const m of Object.values(b.marks)) {
    if (m.game !== 'pending') continue;
    const p = byPid.get(m.pid); if (!p || !isLeaderClass(p.cls)) { m.game = 'unknown'; continue; }
    const req = ++link.reqCounter, key = `${m.want[0]}${p.lid}_${String(m.since).replace(/\D/g, '')}`;
    try {
      const r = parseMarriageTraitReply((await terminalRequest(marriageTraitCommand(req, sid, p.lid, p.cls, m.want, key), 'MARRYTRAIT', req)).kv);
      m.game = !r || r.status === 'no_target' ? 'unknown' : 'applied';
      if (m.want === 'none' && m.game === 'applied') delete b.marks[m.pid];
    } catch (e) { logDiagnostic('warn', 'relations.marriage_trait_failed', { error: (e as Error).message }); break; }
  }
  save(sid);
}
/** 지도자 사망(LEADEROUT why=death): NPC 부부였으면 사별로 끝내고 남은 사람에게 사별 특성. */
/** 사망 알림(romance-app: 통치자 예식 취소·환불). 모듈 순환 없이 여기 등록한다. */
const deathHooks: ((sid: string, dead: Pid, date: string) => void)[] = [];
export function onRelationDeath(fn: (sid: string, dead: Pid, date: string) => void): void { deathHooks.push(fn); }
function onDeath(kv: Record<string, string>): void {
  const sid = ctx.curSaveId; if (!sid || kv.why !== 'death' || !/^\d+$/.test(String(kv.lid ?? ''))) return;
  const b = relBookOf(sid), dead = `p:${kv.lid}`, names = namesOf(sid), date = kv.date || ctx.gameDate || '';
  const survivor = markBereaved(b.ledger, b.marks, dead, rulerPidOf(sid), date);
  // 교제·약혼 중 사망(28·40): 혼인이 아니어도 관계를 끝낸다(남은 사람이 새 연애 판정에서 빠지지 않게, 죽은 사람과 예식이 올라가지 않게).
  for (const r of Object.values(b.ledger.pairs)) if ((r.a === dead || r.b === dead) && (r.romance === 'dating' || r.romance === 'engaged' || r.romance === 'married')) { r.romance = 'ended'; r.endedOn = date; r.revision++; r.evidence.push(`bereaved:${date}`); }
  for (const f of deathHooks) { try { f(sid, dead, date); } catch { /* 연애 쪽 실패는 사망 처리를 막지 않는다 */ } }
  save(sid);
  if (survivor) { chronNoteWorld(L(`${date} ${names[survivor] ?? survivor} — 배우자 ${kv.name || names[dead] || ''}을(를) 잃음`, `${date} ${names[survivor] ?? survivor} lost their spouse ${kv.name || names[dead] || ''}`), true); void syncMarriage(sid).then(pushView).catch(() => {}); }
}

/** 관저 파티(2026-11-03, features/party-app.ts): 함께 어울린 두 지도자의 교류를 사교회처럼 장부에 남긴다(결과는 파티 장면이 정함: 좋음·마찰). 지도자(p:번호)끼리만. 돌려주는 값 = 남긴 수. */
export function partyExchanges(sid: string, pairs: Array<{ a: Pid; b: Pid; result: ExchangeResult }>, date: string): number {
  const b = relBookOf(sid), ruler = rulerPidOf(sid), ok = (p: Pid) => /^(?:p:\d+|f:\d+:.+)$/.test(p) && p !== ruler; let n = 0; // f: = 파티에 온 타국 지도자(2026-11-03)
  const s = newSeason(sid, yearOf(date), monthOf(date), date, ruler); s.eventId = `party:${date}`; s.stage = 'open';
  for (const x of pairs) { if (x.a === x.b || !ok(x.a) || !ok(x.b) || (x.a.startsWith('f:') && x.b.startsWith('f:'))) continue; applyExchange(b.ledger, s, { id: `${s.eventId}:${n}`, a: x.a, b: x.b, result: x.result, introduced: true }); const k = pairKey(x.a, x.b); if (!b.ledger.playerKnows.pairs.includes(k)) b.ledger.playerKnows.pairs.push(k); n++; }
  if (n) save(sid); return n;
}
/** 통치자의 만남 주선(사용자 제안 2026-10-23): 두 지도자를 따로 만나게 한다. 좋은 교류 한 번의 기회일 뿐 교제를 확정하지 않는다(39·40). 같은 두 사람은 1년에 한 번, 통치자는 1년에 ARRANGE.perYear 번. */
export const ARRANGE = { perYear: 3 } as const;
export function arrangeMeeting(b: RelBook, a: Attendee, c: Attendee, date: string, rulerPid: Pid, rng: () => number): { result: ExchangeResult } {
  const year = yearOf(date), key = pairKey(a.pid, c.pid);
  if (a.pid === c.pid || a.pid === rulerPid || c.pid === rulerPid) throw new Error(L('통치자가 아닌 서로 다른 두 지도자를 골라 주세요.', 'Pick two different leaders other than the ruler.'));
  if ((b.arranged[String(year)] ?? 0) >= ARRANGE.perYear) throw new Error(L(`올해는 이미 ${ARRANGE.perYear}번 주선했습니다.`, `You have already arranged ${ARRANGE.perYear} meetings this year.`));
  const r = getPair(b.ledger, a.pid, c.pid);
  if (r.evidence.includes(`ar:${year}`)) throw new Error(L('이 두 사람은 올해 이미 만남을 주선했습니다.', 'You already arranged a meeting for these two this year.'));
  const s = newSeason(b.sid, year, monthOf(date), date, rulerPid); s.eventId = `arr:${date}:${key}`; s.stage = 'open';
  const ex: Exchange = { id: `${s.eventId}:x`, a: a.pid, b: c.pid, result: rollExchange('normal', rng), introduced: true };
  r.evidence.push(`ar:${year}`); b.arranged = { [String(year)]: (b.arranged[String(year)] ?? 0) + 1 };
  applyExchange(b.ledger, s, ex);
  if (eligibleForRomance(a, c) && !datingCheck(b.ledger, s, ex, a, c, rng)) romanceInterestCheck(b.ledger, s, ex, a, c, rng); // 결과는 당사자가 알릴 때까지 비공개(39)
  if (!b.ledger.playerKnows.pairs.includes(key)) b.ledger.playerKnows.pairs.push(key);
  return { result: ex.result };
}

// ---- 한 달
function notifySocial(title: string, body: string): void { (office as { toastGo: string }).toastGo = 'social'; ctx.notify({ kind: 'office', title, body, action: L('집무실', 'Office') }); }
export function socialMonth(b: RelBook, date: string, people: Attendee[], leaders: Pid[], names: Record<Pid, string>, rulerPid: Pid, rng: () => number): { opened?: SocialSeason; closed?: { season: SocialSeason; lines: string[] }; married: [Pid, Pid][]; brokeUp: [Pid, Pid][] } {
  const out: { opened?: SocialSeason; closed?: { season: SocialSeason; lines: string[] }; married: [Pid, Pid][]; brokeUp: [Pid, Pid][] } = { married: [], brokeUp: [] };
  // 1) 지난달 열린 행사를 플레이어가 마치지 않았으면 자동 마무리(38)
  for (const s of b.seasons) if (s.stage !== 'closed' && (yearOf(date) > s.year || monthOf(date) > s.month || staleOpen.has(s.eventId))) { const lines = autoFinish(b.ledger, s, attendees(s, people), leaders, names, rng); breakupYearly(b.ledger, s, rng); out.closed = { season: s, lines }; }
  // 2) 올해 행사(개최 월이 되면 연다)
  const month = b.socialMonth ?? SOCIAL.defaultMonth;
  const due = socialDue(date, month, b.seasons.map((s) => s.year)); // 같은 해 행사가 있으면(열림·닫힘 모두) 다시 열지 않는다
  if (due && rulerPid && people.length >= 2) {
    const s = newSeason(b.sid, due.year, month, date, rulerPid); s.stage = 'open';
    for (const p of people) inviteOutcome(s, p, rng);
    b.seasons.push(s);
    if (monthOf(date) > month) { const lines = autoFinish(b.ledger, s, attendees(s, people), leaders, names, rng); breakupYearly(b.ledger, s, rng); out.closed = { season: s, lines }; } // 개최 월을 놓침(38): 통치자 없이 배경 교류로 마무리
    else out.opened = s;
  }
  // 3) NPC 커플: 결별 숙려 진행·예식일
  for (const r of Object.values(b.ledger.pairs)) {
    const t = breakupTick(b.ledger, r, date); if (t === 'ended') { out.brokeUp.push([r.a, r.b]); markSeparated(b.marks, r.a, r.b, date); }
    if (r.a !== rulerPid && r.b !== rulerPid && !r.evidence.includes('ruler_engaged') && npcWeddingDue(r, date)) { r.romance = 'married'; r.marriedOn = date; r.visibility = 'public'; r.revision++; out.married.push([r.a, r.b]); if (r.a !== rulerPid && r.b !== rulerPid) markMarried(b.marks, r, date); }
  }
  return out;
}
async function onSnapshot(snap: StateSnapshot): Promise<void> {
  const sid = snap.sid; if (!sid || sid !== ctx.curSaveId || snap.gestalt) return; // 군체·기계: 사교회 없음
  const b = relBookOf(sid), names = namesOf(sid), people = pool(sid, b.ledger), leaders = live(sid).map((p) => `p:${p.lid}`);
  const r = socialMonth(b, snap.date, people, leaders, names, rulerPidOf(sid), Math.random);
  if (r.closed) { notifySocial(L(`${r.closed.season.year}년 사교회가 끝났습니다`, `The ${r.closed.season.year} social gathering is over`), r.closed.lines.slice(0, 3).join(' ') || L('특별한 일 없이 끝났습니다.', 'It ended without anything of note.')); chronNoteWorld(L(`${snap.date} ${r.closed.season.year}년 사교회 마침`, `${snap.date} The ${r.closed.season.year} social gathering ended`), false); }
  if (r.opened) {
    await payFood(r.opened);
    notifySocial(L('올해 사교회가 열렸습니다', 'This year\'s social gathering has begun'), L(`지도자 ${Object.values(r.opened.invites).filter((x) => x === 'accepted').length}명이 모였습니다.${r.opened.quality === 'poor' ? ' 식량이 모자라 대접이 소박합니다.' : ''} 집무실 「사교회」에서 참석하거나 불참할 수 있습니다(이번 달 안에).`, `${Object.values(r.opened.invites).filter((x) => x === 'accepted').length} leaders have gathered.${r.opened.quality === 'poor' ? ' Food is short, so the hospitality is modest.' : ''} Attend or skip it from the office "Social gathering" (this month).`));
    chronNoteWorld(L(`${snap.date} ${r.opened.year}년 사교회 개최`, `${snap.date} The ${r.opened.year} social gathering opened`), true);
  }
  for (const [a, c] of r.married) chronNoteWorld(L(`${snap.date} ${names[a] ?? a}와(과) ${names[c] ?? c}이(가) 결혼했습니다`, `${snap.date} ${names[a] ?? a} and ${names[c] ?? c} were married`), true);
  for (const [a, c] of r.brokeUp) if (b.ledger.playerKnows.pairs.includes(pairKey(a, c)) || b.ledger.pairs[pairKey(a, c)]?.visibility === 'public') chronNoteWorld(L(`${snap.date} ${names[a] ?? a}와(과) ${names[c] ?? c}이(가) 헤어졌습니다`, `${snap.date} ${names[a] ?? a} and ${names[c] ?? c} have separated`), false);
  save(sid); await syncDiscontent(sid); await syncMarriage(sid); pushView();
}

// ---- 화면
const current = (b: RelBook): SocialSeason | null => [...b.seasons].reverse().find((s) => s.stage !== 'closed') ?? null;
export function socialView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', date: ctx.gameDate || '' };
  const b = relBookOf(sid), s = current(b), names = namesOf(sid), rp = rulerPidOf(sid), byPid = new Map(live(sid).map((p) => [`p:${p.lid}`, p]));
  const sc = s ? (b.scene[s.eventId] ??= { turns: [], used: 0 }) : null;
  const P = new Map(live(sid).map((p) => [`p:${p.lid}`, p]));
  const groups = s && s.rulerAttends === true ? groupsOf(sid, b, s).map((g) => { const tk = sc!.talks?.[g.spot]; return { spot: g.spot, members: g.members.map((pid) => ({ pid, name: personLite(sid, pid).name, cls: personLite(sid, pid).cls, council: !!P.get(pid)?.council, retired: !P.has(pid) })), lines: (tk?.lines ?? []).map((l) => ({ ruler: l.who === 'ruler', pid: l.who === 'ruler' ? '' : l.who, name: l.name, text: l.text })), judged: !!tk?.judged, outcome: (tk?.outcome ?? []).map((o) => ({ name: P.get(o.pid)?.name ?? names[o.pid] ?? '', result: o.result })) }; }) : [];
  const last = [...b.seasons].reverse().find((x) => x.stage === 'closed') ?? null;
  return {
    sid, date: ctx.gameDate || '', month: b.socialMonth ?? SOCIAL.defaultMonth, food: SOCIAL.foodCost, empire: ctx.playerName || '', ruler: rulerOf(sid)?.name ?? '', playerCls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human', busy: hall.busy,
    season: s ? {
      year: s.year, quality: s.quality, paid: s.paid, rulerAttends: s.rulerAttends, used: sc!.used, turns: sc!.turns, groups,
      guests: Object.entries(s.invites).filter(([pid, v]) => v === 'accepted' && pid !== rp && (byPid.has(pid) || retiredGuests(sid).some((r) => r.pid === pid))).map(([pid]) => { const p = personLite(sid, pid); return { pid, name: p.name, cls: p.cls, council: !!byPid.get(pid)?.council, retired: !byPid.has(pid), talked: s.exchanges.some((e) => e.withRuler && (e.a === pid || e.b === pid)) }; }),
    } : null,
    last: last ? { year: last.year, summary: last.summary } : null,
    names,
  };
}
function pushView(): void { try { const v = socialView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('socialUpdate', v); } catch { /* 창 없음 */ } }

const RESULT_EN: Record<ExchangeResult, string> = { good: 'It went warmly; they grew a little closer.', none: 'It was polite, but nothing much came of it.', friction: 'It turned into an awkward disagreement that left some tension.' };
/** 대화 합류 장면 서술(영어 지시, 응답 언어는 aiclient). 결과는 앱이 이미 정했다 — AI 는 그 결과를 그리기만 한다. */
export function sceneMessages(a: { empire: string; ruler: string; date: string }, who: { name: string; cls: string; traits: string[]; persona?: string }, result: ExchangeResult, other?: { name: string }): { role: 'system' | 'user'; content: string }[] {
  const scene = other ? `The ruler ${a.ruler || ''} introduced ${who.name} to ${other.name} and watched them talk.` : `The ruler ${a.ruler || ''} joined a conversation with ${who.name} (${who.cls}).`;
  return [{ role: 'system', content: [
    `You narrate a brief moment at the annual social gathering of the Stellaris empire "${a.empire || 'our empire'}". Date: ${a.date || 'unknown'}.`,
    scene, who.traits.length ? `${who.name}'s traits: ${who.traits.slice(0, 4).join(', ')}.` : '', who.persona ? `${who.name}'s manner: ${who.persona}` : '',
    `Outcome already decided by the game: ${RESULT_EN[result]} Portray exactly this outcome.`,
    'Write 2-3 sentences of narration with at most one short line of dialogue from the guests. Never write lines for the ruler. Do not invent game facts, events or numbers. No romance unless it is merely hinted.',
  ].filter(Boolean).join('\n') }, { role: 'user', content: '(Describe the moment.)' }];
}
const CANNED: Record<ExchangeResult, [string, string]> = { good: ['이야기가 잘 통했습니다. 조금 가까워진 듯합니다.', 'The talk went well. They seem a little closer.'], none: ['정중한 대화였지만 별다른 일은 없었습니다.', 'A polite conversation, but nothing came of it.'], friction: ['말이 엇갈려 어색한 분위기가 남았습니다.', 'They talked past each other, and some awkwardness lingered.'] };
/** 인물 말투(persona-app). main.ts 가 꽂는다. */
let personaPeek: ((sid: string, key: string) => { persona?: string } | null) | null = null;
let personaNoteFn: ((sid: string, key: string, text: string) => void) | null = null;
export function setRelationsPersona(p: { mem: (sid: string, key: string) => { persona?: string } | null; note?: (sid: string, key: string, text: string) => void }): void { personaPeek = p.mem; personaNoteFn = p.note ?? null; }

async function scene(kind: 'intro', a: Pid, c?: Pid) {
  const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
  const b = relBookOf(sid), s = current(b); if (!s || s.rulerAttends !== true) throw new Error(L('사교회에 참석 중일 때만 할 수 있습니다.', 'Only while you are attending the gathering.'));
  const sc = (b.scene[s.eventId] ??= { turns: [], used: 0 });
  const rp = s.rulerPid, people = attendees(s, pool(sid, b.ledger)), byPid = new Map(people.map((p) => [p.pid, p])), P = new Map(live(sid).map((p) => [`p:${p.lid}`, p]));
  const A = byPid.get(a); if (!A || a === rp) throw new Error(L('그 사람은 행사에 없습니다.', 'That person is not at the gathering.'));
  let ex: Exchange;
  {
    const C = c ? byPid.get(c) : undefined; if (!C || c === rp || c === a) throw new Error(L('소개할 두 사람을 골라 주세요.', 'Choose two people to introduce.'));
    if (s.exchanges.some((e) => pairKey(e.a, e.b) === pairKey(a, c!))) throw new Error(L('이번 행사에서 이미 만난 두 사람입니다.', 'Those two already met at this gathering.'));
    ex = { id: `${s.eventId}:intro:${pairKey(a, c!)}`, a, b: c!, result: rollExchange(s.quality, Math.random), introduced: true };
  }
  applyExchange(b.ledger, s, ex);
  { const B = byPid.get(ex.b)!; if (!datingCheck(b.ledger, s, ex, A, B, Math.random)) romanceInterestCheck(b.ledger, s, ex, A, B, Math.random); b.ledger.playerKnows.pairs.includes(pairKey(ex.a, ex.b)) || b.ledger.playerKnows.pairs.push(pairKey(ex.a, ex.b)); }
  sc.used++;
  const pa = P.get(a), who = { name: A.name, cls: pa?.cls ?? 'leader', traits: pa?.traits ?? [], persona: personaPeek?.(sid, a)?.persona };
  let text = '';
  try { text = String(await ctx.ai.chat(sceneMessages({ empire: ctx.playerName, ruler: rulerOf(sid)?.name ?? '', date: ctx.gameDate || s.date }, who, ex.result, { name: byPid.get(ex.b)!.name }), { maxTokens: 400, purpose: 'social-gathering' }) ?? '').trim().slice(0, 900); }
  catch (e) { logDiagnostic('warn', 'social.scene_ai_failed', { error: (e as Error).message }); }
  if (!text) text = L(CANNED[ex.result][0], CANNED[ex.result][1]);
  sc.turns.push({ who: `${A.name} · ${byPid.get(ex.b)!.name}`, text, result: ex.result, kind });
  save(sid); pushView();
  return { result: ex.result, text };
}
// ---- 연회장(실제 대화): 모임에 말을 걸면 그 모임 사람들만 AI 로 답하고, 자리를 뜰 때 한 번 분위기를 판정한다.
const hall = { win: null as BrowserWindow | null, busy: false };
const guestPids = (sid: string, s: SocialSeason): Pid[] => { const here = new Set([...live(sid).map((p) => `p:${p.lid}`), ...retiredGuests(sid).map((r) => r.pid)]), rp = rulerPidOf(sid); return Object.entries(s.invites).filter(([pid, v]) => v === 'accepted' && pid !== rp && pid !== s.rulerPid && here.has(pid)).map(([pid]) => pid); };
function groupsOf(sid: string, b: RelBook, s: SocialSeason): { spot: HallSpot; members: Pid[] }[] {
  const sc = (b.scene[s.eventId] ??= { turns: [], used: 0 }), guests = guestPids(sid, s);
  if (!sc.groups) sc.groups = hallGroups(s.eventId, guests);
  const placed = new Set(sc.groups.flatMap((g) => g.members)), extra = guests.filter((p) => !placed.has(p)); // 늦게 합류한 손님은 가장 작은 모임에
  for (const p of extra) { const g = [...sc.groups].sort((x, y) => x.members.length - y.members.length)[0]; if (g && g.members.length < HALL.maxPerGroup) g.members.push(p); }
  return sc.groups.map((g) => ({ spot: g.spot, members: g.members.filter((p) => guests.includes(p)) })).filter((g) => g.members.length);
}
const STAGE_EN: Record<string, string> = { stranger: 'have not really met', acquainted: 'acquainted', friendly: 'on friendly terms', close: 'close friends' };
function relDesc(led: RelationLedger, a: Pid, c: Pid): string { const r = led.pairs[pairKey(a, c)]; if (!r) return 'have not really met'; return [STAGE_EN[r.friend] ?? 'acquainted', r.rival === 'rival' ? 'open rivals' : r.rival === 'tense' ? 'some tension between them' : ''].filter(Boolean).join(', '); }
function hallCtx(sid: string, spot: string) {
  const b = relBookOf(sid), s = current(b); if (!s || s.rulerAttends !== true) throw new Error(L('사교회에 참석 중일 때만 할 수 있습니다.', 'Only while you are attending the gathering.'));
  const g = groupsOf(sid, b, s).find((x) => x.spot === spot); if (!g) throw new Error(L('그 자리에는 아무도 없습니다.', 'Nobody is there.'));
  const sc = (b.scene[s.eventId] ??= { turns: [], used: 0 }), tk = ((sc.talks ??= {})[g.spot] ??= { lines: [], judged: false });
  const P = new Map(live(sid).map((p) => [`p:${p.lid}`, p])), rp = rulerPidOf(sid) || s.rulerPid;
  const members: HallMember[] = g.members.map((pid) => { const p = personLite(sid, pid); return { pid, name: p.name, cls: P.has(pid) ? p.cls : `${p.cls}, retired`, traits: p.traits, persona: personaPeek?.(sid, pid)?.persona, withRuler: relDesc(b.ledger, rp, pid), withOthers: g.members.filter((o) => o !== pid && b.ledger.pairs[pairKey(pid, o)]).map((o) => `${P.get(o)?.name ?? o} — ${relDesc(b.ledger, pid, o)}`) }; });
  return { b, s, g, tk, members, rp };
}
async function hallTalk(spot: string, text: string, to?: string): Promise<HallLine[]> {
  const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
  if (hall.busy) throw new Error(L('상대가 아직 말하는 중입니다.', 'They are still speaking.'));
  const { s, g, tk, members } = hallCtx(sid, spot), msg = String(text ?? '').trim().slice(0, HALL.maxTurnChars); if (!msg) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
  const toM = members.find((m) => m.pid === to), ruler = rulerOf(sid)?.name ?? '';
  const history = tk.lines.slice(); tk.lines.push({ who: 'ruler', name: ruler || L('통치자', 'Ruler'), text: msg }); hall.busy = true; pushView();
  let lines: HallLine[] = [];
  try { lines = parseHallReply(String(await ctx.ai.chat(hallTalkMessages({ empire: ctx.playerName, ruler, date: ctx.gameDate || s.date, quality: s.quality }, g.spot, members, history, msg, toM?.name), { maxTokens: 900, purpose: 'social-gathering' }) ?? ''), members, toM?.pid ?? members[0]?.pid, ruler); }
  catch (e) { logDiagnostic('warn', 'social.hall_ai_failed', { error: (e as Error).message }); }
  finally { hall.busy = false; }
  if (!lines.length) { tk.lines.pop(); save(sid); pushView(); throw new Error(L('대답을 받지 못했습니다. 잠시 뒤 다시 말을 걸어 보세요.', 'No reply came. Try speaking to them again in a moment.')); }
  tk.lines.push(...lines); tk.lines = tk.lines.slice(-HALL.maxLines); save(sid); pushView();
  return lines;
}
/** 자리를 뜰 때(한 모임에 한 번): 분위기 판정 → 통치자와 각 사람의 교류 결과 + 모임 안 두 사람 한 쌍. 말을 하지 않았으면 아무것도 바뀌지 않는다. */
async function hallLeave(sid: string, spot: string): Promise<{ name: string; result: ExchangeResult }[]> {
  const { b, s, g, tk, members, rp } = hallCtx(sid, spot);
  if (tk.judged || !tk.lines.some((l) => l.who === 'ruler')) return [];
  let moods: Record<Pid, Mood> = {};
  try { moods = parseHallMoods(String(await ctx.ai.chat(hallMoodMessages(rulerOf(sid)?.name ?? '', members, tk.lines), { maxTokens: 300, json: true, purpose: 'social-gathering-mood' }) ?? ''), members); }
  catch (e) { logDiagnostic('warn', 'social.hall_mood_failed', { error: (e as Error).message }); }
  if (tk.judged) return []; // 기다리는 동안 다른 요청이 이미 판정
  const out: { pid: Pid; result: ExchangeResult }[] = [];
  for (const m of members) {
    if (s.exchanges.some((e) => e.withRuler && pairKey(e.a, e.b) === pairKey(rp, m.pid))) continue; // 이번 행사에서 이미 판정된 사이
    const ex: Exchange = { id: `${s.eventId}:hall:${g.spot}:${m.pid}`, a: rp, b: m.pid, result: rollMood(s.quality, moods[m.pid] ?? 'neutral', Math.random), withRuler: true };
    applyExchange(b.ledger, s, ex); out.push({ pid: m.pid, result: ex.result });
  }
  const people = attendees(s, pool(sid, b.ledger)), byPid = new Map(people.map((p) => [p.pid, p]));
  const pairs: [Pid, Pid][] = []; for (let i = 0; i < g.members.length; i++) for (let j = i + 1; j < g.members.length; j++) if (!s.exchanges.some((e) => pairKey(e.a, e.b) === pairKey(g.members[i], g.members[j]))) pairs.push([g.members[i], g.members[j]]);
  if (pairs.length) { const [x, y] = pairs[Math.floor(Math.random() * pairs.length)], ex: Exchange = { id: `${s.eventId}:hallpair:${pairKey(x, y)}`, a: x, b: y, result: rollExchange(s.quality, Math.random) }; applyExchange(b.ledger, s, ex); const X = byPid.get(x), Y = byPid.get(y); if (X && Y && !datingCheck(b.ledger, s, ex, X, Y, Math.random)) romanceInterestCheck(b.ledger, s, ex, X, Y, Math.random); }
  tk.judged = true; tk.outcome = out; save(sid); pushView();
  return out.map((o) => ({ name: members.find((m) => m.pid === o.pid)?.name ?? '', result: o.result }));
}
function openHall(): { ok: boolean; error?: string } {
  const sid = ctx.curSaveId, s = sid ? current(relBookOf(sid)) : null; if (!sid || !s || s.rulerAttends !== true) return { ok: false, error: L('사교회에 참석 중일 때만 들어갈 수 있습니다.', 'You can enter only while attending the gathering.') };
  if (hall.win && !hall.win.isDestroyed()) { hall.win.show(); hall.win.focus(); pushView(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
  const ow = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL())), ob = ow ? ow.getBounds() : null;
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#120d08', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  hall.win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'social-hall.html'));
  w.once('ready-to-show', () => { w.show(); pushView(); });
  w.on('closed', () => { if (hall.win === w) hall.win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
  return { ok: true };
}
// ---- 두 사람 중재(32·33·34): 플레이어가 아는 갈등만. 대화는 AI, 합의 판정은 마칠 때 한 번. 같은 갈등은 한 번에 하나.
const med = new Map<string, { lines: HallLine[]; busy: boolean }>();
function medCtx(sid: string, cid: string) {
  const b = relBookOf(sid), c = b.ledger.conflicts[cid], rp = rulerPidOf(sid); if (!c || c.resolved) throw new Error(L('그 갈등은 없거나 이미 풀렸습니다.', 'That conflict does not exist or is already settled.'));
  if (!canMediate(b.ledger, c.a, c.b, rp)) throw new Error(L('플레이어가 아는 갈등만 중재할 수 있습니다.', 'You can only mediate conflicts you know about.'));
  if (c.a === rp || c.b === rp) throw new Error(L('통치자 본인이 당사자인 갈등은 중재할 수 없습니다. 직접 이야기해 푸세요.', 'You cannot mediate a conflict you are party to; talk it out yourself.'));
  const P = new Map(live(sid).map((p) => [`p:${p.lid}`, p])), names = namesOf(sid);
  const parties: MedParty[] = [c.a, c.b].map((pid) => { const p = P.get(pid); if (!p) throw new Error(L('당사자가 지금 우리 제국에 없습니다.', 'One of them is no longer in your empire.')); return { pid, name: p.name, cls: p.cls, traits: p.traits ?? [], persona: personaPeek?.(sid, pid)?.persona }; });
  return { b, c, rp, parties, names };
}
async function conflictStory(sid: string, cid: string): Promise<string> {
  const { b, c, rp, parties, names } = medCtx(sid, cid); if (c.story?.text) return c.story.text;
  const text = String(await ctx.ai.chat(storyMessages({ empire: ctx.playerName, date: ctx.gameDate || '' }, c, parties, names, rp), { maxTokens: 500, purpose: 'conflict-story' }) ?? '').trim().slice(0, 900);
  if (!text) throw new Error(L('사연을 받지 못했습니다. 잠시 뒤 다시 해 보세요.', 'No story came back. Try again in a moment.'));
  c.story = { text, lang: selectedLanguage(), on: ctx.gameDate || '' }; save(sid); return text;
}
function medView(sid: string, cid: string) {
  const { c, parties, names, rp } = medCtx(sid, cid), m = med.get(sid + ':' + cid);
  return { id: cid, parties: parties.map((p) => ({ pid: p.pid, name: p.name, cls: p.cls })), brief: c.story?.text || '', since: c.createdOn, kind: c.kind, lines: (m?.lines ?? []).map((l) => ({ ruler: l.who === 'ruler', name: l.name, text: l.text })), busy: !!m?.busy, ruler: names[rp] ?? '' };
}
async function medSay(sid: string, cid: string, text: string, to?: string) {
  const { c, parties, names, rp } = medCtx(sid, cid), key = sid + ':' + cid, m = med.get(key) ?? { lines: [], busy: false }; med.set(key, m);
  if (m.busy) throw new Error(L('아직 말하는 중입니다.', 'They are still speaking.'));
  const msg = String(text ?? '').trim().slice(0, MED.maxTurnChars); if (!msg) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
  if (!c.story?.text) { try { await conflictStory(sid, cid); } catch { /* 사연 없이도 중재는 된다 */ } }
  const toP = parties.find((p) => p.pid === to), ruler = rulerOf(sid)?.name ?? '';
  const hist = m.lines.slice(); m.lines.push({ who: 'ruler', name: ruler || L('통치자', 'Ruler'), text: msg }); m.busy = true;
  let lines: HallLine[] = [];
  try { lines = parseHallReply(String(await ctx.ai.chat(mediationMessages({ empire: ctx.playerName, ruler, date: ctx.gameDate || '' }, c, parties, names, rp, hist, msg, toP?.name), { maxTokens: 900, purpose: 'mediation' }) ?? ''), parties, toP?.pid ?? parties[0].pid, ruler); }
  catch (e) { logDiagnostic('warn', 'mediation.ai_failed', { error: (e as Error).message }); }
  finally { m.busy = false; }
  if (!lines.length) { m.lines.pop(); throw new Error(L('대답을 받지 못했습니다. 잠시 뒤 다시 말을 걸어 보세요.', 'No reply came. Try again in a moment.')); }
  m.lines.push(...lines); m.lines = m.lines.slice(-MED.maxLines);
  return medView(sid, cid);
}
async function medClose(sid: string, cid: string): Promise<{ agreed: boolean; note: string }> {
  const { b, c, parties } = medCtx(sid, cid), key = sid + ':' + cid, m = med.get(key);
  if (!m || !m.lines.some((l) => l.who === 'ruler')) { med.delete(key); return { agreed: false, note: '' }; }
  if (m.busy) throw new Error(L('아직 말하는 중입니다.', 'They are still speaking.'));
  let v = { agreed: false, note: '' };
  try { v = parseVerdict(String(await ctx.ai.chat(verdictMessages(rulerOf(sid)?.name ?? '', parties, m.lines), { maxTokens: 200, json: true, purpose: 'mediation-verdict' }) ?? '')); }
  catch (e) { logDiagnostic('warn', 'mediation.verdict_failed', { error: (e as Error).message }); }
  med.delete(key); c.reconcileTried.push(`med:${ctx.gameDate || ''}`);
  if (v.agreed) {
    resolveConflict(b.ledger, cid, ctx.gameDate || '', 'mediation');
    const r = getPair(b.ledger, c.a, c.b); if (r.rival !== 'none') { r.rival = r.rival === 'rival' ? 'tense' : 'none'; r.revision++; }
    chronNoteWorld(L(`${ctx.gameDate} 통치자의 중재로 ${parties[0].name}와(과) ${parties[1].name}이(가) 갈등을 정리함`, `${ctx.gameDate} With the ruler's mediation, ${parties[0].name} and ${parties[1].name} settled their quarrel`), false);
    for (const p of parties) personaNoteFn?.(sid, p.pid, L(`통치자의 중재로 ${parties.find((x) => x.pid !== p.pid)!.name}와(과)의 갈등을 정리했다`, `Settled the quarrel with ${parties.find((x) => x.pid !== p.pid)!.name} through the ruler's mediation`));
    save(sid); void syncDiscontent(sid).then(pushView);
  } else save(sid);
  return v;
}
function finish(sid: string, attend: boolean): string[] {
  const b = relBookOf(sid), s = current(b); if (!s) throw new Error(L('열린 사교회가 없습니다.', 'No gathering is open.'));
  const people = attendees(s, pool(sid, b.ledger)), leaders = live(sid).map((p) => `p:${p.lid}`), names = namesOf(sid);
  let lines: string[];
  if (!attend) { s.rulerAttends = false; lines = autoFinish(b.ledger, s, people, leaders, names, Math.random); }
  else {
    const have = new Set(s.exchanges.map((e) => pairKey(e.a, e.b))), byPid = new Map(people.map((p) => [p.pid, p]));
    for (const [x, y] of pickBackgroundPairs(b.ledger, people, s.rulerPid, false, Math.random).filter(([x, y]) => !have.has(pairKey(x, y)))) {
      const ex: Exchange = { id: `${s.eventId}:bg:${pairKey(x, y)}`, a: x, b: y, result: rollExchange(s.quality, Math.random) };
      applyExchange(b.ledger, s, ex); const X = byPid.get(x), Y = byPid.get(y);
      if (X && Y && !datingCheck(b.ledger, s, ex, X, Y, Math.random)) romanceInterestCheck(b.ledger, s, ex, X, Y, Math.random);
    }
    lines = finishSeason(b.ledger, s, leaders, names, Math.random);
  }
  breakupYearly(b.ledger, s, Math.random);
  chronNoteWorld(L(`${ctx.gameDate} ${s.year}년 사교회 마침${attend ? '' : ' (통치자 불참)'}`, `${ctx.gameDate} The ${s.year} social gathering ended${attend ? '' : ' (ruler absent)'}`), false);
  save(sid); pushView(); void syncDiscontent(sid);
  return lines;
}

/** 인물 카드 「인간관계」: 플레이어가 알 수 있는 관계만. */
export function relationsInfo(sid: string, key: string) {
  const b = relBookOf(sid), names = namesOf(sid), rp = rulerPidOf(sid), p = peopleOf(sid).find((x) => `p:${x.lid}` === key);
  const card = relationCard(b.ledger, key, rp, names, p?.cls as LeaderClass | undefined), nm = (x: Pid) => (x === rp ? L('통치자', 'the ruler') : names[x] ?? L('(알 수 없는 인물)', '(unknown person)'));
  const pair = card.partner ? getPair(b.ledger, key, card.partner) : null;
  const eff = p?.cls && DISCONTENT_EFFECT[p.cls as LeaderClass];
  return {
    friends: card.friends.map(nm), rivals: card.rivals.map(nm),
    partner: card.partner ? { name: nm(card.partner), stage: pair?.romance ?? 'dating' } : null,
    conflicts: card.conflicts.map((c) => ({ id: c.id, with: nm(c.a === key ? c.b : c.a), withKey: c.a === key ? c.b : c.a, since: c.createdOn, story: c.story?.text ?? '', mediable: c.a === rp || c.b === rp ? 'ruler' : canMediate(b.ledger, c.a, c.b, rp) ? 'yes' : 'no', kind: c.kind })),
    discontent: card.discontent ? { since: card.discontent.since, effect: eff ? L(eff.ko, eff.en) : '', verified: !!eff?.verified, game: card.discontent.game } : null,
    marriage: (() => { const m = b.marks[key]; if (!m || m.want === 'none') return null; const me = isLeaderClass(p?.cls) ? MARRIAGE_EFFECT[p!.cls as LeaderClass] : null; return { want: m.want, since: m.since, partner: m.partner ? nm(m.partner) : '', effect: m.want === 'married' ? (me ? L(me.ko, me.en) : '') : (me ? L(me.ko.replace('+10%', '−10%'), me.en.replace('+10%', '−10%')) : '') + L(' · 지도자 경험치 획득 −25%', ' · Leader experience gain −25%'), game: m.game }; })(),
    arrange: key === rp || !p || p.gone ? null : { left: Math.max(0, ARRANGE.perYear - (b.arranged[String(yearOf(ctx.gameDate || ''))] ?? 0)), with: live(sid).filter((x) => `p:${x.lid}` !== key && !x.ruler).map((x) => ({ key: `p:${x.lid}`, name: x.name, done: !!b.ledger.pairs[pairKey(key, `p:${x.lid}`)]?.evidence.includes(`ar:${yearOf(ctx.gameDate || '')}`) })) },
  };
}

export function registerRelations(router: LogRouter): void {
  registerRelationsLog(router);
  onGameSnapshot((s) => { void onSnapshot(s).catch((e) => logDiagnostic('warn', 'relations.month_failed', { error: (e as Error).message })); }, 'social');
  const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: socialView() });
  ipcMain.handle('socialState', () => socialView());
  ipcMain.handle('socialAttend', (_e, yes: unknown) => {
    try {
      const sid = ctx.curSaveId, b = sid ? relBookOf(sid) : null, s = b ? current(b) : null; if (!sid || !s) throw new Error(L('열린 사교회가 없습니다.', 'No gathering is open.'));
      if (yes) { if (s.rulerAttends === false) throw new Error(L('이미 불참했습니다.', 'You already skipped it.')); s.rulerAttends = true; save(sid); pushView(); return { ok: true, state: socialView() }; }
      if (s.rulerAttends === true) throw new Error(L('이미 참석 중입니다. 「행사 마치기」를 눌러 주세요.', 'You are already attending. Press “Close the gathering”.'));
      return { ok: true, lines: finish(sid, false), state: socialView() };
    } catch (e) { return err(e); }
  });
  // 개최 월 바꾸기(29 확정): 국가기념일 화면의 고정 항목. 삭제·비활성화 없음. 국가기념일과 같은 달 금지. 올해 이미 열렸으면 다음 해부터(연도별 행사 ID 로 자연히).
  ipcMain.handle('socialSetMonth', (_e, month: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const m = Number(month), r = canSetSocialMonth(m, officialHolidayMonths(sid)); if (!r.ok) throw new Error(r.reason || '');
      const b = relBookOf(sid); b.socialMonth = m; save(sid); pushView();
      chronNoteWorld(L(`${ctx.gameDate} 사교회 개최 월을 ${m}월로 정함`, `${ctx.gameDate} Social gathering moved to month ${m}`), false);
      return { ok: true, state: socialView() };
    } catch (e) { return err(e); }
  });
  addReservedMonths((sid) => [{ month: relBookOf(sid).socialMonth ?? SOCIAL.defaultMonth, name: L('사교회', 'Social gathering') }]);
  ipcMain.handle('socialHallOpen', () => openHall());
  ipcMain.handle('socialHallClose', () => { if (hall.win && !hall.win.isDestroyed()) hall.win.close(); hall.win = null; return true; });
  ipcMain.handle('socialTalk', async (_e, spot: unknown, text: unknown, to: unknown) => { try { return { ok: true, lines: await hallTalk(String(spot), String(text ?? ''), typeof to === 'string' && to ? to : undefined), state: socialView() }; } catch (e) { return err(e); } });
  ipcMain.handle('socialLeave', async (_e, spot: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, outcome: await hallLeave(sid, String(spot)), state: socialView() }; } catch (e) { return err(e); } });
  ipcMain.handle('socialIntro', async (_e, a: unknown, c: unknown) => { try { return { ok: true, ...(await scene('intro', String(a), String(c))), state: socialView() }; } catch (e) { return err(e); } });
  ipcMain.handle('socialFinish', async () => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); const s = current(relBookOf(sid)); if (!s || s.rulerAttends !== true) throw new Error(L('참석 중인 사교회가 없습니다.', 'You are not attending a gathering.')); for (const [spot, tk] of Object.entries(relBookOf(sid).scene[s.eventId]?.talks ?? {})) if (!tk.judged) { try { await hallLeave(sid, spot); } catch { /* 모임이 사라짐 */ } } // 대화하던 모임은 마치기 전에 판정
      if (hall.win && !hall.win.isDestroyed()) hall.win.close();
      return { ok: true, lines: finish(sid, true), state: socialView() }; } catch (e) { return err(e); } });
  onLeaderOut(onDeath);
  ipcMain.handle('relArrange', (_e, a: unknown, c: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid || !ctx.gameDate) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const b = relBookOf(sid), ppl = pool(sid, b.ledger), A = ppl.find((x) => x.pid === a), C = ppl.find((x) => x.pid === c);
      if (!A || !C) throw new Error(L('지금 우리 제국에 있는 지도자만 주선할 수 있습니다.', 'You can only arrange meetings between leaders currently in your empire.'));
      const r = arrangeMeeting(b, A, C, ctx.gameDate, rulerPidOf(sid), Math.random); save(sid); pushView();
      const msg = r.result === 'good' ? L(`${A.name}와(과) ${C.name}은(는) 즐겁게 이야기를 나눴습니다.`, `${A.name} and ${C.name} enjoyed their conversation.`) : r.result === 'none' ? L(`${A.name}와(과) ${C.name}은(는) 별일 없이 헤어졌습니다.`, `${A.name} and ${C.name} parted without anything of note.`) : L(`${A.name}와(과) ${C.name}의 만남은 어색하게 끝났습니다.`, `The meeting between ${A.name} and ${C.name} ended awkwardly.`);
      chronNoteWorld(L(`${ctx.gameDate} 통치자가 ${A.name}와(과) ${C.name}의 만남을 주선함`, `${ctx.gameDate} The ruler arranged a meeting between ${A.name} and ${C.name}`), false);
      return { ok: true, msg };
    } catch (e) { return { ok: false, error: String((e as Error)?.message || e) }; }
  });
  ipcMain.handle('relConflictStory', async (_e, id: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, text: await conflictStory(sid, String(id)) }; } catch (e) { return { ok: false, error: String((e as Error)?.message || e) }; } });
  ipcMain.handle('relMediateState', (_e, id: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, state: medView(sid, String(id)) }; } catch (e) { return { ok: false, error: String((e as Error)?.message || e) }; } });
  ipcMain.handle('relMediateSay', async (_e, id: unknown, text: unknown, to: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, state: await medSay(sid, String(id), String(text ?? ''), typeof to === 'string' && to ? to : undefined) }; } catch (e) { return { ok: false, error: String((e as Error)?.message || e) }; } });
  ipcMain.handle('relMediateClose', async (_e, id: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, ...(await medClose(sid, String(id))) }; } catch (e) { return { ok: false, error: String((e as Error)?.message || e) }; } });
  // 인물 관계도(2026-11-09, ui/office-relgraph.js): 우리 지도자(살아 있는 사람)와 플레이어가 아는 관계만 — 인물 카드 「인간관계」와 같은 규칙. 게임에 묻지 않는다.
  ipcMain.handle('relGraph', () => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
    const rp = rulerPidOf(sid), g = buildRelGraph(relBookOf(sid).ledger, live(sid).map((p) => ({ pid: `p:${p.lid}`, name: p.name, cls: p.cls, ruler: `p:${p.lid}` === rp, lv: p.lv, council: !!p.council })), rp);
    return { ok: true, sid, ruler: rp, ...g };
  });
  ipcMain.handle('relationsInfo', (_e, key: unknown) => { const sid = ctx.curSaveId; if (!sid || typeof key !== 'string' || !key.startsWith('p:')) return null; return relationsInfo(sid, key.slice(0, 40)); });
}
