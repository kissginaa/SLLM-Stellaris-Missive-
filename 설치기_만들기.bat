@echo off
chcp 65001 >nul
rem SLLM installer one-click build. Double-click. (Version bump: run with  -Bump 0.1.0-alpha.6)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-installer.ps1" %*
echo.
pause
