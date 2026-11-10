@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "SLLM_CLIENT_ID=01a139d0-0356-7e9a-9c8f-c1d8450f3fde"
rem 배포판: 설치기에 들어 있는 실행 프로그램(runtime\electron.exe)으로 바로 켭니다. Node.js가 필요 없습니다.
if exist "runtime\electron.exe" (
  rem 첫 설치 - 설치기 최소 구성 2026-10-21: 앱 파일이 아직 없으면 도우미가 창작마당 모드에서 채운 뒤 앱을 켭니다.
  if not exist "dist\main.js" (
    start "" "runtime\electron.exe" "%~dp0dist\bootstrap.js"
    exit /b 0
  )
  start "" "runtime\electron.exe" "%~dp0."
  exit /b 0
)
rem 개발 폴더(runtime 없음): Node.js와 npm으로 실행합니다.
where node >nul 2>nul
if errorlevel 1 (
  echo [SLLM] runtime 폴더가 없습니다. 설치 프로그램으로 다시 설치하거나, 개발용이면 Node.js를 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo [SLLM] Installing dependencies for the first run. Please wait...
  call npm install
  if errorlevel 1 (
    echo [SLLM] Dependency installation failed. Check your internet connection and run this file again.
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 (
  echo [SLLM] Startup failed. See the message above.
  pause
  exit /b 1
)
exit /b 0
