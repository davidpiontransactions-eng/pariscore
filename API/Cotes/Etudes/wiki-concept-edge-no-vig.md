---
type: concept
slug: edge-no-vig
title: Edge No-Vig (Value Betting Engine)
status: active
tags: [math, model, devig, ev, value-betting, shin-hurley, bookmaker-margin]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", ".claude/CLAUDE.md"]
xref: [[poisson-bivarie]], [[value-bet]], [[odds-api]], [[bsd-bzzoiro]], [[kelly-cap]]
---

# Edge No-Vig (Value Betting Engine)

**TL;DR:** Détecte cotes bookmakers sous-évaluées vs probabilité "fair" (sans marge bookmaker). Algorithme = devig probabilités implicites (Shin-Hurley) puis comparaison best-cote vs prob_fair → expected value (EV%) → opportunity score. Cœur du value-betting PariScore.

## Algorithme (server.js)

```
1. Pour chaque bookmaker:
   prob_implicite = 1 / cote_decimale
2. Marge bookmaker = Σ(prob_implicites) - 1
3. Prob fair (no-vig normalisation):
   prob_fair = prob_implicite / Σ(prob_implicites)   [méthode basique]
   OU Shin-Hurley:
   prob_fair = (sqrt(z² + 4×(1-z)×prob_imp²/Σ) - z) / (2×(1-z))
   où z = solution itérative du système Shin
4. EV (Edge) = meilleure_cote × prob_fair - 1   [en %]
5. EV > 0 → opportunité de valeur
```

## Devig methods

| Method | Use case |
|---|---|
| Basique (proportional) | Quick devig, marge faible |
| **Shin-Hurley** | Méthode probabiliste prenant en compte favorite-longshot bias |
| Power | Devig logistique (rare) |

PariScore utilise Shin-Hurley pour cotes 1X2 (cf. server.js `computeWFV1N2` + `detectSurebet1N2`).

## Outputs payload match

```js
match.fair = { home: 0.68, draw: 0.19, away: 0.13 }
match.edge = { home: -3.4, draw: 1.5, away: -2.5 }   // % EV
match.best_edge = {
  label: "Nul",
  odds: 4.50,
  edge: 1.5,
  bk: "Bet365"
}
match.devigMethod = "shin_hurley"  // backend metadata
```

## Sources cotes

| Source | Endpoint | Use |
|---|---|---|
| [[odds-api]] | The Odds API v4 | 20+ bookmakers cotes h2h (legacy) |
| [[bsd-bzzoiro]] `compare_odds` | `/odds/compare/?event=` | 14 books + movement (5min cache) |
| [[bsd-bzzoiro]] `best_odds` | `/v2/odds/best/?event=` | Top-of-book aggregate (5min, bd j6pz) |
| [[bsd-bzzoiro]] `polymarket` | `/odds/polymarket/?event=` | Prediction market (5min, sharp signal) |

## Pinnacle sharp calibration (innovation backlog)

Bd `bjv` Plan C — utiliser cote Pinnacle (via [[oddspapi]] free 250 req/mo) dans `computeWFV1N2` comme ancrage low-vig. Recalibrer `detectSurebet1N2` avec sharps low-marge → reduction faux positifs ValueBet estim. **-5 à -10% bias**.

## Filtres frontend

- `#filter-console` → `#adv-input` → Edge min (slider %)
- Filtres `data-filter=ev_positive` ne montre que EV > 0
- Badge cellule `Edge %` vert (>0) / orange (-5..0) / rouge (<-5)

## Limites

- Pas d'IC sur EV (sortie point estimate)
- Suppose distribution cotes représentative (16+ books actifs OK, 3-4 books = noise)
- N'intègre pas confidence Poisson (TODO innovation: `confidence_badge` combine EV + Poisson stability)

## Innovation backlog

- **Règle BET stricte** — EV>5% ET borne inférieure IC>0 (cumul Bootstrap UQD)
- **Pinnacle sharp anchor** — bd `bjv` Plan C OddsPapi.io free 250 req
- **xvalue.ai ML scouting** — bd `ffh` GO 85/100 clustering 30 ligues + style-shift score

## Code locations

- `server.js` `computeEdge()` — calcul EV
- `server.js` `computeWFV1N2()` — devig 1X2 Shin-Hurley
- `server.js` `detectSurebet1N2()` — surebet detector via sharps
- `pariscore.html` colonne Edge % + Edge badge

## Related

- [[poisson-bivarie]] — Source prob "vraie" complémentaire (vs prob_fair devig)
- [[value-bet]] — Définition seuil opportunity
- [[odds-api]] — Source cotes legacy
- [[bsd-bzzoiro]] — Source cotes primary
- [[kelly-cap]] — Sizing depuis edge calculé (cap 25%)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse CLAUDE.md section 4.1 + server.js + innovation backlog bjv
