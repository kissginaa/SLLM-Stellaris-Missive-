// 시민 청원(앱 쪽, 2026-10-19). 순수 로직은 src/petition.ts, 화면은 ui/office-petition.js(집무실 바탕화면 「시민 청원」).
// 2026-10-31 사용자 결정: 저절로 도착·알림은 없앰 — 집무실 「시민 청원」에서 「시민 청원 받기」를 누르면 한 통(답하지 않은 청원은 최대 3통). 매달 상황은 오래된 청원 만료·건설 과제 확인에만 씀.
// 아주 가끔(10%)은 건설 과제 청원: 받아들이면 그 행성에 해당 건물이 늘었는지 3개월마다 확인해 보상(안정도·행복·산출 +5% 중 하나), 2년 기한. 플레이어가 화면을 열 때 행성 목록을 읽어(총독 화면과 같은 명령) 청원서를 AI 로 쓴다.
// 수락·거절은 그 순간 행성 목록을 다시 읽어 순서 번호를 찾고 콘솔 명령(PETITIONAPPLY 응답)으로 건다. 군체·기계 제국에는 오지 않는다.
// 저장: sllm_petitions.json { saves: { [세이브]: PetSave } }.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { featureOff } from '../app/feature-gate';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { terminalRequest, terminalReplies } from './terminal';
import { refreshPlanets } from './gov';
import { onGameSnapshot } from './gamestate-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { moodNudge } from './mood-app';
import type { Planet } from '../planets';
import { type PetSave, type Petition, emptyPet, petitionTick, pickPetitionPlanet, pickPetitionTopic, petitionMessages, cleanPetText, readPetition, petitionTextOk, petitionApplyCommand, PETITION_TOPICS,
  BUILD_TASKS, TASK_REWARDS, TASK_CHANCE, TASK_MONTHS, pickTaskCat, pickReward, taskPetitionMessages, petitionCountCommand, taskRewardCommand, taskDue, taskOverdue, addMonthsP, PET_MAX_PENDING } from '../petition';

const L = pick;
let data: { saves: Record<string, PetSave> } | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_petitions.json');
function all(): { saves: Record<string, PetSave> } {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'petitions', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'petitions', error: e }); } }
const petOf = (sid: string): PetSave => { const s = (all().saves[sid] ??= emptyPet()); s.items ??= []; s.pending ??= 0; s.next ??= 1; s.due ??= ''; return s; };
let busy = false, snapGestalt = false;

/** 화면에 보낼 상태(주제·효과·비용은 한/영 둘 다 골라서). */
export function petitionView() {
  const sid = ctx.curSaveId; if (!sid) return { sid: '', open: [], history: [], pending: 0, unread: 0 };
  const s = petOf(sid);
  const row = (p0: Petition) => {
    // 예전에 끊긴 JSON 그대로 저장된 청원(2026-10-19 이전)은 보여 줄 때 살린다. 살릴 본문이 없으면 안내 한 줄.
    let p = p0; if (/^\s*\{|"(title|text)"\s*:/.test(p.text)) { const r = readPetition(p.text); p = { ...p, title: (r.title || p.title).slice(0, 80), text: r.text || L('(청원서 본문이 전송 중에 끊겨 읽을 수 없습니다.)', '(The petition text was cut off in transmission.)') }; }
    if (p.task) { const b = BUILD_TASKS[p.task.cat], rw = TASK_REWARDS[p.task.reward]; return { id: p.id, planet: p.planet, topic: L(b.ko, b.en), title: p.title, text: p.text, date: p.date, state: p.state, decided: p.decided ?? '', eff: L(rw.ko, rw.en), res: '', amt: 0, task: true, until: p.task.until ?? '' }; }
    const t = PETITION_TOPICS[p.topic]; return { id: p.id, planet: p.planet, topic: L(t.ko, t.en), title: p.title, text: p.text, date: p.date, state: p.state, decided: p.decided ?? '', eff: L(t.effKo, t.effEn), res: t.res, amt: t.amt, task: false, until: '' };
  };
  const open = s.items.filter((p) => p.state === 'open');
  const working = s.items.filter((p) => p.state === 'working');
  return { sid, open: open.map(row), working: working.map(row), history: s.items.filter((p) => p.state !== 'open' && p.state !== 'working').slice(-12).reverse().map(row), pending: 0, canFetch: open.length < PET_MAX_PENDING, max: PET_MAX_PENDING, unread: open.length };
}
/** 집무실 아이콘 숫자(도착했지만 아직 읽지 않은 것 + 답하지 않은 것). */
export const petitionUnread = (): number => petitionView().unread;

function onSnapshot(snap: { sid: string; date: string; gestalt?: boolean }): void {
  if (featureOff('petition')) return; // 시나리오에서 잠기면 쉰다(2026-11-08)
  if (!snap.sid || snap.sid !== ctx.curSaveId) return; snapGestalt = !!snap.gestalt; if (snap.gestalt) return; // 군체·기계 제국에는 시민 청원이 없다
  const s = petOf(snap.sid); const before = JSON.stringify(s);
  s.pending = 0; petitionTick(s, snap.date, () => 1); // 만료만(저절로 도착 없음·알림 없음, 2026-10-31)
  if (JSON.stringify(s) !== before) save();
  if (s.items.some((p) => p.state === 'working' && p.task && taskDue(p.task, snap.date))) void checkTasks(snap.sid, snap.date);
}
async function planetsNow(): Promise<{ list: Planet[] } | { error: string }> {
  if (!ctx.gameRunning) return { error: L('게임이 켜져 있어야 행성 사정을 읽을 수 있습니다.', 'The game must be running to read your planets.') };
  const r = await refreshPlanets() as { list?: { planets: Planet[] }; error?: string };
  return r.list ? { list: r.list.planets } : { error: r.error || L('행성 목록을 읽지 못했습니다.', 'Could not read the planet list.') };
}

/** 건설 과제: 그 행성에 그 범주 건물이 몇 종류 있는지(게임에 묻기). */
async function countBuildings(sid: string, planet: string, cat: Parameters<typeof petitionCountCommand>[3]): Promise<{ count: number } | { error: string }> {
  const pl = await planetsNow(); if ('error' in pl) return { error: pl.error };
  const k = pl.list.findIndex((x) => x.name === planet) + 1;
  if (k < 1) return { error: L(`「${planet}」 행성을 찾지 못했습니다(잃었거나 이름이 바뀜).`, `Could not find planet "${planet}" (lost or renamed).`) };
  const req = ++link.reqCounter; const m = await terminalRequest(petitionCountCommand(req, sid, k, cat), 'PETITIONCHECK', req);
  if (m.kv.status !== 'ok') return { error: L('게임에서 그 행성을 찾지 못했습니다.', 'The game could not find that planet.') };
  const n = Number(m.kv.count); return { count: Number.isFinite(n) ? n : 0 };
}
async function planetIndex(planet: string): Promise<number> { const pl = await planetsNow(); return 'error' in pl ? 0 : pl.list.findIndex((x) => x.name === planet) + 1; }
/** 진행 중 건설 과제 확인(매달 상황이 올 때, 3개월마다·기한에): 지었으면 보상, 기한을 넘기면 실패(행복 −2% 1년). */
async function checkTasks(sid: string, date: string, onlyId?: number): Promise<string> {
  if (busy || !ctx.gameRunning) return '';
  busy = true; let note = '';
  try {
    const s = petOf(sid);
    for (const p of s.items.filter((x) => x.state === 'working' && x.task && (onlyId === undefined ? taskDue(x.task, date) : x.id === onlyId))) {
      const task = p.task!; const c = await countBuildings(sid, p.planet, task.cat);
      if ('error' in c) { note = c.error; if (taskOverdue(task, date)) { p.state = 'failed'; p.decided = date; } continue; }
      task.checked = date;
      if (c.count > (task.base ?? 0)) {
        const k = await planetIndex(p.planet), req = ++link.reqCounter;
        const m = k ? await terminalRequest(taskRewardCommand(req, sid, k, task.reward), 'PETITIONAPPLY', req) : null;
        if (m?.kv.status === 'applied') {
          p.state = 'done'; p.decided = date; const rw = TASK_REWARDS[task.reward];
          moodNudge(PETITION_MOOD, L(`「${p.planet}」 주민 청원 해결`, `Resolved the petition of "${p.planet}"`)); // 17: 완료 조건이 있는 청원을 이루면 플레이어 민심 상승(수락만으로는 아님). 수치는 초기 조정값
          chronNoteWorld(L(`${p.planet} 주민들이 청원한 건물(${BUILD_TASKS[task.cat].ko.replace(' 짓기', '')})이 세워졌다. 주민들이 기뻐한다.`, `The building the citizens of ${p.planet} petitioned for (${BUILD_TASKS[task.cat].en.replace(/^Build (an? )?/, '')}) has been built. The citizens rejoice.`), true);
          (office as { toastGo: string }).toastGo = 'petition';
          ctx.notify({ kind: 'office', title: L('청원 과제 완수', 'Petition fulfilled'), body: L(`「${p.planet}」 주민들이 약속을 지킨 통치자에게 감사합니다: ${rw.ko}(2년).`, `The citizens of "${p.planet}" thank you for keeping your word: ${rw.en} (2 years).`), action: L('집무실', 'Office') });
          note = L('과제를 완수했습니다.', 'Task fulfilled.');
        }
      } else if (taskOverdue(task, date)) {
        const k = await planetIndex(p.planet), req = ++link.reqCounter;
        if (k) await terminalRequest(petitionApplyCommand(req, sid, k, false, p.topic), 'PETITIONAPPLY', req).catch(() => null); // 기한을 넘김 = 거절과 같은 실망
        p.state = 'failed'; p.decided = date;
        chronNoteWorld(L(`${p.planet} 주민들이 청원한 건물은 끝내 세워지지 않았다.`, `The building the citizens of ${p.planet} petitioned for was never built.`), true);
        note = L('기한이 지나 과제를 이루지 못했습니다.', 'The deadline passed without the building.');
      } else note = L(`아직 지어지지 않았습니다(기한 ${task.until}).`, `Not built yet (deadline ${task.until}).`);
    }
    save();
  } catch (e) { logDiagnostic('warn', 'petition.task_check_failed', { error: String(e) }); note = (e as Error).message; }
  finally { busy = false; }
  return note;
}

/** 청원 과제 완수 → 플레이어 민심(17). 문서상 수치 미정 → 초기 조정값. */
export const PETITION_MOOD = 5;
export function registerPetitions(router: LogRouter): void {
  registerSecFacts({ id: 'Citizens\' petitions', kw: ['청원', 'petition'], facts: (sid) => { const s = petOf(sid), open = s.items.filter((p) => p.state === 'open'), work = s.items.filter((p) => p.state === 'working'), past = s.items.filter((p) => p.state !== 'open' && p.state !== 'working').slice(-5);
    return [`Unanswered petitions: ${open.length}${open.length ? ' — ' + open.map((p) => `${p.planet}: "${p.title}"`).join('; ') : ''}.`, ...(work.length ? ['Building tasks in progress: ' + work.map((p) => `${p.planet} until ${p.task?.until ?? '?'}`).join('; ')] : []), ...(past.length ? ['Recent outcomes: ' + past.map((p) => `${p.planet} ${p.state}`).join('; ')] : [])]; } }); // 비서가 아는 기록(2026-10-31)
  router.on(SLOT.PETITION, 'petition:apply', (m: SllmMessage) => { if (m.kind === 'PETITIONAPPLY') terminalReplies.get('PETITIONAPPLY:' + m.kv.req)?.(m); else if (m.kind === 'PETITIONCHECK') terminalReplies.get('PETITIONCHECK:' + m.kv.req)?.(m); });
  onGameSnapshot(onSnapshot);
  ipcMain.handle('petitionState', async () => petitionView());
  // 도착한 청원 하나를 연다: 행성 목록을 읽어 행성·주제를 고르고 청원서를 쓴다.
  ipcMain.handle('petitionFetch', async () => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤 볼 수 있습니다.', 'Load a save first.'), state: petitionView() };
    if (snapGestalt) return { ok: false, error: L('군체·기계 제국에는 시민 청원이 없습니다.', 'Hive minds and machine empires have no citizens\' petitions.'), state: petitionView() };
    const s = petOf(sid); if (s.items.filter((x) => x.state === 'open').length >= PET_MAX_PENDING) return { ok: false, error: L(`답하지 않은 청원이 ${PET_MAX_PENDING}통 있습니다. 먼저 답해 주세요.`, `You have ${PET_MAX_PENDING} unanswered petitions. Answer them first.`), state: petitionView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working on it.'), state: petitionView() };
    busy = true;
    try {
      const pl = await planetsNow(); if ('error' in pl) return { ok: false, error: pl.error, state: petitionView() };
      const p = pickPetitionPlanet(pl.list, s.items.filter((x) => x.state === 'open').map((x) => x.planet));
      if (!p) return { ok: false, error: L('청원을 올릴 행성이 없습니다.', 'No planet to send a petition.'), state: petitionView() };
      const date = ctx.gameDate || '', isTask = Math.random() < TASK_CHANCE; // 아주 가끔 건설 과제
      const cat = isTask ? pickTaskCat(p) : null, topic = cat ? BUILD_TASKS[cat].topic : pickPetitionTopic(p);
      const msgs = cat ? taskPetitionMessages({ empire: ctx.playerName, ruler: '', date, planet: p, cat }) : petitionMessages({ empire: ctx.playerName, ruler: '', date, planet: p, topic });
      // 2026-10-19 집 PC 실기: 답이 JSON 중간에서 끊겨 `{ "title": …, "text` 가 본문으로 저장됐다. 끊긴 JSON 도 살리고, 본문이 모자라면 한 번 더 묻는다.
      let got = readPetition(await ctx.ai.chat(msgs, { maxTokens: 1600 }));
      if (!petitionTextOk(cleanPetText(got.text, 1400))) { const again = readPetition(await ctx.ai.chat(msgs, { maxTokens: 1600 })); if (petitionTextOk(cleanPetText(again.text, 1400)) || !got.text) got = again; }
      const text = petitionTextOk(cleanPetText(got.text, 1400)) ? cleanPetText(got.text, 1400) : '', title = cleanPetText(got.title, 80) || (cat ? L(BUILD_TASKS[cat].ko, BUILD_TASKS[cat].en) : L(PETITION_TOPICS[topic].ko, PETITION_TOPICS[topic].en));
      if (!text) return { ok: false, error: L('청원서를 읽지 못했습니다. 다시 열어 보세요.', 'Could not read the petition. Try again.'), state: petitionView() };
      if (sid !== ctx.curSaveId) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.'), state: petitionView() };
      s.items.push({ id: s.next++, planet: p.name, topic, title, text, date, state: 'open', ...(cat ? { task: { cat, reward: pickReward() } } : {}) }); s.items = s.items.slice(-40); s.pending = 0; save();
      return { ok: true, state: petitionView() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: petitionView() }; }
    finally { busy = false; }
  });
  // 진행 중 건설 과제를 지금 확인(화면의 「지금 확인」).
  ipcMain.handle('petitionCheck', async (_e, id: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤 확인할 수 있습니다.', 'Load a save first.'), state: petitionView() };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 확인할 수 있습니다.', 'The game must be running to check.'), state: petitionView() };
    const note = await checkTasks(sid, ctx.gameDate || '', Number(id));
    return { ok: true, note, state: petitionView() };
  });
  // 수락·거절: 지금 행성 순서를 다시 읽어 그 행성을 찾고 게임에 건다.
  ipcMain.handle('petitionDecide', async (_e, id: unknown, accept: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤 답할 수 있습니다.', 'Load a save first.'), state: petitionView() };
    const s = petOf(sid), p = s.items.find((x) => x.id === Number(id) && x.state === 'open'); if (!p) return { ok: false, error: L('이미 답한 청원입니다.', 'This petition has already been answered.'), state: petitionView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working on it.'), state: petitionView() };
    busy = true;
    try {
      const pl = await planetsNow(); if ('error' in pl) return { ok: false, error: pl.error, state: petitionView() };
      const k = pl.list.findIndex((x) => x.name === p.planet) + 1;
      if (k < 1) return { ok: false, error: L(`「${p.planet}」 행성을 찾지 못했습니다(잃었거나 이름이 바뀜).`, `Could not find planet "${p.planet}" (lost or renamed).`), state: petitionView() };
      const yes = accept === true, req = ++link.reqCounter;
      if (yes && p.task) { // 건설 과제: 지금 있는 건물 종류 수를 기준으로 적고 2년 동안 지켜본다(자원은 들지 않음)
        const m0 = await terminalRequest(petitionCountCommand(req, sid, k, p.task.cat), 'PETITIONCHECK', req);
        if (m0.kv.status !== 'ok') return { ok: false, error: L('게임에서 그 행성을 찾지 못했습니다. 다시 해 보세요.', 'The game could not find that planet. Try again.'), state: petitionView() };
        const d = ctx.gameDate || ''; p.task.base = Number(m0.kv.count) || 0; p.task.until = addMonthsP(d, TASK_MONTHS); p.task.checked = d;
        p.state = 'working'; p.decided = d; save();
        chronNoteWorld(L(`${p.planet} 주민들의 청원(${BUILD_TASKS[p.task.cat].ko})을 통치자가 받아들였다.`, `The ruler accepted the petition of the citizens of ${p.planet} (${BUILD_TASKS[p.task.cat].en}).`), true);
        return { ok: true, state: petitionView() };
      }
      const m = await terminalRequest(petitionApplyCommand(req, sid, k, yes, p.topic), 'PETITIONAPPLY', req);
      const st = m.kv.status;
      if (st === 'short') { const t = PETITION_TOPICS[p.topic]; return { ok: false, error: L(`자원이 모자랍니다(필요: ${t.amt}).`, `Not enough resources (need ${t.amt}).`), state: petitionView() }; }
      if (st !== 'applied') return { ok: false, error: L('게임에서 그 행성을 찾지 못했습니다. 다시 해 보세요.', 'The game could not find that planet. Try again.'), state: petitionView() };
      p.state = yes ? 'accepted' : 'declined'; p.decided = ctx.gameDate || ''; save();
      chronNoteWorld(yes ? L(`${p.planet} 주민들의 청원(${PETITION_TOPICS[p.topic].ko})을 통치자가 받아들였다.`, `The ruler accepted the petition of the citizens of ${p.planet} (${PETITION_TOPICS[p.topic].en}).`) : L(`${p.planet} 주민들의 청원(${PETITION_TOPICS[p.topic].ko})을 통치자가 거절했다.`, `The ruler rejected the petition of the citizens of ${p.planet} (${PETITION_TOPICS[p.topic].en}).`), true);
      return { ok: true, state: petitionView() };
    } catch (e) { return { ok: false, error: (e as Error).message, state: petitionView() }; }
    finally { busy = false; }
  });
}
