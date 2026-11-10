// 화면 전체 덮기(2026-11-05 사용자: 전쟁 선언문 같은 「전체화면」 창이 윈도우 작업 표시줄까지 가려야 맞다).
// 창 크기만 모니터에 맞추면(setBounds) 윈도우는 그 창을 전체화면으로 치지 않아 작업 표시줄을 계속 위에 둔다.
// 진짜 전체화면(setFullScreen)으로 바꾸면 작업 표시줄이 사라진다. 게임이 있는 모니터(모르면 주 모니터)에서.
import { screen, type BrowserWindow, type Rectangle } from 'electron';

/** 게임이 있는 모니터 전체(작업 표시줄 포함). */
export function gameDisplayBounds(gameDip: Rectangle | null): Rectangle {
  return gameDip ? screen.getDisplayMatching(gameDip).bounds : screen.getPrimaryDisplay().bounds;
}
/** on = 그 모니터를 작업 표시줄까지 덮는 전체화면으로, off = 전체화면 풀기(창 크기는 부른 쪽이 다시 맞춘다). */
export function coverScreen(w: BrowserWindow | null, on: boolean, gameDip: Rectangle | null = null): void {
  if (!w || w.isDestroyed()) return;
  try {
    if (on) {
      w.setBounds(gameDisplayBounds(gameDip)); // 그 모니터로 옮긴 뒤 전체화면(전체화면은 창이 있는 모니터를 덮는다)
      w.setFullScreenable(true); w.setFullScreen(true);
      w.setAlwaysOnTop(true, 'screen-saver', 2);
    } else if (w.isFullScreen()) { w.setFullScreen(false); w.setFullScreenable(false); }
  } catch { /* 창이 닫히는 중 */ }
}
