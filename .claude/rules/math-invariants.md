---
description: PariScore math engine invariants — apply when server.js is modified
paths:
  - "server.js"
---

# Math Engine Invariants

<important if="modifying computePoisson, computeEdge, computeBetSignal, or bayesianBlend">
These values are calibrated — change them only with backtest evidence:
- λ normalization constant = **1.35** (league average goals)
- Bayesian blend weights: Poisson **50%** / Elo **25%** / xG **25%**
- Kelly cap = **25%** bankroll max (hard cap, never increase)
- EV signal = worst-case IC lower bound, NOT point estimate
- Bootstrap iterations = 500 (IC90)
</important>

## Safe Modification Rules
- Any change to `computePoisson()` → run backtest comparison before merging
- Adding new market → must propagate through `buildMatchRecord()` fully
- `computeBetSignal()` → EV must remain pessimistic (lower IC bound)
- `calibrateProbs()` → reliability diagram calibration must be preserved
- `computeLivePoissonInhomogeneous()` → λ_rem formula: `λ_full × time_adj × game_state_adj`
