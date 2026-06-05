# Résumé — Modèle tennis SPW/RPW (sportbotai.com)

> **Source** : https://www.sportbotai.com/blog/tennis-prediction-model-spw-rpw-explained
> **Type** : article de blog vulgarisé (pas de papier académique, formules non détaillées).

---

## 1. Idée centrale

Prédire un match tennis depuis 2 stats fondamentales par joueur :
- **SPW** (Serve Points Won) — % de points gagnés au service.
- **RPW** (Return Points Won) — % de points gagnés en retour.

Structure **hiérarchique** : `Point → Jeu → Set → Match`. Si on connaît SPW/RPW des 2 joueurs, on peut "simuler chaque point, jeu, set, match" (Monte Carlo).

## 2. Performance citée
- Modèle point-based : **68.7%** accuracy ATP 2014 vs **Elo 64.9%** (et 70.6% vs 66.8% sur un autre split).
- Couche ML sur features SPW/RPW : **ROI 5.8%** vs 2.1% pour Elo (2021).

## 3. Estimation SPW/RPW par joueur
- Baselines carrière/saison (ex. Djokovic Wimbledon 2023 : 77.1% SPW).
- **Rolling windows** : MAJ toutes les 3-5 jeux (capture le momentum live).
- **Splits surface** : Berrettini 78.5% SPW gazon vs 68.9% terre.

## 4. Ajustements
- **Surface** : modifie SPW/RPW de base (gazon vs terre).
- **Latéralité adversaire** : SPW/RPW varient gaucher/droitier (ex. Medvedev RPW dur vs gauchers >42%).
- **Forme récente** : updating dynamique mid-match (Sinner RPW saute après un break).
- **Couche ML** : feature engineering (surface, forme, latéralité, météo) au-dessus du SPW/RPW brut.

## 5. Edge / betting
- **Market Alert** : un shift de **2-4%** du SPW/RPW rolling signale de la value avant correction du marché (ex. +4% RPW outsider → alerte).
- Les classements statiques ratent l'adaptation surface/forme ; les modèles SPW/RPW dynamiques exploitent le décalage de cotes.

## 6. Limite de l'article
Aucune formule fermée donnée (P(jeu) depuis SPW, P(set) depuis P(jeu)). Repose sur la **simulation** Monte Carlo, pas du closed-form.

---

# + pour PariScore

## On a DÉJÀ ce modèle — et en version plus rigoureuse ✅

L'article décrit exactement notre moteur tennis existant, mais nous utilisons du **closed-form Klaassen-Magnus (2001, peer-reviewed)** au lieu de la simulation Monte Carlo de l'article :

| Brique article | Implémentation PariScore | Locus |
|---|---|---|
| P(jeu) depuis SPW | `gameHoldProb(spw)` — formule fermée jeu + boucle deuce | server.js:23052 |
| P(set) depuis P(jeu) | `setWinProb(holdA, holdB)` — DP exact mémoïsé + tiebreak | server.js:23066 |
| P(match) BO3/BO5 | `computeTennisMatchProb` — `pS²(1+2qS)` / `pS³(1+3qS+6qS²)` | server.js:23128 |
| Scores sets exacts | `matchSetProbs` (2-0/2-1/...) | server.js:23087 |
| RPW par joueur/surface | `getPlayerRPW(name, surface, lastN)` | server.js:23833 |
| **Ajustement adversaire SPW−(oppRPW−avg)** | `p1Eff = spw − (oppRPW − avgRPW) + speedNudge` | server.js:23930 |
| Surface speed nudge | `getTennisSurfaceSpeed` + speedNudge | server.js (surface_speed) |
| Neutralisation aces par RPW relanceur | `(oppRet.rpw − 0.42) × 3.5` | server.js:24432 |
| UQD IC90 sur SPW | `computeBootstrapUQDTennis` (500 sim, perturbation gaussienne SPW) | server.js:23236 |

**Avantages de notre version vs article** :
- **Closed-form ~50µs/match** (DP mémoïsé) vs Monte Carlo (bruit d'échantillonnage + lent).
- Référence académique (Klaassen-Magnus) vs blog.
- IC90 bootstrap + calibration Brier déjà mesurée (~0.21 walk-forward, > Elo seul).

## Gaps réels que l'article éclaire (pistes nouvelles)

1. **Latéralité (hand) dans l'ajustement SPW/RPW** — quick win.
   `tennis_matches` a `winner_hand`/`loser_hand`. L'article cite l'effet gaucher/droitier sur RPW (Medvedev >42% vs gauchers). Ajouter un terme `handMatchupNudge` dans `p1Eff/p2Eff` (ex. SPW gaucher au service vs droitier). Mesurable Brier A/B (réutilise `tools/backtest-age-features-brier.js`).

2. **Market Alert sur shift SPW/RPW rolling 2-4%** — synergie alertes SSE.
   On a déjà l'infra alertes SSE (`vl02`) + momentum live. Ajouter un trigger : si le SPW/RPW rolling (3-5 derniers jeux) d'un joueur dévie de ≥3% vs baseline pré-match → recompute `computeTennisMatchProb` live → si Δproba franchit un seuil et la cote n'a pas bougé → alerte VALUE. C'est le cœur "edge" de l'article, directement branchable.

3. **SPW/RPW rolling live recalculé mid-match** — enrichit le modal live.
   Vérifier qu'on recompute SPW/RPW en direct (toutes les N jeux) pour nourrir `live_poisson`/win prob live, pas seulement les baselines pré-match. Si pas déjà fait → fenêtre glissante sur les points BSD live.

4. **Couche ML sur features SPW/RPW** (ROI 5.8% cité) — rejoint bd `ffh`/idée GBM.
   Les features SPW/RPW (+ surface, hand, forme) en entrée d'un GBM offline = exactement la "ML layer" de l'article. Cohérent avec la piste non-linéaire du backtest âge (bd `c0li`). L'âge n'aidait pas en linéaire ; SPW/RPW eux sont déjà le signal fort — un GBM pourrait capter les interactions.

## Verdict
Article = **validation externe** de notre architecture (on est state-of-art, voire au-dessus). Pas de refonte. 4 incréments actionnables, le plus rentable = **#2 Market Alert SPW/RPW rolling** (réutilise alertes SSE + moteur proba existant) et **#1 hand matchup** (quick win backtestable).

## MAJ — Backtest #1 hand matchup (2026-06-05) : NO-GO

Outil : `tools/backtest-hand-matchup-brier.js` (offline, Sackmann, recherche). Variantes base / lefty_adv (gaucher-vs-droitier orienté) / lefty_raw (être gaucher), expanding window.

| Circuit | base Brier | lefty_adv Δ | lefty_raw Δ |
|---|---|---|---|
| ATP (2147, gauchers 13.3%) | 0.1822 | +0.0001 | +0.0001 |
| WTA (2131, gauchers ~9%) | 0.1990 | −0.0000 | −0.0000 |

**NO-GO câblage.** La latéralité n'apporte rien une fois Elo/rank/points contrôlés : l'edge gaucher est **déjà absorbé dans l'Elo/SPW/RPW** du joueur (rating gagné en partie via cet edge → terme hand redondant). Même schéma que l'âge : les features "contexte" marginales n'ajoutent pas sur un baseline de skill fort.

**Conséquence priorités** : abandonner les features additives linéaires (âge, hand). Le vrai levier reste **#2 Market Alert SPW/RPW rolling live** (timing/edge marché, pas prédiction pré-match) et éventuellement un **GBM** captant les interactions (où ces features pourraient contribuer via splits, pas en additif).
