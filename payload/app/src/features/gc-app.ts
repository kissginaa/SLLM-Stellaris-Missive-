// 행성총독회의(13·14·16, 2026-10-23 집 PC 초안). 규칙: src/governor-council.ts. 화면: ui/gov-council.html(총독 홀로그램 회의실). 입구: 집무실 「총독회의」(ui/office-gc.js).
// 사용자 확정: (2026-10-29 정기 개최 폐지 — 격년 11월 정기회의·평시 불참 안정도 디버프·정기회의 알림 없음. 회의는 플레이어가 원할 때 소집만) /
//   체제(민주 → 과두 → 독재)에 따라 총독의 반론 강도·말투. 플레이어가 최종 결정하고, 약속은 앱 기록(게임에서 직접 짓지 않는다).
// 요구는 행성 자료(주거·편의시설·안정도)로 앱이 만들고, 약속한 요구가 다음 달 자료로 이루어지면 「관측상 충족」 → 총독의 정치적 지위(약속 이행) 반영.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { relBookOf, saveRelations } from './relations-app';
import { allocationConflict } from '../discontent';
import { peopleOf } from './people-app';
import { gov, refreshPlanets } from './gov';
import { recordStanding } from './politics-app';
import { issueDoc, setDocStatus } from './collectibles-app'; // 국가 문서함(총독 약속 문서, 알파 11)
import { PLEDGE, judgeable, pledgeDue, pledgeBroken, clampLoyal, pledgeReport } from '../gov-pledges';
import { dayNo } from '../gamedate';
import { deviancyOf } from './deviancy-store';
import { playerGestalt } from './gestalt-app';
import { classKey } from '../speciesClass';
import { planetType, type Planet } from '../planets';
import { type CouncilSchedule, type GovernorRequest, type GcPlanet, type GcGovernor, type GcField, type GcMode, type Regime, regimeOf, AUTH_CODE, REGIME_PROFILE, selectAttendees, GC_SEATS, councilDue, closeOverdue, skipRound, fulfillRound, councilPenaltyCommand, moveRequest, governorsFrom, deriveRequests, planetIssue, requestObserved, councilMessages, GC_FIELD } from '../governor-council';

interface GcMeeting { id: string; kind: 'regular' | 'emergency'; year?: number; /** 참석 신청한 총독 수·전체 총독 수(2026-10-23: 자리 8개, 필요성 순 승인). */ applied?: number; total?: number; topic: string; openedOn: string; closedOn?: string; state: 'active' | 'closed'; regime: Regime; govs: GcGovernor[]; turns: { who: string; lid?: number; ruler?: boolean; text: string; mode: GcMode | 'ruler'; on: string; to?: string }[] }
interface GcBook { sid: string; schedule: CouncilSchedule; meetings: GcMeeting[]; requests: GovernorRequest[]; notified: string[]; /** 총독별 충성(0~100, 처음 50) — 키 = requester(p:lid 또는 gov:이름). 알파 11 총독 약속 문서 */ loyalty: Record<string, number> }
const dir = () => path.join(app.getPath('userData'), 'gov-council');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, GcBook>();
export function sanitizeGcBook(x: unknown, sid: string): GcBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<GcBook>;
  const sc = (o.schedule && typeof o.schedule === 'object' ? o.schedule : null) as CouncilSchedule | null;
  const schedule: CouncilSchedule = { sid, anchorYear: sc && Number.isSafeInteger(sc.anchorYear) ? sc.anchorYear : 0, rounds: sc && sc.rounds && typeof sc.rounds === 'object' ? sc.rounds : {} };
  const meetings = (Array.isArray(o.meetings) ? o.meetings : []).filter((m): m is GcMeeting => !!m && typeof m === 'object' && typeof m.id === 'string' && Array.isArray(m.turns) && Array.isArray(m.govs)).slice(-20).map((m) => ({ ...m, state: 'closed' as const }));
  const requests = (Array.isArray(o.requests) ? o.requests : []).filter((r): r is GovernorRequest => !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.planet === 'string').slice(-200);
  for (const r of Object.values(schedule.rounds)) if (r.state === 'in_progress') r.state = 'due'; // 앱을 다시 켜면 진행 중 회차는 「다시 열 수 있는 due」로(장애와 고의 불참 구분)
  const loyalty: Record<string, number> = {}; if (o.loyalty && typeof o.loyalty === 'object') for (const [k, v] of Object.entries(o.loyalty as Record<string, unknown>)) if (/^(p:\d{1,9}|gov:.{1,80})$/.test(k) && Number.isFinite(v)) loyalty[k] = clampLoyal(v as number);
  return { sid, schedule, meetings, requests, notified: Array.isArray(o.notified) ? o.notified.slice(-20) : [], loyalty };
}
function bookOf(sid: string): GcBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeGcBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'gov-council', error: e }); b = sanitizeGcBook(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ ...b, meetings: b.meetings.slice(-20), requests: b.requests.slice(-200) }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'gov-council', error: e }); }
}

/** 인물 말투·신뢰(persona-app). main.ts 가 꽂는다. */
let personaPeek: ((sid: string, key: string) => { persona?: string; trust: number } | null) | null = null;
let personaNote: ((sid: string, key: string, text: string, delta?: number) => void) | null = null;
export function setGcPersona(p: { mem: (sid: string, key: string) => { persona?: string; trust: number } | null; note?: (sid: string, key: string, text: string, delta?: number) => void }): void { personaPeek = p.mem; personaNote = p.note ?? null; }
const loyalOf = (b: GcBook, who: string): number => b.loyalty[who] ?? PLEDGE.loyalDefault;

const yearOf = (d: string) => Number(/^(\d+)\./.exec(d)?.[1] ?? NaN), monthOf = (d: string) => Number(/^\d+\.(\d+)\./.exec(d)?.[1] ?? NaN);
/** 기준 연도(13: 캠페인당 한 번 저장, 옮기지 않음): 처음 본 날짜가 11월 이하면 그해, 12월이면 다음 해. */
export function ensureAnchor(s: CouncilSchedule, today: string): void { if (s.anchorYear) return; const y = yearOf(today), m = monthOf(today); if (Number.isFinite(y)) s.anchorYear = m <= 11 ? y : y + 1; }
const toGc = (p: Planet, sid = ''): GcPlanet => ({ ...(() => { const d = sid && playerGestalt() ? deviancyOf(sid, p.name) : undefined; return d !== undefined ? { deviancy: d } : {}; })(), name: p.name, governor: p.governor, pops: p.pops, stability: p.stability, amenities: p.amenities, housing: p.housing, capital: p.capital, type: planetType(p) });
const planetsNow = (sid: string): GcPlanet[] => (gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets.map((p) => toGc(p, sid)) : []); // 단일 의식이면 이탈도 붙인다(알파 11)
const regimeNow = (): Regime => { const a = gameState.last?.sid === ctx.curSaveId ? gameState.last?.authority : undefined; return regimeOf(a !== undefined ? AUTH_CODE[a] : undefined); };
const atWarNow = (): boolean | null => (gameState.last && gameState.last.sid === ctx.curSaveId ? gameState.last.wars.length > 0 : null);
const rulerName = (sid: string) => peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? '';
const REGIME_NAME: Record<Regime, [string, string]> = { democratic: ['민주주의', 'Democratic'], oligarchic: ['과두정', 'Oligarchic'], autocratic: ['독재·제정', 'Autocratic'], neutral: ['기타 체제', 'Other government'] };
const STATE_NAME: Record<string, [string, string]> = { raised: ['제기됨', 'Raised'], discussed: ['논의함', 'Discussed'], promised: ['약속함', 'Promised'], declined: ['거절함', 'Declined'], deferred: ['보류', 'Deferred'], observed_fulfilled: ['이루어짐(관측)', 'Met (observed)'], broken: ['불이행', 'Broken'], withdrawn: ['철회됨', 'Withdrawn'], superseded: ['대체됨', 'Superseded'] };

export const gcw = { win: null as BrowserWindow | null, active: '' as string, busy: false };
const activeMeeting = (sid: string) => bookOf(sid).meetings.find((m) => m.id === gcw.active && m.state === 'active') ?? null;
function view() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const b = bookOf(sid), today = ctx.gameDate || '', m = activeMeeting(sid), planets = planetsNow(sid), regime = m?.regime ?? regimeNow();
  ensureAnchor(b.schedule, today);
  const due = Object.values(b.schedule.rounds).find((r) => r.state === 'due' || r.state === 'in_progress') ?? null;
  const y = yearOf(today), next = b.schedule.anchorYear ? (() => { let n = Math.max(b.schedule.anchorYear, y); if ((n - b.schedule.anchorYear) % 2) n++; if (n === y && monthOf(today) > 11) n += 2; return n; })() : null;
  const people = peopleOf(sid), byName = new Map(people.filter((p) => !p.gone).map((p) => [p.name, p]));
  const grp = m ? { governors: m.govs, unassigned: [] as string[] } : governorsFrom(planets, people);
  const nameOfReq = (r: GovernorRequest) => (r.requester.startsWith('p:') ? people.find((p) => `p:${p.lid}` === r.requester)?.name : r.requester.slice(4)) || r.requester;
  return {
    sid, date: today, empire: ctx.playerName || '', ruler: rulerName(sid), busy: gcw.busy, gameRunning: !!ctx.gameRunning, playerCls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human',
    regime, regimeName: L(...REGIME_NAME[regime]), regimeStyle: L(REGIME_PROFILE[regime].style.ko, REGIME_PROFILE[regime].style.en), atWar: atWarNow(),
    due: null, nextYear: null, // 정기회의 폐지(2026-10-29): 화면에 정기회의 안내·건너뛰기 버튼을 띄우지 않는다 planetsLoaded: planets.length > 0,
    governors: grp.governors.map((g) => { const ps = planets.filter((p) => g.planets.includes(p.name)); const top = ps.map((p) => ({ p, i: planetIssue(p) })).sort((a, c) => c.i.severity - a.i.severity)[0]; const per = byName.get(g.name);
      const worst = [...ps].sort((a, c) => (a.stability ?? 50) - (c.stability ?? 50))[0], raw = worst ? gov.planetList?.planets.find((x) => x.name === worst.name) : undefined;
      return { name: g.name, lid: g.lid ?? 0, planets: g.planets, loyal: loyalOf(b, g.lid ? `p:${g.lid}` : `gov:${g.name}`), issue: top ? L(GC_FIELD[top.i.field].ko, GC_FIELD[top.i.field].en) : '', present: !m || m.govs.some((x) => x.name === g.name), lv: per?.lv ?? 0, stab: worst?.stability ?? null, seatPlanet: worst?.name ?? '', pc: raw?.pc ?? 0 }; }),
    unassigned: grp.unassigned,
    planets: planets.map((p) => ({ ...p })),
    requests: b.requests.filter((r) => !['declined', 'withdrawn', 'superseded'].includes(r.state) && (r.state !== 'observed_fulfilled' || r.fulfilledOn === today) && (r.state !== 'broken' || r.brokenOn === today)).slice(-24).reverse().map((r) => ({ id: r.id, planet: r.planet, by: nameOfReq(r), field: L(GC_FIELD[r.field as GcField]?.ko ?? r.field, GC_FIELD[r.field as GcField]?.en ?? r.field), state: r.state, stateName: L(...(STATE_NAME[r.state] ?? [r.state, r.state])), raisedOn: r.raisedOn, evidence: r.evidence })),
    meeting: m ? { id: m.id, kind: m.kind, year: m.year ?? null, topic: m.topic, openedOn: m.openedOn, turns: m.turns.slice(-60), applied: m.applied ?? m.govs.length, total: m.total ?? m.govs.length, seats: GC_SEATS } : null,
    past: b.meetings.filter((x) => x.id !== gcw.active).slice(-6).reverse().map((x) => ({ id: x.id, kind: x.kind, topic: x.topic, openedOn: x.openedOn })),
  };
}
const push = () => safeSend(gcw.win, 'gcState', view());
export function openGc(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  if (gcw.win && !gcw.win.isDestroyed()) { gcw.win.show(); gcw.win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
  const ow = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL())), ob = ow ? ow.getBounds() : null;
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#07141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  gcw.win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'gov-council.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (gcw.win === w) gcw.win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
  return { ok: true };
}

async function penalty(sid: string, b: GcBook, year: number): Promise<void> {
  const r = b.schedule.rounds[String(year)]; if (!r || r.state !== 'missed_peacetime' || r.penalty === 'applied') return;
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) { r.penalty = 'pending'; return; }
  const req = ++link.reqCounter; r.penaltyReq = req; r.penalty = 'pending';
  try { const st = (await terminalRequest(councilPenaltyCommand(req, sid, year), 'COUNCILPEN', req)).kv.status; r.penalty = st === 'applied' || st === 'duplicate' ? 'applied' : 'unknown'; if (st === 'missing') logDiagnostic('warn', 'gc.penalty_modifier_missing', { year, hint: 'mod outdated: sllm_council_absent not loaded' }); }
  catch (e) { r.penalty = 'unknown'; logDiagnostic('warn', 'gc.penalty_failed', { error: (e as Error).message }); }
  if (r.penalty === 'applied') chronNoteWorld(L(`${ctx.gameDate} ${year}년 정기 총독회의 불참 — 행성 안정도 하락`, `${ctx.gameDate} Missed the ${year} regular governors' council — planet stability falls`), true);
}
function toast(title: string, body: string): void { (office as { toastGo: string }).toastGo = 'gc'; ctx.notify({ kind: 'office', title, body, action: L('집무실', 'Office') }); }

async function onMonth(sid: string, date: string, atWar: boolean | null): Promise<void> {
  const b = bookOf(sid); ensureAnchor(b.schedule, date);
  // 정기 총독회의(격년 11월)·평시 불참 디버프는 2026-10-29 사용자 결정으로 없앴다. 회의는 「긴급 소집」(언제든)만 남는다.
  // 약속한 요구가 게임 자료로 이루어졌는지(이번 달 행성 자료가 있을 때만 — 일부러 다시 읽지 않는다)
  const planets = planetsNow(sid);
  for (const r of b.requests) if (requestObserved(r, planets.find((p) => p.name === r.planet)) && moveRequest(r, 'observed_fulfilled', date)) {
    pledgeSettled(sid, b, r, 'kept', date); // 총독 약속 문서: 호감 +3·충성 +5(알파 11)
    if (r.requester.startsWith('p:')) recordStanding(sid, { id: `gc-kept:${r.id}`, kind: 'promise_kept', pid: r.requester, planet: r.planet, date, causeGroup: `gcreq:${r.id}`, helpedResidents: true });
    chronNoteWorld(L(`${date} 「${r.planet}」 — 총독회의에서 약속한 ${GC_FIELD[r.field as GcField]?.ko ?? r.field}가 자료상 이루어졌습니다`, `${date} "${r.planet}" — the ${GC_FIELD[r.field as GcField]?.en ?? r.field} promised at the governors' council is now met in the data`), false);
  }
  // 총독 약속 불이행(알파 11): 판정할 수 있는 약속이 기한(없으면 약속일 + 2년)을 넘김 → 호감 −10·충성 −15·정치적 지위 사건
  for (const r of b.requests) if (pledgeBroken(r, date) && moveRequest(r, 'broken', date)) {
    pledgeSettled(sid, b, r, 'broken', date);
    if (r.requester.startsWith('p:')) recordStanding(sid, { id: `gc-broken:${r.id}`, kind: 'promise_broken', pid: r.requester, planet: r.planet, date, causeGroup: `gcreq:${r.id}` });
    chronNoteWorld(L(`${date} 「${r.planet}」 — 총독회의에서 약속한 ${GC_FIELD[r.field as GcField]?.ko ?? r.field}를 기한 안에 이루지 못했습니다(약속 불이행)`, `${date} "${r.planet}" — the ${GC_FIELD[r.field as GcField]?.en ?? r.field} promised at the governors' council was not met in time (promise broken)`), false);
    toast(L('총독과의 약속 불이행', 'Promise to a governor broken'), L(`「${r.planet}」 총독에게 한 약속의 기한이 지났습니다. 그 총독의 호감과 충성이 크게 떨어졌습니다.`, `The deadline of your promise to the governor of "${r.planet}" has passed. Their regard and loyalty fell sharply.`));
  }
  save(sid); push();
}
/** 비서용(물어볼 때만): 지금 세이브의 총독 약속 목록(영어 자료 한 덩어리). */
export function pledgeFacts(sid: string): string {
  const b = bookOf(sid), people = peopleOf(sid);
  const nameOf = (r: unknown) => { const q = r as GovernorRequest; return (q.requester.startsWith('p:') ? people.find((p) => `p:${p.lid}` === q.requester)?.name : q.requester.slice(4)) || 'a governor'; };
  return pledgeReport(b.requests.filter((r) => ['promised', 'observed_fulfilled', 'broken'].includes(r.state)), nameOf, ctx.gameDate || '', dayNo);
}
/** 단일 의식 보고서(알파 11): 아직 이행 중인 약속(행성·분야·남은 날, 급한 것부터). */
export function openPledgeList(sid: string): { planet: string; field: string; daysLeft: number | null }[] {
  const now = dayNo(ctx.gameDate || '');
  return bookOf(sid).requests.filter((r) => r.state === 'promised').map((r) => { const due = pledgeDue(r), d = due ? dayNo(due) : null; return { planet: r.planet, field: r.field, daysLeft: d !== null && now !== null ? d - now : null }; }).sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9)).slice(0, 6);
}
/** 약속 문서 정산: 문서 도장·충성·호감(인물 기억). 문서가 없던 옛 약속도 충성·호감은 정산한다. */
function pledgeSettled(sid: string, b: GcBook, r: GovernorRequest, how: 'kept' | 'broken', date: string): void {
  if (!judgeable(r.field)) return; // 기록만(개발 투자) — 영향 없음
  const d = PLEDGE[how], who = r.requester;
  b.loyalty[who] = clampLoyal(loyalOf(b, who) + d.loyal);
  if (who.startsWith('p:')) try { personaNote?.(sid, who, how === 'kept' ? L(`${date} 총독회의에서 통치자가 한 약속(${r.planet} ${GC_FIELD[r.field as GcField]?.ko ?? r.field})이 지켜졌다`, `${date} The ruler kept the council promise (${GC_FIELD[r.field as GcField]?.en ?? r.field} for ${r.planet})`) : L(`${date} 총독회의에서 통치자가 한 약속(${r.planet} ${GC_FIELD[r.field as GcField]?.ko ?? r.field})이 기한 안에 지켜지지 않았다`, `${date} The ruler broke the council promise (${GC_FIELD[r.field as GcField]?.en ?? r.field} for ${r.planet})`), d.trust); } catch (e) { logDiagnostic('warn', 'gc.pledge_persona_failed', { error: String(e) }); }
  if (r.docId) setDocStatus(sid, r.docId, how, date);
}
/** 약속이 생길 때(우선·조건부 지원) 국가 공인 문서 발행. 기한: 판정할 수 있는 분야는 약속일 + 2년(정해진 기한이 있으면 그것). */
function issuePledge(sid: string, b: GcBook, r: GovernorRequest, today: string, govName: string): void {
  if (r.docId) return;
  const due = pledgeDue(r); if (due) r.due = due;
  try { r.docId = issueDoc(sid, { issuer: 'gov', kind: 'pledge', date: today, ref: r.field, planet: r.planet, by: rulerName(sid) || undefined, to: govName || undefined, nation: ctx.playerName || undefined, ...(due ? { due } : {}), status: judgeable(r.field) ? 'active' : 'record' }); }
  catch (e) { logDiagnostic('warn', 'gc.pledge_doc_failed', { error: String(e) }); }
}

async function speakAll(sid: string, m: GcMeeting, text: string, mode: { kind: 'named'; name: string } | { kind: 'all'; supplement: boolean } | { kind: 'roll_call' }) {
  const planets = planetsNow(sid), people = peopleOf(sid), b = bookOf(sid), today = ctx.gameDate || m.openedOn;
  const present = m.govs.filter((g) => planets.some((p) => g.planets.includes(p.name)));
  const sev = (g: GcGovernor) => Math.max(0, ...planets.filter((p) => g.planets.includes(p.name)).map((p) => planetIssue(p).severity));
  let order: { g: GcGovernor; mode: GcMode }[] = [];
  if (mode.kind === 'named') { const g = present.find((x) => x.name === mode.name); if (g) order = [{ g, mode: 'named' }]; }
  else if (mode.kind === 'roll_call') order = present.slice(0, 8).map((g) => ({ g, mode: 'roll_call' as const }));
  else {
    const lastSpoke = (g: GcGovernor) => { for (let i = m.turns.length - 1; i >= 0; i--) if (m.turns[i].who === g.name) return i; return -1; };
    const sorted = [...present].sort((a, c) => sev(c) - sev(a) || lastSpoke(a) - lastSpoke(c));
    if (sorted[0]) order.push({ g: sorted[0], mode: 'primary' });
    if (sorted[1] && (mode.supplement || REGIME_PROFILE[m.regime].openRebuttal)) order.push({ g: sorted[1], mode: 'rebuttal' }); // 반론은 공개 반론이 있는 체제에서 기본, 독재·제정에선 원할 때만(완곡한 건의)
  }
  if (!order.length) throw new Error(L('답할 총독이 없습니다. 행성 목록을 다시 불러와 주세요.', 'No governor can answer. Reload the planet list.'));
  const msg = String(text ?? '').trim().slice(0, 800);
  if (msg) m.turns.push({ who: rulerName(sid) || L('통치자', 'Ruler'), ruler: true, text: msg, mode: 'ruler', on: today, ...(mode.kind === 'named' ? { to: mode.name } : {}) });
  gcw.busy = true; push();
  const reqs = b.requests.filter((r) => ['raised', 'discussed', 'promised', 'deferred'].includes(r.state)).map((r) => ({ planet: r.planet, field: r.field as GcField, state: r.state, by: r.requester.startsWith('p:') ? people.find((p) => `p:${p.lid}` === r.requester)?.name ?? '' : r.requester.slice(4) }));
  const replies: { name: string; say: string }[] = [];
  try {
    for (const { g, mode: md } of order) {
      const per = g.lid ? people.find((p) => p.lid === g.lid) : undefined, mem = g.lid ? personaPeek?.(sid, `p:${g.lid}`) : null;
      const recent = m.turns.slice(-8).map((t) => `${t.who}: ${t.text.slice(0, 300)}`);
      const raw = String(await ctx.ai.chat(councilMessages({ empire: ctx.playerName, ruler: rulerName(sid), date: today, regime: m.regime, topic: m.topic, kind: m.kind }, { name: g.name, planets: planets.filter((p) => g.planets.includes(p.name)), traits: per?.traits ?? [], persona: mem?.persona, trust: mem?.trust, loyal: loyalOf(b, g.lid ? `p:${g.lid}` : `gov:${g.name}`), pledges: b.requests.filter((r) => r.requester === (g.lid ? `p:${g.lid}` : `gov:${g.name}`) && ['promised', 'observed_fulfilled', 'broken'].includes(r.state)).map((r) => ({ field: GC_FIELD[r.field as GcField]?.en ?? r.field, planet: r.planet, state: r.state })) }, planets, reqs, recent, md, msg), { maxTokens: 700, purpose: 'governors-council' }) ?? '').trim();
      if (!raw || gcw.active !== m.id) break;
      m.turns.push({ who: g.name, ...(g.lid ? { lid: g.lid } : {}), text: raw.slice(0, 1600), mode: md, on: today }); replies.push({ name: g.name, say: raw.slice(0, 1600) });
    }
    for (const r of b.requests) if (r.state === 'raised') moveRequest(r, 'discussed', today); // 회의에서 말이 오갔으면 논의함
  } finally { gcw.busy = false; save(sid); push(); }
  return replies;
}

/** 배분 갈등 발생 확률(36: 미정 → 초기 조정값). */
export const ALLOC_CONFLICT_P = 0.5;
const rulerPidNow = (sid: string): string => { const r = peopleOf(sid).find((p) => !p.gone && p.ruler); return r ? `p:${r.lid}` : ''; };
export function registerGc(): void {
  // 13: 마감 직후(12월)가 아니면 그때의 전쟁 상태를 모르므로 null → pending_review(현재 상태로 과거를 추정해 벌주지 않는다)
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId || snap.gestalt) return; const mo = Number(/^\d+\.(\d+)\./.exec(snap.date)?.[1]); void onMonth(snap.sid, snap.date, mo === 12 ? snap.wars.length > 0 : null).catch((e) => logDiagnostic('warn', 'gc.month_failed', { error: (e as Error).message })); }, 'govcouncil');
  const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: view() });
  ipcMain.handle('gcOpen', () => openGc());
  ipcMain.handle('gcState', () => view());
  ipcMain.handle('gcPlanets', async () => { const r = await refreshPlanets(); push(); return r && 'error' in r ? { ok: false, error: r.error, state: view() } : { ok: true, state: view() }; });
  ipcMain.handle('gcConvene', async (_e, a: { kind?: unknown; topic?: unknown }) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const b = bookOf(sid), today = ctx.gameDate || ''; ensureAnchor(b.schedule, today);
      if (activeMeeting(sid)) throw new Error(L('이미 열린 회의가 있습니다.', 'A council is already in session.'));
      const r = await refreshPlanets(); if (r && 'error' in r) throw new Error(r.error);
      const planets = planetsNow(sid), grp = governorsFrom(planets, peopleOf(sid)); if (!grp.governors.length) throw new Error(L('총독이 배정된 행성이 없습니다.', 'No planet has a governor assigned.'));
      const kind = a?.kind === 'regular' ? 'regular' : 'emergency', round = kind === 'regular' ? councilDue(b.schedule, today) : null;
      if (kind === 'regular' && (!round || (round.state !== 'due' && round.state !== 'in_progress'))) throw new Error(L('지금은 정기회의 기간(정기 연도 11월)이 아닙니다. 긴급 소집을 쓰세요.', 'It is not the regular council period (November of a council year). Use an emergency session.'));
      if (round) { round.state = 'in_progress'; round.openedOn = today; }
      const sel = selectAttendees(grp.governors, planets, Math.random); // 자리 8개: 안정도가 낮을수록 신청, 필요성이 큰 8명만 승인
      const m: GcMeeting = { id: `gc:${randomUUID().slice(0, 12)}`, kind, ...(round ? { year: round.year } : {}), applied: sel.applied, total: grp.governors.length, topic: String(a?.topic ?? '').replace(/\s+/g, ' ').trim().slice(0, 300), openedOn: today, state: 'active', regime: regimeNow(), govs: sel.approved, turns: [] };
      b.meetings.push(m); b.requests.push(...deriveRequests(sid, sel.approved, planets, b.requests, today)); gcw.active = m.id; save(sid);
      chronNoteWorld(L(`${today} ${kind === 'regular' ? `${round!.year}년 정기` : '긴급'} 행성총독회의 — 총독 ${sel.approved.length}명 승인(신청 ${sel.applied}명 · 전체 ${grp.governors.length}명)`, `${today} ${kind === 'regular' ? `${round!.year} regular` : 'Emergency'} governors' council — ${sel.approved.length} governor(s) admitted (${sel.applied} applied of ${grp.governors.length})`), true);
      push(); return { ok: true, state: view() };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('gcSay', async (_e, a: { text?: unknown; to?: unknown; supplement?: unknown; rollCall?: unknown }) => {
    try {
      const sid = ctx.curSaveId, m = sid ? activeMeeting(sid) : null; if (!sid || !m) throw new Error(L('열린 회의가 없습니다.', 'No council is in session.'));
      if (gcw.busy) throw new Error(L('총독들이 말하는 중입니다.', 'The governors are speaking.'));
      const to = typeof a?.to === 'string' && a.to ? a.to : '', mode = a?.rollCall ? { kind: 'roll_call' as const } : to ? { kind: 'named' as const, name: to } : { kind: 'all' as const, supplement: !!a?.supplement };
      if (mode.kind !== 'roll_call' && !String(a?.text ?? '').trim()) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
      return { ok: true, replies: await speakAll(sid, m, String(a?.text ?? ''), mode), state: view() };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('gcDecide', (_e, id: unknown, choice: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const b = bookOf(sid), r = b.requests.find((x) => x.id === String(id)); if (!r) throw new Error(L('그 요구를 찾을 수 없습니다.', 'That request was not found.'));
      const today = ctx.gameDate || '', c = String(choice);
      if (r.state === 'raised') moveRequest(r, 'discussed', today);
      if (r.state === 'deferred' && c !== 'hold' && c !== 'more_info') moveRequest(r, 'discussed', today);
      const to = c === 'priority' || c === 'conditional' ? 'promised' : c === 'other' ? 'declined' : 'deferred';
      if (!moveRequest(r, to, today)) throw new Error(L('이 요구는 지금 그렇게 바꿀 수 없습니다.', 'This request cannot be changed that way now.'));
      if (to === 'promised') { const people = peopleOf(sid), gname = (r.requester.startsWith('p:') ? people.find((p) => `p:${p.lid}` === r.requester)?.name : r.requester.slice(4)) || ''; issuePledge(sid, b, r, today, gname); } // 총독 약속 국가 공인 문서(알파 11)
      // 36 정책·배분 갈등: 「다른 행성 우선」으로 밀린 요구가 같은 분야의 지원받은 요구와 양립 불가(exclusive)면, 밀린 총독 → 결정자(통치자) 불만 후보. 발생 확률은 미정 → 자리값.
      if (c === 'other' && r.requester.startsWith('p:')) {
        const chosen = b.requests.filter((x) => x.id !== r.id && x.field === r.field && x.state === 'promised' && x.requester !== r.requester && x.requester.startsWith('p:')).sort((x, y) => (y.promisedOn ?? '').localeCompare(x.promisedOn ?? ''))[0];
        if (chosen) { r.exclusiveWith = [...new Set([...(r.exclusiveWith ?? []), chosen.id])]; const rb = relBookOf(sid), rp = rulerPidNow(sid); if (rp) { const made = allocationConflict(rb.ledger, { decisionId: r.id, exclusive: true, chosen: { requester: chosen.requester, reqId: chosen.id }, rejected: { requester: r.requester, reqId: r.id }, decidedBy: rp, date: today }, ALLOC_CONFLICT_P, Math.random); if (made.length) { saveRelations(sid); logDiagnostic('info', 'gc.allocation_conflict', { request: r.id, chosen: chosen.id }); } } }
      }
      r.decidedBy = rulerName(sid); if (c === 'conditional') r.evidence.push(`${today}: conditional support`); if (c === 'more_info') r.evidence.push(`${today}: more information requested`);
      const m = activeMeeting(sid); if (m) m.turns.push({ who: rulerName(sid) || L('통치자', 'Ruler'), ruler: true, text: L(`[결정] ${r.planet} ${GC_FIELD[r.field as GcField]?.ko ?? r.field} — ${({ priority: '우선 지원', conditional: '조건부 지원', other: '다른 행성 우선', more_info: '추가 자료 요청', hold: '보류' } as Record<string, string>)[c] ?? c}`, `[Decision] ${r.planet} ${GC_FIELD[r.field as GcField]?.en ?? r.field} — ${({ priority: 'priority support', conditional: 'conditional support', other: 'another planet first', more_info: 'more information requested', hold: 'on hold' } as Record<string, string>)[c] ?? c}`), mode: 'ruler', on: today });
      save(sid); push(); return { ok: true, state: view() };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('gcEnd', () => {
    const sid = ctx.curSaveId, m = sid ? activeMeeting(sid) : null; if (!sid || !m) return { ok: true, state: view() };
    const b = bookOf(sid), today = ctx.gameDate || m.openedOn; m.state = 'closed'; m.closedOn = today;
    const spoke = m.turns.some((t) => !t.ruler); // 13: 화면만 열고 닫은 것은 이행이 아니다 — 총독 발언이 하나는 있어야(결론까지 저장)
    if (m.kind === 'regular' && m.year && b.schedule.rounds[String(m.year)] && spoke) fulfillRound(b.schedule.rounds[String(m.year)], today);
    gcw.active = ''; save(sid); push(); return { ok: true, state: view() };
  });
  ipcMain.handle('gcSkip', async () => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const b = bookOf(sid), today = ctx.gameDate || '', round = councilDue(b.schedule, today); if (!round || round.state !== 'due') throw new Error(L('건너뛸 정기회의가 없습니다.', 'There is no regular council to skip.'));
      const war = atWarNow(); if (war === null) throw new Error(L('이번 달 게임 상황을 아직 받지 못해 전쟁 여부를 확인할 수 없습니다.', 'This month\'s game state has not arrived yet, so war status cannot be checked.'));
      const r = skipRound(round, today, war); save(sid);
      if (r.state === 'missed_peacetime') await penalty(sid, b, round.year);
      save(sid); push(); return { ok: true, skipped: r.state, state: view() };
    } catch (e) { return err(e); }
  });
  ipcMain.handle('gcClose', () => { if (gcw.win && !gcw.win.isDestroyed()) gcw.win.close(); gcw.win = null; return true; });
}
