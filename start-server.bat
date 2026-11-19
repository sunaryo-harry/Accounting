@echo off
title Coretax Enterprise Accounting Server (LAN)
color 0B
echo =======================================================================
echo          CORETAX ENTERPRISE ACCOUNTING SYSTEM - SERVER LAN
echo                     Credit by Harry Sunaryo
echo =======================================================================
echo  Memulai server akuntansi lokal dan jaringan kantor...
echo.

cd /d "%~dp0"

set "NODE_CMD=node"
if exist "%~dp0node.exe" (
    set "NODE_CMD=%~dp0node.exe"
)

"%NODE_CMD%" -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [PERINGATAN] Runtime Node.js tidak ditemukan!
    echo Silakan pastikan berkas node.exe berada di folder ini atau pasang Node.js dari https://nodejs.org.
    echo.
    pause
    exit /b
)

:: Bersihkan proses lama yang mungkin masih terkunci di port 4000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Buka browser secara otomatis setelah 2 detik
start http://localhost:4000 2>nul

"%NODE_CMD%" server/index.js

pause
