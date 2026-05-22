---
type: concept
slug: kelly-cap
title: Kelly Criterion + cap 25% (bankroll sizing)
status: active
tags: [math, bankroll, sizing, kelly, risk-management]
updated: 2026-05-22
sources: ["server.js", "pariscore.html (mes-paris)", "CLAUDE.md"]
xref: [[edge-no-vig]], [[poisson-bivarie]], [[mes-paris]]
---

# Kelly Criterion + cap 25%

**TL;DR:** Formule mathématique optimale taille pari pour maximiser growth bankroll long-terme. PariScore cap à 25% Kelly fraction (fractional Kelly) pour limiter volatility + risque ruine.

## Formule Kelly

Pour pari binaire avec cote décimale `b` (net odds = b-1) et probabilité `p` de gagner:

```
f* = (b × p - q) / b = (b × p - (1 - p)) / b
```

Où:
- `f*` = fraction optimale du bankroll à miser
- `b` = cote décimale
- `p` = probabilité de gagner
- `q` = 1 - p

**Exemple:** Cote 2.50, prob fair 50% → f* = (2.5×0.5 - 0.5) / 2.5 = 0.30 (30% bankroll)

## Fractional Kelly (cap 25%)

Kelly pur = volatile (drawdowns 50%+ possibles malgré edge). PariScore applique cap:

```
f_pariscore = min(f* × 0.25, 0.05)   // max 5% bankroll OR 25% Kelly
```

Justification:
- Réduit variance ~16× pour cost ~4× growth (acceptable tradeoff)
- Évite ruine quasi-totale sur cold streak
- User-friendly (sizes modestes lisibles)

## Wire UI Mes Paris

`pariscore.html` page `#page-bets` modal "Saisie pari":
- Champ "Stake suggéré" calcule Kelly automatiquement depuis match.best_edge + bankroll user actuelle
- Toggle "Kelly cap 25%" (default ON) vs "Kelly full" (avertissement risque)
- Override manuel possible

## Pré-requis fiabilité

Kelly suppose **probabilité fair connue précisément**. Si modèle PariScore over/under-estime prob:
- Over-estimate → Kelly over-sized → ruine accélérée
- Under-estimate → Kelly under-sized → growth subopt

→ Discipline: ne Kelly que sur signaux haute confiance (combinaison [[edge-no-vig]] + [[poisson-bivarie]] + Power Score >75 + IC borne inf positive).

## Innovation backlog

- **Règle BET stricte** — EV>5% ET borne inf IC>0 (Bootstrap UQD) avant Kelly cap 25%
- **Multi-bet correlation** — Kelly suppose paris indépendants. Combinés/parlay nécessitent Kelly généralisé (TODO)
- **Bankroll drawdown adaptive** — réduire cap si drawdown >20% (defensive sizing)

## Code locations

- `server.js` — `computeKellyStake(prob_fair, odds, bankroll)` helper
- `pariscore.html` modal "Saisie pari" — affiche stake suggéré

## Tables liées (SQLite)

- `user_bets` — historique paris user avec stake actuel + recommended
- `bankroll_transactions` — dépôts/retraits/règlements (INTEGER cents)

## Related

- [[edge-no-vig]] — Source EV input Kelly
- [[poisson-bivarie]] — Source prob fair Kelly
- [[mes-paris]] — Feature consommateur (à créer wave 2)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
