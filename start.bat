@echo off
setlocal
title AI Career Mentor - Local Startup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" %*
if errorlevel 1 (
    echo.
    echo Startup failed. See the message above and the logs folder.
    pause
    exit /b 1
)
exit /b 0
