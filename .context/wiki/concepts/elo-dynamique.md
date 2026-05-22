---
type: concept
slug: elo-dynamique
title: Elo Dynamique (Foot + Tennis Surface)
status: active
tags: [math, model, rating, post-match, foot, tennis, surface-specific]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", ".context/rapport-audit-elo-rank-2026.md"]
xref: [[poisson-bivarie]], [[elofootball]], [[tennis-abstract]], [[edge-no-vig]], [[bsd-bzzoiro]]
---

# Elo Dynamique

**TL;DR:** Rating system équipes/joueurs avec ajustement post-match. Foot: Elo via [[elofootball]] community (Phase 1-3 livrées v12.31-v12.40, 1902 matchs + 50 rankings). Tennis: Elo par surface (Hard/Clay/Grass) via Sackmann (en cours purge bd `8uoc`) + [[tennis-abstract]] scraper weekly drift.

## Formule Elo classique

```
E_a = 1 / (1 + 10^((R_b - R_a) / 400))   // expected score équipe A
R_a' = R_a + K × (S_a - E_a)              // post-match update
```

Avec:
- `K` = facteur volatilité (32 standard, plus haut pour matchs importants)
- `S_a` = score réel (1 win, 0.5 draw, 0 loss)

## Variantes PariScore

### Foot — Elo global
- Source: [[elofootball]] community (eloratings.net + variants)
- Update: post-match auto via parser RSS / scraper bd `8lvf`
- Coverage: 1902 matchs Phase 1+2+3, 50 rankings world clubs

### Tennis — Elo par surface
- Source: Jeff Sackmann GitHub `tennis_atp` + `tennis_wta` (en cours purge bd `8uoc` Q1 — Sackmann CC BY-NC-SA incompatible commercial)
- Substitution roadmap: [[tennis-mylife]] TML-Database MIT (bd `8uoc` Q2)
- Granularité: ATP / WTA × {Hard, Clay, Grass}
- Update: weekly drift check via [[tennis-abstract]] scraper (bd `h6a`)

## Wire payload tennis match

```js
match.predictions.elo = { p1_rating, p2_rating, p1_win_prob }
match.predictions.elo_surface = { surface, p1_rank, p2_rank, sample_size }
```

Stratégie `SURFACE_SPEC` filtre tennis: écart classement Elo surface ≥ 30 places entre 2 joueurs.

## Code locations

- `server.js` — `db.eloRatings` cache
- `server.js` — `computeEloUpdate(...)` après archive_matches
- `pariscore.html` — bouton tennis "🎯 Spécialiste Surface" `data-strategy=SURFACE_SPEC`

## Bd tickets liés

- `8lvf` ✅ closed — elofootball.com Elo historique massif Phase 1-3 livrées v12.31-v12.40
- `8uoc` P1 — Tennis Abstract + autres DBs tennis (research v2 livré commit `2ce9463` TML MIT, 3 questions DG pending)
- `h6a` P3 — Tennis Abstract Elo scraper weekly drift check

## Limites

- Pas d'IC sur ratings (sortie point)
- K-factor fixe (pas weighted par importance match)
- Foot: rating club non joueur-level
- Tennis surface: échantillon limité hors top 50 + dépend purge Sackmann

## Innovation backlog (CLAUDE.md)

- **Bayesian Value Radar** — Data Blending Poisson + Elo dynamique + xG Logistic
- **xvalue.ai ML scouting** — bd `ffh` GO 85/100 ajoute style-shift fingerprint clustering 30 ligues

## Related

- [[poisson-bivarie]] — Complémentaire pour blending Bayesian
- [[elofootball]] — Source data foot (à créer wave 2)
- [[tennis-abstract]] — Source Elo tennis (à créer wave 2)
- [[edge-no-vig]] — Use Elo prob comme input devig comparison
- [[bsd-bzzoiro]] — Predictions ML CatBoost partiellement basés Elo

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse CLAUDE.md + bd 8lvf + 8uoc
