# Runbook ops — Recovery SQLite `pariscore.db` (bd b50)

> Procédure VPS OVH `/home/ubuntu/pariscore` quand le serveur log
> `SqliteError: file is not a database` (code `SQLITE_NOTADB`) ou
> `SQLITE_CORRUPT` au runtime.
>
> Le code applicatif (`server.js` v12.65+) inclut désormais :
> - quick_check + quarantaine automatique au **boot** (rename vers
>   `pariscore.db.corrupt-<ts>`, jamais delete)
> - auto-recovery **runtime** (rename + fresh DB) déclenchée par
>   `_attemptRuntimeDbRecovery()` avec cooldown 5min
> - graceful shutdown SIGTERM/SIGINT/SIGHUP → `wal_checkpoint(TRUNCATE)` +
>   `sqldb.close()` pour éviter WAL incomplet sur restart pm2
> - pragmas `busy_timeout=5000` + `wal_autocheckpoint=1000`
>
> Le runbook ci-dessous traite les cas où **l'auto-recovery code-side ne
> suffit pas** (perte massive de données, corruption .db.corrupt-* à
> récupérer offline, ou récurrence indiquant root cause ops).

---

## 1. Diagnostic rapide (< 2 min)

```bash
cd /home/ubuntu/pariscore

# 1.1 — Disque plein ? (cause #1 SQLITE_NOTADB tronqué)
df -h .
#   Si "Use%" > 95% → libérer espace AVANT toute autre opération
#   du -sh *.db *.json node_modules .git | sort -h

# 1.2 — État fichiers DB (taille + dates + WAL/SHM résiduels)
ls -la pariscore.db pariscore.db-wal pariscore.db-shm 2>/dev/null
ls -la pariscore.db.corrupt-* 2>/dev/null | head -5
#   pariscore.db-wal énorme (>100MB) ou très ancien (>24h) = checkpoint cassé
#   présence de plusieurs .corrupt-* = récurrence → escalader

# 1.3 — Quick check via outil standalone (read-only, sans toucher serveur)
node tools/check-db-integrity.js
#   exit 0 = sain ; exit 1 = corruption confirmée

# 1.4 — Logs pm2 récents (dernière erreur SQLite)
pm2 logs pariscore --lines 200 --nostream | grep -iE "SQLITE|corrupt|NOTADB"
```

## 2. Backup AVANT toute manip (NON NÉGOCIABLE)

```bash
# Stop écriture (pm2 stop, pas restart — éviter checkpoint pendant copie)
pm2 stop pariscore

# Backup atomique (cp sur même volume = O(1) reflink si copy-on-write FS, sinon copie classique)
TS=$(date +%s)
cp pariscore.db pariscore.db.bak.$TS
cp pariscore.db-wal pariscore.db-wal.bak.$TS 2>/dev/null || true
cp pariscore.db-shm pariscore.db-shm.bak.$TS 2>/dev/null || true

echo "Backup : pariscore.db.bak.$TS ($(du -h pariscore.db.bak.$TS | cut -f1))"
```

## 3. Recovery (.recover sqlite3)

```bash
# Tentative récupération maximale via sqlite3 .recover (lit page par page,
# extrait toutes les rows lisibles, écrit dans DB neuve)
sqlite3 pariscore.db ".recover" | sqlite3 pariscore.recovered.db

# Vérifier que la base recovered est utilisable
node tools/check-db-integrity.js --db=pariscore.recovered.db

# Si OK → bascule
if [ $? -eq 0 ]; then
  mv pariscore.db pariscore.db.corrupt-$TS
  mv pariscore.recovered.db pariscore.db
  # Effacer WAL/SHM résiduels de l'ancienne DB
  rm -f pariscore.db-wal pariscore.db-shm
  echo "✓ Recovery OK. Ancienne DB conservée : pariscore.db.corrupt-$TS"
else
  echo "✗ Recovery KO — escalader bd b50, option fresh DB ci-dessous"
fi
```

## 4. Fresh DB (last resort)

Si recovery échoue, on perd les caches API (récupérables via re-fetch
naturel), les `user_bets` historiques personnels et `ai_feedback` (perte
irréversible si pas de backup S3/Dolt). Stripe `users.stripe_*` et
`stripe_events` sont les pertes les plus douloureuses → **toujours
tenter recovery d'abord**.

```bash
# Renommer .db corrompue (jamais rm — analyse offline possible plus tard)
mv pariscore.db pariscore.db.corrupt-$TS
rm -f pariscore.db-wal pariscore.db-shm

# Au prochain pm2 start, server.js → initSQLite() → tous les CREATE TABLE IF NOT EXISTS
# recréent le schema vide. Le cron `fetchOdds/fetchStats` repeuple api_cache en ~12h.
```

## 5. Redémarrage + validation

```bash
pm2 start pariscore
sleep 5

# Vérifier boot OK
pm2 logs pariscore --lines 50 --nostream | grep -iE "SQLITE|database|boot|prêt"

# Health check intégrité
node tools/check-db-integrity.js

# Monitor 10min sans erreur runtime
pm2 logs pariscore --lines 0 --timestamp | grep -iE "SQLITE|NOTADB|CORRUPT" &
sleep 600 && kill %1
```

## 6. Si récurrence (> 1 occurrence / semaine)

Root cause ops à investiguer — code-side mitigation insuffisante :

| Cause | Symptôme | Mitigation ops |
|---|---|---|
| **Disque plein** | `df` > 95%, `pariscore.db` tronqué en milieu de page | Augmenter quota OVH, ou cron purge `api_cache` aggressif via `apiCacheClear()` |
| **Backup pendant write** | `rsync` / `tar` cron pendant cron fetchOdds | Stopper backup runtime, utiliser `.dump` SQLite ou snapshot LVM/btrfs |
| **Process concurrent** | 2× `pm2 start pariscore` (cluster mode), ou script ad-hoc Node qui ouvre la même DB | `pm2 list` doit montrer 1 instance fork ; bannir `cluster_mode` (better-sqlite3 = single-writer) |
| **OOM kill** | `dmesg` montre `oom-killer`, pm2 redémarre brutal sans SIGTERM propre | Augmenter RAM VPS, ou `--max-old-space-size=2048` Node |
| **Disque latence (NFS / network FS)** | I/O slow > busy_timeout 5s | Migrer DB vers volume local SSD, jamais NFS |
| **kill -9 pm2** | `pm2 kill --signal=9` ou `kill -9 PID` shutdown forcé → WAL not flushed | Toujours `pm2 stop`, jamais `kill -9` ; ou augmenter `pm2 conf kill_timeout` à 5000 (default 1600ms) |

Commande utile diagnostic concurrent processes :

```bash
lsof pariscore.db 2>/dev/null
# Devrait afficher 1 SEUL PID (le node server.js). Si plusieurs → bug.
```

## 7. Backup préventif (à mettre en place hors incident)

```bash
# Cron quotidien (crontab -e) — VPS, 4h du matin Paris
0 4 * * * cd /home/ubuntu/pariscore && sqlite3 pariscore.db ".backup pariscore.db.daily.$(date +\%Y\%m\%d)" && find . -name 'pariscore.db.daily.*' -mtime +7 -delete

# .backup utilise l'API SQLite Online Backup → cohérent même si writes en cours,
# pas besoin de stop pm2. Le `.bak.<ts>` cp brut peut produire un fichier corrompu
# si copié en milieu de write.
```

---

**Contact bd** : `bd update b50 --note "..."` pour tracer chaque incident.
Si > 3 incidents en 30 jours, escalader DG pour migration PostgreSQL.
