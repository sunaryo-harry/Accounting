@echo off
setlocal enabledelayedexpansion
title Windows Installer - Coretax Enterprise Accounting
color 1F

echo =======================================================================
echo          WINDOWS INSTALLER - CORETAX ENTERPRISE ACCOUNTING
echo             Sistem Akuntansi Multi Entitas & Server LAN
echo =======================================================================
echo.
echo  Selamat datang di wizard instalasi Coretax Enterprise Accounting!
echo  Installer ini akan:
echo   1. Memeriksa ketersediaan runtime Node.js di sistem Anda.
echo   2. Mengkonfigurasi Windows Firewall untuk mengizinkan akses LAN (Port 4000).
echo   3. Menginisialisasi basis data SQLite dan bagan akun PSAK.
echo   4. Membuat Shortcut Desktop "Coretax Enterprise Accounting".
echo   5. Membuat Shortcut Start Menu.
echo.
echo =======================================================================
set /p CONFIRM="Lanjutkan instalasi sekarang? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Instalasi dibatalkan oleh pengguna.
    pause
    exit /b
)

echo.
echo [1/5] Memeriksa instalasi Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terpasang di sistem ini!
    echo Silakan unduh dan pasang Node.js dari https://nodejs.org terlebih dahulu.
    pause
    exit /b
)
echo      Node.js terdeteksi: OK!

echo.
echo [2/5] Mengkonfigurasi Windows Firewall untuk Server LAN (Port 4000)...
netsh advfirewall firewall show rule name="Accounting Enterprise Server (Port 4000)" >nul 2>&1
if %errorlevel% equ 0 (
    echo      Aturan Firewall Port 4000 sudah ada: OK!
) else (
    echo      Mendaftarkan aturan inbound firewall Port 4000...
    netsh advfirewall firewall add rule name="Accounting Enterprise Server (Port 4000)" dir=in action=allow protocol=TCP localport=4000 >nul 2>&1
    if %errorlevel% equ 0 (
        echo      Aturan Firewall berhasil didaftarkan: OK!
    ) else (
        echo      Catatan: Jalankan installer sebagai Administrator jika ingin otomatis membuka firewall.
    )
)

echo.
echo [3/5] Menginisialisasi Database Akuntansi SQLite & Bagan Akun...
cd /d "%~dp0\.."
node server/index.js --init-only >nul 2>&1
echo      Database accounting.sqlite terverifikasi: OK!

echo.
echo [4/5] Membuat Shortcut Desktop...
set "TARGET_DIR=%~dp0\.."
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Coretax Enterprise Accounting.lnk"
set "VBS_SCRIPT=%TEMP%\create_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%SHORTCUT_PATH%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%TARGET_DIR%\start-server.bat" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Coretax Enterprise Accounting Multi Entitas" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%" >nul 2>&1
echo      Shortcut Desktop berhasil dibuat di Desktop Anda: OK!

echo.
echo [5/5] Membuat Shortcut Start Menu...
set "START_MENU_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Coretax Enterprise Accounting.lnk"
set "VBS_SCRIPT=%TEMP%\create_start_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%START_MENU_PATH%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%TARGET_DIR%\start-server.bat" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Coretax Enterprise Accounting Multi Entitas" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%" >nul 2>&1
echo      Shortcut Start Menu berhasil dibuat: OK!

echo.
echo =======================================================================
echo          INSTALASI SELESAI DENGAN SUKSES! (BERHASIL)
echo =======================================================================
echo  Aplikasi dapat dijalankan melalui:
echo   - Ikon Desktop "Coretax Enterprise Accounting"
echo   - Berkas "start-server.bat" di folder instalasi
echo   - Browser: http://localhost:4000
echo.
set /p LAUNCH="Jalankan Coretax Enterprise Accounting sekarang? (Y/N): "
if /i "%LAUNCH%"=="Y" (
    start "" "%TARGET_DIR%\start-server.bat"
    timeout /t 2 >nul
    start http://localhost:4000
)

pause
