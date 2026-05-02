@echo off
REM Lance le script PowerShell qui copie puis supprime le fichier source.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-pariscore.ps1"
