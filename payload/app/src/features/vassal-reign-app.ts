// 종속국 통치권(앱 쪽, 2026-11-05 사용자: Vassals Expanded and Reworked 를 참고만 해서 우리 식으로 「전부다」). 규칙: src/vassal-reign.ts · 화면: ui/vassal-reign.js(종속국 창)
// ① 괴뢰 통치자 · ② 대리전 지시 · ⑥ 함대 징발 · ⑦ 함대 헌납 · ③ 간섭 반감(다른 기능은 src/app/reign-hooks.ts 로 부른다) · ④ 정책·종족 권리 동조(동화 정책 걸음 때) · ⑤ 종속국 쟁탈 전쟁명분.
// 로그 자리 VREIGN: VRLDR·VRLEND(후보 지도자) · VRTGT·VRTEND(대리전 대상) · VRPZ·VRPZEND(쟁탈 후보) · VRNAME(옛·새 통치자 이름) · VRALN(동조 내용) · VRSET(적용) · VRPXW(대리전 계속?) · VRFLT·VRFEND(종속국 함대) · VRLVC(징발 점검) · VRWAR(전쟁 결말, req 없음).
// 저장: sllm_vassal_reign.json { saves: { [세이브]: { heat, install, deposed, proxy, won } } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { featureOff } from '../app/feature-gate';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { hoiLink } from '../app/hoi-hooks';
import { reignLink, type MeddleHit } from '../app/reign-hooks';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { vassal, vassalNote, vassalReact, vassalPush, vassalChannelInfo, vassalIdxByName, vassalLetter } from './vassal-app';
import { addAppAlarm } from './alarm-app';
import { addDays } from '../alarm';
import {
  VR, MEDDLE_NAME, coolLeft, yearsSince, cool, meddle, heatText, tierOf, heatScale, proxyOdds, proxyRoll, bribeFor, proxySituation, newRulerSituation, grudgeSituation,
  leadersCommand, installCommand, targetsCommand, proxyCommand, payCommand, refundCommand, proxyCheckCommand, meddleCommand, alignCommand, prizesCommand, prizeCommand,
  readLeader, readPick, alignText, stText, CLASS_NAME, type Heat, type VrLeader, type VrPick, type ProxyAnswer,
  levyOdds, levyRoll, titheChance, levySituation, titheSituation, fleetsCommand, levyCommand, levyCheckCommand, titheCommand, readFleet, type VrFleet, type LevyAnswer,
} from '../vassal-reign';

interface Deposed { name: string; ruler: string; since: string; last: string }
interface Proxy { at: string; target: string; state: 'pending' | 'war' | 'done' | 'refused'; ans: ProxyAnswer; bribe?: number; won?: boolean }
interface Levy { at: string; until: string; fleet: string; state: 'on' | 'done' | 'lost'; ans: LevyAnswer }
interface Tithe { at: string; fleet: string; state: 'pending' | 'done' | 'forced' | 'dropped' }
interface VrSave { heat: Record<string, Heat>; install: Record<string, string>; deposed: Record<string, Deposed>; proxy: Record<string, Proxy>; won: Array<{ name: string; date: string }>; levy: Record<string, Levy>; tithe: Record<string, Tithe> }
const file = () => path.join(app.getPath('userData'), 'sllm_vassal_reign.json');
let all: Record<string, VrSave> | null = null;
const books = (): Record<string, VrSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): VrSave => { const s = (books()[sid] ??= { heat: {}, install: {}, deposed: {}, proxy: {}, won: [], levy: {}, tithe: {} }); s.levy ??= {}; s.tithe ??= {}; s.heat ??= {}; s.install ??= {}; s.deposed ??= {}; s.proxy ??= {}; s.won ??= []; return s; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'vreign.save_failed', { error: (e as Error).message }); } };
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/^\\/, '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const sv = (v: unknown) => String(v ?? '').replace(/^\\/, '').trim();
const ready = () => !!(ctx.gameRunning && link.sessionReady && ctx.curSaveId && /^\d+$/.test(ctx.curSaveId));
const us = () => ctx.playerName || L('우리 제국', 'our empire');
const loyaltyOf = (idx: number): number | null => vassalChannelInfo(idx)?.loyalty ?? null;
const autonomyOf = (idx: number): number => { try { return hoiLink.autonomy(idx)?.v ?? 0; } catch { return 0; } };
const weAtWar = (): boolean => !!vassal.snap && vassal.snap.wars.length > 0;
let busy = false;

// ---- 줄 모으기 ----
const leaders = new Map<number, VrLeader[]>(), picks = new Map<number, VrPick[]>(), names = new Map<number, { old?: string; neu?: string }>(), aligns = new Map<number, Array<{ k: number; sp: string }>>(), fleets = new Map<number, VrFleet[]>();
function onLine(m: SllmMessage): void {
  const req = Math.round(num(m.kv.req));
  if (m.kind === 'VRLDR') { const l = leaders.get(req), x = readLeader(m.kv); if (l && x && l.length < VR.listMax) l.push(x); return; }
  if (m.kind === 'VRTGT' || m.kind === 'VRPZ') { const l = picks.get(req), x = readPick(m.kv); if (l && x && l.length < VR.listMax) l.push(x); return; }
  if (m.kind === 'VRNAME') { const n = names.get(req); if (n) { if (sv(m.kv.k) === 'old') n.old = sv(m.kv.name).slice(0, 60); else n.neu = sv(m.kv.name).slice(0, 60); } return; }
  if (m.kind === 'VRFLT') { const l = fleets.get(req), x = readFleet(m.kv); if (l && x && l.length < VR.listMax) l.push(x); return; }
  if (m.kind === 'VRALN') { const a = aligns.get(req); if (a) a.push({ k: Math.round(num(m.kv.k)), sp: sv(m.kv.sp) }); return; }
  if (m.kind === 'VRWAR') { onWar(m); return; }
  // 2026-11-09(회랑 방식): 모드가 사건 때 스스로 남긴 줄(req=0) — 전쟁이 끝남 · 징발 함대 격침·임대 끝. tid 0 은 종주국 쪽(overlord-pressure-app) 몫.
  if (req === 0 && (m.kind === 'VRPXW' || m.kind === 'VRLVC')) { const sid = ctx.curSaveId, idx = Math.round(num(m.kv.tid)); if (sid && sv(m.kv.sid) === sid && idx > 0) void signal(m, idx); return; }
  if (['VRLEND', 'VRTEND', 'VRPZEND', 'VRSET', 'VRPXW', 'VRFEND', 'VRLVC'].includes(m.kind)) terminalReplies.get(m.kind + ':' + req)?.(m);
}
async function signal(m: SllmMessage, idx: number): Promise<void> {
  const sid = ctx.curSaveId!, s = saveOf(sid), date = ctx.gameDate || '';
  if (m.kind === 'VRPXW') { const p = s.proxy[String(idx)]; if (p?.state === 'war' && sv(m.kv.war).startsWith('0')) proxyOver(idx, p); return; }
  const lv = s.levy[String(idx)]; if (lv?.state === 'on') levyRead(idx, lv, Math.round(num(m.kv.left)), Math.round(num(m.kv.leased)), date);
}
async function ask(cmd: (req: number) => string, end: string, prep?: (req: number) => void): Promise<{ req: number; m: SllmMessage | null }> {
  const req = ++link.reqCounter; prep?.(req);
  try { return { req, m: await terminalRequest(cmd(req), end, req) }; } catch { return { req, m: null }; }
}
const st = async (cmd: (req: number) => string): Promise<number> => { const r = await ask(cmd, 'VRSET'); return r.m ? Math.round(num(r.m.kv.st)) : -1; };
async function list<T>(map: Map<number, T[]>, cmd: (req: number) => string, end: string): Promise<T[]> {
  const r = await ask(cmd, end, (req) => map.set(req, [])); const out = map.get(r.req) ?? []; map.delete(r.req);
  if (!r.m) throw new Error(stText(-1)); return out;
}

/** ⑥⑦ 종속국 전투 함대 목록 + 이동 가능한 전투 함대 수. cmd 를 주면 그 명령(역방향: 우리 함대)으로. */
async function fleetList(sid: string, idx: number, cmd?: (req: number) => string): Promise<{ list: VrFleet[]; cnt: number }> {
  const r = await ask(cmd ?? ((req) => fleetsCommand(req, sid, idx)), 'VRFEND', (req) => fleets.set(req, [])); const list = fleets.get(r.req) ?? []; fleets.delete(r.req);
  if (!r.m) throw new Error(stText(-1)); return { list, cnt: Math.round(num(r.m.kv.cnt)) };
}
// ---- 역방향(src/features/overlord-pressure-app.ts)이 같은 줄 모으기를 쓰도록 ----
export const vrAsk = ask;
export const vrSt = (cmd: (req: number) => string): Promise<number> => st(cmd);
export const vrPicks = (cmd: (req: number) => string, end: string): Promise<VrPick[]> => list(picks, cmd, end);
export const vrFleets = (cmd: (req: number) => string): Promise<{ list: VrFleet[]; cnt: number }> => fleetList('', 0, cmd);
/** 명령 + VRNAME(new) 이름. */
export async function vrNamed(cmd: (req: number) => string): Promise<{ code: number; name: string }> {
  const r = await ask(cmd, 'VRSET', (req) => names.set(req, {})); const nm = names.get(r.req) ?? {}; names.delete(r.req);
  return { code: r.m ? Math.round(num(r.m.kv.st)) : -1, name: nm.neu ?? '' };
}
/** 정책·종족 권리 한 걸음(VRALN 줄 모아서). */
export async function vrAlignBy(cmd: (req: number) => string): Promise<{ code: number; got: Array<{ k: number; sp: string }> }> {
  const r = await ask(cmd, 'VRSET', (req) => aligns.set(req, [])); const got = aligns.get(r.req) ?? []; aligns.delete(r.req);
  return { code: r.m ? Math.round(num(r.m.kv.st)) : -1, got };
}
/** 역방향 칸: 우리 종속국을 잃었을 때 알림(onWar 가 부른다). */
export const vrHooks = { lostSubject: (_name: string, _foe: string): void => {}, proxyWonByUs: (_foe: string): void => {} };

// ---- ③ 간섭 반감 ----
let chain: Promise<void> = Promise.resolve();
function meddleHit(idx: number, kind: MeddleHit): void {
  const sid = ctx.curSaveId; if (!sid || !Number.isSafeInteger(idx) || idx < 1) return;
  const s = saveOf(sid), date = ctx.gameDate || '', r = meddle(s.heat[String(idx)], kind, loyaltyOf(idx), date);
  const before = s.heat[String(idx)]?.tier ?? 0; s.heat[String(idx)] = r.heat; save();
  if (!r.changed || !ready()) return;
  chain = chain.then(async () => {
    const res = await st((req) => meddleCommand(req, sid, idx, r.tier, r.days));
    if (res !== 9) return;
    if (r.tier > before) {
      const v = vassalChannelInfo(idx)?.name ?? '?';
      vassalNote(idx, L(`간섭 반감: ${MEDDLE_NAME[kind][0]} 뒤 ${v}의 민심이 더 나빠졌다 — ${heatText(s.heat[String(idx)])}, ${r.days}일.`, `Meddling backlash: after ${MEDDLE_NAME[kind][1]}, the mood in ${v} worsened — ${heatText(s.heat[String(idx)])}, ${r.days} days.`), true);
      if (r.tier >= 2) chronNote(idx, L(`종주국 ${us()}의 잇따른 간섭에 백성들의 불만이 커지고 있다`, `Discontent grows among our people at ${us()}'s repeated meddling`));
    }
  }).catch((e) => logDiagnostic('warn', 'vreign.meddle_failed', { error: (e as Error).message }));
}

// ---- ④ 정책·종족 권리 동조(동화 정책 걸음 때 vassal-admin-app 이 부른다) ----
async function alignStep(idx: number, vname: string): Promise<void> {
  const sid = ctx.curSaveId; if (!sid || !ready()) return;
  const r = await ask((req) => alignCommand(req, sid, idx), 'VRSET', (req) => aligns.set(req, []));
  const got = aligns.get(r.req) ?? []; aligns.delete(r.req);
  if (!r.m || Math.round(num(r.m.kv.st)) !== 9 || !got.length) return;
  const t = alignText(got[0].k, got[0].sp); if (!t) return;
  meddleHit(idx, 'align');
  vassalNote(idx, L(`동화 정책: ${vname}이(가) 우리 쪽으로 한 걸음 더 — ${t[0]}.`, `Assimilation: ${vname} moved one more step toward us — ${t[1]}.`), true);
  chronNote(idx, L(`종주국 ${us()}의 압박으로 우리 법이 바뀌었다 — ${t[0]}`, `Under pressure from ${us()}, our laws changed — ${t[1]}`));
  vassalReact(idx, 'complaint', `Under the overlord's assimilation policy your government has just been made to adopt: ${t[1]}. Many at court resent having foreign laws imposed.`);
}

// ---- 전쟁 결말(war goal on_accept) ----
function onWar(m: SllmMessage): void {
  const sid = ctx.curSaveId; if (!sid) return; const k = sv(m.kv.k), name = sv(m.kv.name).slice(0, 60);
  // 역방향(2026-11-05): AI 가 쟁탈 전쟁에서 우리를 이겨 우리 종속국을 가져감 · 우리가 종주국 명으로 치른 대리전에서 이김
  if (k === 'prize' && ctx.playerName && sv(m.kv.ov) === ctx.playerName && sv(m.kv.sid) !== sid) { vrHooks.lostSubject(name, ''); return; }
  if (k === 'proxy' && ctx.playerName && name === ctx.playerName) { vrHooks.proxyWonByUs(sv(m.kv.foe).slice(0, 60)); return; }
  if (m.kv.sid !== undefined && sv(m.kv.sid) !== sid) return;
  const s = saveOf(sid);
  if (k === 'prize' && name) {
    const ov = sv(m.kv.ov).slice(0, 60);
    s.won.push({ name, date: ctx.gameDate || '' }); s.won = s.won.slice(-10); save();
    chronNoteWorld(L(`${ctx.gameDate} ${us()}, ${ov || '?'}을(를) 꺾고 그 종속국 ${name}을(를) 빼앗아 새 통치자를 세움`, `${ctx.gameDate} ${us()} defeats ${ov || '?'}, takes its subject ${name} and installs a new ruler`), true);
    ctx.notify({ kind: 'vassal', title: L('종속국 쟁탈 성공', 'Subject taken'), body: L(`${name}이(가) 우리 종속국이 되었습니다. 새 통치자가 곧 서신을 보냅니다.`, `${name} is now our subject. Its new ruler will write soon.`) });
  } else if (k === 'proxy' && name) {
    const idx = vassalIdxByName(name), foe = sv(m.kv.foe).slice(0, 60);
    if (idx) { const p = s.proxy[String(idx)]; if (p) { p.won = true; save(); } vassalNote(idx, L(`대리전: ${name}이(가) ${foe || '상대'}에게 이겼다(상대는 굴욕).`, `Proxy war: ${name} defeated ${foe || 'the enemy'} (the enemy is humiliated).`), true); chronNote(idx, L(`종주국의 명으로 치른 ${foe || '이웃'}과의 전쟁에서 이겼다`, `We won the war against ${foe || 'our neighbour'} fought at our overlord's command`)); }
    chronNoteWorld(L(`${ctx.gameDate} ${name}, ${us()}의 대리전에서 ${foe || '상대'}에게 승리`, `${ctx.gameDate} ${name} wins ${us()}'s proxy war against ${foe || 'its enemy'}`), true);
  }
}

// ---- 월 점검: 열기 식히기 · 밀려난 통치자 서신 · 대리전 계속? · 새로 얻은 종속국 첫 서신 ----
let lastMonth = '';
async function monthly(): Promise<void> {
  if (!ready() || busy) return; const sid = ctx.curSaveId!, date = ctx.gameDate || '', month = date.slice(0, 7); if (!month || month === lastMonth) return; lastMonth = month;
  const s = saveOf(sid); busy = true;
  try {
    for (const [k, hh] of Object.entries(s.heat)) {
      const c = cool(hh, date); if (c === hh) continue;
      const t = tierOf(c.h); s.heat[k] = { ...c, tier: t }; save();
      if (t < hh.tier) { const idx = Number(k); await st((req) => meddleCommand(req, sid, idx, t, heatScale(loyaltyOf(idx)).days)); }
    }
    for (const [k, d] of Object.entries(s.deposed)) {
      const idx = Number(k), y = yearsSince(d.since, date);
      if (!vassalChannelInfo(idx)?.active || y >= VR.grudgeYears) { delete s.deposed[k]; save(); continue; }
      if (yearsSince(d.last || d.since, date) >= 1 && Math.random() < VR.grudgeChance) {
        d.last = date; save();
        vassalLetter(idx, 'complaint', 'a bitter private letter', grudgeSituation(d.name, d.ruler, Math.floor(y)), `${d.name}, the deposed former ruler`);
      }
    }
    // 대리전·징발 확인(2026-11-09): 평소에는 모드가 사건 때 알린다(signal). 해마다 1월에만 예전처럼 물어 놓친 것을 바로잡는다.
    const sweep = month.endsWith('.01');
    for (const [k, p] of Object.entries(s.proxy)) {
      if (!sweep || p.state !== 'war') continue; const idx = Number(k);
      const r = await ask((req) => proxyCheckCommand(req, sid, idx), 'VRPXW'); if (!r.m) continue;
      if (sv(r.m.kv.war).startsWith('0')) proxyOver(idx, p);
    }
    for (const [k, lv] of Object.entries(s.levy)) {
      if (!sweep || lv.state !== 'on') continue; const idx = Number(k);
      const r = await ask((req) => levyCheckCommand(req, sid, idx), 'VRLVC'); if (!r.m) continue;
      levyRead(idx, lv, Math.round(num(r.m.kv.left)), Math.round(num(r.m.kv.leased)), date);
    }
    if (s.won.length) {
      const left: VrSave['won'] = [];
      for (const w of s.won) {
        const idx = vassalIdxByName(w.name);
        if (idx) vassalLetter(idx, 'thanks', 'a first letter', newRulerSituation('the new ruler', false, 'the old ruler') + ' Your throne came to you after the overlord won a war against your former master.');
        else if (yearsSince(w.date, date) < 1) left.push(w);
      }
      s.won = left; save();
    }
  } finally { busy = false; }
}

/** 대리전이 끝남(모드 신호든 1월 확인이든). */
function proxyOver(idx: number, p: VrSave['proxy'][string]): void {
  p.state = 'done'; save();
  if (!p.won) { vassalNote(idx, L(`대리전: ${p.target}과(와)의 전쟁이 끝났다(우리 쪽 승리는 아님).`, `Proxy war: the war with ${p.target} is over (not a win for our side).`), true); chronNoteWorld(L(`${ctx.gameDate} ${vassalChannelInfo(idx)?.name ?? '?'}와(과) ${p.target}의 대리전 종결`, `${ctx.gameDate} The proxy war between ${vassalChannelInfo(idx)?.name ?? '?'} and ${p.target} ends`), true); }
}
/** 징발 함대 상태(left = 살아 있는 수, leased = 그중 아직 우리 지휘 아래). */
function levyRead(idx: number, lv: VrSave['levy'][string], left: number, leased: number, date: string): void {
  const vn = vassalChannelInfo(idx)?.name ?? '?';
  if (left < 1) {
    lv.state = 'lost'; lv.until = date; save(); hoiLink.nudge?.(idx, VR.levyRefuseAuto);
    vassalNote(idx, L(`함대 징발: ${vn}에서 빌려 온 「${lv.fleet}」을(를) 잃었다. ${vn}이(가) 원망한다(자치도 +${VR.levyRefuseAuto}).`, `Fleet levy: the "${lv.fleet}" levied from ${vn} was lost. ${vn} resents it (autonomy +${VR.levyRefuseAuto}).`), true);
    chronNote(idx, L(`종주국 ${us()}에게 징발당한 함대 「${lv.fleet}」이(가) 남의 전쟁에서 사라졌다`, `Our fleet "${lv.fleet}", levied by ${us()}, was lost in someone else's war`));
    vassalLetter(idx, 'complaint', 'a grieving letter', levySituation('accept', lv.fleet, true));
  } else if (leased < 1) {
    lv.state = 'done'; lv.until = date; save();
    vassalNote(idx, L(`함대 징발 끝: 「${lv.fleet}」이(가) ${vn}(으)로 돌아갔다.`, `Fleet levy over: the "${lv.fleet}" returned to ${vn}.`));
  }
}

// ---- 화면 ----
export function vrView(idx: number) {
  const sid = ctx.curSaveId || '', s = sid ? saveOf(sid) : { heat: {}, install: {}, deposed: {}, proxy: {}, won: [], levy: {}, tithe: {} } as VrSave, date = ctx.gameDate || '';
  const p = s.proxy[String(idx)], loy = loyaltyOf(idx), au = autonomyOf(idx), hh = s.heat[String(idx)] ? cool(s.heat[String(idx)], date) : undefined;
  return {
    ok: !!sid, running: ready(),
    cost: { install: VR.installCost, installOurs: VR.installOursCost, proxy: VR.proxyCost, prize: VR.prizeCost, levy: VR.levyCost, tithe: VR.titheCost },
    installLeft: coolLeft(s.install[String(idx)], date, VR.installCoolYears),
    deposed: s.deposed[String(idx)] ? { name: s.deposed[String(idx)].name, since: s.deposed[String(idx)].since } : null,
    heat: { tier: hh ? tierOf(hh.h) : 0, h: hh?.h ?? 0, text: heatText(hh ? { ...hh, tier: tierOf(hh.h) } : undefined) },
    proxy: p ? { target: p.target, state: p.state, bribe: p.bribe ?? 0, at: p.at, won: !!p.won } : null,
    proxyLeft: p && p.state !== 'pending' ? coolLeft(p.at, date, VR.proxyCoolYears) : 0,
    levy: s.levy[String(idx)] ? { ...s.levy[String(idx)] } : null,
    levyLeft: s.levy[String(idx)] && s.levy[String(idx)].state !== 'on' ? coolLeft(s.levy[String(idx)].until, date, VR.levyCoolYears) : 0,
    levyOdds: levyOdds(loy, au, weAtWar()),
    tithe: s.tithe[String(idx)] ? { ...s.tithe[String(idx)] } : null,
    titheLeft: s.tithe[String(idx)] && (s.tithe[String(idx)].state === 'done' || s.tithe[String(idx)].state === 'forced') ? coolLeft(s.tithe[String(idx)].at, date, VR.titheCoolYears) : 0,
    titheChance: titheChance(loy, au),
    odds: proxyOdds(loy, au, weAtWar()), loyalty: loy, autonomy: Math.round(au),
  };
}
type Res = { ok: true; text: string; view: ReturnType<typeof vrView> } | { ok: false; error: string };
const fail = (error: string): Res => ({ ok: false, error });
function needIdx(v: unknown): number { const i = Number(v); if (!Number.isSafeInteger(i) || i < 1) throw new Error(L('종속국을 골라 주세요.', 'Pick a subject.')); return i; }
const guardRun = async (fn: () => Promise<Res>): Promise<Res> => {
  if (!ctx.curSaveId) return fail(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (!ready()) return fail(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  if (busy) return fail(L('처리 중입니다.', 'Busy.'));
  busy = true; try { return await fn(); } catch (e) { return fail((e as Error).message); } finally { busy = false; }
};

// ② 대리전 선포(수락했거나 지원금을 받고) — 바로 다시 물어 실제로 싸우는지 확인, 아니면 돌려준다.
async function declareProxy(sid: string, idx: number, n: number, cost: number, energy: number): Promise<number> {
  const r = await st((req) => proxyCommand(req, sid, idx, n, cost, energy)); if (r !== 9) return r;
  const c = await ask((req) => proxyCheckCommand(req, sid, idx), 'VRPXW');
  if (c.m && sv(c.m.kv.war).startsWith('0')) { await st((req) => refundCommand(req, sid, idx, cost, energy)); return 6; }
  return 9;
}

export function registerVassalReign(router: LogRouter): void {
  router.on(SLOT.VREIGN, 'vassal-reign', onLine);
  reignLink.meddle = meddleHit; reignLink.align = alignStep;
  setInterval(() => { if (featureOff('vassal')) return; void monthly().catch((e) => logDiagnostic('warn', 'vreign.monthly_failed', { error: (e as Error).message })); }, 30000);
  ipcMain.handle('vrState', (_e, idx: unknown) => vrView(Number(idx)));

  // ① 후보 지도자
  ipcMain.handle('vrLeaders', async (_e, idx: unknown) => {
    try { const i = needIdx(idx), sid = ctx.curSaveId; if (!sid || !ready()) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      const l = await list(leaders, (req) => leadersCommand(req, sid, i), 'VRLEND');
      return { ok: true, list: l.map((x) => ({ ...x, clsName: L(...CLASS_NAME[x.cls]) })) };
    } catch (e) { return { ok: false, error: (e as Error).message, list: [] }; }
  });
  // ① 통치자 앉히기
  ipcMain.handle('vrInstall', async (_e, a: { idx?: unknown; n?: unknown; side?: unknown; name?: unknown; vname?: unknown }): Promise<Res> => guardRun(async () => {
    const idx = needIdx(a?.idx), n = Number(a?.n), side = a?.side === 'me' ? 'me' : a?.side === 't' ? 't' : null, sid = ctx.curSaveId!, date = ctx.gameDate || '';
    if (!side || !Number.isSafeInteger(n) || n < 1) return fail(L('앉힐 사람을 골라 주세요.', 'Pick someone to install.'));
    const s = saveOf(sid), left = coolLeft(s.install[String(idx)], date, VR.installCoolYears); if (left) return fail(L(`통치자 교체는 ${left}년 뒤에 다시 할 수 있습니다.`, `You can replace the ruler again in ${left} year(s).`));
    const r = await ask((req) => installCommand(req, sid, idx, n, side), 'VRSET', (req) => names.set(req, {}));
    const nm = names.get(r.req) ?? {}; names.delete(r.req);
    const code = r.m ? Math.round(num(r.m.kv.st)) : -1; if (code !== 9) return fail(stText(code));
    const vn = String(a?.vname ?? '').slice(0, 60) || vassalChannelInfo(idx)?.name || '?', neu = nm.neu || String(a?.name ?? '').slice(0, 60) || '?', old = nm.old || L('옛 통치자', 'the old ruler'), ours = side === 'me';
    s.install[String(idx)] = date; if (nm.old) s.deposed[String(idx)] = { name: nm.old, ruler: neu, since: date, last: date }; save();
    hoiLink.nudge?.(idx, ours ? VR.installOursAuto : VR.installAuto); meddleHit(idx, 'puppet');
    addAppAlarm(`vrinst:${idx}`, [`통치자 교체 다시 가능: ${vn}`, `Ruler replacement available again: ${vn}`], VR.installCoolYears * 360);
    vassalNote(idx, L(`통치자 교체: ${vn}의 ${old}을(를) 밀어내고 ${ours ? '우리 쪽 인물 ' : ''}${neu}을(를) 앉혔다(영향력 -${ours ? VR.installOursCost : VR.installCost}, 자치도 +${ours ? VR.installOursAuto : VR.installAuto}). 새 통치자는 5년간 충성스럽고, ${old}은(는) 궁정에서 원한을 품는다.`,
      `Ruler replaced: in ${vn}, ${old} was pushed aside and ${ours ? 'our own ' : ''}${neu} installed (influence -${ours ? VR.installOursCost : VR.installCost}, autonomy +${ours ? VR.installOursAuto : VR.installAuto}). The new ruler stays loyal for 5 years; ${old} nurses a grudge at court.`));
    chronNote(idx, L(`종주국 ${us()}이(가) ${old}을(를) 밀어내고 ${neu}을(를) 우리 통치자로 앉혔다`, `Our overlord ${us()} deposed ${old} and installed ${neu} as our ruler`));
    chronNoteWorld(L(`${date} ${us()}, 종속국 ${vn}의 통치자를 ${neu}(으)로 갈아치움`, `${date} ${us()} replaces the ruler of its subject ${vn} with ${neu}`), true);
    vassalLetter(idx, 'thanks', 'a first letter as the new ruler', newRulerSituation(neu, ours, old), `${neu}, new ruler of ${vn}`);
    vassalPush();
    return { ok: true, text: L(`${neu}을(를) 통치자로 앉혔습니다.`, `${neu} installed as ruler.`), view: vrView(idx) };
  }));

  // ② 대리전 대상
  ipcMain.handle('vrTargets', async (_e, idx: unknown) => {
    try { const i = needIdx(idx), sid = ctx.curSaveId; if (!sid || !ready()) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      return { ok: true, list: await list(picks, (req) => targetsCommand(req, sid, i), 'VRTEND') };
    } catch (e) { return { ok: false, error: (e as Error).message, list: [] }; }
  });
  // ② 대리전 지시: 종속국이 수락·주저·거절(앱 주사위) → 서신
  ipcMain.handle('vrProxy', async (_e, a: { idx?: unknown; n?: unknown; name?: unknown; vname?: unknown }): Promise<Res> => guardRun(async () => {
    const idx = needIdx(a?.idx), n = Number(a?.n), sid = ctx.curSaveId!, date = ctx.gameDate || '', target = String(a?.name ?? '').slice(0, 60) || '?';
    if (!Number.isSafeInteger(n) || n < 1) return fail(L('칠 나라를 골라 주세요.', 'Pick a country to attack.'));
    const s = saveOf(sid), p = s.proxy[String(idx)];
    if (p && p.state === 'pending') return fail(L('먼저 지난 지시에 대한 종속국의 요청(지원금)에 답해 주세요.', 'First answer the subject\'s request (war funds) on the last order.'));
    if (p && p.state === 'war') return fail(L('이 종속국은 이미 대리전을 치르고 있습니다.', 'This subject is already fighting a proxy war.'));
    const left = p ? coolLeft(p.at, date, VR.proxyCoolYears) : 0; if (left) return fail(L(`대리전 지시는 ${left}년 뒤에 다시 내릴 수 있습니다.`, `You can order another proxy war in ${left} year(s).`));
    const vn = String(a?.vname ?? '').slice(0, 60) || vassalChannelInfo(idx)?.name || '?', au = autonomyOf(idx), ans = proxyRoll(loyaltyOf(idx), au, weAtWar());
    if (ans === 'accept') {
      const r = await declareProxy(sid, idx, n, VR.proxyCost, 0); if (r !== 9) return fail(stText(r));
      s.proxy[String(idx)] = { at: date, target, state: 'war', ans }; save(); meddleHit(idx, 'proxy');
      vassalNote(idx, L(`대리전 지시: ${vn}이(가) 명을 받들어 ${target}에 선전포고했다(영향력 -${VR.proxyCost}).`, `Proxy-war order: ${vn} obeyed and declared war on ${target} (influence -${VR.proxyCost}).`));
      chronNote(idx, L(`종주국 ${us()}의 명으로 ${target}에 선전포고했다`, `At the command of our overlord ${us()}, we declared war on ${target}`));
      chronNoteWorld(L(`${date} ${vn}, 종주국 ${us()}의 뜻에 따라 ${target}에 선전포고 — 대리전이 시작되었다`, `${date} ${vn} declares war on ${target} at the behest of its overlord ${us()} — a proxy war begins`), true);
      vassalLetter(idx, 'thanks', 'a letter answering the order', proxySituation('accept', target, 0));
      vassalPush(); return { ok: true, text: L(`${vn}이(가) 지시를 받아들여 ${target}에 선전포고했습니다.`, `${vn} accepted and declared war on ${target}.`), view: vrView(idx) };
    }
    const pr = await st((req) => payCommand(req, sid, VR.proxyCost)); if (pr !== 9) return fail(stText(pr));
    meddleHit(idx, 'proxy');
    if (ans === 'refuse') {
      s.proxy[String(idx)] = { at: date, target, state: 'refused', ans }; save(); hoiLink.nudge?.(idx, VR.proxyRefuseAuto);
      vassalNote(idx, L(`대리전 지시: ${vn}이(가) ${target}을(를) 치라는 명을 거절했다(영향력 -${VR.proxyCost}, 자치도 +${VR.proxyRefuseAuto}).`, `Proxy-war order: ${vn} refused to attack ${target} (influence -${VR.proxyCost}, autonomy +${VR.proxyRefuseAuto}).`), true);
      chronNote(idx, L(`종주국 ${us()}이(가) ${target}을(를) 치라 했으나 우리는 거절했다`, `Our overlord ${us()} ordered us to attack ${target}; we refused`));
      vassalLetter(idx, 'complaint', 'a letter refusing the order', proxySituation('refuse', target, 0));
      vassalPush(); return { ok: true, text: L(`${vn}이(가) 지시를 거절했습니다.`, `${vn} refused the order.`), view: vrView(idx) };
    }
    const bribe = bribeFor(au);
    s.proxy[String(idx)] = { at: date, target, state: 'pending', ans, bribe }; save();
    vassalNote(idx, L(`대리전 지시: ${vn}이(가) 주저한다 — 전쟁 자금으로 에너지 ${bribe}을(를) 보내 주면 ${target}을(를) 치겠다고 한다.`, `Proxy-war order: ${vn} hesitates — it will attack ${target} if we send ${bribe} energy for the campaign.`), true);
    vassalLetter(idx, 'complaint', 'a hesitant letter answering the order', proxySituation('hesitate', target, bribe));
    vassalPush(); return { ok: true, text: L(`${vn}이(가) 주저하며 에너지 ${bribe}을(를) 바랍니다.`, `${vn} hesitates and asks for ${bribe} energy.`), view: vrView(idx) };
  }));
  // ② 주저한 종속국에 답하기: 지원금 보내기(선포) / 거두기
  ipcMain.handle('vrProxyAnswer', async (_e, a: { idx?: unknown; pay?: unknown }): Promise<Res> => guardRun(async () => {
    const idx = needIdx(a?.idx), sid = ctx.curSaveId!, s = saveOf(sid), p = s.proxy[String(idx)], date = ctx.gameDate || '';
    if (!p || p.state !== 'pending') return fail(L('답할 요청이 없습니다.', 'There is no request to answer.'));
    const vn = vassalChannelInfo(idx)?.name ?? '?';
    if (!a?.pay) { p.state = 'refused'; p.at = date; save(); vassalNote(idx, L(`대리전 지시를 거두었다(${p.target}).`, `The proxy-war order (${p.target}) was withdrawn.`)); vassalPush(); return { ok: true, text: L('지시를 거두었습니다.', 'Order withdrawn.'), view: vrView(idx) }; }
    const l = await list(picks, (req) => targetsCommand(req, sid, idx), 'VRTEND'), t = l.find((x) => x.name === p.target);
    if (!t) return fail(L(`${p.target}은(는) 이제 칠 수 없는 나라입니다(국경·조약이 바뀜). 지시를 거두어 주세요.`, `${p.target} can no longer be attacked (borders or treaties changed). Withdraw the order.`));
    const r = await declareProxy(sid, idx, t.n, 0, p.bribe ?? 0); if (r !== 9) return fail(stText(r));
    p.state = 'war'; p.at = date; save();
    vassalNote(idx, L(`대리전: 에너지 ${p.bribe}을(를) 보내자 ${vn}이(가) ${p.target}에 선전포고했다.`, `Proxy war: after we sent ${p.bribe} energy, ${vn} declared war on ${p.target}.`));
    chronNote(idx, L(`종주국 ${us()}의 전쟁 자금을 받고 ${p.target}에 선전포고했다`, `Funded by our overlord ${us()}, we declared war on ${p.target}`));
    chronNoteWorld(L(`${date} ${vn}, 종주국 ${us()}의 자금을 받고 ${p.target}에 선전포고 — 대리전이 시작되었다`, `${date} ${vn}, funded by ${us()}, declares war on ${p.target} — a proxy war begins`), true);
    vassalPush(); return { ok: true, text: L(`${vn}이(가) ${p.target}에 선전포고했습니다.`, `${vn} declared war on ${p.target}.`), view: vrView(idx) };
  }));

  // ⑥⑦ 함대 목록
  ipcMain.handle('vrFleets', async (_e, idx: unknown) => {
    try { const i = needIdx(idx), sid = ctx.curSaveId; if (!sid || !ready()) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      const r = await fleetList(sid, i); return { ok: true, list: r.list, cnt: r.cnt };
    } catch (e) { return { ok: false, error: (e as Error).message, list: [], cnt: 0 }; }
  });
  // ⑥ 함대 징발: 수락 = 고른 함대 · 주저 = 가장 약한 함대 · 거절 = 자치도 +5
  ipcMain.handle('vrLevy', async (_e, a: { idx?: unknown; n?: unknown; name?: unknown; vname?: unknown }): Promise<Res> => guardRun(async () => {
    const idx = needIdx(a?.idx), n = Number(a?.n), sid = ctx.curSaveId!, date = ctx.gameDate || '', s = saveOf(sid), lv = s.levy[String(idx)];
    if (!Number.isSafeInteger(n) || n < 1) return fail(L('징발할 함대를 골라 주세요.', 'Pick a fleet to levy.'));
    if (lv && lv.state === 'on') return fail(L('이미 이 종속국의 함대를 징발해 쓰고 있습니다.', 'You are already using a fleet levied from this subject.'));
    const left = lv ? coolLeft(lv.until, date, VR.levyCoolYears) : 0; if (left) return fail(L(`징발은 ${left}년 뒤에 다시 할 수 있습니다.`, `You can levy again in ${left} year(s).`));
    const vn = String(a?.vname ?? '').slice(0, 60) || vassalChannelInfo(idx)?.name || '?', ans = levyRoll(loyaltyOf(idx), autonomyOf(idx), weAtWar());
    if (ans === 'refuse') {
      const pr = await st((req) => payCommand(req, sid, VR.levyCost)); if (pr !== 9) return fail(stText(pr));
      hoiLink.nudge?.(idx, VR.levyRefuseAuto); meddleHit(idx, 'levy');
      s.levy[String(idx)] = { at: date, until: date, fleet: String(a?.name ?? '').slice(0, 60), state: 'done', ans }; save();
      vassalNote(idx, L(`함대 징발: ${vn}이(가) 함대를 내주지 않았다(영향력 -${VR.levyCost}, 자치도 +${VR.levyRefuseAuto}).`, `Fleet levy: ${vn} refused to hand over a fleet (influence -${VR.levyCost}, autonomy +${VR.levyRefuseAuto}).`), true);
      vassalLetter(idx, 'complaint', 'a letter refusing the levy', levySituation('refuse', ''));
      vassalPush(); return { ok: true, text: L(`${vn}이(가) 징발을 거절했습니다.`, `${vn} refused the levy.`), view: vrView(idx) };
    }
    let pick = n;
    if (ans === 'hesitate') { const fl = await fleetList(sid, idx); const w = fl.list.slice().sort((x, y) => x.pow - y.pow)[0]; if (!w) return fail(stText(0)); pick = w.n; }
    const r = await ask((req) => levyCommand(req, sid, idx, pick, VR.levyCost), 'VRSET', (req) => names.set(req, {}));
    const nm = names.get(r.req) ?? {}; names.delete(r.req); const code = r.m ? Math.round(num(r.m.kv.st)) : -1; if (code !== 9) return fail(stText(code));
    const fleet = nm.neu || String(a?.name ?? '').slice(0, 60) || '?', until = addDays(date, VR.levyDays);
    s.levy[String(idx)] = { at: date, until, fleet, state: 'on', ans }; save(); meddleHit(idx, 'levy');
    vassalNote(idx, ans === 'accept' ? L(`함대 징발: ${vn}이(가) 「${fleet}」을(를) 내주었다 — ${until}까지 우리 지휘 아래(영향력 -${VR.levyCost}).`, `Fleet levy: ${vn} handed over the "${fleet}" — under our command until ${until} (influence -${VR.levyCost}).`)
      : L(`함대 징발: ${vn}이(가) 주저하며 가장 약한 「${fleet}」만 보냈다 — ${until}까지(영향력 -${VR.levyCost}).`, `Fleet levy: ${vn} hesitated and sent only its weakest, the "${fleet}" — until ${until} (influence -${VR.levyCost}).`), ans !== 'accept');
    chronNote(idx, L(`종주국 ${us()}에게 함대 「${fleet}」을(를) 2년간 내주었다`, `We lent our fleet "${fleet}" to our overlord ${us()} for two years`));
    vassalLetter(idx, ans === 'accept' ? 'thanks' : 'complaint', 'a letter about the levy', levySituation(ans, fleet));
    vassalPush(); return { ok: true, text: ans === 'accept' ? L(`「${fleet}」이(가) 우리 지휘 아래 들어왔습니다.`, `The "${fleet}" is now under our command.`) : L(`${vn}이(가) 주저하며 「${fleet}」만 보냈습니다.`, `${vn} hesitated and sent only the "${fleet}".`), view: vrView(idx) };
  }));
  // ⑦ 함대 헌납 요구: 받아들이면 넘겨받고, 거절하면 「강제로 받아 내기 / 그만두기」를 기다린다.
  async function doTithe(sid: string, idx: number, n: number, name: string, force: boolean): Promise<{ code: number; fleet: string }> {
    const r = await ask((req) => titheCommand(req, sid, idx, n, VR.titheCost, force), 'VRSET', (req) => names.set(req, {}));
    const nm = names.get(r.req) ?? {}; names.delete(r.req); return { code: r.m ? Math.round(num(r.m.kv.st)) : -1, fleet: nm.neu || name || '?' };
  }
  ipcMain.handle('vrTithe', async (_e, a: { idx?: unknown; n?: unknown; name?: unknown; vname?: unknown; cnt?: unknown }): Promise<Res> => guardRun(async () => {
    const idx = needIdx(a?.idx), n = Number(a?.n), sid = ctx.curSaveId!, date = ctx.gameDate || '', s = saveOf(sid), t = s.tithe[String(idx)], name = String(a?.name ?? '').slice(0, 60);
    if (!Number.isSafeInteger(n) || n < 1) return fail(L('넘겨받을 함대를 골라 주세요.', 'Pick a fleet to take.'));
    if (t && t.state === 'pending') return fail(L('먼저 지난 요구(거절당함)를 정리해 주세요.', 'First settle the last (refused) demand.'));
    const left = t && (t.state === 'done' || t.state === 'forced') ? coolLeft(t.at, date, VR.titheCoolYears) : 0; if (left) return fail(L(`함대 헌납은 ${left}년 뒤에 다시 요구할 수 있습니다.`, `You can demand a fleet again in ${left} year(s).`));
    if (Number(a?.cnt) > 0 && Number(a?.cnt) < 2) return fail(stText(5));
    const vn = String(a?.vname ?? '').slice(0, 60) || vassalChannelInfo(idx)?.name || '?';
    if (Math.random() >= titheChance(loyaltyOf(idx), autonomyOf(idx))) {
      s.tithe[String(idx)] = { at: date, fleet: name, state: 'pending' }; save(); meddleHit(idx, 'levy');
      vassalNote(idx, L(`함대 헌납: ${vn}이(가) 「${name}」을(를) 바치라는 요구를 거절했다. 강제로 받아 낼 수도, 그만둘 수도 있다.`, `Fleet tithe: ${vn} refused to hand over the "${name}". You may seize it or let it go.`), true);
      vassalLetter(idx, 'complaint', 'a letter refusing the demand', titheSituation('refuse', name));
      vassalPush(); return { ok: true, text: L(`${vn}이(가) 거절했습니다. 강제로 받아 낼지 정해 주세요.`, `${vn} refused. Decide whether to seize it.`), view: vrView(idx) };
    }
    const r = await doTithe(sid, idx, n, name, false); if (r.code !== 9) return fail(stText(r.code));
    s.tithe[String(idx)] = { at: date, fleet: r.fleet, state: 'done' }; save(); hoiLink.nudge?.(idx, VR.titheAuto); meddleHit(idx, 'tithe');
    vassalNote(idx, L(`함대 헌납: ${vn}이(가) 「${r.fleet}」을(를) 우리에게 바쳤다(영향력 -${VR.titheCost}, 자치도 +${VR.titheAuto}, 2년간 충성도 매달 -1).`, `Fleet tithe: ${vn} handed the "${r.fleet}" to us for good (influence -${VR.titheCost}, autonomy +${VR.titheAuto}, loyalty -1/month for 2 years).`));
    chronNote(idx, L(`종주국 ${us()}에게 함대 「${r.fleet}」을(를) 바쳤다`, `We handed our fleet "${r.fleet}" to our overlord ${us()}`));
    chronNoteWorld(L(`${date} ${vn}, 종주국 ${us()}에게 함대 「${r.fleet}」을(를) 바침`, `${date} ${vn} hands its fleet "${r.fleet}" to its overlord ${us()}`), true);
    vassalLetter(idx, 'complaint', 'a letter about the tithe', titheSituation('accept', r.fleet));
    vassalPush(); return { ok: true, text: L(`「${r.fleet}」이(가) 이제 우리 함대입니다.`, `The "${r.fleet}" is now ours.`), view: vrView(idx) };
  }));
  ipcMain.handle('vrTitheForce', async (_e, a: { idx?: unknown; force?: unknown }): Promise<Res> => guardRun(async () => {
    const idx = needIdx(a?.idx), sid = ctx.curSaveId!, date = ctx.gameDate || '', s = saveOf(sid), t = s.tithe[String(idx)], vn = vassalChannelInfo(idx)?.name ?? '?';
    if (!t || t.state !== 'pending') return fail(L('정리할 요구가 없습니다.', 'There is no demand to settle.'));
    if (!a?.force) { t.state = 'dropped'; t.at = date; save(); vassalNote(idx, L(`함대 헌납 요구(「${t.fleet}」)를 거두었다.`, `The fleet demand ("${t.fleet}") was dropped.`)); vassalPush(); return { ok: true, text: L('요구를 거두었습니다.', 'Demand dropped.'), view: vrView(idx) }; }
    const fl = await fleetList(sid, idx), f = fl.list.find((x) => x.name === t.fleet);
    if (!f) return fail(L(`「${t.fleet}」을(를) 찾을 수 없습니다(전투 중·임대 중·파괴). 요구를 거두어 주세요.`, `Cannot find the "${t.fleet}" (in combat, leased or destroyed). Drop the demand.`));
    if (fl.cnt < 2) return fail(stText(5));
    const r = await doTithe(sid, idx, f.n, t.fleet, true); if (r.code !== 9) return fail(stText(r.code));
    t.state = 'forced'; t.at = date; t.fleet = r.fleet; save(); hoiLink.nudge?.(idx, VR.titheForceAuto); meddleHit(idx, 'force');
    vassalNote(idx, L(`함대 강제 헌납: ${vn}의 「${r.fleet}」을(를) 억지로 넘겨받았다(영향력 -${VR.titheCost}, 자치도 +${VR.titheForceAuto}, 3년간 충성도 매달 -2).`, `Fleet seized: we took ${vn}'s "${r.fleet}" by force (influence -${VR.titheCost}, autonomy +${VR.titheForceAuto}, loyalty -2/month for 3 years).`), true);
    chronNote(idx, L(`종주국 ${us()}이(가) 우리 함대 「${r.fleet}」을(를) 강제로 빼앗아 갔다`, `Our overlord ${us()} seized our fleet "${r.fleet}" by force`));
    chronNoteWorld(L(`${date} ${us()}, 종속국 ${vn}의 함대 「${r.fleet}」을(를) 강제로 빼앗음`, `${date} ${us()} seizes the fleet "${r.fleet}" from its subject ${vn}`), true);
    vassalLetter(idx, 'complaint', 'a bitter letter', titheSituation('force', r.fleet));
    vassalPush(); return { ok: true, text: L(`「${r.fleet}」을(를) 강제로 넘겨받았습니다.`, `Seized the "${r.fleet}".`), view: vrView(idx) };
  }));

  // ⑤ 종속국 쟁탈 후보·전쟁명분
  ipcMain.handle('vrPrizes', async () => {
    try { const sid = ctx.curSaveId; if (!sid || !ready()) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      return { ok: true, list: await list(picks, (req) => prizesCommand(req, sid), 'VRPZEND') };
    } catch (e) { return { ok: false, error: (e as Error).message, list: [] }; }
  });
  ipcMain.handle('vrPrize', async (_e, a: { n?: unknown; name?: unknown; ov?: unknown; idx?: unknown }): Promise<Res> => guardRun(async () => {
    const n = Number(a?.n), sid = ctx.curSaveId!, name = String(a?.name ?? '').slice(0, 60) || '?', ov = String(a?.ov ?? '').slice(0, 60) || '?', idx = Number(a?.idx) || 0;
    if (!Number.isSafeInteger(n) || n < 1) return fail(L('빼앗을 종속국을 골라 주세요.', 'Pick a subject to take.'));
    const r = await st((req) => prizeCommand(req, sid, n)); if (r !== 9) return fail(stText(r));
    chronNoteWorld(L(`${ctx.gameDate} ${us()}, ${ov}의 종속국 ${name}에 대한 권리를 주장 — 전쟁의 그림자`, `${ctx.gameDate} ${us()} lays claim to ${ov}'s subject ${name} — war looms`), true);
    addAppAlarm(`vrprize:${n}`, [`종속국 쟁탈 명분 끝: ${name}`, `Subject claim expires: ${name}`], VR.prizeDays);
    return { ok: true, text: L(`${ov}에 대한 전쟁명분 「종속국 쟁탈」을 얻었습니다(${Math.round(VR.prizeDays / 360)}년). 외교 화면에서 「종속국 빼앗기」 목표로 선전포고하세요.`, `Gained the "Contested Subject" casus belli against ${ov} (${Math.round(VR.prizeDays / 360)} years). Declare war from the diplomacy screen with the "Take Their Subject" war goal.`), view: vrView(idx > 0 ? idx : 0) };
  }));
}
