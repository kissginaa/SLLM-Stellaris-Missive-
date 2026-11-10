// A-00b 5번: 행성 총독(앱 쪽) — 총독 창, 행성 목록 요청, 총독 대화, 총독 기억 저장소, IPC 8개.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 순수 로직은 src/planets.ts·src/govmemory.ts. 행성 목록 줄(PLANETS…)은 main.ts 로그 분배(SLOT.PLANETS)에서 gov.collector로 넣는다.
// 총독 대화(실험): 내 행성 목록과 지금 대화의 기록. 대화는 저장하지 않고, 행성을 바꾸거나 세이브가 바뀌면 비운다.
import { glassWin } from '../office';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { writeRawDiagnostic } from '../diagnostics';
import { PlanetCollector, PlanetList, govLooksCut, govMessages, extractGovSay, governorName, DEFAULT_GOVERNOR } from '../planets';
import { GovMemoryStore, govKey, levelOf, LEVELS, cleanMemText } from '../govmemory';
import { planetPicUrlAsync } from '../planetart';
import { planetsEffect } from '../protocol';
import type { ChatMessage } from '../player2';
import { enqueue, sendConsole } from '../app/game-link';
import { ctx } from '../app/ctx';
import { singleFlight } from '../single-flight';
import { bioBlock } from '../persona';
import { pick } from './settings-ui';
const L = pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)

export const gov = {
  win: null as BrowserWindow | null,
  collector: new PlanetCollector(),
  planetList: null as PlanetList | null,
  history: [] as ChatMessage[],
  waiters: [] as ((l: PlanetList) => void)[],
};
let govMemStore: GovMemoryStore | null = null;
/** 총독 답 원문을 최근 30건만 파일에 남긴다(끊김·되풀이 원인을 볼 때 쓴다). */
export function govRawLog(q: string, raw: string, retry: boolean): void {
  writeRawDiagnostic('sllm_govraw.log',new Date().toISOString()+' retry='+retry+'\nQ: '+q.slice(0,200)+'\nlen='+raw.length+'\n'+raw);return;

}
export function govMem(): GovMemoryStore { return (govMemStore ??= new GovMemoryStore(path.join(app.getPath('userData'), 'sllm_gov_memory.json'))); }

// ---- 행성 총독 창: 통신 단말기와 따로 큰 창으로 연다. focus 가 있으면 그 행성의 총독 대화로 바로 들어간다.
export function closeGov() { if (gov.win && !gov.win.isDestroyed()) gov.win.close(); gov.win = null; }
export function openGov(focus?: string, glass = false) {
  const send = () => { if (focus) gov.win?.webContents.send('govFocus', focus); else gov.win?.webContents.send('govInit'); };
  if (gov.win && !gov.win.isDestroyed()) { gov.win.show(); gov.win.focus(); send(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(980, Math.round(area.width * 0.7)), height: Math.min(900, Math.round(area.height * 0.88)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  gov.win = new BrowserWindow({ ...sz, x, y, minWidth: 560, minHeight: 520, frame: false, show: false, backgroundColor: '#06141b', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  gov.win.setAlwaysOnTop(true, 'screen-saver', 1);
  gov.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'gov.html'));
  gov.win.once('ready-to-show', () => { gov.win?.show(); send(); });
  gov.win.on('closed', () => { gov.win = null; });
}

// 총독 기억: 이름이 있는 실제 총독만. 세이브를 되돌려도 남도록 앱 파일에 따로 저장한다.
/** 총독 인물 전기(2026-10-18). backstory-app 이 연결한다(가져오기 순환을 피하려고 여기서 persona-app 을 부르지 않음). */
let govBio: (planet: string) => string = () => '';
export function setGovBio(f: (planet: string) => string): void { govBio = f; }
const govTarget = (index: unknown) => {
  const i = Number(index);
  if (!gov.planetList || !Number.isInteger(i) || !gov.planetList.planets[i]) throw new Error(L('먼저 행성 목록을 읽고 행성을 고르세요.', 'Load the planet list and choose a planet first.'));
  const p = gov.planetList.planets[i]; const name = governorName(p);
  if (name === DEFAULT_GOVERNOR) return { p, name, key: null as string | null };
  return { p, name, key: govKey(gov.planetList.sid || ctx.curSaveId || '', name) };
};
const memView = (key: string | null) => { const v = key ? govMem().view(key) : { own: [], other: [] }; const lv = levelOf(v.own.length + v.other.length); return { enabled: !!key, level: lv, label: LEVELS[lv], items: [...v.own, ...v.other] }; };

export const refreshPlanets = singleFlight(async () => {
    const sid = ctx.curSaveId;
    let waiter: ((l: PlanetList) => void) | null = null, timer: ReturnType<typeof setTimeout> | null = null;
    const wait = new Promise<PlanetList | null>((res) => {
      waiter = (l) => { if (sid && l.sid !== sid) return; if (timer) clearTimeout(timer); res(l); };
      gov.waiters.push(waiter);
      timer = setTimeout(() => { const i = waiter ? gov.waiters.indexOf(waiter) : -1; if (i >= 0) gov.waiters.splice(i, 1); res(null); }, 15000);
    });
    try {
      await enqueue(() => sendConsole(planetsEffect()));
      const l = await wait;
      if (sid && ctx.curSaveId !== sid) return { error: L('세이브가 바뀌었습니다. 현재 세이브에서 다시 읽어 주세요.', 'The save has changed. Reload from the current save.') };
      return l ? { list: l } : { error: L('게임에서 행성 목록이 오지 않았습니다. 게임이 켜져 있고 게임 창이 앞에 있는지, 이 모드가 켜져 있는지 확인하세요.', 'No planet list came from the game. Check that the game is running and in front, and that this mod is enabled.') };
    } catch (e) { return { error: L('게임에 요청을 보내지 못했습니다: ', 'Could not send the request to the game: ') + (e as Error).message }; }
    finally {
      if (timer) clearTimeout(timer);
      const i = waiter ? gov.waiters.indexOf(waiter) : -1;
      if (i >= 0) gov.waiters.splice(i, 1);
    }
});

export function registerGov(): void {
  ipcMain.handle('govRefresh', () => refreshPlanets());
  ipcMain.handle('govReset', async () => { gov.history = []; return true; });
  ipcMain.handle('govMemList', async (_e, a: { index?: unknown }) => memView(govTarget(a?.index).key));
  ipcMain.handle('govMemAdd', async (_e, a: { index?: unknown; text?: unknown }) => {
    const t = govTarget(a?.index); if (!t.key) throw new Error(L('일반 총독관은 기억을 갖지 않습니다.', 'A generic governor\'s office keeps no memories.'));
    govMem().add(t.key, cleanMemText(a?.text), ctx.gameDate); return memView(t.key);
  });
  ipcMain.handle('govMemDel', async (_e, a: { index?: unknown; id?: unknown }) => {
    const t = govTarget(a?.index); if (!t.key) return memView(null);
    govMem().remove(t.key, Number(a?.id)); return memView(t.key);
  });
  ipcMain.handle('govChat', async (_e, a: { index?: unknown; text?: unknown }) => {
    ctx.needPaused();
    const text = typeof a?.text === 'string' ? a.text.trim().slice(0, 600) : '';
    const t = govTarget(a?.index);
    if (!text) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
    const mv = t.key ? govMem().view(t.key) : null;
    const msgs = govMessages(gov.planetList!, t.p, '', gov.history, text, mv ? mv.own : undefined, mv ? mv.other : undefined);
    { const bio = bioBlock({ bio: govBio(t.p.name) }); if (bio && msgs[0]?.role === 'system') msgs[0] = { ...msgs[0], content: msgs[0].content + '\n' + bio }; } // 인물 전기(2026-10-18)
    let cut = false;
    let raw = await ctx.ai.session(async (chat) => {
    let raw = await chat(msgs, { maxTokens: 1500 });
    govRawLog(text, raw, false);
    cut = govLooksCut(raw);
    if (cut) { // 중간에 끊긴 답은 한 번 더 받는다(더 넉넉한 한도로, 끝까지 쓰라고 일러서). 같은 연결로 받는다.
      raw = await chat([...msgs, { role: 'user', content: '[System notice] Your last reply was cut off. Say the same thing again in two or three sentences, finishing every sentence.' }], { maxTokens: 2500 });
      govRawLog(text, raw, true); cut = govLooksCut(raw);
    }
    return raw; });
    const ex = extractGovSay(raw); let say = ex.say; let memo = '';
    if (cut) say = say.replace(/\s*…\((?:잘림|cut off)\)\s*$/, '') + L(' …(끊김)', ' …(cut off)');
    if (t.key && ex.memo) memo = cleanMemText(ex.memo);
    if (!cut) gov.history.push({ role: 'user', content: text }, { role: 'assistant', content: say }); // 끊긴 답은 기록에 남기지 않는다(다음 답이 같은 앞머리를 되풀이하지 않도록)
    return { say, ...(memo ? { memo } : {}) };
  });
  ipcMain.handle('planetArt', async (_e, pc: unknown) => planetPicUrlAsync(ctx.flagProv.game(), Number(pc))); // 작업 스레드(2026-10-27)
  ipcMain.handle('govClose', async () => { closeGov(); return true; });
}
