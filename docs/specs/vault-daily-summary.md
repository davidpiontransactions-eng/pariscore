# Spec — vault-daily-summary.js

Génère une note quotidienne dans le vault Obsidian de PariScore : matches du jour, value bets, métriques de performance des modèles.

## Fichier

scripts/vault-daily-summary.js

## Schedule

PM2 cron — `0 5 * * *` (05:00 UTC = 07h Paris, avant le début des matchs)

Ajouter dans ecosystem.config.js :

```json
{
  "name": "pariscore-vault-daily",
  "script": "scripts/vault-daily-summary.js",
  "cwd": "/home/ubuntu/pariscore",
  "cron_restart": "0 5 * * *",
  "autorestart": false,
  "instances": 1,
  "exec_mode": "fork",
  "max_memory_restart": "256M",
  "env": { "NODE_ENV": "production" },
  "error_file": "logs/vault-daily.err.log",
  "out_file": "logs/vault-daily.out.log",
  "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
  "time": true
}
```

## Structure du script

Copier le pattern de scripts/cron_refresh_match_stats.js :
- 'use strict'
- fs.readFileSync(.env)
- better-sqlite3 Database
- Config : VAULT_PATH (dossier du vault Obsidian), DB_PATH

## Données produites

Une note markdown par jour dans ${VAULT_PATH}/daily/YYYY-MM-DD.md

## Sections de la note

### 1. Frontmatter

```yaml
---
type: daily
date: 2026-06-13
generated_at: 2026-06-13T05:00:00Z
sports:
  - football
match_count: 47
prediction_count: 23
value_bets: 3
sure_bets: 2
model_accuracy_7d: 54.2
---
```

### 2. Football — Top Matches du Jour

Source : STRATEGIES hot-picks + sure-bets (in-memory depuis db.matches)

Requêtes SQL pour enrichir les matchs à venir :
- match_stats_history pour les stats récentes des équipes (5 derniers matchs)
- closing_odds pour les odds de clôture récentes

Format :
```markdown
## ⚽ Football — Top Matches du Jour

| Horaire | Match | Ligue | Prédiction | Confiance | Cote | Edge | Stratégie |
|---------|-------|-------|-----------|-----------|------|------|-----------|
| 18:00 | PSG vs Marseille | L1 | 1 (65%) | 8/10 | 1.85 | +4.2% | Poisson |
| 21:00 | Real vs Barça | LL | Over 2.5 (62%) | 7/10 | 1.72 | +3.1% | CatBoost |
```

Colonnes extraites des objets hot-picks et sure-bets :
- commence_time → format HH:MM
- home_team vs away_team
- league
- strategyLabel + confidence%
- confidenceIndex → barre X/10
- odds
- best_edge.edge% 
- strategyKey / strategyLabel

### 3. Tennis — Value Bets

Source : tennis value-bets internal logic (hot-picks tennis)

```markdown
## 🎾 Tennis — Picks du Jour

| Horaire | Match | Surface | Prédiction | Confiance | Cote | Edge |
|---------|-------|---------|-----------|-----------|------|------|
| 11:00 | Djokovic vs Alcaraz | Terre | 1 (58%) | 7/10 | 2.10 | +3.8% |
```

### 4. Sure Bets (≥8/10)

```markdown
## 🎯 Sure Bets — Confiance Maximale

| Match | Marché | Confiance | Niveau | Cote |
|-------|--------|-----------|--------|------|
| PSG vs Marseille | 1 | 85% | 9/10 | 1.85 |
```

Source : getSureBets(limit=5)

### 5. Modèles — Performance 7 Jours

Requêtes SQL :

```sql
-- Accuracy Over 2.5 sur les 7 derniers jours
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN (real_score.home + real_score.away) > 2.5 AND predicted.over25 > 50 THEN 1 ELSE 0 END) as correct_over25,
  ROUND(AVG(predicted.over25), 1) as avg_predicted_over25
FROM history 
WHERE commence_time >= datetime('now', '-7 days')
  AND verified = 1
  AND real_score IS NOT NULL;

-- Accuracy BTTS
SELECT
  SUM(CASE WHEN real_score.home > 0 AND real_score.away > 0 AND predicted.btts > 50 THEN 1 ELSE 0 END) as correct_btts,
  ROUND(AVG(predicted.btts), 1) as avg_predicted_btts
FROM history
WHERE commence_time >= datetime('now', '-7 days')
  AND verified = 1
  AND real_score IS NOT NULL;

-- Edge > 5% performance
SELECT
  COUNT(*) as total_edge,
  SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as won_edge,
  ROUND(AVG(edge_pct), 2) as avg_edge
FROM history
WHERE commence_time >= datetime('now', '-7 days')
  AND edge_pct > 5
  AND verified = 1;
```

Note : la table `history` n'existe peut-être pas en SQL (c'est un array in-memory). Si c'est le cas, on utilise l'objet `getAccuracyReport()` qui est déjà exposed dans server.js ou on lit depuis match_stats_history avec odds + scores réels.

Fallback : lire depuis match_stats_history où match_date >= 7 jours back et home_score/away_score NOT NULL, et odds_home/odds_draw/odds_away disponibles pour calculer l'edge.

Format :
```markdown
## 📊 Performance des Modèles (7 jours)

| Métrique | Valeur |
|----------|--------|
| Over 2.5 — Correct | 12/20 (60.0%) |
| BTTS — Correct | 8/15 (53.3%) |
| Edge > 5% — ROI | 14.2% |
| Échantillon total | 35 matchs |
```

Si données insuffisantes (< 5 matchs) : afficher `⚠️ Échantillon insuffisant cette semaine`

### 6. Bankroll Tracker (si disponible)

Source : /api/v1/bankroll/summary

```markdown
## 💰 Bankroll

| Métrique | Valeur |
|----------|--------|
| Bankroll actuelle | 112.4 u |
| P&L semaine | +3.2 u |
| Win rate (7j) | 58.3% |
| Drawdown max | -8.1% |
```

### 7. Section Vide — Résultats à Venir

La note daily du jour J ne contient pas les résultats (logique, les matchs n'ont pas encore eu lieu). 
Une deuxième passe (cron à 23:30 UTC) peut ajouter une section "Résultats du Jour" pour les matchs terminés.

Pour la V1 : une seule passe le matin, pas de mise à jour.

```markdown
<!-- Les résultats seront disponibles dans la note daily/J+1 -->
```

## Exemple complet de note générée

Voir le fichier `docs/specs/vault-daily-example.md` pour un exemple concret.

## Edge cases

### Aucun match aujourd'hui
```yaml
---
type: daily
date: 2026-06-13
match_count: 0
note: Aucun match programmé aujourd'hui
---
```

Afficher : `📭 Aucun match programmé aujourd'hui — journée calme.`

### API / Base de données inaccessible
- Logger l'erreur
- Générer note avec frontmatter + `⚠️ Données indisponibles — erreur de connexion à la base`

### Vault introuvable
- Logger l'erreur
- Créer le dossier daily/ automatiquement si manquant
- Abandon silencieux si le vault path n'existe pas du tout (pas de crash)

### Aucun pick du jour
- Afficher la section modèles normalement
- Section picks : `📭 Aucun value bet détecté aujourd'hui — conditions de marché défavorables.`

## Execution modes

```bash
node scripts/vault-daily-summary.js              # Production : écrit dans VAULT_PATH
node scripts/vault-daily-summary.js --dry         # Dry run : affiche dans stdout, n'écrit PAS
node scripts/vault-daily-summary.js --date=2026-06-10  # Forcer une date spécifique (backfill)
```

## Tests

```bash
node scripts/vault-daily-summary.js --dry        # Vérifier le rendu markdown
node scripts/vault-daily-summary.js --date=2026-06-01 --dry  # Tester un jour passé
```

Le --dry doit afficher la note complète dans stdout et exit 0.

## Exit codes

- 0 = OK (note générée ou dry run réussi)
- 1 = Erreur fatale (DB inaccessible, vault path manquant)
- 2 = Aucun match trouvé (note générée quand même avec mention "aucun match")
- 3 = Erreur partielle (DB OK, vault OK, mais certaines sections vides — exit avec warning)

## Dépendances

- better-sqlite3 (déjà installé)
- fs, path (natifs)

Pas de nouvelles dépendances npm.
