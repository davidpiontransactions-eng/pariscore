#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pariscore Design System Fix — Installation automatique
# Applique les 19 fichiers corrigés sur un repo Pariscore local.
# Branche source : fix/design-system-audit (18 commits)
# Conformité charte : 18,9% → ~80% · WCAG AA : 13/19 → 15/19
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Couleurs pour sortie terminal ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Variables ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR=""
TARGET_REPO=""
DRY_RUN=false
SKIP_BACKUP=false
SKIP_VERIFY=false

# ── Aide ──
usage() {
    cat <<EOF
Usage: $0 --repo <path> [options]

OPTIONS:
  --repo <path>        Chemin du repo Pariscore local (OBLIGATOIRE)
  --backup-dir <path>  Dossier de backup (défaut: <repo>/.design-fix-backup-<timestamp>)
  --dry-run            Simulation : affiche les actions sans les exécuter
  --skip-backup        Pas de backup (DÉCONSEILLÉ)
  --skip-verify        Pas de vérification post-installation
  --help, -h           Affiche cette aide

EXEMPLES:
  # Installation standard avec backup automatique
  $0 --repo ~/projects/pariscore

  # Simulation pour voir ce qui serait fait
  $0 --repo ~/projects/pariscore --dry-run

  # Sans backup (risqué)
  $0 --repo ~/projects/pariscore --skip-backup

EFFET:
  - Crée un backup horodaté des 19 fichiers avant remplacement
  - Copie les 19 fichiers corrigés aux bons emplacements
  - Vérifie que les fichiers sont bien en place
  - Vérifie que le repo est dans un état git sain

 après installation :
  cd <repo>
  git checkout -b fix/design-system-audit
  git add -A
  git commit -m "fix(design): apply Pariscore design system audit corrections (P0-P4)"
  git push origin fix/design-system-audit

EOF
    exit 0
}

# ── Parsing args ──
while [[ $# -gt 0 ]]; do
    case $1 in
        --repo) TARGET_REPO="$2"; shift 2 ;;
        --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-backup) SKIP_BACKUP=true; shift ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --help|-h) usage ;;
        *) echo -e "${RED}Option inconnue: $1${NC}"; usage ;;
    esac
done

# ── Validation ──
if [[ -z "$TARGET_REPO" ]]; then
    echo -e "${RED}Erreur: --repo est obligatoire${NC}"
    usage
fi

if [[ ! -d "$TARGET_REPO" ]]; then
    echo -e "${RED}Erreur: le repo '$TARGET_REPO' n'existe pas${NC}"
    exit 1
fi

if [[ ! -d "$TARGET_REPO/.git" ]] && ! git -C "$TARGET_REPO" rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${YELLOW}Attention: '$TARGET_REPO' n'est pas un repo git. Continue? [y/N]${NC}"
    read -r response
    [[ "$response" =~ ^[yY] ]] || exit 0
fi

# ── Vérification que le repo est bien Pariscore ──
if [[ ! -f "$TARGET_REPO/pariscore.html" ]] && [[ ! -f "$TARGET_REPO/frontend/package.json" ]]; then
    echo -e "${RED}Erreur: '$TARGET_REPO' ne ressemble pas à un repo Pariscore${NC}"
    echo "  (attendu: pariscore.html et frontend/package.json présents)"
    exit 1
fi

# ── Timestamp pour backup ──
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
if [[ -z "$BACKUP_DIR" ]]; then
    BACKUP_DIR="$TARGET_REPO/.design-fix-backup-$TIMESTAMP"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Pariscore Design System Fix — Installation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Repo cible : ${GREEN}$TARGET_REPO${NC}"
echo -e "Backup     : ${GREEN}$BACKUP_DIR${NC}"
echo -e "Dry-run    : $([ "$DRY_RUN" = true ] && echo "${YELLOW}OUI${NC}" || echo "${GREEN}NON${NC}")"
echo -e "Backup     : $([ "$SKIP_BACKUP" = true ] && echo "${RED}DÉSACTIVÉ${NC}" || echo "${GREEN}ACTIVÉ${NC}")"
echo ""

# ── Définition des fichiers à installer ──
# Format: "chemin_source_relatif_au_package | chemin_cible_relatif_au_repo"
declare -a FILES=(
    "frontend/index.html|frontend/index.html"
    "frontend/src/App.tsx|frontend/src/App.tsx"
    "frontend/src/index.css|frontend/src/index.css"
    "frontend/src/styles/tokens.css|frontend/src/styles/tokens.css"
    "frontend/src/components/KeyFactors.tsx|frontend/src/components/KeyFactors.tsx"
    "frontend/src/components/MatchCard.tsx|frontend/src/components/MatchCard.tsx"
    "frontend/src/components/MatchesTab.tsx|frontend/src/components/MatchesTab.tsx"
    "frontend/src/components/PlayerProfileModal.tsx|frontend/src/components/PlayerProfileModal.tsx"
    "frontend/src/components/mma/StanceBadge.tsx|frontend/src/components/mma/StanceBadge.tsx"
    "frontend/src/components/mma/StyleMatchupBadge.tsx|frontend/src/components/mma/StyleMatchupBadge.tsx"
    "frontend/src/pages/Dashboard.tsx|frontend/src/pages/Dashboard.tsx"
    "frontend/src/pages/H2HPage.tsx|frontend/src/pages/H2HPage.tsx"
    "frontend/src/pages/MMAPreMatch.tsx|frontend/src/pages/MMAPreMatch.tsx"
    "frontend/src/pages/PreMatch.tsx|frontend/src/pages/PreMatch.tsx"
    "mobile/lib/core/theme/app_colors.dart|mobile/lib/core/theme/app_colors.dart"
    "mobile/lib/core/theme/app_text_styles.dart|mobile/lib/core/theme/app_text_styles.dart"
    "mobile/lib/core/theme/app_theme.dart|mobile/lib/core/theme/app_theme.dart"
    "standalone/pariscore.html|pariscore.html"
    "standalone/vps_pariscore.html|vps/pariscore.html"
)

# ── Étape 1 : Backup ──
if [[ "$SKIP_BACKUP" = false ]]; then
    echo -e "${BLUE}[1/4] Création du backup...${NC}"
    if [[ "$DRY_RUN" = true ]]; then
        echo "  (dry-run) Backup serait créé dans: $BACKUP_DIR"
    else
        mkdir -p "$BACKUP_DIR"
        BACKED_UP=0
        MISSING=0
        for entry in "${FILES[@]}"; do
            src="${entry%%|*}"
            dst="${entry##*|}"
            target="$TARGET_REPO/$dst"
            if [[ -f "$target" ]]; then
                mkdir -p "$BACKUP_DIR/$(dirname "$dst")"
                cp "$target" "$BACKUP_DIR/$dst"
                BACKED_UP=$((BACKED_UP + 1))
            else
                MISSING=$((MISSING + 1))
                echo -e "  ${YELLOW}⚠ Fichier cible manquant (sera créé): $dst${NC}"
            fi
        done
        echo -e "  ${GREEN}✓ $BACKED_UP fichiers backupés${NC}"
        [[ $MISSING -gt 0 ]] && echo -e "  ${YELLOW}⚠ $MISSING fichiers cibles manquants (seront créés)${NC}"
    fi
    echo ""
fi

# ── Étape 2 : Vérification des fichiers source ──
echo -e "${BLUE}[2/4] Vérification des fichiers source...${NC}"
SOURCE_OK=0
SOURCE_MISSING=0
for entry in "${FILES[@]}"; do
    src="${entry%%|*}"
    src_path="$PACKAGE_DIR/$src"
    if [[ -f "$src_path" ]]; then
        SOURCE_OK=$((SOURCE_OK + 1))
    else
        SOURCE_MISSING=$((SOURCE_MISSING + 1))
        echo -e "  ${RED}✗ Source manquante: $src${NC}"
    fi
done
if [[ $SOURCE_MISSING -gt 0 ]]; then
    echo -e "${RED}Erreur: $SOURCE_MISSING fichiers source manquants dans le package${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ $SOURCE_OK / ${#FILES[@]} fichiers source présents${NC}"
echo ""

# ── Étape 3 : Installation ──
echo -e "${BLUE}[3/4] Installation des 19 fichiers corrigés...${NC}"
INSTALLED=0
for entry in "${FILES[@]}"; do
    src="${entry%%|*}"
    dst="${entry##*|}"
    src_path="$PACKAGE_DIR/$src"
    dst_path="$TARGET_REPO/$dst"

    if [[ "$DRY_RUN" = true ]]; then
        echo -e "  (dry-run) $src → $dst"
        INSTALLED=$((INSTALLED + 1))
        continue
    fi

    # Crée les dossiers parents si besoin
    mkdir -p "$(dirname "$dst_path")"

    # Copie
    cp "$src_path" "$dst_path"
    INSTALLED=$((INSTALLED + 1))
    echo -e "  ${GREEN}✓${NC} $dst"
done
echo ""
echo -e "  ${GREEN}✓ $INSTALLED / ${#FILES[@]} fichiers installés${NC}"
echo ""

# ── Étape 4 : Vérification post-installation ──
if [[ "$SKIP_VERIFY" = false ]] && [[ "$DRY_RUN" = false ]]; then
    echo -e "${BLUE}[4/4] Vérification post-installation...${NC}"

    # Vérifie que les patterns problématiques ont disparu
    VERIFY_OK=0
    VERIFY_FAIL=0

    # P0 — body.dark-theme ne doit plus contenir #ff1f2d (rouge au lieu de vert)
    if ! grep -q "accent: #ff1f2d" "$TARGET_REPO/pariscore.html" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} body.dark-theme --accent restauré en vert"
        VERIFY_OK=$((VERIFY_OK + 1))
    else
        echo -e "  ${RED}✗${NC} body.dark-theme contient encore --accent: #ff1f2d"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # P0 — body.dark-theme ne doit plus contenir text: #e8eaed (gris au lieu de blanc)
    if ! grep -q "text: #e8eaed" "$TARGET_REPO/pariscore.html" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} body.dark-theme --text restauré en blanc"
        VERIFY_OK=$((VERIFY_OK + 1))
    else
        echo -e "  ${RED}✗${NC} body.dark-theme contient encore --text: #e8eaed"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # P1 — index.html doit contenir les imports Google Fonts
    if grep -q "fonts.googleapis.com/css2?family=Inter" "$TARGET_REPO/frontend/index.html" 2>/dev/null && \
       grep -q "Poppins" "$TARGET_REPO/frontend/index.html" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Google Fonts Poppins + Inter importées dans frontend/index.html"
        VERIFY_OK=$((VERIFY_OK + 1))
    else
        echo -e "  ${RED}✗${NC} Imports Google Fonts manquants dans frontend/index.html"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # P0 — Frontend ne doit plus contenir la syntaxe cassée var(--color-live)'}
    if ! grep -q "var(--color-live)'}" "$TARGET_REPO/frontend/src/pages/Dashboard.tsx" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Bug syntaxique Dashboard.tsx:156 corrigé"
        VERIFY_OK=$((VERIFY_OK + 1))
    else
        echo -e "  ${RED}✗${NC} Dashboard.tsx contient encore la syntaxe cassée"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # P0 — Flutter app_colors.dart doit contenir 0xFF0B0E17 (charte bg-primary)
    if grep -q "0xFF0B0E17" "$TARGET_REPO/mobile/lib/core/theme/app_colors.dart" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Flutter app_colors.dart aligné sur charte (bg = 0xFF0B0E17)"
        VERIFY_OK=$((VERIFY_OK + 1))
    else
        echo -e "  ${RED}✗${NC} Flutter app_colors.dart n'est pas aligné sur charte"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # P0 — Flutter app_text_styles.dart doit utiliser GoogleFonts.poppins
    if grep -q "GoogleFonts.poppins" "$TARGET_REPO/mobile/lib/core/theme/app_text_styles.dart" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Flutter app_text_styles.dart utilise Poppins (charter display)"
        VERIFY_OK=$((VERIFY_OK + 1))
    else
        echo -e "  ${RED}✗${NC} Flutter app_text_styles.dart n'utilise pas Poppins"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    echo ""
    echo -e "  Vérifications: ${GREEN}$VERIFY_OK OK${NC}, ${RED}$VERIFY_FAIL échecs${NC}"
    echo ""

    if [[ $VERIFY_FAIL -gt 0 ]]; then
        echo -e "${RED}⚠ Certaines vérifications ont échoué. Vérifiez manuellement.${NC}"
    fi
fi

# ── Résumé final ──
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation terminée${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Fichiers installés : ${GREEN}$INSTALLED / ${#FILES[@]}${NC}"
[[ "$SKIP_BACKUP" = false ]] && [[ "$DRY_RUN" = false ]] && \
    echo -e "Backup             : ${GREEN}$BACKUP_DIR${NC}"
echo ""

if [[ "$DRY_RUN" = false ]]; then
    echo -e "${YELLOW}Prochaines étapes recommandées :${NC}"
    echo ""
    echo -e "  1. Vérifier le diff git :"
    echo -e "     ${BLUE}cd $TARGET_REPO${NC}"
    echo -e "     ${BLUE}git status${NC}"
    echo -e "     ${BLUE}git diff --stat${NC}"
    echo ""
    echo -e "  2. Créer une branche et committer :"
    echo -e "     ${BLUE}git checkout -b fix/design-system-audit${NC}"
    echo -e "     ${BLUE}git add -A${NC}"
    echo -e "     ${BLUE}git commit -m \"fix(design): apply Pariscore design system audit corrections (P0-P4)\"${NC}"
    echo ""
    echo -e "  3. Tester localement :"
    echo -e "     ${BLUE}# Frontend React${NC}"
    echo -e "     ${BLUE}cd frontend && npm install && npm run dev${NC}"
    echo ""
    echo -e "     ${BLUE}# Flutter mobile${NC}"
    echo -e "     ${BLUE}cd mobile && flutter pub get && flutter run${NC}"
    echo ""
    echo -e "  4. Pousser et ouvrir une PR :"
    echo -e "     ${BLUE}git push origin fix/design-system-audit${NC}"
    echo ""
    echo -e "  5. En cas de problème, restaurer le backup :"
    echo -e "     ${BLUE}cp -r $BACKUP_DIR/* $TARGET_REPO/${NC}"
    echo ""
fi
