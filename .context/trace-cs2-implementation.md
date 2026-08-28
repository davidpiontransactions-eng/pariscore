# Trace — Implémentation CS2 Marchés Calibrés + UI HLTV-like

**Date** : 2026-08-28
**Bead** : ParisScorebis-xog5
**Branche** : feat/cs2-calibrated-markets
**Plan** : docs/superpowers/plans/2026-08-28-cs2-hltv-markets.md
**Benchmark source** : docs/cs2_betting_benchmark_academique_2026-08-28.md

## Journal d'exécution

| Task | Statut | Date | Notes & vérifications |
|---|---|---|---|
| T0 Setup | pending | | branch + bead + plan + trace |
| T1 Calibration lib | pending | | Brier/ECE/ROI/verdict |
| T2 Handicap rounds | pending | | P(cover) depuis MC |
| T3 Map play prob | pending | | veto + historique |
| T4 EV/devig/Kelly | pending | | verdict BET/SKIP |
| T5 Backtest harness | pending | | gate calibration |
| T6 API /markets | pending | | agrégation |
| T7 UI markets panel | pending | | fiche match |
| T8 UI bans+last5 | pending | | map pool table |
| T9 Gates + clôture | pending | | lint/typecheck + bd close |

## Décisions clés

- Verdict BET = proba≥65% ET EV≥4% ET calibration OK (gate bloquante, papier 2303.06021).
- Backtest window 180j csapi ; prior sample 6 (cohérent predict-adapter).
- Cotes : champ BSD `match.odds` ; dévig multiplicative.
- Aucun repo GitHub installé (tous évalués NO-GO dans benchmark).

## Résultats backtest (à remplir en T5/T9)

| Marché | n | Brier | ECE | ROI | Verdict |
|---|---|---|---|---|---|
| winner | — | — | — | — | — |
| map | — | — | — | — | — |
| over | — | — | — | — | — |
| handicap | — | — | — | — | — |