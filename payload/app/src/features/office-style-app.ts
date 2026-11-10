// 집무실 종류 고르기(앱 쪽, 2026-10-19). 순수 로직은 src/office-style.ts, 화면은 ui/office-style.js.
// 저장: sllm_office_style.json { saves: { [세이브]: 'auto' | 종류 } }.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { OFFICE_STYLES, isOfficeStyle, autoOfficeStyle, autoTheme } from '../office-style';
import { playerGestalt } from './gestalt-app';

const L = pick;
let data: { saves: Record<string, string> } | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_office_style.json');
function all(): { saves: Record<string, string> } {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'office_style', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'office_style', error: e }); } }
function view() {
  const sid = ctx.curSaveId; let ethics: string[] | null = null;
  try { ethics = ctx.playerIdx >= 0 ? ctx.flagProv.ethicsFor(ctx.playerIdx) : null; } catch { ethics = null; }
  const auto = autoOfficeStyle(ethics, playerGestalt()), choice = (sid && all().saves[sid]) || 'auto';
  const label = (k: string) => { const s = OFFICE_STYLES.find(([x]) => x === k); return s ? L(s[1], s[2]) : k; };
  return { emblemUrl: sid ? ctx.flagProv.emblemFor(ctx.playerIdx) : null, choice, auto, autoKnown: !!ethics, applied: choice === 'auto' ? auto : choice, autoLabel: label(auto), options: OFFICE_STYLES.map(([k]) => ({ key: k, label: label(k) })) };
}
export function registerOfficeStyle(): void {
  ipcMain.handle('officeStyle', async () => view());
  ipcMain.handle('autoTheme', async () => { let ethics: string[] | null = null; try { ethics = ctx.playerIdx >= 0 ? ctx.flagProv.ethicsFor(ctx.playerIdx) : null; } catch { ethics = null; } return autoTheme(ethics, playerGestalt()); }); // 색 테마 「자동」(알파 11)
  ipcMain.handle('officeStyleSet', async (_e, key: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤 바꿀 수 있습니다.', 'Load a save first.'), state: view() };
    if (key !== 'auto' && !isOfficeStyle(key)) return { ok: false, error: L('알 수 없는 집무실입니다.', 'Unknown office style.'), state: view() };
    if (key === 'auto') delete all().saves[sid]; else all().saves[sid] = key as string;
    save(); return { ok: true, state: view() };
  });
}
