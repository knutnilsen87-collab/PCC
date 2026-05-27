@echo off
setlocal

cd /d "%~dp0"

where corepack >nul 2>nul
if errorlevel 1 (
  echo Corepack was not found. Install Node.js with Corepack support, then try again.
  pause
  exit /b 1
)

echo Starting Project Command Center from the latest local repo version...
start "Project Command Center Dev Server" cmd /k "corepack pnpm --filter @pcc/windows dev"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173"
