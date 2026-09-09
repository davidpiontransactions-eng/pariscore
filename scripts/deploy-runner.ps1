# scripts/deploy-runner.ps1 - Agent-friendly VPS deploy for Cline/Cursor runners
#
# WHY THIS EXISTS:
#   The Cline runner cannot execute .bat files (PowerShell chokes on nested
#   cmd /c quoting) and kills any command after 30s. This script replaces the
#   manual SSH dance (scp -> tr -d '\r' -> nohup -> poll) with one entry point.
#
# Usage (human, interactive):
#   powershell -NoProfile -File scripts\deploy-runner.ps1 -Message "feat(x): y"
#   powershell -NoProfile -File scripts\deploy-runner.ps1 -Quick
#   powershell -NoProfile -File scripts\deploy-runner.ps1 -Quick -NoCommit
#
# Usage (agent, from the 30s-timeout runner):
#   # 1. Run gates + commit + push as separate short commands FIRST
#   # 2. Launch async (returns immediately):
#   Start-Process powershell -ArgumentList '-NoProfile','-File','scripts\deploy-runner.ps1','-Quick','-NoCommit','-Log','logs\deploy-run.log' -WindowStyle Hidden
#   # 3. Poll logs\deploy-run.log with short reads until 'DEPLOY-OK' or 'DEPLOY-FAIL'
#
# Params:
#   -Message <string>   Commit message (triggers git add/commit/push). Omit if already pushed.
#   -Quick              Skip lint/typecheck/tests gates.
#   -NoCommit           Skip git add/commit/push (deploy what is already pushed).
#   -Script <string>    Remote runner (default scripts\update_vps.sh)
#   -Log <string>       Log file path (default logs\deploy-runner-<ts>.log)
#   -TimeoutSec <int>   Poll timeout (default 720s)
#
# ASCII-only: PS 5.1 reads UTF-8 without BOM as ANSI (known pitfall, see AGENTS.md).

param(
  [string]$Message = "",
  [switch]$Quick,
  [switch]$NoCommit,
  [string]$Script = "scripts\update_vps.sh",
  [string]$Log = "",
  [int]$TimeoutSec = 720
)

$ErrorActionPreference = "Stop"
$VPS_HOST = "ubuntu@51.75.21.239"
$SSH_OPTS = "-o","BatchMode=yes","-o","ConnectTimeout=20"
$REMOTE_RAW = "/tmp/pariscore-deploy-raw.sh"
$REMOTE_SH  = "/tmp/pariscore-deploy.sh"
$REMOTE_LOG = "/tmp/pariscore-deploy.log"

if ($Log -eq "") {
  if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
  $Log = "logs\deploy-runner-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
}
Start-Transcript -Path $Log -Force | Out-Null

try {

  # --- 0. Pre-flight: branch, clean tree, divergence ---
  $branch = git rev-parse --abbrev-ref HEAD
  if ($branch -ne "main") { throw "DEPLOY-FAIL: branch is '$branch', must be 'main'" }

  if (-not $NoCommit) {
    $dirty = git status --porcelain
    if ($dirty) {
      if ($Message -eq "") { throw "DEPLOY-FAIL: dirty tree but no -Message given. Commit first or use -NoCommit." }
      Write-Host "[1/6] git add -u + commit + push..."
      git add -u
      git commit -m $Message
      if ($LASTEXITCODE -gt 1) { throw "DEPLOY-FAIL: git commit" }
    } elseif ($Message -ne "") {
      Write-Host "[1/6] Tree clean - nothing to commit (message ignored)."
    }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: git push (pull --rebase first?)" }
  } else {
    Write-Host "[1/6] -NoCommit: skip git. Verifying we are not behind origin..."
    git fetch origin main --quiet
    $behind = git rev-list --count HEAD..origin/main
    if ([int]$behind -gt 0) { throw "DEPLOY-FAIL: local HEAD is $behind commit(s) behind origin/main" }
  }
  $HEAD = git rev-parse --short HEAD
  Write-Host "  HEAD = $HEAD"

  # --- 1. Quality gates (skippable) ---
  if (-not $Quick) {
    Write-Host "[2/6] Gates: lint..."
    bun run lint
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: lint" }
    Write-Host "[2/6] Gates: typecheck..."
    bun run typecheck
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: typecheck" }
    Write-Host "[2/6] Gates: tests..."
    bun run test
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: tests" }
  } else {
    Write-Host "[2/6] Gates skipped (-Quick)"
  }

  # --- 2. Stream script to VPS (scp, then clean CRLF + chmod via SSH) ---
  Write-Host "[3/6] scp $Script -> $REMOTE_RAW ..."
  scp @SSH_OPTS -q $Script "${VPS_HOST}:${REMOTE_RAW}"
  if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: scp" }
  ssh @SSH_OPTS $VPS_HOST "tr -d '\r' < $REMOTE_RAW > $REMOTE_SH; chmod +x $REMOTE_SH"
  if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: ssh clean" }

  # --- 3. Launch async on VPS (nohup; survives SSH disconnect) ---
  Write-Host "[4/6] Launch remote deploy (nohup)..."
  ssh @SSH_OPTS $VPS_HOST "rm -f $REMOTE_LOG; { nohup bash $REMOTE_SH > $REMOTE_LOG 2>&1 < /dev/null & }; echo LAUNCHED"
  if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: ssh launch" }

  # --- 4. Poll every 10s until VPS_DEPLOY_OK or ERR: ---
  Write-Host "[5/6] Polling $REMOTE_LOG (timeout ${TimeoutSec}s)..."
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $started = Get-Date
  $status = "timeout"
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    $out = ssh @SSH_OPTS $VPS_HOST "grep -c 'VPS_DEPLOY_OK' $REMOTE_LOG 2>/dev/null; grep -E '^ERR:' $REMOTE_LOG 2>/dev/null | tail -3"
    if ($LASTEXITCODE -eq 255) { Write-Host "  ssh transient error - retry"; continue }
    if ($out) {
      $lines = @($out -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
      $okCount = 0; $errs = @()
      foreach ($l in $lines) {
        if ($l -match '^\d+$') { $okCount = [int]$l }
        elseif ($l -like "ERR:*") { $errs += $l }
      }
      if ($errs.Count -gt 0) { $status = "fail"; Write-Host "  ERR: $($errs -join ' | ')"; break }
      if ($okCount -gt 0) { $status = "ok"; break }
    }
    $elapsed = [int]((Get-Date) - $started).TotalSeconds
    Write-Host "  ...running (${elapsed}s elapsed)"
  }

  # --- 5. Report ---
  Write-Host "[6/6] Result: $status"
  ssh @SSH_OPTS $VPS_HOST "tail -n 15 $REMOTE_LOG"
  if ($status -eq "ok") {
    Write-Host ""
    Write-Host "DEPLOY-OK: $HEAD deployed to VPS"
    exit 0
  } else {
    Write-Host ""
    Write-Host "DEPLOY-FAIL: status=$status (see $Log and $REMOTE_LOG on VPS)"
    exit 1
  }

} finally {
  Stop-Transcript | Out-Null
}
