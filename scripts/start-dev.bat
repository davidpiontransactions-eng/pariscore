@echo off
REM Lance Next dev via node.exe (bun hors PATH de la couche agent) + log.
cd /d "%~dp0.."
set "PATH=%PATH%;E:\Program Files\nodejs"
node node_modules\next\dist\bin\next dev -p 3000 > data\dev-server.log 2>&1
