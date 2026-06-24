<#
.SYNOPSIS
    Push 1xBet MMA odds data to VPS OVH
.DESCRIPTION
    Scrape les cotes 1xBet (VPN Serbie requis), puis scp le JSON vers le VPS.
    Usage: .\push-odds-1xbet.ps1           # scrape + push
           .\push-odds-1xbet.ps1 -Force    # ignore cache 5min
           .\push-odds-1xbet.ps1 -DryRun   # test sans copier
#>
param([switch]$Force,[switch]$DryRun)

$ErrorActionPreference = "Stop"
$SSH_TARGET = "pariscore"
$REMOTE_DIR = "/home/ubuntu/pariscore/data"
$LOCAL_BASE = "C:\Users\david\Documents\dev PariScore\ParisScorebis"
$SCRAPER   = "$LOCAL_BASE\tools\scrape_1xbet_mma.py"
$JSON_FILE = "$LOCAL_BASE\data\odds_1xbet_mma.json"
$SSH_CFG   = "$env:USERPROFILE\.ssh\config"

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "   OK $m" -ForegroundColor Green }
function Die($m)  { Write-Host "   ERR $m" -ForegroundColor Red; exit 1 }

Write-Host "=== PariScore -> Push cotes 1xBet MMA vers VPS OVH ===" -ForegroundColor White

Step "1/3 : Scrape des cotes 1xBet (VPN Serbie requis)..."
$args = @()
if ($Force) { $args += "--force" }
$result = python $SCRAPER @args 2>&1
if ($LASTEXITCODE -ne 0) { Die "Scraper echoue : $result" }
Write-Host $result
if (-not (Test-Path $JSON_FILE)) { Die "JSON introuvable: $JSON_FILE" }
$size = (Get-Item $JSON_FILE).Length
Ok "Fichier $size bytes pret"

Step "2/3 : Connexion SSH au VPS..."
$remoteTarget = "${SSH_TARGET}"
$ok = ssh -F $SSH_CFG $remoteTarget "mkdir -p $REMOTE_DIR && echo CONNECT_OK" 2>&1
if ($LASTEXITCODE -ne 0) { Die "SSH impossible : $ok" }
Write-Host $ok
Ok "VPS atteint, dossier cree"

Step "3/3 : Transfert du JSON vers le VPS..."
$remotePath = "${SSH_TARGET}:${REMOTE_DIR}/"
if ($DryRun) {
    Write-Host "   [DRY-RUN] scp $JSON_FILE -> $remotePath"
} else {
    $result = scp -F $SSH_CFG "$JSON_FILE" $remotePath 2>&1
    if ($LASTEXITCODE -ne 0) { Die "scp echoue : $result" }
    Write-Host $result
    Ok "Fichier transfere"
}

Write-Host "`n=== Fini. Cotes MMA 1xBet poussees sur VPS. ===" -ForegroundColor White
