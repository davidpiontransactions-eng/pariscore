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
::   - marker-based REMOTE wait: 1 ssh connection, 2s granularity (old: up to
::     60 client-side ssh round-trips at 6s = ~8min worst case, ~1min typical
::     wasted in polling alone) + fast-fail on 'ERR:' marker in VPS log.

set "VPS_HOST=ubuntu@51.75.21.239"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15"
:: Remote wait config: WAIT_ITERS x WAIT_STEP_S = hard cap (~7 min).
set /a WAIT_ITERS=210
set /a WAIT_STEP_S=2

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

echo [3/3] waiting VPS_DEPLOY_OK on the VPS itself - 1 ssh connection, !WAIT_STEP_S!s steps, max !WAIT_ITERS! steps, fail-fast on ERR:...
ssh %SSH_OPTS% %VPS_HOST% "i=0; while [ $i -lt !WAIT_ITERS! ]; do if grep -q VPS_DEPLOY_OK /tmp/update_vps.log 2>/dev/null; then exit 0; fi; if grep -q 'ERR:' /tmp/update_vps.log 2>/dev/null; then exit 2; fi; i=$((i+1)); sleep !WAIT_STEP_S!; done; exit 3"
set /a WAIT_RC=!ERRORLEVEL!
if !WAIT_RC! equ 0 goto :finished
if !WAIT_RC! equ 2 (
  echo [FAIL] VPS deploy failed - ERR: marker found in log. Last 20 lines:
  ssh %SSH_OPTS% %VPS_HOST% "tail -n 20 /tmp/update_vps.log"
  exit /b 1
)
if !WAIT_RC! equ 3 (
  echo [TIMEOUT] no VPS_DEPLOY_OK after ~7 min. Check:
  echo   ssh %VPS_HOST% "tail -30 /tmp/update_vps.log"
  ssh %SSH_OPTS% %VPS_HOST% "tail -n 15 /tmp/update_vps.log"
  exit /b 1
)
echo [FAIL] SSH wait connection lost - rc !WAIT_RC!. Deploy may still be running; check:
echo   ssh %VPS_HOST% "tail -30 /tmp/update_vps.log"
exit /b 1

:finished
echo.
echo --- last 15 log lines ---
ssh %SSH_OPTS% %VPS_HOST% "tail -n 15 /tmp/update_vps.log"
echo.
echo =========================================================
echo   DEPLOY COMPLETE
echo =========================================================
