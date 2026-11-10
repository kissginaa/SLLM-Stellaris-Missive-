// A-00b 3번: 게임 로그 줄(SLLM:...) 분배기.
// 원래 main.ts의 watcher.on('message') 한 함수 안에 순서대로 붙어 있던 처리를 "자리 번호" 순으로 부른다.
// 처리마다 순서에 의미가 있다(예: 세이브 번호·날짜를 먼저 정한 뒤 다른 기능이 읽음). 기능 모듈이 어느 순서로 등록하든
// 자리 번호 순서대로 불리므로, 처리를 다른 파일로 옮겨도 순서가 바뀌지 않는다. 같은 번호는 쓰지 않는다(selftest가 검사).
// 한 처리가 예외를 던지면 그 줄의 나머지 처리는 건너뛴다(원래 한 함수였을 때와 같은 동작).
import type { SllmMessage } from '../protocol';

/** 2026-10-15 main.ts watcher 안의 원래 순서. 새 처리는 사이 번호를 쓴다. */
export const SLOT = {
  STATS: 10,          // 신호 수 세기·진단 기록
  HELLO: 20,          // 연결 모드 정보, HELLO 응답 대기
  COMPAT_FEED: 30,    // 모드 호환 팩에 모든 줄 전달
  ETHIC_END: 40,      // 가치관 조회 끝
  COMPAT_EVENT: 50,   // 호환 팩 사건 → 연대기·라디오
  CONTACT_BEGIN: 60,  // 연락처 목록 시작(세이브 번호)
  TERMINAL: 70,       // 연락처·단말기 응답
  EMOTIONS: 75,      // 감정 기억 4종: CONTACT_END 뒤 통신 목록으로 3달마다 계산(알파 11, 2026-10-25)
  SYSTEMS: 76,       // 성계 번호표 SYS_BEGIN·SYS·SYS_END + CONTACT_END 때 기한 지난 지도 이름표 치우기(알파 11, 2026-10-25)
  GESTALT: 77,       // 단일 의식 이탈 노드 DEVIANT(월간 상황 안, 알파 11, 2026-10-25)
  FALLEN: 78,        // 몰락제국 각성 알림: CONTACT_END 때 몰락 → 각성 바뀜 찾기(알파 11, 2026-10-25)
  LINE_DATE: 80,      // 로그 줄 앞의 게임 날짜
  REQSEEN: 90,        // 게임이 본 요청 번호 학습(game-link)
  OPSHIFT: 100,       // 호감 변화
  ACK: 110,           // 행동 결과(game-link)
  RESOLUTION: 120,    // 은하 공동체 안건 알림
  AGENDA: 130,        // 의회·라디오 사건(onAgendaSignal)
  PLANETS: 140,       // 행성 목록
  MAIL: 150,          // 서신·뉴스·제국 번호(onMailSignal)
  SAVESIGNAL: 151,    // 세이브 다시 읽기 신호: LOADED·NEWS ruler·EVT first_contact → flagProv.markStale(features/save-signal-app.ts, 2026-11-09)
  KEYBOARD: 160,      // 게임 안 키보드 입력
  SPEECH_PF: 170,     // 연설 프로필·상황
  SPEECH: 180,        // 연설 준비·적용
  GOVTALK: 190,       // 총독과 대화 결정
  END: 200,           // 게임 안 창 대화 끝
  RESKEY: 210,        // 안건 종류 알림
  LOADED: 220,        // 세이브 불러옴(날짜·총독 기억 시간선)
  TALK: 230,          // 대화 시작
  PROFILE: 240,       // 상대 프로필
  GOVREPORT: 245,     // 새해 총독 보고 요청(A-26)
  FEDERATION: 247,    // 연방 읽기 FED·FEDMEMBER·FEDLAW·FEDEND(A-01 2단계)
  FACTION_MEET: 249,  // 내정·파벌 회의 적용 확인(FACMEET) — 2026-10-16
  GAMESTATE: 248,    // 월간 상황(STATE_*·WAR·FACTION·SPYNET·SUBJECT)·출신(ORIGIN)·첩보 작전(SPYOP) — 2026-10-16 초석
  FAVORS: 254, // 외교 대화 호의 정산 응답
  ARCHIVE: 258,       // 대보관소 표본 읽기 ARCHIVE_BEGIN·ARCHIVE·ARCHIVE_EXH·ARCHIVE_END — 2026-10-17 알파 6
  GIFT: 255,          // 만찬 자원 선물 창고 확인·전달 응답(GIFT) — 2026-10-17 알파 6
  PEACE: 256,         // 평화 중재·강제 평화 MEDWAR·MEDSYS·MEDGIVE·끝 줄 — 2026-10-17
  SPY_APPLY: 257,     // 첩보 대응 제재 적용 응답(SPYAPPLY) — 2026-10-17
  EFFECT_VERIFY: 253, // 개발자 효과 검증 응답
  DINNER: 252,        // Dinner calendar and in-game reception receipts
  INBOX_SYNC: 250,    // 서신함 동기화
  FLEET: 246,         // 함대 사령부: BATTLE·BATTLESYS·BATTLEADM 전투 기록, ADMAPPLY·ADMEXPIRE 청문회 특성 — 2026-10-17
  VASSAL: 251,        // 종속국 청원 결과 적용 응답(VASSALAPPLY) — 2026-10-17
  SECRETARY: 241,     // 비서: 호출할 때 받는 최신 경제 수치(SPEECHCTX 응답 짝 맞추기) — 2026-10-18
  POLICY: 242,        // 정책 퀘스트: 측정 POLICYM·POLICYC·POLICYO, 적용 POLICYAPPLY — 2026-10-18
  PEOPLE: 244,        // 집무실 연락처: 내 지도자 명단 LEADER·LEADERAT·LEADER_END(매달) — 2026-10-18
  CRISIS: 243,        // 은하 위기 감시 CRISIS·CRISIS_END(매달) → 신문·라디오 특별 편성 — 2026-10-17
  PETITION: 238,     // 시민 청원 결정 적용 응답(PETITIONAPPLY) — 2026-10-19
  EMBASSY: 239,      // 대사관 보고서 EMBFAC(파벌)·EMBASSY(끝 줄) — 2026-10-19
  PRESS: 259,         // 언론사 인터뷰 준비·적용(PRESS)·월 신호로 준비 완료 — 2026-10-17
  CEREMONY: 237,     // 출항 의식 군사 함대 조회
  RELATIONS: 228,    // 인물 관계: 사교회 식량 납부 SOCIALPAY·불만 특성 DISCONTENT 응답(2026-10-23 초안)
  HOI: 217,         // 하츠 참고 외교: 물자 지원 적국 AIDEN·AIDEND, 파벌 공작 FSUP, 종속국 독립 AUTOFREE(2026-10-28)
  MEMORY: 218,      // 들은 말 퍼지기: 상대의 동맹·우호국 RUMORNET·RUMORNETEND(2026-10-28 ChatSyncAuto 참고)
  CIVIC: 214,      // 시민 정치: 여론조사·국민투표·특별사면 효과 응답 CIVIC(2026-11-03)
  PREFTL: 215,     // 원시문명 관측 PFTL·PFTL_END(2026-11-03)
  RENAME: 206,     // 이름의 정치: 개명 전 이름 RENAMEOLD·결과 RENAME(굴욕 조항·종속국 개명·AI 요구, 2026-11-04, src/features/rename-ledger.ts)
  FLEETNAME: 207,  // 함대 명명 건: 전투 기록 BATTLE·BATTLESYS·BATTLEADM 다시 묶기 + 이름 바꾸기 응답 FLEETNAME(2026-11-04, src/features/fleetname-app.ts)
  COLNAME: 208,    // 신규 식민지 이름 짓기: 개척 알림 COLNEW·이름 바꾸기 응답 COLNAME(2026-11-04, src/features/colname-app.ts)
  GOVPOL: 211,     // 총독에게 행성 맡기기: 방침 표식 응답 GOVPOL(2026-11-03, src/features/govpolicy-app.ts)
  EMP: 192,        // 비상대권: 상태·올리기·내리기·쥐기 응답(req) + 전쟁 끝남·굳음·반발 EMP(2026-11-05, src/features/emp-app.ts)
  GOVQUOTA: 193,   // 행성 할당량: 매기기·거두기 응답(req) + 단계·버거움·완수·무너짐 GOVQUOTA(2026-11-05, src/features/govpolicy-app.ts)
  GOVBUILD: 194,   // 총독이 지은 것: 완성·되돌림 GOVBUILD(왜 지었나 why 포함, 2026-11-05, src/features/govpolicy-app.ts)
  VAULT: 212,      // 통치자 개인 금고 넣기·빼기 응답 VAULT(2026-10-30)
  FLEETORDER: 213, // 자동 작전: 매달 사건 FOEV·FOEVF·FOEVS, 보고 FOREP·FOOP·FOOPF·FOOPS·FOFL·FOREP_END, 응답 FOSET(2026-11-04)
  CYBER: 204,     // 해외발 여론 공작 상황: 시작·단계·대응·결말 CYBER(2026-11-04, src/features/cyber-app.ts)
  INFAMY: 197, // 악명·전쟁범죄: 범죄 ATROC · 우리 단계 INFTIER · 악명 목록 INFY·INFEND(2026-11-04, src/features/infamy-app.ts)
  WARROOM: 198, // 작전지휘실 2단계: 보고 WRREP·WRFL·WRSYS·WRWAR·WREND, 함대 명령 응답 WRSET(2026-11-05, src/features/galaxy-app.ts)
  CAPTIVE: 201, // 사로잡은 적 제독: 사로잡음 CAPFROM·CAPTURE, 처리 응답 CAPSET(2026-11-04, src/features/captive-app.ts)
  ALARM: 261,     // 일정표·쿨다운 알림: 읽기 ALARM·ALARMEND · 상황 막대 ALARMSET(2026-11-04, src/features/alarm-app.ts)
  MTRANSFER: 187, // 정기 송금: 칸 적기·지우기 응답 MTSET · 매달 사건 MT(못 냄 short·끊김 stop·다 냄 end — 잘 낸 달은 줄 없음, 2026-11-09, src/features/mtransfer-hub.ts)
  SCNMAP: 188,   // 시나리오 은하 지도: 섹터·총독 SCNSECBEG·SCNSEC·SCNSECEND(시나리오 모드가 매달 찍음, 2026-11-06, src/features/scenario-map-app.ts)
  SCENARIO: 189, // 시나리오 알아보기: SCN·SCNN·SCNSEAT(시나리오 모드가 찍음, 2026-11-05, src/features/scenario-app.ts)
  TENSION: 191,  // 대립 긴장도(시나리오 전용): TNN·TN·TNST·TNWAR·TNPEACE·TNADD·TNQ(2026-11-05, src/features/tension-app.ts)
  REBELS: 195,   // 반란과 공작: 후원 RBQ·RBSET·RBAFF·RBAF, 취약 RBVF·RBV, 선동 RBSOWP·RBSOW·RBASF·RBASP·RBAS(2026-11-05, src/features/rebels-app.ts)
  OVPRESS: 196,  // 역방향: AI 종주국 명령·AI 이웃의 종속국 쟁탈 VOPZ(2026-11-05, src/features/overlord-pressure-app.ts)
  VREIGN: 199,   // 종속국 통치권: 후보 VRLDR·VRLEND·VRTGT·VRTEND·VRPZ·VRPZEND, 이름 VRNAME, 동조 VRALN, 적용 VRSET, 대리전 VRPXW, 전쟁 결말 VRWAR(2026-11-05, src/features/vassal-reign-app.ts)
  VADMIN: 202,    // 종속국 행정: 성계 목록 VADMSYS·VADMEND · 적용 VADMSET · 우리 연구량 VADMRES(2026-11-04, src/features/vassal-admin-app.ts)
  VASCOURT: 203, // 종속국 통치: 감면 액수 VCCTX · 적용 응답 VCSET · 환급 못 함 VCSHORT · 계약 재협상 반응 VCAGR(2026-11-04)
  TEMPER: 205, // 외교 노선: 판세 읽기 TMPC·TMPTOP·TMPEND(해마다 1월 req=0·새로 관측), 성향 바꾸기 TMPSETP·TMPSET, 공작 비용 TMPPAY(2026-11-04)
  BUDGET: 209, // 예산 회의: 소집 읽기 BUDCTX, 집행·중단 응답 BUDSET, 매달 BUDSTOP(국고 부족)·BUDEND(기간 끝)(2026-11-04)
  COURT: 216,       // 정치: 음모 대응·수감·추방·망명·혼인 동맹 COURT(2026-10-28 월드박스·토탈워 참고)
  CHILDREN: 219,     // 통치자의 아이: 성인식 CHILDADULT·후계자 CHILDHEIR 응답 — 2026-10-27
  DEALS: 221,         // 외교 거래 DEALX·DEALCTX(읽기)·DEAL(적용·매달 지급·호감·참전)·DEALAW·DEALAWEND(동맹 방어 전쟁) — 2026-10-26
  KHAN: 222,          // 그레이트 칸 특별 대우 KHAN·KHANGIFT(조사·선물 응답)·KHANFAVOR(칸의 총애 붙음·뗌) — 2026-10-26
  FRONTIER: 223,      // 국경·전선 읽기 FRSYS·FR_END(외교 대화·성간 회의 프롬프트) — 2026-10-26
  ISC_QUEST: 224,     // 성간 임시회의 과제: 측정 ISCQO·ISCQM, 자원 건네기 ISCQGIFT, 퀘스트 효과 QUESTAPPLY — 2026-10-26
  ENCLAVE_SHOP: 225,  // 상인 수집품 결제 COLPAY(알파 11, 2026-10-25)
  MARAUDER: 226,      // 약탈자 대응 MRD(상태·위협·돌리기·용병 흥정 응답)·MRCREF(용병 할인 정산) — 2026-10-26
  FOREIGN_BANQUET: 227, // 타국 주최 만찬 참석자 FBGUEST·FBGUEST_END(2026-10-23 초안)
  ISC: 229,          // 성간제국통신임시회의 참가 후보 ISCSEAT·ISC_END(2026-10-23 초안)
  PROTESTS: 231,     // 시위 자료 PROTPLANET·RIGHTS(월간 상황 안) + 해산 응답 PROTESTDISPERSE — GAMESTATE(248)보다 먼저 모아 둔다(2026-10-23)
  OFFICIAL_HOLIDAYS: 232,
  ROOM_TROPHIES: 233, // Paid trophy receipt
  NATIONAL_EVENTS: 234, // National calendar and ceremony reward acknowledgements
  CONDEMN: 235,       // 규탄 성명: WARVOICE·WARVOICE_END 제국별 관계 → 판정(2026-10-20 알파 10)
  DECLARE: 236,       // 전쟁 선언문: EVT war_start → 알림(2026-10-20 알파 10)
  TO_UI: 260,         // 화면에 원본 신호 전달(맨 끝)
} as const;

export type LogHandler = (m: SllmMessage) => void;

export class LogRouter {
  private hs: { slot: number; name: string; fn: LogHandler }[] = [];
  /** slot 자리에 처리를 건다. 같은 자리는 한 번만. */
  on(slot: number, name: string, fn: LogHandler): void {
    if (this.hs.some((h) => h.slot === slot)) throw new Error(`log-router: 자리 ${slot} 이미 사용 중 (${name})`);
    this.hs.push({ slot, name, fn });
    this.hs.sort((a, b) => a.slot - b.slot);
  }
  /** 처리마다 문 판정(이름 → 꺼졌나). 시나리오에서 잠긴 기능의 줄은 그 기능에 보내지 않는다(2026-11-08). */
  gate: ((name: string) => boolean) | null = null;
  dispatch(m: SllmMessage): void { const g = this.gate; for (const h of this.hs) { if (g && g(h.name)) continue; h.fn(m); } }
  /** 등록된 처리 이름(부르는 순서) — selftest·진단용 */
  names(): string[] { return this.hs.map((h) => `${h.slot}:${h.name}`); }
}
