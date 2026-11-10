// 집무실(2026-10-18 1단계): 오버레이 「집무실」 아이콘 → 통치자 집무실의 홀로그램 바탕화면.
// 바탕화면 아이콘으로 제국 안 사람들(연락처·개인 서신·추모관)과 내치 창(총독·함대 사령부·종속국·인터뷰·연설·신문)을 연다.
// 1단계: 연락처는 앱이 이미 아는 인물(행성 총독 목록·함대 사령부의 지휘관)만. 지도자 전원 읽기·기억·편지·추모는 2단계.
import { paragonIndex, paragonFor, type ParagonLore } from '../paragons';
import { BrowserWindow, ipcMain, screen, type Rectangle } from 'electron';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { playerGestalt } from './gestalt-app';
import { safeSend } from '../safe-send';
import { gov, openGov, refreshPlanets } from './gov';
import { fleet, fleetView, openFleet } from './fleet-app';
import { vassal, openVassal } from './vassal-app';
import { press, openPress } from './press-app';
import { speech, openSpeech } from './speech-app';
import { media, openPaper, paperUnseen, paperHooks, winBounds } from './media';
import { restoreRect } from '../window-bounds';
import { coverScreen } from '../app/cover-screen';
import { logDiagnostic } from '../diagnostics';
import { chron } from './chronicle-app';
import { crisisView } from './crisis-app';
import { peopleOf, onPeopleChanged } from './people-app';
import { roleIconMasksSoon } from '../leader-icons';
import { traitLoc, traitLabel } from '../trait-names';
import { selectedLanguage } from './settings-ui';
import { officePeople, officeFeed, OFFICE_APPS, OFFICE_SKIN, OFFICE_SKIN_PAPER, OFFICE_GLASS, OFFICE_GLASS_TERM, dockBounds, type OfficeApp, type OfficeRect } from '../office';

export const office = { toastGo: 'letters' as 'letters' | 'memorial', win: null as BrowserWindow | null, rect: null as OfficeRect | null, docked: null as { app: OfficeApp; win: BrowserWindow } | null };

/** 특성 키 → 게임 지역화 이름(화면용)과 "이름: 설명"(성격을 정할 때 참고). 게임 폴더를 모르면 키를 읽기 쉽게 바꾼 이름. */
function withTraitNames<T extends { traits?: string[]; traitNotes?: string[] }>(list: T[]): T[] {
  const loc = traitLoc(ctx.flagProv.game(), selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
  return list.map((p) => (p.traits && p.traits.length ? { ...p, traits: p.traits.map((k) => traitLabel(loc.names, k)), traitNotes: p.traits.map((k) => traitLabel(loc.names, k) + (loc.descs[k] ? ': ' + loc.descs[k] : '')) } : p));
}
/** 파라곤(고유 영웅)이면 게임 지역화의 배경·한마디를 붙인다(2026-10-19, src/paragons.ts). 1:1 통신·말투·편지가 이걸 쓴다. */
function withParagons<T extends { name: string }>(list: T[]): Array<T & { paragon?: ParagonLore }> {
  const idx = paragonIndex(ctx.flagProv.game(), selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
  if (!idx.size) return list;
  return list.map((p) => { const g = paragonFor(p.name, idx); return g ? { ...p, paragon: g } : p; });
}
export function officeView() {
  const sid = ctx.curSaveId;
  const planets = gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets : null;
  const groups = sid ? chron().groups(sid, (all) => ctx.govMem().split(sid, all).own) : [];
  const fv = sid ? fleetView() : null;
  return {
    sid, running: ctx.gameRunning, empire: ctx.playerName || '', date: ctx.gameDate || '',
    crisis: crisisView(),
    planetsLoaded: !!planets,
    people: withParagons(withTraitNames(officePeople(planets, fv ? fv.admirals : [], sid ? peopleOf(sid) : []))),
    rosterLoaded: sid ? peopleOf(sid).some((p) => !p.gone) : false,
    icons: roleIconMasksSoon(ctx.flagProv.game(), () => push()), // 게임 폴더의 직업 아이콘(실행 중에만 읽음) → 테마 색으로 칠할 가림판. 처음엔 작업 스레드에서 만들고 다 되면 다시 보낸다(2026-10-27)
    feed: officeFeed(groups, ctx.playerIdx, 6),
    gestalt: playerGestalt(), // 단일 의식(machine·hive·gestalt) 제국이면 언론사 인터뷰·시민 청원 아이콘을 숨긴다(2026-10-19)
    letters: letterHook.count(), memorial: letterHook.memorial(), // 안 읽은 개인 서신(letters-app)·새로 이름이 오른 추모관 비석(memorial-app)
    inbox: termHook.unread(), // 외교 단말기의 안 읽은 외교 서신
    paperNew: paperUnseen(), // 책상 위 신문의 「새 호」 표시(2026-10-18)
    cabinet: cabinetHook(), // 내각 회의 준비됨(책상 태블릿·알람, 2026-10-19). null = 없음
  };
}
const push = () => safeSend(office.win, 'officeState', officeView());
/** 개인 서신(letters-app)이 안 읽은 편지 수를 알려 준다(가져오기 고리를 만들지 않으려고 이 방식). */
const letterHook = { count: () => 0, memorial: () => 0 };
let cabinetHook: () => { key: string; n: number; date: string } | null = () => null;
/** 내각 회의 준비 상태(faction-app.cabinetReady)를 main.ts 가 꽂는다(2026-10-19). */
export function setOfficeCabinet(fn: typeof cabinetHook): void { cabinetHook = fn; }
export function setOfficeLetters(count: () => number): void { letterHook.count = count; }
export function setOfficeMemorial(count: () => number): void { letterHook.memorial = count; }
export const pushOffice = (): void => { push(); };
/** 외교 통신 단말기(본 창, windows.ts)를 집무실에 붙이는 고리. windows.ts 가 office-app 을 가져오므로 거꾸로 가져오지 않고 이렇게 받는다. */
const termHook = { win: (): BrowserWindow | null => null, open: (): void => {}, close: (): void => {}, unread: (): number => 0, restore: (): void => {}, back: (): void => {} }; // back: 집무실을 닫을 때 게임을 다시 앞으로
export function setTerminalHook(h: typeof termHook): void { Object.assign(termHook, h); }
export const terminalDocked = (): boolean => office.docked?.app === 'terminal';
let termCss: string | null = null;
/** 단말기를 집무실에서 뗀다. 본 창은 닫지 않고(대화가 사라진다) 숨기고, 덧입힌 껍데기를 지우고, 원래 크기·위 순서로 돌린다(restore). */
function undockTerminal(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const key = termCss; termCss = null; if (key) void win.webContents.removeInsertedCSS(key).catch(() => {});
  termHook.close(); termHook.restore();
}
/** 붙어 있던 창을 떼어 낸다: 단말기는 숨기고, 다른 창은 닫는다. */
function release(d: { app: OfficeApp; win: BrowserWindow } | null): void {
  if (!d || d.win.isDestroyed()) return;
  if (d.app === 'terminal') undockTerminal(d.win); else d.win.close();
}

/** go: 열자마자 보여 줄 화면(알림 카드의 「개인 서신」 → 'letters'). */
export function openOffice(go?: 'letters' | 'memorial') {
  if (office.win && !office.win.isDestroyed()) { office.win.show(); office.win.focus(); push(); if (go) safeSend(office.win, 'officeGo', go); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1360, Math.round(area.width * 0.86)), height: Math.min(900, Math.round(area.height * 0.9)) };
  let x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  { const saved = restoreRect(winBounds.get('office'), screen.getAllDisplays().map((d) => d.workArea), { width: 900, height: 600 }); if (saved) { x = saved.x; y = saved.y; sz.width = saved.width; sz.height = saved.height; } } // 지난번 크기·위치(2026-10-18)
  office.win = new BrowserWindow({ ...sz, x, y, minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#05090c', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  office.win.setAlwaysOnTop(true, 'screen-saver', 0); // 집무실에서 연 창(총독·함대 등)이 그 위에 뜨도록 한 단계 낮게
  void office.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'office.html'));
  office.win.once('ready-to-show', () => { office.win?.show(); push(); if (go) safeSend(office.win, 'officeGo', go); });
  office.win.on('closed', () => { officeFull.want = officeFull.on; officeFull.on = false; officeFull.prev = null; office.win = null; office.rect = null; const d = office.docked; office.docked = null; release(d); });
  const follow = () => { const d = office.docked; if (d && !d.win.isDestroyed()) place(d.win); };
  office.win.on('move', follow); office.win.on('resize', follow);
  { const w = office.win, keep = () => (w.isDestroyed() ? null : officeFull.on ? officeFull.prev : w.getBounds()); w.on('move', () => { if (!officeFull.on) winBounds.later('office', keep); }); w.on('resize', () => { if (!officeFull.on) winBounds.later('office', keep); }); w.on('close', () => { const b = keep(); if (b) winBounds.set('office', b); }); }
  // 전체화면 전환 키(2026-11-08 사용자: 「집무실은 전체화면 전환 키가 따로 있음 좋긴 할듯」 · 작업 표시줄까지 덮기): F11
  { const w = office.win; w.webContents.on('before-input-event', (e, inp) => { if (inp.type === 'keyDown' && inp.key === 'F11' && !inp.alt && !inp.control && !inp.meta) { e.preventDefault(); toggleOfficeFull(); } });
    if (officeFull.want) w.once('ready-to-show', () => { if (!w.isDestroyed() && !officeFull.on) toggleOfficeFull(); }); } // 기본 전체화면 · 지난번에 창 모드로 닫았으면 창 모드로(이 실행 동안)
}
/** 집무실 전체화면: on = 게임 모니터를 작업 표시줄까지 덮는다, off = 전의 창 크기·자리로. 저장되는 창 크기는 전체화면 전의 것. */
const officeFull: { on: boolean; prev: Rectangle | null; want: boolean } = { on: false, prev: null, want: true }; // 기본은 전체화면(2026-11-08 사용자: 「전체화면을 디폴트로 — 작업 표시줄 빈자리까지」). F11 로 창 모드, 닫을 때 상태를 기억(이 실행 동안)
export function toggleOfficeFull(): void {
  const w = office.win; if (!w || w.isDestroyed()) return;
  if (!officeFull.on) {
    officeFull.prev = w.getBounds(); officeFull.on = true;
    coverScreen(w, true, ctx.gameDip);
    w.setAlwaysOnTop(true, 'screen-saver', 0); // 덮개는 2단계로 올리지만, 집무실에서 연 창(1단계)이 그 위에 떠야 한다
  } else {
    officeFull.on = false; coverScreen(w, false);
    const b = officeFull.prev; officeFull.prev = null;
    if (b) setTimeout(() => { if (!w.isDestroyed()) { w.setBounds(b); winBounds.set('office', b); } }, 60); // 전체화면이 풀린 뒤에 크기를 되돌린다
  }
  w.focus();
  logDiagnostic('info', 'office.fullscreen', { on: officeFull.on });
}
export function closeOffice() { if (office.win && !office.win.isDestroyed()) { if (office.win.isFocused() || office.docked?.win.isFocused()) termHook.back(); office.win.close(); } }

// ---- 집무실 컴퓨터 안에서 열기(2026-10-18): 집무실에서 연 창은 따로 뜨지 않고 홀로그램 화면의 본문 자리에 꼭 맞춰 붙는다.
// 기능 창의 html 은 고치지 않는다: 자리·크기를 맞추고, 홀로그램 껍데기 CSS(주사선·유리 배경·끌기 막기)를 덧입힌다.
// 홀로그램 머리줄(제국·날짜·「‹ 바탕화면」)은 집무실 쪽에 그대로 남는다. 붙은 창을 닫으면 바탕화면으로 돌아온다.
const appWin = (app: OfficeApp): BrowserWindow | null => ({ gov: gov.win, fleet: fleet.win, vassal: vassal.win, press: press.win, speech: speech.win, paper: media.paperWin, terminal: termHook.win() } as Record<OfficeApp, BrowserWindow | null>)[app] ?? null;
function place(win: BrowserWindow): void {
  if (!office.win || office.win.isDestroyed() || !office.rect) return;
  const b = dockBounds(office.win.getContentBounds(), office.rect);
  win.setMinimumSize(320, 240); win.setMaximumSize(10000, 10000); // 창마다 걸린 최소·최대 크기를 풀어야 홀로그램 자리에 맞출 수 있다
  win.setBounds(b);
}
function skin(app: OfficeApp, win: BrowserWindow, glass: boolean): void {
  // 집무실에서 새로 연 투명 창: 바탕·판 색만 반투명 유리로(글자는 선명), 신문은 종이를 비우고 글자를 밝게. 이미 열려 있던 불투명 창은 주사선·테두리만.
  const css = OFFICE_SKIN + (glass ? (app === 'paper' ? OFFICE_SKIN_PAPER : app === 'terminal' ? OFFICE_GLASS_TERM : OFFICE_GLASS) : '');
  // 단말기는 떼어 낸 뒤에도 계속 쓰는 창이라 덧입힌 CSS 열쇠를 기억했다가 지운다
  const put = () => { if (!win.isDestroyed()) void win.webContents.insertCSS(css).then((k) => { if (app === 'terminal') { if (terminalDocked()) termCss = k; else void win.webContents.removeInsertedCSS(k).catch(() => {}); } }).catch(() => {}); };
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', put); else put();
}
function dock(app: OfficeApp, glass: boolean): void {
  const win = appWin(app); if (!win || win.isDestroyed() || !office.win || office.win.isDestroyed()) return;
  const prev = office.docked; if (prev && prev.win !== win) release(prev); // 한 번에 하나만
  if (prev && prev.win === win) { safeSend(office.win, 'officeDocked', app); place(win); return; } // 이미 붙어 있음
  office.docked = { app, win };
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  place(win); skin(app, win, glass);
  win.once('show', () => place(win)); // 창이 스스로 자리를 잡은 뒤에도 다시 맞춘다
  if (app === 'terminal') {
    // 단말기는 닫지 않고 숨긴다(✕·단축키·트레이) → 숨으면 집무실 바탕화면으로 돌아온다
    const off = () => { if (office.docked?.win === win) { office.docked = null; undockTerminal(win); safeSend(office.win, 'officeDocked', null); } };
    win.once('hide', off);
  } else win.once('closed', () => { if (office.docked?.win === win) { office.docked = null; safeSend(office.win, 'officeDocked', null); } });
  safeSend(office.win, 'officeDocked', app);
}

/** 바탕화면 아이콘이 여는 기존 창. 연락처·서신·추모는 집무실 안에서 열리므로 여기 없다. */
function launch(app: OfficeApp, arg?: string): boolean {
  const was = appWin(app); const fresh = !was || was.isDestroyed(); // 이미 열려 있던 창은 불투명 그대로 붙인다(닫았다 열면 진행 중인 청문회 등이 끊긴다)
  switch (app) {
    case 'gov': openGov(arg || undefined, true); break;
    case 'fleet': openFleet(true); break;
    case 'vassal': openVassal(true); break;
    case 'press': openPress(true); break;
    case 'speech': openSpeech(true); break;
    case 'paper': openPaper(true); dock(app, true); return true; // 신문은 지면이 다르면 새로 만들므로 늘 유리 껍데기(디스플레이 지면)
    case 'terminal': termHook.open(); dock(app, true); return true; // 단말기는 늘 떠 있는 본 창이라 언제나 유리 껍데기를 덧입힌다
    default: return false;
  }
  dock(app, fresh); return true;
}

export function registerOffice(): void {
  onPeopleChanged(() => { if (office.win && !office.win.isDestroyed()) push(); });
  paperHooks.changed = () => { if (office.win && !office.win.isDestroyed()) push(); }; // 새 신문이 나오거나 읽으면 책상 신문 표시를 고친다
  ipcMain.handle('officeState', async () => officeView());
  ipcMain.handle('officeClose', async () => { closeOffice(); return true; });
  ipcMain.handle('officeOpen', async (_e, app: unknown, arg: unknown) => (OFFICE_APPS.includes(app as OfficeApp) ? launch(app as OfficeApp, typeof arg === 'string' ? arg.slice(0, 80) : undefined) : false));
  ipcMain.handle('officeRect', async (_e, r: unknown) => { const v = r as OfficeRect; if (v && [v.x, v.y, v.w, v.h].every((n) => Number.isFinite(n)) && v.w > 50 && v.h > 50) { office.rect = { x: v.x, y: v.y, w: v.w, h: v.h }; const d = office.docked; if (d && !d.win.isDestroyed()) place(d.win); } return true; });
  ipcMain.handle('officeBack', async () => { const d = office.docked; office.docked = null; release(d); safeSend(office.win, 'officeDocked', null); return true; });
  ipcMain.handle('officePlanets', async () => { const r = await refreshPlanets(); push(); return r && 'error' in r ? { ok: false, error: r.error } : { ok: true }; });
}
