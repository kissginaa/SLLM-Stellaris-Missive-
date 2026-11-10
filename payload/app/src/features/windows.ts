// A-00b 7번: 창 관리(앱 쪽) — 메인 창·구석 아이콘(런처)·이름표·설정 창·알림 카드·트레이·단축키·자동 흐려짐·항상 위,
// 게임 창 따라가기(GameWindowWatcher), 일시정지 안내(게이트), 화면으로 보내기(toUi), 앱 종료(quitAll)와 그 IPC 17개.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 다른 모듈은 이 상태를 ctx.win·ctx.launcher·ctx.appOpen 등으로 본다.
// 기능 모듈(의회·연설·라디오·총독·신문·서신·대화)을 부르므로 app/ 대신 features/ 에 둠(app/* 는 features 를 가져오지 않음).
import { openPendingFactionMeeting } from './faction-app';
import { openPendingMediation } from './mediation-app';
import { app, BrowserWindow, ipcMain, Notification, screen, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { enableWatcher, disableWatcher } from '../game-watcher'; // 게임을 켜면 SLLM 자동 실행(2026-10-30)
import { settings, saveSettings, clampTurns, clampSlots, clampTeamTurns, devVoteMode, devVotePercent } from '../app/settings';
import { safeSend } from '../safe-send';
import { ToastMsg, ctx } from '../app/ctx';
import { GameWindowWatcher, GameWin, dockRect, launcherRect, layoutScale, fitSize, toFrac, focusGame, Frac, DockMode, Rect } from '../gameWindow';
import { readDisplayMode, DISPLAY_HINT_KO } from '../game-display';
import { runtimeUserDir } from '../environment-paths';
import { sanitizeHotkey, clampFade, pointInRect, fadeTarget, stepOpacity } from '../overlayPrefs';
import { sanitizeTheme, sanitizeCustom } from '../theme';
import { clampSpeechTurns } from '../speech';
import { PAPERS } from '../galnews';
import { effectivePaper } from '../media-custom';
import { uiText, pick } from './settings-ui';
import { council, openCouncilLive, closeCouncil, joinLabel } from './council';
import { speechReady, openSpeech, speech } from './speech-app';
import { pressReady, openPress, press } from './press-app';
import { openVassal, closeVassal, vassal } from './vassal-app';
import { openFleet, closeFleet, fleet } from './fleet-app';
import { openOffice, closeOffice, office, setTerminalHook, terminalDocked, pushOffice } from './office-app';
import { openDeclare } from './declare-app'; // 전쟁 선언문 알림(2026-10-20)
import { playDebate } from './debate-app'; // 라디오 찬반 논평 알림(2026-10-20)
import { openScandal } from './scandal-app'; // 비방 공작 추문 대응(2026-10-20)
import { showHearing } from './espionage-app'; // 실제 게임 사건 청문회(2026-10-20)
import { openForeignStatement } from './condemn-app'; // 남의 전쟁에 우리 성명(2026-10-20)
import { glassWin } from '../office';
import { radio, setRadio, placeRadio } from './radio-app';
import { gov, openGov, closeGov } from './gov';
import { openPaper, media } from './media';
import { openGovReport, govReport } from './govreport';
import { mail, restartAiTimer } from './mail-app';
import { flushMoods } from './chat';
import { banquet } from './banquet-app';
import { mediation } from './mediation-app';
import { summit } from './summit';
import { noteGameProcess } from '../app/game-link';

/** 창 상태(main.ts의 let 변수들을 모았다). 다른 모듈은 ctx 로 본다 */
export const wins = {
  /** 메인 창(통신 단말기) */
  win: null as BrowserWindow | null,
  /** 구석의 아이콘 창(런처) */
  launcher: null as BrowserWindow | null,
  /** 설정 전용 창 */
  setWin: null as BrowserWindow | null,
  /** 사용자가 메인 창을 열어 둔 상태 */
  appOpen: false,
  gameRunning: false,
  gameHwnd: 0 as number, // 게임 창 손잡이(창을 닫을 때 게임을 다시 앞으로 보내는 데 쓴다)
  gameFront: false,
  /** 게임 창 영역(화면 좌표, DIP). 게임이 꺼져 있으면 null */
  gameDip: null as Rect | null,
  /** 창 크기 배율 */
  curScale: 1,
};

export function toUi(channel: string, payload: unknown) {
  if(['status','mailstatus','event'].includes(channel)&&typeof payload==='string')logDiagnostic('info','ui.notice',{channel,message:payload});
  if (typeof payload === 'string' && ['status','mailstatus','event'].includes(channel)) payload = uiText(payload);
  if (channel === 'talk' && payload && typeof payload === 'object') {
    const fu = ctx.flagUrlFor((payload as { idx?: unknown }).idx);
    if (fu) payload = { ...(payload as object), flagUrl: fu };
  }
  if (channel === 'talk' || channel === 'kbchat' || channel === 'mail' || channel === 'mood' || channel === 'event') bumpFade();
  safeSend(wins.win, channel, payload);
  // 설정 창(같은 index.html, mode=settings)도 상태 문구·환경 확인·그림 목록을 받는다. API 키 저장 실패 등이 숨은 메인 창으로만 가던 문제(2026-10-18).
  if ((channel === 'status' || channel === 'environment' || channel === 'images') && wins.setWin && !wins.setWin.isDestroyed()) safeSend(wins.setWin, channel, payload);
  if ((channel === 'images' || channel === 'planets') && gov.win && !gov.win.isDestroyed()) safeSend(gov.win, channel, payload);
}

export function createWindow() {
  wins.win = new BrowserWindow({
    width: 480,
    height: 660,
    minWidth: 440,
    minHeight: 520,
    frame: false, // 테두리 없이 게임풍으로(제목 줄은 화면 안에 직접 그린다)
    show: false, // 집무실 바탕화면의 「외교 단말기」 아이콘(또는 알림·트레이·단축키)으로 연다
    ...glassWin(true), // 투명 창: 따로 뜰 때는 body 가 불투명하게 칠해져 그대로이고, 집무실에 붙으면 유리처럼 비친다
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
  });
  wins.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'index.html'));
  createLauncher();
  wins.win.webContents.on('did-finish-load', () => applyScale(true));
  wins.launcher?.webContents.on('did-finish-load', () => applyScale(true));
  keepOnTop();
  follow();
  setTerminalHook({
    win: () => (wins.win && !wins.win.isDestroyed() ? wins.win : null),
    open: () => { if (!wins.appOpen) safeSend(wins.win, 'pane', 'contacts'); setAppOpen(true); },
    close: () => setAppOpen(false),
    unread: () => mail.inbox.filter((l) => !l.read).length,
    back: () => { if (wins.gameRunning && wins.gameHwnd) focusGame(wins.gameHwnd); },
    restore: () => { if (wins.win && !wins.win.isDestroyed()) { wins.win.setAlwaysOnTop(settings.keepOnTop, 'screen-saver', 1); wins.win.setMaximumSize(10000, 10000); } freePlaced = false; userMoveAt = 0; applyScale(true); }, // 떼면 원래 크기로, 자리는 다음 게임 창 확인 때 다시 붙는다
  });
}

// ---- OP.GG 처럼 게임 창에 붙어 다니기
// Stellaris 가 앞에 있으면 보이고, 다른 프로그램으로 가면 같이 숨는다(게임이 꺼져 있으면 구석 아이콘은 숨기고, 본 창은 트레이/단축키로 연 경우만 보인다).
// 게임 창 가장자리에 붙고, 플레이어가 끌어서 옮기면 그 자리(게임 창 기준)를 기억한다.
const gameWatcher = new GameWindowWatcher();
let lastAutoMove = 0, userMoveAt = 0, userMoveL = 0, freePlaced = false;
let overlayPreviewActive = false;
let previewDockPos: Frac | null = null, previewLauncherPos: Frac | null = null;
let previewFreePos: { x: number; y: number } | null = null;
function follow() {
  if (!wins.win) return;
  // 사용자가 창을 끌면(move 가 계속 오는 동안) 자동 정렬을 멈추고, 놓은 자리를 기억한다. 'moved' 는 이 창(프레임 없음)에서 오지 않을 때가 있어 'move' 를 쓴다.
  let saveT: ReturnType<typeof setTimeout> | null = null;
  wins.win.on('move', () => {
    if (!wins.win || Date.now() - lastAutoMove < 400 || terminalDocked()) return; // 앱이 스스로 옮긴 이동·집무실에 붙어 있는 동안은 무시
    userMoveAt = Date.now();
    if (saveT) clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (!wins.win || wins.win.isDestroyed()) return;
      const b = wins.win.getBounds();
      if (overlayPreviewActive) {
        if (!settings.dockLock) previewFreePos = { x: b.x, y: b.y };
        else if (wins.gameDip) previewDockPos = toFrac(b, wins.gameDip);
        return;
      }
      if (!settings.dockLock) settings.freePos = { x: b.x, y: b.y };
      else if (wins.gameDip && settings.dock !== 'off') settings.dockPos = toFrac(b, wins.gameDip);
      saveSettings();
    }, 400);
  });
  let saveL: ReturnType<typeof setTimeout> | null = null;
  wins.launcher?.on('move', () => {
    if (!wins.launcher || Date.now() - lastAutoMoveL < 400) return;
    userMoveL = Date.now();
    if (saveL) clearTimeout(saveL);
    saveL = setTimeout(() => {
      if (!wins.launcher || wins.launcher.isDestroyed() || !wins.gameDip) return;
      if (overlayPreviewActive) {
        previewLauncherPos = toFrac(wins.launcher.getBounds(), wins.gameDip);
        return;
      }
      settings.launcherPos = toFrac(wins.launcher.getBounds(), wins.gameDip);
      saveSettings();
    }, 400);
  });
  gameWatcher.on('state', (g0: GameWin) => {
    if (!wins.win || wins.win.isDestroyed()) return;
    // 개발자 모드 + 오버레이 강제 표시: 게임이 꺼져 있어도 주 화면을 게임 창으로 보고 아이콘/대화창을 띄운다(시험용)
    const preview = settings.devMode && settings.forceOverlay && !g0.running;
    if (overlayPreviewActive !== preview) { freePlaced = false; lastAutoMove = Date.now(); lastAutoMoveL = Date.now(); }
    overlayPreviewActive = preview;
    let g: GameWin = g0;
    if (preview) {
      const d = screen.getPrimaryDisplay(), f = d.scaleFactor || 1;
      g = { running: true, foreground: true, minimized: false, x: Math.round(d.workArea.x * f), y: Math.round(d.workArea.y * f), w: Math.round(d.workArea.width * f), h: Math.round(d.workArea.height * f), fgPid: g0.fgPid };
    }
    const appInFront = g.fgPid === process.pid || wins.win.isFocused();
    const front = g.running && !g.minimized && (g.foreground || appInFront); // 게임이 꺼져 있으면 아이콘은 숨긴다(트레이로만 연다)
    // 게임이 꺼지면 OP.GG처럼 모든 창을 숨기고 트레이(윈도우 작업 표시줄 오른쪽 아이콘)로만 연다
    if (wins.gameRunning && !g0.running && wins.appOpen && !preview) setAppOpen(false);
    if (!wins.gameRunning && g0.running) displayModeNotice(); // 게임이 막 켜졌을 때 화면 모드 확인(독점 전체화면이면 안내)
    wins.gameFront = !preview && front; wins.gameRunning = g0.running; wins.gameHwnd = g0.hwnd ?? 0; noteGameProcess(g0.running); ctx.syncPlayer2Activity(); // 미리보기는 게임 실행으로 취급하지 않는다
    const visible = settings.autoHide ? front : true;
    // 본 창은 사용자가 열어 둔 상태(appOpen)일 때만, 아이콘 창은 늘(숨김 조건만 따라)
    const wantMain = wins.appOpen && (visible || !g.running), wantIcon = visible && g.running;
    const docked = terminalDocked(); // 집무실에 붙은 단말기는 집무실 창을 따라가므로 여기서 숨기거나 옮기지 않는다
    if (!docked) { if (wantMain && !wins.win.isVisible()) { wins.win.showInactive(); raise(); } else if (!wantMain && wins.win.isVisible()) wins.win.hide(); }
    if (wins.launcher && !wins.launcher.isDestroyed()) {
      if (wantIcon && !wins.launcher.isVisible()) { wins.launcher.showInactive(); raiseIcon(); introToast(); } else if (!wantIcon && wins.launcher.isVisible()) wins.launcher.hide();
    }
    if (!g.running) { wins.gameDip = null; return; }
    if (g.minimized || g.w <= 0 || g.h <= 0) return;
    wins.gameDip = screen.screenToDipRect(null, { x: g.x, y: g.y, width: g.w, height: g.h });
    applyScale(false);
    const dockPos = preview ? previewDockPos : settings.dockPos;
    const launcherPos = preview ? previewLauncherPos : settings.launcherPos;
    const freePos = preview ? previewFreePos : settings.freePos;
    if (docked) { /* 집무실 홀로그램 자리에 있음 */ } else if (!settings.dockLock) { // 고정 해제: 자동으로 옮기지 않는다(처음 한 번만 마지막 자리로 보낸다)
      if (!freePlaced && freePos) { lastAutoMove = Date.now(); wins.win.setPosition(Math.round(freePos.x), Math.round(freePos.y)); }
      freePlaced = true;
    } else if (settings.dock !== 'off' && Date.now() - userMoveAt > 1500) {
      const [aw, ah] = wins.win.getSize();
      // 아이콘이 구석에 고정돼 있으면(끌어서 옮기지 않았으면) 대화창은 그 바로 옆에 선다
      const iconSide = launcherPos ? null : (settings.launcherCorner === 'br' || settings.launcherCorner === 'tr' ? 'right' : 'left');
      const r = dockRect(wins.gameDip!, { width: aw, height: ah }, settings.dock, dockPos, wins.curScale, iconSide);
      const b = wins.win.getBounds();
      if (Math.abs(b.x - r.x) > 1 || Math.abs(b.y - r.y) > 1) { lastAutoMove = Date.now(); wins.win.setBounds({ x: r.x, y: r.y, width: aw, height: ah }); }
    }
    if (wins.launcher && !wins.launcher.isDestroyed() && Date.now() - userMoveL > 1500) {
      const [lw, lh] = wins.launcher.getSize();
      const r = launcherRect(wins.gameDip!, { width: lw, height: lh }, settings.launcherCorner, launcherPos, wins.curScale);
      const b = wins.launcher.getBounds();
      if (Math.abs(b.x - r.x) > 1 || Math.abs(b.y - r.y) > 1) { lastAutoMoveL = Date.now(); wins.launcher.setBounds(r); }
    }
    placeRadio();
  });
  gameWatcher.on('error', (e: Error) => toUi('status', '게임 창 추적 실패: ' + e.message));
  gameWatcher.start();
}



/** 독점 전체화면 안내(앱 실행마다 한 번): 이 모드에서는 우리 창이 뜨면 게임이 내려가므로 테두리 없음으로 바꾸라고 알린다. */
let displayNoticeShown = false;
function displayModeNotice(): void {
  if (displayNoticeShown || readDisplayMode(runtimeUserDir()) !== 'exclusive') return;
  displayNoticeShown = true;
  setTimeout(() => notify({ kind: 'info', title: '게임 화면 모드 안내', body: '스텔라리스가 전체화면(독점) 모드라 앱 창이 뜨면 게임이 내려갑니다. 설정 → 게임 연동에서 테두리 없는 전체화면으로 바꿀 수 있어요.' }), 4000);
  toUi('status', DISPLAY_HINT_KO);
}
/** 앱 창을 접을 때 게임을 다시 앞으로. 우리 창이 앞에 있었을 때만 윈도우가 허락하므로 숨기기 전에 부른다. */
export function giveBackToGame(): void { if (wins.gameRunning && wins.gameHwnd && !terminalDocked()) focusGame(wins.gameHwnd); }
let toastActionKind: 'agenda' | 'speech' | 'gov' | 'faction' | 'mediation' | 'press' | 'vassal' | 'fleet' | 'office' | 'declare' | 'statement' | 'debate' | 'scandal' | 'hearing' = 'agenda'; // 알림 카드의 버튼이 연설 창을 열지, 안건 회의를 열지
// ---- 설정 전용 창: 대화 화면(본 창)과 따로 뜬다.
export function closeSettings() { if (wins.setWin && !wins.setWin.isDestroyed()) { if (wins.setWin.isFocused()) giveBackToGame(); wins.setWin.close(); } wins.setWin = null; }
export function openSettings() {
  if (wins.setWin && !wins.setWin.isDestroyed()) { wins.setWin.show(); wins.setWin.focus(); return; }
  const area = wins.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(560, Math.round(area.width * 0.5)), height: Math.min(760, Math.round(area.height * 0.86)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  wins.setWin = new BrowserWindow({ ...sz, x, y, minWidth: 420, minHeight: 420, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  wins.setWin.setAlwaysOnTop(true, 'screen-saver', 1);
  void wins.setWin.loadFile(path.join(__dirname, '..', '..', 'ui', 'index.html'), { query: { mode: 'settings' } });
  wins.setWin.once('ready-to-show', () => wins.setWin?.show());
  wins.setWin.on('closed', () => { wins.setWin = null; });
}
// ---- 구석의 아이콘 창(런처): 눌러서 본 창을 열고 닫는다. 게임이 계속 포커스를 가지도록 포커스는 받지 않는다.
let lastAutoMoveL = 0;
// 창 크기 배율: 바뀔 때만 창 크기와 화면 확대를 맞춘다(사용자가 직접 늘린 크기를 매 순간 덮어쓰지 않도록).
const BASE_MAIN = { width: 480, height: 660 };
export const BASE_ICON = { width: 46, height: 203 }; // 아이콘 줄: 손잡이, 집무실, 신문, 라디오, 설정(단말기·총독·종속국·함대는 집무실 바탕화면에서 연다)
export const iconBaseHeight = () => BASE_ICON.height;
export function applyScale(force: boolean) {
  const s = layoutScale(wins.gameDip ? wins.gameDip.height : null, settings.uiScale, settings.autoScale);
  if (!force && Math.abs(s - wins.curScale) < 0.01) return;
  wins.curScale = s;
  if (wins.win && !wins.win.isDestroyed() && !terminalDocked()) { // 집무실에 붙어 있는 동안은 홀로그램 자리 크기를 지킨다
    const sz = wins.gameDip ? fitSize({ width: BASE_MAIN.width * s, height: BASE_MAIN.height * s }, wins.gameDip) : { width: Math.round(BASE_MAIN.width * s), height: Math.round(BASE_MAIN.height * s) };
    const zoom = Math.max(0.5, sz.width / BASE_MAIN.width);
    wins.win.setMinimumSize(Math.round(440 * zoom), Math.round(520 * zoom));
    wins.win.setSize(sz.width, sz.height);
    wins.win.webContents.setZoomFactor(zoom);
  }
  if (wins.launcher && !wins.launcher.isDestroyed()) {
    wins.launcher.setSize(Math.round(BASE_ICON.width * s), Math.round(iconBaseHeight() * s));
    wins.launcher.webContents.setZoomFactor(s);
  }
}
// ---- 아이콘 이름표: 런처 창이 좁아서, 마우스를 올리면 따로 작은 창으로 이름을 보여 준다.
let tipWin: BrowserWindow | null = null;
function hideTip() { if (tipWin && !tipWin.isDestroyed()) tipWin.hide(); }
function showTip(label: string, y: number, h: number) {
  if (!wins.launcher || wins.launcher.isDestroyed()) return;
  const lb = wins.launcher.getBounds(), s = wins.curScale || 1;
  const w = Math.round((label.length * 13 + 26) * s), th = Math.round(28 * s);
  const disp = screen.getDisplayMatching(lb).workArea;
  const left = lb.x + lb.width / 2 > disp.x + disp.width / 2;
  const x = left ? lb.x - w - 4 : lb.x + lb.width + 4, yy = Math.round(lb.y + (y + h / 2) * s - th / 2);
  if (!tipWin || tipWin.isDestroyed()) {
    tipWin = new BrowserWindow({ width: w, height: th, x, y: yy, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true, show: false });
    tipWin.setIgnoreMouseEvents(true);
    tipWin.setAlwaysOnTop(true, 'screen-saver', 2);
    tipWin.on('closed', () => { tipWin = null; });
    void tipWin.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#t{box-sizing:border-box;height:100%;display:flex;align-items:center;justify-content:center;background:#06141bf0;border:1px solid #5fd4e4aa;color:#dcecf0;font:13px "Malgun Gothic",sans-serif;white-space:nowrap}</style><div id="t"></div>',
        ),
    );
  }
  const tw = tipWin;
  tw.setBounds({ x, y: yy, width: w, height: th });
  const apply = () => { tw.webContents.executeJavaScript(`document.getElementById('t').textContent=${JSON.stringify(label)};document.getElementById('t').style.fontSize='${Math.round(13 * s)}px'`).then(() => { if (!tw.isDestroyed()) tw.showInactive(); }).catch(() => {}); };
  if (tw.webContents.isLoading()) tw.webContents.once('did-finish-load', apply); else apply();
}
function createLauncher() {
  wins.launcher = new BrowserWindow({
    width: 46, height: 281, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    focusable: false, alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
  });
  wins.launcher.setAlwaysOnTop(true, 'screen-saver', 1);
  wins.launcher.loadFile(path.join(__dirname, '..', '..', 'ui', 'launcher.html'));
  // 게임이 켜져 있을 때만 아이콘을 보인다(게임 상태 추적이 보이고 숨긴다). 안내 카드는 아이콘이 처음 보일 때 한 번.
  wins.launcher.once('ready-to-show', () => { if (wins.gameRunning) { wins.launcher?.showInactive(); introToast(); } });
}
let introShown = false;
function introToast() { if (introShown) return; introShown = true; setTimeout(() => showToast({ kind: 'info', title: 'SLLM · SteLLaris Missive', body: pick('이 아이콘을 누르면 대화창이 열립니다.', 'Click this icon to open the chat window.') }, 6000), 2500); }
function raiseIcon() {
  if (!wins.launcher || wins.launcher.isDestroyed() || !wins.launcher.isVisible() || !settings.keepOnTop) return;
  wins.launcher.setAlwaysOnTop(true, 'screen-saver', 1);
  wins.launcher.moveTop();
}
// ---- 일시정지 확인: 달 신호(MONTH)가 오면 게임이 진행 중이다. 진행 중이면 대화를 막고, 사용자가 일시정지한 뒤
// [정지했습니다]를 누르면 푼다. 그 뒤 달 신호가 또 오면(게임을 다시 돌렸으면) 다시 막는다.
let runAck = false, runAckAt = 0;
let lastTickAt = 0; // 마지막으로 게임 달 신호가 온 시각(진행 중이라는 뜻). 멈춘 게임에서는 오지 않는다
export function gateBlocked(): boolean { return settings.pauseGate && wins.gameRunning && Date.now() - lastTickAt < 40000; } // 지금은 대화를 막지 않고 안내만 보인다
export function pushGate() { toUi('rungate', { blocked: gateBlocked(), enabled: settings.pauseGate }); }
/** 예전에는 게임이 진행 중이면 대화를 막았지만, 지금은 막지 않고 앱이 "정지한 상태로 진행하기를 권장합니다"라고만 알린다. */
export function needPaused(): void { /* 권장만 한다 */ }
export function onMonthTick() { lastTickAt = Date.now(); pushGate(); }
setInterval(() => pushGate(), 5000); // 달 신호가 끊기면(일시정지) 안내를 거둔다
export function setAppOpen(v: boolean) {
  const changed = wins.appOpen !== v;
  wins.appOpen = v;
  if (changed && v) { runAck = false; pushGate(); }
  if (!wins.win || wins.win.isDestroyed()) return;
  if (v) { wins.win.show(); raise(); } else { if (wins.win.isFocused()) giveBackToGame(); wins.win.hide(); }
  safeSend(wins.launcher, 'appopen', v);
}
// ---- 게임 위에 뜨는 알림 카드(아이콘 옆). 누르면 본 창이 열린다. 게임이 앞에 없으면 윈도우 알림으로 대신한다.
// ToastMsg 타입: src/app/ctx.ts
let toastH = 84;
let toast: BrowserWindow | null = null, toastReady = false, toastTimer: ReturnType<typeof setTimeout> | null = null, toastQueue: ToastMsg | null = null;
function createToast() {
  toast = new BrowserWindow({
    width: 300, height: 84, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    focusable: false, alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
  });
  toast.setAlwaysOnTop(true, 'screen-saver', 1);
  toast.loadFile(path.join(__dirname, '..', '..', 'ui', 'toast.html'));
  toast.webContents.on('did-finish-load', () => { toastReady = true; if (toastQueue) { const q = toastQueue; toastQueue = null; showToast(q); } });
}
function placeToast() {
  if (!toast || !wins.launcher || wins.launcher.isDestroyed()) return;
  const s = wins.curScale, w = Math.round(300 * s), h = Math.round(toastH * s);
  const lb = wins.launcher.getBounds();
  const area = wins.gameDip ?? screen.getPrimaryDisplay().workArea;
  const left = lb.x + lb.width / 2 > area.x + area.width / 2;
  let x = left ? lb.x - w - 8 : lb.x + lb.width + 8, y = lb.y;
  x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - w));
  y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - h));
  toast.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
  toast.webContents.setZoomFactor(s);
}
export function hideToast() { if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; } if (toast && !toast.isDestroyed() && toast.isVisible()) toast.hide(); }
export function showToast(msg: ToastMsg, ms = 7000) {
  if (!toast || toast.isDestroyed()) createToast();
  if (!toastReady) { toastQueue = msg; return; }
  toastH = msg.action ? 118 : 84;
  placeToast();
  safeSend(toast, 'toast', msg);
  toast!.showInactive();
  toast!.setAlwaysOnTop(true, 'screen-saver', 1);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, msg.action ? Math.max(ms, 30000) : ms);
}
/** 알림: 아이콘 숫자는 늘 갱신하고, 설정이 켜져 있으면 카드를 띄운다(아이콘이 안 보일 때는 윈도우 알림). */
export function notify(msg: ToastMsg) {
  msg = { ...msg, title: uiText(msg.title), body: uiText(msg.body), ...(msg.action ? { action: uiText(msg.action) } : {}) };
  if (msg.action) toastActionKind = msg.kind === 'speech' ? 'speech' : msg.kind === 'press' ? 'press' : msg.kind === 'vassal' ? 'vassal' : msg.kind === 'fleet' ? 'fleet' : msg.kind === 'office' ? 'office' : msg.kind === 'declare' ? 'declare' : msg.kind === 'statement' ? 'statement' : msg.kind === 'debate' ? 'debate' : msg.kind === 'scandal' ? 'scandal' : msg.kind === 'hearing' ? 'hearing' : msg.kind === 'gov' ? 'gov' : msg.kind === 'faction' ? 'faction' : msg.kind === 'mediation' ? 'mediation' : 'agenda';
  updateBadge();
  if (!settings.notify) return;
  if (wins.launcher && !wins.launcher.isDestroyed() && wins.launcher.isVisible()) showToast(msg);
  else if (Notification.isSupported()) new Notification({ title: msg.title, body: msg.body }).show();
}
export function updateBadge() { safeSend(wins.launcher, 'badge', mail.inbox.filter((l) => !l.read).length); pushOffice(); } // 집무실 「외교 단말기」 아이콘 숫자도 같이
// ---- 전역 단축키, 트레이 아이콘, 자동 흐려짐
let tray: Tray | null = null, fadeCur = 1, fadeHoldUntil = 0;
function bumpFade() { fadeHoldUntil = Date.now() + 4000; }
/** 단축키를 (다시) 등록한다. 실패하면 이유 문장을, 성공하거나 꺼져 있으면 null. */
export function registerHotkey(): string | null {
  globalShortcut.unregisterAll();
  if (!settings.hotkey) return null;
  const ok = globalShortcut.register(settings.hotkey, () => { if (wins.gameFront || !wins.gameRunning || (wins.win && wins.win.isFocused())) setAppOpen(!wins.appOpen); });
  return ok ? null : `단축키 ${settings.hotkey}을(를) 등록하지 못했습니다. 다른 프로그램이 쓰고 있을 수 있어요. 다른 키를 골라 보세요.`;
}
export function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'ui', 'tray.png'));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip(pick('SLLM · SteLLaris Missive (실험)', 'SLLM · SteLLaris Missive (experimental)'));
    tray.on('click', () => setAppOpen(!wins.appOpen));
    refreshTray();
  } catch (e) { toUi('status', pick('트레이 아이콘을 만들지 못했습니다: ', 'Could not create the tray icon: ') + (e as Error).message); }
}
function trayMenu() {
  return Menu.buildFromTemplate([
    { label: pick('통신 단말기 열기/닫기', 'Open/close the comms terminal'), click: () => setAppOpen(!wins.appOpen) },
    { label: joinLabel(), enabled: !!council.pendingAgenda, click: () => { void openCouncilLive(); } },
    { label: pick('연설하기', 'Give a speech'), enabled: speechReady(), click: () => openSpeech() },
    { label: pick('언론사 인터뷰', 'Press interview'), enabled: pressReady(), click: () => openPress() },
    { label: pick('설정', 'Settings'), click: () => { openSettings(); } },
    { label: pick('창 위치 초기화', 'Reset window positions'), click: () => { settings.dockPos = null; settings.launcherPos = null; settings.radioDockPos = null; saveSettings(); } },
    { type: 'separator' },
    { label: pick('앱 완전히 끝내기', 'Quit the app completely'), click: () => quitAll() },
  ]);
}
export function refreshTray() { try { tray?.setContextMenu(trayMenu()); } catch { /* 트레이가 없으면 건너뜀 */ } }
export function startFade() {
  setInterval(() => {
    if (!wins.win || wins.win.isDestroyed() || !wins.win.isVisible()) return;
    if (terminalDocked()) { if (fadeCur !== 1) { fadeCur = 1; wins.win.setOpacity(1); } return; } // 집무실 안에서는 흐려지지 않는다
    const target = fadeTarget({ enabled: settings.fadeEnabled, inside: pointInRect(screen.getCursorScreenPoint(), wins.win.getBounds()), focused: wins.win.isFocused(), recent: Date.now() < fadeHoldUntil, base: settings.fadeOpacity });
    const next = stepOpacity(fadeCur, target, 0.12);
    if (next !== fadeCur) { fadeCur = next; wins.win.setOpacity(fadeCur); }
  }, 80);
}
export function quitAll() {
  globalShortcut.unregisterAll(); tray?.destroy(); tray = null;
  // 아직 게임에 보내지 않은 호감 변화가 있으면 보낸 뒤 끝낸다(최대 20초 기다림).
  const done = () => { setRadio(false); ctx.watcher.stop(); gameWatcher.stop(); ctx.p2.stop(); app.quit(); };
  Promise.race([flushMoods(), new Promise((r) => setTimeout(r, 20000))]).then(done, done);
}

// 게임(테두리 없는 창)을 클릭하면 게임이 자기 창을 맨 위로 올려서 앱이 뒤로 숨는다.
// 일반 '항상 위'보다 높은 층(screen-saver)에 두고, 포커스를 잃을 때와 몇 초마다 다시 맨 위로 올린다.
// 게임이 '독점 전체화면'이면 어떤 창도 위에 못 뜨므로, 게임은 테두리 없는 창 모드를 권장한다.
export function raise() {
  if (!wins.win || wins.win.isDestroyed() || wins.win.isMinimized() || !wins.win.isVisible() || !settings.keepOnTop) return;
  wins.win.setAlwaysOnTop(true, 'screen-saver', 1);
  wins.win.moveTop();
}
function keepOnTop() {
  if (!wins.win) return;
  wins.win.setAlwaysOnTop(settings.keepOnTop, 'screen-saver', 1);
  wins.win.on('blur', () => setTimeout(raise, 150));
  wins.win.on('minimize', () => { if (wins.appOpen) setAppOpen(false); }); // 윈도우 단축키 등으로 최소화돼도 다시 튀어나오지 않게 접어 둔다
  setInterval(() => { if (wins.win && !wins.win.isDestroyed() && !wins.win.isFocused()) raise(); raiseIcon(); }, 2000);
}


export function registerWindows(): void {
  ipcMain.handle('setKeepOnTop', async (_e, on: boolean) => {
    settings.keepOnTop = !!on; saveSettings();
    wins.win?.setAlwaysOnTop(settings.keepOnTop, 'screen-saver', 1);
    return settings;
  });
  ipcMain.handle(
    'setWindowPrefs',
    async (
      _e,
      prefs: {
        autoHide?: boolean;
        dock?: DockMode;
        resetPos?: boolean;
        fx?: boolean;
        launcherCorner?: string;
        uiScale?: number;
        autoScale?: boolean;
        notify?: boolean;
        autoOpenOnTalk?: boolean;
        hotkey?: string;
        fadeEnabled?: boolean;
        fadeOpacity?: number;
      },
    ) => {
      if (
        prefs.launcherCorner === 'tr' ||
        prefs.launcherCorner === 'tl' ||
        prefs.launcherCorner === 'br' ||
        prefs.launcherCorner === 'bl'
      ) {
        settings.launcherCorner = prefs.launcherCorner;
        settings.launcherPos = null;
        previewLauncherPos = null;
      }
      if ((prefs as any).councilMode === 'weighted' || (prefs as any).councilMode === 'equal' || (prefs as any).councilMode === 'teams')
        settings.councilMode = (prefs as any).councilMode;
      if ((prefs as any).councilTurns !== undefined) settings.councilTurns = clampTurns((prefs as any).councilTurns);
      if ((prefs as any).speechTurns !== undefined) settings.speechTurns = clampSpeechTurns((prefs as any).speechTurns);
      if ((prefs as any).councilSlots !== undefined) settings.councilSlots = clampSlots((prefs as any).councilSlots);
      if ((prefs as any).councilTeamTurns !== undefined) settings.councilTeamTurns = clampTeamTurns((prefs as any).councilTeamTurns); // 찬반 팀당 발언 수(2026-10-29)
      if (typeof (prefs as any).forceOverlay === 'boolean') settings.forceOverlay = (prefs as any).forceOverlay;
      if (typeof (prefs as any).emotionWar === 'boolean') settings.emotionWar = (prefs as any).emotionWar; // 감정 기억 선전포고(알파 11)
      if (typeof (prefs as any).childLimitOff === 'boolean') settings.childLimitOff = (prefs as any).childLimitOff; // 아이 수 제한 풀기
      if (typeof (prefs as any).auditOn === 'boolean') settings.auditOn = (prefs as any).auditOn; // 국정감사(하드코어, 2026-11-03)
      if (typeof (prefs as any).noconfOn === 'boolean') settings.noconfOn = (prefs as any).noconfOn; // 불신임(하드코어, 2026-11-03)
      if (typeof (prefs as any).gameWatcher === 'boolean') { // 게임을 켜면 SLLM 자동 실행(시작 프로그램 감시기 등록·해제)
        settings.gameWatcher = (prefs as any).gameWatcher;
        const wp = { dataDir: app.getPath('userData'), appDir: app.getAppPath() };
        if (settings.gameWatcher) void enableWatcher(wp).then((r) => logDiagnostic(r.ok ? 'info' : 'warn', 'watcher.enable', r)).catch(() => undefined);
        else void disableWatcher(wp).then(() => logDiagnostic('info', 'watcher.disable', {})).catch(() => undefined);
      }
      if (['all', 'big', 'off'].includes((prefs as any).familyNotify)) settings.familyNotify = (prefs as any).familyNotify; // 가족 사건 알림(2026-10-28)
      if (typeof (prefs as any).devMode === 'boolean') {
        settings.devMode = (prefs as any).devMode;
        applyScale(true);
        safeSend(wins.launcher, 'dev', settings.devMode);
        if (!settings.devMode) closeCouncil();
      }
      if (settings.devMode) {
        if ((prefs as any).devCouncilVote !== undefined) settings.devCouncilVote = devVoteMode((prefs as any).devCouncilVote);
        if ((prefs as any).devCouncilPercent !== undefined) settings.devCouncilPercent = devVotePercent((prefs as any).devCouncilPercent);
        if (typeof (prefs as any).devCouncilNoAi === 'boolean') settings.devCouncilNoAi = (prefs as any).devCouncilNoAi;
      } else {
        settings.devCouncilVote = 'normal';
        settings.devCouncilNoAi = false;
      }
      safeSend(council.win, 'devCouncilPrefs', {
        devMode: settings.devMode,
        devCouncilVote: settings.devCouncilVote,
        devCouncilPercent: settings.devCouncilPercent,
        devCouncilNoAi: settings.devCouncilNoAi,
      });
      if (typeof prefs.autoHide === 'boolean') settings.autoHide = prefs.autoHide;
      if (typeof prefs.fx === 'boolean') settings.fx = prefs.fx;
      if (prefs.dock === 'off' || prefs.dock === 'left' || prefs.dock === 'right') {
        settings.dock = prefs.dock;
        settings.dockPos = null;
        previewDockPos = null;
      }
      if (typeof (prefs as any).dockLock === 'boolean') {
        settings.dockLock = (prefs as any).dockLock;
        if (settings.dockLock) {
          freePlaced = false;
        } else if (wins.win && !wins.win.isDestroyed()) {
          const b = wins.win.getBounds();
          if (overlayPreviewActive) previewFreePos = { x: b.x, y: b.y };
          else settings.freePos = { x: b.x, y: b.y };
        }
      }
      if (prefs.resetPos) {
        settings.dockPos = null;
        settings.launcherPos = null;
        settings.freePos = null;
        settings.radioDockPos = null;
        previewDockPos = null;
        previewLauncherPos = null;
        previewFreePos = null;
      }
      if (typeof prefs.autoScale === 'boolean') settings.autoScale = prefs.autoScale;
      let hotkeyError: string | null = null;
      if (prefs.hotkey !== undefined) {
        settings.hotkey = sanitizeHotkey(prefs.hotkey, settings.hotkey);
        hotkeyError = registerHotkey();
      }
      if (typeof prefs.fadeEnabled === 'boolean') settings.fadeEnabled = prefs.fadeEnabled;
      if (prefs.fadeOpacity !== undefined) settings.fadeOpacity = clampFade(prefs.fadeOpacity, settings.fadeOpacity);
      if (typeof prefs.notify === 'boolean') settings.notify = prefs.notify;
      if (typeof prefs.autoOpenOnTalk === 'boolean') settings.autoOpenOnTalk = prefs.autoOpenOnTalk;
      if (prefs.uiScale !== undefined) settings.uiScale = layoutScale(null, Number(prefs.uiScale), false);
      if (prefs.uiScale !== undefined || typeof prefs.autoScale === 'boolean') applyScale(true);
      if (!settings.autoHide && wins.win && !wins.win.isVisible()) wins.win.showInactive();
      saveSettings();
      return { ...settings, hotkeyError };
    },
  );
  // 색 테마
  ipcMain.handle('setTheme', async (_e, v: { theme?: unknown; custom?: unknown }) => {
    if (v.theme !== undefined) settings.theme = sanitizeTheme(v.theme);
    if (v.custom !== undefined) settings.custom = sanitizeCustom(v.custom);
    saveSettings();
    safeSend(wins.launcher, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(toast, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(council.win, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(gov.win, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(banquet.win, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(mediation.win, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(summit.win, 'theme', { theme: settings.theme, custom: settings.custom });
    if (wins.setWin && !wins.setWin.isDestroyed()) safeSend(wins.setWin, 'theme', { theme: settings.theme, custom: settings.custom });
    if (radio.win && !radio.win.isDestroyed()) safeSend(radio.win, 'theme', { theme: settings.theme, custom: settings.custom });
    safeSend(speech.win, 'theme', { theme: settings.theme, custom: settings.custom }); // A-22: 연설 창도 테마를 따라감
    safeSend(fleet.win, 'theme', { theme: settings.theme, custom: settings.custom }); // 함대 사령부 창
    safeSend(office.win, 'theme', { theme: settings.theme, custom: settings.custom }); // 집무실 창
    safeSend(vassal.win, 'theme', { theme: settings.theme, custom: settings.custom }); // 종속국 통신 채널 창
    safeSend(press.win, 'theme', { theme: settings.theme, custom: settings.custom }); // 언론사 인터뷰 창
    safeSend(govReport.win, 'theme', { theme: settings.theme, custom: settings.custom }); // A-26 총독 보고 창
    safeSend(media.paperWin, 'theme', { theme: settings.theme, custom: settings.custom }); // A-22 2단계: 신문 지면 모양(자동)
    return settings;
  });
  ipcMain.handle('gateInfo', async () => ({ blocked: gateBlocked(), enabled: settings.pauseGate, aiEveryMin: settings.aiEveryMin, gossipOn: settings.gossipOn, extraOn: settings.extraOn, extraMax: settings.extraMax, papers: settings.papersOn, paperNames: PAPERS.map((_, i) => effectivePaper(settings.mediaPrefs, i).name) }));
  ipcMain.handle('gateAck', async () => { runAck = true; runAckAt = Date.now(); pushGate(); return true; });
  ipcMain.handle('gateSet', async (_e, a: { enabled?: unknown; aiEveryMin?: unknown; gossipOn?: unknown; extraOn?: unknown; extraMax?: unknown; papers?: unknown }) => {
    if (typeof a?.enabled === 'boolean') settings.pauseGate = a.enabled;
    if (typeof a?.gossipOn === 'boolean') settings.gossipOn = a.gossipOn;
    if (typeof a?.extraOn === 'boolean') settings.extraOn = a.extraOn;
    { const x = Number(a?.extraMax); if (a?.extraMax !== undefined && Number.isFinite(x) && x >= 1 && x <= 12) settings.extraMax = Math.round(x); }
    if (Array.isArray(a?.papers)) settings.papersOn = PAPERS.map((_, i) => (a.papers as unknown[])[i] !== false);
    const n = Number(a?.aiEveryMin); if (Number.isFinite(n) && n >= 1 && n <= 30) { settings.aiEveryMin = Math.round(n); restartAiTimer(); }
    saveSettings(); pushGate(); return { blocked: gateBlocked(), enabled: settings.pauseGate, aiEveryMin: settings.aiEveryMin, gossipOn: settings.gossipOn, extraOn: settings.extraOn, extraMax: settings.extraMax, papers: settings.papersOn, paperNames: PAPERS.map((_, i) => effectivePaper(settings.mediaPrefs, i).name) };
  });
  ipcMain.handle('winCtl', async (_e, what: 'min' | 'close' | 'setclose') => { if (what === 'setclose') closeSettings(); else setAppOpen(false); return true; }); // 최소화와 닫기 모두 아이콘으로 접는다(진짜 최소화는 상태 감시가 곧바로 다시 띄운다)
  // 아이콘 창(런처)
  ipcMain.handle('launcherClick', async (_e, act: 'toggle' | 'set' | 'tools' | 'paper' | 'gov' | 'radio' | 'vassal' | 'fleet' | 'office') => {
    if (act === 'office') { if (office.win && !office.win.isDestroyed()) closeOffice(); else openOffice(); return true; }
    if (act === 'fleet') { if (fleet.win && !fleet.win.isDestroyed()) closeFleet(); else openFleet(); return true; }
    if (act === 'vassal') { if (vassal.win && !vassal.win.isDestroyed()) closeVassal(); else openVassal(); return true; }
    if (act === 'radio') { if (radio.on) setRadio(false); else setRadio(true); return true; }
    if (act === 'gov') { if (gov.win && !gov.win.isDestroyed()) closeGov(); else openGov(); return true; }
    if (act === 'paper') { openPaper(); return true; }
    if (act === 'toggle') { const opening=!wins.appOpen; if(opening)safeSend(wins.win, 'pane','contacts'); setAppOpen(opening); return true; }
    if (act === 'set' || act === 'tools') { openSettings(); return true; }
    return false;
  });
  ipcMain.handle('launcherState', async () => ({ open: wins.appOpen, unread: mail.inbox.filter((l) => !l.read).length, theme: settings.theme, custom: settings.custom, fx: settings.fx, dev: settings.devMode }));
  ipcMain.handle('toastClick', async (_e, kind: string) => { hideToast(); if (kind === 'declare') { openDeclare(); return true; } if (kind === 'statement') { openForeignStatement(); return true; } if (kind === 'debate') { void playDebate(); return true; } if (kind === 'scandal') { openScandal(); return true; } if (kind === 'hearing') { showHearing(); return true; } if (kind === 'speech') { openSpeech(); return true; } if (kind === 'press') { openPress(); return true; } if (kind === 'vassal') { openVassal(); return true; } if (kind === 'fleet') { openFleet(); return true; } if (kind === 'office') { openOffice(office.toastGo); return true; } if (kind === 'news') { openPaper(); return true; } if (kind === 'gov') { openGovReport(); return true; } if (kind === 'faction') { if (openPendingFactionMeeting()) return true; } if (kind === 'mediation') { openPendingMediation(); return true; } setAppOpen(true); if (kind === 'letter') safeSend(wins.win, 'showInbox'); return true; });
  ipcMain.handle('toastClose', async () => { hideToast(); return true; });
  ipcMain.handle('testToast', async () => { notify({ kind: 'letter', title: pick('알림 시험', 'Notification test'), body: pick('이 카드는 편지나 안건이 왔을 때 뜹니다. 누르면 통신 단말기가 열립니다.', 'This card appears when a letter or resolution arrives. Click it to open the comms terminal.') }); return true; });
  ipcMain.handle('toastAction', async () => { hideToast(); if (toastActionKind === 'declare') { openDeclare(); return true; } if (toastActionKind === 'statement') { openForeignStatement(); return true; } if (toastActionKind === 'debate') { void playDebate(); return true; } if (toastActionKind === 'scandal') { openScandal(); return true; } if (toastActionKind === 'hearing') { showHearing(); return true; } if (toastActionKind === 'speech') openSpeech(); else if (toastActionKind === 'press') openPress(); else if (toastActionKind === 'vassal') openVassal(); else if (toastActionKind === 'fleet') openFleet(); else if (toastActionKind === 'office') openOffice(office.toastGo); else if (toastActionKind === 'gov') openGovReport(); else if (toastActionKind === 'faction') openPendingFactionMeeting(); else if (toastActionKind === 'mediation') openPendingMediation(); else if (council.pendingAgenda) void openCouncilLive(); return true; });
  ipcMain.handle('launcherTip', async (_e, label: unknown, y: unknown, h: unknown) => { if (typeof label === 'string' && label) showTip(label.slice(0, 40), Number(y) || 0, Number(h) || 38); else hideTip(); return true; });
  ipcMain.handle('quitApp', async () => { quitAll(); return true; });
}
