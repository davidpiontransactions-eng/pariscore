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
#
# 2026-10-03 - DEUX DEFAUTS CORRIGES (le runner seemedait bloque sans raison) :
#   1. `Start-Transcript` BUFFERISE. Un deploy de 4 min laissait le log fige a
#      "...running (12s elapsed)" pendant toute la session : l'agent lisait un
#      fichier perime et concluait a un blocage. Le transcript PS ecrit par
#      blocs, il n'est donc pas adapte a un polling fichier par l'exterieur.
#      Remplace par `Log` : une ligne ecrite et **flush immediat** dans le
#      fichier a chaque evenement.
#   2. **Aucun verrou**. Deux runners lances en parallele se marchaient dessus
#      sur le meme fichier de log (le second echappait au premier qui le
#      detenait), et les deux poussaient en meme temps. Ajout d'un lock file
#      avec PID : un second lancement echoue proprement au lieu de corrompre.

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
# `ConnectTimeout` ne couvre QUE la connexion TCP. Si le VPS accepte la
# connexion puis ne repond plus (il sature pendant `next build`), `ssh` peut
# rester bloque indefiniment : la boucle de polling s'arrete, plus aucune ligne
# n'est ecrite dans le log — exactement le symptome qu'on essayait de supprimer.
# `ServerAliveInterval` + `ServerAliveCountMax` font tomber la connexion au bout
# de ~30 s sans reponse, et le poll reprend.
$SSH_OPTS = "-o","BatchMode=yes","-o","ConnectTimeout=20","-o","ServerAliveInterval=15","-o","ServerAliveCountMax=2"
$REMOTE_RAW = "/tmp/pariscore-deploy-raw.sh"
$REMOTE_SH  = "/tmp/pariscore-deploy.sh"
$REMOTE_LOG = "/tmp/pariscore-deploy.log"
$LOCK_FILE = "logs\.deploy-runner.lock"

if ($Log -eq "") {
  if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
  $Log = "logs\deploy-runner-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
}

# --- Log immediat : une ligne par ecriture, pas de buffer ---
$script:LogPath = $Log
function Log([string]$line) {
  Add-Content -Path $script:LogPath -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $line) -Encoding UTF8
}

# --- Verrou : un seul deploy a la fois ---
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
if (Test-Path $LOCK_FILE) {
  $ownerPid = (Get-Content $LOCK_FILE -ErrorAction SilentlyContinue | Select-Object -First 1)
  $alive = $false
  if ($ownerPid -and $ownerPid -match '^\d+$') {
    $proc = Get-Process -Id ([int]$ownerPid) -ErrorAction SilentlyContinue
    if ($proc) { $alive = $true }
  }
  if ($alive) {
    Log "DEPLOY-FAIL: un deploy-runner est deja actif (PID $ownerPid). Attendre sa fin ou supprimer $LOCK_FILE s'il est mort."
    exit 1
  }
  Log "verrou perime (PID $ownerPid inactif) - je le reprends"
}
Set-Content -Path $LOCK_FILE -Value "$PID" -Encoding ASCII

Log "======================================================"
Log "deploy-runner.ps1 - PID $PID"
Log "script=$Script quick=$Quick nocommit=$NoCommit timeout=${TimeoutSec}s"
Log "======================================================"

try {

  # --- 0. Pre-flight: branch, clean tree, divergence ---
  $branch = git rev-parse --abbrev-ref HEAD
  if ($branch -ne "main") { throw "DEPLOY-FAIL: branch is '$branch', must be 'main'" }

  if (-not $NoCommit) {
    $dirty = git status --porcelain
    if ($dirty) {
      if ($Message -eq "") { throw "DEPLOY-FAIL: dirty tree but no -Message given. Commit first or use -NoCommit." }
      Log "[1/6] git add -u + commit + push..."
      git add -u
      git commit -m $Message
      if ($LASTEXITCODE -gt 1) { throw "DEPLOY-FAIL: git commit" }
    } elseif ($Message -ne "") {
      Log "[1/6] Tree clean - nothing to commit (message ignored)."
    }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: git push (pull --rebase first?)" }
  } else {
    Log "[1/6] -NoCommit: skip git. Verifying we are not behind origin..."
    git fetch origin main --quiet
    $behind = git rev-list --count HEAD..origin/main
    if ([int]$behind -gt 0) { throw "DEPLOY-FAIL: local HEAD is $behind commit(s) behind origin/main" }
  }
  $HEAD = git rev-parse --short HEAD
  Log "  HEAD = $HEAD"

  # --- 1. Quality gates (skippable) ---
  if (-not $Quick) {
    Log "[2/6] Gates: lint..."
    bun run lint
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: lint" }
    Log "[2/6] Gates: typecheck..."
    bun run typecheck
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: typecheck" }
    Log "[2/6] Gates: tests..."
    bun run test
    if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: tests" }
  } else {
    Log "[2/6] Gates skipped (-Quick)"
  }

  # --- 2. Stream script to VPS (scp, then clean CRLF + chmod via SSH) ---
  Log "[3/6] scp $Script -> $REMOTE_RAW ..."
  scp @SSH_OPTS -q $Script "${VPS_HOST}:${REMOTE_RAW}"
  if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: scp" }
  ssh @SSH_OPTS $VPS_HOST "tr -d '\r' < $REMOTE_RAW > $REMOTE_SH; chmod +x $REMOTE_SH"
  if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: ssh clean" }

  # --- 3. Launch async on VPS (nohup; survives SSH disconnect) ---
  Log "[4/6] Launch remote deploy (nohup)..."
  ssh @SSH_OPTS $VPS_HOST "rm -f $REMOTE_LOG; { nohup bash $REMOTE_SH > $REMOTE_LOG 2>&1 < /dev/null & }; echo LAUNCHED"
  if ($LASTEXITCODE -ne 0) { throw "DEPLOY-FAIL: ssh launch" }

  # --- 4. Poll every 10s until VPS_DEPLOY_OK or ERR: ---
  Log "[5/6] Polling $REMOTE_LOG (timeout ${TimeoutSec}s)..."
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $started = Get-Date
  $status = "timeout"
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    $out = ssh @SSH_OPTS $VPS_HOST "grep -c 'VPS_DEPLOY_OK' $REMOTE_LOG 2>/dev/null; grep -E '^ERR:' $REMOTE_LOG 2>/dev/null | tail -3"
    if ($LASTEXITCODE -eq 255) { Log "  ssh transient error - retry"; continue }
    if ($out) {
      $lines = @($out -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
      $okCount = 0; $errs = @()
      foreach ($l in $lines) {
        if ($l -match '^\d+$') { $okCount = [int]$l }
        elseif ($l -like "ERR:*") { $errs += $l }
      }
      if ($errs.Count -gt 0) { $status = "fail"; Log "  ERR: $($errs -join ' | ')"; break }
      if ($okCount -gt 0) { $status = "ok"; break }
    }
    $elapsed = [int]((Get-Date) - $started).TotalSeconds
    # On loggue aussi la derniere ligne du log distant : sans ca, un agent qui
    # poll le fichier local ne voit RIEN de ce qui se passe cote VPS.
    $tail = ssh @SSH_OPTS $VPS_HOST "tail -n 1 $REMOTE_LOG 2>/dev/null | tr -d '\r'"
    $tail = ($tail | Select-Object -Last 1)
    if ($tail) { $tail = $tail.Substring(0, [Math]::Min(110, $tail.Length)) }
    Log "  ...running (${elapsed}s) ${tail}"
  }

  # --- 5. Report ---
  Log "[6/6] Result: $status"
  $summary = ssh @SSH_OPTS $VPS_HOST "tail -n 15 $REMOTE_LOG"
  foreach ($l in @($summary)) { if ($l.Trim() -ne "") { Log "  | $($l.Trim())" } }
  if ($status -eq "ok") {
    Log ""
    Log "DEPLOY-OK: $HEAD deployed to VPS"
    $code = 0
  } else {
    Log ""
    Log "DEPLOY-FAIL: status=$status (see $Log and $REMOTE_LOG on VPS)"
    $code = 1
  }

} catch {
  Log ""
  Log $_.Exception.Message
  $code = 1
} finally {
  Remove-Item -Path $LOCK_FILE -Force -ErrorAction SilentlyContinue
  Log "======================================================"
  Log "deploy-runner.ps1 end (exit $code)"
}

exit $code