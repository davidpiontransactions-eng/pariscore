# Spec Technique — Onglet MMA (bd `8gz3`)

> Référence: mma-ai.net (71% accuracy, +7.47% ROI). Date: 2026-06-05.

---

## Architecture

```
ufcstats.com ──┐  throttled node fetch, TTL 6h fighters / 30min events
jansen88 ETL ──┼──▶ SQLite (archive_mma + mma_fighters) ──▶ computeMMAWinProb()
Odds API ───────┘  sport: mma_mixed_martial_arts                    │
                                                            /api/v1/mma/fights
                                                                    │
                                                         pariscore.html #mma-tab
```

---

## Phase 1 — Data Pipeline (3-4j)

### 1.1 ETL Bootstrap — jansen88/ufc-data

```bash
# Vérifier license avant ETL
# https://github.com/jansen88/ufc-data → check LICENSE file
```

Tables SQLite à créer :

```sql
CREATE TABLE archive_mma (
  id INTEGER PRIMARY KEY,
  event_date TEXT,
  event_name TEXT,
  weight_class TEXT,
  fighter1 TEXT,
  fighter2 TEXT,
  winner TEXT,
  method TEXT,           -- KO/TKO | SUB | DEC | NC
  round INTEGER,
  odds_f1 REAL,          -- decimal odds
  odds_f2 REAL,
  source TEXT DEFAULT 'ufcstats',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE mma_fighters (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  reach_cm REAL,
  height_cm REAL,
  dob TEXT,
  slpm REAL,             -- sig strikes landed per minute
  str_acc REAL,          -- strike accuracy %
  sapm REAL,             -- sig strikes absorbed per minute
  str_def REAL,          -- strike defense %
  td_avg REAL,           -- takedown avg per 15 min
  td_acc REAL,           -- takedown accuracy %
  td_def REAL,           -- takedown defense %
  sub_avg REAL,          -- submission avg per 15 min
  win_ko INTEGER DEFAULT 0,
  win_sub INTEGER DEFAULT 0,
  win_dec INTEGER DEFAULT 0,
  total_fights INTEGER DEFAULT 0,
  last_updated TEXT
);

CREATE TABLE mma_events (
  id INTEGER PRIMARY KEY,
  event_name TEXT,
  event_date TEXT,
  location TEXT,
  odds_api_id TEXT,
  cached_at TEXT
);
```

### 1.2 Scraper ufcstats.com

```
GET http://ufcstats.com/statistics/fighters          → liste fighters paginée
GET http://ufcstats.com/fighter-details/{id}         → stats fighter
GET http://ufcstats.com/statistics/events/completed  → événements passés
GET http://ufcstats.com/event-details/{id}           → fight card détail
```

Pattern node.js :

```javascript
async function fetchUFCStats(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PariScore/1.0)' }
  });
  return res.text();
}
// Parse HTML → cheerio (ou regex)
// Throttle: 1 req/2s max
```

### 1.3 Route backend

```
GET /api/v1/mma/fights            → upcoming fights avec probs + cotes
GET /api/v1/mma/events            → liste événements UFC à venir
GET /api/v1/mma/fighter/:name     → stats fighter + historique
```

---

## Phase 2 — Modèle Prédictif (2-3j)

### Features différentielles (A = fighter favori, B = outsider)

| Feature | Calcul |
|---|---|
| `slpm_diff` | A.slpm - B.slpm |
| `str_acc_diff` | A.str_acc - B.str_acc |
| `str_def_diff` | A.str_def - B.str_def |
| `td_avg_diff` | A.td_avg - B.td_avg |
| `td_acc_diff` | A.td_acc - B.td_acc |
| `sub_avg_diff` | A.sub_avg - B.sub_avg |
| `reach_diff` | A.reach_cm - B.reach_cm |
| `age_diff` | B.age - A.age (jeunesse = avantage) |
| `win_streak_diff` | A.win_streak - B.win_streak |
| `ko_ratio_diff` | A.win_ko/total - B.win_ko/total |
| `finish_ratio_diff` | A.(ko+sub)/total - B.(ko+sub)/total |
| `days_rest_diff` | A.days_since_last - B.days_since_last |

### Coefficients logistiques (pré-entraînés sur jansen88 ~30 ans)

Train offline Python → extraire coefficients → JS hardcoded :

```javascript
// À calibrer sur jansen88 dataset
const MMA_COEFS = {
  intercept: 0.0,
  slpm_diff: 0.12,
  str_acc_diff: 0.08,
  str_def_diff: 0.10,
  td_avg_diff: 0.05,
  reach_diff: 0.008,
  age_diff: -0.02,
  finish_ratio_diff: 0.15,
  // ... calibrage réel nécessaire
};

function computeMMAWinProb(featA, featB) {
  const diff = computeDiffs(featA, featB);
  let logit = MMA_COEFS.intercept;
  for (const [k, v] of Object.entries(MMA_COEFS)) {
    if (k !== 'intercept') logit += v * (diff[k] || 0);
  }
  return 1 / (1 + Math.exp(-logit)); // sigmoid → prob A gagne
}
```

Target accuracy : **68-72%** (aligné littérature + mma-ai.net).

### Devig + Kelly

```javascript
// Réutiliser shinHurley() existant server.js
// Kelly cap 25% existant
// computeBetSignal() existant (EV>5% ET IC lower>0)
```

---

## Phase 3 — UI Tab (3-4j)

Pattern visuel : CS2 tab (fight cards groupées par événement).

```
┌─ UFC 305 — Sat Jun 28, 2026 ─────────────────────┐
│  [LIVE] / [UPCOMING]                              │
│                                                   │
│  Jon Jones vs Stipe Miocic                        │
│  Heavyweight · Main Event                         │
│  ┌──────────┬──────────┐                          │
│  │ Jones    │  Miocic  │                          │
│  │  68%     │   32%    │                          │
│  │ AI -175  │  +155    │                          │
│  │ VGS -190 │  +155    │                          │
│  └──────────┴──────────┘                          │
│  EV: +3.2% [BET ✓]                               │
│  [> Détail fighter stats]                         │
└───────────────────────────────────────────────────┘
```

---

## Phase 4 — Odds API + Backtest (1j)

```javascript
// Cron toutes les 12h (UFC events rare)
async function fetchMMAOdds() {
  const url = `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/`
    + `?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;
  // Même pattern que fetchOddsAPI() existant
}
```

Backtest sur jansen88 (9 ans cotes + résultats) → calculer accuracy + ROI headline pour affichage.

---

## Conditions GO (DG)

- [ ] ufcstats.com ToS : scraping page publique acceptable ?
- [ ] jansen88/ufc-data license : vérifier avant ETL (repo = MIT-ish, à confirmer)
- [ ] Quota Odds API : ~45 req/mois MMA sur 500 budget total → acceptable ?
- [ ] DG GO code avant démarrage Phase 1

## Estimation effort

| Phase | Effort |
|---|---|
| P1 Scraper + DB | 3-4j |
| P2 Modèle | 2-3j |
| P3 UI | 3-4j |
| P4 Odds + backtest | 1j |
| **Total** | **9-12j** |

*Spec v1.0 — 2026-06-05. bd `8gz3`.*
