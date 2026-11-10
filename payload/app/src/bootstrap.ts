// 첫 설치 도우미(2026-10-21 사용자 결정 A안: 설치기 다이어트).
// 설치기에는 실행 프로그램(runtime)·게임 연결 DLL·공개 키·이 도우미만 들어 있다. start_app.bat 은 dist/main.js 가 없으면
// runtime\electron.exe 로 이 파일을 켠다. 도우미는 창작마당 구독본(또는 업로드 원본 문서\mod\sllm_missive)의 sllm_app_update 묶음을
// 공개 키로 서명 확인 → 모든 파일 해시 확인 → 앱 폴더에 채운 뒤 전체 앱을 켜고 끝난다. AI 호출·게임 명령·사용자 데이터 변경 없음.
// 판정·교체는 app-update-core.ts(앱 안 업데이트와 같은 서명·해시 규칙). 이 파일은 전체 앱(main.ts)에서 부르지 않는다.
import { app, BrowserWindow, dialog, shell } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyUpdate, findInstallBundle, FULL_APP_MARKER, PUBLIC_KEY_FILE, type InstallCheck } from './app-update-core';
import { connectionWorkshopCandidates, userCandidates, CONNECTION_WORKSHOP_ID, initializeEnvironment } from './environment-paths';

const appDir = path.resolve(__dirname, '..');
// 앱 설정의 언어는 전체 앱이 생긴 뒤에야 읽을 수 있으므로, 처음 한 번은 Windows 언어를 따른다.
const ko = () => /^ko/i.test(app.getLocale() || '');
const T = (k: string, e: string) => (ko() ? k : e);
const TITLE = () => T('SLLM 첫 설치', 'SLLM first-time setup');

function modDirs(): string[] {
  return [...connectionWorkshopCandidates(), ...userCandidates().filter(Boolean).map((u) => path.join(u, 'mod', 'sllm_missive'))];
}
function check(): InstallCheck {
  return findInstallBundle(appDir, modDirs(), fs.readFileSync(path.join(appDir, PUBLIC_KEY_FILE), 'utf8'));
}
/** 진행 창(조작 없음). 파일을 채우는 동안만 띄운다. */
function progressWindow(text: string): BrowserWindow {
  const w = new BrowserWindow({ width: 460, height: 170, resizable: false, minimizable: false, maximizable: false, title: TITLE(), backgroundColor: '#071117', autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  const esc = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  void w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;background:#071117;color:#d5e6e8;font:15px 'Malgun Gothic','Segoe UI',sans-serif;text-align:center;padding:0 24px"><div><b style="color:#e6c87b">SLLM Missive</b><p>${esc}</p></div></body>`));
  return w;
}
function launchFullApp(): void {
  const child = spawn(process.execPath, [appDir], { detached: true, stdio: 'ignore', env: process.env, cwd: appDir });
  child.unref();
}
function message(r: Exclude<InstallCheck, { kind: 'ready' }>): { text: string; detail: string } {
  switch (r.kind) {
    case 'missing': return { text: T('창작마당 모드에서 앱 파일을 찾지 못했습니다.', 'Could not find the app files from the Workshop mod.'),
      detail: T('Steam 창작마당에서 「SLLM Missive」를 구독하고 다운로드가 끝난 뒤 「다시 확인」을 눌러 주세요. 앱 파일은 그 모드 안에 들어 있습니다.', 'Subscribe to "SLLM Missive" on the Steam Workshop, wait for the download to finish, then press "Check again". The app files ship inside that mod.') };
    case 'downloading': return { text: T('창작마당 모드를 아직 받는 중인 것 같습니다.', 'The Workshop mod still seems to be downloading.'),
      detail: T('Steam 다운로드가 끝난 뒤 「다시 확인」을 눌러 주세요.', 'Press "Check again" after Steam finishes downloading.') + '\n(' + r.detail + ')' };
    case 'bad_signature': return { text: T('창작마당 모드의 앱 파일 서명을 확인하지 못했습니다.', 'The app files in the Workshop mod failed the signature check.'),
      detail: T('안전을 위해 설치하지 않았습니다. Steam에서 모드 파일 무결성 확인(구독 해제 후 다시 구독)을 한 뒤 다시 시도하거나, SLLM 디스코드에 알려 주세요.', 'Nothing was installed, for safety. Re-subscribe to the mod in Steam and try again, or let us know on the SLLM Discord.') };
    case 'needs_installer': return { text: T(`창작마당의 앱(${r.version})은 게임 연결 DLL이 바뀐 버전입니다.`, `The Workshop app (${r.version}) uses a different game connection DLL.`),
      detail: T('SLLM 디스코드 #download 채널에서 같은 버전의 설치 프로그램을 받아 설치해 주세요.', 'Please get the matching installer from the SLLM Discord #download channel.') };
  }
}
async function run(): Promise<void> {
  // 2026-10-22 실기(알파 10 설치기): 이 초기화가 없으면 Steam 라이브러리 목록이 비어 창작마당 폴더를 전혀 찾지 못했다(전체 앱은 main.ts 에서 부른다).
  initializeEnvironment(app.getPath('documents'));
  if (fs.existsSync(path.join(appDir, ...FULL_APP_MARKER.split('/')))) { launchFullApp(); return; } // 이미 채워짐(바로가기를 두 번 누른 경우 등)
  if (!fs.existsSync(path.join(appDir, PUBLIC_KEY_FILE))) {
    await dialog.showMessageBox({ type: 'error', title: TITLE(), message: T('설치가 온전하지 않습니다(공개 키 없음).', 'The installation is incomplete (public key missing).'), detail: T('설치 프로그램을 다시 실행해 주세요.', 'Please run the installer again.'), buttons: [T('닫기', 'Close')] });
    return;
  }
  for (;;) {
    let r: InstallCheck;
    try { r = check(); } catch (e) { r = { kind: 'downloading', detail: String((e as Error)?.message || e) }; }
    if (r.kind === 'ready') {
      const w = progressWindow(T(`창작마당 모드에서 앱 파일을 채우는 중입니다… (${r.version}, ${r.changed.length}개)`, `Copying app files from the Workshop mod… (${r.version}, ${r.changed.length} files)`));
      await new Promise((ok) => setTimeout(ok, 150));
      // 시작 파일(dist/main.js)은 맨 마지막에 넣는다: 중간에 꺼져도 다음 실행 때 다시 채운다.
      const ordered = [...r.changed.filter((f) => f.path !== FULL_APP_MARKER), ...r.changed.filter((f) => f.path === FULL_APP_MARKER)];
      try { applyUpdate(appDir, r.bundleDir, ordered, path.join(os.tmpdir(), 'sllm-first-install-backup')); }
      catch (e) {
        w.destroy();
        const again = await dialog.showMessageBox({ type: 'error', title: TITLE(), message: T('앱 파일을 채우지 못해 원래대로 되돌렸습니다.', 'Could not copy the app files; the folder was restored.'), detail: String((e as Error)?.message || e), buttons: [T('다시 시도', 'Try again'), T('닫기', 'Close')], defaultId: 0, cancelId: 1 });
        if (again.response === 0) continue; return;
      }
      w.destroy();
      launchFullApp();
      return;
    }
    const m = message(r);
    const res = await dialog.showMessageBox({ type: r.kind === 'bad_signature' || r.kind === 'needs_installer' ? 'warning' : 'info', title: TITLE(), message: m.text, detail: m.detail,
      buttons: [T('다시 확인', 'Check again'), T('창작마당 페이지 열기', 'Open Workshop page'), T('닫기', 'Close')], defaultId: 0, cancelId: 2 });
    if (res.response === 1) { void shell.openExternal(`steam://url/CommunityFilePage/${CONNECTION_WORKSHOP_ID}`); continue; }
    if (res.response !== 0) return;
  }
}

// 이 도우미는 사용자 데이터 폴더를 쓰지 않는다(Electron 기본 폴더가 생기지 않게 임시 폴더로).
app.setPath('userData', path.join(os.tmpdir(), 'sllm-first-install'));
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(run).catch(async (e) => {
  try { await dialog.showMessageBox({ type: 'error', title: TITLE(), message: String((e as Error)?.message || e), buttons: ['OK'] }); } catch { /* no UI */ }
}).finally(() => app.quit());
app.on('window-all-closed', () => { /* run() decides when to quit */ });
