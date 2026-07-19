# SPS — Surface PowerScore

## Qu'est-ce que le SPS ?

Le **Surface PowerScore (SPS)** est un indicateur [0-100] de l'aptitude d'un joueur de tennis sur une surface spécifique (Dur, Terre battue, Gazon). Il résume les 12 derniers mois de performance sur cette surface en un score unique.

Contrairement à l'Elo standard (généraliste, tous matchs confondus), le SPS capture les **spécificités de surface** : le jeu de jambes sur terre battue, la puissance au service sur gazon, etc.

---

## Formule de calcul

### 1. Métriques brutes (normalisées [0-100])

8 métriques sont calculées sur une fenêtre glissante de 52 semaines :

| Métrique | Description | Source |
|----------|-------------|--------|
| `elo_recent` | Elo général du joueur, normalisé [1200-2600] → [0-100] | `tennis_players_elo` |
| `sdr` | Surface Dominance Ratio = win_rate_surface / win_rate_global × 100 | `tennis_matches_internal` |
| `return_pts_won` | % points gagnés en retour | `tennis_matches_internal` |
| `second_service_won` | % points gagnés sur 2e service | `tennis_matches_internal` |
| `service_games_won` | % jeux de service gagnés | `tennis_matches_internal` |
| `bp_saved` | % balles de break sauvées | `tennis_matches_internal` |
| `tie_breaks_won` | % tie-breaks gagnés | `tennis_matches_internal` + `tennis_ta_cache` |
| `baseline_efficiency` | Efficacité en échange (proxy fond de court) | `tennis_matches_internal` + `tennis_ta_cache` |

### 2. Scores d'aptitude par surface

Chaque surface a des poids spécifiques qui reflètent l'importance relative de chaque métrique. Les poids diffèrent ATP vs WTA :

**Clay (Terre battue)** — rallies longs, retour dominant

| Métrique | ATP | WTA |
|----------|-----|-----|
| return_pts_won | 0.35 | 0.40 |
| bp_saved | 0.25 | 0.25 |
| second_service_won | 0.25 | 0.20 |
| baseline_efficiency | 0.15 | 0.15 |

**Grass (Gazon)** — service dominant, jeux rapides

| Métrique | ATP | WTA |
|----------|-----|-----|
| service_games_won | 0.40 | 0.35 |
| bp_saved | 0.25 | 0.25 |
| sdr | 0.20 | 0.25 |
| tie_breaks_won | 0.15 | 0.15 |

**Hard (Dur)** — équilibré, généraliste

| Métrique | ATP | WTA |
|----------|-----|-----|
| sdr | 0.35 | 0.40 |
| baseline_efficiency | 0.30 | 0.30 |
| elo_recent | 0.20 | 0.20 |
| service_games_won | 0.15 | 0.10 |

### 3. Formule finale

```
aptitude = SUM(métrique × poids)  // somme pondérée surface-spécifique
SPS_raw  = aptitude × 0.70 + elo_recent × 0.30
SPS      = SPS_raw × penalty_factor  // pénalité si échantillon insuffisant
```

### 4. Pénalité de confiance

- **Seuil** : < 5 matchs sur la surface → confiance réduite
- **Mode binaire** (défaut) : pénalité fixe de **15%** si matchs < 5
- **Mode progressif** : pénalité linéaire (0 match → 15%, 4 matchs → 3%)

---

## Pipeline de calcul

```
┌──────────────────┐     ┌────────────────────┐     ┌─────────────────────┐
│  tennis_matches_ │     │  cron_sps_updater  │     │  player_surface_    │
│  internal (SQLite)│────▶│  .py (Python cron) │────▶│  scores (table SQL) │
│  23197 rows prod │     │  Runs 05:30/17:30  │     │  PK: player+surface │
└──────────────────┘     └────────────────────┘     └─────────┬───────────┘
                                                              │
                     ┌──────────────────┐     ┌───────────────┘
                     │  surface_power-  │     │
                     │  score.py (calc) │     │
                     └──────────────────┘     ▼
                                      ┌──────────────────┐
                                      │  getPlayerStats() │
                                      │  db.ts (Next.js)  │
                                      └────────┬─────────┘
                                               │
                                      ┌────────▼─────────┐
                                      │  /api/tennis/     │
                                      │  player-stats     │
                                      └────────┬─────────┘
                                               │
                     ┌─────────────────────────┘
                     ▼
          ┌─────────────────────┐
          │  usePlayerStats()   │
          │  (SWR hook, React)  │
          └─────────┬───────────┘
                    │
          ┌─────────▼───────────┐
          │  PlayerStatline     │  ← Affiche "SPS 72" sous le nom
          │  MatchCardFooter    │  ← Affiche "SPS 64 vs 72 · #12 vs #8"
          └─────────────────────┘
```

### Sources de données (amont)

| Table | Contenu | Remplie par |
|-------|---------|-------------|
| `tennis_matches_internal` | Matchs ATP/WTA historiques (52 semaines) | ETL interne (BSD/ESPN) |
| `tennis_players_elo` | Elo ratings + classements ATP/WTA | `computeTennisElo()` server.js |
| `tennis_ta_cache` | Métriques Tennis Abstract (tie-breaks, efficacité) | Cron TA scraper |

### Déploiement VPS

Le cron SPS tourne sur le VPS OVH (`ubuntu@51.75.21.239`) :

```bash
crontab -l  # doit contenir :
30 5,17 * * * cd /home/ubuntu/pariscore && /usr/bin/python3 cron_sps_updater.py

# Vérifier les logs :
tail -f /home/ubuntu/pariscore/logs/sps_updater.log

# Test dry-run :
cd /home/ubuntu/pariscore
PARISCORE_SPS_DRY_RUN=1 PARISCORE_LOG_LEVEL=DEBUG /usr/bin/python3 cron_sps_updater.py
```

### Monitoring

```bash
curl -s http://localhost:3000/api/v1/sources/health | jq '.sps_pipeline'
# → { status: "ok", last_run_ts: ..., matches_seen: N, sps_written: N, errors: 0 }
```

---

## Classement SPS (ranking)

Le classement SPS est déterminé **à la volée** côté serveur Next.js, pas stocké en base :

```typescript
// db.ts — getSpsIndex()
const rows = db.prepare(`
  SELECT player_id, sps
  FROM player_surface_scores
  WHERE surface = ? AND sps IS NOT NULL
  GROUP BY player_id
  HAVING MAX(computed_at)
  ORDER BY sps DESC
`).all(surface);

// Rang = position dans l'index trié + 1
const idx = rows.findIndex(r => r.player_id === pid);
spsRank = idx >= 0 ? idx + 1 : null;
```

- **Index trié DESC** → le meilleur SPS = rang #1
- **Cache 30 min** → pas de recalcul à chaque requête
- **Par surface** → un joueur a 3 classements différents (Dur, Terre, Gazon)

---

## Affichage sur les cards tennis

Le SPS apparaît à **3 endroits** sur chaque MatchCard :

| Emplacement | Composant | Affichage |
|-------------|-----------|-----------|
| Sous le nom du joueur | `PlayerStatline` | `SPS 72 ⓘ` (tooltip : rang + confiance) |
| Footer de la card | `MatchCardFooter` | `SPS 64 vs 72` + `#12 vs #8` |
| Stats chips (grille) | `StatsIndicatorsGrid` | Non affiché actuellement |

Toute valeur manquante (joueur inconnu / base absente / cron pas encore exécuté) affiche `—` plutôt qu'une valeur trompeuse.

---

## Dépendances et prérequis

| Prérequis | Statut |
|-----------|--------|
| `tennis_matches_internal` rempli (52 semaines ATP + WTA) | ✅ Production |
| Mapping `player_id ↔ nom` | ✅ Production |
| `tennis_ta_cache` peuplé | ⚠️ Partiel (fallback = heuristique) |
| Cron `cron_sps_updater.py` actif | ✅ Production (05:30 / 17:30) |
| Route `/api/v1/tennis/upcoming` fonctionnelle | ✅ Production |

---

## Fichiers sources

| Fichier | Rôle |
|---------|------|
| `surface_powerscore.py` | Calcul SPS (formule, poids, pénalité) |
| `cron_sps_updater.py` | Pipeline ETL (cron 12h) |
| `src/lib/tennis-stats/sps-utils.ts` | Utilitaires d'affichage (formatage, comparaison) |
| `src/lib/tennis-stats/db.ts` | Lecture SPS + calcul rang depuis SQLite |
| `src/lib/tennis-stats/types.ts` | Types `PlayerStats`, `SPSData`, `Surface` |
| `src/app/api/tennis/player-stats/route.ts` | API endpoint |
| `src/hooks/use-player-stats.ts` | Hook React SWR |
| `src/components/tennis/player-statline.tsx` | Affichage SPS sous nom joueur |
| `src/components/tennis/match-card-footer.tsx` | Affichage SPS duel + rang |
