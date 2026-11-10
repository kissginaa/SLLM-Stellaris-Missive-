// A-00b 3번: 게임으로 명령 보내기(콘솔/DLL 연결 큐, '게임에 입력 중' 표시, 요청 번호, ACK 대기).
// 2026-10-15 main.ts 84~156·303~304·434~435줄에서 옮김(동작 변경 없음). 여러 곳에서 바꾸는 값은 link 객체에 둔다.
import { app, BrowserWindow, clipboard, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logDiagnostic, sanitizeDiagnosticText } from '../diagnostics';
import { runConsoleCommand, inputHook } from '../keyboard';
import { outcomeOf, Outcome } from '../action';
import { reqSeenIn, SllmMessage, MOD_PROTOCOL } from '../protocol';
import { ctx } from './ctx';
import { LogRouter, SLOT } from './log-router';
import { SessionCommandQueue } from '../session-queue';
import { energyNeed, energyCheckCommand } from '../energy-guard';
import { L } from '../i18n-pick';
import { usage } from '../usage-meter'; // 한 달 사용량(콘솔 명령 수, 2026-11-09)

export const CONNECTION_PROTOCOL = MOD_PROTOCOL; // 연결 규격은 protocol.ts 의 MOD_PROTOCOL 한 곳에서만 정한다(2026-10-17, 4→5 때 두 상수가 어긋났던 사고).
export type RuntimeMod = { version: string; protocol: number; verified: boolean };
export const link = {
  /** 줄 서 있거나 실행 중인 콘솔 작업 수 */
  queued: 0,
  /** 게임 로그의 req/last 보다 항상 커야 한다(작으면 게임이 stale 로 거부) */
  reqCounter: 0,
  /** HELLO 로 알게 된 연결 모드 정보 */
  runtimeMod: null as RuntimeMod | null,
  /** 게임 프로그램이 켜져 있는가(창 감시가 알려 줌). null = 앱이 켜진 뒤 아직 모름 */
  processRunning: null as boolean | null,
  /** 마지막으로 모드 줄을 받은 때(ms) */
  lastModLineAt: 0,
  /** 이번 게임 실행에서 모드 줄(SLLM:…)을 한 번이라도 받았는가 = 세이브를 불러와 게임 안에 들어가 있음.
   *  2026-10-15 21:22 튕김: 게임이 세이브를 불러오는 중(메인 메뉴·로딩)에 총독 창이 행성 목록 명령을 보냈고, 연결 DLL 이 그때 콘솔을 열다 게임이 접근 위반으로 꺼졌다.
   *  그래서 이 값이 거짓이면 어떤 명령도 보내지 않는다. 게임이 꺼지면(또는 다시 켜지면) 거짓으로 돌아간다. */
  sessionReady: false,
  epoch: 0,
};
/** 창 감시가 게임 실행 여부를 알려 준다. 꺼짐 → 켜짐이면 새 실행이라 세션 준비를 다시 기다린다. */
export function noteGameProcess(running: boolean): void {
  const before = link.processRunning;
  if (running === before) return;
  link.epoch++;
  // 앱이 켜질 때 게임이 이미 실행 중이면(null → 켜짐) 지금 game.log 의 줄은 이번 실행의 것(게임은 켤 때 로그를 비운다) → 받은 줄이 있으면 준비됨
  link.sessionReady = running && before === null && link.lastModLineAt > 0;
  link.processRunning = running;
  logDiagnostic('info', 'game.process', { running, ready: link.sessionReady });
}
export const NOT_IN_SESSION = '게임이 아직 세이브를 불러오지 않았습니다(메인 메뉴·불러오는 중). 게임 안에 들어간 뒤 한 달쯤 지나고 다시 시도해 주세요. (불러오는 중에 명령을 넣으면 게임이 꺼질 수 있어 막았습니다)';
export const waiters = new Map<number, (o: Outcome) => void>(); // 요청 번호 → ACK 대기
// 콘솔로 보내는 명령은 키 입력이 겹치면 안 되므로 한 번에 하나씩 순서대로 처리한다.
const queue = new SessionCommandQueue(() => ({ epoch: link.epoch, sid: ctx.curSaveId }));
// ---- '게임에 입력 중' 표시: 키보드·마우스를 만지면 명령이 어긋나므로, 입력하는 동안 화면 위에 눈에 띄게 알린다.
let busyWin: BrowserWindow | null = null, busyDepth = 0, busyHideTimer: ReturnType<typeof setTimeout> | null = null;
let busyMsg = '';
export function busyText(): string { return busyMsg || `게임에 요청을 전달하는 중입니다${link.queued > 1 ? ` (대기 ${link.queued - 1}건)` : ''}`; }
/** 입력이 끝난 뒤에도 기다리는 작업(게임이 답을 로그로 쓰는 시간)을 위해 표시를 붙잡아 둔다. 돌려받은 함수를 부르면 놓는다. */
export function holdBusy(msg: string): () => void { busyMsg = msg; inputHook.start?.(); return () => { busyMsg = ''; inputHook.end?.(); }; }
export function setBusyMsg(t: string) { busyMsg = t; if (busyDepth > 0) showBusy(); }
export function showBusy() {
  if (busyHideTimer) { clearTimeout(busyHideTimer); busyHideTimer = null; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, w = 560, h = 44;
  const b = { x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + 14), width: w, height: h };
  if (!busyWin || busyWin.isDestroyed()) {
    busyWin = new BrowserWindow({ ...b, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true, show: false });
    busyWin.setIgnoreMouseEvents(true);
    busyWin.setAlwaysOnTop(true, 'screen-saver', 3);
    busyWin.on('closed', () => { busyWin = null; });
    void busyWin.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#t{box-sizing:border-box;height:100%;display:flex;align-items:center;justify-content:center;gap:12px;background:#06141bf2;border:1px solid #e8c872;color:#f3e3b0;font:700 14px "Malgun Gothic",sans-serif;box-shadow:0 0 18px #000a}i{width:16px;height:16px;border:3px solid #e8c87255;border-top-color:#e8c872;border-radius:50%;animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style><div id="t"><i></i><span id="m"></span></div>',
        ),
    );
  }
  const bw = busyWin; bw.setBounds(b);
  const apply = () => { bw.webContents.executeJavaScript(`document.getElementById('m').textContent=${JSON.stringify(busyText())}`).then(() => { if (!bw.isDestroyed() && busyDepth > 0) bw.showInactive(); }).catch(() => {}); };
  if (bw.webContents.isLoading()) bw.webContents.once('did-finish-load', apply); else apply();
}
inputHook.start = () => { busyDepth++; showBusy(); };
inputHook.end = () => {
  busyDepth = Math.max(0, busyDepth - 1);
  if (busyDepth === 0 && !busyHideTimer)
    busyHideTimer = setTimeout(() => {
      busyHideTimer = null;
      if (busyDepth === 0 && link.queued <= 0 && busyWin && !busyWin.isDestroyed()) busyWin.hide();
      else if (busyDepth === 0 && link.queued > 0)
        busyHideTimer = setTimeout(() => {
          busyHideTimer = null;
          if (busyDepth === 0 && busyWin && !busyWin.isDestroyed()) busyWin.hide();
        }, 1500);
    }, 600);
};
export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  link.queued++;
  const r = queue.run(fn);
  const release = () => { link.queued = Math.max(0, link.queued - 1); };
  void r.then(release, release);
  return r;
}
// 명령을 보내고 같은 요청 번호의 ACK 를 기다린다.
export function expectAck(req: number): Promise<Outcome | 'timeout'> {
  return new Promise<Outcome | 'timeout'>((resolve) => {
    waiters.set(req, resolve);
    setTimeout(() => { if (waiters.delete(req)) {logDiagnostic('warn','game.ack.timeout',{req,timeoutMs:8000});resolve('timeout');} }, 8000);
  });
}
/** 콘솔로 보낸 명령을 userData 의 sllm_console.log 에 남긴다(마지막 60줄). 게임이 ACK 를 안 줄 때 원인을 보려는 기록. */
export function consoleLog(line: string): void {
  logDiagnostic(/ 실패|timeout|fail/i.test(line)?'warn':'info','game.console.trace',{message:line});
  line=sanitizeDiagnosticText(line);
  try {
    const f = path.join(app.getPath('userData'), 'sllm_console.log');
    let old: string[] = []; try { old = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); } catch { /* 처음 */ }
    old.push(`${new Date().toISOString()} [${ctx.gameDate || '?'}] ${line}`.slice(0, 400));
    fs.writeFileSync(f, old.slice(-60).join('\n') + '\n', 'utf8');
  } catch (error) { logDiagnostic('warn', 'storage.write_failed', { store: 'console_log', error }); } // 같은 줄은 위에서 진단 기록에도 남았으니 앱은 그대로 진행(F-33 B)
}
// 에너지 지불 확인(2026-11-08 사용자: 「에너지 크레딧이 없을 땐 소비 안 되게 — 지불하는 모든 행위가 인식」): 플레이어 국고에서 에너지가 빠지는 명령은
// 보내기 전에 국고를 묻고(ENCHK), 모자라면 보내지 않고 오류를 던진다. 판정 규칙은 src/energy-guard.ts.
const enWaiters = new Map<number, (ok: boolean) => void>();
async function energyOk(need: number): Promise<boolean | null> {
  const req = ++link.reqCounter;
  const r = new Promise<boolean | null>((resolve) => { enWaiters.set(req, resolve); setTimeout(() => { if (enWaiters.delete(req)) { logDiagnostic('warn', 'game.energy_check.timeout', { req, need }); resolve(null); } }, 8000); });
  try { const c = energyCheckCommand(req, need); await runConsoleCommand(c, (t) => clipboard.writeText(t)); usage.noteConsole(c); } catch (e) { enWaiters.delete(req); throw e; }
  return r;
}
export async function sendConsole(cmd: string): Promise<void> {
  if (!link.sessionReady) { consoleLog('보내지 않음(게임 안에 들어가기 전) ' + cmd); throw new Error(NOT_IN_SESSION); }
  if (link.runtimeMod && link.runtimeMod.protocol !== CONNECTION_PROTOCOL && !cmd.includes('sllm_probe_hello')) throw new Error('앱과 연결 모드의 규격이 다릅니다. 양쪽을 함께 업데이트해 주세요.');
  const need = energyNeed(cmd);
  if (need > 0) {
    const ok = await energyOk(need);
    if (ok !== true) {
      consoleLog(`보내지 않음(에너지 ${ok === false ? '부족' : '확인 실패'} ${need}) ` + cmd);
      throw new Error(ok === false ? L(`에너지 크레딧이 모자랍니다(필요 ${need}). 국고를 채운 뒤 다시 해 주세요.`, `Not enough energy credits (${need} needed). Refill the treasury and try again.`) : L('게임에서 국고를 확인하지 못해 에너지를 쓰지 않았습니다. 잠시 뒤 다시 해 주세요.', 'Could not check the treasury in the game, so no energy was spent. Try again shortly.'));
    }
  }
  try { await runConsoleCommand(cmd, (t) => clipboard.writeText(t)); usage.noteConsole(cmd); consoleLog('보냄 ' + cmd); }
  catch (e) { consoleLog('보내기 실패(' + (e as Error).message + ') ' + cmd); throw e; }
}
export async function sendAndWait(build: (req: number) => string): Promise<Outcome | 'timeout'> {
  link.reqCounter += 1;
  const req = link.reqCounter;
  const done = expectAck(req);
  await sendConsole(build(req));
  const r = await done; consoleLog('응답 req=' + req + ' ' + r);
  return r;
}
// 요청 번호 n 개를 받아 한 번의 콘솔 입력으로 보내고, 모든 ACK 를 기다린다.
export async function sendBatch(n: number, build: (reqs: number[]) => string): Promise<Outcome | 'timeout'> {
  const reqs = Array.from({ length: n }, () => ++link.reqCounter);
  const dones = reqs.map(expectAck);
  await sendConsole(build(reqs));
  const rs = await Promise.all(dones); consoleLog('응답 req=' + reqs.join(',') + ' ' + rs.join(','));
  return rs.find((r) => r !== 'ok') ?? 'ok';
}

/** 로그 분배기에 요청 번호 학습(REQSEEN)과 ACK 처리(ACK)를 건다. 원래 main.ts watcher 안의 같은 자리였다. */
export function registerGameLink(router: LogRouter): void {
  router.on(SLOT.REQSEEN, 'game-link:reqSeen', (m: SllmMessage) => {
    link.reqCounter = Math.max(link.reqCounter, reqSeenIn(m));
    link.lastModLineAt = Date.now();
    if (link.processRunning !== false && !link.sessionReady) { link.sessionReady = true; logDiagnostic('info', 'game.session_ready', { kind: m.kind }); } // 게임이 켜진 뒤 받은 모드 줄 = 게임 안
  });
  router.on(SLOT.ACK, 'game-link:ack', (m: SllmMessage) => {
    if (m.kind === 'ENCHK') { const req = Number(String(m.kv.req ?? '').replace(/^\\/, '')), w = enWaiters.get(req); if (w) { enWaiters.delete(req); w(String(m.kv.ok ?? '').replace(/^\\/, '') === '1'); } return; } // 국고 확인 회신
    if (m.kind === 'ACK') {
      const w = waiters.get(Number(m.kv.req));
      if (w) { waiters.delete(Number(m.kv.req)); w(outcomeOf(m.fields, m.kv)); }
    }
  });
}
