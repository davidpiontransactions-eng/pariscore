# Session SPIDER-CHART — trace de fin
Réf : `SESSION-2026-09-10-SPIDER-CHART` · Fin : 2026-09-10 ~21h45 UTC

## Livré
1. **Recherche** : littérature spider/radar (serve n°1, retour, momentum) + extraction tenngrand (Playwright, malgré CAPTCHA Jina) → `.context/REVUE-HEATMAPS-TENNIS.md` (benchmarks tour, règles heatmap, proposition produit).
2. **TennisRadarChart** (`tennis-radar-chart.tsx`, 200 composants au registre) : 6 axes PowerScore, dégradés, animation, badge duel PS, caption données partielles. Câblé dans `MatchDetailDialog` après PlayerVsBlock (hors synthétiques).
3. **TennisHeatmap** (`tennis-heatmap.tsx`) : 2 joueurs × 6 metrics triés Power Index, vert/rouge absolus, tooltips.
4. **US Open dames** : Sabalenka-Pegula en Top10 momentum ; greffe Élo/forme (BSD + elo-data fuzzy).
5. **Fix honnêteté** : Élo 1500 factice exclu du PowerScore (`eloKnown`) — fini les "13" trompeurs (Pegula/Gauff/Rybakina → 50 neutre). Sabalenka 78 réel.

## Gantt final : T1-T8 done (T2 partiel : images tenngrand inaccessibles).
## Gates : tsc 0, eslint 0, 64 tests pass, builds distants OK, audits Playwright prod verts.
## Commits : voir `git log --oneline` (spider+heatmap, e8742143 PowerScore v2, bb37e7f5 fix-13).
## Limites connues
- Serve/retour/Over invisibles si leaderboard absent (semaines Challenger) — pas de signaux fabriqués.
- Foot calendar sans PowerScore (données BSD absentes) — moteur prêt.
- `/tmp` VPS fantôme 3,8 Go (débloqué par remount 6G) — à investiguer hors pointe.
- Dashboard "Top matchs" vide : contrat rompu (`top-matches/all` → tableau vs `{groups}`) — bead à créer.
