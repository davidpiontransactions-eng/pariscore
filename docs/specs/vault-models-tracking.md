# Spec — vault-models-tracking.js (alias vault-weekly-review.js)

Génère une note hebdomadaire de performance des modèles ML dans le vault Obsidian.

## Fichier

scripts/vault-weekly-review.js

## Schedule

PM2 cron — `0 8 * * 1` (08:00 UTC chaque lundi)

## Données produites

Une note : vault/weekly/YYYY-MM-DD.md

## Sections

### Frontmatter

```yaml
---
type: weekly
date: 2026-06-15
week: 24
period: 2026-06-08..2026-06-14
models:
  - poisson-football
  - catboost-football
  - elo-tennis
  - surface-powerscore
---
```

### 1. Résumé Exécutif

```markdown
# 📊 Revue Hebdomadaire — Semaine 24

| Métrique | Cette semaine | Semaine dernière | Variation |
|----------|--------------|-----------------|-----------|
| Matchs analysés | 47 | 52 | -5 |
| ROI global | +4.2% | +2.1% | ▲ +2.1% |
| Win rate | 56.3% | 54.1% | ▲ +2.2% |
| Edge > 5% hits | 3/4 (75%) | 2/5 (40%) | ▲ +35% |
```

### 2. Performance par Modèle

```markdown
## Poisson Football

| Marché | Exactitude | Échantillon | Brier | Tendance |
|--------|-----------|-------------|-------|----------|
| 1X2 | 54.3% | 35 | 0.221 | → Stable |
| Over 2.5 | 57.1% | 28 | 0.198 | ▲ Hausse |
| BTTS | 51.4% | 35 | 0.234 | ▼ Baisse |

**Note :** Le modèle Poisson sur-performe sur Over 2.5 cette semaine. 
BTTS en léger drawdown — probablement dû au faible nombre de matchs de championnat mineurs.
```

### 3. Stratégies

```markdown
## Stratégies

| Stratégie | Picks | Wins | ROI | Drawdown |
|-----------|-------|------|-----|----------|
| Value Tennis | 12 | 7 | +8.3% | -3.1% |
| Corner Kings | 8 | 5 | +6.2% | -2.0% |
| Sure Bets | 4 | 3 | +4.5% | -1.5% |
```

### 4. Base de données

```markdown
## Base de Données

| Métrique | Valeur |
|----------|--------|
| Matchs historiques (football) | 124,532 |
| Matchs tennis | 89,234 |
| Matchs cette semaine | 47 |
| Nouveaux matchs importés | 312 |
| Taille DB | 847 MB |
```

### 5. Prochaine semaine

```markdown
## À venir

- Modèle CatBoost : prévoir réentraînement (3 semaines de données depuis dernier train)
- Tennis : Wimbledon approche — vérifier les pondérations surface gazon
```

## Edge cases

### Pas de données pour la semaine
```markdown
📭 Aucune donnée disponible pour cette période.  
Le cron a peut-être été interrompu ou la semaine est trop récente.
```

### Modèle dégradé
Si le Brier score d'un modèle dépasse son seuil de déclenchement (configurable) :
```markdown
⚠️ **Alerte :** Le modèle Poisson BTTS a un Brier de 0.234, 
au-dessus du seuil de 0.220. Envisager un réentraînement.
```

## Execution

```bash
node scripts/vault-weekly-review.js
node scripts/vault-weekly-review.js --week=23    # Forcer semaine spécifique
node scripts/vault-weekly-review.js --dry
```
