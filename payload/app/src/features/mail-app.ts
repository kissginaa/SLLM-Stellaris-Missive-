// A-00b 6번: 외교 서신(앱 쪽) — 서신 후보 수집(MAILC·YEAR·YEAREND), 세계 사건(NEWS), AI가 먼저 보내는 편지, 조약 보류 서신,
// 서신함(inbox·openLetter), 서신·소문 자동 작업 타이머(aiTick). 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// onMailSignal 은 플레이어 이름·번호(IDX)와 게임 날짜(MONTH·YEAR)도 정한다 — 원래 한 함수였던 그대로 옮겼다(SLOT.MAIL).
// 답장(replyLetter)은 단말기를 옮길 때 같이 옮겼다(단말기 연결 dialTerminal 을 쓰고, 대화 상태는 ctx 로 바꾼다).
import { app, ipcMain } from 'electron';
import * as path from 'path';
import { DeferredStore, LEAN_KO } from '../deferred';
import { InboxStore, SavedLetter } from '../inbox-store';
import { mailCountryFrom, newsFrom, pickMessages, parsePick, letterMessages, treatyLetterMessages, MailPlan, MailCountry, News, Letter, LETTER_ACTIONS, addYears, cmpDate, newsText, MAJOR_WORLD, NOT_ON_RADIO, SOLO_NEWS, knownEmpire, GALAXY_WIDE } from '../mail';
import { parseReply } from '../action';
import type { Profile } from '../prompt';
import type { SllmMessage } from '../protocol';
import { RADIO_IDX } from '../chronicle';
import { settings } from '../app/settings';
import { LogRouter, SLOT } from '../app/log-router';
import { chronNote, chronPut, chronNoteByName, chronNoteWorld, idxNames } from './chronicle-app';
import { radio, radioAired } from './radio-app';
import { currentPaper, publishNews, makeGossip, noteExtra, publishExtra } from './media';
import { speechStore, pushSpeech } from './speech-app';
import { describe } from '../action';
import { link } from '../app/game-link';
import { terminalRequest, dialTerminal, terminal } from './terminal';
import { ctx } from '../app/ctx';
import { pick } from './settings-ui';

export const mail = {
  /** 최근 사건(편지 재료). 2년이 지나면 버린다. */
  news: [] as News[],
  /** 올해 연락 중인 제국들(YEAR ~ YEAREND 사이에 모은다) */
  roll: [] as MailCountry[],
  rollDate: '',
  plan: new MailPlan(),
  /** 서신 후보 제국(MAILC) */
  countries: new Map<number, MailCountry>(),
  /** 지금 세이브·시간선의 서신함 */
  inbox: [] as SavedLetter[],
  /** 답장 연결 중 */
  replyBusy: false,
};

let deferStore: DeferredStore | null = null;
export function deferred(): DeferredStore { return (deferStore ??= new DeferredStore(path.join(app.getPath('userData'), 'sllm_deferred.json'))); }

let inboxStoreInst: InboxStore | null = null;
export const inboxStore = () => (inboxStoreInst ??= new InboxStore(path.join(app.getPath('userData'), 'sllm_inbox.json')));
export function syncInbox(): void {
  mail.inbox = ctx.curSaveId ? ctx.govMem().split(ctx.curSaveId, inboxStore().list(ctx.curSaveId)).own : [];
  ctx.toUi('inboxState', mail.inbox); ctx.updateBadge();
  if (inboxStore().error) mailNote(pick('편지 저장 오류: ', 'Letter storage error: ') + inboxStore().error);
}
export function receiveLetter(sid: string, branch: number, letter: Omit<Letter, 'id'>): void {
  const saved = inboxStore().add(sid, branch, letter);
  if (sid !== ctx.curSaveId) return;
  syncInbox(); ctx.toUi('mail', saved);
  ctx.notify({ kind: 'letter', title: pick('외교 서신 도착', 'Diplomatic letter received'), body: pick(saved.name + '에게서 편지가 왔습니다.', `A letter has arrived from ${saved.name}.`) });
}
const LEAN_EN: Record<string, string> = { positive: 'favorable', neutral: 'undecided', negative: 'unfavorable' };
export function mailNote(text: string) { ctx.toUi('mailstatus', text); }
export async function pickWriters() {
  if (!settings.mailEnabled || !mail.roll.length) return;
  const sid = ctx.curSaveId, date = mail.rollDate, list = mail.roll.slice();
  try {
    const raw = await ctx.ai.chat(pickMessages(ctx.playerName || pick('플레이어 제국', 'Player empire'), date, list, mail.news, currentPaper()), { maxTokens: 600 });
    const writers = parsePick(raw, list.map((c) => c.idx));
    if (sid !== ctx.curSaveId) return;
    mail.plan.set(date, writers);
    mailNote(pick(`${date}: 올해 편지를 보낼 제국 ${writers.length}곳을 정했습니다.`, `${date}: chose ${writers.length} empire(s) to write letters this year.`));
  } catch (e) { mailNote(pick('편지 상대 고르기 실패: ', 'Failed to choose letter writers: ') + (e as Error).message); }
}
export async function writeLetter(idx: number, why: string) {
  const c = mail.countries.get(idx);
  if (!c || !settings.mailEnabled || !ctx.curSaveId) return;
  const sid = ctx.curSaveId, branch = ctx.govMem().currentBranch(sid), date = ctx.gameDate;
  try {
    const raw = await ctx.ai.chat(letterMessages(ctx.playerName || pick('플레이어 제국', 'Player empire'), date, {...c,profile:ctx.profileWithEthics(c.profile,idx)!}, why, mail.news, currentPaper()), { maxTokens: 1200 });
    const r = parseReply(raw);
    if (!r.say) return;
    const proposal = ctx.actionsAllowed(idx) && r.action && LETTER_ACTIONS.has(r.action.type) ? r.action : null;
    receiveLetter(sid, branch, { idx, name: c.name, date, text: r.say, proposal, expires: addYears(date, 2), read: false });
  } catch (e) { mailNote(pick(`${c.name}의 편지 쓰기 실패: `, `Failed to write ${c.name}'s letter: `) + (e as Error).message); }
}
/** 조약 얼버무리기: 약속한 서신을 보낸다(편지 기능을 꺼 두어도 보낸다. 플레이어가 직접 청한 일에 대한 답이다). */
export async function writeTreatyLetter(d: { due: string; idx: number; name: string; topic: string; lean: 'positive' | 'neutral' | 'negative'; op: number; profile?: Profile }) {
  if (!ctx.curSaveId) return;
  const sid = ctx.curSaveId, branch = ctx.govMem().currentBranch(sid);
  const known = mail.countries.get(d.idx);
  const prof = d.profile ?? known?.profile ?? ctx.profiles.get(d.idx);
  if (!prof) return;
  const c: MailCountry = { idx: d.idx, name: d.name, op: d.op, profile: ctx.profileWithEthics(prof,d.idx)! };
  try {
    const raw = await ctx.ai.chat(treatyLetterMessages(ctx.playerName || pick('플레이어 제국', 'Player empire'), d.due, c, d.topic, d.lean, mail.news), { maxTokens: 1200 });
    const r = parseReply(raw);
    if (!r.say) return;
    receiveLetter(sid, branch, { idx: d.idx, name: d.name, date: d.due, text: r.say, proposal: null, expires: addYears(d.due, 2), read: false });
    if (sid === ctx.curSaveId) chronNote(d.idx, pick('"' + d.topic + '" 건을 서신으로 답했다(결론: ' + LEAN_KO[d.lean] + ')', 'Answered "' + d.topic + '" by letter (conclusion: ' + LEAN_EN[d.lean] + ')'));
  } catch (e) { mailNote(pick(`${d.name}의 서신 쓰기 실패: `, `Failed to write ${d.name}'s letter: `) + (e as Error).message); }
}
export function onMailSignal(m: SllmMessage) {
  if (m.kind === 'IDX' && m.kv.name) { const ii = Number(m.kv.idx); if (Number.isFinite(ii) && ii > 0) idxNames.set(ii, m.kv.name.slice(0, 60)); }
  if (m.kind === 'IDX' && m.kv.rel === 'self' && m.kv.name) { ctx.playerName = m.kv.name; const pi = Number(m.kv.idx); if (Number.isFinite(pi) && pi > 0) ctx.playerIdx = pi; }
  if ((m.kind === 'MONTH' || m.kind === 'YEAR') && m.kv.date) { if (m.kind === 'MONTH') ctx.onMonthTick(); ctx.gameDate = m.kv.date; if (ctx.curSaveId) { ctx.govMem().track(ctx.curSaveId, ctx.gameDate); if (m.kind === 'MONTH') ctx.govMem().noteMonth(ctx.curSaveId, m.kv.tl, ctx.gameDate); } void publishExtra(m.kv.date); }
  const n = newsFrom(m);
  if (n) {
    mail.news.push(n);
    // 우리가 끼지 않은 일인데 둘 다 모르는(통신 없는) 나라면 신문·라디오·호외에 싣지 않는다(2026-11-10). 위기·은하 공동체처럼 온 은하가 아는 일은 예외
    const mine = ctx.playerIdx > 0 && (n.a === ctx.playerIdx || n.b === ctx.playerIdx) || (!!ctx.playerName && (n.aname === ctx.playerName || n.bname === ctx.playerName));
    const unknown = !mine && !GALAXY_WIDE.has(n.kind) && !knownEmpire(n.a, n.aname, mail.countries, terminal.all) && !knownEmpire(n.b, n.bname, mail.countries, terminal.all);
    if (!unknown) {
    noteExtra(n.kind, n.date || ctx.gameDate, newsText(n)); // 호외 후보(큰 사건)
    { // 성간 라디오: 세계 사건(NEWS)도 라디오 연대기와 대기열에 넣는다(F-03)
      const text = newsText(n), date = n.date || ctx.gameDate, uid = ['news', n.kind, date, n.a ?? n.aname ?? '', n.b ?? n.bname ?? '', n.war ?? '', n.planet ?? ''].join('|');
      if (!NOT_ON_RADIO.has(n.kind)) chronPut(RADIO_IDX, date, text, false, { name: '성간라디오 전용 연대기', world: true, uid });
      if (radio.on && !NOT_ON_RADIO.has(n.kind) && !radioAired().has(ctx.curSaveId, uid) && radio.q.push({ kind: 'news_' + n.kind, date, text, n: 0, id: uid })) radio.win?.webContents.send('radioQueue', radio.q.size);
    }
    { // 연대기: 플레이어와 AI 사이의 일, 또는 그 AI 의 새 지도자
      const ev = newsText(n);
      const other = (x: number | undefined) => x !== undefined && x > 0 && x !== ctx.playerIdx;
      if (ctx.playerIdx > 0 && (n.a === ctx.playerIdx || n.b === ctx.playerIdx)) { const o = n.a === ctx.playerIdx ? n.b : n.a; if (other(o)) chronNote(o as number, ev); else if (SOLO_NEWS.has(n.kind) && n.kind !== 'ruler') chronNoteWorld(ev); } // 우리 나라 혼자 나오는 큰 일(거대 구조물·정부 개편 등)은 세계 소식으로
      else if (n.kind === 'ruler' && other(n.a)) chronNote(n.a as number, ev, false, true);
      else if (MAJOR_WORLD.has(n.kind)) { // AI 끼리는 큰 사건(전쟁·연방·연합·협정·위기·멸망·조공국화)만 남긴다. 번호가 없으면 이름으로, 그것도 없으면 세계 소식으로
        let put = false;
        for (const [x, nm] of [[n.a, n.aname], [n.b, n.bname]] as Array<[number | undefined, string | undefined]>) { if (x !== undefined && x > 0) { chronNote(x, ev, false, true); put = true; } else if (nm && chronNoteByName(nm, ev)) put = true; }
        if (!put) chronNoteWorld(ev);
      }
    }
    }
    if (ctx.gameDate) mail.news = mail.news.filter((x) => !x.date || cmpDate(x.date, addYears(ctx.gameDate, -2)) >= 0);
  }
  if (m.kind === 'YEAR') { mail.roll = []; mail.rollDate = m.kv.date ?? ''; if (m.kv.date) void publishNews(m.kv.date); }
  const c = mailCountryFrom(m);
  if (c) { mail.roll.push(c); mail.countries.set(c.idx, c); }
  if (m.kind === 'YEAREND') void pickWriters();
  if (m.kind === 'MONTH' && m.kv.date && ctx.curSaveId) { for (const d of deferred().due(ctx.curSaveId, m.kv.date)) void writeTreatyLetter(d); }
  if (m.kind === 'MONTH' && m.kv.date && ctx.curSaveId) {
    const sid = ctx.curSaveId, justReady = speechStore().tick(sid, m.kv.date);
    // 10-15: 이미 준비가 끝난 채로 불러온 세이브도 앱을 켠 뒤 첫 월 신호에 한 번 알린다.
    if (justReady || (speechStore().get(sid).phase === 'ready' && speechReadyNotified !== sid)) { speechReadyNotified = sid; ctx.notify({ kind: 'speech', title: pick('연설 준비 완료', 'Speech ready'), body: pick('연설 준비가 완료되었습니다. 연설 하시겠습니까?', 'Your speech is ready. Will you give it now?'), action: pick('연설하기', 'Give speech') }); pushSpeech(); }
  }
}
let speechReadyNotified = '';

/** 실시간 타이머로 AI 가 먼저 하는 일(서신)을 하나씩 처리한다. 앱이 열려 있는 동안은 게임이 멈춘 것으로 보고 쉰다. */
let aiBusy = false;
export async function aiTick() {
  if (aiBusy || ctx.appOpen || !ctx.gameRunning || !ctx.curSaveId) return;
  aiBusy = true;
  try {
    const w = settings.mailEnabled ? mail.plan.takeOne() : null;
    if (w) await writeLetter(w.idx, w.why);
    else if (settings.gossipOn) await makeGossip();
  } catch (e) { mailNote(pick('AI 자동 작업 실패: ', 'Automatic AI task failed: ') + (e as Error).message); } finally { aiBusy = false; }
}
let aiTimer: ReturnType<typeof setInterval> | null = null;
export function restartAiTimer() { if (aiTimer) clearInterval(aiTimer); aiTimer = setInterval(() => { void aiTick(); }, Math.min(30, Math.max(1, settings.aiEveryMin)) * 60000); }

// Reading a letter is local; replying refreshes the game connection first.

export function registerMail(router: LogRouter): void {
  router.on(SLOT.MAIL, 'mail:mail', (m: SllmMessage) => {
    onMailSignal(m);
  });
  router.on(SLOT.INBOX_SYNC, 'mail:inbox_sync', (m: SllmMessage) => {
    if (m.kind === 'LOADED' || m.kind === 'MONTH') syncInbox();
  });
  ipcMain.handle('inbox', async () => mail.inbox);
  /** 외교 서신 모두 읽음 표시(2026-10-18). 편지를 열지 않고 읽음만 바꾼다(AI 호출 없음). */
  ipcMain.handle('inboxReadAll', async () => {
    const sid = ctx.curSaveId; if (!sid) return mail.inbox;
    const ids = mail.inbox.filter((l) => l.sid === sid && !l.read).map((l) => l.id);
    for (const id of ids) { try { inboxStore().markRead(sid, id); } catch { /* 다른 시간선 편지 */ } }
    if (ids.length) syncInbox();
    return mail.inbox;
  });
  ipcMain.handle('openLetter', async (_e, id: number) => {
    const l = mail.inbox.find(x => x.id === id);
    if (!l || l.sid !== ctx.curSaveId) throw new Error(pick('현재 세이브의 편지를 찾지 못했습니다.', 'Letter not found in the current save.'));
    inboxStore().markRead(l.sid, id); syncInbox();
    return { letter: { ...l, read: true }, expired: !!l.proposal && !!ctx.gameDate && cmpDate(ctx.gameDate, l.expires) > 0 };
  });
  ipcMain.handle('replyLetter', async (_e, id: number) => {
    const l = mail.inbox.find(x => x.id === id), sid = ctx.curSaveId;
    if (!l || l.sid !== sid) return { ok: false, error: pick('현재 세이브의 편지를 찾지 못했습니다.', 'Letter not found in the current save.') };
    if (!ctx.gameRunning) return { ok: false, error: pick('편지는 읽을 수 있지만 답장 연결에는 실행 중인 게임이 필요합니다.', 'You can read the letter, but replying needs the game running.') };
    if (mail.replyBusy || ctx.pend || ctx.pending) return { ok: false, error: pick('진행 중인 통신과 제안을 마친 뒤 답장해 주세요.', 'Finish the current call and proposal before replying.') };
    mail.replyBusy = true;
    try {
      const req = ++link.reqCounter;
      await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
      if (ctx.curSaveId !== sid || !mail.inbox.some(x => x.id === id)) return { ok: false, error: pick('세이브 또는 시간선이 바뀌었습니다.', 'The save or timeline changed.') };
      const linked = await dialTerminal({ sid, idx: l.idx });
      if (!linked.ok) return linked;
      if (ctx.curSaveId !== sid || !ctx.talk || ctx.talk.idx !== l.idx || !mail.inbox.some(x => x.id === id)) return { ok: false, error: pick('통신 상대 또는 세이브가 바뀌었습니다.', 'The contact or save changed.') };
      inboxStore().markRead(sid, id); syncInbox();
      ctx.history.push({ role: 'assistant', content: JSON.stringify({ say: l.text, mood: 'none', action: { type: 'none' } }) });
      ctx.lastSay = l.text;
      let proposal: { id: number; text: string; confirm: boolean } | null = null;
      const expired = !!ctx.gameDate && cmpDate(ctx.gameDate, l.expires) > 0;
      if (l.proposal && !l.proposalHandled && !expired) {
        ctx.pending = { id: ++ctx.pendingSeq, action: l.proposal, tid: l.idx, aiName: l.name, letterId: l.id, letterSid: sid };
        proposal = { id: ctx.pending.id, text: describe(l.proposal, l.name), confirm: false };
      }
      return { ok: true, letter: { ...l, read: true }, proposal, expired: !!l.proposal && expired };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
    finally { mail.replyBusy = false; }
  });
}
