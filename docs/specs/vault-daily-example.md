# Exemple — Note Daily générée

Ce fichier montre à quoi ressemble une note quotidienne typique générée par `vault-daily-summary.js`.

## Exemple : 13 juin 2026

```markdown
---
type: daily
date: 2026-06-13
generated_at: 2026-06-13T05:00:00Z
sports:
  - football
  - tennis
  - nba
match_count: 47
prediction_count: 23
value_bets: 4
sure_bets: 2
model_accuracy_7d: 56.3
---

## ⚽ Football — Top Matches du Jour

| Horaire | Match | Ligue | Prédiction | Confiance | Cote | Edge | Stratégie |
|---------|-------|-------|-----------|-----------|------|------|-----------|
| 18:00 | PSG vs Marseille | L1 | 1 (65%) | 8/10 | 1.85 | +4.2% | Poisson |
| 18:00 | Lyon vs Monaco | L1 | Over 2.5 (62%) | 7/10 | 1.72 | +3.1% | CatBoost |
| 21:00 | Real Madrid vs Barcelone | LL | BTTS (58%) | 7/10 | 1.90 | +2.8% | Poisson |
| 21:00 | Juventus vs Milan | SA | 1 (61%) | 8/10 | 2.05 | +5.1% | Poisson |
| 20:00 | Bayern vs Dortmund | B1 | Over 2.5 (64%) | 8/10 | 1.65 | +3.5% | CatBoost |
| 19:00 | Benfica vs Porto | PL | X (55%) | 6/10 | 3.40 | +2.1% | Poisson |

### Stats clés du jour
- **Value bets détectés :** 4
- **Sure bets (≥8/10) :** 2
- **Matchs analysés :** 47
- **Ligues couvertes :** L1, LL, SA, B1, PL, EPL

## 🎾 Tennis — Picks du Jour

| Horaire | Match | Surface | Prédiction | Confiance | Cote | Edge |
|---------|-------|---------|-----------|-----------|------|------|
| 11:00 | Djokovic vs Alcaraz | Terre | 1 (58%) | 7/10 | 2.10 | +3.8% |
| 14:30 | Sinner vs Medvedev | Gazon | 1 (63%) | 8/10 | 1.75 | +5.2% |
| 10:00 | Swiatek vs Sabalenka | Terre | 1 (56%) | 6/10 | 1.95 | +2.4% |

### Analyse rapide
- **Terre battue :** Djokovic favori mais Alcaraz en forme — prudence.
- **Gazon :** Sinner solide, Medvedev irrégulier sur herbe — meilleur edge du jour.

## 🎯 Sure Bets — Confiance Maximale

| Match | Marché | Confiance | Niveau | Cote |
|-------|--------|-----------|--------|------|
| PSG vs Marseille | 1 | 85% | 9/10 | 1.85 |
| Bayern vs Dortmund | Over 2.5 | 82% | 9/10 | 1.65 |

## 📊 Performance des Modèles (7 derniers jours)

| Métrique | Valeur |
|----------|--------|
| Over 2.5 — Correct | 15/27 (55.6%) |
| BTTS — Correct | 9/18 (50.0%) |
| Edge > 5% — ROI | +12.4% |
| Échantillon total | 35 matchs |
| Moyenne prédite Over 2.5 | 58.2% |
| Moyenne prédite BTTS | 52.7% |

### Notes
- Edge > 5% toujours positif (12.4% ROI) → les value bets tiennent la route.
- Over 2.5 stable autour de 55% — dans la fourchette attendue.
- BTTS en léger drawdown cette semaine.

## 💰 Bankroll

| Métrique | Valeur |
|----------|--------|
| Bankroll actuelle | 112.4 u |
| P&L semaine | +3.2 u |
| Win rate (7j) | 58.3% |
| Drawdown max | -8.1% |
| Ratio gain/perte | 1.42 |

## ℹ️ À venir
- **Résultats du jour :** disponibles demain dans la note daily/2026-06-14
- **Prochaine mise à jour :** cron quotidien à 05:00 UTC

<!-- Les résultats seront disponibles dans la note daily/J+1 -->
```
```
