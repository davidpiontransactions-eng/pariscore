# Eval repo — YZ1GO/M.EIC001_AC_PRJ (2026-06-07)

GM/CTO eval. Source: https://github.com/YZ1GO/M.EIC001_AC_PRJ

## 1. Extraction
- **Type** : projet académique FEUP (M.EIC, cours AC = Aprendizagem Computacional). **Jupyter Notebook**. 2026-01.
- **Tâche** : *WNBA Championship Prediction* sur **10 saisons** de données historiques —
  (1) classement régulier par conférence, (2) équipes qui **changent de coach**, (3) **vainqueurs des prix individuels** (COTY, FMVP…).
- **Modèles** : logistic regression, random forest, gradient boosting (cf. `output/awards/...`). Métrique : **precision@k** (top-1/3/5/10).
- **Données** : CSV WNBA académiques (players, teams, coaches, awards, series_post — saisons 1→11). **Statique, ancien** (pas live).
- **Métriques** : precision@k sur awards/ranking (académique, pas Brier/ROI betting).
- **Stack** : Python/Jupyter/sklearn. **Licence : AUCUNE** (null → ARR, code non réutilisable).

## 2. Odds circulaire ? N/A (pas de cotes — prédiction awards/ranking, pas de marché).

## 3. Analyse vs PariScore

| Critère | M.EIC001_AC_PRJ | PariScore | Verdict |
|---|---|---|---|
| **Problème** | ranking saison + awards + coach-change | **issue de MATCH** (game outcome, value bet) | **différent** |
| Données | CSV WNBA saisons 1-11 (statique, vieux) | **live ESPN** (onglet WNBA livré ce soir) | pas utile au live |
| Modèles | logistic/RF/GB (Python) | Elo/Pythag/FourFactors/blend (Node) | redondant/inférieur |
| Edge marché | aucun (pas de cotes) | devig ensemble | PariScore ✅ |
| Calibration | precision@k académique | bootstrap IC + Brier | PariScore ✅ |
| Stack | Python/Jupyter sidecar | Node zero-dep | NO-GO infra |
| Licence | **aucune** (ARR) | — | non réutilisable |

## 4. Recommandation GM : **NO-GO** (3 raisons)
1. **Mauvais problème** : prédit le classement de saison + awards + changements de coach — pas l'issue de MATCH ni le value bet. PariScore = betting jeu-par-jeu. L'onglet WNBA que je viens de livrer fait déjà le bon produit (prédictions de matchs live via ESPN).
2. **Données inutiles au live** : CSV académiques saisons 1-11 (vieux, statique). Le wnba_elo que je vais générer vient du **replay ESPN scoreboard saison courante**, pas de ce CSV.
3. **Python/Jupyter + sans licence** (ARR) → code non réutilisable, sidecar contre Node zero-dep.

**Effort : 0 — rien à prendre.**

### Note (hors repo)
La seule idée tangente = **WNBA futures** (champion/MVP en cote à terme) comme feature side. Niche, nécessite un marché futures, basse prio. Pas issue de ce repo.

## 5. Décision
**NO-GO.** 6e repo. Problème orthogonal (awards/ranking saison ≠ betting match), données vieilles, ARR, Python. L'onglet WNBA live (ESPN, livré) est la bonne direction produit.

Attente : ton GO/NO-GO (défaut NO-GO, rien à implémenter).
