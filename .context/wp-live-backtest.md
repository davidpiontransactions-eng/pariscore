# Backtest Brier/RPS — Win Probability Live Football

> T0.5 — Validation de la WP live Poisson calibrée (mi-temps → résultat final).
> Source : `match_stats_history` (walk-forward sur données mi-temps).
> Généré : 2026-07-29T12:48:31.294Z

**Statut** : Aucune donnée mi-temps disponible.

Le backtest nécessite des matchs avec données mi-temps complètes (`home_score_ht`, `home_xg_1h`...)
dans `match_stats_history`. Enrichissez la base via BSD puis relancez :
`node tools/backtest-wp-live-brier.js`