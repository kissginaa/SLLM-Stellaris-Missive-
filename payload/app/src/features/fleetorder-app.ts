// 자동 작전(앱 쪽, 2026-11-04). 규칙·문장: src/fleetorder.ts. 게임: tester-mod/common/scripted_effects/sllm_fleetorder.txt. 화면: ui/fleet-order.js(함대 사령부 「자동 작전」).
// 로그 자리 FLEETORDER(213): 매달 사건(FOEV·FOEVF·FOEVS) → 기록·제독 무전 알림·연대기, 보고(FOREP…FOREP_END), 켜기·전환 응답(FOSET).
// 「슈뢰딩거」: 게임 명령은 켜기·끄기·함대 전환·작전 지시·보고(함대 사령부를 열 때·⟳)만. 매달 판정은 게임 스크립트가 스스로 한다.
// LLM(누를 때만): 작전 지시 해석 1번(foOrders), 결과 보고서 1번(foReport), 무전에 답하기(foTalk — persona-app 1:1 과 같은 신뢰·기억).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { type FoEvent, type FoReport, type FoOrders, type OpRec, FO, FoEventCollector, FoReportCollector, foSwitchCommand, foReportCommand, foFleetCommand, foOrdersCommand, radioText, foNotifies, foChron, foFacts,
  ORDERS_DEFAULT, ordersText, ordersMessages, parseOrders, recordEvent, reportMessages, parseReport, radioScene,
  ALLY, allyChance, allyFleets, relName, opName, foLeaseCommand, foReturnCommand, foLendCommand, allyMessages, parseAllyReply, allyFallback, parseAllyEv, allyEvText } from '../fleetorder';
import { monthsBetween } from '../letters';
import type { Talk } from '../persona';
import { sayInPerson, personaNote, personOf } from './persona-app';

interface Save { on: boolean; log: FoEvent[]; report?: FoReport; at?: number; recs: OpRec[]; orders?: FoOrders & { text: string; summary: string; date: string }; cool: Record<string, string> } // cool: 합동 작전을 거절한 나라(idx → 날짜)
interface Store { saves: Record<string, Save> }
const file = () => path.join(app.getPath('userData'), 'sllm_fleetorder.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e);
    const o = obj(x.orders);
    saves[safeKey(sid)] = { on: x.on === true, log: Array.isArray(x.log) ? (x.log as FoEvent[]).filter((q) => q && typeof q.ev === 'string').slice(-FO.keep) : [],
      cool: Object.fromEntries(Object.entries(obj(x.cool)).filter(([, d]) => typeof d === 'string').slice(-40)) as Record<string, string>,
      recs: Array.isArray(x.recs) ? (x.recs as OpRec[]).filter((q) => q && typeof q.id === 'string' && Array.isArray(q.events)).slice(-12) : [],
      ...(typeof o.text === 'string' && Number.isFinite(o.ratio) ? { orders: o as unknown as Save['orders'] } : {}) };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'fleetorder', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; const out: Store = { saves: {} }; for (const [k, v] of Object.entries(all().saves)) out.saves[k] = { on: v.on, log: v.log, recs: v.recs, cool: v.cool, ...(v.orders ? { orders: v.orders } : {}) }; fs.writeFileSync(tmp, JSON.stringify(out), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'fleetorder', error: e }); } }, 1500); }
const entry = (sid: string): Save => (all().saves[safeKey(sid)] ??= { on: false, log: [], recs: [], cool: {} });

const FO_KINDS = new Set(['FOEV', 'FOEVF', 'FOEVS', 'FOEVA', 'FOREP', 'FOOP', 'FOOPF', 'FOOPS', 'FOOPA', 'FOFL', 'FORDR', 'FOPRIO', 'FOSYS', 'FOALLYC', 'FOLENT', 'FOALLY', 'FOALLYF', 'FOREP_END', 'FOSET']);
const leaseLines = new Map<string, Array<{ fleet: string; adm: string }>>(); // 빌려 온 함대(FOALLYF, 요청 번호별) // FOREIGNWAR 같은 다른 줄과 섞이지 않게 정확히
const events = new FoEventCollector(), reports = new FoReportCollector();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let busy = false, thinking = false;
const talks = new Map<string, Talk>(); // 무전 대화(세이브|지휘관 번호)

function onEvent(e: FoEvent): void {
  const sid = ctx.curSaveId; if (!sid) return;
  const s = entry(sid); s.on = true; s.log = [...s.log, e].slice(-FO.keep); recordEvent(s.recs, e); save();
  if (foNotifies(e.ev)) { const r = radioText(e); ctx.notify({ kind: 'fleet', title: L(`무전 — ${r.who}`, `Radio — ${r.who}`), body: r.text, action: L('함대 사령부', 'Fleet Command') }); }
  const c = foChron(e); if (c) chronNoteWorld(c, true);
  push();
}
function onAllyEvent(e: ReturnType<typeof parseAllyEv> & object): void {
  const sid = ctx.curSaveId; if (!sid) return;
  const t = allyEvText(e), s = entry(sid);
  s.log = [...s.log, { n: Date.now() % 1e6, date: e.date, ev: 'order' as const, op: 0, pow: 0, en: 0, cnt: 0, fleet: '', adm: e.ai ? e.name : L('원정군', 'Expeditionary force'), at: '', sys: '', say: t.body }].slice(-FO.keep); save();
  if (e.ev !== 4) ctx.notify({ kind: 'fleet', title: t.title, body: t.body, action: L('함대 사령부', 'Fleet Command') });
  if (t.chron) chronNoteWorld(t.chron, true);
  push();
}
function flushSoon(): void { if (flushTimer) clearTimeout(flushTimer); flushTimer = setTimeout(() => { flushTimer = null; const e = events.flush(); if (e) onEvent(e); }, 600); }

export function fleetOrderView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const s = entry(sid), r = s.report ?? null, seen = new Map<number, boolean>();
  const known = (lid: number) => { if (!seen.has(lid)) { let k = false; try { k = !!personOf('p:' + lid); } catch { /* 연락처 없음 */ } seen.set(lid, k); } return seen.get(lid)!; }; // 연락처에 있는 제독만 무전에 답할 수 있다
  return {
    sid, on: s.on, running: ctx.gameRunning, busy, war: r?.war ?? null, reportDate: r?.date ?? '', at: s.at ?? 0,
    ops: r ? r.ops.map((o) => ({ ...o, pow: Math.round(o.pow), en: Math.round(o.en) })) : [],
    fleets: r ? r.fleets.map((f) => ({ ...f, pow: Math.round(f.pow) })).sort((a, b) => b.pow - a.pow) : [],
    log: s.log.slice(-20).reverse().map((e) => ({ date: e.date, ev: e.ev, op: e.op, sys: e.sys, lid: e.lid && known(e.lid) ? e.lid : 0, ...radioText(e) })),
    orders: (() => { const o = s.orders ?? (r?.orders ? { ...r.orders, text: '', summary: '', date: '' } : null); const cur = r?.orders ?? o ?? ORDERS_DEFAULT; return { text: ordersText(cur), last: o?.text ?? '', summary: o?.summary ?? '', date: o?.date ?? '' }; })(),
    systems: r ? r.systems.map((x) => x.name) : [], thinking,
    recs: s.recs.slice().reverse().map((x) => ({ id: x.id, op: x.op, sys: x.sys, adm: x.adm, start: x.start, end: x.end ?? '', result: x.result ?? '', report: x.report ?? null })),
    allies: r ? r.allies.map((a) => { const cd = s.cool[String(a.idx)], cool = !!cd && monthsBetween(cd, ctx.gameDate || '') < ALLY.coolMonths; return { idx: a.idx, name: a.name, rel: L(...relName(a.rel)), op: L(...opName(a.op)), n: a.n, pow: a.pow, lend: a.lend, chance: Math.round(allyChance(a) * 100), ask: allyFleets(a), cool: cool ? cd : '' }; }) : [],
    lent: r ? r.lent : [],
    talks: [...talks.entries()].filter(([k]) => k.startsWith(sid + '|')).map(([k, t]) => ({ lid: Number(k.split('|')[1]), lines: t.lines })),
  };
}
function push(): void { try { const v = fleetOrderView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('foUpdate', v); } catch { /* 창 없음 */ } }

async function refresh(): Promise<void> {
  const sid = ctx.curSaveId || ''; if (!sid || !ctx.gameRunning || busy) return;
  busy = true; push();
  try { const req = ++link.reqCounter; await terminalRequest(foReportCommand(req, sid), 'FOREP_END', req); const r = reports.take(String(req)); if (r && sid === ctx.curSaveId) { const s = entry(sid); s.report = r; s.on = r.on; s.at = Date.now(); save(); } }
  catch (e) { logDiagnostic('warn', 'fleetorder.report_failed', { error: (e as Error).message }); }
  finally { busy = false; push(); }
}
async function setMsg(cmd: (req: number, sid: string) => string): Promise<SllmMessage> {
  const sid = ctx.curSaveId || '';
  if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (!ctx.gameRunning) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  const req = ++link.reqCounter; return terminalRequest(cmd(req, sid), 'FOSET', req);
}
async function setCmd(cmd: (req: number, sid: string) => string): Promise<string> {
  const sid = ctx.curSaveId || '';
  if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (!ctx.gameRunning) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  const req = ++link.reqCounter, m = await terminalRequest(cmd(req, sid), 'FOSET', req);
  return m.kv.status || 'unknown';
}

/** 게임 안 칙령 「SLLM: 자동 작전 전체 중지」(2026-11-04, sllm_emergency_edicts.txt) → 게임은 이미 껐다. 앱 기록만 맞춘다. */
function onEdictHalt(): void {
  const sid = ctx.curSaveId; if (!sid) return; const s = entry(sid); if (!s.on) return; s.on = false; save();
  ctx.notify({ kind: 'office', title: L('자동 작전 중지', 'Automated operations halted'), body: L('게임 안 비상 정지 칙령으로 자동 작전을 모두 멈췄습니다. 함대는 직접 지휘로 돌아갑니다.', 'The in-game emergency edict halted every automated operation. Fleets are back under manual control.') });
  push();
}
export function registerFleetOrder(router: LogRouter): void {
  router.on(SLOT.FLEETORDER, 'fleetorder', (m: SllmMessage) => {
    if (!FO_KINDS.has(m.kind)) return;
    const rq = String(Math.round(Number(String(m.kv.req ?? '').replace(/,/g, '')) || 0)); // 게임이 변수로 찍은 요청 번호(12.000 같은 꼴도 받는다)
    if (m.kind === 'FOSET') { if (rq === '0' && String(m.kv.what ?? '') === 'off') onEdictHalt(); else terminalReplies.get('FOSET:' + rq)?.(m); return; } // 요청 번호 0 = 게임 안 비상 정지 칙령(2026-11-04)
    if (m.kind === 'FOREP_END') { terminalReplies.get('FOREP_END:' + rq)?.(m); return; }
    if (m.kind === 'FOALLYF') { const list = leaseLines.get(rq) ?? []; list.push({ fleet: String(m.kv.fleet ?? '').slice(0, 80), adm: String(m.kv.adm ?? '').slice(0, 80) }); leaseLines.set(rq, list.slice(0, 5)); return; }
    if (m.kind === 'FOALLY') { const ev = parseAllyEv(m); if (ev) onAllyEvent(ev); return; }
    if (reports.feed(m)) return;
    const r = events.feed(m); if (r.done) onEvent(r.done); if (r.used) flushSoon();
  });
  registerSecFacts({ id: 'Automated fleet operations', kw: ['자동 작전', '함대', '작전', '제독', 'fleet', 'operation', 'admiral'], facts: (sid) => (sid === ctx.curSaveId ? foFacts(entry(sid).on, entry(sid).log) : []) });
  ipcMain.handle('foState', async () => { const s = ctx.curSaveId ? entry(ctx.curSaveId) : null; if (s && ctx.gameRunning && (!s.at || Date.now() - s.at > 20000)) void refresh(); return fleetOrderView(); }); // 열 때 한 번(20초 안에 다시 열면 그대로)
  ipcMain.handle('foRefresh', async () => { await refresh(); return fleetOrderView(); });
  ipcMain.handle('foSwitch', async (_e, on: unknown) => {
    try {
      const st = await setCmd((req, sid) => foSwitchCommand(req, sid, on === true));
      if (st !== 'applied') return { ok: false, error: L('게임이 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm. Check that the mod is up to date.'), state: fleetOrderView() };
      entry(ctx.curSaveId).on = on === true; save();
      chronNoteWorld(on === true ? L(`${ctx.gameDate} 함대 사령부가 자동 작전 체계를 가동했다.`, `${ctx.gameDate} Fleet Command switched on automated operations.`) : L(`${ctx.gameDate} 함대 사령부가 자동 작전을 멈추고 지휘를 되돌렸다.`, `${ctx.gameDate} Fleet Command stood down automated operations.`), true);
      await refresh(); return { ok: true, state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
  });
  ipcMain.handle('foFleet', async (_e, fid: unknown, manual: unknown) => {
    try {
      const st = await setCmd((req, sid) => foFleetCommand(req, sid, Number(fid), manual === true));
      if (st === 'no_target') return { ok: false, error: L('게임에서 그 함대를 찾지 못했습니다. ⟳로 다시 읽어 주세요.', 'That fleet was not found in game. Press ⟳ to reread.'), state: fleetOrderView() };
      if (st !== 'applied') return { ok: false, error: L('게임이 확인해 주지 않았습니다.', 'The game did not confirm.'), state: fleetOrderView() };
      await refresh(); return { ok: true, state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
  });
  // ① 작전 지시: 말 → (LLM) 설정 숫자 + 지휘 제독 답 무전 → 게임
  ipcMain.handle('foOrders', async (_e, textIn: unknown) => {
    const text = String(textIn ?? '').trim().slice(0, 500), sid = ctx.curSaveId || '';
    if (!text) return { ok: false, error: L('지시를 적어 주세요.', 'Write an order.'), state: fleetOrderView() };
    if (thinking) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: fleetOrderView() };
    if (!sid || !ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: fleetOrderView() };
    thinking = true; push();
    try {
      if (!entry(sid).report) await refresh();
      const s = entry(sid), r = s.report, cur = r?.orders ?? ORDERS_DEFAULT, systems = r?.systems ?? [];
      const lead = r?.ops.find((o) => o.adm) ?? null, adm = lead?.adm || r?.fleets.find((f) => f.adm)?.adm || '';
      const raw = await ctx.ai.chat(ordersMessages({ empire: ctx.playerName || L('우리 제국', 'our empire'), date: ctx.gameDate || '', admiral: adm, current: cur, systems, ops: (r?.ops ?? []).filter((o) => o.st).map((o) => `${o.sys} (${o.st === 1 ? 'rallying' : 'advancing'})`), war: !!r?.war }, text), { purpose: 'fleet-orders', json: true, maxTokens: 900 });
      const p = parseOrders(raw, cur, systems); if (!p) return { ok: false, error: L('지시를 읽지 못했습니다. 다시 적어 보세요.', 'Could not read the order. Try rephrasing it.'), state: fleetOrderView() };
      const m = await setMsg((req, sd) => foOrdersCommand(req, sd, p.orders, p.prioSid));
      if (m.kv.status !== 'applied') return { ok: false, error: L('게임이 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm. Check that the mod is up to date.'), state: fleetOrderView() };
      s.orders = { ...p.orders, text, summary: p.summary, date: ctx.gameDate || '' };
      if (lead?.lid) try { personaNote(sid, 'p:' + lead.lid, `Received the ruler's fleet order: ${p.summary || text}`); } catch { /* 인물 없음 */ }
      const who = adm || L('작전 본부', 'Operations HQ');
      if (p.reply) s.log = [...s.log, { n: Date.now() % 1e6, date: ctx.gameDate || '', ev: 'order' as const, op: 0, pow: 0, en: 0, cnt: 0, fleet: '', adm, at: '', sys: p.orders.prio, ...(lead?.lid ? { lid: lead.lid } : {}), say: p.reply }].slice(-FO.keep);
      save(); await refresh();
      return { ok: true, reply: p.reply, who, summary: p.summary, state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
    finally { thinking = false; push(); }
  });
  // ② 작전 결과 보고서(끝난 작전, 누를 때 1번)
  ipcMain.handle('foReport', async (_e, idIn: unknown) => {
    const sid = ctx.curSaveId || ''; if (!sid) return { ok: false, error: L('세이브를 불러와 주세요.', 'Load a save first.'), state: fleetOrderView() };
    const s = entry(sid), r = s.recs.find((x) => x.id === idIn); if (!r || !r.end) return { ok: false, error: L('끝난 작전만 보고서를 받을 수 있습니다.', 'Reports are only for finished operations.'), state: fleetOrderView() };
    if (r.report) return { ok: true, state: fleetOrderView() };
    if (thinking) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: fleetOrderView() };
    thinking = true; push();
    try {
      let rep: ReturnType<typeof parseReport> = null;
      for (let i = 0; i < 2 && !rep; i++) rep = parseReport(await ctx.ai.chat(reportMessages(r, ctx.playerName || 'our empire'), { purpose: 'fleet-report', json: true, maxTokens: 1600 * (i + 1) }));
      if (!rep) return { ok: false, error: L('보고서를 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the report. Press again.'), state: fleetOrderView() };
      r.report = { title: rep.title, body: rep.body }; save();
      if (rep.headline) chronNoteWorld(`${r.end} ${rep.headline}`, true);
      if (r.lid) try { personaNote(sid, 'p:' + r.lid, `Wrote the after-action report on the ${r.sys} operation (${r.result}).`); } catch { /* 인물 없음 */ }
      return { ok: true, state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
    finally { thinking = false; push(); }
  });
  // ③ 무전에 답하기: 그 제독과 1:1(신뢰·기억은 persona-app 과 같다)
  ipcMain.handle('foTalk', async (_e, lidIn: unknown, textIn: unknown) => {
    const sid = ctx.curSaveId || '', lid = Number(lidIn), key = 'p:' + lid, tk = sid + '|' + lid;
    if (!sid || !Number.isSafeInteger(lid) || lid < 1 || !personOf(key)) return { ok: false, error: L('이 제독을 연락처에서 찾지 못했습니다.', 'This admiral is not in the contacts.'), state: fleetOrderView() };
    const e = entry(sid).log.slice().reverse().find((x) => x.lid === lid);
    const t = talks.get(tk) ?? { key, lines: [], moved: 0, opened: ctx.gameDate || '' }; talks.set(tk, t);
    thinking = true; push();
    try {
      const said = e ? radioText(e).text : '';
      const r = await sayInPerson(sid, key, t, String(textIn ?? ''), { scene: radioScene({ ev: e?.ev ?? 'go', sys: e?.sys ?? '', date: e?.date ?? (ctx.gameDate || ''), text: said }) });
      return { ...r, state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
    finally { thinking = false; push(); }
  });
  ipcMain.handle('foTalkEnd', async (_e, lidIn: unknown) => { talks.delete((ctx.curSaveId || '') + '|' + Number(lidIn)); push(); return fleetOrderView(); });
  // ④ 합동 작전: 동맹에게 함대를 빌려 달라고 한다(앱 주사위 → 답신 LLM 1번 → 수락이면 게임 임대)
  ipcMain.handle('foAllyAsk', async (_e, idxIn: unknown, askIn: unknown) => {
    const sid = ctx.curSaveId || '', idx = Number(idxIn), ask = String(askIn ?? '').trim().slice(0, 300);
    if (!sid || !ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: fleetOrderView() };
    if (thinking) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: fleetOrderView() };
    const s = entry(sid), a = s.report?.allies.find((x) => x.idx === idx);
    if (!a) return { ok: false, error: L('그 나라는 지금 합동 작전 상대가 아닙니다. ⟳로 다시 읽어 주세요.', 'That empire is not a joint-operation partner right now. Press ⟳.'), state: fleetOrderView() };
    if (a.lend) return { ok: false, error: L('이미 함대를 빌려 와 있습니다.', 'We already have their fleets.'), state: fleetOrderView() };
    const cd = s.cool[String(idx)]; if (cd && monthsBetween(cd, ctx.gameDate || '') < ALLY.coolMonths) return { ok: false, error: L(`${cd}에 거절당했습니다. 2년 뒤에 다시 청할 수 있습니다.`, `They refused on ${cd}. You can ask again after two years.`), state: fleetOrderView() };
    const p = allyChance(a), n = allyFleets(a), accepted = a.n > 0 && Math.random() < p;
    thinking = true; push();
    try {
      let reply = ''; try { reply = parseAllyReply(await ctx.ai.chat(allyMessages({ empire: ctx.playerName || 'our empire', date: ctx.gameDate || '', ally: a, accepted, n, ask }), { purpose: 'fleet-ally', json: true, maxTokens: 700 })); } catch (err) { logDiagnostic('warn', 'fleetorder.ally_reply_failed', { error: String(err) }); }
      if (!reply) reply = allyFallback(accepted, n, a.name);
      if (!accepted) { s.cool[String(idx)] = ctx.gameDate || ''; s.log = [...s.log, { n: Date.now() % 1e6, date: ctx.gameDate || '', ev: 'order' as const, op: 0, pow: 0, en: 0, cnt: 0, fleet: '', adm: a.name, at: '', sys: '', say: reply }].slice(-FO.keep); save(); return { ok: true, accepted: false, reply, chance: Math.round(p * 100), state: fleetOrderView() }; }
      const req = ++link.reqCounter, m = await terminalRequest(foLeaseCommand(req, sid, idx, n), 'FOSET', req);
      const got = leaseLines.get(String(req)) ?? []; leaseLines.delete(String(req));
      if (m.kv.status !== 'applied') return { ok: false, error: m.kv.status === 'no_fleet' ? L('수락했지만 지금 내줄 수 있는 함대가 없다고 합니다(전투 중·수리 중).', 'They agreed, but have no fleet free right now (in combat or repairing).') : L('게임이 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm. Check that the mod is up to date.'), state: fleetOrderView() };
      const names = got.map((g) => g.adm ? `${g.fleet}(${g.adm})` : g.fleet).join(', ');
      s.log = [...s.log, { n: Date.now() % 1e6, date: ctx.gameDate || '', ev: 'order' as const, op: 0, pow: 0, en: 0, cnt: 0, fleet: '', adm: a.name, at: '', sys: '', say: reply + (names ? L(` — 합류: ${names}`, ` — joining: ${names}`) : '') }].slice(-FO.keep); save();
      chronNoteWorld(L(`${ctx.gameDate} ${a.name}이(가) 합동 작전을 위해 함대 ${got.length || n}개를 1년 동안 보내왔다.`, `${ctx.gameDate} ${a.name} sent ${got.length || n} fleet(s) for a year of joint operations.`), true);
      await refresh(); return { ok: true, accepted: true, reply, chance: Math.round(p * 100), state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
    finally { thinking = false; push(); }
  });
  ipcMain.handle('foAllyReturn', async (_e, idxIn: unknown) => {
    try { const st = await setCmd((req, sd) => foReturnCommand(req, sd, Number(idxIn))); if (st !== 'applied') return { ok: false, error: L('게임이 확인해 주지 않았습니다.', 'The game did not confirm.'), state: fleetOrderView() }; await refresh(); return { ok: true, state: fleetOrderView() }; }
    catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
  });
  // 원정군 파견: 우리 함대 하나를 동맹에게 1년 빌려준다(그 나라 AI 가 쓴다, 받은 나라 호감 +25)
  ipcMain.handle('foLend', async (_e, fidIn: unknown, idxIn: unknown) => {
    try {
      const sid = ctx.curSaveId || '', a = sid ? entry(sid).report?.allies.find((x) => x.idx === Number(idxIn)) : null;
      if (!a) return { ok: false, error: L('그 나라는 지금 합동 작전 상대가 아닙니다.', 'That empire is not a joint-operation partner right now.'), state: fleetOrderView() };
      const st = await setCmd((req, sd) => foLendCommand(req, sd, Number(idxIn), Number(fidIn)));
      if (st !== 'applied') return { ok: false, error: L('보낼 수 없는 함대입니다(전투 중·수리 필요·이미 빌려줌).', 'That fleet cannot be sent (in combat, needs repair, or already lent).'), state: fleetOrderView() };
      chronNoteWorld(L(`${ctx.gameDate} ${a.name}을(를) 돕기 위해 원정군을 보냈다.`, `${ctx.gameDate} We sent an expeditionary force to aid ${a.name}.`), true);
      await refresh(); return { ok: true, state: fleetOrderView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: fleetOrderView() }; }
  });
}
