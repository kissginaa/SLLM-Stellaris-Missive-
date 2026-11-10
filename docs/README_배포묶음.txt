# SLLM Missive 0.1.0-alpha.3 통합 설치본

1. 게임과 앱을 종료하고 설치 EXE를 실행합니다.
2. 앱 기본 위치는 바탕화면/app/SLLM-Tester입니다. 실제 Stellaris 게임 설치 폴더를 확인합니다.
3. 창작마당 구독자는 구성 요소에서 '로컬 모드 설치'를 해제합니다. 테스터는 켜 둡니다.
4. 로컬 모드는 실제 Windows 문서/Paradox Interactive/Stellaris/mod/sllm_missive_tester에 복사·등록합니다.
5. 런처에서 사용할 SLLM 모드 하나만 켭니다. 게임 세이브 로드가 완전히 끝난 뒤 앱의 start_app.bat 또는 바탕화면 바로가기를 실행합니다.
6. 첫 실행 때 필요한 파일은 자동 설치됩니다. 현재 BAT 방식에는 Node.js 자체가 필요하지만 버전 강제 검사는 없습니다.

별도 제한 해제 패치는 필요 없습니다. 앱·게임 DLL·선택형 로컬 모드와 알파3 화면/배경 견본을 함께 설치합니다.
지원하는 게임 실행 파일(검증한 Windows x64 Stellaris 4.5.2)의 해시 검사는 유지합니다.
Node.js/Electron/node_modules는 설치기에 포함하지 않습니다. 실행 오류가 나면 Node.js 설치 여부와 인터넷 연결, 화면에 나온 오류 메시지를 확인해 주세요.

기존 SLLM 설치 폴더에 덮어쓸 수 있습니다. node_modules와 앱 사용자 기록은 유지합니다.
제거는 Uninstall-SLLM.exe로 진행합니다. 관리한 로컬 모드 등록·파일과 DLL을 정리하며, 바뀌었거나 추가된 모드 파일은 보존합니다.
