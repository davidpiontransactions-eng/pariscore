# Eval repo — calicartels/UFC-fight-prediction-matrix (2026-06-07)

GM/CTO eval. Source: https://github.com/calicartels/UFC-fight-prediction-matrix

## 1. Extraction

- **Modèle/algo** : réseau **Keras** (`model_round.h5`, HDF5 22KB). `predict.py` reshape l'entrée en `(1, 200, n_features)` → **séquence type LSTM/RNN** (200 pas). README liste aussi RandomForest / GradientBoosting / SVM / LogisticRegression (sklearn) explorés. Pas de couches/loss/optimizer documentés (notebooks `Model.ipynb` 94KB non quantifiés).
- **Features** (`predict.py`) : `HEIGHT_diff`, `REACH_diff`, `age_diff`, `form_skore` (2 fighters), `Fights` count, `Win/Draw/No_contest`, puis par stat : **CTRL/TotalTime** (control %), **landed/attempts** (accuracy ratio), **landed/TotalTime*300** (rate per-5min). **Symétrie** : `proba = ((1−pred(f1,f2)) + pred(f2,f1))/2`.
- **Target** : vainqueur (binaire).
- **Données** : scrap ufcstats-style (CTRL, landed/attempts…). Pas de dataset neuf vs nos CSV komaksym/Greco. `df_odds.csv` (fighter1,fighter2,odds_f1,odds_f2,bookmaker).
- **Métriques reportées** : **AUCUNE** (pas d'accuracy/Brier/ROI/calibration dans le README ni résumé). Projet portfolio 2023.
- **Stack/deps** : Python, Pandas, NumPy, scikit-learn, **Keras/TensorFlow**, Flask, Tkinter. Licence : **MIT** (déclarée README + lien LICENSE ; classifieur GitHub = null → vérifier fichier, flag mineur).

## 2. Odds = circulaire ?
**NON.** Les cotes (`df_odds.csv`) sont affichées dans l'UI à côté de la prédiction (comparaison), **pas en entrée** du vecteur modèle (`predict.py` ne les injecte pas). Donc pas de modèle circulaire — mais aussi **aucun edge marché** (le modèle ignore la cote ; nous on a le devig).

## 3. Analyse vs PariScore

| Critère | Repo | PariScore | Verdict |
|---|---|---|---|
| Edge marché | cote en affichage seul, pas d'edge value | **devig ensemble (45%)** = edge réel | PariScore ✅ |
| Calibration/UQD | **aucune** (règle CLAUDE.md : pas de prod sans IC) | bootstrap CI + Brier | PariScore ✅ |
| Métriques prouvées | **aucune** reportée | 63.5% test acc | PariScore ✅ |
| Symétrie | oui (avg 2 ordres) | **déjà fait** (commit symétrie) | redondant |
| form_score / W-D-NC / Elo | form + records | rolling-5 recency + **Elo SoS** | redondant/inférieur |
| Stack | **Python/TF/Keras/Flask** | **Node zero-dep** | sidecar TF coûteux = NO-GO infra |
| Features inédites | **accuracy = landed/attempted**, rate per-5min | a strike_eff (landed), damage (landed/absorbed), td/kd rate | **accuracy ratio = nouveauté exploitable** |

## 4. Recommandation GM : **NO-GO repo / GO-PARTIEL idée**

1. **NO-GO wholesale** : LSTM Keras = sidecar Python+TF sur le VPS (viole zero-dep, coût RAM/CPU), **zéro métrique prouvée**, symétrie/form/records déjà couverts, pas d'edge cote. "Lancer" l'app Flask telle quelle = dette infra pour un modèle non quantifié.
2. **GO-PARTIEL (le meilleur à prendre)** : la seule nouveauté = **accuracy ratios `landed/attempted`** (précision de frappe sig + précision TD) comme features. Converge avec la thèse KTH (Takedown Efficiency, Log Punch Ratio). Calculable depuis nos CSV (`parseOf` donne landed ET attempted).
3. **Effort** : ~1h — A/B local sur `build_mma_model.js` (ajout `strike_acc`, `td_acc`), retrain, comparer test-acc/logloss vs 63.5%. Merge **seulement si gain** (math-invariants : backtest avant prod), propagation 3 fichiers (build → runtime mmaService → meta).

## 5. Décision + résultat A/B (lancé)

User : "prends le meilleur et lance" → A/B local non-destructif lancé sur `build_mma_model.js`.
Ajout `td_acc` (TD landed/attempted, recency-weighted, 2 dims) — la SEULE idée non-redondante
(le repo ET la thèse KTH la pointent ; `td.a` était parsé-puis-jeté ligne 87).

**Résultat (même data courante, 3774 samples, split temporel 85/15) :**

| Modèle | TEST acc | logloss | poids td_acc |
|---|---|---|---|
| 15-feat (prod) | 63.5% | 0.640 | — |
| 17-feat + td_acc | 63.7% | **0.640** | **0.015 / −0.014 (≈0)** |

**Verdict : NO-GO merge.** +0.2pp = bruit (~1 combat sur le test), logloss identique, poids ≈0
(la régression juge `td_acc` non-informatif — `strk` encode déjà l'accuracy = landed/attempted × rate).
Modèle prod restauré intact, edits build reverts, rien commit/deploy.

**Bonus (séparé)** : les CSV ont 3774 samples vs 3207 à l'entraînement du modèle prod → retrain du
modèle 15-feat existant sur data fraîche = opportunité légitime (plus de data), à valider en A/B propre
(propagation 3 fichiers). Pas fait ici (hors scope repo).

Repo = **NO-GO**. Idée "meilleure" testée = **pas de gain**. PariScore reste devant.
