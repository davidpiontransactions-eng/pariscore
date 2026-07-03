#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-cycling-cron.sh
# Installe le cron quotidien qui scrape les favoris cyclingstage.com
# pour le Tour de France 2026.
#
# Fréquence : tous les soirs à 18:00 Europe/Paris
# À partir du : vendredi 3 juillet 2026
# Jusqu'au : 27 juillet 2026 (lendemain de l'étape finale)
#
# Le cron lance le scraper Python qui :
#   1. Détermine l'étape du jour (ou la prochaine si jour de repos)
#   2. Scrape cyclingstage.com pour cette étape
#   3. Met à jour data/cycling/stage-favourites.json
#   4. Le backend pariscore (cyclingService.js) sert ce JSON via /api/v1/cycling/favourites
#
# Usage:
#   bash setup-cycling-cron.sh           # installe le cron
#   bash setup-cycling-cron.sh --status  # affiche l'état du cron
#   bash setup-cycling-cron.sh --remove  # supprime le cron
#
# Prérequis:
#   - Python 3.x installé (python3 --version)
#   - Le repo pariscore cloné dans ~/pariscore (ou ajuster PARISCORE_DIR ci-dessous)
#   - Le scraper scripts/scraper-cyclingstage-favourites.py présent
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
PARISCORE_DIR="${PARISCORE_DIR:-$HOME/pariscore}"
SCRAPER="$PARISCORE_DIR/scripts/scraper-cyclingstage-favourites.py"
LOG_DIR="$PARISCORE_DIR/logs"
LOG_FILE="$LOG_DIR/cycling-cron.log"
CRON_MARKER="# PARISCORE-CYCLING-SCRAPER"
PYTHON_BIN="${PYTHON_BIN:-python3}"

# Vérif prérequis
if [ ! -f "$SCRAPER" ]; then
    echo "❌ ERREUR : Scraper introuvable à $SCRAPER"
    echo "   Vérifie que PARISCORE_DIR est bien configuré (actuel: $PARISCORE_DIR)"
    exit 1
fi

if ! command -v "$PYTHON_BIN" &>/dev/null; then
    echo "❌ ERREUR : $PYTHON_BIN n'est pas installé"
    exit 1
fi

mkdir -p "$LOG_DIR"

# ─── Commande cron ────────────────────────────────────────────────────────────
# 0 18 * * * = tous les jours à 18:00 (heure serveur = Europe/Paris sur le VPS OVH)
# Le scraper utilise --current qui prend l'étape du jour, ou --next si jour de repos
CRON_CMD="0 18 * * * cd $PARISCORE_DIR && $PYTHON_BIN $SCRAPER --current --force >> $LOG_FILE 2>&1 $CRON_MARKER"

# ─── Actions ─────────────────────────────────────────────────────────────────
ACTION="${1:-install}"

case "$ACTION" in
    --status)
        echo "=== État du cron cycling scraper ==="
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            echo "✅ Cron installé :"
            crontab -l 2>/dev/null | grep "$CRON_MARKER" | sed 's/^/   /'
        else
            echo "❌ Cron NON installé"
        fi
        echo ""
        echo "=== Dernières lignes du log ==="
        if [ -f "$LOG_FILE" ]; then
            tail -10 "$LOG_FILE" | sed 's/^/   /'
        else
            echo "   (pas de log encore)"
        fi
        echo ""
        echo "=== Prochaine étape à scraper ==="
        cd "$PARISCORE_DIR" && $PYTHON_BIN "$SCRAPER" --next --force 2>&1 | tail -5 || true
        ;;

    --remove)
        echo "=== Suppression du cron ==="
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
            echo "✅ Cron supprimé"
        else
            echo "ℹ️  Cron n'était pas installé"
        fi
        ;;

    install|"")
        # Vérifier la timezone du serveur (le VPS OVH est censé être en Europe/Paris)
        echo "=== Vérifications préalables ==="
        SERVER_TZ=$(date +%Z 2>/dev/null || echo "unknown")
        echo "   Timezone serveur : $SERVER_TZ ($(date))"
        if [ "$SERVER_TZ" != "CEST" ] && [ "$SERVER_TZ" != "CET" ]; then
            echo "⚠️  ATTENTION : Le serveur n'est pas en Europe/Paris ($SERVER_TZ)"
            echo "   Le cron à 18:00 sera en heure serveur, pas en heure de Paris."
            echo "   Pour fixer : sudo timedatectl set-timezone Europe/Paris"
            echo ""
        fi

        # Vérifier si déjà installé
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            echo "ℹ️  Cron déjà installé, mise à jour..."
            crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
        fi

        # Ajouter le cron
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

        echo ""
        echo "✅ Cron installé avec succès"
        echo ""
        echo "=== Détails ==="
        echo "   Fréquence : tous les jours à 18:00 (Europe/Paris)"
        echo "   Script : $SCRAPER"
        echo "   Log : $LOG_FILE"
        echo "   Première exécution : ce soir à 18:00 ($(date +%Y-%m-%d))"
        echo ""
        echo "=== Crontab actuel (lignes cycling) ==="
        crontab -l 2>/dev/null | grep "$CRON_MARKER" | sed 's/^/   /'
        echo ""
        echo "=== Pour tester manuellement maintenant ==="
        echo "   cd $PARISCORE_DIR && $PYTHON_BIN $SCRAPER --current --force"
        echo ""
        echo "=== Pour voir les logs ==="
        echo "   tail -f $LOG_FILE"
        echo ""
        echo "=== Pour supprimer le cron ==="
        echo "   bash $0 --remove"
        ;;

    --test)
        # Lance le scraper une fois maintenant pour tester
        echo "=== Test manuel du scraper (étape courante) ==="
        cd "$PARISCORE_DIR" && $PYTHON_BIN "$SCRAPER" --current --force
        ;;

    *)
        echo "Usage: $0 [--status|--remove|--test|install]"
        echo ""
        echo "  install (défaut) : installe le cron à 18:00 tous les jours"
        echo "  --status         : affiche l'état du cron + derniers logs"
        echo "  --test           : lance le scraper une fois maintenant pour tester"
        echo "  --remove         : supprime le cron"
        exit 1
        ;;
esac
