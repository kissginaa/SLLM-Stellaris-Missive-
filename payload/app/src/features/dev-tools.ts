// 개발자 도구: 게임 없이 새로 고친 기능의 창·화면을 확인한다(개발자 모드 전용, 정상 플레이에서는 아무것도 하지 않는다).
// 방식: 모드와 같은 모양의 가짜 SLLM 줄을 만들어 game.log 감시기와 같은 입구(watcher 'message')로 흘려보낸다 → 실제 기능 코드가 그대로 돈다.
// 가짜 자료는 세이브 번호 1999999, 제국 번호 9000~9004 에만 쓴다. 게임이 연결돼 있으면 넣지 않고, 게임으로는 어떤 명령도 보내지 않는다.
// 순수 부분(줄 만들기·안전 검사·견본)은 src/dev-fake.ts(selftest 가 검사한다).
import { BrowserWindow, ipcMain } from 'electron';
import { logDiagnostic } from '../diagnostics';
import { parseLogLine, SllmMessage } from '../protocol';
import { addMonths } from '../deferred';
import { dateNum } from '../govmemory';
import { newSession, applyTurn, speechType } from '../speech';
import { effectivePaper } from '../media-custom';
import { settings } from '../app/settings';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import type { LogRouter } from '../app/log-router';
import { DEV_SID, DEV_START_DATE, devGuard, injectGuard, DevRefusal, saveLines, monthLine, newsLines, speechLines, radioLines, councilLines, councilEndLine, devTruncatedTurn, DEV_TURN_TEXT, deliveryMessages, councilCheckText, behaviorPreview, sampleIssue, sampleRadio } from '../dev-fake';
import { issues, publishNews, openPaper, media } from './media';
import { speech, speechStore, speechReady, openSpeech, pushSpeech } from './speech-app';
import { radio, radioDev, setRadio, openRadioWin, radioTick, scheduleRadio, configuredStation } from './radio-app';
import { openSummit, readFederation } from './summit';
import { demoGovReport } from './govreport';
import { sampleFederation } from '../dev-fake';
import { pick as L } from './settings-ui';
import { aiTruthLines } from './ai-truth-app'; // AI 제국 실제 상태(2026-10-29)

type DevResult = { ok: boolean; message?: string; error?: string; lines?: string[] };
type Handler = () => Promise<DevResult>;
/** 모든 개발자 시험 IPC 의 감싸개: 맨 앞에서 개발자 모드를 확인한다(selftest 가 모든 handle 이 이것을 쓰는지 검사). */
const guarded = (fn: Handler) => async (): Promise<DevResult | DevRefusal> => devGuard(settings.devMode) ?? fn();
/** 가짜 게임 신호를 넣는 IPC: 개발자 모드 + 게임이 연결돼 있지 않을 때만. */
const guardedInject = (fn: Handler) => async (): Promise<DevResult | DevRefusal> => injectGuard(settings.devMode, ctx.gameRunning) ?? fn();

let feedRouter: LogRouter | null = null;
let agendaOpen = false; // 시험 안건을 띄웠는가(지우기에서 끝낸다)
let radioSeq = 0;
/** 가짜 줄을 실제 감시기와 같은 입구로 넣는다(watcher 'message' → 로그 분배기). 넣은 줄 수를 돌려준다. */
function feed(lines: string[]): number {
  let n = 0;
  for (const line of lines) {
    const m: SllmMessage | null = parseLogLine(line); if (!m) continue;
    try { if (ctx.watcher.listenerCount('message') > 0) ctx.watcher.emit('message', m); else feedRouter?.dispatch(m); n++; }
    catch (e) { logDiagnostic('warn', 'dev.inject.handler_failed', { kind: m.kind, error: (e as Error).message }); } // 감시기도 처리 오류를 이렇게 기록만 하고 다음 줄로 간다
  }
  logDiagnostic('info', 'dev.inject', { sid: DEV_SID, lines: n });
  return n;
}
const later = (a: string, b: string) => (dateNum(b) > dateNum(a) ? b : a);
/** 시험 세이브의 마지막 날짜(앱을 다시 켠 뒤에도 날짜를 되돌려 시간선이 갈라지지 않도록 저장소에서 찾는다). */
function lastFakeDate(): string {
  let d = DEV_START_DATE;
  try { for (const g of ctx.chron().groups(DEV_SID)) for (const e of g.items) if (e.date) d = later(d, e.date); } catch { /* 없음 */ }
  try { for (const i of issues().list(DEV_SID)) d = later(d, i.date); } catch { /* 없음 */ }
  try { const st = speechStore().get(DEV_SID); if (st.start) d = later(d, st.start); } catch { /* 없음 */ }
  return d;
}
/** 시험 세이브가 열려 있지 않으면 불러온 것처럼 넣는다. 지금 시험 날짜를 돌려준다. */
function ensureSave(): string {
  if (ctx.curSaveId !== DEV_SID || !ctx.gameDate) feed(saveLines(lastFakeDate()));
  return ctx.gameDate || DEV_START_DATE;
}
/** 게임 달 신호(MONTH)로 날짜를 앞으로만 옮긴다. */
function advanceTo(date: string): string { const d = later(addMonths(ctx.gameDate || DEV_START_DATE, 0), date); feed([monthLine(d)]); return d; }
const nextMonth = () => advanceTo(addMonths(ctx.gameDate || DEV_START_DATE, 1));
/** 방금 만든 창이 다 뜬 뒤에 이벤트를 보낸다(로딩 전에 보낸 이벤트는 사라진다). */
function loaded(w: BrowserWindow | null): Promise<void> {
  return new Promise((resolve) => {
    if (!w || w.isDestroyed() || (!w.webContents.isLoading() && w.webContents.getURL())) { resolve(); return; }
    const t = setTimeout(resolve, 6000); w.webContents.once('did-finish-load', () => { clearTimeout(t); setTimeout(resolve, 150); });
  });
}

/** F-02: 연설 준비를 바로 끝낸다(SPEECHPF·SPEECH prep 을 넣고, 3개월 뒤 MONTH 를 넣어 실제 tick 이 준비 완료로 바꾸게 한다). */
function makeSpeechReady(): string {
  ensureSave();
  if (speechReady()) return L('이미 연설 준비가 끝나 있습니다.', 'The speech is already prepared.');
  if (speechStore().get(DEV_SID).phase === 'none') feed(speechLines());
  const st = speechStore().get(DEV_SID);
  if (st.phase === 'prep') advanceTo(later(addMonths(ctx.gameDate, 1), st.due));
  return speechReady() ? L(`연설 준비를 시작하고 게임 날짜를 ${st.due || ctx.gameDate}로 옮겨 준비를 끝냈습니다.`, `Started speech preparation and moved the game date to ${st.due || ctx.gameDate} to finish it.`) : L('연설 준비 상태를 만들지 못했습니다.', 'Could not create the speech preparation state.');
}

export function registerDevTools(router?: LogRouter): void {
  feedRouter = router ?? null;
  // 1. 신문(F-01): 세이브·AI 끼리 사건을 넣고, 새해 신문을 만든다. AI 연결이 안 되면 [시험 견본] 호로 대신한다.
  ipcMain.handle('devNewsTest', guardedInject(async () => {
    ensureSave();
    const d = nextMonth(); feed(newsLines(d));
    const issueDate = `${Number(d.slice(0, 4)) + 1}.01.01`; advanceTo(issueDate);
    let how: string;
    if (issues().has(DEV_SID, issueDate)) how = L('이 날짜의 신문이 이미 있어 그대로 엽니다.', 'A paper for this date already exists, so it is opened as is.');
    else {
      await publishNews(issueDate);
      if (issues().has(DEV_SID, issueDate)) how = L('AI 연결로 새 신문을 만들었습니다.', 'Made a new paper with the AI connection.');
      else {
        const it = issues().add(DEV_SID, issueDate, sampleIssue(issueDate), 0), paperInfo = effectivePaper(settings.mediaPrefs, 0);
        ctx.toUi('galnews', { ...it, paperInfo });
        if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo });
        how = L('AI 연결이 없거나 응답을 쓰지 못해 [시험 견본] 신문(AI 없이 만든 것)으로 대신했습니다.', 'No AI connection or an unusable reply, so a [test sample] paper (made without AI) was used instead.');
      }
    }
    openPaper();
    return { ok: true, message: L(`${issueDate} 호 · ${how} 넣은 사건: 통상·방위 협정, "시험 대전쟁" 참전 2건(한쪽은 번호 없음).`, `Issue ${issueDate} · ${how} Injected events: commercial and defense pacts, 2 entries into the "Test Great War" (one without an id).`) };
  }));
  // 2. 연설(F-02·F-26): 준비를 바로 끝내고 연설 창을 연다.
  ipcMain.handle('devSpeechTest', guardedInject(async () => {
    const msg = makeSpeechReady(); if (!speechReady()) return { ok: false, error: msg };
    openSpeech();
    return { ok: true, message: msg + L(' 연설 창을 열었습니다(발언 보내기는 게임이 켜져 있어야 합니다. 화면 확인은 "연설 잘린 응답 시험"으로).', ' Opened the speech window (sending lines needs the game running; use the "truncated speech reply test" to check the screen).') };
  }));
  ipcMain.handle('devSpeechCut', guardedInject(async () => {
    if (speech.busy) return { ok: false, error: L('연설을 처리하는 중입니다.', 'The speech is being processed.') };
    const prep = makeSpeechReady(); if (!speechReady()) return { ok: false, error: prep };
    const pf = ctx.speechWithEthics(speechStore().get(DEV_SID).pf ?? speech.pfLast);
    if (!speech.sess || speech.sess.sid !== DEV_SID || speech.sess.sess.done) speech.sess = { sid: DEV_SID, sess: newSession('civil', pf, settings.speechTurns, speech.crowdCtx) };
    const r = devTruncatedTurn(); // 실제 parseTurn → recoverTurn 경로
    if (!r) return { ok: false, error: L('잘린 응답에서 반응을 되살리지 못했습니다(recoverTurn 이 null).', 'Could not recover reactions from the truncated reply (recoverTurn returned null).') };
    const { delta } = applyTurn(speech.sess.sess, DEV_TURN_TEXT, r);
    openSpeech(); await loaded(speech.win); pushSpeech();
    const t = speechType(speech.sess.sess.kind)?.name ?? '';
    return { ok: true, message: L(`잘린 응답에서 반응 ${r.reactions.length}개를 되살렸습니다(조각 복구 ${r.partial ? '예' : '아니오'}, mood ${r.mood > 0 ? '+' : ''}${r.mood}, 분위기 변화 ${delta > 0 ? '+' : ''}${delta}). ${t} 연설 창에 표시했습니다.`, `Recovered ${r.reactions.length} reactions from the truncated reply (partial recovery ${r.partial ? 'yes' : 'no'}, mood ${r.mood > 0 ? '+' : ''}${r.mood}, mood change ${delta > 0 ? '+' : ''}${delta}). Shown in the ${t} speech window.`), lines: r.reactions.map((x) => `[${x.type}] ${x.name ? x.name + ': ' : ''}${x.text}`) };
  }));
  // 3. 라디오(F-03·A-15·F-25): 라디오를 켜고 사건을 넣은 뒤 한 편 방송한다. 이 시험 동안 "지금 듣기"가 게임 없이도 된다.
  ipcMain.handle('devRadioTest', guardedInject(async () => {
    ensureSave();
    radioDev.bypass = true;
    if (!radio.on) setRadio(true); else openRadioWin();
    const d = nextMonth(); radioSeq += 1; feed(radioLines(d, Date.now() % 100000 + radioSeq));
    await loaded(radio.win);
    if (radio.busy) return { ok: true, message: L('라디오가 이미 방송을 준비하는 중입니다. 라디오 창을 확인해 주세요.', 'The radio is already preparing a broadcast. Check the radio window.') };
    const session = radio.session;
    if (radio.timer) { clearTimeout(radio.timer); radio.timer = null; }
    let aired = false;
    try { aired = await radioTick(true); } finally { if (radio.on && session === radio.session) scheduleRadio(); }
    if (!aired && radio.win && !radio.win.isDestroyed()) {
      const st = configuredStation(settings.radioStation);
      radio.win.webContents.send('radioBroadcast', { date: ctx.gameDate, lines: sampleRadio(), station: st.name + L(' · [시험 견본]', ' · [test sample]'), parent: st.parent, format: 'field', names: { announcer: st.announcer, cohost: st.cohost, reporter: st.reporter }, fictional: false });
    }
    return { ok: true, message: (aired ? L('AI 연결로 방송을 한 편 만들었습니다.', 'Made one broadcast with the AI connection.') : L('AI 방송을 만들지 못해(연결 없음 또는 응답 오류) [시험 견본] 대본을 대신 띄웠습니다.', 'Could not make an AI broadcast (no connection or a reply error), so a [test sample] script was shown instead.')) + L(` 쌓인 소식 ${radio.q.size}건. 시험 데이터를 지울 때까지 "지금 듣기"가 게임 없이 작동합니다(개발자 모드에서만).`, ` Queued news: ${radio.q.size}. Until the test data is cleared, "Listen now" works without the game (developer mode only).`) };
  }));
  ipcMain.handle('devRadioIdle', guarded(async () => {
    if (!radio.on) setRadio(true); else openRadioWin();
    await loaded(radio.win);
    radio.win?.webContents.send('radioIdle');
    return { ok: true, message: L('라디오 창에 "게임이 실행 중이 아니라 방송을 쉽니다" 안내를 보냈습니다.', 'Sent the "game not running, broadcasts paused" notice to the radio window.') };
  }));
  // 4. 의회(F-15): 플레이어가 회원이 아닌 안건을 넣는다. 안건 알림(실제 경로)이 뜨면 화면이 알림 버튼을 대신 눌러 회의 창을 연다.
  ipcMain.handle('devCouncilGuest', guardedInject(async () => {
    const d = ensureSave(); feed(councilLines(d)); agendaOpen = true;
    return { ok: true, message: L('플레이어가 비회원인 시험 안건을 넣었습니다(회원 4곳, 모두 AI). 잠시 뒤 회의 창이 열리고 점선·흐린 "비회원 가상 의석"이 보입니다. 강제 결정은 잠겨 있고, 토론은 AI 연결이 필요합니다("AI 호출 없이 정해진 대사로 진행"을 켜면 없이도 됩니다).', 'Injected a test resolution where the player is not a member (4 members, all AI). The council window opens shortly with dashed, faded "virtual non-member seats". Forced decisions are locked, and debate needs an AI connection (or turn on "Use canned lines without AI calls").') };
  }));
  ipcMain.handle('devCouncilCheck', guarded(async () => ({ ok: true, message: L('CouncilState.check 표본 2건을 확인했습니다(게임에는 아무것도 보내지 않음).', 'Checked 2 CouncilState.check samples (nothing sent to the game).'), lines: councilCheckText() })));
  // 4-1. 연방 정상회담(A-01 1단계): 가짜 연방으로 회담 창만 연다. 게임 신호·명령·LLM 호출 없음(발언은 정해진 대사).
  ipcMain.handle('devSummitTest', guarded(async () => {
    openSummit(sampleFederation());
    return { ok: true, message: L('[시험] 오리온 통상 연합(5개국, 회장: 시험 제국 가)으로 정상회담 창을 열었습니다. 안건·표·발언은 시연판이라 게임에 아무것도 보내지 않고, 발언 답은 정해진 대사입니다.', 'Opened the summit window with the [Test] Orion Trade Union (5 members, president: Test Empire A). Agenda, votes and speeches are a demo: nothing is sent to the game and replies are canned lines.') };
  }));
  // 4-1b. 실제 연방 읽기(A-01 2단계): 게임에 읽기 명령만 보내고(바꾸는 것 없음) 실제 연방 정보로 회담 창을 연다. 토론·결정 적용은 아직 막힘.
  ipcMain.handle('devSummitReal', guarded(async () => {
    const r = await readFederation();
    if (r === 'none') return { ok: false, message: L('플레이어 국가가 연방에 들어 있지 않습니다.', 'The player empire is not in a federation.') };
    if (!r) return { ok: false, message: L('연방 정보를 읽지 못했습니다(게임 응답 없음 또는 불완전). 게임과 최신 연결 모드, error.log 를 확인해 주세요.', 'Could not read the federation (no or incomplete game reply). Check the game, the latest link mod and error.log.') };
    openSummit(r);
    return { ok: true, message: L(`${r.name}(${r.members.length}개국, 법 ${r.laws.length}개, 응집력 ${r.cohesion})으로 정상회담 창을 열었습니다. 실제 AI 토론이 연결됩니다. 게임 적용은 개발자 검수용이며 별도 확인이 필요합니다.`, `Opened the summit window with ${r.name} (${r.members.length} members, ${r.laws.length} laws, cohesion ${r.cohesion}). Real AI debate is connected. Applying to the game is for developer review and needs separate checks.`) };
  }));
  // 4-2. 총독 홀로그램 보고(A-26): 가짜 행성 목록으로 보고 창을 연다(게임 명령 없음, 총독 말은 AI 연결 필요).
  ipcMain.handle('devGovReport', guarded(async () => { demoGovReport(); return { ok: true, message: L('[시험] 뉴 아테네 총독의 보고 창을 열었습니다(안정도 31·여가 부족·주거 부족). 게임에는 아무것도 보내지 않습니다. 총독의 말은 AI 연결이 필요합니다.', 'Opened the [Test] New Athens governor report (stability 31, amenity and housing shortage). Nothing is sent to the game. The governor\'s lines need an AI connection.') }; }));
  // 5. 전송 실패 메시지(F-12): classifyDelivery 결과 문장만(파일·bridge-client 실행 없음).
  ipcMain.handle('devDeliveryText', guarded(async () => ({ ok: true, message: L('전송 결과별 안내 문장 6건입니다.', 'Here are the 6 delivery-result messages.'), lines: deliveryMessages() })));
  // 6. 대화 속내(A-17): 가짜 PROFILE 의 beh 비트가 시스템 프롬프트에 어떻게 들어가는지(LLM 호출 없음).
  ipcMain.handle('devBehaviorPreview', guarded(async () => ({ ok: true, message: L('beh=5(공격+속국), beh=24(동맹+공존)의 프롬프트 줄입니다.', 'Prompt lines for beh=5 (aggressive + subjects) and beh=24 (alliance + coexistence).'), lines: behaviorPreview() })));
  // 7. 시험 데이터 지우기: 지울 수 있는 것은 저장소의 기능으로 지우고, 지우는 기능이 없는 저장소는 그렇다고 알린다.
  /** AI 제국 실제 상태(2026-10-29, 읽기만): 앱이 각 제국에 대해 쥔 상태와 한 번도 안 돈 기능. */
  ipcMain.handle('devAiTruth', guarded(async () => { const lines = aiTruthLines(); return { ok: true, message: L(`AI 제국 실제 상태 ${lines.length}줄`, `AI empire ground truth: ${lines.length} lines`), lines }; }));
  ipcMain.handle('devClearTest', guarded(async () => {
    const out: string[] = [];
    radioDev.bypass = false; out.push(L('라디오 "지금 듣기" 게임 없이 듣기: 껐습니다.', 'Radio "Listen now" without the game: turned off.'));
    const ph = speechStore().get(DEV_SID).phase;
    if (ph !== 'none') { speechStore().finish(DEV_SID); out.push(L(`연설 준비 기록(${ph}) 1건: 지웠습니다.`, `Speech preparation record (${ph}): cleared.`)); } else out.push(L('연설 준비 기록: 없습니다.', 'Speech preparation record: none.'));
    if (speech.sess && speech.sess.sid === DEV_SID) { speech.sess = null; out.push(L('진행 중이던 시험 연설: 지웠습니다.', 'Test speech in progress: cleared.')); }
    pushSpeech();
    let chronN = 0; try { for (const g of ctx.chron().groups(DEV_SID)) chronN += g.items.length; } catch { /* 없음 */ }
    out.push(L(`연대기(라디오 전용·세계 소식 포함) ${chronN}건: 연대기 저장소에 지우는 기능이 없어 남겨 둡니다.`, `Chronicle entries (incl. radio-only and world news): ${chronN} kept — the chronicle store cannot delete.`));
    out.push(L(`은하 뉴스 ${issues().list(DEV_SID).length}호: 신문 저장소에 지우는 기능이 없어 남겨 둡니다.`, `Galactic news issues: ${issues().list(DEV_SID).length} kept — the newspaper store cannot delete.`));
    out.push(L('라디오 방송 기록(이미 방송한 사건): 개수를 보거나 지우는 기능이 없어 남겨 둡니다.', 'Radio broadcast record (events already aired): kept — it cannot be counted or deleted.'));
    out.push(L('서신함: 시험 도구는 편지를 만들지 않습니다(서신 저장소에도 지우는 기능이 없습니다).', 'Inbox: the test tools do not create letters (the letter store cannot delete either).'));
    out.push(L('총독 기억 시간선(세이브별 날짜 기록): 지우는 기능이 없어 남겨 둡니다.', 'Governor memory timeline (per-save dates): kept — it cannot be deleted.'));
    if (ctx.gameRunning) out.push(L('게임이 연결돼 있어 메모리 속 시험 상태(안건·대기열·세이브 전환)는 건드리지 않았습니다.', 'The game is connected, so the in-memory test state (resolution, queue, save switch) was left alone.'));
    else {
      if (agendaOpen) { feed([councilEndLine(ctx.gameDate || DEV_START_DATE)]); agendaOpen = false; out.push(L('시험 안건: 끝냈습니다(부결 신호).', 'Test resolution: ended (rejected signal).')); }
      if (ctx.curSaveId === DEV_SID) {
        if (radio.on) { radio.q.clear(); radio.win?.webContents.send('radioQueue', 0); out.push(L('라디오 대기열: 비웠습니다.', 'Radio queue: cleared.')); }
        // 메모리 속 시험 세이브 상태는 로그가 새로 시작될 때와 같은 경로(watcher 'reset')로 비운다. 요청 번호와 연결 모드 정보는 그대로 둔다.
        const keep = { req: link.reqCounter, mod: link.runtimeMod };
        ctx.watcher.emit('reset'); link.reqCounter = keep.req; link.runtimeMod = keep.mod;
        out.push(L('메모리 속 시험 세이브(1999999) 상태: 비웠습니다. 다음에 게임을 켜면 실제 세이브로 바뀝니다.', 'In-memory test save (1999999) state: cleared. It switches to the real save the next time the game runs.'));
      }
    }
    out.push(L('남겨 둔 기록은 세이브 번호 1999999에만 있어 실제 세이브에는 보이지 않습니다.', 'The kept records belong only to save 1999999 and never appear in real saves.'));
    return { ok: true, message: L('시험 데이터를 정리했습니다.', 'Cleared the test data.'), lines: out };
  }));
}
