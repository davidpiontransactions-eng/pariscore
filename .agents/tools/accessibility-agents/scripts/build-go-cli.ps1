$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$GoCliRoot = Join-Path $RepoRoot "go-cli"
$OutputRoot = Join-Path $GoCliRoot "bin"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "Go is not installed or not on PATH. Install Go 1.23+ and rerun this script."
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$targets = @(
    @{ Name = "setup"; Output = "a11y-agents-setup.exe"; Package = "./cmd/setup" },
    @{ Name = "health"; Output = "a11y-agents-health.exe"; Package = "./cmd/health" },
    @{ Name = "repair"; Output = "a11y-agents-repair.exe"; Package = "./cmd/repair" },
    @{ Name = "hooks"; Output = "a11y-agents-hooks.exe"; Package = "./cmd/hooks" }
)

Push-Location $GoCliRoot
try {
    foreach ($target in $targets) {
        $outputPath = Join-Path $OutputRoot $target.Output
        Write-Host "Building $($target.Name) -> $outputPath"
        & go build -o $outputPath $target.Package
        if ($LASTEXITCODE -ne 0) {
            throw "go build failed for $($target.Name)"
        }
    }
}
finally {
    Pop-Location
}

Write-Host "Build complete. Binaries are in $OutputRoot"