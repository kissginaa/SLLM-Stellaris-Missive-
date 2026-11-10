Unicode true
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!define APP_VERSION "0.1.0-alpha.12.23"
!ifndef PAYLOAD
!define PAYLOAD "..\payload\app"
!endif
Name "SLLM Missive Tester ${APP_VERSION}"
!ifdef TEST_MODE
OutFile "..\dist\SLLM-Missive-QA-Setup-${APP_VERSION}.exe"
RequestExecutionLevel user
!else
OutFile "..\dist\SLLM-Missive-Tester-Setup-${APP_VERSION}.exe"
RequestExecutionLevel admin
!endif
InstallDir "$DESKTOP\app\SLLM-Tester"
SetCompressor /SOLID lzma
ShowInstDetails show
Var GameDir
Var GameEdit
Var GameBrowse
Var Dialog
Var NoLocalMod
!ifdef TEST_MODE
Var DocumentsDir
!endif
; ---- 설치기 언어(2026-11-08 사용자: 영어·중국어 추가). 설치 시작 때 언어를 고르고, 제거 프로그램은 고른 언어로 열린다.
; LangString 은 LCID 숫자로 정의한다(1033 English · 1042 한국어 · 2052 简体中文). 새 문구는 세 언어를 함께 넣을 것.
LangString SEC_CORE_NAME 1033 "SLLM app and DLL"
LangString SEC_CORE_NAME 1042 "SLLM 앱과 DLL"
LangString SEC_CORE_NAME 2052 "SLLM 应用和 DLL"
LangString SEC_MOD_NAME 1033 "Install local mod (Workshop subscribers: uncheck)"
LangString SEC_MOD_NAME 1042 "로컬 모드 설치 (창작마당 구독자는 해제)"
LangString SEC_MOD_NAME 2052 "安装本地模组（创意工坊订阅者请取消勾选）"
LangString WELCOME_TEXT 1033 "This installs the SLLM ${APP_VERSION} app and the game connection DLL. The local mod is optional.$\r$\n$\r$\nDefault app folder: Desktop\app\SLLM-Tester$\r$\nThe runtime (Electron) is included, so you do not need to install Node.js.$\r$\n$\r$\nThe app itself comes with the SLLM Missive mod on the Steam Workshop. On first launch it verifies the signature of the subscribed mod and fills in the remaining files (subscribe first).$\r$\n$\r$\nWorkshop subscribers: uncheck the local mod. Testers: install the local mod and enable SLLM Missive - Tester in the launcher."
LangString WELCOME_TEXT 1042 "SLLM ${APP_VERSION} 앱과 게임 연결 DLL을 설치합니다. 로컬 모드는 선택해 설치할 수 있습니다.$\r$\n$\r$\n앱 기본 경로: 바탕화면\app\SLLM-Tester$\r$\n실행 프로그램(Electron)이 함께 들어 있어 Node.js를 따로 설치할 필요가 없습니다.$\r$\n$\r$\n앱 본체는 Steam 창작마당의 SLLM Missive 모드 안에 들어 있습니다. 처음 실행할 때 구독한 모드에서 서명을 확인하고 채웁니다(먼저 구독해 주세요).$\r$\n$\r$\n창작마당 구독자는 로컬 모드 설치를 해제하세요. 테스터는 로컬 모드를 설치하고 런처에서 SLLM Missive - Tester를 켜 주세요."
LangString WELCOME_TEXT 2052 "将安装 SLLM ${APP_VERSION} 应用和游戏连接 DLL。本地模组可选择安装。$\r$\n$\r$\n应用默认路径：桌面\app\SLLM-Tester$\r$\n安装包已内置运行程序（Electron），无需另外安装 Node.js。$\r$\n$\r$\n应用本体包含在 Steam 创意工坊的 SLLM Missive 模组中。首次运行时会验证已订阅模组的签名并补全其余文件（请先订阅）。$\r$\n$\r$\n创意工坊订阅者请取消勾选本地模组。测试人员请安装本地模组，并在启动器中启用 SLLM Missive - Tester。"
LangString FINISH_TEXT 1033 "The app and game connection files are installed.$\r$\n$\r$\n1. Enable the SLLM mod in the Paradox Launcher$\r$\n2. Run SLLM Missive Tester on the desktop (or start_app.bat)$\r$\n   (the first time, the app files are filled in from the Workshop mod before it starts)$\r$\n$\r$\nThe Player2 game client ID is already included in the default settings."
LangString FINISH_TEXT 1042 "앱과 게임 연결 파일을 설치했습니다.$\r$\n$\r$\n1. Paradox 런처에서 사용할 SLLM 모드 켜기$\r$\n2. 바탕화면의 SLLM Missive Tester 또는 start_app.bat 실행$\r$\n   (처음 한 번은 창작마당 모드에서 앱 파일을 채운 뒤 켜집니다)$\r$\n$\r$\nPlayer2 게임 클라이언트 ID는 기본 설정에 포함되어 있습니다."
LangString FINISH_TEXT 2052 "应用和游戏连接文件已安装。$\r$\n$\r$\n1. 在 Paradox 启动器中启用 SLLM 模组$\r$\n2. 运行桌面上的 SLLM Missive Tester（或 start_app.bat）$\r$\n   （首次运行会先从创意工坊模组补全应用文件，然后再启动）$\r$\n$\r$\nPlayer2 游戏客户端 ID 已包含在默认设置中。"
LangString MSG_APPDIR_EXISTS 1033 "The selected app folder already contains files. Choose an empty folder or an existing SLLM installation folder."
LangString MSG_APPDIR_EXISTS 1042 "선택한 앱 폴더에 기존 파일이 있습니다. 빈 폴더 또는 기존 SLLM 설치 폴더를 선택해 주세요."
LangString MSG_APPDIR_EXISTS 2052 "所选应用文件夹中已有其他文件。请选择空文件夹，或已有的 SLLM 安装文件夹。"
LangString GAME_TITLE 1033 "Stellaris game folder"
LangString GAME_TITLE 1042 "스텔라리스 게임 설치 폴더"
LangString GAME_TITLE 2052 "群星游戏安装文件夹"
LangString GAME_SUB 1033 "Select the folder that contains stellaris.exe."
LangString GAME_SUB 1042 "stellaris.exe가 있는 폴더를 선택하세요."
LangString GAME_SUB 2052 "请选择包含 stellaris.exe 的文件夹。"
LangString GAME_LABEL 1033 "The Steam library was detected automatically. If the path is different, set it yourself.$\r$\nThis is not the Stellaris user folder in Documents. Supported versions: the verified 4.5.2 and 4.5.3 builds."
LangString GAME_LABEL 1042 "Steam 라이브러리를 자동 탐색했습니다. 경로가 다르면 직접 지정하세요.$\r$\n문서의 Stellaris 사용자 폴더와는 다릅니다. 지원 버전: 검증한 4.5.2 · 4.5.3 빌드."
LangString GAME_LABEL 2052 "已自动检测 Steam 库。如果路径不对，请手动指定。$\r$\n这不是“文档”中的 Stellaris 用户文件夹。支持的版本：已验证的 4.5.2 和 4.5.3 版本。"
LangString BROWSE_BTN 1033 "Browse..."
LangString BROWSE_BTN 1042 "찾아보기"
LangString BROWSE_BTN 2052 "浏览..."
LangString BROWSE_TITLE 1033 "Stellaris installation folder"
LangString BROWSE_TITLE 1042 "스텔라리스 설치 폴더"
LangString BROWSE_TITLE 2052 "群星安装文件夹"
LangString MSG_DLL_FAIL 1033 "Could not install the game DLL."
LangString MSG_DLL_FAIL 1042 "게임 DLL 설치에 실패했습니다."
LangString MSG_DLL_FAIL 2052 "游戏 DLL 安装失败。"
LangString MSG_WS_NOT_FOUND 1033 "The SLLM Missive mod on the Steam Workshop was not found yet.$\r$\n$\r$\nSubscribe to the mod and wait for the download to finish; running SLLM Missive Tester will then fill in the app files."
LangString MSG_WS_NOT_FOUND 1042 "Steam 창작마당의 SLLM Missive 모드를 아직 찾지 못했습니다.$\r$\n$\r$\n모드를 구독하고 다운로드가 끝난 뒤 SLLM Missive Tester를 실행하면 앱 파일이 채워집니다."
LangString MSG_WS_NOT_FOUND 2052 "尚未找到 Steam 创意工坊中的 SLLM Missive 模组。$\r$\n$\r$\n请订阅该模组并等待下载完成，然后运行 SLLM Missive Tester，即可补全应用文件。"
LangString MSG_MOD_FAIL 1033 "Could not register the local mod."
LangString MSG_MOD_FAIL 1042 "로컬 모드 등록에 실패했습니다."
LangString MSG_MOD_FAIL 2052 "本地模组注册失败。"
LangString MSG_UN_DLL_FAIL 1033 "Could not remove the game DLL. Close the game and check again."
LangString MSG_UN_DLL_FAIL 1042 "게임 DLL을 제거하지 못했습니다. 게임을 종료하고 다시 확인해 주세요."
LangString MSG_UN_DLL_FAIL 2052 "无法移除游戏 DLL。请关闭游戏后再试。"
LangString MSG_UN_MOD_FAIL 1033 "Could not remove the local mod registration."
LangString MSG_UN_MOD_FAIL 1042 "로컬 모드 등록을 제거하지 못했습니다."
LangString MSG_UN_MOD_FAIL 2052 "无法移除本地模组注册。"
!define MUI_ABORTWARNING
!define MUI_LANGDLL_ALLLANGUAGES
!ifndef TEST_MODE
!define MUI_LANGDLL_REGISTRY_ROOT "HKCU"
!define MUI_LANGDLL_REGISTRY_KEY "Software\SLLM Missive Tester"
!define MUI_LANGDLL_REGISTRY_VALUENAME "Installer Language"
!endif
!define MUI_WELCOMEPAGE_TEXT "$(WELCOME_TEXT)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE AppDirLeave
!insertmacro MUI_PAGE_DIRECTORY
Page custom GamePage GamePageLeave
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "$(FINISH_TEXT)"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
; 첫 언어는 시스템 언어가 셋 중에 없을 때 쓰는 기본값(영어). 무음 설치는 시스템 언어와 맞는 것을 자동으로 쓴다.
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
 !insertmacro MUI_LANGDLL_DISPLAY
 SetShellVarContext current
 InitPluginsDir
 File /oname=$PLUGINSDIR\detect-game.ps1 "detect-game.ps1"
 File /oname=$PLUGINSDIR\verify-game.ps1 "verify-game.ps1"
 ${GetParameters} $0
 ${GetOptions} $0 "/GAMEPATH=" $GameDir
 ${GetOptions} $0 "/NOLOCALMOD=" $NoLocalMod
 !ifdef TEST_MODE
 ${GetOptions} $0 "/DOCUMENTS=" $DocumentsDir
 !endif
 ${If} $GameDir == ""
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\detect-game.ps1" -Output "$PLUGINSDIR\game-path.txt"'
  Pop $0
  Pop $1
  FileOpen $0 "$PLUGINSDIR\game-path.txt" r
  FileReadUTF16LE $0 $GameDir
  FileClose $0
 ${EndIf}
FunctionEnd

Function un.onInit
 !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

Function AppDirLeave
 IfFileExists "$INSTDIR\SLLM-tester-installed.txt" done
 FindFirst $0 $1 "$INSTDIR\*"
 loop:
  StrCmp $1 "" empty
  StrCmp $1 "." next
  StrCmp $1 ".." next
  FindClose $0
  IfSilent +2
  MessageBox MB_ICONEXCLAMATION "$(MSG_APPDIR_EXISTS)"
  SetErrorLevel 5
  Abort
 next:
  FindNext $0 $1
  Goto loop
 empty:
  FindClose $0
 done:
FunctionEnd

Function GamePage
 !insertmacro MUI_HEADER_TEXT "$(GAME_TITLE)" "$(GAME_SUB)"
 nsDialogs::Create 1018
 Pop $Dialog
 ${NSD_CreateLabel} 0 0 100% 35u "$(GAME_LABEL)"
 Pop $0
 ${NSD_CreateDirRequest} 0 44u 82% 13u "$GameDir"
 Pop $GameEdit
 ${NSD_CreateBrowseButton} 84% 44u 16% 14u "$(BROWSE_BTN)"
 Pop $GameBrowse
 ${NSD_OnClick} $GameBrowse BrowseGame
 nsDialogs::Show
FunctionEnd
Function BrowseGame
 nsDialogs::SelectFolderDialog "$(BROWSE_TITLE)" "$GameDir"
 Pop $0
 StrCmp $0 "error" done
 StrCpy $GameDir $0
 ${NSD_SetText} $GameEdit $GameDir
 done:
FunctionEnd
Function VerifyGame
 !ifdef TEST_MODE
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-game.ps1" -GameDir "$GameDir" -TestMode'
 !else
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-game.ps1" -GameDir "$GameDir"'
 !endif
 Pop $0
 Pop $1
 !ifdef TEST_MODE
 FileOpen $2 "$EXEDIR\install-test.log" w
 FileWriteUTF16LE $2 "GameDir=$GameDir$\r$\nCode=$0$\r$\n$1"
 FileClose $2
 !endif
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONSTOP "$1"
  SetErrorLevel 2
  Abort
 ${EndIf}
FunctionEnd
Function GamePageLeave
 ${NSD_GetText} $GameEdit $GameDir
 Call VerifyGame
FunctionEnd

Section "$(SEC_CORE_NAME)" SEC_CORE
 SectionIn RO
 Call VerifyGame
 Call AppDirLeave
 SetOutPath "$INSTDIR"
 ; 최소 설치 구성(2026-10-21): 덮어쓰기 설치면 시작 파일을 지워 첫 실행 도우미가 창작마당 묶음과 다시 맞추게 한다(바뀐 파일만 복사).
 Delete "$INSTDIR\dist\main.js"
 File /r /x node_modules /x .git "${PAYLOAD}\*.*"
 File /oname=manage-dll.ps1 "manage-dll.ps1"
 File /oname=register-mod.ps1 "register-mod.ps1"
 FileOpen $0 "$INSTDIR\game-install-path.txt" w
 FileWriteUTF16LE $0 "$GameDir"
 FileClose $0
 FileOpen $0 "$INSTDIR\SLLM-tester-installed.txt" w
 FileWrite $0 "SLLM Missive ${APP_VERSION} pending"
 FileClose $0
 WriteUninstaller "$INSTDIR\Uninstall-SLLM.exe"
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\manage-dll.ps1" -GameDir "$GameDir" -Source "$INSTDIR\native\command-bridge.dll" -ExpectedHash "${DLL_HASH}"'
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONSTOP "$(MSG_DLL_FAIL)$\r$\n$1"
  SetErrorLevel 3
  Abort
 ${EndIf}
 FileOpen $0 "$INSTDIR\SLLM-tester-installed.txt" w
 FileWrite $0 "SLLM Missive ${APP_VERSION}"
 FileClose $0
 !ifndef TEST_MODE
 CreateShortcut "$DESKTOP\SLLM Missive Tester.lnk" "$INSTDIR\start_app.bat"
 !endif
 ; 앱 본체는 창작마당 모드에 있다. 아직 받지 않았으면 안내만 한다(설치는 계속).
 IfFileExists "$GameDir\..\..\workshop\content\281990\3819625112\sllm_app_update\manifest.json" ws_ok
 IfFileExists "$DOCUMENTS\Paradox Interactive\Stellaris\mod\sllm_missive\sllm_app_update\manifest.json" ws_ok
 IfSilent ws_ok
 MessageBox MB_ICONINFORMATION "$(MSG_WS_NOT_FOUND)"
 ws_ok:
SectionEnd

Section "$(SEC_MOD_NAME)" SEC_MOD
 ${If} $NoLocalMod == "1"
  Goto local_done
 ${EndIf}
 !ifdef TEST_MODE
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\register-mod.ps1" -AppDir "$INSTDIR" -DocumentsDir "$DocumentsDir"'
 !else
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\register-mod.ps1" -AppDir "$INSTDIR"'
 !endif
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONSTOP "$(MSG_MOD_FAIL)$\r$\n$1"
  SetErrorLevel 6
  Abort
 ${EndIf}
 local_done:
SectionEnd

Section "Uninstall"
 SetShellVarContext current
 FileOpen $0 "$INSTDIR\game-install-path.txt" r
 FileReadUTF16LE $0 $GameDir
 FileClose $0
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\manage-dll.ps1" -GameDir "$GameDir" -ExpectedHash "${DLL_HASH}" -Remove'
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONEXCLAMATION "$(MSG_UN_DLL_FAIL)$\r$\n$1"
  SetErrorLevel 4
  Abort
 ${EndIf}
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\register-mod.ps1" -AppDir "$INSTDIR" -Remove'
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONEXCLAMATION "$(MSG_UN_MOD_FAIL)$\r$\n$1"
  SetErrorLevel 7
  Abort
 ${EndIf}
 !include "uninstall-files.nsh"
 Delete "$INSTDIR\register-mod.ps1"
 Delete "$INSTDIR\manage-dll.ps1"
 Delete "$INSTDIR\game-install-path.txt"
 Delete "$INSTDIR\SLLM-tester-installed.txt"
 Delete "$INSTDIR\Uninstall-SLLM.exe"
 !ifndef TEST_MODE
 Delete "$DESKTOP\SLLM Missive Tester.lnk"
 !endif
 !ifndef TEST_MODE
 ; 게임 감시기(2026-10-30): 시작 프로그램 등록과 켜짐 표시를 지운다(돌고 있던 감시기는 표시 파일이 없으면 5초 안에 스스로 끝남)
 DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SLLM Game Watcher"
 DeleteRegValue HKCU "Software\SLLM Missive Tester" "Installer Language"
 DeleteRegKey /ifempty HKCU "Software\SLLM Missive Tester"
 Delete "$APPDATA\SLLM-Missive-Tester\game-watcher.on"
 Delete "$APPDATA\SLLM-Missive-Tester\game-watcher.ps1"
 !endif
 RMDir "$INSTDIR"
SectionEnd








