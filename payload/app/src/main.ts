import { startDiagnostics, logDiagnostic, diagnosticSpan, flushDiagnostics } from './diagnostics';
import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { ModResources } from './mod-resources';
import { ModCompatibility } from './mod-compat';
import { FlagProvider } from './flags';
import { LoreStore, clipLore } from './lore';
import { SpeechPf } from './speech';
import { chronKey, chronLines, RADIO_IDX } from './chronicle';
import { buildBriefing, briefingPrompt } from './briefing';
import { LogWatcher } from './logWatcher';
import { initializeEnvironment, resolveEnvironment, environmentSaveRoots, setRuntimeUserDir, defaultConnectionMod } from './environment-paths';
import { Player2Client } from './player2';
import { AiRouter, setPromptAugment } from './aiclient';
import { warmUpInput } from './keyboard';
import { SllmMessage, reqSeenIn, modProtocolState, MOD_PROTOCOL, MOD_PROTOCOL_NOTICE } from './protocol';
import { Profile } from './prompt';
import { cleanSaveId } from './images';
import { settings, loadSettingsFile, activeCustom } from './app/settings';
import { natureText, setOurEmpireProvider } from './our-empire'; // 우리 제국 정보(2026-11-03)
import { safeSend } from './safe-send';
import { bindCtx } from './app/ctx';
import { chat, registerChat, resetConversation } from './features/chat';
import { terminal, terminalReplies, terminalView, terminalRequest, registerTerminal } from './features/terminal';
import { mail, registerMail, syncInbox, mailNote, restartAiTimer } from './features/mail-app';
import { registerCouncil } from './features/council';
import { speech, registerSpeech, startSpeechPrep } from './features/speech-app';
import { registerGameState, onGameSnapshot } from './features/gamestate-app';
import { noteGestaltSnapshot, registerGestalt } from './features/gestalt-app';
import { registerGestaltReport } from './features/gestalt-report-app';
import { registerFallen } from './features/fallen-app'; // 몰락제국 각성 알림(알파 11) // 동기화 로그·공명 보고·이탈 노드(알파 11)
import { initAddons, addonCompat, registerAddons } from './features/addons-app';
import { registerFaction, registerFactionLog, setCabinetPersona, setCabinetOfficeNotify, cabinetReady } from './features/faction-app';
import { gov, registerGov, govMem, openGov } from './features/gov';
import { registerGovReport } from './features/govreport';
import { media, registerMedia, currentPaper } from './features/media';
import { registerChronicle, chron, chronPut, flushChronPending, idxNames } from './features/chronicle-app';
import { registerSupport } from './features/support';
import { registerImages, imageState } from './features/images';
import { registerPortraitLib, autoPortraitUrl } from './features/portrait-lib-app';
import { registerEnvironment, environmentInfo } from './features/environment';
import { registerAiSettings, syncP2Ping } from './features/ai-settings';
import { radio, registerRadio, radioResetForSave } from './features/radio-app';
import { link, consoleLog, registerGameLink } from './app/game-link';
import { LogRouter, SLOT } from './app/log-router';
import { registerDevTools } from './features/dev-tools';
import { registerEspionage } from './features/espionage-app';
import { registerPress } from './features/press-app';
import { registerVassal } from './features/vassal-app';
import { registerFleet } from './features/fleet-app';
import { registerFleetOrder } from './features/fleetorder-app'; // 자동 작전(2026-11-04)
import { registerBudget } from './features/budget-app'; // 예산 회의(2026-11-04)
import { registerCyber } from './features/cyber-app'; // 해외발 여론 공작(2026-11-04)
import { registerTemper } from './features/temper-app'; // 외교 노선(2026-11-04)
import { registerVassalCourt } from './features/vassal-court-app'; // 종속국 통치(2026-11-04)
import { registerCaptive } from './features/captive-app'; // 사로잡은 적 제독(2026-11-04)
import { registerInfamy } from './features/infamy-app'; // 악명·전쟁범죄(2026-11-04)
import { registerGalaxy } from './features/galaxy-app'; // 작전지휘실 은하 지도(2026-11-05)
import { registerVassalReign } from './features/vassal-reign-app';
import { registerTension } from './features/tension-app'; // 대립 긴장도: 시나리오 전용(2026-11-05)
import { registerScenario, scenarioForPrompt } from './features/scenario-app'; // 시나리오 알아보기·지난 역사·AI 배경(2026-11-05)
import { registerScenarioMap } from './features/scenario-map-app'; // 시나리오 은하 지도: 섹터·총독(2026-11-06)
import { registerRebels } from './features/rebels-app'; // 반란과 공작: 반란군 후원·취약 국가·선동(2026-11-05)
import { registerOverlordPressure } from './features/overlord-pressure-app'; // 역방향: AI 종주국이 우리에게(2026-11-05) // 종속국 통치권: 괴뢰 통치자·대리전·간섭 반감·정책 동조·종속국 쟁탈(2026-11-05)
import { registerVassalAdmin } from './features/vassal-admin-app'; // 종속국 행정: 성계 이양·기술 원조·동화 정책(2026-11-04)
import { registerAlarm } from './features/alarm-app'; // 일정표·쿨다운 알림(2026-11-04)
import { registerChronBook } from './features/chronbook-app';
import { registerTts } from './features/tts-app';
import { registerCrisis, crisisTalk, setCrisisDoc, setCrisisCalm, crisisWih } from './features/crisis-app';
import { pactTalk, pactAllies, endAllPacts } from './features/crisis-pact-app'; // 공동 대응 협약(알파 11)
import { CRISIS_TYPES } from './faction-voice'; // 위기 세력은 「은하 위기 상황」 줄을 받지 않는다(알파 11)
import { registerPrivateRooms } from './features/private-rooms-app';
import { registerOffice, setOfficeCabinet, pushOffice } from './features/office-app';
import { registerPeople } from './features/people-app';
import { registerPolicy, policyResetForSave } from './features/policy-app';
import { registerPersona, personaPeek, personaNote } from './features/persona-app';
import { registerLetters } from './features/letters-app';
import { registerMemorial, setMemorialExecutionCheck } from './features/memorial-app';
import { registerSecretary, setSecretaryPledges } from './features/secretary-app';
import { registerOfficeStyle } from './features/office-style-app';
import { registerIndependence } from './features/independence-app';
import { registerPetitions } from './features/petition-app';
import { registerEmbassy } from './features/embassy-app';
import { registerMusic } from './features/music-app';
import { registerMood } from './features/mood-app';
import { registerCivic } from './features/civic-app'; // 시민 정치: 여론조사·국민투표·특별사면(2026-11-03)
import { registerPreftl } from './features/preftl-app'; // 원시문명 관측(2026-11-03)
import { registerPreftlNet } from './features/preftl-net-app'; // 원시문명 인터넷 염탐(2026-11-04)
import { registerAudit } from './features/audit-app'; // 국정감사(2026-11-03, 설정으로 켬)
import { registerNoconf } from './features/noconf-app'; // 불신임(2026-11-03, 설정으로 켬)
import { registerLobby } from './features/lobby-app'; // 로비: 공식 지원·뒷돈(2026-11-03)
import { registerParliament } from './features/parliament-app'; // 여당·야당: 의석·연정·야당 대표·원내 공방(2026-11-03)
import { registerTwoParty } from './features/twoparty-app'; // 양당 정치: 정당 지지율·대정부 질문·선거전·총선(2026-11-06)
import { registerEnclave } from './features/enclave-app'; // 엔클레이브·캐러밴 소식(알파 11)
import { registerEmotions, emotionsFor } from './features/emotions-app';
import { registerSystems } from './features/systems-app'; // 성계 번호표·대화에서 언급된 성계 이름표(알파 11)
import { registerKhan, khanTalk } from './features/khan-app'; // 그레이트 칸 특별 대우(2026-10-26)
import { registerSaveSignals } from './features/save-signal-app'; // 세이브 다시 읽기를 바뀜 신호 때만(2026-11-09)
import { registerUsage } from './features/usage-app'; // 한 달 사용량 기록(콘솔 명령 수·세이브 읽기, 2026-11-09)
import { registerDeals, dealOwed } from './features/deals-app'; // 외교 거래(2026-10-26)
import { registerChildren } from './features/children-app'; // 통치자의 아이·아기방(2026-10-27)
import { owedLine } from './deals';
import { registerFrontier } from './features/frontier-app'; // 국경·전선(2026-10-26)
import { registerMarauders, isMarauderType, marauderTalk } from './features/marauder-app'; // 약탈자 대응(2026-10-26)
import { registerCollectibles, issueDoc } from './features/collectibles-app'; // 상인 수집품·골동품 진열장·국가 문서함(알파 11)
import { registerInternet } from './features/internet-app'; // 인터넷: 트윙클·DS인사이드·레드시프트(2026-10-28)
import { registerMemoryLinks, chaptersFor } from './features/memory-app';
import { registerDayMood } from './features/daymood-app'; // 동적 일상 분위기(2026-10-28 알파 10)
import { registerCourt } from './features/court-app'; // 음모·가문·가계도·정략결혼(2026-10-28 정치)
import { registerHoi } from './features/hoi-app'; // 물자 지원·파벌 공작·종속국 자치도(2026-10-28 하츠 참고) // 들은 말 퍼지기·관련 기억·장(章) 압축(2026-10-28 ChatSyncAuto 참고)
import { registerDebate } from './features/debate-app';
import { registerScandal } from './features/scandal-app';
import { registerAgents } from './features/agents-app';
import { registerOfficialHolidays } from './features/official-holidays-app';
import { registerProtests } from './features/protests-app'; // 시위(2026-10-23 초안)
import { registerEmergency, setEmergencyPersona } from './features/emergency-app'; // 긴급회의(2026-10-23 초안)
import { registerIsc } from './features/isc-app'; // 성간제국통신임시회의(2026-10-23 초안)
import { registerPolitics, setPoliticsPersona } from './features/politics-app'; // 정치적 지위 장부(2026-10-23 초안)
import { registerRelations, setRelationsPersona } from './features/relations-app'; // 인물 관계·사교회·불만 특성(2026-10-23 초안)
import { registerRomance, setRomancePersona } from './features/romance-app'; // 통치자 연애·청혼·결혼식(2026-10-23 초안)
import { registerGc, setGcPersona, pledgeFacts } from './features/gc-app'; // 행성총독회의(2026-10-23 초안)
import { registerChess } from './features/chess-app'; // 지도자와 체스(2026-10-30)
import { registerGovPolicy } from './features/govpolicy-app'; // 총독에게 행성 맡기기(2026-11-03)
import { registerEmp } from './features/emp-app'; // 비상대권(2026-11-05)
import { registerColName } from './features/colname-app'; // 신규 식민지 이름 짓기(2026-11-04)
import { registerFleetName } from './features/fleetname-app'; // 함대 명명 건(2026-11-04)
import { registerRenameLedger } from './features/rename-ledger'; // 이름의 정치: 개명 장부·게임 호출(2026-11-04)
import { registerGForum } from './features/gforum-app'; // 갤럭틱 포럼(/int/, 2026-11-04)
import { registerVault } from './features/vault-app'; // 통치자 개인 금고(2026-10-30)
import { registerCasino } from './features/casino-app';
import { registerParty } from './features/party-app'; // 관저 파티(2026-11-03, 개인실) // 우주 카지노(2026-10-30, 시스템만)
import { registerLog } from './features/log-app'; // 레전드 오브 갤럭시(2026-10-30)
import { registerOuting } from './features/outing-app';
import { registerLandmark } from './features/landmark-app'; // 성향별 특별한 곳(2026-10-30)
import { registerBlackmarket } from './features/blackmarket-app'; // 암시장 골목(2026-10-30)
import { registerTavern } from './features/tavern-app'; // 뒷골목 선술집(2026-10-30, 변장 잠행)
import { registerPetshop } from './features/petshop-app'; // 펫샵(2026-10-30, 외출 → 펫샵)
import { registerBedroom } from './features/bedroom-app'; // 통치자 침실(2026-10-30, 개인실 책상 위 열쇠)
import { registerPaparazzi } from './features/paparazzi-app'; // 파파라치(2026-10-31)
import { registerStore } from './features/store-app'; // 백화점(2026-10-30, 40~43층 귀빈층) // 외출(2026-10-30, 책상 위 지갑 → 수도 지도)
import { registerHolidays } from './features/holiday-app'; // 행성 고유 기념일·통치자 방문(2026-10-23 초안)
import { registerRetired, setRetiredPersona } from './features/retired-app'; // 은퇴 지도자의 앱 내 생활(2026-10-23 초안)
import { registerFbanquet } from './features/fbanquet-app'; // 타국 주최 만찬 초대(2026-10-23 초안)
import { registerFletters } from './features/fletters-app'; // 타국 지인 개인 서신(2026-10-23 초안)
import { registerExecution, setExecutionPersona, executionOwnsDeath } from './features/execution-app'; // 처형(2026-10-23 초안)
import { registerWorkshop } from './features/workshop-app'; // 창작마당 애드온 자동 감지(2026-10-23 초안)
import { registerLore, loreForPrompt } from './features/lore-app'; // 세계관 팩 서재(2026-10-23 초안)
import { registerNationalEvents } from './features/national-events-app';
import { registerCeremony } from './features/ceremony-app';
import { registerDeclare } from './features/declare-app';
import { registerCondemn, resetCondemnSession } from './features/condemn-app';
import { registerEffectVerifier } from './features/effect-verifier';
import { registerConversationFavors } from './features/conversation-favors';
import { registerBanquet } from './features/banquet-app';
import { registerArchive } from './features/archive-app';
import { registerDinner } from './features/dinner-app';
import { registerMediation } from './features/mediation-app';
import { registerPeace } from './features/peace-app';
import { registerSummit, registerSummitLog } from './features/summit';
import { registerAppUpdate } from './features/app-update';
import { registerGameDll } from './features/game-dll-app'; // 게임 폴더 연결 DLL 자동 교체(2026-11-04)
import { registerBackstory, backstories } from './features/backstory-app';
import { wins, registerWindows, quitAll, toUi, createWindow, createTray, startFade, registerHotkey, notify, needPaused, refreshTray, updateBadge, onMonthTick, setAppOpen, BASE_ICON, iconBaseHeight } from './features/windows';
import { registerSettingsUi, CLIENT_ID, uiText, aiLanguage, locFolder, pick } from './features/settings-ui';
import { setPicker } from './i18n-pick';
setPicker(pick); // 순수 로직 파일의 L(한, 영)도 화면 언어·언어 팩을 따르게(2026-10-19)
const router = new LogRouter();

// Tester preferences and histories are separate from the Workshop release.
app.setPath('userData', path.join(app.getPath('appData'), 'SLLM-Missive-Tester'));

// 배포 설정(release-config)·Game Client ID: src/features/settings-ui.ts 로 옮김(A-00b 7번)
let GAME_LOG =
  process.env.SLLM_GAME_LOG ?? path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Stellaris', 'logs', 'game.log');

let MOD_DIR =
  process.env.SLLM_MOD_DIR ?? defaultConnectionMod();
const p2 = new Player2Client(CLIENT_ID);
// 모든 기능은 ai.chat() 하나만 쓴다(Player2 또는 사용자의 개인 API). 자동 대체 연결은 없다.
const ai = new AiRouter(p2, () => activeCustom(), () => (settings.aiMode === 'custom' ? 'custom' : 'player2'), () => aiLanguage());
const watcher = new LogWatcher(GAME_LOG, 200, true); // 과거 줄은 요청 번호만 복구하고 기능은 새 줄에서만 실행한다(F-41)
const profiles = new Map<number, Profile>(); // 게임이 같은 줄을 중복으로 걸러 PROFILE 이 빠져도 마지막 값을 쓴다
// 총독 대화 상태(행성 목록·대화 기록): src/features/gov.ts 의 gov 객체(A-00b 5번)
const gameSignalCounts:Record<string,number>={};let lastGameSignal:unknown=null;
let curSaveId = ''; // 지금 불러온 세이브의 번호(모드가 기록). 세이브마다 초상화를 따로 두는 데 쓴다
// ---- 외교 대화(제안·호감·doChat·게임 안 키보드): src/features/chat.ts 로 옮김(A-00b 6번)
// 게임으로 명령 보내기(콘솔 큐·입력 표시·ACK): src/app/game-link.ts 로 옮김(A-00b 3번)

// ---- 설정: src/app/settings.ts 로 옮김(A-00b 2번)
// 사용자 그림(배경·초상화) 상태: src/features/images.ts 로 옮김(A-00b 4번)
// 조약 보류 서신 저장소(deferred): src/features/mail-app.ts 로 옮김(A-00b 6번)
// 은하 뉴스 저장소: src/features/media.ts 로 옮김(A-00b 5번)
// 연대기 저장소·기록 함수: src/features/chronicle-app.ts 로 옮김(A-00b 4번)
// 총독 기억 저장소·총독 답 원문 기록: src/features/gov.ts 로 옮김(A-00b 5번)
function syncPlayer2Activity(): void {
  if (settings.aiMode !== 'player2' || !wins.gameRunning || !(process.env.SLLM_CLIENT_ID || settings.player2ClientId || CLIENT_ID)) p2.stop();
  else p2.startHealthPing(e => toUi('status', uiText(e.message)));
}
// 화면 언어(selectedLanguage·uiText·languageView): src/features/settings-ui.ts 로 옮김(A-00b 7번)
function applyEnvironment(): void {
  const e = resolveEnvironment(settings);
  setRuntimeUserDir(e.userDir);
  GAME_LOG = e.log; MOD_DIR = e.mod || defaultConnectionMod();
  watcher.setPath(GAME_LOG); link.runtimeMod = null;
  flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: e.saveRoots });
}
function loadSettings() {
  loadSettingsFile();
  p2.configureClientId(process.env.SLLM_CLIENT_ID || settings.player2ClientId || CLIENT_ID);
  flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: environmentSaveRoots(settings.userDir) });
}

// ---- (실험) AI 가 먼저 보내는 편지
let playerName = '';
// 통신 단말기(연락처·단말기 명령 응답 대기·상대 연결): src/features/terminal.ts 로 옮김(A-00b 6번)
let playerIdx = 0; // 플레이어 제국의 모드 번호(IDX 줄의 rel=self)
let gameDate = '';
/** 게임 로그 줄 앞의 날짜("[2200.1.1]")를 "2200.01.01" 꼴로. 없으면 ''. */
function logLineDate(raw: string): string { const r = /\]:\s*\[(\d{4})\.(\d{1,2})\.(\d{1,2})\]/.exec(raw ?? ''); return r ? `${r[1]}.${r[2].padStart(2, '0')}.${r[3].padStart(2, '0')}` : ''; }
// ---- 서신(후보 수집·AI 편지·조약 보류 서신·서신함): src/features/mail-app.ts 로 옮김(A-00b 6번)


const flagProv = new FlagProvider();
const loreStore = new LoreStore();
const modResources = new ModResources(() => flagProv.game());
initAddons(modResources); // 애드온: 켠 모드의 sllm/addon + 앱 데이터 addons 폴더 (src/features/addons-app.ts)
const modCompatibility = new ModCompatibility(modResources, () => path.join(app.getPath('userData'),'compatibility'), locFolder, addonCompat);
flagProv.useResources(modResources);
function adoptedEthics(idx: number): { text: string; names: string[]; source: string } {
  const live=modCompatibility.liveFor(curSaveId,idx), saved=flagProv.ethicsFor(idx), ids=live?.ids ?? saved;
  if(!ids?.length)return {text:'',names:[],source:'unknown'};
  const rows=modCompatibility.describe(ids), source=live?'live '+live.date:'save '+flagProv.latestDate();
  return {text:source+'\n'+modCompatibility.text(ids),names:rows.map(e=>e.name),source};
}
function profileWithEthics(pr: Profile | undefined, idx: number): Profile | undefined { return pr ? {...pr,ethicsText:adoptedEthics(idx).text} : undefined; }
function speechWithEthics(pf: SpeechPf | null): SpeechPf | null { if(!pf)return null;const e=adoptedEthics(playerIdx);return e.text?{...pf,modEthics:e.text,modEthicsNames:e.names}:pf; }
function actionsAllowed(idx: number): boolean { const type=terminal.items.find(c=>c.idx===idx)?.type || flagProv.typeFor(idx); return type ? modCompatibility.policy(type).actions : true; }
async function refreshEthics(idx: number): Promise<void> {
  const req=++link.reqCounter, body=modCompatibility.queryBody(idx,req);if(!body||!wins.gameRunning||!curSaveId)return;
  try { await terminalRequest('effect every_playable_country = { limit = { is_ai = no } '+body+' }','ETHIC_END',req); }
  catch(e){ consoleLog('가치관 실시간 조회 실패: '+(e as Error).message); }
}
/** 사용자 글을 뺀 제국 전기(backstory-app 의 입력 칸에 미리 보여 줄 것). withLore 의 a 와 같은 순서. */
function autoLore(name: string, idx?: number): string {
  const ov = modCompatibility.empire(name)?.lore; if (ov) return ov;
  const bio = typeof idx === 'number' ? flagProv.bioFor(idx) : null; if (bio) return clipLore(modCompatibility.biography(bio));
  return (modCompatibility.lore(name) ?? loreStore.lookup(name, flagProv.game()))?.text ?? '';
}
/** 대화 상대와 플레이어 제국의 설명(전기)을 붙인다. 못 찾으면 그대로. */
function withLore<T extends { name: string; idx?: number; player?: string }>(t: T): T & { autoPortrait?: string; lore?: string; playerLore?: string; briefing?: string; chronicle?: string[]; galnews?: string[]; playerGest?: number } {
  try {
    const gd = flagProv.game();
    // 세이브에 든 전기(커스텀 제국, 다른 사람이 만든 것 포함)가 가장 정확하다. 없으면 설계 파일, 기본 제국 설명 순.
    const bioA = typeof t.idx === 'number' ? flagProv.bioFor(t.idx) : null;
    const overrideA=modCompatibility.empire(t.name)?.lore;
    const userA = backstories.empire(t.name), userB = t.player ? backstories.empire(t.player) : ''; // 사용자가 쓴 제국 전기가 가장 먼저(2026-10-18)
    const a = userA ? {text:userA} : overrideA ? {text:overrideA} : bioA ? { text: clipLore(modCompatibility.biography(bioA)) } : modCompatibility.lore(t.name) ?? loreStore.lookup(t.name, gd);
    const bioB = playerIdx > 0 ? flagProv.bioFor(playerIdx) : null;
    const b = userB ? {text:userB} : t.player && modCompatibility.empire(t.player)?.lore ? {text:modCompatibility.empire(t.player)!.lore} : bioB ? { text: clipLore(modCompatibility.biography(bioB)) } : t.player ? modCompatibility.lore(t.player) ?? loreStore.lookup(t.player, gd) : null;
    let briefing = '', chronicle: string[] = [];
    if (typeof t.idx === 'number' && t.idx > 0) {
      const br = buildBriefing({ ai: flagProv.statsFor(t.idx), player: playerIdx > 0 ? flagProv.statsFor(playerIdx) : null, aiName: t.name, playerName: t.player ?? '', date: flagProv.latestDate() });
      briefing = briefingPrompt(br);
      if (curSaveId) chronicle = chronLines(govMem().split(curSaveId, chron().list(chronKey(curSaveId, t.idx))).own.filter((e) => !e.world));
    }
    const chapters = typeof t.idx === 'number' && t.idx > 0 ? chaptersFor(t.idx) : []; // 오래된 기록의 장(章)(2026-10-28)
    const card = backstories.empireCardPrompt(t.name); // 제국 지도자 말투·비밀(플레이어가 편집, 2026-10-28)
    const paper = currentPaper();
    const pr = profileWithEthics((t as T & {profile?:Profile}).profile, t.idx || 0);
    return {
      ...t,
      readOnlyActions: typeof t.idx === 'number' && !actionsAllowed(t.idx),
      ...(typeof t.idx === 'number' && t.idx > 0 && (terminal.items.find((c) => c.idx === t.idx)?.type || flagProv.typeFor(t.idx)) === 'awakened_marauders' && khanTalk() ? { khan: khanTalk() } : {}), // 그레이트 칸 특별 대우(2026-10-26)
      ...(typeof t.idx === 'number' && t.idx > 0 && dealOwed(t.idx) ? { owed: owedLine() } : {}), // 외교 거래: 우리가 약속을 어긴 빚(2026-10-26)
      ...(typeof t.idx === 'number' && t.idx > 0 && isMarauderType(terminal.items.find((c) => c.idx === t.idx)?.type || flagProv.typeFor(t.idx)) ? { marauder: marauderTalk(t.idx, Number((t as { score?: number }).score) || 0) } : {}), // 약탈자 대응(2026-10-26)
      ...(typeof t.idx === 'number' && autoPortraitUrl(t.idx) ? { autoPortrait: autoPortraitUrl(t.idx) } : {}),
      ...(pr ? { profile: pr } : {}),
      ...(terminal.sid === curSaveId && terminal.playerGest ? { playerGest: terminal.playerGest } : {}),
      ...(typeof t.idx === 'number' && t.idx > 0 ? (() => { const tc = terminal.items.find((c) => c.idx === t.idx), ct = tc?.type || flagProv.typeFor(t.idx!), sub = tc?.sub; const eth = modCompatibility.liveFor(curSaveId, t.idx!)?.ids ?? flagProv.ethicsFor(t.idx!); return { ...(ct ? { ctype: ct } : {}), ...(sub ? { csub: sub } : {}), ...(() => { const em = emotionsFor(t.idx!); return em ? { emotions: em } : {}; })(), ...(() => { if (ct && (CRISIS_TYPES as readonly string[]).includes(ct)) return {}; const cl = [crisisTalk(), ct === 'default' ? pactTalk(t.idx!, { type: ct, war: !!pr?.flags.war, score: Number((t as { score?: number }).score) || 0, e: emotionsFor(t.idx!) }) : ''].filter(Boolean).join('\n'); return cl ? { crisis: cl } : {}; })(), ...(tc?.fe ? { feMask: tc.fe } : {}), ...(crisisWih() ? { wih: true } : {}), ...(eth?.length ? { ethicIds: eth } : {}) }; })() : {}), // 몰락한 제국 말투(2026-10-19) · 엔클레이브 세부 말투(알파 11)
      ...(paper.length ? { galnews: paper } : {}),
      ...(a || card ? { lore: [a?.text ?? '', card].filter(Boolean).join('\n') } : {}),
      ...(chapters.length ? { chapters } : {}),
      ...(b ? { playerLore: b.text } : {}),
      ...(typeof t.idx === 'number' && t.idx > 0 && natureOf(t.idx) ? { selfNature: natureOf(t.idx) } : {}), // 상대 제국의 정부 형태·국시·종족 특성(2026-11-03)
      ...(playerIdx > 0 && natureOf(playerIdx) ? { playerNature: natureOf(playerIdx) } : {}), // 우리 제국의 정부 형태·국시·종족 특성
      ...(briefing ? { briefing } : {}),
      ...(chronicle.length ? { chronicle } : {}),
    };
  } catch { return t; }
}
/** 세이브에서 읽은 제국의 정부 형태·국시·기원·건국 종족 특성을 화면 언어 이름으로(2026-11-03). 모르면 ''. */
function natureOf(idx: number): string { try { return natureText(flagProv.natureFor(idx), (id) => modCompatibility.nameOf(id)); } catch { return ''; } }
/** 우리 제국: 플레이어가 쓴 전기(없으면 게임 전기)와 정체. 인물 1:1·파벌 회의 프롬프트에 붙는다(policy-app withPolicyContext). */
setOurEmpireProvider(() => {
  const name = playerName || '';
  let lore = name ? backstories.empire(name) : '';
  if (!lore && playerIdx > 0) { const bio = flagProv.bioFor(playerIdx); if (bio) lore = clipLore(modCompatibility.biography(bio)); }
  return { name, lore, nature: playerIdx > 0 ? natureOf(playerIdx) : '' };
});
/** 대화 상대의 깃발 그림(세이브 + 게임 폴더 이미지). 읽지 못하면 null 이라 화면은 임시 그림을 쓴다. */
function flagUrlFor(idx: unknown): string | null {
  try { if(typeof idx!=='number'||idx<=0)return null;const name=terminal.items.find(c=>c.idx===idx)?.name||idxNames.get(idx)||'';return modCompatibility.flagOverride(name)||flagProv.urlFor(idx); } catch { return null; }
}
// ---- 창(메인·런처·말풍선·설정 창·알림 카드·트레이·투명도·게임 창 따라가기·게이트)과 toUi: src/features/windows.ts 로 옮김(A-00b 7번)

// ---- 은하 의회 창(별도 창). 지금은 개발자 모드에서 강제로 여는 시연판이다(가짜 의원·가짜 응답).
// 안건 상정 알림: 안건이 표결에 오르면 알림이 뜨지만, 회의는 플레이어가 '안건 회의 직접 참여하기'를 눌러야만 열린다. 넘기고 싶으면 그냥 두면 된다(게임 안에서 AI가 알아서 표결한다).
// ---- 은하 의회(안건 알림·회원 정보 수집·회의 창·토론·강제 결정): src/features/council.ts 로 옮김(A-00b 6번, A-16 연결)
// ---- 신문 창: src/features/media.ts 로 옮김(A-00b 5번)
// ---- 행성 총독 창: src/features/gov.ts 로 옮김(A-00b 5번)
// ---- 연설: src/features/speech-app.ts 로 옮김(A-00b 5번)

// ---- 성간 라디오: src/features/radio-app.ts 로 옮김(A-00b 4번)
// 언론사 설정 바뀜 알림: src/features/media.ts 로 옮김(A-00b 5번)
// 서신·소문 자동 작업 타이머(aiTick): src/features/mail-app.ts 로 옮김(A-00b 6번)
// 은하 뉴스·소문 만들기: src/features/media.ts 로 옮김(A-00b 5번)
process.on('uncaughtExceptionMonitor',(error,origin)=>{logDiagnostic('error','process.uncaught',{error,origin});flushDiagnostics();});
process.on('unhandledRejection',(error)=>{logDiagnostic('error','process.unhandled_rejection',{error});flushDiagnostics();});
app.on('before-quit',()=>{logDiagnostic('info','app.quit');flushDiagnostics();});
app.on('render-process-gone',(_e,contents,details)=>logDiagnostic('error','renderer.gone',{webContentsId:contents.id,...details}));
app.on('child-process-gone',(_e,details)=>logDiagnostic('error','child_process.gone',details));
app.on('web-contents-created',(_e,contents)=>{
  contents.on('preload-error',(_event,file,error)=>logDiagnostic('error','renderer.preload_error',{file,error}));
  contents.on('did-fail-load',(_event,code,description,url)=>logDiagnostic('error','renderer.load_failed',{code,description,url}));
  contents.on('console-message',(_event,level,message,line,source)=>{if(level>=2)logDiagnostic(level>=3?'error':'warn','renderer.console',{message,line,source});});
});
const handleIpc=ipcMain.handle.bind(ipcMain);
ipcMain.handle=((channel:string,listener:any)=>handleIpc(channel,async(event,...args)=>{
  const span=diagnosticSpan('ipc',{channel});
  try {
    const result = await listener(event, ...args);
    if (
      result &&
      typeof result === 'object' &&
      (result.ok === false || ['fail', 'timeout', 'error', 'unknown', 'pending'].includes(result.outcome || result.state))
    )
      logDiagnostic('warn', 'ipc.result', {
        id: span.id,
        channel,
        state: result.state || result.outcome,
        error: result.error || result.message,
      });
    span.end({ ok: result?.ok, state: result?.state || result?.outcome });
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
})) as typeof ipcMain.handle;
// A-00b: 기능 모듈이 쓰는 공유 상태 연결(src/app/ctx.ts)
bindCtx({
  curSaveId: { get: () => curSaveId, set: (v) => { curSaveId = v; } },
  gameDate: { get: () => gameDate, set: (v) => { gameDate = v; } },
  playerName: { get: () => playerName, set: (v) => { playerName = v; } },
  playerIdx: { get: () => playerIdx, set: (v) => { playerIdx = v; } },
  gameRunning: { get: () => wins.gameRunning, set: (v) => { wins.gameRunning = v; } },
  gameDip: { get: () => wins.gameDip },
  launcher: { get: () => wins.launcher },
  curScale: { get: () => wins.curScale },
  BASE_ICON: { get: () => BASE_ICON },
  iconBaseHeight: () => iconBaseHeight(),
  ai,
  p2,
  syncPlayer2Activity,
  govMem,
  chron,
  mediaRevision: { get: () => media.revision },
  flagProv,
  modCompatibility,
  terminal,
  terminalView,
  talk: { get: () => chat.talk, set: (v) => { if(chat.talk?.idx!==v?.idx)resetConversation(); chat.talk = v; } },
  withLore,
  adoptedEthics,
  flagUrlFor,
  pend: { get: () => chat.pend },
  pending: { get: () => chat.pending, set: (v) => { chat.pending = v; } },
  pendingSeq: { get: () => chat.pendingSeq, set: (v) => { chat.pendingSeq = v; } },
  history: { get: () => chat.history },
  mailReplyBusy: { get: () => mail.replyBusy },
  lastSay: { get: () => chat.lastSay, set: (v) => { chat.lastSay = v; } },
  applyEnvironment,
  MOD_DIR: { get: () => MOD_DIR },
  GAME_LOG: { get: () => GAME_LOG },
  gameFront: { get: () => wins.gameFront },
  gameSignalCounts,
  lastGameSignal: { get: () => lastGameSignal },
  watcher,
  profiles,
  mailCountries: mail.countries,
  news: { get: () => mail.news },
  notify,
  mailNote,
  setWin: { get: () => wins.setWin },
  needPaused,
  refreshTray,
  profileWithEthics,
  loreStore,
  updateBadge,
  onMonthTick,
  appOpen: { get: () => wins.appOpen },
  setAppOpen,
  actionsAllowed,
  speechWithEthics,
  refreshEthics,
  imageState,
  terminalRequest,
  win: { get: () => wins.win },
  toUi,
});
app.whenReady().then(() => {
  process.setSourceMapsEnabled?.(true);
  startDiagnostics(path.join(app.getPath('userData'),'logs'),()=>({version:app.getVersion(),sid:curSaveId,date:gameDate,gameRunning: wins.gameRunning,devMode:settings.devMode,aiMode:settings.aiMode}));
  if (process.platform === 'win32') warmUpInput(); // 선택한 전달 방식 준비
  restartAiTimer();
  initializeEnvironment(app.getPath('documents'));
  loadSettings();
  applyEnvironment();
  createWindow();
  createTray();
  startFade();
  flagProv.onUpdate(() => { if (chat.talk) toUi('talk', chat.talk); toUi('contacts', terminalView()); }); // 세이브를 작업 스레드에서 다 읽으면 깃발·초상화를 다시 그리게(2026-10-27)
  { const err = registerHotkey(); if (err) setTimeout(() => toUi('status', err), 1500); }
  const noteSave = (sid: string) => {
    if (!sid || sid === curSaveId) return;
    // 다른 세이브로 바뀜: 제국 번호는 세이브마다 다시 매겨지므로 이전 세이브의 기억을 비운다
    logDiagnostic('info','game.save_changed',{previousSid:curSaveId,sid});
    link.epoch++; resetCondemnSession();
    const firstId = !curSaveId;
    terminal.reset(); toUi('contacts', terminalView());
    modCompatibility.clearLive(); flagProv.setExpectedSid(sid);
    curSaveId = sid;
    radioResetForSave(); policyResetForSave();
    mail.plan.set('', []);
    mail.roll = [];
    mail.news = [];
    syncInbox();
    if (firstId) {
      flushChronPending();
      if (speech.prepPending !== null) {
        const q = speech.prepPending;
        speech.prepPending = null;
        startSpeechPrep(q.date, q.pf);
      }
    }
    profiles.clear();
    mail.countries.clear();
    chat.history = []; chat.histories.clear();
    chat.talk = null;
    chat.pend = null; resetConversation();
    chat.pending = null;
    gov.planetList = null;
    gov.history = [];
    toUi('talk', null);
    toUi('planets', null);
    toUi('images', imageState());
  };
  watcher.on('diagnostic',(data)=>logDiagnostic(data.event.includes('failed')?'warn':'info',data.event,data));
  // 게임 로그 줄 분배: 원래 한 함수였던 처리를 같은 순서의 자리 번호로 나눴다(src/app/log-router.ts, A-00b 3번)
  router.on(SLOT.STATS, 'main:stats', (m: SllmMessage) => {
    if(Object.keys(gameSignalCounts).length<200||gameSignalCounts[m.kind]!==undefined)gameSignalCounts[m.kind]=(gameSignalCounts[m.kind]||0)+1;lastGameSignal={kind:m.kind,time:new Date().toISOString()};
    const metadata=Object.fromEntries(['req','last','idx','sid','n','date','phase','state','kind','ok','key','protocol','version','type','rel'].filter(k=>m.kv[k]!==undefined).map(k=>[k,m.kv[k]]));if(m.kind!=='SYS')logDiagnostic('info','game.signal',{kind:m.kind,...metadata}); // 성계 번호표 줄(수백~천 줄)은 진단 기록에서 뺀다(알파 11)
  });
  let protoWarnedEpoch = -1;
  router.on(SLOT.HELLO, 'main:hello', (m: SllmMessage) => {
    if (m.kind === 'HELLO') {
      const req = Number(m.kv.req);
      link.runtimeMod = { version: m.kv.version || '?', protocol: Number(m.kv.protocol) || 0, verified: req > 0 && terminalReplies.has('HELLO:' + req) };
      terminalReplies.get('HELLO:' + req)?.(m);
      { const hs = cleanSaveId(m.kv.sid); if (hs) noteSave(hs); } // 세이브를 불러온 뒤 앱을 켜면 LOADED 를 못 받는다. 매달 오는 HELLO 의 세이브 번호로 잡는다(2026-11-03: 인터넷·궁정이 「세이브를 먼저 불러와」만 띄움)
      toUi('environment', environmentInfo());
      const hp = Number(m.kv.protocol) || 0, ps = modProtocolState(hp); // 연결 규격이 다르면 연결 한 번당 한 번 알린다(알파 6)
      if (ps !== 'ok' && protoWarnedEpoch !== link.epoch) { protoWarnedEpoch = link.epoch; logDiagnostic('warn', 'mod.protocol_mismatch', { mod: hp, app: MOD_PROTOCOL, state: ps }); toUi('event', MOD_PROTOCOL_NOTICE[ps]); }
    }
  });
  router.on(SLOT.COMPAT_FEED, 'main:compat_feed', (m: SllmMessage) => {
    modCompatibility.feed(m,curSaveId);
  });
  router.on(SLOT.ETHIC_END, 'main:ethic_end', (m: SllmMessage) => {
    if (m.kind === 'ETHIC_END') { terminalReplies.get('ETHIC_END:'+m.kv.req)?.(m); if(chat.talk && chat.talk.idx===Number(m.kv.idx) && m.kv.sid===curSaveId) { chat.talk=withLore(chat.talk); toUi('talk',chat.talk); } }
  });
  router.on(SLOT.COMPAT_EVENT, 'main:compat_event', (m: SllmMessage) => {
    if (m.kind === 'COMPAT_EVENT') {
      const ev = modCompatibility.event(m, curSaveId);
      if (ev) {
        chronPut(RADIO_IDX, ev.date, ev.text, false, {
          name: '성간라디오 전용 연대기',
          world: true,
          uid: ev.kind + '|' + curSaveId + '|' + ev.n,
        });
        if (radio.on) {
          radio.q.push({ ...ev, id: ev.kind + '|' + curSaveId + '|' + ev.n });
          safeSend(radio.win, 'radioQueue', radio.q.size);
        }
      }
    }
  });
  router.on(SLOT.CONTACT_BEGIN, 'main:contact_begin', (m: SllmMessage) => {
    if (m.kind === 'CONTACT_BEGIN') noteSave(cleanSaveId(m.kv.sid));
  });
  // SLOT.TERMINAL: src/features/terminal.ts registerTerminal()
  router.on(SLOT.LINE_DATE, 'main:line_date', (m: SllmMessage) => {
    { const d = logLineDate(m.raw); if (d) gameDate = d; } // 로그 줄 앞의 게임 날짜. 새 게임을 시작하면 LOADED/MONTH 신호가 오기 전에도 날짜가 맞도록 매 줄에서 갱신한다
  });
  // SLOT.REQSEEN: src/app/game-link.ts registerGameLink()
  // SLOT.OPSHIFT: src/features/chat.ts registerChat()
  // SLOT.ACK: src/app/game-link.ts registerGameLink()
  // SLOT.RESOLUTION: src/features/council.ts registerCouncil()
  // SLOT.AGENDA: src/features/council.ts registerCouncil()
  router.on(SLOT.PLANETS, 'main:planets', (m: SllmMessage) => {
    { const pl = gov.collector.feed(m); if (pl) { if (pl.sid) noteSave(pl.sid); gov.planetList = pl; toUi('planets', pl); gov.waiters.splice(0).forEach((w) => w(pl)); } }
  });
  // SLOT.MAIL: src/features/mail-app.ts registerMail()
  // SLOT.KEYBOARD: src/features/chat.ts registerChat()
  registerSpeech(router); // SLOT.SPEECH_PF·SLOT.SPEECH + 연설 IPC 5개 (src/features/speech-app.ts)
  registerAddons(); // 애드온 IPC 4개 (src/features/addons-app.ts)
  registerGameState(router); // SLOT.GAMESTATE 월간 상황·출신·첩보 작전 (src/features/gamestate-app.ts)
  onGameSnapshot(noteGestaltSnapshot); // 단일 의식 제국 판정(언론사 인터뷰·내각 회의 막기, 인물 말투) — 2026-10-19
  registerFactionLog(router); registerFaction(); // SLOT.FACTION_MEET + 내각(장관) 회의 IPC (src/features/faction-app.ts, 2026-10-19 파벌 회의에서 바뀜)
  setCabinetPersona({ mem: personaPeek, note: personaNote }); // 장관들의 1:1 통신 말투·신뢰·기억(persona-app)
  setEmergencyPersona({ mem: personaPeek }); // 긴급회의 평의원 말투·신뢰(같은 persona-app, 2026-10-23)
  setPoliticsPersona({ note: personaNote }); // 시위 총독 입장 → 인물 카드 신뢰(2026-10-23)
  setRelationsPersona({ mem: personaPeek, note: personaNote }); // 사교회 장면·중재에 인물 말투, 중재 결과는 인물 기억에(2026-10-24)
  setRomancePersona({ mem: personaPeek, note: personaNote }); // 데이트 상대 말투·기억, 데이트·고백 기억 남기기(2026-10-23)
  setSecretaryPledges(pledgeFacts); // 비서: 총독 약속 기한은 물어볼 때만 답한다(알파 11)
  setGcPersona({ mem: personaPeek, note: personaNote }); // 총독회의 총독 말투·신뢰(2026-10-23) + 약속 이행·불이행 신뢰 증감(알파 11)
  setRetiredPersona({ mem: personaPeek }); // 은퇴 인물 통신 말투·기억(2026-10-23)
  setExecutionPersona({ note: personaNote }); // 처형을 안 인물의 기억 한 줄(2026-10-23)
  setMemorialExecutionCheck(executionOwnsDeath); // 처형된 인물은 추모·작별과 겹치지 않게(2026-10-23)
  setOfficeCabinet(cabinetReady); setCabinetOfficeNotify(pushOffice); // 집무실 책상 태블릿·「내각 회의가 준비되었습니다」 알람(2026-10-19)
  // 옛 1:1 총독 대화(GOVTALK → 총독 창)는 2026-10-23 사용자 결정으로 뗐다. 총독 일은 집무실 「행성 총독」 칸(총독회의 등)과 비서 업무 보고로.
  router.on(SLOT.GOVTALK, 'main:govtalk', () => { /* 예전 세이브·모드에서 오는 GOVTALK 줄은 받기만 하고 무시한다 */ });
  // SLOT.END: src/features/chat.ts registerChat()
  // SLOT.RESKEY: src/features/council.ts registerCouncil()
  router.on(SLOT.LOADED, 'main:loaded', (m: SllmMessage) => {
    if (m.kind === 'LOADED') {
      link.epoch++; resetCondemnSession(); // Same-save reload also invalidates commands queued before loading.
      // 같은 세이브를 다시 불러와도(과거 자동 저장 포함) 이전 시점의 수락 대기 제안·쌓인 호감은 버린다(2026-10-18). 다른 세이브면 noteSave 가 비운다.
      if (chat.pending || chat.pend) { chat.pending = null; chat.pend = null; toUi('event', pick('세이브를 다시 불러와 수락 대기 중이던 제안을 취소했습니다.', 'The save was reloaded, so the pending proposal was cancelled.')); }
      const sid = cleanSaveId(m.kv.sid); noteSave(sid);
      if (m.kv.date) { gameDate = m.kv.date; if (sid && govMem().trackLoad(sid, m.kv.date, m.kv.tl)) toUi('event', pick('세이브를 과거로 불러와 총독 기억의 시간선이 갈라졌습니다.', 'An earlier save was loaded, so the governor memory timeline branched.')); }
    }
  });
  // SLOT.TALK: src/features/chat.ts registerChat()
  // SLOT.PROFILE: src/features/chat.ts registerChat()
  // SLOT.INBOX_SYNC: src/features/mail-app.ts registerMail()
  router.on(SLOT.TO_UI, 'main:to_ui', (m: SllmMessage) => {
    if (m.kind === 'SYS') return; // 성계 번호표 줄은 화면에 보내지 않는다(알파 11, 많아서)
    toUi('sllm', m);
  });
  registerGameLink(router);
  // F-41: replay never enters the feature router or marks the game ready.
  watcher.on('history', (m: SllmMessage) => {
    link.reqCounter = Math.max(link.reqCounter, reqSeenIn(m));
  });
  watcher.on('message', (m: SllmMessage) => router.dispatch(m));
  watcher.on('reset', () => {
    link.epoch++; resetCondemnSession(); link.runtimeMod = null; link.reqCounter = 0; link.sessionReady = false; link.lastModLineAt = 0; terminal.reset(); modCompatibility.clearLive(); flagProv.setExpectedSid(''); curSaveId = ''; chat.history = []; chat.histories.clear(); chat.talk = null; chat.pend = null; resetConversation(); chat.pending = null;
    profiles.clear(); mail.countries.clear(); idxNames.clear(); playerIdx = 0; playerName = ''; mail.plan.set('', []); mail.roll = []; mail.news = [];
    radioResetForSave();
    toUi('contacts', terminalView()); toUi('talk', null); syncInbox();
  }); // 게임을 다시 켜서 로그가 비워짐
  watcher.start();
  syncP2Ping();
  if (settings.aiMode !== 'custom') p2.login()
    .then(() => toUi('status', pick('Player2 로그인 완료', 'Player2 login complete')))
    .catch((e) => toUi('status', pick('Player2 로그인 실패: ', 'Player2 login failed: ') + e.message));

  // ---- AI 연결 설정: src/features/ai-settings.ts 로 옮김(A-00b 4번)
  registerAiSettings();

  registerTerminal(router); // contactsList·contactsRefresh·contactDial + 로그 자리 TERMINAL (src/features/terminal.ts)
  registerChat(router, noteSave); // chat·accept·finish·reject·forcePeace·apply + 로그 자리 OPSHIFT·KEYBOARD·END·TALK·PROFILE (src/features/chat.ts)

  // ---- 설정과 (실험) 편지
  // 모드 호환 팩 IPC 3개: src/features/environment.ts 로 옮김(A-00b 4번)
  // 버그 신고 묶음 IPC 4개: src/features/support.ts 로 옮김(A-00b 4번)
  registerSupport();
  registerBackstory(autoLore); // backstoryEmpire·backstoryEmpireSet·backstoryPerson·backstoryPersonSet 제국·인물 전기 입력 (src/features/backstory-app.ts) — 2026-10-18
  registerGameDll(); // 게임이 꺼져 있을 때 게임 폴더 DLL 을 앱이 가진 새 DLL 로 바꾼다 (src/features/game-dll-app.ts) — 2026-11-04
  registerAppUpdate(); // 창작마당 모드로 받은 앱 업데이트 알림·교체 (src/features/app-update.ts) — 2026-10-18
  registerSettingsUi(); // getSettings·setPlayer2ClientId·setAiLanguage·setLanguage·setMailEnabled·getCustomCss·openCustomCss (src/features/settings-ui.ts)
  registerWindows(); // 창·런처·알림 카드·게이트·창 설정 IPC 17개 (src/features/windows.ts)
  // 사용자 그림 IPC 6개 + flagFor: src/features/images.ts 로 옮김(A-00b 4번)
  registerImages();
  registerPortraitLib();
  registerMedia(); // mediaGet·mediaSave·mediaBrand·newsList·gossipList·paperOpen·paperClose (src/features/media.ts)
  registerRadio(); // radioGet·radioSelect·radioOff·radioNow (src/features/radio-app.ts)
  // 연설 IPC 5개: src/features/speech-app.ts registerSpeech()
  registerCasino(); // 우주 카지노: 슬롯·룰렛·성간 주사위·블랙잭·포커(판돈은 금고) (src/features/casino-app.ts, 2026-10-30)
  registerParty(); // 관저 파티: 손님 고르기 → 세 장면 → 단체 사진(src/features/party-app.ts, 2026-11-03)
  registerLandmark(); // 성향별 특별한 곳: 의식·인물 대화·공개 연설 (src/features/landmark-app.ts)
  registerBlackmarket(); // 암시장 골목: 희귀 생물·밀수품 흥정, 정보상(궁정 음모 단서·감정), 가짜·단속 (src/features/blackmarket-app.ts)
  registerTavern(); // 뒷골목 선술집: 변장 → 엿듣기(LLM 한 번)·한 잔 돌리기·합석 대화·의심 게이지 (src/features/tavern-app.ts)
  registerPetshop(); // 펫샵: 수조 벽·동물 코너·오늘 들어온 희귀종 (src/features/petshop-app.ts)
  registerBedroom(); // 침실: 가구·액자·진열 배치, 어항·애완동물, 연인·배우자와 대화 (src/features/bedroom-app.ts)
  registerPaparazzi(); // 파파라치: 외출 사건 → 사진 → 매수·무시·고소 → 틀 기사(민심·부패 낌새·외교) (src/features/paparazzi-app.ts)
  registerStore(); // 백화점: 엘리베이터 → 40 리빙관·41 패션·주얼리관(선물)·42 갤러리관·43 스카이 라운지 (src/features/store-app.ts)
  registerOuting(); // 외출: 수도 지도 → 데이트 공원·우주 경기장(나머지 장소는 준비 중) (src/features/outing-app.ts, 2026-10-30)
  registerLog(); // 레전드 오브 갤럭시: 국내 리그·구단·밴픽·토토·은하 올림픽(상금·연봉은 금고) (src/features/log-app.ts, 2026-10-30)
  registerGForum(); // 갤럭틱 포럼: gforumState·gforumRefresh·gforumReply (인터넷 창 네 번째 탭 ui/office-gforum.js, 2026-11-04)
  registerRenameLedger(router); // 굴욕 조항·종속국 개명·AI 개명 요구가 함께 쓰는 RENAME 응답 (src/features/rename-ledger.ts, 2026-11-04)
  registerFleetName(router); // 함대 명명 건: fleetNameState·fleetNameAsk·fleetNamePick + SLOT.FLEETNAME (내각 회의실 ui/cabinet-fleetname.js, 2026-11-04)
  registerColName(router); // 신규 식민지 이름 짓기: colNameState·colNameNotify·colNameAsk·colNamePick + SLOT.COLNAME (src/features/colname-app.ts, 2026-11-04)
  registerGovPolicy(router); // 총독에게 행성 맡기기: govPolState·govPolSet + SLOT.GOVPOL (src/features/govpolicy-app.ts, 2026-11-03)
  registerEmp(router); // 비상대권: empState·empSet + SLOT.EMP (src/features/emp-app.ts, 2026-11-05)
  registerVault(router); // 통치자 개인 금고: vaultState·vaultDeposit·vaultWithdraw·vaultRetry + SLOT.VAULT (src/features/vault-app.ts, 2026-10-30)
  registerCouncil(router); // 의회 IPC 6개 + 로그 자리 RESOLUTION·AGENDA·RESKEY (src/features/council.ts)
  registerGovReport(router); // A-26 총독 홀로그램 보고: govReportState·govReportSay·govReportRetry·govReportClose + SLOT.GOVREPORT (src/features/govreport.ts)
  registerGov(); // govRefresh·govReset·govMemList·govMemAdd·govMemDel·govChat·planetArt·govClose (src/features/gov.ts)
  registerChronicle(); // chronList (src/features/chronicle-app.ts)
  // ---- 경로(게임 사용자 폴더·모드 폴더·세이브·게임 설치) IPC 9개: src/features/environment.ts 로 옮김(A-00b 4번)
  registerEnvironment();
  registerMediation();
  registerSummit(); // 연방 정상회담(A-01 1단계, 시연판): summitState·summitAgenda·summitVote·summitSay·summitApply·summitClose (src/features/summit.ts)
  registerSummitLog(router); // A-01 2단계: SLOT.FEDERATION(FED·FEDMEMBER·FEDLAW·FEDEND) — 앱이 물었을 때만 모은다
  registerDevTools(router); // 개발자 모드 전용: 게임 없이 새 기능 화면 시험(src/features/dev-tools.ts)
  registerMail(router);
  registerDinner(router);
  registerEspionage(router); // + SLOT.SPY_APPLY 첩보 제재 게임 적용 응답
  registerPolicy(router); // + SLOT.POLICY 정책 퀘스트(집무실 정책 칸) — 2026-10-18
  registerPeople(router); // + SLOT.PEOPLE 내 지도자 명단(집무실 연락처) — 2026-10-18
  registerPersona(); // personaInfo·personaOpen·personaSay·personaEnd 집무실 인물 대화+기억 — 2026-10-18
  registerLetters(); // 개인 서신: 6개월마다 후보 중 무작위, 열 때 본문 — 2026-10-18
  registerSecretary(router); // + SLOT.SECRETARY 집무실 비서(업무 보고·지식·연애) — 2026-10-18
  registerMemorial(); // 작별·추모관: 사망 → 비석(명예의 전당), 해임·행방 불명 → 떠난 사람들 — 2026-10-18
  registerPrivateRooms(router);
  registerOffice(); // officeState·officeOpen·officeClose·officePlanets 집무실(홀로그램 바탕화면) — 2026-10-18
  registerOfficeStyle(); // officeStyle·officeStyleSet 집무실 종류(제국 가치관별 배경) — 2026-10-19
  registerIndependence(); // 반란·독립 → 부모 제국 기록·연대기 + 「독립 선언문」 서신 — 2026-10-19
  registerPetitions(router); // + SLOT.PETITION 시민 청원(집무실 바탕화면) — 2026-10-19
  registerEmbassy(router); // + SLOT.EMBASSY 대사관 보고서(집무실 바탕화면) — 2026-10-19
  registerMusic(); // 국가·군가(집무실 바탕화면, 앱 전용) — 2026-10-20 알파 10 앞당김
  registerMood(); // 민심(시민 지지도) 화면 자료 — 2026-10-20 알파 10
  registerCivic(router); // + SLOT.CIVIC 시민 정치: 여론조사·국민투표 기록·특별사면(src/features/civic-app.ts) — 2026-11-03
  registerPreftl(router); // + SLOT.PREFTL 원시문명 관측: 목록·변화 기록·관찰 보고서(src/features/preftl-app.ts) — 2026-11-03
  registerPreftlNet(); // 원시문명 인터넷 염탐: 원자력 시대부터 그들의 컴퓨터망 게시판(src/features/preftl-net-app.ts) — 2026-11-04
  registerAudit(); // 국정감사: 12년마다, 결과 수정자는 CIVIC 회신(src/features/audit-app.ts) — 2026-11-03
  registerNoconf(); // 불신임: 지지율 25%(감사 논란 땐 30%) 아래 석 달 → 불신임안, 결과 수정자는 CIVIC 회신(src/features/noconf-app.ts) — 2026-11-03
  registerLobby(); // 로비: 이익단체의 공식 지원·뒷돈, 효과는 CIVIC 회신(src/features/lobby-app.ts) — 2026-11-03
  registerTwoParty(); // 양당 정치: 의회 파벌을 두 거대 정당으로 묶고 지지율·대정부 질문·총선(src/features/twoparty-app.ts) — 2026-11-06
  registerParliament(); // 여당·야당: 의석·연정·야당 대표·원내 공방, 효과는 CIVIC 회신(src/features/parliament-app.ts) — 2026-11-03
  registerEnclave(); // 엔클레이브·캐러밴 소식: 축제 개막·소동·캐러밴 도착(알파 11, 2026-10-25)
  registerSystems(router); // 성계 번호표(SYS)·대화에서 언급된 성계 지도 이름표 + SLOT.SYSTEMS
  setCrisisDoc((kind, since, ended) => { const sid = curSaveId; if (sid) { const allies = pactAllies(); issueDoc(sid, { issuer: 'crisis', kind: 'crisis', date: since, closedOn: ended, ref: kind, nation: playerName || undefined, ...(allies.length ? { allies } : {}) }); } }); // 은하 위기 극복 기록(알파 11) · 함께 싸운 제국(공동 대응 협약)
  setCrisisCalm(() => endAllPacts()); // 적대 위기가 모두 끝나면 공동 대응 협약도 끝(알파 11)
  registerFallen(router); // 몰락제국 각성: 가로챈 신호·특별판 + SLOT.FALLEN
  registerGestaltReport(router); // 동기화 로그·공명 보고 + SLOT.GESTALT(이탈 노드)
  registerGestalt(); // 단일 의식 말투: 따로 뜨는 창이 플레이어 제국 종류를 묻는다(알파 11)
  registerEmotions(router); // 감정 기억 4종: 통신 목록마다(3달에 한 번) 쌓고 옅어짐 + SLOT.EMOTIONS
  registerChildren(router); // 통치자의 아이: 해마다 탄생 판정·양육 사건·청소년 대화·성인식(create_leader) + SLOT.CHILDREN(2026-10-27)
  registerDeals(router); // 외교 거래: 설득 확률·묶음 거래·조공 평화·갈고리·참전 요청 + SLOT.DEALS(2026-10-26)
  registerUsage(); // 한 달 사용량: 월간 상황마다 진단 기록 usage.month(2026-11-09)
  registerSaveSignals(router); // + SLOT.SAVESIGNAL 세이브 다시 읽기는 바뀜 신호 때만(통치자 교체·첫 접촉·불러옴·우리 정부·12달) — 2026-11-09
  registerKhan(router); // 그레이트 칸 특별 대우: 등장 때 한 번 조사 → 선물·칸의 총애 + SLOT.KHAN(2026-10-26)
  registerFrontier(router); // 국경·전선: 대화·회의 전에 이웃·맞닿은 성계·점령 읽기 + SLOT.FRONTIER(2026-10-26)
  registerMarauders(router); // 약탈자 대응: 위협·습격 돌리기·용병 흥정 + SLOT.MARAUDER(2026-10-26)
  registerCollectibles(router); // 상인 수집품 구매·골동품 진열장·국가 문서함(알파 11, 2026-10-25) + SLOT.ENCLAVE_SHOP
  registerHoi(router); // aidStart·aidStop·fsupStart·autoRights + SLOT.HOI(2026-10-28)
  registerDayMood(); // 분위기 태그 · 비서 아침 인사 · 라디오 짧은 꼭지(2026-10-28)
  registerCourt(router); // courtView·courtTree·courtAct·courtFree·courtRename + SLOT.COURT(2026-10-28 정치)
  registerMemoryLinks(router); // 들은 말 퍼지기(SLOT.MEMORY)·연대기 상한 → 장(章) 압축(2026-10-28)
  registerInternet(); // internetState·Open·Refresh·Post·Write·Reply·Nick·Follow·Influencer·Promo 인터넷(2026-10-28)
  registerDebate(); // 신문·라디오 찬반 논평 — 2026-10-20 알파 10
  registerScandal(); // 비방 공작 → 신문 추문·대응 — 2026-10-20 알파 9
  registerAgents(); // 첩보망 = 공작원 인물(이름·암호명·위장·연락 두절) — 2026-10-20 알파 9
  registerNationalEvents(router);
  registerOfficialHolidays(router);
  registerProtests(router); // + SLOT.PROTESTS 시위(집무실 「시위」) — 2026-10-23 초안
  registerEmergency(); // 긴급회의(집무실 「긴급회의」 → 회의실) — 2026-10-23 초안
  registerPolitics(); // 정치적 지위 장부: 인물 카드 standingInfo — 2026-10-23 초안
  registerRelations(router); // + SLOT.RELATIONS 인물 관계: 사교회(집무실 「사교회」)·인물 카드 인간관계·불만 특성 — 2026-10-23 초안
  registerRomance(); // 통치자 연애: 인물 카드 버튼 → 데이트 지도(date-park.html)·고백·청혼·결혼식 — 2026-10-23 초안
  registerChess(); // 지도자와 체스: 사교회·만찬에서 우리 지도자·다른 제국 통치자와(2026-10-30)
  registerGc(); // 행성총독회의: 격년 11월 정기·긴급 소집(집무실 「총독회의」 → gov-council.html) — 2026-10-23 초안
  registerHolidays(); // 행성 기념일: 설립 1년 뒤 AI 가 제목·설명, 당일 방문 → 그 행성에 효과(「국가 행사날」 창) — 2026-10-23 초안
  registerRetired(); // 은퇴 인물: LEADEROUT·명단 → 은퇴 기록, 집무실 「은퇴 인물」 통신 — 2026-10-23 초안
  registerFbanquet(router); // + SLOT.FOREIGN_BANQUET 타국 만찬: 매월 초대 판정, 집무실 「초대장」 → banquet.html?mode=foreign — 2026-10-23 초안
  registerFletters(); // 타국 지인 서신: 집무실 「초대장」의 타국 지인 칸, 답장은 다음 게임 달 — 2026-10-23 초안
  registerExecution(); // 처형: 인물 카드 「처형…」 → 최종 확인 → kill_leader, 아는 인물만 반응 — 2026-10-23 초안
  registerWorkshop(); // 창작마당 애드온: 구독 폴더는 읽기만, 「설치」하면 앱 애드온 폴더로 복사(꺼진 채) — 2026-10-23 초안
  registerLore(); setPromptAugment(loreForPrompt); // 세계관 팩 서재: 집무실 「서재」, AI 참조는 캠페인별로 켠 world 책 요약만 — 2026-10-23 초안
  setPromptAugment((p) => [loreForPrompt(p), scenarioForPrompt(p)].filter(Boolean).join('\n\n')); // 위 서재 세계관 + 시나리오 배경·대립 긴장도(src/features/scenario-app.ts, 2026-11-05)
  registerIsc(router); // + SLOT.ISC 성간 임시회의(집무실 「성간 임시회의」 → 회의실) — 2026-10-23 초안
  registerCeremony(router); // 출정 의식(복무신조 전체화면 낭독) — 2026-10-20
  registerCondemn(router); // + SLOT.CONDEMN 규탄 성명(WARVOICE → 판정·알림·호감) — 2026-10-20
  registerDeclare(router); // + SLOT.DECLARE 전쟁 선언문(전쟁 시작 알림 → 선언문 → 낭독 방송 → 출정 의식) — 2026-10-20
  registerCrisis(router); // + SLOT.CRISIS 은하 위기 특집 방송(신문 특별판·라디오 긴급 특별 방송) — 2026-10-17
  registerTts(); // ttsAiCheck·ttsAiSpeak 라디오 AI 음성(OpenAI /audio/speech) — 2026-10-17
  registerChronBook(); // chronBookExport 연대기 책 내보내기(HTML/PDF) — 2026-10-17
  registerFleet(router); // + SLOT.FLEET 함대 사령부(제독 전투 기록·청문회) — 2026-10-17
  registerGalaxy(router); // + SLOT.WARROOM 함대 명령·작전 회의(2단계). 작전지휘실 은하 지도: 세이브에서 성계·항로·영토·함대를 읽어 함대 사령부 창에(src/features/galaxy-app.ts) — 2026-11-05
  registerInfamy(router); // + SLOT.INFAMY 악명·전쟁범죄: 폭격·행성 말살·숙청·포로 처형 기록, 외교 대화·비서·연대기에 알림(src/features/infamy-app.ts) — 2026-11-04
  registerCaptive(router); // + SLOT.CAPTIVE 사로잡은 적 제독: 심문실 LLM 대화·몸값·심문·회유·처형·석방(src/features/captive-app.ts) — 2026-11-04
  registerFleetOrder(router); // + SLOT.FLEETORDER 자동 작전: 해군 작전·수리 복귀·제독 무전(src/features/fleetorder-app.ts) — 2026-11-04
  registerCyber(router); // + SLOT.CYBER 해외발 여론 공작 상황 → 공작 장부·알림·연대기(src/features/cyber-app.ts) — 2026-11-04
  registerTemper(router); // + SLOT.TEMPER 외교 노선: AI 제국 성향 변화·노선 공작·은하 판세(src/features/temper-app.ts) — 2026-11-04
  registerBudget(router); // + SLOT.BUDGET 예산 회의: 장관 예산 요청·집행·매달 차감(src/features/budget-app.ts) — 2026-11-04
  registerVassalCourt(router); // + SLOT.VASCOURT 종속국 통치: 조공 감면 요청·감독관 파견·계약 재협상 반응(src/features/vassal-court-app.ts) — 2026-11-04
  registerVassalAdmin(router); // + SLOT.VADMIN 종속국 행정: 성계 이양·기술 원조·동화 정책, 거래 「성계 할양」 공용(src/features/vassal-admin-app.ts) — 2026-11-04
  registerVassalReign(router); // + SLOT.VREIGN 종속국 통치권: 괴뢰 통치자·대리전 지시·간섭 반감·정책 동조·종속국 쟁탈 전쟁명분(src/features/vassal-reign-app.ts) — 2026-11-05
  registerScenario(router); // + SLOT.SCENARIO 시나리오 알아보기(src/features/scenario-app.ts) — 2026-11-05
  registerScenarioMap(router); // + SLOT.SCNMAP 시나리오 은하 지도: 섹터·총독 초상화(src/features/scenario-map-app.ts, 시나리오 전용) — 2026-11-06
  registerTension(router); // + SLOT.TENSION 대립 긴장도(src/features/tension-app.ts, 시나리오 전용) — 2026-11-05
  registerRebels(router); // + SLOT.REBELS 반란과 공작(src/features/rebels-app.ts) — 2026-11-05
  registerOverlordPressure(router); // + SLOT.OVPRESS 역방향: AI 종주국 명령(대리전·징발·헌납·감시관)·동조·간섭 반감·AI 의 종속국 쟁탈(src/features/overlord-pressure-app.ts) — 2026-11-05
  registerAlarm(router); // + SLOT.ALARM 일정표: 게임 숨은 재사용 대기 매달 읽기·알림·비서 보고·상황 막대(src/features/alarm-app.ts) — 2026-11-04
  registerVassal(router); // + SLOT.VASSAL 종속국 통신 채널(청원 결과 적용 응답·타이머 서신) — 2026-10-17
  registerPress(router); // + SLOT.PRESS 언론사 인터뷰(시행령 준비·월 신호·버프 확인) — 2026-10-17
  registerEffectVerifier(router);
  registerConversationFavors(router);
  registerArchive(router); // 대보관소 표본 읽기(알파 6 수집품 1단계)
  registerPeace(router); // SLOT.PEACE 평화 중재·강제 평화 게임 연결 (src/features/peace-app.ts)
  registerBanquet(); // inbox·openLetter + 로그 자리 MAIL·INBOX_SYNC (src/features/mail-app.ts). replyLetter 는 단말기와 함께 옮김
  // replyLetter: src/features/mail-app.ts registerMail()

  // accept·finish·reject·forcePeace·apply: src/features/chat.ts registerChat()
});

app.on('window-all-closed', () => quitAll());






