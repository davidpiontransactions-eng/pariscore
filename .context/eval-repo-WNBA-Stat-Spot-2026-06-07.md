# Eval repo — mitchelldawkinsjr/WNBA-Stat-Spot (2026-06-07)

GM/CTO eval. Source: https://github.com/mitchelldawkinsjr/WNBA-Stat-Spot
But : onglet NBA/WNBA pour PariScore.

## 1. Extraction
- **Type** : plateforme WNBA complète **Laravel (PHP) + SvelteKit**, Postgres + Redis. Active (2026-05), ~6.6MB, CI/CD lourd.
- **Modèle/algo** : prédiction de **player props** (points/rebonds/passes over-under) via **Bayesian Gamma-Poisson**, **Monte Carlo** (Normal/Poisson/Gamma/Beta/Log-normal + corrélations), **Poisson** (steals/blocks), **RegressionAnalyzer**. Backtesting (ModelValidationService, RunHistoricalPredictionTests).
- **Features/target** : stats joueuses → distribution prop → proba over/under. Prop scanner + BettingRecommendationService.
- **Données** : modèles WnbaGame/Team/Player/Play/PlayerGame (play-by-play + boxscore). Import via `ImportWnbaData`. Odds via **The Odds API** (`OddsApiService` 38KB).
- **Métriques** : backtesting présent mais **aucun chiffre headline** (accuracy/Brier/ROI) dans les README.
- **Stack** : PHP/Laravel, SvelteKit, Postgres, Redis, Docker. **Licence : AUCUNE** (null → tous droits réservés = flag legal, code non réutilisable).

## 2. Odds circulaire ? Odds = The Odds API, utilisé pour comparer/recommander (prop scanner). Pas clairement en entrée du modèle stat (props = distributions joueuses). Pas d'alerte forte.

## 3. Analyse vs PariScore

| Critère | WNBA-Stat-Spot | PariScore | Verdict |
|---|---|---|---|
| Math | Poisson/Bayesian/MonteCarlo (PHP) | **déjà** Poisson bivarié + bayesianBlend + bootstrap UQD | **redondant** |
| Calibration/UQD | backtest, pas de chiffre | bootstrap IC + Brier | égal/PariScore |
| **Player props** (pts/reb/ast O/U) | **oui** (Gamma-Poisson) | **non** (NBA = game-level Elo/Four Factors/devig) | **idée inédite** |
| Données WNBA | import play-by-play | — (pas de WNBA) | à ajouter |
| Stack | **PHP/Laravel/Postgres/Redis/Svelte** | Node zero-dep | **NO-GO infra** (sidecar massif) |
| Licence | **aucune** (ARR) | — | code non réutilisable |

## 4. Recommandation GM : **NO-GO repo / GO-PARTIEL onglet WNBA**

1. **NO-GO wholesale** : Laravel/PHP/Postgres/Redis/SvelteKit = sidecar énorme contre Node zero-dep. **Sans licence** → code non réutilisable (idées seulement). Math déjà dans notre moteur.
2. **GO le but (onglet WNBA) — via ESPN, PAS ce repo** : vérifié live —
   - `site.api.espn.com/apis/site/v2/sports/basketball/**wnba**/scoreboard` → 4 matchs (Seattle Storm @ Minnesota Lynx) ✅
   - teams ✅ ; **headshots** `a.espncdn.com/i/headshots/**wnba**/players/full/{id}.png` → 200 ✅
   - Notre **onglet NBA est déjà ESPN** (`basketballService.js` → `basketball/nba`, routes `/api/v1/nba`).
   → **Onglet WNBA = miroir du vertical NBA** avec endpoints `wnba`. Zero-dep, propre, photos incluses.
3. **Idée à garder pour plus tard** : **player props O/U** (pts/reb/ast en Gamma-Poisson) — vrai différenciateur, on a la math (Poisson/Bayesian). Gros feature, séparé.

**Effort** :
- Onglet WNBA (miroir NBA via ESPN) : **MOYEN** (~½ jour) — cloner `basketballService` NBA→WNBA + routes `/api/v1/wnba` + onglet front + nav (réutilise tout le pattern NBA existant).
- Player props WNBA : **GROS** (feature neuve), optionnel/après.

## 5. Décision
Repo = **NO-GO** (PHP sidecar, ARR, math redondante). **Mais ton but est faisable proprement** : onglet WNBA en miroir du vertical NBA via ESPN WNBA (data + photos vérifiées). Le repo ne sert que de **validation de domaine** + l'idée props.

Attente : GO pour construire l'onglet WNBA (miroir NBA via ESPN) ? (props = phase 2 optionnelle)
