#!/usr/bin/env bash
# =====================================================================
# deploy-vps.sh — Déploiement VPS complet avec QA automatique
# =====================================================================
# Workflow :
#   1. git push (s'assure que origin/main est à jour)
#   2. SSH VPS : git pull + bun install + bun run build + pm2 restart
#   3. QA automatique post-deploy (scripts/post-deploy-qa.sh)
#   4. Rapport final : SUCCÈS / ÉCHEC / WARNING
#
# Usage :
#   bash scripts/deploy-vps.sh                  # déploie HEAD courant
#   bash scripts/deploy-vps.sh abc1234          # déploie commit spécifique
#
# Critère d'arrêt : si QA échoue, on NE DIT PAS "c'est bon".
#                   On analyse la cause racine avant d'informer l'utilisateur.
# =====================================================================

set -uo pipefail

# Couleurs
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

SSH_KEY="${USERPROFILE:-$HOME}/.ssh/id_rsa_pariscore"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10"
VPS_HOST="ubuntu@51.75.21.239"
VPS_PATH="/home/ubuntu/.bun/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin"

echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DÉPLOIEMENT VPS PARISCORE — $(date +'%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo ""

# ─── 1. Pre-check : branch main, working tree propre ──────────
echo -e "${BLUE}→ 1/4 Pre-check git${NC}"
BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$BRANCH" != "main" ]; then
  echo -e "${RED}✗ Pas sur main (actuel: $BRANCH). Checkout main d'abord.${NC}"
  exit 1
fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo -e "${YELLOW}⚠ Working tree non-vide — commit ou stash avant deploy${NC}"
  git status --short | head -5
  echo ""
  read -p "Continuer quand même ? (y/N) " -n 1 -r
  echo ""
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

LOCAL_HEAD=$(git rev-parse --short HEAD)
echo -e "${GREEN}✓ Sur main, HEAD=$LOCAL_HEAD, working tree propre${NC}"
echo ""

# ─── 2. Push origin ───────────────────────────────────────────
echo -e "${BLUE}→ 2/4 Push origin/main${NC}"
git push origin main 2>&1 | tail -3
echo ""

# ─── 3. SSH VPS : deploy ──────────────────────────────────────
echo -e "${BLUE}→ 3/4 Déploiement VPS${NC}"
echo "  git pull + bun install + bun run build + pm2 restart..."
echo "  (peut prendre 3-8 minutes)"
echo ""

DEPLOY_OUTPUT=$(ssh -i "$SSH_KEY" $SSH_OPTS $VPS_HOST \
  "export PATH=\"$VPS_PATH\"; cd ~/pariscore && \
   echo '=== git pull ===' && git pull origin main 2>&1 | tail -3 && \
   echo '=== bun install ===' && bun install 2>&1 | tail -2 && \
   echo '=== bun run build ===' && bun run build 2>&1 | tail -8 && \
   echo '=== pm2 restart ===' && pm2 restart pariscore-next 2>&1 | tail -3 && \
   echo '=== pm2 status ===' && pm2 list 2>&1 | grep pariscore-next && \
   echo \"=== DEPLOY DONE \$(date +'%H:%M:%S') ===\"" 2>&1)

echo "$DEPLOY_OUTPUT" | sed 's/^/  /'
echo ""

# Vérifier que le deploy s'est bien passé
if ! echo "$DEPLOY_OUTPUT" | grep -q "DEPLOY DONE"; then
  echo -e "${RED}❌ ÉCHEC DÉPLOIEMENT — SSH ou build cassé${NC}"
  exit 1
fi

# ─── 4. QA automatique post-deploy ────────────────────────────
echo -e "${BLUE}→ 4/4 QA automatique post-deploy${NC}"
echo ""
sleep 5  # Laisser pm2 stabiliser

# Invoquer le QA script
bash "$(dirname "$0")/post-deploy-qa.sh" "$LOCAL_HEAD"
QA_EXIT=$?

echo ""
if [ $QA_EXIT -eq 0 ]; then
  echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ DÉPLOIEMENT COMPLET ET VALIDÉ${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
  exit 0
elif [ $QA_EXIT -eq 2 ]; then
  echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  ⚠️  DÉPLOIEMENT VALIDÉ AVEC WARNINGS${NC}"
  echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
  echo "Vérification manuelle (cache navigateur/SW) recommandée."
  exit 2
else
  echo -e "${RED}══════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}  ❌ DÉPLOIEMENT NON VALIDÉ — frontend probablement cassé${NC}"
  echo -e "${RED}══════════════════════════════════════════════════════════${NC}"
  echo "NE PAS ANNONCER SUCCÈS À L'UTILISATEUR."
  echo "Actions recommandées :"
  echo "  1. SSH VPS : ssh -i \$USERPROFILE/.ssh/id_rsa_pariscore ubuntu@51.75.21.239"
  echo "  2. Logs pm2 : pm2 logs pariscore-next --lines 30"
  echo "  3. Test local : curl http://localhost:3005/ | grep tennis"
  echo "  4. Rollback si critique : git reset --hard <ancien_hash>"
  exit 1
fi
