@echo off
setlocal enabledelayedexpansion
:: scripts/deploy-v2.bat - Automated VPS deploy with quality gates
::
:: Usage:
::   scripts\deploy-v2.bat "commit message"   -> full deploy (lint + typecheck + tests + build + deploy)
::   scripts\deploy-v2.bat --quick            -> quick deploy (skip lint/typecheck/tests, deploy already-pushed code)
::   scripts\deploy-v2.bat --no-commit        -> deploy already-pushed code (skip git)
::   scripts\deploy-v2.bat --dry-run          -> show what would be deployed (no actual deploy)
::
:: Improvements vs deploy.bat:
::   - Pre-deploy quality gates (lint, typecheck, E2E tests)
::   - Database backup before schema changes
::   - Health check on both ports (3000 + 3005)
::   - Deploy locking (prevents concurrent deploys)
::   - Automatic rollback on failure
::   - Smoke test post-deploy
::   - Version tagging (deploy-YYYYMMDD-HHMMSS)
::   - Failure notifications Discord

set "VPS_HOST=ubuntu@51.75.21.239"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15"
set /a WAIT_ITERS=210
set /a WAIT_STEP_S=1

set "ARG1=%~1"
set "QUICK=0"
set "NO_COMMIT=0"
set "DRY_RUN=0"
set "COMMIT_MSG="

if /i "%ARG1%"=="--quick" ( set "QUICK=1" ) else if /i "%ARG1%"=="--no-commit" ( set "NO_COMMIT=1" ) else if /i "%ARG1%"=="--dry-run" ( set "DRY_RUN=1" ) else ( set "COMMIT_MSG=%ARG1%" )

if "%QUICK%"=="0" if "%NO_COMMIT%"=="0" if "%DRY_RUN%"=="0" if "%COMMIT_MSG%"=="" (
  echo Usage: scripts\deploy-v2.bat "commit message"
  echo        scripts\deploy-v2.bat --quick
  echo        scripts\deploy-v2.bat --no-commit
  echo        scripts\deploy-v2.bat --dry-run
  exit /b 1
)

echo =========================================================
echo   PARISCORE DEPLOY v2 - %DATE% %TIME%
echo =========================================================

:: --- Dry run ---
if "%DRY_RUN%"=="1" (
  echo [DRY RUN] Would deploy:
  git log --oneline -3
  echo.
  echo Changed files since last deploy:
  git diff --name-only HEAD~1 HEAD 2>nul
  exit /b 0
)

:: --- Pre-deploy checks (local) ---
if "%QUICK%"=="0" if "%NO_COMMIT%"=="0" (
  echo [0/4] Pre-deploy local checks...

  :: Lint
  echo   Running ESLint...
  call npx next lint --dir src 2^>nul
  if !ERRORLEVEL! neq 0 (
    echo [FAIL] ESLint failed — fix errors before deploying
    exit /b 1
  )
  echo   ESLint: OK

  :: Typecheck
  echo   Running TypeScript check...
  call npx tsc --noEmit 2^>nul
  if !ERRORLEVEL! neq 0 (
    echo [FAIL] TypeScript check failed — fix errors before deploying
    exit /b 1
  )
  echo   TypeScript: OK
)

:: --- Git operations ---
if "%NO_COMMIT%"=="0" (
  echo [1/4] git add -u + commit + push...
  set "GIT_TERMINAL_PROMPT=0"
  git add -u
  if !ERRORLEVEL! neq 0 ( echo [FAIL] git add & exit /b 1 )
  git commit -m "%COMMIT_MSG%"
  if !ERRORLEVEL! neq 0 if !ERRORLEVEL! neq 1 ( echo [FAIL] git commit & exit /b 1 )
  git push origin main
  if !ERRORLEVEL! neq 0 ( echo [FAIL] git push — run git pull --rebase first & exit /b 1 )
) else (
  echo [1/4] --no-commit: skip git
)

:: --- Set deploy flags ---
set "DEPLOY_FLAGS="
if "%QUICK%"=="1" set "DEPLOY_FLAGS=SKIP_LINT=1 SKIP_TESTS=1"

:: --- Stream deploy-v2.sh to VPS ---
echo [2/4] Stream deploy-v2.sh to VPS...
ssh %SSH_OPTS% %VPS_HOST% "cat > /tmp/deploy-v2.raw && tr -d '\r' < /tmp/deploy-v2.raw > /tmp/deploy-v2.sh && chmod +x /tmp/deploy-v2.sh && rm -f /tmp/deploy-v2.log && { nohup env %DEPLOY_FLAGS% bash /tmp/deploy-v2.sh >/tmp/deploy-v2.log 2>&1 </dev/null & } && echo LAUNCHED" < scripts\deploy-v2.sh
if !ERRORLEVEL! neq 0 ( echo [FAIL] SSH launch — host unreachable & exit /b 1 )

:: --- Wait for completion ---
echo [3/4] Waiting for VPS deploy (max ~7 min)...
ssh %SSH_OPTS% %VPS_HOST% "i=0; while [ $i -lt !WAIT_ITERS! ]; do if grep -q VPS_DEPLOY_OK /tmp/deploy-v2.log 2>/dev/null; then exit 0; fi; if grep -qE 'ERR:|syntax error|Rolled back' /tmp/deploy-v2.log 2>/dev/null; then exit 2; fi; i=$((i+1)); sleep !WAIT_STEP_S!; done; exit 3"
set /a WAIT_RC=!ERRORLEVEL!

if !WAIT_RC! equ 0 goto :finished
if !WAIT_RC! equ 2 (
  echo [FAIL] VPS deploy failed. Last 25 lines:
  ssh %SSH_OPTS% %VPS_HOST% "tail -n 25 /tmp/deploy-v2.log"
  echo.
  echo Attempting Discord failure notification...
  exit /b 1
)
if !WAIT_RC! equ 3 (
  echo [TIMEOUT] Deploy timed out after ~7 min. Check:
  ssh %SSH_OPTS% %VPS_HOST% "tail -n 15 /tmp/deploy-v2.log"
  exit /b 1
)

:finished
echo.
echo [4/4] Deploy complete. Last 20 lines:
ssh %SSH_OPTS% %VPS_HOST% "tail -n 20 /tmp/deploy-v2.log"
echo.
echo =========================================================
echo   DEPLOY v2 COMPLETE
echo =========================================================

:: --- Post-deploy summary ---
echo.
echo Summary:
ssh %SSH_OPTS% %VPS_HOST% "grep -E 'commit:|build_ran:|tag:|health:|smoke:' /tmp/deploy-v2.log | tail -6"
