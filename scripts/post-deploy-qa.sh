#!/usr/bin/env bash
# =====================================================================
# post-deploy-qa.sh — QA automatique post-déploiement VPS
# =====================================================================
# À lancer APRÈS chaque `pm2 restart pariscore-next` pour valider que :
#   1. Le frontend a bien été rebuild avec les nouveaux composants
#   2. Les APIs répondent correctement
#   3. Le HTML rendu SSR contient les composants attendus
#   4. Pas de cache CDN/SW bloquant
#   5. Pas d'erreurs console critiques
#
# Usage :
#   bash scripts/post-deploy-qa.sh [commit_hash] [url]
#
#   commit_hash : hash git local à vérifier côté VPS (défaut: HEAD local)
#   url         : URL prod à tester (défaut: https://pariscore.fr/)
#
# Exit codes :
#   0 = tout OK (frontend validé)
#   1 = échec critique (frontend probablement cassé ou non déployé)
#   2 = warning (APIs OK mais composants attendus manquants — cache suspect)
# =====================================================================

set -uo pipefail

COMMIT_HASH="${1:-$(git rev-parse --short HEAD)}"
PROD_URL="${2:-https://pariscore.fr/}"
SSH_KEY="${USERPROFILE:-$HOME}/.ssh/id_rsa_pariscore"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10"
VPS_HOST="ubuntu@51.75.21.239"
VPS_PATH="/home/ubuntu/.bun/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin"

# Couleurs (si terminal le supporte)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

PASS=0
WARN=0
FAIL=0
WARNINGS=""
FAILURES=""

log_pass() { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; WARN=$((WARN+1)); WARNINGS="${WARNINGS}\n  - $1"; }
log_fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL+1)); FAILURES="${FAILURES}\n  - $1"; }
log_info() { echo -e "${BLUE}→${NC} $1"; }

echo "============================================================"
echo "  POST-DEPLOY QA — $(date +'%Y-%m-%d %H:%M:%S')"
echo "  Commit attendu : ${COMMIT_HASH}"
echo "  URL prod       : ${PROD_URL}"
echo "============================================================"
echo ""

# ─── 1. Vérification sync git local vs VPS ─────────────────────
log_info "1/6 Vérification sync git local ↔ VPS"

LOCAL_HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo "inconnu")
VPS_HEAD=$(ssh -i "$SSH_KEY" $SSH_OPTS $VPS_HOST \
  "export PATH=\"$VPS_PATH\"; cd ~/pariscore && git rev-parse --short HEAD" 2>/dev/null || echo "SSH_FAILED")

if [ "$VPS_HEAD" = "SSH_FAILED" ]; then
  log_fail "SSH VPS inaccessible"
elif [ "$LOCAL_HEAD" = "$VPS_HEAD" ]; then
  log_pass "Git sync OK (local=$LOCAL_HEAD, VPS=$VPS_HEAD)"
else
  log_fail "Git DÉSYNC : local=$LOCAL_HEAD, VPS=$VPS_HEAD — git pull oublié sur VPS"
fi

# ─── 2. Vérification build récent sur VPS ─────────────────────
log_info "2/6 Vérification build récent VPS"

BUILD_INFO=$(ssh -i "$SSH_KEY" $SSH_OPTS $VPS_HOST \
  "export PATH=\"$VPS_PATH\"; cd ~/pariscore && \
   stat -c '%Y' .next/standalone/server.js 2>/dev/null && \
   ls .next/standalone/.next/static/css/*.css 2>/dev/null | head -1 && \
   ls .next/standalone/.next/static/chunks/*.js 2>/dev/null | wc -l" 2>/dev/null)

BUILD_TS=$(echo "$BUILD_INFO" | head -1)
CSS_FILE=$(echo "$BUILD_INFO" | head -2 | tail -1)
JS_CHUNK_COUNT=$(echo "$BUILD_INFO" | tail -1)

if [ -z "$BUILD_TS" ]; then
  log_fail "Build introuvable (.next/standalone/server.js absent)"
else
  BUILD_AGE=$(( $(date +%s) - BUILD_TS ))
  if [ "$BUILD_AGE" -lt 600 ]; then
    log_pass "Build récent (${BUILD_AGE}s < 10min)"
  else
    log_warn "Build ancien (${BUILD_AGE}s > 10min) — vérifier bun run build"
  fi
fi

if [ -n "$JS_CHUNK_COUNT" ] && [ "$JS_CHUNK_COUNT" -gt 10 ]; then
  log_pass "Assets JS copiés dans standalone (${JS_CHUNK_COUNT} chunks)"
else
  log_fail "Assets JS manquants dans standalone (build incomplet)"
fi

# ─── 3. Vérification pm2 status ───────────────────────────────
log_info "3/6 Vérification pm2 pariscore-next"

PM2_STATUS=$(ssh -i "$SSH_KEY" $SSH_OPTS $VPS_HOST \
  "export PATH=\"$VPS_PATH\"; pm2 list 2>&1 | grep pariscore-next" 2>/dev/null)

if echo "$PM2_STATUS" | grep -q "online"; then
  UPTIME=$(echo "$PM2_STATUS" | awk '{print $8}')
  log_pass "pariscore-next online (uptime ${UPTIME})"
else
  log_fail "pariscore-next DOWN ou absent"
fi

# ─── 4. Test HTTP page d'accueil ──────────────────────────────
log_info "4/6 Test HTTP page d'accueil"

HOME_RESPONSE=$(curl -sS -o /tmp/pariscore-qa.html \
  -w "%{http_code}|%{size_download}|%{time_total}" \
  -H "Cache-Control: no-cache" \
  -H "Pragma: no-cache" \
  "${PROD_URL}?qa=$(date +%s)" 2>/dev/null)

HTTP_CODE=$(echo "$HOME_RESPONSE" | cut -d'|' -f1)
SIZE=$(echo "$HOME_RESPONSE" | cut -d'|' -f2)
TIME=$(echo "$HOME_RESPONSE" | cut -d'|' -f3)

if [ "$HTTP_CODE" = "200" ]; then
  log_pass "HTTP 200 (${SIZE} bytes, ${TIME}s)"
else
  log_fail "HTTP ${HTTP_CODE} (attendu 200)"
fi

# ─── 5. Vérification présence composants tennis dans HTML ─────
log_info "5/6 Vérification composants tennis dans HTML rendu"

# Ces mots-clés devraient être présents si le SSR fonctionne
TENNIS_MARKERS=("SetPoint" "tennis" "tournament" "Elo" "match-card")
FOUND=0
for marker in "${TENNIS_MARKERS[@]}"; do
  if grep -q "$marker" /tmp/pariscore-qa.html 2>/dev/null; then
    FOUND=$((FOUND+1))
  fi
done

if [ "$FOUND" -ge 3 ]; then
  log_pass "Composants tennis présents dans SSR (${FOUND}/${#TENNIS_MARKERS[@]})"
else
  log_fail "Composants tennis manquants dans SSR (${FOUND}/${#TENNIS_MARKERS[@]}) — build ou hydration cassé"
fi

# Check i18n non traduits (devraient être ABSENTS)
if grep -qE "tennis\.[a-z]+|match\.[a-z]+" /tmp/pariscore-qa.html 2>/dev/null; then
  log_warn "Tokens i18n non traduits détectés dans HTML"
else
  log_pass "Aucun token i18n brut détecté"
fi

# ─── 6. Test APIs critiques ───────────────────────────────────
log_info "6/6 Test APIs tennis"

# API search
SEARCH_CODE=$(curl -sS -o /tmp/qa-search.json \
  -w "%{http_code}" "${PROD_URL%/}/api/tennis/search?q=test" 2>/dev/null)
if [ "$SEARCH_CODE" = "200" ] && jq -e '.total != null' /tmp/qa-search.json >/dev/null 2>&1; then
  log_pass "API /api/tennis/search (HTTP ${SEARCH_CODE})"
else
  log_warn "API /api/tennis/search problématique (HTTP ${SEARCH_CODE})"
fi

# API tournaments
TOURNAMENTS_CODE=$(curl -sS -o /tmp/qa-tournaments.json \
  -w "%{http_code}" "${PROD_URL%/}/api/tennis/tournaments" 2>/dev/null)
if [ "$TOURNAMENTS_CODE" = "200" ] && jq -e '.tournaments | length > 0' /tmp/qa-tournaments.json >/dev/null 2>&1; then
  log_pass "API /api/tennis/tournaments (HTTP ${TOURNAMENTS_CODE})"
else
  log_warn "API /api/tennis/tournaments problématique (HTTP ${TOURNAMENTS_CODE})"
fi

# ─── Récap ────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  RÉCAP QA POST-DEPLOY"
echo "============================================================"
echo -e "  ${GREEN}✓ Pass${NC} : $PASS"
echo -e "  ${YELLOW}⚠ Warn${NC} : $WARN"
echo -e "  ${RED}✗ Fail${NC} : $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ DÉPLOIEMENT NON VALIDÉ${NC} — actions requises :"
  echo -e "$FAILURES"
  echo ""
  echo "Actions recommandées :"
  echo "  1. SSH dans VPS : ssh -i \$USERPROFILE/.ssh/id_rsa_pariscore ubuntu@51.75.21.239"
  echo "  2. Vérifier build : cd ~/pariscore && bun run build"
  echo "  3. Vérifier assets : ls .next/standalone/.next/static/"
  echo "  4. Restart pm2 : pm2 restart pariscore-next"
  echo "  5. Re-run QA : bash scripts/post-deploy-qa.sh"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  DÉPLOIEMENT VALIDÉ AVEC WARNINGS${NC}"
  echo -e "$WARNINGS"
  echo ""
  echo "Vérification manuelle recommandée (cache SW/nginx) :"
  echo "  - Navigation privée : ${PROD_URL}"
  echo "  - Hard refresh : Ctrl+F5"
  echo "  - Cache-buster : ${PROD_URL}?v=\$(date +%s)"
  exit 2
else
  echo -e "${GREEN}✅ DÉPLOIEMENT VALIDÉ — frontend opérationnel${NC}"
  exit 0
fi
