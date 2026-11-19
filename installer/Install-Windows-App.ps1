<#
 .SYNOPSIS
    PowerShell Installer for Coretax Enterprise Accounting
 .DESCRIPTION
    Configures Firewall, creates Desktop/Start Menu shortcuts, and tests server.
#>

$ErrorActionPreference = "Continue"

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "    POWERSHELL INSTALLER - CORETAX ENTERPRISE ACCOUNTING" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan

$AppDir = Split-Path -Parent $PSScriptRoot
Write-Host "Direktori Aplikasi: $AppDir" -ForegroundColor White

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js tidak ditemukan di sistem. Harap pasang Node.js terlebih dahulu." -ForegroundColor Red
    pause
    exit
}
Write-Host "[OK] Node.js terpasang." -ForegroundColor Green

# 2. Firewall Rule (Requires Admin)
try {
    Write-Host "Mengonfigurasi Windows Firewall untuk LAN Server (Port 4000)..." -ForegroundColor White
    $existing = Get-NetFirewallRule -DisplayName "Accounting Enterprise Server (Port 4000)" -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule -DisplayName "Accounting Enterprise Server (Port 4000)" `
                            -Direction Inbound `
                            -LocalPort 4000 `
                            -Protocol TCP `
                            -Action Allow `
                            -ErrorAction SilentlyContinue | Out-Null
        Write-Host "[OK] Aturan Firewall Port 4000 berhasil ditambahkan." -ForegroundColor Green
    } else {
        Write-Host "[OK] Aturan Firewall sudah aktif." -ForegroundColor Green
    }
} catch {
    Write-Host "[INFO] Konfigurasi firewall memerlukan izin administrator jika dijalankan di komputer klien." -ForegroundColor Yellow
}

# 3. Create Shortcuts
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "Coretax Enterprise Accounting.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $AppDir "start-server.bat"
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.Description = "Coretax Enterprise Accounting System"
$Shortcut.Save()
Write-Host "[OK] Shortcut Desktop berhasil dibuat: $ShortcutPath" -ForegroundColor Green

# Start Menu Shortcut
$StartMenuPath = [System.Environment]::GetFolderPath('StartMenu')
$StartMenuPrograms = Join-Path $StartMenuPath "Programs"
$StartShortcutPath = Join-Path $StartMenuPrograms "Coretax Enterprise Accounting.lnk"

$StartShortcut = $WshShell.CreateShortcut($StartShortcutPath)
$StartShortcut.TargetPath = Join-Path $AppDir "start-server.bat"
$StartShortcut.WorkingDirectory = $AppDir
$StartShortcut.Description = "Coretax Enterprise Accounting System"
$StartShortcut.Save()
Write-Host "[OK] Shortcut Start Menu berhasil dibuat: $StartShortcutPath" -ForegroundColor Green

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "INSTALASI BERHASIL!" -ForegroundColor Green
Write-Host "Untuk menjalankan aplikasi, klik shortcut di Desktop atau jalankan start-server.bat." -ForegroundColor White
Write-Host "Aplikasi dapat diakses di http://localhost:4000" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan
