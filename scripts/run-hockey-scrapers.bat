@echo off
setlocal EnableDelayedExpansion
REM === PROCEDURE DURE — scrapers hockey Ligue Magnus ===
REM Regles : stop-on-error, 2 retries Annabet (WAF rate-limit), log horodate.
REM Usage : scripts\run-hockey-scrapers.bat
cd /d "%~dp0.."
set "LOG=data\hockey-scrapers-run.log"
echo [%date% %time%] START > "%LOG%"

echo [1/3] BetExplorer (Playwright + age gate)
node scripts\scrape-betexplorer-hockey.mjs >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [FAIL] BetExplorer — voir %LOG%
  echo [%date% %time%] FAIL betexplorer >> "%LOG%"
  exit /b 1
)
if not exist data\hockey_prematch_betexplorer.json (
  echo [FAIL] sortie absente : hockey_prematch_betexplorer.json
  exit /b 1
)

echo [2/3] Annabet prematch (WAF — retries imposes)
set "ANNABET_OK=0"
for %%A in (1 2) do (
  if !ANNABET_OK! == 0 (
    node scripts\scrape-annabet-hockey-prematch.mjs >> "%LOG%" 2>&1
    if exist data\hockey_prematch_annabet.json set "ANNABET_OK=1"
    if !ANNABET_OK! == 0 (
      echo [RETRY %%A/2] Annabet — pause 30s (rate-limit)
      timeout /t 30 /nobreak >nul
    )
  )
)
if "%ANNABET_OK%" == "0" (
  echo [FAIL] Annabet apres 2 tentatives — voir %LOG%
  echo [%date% %time%] FAIL annabet >> "%LOG%"
  exit /b 1
)

echo [3/3] EliteProspects standings + players
node scripts\scrape-eliteprospects-hockey.mjs >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [WARN] EliteProspects KO — fichiers existants conserves
)

echo === VERIF SORTIE ===
dir data\hockey_prematch_betexplorer.json data\hockey_prematch_annabet.json data\eliteprospects_hockey_standings.json data\eliteprospects_player_stats.json
echo [%date% %time%] OK >> "%LOG%"
echo === DONE — log : %LOG% ===
exit /b 0
