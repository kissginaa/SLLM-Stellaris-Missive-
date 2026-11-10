// 게임 폴더 연결 DLL 자동 교체 — 앱 쪽(2026-11-04 사용자: 「이번부터 바꾸자」). 규칙: src/game-dll.ts
// 언제: 앱이 켜지고 게임 상태를 알게 된 뒤 게임이 꺼져 있으면 한 번, 그리고 게임이 꺼질 때마다. 게임이 켜져 있는 동안에는 절대 하지 않는다.
// 설치판(앱 폴더에 game-install-path.txt 가 있음)에서만 한다. 개발 폴더는 native-bridge 가 앱 native 의 DLL 을 바로 쓴다.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { gameCandidates } from '../environment-paths';
import { readGamePathFile } from '../native-bridge';
import { syncGameDlls, type DllSync } from '../game-dll';

let last: boolean | null = null, warned = false;
export let lastDllSync: DllSync[] = [];

function run(): void {
  const appDir = app.getAppPath(), gamePathFile = path.join(appDir, 'game-install-path.txt');
  if (!fs.existsSync(gamePathFile)) return;
  let res: DllSync[];
  try { res = syncGameDlls(appDir, [readGamePathFile(gamePathFile), ...gameCandidates()]); }
  catch (e) { logDiagnostic('warn', 'game_dll.sync_error', { error: (e as Error).message }); return; }
  lastDllSync = res;
  const upd = res.filter((r) => r.state === 'updated'), bad = res.filter((r) => r.state === 'failed');
  if (upd.length || bad.length) logDiagnostic(bad.length ? 'warn' : 'info', 'game_dll.sync', { res });
  if (upd.length) ctx.notify({ kind: 'info', title: L('게임 연결 파일을 새로 넣었습니다', 'Game connection file updated'), body: L('새 게임 버전에 맞춘 연결 파일로 바꿨습니다. 다음에 게임을 켜면 그대로 연결됩니다.', 'Replaced it with one made for the new game version. It will connect next time you start the game.') });
  if (bad.length && !warned) {
    warned = true;
    ctx.notify({ kind: 'info', title: L('게임 연결 파일을 바꾸지 못했습니다', 'Could not update the game connection file'), body: L('게임 폴더에 쓰지 못했습니다(권한·백신 차단일 수 있음). 게임을 끈 상태로 앱을 다시 켜 보고, 그래도 안 되면 설치 프로그램을 다시 실행해 주세요.', 'Could not write to the game folder (permissions or antivirus). Restart the app with the game closed; if it still fails, run the installer again.') });
  }
}

export function registerGameDll(): void {
  // processRunning: null = 아직 모름, true/false = 창 감시가 알려 준 값
  setInterval(() => {
    const now = link.processRunning as boolean | null;
    if (now === null || now === last) return;
    const was = last; last = now;
    if (!now && was !== false) run(); // 앱 켤 때 꺼져 있음(null→false) · 게임이 꺼짐(true→false)
  }, 3000).unref?.();
}
