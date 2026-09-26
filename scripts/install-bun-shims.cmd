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
REM FIX v2 (2026-09-26, bead ParisScorebis-gtft) : chaque shim
REM commence par un BOOTSTRAP PATH qui prepends les vrais dirs
REM de binaires. Tout processus enfant (dolt/Go os/exec qui
REM spawn "git", npm scripts, hooks git, go/rust tools...)
REM herite ainsi de VRAIS .exe — les shims .cmd ne suffisent
REM pas : os/exec de Go resout git.cmd mais echoue (exit 3).
REM Preuve differentielle : vrai git.exe en PATH -> bd dolt
REM push OK. Les shims ne servent plus qu'au premier hop.
REM
REM Ne change rien pour les terminaux normaux (le PATH
REM utilisateur resout deja les vrais binaires avant .bun\bin).
REM
REM Rejouable : relancer ce script apres tout deplacement
REM de Node/Git/Python. Machine-specifique : adaptez les
REM variables ci-dessous si les chemins changent.
REM ============================================================

setlocal enabledelayedexpansion

REM --- Binaires cibles (ADAPTER si installation deplacee) ---
set "NODE_EXE=E:\Program Files\nodejs\node.exe"
set "NPM_CLI=E:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"
set "NPX_CLI=E:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"
set "GIT_EXE=E:\Program Files\Git\cmd\git.exe"
set "PYTHON_EXE=C:\Python314\python.exe"
set "BD_JS=%APPDATA%\npm\node_modules\@beads\bd\bin\bd.js"

REM --- Bootstrap PATH embarque dans chaque shim (vrais dirs d'abord) ---
set "BOOTPATH=E:\Program Files\Git\cmd;E:\Program Files\nodejs;C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Python314;%APPDATA%\npm;%USERPROFILE%\.local\bin;%USERPROFILE%\.bun\bin"

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

REM --- Shims : ligne 1 = bootstrap PATH, ligne 2 = vrai binaire en absolu ---
> "%BUNBIN%\node.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%NODE_EXE%" %%*
)
> "%BUNBIN%\npm.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%NODE_EXE%" "%NPM_CLI%" %%*
)
> "%BUNBIN%\npx.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%NODE_EXE%" "%NPX_CLI%" %%*
)
> "%BUNBIN%\git.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%GIT_EXE%" %%*
)
> "%BUNBIN%\bd.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%NODE_EXE%" "%BD_JS%" %%*
)
> "%BUNBIN%\python.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%PYTHON_EXE%" %%*
)
> "%BUNBIN%\findstr.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"C:\Windows\System32\findstr.exe" %%*
)
> "%BUNBIN%\where.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"C:\Windows\System32\where.exe" %%*
)
> "%BUNBIN%\reg.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"C:\Windows\System32\reg.exe" %%*
)
> "%BUNBIN%\curl.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"C:\Windows\System32\curl.exe" %%*
)
> "%BUNBIN%\tar.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"C:\Windows\System32\tar.exe" %%*
)
> "%BUNBIN%\powershell.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" %%*
)
> "%BUNBIN%\sqz.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @"%USERPROFILE%\.local\bin\sqz.exe" %%*
)

REM --- Shims deleguants (npm global : le vrai .cmd resout node via PATH bootstrap) ---
> "%BUNBIN%\graphify.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @call "%APPDATA%\npm\graphify.cmd" %%*
)
> "%BUNBIN%\graft.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @call "%APPDATA%\npm\graft.cmd" %%*
)
> "%BUNBIN%\codegraph.cmd" (
  echo @set "PATH=%BOOTPATH%;%%PATH%%"
  echo @call "%APPDATA%\npm\codegraph.cmd" %%*
)

echo [OK] 16 shims v2 (bootstrap PATH) ecrits dans %BUNBIN%
echo       Test : node --version ^&^& bd dolt push ^&^& git --version
endlocal
exit /b 0
