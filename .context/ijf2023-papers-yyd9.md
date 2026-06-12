# IJF 2023 Papers — Rapport d'analyse

> Issue **ParisScorebis-yyd9** — Mine IJF 2023 papers: beating market w/ bad model + calibration.
> Date: 2026-06-12

---

## 1. PAPER CLÉ — Hubáček & Šír (IJF 2023)

**Titre :** *Beating the Market With a Bad Predictive Model*
**Auteurs :** Ondřej Hubáček, Gustav Šír
**In :** International Journal of Forecasting, Vol 39(2), pp 691–719
**Lien :** https://doi.org/10.1016/j.ijforecast.2022.01.007 | arXiv:2010.12508

### Résumé
Contre-intuitif : un modèle **moins précis** que le marché peut générer des profits
consistants. La clé est de **décorréler l'erreur résiduelle** du modèle de celle du
bookmaker. Plutôt que de maximiser l'accuracy, on modifie la loss function pour
pénaliser la corrélation avec les odds. Les auteurs le prouvent formellement et
le démontrent sur des données réelles (NBA + trading actions).

### Pertinence ParisScore : 5/5
Concept révolutionnaire pour PariScore. Notre problème actuel : nos modèles sont
corrélés aux odds bookmaker → quand on pense comme le marché, on perd à cause
de la marge. La décorrélation est exactement ce qu'il nous faut.

### Takeaways actionnables
1. **Loss function décorrélée** : modifier l'entraînement pour minimiser
   `corr(prédiction, odds_bookmaker)` en plus de l'erreur de prédiction.
2. **Features asymétriques** : ne PAS inclure les odds comme feature (ça
   force la corrélation). Utiliser des features brutes indépendantes.
3. **Avantage du market taker** : le bookmaker doit fixer un prix *avant* le
   match ; le parieur peut attendre et choisir. Cet avantage temporel est
   sous-exploité.

---

## 2. PAPER CLÉ — Walsh & Joshi (2023/2024)

**Titre :** *Machine Learning for Sports Betting: Should Model Selection Be Based
on Accuracy or Calibration?*
**Auteurs :** Conor Walsh, Alok Joshi
**In :** Machine Learning with Applications, Vol 16, 100539 (2024)
**Lien :** https://doi.org/10.1016/j.mlwa.2024.100539 | arXiv:2303.06021

### Résumé
Démonstration que la **calibration** (Brier score, ECE) est plus importante que
l'accuracy pour le betting. Sur données NBA : ROI de **+34.69%** avec sélection
par calibration contre **-35.17%** par accuracy. Le Kelly betting n'est rentable
qu'avec un modèle bien calibré.

### Pertinence ParisScore : 5/5
Actuellement PariScore optimise surtout l'accuracy. Ce paper montre que c'est
contre-productif pour le profit.

### Takeaways actionnables
1. **Métrique de sélection** : remplacer accuracy par Expected Calibration Error
   (ECE) ou Brier score dans la validation des modèles.
2. **Post-hoc calibration** : Platt scaling / Isotonic regression / temperature
   scaling sur les probabilités brutes.
3. **Kelly betting conditionnel** : n'utiliser Kelly qu'avec des probas
   calibrées (sinon sur-paris systématique).

---

## 3. PAPER — Holmes, McHale & Żychaluk (IJF 2023)

**Titre :** *A Markov Chain Model for Forecasting Results of Mixed Martial Arts
Contests*
**Auteurs :** Benjamin Holmes, Ian G. McHale, Kamila Żychaluk
**In :** International Journal of Forecasting, Vol 39(2), pp 623–640
**Lien :** https://doi.org/10.1016/j.ijforecast.2022.01.007

### Résumé
Modèle Markov Chain qui simule le combat round par round avec des estimations
de skill par phase (stand-up, ground, etc.). Surpasse les odds bookmaker et
permet une stratégie de betting profitable.

### Pertinence ParisScore : 3/5
Approche Markovienne intéressante pour les sports séquentiels (foot US, tennis).
Peut inspirer un module de simulation de match plutôt que prédiction statique.

### Takeaways actionnables
1. **Simulation Monte Carlo** : remplacer la prédiction directe par une
   simulation de match (états → transitions → résultat).
2. **Skill vectoriel** : estimer forces/faiblesses par phase de jeu plutôt
   qu'un seul rating global.

---

## 4. PAPER — Ramirez, Reade & Singleton (IJF 2023)

**Titre :** *Betting on a Buzz: Mispricing and Inefficiency in Online Sportsbooks*
**Auteurs :** Philip Ramirez, J. James Reade, Carl Singleton
**In :** International Journal of Forecasting, Vol 39(3), pp 1413–1423
**Lien :** https://doi.org/10.1016/j.ijforecast.2022.07.011

### Résumé
Le "buzz factor" (vues Wikipedia pré-match) prédit le mispricing des
bookmakers au tennis. Stratégie de betting sur le joueur avec plus de buzz →
profits substantiels. **Attention** : une correction (2023) a montré que les
résultats étaient tirés par un seul pari outlier.

### Pertinence ParisScore : 3/5
L'idée d'utiliser des signaux non-sportifs (buzz, attention médiatique) est
valable malgré la fragilité des résultats. Pourrait être adapté avec Twitter/X
ou Google Trends.

### Takeaways actionnables
1. **Signal "buzz"** : intégrer volume de recherche Google Trends / mentions
   Twitter comme feature additionnelle.
2. **Mispricing detection** : comparer nos probas aux odds → si écart > seuil,
   value bet potentiel.
3. **Leçon de robustesse** : toujours vérifier qu'un résultat n'est pas mené
   par un outlier.

---

## 5. PAPER — van der Wurp & Groll (2023)

**Titre :** *Using (Copula) Regression and Machine Learning to Model and Predict
Football Results in Major European Leagues*
**Auteurs :** Hendrik van der Wurp, Andreas Groll
**In :** Statistica Applicata - Italian Journal of Applied Statistics, Vol 35(1)

### Résumé
Comparaison exhaustive de régression classique, copules et ML sur les "big 5"
+ Pays-Bas + Turquie. Dataset public mis à disposition. Les copules (qui
modélisent la dépendance entre buts marqués/encaissés) performent bien.

### Pertinence ParisScore : 4/5
L'approche copule pour modéliser la corrélation home/away goals est directement
applicable.

### Takeaways actionnables
1. **Modèle bivarié** : remplacer Poisson indépendants par une copule pour
   capturer la dépendance home/away.
2. **Dataset public** : utiliser leur dataset comme benchmark.

---

## 6. CONCEPT CLÉ — Bookmaker Consensus Model (Zeileis et al.)

**Réf :** Leitner, Hornik & Zeileis (2010) — IJF
**Appliqué :** FIFA Women's World Cup 2023

### Résumé
Model averaging des odds de 24 bookmakers : (1) ajustement de la marge,
(2) moyenne sur log-odds, (3) transformation inverse en probas. Simple mais
efficace — souvent meilleur que les modèles complexes.

### Pertinence ParisScore : 4/5
PariScore agrège déjà plusieurs sources, mais ne fait pas de consensus
formel avec averaging pondéré.

### Takeaways actionnables
1. **Consensus bookmaker** : implémenter un vrai modèle de consensus avec
   averaging sur log-odds et shrinkage.
2. **Pondération dynamique** : pondérer les bookmakers par leur performance
   historique récente plutôt que moyenne simple.

---

## RECOMMANDATIONS POUR PARISCORE

### Priorité Haute (implémenter immédiatement)

| Concept | Source | Effet attendu |
|---------|--------|---------------|
| **Loss décorrélée** | Hubáček & Šír | Profit sur trades où le bookmaker se trompe |
| **Calibration > Accuracy** | Walsh & Joshi | ROI x10 vs sélection par accuracy |
| **Platt Scaling post-hoc** | Walsh & Joshi | Probabilités mieux calibrées → meilleur Kelly |

### Priorité Moyenne (explorer)

| Concept | Source | Effet attendu |
|---------|--------|---------------|
| **Copule bivariée** | van der Wurp & Groll | Meilleure modélisation score exact |
| **Simulation Markov** | Holmes et al. | Prédictions plus réalistes pour sports séquentiels |
| **Bookmaker consensus** | Zeileis et al. | Référence plus fiable que la moyenne simple |
| **Signal buzz** | Ramirez et al. | Alpha additionnel sur marchés inefficients |

### Priorité Faible (roadmap)

| Concept | Source |
|---------|--------|
| **Fenêtre temporelle asymétrique** | Hubáček & Šír |
| **Pondération dynamique bookmakers** | Zeileis et al. |
| **Features non-sportives** | Ramirez et al. |

### Architecture recommandée

```
Modèle brut (features seules, SANS odds)
    ↓
Loss = α·Brier + β·|corr(prédiction, odds)|
    ↓
Post-hoc calibration (Platt scaling)
    ↓
Kelly betting avec probas calibrées
    ↓
Détection value bet : écart proba_calibrée vs proba_marché
```
