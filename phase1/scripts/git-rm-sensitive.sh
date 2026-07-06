#!/bin/bash
# =============================================================================
# git-rm-sensitive.sh — Phase 1.4 git cleanup (PariScore security audit)
# Bugs covered: BUG-002 / BUG-007 / BUG-008 / BUG-027 / BUG-048
# =============================================================================
# WHAT THIS SCRIPT DOES
#   Walks the git index of the CURRENT repository and untracks every file
#   matching the sensitive-file patterns defined in the audit. Files are
#   removed from the git index with `git rm --cached`, which means they
#   STAY on disk — only the tracking is removed.
#
#   After running this script you MUST:
#     1. Apply gitignore-additions.patch so the files don't get re-added
#     2. Commit the staged deletions
#     3. (Optional but recommended) Run bfg-cleanup.sh to scrub history
#
# IMPORTANT
#   - This script does NOT commit. Review `git status` first.
#   - This script does NOT delete files from disk.
#   - It is idempotent: re-running on a clean repo is a no-op.
#   - Run it from the repository ROOT (where .git lives).
# =============================================================================
set -e

# --- Safety: refuse to run outside a git repo --------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[git-rm] ERROR: not inside a git repository."
  echo "[git-rm]       cd into the pariscore repo root and re-run."
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "[git-rm] Repository: $REPO_ROOT"
echo "[git-rm] Branch:     $(git rev-parse --abbrev-ref HEAD)"
echo "[git-rm] HEAD:       $(git rev-parse --short HEAD)"
echo "[git-rm] ----------------------------------------------------------------"

# --- Build the list of sensitive files currently tracked ---------------------
# We use git ls-files with the same pathspec patterns as the .gitignore
# additions, so the script stays in sync with the patch.
TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_LIST"' EXIT

# NOTE: git ls-files pathspecs are shell-glob style relative to repo root.
git ls-files \
  '.jwt_secret' \
  '*.db-wal' '*/db-wal' \
  '*.db-shm' '*/db-shm' \
  '*.db-journal' \
  'database.db' '*/database.db' \
  'database.db-*' '*/database.db-*' \
  'data/database.db*' \
  'data/metrics-cache.db*' \
  'data/backup-transfert/*.db*' \
  '*.bak' '*/**.bak' \
  '*.backup' '*/**.backup' \
  '*.log' \
  '*.err' \
  'logs/*' \
  '.context/*.log' '.context/*/*.log' \
  'vps.zip' \
  'pariscore-fix.zip' \
  'pariscore-design-fix.zip' \
  'setpoint-v10.zip' \
  'setpoint-v12.zip' \
  'setpoint-v14fix.zip' \
  'tools/pty-toolkit.zip' \
  'tools/cmux-multi-agent.zip' \
  'tools/Public-ESPN-API-main.zip' \
  'exports/*.docx' \
  'exports/*.pdf' \
  'exports/*.xlsx' \
  'deploy-ovh.ps1' \
  'vps/deploy-ovh.ps1' \
  '__pycache__/*' '*/__pycache__/*' '**/__pycache__/*' \
  '*.pyc' '*/**.pyc' \
  '*.tar' '*/**.tar' '**/*.tar' \
  'GLM/*' 'GLM/**/*' \
  'fichier VPS/*' 'fichier VPS/**/*' \
  'token-usage-output.txt' \
  'logs/.*' \
  '.context/.orchestrator.pid' \
  | sort -u > "$TMP_LIST"

TOTAL=$(wc -l < "$TMP_LIST")
if [ "$TOTAL" -eq 0 ]; then
  echo "[git-rm] No sensitive files found in git index. Nothing to do."
  exit 0
fi

echo "[git-rm] Found $TOTAL sensitive file(s) currently tracked."
echo "[git-rm] ----------------------------------------------------------------"
echo "[git-rm] Untracking files (files remain on disk):"

# --- Untrack each file -------------------------------------------------------
# `git rm --cached` only removes from the index; the working copy is preserved.
# We disable `set -e` for the loop so a single failing entry doesn't abort
# the whole run (idempotency: already-removed files error out).
set +e
REMOVED=0
SKIPPED=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  if git rm --cached --quiet -- "$file" 2>/dev/null; then
    if [ -f "$file" ]; then
      size=$(stat -c '%s' "$file" 2>/dev/null || echo "?")
    else
      size="(gone)"
    fi
    printf "  [removed]  %10s  %s\n" "$size" "$file"
    REMOVED=$((REMOVED + 1))
  else
    echo "  [skip]     already untracked or missing: $file"
    SKIPPED=$((SKIPPED + 1))
  fi
done < "$TMP_LIST"
set -e

echo "[git-rm] ----------------------------------------------------------------"
echo "[git-rm] Summary:"
echo "[git-rm]   removed from index : $REMOVED"
echo "[git-rm]   skipped (idempotent): $SKIPPED"
echo "[git-rm]   files preserved on disk (NOT deleted)"
echo "[git-rm]"
echo "[git-rm] NEXT STEPS"
echo "[git-rm]   1. Apply .gitignore patch:"
echo "[git-rm]        git apply gitignore-additions.patch"
echo "[git-rm]   2. Review staged changes:"
echo "[git-rm]        git status --short"
echo "[git-rm]   3. Commit when satisfied:"
echo "[git-rm]        git add .gitignore"
echo "[git-rm]        git commit -m \"chore(security): untrack sensitive files (BUG-002/007/008/027/048)\""
echo "[git-rm]   4. (Recommended) Run bfg-cleanup.sh to scrub git history"
echo "[git-rm] ----------------------------------------------------------------"
echo "[git-rm] git status summary:"
git status --short | head -40
echo "[git-rm] ----------------------------------------------------------------"
echo "[git-rm] staged deletions: $(git diff --cached --name-only --diff-filter=D | wc -l)"
echo "[git-rm] DONE — no commit was made. Review and commit manually."
