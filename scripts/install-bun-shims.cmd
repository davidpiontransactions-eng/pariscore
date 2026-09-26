@echo off
REM ============================================================
REM install-bun-shims.cmd - Shims PATH pour le tool bash d'OpenCode
REM
REM CONTEXTE : le tool bash natif d'OpenCode (1.18.x, Windows)
REM ecrase le PATH du processus spawn avec UNIQUEMENT le bin
REM du runtime Bun (%USERPROFILE%\.bun\bin). Tant que le bug
REM upstream n'est pas corrige, node/git/npm/bd... y sont
REM introuvables ("'node' n'est pas reconnu...").
REM
REM FIX : des shims .cmd dans .bun\bin (seule entree PATH
REM garantie) pointant vers les vrais binaires en chemin
REM absolu. Ne change rien pour les terminaux normaux (le PATH
REM utilisateur resout les vrais binaires avant .bun\bin).
REM
REM Rejouable : relancer ce script apres tout deplacement
REM de Node/Git/Python. Machine-specifique : adaptez NODE_EXE,
REM GIT_EXE et PYTHON_EXE si les chemins changent.
REM ============================================================

setlocal enabledelayedexpansion

REM --- Binaires cibles (ADAPTER si installation deplacee) ---
set "NODE_EXE=E:\Program Files\nodejs\node.exe"
set "NPM_CLI=E:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"
set "NPX_CLI=E:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"
set "GIT_EXE=E:\Program Files\Git\cmd\git.exe"
set "PYTHON_EXE=C:\Python314\python.exe"
set "BD_JS=%APPDATA%\npm\node_modules\@beads\bd\bin\bd.js"

REM --- Verification d'existence (fail fast) ---
for %%F in ("%NODE_EXE%" "%NPM_CLI%" "%GIT_EXE%" "%BD_JS%") do (
  if not exist %%F (
    echo [ERREUR] Binaire introuvable : %%F
    echo           Adaptez les variables en tete de scripts\install-bun-shims.cmd
    exit /b 1
  )
)

set "BUNBIN=%USERPROFILE%\.bun\bin"
if not exist "%BUNBIN%" mkdir "%BUNBIN%"

REM --- Shims directs (chemin absolu du vrai binaire) ---
> "%BUNBIN%\node.cmd"        echo @"%NODE_EXE%" %%*
> "%BUNBIN%\npm.cmd"         echo @"%NODE_EXE%" "%NPM_CLI%" %%*
> "%BUNBIN%\npx.cmd"         echo @"%NODE_EXE%" "%NPX_CLI%" %%*
> "%BUNBIN%\git.cmd"         echo @"%GIT_EXE%" %%*
> "%BUNBIN%\bd.cmd"          echo @"%NODE_EXE%" "%BD_JS%" %%*
> "%BUNBIN%\python.cmd"      echo @"%PYTHON_EXE%" %%*
> "%BUNBIN%\findstr.cmd"     echo @"C:\Windows\System32\findstr.exe" %%*
> "%BUNBIN%\where.cmd"       echo @"C:\Windows\System32\where.exe" %%*
> "%BUNBIN%\reg.cmd"         echo @"C:\Windows\System32\reg.exe" %%*
> "%BUNBIN%\curl.cmd"        echo @"C:\Windows\System32\curl.exe" %%*
> "%BUNBIN%\tar.cmd"         echo @"C:\Windows\System32\tar.exe" %%*
> "%BUNBIN%\powershell.cmd"  echo @"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" %%*
> "%BUNBIN%\sqz.cmd"         echo @"%USERPROFILE%\.local\bin\sqz.exe" %%*

REM --- Shims deleguants (npm global = vrais .cmd qui resolvent node via PATH) ---
> "%BUNBIN%\graphify.cmd"    echo @call "%APPDATA%\npm\graphify.cmd" %%*
> "%BUNBIN%\graft.cmd"       echo @call "%APPDATA%\npm\graft.cmd" %%*
> "%BUNBIN%\codegraph.cmd"   echo @call "%APPDATA%\npm\codegraph.cmd" %%*

echo [OK] 16 shims ecrits dans %BUNBIN%
echo       Test : node --version ^&^& git --version ^&^& bd ready
endlocal
exit /b 0
