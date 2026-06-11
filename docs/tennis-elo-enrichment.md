# Enrichissement Elo Surface Tennis — ParisScore

## Résumé

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Scraper Tennis Abstract (interne) | ✅ Terminé |
| Phase 2 | Recalcul Elo local via script standalone | ✅ Terminé |
| Phase 3 | Automatisation cron VPS | ✅ Terminé |

---

## Architecture

### Table `tennis_elo`

```
player_id       INTEGER   — Sackmann player ID
player_name     TEXT
tour            TEXT      — 'ATP' | 'WTA'
surface         TEXT      — 'ALL' | 'Hard' | 'Clay' | 'Grass' | 'Carpet'
elo             REAL      — Rating FiveThirtyEight
matches_count   INTEGER   — Nombre de matchs ayant contribué au rating
last_match_date INTEGER   — YYYYMMDD du dernier match
updated_at      INTEGER   — Timestamp UNIX mise à jour
```

PRIMARY KEY : `(player_id, tour, surface)`

### Table `tennis_elo_drift_weekly`

Créée par le scraper Tennis Abstract. Stocke l'écart entre TA Elo et PS Elo chaque semaine.

```
player_id       INTEGER
player_name     TEXT
tour            TEXT      — 'ATP' | 'WTA'
ta_elo          REAL      — Elo Tennis Abstract
ta_rank         INTEGER
ps_elo          REAL      — Elo ParisScore
elo_drift       REAL      — ta_elo - ps_elo
drift_abs       REAL      — |elo_drift|
captured_at     INTEGER   — Timestamp UNIX
source          TEXT
week_key        TEXT      — Identifiant de semaine (ex: '2026-W24')
```

PRIMARY KEY : `(player_id, tour, week_key)`

### Flux de données

```
Tennis Abstract (tennisabstract.com)
  ↓ scraper (Phase 1)
tennis_elo_drift_weekly  ← QA interne, pas exposé en UI

Sackmann GitHub (tennis_atp, tennis_wta)
  ↓ syncSackmannData()
tennis_matches (table brute)
  ↓ computeTennisElo() / tools/recompute-tennis-elo.js (Phase 2)
tennis_elo  ← utilisé par _tennisLookupEloPair pour les prédictions
```

---

## Phase 1 — Scraper Tennis Abstract

### Script

`tools/scrape-tennis-abstract-elo.js` (existant, ~350 lignes)

### Statut légal

- Tennis Abstract / Jeff Sackmann utilise **CC BY-NC-SA 4.0**
- Incompatible avec SaaS commercial ParisScore (€19/mo)
- Le script est protégé par **3 verrous** (2 env vars + 1 CLI flag)
- Usage autorisé pour **QA interne uniquement**, pas d'exposition dans l'UI/API

### Exécution

```bash
TENNIS_ABSTRACT_ELO_SCRAPER=1 LEGAL_OVERRIDE_CONFIRMED=1 \
node tools/scrape-tennis-abstract-elo.js --enable-legal-bypass-confirmed
```

### Résultats (2026-06-11, semaine W24)

| Métrique | Valeur |
|----------|--------|
| ATP parsés | 520 joueurs |
| WTA parsés | 535 joueurs |
| Total écrit | 1 055 lignes |
| Alarmes (>100 drift top50) | 38 |

### Top 5 dérives constatées

| Joueur | TA Elo | PS Elo | Drift |
|--------|--------|--------|-------|
| Matteo Arnaldi (ATP) | 1840.6 | 1568.6 | +272 |
| Aryna Sabalenka (WTA) | 2229.8 | 2460.0 | -230 |
| Learner Tien (ATP) | 1954.7 | 1739.7 | +215 |
| ... | | | |

### Conclusion Phase 1

Les Elo ParisScore sont globalement cohérents avec Tennis Abstract (±100 points pour la plupart). Les dérives >200 points concernent des joueurs récents (Learner Tien, 20 ans) ou des joueurs avec peu de matchs Sackmann. La dérive Sabalenka (-230) suggère que PS surestime Sabalenka vs TA — probablement dû aux données Sackmann plus complètes sur les tournois ITF que TA n'inclut pas.

---

## Phase 2 — Recalcul Elo Local

### Script créé

`tools/recompute-tennis-elo.js` (standalone, même algorithme que `computeTennisElo()` dans server.js)

### Algorithme (FiveThirtyEight)

- **K adaptatif** : base 250 (ALL) / 200 (surface), pondéré par `(matches+5)^0.4`
- **MoV (Margin of Victory)** : multiplie K par un facteur basé sur le score
- **Régression inactivité** : après 365j, régression linéaire vers 1500 sur 6 ans
- **Seed initial** : basé sur le rang (`1500 + (100 - rank) * 5`)

### Résultats (24995 matchs traités)

| Surface | Ratings |
|---------|---------|
| ALL | 1 568 |
| Hard | 1 228 |
| Clay | 1 050 |
| Grass | 545 |
| **Total** | **4 391** |

Temps d'exécution : ~1.3s

### Usage

```bash
# Recalcul complet + mise à jour DB
node tools/recompute-tennis-elo.js

# Dry-run (ne touche pas la DB)
node tools/recompute-tennis-elo.js --dry-run
```

---

## Phase 3 — Automatisation Cron

### Scripts créés

#### `scripts/cron-tennis-elo.sh`

Script bash exécutable comme cron :

1. Scrape Tennis Abstract (Phase 1) → `tennis_elo_drift_weekly`
2. Recompute Elo local (Phase 2) → `tennis_elo`
3. Log dans `logs/cron-tennis-elo.log`

#### `scripts/update_vps.sh` (modifié)

Ajout du flag `--tennis-elo` pour lancer le recompute après déploiement.

### Scripts npm

```bash
npm run tennis-elo        # Recompute Elo local seulement
npm run tennis-elo:ta     # Scraper Tennis Abstract seulement
npm run tennis-elo:cron   # Les deux (cron complet)
```

### Cron scheduler

```cron
0 6 * * 1 cd /home/deploy/pariscore && bash scripts/cron-tennis-elo.sh
```

(Chaque lundi à 6h du matin)

---

## Recommandations futures

1. **Migration TML-Database (MIT)** : remplacer Sackmann (CC BY-NC-SA) par TML-Database pour être cleaner légalement et couvrir les ITF/Challengers
2. **Dashboard de dérive** : exposer `tennis_elo_drift_weekly` dans l'admin pour visualiser l'évolution des écarts TA vs PS dans le temps
3. **Seuils de confiance** : utiliser `matches_count` pour filtrer les prédictions Elo avec peu de données
4. **Optimisation K surface** : ajuster le K-base surface (200) en fonction de la rareté des matchs sur gazon vs dur

---

## Fichiers modifiés/créés

| Fichier | Statut |
|---------|--------|
| `tools/recompute-tennis-elo.js` | ✨ Créé |
| `scripts/cron-tennis-elo.sh` | ✨ Créé |
| `scripts/update_vps.sh` | 📝 Modifié (flag --tennis-elo) |
| `package.json` | 📝 Modifié (scripts npm) |
| `pariscore.html` | ✅ Déjà fait (option Δ Elo Surface) |
| `pariscore.js` | ✅ Déjà fait (case elo_surf_diff) |
| `server.js` | ✅ Déjà fait (computeTennisElo) |
| `tools/scrape-tennis-abstract-elo.js` | ✅ Existant (débloqué pour Phase 1) |
