#!/usr/bin/env bash
# PariScore — Scientific Watch cron setup
# Run on VPS as: bash scripts/setup_cron.sh
# Schedules fetchScientificPapers.py every Saturday at 00:00 UTC

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths — adjust if VPS layout differs
# ---------------------------------------------------------------------------
PROJECT_DIR="/home/ubuntu/pariscore"
PYTHON_BIN="$(which python3)"
SCRIPT="$PROJECT_DIR/scripts/fetchScientificPapers.py"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/scientific_watch.log"

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
if [[ ! -f "$SCRIPT" ]]; then
  echo "ERROR: script not found at $SCRIPT"
  echo "Run 'git pull' on VPS first, then re-run this setup."
  exit 1
fi

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "ERROR: python3 not found at $PYTHON_BIN"
  exit 1
fi

mkdir -p "$LOG_DIR"

# ---------------------------------------------------------------------------
# Cron entry — Sunday 00:00 UTC
# ---------------------------------------------------------------------------
CRON_JOB="0 0 * * 6 $PYTHON_BIN $SCRIPT >> $LOG_FILE 2>&1"

# Check if already installed
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRON" | grep -qF "fetchScientificPapers.py"; then
  echo "Cron job already installed:"
  echo "$CURRENT_CRON" | grep "fetchScientificPapers.py"
  echo ""
  echo "To update: run 'crontab -e' and edit manually."
else
  (echo "$CURRENT_CRON"; echo "$CRON_JOB") | crontab -
  echo "Cron job installed:"
  echo "  $CRON_JOB"
fi

echo ""
echo "Verify with: crontab -l | grep scientific"
echo "Logs at: $LOG_FILE"
echo ""
echo "Run manually now:"
echo "  $PYTHON_BIN $SCRIPT"
