# Backtest Brier A/B — Age features (bd c0li Phase 2)

> Outil : `tools/backtest-age-features-brier.js` (offline, recherche interne).
> Source : `tennis_matches` (Sackmann) — usage backtest uniquement, **rien shippé**.
> Date : 2026-06-05. Paper réf : arXiv 2502.01613.

## Protocole
- Régression logistique (GD zero-dep, features standardisées, L2=1e-3).
- Baseline = `[d_rank, d_lpoints, d_elo]` · Enhanced = baseline + `[d_age30, d_ageint]`.
- Elo incrémental (K=32) sur tout le circuit, snapshot pré-match. Orientation p1/p2 déterministe (hash) → labels équilibrés.
- Expanding window par année (train < Y, test = Y).

## Résultats

### ATP Grand Slam (2152 matchs, 2022–2026)
| Année | n | Brier base | Brier +age | Δ |
|---|---|---|---|---|
| 2023 | 504 | 0.2014 | 0.2007 | −0.0007 |
| 2024 | 507 | 0.1748 | 0.1728 | −0.0020 |
| 2025 | 506 | 0.1929 | 0.1945 | **+0.0016** |
| 2026 | 127 | 0.1584 | 0.1569 | −0.0015 |
| **moy** | | **0.1819** | **0.1812** | **−0.0007** |
- LogLoss −0.0011 · Classif 72.2% → 72.0%. 3/4 fenêtres améliorées (2025 dégradée).

### WTA Grand Slam (2155 matchs, 2022–2026)
| moy | Brier base | Brier +age | Δ |
|---|---|---|---|
| | 0.1988 | 0.1988 | **−0.0000** |
- LogLoss +0.0002 (légèrement pire) · Classif 68.8% → 68.5%.

## Interprétation
- **ATP** : gain réel mais **marginal** (Brier −0.0007), non-monotone (2025 pire) → dans le bruit.
- **WTA** : **nul/négatif**. Confirme que le pic à 30 ans est spécifique aux hommes (paper = ATP only). `Age.30`/`Age.int` mal calibrés pour WTA (pic plus jeune).

## Décision (override du verdict naïf du script)
**NO-GO câblage dans `bayesianBlend`.** Raisons :
1. Le blend proba est **partagé ATP/WTA** ; or WTA ne gagne rien (voire perd) → risque de régression nette.
2. Gain ATP marginal et instable (sous le seuil de bruit inter-fenêtres).
3. `math-invariants.md` : ne modifier les poids calibrés qu'avec preuve solide — ici preuve faible.

**Garde la feature `age_features` en EXPOSÉ + UI seulement** (déjà livré commit `843a7e5`) : valeur d'explicabilité (section "ÂGE · ÉCART PIC 30" du modal pro), zéro risque sur l'edge.

## Pistes si on veut vraiment exploiter l'âge plus tard
- **Pic par circuit** : recalibrer `Age.opt` (ex. ~24-25 WTA vs 30 ATP) → re-tester.
- **Interaction Elo×Age** (heatmap du paper) plutôt qu'effet linéaire additif.
- **Modèle non-linéaire** (GBM/RF) où l'âge contribue via splits — le paper montrait l'âge surtout utile en RF/splines, pas en linéaire.
