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
- **Interaction Elo×Age** (heatmap du paper) plutôt qu'effet linéaire additif.
- **Modèle non-linéaire** (GBM/RF) où l'âge contribue via splits — le paper montrait l'âge surtout utile en RF/splines, pas en linéaire.

## MAJ — Recalibration du pic par circuit (2026-06-05, 2e run)

Outil étendu : dérivation du pic data-driven (grid search 18-36 ans, in-sample logloss) + 4 variantes comparées (base / fixed@30 / recal@pic / quad âge+âge²).

### ATP — pic dérivé = **30.5 ans** (≈ paper)
| variante | Brier | ΔBrier | LogLoss |
|---|---|---|---|
| baseline | 0.1819 | — | 0.5421 |
| fixed@30 | 0.1812 | −0.0007 | 0.5409 |
| recal@30.5 | 0.1812 | −0.0007 | 0.5408 |
| quad | 0.1812 | −0.0007 | 0.5404 |
→ Pic recalibré ≈ 30 = confirme le paper. **Aucun gain au-delà du fixe 30** (toujours −0.0007 marginal).

### WTA — pic dérivé = **35.5 ans (ARTEFACT)**
| variante | Brier | ΔBrier |
|---|---|---|
| baseline | 0.1988 | — |
| fixed@30 | 0.1988 | −0.0000 |
| recal@35.5 | 0.1995 | **+0.0007** (pire) |
| quad | 0.2012 | **+0.0024** (pire) |
→ 35.5 = overfit du grid in-sample (signal âge faible vs Elo + survivorship élites tardives type Venus/Errani). Hors-échantillon, recal et quad **dégradent**. Quad 2023 = 0.2172 vs base 0.2081 (overfit franc).

### Conclusion finale
La recalibration **ne sauve pas** la feature : ATP confirme ~30 sans gain supplémentaire, WTA n'a pas de pic stable récupérable sur 2022-2026 (le paper disposait de 2011-2022). **NO-GO blend définitif.** Age features = explicabilité UI only (commit `843a7e5`). Pré-requis pour réexplorer : historique plus long + modèle non-linéaire régularisé + interaction Elo×Age.
