@echo off
REM Dual-purpose launcher:
REM   * Double-click (no args) -> opens the Claudies GUI.
REM   * With args (claudies add work) -> runs the CLI.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0claudies-gui.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0claudies.ps1" %*
)
