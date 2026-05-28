@echo off
setlocal

if exist "%~dp0..\start-project-command-center.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\start-project-command-center.ps1"
) else (
  cd /d "%~dp0"
  echo Starting Project Command Center from the latest local repo version...
  start "Project Command Center Dev Server" cmd /k "corepack pnpm --filter @pcc/windows dev"
  timeout /t 3 /nobreak >nul
  start "" "http://127.0.0.1:5173"
)

if errorlevel 1 (
  echo.
  echo Project Command Center could not start.
  pause
)
