// 여당·야당(2026-11-03). 규칙·문장: src/parliament.ts. 화면: ui/office-audit.js(집무실 「의회」 맨 위 「의석」 칸). 단일 의식 제국에는 없다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import type { StateSnapshot } from '../gamestate';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { redactKey } from '../aiclient';
import { monthsBetween } from '../letters';
import { terminalRequest } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { moodView, moodNudge } from './mood-app';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { civicRegimeNow } from './civic-app';
import { namePair } from './namegen-app';
import { parlHooks } from './parl-hooks'; // 정책 파벌 표결에 의회 진영을 넘긴다
import { PARL_VOTE } from '../policy-review';
import { type ParlSave, type Fac, type Leader, type Chamber, PARL, emptyParl, facKey, chamber, coalitionChance, partnerTick, decayAdj, rollEvent, talkMessages, parseTalk, parlCommand, parlFacts } from '../parliament';

interface Store { saves: Record<string, ParlSave> }
const file = () => path.join(app.getPath('userData'), 'sllm_parliament.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const strRec = (v: unknown) => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
const numRec = (v: unknown) => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => Number.isFinite(x))) as Record<string, number>;
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), d = obj(x.deal), leaders: Record<string, Leader> = {};
    for (const [k, l] of Object.entries(obj(x.leaders))) { const o = obj(l); if (typeof o.ko === 'string' && typeof o.en === 'string') leaders[k] = { ko: o.ko, en: o.en, g: o.g === 'f' ? 'f' : 'm' }; }
    saves[safeKey(sid)] = {
      ...emptyParl(), coalition: Array.isArray(x.coalition) ? (x.coalition as unknown[]).filter((q): q is string => typeof q === 'string').slice(0, 8) : [],
      ...(typeof d.key === 'string' && typeof d.until === 'string' ? { deal: { key: d.key, until: d.until } } : {}),
      adj: numRec(x.adj), low: numRec(x.low), refused: strRec(x.refused), leaders, relation: Math.max(-100, Math.min(100, Number(x.relation) || 0)),
      ...Object.fromEntries((['lastTalk', 'lastPoach', 'lastDeal', 'lastSeen', 'lastDecay'] as const).filter((k) => typeof x[k] === 'string').map((k) => [k, x[k]])),
      log: Array.isArray(x.log) ? (x.log as Array<{ date: string; text: string }>).filter((q) => q && typeof q.text === 'string').slice(-30) : [],
      ...(Object.keys(strRec(x.pending)).length ? { pending: Object.fromEntries(Object.entries(strRec(x.pending)).slice(-10)) } : {}),
    };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'parliament', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'parliament', error: e }); } }, 1500); }
const entry = (sid: string): ParlSave => (all().saves[safeKey(sid)] ??= emptyParl());
const empire = () => ctx.playerName || L('우리 제국', 'our empire');
const note = (s: ParlSave, text: string) => { s.log = [...s.log, { date: ctx.gameDate || '', text }].slice(-30); };

/** 지금 파벌(마지막 월간 상황). */
function factions(sid: string): Fac[] {
  const snap = gameState.last && gameState.last.sid === sid ? gameState.last : null;
  return (snap?.factions ?? []).map((f) => ({ key: facKey(f), ...(f.fid ? { fid: f.fid } : {}), name: f.name, ethic: f.ethic, support: Math.round(f.support * 100), approval: Math.round(f.approval * 100) })); // 게임 값은 0~1(gamestate frac) → %
}
const empireEth = (sid: string) => (gameState.last && gameState.last.sid === sid ? gameState.last.empireEth : undefined);
function chamberNow(sid: string): Chamber { return chamber(factions(sid), entry(sid), empireEth(sid), ctx.gameDate || ''); }
/** 야당 대표(성향 파벌마다 한 명, 게임의 종족별 이름 표에서). */
function leaderOf(sid: string, key: string | null): Leader | null {
  if (!key) return null; const s = entry(sid); if (s.leaders[key]) return s.leaders[key];
  const g: 'm' | 'f' = Math.random() < 0.5 ? 'm' : 'f', seed = Math.floor(Math.random() * 1e9);
  const n = (() => { try { return namePair(g, null, seed); } catch { return null; } })(); if (!n) return null;
  s.leaders[key] = { ko: n.ko, en: n.en, g }; save(); return s.leaders[key];
}
const lname = (l: Leader | null) => (l ? L(l.ko, l.en) : L('야당 대표', 'the opposition leader'));
const approvalNow = (): number | null => { const v = moodView(); const a = v.parts?.approval ?? v.score; return a === null || a === undefined ? null : Math.round(a); };

/** 불신임 표결이 쓰는 정부 의석(noconf-app). 자유 정부가 아니거나 모르면 null. */
export function govSeatsNow(sid = ctx.curSaveId || ''): number | null { if (!sid || civicRegimeNow() !== 'free') return null; const f = factions(sid); return f.length ? chamberNow(sid).gov : null; }
/** 불신임안을 낼 사람(야당 대표 이름·파벌). */
export function oppositionMover(sid = ctx.curSaveId || ''): { name: string; faction: string } | null {
  if (!sid) return null; const c = chamberNow(sid), o = c.seats.find((x) => x.key === c.opp); if (!o) return null;
  return { name: lname(leaderOf(sid, o.key)), faction: o.name };
}

/** 양당 정치(twoparty-app, 2026-11-06)가 읽는 지금 의회: 파벌·의석·제1야당 대표 이름·최근 기록. 자유 정부가 아니거나 파벌이 없으면 null. */
export function parlNow(sid = ctx.curSaveId || ''): { facs: Fac[]; c: Chamber; oppLeader: string; deal: boolean; log: string[] } | null {
  if (!sid || civicRegimeNow() !== 'free') return null; const facs = factions(sid); if (!facs.length) return null;
  const s = entry(sid), c = chamberNow(sid), date = ctx.gameDate || '';
  return { facs, c, oppLeader: lname(leaderOf(sid, c.opp)), deal: !!(s.deal && monthsBetween(date, s.deal.until) > 0), log: s.log.slice(-8).map((x) => x.text) };
}
/** 총선 결과로 의석을 옮긴다(양당 정치). moves = 파벌 열쇠 → ±석. 해마다 1석씩 원래대로 돌아가는 것은 다른 의석 이동과 같다. */
export function parlShiftSeats(sid: string, moves: Record<string, number>, why: string): void {
  if (!sid) return; const s = entry(sid);
  for (const [k, d] of Object.entries(moves)) { if (!Number.isFinite(d) || !d) continue; s.adj[k] = (s.adj[k] ?? 0) + Math.round(d); if (!s.adj[k]) delete s.adj[k]; }
  if (why) note(s, why); save(); push();
}

async function effect(sid: string, ops: Parameters<typeof parlCommand>[2], cm?: Parameters<typeof parlCommand>[3]): Promise<string> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return 'offline';
  try { const req = ++link.reqCounter, m = await terminalRequest(parlCommand(req, sid, ops, cm), 'CIVIC', req); return m.kv.status || 'unknown'; }
  catch (e) { logDiagnostic('warn', 'parliament.effect_failed', { error: (e as Error).message }); return 'failed'; }
}

function onSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId) return;
  setTimeout(() => {
    try {
      if (snap.sid !== ctx.curSaveId || civicRegimeNow() !== 'free') return;
      const sid = snap.sid, s = entry(sid), date = snap.date; if (s.lastSeen === date) return; s.lastSeen = date;
      const facs = factions(sid); if (!facs.length) { save(); return; }
      decayAdj(s, date);
      const broke = partnerTick(s, facs);
      for (const k of broke) {
        const f = facs.find((x) => x.key === k); if (f?.fid) void effect(sid, [{ fid: f.fid, mod: PARL.coalitionMod, days: 1, remove: true }]);
        const t = L(`「${f?.name ?? k}」이(가) 정부에 대한 불만으로 연정에서 탈퇴했다.`, `The ${f?.name ?? k} left the coalition in protest at the government.`);
        note(s, t); chronNoteWorld(`${date} ${t}`, true);
        ctx.notify({ kind: 'office', title: L('연정 붕괴', 'Coalition collapse'), body: t });
      }
      const c = chamber(facs, s, snap.empireEth, date), ev = rollEvent(c, approvalNow(), s.relation, Math.random);
      if (ev) {
        const nm = (k: string) => c.seats.find((x) => x.key === k)?.name ?? k;
        let t = '';
        if (ev.kind === 'defect_out') { s.adj[ev.from] = (s.adj[ev.from] ?? 0) - ev.n; t = L(`정부 쪽 「${nm(ev.from)}」 의원 ${ev.n}명이 탈당해 무소속이 되었다.`, `${ev.n} members of the ${nm(ev.from)} on the government side quit and sat as independents.`); }
        else if (ev.kind === 'defect_in' && c.ruling) { s.adj[ev.from] = (s.adj[ev.from] ?? 0) - ev.n; s.adj[c.ruling] = (s.adj[c.ruling] ?? 0) + ev.n; t = L(`야당 「${nm(ev.from)}」 의원 ${ev.n}명이 여당으로 넘어왔다.`, `${ev.n} opposition members of the ${nm(ev.from)} crossed the floor to the ruling party.`); }
        else if (ev.kind === 'rally') { moodNudge(-2, L('야당 장외 투쟁', 'Opposition street rally')); t = L(`${lname(leaderOf(sid, c.opp))} 야당 대표가 장외 투쟁에 나섰다. 수도 광장에 군중이 모였다.`, `Opposition leader ${lname(leaderOf(sid, c.opp))} took the fight to the streets. Crowds filled the capital's square.`); }
        else if (c.opp) t = L(`${lname(leaderOf(sid, c.opp))} 야당 대표가 정부를 비판하는 성명을 냈다.`, `Opposition leader ${lname(leaderOf(sid, c.opp))} issued a statement attacking the government.`);
        if (t) { note(s, t); chronNoteWorld(`${date} ${t}`, true); }
      }
      save(); push();
    } catch (err) { logDiagnostic('warn', 'parliament.tick_failed', { error: String(err) }); }
  }, 0);
}

const talks = new Map<string, Array<{ who: 'us' | 'them'; text: string }>>();
export function parliamentView() {
  const sid = ctx.curSaveId || '', reg = civicRegimeNow(), date = ctx.gameDate || '';
  if (!sid) return { sid: '', regime: reg };
  // 파벌이 없을 때: 아직 상태 조사 전이면 'wait', 조사는 왔는데 게임에 파벌이 하나도 없으면 'none'(정당이 없는 의회: 모두 무소속, 연정·거래·회담 없음, 불신임 의석 보정 0).
  if (!factions(sid).length) return { sid, date, regime: reg, total: PARL.seats, seats: [], noFac: gameState.last && gameState.last.sid === sid ? 'none' : 'wait', running: ctx.gameRunning, log: entry(sid).log.slice(-10).reverse() };
  const s = entry(sid), facs = factions(sid), c = chamberNow(sid), opp = c.opp ? leaderOf(sid, c.opp) : null, ruling = facs.find((f) => f.key === c.ruling);
  const t = talks.get(sid) ?? null;
  return {
    sid, date, regime: reg, total: PARL.seats, majorityNeed: PARL.majority, gov: c.gov, majority: c.majority, relation: s.relation, running: ctx.gameRunning,
    seats: c.seats.map((x) => ({ ...x, approval: facs.find((f) => f.key === x.key)?.approval ?? null,
      offer: x.side === 'opposition' && reg === 'free' ? { chance: Math.round(coalitionChance(facs.find((f) => f.key === x.key)!, ruling?.ethic ?? '', s.relation) * 100), block: s.refused[x.key] && monthsBetween(s.refused[x.key], date) < PARL.offerCooldownMonths ? L('얼마 전에 거절했습니다.', 'They refused recently.') : '' } : null })),
    oppLeader: opp ? { name: lname(opp), faction: c.seats.find((x) => x.key === c.opp)?.name ?? '' } : null,
    talk: { active: !!t, turns: t ?? [], left: PARL.talkTurns - (t ? t.filter((x) => x.who === 'us').length : 0), block: !t && s.lastTalk && monthsBetween(s.lastTalk, date) < PARL.talkGapMonths ? L(`영수회담은 ${PARL.talkGapMonths}개월에 한 번입니다.`, `Leaders' summits are held once every ${PARL.talkGapMonths} months.`) : '' },
    poach: { energy: PARL.poachEnergy, seats: PARL.poachSeats, block: s.lastPoach && monthsBetween(s.lastPoach, date) < PARL.poachGapMonths ? L('1년에 한 번만 할 수 있습니다.', 'Only once a year.') : '' },
    deal: { active: s.deal && monthsBetween(date, s.deal.until) > 0 ? { key: s.deal.key, until: s.deal.until } : null, block: s.lastDeal && monthsBetween(s.lastDeal, date) < PARL.dealGapMonths ? L('2년에 한 번만 할 수 있습니다.', 'Only once every two years.') : '' },
    log: s.log.slice(-10).reverse(),
  };
}
function push(): void { try { const v = parliamentView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('parliamentUpdate', v); } catch { /* 창 없음 */ } }

function guard(): { sid: string; s: ParlSave; facs: Fac[]; c: Chamber } {
  const sid = ctx.curSaveId || ''; if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (civicRegimeNow() !== 'free') throw new Error(L('자유로운 의회가 있는 정부 형태에서만 할 수 있습니다.', 'Only possible under a government with a free parliament.'));
  const facs = factions(sid); if (!facs.length) throw new Error(L('파벌 정보가 아직 없습니다. 한 달 뒤에 다시 해 주세요.', 'No faction data yet. Try again next month.'));
  return { sid, s: entry(sid), facs, c: chamberNow(sid) };
}
async function coalitionOffer(keyIn: unknown): Promise<string> {
  const { sid, s, facs, c } = guard(), key = String(keyIn ?? ''), f = facs.find((x) => x.key === key), date = ctx.gameDate || '';
  if (!f || c.seats.find((x) => x.key === key)?.side !== 'opposition') throw new Error(L('연정을 제안할 수 없는 파벌입니다.', 'You cannot offer a coalition to that faction.'));
  if (s.refused[key] && monthsBetween(s.refused[key], date) < PARL.offerCooldownMonths) throw new Error(L('얼마 전에 거절당했습니다. 2년 뒤에 다시 제안할 수 있습니다.', 'They refused recently. You can try again after two years.'));
  const ruling = facs.find((x) => x.key === c.ruling), p = coalitionChance(f, ruling?.ethic ?? '', s.relation);
  if (Math.random() >= p) { s.refused[key] = date; note(s, L(`「${f.name}」이(가) 연정 제안을 거절했다.`, `The ${f.name} turned down a coalition offer.`)); save(); push(); return L(`「${f.name}」이(가) 연정 제안을 거절했습니다(수락 확률 ${Math.round(p * 100)}%).`, `The ${f.name} turned the coalition down (${Math.round(p * 100)}% chance).`); }
  s.coalition = [...s.coalition.filter((k) => k !== key), key]; delete s.refused[key]; s.low[key] = 0;
  const t = L(`「${f.name}」이(가) 연정에 합류했다.`, `The ${f.name} joined the governing coalition.`); note(s, t); save();
  if (f.fid) await effect(sid, [{ fid: f.fid, mod: PARL.coalitionMod, days: PARL.modDays }]);
  chronNoteWorld(`${date} ${t}`, true); push();
  return L(`「${f.name}」이(가) 연정에 합류했습니다. 이 파벌의 정부 승인도가 오릅니다. 승인도가 35% 아래로 석 달 이어지면 연정을 떠납니다.`, `The ${f.name} joined the coalition and approves of the government more. If its approval stays below 35% for three months it will leave.`);
}
async function coalitionLeave(keyIn: unknown): Promise<string> {
  const { sid, s, facs } = guard(), key = String(keyIn ?? ''), f = facs.find((x) => x.key === key);
  if (!s.coalition.includes(key)) throw new Error(L('연정에 있는 파벌이 아닙니다.', 'That faction is not in the coalition.'));
  s.coalition = s.coalition.filter((k) => k !== key); const t = L(`정부가 「${f?.name ?? key}」와(과)의 연정을 끝냈다.`, `The government ended its coalition with the ${f?.name ?? key}.`); note(s, t); save();
  if (f?.fid) await effect(sid, [{ fid: f.fid, mod: PARL.coalitionMod, days: 1, remove: true }, { fid: f.fid, mod: PARL.spurnMod, days: PARL.spurnDays }]);
  chronNoteWorld(`${ctx.gameDate || ''} ${t}`, true); push(); return t;
}
async function poach(keyIn: unknown): Promise<string> {
  const { sid, s, facs, c } = guard(), key = String(keyIn ?? ''), f = facs.find((x) => x.key === key), date = ctx.gameDate || '';
  if (!f || c.seats.find((x) => x.key === key)?.side !== 'opposition' || !c.ruling) throw new Error(L('의원을 데려올 수 없는 파벌입니다.', 'You cannot poach from that faction.'));
  if (s.lastPoach && monthsBetween(s.lastPoach, date) < PARL.poachGapMonths) throw new Error(L('의원 빼오기는 1년에 한 번만 할 수 있습니다.', 'Poaching is possible only once a year.'));
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  const st = await (async () => { try { const req = ++link.reqCounter, m = await terminalRequest(`effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { resource_stockpile_compare = { resource = energy value >= ${PARL.poachEnergy} } } add_resource = { energy = -${PARL.poachEnergy} } log = "SLLM:CIVIC/;/req=${req}/;/sid=${sid}/;/what=parl/;/status=applied" } else = { log = "SLLM:CIVIC/;/req=${req}/;/sid=${sid}/;/what=parl/;/status=nocash" } }`, 'CIVIC', req); return m.kv.status; } catch { return 'failed'; } })();
  if (st === 'nocash') throw new Error(L(`에너지가 모자랍니다(${PARL.poachEnergy} 필요).`, `Not enough energy (${PARL.poachEnergy} needed).`));
  if (st !== 'applied') throw new Error(L('게임이 답하지 않았습니다.', 'The game did not answer.'));
  s.lastPoach = date; s.adj[key] = (s.adj[key] ?? 0) - PARL.poachSeats; s.adj[c.ruling] = (s.adj[c.ruling] ?? 0) + PARL.poachSeats;
  const caught = Math.random() < PARL.poachExpose;
  note(s, L(`「${f.name}」 의원 ${PARL.poachSeats}명을 여당으로 데려왔다${caught ? '(매수가 드러났다)' : ''}.`, `Brought ${PARL.poachSeats} members of the ${f.name} over to the ruling party${caught ? ' (the bribery came out)' : ''}.`)); save();
  if (caught) {
    moodNudge(-6, L('의원 매수 스캔들', 'MP bribery scandal'));
    await effect(sid, f.fid ? [{ fid: f.fid, mod: PARL.spurnMod, days: PARL.spurnDays }] : [], { mod: PARL.scandalMod, days: PARL.scandalDays });
    s.relation = Math.max(-100, s.relation - 25); save();
    chronNoteWorld(L(`${date} 정부가 「${f.name}」 의원들을 돈으로 빼 왔다는 사실이 드러났다. 매수 스캔들이 번지고 있다.`, `${date} It came out that the government bought members of the ${f.name}. A bribery scandal is spreading.`), true); push();
    return L(`의원 ${PARL.poachSeats}명을 데려왔지만 매수가 드러났습니다. 2년 동안 안정도 −6, 민심 −6, 야당과의 관계가 크게 나빠졌습니다.`, `You brought over ${PARL.poachSeats} members, but the bribery came out: −6 stability for 2 years, −6 approval, and relations with the opposition sour badly.`);
  }
  push(); return L(`에너지 ${PARL.poachEnergy}을(를) 써서 「${f.name}」 의원 ${PARL.poachSeats}명을 여당으로 데려왔습니다. 의석은 해마다 1석씩 원래대로 돌아갑니다.`, `For ${PARL.poachEnergy} energy, ${PARL.poachSeats} members of the ${f.name} crossed to the ruling party. One seat a year drifts back.`);
}
async function deal(keyIn: unknown): Promise<string> {
  const { sid, s, facs, c } = guard(), key = String(keyIn ?? ''), f = facs.find((x) => x.key === key), date = ctx.gameDate || '';
  if (!f || c.seats.find((x) => x.key === key)?.side !== 'opposition') throw new Error(L('법안 거래를 할 수 없는 파벌입니다.', 'You cannot strike a deal with that faction.'));
  if (s.lastDeal && monthsBetween(s.lastDeal, date) < PARL.dealGapMonths) throw new Error(L('법안 거래는 2년에 한 번만 할 수 있습니다.', 'A legislative deal is possible only once every two years.'));
  const y = /^(\d+)\.(\d+)\.(\d+)/.exec(date); const until = y ? `${Number(y[1]) + 2}.${y[2]}.${y[3]}` : date;
  s.deal = { key, until }; s.lastDeal = date;
  const ruling = facs.find((x) => x.key === c.ruling);
  const t = L(`정부가 「${f.name}」의 숙원 법안을 들어주고 2년 동안 표를 얻었다. 여당 안에서 볼멘소리가 나온다.`, `The government granted the ${f.name} its cherished bill in return for two years of votes. Grumbling is heard within the ruling party.`);
  note(s, t); save();
  await effect(sid, [...(f.fid ? [{ fid: f.fid, mod: PARL.dealMod, days: PARL.dealDays }] : []), ...(ruling?.fid ? [{ fid: ruling.fid, mod: PARL.spurnMod, days: PARL.spurnDays }] : [])]);
  chronNoteWorld(`${date} ${t}`, true); push();
  return L(`「${f.name}」와(과) 법안 거래를 맺었습니다. 2년 동안 이 파벌 의석이 정부 쪽으로 계산되고, 대신 여당 파벌의 승인도가 조금 떨어집니다.`, `Deal struck with the ${f.name}: for 2 years its seats count for the government, but the ruling faction's approval dips a little.`);
}
async function talk(textIn: unknown, endIn: unknown): Promise<{ text?: string }> {
  const sid = ctx.curSaveId || '', date = ctx.gameDate || ''; if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (civicRegimeNow() !== 'free') throw new Error(L('자유로운 의회가 있는 정부 형태에서만 할 수 있습니다.', 'Only possible under a government with a free parliament.'));
  const s = entry(sid), c = chamberNow(sid), o = c.seats.find((x) => x.key === c.opp); if (!o) throw new Error(L('야당이 없습니다.', 'There is no opposition.'));
  let t = talks.get(sid);
  if (endIn === true) { if (!t) throw new Error(L('진행 중인 회담이 없습니다.', 'No summit in progress.')); talks.delete(sid); s.lastTalk = date; save(); chronNoteWorld(L(`${date} 통치자와 ${lname(leaderOf(sid, o.key))} 야당 대표가 영수회담을 가졌다.`, `${date} The ruler held a leaders' summit with opposition leader ${lname(leaderOf(sid, o.key))}.`), true); push(); return { text: L(`회담을 마쳤습니다. 야당과의 관계: ${s.relation}`, `The summit is over. Relations with the opposition: ${s.relation}`) }; }
  const say = String(textIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 800); if (!say) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
  if (!t) { if (s.lastTalk && monthsBetween(s.lastTalk, date) < PARL.talkGapMonths) throw new Error(L(`영수회담은 ${PARL.talkGapMonths}개월에 한 번입니다.`, `Leaders' summits are held once every ${PARL.talkGapMonths} months.`)); t = []; }
  const ld = leaderOf(sid, o.key);
  let r: ReturnType<typeof parseTalk> = null;
  try { r = parseTalk(await ctx.ai.chat(talkMessages({ empire: empire(), date, leader: lname(ld), faction: o.name, ethic: o.ethic, seats: o.seats, gov: c.gov, relation: s.relation, approval: approvalNow(), notes: s.log.slice(-6).map((x) => x.text) }, t, say), { purpose: 'parliament-talk', json: true, maxTokens: PARL.talkTokens })); }
  catch (err) { throw new Error(L('AI가 답하지 못했습니다: ', 'The AI did not answer: ') + redactKey((err as Error).message)); }
  if (!r) throw new Error(L('답을 이해하지 못했습니다. 다시 말해 보세요.', 'Could not understand the reply. Try again.'));
  t.push({ who: 'us', text: say }, { who: 'them', text: r.reply }); talks.set(sid, t);
  s.relation = Math.max(-100, Math.min(100, s.relation + r.relation)); if (r.note) note(s, r.note); save();
  if (t.filter((x) => x.who === 'us').length >= PARL.talkTurns) return talk('', true);
  push(); return {};
}

export function registerParliament(): void {
  onGameSnapshot(onSnapshot, 'parliament');
  // 정책 파벌 표결(policy-review): 여당·연정은 +1, 법안 거래 파벌은 +2, 제1야당은 영수회담 관계(±25 넘으면 ±1)에 따라 흔들린다.
  parlHooks.bloc = () => {
    const sid = ctx.curSaveId || ''; if (!sid || civicRegimeNow() !== 'free' || !factions(sid).length) return null;
    const c = chamberNow(sid), side: Record<string, 'ruling' | 'coalition' | 'deal' | 'opposition'> = {};
    for (const x of c.seats) if (x.side !== 'ind') side[x.key] = x.side;
    const seats: Record<string, number> = {}; for (const x of c.seats) seats[x.key] = x.seats;
    return { side, oppLead: c.opp, relation: entry(sid).relation, seats };
  };
  const oppName = (sid: string) => { const c = chamberNow(sid); return lname(leaderOf(sid, c.opp)); };
  parlHooks.pending = (bill) => { const sid = ctx.curSaveId || ''; return sid ? entry(sid).pending?.[bill] ?? null : null; };
  const unpend = (s: ParlSave, bill: string) => { if (s.pending) { delete s.pending[bill]; if (!Object.keys(s.pending).length) delete s.pending; } };
  parlHooks.filibuster = (by, until, bill) => {
    const sid = ctx.curSaveId || '', date = ctx.gameDate || ''; if (!sid) return; const s = entry(sid);
    s.pending = Object.fromEntries([...Object.entries(s.pending ?? {}).filter(([k]) => k !== bill), [bill, until]].slice(-10));
    note(s, L(`야당(${by.join(', ')})이 정부 법안에 필리버스터를 걸었다. ${until}까지 의사 진행이 막힌다.`, `The opposition (${by.join(', ')}) filibustered a government bill. Business is blocked until ${until}.`)); save(); push();
    chronNoteWorld(L(`${date} ${oppName(sid)} 야당 대표가 이끄는 야당이 정부 법안에 필리버스터를 걸었다. 의사당의 불은 밤새 꺼지지 않았다.`, `${date} The opposition, led by ${oppName(sid)}, filibustered a government bill. The lights in the chamber stayed on all night.`), true);
  };
  parlHooks.outlasted = (title, bill) => {
    const sid = ctx.curSaveId || '', date = ctx.gameDate || ''; if (!sid) return; const s = entry(sid); unpend(s, bill);
    note(s, L(`필리버스터가 끝나고 정책 「${title}」이(가) 통과되었다.`, `The filibuster ended and the policy "${title}" passed.`)); save(); push();
    chronNoteWorld(L(`${date} 두 달에 걸친 필리버스터 끝에 정책 「${title}」이(가) 의회를 통과했다.`, `${date} After a two-month filibuster, the policy "${title}" cleared parliament.`), true);
  };
  parlHooks.rammed = (title, bill) => {
    const sid = ctx.curSaveId || '', date = ctx.gameDate || ''; if (!sid) return; const s = entry(sid); unpend(s, bill);
    s.relation = Math.max(-100, s.relation + PARL_VOTE.ramRelation); moodNudge(PARL_VOTE.ramMood, L('날치기 통과', 'Bill rammed through'));
    note(s, L(`여당이 정책 「${title}」을(를) 날치기로 통과시켰다. 야당이 강하게 반발했다(관계 ${PARL_VOTE.ramRelation}).`, `The government rammed the policy "${title}" through. The opposition is furious (relations ${PARL_VOTE.ramRelation}).`)); save(); push();
    chronNoteWorld(L(`${date} 여당이 야당의 필리버스터를 끊고 정책 「${title}」을(를) 날치기로 통과시켰다. ${oppName(sid)} 야당 대표는 "의회 민주주의의 죽음"이라고 규탄했다.`, `${date} The government cut off the opposition's filibuster and rammed the policy "${title}" through. Opposition leader ${oppName(sid)} called it "the death of parliamentary democracy".`), true);
    ctx.notify({ kind: 'office', title: L('날치기 통과', 'Rammed through'), body: L(`「${title}」을(를) 날치기로 통과시켰습니다. 민심 ${PARL_VOTE.ramMood}, 야당과의 관계 ${PARL_VOTE.ramRelation}.`, `You rammed "${title}" through. Public mood ${PARL_VOTE.ramMood}, relations with the opposition ${PARL_VOTE.ramRelation}.`) });
  };
  registerSecFacts({ id: 'Parliament', kw: ['의회', '여당', '야당', '연정', '의석', '야당 대표', 'parliament', 'coalition', 'opposition', 'seats'], facts: (sid) => {
    if (sid !== ctx.curSaveId || civicRegimeNow() !== 'free' || !factions(sid).length) return []; const c = chamberNow(sid); return parlFacts(c, entry(sid), lname(leaderOf(sid, c.opp)));
  } });
  ipcMain.handle('parliamentState', async () => parliamentView());
  const wrap = (fn: () => Promise<unknown>) => async () => { try { const r = await fn(); return { ok: true, ...(typeof r === 'string' ? { text: r } : (r as object)), state: parliamentView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: parliamentView() }; } };
  ipcMain.handle('parliamentAct', async (_e, what: unknown, key: unknown) => wrap(async () => what === 'offer' ? coalitionOffer(key) : what === 'leave' ? coalitionLeave(key) : what === 'poach' ? poach(key) : what === 'deal' ? deal(key) : Promise.reject(new Error('?')))());
  ipcMain.handle('parliamentTalk', async (_e, text: unknown, end: unknown) => wrap(async () => talk(text, end === true))());
}
