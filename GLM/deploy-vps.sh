#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ParisScore — Deploy Tennis Live (Vanilla JS) to VPS
#
# Usage from your Windows machine (Git Bash or WSL):
#   bash deploy-vps.sh
#
# Prerequisites:
#   - SSH config "pariscore" pointing to 51.75.21.239
#   - SSH key id_ed25519_vps in ~/.ssh/
#   - This script + the 5 vanilla files in the same folder
# ═══════════════════════════════════════════════════════════════

set -e

VPS="pariscore"
VPS_APP="/var/www/pariscore"
VPS_DB="$VPS_APP/pariscore.db"
VPS_PUBLIC="$VPS_APP/public"

echo "╔══════════════════════════════════════════════════╗"
echo "║  ParisScore — Deploy Tennis Live (Vanilla JS)   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Upload files ───
echo "=== Step 1/5: Upload files ==="
echo "  Uploading tennis-live.css, tennis-live.js, players-api.js, migration-players.sql..."
scp tennis-live.css tennis-live.js players-api.js migration-players.sql "$VPS:/tmp/"
echo "  Done."
echo ""

# ─── Step 2: Copy static files to public dir ───
echo "=== Step 2/5: Copy static files ==="
ssh "$VPS" << 'EOF'
  cp /tmp/tennis-live.css /var/www/pariscore/public/tennis-live.css
  cp /tmp/tennis-live.js /var/www/pariscore/public/tennis-live.js
  echo "  CSS + JS copied to public/"
EOF
echo ""

# ─── Step 3: Add CSS + script tags to pariscore.html ───
echo "=== Step 3/5: Patch pariscore.html ==="
ssh "$VPS" << 'EOF'
  HTML=/var/www/pariscore/public/pariscore.html
  
  # Check if already patched
  if grep -q "tennis-live.css" "$HTML"; then
    echo "  pariscore.html already has tennis-live.css — skipping CSS injection"
  else
    # Add CSS link before </head>
    sed -i 's|</head>|<link rel="stylesheet" href="/tennis-live.css"></head>|' "$HTML"
    echo "  CSS link added to pariscore.html"
  fi
  
  if grep -q "tennis-live.js" "$HTML"; then
    echo "  pariscore.html already has tennis-live.js — skipping JS injection"
  else
    # Add script + init before </body>
    sed -i 's|</body>|<script src="/tennis-live.js"></script><script>function initTennisLive(){if(document.getElementById("tennis-live-section")){TennisLive.init("tennis-live-section")}}document.addEventListener("DOMContentLoaded",initTennisLive);</script></body>|' "$HTML"
    echo "  JS script + init added to pariscore.html"
  fi
  
  # Add the container div in page-tennis if not present
  if grep -q "tennis-live-section" "$HTML"; then
    echo "  tennis-live-section div already exists — skipping"
  else
    # Insert after the KPI bar in page-tennis
    sed -i '/id="tn2-live-grid"/i <div id="tennis-live-section"></div>' "$HTML"
    echo "  tennis-live-section div added to page-tennis"
  fi
EOF
echo ""

# ─── Step 4: Run SQL migration ───
echo "=== Step 4/5: Run SQL migration ==="
ssh "$VPS" << 'EOF'
  sqlite3 /var/www/pariscore/pariscore.db < /tmp/migration-players.sql
  echo "  Migration applied — players table created + 10 players seeded"
  
  # Verify
  echo "  Players in DB:"
  sqlite3 /var/www/pariscore/pariscore.db "SELECT gender, COUNT(*) FROM players GROUP BY gender;"
  echo "  With TA metrics:"
  sqlite3 /var/www/pariscore/pariscore.db "SELECT COUNT(*) FROM players WHERE metrics_source = 'tennisabstract';"
EOF
echo ""

# ─── Step 5: Patch server.js with API endpoints ───
echo "=== Step 5/5: Patch server.js + restart ==="
ssh "$VPS" << 'EOF'
  SERVER=/var/www/pariscore/server.js
  
  # Check if already patched
  if grep -q "players/search" "$SERVER"; then
    echo "  server.js already has players API — skipping"
  else
    # Find the line with "forecasts/tennis/trending" and insert after the closing brace
    # of that route block. We'll insert before the football trending route.
    LINE=$(grep -n "forecasts/football/trending" "$SERVER" | head -1 | cut -d: -f1)
    if [ -z "$LINE" ]; then
      echo "  WARNING: Could not find insertion point in server.js"
      echo "  You'll need to manually paste players-api.js content into handleAPI()"
    else
      # Insert the players API code before the football trending route
      sed -i "${LINE}i\\
// ─── Players API (Tennis Live) ───\\
$(cat /tmp/players-api.js)" "$SERVER"
      echo "  Players API endpoints added to server.js (before football trending route)"
    fi
  fi
  
  # Restart pm2
  pm2 restart pariscore
  sleep 2
  pm2 status pariscore | head -5
EOF
echo ""

echo "╔══════════════════════════════════════════════════╗"
echo "║  Deploy complete!                               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Verify:"
echo "  curl https://pariscore.fr/api/v1/players/top10?surface=hard&gender=ATP"
echo "  curl https://pariscore.fr/api/v1/players/search?q=sinner"
echo "  curl https://pariscore.fr/api/v1/players/sinner-jannik"
echo ""
echo "Then open https://pariscore.fr → Tennis tab → Tennis Live section should appear"
