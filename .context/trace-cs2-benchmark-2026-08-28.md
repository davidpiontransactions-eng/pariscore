# Session — CS2 Benchmark Académique & Vision HLTV-style (2026-08-28)

## Mission
Refonte onglet CS2 PariScore orientée "copie HLTV" (infos matchs, stats maps, décision bet) — benchmark académique des modèles CS2 betting, analyse des prédicteurs web, vision d'implémentation.

## Livrables
| Artefact | Chemin | Statut |
|---|---|---|
| Rapport benchmark + vision | `docs/cs2_betting_benchmark_academique_2026-08-28.md` | ✅ écrit |
| Trace session | `.context/trace-cs2-benchmark-2026-08-28.md` | ✅ écrit |

## Sources analysées (recherche web en direct)
- **arXiv** (15 papiers) : 2410.02831 (rating CS:GO), 2109.12990 (économie), 2209.09861 (ESTA), 2011.01324 (player actions), 2106.08888 (bandit veto +19.8%), 2303.06021 (calibration ROI +34.69%), 2410.21484 (systematic review), 2003.09384 (AH market), 2309.06248 (Balance score), 1701.03162 (Dota live), 2001.11274 (momentum), 1310.6998 (Twitter NFL), 2210.06327 (lineups +42%), 2511.03732 (collective intelligence).
- **bo3.gg** : 2 articles de prédiction lus en entier (structure form/map pool/veto/table map WR/H2H/verdict score exact).
- **egamersworld** : pages tips + accueil (tipsters humains, verdict "Will win"/score).
- **esportsoracle** : audit antérieur docs/cs2_esportsoracle_audit.md.
- **Cieslak LLM benchmark** : .context/analyse-cs2-ai-benchmark-cieslak-2026-06-05.md (edge LLM = 0).
- **Codebase PariScore** : composants `src/components/cs2/`, moteur `src/lib/prediction/cs2/cs2-predictive-ml-engine.ts`, API `src/app/api/cs2/`, docs `cs2_roadmap_and_design.md` + `cs2_hltv_deep_audit.md`.

## Conclusions clés
1. Edge CS2 = marchés granulaires (over/under rounds, handicap rounds, winner map via veto), pas "winner match".
2. Calibration > accuracy (ROI +34.69% vs −35.17% — Walsh & Joshi). Backtest Brier/ROI obligatoire avant signaux prod.
3. Veto = +19.8% win prob d'équipe (Bandit Map Selection) → proba de map jouée à injecter.
4. Seuil ≥65% déjà codé (`CONFIDENCE_THRESHOLD`) ; manque la preuve de calibration.
5. Gaps identifiés : L0 backtest harness, L1 handicap rounds market, L2 map play prob, L3 EV vs cotes, L4 UI HLTV-like, L5 cron HLTV JSON.

## État code
Aucune ligne de code modifiée — livrable = rapport + vision (phase brainstorming, HARD-GATE design avant code).

## Prochaines étapes (après validation du rapport)
1. OK utilisateur sur la vision → writing-plans → lots L0→L5.
2. Priorité : L0 (backtest) puis L3 (EV) — la calibration conditionne tout.
3. Beads à actualiser : relier le rapport (hptw, uon4 restent des données bloquées non nécessaires v1).