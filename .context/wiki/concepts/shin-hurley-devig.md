---
type: concept
slug: shin-hurley-devig
title: Devig Shin-Hurley (no-vig probability extraction)
status: active
tags: [math, devig, probability, favorite-longshot-bias, shin-model]
updated: 2026-05-22
sources: ["server.js (computeWFV1N2)", ".context/strategy/soccer-rating-rapport.md"]
xref: [[edge-no-vig]], [[value-bet]], [[kelly-cap]]
---

# Devig Shin-Hurley

**TL;DR:** Méthode probabiliste devig cotes bookmakers, gérant favorite-longshot bias. Plus précise que devig proportional naïve. Utilisée par PariScore pour 1X2 markets (`computeWFV1N2`).

## Devig proportional (baseline)

```
prob_implicite_i = 1 / cote_i
sum = Σ prob_implicite_i
prob_fair_i = prob_implicite_i / sum
```

**Limite:** assume marge bookmaker répartie uniformément. Réalité: bookies sur-pricent favorites + sous-pricent longshots (favorite-longshot bias).

## Devig Shin (1991) — modèle insider trading

Hypothèse: portion `z` des bets vient d'insider traders (perfect info). Devig devient:

```
Pour 2-way market (over/under, 1X2 sans nul):
prob_imp_a = 1/cote_a
prob_imp_b = 1/cote_b
sum = prob_imp_a + prob_imp_b

z solution itérative:
z = (1 - sqrt(sum² × 4 × prob_imp_a × prob_imp_b - (sum - 1) × ...)) / (sum - 1)

prob_fair_a = (sqrt(z² + 4×(1-z)×prob_imp_a²/sum) - z) / (2×(1-z))
prob_fair_b = 1 - prob_fair_a
```

Pour 3-way (1X2): généralisation matricielle, plus complexe.

## Shin-Hurley extension

Hurley a étendu Shin pour ajuster bias par bookmaker individuel + markets exotiques. PariScore utilise une implémentation simplifiée par marché.

## Code locations

- `server.js` `computeWFV1N2(...)` — devig Shin-Hurley 1X2
- `server.js` `detectSurebet1N2(...)` — surebet detector via sharps low-marge
- `match.devigMethod = "shin_hurley"` metadata payload

## Bench vs proportional

Sur historique tennis Pinnacle (sharp book reference):
- Proportional devig: error moyen ~3-5% sur prob fair
- Shin: error moyen ~1-2% (favorite-longshot mieux capturé)

## Pinnacle sharp anchor (innovation backlog)

Bd `bjv` Plan C — utiliser Pinnacle direct (via [[oddspapi]] free 250 req) comme **ancrage low-vig** (marge Pinnacle ~2-3% vs ~6-10% books recreational). Recalibrer detect surebet → reduction faux positifs **-5 à -10% bias** estim.

## Limites

- Z = 0 dégrade en proportional (cas no-insider-trading)
- Pas applicable markets très liquides ultra-sharp (Pinnacle déjà no-vig effectif)
- Itération numérique → coût compute négligeable mais existe

## Related

- [[edge-no-vig]] — Use shin-hurley dans pipeline EV
- [[value-bet]] — Définit seuil EV>5% AND borne inf IC>0
- [[kelly-cap]] — Sizing depuis prob_fair Shin-Hurley calibrée

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
