@echo off
title Coretax Enterprise Accounting Server (LAN Port 4000)
color 0B
echo =======================================================================
echo          CORETAX ENTERPRISE ACCOUNTING SYSTEM - SERVER LAN
echo =======================================================================
echo  Memulai server lokal dan jaringan kantor...
echo.

cd /d "%~dp0"
node server/index.js

pause
