# sync-pariscore.ps1
# Surveille le dossier Téléchargements et copie automatiquement
# les fichiers PariScore vers le dossier de travail.
#
# Utilisation : double-clic sur run-sync-pariscore.cmd
#              ou PowerShell -NoProfile -ExecutionPolicy Bypass -File .\sync-pariscore.ps1

$destination = "C:\Users\david\Documents\dev PariScore\ParisScorebis"
$downloads   = "$env:USERPROFILE\Downloads"

$tracked = @(
    "pariscore.html",
    "server.js",
    "admin.html",
    "render.yaml",
    "CHANGELOG.md",
    "CLAUDE.md",
    "AUDIT.md",
    "database.json",
    "history.json"
)

Write-Host ""
Write-Host "  PariScore Sync" -ForegroundColor Cyan
Write-Host "  Source      : $downloads" -ForegroundColor Gray
Write-Host "  Destination : $destination" -ForegroundColor Gray
Write-Host "  Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""

if (!(Test-Path $destination)) {
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Write-Host "  Dossier cree : $destination" -ForegroundColor Yellow
}

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path                  = $downloads
$watcher.Filter                = "*.*"
$watcher.NotifyFilter          = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::LastWrite
$watcher.EnableRaisingEvents   = $true
$watcher.IncludeSubdirectories = $false

Write-Host "  En attente de fichiers PariScore..." -ForegroundColor Green
Write-Host ""

while ($true) {
    $result = $watcher.WaitForChanged(
        [System.IO.WatcherChangeTypes]::Created -bor [System.IO.WatcherChangeTypes]::Changed,
        2000
    )

    if (-not $result.TimedOut) {
        $name = $result.Name
        $full = Join-Path $downloads $name

        if ($tracked -contains $name) {
            Start-Sleep -Milliseconds 800
            $dest = Join-Path $destination $name
            if (Test-Path $full) {
                try {
                    Copy-Item -Path $full -Destination $dest -Force
                    Remove-Item -Path $full -Force
                    $time = Get-Date -Format "HH:mm:ss"
                    Write-Host "  [$time] OK  $name (copie et suppression)" -ForegroundColor Green
                } catch {
                    $time = Get-Date -Format "HH:mm:ss"
                    Write-Host "  [$time] ERREUR $name : $_" -ForegroundColor Red
                }
            }
        }
    }
}
