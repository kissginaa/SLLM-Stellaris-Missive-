// 출정 의식(2026-10-20 알파 10): 게임 화면을 덮는 전체화면 창에 복무신조가 아래에서 위로 올라가고 낭독 음성이 흐른다.
// 화면: ui/ceremony.html. 복무신조·음량·연출 설정은 features/music-app.ts(sllm_music.json). 그림은 앱 데이터 ceremony/ 폴더(march·speech·fleet, 4K 까지).
import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { coverScreen } from '../app/cover-screen'; // 작업 표시줄까지 덮는 전체화면(2026-11-05)
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { musicView, musicCeremonyFx } from './music-app';
import { LogRouter, SLOT } from '../app/log-router';
import { link } from '../app/game-link';
import { terminalRequest, terminalReplies } from './terminal';

const L = pick; // 한국어·영어·언어 팩
export const CEREMONY_IMAGES = ['march', 'speech', 'fleet'] as const;
export type CeremonyImage = (typeof CEREMONY_IMAGES)[number];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp'];
export const MAX_CEREMONY_IMAGE = 48 * 1024 * 1024; // 4K png 도 넉넉히
const dir = () => path.join(app.getPath('userData'), 'ceremony');

/** 그림 폴더에서 march/speech/fleet 를 찾는다(확장자는 png·jpg·jpeg·webp, 48MB 까지). */
export function ceremonyImages(): Partial<Record<CeremonyImage, string>> {
  const out: Partial<Record<CeremonyImage, string>> = {};
  const bundled = path.join(__dirname, '..', '..', 'ui', 'assets', 'ceremony');
  for (const k of CEREMONY_IMAGES) {
    for (const folder of [dir(), bundled]) {
      for (const ext of IMG_EXT) {
        const f = path.join(folder, `${k}.${ext}`);
        try { const st = fs.statSync(f); if (st.isFile() && st.size > 0 && st.size <= MAX_CEREMONY_IMAGE) { out[k] = pathToFileURL(f).href; break; } } catch { /* next candidate */ }
      }
      if (out[k]) break;
    }
  }
  return out;
}

let win: BrowserWindow | null = null; let address: { title: string; text: string; sid: string; epoch: number; notice: string; track?: 'anthem'|'march'; fleets?: boolean; salute?: boolean; kind?: 'victory'|'inauguration'|'founding' } | null = null; let onDone: ((early: boolean) => void) | null = null;
export function ceremonyOpen(declaration: { title: string; text: string; notice: string; track?: 'anthem'|'march'; fleets?: boolean; salute?: boolean; kind?: 'victory'|'inauguration'|'founding' }, done?: (early: boolean) => void): { ok: boolean; error?: string } {
  if (!declaration.text.trim()) return { ok: false, error: L('선언문 본문이 없습니다.', 'The declaration is empty.') };
  if (win && !win.isDestroyed()) { win.focus(); return { ok: false, error: L('선언문을 발표 중입니다.', 'A declaration is already being presented.') }; }
  address = { ...declaration, sid: ctx.curSaveId, epoch: link.epoch }; onDone = done ?? null;
  // 게임이 있는 화면 전체(작업 표시줄 포함)를 덮는다.
  let area = ctx.gameDip ? screen.getDisplayMatching(ctx.gameDip).bounds : screen.getPrimaryDisplay().bounds;
  if(declaration.kind){const office=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&/[/\\]office\.html(?:[?#]|$)/.test(w.webContents.getURL()));
   if(office)area=office.getBounds();else{const width=Math.min(1360,Math.round(area.width*.86)),height=Math.min(900,Math.round(area.height*.9));area={x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),width,height};}}

  win = new BrowserWindow({ x: area.x, y: area.y, width: area.width, height: area.height, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, show: false, backgroundColor: '#000000', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), backgroundThrottling: false } });
  win.setAlwaysOnTop(true, 'screen-saver', 2);
  win.setMenuBarVisibility(false);
  void win.loadFile(path.join(__dirname, '..', '..', 'ui', declaration.kind ? 'national-ceremony.html' : 'ceremony.html'));
  const cover = !declaration.kind; // 국가 의식(집무실 크기)이 아니면 화면 전체 — 작업 표시줄까지(2026-11-05 사용자)
  win.once('ready-to-show', () => { if (cover) coverScreen(win, true, ctx.gameDip); win?.show(); win?.focus(); });
  win.on('closed', () => { win = null; address = null; const f = onDone; onDone = null; if (f) f(true); });
  logDiagnostic('info', 'declaration.presentation', { lines: declaration.text.split('\n').filter(x => x.trim()).length });
  return { ok: true };
}
export function ceremonyClose(): void { if (win && !win.isDestroyed()) win.close(); }


type DepartureFleet = { name: string; admiral: string };
const rosterRequests = new Map<number, { sid: string; rows: DepartureFleet[] }>();
async function departureFleets(): Promise<DepartureFleet[]> {
  const sid = ctx.curSaveId, epoch = link.epoch;
  if (!ctx.gameRunning || !sid || !Number.isSafeInteger(ctx.playerIdx)) return [];
  const req = ++link.reqCounter;
  const entry = { sid, rows: [] as DepartureFleet[] }; rosterRequests.set(req, entry);
  // Read only: own mobile military fleets, including military-special classes; never civilian ships or transports.
  const body = `every_owned_fleet = { limit = { is_mobile = yes OR = { is_ship_class = shipclass_military is_ship_class = shipclass_military_special } } if = { limit = { exists = leader } leader = { log = "SLLM:CERFLEET/;/req=${req}/;/sid=[Owner.sllm_save_id]/;/name=[Prev.GetName]/;/admiral=[This.GetName]" } } else = { log = "SLLM:CERFLEET/;/req=${req}/;/sid=[Owner.sllm_save_id]/;/name=[This.GetName]" } } log = "SLLM:CERFLEET_END/;/req=${req}/;/sid=[This.sllm_save_id]"`;
  try {
    const m = await terminalRequest(`effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_idx value = ${ctx.playerIdx} } } ${body} }`, 'CERFLEET_END', req);
    return ctx.curSaveId === sid && link.epoch === epoch && m.kv.sid === sid ? entry.rows : [];
  } catch (e) { logDiagnostic('warn', 'ceremony.fleet_read_failed', { error: String(e) }); return []; }
  finally { rosterRequests.delete(req); }
}

export function registerCeremony(router: LogRouter): void {
  router.on(SLOT.CEREMONY, 'ceremony:fleets', (m) => {
    if (m.kind !== 'CERFLEET' && m.kind !== 'CERFLEET_END') return;
    const entry = rosterRequests.get(Number(m.kv.req));
    if (!entry || entry.sid !== ctx.curSaveId || m.kv.sid !== entry.sid) return;
    if (m.kind === 'CERFLEET_END') { terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); return; }
    const name = (m.kv.name || '').trim();
    if (name && !name.includes('[')) entry.rows.push({ name: name.slice(0, 240), admiral: (m.kv.admiral || '').includes('[') ? '' : (m.kv.admiral || '').slice(0, 160) });
  });

  ipcMain.handle('ceremonyData', async () => {
    const current = address, activeWindow = win;
    if (!current || current.sid !== ctx.curSaveId || current.epoch !== link.epoch) return null;
    const fleets = current.fleets === false ? [] : await departureFleets();
    if (address !== current || current.sid !== ctx.curSaveId || current.epoch !== link.epoch || win !== activeWindow || !win || win.isDestroyed()) return null;
    const v = musicView(), fx = musicCeremonyFx();
    const lines = current.text.split('\n').map(x => x.trim()).filter(Boolean);
    const backdrop=current.kind?pathToFileURL(path.join(__dirname,'..','..','ui','assets','ceremony',current.kind+'-v1.png')).href:'';
    return { kind:current.kind,backdrop,title: current.title, lines, fleets, salute: !!current.salute, notice: current.notice, audio: v.tracks[current.track || 'march']?.url || '', volume: v.volume, flag: ctx.flagUrlFor(ctx.playerIdx) ?? '', images: ceremonyImages(), darkness: fx.darkness, embers: fx.embers, drone: false, persp: fx.persp };
  });
  ipcMain.handle('ceremonyDone', async (_e, early: unknown) => { const f = onDone; onDone = null; if (win && !win.isDestroyed()) win.close(); if (f) f(!!early); return true; });
  ipcMain.handle('ceremonyImages', async () => { const im = ceremonyImages(); return { dir: dir(), march: !!im.march, speech: !!im.speech, fleet: !!im.fleet }; });
  ipcMain.handle('ceremonyOpenFolder', async () => { try { fs.mkdirSync(dir(), { recursive: true }); const r = await shell.openPath(dir()); return r ? { ok: false, error: r } : { ok: true }; } catch (e) { return { ok: false, error: (e as Error).message }; } });
}
