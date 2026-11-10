// 게임 감시기(2026-10-30 사용자 결정): 설정에서 켜면, 스텔라리스가 켜질 때 SLLM 도 자동으로 켠다.
// - 앱 전체를 상주시키지 않고, 작은 PowerShell 스크립트만 Windows 시작 프로그램(HKCU Run)에 등록한다.
// - 스크립트는 5초마다 stellaris 프로세스만 본다. 게임이 새로 켜졌을 때 SLLM 이 꺼져 있으면 start_app.bat 을 한 번 실행한다.
//   게임 도중 사용자가 SLLM 을 닫으면 다시 켜지 않는다(다음 게임 실행 때만 다시 켠다).
// - 켜짐 표시 파일(game-watcher.on)이 사라지면 스크립트가 스스로 끝난다. 끄기 = 표시 파일 지우기 + 등록 지우기.
// - 같은 스크립트가 두 개 돌지 않게 이름 붙은 뮤텍스를 쓴다. Windows 가 아니면 아무것도 하지 않는다.
// 설치기 제거(Uninstall)도 같은 이름의 Run 값을 지운다(installer/setup.nsi).
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const WATCHER_RUN_NAME = 'SLLM Game Watcher';
export const WATCHER_SCRIPT = 'game-watcher.ps1';
export const WATCHER_FLAG = 'game-watcher.on';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

/** PowerShell 작은따옴표 문자열 안에 넣을 수 있게 ' 를 '' 로. */
export const psQuote = (s: string): string => "'" + String(s).replace(/'/g, "''") + "'";

/** 감시 스크립트 본문. appDir 에 start_app.bat 이 있어야 한다. 한글 경로 때문에 저장할 때 UTF-8 BOM 을 붙인다. */
export function watcherScript(appDir: string, flagFile: string): string {
  return [
    '# SLLM game watcher - written by the SLLM app (Settings > Game link). Turn it off there.',
    "$ErrorActionPreference = 'SilentlyContinue'",
    '$flag = ' + psQuote(flagFile),
    '$appDir = ' + psQuote(appDir),
    "$bat = Join-Path $appDir 'start_app.bat'",
    "$mutex = New-Object System.Threading.Mutex($false, 'Local\\SLLM_GameWatcher')",
    'if (-not $mutex.WaitOne(0)) { exit }',
    '$prefix = $appDir.TrimEnd([char]92) + [char]92',
    '$was = $false',
    'while (Test-Path -LiteralPath $flag) {',
    "  $game = Get-Process -Name 'stellaris' -ErrorAction SilentlyContinue",
    '  if ($game) {',
    '    if (-not $was) {',
    '      $was = $true',
    '      Start-Sleep -Seconds 5',
    '      $running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) }',
    '      if (-not $running -and (Test-Path -LiteralPath $bat) -and (Test-Path -LiteralPath $flag)) {',
    "        Start-Process -FilePath $env:ComSpec -ArgumentList '/c', ('\"' + $bat + '\"') -WorkingDirectory $appDir -WindowStyle Hidden",
    '      }',
    '    }',
    '  } else { $was = $false }',
    '  Start-Sleep -Seconds 5',
    '}',
    '',
  ].join('\r\n');
}

export const powershellExe = (): string => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
/** 시작 프로그램에 적는 명령(창 없이 스크립트만 실행). */
export const watcherArgs = (scriptFile: string): string[] => ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptFile];
export const runCommand = (scriptFile: string): string => '"' + powershellExe() + '" ' + watcherArgs(scriptFile).map((a) => (/\s/.test(a) ? '"' + a + '"' : a)).join(' ');

const reg = (args: string[]): Promise<boolean> => new Promise((res) => {
  try { execFile('reg.exe', args, { windowsHide: true }, (err) => res(!err)); } catch { res(false); }
});

export interface WatcherPaths { dataDir: string; appDir: string; }
const files = (p: WatcherPaths) => ({ script: path.join(p.dataDir, WATCHER_SCRIPT), flag: path.join(p.dataDir, WATCHER_FLAG) });

/** 켜기: 스크립트·표시 파일을 쓰고, 시작 프로그램에 등록하고, 지금 바로 한 번 띄운다(재부팅 없이 동작). */
export async function enableWatcher(p: WatcherPaths): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'win32') return { ok: false, error: 'windows-only' };
  const f = files(p);
  try {
    fs.mkdirSync(p.dataDir, { recursive: true });
    fs.writeFileSync(f.script, '\uFEFF' + watcherScript(p.appDir, f.flag), 'utf8');
    fs.writeFileSync(f.flag, 'on\n', 'utf8');
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  const ok = await reg(['add', RUN_KEY, '/v', WATCHER_RUN_NAME, '/t', 'REG_SZ', '/d', runCommand(f.script), '/f']);
  try { spawn(powershellExe(), watcherArgs(f.script), { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch { /* 다음 로그인 때 시작 */ }
  return ok ? { ok } : { ok, error: 'registry' };
}

/** 끄기: 표시 파일을 지워 돌고 있는 스크립트를 끝내고(5초 안), 스크립트와 시작 프로그램 등록을 지운다. */
export async function disableWatcher(p: WatcherPaths): Promise<void> {
  if (process.platform !== 'win32') return;
  for (const f of [files(p).flag, files(p).script]) { try { fs.rmSync(f, { force: true }); } catch { /* 없음 */ } }
  await reg(['delete', RUN_KEY, '/v', WATCHER_RUN_NAME, '/f']);
}

/** 앱 시작 때 설정과 맞춘다. 켜져 있으면 스크립트를 새로 쓴다(앱을 다시 설치해 폴더가 바뀐 경우 대비). 꺼져 있으면 남은 것만 치운다. */
export async function syncWatcher(on: boolean, p: WatcherPaths): Promise<void> {
  if (process.platform !== 'win32') return;
  if (on) { await enableWatcher(p); return; }
  if (fs.existsSync(files(p).flag) || fs.existsSync(files(p).script)) await disableWatcher(p);
}
