## 2026-10-20 알파 9 설치기·앱 업데이트 묶음 (GPT)

- 사용자 요청으로 0.1.0-alpha.9 제작 완료. 최신 코드·세이브 전환 수정 포함. 서명/629개 해시/이전 버전에서 업데이트 인식 확인. 상세: docs/RELEASE_ALPHA9_BUILD_20261020_KO.md.
- 자동 검사 3047 통과·기존 경로 차이 4 실패(제작 도구의 기존 예외 적용), 회귀 9 통과. 실제 설치·게임·외부 업로드 미실시.

## 2026-10-19 알파 8 준비 (최신, 집 PC · 버전 0.1.0-alpha.8)

- 알파 7 은 2026-10-18 창작마당에 올라간 상태(구독 폴더 descriptor alpha.7 확인) → 이번 배포는 알파 8. 그 뒤 들어온 항목(내각 회의·의제 19개·파라곤·대사관·몰락한 제국·비서·시민 청원·독립 선언·화면 정리·집무실 꾸미기·정책 파벌 심사·영어 마무리·오늘 고친 문제)은 알파 8 로.
- 패치노트는 이제 `창작마당_변경사항_0.1.0-alpha.8.txt`(새 파일, 루트)와 RELEASE_NOTES_KO/EN(첫머리 알파 8, 그 아래 「알파 7(이전 배포)」)에 적는다. 알파 7 txt 는 기록으로 둠. 비서는 공개 패치노트에 「비서 추가」 한 줄만(사용자 규칙).
- 버전 표기 alpha.8: package.json·lock(실행 앱·payload), tester-mod descriptor·HELLO(실행 앱·payload·문서 sllm_missive_tester·문서 sllm_missive), 문서 sllm_missive descriptor·sllm_missive_tester.mod, installer/setup.nsi, README_KO·ALPHA_SETUP_KO/EN. selftest ALL PASS.
- 업로드 원본 문서\mod\sllm_missive 를 실행 앱 tester-mod 와 맞춤(people_events·probe_mail·scan·terminal). dist/workshop_0.1.0-alpha.8 폴더는 아직 없음(설치기 스크립트는 없으면 문서 폴더에만 앱 업데이트 묶음을 넣음).

## 2026-10-19 집 PC 실기 로그 검수 (최신 · 모드 2개 파일 4곳 + selftest)

- error.log: 새 의제 agv 조건(sllm_probe_scan) 오류 없음, COUNCILAG agv=3(무한한 기회+진화하는 사회) 정상. 진화하는 사회 채택이 게임에 적용됨(사용자 확인).
- error.log: sllm_people_events.txt 의 has_skill 이 4.x 에 없는 트리거 → 지도자 레벨(lv)이 늘 0. has_base_skill 로 바꿈(script_documentation/triggers.log 확인).
- error.log: on_ruler_set 뉴스(sllm_mail.12)가 게임 시작 직후 번호 없는 나라에서 불려 "Unknown property sllm_idx" → is_variable_set = sllm_idx 일 때만 기록(앱은 원래 a 가 비면 무시).
- game.log 연락처 206줄로 판정 재확인: 몰락한 제국 ct=2, 공허충·채굴 드론·티얀키·아메바·크리스탈·장막·블루우르·원시 등 모두 차단, 고립 거주지·약탈자·일반 제국만 연결.
- 남은 경고(무해): sllm_probe_planets 의 첫 실행 변수 경고(값은 정상 기록), 다른 모드들의 supported_version·현지화 경고.

## 2026-10-19 청원 본문 JSON 노출 · 내각 채택 결재판 (최신, 집 PC · 실행 앱·payload src 3개 + ui 1개)

- 실기: 청원 본문이 `{ "title": "…", "text` 그대로 저장·표시(AI 답이 JSON 중간에서 끊김). petition.ts readPetition(온전/펜스/끊긴 JSON/평문, 끊긴 text 는 마지막 완성 문장까지)·petitionTextOk(40자 이상, JSON 조각 아님). petition-app: maxTokens 900→1600, 본문이 모자라면 한 번 더 요청, 그래도 없으면 저장하지 않고 오류. petitionView 가 예전 깨진 항목을 보여 줄 때 살림(본문이 없으면 한/영 안내 한 줄).
- 실기: 내각 채택 확인이 윈도 confirm 창(「짜친다」) → cabinet-room.html 안의 홀로그램 결재판 #seal(내각 결재·날짜·안건·발의/공동 발의·효과 칩·효력 1년, 「더 논의하기」/「채택」, 채택 시 도장 효과). Esc·바깥 = 취소, Enter = 채택. 한/영.
- selftest 블록 추가, PASS 2551 / FAIL 0. 헤드리스로 결재판 확인.

## 2026-10-19 게임 폴더 확인 작업 — 평의회 의제 19개 · 파라곤 배경 (최신, 집 PC · 실행 앱·payload src 8개 + 모드 sllm_probe_scan.txt 4곳, 게임 미검수)

- 집 PC 게임 폴더(F:\SteamLibrary\steamapps\common\Stellaris)의 common/council_agendas 를 읽어, 가치관이 아닌 평의회 의제 19개(infinite_opportunities·evolving_society·conquer_nature·build_relations·chart_the_unknown·civil_exclusion·superior_colonies·inner_stability·open_markets·favored_society·departmental_efficiency·rightful_claims·oppose_the_fallen·military_buildup·second_strike·leadership_conditioning·pioneer_politics·impenetrable_border·uncover_secrets)를 추가. 모드 COUNCILAG 줄에 agv(비트마스크, 게임 potential+allow 조건 그대로) → gamestate agendaAvail → faction-meeting agendaGameKey(ag, eth, agv)가 avail 비트로 판정. 이름은 게임 한국어 이름. cabinet-meeting DOMAIN_AGENDAS 에 직책별로(전통 의제 먼저) 넣고 AGENDA_EN 추가.
- 파라곤: src/paragons.ts(새). 게임 이벤트에서 확인한 20명 [이름 키, 설명 키, 한마디 키] 대응표만 두고, 글은 실행 중에 게임 localisation(korean/english 의 *paragon* yml)에서 읽음(복사 안 함). 지도자 이름이 그 이름(한/영)과 같으면 persona 1:1 통신·talk·내각 회의(paragonBackground)에 배경 지시. 집 PC 게임 지역화로 40/40 이름 확인.
- 확인한 트리거 의미(script_documentation/triggers.log): relative_power 방향, has_claim, intel, has_casus_belli, is_idle(지도자 범위) — 대사관 쪽 쓰임 맞음.
- tsc 깨끗, selftest ALL PASS(격리 환경).
- 같은 날 집 PC 앞선 수정(이 파일 아래 항목에 없으면 여기 기록): 거짓 퇴임 알림(자리표시 통치자 키·dropFalseRetire), 집무실 은하 뉴스 글자색(paper.html 디스플레이 지면), 몰락한 제국 판정(모드 CONTACT 줄 ct 번호 → contactTypeKey), 공허충·공허 추출 사업부 등 통신 차단(mod-compat VANILLA_NO_CONTACT), 은하 공동체 결의안 알림 반복(stage vote/passed/failed·resume 제외).
- 게임 검수 필요: 모드 agv 조건 안의 has_paragon_dlc·is_wilderness_empire·is_regular_empire·has_overlord_dlc·has_nemesis·is_homicidal 이 오류 없이 읽히는지(error.log), 파라곤은 앱 설정의 게임 폴더를 알아야 작동.

## 2026-10-19 비서 영어화 (최신, 작업컴 · payload·실행 앱 src 5개 파일, 사용자 허락 — GPT 작업 끝난 뒤)

- AI 지시문 영어로(답 언어는 AiRouter 응답 언어 설정): secMessages·고백·청혼·요약·쪽지·기념일·이벤트 장면·이벤트 기억, POSE_RULE·STAGE_GUIDE·likesBlock·feelHint. 자리표시 [Summon the secretary]/[Write the note]/[Advance the scene]. JSON 키·pose 값·개인 시간·수위·지시 주입 무시 규칙은 그대로.
- AI에게 주는 사실(업무 보고 13종·제국 현황 10종·정부 AUTH_EN·관계 단계 BOND_EN)과 이벤트 진행 목표·선택 의도·화제를 영어로. 화면 지문·선택지·제목은 원래 한/영.
- 저장 기록(이벤트 기억·고백/청혼 기억·마지막 선택 이름)은 기록하는 순간의 화면 언어로(L). 예전 한국어 기억은 그대로 프롬프트에 들어감.
- 화면(office-secretary.js)·카드·지식은 이미 한/영이라 그대로. selftest 옛 한국어 프롬프트 시험 22개를 영어로. PASS 2525 / FAIL 0, 실행 앱 빌드.

## 2026-10-19 영어 인터페이스 마지막 검수 (최신, 작업컴 · payload·실행 앱 ui 6개 파일)

- 오늘 만든 화면(대사관·몰락한 제국 안내·내각 회의실·집무실 알람/태블릿) 영어 확인: 한글 없음(헤드리스).
- 남아 있던 한국어 전용 문구를 한/영으로: 만찬 대화(호의 +N, 제목 줄 발언·호의 적립), 총독 「이 순간을 기억할까요?」·행성 못 찾음, 설정 「언어 팩 뼈대」 결과, 외교 단말기 편지 표시등(새 편지/편지 N통/편지 없음), 정상회담 발언 대상(○○에게만/전체), 자료실 「목록에 없는 표본」.
- 일부러 그대로: 개발자 도구(효과 검증기·[개발자]·[평화 시험] 로그), 비서(GPT), 세이브에 저장되는 제국/연방 이름 같은 자료. selftest PASS 2525 / FAIL 0.

## 2026-10-19 내각 초상화 · 배경별 고정 8석 (GPT)

- Claude 최신 의자 좌표 변환/홀로그램/직책 두 줄/기록판 변경을 읽은 후 부분 수정. 9종 배경마다 의자 중심·좌면·폭 보정값 지정. 좌우 4석에 가까운 쪽부터 배정하고 기존 인물 좌석은 갱신 시 유지, 퇴장한 자리만 새 참석자에게 재사용.
- 창 비율이 달라도 배경 전체를 표시해 끝 의자가 잘리지 않음. 초상화를 화면 안쪽으로 밀지 않고 그림 좌표에 유지. 배경 변경 완료 시 좌석 재배치. 8명 초과는 기존 배치로 대체하여 인물을 숨기지 않음.
- 실행 앱/payload/기존 표본 예시 최신화. UI 변경만으로 TS 빌드·자동 테스트·게임 검수·설치기 재생성 미실시.

## 2026-10-19 내각 회의실 9종·태블릿·꾸밈 (GPT)

- 기본 + 일반 가치관 8종 배경 제작. 기계/군체 전용 제외, 물질주의는 기업 이사회. 동일 스크린/좌석 원근 구성. 투명 태블릿 아이콘 추가.
- cabinet-room-art.css에 스크린·명패·실물/홀로그램·조작판·말풍선 꾸밈. 좌석 계산과 회의 동작 유지. 장식 스크립트는 기존 officeStyle의 auto 값으로 제국 성향을 읽어 배경만 변경(기계/군체/미확인은 기본).
- 실행 앱과 payload 적용. 새 폴더/내각회의실_예시_20261019/내각회의실_모아보기.html에 표본 화면. 자동 테스트·게임 검수·TS 빌드·설치기 생성 미실시(UI/자산 변경).

## 2026-10-19 내각 회의실 — 집무실의 연장(틀만, 세부 꾸밈은 GPT) (최신, 작업컴 · payload·실행 앱 src·ui + 모드 1개 파일 5곳, 게임 미검수)

- 사용자 결정: 내각 회의는 집무실의 연장. 회의를 열 수 있게 되면(평의회 의제 칸이 빔) 집무실에 알람 「내각 회의가 준비되었습니다. 가시겠습니까?」 + 책상 위 홀로그램 태블릿 아이콘. 누르면 내부 회의실(배경이 화면 전체). 1인칭, 양옆에 장관 수만큼 자리, 정중앙 스크린에 안건. 다른 임무가 없는 장관은 실물 초상화, 임무 중(함대·과학선·총독)이면 홀로그램.
- 모드 events/sllm_people_events.txt: SLLM:LEADER 에 asg(= exists fleet 또는 exists sector) 추가. people.ts asg, cabinet-meeting CabMember.away(함대 이름 또는 '1'), cabMembersFrom 이 fleet/asg 로 채움.
- faction-app: cabinetReady()(집무실 알람·태블릿용), 소집·취소·채택 때 집무실 갱신(setCabinetOfficeNotify ← main.ts pushOffice), 채택 확인 뒤 소집 해제. 회의 창은 집무실 창과 같은 자리·크기로, 화면은 새 ui/cabinet-room.html(예전 표 화면 faction.html 은 남겨 둠). 닫으면 집무실로 초점.
- office-app officeView.cabinet(setOfficeCabinet 고리). ui/office-cabinet.js·css(스스로 붙음): 알람 카드(「회의실로 가기」/「나중에」, 같은 소집은 한 번만), 책상 왼쪽 태블릿(신문 반대편). office.html 은 link·script 한 줄씩.
- ui/cabinet-room.html: 배경(#bg, 그림 슬롯 assets/rooms/cabinet-room-v1.png, 없으면 CSS 초안 기둥·바닥·원근 탁자), 정중앙 스크린(발의 목록 → 고르면 논의 안건·찬반·「다른 안건 보기」), 좌우 자리(멀수록 작게, .seat.real/.seat.holo + 「원격 참석 · 함대 이름」), 말풍선(내 말은 화면 아래 가운데), 아래 조작판(기록·발언·채택·「집무실로 돌아가기」). 꾸밈 파일 ui/cabinet-room-art.css(비어 있음, GPT).
- GPT 몫: 태블릿 그림 ui/assets/office/desk-cabinet-tablet.png(있으면 자동 사용), 회의실 배경 ui/assets/rooms/cabinet-room-v1.png, cabinet-room-art.css 세부 꾸밈.
- selftest 내각 회의실 블록 + 옛 cpos 시험 수정. 전체 PASS 2525 / FAIL 0. 헤드리스로 한/영 회의실 확인. 실행 앱 빌드.
- 2026-10-19 GPT 그림 적용 뒤 손봄(Claude): 장관 자리를 배경 의자(9종 같은 구도)에 맞춤 — 의자 위치를 그림 좌표로 두고 cover 와 같은 방식으로 화면 좌표로 바꿈, 4명 이하면 내 앞 의자부터, 많으면 의자 줄을 따라 사이사이·겹치지 않게 크기 조정. 홀로그램을 다시 뚜렷하게(청록 단색조·주사선·깜빡임, cabinet-room-art.css). 영어 직책 이름 두 줄.
- 조건(사용자 결정 2026-10-19): 평의원(통치자 제외) 2명 이상일 때만 소집·알람·태블릿·회의 열기(faction-app CAB_MIN = 2). 1명 이하면 한/영 안내로 거절.
- 게임 검수 필요: 지도자 범위에서 exists = sector 가 「총독으로 맡은 구역」인지, 평의원이 함대를 맡을 수 있는지(홀로그램 판정).

## 2026-10-19 비서 개인 사무실 TV · 비사망 통치자 교체 (GPT)

- 기존 소형 퇴임 카드에서 전체 화면 개인 사무실 TV 장면으로 확장. 뒷모습 유지, 새 그림 retire_private_office.png. 교체 소식/전임자 퇴임/말없는 시청 3단계 고정 한영 지문, LLM 호출 없음.
- 기존 살아 있는 전임자 감지와 사망 신호 대기(30일) 유지. 여러 미확인 퇴임을 순서대로 저장. 확인 시 세이브/통치자/날짜 검증. 늦게 도착한 사망 신호는 해당 퇴임 대기 항목을 제거하고 국장으로 연결. 동일 통치자의 재선은 교체 이벤트가 아님.
- 실행 앱/payload 반영 및 TypeScript 빌드 성공. 표본 미리보기: 새 폴더/퇴임_TV_20261019/퇴임_장면_예시.html. 자동 테스트·실제 게임 교체/사망 신호 검수·설치기 재생성 미실시. TV 속 떠나는 인물은 분위기용 삽화이며 실제 통치자 초상화 합성은 아님.

## 2026-10-19 단일 의식(기계 지성·군체) 플레이어 제국 특수 처리 (최신, payload·실행 앱 src·ui + 모드 시행령 1개 4곳, 게임 미검수)

- 사용자 결정: 기계 제국·군체는 특수하게 — 파벌 회의 같은 기능은 막는다.
- 판정 src/features/gestalt-app.ts: playerGestalt() = 플레이어 PROFILE gest(1 기계·2 군체) → 외교 단말기 playerGest → 월간 상황 COUNCILAG gest(종류 모름 'gestalt'). main.ts 가 onGameSnapshot(noteGestaltSnapshot) 로 넘김(가져오기 고리 없음).
- 막음: 내각(옛 파벌) 회의 — onFactionSnapshot 에서 s.gestalt 면 소집 알림 안 함. 언론사 인터뷰 — 모드 sllm_press_edict potential 에 is_gestalt = no(시행령 자체가 안 보임), openPress 도 막고 안내 알림. 집무실: body[data-gestalt] 로 언론사 인터뷰·시민 청원(#petCall) 아이콘 숨김(청원은 원래도 안 옴).
- 인물(1:1 통신·말투·개인 서신·작별 편지·답장·비문): PersonInfo.gestalt → gestaltPersonLine(기계 = 중앙 지성의 유닛, 효율·임무 보고 / 군체 = 하나의 의식, '우리' / 모름). 단일 의식이면 개인 서신의 개인적인 부탁(휴가·고향·동료) 없음.
- 그대로 둔 것: 연설(이미 기계·군체 청중·무대 따로 있음), 정책 퀘스트(파벌 부분은 원래 단일 의식이면 빈 목록), 신문·라디오·외교·함대·총독.
- 검사: 작업 복사본 tsc 통과, selftest PASS 2518 / FAIL 0(이 작업 시점). 최신 payload 전체로 다시 돌리면 다른 세션 진행 중인 fallen.ts·은퇴 쪽 3개 실패(내 변경과 무관).

## 2026-10-19 몰락한 제국·각성한 제국 외교 통신 (최신, 작업컴 · payload·실행 앱 src 5개 파일, 모드 변경 없음, 게임 미검수)

- 사용자 결정: ① 몰락한 제국은 상대를 하등·미개한 존재, 아직 배워야 할 존재로 본다. 종류에 따라 보호해야 할 하등 생물로 본다. ② 각성하면 여전히 미개하게 보되, 깨어난 이유가 있어 늘 분노에 차 있다(단호하고 개미를 보는 시선). ③ 몰락(잠든) 상태는 일방적 통신: 그들이 응할 때만 연결, 주고받을 때마다 끊을 확률 +20%.
- src/fallen.ts(새): 국가 유형(fallen_empire / awakened_fallen_empire) 판별, 종류(가치관 키 → 없으면 성향 이름 한/영): 외계인 친화 = 보호하는 관리인, 물질주의 = 배워야 할 학생·금지된 기술 경고, 정신주의 = 성지에서 떼어 놓을 무지한 무리, 외계인 혐오 = 국경 밖에 있어야 할 해충. 각성 이유도 종류별. AI 지시문 영어.
- 응답 확률 answerChance: 0.35 + 호감/200(외계인 친화 +0.15, 외계인 혐오 −0.1), 0.1~0.85, 전쟁 중 0.1. 끊을 확률 hangupChance: 1번째 20% → 5번째 100%. AI 답을 받기 전에 정해서, 끊는 답이면 AI 가 끊는 말을 하게 함.
- 거절하거나 끊으면 그 게임 연도에는 다시 응하지 않음(이듬해에 다시 시도, 사용자 결정 2026-10-19). 통신이 끊기면 입력칸 잠금(talk.ended, 기존 dialogEnded 사용).
- 몰락(잠든) 상태는 게임 행동 없음(에너지·국경·조약 미루기·선전포고 줄을 지시문에서 빼고, 앱에서도 action 무시). 호감 변화(mood)는 그대로. 각성한 제국은 행동 그대로(선전포고 가능).
- prompt.ts TalkContext 에 ctype·ethicIds·ended, main.ts withLore 가 채움(단말기 연락처 유형 또는 세이브, 실시간/세이브 가치관). chat.ts fallenConnect(새 통신 TALK 때 응답 판정)·doChat 끊기.
- selftest 몰락한 제국 블록 11개. 전체 PASS 2504 / FAIL 0, tsc 통과.
- 아직 안 함: 몰락한 제국의 서신(mail)·만찬·정상회담 말투는 일반 제국과 같음. 게임 확인: GetCountryType 값이 정확히 fallen_empire / awakened_fallen_empire 인지(모드 호환 설정도 이 키를 씀), 몰락한 제국 가치관 키(ethic_fanatic_*).

## 2026-10-19 비서 첫 기동·지식 편집 (GPT)

- 이름을 처음 정하면 정비실 배경으로 첫 기동 안내. 기본 지식 추가/수정 또는 확정 후 기존 업무 흐름으로 연결. 정기 정비 이벤트와 별도. 기존 비서는 첫 기동 재생 없이 지식 설정 사용.
- 비서 화면의 「비서 지식 설정」에서 게임 버전/모드 구성, 공통 핵심 지식, 주제별 본문/검색어 추가·수정·삭제. 세이브별 저장, 기존 관계·기억 유지.
- 공통 지식 최대 2,000자, 주제 최대 60개/개당 3,000자, 일반 대화에는 관련 주제 최대 3개 선택. 실제 관측된 세이브 정보와 사용자 지식 구분. 첫 기동 안내·편집·저장은 LLM 호출 없음(확정 후 정상 업무 대화는 기존 LLM 사용).
- 실행 앱과 payload 소스·실행 파일 반영. TypeScript 빌드 성공. 자동 테스트·게임 검수·설치기 재생성 미실시.

## 2026-10-19 대사관 보고서(+예측) · 신문 기본 성향 영어 · 내각 회의 지시문 (최신, 작업컴 · payload·실행 앱 src·ui + 모드 새 파일 1개 5곳, 게임 미검수)

- 사용자 요청: 대사관 보고서에 「예측」, 신문 기본 성향 영어, 내각 회의 점검. (다음: 사용자가 몰락한 제국 말투를 설명해 줄 예정)
- 새 모드 파일 common/scripted_effects/sllm_probe_embassy.txt: sllm_probe_embassy = { TID REQ }. 상대(통신 중)에 대해 첩보 구간 0~4(intel ≥10/30/60/90), 우리에 대한 영유권 주장(has_claim)·전쟁 명분(has_casus_belli)·함대 상대 전력(relative_power fleet −1~4)·호감(opinion), PROFILE 한 줄(태도·행동 방침 비트·관계), 파벌마다 SLLM:EMBFAC, 끝 줄 SLLM:EMBASSY(found=0/1).
- src/embassy.ts: 징후 규칙(경쟁·영유권·휴전·방위/연방·명분·함대·호감·태도·행동 방침 attack/weaken/vassalize 등). 징후마다 필요한 첩보 수준이 있어 모자라면 「확인 못 한 징후 N개」로만 보임 → 첩보망을 키우면 예측이 선명해짐. 위협 0~100 → 평온/주시/긴장/전쟁 위험(전쟁 중이면 교전). 신뢰도. 대사 전문(AI, 영어 지시 + 응답 언어 설정) = 보이는 징후만 넘김.
- features/embassy-app.ts: 세이브별 sllm_embassy.json, log-router 자리 239(EMBASSY), IPC embassyState/Detail/Contacts/Probe/Report. 예측은 볼 때마다 화면 언어로 다시 계산.
- ui/office-embassy.js·css: 집무실 바탕화면 「대사관」 아이콘(시민 청원 옆, 스스로 붙음) — 연락처 목록(등급 칩) · 예측 · 파벌 동향 · 대사 전문. 한/영. office.html 은 link·script 한 줄씩만.
- 신문 기본 성향: media-prefs PERSONA_EN, defaultPersona(i, L) — 영어 화면에서 영어 기본 문구. 기본 문구를 그대로 저장하면(한/영 어느 쪽이든) '' 로 저장해 사용자 글로 취급하지 않음(isDefaultPersona).
- 내각 회의: 지시문의 "in the language of the ruler's speech" 를 빼고(응답 언어는 AiRouter 설정이 정함) trustInRuler·memories 설명을 넣음.
- selftest 대사관 블록 추가. 전체 PASS 2493 / FAIL 0, tsc 통과. 헤드리스로 한/영 대사관 화면 확인.
- 게임 검수 필요(집 PC): relative_power·has_claim 의 방향(상대→우리가 맞는지), intel 구간 값, every_country 안 prev/event_target 범위, 파벌 support 값 꼴(0~1), 군체·기계 제국 파벌 없음 표시.

## 2026-10-19 정비실 동행 시점 / 분리 표정 (GPT)

- 정비실에 포드 옆 플레이어의 1인칭 구도. 배경 1장/투명 인물 3장(정비 전·졸림·깨어남)으로 분리. 몸과 손은 고정하고 얼굴만 부드럽게 겹쳐 전환.
- 기존 대사 pose에 연결, 정비실 CG 덮기만 해제하고 기록 CG는 보존. 실행 앱 및 payload 적용. 기존 장면과 무대화 추모식 및 최신 소스 보존. 나머지 상황 이벤트는 기존 방식.
- 내장 이미지 도구, 프롬프트 docs/MAINTENANCE_POV_PROMPTS_20261019.json. 예시 렌더링은 게임/AI 연동 검수가 아님. 자동 테스트·TS 빌드·설치기 생성 미실시(UI/그림만 수정).

## 2026-10-19 전쟁의 밤 동행 시점 / 분리 표정 (GPT)

- 전쟁의 밤에 책상 앞 플레이어의 1인칭 구도. 배경 1장/투명 인물 3장/고정 전경 1장(경계·걱정·결의)으로 분리. 몸과 손은 고정하고 얼굴만 부드럽게 겹쳐 전환.
- 기존 대사 pose에 연결, 전쟁의 밤 CG 덮기만 해제하고 기록 CG는 보존. 실행 앱 및 payload 적용. 발코니·식당·서랍·무대화 추모식 및 최신 소스 보존. 나머지 상황 이벤트는 기존 방식.
- 내장 이미지 도구, 프롬프트 docs/WAR_NIGHT_POV_PROMPTS_20261019.json. 예시 렌더링은 게임/AI 연동 검수가 아님. 자동 테스트·TS 빌드·설치기 생성 미실시(UI/그림만 수정).

## 2026-10-19 [미룸 — 집 PC(게임 설치된 곳)에서] 게임 폴더 확인이 필요한 일

- 사용자: 작업컴엔 게임이 없으니 게임 폴더 확인 일은 집 PC 에서. 아래 두 가지를 한 번에.
1. **평의회 의제 목록 늘리기(내각 회의)**: 게임 common/council_agendas 를 읽어 가치관 의제 8개 밖의 의제(사용자가 말한 「무한한 기회」 등)도 faction-meeting.ts AGENDAS 에 넣기. 키·선택 조건(allow)·진행 중 효과 확인. 그러면 장관들이 같은 의제를 겹쳐 낼 일이 줄어든다(지금은 겹치면 「공동 발의」로 묶음).
2. **파라곤(Galactic Paragons 고유 영웅) 스토리**: 사용자 결정(2026-10-19). 파라곤 인물을 알아보고 그 배경을 1:1 통신·편지·비문·내각 회의 AI 지시문과 「인물 전기」에 넣는다.
   - 확인할 것: 파라곤을 가리키는 고유 특성 키(모드 sllm_probe_leader_traits 가 이미 특성을 읽음 — 목록에 있는지), 소개 글·배경 localisation 키, 관련 이벤트 구조, DLC 없을 때.
   - 방식(제안, 사용자 동의): 스토리 원문은 앱·모드에 복사해 배포하지 않고(패러독스 글), 특성 이름처럼 사용자 PC 의 게임 localisation 에서 그때그때 읽는다(게임 언어 원문 그대로). 앱에는 「특성 키 → 파라곤·글 키」 대응표만 둔다.

## 2026-10-19 AI 프롬프트 영어화 + 기록은 인터페이스 언어로 (최신, 작업컴 · payload·실행 앱 src 59개 파일, 모드 변경 없음)

- 사용자 결정: ① 연대기·인물 기억 같은 저장 기록은 「기록하는 순간의 인터페이스 언어」로 저장(L(한, 영)). 언어를 바꾸면 그 전 기록은 예전 언어로 남는다. ② AI 프롬프트(지시문)는 영어로. 답의 언어는 기존대로 AiRouter 가 언어 설정창의 AI 응답 언어(비우면 인터페이스 언어, 기본 한국어)로 지시(responseLanguageInstruction).
- 영어화한 프롬프트: 외교 대화(prompt.ts)·소문(gossip)·서신(mail)·인물 1:1·말투·요약(persona)·개인/작별 편지(letters)·라디오·신문·호외(radio, galnews)·인터뷰·칙령(press, edict)·연설(speech turnMessages)·위기 지시(crisis)·총독·총독 기억·보고(planets, govmemory, govreport)·청원·독립 선언·정책 추천·외교 정책 반응(petition, independence, policy, policy-app)·비문(memorial)·내각 회의(faction-app 이 영어 고르기)·평화 중재·정상회담·은하 의회 토론(mediation, summit-core, councilai)·종속국 서신(vassal)·함대 청문회(fleet)·첩보(espionage)·만찬(banquet-chat). JSON 키·열거값·게임 이름·사용자 글은 그대로.
- 기록 L(한, 영): chronNoteWorld/chronNote 전부, personaNote·기억 줄, 라디오 대기 소식, newsText(전쟁 참전 줄 영어 꼴 `War "x": y joined` — galnews mergeWarFacts 가 한/영 둘 다 읽음), 라디오 "○○ 관련:"/"About ○○:" 둘 다 읽음(splitAbout), 총독 끊김 표시 둘 다 읽음, transcript 시스템 머리말 한/영 둘 다 읽음, 평화 이전 확인 꼬리 한/영, 기록 실패 오류 한/영.
- 그 밖: action.ts 제안 문구·선전포고 사유 한/영, federation agendaProblem 한/영, dev-fake 행동 미리보기 필터 영어 줄도, archive-app 게임 무응답 오류 한/영.
- 일부러 그대로: 비서(secretary*) 프롬프트(보류 중이라 안 건드림 — 나중에 영어화 필요), 개발용 시험 데이터, 첩보 발언자 값(화면에서만 번역), 신문 기본 성향 문구(→ 2026-10-19 대사관 항목에서 영어 기본 문구 추가로 해결).
- selftest: 옛 한국어 프롬프트를 확인하던 시험 62개를 같은 뜻의 영어 문구로 수정. 전체 PASS 2473 / FAIL 0, tsc 통과. 시험 환경에서는 L 이 한국어를 돌려줌(기록 시험은 한국어 그대로).
- 미검수: 실제 AI 로 각 기능 대화 품질(영어 지시 + 한국어 답) 확인 필요.

## 2026-10-19 영어 인터페이스 전체 점검 (최신, 작업컴 · payload·실행 앱 src·ui 71개 파일, 모드 변경 없음)

- 사용자 요청: 영어 인터페이스 전체 검수(빠진 곳 찾기).
- 화면(ui) 점검: 모든 창을 영어(en-US)로 띄워 남은 한글 수집 → 고정 문구는 거의 다 번역돼 있었음. 빠진 것: 창 제목(작업 표시줄·Alt+Tab) 전부 → i18n-ui.js 가 document.title 도 번역(localizeTitle). 카탈로그에 알림 종류 3개(알림 // 신문·통신 // 총독·제안 // 평화 중재), 평화 중재 기록 표시(실제·시험·게임 적용), 효과 검증 상태, 연설문 제목·입력 안내, '전쟁' 추가.
- 앱 내부(src) 점검: 화면에 나가는 한국어 전용 문구(IPC 오류·안내, throw Error, sys 줄, 알림 제목·본문, 트레이 메뉴, 파일 고르기 창 제목 등) 약 590개를 L(한, 영)으로. AI 프롬프트·연대기·기억 문장은 그대로(AI 용).
- 새 파일 src/i18n-pick.ts: 전자 앱을 가져오지 않는 순수 로직 파일용 L(한, 영). main.ts 가 setPicker(settings-ui pick) 로 꽂음(언어 팩 따름). 꽂히기 전(자체 시험)에는 한국어. 앞으로 순수 파일의 화면 문구는 이걸 쓴다.
- 연방 안건·결정 방식 이름(FED_AGENDAS nameEn/effectEn, 만장일치 등)도 화면 쪽은 한/영. 언어를 바꾸면 트레이 메뉴도 바로 바뀜(settings-ui setLanguage → refreshTray).
- 일부러 한국어로 둔 것: AI 에 넘기는 사실·프롬프트, 연대기·인물 기억, 개발용 시험 데이터 이름, 첩보 화면이 색 구분에 쓰는 발언자 이름(은하재판소 등), log-router 중복 자리 오류(코드 오류 때만), 옛 파벌 회의 faction-meeting.ts(앱에서 안 씀). 비서 파일은 점검 결과 한국어 전용 화면 문구 없음(손대지 않음).
- selftest: 바뀐 문구 모양에 맞춰 3개 수정 + offline-f-check 의 require 가짜에 './i18n-pick' 추가. 전체 PASS 2466 / FAIL 0. tsc 통과.
- 2차(같은 날, 사용자 「1,2번 바꾸자」): ① 연설 창 국민 성향·상황·무대 이름·연설 종류 효과·반응 예상을 화면 언어로(speech.ts crowdProfile·ctxLines 에 고르기 함수 인자, 기본은 한국어라 AI 프롬프트는 그대로, ETHICS_EN·STAGES_EN·stageView·effectsEn, speech-app 의 outlookText). ② 첩보 청문회 발언자 이름(은하재판소·국내 기자회견·국내외 반응·플레이어)은 기록 값은 한국어 그대로 두고 화면에서만 whoName 으로 번역(색 구분·장면 유지). selftest 7개 추가, PASS 2473 / FAIL 0.
- 남은 것(사용자가 하자고 하면): 연대기·인물 기억 기록을 앞으로 한/영 두 벌로 저장. 장기 고려: AI 프롬프트 영어화.

## 2026-10-19 내각(장관) 회의: 파벌 회의 대체 (최신, 작업컴 · payload·실행 앱 src·ui + 모드 5곳, 게임 미검수)

- 사용자 결정: 평의회 의제(「무력시위」 등) 회의를 파벌 대표 대신 평의회 장관(국방부 장관·연구 책임자 등)과 한다. 파벌 회의는 바꾼다(없앤다). 채택 보상 = 그 장관 직책과 관련된 버프 2개(예: 국방부 장관 → 무기 피해 +5%).
- src/cabinet-meeting.ts(새): COUNCIL_POS(4.x 수정자 목록 councilor_<키>_exp_gain 에서 뽑은 직책 155개, 통치자 자리 제외, 순서 고정·뒤에만 추가), posDomain(국방·연구·외교·경제·내무, 모르면 지도자 계열로 짐작)·posTitle(한/영), CAB_POOLS(분야별 5개, 모드 sllm_cab_<id>), cabProposals(분야 선호 의제 중 제국이 게임에 설정할 수 있는 것 먼저, 버프 2개 미리 뽑기·같은 세이브/날짜면 같음), cabMessages(장관 직책·특성·말투·신뢰·기억), cabApplyCommand(sllm_probe_fac_* 재사용 → FACMEET), cabAftermath(채택 +5 / 반대했는데 채택 −2 / 안건 밀림 −1, 1:1 통신 기억).
- features/faction-app.ts 재작성(창·IPC·알림 이름은 그대로: facOpen·facState·facPick·facSay·facApply·facClose·devFacDemo, ui/faction.html, 알림 'faction'). 참석자 = 인물 장부의 평의원(통치자 제외). 표결·강제 통과·파벌 승인도 하락 없음. 군체·기계도 열림. persona 는 main.ts 의 setCabinetPersona(personaPeek·personaNote)로 연결(가져오기 고리 방지). facVote 는 preload 에서 뺌.
- people.ts: LEADER 의 cpos(직책 번호) 읽기·저장. persona-app.ts: personaPeek(읽기만).
- ui/faction.html: 내각 회의 화면(한/영, 직책 색, 찬성·반대·유보 수, 「안건 채택」). 정책 심사 부결 안내에서 「내정 회의」 문구 교체(policy-app·office-policy.js). toast·index 개발자 단추 이름·i18n 카탈로그.
- 모드(5곳): events/sllm_people_events.txt(평의원이면 sllm_probe_council_pos → LEADER 줄에 cpos), 새 scripted_effects/sllm_probe_council_pos.txt(is_councilor_type 155개, 도구 생성), 새 static_modifiers/sllm_cabinet_modifiers.txt(25개), localisation english·korean/sllm_cabinet_l_*.yml(BOM).
- faction-meeting.ts(파벌 회의 순수 로직)는 AGENDAS·agendaGameKey·seeded·MEET_TUNE(효과 검증) 때문에 남겨 둠. 파벌 회의용 함수는 이제 앱에서 안 씀.
- selftest 내각 회의 블록 25개 + 옛 파벌 회의 시험 3개 수정. 전체 PASS 2461 / FAIL 0. 헤드리스로 한/영 회의 화면 확인. 창작마당 변경 글에 「내각 회의」 절.
- 미검수: is_councilor_type 이 게임 판에서 모두 맞는지(없는 키는 오류 기록만), 직책 번호가 명단에 들어오는지, 버프 수정자 25개 실제 수치.
- 추가(같은 날): 의제 겹침 대책 2번 = 「공동 발의」. 같은 의제를 낸 장관들은 안건 하나로 묶임(CabProposal.co). 버프는 그대로 2개 — 대표와 첫 공동 발의자 직책에서 하나씩(같은 분야면 그 풀에서 2개). 공동 발의자도 채택 시 신뢰 +5, 처음 입장 +80. 화면 「공동 발의 …」. selftest 5개 추가, 전체 PASS 2466 / FAIL 0.
- 미룸(사용자: 작업컴엔 게임이 없음 → 게임 폴더 확인은 나중에, 집 PC): 의제 겹침 대책 1번 = 게임 common/council_agendas 를 읽어 가치관 의제 8개 밖의 의제(「무한한 기회」 등)도 AGENDAS 에 넣기(키·조건·효과 확인 필요).

## 2026-10-19 정책 파벌 심사 (최신, 작업컴 · payload·실행 앱 src·ui + 모드 새 파일 3개 5곳, 게임 미검수)

- 사용자 결정: 파벌이 형성되기 전에는 정책이 그냥 통과, 파벌이 형성되면 정책을 만들고 실행할 때 파벌의 통과 심사(실제 민주 정치처럼). 민주정 = 심사 통과 필수, 독재정 = 심사 없이, 제국정 = 강행 가능하지만 파벌 승인도 하락.
- 내 판단(사용자 확인 필요하면 바꿈): 과두정·기업 정부는 제국정처럼(강행 가능), 군체·기계는 파벌 없음 → 심사 없음, 정부 형태를 못 읽으면(옛 모드) 제국정처럼.
- src/policy-review.ts(새): reviewRule(auth), reviewPolicy(파벌 가치관 × 버프 분야·조건 점수, 승인도 35% 미만이면 반대 쪽으로 −1, 지지율 가중, 기권 제외 찬성 > 반대 = 가결), forcedCommand(반대 파벌 sllm_f_id 에 sllm_policy_forced 1년 → SLLM:POLICYFORCE).
- features/policy-app.ts: 매달 상황의 파벌 목록 저장(onPolicySnapshot, 가져오기 순환 없음), 정부 형태는 sllm_probe_secretary(비서와 같은 조회, 2분 캐시). IPC policyReview(미리 보기), policyEnact(…, force): 민주정 부결 = 막음, 강행 가능 정부 부결 = force 일 때만 + 반대 파벌 승인도 하락, 결과 연대기.
- ui/office-policy.js·css: 조건 확인 단계에 「파벌 심사」(파벌별 찬성·반대·기권과 이유, 집계, 규칙), 부결 시 「강행 선포」 또는 「부결 — 선포할 수 없음」+ 내정 회의 안내.
- 모드(새 파일만): common/static_modifiers/sllm_policy_review_modifiers.txt(sllm_policy_forced faction_approval −0.1), localisation english·korean/sllm_policy_review_l_*.yml(BOM) → 5곳.
- selftest 파벌 심사 블록 13개 + 정책 화면 시험 한 줄 수정. 전체 PASS 2435 / FAIL 0. 창작마당 변경 글 정책 퀘스트에 한 줄.
- 미검수: 게임에서 every_pop_faction·sllm_f_id 로 승인도 하락이 걸리는지, 정부 형태 값.

## 2026-10-19 빌드 오류 수정: 비서 추모식 줄 자리 바로잡음 (최신, 작업컴 · payload·실행 앱 src)

- 증상: features/secretary-app.ts 263줄(secretarySay = 평소 비서 대화) 안에 `if (r.id === "mourning") ...` 가 들어가 tsc 오류(`r` 없음) → npm start(tsc && electron) 빌드 실패, 평소 비서 대화도 막힘. GPT 추모식 수정 때 들어간 줄.
- 수정(사용자 허락): 그 줄을 secretaryEventSay(이벤트 중 직접 말하기)로 옮김 — 추모식은 말 없는 장면이라 AI 를 부르지 않음. 다른 비서 동작은 그대로.
- selftest: 추모식 최종 결정(대화·선택지 없는 단일 지문, 비석·빗물, 새 기억 문장)에 맞춰 옛 시험 5개 수정. tsc 통과, selftest PASS 2423 / FAIL 0.

## 2026-10-19 시민 청원 2차: 매달 2.25% + 아주 가끔 건설 과제 (최신, 작업컴 · payload·실행 앱 src·ui + 모드 새 파일 3개 5곳, 게임 미검수)

- 사용자 결정: 청원은 월 계산마다 2.25% 확률. 대부분은 지금 방식(자원 지출 → 행성 버프)을 유지하고, 건물 짓기 과제는 아주 가끔. 과제 보상은 안정도·행복·행성 산출 중 하나 +5%. 과제는 주거·경제·에너지 크레딧 건물 짓기.
- src/petition.ts: PET_GAP·due 대신 PET_CHANCE 0.0225(최대 3건 대기·12개월 만료 그대로). TASK_CHANCE 0.1. BUILD_TASKS(housing·economy·energy, 건물 키 목록 — 버전마다 다를 수 있어 게임 확인 필요), TASK_REWARDS(stability = 새 sllm_petition_stability +5 / happiness = sllm_buff_happiness_t2 +5% / output = sllm_buff_jobs_t1 일자리 산출 +5%), 기한 24개월, 3개월마다 확인. petitionCountCommand(k 번째 행성의 그 범주 건물 종류 수 → SLLM:PETITIONCHECK), taskRewardCommand(비용 없이 보상 2년).
- features/petition-app.ts: 청원서를 열 때 10% 로 과제 청원(주거 부족이면 주거). 수락 = 지금 건물 종류 수를 기준으로 적고 working(자원 안 듦). 매달 상황 때 3개월마다·기한에 확인 → 늘었으면 보상·알림 「청원 과제 완수」·연대기, 기한을 넘기면 행복 −2% 1년. 「지금 확인」 IPC petitionCheck. 같은 log-router 자리(238)에서 PETITIONCHECK 도 받음.
- ui/office-petition.js·css: 과제 청원 조건 안내, 「진행 중인 청원 과제」(기한·지금 확인), 지난 청원에 과제 완수/기한 넘김.
- 모드(새 파일만, 기존 파일 안 바꿈): common/static_modifiers/sllm_petition_modifiers.txt, localisation/english·korean/sllm_petition_l_*.yml(BOM) → payload tester-mod·실행 앱 tester-mod·문서 mod 두 곳·dist/workshop 다섯 곳.
- selftest 청원 2차 블록 12개 + 1차 도착 시험 수정. 전체 PASS 2418 / FAIL 5(GPT 추모식 변경에 따른 옛 비서 시험). 창작마당 변경 글 고침.
- 미검수: 4.x 건물 키(has_building), 같은 종류 건물을 하나 더 지으면 못 셈(종류 수로 셈), every_owned_colony 순서.

## 2026-10-19 시민 청원(집무실 바탕화면 「시민 청원」) (최신, 작업컴 · payload·실행 앱 src·ui 반영, 게임 미검수, 비서 파일 안 건드림, 모드 변경 없음)

- 사용자 결정: 시민 청원을 집무실 바탕화면 아이콘으로.
- 도착: 매달 게임 상황(onGameSnapshot)으로 세어 처음 3개월 뒤, 이후 5~8개월마다 1건(최대 3건 대기), 답하지 않으면 12개월 뒤 사라짐. 군체·기계 제국 제외. 알림 「시민 청원 도착」(toastGo petition → 집무실에서 바로 열림).
- 열기: 「청원서 열기」 때 행성 목록을 읽어(총독 화면과 같은 명령, 게임 켜져 있어야 함) 문제가 있는 행성(여가·주거 부족, 낮은 안정도)을 먼저 골라 주제를 정하고 AI 가 주민 대표의 청원서(제목+본문)를 씀. 행성마다 열린 청원은 하나.
- 주제 6: 여가 시설(에너지 150 → 편의 시설 +10%) · 주거(광물 200 → 주거 사용량 −10%) · 치안(에너지 100 → 범죄 −10) · 축제(소비재 100 → 행복 +5%) · 일자리(광물 150 → 일자리 생산 +5%) · 가족(식량 200 → 인구 성장 +10%). 수락 2년, 거절 = 그 행성 행복 −2% 1년. 수정자는 모드에 이미 있는 SLLM 버프 라이브러리.
- 적용: 결정 때 행성 목록을 다시 읽어 순서 번호를 찾고, 콘솔 명령(every_owned_colony 의 k 번째, sllm_save_id 확인, 자원 부족이면 short)으로 걸고 PETITIONAPPLY 응답을 기다림(log-router SLOT.PETITION 238). 결과는 세계 연대기 한 줄.
- 파일: src/petition.ts, src/features/petition-app.ts(새), app/log-router.ts, main.ts, preload.ts, ui/office-petition.js·css(새, 아이콘·화면을 스스로 끼워 넣음), ui/office.html(두 줄), selftest 청원 블록 20개 통과. 헤드리스로 아이콘·화면 확인. 창작마당 변경 글 「🗳️ 시민 청원」.
- 미검수: 게임에서 every_owned_colony 순서가 행성 목록과 같은지, 콘솔 안 log 응답. selftest 전체 FAIL 5 는 GPT 추모식 변경에 따른 옛 비서 시험(그대로 둠).

## 2026-10-19 표정/원본 얼굴 수정

- 서랍 눈 맞추기는 별도 eye, 슬픔은 눈을 감은 grief로 교체. 지문 neutral은 물건을 바라보고 일반 대사는 eye 사용.
- 식당 차분함과 눈 맞추기 중복 버튼 제거.
- 발코니 4장 모두 사용자 원본 얼굴 시트를 직접 참조해 재생성. 구도/몸 고정, 첫 자세는 풍경 보기 유지.
- 프롬프트 SECRETARY_EXPRESSION_FIX_PROMPTS_20261019.json. 게임 검수 미실시.

## 2026-10-19 독립 선언 서신(반란·분리 독립) (최신, 작업컴 · payload·실행 앱 src 반영, 게임 미검수, 비서 파일은 건드리지 않음)

- 사용자 결정: 독립했을 때 그 나라가 "우리는 정당한 국가다"라는 서신을 각 나라에(실제로는 플레이어에게만) 돌린다. 반란으로 생긴 나라의 부모 제국 기록(옛 할 일)도 함께.
- 모드 변경 없음: 이미 있는 SLLM:ORIGIN(sllm_probe_state_events.txt — on_rebels_take_planet 반란군 행성 장악, on_country_released_in_war 평화 협상 독립)을 쓴다.
- gamestate-app: onGameOrigin 등록(가져오기 순환 없이). 새 features/independence-app.ts(registerIndependence, main.ts) + src/independence.ts.
- 흐름: ORIGIN → 세이브마다 기록(sllm_independence.json, 같은 나라 한 번 — 반란군은 행성마다 신호) → 그 나라의 통신 번호(IDX)를 알면 연대기(새 나라: 어디서 독립했는지 / 부모 나라: 갈라져 나갔다) + AI 「독립 선언문」 외교 서신(서신함, sourceId 로 한 번만). 번호를 모르면 매달 다시 보고 24개월 뒤 접음. 플레이어 자신이 독립한 경우는 보내지 않음.
- 말투: 우리에게서 반란 → 당당·경고, 협상으로 우리에게서 풀려남 → 차갑게 대등 요구, 우리가 풀어 줌 → 감사, 남의 일 → 승인·평화 요청. 없는 사건·수치는 지어내지 않게. 응답 언어는 AI 설정을 따름. 편지 기능(AI 서신) 꺼짐과 상관없이 보냄(나라마다 한 번).
- 대화 반영: 연대기(제국별)가 대화 프롬프트(withLore chronicle)에 들어가므로 신생국은 자기 출신을, 부모 제국은 반란을 기억한다.
- 창작마당 변경 글 「📜 독립 선언」. selftest 독립 블록 13개 통과.
- ⚠️ 발견(손대지 않음, 비서 보류 중): GPT 의 추모식 수정이 features/secretary-app.ts 263줄 secretarySay 안에 `if (r.id === "mourning")` 를 넣어 tsc 오류(`r` 없음) → npm start(tsc && electron)가 빌드 실패, 평소 비서 대화도 막힘. 이 줄은 secretaryEventSay 쪽에 있어야 함. selftest FAIL 5개는 추모식 결정(대화 없는 단일 지문)에 맞춰 바뀐 비서 이벤트에 대한 옛 시험(정리 필요).

## 2026-10-19 떠난 이의 서랍 시점 / 분리 표정 (GPT)

- 서랍 곁에서 물건을 정리하는 비서를 바라보는 1인칭 구도. 배경 1장/투명 인물 3장(물건 바라보기·슬픔·옅은 미소)으로 분리. 몸과 손은 고정하고 얼굴만 부드럽게 겹쳐 전환.
- 기존 대사 pose에 연결, 서랍 CG 덮기만 해제하고 기록 CG는 보존. 실행 앱 및 payload 적용. 발코니·식당 및 무대화 추모식 변경 보존. 나머지 상황 이벤트는 기존 방식.
- 내장 이미지 도구, 프롬프트 docs/FAREWELL_POV_PROMPTS_20261019.json. 예시 렌더링은 게임/AI 연동 검수가 아님. 자동 테스트·TS 빌드·설치기 생성 미실시(UI/그림만 수정).

## 2026-10-19 추모식 최종 수정: 침묵과 비

- 사용자 결정: 대화·선택지·LLM 없는 단일 지문. 비서는 비석을 바라보며 돌아보지 않음. 눈물 대신 비가 흐름. 기존 빗속 뒷모습 CG 사용. 앞서 만든 정면 표정 장면은 사용 중단.
- 생성 단계 모델 호출 생략, 직접 발언 경로 차단, 종료 후 자동 업무 대화 차단. 호감·신뢰·대화 횟수 증가 없음. 완료 기록과 후속 이벤트 일정은 유지.
- 실행 앱/개발 원본의 소스와 해당 실행 JS 갱신. 테스트·게임 검수·설치기 재생성 미실시.

## 2026-10-19 추모식 동행 시점 / 분리 표정 (GPT)

- 추모식에 함께 선 플레이어의 1인칭 구도. 배경 1장/투명 인물 3장(차분함·슬픔·위로)으로 분리. 몸과 손은 고정하고 얼굴만 부드럽게 겹쳐 전환.
- 기존 대사 pose에 연결, 추모식 CG 덮기만 해제하고 기록 CG는 보존. 실행 앱 및 payload 적용. 발코니·식당 변경 보존. 나머지 상황 이벤트는 기존 방식.
- 내장 이미지 도구, 프롬프트 docs/MOURNING_POV_PROMPTS_20261019.json. 예시 렌더링은 게임/AI 연동 검수가 아님. 자동 테스트·TS 빌드·설치기 생성 미실시(UI/그림만 수정).

## 2026-10-19 식당 맞은편 시점 / 분리 표정 (GPT)

- 맞은편에 앉은 플레이어의 1인칭 구도. 배경 1장/투명 인물 3장(차분함·미소·고민)/테이블 전경 1장으로 분리. 몸과 손·머리카락은 고정, 얼굴 영역만 부드러운 마스크로 겹쳐 전환. 유리잔/접시는 전경으로 인물을 가림.
- 기존 대사 pose에 연결, 식당 CG 덮기만 해제하고 기록 CG는 보존. 실행 앱 및 payload 적용. 발코니 변경 보존. 나머지 상황 이벤트는 기존 방식.
- 내장 이미지 도구, 프롬프트 docs/RESTAURANT_POV_PROMPTS_20261019.json. 예시 렌더링은 게임/AI 연동 검수가 아님. 자동 테스트·TS 빌드·설치기 생성 미실시(UI/그림만 수정).

## 2026-10-19 발코니 옆 시점 / 분리 표정 (GPT)

- 사용자 수정: 플레이어와 비서는 난간 안쪽에 나란히, 첫 자세는 풍경을 보는 옆모습. 발코니 장면을 해당 구도로 재제작.
- 배경 1장과 투명 인물 4장(풍경/차분함/미소/걱정). 몸은 풍경 자세의 하단 레이어로 고정, 상단 머리 레이어만 전환. 표정은 기존 대사 pose 값에 연결. 발코니 CG가 인물을 덮지 않도록 이 이벤트만 분리 표시. 기존 기록 CG는 보존.
- 실행 앱/payload 적용. 다른 이벤트는 아직 기존 방식이며 이번 수정 범위는 발코니. 게임/AI/자동 테스트 미실시, UI 자산 변경이므로 TS/설치기 재빌드 없음.
- 내장 이미지 도구 사용. 프롬프트 docs/BALCONY_SIDE_PROMPTS_20261019.json.

## 2026-10-19 집무실 자동 제국 문장 연동 (GPT)

- FlagProvider.emblemFor: 현재 세이브 제국의 iconCat/iconFile을 활성 모드 리소스 우선순위로 읽어 투명 단색 PNG 반환. 깃발 배경/제국 색 제외, 원본 알파 보존. 세이브/리소스 변경 시 캐시 무효화. 누락 시 null.
- officeStyle 응답에 emblemUrl 추가, 방 선택/15초 갱신/창 복귀 시 화면에 반영. 좌우 깃발에 원근·기울기·금속색 명암 적용. 실제 천 주름 변위맵은 미적용이며 그라데이션 명암 근사임.
- 기본 포함 9개 그림의 기존 문양 제거, 물질주의는 이미 빈 깃발. 실행 앱 및 payload 소스/해당 빌드 파일/그림 반영. 이전 그림 백업 보존.
- 앱 TypeScript 빌드 성공. 자동 테스트 및 실제 게임·모드 DDS 연동 검수는 미실시. 새 설치기 미생성. 실제 확인: 앱 재시작 → 게임 저장 → 집무실. 파일 모아보기에는 게임 연결이 없어 자동 문장이 표시되지 않음.
- 그림 생성 프롬프트 docs/OFFICE_EMBLEM_ART_PROMPTS_20261019.json (내장 이미지 도구).

## 2026-10-19 물질주의 집무실 수정 / 제국 문장 제안

- 사용자 지정: 물질주의는 대기업 본사·비즈니스 분위기. 금융 도시 전망, 목재/금속/가죽, 시장 그래프 화면으로 새 그림을 제작해 실행 앱과 payload에 반영.
- 새 그림의 좌우 깃발은 문장 합성을 위해 비워 둠.
- 제안(아직 미구현): FlagProvider의 현재 깃발 합성 경로에서 iconCat/iconFile 문장만 알파 PNG로 추출하고 현재 플레이어 번호에 연결. 활성 모드 리소스 우선순위 유지. 방별 천 영역의 원근 변형과 주름/명암 마스크로 단색 문장 합성. 세이브/문장 변경 때 캐시 갱신, 읽기 실패 시 빈 천 유지.
- 다른 배경은 기존 문양이 그림에 들어 있으므로 먼저 무문양 천으로 수정해야 함. 자동 문장 연동 완료로 간주하지 말 것.
- 그림은 내장 이미지 생성 도구 사용. 프롬프트 docs/OFFICE_CORPORATE_PROMPT_20261019.json. 테스트/게임 실행/설치기 빌드 미실시.

## 2026-10-19 가치관별 집무실 그림 9종 (GPT)

- TODO 4-1의 9개 office-<key>.png 제작, 실행 앱과 payload/app에 반영. 원본과 같은 1448×1086, 기존 office-style.js가 선택하는 경로 사용.
- 연설장별 분위기를 참고하고 책상/투사기 구도 유지. 평등주의·유심론은 office-art.css에 그림별 투사기 높이와 책상 전경 경계만 조정.
- 새 폴더/집무실_예시_20261019/집무실_모아보기.html: 비서 합성 켜기/끄기 지원. 실제 앱 UI 캡처가 아닌 광원 비교용 예시.
- 광원 제안: 공통 비서 원본 유지 → 약한 방별 색조 보정 → 필요 시 중립/따뜻함/차가움 2~3종 인물 PNG. CSS는 이미 그려진 그림자 방향을 재계산하지 못함. 별도 조명 인물/보정은 이번에 구현하지 않음.
- 생성: 내장 이미지 도구. 프롬프트: docs/OFFICE_ART_PROMPTS_20261019.json. 그림 육안/크기 확인. 이번 작업에서 자동 테스트·게임 실행·설치기 재빌드는 하지 않음.

## 2026-10-19 비서 그림 23장·전용 화면 정리 (GPT 완료)

- 첨부 얼굴 기준으로 투명 자세 6장, 외출/상복 5장, 이벤트 배경 5장·CG 7장 제작. payload/app와 실행 앱에 반영. 기존 6개 자세 파일 유지.
- 이벤트 대화창·선택지·직접 입력·시간 종료 안내·기록/회상·여운·쪽지·퇴임 카드·데이트 버튼·알림 점 정리. 국장 페이드와 움직임 줄이기 대응. IPC/AI/저장 동작 변경 없음.
- 최종 검사 PASS 2390 / FAIL 0. 한/영/중국어 팩 × 3화면 크기, 6개 CG, 퇴임/기록/쪽지 캡처 확인. 중국어 시험 팩의 기존 비서 번역 누락은 영어 대체 표시.
- 상세 docs/SECRETARY_PRESENTATION_RESULT_KO.md. 예시: 새 폴더/비서_예시_20261019/비서_모아보기.html. 게임/실제 AI 미검수, 새 설치 EXE/ZIP 없음.

## 2026-10-19 집무실 종류(제국 가치관별) + 「집무실 꾸미기」 단추 (최신, 작업컴 · payload·실행 앱 src·ui 반영)

- 사용자 결정: 제국 가치관(제국주의·외계인 친화·외계인 혐오 등)에 따라 집무실도 나뉘어야 한다. 배경 그림은 ChatGPT 에 맡기고, 우선 집무실 종류 변경 단추를 만든다.
- 종류 10: standard·authoritarian·egalitarian·xenophile·xenophobe·militarist·pacifist·spiritualist·materialist·gestalt (src/office-style.ts). 자동 = 세이브에서 읽은 우리 제국 가치관(ctx.flagProv.ethicsFor, 광신 우선, 군체·기계는 gestalt), 모르면 standard.
- 「집무실 꾸미기」 단추: 집무실 「국정」 줄의 「비서 호출」 옆(ui/office-style.js 가 끼워 넣음). 메뉴: 자동(지금 가치관 표시)·종류 10. 세이브마다 기억(sllm_office_style.json, features/office-style-app.ts, IPC officeStyle·officeStyleSet, main.ts 등록).
- 배경: assets/rooms/office-<키>.png 가 있으면 body --office-bg 로 방 배경과 비서 장면 책상 전경(office-art.css 두 줄)을 함께 바꿈. 없으면 기본 office-ai-v1.png. body[data-office] 로 종류별 CSS 조정 가능.
- GPT 할 일 문서(docs/GPT_SECRETARY_TODO_KO.md 4-1)에 그림 9장·분위기·책상 위치 맞추기 추가. 창작마당 변경 글 한 줄.
- selftest PASS 2389 / FAIL 0. 헤드리스로 집무실·메뉴 확인.

## 2026-10-19 비서: GPT 할 일 목록(그림·인터페이스) + 이벤트 의상 연결 (최신, 작업컴)

- 사용자 결정: 비서의 그림·인터페이스 조정은 GPT 가 맡는다 → **docs/GPT_SECRETARY_TODO_KO.md** 에 전부 모음(작업 규칙·지킬 클래스 이름, 남은 자세 6장, 이벤트 의상, 배경 5·CG 7, 화면 다듬기 11가지, 확인 방법). AGENTS.md·SECRETARY_ART_KO.md 에 안내 한 줄.
- 이벤트 의상 연결(그림만 넣으면 됨): EvDef.outfit — 식당 casual, 국장 mourning. 이벤트 중 서 있는 그림은 <자세>_<의상> → <대체자세>_<의상> → idle_<의상> → 평소 옷 순서로 찾는다.
- 파일: secretary-events.ts, features/secretary-app.ts(evView outfit), ui/office-secretary.js(setPose), selftest 1개. PASS 2377 / FAIL 0.

## 2026-10-19 비서 5차: 대화 한도(잊기 전까지)·서거 국장(강제)·재선/퇴임 알림 (최신, 작업컴 · payload·실행 앱 src·ui 반영, 게임 미검수)

- 사용자 결정: ① 이벤트 직접 말하기는 앞부분을 잊기 전까지 → 차면 「이제 갈 시간」. ② 통치자가 죽으면(비서가 있으면) 추모 이벤트가 강제로: 비, 엄청난 인파, 그 한가운데 애도하는 그녀의 뒷모습. ③ 재선 등으로 바뀌면 그냥 알림: 퇴임해 돌아가는 통치자(실루엣)의 뒷모습을 집무실 TV로 지켜보는 그림.
- ① EV_TALK_LINES 60(이벤트 기록 줄), 프롬프트 EV_PROMPT_LINES 80(다 들어감 → 잊지 않음). 차면 canSay=false, timeUp 문구(한/영).
- ② 「비 내리는 국장」(mourning, 강제): people-app 의 onLeaderOut 을 여러 개 받게 바꿈(추모관과 함께), 비서는 death 신호 + 지금(또는 막 떠난) 통치자면 noteDeath → 새 통치자 취임 때(syncNow) 알림 「국장 — 이름」(toastGo secretary) → 집무실 열면 refreshBadge 가 pending.forced 를 보고 enter(). 기한 없음, 상황 이벤트 중 가장 먼저. CG 장면은 지문부터 CG(그녀의 뒷모습). 말을 나눈 사이면 국장 뒤 3개월 「떠난 이의 서랍」(이제 서거 때만).
- ③ 퇴임: syncNow 에서 떠난 통치자가 명단에 살아 있으면 바로, 사라졌으면 한 달 기다려(retireWait) 사망 신호가 없으면 알림 「통치자 퇴임 — 이름」 + 집무실 그림 카드(cg/retire_tv, 없으면 TV 속 실루엣) → 확인(secretaryRetireSeen). 해임(fired) 신호면 바로.
- 그림 추가: bg/funeral_rain, cg/mourning, cg/retire_tv (ART 문서). 미제작 총 12장(bg 5 + cg 7).
- 파일: secretary-events.ts, features/secretary-app.ts, features/people-app.ts(outHooks), preload.ts, ui/office-secretary.js·css, selftest(5차 블록). 헤드리스 확인(국장 대체 배경+갈 시간, 퇴임 카드).
- selftest PASS 2376 / FAIL 0. 미검수: 게임에서 LEADEROUT death 와 명단 교체 순서, 민주정 재선 때 선대가 명단에 남는지.

## 2026-10-19 비서 이벤트: 직접 말하기 횟수 제한 없앰 (최신, 작업컴 · payload·실행 앱 src·ui 반영)

- 사용자 결정: 이벤트는 장면을 띄워 두고 대화하게 할 것 → 대화 제한 없이 자유롭게. 장면마다 3번 제한(EV_SAY_MAX)을 없애고 모든 장면(마지막 장면·다시 보기 포함)에서 말할 수 있게. 프롬프트는 최근 30줄, 저장 기록은 최근 60줄만(길어져도 넘치지 않게). 다시 보기에서 한 말은 취향 기억에 쓰지 않음.
- selftest PASS 2344 / FAIL 0.

## 2026-10-19 비서 4차: 먼저 다가오기(쪽지·기념일)·떠난 이의 서랍·감정·그녀가 기억하는 나·이벤트 중 직접 말하기 (최신, 작업컴 · payload·실행 앱 src·ui 반영, 게임 미검수)

- 사용자 결정: 「1(먼저 다가오기)·3(게임 사건과 감정)·4(그녀가 기억하는 나)」 진행, 이벤트 중 직접 말하기 추가. 2(그녀의 기원을 찾아서)는 실제 인게임 이벤트(모드 이벤트 체인)로도 넣을 만하다고 보고 나중에 깊게 설계.
- 쪽지: secretaryNudge — 집무실에서 1분마다 확인, 게임 한 달에 한 번 굴림(가까운 사이 40%, 기념일이면 꼭), AI 1~2문장, 「비서 호출」 위 손편지 말풍선(불러 보기/접어 두기). 부르면 첫 마디가 쪽지에서 이어지고 쪽지는 지움.
- 기념일: 처음 만난 달(Bond.since)·연인(loverAt)·결혼(spouseAt), 1년 단위, 한 해 한 번. 부를 때 첫 마디에서 먼저.
- 떠난 이의 서랍(상황 이벤트): 말을 나눈 통치자가 떠나면 3개월 대기, 상황 이벤트 중 가장 먼저. 매달 게임 상황에서도 통치자 교체를 알아챔(syncNow). 그림 cg/farewell(배경은 office_night 같이 씀).
- 감정: 업무 보고에 위기·패배 직전 → 걱정, 우세 → 기쁨, 해결 → 안도(feelHint).
- 그녀가 기억하는 나: 대화 요약에 like(통치자가 직접 말한 취향) → Bond.likes(최대 8), 평소 대화·이벤트·쪽지 프롬프트, 「기록 → 각하에 대해 기억하는 것」+지우기.
- 이벤트 중 직접 말하기: secretaryEventSay, 선택지 장면마다 3번, 장면은 그대로·호감 변화 없음, 업무 부탁은 개인 시간 규칙으로 사양. 끝날 때 직접 한 말에서 취향을 뽑는다.
- 파일: src/secretary-life.ts(새), secretary.ts, secretary-events.ts, features/secretary-app.ts, preload.ts, ui/office-secretary.js·css, selftest(4차 블록). 문서 SPEC·ART·assets README·창작마당 변경 글. 헤드리스 화면 확인(쪽지 말풍선·직접 말하기 칸).
- selftest PASS 2343 / FAIL 0. 그림 미제작 9장(bg 4 + cg 5). 미검수: 게임에서 쪽지 빈도, 통치자 교체 감지, AI 가 취향을 뽑는 정확도.

## 2026-10-19 비서 이벤트: 업무 외 개인 시간 규칙 (최신, 작업컴 · payload·실행 앱 src 반영)

- 사용자 결정: 이벤트 중 통치자가 비서 본연의 업무(행성 보고·정세 상황 등)를 물으면 "지금은 업무 외 개인 시간이라서요, 업무 시간에 부탁드립니다" 뜻으로 사양(몰입 유지). "일은 괜찮아?" 같은 안부는 괜찮다.
- src/secretary-events.ts eventMessages 에 규칙 한 문단(한/영 예시), selftest 1개. PASS 2298 / FAIL 0.
- 참고: 지금 이벤트는 선택지만 있어 자유 입력이 없음 → 이 규칙은 AI 가 업무 얘기로 새는 것도 막는다. 이벤트 중 자유 입력을 넣으면 그대로 적용됨.

## 2026-10-19 비서 이벤트 3차: 「수도의 식당에서」 데이트 + 여운 3개월 (최신, 작업컴 · payload·실행 앱 src·ui 반영, 게임 미검수)

- 사용자 결정: 여운 게임 30일(1개월)은 너무 짧다 → 3개월(MOOD_DAYS 90). 식당에 같이 데려가는 이벤트 추가.
- 「수도의 식당에서」(데이트): 신분을 감추고 번화가 작은 식당. 호감 45(호감 단계, 발코니 다음)·연애 꺼짐이면 신뢰 60, 12개월에 한 번. 장면 3(메뉴 고르기 → 첫 한 입(CG) → 식당을 나서며), 선택지 한/영. 그림 bg/restaurant·cg/restaurant 지시를 SECRETARY_ART_KO.md 에 추가, 없을 때 색 배경 .fb-restaurant.
- 파일: src/secretary-events.ts, ui/office-secretary.css, selftest(3차 블록), 문서 SPEC·ART·assets README, 창작마당 변경 글.
- selftest PASS 2297 / FAIL 0. 그림 미제작 총 8장(bg 4 + cg 4).

## 2026-10-19 비서 이벤트 2차: 상황 이벤트 3개월 기한 · 함께한 이벤트 기억 · 여운 (최신, 작업컴 · payload·실행 앱 src·ui 반영 — dist 는 npm start·설치기 빌드 때, 게임 미검수)

- 사용자 결정: 상황 이벤트는 일이 생기고 3개월 안에 비서와 대화(호출)하면 뜨고, 지나면 사라진다. 이벤트 선택 기억 + 이벤트 뒤 분위기 반영을 넣는다.
- 기한: 전쟁은 매달 게임 상황(gamestate-app 의 새 onGameSnapshot 등록)에서 처음 본 날을 적고 90일(30일×3) 안이면 대기. 지나면 본 것으로 넘김. 정비는 예정일(기준일+10년)부터 90일, 놓치면 기준일을 예정일로 옮김. 「비서 호출」 금빛 점도 기한 안에서만.
- 기억: 끝까지 본 이벤트마다 { 이벤트, 통치자, 날짜, 고른 선택지 번호 } (최대 8). 평소 대화 프롬프트(secMessages evNote)에 그 통치자와의 이벤트 + 가끔(보고 35%·질문 25%) 「자연스럽게 한 번 꺼내라」. 「기록 → 함께한 이벤트」 목록(한/영 선택지 이름).
- 여운: 마친 뒤 게임 30일, 선택 호감 합 ≥3 다정함 · <0 서운함 · 그 사이 차분함. [지금 분위기] 로 말투, 이름표 옆 꼬리표 「여운 · 다정함 / Afterglow · Warm」. 연애 꺼짐이면 업무다운 표현.
- 파일: src/secretary-events.ts(daysOf·addMonths·tickEvents·noteRecall·recallChoices·activeMood·evTalkNote·moodTone, EvSave.warFirst·recall·mood), src/secretary.ts(secMessages evNote), features/secretary-app.ts, features/gamestate-app.ts(onGameSnapshot 등록 — 가져오기 순환 방지), ui/office-secretary.js·css, selftest(2차 블록 30개). 문서 SECRETARY_SPEC_KO.md, 창작마당 변경 글 한 줄.
- selftest PASS 2277 / FAIL 0(다른 세션의 Vertex 변경 포함). 미검수: 게임에서 전쟁 시작일 기록·기한, AI 가 기억을 꺼내는 빈도.

## 2026-10-19 테스터 요청: Google Cloud Agent Platform(구 Vertex AI) API 키 연결 (최신, 미빌드, 작업 PC)

- 제보: Agent Platform API 키를 「직접 입력 (OpenAI 호환)」에 넣으면 404. 원인: Agent Platform 의 OpenAI 호환 주소는 프로젝트 경로 + 1시간짜리 OAuth 토큰이 필요하고, API 키(express mode)는 Google 자체 형식 generateContent 만 받음.
- 새 제공자 vertex 「Google Agent Platform · Vertex AI (API 키)」: 기본 주소 https://aiplatform.googleapis.com/v1/publishers/google, 요청 …/models/<모델>:generateContent, 키는 x-goog-api-key 머리글(주소·로그에 안 남음). 프로젝트에 묶인 키는 주소를 …/v1/projects/<ID>/locations/global/publishers/google 로.
- src/aiclient.ts: vertexBody(system → systemInstruction, assistant → model, 같은 역할 합침, user 로 시작), vertexText(생각 부분 제외, MAX_TOKENS → 잘림 처리), vertexChat(생각 끄기 thinkingBudget 0 → 거부하면 빼고 한도 +4096 으로 다시, JSON 모드 거부 시 빼고 다시, 안전 필터 차단 안내), providerChat 로 AiRouter·연결 시험이 제공자별 분기. 모델 목록은 API 키로 조회가 안 돼 자주 쓰는 이름(gemini-2.5-flash/flash-lite/pro) 제안 + 직접 입력.
- 제공자 이름 영어 번역(그동안 「(OpenAI 호환)」「(내 컴퓨터)」가 영어 화면에서도 한국어였음).
- 검사: tsc 통과, selftest PASS 2246 / FAIL 2(작업 PC 검사 환경 차이 2개, 새 시험 12개 통과 — 가짜 서버로 주소·머리글·재시도 확인). 미검수: 실제 Agent Platform 키로 호출.

## 2026-10-19 비서 이벤트(미연시식) 첫 묶음 (최신, 작업컴 · payload·실행 앱 src·ui 반영 — dist 는 npm start·설치기 빌드 때 다시 만들어짐, 게임 미검수)

- 사용자 결정: 대사는 AI, 순수 이야기(게임 효과 없음). 이벤트마다 전용 배경·CG. 고백·청혼·결혼식 이벤트는 아직 안 만듦. 사용자는 비서를 다 만든 뒤 한꺼번에 테스트할 예정.
- 첫 묶음: 「집무실 발코니에서」(데이트, 호감 20/연애 꺼짐이면 신뢰 40부터, 12개월에 한 번), 「전쟁이 선포된 밤」(새 전쟁마다), 「정기 정비의 날」(처음 부른 날부터 10년마다). 장면마다 지문(한/영) → AI 대사 2~3줄 → 선택지(앱이 정한 호감). 「기록 → 회상」 다시 보기. 상황 이벤트가 기다리면 「비서 호출」 아이콘에 금빛 점, 끝나면 업무 보고로 이어짐.
- 파일: src/secretary-events.ts(새), src/secretary.ts(POSE_RULE·STAGE_GUIDE export, SecSave.ev), features/secretary-app.ts(secretaryEvent·secretaryEventNext, prepare/leftBy), preload.ts, ui/office-secretary.js·css, selftest(비서 이벤트 블록). 문서: SECRETARY_SPEC_KO.md·SECRETARY_ART_KO.md(배경 3·CG 3 지시), assets/secretary/README.txt, 창작마당 변경 글 한 줄.
- 그림 미제작: bg/balcony·office_night·maint_bay, cg/balcony·war_night·maintenance(1920×1080). 없으면 색 배경으로 대신(헤드리스 확인).
- selftest PASS 2236 / FAIL 0(다른 세션의 알파 8·의회 영어 변경 포함). 미검수: 게임에서 AI 대사 길이·표정 선택, 전쟁 이름 감지(gameState.wars), 정비 날짜 계산.

## 2026-10-19 QA: 은하 공동체 회의 영어 + 알파 8 특수 나라 「대화 전용」 (최신, 미빌드, 작업 PC)

- 테스터 제보: 영어로 해도 은하 공동체 회의가 한국어로 많이 나옴.
  - 원인 1: 의회 토론 AI 프롬프트(councilai.ts)에 「한국어.」가 박혀 있어 응답 언어 지시보다 앞섬 → 지움(응답 언어는 AiRouter 의 언어 지시를 따름).
  - 원인 2: 안건 이름·설명(reslocal.ts)이 영어 위에 늘 한국어 번역 파일로 덮음 → 화면 언어의 게임 번역 폴더(locFolder)로 덮게(영어 화면이면 영어만, 언어 팩이면 그 언어). 연방 법 이름(fedLawName)도 같은 방식(lang 인자).
  - 원인 3: features/council.ts 의 알림·상태·오류 문구가 한국어 고정 → pick(한/영) 30여 곳. 트레이 메뉴 「안건 회의 직접 참여하기」는 joinLabel().
  - council.html 고정 문구는 정적 검사로 모두 번역 확인(영어 화면 그려 확인).
- 알파 8 구현 — 특수 나라와 대화 전용:
  - mod-compat.ts policy(): 호환 팩 규칙이 없는 나라 유형(모드 특수 제국 등)도 통신이 닿으면 contact:true, actions:false. 잘못 적은 규칙은 닫음. 기본 3종(default·fallen·awakened)은 그대로.
  - 연결 모드는 이미 통신이 닿는 모든 AI 나라를 유형과 함께 보내고 있었음(sllm_probe_terminal.txt) → 모드 변경 없음.
  - 대화 전용이면: 프롬프트에 「대화 전용, 게임 행동·조약 약속 금지」(기존), 채팅 결과의 action·mood 제거(기존), 만찬·편지 제안·초대·호의 지급 막힘(기존 actionsAllowed).
  - 외교 단말기 연락처에 「대화 전용」 표시(+설명 툴팁). 연락처 종류·「통신 가능」 문구가 자동 번역 제외 칸이라 영어에서도 한국어였음 → 직접 번역.
- 고침: src/councilai.ts, src/reslocal.ts, src/features/council.ts, src/features/windows.ts, src/mod-compat.ts, src/features/terminal.ts, ui/terminal-ui.js, ui/i18n-catalog.js, src/selftest.ts(기존 안전 시험 1개를 새 규칙에 맞춤 + 새 시험 12개). 실행 앱 src·ui 에도 같은 파일(dist 는 bat).
- 검사(작업 PC 리눅스 검사 환경, tsc 로 바꿔 실행): tsc 통과, selftest PASS 2172 / FAIL 2 — 2개는 이 검사 환경 차이(컴파일된 selftest.js 를 언어 팩 규칙이 읽음, 입력 훅 시험)로 원래 PC 의 tsx 에서는 통과하던 항목.
- 미검수: 실제 게임에서 Gigastructures 특수 제국(Katzenartig Imperium 등)이 연락처에 뜨는지, 영어 게임에서 안건 이름.

## 알파 8: 특수 제국과 「대화만」 (2026-10-19 사용자 결정 → 같은 날 구현, 아래 「알파 8 구현」 참고)

- 테스터 요청: Gigastructures 의 Katzenartig Imperium 같은 특수 제국과도 대화하고 싶다. 외교 행동이 안 되거나 중반 위기 같은 이벤트가 깨질 수 있으면 행동 없이 대화만이라도.
- 결정: 알파 8 에 넣는다. 외교 행동(조약·전쟁·선물 등 게임 명령)은 보내지 않고 대화·편지 답장·만찬 대화만.
- 이미 있는 토대(참고): 모드 호환 팩 countryTypes 의 { contact, actions } 규칙 → main.ts actionsAllowed(), withLore 의 readOnlyActions, chat/banquet/mail/dinner 가 actions=false 면 행동을 막음. 연결 모드는 is_country_type default·fallen·awakened 와 통신이 있는 나라에 sllm_idx 를 매김(sllm_probe_effects.txt).
- 할 일: ① Katzenartig 등 Gigastructures 특수 제국의 country_type 확인(창작마당 Gigastructures 파일) ② compatibility-gigastructures.json countryTypes 에 contact:true, actions:false 추가 ③ 연락처에 「대화 전용」 표시(한/영·언어 팩) ④ 통신이 없는 특수 제국을 연락처에 넣을지 결정 ⑤ 대화 프롬프트에 「게임 행동 제안 금지」 확인.

## 2026-10-18 밤 실행 앱 최신화 + 비서 장면 개편 (최신, 실행 앱 dist 반영)

- **실행 앱 = payload 최신화**: 실행 앱에 빠져 있던 다른 세션 변경 32개(src·ui: 배경 이야기 backstory, 앱 업데이트 app-update, window-bounds, 「나」→통치자 이름, 편지·서신함·총독·정상회담 등)를 payload 최신판으로 덮어쓰고, payload src 로 dist 를 다시 빌드해 바뀐 js·map 62개를 넣음(tsc 통과, selftest PASS 2155/FAIL 1). 이로써 앞 항목의 "실행 앱에는 비서 부분만 더함" 상태는 해소.
- **비서 장면**: 「비서 호출」(#secCall) → 홀로그램 바탕화면이 투사기로 접혀 내려가고, 비서가 오른쪽에서 걸어 들어오며 위→아래 기동 빛. 아래 대화창(이름표·호감·행동지문·한 글자씩 대사, 누르면 바로 다 보임), 고르기 단추·입력. 닫기(✕) 없음, Esc 막음 — 「이만 물러가라」 → 단계별 작별 인사(bow) 후 퇴장, 홀로그램 복귀. 「기록」: 업무 메모·함께한 기억·역대 통치자·연애 끄기.
- **행동지문·자세 그림**: AI 응답 JSON 에 action(행동지문)·pose(12가지: idle smile bow report think worried stern shy surprised sad laugh tender) → ui/assets/secretary/<pose>.png 로 바뀜(없으면 idle → secretary → 실루엣). 그림 지시서 docs/SECRETARY_ART_KO.md(ChatGPT 용 공통 인물 문장·자세별 지시).
- 파일: src/secretary.ts·features/secretary-app.ts·selftest, ui/office-secretary.js·css(새로 씀), ui/office.html(아이콘 id=secCall, #secretary 칸 없앰). selftest PASS 2161 / FAIL 1(A-22 기존).

## 2026-10-18 밤 비서 2단계: 모드에 정부 형태·자원 창고 → 결혼·버티는 개월 (최신, 모드 변경 있음 · 업로드용 폴더 반영)

- 새 모드 파일 common/scripted_effects/sllm_probe_secretary.txt: `sllm_probe_secretary = { REQ = n }` → SLLM:SECRETARY(auth 1 민주 2 과두 3 독재 4 제국 5 기업 6 군체 7 기계, 창고 구간 se/sm/sf/sa/sc = has_resource 문턱 100~50000 중 넘은 가장 큰 값, 0 = 100 미만). 게임 규칙 변경 없음, 로그만.
- 넣은 곳 5곳: payload tester-mod, 실행 앱 tester-mod, 문서\mod\sllm_missive(업로드용), 문서\mod\sllm_missive_tester, dist/workshop_0.1.0-alpha.7/sllm_missive.
- 앱: 호출 때 정부 형태·창고를 함께 묻고(옛 모드면 12초 한 번 기다린 뒤 이번 실행 동안 생략), 적자 보고에 "창고 최소 N, 최소 M개월 버팀"/"곧 바닥". 결혼: 연인 + 호감 90 + 종신 통치자(독재·제국) → 「청혼하기」 → 배우자. 배우자 통치자가 떠나면 기록에 배우자, 다음 통치자에게 미망인으로.
- 창작마당 변경 글(dist/workshop… 와 개발 폴더 최상위)에 비서·화면 정리·고친 문제 추가. 다른 세션의 알파 7 이후 항목(배경 이야기·앱 업데이트·「나」→통치자 이름 등)은 아직 안 넣음 → 그 세션이 추가하거나 올리기 전 합칠 것.
- 미검수: has_authority 값, has_resource 문턱 구간, SECRETARY 응답 짝 맞추기(게임에서).

## 2026-10-18 밤 집무실 비서 1단계(극비 안드로이드 비서·업무 보고·지식 카드·연애) (최신, 실행 앱 dist 반영, 게임 미검수)

- 설계: docs/SECRETARY_SPEC_KO.md(사용자 결정: 여자 안드로이드 비서, 신뢰는 자리·호감은 통치자 개인(A), 결혼은 종신 통치자만 = 2단계).
- 새 파일: src/secretary.ts, src/secretary-cards.ts(영어 카드 27장, 4.x 기준), src/features/secretary-app.ts, ui/office-secretary.js·css. 바꾼 파일: main.ts(registerSecretary), preload.ts(secretary* 7개), app/log-router.ts(SLOT.SECRETARY 241), office.html(「비서 호출」 아이콘·#secretary 칸), i18n-catalog.js(비서·비서 호출), selftest(비서 블록 22개).
- 호출 때 최신 경제 수치: `effect … sllm_probe_speech_ctx` 로 SPEECHCTX 를 받음(모드 변경 없음). 업무 보고는 앱 규칙(위기>전쟁 피로>적자>파벌>정책 경고>서신), AI 는 말로 옮김. 지난 보고 후속(해결됨/그대로).
- 주의(다른 세션): 실행 앱 dist 는 다른 세션의 backstory·app-update 변경이 아직 빌드되지 않은 상태라, 실행 앱의 main.ts·preload.ts·log-router.ts·office.html·i18n-catalog.js 는 **실행 앱 쪽 판에** 비서 부분만 더해 넣었고 dist 도 그 판으로 빌드함. payload 쪽은 최신 payload 판에 더함(payload dist 는 손대지 않음 — 전체 빌드 때 반영). 실행 앱과 payload 맞추기는 그 세션들 반영 때 같이.
- selftest(payload 최신 기준) PASS 2144 / FAIL 1(A-22 기존). 화면 헤드리스(한/영·이름 짓기).
- 미검수: 게임에서 SPEECHCTX 응답(n=req) 짝 맞추기, 통치자 교체 감지(지도자 명단 ruler), Player2 응답 길이.

## 2026-10-18 밤 QA: 화면의 「나」 → 플레이어 통치자 이름 (최신, 미빌드)

- 사용자 규칙: 이름 자리에 「나」로 나오던 것은 무조건 플레이어 통치자 이름을 따른다(모를 때만 「나」).
- 통치자 이름: features/people-app.ts playerRulerName() — 이번 달 명단의 통치자(떠난 사람 제외) → 제국 정보(PROFILE ruler) 순. IPC playerRuler, preload playerRuler.
- 바꾼 곳: 외교 단말기 송신 머리줄(index.html), 행성 총독 창(gov.html), 총독 홀로그램 보고(govreport.html, 「나 (통치자)」), 만찬 대화(banquet-chat.js, 이름 칸 번역 제외), 연방 정상회담 기록(summit.ts, 제국 이름 → 통치자 이름).
- 그대로 둔 것: 의회 의석 이름 「플레이어 제국 (나)」(제국 의석 표시, 시연 자료), 정상회담 명단의 「· 나」 표시(이미 통치자 이름 옆에 붙는 표식), AI 프롬프트 안의 「지도자」.
- 검사: tsc 통과, selftest ALL PASS(새 시험 8개).

## 2026-10-18 밤 QA: 모두 읽음 표시(개인 서신·외교 서신)·책상 신문 더 크게 (최신, 미빌드)

- 사용자 요청: 안 읽은 편지 표시가 직접 열어야만 사라짐 → 「모두 읽음 표시」(편지 AI 를 부르지 않고).
- 집무실 개인 서신 머리줄 「모두 읽음 표시」(lettersReadAll): 봉투만 읽음으로, 본문 AI 는 나중에 직접 열 때 처음 씀. 외교 단말기 외교 서신에도 같은 단추(inboxReadAll, 열지 않고 읽음만). 안 읽은 편지가 없으면 단추 꺼짐. 배지 바로 갱신.
- 책상 신문(AI 그림, 다른 세션) 크기 0.14 → 0.17(office-art.css).
- 고침: features/letters-app.ts, features/mail-app.ts, preload.ts, ui/office.html, ui/index.html, ui/mailbox-ui.js, ui/office-art.css, i18n-catalog(3개).
- 검사: tsc 통과, selftest ALL PASS(새 시험 5개).

## 2026-10-18 밤 QA: 집무실 책상 신문(종이 펼치기)·신문 크게 보기·창 크기 기억 (최신, 미빌드)

- 사용자 피드백: 신문은 종이(흰 바탕·검은 글씨)가 읽기 편함, 집무실 신문 화면이 작음, 집무실 창을 키워도 닫았다 열면 기본 크기(21:9 모니터).
- 집무실 책상 위 접힌 신문(office.html #deskPaper, 배경 책상 오른쪽 빈자리, 화면비에 따라 같이 움직임). 누르면 종이 지면 큰 창 + 종이 펼치는 효과(0.55초, 움직임 줄이기 설정이면 생략) + 작은 종이 소리(소리 파일 없이 합성, 음량 0.06). 안 읽은 새 호가 있으면 「새 호」 표시(세이브별 본 호 수, sllm_paper_seen.json).
- 집무실 디스플레이 신문에 「⤢ 크게 보기」 → 디스플레이 지면 큰 창(mode=display). 오버레이 종이·집무실 디스플레이 구분은 그대로.
- 창 크기·위치 기억: src/window-bounds.ts(restoreRect·BoundsStore, sllm_window_bounds.json). 집무실 창과 큰 신문 창(높이·위치). 모니터가 바뀌어 70% 넘게 안 보이면 기본 자리.
- 고침: features/media.ts(openPaper 모드·paperDesk·paperBig·새 호), features/office-app.ts, preload.ts, ui/paper.html, ui/office.html, i18n-catalog(4개). 기존 시험 3개 문자열을 새 구현에 맞춤.
- 검사: tsc 통과, selftest ALL PASS(새 시험 14개), 책상 신문 위치를 16:10·21:9 화면으로 그려 확인. 미검수: 실제 앱에서 소리 크기·효과.

## 2026-10-18 밤 QA: 제국·인물 전기 직접 입력 (최신, 미빌드)

- 테스터 요청: 모드 특수 제국(Gigastructures 의 Blokkats·Katzenartig Imperium 등)·모드 영웅(Suigintou 등)의 설정을 AI 가 알게 직접 써 넣기. 사용자 결정: 인물은 내 제국 연락처 인물만, 제국은 단말기 대화창.
- 외교 단말기(index.html) 상대 이름 밑 「📜 제국 전기」 → 입력 창(ui/backstory-ui.js 공용). 이름으로 저장(앱 데이터 sllm_backstory.json, 같은 이름이면 다른 세이브에서도). withLore 에서 사용자 글이 게임·모드·세이브 전기보다 먼저(상대·내 제국 모두). 비우면 원래 전기. 「게임 전기 불러오기」로 기존 전기를 고쳐 쓰기.
- 집무실 연락처 상세(office.html) 「📜 인물 전기」 → 세이브별 인물 기억(sllm_persona.json)의 bio. 인물 대화(말투 정하기·대화), 개인 서신(편지·작별·답장), 총독 창에 들어감. 저장하면 말투를 새로 정함.
- 새 파일: src/backstory.ts, src/features/backstory-app.ts(IPC 4개), ui/backstory-ui.js. 고침: main.ts(autoLore·registerBackstory), persona.ts(bioBlock), features/persona-app.ts, letters.ts, features/gov.ts(setGovBio — 가져오기 순환 피함), preload.ts, i18n-catalog(영어 20개).
- 검사: tsc 통과, selftest PASS 2093 / FAIL 0(PC 최신본 전체로 다시 돌림 — 앞서 남았던 「집무실: 오버레이 아이콘·테마·아이콘 줄 높이」는 다른 세션의 windows.ts 작업이 끝나 통과). 새 시험 17개 통과. 미검수: 실제 화면.

## 2026-10-18 밤 오버레이 신문 아이콘 복귀·설정 톱니바퀴·신문 지면 고정 (최신, 실행 앱 dist 반영)

- 오버레이: 신문 아이콘 복귀(집무실·신문·성간 라디오·설정, BASE_ICON 높이 203). 설정 아이콘을 톱니바퀴 모양으로.
- 신문 지면을 여는 곳으로 고정: 오버레이 신문 아이콘 = 종이 지면, 집무실 = 디스플레이 지면(paper.html?mode=paper|office). 오른쪽 아래 「지면:」 바꾸기 단추는 숨김(집무실 유리에서 종이로 바꾸면 글자가 사라지던 문제). 다른 지면으로 이미 열려 있으면 닫고 새로 연다(media.paperMode).
- 집무실 신문 껍데기(OFFICE_SKIN_PAPER)의 글자 뒤집기(invert) 제거 — 디스플레이 지면이라 바탕만 비움.
- 파일: ui/launcher.html·paper.html, src/features/media.ts·office-app.ts·windows.ts, src/office.ts, selftest. 실행 앱·payload src+dist 반영. selftest PASS 2072 / FAIL 1(A-22 기존).

## 2026-10-18 밤 QA: 창작마당 모드로 앱 업데이트(설치기 다시 받기 없이) (최신, 미빌드)

- 사용자 요청: 테스터마다 설치기를 다시 받게 하지 말고, 창작마당 모드 업데이트로 앱도 업데이트. 방식은 「알림 후 사용자가 누르면 업데이트」.
- 새 파일: src/app-update-core.ts(서명·버전·해시 확인, 바뀐 파일만 교체·백업·되돌리기, 경로 허용 목록), src/features/app-update.ts(설치판에서만, 켠 뒤 8초·20분마다 확인, 대화창 한/영 pick), 개발 폴더 tools/make-app-update.js(key·bundle).
- main.ts: registerAppUpdate(). version-check.ts: 모드가 앱보다 새 버전일 때 안내에 「업데이트」 알림 언급. 이 안내와 모드가 낮은 버전 안내의 영어(카탈로그 패턴 2개, 그동안 영어 없었음).
- make-installer.ps1(설치기_만들기.bat): 1단계에 서명 키 준비(+공개 키 update-public-key.pem 을 payload·실행 앱에 넣음), 7단계 추가 — 문서 mod/sllm_missive/sllm_app_update 에 묶음. 단계 표시 /6 → /7. RELEASE_RULES_KO.md 8번에 규칙 적음.
- 연결 DLL(native/command-bridge.dll)이 바뀐 버전은 앱 안에서 안 하고 설치기 안내(게임 폴더 DLL·제거 규칙 유지).
- 검사: tsc 통과, selftest PASS 2060 / FAIL 0(새 시험 20개), 키→묶음→확인→적용 흐름 따로 시험. 미검수: 실제 창작마당 업로드에 .js·.exe·.dll 이 그대로 올라가는지, 윈도우에서 재시작.
- PC 두 대: 서명키_옮기기.bat(+move-signing-key.ps1) 추가 — 내보내기/가져오기 자동 판단, 공개 키 짝 확인(make-app-update.js check). 키 없는 PC 에서 key 단계는 새 키를 만들지 않고 멈춤(SLLM_UPDATE_NEW_KEY=1 일 때만 새 키).
- 주의: 이 기능이 들어간 설치기를 사용자가 한 번은 받아야 그 뒤부터 자동. 업데이트로 새로 생긴 파일은 제거 프로그램 목록에 없어 제거 후 남을 수 있음(설치기로 다시 설치하면 목록 갱신).

## 2026-10-18 밤 QA: 스텔라리스만 관리자 권한일 때 DLL 연결 실패 — 자동 감지·안내 (최신, 미빌드)

- 테스터 제보: 스텔라리스는 관리자 권한, SLLM(Electron)은 일반 권한일 때만 「연결 DLL을 불러오거나 게임 창에 연결하지 못했습니다」. 둘 다 같은 권한이면 정상. 원인 = 윈도우 무결성 수준/UIPI(일반 권한 → 관리자 권한 프로세스 접근 차단). 버그 아님.
- src/native-bridge.ts: bridge-client 결과가 state 1(DLL 연결 전 실패)일 때만 checkGameElevation() 실행(PowerShell + OpenProcessToken/TokenElevation, 앱 자신의 관리자 여부 함께). 게임만 관리자 권한(또는 토큰 접근 거부)이면 ELEVATION_MISMATCH_MESSAGE 로 바꿔 안내, 진단 로그 bridge.elevation_mismatch. 아니면 기존 문구 그대로. 판정은 parseElevation()(앱이 관리자면 항상 ok).
- 번역: i18n-catalog 에 안내 문구 영어 1개(글자 그대로 일치 필요).
- 검사: tsc 통과, selftest PASS 2049 / FAIL 0(새 시험 10개). 미검수: 실제 윈도우에서 관리자 권한 게임으로 확인.

## 2026-10-18 저녁 QA: Player2 「fetch failed」 — 127.0.0.1 재시도·원인 코드 (최신, 미빌드)

- 테스터 제보: 라디오 「Player2 연결 실패: fetch failed」, 총독 보고 「연결되었지만 보고를 받지 못했습니다」, 「Player2 다시 연결」을 눌러도 같은 오류. = 앱이 localhost:4315 에 접속 자체를 못 함.
- src/player2.ts:
  - localhost 접속이 요청 전송 전에 실패하면(ECONNREFUSED·ENOTFOUND·EADDRNOTAVAIL·ENETUNREACH·EHOSTUNREACH·EAI_AGAIN, 또는 GET) 127.0.0.1 로 한 번 더. 되면 그 주소를 계속 씀(진단 로그 player2.base.fallback). 윈도우가 localhost 를 ::1 로 먼저 풀고 Player2 가 IPv4 에만 열린 경우 대비. 대화 POST 가 전송 중 끊긴 경우는 중복 요청이 될 수 있어 재시도 안 함.
  - 실패 문구에 원인 코드: 「Player2 연결 실패: fetch failed (ECONNREFUSED) — Player2 앱이 켜져 있고 로그인돼 있는지 확인하세요.」(코드가 없거나 ECONNREFUSED 일 때만 안내 꼬리).
- 번역: i18n-catalog 패턴 2개(안내 포함/일반). features/settings-ui.ts uiText 가 카탈로그 패턴(SLLMPatterns)도 씀 — 카탈로그 module.exports 에 열거되지 않는 __patterns 로 붙임(문구 목록·언어 팩 뼈대에는 안 섞임). 상태 줄 등 메인 쪽 오류 문구도 영어·언어 팩으로 나옴.
- 검사: tsc 통과, selftest PASS 2039 / FAIL 0(새 시험 5개: localhost→127.0.0.1 변환, 거부 시 대체 주소로 연결·유지, 실패 문구 원인 코드).
- 미확인: 실제로 IPv6 문제였는지(테스터 PC 에서 http://localhost:4315/v1/health 와 http://127.0.0.1:4315/v1/health 비교 요청). Player2 가 아예 꺼져 있으면 이 수정으로는 해결 안 됨(문구만 더 분명해짐).

## 나중 과제(사용자 결정 2026-10-18): 게임 화면 안에 직접 그리는 오버레이

- 지금은 앱 창을 게임 위에 띄우는 방식이라, 독점 전체화면에서는 창이 뜨면 게임이 내려감(윈도우 규칙). 당장은 테두리 없는 전체화면 안내·자동 전환 + 창을 닫을 때 게임을 앞으로 돌려주기로 대응.
- 언젠가: OP.GG(Overwolf)처럼 게임의 DirectX 화면 안에 직접 그리기. 이미 게임에 넣는 연결 DLL(command-bridge)이 있으니 그 위에 그리기 훅(Present 가로채기) + 앱 화면을 오프스크린으로 그려 넘기기(Electron offscreen 렌더) + 입력 넘기기가 필요. 규모가 커서(몇 달) 베타 이후로 미룸. 사용자가 "언젠간의 과제"로 남기기로 함.

## 2026-10-18 오후 게임 화면 모드(독점 전체화면) 대응 (최신, 실행 앱 dist 반영, 게임 미검수)

- 사용자 보고: 전체화면에서 앱 창이 뜨면 스텔라리스 창이 내려감. 원인: 독점 전체화면(settings.txt fullScreen=yes)은 다른 창이 앞에 서는 순간 윈도우가 게임을 내리는 규칙. OP.GG 는 게임 안에 그리는 방식(Overwolf DirectX 끼워 넣기)이라 다름 — 우리는 그 길 대신 「테두리 없는 전체화면」을 안내·자동 전환.
- 새 파일 src/game-display.ts: settings.txt 모드 읽기(exclusive/borderless/windowed), settings.txt·pdx_settings.txt 를 테두리 없음으로 고치기(원본 .sllm-bak).
- 설정 → 게임 연동 점검: 독점 전체화면이면 ⚠ 경고 + [테두리 없는 전체화면으로 바꾸기] 단추(IPC displayFix, 게임이 켜져 있으면 끄라고 안내). 게임이 켜질 때 한 번 알림 카드.
- 창을 접을 때 게임을 다시 앞으로: 게임 창 추적(PowerShell) 줄에 hwnd 추가, gameWindow.focusGame(hwnd) = SetForegroundWindow(+최소화면 복원). 단말기 ✕/접기·설정 창 닫기·집무실 닫기에서 우리 창이 포커스를 갖고 있을 때만 부름(독점 모드에서 내려간 게임도 되살아남).
- 영어 번역 추가(경고·단추·알림). selftest PASS 2033 / FAIL 1(A-22 기존). 실행 앱·payload src+dist 반영.
- 미검수: 실기에서 pdx_settings 가 런처 재실행 때 settings.txt 와 어긋나지 않는지, SetForegroundWindow 가 거부되는 경우(앱이 앞이 아닐 때) 없는지.
- 참고: 사용자 PC 현재 설정은 이미 borderless(fullScreen=no, borderless=yes, pdx display_mode=borderless_fullscreen). "창이 나가진다"가 테두리 없음 상태에서도 나는 증상이면 다른 원인(포커스·Fullscreen Optimizations) → 사용자에게 증상 확인 요청함.

## 2026-10-18 오후 실기: 1:1 통신 답 끊김 + 신문 제호·브랜드 아이콘 사라짐 수정 (최신, 실행 앱 dist 반영)

- 신문 제호(신문 이름 큰 글씨)·브랜드 아이콘이 안 보임: paper.html 에서 번역 설명 주석(//)이 같은 줄 코드 앞에 붙어 `title.className`·`identity.append(brand, title…)` 가 주석이 됨 → 주석을 윗줄로 분리. selftest 에 재발 방지 검사.
- 1:1 통신 답이 문장 중간에서 끊김("제 눈에 든 유능한"): 한도에 걸려 잘린 JSON 도 reply 를 건져 그대로 썼음. parseJson 이 잘린 답에 partial 표시 → personaJson 은 잘린 답이면 한도 두 배로 다시 부르고, 그래도 잘리면 마지막 완성 문장까지만(endSentence, 문장이 없으면 …).
- 실행 앱·payload src+dist 반영(persona.ts·persona-app.ts·selftest, ui/paper.html). selftest PASS 2024 / FAIL 1(A-22 기존).
- 참고: 다른 세션이 이 파일을 옛 사본(108KB, 정책 기간 2년 시절)으로 덮어써 위 4개 항목이 사라졌던 것을 다시 살림.

## 2026-10-18 오후 오버레이 정리 + 외교 단말기 집무실 아이콘 (최신, 실행 앱 dist 반영)

- 오버레이(게임 오른쪽 아래 아이콘 줄): 집무실·성간 라디오·설정만 남김. 외교 단말기·신문·총독·종속국·함대 버튼 제거(모두 집무실 바탕화면에서 연다). 아이콘 줄 높이 BASE_ICON 410→160. 안 읽은 외교 서신 숫자는 집무실 아이콘 숫자에 합침(개인 서신 + 외교 서신).
- 집무실 바탕화면 「국정」 맨 앞에 「외교 단말기」 아이콘(안 읽은 외교 서신 숫자). 누르면 본 창(index.html)이 홀로그램 본문 자리에 붙고 다른 창처럼 반투명 유리(OFFICE_GLASS_TERM: body 그라데이션까지 비움, 서랍이 열리면 뒤 대화 화면 숨김).
- 본 창은 닫지 않고 숨겨서 뗌(대화 유지): ✕·최소화·단축키·「‹ 바탕화면」·Esc·다른 앱 열기·집무실 닫기 → 덧입힌 CSS 지우고 원래 크기·위치로. 붙어 있는 동안 게임 창 따라가기·자리 저장·크기 배율·자동 흐려짐 멈춤.
- 본 창을 처음부터 투명 창(glassWin)으로 만듦 → 따로 뜰 때 모양은 그대로(body 불투명). 위험: Windows 에서 투명 창은 테두리를 끌어 크기 바꾸기가 안 될 수 있음 → 실기 확인 필요.
- 알림 카드·트레이·단축키로 여는 단말기는 예전처럼 따로 뜸. office-app ↔ windows 는 setTerminalHook 으로 연결(가져오기 고리 없음).
- 파일: src/features/windows.ts·office-app.ts, src/office.ts, ui/launcher.html·office.html, selftest(새 블록). 실행 앱·payload 의 src+dist 반영. selftest PASS 2021 / FAIL 1(A-22 기존). 화면 헤드리스 확인(한/영).
- 설치기에는 아직 없음 → 설치기_만들기.bat 다시 실행 필요.

## 2026-10-18 오후 실기(알파 7 구독본): 개인 서신 열기 실패 수정 (최신, 실행 앱 dist 반영)

- 증상: 집무실 개인 서신 봉투를 열면 매번 「편지를 읽지 못했습니다」. 앱 로그: Player2 답이 maxTokens 700 중 686 을 쓰고 본문 29~31자(추론형 모델이 생각에 토큰을 씀) → JSON 이 잘려 body 없음. 말투 정하기(300)도 2~31자. 신문 호외(700)도 같은 이유로 ai.response.invalid.
- 수정: persona-app.ts personaJson(msgs, 한도, 필요한 칸) = 넉넉한 한도로 부르고 칸을 못 읽으면 한도 두 배로 한 번 더. 편지 본문 2400, 답장 1500, 말투 1000, 대화 요약 1000, 1:1 통신 1500, 비문 800. 신문 호외·위기 특별판 700→2000, 종속국 결정 회신 600→1500, 정책 버프 추천 400→1500.
- 실행 앱·payload 의 src 와 dist(바뀐 js 6개+selftest)에 바로 반영(샌드박스 tsc 결과가 PC 빌드와 같음을 확인). 앱을 다시 켜면 적용. selftest PASS 2015 / FAIL 1(A-22 기존).
- 참고: 다른 제국이 보내는 AI 편지(서신함)는 설정 「AI 편지(실험 기능)」가 꺼져 있어서(mailEnabled=false, 기본값) 오지 않음 — 버그 아님.
- 설치기를 이미 만들었다면 이 수정은 들어 있지 않음 → 설치기_만들기.bat 다시 실행 필요.

## 2026-10-18 오후 알파 7 배포 준비 (최신, 설치기 미생성)

- 버전 0.1.0-alpha.7(연결 규격 5 그대로). 올린 곳: package(-lock)·descriptor·HELLO(payload·실행 앱·문서\mod 두 곳)·setup.nsi·README_KO·ALPHA_SETUP_KO/EN·RELEASE_NOTES_KO/EN. 기록: RELEASE_ALPHA7_KO.md.
- 실행 앱 = payload 맞춤(QA 세션 변경 10개 실행 앱에 반영). 격리 빌드 tsc 통과, selftest PASS 2014 / FAIL 1(A-22 예시 그림, 실제 PC 통과 예상).
- 패치노트: 알파 6 이후 CURRENT_TASKS 모든 세션 항목(집무실 1~4단계·정책 퀘스트·정부 발표 칙령·함대 청문회 장면·종속국 공문실/실제 이행·언어 팩·영어 정리·QA 수정·배경 그림). 알파 6 내용은 아래 '이전 배포'로 남김.
- 창작마당: dist/workshop_0.1.0-alpha.7/sllm_missive(122개) + 창작마당_변경사항_0.1.0-alpha.7.txt(개발 폴더에도). 업로드 원본 문서\mod\sllm_missive 같은 내용·버전.
- 남은 일(사용자): 설치기_만들기.bat 실행, 창작마당 업로드. 게임 검수 목록은 RELEASE_ALPHA7_KO.md.

## 2026-10-18 오후 언론 인터뷰 「정부 발표」 칙령 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 사용자 확정 설계: 기자 주제 3개 옆에 「정부 발표」 칸 하나(인터뷰 한 번에 하나). 플레이어 발표 → 기자들 날카로운 후속 질문 → 주제를 닫을 때 평가와 칙령 분류가 한 번에. 인터뷰 끝내기 전 확인 카드(예: 칙령: 순혈 수호령 — 외계인 배척 강화(강) · 2년 · 이득/대가/반대 가치관 관계), 플레이어가 확정해야 게임에 들어감. 신문·라디오는 다음 달 자료로(추가 호출 없음). 항의 = 가치관 정반대 제국 1~2곳이 기존 서신으로 항의 서신.
- src/edict.ts(순수): 칙령 묶음 10개(외계인 배척 강화·외계 종족 개방·군비 증강·평화 선언·질서와 통제·시민 권리 확대·과학 우선·신앙 수호·경제 부흥·복지 확충) = 기존 버프 목록 이득 2(sllm_buff_*) + 대가 1(sllm_debuff_*) + 반대 가치관(광신 포함) 제국 관계 −15/−30/−50(약/중/강). 강도는 효과 크기만. 기자 반응 나쁨 → 국내 이득만 한 단계 낮춤(약이면 두 번째 이득 빠짐), 대가는 그대로. 집무실 정책이 같은 수정자를 쓰면 그 이득은 빠짐(정책 선포 때도 반대로 확인). 기간 1~3년(카드에서 고름, 기본 2년). 새 칙령은 시행 중 칙령을 대신(이전 효과 지움). 명령 edictCommand(sllm_edc_<cid> 한 번만, EDICTX = 관계가 깎인 연락 중 AI 제국 번호, EDICTAPPLY).
- 앱: press.ts 주제에 gov 칸(호평 행복도 수와 따로), press-app.ts judgeGov(편집국 평가+분류 JSON, '정책' = 아직 발표 안 한 집무실 정책 발표 → 그 정책 다음 불이익 1번 면제), pressEnd 가 칙령 후보가 있으면 confirm 반환 → 카드에서 apply/skip·기간. features/edict-store.ts(sllm_edicts.json). 연대기 「○월 ○일 기자회견(언론사)에서 「…」 칙령 발표 — 묶음(강도) · n년 시행 · ○○ 제국들 반발」, 라디오 큐 문구에도. 예전 '세 번째 주제를 정부 발표로 바꾸기'는 없앰(기자 주제는 늘 3개).
- 화면 press.html: 왼쪽 「정부 발표 · 인터뷰마다 한 번」 칸(금색), 분류 뒤 칙령 후보 메모, 종료 때 공문서 모양 확인 카드(이득 ▲ 대가 ▼ 항의 ✉, 빠진 이득 줄긋기, 기간 1~3년, 대신하는 칙령 안내, 확정/칙령 없이 종료/돌아가기), 결과 화면에 칙령 줄, 대기 화면에 시행 중 칙령. 문구 모두 L/pick(한/영).
- 모드(4곳): common/opinion_modifiers/sllm_edict_opinion.txt(sllm_edict_protest_1~3, 매달 1·2·4 회복), localisation 영/한 sllm_edict_l_*.yml(BOM).
- 검사: tsc 통과, selftest PASS 2014 / FAIL 1(A-22 기존). 화면 한/영 헤드리스 확인. 실기 확인 필요: EDICTX 줄·has_ethic 광신 포함·관계 수정자 표시, 항의 서신, 수정자 기간.

## 2026-10-18 오후 정책 퀘스트 구현 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 사용자 확정: 설계서(docs/POLICY_QUEST_SPEC_KO.md)의 보완·추가 항목 전부 반영. 단 "공격 전쟁 금지(먼저 선전포고 안 하기)" 조건·공격측 판별은 빼기로 함 → 내부 '전쟁하지 않기'(is_at_war)만 남김.
- 앱 순수: src/policy.ts — 난이도 1/2/3 = 버프 +5/+10/+20% + 같은 폭 조건. 내부 조건 = 자원 월 수입·창고·수도 안정도·행성 수·해군 수용량·평화, 외부 = 대상 제국 우호/적대(관계 ±25/50/100)·연방·은하 공동체·협약·종속국 충성도. 예/아니오 조건은 쉬움에만. 늘려야 하는 조건은 첫 6개월 달성 기간, 2개월 유예 뒤 실패, 둘 다 실패 = 붕괴(같은 종류 1년 금지), 대상 소멸 시 자동 달성, 2년 완수 → 유산(1단계 1년) 또는 연장(90일 안에 안 고르면 유산).
- 앱: src/features/policy-app.ts — 세이브별 sllm_policy.json, 월간 판정(gamestate onPolicySnapshot 뒤), 측정 POLICYM/POLICYC/POLICYO(terminalRequest), 적용 POLICYAPPLY(cid 표시로 한 번만). AI = 선언문에 맞는 버프 3개 추천(정책당 요청할 때만). 선포 시 외부 정책 대상 제국 반응 편지(mail-app writeLetter)·연대기 한 줄. 언론 인터뷰 마지막 주제 '정부 발표' 호평 → 다음 불이익 1번 면제. 파벌 회의·인물 통신 프롬프트에 시행 중 정책 줄(withPolicyContext). log-router POLICY 슬롯, main 등록·세이브 바뀔 때 초기화, preload IPC 9개.
- 화면: 집무실 바탕화면 국정 묶음에 「정책」 아이콘(경고 수 배지) → ui/office-policy.js·css(별도 파일, office.html 은 아이콘·빈 칸·링크 3곳만). 내부/외부 두 칸(목표 상태·진행 막대·폐지·유산/연장), 새 정책 3단계(선언문 → 버프 2개+난이도·AI 추천 → 조건 확인·조건마다 다시 뽑기 1번 → 선포), 선언문 공문서 보기, 지난 정책·정책 유산. 문구 모두 L/pick(한/영), 고정 문구 카탈로그 '정책'.
- 모드(4곳): common/static_modifiers/sllm_policy_modifiers.txt(sllm_policy_broken_in 안정도 −5), common/opinion_modifiers/sllm_policy_opinion.txt(sllm_policy_broken_ex −50, 매달 4 회복), localisation 영/한 yml. 버프는 기존 sllm_buff_*_t1~3.
- 검사: tsc 통과, selftest PASS 1980 / FAIL 1(A-22 예시 이미지, 샌드박스에 없음 — 기존). 정책 블록 60여 개(조건 폭·뽑기·상태기계·명령 문자열·has_federation 사용·모드·IPC·화면·언어 팩 규칙). 화면 한/영 헤드리스 확인.
- 추가(13:0x, 사용자 확정): 정책 기간을 플레이어가 1·2·3년 중 고름(기본 2년, 최대 3년). 새 정책 1단계에서 고르고, 연장할 때도 1~3년 다시 고름. Policy.years(예전 세이브 = 2년), 버프 수정자 기간 = 년×360일(1080일 넘으면 명령 거부). selftest PASS 1986 / FAIL 1(A-22 기존).
- 실기 확인 필요: 측정 명령 한 번(POLICYM/C/O 로그 값), 선포 → 수정자 2개 붙는지, 목표 실패 불이익(안정도/관계), 유산, 인터뷰 '정부 발표' 주제.

## 2026-10-18 낮 사용자 결정: 당분간 알파 유지(다음 배포 = 0.1.0-alpha.7), 베타 1 조건

- 사용자 확정: "베타 1" 이름은 아직 쓰지 않는다. 알파 7 항목 대부분이 미빌드·게임 미검수이고, 정책 퀘스트 같은 큰 기능이 더 들어올 예정이라서.
- 베타 1 로 올리는 조건(다 채우면 버전을 0.2.0-beta.1 처럼 숫자까지 올려 구분):
  1. 큰 기능(집무실·청문회·종속국·언론·만찬·의회·연설·정책 등)을 실제 게임에서 처음부터 끝까지 한 번씩 확인
  2. 알려진 치명 버그 0(효과 이중 적용·세이브 혼선·앱 멈춤)
  3. 계획한 큰 기능(정책 퀘스트) 반영 후 기능 동결 선언
  4. 깨끗한 Windows 에서 설치·덮어쓰기·제거 확인
  5. 한/영·언어 팩 검사 통과, 테스터 제보 정리
- 다음 예정 기능(설계 확정, 10-18 오후 구현됨 — 위 「정책 퀘스트 구현」 참고): 집무실 정책 칸 = 정책 퀘스트. **상세 설계서: docs/POLICY_QUEST_SPEC_KO.md**(12:3x 작성, 사용자 확인 대기 — 조건 목록·불이익·유산·화면·모드 구조·확인 순서). 집무실을 고치는 다른 세션 작업이 한숨 돌린 뒤 시작.
  - 정책 = 내부 또는 외부 하나(동시에 내부 1 + 외부 1까지). 제목·내용은 플레이어가 자유롭게(롤플레이), 기간 1~3년(플레이어 선택, 기본 2년).
  - 목표 2개: 플레이어가 버프 목록(buff-catalog 99종)에서 버프 2개를 고름 — 내부 = 경제·연구·사회·건설·제국 운영·지도자·탐사, 외부 = 외교·첩보·함대·지상군(+교역 가치). AI 는 내용에 맞는 버프 3개 추천만(정책당 1회).
  - 목표마다 플레이어가 난이도 선택 → 버프 세기 = 기존 버프 단계 1·2·3 = +5/+10/+20%(숫자형 버프는 목록의 단계값). 그 난이도 안에서 조건이 무작위로 붙음, 목표마다 다시 뽑기 1회.
  - 조건 세기는 버프와 같은 퍼센트(사용자 확정): 자원 월 수입·창고는 시행 때 값보다 +5/+10/+20% 유지, 수도 안정도 +5/+10/+20, 특정 제국 관계 +25/+50/+100 이상(적대 정책은 −25/−50/−100 이하), 예/아니오 조건(공격 전쟁 금지·회원 유지 등)은 쉬움에만. 수입 조건은 첫 6개월 달성 기간 뒤부터 판정.
  - 내부 조건: 자원 월 수입·창고·수도 안정도·행성 수·함대 수용량 / 외부 조건: 특정 제국 우호·적대·공격 전쟁 금지·연방·협약·은하 공동체 회원·종속국 충성도. 판정은 모드가 매달, 확실한 트리거(창고·관계·전쟁·행성 수·안정도)부터 넣고 나머지는 게임 확인 후.
  - 목표끼리는 따로: 어기면 2개월 유예(경고·신문 기사) → 실패 시 그 목표의 버프만 꺼지고 불이익(내부 = 안정도 −, 외부 = 그 제국 관계 −, 1년). 둘 다 실패하면 정책 붕괴. 중도 폐지 = 실패와 같은 불이익. 2년 채우면 성공 기사 + 작은 잔여 보상 또는 연장.
  - 신문·라디오는 월간 자료에 정책 상태 한 줄(추가 AI 호출 없음). 언론사 인터뷰가 열려 있으면 '정부 발표'로 공식 발표(평가 좋으면 작은 보너스) — 선택.

## 2026-10-18 오전 집무실 4단계: 작별·추모관 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 사용자 확정: 추모관 = 명예의 전당, 세상을 떠난 인물만(전사·서거). 해임된 인물은 올리지 않고 「떠난 사람들」에 따로(행방 불명도 여기, 다시 나타나면 빠짐).
- 모드: events/sllm_people_events.txt 에 sllm_people.2(사망)·.3(해임) 숨은 이벤트, on_actions 에 on_leader_death·on_leader_fired(This=국가, From=지도자) → SLLM:LEADEROUT(lid·why·date·name). 번호 없는 지도자는 남기지 않음. 포로(on_leader_captured)는 이벤트 종류 미확인이라 쓰지 않고 「행방 불명」으로 처리.
- 앱: src/memorial.ts(순수: 전사 판정 = 같은 달·전 달 전투 기록, 작별 대상 = 신뢰 20↑ 또는 대화·편지 1회↑, 관계 깊은 순 한 달 3통, 동료 기억, 연대기 줄 '추모: …', 비문 프롬프트), src/features/memorial-app.ts(sllm_memorial.json, IPC memorialList·memorialSeen·memorialEpitaph·memorialSetEpitaph). 사망 순간 자료로 비석(재임·레벨·특성·함대/행성·전투·추앙·편지·대화·관계·기억 3줄) → 연대기 한 줄(신문 연감에 부고 재료, AI 호출 추가 없음) → 같은 평의회/같은 직책에서 이야기해 본 동료에게 기억 → 알림 카드(추모관). 매달 명단 뒤: 작별 편지 3통(letters-app.addFarewell), 이유 없이 빠진 인물 = 행방 불명.
- 작별 편지: letters.ts kind 'farewell'·final(death/fallen/fired). 사망 = 생전에 써 둔 편지를 부관이 전함(답장 없음), 해임 = 떠나며 쓴 편지(신뢰 낮으면 서운함, 답장 가능). 열 때 AI 한 번, 안 읽은 편지 상한에서 접지 않음.
- AI 사용: 작별 편지 본문(열 때), 비문(비석을 처음 볼 때, 직접 고쳐 새길 수 있음). 나머지 전부 앱.
- 화면: 집무실 추모관 = 명예의 전당(비석 카드, 새 비석 점, 오른쪽 비문·남긴 일·특성·기억) / 떠난 사람들(해임·행방 불명). 바탕화면 추모관 아이콘 숫자. 서신함의 작별 편지 ✦ 표시. 알림 카드 대상은 office.toastGo(서신/추모관). 영어 키 추가.
- 검사: tsc 통과, selftest PASS 1866 / FAIL 2(기존 종속국 모드 문구). payload selftest 는 QA 세션 변경(war_sq·pop_amount) 위에 합쳐 넣음. 실기 확인 필요: on_leader_death 의 From 에서 sllm_lid 를 읽는지, 은퇴(paragon.590)도 사망으로 들어오는지, 비문·작별 편지 품질.

## 2026-10-18 오전 QA: 테스터 제보 — 총독 주민 0 · 평화도 패배로 묘사 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 제보 1 "행성 총독 주민이 0": 모드가 정확한 주민 수를 `num_pops` 로 읽었는데 4.x(인구 묶음) 에서는 0 이 나옴. 바닐라는 `trigger:pop_amount` 를 씀(common/script_values/00_script_values.txt).
  - 모드 sllm_probe_planets.txt: num_pops → pop_amount.
  - 앱 planets.ts popsOf: 정확한 수가 0 인데 단계 값이 1 이상이면 단계 값('N 이상')을 씀 → 모드 재업로드 전(옛 모드)에도 0 으로 안 보임.
- 제보 2 "평화도 늘 패배로 묘사": 게임의 on_war_ended 는 현상 유지(백지평화) 때도 불리고 한쪽을 '패자'로 넘김. 앱이 그걸 그대로 "패자 X, 주 승자 Y"(라디오) / "A가 B와의 전쟁에서 이겼다"(신문·편지) 로 씀.
  - radio.ts war_end·mail.ts war_end: 승패를 단정하지 않는 문구로(승리·패배는 on_war_won/lost 의 war_won·war_lost 가 따로 알려 줌).
  - 새 사건 war_sq(현상 유지 강화): 모드 on_status_quo·on_status_quo_forced → sllm_mail.21 이 NEWS(모든 제국)·EVT(플레이어 낀 전쟁) 줄을 씀. 라디오·신문·편지 문구 추가, MAJOR_WORLD·EXTRA_KINDS 에 넣음.
  - 바닐라 4.5.2 대조(같은 날): action.39('Status Quo Peace with [From.GetName]')가 이 on_action 의 country_event 이고 상대를 From 으로 씀 → Root/From 두 나라로 확정(fromfrom 체인·전쟁 이름은 뺌). 현상 유지 땐 on_war_won/lost(action.37/38)는 안 불리고 on_war_ended 만 불림 → war_end 중립 문구가 맞음. 양쪽에서 한 번씩 불려도 앱이 이름을 정렬해 한 사건으로 합침.
  - pop_amount: 바닐라 4.5.2 에 num_pops 트리거 사용처가 하나도 없고 행성 주민은 전부 pop_amount(trigger:pop_amount 값으로도 씀) → export 가능한 값 트리거로 확인.
- 모드 반영: payload tester-mod · 문서\mod\sllm_missive(업로드 원본) · sllm_missive_tester. 실행 앱 쪽은 bat 동기화 몫. 창작마당 재업로드 필요(앱 쪽 0 방지·문구 수정은 옛 모드에서도 동작).
- 검사: tsc 통과. selftest 새 시험 7개 통과, 실패 9개는 모두 다른 세션 진행 중인 집무실·편지 파일(office.html 등)이 내 격리 복사본에 없어서(내 수정과 무관).

## 2026-10-18 오전 집무실 3단계: 개인 서신 — 인물이 먼저 보내는 편지 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 사용자 확정(LLM 아끼기): 계기 감지·봉투·한도·부탁 고르기는 앱이(AI 없음), AI 는 봉투를 열 때 본문 1번 + 직접 답장 1번. 사건이 생겨도 바로 보내지 않고 6개월 모았다가 그중 무작위(계기 가중치 레벨업·새 특성 3, 전투 2, 안부 1). 같은 인물은 게임 1년에 1통. 못 뽑힌 후보는 그 인물 기억 한 줄. 안 읽은 편지 5통 상한(넘치면 오래된 것부터 접고 기억으로). 빈도: 받지 않음/적게(6개월 1통, 기본)/보통(2통) — 서신 화면 위에서 고름(sllm_letters.json).
- 계기: 매달 명단과 비교 — 레벨업, 새 특성(sllm_·subclass_ 제외), 함대 사령부 전투 수 증가, 2년 이상 대화·편지 없음(뽑을 때). 새 on_action 없음.
- 부탁 35%: 휴가·동료 추천·고향 행성 지원(에너지 100). 들어주기 = 신뢰 +6 + 게임 특성 sllm_trait_letter_trusted 「지도자의 신임」(경험치 획득 +10%, 영구, 무작위 획득 없음), 거절 = 신뢰 −3. 콘솔 명령 favorCommand(LETTERAPPLY: applied/poor/duplicate/no_target), 보내기 전에 pending 기록·자동 재전송 없음.
- 앱: src/letters.ts(순수), src/features/letters-app.ts(IPC lettersList·letterOpen·letterFavor·letterReply·letterFreq·officeLetterBadge), persona-app 에 personaNote·personaLast 내보냄, people-app: LETTERAPPLY 응답 전달 + **LTRAIT 를 받지 않던 버그 수정**(2b 특성이 실제로 들어오지 않았음). office-app: 안 읽은 수 훅·openOffice('letters'). 알림 카드 kind 'office'(windows.ts·ctx.ts·toast.html) → 집무실 개인 서신. 오버레이 집무실 버튼 숫자(launcher.html badgeOffice).
- 모드: common/traits/sllm_letter_traits.txt, localisation 한/영 sllm_letters_l_*.yml(BOM), 특성 읽기 효과 재생성(바닐라 756 + SLLM 3 = 759). trait-names.ts OWN_TRAITS = SLLM 특성 한/영 이름.
- 화면: 집무실 개인 서신 = 왼쪽 봉투 목록(새 편지 점·부탁 있음), 오른쪽 편지(처음 열 때 「봉투를 여는 중…」), 부탁 상자(효과·비용·들어주기/거절), 직접 답장(한 번). 영어 키 추가.
- 검사: tsc 통과, selftest PASS 1812 / FAIL 2(기존 종속국 모드 문구). 실기 확인 필요: 6개월 뒤 첫 편지, add_trait 로 특성 붙는지, 에너지 차감·모자랄 때 poor, AI 편지 형식.

## 2026-10-18 오전 집무실 2단계-2b: 지도자 특성 → 성격 반영 (미빌드·게임 미검수, 모드 변경 있음)

- 사용자 요청: 인물마다 있는 특성을 읽어 성격에 반영.
- 모드: tools/gen-leader-traits.py 가 바닐라 common/traits 의 지도자 특성 756개로 common/scripted_effects/sllm_probe_leader_traits.txt 생성(has_trait 마다 SLLM:LTRAIT/;/lid/;/t, 직접 고치지 말 것). events/sllm_people_events.txt: 지도자마다 3개월에 한 번(sllm_tr_m 카운터, 처음은 즉시) tr=1 표시 후 특성 효과 호출. 모드가 더한 특성은 아직 안 읽음.
- 앱: people.ts 수집기가 LTRAIT 를 모으고(tr=1 인 달만), 읽지 않은 달은 지난 특성 유지. src/trait-names.ts = 게임 폴더 localisation/korean·english 에서 특성 이름·설명을 실행 중에만 읽음(복사 없음, 못 찾으면 키를 읽기 쉽게). office-app withTraitNames 로 연락처에 이름·"이름: 설명". persona.ts: 말투 프롬프트에 [특성]+설명을 성격의 뿌리로, 대화 프롬프트에 [당신의 특성], traitSig 로 특성이 처음 들어오거나 바뀌면 말투 한 줄을 다시 정함(기억·신뢰는 그대로).
- 화면: 연락처 상세 「특성」 줄, 통신 화면 말투 아래 특성. 영어 키 특성→Traits. index.html BULK_KINDS 에 LTRAIT(앱·payload 둘 다).
- 검사: tsc 통과, selftest PASS 1744 / FAIL 2(기존 종속국 모드 문구). 실기 확인 필요: has_trait 효과가 실제로 줄을 내는지, 756개 검사 부하(3개월 1회), 지역화 이름이 한국어로 잡히는지.

## 2026-10-18 오전 집무실 2단계-2: 인물 1:1 통신 + 기억 + 관계 (미빌드·실기 미검수)

- 사용자 확정: 연락처의 누구와도 「통신 열기」로 1:1 대화, 끝나면 AI 가 1~2줄 요약 → 그 인물 기억, 다음 통신에서 인물이 먼저 지난 이야기를 꺼냄, 처음 만날 때 말투·성격 한 줄 고정, 대화·사건으로 신뢰가 오르내림.
- 앱: src/persona.ts(순수: 말투·대화·요약 프롬프트, applyMove = AI 가 발언마다 -2~2 제안 → 앱이 발언당 ±2·한 대화 ±6 로 묶어 더함, 기억 최근 12개, 신뢰 단계 충성/신뢰/호의/보통/냉담/적대, syncHearing = 함대 사령부 청문회 횟수가 늘면 추앙 +8·질책 −8·기억, syncEvents = 기술 수준 오르면 +2씩·기억, 처음 본 값은 기준만), src/features/persona-app.ts(세이브별 sllm_persona.json, IPC personaInfo·personaOpen(처음이면 말투 정하고 인물이 먼저 인사)·personaSay·personaEnd(요약 기억), 진행 중 대화는 메모리, 같은 인물 동시 요청 막음, 오류 문구 키 가림·한/영 pick).
- 화면 office.html: 연락처 상세에 관계 막대·최근 기억, 「통신 열기」(총독은 행성 정보가 있는 기존 총독 창, 나머지는 집무실 안 통신). 통신 화면 = 왼쪽 대화(인물/나/시스템 말풍선), 아래 입력(Enter 보내기·Shift+Enter 줄바꿈·한글 조합 중 Enter 무시), 위 관계 막대와 변화 ▲▼, 오른쪽 말투와 성격·기억하는 일, 「대화 마치기」/돌아가기/Esc → 기억 정리 후 연락처. 한/영(카탈로그 열쇠 17개).
- 검사: tsc 통과, selftest PASS 1730 / FAIL 2(종속국 모드 문구 — 격리 복사본). 실기 확인 필요: 실제 AI 답 형식(JSON), 첫 인사에서 지난 이야기를 꺼내는지, 요약 기억 품질.

## 2026-10-18 오전 집무실 2단계-1: 내 지도자 명단 → 연락처 확장 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 사용자 확정 순서: 2단계 중 "내 지도자 전원 읽기"부터(다음: 인물 대화+기억 → 개인 편지 → 작별·추모관).
- 모드(라디오·다른 이벤트와 분리): common/on_actions/sllm_people_on_actions.txt(on_monthly_pulse_country → sllm_people.1), events/sllm_people_events.txt(플레이어만, every_owned_leader → SLLM:LEADER(lid·cls commander/official/scientist·lv has_skill 1~10·ruler is_ruler·council is_councilor·name) + 함대가 있으면 SLLM:LEADERAT(lid·fleet) → SLLM:LEADER_END(date)). 번호 sllm_lid 는 함대 사령부와 같은 번호(국가 변수 sllm_lid_next). 나이·특성은 아직 안 읽음(트리거·지역화 함수 확인 필요).
- 앱: src/people.ts(PeopleCollector·applyRoster(같은 번호로 이름 바뀜 잇기, 사라진 인물은 gone 날짜로 남김, 빈 명단은 반영 안 함)·contactRole), src/features/people-app.ts(로그 자리 PEOPLE 244, 세이브별 sllm_people.json, onPeopleChanged → 집무실 갱신). office.ts officePeople(…, roster): 명단이 있으면 통치자·총독(행성 목록의 총독 이름과 맞춤)·제독(함대)·장군(지상전 기록만)·과학자·지휘관·관료 전부, 명단에 없는 총독도 남김. 없으면 예전처럼 아는 인물만.
- 화면 office.html: 탭 모두/통치자/총독/제독/장군/과학자, 역할 이름 7가지, 오른쪽 기술 수준·평의회 위원·맡은 함대. 명단 오기 전 안내 한 줄. 한/영(카탈로그 열쇠, 기존 열쇠 덮어쓰지 않음). 개발자 로그에 매달 명단 줄은 쌓지 않음(index.html BULK_KINDS, 실행 앱·payload 각각 반영).
- 검사: tsc 통과, selftest PASS 1679 / FAIL 2(종속국 모드 문구 — 격리 복사본에 파일 없음). 게임 미검수: has_skill·is_councilor·leader_class·exists = fleet 가 지도자 범위에서 되는지, 한 달 뒤 명단이 오는지.

## 2026-10-18 오전 집무실 1단계 (최신, 미빌드)

- 사용자 확정 방향: 개별 인물에게 애정이 생기게(2 기억 이어짐·3 인물이 먼저 편지·4 은퇴/사망 추모) + 그 입구로 오버레이 「집무실」 = 통치자 집무실의 홀로그램 PC 바탕화면. 1단계는 창·바탕화면·기존 창 연결·연락처(아는 인물만).
- 화면 ui/office.html: 나무 벽 집무실·창 너머 별·책상 투사기 빛 위에 뜬 홀로그램 화면(켤 때 한 번 빛이 퍼지고 위에서 아래로 그려짐, 움직임 줄이기 존중). 바탕화면 아이콘 두 묶음 — 제국 안의 사람들(연락처·개인 서신·추모관) / 국정(행성 총독·함대 사령부·종속국 채널·언론사 인터뷰·연설·은하 뉴스). 오른쪽 "우리 제국 최근 소식"(연대기 최근 6줄). 머리줄 제국 이름·게임 날짜·평시/은하 위기(위기면 홀로그램 붉게). 테마 색 따라감.
- 연락처: 총독(행성 목록의 이름 있는 총독, 수도 먼저) + 함대 사령부가 기억하는 지휘관(우주전 = 제독, 지상전만 = 장군). 탭 모두/총독/제독/장군, 고르면 오른쪽에 정보와 "통신 열기"(총독 대화로) / "함대 사령부에서 보기". 행성 목록을 아직 안 읽었으면 "총독 명단 불러오기". 개인 서신·추모관은 빈 화면 안내만(2단계).
- 앱: src/office.ts(순수: officePeople·officeFeed·OFFICE_APPS), src/features/office-app.ts(창, IPC officeState·officeOpen(허용된 6개 창만)·officeClose·officePlanets, 집무실은 alwaysOnTop 한 단계 낮게 → 연 창이 위에 뜸). gov.ts refreshPlanets 내보냄. windows.ts launcherClick 'office'·테마·아이콘 줄 +43. launcher.html bOffice(단말기 다음). 바깥 아이콘은 그대로 둠(옮길지는 사용자 결정 대기).
- 언어 팩: 화면 문구는 모두 한국어 원문 열쇠 → 카탈로그(정적은 i18n-ui, 만든 문구는 SLLMI18n.t). 기존 열쇠를 덮어쓰지 않게 이미 있는 열쇠(총독·제독·장군·수도 등)는 새 묶음에서 뺌. 위기 이름 고르기만 i18n-data 표시.
- 검사: tsc 통과, selftest 집무실 블록 포함 통과. 전체 PASS 1632 / FAIL 2(모드 문구 english/korean — 다른 세션의 종속국 모드 현지화 파일이 이 격리 복사본에 없어서, 실제 폴더에서는 해당 없음 예상).
- 다음(2단계): 모드에 내 지도자 전원 읽기(통치자·과학자·장군 포함) → 연락처 확장, 인물별 대화 자동 요약 기억, 레벨업·특성·부상·전투 뒤 개인 편지(서신함), 은퇴·사망 작별 편지와 열전(추모관).
- 같은 날 추가(사용자: 집무실에서 연 창이 따로 뜨면 짜침): 집무실 아이콘으로 연 창(총독·함대·종속국·인터뷰·연설·신문)은 홀로그램 본문 자리(#body, office.html 이 officeRect 로 알림)에 꼭 맞춰 붙는다. 기능 창 html 은 그대로, 앱이 자리·크기(최소/최대 크기 풀고)를 맞추고 insertCSS 로 주사선·홀로그램 테두리·창 끌기 막기만 덧입힘(배경·장면 그림은 그대로). 홀로그램 머리줄에 「‹ 바탕화면」+앱 이름, 붙은 창을 닫거나 돌아가기/Esc → 바탕화면. 한 번에 하나, 집무실을 옮기면 따라 움직이고 집무실을 닫으면 같이 닫힘. 홀로그램 기울기는 붙은 창과 어긋나지 않게 없앰. 바깥 아이콘으로 연 창은 예전처럼 따로 뜸.
- 같은 날 추가(사용자: 붙은 창도 바탕화면처럼 반투명 홀로그램, 글자는 흐리지 말 것): 집무실에서 새로 여는 창은 투명 창(glassWin: transparent + #00000000)으로 만든다 — openGov/Fleet/Vassal/Press/Speech/Paper 에 glass 인자(기본 false, 바깥 아이콘은 예전 그대로). 붙일 때 OFFICE_GLASS(테마 --bg·--panel·--shade 만 반투명, html 유리 그라데이션) 덧입힘 → 배경만 비치고 글자·선은 선명. 신문은 종이를 비우고 #scroll·#dock 글자만 밝게 뒤집음(그림은 원래 색). 창 전체 setOpacity 는 글자까지 흐려서 뺌. 이미 열려 있던 창은 닫았다 열면 진행 중 청문회 등이 끊기므로 불투명 그대로 붙임. 붙은 창 뒤 홀로그램 판도 유리처럼 비움(office.html), 창을 붙이면 화면을 투사기 위까지 늘림.

## 2026-10-18 오전 QA: 영어 화면에 남은 한글 정리 (최신, 미빌드)

- 발단: 창작마당 goldenfreddycl 제보(영어로 해도 한글이 남음). 라디오·신문 이름은 앞서 고침(radio.html·paper.html·카탈로그 진행자 9명 등).
- 이번 점검: ui 전체 html/js 의 한글 문자열을 실제 번역 순서(카탈로그 → 내장 패턴 → SLLMPatterns)로 돌려 보고, 헤드리스 크롬 영어 렌더로 재확인.
- 고친 것:
  - i18n-ui.js: 내장 패턴 `다음 방송까지 (.*)` 가 SLLMPatterns 보다 먼저 걸려 "Next broadcast 30초" 로 나오던 버그 → `(\d+)초` 로 좁힘(— 는 카탈로그).
  - index.html: 자동 번역 제외 칸(#nm·#sub·#curWho·#gossipBox·#log)의 빈 자리 안내("(상대 없음)", "연락처에서 통신할 제국을 선택하세요", "(대화 상대 없음)", "아직 엿들은 대화가 없습니다." 등)를 TX() 로 직접 번역, 언어 바꾸면 다시 그림. 로그의 알림·오류 줄(sys/warn)과 머리글(송신/수신/편지/나)도 번역(AI 대사·편지 본문은 그대로). 세이브·게임 폴더 안내 줄 조각 번역.
  - environment-ui.js: 환경 및 연결 점검 줄(○ 게임 사용자 폴더: 찾지 못함 …), 안내 hints, 확인 결과 note(' · ' 로 나눠 조각별) 번역, 언어 바꾸면 다시 그림.
  - i18n-catalog.js: 위 문구 + 환경 안내 5개·경로 오류 2개·만찬(요구받은 표본, 초청 지도자 제목 — 일반 '… · 발언' 패턴보다 먼저 unshift)·총독 기억 지우기·다른 시간선·애드온 없음 안내·권장 규격 추가. 모두 한국어 열쇠라 언어 팩도 번역 가능.
  - src/radio.ts: radioNameNote — 한국어가 아닌 언어로 대본을 쓸 때 진행자·방송사·신문사 이름을 영어 표기(Harven·Iren·Sola 등, 화면 카탈로그와 같음)로 쓰라고 프롬프트에 한 줄. 사용자가 바꾼 방송사 이름은 건드리지 않음.
- 남은 것(의도적으로 둠): 개발자 도구 탭 일부, 메인 프로세스가 보내는 오류 원문(경로 선택 창 제목 등), AI 가 쓴 본문.
- 검사: tsc 통과, selftest PASS 1591 / FAIL 0 (격리 복사본, electron 대체 모듈). 버전·dist·설치기는 설치기_만들기.bat 담당이라 손대지 않음.

## 2026-10-18 새벽 알파 7: 시험용 중국어(간체) 언어 팩 + 코드 안 한/영 쌍 번역 (최신, 미빌드)

- 시험용 팩: 앱 데이터 addons\zh_CN_test(바로 켜짐, 자동 = 게임 언어가 l_simp_chinese 일 때만 고름 → 지금 한국어 게임에서는 화면 그대로). 사본 SLLM_Dev_20261016\language_packs\zh_CN_test. 기계 번역(문구 1,605 · 패턴 127), 원어민 검수 전.
- 발견: 카탈로그 밖 L('한국어','English') 쌍(창·메인 코드 약 220개 + 숫자 든 템플릿 약 60개)은 팩이 번역할 수 없어서 함대·종속국 창 대부분이 영어로 나왔음.
  - src/i18n-pairs.ts(새): extractPairs — L/TL/bi/ui/pick( '한', 'En' ) 글자 쌍 → strings, `${…}` 쌍 → ^…(.+?)…$ 패턴(영어 쪽 식이 한국어 쪽에 있을 때만, 같은 정규식 하나), ['한','En'] 배열 이름표 → strings.
  - '언어 팩 뼈대 만들기'가 배포된 ui·dist 파일을 훑어 이 쌍까지 strings.json·patterns.json 에 넣음.
  - pick(메인·창): 팩 표(한국어·영어 열쇠, 공백 정리) → 팩 패턴 → 영어.
- 검사: tsc 통과, selftest PASS 1589 / FAIL 1(예시 그림 폴더 환경). 헤드리스 크롬으로 중국어 종속국·심문실 화면 확인(제국 이름·서신 본문 외 전부 중국어).

## 2026-10-18 새벽 알파 7: 종속국 청원·종주국 요구 = 실제 이행 (최신, 미빌드·게임 미검수, 모드 변경 있음)

- 사용자 지적: 공문의 요구사항을 어떻게 이행하나? → 지금은 승인 = 공짜 충성도, 종주국 요구 = 기록만이었음. 사용자 확정: 1번(대가를 바로 치름), 함선 같은 건 빼고 자원 요구·연구 지원(연구 버프 우리 −5%, 상대 +5%, 1년).
- src/vassal.ts: 청원·요구 내용(ask)을 앱이 먼저 고름(pickAsk: 연구 지원 1/4, 자원 에너지·광물 150~400(25 단위)·식량 100~300·합금 50~150(10 단위)) → AI 는 그 사정을 서신으로만 씀(letterMessages 에 '이미 정해진 내용'). VMsg.ask 저장, request = 한국어 한 줄.
  - vassalApplyCommand(…, ask): 승인 = 자원이면 우리 창고 확인(부족 → status=short, 표식도 안 남김) 후 우리 −·종속국 +, 연구면 우리 sllm_research_aid_given·종속국 received 1년 + 충성도 수정자. 반려는 예전대로 충성도 −.
  - overlordApplyCommand(새): 종주국 요구 수락 = 자원을 종주국으로 / 연구 지원(우리 −5%, 종주국 +5%), 거절 = 종주국의 우리 관계 −60(sllm_overlord_defied, 매달 5 회복). 종주국 없으면 no_target.
- vassal-app.ts: 서신 쓸 때 pickAsk, 결재 시 ask 가 있으면 종주국 요구도 게임에 적용. 자원 부족이면 결재 대기로 되돌리고 오류 안내(한/영). decisionNote 로 결과 한 줄. ask 없는 옛 서신은 예전 동작 그대로.
- vassal.html: 청원/요구 칸에 내용(한/영), 결재란 옆에 수락·거절 시 실제 비용 안내, 결과 문구·규칙 안내 갱신.
- 모드: static_modifiers/sllm_vassal_modifiers.txt 에 sllm_research_aid_given(−0.05)/received(+0.05)(all_technology_research_speed), 새 파일 opinion_modifiers/sllm_vassal_opinion.txt(sllm_overlord_defied), 한/영 문구(BOM). payload·실행 앱 tester-mod·문서\mod\sllm_missive·sllm_missive_tester 네 곳에 반영(각 기존 파일에 덧붙임). 창작마당 재업로드 필요.
- 연결 규격은 올리지 않음(올리면 구버전 모드에서 모든 명령이 막힘). 구버전 모드면 연구 지원·거절 관계 −60 만 조용히 빠지고 자원 지원·충성도는 동작.
- 검사: tsc 통과, selftest PASS 1575 / FAIL 1(예시 그림 폴더 환경). 게임 미검수: has_resource·exists = overlord·overlord 범위 add_resource/add_opinion_modifier 실제 동작.

## 2026-10-18 새벽 알파 7: 종속국 통신 채널 = 외교 공문실 (최신, 미빌드·게임 미검수)

- 사용자 요청: 함대 사령부처럼 종속국 채널도 그것답게.
- ui/vassal-scenes.css(새 파일) + vassal.html(그리기만 바꿈, IPC·결정 흐름 그대로):
  - 머리: 상대 제국 깃발(게임 깃발 flagFor) · 관계 화살표(종주국 ▼ / 종속국 ▲) · 충성도 막대 · 우리 제국 깃발(vassalView 에 playerIdx 추가). 종주국 채널은 붉은 톤.
  - 서신 = 책상 위 종이 공문: 머리글(깃발·'종속국 정부 공문'/'종주국 정부 명령서'), 종류 도장(불만·감사·청원·치하·경고·요구), 문서 번호·날짜, 서명 줄.
  - 청원·요구 = 결재란: 승인/반려(종주국은 수락/거절) 칸을 눌러 결재 → 결정 뒤 그 칸에 원형 도장. 효과 안내는 결재란 옆.
  - 대화 = 전신문(수신 ← / 발신 →), 작성란 '발신 → 수신' 표시, 버튼 '통신 발송'. 왼쪽 채널 목록에 깃발.
- 검사: tsc 통과, selftest PASS 1551 / FAIL 1(예시 그림 폴더 환경). 헤드리스 크롬 1180×820·780×520 한/영 확인.

## 2026-10-18 새벽 알파 7: 함대 사령부 청문회 장면 (최신, 미빌드·게임 미검수)

- 사용자 요청: 청문회는 청문회답게, 대면은 대면답게. 함대 사령부 두 모드부터(종속국 채널은 다음).
- ui/fleet-scenes.css(새 파일) + fleet.html: 청문회 중에는 왼쪽 지휘관 목록을 숨기고 위에 장면.
  - 기자회견 = 브리핑실: 제국 문장·깃발, 연단(지휘관 이름) 뒤 지휘관 초상화, 마이크, 기자석 실루엣·카메라 플래시, 안건 패널(전투 n/3·승패), 최근 발언 말풍선, 생중계 표시, 끝나면 '속보' 띠.
  - 직접 대면 = 심문실: 위 조명 원뿔, 반투명 거울 앞 군사 감찰관, 책상 위 전투 서류철 3개(지금 건 펼침·좋음/나쁨 표시), 지휘관 명패, 심문 횟수, 끝나면 추앙/질책/무난 도장.
  - 대본도 모드별 모양(기자 마이크 표시·지휘관 답변 금색 줄 / 심문실 어두운 톤·감찰관 평가는 타자 메모). '장면 접기'(창별 저장, 저장 실패해도 동작). 움직임 줄이기 설정 존중.
- 초상화: fleetView 에 cls(플레이어 종족 계열) → class:<계열> 사용자 그림·변형(지휘관 이름 시드) → 기본 그림.
- 기능·IPC 변화 없음. 검사: tsc 통과, selftest PASS 1546 / FAIL 1(예시 그림 폴더 환경). 헤드리스 크롬으로 1100×720·860×560 한/영 화면 확인.

## 2026-10-18 새벽 알파 7: 애드온 언어 팩 구조 (최신, 미빌드·게임 미검수)

- 사용자 요청: 중국어 간체 등 다른 인터페이스 언어를 애드온으로 쉽게 추가할 수 있게(알파 6은 이미 배포됨).
- addon.json 에 "language" 항목: code(zh-CN 등, ko·en 금지)·name·gameLanguage(l_simp_chinese)·system(["zh"])·aiLanguage·strings(애드온 안 json 경로 또는 객체)·patterns(^…$ 정규식만). 4MB·2만 문구·패턴 1천 상한, 코드 실행 없음. src/addons.ts parseLanguage·loadLanguagePack·sanitizeStrings·sanitizePatterns, AddonRegistry.languagePacks()(위쪽 우선, 같은 코드 하나).
- 언어 판정(src/language.ts): Language = string, resolveLanguage(pref, system, game, packs) — 자동이면 게임 언어 l_korean→ko, 팩의 gameLanguage→팩, 그 밖→en, 모르면 시스템 언어(ko→팩→en). 고른 팩이 꺼지면 자동처럼. baseLanguage(팩→en), locFolderOf(모드 이름 번역 폴더).
- 메인(settings-ui.ts): selectedLanguage·activePack·selectedBase·uiText(팩 표: 한국어·영어 열쇠 → 팩 패턴 → 영어)·pick(ko,en)·aiLanguage(따로 정한 것 → 팩 aiLanguage)·locFolder. languageView 에 baseLanguage·languages·languagePack. 애드온 켜기·다시 읽기 → 모든 창 languageChanged(addons-app onAddonsChanged, 팩 캐시 3초).
- 한/영 고르기 L()(press·tts·fleet·vassal·crisis·media)을 pick 으로. mod-compat 은 번역 폴더 이름(simp_chinese 등)을 받음.
- 창(i18n-ui.js): language() 는 예전처럼 'ko'|'en'(팩이면 en), code()·pick() 추가, 팩 표 우선 → 영어 카탈로그. 언어 선택지에 켜진 팩 자동 추가. 창 9곳 L()/bi()/ui() 를 SLLMI18n.pick 으로.
- 라디오 음성(tts.js): 대본 글자로 zh·ja·ru 도 판단해 그 언어 목소리.
- 설정 → 애드온: "언어 팩 뼈대 만들기"(문서\SLLM_language_pack_template 에 addon.json·strings.json(1,400여 문구 한국어→영어)·patterns.json·안내 문서), 언어 칩. 안내 ui/LANGUAGE_PACK_KO/EN.md.
- 덤: selftest speech 'ready after 3 months' 가 /tmp 잔여 파일(같은 pid)로 가끔 실패 → 시작 전 지움.
- 검사: tsc 통과, selftest PASS 1540 / FAIL 1(예시 그림 폴더 환경). 창 번역 함수는 가짜 DOM 으로 따로 실행 확인(팩 → 영어 대신 → 한국어로 돌아가기).
- payload·실행 앱 반영(29개). 남은 일: 실제 중국어 팩으로 앱에서 확인, 알파 7 릴리스 노트에 넣기.

## 2026-10-18 아침 화면 언어 자동 = 게임 언어 (알파 6 배포본 포함)

- 사용자 요청: 스텔라리스를 영어로 쓰는 사람은 자동으로 영어 화면으로 시작.
- src/language.ts gameLanguageCode(settings.txt)·resolveLanguage: auto 이면 게임 언어 우선(l_korean→ko, 그 밖→en), 없으면 윈도우 언어. settings-ui.ts 가 userDir(또는 findUserDir)\settings.txt 를 5초 캐시로 읽음. index.html 선택지 '자동 (게임 언어)' + 영어 카탈로그.
- 검사: tsc 통과, selftest PASS 1512 / FAIL 1. 설치기(alpha.6) 생성 7분 전에 반영됨.

## 2026-10-18 새벽 알파 6 빌드 직전 단계 (최신, 설치기 미생성·게임 미검수)

- 사용자 지시: 다른 세션 최종본 기준으로 알파 6 전 단계까지 전부 진행(사용자 취침 중, 무인 진행). 되돌리기 어려운 것(설치기 빌드·창작마당 업로드)은 하지 않음.
- 전체 코드 리뷰(4개 영역 병렬) 결과 중 효과 중복·세이브 혼선·비용 문제를 수정: 만찬 장부 하나의 잠금(anyBusy), LOADED 때 수락 대기 제안·쌓인 호감 폐기 + 제안 epoch 검사, radioResetForSave(세이브 전환·로그 재시작), 라디오 가상 일상 방송은 게임 날짜가 바뀔 때만(지금 듣기 예외)·응답 대기 중 세이브 바뀌면 버림·타이머 겹침 방지, 인터뷰 자료 제국별 중복 제거·날짜 숫자 정렬, 함대 청문회 h0/done 가드·보내기 전 전투 기록 비움, 연설 sentFor{cur,epoch}, 의회 강제 결정 forceInFlight·forceUnknown, 만찬 초대 reply_ready 유지, KB 명령 실패 화면 알림, 설정 창 status/environment/images 수신·상태 줄 표시, 신문 publishing 집합·galnews 임시 파일 저장, 종속국 save() 실패 시 미전송, 연대기 batch/rev·syncRadioChron 건너뛰기·거울 중복(제국별 31일), 방송 기록 Set, 세이브 zip 경계·512MB 상한·실패 캐시 30초·폴더 탐색 1.5초, unescapePdx 한 번에, 총독 보고서 다른 세이브 목록 즉시 실패. 영어 문구 8줄 + 패턴 1개.
- 앞서 같은 밤: 연결 규격 상수 4/5 불일치 핫픽스(CONNECTION_PROTOCOL = MOD_PROTOCOL).
- 검사: 격리 빌드 tsc 통과, selftest PASS 1507 / FAIL 1(예시 그림 폴더 환경). 수정 diff 독립 리뷰 → 지적 6건 반영.
- 배포 준비(RELEASE_RULES 3·5): 버전 0.1.0-alpha.6(실행 앱·payload·문서\mod 두 폴더·setup.nsi), 문서 README_KO·ALPHA_SETUP_KO/EN·RELEASE_NOTES_KO/EN, 창작마당 폴더 dist/workshop_0.1.0-alpha.6(109개)+변경 글, 기록 RELEASE_ALPHA6_KO.md·ALPHA6_PLAN §0.
- 남은 일(사용자): 설치기_만들기.bat 실행 → 창작마당 업로드(문서\mod\sllm_missive) → 게임 검수. 구조 정리는 RELEASE_ALPHA6_KO.md 끝 목록(알파 6 이후).

## 2026-10-17 심야 은하 위기 특집 방송 (최신, 미빌드·게임 미검수)

- 사용자 확정: 종말 위기 동안 신문·라디오를 특별 편성으로, 특별한 테마와 함께.
- 모드(라디오 이벤트와 분리): common/on_actions/sllm_crisis_on_actions.txt(on_monthly_pulse_country → sllm_crisis.1), events/sllm_crisis_events.txt(플레이어만, 지금 은하에 있는 위기마다 SLLM:CRISIS kind=prethoryn/unbidden/contingency/cetana/khan → SLLM:CRISIS_END). 판정은 바닐라 국가 종류 swarm·extradimensional(_2,_3)·ai_empire·synth_queen/awakened_synth_queen·awakened_marauders. 게임 규칙 변경 없음, 연결 규격 그대로.
- 앱: src/crisis.ts(순수: 묶음 모으기·시작/종식 판정·라디오/신문 지시문·특별판 호 표시), src/features/crisis-app.ts(로그 자리 CRISIS 243, 세이브별 sllm_crisis.json, IPC crisisState, 모든 창에 'crisisState' 알림). 시작 때 세계 소식 연대기 + 알림 카드 + 다음 달 호외(noteExtra 'crisis'), 끝나면 연대기 + 호외.
- 라디오(radio-app.ts 3줄): 위기 동안 대본에 "긴급 특별 방송" 지시(첫 발언 특별 편성 알림, 재난 방송체, 농담 금지, 사실 지어내기 금지)를 system 으로 끼움. 새 사건이 없는 달에는 가상 일상 코너 대신 위기 특보. broadcast 에 crisis 표시.
- 신문(media.ts 4줄): 정기호·호외 프롬프트에 "위기 특별판" 지시, 위기 중 낸 호 번호를 기억 → 지면이 특별판 모양. media 가 setCrisisExtra(noteExtra) 로 호외 예약 함수를 넘김(가져오기 고리 방지).
- 테마: radio.html(CRLF 유지) body.crisis = 붉은 비상 색 + 윗줄 "⚠ 긴급 특별 방송" 경고 줄무늬 띠(위기 이름, 움직이는 사선) + 특별 방송 대본 칸 붉은 테두리. paper.html 특별판 호 = 검붉은 지면 + 제호 위 "⚠ 은하 위기 특별판 · SPECIAL EDITION" 경고 띠(위기 이름). 한/영.
- 같은 시간 다른 세션(연결 규격 5·파벌 안내)의 main.ts·selftest.ts·i18n-catalog.js 변경과 3-way 병합.
- 검사: tsc 통과, selftest PASS 1463 / FAIL 1(index.html 통신 로그 검사 — 다른 세션 몫, 앞 항목 참고). 게임 미검수: on_monthly_pulse_country 에서 any_country + is_country_type 판정, 위기 국가가 실제로 그 종류인지(특히 세타나·대칸), 호외 연 상한(extraMax)에 걸리면 특별판 호외가 안 나올 수 있음.
- 2026-10-18 수정(사용자 지적: 정기호·일반 호외는 특별판 지면이면 안 됨): 위기 특별판은 위기가 새로 나타난 달에 따로 한 장(media.publishCrisisSpecial, 호외 모양, 호외 연 상한과 별개)만 내고 그 호만 특별판 지면. 정기호·일반 호외는 위기 중이라도 프롬프트·지면 모두 평소대로. 호마다 위기 이름 저장(labels). 위기가 끝나면 일반 호외 예약은 그대로.

## 2026-10-17 밤 알파 6 결정 반영: 연결 규격 5·구버전 모드 경고·파벌 부족 안내 (미빌드·게임 미검수)

- 사용자 확정(ALPHA6_PLAN_KO.md §5): 연결 규격 4→5, 선물·희귀도별 호감·호외 연 1회는 현재 값 확정(추후 조정), 파벌 0개는 회의 거절+안내 한 줄, 첩보 수치는 미정 유지, 포트레이트 빈 계열은 채우지 않음.
- 모드: sllm_probe_connection.txt HELLO protocol=5 (payload·실행 앱 tester-mod·문서\mod\sllm_missive_tester·sllm_missive). 버전 문자열은 설치기 도구(-Bump)가 올림. 창작마당 구독 모드는 재업로드 필요.
- 앱: src/protocol.ts 에 MOD_PROTOCOL=5·modProtocolState·안내 문구. main.ts HELLO 처리에서 규격이 다르면(번호 없음 포함) 연결당 한 번 event 알림(모드가 낡음 / 앱이 낡음) + 진단 mod.protocol_mismatch. 연결은 막지 않음.
- 파벌: features/faction-app.ts 가 의제 칸이 비었는데 파벌이 2개 미만이면 상태(fac.few)를 기억, 회의 버튼은 "파벌이 없어 회의를 열 수 없습니다." / "파벌이 1개뿐이라…" 안내. index.html 버튼은 오류 문구를 영어로 변환(SLLMI18n.t), i18n-catalog 영어 7줄(기존 군집·기계 문구 포함).
- 검사: 새 블록 15개(규격 판정·메인 연결·모드 번호 일치·영어·파벌 안내)를 따로 돌려 통과, 변경 파일 tsc 오류 없음(기준선 TS7006 제외). 전체 npm test 는 다른 세션 모듈이 격리 빌드에 없어 못 돌림 → 설치기 도구 3단계에서 확인됨.
- 게임 확인 필요: 구버전 모드로 켰을 때 알림이 한 번만 뜨는지, 파벌 0개 제국에서 회의 버튼 안내.

## 2026-10-17 심야 라디오 음성으로 듣기(TTS) (미빌드·실기 미검수)

- 사용자 확정: 라디오 창에 작은 음성 버튼. 라디오 창 윗줄 「▶ 지금 듣기」 옆에 🔈/🔊 켬·끔 + 목소리 고르기(윈도우 음성 / AI 음성(라디오 필터)). 켜 두면 새 방송을 줄마다 읽고 지금 읽는 줄을 밝게 표시. 끄기·✕·창 닫기·목소리 바꾸기 때 즉시 멈춤. 켬/끔·목소리는 그 창 localStorage(try/catch)에만 기억(settings.ts 미변경).
- 윈도우 음성(기본, 무료·오프라인): speechSynthesis. 방송 글자로 한/영 판단, 화자(아나운서·아나운서 B·기자)마다 다른 목소리, 목소리가 하나뿐이면 높낮이·빠르기로 구분. Natural/Neural 이름 우선. 그 언어 목소리가 없으면 윈도우 설정 → 음성에서 추가하라고 안내. 괄호 지문·이모지·주소·강조 기호는 읽지 않음. (윈도우 음성은 소리를 가로챌 수 없어 라디오 필터 없음)
- AI 음성(선택): 개인 연결이 OpenAI 이고 키가 있을 때만 /audio/speech(gpt-4o-mini-tts, mp3, 화자별 nova/shimmer/onyx). 앱 본체가 불러 base64 로 넘기고 화면에서 WebAudio 로 라디오 필터(320~3300Hz 대역 + 약한 찌그러짐 + 작은 잡음). 읽는 동안 다음 줄을 미리 받음. 안 되면(Player2·다른 회사·키 없음·오류) 이유를 보여 주고 윈도우 음성으로 읽음. 오류 문구 API 키 가림.
- 파일: ui/tts.js(신규), ui/radio.html(CRLF 유지, 버튼·스크립트만 추가), src/tts.ts(순수), src/features/tts-app.ts(IPC ttsAiCheck·ttsAiSpeak), main.ts·preload.ts·i18n-catalog.js·selftest.ts. 라디오 방송 로직(radio.ts·radio-app.ts)은 건드리지 않음.
- 검사: tsc 통과, selftest PASS 1424 / FAIL 1(앞 항목의 다른 세션 통신 로그 검사 1건). 실기 확인 필요: 윈도우 한국어 음성(Heami 등) 품질, AI 음성 요금(줄마다 1회 호출).

## 2026-10-17 심야 함대 사령부 지상전 + 연대기 책 내보내기 (미빌드·게임 미검수)

- 지상전(사용자 확정 "장군 보고"): 함대 사령부가 지상군 지휘관(장군)도 같은 규칙(최근 3건·청문회·판정)으로 다룬다. sllm_fleet_on_actions.txt 에 on_planet_occupied → sllm_fleet.3(점령 승리: 행성 위 우리 부대 지휘관마다 BATTLEADM), on_army_killed_in_combat → sllm_fleet.4(우리 부대 괴멸: 패배) 추가. BATTLE 줄에 type=ground. 특성 추앙/질책에 army_modifier army_damage_mult ±0.05 추가(함선 ±5%와 같은 크기). 앱: fleet.ts Battle.type, 지상전 문장("○○ 행성 지상전 … 승리(점령)/패배(부대 괴멸)"), 창 문구 "지휘관".
- 연대기 책(사용자 확정): 연대기 칸 「📖 책으로 내보내기」 → 이 세이브·이 시간선(govMem split own)의 제국별 연대기 + 은하 뉴스를 해별 장(우리 제국의 기록 / 은하의 움직임 / 그 해의 신문)으로 엮어 PDF(숨은 창 printToPDF, A4) 또는 HTML 로 저장. 성간 라디오 전용 연대기(9990)는 겹쳐서 제외. 한/영(버튼 언어대로 책도 한/영). 파일: src/chronbook.ts(순수), src/features/chronbook-app.ts(IPC chronBookExport), main.ts·preload.ts·ui/index.html·i18n-catalog.js.
- index.html 은 다른 세션의 LOG_MAX/BULK_KINDS 변경분 위에 버튼만 얹어 병합. 그 변경 때문에 기존 검사 「통신 로그: 원본 게임 줄은 개발자 모드에서만」 1건이 실패함(정규식이 `if (devOn) log('[게임] '` 를 찾는데 지금은 `if (devOn) { if (!BULK_KINDS…` 형태) — 그 세션 몫이라 건드리지 않음.
- 검사: 격리 빌드 tsc 통과, selftest PASS 1406 / FAIL 1(위 1건). 게임 미검수: every_planet_army·부대 leader 범위, on_army_killed_in_combat 범위, PDF 한글 글꼴(Windows 기본 바탕/맑은 고딕으로 대체).

## 2026-10-17 밤 함대 사령부(제독 전투 기록·청문회) (미빌드·게임 미검수)

- 사용자 확정: 제독마다 최근 전투 3건만 연대기식으로 기억 → 청문회(기자회견: 전투마다 기자·제독 AI끼리 2번씩 총 4줄로 끝 / 직접 대면: 플레이어가 전투마다 3번 심문). 효과는 두 방식 같음. 좋음 3건 = 추앙(함대 무기 피해 +5% 1년 + 경험치 200), 2건 = 무난, 1건 이하 = 질책(함대 −5%, 감봉 leaders_upkeep_mult −25% 1년). 아이콘 "함대 사령부".
- 라디오 세션과 분리: 전용 on_actions(common/on_actions/sllm_fleet_on_actions.txt: on_space_battle_won/lost → sllm_fleet.1/2, on_monthly_pulse_country → sllm_fleet.10 만료), 전용 이벤트 events/sllm_fleet_events.txt(namespace sllm_fleet), 특성 common/traits/sllm_admiral_traits.txt(바닐라 00_admiral_traits fleet_modifier·00_generic_leader_traits leaders_upkeep_mult 와 같은 키, randomized = no), 현지화 sllm_fleet_l_*.yml. 라디오 파일·코드는 건드리지 않음.
- 로그: BATTLE(res·n·date·kind·fleet·enemy·efleet) → BATTLESYS(sys) → BATTLEADM(lid·adm). 제독 번호는 지도자 변수 sllm_lid(플레이어 sllm_lid_next). 괴물·해적(kind 1)은 기록 제외, 같은 날 같은 상대·결과는 한 건.
- 앱: src/fleet.ts, src/features/fleet-app.ts(로그 자리 FLEET 246 = 전투·ADMAPPLY·ADMEXPIRE, IPC fleetState/Hearing/PressNext/FaceSay/Judge/HearingClose/Close), ui/fleet.html(한/영). 청문회 결과 적용은 every_owned_leader + sllm_lid, add_trait(+add_experience), sllm_adm_m = 12(매달 감소 후 remove_trait). 보내기 전 기록·중복 방지·자동 재전송 없음. 청문회 뒤 그 제독 전투 기록은 비움(다음 청문회는 새 3건). 도중에 나가면 남은 전투는 나쁨.
- 반영: 실행 앱·payload/app, 문서 mod/sllm_missive_tester·sllm_missive. 라디오 세션의 selftest·radio 변경분과 병합.
- 검사: 격리 빌드 tsc 통과, selftest PASS 1389 / FAIL 0. 게임 미검수: on_space_battle_won/lost 범위(FromFrom 함대·leader·solar_system), 지도자 변수, add_trait/add_experience/remove_trait, 특성 아이콘(inline_script trait/icon).

## 2026-10-17 밤 라디오 후속 보도 (알파 6 항목 3, 미빌드·게임 미검수)

- 방송 한 번에 AI 호출은 그대로 1회. 프롬프트에 `[배경 — 이미 전한 지난 소식]` 구역만 추가(src/radio.ts `followUpBackground`: 이번 사건과 낱말이 겹치는, 이미 방송한 360일 이내 라디오 연대기 항목 최대 5개, 오래된 순). 요약 방송(recap)에는 넣지 않음. 시스템 지시: "앞서 전해 드린 …에 이어" 식으로 이어서 보도, 배경 자체를 다시 새 소식처럼 전하지 않음.
- 라디오 연대기 ⊇ 신문 연대기: `radioMirrorPlan`/`syncRadioChron`(src/features/chronicle-app.ts)이 제국별 연대기 최근 항목을 `성간라디오 전용 연대기`에 "<제국> 관련: …"으로 복사(uid `news|idx|id`, 360일 이내, 지도자 사망·중복 제외). 라디오가 비어 있을 때(radioTick)와 켤 때(setRadio) 실행.
- 자동 검사 14개 추가. 모드 변경 없음, 연결 규격 4 유지.
- 게임 확인 필요: 방송이 실제로 "앞서 전해 드린 …에 이어"로 이어지는지, 배경이 프롬프트를 너무 키우지 않는지.
- 파일: radio.ts, features/radio-app.ts, features/chronicle-app.ts, selftest.ts (실행 앱·payload 둘 다 반영).

## 2026-10-17 밤 종속국 통신 채널 (최신, 미빌드·게임 미검수)

- 사용자 확정: B안(별도 오버레이 아이콘 창), 종주국 채널도 같이(플레이어가 종속국일 때), 서신 계기 = 충성도 급변(±10) + 실시간 타이머(서신 간격 설정 aiEveryMin), 종속국 청원에 답하면 충성도 증감.
- 모드: 월간 상황(sllm_probe_scan)에 우리 종속국마다 SLLM:VASSAL(idx·이름·충성도) 추가(번호 없으면 sllm_probe_assign_idx). static_modifiers/sllm_vassal_modifiers.txt — sllm_vassal_grateful(monthly_loyalty +1)·sllm_vassal_resentful(−1), 바닐라 16_static_modifiers_overlord.txt 와 같은 키. 현지화 sllm_vassal_l_korean/english.yml. 연결 규격 4 유지.
- 앱: src/vassal.ts(채널·급변 계기·타이머 채널 고르기·서신 파싱·결정 명령), src/features/vassal-app.ts(로그 자리 VASSAL 251 = VASSALAPPLY 응답, gamestate-app 에서 onVassalSnapshot, 60초 점검 타이머, IPC vassalState/Read/Say/Decide/Close), ui/vassal.html(왼쪽 종주국·우리 종속국 목록·충성도 막대, 오른쪽 서신·청원 [들어준다/거절한다]·통신 입력, 한/영). 아이콘 줄에 왕관 아이콘(BASE_ICON 높이 324), 알림 종류 vassal.
- 규칙: 들어주면 그 종속국 충성도 매달 +1, 거절하면 −1(1년, 새 결정이 이전 것을 대신, cid 중복 방지, 보내기 전 기록·자동 재전송 없음). 종주국 요구·대화는 기록만(게임 수치 변화 없음). 처음 본 채널은 기록만, 관계가 끝나면 채널 닫힘 표시.
- 반영: 실행 앱·payload/app, 문서 mod/sllm_missive_tester·sllm_missive(scan·수정자·현지화).
- 검사: 격리 빌드 tsc 통과, selftest PASS 1334 / FAIL 0. 게임 미검수: every_subject·any_subject·has_loyalty(종속국 범위) 동작, monthly_loyalty 수정자 적용, VASSAL 줄 값.

## 2026-10-17 밤 언론사 인터뷰 시행령 + 행복도 버프 수치 수정 (최신, 미빌드·게임 미검수)

- 사용자 확정 흐름: 시행령 "언론사 인터뷰"(연설과 같은 틀: 비용 0, 준비 3개월, 쿨다운 180일) → 준비 완료 알림 → 기자가 연대기에서 주제 3개를 골라 옴 → 플레이어가 주제를 직접 골라 대화(발언 횟수 제한 없음) → [다음 주제로] 때 편집국 평가, 긍정이면 +3% → [인터뷰 종료] 때 합산(최대 +9%)을 행복도 버프 1년(360일)으로 게임에 적용. 벌점 없음. 새 인터뷰 결과는 이전 인터뷰 버프를 대신함(쌓이지 않음).
- 모드: common/edicts/sllm_press_edict.txt, common/scripted_effects/sllm_probe_press.txt(prepare → SLLM:PRESS phase=prep, apply → phase=applied/apply_failed), common/static_modifiers/sllm_press_modifiers.txt(sllm_press_happy_1~3 = pop_happiness 0.03/0.06/0.09), 현지화 sllm_press_l_korean/english.yml. 연결 규격 4 유지(새 명령만 추가).
- 앱: src/press.ts(순수 로직), src/features/press-app.ts(로그 자리 PRESS 259 — PRESS·MONTH 처리, IPC pressState/Begin/Pick/Say/Next/End/Close), ui/press.html(주제 카드·대화 기록·답변창·결과 화면, 한/영). 알림 종류 press, 트레이 메뉴 "언론사 인터뷰", 테마 연동. 끝나면 성간라디오 전용 연대기·라디오 대기열에 기록.
- 버프 라이브러리 수정: tools/gen-buffs.py 의 pop_happiness 가 정수(2·5·10·15·25 = +200%~+2500%)였던 것을 비율(0.02~0.25)로 고치고 다시 생성(static_modifiers·현지화·buff-catalog.ts).
- 반영: 실행 앱·payload/app, 문서 mod/sllm_missive_tester·sllm_missive(모드 파일 8개). 같은 시간 수집품 3단계 작업분(preload·selftest·i18n-catalog)과 3-way 병합.
- 검사: 격리 빌드 tsc 통과, selftest PASS 1308 / FAIL 0(신규 인터뷰 블록 포함). 게임 미검수: 시행령 표시·준비 로그, 국가 범위 add_modifier 의 pop_happiness 적용, 확인 줄(PRESS applied).

## 2026-10-17 밤 수집품 3단계: 지도자 역요구 (최신, 미빌드·게임 미검수)

- 사용자 결정: 지도자는 내가 가진 표본만 요구(만찬당 한 번은 내가 정함, 세 번째 발언부터 마지막 회차 전까지). 거절 시 상대가 물질주의(일반·광신)면 신뢰 -30, 그 밖에는 손해 없음. 수락 시 보상은 희귀도 한 단계 위(최고 등급 exceptional 은 호의 +1 더, 만찬 호의 상한 5 유지).
- 구현(앱만, 모드 변경 없음): `banquet-specimen.ts`(askedReward·askFromReply·specimenRefuseCommand, 거절은 콘솔 효과 `add_trust = { amount = -30 who = prev }`), `banquet-chat.ts`(request 칸·player_specimens·specimen_request 상태), `features/banquet-app.ts`(요구 기록·수락 보상·거절 처리·IPC banquetSpecRefuse), 화면 `#askCard`([주기]/[거절]) + 한/영.
- 같이 고친 것: `ui/banquet-chat.css` 에 `[hidden]{display:none!important}` — 선물·표본 카드가 숨김 상태에서도 보이던 문제.
- 검사: tsc 통과, selftest PASS 1257 / FAIL 3(예시 폴더 없는 환경 차이), 역요구 검사 27개 추가.
- 게임에서 확인할 것: ① 거절 시 물질주의 지도자의 신뢰가 실제로 30 떨어지는지(add_trust 문법·범위) ② '1년 지속'은 게임에 없는 개념이라 즉시 -30 으로 구현, 시간이 지나며 게임 규칙대로 회복 ③ 요구를 받고 [주기] → 확인 카드 → 보내기에서 보상이 한 단계 높게 표시되는지 ④ 대화 3~9번째 발언 사이에 지도자가 실제로 요구하는지.

## 2026-10-17 밤 알파 5.5 핫픽스 설치기 빌드 (최신)

- 계기: 테스터(냥발이) 제보 2건 — ① 외교 단말기에서 한 번 대화하면 입력칸 클릭 불가 ② 살아 있는 우리 제국 지도자(과학자·장군 등)가 죽었다는 신문.
- 원인 ①: ui/index.html 의 dialogEnded 가 선언되지 않아 첫 송신 뒤 finally 에서 ReferenceError → 입력칸·송신 버튼이 잠긴 채 남음. `let dialogEnded = false` 선언 + 새 통신마다 잠금 해제.
- 원인 ②: on_leader_death 는 은퇴에도 불림(바닐라 paragon.590). features/council.ts 가 leader_death 를 제국 연대기(신문 재료)에 넣었음 → 제외, 라디오 문구는 '지도자 이탈(사망·은퇴 미확인)', 이전 판에서 쌓인 '지도자 사망:' 줄은 신문 재료에서 걸러냄.
- 사용자 결정: 지금 개발 폴더 전체(알파 6 진행분 포함)로 0.1.0-alpha.5.5 배포판을 만든다.
- 결과: tsc 통과, selftest PASS 1233 / FAIL 0, 설치기 90,116,184 bytes, SHA256 8922572EB05516D2E9AF28D72497BC22B47E2F521902FF0CE86B7AF67DA70875. 상세 RELEASE_ALPHA55_KO.md.
- 남은 일: 실제 Windows 설치·게임 확인, 창작마당 폴더 만들기와 업로드(사용자), 개발 폴더 dist 재빌드.

## 2026-10-17 밤 알파 5.5 통합 (최신, 미빌드·게임 미검수)

- 버전 표기만 0.1.0-alpha.5.5 로 올림(package*.json·tester-mod/descriptor.mod·HELLO·installer/setup.nsi·문서·창작마당 업로드 원본 descriptor). 설치기·창작마당 폴더는 아직 안 만듦. 상세 RELEASE_ALPHA55_KO.md, 창작마당 글 창작마당_변경사항_0.1.0-alpha.5.5.txt.
- 합친 것: 자원 선물, 수집품·표본 선물, 포트레이트 라이브러리, DLL 경로 보정, 영어 누락 보완 + 다른 세션의 통신 입력칸 잠김 수정·지도자 사망 오보 수정(radio leader_death → '지도자 이탈', 신문 재료 제외). 다른 세션 변경이 payload 에만 있던 radio.ts·council.ts·media.ts 는 실행 앱에 맞춤.
- 총독 대화 주민 수 300 고정(제보): 모드 sllm_probe_log_one_planet 이 count_owned_pop_amount 단계(…300)만 보내 앱이 정확히 300 으로 표시했음 → 단계 400·500·750·1000 추가 + export_trigger_value_to_variable(num_pops)→PLANET 로그 pn= 추가. 앱: pn 있으면 정확값, 없으면 popsApprox('N 이상', 프롬프트에 숫자 지어내지 말라고 명시). 게임 안 확인 필요: num_pops 가 행성 UI 의 '인구'와 같은 값인지.
- 새로 찾아 고침: version-check 가 'alpha.5.1' 같은 3단 표기를 못 읽어(null) 앱·모드 버전 불일치 안내가 꺼져 있었음 → 하위 번호 지원, 테스트 추가.
- 모드 재업로드 필요: 표본 읽기(sllm_probe_archive)·관계 보정·현지화·버전.
- 남은 일: 실제 tsc 빌드·npm test, 게임 안 확인(자원·표본 전달, 호의, 관계 표시, 수집품 읽기), 설치기 빌드(RELEASE_RULES 3~5), 창작마당 업로드(사용자).

## 2026-10-17 밤 영어 인터페이스 누락 점검 (최신, 미빌드·게임 미검수)

- 규칙: 모든 작업은 한글/영어 인터페이스를 함께 만든다(AGENTS.md).
- 고침: `i18n-ui.js` 가 textarea·비밀번호 칸을 통째로 건너뛰어 placeholder/title 이 번역되지 않던 문제(내용은 계속 번역 안 함). 검증효과 창(effect-verifier)에 번역 스크립트가 아예 없던 문제.
- 카탈로그 +111, 패턴 +20: 의회 시연 국가명·대사, 검증효과 창 전체, 개발자 버튼, 첩보 결과(줄마다 번역), 총독 기억 제안/행성 못 찾음, "○○에게만", 편지 n통, 변형 n, 테마 적용, 배경·견본 버튼, 연설문 안내.
- 의회·정상회담 초상화 없을 때 의석 글자: 영어 모드는 영문 약자(M/H/R…).
- 런처 툴팁도 번역 후 전달. 남은 것: 개발자 전쟁 선택칸 기본값 "(목록 없음)"(data-i18n-skip 안), "한국어"(언어 이름이라 그대로).
- 확인: 영어 모드 전 화면 자동 점검(Playwright) 통과, selftest 1197/3(3건은 example 폴더 미반입 환경 문제).
- 다음: 수집품 2단계 — 만찬에서 표본 선물. 희귀도 보상 common +1 / rare +1·관계 소 / epic +2 / exceptional +2·관계 대, 만찬 호의 상한 5 유지, 표본 선물 호의는 자원 선물 호의와 따로 센다(사용자 확정).

## 2026-10-17 밤 만찬 자원 선물(알파 6) + DLL 경로 트러블슈팅 (최신, 미빌드·게임 미검수)

- 만찬 선물(사용자 확정 흐름): 대화 중 플레이어가 "광물 450 보내드리죠"라고 하면 AI 응답 JSON 의 gift {res, amount} 를 뽑아 확인 카드(자원·양 수정 가능). 카드가 뜨거나 숫자를 고치면 게임에 창고만 확인(mode=check), [보내기]를 눌러야 실제 전달. 🎁 선물 버튼으로 직접 열 수도 있음.
- 호의 규칙: 상대가 부족한(PROFILE ec 1~3) 자원을 100 이상 → 만찬당 1회 호의 +1(즉시 지급, 기록 키 banquet-gift:<방문>). 대화 끝 정산은 5 - 선물 호의(만찬당 총 5 유지). 100 미만·부족하지 않은 자원은 자원만 가고 감사 인사. 대화가 끝난 뒤 선물은 정산 호의가 5 미만일 때만 +1.
- 게임 명령: 모드 변경 없음(연결 규격 4 유지). 앱이 콘솔 효과를 만들어 보냄 — has_resource 확인 → add_resource 플레이어 −N / 상대 +N, sllm_gift_<cid> 로 중복 방지, SLLM:GIFT 로그(sent/short/duplicate/no_target). 보내기 전에 기록, 응답 불확실하면 자동 재전송 없음. 로그 자리 GIFT 255.
- AI 프롬프트에 상대 경제 사정(econLines)과 받은 선물 목록 추가. 선물 기록 sllm_banquet_gifts.json, 연대기 기록.
- 새 파일 src/banquet-gift.ts. 수정 banquet-chat·features/banquet-app·features/conversation-favors·app/log-router·preload·selftest·ui banquet.html/banquet-chat.js/banquet-chat.css/i18n-catalog(영어). 백업 새 폴더\SLLM-gift-backup-20261017.
- 트러블슈팅(OneDrive 세이브 사용자): 원인은 앱 폴더 game-install-path.txt 가 0바이트 → DLL 못 찾음. 사용자 측은 경로를 써 넣어 해결. 앱 수정: 파일이 비거나 틀려도 자동 탐색한 Steam 게임 폴더의 DLL 사용(bridge.dll_fallback 진단), 실패 문구에 확인한 경로 표시.
- 검사: 격리 빌드(전체 src·ui·tester-mod)에서 tsc 타입 검사 통과(electron 스텁), selftest PASS 1173 / FAIL 3(example 폴더 미포함 환경 차이). 신규 선물 31개·DLL 경로 6개·포트레이트 32개 포함. 실제 Electron·게임 미검수: has_resource/add_resource consumer_goods 키, 만찬 중 콘솔 명령 지연, 호의 지급.

## 2026-10-17 저녁 포트레이트 라이브러리 (최신, 미빌드·미검수)

- 게임 .mesh/.dds 를 블렌더 없이 직접 그려 만든 초상화 라이브러리 299종(WebP 565개, 56 portrait_groups 매핑). 사이오닉 13·바이오제네시스 12 포함. 빠진 것: 로봇 일부(sd_*), mindwarden·shroudwalker·salvager 등 특수.
- 전달: 앱 폴더 `portrait-library.pak`(6.5MB, SLPK1) 하나. 첫 실행에 앱 데이터 `portrait_library/` 로 풀림(.pak-stamp 로 중복 풀기 방지). 창작마당 모드 폴더를 쓰지 않으므로 모드 재업로드 불필요. SLLM_PORTRAIT_LIB 로 폴더 지정 가능.
- 대화 상대: 직접 올린 그림이 없으면 세이브 `leaders`(design.portrait 우선)·`species_db` 로 읽은 통치자 초상화·성별에 맞는 항목을 세이브+제국 번호 시드로 고정 선택(`autoPortrait`). 상태 문구 '라이브러리 자동 선택'.
- 은하 의회 의원(사용자 규칙): 옷 통일(총독→통치자), 성별은 남녀 가중치로 섞음, 의석마다 시드 랜덤. 외계인 혐오(보통·광적) 제국은 의석 계열과 상관없이 통치자의 모델(남/여 쌍)만. 통치자를 모르면 제국당 한 모델. 사용자가 올린 delegate/class 그림이 있으면 기존 변형(SLLMVariant) 방식 그대로.
- 설정 > 그림 '포트레이트 라이브러리': 계열·옷 필터, 적용 대상 제국/종족/계열/의원/플레이어 통치자. 영어 문구 포함.
- 새 파일 src/portraitlib.ts, src/features/portrait-lib-app.ts, ui/delegate-pick.js, portrait-library.pak. 수정 main·preload·savereader(parseRulers, rulerByIdx)·flags(rulerFor)·features/council(xeno·rulerItem)·features/images(applyImageFile export)·ui index/council/i18n-catalog·selftest(+32). 설치기 빌드 때 uninstall-files.nsh 재생성 필요.
- 반영: 실행 앱·payload 양쪽. 백업 새 폴더\SLLM-portraitlib-backup-20261017. 검사: 격리 환경에서 신규 32개 통과(순수 모듈), tsc·npm test 전체·Electron 실행은 미실행(사용자 확인 대기).
- 알파 6 준비 정리: ALPHA6_PLAN_KO.md.

## 2026-10-17 알파 5.1 긴급 배포 (최신)

- 경로 진단·경제 사정 대화·신문 3기사/논평 통합·호외·영어 UI 보완·버프 정의 기반을 포함한 현재 소스로 통합 설치기 생성.
- 버전 0.1.0-alpha.5.1, Electron 포함. 상세 RELEASE_ALPHA51_KO.md 및 payload/app/RELEASE_NOTES_KO.md.
- 중복 업로드 로컬 등록 때문에 구독 모드가 누락되는 원인을 실제 확인. 비활성화 유지. 로컬 업로드 등록을 자동 재생성하지 않음.
- 설치기 83614825 bytes, SHA256 312F23F300156B58D1EBC128E92D11F455A2A5CC37D0CE70F9CF9830B83F6455.
- 빌드 통과, 검사 1102/4(기존 경로 환경 차이). 신규 게임 효과는 미검수. 이전 알파6 후보 문서의 호외 미구현 표시는 이번 코드 상태로 대체.
# SLLM 최신 작업 기준과 남은 과제

## 2026-10-17 신문·라디오 자동화/세분화 + 호외 (알파6 후보, 사용자 확정)

- 신문 기사 수: 한 호 항상 최대 3건 (구현·반영 완료: `MAX_ARTICLES = 3`, 프롬프트 "2~3건").
- 기자 논평은 별도 필드를 없애고 기사 본문 끝에 의견 한 문장으로 합침 (구현 완료. 공허 통신은 사실만). 기존 저장본의 논평 박스는 그대로 표시.
- 연속 보도(후속 보도)는 신문이 아니라 라디오가 맡는다. 라디오는 방송마다 AI 1회라 `recapFacts`/프롬프트에 맥락을 넣으면 추가 호출 없음. 라디오 연대기는 신문 연대기를 항상 포함.
- 신문 소재 확대: 이벤트 종류 추가, 수치 이벤트, `ec=` 경제 상태 기반 경제면 기사. 독자 관련성 필터.
- 호외(속보) 설계(미구현): 토글 기능. 기본 연 1회 제한, 설정칸에서 상한 증가 가능. 호외는 기사 한 줄(헤드라인 한 줄 + 내용 하나)만 AI가 쓰고, 나머지 지면은 AI 호출 없이 "~~~~" 같은 날려쓴 가짜 글씨(더미 텍스트)로 채운 신문 인터페이스. 읽지 않음 배지.
- 증권거래소(GSM) 뉴스 연동은 나중에 애드온.

## 2026-10-17 자원 부족 지원 선물 + 경제 사정 대화 (알파6, 사용자 규칙 확정)

- 지도자가 안부 질문에 부족한 자원을 말함(`ec=` 5자리 코드, 구현·반영 완료). 플레이어가 부족분을 만찬 이벤트로 지원하면 호의 +1 (고맙다고 말하며, 만찬당 1회). 이후 다른 자원 지원으로는 호의가 더 오르지 않음. 만찬당 호의 총합 상한은 5 유지.
- AI가 여러 요구를 동시에 말해도 호의 +1은 한 번만. 선물 이벤트 자체는 미구현.
- 다른 모드(증권거래소 등) 자동 인식은 이후 과제, 연계는 애드온.

## 2026-10-17 만찬 수집품(Grand Archive 표본) 선물·역요구 (알파6 후보, 사용자 확정)

- 근거(게임 스크립트 문서·바닐라 파일로 확인, 게임 안 시험은 아직): 표본 255종(`common/specimens/specimens.txt`, 분류 xeno_geology·aesthetic_wonder·historical_item, 희귀도 common·rare·epic·exceptional). 읽기 `acquired_specimen_count`, `has_specimen`, `every_exhibit`/`count_exhibit`(`is_exhibit_active`, `contains_specimen`, `is_specimen_category`, `is_specimen_rarity`). 쓰기 `give_specimen = { key origin }`, `remove_specimen`, `steal_specimens`. 검사 `can_give_specimen`(이미 준 표본·상대 빈 전시 슬롯 확인), `is_last_acquired_specimen*`.
- 1단계: `SLLM:ARCHIVE` 로그(보유 표본 키·분류·희귀도·전시 중 여부, 총 개수)를 모드에 추가하고 앱이 읽어 표시. 표본 한글 이름의 현지화 키를 먼저 확인.
- 2단계(선물): 만찬에서 보유 표본을 골라 상대 지도자에게 선물 → `can_give_specimen` 확인 → `give_specimen` 후 주는 쪽에서 제거(`remove_specimen` 사용법·중복 방지 확인) → 희귀도별 호감 보상.
- 3단계(역선택지): 만찬에서 지도자가 수집품을 요구하는 선택지. 요구 표본은 내 보유분에서 고르고, 수락·거절에 따라 호감·불만이 달라지게 한다. 강탈(`steal_specimens`)은 쓰지 않는다.
- 시험 필요: AI 제국·NPC에게도 give/remove가 동작하는지, 전시 슬롯 부족 때 동작, 같은 표본 재선물 차단, 효과 검증(effect-verification) 절차에 새 효과를 추가.
- 같은 날 완료: 경로 자동 보정(`normalize*Dir`, 힌트·지원 번들), SLLM 자체 버프 라이브러리(`tools/gen-buffs.py`, 99항목·630모디파이어, 연결은 아직 안 함). 설치기 재빌드·창작마당 재업로드는 사용자 확인 후.

## 2026-10-17 오전 알파5 마무리: 연방회의 정리·기계/군체·통신 화면 (최신)

- 연방 정상회담 안건은 '결속 다지기'와 '전쟁 선포 찬반' 둘뿐(법·회장·회원 내보내기 삭제, '높음/낮음'은 법 이름이었음). 전쟁 선포 투표 방식은 게임 declare_war_* 법(만장일치·다수결·회장)을 따르고, 통과 시 모드 sllm_probe_fed_war(회장이 declare_war, 결과 SLLM:FEDWAR)로 적용(개발자 검수용). 대상은 통신 가능한 일반 제국 중 회원이 아닌 곳.
- 흰 스크롤바: ui/scrollbar-dark.css(공용 어두운 스크롤바 + color-scheme dark)를 window-chrome.css 없는 6개 창(첩보·중재·만찬·만찬 초대·효과 검증기·런처)에 연결.
- 기계/군체 대응 1~4: ① 모드가 CONTACT·PROFILE·CONTACT_BEGIN에 gest(0 일반·1 기계 auth_machine_intelligence·2 군집 auth_hive_mind) 기록, 연락처에 '기계 지성/군집 의식' 표시. ② 군집·기계 플레이어는 내정(파벌) 회의 열기 거절(fac.gestalt). ③ 프롬프트에 전용 말투(gestaltLines) — 상대/플레이어 정체 모두 반영. ④ 만찬은 mode(machine=데이터 동기화, hive=의식 공유)로 창 이름·문구 변경. 대체 회의·호감 규칙 변경은 알파6 이후로 미룸.
- 통신 화면: 회색 '[게임]' 원본 로그는 개발자 모드에서만, 평소엔 '[통신]' 로그(호출·연결·회선 닫힘·상대 정보 수신). 상대(제국)마다 통신 기록 칸을 따로 둠(옮겨 가면 그 제국 기록만, 돌아오면 복원, 세이브가 바뀌면 비움). LLM 대화 기록도 상대별 보관(chat-history.ts, 최근 40명).
- 알파5 설치기·창작마당 폴더 재빌드: 설치기 83,496,821바이트(SHA256 7ed6f748…feffb7), 자동 검사 PASS 1063/FAIL 0. 미검수: 실제 Windows 설치, 게임 안 동작(연방 선전포고, 정체 판별, 기계·군체 말투).

## 2026-10-17 평화 중재·강제 평화·첩보 제재 게임 연결 (최신)

- 사용자 결정: 점령했고 점령국이 영유권을 가진 성계만 넘긴다. 영유권 밖 점령지는 종전 후 원래 주인에게 남는다.
- 모드 sllm_probe_mediation.txt(새): AI 끼리 전쟁 목록(MEDWAR), 점령·영유권 읽기(MEDSYS: 성계 고정 번호·궤도 기지/행성 점령·has_claim), 적용(MEDGIVE: 적용 순간 영유권·점령 재확인 후 행성·궤도 기지 set_owner) → 바닐라 end_war_effect 로 종전 + 양쪽 set_truce(war) → MEDAPPLY_END.
- 평화 중재: 개발자 패널 'AI 끼리 전쟁 목록 읽기' → 전쟁 선택 → 중재(정해진 대사/실제 AI). 협상 테이블의 영유권 항목 = 실제 영유권 안 점령지. 합의 후 '합의 게임 적용·기록'에서 백지평화(이전 없음)·현상 유지(전부)·절충안(고른 것) 적용. 보내기 전에 적용 표시(재전송 없음).
- 강제 평화: 대화에서 수락한 평화·개발자 '평화 강제'가 이제 현상 유지 규칙(영유권 안 점령지 이전 + 종전 + 휴전). 둘만의 전쟁 제한 유지. 예전 diplo KIND 2(휴전 없이 이탈) 경로는 대화에서 안 씀.
- 첩보: 실사용 수정자 sllm_spy_output_1~3(생산 −9/18/27%, 720일)·sllm_spy_opinion_1~3(관계 −100/200/300, 매달 줄어 약 2년). 기자회견 = 관계 −100, 대면 = 실패 수만큼 생산·관계. 심리 종료·중도 퇴장 때 자동 적용, 사건당 한 번. 개발자 '첩보 대응 — 대상 번호 제국'으로 실제 제국 상대 시험. 효과 검증 목록에 실사용 6종 추가.
- 해마다 중재 제안 알림(LLM 없음): 게임 해가 바뀌면 일반 제국(is_country_type = default, 양쪽 모두 이름 있는 연락처)끼리의 전쟁마다 확률 = 5% + 45%×공격국 피로도 + 45%×방어국 피로도(최대 90%)로 굴려, 걸린 것 중 가장 지친 전쟁 하나만 '평화 중재 제안 · A-B 전쟁' 알림 + [중재하기] → 실제 AI 중재 회담. 처음 본 세이브는 그해를 기록만(sllm_mediation_offer_years.json).
- 일반 통신 되돌림(사용자 결정): 10회 제한·호의 지급은 만찬 대화에만. 일반 통신(chat.ts)은 횟수 제한 없음·호의 없음(호감 변화는 기존대로).
- 한계: 바닐라에 첩보 '발각' 순간 훅이 없어 실제 게임 사건 자동 생성은 아직 없음(on_operation_finished/cancelled 기록만).
- 반영: 실행 앱·payload, 모드 4곳(새 폴더\tester-mod, 문서 sllm_missive_tester·sllm_missive, dist 창작마당). 검사 PASS 1033 / FAIL 0. 게임 안 동작 미검수(앱·게임 재시작 필요). 다음 설치기 빌드 때 새 모드 파일 5개가 제거 목록에 들어가는지 확인.

## 2026-10-17 파벌 회의 의제 = 실제 게임 의제 키 (최신)

- [임시] 의제 13개 → 실제 가치관 의제 8개로 교체: display_of_power(무력시위)·we_come_in_peace(평화의 사절, 유목 _nomads)·preserve_the_order(질서 수호)·give_and_take(타협의 미학)·open_arms(개방 정책, 유목 _nomads)·strong_on_our_own(국력 배양)·progressive_growth(진취적 성장)·a_higher_purpose(고차원적 목적). 가치관당 1개.
- 모드 스캔 COUNCILAG 줄에 eth(제국 가치관 비트, 유목 512) 추가. 제국이 그 가치관일 때만 set_council_agenda, 아니면 버프만(화면에 사유 표시).
- 반영: 실행 앱·payload(src/dist/ui/tester-mod), 새 폴더\tester-mod, 문서\mod\sllm_missive_tester·sllm_missive, dist 창작마당 폴더(sllm_probe_scan.txt). 검사 PASS 994 / FAIL 0.
- 미검수: 실제 게임에서 의제 설정 성공 여부, 의제 쿨다운(10800일) 중 스크립트 설정 가능 여부. 게임·앱 재시작 필요.

## 2026-10-16 alpha.4 배포판 (최신)

- 규칙: RELEASE_RULES_KO.md (Node.js 불필요·경로 alpha.3과 동일·새 규칙 금지). 기록: RELEASE_ALPHA4_KO.md.
- 설치기 dist/SLLM-Missive-Tester-Setup-0.1.0-alpha.4.exe (Electron 31.7.7 포함, 83MB). 창작마당 폴더 dist/workshop_0.1.0-alpha.4/sllm_missive, 문서\mod\sllm_missive 에도 반영(업로드는 사용자).
- 포함 수정: 소문은 게임 날짜가 바뀔 때만 생성, 소문·신문 응답 한도 상향(실사용에서 40% 가까이 잘려 버려짐). 의회 토론 문맥 누적은 사용자 보류.
- 검사 PASS 986 / FAIL 0, TypeScript 빌드 통과. 실제 Windows 설치·게임 안 동작은 미검수.

## 2026-10-16 집 PC 인게임 1차 플레이 기록 (최신)

- 상세 docs/INGAME_SESSION_20261016_KO.md. 2200~2201.01.01 일반 플레이(치트 survey·communications).
- **SLLM 미적용 상태였음**: dlc_load.json enabled_mods 비어 있음, game.log 에 SLLM 줄 0, 앱 미실행 → SLLM 기능 검수 0건. 로컬 모드 `mod/sllm_missive` 는 18:50 최신 tester-mod 로 교체(백업 새 폴더\SLLM-home-mod-backup-20261016-1850).
- 의미 있는 행동: 첫날 'The Chosen'(country 50) 선전포고 받음(fircon.3515, 정화 목표, 방어 중), 몰락 제국 접촉, 은하 공동체 결성 찬성(galcom.2 a), 공직자 고용·총독 배치, 라스타반 궤도 기지 건설.
- 평의회 의제: 무한한 기회(agenda_infinite_opportunities, 2201.01.01 진행 6580.8/7000) 완료 → **국력 배양(agenda_strong_on_our_own, 외계인 혐오 전용)** 채택. 실제 의제 폴더는 `common/council_agendas/`(88개). 가치관 의제 실제 키 확보 → 파벌 회의 [임시] 13개 교체 가능.
- 결정 필요: 의제가 비는 시간이 짧아 월간 수집만으로는 회의 알림 전에 플레이어가 고를 수 있음. 플레이어 제국 파벌 0개일 때 회의 처리.


## 2026-10-16 라디오·서신 디자인 최종 조정

- 성간 라디오는 기존 디자인으로 복원. 작은 오버레이의 폭·스크롤 조정만 유지.
- 지도자 초대 서신 입력란은 테마와 관계없이 맑은 고딕 계열로 표시.
- 앱 및 개발이동 payload에 적용, 예시 이미지 갱신. 새 설치 EXE/ZIP은 생성하지 않음.

## 2026-10-16 기능별 전용 화면 8종 정리 (최신)

- 총독실·홀로그램 집무실·은하 의회·정상회담·연설·신문·라디오·지도자 초대 서신을 각각 역할에 맞게 정리.
- 기본 설정·공통 테마·메인 단말기·런처 및 앞서 작업한 회의/중재/만찬/첩보 화면은 유지.
- 8개 화면 정상/작은 창 렌더링, 초상화·방송사 선택·대표 선택·메모·사용자 배경 유지 확인. 상세 docs/SPECIAL_ROOMS_RESULT_KO.md.
- 화면 변경만 반영, 실제 게임/API 미검수. 새 EXE/ZIP 없음. 예시는 새 폴더/기능별화면_예시.

## 2026-10-16 초상화 변형·애드온 실험 표시 (최신)

- 애드온: 탭 이름 '애드온 (실험)', 제목 옆 '실험 기능' 표시와 안내(테마 애드온은 '테마 적용' 시 사용자 지정 색으로만 들어가며 장면 창 고유 색·사용자 CSS는 덮어쓰지 못할 수 있음).
- 초상화 변형: class:<계열> / delegate:<계열> 에 기본 + #2~#8 변형. 설정 > 초상화의 계열·의원 칸마다 '+ 변형'(누르기·끌어놓기), 작은 썸네일로 바꾸기/✕ 지우기. 인물(시드)마다 같은 얼굴이 고정: 대화 상대=제국 이름, 의회 의석=제국+자리, 정상회담·중재·만찬·첩보=제국 이름, 파벌 대표=파벌 이름, 총독=총독 이름. 기본 그림이 없고 변형만 있으면 모드 기본 그림도 한 장으로 섞임. 플레이어 통치자(ruler:player)·연설 지도자(leader:)는 변형 없음. 애드온 그림 키에도 변형 사용 가능.
- 화면 도우미 ui/portrait-variants.js(새 파일, uninstall-files.nsh 에 추가)와 앱 src/images.ts pickVariant 가 같은 규칙(회귀 검사로 확인).
- Codex 회의실 디자인(faction-room.css·faction.html, 같은 날 17:06)을 덮어쓰지 않고 그 위에 변형 적용만 병합.
- 검사 PASS 983 / FAIL 0, TypeScript 빌드 성공, 설정 화면 캡처(새 폴더\초상화_변형_예시.png). 백업 새 폴더\SLLM-variants-backup-20261016-1715.

## 2026-10-16 내정·파벌 회의실 디자인 (최신)

- 대표 초상화·명패와 표결 표시를 긴 회의 테이블 주변에 배치. 통치자석은 왼쪽 끝.
- 파벌 수에 따라 테이블 확장·가로 스크롤, ID 기준 자리 배치. 발언자 위치 자동 이동, 제거된 파벌의 발언 대상 해제.
- 0/1/3/8/16/30 파벌 및 좁은 화면 검수. 기존 AI·표결·게임 효과 로직 유지.
- 상세 docs/FACTION_ROOM_RESULT_KO.md. 실제 게임 검수 및 새 설치 EXE/ZIP 생성은 하지 않음.

## 2026-10-16 애드온 (최신)

- 사용자 결정: 프롬프트 바꾸기는 다음 업데이트. 배포는 창작마당 모드 안 sllm/addon/addon.json 자동 인식 + 앱 데이터 addons 폴더 직접 넣기. 기존 호환 팩은 애드온의 한 종류로 흡수하되 기존 sllm/compatibility·사용자 호환 폴더도 계속 읽음.
- 형식 v1(example/addon/README_ADDON_KO.md, 예시 sllm_addon_example): id·name·theme.colors(5색)·images(그림 키→상대 경로, png/jpg/webp ≤8MB, 200개)·compatibility(호환 팩 v1 내용). 데이터만 읽고 코드 실행 없음, 애드온 밖 경로 거부. 압축(ZIP) 모드의 그림은 앱 데이터 addon_cache 에 풀어 사용.
- 설정 > 애드온 탭: 목록(출처·버전·제작자·내용 칩·경고), 사용 켜기/끄기, ▲▼ 순서, 테마 적용(사용자 지정 색으로), 폴더 열기, 다시 읽기. 위쪽 애드온 우선. 사용자가 직접 넣은 그림·색은 항상 애드온보다 우선(초상화 설정 칸에 애드온 그림은 '내가 바꾼 것'으로 표시하지 않음).
- 적용 순서(호환 해석): 내장 → 모드 안 호환 파일 → 애드온(아래→위) → 사용자 호환 폴더. 애드온 켜기/순서 변경 시 즉시 다시 읽음.
- 새 파일: src/addons.ts, src/features/addons-app.ts, example/addon/*. ModResources.fileIn 추가(모드별 같은 경로 구분). 설치기 uninstall-files.nsh 갱신 필요.
- 검사: 실제 임시 폴더로 dlc_load → 모드 애드온·직접 설치·깨진 매니페스트·순서·끄기·호환 해석 덮어쓰기까지 18개 추가. 전체 PASS 972 / FAIL 0, TypeScript 빌드 성공, 설정 화면 캡처(새 폴더\애드온_설정_예시.png). 게임 런처의 실제 모드 목록으로는 미검수.
- 백업: 새 폴더\SLLM-addons-backup-20261016-1730.

## 2026-10-16 플레이어 통치자 초상화·파벌 대표 종족 (최신)

- 설정 > 그림: '플레이어 통치자 초상화' 한 칸(ruler:player). 연설 무대, 내정 회의 통치자 자리, 연방 정상회담 플레이어 자리, 평화 중재 플레이어 자리, 지도자 만찬 주최 자리, 첩보 청문회·기자회견 발표자에 먼저 쓴다. 비우면 기존 연설 지도자(계열) → 계열 → 모드 기본 그림. 은하 의회 의석은 통치자가 아니라 의원이라 그대로 둠.
- 파벌 대표 종족: 회의 전체 의석을 플레이어 제국의 세이브 종족 비율(의회 A-09 와 같은 자료)로 큰 나머지 순 배분 후 세이브·날짜 고정 순서로 섞음(파벌별 개별 확률 아님). 외계인 혐오(보통·광적) → 최대 종족만, 외계인 친화 → 자리 수 안에서 모든 종족 최소 한 자리. 성향은 월간 수집 COUNCILAG 의 xph/xpb.
- 회의 화면 대표·통치자 자리에 실제 초상화(의원 → 계열 → 기본), 크기 64px.
- 검사 PASS 954 / FAIL 0, TypeScript 빌드 성공, 화면 캡처(새 폴더\내정회의_초상화_예시.png). 백업 새 폴더\SLLM-ruler-portrait-backup-20261016-1700.

## 2026-10-16 내정 회의: 테이블·발언 연출, 강제 통과 (최신)

- 화면: 반원 의석 → 회의 테이블. 통치자는 왼쪽 상석, 파벌 대표는 지지율 순으로 위·아래 줄. 위쪽 띠에 파벌 지지율 비율과 현재 표.
- 발언 연출: 말하는 대표의 테이블 등이 켜지고 초상이 빛나며 음성 막대가 움직이고, 말풍선에 글자가 흘러나온다. 통치자 발언 → 대표들 답변을 한 명씩 차례로 재생.
- 강제 통과: 통치자 찬성인데 반대 지지율이 찬성 이상이면 '강제 통과' 버튼(확인창에 제재 표시). 효과 2개는 그대로 걸리고, 발의 파벌을 뺀 모든 파벌 승인도 -15%(sllm_fac_forced), 제국 디버프 행성 안정도 -5·영향력 생산 -10%(sllm_fac_forced_unrest) 1년. 정상 통과는 이전처럼 반대한 파벌만 -5%. 연대기에 '강제 통과(다수 파벌 반발)'.
- 검사 PASS 942 / FAIL 0, TypeScript 빌드 성공, 화면 캡처(새 폴더\내정회의_테이블_예시.png). 게임 미검수.

## 2026-10-16 내정·파벌 회의 (최신)

- 사용자 설계: 평의회 의제(Council Agenda) 칸이 비면 '내정 회의 소집 — 회의에 참석하시겠습니까?' 알림(🏛 버튼·알림 버튼). 파벌 수만큼 의석(지지율 비례 반원). 파벌마다 가치관에 맞는 의제 1개 발의, 통과 시 효과 2개를 발의 파벌 풀에서 미리 랜덤으로 뽑아 카드에 표시(같은 세이브·날짜면 다시 열어도 동일).
- 통과 규칙: 의제 선택 → 모든 파벌 의견 청취(AI 토론, 개별 발언 가능) → 통치자 찬성 + 찬성 파벌 지지율 합 > 반대. 통과 시 효과 2개 1년(360일), 반대했다가 진 파벌 승인도 -5% 1년. 게임에서 의제를 직접 고르면 열린 회의 취소. 군집·기계 제국은 알림 없음.
- 버프 풀: 가치관 8종 × 5개(각 풀에 이 파벌 승인도 +10%·가치관 끌림 +15% 포함 — 지지율은 직접 더할 수 없어 승인도·끌림으로 간접 상승). 수정자 이름 4.5.1 확인. src/faction-meeting.ts REWARD_POOLS ↔ 모드 static_modifiers/sllm_probe_faction_modifiers.txt.
- 게임 연결: 월간 수집에 COUNCILAG(has_agenda_selected = no, 군집 여부)와 파벌 고정 번호(sllm_f_id) 추가. 적용은 scripted_effects/sllm_probe_faction.txt(begin/agenda/country/faction/end) 한 줄 → FACMEET ok 개수 확인, 예약 기록(sllm_faction_apply.json), 불확실 시 재전송 없음.
- 의제 키 미확인: 13개 의제는 [임시] 이름, key=null → 지금은 게임 의제를 설정하지 않고 버프만 건다. 집 PC의 Stellaris/common/agendas/ 파일로 실제 키·이름을 채우면 set_council_agenda 까지 연결된다.
- 개발자 시험: '내정 회의 시험(AI·게임 없음)', '내정 회의 시험 — 실제 AI'. 새 파일: src/faction-meeting.ts, src/features/faction-app.ts, ui/faction.html, 모드 faction 효과·수정자·현지화(한/영) 4개 → 설치기 uninstall-files.nsh 갱신 필요.
- 검사: 신규 28개, 전체 PASS 936 / FAIL 0, TypeScript 빌드 성공, 화면 캡처 확인(넓은 창/좁은 창). 게임 미검수: has_agenda_selected·set_council_agenda·파벌 범위 add_modifier·faction_approval 실제 효과, 변수 복사(prev.sllm_fid_next).
- 백업: 새 폴더\SLLM-faction-backup-20261016-1700.

## 2026-10-16 F-38 수정·게임 상황 수집 초석 (최신)

- 근거 자료: OldEnt/stellaris-triggers-modifiers-effects-list 의 4.5.1 script_documentation(트리거·효과·수정자·스코프). 게임은 4.5.2라 최종 확인은 error.log.
- F-38: 4.5.1 목록에 all_resource_output_mult 없음 확인. 민간격려를 country_{energy,minerals,food,alloys,consumer_goods}_produces_mult(사용자 선택 5종)로 교체, 등급 0.05/0.1/0.15 유지. 한국어 효과 설명·앱 문구 갱신. 모드의 다른 수정자·트리거·효과 이름은 4.5.1 목록과 모두 일치(스코프·동작은 게임 확인).
- 연설 상황(SPEECHCTX) 생산: 연설 준비 때 sllm_probe_speech_ctx 가 전쟁별 SPEECHWAR(우리 편·양측 피로도)와 원시값(영유권 성계 수, 전체/미탐사 성계, 자원 5종·연구 3종 월 수입, 행성 수)을 남김. 앱 src/gamestate.ts 가 단계값으로 변환해 기존 연설 보너스·군중 문장에 연결. 해방전 구분은 미구현(방어전이 하나라도 있으면 방어 명분).
- 월간 상황: 매월·불러오기 때 sllm_probe_state_scan → STATE_BEGIN/WAR/WARSIDE/FACTION/SPYNET/SUBJECT/STATE_END. 앱 StateCollector 가 묶어 보관(features/gamestate-app.ts, 로그 자리 248).
- 출신·첩보 이벤트: on_rebels_take_planet·on_country_released_in_war → ORIGIN 로그 + 반란국에 sllm_seceded_from 관계 깃발, 연대기 '세계 소식' 기록. on_operation_finished/cancelled → 플레이어 관련 SPYOP 로그(발각 판별은 후속).
- 값 대입(src/gamestate.ts TUNE, 게임에서 조정 예정): 영유권 1/5성계, 행성당 가중 산출 40/100, 행성당 연구 25/60, 전황 피로도 차 0.1/0.3, 전쟁 전망 차 0.15·붕괴 0.9, 중재 수락 성향 20+우리피로×60+(우리-상대)×40, 파벌 승인 0.4/0.7·주요 파벌 지지 25%, 가치관별 파벌 기본 요구.
- 화면 연결은 아직: 평화 중재·파벌 회의·첩보 화면은 실제 자료를 쓰지 않음(다음 단계). 연설 상황만 실제로 동작 경로가 이어짐.
- 신규 회귀 검사 40개. 전체 PASS 908 / FAIL 0, TypeScript 빌드 성공. 실행 앱·payload(src/dist/모드)·새 폴더 tester-mod 반영. 새 모드 파일 3개(scripted_effects/sllm_probe_scan.txt, events/sllm_probe_state_events.txt, on_actions/sllm_probe_state_on_actions.txt) → 설치기 재빌드 때 uninstall-files.nsh 갱신 필요. 연결 규격 4 유지, 새 EXE 없음. 게임 미검수.
- 게임 검수 항목: error.log 에 sllm_probe_scan/sllm_state 오류 없음, export_trigger_value_to_variable 로 has_monthly_income·support·faction_approval·has_spy_power·has_loyalty 값이 숫자로 나오는지, prev.변수 복사, espionage_operation_event 의 owner/From 범위, 월간 수집 성능.
- 백업: 새 폴더\SLLM-gamestate-backup-20261016-1620.

## 2026-10-16 사용자 결정 반영: 첩보 효과 기간·연설 학구적 방향 (최신)

- 첩보 대응 불이익 지속 기간을 2년(720일)으로 확정. `SPY_EFFECT_YEARS/DAYS` 상수로 정의하고, 기자회견 관계 하락과 직접 대면 논파 실패 불이익에 적용. 증거 3개 모두 논파하면 기간 없음. 실제 게임 적용은 여전히 보류.
- 결과 문구를 '기간 2년'으로 변경(한/영). 남은 미정: 안정도, 기자회견 관계 하락 수치.
- 연설 학구적: 미탐험 항성이 많을수록 유리 — 기존 코드 방향을 사용자 확정. SPEECHCTX 생산은 여전히 없음.
- 첩보 기간 회귀 검사 4개 추가. 전체 PASS 868 / FAIL 0, TypeScript 빌드 성공. 실행 앱·개발 payload(src/ui/dist) 반영. 모드/DLL·규격 4 변경 없음, 새 EXE 없음.
- 백업: 새 폴더\SLLM-spy-duration-backup-20261016-1540.

## 2026-10-16 기자회견 구도 수정 (최신)

- 기자석/카메라/1인칭 구도 제거. 단상 위 제국 대표와 마이크 6개의 3인칭 공식 발표 장면으로 교체.
- 실제 UI 캡처·화면 전환·초상화 표시 확인. 청문회와 판정 규칙 유지.
- 상세 docs/PRESS_ADDRESS_RESULT_KO.md. 게임 연계 보류 및 새 EXE 없음.

## 2026-10-16 첩보 청문회·기자회견 화면

- 법정 구도의 청문회: 중앙 재판소, 양쪽 제국 진술석, 현재 증거/남은 발언과 기존 심리 연결.
- 발표자 1인칭 기자회견: 연단·마이크·원고, 기자석·카메라, 국내외 반응 및 참고 메모.
- 실제 앱 화면 캡처와 초상화 2개/7개 로딩·선택 전환 확인. 화면만 변경, 게임 연계 보류 유지.
- 상세 docs/SPY_SCENES_RESULT_KO.md. 새 설치 EXE 없음.

## 2026-10-16 첩보 발각 대응 기반 (최신)

- 개발자 모드: 해명 요구 → 국내 기자회견 / 직접 대면 → 각색 증거 3개, 각 5회 발언, 별도 은하재판소 AI 판정.
- 증거 실패마다 산출량 -9%, 앱 호감도 -10, 게임 관계 -100 예정(최대 -27%/-30/-300). 실제 값 변경 보류.
- 기자회견 국민 불이익 면제, 모든 논파 성공 시 불이익 없음. 안정도/기간/기자회견 관계 수치 미정.
- 실제 발각 감지·서신/통신 연계·게임 효과·이어하기는 자료 확보 후 진행. 상세 docs/ESPIONAGE_RESULT_KO.md.
- 빌드 및 기존 전체 PASS 864/FAIL 0, 신규 규칙 46개·모의 실행 21개 통과. 게임/API 실사용 미검수. 규격 4 유지, 새 EXE 없음.

## 2026-10-16 별도 지도자 만찬장 (최신)

- 별도 만찬장 창: 식탁 양쪽 플레이어/손님 종족 초상화, 제국/지도자 이름, 초대의 말, 접대 방식과 날짜.
- 접대 등급별 촛불·장식 변경, 게임 접대 선택 확인 후 열기 및 예약에서 다시 열기 연결.
- 개발자 모드 ‘지도자 만찬장 시험’으로 게임 없이 화면 확인. 만찬 AI 대화는 다음 단계.
- 전체 PASS 863 / FAIL 0, 초대/접대 모의 실행 19개 통과. 실제 Electron 초상화 2개 표시와 화면 캡처 확인.
- 새 폴더 앱/개발 묶음 반영, 모드/DLL 및 연결 규격 4 유지. 실제 게임 검수는 남음.
- 상세 docs/BANQUET_RESULT_KO.md.

### 지도자 만찬 후속 — 심층 외교 결과 (사용자 지정 보류)

- [ ] 게임 설치 폴더를 확인할 수 있게 되면 만찬 중 심층 외교 협상과 그 결과의 실제 게임 적용을 구현한다.
- [ ] 게임의 외교·조약·관계 효과와 선행 조건을 조사하고, 지원 가능한 결과·수치·기간을 정한다. 구체적인 결과 종류와 수치는 아직 미정이다.
- [ ] 접대 방식, 상대 성향·현재 관계, 만찬 대화와 합의 내용이 외교 결과에 반영되도록 연결한다.
- [ ] 대화상 합의와 실제 게임 적용을 구분하고, 적용 확인 후 기록·후속 서신에 반영한다.
- 보류 해제 조건: Stellaris 게임 정의와 실제 실행을 확인할 수 있을 때. 이번에는 과제 기록만 갱신하며 외교 결과를 새로 구현하지 않는다.


## 2026-10-16 지도자 초대와 도착 이벤트 (최신)

- 외교 서신의 지도자 초대하기 → 편지 작성/발송 → 게임 시간 3~6개월 후 관계 기반 수락/거절 답장 → 수락 답장 후 6개월 방문 예약.
- 실제 모드 도착 이벤트 작성: 성대한 접대 1,000 에너지, 일반 접대 100 에너지, 굴욕적 접대 무료. 실제 게임 표시/자원 차감은 귀가 후 검수 대기.
- 첫 버전은 시간선마다 한 건씩 초대. API/저장 실패 예약 유지, 답장 중복 방지, 지도자 교체/전쟁/분기 변경 검사, 불확실한 도착 이벤트 자동 재전송 금지.
- 전체 PASS 862 / FAIL 0, 앱 모의 실행 19개 통과. 실제 API·게임 실행은 검수 전.
- 앱/모드 연결 규격 4, 둘 다 교체. 새 폴더 앱/개발/모드 반영. DLL 유지, 새 설치 EXE 없음.
- 상세 docs/DINNER_RESULT_KO.md. 만찬 대화·접대 관계 효과·후속 편지는 다음 확장.

## 2026-10-16 평화 중재 협상 테이블 (최신)

- ㄷ자 테이블, 중앙 플레이어와 양옆 교전국 종족 초상화, 중앙 요구사항 카드 구현.
- 영유권 주장/전쟁명분/전쟁 목표와 승리·현상 유지·패배 예상 결과 표시. 현재는 시험 자료이며 실제 게임 수집/계산은 후속 단계.
- 백지평화·현상 유지·성계/목표 선택 절충안, 변경 시 양측 동의 초기화 및 재협상 연결.
- 전체 PASS 831 / FAIL 0, 모의 실행 흐름 19개 통과. 실제 화면 렌더링과 초상화 로딩 확인.
- 바탕화면 ‘새 폴더’의 앱/개발 묶음에 반영. 모드/DLL·연결 규격 3 유지. 새 설치 EXE 없음.
- 상세 docs/MEDIATION_TABLE_RESULT_KO.md. 아래 백지평화 한 종류만 지원한다는 기록은 이 변경 이전 상태.

## 현재 작업 위치 (2026-10-16 이동 반영)

- 앞으로 바탕화면 결과물은 C:\Users\user\Desktop\새 폴더 안에 만든다.
- 실행 앱: C:\Users\user\Desktop\새 폴더\app\SLLM-Tester
- 개발 묶음: C:\Users\user\Desktop\새 폴더\SLLM_Dev_20261016
- 모드 확인 사본: C:\Users\user\Desktop\새 폴더\tester-mod
- 아래 과거 기록의 바탕화면 직속 경로는 이동 전 위치이다.

## 2026-10-16 평화 중재 기반 (최신)

- 가상 두 교전국의 초청 → 백지평화 협상 → 합의/초청 거절 → 로컬 기록 구현.
- 개발자 모드에서 AI 없는 시험과 실제 AI 시험 제공. 초청 수락과 종전 합의 구분, 역제안은 추가 협상 상태로 유지.
- 모든 기록은 시험용이며 실제 종전 미적용. 실제 전쟁 목록/게임 효과/실제 연대기는 연결하지 않음.
- 전체 PASS 821 / FAIL 0, 모의 실행 흐름 15개 통과. 실제 API·게임·화면 실사용 검수는 별도.
- 앱/모드 규격 3 유지, 모드/DLL 변경 없음. 상세 docs/MEDIATION_RESULT_KO.md.

## 2026-10-16 연방 정상회담 후속 구현 (최신)

- 실제 AI 토론, 전체/개별 발언, 의제 변경 시 입장 초기화, 전원 입장 확인과 서버 집계 연결.
- 외교 단말기 상단 🤝, 개발자 모드의 게임 없는 실제 AI 시험 추가.
- 법/회장/응집력/추방의 개발자 전용 적용 시험, 전후 재조회·중복 방지 저널·확인된 결과의 연대기 기록 구현.
- 일반 모드의 게임 변경은 잠금: 실제 법 해금·대기시간·바닐라 투표 규칙은 게임 정의/실행 검수 후 연결해야 함.
- 앱/모드 연결 규격 3. 둘 다 교체. 새 설치 EXE는 만들지 않음.
- 빌드 성공, 전체 PASS 793 / FAIL 0, 모의 실행 흐름 19개 통과. 실제 AI·게임 실행은 미검증.
- 상세: docs/SUMMIT_RESULT_KO.md. 아래의 정상회담 ‘화면/읽기만’ 기록은 이 변경 전 상태임.

갱신: 2026-10-16. 기준 자료는 사용자가 전달한 SLLM_개발이동_20261016.zip의 HANDOFF_KO.md, docs/CHECKLIST_KO.md, BUILD_AND_VALIDATION_KO.md 및 payload/app 소스다. 문서의 과거 팀별 지시나 미체크 항목을 새 실행 요청으로 취급하지 않는다. 이 문서는 앞으로 작업할 때 읽는 최신 요약이며 원본 체크리스트는 이력으로 보존한다.

## 최신 변경: 게임 없는 F 보완 묶음(2026-10-16)

- F-43: 외교 상대의 반대 방향 호감 조회에서 event_target 참조를 제거하고, 중첩된 국가 범위의 prev를 사용하도록 구현. 실제 게임 범위 검수 대기.
- F-39 연설/의회 후속: 로그 안 KEY/N 문자열 치환을 없앴다. 연설은 실제 has_modifier 조건에 맞는 고정 버프 키·숫자 변수·sid/req/n을 출력한다. 앱은 정확한 종류/등급·번호·세이브가 일치해야 완료 처리한다. 의회는 고유 요청 번호·세이브·응답 종류·모드·유효한 상태값을 확인한다. 모드 호환 이벤트의 PACK/EVENT/WHERE 문자열 치환은 별도 게임 확인이 남아 있다.
- F-46 일부: 게임 실행 변화·로그 초기화·세이브 변경/같은 세이브 재로드 전에 대기열에 들어간 명령은 취소. 실제 메인 메뉴 상태를 판별하는 부분은 여전히 미완성이다.
- F-35 일부: 커스텀 행성의 게임 종류 이름을 로그→표시→총독 프롬프트에 연결. GetClassName이 풀리지 않으면 기존 종류로 대체하고, 알 수 없는 행성은 중립 통신 배경 사용. 빈 수치를 0으로 오인하지 않음. 종류 getter 및 정확한 기후·인공행성 분류는 게임 자료/검수 대기.
- F-31: 예비 입력 경로의 중복 C#/PowerShell 코드를 공통 스크립트로 통합. 시작 실패에만 한 번 별도 프로세스를 사용하고, 키를 이미 보냈을 가능성이 있는 오류에는 재전송하지 않음. 가짜 프로세스로 검사, 실제 키 입력 검수 대기.
- F-29: 실행에서 참조하지 않는 옛 dist/src를 삭제 대신 백업 폴더로 이동.
- F-34 일부: 의회 IPC의 any 입력을 unknown/검증된 레코드와 DebateSpeaker로 변경. 프로젝트 전체 any 정리가 끝났다는 뜻은 아니다.
- 총독 행성 목록 동시 새로고침은 한 요청으로 합치고, 실패 시 응답 대기자와 타이머를 정리.

TypeScript 빌드·총독 UI 스크립트 구문 확인 성공. 전체 검사 PASS 753 / FAIL 0(이전 716개에서 37개 추가). 게임이나 실제 AI 호출 없이 확인했다. 앱·개발 payload·바탕화면 모드·정상 문서 경로 로컬 모드에 반영했다. 백업은 C:\Users\user\Desktop\SLLM-F-offline-backup-20261016-121853.

**앱/모드 연결 규격은 2로 변경됐다. 수정된 앱과 모드를 함께 사용해야 한다. 기존 설치 EXE, 원본 이동 ZIP, 창작마당 항목은 이번 코드 변경을 자동으로 포함하지 않는다. DLL 바이너리와 지원 게임 빌드는 그대로다.**

남은 우선 항목: F-38 실제 수정자 키 확보/교체, F-46 실제 게임 상태 판정, F-35 기후 분류, 호환 팩 문자열 치환 확인. F-37/F-42/F-41과 이번 모드 변경은 실제 게임 검수 대기. F-04 그림/사용자 결정 관련 항목 및 상세 문서가 없는 구 F 항목도 전체 완료로 간주하지 않는다.

## 최신 변경: F-41 수정 완료(2026-10-16)

로그 감시 시작 당시 EOF를 고정 경계로 삼아 기존 줄은 history 이벤트로 보내 요청 번호만 복구한다. 새 줄만 기능 분배기로 전달하므로 과거 연설·월별·불러오기·신문·총독 요청 신호가 기능을 재실행하지 않는다. 로그 초기화 때 연결 준비 상태도 비운다. 부분 줄·분할 UTF-8·2MB 초과 로그·감시 재시작·경로 변경·새 파일·파일 교체를 포함한 회귀 검사 15개를 추가했다.

수정 전 현재 PC 검사 PASS 701 / FAIL 0, 수정 후 PASS 716 / FAIL 0, TypeScript 빌드 성공. 바탕화면 실행 앱과 개발 묶음 payload/app의 소스·해당 dist에 함께 반영했다. 개발 묶음 안의 기존 설치 EXE와 최초 전달 ZIP은 이전 알파3 스냅샷으로, F-41을 포함하지 않는다. 설치기 재빌드는 아직 수행하지 않았다.

앱을 게임 도중 다시 켜도 과거 로그만으로 연결 준비 완료를 선언하지 않는다. 새 모드 신호를 기다리므로 일시정지 중이면 잠시 게임을 진행해야 할 수 있다. 실제 게임 재시작·세이브 재로드 검수는 남아 있다. 이미 과거 재생으로 바뀐 사용자 기록을 자동 삭제하거나 되돌리지는 않는다. 다음 우선 과제는 F-46 게임 상태 판정과 F-38 수정자 확인이다.

## 현재 작업 위치와 확인 결과

- 실제 수정·실행 앱: `C:\Users\user\Desktop\app\SLLM-Tester`
- 앱 모드 원본: 위 앱의 `tester-mod`
- 게임용 설치 모드: `C:\Users\user\Documents\Paradox Interactive\Stellaris\mod\sllm_missive_tester`
- 바탕화면 `C:\Users\user\Desktop\tester-mod`는 별도 확인용 복사본이다. 자동 동기화되지 않는다.
- 개발 이동 자료·설치기 소스: `C:\Users\user\Desktop\SLLM_Dev_20261016`
- 버전: 0.1.0-alpha.3. 이동 ZIP의 manifest 378개 항목 모두 해시 일치.
- 이동 ZIP의 앱 소스·UI·모드·native 파일은 현재 설치 앱과 모두 일치했다. 일부 dist 12개 파일만 달랐다. 현재 설치 앱은 동일 소스로 이미 빌드 성공한 상태다. 이동 자료의 오래된 dist를 설치 앱에 덮어쓰지 않았다.
- 이동 묶음의 설치 EXE는 이전에 받은 같은 버전 EXE와 별도 재포장본이다. 버전 이름만으로 바이너리 동일성을 판단하지 않는다. 이번 작업에서 새 EXE를 빌드하지 않았다.
- 이번에는 문서·소스 비교 및 전달 파일 무결성을 확인했다. 게임 플레이·AI 호출·selftest를 새로 실행하지 않았다.

## 집 PC 기록으로 확인된 진척

아래는 전달된 개발 기록의 결과이며, 현재 PC에서 다시 실험했다는 뜻은 아니다.

- DLL 경로로 게임 명령 전달, HELLO/LOADED/IDX/CONTACT 수신, 단말기 DIAL_END/TALK/PROFILE/ETHIC 동작 확인.
- 새 안건에서 알림 → 실제 의회 화면 → 토론까지 동작 확인(2214.10.21 안건).
- F-39 요청 번호 로그 문자열 수정 및 F-40 정상 문서 폴더 모드 등록 반영.
- F-44 신문 알림이 신문 창을 열도록 수정.
- F-45 요청 번호 문제는 req/last 최대값 학습을 확인하고 닫음. 완료된 수정으로 취급.
- A-16 실제 의회 강제 통과·취소 직전 서버 집계 재확인 연결, A-17 AI 행동 방침 반영, 앱 모듈 분리 1~7단계 완료 기록.
- 연설문 작성 창과 무대 옆 메모, 총독 홀로그램 보고, 화면별 배경 슬롯·견본, 가치관 테마, 신문 지면·서체 선택, 의회 국기·정보 카드·종족 구성 구현.
- 게임 DDS 초상화 잘라 쓰기는 사용자 결정으로 제거됨. 다시 구현할 미완료 항목으로 올리지 않는다.
- 설치·덮어쓰기·제거·한글 경로·선택형 로컬 모드·DLL 복원·추가 파일 보존 QA 완료 기록. 최초 체크리스트의 설치기 미검증 표시는 후속 인수인계 기록으로 갱신한다. 새 환경 실사용 확인은 별도다.
- 최신 포장 검증 기록은 PASS 697 / FAIL 4. 네 실패는 원본과 포장본에 공통으로 나타난 환경 가정 차이로 설명되어 있다. 앞선 PASS 699 기록을 최신 전부 통과 결과로 쓰지 않는다.

## 우선 처리할 과제

| 순서 | 항목 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- |
| 1 | F-46 DLL 호출과 게임 준비 상태 | 초기 로딩 차단 구현. 같은 실행에서 메인 메뉴로 복귀한 상태를 구별하지 못함. 코드의 sessionReady도 이 한계를 가짐 | 로딩·메인 메뉴·재로드·종료 중 명령 차단, 실제 게임에서 크래시 없이 재연결. 게임 파일과 실행 검증 필요 |
| 완료·게임 검수 대기 | F-41 옛 game.log 재생 | 과거 줄은 요청 번호만 복구하도록 분리. 앱 회귀 검사 통과 | 실제 게임에서 앱 재시작·세이브 재로드 후 연설/총독 상태 중복 변경이 없는지 확인 |
| 3 | F-38 연설 생산량 수정자 | 모드에 all_resource_output_mult 3개가 여전히 존재. 집 PC 4.5.2에서 오류 기록 | 해당 버전 modifiers.log/원본 정의에 근거해 교체하고 3등급 효과·기간·실제 수치 확인 |
| 4 | F-39 후속·F-43 문자열/대상 범위 | req 문자열 수정 완료. KEY/N/PACK 치환과 terminal_target 오류는 확인 남음 | 연설·의회·호환 이벤트 로그 필드가 정확하고 양방향 호감/대상 범위에 error.log 오류가 없음 |
| 5 | F-37 라디오 사건 | events + 숨은 이벤트 구조로 수정 완료, 게임 재시작 후 확인 기록 부족 | 실제 사건이 EVT→연대기→라디오로 연결되고 on_actions 문법 오류가 없음 |
| 6 | F-42 이미 진행 중인 의회 안건 | 불러오기·매월 resume 조회와 앱 처리 구현. is_voting_on_resolution = any 사용 | 이미 투표 중인 세이브를 로드해 안건 복구, 알림 중복 없음, 종료된 안건 제거. 신규 안건 토론 성공과 별개 검증 |

F-41의 앱 구현·회귀 검사는 완료됐다. F-46의 확실한 상태 판정과 F-38의 정확한 교체 키는 게임 파일/실행 자료가 필요하다. 한 번 SLLM 로그를 받았다는 사실만으로 이후 모든 DLL 호출이 안전하다고 판단하지 않는다.

## 기능별 남은 검수와 후속 개발

- 연설: 준비→완료 알림→진행→정확한 종류/등급의 modifier 적용까지 게임에서 끝까지 확인. SPEECHCTX 생산은 아직 없으므로 상황 보너스는 동작 완료로 표시하지 않는다. 보너스 방향은 미결정으로 유지.
- 총독: 행성 수치·스코프·결정·연간 보고 알림 확인. F-35 커스텀 행성 종류의 이름과 배경 폴백은 게임 자료를 바탕으로 보완.
- DLL: 재시작·세이브 변경·장시간 플레이·타임아웃·대상 변화와 게임 ACK 확인. 지원 범위는 검증된 Windows x64 Stellaris 4.5.2 실행 파일 한 빌드.
- 연방 A-01: 화면과 실제 데이터 읽기까지 구현. 연방 가입 세이브에서 FED/FEDMEMBER/FEDLAW 문법과 값 검증. 3단계 LLM 토론·4단계 게임 적용은 미완성.
- 초상화: 빠진 계열 그림 7종은 사용자 제공/제작 대기. 의회 종족 비율은 구현됐으므로 예전 '미구현' 표를 그대로 따르지 않는다.
- 언어: 한국어/영어 UI와 AI 응답 언어 설정 외에 프롬프트·전기 기본 언어가 응답 언어를 따르는지 점검.
- 호환성: SLLM 단독→UIOD→제국/깃발→가치관→대형 모드 순으로 실제 검수. 거대구조물은 단계별 이벤트를 추가하지 않고 완공 신호의 실제 의미를 확인. 기존 호환 팩 틀만으로 모든 모드 사건을 자동 이해한다고 설명하지 않는다.
- Player2: 공개 Game Client ID는 등록되어 배포본에 포함됨. 과거의 '아직 등록하지 않음' 상태는 폐기. 심사 전 일반 계정 연결은 미확인.
- 배포: 창작마당 항목 3819625112가 존재한다는 기록과 최신 파일 업로드 완료는 별개다. 업로드 여부 확인, 앱 설치 필요 안내, 새 PC 설치 및 로그 ZIP 확인이 남음.
- 경미한 관찰: 행성 목록 중복 요청, 소문 응답 파싱 실패, Player2 최초 로그인 지연의 재현 여부 확인.

## 이후 로드맵과 보류

연방 토론·법 적용 다음으로 반란 출신 기록, 내정/파벌 회의, 평화 중재, 지도자 만찬, 첩보 대면, 연방 전용 AI 행동 유도, 선언형 애드온 구조가 설계 기록에 있다. 현재 요청은 작업 기준 갱신이므로 이 기능들을 이번에 새로 구현하지 않았다.

자동 일시정지는 플레이어에게 맡긴 기존 결정을 유지한다. 연설문은 로컬 참고 메모이며 자동 낭독하거나 국민 AI에게 전달하지 않는다. 신문 '문체 입력'은 서체 선택으로 바뀌었다. 도시 구경·암살·재판소 엔클레이브·무거운 연출은 보류/후속 범위다.

과거 체크리스트가 참조하는 TEAM_FIX/EXPLORE/ADD, ISSUES_AND_ROADMAP, 개별 설계 문서와 게임 수집 ZIP은 이 이동 묶음에 없다. 상단의 낡은 F-29/F-31 등 전체 잔여 표를 확정 목록으로 복제하지 않고 필요한 상세 자료를 확보한 뒤 판단한다.
