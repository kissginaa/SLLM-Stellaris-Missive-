// 종속국 통치(앱 쪽, 2026-11-04). 규칙·문장: src/vassal-court.ts. 게임: tester-mod/common/scripted_effects/sllm_vassal_court.txt · events/sllm_vassal_court_events.txt.
// 화면: ui/vassal-court.js(종속국 창, 종속국 채널 아래 칸). 기록은 종속국 채널에 시스템 줄로 남긴다(vassal-app 의 vassalNote).
// 로그 자리 VASCOURT: VCCTX(감면 액수용 수입) · VCSET(적용 응답) · VCSHORT(이달 환급 못 함) · VCAGR(계약 재협상 → 반응 서신).
// 게임 명령은 감면 요청이 생길 때(수입 읽기 1번)·결정할 때·감독관 파견/소환 때만.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { monthsBetween } from '../letters';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNote } from './chronicle-app';
import { peopleOf, onPeopleMonth, onLeaderOut } from './people-app';
import { vassal, vassalNote, vassalReact, vassalPush } from './vassal-app';
import { VC, type ReliefChoice, reliefAmounts, wantsRelief, gnum, ctxCommand, reliefCommand, overseerCommand, reliefLetter, reliefResult, overseerReport, renegotiationSituation } from '../vassal-court';

interface Overseer { lid: number; name: string; since: string; lastReport?: string; lastLoy?: number | null }
interface Relief { state: 'pending' | 'full' | 'half' | 'no'; full: number; half: number; date: string; ko: string; en: string; until?: string }
interface Save { overseers: Record<string, Overseer>; relief: Record<string, Relief>; lastAsk: Record<string, string>; lastShort?: string }
interface Store { saves: Record<string, Save> }
const file = () => path.join(app.getPath('userData'), 'sllm_vassal_court.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), ov: Save['overseers'] = {}, rl: Save['relief'] = {}, la: Save['lastAsk'] = {};
    for (const [k, a] of Object.entries(obj(x.overseers)).slice(0, 60)) { const o = obj(a); if (Number.isSafeInteger(o.lid) && typeof o.name === 'string') ov[k] = { lid: o.lid as number, name: String(o.name).slice(0, 80), since: String(o.since ?? ''), ...(typeof o.lastReport === 'string' ? { lastReport: o.lastReport } : {}), lastLoy: typeof o.lastLoy === 'number' ? o.lastLoy : null }; }
    for (const [k, a] of Object.entries(obj(x.relief)).slice(0, 60)) { const o = obj(a); if (['pending', 'full', 'half', 'no'].includes(String(o.state))) rl[k] = { state: o.state as Relief['state'], full: Number(o.full) || 5, half: Number(o.half) || 5, date: String(o.date ?? ''), ko: String(o.ko ?? '').slice(0, 600), en: String(o.en ?? '').slice(0, 600), ...(typeof o.until === 'string' ? { until: o.until } : {}) }; }
    for (const [k, a] of Object.entries(obj(x.lastAsk)).slice(0, 60)) if (typeof a === 'string') la[k] = a;
    saves[safeKey(sid)] = { overseers: ov, relief: rl, lastAsk: la, ...(typeof x.lastShort === 'string' ? { lastShort: x.lastShort } : {}) };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'vassal_court', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'vassal_court', error: e }); } }, 1500); }
const entry = (sid: string): Save => (all().saves[safeKey(sid)] ??= { overseers: {}, relief: {}, lastAsk: {} });
const usName = () => ctx.playerName || L('우리 제국', 'Our empire');
const ready = () => !!ctx.curSaveId && ctx.gameRunning && link.sessionReady;
const myVassals = (): Array<{ idx: number; name: string; loyalty: number }> => (vassal.snap && vassal.snap.sid === ctx.curSaveId ? vassal.snap.vassals ?? [] : []);
let busy = false;

async function send(cmd: (req: number) => string, kind: string): Promise<string> {
  const req = ++link.reqCounter;
  try { return String((await terminalRequest(cmd(req), kind, req)).kv.status ?? ''); } catch { return ''; }
}

/** 화면용(종속국 하나 또는 전부). */
export function vcView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const s = entry(sid), today = ctx.gameDate || '', busyLids = new Set(Object.values(s.overseers).map((o) => o.lid));
  const leaders = peopleOf(sid).filter((p) => !p.gone && !p.ruler && !busyLids.has(p.lid)).sort((a, b) => b.lv - a.lv).slice(0, 40).map((p) => ({ lid: p.lid, name: p.name, lv: p.lv, cls: p.cls }));
  return {
    sid, running: ctx.gameRunning, busy, cost: VC.overseerCost, loyaltyPlus: VC.overseerLoyalty, leaders,
    vassals: myVassals().map((v) => {
      const o = s.overseers[String(v.idx)], r = s.relief[String(v.idx)];
      const active = r && (r.state === 'pending' || (r.until && monthsBetween(today, r.until) > 0));
      return { idx: v.idx, name: v.name, loyalty: v.loyalty, overseer: o ? { lid: o.lid, name: o.name, since: o.since } : null,
        relief: active ? { state: r.state, full: r.full, half: r.half, date: r.date, text: L(r.ko, r.en), until: r.until ?? '' } : null };
    }),
  };
}

/** 매달(명단이 오든 안 오든): 감독관 생존 확인·연례 보고 · 감면 요청 만들기 · 끝난 감면 정리. */
async function monthly(): Promise<void> {
  const sid = ctx.curSaveId; if (!sid) return; const s = entry(sid), today = ctx.gameDate || ''; if (!today) return;
  const vs = myVassals(), byIdx = new Map(vs.map((v) => [String(v.idx), v]));
  const people = peopleOf(sid);
  for (const [k, o] of Object.entries(s.overseers)) {
    const v = byIdx.get(k), p = people.find((x) => x.lid === o.lid);
    if (!v) { delete s.overseers[k]; continue; } // 더 이상 우리 종속국이 아님(독립·병합)
    if (!p || p.gone) { await recall(sid, Number(k), L(`감독관 ${o.name}이(가) 자리를 비워(사망·해임) 감독관 파견이 끝났습니다.`, `Overseer ${o.name} is gone (died or dismissed); the posting has ended.`)); continue; }
    if (!o.lastReport || monthsBetween(o.lastReport, today) >= 12) {
      const trend = typeof o.lastLoy === 'number' ? v.loyalty - o.lastLoy : null;
      if (o.lastReport) vassalNote(Number(k), overseerReport(o.name, v.name, v.loyalty, trend), true);
      o.lastReport = today; o.lastLoy = v.loyalty;
    }
  }
  for (const [k, r] of Object.entries(s.relief)) if (r.state !== 'pending' && r.until && monthsBetween(today, r.until) <= 0) { delete s.relief[k]; vassalNote(Number(k), L('조공 감면 기간(1년)이 끝났습니다.', 'The year of tribute relief has ended.')); }
  save();
  if (!ready() || busy) return;
  const atWar = !!vassal.snap && vassal.snap.wars.length > 0;
  for (const v of vs) {
    const k = String(v.idx), r = s.relief[k], last = s.lastAsk[k];
    if (!wantsRelief({ loyalty: v.loyalty, atWar, monthsSinceLast: last ? monthsBetween(last, today) : 999, pending: r?.state === 'pending', relieved: !!r })) continue;
    let inc = 0; const req = ++link.reqCounter;
    try { const m = await terminalRequest(ctxCommand(req, sid, v.idx), 'VCCTX', req); if (Math.round(gnum(m.kv.idx)) !== v.idx) continue; inc = gnum(m.kv.inc); } catch { continue; }
    const a = reliefAmounts(inc), t = reliefLetter(v.name, atWar, v.loyalty);
    s.relief[k] = { state: 'pending', full: a.full, half: a.half, date: today, ko: t.ko, en: t.en }; s.lastAsk[k] = today; save();
    vassalNote(v.idx, L(t.ko, t.en), true);
    ctx.notify({ kind: 'vassal', title: L(`조공 감면 요청 · ${v.name}`, `Tribute relief request · ${v.name}`), body: L('종속국 창에서 전액·절반·거절 중에 고를 수 있습니다.', 'Choose full, half or refuse in the subjects window.'), action: L('열기', 'Open') });
    vassalPush(); break; // 한 달에 한 건
  }
}

async function recall(sid: string, idx: number, note: string): Promise<void> {
  const s = entry(sid), o = s.overseers[String(idx)]; if (!o) return;
  if (ready()) await send((req) => overseerCommand(req, sid, idx, false), 'VCSET');
  delete s.overseers[String(idx)]; save(); vassalNote(idx, note); vassalPush();
}

export function registerVassalCourt(router: LogRouter): void {
  router.on(SLOT.VASCOURT, 'vassal-court', (m: SllmMessage) => {
    const k = m.kind; if (k !== 'VCCTX' && k !== 'VCSET' && k !== 'VCSHORT' && k !== 'VCAGR') return;
    if (k === 'VCCTX' || k === 'VCSET') { terminalReplies.get(k + ':' + String(Math.round(gnum(m.kv.req))))?.(m); return; }
    const sid = ctx.curSaveId; if (!sid) return; const idx = Math.round(gnum(m.kv.idx));
    if (k === 'VCSHORT') {
      const s = entry(sid); if (s.lastShort === ctx.gameDate) return; s.lastShort = ctx.gameDate || ''; save();
      const v = myVassals().find((x) => x.idx === idx);
      ctx.notify({ kind: 'vassal', title: L('조공 감면 환급 못 함', 'Tribute relief not paid'), body: L(`에너지가 모자라 이번 달 ${v?.name ?? '종속국'}에 감면분을 돌려주지 못했습니다.`, `Not enough energy to pay this month's relief to ${v?.name ?? 'a subject'}.`) });
      return;
    }
    // VCAGR: 게임 외교 화면에서 계약 재협상이 받아들여짐 → 새 조건 아래 충성도 방향에 따라 반응 서신
    const ml = Math.round(gnum(m.kv.ml)), r = renegotiationSituation(ml), v = myVassals().find((x) => x.idx === idx);
    if (r.kind === 'note') vassalNote(idx, L('종속 계약이 새로 조정되었습니다. 종속국은 담담히 받아들였습니다.', 'The subject agreement was renegotiated. The subject accepted it calmly.'));
    else { vassalReact(idx, r.kind, r.line); if (v) chronNote(idx, r.kind === 'thanks' ? L('종주국과 계약을 새로 맺었고, 새 조건에 만족했다', 'Renegotiated the agreement with the overlord and welcomed the new terms') : L('종주국과 계약을 새로 맺었지만, 새 조건에 불만을 품었다', 'Renegotiated the agreement with the overlord and resented the new terms')); }
  });
  onPeopleMonth(() => { void monthly().catch((e) => logDiagnostic('warn', 'vassal_court.monthly_failed', { error: String(e) })); });
  onLeaderOut((kv) => {
    const sid = ctx.curSaveId; if (!sid) return; const lid = Number(kv.lid);
    for (const [k, o] of Object.entries(entry(sid).overseers)) if (o.lid === lid) void recall(sid, Number(k), L(`감독관 ${o.name}이(가) 자리를 비워(사망·해임) 감독관 파견이 끝났습니다.`, `Overseer ${o.name} is gone (died or dismissed); the posting has ended.`));
  });
  ipcMain.handle('vcState', async () => vcView());
  ipcMain.handle('vcRelief', async (_e, idxIn: unknown, choiceIn: unknown) => {
    const sid = ctx.curSaveId || '', idx = Number(idxIn), choice = (['full', 'half', 'no'].includes(String(choiceIn)) ? choiceIn : '') as ReliefChoice | '';
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: vcView() };
    const s = entry(sid), r = s.relief[String(idx)], v = myVassals().find((x) => x.idx === idx);
    if (!choice || !r || r.state !== 'pending' || !v) return { ok: false, error: L('답할 감면 요청이 없습니다.', 'There is no relief request to answer.'), state: vcView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: vcView() };
    busy = true;
    try {
      let st = '', amt = choice === 'full' ? r.full : r.half; const req = ++link.reqCounter;
      try { const m = await terminalRequest(reliefCommand(req, sid, idx, choice), 'VCSET', req); st = String(m.kv.status ?? ''); const got = Math.round(gnum(m.kv.amt)); if (got > 0) amt = got; } catch { st = ''; }
      if (st === 'applied' && choice !== 'no') { if (choice === 'full') r.full = amt; else r.half = amt; }
      if (st !== 'applied') return { ok: false, error: st === 'no_target' ? L('게임에서 이 종속국을 찾지 못했습니다.', 'This subject was not found in game.') : L('게임이 응답하지 않습니다. 잠시 뒤 다시 해 주세요.', 'The game did not respond. Try again shortly.'), state: vcView() };
      r.state = choice; if (choice !== 'no') { const d = ctx.gameDate || ''; const [y, mo, dd] = d.split('.').map(Number); r.until = y ? `${y + 1}.${String(mo).padStart(2, '0')}.${String(dd).padStart(2, '0')}` : ''; } else delete s.relief[String(idx)];
      save(); const text = reliefResult(v.name, choice, amt); vassalNote(idx, text); chronNote(idx, text);
      return { ok: true, state: vcView() };
    } finally { busy = false; vassalPush(); }
  });
  ipcMain.handle('vcOverseer', async (_e, idxIn: unknown, lidIn: unknown) => {
    const sid = ctx.curSaveId || '', idx = Number(idxIn), lid = Number(lidIn);
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: vcView() };
    const s = entry(sid), v = myVassals().find((x) => x.idx === idx); if (!v) return { ok: false, error: L('우리 종속국이 아닙니다.', 'Not one of our subjects.'), state: vcView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: vcView() };
    busy = true;
    try {
      if (!lid) { await recall(sid, idx, L(`감독관을 ${v.name}에서 불러들였습니다.`, `Recalled the overseer from ${v.name}.`)); return { ok: true, state: vcView() }; }
      if (s.overseers[String(idx)]) return { ok: false, error: L('이미 감독관이 있습니다. 먼저 소환하세요.', 'An overseer is already posted. Recall them first.'), state: vcView() };
      const p = peopleOf(sid).find((x) => x.lid === lid && !x.gone && !x.ruler);
      if (!p || Object.values(s.overseers).some((o) => o.lid === lid)) return { ok: false, error: L('보낼 수 없는 지도자입니다.', 'That leader cannot be sent.'), state: vcView() };
      const st = await send((req) => overseerCommand(req, sid, idx, true), 'VCSET');
      if (st === 'short') return { ok: false, error: L(`영향력 ${VC.overseerCost}이 필요합니다.`, `Requires ${VC.overseerCost} influence.`), state: vcView() };
      if (st !== 'applied') return { ok: false, error: L('게임이 응답하지 않습니다. 잠시 뒤 다시 해 주세요.', 'The game did not respond. Try again shortly.'), state: vcView() };
      s.overseers[String(idx)] = { lid, name: p.name, since: ctx.gameDate || '', lastReport: ctx.gameDate || '', lastLoy: v.loyalty }; save();
      const text = L(`${p.name}을(를) ${v.name}의 감독관으로 보냈다 — 충성도 매달 +${VC.overseerLoyalty}(소환할 때까지), 해마다 보고서가 온다.`, `Sent ${p.name} to ${v.name} as overseer — loyalty +${VC.overseerLoyalty}/month until recalled; an annual report will follow.`);
      vassalNote(idx, text); chronNote(idx, L(`${usName()}이(가) 감독관 ${p.name}을(를) 우리 수도에 보냈다`, `${usName()} posted overseer ${p.name} in our capital`));
      return { ok: true, state: vcView() };
    } finally { busy = false; vassalPush(); }
  });
}
