# Plan Demain — 12 Juin 2026

## ✅ Choses faites aujourd'hui (11 juin)

- Tennis Elo surface : scraper Tennis Abstract + recompute Elo local + cron VPS + docs
- bd 8lqf (FBref/soccerdata) → fermé OBSOLÈTE (stats Opta retirées de FBref)
- bd j5lb (DG 6 études) → fermé NO-GO sur toutes (FBref obsolète, RapidAPI redondant, TheSportsDB pas de stats, Apify defer, OddsPortal redondant, Marketing pas de trafic)
- Nouveau ticket `qyfr` : xvalue.ai POC 1j gratuit (créé)
- CHANGELOG v12.78, CLAUDE.md roadmap mis à jour
- Commit + git push → `origin/main`

---

## 🎯 Priorité 1 — Déploiement VPS

**Quand** : Maintenant (après le push git)

**Commande** :
```bash
ssh ubuntu@<VPS>  # ou depuis le VPS directement
cd /home/ubuntu/pariscore
./scripts/update_vps.sh --tennis-elo
```

Le flag `--tennis-elo` exécutera automatiquement `node tools/recompute-tennis-elo.js` après le restart pm2. Cela va :
1. `git reset --hard origin/main` → récupère le commit v12.78 sur le VPS
2. `npm rebuild` + `pm2 restart` → applique le déploiement
3. `node tools/recompute-tennis-elo.js` → charge les nouveaux Elo surface dans la DB

---

## 🎯 Priorité 2 — ETL foot 2025/2026

**Quand** : Après minuit UTC (reset quota API-Football → 7500 req/j)

**Pourquoi** : bd 9je — les saisons 2025/2026 foot étaient bloquées (quota épuisé)

**Commande** :
```bash
cd /home/ubuntu/pariscore
bash .context/run_etl_2024_2026.sh
```

Vérifier après exécution :
```bash
# Nombre de matchs foot saison 2025/2026
node -e "const db=require('better-sqlite3')('pariscore.db'); console.log(db.prepare(\"SELECT COUNT(*) as cnt FROM archive_matches WHERE (sport_key='football' OR sport_key IS NULL) AND season='2025'\").get())"
node -e "const db=require('better-sqlite3')('pariscore.db'); console.log(db.prepare(\"SELECT COUNT(*) as cnt FROM archive_matches WHERE (sport_key='football' OR sport_key IS NULL) AND season='2026'\").get())"
```

---

## 🎯 Priorité 3 (optionnel) — xvalue.ai POC 1j gratuit

**Ticket** : `bd show qyfr`

**Étapes** :
1. Aller sur https://xvalue.ai — s'inscrire au free trial
2. Récupérer la clé API → ajouter `XVALUE_API_KEY=...` dans `.env` du VPS
3. Créer un script `tools/probe-xvalue-api.js` pour :
   - Pull 30 matchs Big 5 saison 2025-2026
   - Comparer xG xvalue vs xG BSD (déjà dans `db.match_stats_history`)
   - Calculer corrélation, divergence, taux de match-up
4. Si POC concluant (corrélation > 0.85) → demander pricing commercial

---

## 🧠 Rappels

| Action | Détail | Qui |
|--------|--------|-----|
| Déployer VPS | `./scripts/update_vps.sh --tennis-elo` | Toi (ou moi en SSH si accès) |
| ETL foot 2025/2026 | `bash .context/run_etl_2024_2026.sh` | Après reset quota minuit |
| POC xvalue.ai | `bd show qyfr` puis suivre les étapes | Toi (décision GO/NO-GO) |
