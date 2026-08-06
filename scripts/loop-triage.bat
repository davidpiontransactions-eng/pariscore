@echo off
REM ============================================================
REM PariScore — Daily Triage Loop (L1 report-only)
REM Windows Task Scheduler -> cmd /c scripts\loop-triage.bat
REM Semaine 1 : L1 report-only. Aucune modification de code.
REM ============================================================
setlocal
set "REPO=C:\Users\David\ZCodeProject\pariscore"
set "LOG=%REPO%\loop-run-log.md"
set "DATE_STAMP=%date% %time%"

cd /d "%REPO%"

echo ### [%DATE_STAMP%] triage start >> "%LOG%"

REM --- Triage : state + issues + git (lecture seule) ---
if exist STATE.md (
  type STATE.md >> "%LOG%"
) else (
  echo ERROR: STATE.md missing >> "%LOG%"
)

echo --- bd ready --- >> "%LOG%"
bd ready >> "%LOG%" 2>&1

echo --- git log (10) --- >> "%LOG%"
git log --oneline -10 >> "%LOG%" 2>&1

echo --- git status --- >> "%LOG%"
git status --porcelain >> "%LOG%" 2>&1

echo ### [%DATE_STAMP%] triage done >> "%LOG%"
endlocal
