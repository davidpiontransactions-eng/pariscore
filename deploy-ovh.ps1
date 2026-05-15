# deploy-ovh.ps1 - Transfert auto PariScore vers VPS OVH + restart PM2
#
# Usage :
#   .\deploy-ovh.ps1                 # deploy server.js + pariscore.html (defaut)
#   .\deploy-ovh.ps1 -Files a.js,b.js
#   .\deploy-ovh.ps1 -All            # deploy tous fichiers suivis git (hors .env/db/logs)
#   .\deploy-ovh.ps1 -NoBackup       # skip backup distant (.env/db)
#   .\deploy-ovh.ps1 -NpmInstall     # npm install --production avant restart (si deps changees)

param(
    [string[]]$Files = @('server.js', 'pariscore.html'),
    [switch]$All,
    [switch]$NoBackup,
    [switch]$NpmInstall
)

$ErrorActionPreference = 'Stop'

$VPS_USER   = 'ubuntu'
$VPS_HOST   = '51.75.21.239'
$REMOTE_DIR = '/home/ubuntu/pariscore'
$LOCAL_DIR  = $PSScriptRoot
$TARGET     = "$VPS_USER@$VPS_HOST"

function Step($msg) { Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   OK $msg" -ForegroundColor Green }
function Die($msg)  { Write-Host "   ERREUR $msg" -ForegroundColor Red; exit 1 }

Write-Host "=== PariScore -> OVH ($TARGET) ===" -ForegroundColor White

# 0. Pre-checks
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { Die "ssh introuvable (installer OpenSSH client Windows)" }
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) { Die "scp introuvable" }

Step "Test connexion SSH"
ssh -o ConnectTimeout=10 -o BatchMode=yes $TARGET "echo ok" *> $null
if ($LASTEXITCODE -ne 0) { Die "SSH KO (cle non autorisee ou VPS injoignable). Verifier: ssh $TARGET" }
Ok "SSH joignable"

# 1. Liste des fichiers a transferer
if ($All) {
    Push-Location $LOCAL_DIR
    $list = git ls-files | Where-Object { $_ -notmatch '(^|/)\.(env|git)' -and $_ -notmatch '\.(db|log|sqlite)$' -and $_ -notmatch '^node_modules/' }
    Pop-Location
    $Files = $list
}
if (-not $Files -or $Files.Count -eq 0) { Die "Aucun fichier a transferer" }
foreach ($f in $Files) {
    if (-not (Test-Path (Join-Path $LOCAL_DIR $f))) { Die "Fichier local manquant: $f" }
}
Step "Fichiers ($($Files.Count))"
$Files | ForEach-Object { Write-Host "   - $_" }

# 2. Backup distant des donnees critiques (.env + base SQLite)
if (-not $NoBackup) {
    Step "Backup distant .env + pariscore.db"
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bk = "cd $REMOTE_DIR && mkdir -p .deploy-backups && " +
          "([ -f .env ] && cp .env .deploy-backups/.env.$stamp || true) && " +
          "([ -f pariscore.db ] && cp pariscore.db .deploy-backups/pariscore.db.$stamp || true) && " +
          "ls -1 .deploy-backups | tail -4"
    ssh $TARGET $bk
    if ($LASTEXITCODE -ne 0) { Die "Backup distant echoue" }
    Ok "Backup -> $REMOTE_DIR/.deploy-backups/ (suffixe $stamp)"
}

# 3. Transfert SCP
Step "Transfert SCP"
foreach ($f in $Files) {
    $local  = Join-Path $LOCAL_DIR $f
    $remote = "${TARGET}:$REMOTE_DIR/$f"
    # Cree les sous-dossiers distants si chemin imbrique
    $dir = Split-Path $f -Parent
    if ($dir) { ssh $TARGET "mkdir -p '$REMOTE_DIR/$($dir -replace '\\','/')'" *> $null }
    scp -q $local $remote
    if ($LASTEXITCODE -ne 0) { Die "SCP echoue: $f" }
    Write-Host "   sent $f" -ForegroundColor Green
}
Ok "Transfert termine"

# 4. npm install optionnel
if ($NpmInstall) {
    Step "npm install --production (distant)"
    ssh $TARGET "cd $REMOTE_DIR && npm install --production"
    if ($LASTEXITCODE -ne 0) { Die "npm install distant echoue" }
    Ok "Dependances installees"
}

# 5. Restart PM2
Step "Restart PM2 (pariscore)"
ssh $TARGET "cd $REMOTE_DIR && pm2 restart pariscore --update-env || pm2 start ecosystem.config.js"
if ($LASTEXITCODE -ne 0) { Die "PM2 restart echoue" }
Ok "PM2 relance"

# 6. Verification health
Step "Verification /api/v1/status"
Start-Sleep -Seconds 4
$status = ssh $TARGET "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/status"
if ($status -eq '200') {
    Ok "Serveur UP (HTTP 200)"
} else {
    Write-Host "   ATTENTION status HTTP=$status — verifier: ssh $TARGET 'pm2 logs pariscore --lines 40'" -ForegroundColor Yellow
}

Write-Host "`n=== Deploy OVH termine ===" -ForegroundColor White
