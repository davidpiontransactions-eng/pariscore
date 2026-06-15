#!/bin/bash
set -e

# ============================================================
# scripts/grant-pro.sh — Upgrade PRO express (SSH → VPS)
# Usage: ./scripts/grant-pro.sh <email> [days]
#   email : email de l'utilisateur à passer Pro (obligatoire)
#   days  : durée en jours (défaut: 365)
#
# Exemples :
#   ./scripts/grant-pro.sh kingdumixi@gmail.com 36
#   ./scripts/grant-pro.sh user@test.com
# ============================================================

EMAIL="$1"
DAYS="${2:-365}"

if [ -z "$EMAIL" ]; then
  echo "❌ Usage: $0 <email> [days]"
  echo "   Ex:  $0 kingdumixi@gmail.com 36"
  exit 1
fi

echo "🔍 Vérification de $EMAIL sur le VPS..."

USER_JSON=$(ssh pariscore "cd /home/ubuntu/pariscore && node -e '
const DB = require(\"better-sqlite3\");
const db = new DB(\"pariscore.db\");
const u = db.prepare(\"SELECT id, email, role, datetime(premium_until, \\\"unixepoch\\\") as expiry FROM users WHERE email = ?\").get(\"'"$EMAIL"'\");
if (!u) { console.log(\"NOT_FOUND\"); process.exit(1); }
console.log(JSON.stringify(u));
db.close();
'")

if [ "$USER_JSON" = "NOT_FOUND" ]; then
  echo "❌ Utilisateur $EMAIL introuvable sur la prod."
  exit 1
fi

echo "📋 Statut : $USER_JSON"

CURRENT_ROLE=$(echo "$USER_JSON" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).role))")

if [ "$CURRENT_ROLE" = "pro_all" ]; then
  echo "⚠️  Déjà PRO ! Aucune modif nécessaire."
  echo ""
  echo "🔓 Les cadenas jaunes viennent d'un VIEUX JWT (30j validité)."
  echo "   Solution : l'utilisateur se déconnecte et reconnecte."
  echo ""
  echo "   Alternative (console F12) :"
  echo "   fetch('/api/v1/auth/me',{headers:{Authorization:'Bearer '+localStorage.getItem(\"ps_user_token\")}})"
  echo "   .then(r=>r.json()).then(d=>{if(d.token){localStorage.setItem('ps_user_token',d.token);location.reload()}})"
  exit 0
fi

echo "🚀 Upgrade $EMAIL → PRO_ALL pour ${DAYS} jours..."
ssh pariscore "cd /home/ubuntu/pariscore && node tools/grant-pro-access.js --email='$EMAIL' --days=$DAYS"

echo ""
echo "✅ Upgrade terminé !"
echo "📌 L'utilisateur doit se DÉCONNECTER puis RECONNECTER pour que les cadenas disparaissent."
