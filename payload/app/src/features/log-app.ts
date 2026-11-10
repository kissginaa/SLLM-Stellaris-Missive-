// 레전드 오브 갤럭시(앱 쪽, 2026-10-30). 경기: src/log-game.ts · 규칙: src/log-club.ts · 고정 명단·무기: src/log-data.ts · 화면: ui/log.html.
// 우주 경기장(외출)에서 연다. 버튼 두 개: 「구단 후원」(후원 뒤 「후원 구단」) / 「경기 구경」.
// 2026-10-30 사용자 수정: 나라가 구단을 운영하지 않는다 — 8개 구단은 모두 AI가 운영(영입·방출·훈련·전략), 플레이어는 한 팀을 「후원」하고
//   등급만큼 요청한다(1 후원명·전략·훈련 / 2 + 영입 추천 / 3 + 팀 이름·직접 밴픽). 게임은 본게임 날짜로 저절로 진행.
// 시즌: 게임 1년 = 한 시즌, 2·3·5·6·8·9·11·12월에 라운드(8팀, 1~7 풀리그, 8 결승·3위전). 늘 8팀(행성이 적으면 큰 행성에 두 번째 팀).
// 선수: 고정 명단 200명(레전드 20명) — 처음 80명이 뛰고 시즌마다 신인 4~12명(전체 80명 안팎) 데뷔, 명단이 다 나오면 늘 새 닉네임의 신인(조합 5,000개+).
// 돈: 후원금은 금고에서(시즌마다), 후원 구단 상금의 몫은 금고로(작게). 경기는 앱 안 계산만(게임 명령 없음).
// 은하 올림픽: 은하 공동체가 생기면(의회 안건에 회원 명단이 들어오면) 10년마다. 개최국 투표, 한 종목, 대표팀은 국내 리그 전체 선수 중에서 플레이어가 고름.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Worker } from 'worker_threads';
import { type WTeam, type Worlds, type WorldsInput, runBracket, formatFor } from '../log-worlds';
import { ctx } from '../app/ctx';
import { bgWriteJson } from '../app/bg-worker';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { onGameSnapshot, gameState } from './gamestate-app';
import { terminalRequest } from './terminal';
import { link } from '../app/game-link';
import { receiveLetter } from './mail-app';
import { noteExtra } from './media';
import { NAT, clampHeat, heatFactor, scaled, heatGain, heatDecay, playStyle, ethicBonus, homeEffects, rivalsOf, toneOf, letterText, sportsArticle, logNationCommand, PLANET_MODS, COUNTRY_MODS, OPINION_MODS, type NatOp, type Pair, type SportsKind } from '../log-nation';
import { gov } from './gov';
import { protestPlanetsNow } from './protests-app';
import { gameName, namePair } from './namegen-app';
import { vaultBalance, spendFromVault, earnToVault, vaultSuspicionUp } from './vault-app';
import { council, councilHooks, openCouncil, type AgendaInfo } from './council';
import { moodNudge } from './mood-app';
import { chronNoteWorld } from './chronicle-app';
import { terminal } from './terminal';
import { type Role, type TeamDef, type Strategy, type Side, type Rules, ROLES, newGame, tick, frame, playOut, teamRating, lanePos, towerPos, OBJ, BOSS, CAMPS, ENGINE } from '../log-game';
import { ULT_NAMES } from '../log-data';
import { registerSecFacts } from './secretary-live';
import { type HostBid, type HostEvent, type LobbyKind, type GameCost, HOST, PREP, lobbyCost, lobbyLike, speechLike, predict, hostResult, homeBonus, hostPayCommand, sanitizeHostBid } from '../log-host';
import { type Player, type Focus, type MatchRec, type Draft, type TotoSlip, type TotoPick, type Tier, type Logo, EMBLEMS, LOGO_SHAPES, LOGO_PATTERNS, LOGO_COLORS, type MetaState, type MissionKind, type GearSlot, META, firstRelease, patchedMods, runPatch, recordDraft, conditions, MISSIONS, pickMission, GEAR, GEAR_GRADES, GEAR_SEASONS, gearBonus, ALLSTAR_RULES, COND_NAMES, nickname, FIRST_NICKS, MASCOTS, COMPANY_COUNT, companyName, brandOf, FOSTER, canFoster, readyForLegend, pickEpithet, EXTRA_PORTRAITS, WEAPONS, weaponById, KIND_NAME, ROSTER, START_ACTIVE, TRAITS, playerFromRoster, newPlayer, overall, salaryFor, signingFee, bestLineup, autoDraft, draftAi, draftMove, draftDone, emptyDraft, DRAFT_ORDER, teamDef, trainQuarter, roundRobin, standings, rankOrder, ROUND_MONTHS, PRIZE, SPONSOR, tierCan, slipOdds, OLYMPIC, hostVote, olympicBracket, seeded, hashSeed, winChance, odds } from '../log-club';

/** company = 모기업(회사 번호 → log-data companyName), 팀 이름 = 「회사명 + 마스코트」, planet = 연고 행성(홈 경기). */
interface Team { id: string; planet: string; company: number; mascot: number; logo?: Logo; myLogo?: Logo; gear?: Partial<Record<GearSlot, { grade: number; until: number }>>; players: string[]; strat: Strategy; focus: Focus; budget: number }
/** 후원: 한 팀, 등급 1~3. req = 요청(구단이 따름), scout = 영입 추천(2등급부터, 3명까지), next = 다음 시즌부터 바뀔 것. */
/** mission = 구단이 제시한 시즌 목표(달성하면 후원금 × 배율 보너스), prog = 진행(킬·MVP·수호자). */
interface Sponsor { team: string; tier: Tier; label: string; name: string; since: number; foster?: string; mission?: { kind: MissionKind; n: number; season: number; reward: number; prog: { kills: number; mvps: number; warden: number }; result?: boolean }; req: { strat?: Strategy; focus?: Focus; practice: Record<string, string> }; scout: string[]; next?: { team: string; tier: Tier } | { cancel: true } }
interface Oly { members: Array<{ idx: number; name: string; weight: number }>; seenYear?: number; year?: number; bidOpen?: boolean; weBid?: boolean; bidders?: number[]; host?: number; hostName?: string; hb?: HostBid; national?: Partial<Record<Role, string>>; resultYear?: number; result?: { gold: string; silver: string; bronze: string; games: Array<{ a: string; b: string; seed: number; winner: 0 | 1; defs: [TeamDef, TeamDef]; eng?: number }>; /** 라운드별 공개(2026-10-31): 공개한 단계 수(없으면 다 공개된 옛 기록) · 마지막 공개 달 · 우리 나라 이름 · 대표팀 선수 · 우리 메달 */ shown?: number; at?: string; us?: string; ids?: string[]; ourMedal?: number }; medals: Record<string, [number, number, number]> }
interface LogSave { season: number; teams: Team[]; players: Record<string, Player>; rounds: MatchRec[][]; done: number; history: Array<{ season: number; champ: string; runner: string }>; sponsor: Sponsor | null; free: string[]; toto: TotoSlip[]; quarter: string; prepared?: { round: number; match: number; draft: Draft } | null; oly: Oly; debut: number; gens: Record<string, number>; retired: string[]; news: Array<{ season: number; text: string }>; nick?: number; meta?: MetaState; worlds?: Worlds; worldsPending?: WorldsInput; worldsHistory?: Array<{ year: number; champ: string; region: string; runner: string; ours: boolean }>; nat?: NatSave; allstar?: { season: number; rule: string; seed: number; defs: [TeamDef, TeamDef]; winner: 0 | 1; kills: [number, number]; mvp: string; eng?: number }; epithets?: string[]; portraitPick?: string; /** 시나리오 「화합 대회」(2026-11-06): 우리가 초청해 여는 대회의 해. 있으면 본편의 정기 월즈·올림픽 반복은 멈춘다 */ scn?: { oly?: number; worlds?: number } }
/** LoG ↔ 나라 연동(2026-10-31, src/log-nation.ts). heat = 리그 열기, meet = 월즈 맞대결 수(나라 idx), lastStreak = 연고 행성 연속 꼴찌, ops = 게임에 보낼 수정자(게임이 켜져 있을 때 보냄). */
type QOp = { t: 'planet'; name: string; mod: string; days: number } | Exclude<NatOp, { t: 'planet' }>;
interface NatSave { heat: number; month?: string; meet: Record<string, number>; lastStreak: Record<string, number>; festival?: number; warPolicy: 'refuse' | 'play';
  wbid?: { year: number; open?: boolean; weBid?: boolean; host?: number; hostName?: string; hb?: HostBid }; scandal?: { team: string; season: number; state: 'open' | 'covered' | 'investigated'; revealBy?: number; done?: boolean };
  penalty?: Record<string, number>; transfer?: { pid: string; idx: number; nation: string; season: number }; invited?: number; sports: Array<{ date: string; head: Pair; body: Pair }>;
  ops: Array<{ n: number; ops: QOp[]; tries: number; why: string }>; opN: number; homeNow?: { season: number; pride: string[]; gloom: string[] }; forfeits?: number }
let data: { saves: Record<string, LogSave> } | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_log.json');
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'log', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { bgWriteJson(file(), all(), (err) => { if (err) logDiagnostic('error', 'storage.write_failed', { store: 'log', error: err }); }); } // 1MB 남짓 — 작업 스레드가 쓴다(2026-11-08)
const fresh = (): LogSave => ({ season: 0, teams: [], players: {}, rounds: [], done: 0, history: [], sponsor: null, free: [], toto: [], quarter: '', prepared: null, oly: { members: [], medals: {} }, debut: 0, gens: {}, retired: [], news: [] });
/** 저장 읽기. 「구단 창설」 시절(시험판) 저장은 형식이 달라 새로 시작. */
const saveOf = (sid: string): LogSave => { const d = all().saves; const s = d[sid]; if (!s || !Array.isArray(s.retired) || ('club' in (s as object))) d[sid] = fresh(); return d[sid]; };
const ymd = (d: string) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d); return m ? { y: Number(m[1]), m: Number(m[2]) } : null; };
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };

// ---------------- LoG ↔ 나라 연동(2026-10-31) ----------------
/** 나라 연동 저장 읽기 — 저장이 깨졌거나 옛 형식이어도 앱이 멈추지 않게 모양을 맞춤(2026-10-31 보강). */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numMap = (v: unknown): Record<string, number> => { const o: Record<string, number> = {}; if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x) && x >= 0) o[k] = Math.min(999, Math.floor(x)); return o; };
const pairOk = (v: unknown): v is Pair => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string';
const opOk = (o: unknown): o is QOp => { if (!isObj(o)) return false; const okDays = (d: unknown) => Number.isSafeInteger(d) && (d as number) >= 1 && (d as number) <= 3600;
  if (o.t === 'planet') return typeof o.name === 'string' && !!o.name && PLANET_MODS.includes(o.mod as never) && okDays(o.days);
  if (o.t === 'country') return COUNTRY_MODS.includes(o.mod as never) && okDays(o.days);
  if (o.t === 'opinion') return Number.isSafeInteger(o.idx) && (o.idx as number) >= 0 && OPINION_MODS.includes(o.mod as never);
  if (o.t === 'energy') return Number.isSafeInteger(o.n) && (o.n as number) >= 1 && (o.n as number) <= 5000;
  return o.t === 'influence' && Number.isSafeInteger(o.n) && (o.n as number) >= 1 && (o.n as number) <= 500; };
/** 게임 쪽 「이미 받은 묶음」 표시(sllm_lognat_N)와 겹치지 않게, 새로 시작하는 저장은 번호를 시각에서 떼어 옴(앱 저장을 지웠다 다시 써도 옛 표시에 막히지 않게). */
const freshOpBase = (): number => Math.floor(Date.now() / 1000) % 90_000_000;
const natChecked = new WeakSet<object>(); // 한 번 고친 저장은 다시 만들지 않음(목록을 새로 만들면 보낸 묶음을 지우지 못함)
const natOf = (s: LogSave): NatSave => {
  if (isObj(s.nat) && natChecked.has(s.nat)) return s.nat;
  if (!isObj(s.nat)) s.nat = { heat: NAT.heat.start, meet: {}, lastStreak: {}, warPolicy: 'refuse', sports: [], ops: [], opN: freshOpBase() };
  const n = s.nat;
  n.heat = typeof n.heat === 'number' && Number.isFinite(n.heat) ? clampHeat(n.heat) : NAT.heat.start;
  n.meet = numMap(n.meet); n.lastStreak = numMap(n.lastStreak); if (n.penalty !== undefined) n.penalty = numMap(n.penalty);
  n.sports = Array.isArray(n.sports) ? n.sports.filter((a) => isObj(a) && pairOk(a.head) && pairOk(a.body)).slice(-12) : [];
  n.ops = Array.isArray(n.ops) ? n.ops.filter((q) => isObj(q) && Number.isSafeInteger(q.n) && Array.isArray(q.ops)).map((q) => ({ ...q, ops: q.ops.filter(opOk), tries: Number.isSafeInteger(q.tries) ? q.tries : 0, why: String(q.why ?? '') })).filter((q) => q.ops.length).slice(-20) : [];
  n.opN = Number.isSafeInteger(n.opN) && n.opN > 0 ? n.opN : Math.max(freshOpBase(), ...n.ops.map((q) => q.n));
  if (n.warPolicy !== 'play') n.warPolicy = 'refuse';
  if (n.festival !== undefined && !(Number.isSafeInteger(n.festival) && n.festival >= 0 && n.festival <= NAT.festival.months)) n.festival = 0;
  if (n.scandal !== undefined && !(isObj(n.scandal) && typeof n.scandal.team === 'string' && Number.isSafeInteger(n.scandal.season) && ['open', 'covered', 'investigated'].includes(n.scandal.state))) n.scandal = undefined;
  if (n.transfer !== undefined && !(isObj(n.transfer) && typeof n.transfer.pid === 'string' && Number.isSafeInteger(n.transfer.idx) && Number.isSafeInteger(n.transfer.season))) n.transfer = undefined;
  if (n.wbid !== undefined && !(isObj(n.wbid) && Number.isSafeInteger(n.wbid.year))) n.wbid = undefined;
  if (n.homeNow !== undefined && !(isObj(n.homeNow) && Array.isArray(n.homeNow.pride) && Array.isArray(n.homeNow.gloom))) n.homeNow = undefined;
  natChecked.add(n); return n;
};
function ethicsNow(): string[] { try { return ctx.playerIdx >= 0 ? ctx.flagProv.ethicsFor(ctx.playerIdx) ?? [] : []; } catch { return []; } }
const hasEthic = (k: string) => ethicsNow().some((e) => e === 'ethic_' + k || e === 'ethic_fanatic_' + k);
/** 단일 의식: 리그 없이 대표팀만(가치관별 반응 8). */
const isGestalt = (): boolean => !!gameState.last?.gestalt || ethicsNow().some((e) => e.includes('gestalt'));
/** 기업 국가(통치 체제 5): 후원비 할인·후원 몫 ↑·브랜드 수입(9). */
const isCorp = (): boolean => gameState.last?.sid === ctx.curSaveId && gameState.last?.authority === 5;
const feeOf = (tier: Tier): number => Math.round(SPONSOR.tiers[tier - 1].fee * (isCorp() ? NAT.corp.fee : 1));
function heatUp(s: LogSave, gain: number): void { const n = natOf(s); n.heat = heatGain(n.heat, gain, hasEthic('spiritualist')); }
/** 민심(리그 열기에 비례). */
function natMood(s: LogSave, base: number, why: string): void { const v = scaled(base, natOf(s).heat); if (v) moodNudge(v, why); }
function queueOps(s: LogSave, ops: QOp[], why: string): void { if (!ops.length) return; const n = natOf(s); n.ops.push({ n: ++n.opN, ops, tries: 0, why }); n.ops = n.ops.slice(-20); }
/** 신문 스포츠 1면(틀 기사, 연고 이야기). 경기장 소식에도 제목 한 줄. */
function sportsNews(s: LogSave, kind: SportsKind, v: Record<string, string | number>): void {
  const a = sportsArticle(kind, v), n = natOf(s); n.sports.push({ date: ctx.gameDate || '', head: a.head, body: a.body }); n.sports = n.sports.slice(-12);
  s.news.push({ season: s.season, text: L(...a.head) });
}
/** 게임에 수정자 보내기: 게임이 켜져 있을 때만, 묶음마다 한 번(같은 번호는 게임이 다시 붙이지 않음). 행성은 이름 → 지금 행성 순서. 세 번 실패하면 버림. */
let natSending = false;
async function sendOps(sid: string): Promise<void> {
  if (natSending || !ctx.gameRunning || !/^\d+$/.test(sid)) return; const s = saveOf(sid), n = natOf(s); if (!n.ops.length) return;
  natSending = true;
  try {
    for (const q of n.ops.slice()) {
      const list = gov.planetList?.sid === sid ? gov.planetList.planets : [];
      const ops: NatOp[] = q.ops.flatMap((o): NatOp[] => { if (o.t !== 'planet') return [o]; const k = list.findIndex((p) => p.name === o.name) + 1; return k > 0 ? [{ t: 'planet', k, mod: o.mod, days: o.days }] : []; });
      if (!ops.length) { if (++q.tries >= 3) n.ops = n.ops.filter((x) => x !== q); continue; }
      const req = ++link.reqCounter; let st = '';
      try { st = String((await terminalRequest(logNationCommand(req, sid, q.n, ops), 'LOGNAT', req)).kv.status ?? ''); } catch { st = ''; }
      if (st === 'applied' || st === 'duplicate') n.ops = n.ops.filter((x) => x !== q); else if (++q.tries >= 3) { n.ops = n.ops.filter((x) => x !== q); logDiagnostic('warn', 'log.nation_op_dropped', { why: q.why }); }
    }
    save();
  } finally { natSending = false; }
}
/** 레전드 은퇴: 연대기 · 경기장 소식 · 신문 스포츠면 · 호외 후보(그달 가장 큰 일이면, 호외 연 상한 안에서만). */
function legendRetired(s: LogSave, p: Player): void {
  const d = ctx.gameDate || '', t = L(`레전드 ${p.name} 은퇴`, `Legend ${p.name} retires`);
  sportsNews(s, 'retire', { player: p.name }); chronNoteWorld(L(`${d} 레전드 오브 갤럭시: ${t}`, `${d} Legend of Galaxy: ${t}`), true);
  try { noteExtra('sports', d, `Legend of Galaxy star ${p.name} has retired.`); } catch { /* 신문 없음 */ }
}
/** 새 시즌(첫 해 말고): 덮은 승부 조작이 드러나는지 · 결정하지 않은 이적 제안은 떠남으로. */
function natSeasonStart(sid: string, s: LogSave, year: number): void {
  const n = natOf(s), sc = n.scandal;
  if (sc && sc.state === 'open' && !sc.done) { sc.state = 'investigated'; sc.done = true; (n.penalty ??= {})[sc.team] = year; natMood(s, NAT.scandal.investigateMood, L('승부 조작 조사', 'Match-fixing investigation')); heatUp(s, NAT.heat.investigate); } // 미룬 결정은 리그 사무국이 조사
  if (sc && sc.state === 'covered' && !sc.done && sc.revealBy !== undefined) {
    const r = seeded(hashSeed(`${sid}:scandal:${sc.season}:${year}`));
    if (year <= sc.revealBy && r() < NAT.scandal.reveal / Math.max(1, sc.revealBy - sc.season)) { sc.done = true; const tn = teamName(s, s.teams.find((t) => t.id === sc.team) ?? s.teams[0]); natMood(s, NAT.scandal.exposedMood, L('덮었던 승부 조작이 드러남', 'Covered-up match-fixing exposed')); heatUp(s, NAT.heat.exposed); sportsNews(s, 'scandal', { team: tn });
      chronNoteWorld(L(`${ctx.gameDate || year} 레전드 오브 갤럭시 승부 조작 은폐가 드러났다(${tn})`, `${ctx.gameDate || year} A Legend of Galaxy match-fixing cover-up came to light (${tn})`), true);
      ctx.notify({ kind: 'news', title: L('승부 조작 은폐 폭로', 'Match-fixing cover-up exposed'), body: L(`${tn} 경기의 승부 조작을 덮었던 일이 드러났습니다. 민심이 크게 떨어졌습니다.`, `The cover-up of match-fixing around ${tn} has come out. Public mood fell sharply.`) }); }
    else if (year > sc.revealBy) sc.done = true;
  }
  if (n.transfer && n.transfer.season < year) { releaseAbroad(s, n.transfer); n.transfer = undefined; }
}
/** 승부 조작 의혹(10): 시즌마다 드물게, 열기가 뜨거우면 조금 더. 플레이어가 조사/덮기를 고름(다음 시즌까지 안 고르면 조사). */
function scandalRoll(sid: string, s: LogSave): void {
  const n = natOf(s); if (isGestalt() || (n.scandal && n.scandal.season === s.season)) return;
  const r = seeded(hashSeed(`${sid}:fix:${s.season}`)); if (r() >= NAT.scandal.chance + (n.heat > 70 ? NAT.scandal.hot : 0)) return;
  const t = s.teams[Math.floor(r() * s.teams.length)]; if (!t) return;
  n.scandal = { team: t.id, season: s.season, state: 'open' };
  notify(['승부 조작 의혹', 'Match-fixing allegation'], [`${teamName(s, t)} 경기에서 수상한 베팅 흐름이 발견되었습니다. 우주 경기장 › 나라와 경기에서 조사할지 덮을지 정하세요.`, `Suspicious betting was found around ${teamName(s, t)}. Decide under Stadium › Nation & league whether to investigate or cover it up.`]);
}
/** 시즌 끝(결승 뒤): 열기 · 후원 구단 우승 기쁨(가치관) · 연고 행성 자랑/불만(게임 행성 수정자). */
function natSeasonEnd(sid: string, s: LogSave, champ: number, runner: number, third: number, f: MatchRec): void {
  const n = natOf(s); heatUp(s, NAT.heat.leagueFinal);
  const C = s.teams[champ];
  if (s.sponsor?.team === C.id) { heatUp(s, NAT.heat.sponsoredChamp); const style = f.kills ? playStyle(f.kills as [number, number], f.winner as 0 | 1) : 'even'; natMood(s, ethicBonus(ethicsNow(), style, 1), L('후원 구단 리그 우승', 'Sponsored club won the league')); }
  sportsNews(s, 'leagueChamp', { team: teamName(s, C), season: s.season, planet: C.planet });
  const order = rankOrder(standings(s.rounds.slice(0, 7), 8)), last = s.teams[order[order.length - 1]];
  for (const t of s.teams) n.lastStreak[t.planet] = t === last ? (n.lastStreak[t.planet] ?? 0) + 1 : 0;
  const eff = homeEffects([C.planet, s.teams[runner].planet, s.teams[third].planet], n.lastStreak); n.homeNow = { season: s.season, ...eff };
  queueOps(s, [...eff.pride.map((name): QOp => ({ t: 'planet', name, mod: 'sllm_log_home_pride', days: NAT.home.days })), ...eff.gloom.map((name): QOp => ({ t: 'planet', name, mod: 'sllm_log_home_gloom', days: NAT.home.days }))], 'home planets');
  if (eff.pride.length) chronNoteWorld(L(`${s.season} 레전드 오브 갤럭시 상위 구단의 연고 행성(${eff.pride.join(', ')})이 들떠 있다`, `${s.season} Legend of Galaxy: the home worlds of the top clubs (${eff.pride.join(', ')}) are buzzing`), false);
  void sendOps(sid);
}
/** 스타 이적(12): 떠나보냄 → 리그에서 빠지고 그 나라 호감 +, 민심 −, 열기 −. */
function releaseAbroad(s: LogSave, tr: { pid: string; idx: number; nation: string }): void {
  const p = s.players[tr.pid]; if (!p) return;
  for (const t of s.teams) t.players = t.players.filter((x) => x !== p.id); s.free = s.free.filter((x) => x !== p.id); delete s.players[p.id]; s.retired.push(p.rid); s.retired = s.retired.slice(-200);
  queueOps(s, [{ t: 'opinion', idx: tr.idx, mod: 'sllm_log_transfer_goodwill' }], 'transfer'); natMood(s, NAT.transfer.mood, L('레전드 해외 이적', 'Legend moved abroad')); heatUp(s, NAT.heat.transferAway);
  sportsNews(s, 'transfer', { player: p.name, them: tr.nation }); chronNoteWorld(L(`${ctx.gameDate || s.season} 레전드 ${p.name}, ${tr.nation} 구단으로 이적`, `${ctx.gameDate || s.season} Legend ${p.name} transfers to a club in ${tr.nation}`), true);
}
/** 지도자 편지(틀 문장): 외교 태도(전쟁·경쟁·호감)에 따라 축하/도발. */
function natLetter(sid: string, idx: number, nation: string, weWon: boolean, team: string, pick: number): void {
  try {
    const c = terminal.items.find((x) => x.idx === idx), tone = toneOf(c?.em, c?.score ?? 0), [ko, en] = letterText(tone, weWon, { us: ctx.playerName || L('우리 제국', 'your empire'), them: nation, team }, pick), date = ctx.gameDate || '';
    receiveLetter(sid, ctx.govMem().currentBranch(sid), { idx, name: nation, date, text: L(ko, en), proposal: null, expires: date.replace(/^(\d+)/, (y) => String(Number(y) + 2)), read: false, sourceId: `log:${date}:${idx}` });
  } catch (e) { logDiagnostic('warn', 'log.nation_letter_failed', { error: String((e as Error)?.message || e) }); }
}
/** 팀 이름 = 「회사명 + 마스코트」(보통 이스포츠·프로 구단처럼). 연고 행성은 따로 보여 줌(행성이 적어도 이름이 겹치지 않게). */
const baseName = (t: Team) => `${L(...companyName(t.company ?? 0))} ${L(...MASCOTS[t.mascot % MASCOTS.length])}`;
/** 메인 스폰서가 명명권으로 이름을 정했으면 그 이름. 후원명(1·2등급)은 이름 옆 「후원」 표시로(teamTag). */
const teamName = (s: LogSave, t: Team) => { const sp = s.sponsor; if (sp && sp.team === t.id && sp.tier >= 3 && sp.name) return sp.name; return baseName(t); };
const teamTag = (s: LogSave, t: Team) => (s.sponsor && s.sponsor.team === t.id && s.sponsor.label ? s.sponsor.label : '');
/** 모기업·마스코트 정하기: 리그 안에서 브랜드·마스코트가 겹치지 않게(옛 저장에는 없으면 붙임). */
function brandTeams(sid: string, s: LogSave): void {
  const r = seeded(hashSeed(`${sid}:brands`)), usedB = new Set<number>(), usedM = new Set<number>();
  for (const t of s.teams) { if (typeof t.company === 'number') usedB.add(brandOf(t.company)); }
  for (const t of s.teams) {
    if (typeof t.company !== 'number') { let c = 0; for (let g = 0; g < 50; g++) { c = Math.floor(r() * COMPANY_COUNT); if (!usedB.has(brandOf(c))) break; } t.company = c; usedB.add(brandOf(c)); }
    if (usedM.has(t.mascot)) { let m = Math.floor(r() * MASCOTS.length); for (let g = 0; usedM.has(m) && g < 40; g++) m = (m + 1) % MASCOTS.length; t.mascot = m; }
    usedM.add(t.mascot);
    if (!t.logo) { const used = new Set(s.teams.filter((x) => x.logo).map((x) => `${x.logo!.e}`)); let e = Math.floor(r() * EMBLEMS.length); for (let g = 0; used.has(`${e}`) && g < 50; g++) e = (e + 1) % EMBLEMS.length; t.logo = { e, s: Math.floor(r() * LOGO_SHAPES.length), p: Math.floor(r() * LOGO_PATTERNS.length), c: Math.floor(r() * LOGO_COLORS.length) }; } // 고유 로고(문장은 리그 안에서 안 겹치게)
  }
}
/** 지금 보이는 로고: 메인 스폰서가 꾸민 로고가 있으면(그 팀을 3등급으로 후원하는 동안) 그것. */
const logoOf = (s: LogSave, t: Team): Logo | null => (s.sponsor && s.sponsor.team === t.id && s.sponsor.tier >= 3 && t.myLogo ? t.myLogo : t.logo ?? null);
const nm = () => gameName(Math.random() < 0.5 ? 'm' : 'f') ?? 'Rookie';
const lineupOf = (s: LogSave, t: Team) => bestLineup(t.players.map((id) => s.players[id]).filter(Boolean));
const sponsoredTeam = (s: LogSave): Team | undefined => (s.sponsor ? s.teams.find((t) => t.id === s.sponsor!.team) : undefined);
const payroll = (s: LogSave, t: Team) => t.players.reduce((n, id) => n + (s.players[id]?.salary ?? 0), 0);
const stratOf = (s: LogSave, t: Team): Strategy => (s.sponsor?.team === t.id && s.sponsor.req.strat ? s.sponsor.req.strat : t.strat);
function notify(title: [string, string], body: [string, string]): void { ctx.notify({ kind: 'office', title: L(...title), body: L(...body), action: L('확인', 'OK') }); }

/** 연고 행성 8개(인구 순, 모자라면 큰 행성에 두 번째 팀). */
function planetSlots(sid: string): string[] {
  const pl = gov.planetList?.sid === sid ? gov.planetList.planets.map((p) => ({ name: p.name, pops: p.pops ?? 0 })) : protestPlanetsNow(sid).map((p) => ({ name: p.name, pops: 0 }));
  const names = pl.sort((a, b) => b.pops - a.pops).map((p) => p.name).filter(Boolean);
  if (!names.length) names.push(ctx.playerName || L('수도', 'Capital'));
  const out: string[] = []; for (let i = 0; out.length < 8; i++) out.push(names[i % names.length]);
  return out;
}
/** 본명(게임 이름 표, 한·영): 아직 없는 선수만. 레전드는 초상화 종족 이름 표, 나머지는 우리 제국 종족 비율. 재료가 없으면(게임 전) 다음 달에 다시. */
function ensureNames(sid: string, s: LogSave): void {
  for (const p of Object.values(s.players)) { if (p.real) continue; const e = ROSTER.find((x) => x.rid === p.rid); const n = namePair(p.g ?? 'm', p.gen === 1 && e?.cls ? e.cls : null, hashSeed(`${sid}:real:${p.id}`)); if (!n) return; p.real = n; }
}
const feats = (p: Player) => (p.feats ??= { titles: 0, medals: 0, mvps: 0 });
/** 메타(무기 출시·패치) 준비. */
function metaOf(sid: string, s: LogSave): MetaState { return (s.meta ??= { since: s.season, patch: 0, released: firstRelease(`${sid}:weapons`), adj: {}, stats: {}, games: 0, notes: [] }); }
/** 이번 라운드에 쓸 수 있는 무기: 출시된 것 − 글로벌 밴. */
function poolFor(s: LogSave, round: number): string[] { const m = s.meta!; const gb = m.globalBan && m.globalBan.season === s.season && m.globalBan.round === round ? m.globalBan.weapon : ''; return m.released.filter((w) => w !== gb); }
/** 패치. 새 무기는 시즌 시작 패치 중 5년마다만(start = 시즌 시작 패치). */
function patchNow(sid: string, s: LogSave, start = false): void {
  const m = metaOf(sid, s), since = m.since ?? s.season, release = start && s.season > since && (s.season - since) % META.releaseEvery === 0;
  const lines = runPatch(m, s.season, seeded(hashSeed(`${sid}:patch:${m.patch}`)), release);
  if (release) s.news.push({ season: s.season, text: L(`새 무기 ${META.newPerPatch}종 출시!`, `${META.newPerPatch} new weapons released!`) });
  s.news.push({ season: s.season, text: L(`패치 ${m.patch} 적용 — 변경 ${lines.length}건`, `Patch ${m.patch} is live — ${lines.length} changes`) });
}
/** 후원 미션 정하기(새 시즌·처음 후원할 때): 팀 전력 순위에 맞춰. */
function newMission(sid: string, s: LogSave): void {
  const sp = s.sponsor; if (!sp) return; const order = s.teams.map((t, i) => ({ t, v: ratingOf(s, i) })).sort((a, b) => b.v - a.v), rank = order.findIndex((x) => x.t.id === sp.team);
  const mi = pickMission(rank, seeded(hashSeed(`${sid}:mission:${s.season}:${sp.team}`))), fee = feeOf(sp.tier);
  sp.mission = { ...mi, season: s.season, reward: Math.round(fee * MISSIONS[mi.kind].mult), prog: { kills: 0, mvps: 0, warden: 0 } };
}
const missionText = (mi: { kind: MissionKind; n: number }) => L(MISSIONS[mi.kind].ko(mi.n), MISSIONS[mi.kind].en(mi.n));
/** 시즌 끝: 미션 판정 → 보상(금고). */
function judgeMission(sid: string, s: LogSave, champ: number, runner: number): void {
  const sp = s.sponsor, mi = sp?.mission; if (!sp || !mi || mi.season !== s.season || mi.result !== undefined) return;
  const ti = s.teams.findIndex((t) => t.id === sp.team), st = standings(s.rounds, 8), rank = rankOrder(st).indexOf(ti);
  const ok = mi.kind === 'champion' ? ti === champ : mi.kind === 'final' ? ti === champ || ti === runner : mi.kind === 'top4' ? rank <= 3 : mi.kind === 'winning' ? st[ti].w >= mi.n : mi.kind === 'kills' ? mi.prog.kills >= mi.n : mi.kind === 'mvps' ? mi.prog.mvps >= mi.n : mi.prog.warden >= mi.n;
  mi.result = ok; if (ok) earnToVault(sid, mi.reward, 'LoG sponsor mission');
  notify(['후원 미션 결과', 'Sponsor mission result'], ok ? [`「${MISSIONS[mi.kind].ko(mi.n)}」 달성! 보너스 ${mi.reward} 크레딧이 금고로 들어왔습니다.`, `"${MISSIONS[mi.kind].en(mi.n)}" achieved! A ${mi.reward}-credit bonus went to the vault.`] : [`「${MISSIONS[mi.kind].ko(mi.n)}」 달성 실패.`, `"${MISSIONS[mi.kind].en(mi.n)}" not achieved.`]);
}
/** 올스타전(시즌 끝 이벤트 매치): 자리마다 1·2위 선수를 두 팀으로, 특수 규칙 하나. 기록·토토와 무관. */
function playAllstar(sid: string, s: LogSave): void {
  const r = seeded(hashSeed(`${sid}:allstar:${s.season}`)), rule = ALLSTAR_RULES[Math.floor(r() * ALLSTAR_RULES.length)], A = {} as Record<Role, Player>, B = {} as Record<Role, Player>;
  for (const role of ROLES) { const c = Object.values(s.players).filter((p) => p.club && p.role === role).sort((a, b) => overall(b) - overall(a)); if (c[0]) A[role] = c[0]; if (c[1]) B[role] = c[1]; }
  if (Object.keys(A).length < 5 || Object.keys(B).length < 5) return;
  const pool = metaOf(sid, s).released.filter((w) => !rule.banKind || weaponById(w)?.kind !== rule.banKind), d = autoDraft(A, B, r, pool), mods = (w: string) => patchedMods(s.meta, w);
  const defs: [TeamDef, TeamDef] = [teamDef('allA', L('별무리 올스타', 'Starfall All-Stars'), A, d.picks[0], { aggr: 0.5, obj: 0.5 }, {}, { mods, foe: d.picks[1], side: 0 }), teamDef('allB', L('은하수 올스타', 'Milky Way All-Stars'), B, d.picks[1], { aggr: 0.5, obj: 0.5 }, {}, { mods, foe: d.picks[0], side: 1 })];
  const seed = hashSeed(`${sid}:allstar:${s.season}:seed`), res = playOut(defs[0], defs[1], seed, rule.rules);
  s.allstar = { season: s.season, rule: rule.id, seed, defs, winner: res.winner, kills: res.kills, mvp: res.mvp, eng: ENGINE };
  s.news.push({ season: s.season, text: L(`올스타전(${rule.ko}) — ${defs[res.winner].name} 승리, MVP ${res.mvp}`, `All-Star match (${rule.en}) — ${defs[res.winner].name} win, MVP ${res.mvp}`) });
}
/** 레전드 양성: 육성 선수가 후원 구단을 떠났으면 끝, 조건을 채웠으면 레전드로 승격(별명 자동, 초상화는 고르게 알림). */
function checkFoster(s: LogSave): void {
  const sp = s.sponsor; if (!sp?.foster) return; const p = s.players[sp.foster];
  if (!p || p.club !== sp.team) { notify(['레전드 양성 종료', 'Legend program ended'], [`육성 선수가 후원 구단을 떠나 양성을 마쳤습니다.`, `The fostered player left the sponsored club; the program has ended.`]); sp.foster = undefined; return; }
  if (!readyForLegend(p)) return;
  const used = new Set(s.epithets ?? []), ep = pickEpithet(p, used); (s.epithets ??= []).push(ep[1]);
  p.legend = true; p.home = { epithet: ep, portrait: '' }; sp.foster = undefined; s.portraitPick = p.id;
  s.news.push({ season: s.season, text: L(`${p.name}, 레전드 등극 — 「${ep[0]}」`, `${p.name} becomes a legend — "${ep[1]}"`) });
  chronNoteWorld(L(`레전드 오브 갤럭시: 후원 구단이 키운 ${p.name} 선수가 레전드 「${ep[0]}」에 올랐다`, `Legend of Galaxy: ${p.name}, raised by our sponsored club, became the legend "${ep[1]}"`), true);
  notify(['새 레전드 탄생!', 'A new legend!'], [`${p.name} 선수가 레전드 「${ep[0]}」에 올랐습니다. 우주 경기장에서 초상화를 골라 주세요.`, `${p.name} has become the legend "${ep[1]}". Choose a portrait at the Space Stadium.`]);
}
/** 명단에서 다음 선수 데뷔. 명단을 다 쓰면 은퇴한 선수 이름을 이은 2세대 신인(레전드 아님). */
function debutNext(s: LogSave, rookie: boolean): Player | null {
  let p: Player | null = null;
  if (s.debut < ROSTER.length) { const e = ROSTER[s.debut++]; s.gens[e.rid] = 1; p = playerFromRoster(e, 1, rookie); }
  else { // 명단을 다 쓰면: 늘 새 닉네임의 신인(조합 5,000개+, 세이브 안에서 겹치지 않게). 자리는 선수가 가장 적은 자리.
    const used = new Set(Object.values(s.players).map((x) => x.name)); let k = s.nick ?? FIRST_NICKS, handle = nickname(k); for (let g = 0; used.has(handle) && g < 50; g++) handle = nickname(++k); s.nick = k + 1;
    const cnt = (role: Role) => Object.values(s.players).filter((x) => x.role === role).length, role = ROLES.slice().sort((a, b) => cnt(a) - cnt(b))[0];
    p = playerFromRoster({ rid: `N${k}`, handle, role, g: hashSeed(`g:${handle}`) % 2 ? 'f' : 'm', order: -1 }, 1, true);
  }
  if (p) { s.players[p.id] = p; if (p.legend && rookie) s.news.push({ season: s.season, text: L(`레전드 유망주 ${p.name} 데뷔`, `Legend prospect ${p.name} debuts`) }); }
  return p;
}
function sign(s: LogSave, t: Team, p: Player, year: number, r: () => number): void { s.free = s.free.filter((x) => x !== p.id); p.club = t.id; p.until = year + 1 + Math.floor(r() * 2); p.salary = salaryFor(p); t.players.push(p.id); }
function release(s: LogSave, t: Team, p: Player): void { t.players = t.players.filter((x) => x !== p.id); p.club = null; if (!s.free.includes(p.id)) s.free.push(p.id); if (s.sponsor) delete s.sponsor.req.practice[p.id]; }
/** AI 구단 운영(영입 창): 빈 자리 채우기 → (후원 2등급+) 영입 추천 → 좋은 선수로 한 명 바꾸기 → 예산 넘으면 후보 정리. */
function aiManage(sid: string, s: LogSave, t: Team, year: number, r: () => number, upgrade: boolean): void {
  const P = (id: string) => s.players[id], free = () => s.free.map(P).filter(Boolean), room = () => t.budget - payroll(s, t);
  const bench = () => { const lu = lineupOf(s, t), on = new Set(Object.values(lu).map((p) => p.id)); return t.players.map(P).filter((p) => p && !on.has(p.id) && s.sponsor?.foster !== p.id).sort((a, b) => overall(a) - overall(b)); }; // 육성 선수는 내보내지 않음
  for (const role of ROLES) { // 1) 그 자리 주전이 없으면
    const lu = lineupOf(s, t); if (lu[role] && lu[role].role === role) continue;
    const c = free().filter((p) => p.role === role).sort((a, b) => (salaryFor(a) <= room() ? 1 : 0) - (salaryFor(b) <= room() ? 1 : 0) || overall(a) - overall(b)).pop() ?? debutNext(s, true);
    if (!c) continue; if (t.players.length >= 8) { const b = bench()[0]; if (b) release(s, t, b); } sign(s, t, c, year, r);
  }
  const sp = s.sponsor; // 2) 후원사 영입 추천
  if (sp && sp.team === t.id && tierCan(sp.tier, 'scout')) for (const id of sp.scout.slice()) {
    const p = P(id); if (!p || p.club) { sp.scout = sp.scout.filter((x) => x !== id); continue; }
    const out = t.players.length >= 8 ? bench()[0] : undefined, cost = salaryFor(p) - (out?.salary ?? 0);
    if (cost <= room()) { if (out) release(s, t, out); sign(s, t, p, year, r); sp.scout = sp.scout.filter((x) => x !== id); notify(['후원 구단 영입', 'Sponsored club signing'], [`${teamName(s, t)}이(가) 추천하신 ${p.name} 선수를 영입했습니다.`, `${teamName(s, t)} signed ${p.name}, as you recommended.`]); }
  }
  if (upgrade) { // 3) 한 명 바꾸기(주전보다 확실히 나은 자유계약 선수)
    const lu = lineupOf(s, t);
    for (const role of ROLES.slice().sort(() => r() - 0.5)) {
      const cur = lu[role], c = free().filter((p) => p.role === role && overall(p) >= overall(cur) + 4).sort((a, b) => overall(b) - overall(a))[0]; if (!c) continue;
      const out = t.players.length >= 8 ? bench()[0] : undefined; if (salaryFor(c) - (out?.salary ?? 0) > room()) continue;
      if (out) release(s, t, out); sign(s, t, c, year, r); break;
    }
  }
  while (t.players.length < 6) { const c = free().sort((a, b) => overall(b) - overall(a)).find((p) => p.salary <= room()) ?? debutNext(s, true); if (!c) break; sign(s, t, c, year, r); } // 후보 최소 1명
  for (let g = 0; room() < 0 && g < 4; g++) { const b = bench().sort((a, c) => c.salary - a.salary)[0]; if (!b || t.players.length <= 5) break; release(s, t, b); } // 4) 예산 정리
}
/** 후원 갱신(새 시즌): 예약된 바꾸기·취소를 반영하고 후원금을 금고에서. 못 내면 후원 끝. */
function renewSponsor(sid: string, s: LogSave): void {
  const sp = s.sponsor; if (!sp) return;
  if (isGestalt()) { s.sponsor = null; notify(['구단 후원 종료', 'Sponsorship ended'], ['단일 의식 제국이 되어 국내 리그 구단 후원을 마쳤습니다(새 후원금은 내지 않음).', 'Now a gestalt empire, we have ended our domestic club sponsorship (no new fee charged).']); return; }
  if (sp.next) { if ('cancel' in sp.next) { notify(['구단 후원 종료', 'Sponsorship ended'], [`${teamName(s, sponsoredTeam(s)!)} 후원을 마쳤습니다.`, `Your sponsorship of ${teamName(s, sponsoredTeam(s)!)} has ended.`]); s.sponsor = null; return; } if (sp.next.team !== sp.team) { sp.req = { practice: {} }; sp.scout = []; sp.name = ''; sp.since = s.season; sp.foster = undefined; } sp.team = sp.next.team; sp.tier = sp.next.tier; sp.next = undefined; }
  const fee = feeOf(sp.tier);
  if (!spendFromVault(sid, fee, 'LoG sponsorship')) { notify(['구단 후원 종료', 'Sponsorship ended'], [`금고에 후원금 ${fee} 크레딧이 없어 후원이 끝났습니다.`, `The vault could not cover the ${fee}-credit sponsorship fee; the sponsorship has ended.`]); s.sponsor = null; return; }
  if (sp.foster && !spendFromVault(sid, FOSTER.fee, 'LoG legend program')) { notify(['레전드 양성 중단', 'Legend program stopped'], [`금고에 육성비 ${FOSTER.fee} 크레딧이 없어 양성을 멈췄습니다.`, `The vault could not cover the ${FOSTER.fee}-credit program fee; fostering stopped.`]); sp.foster = undefined; }
}
/** 새 시즌 준비: 첫 해면 8팀 창단(명단 처음 80명), 아니면 나이·계약·은퇴·신인 10명·후원 갱신·예산·AI 운영. */
function newSeason(sid: string, s: LogSave, year: number): void {
  const r = seeded(hashSeed(`${sid}:season:${year}`));
  if (!s.teams.length) {
    const slots = planetSlots(sid);
    s.teams = slots.map((planet, i) => ({ id: `t${i}`, planet, company: undefined as unknown as number, mascot: (i * 7 + hashSeed(`${sid}:${planet}`)) % MASCOTS.length, players: [], strat: { aggr: Math.round((r() * 2 - 1) * 10) / 10, obj: Math.round(r() * 10) / 10 }, focus: 'balanced' as Focus, budget: SPONSOR.baseBudget }));
    brandTeams(sid, s);
    s.season = year; const pool: Player[] = []; while (s.debut < START_ACTIVE) { const p = debutNext(s, false); if (p) pool.push(p); }
    pool.sort(() => r() - 0.5);
    for (let k = 0; k < 7; k++) for (const t of s.teams) { const need = ROLES.find((role) => !t.players.some((id) => s.players[id].role === role)); const i = need ? pool.findIndex((p) => p.role === need) : 0; const p = pool.splice(i < 0 ? 0 : i, 1)[0]; if (p) sign(s, t, p, year, r); }
    for (const p of pool) s.free.push(p.id);
  } else {
    for (const p of Object.values(s.players)) p.age++;
    for (const t of s.teams) for (const id of t.players.slice()) { const p = s.players[id]; if (!p || p.until >= year) continue; if (r() < 0.7 || s.sponsor?.foster === p.id) { /* 육성 선수는 늘 재계약 */ p.until = year + 1 + Math.floor(r() * 2); p.salary = salaryFor(p); } else release(s, t, p); }
    const retire = (p: Player) => { s.free = s.free.filter((x) => x !== p.id); for (const t of s.teams) t.players = t.players.filter((x) => x !== p.id); delete s.players[p.id]; s.retired.push(p.rid); s.retired = s.retired.slice(-200); if (p.legend) legendRetired(s, p); };
    for (const p of Object.values(s.players)) if ((!p.club && p.age >= 31 && r() < (p.age - 30) * 0.4) || (!p.club && p.age >= 26 && overall(p) < 50 && r() < 0.4) || p.age >= 34) retire(p);
    // 신인: 선수 수가 80명 안팎이 되게(4~12명) — 명단 200명이 20년쯤에 걸쳐 데뷔
    s.season = year; const rookies = Math.max(4, Math.min(12, START_ACTIVE + 4 - Object.keys(s.players).length)); for (let i = 0; i < rookies; i++) { const p = debutNext(s, true); if (p) s.free.push(p.id); }
    renewSponsor(sid, s);
    natSeasonStart(sid, s, year);
  }
  s.season = year;
  if (s.meta) patchNow(sid, s, true); else metaOf(sid, s); // 시즌 시작 패치(첫 시즌은 처음 출시만)
  for (const t of s.teams) t.budget = SPONSOR.baseBudget + (s.sponsor?.team === t.id ? feeOf(s.sponsor.tier) : 0) - (natOf(s).penalty?.[t.id] === s.season ? NAT.scandal.penalty : 0); // 승부 조작 조사 → 그 구단 예산 −(2026-10-31)
  for (const t of byNeed(s)) aiManage(sid, s, t, year, r, true); // 약한 팀부터 고름(드래프트처럼 — 앞 순번 팀이 늘 좋은 선수를 먼저 가져가지 않게)
  s.rounds = roundRobin(8).map((rd, ri) => rd.map(([a, b], mi) => ({ a, b, seed: hashSeed(`${sid}:${year}:${ri}:${mi}`) }))); s.done = 0; s.prepared = null;
  if (s.sponsor) newMission(sid, s);
  s.news = s.news.filter((n) => n.season >= year - 3).slice(-30);
  logDiagnostic('info', 'log.season', { year });
}

function bigOf(round: number) { return round === 7; }
const shareOf = (s: LogSave, ti: number): number => (s.sponsor && s.teams[ti]?.id === s.sponsor.team ? Math.min(0.6, SPONSOR.tiers[s.sponsor.tier - 1].share * (isCorp() ? NAT.corp.share : 1)) : 0);
function playMatch(sid: string, s: LogSave, round: number, mi: number, m: MatchRec, draft?: Draft): void {
  const A = s.teams[m.a], B = s.teams[m.b], la = lineupOf(s, A), lb = lineupOf(s, B), r = seeded(m.seed ^ 0x9e3779b9);
  const pool = poolFor(s, round), d = draft && draftDone(draft) ? draft : autoDraft(la, lb, r, pool), mods = (w: string) => patchedMods(s.meta, w);
  const ca = conditions(la, r), cb = conditions(lb, r), gA = gearBonus(A.gear, s.season), gB = gearBonus(B.gear, s.season);
  const big = bigOf(round), defs: [TeamDef, TeamDef] = [teamDef(A.id, teamName(s, A), la, d.picks[0], stratOf(s, A), { big, home: true }, { mods, conds: ca, foe: d.picks[1], side: 0, gear: gA }), teamDef(B.id, teamName(s, B), lb, d.picks[1], stratOf(s, B), { big }, { mods, conds: cb, foe: d.picks[0], side: 1, gear: gB })];
  const res = playOut(defs[0], defs[1], m.seed); Object.assign(m, { winner: res.winner, kills: res.kills, ticks: res.ticks, mvp: res.mvp, defs, draft: d, eng: ENGINE });
  recordDraft(metaOf(sid, s), d, res.winner);
  const ms = s.sponsor?.mission; if (ms && ms.season === s.season) for (const [side, ti] of [[0, m.a], [1, m.b]] as Array<[0 | 1, number]>) if (s.teams[ti].id === s.sponsor!.team) { ms.prog.kills += res.kills[side]; ms.prog.warden += res.events.filter((e) => e.kind === 'objective' && e.side === side).length; if (res.winner === side && res.mvp) ms.prog.mvps++; }
  const mvp = Object.values(res.winner === 0 ? la : lb).find((p) => p.name === res.mvp); if (mvp) feats(mvp).mvps++;
  const sh = shareOf(s, res.winner === 0 ? m.a : m.b); if (sh) earnToVault(sid, PRIZE.win * sh, 'LoG sponsor bonus');
}
function resolveRound(sid: string, s: LogSave, round: number): void {
  const rd = s.rounds[round]; if (!rd) return;
  const meta = metaOf(sid, s), gr = seeded(hashSeed(`${sid}:gban:${s.season}:${round}`)); // 글로벌 밴: 가끔 결함이 발견된 무기 하나를 이번 라운드 금지
  if (gr() < META.globalBanChance && meta.released.length) { const w = meta.released[Math.floor(gr() * meta.released.length)]; meta.globalBan = { weapon: w, round, season: s.season }; const wd = weaponById(w)!; s.news.push({ season: s.season, text: L(`글로벌 밴: ${wd.ko} — 결함이 발견되어 ${round + 1}라운드 사용 금지`, `Global ban: ${wd.en} — a defect was found; banned for round ${round + 1}`) }); }
  rd.forEach((m, i) => { if (m.winner === undefined) playMatch(sid, s, round, i, m, s.prepared && s.prepared.round === round && s.prepared.match === i ? s.prepared.draft : undefined); });
  s.prepared = null; s.done = round + 1;
  settleToto(sid, s, round);
  if (round === 3) { patchNow(sid, s); scandalRoll(sid, s); } // 시즌 중반 패치 · 승부 조작 의혹(드물게)
  if (round === 6) { const order = rankOrder(standings(s.rounds, 8)); s.rounds[7] = [{ a: order[0], b: order[1], seed: hashSeed(`${sid}:${s.season}:final`) }, { a: order[2], b: order[3], seed: hashSeed(`${sid}:${s.season}:third`) }]; }
  if (round === 7) {
    const f = s.rounds[7][0], third = s.rounds[7][1], champ = f.winner === 0 ? f.a : f.b, runner = f.winner === 0 ? f.b : f.a, thirdW = third.winner === 0 ? third.a : third.b;
    s.history.push({ season: s.season, champ: teamName(s, s.teams[champ]), runner: teamName(s, s.teams[runner]) }); s.history = s.history.slice(-30);
    for (const p of Object.values(lineupOf(s, s.teams[champ]))) feats(p).titles++; // 우승 실적(선발 5명)
    checkFoster(s);
    judgeMission(sid, s, champ, runner);
    if (!isGestalt()) natSeasonEnd(sid, s, champ, runner, thirdW, f); // 단일 의식: 국내 리그가 없으니 연고 행성·리그 기쁨도 없음
    if (worldsDue(s) && !isGestalt()) runWorlds(sid, s, champ, runner, thirdW); // 단일 의식은 구단 대항전(월즈)에 나갈 구단이 없음 — 대표팀(올림픽)만 // 월즈: 우승 1시드·준우승 2시드·3위 3시드(플레이인)
    playAllstar(sid, s);
    for (const [ti, prize] of [[champ, PRIZE.champion], [runner, PRIZE.runnerUp], [thirdW, PRIZE.third]] as Array<[number, number]>) { const sh = shareOf(s, ti); if (sh) { earnToVault(sid, prize * sh, 'LoG sponsor bonus'); notify(['후원 구단 성적', 'Sponsored club result'], [`${teamName(s, s.teams[ti])} ${ti === champ ? '우승' : ti === runner ? '준우승' : '3위'}! 후원 몫 ${Math.round(prize * sh)} 크레딧이 금고로 들어왔습니다.`, `${teamName(s, s.teams[ti])} finished ${ti === champ ? 'as champions' : ti === runner ? 'runner-up' : 'third'}! Your sponsor share of ${Math.round(prize * sh)} credits went to the vault.`]); } }
    chronNoteWorld(L(`${s.season} 레전드 오브 갤럭시 리그 우승: ${teamName(s, s.teams[champ])}`, `${s.season} Legend of Galaxy league champion: ${teamName(s, s.teams[champ])}`), true);
  }
  logDiagnostic('info', 'log.round', { season: s.season, round });
}
/** 국제 대회 토토(2026-10-31): 걸었던 경기가 모두 공개되면 정산. w = 월즈(경기 번호 = 시리즈), o = 올림픽(경기 번호). */
function settleIntl(sid: string, s: LogSave, kind: 'w' | 'o'): void {
  const W = s.worlds, R = s.oly.result;
  for (const sl of s.toto) {
    if (sl.settled || sl.intl !== kind) continue;
    if (kind === 'w') { if (!W || sl.yr !== W.year) { sl.settled = true; sl.won = false; earnToVault(sid, sl.stake, 'LoG toto refund'); continue; } const shown = wShownStages(W); if (!sl.picks.every((p) => W.series[p.round] && shown.has(W.series[p.round].stage))) continue; sl.settled = true; sl.won = sl.picks.every((p) => W.series[p.round].winner === (p.side ? W.series[p.round].b : W.series[p.round].a)); }
    else { if (!R || sl.yr !== R.games[0]?.seed) { sl.settled = true; sl.won = false; earnToVault(sid, sl.stake, 'LoG toto refund'); continue; } const n = oShown(R); if (!sl.picks.every((p) => OLY_STEPS.slice(0, n).flat().includes(p.round))) continue; sl.settled = true; sl.won = sl.picks.every((p) => R.games[p.round].winner === p.side); }
    if (sl.won) { earnToVault(sid, Math.floor(sl.stake * sl.odds), 'LoG toto'); notify(['토토 당첨!', 'Toto win!'], [`${kind === 'w' ? '월즈' : '올림픽'} 토토 당첨 — ${Math.floor(sl.stake * sl.odds).toLocaleString()} 크레딧이 금고로.`, `${kind === 'w' ? 'Worlds' : 'Olympics'} toto win — ${Math.floor(sl.stake * sl.odds).toLocaleString()} credits to the vault.`]); }
  }
}
/** 시리즈(3판·5판) 이길 확률: 한 판 확률 p 로. */
const seriesP = (p: number, bo: number): number => (bo >= 5 ? p ** 3 * (10 - 15 * p + 6 * p * p) : bo >= 3 ? p * p * (3 - 2 * p) : p);
const wRating = (t: WTeam): number => teamRating(teamDef('', '', t.lineup, [], t.strat)) + t.gear;
function wOdds(W: Worlds, si: number): [number, number] { const x = W.series[si], p = seriesP(winChance(wRating(W.teams[x.a]), wRating(W.teams[x.b])), x.bo); return [odds(p), odds(1 - p)]; }
function oOdds(R: NonNullable<Oly['result']>, gi: number): [number, number] { const g = R.games[gi], p = winChance(teamRating(g.defs[0]), teamRating(g.defs[1])); return [odds(p), odds(1 - p)]; }
function settleToto(sid: string, s: LogSave, round: number): void {
  for (const sl of s.toto) {
    if (sl.intl) continue; // 월즈·올림픽 토토는 settleIntl
    if (sl.settled || !sl.picks.every((p) => s.rounds[p.round]?.[p.match]?.winner !== undefined)) continue;
    if (!sl.picks.some((p) => p.round === round)) continue;
    sl.settled = true; sl.won = sl.picks.every((p) => s.rounds[p.round][p.match].winner === p.side);
    if (sl.won) earnToVault(sid, Math.floor(sl.stake * sl.odds), 'LoG toto');
  }
  s.toto = s.toto.filter((x) => !x.settled || s.toto.indexOf(x) >= s.toto.length - 30);
}
const byNeed = (s: LogSave): Team[] => s.teams.map((t, i) => ({ t, v: ratingOf(s, i) })).sort((x, y) => x.v - y.v).map((x) => x.t);
const ratingOf = (s: LogSave, ti: number) => teamRating(teamDef('', '', lineupOf(s, s.teams[ti]), [], s.teams[ti].strat));

/** 매달: 시즌 시작, 분기 훈련·영입 창, 라운드, 올림픽. */
function onMonth(sid: string, date: string): void {
  const d = ymd(date); if (!d) return; const s = saveOf(sid);
  if (s.worldsPending) startWorlds(sid, s); // 계산 중에 앱을 껐다면 다시(같은 결과)
  if (s.teams.some((t) => typeof t.company !== 'number' || !t.logo)) brandTeams(sid, s);
  if (s.season !== d.y) newSeason(sid, s, d.y);
  const q = `${d.y}.${Math.floor((d.m - 1) / 3)}`, newQ = s.quarter !== q;
  if (s.quarter !== q) {
    s.quarter = q; const r = seeded(hashSeed(`${sid}:train:${q}`)), sp = s.sponsor;
    for (const t of s.teams) {
      const mine = sp?.team === t.id, focus: Focus = mine && sp!.req.focus ? sp!.req.focus : (['phys', 'judg', 'team', 'ment', 'balanced'] as Focus[])[Math.floor(r() * 5)];
      for (const id of t.players) { const p = s.players[id]; if (p) trainQuarter(p, focus, r, (mine && sp!.req.practice[id]) || Object.keys(p.pool).sort((a, b) => p.pool[b] - p.pool[a])[0], mine && sp!.foster === id ? FOSTER.boost : 1); }
    }
    if (!q.endsWith('.0')) for (const t of byNeed(s)) aiManage(sid, s, t, d.y, r, false); // 분기 영입 창(빈 자리·영입 추천)
    for (const id of s.free) { const p = s.players[id]; if (p) trainQuarter(p, 'balanced', r); }
  }
  for (let i = s.done; i < 8; i++) { const due = ROUND_MONTHS[i]; if (d.m >= due && s.rounds[i]) resolveRound(sid, s, i); else break; }
  worldsStep(sid, s, d.y, d.m); olyStep(sid, s, d.y, d.m); // 국제 대회 라운드별 공개(한 달에 한 단계)
  olympicsMonth(sid, s, d.y, d.m);
  natMonth(sid, s, d.y, d.m, newQ);
  if (s.sponsor?.foster) checkFoster(s); // 떠났는지·올림픽 메달로 조건을 채웠는지
  ensureNames(sid, s);
  save(); push();
}

// ---------------- 은하 월드 챔피언십(롤 월즈식, 2026-10-30 사용자 결정) ----------------
// 은하 공동체(평의회)가 생긴 뒤 3년마다, 시즌 결승이 끝난 12월에. 참가: 우리 리그(우승 1시드·준우승 2시드 본선, 3위 3시드 플레이인) + 은하 공동체 회원국 구단(국력 순으로 시드).
// 방식: 플레이인 8팀(8강 단판 → 4강 3판 2선승, 4강 승자 2팀 본선) → 본선 16팀 스위스(3승 진출·3패 탈락, 진출·탈락이 걸린 경기는 3판 2선승) → 8강부터 5판 3선승 토너먼트.
export const WORLDS = { every: 3, prize: { champion: 6000, runner: 3000, semi: 1500, quarter: 800 }, mood: 2 } as const;
function worldsDue(s: LogSave): boolean { if (s.scn) return s.scn.worlds === s.season; const o = s.oly; if (!o.members.length || !o.seenYear) return false; const d = s.season - o.seenYear; return d >= WORLDS.every && d % WORLDS.every === 0; }
function foreignClub(sid: string, mb: { idx: number; name: string; weight: number }, seed: number, r: () => number): WTeam {
  const lu = {} as Record<Role, Player>, bump = 6 + Math.round(Math.log10(1 + mb.weight) * 5) + (seed === 1 ? 3 : seed === 2 ? 1 : -1);
  for (const role of ROLES) { const p = newPlayer(`w${mb.idx}s${seed}${role}`, gameName(r() < 0.5 ? 'm' : 'f', mb.idx) ?? `${mb.name} ${role}`, role, r); p.st = { phys: p.st.phys + bump, judg: p.st.judg + bump, team: p.st.team + bump, ment: p.st.ment + bump }; lu[role] = p; }
  const nm = `${L(...companyName(Math.floor(r() * 1080)))} ${L(...MASCOTS[Math.floor(r() * MASCOTS.length)])}`;
  const logo: Logo = { e: Math.floor(r() * EMBLEMS.length), s: Math.floor(r() * LOGO_SHAPES.length), p: Math.floor(r() * LOGO_PATTERNS.length), c: Math.floor(r() * LOGO_COLORS.length) };
  return { name: nm, region: mb.name, nation: mb.idx, ours: false, seed, logo, lineup: lu, gear: 0, strat: { aggr: Math.round((r() * 2 - 1) * 10) / 10, obj: Math.round(r() * 10) / 10 } };
}
// 대진·경기 계산은 작업 스레드(src/log-worlds.ts)에서. 결과가 오면 상금·실적·소식을 붙인다. 계산 중 앱을 꺼도 입력이 저장돼 있어 다음에 다시 계산(같은 결과).
let worldsBusy = '', worldsSync = false; // worldsSync: 시험용(같은 스레드에서 바로)
function runWorlds(sid: string, s: LogSave, champ: number, runner: number, third: number): void {
  const r = seeded(hashSeed(`${sid}:worlds:${s.season}`));
  const wb = natOf(s).wbid, hbW = wb && wb.year === s.season && wb.host === -1 ? hbOf(wb) : null, hg = hbW ? homeBonus(hbW.prep?.level ?? 0) : 0; // 우리가 월즈 개최국: 홈 이점
  const region = ctx.playerName || L('우리 제국', 'Our empire'), mk = (ti: number, seed: number): WTeam => ({ name: teamName(s, s.teams[ti]), region, ours: true, seed, teamId: s.teams[ti].id, logo: logoOf(s, s.teams[ti]) ?? undefined, lineup: lineupOf(s, s.teams[ti]), strat: stratOf(s, s.teams[ti]), gear: gearBonus(s.teams[ti].gear, s.season) + hg });
  if (hbW) hostEventStart(sid, s, hbW, L('은하 월드 챔피언십', 'Galactic Worlds'));
  // 회원국은 국력 순으로 시드 3개까지. 모두 합쳐 22팀이 넘으면 국력 낮은 나라의 3시드부터 뺀다.
  const mem = s.oly.members.slice().sort((x, y) => y.weight - x.weight), cand: Array<[typeof mem[number], number]> = [];
  for (let seed = 1; seed <= 3; seed++) for (const mb of mem) cand.push([mb, seed]);
  const take = cand.slice(0, 22 - 3), fmt = formatFor(3 + take.length);
  const teams: WTeam[] = [mk(champ, 1), mk(runner, 2), mk(third, 3), ...take.map(([mb, seed]) => foreignClub(sid, mb, seed, r))];
  // 22팀 방식: 본선 직행 14(우리 1·2시드 + 회원국 1·2시드부터), 플레이인 8(우리 3시드 + 나머지)
  let playin: number[] = [];
  if (fmt === 'full') { const others = teams.map((_, i) => i).filter((i) => i > 2).sort((x, y) => teams[x].seed - teams[y].seed); playin = [2, ...others.slice(12)]; }
  const nat = natOf(s), refuse = nat.warPolicy === 'refuse' ? s.oly.members.filter((mb) => terminal.items.find((c) => c.idx === mb.idx)?.em?.war).map((mb) => mb.idx) : []; // 전쟁 중인 나라와의 경기 거부(7)
  s.worldsPending = { sid, year: s.season, teams, playin, pool: metaOf(sid, s).released, meta: s.meta, ...(refuse.length ? { refuse } : {}) };
  startWorlds(sid, s);
}
function startWorlds(sid: string, s: LogSave): void {
  const inp = s.worldsPending; if (!inp || worldsBusy === sid) return;
  if (worldsSync) { applyWorlds(sid, s, runBracket(inp)); return; }
  try {
    worldsBusy = sid; const w = new Worker(path.join(__dirname, '..', 'log-worlds.js'), { workerData: { logWorlds: inp } });
    w.once('message', (m: { ok: boolean; worlds?: Worlds; error?: string }) => { worldsBusy = ''; const s2 = saveOf(sid); if (m.ok && m.worlds && s2.worldsPending?.year === inp.year) { applyWorlds(sid, s2, m.worlds); save(); push(); } else if (!m.ok) { logDiagnostic('warn', 'log.worlds_worker_error', { error: m.error }); applyWorlds(sid, s2, runBracket(inp)); save(); push(); } void w.terminate(); });
    w.once('error', (e) => { worldsBusy = ''; logDiagnostic('warn', 'log.worlds_worker_failed', { error: String(e) }); const s2 = saveOf(sid); if (s2.worldsPending?.year === inp.year) { applyWorlds(sid, s2, runBracket(inp)); save(); push(); } });
  } catch (e) { worldsBusy = ''; logDiagnostic('warn', 'log.worlds_worker_failed', { error: String(e) }); applyWorlds(sid, s, runBracket(inp)); } // 작업 스레드를 못 띄우면 여기서
}
function applyWorlds(sid: string, s: LogSave, W: Worlds): void {
  delete s.worldsPending;
  s.worlds = W; W.shown = 0; W.at = `${W.year}.12`; // 결과는 다 계산해 두고 다음 달부터 한 단계씩 공개(라운드별 진행, 2026-10-31)
  const steps = worldsSteps(W), ours = W.teams.filter((t) => t.ours).map((t) => t.name).join(', ');
  s.news.push({ season: s.season, text: L(`은하 월드 챔피언십 개막 — ${W.teams.length}팀, 다음 달부터 ${steps.length}단계로 진행. 우리 대표: ${ours}`, `Galactic Worlds begins — ${W.teams.length} teams, ${steps.length} stages from next month. Our clubs: ${ours}`) });
  ctx.notify({ kind: 'news', title: L('은하 월드 챔피언십 개막', 'Galactic Worlds begins'), body: L(`다음 달부터 한 달에 한 단계씩 경기가 열립니다. 우주 경기장 › 나라·대회 › 월즈에서 토토도 걸 수 있어요.`, `One stage per month from next month. Bet on it under Space Stadium › Nation & events › Worlds.`) });
}
/** 월즈 단계(한 달에 하나): 플레이인 → 스위스 두 라운드씩 → 8강 → 4강 → 결승. 조별 방식은 조별 → 4강 → 결승. */
export function worldsSteps(W: Pick<Worlds, 'series'>): string[][] {
  const st = [...new Set(W.series.map((x) => x.stage))], sw = st.filter((k) => k.startsWith('swiss')).sort((a, b) => +a.slice(5) - +b.slice(5)), out: string[][] = [];
  if (st.includes('playin')) out.push(['playin']); if (st.includes('group')) out.push(['group']);
  for (let i = 0; i < sw.length; i += 2) out.push(sw.slice(i, i + 2));
  for (const k of ['quarter', 'semi', 'final']) if (st.includes(k)) out.push([k]);
  return out;
}
/** 지금까지 공개된 단계(옛 기록은 shown 이 없어 전부 공개). */
const wShownStages = (W: Worlds): Set<string> => { const steps = worldsSteps(W); return new Set((W.shown === undefined ? steps : steps.slice(0, W.shown)).flat()); };
const wDone = (W: Worlds | undefined): boolean => !W || W.shown === undefined || W.shown >= worldsSteps(W).length;
/** 다음 공개 단계에서 지금 대진이 정해진 경기(토토·예고용): 그 단계의 첫 스테이지만. */
function wNext(W: Worlds): { stage: string; series: number[] } | null { if (wDone(W)) return null; const st = worldsSteps(W)[W.shown!][0]; return { stage: st, series: W.series.map((x, i) => (x.stage === st ? i : -1)).filter((i) => i >= 0) }; }
function worldsStep(sid: string, s: LogSave, y: number, m: number): void {
  const W = s.worlds; if (!W || wDone(W) || W.at === `${y}.${m}`) return;
  const step = worldsSteps(W)[W.shown!]; W.shown! += 1; W.at = `${y}.${m}`;
  settleIntl(sid, s, 'w');
  const mine = W.series.filter((x) => step.includes(x.stage) && (W.teams[x.a].ours || W.teams[x.b].ours));
  if (mine.length) { const t = mine.map((x) => { const us = W.teams[x.a].ours ? x.a : x.b, them = us === x.a ? x.b : x.a, sc = [x.games.filter((g) => g.winner === 0).length, x.games.filter((g) => g.winner === 1).length]; if (x.forfeit) return L(`${W.teams[us].name} ${x.winner === us ? '부전승' : '기권패'} vs ${W.teams[them].name}`, `${W.teams[us].name} ${x.winner === us ? 'won by forfeit' : 'forfeited'} vs ${W.teams[them].name}`); return L(`${W.teams[us].name} ${x.winner === us ? '승' : '패'}(${us === x.a ? sc[0] : sc[1]}:${us === x.a ? sc[1] : sc[0]}) vs ${W.teams[them].name}`, `${W.teams[us].name} ${x.winner === us ? 'won' : 'lost'} ${us === x.a ? sc[0] : sc[1]}-${us === x.a ? sc[1] : sc[0]} vs ${W.teams[them].name}`); });
    ctx.notify({ kind: 'news', title: L(`월즈 ${stageKo(step[0])} 결과`, `Worlds ${stageEn(step[0])} results`), body: t.join(' · ') }); }
  if (wDone(W)) finalizeWorlds(sid, s, W);
}
const stageKo = (k: string) => (k === 'playin' ? '플레이인' : k === 'group' ? '조별 풀리그' : k === 'quarter' ? '8강' : k === 'semi' ? '4강' : k === 'final' ? '결승' : k === 'bronze' ? '3위전' : k.startsWith('swiss') ? '스위스' : k);
const stageEn = (k: string) => (k === 'playin' ? 'play-in' : k === 'group' ? 'round robin' : k === 'quarter' ? 'quarterfinal' : k === 'semi' ? 'semifinal' : k === 'final' ? 'final' : k === 'bronze' ? 'bronze match' : k.startsWith('swiss') ? 'Swiss stage' : k);
/** 마지막 단계(결승)가 공개되면: 상금·실적·나라 연동·연대기·소식(예전엔 계산 즉시). */
function finalizeWorlds(sid: string, s: LogSave, W: Worlds): void {
  if (s.scn?.worlds === W.year) delete s.scn.worlds; // 시나리오 화합 대회: 한 번으로 끝
  (s.worldsHistory ??= []).push({ year: W.year, champ: W.teams[W.champion].name, region: W.teams[W.champion].region, runner: W.teams[W.runner].name, ours: W.teams[W.champion].ours });
  // 상금(후원 몫)·실적·민심·연대기
  const placeOf = (i: number) => (i === W.champion ? 'champion' : i === W.runner ? 'runner' : W.semis.includes(i) ? 'semi' : W.quarters.includes(i) ? 'quarter' : '') as keyof typeof WORLDS.prize | '';
  W.teams.forEach((t, i) => { if (!t.teamId) return; const pl = placeOf(i); const ti = s.teams.findIndex((x) => x.id === t.teamId), sh = ti >= 0 ? shareOf(s, ti) : 0; if (pl && sh) { earnToVault(sid, WORLDS.prize[pl] * sh, 'LoG worlds prize'); notify(['월즈 후원 몫', 'Worlds sponsor share'], [`${t.name} 월즈 ${pl === 'champion' ? '우승' : pl === 'runner' ? '준우승' : pl === 'semi' ? '4강' : '8강'}! 후원 몫 ${Math.round(WORLDS.prize[pl] * sh)} 크레딧.`, `${t.name} reached the Worlds ${pl === 'champion' ? 'title' : pl === 'runner' ? 'final' : pl === 'semi' ? 'semifinals' : 'quarterfinals'}! Sponsor share ${Math.round(WORLDS.prize[pl] * sh)} credits.`]); } });
  const C = W.teams[W.champion]; if (C.ours) { for (const p of Object.values(C.lineup)) if (s.players[p.id]) feats(s.players[p.id]).titles++; checkFoster(s); }
  natWorlds(sid, s, W);
  chronNoteWorld(L(`${W.year} 은하 월드 챔피언십 우승: ${C.name}(${C.region})`, `${W.year} Galactic World Championship: ${C.name} (${C.region}) win`), true);
  s.news.push({ season: s.season, text: L(`월즈 우승 ${C.name}(${C.region}), 준우승 ${W.teams[W.runner].name}`, `Worlds: ${C.name} (${C.region}) champions, ${W.teams[W.runner].name} runner-up`) });
  ctx.notify({ kind: 'news', title: L('은하 월드 챔피언십 결과', 'Galactic World Championship results'), body: L(`우승 ${C.name}(${C.region})`, `Champion ${C.name} (${C.region})`) });
}
/** 월즈 뒤 나라 연동: 열기 · 우승 축제/결승 실망(2) · 라이벌(4) · 지도자 편지(5) · 전쟁 상대 거부/강행(7) · 스타 이적(12) · 스포츠 1면(14). */
function natWorlds(sid: string, s: LogSave, W: Worlds): void {
  const n = natOf(s), C = W.teams[W.champion], R2 = W.teams[W.runner], fin = W.series.find((x) => x.stage === 'final'), fg = fin?.games[fin.games.length - 1];
  const style = fg ? playStyle(fg.kills, fg.winner) : 'even';
  heatUp(s, NAT.heat.worldsHeld);
  if (C.ours) {
    heatUp(s, NAT.heat.worldsChamp); natMood(s, ethicBonus(ethicsNow(), style, WORLDS.mood), L('은하 월드 챔피언십 우승', 'Galactic Worlds champions'));
    n.festival = NAT.festival.months; queueOps(s, [{ t: 'country', mod: 'sllm_log_festival', days: NAT.festival.days }], 'worlds festival');
    sportsNews(s, 'worldsWin', { team: C.name, them: R2.name }); try { noteExtra('sports', ctx.gameDate || '', `Our club ${C.name} won the Galactic Legend of Galaxy World Championship, beating ${R2.name} (${R2.region}) in the final.`); } catch { /* 신문 없음 */ }
  } else if (R2.ours) { heatUp(s, NAT.heat.worldsFinal); natMood(s, -1, L('월즈 결승 패배', 'Lost the Worlds final')); sportsNews(s, 'worldsLose', { team: R2.name, them: `${C.name}(${C.region})` }); }
  const before = new Set(rivalsOf(n.meet)); let forfeits = 0, playedWar = false, rivalArticle = false; const met: Array<{ idx: number; nation: string; weWon: boolean; team: string }> = [];
  for (const x of W.series) {
    const A = W.teams[x.a], B = W.teams[x.b]; if (A.ours === B.ours) continue; const us = A.ours ? x.a : x.b, them = A.ours ? B : A; if (them.nation === undefined) continue;
    const k = String(them.nation); n.meet[k] = (n.meet[k] ?? 0) + 1;
    if (x.forfeit) { forfeits++; continue; }
    const em = terminal.items.find((c) => c.idx === them.nation)?.em, weWon = x.winner === us; if (em?.war) playedWar = true;
    met.push({ idx: them.nation, nation: them.region, weWon, team: W.teams[us].name });
    if (weWon && (before.has(them.nation) || n.meet[k] >= NAT.rivalMeetings)) {
      natMood(s, em?.rival ? 2 : 1, L(`라이벌 ${them.region} 격파`, `Beat rival ${them.region}`)); queueOps(s, [{ t: 'opinion', idx: them.nation, mod: em?.rival ? 'sllm_log_rival_sting_2' : 'sllm_log_rival_sting' }], 'rival');
      if (!rivalArticle) { rivalArticle = true; sportsNews(s, 'rivalWin', { team: W.teams[us].name, them: them.region }); }
    }
  }
  if (forfeits) { n.forfeits = (n.forfeits ?? 0) + forfeits; natMood(s, 1, L('전쟁 중인 나라와의 경기 거부(매파 환호)', 'Refused to play a nation at war (hawks cheer)')); s.news.push({ season: s.season, text: L(`월즈: 전쟁 중인 나라와의 경기 ${forfeits}번 거부(기권패)`, `Worlds: refused ${forfeits} match(es) against nations at war (forfeits)`) }); }
  if (playedWar) { queueOps(s, s.oly.members.filter((mb) => !terminal.items.find((c) => c.idx === mb.idx)?.em?.war).slice(0, 20).map((mb): QOp => ({ t: 'opinion', idx: mb.idx, mod: 'sllm_log_sportsmanship' })), 'sportsmanship'); s.news.push({ season: s.season, text: L('월즈: 전쟁 중에도 경기를 강행 — 은하가 스포츠 정신을 칭찬', 'Worlds: we played on despite the war — the galaxy praised our sportsmanship') }); }
  // 편지: 결승 상대(외국)와, 만난 라이벌 한 나라 — 두 통까지
  const sent = new Set<number>(), r = seeded(hashSeed(`${sid}:letters:${W.year}`));
  if (fin && (C.ours || R2.ours)) { const them = C.ours ? R2 : C; if (!them.ours && them.nation !== undefined) { natLetter(sid, them.nation, them.region, C.ours, C.ours ? C.name : R2.name, Math.floor(r() * 9)); sent.add(them.nation); } }
  const rv = met.find((m) => !sent.has(m.idx) && n.meet[String(m.idx)] >= NAT.rivalMeetings); if (rv) natLetter(sid, rv.idx, rv.nation, rv.weWon, rv.team, Math.floor(r() * 9));
  // 스타 이적: 월즈 뒤 외국 구단이 우리 레전드를 노림
  const star = Object.values(s.players).filter((p) => p.legend && p.club && overall(p) >= NAT.transfer.minOvr).sort((a, b) => overall(b) - overall(a))[0], foes = W.teams.filter((t) => !t.ours && t.nation !== undefined);
  if (star && foes.length && !n.transfer && r() < NAT.transfer.chance) { const f = foes[Math.floor(r() * foes.length)]; n.transfer = { pid: star.id, idx: f.nation!, nation: f.region, season: s.season };
    notify(['스타 이적 제안', 'Star transfer offer'], [`${f.region}의 구단이 레전드 ${star.name}을(를) 데려가려 합니다. 우주 경기장 › 나라와 경기에서 금고로 붙잡을지(${NAT.transfer.keepFee}) 보낼지 정하세요.`, `A club in ${f.region} wants legend ${star.name}. Decide under Stadium › Nation & league whether to keep them with the vault (${NAT.transfer.keepFee}) or let them go.`]); }
  void sendOps(sid);
}
/** 월즈 보기용(공개된 단계까지만 — 결과를 미리 보여 주지 않음). */
function worldsLast(s: LogSave, W: Worlds) {
  const shown = wShownStages(W), done = wDone(W), steps = worldsSteps(W), nx = wNext(W), vis = (k: string) => shown.has(k) || nx?.stage === k;
  const rec = (pre: string) => { const r: Record<number, [number, number]> = {}; for (const x of W.series) { if (!x.stage.startsWith(pre) || !shown.has(x.stage)) continue; const l = x.winner === x.a ? x.b : x.a; (r[x.winner] ??= [0, 0])[0]++; (r[l] ??= [0, 0])[1]++; } return r; };
  const swissAll = Object.keys(W.swiss ?? {}).map(Number), groupAll = Object.keys(W.group ?? {}).map(Number);
  const swiss = rec('swiss'), group = rec('group'); for (const t of swissAll) swiss[t] ??= [0, 0]; for (const t of groupAll) group[t] ??= [0, 0];
  const score = (x: Worlds['series'][number]) => [x.games.filter((g) => g.winner === 0).length, x.games.filter((g) => g.winner === 1).length];
  return { year: W.year, format: W.format ?? 'full', done, step: W.shown ?? steps.length, steps, group, swiss, swissDone: !steps.some((st, k) => k >= (W.shown ?? steps.length) && st.some((x) => x.startsWith('swiss') || x === 'group')),
    champion: done ? W.champion : -1, runner: done ? W.runner : -1, semis: vis('semi') ? W.semis : [], quarters: vis('quarter') ? W.quarters : [],
    teams: W.teams.map((t) => ({ name: t.name, region: t.region, ours: t.ours, seed: t.seed, logo: t.teamId ? logoOf(s, s.teams.find((x) => x.id === t.teamId)!) : t.logo ?? null })),
    series: W.series.map((x, si) => ({ x, si })).filter(({ x }) => shown.has(x.stage)).map(({ x, si }) => ({ si, a: x.a, b: x.b, bo: x.bo, stage: x.stage, winner: x.winner, forfeit: !!x.forfeit, score: score(x), games: x.games.length })),
    next: nx ? { stage: nx.stage, series: nx.series.map((si) => { const x = W.series[si]; return { si, a: x.a, b: x.b, bo: x.bo, odds: wOdds(W, si) }; }) } : null };
}
/** 올림픽 보기용: 공개된 단계까지 승패, 다음 단계는 대진·배당, 그 뒤는 미정. */
function olyResultView(R: NonNullable<Oly['result']>) {
  const n = oShown(R), done = n >= 3, open = OLY_STEPS[n] ?? [];
  return { done, step: n, us: R.us ?? null, gold: done ? R.gold : null, silver: done ? R.silver : null, bronze: done ? R.bronze : null,
    games: R.games.map((g, i) => { const k = OLY_STEPS.findIndex((st) => st.includes(i)); return { i, stage: olyStage(i), a: k <= n ? g.a : null, b: k <= n ? g.b : null, winner: k < n ? g.winner : null, odds: open.includes(i) ? oOdds(R, i) : null }; }) };
}
function worldsView(s: LogSave) {
  const W = s.worlds, o = s.oly, nextYear = o.seenYear ? (() => { let y = o.seenYear + WORLDS.every; while (y < s.season || (y === s.season && s.done >= 8 && W?.year === y)) y += WORLDS.every; return y; })() : null;
  const st = standings(s.rounds, 8), ord = rankOrder(st);
  const seeds = s.rounds[7]?.length ? null : ord.slice(0, 3).map((i, k) => ({ seed: k + 1, name: teamName(s, s.teams[i]) })); // 정규 시즌 순위로 본 예상(결승 전)
  return { hosting: hostView(s, 'worlds'), active: o.members.length > 0 && !!o.seenYear, next: nextYear, seedsPreview: seeds, running: !!s.worldsPending, members: o.members.length, formatNow: formatFor(Math.min(22, 3 + 3 * o.members.length)),
    last: W ? worldsLast(s, W) : null,
    history: (s.worldsHistory ?? []).slice(-10).reverse() };
}

// ---------------- 올림픽 ----------------
function olympicsMonth(sid: string, s: LogSave, y: number, m: number): void {
  const o = s.oly, mem = council.pendingAgenda && !council.pendingAgenda.demo ? council.pendingAgenda.members : [];
  if (mem.length >= 2) { o.members = mem.filter((x) => x.ai).map((x) => ({ idx: x.idx, name: x.name, weight: x.weight })); if (!o.seenYear) { o.seenYear = y; o.year = y + 2; } }
  if (!o.year || !o.members.length) return;
  if (y === o.year - 1 && m >= 1 && m < 7 && !o.bidOpen && o.host === undefined) { const hb = hbOf(o); hb.rivals = pickRivals(sid, `oly:${o.year}`, o.members); }
  if (y === o.year - 1 && m >= 1 && m < 7 && !o.bidOpen && o.host === undefined) { o.bidOpen = true; ctx.notify({ kind: 'office', title: L('은하 올림픽 유치 신청', 'Galactic Olympics bidding'), body: L(`${o.year}년 은하 올림픽 개최국 유치 신청이 열렸습니다(우주 경기장 › 올림픽).`, `Bidding to host the ${o.year} Galactic Olympics is open (Space Stadium › Olympics).`), action: L('확인', 'OK') }); }
  if (y === o.year - 1 && m >= 7 && o.host === undefined) {
    const r = seeded(hashSeed(`${sid}:oly:${o.year}`)), pool = o.members.slice().sort((a, b) => b.weight - a.weight);
    const atWar = (idx: number) => !!terminal.items.find((c) => c.idx === idx)?.em?.war; // 전쟁 중인 나라는 개최 불가(7)
    const hb = hbOf(o), fixed = (hb.rivals ?? []).filter((x) => !atWar(x));
    const bidders = fixed.length ? fixed.slice() : pool.filter(() => r() < 0.35).filter((x) => !atWar(x.idx)).slice(0, 3).map((x) => x.idx); if (!bidders.length) { const p0 = pool.find((x) => !atWar(x.idx)); if (p0) bidders.push(p0.idx); } if (o.weBid) { bidders.push(-1); bribeCheck(sid, s, hb, `oly:${o.year}`, L('은하 올림픽', 'Galactic Olympics')); } if (!bidders.length) bidders.push(-1);
    const rel = (idx: number) => terminal.items.find((c) => c.idx === idx)?.em as { war?: boolean; rival?: boolean; ally?: boolean; fed?: boolean } | undefined;
    const voters = o.members.map((v) => ({ idx: v.idx, weight: v.weight, like: (b: number) => { if (b !== -1) return 0; const e = rel(v.idx); return (e?.war ? -1 : e?.rival ? -0.6 : e?.ally || e?.fed ? 0.8 : 0) + (hb.lobby?.[String(v.idx)] ?? 0); } }));
    const res = hostVote(bidders, voters, r); o.host = res.host; o.bidOpen = false; hb.rounds = res.rounds as unknown as Array<Record<string, number>>; hb.ballots = res.ballots as unknown as Record<string, number>; if (o.weBid) ctx.notify({ kind: 'office', title: L('은하 올림픽 개최지 투표', 'Galactic Olympics host vote'), body: L('은하 공동체가 개최지를 정했습니다. 우주 경기장 › 올림픽의 유치 칸에서 「투표 장면 보기」로 회의장 투표를 볼 수 있습니다.', 'The Galactic Community has chosen the host. Watch the vote in the council chamber: Space stadium › Olympics › "Watch the vote".'), action: L('확인', 'OK') }); if (o.weBid && res.host === -1) hostWonPrep(sid, hb, L('은하 올림픽', 'Galactic Olympics')); o.hostName = res.host === -1 ? (ctx.playerName || L('우리 제국', 'Our empire')) : o.members.find((x) => x.idx === res.host)?.name ?? '?';
    if (o.weBid) { natMood(s, res.host === -1 ? OLYMPIC.hostMood : OLYMPIC.bidFailMood, res.host === -1 ? L('은하 올림픽 유치 성공', 'Won the Galactic Olympics bid') : L('은하 올림픽 유치 실패', 'Lost the Galactic Olympics bid')); if (res.host === -1) hostWon(sid, s, res.ballots, L('은하 올림픽', 'Galactic Olympics')); }
    chronNoteWorld(L(`${o.year} 은하 올림픽 개최국: ${o.hostName}`, `${o.year} Galactic Olympics host: ${o.hostName}`), true);
  }
  if (y === o.year && m >= 6 && o.resultYear !== y) { o.resultYear = y; runOlympics(sid, s, m); }
}
function runOlympics(sid: string, s: LogSave, month = 6): void {
  const o = s.oly, r = seeded(hashSeed(`${sid}:olygames:${o.year}`));
  const ours = nationalLineup(s), nations: Array<{ key: string; name: string; def: TeamDef }> = [];
  const hostingO = o.host === -1, hbO = hostingO ? hbOf(o) : null; // 우리가 개최국: 홈 이점(준비도 비례) · 개최 효과
  const mine = autoDraft(ours, ours, r, metaOf(sid, s).released).picks[0]; nations.push({ key: 'me', name: ctx.playerName || L('우리 제국', 'Our empire'), def: teamDef('me', ctx.playerName || 'Us', ours, mine, { aggr: 0, obj: 0.5 }, { big: true, home: hostingO }, hbO ? { gear: homeBonus(hbO.prep?.level ?? 0) } : {}) });
  if (hbO) hostEventStart(sid, s, hbO, L('은하 올림픽', 'Galactic Olympics'));
  for (const mb of o.members.slice().sort((a, b) => b.weight - a.weight).slice(0, 7)) {
    const lu = {} as Record<Role, Player>; for (const role of ROLES) { const p = newPlayer(`o${mb.idx}${role}`, gameName(r() < 0.5 ? 'm' : 'f', mb.idx) ?? `${mb.name} ${role}`, role, r); const bump = 8 + Math.round(Math.log10(1 + mb.weight) * 6); p.st = { phys: p.st.phys + bump, judg: p.st.judg + bump, team: p.st.team + bump, ment: p.st.ment + bump }; lu[role] = p; }
    nations.push({ key: String(mb.idx), name: mb.name, def: teamDef(String(mb.idx), mb.name, lu, autoDraft(lu, lu, r, metaOf(sid, s).released).picks[0], { aggr: r() * 2 - 1, obj: r() }, { big: true }) });
  }
  while (nations.length < 8) { const i = nations.length; const lu = {} as Record<Role, Player>; for (const role of ROLES) lu[role] = newPlayer(`x${i}${role}`, nm(), role, r); nations.push({ key: `x${i}`, name: L(`초청국 ${i}`, `Guest nation ${i}`), def: teamDef(`x${i}`, `Guest ${i}`, lu, autoDraft(lu, lu, r, metaOf(sid, s).released).picks[0], { aggr: 0, obj: 0.5 }) }); }
  const b = olympicBracket(nations.map((n) => n.def), hashSeed(`${sid}:${o.year}`));
  o.result = { gold: nations[b.gold].name, silver: nations[b.silver].name, bronze: nations[b.bronze].name, games: b.games.map((g) => ({ a: nations[g.a].name, b: nations[g.b].name, seed: g.seed, winner: g.winner, eng: g.eng, defs: [nations[g.a].def, nations[g.b].def] as [TeamDef, TeamDef] })),
    shown: 0, at: `${o.year}.${month}`, us: nations[0].name, ids: Object.values(ours).map((p) => p.id), ourMedal: [b.gold, b.silver, b.bronze].indexOf(0) };
  ctx.notify({ kind: 'news', title: L(`${o.year} 은하 올림픽 개막`, `${o.year} Galactic Olympics open`), body: L('다음 달 8강부터 한 달에 한 단계씩(8강 → 4강 → 결승·3위전). 우주 경기장 › 나라·대회 › 올림픽에서 토토도 걸 수 있어요.', 'Quarterfinals next month, then one stage per month (QF → SF → final & bronze). Bet under Space Stadium › Nation & events › Olympics.') });
}
/** 올림픽 단계: 경기 번호 0~3 8강 · 4~5 4강 · 6 결승 · 7 3위전. */
const OLY_STEPS = [[0, 1, 2, 3], [4, 5], [6, 7]];
const olyStage = (gi: number) => (gi < 4 ? 'quarter' : gi < 6 ? 'semi' : gi === 6 ? 'final' : 'bronze');
const oShown = (r: NonNullable<Oly['result']>) => (r.shown === undefined ? 3 : r.shown);
function olyStep(sid: string, s: LogSave, y: number, m: number): void {
  const r = s.oly.result; if (!r || r.shown === undefined || r.shown >= 3 || r.at === `${y}.${m}`) return;
  const step = OLY_STEPS[r.shown]; r.shown += 1; r.at = `${y}.${m}`; settleIntl(sid, s, 'o');
  const mine = step.map((gi) => r.games[gi]).filter((g) => g.a === r.us || g.b === r.us);
  if (mine.length) ctx.notify({ kind: 'news', title: L(`올림픽 ${step.length > 2 ? '8강' : step[0] === 4 ? '4강' : '결승·3위전'} 결과`, `Olympics ${step.length > 2 ? 'quarterfinal' : step[0] === 4 ? 'semifinal' : 'final & bronze'} results`), body: mine.map((g) => { const won = (g.winner === 0 ? g.a : g.b) === r.us, gi = r.games.indexOf(g); return L(`대표팀 ${stageKo(olyStage(gi))} ${won ? '승리' : '패배'} — ${g.a} vs ${g.b}`, `National team ${won ? 'won' : 'lost'} the ${stageEn(olyStage(gi))} — ${g.a} vs ${g.b}`); }).join(' · ') });
  if (r.shown >= 3) finalizeOlympics(sid, s);
}
function finalizeOlympics(sid: string, s: LogSave): void {
  const o = s.oly, r = o.result!, b = { gold: r.gold, silver: r.silver, bronze: r.bronze }; void sid;
  for (const [n, slot] of [[b.gold, 0], [b.silver, 1], [b.bronze, 2]] as Array<[string, 0 | 1 | 2]>) (o.medals[n] ??= [0, 0, 0])[slot]++;
  const ourMedal = r.ourMedal ?? -1;
  if (ourMedal >= 0) for (const id of r.ids ?? []) if (s.players[id]) feats(s.players[id]).medals++; // 대표팀 메달 실적
  if (ourMedal >= 0) { heatUp(s, NAT.heat.olyMedal); const fg = r.games[r.games.length - 2] ?? r.games[r.games.length - 1]; natMood(s, ourMedal === 0 && fg ? ethicBonus(ethicsNow(), 'even', OLYMPIC.medalMood.gold) : [OLYMPIC.medalMood.gold, OLYMPIC.medalMood.silver, OLYMPIC.medalMood.bronze][ourMedal], L('은하 올림픽 메달', 'Galactic Olympics medal')); if (ourMedal === 0) sportsNews(s, 'olyGold', {}); }
  const table = Object.entries(o.medals).sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1] || y[1][2] - x[1][2]);
  chronNoteWorld(L(`${o.year} 은하 올림픽 — 금 ${r.gold}, 은 ${r.silver}, 동 ${r.bronze}. 역대 메달 1위: ${table[0]?.[0] ?? '-'}`, `${o.year} Galactic Olympics — gold ${r.gold}, silver ${r.silver}, bronze ${r.bronze}. All-time medal leader: ${table[0]?.[0] ?? '-'}`), true);
  ctx.notify({ kind: 'news', title: L('은하 올림픽 결과', 'Galactic Olympics results'), body: L(`금 ${r.gold} · 은 ${r.silver} · 동 ${r.bronze}`, `Gold ${r.gold} · Silver ${r.silver} · Bronze ${r.bronze}`) });
  o.year = (o.year ?? 0) + OLYMPIC.every; o.host = undefined; o.hostName = undefined; o.weBid = false; o.bidders = undefined; // 다음 대회(결과·대표팀 구성은 다음 대회까지 남김)
  if (s.scn) { delete s.scn.oly; o.year = undefined; } // 시나리오 화합 대회: 다음 대회는 다시 초청해야 열린다
}
/** 유치 성공(올림픽·월즈 공통, 6): 열기 · 우리에게 표 준 나라 호감 + · 신문. */
function hostWon(sid: string, s: LogSave, ballots: Record<number, number>, event: string): void {
  heatUp(s, NAT.heat.host); const fans = Object.entries(ballots).filter(([, b]) => b === -1).map(([v]) => Number(v)).filter((v) => v >= 0);
  queueOps(s, fans.slice(0, 20).map((idx): QOp => ({ t: 'opinion', idx, mod: 'sllm_log_host_thanks' })), 'host thanks'); sportsNews(s, 'host', { event }); void sendOps(sid);
}
// ---------------- 유치 경쟁 · 개최 준비 · 개최 효과(2026-10-31, 규칙 src/log-host.ts) ----------------
const hbOf = (o: { hb?: HostBid }): HostBid => (o.hb = sanitizeHostBid(o.hb) ?? {});
/** 우리를 얼마나 좋아하나(게임 외교 관계): 전쟁 −1 · 경쟁 −0.6 · 동맹·연방 +0.8. */
function relLike(idx: number): number { const e = terminal.items.find((c) => c.idx === idx)?.em as { war?: boolean; rival?: boolean; ally?: boolean; fed?: boolean } | undefined; return e?.war ? -1 : e?.rival ? -0.6 : e?.ally || e?.fed ? 0.8 : 0; }
/** 유치 경쟁국: 신청 기간이 열릴 때 정해 두고 보여 줌(국력 순 회원국 중 1~3곳, 전쟁 중인 나라 빼고). */
function pickRivals(sid: string, key: string, members: Array<{ idx: number; weight: number }>): number[] {
  const r = seeded(hashSeed(`${sid}:hostriv:${key}`)), atWar = (idx: number) => !!terminal.items.find((c) => c.idx === idx)?.em?.war, pool = members.slice().sort((a, b) => b.weight - a.weight).filter((x) => !atWar(x.idx));
  const out = pool.filter(() => r() < 0.35).slice(0, 3).map((x) => x.idx); if (!out.length && pool[0]) out.push(pool[0].idx); return out;
}
/** 투표 직전: 뒷돈이 들켰는지(나라마다 25%). 들키면 그 나라는 반대표 · 민심 − · 부패 낌새 · 소식. */
function bribeCheck(sid: string, s: LogSave, hb: HostBid, key: string, event: string): void {
  const r = seeded(hashSeed(`${sid}:hostbribe:${key}`)); hb.caught ??= [];
  for (const idx of hb.bribed ?? []) { if (hb.caught.includes(idx) || r() >= HOST.bribe.catch) continue; hb.caught.push(idx); (hb.lobby ??= {})[String(idx)] = HOST.bribe.caughtLike;
    const nm = s.oly.members.find((x) => x.idx === idx)?.name ?? '?'; natMood(s, HOST.bribe.mood, L(`${event} 유치 뒷돈 들통`, `${event} bid bribe exposed`)); try { vaultSuspicionUp(sid, HOST.bribe.susp); } catch { /* 금고 없음 */ }
    s.news.push({ season: s.season, text: L(`${event} 유치 뒷돈 들통 — ${nm} 대표단이 폭로`, `${event} bid bribe exposed — the ${nm} delegation went public`) });
    ctx.notify({ kind: 'news', title: L('유치 뒷돈 스캔들', 'Bid bribery scandal'), body: L(`${nm}에 건넨 뒷돈이 드러났습니다. 그 나라는 우리를 찍지 않고, 민심이 떨어졌습니다.`, `The money given to ${nm} came to light. They will not vote for us, and public mood fell.`) }); }
}
/** 투표에서 이김: 개최 준비 시작. */
function hostWonPrep(sid: string, hb: HostBid, event: string): void { void sid; hb.prep = { level: 0, done: [] }; ctx.notify({ kind: 'office', title: L(`${event} 개최 확정`, `${event}: we are hosts`), body: L('우주 경기장에서 개최 행성을 고르고 경기장·선수촌·보안·홍보를 준비하세요. 준비가 잘 될수록 대회 때 민심·관광 수입·홈 이점이 큽니다.', 'Pick a host planet and prepare the arena, village, security and promotion in the Space Stadium. Better preparation means more mood, tourism income and home advantage.'), action: L('확인', 'OK') }); }
/** 대회가 열릴 때(개최국): 준비도에 따라 대성공·보통·망신. 개막식 축사 고르기를 연다. */
function hostEventStart(sid: string, s: LogSave, hb: HostBid, event: string): void {
  if (hb.result) return; const lv = hb.prep?.level ?? 0, res = hostResult(lv), planet = hb.prep?.planet; hb.result = res; hb.ceremony = 'open';
  const ops: QOp[] = [];
  if (res === 'great') { natMood(s, 2, L(`${event} 개최 대성공`, `${event}: a triumphant host`)); heatUp(s, 5); ops.push({ t: 'energy', n: HOST.tourism.great }, { t: 'country', mod: 'sllm_log_festival', days: 60 }); if (planet) ops.push({ t: 'planet', name: planet, mod: 'sllm_log_home_pride', days: HOST.prideDays }); }
  else if (res === 'ok') { natMood(s, 1, L(`${event} 개최`, `${event}: hosts`)); ops.push({ t: 'energy', n: HOST.tourism.ok }); if (planet) ops.push({ t: 'planet', name: planet, mod: 'sllm_log_home_pride', days: 180 }); }
  else { natMood(s, -2, L(`${event} 준비 부족 망신`, `${event}: an embarrassing host`)); if (planet) ops.push({ t: 'planet', name: planet, mod: 'sllm_log_home_gloom', days: 180 }); }
  queueOps(s, ops, 'host event');
  const pl = planet ?? L('수도', 'capital');
  const head = res === 'great' ? L(`${event} 개막 — 은하가 우리 ${pl}에 모였다`, `${event} opens — the galaxy gathers at our ${pl}`) : res === 'ok' ? L(`${event} 개막 — 무난한 출발`, `${event} opens — a steady start`) : L(`${event} 개막 — 미완성 경기장에 관중 불만`, `${event} opens — spectators grumble at an unfinished arena`);
  s.news.push({ season: s.season, text: head }); ctx.notify({ kind: 'news', title: L('개최국 소식', 'Host nation news'), body: head + ' ' + L('(우주 경기장에서 개막식 축사를 고르세요)', '(Choose the opening speech in the Space Stadium)') });
  void sendOps(sid);
}
/** 게임 자원 납부(공식 사절·경기장 등): 자원이 있으면 차감, 없으면 거절. */
async function payGame(sid: string, payId: string, cost: GameCost): Promise<void> {
  if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 게임 자원을 쓸 수 있습니다.', 'The game must be running to spend in-game resources.'));
  const req = ++link.reqCounter; let st = '';
  try { st = String((await terminalRequest(hostPayCommand(req, sid, payId, cost), 'LOGPAY', req)).kv.status ?? ''); } catch { st = ''; }
  if (st === 'applied' || st === 'duplicate') return;
  if (st === 'short') throw new Error(L('게임 자원이 모자랍니다.', 'Not enough in-game resources.'));
  throw new Error(L('게임이 응답하지 않습니다. 잠시 뒤 다시 해 주세요.', 'The game did not respond. Try again shortly.'));
}
const costText = (c: GameCost) => [c.energy ? L(`에너지 ${c.energy}`, `${c.energy} energy`) : '', c.alloys ? L(`합금 ${c.alloys}`, `${c.alloys} alloys`) : '', c.influence ? L(`영향력 ${c.influence}`, `${c.influence} influence`) : '', c.consumer_goods ? L(`소비재 ${c.consumer_goods}`, `${c.consumer_goods} consumer goods`) : ''].filter(Boolean).join(' · ');
/** 화면용: 유치 경쟁(표 예상·로비) · 투표 결과 · 개최 준비 · 개막식. */
function hostView(s: LogSave, ev: HostEvent) {
  const o = s.oly, wb = natOf(s).wbid;
  const c = ev === 'oly' ? (o.year && (o.bidOpen || o.weBid || o.host !== undefined) ? { year: o.year, open: !!o.bidOpen, weBid: !!o.weBid, host: o.host, hostName: o.hostName, hb: hbOf(o) } : null)
    : (wb ? { year: wb.year, open: !!wb.open, weBid: !!wb.weBid, host: wb.host, hostName: wb.hostName, hb: hbOf(wb) } : null);
  if (!c) return null; const hb = c.hb, nm = (idx: number) => (idx === -1 ? ctx.playerName || L('우리 제국', 'Our empire') : o.members.find((x) => x.idx === idx)?.name ?? '?');
  const rivals = hb.rivals ?? [], pr = predict(o.members.map((v) => ({ idx: v.idx, weight: v.weight, like: relLike(v.idx) })), rivals, hb.lobby ?? {});
  const sum = (k: string) => pr.filter((x) => x.lean === k).reduce((a, x) => a + x.weight, 0);
  const won = c.host === -1, prep = won && hb.prep ? hb.prep : null, sid = ctx.curSaveId || '';
  return { ev, year: c.year, open: c.open, weBid: c.weBid, decided: c.host !== undefined, won, hostName: c.hostName ?? null,
    rivals: rivals.map(nm), predict: { us: sum('us'), swing: sum('swing'), them: sum('them') },
    voters: pr.map((x) => ({ idx: x.idx, name: nm(x.idx), weight: x.weight, lean: x.lean, rival: rivals.includes(x.idx), used: hb.used?.[String(x.idx)] ?? [], caught: (hb.caught ?? []).includes(x.idx), gift: lobbyCost('gift', x.weight), bribe: lobbyCost('bribe', x.weight) })).sort((a, b) => b.weight - a.weight),
    envoy: costText(HOST.envoy.cost), rounds: (hb.rounds ?? []).map((r) => Object.entries(r).map(([k, v]) => ({ name: nm(Number(k)), us: Number(k) === -1, votes: Math.round(Number(v)) })).sort((a, b) => b.votes - a.votes)),
    prep: prep ? { planet: prep.planet ?? null, level: prep.level, planets: [...new Set(planetSlots(sid))], projects: PREP.map((q) => ({ id: q.id, name: L(q.ko, q.en), cost: costText(q.game), gain: q.gain, done: prep.done.includes(q.id) })), locked: !!hb.result } : null,
    result: hb.result ?? null, ceremony: hb.ceremony ?? null, bonus: prep ? homeBonus(prep.level) : 0,
    council: c.open && c.weBid && o.members.length >= 2, voteScene: (hb.rounds ?? []).length > 0, speech: Math.round(Object.values(hb.speech ?? {}).reduce((n, x) => n + x, 0) * 100) / 100 };
}
/** 월즈 유치(6): 월즈가 열리는 해 1~6월 신청, 7월 은하 공동체 투표(올림픽 투표와 같은 계산). 전쟁 중이면 신청 불가, 전쟁 중인 나라는 후보에서 빠짐. 성공 → 민심 + · 영향력 + · 표 준 나라 호감 +. */
function worldsBidMonth(sid: string, s: LogSave, y: number, m: number): void {
  const n = natOf(s); if (!worldsDue(s) || s.season !== y) return;
  if (!n.wbid || n.wbid.year !== y) n.wbid = { year: y };
  const b = n.wbid; if (b.host !== undefined) return;
  if (m >= 1 && m < 7 && !b.open) { hbOf(b).rivals = pickRivals(sid, `worlds:${y}`, s.oly.members); b.open = true; ctx.notify({ kind: 'office', title: L('은하 월드 챔피언십 유치 신청', 'Worlds hosting bids'), body: L(`${y}년 월즈 개최지 유치 신청이 열렸습니다(우주 경기장 › 나라와 경기).`, `Bids to host the ${y} Worlds are open (Stadium › Nation & league).`) }); }
  if (m >= 7) {
    const r = seeded(hashSeed(`${sid}:wbid:${y}`)), atWar = (idx: number) => !!terminal.items.find((c) => c.idx === idx)?.em?.war, pool = s.oly.members.slice().sort((a, c) => c.weight - a.weight).filter((x) => !atWar(x.idx));
    const hb = hbOf(b), fixed = (hb.rivals ?? []).filter((x) => !atWar(x));
    const bidders = fixed.length ? fixed.slice() : pool.filter(() => r() < 0.35).slice(0, 3).map((x) => x.idx); if (b.weBid) { bidders.push(-1); bribeCheck(sid, s, hb, `worlds:${y}`, L('은하 월드 챔피언십', 'Galactic Worlds')); } if (!bidders.length && pool[0]) bidders.push(pool[0].idx); if (!bidders.length) bidders.push(-1);
    const voters = s.oly.members.map((v) => ({ idx: v.idx, weight: v.weight, like: (bd: number) => (bd !== -1 ? 0 : relLike(v.idx) + (hb.lobby?.[String(v.idx)] ?? 0)) })); // 동맹·연방 호감은 올림픽과 같게(2026-10-31)
    const res = hostVote(bidders, voters, r); b.host = res.host; b.open = false; hb.rounds = res.rounds as unknown as Array<Record<string, number>>; hb.ballots = res.ballots as unknown as Record<string, number>; if (b.weBid) ctx.notify({ kind: 'office', title: L('월즈 개최지 투표', 'Worlds host vote'), body: L('은하 공동체가 월즈 개최지를 정했습니다. 우주 경기장 › 월즈의 유치 칸에서 「투표 장면 보기」로 회의장 투표를 볼 수 있습니다.', 'The Galactic Community has chosen the Worlds host. Watch the vote in the council chamber: Space stadium › Worlds › "Watch the vote".'), action: L('확인', 'OK') }); if (b.weBid && res.host === -1) hostWonPrep(sid, hb, L('은하 월드 챔피언십', 'Galactic Worlds')); b.hostName = res.host === -1 ? (ctx.playerName || L('우리 제국', 'Our empire')) : s.oly.members.find((x) => x.idx === res.host)?.name ?? '?';
    if (b.weBid) { if (res.host === -1) { natMood(s, NAT.host.mood, L('월즈 유치 성공', 'Won the Worlds hosting bid')); queueOps(s, [{ t: 'influence', n: NAT.host.influence }], 'worlds host influence'); hostWon(sid, s, res.ballots, L('은하 월드 챔피언십', 'Galactic World Championship')); } else natMood(s, NAT.host.failMood, L('월즈 유치 실패', 'Lost the Worlds hosting bid')); }
    chronNoteWorld(L(`${y} 은하 월드 챔피언십 개최지: ${b.hostName}`, `${y} Galactic World Championship host: ${b.hostName}`), true);
  }
}
/** 매달: 열기 식음 · 축제 달 · 기업 국가 브랜드 수입(분기) · 월즈 유치 · 게임에 수정자 보내기. */
function natMonth(sid: string, s: LogSave, y: number, m: number, newQuarter: boolean): void {
  const n = natOf(s), ym = `${y}.${m}`; if (n.month === ym) return; n.month = ym;
  n.heat = heatDecay(n.heat); if (s.sponsor && !isGestalt()) heatUp(s, NAT.heat.sponsorMonthly * s.sponsor.tier);
  if (n.festival && n.festival > 0) { n.festival--; natMood(s, 1, L('월즈 우승 축제', 'Worlds victory festival')); }
  if (newQuarter && isCorp() && s.sponsor) { const v = Math.round(n.heat * s.sponsor.tier * NAT.corp.brand); if (v > 0) earnToVault(sid, v, 'LoG brand value'); }
  worldsBidMonth(sid, s, y, m);
  void sendOps(sid);
}
/** 대표팀: 플레이어가 고른 선수(자리마다), 비어 있으면 그 자리 최고 선수. */
function nationalLineup(s: LogSave): Record<Role, Player> {
  const out = {} as Record<Role, Player>, pool = Object.values(s.players).filter((p) => p.club);
  for (const role of ROLES) { const pick = s.oly.national?.[role]; out[role] = (pick && s.players[pick]) || pool.filter((p) => p.role === role).sort((a, b) => overall(b) - overall(a))[0] || newPlayer(`n${role}`, role, role, Math.random); }
  return out;
}

// ---------------- 화면 상태 ----------------
/** 그림(레전드 초상화·무기 아이콘)은 나중에 ui/log/ 에 넣음 — 있는 파일만 화면에 알려 줌(없는 그림을 매번 찾지 않게). */
const artSeen = new Map<string, boolean>();
/** 초상화 고르기 후보: 예비 그림(있는 것만) + 내 그림 폴더(ui/log/legends/custom/ 의 그림 파일). */
function portraitChoices(): string[] {
  const out = EXTRA_PORTRAITS.map((k) => art(`log/legends/extra/${k}.png`)).filter(Boolean);
  try { for (const f of fs.readdirSync(path.join(__dirname, '..', '..', 'ui', 'log', 'legends', 'custom'))) if (/\.(png|jpe?g|webp)$/i.test(f)) out.push(`log/legends/custom/${f}`); } catch { /* 폴더 없음 */ }
  return out;
}
const art = (rel: string): string => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : ''; };
const wname = (id: string) => { const w = weaponById(id); return w ? L(w.ko, w.en) : id; };
function pview(s: LogSave, p: Player) {
  const e = ROSTER.find((x) => x.rid === p.rid), t = p.club ? s.teams.find((x) => x.id === p.club) : undefined;
  const sp = s.sponsor;
  return { id: p.id, name: p.name, real: p.real ? L(p.real.ko, p.real.en) : '', legend: p.legend, home: !!p.home, epithet: p.home ? L(...p.home.epithet) : p.legend && e?.legend ? L(e.legend.ko, e.legend.en) : '', portrait: p.home ? art(p.home.portrait) : p.legend ? art(`log/legends/${p.rid}.png`) : '', feats: p.feats ?? { titles: 0, medals: 0, mvps: 0 }, fostered: sp?.foster === p.id, canFoster: !!sp && p.club === sp.team && !sp.foster && canFoster(p), age: p.age, role: p.role, st: { phys: Math.round(p.st.phys), judg: Math.round(p.st.judg), team: Math.round(p.st.team), ment: Math.round(p.st.ment) }, ovr: overall(p), pot: p.pot,
    traits: p.traits.map((k) => ({ k, name: L(TRAITS[k][0], TRAITS[k][1]), desc: L(TRAITS[k][2], TRAITS[k][3]) })), pool: Object.entries(p.pool).sort((a, b) => b[1] - a[1]).map(([w, v]) => ({ id: w, name: wname(w), v, icon: art(`log/weapons/${w}.png`) })),
    salary: p.salary, fee: signingFee(p), until: p.until, club: t ? teamName(s, t) : '', form: p.form, scouted: !!s.sponsor?.scout.includes(p.id) };
}
export function logView() {
  const sid = ctx.curSaveId; if (!sid) return { sid: '' };
  const s = saveOf(sid), st = standings(s.rounds, 8), order = rankOrder(st), sp = s.sponsor, spT = sponsoredTeam(s);
  const nextRound = s.done < 8 ? s.done : null;
  return {
    sid, season: s.season, balance: vaultBalance(sid), roundMonths: ROUND_MONTHS, done: s.done,
    teams: s.teams.map((t, i) => ({ i, id: t.id, name: teamName(s, t), tag: teamTag(s, t), logo: logoOf(s, t), baseLogo: t.logo ?? null, base: baseName(t), planet: t.planet, mine: sp?.team === t.id, rating: Math.round(ratingOf(s, i)), budget: t.budget, payroll: payroll(s, t), strat: stratOf(s, t), roster: t.players.map((id) => s.players[id]).filter(Boolean).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || overall(b) - overall(a)).map((p) => pview(s, p)) })),
    standings: order.map((i) => ({ i, logo: logoOf(s, s.teams[i]), name: teamName(s, s.teams[i]), ...st[i], mine: sp?.team === s.teams[i].id })),
    rounds: s.rounds.map((rd, ri) => rd.map((m, mi) => ({ ri, mi, la: logoOf(s, s.teams[m.a]), lb: logoOf(s, s.teams[m.b]), a: teamName(s, s.teams[m.a]), b: teamName(s, s.teams[m.b]), ai: m.a, bi: m.b, winner: m.winner ?? null, kills: m.kills ?? null, mvp: m.mvp ?? '', odds: m.winner === undefined ? (() => { const p = winChance(ratingOf(s, m.a), ratingOf(s, m.b)); return [odds(p), odds(1 - p)]; })() : null, mine: !!sp && (s.teams[m.a].id === sp.team || s.teams[m.b].id === sp.team) }))),
    nextRound, history: s.history.slice(-10).reverse(), toto: s.toto.filter((t) => !t.intl).slice(-20).reverse(), news: s.news.slice(-8).reverse().map((n) => n.text),
    logoParts: { emblems: EMBLEMS.map(([id, ko, en]) => ({ id, name: L(ko, en), art: art(`log/emblems/${id}.png`) })), shapes: LOGO_SHAPES.map(([id, ko, en]) => ({ id, name: L(ko, en) })), patterns: LOGO_PATTERNS.map(([id, ko, en]) => ({ id, name: L(ko, en) })), colors: LOGO_COLORS },
    tiers: SPONSOR.tiers.map((x, i) => ({ tier: i + 1, fee: x.fee, share: x.share })),
    meta: s.meta ? { patch: s.meta.patch, released: s.meta.released.length, total: WEAPONS.length, notes: s.meta.notes.slice(-3).reverse().map((n) => ({ patch: n.patch, season: n.season, lines: n.lines.map((x) => L(...x)) })), top: Object.entries(s.meta.stats).sort((a, b) => b[1].picks + b[1].bans - (a[1].picks + a[1].bans)).slice(0, 8).map(([w, st]) => ({ name: wname(w), picks: st.picks, bans: st.bans, win: st.picks ? Math.round((st.wins / st.picks) * 100) : null })), games: s.meta.games, globalBan: s.meta.globalBan && s.meta.globalBan.season === s.season && s.meta.globalBan.round >= s.done ? { name: wname(s.meta.globalBan.weapon), round: s.meta.globalBan.round + 1 } : null, released_ids: s.meta.released } : null,
    mission: sp?.mission ? { text: missionText(sp.mission), reward: sp.mission.reward, season: sp.mission.season, prog: sp.mission.prog, kind: sp.mission.kind, n: sp.mission.n, result: sp.mission.result ?? null } : null,
    gear: spT ? (Object.keys(GEAR) as GearSlot[]).map((k) => ({ slot: k, name: L(...GEAR[k]), cur: spT.gear?.[k] && spT.gear[k]!.until >= s.season ? { grade: spT.gear[k]!.grade, gradeName: L(GEAR_GRADES[spT.gear[k]!.grade].ko, GEAR_GRADES[spT.gear[k]!.grade].en), until: spT.gear[k]!.until } : null })) : null, gearGrades: GEAR_GRADES.map((g, i) => ({ i, name: L(g.ko, g.en), cost: g.cost, bonus: g.bonus })), gearBonus: spT ? gearBonus(spT.gear, s.season) : 0,
    allstar: s.allstar ? (() => { const al = s.allstar!, ru = ALLSTAR_RULES.find((x) => x.id === al.rule)!; return { season: al.season, rule: L(ru.ko, ru.en), desc: L(ru.descKo, ru.descEn), a: al.defs[0].name, b: al.defs[1].name, winner: al.winner, kills: al.kills, mvp: al.mvp }; })() : null,
    foster: { fee: FOSTER.fee, maxAge: FOSTER.maxAge, minPot: FOSTER.minPot, legendOvr: FOSTER.legendOvr, current: sp?.foster && s.players[sp.foster] ? pview(s, s.players[sp.foster]) : null },
    portraitPick: s.portraitPick && s.players[s.portraitPick] ? pview(s, s.players[s.portraitPick]) : null, homeLegends: Object.values(s.players).filter((p) => p.home).map((p) => pview(s, p)), portraitChoices: portraitChoices(),
    sponsor: sp && spT ? { team: sp.team, teamName: teamName(s, spT), base: baseName(spT), tier: sp.tier, label: sp.label, name: sp.name, since: sp.since, req: { strat: sp.req.strat ?? null, focus: sp.req.focus ?? null, practice: sp.req.practice }, scout: sp.scout, next: sp.next ? ('cancel' in sp.next ? { cancel: true } : { team: sp.next.team, teamName: teamName(s, s.teams.find((t) => t.id === (sp.next as { team: string }).team)!), tier: sp.next.tier }) : null,
      can: { logo: tierCan(sp.tier, 'logo'), request: tierCan(sp.tier, 'request'), scout: tierCan(sp.tier, 'scout'), rename: tierCan(sp.tier, 'rename'), draft: tierCan(sp.tier, 'draft') } } : null,
    free: s.free.map((id) => s.players[id]).filter(Boolean).sort((a, b) => overall(b) - overall(a)).slice(0, 40).map((p) => pview(s, p)),
    weapons: WEAPONS.map((w) => ({ id: w.id, role: w.role, k: w.kind, name: L(w.ko, w.en), kind: L(...KIND_NAME[w.kind]), out: !!s.meta?.released.includes(w.id), adj: s.meta?.adj[w.id] ?? null, icon: art(`log/weapons/${w.id}.png`) })),
    worlds: worldsView(s),
    oly: { hosting: hostView(s, 'oly'), active: !!s.oly.year && s.oly.members.length > 0, year: s.oly.year ?? null, bidOpen: !!s.oly.bidOpen, weBid: !!s.oly.weBid, host: s.oly.hostName ?? null, fee: OLYMPIC.bidFee, national: s.oly.national ?? {}, result: s.oly.result ? olyResultView(s.oly.result) : null, intlToto: s.toto.filter((t) => t.intl).slice(-12).map((t) => ({ intl: t.intl, n: t.picks.length, stake: t.stake, odds: t.odds, settled: !!t.settled, won: !!t.won })), medals: Object.entries(s.oly.medals).sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1] || y[1][2] - x[1][2]).map(([n, m]) => ({ n, g: m[0], s: m[1], b: m[2] })),
      candidates: ROLES.map((role) => ({ role, players: Object.values(s.players).filter((p) => p.club && p.role === role).sort((a, b) => overall(b) - overall(a)).slice(0, 12).map((p) => pview(s, p)) })) },
    draft: draftState ? draftView() : null, watching: watch ? { title: watch.title } : null,
    nat: natView(s),
  };
}
/** 나라와 경기(LoG ↔ 나라 연동) 화면 자료. */
const atWarNow = (): boolean => gameState.last?.sid === ctx.curSaveId && (gameState.last?.wars?.length ?? 0) > 0;
function natView(s: LogSave) {
  const n = natOf(s), nameOfIdx = (idx: number) => s.oly.members.find((m) => m.idx === idx)?.name ?? terminal.items.find((c) => c.idx === idx)?.name ?? `#${idx}`, year = ymd(ctx.gameDate || '')?.y ?? s.season;
  const sc = n.scandal && n.scandal.state === 'open' && !n.scandal.done ? n.scandal : null, tr = n.transfer && s.players[n.transfer.pid] ? n.transfer : null;
  return {
    heat: Math.round(n.heat), factor: Math.round(heatFactor(n.heat) * 100) / 100, festival: n.festival ?? 0, gestalt: isGestalt(), corp: isCorp(), spiritualist: hasEthic('spiritualist'), militarist: hasEthic('militarist'), pacifist: hasEthic('pacifist'),
    corpFee: NAT.corp.fee, corpShare: NAT.corp.share, home: n.homeNow ?? null, lastStreak: Object.entries(n.lastStreak).filter(([, v]) => v > 0).map(([planet, v]) => ({ planet, n: v })),
    rivals: Object.entries(n.meet).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ idx: Number(k), name: nameOfIdx(Number(k)), meet: v, rival: v >= NAT.rivalMeetings, gameRival: !!terminal.items.find((c) => c.idx === Number(k))?.em?.rival, war: !!terminal.items.find((c) => c.idx === Number(k))?.em?.war })),
    warPolicy: n.warPolicy, atWar: atWarNow(), forfeits: n.forfeits ?? 0,
    wbid: n.wbid ? { year: n.wbid.year, open: !!n.wbid.open, weBid: !!n.wbid.weBid, host: n.wbid.hostName ?? null } : null, bidFee: NAT.host.bidFee,
    scandal: sc ? { team: teamName(s, s.teams.find((t) => t.id === sc.team) ?? s.teams[0]), season: sc.season, penalty: NAT.scandal.penalty } : null,
    transfer: tr ? { player: s.players[tr.pid].name, nation: tr.nation, fee: NAT.transfer.keepFee } : null,
    legends: Object.values(s.players).filter((p) => p.legend && p.club && s.teams.some((t) => t.id === p.club)).sort((a, b) => overall(b) - overall(a)).slice(0, 8).map((p) => ({ id: p.id, name: p.name, club: teamName(s, s.teams.find((t) => t.id === p.club)!) })), invited: n.invited === year,
    sports: n.sports.slice().reverse().map((a) => ({ date: a.date, head: L(...a.head), body: L(...a.body) })), pendingOps: n.ops.length,
  };
}
let win: BrowserWindow | null = null;
function push(): void { if (win && !win.isDestroyed()) win.webContents.send('logState', logView()); }
export function openLog(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 열 수 있습니다.', 'Load a save first.') };
  try { ensureNames(ctx.curSaveId, saveOf(ctx.curSaveId)); } catch { /* 본명은 나중에 */ }
  artSeen.clear(); // 창을 열 때마다 그림 폴더를 다시 봄(그림을 넣은 뒤 다시 열면 보임)
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#060b12', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'log.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; stopWatch(); });
  return { ok: true };
}

// ---------------- 직접 밴픽(메인 스폰서, 후원 구단 경기) ----------------
let draftState: { sid: string; round: number; match: number; side: 0 | 1; d: Draft } | null = null;
function draftView() {
  const ds = draftState!, s = saveOf(ds.sid), m = s.rounds[ds.round][ds.match], us = s.teams[ds.side === 0 ? m.a : m.b], them = s.teams[ds.side === 0 ? m.b : m.a];
  const o = DRAFT_ORDER[ds.d.step];
  const pl = (t: Team) => { const lu = lineupOf(s, t); return ROLES.map((role) => ({ role, name: lu[role]?.name ?? '', pool: Object.entries(lu[role]?.pool ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w, v]) => ({ id: w, v })) })); };
  return { pool: ds.d.pool ?? null, round: ds.round, match: ds.match, side: ds.side, us: teamName(s, us), them: teamName(s, them), step: ds.d.step, turn: o ? { side: o.side, kind: o.kind, mine: o.side === ds.side } : null, bans: ds.d.bans, picks: ds.d.picks, done: draftDone(ds.d), ourPlayers: pl(us), theirPlayers: pl(them) };
}
function aiDraftTurns(): void {
  const ds = draftState; if (!ds) return; const s = saveOf(ds.sid), m = s.rounds[ds.round][ds.match];
  const mineT = s.teams[ds.side === 0 ? m.a : m.b], theirT = s.teams[ds.side === 0 ? m.b : m.a], r = seeded(m.seed ^ 0x5bd1e995);
  let g = 0; while (!draftDone(ds.d) && DRAFT_ORDER[ds.d.step].side !== ds.side && g++ < 20) { const mv = draftAi(ds.d, lineupOf(s, theirT), lineupOf(s, mineT), r); if (!draftMove(ds.d, mv.weapon, mv.role)) ds.d.step++; }
}

// ---------------- 관람(실시간) ----------------
let watch: { logos: Array<Logo | null>; title: string; g: ReturnType<typeof newGame>; timer: NodeJS.Timeout | null; speed: number; names: string[]; weapons: string[]; icons: string[]; roles: string[]; conds: Array<number | null>; rule: string; teams: [string, string]; ev: number; ults: string[] } | null = null;
function stopWatch(): void { if (watch?.timer) clearInterval(watch.timer); watch = null; }
function startWatch(title: string, defs: [TeamDef, TeamDef], seed: number, rules: Rules = {}, ruleName = ''): void {
  stopWatch(); const g = newGame(defs[0], defs[1], seed, rules);
  const tl = (id: string) => { const sv = ctx.curSaveId ? saveOf(ctx.curSaveId) : null, t = sv?.teams.find((x) => x.id === id); return sv && t ? logoOf(sv, t) : null; };
  watch = { logos: [tl(defs[0].id), tl(defs[1].id)], title, g, timer: null, speed: 1, names: g.heroes.map((h) => h.name), weapons: g.heroes.map((h) => (h.weapon ? wname(h.weapon) : '')), icons: g.heroes.map((h) => (h.weapon ? art(`log/weapons/${h.weapon}.png`) : '')), roles: g.heroes.map((h) => h.role), conds: [...defs[0].players, ...defs[1].players].map((p) => (p.cond ?? null)), rule: ruleName, teams: [defs[0].name, defs[1].name], ev: 0, ults: g.heroes.map((h) => ((rules.v ?? ENGINE) >= 4 && ULT_NAMES[h.role]?.[h.uk] ? L(...ULT_NAMES[h.role][h.uk]) : '')) };
  sendWatch(true); setSpeed(1);
}
function setSpeed(n: number): void {
  if (!watch) return; if (watch.timer) clearInterval(watch.timer); watch.timer = null; watch.speed = n;
  if (n === 0) { while (!watch.g.done) tick(watch.g); sendWatch(); return; }
  watch.timer = setInterval(() => { if (!watch) return; tick(watch.g); sendWatch(); if (watch.g.done && watch.timer) { clearInterval(watch.timer); watch.timer = null; } }, Math.round(200 / n)); // 1배 = 초당 5틱(약 5분)
}
function evText(e: { kind: string; side: Side; who?: string; victim?: string; lane?: number }, teams: [string, string]): string {
  const T = teams[e.side], lane = e.lane === undefined ? '' : L(['위', '가운데', '아래'][e.lane], ['top', 'mid', 'bottom'][e.lane]);
  switch (e.kind) {
    case 'start': return L('경기 시작! 증강현실 전장이 펼쳐집니다.', 'The match begins! The AR battlefield unfolds.');
    case 'first_blood': return L(`퍼스트 블러드! ${e.who ?? T}이(가) ${e.victim}을(를) 쓰러뜨립니다.`, `First blood! ${e.who ?? T} takes down ${e.victim}.`);
    case 'kill': return L(`${e.who ?? T}, ${e.victim} 처치.`, `${e.who ?? T} takes out ${e.victim}.`);
    case 'ace': return L(`에이스! ${T}이(가) 상대 다섯 명을 모두 쓰러뜨렸습니다!`, `Ace! ${T} wipes out all five!`);
    case 'tower': return L(`${T}, ${lane} 길 방어탑 파괴.`, `${T} destroys a ${lane} tower.`);
    case 'inhib': return L(`${T}, ${lane} 길을 완전히 열었습니다! 핵이 위험합니다.`, `${T} breaks open the ${lane} lane! The core is exposed.`);
    case 'ult': { const i = watch ? watch.names.indexOf(e.who ?? '') : -1, u = i >= 0 ? watch!.ults[i] : ''; return u ? L(`${e.who}의 궁극기 「${u}」!`, `${e.who} unleashes “${u}”!`) : ''; }
    case 'boss': return L(`${T}이(가) 성운 거신을 쓰러뜨렸습니다! 거대 병사가 진격합니다.`, `${T} topple the Nebula Colossus! Giant minions march.`);
    case 'objective': return L(`${T}이(가) 심연 수호자를 잡았습니다!`, `${T} slays the Abyssal Warden!`);
    case 'core': return L(`핵 파괴! ${T} 승리!`, `Core destroyed! ${T} wins!`);
  }
  return '';
}
function sendWatch(first = false): void {
  if (!watch || !win || win.isDestroyed()) return; const g = watch.g, fresh = g.events.slice(watch.ev).map((e) => ({ e, txt: evText(e, watch!.teams) })).filter((x) => x.txt), evs = fresh.map(({ e }) => ({ kind: e.kind, side: e.side, who: e.who ?? '', victim: e.victim ?? '', u: e.u ?? '' })), news = fresh.map((x) => x.txt); watch.ev = g.events.length; // evs: 관람 화면 연출(배너·소리)용
  win.webContents.send('logFrame', { ...(first ? { roster: { logos: watch.logos, emblemArt: EMBLEMS.map(([id]) => art(`log/emblems/${id}.png`)), names: watch.names, weapons: watch.weapons, icons: watch.icons, roles: watch.roles, ults: watch.ults, conds: watch.conds, condNames: COND_NAMES.map((c) => L(...c)), rule: watch.rule, teams: watch.teams, title: watch.title, mapArt: art('log/map.png'), towerHp: 100, coreHp: watch.g.rules.coreHp ?? 160, objHp: 60, map: { lanes: [0, 1, 2].map((l) => [0, 0.25, 0.5, 0.75, 1].map((p) => lanePos(l as 0 | 1 | 2, p))), towers: [0, 1].flatMap((sd) => [0, 1, 2].flatMap((l) => [0, 1].map((i) => towerPos(sd as Side, l as 0 | 1 | 2, i as 0 | 1)))), obj: OBJ, boss: BOSS, camps: CAMPS.map((c) => [c[0], c[1], c[2]]) } } } : {}), f: frame(g), news, evs, done: g.done, winner: g.winner ?? null, speed: watch.speed, stats: g.done ? g.heroes.map((h) => ({ name: h.name, side: h.side, k: h.kills, d: h.deaths, lv: h.lv })) : null });
}


// ---------------- 비서가 아는 LoG 기록(2026-10-31 사용자: 비서가 리그 경기 결과 같은 것도 알아야 함) ----------------
/** 비서 프롬프트용 사실 줄(영어). 공개된 결과만(월즈·올림픽 단계 공개 규칙을 따름). 게임 명령·LLM 없음. */
export function logSecretaryFacts(sid: string): string[] {
  if (!sid || sid !== ctx.curSaveId) return [];
  const v = logView() as any; if (!v.sid) return []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: string[] = [];
  const rnds = (v.rounds ?? []) as Array<Array<{ a: string; b: string; winner: 0 | 1 | null; kills: [number, number] | null; mvp: string; mine: boolean }>>;
  const played = rnds.map((rd, ri) => ({ ri, rd })).filter((x) => x.rd.length && x.rd.every((m) => m.winner !== null));
  out.push(`Legend of Galaxy league, season ${v.season}: ${v.done}/8 rounds played${v.nextRound !== null && v.nextRound !== undefined ? ` (next is round ${v.nextRound + 1}, one round per month)` : ' (season finished)'}.`);
  const st = (v.standings ?? []) as Array<{ name: string; w: number; l: number; k: number; d: number; mine: boolean }>;
  if (st.length) out.push('Standings: ' + st.map((t, i) => `${i + 1}. ${t.name}${t.mine ? ' (our sponsored club)' : ''} ${t.w}-${t.l}, kills ${t.k}/${t.d}`).join('; '));
  const res = (m: { a: string; b: string; winner: 0 | 1 | null; kills: [number, number] | null; mvp: string }) => { const w = m.winner === 0 ? m.a : m.b, l = m.winner === 0 ? m.b : m.a, k = m.kills ? (m.winner === 0 ? m.kills : [m.kills[1], m.kills[0]]) : null; return `${w} beat ${l}${k ? ` (kills ${k[0]}-${k[1]})` : ''}${m.mvp ? `, MVP ${m.mvp}` : ''}`; };
  for (const { ri, rd } of played.slice(-2)) out.push(ri === 7 ? `Season final: ${res(rd[0])}${rd[1] ? `; third-place match: ${res(rd[1])}` : ''}` : `Round ${ri + 1} results: ` + rd.map(res).join('; '));
  const mine = played.flatMap(({ ri, rd }) => rd.filter((m) => m.mine).map((m) => `R${ri + 1}: ${res(m)}`));
  if (mine.length) out.push('Our sponsored club\'s matches this season: ' + mine.join('; '));
  const nx = v.nextRound !== null && v.nextRound !== undefined ? rnds[v.nextRound] : null;
  if (nx && nx.length) out.push(v.nextRound === 7 ? `Upcoming final: ${nx[0].a} vs ${nx[0].b}${nx[1] ? `; third-place match: ${nx[1].a} vs ${nx[1].b}` : ''}` : `Round ${v.nextRound + 1} fixtures: ` + nx.map((m) => `${m.a} vs ${m.b}`).join('; '));
  const sp = v.sponsor; if (sp) out.push(`The ruler sponsors ${sp.teamName} (tier ${sp.tier}, since season ${sp.since}).`); else out.push('The ruler sponsors no club.');
  if (v.mission) out.push(`Sponsor mission (season ${v.mission.season}): ${v.mission.text}${v.mission.result === true ? ' — achieved' : v.mission.result === false ? ' — failed' : ' — in progress'}.`);
  const hist = (v.history ?? []) as Array<{ season: number; champ: string; runner: string }>;
  if (hist.length) out.push('Past champions: ' + hist.slice(0, 4).map((h) => `season ${h.season} ${h.champ} (runner-up ${h.runner})`).join('; '));
  const W = v.worlds; if (W?.last) { const L0 = W.last, nm = (i: number) => L0.teams[i]?.name ?? '?';
    out.push(`Galactic Worlds ${L0.year}: ${L0.done ? `finished — champion ${nm(L0.champion)}, runner-up ${nm(L0.runner)}` : `in progress (stage ${L0.step}/${L0.steps.length} revealed${L0.next ? `, next: ${L0.next.stage}` : ''})`}.`);
    const ours = (L0.series as Array<{ a: number; b: number; winner: number; stage: string; score: number[] }>).filter((x) => L0.teams[x.a]?.ours || L0.teams[x.b]?.ours).slice(-6);
    if (ours.length) out.push('Our clubs at the Worlds: ' + ours.map((x) => `${x.stage} ${nm(x.a)} ${x.score[0]}-${x.score[1]} ${nm(x.b)}`).join('; ')); }
  if (W?.next) out.push(`Next Worlds year: ${W.next}.`);
  const O = v.oly; if (O?.year) { const r = O.result; out.push(`Galactic Olympics ${O.year}${O.host ? `, host ${O.host}` : ''}${r ? (r.done ? `: gold ${r.gold ?? '?'}, silver ${r.silver ?? '?'}, bronze ${r.bronze ?? '?'}` : ` in progress (step ${r.step}/3)`) : ''}.`); }
  for (const H of ([O?.hosting, W?.hosting].filter(Boolean) as any[]).filter((h) => h.year >= v.season)) { const ev = H.ev === 'oly' ? 'Olympics' : 'Worlds';
    out.push(`${ev} ${H.year} hosting: ${H.decided ? (H.won ? `we won the bid${H.prep ? `, readiness ${H.prep.level}/100${H.prep.planet ? ` on ${H.prep.planet}` : ''}` : ''}${H.result ? `, result ${H.result}` : ''}` : `host is ${H.hostName ?? '?'}`) : H.weBid ? `we are bidding; forecast for us ${H.predict.us}, swing ${H.predict.swing}, against ${H.predict.them} votes; rivals ${H.rivals.join(', ') || 'none'}` : 'bid window open, we have not bid'}.`); }
  const toto = (v.toto ?? []) as Array<{ settled: boolean; won: boolean; stake: number; odds: number }>; const open = toto.filter((t) => !t.settled).length, won = toto.filter((t) => t.settled && t.won).length, lost = toto.filter((t) => t.settled && !t.won).length;
  if (toto.length) out.push(`Sports Toto slips: ${open} open, ${won} won, ${lost} lost (recent).`);
  const news = (v.news ?? []) as string[]; if (news.length) out.push('Recent league news: ' + news.slice(0, 4).join(' | '));
  return out;
}
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const asTier = (v: unknown): Tier | null => (v === 1 || v === 2 || v === 3 ? v : null);
// ---------------- 시나리오 「화합 대회」(2026-11-06) ----------------
// 은하 공동체가 없는 시나리오(회랑의 삼파전)에서는 올림픽·월즈가 저절로 열리지 않는다. 우리가 초청해 연다(개최국 = 우리, 투표 없음).
// 초청·수락 판정: src/scenario-games.ts, src/features/scenario-games-app.ts. 여기서는 대회 날짜·참가국·개최 준비만 정한다(경기 계산은 본편 그대로).
export interface ScnGuest { idx: number; name: string; weight: number }
/** 지금 준비 중인 화합 대회(없으면 null). */
export function scnGamesBusy(sid: string): { ev: HostEvent; year: number } | null {
  const s = saveOf(sid), c = s.scn; if (!c) return null;
  if (c.oly !== undefined) return { ev: 'oly', year: c.oly };
  if (c.worlds !== undefined && c.worlds >= s.season) return { ev: 'worlds', year: c.worlds };
  return null;
}
/** 화합 대회 열기: 참가국 = 초청을 받아들인 나라, 우리가 개최국. 개최 준비는 우주 경기장의 개최 칸에서(본편과 같음). */
export function scnHostGames(sid: string, ev: HostEvent, year: number, guests: ScnGuest[]): void {
  const s = saveOf(sid), us = ctx.playerName || L('우리 제국', 'Our empire'), c = (s.scn ??= {});
  const o = s.oly; o.members = guests.map((g) => ({ idx: g.idx, name: g.name, weight: g.weight }));
  const now = ymd(ctx.gameDate || '')?.y ?? s.season; if (!o.seenYear) o.seenYear = now;
  const title = ev === 'oly' ? L('은하 올림픽', 'Galactic Olympics') : L('은하 월드 챔피언십', 'Galactic Worlds');
  if (ev === 'oly') { c.oly = year; o.year = year; o.bidOpen = false; o.weBid = false; o.bidders = [-1]; o.host = -1; o.hostName = us; o.resultYear = undefined; o.result = undefined; o.hb = undefined; hostWonPrep(sid, hbOf(o), title); }
  else { c.worlds = year; const n = natOf(s); n.wbid = { year, open: false, weBid: false, host: -1, hostName: us }; hostWonPrep(sid, hbOf(n.wbid), title); }
  chronNoteWorld(L(`${year} ${title} — ${us} 주최, 초청국: ${guests.map((g) => g.name).join(', ') || '-'}`, `${year} ${title} — hosted by ${us}, guests: ${guests.map((g) => g.name).join(', ') || '-'}`), true);
  save(); push();
}
/** 게임 자원 납부(화합 대회 초청 비용) — 본편 납부와 같은 길. */
export const scnPayGame = (sid: string, payId: string, cost: GameCost): Promise<void> => payGame(sid, payId, cost);

export function registerLog(): void {
  councilHooks.debated = (key, moves) => { // 개최지 선정 회의의 설득 → 그 나라 호감(나라마다 상한, src/log-host.ts speechLike)
    const m = /^sllm_host_(oly|worlds)_(\d+)$/.exec(key), sid = ctx.curSaveId; if (!m || !sid) return; const s = saveOf(sid);
    const o = s.oly, b = natOf(s).wbid, c = m[1] === 'oly' ? (o.year === Number(m[2]) && o.bidOpen && o.weBid ? hbOf(o) : null) : (b && b.year === Number(m[2]) && b.open && b.weBid ? hbOf(b) : null); if (!c) return;
    let changed = false; for (const mv of moves) { if ((c.rivals ?? []).includes(mv.gi) || !o.members.some((x) => x.idx === mv.gi)) continue; if (speechLike(c, mv.gi, mv.delta)) changed = true; }
    if (changed) { save(); push(); }
  };
  registerSecFacts({ id: 'Legend of Galaxy', kw: ['레전드', '로그', 'log', 'legend of galaxy', '리그', 'league', '경기', 'match', '순위', 'standing', '우승', 'champion', '월즈', 'worlds', '올림픽', 'olympic', '토토', 'toto', '구단', 'club', '후원', 'sponsor', '선수', 'player', '시즌', 'season', '유치', 'host', '메달', 'medal', 'e스포츠', 'esport', '경기장', 'stadium'], facts: logSecretaryFacts }); // 비서가 아는 기록(2026-10-31)
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId || !snap.date) return; try { onMonth(snap.sid, snap.date); } catch (e) { logDiagnostic('warn', 'log.month_failed', { error: String((e as Error)?.message || e) }); } });
  const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: logView() });
  const ok = () => { save(); push(); return { ok: true, state: logView() }; };
  const mySponsor = (s: LogSave) => { if (!s.sponsor) throw new Error(L('후원하는 구단이 없습니다.', 'You are not sponsoring a club.')); return s.sponsor; };
  ipcMain.handle('logOpen', () => openLog());
  ipcMain.handle('logState', () => logView());
  ipcMain.handle('logClose', () => { if (win && !win.isDestroyed()) win.close(); return true; });
  /** 구단 후원: 처음이면 바로(후원금 금고에서). 같은 팀 등급 올리기는 차액만 내고 바로, 다른 팀·등급 내리기는 다음 시즌부터. */
  ipcMain.handle('logSponsor', (_e, a: { team?: unknown; tier?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), tier = asTier(a?.tier), t = s.teams.find((x) => x.id === String(a?.team));
      if (!t || !tier) throw new Error(L('구단과 후원 등급을 골라 주세요.', 'Choose a club and a sponsorship tier.'));
      if (isGestalt()) throw new Error(L('단일 의식 제국에는 국내 리그 구단이 없습니다(대표팀만).', 'A gestalt empire has no domestic league clubs (national team only).'));
      const fee = feeOf(tier), sp = s.sponsor;
      if (!sp) { if (!spendFromVault(sid, fee, 'LoG sponsorship')) throw new Error(L(`금고가 모자랍니다(후원금 ${fee}).`, `Not enough in the vault (fee ${fee}).`)); s.sponsor = { team: t.id, tier, label: '', name: '', since: s.season, req: { practice: {} }, scout: [] }; t.budget += fee; newMission(sid, s); return ok(); }
      if (sp.team === t.id && tier > sp.tier) { const diff = fee - feeOf(sp.tier); if (!spendFromVault(sid, diff, 'LoG sponsorship')) throw new Error(L(`금고가 모자랍니다(차액 ${diff}).`, `Not enough in the vault (difference ${diff}).`)); sp.tier = tier; sp.next = undefined; t.budget += diff; return ok(); }
      if (sp.team === t.id && tier === sp.tier) { sp.next = undefined; return ok(); }
      sp.next = { team: t.id, tier }; return ok(); } catch (e) { return err(e); }
  });
  /** 후원 그만두기(이번 시즌 끝까지는 유지 — 이미 낸 후원금). 다시 누르면 취소를 거둠. */
  ipcMain.handle('logSponsorCancel', () => {
    try { const sp = mySponsor(saveOf(need())); sp.next = sp.next && 'cancel' in sp.next ? undefined : { cancel: true }; return ok(); } catch (e) { return err(e); }
  });
  /** 후원명(1등급부터) · 팀 이름(메인 스폰서). 빈 칸이면 지움. */
  ipcMain.handle('logSponsorName', (_e, a: { label?: unknown; name?: unknown }) => {
    try { const sp = mySponsor(saveOf(need()));
      if (a?.label !== undefined) sp.label = cleanText(a.label, 24);
      if (a?.name !== undefined) { if (!tierCan(sp.tier, 'rename')) throw new Error(L('팀 이름은 메인 스폰서(3등급)만 바꿀 수 있습니다.', 'Only a main sponsor (tier 3) can rename the club.')); sp.name = cleanText(a.name, 40); }
      return ok(); } catch (e) { return err(e); }
  });
  /** 요청: 전략·훈련 방향·선수별 무기 연습(구단이 따름). null 이면 구단에 맡김. */
  ipcMain.handle('logSponsorRequest', (_e, a: { strat?: unknown; focus?: unknown; practice?: unknown }) => {
    try { const s = saveOf(need()), sp = mySponsor(s), t = sponsoredTeam(s)!;
      if (a?.strat === null) delete sp.req.strat; else if (a?.strat && typeof a.strat === 'object') { const x = a.strat as Record<string, unknown>, ag = Number(x.aggr), ob = Number(x.obj); if (Number.isFinite(ag) && Number.isFinite(ob)) sp.req.strat = { aggr: Math.max(-1, Math.min(1, ag)), obj: Math.max(0, Math.min(1, ob)) }; }
      if (a?.focus === null) delete sp.req.focus; else if (['phys', 'judg', 'team', 'ment', 'balanced'].includes(String(a?.focus))) sp.req.focus = String(a!.focus) as Focus;
      if (a?.practice && typeof a.practice === 'object') for (const [pid, w] of Object.entries(a.practice as Record<string, unknown>)) if (t.players.includes(pid)) { if (typeof w === 'string' && weaponById(w)) sp.req.practice[pid] = w; else delete sp.req.practice[pid]; }
      return ok(); } catch (e) { return err(e); }
  });
  /** 영입 추천(주요 후원사부터, 3명까지): 다음 영입 창(분기)에 구단 예산이 되면 영입. 다시 누르면 추천 거둠. */
  ipcMain.handle('logScout', (_e, pid: unknown) => {
    try { const s = saveOf(need()), sp = mySponsor(s); if (!tierCan(sp.tier, 'scout')) throw new Error(L('영입 추천은 주요 후원사(2등급)부터 할 수 있습니다.', 'Recommending signings needs tier 2 or higher.'));
      const id = String(pid), p = s.players[id]; if (sp.scout.includes(id)) { sp.scout = sp.scout.filter((x) => x !== id); return ok(); }
      if (!p || p.club) throw new Error(L('자유계약 선수만 추천할 수 있습니다.', 'Only free agents can be recommended.'));
      if (sp.scout.length >= 3) throw new Error(L('추천은 3명까지입니다.', 'Up to 3 recommendations.')); sp.scout.push(id); return ok(); } catch (e) { return err(e); }
  });
  /** 레전드 양성: 후원 구단 유망주 한 명을 육성 선수로(육성비 금고에서, 시즌마다). pid 가 비면 그만둠. */
  ipcMain.handle('logFoster', (_e, pid: unknown) => {
    try { const sid = need(), s = saveOf(sid), sp = mySponsor(s);
      if (!pid) { sp.foster = undefined; return ok(); }
      const p = s.players[String(pid)]; if (!p || p.club !== sp.team) throw new Error(L('후원 구단 선수만 육성할 수 있습니다.', 'Only players of the sponsored club can be fostered.'));
      if (!canFoster(p)) throw new Error(L(`${FOSTER.maxAge}살 이하, 잠재력 ${FOSTER.minPot} 이상인 유망주만 육성할 수 있습니다.`, `Only prospects aged ${FOSTER.maxAge} or younger with potential ${FOSTER.minPot}+ can be fostered.`));
      if (sp.foster && sp.foster !== p.id && s.players[sp.foster]) throw new Error(L('육성 선수는 한 명입니다. 지금 선수를 먼저 그만두세요.', 'Only one fostered player at a time. Stop the current one first.'));
      if (sp.foster !== p.id) { if (!spendFromVault(sid, FOSTER.fee, 'LoG legend program')) throw new Error(L(`금고가 모자랍니다(육성비 ${FOSTER.fee}).`, `Not enough in the vault (fee ${FOSTER.fee}).`)); sp.foster = p.id; }
      return ok(); } catch (e) { return err(e); }
  });
  /** 직접 키운 레전드의 초상화: 예비 그림 또는 내 그림 폴더에서. 나중에 바꿀 수도 있음. */
  ipcMain.handle('logPortrait', (_e, a: { pid?: unknown; src?: unknown }) => {
    try { const s = saveOf(need()), p = s.players[String(a?.pid)]; if (!p?.home) throw new Error(L('직접 키운 레전드만 초상화를 고를 수 있습니다.', 'Only legends you raised can choose a portrait.'));
      const src = String(a?.src ?? ''); if (src && !portraitChoices().includes(src)) throw new Error(L('그 그림을 찾을 수 없습니다.', 'That picture was not found.'));
      p.home.portrait = src; if (s.portraitPick === p.id) s.portraitPick = undefined; return ok(); } catch (e) { return err(e); }
  });
  /** 로고 꾸미기(메인 스폰서): 문장·모양·무늬·색. null 이면 원래 로고로. */
  ipcMain.handle('logLogo', (_e, a: unknown) => {
    try { const s = saveOf(need()), sp = mySponsor(s), t = sponsoredTeam(s)!; if (!tierCan(sp.tier, 'logo')) throw new Error(L('로고는 메인 스폰서(3등급)만 바꿀 수 있습니다.', 'Only a main sponsor (tier 3) can change the logo.'));
      if (a === null) { t.myLogo = undefined; return ok(); } const x = (a ?? {}) as Record<string, unknown>, n = (v: unknown, max: number) => { const k = Math.floor(Number(v)); if (!(k >= 0 && k < max)) throw new Error(L('로고 조각을 확인해 주세요.', 'Check the logo parts.')); return k; };
      t.myLogo = { e: n(x.e, EMBLEMS.length), s: n(x.s, LOGO_SHAPES.length), p: n(x.p, LOGO_PATTERNS.length), c: n(x.c, LOGO_COLORS.length) }; return ok(); } catch (e) { return err(e); }
  });
  /** 장비 후원: 후원 구단에 증강현실 장비를 사 줌(금고에서). 2시즌 쓰고 낡음. 같은 칸은 새 장비로 바뀜. */
  ipcMain.handle('logGear', (_e, a: { slot?: unknown; grade?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), sp = mySponsor(s), t = sponsoredTeam(s)!, slot = String(a?.slot) as GearSlot, gr = Number(a?.grade);
      if (!(slot in GEAR) || !GEAR_GRADES[gr]) throw new Error(L('장비를 골라 주세요.', 'Choose a piece of gear.'));
      const cur = t.gear?.[slot]; if (cur && cur.until >= s.season && cur.grade >= gr) throw new Error(L('이미 같거나 더 좋은 장비가 있습니다.', 'The club already has equal or better gear there.'));
      const cost = GEAR_GRADES[gr].cost; if (!spendFromVault(sid, cost, 'LoG gear')) throw new Error(L(`금고가 모자랍니다(${cost}).`, `Not enough in the vault (${cost}).`));
      (t.gear ??= {})[slot] = { grade: gr, until: s.season + GEAR_SEASONS - 1 }; void sp; return ok(); } catch (e) { return err(e); }
  });
  /** 직접 밴픽(메인 스폰서): 후원 구단의 다음 경기. 안 하면 구단이 알아서. */
  ipcMain.handle('logDraftStart', () => {
    try { const sid = need(), s = saveOf(sid), sp = mySponsor(s), t = sponsoredTeam(s)!; if (!tierCan(sp.tier, 'draft')) throw new Error(L('직접 밴픽은 메인 스폰서(3등급)만 할 수 있습니다.', 'Only a main sponsor (tier 3) can run the draft.'));
      const ri = s.done, rd = s.rounds[ri]; if (!rd) throw new Error(L('다음 경기가 아직 정해지지 않았습니다.', 'The next match is not set yet.'));
      const ti = s.teams.indexOf(t), mi = rd.findIndex((m) => m.a === ti || m.b === ti); if (mi < 0) throw new Error(L('이번 라운드에 후원 구단 경기가 없습니다.', 'The sponsored club has no match this round.'));
      draftState = { sid, round: ri, match: mi, side: rd[mi].a === ti ? 0 : 1, d: emptyDraft(poolFor(s, ri)) }; aiDraftTurns(); push(); return { ok: true, state: logView() }; } catch (e) { return err(e); }
  });
  ipcMain.handle('logDraftMove', (_e, a: { weapon?: unknown; role?: unknown }) => {
    try { const ds = draftState; if (!ds) throw new Error(L('밴픽 중이 아닙니다.', 'No draft in progress.')); const o = DRAFT_ORDER[ds.d.step]; if (!o || o.side !== ds.side) throw new Error(L('우리 차례가 아닙니다.', 'Not our turn.'));
      const role = ROLES.includes(String(a?.role) as Role) ? (String(a!.role) as Role) : undefined; if (!draftMove(ds.d, String(a?.weapon ?? ''), role)) throw new Error(L('고를 수 없는 무기입니다.', 'That weapon cannot be chosen.'));
      aiDraftTurns(); push(); return { ok: true, state: logView() }; } catch (e) { return err(e); }
  });
  ipcMain.handle('logDraftCancel', () => { draftState = null; push(); return { ok: true, state: logView() }; });
  /** 밴픽을 끝내면: 지금 바로 경기(실시간 관람) 또는 경기일까지 저장(그날 이 밴픽으로). */
  ipcMain.handle('logPlayMine', (_e, a: { now?: unknown }) => {
    try { const ds = draftState; if (!ds || !draftDone(ds.d)) throw new Error(L('밴픽을 먼저 끝내 주세요.', 'Finish the draft first.')); const s = saveOf(ds.sid), m = s.rounds[ds.round][ds.match];
      if (m.winner !== undefined) throw new Error(L('이미 끝난 경기입니다.', 'That match is already played.'));
      if (a?.now === false) { s.prepared = { round: ds.round, match: ds.match, draft: ds.d }; draftState = null; return ok(); }
      playMatch(ds.sid, s, ds.round, ds.match, m, ds.d); draftState = null; save();
      startWatch(`${teamName(s, s.teams[m.a])} vs ${teamName(s, s.teams[m.b])}`, m.defs!, m.seed, { v: m.eng ?? 1 }); push(); return { ok: true, state: logView() }; } catch (e) { return err(e); }
  });
  /** 경기 구경: 치른 경기 다시 보기(같은 씨앗 → 같은 경기). olympic = 올림픽 경기 번호. */
  ipcMain.handle('logWatch', (_e, a: { round?: unknown; match?: unknown; olympic?: unknown }) => {
    try { const sid = need(), s = saveOf(sid);
      if ((a as { worlds?: unknown })?.worlds !== undefined) { const [si, gi] = String((a as { worlds: unknown }).worlds).split(':').map(Number), x = s.worlds?.series[si], g = x?.games[gi]; if (!x || !g || !wShownStages(s.worlds!).has(x.stage)) throw new Error(L('그 경기가 없습니다(아직 열리지 않았을 수 있어요).', 'No such match (it may not have been played yet).')); startWatch(`${L('은하 월드 챔피언십', 'Galactic Worlds')} · ${s.worlds!.teams[x.a].name} vs ${s.worlds!.teams[x.b].name} · ${gi + 1}${L('세트', ' game')}`, g.defs, g.seed, { v: g.eng ?? 1 }); return { ok: true, state: logView() }; }
      if ((a as { allstar?: unknown })?.allstar) { const al = s.allstar; if (!al) throw new Error(L('아직 올스타전이 없습니다(시즌이 끝나면 열림).', 'No All-Star match yet (held after the season).')); const ru = ALLSTAR_RULES.find((x) => x.id === al.rule)!; startWatch(`${L('올스타전', 'All-Star match')} · ${L(ru.ko, ru.en)}`, al.defs, al.seed, { ...ru.rules, v: al.eng ?? 1 }, L(`${ru.ko}: ${ru.descKo}`, `${ru.en}: ${ru.descEn}`)); return { ok: true, state: logView() }; }
      if (a?.olympic !== undefined) { const R = s.oly.result, gi = Number(a.olympic), g = R?.games[gi]; if (!R || !g || !OLY_STEPS.slice(0, oShown(R)).flat().includes(gi)) throw new Error(L('그 경기가 없습니다(아직 열리지 않았을 수 있어요).', 'No such match (it may not have been played yet).')); startWatch(`${L('은하 올림픽', 'Galactic Olympics')} · ${g.a} vs ${g.b}`, g.defs, g.seed, { v: g.eng ?? 1 }); return { ok: true, state: logView() }; }
      const m = s.rounds[Number(a?.round)]?.[Number(a?.match)]; if (!m || m.winner === undefined || !m.defs) throw new Error(L('아직 치르지 않은 경기입니다(경기일에 열립니다).', 'That match has not been played yet (it plays on match day).'));
      startWatch(`${m.defs[0].name} vs ${m.defs[1].name}`, m.defs, m.seed, { v: m.eng ?? 1 }); return { ok: true, state: logView() }; } catch (e) { return err(e); }
  });
  ipcMain.handle('logSpeed', (_e, n: unknown) => { const v = Number(n); setSpeed(v === 2 ? 2 : v === 4 ? 4 : v === 0 ? 0 : 1); return true; });
  ipcMain.handle('logStopWatch', () => { stopWatch(); return true; });
  /** 스포츠토토: 다음 라운드 경기들에 걸기(한 경기 또는 묶음). 판돈은 금고에서. */
  /** 국제 대회 토토(2026-10-31): 다음 달 열릴 월즈·올림픽 경기에 걸기. picks = [{ i: 시리즈·경기 번호, side }]. */
  ipcMain.handle('logTotoIntl', (_e, a: { kind?: unknown; picks?: unknown; stake?: unknown }) => {
    try { if (isGestalt()) throw new Error(L('단일 의식 제국은 토토를 하지 않습니다.', 'A gestalt empire does not bet.')); const sid = need(), s = saveOf(sid), kind = a?.kind === 'o' ? 'o' : 'w', stake = Math.round(Number(a?.stake));
      if (!Number.isSafeInteger(stake) || stake < 1 || stake > 100_000) throw new Error(L('판돈을 확인해 주세요.', 'Check the stake.'));
      const raw = (Array.isArray(a?.picks) ? a.picks : []).slice(0, 4) as Array<{ i?: unknown; side?: unknown }>, picks = raw.map((p) => ({ round: Number(p?.i), match: 0, side: (p?.side === 1 ? 1 : 0) as 0 | 1 }));
      if (!picks.length || new Set(picks.map((p) => p.round)).size !== picks.length) throw new Error(L('걸 경기를 골라 주세요.', 'Pick the matches to bet on.'));
      let o = 1, yr = 0;
      if (kind === 'w') { const W = s.worlds, nx = W ? wNext(W) : null; if (!W || !nx || picks.some((p) => !nx.series.includes(p.round))) throw new Error(L('다음 단계의 아직 열리지 않은 월즈 경기만 걸 수 있습니다.', 'You can only bet on upcoming Worlds matches of the next stage.')); for (const p of picks) o *= wOdds(W, p.round)[p.side]; yr = W.year; }
      else { const R = s.oly.result, open = R ? OLY_STEPS[oShown(R)] ?? [] : []; if (!R || !open.length || picks.some((p) => !open.includes(p.round))) throw new Error(L('다음 단계의 아직 열리지 않은 올림픽 경기만 걸 수 있습니다.', 'You can only bet on upcoming Olympic matches of the next stage.')); for (const p of picks) o *= oOdds(R, p.round)[p.side]; yr = R.games[0].seed; }
      o = Math.min(100, Math.round(o * 100) / 100);
      if (!spendFromVault(sid, stake, 'LoG toto')) throw new Error(L('금고가 모자랍니다.', 'Not enough in the vault.'));
      s.toto.push({ id: randomUUID().slice(0, 8), picks, stake, odds: o, intl: kind, yr }); return ok(); } catch (e) { return err(e); }
  });
  ipcMain.handle('logToto', (_e, a: { picks?: unknown; stake?: unknown }) => {
    try { if (isGestalt()) throw new Error(L('단일 의식 제국에는 국내 리그가 없어 토토도 없습니다.', 'A gestalt empire has no domestic league, so no toto either.')); const sid = need(), s = saveOf(sid), stake = Math.round(Number(a?.stake)); if (!Number.isSafeInteger(stake) || stake < 1 || stake > 100_000) throw new Error(L('판돈을 확인해 주세요.', 'Check the stake.'));
      const picks = (Array.isArray(a?.picks) ? a.picks : []).slice(0, 4).map((p: TotoPick) => ({ round: Number(p.round), match: Number(p.match), side: (p.side === 1 ? 1 : 0) as 0 | 1 }));
      if (!picks.length || picks.some((p) => p.round !== s.done || !s.rounds[p.round]?.[p.match] || s.rounds[p.round][p.match].winner !== undefined) || new Set(picks.map((p) => p.match)).size !== picks.length) throw new Error(L('다음 라운드의 아직 치르지 않은 경기만 걸 수 있습니다.', 'You can only bet on unplayed matches of the next round.'));
      const o = slipOdds(picks, (r, m) => [ratingOf(s, s.rounds[r][m].a), ratingOf(s, s.rounds[r][m].b)]);
      if (!spendFromVault(sid, stake, 'LoG toto')) throw new Error(L('금고가 모자랍니다.', 'Not enough in the vault.'));
      s.toto.push({ id: randomUUID().slice(0, 8), picks, stake, odds: o }); return ok(); } catch (e) { return err(e); }
  });
  ipcMain.handle('logOlyBid', async () => {
    try { const sid = need(), s = saveOf(sid); if (!s.oly.bidOpen) throw new Error(L('지금은 유치 신청 기간이 아닙니다.', 'Bidding is not open now.')); if (s.oly.weBid) throw new Error(L('이미 신청했습니다.', 'Already bid.'));
      if (atWarNow()) throw new Error(L('전쟁 중에는 국제 대회를 유치할 수 없습니다.', 'You cannot host an international event while at war.'));
      await payGame(sid, `ho${s.oly.year ?? 0}_bid`, { energy: OLYMPIC.bidFee }); // 국가 행사: 신청비는 게임 에너지(2026-11-04, 금고 아님)
      const s2 = saveOf(sid); if (!s2.oly.bidOpen) throw new Error(L('지금은 유치 신청 기간이 아닙니다.', 'Bidding is not open now.')); s2.oly.weBid = true; return ok(); } catch (e) { return err(e); }
  });
  // ---- 유치 경쟁 · 개최 준비 · 개막식(2026-10-31)
  const hostCtx = (s: LogSave, ev: unknown) => { if (ev === 'oly') { const o = s.oly; return { year: o.year ?? 0, open: !!o.bidOpen, weBid: !!o.weBid, host: o.host, hb: hbOf(o), name: L('은하 올림픽', 'Galactic Olympics') }; } const b = natOf(s).wbid; if (!b) throw new Error(L('지금은 월즈 유치 일정이 없습니다.', 'No Worlds bidding right now.')); return { year: b.year, open: !!b.open, weBid: !!b.weBid, host: b.host, hb: hbOf(b), name: L('은하 월드 챔피언십', 'Galactic Worlds') }; };
  /** 로비: gift = 외교 선물(에너지) · envoy = 공식 사절(영향력) · bribe = 뒷돈(에너지, 들킬 수 있음). 회원국마다 수단별 한 번. 국가 행사라 모두 게임 자원(2026-11-04). */
  ipcMain.handle('logHostLobby', async (_e, a: { ev?: unknown; voter?: unknown; kind?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), H = hostCtx(s, a?.ev), idx = Number(a?.voter), kind = (['gift', 'envoy', 'bribe'].includes(String(a?.kind)) ? a?.kind : '') as LobbyKind;
      if (!H.open || !H.weBid) throw new Error(L('유치를 신청한 뒤, 투표 전까지만 로비할 수 있습니다.', 'You can lobby only after bidding and before the vote.'));
      const v = s.oly.members.find((x) => x.idx === idx); if (!v || !kind) throw new Error(L('그 나라는 투표국이 아닙니다.', 'That nation does not vote.'));
      if ((H.hb.rivals ?? []).includes(idx)) throw new Error(L('유치 경쟁국은 자기 나라를 찍습니다.', 'A rival bidder votes for itself.'));
      if ((H.hb.used?.[String(idx)] ?? []).includes(kind)) throw new Error(L('그 나라에는 이미 그 방법을 썼습니다.', 'Already used that approach on this nation.'));
      if (kind === 'envoy') await payGame(sid, `h${a?.ev === 'oly' ? 'o' : 'w'}${H.year}_env_${idx}`, HOST.envoy.cost);
      else await payGame(sid, `h${a?.ev === 'oly' ? 'o' : 'w'}${H.year}_${kind === 'bribe' ? 'brb' : 'gft'}_${idx}`, { energy: lobbyCost(kind, v.weight) });
      const hb = hostCtx(saveOf(sid), a?.ev).hb, k = String(idx), used = ((hb.used ??= {})[k] ??= []);
      if (!used.includes(kind)) { used.push(kind); (hb.lobby ??= {})[k] = (hb.lobby[k] ?? 0) + lobbyLike(kind); if (kind === 'bribe') (hb.bribed ??= []).push(idx); }
      return ok(); } catch (e) { return err(e); }
  });
  ipcMain.handle('logHostPlanet', (_e, a: { ev?: unknown; planet?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), H = hostCtx(s, a?.ev), p = String(a?.planet ?? ''); if (H.host !== -1 || !H.hb.prep) throw new Error(L('개최국이 된 뒤에 고를 수 있습니다.', 'Available once we are the host.')); if (H.hb.result) throw new Error(L('대회가 이미 열렸습니다.', 'The event has already opened.'));
      if (!planetSlots(sid).includes(p)) throw new Error(L('우리 행성이 아닙니다.', 'Not one of our planets.')); H.hb.prep.planet = p; return ok(); } catch (e) { return err(e); }
  });
  ipcMain.handle('logHostPrep', async (_e, a: { ev?: unknown; project?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), H = hostCtx(s, a?.ev), q = PREP.find((x) => x.id === a?.project); if (!q) throw new Error(L('그런 준비 사업이 없습니다.', 'No such project.'));
      if (H.host !== -1 || !H.hb.prep) throw new Error(L('개최국이 된 뒤에 준비할 수 있습니다.', 'Available once we are the host.')); if (H.hb.result) throw new Error(L('대회가 이미 열렸습니다.', 'The event has already opened.')); if (H.hb.prep.done.includes(q.id)) throw new Error(L('이미 끝낸 사업입니다.', 'Already done.'));
      await payGame(sid, `h${a?.ev === 'oly' ? 'o' : 'w'}${H.year}_${q.id}`, q.game);
      const pr = hostCtx(saveOf(sid), a?.ev).hb.prep; if (pr && !pr.done.includes(q.id)) { pr.done.push(q.id); pr.level = Math.min(100, pr.level + q.gain); }
      return ok(); } catch (e) { return err(e); }
  });
  /** 개막식 축사: unity = 화합(회원국 호감 +) · glory = 영광(민심 +) · rivalry = 도전(리그 열기 +). */
  ipcMain.handle('logCeremony', (_e, a: { ev?: unknown; choice?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), H = hostCtx(s, a?.ev), c = a?.choice; if (H.hb.ceremony !== 'open') throw new Error(L('지금은 개막식이 없습니다.', 'No opening ceremony right now.'));
      if (c === 'unity') queueOps(s, s.oly.members.slice(0, 20).map((mb): QOp => ({ t: 'opinion', idx: mb.idx, mod: 'sllm_log_host_thanks' })), 'ceremony unity');
      else if (c === 'glory') natMood(s, hasEthic('militarist') || hasEthic('authoritarian') ? 2 : 1, L(`${H.name} 개막식 — 영광의 축사`, `${H.name} opening — a speech of glory`));
      else if (c === 'rivalry') heatUp(s, 8); else throw new Error(L('축사를 골라 주세요.', 'Choose a speech.'));
      H.hb.ceremony = c; s.news.push({ season: s.season, text: c === 'unity' ? L(`${H.name} 개막식 — 통치자 「은하는 하나」 축사에 박수`, `${H.name} opening — applause for the ruler's "one galaxy" speech`) : c === 'glory' ? L(`${H.name} 개막식 — 통치자 「우리의 영광을 보라」`, `${H.name} opening — the ruler: "Behold our glory"`) : L(`${H.name} 개막식 — 통치자 「최강을 가리자」 도발에 관중 열광`, `${H.name} opening — the ruler's "may the strongest win" fires up the crowd`) });
      void sendOps(sid); return ok(); } catch (e) { return err(e); }
  });
  // ---- 은하 공동체 회의에서 개최지 선정(2026-10-31 사용자: 안건 회의를 다시 써서 토론·투표) — debate: 신청 기간 연설(설득 → 7월 투표의 호감) · vote: 투표 장면 다시 보기
  ipcMain.handle('logHostCouncil', (_e, a: { ev?: unknown; mode?: unknown }) => {
    try { const sid = need(), s = saveOf(sid), ev = a?.ev === 'oly' ? 'oly' : 'worlds', H = hostCtx(s, ev), mode = a?.mode === 'vote' ? 'vote' : 'debate', o = s.oly;
      if (mode === 'debate' && !(H.open && H.weBid)) throw new Error(L('유치를 신청한 뒤, 7월 투표 전까지만 회의에서 연설할 수 있습니다.', 'You can address the council only after bidding and before the July vote.'));
      if (mode === 'vote' && !(H.hb.rounds ?? []).length) throw new Error(L('아직 투표가 없었습니다.', 'There has been no vote yet.'));
      if (o.members.length < 2) throw new Error(L('은하 공동체 회원국을 아직 모릅니다.', 'The Galactic Community members are not known yet.'));
      const me = ctx.playerName || L('우리 제국', 'Our empire'), nm = (idx: number) => (idx === -1 ? me : o.members.find((x) => x.idx === idx)?.name ?? '?'), rivals = H.hb.rivals ?? [];
      const pr = predict(o.members.map((v) => ({ idx: v.idx, weight: v.weight, like: relLike(v.idx) })), rivals, H.hb.lobby ?? {});
      const title = L(`${H.year} ${H.name} 개최지 선정`, `${H.year} ${H.name} — host selection`);
      const desc = `Vote on which bidder hosts the ${H.year} ${ev === 'oly' ? 'Galactic Olympics' : 'Galactic Worlds (the galaxy-wide Legend of Galaxy e-sports championship)'}. Bidders: ${[me, ...rivals.map(nm)].join(', ')}. FOR means supporting ${me}'s bid; AGAINST means preferring a rival bidder. Rival bidders always vote for themselves. Delegates weigh prestige, tourism, relations with each bidder, security and fairness.`;
      const info: AgendaInfo & { host: Record<string, unknown> } = { key: `sllm_host_${ev}_${H.year}`, title, desc, proposer: me, target: rivals.map(nm).join(', '), date: ctx.gameDate || '', demo: false, fresh: false, reliable: false,
        members: o.members.map((v) => ({ idx: v.idx, name: v.name, weight: v.weight, ai: true, council: true })),
        host: { ev, year: H.year, mode, me, rivals, score: Object.fromEntries(pr.map((x) => [x.idx, rivals.includes(x.idx) ? -100 : Math.max(-95, Math.min(95, Math.round(x.score * 160)))])),
          ...(mode === 'vote' ? { rounds: (H.hb.rounds ?? []).map((r) => Object.entries(r).map(([k, v]) => ({ name: nm(Number(k)), us: Number(k) === -1, votes: Math.round(Number(v)) })).sort((x, y) => y.votes - x.votes)), ballots: Object.fromEntries(Object.entries(H.hb.ballots ?? {}).map(([k, v]) => [k, Number(v) === -1 ? 'us' : nm(Number(v))])), winner: nm(H.host ?? -9), won: H.host === -1 } : {}) } };
      openCouncil('', info); return ok(); } catch (e) { return err(e); }
  });
  /** 올림픽 대표팀: 자리마다 국내 리그 선수 한 명. */
  ipcMain.handle('logOlyTeam', (_e, a: unknown) => {
    try { const sid = need(), s = saveOf(sid), pick = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>, out: Partial<Record<Role, string>> = {};
      for (const role of ROLES) { const id = String(pick[role] ?? ''); if (!id) continue; const p = s.players[id]; if (!p || !p.club) throw new Error(L('국내 리그 선수만 고를 수 있습니다.', 'Only domestic league players can be chosen.')); out[role] = id; }
      if (new Set(Object.values(out)).size !== Object.values(out).length) throw new Error(L('같은 선수를 두 자리에 넣을 수 없습니다.', 'The same player cannot fill two roles.'));
      s.oly.national = out; return ok(); } catch (e) { return err(e); }
  });
  // ---- 나라와 경기(2026-10-31)
  /** 전쟁 중인 나라와 월즈에서 만나면: refuse = 기권(매파 민심 +), play = 강행(다른 나라 호감 +). */
  ipcMain.handle('logWarPolicy', (_e, v: unknown) => { try { const s = saveOf(need()); natOf(s).warPolicy = v === 'play' ? 'play' : 'refuse'; return ok(); } catch (e) { return err(e); } });
  ipcMain.handle('logWorldsBid', async () => {
    try { const sid = need(), s = saveOf(sid), b = natOf(s).wbid; if (!b?.open) throw new Error(L('지금은 월즈 유치 신청 기간이 아닙니다.', 'Worlds bidding is not open now.')); if (b.weBid) throw new Error(L('이미 신청했습니다.', 'Already bid.'));
      if (atWarNow()) throw new Error(L('전쟁 중에는 국제 대회를 유치할 수 없습니다.', 'You cannot host an international event while at war.'));
      await payGame(sid, `hw${b.year}_bid`, { energy: NAT.host.bidFee }); // 국가 행사: 신청비는 게임 에너지(2026-11-04, 금고 아님)
      const b2 = natOf(saveOf(sid)).wbid; if (!b2?.open) throw new Error(L('지금은 월즈 유치 신청 기간이 아닙니다.', 'Worlds bidding is not open now.')); b2.weBid = true; return ok(); } catch (e) { return err(e); }
  });
  /** 승부 조작: investigate = 조사(민심 −1·열기 −·그 구단 다음 시즌 예산 −) / cover = 덮기(1~3년 안에 드러날 수 있음 → 크게 −). */
  ipcMain.handle('logScandal', (_e, v: unknown) => {
    try { const sid = need(), s = saveOf(sid), n = natOf(s), sc = n.scandal; if (!sc || sc.state !== 'open' || sc.done) throw new Error(L('정할 일이 없습니다.', 'Nothing to decide.'));
      const tn = teamName(s, s.teams.find((t) => t.id === sc.team) ?? s.teams[0]);
      if (v === 'cover') { sc.state = 'covered'; sc.revealBy = s.season + 1 + (hashSeed(`${sid}:cover:${sc.season}`) % 3); }
      else { sc.state = 'investigated'; sc.done = true; (n.penalty ??= {})[sc.team] = s.season + 1; natMood(s, NAT.scandal.investigateMood, L('승부 조작 조사', 'Match-fixing investigation')); heatUp(s, NAT.heat.investigate); sportsNews(s, 'scandal', { team: tn });
        chronNoteWorld(L(`${ctx.gameDate || s.season} 레전드 오브 갤럭시 승부 조작 의혹 조사(${tn}) — 구단 징계`, `${ctx.gameDate || s.season} Legend of Galaxy match-fixing probe (${tn}) — club penalized`), true); }
      return ok(); } catch (e) { return err(e); }
  });
  /** 스타 이적: keep = 금고로 붙잡기 / release = 보내기(상대 호감 +, 민심 −). */
  ipcMain.handle('logTransfer', (_e, v: unknown) => {
    try { const sid = need(), s = saveOf(sid), n = natOf(s), tr = n.transfer; if (!tr) throw new Error(L('정할 일이 없습니다.', 'Nothing to decide.'));
      if (v === 'keep') { if (!spendFromVault(sid, NAT.transfer.keepFee, 'LoG keep legend')) throw new Error(L(`금고가 모자랍니다(${NAT.transfer.keepFee}).`, `Not enough in the vault (${NAT.transfer.keepFee}).`)); s.news.push({ season: s.season, text: L(`${s.players[tr.pid]?.name ?? ''} 잔류 — 나라가 붙잡았다`, `${s.players[tr.pid]?.name ?? ''} stays — the state kept them`) }); }
      else releaseAbroad(s, tr);
      n.transfer = undefined; void sendOps(sid); return ok(); } catch (e) { return err(e); }
  });
  /** 레전드 국가 행사 초청(13): 한 해 한 번 → 민심 +(열기 비례) · 열기 +. */
  ipcMain.handle('logInvite', (_e, pid: unknown) => {
    try { const s = saveOf(need()), n = natOf(s), p = s.players[String(pid)], y = ymd(ctx.gameDate || '')?.y ?? s.season; if (!p || !p.legend) throw new Error(L('레전드만 초청할 수 있습니다.', 'Only legends can be invited.')); if (n.invited === y) throw new Error(L('올해는 이미 초청했습니다.', 'Already invited someone this year.'));
      n.invited = y; natMood(s, 1, L(`레전드 ${p.name} 국가 행사 초청`, `Legend ${p.name} at a state event`)); heatUp(s, NAT.heat.invite); s.news.push({ season: s.season, text: L(`레전드 ${p.name}, 국가 행사에 초청되다`, `Legend ${p.name} invited to a state event`) });
      chronNoteWorld(L(`${ctx.gameDate || y} 레전드 오브 갤럭시 레전드 ${p.name}이(가) 국가 행사에 초청되었다`, `${ctx.gameDate || y} Legend of Galaxy legend ${p.name} was invited to a state event`), false); return ok(); } catch (e) { return err(e); }
  });
  app.on('before-quit', () => stopWatch());
}
export const _logTest = { natOf, natView, natWorlds, natSeasonEnd, worldsBidMonth, sendOps, saveOf, newSeason, resolveRound, onMonth, planetSlots, teamName, aiManage, debutNext, fresh, setWorldsSync: (v: boolean) => { worldsSync = v; } };
