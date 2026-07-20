# Tâche P8 — APIs backend recherche joueur/tournoi

> **Difficulté** : 🔴 HARD (la plus dure du GANTT)
> **Branche** : `refonte-tennis-v2`
> **Durée estimée** : 4-6h
> **Prérequis** : avoir lu ce brief + `CONTEXT-P8-DB-LEGACY.md` + les squelettes fournis

## 🎯 Objectif

Créer **2 routes API** qui alimentent le module de recherche de l'onglet tennis :

1. `GET /api/tennis/search?q=<query>&type=players|tournaments|all`
   Autocomplete unifié joueurs + tournois (pour la barre de recherche)

2. `GET /api/tennis/tournaments?date=<today>`
   Liste des tournois ATP/WTA/ITF du jour (pour le sous-onglet Tournois)

---

## ⚠️ Découverte critique ( investigation effectuée le 2026-07-20 )

### La DB legacy `pariscore.db` est **VIDE** pour le tennis

Les **15 tables tennis** existent mais contiennent **0 lignes** :

| Table | Rôle attendu | Lignes |
|---|---|---|
| `tennis_players_elo` | Joueurs ATP/WTA | **0** |
| `tennis_elo` | Elo par surface | **0** |
| `tennis_matches` | Matchs Sackmann | **0** |
| `tennis_matches_internal` | Matchs BSD | **0** |
| `tennis_enrich_snap` | Snapshot enrichissement | **0** |
| `tennis_sps_weekly` | SPS hebdo | **0** |
| `player_surface_scores` | Score par surface | **0** |

**Tables peuplées (non tennis)** : `api_cache` (90), `kv` (94), `users` (1), `team_logos` (63), `closing_odds` (10).

### Schémas disponibles (pour mémoire future)

**`tennis_players_elo`** (15 tables, 11 colonnes) :
```sql
player_id TEXT PK, player_name TEXT, elo_rating REAL,
matches_played INTEGER, last_match_at INTEGER,
atp_rank INTEGER, wta_rank INTEGER, circuit TEXT,
created_at INTEGER, updated_at INTEGER
```

**`tennis_matches`** (Sackmann-style, 56 colonnes) :
```sql
tour TEXT PK, tourney_id TEXT PK, match_num INTEGER PK,
tourney_name TEXT, surface TEXT, tourney_level TEXT, tourney_date INTEGER,
winner_id INTEGER, winner_name TEXT, winner_ioc TEXT, winner_rank INTEGER,
loser_id INTEGER, loser_name TEXT, loser_ioc TEXT, loser_rank INTEGER,
score TEXT, round TEXT, minutes INTEGER,
w_ace, w_df, w_svpt, w_1stIn, w_1stWon, w_2ndWon, w_SvGms, w_bpSaved, w_bpFaced,
l_ace, l_df, l_svpt, l_1stIn, l_1stWon, l_2ndWon, l_SvGms, l_bpSaved, l_bpFaced,
imported_at INTEGER
```

---

## 🚦 Stratégie recommandée (3 options)

Vu que la DB est vide, tu as **3 approches possibles**. Choisis-en UNE et documente-la dans ton rapport.

### Option A — Fallback BSD direct (recommandé, + rapide)

**Principe** : Ne pas dépendre de la DB legacy. Utiliser BSD directement.

- `/api/tennis/search` : pas faisable via BSD (pas d'endpoint "tous les joueurs").
  → **Fallback** : retourner une liste codée en dur des top 100 ATP+WTA
  (générée depuis `tennis-player-photos.json` qui existe à la racine).
- `/api/tennis/tournaments` : BSD `/api/v2/tournaments/?date=<today>` (endpoint
  probable — vérifier dans `bsd-fetcher.ts`).

**Avantages** : Pas besoin de peupler la DB, fonctionne tout de suite.
**Inconvénients** : Search limitée au top 100 hardcodé.

### Option B — Peupler la DB depuis BSD au démarrage (complexe)

**Principe** : Script de seed qui récupère tous les matchs BSD du mois et
remplit `tennis_matches` + `tennis_players_elo` (déduit des matchs).

**Avantages** : Search complète, données persistantes.
**Inconvénients** : Long à développer, dépend de la couverture BSD.

### Option C — Utiliser l'API officielle ATP/WTA (payante)

Non recommandé (coût + délai).

---

## 📋 Livrables attendus

### 1. `src/app/api/tennis/search/route.ts`

Route `GET /api/tennis/search?q=<query>&type=players|tournaments|all`.

**Comportement** :
- `q` obligatoire, min 2 caractères (sinon retourner `{ players: [], tournaments: [], total: 0 }`)
- `type` optionnel : `players` | `tournaments` | `all` (défaut `all`)
- Cache 60s (les données changent rarement)
- Limit 10 résultats par catégorie

**Réponse** :
```ts
type SearchResponse = {
  players: PlayerResult[];
  tournaments: TournamentResult[];
  total: number;
  query: string;
  type: string;
  source: "hardcoded-top100" | "db" | "bsd" | "empty";
  updatedAt: string;
};

type PlayerResult = {
  id: string;            // slug "jannik_sinner"
  name: string;          // "Jannik Sinner"
  slug: string;
  rank?: number;
  country?: string;      // ISO 2 "IT"
  photoUrl?: string;
  circuit?: "ATP" | "WTA";
};

type TournamentResult = {
  id: string;
  name: string;
  slug: string;
  surface?: string;
  country?: string;
  category?: string;     // "ATP 250", "Grand Slam"...
  startDate?: string;
  endDate?: string;
};
```

### 2. `src/app/api/tennis/tournaments/route.ts`

Route `GET /api/tennis/tournaments?date=<YYYY-MM-DD>` (défaut : aujourd'hui).

**Comportement** :
- `date` optionnelle (défaut `new Date().toISOString().slice(0, 10)`)
- Cache 5 min
- Source : BSD ou fallback (voir Option A)

**Réponse** :
```ts
type TournamentsResponse = {
  tournaments: TournamentResult[];
  source: "bsd" | "fallback" | "empty";
  date: string;
  updatedAt: string;
};
```

### 3. `src/lib/tennis-search-index.ts` (helper pour Option A)

Module qui exporte une **liste codée en dur** des top 100 ATP+WTA, générée
depuis `tennis-player-photos.json` (existant à la racine du projet, 30KB).

```ts
export type SearchPlayerEntry = {
  id: string;
  name: string;
  slug: string;
  rank?: number;
  country?: string;
  photoUrl?: string;
  circuit: "ATP" | "WTA";
};

export const TOP_PLAYERS: SearchPlayerEntry[] = [
  // ... généré depuis tennis-player-photos.json
];

export function searchPlayers(query: string, limit = 10): SearchPlayerEntry[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return TOP_PLAYERS
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, limit);
}
```

### 4. `src/lib/tennis-tournaments-index.ts` (helper tournaments)

Module qui exporte les **tournois ATP/WTA connus** (Grand Slams + Masters +
500 + 250 principaux). Utiliser les données de `docs/STRUCTURE-ONGLET-TENNIS.md`
et le parser TennisTemple pour enrichir.

```ts
export type SearchTournamentEntry = {
  id: string;
  name: string;
  slug: string;
  surface: "Dur" | "Terre" | "Gazon" | "Moquette";
  country: string;
  category: "Grand Slam" | "ATP Masters 1000" | "ATP 500" | "ATP 250" | "WTA 1000" | "WTA 500" | "WTA 250";
  city?: string;
};

export const KNOWN_TOURNAMENTS: SearchTournamentEntry[] = [
  // Liste des ~70 tournois principaux
];

export function searchTournaments(query: string, limit = 10): SearchTournamentEntry[] {
  // ...
}
```

---

## 🛠️ Fichiers pré-requis (déjà créés pour toi)

### Squelettes TypeScript (à compléter)

Les types partagés sont déjà définis dans `docs/P8-SEARCH-TYPES.ts` — copie-les
dans tes routes. Les fichiers suivants sont créés vides avec le bon structure :

- `src/app/api/tennis/search/route.ts` (à créer)
- `src/app/api/tennis/tournaments/route.ts` (à créer)
- `src/lib/tennis-search-index.ts` (à créer)
- `src/lib/tennis-tournaments-index.ts` (à créer)

### Sources de données disponibles (à lire)

- **`tennis-player-photos.json`** (racine, 30KB) : mapping nom joueur → URL photo.
  Source principale pour Option A.
- **`src/lib/bsd-fetcher.ts`** : le fetcher BSD existe déjà, l'étudier pour
  comprendre comment appeler BSD tournaments endpoint.
- **`flags_config.json`** (racine) : mapping pays → drapeau emoji.
- **`src/lib/tennistemple-parser.ts`** : parser déjà créé, peut enrichir
  `KNOWN_TOURNAMENTS` depuis les data scrapped.

### Patterns à respecter (ateliers existants)

- **Cache** : utiliser `createTtlCache` + `isFresh` de `@/lib/cached-route`
  (voir `src/app/api/tennis/prematch/route.ts` ligne 8-12 pour le pattern exact).
- **Erreur** : wrapper avec `apiErrorHandler` (voir autres routes tennis).
- **DB legacy** : `new Database('./pariscore.db', { readonly: true })` via
  `better-sqlite3`. ⚠️ La DB est VIDE — ne pas s'y attendre.
- **Validation** : utiliser `zod` pour valider query params (déjà utilisé dans
  `use-tennis-live-stats.ts`).

---

## ✅ Critères d'acceptation (Definition of Done)

- [ ] `GET /api/tennis/search?q=sin&` retourne au moins Sinner dans players
- [ ] `GET /api/tennis/search?q=roland&` retourne Roland-Garros dans tournaments
- [ ] `GET /api/tennis/search` sans `q` retourne `{ total: 0 }` (pas d'erreur 500)
- [ ] `GET /api/tennis/search?q=x` (1 char) retourne `{ total: 0 }`
- [ ] `GET /api/tennis/tournaments` retourne au moins 1 tournoi (ou `source: "empty"` documenté)
- [ ] Cache TTL respecté (vérifier headers ou behavior)
- [ ] `npx tsc --noEmit` passe sur les nouveaux fichiers
- [ ] `bun run lint` (sur les nouveaux fichiers) ne casse pas
- [ ] Documenter dans le rapport : option choisie (A/B/C), sources réelles
      utilisées, limitations

---

## 🧪 Tests manuels (curl)

```bash
# Search joueur
curl 'http://localhost:3000/api/tennis/search?q=sinner&type=players' | jq

# Search tournoi
curl 'http://localhost:3000/api/tennis/search?q=roland&type=tournaments' | jq

# Search mixte
curl 'http://localhost:3000/api/tennis/search?q=sin' | jq

# Edge cases
curl 'http://localhost:3000/api/tennis/search'                     # → total: 0
curl 'http://localhost:3000/api/tennis/search?q=x'                 # → total: 0
curl 'http://localhost:3000/api/tennis/search?q=sinner&type=invalid'  # → 400 ou fallback

# Tournaments
curl 'http://localhost:3000/api/tennis/tournaments' | jq
curl 'http://localhost:3000/api/tennis/tournaments?date=2026-07-20' | jq
```

---

## 📚 Références

- `src/app/api/tennis/prematch/route.ts` — pattern cache + BSD à suivre
- `src/lib/cached-route.ts` — helper `createTtlCache` + `isFresh`
- `src/lib/bsd-fetcher.ts` — fetcher BSD (voir si endpoint tournaments existe)
- `tennis-player-photos.json` — source top joueurs (Option A)
- `flags_config.json` — mapping pays
- `src/lib/tennistemple-parser.ts` — parser TT (peut enrichir tournaments)
- `docs/STRUCTURE-ONGLET-TENNIS.md` — architecture cible

---

## 📝 Modèle de rapport (à remplir à la fin)

```md
## Rapport P8 — APIs recherche tennis

### Option choisie : [A | B | C]
**Raison** : ...

### Fichiers créés
- src/app/api/tennis/search/route.ts (XX lignes)
- src/app/api/tennis/tournaments/route.ts (XX lignes)
- src/lib/tennis-search-index.ts (XX lignes, XX joueurs)
- src/lib/tennis-tournaments-index.ts (XX lignes, XX tournois)

### Tests curl (résultats réels)
...

### Limitations / TODO
- ...

### Découvertes (DB, BSD, etc.)
- ...

### Validation
- tsc : ✅
- lint : ✅
```
