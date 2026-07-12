#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-cycling-translate-cron.sh
# Installe le cron qui traduit progressivement les étapes du TdF 2026 via Gemini.
#
# Stratégie anti-429 : le quota free de Gemini est limité (~1500 req/jour, reset
# vers minuit PST). Au lieu de lancer 500 traductions en rafale (qui déclenche
# immédiatement des 429), ce cron tourne toutes les 30 min et ne traduit qu'UNE
# étape manquante par exécution (--next-missing). Ainsi :
#   - 21 étapes × 6 langues × 3 champs ≈ 378 traductions
#   - À 1 étape (= ~3-4 champs × nb langues) toutes les 30 min → complet en ~3-4h
#   - On reste très en dessous du quota, jamais de 429
#
# Usage:
#   bash setup-cycling-translate-cron.sh              # installe le cron (FR d'abord)
#   bash setup-cycling-translate-cron.sh --lang fr,es # change les langues ciblées
#   bash setup-cycling-translate-cron.sh --status     # état + avancement
#   bash setup-cycling-translate-cron.sh --remove     # supprime le cron
#   bash setup-cycling-translate-cron.sh --test       # lance 1 traduction maintenant
#
# Prérequis: GEMINI_API_KEY dans ~/pariscore/.env + @google/generative-ai installé
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PARISCORE_DIR="${PARISCORE_DIR:-$HOME/pariscore}"
SCRAPER="$PARISCORE_DIR/scripts/scraper-cycling-translate.js"
LOG_DIR="$PARISCORE_DIR/logs"
LOG_FILE="$LOG_DIR/cycling-translate-cron.log"
CRON_MARKER="# PARISCORE-CYCLING-TRANSLATE"
# Langues à traduire (FR en premier car langue par défaut de l'app)
LANGS="${CYCLING_TRANSLATE_LANGS:-fr,es,de,it,nl,pt}"

if command -v bun &>/dev/null; then RUNTIME_BIN="bun"
elif command -v node &>/dev/null; then RUNTIME_BIN="node"
else echo "❌ Ni bun ni node installé"; exit 1; fi

if [ ! -f "$SCRAPER" ]; then
    echo "❌ Scraper introuvable à $SCRAPER"
    exit 1
fi

mkdir -p "$LOG_DIR"

# Cron : toutes les 30 min (*/30), traduit 1 étape manquante à la fois
CRON_CMD="*/30 * * * * cd $PARISCORE_DIR && $RUNTIME_BIN $SCRAPER --next-missing --lang $LANGS >> $LOG_FILE 2>&1 $CRON_MARKER"

ACTION="${1:-install}"

case "$ACTION" in
    --status)
        echo "=== État du cron traduction ==="
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            echo "✅ Cron installé :"
            crontab -l 2>/dev/null | grep "$CRON_MARKER" | sed 's/^/   /'
        else
            echo "❌ Cron NON installé"
        fi
        echo ""
        echo "=== Avancement traductions ==="
        cd "$PARISCORE_DIR" && $RUNTIME_BIN -e "
const d = require('./data/cycling/stage-favourites-i18n.json');
const langs = '$LANGS'.split(',');
const stages = Object.keys(d.stages||{}).map(Number).sort((a,b)=>a-b);
console.log('Total étapes:', stages.length);
langs.forEach(l => {
  const count = stages.filter(n => { const i = (d.stages[n].i18n||{})[l]; return i && i.title && i.description; }).length;
  console.log('  ' + l + ':', count + '/21 complètes');
});
" 2>/dev/null || echo "(impossible de lire l'avancement)"
        echo ""
        echo "=== Dernières lignes du log ==="
        [ -f "$LOG_FILE" ] && tail -8 "$LOG_FILE" | sed 's/^/   /' || echo "   (pas de log)"
        ;;

    --remove)
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
            echo "✅ Cron traduction supprimé"
        else
            echo "ℹ️  Cron n'était pas installé"
        fi
        ;;

    install|"")
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
        fi
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo "✅ Cron traduction installé"
        echo "   Fréquence : toutes les 30 min"
        echo "   Langues   : $LANGS"
        echo "   Runtime   : $RUNTIME_BIN"
        echo "   Script    : $SCRAPER"
        echo "   Log       : $LOG_FILE"
        echo "   Stratégie : 1 étape manquante par exécution (anti-429)"
        echo ""
        echo "=== Crontab (lignes traduction) ==="
        crontab -l 2>/dev/null | grep "$CRON_MARKER" | sed 's/^/   /'
        echo ""
        echo "Pour changer les langues : CYCLING_TRANSLATE_LANGS=fr,es bash $0"
        echo "Pour tester : bash $0 --test"
        ;;

    --test)
        echo "=== Test : traduction d'1 étape manquante ==="
        cd "$PARISCORE_DIR" && $RUNTIME_BIN "$SCRAPER" --next-missing --lang "$LANGS"
        ;;

    --lang)
        # Re-installe avec de nouvelles langues
        LANGS="${2:-fr}"
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
        fi
        CRON_CMD="*/30 * * * * cd $PARISCORE_DIR && $RUNTIME_BIN $SCRAPER --next-missing --lang $LANGS >> $LOG_FILE 2>&1 $CRON_MARKER"
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo "✅ Cron réinstallé avec langues: $LANGS"
        ;;

    *)
        echo "Usage: $0 [--status|--remove|--test|--lang fr,es|install]"
        exit 1
        ;;
esac
