# SLLM 배포판 만들기 규칙 (고정)

배포판(설치 EXE)을 만들 때는 **이 문서만 따른다.** 새 조건·검사·제한을 즉석에서 만들어 넣지 않는다. 바꿀 일이 있으면 사용자에게 먼저 묻고, 결정되면 이 문서를 고친다.

## 1. 바꾸지 않는 것 (지난 설치기와 똑같이)

기준: 가장 최근 설치기(`dist/SLLM-Missive-Tester-Setup-0.1.0-alpha.3.exe` → 이후 alpha.4). 경로·이름·방식은 그대로 둔다.

| 항목 | 값 |
| --- | --- |
| 앱 설치 위치 | `바탕화면\app\SLLM-Tester` (`$DESKTOP\app\SLLM-Tester`) |
| 바로가기 | `바탕화면\SLLM Missive Tester.lnk` → `start_app.bat` |
| 로컬 모드 | `문서\Paradox Interactive\Stellaris\mod\sllm_missive_tester` + `sllm_missive_tester.mod` (선택 구성요소, 기본 켜짐. 창작마당 구독자는 해제) |
| 게임 DLL | `sllm-tester-command-bridge.dll`, 원본 `native\command-bridge.dll`, 설치 전 백업·제거 시 복원(`manage-dll.ps1`) |
| 게임 확인 | `verify-game.ps1` 의 검증한 Stellaris 4.5.2 해시 하나만 (있는 그대로 유지) |
| 기록 파일 | `game-install-path.txt`, `SLLM-tester-installed.txt`, `Uninstall-SLLM.exe` |
| 사용자 데이터 | 앱 데이터 폴더는 건드리지 않는다(덮어쓰기 설치 시 기록 유지) |

## 2. Node.js 는 필요 없다

- 설치기에 실행 프로그램 **Electron 31.7.7 (win32-x64)** 을 넣어 `앱 폴더\runtime` 에 설치한다. `start_app.bat` 은 `runtime\electron.exe` 로 바로 켠다.
- Node.js 설치 안내·버전 검사·`npm install`·첫 실행 다운로드를 **넣지 않는다.** (`runtime` 이 없는 개발 폴더에서만 bat 이 npm 으로 실행)
- Electron 파일은 `tools/electron/` 에 조각(28MB씩)과 공식 SHASUMS256 으로 들어 있다. 빌드할 때 해시를 확인한다. 버전을 올릴 때만 바꾼다(사용자 결정 후).

## 3. 만들 때 하는 일 (이 순서만)

1. 실행 앱(`바탕화면\새 폴더\app\SLLM-Tester`)과 `payload/app` 이 같은지 확인한다(`node_modules`, `manage-dll.ps1`, `register-mod.ps1`, `tester-registration.json` 은 실행 앱에만 있어도 됨).
2. 앱 빌드(`tsc`)와 자동 검사(`npm test`)가 통과한 상태여야 한다. `dist/` 는 소스와 같은 빌드.
3. 버전 올리기: `package.json`·`package-lock.json` 의 version, `tester-mod/descriptor.mod` 의 version, `sllm_probe_connection.txt` 의 HELLO version, `installer/setup.nsi` 의 `APP_VERSION` 한 줄. 문서(`README_KO.md`·`ALPHA_SETUP_*`·`RELEASE_NOTES_*`)의 버전 표기와 새 기능 요약.
4. 빌드 실행 — 둘 중 하나:
   - 리눅스/작업 VM: `bash build-release.sh` (NSIS 리눅스판이 `tools/` 에 들어 있어 따로 설치할 것 없음)
   - Windows: `powershell -ExecutionPolicy Bypass -File build-installer.ps1` (NSIS 설치 필요)
   - 두 스크립트 모두 `installer/uninstall-files.nsh` 를 자동으로 다시 만든다. 손으로 고치지 않는다.
5. 결과: `dist/SLLM-Missive-Tester-Setup-<버전>.exe`. 바탕화면 `새 폴더` 에도 한 부 복사한다.

## 4. 만든 뒤 확인

- EXE 안에 `runtime/electron.exe`, `dist/bootstrap.js`, `tester-mod/`, `native/command-bridge.dll`, `start_app.bat`, `update-public-key.pem` 이 있고 `dist/main.js`·`ui/` 는 **없는지**(7-Zip 으로 목록 보기, 9번 최소 설치기).
- 설치 경로·바로가기·로컬 모드 위치가 1번 표와 같은지(setup.nsi 의 `InstallDir`, `CreateShortcut`, `register-mod.ps1` 를 바꾸지 않았는지).
- 문서와 체크리스트에 버전·빌드 결과·EXE 크기·SHA256 을 적는다. 실제 Windows 설치·게임 실행 검수는 따로 표시한다(했으면 했다고, 안 했으면 안 했다고).

## 5. 창작마당 모드 폴더 (같이 만들 때)

- 내용은 `payload/app/tester-mod` 와 똑같이 둔다(모드 파일을 따로 고치지 않는다).
- `descriptor.mod` 만 창작마당용으로 바꾼다: name="SLLM Missive", tags Utilities·Gameplay·Diplomacy, supported_version, remote_file_id="3819625112", version=새 버전. path 줄은 넣지 않는다.
- 결과: `dist/workshop_<버전>/sllm_missive/`. 런처 업로드는 문서 폴더의 `mod/sllm_missive`(+ `sllm_missive.mod`)에서 하므로 그곳에도 같은 내용을 넣는다. 업로드 자체는 사용자가 직접 한다.
- 변경 설명은 `dist/workshop_<버전>/창작마당_변경사항_<버전>.txt`(BBCode).

## 7. 패치노트는 늘 최신본으로 (2026-10-18 사용자 규칙)

여러 세션이 동시에 작업하므로, 패치노트(`RELEASE_NOTES_KO/EN.md`·`창작마당_변경사항_<버전>.txt`·`RELEASE_ALPHA*_KO.md`)는 아래 순서를 지킨다.

1. 쓰기 직전에 PC 의 `CURRENT_TASKS_KO.md` 와 패치노트 파일들의 **최신본**을 다시 읽는다. 예전에 읽어 둔 사본으로 쓰지 않는다.
2. 지난 배포 이후 `CURRENT_TASKS_KO.md` 에 올라온 항목을 **모든 세션 것까지** 빠짐없이 패치노트에 반영한다(내가 한 작업만 넣지 않는다).
3. 이미 있는 내용 위에 덧붙이거나 고친 줄만 바꾼다. 통째로 다시 쓰지 않는다.
4. 저장 직전 수정 시각을 확인하고, 그사이 바뀌었으면 다시 읽어 합친다. 저장한 뒤 다시 읽어 다른 세션의 항목과 내 항목이 모두 남았는지 확인한다.
5. 한/영(`_KO`·`_EN`)과 창작마당 글이 같은 항목을 담고 있는지 맞춰 본다.

## 8. 창작마당으로 앱 업데이트 (2026-10-18 사용자 결정)

- 설치기_만들기.bat(make-installer.ps1) 이 마지막에 `tools/make-app-update.js` 로 **문서 `mod/sllm_missive/sllm_app_update/`** (있으면 `dist/workshop_<버전>/sllm_missive/` 에도) 에 앱 파일 + `manifest.json` + `manifest.sig` 를 넣는다. 모드 파일은 `descriptor.mod` 의 `version` 줄과 `sllm_probe_connection.txt` 의 HELLO `version=` 만 같은 버전으로 맞추고(2026-10-24 사용자 결정, 업데이트_만들기.bat 포함) 나머지는 건드리지 않는다.
- 묶음에 넣는 것: `dist`·`ui`·`native`·`example`·`package.json`·`start_app.bat`·`portrait-library.pak`·README/ALPHA_SETUP/RELEASE_NOTES. 넣지 않는 것: `src`·`tools`·`runtime`·`tester-mod`·공개 키·설치 기록 파일.
- 서명: Ed25519. 개인 키 `%USERPROFILE%\.sllm\update-signing-key.pem`(처음 실행 때 자동 생성, 백업 필수, 공유·업로드 금지). 공개 키 `update-public-key.pem` 은 payload·실행 앱·설치기에 들어간다. 개인 키를 잃으면 새 키를 만들고 사용자는 설치기를 한 번 다시 받아야 한다.
- 앱(설치판만): 켜진 뒤와 20분마다 구독 모드의 묶음을 확인 → 서명·해시가 맞고 더 높은 버전이면 「업데이트/나중에」를 묻고, 누르면 바뀐 파일만 교체(백업은 앱 데이터 `update-backup`, 실패 시 되돌림) 후 다시 시작.
- `native/command-bridge.dll` 이 바뀐 버전은 앱 안에서 업데이트하지 않고 새 설치기를 안내한다(게임 폴더 DLL 백업·제거 규칙 유지). Electron 런타임을 바꿀 때도 설치기.
- 설치기 없이 업데이트 묶음만 만들 때는 `업데이트_만들기.bat`(= `make-installer.ps1 -UpdateOnly`): 실행 앱=payload 확인·빌드·자동 검사·버전 확인·묶음 만들기만 하고 설치기는 만들지 않는다(5단계). 지난 묶음과 버전이 같으면 한 단계(`…alpha.8` → `…alpha.8.1` → `…alpha.8.2`) 자동으로 올린다. `native/command-bridge.dll` 이 지난 묶음과 달라지면 "설치기를 만들라"고 경고한다.
- 업로드는 지금처럼 사용자가 런처에서 직접 한다.
- PC 가 두 대일 때: 개발 폴더의 `서명키_옮기기.bat` — 키가 있는 PC 에서 실행하면 개발 폴더에 옮김용 사본(`_서명키_옮김용_공유금지.pem`)을 만들고, 개발 폴더를 옮긴 PC 에서 다시 실행하면 그 PC 의 `%USERPROFILE%\.sllm` 에 넣은 뒤 사본을 지운다(payload 공개 키와 짝인지 확인). 키 없는 PC 에서 설치기_만들기.bat 은 새 키를 만들지 않고 멈춘다.

## 9. 최소 설치기 (2026-10-21 사용자 결정 A안)

- 설치기에는 다음만 넣는다: `runtime/`(Electron), `native/command-bridge.dll`, `tester-mod/`(로컬 모드 선택 설치용), `start_app.bat`, `package.json`, `update-public-key.pem`, 첫 설치 도우미 `dist/bootstrap.js` 와 그것이 쓰는 `dist/app-update-core.js`·`dist/version-check.js`·`dist/environment-paths.js`, 설치 안내 문서. 목록은 `build-installer.ps1`·`build-release.sh` 의 같은 목록 한 곳씩에만 둔다.
- 나머지 앱 파일(`dist` 나머지·`ui`·`example`·`portrait-library.pak` 등)은 창작마당 모드의 `sllm_app_update` 묶음으로만 배포한다. 처음 켤 때 `start_app.bat` 이 `dist/main.js` 가 없으면 도우미를 켜고, 도우미가 8번과 같은 공개 키 서명·파일 해시를 확인한 뒤 앱 폴더를 채우고 앱을 켠다. 묶음 버전이 설치기 버전보다 낮으면 채우지 않는다(같거나 높으면 채움). 묶음의 DLL 이 설치기 DLL 과 다르면 채우지 않고 그 버전 설치기를 안내한다.
- 덮어쓰기 설치는 `dist/main.js` 만 지우고 나머지는 두며, 첫 실행 때 바뀐 파일만 묶음과 맞춘다. 제거 목록(`uninstall-files.nsh`)은 지금처럼 **전체 앱** 구성으로 만든다(채워진 파일도 지움). 사용자 데이터 폴더는 건드리지 않는다.
- 설치 경로·바로가기·로컬 모드·DLL 백업/복원·게임 확인은 1번 그대로.
- 배포 순서: 같은 버전(또는 더 높은 버전)의 앱 묶음이 든 모드를 창작마당에 **먼저** 올린 뒤 설치기를 배포한다. 설치기만 새 버전이고 창작마당 묶음이 옛 버전이면 새 사용자는 앱을 채울 수 없다(도우미가 「모드 업데이트 대기」로 안내).
- 그림 형식 변환(PNG→WebP 등)은 이 결정에 포함되지 않는다(별도 결정).

## 6. 하지 않는 것

- 새 요구 조건(Node·OS 버전·관리자 외 권한 등) 추가, 경로 변경, 모드 이름 변경, 별도 패치 EXE 분리.
- 창작마당 업로드·외부 게시 자동 실행.
