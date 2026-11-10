@echo off
chcp 65001 >nul
rem SLLM app-update bundle only (no installer). Double-click. Same checks as the installer build; version is raised automatically if the last bundle has the same version.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-installer.ps1" -UpdateOnly %*
echo.
pause
