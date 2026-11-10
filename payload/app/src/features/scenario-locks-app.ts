// 시나리오 잠금(앱 쪽, 2026-11-06). 규칙: src/scenario-locks.ts · 화면: ui/scenario-locks-ui.js
// 국내 정치 선택은 세이브별로 한 번(userData/sllm_scenario_locks.json). 판 도중에는 바꾸지 않는다(하드코어 선택의 무게).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { setFeatureGate, ROUTE_LOCK } from '../app/feature-gate';
import type { LogRouter } from '../app/log-router';
import { lockedKeys, selectorsFor, ALWAYS_LOCKED, type LockKey } from '../scenario-locks';

const KEEP = 30;
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_locks.json');
let all: Record<string, { politics: boolean }> | null = null;
function picks(): Record<string, { politics: boolean }> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k) && v && typeof (v as { politics?: unknown }).politics === 'boolean') all[k] = { politics: (v as { politics: boolean }).politics }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_locks', error: (e as Error).message }); }
  return all;
}
function save(): void {
  try { const p = picks(), keys = Object.keys(p); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete p[k]; const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: p })); fs.renameSync(t, file()); }
  catch (e) { logDiagnostic('warn', 'scenario_locks.save_failed', { error: (e as Error).message }); }
}

/** 다른 기능이 「이 시나리오에서 잠겼나?」를 물을 때(메인 쪽). 시나리오가 아니면 늘 false. */
export function scenarioLocked(key: LockKey): boolean {
  const s = scenarioNow(), sid = ctx.curSaveId; if (!s || !sid || !ALWAYS_LOCKED[s.id]) return false;
  return lockedKeys({ scenario: s.id, seat: s.seat, politics: picks()[sid]?.politics ?? null }).includes(key);
}
export const lockedText = (): string => L('이 시나리오에서는 쓸 수 없는 기능입니다.', 'This feature is not available in this scenario.');

function state(): Record<string, unknown> {
  const s = scenarioNow(), sid = ctx.curSaveId;
  if (!s || !sid || !ALWAYS_LOCKED[s.id]) return { ok: true, on: false, hide: [] };
  const politics = picks()[sid]?.politics ?? null;
  const keys = lockedKeys({ scenario: s.id, seat: s.seat, politics });
  return { ok: true, on: true, ask: politics === null, politics, locked: keys, hide: selectorsFor(keys) };
}

/** 지금 잠긴 기능 열쇠(시나리오가 아니면 빈 목록). 기능 문(feature-gate)이 2초마다 읽는다. */
function lockedNow(): string[] {
  const s = scenarioNow(), sid = ctx.curSaveId; if (!s || !sid || !ALWAYS_LOCKED[s.id]) return [];
  return lockedKeys({ scenario: s.id, seat: s.seat, politics: picks()[sid]?.politics ?? null });
}

export function registerScenarioLocks(router?: LogRouter): void {
  // 잠긴 기능은 아이콘만 숨기지 않고 아예 쉬게 한다(2026-11-08 사용자: 「아예 동작도 안 해야」): 로그 줄·월간 상황·자체 타이머 모두
  setFeatureGate(lockedNow);
  if (router) { const offNow = new Set<string>(); let at = 0; router.gate = (name) => { const k = ROUTE_LOCK[name]; if (!k) return false; const now = Date.now(); if (now - at > 2000) { at = now; offNow.clear(); for (const x of lockedNow()) offNow.add(x); } return offNow.has(k); }; }
  ipcMain.handle('scnLocks', async () => { try { return state(); } catch (e) { logDiagnostic('warn', 'scenario_locks.state_failed', { error: e }); return { ok: false, on: false, hide: [] }; } });
  ipcMain.handle('scnPolitics', async (_e, on: unknown) => {
    const sid = ctx.curSaveId, s = scenarioNow();
    if (!sid || !s || !ALWAYS_LOCKED[s.id]) return { ok: false, error: lockedText() };
    if (picks()[sid]) return { ok: false, error: L('이 판에서는 이미 정했습니다.', 'Already decided for this game.') };
    picks()[sid] = { politics: on === true }; save();
    logDiagnostic('info', 'scenario_locks.politics', { sid, on: on === true });
    return { ok: true, ...state() };
  });
}
export const scnLocksTest = { reset: () => { all = {}; } };
