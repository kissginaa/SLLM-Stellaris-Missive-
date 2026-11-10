// 외교 노선(앱 쪽, 2026-11-04). 규칙·문장: src/temper.ts. 게임: tester-mod/common/scripted_effects/sllm_temper.txt. 화면: ui/office-temper.js(집무실 「외교 노선」).
// 로그 자리 TEMPER(205): TMPC·TMPTOP·TMPEND(판세 읽기, 해마다 1월 req=0 · 「새로 관측」) · TMPSETP·TMPSET(성향 바꾸기·공작 발각 응답) · TMPPAY(공작 비용).
// 「슈뢰딩거」: 게임 명령은 해마다 1번(게임이 스스로) · 「새로 관측」 · 노선이 바뀔 때 · 공작 때만.
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
import { monthsBetween } from '../letters';
import { terminal, terminalRequest, terminalReplies } from './terminal';
import { knownEmpire } from '../mail';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { setTemperHooks } from '../app/temper-hooks';
import { type Dir, type TmpEmpire, type TmpTop, TEMPER, clampP, dirOf, decayP, yearPush, parseEmpire, parseTop, gnum, ctxCommand, shiftCommand, caughtCommand, payCommand, dirName, leanText, RP_NAME, shiftHeadline, yearHeadline, temperFact, fpText } from '../temper';

interface Cause { date: string; d: number; ko: string; en: string }
interface Emp extends TmpEmpire { p: number; causes: Cause[]; shifted?: string; opAt?: string; seen?: string }
interface Save { emp: Record<string, Emp>; top: TmpTop[]; year?: string; seen?: string; log: Array<{ date: string; text: string }> }
interface Store { saves: Record<string, Save> }
const file = () => path.join(app.getPath('userData'), 'sllm_temper.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), emp: Save['emp'] = {};
    for (const [k, a] of Object.entries(obj(x.emp)).slice(0, 200)) { const o = obj(a), b = parseEmpire(o); if (!b) continue; emp[k] = { ...b, p: clampP(Number(o.p) || 0), causes: Array.isArray(o.causes) ? (o.causes as Cause[]).filter((c) => c && typeof c.ko === 'string').slice(-6) : [], ...(typeof o.shifted === 'string' ? { shifted: o.shifted } : {}), ...(typeof o.opAt === 'string' ? { opAt: o.opAt } : {}), ...(typeof o.seen === 'string' ? { seen: o.seen } : {}) }; }
    saves[safeKey(sid)] = { emp, top: Array.isArray(x.top) ? (x.top as unknown[]).map((t) => parseTop(obj(t))).filter(Boolean).slice(0, 5) as TmpTop[] : [], ...(typeof x.year === 'string' ? { year: x.year } : {}), ...(typeof x.seen === 'string' ? { seen: x.seen } : {}), log: Array.isArray(x.log) ? (x.log as Save['log']).filter((q) => q && typeof q.text === 'string').slice(-TEMPER.keep) : [] };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'temper', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'temper', error: e }); } }, 1500); }
const entry = (sid: string): Save => (all().saves[safeKey(sid)] ??= { emp: {}, top: [], log: [] });
const note = (s: Save, text: string) => { s.log = [...s.log, { date: ctx.gameDate || '', text }].slice(-TEMPER.keep); };
const usName = () => ctx.playerName || L('우리 제국', 'Our empire');
let busy = false;

// ---- 판세 읽기 줄 모으기(요청 번호별) ----
const buf = new Map<string, { emp: TmpEmpire[]; top: TmpTop[] }>();
const bufOf = (rq: string) => { let b = buf.get(rq); if (!b) { b = { emp: [], top: [] }; buf.set(rq, b); if (buf.size > 8) buf.delete(buf.keys().next().value as string); } return b; };
const shiftNames = new Map<string, string>(); // req → 바뀐 뒤 성향 이름(TMPSETP)

function emp(s: Save, idx: number): Emp | null {
  const k = String(idx), e = s.emp[k]; if (e) return e;
  const c = terminal.items.find((x) => x.idx === idx); if (!c || c.type !== 'default' || c.gest) return null; // 모르는 나라는 일반 제국 연락처일 때만 새로 만든다(관측 전)
  return (s.emp[k] = { idx, name: c.name, pers: '', cls: 0, ok: true, rp: 3, pac: false, war: !!c.em?.war, p: 0, causes: [] });
}
function pushP(sid: string, idx: number, d: number, why: [string, string]): Emp | null {
  if (!sid || !Number.isFinite(d) || !d) return null; const s = entry(sid), e = emp(s, idx); if (!e || !e.ok) return null;
  const before = e.p; e.p = clampP(e.p + d); if (e.p === before) return e;
  e.causes = [...e.causes, { date: ctx.gameDate || '', d: e.p - before, ko: why[0], en: why[1] }].slice(-6); save(); return e;
}

export function temperView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const s = entry(sid), today = ctx.gameDate || '';
  const list = Object.values(s.emp).filter((e) => terminal.items.some((c) => c.idx === e.idx)).sort((a, b) => Math.abs(b.p) - Math.abs(a.p) || a.name.localeCompare(b.name));
  return {
    sid, running: ctx.gameRunning, busy, seen: s.seen ?? '', year: s.year ?? '', us: usName(),
    top: s.top.slice().sort((a, b) => a.rank - b.rank).map((t) => ({ rank: t.rank + 1, name: t.us ? usName() : t.name, us: t.us, fp: fpText(t.fp) })),
    cost: { energy: TEMPER.op.energy, influence: TEMPER.op.influence, chance: Math.round(TEMPER.op.chance * 100), caught: Math.round(TEMPER.op.caught * 100) }, threshold: TEMPER.threshold,
    empires: list.map((e) => {
      const cool = e.shifted ? Math.max(0, TEMPER.coolYears * 12 - monthsBetween(e.shifted, today)) : 0, opCool = e.opAt ? Math.max(0, TEMPER.op.coolMonths - monthsBetween(e.opAt, today)) : 0;
      return { idx: e.idx, name: e.name, pers: e.pers, cls: e.cls, ok: e.ok, p: e.p, lean: leanText(e.p), power: L(...(RP_NAME[e.rp] ?? RP_NAME[3])), pac: e.pac, war: e.war,
        coolMonths: cool, opCool, causes: e.causes.slice(-3).reverse().map((c) => ({ date: c.date, d: c.d, text: L(c.ko, c.en) })) };
    }),
    log: s.log.slice(-12).reverse(),
  };
}
function push(): void { try { const v = temperView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('temperUpdate', v); } catch { /* 창 없음 */ } }

/** 판세 읽기 결과 반영. yearly = 해마다 1월 게임이 스스로 찍은 것(req 0) → 압력·기사·노선 확인. */
function onRead(rq: string, m: SllmMessage): void {
  const sid = String(m.kv.sid ?? '').replace(/[^\d]/g, ''); const b = buf.get(rq); buf.delete(rq);
  if (!sid || sid !== ctx.curSaveId || !b) return;
  const s = entry(sid), date = String(m.kv.date ?? ctx.gameDate ?? '');
  for (const x of b.emp) { const k = String(x.idx), old = s.emp[k]; s.emp[k] = { ...(old ?? { p: 0, causes: [] }), ...x, seen: date } as Emp; }
  if (b.top.length) s.top = b.top; s.seen = date;
  if (rq === '0') {
    const y = date.slice(0, 4);
    if (y && s.year !== y) {
      s.year = y;
      for (const e of Object.values(s.emp)) e.p = decayP(e.p);
      for (const x of b.emp) { const w = yearPush(x, b.top); if (w) pushP(sid, x.idx, w.d, w.why); }
      // 은하 판세 기사엔 우리가 아는(통신이 있는) 나라만(2026-11-10 사용자 제보: 접촉도 없는 게임 초반에 남의 나라 함대 순위가 실림). 우리 말고 아는 나라가 없으면 기사 없음
      const seenTop = b.top.filter((x) => x.us || knownEmpire(x.idx, x.name, ctx.mailCountries, terminal.all));
      const head = seenTop.some((x) => !x.us) ? yearHeadline(y, seenTop, usName()) : ''; if (head) { note(s, head); chronNoteWorld(head, true); }
      void checkShifts(sid);
    }
  }
  save(); push();
}

/** 문턱을 넘은 나라의 노선을 실제로 바꾼다(한 번에 하나씩). */
async function checkShifts(sid: string, only?: number): Promise<void> {
  if (!ctx.gameRunning || !link.sessionReady || sid !== ctx.curSaveId) return;
  const s = entry(sid), today = ctx.gameDate || '';
  for (const e of Object.values(s.emp)) {
    if (only !== undefined && e.idx !== only) continue;
    const d = dirOf(e.p); if (!d || !e.ok || !terminal.items.some((c) => c.idx === e.idx)) continue;
    if (e.shifted && monthsBetween(e.shifted, today) < TEMPER.coolYears * 12) continue;
    const req = ++link.reqCounter; let st = '';
    try { st = String((await terminalRequest(shiftCommand(req, e.idx, d), 'TMPSET', req)).kv.status ?? ''); } catch { st = ''; }
    const to = shiftNames.get(String(req)) ?? ''; shiftNames.delete(String(req));
    if (st === 'applied') {
      const from = e.pers || L('알 수 없음', 'unknown'), head = shiftHeadline(e.name, from, to || dirName(d), d);
      e.pers = to || e.pers; e.cls = d; e.shifted = today; e.p = Math.round(e.p / 3);
      note(s, head); chronNoteWorld(head, true); chronNote(e.idx, head);
      ctx.notify({ kind: 'news', title: L('외교 노선 전환', 'Foreign policy shift'), body: head });
    } else if (st === 'same') { e.shifted = today; e.p = Math.round(e.p / 2); }
    else if (st === 'refused') { e.p = 0; note(s, L(`${e.name}은(는) 평화주의 국가라 강경 노선으로 돌아서지 않았다.`, `${e.name} is pacifist and would not turn hardline.`)); }
    else if (st === 'invalid') { e.ok = false; e.p = 0; }
    save();
  }
  push();
}

async function pay(sid: string, payId: string): Promise<void> {
  const req = ++link.reqCounter; let st = '';
  try { st = String((await terminalRequest(payCommand(req, sid, payId), 'TMPPAY', req)).kv.status ?? ''); } catch { st = ''; }
  if (st === 'applied' || st === 'duplicate') return;
  if (st === 'short') throw new Error(L(`에너지 ${TEMPER.op.energy}·영향력 ${TEMPER.op.influence}이 필요합니다.`, `Requires ${TEMPER.op.energy} energy and ${TEMPER.op.influence} influence.`));
  throw new Error(L('게임이 응답하지 않습니다. 잠시 뒤 다시 해 주세요.', 'The game did not respond. Try again shortly.'));
}

export function registerTemper(router: LogRouter): void {
  setTemperHooks({ push: (idx, d, why) => { const sid = ctx.curSaveId || ''; if (pushP(sid, idx, d, why)) push(); } });
  router.on(SLOT.TEMPER, 'temper', (m: SllmMessage) => {
    const k = m.kind; if (k !== 'TMPC' && k !== 'TMPTOP' && k !== 'TMPEND' && k !== 'TMPSET' && k !== 'TMPSETP' && k !== 'TMPPAY') return;
    const rq = String(Math.round(gnum(m.kv.req)));
    if (k === 'TMPC') { const e = parseEmpire(m.kv as Record<string, unknown>); if (e) bufOf(rq).emp.push(e); return; }
    if (k === 'TMPTOP') { const t = parseTop(m.kv as Record<string, unknown>); if (t) bufOf(rq).top.push(t); return; }
    if (k === 'TMPEND') { onRead(rq, m); terminalReplies.get('TMPEND:' + rq)?.(m); return; }
    if (k === 'TMPSETP') { shiftNames.set(rq, String(m.kv.pers ?? '').slice(0, 60)); return; }
    terminalReplies.get(k + ':' + rq)?.(m);
  });
  registerSecFacts({ id: 'Foreign policy shifts', kw: ['노선', '성향', '외교', '강경', '온건', 'stance', 'personality', 'hardline', 'moderate'], facts: (sid) => (sid === ctx.curSaveId ? temperFact(Object.values(entry(sid).emp)) : []) });
  ipcMain.handle('temperState', async () => temperView());
  ipcMain.handle('temperRefresh', async () => {
    const sid = ctx.curSaveId || ''; if (!sid || !ctx.gameRunning || !link.sessionReady) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: temperView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: temperView() };
    busy = true; push();
    try { const req = ++link.reqCounter; await terminalRequest(ctxCommand(req), 'TMPEND', req); return { ok: true, state: temperView() }; }
    catch (e) { return { ok: false, error: (e as Error).message, state: temperView() }; }
    finally { busy = false; push(); }
  });
  /** 첩보 「노선 공작」: dir 1 온건 유도 · 2 강경 유도. 비용(에너지·영향력) → 성공하면 압력 ±35 → 문턱을 넘으면 바로 노선 전환. 들키면 호감 −50·신문. */
  ipcMain.handle('temperOp', async (_e, idxIn: unknown, dirIn: unknown) => {
    const sid = ctx.curSaveId || '', idx = Number(idxIn), dir = (Number(dirIn) === 1 ? 1 : Number(dirIn) === 2 ? 2 : 0) as Dir | 0;
    if (!sid || !ctx.gameRunning || !link.sessionReady) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: temperView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: temperView() };
    const s = entry(sid), e = s.emp[String(idx)];
    if (!dir || !e || !e.ok || !terminal.items.some((c) => c.idx === idx)) return { ok: false, error: L('공작할 수 없는 나라입니다(먼저 「새로 관측」).', 'That nation cannot be targeted (try "Observe again" first).'), state: temperView() };
    if (dir === 2 && e.pac) return { ok: false, error: L('평화주의 국가는 강경 노선으로 돌릴 수 없습니다.', 'A pacifist nation cannot be turned hardline.'), state: temperView() };
    const today = ctx.gameDate || ''; if (e.opAt && monthsBetween(e.opAt, today) < TEMPER.op.coolMonths) return { ok: false, error: L('그 나라에는 1년에 한 번만 공작할 수 있습니다.', 'You can run this operation on a nation once a year.'), state: temperView() };
    busy = true; push();
    try {
      await pay(sid, `t${idx}_${today.replace(/\D/g, '').slice(0, 8)}`);
      e.opAt = today; const ok = Math.random() < TEMPER.op.chance, caught = Math.random() < TEMPER.op.caught;
      const what = dir === 1 ? L('온건 노선 공작', 'moderation operation') : L('강경 노선 공작', 'hardline operation');
      if (ok) { pushP(sid, idx, dir === 1 ? TEMPER.op.push : -TEMPER.op.push, dir === 1 ? ['우리 첩보부의 온건 노선 공작', 'our intelligence service’s moderation campaign'] : ['우리 첩보부의 강경 노선 공작', 'our intelligence service’s hardline campaign']); note(s, L(`${e.name}에 ${what} 성공 — 그 나라 여론이 ${dirName(dir)} 쪽으로 움직였다.`, `${what} against ${e.name} succeeded — opinion there moved ${dirName(dir)}.`)); }
      else note(s, L(`${e.name}에 ${what} 실패 — 여론이 움직이지 않았다.`, `${what} against ${e.name} failed — opinion did not move.`));
      if (caught) {
        const req = ++link.reqCounter; try { await terminalRequest(caughtCommand(req, idx), 'TMPSET', req); } catch { /* 응답 없음 */ }
        const head = L(`${e.name}, ${usName()}의 내정 간섭 공작을 폭로`, `${e.name} exposes ${usName()}’s meddling in its politics`);
        note(s, head); chronNoteWorld(head, true); chronNote(idx, L('우리가 그 나라 외교 노선에 몰래 손대려다 들켰다', 'We were caught secretly meddling in their foreign policy'));
        ctx.notify({ kind: 'event', title: L('노선 공작 발각', 'Operation exposed'), body: L(`${e.name}이(가) 공작을 알아챘습니다. 호감 −50, 신문에 실립니다.`, `${e.name} discovered the operation. Opinion −50, and it will make the news.`) });
      }
      save(); await checkShifts(sid, idx);
      return { ok: true, success: ok, caught, state: temperView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: temperView() }; }
    finally { busy = false; push(); }
  });
}
