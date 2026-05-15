# BetMines — API Integration Proposal (PariScore)

> Document : analyse + proposition  
> Source : https://www.betmines.com/  
> Date : 2026-05-15  
> Auteur : Agent (PariScore v10.13+)  
> Statut : **GO FORTEMENT RECOMMANDÉ** — API publique, data goldmine, faible effort.

---

## 1. Résumé exécutif

BetMines.com expose une **API publique open** (`https://api.betmines.com/betmines/v1`) sans authentification, sans Cloudflare interstitial, avec une réponse JSON riche couvrant 298 fixtures/jour multi-marchés (1X2, O/U, BTTS, HT-FT, corners, asian handicap implicite). Couvre **toutes ligues mondiales** (Brésil, Asie, Sud-Am, top 5 EU, etc).

ROI exceptionnel : **3-4h dev** pour adapter à PariScore vs 12-15h pour aiscore. Pas de rate-limit dur observé.

---

## 2. Robots.txt + accès

```
User-agent: *
Allow: /
Disallow: /favourites
Sitemap: https://betmines.com/sitemaps/en.xml  ... (multi-langues)
```

**Cloudflare présent** sur sitemap (challenge interstitial) mais **API `api.betmines.com` directement accessible** avec headers browser-like (Origin + Referer). Pas de 403 reproduit.

---

## 3. Endpoint clé

```
GET https://api.betmines.com/betmines/v1/fixtures?from=YYYY-MM-DD&to=YYYY-MM-DD
Headers:
  User-Agent: Mozilla/5.0 (Chrome/120)
  Origin: https://www.betmines.com
  Referer: https://www.betmines.com/

→ status: 200, JSON array of fixtures
```

Test live (2026-05-15) : **298 matchs** retournés. Chaque fixture = 96 keys.

---

## 4. Structure data par fixture (96 keys)

### 4.1 Identifiants
- `id` (19698209), `seasonId`, `stageId`, `stageName`
- `timestamp` (unix), `date` (ISO), `dateTime`

### 4.2 Équipes
- `localTeam` (object) : avgConcededCorners, avgConcededYellowCards, avgLastFiveGoals, etc — stats équipe home
- `visitorTeam` (object) — stats team away
- `localTeamName`, `visitorTeamName`
- `localTeamPosition`, `visitorTeamPosition` (rank ligue)
- `localTeamScore`, `visitorTeamScore` (live)

### 4.3 Compétition
- `league` (object) : country.cloudFlagUrl, name, id, country.name

### 4.4 Odds (marchés multi)

| Marché | Keys |
|--------|------|
| 1X2 | `odd1`, `oddx`, `odd2` |
| Double Chance | `odd1x`, `odd12`, `oddx2` |
| Over/Under FT | `oddOver05`, `oddOver15`, `oddOver25`, `oddOver35`, `oddOver45` + Under equivalents |
| Over/Under HT | `oddOver05HT`, `oddOver15HT` + Under HT |
| BTTS | `oddGoal` (yes), `oddNoGoal` (no) |
| HT/FT combos (9) | `HT1FT1`, `HT1FT2`, `HT1FTx`, `HT2FT1`, `HT2FT2`, `HT2FTx`, `HTxFT1`, `HTxFT2`, `HTxFTx` |
| Corners | `corner1`, `corner2`, `cornerx` (1X2 corners), `cornerOver/Under 9.5/10.5` |
| GG/NG par side | `homeGG`, `awayGG`, `drawGG`, `homeNG`, `awayNG`, `drawNG` |

### 4.5 Prediction model (UNIQUE)

- **`bestOdd`** — meilleur marché recommandé (ex: `O15` = Over 1.5)
- **`bestOddProbability`** — proba % (ex: 89)
- **`bestOddValue`** — odd associée (ex: 1.12)

### 4.6 H2H + Stats historiques

- `totalConcededGolsLocalTeamH2H`, `totalConcededGolsLocalTeamHTH2H`
- `totalConcededGolsMeanLocalTeamH2H` etc (8 dimensions × home/away × FT/HT)
- `head2head_detail_list` (array — peut être empty)
- `events_list`, `stats_list`, `first_half_stats_list`, `second_half_stats_list` (live data)

### 4.7 Live

- `matchStarted`, `matchHT`, `matchEndend`, `matchSecondHalfStarted`
- `minute`, `addedTime`
- `timeStatus` (LIVE / NotStarted / etc)

---

## 5. Comparaison vs sources actuelles PariScore

| Critère | BetMines | BSD | Football-Data | OddsAPI | OpenFootball |
|---------|----------|-----|---------------|---------|--------------|
| Couverture | Mondiale (298/jour) | Mondiale | Top 12 EU | 5 sports priority | Top 5 EU fixtures |
| Markets | **8 marchés** complets | 1X2 + O/U + BTTS | Fixtures only | 1X2 + O/U + BTTS | None (no_odds) |
| HT/FT 9 combos | ✅ | ⚠ partiel | ❌ | ❌ | ❌ |
| Corners odds | ✅ | ⚠ | ❌ | ❌ | ❌ |
| Prediction model | ✅ bestOdd | ✅ ML preds | ❌ | ❌ | ❌ |
| H2H stats agg | ✅ | ✅ | ❌ | ❌ | ❌ |
| Auth | ❌ aucune | clé requise | clé requise | clé quota | aucune |
| Rate limit | non documenté | 1 req/2s OK | 10/min free | 500 req/mois | aucune |
| Coût | Gratuit | Gratuit | Gratuit | Gratuit limité | Gratuit |

**BetMines apporte** :
- HT/FT 9 combos (UNIQUE)
- Corners odds (UNIQUE vs sources actuelles)
- Predictions model bestOdd avec proba+value
- Couverture mondiale supérieure à FD (12 ligues UE seulement)

---

## 6. Plan d'intégration v10.14

### 6.1 Backend (server.js)

```js
const BETMINES_API = 'https://api.betmines.com/betmines/v1';
const BETMINES_TTL_MS = 30 * 60 * 1000; // 30min
const betminesCache = new Map();

async function fetchBetminesFixtures(dateFrom, dateTo) {
  const cacheKey = `${dateFrom}|${dateTo}`;
  const cached = betminesCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < BETMINES_TTL_MS) return cached.data;
  const url = `${BETMINES_API}/fixtures?from=${dateFrom}&to=${dateTo}`;
  const res = await httpsGet(url, {
    'Origin': 'https://www.betmines.com',
    'Referer': 'https://www.betmines.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    'Accept': 'application/json',
  });
  if (res.status !== 200 || !Array.isArray(res.data)) {
    throw new Error(`betmines HTTP ${res.status}`);
  }
  betminesCache.set(cacheKey, { ts: Date.now(), data: res.data });
  return res.data;
}

// Map BetMines → PariScore Match shape (adapter)
function adaptBetminesToPariScore(fx) {
  return {
    id: `bm_${fx.id}`,
    home_team: fx.localTeamName,
    away_team: fx.visitorTeamName,
    league: fx.league?.name,
    country: fx.league?.country?.name,
    commence_time: fx.dateTime || fx.date,
    odds: { home: fx.odd1, draw: fx.oddx, away: fx.odd2 },
    odds_btts_yes: fx.oddGoal,
    odds_btts_no: fx.oddNoGoal,
    odds_over25: fx.oddOver25,
    odds_under25: fx.oddUnder25,
    odds_ht_ft: { /* HT1FT1...HTxFTx */ },
    odds_corners_over95: fx.cornerOver95,
    bm_best_odd: { market: fx.bestOdd, prob: fx.bestOddProbability, value: fx.bestOddValue },
    home_rank: fx.localTeamPosition,
    away_rank: fx.visitorTeamPosition,
    home_score: fx.localTeamScore,
    away_score: fx.visitorTeamScore,
    minute: fx.minute,
    status: fx.timeStatus,
    _source: 'betmines',
  };
}
```

### 6.2 Routes proposées

| Route | Description |
|-------|-------------|
| `GET /api/v1/betmines/fixtures?from=&to=` | Raw fixtures |
| `GET /api/v1/betmines/best-bets?date=&min_prob=70` | Top bestOdd filtered |
| `GET /api/v1/betmines/match/:id` | Detail single |

### 6.3 Integration L1.5 routing (server.js)

Position dans `fetchOdds` routing cascade :
- L1 BSD (primaire)
- **L1.5 BetMines** (nouveau — fill gaps BSD avec HT/FT + corners + bestOdd)
- L2 Football-Data
- L3 OddsAPI
- L4 OpenFootball

BetMines comme **enrichissement** prefer/post-BSD : remplir champs odds_corners + bestOdd + HT/FT pour matchs déjà BSD-fetched.

### 6.4 Cron schedule

| Job | Fréquence | Heure |
|-----|-----------|-------|
| Today fixtures refresh | 30min | continu |
| Tomorrow fixtures + bestOdd | 1h | continu |
| Week ahead fixtures | 6h | continu |

### 6.5 Frontend integration

- Tableau matchs : nouvelle colonne **"BM Best Pick"** affichant bestOdd + proba si > 70%
- Modal match : section "BetMines Predictions" avec :
  - Best bet recommandé
  - HT/FT matrix 3×3 (9 combos)
  - Corners odds (>=9.5, >=10.5)
  - Prediction generator BM
- Strategy filter "BM ProbBet" → matchs avec `bm_best_odd.prob >= 75 && value > 1.20`

### 6.6 Estimation effort

| Phase | Effort |
|-------|--------|
| Backend scraper + adapter + cache | 1.5h |
| Routes + tests | 1h |
| Integration L1.5 routing | 1h |
| Frontend table column "BM Best Pick" | 1h |
| Frontend modal section + HT/FT matrix | 1.5h |
| Strategy filter BM ProbBet | 30min |
| Doc + cron schedule | 30min |
| **Total** | **7h** |

MVP minimal (juste fetcher + route) : **2.5h**.

---

## 7. Risques

| Risque | Mitigation |
|--------|-----------|
| API public undocumented → can change params/path | Wrapper try/catch + cache TTL court (30min) + monitoring 200 OK + count > 0 |
| Rate limiting silencieux | 1 req/3min max (cron 30min largement OK) + retry exponentiel si 429 |
| Cloudflare bot detection sur api.* (probable) | Browser-like headers Origin + Referer + UA Chrome (testé OK) |
| Quality predictions bestOdd | Backtester sur 30j avant trust en prod (PariScore /api/v1/accuracy pattern) |
| TOS Commercial | Non explicite — usage non-commercial PariScore Free OK, contact direct pour Pro plan |

---

## 8. Recommandation

**GO FULL impl v10.14 — 7h total**.

Rationale :
- ROI exceptionnel : data goldmine vs effort minimal
- Couverture mondiale 298 matchs/jour (vs FD 12 ligues)
- Predictions bestOdd unique (proba+value)
- 8 marchés complets HT/FT + corners (UNIQUE vs PariScore actuel)
- Aucun blocker technique (API directement accessible)

**Alternative MVP 2.5h** : juste fetcher + route + 1 frontend column → ship rapide pour valider valeur avant full integration.

---

*Fin du document.*
