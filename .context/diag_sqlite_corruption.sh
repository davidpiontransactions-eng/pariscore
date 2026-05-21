#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# DIAGNOSTIC SQLITE CORRUPTION — pariscore.db
# Bd: ParisScorebis-b50
# ════════════════════════════════════════════════════════════════════
# Usage: bash .context/diag_sqlite_corruption.sh
# Run sur VPS dans /home/ubuntu/pariscore
# ════════════════════════════════════════════════════════════════════

set -e
DB="${1:-pariscore.db}"
LOG="/tmp/sqlite_diag_$(date +%Y%m%d_%H%M%S).txt"

echo "════ Diagnostic SQLite — $DB ════" | tee "$LOG"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 1. Fichiers DB existants
echo "── 1. Fichiers DB ──" | tee -a "$LOG"
ls -lah "$DB"* 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 2. Espace disque
echo "── 2. Espace disque ──" | tee -a "$LOG"
df -h . | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 3. Inode usage (parfois disque "plein" en inodes mais pas en bytes)
echo "── 3. Inode usage ──" | tee -a "$LOG"
df -i . | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 4. Permission + ownership
echo "── 4. Permissions / ownership ──" | tee -a "$LOG"
stat "$DB" 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 5. Test ouverture + magic bytes
echo "── 5. Magic bytes (header) ──" | tee -a "$LOG"
head -c 16 "$DB" | xxd | head -1 | tee -a "$LOG"
echo "(Attendu: '5351 4c69 7465 2066 6f72 6d61 7420 3300' = 'SQLite format 3\\0')" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 6. PRAGMA integrity_check
echo "── 6. PRAGMA integrity_check ──" | tee -a "$LOG"
sqlite3 "$DB" "PRAGMA integrity_check;" 2>&1 | tee -a "$LOG" || echo "ERROR: integrity check failed" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 7. PRAGMA quick_check
echo "── 7. PRAGMA quick_check ──" | tee -a "$LOG"
sqlite3 "$DB" "PRAGMA quick_check;" 2>&1 | tee -a "$LOG" || echo "ERROR: quick check failed" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 8. PRAGMA journal_mode + WAL/SHM presence
echo "── 8. Journal mode ──" | tee -a "$LOG"
sqlite3 "$DB" "PRAGMA journal_mode;" 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 9. Tables présentes
echo "── 9. Schema tables ──" | tee -a "$LOG"
sqlite3 "$DB" ".tables" 2>&1 | tee -a "$LOG" || echo "ERROR: cannot list tables" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 10. Volume api_cache (table mentionnée dans logs runtime)
echo "── 10. api_cache volume ──" | tee -a "$LOG"
sqlite3 "$DB" "SELECT COUNT(*) AS rows, MIN(created_at) AS oldest, MAX(created_at) AS newest FROM api_cache;" 2>&1 | tee -a "$LOG" || echo "ERROR: cannot query api_cache" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 11. Recent pm2 logs SQLITE_NOTADB occurrences
echo "── 11. pm2 logs SQLITE_NOTADB (24h) ──" | tee -a "$LOG"
pm2 logs --nostream --lines 5000 2>/dev/null | grep -iE "(SQLITE_NOTADB|file is not a database|apiCache:.*DB error)" | tail -30 | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 12. Process ouvrant la DB
echo "── 12. Process ouvrant la DB ──" | tee -a "$LOG"
sudo lsof "$DB" 2>&1 | tee -a "$LOG" || echo "(lsof requires sudo)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 13. Backups disponibles
echo "── 13. Backups récents ──" | tee -a "$LOG"
find . -maxdepth 3 -name "*.db.bak*" -o -name "*.db.backup*" -o -name "${DB}.*" 2>/dev/null | head -10 | tee -a "$LOG"
ls -lah backups/ 2>/dev/null | head -10 | tee -a "$LOG" || echo "(no backups/ dir)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

echo "════ Diagnostic terminé ════" | tee -a "$LOG"
echo "Rapport: $LOG"

# ════════════════════════════════════════════════════════════════════
# INTERPRETATION:
#
# ✅ HEALTHY DB:
#    - integrity_check returns 'ok'
#    - magic bytes = 'SQLite format 3\\0'
#    - api_cache rows count consistent (>0 normalement)
#    - PAS d'erreurs SQLITE_NOTADB dans logs 24h
#
# ⚠️ DEGRADED:
#    - integrity_check: warnings (corruption mineure) → recovery possible
#    - WAL/SHM trop volumineux (>10% DB size) → vacuum recommandé
#    - inode usage > 90% → cleanup logs/cache
#
# 🔴 CORRUPTED:
#    - integrity_check: errors fatales → restore from backup
#    - magic bytes incorrects → fichier overwritten (PAS un SQLite)
#    - disque plein → urgence: cleanup + restore
#
# ════════════════════════════════════════════════════════════════════
# RECOVERY PROCEDURE si corruption confirmée:
#
# 1. STOP server
#    pm2 stop pariscore
#
# 2. Backup l'état corrompu (forensic)
#    cp pariscore.db /tmp/pariscore.db.CORRUPTED_$(date +%Y%m%d_%H%M%S)
#
# 3. Restore from latest backup
#    cp backups/pariscore.db.YYYY-MM-DD pariscore.db
#    rm -f pariscore.db-wal pariscore.db-shm
#
# 4. Verify
#    sqlite3 pariscore.db "PRAGMA integrity_check;"
#
# 5. Restart
#    pm2 start pariscore
#    pm2 logs --lines 30
#
# 6. Si PAS de backup récent:
#    Try .recover (SQLite >= 3.32):
#      sqlite3 pariscore.db.CORRUPTED ".recover" > recovered.sql
#      sqlite3 pariscore_recovered.db < recovered.sql
#      mv pariscore_recovered.db pariscore.db
#
# ════════════════════════════════════════════════════════════════════
