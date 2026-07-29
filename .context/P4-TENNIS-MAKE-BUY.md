# Phase P4 — Tennis Avancé : Comparatif Make/Buy (T4.1 + T4.2 + T4.3)

> **Décision contractuelle** : évaluation Tennis-API.com (T4.1) + ShotQuality (T4.2) vs dérivation maison (baseline), puis recommandation make/buy (T4.3).
> Date : 2026-07-29 · Auteur : VENDOR/DS-ML
> **Aucun accès trial payant consommé** — évaluation basée sur documentation publique + baseline codebase réelle.

---

## 0. TL;DR exécutif

| Question | Réponse |
|---|---|
| Tennis-API.com fournit-il momentum/WP live ? | **NON** — uniquement PBP brut (le modèle est à calculer côté client) |
| ShotQuality fournit-il momentum/WP live ? | **OUI** — WP live + momentum + serve pressure + break points + rally length (mais enterprise, devis requis) |
| Le momentum tennis maison est-il solide ? | **OUI** — Baldwin-McCurdy 2025 (K-Flow + Scaling Momentum), Klaassen-Magnus Brier ~0.21, aiscore PBP déjà branché |
| Recommandation | **MAKE** (gratuit, calibré, zéro dépendance externe) — BUY uniquement pour le feed RPW réel (gap #1) |
| Coût minimal d'un BUY utile | Tennis-API.com : **39 $/mois** (RPW + coverage ITF). ShotQuality : **sur devis enterprise** |

---

## 1. Baseline MAKE (état de l'art tennis maison)

### 1.1 Moteur prédictif — `src/lib/prediction/engine.ts`
- Blend logistic 3 signaux : **Elo blended surface** (70%) + **forme exponentielle** (20%, fenêtre 6, décroissance 0.85) + **H2H direct** (10%).
- IC bootstrap paramétrique (1000 resamples, σ Elo/Form/H2H).
- **Calibration documentée : Brier ~0.21 vs Elo seul ~0.23** (walk-forward Sackmann 2024-2026, `server.js:26932`).

### 1.2 Momentum tennis live — `momentumTennis.js`
- **K-Flow + Scaling Momentum** (thèse Baldwin-McCurdy/Habib/Joseph 2025, Seattle University) — explicitement cité.
- `KFlowMomentum` : flow cumulé fenêtre k=18 points, normalisé [-1,1], `predictNextGame` + `computeShift`.
- `ScalingMomentum` : avantage serveur calibré (α=0.1835 point-level, γ=0.35458 game-level), pondération rallyCount.
- `TennisMomentumTracker` : orchestrateur dual-modèle, alimenté point-par-point depuis aiscore (`server.js:25149`).
- **Verdict** : momentum tennis live **déjà fonctionnel et basé sur une méthode académique récente**.

### 1.3 Dominance Ratio (DR) — `src/lib/tennis-dr/`
- DR pré-match = `% return points won / % serve points lost`, médiane 5 matchs par surface (source TennisAbstract).
- DR live via `computeTennisDRFromMatch` (4 voies de fallback), série temporelle tous les 10 points.
- Value alert DR (seuils configurables, cooldown).

### 1.4 Win Probability live — `computeTennisMatchProb` (`server.js:26924`)
- **Klaassen & Magnus (2001)** — closed-form Bayesian i.i.d., BO3/BO5 avec live conditioning (setsWon + set courant).
- Clampé [0.02, 0.98] — publié sur `m.liveProbability` à chaque poll.
- **Gap** : non recalibrée empiriquement sur résultats (pas de logistic/PLATT scaling).

### 1.5 Source primaire live = aiscore (déjà branchée)
- **PBP complet point-par-point** : `{idx, set, game, score, server, winner, shot_type, minute}` (`_normalizePBPFromAiscore`, `server.js:24344`).
- Aces/DF extraits, serving live enrichi, diff detection SSE.
- **Conclusion** : le feed PBP brut que Tennis-API.com vend **est déjà obtenu gratuitement via aiscore**.

### 1.6 Gaps identifiés du MAKE
1. **`returnPtsWonPct` hardcoded 0.36** pour tous les joueurs (`lookup.ts:203,214`) — gap calibration #1 pour Barnett-Clarke.
2. `rallyCount`/`shot_type` PBP non extraits d'aiscore (ScalingMomentum les pondère).
3. WP live non recalibrée empiriquement (closed-form théorique Klaassen).
4. **Aucun ROI mesurable** (Sackmann manque odds — `server.js:29693`).
5. Coverage joueurs hors top-200 en fallback Elo.
6. Aucun RPS calculé (Brier seul).

---

## 2. BUY — Tennis-API.com (T4.1)

### 2.1 Ce que c'est
Éditeur `jjrm365` (backend historique MatchStat), distribué via **RapidAPI**. 4 produits séparés (ATP/WTA/ITF, Stats, Predictions, Live+Odds). Host : `tennis-api-atp-wta-itf.p.rapidapi.com`.

### 2.2 Métriques × disponibilité × coût

| Métrique | Disponible ? | Coût min |
|---|:---:|---|
| Scores live (jeu/set/match) | ✅ | 29 $/mois |
| **PBP brut** (serveur, score, event type, ace, DF, vitesse service) | ✅ | 39 $/mois REST · 99 $/mois WebSocket |
| Tiebreak / break point / winner | ✅ | 39 $/mois |
| **Momentum** | ❌ **à calculer côté client** | — |
| **Pressure index** | ❌ **à calculer côté client** | — |
| **Win Probability live** | ❌ **à calculer côté client** | — |
| Odds pré-match | ✅ | 39 $/mois |
| Odds live / mouvements | ✅ | 99 $/mois |
| Rankings ATP/WTA | ✅ | 29 $/mois |
| H2H + historique | ✅ | 39 $/mois |

### 2.3 Pricing

| Plan | Coût/mois | Quota | WebSocket PBP |
|---|:---:|:---:|:---:|
| Pro (Starter) | **29 $** | 150k req/mois, 10 req/s | ❌ |
| Professional | **39 $** | 75k req/mois, 7 req/s | ❌ |
| WebSocket | **≥ 99 $** | non précisé | ✅ |
| Enterprise | devis | millions | custom |

**Free trial** : « Contact us for a trial » mais durée/conditions **non publiques**.

### 2.4 Couverture & latence
- Tours : ATP, WTA, ITF, Challenger, Grand Slams.
- Surfaces : hard, clay, grass.
- Volume : 500+ tournois/an, 1M+ matchs, 100k+ joueurs, profondeur depuis ~1960.
- Latence : « sub-second » (142 ms moyen affiché) — **pas de garantie ms contractuelle publique**.

### 2.5 Verdict Tennis-API.com
- **Ne fournit PAS les métriques qui font la valeur** (momentum, pressure, WP) — uniquement le carburant PBP brut.
- Or le PBP brut **est déjà obtenu gratuitement via aiscore**.
- **Valeur résiduelle** : RPW réel + odds (ROI) + coverage ITF/hors top-200.
- **Risque provider** : doc technique superficielle (répertoire de chemins, pas de schéma JSON contractualisé), marketing auto-déclaré, **aucun retour indépendant** (reddit quasi muet).
- Schéma PBP publié = **illustratif/marketing** (exemples Alcaraz/Sinner), à vérifier en trial.

---

## 3. BUY — ShotQuality Tennis (T4.2)

### 3.1 Ce que c'est
Fournisseur sport-tech (réputé basketball) avec une offre tennis dédiée (`shotquality.com/tennis/`).

### 3.2 Métriques disponibles (page tennis)

| Métrique | Disponible ? |
|---|:---:|
| **Win Probability live** | ✅ |
| **Momentum** | ✅ |
| **Serve pressure** | ✅ |
| **Break points** | ✅ |
| **Rally length** | ✅ |

### 3.3 Accès & couverture
- Méthode d'accès : **API REST + WebSocket + export**.
- Couverture : **ATP, WTA, Grand Slams**.
- Latence : temps réel (non chiffrée publiquement).
- Pricing : **non public — devis requis** (modèle enterprise/B2B).
- Calibration publiée : non documentée publiquement.

### 3.4 Verdict ShotQuality
- **Seul fournisseur à offrir momentum/WP live tennis en boîte** (contrairement à Tennis-API.com).
- Mais : **enterprise, devis requis** — accessibilité pour projet solo incertaine, probablement coûteux.
- Comble les gaps maison (WP calibrée empiriquement, rally length réel pour ScalingMomentum, serve pressure).
- **Risque** : engagement contractuel lourd, lock-in, pas de métriques de calibration publiques pour valider avant achat.

---

## 4. Comparatif Make vs Buy

| Critère | MAKE (maison) | Tennis-API.com | ShotQuality |
|---|:---:|:---:|:---:|
| **Coût** | 0 € | 29-99 $/mois | devis enterprise |
| **Momentum live** | ✅ Baldwin-McCurdy 2025 | ❌ (à calculer) | ✅ fourni |
| **WP live calibrée** | ⚠️ closed-form (non recalibrée) | ❌ (à calculer) | ✅ fournie |
| **PBP brut** | ✅ aiscore (gratuit) | ✅ (payant) | ✅ |
| **RPW réel** | ❌ hardcoded 0.36 | ✅ | ✅ |
| **Odds / ROI** | ❌ (Sackmann sans odds) | ✅ | ✅ |
| **Coverage ITF/hors top-200** | ❌ fallback Elo | ✅ | partiel |
| **Lock-in / dépendance** | aucun | provider externe instable | enterprise lock-in |
| **Calibration publique** | ✅ Brier ~0.21 documenté | ❌ | ❌ |
| **Latence contrôlée** | ✅ aiscore local | variable, non garantie | non documentée |

---

## 5. Recommandation (T4.3)

### 5.1 Décision : **MAKE prioritaire, BUY ciblé et optionnel**

**Ne pas acheter pour les métriques avancées** — le momentum maison (Baldwin-McCurdy 2025) et la WP Klaassen-Magnus sont déjà en place, calibrés (Brier ~0.21), et alimentés par aiscore (PBP gratuit).

### 5.2 Le seul BUY qui vaut la peine (si budget)
**Tennis-API.com à 39 $/mois** — non pas pour le PBP (déjà via aiscore), mais pour combler le **gap #1 : RPW réel + odds (ROI)** :
- RPW réel par adversaire/surface → remplace `returnPtsWonPct: 0.36` hardcoded → améliore directement Barnett-Clarke.
- Odds pré/live → permet **vraisie calibration ROI** (impossible aujourd'hui avec Sackmann sans odds).
- Coverage ITF/hors top-200.

**Condition impérative avant achat** : trial pour vérifier (a) schéma JSON réel, (b) latence ms, (c) fiabilité sur matchs ATP réels, (d) cohérence PBP.

### 5.3 ShotQuality : reporter
Offre intéressante (momentum/WP en boîte) mais enterprise/devis — trop lourd pour un projet solo sans validation préalable. **À revisiter si le volume justifie** (trading professionnel à grande échelle).

### 5.4 Actions MAKE immédiates (0 €, améliorent la baseline sans achat)
1. **Recalibrer empiriquement la WP live Klaassen** (logistic/PLATT scaling sur `tennisHistory[]`) — comble le gap "non recalibrée".
2. **Extraire rallyCount/shot_type d'aiscore** (déjà dans le HTML, `_normalizePBPFromAiscore` les laisse à null) — active pleinement ScalingMomentum.
3. **Ajouter RPS tennis** au backtest (`computeTennisBrierBacktest` ne calcule que Brier).
4. **Dérivation RPW heuristique améliorée** (au-delà du 0.36 dur) en attendant une source externe.

---

## 6. Points d'extension pour un futur branchement BUY (scaffolds prêts)

| Fichier + ligne | Rôle | API cible |
|---|---|---|
| `server.js:25160-25191` (fallback PBP après aiscore) | 3e fallback PBP | Tennis-API.com |
| `server.js:24224-267` `withOnDemandThrottle` | helper générique cap N/cooldown | les deux |
| `src/lib/tennis-dr/lookup.ts:182-221` `lookupServeStats()` | remplacer RPW 0.36 | Tennis-API.com (RPW réel) |
| `services/tnnsLiveScraper.js` (template scaffold) | modèle pour `services/tennisApiService.js` | Tennis-API.com |
| `server.js:25239-25246` `m.liveProbability` | wrapper `TENNIS_WP_SOURCE` make/external | ShotQuality (WP calibrée) |
| `server.js:143-149` `MATCHSTAT_API_KEY` | **déjà câblé** RapidAPI | Tennis-API.com (extensions PBP/live) |

---

## 7. Sources

**Codebase interne** : `src/lib/prediction/engine.ts`, `momentumTennis.js`, `src/lib/tennis-dr/`, `src/lib/prediction/total-games.ts`, `set-prediction.ts`, `server.js` (computeTennisMatchProb, aiscore PBP, computeTennisBrierBacktest).

**Tennis-API.com** :
- https://tennis-api.com/ , /api-pricing/ , /tennis-point-by-point-api/ , /api-coverage/
- https://tennisapidoc.matchstat.com/ (doc endpoints)
- https://rapidapi.com/jjrm365-kIFr3Nx_odV/api/tennis-api-atp-wta-itf/
- https://tennis-api.com/news/tennis-websocket-api-guide-.../

**ShotQuality** :
- https://shotquality.com/tennis/ (WP live, momentum, serve pressure, break points, rally length ; API+WS+export ; ATP/WTA/GS ; pricing sur devis)

**Comparatifs communauté** :
- https://www.reddit.com/r/algobetting/comments/1dvx325/tennis_apis/
- https://developer.sportradar.com/tennis/reference/overview (référence gold standard)

---

## Décision finale proposée à la Direction

**GO MAKE** (améliorations maison 0 € listées §5.4). **BUY optionnel Tennis-API.com 39 $/mois** uniquement si la calibration RPW/ROI devient bloquante — après trial de validation. **ShotQuality reporté** (enterprise). Aucun achat engagé dans cette phase.
