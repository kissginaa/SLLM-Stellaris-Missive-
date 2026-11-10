// 민심(2026-10-20 알파 10): 월간 상황(STATE)이 올 때마다 점수를 계산해 세이브별로 기록하고, 급락·분노 단계 진입을 알린다.
// 규칙: src/mood.ts. 화면: ui/office-mood.js(집무실 머리말의 민심 칩). 신문·라디오는 moodPromptNow() 한 줄을 프롬프트에 넣는다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { featureOff } from '../app/feature-gate';
import { pick } from './settings-ui';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { safeKey } from '../music';
import type { StateSnapshot } from '../gamestate';
import { type Mood, type MoodLevel, computeMood, moodLevel, pushMood, moodTrend, moodAlert, moodPromptLine, sanitizeMood, activeAdj, MOOD_KO, MOOD_EN } from '../mood';

const L = pick;
const file = () => path.join(app.getPath('userData'), 'sllm_mood.json');
let store: ReturnType<typeof sanitizeMood> | null = null;
function all() { if (store) return store; try { store = sanitizeMood(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'mood', error: e }); store = sanitizeMood({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'mood', error: e }); } }, 2000); }
const entry = (sid: string) => (all().saves[safeKey(sid)] ??= { series: [], alerted: '', adj: [] });

export const mood = { cur: null as Mood | null, date: '' };
export function onMoodSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId) return;
  const e = entry(snap.sid), m = computeMood(snap, activeAdj(e.adj, snap.date)); if (!m) return;
  mood.cur = m; mood.date = snap.date;
  e.series = pushMood(e.series, { date: snap.date, score: m.score });
  const al = moodAlert(e.series, e.alerted);
  if (al) {
    e.alerted = m.level;
    ctx.notify({ kind: 'info', title: al.kind === 'unrest' ? L('민심이 분노로 치달았습니다', 'Public mood has turned to unrest') : L(`민심이 반년 사이 ${al.drop}점 떨어졌습니다`, `Public mood fell ${al.drop} points in half a year`), body: L(`지금 민심: ${MOOD_KO[m.level]} ${m.score}/100`, `Public mood now: ${MOOD_EN[m.level]} ${m.score}/100`) });
    chronNoteWorld(`${snap.date} ${L(`민심 ${MOOD_KO[m.level]}(${m.score})`, `Public mood ${MOOD_EN[m.level]} (${m.score})`)}`, true);
  } else if (e.alerted && m.score >= 45) e.alerted = ''; // 회복하면 다시 알릴 수 있게
  save();
  pushView();
}
/** 사건이 민심을 잠시 흔든다(비방 기사 대응 등). value −15~+15, 1년에 걸쳐 사라진다. */
export function moodNudge(value: number, why: string): void {
  if (!ctx.curSaveId || !value) return; const e = entry(ctx.curSaveId); e.adj.push({ date: ctx.gameDate || mood.date || '', value: Math.max(-15, Math.min(15, Math.round(value))), why: why.slice(0, 120) }); e.adj = e.adj.slice(-20); save();
}
/** 신문·라디오 프롬프트 한 줄(없으면 빈 글). */
export function moodPromptNow(): string {
  // 시나리오에서 민심을 뺐으면 신문·라디오에도 넣지 않는다(2026-11-08)
  if (!mood.cur || !ctx.curSaveId || featureOff('mood')) return ''; return moodPromptLine(mood.cur, moodTrend(entry(ctx.curSaveId).series));
}
export function moodView() {
  const sid = ctx.curSaveId || '', e = sid ? entry(sid) : null, m = mood.cur, last = e?.series[e.series.length - 1];
  const score = m?.score ?? last?.score ?? null, level = m?.level ?? (score !== null ? moodLevel(score) : null); // 이번 실행에서 아직 상황이 안 왔으면 지난 기록으로
  return { sid, date: mood.date || last?.date || '', score, level, label: level ? L(MOOD_KO[level], MOOD_EN[level]) : '', parts: m?.parts ?? null, trend: e ? moodTrend(e.series) : 0, series: e ? e.series.slice(-24) : [], adj: e ? e.adj.slice(-5).reverse() : [] };
}
function pushView(): void { try { const v = moodView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('moodUpdate', v); } catch { /* 창 없음 */ } }
export function registerMood(): void {
  registerSecFacts({ id: 'National mood', kw: ['민심', '여론', '지지율', '국민', 'mood', 'public opinion', 'approval'], facts: (sid) => { if (sid !== ctx.curSaveId) return []; const v = moodView(); if (v.score === null) return []; return [`National mood: ${v.score}/100 (${v.level ? MOOD_EN[v.level] : '?'}), trend ${v.trend > 0 ? 'rising' : v.trend < 0 ? 'falling' : 'flat'}.`, ...(v.adj.length ? ['Recent mood changes from app events: ' + v.adj.map((a) => `${a.date} ${a.value > 0 ? '+' : ''}${a.value} ${a.why}`).join('; ')] : [])]; } }); // 비서가 아는 기록(2026-10-31)
  ipcMain.handle('moodState', async () => moodView());
}
export type { MoodLevel };
