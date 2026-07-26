@echo off
setlocal enabledelayedexpansion

:: deploy-vps.bat — Déploiement VPS via CMD + SSH (sans Git Bash)
:: Usage : scripts\deploy-vps.bat "message de commit"
::   ou   scripts\deploy-vps.bat (commit auto avec message par défaut)

set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa_pariscore"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=10"
set "VPS_HOST=ubuntu@51.75.21.239"
set "VPS_PATH=/home/ubuntu/.bun/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin"

echo =========================================================
echo   DEPLOIEMENT VPS PARISCORE — %DATE% %TIME%
echo =========================================================
echo.

:: ─── 1. Validation du message de commit ──────────
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=fix: deploiement automatique %DATE%"

:: ─── 2. Git add / commit / push ──────────────────
echo [1/4] git add -A
git add -A
if %ERRORLEVEL% neq 0 (
  echo [ECHEC] git add
  exit /b 1
)

echo [2/4] git commit -m "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%"
:: 0 = commit fait, 1 = rien a commit (code normal)
if %ERRORLEVEL% neq 0 if %ERRORLEVEL% neq 1 (
  echo [ECHEC] git commit
  exit /b 1
)

echo [3/4] git push origin main
git push origin main
if %ERRORLEVEL% neq 0 (
  echo [ECHEC] git push
  exit /b 1
)
echo.

:: ─── 3. SSH VPS : git pull + build + restart ────
echo [4/4] Deploiement VPS via SSH...
echo   Hote: %VPS_HOST%
echo   (peut prendre 3-8 minutes)
echo.

ssh -i "%SSH_KEY%" %SSH_OPTS% %VPS_HOST% "export PATH=\"%VPS_PATH%\"; cd ~/pariscore && echo '=== git pull ===' && git pull origin main 2>&1 && echo '=== bun install ===' && bun install 2>&1 && echo '=== bun run build ===' && bun run build 2>&1 && echo '=== pm2 restart ===' && pm2 restart pariscore-next 2>&1 && echo '=== status ===' && pm2 list 2>&1 | grep pariscore-next && echo '=== DEPLOY DONE ==='"

if %ERRORLEVEL% neq 0 (
  echo.
  echo [ECHEC] Le deploiement SSH a echoue
  echo   Verifier : ssh -i "%SSH_KEY%" %VPS_HOST%
  exit /b 1
)

echo.
echo =========================================================
echo   DEPLOIEMENT TERMINE
echo =========================================================
