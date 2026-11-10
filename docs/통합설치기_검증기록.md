# 알파3 통합 설치기 — Node 버전 강제 제한 제거

최신 C:/Users/mingyu/Desktop/app/SLLM-Tester의 alpha.3 소스·모드·native·example·UI를 별도 payload로 복사하고 컴파일했습니다.
버전 검사 없는 BAT와 Node engines 조건 없는 package/lock을 포함합니다. src/portraits.ts는 체크리스트 배포 조건대로 제외했습니다.
NSIS 컴파일러: release-build/tools/nsis-bundle/windows/makensis.exe. installer/setup.nsi를 DLL_HASH=5FBDE698D08632079044174CD9BBA21C2863B76F9FDFC8317E7E2422C2290B6C 정의로 빌드합니다.
로컬 모드는 선택 설치이며 실제 문서 경로/mod/sllm_missive_tester로 복사·등록합니다. 관리 해시가 같은 파일만 제거합니다.

검증:
- TypeScript 컴파일 통과.
- QA 빌드(사용자 권한, 시험용 문서 경로, 실제 게임 실행 상태 확인/바로가기 생략)로 한글 앱·게임·문서 경로에 설치 성공.
- 설치된 package/lock/BAT에 Node 버전 강제 조건 없음, 자동 npm install/start 유지 확인.
- DLL 설치, 정상 문서 모드 경로, 등록 descriptor, 최신 UI 및 example 파일 포함 확인.
- 기존 설치 덮어쓰기 성공. node_modules 및 추가 파일 보존.
- 제거 성공. 관리한 모드 파일·등록 제거, 추가 모드 파일 보존, 원래 DLL 복원.
- 로컬 모드 설치 해제 옵션: 앱·DLL만 설치하고 문서의 모드 등록 없음 확인.
- 소스 자체 검사: 원본 앱과 복사본 모두 PASS 697 / FAIL 4. 네 실패는 실제 집 PC의 문서·게임·창작마당 구독 경로가 테스트의 빈 환경 가정과 달라 발생하는 동일한 기존 실패. 배포 코드 변경으로 늘어난 실패 없음. 빌드된 selftest.js를 직접 실행하면 소스 파일 참조 검사도 실패하므로 tsx 소스 실행 결과를 사용.
- 실제 게임 실행/AI 호출은 이번 재패키징에서 수행하지 않음. 실제 사용자 게임/모드 설치 경로를 시험 중 변경하지 않음.
