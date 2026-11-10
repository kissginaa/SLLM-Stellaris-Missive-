// A-26 총독 홀로그램 보고(앱 쪽): 새해(YEAR)마다 행성 목록을 읽어 문제가 큰 행성의 총독이 통신을 요청한다.
// 알림의 "통신 받기" → 통치자 집무실 컨셉의 별도 홀로그램 창(ui/govreport.html). 총독 기억은 총독 대화와 같은 저장소를 쓴다.
import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { PlanetList, Planet, govMessages, extractGovSay, govLooksCut, governorName, DEFAULT_GOVERNOR, planetType, className } from '../planets';
import { pickReport, reportOpening, planetTrouble } from '../govreport';
import { govKey, cleanMemText } from '../govmemory';
import { classKey } from '../speciesClass';
import { planetsEffect } from '../protocol';
import type { ChatMessage } from '../player2';
import type { SllmMessage } from '../protocol';
import { enqueue, sendConsole } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { gov, govMem, govRawLog } from './gov';
import { ctx } from '../app/ctx';
import { pick } from './settings-ui';
const L = pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)

interface Report { sid: string; year: string; list: PlanetList; index: number; reasons: string[]; history: ChatMessage[]; opened: boolean; first: string | null; demo: boolean }
export const govReport = { win: null as BrowserWindow | null, cur: null as Report | null, busy: false };
const asked = new Map<string, string>(); // sid → 이미 요청한 해(같은 해에 두 번 오지 않게)
const startedAt = Date.now();

/** 행성 목록을 게임에 요청하고 PLANETS_END 를 기다린다(총독 창과 같은 대기열). */
async function readPlanets(): Promise<PlanetList | null> {
  const sid = ctx.curSaveId;
  let waiter: ((l: PlanetList) => void) | null = null, timer: ReturnType<typeof setTimeout> | null = null;
  const wait = new Promise<PlanetList | null>((res) => {
    waiter = (l) => { if (timer) clearTimeout(timer); res(sid && l.sid && l.sid !== sid ? null : l); }; // 다른 세이브의 목록은 받지 않는다(총독 창과 같은 규칙, 2026-10-18)
    gov.waiters.push(waiter);
    timer = setTimeout(() => { const i = waiter ? gov.waiters.indexOf(waiter) : -1; if (i >= 0) gov.waiters.splice(i, 1); res(null); }, 15000);
  });
  try { await enqueue(() => sendConsole(planetsEffect())); } catch (error) { logDiagnostic('warn', 'govreport.request_failed', { error }); return null; }
  return wait;
}
/** 새해 신호: 같은 세이브·같은 해에는 한 번만. 앱을 켠 직후(지난 로그를 다시 읽는 중)이거나 게임이 꺼져 있으면 하지 않는다. */
export async function onNewYear(date: string): Promise<void> {
  const sid = ctx.curSaveId, year = (date || '').split('.')[0];
  if (!sid || !year || !ctx.gameRunning || Date.now() - startedAt < 20000) return;
  if (asked.get(sid) === year) return; asked.set(sid, year);
  const list = await readPlanets(); if (!list || ctx.curSaveId !== sid) return;
  const pick = pickReport(list); if (!pick) { logDiagnostic('info', 'govreport.none', { year }); return; }
  offer({ sid, year, list, index: pick.index, reasons: pick.reasons, history: [], opened: false, first: null, demo: false });
}
export function offer(r: Report): void {
  govReport.cur = r;
  const p = r.list.planets[r.index];
  ctx.notify({ kind: 'gov', title: L('총독 통신 요청', 'Governor calling'), body: L(`${p.name}의 ${governorName(p)}: 보고드릴 것이 있습니다 (${r.reasons.join(', ')})`, `${governorName(p)} of ${p.name}: I have something to report (${r.reasons.join(', ')})`), action: L('통신 받기', 'Take the call') });
}
const memKey = (r: Report) => { const p = r.list.planets[r.index], n = governorName(p); return n === DEFAULT_GOVERNOR ? null : govKey(r.list.sid || r.sid, n); };
function view() {
  const r = govReport.cur; if (!r) return null;
  const p: Planet = r.list.planets[r.index];
  return { demo: r.demo, empire: r.list.empire, year: r.year, planet: p.name, type: planetType(p), capital: p.capital, pops: p.pops, popsApprox: !!p.popsApprox, stability: p.stability, amenities: p.amenities, housing: p.housing,
    governor: governorName(p), cls: classKey(r.list.cls), clsName: className(r.list.cls), reasons: r.reasons, log: r.history.map((m) => ({ who: m.role === 'user' ? 'me' : 'gov', text: m.content })).filter((l, i) => !(i === 0 && l.who === 'me')), first: r.first, busy: govReport.busy };
}
function push() { if (govReport.win && !govReport.win.isDestroyed()) govReport.win.webContents.send('govReport', view()); }
export function openGovReport(): void {
  if (!govReport.cur) return;
  govReport.cur.opened = true;
  if (govReport.win && !govReport.win.isDestroyed()) { govReport.win.show(); govReport.win.focus(); push(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1180, Math.round(area.width * 0.78)), height: Math.min(800, Math.round(area.height * 0.86)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  govReport.win = new BrowserWindow({ ...sz, x, y, minWidth: 720, minHeight: 520, frame: false, show: false, backgroundColor: '#05090c', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  govReport.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void govReport.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'govreport.html'));
  govReport.win.once('ready-to-show', () => { govReport.win?.show(); push(); void speak(null); });
  govReport.win.on('closed', () => { govReport.win = null; });
}
/** 총독의 한 마디. text 가 null 이면 첫 보고. */
async function speak(text: string | null): Promise<{ ok: boolean; error?: string }> {
  const r = govReport.cur; if (!r) return { ok: false, error: L('보고가 없습니다.', 'No report.') };
  if (text === null && r.first) return { ok: true };
  if (govReport.busy) return { ok: false, error: L('총독이 말하는 중입니다.', 'The governor is speaking.') };
  govReport.busy = true; push();
  try {
    const p = r.list.planets[r.index], key = memKey(r), mv = key ? govMem().view(key) : null;
    const q = text === null ? reportOpening(p, r.reasons) : text;
    const msgs = govMessages(r.list, p, ctx.playerName, r.history, q, mv ? mv.own : undefined, mv ? mv.other : undefined);
    let raw = await ctx.ai.chat(msgs, { maxTokens: 1500 });
    govRawLog(q, raw, false);
    if (govLooksCut(raw)) { raw = await ctx.ai.chat([...msgs, { role: 'user', content: '[System notice] Your last reply was cut off. Say the same thing again in three or four sentences, finishing every sentence.' }], { maxTokens: 2500 }); govRawLog(q, raw, true); }
    if (govReport.cur !== r) return { ok: false, error: L('보고가 바뀌었습니다.', 'The report has changed.') };
    const ex = extractGovSay(raw);
    if (key && ex.memo) govMem().add(key, cleanMemText(ex.memo), ctx.gameDate);
    r.history.push({ role: 'user', content: q }, { role: 'assistant', content: ex.say });
    if (text === null) r.first = ex.say;
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  finally { govReport.busy = false; push(); }
}
export function registerGovReport(router: LogRouter): void {
  router.on(SLOT.GOVREPORT, 'govreport:year', () => { /* 무시 */ }); // 새해 총독 통신 요청은 2026-10-23 사용자 결정으로 뗐다(행성 문제 보고는 비서 업무 보고가 맡는다). 창·IPC 는 개발자 시험용으로만 남는다.
  ipcMain.handle('govReportState', async () => view());
  ipcMain.handle('govReportSay', async (_e, text: unknown) => {
    const t = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    if (!t) return { ok: false, error: L('할 말을 적어 주세요.', 'Write what you want to say.') };
    return speak(t);
  });
  ipcMain.handle('govReportRetry', async () => speak(null));
  ipcMain.handle('govReportClose', async () => { if (govReport.win && !govReport.win.isDestroyed()) govReport.win.close(); govReport.win = null; return true; });
}
/** 개발자 시험: 가짜 행성 목록으로 보고 창을 바로 연다(게임 명령 없음, AI 연결은 필요). */
export function demoGovReport(): void {
  const list: PlanetList = { run: 0, sid: 'dev', cls: 1, empire: '[시험] 인류 연방', planets: [
    { name: '[시험] 뉴 아테네', pops: 42, stability: 31, amenities: -8.5, housing: -3, capital: false, pc: 3, governor: '[시험] 엘레나 바로스' },
    { name: '[시험] 지구', pops: 120, stability: 72, amenities: 12, housing: 4, capital: true, pc: 3, governor: null },
  ] };
  const t = planetTrouble(list.planets[0]);
  govReport.cur = { sid: 'dev', year: '2210', list, index: 0, reasons: t.reasons, history: [], opened: false, first: null, demo: true };
  openGovReport();
}
