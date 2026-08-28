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

## Résultats backtest (run réel 2026-08-28, 495 matchs terminés 90j, walk-forward)

| Marché | n | Brier | ECE | ROI* | Verdict |
|---|---|---|---|---|---|
| winner | 186 | 0.2487 | 0.1821 | +37.63% | **NO-GO** (surconfiance) |
| map | 377 | 0.2504 | 0.1107 | +22.55% | **NO-GO** (ECE seuil) |
| over (22.5) | 377 | 0.2358 | 0.0334 | −25.73% | **OK** ✅ |
| handicap (±1.5) | 377 | 0.2651 | 0.1336 | +10.34% | **NO-GO** |

*ROI = proxy mise fixe à cote 2.0 (pas d'historique de cotes horodaté) — à recalculer avec vraies cotes BSD/Pinnacle en L3.

**Lecture** : conforme au papier Walsh & Joshi (arXiv 2303.06021) — le marché **over/under rounds est le seul calibré** (ECE 0.033), exactement la prédiction du benchmark ("l'edge est dans les marchés granulaires"). Winner/map/handicap sont surconfiants (ECE > 0.10) → leurs signaux restent en "calibration en attente" tant que le gate n'est pas vert. Voies d'amélioration documentées : (a) blend ELO BSD pour réduire la surconfiance winner, (b) seuils de proba plus hauts (≥70%) pour winner, (c) vraies cotes pour un ROI réel.

## Décisions clés

- Verdict BET = proba≥65% ET EV≥4% ET calibration OK (gate bloquante, papier 2303.06021).
- Backtest walk-forward : TeamModel reconstruits UNIQUEMENT depuis les matchs antérieurs (fenêtre glissante 90j, min 3 séries jouées), zéro fuite de données.
- Cotes : champ BSD `match.odds` ; dévig multiplicative.
- Aucun repo GitHub installé (tous évalués NO-GO dans benchmark).
- csapi `/matches/latest` ignore `days` → `limit=500` + filtre date local.
- Limitations v1 (backtest) : pas d'ancrage ELO/CT-T historique, cotes proxy 2.0, pistol neutre ± ctBias/2.