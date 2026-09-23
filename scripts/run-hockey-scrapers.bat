@echo off
setlocal EnableDelayedExpansion
REM === PROCEDURE DURE — scrapers hockey Ligue Magnus ===
REM Console = sortie live. Log = recap. Stop-on-error, 2 retries Annabet.
cd /d "%~dp0.."
set "LOG=data\hockey-scrapers-run.log"
echo [%date% %time%] START > "%LOG%"

echo [1/4] Oddspedia Magnus D'ABORD (source prioritaire calendrier)
node scripts\scrape-oddspedia-hockey.mjs --league=magnus
if errorlevel 1 echo [WARN] Oddspedia magnus KO

echo [2/4] Annabet Magnus (h2h/odds)
node scripts\scrape-annabet-hockey-prematch.mjs --league=magnus
if errorlevel 1 echo [WARN] Annabet magnus KO
timeout /t 15 /nobreak >nul

echo [3/4] Oddspedia + Annabet reste (nhl + khl)
node scripts\scrape-oddspedia-hockey.mjs
node scripts\scrape-annabet-hockey-prematch.mjs
if errorlevel 1 echo [WARN] Annabet reste KO

echo [4/4] BetExplorer + EliteProspects
node scripts\scrape-betexplorer-hockey.mjs
if errorlevel 1 echo [WARN] BetExplorer KO
node scripts\scrape-eliteprospects-hockey.mjs
if errorlevel 1 echo [WARN] EliteProspects standings KO
node scripts\scrape-eliteprospects-player-stats.mjs
if errorlevel 1 echo [WARN] EliteProspects players KO

echo === VERIF SORTIE ===
dir data\hockey_prematch_betexplorer.json data\hockey_prematch_annabet.json data\eliteprospects_hockey_standings.json data\eliteprospects_player_stats.json
echo [%date% %time%] OK >> "%LOG%"
echo === DONE ===
exit /b 0
