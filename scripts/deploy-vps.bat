@echo off
setlocal enabledelayedexpansion

:: deploy-vps.bat — Déploiement VPS via CMD + SSH (sans Git Bash)
:: Usage : scripts\deploy-vps.bat "message de commit"
::   ou   scripts\deploy-vps.bat (commit auto avec message par défaut)
::
:: Pattern LONG DEPLOY — détaché + log + polling (évite le timeout local) :
::   1. Lance le deploy sur le VPS en nohup, sortie -> /tmp/update_vps.log
::   2. Quitte immédiatement (le SSH local ne bloque PLUS pendant 10-15 min)
::   3. Poll toutes les 20 s : tail du log + présence du process script
::   4. Critère fin : process parti + "VPS mis à jour avec succès" dans le log

set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa_pariscore"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15"
set "VPS_HOST=ubuntu@51.75.21.239"
set "VPS_PATH=/home/ubuntu/.bun/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin"
set /a POLL_MAX=90
set /a POLL_SLEEP=20

echo =========================================================
echo   DEPLOIEMENT VPS PARISCORE — %DATE% %TIME%
echo   Mode : async (nohup + log + polling)
echo =========================================================
echo.

:: ─── 1. Validation du message de commit ──────────
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=fix: deploiement automatique %DATE%"

:: ─── 2. Git add / commit / push ──────────────────
echo [1/4] git add -A
git add -A
if !ERRORLEVEL! neq 0 (
  echo [ECHEC] git add
  exit /b 1
)

echo [2/4] git commit -m "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%"
:: 0 = commit fait, 1 = rien a commit (code normal)
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

:: ─── 3. Lancement DETACHE du deploy sur le VPS ──
echo [4/4] Deploiement VPS (async)...
echo   Hote: %VPS_HOST%
echo   Log VPS: /tmp/update_vps.log
echo.

ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "export PATH=\"%VPS_PATH%\"; cd ~/pariscore && rm -f /tmp/update_vps.log && nohup bash scripts/update_vps.sh > /tmp/update_vps.log 2>&1 < /dev/null & echo LAUNCHED"
if !ERRORLEVEL! neq 0 (
  echo.
  echo [ECHEC] Lancement SSH (hote/service inaccessible)
  exit /b 1
)

:: ─── 4. Polling ─────────────────────────────────
echo   Deploy lance. Polling toutes les %POLL_SLEEP% s (max %POLL_MAX% fois)...
echo.

set /a N=0
:poll
set /a N+=1
if !N! gtr %POLL_MAX% (
  echo.
  echo [TIMEOUT] Deploy encore actif apres %POLLM% polls.
  echo   Log a verifier : ssh -i "%SSH_KEY%" %VPS_HOST% "tail -30 /tmp/update_vps.log"
  echo   Process :        ssh ... "ps -ef ^| grep update_vps ^| grep -v grep"
  exit /b 1
)

:: Verifier si le process update_vps.sh tourne encore sur le VPS
for /f "tokens=* delims=" %%L in ('ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "ps -ef | grep update_vps.sh | grep -v grep | wc -l" 2^>nul') do set "RUNNING=%%L"
set "RUNNING=!RUNNING: =!"

if "!RUNNING!"=="0" goto :finished

:: Afficher la dernière ligne du log (progression)
for /f "tokens=* delims=" %%L in ('ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "tail -n 1 /tmp/update_vps.log" 2^>nul') do set "TAIL=%%L"
echo   [%N%/%POLLM%] %TAIL%

timeout /t %POLL_SLEEP% /nobreak >nul
goto :poll

:finished
echo.
echo   --- Process deploy termine. Dernieres lignes du log : ---
ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "tail -n 15 /tmp/update_vps.log"

:: ── 5. Confirmation ────────────────────────────
ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "grep -q 'VPS mis a jour avec succes' /tmp/update_vps.log && echo SUCCESS || echo CHECK_LOG"
echo.
echo =========================================================
echo   DEPLOIEMENT TERMINE
echo =========================================================