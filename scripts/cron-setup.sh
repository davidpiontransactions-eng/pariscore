#!/bin/bash
# cron-setup.sh — weekly tennisabstract Elo scraper cron
#
# Run this ONCE on the VPS to install the weekly cron job.
# The scraper runs every Monday at 3:00 AM UTC.
#
# Usage:
#   ssh ubuntu@51.75.21.239 'bash -s' < scripts/cron-setup.sh
#
# Or copy to VPS and run:
#   scp scripts/cron-setup.sh ubuntu@51.75.21.239:/tmp/
#   ssh ubuntu@51.75.21.239 'bash /tmp/cron-setup.sh && rm /tmp/cron-setup.sh'

PROJECT_DIR="$HOME/pariscore"
CRON_LINE="0 3 * * 1 cd $PROJECT_DIR && bun run scripts/scrape-tennis-elo.ts 2>&1 | logger -t scrape-tennis-elo"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "scrape-tennis-elo"; then
  echo "✓ Cron job already installed"
  crontab -l | grep "scrape-tennis-elo"
  exit 0
fi

# Append to crontab
(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
echo "✓ Installed weekly cron:"
echo "  $CRON_LINE"
echo ""
echo "Test with:"
echo "  cd $PROJECT_DIR && bun run scripts/scrape-tennis-elo.ts"
