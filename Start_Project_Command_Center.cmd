@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-project-command-center.ps1"

if errorlevel 1 (
  echo.
  echo Project Command Center could not start.
  pause
)
