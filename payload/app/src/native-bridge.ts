import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { runtimeUserDir, gameCandidates } from './environment-paths';
import { logDiagnostic } from './diagnostics';
import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

interface Delivery { state: number; result: number; gameStatus: number; exitCode: number }
export type DeliveryOutcome = { kind: 'ok' | 'fail' | 'uncertain'; message: string; safeToRemove: boolean };
/**
 * bridge-client.exe 의 결과를 해석한다(F-12). exit 2~7 은 JSON 을 찍기 전에 끝나므로 요청이 게임에 닿지 않은 것이 확실하다.
 * state: 1 READY(전달 전) 2 RUNNING(처리 중) 3 COMPLETE 4 CANCELLED. result: 0 OK 1 대상 다름 2 지원 안 되는 빌드 3 파일 오류 4 명령 실패.
 * 'uncertain' 일 때만 요청 파일을 남긴다(게임이 나중에 읽을 수 있으므로 자동 재시도하지 않는다).
 */
export function classifyDelivery(exitCode: number | string | null | undefined, delivery: Delivery | undefined, killed = false): DeliveryOutcome {
  const fail = (message: string): DeliveryOutcome => ({ kind: 'fail', message, safeToRemove: true });
  if (delivery) {
    if (delivery.state === 3) {
      if (delivery.result === 0 && delivery.gameStatus === 1) return { kind: 'ok', message: '', safeToRemove: true }; // exit 11(훅 해제 실패)이어도 명령은 실행됐다
      if (delivery.result === 2) return fail(L('현재 게임 버전은 DLL 연결이 지원하지 않습니다. 앱이 새 연결 파일을 갖고 있으면 게임을 끌 때 자동으로 바꿉니다. 게임을 껐다 켜도 같으면 앱 업데이트를 기다려 주세요.', 'This game version is not supported by the DLL connection. If the app has a newer connection file it swaps it in when you close the game. If it still fails after restarting the game, please wait for an app update.'));
      if (delivery.result === 1) return fail('연결 대상 게임 창이 바뀌어 요청을 실행하지 않았습니다. 다시 시도해 주세요.');
      if (delivery.result === 3) return fail('게임이 요청 파일을 읽지 못했습니다. 게임 사용자 폴더 경로를 확인해 주세요.');
      if (delivery.result === 0 && delivery.gameStatus !== 1) return { kind: 'uncertain', message: L('게임이 요청을 받았지만 실행 결과를 알려 주지 않았습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'The game received the request but did not report the result. It was not retried automatically, so please check the result in the game.'), safeToRemove: true };
      return fail('게임이 명령을 실행하지 못했습니다(결과 코드 ' + delivery.result + ').');
    }
    if (delivery.state === 1) return fail('연결 DLL을 불러오거나 게임 창에 연결하지 못했습니다. 게임 실행 상태와 연결 파일을 확인해 주세요.');
    if (delivery.state === 4) return fail('게임이 10초 안에 요청을 받지 않아 취소했습니다(로딩 중이거나 창이 멈춰 있을 수 있습니다). 게임에는 아무것도 적용되지 않았습니다.');
    return { kind: 'uncertain', message: L('게임 요청의 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'Could not confirm the game request finished. It was not retried automatically, so please check the result in the game.'), safeToRemove: false };
  }
  if (killed) return { kind: 'uncertain', message: L('연결 프로그램이 시간 안에 끝나지 않았습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'The bridge program did not finish in time. It was not retried automatically, so please check the result in the game.'), safeToRemove: false };
  switch (Number(exitCode)) {
    case 4: return fail('실행 중인 스텔라리스 창을 찾지 못했습니다. 게임이 꺼져 있거나 두 개 이상 실행 중입니다.');
    case 2: case 3: return fail('게임 요청 형식이 올바르지 않습니다(내부 오류 ' + exitCode + ').');
    case 5: case 6: case 7: return fail('게임 연결을 준비하지 못했습니다(코드 ' + exitCode + '). 잠시 뒤 다시 시도해 주세요.');
  }
  if (exitCode === 'ENOENT' || exitCode === 'EACCES') return fail('게임 연결 프로그램을 실행하지 못했습니다(' + exitCode + '). 앱의 native 폴더와 백신 차단 여부를 확인해 주세요.');
  return { kind: 'uncertain', message: L('게임 요청의 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'Could not confirm the game request finished. It was not retried automatically, so please check the result in the game.'), safeToRemove: false };
}
/** 2026-10-18 트러블슈팅: 스텔라리스만 관리자 권한이면 윈도우(UIPI/무결성 수준)가 일반 권한 SLLM 의 DLL 연결을 막는다(state 1).
 * 연결 실패 때만 게임 프로세스 토큰을 확인해 이 경우를 따로 안내한다. 둘 다 같은 권한이면 정상. */
export const ELEVATION_MISMATCH_MESSAGE = '스텔라리스가 관리자 권한으로 실행 중이라 SLLM이 게임에 연결하지 못했습니다. 윈도우는 일반 권한 프로그램이 관리자 권한 프로그램에 접근하지 못하게 막습니다. 스텔라리스와 SLLM을 둘 다 일반 권한으로(권장) 또는 둘 다 관리자 권한으로 다시 실행해 주세요. 게임 실행 파일·스팀의 「관리자 권한으로 이 프로그램 실행」 설정도 확인해 주세요.';
const PS_ELEVATION = `$ErrorActionPreference='SilentlyContinue'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class SllmElev {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a, bool i, int pid);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr h, uint a, out IntPtr t);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr t, int c, out int v, int l, out int r);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  public static string Check(int pid) {
    IntPtr h = OpenProcess(0x1000, false, pid); if (h == IntPtr.Zero) return "denied";
    IntPtr t; if (!OpenProcessToken(h, 8, out t)) { int e = Marshal.GetLastWin32Error(); CloseHandle(h); return e == 5 ? "denied" : "unknown"; }
    int v = 0, r; bool ok = GetTokenInformation(t, 20, out v, 4, out r); CloseHandle(t); CloseHandle(h);
    return ok ? (v != 0 ? "elevated" : "normal") : "unknown";
  }
}
'@
$self = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$g = @(Get-Process -Name stellaris | ForEach-Object { [SllmElev]::Check($_.Id) })
'SELF=' + $(if ($self) { '1' } else { '0' }) + ' GAME=' + $(if ($g.Count) { $g -join ',' } else { 'none' })`;
/** PS_ELEVATION 출력 해석. 'mismatch' = 게임만 관리자 권한(또는 일반 권한인 앱이 게임 토큰을 열 수 없음). */
export function parseElevation(stdout: string): 'mismatch' | 'ok' | 'unknown' {
  const m = /SELF=([01])\s+GAME=([a-z,]+)/.exec(stdout || '');
  if (!m) return 'unknown';
  const game = m[2].split(',').filter(Boolean);
  if (m[1] === '1' || !game.length || game[0] === 'none') return game[0] === 'none' ? 'unknown' : 'ok';
  if (game.some((g) => g === 'elevated' || g === 'denied')) return 'mismatch';
  return game.every((g) => g === 'normal') ? 'ok' : 'unknown';
}
/** 게임만 관리자 권한인지 확인한다(윈도우 전용, 실패하면 'unknown'). 연결 실패 때만 부른다. */
export function checkGameElevation(): Promise<'mismatch' | 'ok' | 'unknown'> {
  if (process.platform !== 'win32') return Promise.resolve('unknown');
  return new Promise((resolve) => {
    try {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(PS_ELEVATION, 'utf16le').toString('base64')],
        { windowsHide: true, timeout: 15000, maxBuffer: 64 * 1024, encoding: 'utf8' }, (_e, stdout) => resolve(parseElevation(String(stdout || ''))));
    } catch { resolve('unknown'); }
  });
}
let pending: Promise<void> = Promise.resolve();

function nativeDirectory(): string {
  const local = path.join(__dirname, '..', 'native');
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [resources ? path.join(resources, 'native') : '', local];
  const found = candidates.find(p => p && fs.existsSync(path.join(p, 'bridge-client.exe')) && fs.existsSync(path.join(p, 'command-bridge.dll')));
  if (!found) throw new Error(L('게임 연결 파일이 없습니다. 앱의 native 폴더를 확인해 주세요.', 'The game bridge file is missing. Check the app\'s native folder.'));
  return found;
}

/** 설치기가 남긴 game-install-path.txt(UTF-16LE) 의 게임 폴더. 비었거나 읽을 수 없으면 ''. */
export function readGamePathFile(file: string): string {
  try { return fs.readFileSync(file).toString('utf16le').replace(/^\uFEFF/, '').replace(/\0/g, '').trim(); } catch { return ''; }
}
/** 게임 DLL 위치를 정한다(2026-10-17 트러블슈팅: game-install-path.txt 가 0바이트인 설치에서 DLL 이 게임 폴더에 있는데도 실패).
 * 순서: 설치기가 적은 게임 폴더 → 자동으로 찾은 게임 폴더들. 설치 기록 파일이 아예 없으면(개발 폴더) 앱 native 의 DLL.
 * 못 찾으면 확인한 경로를 오류에 적는다. */
export function bridgeDllCandidates(gamePathFile: string, detected: string[]): { fromFile: string; candidates: string[] } {
  const fromFile = readGamePathFile(gamePathFile);
  const candidates = [...new Set([fromFile, ...detected].filter(Boolean).map((d) => path.join(d, 'sllm-tester-command-bridge.dll')))];
  return { fromFile, candidates };
}
function findBridgeDll(native: string): string {
  const gamePathFile = path.join(__dirname, '..', 'game-install-path.txt');
  if (!fs.existsSync(gamePathFile)) { const next = path.join(native, 'bridge', 'command-bridge.dll'); return fs.existsSync(next) ? next : path.join(native, 'command-bridge.dll'); } // 개발 폴더: 새 위치(native/bridge, 2026-11-04 게임 4.5.3) 먼저
  const { fromFile, candidates } = bridgeDllCandidates(gamePathFile, gameCandidates());
  const hit = candidates.find((p) => fs.existsSync(p));
  if (hit) { if (!fromFile || path.dirname(hit) !== path.normalize(fromFile)) logDiagnostic('warn', 'bridge.dll_fallback', { fromFile, used: hit }); return hit; }
  logDiagnostic('error', 'bridge.dll_missing', { fromFile, checked: candidates });
  throw new Error(L('게임 연결 DLL을 찾지 못했습니다. 확인한 위치: ', 'Could not find the game bridge DLL. Checked: ') + (candidates.join(' / ') || L('(게임 폴더를 모름)', '(game folder unknown)')) + L('. 설치 프로그램을 다시 실행해 게임 폴더를 지정해 주세요.', '. Run the installer again and choose the game folder.'));
}

async function deliver(cmd: string): Promise<void> {
  if (!cmd.trim() || cmd.includes('\0') || Buffer.byteLength(cmd, 'utf8') > 1024 * 1024) {
    throw new Error(L('게임 요청이 비어 있거나 너무 큽니다.', 'The game request is empty or too large.'));
  }
  const native = nativeDirectory();
  const bridgeDll = findBridgeDll(native);
  const filename = 'sx' + randomBytes(4).toString('hex') + '.ini';
  const requestPath = path.join(runtimeUserDir(), filename);
  await fs.promises.writeFile(requestPath, cmd.trim() + '\n', { encoding: 'utf8', flag: 'wx' });
  let safeToRemove = false;
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(path.join(native, 'bridge-client.exe'), [bridgeDll, filename],
        { windowsHide: true, timeout: 20000, maxBuffer: 64 * 1024, encoding: 'utf8' }, (error, stdout) => {
          let delivery: Delivery | undefined;
          try { delivery = JSON.parse(stdout.trim()); } catch { /* Failure before native delivery. */ }
          const e = error as (Error & { code?: number | string | null; killed?: boolean }) | null;
          const out = classifyDelivery(e ? e.code : 0, delivery, !!e?.killed);
          safeToRemove = out.safeToRemove;
          if (out.kind === 'ok') { resolve(); return; }
          if (delivery?.state !== 1) { reject(new Error(out.message)); return; }
          // DLL 을 붙이지 못함: 관리자 권한 차이인지 확인해 맞으면 그 안내로 바꾼다.
          checkGameElevation().then((r) => {
            if (r === 'mismatch') { logDiagnostic('warn', 'bridge.elevation_mismatch', {}); reject(new Error(ELEVATION_MISMATCH_MESSAGE)); }
            else reject(new Error(out.message));
          }, () => reject(new Error(out.message)));
        });
    });
  } finally {
    // An uncertain in-flight request stays available for the game; never retry it here.
    if (safeToRemove) await fs.promises.unlink(requestPath).catch((error) => { logDiagnostic('warn', 'bridge.request_cleanup_failed', { file: path.basename(requestPath), error }); }); // 남은 sx*.ini 가 쌓이면 원인을 찾을 수 있게(F-33 B)
  }
}

/** Serializes requests without clipboard, focus changes, console keys, or automatic retry. */
export function runNativeCommand(cmd: string): Promise<void> {
  const next = pending.then(() => deliver(cmd));
  pending = next.catch(() => undefined);
  return next;
}


