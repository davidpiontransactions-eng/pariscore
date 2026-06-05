# bd ParisScorebis-h6a — Tennis Abstract Elo Weekly Drift Check

> **Statut** : SCAFFOLD livré · **EXECUTION BLOQUEE legal** · attente DG GO bd `8uoc` Q1
> **Type** : P3 research — quality assurance interne, pas un produit user-facing
> **Auteur** : CTO/Lead Data Scientist (PariScore v12.65)
> **Date** : 2026-05-22

---

## 1. Objectif

Vérifier hebdomadairement la dérive (`drift`) entre l'Elo interne PariScore (table `tennis_elo`) et l'Elo de référence publié par Tennis Abstract (Jeff Sackmann). Le but est **diagnostique uniquement** : détecter quand notre modèle Elo dérive significativement (>100 points sur top-50) afin de déclencher un recalibrage manuel — pas de remplacer notre Elo par celui de Tennis Abstract.

Cas d'usage interne :
- Smoke test calibration : top-50 ATP/WTA, drift médian attendu < 50 points.
- Alarme si > 5 % des top-50 dérivent > 100 points → audit pipeline Elo interne.
- Sanity check post-merge `_initTennisEloSchema` (cf bd 4cog Tennis Consolidation P0).

---

## 2. Statut légal — **BLOCKED**

| Source | Licence | Compatible SaaS commercial |
|---|---|---|
| Tennis Abstract `/reports/atp_elo_ratings.html` | CC BY-NC-SA 4.0 (impliquée via Sackmann dataset upstream) | ❌ NonCommercial |
| Jeff Sackmann `tennis_atp` / `tennis_wta` GitHub | CC BY-NC-SA 4.0 | ❌ NonCommercial |
| Kaggle `guillemservera/tennis` (mirror Sackmann) | dérivé CC BY-NC-SA | ❌ NonCommercial |

PariScore = SaaS €19/mois Pro → l'usage de cette donnée, **même pour QA interne**, exige une décision DG documentée. Voir bd `8uoc` Q1 (Sackmann purge + substitution TML-Database MIT).

**En attendant la décision DG, le scaffold est désactivé par triple gate :**

1. `TENNIS_ABSTRACT_ELO_SCRAPER=1` (env)
2. `LEGAL_OVERRIDE_CONFIRMED=1` (env)
3. `--enable-legal-bypass-confirmed` (CLI flag)

L'absence d'un seul → exit 2 + bannière legal notice. Même activé, l'output reste **internal QA only** : interdit en UI/API jusqu'à decision écrite DG.

---

## 3. Architecture

### 3.1 Composants livrés

| Composant | Locus | Rôle |
|---|---|---|
| Scraper standalone | `tools/scrape-tennis-abstract-elo.js` | Fetch HTML + parse `<table id="reportable">` + INSERT OR REPLACE `tennis_elo_drift_weekly` |
| Boot notice | `server.js` (`bootInit()` après "Système prêt") | Log status DISABLED par défaut, WARN si env override actif |
| Spec doc | `.context/h6a-tennis-elo-spec.md` | Ce fichier |

### 3.2 Schéma SQLite cible

```sql
CREATE TABLE IF NOT EXISTS tennis_elo_drift_weekly (
  player_id    TEXT NOT NULL,         -- slug "JannikSinner" (Tennis Abstract URL)
  player_name  TEXT,                  -- "Jannik Sinner"
  tour         TEXT NOT NULL,         -- 'ATP' | 'WTA'
  ta_elo       REAL,                  -- Elo Tennis Abstract (overall, colonne 4)
  ta_rank      INTEGER,               -- rang TA report
  ps_elo       REAL,                  -- Elo PariScore (tennis_elo, surface='ALL')
  elo_drift    REAL,                  -- ta_elo - ps_elo (>0 = TA plus haut)
  drift_abs    REAL,                  -- |drift|
  captured_at  INTEGER NOT NULL,      -- unix seconds
  source       TEXT DEFAULT 'tennis_abstract',
  week_key     TEXT NOT NULL,         -- ISO week, "2026-W21"
  PRIMARY KEY (player_id, tour, week_key)
);
CREATE INDEX idx_drift_week ON tennis_elo_drift_weekly(week_key, tour);
CREATE INDEX idx_drift_abs  ON tennis_elo_drift_weekly(drift_abs DESC);
```

Idempotent : ré-exécution même semaine ne crée pas de doublons (PK `(player_id, tour, week_key)`).

### 3.3 Cron (DG GO requis)

Activation prévue (non câblée tant que legal pending) :

```
Cron: weekly Sunday 04:00 UTC
Cmd:  TENNIS_ABSTRACT_ELO_SCRAPER=1 LEGAL_OVERRIDE_CONFIRMED=1 \
      node /home/ubuntu/pariscore/tools/scrape-tennis-abstract-elo.js \
        --enable-legal-bypass-confirmed --tour=both
```

Volumétrie attendue : ~200 lignes/semaine (top 100 ATP + top 100 WTA), <50 ko HTML × 2 = négligeable. Pas de rate limiting nécessaire (1 hit/endpoint/semaine).

### 3.4 Parser

Le report Tennis Abstract utilise `<table id="reportable" class="tablesorter">` avec schéma :

| Col | Rank | Player | Age | Elo | hElo | cElo | gElo | Peak | PeakDate |
|---|---|---|---|---|---|---|---|---|---|

Le scaffold capture **uniquement** `rank`, `player`, `elo` (col 4) — pas les variantes surface (`hElo`/`cElo`/`gElo`) car notre table `tennis_elo` interne stocke par surface séparément (`surface IN ('ALL','Hard','Clay','Grass','Carpet')`).

Robustesse :
- Fallback `<table>` si `id="reportable"` change.
- Skip ligne si `rank` non-numérique (header row) ou `elo` non-numérique.
- Decode `&nbsp;`/`&amp;`/`&#39;` minimal.

### 3.5 Alarmes

Acceptance criteria bd h6a : "alarm if drift > 100 points on top 50 players".

Implémentation : pour chaque ligne où `ta_rank <= 50` ET `drift_abs > 100`, log `[h6a][ALARM]` console (visible via `pm2 logs pariscore`). Exposition admin.html future (Phase 2, post-DG GO).

---

## 4. Plan B — Substitution TML-Database (MIT)

**Recommandation forte** si DG NO-GO sur Tennis Abstract :

| Source | Licence | Couverture Elo |
|---|---|---|
| **Tennismylife / TML-Database** | MIT | ATP+WTA matches historiques (CSV) — Elo dérivable côté serveur via notre pipeline interne (`computeTennisEloFromMatches()` à scaffold) |

Path migration :
1. DG GO purge `tennis_matches` rows where `_source = 'sackmann_csv'` (bd 8uoc Q2).
2. ETL one-shot `tools/import-tml-database.js` (scaffold à créer, pattern `tools/import-flashscore-standings.js`) → repopule `tennis_matches` MIT.
3. Recalcule `tennis_elo` from scratch via fonction existante.
4. Drop scaffold Tennis Abstract scraper (ce fichier).
5. Effort estimé : 6-8h dev + 30 min recompute Elo (~20k matchs).

Avantage : un seul fournisseur de vérité, licence MIT clean, drift check Tennis Abstract devient inutile (nos Elo = nos données).

---

## 5. Plan C — Aucune source externe (status quo)

Si DG NO-GO sur Tennis Abstract ET TML-Database :
- Garder le scaffold `tools/scrape-tennis-abstract-elo.js` dans le repo en mode désactivé.
- Pas de drift check externe → calibration Elo basée uniquement sur backtest interne (Brier score vs cotes historiques BSD/Odds API).
- Ouvrir bd P3 follow-up : "Internal Elo calibration via Brier score sweep" (déjà couvert partiellement par bd `e3mr`).

---

## 6. Test plan post-DG GO

| # | Test | Critère |
|---|---|---|
| T1 | Gate refuses sans flags | Exit 2 + bannière legal notice |
| T2 | Schema créé idempotent | Re-run = no duplicate index error |
| T3 | Parse ATP report | ≥ 100 lignes, `ta_rank=1` = numéro 1 mondial du moment |
| T4 | Parse WTA report | ≥ 100 lignes |
| T5 | Drift computation | Sample 10 joueurs top-20 : `|drift| < 200` (sanity, modèle non aberrant) |
| T6 | Alarmes top-50 | Si `>5%` lignes top-50 dérivent `>100` → flag global review pipeline |
| T7 | Idempotence weekly | Même week_key : re-run écrase, pas de doublons |

---

## 7. Roadmap

| Phase | Tâche | Trigger |
|---|---|---|
| **0 (livré)** | Scaffold + spec doc + boot notice | bd h6a |
| **1** | DG decision Q1 bd 8uoc (Sackmann purge GO/NO-GO) | DG |
| **2a** (si Plan A — Tennis Abstract autorisé) | Activate env flags + cron weekly | DG GO documenté |
| **2b** (si Plan B — TML substitution) | ETL TML-Database + recompute `tennis_elo` + drop scaffold | DG GO |
| **3** | Surface drift alarms dans `admin.html` | Phase 2 done |

---

## 8. Références

- bd `h6a` (ce ticket, P3 OPEN — legal blocker)
- bd `8uoc` Q1 (DG decision Sackmann purge — HIGH legal urgency)
- bd `4cog` (Tennis Consolidation LOT P0 — `tennis_elo` schema source)
- bd `e3mr` (Backtest Brier — alternative calibration path)
- `.context/proposal-tennisabstract-extend-scrape.md` (analyse 30+ reports TA)
- `server.js:18537` (`_initTennisEloSchema` — table source comparée)
- `tools/scrape-tennis-abstract-elo.js` (scaffold livré)

---

*Document spec — bd h6a — 2026-05-22 — v12.65. À mettre à jour post-decision DG.*
