#!/bin/bash
# =============================================================================
# bfg-cleanup.sh — Phase 1.4 git history scrubbing (PariScore security audit)
# Bugs covered: BUG-002 / BUG-007 / BUG-008 / BUG-027 / BUG-048
# =============================================================================
# WHAT THIS SCRIPT DOES
#   Uses the BFG Repo-Cleaner (https://rtyley.github.io/bfg-repo-cleaner/)
#   to rewrite the git history of the PariScore repository and physically
#   remove every blob of the sensitive files listed below. After the rewrite,
#   it expires the reflog and runs an aggressive garbage collection so the
#   orphaned objects are actually purged from the .git directory.
#
#   ⚠️  THIS REWRITES GIT HISTORY ⚠️
#   - Every commit hash changes after HEAD
# - Anyone with a fork or open PR must re-clone
#   - A `git push --force` (or `--force-with-lease`) is required afterward
#   - Make sure all branches have been pushed to a backup first
#
# PREREQUISITES
#   1. Java 11+ installed (java -version)
#   2. bfg.jar downloaded (see BFG_JAR variable below)
#   3. Run git-rm-sensitive.sh FIRST and commit the deletions.
#      BFG only scrubs history; it will NOT touch the HEAD commit by default,
#      so the files must already be gone from the current tree.
#
# USAGE
#   ./bfg-cleanup.sh             # interactive, asks for confirmation
#   ./bfg-cleanup.sh --dry-run   # show what would be done, do nothing
# =============================================================================
set -e

# --- Config ------------------------------------------------------------------
# Path to bfg.jar. Override with BFG_JAR=/path/to/bfg.jar ./bfg-cleanup.sh
BFG_JAR="${BFG_JAR:-$HOME/bfg.jar}"

# Where to put the backup of the original repo BEFORE rewriting history.
BACKUP_DIR="../pariscore-backup-$(date +%Y%m%d-%H%M%S)"

# Where to build the bare mirror that BFG operates on.
MIRROR_DIR="../pariscore-mirror-$(date +%Y%m%d-%H%M%S).git"

# Files & globs to delete from history. BFG accepts wildcards.
# Each entry becomes a --delete-files argument.
DELETE_FILES=(
  ".jwt_secret"
  "pariscore.db-wal"
  "pariscore.db-shm"
  "database.db"
  "metrics-cache.db"
  "metrics-cache.db-wal"
  "metrics-cache.db-shm"
  "deploy-ovh.ps1"
  "*.bak"
  "*.backup"
  "server.log"
  "server.err"
  "server*.log"
  "server*.err"
  "server_*.log"
  "server-*.log"
)

# --- Helpers -----------------------------------------------------------------
DRY_RUN=0
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=1
fi

banner() {
  echo
  echo "================================================================"
  echo "  $1"
  echo "================================================================"
}

confirm() {
  # $1 = prompt, $2 = expected answer
  local prompt="$1"
  local expected="${2:-yes}"
  read -r -p "$prompt" answer
  if [ "$answer" != "$expected" ]; then
    echo "[bfg] Aborted by user."
    exit 1
  fi
}

# --- Pre-flight checks -------------------------------------------------------
banner "BFG history cleanup — PariScore Phase 1.4"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[bfg] MODE: DRY-RUN (no destructive action will be taken)"
else
  echo "[bfg] MODE: LIVE (history WILL be rewritten)"
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[bfg] ERROR: not inside a git repository."
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
echo "[bfg] Repository: $REPO_ROOT"
echo "[bfg] Branch:     $(git rev-parse --abbrev-ref HEAD)"
echo "[bfg] HEAD:       $(git rev-parse HEAD)"

# Check Java
if ! command -v java >/dev/null 2>&1; then
  echo "[bfg] ERROR: Java not found in PATH. Install Java 11+ first:"
  echo "             sudo apt-get install -y default-jre    # Debian/Ubuntu"
  echo "             brew install java                      # macOS"
  exit 1
fi
JAVA_VER="$(java -version 2>&1 | head -1)"
echo "[bfg] Java: $JAVA_VER"

# Check BFG jar
if [ ! -f "$BFG_JAR" ]; then
  echo "[bfg] ERROR: bfg.jar not found at: $BFG_JAR"
  echo "[bfg] Download it with one of these commands:"
  echo "             curl -L -o \"$BFG_JAR\" \\"
  echo "                  https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
  echo "             # or:"
  echo "             wget -O \"$BFG_JAR\" \\"
  echo "                  https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
  echo "             # then re-run this script."
  echo "[bfg] You can also override the path: BFG_JAR=/other/path/bfg.jar $0"
  exit 1
fi
echo "[bfg] BFG jar:   $BFG_JAR"

# Verify HEAD is clean (BFG won't touch HEAD anyway, but warn user)
if ! git diff --cached --quiet 2>/dev/null || ! git diff --quiet 2>/dev/null; then
  echo "[bfg] WARNING: working tree has uncommitted changes."
  echo "[bfg]          BFG operates on a fresh mirror, but you should commit or stash first."
  if [ "$DRY_RUN" -eq 0 ]; then
    confirm "  Continue anyway? (type 'i-know' to proceed): " "i-know"
  fi
fi

# Verify the sensitive files are no longer in HEAD
LEAKING=""
for pat in "${DELETE_FILES[@]}"; do
  # Use git ls-files with the pattern to check current HEAD
  if git ls-files "$pat" 2>/dev/null | grep -q .; then
    LEAKING="$LEAKING $(git ls-files "$pat" 2>/dev/null | tr '\n' ' ')"
  fi
done
if [ -n "$LEAKING" ]; then
  echo "[bfg] WARNING: the following sensitive files are STILL tracked in HEAD:"
  echo "$LEAKING" | tr ' ' '\n' | grep -v '^$' | sed 's/^/             /'
  echo "[bfg]          BFG does NOT rewrite the HEAD commit. You should:"
  echo "[bfg]             1. Run git-rm-sensitive.sh"
  echo "[bfg]             2. git add .gitignore && git commit -m 'untrack sensitive files'"
  echo "[bfg]             3. Re-run this script"
  if [ "$DRY_RUN" -eq 0 ]; then
    confirm "  Continue anyway (history will still be scrubbed but HEAD keeps the files)? (type 'i-know'): " "i-know"
  fi
fi

# --- Show what would be deleted ---------------------------------------------
banner "Files / globs that BFG will delete from history"
for f in "${DELETE_FILES[@]}"; do
  echo "  - $f"
done

# --- DRY RUN -----------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  banner "DRY-RUN — planned actions (no changes will be made)"
  echo "[bfg] 1. Backup current repo to:        $BACKUP_DIR"
  echo "           cp -r \"$REPO_ROOT\" \"$BACKUP_DIR\""
  echo "[bfg] 2. Create bare mirror:            $MIRROR_DIR"
  echo "           git clone --mirror \"$REPO_ROOT\" \"$MIRROR_DIR\""
  echo "[bfg] 3. Run BFG against mirror:"
  ARGS=""
  for f in "${DELETE_FILES[@]}"; do ARGS="$ARGS --delete-files \"$f\""; done
  echo "           java -jar \"$BFG_JAR\" $ARGS \"$MIRROR_DIR\""
  echo "[bfg] 4. Expire reflog + aggressive GC:"
  echo "           cd \"$MIRROR_DIR\""
  echo "           git reflog expire --expire=now --all"
  echo "           git gc --prune=now --aggressive"
  echo "[bfg] 5. Push rewritten history back to origin (DESTRUCTIVE):"
  echo "           cd \"$MIRROR_DIR\""
  echo "           git push --force --mirror"
  echo
  echo "[bfg] (Dry-run only — nothing was modified.)"
  exit 0
fi

# --- LIVE mode: confirmations ------------------------------------------------
banner "⚠️  DESTRUCTIVE OPERATION — read carefully"
cat <<'WARN'
This script will:
  1. Make a full backup copy of the current repository.
  2. Create a bare mirror clone.
  3. Rewrite that mirror's history with BFG, deleting every blob of the
     files listed above from EVERY commit (except HEAD).
  4. Expire the reflog and run an aggressive git gc.
  5. Print the force-push commands you will need to run manually.

Consequences:
  - Every commit hash from the first rewritten commit onward changes.
  - All open pull requests targeting rewritten branches become invalid.
  - Anyone with a fork or local clone must delete it and re-clone.
  - The original remote history is overwritten on the next `git push --force`.

A backup will be created automatically, but you should ALSO push the current
repository to a second remote (e.g. a private GitHub backup repo) before
continuing.
WARN

confirm "  Have you pushed a backup to a second remote? (type 'yes'): " "yes"
confirm "  Type 'rewrite-history' to start BFG: " "rewrite-history"

# --- Step 1: backup ----------------------------------------------------------
banner "Step 1/5 — Backup current repo"
echo "[bfg] Creating backup at: $BACKUP_DIR"
mkdir -p "$(dirname "$BACKUP_DIR")"
# -a preserves permissions, --exclude=.git would defeat the purpose; keep .git
cp -r "$REPO_ROOT" "$BACKUP_DIR"
echo "[bfg] Backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "[bfg] If anything goes wrong, you can restore from:"
echo "        rm -rf \"$REPO_ROOT\" && mv \"$BACKUP_DIR\" \"$REPO_ROOT\""

# --- Step 2: create bare mirror ---------------------------------------------
banner "Step 2/5 — Create bare mirror clone"
echo "[bfg] Cloning mirror to: $MIRROR_DIR"
rm -rf "$MIRROR_DIR"
git clone --mirror "$REPO_ROOT" "$MIRROR_DIR"
cd "$MIRROR_DIR"

# Show .git size before
SIZE_BEFORE=$(du -sh . | cut -f1)
echo "[bfg] Mirror .git size BEFORE: $SIZE_BEFORE"

# --- Step 3: run BFG ---------------------------------------------------------
banner "Step 3/5 — Run BFG Repo-Cleaner"
BFG_ARGS=()
for f in "${DELETE_FILES[@]}"; do
  BFG_ARGS+=(--delete-files "$f")
done
echo "[bfg] Invoking BFG..."
java -jar "$BFG_JAR" "${BFG_ARGS[@]}" "$MIRROR_DIR"

# --- Step 4: reflog expire + aggressive GC -----------------------------------
banner "Step 4/5 — Expire reflog & garbage collect"
echo "[bfg] git reflog expire --expire=now --all"
git reflog expire --expire=now --all
echo "[bfg] git gc --prune=now --aggressive"
git gc --prune=now --aggressive

SIZE_AFTER=$(du -sh . | cut -f1)
echo "[bfg] Mirror .git size AFTER:  $SIZE_AFTER"
echo "[bfg] Reduction: $SIZE_BEFORE -> $SIZE_AFTER"

# --- Step 5: print force-push instructions ----------------------------------
banner "Step 5/5 — Push rewritten history back to origin"
cat <<EOF
[bfg] The mirror at:
        $MIRROR_DIR
[bfg] now contains the cleaned history. To publish it, run:

        cd "$MIRROR_DIR"
        git remote set-url --push origin https://github.com/davidpiontransactions-eng/pariscore.git
        git push --force --mirror

[bfg] ⚠️  The push --force --mirror will overwrite ALL refs on the remote,
[bfg] including branches and tags, with the rewritten versions.

[bfg] Safer alternative (per-branch, with lease protection):
        cd "$REPO_ROOT"
        git fetch "$MIRROR_DIR"
        git branch --list
        # then for each branch you want to update:
        git push --force-with-lease origin <branch>
EOF

banner "BFG cleanup complete"
echo "[bfg] Backup kept at:        $BACKUP_DIR"
echo "[bfg] Mirror kept at:        $MIRROR_DIR"
echo "[bfg] Original repo at:      $REPO_ROOT (untouched)"
echo "[bfg]"
echo "[bfg] NEXT STEPS"
echo "[bfg]   1. Inspect the mirror log:  git -C \"$MIRROR_DIR\" log --oneline | head -20"
echo "[bfg]   2. Verify:                  ./verify-cleanup.sh"
echo "[bfg]   3. Force-push (see command above)"
echo "[bfg]   4. Notify all collaborators to RE-CLONE the repository."
echo "[bfg]   5. Rotate the leaked JWT secret and any other credentials"
echo "[bfg]      that were in the removed files — history scrubbing does"
echo "[bfg]      NOT undo the leak, it only prevents future access."
