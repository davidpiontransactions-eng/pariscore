#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pariscore Design System Fix — Application via git patch (alternative)
# Applique les 18 patches git séquentiellement sur un repo Pariscore local.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$SCRIPT_DIR/patches"
TARGET_REPO=""

usage() {
    cat <<EOF
Usage: $0 --repo <path>

Applique les 18 patches git séquentiellement sur le repo Pariscore cible.
Contrairement à apply-fix.sh (qui copie les fichiers), cette méthode préserve
l'historique git commit par commit — utile pour review et cherry-pick.

OPTIONS:
  --repo <path>   Chemin du repo Pariscore local (OBLIGATOIRE)
  --help, -h      Affiche cette aide

EXEMPLE:
  $0 --repo ~/projects/pariscore

 après application :
  - 18 commits créés sur une nouvelle branche fix/design-system-audit
  - git log --oneline affiche les 18 commits P0..P4
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --repo) TARGET_REPO="$2"; shift 2 ;;
        --help|-h) usage ;;
        *) echo -e "${RED}Option inconnue: $1${NC}"; usage ;;
    esac
done

[[ -z "$TARGET_REPO" ]] && { echo -e "${RED}Erreur: --repo est obligatoire${NC}"; usage; }
[[ ! -d "$TARGET_REPO" ]] && { echo -e "${RED}Erreur: '$TARGET_REPO' n'existe pas${NC}"; exit 1; }

cd "$TARGET_REPO"

# Vérifie que le repo est propre
if [[ -n "$(git status --porcelain)" ]]; then
    echo -e "${RED}Erreur: le repo a des modifications non committées. Commit ou stash avant d'appliquer les patches.${NC}"
    git status --short
    exit 1
fi

# Crée une nouvelle branche
BRANCH="fix/design-system-audit"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo -e "${YELLOW}La branche '$BRANCH' existe déjà. Checkout...${NC}"
    git checkout "$BRANCH"
else
    echo -e "${BLUE}Création de la branche '$BRANCH'...${NC}"
    git checkout -b "$BRANCH"
fi

echo ""
echo -e "${BLUE}Application des 18 patches...${NC}"
echo ""

PATCHES=($(ls "$PATCHES_DIR"/*.patch | sort))
TOTAL=${#PATCHES[@]}
APPLIED=0
FAILED=0

for i in "${!PATCHES[@]}"; do
    patch="${PATCHES[$i]}"
    patch_name=$(basename "$patch")
    num=$((i + 1))

    echo -e "${BLUE}[$num/$TOTAL] $patch_name${NC}"

    if git apply --check "$patch" 2>/dev/null; then
        git am "$patch" > /dev/null 2>&1 && {
            echo -e "  ${GREEN}✓ Appliqué${NC}"
            APPLIED=$((APPLIED + 1))
        } || {
            # Fallback : git apply si git am échoue (pas de contexte commit)
            if git apply "$patch" 2>/dev/null; then
                COMMIT_MSG=$(grep -m1 "^Subject:" "$patch" | sed 's/^Subject: \[PATCH\] //')
                git add -A
                git commit -m "$COMMIT_MSG" > /dev/null 2>&1 && {
                    echo -e "  ${GREEN}✓ Appliqué (git apply + commit)${NC}"
                    APPLIED=$((APPLIED + 1))
                }
            else
                echo -e "  ${RED}✗ Échec — conflit${NC}"
                git am --abort 2>/dev/null || true
                FAILED=$((FAILED + 1))
                echo -e "  ${YELLOW}Résoudre manuellement ou utiliser apply-fix.sh pour installation par copie${NC}"
            fi
        }
    else
        echo -e "  ${YELLOW}⚠ Patch ne s'applique pas proprement — tentative git apply --3way${NC}"
        if git apply --3way "$patch" 2>/dev/null; then
            git add -A
            git commit -m "$(grep -m1 '^Subject:' "$patch" | sed 's/^Subject: \[PATCH\] //')" > /dev/null 2>&1 && {
                echo -e "  ${GREEN}✓ Appliqué (3-way merge)${NC}"
                APPLIED=$((APPLIED + 1))
            }
        else
            echo -e "  ${RED}✗ Échec${NC}"
            FAILED=$((FAILED + 1))
        fi
    fi
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Patches appliqués : ${GREEN}$APPLIED / $TOTAL${NC}"
[[ $FAILED -gt 0 ]] && echo -e "Patches échoués   : ${RED}$FAILED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Branche : ${GREEN}$BRANCH${NC}"
echo -e "Commits : ${GREEN}$(git log --oneline main..HEAD 2>/dev/null | wc -l)${NC}"
echo ""

if [[ $FAILED -gt 0 ]]; then
    echo -e "${YELLOW}⚠ $FAILED patches n'ont pas pu être appliqués automatiquement.${NC}"
    echo -e "  Alternatives :"
    echo -e "  1. Utiliser apply-fix.sh (copie directe des fichiers, pas de git history)"
    echo -e "  2. Résoudre les conflits manuellement : git status puis git mergetool"
    echo ""
else
    echo -e "${GREEN}✓ Tous les patches appliqués avec succès${NC}"
    echo ""
    echo -e "${YELLOW}Prochaines étapes :${NC}"
    echo -e "  git log --oneline main..HEAD  # voir les 18 commits"
    echo -e "  git push origin $BRANCH      # pousser la branche"
    echo ""
fi
