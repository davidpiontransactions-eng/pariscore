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
# n'est ecrite dans le log, exactement le symptome qu'on essayait de supprimer.
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
# Le rafraichissement du verrou ici est ce qui PERMET la detection d'obsolescence
# plus bas : sans lui, `LastWriteTime` resterait fige a la creation et le verrou
# serait declare perime au bout de $LockStaleMin alors que le deploy tourne.
$script:LogPath = $Log
$script:LockFile = $LOCK_FILE
function Log([string]$line) {
  Add-Content -Path $script:LogPath -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $line) -Encoding UTF8
  if (Test-Path $script:LockFile) {
    try { (Get-Item $script:LockFile).LastWriteTime = Get-Date } catch {}
  }
}

# --- Verrou : un seul deploy a la fois, mais JAMAIS indefiniment ---
# Le 2026-10-05, un runner deploy DUSINE VERIFIEE (VPS_DEPLOY_OK cote remote,
# health check OK) est reste vivant 40 min avec 1,56 s de CPU et son verrou a
# bloque tout deploy suivant ("un deploy-runner est deja actif"). Cause exacte
# non etablie (le process fut tue avant inspection). Mais le defaut qui compte
# est connu : un runner bloque = point de blockage manuel pour l'agent suivant.
#
# D'ou la detection par OBSOLESCENCE : le verrou est rafraichi a chaque ecriture
# de log ; s'il n'a pas bouge depuis $LockStaleMin minutes, il est perime meme si
# le PID existe encore. On le reprend en le loguant, jamais en silence.
$LockStaleMin = 20

if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

# L'ordre EST IMPORTANT : on teste le verrou du precedents AVANT d'ecrire le
# notre, sinon `LastWriteTime` designe notre propre ecriture et la detection
# d'obsolescence verrait toujours un verrou neuf, elle ne declencherait donc
# jamais.
if (Test-Path $LOCK_FILE) {
  $ownerPid = (Get-Content $LOCK_FILE -ErrorAction SilentlyContinue | Select-Object -First 1)
  $alive = $false
  if ($ownerPid -and $ownerPid -match '^\d+$') {
    $proc = Get-Process -Id ([int]$ownerPid) -ErrorAction SilentlyContinue
    if ($proc) { $alive = $true }
  }
  $lockAgeMin = [int]((Get-Date) - (Get-Item $LOCK_FILE).LastWriteTime).TotalMinutes
  if ($alive -and $lockAgeMin -lt $LockStaleMin) {
    Log "DEPLOY-FAIL: un deploy-runner est deja actif (PID $ownerPid, verrou fraichement pose il y a ${lockAgeMin} min). Attendre sa fin."
    exit 1
  }
  if ($alive) {
    Log "verrou OBSOLETE : PID $ownerPid est vivant mais son verrou n'a pas bouge depuis ${lockAgeMin} min (seuil $LockStaleMin). Je le reprends, le runner precedent est bloque."
  } else {
    Log "verrou perime (PID $ownerPid inactif) - je le reprends"
  }
}
Set-Content -Path $LOCK_FILE -Value "$PID" -Encoding ASCII

# ── Timeout par commande (incident #223) ────────────────────────────────────
# Les appels `scp` / `ssh` directs (lignes 170-178 de l'ancienne version)
# pendaient INDEFINIMENT quand le processus enfant n'etait pas draine : le
# deploy figeait a l'etape [3/6] scp, sans message, et le verrou restait pose
# (le run suivant le declarait "OBSOLETE"). `Start-Process -Wait` sans
# `WaitForExit(timeout)` reproduit exactement ce defaut.
#
# On encapsule donc chaque commande distante dans un job avec delai max :
# au-dela, le job est tue, la commande orpheline est tuee, et le runner
# ECHOUE proprement (verrou libere par le finally) au lieu de figer.
$SshCmdTimeoutSec = 120

function Invoke-Remote {
  param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [Parameter(Mandatory = $true)][string[]]$RemoteArgs,
    [Parameter(Mandatory = $true)][string]$What,
    [int]$TimeoutSec = $SshCmdTimeoutSec
  )
  $argList = @()
  foreach ($a in $RemoteArgs) { $argList += "`"$a`"" }
  $p = Start-Process -FilePath $Exe -ArgumentList $argList -NoNewWindow -PassThru `
        -RedirectStandardOutput "$env:TEMP\deploy-out.txt" -RedirectStandardError "$env:TEMP\deploy-err.txt"
  if ($p.WaitForExit($TimeoutSec * 1000)) {
    return $p.ExitCode
  }
  # ── TIMEOUT : tue l'arbre de processus, sinon l'enfant survit ──
  Log "  [timeout] $What n'a pas repondu en ${TimeoutSec}s - kill"
  try {
    # -Force sur toute la descendance : scp/ssh lancent des enfants (ssh-agent,
    # askpass) qui heritent des handles et:maintenir la session ouverte.
    & taskkill /PID $p.Id /T /F 2>&1 | Out-Null
  } catch {
    try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  Start-Sleep -Seconds 1
  return 124   # code conventionnel « timeout » (comme `timeout(1)`)
}

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
  # Les 3 commandes passent par Invoke-Remote : timeout strict + kill de
  # l'arbre de processus. C'est le correctif de l'incident #223 (deploy fige
  # a cette etape, sans message, verrou laisse pose).
  Log "[3/6] scp $Script -> $REMOTE_RAW ..."
  # `@SSH_OPTS` n'est pas valide dans une expression (splatting reserve aux
  # arguments de commande) : on construit le tableau explicitement.
  $scpArgs = @($SSH_OPTS) + @("-q", $Script, "${VPS_HOST}:${REMOTE_RAW}")
  $rc = Invoke-Remote -Exe "scp" -RemoteArgs $scpArgs -What "scp"
  if ($rc -eq 124) { throw "DEPLOY-FAIL: scp a depasse ${SshCmdTimeoutSec}s (tue) - reseau ou Cle scp bloque ?" }
  if ($rc -ne 0) { throw "DEPLOY-FAIL: scp (exit $rc)" }

  $sshCleanArgs = @($SSH_OPTS) + @($VPS_HOST, "tr -d '\r' < $REMOTE_RAW > $REMOTE_SH; chmod +x $REMOTE_SH")
  $rc = Invoke-Remote -Exe "ssh" -RemoteArgs $sshCleanArgs -What "ssh clean"
  if ($rc -eq 124) { throw "DEPLOY-FAIL: ssh clean a depasse ${SshCmdTimeoutSec}s (tue)" }
  if ($rc -ne 0) { throw "DEPLOY-FAIL: ssh clean (exit $rc)" }

  # --- 3. Launch async on VPS (nohup; survives SSH disconnect) ---
  Log "[4/6] Launch remote deploy (nohup)..."
  $sshLaunchArgs = @($SSH_OPTS) + @($VPS_HOST, "rm -f $REMOTE_LOG; { nohup bash $REMOTE_SH > $REMOTE_LOG 2>&1 < /dev/null & }; echo LAUNCHED")
  $rc = Invoke-Remote -Exe "ssh" -RemoteArgs $sshLaunchArgs -What "ssh launch"
  if ($rc -eq 124) { throw "DEPLOY-FAIL: ssh launch a depasse ${SshCmdTimeoutSec}s (tue)" }
  if ($rc -ne 0) { throw "DEPLOY-FAIL: ssh launch (exit $rc)" }

  # --- 4. Poll every 10s until VPS_DEPLOY_OK or ERR: ---
  Log "[5/6] Polling $REMOTE_LOG (timeout ${TimeoutSec}s)..."
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $started = Get-Date
  $status = "timeout"
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    # Timeout court (30 s) sur les polls : ce sont des commandes courtes, un
    # depot > 30 s signale un tunnel reseau casse, pas un deploy lent.
    $outFile = "$env:TEMP\deploy-poll.txt"
    $pollArgs = @($SSH_OPTS) + @($VPS_HOST, "grep -c 'VPS_DEPLOY_OK' $REMOTE_LOG 2>/dev/null; grep -E '^ERR:' $REMOTE_LOG 2>/dev/null | tail -3")
    $rc = Invoke-Remote -Exe "ssh" -RemoteArgs $pollArgs -What "ssh poll" -TimeoutSec 30
    if ($rc -eq 124) { Log "  ssh poll a depasse 30s - retry"; continue }
    if ($rc -eq 255) { Log "  ssh transient error - retry"; continue }
    $out = if (Test-Path $outFile) { Get-Content $outFile -Raw -ErrorAction SilentlyContinue } else { "" }
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
    $tailFile = "$env:TEMP\deploy-tail.txt"
    $tailArgs = @($SSH_OPTS) + @($VPS_HOST, "tail -n 1 $REMOTE_LOG 2>/dev/null | tr -d '\r'")
    $rcTail = Invoke-Remote -Exe "ssh" -RemoteArgs $tailArgs -What "ssh tail" -TimeoutSec 30
    $tail = if ($rcTail -eq 0 -and (Test-Path $tailFile)) { Get-Content $tailFile -Raw -ErrorAction SilentlyContinue } else { "" }
    $tail = ($tail | Select-Object -Last 1)
    if ($tail) { $tail = $tail.Substring(0, [Math]::Min(110, $tail.Length)) }
    Log "  ...running (${elapsed}s) ${tail}"
  }

  # --- 5. Report ---
  Log "[6/6] Result: $status"
  $sumFile = "$env:TEMP\deploy-summary.txt"
  $sumArgs = @($SSH_OPTS) + @($VPS_HOST, "tail -n 15 $REMOTE_LOG")
  $rcSum = Invoke-Remote -Exe "ssh" -RemoteArgs $sumArgs -What "ssh summary" -TimeoutSec 30
  $summary = if ($rcSum -eq 0 -and (Test-Path $sumFile)) { Get-Content $sumFile -ErrorAction SilentlyContinue } else { @() }
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