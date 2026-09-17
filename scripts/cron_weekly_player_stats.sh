#!/bin/bash
# cron_weekly_player_stats.sh — Refresh hebdomadaire des stats joueurs snooker
# Exécuté tous les lundis à 06:00 UTC via cron
# Met à jour : cuetracker_matches.json (stats joueurs + rankings)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
LOG_FILE="$PROJECT_DIR/logs/weekly-stats-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="$DATA_DIR/backup"

mkdir -p "$PROJECT_DIR/logs" "$BACKUP_DIR"

echo "=== Weekly Player Stats Refresh ===" | tee "$LOG_FILE"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"

# Backup avant update
if [ -f "$DATA_DIR/cuetracker_matches.json" ]; then
  cp "$DATA_DIR/cuetracker_matches.json" "$BACKUP_DIR/cuetracker_matches_$(date +%Y%m%d).json"
  echo "Backup créé: cuetracker_matches_$(date +%Y%m%d).json" | tee -a "$LOG_FILE"
fi

# Lancer le scraper CueTracker
echo "Lancement du scraper CueTracker..." | tee -a "$LOG_FILE"
cd "$PROJECT_DIR"

if python3 "$SCRIPT_DIR/scrape_cuetracker.py" >> "$LOG_FILE" 2>&1; then
  echo "Scraper CueTracker terminé avec succès" | tee -a "$LOG_FILE"
else
  echo "ERREUR: Scraper CueTracker échoué" | tee -a "$LOG_FILE"
  exit 1
fi

# Vérifier que le fichier a été mis à jour
if [ -f "$DATA_DIR/cuetracker_matches.json" ]; then
  NEW_DATE=$(node -e "const d=require('$DATA_DIR/cuetracker_matches.json'); console.log(d.scraped_at)")
  NEW_COUNT=$(node -e "const d=require('$DATA_DIR/cuetracker_matches.json'); console.log(d.total_players)")
  echo "Fichier mis à jour: $NEW_DATE ($NEW_COUNT joueurs)" | tee -a "$LOG_FILE"
else
  echo "ERREUR: Fichier cuetracker_matches.json manquant après scraper" | tee -a "$LOG_FILE"
  exit 1
fi

# Nettoyer les backups de +30 jours
find "$BACKUP_DIR" -name "cuetracker_matches_*.json" -mtime +30 -delete 2>/dev/null || true

# Copier les données vers /opt/pariscorebis (cwd pm2)
PM2_DATA="/opt/pariscorebis/data"
if [ -d "$PM2_DATA" ]; then
  cp "$DATA_DIR/cuetracker_matches.json" "$PM2_DATA/" 2>/dev/null || true
  echo "Données copiées vers $PM2_DATA" | tee -a "$LOG_FILE"
fi

echo "=== Refresh terminé ===" | tee -a "$LOG_FILE"
