#!/bin/bash
# =============================================================================
# verify-vps-env.sh — PariScore Phase 1.5 VPS verification (BUG-018)
# =============================================================================
# WHAT: Read-only verification that auth-bypass flags are NOT active in
#       production and that all security-sensitive env vars are present.
# WHY:  Validate the VPS is ready for Phase 1 deployment (post-patches).
# HOW:  10 checks (each PASS/FAIL/WARN), colored output + log file.
#
# USAGE (on the VPS, as the PM2 owner user — typically `ubuntu`):
#   bash verify-vps-env.sh
#
# USAGE (from a workstation, via scp + ssh):
#   scp verify-vps-env.sh ubuntu@51.75.21.239:/tmp/
#   ssh ubuntu@51.75.21.239 'bash /tmp/verify-vps-env.sh'
#
# PROPERTIES:
#   - Read-only (modifies NOTHING on the VPS except its own log file in /tmp)
#   - Never prints secret values — only PRESENT / ABSENT
#   - Detects the repo path via `pm2 describe pariscore | grep cwd`
#     (works even if the user is not `ubuntu`)
#   - Exit code: 0 if 0 FAIL, 1 if at least 1 FAIL
#   - Runtime: < 30 seconds (well under the 5 min budget)
# =============================================================================

set +e  # do NOT stop on error — we want every check to run

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'  # No Color

# ─── Counters ───────────────────────────────────────────────────────────────
PASS=0
FAIL=0
WARN=0
FAILS=()   # array of "Check NN — <desc> — action: <remediation>"
WARNS=()   # array of "Check NN — <desc> — note: <explanation>"

# ─── Log file ───────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u '+%Y%m%dT%H%M%SZ')
LOG_FILE="/tmp/pariscore-vps-verify-${TIMESTAMP}.log"

# Try to create the log file; fall back to $HOME if /tmp is not writable
if ! : > "$LOG_FILE" 2>/dev/null; then
  LOG_FILE="${HOME}/pariscore-vps-verify-${TIMESTAMP}.log"
  : > "$LOG_FILE" 2>/dev/null || LOG_FILE=""
fi

# Tee ALL output (stdout + stderr) to both terminal (colored) and log file.
# bash 4+ process substitution — reliable on Ubuntu.
if [ -n "$LOG_FILE" ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

# ─── Helper: record a check result ──────────────────────────────────────────
# $1 = check number (e.g., "01")
# $2 = status (PASS | FAIL | WARN)
# $3 = description (what was checked / what was found)
# $4 = remediation hint (optional, shown for FAIL/WARN)
record() {
  local num="$1"
  local status="$2"
  local desc="$3"
  local remediation="${4:-}"
  local color="" icon=""
  case "$status" in
    PASS)
      color="$GREEN";  icon="[PASS]"; PASS=$((PASS + 1))
      ;;
    FAIL)
      color="$RED";    icon="[FAIL]"; FAIL=$((FAIL + 1))
      FAILS+=("Check $num — $desc${remediation:+ — action: $remediation}")
      ;;
    WARN)
      color="$YELLOW"; icon="[WARN]"; WARN=$((WARN + 1))
      WARNS+=("Check $num — $desc${remediation:+ — note: $remediation}")
      ;;
  esac
  printf "  ${color}${icon}${NC}  Check %s/10 — %s\n" "$num" "$desc"
}

# ─── Header ─────────────────────────────────────────────────────────────────
print_header() {
  echo "================================================================"
  printf "${BOLD}${CYAN}PariScore — Phase 1.5 VPS Environment Verification${NC}\n"
  echo "BUG-018 : auth-bypass flags must NOT be active in production"
  echo "================================================================"
  echo "Date (UTC)   : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Hostname     : $(hostname 2>/dev/null || echo 'unknown')"
  echo "Primary IP   : $(hostname -I 2>/dev/null | awk '{print $1}' || echo 'unknown')"
  # OS pretty name (Ubuntu 22.04 LTS, etc.) — fallback to uname
  local os_name
  os_name=$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-unknown}" || uname -sr 2>/dev/null)
  echo "OS           : ${os_name:-unknown}"
  echo "Kernel       : $(uname -r 2>/dev/null)"
  echo "Script user  : ${USER:-$(whoami 2>/dev/null || echo 'unknown')}"
  echo "Log file     : ${LOG_FILE:-<none>}"
  echo "================================================================"
  echo
}

# ─── Detect repo dir (works even if user is not 'ubuntu') ───────────────────
# Spec: detect via `pm2 describe pariscore | grep cwd`, with safe fallbacks.
detect_repo_dir() {
  local dir=""

  # Method 1 (as per spec): pm2 describe pariscore | grep cwd
  if command -v pm2 >/dev/null 2>&1; then
    dir=$(pm2 describe pariscore 2>/dev/null \
          | grep -iE 'cwd' \
          | grep -oE '/[^[:space:]]+' \
          | head -1)
  fi
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    printf '%s' "$dir"
    return
  fi

  # Method 2 (fallback): pm2 jlist JSON parsed via node (more reliable)
  if command -v pm2 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    dir=$(pm2 jlist 2>/dev/null | node -e '
      let s = "";
      process.stdin.on("data", c => { s += c; });
      process.stdin.on("end", () => {
        try {
          const apps = JSON.parse(s);
          const p = apps.find(a => a.name === "pariscore");
          if (p && p.pm2_env) {
            const cwd = p.pm2_env.pm_cwd || p.pm2_env.cwd || "";
            if (cwd) process.stdout.write(cwd);
          }
        } catch (e) {}
      });
    ' 2>/dev/null)
  fi
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    printf '%s' "$dir"
    return
  fi

  # Method 3 (last resort): conventional default location
  printf '%s' "/home/ubuntu/pariscore"
}

# ─── Get a pm2_env field for the 'pariscore' process ────────────────────────
# $1 = field name (NODE_ENV, MATCHES_AUTH_BYPASS, TENNIS_DEV_BYPASS, ...)
# Prints the field value (empty if not set / not found / pm2 unavailable).
get_pm2_env_field() {
  local field="$1"
  if ! command -v pm2 >/dev/null 2>&1; then return; fi
  if ! command -v node >/dev/null 2>&1; then return; fi
  PM2_FIELD="$field" pm2 jlist 2>/dev/null | node -e '
    const field = process.env.PM2_FIELD;
    let s = "";
    process.stdin.on("data", c => { s += c; });
    process.stdin.on("end", () => {
      try {
        const apps = JSON.parse(s);
        const p = apps.find(a => a.name === "pariscore");
        if (p && p.pm2_env) {
          const v = p.pm2_env[field];
          if (v !== undefined && v !== null && v !== "") {
            process.stdout.write(String(v));
          }
        }
      } catch (e) {}
    });
  ' 2>/dev/null
}

# ─── Get the status of a named pm2 process ──────────────────────────────────
# $1 = process name. Prints: "online" | "stopped" | "errored" | "stopping"
# | "launching" | "MISSING" | "PM2_NOT_FOUND" | "NODE_NOT_FOUND" | "unknown"
get_pm2_proc_status() {
  local name="$1"
  if ! command -v pm2 >/dev/null 2>&1; then echo "PM2_NOT_FOUND"; return; fi
  if ! command -v node >/dev/null 2>&1; then echo "NODE_NOT_FOUND"; return; fi
  local status
  status=$(PM2_PROC_NAME="$name" pm2 jlist 2>/dev/null | node -e '
    const name = process.env.PM2_PROC_NAME;
    let s = "";
    process.stdin.on("data", c => { s += c; });
    process.stdin.on("end", () => {
      try {
        const apps = JSON.parse(s);
        const p = apps.find(a => a.name === name);
        if (!p) { process.stdout.write("MISSING"); return; }
        const st = (p.pm2_env && p.pm2_env.status) ? p.pm2_env.status : "unknown";
        process.stdout.write(st);
      } catch (e) { process.stdout.write("ERROR"); }
    });
  ' 2>/dev/null)
  printf '%s' "${status:-unknown}"
}

# ─── Check .env key presence (without revealing the value) ──────────────────
# Returns: 0 = present with non-empty value
#          1 = missing or empty value
#          2 = .env file itself is missing
# $1 = key name (e.g., ADMIN_PASSWORD)
env_key_present() {
  local key="$1"
  local envfile="$REPO_DIR/.env"
  [ -f "$envfile" ] || return 2
  # Match `KEY=...` or `export KEY=...` at line start (skips comments)
  local line
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$envfile" 2>/dev/null | head -1)
  if [ -z "$line" ]; then
    return 1
  fi
  # Extract the value (everything after the first `=`)
  local val="${line#*=}"
  # Strip surrounding whitespace, optional quotes, and trailing inline comments
  val=$(printf '%s' "$val" | sed -E "s/^[[:space:]]*//; s/^[\"']//; s/[\"'][[:space:]]*(#.*)?$//; s/[[:space:]]*$//")
  if [ -n "$val" ]; then
    return 0
  fi
  return 1
}

# ─── HTTP HEAD status code for a localhost URL ──────────────────────────────
# $1 = URL. Prints 3-digit HTTP code, or "000" if curl/unreachable,
# or "CURL_NOT_FOUND" if curl is missing.
http_head_status() {
  local url="$1"
  if ! command -v curl >/dev/null 2>&1; then echo "CURL_NOT_FOUND"; return; fi
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -I --max-time 5 "$url" 2>/dev/null)
  printf '%s' "${code:-000}"
}

# =============================================================================
# MAIN
# =============================================================================

print_header

# ─── Preflight: detect required commands ────────────────────────────────────
printf "${BOLD}Preflight — required commands:${NC}\n"
for cmd in pm2 node curl grep sed awk; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf "  ${GREEN}[OK]${NC}    %-6s → %s\n" "$cmd" "$(command -v "$cmd")"
  else
    printf "  ${RED}[MISS]${NC}  %-6s — some checks will FAIL\n" "$cmd"
  fi
done
echo

# ─── Detect repo dir ────────────────────────────────────────────────────────
printf "${BOLD}Detecting PariScore repository path...${NC}\n"
REPO_DIR=$(detect_repo_dir)
printf "  Repository dir: %s\n" "$REPO_DIR"
if [ ! -d "$REPO_DIR" ]; then
  printf "  ${RED}WARNING: detected directory does not exist on disk!${NC}\n"
fi
ENV_FILE="$REPO_DIR/.env"
printf "  .env file     : %s\n" "$ENV_FILE"
echo

# ─── Run the 10 checks ──────────────────────────────────────────────────────
printf "${BOLD}Running 10 verification checks...${NC}\n"
echo

# ── Check 01: NODE_ENV=production in PM2 env ────────────────────────────────
NODE_ENV_VAL=$(get_pm2_env_field "NODE_ENV")
if [ -z "$NODE_ENV_VAL" ]; then
  record "01" "FAIL" \
    "NODE_ENV is NOT set in PM2 env of process 'pariscore'" \
    "Add NODE_ENV=production in ecosystem.config.js env block, then 'pm2 restart pariscore --update-env'"
elif [ "$NODE_ENV_VAL" = "production" ]; then
  record "01" "PASS" \
    "NODE_ENV=production in PM2 env (value: '$NODE_ENV_VAL')"
else
  record "01" "FAIL" \
    "NODE_ENV is '$NODE_ENV_VAL' (must be 'production')" \
    "Set NODE_ENV=production in ecosystem.config.js env block, then 'pm2 restart pariscore --update-env'"
fi

# ── Check 02: MATCHES_AUTH_BYPASS must NOT be set ───────────────────────────
MAB_VAL=$(get_pm2_env_field "MATCHES_AUTH_BYPASS")
if [ -z "$MAB_VAL" ]; then
  record "02" "PASS" \
    "MATCHES_AUTH_BYPASS is NOT set in PM2 env (good — auth is enforced)"
else
  record "02" "FAIL" \
    "MATCHES_AUTH_BYPASS IS SET to '$MAB_VAL' — auth bypass is ACTIVE!" \
    "Remove MATCHES_AUTH_BYPASS from ecosystem.config.js / shell env, then 'pm2 restart pariscore --update-env'"
fi

# ── Check 03: TENNIS_DEV_BYPASS must NOT be set ─────────────────────────────
TDB_VAL=$(get_pm2_env_field "TENNIS_DEV_BYPASS")
if [ -z "$TDB_VAL" ]; then
  record "03" "PASS" \
    "TENNIS_DEV_BYPASS is NOT set in PM2 env (good — no dev bypass)"
else
  record "03" "FAIL" \
    "TENNIS_DEV_BYPASS IS SET to '$TDB_VAL' — dev bypass is ACTIVE!" \
    "Remove TENNIS_DEV_BYPASS from ecosystem.config.js / shell env, then 'pm2 restart pariscore --update-env'"
fi

# ── Check 04: ADMIN_PASSWORD present in .env (value masked) ─────────────────
if [ ! -f "$ENV_FILE" ]; then
  record "04" "FAIL" \
    "ADMIN_PASSWORD: .env file NOT FOUND at $ENV_FILE" \
    "Create .env in repo dir with ADMIN_PASSWORD=<strong_secret>"
elif env_key_present "ADMIN_PASSWORD"; then
  record "04" "PASS" "ADMIN_PASSWORD is PRESENT in .env (value masked)"
else
  record "04" "FAIL" \
    "ADMIN_PASSWORD is ABSENT or empty in .env" \
    "Add ADMIN_PASSWORD=<at-least-12-chars> to .env, then 'pm2 restart pariscore --update-env'"
fi

# ── Check 05: BETA_TESTER_PASSWORD present in .env (value masked) ───────────
if [ ! -f "$ENV_FILE" ]; then
  record "05" "FAIL" \
    "BETA_TESTER_PASSWORD: .env file NOT FOUND at $ENV_FILE" \
    "Create .env in repo dir with BETA_TESTER_PASSWORD=<strong_secret>"
elif env_key_present "BETA_TESTER_PASSWORD"; then
  record "05" "PASS" "BETA_TESTER_PASSWORD is PRESENT in .env (value masked)"
else
  record "05" "FAIL" \
    "BETA_TESTER_PASSWORD is ABSENT or empty in .env" \
    "Add BETA_TESTER_PASSWORD=<at-least-12-chars> to .env, then 'pm2 restart pariscore --update-env'"
fi

# ── Check 06: JWT_SECRET present in .env (value masked) ─────────────────────
if [ ! -f "$ENV_FILE" ]; then
  record "06" "FAIL" \
    "JWT_SECRET: .env file NOT FOUND at $ENV_FILE" \
    "Create .env in repo dir with JWT_SECRET=<at-least-32-chars>"
elif env_key_present "JWT_SECRET"; then
  record "06" "PASS" "JWT_SECRET is PRESENT in .env (value masked)"
else
  record "06" "FAIL" \
    "JWT_SECRET is ABSENT or empty in .env" \
    "Add JWT_SECRET=<at-least-32-chars> to .env (generate with: openssl rand -hex 32), then 'pm2 restart pariscore --update-env'"
fi

# ── Check 07: ALLOWED_ORIGIN present in .env (value masked) ─────────────────
if [ ! -f "$ENV_FILE" ]; then
  record "07" "FAIL" \
    "ALLOWED_ORIGIN: .env file NOT FOUND at $ENV_FILE" \
    "Create .env in repo dir with ALLOWED_ORIGIN=https://pariscore.fr"
elif env_key_present "ALLOWED_ORIGIN"; then
  record "07" "PASS" "ALLOWED_ORIGIN is PRESENT in .env (value masked)"
else
  record "07" "FAIL" \
    "ALLOWED_ORIGIN is ABSENT or empty in .env" \
    "Add ALLOWED_ORIGIN=https://pariscore.fr to .env, then 'pm2 restart pariscore --update-env'"
fi

# ── Check 08: GET /.jwt_secret must return 403 / 404 (not 200) ──────────────
JWT_CODE=$(http_head_status "http://localhost:3000/.jwt_secret")
case "$JWT_CODE" in
  403|404|405)
    record "08" "PASS" "GET /.jwt_secret returned HTTP $JWT_CODE (blocked — good)"
    ;;
  200)
    record "08" "FAIL" \
      "GET /.jwt_secret returned HTTP 200 — SECRET IS PUBLICLY ACCESSIBLE!" \
      "Apply patch-001 (BLOCKED_FILES includes .jwt_secret) and 'pm2 restart pariscore'; confirm .jwt_secret is not in any static-serve path"
    ;;
  000)
    record "08" "WARN" \
      "GET /.jwt_secret: cannot reach localhost:3000 (server down or curl timeout)" \
      "Check 'pm2 status' (pariscore must be online) and that port 3000 is bound (ss -tlnp | grep 3000)"
    ;;
  CURL_NOT_FOUND)
    record "08" "WARN" \
      "GET /.jwt_secret: curl is not installed — cannot test" \
      "Install curl: sudo apt-get install -y curl"
    ;;
  *)
    record "08" "WARN" \
      "GET /.jwt_secret returned unexpected HTTP $JWT_CODE" \
      "Investigate server response; expected 403/404/405"
    ;;
esac

# ── Check 09: GET /.env must return 403 / 404 (not 200) ─────────────────────
ENV_CODE=$(http_head_status "http://localhost:3000/.env")
case "$ENV_CODE" in
  403|404|405)
    record "09" "PASS" "GET /.env returned HTTP $ENV_CODE (blocked — good)"
    ;;
  200)
    record "09" "FAIL" \
      "GET /.env returned HTTP 200 — ENV FILE IS PUBLICLY ACCESSIBLE!" \
      "Verify .env is in BLOCKED_FILES list (patch-001) and 'pm2 restart pariscore'; check static-serve config"
    ;;
  000)
    record "09" "WARN" \
      "GET /.env: cannot reach localhost:3000 (server down or curl timeout)" \
      "Check 'pm2 status' (pariscore must be online) and that port 3000 is bound (ss -tlnp | grep 3000)"
    ;;
  CURL_NOT_FOUND)
    record "09" "WARN" \
      "GET /.env: curl is not installed — cannot test" \
      "Install curl: sudo apt-get install -y curl"
    ;;
  *)
    record "09" "WARN" \
      "GET /.env returned unexpected HTTP $ENV_CODE" \
      "Investigate server response; expected 403/404/405"
    ;;
esac

# ── Check 10: pm2 status shows the 5 expected processes ────────────────────
EXPECTED_PROCS="pariscore pariscore-cron-rg pariscore-cron-match-stats pariscore-vault-daily pariscore-vault-weekly"
ALL_PRESENT=1
PARISCORE_BAD_STATUS=""
CRON_STOPPED=""
CRON_ERRORED=""

for proc in $EXPECTED_PROCS; do
  status=$(get_pm2_proc_status "$proc")
  case "$status" in
    online)
      : # healthy
      ;;
    stopped)
      if [ "$proc" = "pariscore" ]; then
        PARISCORE_BAD_STATUS="stopped"
      else
        CRON_STOPPED="${CRON_STOPPED} ${proc}"
      fi
      ;;
    errored|stopping|launching|unknown|ERROR)
      if [ "$proc" = "pariscore" ]; then
        PARISCORE_BAD_STATUS="${status}"
      else
        CRON_ERRORED="${CRON_ERRORED} ${proc}(${status})"
      fi
      ;;
    MISSING|PM2_NOT_FOUND|NODE_NOT_FOUND)
      ALL_PRESENT=0
      ;;
  esac
done

if [ "$ALL_PRESENT" -eq 0 ]; then
  record "10" "FAIL" \
    "PM2: not all 5 expected processes are present (or pm2/node unavailable)" \
    "Run 'pm2 start ecosystem.config.js' from repo dir ($REPO_DIR); verify with 'pm2 status'"
elif [ -n "$PARISCORE_BAD_STATUS" ]; then
  record "10" "FAIL" \
    "Main process 'pariscore' is '${PARISCORE_BAD_STATUS}' (must be online)" \
    "Run 'pm2 restart pariscore' and inspect 'pm2 logs pariscore --lines 50 --err'"
elif [ -n "$CRON_ERRORED" ]; then
  record "10" "WARN" \
    "Cron processes in error state:${CRON_ERRORED}" \
    "Inspect 'pm2 logs <proc> --lines 50 --err'; 'stopped' between ticks is normal, 'errored' is a real failure"
elif [ -n "$CRON_STOPPED" ]; then
  record "10" "PASS" \
    "All 5 expected processes present; pariscore online; cron stopped (normal):${CRON_STOPPED}"
else
  record "10" "PASS" \
    "All 5 expected processes present and pariscore is online"
fi

# Explanatory note for cron "stopped" status (normal PM2 behavior)
if [ -n "$CRON_STOPPED" ] && [ -z "$CRON_ERRORED" ]; then
  echo
  printf "  ${YELLOW}Note:${NC} cron processes (with autorestart:false + cron_restart) are\n"
  printf "  expected to be 'stopped' between scheduled ticks. They briefly go 'online'\n"
  printf "  at their next cron schedule, then exit and return to 'stopped'. This is\n"
  printf "  normal PM2 behavior and is NOT a failure.\n"
fi

# =============================================================================
# FINAL SUMMARY
# =============================================================================
echo
echo "================================================================"
printf "${BOLD}VERIFICATION SUMMARY${NC}\n"
echo "================================================================"
printf "  ${GREEN}PASS${NC}: %d\n" "$PASS"
printf "  ${RED}FAIL${NC}: %d\n" "$FAIL"
printf "  ${YELLOW}WARN${NC}: %d\n" "$WARN"
echo "================================================================"
echo

if [ "$FAIL" -gt 0 ]; then
  printf "${RED}${BOLD}🔴 VPS NON SÉCURISÉ — FAIL critiques à corriger${NC}\n"
  echo
  printf "${BOLD}Failed checks & recommended corrective actions:${NC}\n"
  for entry in "${FAILS[@]}"; do
    printf "  ${RED}•${NC} %s\n" "$entry"
  done
  echo
  printf "${BOLD}General remediation procedure:${NC}\n"
  echo "  1. SSH to the VPS:     ssh ubuntu@51.75.21.239"
  echo "  2. cd to repo:         cd ${REPO_DIR}"
  echo "  3. Edit .env:          nano .env   (add any missing keys — never commit)"
  echo "  4. Edit ecosystem:     nano ecosystem.config.js   (remove bypass flags if present)"
  echo "  5. Reload env into PM2: pm2 restart pariscore --update-env"
  echo "  6. Verify server boot:  pm2 logs pariscore --lines 30 --err   (no [FATAL] line)"
  echo "  7. Re-run this script:  bash verify-vps-env.sh   (target: 0 FAIL)"
  echo
  printf "Full log saved to: %s\n" "${LOG_FILE:-<none>}"
  # Allow tee to flush before exiting
  sleep 0.2
  exit 1
fi

# FAIL == 0
if [ "$WARN" -gt 0 ]; then
  printf "${GREEN}${BOLD}🟢 VPS prêt pour Phase 1 — environnement sécurisé${NC}\n"
  printf "  (${YELLOW}%d warning(s)${NC}${GREEN} to review — non-blocking)${NC}\n" "$WARN"
  echo
  printf "${BOLD}Warnings:${NC}\n"
  for entry in "${WARNS[@]}"; do
    printf "  ${YELLOW}•${NC} %s\n" "$entry"
  done
else
  printf "${GREEN}${BOLD}🟢 VPS prêt pour Phase 1 — environnement sécurisé${NC}\n"
  echo "  All 10 checks passed. No warnings."
fi
echo
printf "Full log saved to: %s\n" "${LOG_FILE:-<none>}"
# Allow tee to flush before exiting
sleep 0.2
exit 0
