// 파파라치 창(2026-10-31, 계획서 11번). 규칙·틀 기사: src/paparazzi.ts · 화면: ui/paparazzi.html.
// 외출 장소들이 사건을 알려 줌(paparazziSnap) → 확률로 사진이 찍히면 「찰칵!」 창이 떠서 매수·무시·고소를 고름. 한 달 안에 안 고르면 기사가 나감.
// 기사는 틀 문장(AI 없음) → 타블로이드 목록·알림·연대기. 효과: 민심(moodNudge) · 부패 낌새(vaultSuspicionUp) · 외국 호감(모드 opinion modifier, 게임이 켜져 있을 때만).
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import { SNAP, PAP, paperName, bribeOf, canSue, article, caption, daysBetween, papOpinionCommand, type SnapKind, type Pair } from '../paparazzi';
import { vaultBalance, spendFromVault, vaultSuspicionUp } from './vault-app';
import { moodNudge } from './mood-app';
import { chronNote } from './chronicle-app';
import { terminalRequest } from './terminal';
import { link } from '../app/game-link';
import { onGameSnapshot } from './gamestate-app';

interface Snap { id: string; kind: SnapKind; on: string; v: Record<string, string | number> }
interface Story { id: string; kind: SnapKind; on: string; head: Pair; body: Pair; how: 'ignored' | 'lostSuit' | 'timeout'; extra?: Pair }
interface PapSave { pending: Snap[]; stories: Story[]; quiet: Array<{ kind: SnapKind; on: string; how: 'bribed' | 'wonSuit' }>; n: number; op: number }
const file = () => path.join(app.getPath('userData'), 'sllm_paparazzi.json');
let data: { saves: Record<string, PapSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'paparazzi', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'paparazzi', error: e }); } }
const saveOf = (sid: string): PapSave => { const s = (all().saves[sid] ??= { pending: [], stories: [], quiet: [], n: 0, op: Math.floor(Date.now() / 1000) % 90_000_000 }); /* op: 게임 쪽 표시와 겹치지 않게 시각에서 시작 */ s.pending = (s.pending ?? []).filter((p) => p && p.kind in SNAP); s.stories = (s.stories ?? []).filter((x) => x && x.kind in SNAP); s.quiet = (s.quiet ?? []).filter((q) => q && q.kind in SNAP); s.n ??= 0; s.op = Number.isSafeInteger(s.op) && s.op > 0 ? s.op : Math.floor(Date.now() / 1000) % 90_000_000; return s; };

let win: BrowserWindow | null = null, rand: () => number = Math.random;
const kindName = (k: SnapKind) => L(...caption(k, {})).replace(/\s+/g, ' ').replace(/ ([을를와과에])\(/g, '$1(');

/** 외출 장소가 부름: 사건 하나. 확률로 사진이 찍히면 창을 띄움. 돌려줌: 찍혔나. */
export function paparazziSnap(kind: SnapKind, v: Record<string, string | number> = {}): boolean {
  const sid = ctx.curSaveId; if (!sid) return false;
  try {
    if (rand() >= SNAP[kind].chance) return false;
    const s = saveOf(sid), on = ctx.gameDate || '';
    if (s.pending.some((p) => p.kind === kind && p.on === on)) return false; // 같은 날 같은 사건은 한 장
    s.pending.push({ id: `p${++s.n}`, kind, on, v: { ruler: ctx.playerName || '', ...v } }); s.pending = s.pending.slice(-6); save();
    openPaparazzi(); return true;
  } catch (e) { logDiagnostic('warn', 'paparazzi.snap_failed', { error: String((e as Error)?.message || e) }); return false; }
}

/** 기사 내기: 틀 기사 · 효과(민심·부패 낌새·외국). */
function publish(sid: string, sn: Snap, how: Story['how'], extra?: Pair): Story {
  const s = saveOf(sid), r = SNAP[sn.kind], a = article(sn.kind, sn.v, s.n + sn.id.length);
  const st: Story = { id: sn.id, kind: sn.kind, on: ctx.gameDate || sn.on, head: a.head, body: a.body, how, ...(extra ? { extra } : {}) };
  s.stories.push(st); s.stories = s.stories.slice(-PAP.keep);
  const mood = r.mood + (how === 'lostSuit' ? PAP.suitBackfire : 0); if (mood) moodNudge(mood, `paparazzi: ${a.head[1]}`.slice(0, 120));
  if (r.susp) vaultSuspicionUp(sid, r.susp);
  if (r.foreign) void foreign(sid, r.foreign);
  try { if (ctx.playerIdx) chronNote(ctx.playerIdx, L(`${st.on} 「${L(...paperName)}」 ${a.head[0]}`, `${st.on} "${L(...paperName)}": ${a.head[1]}`)); } catch { /* 연대기 없음 */ }
  ctx.notify({ kind: 'news', title: L(`[${paperName[0]}] `, `[${paperName[1]}] `) + L(...a.head), body: L(...a.body) });
  return st;
}
async function foreign(sid: string, tone: 'good' | 'bad'): Promise<void> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return; const s = saveOf(sid), n = ++s.op; save();
  try { const req = ++link.reqCounter; await terminalRequest(papOpinionCommand(req, sid, n, tone), 'PAPOP', req); } catch (e) { logDiagnostic('warn', 'paparazzi.foreign_failed', { error: String((e as Error)?.message || e) }); }
}

/** 한 달 안에 안 고른 사진은 기사로(달마다 확인). */
function timeouts(sid: string): void {
  const s = saveOf(sid), d = ctx.gameDate || ''; if (!d) return; let changed = false;
  for (const sn of s.pending.slice()) if (daysBetween(sn.on, d) >= PAP.waitDays) { s.pending = s.pending.filter((x) => x !== sn); publish(sid, sn, 'timeout'); changed = true; }
  if (changed) { save(); push(); }
}

export function paparazziView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const s = saveOf(sid), d = ctx.gameDate || '';
  return {
    sid, ready: true, vault: vaultBalance(sid), paper: L(...paperName), suitFee: PAP.suitFee, suitWin: Math.round(PAP.suitWin * 100),
    pending: s.pending.map((p) => ({ id: p.id, kind: p.kind, on: p.on, tone: SNAP[p.kind].tone, sev: SNAP[p.kind].sev, caption: L(...caption(p.kind, p.v)), bribe: bribeOf(p.kind), canSue: canSue(p.kind), daysLeft: Math.max(0, PAP.waitDays - (d ? daysBetween(p.on, d) : 0)),
      effects: { mood: SNAP[p.kind].mood, susp: SNAP[p.kind].susp > 0, foreign: SNAP[p.kind].foreign } })),
    stories: s.stories.slice().reverse().map((x) => ({ id: x.id, on: x.on, head: L(...x.head), body: L(...x.body), tone: SNAP[x.kind].tone, how: x.how, extra: x.extra ? L(...x.extra) : '' })),
    quiet: s.quiet.slice(-10).reverse().map((q) => ({ what: kindName(q.kind), on: q.on, how: q.how })),
  };
}
const push = () => safeSend(win, 'paparazziState', paparazziView());

export function openPaparazzi(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 열 수 있습니다.', 'Load a save first.') };
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1000, Math.round(area.width * 0.7)), height: Math.min(820, Math.round(area.height * 0.85)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 760, minHeight: 560, frame: false, show: false, backgroundColor: '#0b0b0e', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 2); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'paparazzi.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: paparazziView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: paparazziView() });
/** 고르기: bribe = 매수(금고, 기사 없음) · ignore = 무시(기사 나감) · sue = 고소(소송비, 이기면 기사 없음, 지면 기사 + 역풍). */
export function decideSnap(sid: string, id: string, choice: string): { msg: string } {
  const s = saveOf(sid), sn = s.pending.find((p) => p.id === id); if (!sn) throw new Error(L('그 사진은 이미 처리되었습니다.', 'That photo has already been dealt with.'));
  const drop = () => { s.pending = s.pending.filter((p) => p !== sn); };
  if (choice === 'bribe') {
    const c = bribeOf(sn.kind); if (!spendFromVault(sid, c, 'paparazzi bribe')) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${c}).`, `Not enough credits in the vault (need ${c}).`));
    drop(); s.quiet.push({ kind: sn.kind, on: ctx.gameDate || sn.on, how: 'bribed' }); s.quiet = s.quiet.slice(-30); save();
    return { msg: L(`${c} 크레딧에 사진과 원본을 사들였습니다. 기사는 나가지 않습니다.`, `You bought the photos and negatives for ${c} credits. No story will run.`) };
  }
  if (choice === 'sue') {
    if (!canSue(sn.kind)) throw new Error(L('좋은 기사는 고소할 이유가 없습니다.', 'There is no reason to sue over a flattering story.'));
    if (!spendFromVault(sid, PAP.suitFee, 'paparazzi lawsuit')) throw new Error(L(`금고에 소송비가 모자랍니다(필요 ${PAP.suitFee}).`, `Not enough in the vault for legal fees (need ${PAP.suitFee}).`));
    drop();
    if (rand() < PAP.suitWin) { s.quiet.push({ kind: sn.kind, on: ctx.gameDate || sn.on, how: 'wonSuit' }); s.quiet = s.quiet.slice(-30); save(); return { msg: L('법원이 사생활 침해를 인정했습니다. 사진은 폐기되고 기사는 나가지 않습니다.', 'The court found an invasion of privacy. The photos are destroyed and no story will run.') }; }
    publish(sid, sn, 'lostSuit', ['「언론 탄압」 역풍 — 고소에서 진 뒤 기사가 오히려 더 퍼졌다.', '"Press crackdown" backlash — after losing the suit, the story spread even further.']); save();
    return { msg: L('고소에서 졌습니다. 기사가 나갔고 「언론 탄압」 역풍까지 불었습니다.', 'You lost the suit. The story ran, with a "press crackdown" backlash on top.') };
  }
  drop(); publish(sid, sn, 'ignored'); save();
  return { msg: L('내버려 두었습니다. 기사가 나갔습니다.', 'You let it be. The story ran.') };
}

export function registerPaparazzi(): void {
  ipcMain.handle('paparazziOpen', () => openPaparazzi());
  ipcMain.handle('paparazziState', () => paparazziView());
  ipcMain.handle('paparazziClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  ipcMain.handle('paparazziDecide', (_e, id: unknown, choice: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); const r = decideSnap(sid, String(id ?? ''), String(choice ?? '')); push(); return ok(r); } catch (e) { return err(e); } });
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId || !snap.date) return; try { timeouts(snap.sid); } catch (e) { logDiagnostic('warn', 'paparazzi.month_failed', { error: String((e as Error)?.message || e) }); } });
}
export const _papTest = { saveOf, paparazziView, decideSnap, timeouts, setRand: (r: () => number) => { rand = r; } };
