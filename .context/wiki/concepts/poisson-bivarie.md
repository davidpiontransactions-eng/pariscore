---
type: concept
slug: poisson-bivarie
title: Distribution de Poisson Bivariée
status: active
tags: [math, model, probability, markets, btts, over-under, scorelines]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", ".claude/CLAUDE.md", ".context/strategy/soccer-rating-rapport.md"]
xref: [[edge-no-vig]], [[value-bet]], [[api-football]], [[elo-dynamique]], [[modal-insights]]
---

# Distribution de Poisson Bivariée

**TL;DR:** Modèle probabiliste génère probabilités markets BTTS / Over-Under / Clean Sheet / 1X2 / Top Scores depuis Expected Goals (xG) home + away. Coeur math engine PariScore foot. Output `match.poisson{}` dans payload `/api/v1/matches`.

## Formules

```
// Facteur d'attaque/défense normalisé par moyenne ligue (1.35 buts/match)
λ_dom = (avgScored_dom / 1.35) × avgConceded_ext
λ_ext = (avgScored_ext / 1.35) × avgConceded_dom

// Matrice scores (0-6 × 0-6)
P(h, a) = Poisson(λ_dom, h) × Poisson(λ_ext, a)

// Markets dérivés
BTTS    = Σ P(h>0, a>0)
Over 0.5 = Σ P(h+a > 0)
Over 1.5 = Σ P(h+a > 1)
Over 2.5 = Σ P(h+a > 2)
Over 3.5 = Σ P(h+a > 3)
Under 1.5 = Σ P(h+a ≤ 1)
CS 0-0  = P(0, 0)
1X2 = Σ P(h>a), Σ P(h=a), Σ P(h<a)
```

## Outputs dans payload match

```js
match.poisson = {
  over05, over15, over25, over35,   // % buts
  btts, under15, cs00,               // % markets composés
  homeWin, draw, awayWin,            // % 1X2
  topScores: [{ score: "1-0", prob: 14 }, ...],  // top 5
  method: "poisson"
}
match.expectedGoals = { home: 1.82, away: 0.74 }  // les λ
```

## Stats d'équipe (input)

| Source | Badge | Qualité |
|---|---|---|
| Standings [[api-football]] | `LIVE` (bleu) | Réelles `db.teamStats[normName]` |
| Fonction `simStats()` hash déterministe | `SIM` (gris) | Estimées fallback |

## Code locations

- `server.js` `buildMatchRecord()` — appelle `computePoisson()` 
- `server.js` `computePoisson(stats_home, stats_away)` — calcul matrice
- `server.js` `db.teamStats` — cache stats
- `pariscore.html` tableau Foot — colonnes BTTS / O0.5 / O1.5 / O2.5 / O3.5 affichées avec code couleur

## Limites connues (CLAUDE.md section 14)

| Limite | Impact | Mitigation roadmap |
|---|---|---|
| Moyenne ligue fixée 1.35 | Biais ligues défensives | Roadmap: moyenne dynamique par ligue |
| BTTS/Over = calcul indirect | Pas historique réel verif | Badge LIVE/SIM + tooltip ≈ |
| Matching noms équipes fuzzy | Faux positifs noms courts | Roadmap: Levenshtein |
| Pas d'IC sur prob | Sortie point estimate | Roadmap: [[bootstrap-uqd]] 500 itérations IC90 |

## Innovation backlog (CLAUDE.md)

- **Poisson Time-Inhomogène** — modèle live conditionnel minute par minute
- **Bayesian Value Radar** — Data Blending Poisson + Elo + xG Logistic
- **Bootstrap UQD** — 500 itérations IC90 par match
- **Score composite fiabilité /100** — volume data + stabilité xG + calibration

## Validation backtesting

`history.json` archive matchs terminés (>3h after kick-off via `archivePastMatches()`). Compare prédictions Poisson aux scores réels [[api-football]] `/fixtures?date=&status=FT`.

Métriques `/api/v1/accuracy`:
- Over 2.5: vérifié si total buts > 2 ET poisson.over25 > 55%
- BTTS: vérifié si les 2 équipes ont marqué ET poisson.btts > 55%
- Edge: vérifié si favori best_edge a gagné ET edge > 5%

## Related

- [[edge-no-vig]] — Convertit prob Poisson + cotes → opportunity score (EV%)
- [[value-bet]] — Définit seuil EV>5% AND borne inf IC>0
- [[api-football]] — Source primary xG / avgScored / avgConceded
- [[elo-dynamique]] — Input complémentaire pour blending Bayesian
- [[modal-insights]] — Onglet PowerScore + Graphique affiche output Poisson

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse CLAUDE.md section 4 + server.js + roadmap innovation backlog
