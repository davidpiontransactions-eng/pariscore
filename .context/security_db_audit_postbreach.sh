#!/bin/bash
# SECURITY — Audit DB prod post-breach (bd ParisScorebis-c8m)
# Usage VPS OVH : bash security_db_audit_postbreach.sh > audit-report.txt
# Fenetre exposition : deploiement initial -> 2026-05-20 00:30 UTC
# Attaquant principal : 37.65.65.25 (telecharge server.js 2026-05-20 00:26:11 UTC)

set -u
DB="/home/ubuntu/pariscore/pariscore.db"
BREACH_START="2026-05-15 00:00:00"   # marge securite, ajuster selon deploy date reelle
BREACH_END="2026-05-21 00:00:00"     # apres fix code commit 4e02a6a

if [ ! -f "$DB" ]; then
  echo "ERROR: DB not found at $DB"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  AUDIT DB POST-BREACH — $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "  Fenetre: $BREACH_START → $BREACH_END"
echo "═══════════════════════════════════════════════════"

echo ""
echo "─── 1. USERS CRÉÉS PENDANT FENÊTRE BREACH ───"
sqlite3 "$DB" "SELECT id, email, role, datetime(created_at,'unixepoch') AS created, subscription_status
  FROM users
  WHERE created_at >= strftime('%s','$BREACH_START')
    AND created_at <= strftime('%s','$BREACH_END')
  ORDER BY created_at DESC;"

echo ""
echo "─── 2. USERS AVEC role != 'freemium' (escalation suspecte) ───"
sqlite3 "$DB" "SELECT id, email, role, datetime(created_at,'unixepoch') AS created
  FROM users
  WHERE role NOT IN ('freemium','admin')
     OR (role='admin' AND created_at >= strftime('%s','$BREACH_START'));"

echo ""
echo "─── 3. PARIS user_bets PENDANT FENÊTRE ───"
sqlite3 "$DB" "SELECT id, user_id, sport, stake_cents, datetime(created_at,'unixepoch') AS created, status
  FROM user_bets
  WHERE created_at >= strftime('%s','$BREACH_START')
    AND created_at <= strftime('%s','$BREACH_END')
  ORDER BY stake_cents DESC LIMIT 50;"

echo ""
echo "─── 4. BANKROLL TRANSACTIONS PENDANT FENÊTRE ───"
sqlite3 "$DB" "SELECT id, user_id, type, amount_cents, datetime(created_at,'unixepoch') AS created
  FROM bankroll_transactions
  WHERE created_at >= strftime('%s','$BREACH_START')
    AND created_at <= strftime('%s','$BREACH_END')
  ORDER BY ABS(amount_cents) DESC LIMIT 50;"

echo ""
echo "─── 5. AFFILIATE_CLICKS / CONVERSIONS PENDANT FENÊTRE ───"
sqlite3 "$DB" "SELECT id, affiliate_id, datetime(clicked_at,'unixepoch') AS clicked, ip_address, user_agent
  FROM affiliate_clicks
  WHERE clicked_at >= strftime('%s','$BREACH_START')
    AND clicked_at <= strftime('%s','$BREACH_END')
  ORDER BY clicked_at DESC LIMIT 100;"

echo ""
echo "─── 6. STRIPE EVENTS (FRAUDE PAIEMENT POSSIBLE) ───"
sqlite3 "$DB" "SELECT id, event_type, datetime(received_at,'unixepoch') AS received, customer_id
  FROM stripe_events
  WHERE received_at >= strftime('%s','$BREACH_START')
    AND received_at <= strftime('%s','$BREACH_END')
  ORDER BY received_at DESC LIMIT 50;" 2>/dev/null || echo "(stripe_events table absent ou query failed)"

echo ""
echo "─── 7. MATCHDAY PASSES ACHATS FENÊTRE ───"
sqlite3 "$DB" "SELECT id, user_id, datetime(purchased_at,'unixepoch') AS purchased, status, amount_cents
  FROM matchday_passes
  WHERE purchased_at >= strftime('%s','$BREACH_START')
    AND purchased_at <= strftime('%s','$BREACH_END')
  ORDER BY purchased_at DESC LIMIT 50;" 2>/dev/null || echo "(matchday_passes columns peuvent differer, audit manuel)"

echo ""
echo "─── 8. PUSH SUBSCRIPTIONS ANORMALES (potentiel spam vector) ───"
sqlite3 "$DB" "SELECT COUNT(*) AS total_subs FROM push_subscriptions;"
sqlite3 "$DB" "SELECT user_id, COUNT(*) AS n_endpoints FROM push_subscriptions GROUP BY user_id HAVING n_endpoints > 3;"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  FIN AUDIT — vérifier manuellement toute ligne suspecte"
echo "  Si compromission confirmée : preserve DB + ouvrir bd dedie"
echo "═══════════════════════════════════════════════════"
