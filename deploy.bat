@echo off
cd /d "C:\Users\David\ZCodeProject\pariscore"

echo ========================================
echo   PariScore Deploy Script v2
echo ========================================
echo.
echo Usage:
echo   deploy.bat "message de commit"   - Full deploy (lint + typecheck + tests + build)
echo   deploy.bat --quick               - Quick deploy (skip lint/typecheck/tests)
echo   deploy.bat --no-commit           - Deploy already-pushed code
echo   deploy.bat --dry-run             - Show what would be deployed
echo.

:: Delegate to scripts/deploy-v2.bat (single entry point)
call scripts\deploy-v2.bat %*

echo.
echo === Done ===
