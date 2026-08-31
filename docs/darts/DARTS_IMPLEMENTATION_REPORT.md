# 🎯 Darts sur Pariscore — Rapport d'implémentation v2

> **Bead de référence** : `ParisScorebis-p538` (P0) — phases P1→P5 tracées dans bd (voir §10).
> **Statut** : Rapport v2 — intègre l'analyse de la librairie **Darts (Unit8)** et le plan hybride TS/Python.
> **Date** : 2026-08-31

---

## 1. Contexte & objectif

Ajouter un onglet **Darts** à Pariscore : prédictions pré-match et live, stats joueurs, marchés Over/Under (legs, 180s), avec la même rigueur d'ingénierie que le module tennis existant (Markov live 17/17 tests, memoisation, `clearAllMemos()` point unique).

Deux travaux d'analyse ont alimenté ce rapport :

1. **Étude comparative** des sites de prédictions fléchettes + revue des modèles académiques (§4).
2. **Lecture de la documentation de la librairie Darts (Unit8)** — `https://unit8co.github.io/darts/generated_api/darts.models.forecasting.html` (§3).

---

## 2. ⚠️ Constat clé : deux « Darts » différents

| | **Darts le sport** | **Darts la librairie** (unit8co) |
|---|---|---|
| Nature | Sport de précision (PDC, legs, sets, 501) | Framework Python Apache 2.0 de **forecasting de séries temporelles** |
| Modèles | Markov sur états de leg, Elo | ARIMA, Theta, LightGBM, TFT, N-BEATS, Chronos… |
| Runtime | Bun/TypeScript (Pariscore) | Python |
| Rôle dans le projet | **Le domaine à implémenter** | **Boîte à outils méthodologique + pipeline offline Python** |

**Conséquences pratiques :**

- La librairie ne modélise **pas** le sport : elle est incompatible nativement avec le runtime Bun/TypeScript.
- Elle est néanmoins **directement réutilisable** pour la partie offline : Pariscore a déjà le pattern « pipeline Python précalculé → JSON servis via CDN/SWR » (session *Rankings Home/Away Pipeline* : `scripts/scrape_rankings.py` + GitHub Actions CRON + `use-league-rankings.ts`).
- ⚠️ **Risque de collision de nommage** : dans `src/`, le préfixe `darts-` désigne le **sport** (`darts-markov.ts`…). Le pipeline Python est nommé `scripts/darts-forecast/` pour lever l'ambiguïté.

---

## 3. Analyse de la librairie Darts (Unit8) — ce qu'il faut en retenir

### 3.1 Catalogue des modèles (relevant mapping)

| Famille | Modèles | Pertinence Pariscore Darts |
|---|---|---|
| **Baselines** (`Local`/`GlobalForecastingModel`) | `NaiveMean`, `NaiveSeasonal`, `NaiveDrift`, `NaiveMovingAverage`, `GlobalNaive*` | ⭐⭐⭐ **Base à battre obligatoire** — tout modèle doit surpasser `NaiveSeasonal` en backtest avant déploiement |
| **Statistiques locales** | `ARIMA`, `AutoARIMA`, `ExponentialSmoothing`, `AutoETS`, `AutoCES`, `Theta`, `FourTheta`, `AutoTheta`, `KalmanForecaster`, `Prophet`, `FFT`, `Croston`, `StatsForecastModel`, `TBATS`, `AutoTBATS`, `AutoMFLES` | ⭐⭐⭐ `AutoTheta`/`AutoETS` = tendance de forme joueur ; **`Croston` = séries à événements rares (les 180s !)** |
| **ML globaux (SKLearn-like)** | `LinearRegressionModel`, `RandomForestModel`, `CatBoostModel`, `LightGBMModel`, `XGBModel` | ⭐⭐⭐ Gradient boosting sur features (moyenne 3/9/15 visites, taux checkout, H2H, repos) |
| **Deep learning (PyTorch/Lightning)** | `RNNModel`, `BlockRNNModel`, `NBEATSModel`, `NHiTSModel`, `TCNModel`, `TransformerModel`, `TFTModel`, `DLinearModel`, `NLinearModel`, `TiDEModel`, `TSMixerModel`, `NeuralForecastModel` | ⭐ Overkill au lancement (données insuffisantes) — phase R&D future |
| **Foundation zero-shot** | `Chronos2Model`, `TimesFM2p5Model`, `TiRexModel`, `PatchTSTFMModel` | ⭐ Intéressant R&D : prévision sans entraînement sur petites séries |
| **Ensembles** | `NaiveEnsembleModel`, `RegressionEnsembleModel` | ⭐⭐ Fusion Markov TS + forecasts Python |
| **Conformal** | `ConformalNaiveModel`, `ConformalQRModel` | ⭐⭐⭐ **Intervalles de prédiction calibrés** → dimensionnement Kelly fiable |
| **Classification** | `SKLearnClassifierModel`, `CatBoostClassifierModel`, `LightGBMClassifierModel`, `XGBClassifierModel` | ⭐⭐ Victoire/défaite binaire (alternative à la régression) |

### 3.2 Infrastructures méthodologiques à copier (pas la lib elle-même)

| Mécanisme Darts | Équivalent Pariscore |
|---|---|
| `historical_forecasts()` (backtest rolling) | Harness de backtest **prérequis** (Phase 0) : edge réel hors échantillon, sinon pas de déploiement |
| `past_covariates` / `future_covariates` / `static_covariates` | static : format tournoi, côté throw ; past : forme récente (moyennes glissantes) ; future : connues d'avance (TV, repos) |
| **Likelihoods** dont `Poisson` | Comptages : nombre de 180s par match, total de legs → colle au pipeline betting existant (de-vig → edge → Kelly) |
| **Encoders** (lags, fenêtres glissantes) | Features temporelles pour la moyenne par visite |
| **Hierarchical reconciliation** | Cohérence des totaux (legs match ↔ legs par set) si on multiplie les marchés |
| **Explainability SHAP** (`TFTModel Explainer`, SHAP for SKLearn) | « Pourquoi ce pick » : gros plus UX Pariscore |

---

## 4. Étude comparative : sites de prédictions & modèles académiques

### 4.1 Sites offrant des prédictions fléchettes

| Site | Fonctions | Qualité données | API |
|---|---|---|---|
| **Paddy Power Darts** | Cotes match, vainqueur tournoi, proba 180s | Élevée (bookmaker) | Limitée |
| **Betfair Exchange** | Lay/in-play, handicaps | Très élevée (temps réel) | API (premium) |
| **Oddschecker** | Comparaison de cotes | Élevée (agrégée) | Aucune |
| **dartswpdart.com** (Darts Database) | Stats joueurs, moyennes, fréquence 180s | Moyenne (historique) | Aucune |
| **DartConnect / PDC TV stats** | Stats par visite en live | Élevée | Non publique |

**Observation clé** : la plupart des sites se limitent aux cotes pré-match et vainqueurs de tournoi. **Peu offrent une modélisation live point-par-point** — c'est là que Pariscore peut se différencier (comme en tennis avec `live-markov.ts`).

### 4.2 Modèles académiques pertinents

| Modèle | Applicabilité |
|---|---|
| **Chaînes de Markov** | ⭐⭐⭐ Directement applicable — événements discrets (visites, legs), structure analogue tennis (point→jeu→set ≈ visite→leg→match) |
| **Processus de Poisson** | ⭐⭐ Comptages : 180s par match, total de legs (Lambda ≈ f(moyennes joueurs)) |
| **Elo + decay de forme** | ⭐⭐⭐ Baseline de force joueur, half-life ~5 matchs |
| **Régression gaussienne de processus / GP** | ⭐ Courbes de forme non-linéaires |
| **RNN / deep learning** | ⭐ Expérimental — datasets trop petits au lancement |

**Insights académiques clés :**

1. Le score fléchettes est **visit-based** : chaque leg alterne des visites de 3 fléchettes — structurellement analogue aux jeux/sets du tennis.
2. La **moyenne par visite** (~30–40 pts à 3 fléchettes) est la métrique clé, analogue au % de premières balises.
3. La **fréquence des 180** = l'équivalent des aces : rare mais structurant → modèle Croston/Poisson.
4. La **probabilité de checkout** (finir sur un double) = l'équivalent de la conversion de balles de break — métrique décisive, pression-dépendante.

### 4.3 Meilleurs modèles de paris sur les fléchettes

| Modèle | Description | Complexité |
|---|---|---|
| **Markov Decision Process** | États : score restant, joueur au throw, n° de visite | Haute (données granulaires) |
| **Elo + decay de forme** | Elo pondéré par forme récente (half-life ~5 matchs) | Basse |
| **Hiérarchique Poisson-Gamma** | Scores de visite Poisson à rate Gamma | Moyenne (Bayésien) |
| **180 + Checkout** | P(180) × P(checkout) + seuils de score par visite | Basse-moyenne |
| **De-vig bookmaker** | Probabilités implicites depuis cotes efficaces | Basse (déjà en place côté tennis) |

---

## 5. Architecture recommandée : hybride TS (live) + Python (offline)

```
ONLINE (TypeScript/Bun — temps réel)
src/lib/prediction/darts-markov.ts     # Markov leg/set, adapté de live-markov.ts
src/lib/prediction/darts-elo.ts        # Elo + decay de forme
src/lib/prediction/darts-types.ts      # Types stricts
src/lib/prediction/darts-live.ts       # Ajustement live (clearAllMemos point unique)

OFFLINE (Python — CRON, pattern rankings existant)
scripts/darts-forecast/forecast_form.py    # AutoTheta/AutoETS sur séries de moyennes
scripts/darts-forecast/boosted_probs.py    # LightGBM victoire + ConformalQR intervalles
→ JSON précalculé → DB (pattern league_season_stats) ou CDN + SWR

ONLINE consomme
src/app/api/v1/darts/[...]             # Fusionne Markov live + forecasts offline
src/components/darts/*                 # UI shadcn existante
```

**Pourquoi hybride** : le Markov live doit tourner en TS (latence client/serveur) ; les prévisions de forme n'exigent pas le temps réel → précalcul Python quotidien, **zéro dépendance runtime ajoutée**.

---

## 6. Mapping tennis → fléchettes (invariants à conserver)

| Tennis (existant, 17/17 tests) | Fléchettes (adapté) |
|---|---|
| `gameWinProb(p)` — proba au niveau point | `legWinProb()` — proba au niveau visite/throw |
| Hold de service | **Hold de throw** (gagner le leg quand on ouvre) |
| Break | **Break de throw** (gagner le leg de l'adversaire) |
| Set, tie-break `"7-6"` **ET** `"6-7"` | Leg décider, best-of-N **configurable par tournoi** |
| `E(1,0,.65,true)=1.35`, `E(0,0)≈2.46` | Invariants DP analogues à recalibrer |
| Over/Under jeux | Over/Under legs, Over/Under 180s (Poisson) |
| `clearAllMemos()` point unique dans `adjustLambdaLive` | Idem — point unique dans la branche live darts |
| Memoisation : clés avec holds quantifiés | Clés avec visites/holds quantifiés |

### 6.1 Types de base (`darts-types.ts` — squelette)

```typescript
// Types stricts — pas de `any` (règle projet)
export type DartsFormat = "bestOf5" | "bestOf7" | "bestOf9" | "bestOf11" | "bestOf15" | "bestOf21";

export interface DartsPlayerStats {
  playerId: string;
  name: string;
  elo: number;                    // rating Elo avec decay
  avgPerVisit: number;            // moyenne 3 fléchettes (ex: 93.4)
  checkoutPct: number;            // % de checkout réussis (0-1)
  first9Avg: number;              // moyenne des 9 premières fléchettes
  p180: number;                   // 180 par match (Lambda Poisson)
  legsWonOnThrow: number;         // hold de throw (historique)
  legsBrokenOnThrow: number;      // legs concédés quand l'adversaire ouvre
}

export interface DartsMatchLive {
  matchId: string;
  format: DartsFormat;
  legsA: number;
  legsB: number;
  onThrow: "A" | "B";
  currentThrowAvgA: number;       // moyenne du match en cours
  currentThrowAvgB: number;
  p180A: number;                  // P(180) par visite, live-adjustée
  p180B: number;
}
```

### 6.2 Moteur Markov (`darts-markov.ts` — squelette adapté de `live-markov.ts`)

```typescript
// Même discipline que live-markov.ts : Maps module-level partagées,
// clés de mémoïsation quantifiées, clearAllMemos() point unique.

const legWinMemo = new Map<string, number>();

/** P(gagner le leg) à partir de la force par visite. */
export function legWinProb(avgSelf: number, avgOpp: number, checkoutSelf: number, checkoutOpp: number): number {
  // Proba que self atteigne 0 avant opp ; proxy : sigmoïde du delta de moyenne
  // pondérée par les checkouts (calibrer sur données historiques PDC)
  const key = `${q(avgSelf)}|${q(avgOpp)}|${q(checkoutSelf)}|${q(checkoutOpp)}`;
  const hit = legWinMemo.get(key);
  if (hit !== undefined) return hit;
  const p = 1 / (1 + Math.exp(-K * (adj(avgSelf, checkoutSelf) - adj(avgOpp, checkoutOpp))));
  legWinMemo.set(key, p);
  return p;
}

/** P(casser le throw de l'adversaire) — analogue breakProb tennis. */
export function breakOfThrowProb(holdA: number, holdB: number): number {
  // dérivé des stats hold/broken (darts-types)
  return 1 - holdA / (holdA + holdB - holdA * holdB);
}

/** Distribution des scores du match, best-of-N configurable. */
export function matchScoreDistribution(legWin: number, bestOfN: number): Map<string, number> {
  // ex. bestOf5 : 3-0, 3-1, 3-2, 2-3, 1-3, 0-3 (sum = 1)
  return dpDistribution(legWin, Math.ceil(bestOfN / 2));
}

/** Espérance des legs restants — DP récursif (comme expectedRemainingSets). */
export function expectedRemainingLegs(legsA: number, legsB: number, legWin: number, legsNeeded: number): number;

/** Nettoyage centralisé — appelé au point unique de la branche live. */
export function clearAllMemos(): void;
```

**Règles de sanity à tester (cible 17/17, calquées sur `tests/live-markov-sanity.spec.ts`) :**

- `matchScoreDistribution` somme à 1 (tolérance 1e-9) et couvre les deux orientations (`3-2` **ET** `2-3`).
- `expectedRemainingLegs` : invariants DP vérifiés à valeurs recalibrées.
- Clés de mémoïsation incluent les moyennes **quantifiées** (Maps module-level partagées entre matchs).
- `clearAllMemos()` appelé dans la branche live (point de passage unique).
- Marchés Over/Under retournent des floats 0-1 (conversion ×100 côté composants).

---

## 7. Pipeline Python offline (squelette)

```
scripts/darts-forecast/
├── requirements.txt          # darts>=0.36, lightgbm, pandas
├── forecast_form.py          # AutoTheta/AutoETS sur séries de moyennes par visite
├── boosted_probs.py          # LightGBMClassifierModel + ConformalQRModel
└── README.md
```

```python
# forecast_form.py — prévision de forme (pattern Unit8 Darts)
from darts import TimeSeries
from darts.models import AutoTheta, CrostonMethod, ConformalQRModel

def forecast_player_form(series: list[float], horizon: int = 3) -> dict:
    """Prévoit la moyenne par visite des N prochains matchs.
    CrostonMethod pour les 180s (événements rares), AutoTheta pour la moyenne."""
    ts = TimeSeries.from_values(series)
    theta = AutoTheta().fit(ts)
    croston = CrostonMethod().fit(ts)  # 180s = événements intermittents
    return {
        "avg_forecast": theta.predict(horizon).values().tolist(),
        "p180_forecast": croston.predict(horizon).values().tolist(),
    	# Backtest obligatoire : battre NaiveSeasonal sinon pas de déploiement
    }
```

**Sortie** : JSON précalculé → DB SQLite (pattern `league_season_stats`) → servi via `/api/v1/darts/` + SWR.

---

## 8. API & UI

### 8.1 Endpoints (`src/app/api/v1/darts/`)

| Route | Description |
|---|---|
| `GET /api/v1/darts/players` | Joueurs classés avec Elo + stats saison |
| `GET /api/v1/darts/tournament/[id]` | Prédictions & cotes par tournoi (formats configurables) |
| `GET /api/v1/darts/live/[matchId]` | État de prédiction live (fusion Markov TS + forecasts offline) |
| `GET /api/v1/darts/stats/[playerId]` | Stats détaillées joueur (moyennes, 180s, checkout %) |

### 8.2 Composants UI (⚠️ vérifier `COMPONENTS.md` avant tout référencement — règle anti-loop)

| Composant | Description |
|---|---|
| `darts/predictive-bets.tsx` | Marchés : Over/Under legs, Over/Under 180s (analogie « Set en cours » tennis) |
| `darts/player-stats-grid.tsx` | Comparaison joueurs (moyenne, 180s, checkout %, Elo) |
| `darts/match-predictor.tsx` | Probabilité de victoire pré-match |
| `darts/live-betting-panel.tsx` | Mise à jour live des probas (Web) |

**Design tokens** : charte Pariscore (`DESIGN_CHARTER.md` — dark navy + vert néon `#00e676`). Composants shadcn/ui + Tailwind 4. i18n via `next-intl` (FR d'abord).

---

## 9. Données : sources & stratégie

| Source | Usage | Accès |
|---|---|---|
| API-Football / sportradar MCP | Vérifier couverture fléchettes (non garantie) | Clés `.env` existantes |
| Scraping stats PDC/DartConnect | Historique moyennes, 180s, checkouts | Node `https` / scrapling (⚠️ WAF Cloudflare — cf. leçons OddAlerts : sur VPS, tout via FlareSolverr) |
| Cotes bookmakers | De-vig → edge → Kelly | `ODDS_API_KEY` existant |
| Forecasts Python précalculés | Forme, intervalles conformaux | JSON DB/CDN |

---

## 10. Roadmap & traçabilité bd

| Phase | Bead | Contenu | Critère de vérification |
|---|---|---|---|
| **P0** | `ParisScorebis-p538` ✅ | Ce rapport (analyse unit8 + plan hybride) | Rapport écrit dans `docs/darts/` |
| **P1** | `ParisScorebis-664n` | Types TS, Elo + decay, fixtures, API basique | `typecheck` vert, routes répondent |
| **P2** | `ParisScorebis-o53m` | Moteur Markov TS + tests sanity | 17/17 tests `bun:test` verts |
| **P3** | `ParisScorebis-4j2i` | Pipeline Python offline + backtest | Bat `NaiveSeasonal` en backtest rolling |
| **P4** | `ParisScorebis-xxlt` | UI onglet Darts + COMPONENTS.md à jour | QA UI, lint vert |
| **P5** | `ParisScorebis-cf8z` | QA finale + deploy optionnel | `bun run lint` + `bun run typecheck` = 0 erreur |

**Boucle d'ingénierie par phase** (format objectif vérifiable) :
`1. [Research] → verify: contexte compris` → `2. [Implement] → verify: compile` → `3. [Quality] → verify: lint+typecheck 0 errors` → `4. [Test] → verify: tests verts` → `5. [Close] → bd close <id> → bd dolt push`.

---

## 11. Risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| **Données insuffisantes** (datasets joueurs < séries ML) | Probas non fiables | Privilégier Theta/ETS/Croston avant gradient boosting ; Elo-only comme fallback |
| **Formats de tournoi hétérogènes** (best-of 5→21, WC sets×legs) | Modèle inapplicable | `DartsFormat` configurable par tournoi |
| **180 rares** | Comptage difficile | Poisson + Croston (lib Darts) |
| **Checkout variable sous pression** | Biais live | Init saison, update live avec outcomes réels |
| **WAF scraping** (Cloudflare « Just a moment ») | Interruption data | Odds APIs d'abord ; scraping fallback FlareSolverr (leçon OddAlerts 2026-08-23) |
| **Collision de nommage** « darts » | Confusion codebase | Préfixe `darts-` = sport dans `src/` ; `scripts/darts-forecast/` = pipeline Python |

---

## 12. Conclusion

L'implémentation Darts sur Pariscore est **faisable et alignée** avec l'architecture existante. La découverte clé de la v2 : la librairie **Darts (Unit8)** n'est pas un outil de modélisation du sport mais un framework de forecasting — elle est exploitée comme **méthodologie offline Python** (backtest rolling, covariates, likelihoods Poisson, intervalles conformaux) tandis que le **moteur live reste en TypeScript**, adapté de `live-markov.ts` (17/17 tests comme standard de qualité).

**Timeline estimée** : P1–P5 ≈ 11–15 semaines. **Complexité** : moyenne (adaptation plutôt que réécriture). **Risque principal** : disponibilité des données — mitigé par le fallback Elo-only.

---
*Document tracé dans beads : `ParisScorebis-p538` → phases `664n`, `o53m`, `4j2i`, `xxlt`, `cf8z`.*



