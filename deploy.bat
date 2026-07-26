@echo off
cd /d "C:\Users\David\ZCodeProject\pariscore"

echo ========================================
echo   PariScore Deploy Script
echo ========================================
echo.
echo Usage: deploy.bat "message de commit"
echo   (si pas de message, commit auto avec date)
echo.

:: Message de commit (argument ou date par defaut)
set "MSG=%~1"
if "%MSG%"=="" set "MSG=fix: deploiement automatique %DATE%"

:: Delegue a scripts/deploy-vps.bat
call scripts\deploy-vps.bat "%MSG%"

echo.
echo === Done ===
pause
