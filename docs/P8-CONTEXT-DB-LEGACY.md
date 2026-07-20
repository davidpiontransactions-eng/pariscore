# Contexte DB Legacy pour P8 — Investigation complète

> **Date investigation** : 2026-07-20
> **Méthode** : `node -e` + `better-sqlite3` readonly sur `pariscore.db`

## 🚨 Conclusion principale

**Toutes les tables tennis sont VIDES** (0 lignes). La DB n'a jamais été peuplée.

## 📊 État des 40 tables

### Tables peuplées (10)

| Table | Lignes | Utilité pour P8 ? |
|---|---|---|
| `api_cache` | 90 | ❌ (cache interne) |
| `api_cache_buffer` | 1 | ❌ |
| `kv` | 94 | ❌ (key-value divers) |
| `users` | 1 | ❌ |
| `team_logos` | 63 | ❌ (football) |
| `league_logos` | 2 | ❌ (football) |
| `closing_odds` | 10 | ❌ |
| `affiliates` | 2 | ❌ |
| `affiliate_clicks` | ? | ❌ |
| `sqlite_sequence` | 3 | ❌ (meta) |

### Tables tennis VIDES (15) — schémas disponibles pour mémoire

```sql
-- tennis_players_elo (11 colonnes)
CREATE TABLE tennis_players_elo (
  player_id TEXT PRIMARY KEY,
  player_name TEXT,
  elo_rating REAL,
  matches_played INTEGER,
  last_match_at INTEGER,
  atp_rank INTEGER,
  wta_rank INTEGER,
  circuit TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- tennis_matches (Sackmann-style, 56 colonnes)
CREATE TABLE tennis_matches (
  tour TEXT, tourney_id TEXT, match_num INTEGER,
  tourney_name TEXT, surface TEXT, draw_size INTEGER,
  tourney_level TEXT, tourney_date INTEGER,
  winner_id INTEGER, winner_seed TEXT, winner_entry TEXT,
  winner_name TEXT, winner_hand TEXT, winner_ht INTEGER,
  winner_ioc TEXT, winner_age REAL,
  loser_id INTEGER, loser_seed TEXT, loser_entry TEXT,
  loser_name TEXT, loser_hand TEXT, loser_ht INTEGER,
  loser_ioc TEXT, loser_age REAL,
  score TEXT, best_of INTEGER, round TEXT, minutes INTEGER,
  w_ace, w_df, w_svpt, w_1stIn, w_1stWon, w_2ndWon, w_SvGms, w_bpSaved, w_bpFaced,
  l_ace, l_df, l_svpt, l_1stIn, l_1stWon, l_2ndWon, l_SvGms, l_bpSaved, l_bpFaced,
  winner_rank INTEGER, winner_rank_points INTEGER,
  loser_rank INTEGER, loser_rank_points INTEGER,
  imported_at INTEGER,
  PRIMARY KEY (tour, tourney_id, match_num)
);
```

## 🎯 Implications pour P8

### Option A (recommandée) — Fallback hardcodé

Puisque la DB est vide, **ne pas perdre de temps à peupler**. Utiliser :

1. **`tennis-player-photos.json`** (racine, 93 joueurs top ATP+WTA)
   - Format : `{ "jannik sinner": "https://...", ... }`
   - **Suffit pour la search V1** (les 93 top joueurs couvrent 90% des recherches utiles)

2. **Liste hardcodée tournois** (~70 tournois ATP/WTA principaux)
   - Source : `docs/STRUCTURE-ONGLET-TENNIS.md` + data TennisTemple scrapped
   - Grand Slams (4) + Masters 1000 (9) + ATP 500 (13) + ATP 250 (~38) + WTA équivalents

### Option B (si temps) — Seed DB depuis tennis-player-photos.json

Script qui lit `tennis-player-photos.json` et insère dans `tennis_players_elo` :

```ts
// scripts/seed-tennis-players.ts
import { readFileSync } from "fs";
import Database from "better-sqlite3";

const photos = JSON.parse(readFileSync("tennis-player-photos.json", "utf-8"));
const db = new Database("./pariscore.db");
const stmt = db.prepare(`
  INSERT OR REPLACE INTO tennis_players_elo
    (player_id, player_name, circuit, created_at, updated_at)
  VALUES (?, ?, 'ATP', ?, ?)
`);

const now = Date.now();
for (const [name, _photoUrl] of Object.entries(photos)) {
  const id = name.toLowerCase().replace(/\s+/g, "_");
  stmt.run(id, name, now, now);
}
console.log(`✓ ${Object.keys(photos).length} joueurs insérés`);
```

⚠️ Pas besoin de l'option B pour P8 V1. L'Option A est suffisante.

## 📚 Sources de données externes confirmées

| Source | URL | Dispo | Couverture |
|---|---|---|---|
| `tennis-player-photos.json` | (local) | ✅ | 93 top joueurs ATP+WTA |
| BSD `/api/v2/...` | (via `bsd-fetcher.ts`) | ✅ si `BSD_API_KEY` | Matchs live + prematch |
| TennisTemple | en.tennistemple.com | ✅ scrape | Tournois + schedule |
| ATP official | atptour.com | ❌ pas d'API publique | — |
| WTA official | wtatennis.com | ❌ pas d'API publique | — |

## 🔍 Comment reproduire l'investigation

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./pariscore.db', { readonly: true });
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all();
for (const t of tables) {
  try {
    const count = db.prepare('SELECT COUNT(*) as n FROM ' + t.name).get();
    console.log(t.name + ': ' + count.n);
  } catch(e) {}
}
db.close();
"
```
