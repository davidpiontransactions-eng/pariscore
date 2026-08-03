@echo off
setlocal enabledelayedexpansion

:: Deploiement VPS par CMD + SSH (sans Git Bash)
:: Usage : scripts\deploy-vps.bat "message"
::   ou   scripts\deploy-vps.bat (commit auto avec message par defaut)
::
:: Pattern LONG DEPLOY - detache + log + polling (evite le timeout local) :
::   1. Lance le deploy sur le VPS en nohup, sortie -> /tmp/update_vps.log
::   2. Quitte immediatement (le ssh local ne bloque PLUS pendant 10-15 min)
::   3. Poll toutes les %POLL_SLEEP% s : tail du log + presence du process script
::   4. Critere fin : process parti + "VPS mis a jour avec succes" dans le log

:: NB : fichier 100% ASCII - CMD ne sait pas parser UTF-8 multioctets et
:: casse alors les assignations (SSH_KEY vide / hostname invalide).

set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa_pariscore"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15"
set "VPS_HOST=ubuntu@51.75.21.239"
set "VPS_PATH=/home/ubuntu/.bun/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin"
set /a POLL_MAX=90
set /a POLL_SLEEP=10

echo =========================================================
echo   DEPLOIEMENT VPS PARISCORE - %DATE% %TIME%
echo   Mode : async (nohup + log + polling)
echo =========================================================
echo.

:: ---- 1. Validation du message de commit ---------------------
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=fix: deploiement automatique %DATE%"

:: ---- 2. Git add / commit / push ----------------------------
echo [1/4] git add -A
git add -A
if !ERRORLEVEL! neq 0 (
  echo [ECHEC] git add
  exit /b 1
)

echo [2/4] git commit -m "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%"
:: 0 = commit fait, 1 = rien a committer (code normal)
if !ERRORLEVEL! neq 0 if !ERRORLEVEL! neq 1 (
  echo [ECHEC] git commit
  exit /b 1
)

echo [3/4] git push origin main
git push origin main
if !ERRORLEVEL! neq 0 (
  echo [ECHEC] git push
  exit /b 1
)
echo.

:: ---- 3. Lancement DETACHE du deploy sur le VPS --------------
echo [4/4] Deploiement VPS (async)...
echo   Hote: %VPS_HOST%
echo   Log VPS: /tmp/update_vps.log
echo.

:: NB : -f = ssh part en background apres auth et revient immediatement ;
:: le nohup laisse update_vps.sh tourner sur le VPS pendant le polling.
ssh -f -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "export PATH=\"%VPS_PATH%\"; cd ~/pariscore && rm -f /tmp/update_vps.log && nohup bash scripts/update_vps.sh > /tmp/update_vps.log 2>&1 < /dev/null & echo LAUNCHED"
if !ERRORLEVEL! neq 0 (
  echo.
  echo [ECHEC] Lancement SSH (hote/service inaccessible)
  exit /b 1
)

:: ---- 4. Polling ---------------------------------------------
echo   Deploy lance. Polling toutes les %POLL_SLEEP% s (max %POLL_MAX% tours)...
echo.
set /a N=0

:poll
set /a N+=1
if !N! gtr %POLL_MAX% (
  echo.
  echo [TIMEOUT] Deploy depasse %POLL_MAX% tours. Reconnexion manuelle :
  echo   ssh -i "%SSH_KEY%" %VPS_HOST% "tail -30 /tmp/update_vps.log"
  echo   ssh -i "%SSH_KEY%" %VPS_HOST% "ps -ef ^| grep update_vps ^| grep -v grep"
  exit /b 1
)

for /f "tokens=* delims=" %%L in ('ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "ps -ef | grep update_vps.sh | grep -v grep | wc -l" 2^>nul') do set "RUNNING=%%L"
set "RUNNING=!RUNNING: =!"

if "!RUNNING!"=="0" goto :finished

for /f "tokens=* delims=" %%L in ('ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "tail -n 1 /tmp/update_vps.log" 2^>nul') do set "TAIL=%%L"
echo   [%N%/%POLL_MAX%] %TAIL%

timeout /t %POLL_SLEEP% /nobreak >nul
goto :poll

:finished
echo.
echo   --- Process deploy termine. Dernieres lignes du log : ---
ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "tail -n 15 /tmp/update_vps.log"

:: ---- 5. Confirmation ------------------------------
ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "grep -q 'VPS mis a jour avec succes' /tmp/update_vps.log && echo SUCCESS || echo CHECK_LOG"
echo.
echo =========================================================
echo   DEPLOIEMENT TERMINE
echo =========================================================