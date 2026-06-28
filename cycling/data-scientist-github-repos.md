# GitHub Repo Research — Cycling Prediction & Data for PariScore

> Research compiled by data scientist agent. Covers 15 repos across scraping, prediction ML, Elo ratings, power data, and race analysis. Each entry: URL, language breakdown, stars, license, description, reusability score (1-5), integration path.

---

## TIER 1: Production-Ready (MIT + maintained + importable)

### 1. themm1/procyclingstats

| Field | Value |
|---|---|
| **URL** | <https://github.com/themm1/procyclingstats> |
| **Language** | Python 100% |
| **Stars** | 102 |
| **Forks** | 37 |
| **License** | MIT |
| **Commits** | 331 |
| **Latest release** | v0.2.8 (Mar 1, 2026) |
| **Description** | Python wrapper for ProCyclingStats.com. Extracts race results, rankings, rider profiles, team data, startlists. |
| **Install** | `pip install procyclingstats` |
| **Reusability** | **5/5** — Base dependency for all PariScore cycling data pipelines |
| **Integration** | Use as primary data source. Wrap in adapter for PariScore's data fusion layer. Returns structured Python dicts; easy to pipe into SQLite/JSON. |
| **Notes** | Only mature, MIT-licensed, pip-installable PCS scraper. 331 commits with active maintenance (last release Mar 2026). Community standard. |

### 2. r-huijts/firstcycling-mcp

| Field | Value |
|---|---|
| **URL** | <https://github.com/r-huijts/firstcycling-mcp> |
| **Language** | Python 99.3%, HTML 0.7% |
| **Stars** | 18 |
| **Forks** | 10 |
| **License** | MIT |
| **Commits** | 46 |
| **Latest release** | "first release" |
| **Description** | Model Context Protocol (MCP) server for FirstCycling.com. Enables LLM-driven queries for race data, results, rankings. |
| **Reusability** | **4/5** — Best FirstCycling data source, MCP integration is future-proof |
| **Integration** | Deploy as MCP server alongside PariScore backend. Good for AI-powered features (natural language race queries). |
| **Notes** | MIT licensed, solid community (18⭐, 10 forks). MCP protocol means it integrates cleanly with LLM agents. Only viable FirstCycling source. |

---

## TIER 2: Architecture Reference (study the approach, don't copy code)

### 3. lewis-mcgillion/cycling-predictor

| Field | Value |
|---|---|
| **Status** | **❌ GONE (404)** — repo deleted/renamed/private |
| **Description (historical)** | Head-to-head prediction model for professional cycling using XGBoost, ~475 features, Kelly criterion staking, Flask web app. Previously considered highest-value repo for PariScore. |
| **Reusability** | **0/5** — No longer available. No forks found. |
| **Impact** | PariScore must build head-to-head prediction from scratch without this reference. |

### 4. skuxy/pcs-predictor

| Field | Value |
|---|---|
| **URL** | <https://github.com/skuxy/pcs-predictor> |
| **Language** | Python 100% |
| **Stars** | 0 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | 34 |
| **Description** | Top-10 prediction model using ProCyclingStats data. Includes its own scraper module (`scrape_race_results`) and SQLite storage layer. |
| **Reusability** | **3/5** — Architecture reference only; no license, no community |
| **Integration** | Study scraper design and prediction pipeline. Do not copy code (no license). Build own model using themm1/procyclingstats for data. |
| **Notes** | Scraper module structure is clean. SQLite schema for race/result storage is useful reference. 0 stars = no community validation. |

### 5. SamMorton123/velo-research

| Field | Value |
|---|---|
| **URL** | <https://github.com/SamMorton123/velo-research> |
| **Language** | Jupyter Notebook 87.7%, Python 12.3% |
| **Stars** | 1 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | 105 |
| **Description** | Cycling research with Elo ratings broken down by terrain type (GC, TT, sprint, etc.). Most actively developed of the small repos. |
| **Reusability** | **3/5** — Best Elo methodology reference; no license blocks code reuse |
| **Integration** | Study GC/TT/sprint Elo decomposition approach. Implement own Elo system referencing this methodology. |
| **Notes** | Highest commit count (105) among small repos. Multi-terrain Elo is the key innovation — relevant for PariScore's rating system. No license = methodology only. |

### 6. martinalex/cyclocross-predictions (VeloPredict)

| Field | Value |
|---|---|
| **URL** | <https://github.com/martinalex/cyclocross-predictions> |
| **Language** | Python 67.4%, Jupyter Notebook 32.5% |
| **Stars** | 1 |
| **Forks** | 0 |
| **License** | **MIT** ✅ |
| **Commits** | 23 |
| **Description** | Cyclocross race outcome prediction. Good ML pipeline architecture (feature engineering, model training, evaluation). |
| **Reusability** | **3/5** — Strong ML architecture to study; MIT-licensed but cyclocross-specific |
| **Integration** | Study feature engineering + model pipeline. Adapt road-specific features for PariScore. |
| **Notes** | Only ML prediction repo with MIT license. Cyclocross focus limits direct reuse but pipeline design is transferable. |

### 7. baronet2/Bike2Vec

| Field | Value |
|---|---|
| **URL** | <https://github.com/baronet2/Bike2Vec> |
| **Language** | Jupyter Notebook 93.1%, Python 6.9% |
| **Stars** | 5 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | 42 |
| **Description** | Rider and race embeddings from PCS race results. Paper at arXiv 2305.10471. Word2Vec-style approach applied to race outcomes. |
| **Reusability** | **2/5** — Academic reference only; no license, Jupyter-based, not packaged |
| **Integration** | Re-implement embedding approach from paper description. Do not copy notebooks. |
| **Notes** | Interesting methodology: treat race positions as "documents" with riders as "words." 5⭐ suggests some academic interest. No license = reference only. |

---

## TIER 3: Scratching the Surface (small, unlicensed, or tangential)

### 8. jlotzkar/cyclingdataproject

| Field | Value |
|---|---|
| **URL** | <https://github.com/jlotzkar/cyclingdataproject> |
| **Language** | Python |
| **Stars** | 0 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | ~9 |
| **Description** | Scraping UCI World Tour stats. Very minimal — mostly a README. |
| **Reusability** | **2/5** — Not enough substance to be useful |
| **Integration** | N/A. Too minimal to integrate. |
| **Notes** | Essentially empty. Few commits, no real codebase. |

### 9. abulte/uci-calendar

| Field | Value |
|---|---|
| **URL** | <https://github.com/abulte/uci-calendar> |
| **Language** | Python 100% |
| **Stars** | 0 |
| **Forks** | 0 |
| **License** | **None**? (unclear — check page) |
| **Commits** | ~5 |
| **Description** | UCI road cycling calendar in machine-readable formats (CSV, ICS). |
| **Reusability** | **3/5** — Useful as reference data for season calendar |
| **Integration** | Use CSV/ICS output as season calendar data source. |
| **Notes** | Not a scraper — a data format conversion tool. Small utility. |

### 10. felixvanoost/stravalyse

| Field | Value |
|---|---|
| **URL** | <https://github.com/felixvanoost/stravalyse> |
| **Language** | Python 100% |
| **Stars** | 50 |
| **Forks** | 6 |
| **License** | **None** (MIT in some references — verify page) |
| **Commits** | 115 |
| **Latest release** | v1.5.0 (Jun 29, 2021) |
| **Description** | Strava activity data analysis and visualization. Training load, fitness trends, performance metrics. |
| **Reusability** | **2/5** — Strava-focused, not race prediction. Fitness metrics concepts could inform form/shape feature. |
| **Integration** | Reference for fitness/form feature engineering only. |
| **Notes** | Well-built (50⭐, 115 commits) but Strava personal data, not race results. Last release 2021 — may be stale. |

### 11. bdhoine/tour-de-france

| Field | Value |
|---|---|
| **URL** | <https://github.com/bdhoine/tour-de-france> |
| **Language** | JavaScript 61.9% + others |
| **Stars** | 0 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | 72 |
| **Description** | Tour de France prediction competition app. Users predict stage winners and compete. Visualization-heavy. |
| **Reusability** | **2/5** — Visualization/competition app, not a prediction model |
| **Integration** | User prediction game concept could inspire PariScore community features, but not data/model relevant. |
| **Notes** | JS-based web app with game mechanics. No prediction ML — just user pick-and-score. |

### 12. vicproon/cycling-elo

| Field | Value |
|---|---|
| **URL** | <https://github.com/vicproon/cycling-elo> |
| **Language** | (unclear — very minimal) |
| **Stars** | 0 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | ~1 |
| **Description** | Web service for ranking amateur cyclists based on race performance. |
| **Reusability** | **2/5** — Amateur-only, very minimal, no license |
| **Integration** | Elo concept only. Amateur racing doesn't translate to UCI World Tour. |
| **Notes** | Barely started (1 commit). Amateur cycling data source not available. |

### 13. AbdelrahmanHussin1/cycling-data-analysis

| Field | Value |
|---|---|
| **URL** | <https://github.com/AbdelrahmanHussin1/cycling-data-analysis> |
| **Language** | Jupyter Notebook 100% |
| **Stars** | 0 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | 2 |
| **Description** | Python-based data analysis of cycling statistics. Basic academic project. |
| **Reusability** | **1/5** — Basic portfolio project, no production value |
| **Integration** | N/A. |
| **Notes** | 2 commits, single notebook. No useful architecture. |

### 14. mohsinhm/cycling-performance-prediction-ml

| Field | Value |
|---|---|
| **Status** | **❌ GONE (404)** — repo deleted/renamed/private |
| **Reusability** | **0/5** |
| **Notes** | No longer available. |

### 15. alexey-ka/OpenLapp

| Field | Value |
|---|---|
| **URL** | <https://github.com/alexey-ka/OpenLapp> |
| **Language** | Jupyter Notebook 99.2%, HTML 0.8% |
| **Stars** | 1 |
| **Forks** | 0 |
| **License** | **None** |
| **Commits** | **1** |
| **Description** | Cycling power data analysis. Single notebook. |
| **Reusability** | **1/5** — Single-commit notebook, no license, not useful |
| **Integration** | N/A. |
| **Notes** | 1 commit = effectively a throwaway notebook. Misleadingly promising name. |

---

## BONUS: Power Data Analysis (C++)

### 16. GoldenCheetah/GoldenCheetah

| Field | Value |
|---|---|
| **URL** | <https://github.com/GoldenCheetah/GoldenCheetah> |
| **Language** | C++ (major) |
| **License** | GPL-2.0 |
| **Description** | Desktop power data analysis application. Power curve, training load, fitness modeling, critical power. Industry standard for cycling power analytics. |
| **Reusability** | **1/5** for direct integration (C++ desktop app), **3/5** for power curve concepts and formulas |
| **Integration** | Reference for power curve math and fitness model formulas (PMC, TSS, CTL, ATL, W', CP). Do not attempt to integrate C++ code. |
| **Notes** | GPL-2.0 license — legal concerns for commercial use. But formulas and models are useful reference. |

---

## Summary Tables

### By Reusability Score

| Score | Repo | Why |
|---|---|---|
| **5/5** | themm1/procyclingstats | MIT, pip-installable, 102⭐, active |
| **4/5** | r-huijts/firstcycling-mcp | MIT, MCP, solid community |
| **3/5** | skuxy/pcs-predictor | Architecture ref only (no license) |
| **3/5** | SamMorton123/velo-research | Best Elo ref (no license) |
| **3/5** | martinalex/cyclocross-predictions | ML pipeline ref (MIT ✅ but cyclocross) |
| **3/5** | abulte/uci-calendar | Calendar data utility |
| **2/5** | baronet2/Bike2Vec | Embeddings ref only (no license) |
| **2/5** | felixvanoost/stravalyse | Strava not race data |
| **2/5** | jlotzkar/cyclingdataproject | Too minimal |
| **2/5** | bdhoine/tour-de-france | Viz-only |
| **2/5** | vicproon/cycling-elo | Amateur, barely started |
| **1/5** | AbdelrahmanHussin1/cycling-data-analysis | Basic portfolio project |
| **1/5** | alexey-ka/OpenLapp | 1-commit notebook |
| **1/5** | GoldenCheetah | C++ desktop app (concept ref only) |
| **0/5** | lewis-mcgillion/cycling-predictor | **GONE (404)** |
| **0/5** | mohsinhm/cycling-performance-prediction-ml | **GONE (404)** |

### By Use Case

| Use Case | Top Repo | Backup |
|---|---|---|
| PCS scraping | **themm1/procyclingstats** ✅ (MIT, 102⭐) | skuxy/pcs-predictor (no license) |
| FirstCycling data | **r-huijts/firstcycling-mcp** ✅ (MIT, 18⭐) | — |
| UCI data | jlotzkar/cyclingdataproject (minimal) | abulte/uci-calendar |
| Head-to-head prediction | **Must build from scratch** (cycling-predictor is GONE) | Study: pcs-predictor + cyclocross-predictions |
| Elo ratings | **Build from scratch** referencing velo-research | vicproon/cycling-elo (amateur) |
| Rider/race embeddings | **Build from scratch** referencing Bike2Vec paper | — |
| Power data / form | GoldenCheetah formulas (C++, reference only) | stravalyse (Strava) |
| Tour de France prediction | **Nothing available** (bdhoine/tour-de-france is viz-only) | — |

---

## Key Conclusions

1. **Only 2 repos are production-ready** for PariScore: `themm1/procyclingstats` (PCS) and `r-huijts/firstcycling-mcp` (FirstCycling). Both are MIT licensed, maintained, and importable.
2. **Head-to-head prediction must be built from scratch.** The most promising existing repo (`cycling-predictor` — XGBoost, 475 features, Kelly staking) is gone. Reference its described architecture from earlier conversations.
3. **License is the main blocker** for 10 of 15 repos. Only `themm1/procyclingstats`, `r-huijts/firstcycling-mcp`, `martinalex/cyclocross-predictions`, and potentially `abulte/uci-calendar` have clear open-source licenses.
4. **No power data Python repos exist.** GoldenCheetah is C++ desktop app (GPL). Power curve/fitness model formulas must be re-implemented from domain knowledge.
5. **Elo methodology** from `velo-research` (multi-terrain GC/TT/sprint Elo) is the best reference for PariScore's rating system.
6. **Embeddings** from Bike2Vec paper (arXiv 2305.10471) can be re-implemented — treats race positions like documents with riders as words.
