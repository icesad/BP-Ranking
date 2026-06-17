#Requires -Version 5.1
<#
    Optional installer for Claudies (Windows).
    - Adds this folder to your USER PATH so you can type `claudies` anywhere.
    - Creates a Start Menu shortcut for the GUI.
    Run:  powershell -ExecutionPolicy Bypass -File .\install.ps1
    Undo: powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall
#>
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Add-ToUserPath($dir) {
    $cur = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @()
    if ($cur) { $parts = $cur -split ';' | Where-Object { $_ -ne '' } }
    if ($parts -contains $dir) { Write-Host "Already on PATH: $dir" -ForegroundColor Yellow; return }
    $new = (@($parts) + $dir) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $new, 'User')
    Write-Host "Added to user PATH: $dir" -ForegroundColor Green
    Write-Host "Open a NEW terminal for it to take effect." -ForegroundColor Gray
}

function Remove-FromUserPath($dir) {
    $cur = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $cur) { return }
    $parts = $cur -split ';' | Where-Object { $_ -ne '' -and $_ -ne $dir }
    [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
    Write-Host "Removed from user PATH: $dir" -ForegroundColor Green
}

$startMenu = [Environment]::GetFolderPath('Programs')
$lnk = Join-Path $startMenu 'Claudies.lnk'

if ($Uninstall) {
    Remove-FromUserPath $here
    if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk -Force; Write-Host "Removed Start Menu shortcut." -ForegroundColor Green }
    Write-Host "Uninstall complete. (Your profiles in %LOCALAPPDATA%\Claudies were left intact.)" -ForegroundColor Cyan
    return
}

Add-ToUserPath $here

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnk)
$sc.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $here 'claudies-gui.ps1')`""
$sc.WorkingDirectory = $here
$sc.Description = 'Claudies - multiple Claude accounts'
$sc.Save()
Write-Host "Created Start Menu shortcut: $lnk" -ForegroundColor Green

Write-Host ""
Write-Host "Done. Try it:" -ForegroundColor Cyan
Write-Host "  claudies help" -ForegroundColor White
Write-Host "  claudies add work" -ForegroundColor White
