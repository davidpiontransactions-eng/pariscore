<#
.SYNOPSIS
    Synchronise le vault Obsidian PariScore depuis GitHub
.DESCRIPTION
    Pull les dernières notes générées par le VPS (cron daily)
    et les rend disponibles dans Obsidian.
.PARAMETER Remote
    URL du remote GitHub (défaut : celui configuré dans le repo)
.EXAMPLE
    .\scripts\sync-vault-from-pc.ps1
#>

$VaultPath = "C:\Users\david\Documents\PariScore-vault"

if (-not (Test-Path $VaultPath)) {
    Write-Host "❌ Vault introuvable : $VaultPath" -ForegroundColor Red
    exit 1
}

Set-Location $VaultPath

# Check if remote is configured
$remote = git remote -v 2>$null
if (-not $remote) {
    Write-Host "⚠️  Aucun remote GitHub configuré." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour configurer :"
    Write-Host "  git remote add origin https://github.com/votre-compte/PariScore-vault.git"
    Write-Host "  git push -u origin main"
    exit 1
}

# Pull latest notes
Write-Host "📥 Synchronisation du vault..." -ForegroundColor Cyan
$result = git pull origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    $noteCount = (Get-ChildItem -Recurse -Filter "*.md" | Measure-Object).Count
    $todayNote = "daily\$(Get-Date -Format 'yyyy-MM-dd').md"
    
    Write-Host "✅ Vault synchronisé !" -ForegroundColor Green
    Write-Host "📝 $noteCount notes dans le vault" -ForegroundColor Cyan
    
    if (Test-Path $todayNote) {
        Write-Host "📋 Note du jour disponible : daily/$(Get-Date -Format 'yyyy-MM-dd').md" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Erreur de synchronisation :" -ForegroundColor Red
    Write-Host $result
    exit 1
}
