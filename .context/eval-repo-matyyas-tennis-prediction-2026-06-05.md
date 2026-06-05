# Éval modèle externe — `Matyyas/Tennis-Prediction`

> Date : 2026-06-05 · Auteur : GM/CTO PariScore · Statut : **PENDING DG GO/NO-GO**
> Repo : https://github.com/Matyyas/Tennis-Prediction · Licence : **NON SPÉCIFIÉE** ⚠️

---

## 1. Quel modèle ?

**Logistic Regression + XGBoost** (sklearn/xgboost). Objectif affiché : "profitable betting strategy".

### Features / target
- Target = vainqueur match (Winner vs Loser).
- Colonnes : `WRank, LRank, W2, L2, W3, L3, Lsets` + **colonnes cotes `B365W/B365L, PSW/PSL, MaxW/MaxL, AvgW/AvgL, EXW`**.
- ⚠️ **Cotes PRÉSENTES dans le dataset features** — rôle (input modèle vs backtest-only) non délimité dans le code. Risque circulaire élevé.

### Données
- **tennis-data.co.uk 2000-2016** (même source que palaia). Holdout = 2017. CSV scrapé.
- ⚠️ Stale (s'arrête 2016/2017). Format = cotes B365/Pinnacle historiques.

### Métriques
- ❌ **Aucun accuracy / log-loss / Brier / calibration publié.**
- Seul "résultat" = **1 graphe de profit cumulé** ("lucrative strategy"). = backtest ROI non audité, pas de Kelly/edge-threshold/coûts transaction/closing-line visibles.

### Stack
- Jupyter 99.5% / Python. `requirements.txt`.

---

## 2. Avantages vs PariScore ?

### Verdict : **NO-GO.** Circulaire probable + non-vérifié + sans licence.

| Critère | Constat |
|---|---|
| **Licence** | ❌ **Aucune licence** = "all rights reserved" par défaut. PAS libre d'usage. Pire que MIT/Apache. Drapeau légal (cf. leçon TML). |
| **Edge marché** | ❌ Cotes présentes comme features → **modèle circulaire probable** (apprend le marché). Le "profit cumulé" sans méthodo = backtest non auditable, classique overfit / pas de closing line. |
| **Calibration/UQD** | ❌ Zéro Brier/log-loss/IC/reliability. Viole règle UQD. Non shippable. |
| **Redondance** | ❌ Logistic + XGBoost sur rank + odds = exactement ce que `bayesianBlend` + devig Shin-Hurley couvrent déjà, en calibré. |
| **Features inédites** | ❌ Rank + sets + odds = déjà tout dans pipeline. Pas de serve/return, pas d'Elo, pas de surface dédiée. |
| **Preuve ROI** | ❌ 1 graphe profit cumulé, pas de protocole (staking, vig, sample size out-of-sample, variance). Non probant. "Profitable backtest" ≠ edge réel. |
| **Stack** | ❌ Python/Jupyter vs Node zero-dep. |
| **Données** | ❌ tennis-data.co.uk 2016, stale. |
| **Leçon passée** | XGBoost/logistic sur rank+odds = edge déjà absorbé par Elo/devig. NO-GO cohérent. |

---

## 3. Recommandation GM

**NO-GO** (3 raisons) :
1. **Légal** — repo sans licence = pas réutilisable (all rights reserved). Bloquant sec.
2. **Circulaire + non-vérifié** — cotes en features (apprend le marché), aucune métrique calibration, "profit" = backtest non auditable.
3. **Redondant + stale** — logistic/XGBoost sur rank+odds déjà couvert par bayesianBlend ; data 2016 obsolète.

**Aucun GO-partiel.** Le dataset tennis-data.co.uk (cotes historiques) serait le seul actif — mais déjà identifié via rapport palaia (même source) et déjà couvert. Rien net-new.

---

## Annexe — sources vérifiées
- Repo : https://github.com/Matyyas/Tennis-Prediction
- Notebook : `tennis_prediction_notebook.ipynb` (Jupyter 99.5%)
- Modèles : Logistic Regression + XGBoost · Holdout 2017
- Data : tennis-data.co.uk 2000-2016 (cotes B365/PS/Max/Avg présentes)
- Licence : non spécifiée (= all rights reserved)
- Métriques : aucune (1 graphe profit cumulé only)

---

**Attente : ton GO/NO-GO.** (reco = NO-GO ferme — légal + circulaire + non probant)
