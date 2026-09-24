@echo off
setlocal
title 我的职业规划ai导师 - 本地启动
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" %*
if errorlevel 1 (
    echo.
    echo Startup failed. See the message above and the logs folder.
    pause
    exit /b 1
)
exit /b 0
