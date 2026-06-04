# Résumé — Statistical Enhanced Learning for Tennis (Grand Slam ATP)

> **Paper** : *Statistical enhanced learning for modeling and prediction tennis matches at Grand Slam tournaments*
> **Auteurs** : Nourah Buhamra, Andreas Groll (TU Dortmund)
> **arXiv** : 2502.01613 (stat.AP, fév. 2025)
> **Lien** : https://arxiv.org/abs/2502.01613

---

## 1. Problème

Tester si des covariables dites **"statistically enhanced"** (issues de modèles statistiques séparés, pas des stats brutes) améliorent la prédiction des matchs de tennis ATP en Grand Chelem. Concept déjà validé en football (Groll et al.) : injecter une force d'équipe estimée par un modèle externe comme feature dans un méta-modèle.

## 2. Covariables enhanced (le cœur)

Trois variables ajoutées, toutes en **différence J2−J1** :

| Variable | Définition |
|---|---|
| **Elo** | Rating Elo dynamique (base 1500), MAJ après match selon résultat × force adverse. Track la forme dans le temps. |
| **Age.30** | Distance absolue entre âge joueur et 30 ans (pic perf supposé, Weston 2014). |
| **Age.int** | Distance aux bornes de l'intervalle optimal [28,32]. 0 si dans l'intervalle, sinon distance à 28 (<28) ou 32 (>32). |

Covariables conventionnelles : Age, Rank ATP, Points ATP (aussi en différence).

## 3. Modèles comparés

- **Régression logistique** (effets linéaires, GLM sigmoïde)
- **GAM** avec P-splines (effets non-linéaires, base B-spline pénalisée)
- **Random Forest** (400 arbres, `mtry` optimisé via CV 10-fold, package `ranger`)

> Pas de boosting / LASSO / ridge testés.

## 4. Données

- **5 013 matchs** ATP messieurs Grand Chelem, **2011–2022** (AO, RG, Wimbledon, US Open — 47 tournois).
- Réponse : binaire (J1 gagne = 1). Walkovers/abandons exclus. Zéro valeur manquante.

## 5. Validation

- **Expanding window** (résultats principaux) : train = tous tournois <2022, prédit séquentiellement chaque GC 2022, train élargi après chaque.
- **Leave-one-tournament-out CV** + **rolling window** (12 tournois) en annexe.

## 6. Résultats clés (expanding window)

| Modèle (gagnant) | Covariables | Classif. rate | Pred. likelihood | Brier ↓ |
|---|---|---|---|---|
| Régression linéaire | Points, Rank, **Elo** | 0.795 | 0.696 | 0.153 |
| Splines | **Elo**, Age.30 | 0.792 | 0.703 | **0.149** |
| Random Forest | Points, Rank, Age.30, **Elo** | **0.820** | 0.667 | 0.151 |

- **Random Forest** = meilleur taux de classification (**0.820**).
- **Splines** = meilleur Brier (0.149) + likelihood (0.703).
- **Elo aide systématiquement** : tout modèle incluant ≥1 variable enhanced (Elo / Age.30 / Age.int) bat sa version sans, sur les 3 approches et les 3 stratégies. Coef Elo régression = **+0.0042**/unité.

## 7. Explicabilité (IML — PDP / ICE)

Sur le Random Forest gagnant :
- **Rank** : chute forte de P(victoire) quand l'écart de rang grandit, puis aplatissement. Forte hétérogénéité individuelle (ICE).
- **Elo** : PDP légèrement non-monotone (baisse puis remonte) mais association globale positive.
- **Points** : pente montante nette (plus de points → plus de proba), rendements décroissants en haut.
- **Age.30** : tendance légèrement décroissante puis plate ; proximité du pic aide modérément. Forte variabilité ICE.
- **Interaction Elo × Age.30** (heatmap) : l'effet Elo est renforcé pour les joueurs proches de 30 ans.

## 8. Conclusion paper

Méta-features peu coûteuses (Elo + 2 transformations d'âge) améliorent la prédiction quel que soit le modèle. RF meilleur en classification, splines meilleur en calibration (Brier). IML rend le RF interprétable (drivers = Rank, Points, Elo, proximité âge optimal).

---

# Avantages pour PariScore

## Déjà en place (le paper valide notre approche)
- **Elo surface dynamique** : `tennis_players_elo`, `predictions.elo`, `elo_surface`. ✅ Le paper confirme empiriquement le gain Elo (notre socle est le bon).
- **Blend méta-modèle** : `bayesianBlend` / `blended` (Poisson+Elo+xG) = exactement la philosophie "statistical enhanced learning" (features dérivées de modèles → méta-prédicteur). ✅
- **Brier backtest** : `computeTennisBrierBacktest` + calibration buckets déjà livrés. ✅ Mêmes métriques que le paper (Brier, likelihood, classif rate) → on peut benchmarker nos modèles avec leur protocole.
- **Bootstrap UQD IC90** : `computeBootstrapUQDTennis`. ✅

## Gains nouveaux exploitables (faible coût, edge mesurable)

1. **Features d'âge `Age.30` / `Age.int`** (quick win)
   - Dérivables si on a la date de naissance joueur (BSD player profile expose `turned_pro`, parfois `birthdate`; sinon Sackmann/Wikidata).
   - Ajout dans `buildTennisValueBets` enrichment → nouvelles colonnes `age30_diff`, `ageint_diff` injectées dans `bayesianBlend` ou comme ajustement de proba.
   - Coût : ~quelques heures. Gain : amélioration calibration documentée (Brier 0.153→0.149).

2. **Modèle Random Forest / GBM tennis** (moyen terme)
   - Le dossier `ml/` + `catboost_info/` existe déjà (BSD utilise CatBoost). Entraîner un RF/GBM messieurs GC sur notre `tennis_internal_history` (21 281 lignes ETL) avec features [Rank, Points, Elo surface, Age.30, Age.int] en différence.
   - Sortie = `prob_rf` ajoutée au blend (3e modèle après Elo+BSD). RF a battu la régression en classification (0.820).
   - Réutilise notre pipeline Python ml/ — pas de violation zero-dep serveur (RF tourne offline, sert via cache/route).

3. **Couche explicabilité PDP/ICE** (synergie avec le nouveau modal pro)
   - On vient de livrer le modal pro tennis (confidence_badge, reliability). Ajouter une section **"FACTEURS CLÉS"** : afficher la contribution des drivers (Rank diff, Points diff, Elo diff, Age) façon PDP simplifié → justifie la proba au parieur.
   - Aligne avec posture "rigueur scientifique / UQD" du CTO PariScore.

4. **Protocole de validation expanding-window**
   - Adopter expanding/rolling window dans `computeTennisBrierBacktest` (au lieu de simple holdout) → backtest plus rigoureux, anti-leak temporel. Crédibilise les claims edge.

## Limites / vigilance
- Paper = **ATP messieurs Grand Chelem uniquement** (BO5). Généralisation WTA / BO3 / ATP 250-500 non testée → valider avant d'étendre.
- Pic d'âge 30 ans = hypothèse messieurs ; WTA pic plus jeune → recalibrer `Age.30`/`Age.int` par circuit.
- RF gagne en classification mais splines mieux calibré (Brier) → pour du **betting** (EV dépend de proba calibrée), privilégier le modèle bas-Brier, pas le haut-classif-rate.

## Reco priorisée
1. **Age.30 / Age.int** dans l'enrichment (quick win, faible risque) → A/B Brier vs baseline.
2. **GBM/RF offline** sur historique interne, exposé comme 3e composante du blend.
3. Section **"FACTEURS CLÉS"** explicabilité dans modal pro tennis.
4. Migrer backtest vers **expanding window**.
