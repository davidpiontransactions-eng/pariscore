# 🎯 P8 — START HERE

> **Tâche difficile** : APIs backend recherche tennis
> **Branche** : `refonte-tennis-v2`

## 📋 Lectures obligatoires (dans l'ordre)

1. **`docs/P8-TASK-BRIEF.md`** — Brief complet (objectif, options, livrables, DoD)
2. **`docs/P8-CONTEXT-DB-LEGACY.md`** — Investigation DB (vide !) + implications

## 🛠️ Fichiers pré-requis déjà créés (à utiliser tels quels)

| Fichier | Lignes | Contenu | Tu dois... |
|---|---|---|---|
| `src/lib/tennis-search-types.ts` | 88 | Types TS partagés | **Importer**, ne pas modifier |
| `src/lib/tennis-search-index.ts` | ~700 | 93 top joueurs ATP + `searchPlayers()` | **Importer**, ne pas modifier |
| `src/lib/tennis-tournaments-index.ts` | 540 | 62 tournois + `searchTournaments()` | **Importer**, ne pas modifier |

## ✏️ Fichiers à créer (ton travail)

| Fichier | Action |
|---|---|
| `src/app/api/tennis/search/route.ts` | **CRÉER** — Route `GET /api/tennis/search` |
| `src/app/api/tennis/tournaments/route.ts` | **CRÉER** — Route `GET /api/tennis/tournaments` |

## 📚 Patterns à suivre (ateliers existants à lire)

- **`src/app/api/tennis/prematch/route.ts`** — Pattern cache + BSD à copier
- **`src/lib/cached-route.ts`** — Helper `createTtlCache` + `isFresh`
- **`src/lib/api-error-handler.ts`** — Wrapper d'erreur `apiErrorHandler`

## 🎯 Option recommandée : A (fallback hardcodé)

La DB est vide → utilise `TOP_PLAYERS` + `KNOWN_TOURNAMENTS` directement.

```ts
// src/app/api/tennis/search/route.ts (squelette)
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { searchPlayers } from "@/lib/tennis-search-index";
import { searchTournaments } from "@/lib/tennis-tournaments-index";
import { SEARCH_TYPES, type SearchResponse, type SearchType } from "@/lib/tennis-search-types";

const CACHE_TTL_MS = 60_000; // 1 min
const cache = createTtlCache<SearchResponse>("__tennisSearchCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const typeParam = searchParams.get("type") ?? "all";
    const type: SearchType = (SEARCH_TYPES as readonly string[]).includes(typeParam)
      ? (typeParam as SearchType)
      : "all";

    // Validation : q trop court → réponse vide (pas erreur)
    if (q.length < 2) {
      return NextResponse.json<SearchResponse>({
        players: [],
        tournaments: [],
        total: 0,
        query: q,
        type,
        source: "empty",
        updatedAt: new Date().toISOString(),
      });
    }

    // Cache key dépend de q+type
    const cacheKey = `${q.toLowerCase()}:${type}`;
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data?.query === q) {
      return NextResponse.json(cached.data);
    }

    const players = type === "tournaments" ? [] : searchPlayers(q, 10);
    const tournaments = type === "players" ? [] : searchTournaments(q, 10);
    const response: SearchResponse = {
      players,
      tournaments,
      total: players.length + tournaments.length,
      query: q,
      type,
      source: "hardcoded-top100",
      updatedAt: new Date().toISOString(),
    };

    cache.set(response);
    return NextResponse.json(response);
  } catch (err) {
    return apiErrorHandler(err, "tennis/search");
  }
}
```

Pour `/api/tennis/tournaments`, suivre le même pattern en retournant
`KNOWN_TOURNAMENTS` filtré par date (ou tout si pas de date).

## 🧪 Tests à passer (curl)

```bash
# Search joueur
curl 'http://localhost:3000/api/tennis/search?q=sinner' | jq '.players[0].name'
# → "Jannik Sinner"

# Search tournoi
curl 'http://localhost:3000/api/tennis/search?q=roland&type=tournaments' | jq '.tournaments[0].name'
# → "Roland-Garros"

# Edge cases
curl 'http://localhost:3000/api/tennis/search' | jq '.total'        # → 0
curl 'http://localhost:3000/api/tennis/search?q=x' | jq '.total'    # → 0

# Tournaments
curl 'http://localhost:3000/api/tennis/tournaments' | jq '.tournaments | length'
# → 62
```

## ✅ Definition of Done (cf. brief)

- [ ] 2 routes créées et fonctionnelles
- [ ] `tsc --noEmit` propre sur nouveaux fichiers
- [ ] Tests curl ci-dessus passent
- [ ] Rapport rempli (option choisie, sources, limitations)

## 📂 Résumé des fichiers P8

```
docs/
├── P8-START-HERE.md              ← CE FICHIER (point d'entrée)
├── P8-TASK-BRIEF.md              ← Brief complet (à lire 1er)
└── P8-CONTEXT-DB-LEGACY.md       ← Investigation DB (à lire 2e)

src/lib/
├── tennis-search-types.ts        ← Types (pré-créés, ne pas modifier)
├── tennis-search-index.ts        ← 93 joueurs + searchPlayers (pré-créé)
└── tennis-tournaments-index.ts   ← 62 tournois + searchTournaments (pré-créé)

src/app/api/tennis/
├── search/route.ts               ← À CRÉER (route recherche)
└── tournaments/route.ts          ← À CRÉER (route tournois du jour)
```

**Temps estimé** : 2-3h avec les pré-requis déjà faits (vs 4-6h sans).
