// A-00b 4번: 성간 라디오(앱 쪽). 2026-10-15 main.ts 709~834줄·IPC 4개(radioGet·radioSelect·radioOff·radioNow)에서 옮김(동작 변경 없음).
// 순수 로직(대본·대기열·방송 기록)은 src/radio.ts. 여기는 타이머·창·IPC. 다른 기능은 radio 객체(on·q·win…)로 상태를 본다.
// 성간 라디오: 플레이어가 켰을 때만. 2분(실제 시간)마다 쌓인 사건으로 아나운서와 기자가 방송한다.
import { crisisRadio } from './crisis-app';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { logDiagnostic, writeRawDiagnostic } from '../diagnostics';
import { RadioQueue, radioMessages, parseRadio, completeRadio, radioStation, radioStationViews, RadioAiredStore, backlogEvents, recapFacts, followUpBackground, radioNowBlock, radioGameLive } from '../radio';
import { syncRadioChron } from './chronicle-app';
import { redactKey } from '../aiclient';
import { toFrac, launcherRect } from '../gameWindow';
import { effectivePaper } from '../media-custom';
import { chronKey, RADIO_IDX } from '../chronicle';
import { settings, saveSettings } from '../app/settings';
import { ctx } from '../app/ctx';
import { safeSend } from '../safe-send';
import { pick } from './settings-ui';
import { moodPromptNow } from './mood-app'; // 민심이 라디오 논조에(2026-10-20 알파 10)
import { dayMoodLink } from '../app/daymood-hooks'; // 라디오 짧은 꼭지(2026-10-28)
import { warFrontInfo } from '../app/war-front'; // 우리 전쟁의 전선(2026-10-26) — frontier-app 이 등록(가져오기 고리 방지)

export const radio = {
  win: null as BrowserWindow | null,
  on: false,
  timer: null as ReturnType<typeof setInterval> | null,
  next: 0,
  busy: false,
  /** A-15 지금 듣기 쿨다운 기준 */
  lastEnd: 0,
  q: new RadioQueue(),
  /** 세이브별 마지막 요약 재방송(같은 요약을 되풀이하지 않는다) */
  recapSig: new Map<string, string>(),
  history: new Map<string, string[]>(),
  session: 0,
  /** 게임이 꺼져 있어 쉰다는 알림(radioIdle)을 이번에 이미 보냈는가. 방송을 다시 시작하면 지운다. */
  idleSent: false,
  /** 세이브별 마지막 가상 일상 방송의 게임 날짜. 날짜가 그대로면(일시정지 등) 같은 일상 방송에 AI 를 다시 부르지 않는다(2026-10-18). */
  dailyDate: new Map<string, string>(),
};
/** 세이브가 바뀌거나 게임 로그가 새로 시작되면 이전 세이브의 대기열·최근 방송 문맥을 버린다(2026-10-18). 다음 방송 때 새 세이브의 연대기로 다시 채운다. */
export function radioResetForSave(): void {
  radio.q.clear(); radio.history.clear(); radio.idleSent = false;
  safeSend(radio.win, 'radioQueue', 0);
}
/** 개발자 시험용 우회(게임 없이 방송). dev-tools 만 켜고, 개발자 모드가 꺼져 있으면 radioGameLive 가 무시한다. 저장하지 않는다. */
export const radioDev = { bypass: false };
const gameLive = () => radioGameLive(ctx.gameRunning, settings.devMode, radioDev.bypass);
let radioAiredStore: RadioAiredStore | null = null;
export function radioAired(): RadioAiredStore { return (radioAiredStore ??= new RadioAiredStore(path.join(app.getPath('userData'), 'sllm_radio_aired.json'))); }
/** 이 시간선의 라디오 연대기(오래된 순). */
export function radioChronOwn(sid: string) { return ctx.govMem().split(sid, ctx.chron().list(chronKey(sid, RADIO_IDX))).own; }
/** 라디오 연대기의 최근 1년 중 아직 방송하지 않은 사건으로 대기열을 채운다. */
export function fillRadioBacklog(): void {
  if (!ctx.curSaveId || !ctx.gameDate) return; const sid = ctx.curSaveId;
  for (const ev of backlogEvents(radioChronOwn(sid), ctx.gameDate, (id) => radioAired().has(sid, id))) radio.q.push(ev);
  safeSend(radio.win, 'radioQueue', radio.q.size);
}
const RADIO_MS = 120000;
export function scheduleRadio() {
  if (!radio.on) return;
  if (radio.timer) clearTimeout(radio.timer); // 주기가 두 갈래로 겹치지 않게
  const session = radio.session;
  radio.next = Date.now() + RADIO_MS; pushRadioState();
  radio.timer = setTimeout(() => { void radioTick().finally(() => { if (radio.on && session === radio.session) scheduleRadio(); }); }, RADIO_MS);
  // 짧은 꼭지(2026-10-28 동적 일상 분위기): AI 방송 사이 1분 지점에 틀 문장 하나(날씨·생활·광고·청취자 전화). LLM 없음.
  if (segTimer) clearTimeout(segTimer);
  segTimer = setTimeout(() => { segTimer = null; if (radio.on && session === radio.session) radioSegment(); }, RADIO_MS / 2);
}
let segTimer: ReturnType<typeof setTimeout> | null = null;
/** 짧은 꼭지 한 편을 내보낸다(방송 중·게임이 꺼짐·게임 날짜 그대로면 쉼). 연대기·방송 기록에는 남기지 않는다. */
export function radioSegment(): boolean {
  if (!radio.on || radio.busy || !gameLive()) return false;
  const seg = dayMoodLink.segment(); if (!seg) return false;
  const station = configuredStation(settings.radioStation);
  const names = { announcer: station.announcer, cohost: station.cohost, reporter: seg.caller || station.reporter };
  safeSend(radio.win, 'radioBroadcast', { date: ctx.gameDate, lines: seg.lines, station: station.name, parent: station.parent, format: 'studio', names, fictional: true, short: seg.label, segKind: seg.kind });
  return true;
}
export function configuredStations() {
  return radioStationViews().map((s) => ({
    ...s,
    name: settings.mediaPrefs[s.paper]?.radioName || s.name,
    parent: effectivePaper(settings.mediaPrefs, s.paper).name,
    outlook: settings.mediaPrefs[s.paper]?.persona
      ? pick('사용자 지정 · ', 'Custom · ') + settings.mediaPrefs[s.paper].persona.replace(/\s+/g, ' ').slice(0, 90)
      : s.outlook,
  }));
}
export function configuredStation(id: unknown) { return configuredStations().find((s) => s.id === id) ?? configuredStations()[0]; }
export function radioState() {
  const station = configuredStation(settings.radioStation);
  return { on: radio.on, next: radio.next, queued: radio.q.size, working: radio.busy, station: station.id, stations: configuredStations(), names: { announcer: station.announcer, reporter: station.reporter } };
}
export function pushRadioState() { safeSend(ctx.launcher, 'radioOn', radio.on); safeSend(radio.win, 'radioState', radioState()); }
/** 방송 한 편. 실제로 방송을 내보냈으면 true(개발자 시험이 견본 대본으로 대신할지 판단). */
export async function radioTick(manual = false): Promise<boolean> {
  if (!radio.on || radio.busy) return false;
  radio.next = 0; safeSend(radio.win, 'radioState', radioState());
  if (!gameLive()) { if (!radio.idleSent) { radio.idleSent = true; safeSend(radio.win, 'radioIdle'); } return false; } // 쉰다는 알림은 한 번만
  radio.idleSent = false;
  if (!radio.q.size) { syncRadioChron(); fillRadioBacklog(); } // 신문 연대기에만 있던 기록도 라디오 연대기에 채운 뒤 미방송 사건으로 대기열을 만든다
  const sid = ctx.curSaveId;
  let facts = radio.q.take(); const taken = radio.q.taken; let recap = false, recapSig = '';
  if (!facts.length && sid && ctx.gameDate) { // 새 사건이 없으면 창작 방송 전에 최근 1년 요약 재방송(같은 요약은 한 번만)
    const r = recapFacts(radioChronOwn(sid), ctx.gameDate); recapSig = r.join('\n');
    if (r.length && radio.recapSig.get(sid) !== recapSig) { facts = r; recap = true; }
  }
  const crisis = crisisRadio(); // 은하 위기 특집(2026-10-17): 위기 동안에는 가상 일상 코너 대신 위기 특보, 대본은 긴급 특별 방송 편성
  if (!facts.length && !recap && crisis.directive && crisis.facts.length) facts = crisis.facts;
  const fictional = facts.length === 0;
  // 새 사건·요약·위기가 없을 때의 가상 일상 방송은 게임 날짜가 바뀌었을 때만(일시정지한 채 자리를 비우면 2분마다 유료 호출이 쌓이던 문제). '지금 듣기'는 예외.
  if (fictional && !manual && sid && ctx.gameDate && radio.dailyDate.get(sid) === ctx.gameDate) return false;
  const restore = () => { if (!recap && radio.on && session === radio.session && sid === ctx.curSaveId) { radio.q.putBack(); safeSend(radio.win, 'radioQueue', radio.q.size); } };
  const station = configuredStation(settings.radioStation), session = radio.session, date = ctx.gameDate, revision = ctx.mediaRevision;
  const historyKey = station.id + (fictional ? ':daily' : recap ? ':recap' : '');
  const radioRecent = radio.history.get(historyKey) ?? [];
  const format = Math.random() < 0.5 ? 'studio' : 'field';
  const names = { announcer: station.announcer, cohost: station.cohost, reporter: station.reporter };
  radio.busy = true; safeSend(radio.win, 'radioWorking', true);
  try {
    const background = !recap && sid && ctx.gameDate ? followUpBackground(taken, radioChronOwn(sid), ctx.gameDate, (id) => radioAired().has(sid, id)) : []; // 후속 보도: 이어지는 지난 소식을 같은 호출의 프롬프트에 넣는다(추가 AI 호출 없음)
    const messages = radioMessages(ctx.playerName || 'the player empire', date, facts, radioRecent, station.id, effectivePaper(settings.mediaPrefs, station.paper), station.name, format, recap, background);
    if (crisis.directive) messages.splice(1, 0, { role: 'system', content: crisis.directive });
    if (!fictional) { const fronts = await warFrontInfo().catch(() => [] as string[]); if (fronts.length) messages.splice(1, 0, { role: 'system', content: '[War fronts of the player empire — confirmed game facts; mention them only if they fit the news, and name only these systems] ' + fronts.join(' ') }); } // 국경·전선(2026-10-26)
    { const md = moodPromptNow(); if (md) messages.splice(1, 0, { role: 'system', content: md }); } // 민심 한 줄(진행자의 말투·화제 선택에만, 수치를 읽지는 않게)
    let raw = await ctx.ai.chat(messages, { maxTokens: 2200, json: true });
    if (!radio.on || session !== radio.session || sid !== ctx.curSaveId) return false; // 껐다 다시 켠 창·다른 세이브에 이전 방송을 내보내지 않는다
    let lines = parseRadio(raw, format);
    if (!completeRadio(lines, format)) {
      raw = await ctx.ai.chat([...messages, { role: 'user', content: 'Rewrite the script. I need complete JSON with exactly 8 lines alternating between announcer and ' + (format === 'studio' ? 'cohost' : 'reporter') + '. Keep each line short.' }], { maxTokens: 2200, json: true });
      if (!radio.on || session !== radio.session || sid !== ctx.curSaveId) return false;
      lines = parseRadio(raw, format);
    }
    if (!completeRadio(lines, format)) { logDiagnostic('warn','ai.response.invalid',{feature:'radio',format,lineCount:lines.length});writeRawDiagnostic('sllm_radioraw.log',new Date().toISOString()+' format='+format+' len='+String(raw??'').length+'\n'+String(raw??'').slice(0,6000)); /* 다음에 실패하면 실제 답을 보고 고칠 수 있게 */restore();safeSend(radio.win, 'radioError', pick('4차례 대화 형식의 대본을 완성하지 못했습니다. 이번 방송은 쉽니다(사건은 다음 방송으로 넘깁니다).', 'Could not complete a four-exchange script. Skipping this broadcast (the events carry over to the next one).')); return false; }
    if (fictional && sid && date) radio.dailyDate.set(sid, date);
    if (recap) radio.recapSig.set(sid, recapSig); else if (sid) radioAired().mark(sid, taken.map((e) => e.id ?? '').filter(Boolean));
    for (const l of lines) radioRecent.push(`${names[l.who]}: ${l.text}`); if (radioRecent.length > 12) radioRecent.splice(0, radioRecent.length - 12);
    if (revision === ctx.mediaRevision) radio.history.set(historyKey, radioRecent);
    safeSend(radio.win, 'radioBroadcast', { date, lines, station: station.name, parent: station.parent, format, names, fictional, crisis: !!crisis.directive });
    return true;
  } catch (e) { restore(); if (radio.on && session === radio.session) safeSend(radio.win, 'radioError', redactKey((e as Error).message)); return false; }
  finally { radio.busy = false; radio.lastEnd = Date.now(); safeSend(radio.win, 'radioWorking', false); }
}
export function setRadio(on: boolean) {
  if (on === radio.on) return;
  radio.on = on; radio.session++;
  if (on) {
    radio.q.clear(); radio.idleSent = false; syncRadioChron(); fillRadioBacklog(); openRadioWin(); scheduleRadio(); // 켤 때 비우기만 하던 것을 최근 1년의 미방송 사건으로 채운다(F-03)
  } else {
    if (radio.timer) { clearTimeout(radio.timer); radio.timer = null; }
    radio.q.clear(); if (radio.win && !radio.win.isDestroyed()) radio.win.close(); radio.win = null;
  }
  pushRadioState();
}
let lastAutoMoveR = 0, userMoveR = 0, radioBorn = 0, lastRadioAuto = { x: -99999, y: -99999 };
/** 라디오 창 자리: 오버레이 아이콘 바로 옆(아이콘이 오른쪽이면 그 왼쪽). 대화창이 겹치면 그 위. 사용자가 옮긴 자리가 있으면 그 자리를 쓴다. */
export function placeRadio() {
  if (!radio.win || radio.win.isDestroyed() || !radio.win.isVisible() || !ctx.gameDip || Date.now() - userMoveR < 1500) return;
  const [w, h] = radio.win.getSize(), sc = ctx.curScale || 1, gap = Math.round(8 * sc), g = ctx.gameDip;
  let x: number, y: number;
  if (settings.radioDockPos) { x = g.x + settings.radioDockPos.fx * g.width; y = g.y + settings.radioDockPos.fy * g.height; }
  else {
    // 아이콘 창이 숨겨져 있어도(게임이 앞에 없을 때 등) 설정된 아이콘 자리를 기준으로 삼는다
    const L = ctx.launcher && !ctx.launcher.isDestroyed() ? ctx.launcher.getBounds() : launcherRect(g, { width: Math.round(ctx.BASE_ICON.width * sc), height: Math.round(ctx.iconBaseHeight() * sc) }, settings.launcherCorner, settings.launcherPos, sc), onRight = L.x + L.width / 2 > g.x + g.width / 2;
    x = onRight ? L.x - w - gap : L.x + L.width + gap; y = L.y + L.height - h;
    if (ctx.win && !ctx.win.isDestroyed() && ctx.win.isVisible()) { const C = ctx.win.getBounds(); if (x < C.x + C.width && x + w > C.x && y < C.y + C.height && y + h > C.y) y = C.y - h - gap; }
  }
  x = Math.round(Math.min(Math.max(x, g.x), g.x + g.width - w)); y = Math.round(Math.min(Math.max(y, g.y + Math.round(72 * sc)), g.y + g.height - h));
  const b = radio.win.getBounds();
  if (Math.abs(b.x - x) > 1 || Math.abs(b.y - y) > 1) { lastAutoMoveR = Date.now(); lastRadioAuto = { x, y }; radio.win.setPosition(x, y); }
}
export function openRadioWin() {
  if (radio.win && !radio.win.isDestroyed()) { radio.win.showInactive(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  // 기존 대화창과 같은 쪽(오른쪽)에 둔다. 왼쪽은 스텔라리스의 중요한 화면이 많아 가리지 않는다. 위쪽 자원 막대 아래에서 시작하고, 대화창이 열려 있으면 그 위까지만 쓴다.
  const sc = ctx.curScale || 1, top = area.y + Math.round(72 * sc), side = settings.dock === 'left' ? 'left' : 'right';
  const chatTop = ctx.win && !ctx.win.isDestroyed() && ctx.win.isVisible() ? ctx.win.getBounds().y : area.y + area.height;
  const width = Math.round(680 * sc), height = Math.max(Math.round(230 * sc), Math.min(Math.round(260 * sc), chatTop - top - 8));
  const ix = side === 'right' ? area.x + area.width - width - Math.round(16 * sc) : area.x + Math.round(16 * sc);
  radio.win = new BrowserWindow({ width, height, x: ix, y: top, minWidth: 560, minHeight: 210, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, skipTaskbar: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  radioBorn = Date.now(); lastRadioAuto = { x: -99999, y: -99999 };
  radio.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void radio.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'radio.html'));
  radio.win.once('ready-to-show', () => { radio.win?.showInactive(); pushRadioState(); placeRadio(); });
  let saveR: ReturnType<typeof setTimeout> | null = null;
  radio.win.on('move', () => {
    const nb = radio.win ? radio.win.getBounds() : null;
    // 창을 만들고 자리를 잡는 동안, 그리고 앱이 둔 자리(±3px)에서 일어난 이동은 사용자가 끈 것이 아니다
    if (!nb || Date.now() - lastAutoMoveR < 400 || Date.now() - radioBorn < 2500 || (Math.abs(nb.x - lastRadioAuto.x) <= 3 && Math.abs(nb.y - lastRadioAuto.y) <= 3)) return;
    userMoveR = Date.now(); if (saveR) clearTimeout(saveR);
    saveR = setTimeout(() => { if (!radio.win || radio.win.isDestroyed() || !ctx.gameDip) return; settings.radioDockPos = toFrac(radio.win.getBounds(), ctx.gameDip); saveSettings(); }, 400);
  });
  radio.win.on('closed', () => { radio.win = null; if (radio.on) setRadio(false); }); // 창을 닫으면 라디오도 꺼진다
}

export function registerRadio(): void {
  ipcMain.handle('radioGet', async () => radioState());
ipcMain.handle('radioSelect', async (_e, id: unknown) => {
  if (!radioStationViews().some((s) => s.id === id)) return { ok: false, error: pick('알 수 없는 방송사입니다.', 'Unknown station.'), state: radioState() };
  if (radio.busy) return { ok: false, error: pick('방송 준비가 끝난 뒤 방송사를 바꿀 수 있습니다.', 'You can change stations after the broadcast is prepared.'), state: radioState() };
  settings.radioStation = radioStation(id).id; saveSettings(); pushRadioState();
  return { ok: true, state: radioState() };
});
ipcMain.handle('radioOff', async () => { setRadio(false); return true; });
ipcMain.handle('radioNow', async () => { // A-15 지금 듣기: 2분 주기를 기다리지 않고 한 편 방송한 뒤 주기를 처음부터 다시 센다
  const why = radioNowBlock({ on: radio.on, busy: radio.busy, gameRunning: gameLive(), lastEnd: radio.lastEnd, now: Date.now() });
  if (why) return { ok: false, error: why, state: radioState() };
  const session = radio.session;
  if (radio.timer) { clearTimeout(radio.timer); radio.timer = null; }
  try { await radioTick(true); } finally { if (radio.on && session === radio.session) scheduleRadio(); }
  return { ok: true, state: radioState() };
});
}
