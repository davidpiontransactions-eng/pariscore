@echo off
rem Lanceur serveur QA Pariscore - port 3210 + bypass auth matches + bypass plans (QA)
cd /d C:\Users\David\ZCodeProject\pariscore
set PORT=3210
set MATCHES_AUTH_BYPASS=1
set TENNIS_DEV_BYPASS=1
start "pariscore-qa" /b node server.js > qa-server2.log 2> qa-server2.err
exit /b 0
