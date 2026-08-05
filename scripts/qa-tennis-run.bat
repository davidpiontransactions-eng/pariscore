@echo off
rem Runner QA tennis robuste — gère la vie du serveur dev sans orphelins.
rem 1. Tue tout process écoutant sur :3000 (forks orphelins de runs précédents)
rem 2. Lance bun run dev en arrière-plan (log: dev_server.log)
rem 3. Attend la réponse HTTP (curl retry)
rem 4. Exécute le script Playwright
rem 5. Tue l'arbre du serveur (taskkill /t)

cd /d "C:\Users\David\ZCodeProject\pariscore"

echo [1/5] Nettoyage du port 3000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo   killing PID %%p
  taskkill /pid %%p /f /t >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/5] Lancement de bun run dev...
del /q dev_server.log 2>nul
start "pariscore-dev" /b cmd /c "bun run dev > dev_server.log 2>&1"

echo [3/5] Attente du serveur HTTP (max 150s)...
set /a tries=0
:waitloop
timeout /t 5 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/ > http_probe.txt 2>nul
set /p probe=<http_probe.txt
if "%probe%"=="200" goto ready
set /a tries+=1
if %tries% geq 30 goto fail
goto waitloop

:ready
echo   serveur pret (HTTP 200)
echo [4/5] Execution du QA Playwright...
set PYTHONIOENCODING=utf-8
python qa_tennis.py > qa_tennis_report.md 2>&1
set /a rc=%errorlevel%

echo [5/5] Arret du serveur...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo   killing PID %%p
  taskkill /pid %%p /f /t >nul 2>&1
)
del /q http_probe.txt 2>nul
echo QA exit code: %rc%
exit /b %rc%

:fail
echo ERREUR : serveur pas pret apres 150s
type dev_server.log
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /pid %%p /f /t >nul 2>&1
exit /b 2
