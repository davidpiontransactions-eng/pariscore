@echo off
setlocal enabledelayedexpansion
:: scripts/deploy.bat - SINGLE VPS deploy entry point (CMD, ASCII-only)
::
:: Usage:
::   scripts\deploy.bat "commit message"   -> git add -u + commit + push + deploy
::   scripts\deploy.bat --no-commit        -> deploy already-pushed code (skip git)
::
:: Replaces deploy-vps.bat / deploy-vps.sh / deploy-setpoint.sh (deleted).
:: Optimizations vs old scripts:
::   - git add -u (tracked mods only), NEVER -A (no untracked files staged)
::   - streams scripts/update_vps.sh to VPS (always latest logic, no skew)
::   - VPS runner skips 'next build' if legacy-only (~15-30s vs ~3min)
::   - default ssh agent key (no dead -i flag), BatchMode=yes (fail not hang)
::   - marker-based polling (fast detection, no accent-broken grep)

set "VPS_HOST=ubuntu@51.75.21.239"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15"
set /a POLL_MAX=60
set /a POLL_SLEEP=6

set "ARG1=%~1"
set "NO_COMMIT=0"
if /i "%ARG1%"=="--no-commit" ( set "NO_COMMIT=1" ) else ( set "COMMIT_MSG=%ARG1%" )

if "%NO_COMMIT%"=="0" if "%COMMIT_MSG%"=="" (
  echo Usage: scripts\deploy.bat "commit message"
  echo        scripts\deploy.bat --no-commit
  exit /b 1
)

echo =========================================================
echo   PARISCORE DEPLOY - %DATE% %TIME%
echo =========================================================

if "%NO_COMMIT%"=="0" (
  echo [1/3] git add -u + commit + push...
  set "GIT_TERMINAL_PROMPT=0"
  git add -u
  if !ERRORLEVEL! neq 0 ( echo [FAIL] git add & exit /b 1 )
  git commit -m "%COMMIT_MSG%"
  if !ERRORLEVEL! neq 0 if !ERRORLEVEL! neq 1 ( echo [FAIL] git commit & exit /b 1 )
  git push origin main
  if !ERRORLEVEL! neq 0 ( echo [FAIL] git push - maybe non-fast-forward, run git pull --rebase & exit /b 1 )
) else (
  echo [1/3] --no-commit: skip git (deploy already-pushed code)
)

echo [2/3] stream scripts\update_vps.sh to VPS + async launch...
ssh %SSH_OPTS% %VPS_HOST% "cat > /tmp/update_vps.sh && chmod +x /tmp/update_vps.sh && rm -f /tmp/update_vps.log && { nohup bash /tmp/update_vps.sh >/tmp/update_vps.log 2>&1 </dev/null & } && echo LAUNCHED" < scripts\update_vps.sh
if !ERRORLEVEL! neq 0 ( echo [FAIL] SSH launch - host unreachable or key refused & exit /b 1 )

echo [3/3] polling log (marker VPS DEPLOY OK, every %POLL_SLEEP%s, max %POLL_MAX% turns)...
set /a N=0
:poll
set /a N+=1
if !N! gtr %POLL_MAX% (
  echo [TIMEOUT] deploy over %POLL_MAX% turns. Check:
  echo   ssh %VPS_HOST% "tail -30 /tmp/update_vps.log"
  exit /b 1
)
for /f "tokens=* delims=" %%L in ('ssh %SSH_OPTS% %VPS_HOST% "grep -q 'VPS DEPLOY OK' /tmp/update_vps.log 2>/dev/null && echo __DONE__ || tail -n 1 /tmp/update_vps.log" 2^>nul') do set "LINE=%%L"
if "!LINE!"=="__DONE__" goto :finished
echo   [!N!/%POLL_MAX%] !LINE!
%SystemRoot%\System32\ping.exe -n %POLL_SLEEP% 127.0.0.1 >nul
goto :poll

:finished
echo.
echo --- last 15 log lines ---
ssh %SSH_OPTS% %VPS_HOST% "tail -n 15 /tmp/update_vps.log"
echo.
echo =========================================================
echo   DEPLOY COMPLETE
echo =========================================================
