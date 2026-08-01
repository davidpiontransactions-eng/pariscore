# Global League Dashboard — Spec Technique

> **Version**: 1.0.0 | **Date**: 2026-01-08 | **Statut**: Draft  
> **Cible**: Généralisation du dashboard statistique avancé à TOUS les championnats (football + NBA/basket + futures)  
> **Route canonique**: `/league/:league_id/stats`

---

## 1. Architecture UX

### 1.1 Routing

```
/league/[league_id]/stats
  └── page.tsx          → LeagueStatsPage (SSR shell + client hydratation)
  └── loading.tsx        → Squelette shimmer (tableau + widgets)
  └── error.tsx          → Error boundary spécifique league
```

**Navigation**: Depuis `FootballLeagueBar` (ou équivalent NBA/basket), au clic sur une ligue → `router.push(\`/league/${league.id}/stats\`)` au lieu du filtre local actuel.

### 1.2 Layout de la page

```
┌─────────────────────────────────────────────────────┐
│  [← Retour]  Ligue 1 · Saison 2025/2026            │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  [Tous] [À domicile] [En déplacement]       │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─── Tableau Général ──────────────────────────┐   │
│  │ #  Équipe       Pts PPG  xG   xGA  xGD  ... │   │
│  │ 1  PSG          45  2.2  1.8  0.6  +1.2 ... │   │
│  │ 2  Marseille    38  1.9  1.5  0.8  +0.7 ... │   │
│  │ ...                                         │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─── Tops Équipes par Marché ──────────────────┐   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │   │
│  │  │PPG Home  │ │Over 1.5% │ │BTTS Yes% │     │   │
│  │  │1. PSG 2.8│ │1. OM 82% │ │1. RCS 75%│     │   │
│  │  │2. OM  2.5│ │2. PSG 78%│ │2. PSG 70%│     │   │
│  │  └──────────┘ └──────────┘ └──────────┘     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │   │
│  │  │xG Home   │ │xGA Away  │ │Under 3.5%│     │   │
│  │  │1. PSG 1.9│ │1. RCS 0.4│ │1. NICE 95%│   │   │
│  │  └──────────┘ └──────────┘ └──────────┘     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 1.3 Composants (nouveaux — à créer)

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `league-stats-page` | `src/app/league/[league_id]/stats/page.tsx` | Page SSR + client shell |
| `league-stats-table` | `src/components/leagues/league-stats-table.tsx` | Tableau classement dynamique (triable) |
| `league-location-tabs` | `src/components/leagues/league-location-tabs.tsx` | Toggle Global/Home/Away |
| `league-market-tops` | `src/components/leagues/league-market-tops.tsx` | Grille widgets tops par marché |
| `league-market-widget` | `src/components/leagues/league-market-widget.tsx` | Widget unitaire (top 5 d'un marché) |
| `league-season-selector` | `src/components/leagues/league-season-selector.tsx` | Sélecteur de saison |

**Créer le dossier** `src/components/leagues/` (nouvelle catégorie).

### 1.4 Comportement responsive

- **Desktop** (≥1024px): Tableau pleine largeur, widgets en grille 3 colonnes
- **Tablet** (768-1023px): Widgets en grille 2 colonnes
- **Mobile** (<768px): Tableau scrollable horizontalement, widgets empilés 1 colonne, tabs location en mode scroll horizontal


---

## 2. Schéma API

### 2.1 Endpoint

```
GET /api/v1/leagues/[league_id]/stats
```

### 2.2 Paramètres

| Param | Type | Requis | Défaut | Description |
|-------|------|--------|--------|-------------|
| `league_id` | `string` | ✅ | — | ID ligue (ex: `ligue1`, `epl`, `nba`) |
| `season` | `string` | ❌ | saison courante | Format: `2025` ou `2025/2026` |
| `location` | `enum` | ❌ | `all` | `all` \| `home` \| `away` |

### 2.3 Réponse JSON (200 OK)

```json
{
  "league": {
    "id": "ligue1",
    "name": "Ligue 1",
    "country": "France",
    "sport": "football",
    "logo": "https://cdn.example.com/leagues/ligue1.png",
    "season": "2025/2026"
  },
  "location": "home",
  "standings": [
    {
      "rank": 1,
      "team": {
        "id": "psg", "name": "Paris Saint-Germain",
        "shortName": "PSG", "logo": "...", "color": "#004170"
      },
      "stats": {
        "played": 19, "wins": 14, "draws": 4, "losses": 1,
        "goalsFor": 45, "goalsAgainst": 12, "goalDiff": 33,
        "points": 46, "pointsPerGame": 2.42,
        "xG": 1.82, "xGA": 0.63, "xGD": 1.19,
        "over15Pct": 84.2, "over15PctL5": 80.0, "over15PctL10": 90.0,
        "under35Pct": 68.4, "under35PctL5": 60.0, "under35PctL10": 70.0,
        "bttsYesPct": 57.9, "bttsYesPctL5": 40.0, "bttsYesPctL10": 60.0
      }
    }
  ],
  "marketTops": {
    "pointsPerGame": [
      { "teamId": "psg", "teamName": "PSG", "shortName": "PSG", "logo": "...", "value": 2.42 }
    ],
    "over15Pct": [],
    "under35Pct": [],
    "bttsYesPct": [],
    "xG": [],
    "xGA": []
  },
  "meta": {
    "source": "bsd",
    "computedAt": "2026-01-08T12:00:00Z",
    "ttlSeconds": 3600
  }
}
```

### 2.4 Codes d'erreur

| HTTP | Corps | Signification |
|------|-------|---------------|
| 200 | `LeagueStatsResponse` | Succès |
| 400 | `{ error: "Invalid location. Use all, home, or away" }` | Param invalide |
| 404 | `{ error: "League not found: 'xxx'" }` | Ligue inexistante |
| 503 | `{ error: "Stats unavailable — upstream down" }` | API BSD/ESPN HS |
| 504 | `{ error: "Computation timeout" }` | Calcul trop long |


---

## 3. Interfaces TypeScript

```typescript
// src/lib/league-stats.ts

export type LocationFilter = "all" | "home" | "away";

export type LeagueInfo = {
  id: string;
  name: string;
  country: string;
  sport: "football" | "basketball" | "tennis";
  logo: string;
  season: string;
};

export type TeamStandingStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  pointsPerGame: number;
  xG: number;
  xGA: number;
  xGD: number;
  over15Pct: number;
  over15PctL5: number;
  over15PctL10: number;
  under35Pct: number;
  under35PctL5: number;
  under35PctL10: number;
  bttsYesPct: number;
  bttsYesPctL5: number;
  bttsYesPctL10: number;
};

export type TeamStanding = {
  rank: number;
  team: {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
  };
  stats: TeamStandingStats;
};

export type MarketTopEntry = {
  teamId: string;
  teamName: string;
  shortName: string;
  logo: string;
  value: number;
};

export type MarketTops = {
  pointsPerGame: MarketTopEntry[];
  over15Pct: MarketTopEntry[];
  under35Pct: MarketTopEntry[];
  bttsYesPct: MarketTopEntry[];
  xG: MarketTopEntry[];
  xGA: MarketTopEntry[];
};

export type LeagueStatsResponse = {
  league: LeagueInfo;
  location: LocationFilter;
  standings: TeamStanding[];
  marketTops: MarketTops;
  meta: {
    source: "bsd" | "cache" | "mock";
    computedAt: string;
    ttlSeconds: number;
  };
};
```



---

## 4. Stratégie Cache & Performance

### 4.1 Architecture 3 niveaux

```
Client (SWR: staleTime 5min, revalidateOnFocus: false)
  │
  ▼
API Route Next.js
  │  createTtlCache sur globalThis: TTL 1h (L1)
  ▼
[Futur] Redis / SQLite materialized view: TTL 24h (L2)
  │
  ▼
BSD API (source) — raw match data
```

### 4.2 Cache L1 (immédiat)

Une entrée `globalThis` par clé composite `__leagueStats_{league_id}_{season}_{location}`.
Pattern identique à `cached-route.ts` existant. TTL: 1 heure.

```typescript
function cacheKey(leagueId: string, season: string, location: string) {
  return `__leagueStats_${leagueId}_${season}_${location}`;
}
```

### 4.3 Calcul par lot

Ne PAS recalculer L5/L10/xG à chaque appel. Stratégie:

1. **Lazy compute**: Premier appel → fetch BSD + compute → stocke cache. Appels suivants → cache hit.
2. **Optionnel (futur)**: Cron job `cron_refresh_league_stats.ts` toutes les heures.

### 4.4 Algorithme `computeStandings()`

```typescript
function computeStandings(
  matches: BSDFootballMatch[],
  location: LocationFilter
): TeamStanding[] {
  // 1. Filtrer matches terminés (home_score !== null)
  // 2. Grouper par team (home_team_obj.id + away_team_obj.id)
  // 3. Filtrer par location: home | away | all
  // 4. Pour chaque équipe, agréger:
  //    - W/D/L: home_score vs away_score
  //    - GF, GA, GD, Pts (3pts win, 1pt draw)
  //    - xG/xGA: sum(actual_home_xg) / played
  //    - Over 1.5: count(total_goals > 1.5) / played
  //    - Under 3.5: count(total_goals < 3.5) / played
  //    - BTTS Yes: count(home_score>0 AND away_score>0) / played
  //    - L5: fenêtre glissante 5 derniers matchs
  //    - L10: fenêtre glissante 10 derniers matchs
  // 5. Trier: points → goalDiff → goalsFor
  // 6. PPG = points / played
}

---

## 5. Route API (implémentation)

### 5.1 Fichier

```
src/app/api/v1/leagues/[league_id]/stats/route.ts
```

### 5.2 Pseudo-code

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { LeagueStatsResponse, LocationFilter } from "@/lib/league-stats";

const VALID_LOCATIONS = new Set(["all", "home", "away"]);
const CACHE_TTL = 60 * 60_000; // 1h

function getCache<T>(key: string): T | null {
  const entry = (globalThis as any)[key];
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.data;
  return null;
}
function setCache<T>(key: string, data: T) {
  (globalThis as any)[key] = { data, at: Date.now() };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ league_id: string }> }
) {
  const { league_id } = await params;
  const url = new URL(req.url);
  const season = url.searchParams.get("season") || "2025";
  const location = (url.searchParams.get("location") || "all") as LocationFilter;

  if (!VALID_LOCATIONS.has(location)) {
    return NextResponse.json(
      { error: "Invalid location. Use all, home, or away" },
      { status: 400 }
    );
  }

  const key = `__leagueStats_${league_id}_${season}_${location}`;
  const cached = getCache<LeagueStatsResponse>(key);
  if (cached) {
    return NextResponse.json({ ...cached, meta: { ...cached.meta, source: "cache" } });
  }

  try {
    const data = await computeLeagueStats(league_id, season, location);
    setCache(key, data);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[league-stats] ${league_id}:`, (err as Error).message);
    if ((err as Error).message.includes("not found")) {
      return NextResponse.json({ error: `League not found: '${league_id}'` }, { status: 404 });
    }
    return NextResponse.json({ error: "Stats unavailable — upstream down" }, { status: 503 });

---

## 6. Composants React

### 6.1 `LeagueStatsPage` — Page principale

```typescript
// src/app/league/[league_id]/stats/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import type { LeagueStatsResponse, LocationFilter } from "@/lib/league-stats";
import { LeagueLocationTabs } from "@/components/leagues/league-location-tabs";
import { LeagueStatsTable } from "@/components/leagues/league-stats-table";
import { LeagueMarketTops } from "@/components/leagues/league-market-tops";
import { LeagueSeasonSelector } from "@/components/leagues/league-season-selector";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function LeagueStatsPage() {
  const { league_id } = useParams<{ league_id: string }>();
  const [location, setLocation] = useState<LocationFilter>("all");
  const [season, setSeason] = useState("2025");

  const { data, error, isLoading } = useSWR<LeagueStatsResponse>(
    `/api/v1/leagues/${league_id}/stats?season=${season}&location=${location}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  if (isLoading) return <LeagueStatsSkeleton />;
  if (error) return <div>Erreur chargement stats</div>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <LeagueLocationTabs value={location} onChange={setLocation} />
      <LeagueSeasonSelector value={season} onChange={setSeason} />
      <LeagueStatsTable standings={data.standings} />
      <LeagueMarketTops tops={data.marketTops} location={location} />
    </div>
  );
}
```

### 6.2 `LeagueLocationTabs`

```typescript
export function LeagueLocationTabs({
  value, onChange,
}: {
  value: LocationFilter;
  onChange: (v: LocationFilter) => void;
}) {
  return (
    <ToggleGroup type="single" value={value}
      onValueChange={(v) => v && onChange(v as LocationFilter)}>
      <ToggleGroupItem value="all">Tous</ToggleGroupItem>
      <ToggleGroupItem value="home">À domicile</ToggleGroupItem>
      <ToggleGroupItem value="away">En déplacement</ToggleGroupItem>
    </ToggleGroup>
  );
}
```

### 6.3 `LeagueStatsTable` — Tableau classement

Colonnes triables: Pts, PPG, xG, xGA, Over 1.5%, Under 3.5%, BTTS Yes%. Top 3 surlignés vert, bottom 3 rouge.

```typescript
const COLUMNS = [
  { key: "rank", label: "#" },
  { key: "team", label: "Équipe" },
  { key: "played", label: "J" },
  { key: "points", label: "Pts", sortable: true },
  { key: "pointsPerGame", label: "PPG", sortable: true },
  { key: "xG", label: "xG", sortable: true },
  { key: "xGA", label: "xGA", sortable: true },
  { key: "xGD", label: "xGD", sortable: true },
  { key: "over15Pct", label: "Over 1.5%", sortable: true },
  { key: "under35Pct", label: "Under 3.5%", sortable: true },
  { key: "bttsYesPct", label: "BTTS Yes%", sortable: true },
] as const;
```

### 6.4 `LeagueMarketTops` + `LeagueMarketWidget`

6 widgets en grille responsive (3 cols desktop, 2 tablet, 1 mobile). Chaque widget = Card shadcn/ui avec top 5 + barres proportionnelles.

```typescript
const MARKETS = [
  { key: "pointsPerGame", label: "PPG", icon: "📊", higherIsBetter: true },
  { key: "over15Pct", label: "Over 1.5 %", icon: "🎯", higherIsBetter: true },

---

## 7. Support multi-sport (NBA/basket)

### 7.1 Extension des types

```typescript
export type LeagueInfo = {
  // ... existant
  sport: "football" | "basketball";
};

// Spécifique basket (optionnel):
export type TeamStandingStats = {
  // ... commun
  pointsPerGame?: number;    // PPG basket (pts marqués)
  opponentPPG?: number;      // Points encaissés
  reboundsPerGame?: number;
  assistsPerGame?: number;
  fieldGoalPct?: number;
  threePointPct?: number;
  freeThrowPct?: number;
};
```

### 7.2 Sources données

- **Football**: BSD API (`/matches/?season_id=X&status=finished`)
- **Basketball**: BSD (si addon) → fallback ESPN via skill `nba-data` (`get_standings`)
- **Routing**: L'API route `/api/v1/leagues/:id/stats` dispatche vers le bon fetcher selon `sport`

### 7.3 Adaptation UI

- **Tableau basket**: remplace Over/Under/BTTS → PPG, RPG, APG, FG%, 3P%, FT%
- **Widgets basket**: PPG, Defensive Rating, Pace, Net Rating au lieu de Over 1.5/BTTS
- **`marketTops`**: Les clés sont dynamiques selon le sport (intersection des métriques disponibles)

  { key: "under35Pct", label: "Under 3.5 %", icon: "🛡️", higherIsBetter: true },
  { key: "bttsYesPct", label: "BTTS Yes %", icon: "🥅", higherIsBetter: true },

---

## 8. Accessibilité

- **Tableau**: `<table>` sémantique avec `<thead>`, `scope="col"`, `role="columnheader"`
- **Tabs**: `role="tablist"`, `role="tab"`, `aria-selected`, navigation flèches clavier
- **Widgets**: `<ol>` (classement = liste ordonnée)
- **Couleurs**: pas d'info uniquement par couleur (ajouter icônes ▲▼ pour tendances)
- **Focus**: `focus-visible:ring-2` sur tous les éléments interactifs
- **Tri**: Annoncer le nouvel ordre via `aria-live="polite"`

---

## 9. Tests

| Type | Cible | Description |
|------|-------|-------------|
| Unitaire | `computeStandings()` | Jeu mock 6 équipes → vérifier W/D/L, Pts, PPG, xG |
| Unitaire | Cache TTL | Cache hit/miss/expiry |
| Intégration | `GET /api/v1/leagues/:id/stats` | 200, 400 (location invalide), 404 (ligue inconnue) |
| E2E (Playwright) | `/league/ligue1/stats` | Navigation, toggle location, tri colonnes, chargement widgets |
| Visual | Widgets marketTops | Top 5 correct, barres proportionnelles, pas de débordement mobile |

---

## 10. Plan d'implémentation

| # | Étape | Fichier(s) |
|---|-------|-----------|
| 1 | Types + interfaces | `src/lib/league-stats.ts` |
| 2 | Cache TTL helpers | `src/lib/league-stats-cache.ts` |
| 3 | Algorithme computeStandings() | `src/lib/league-stats-compute.ts` |
| 4 | Route API GET | `src/app/api/v1/leagues/[league_id]/stats/route.ts` |
| 5 | Widget unitaire | `src/components/leagues/league-market-widget.tsx` |
| 6 | Grille widgets | `src/components/leagues/league-market-tops.tsx` |
| 7 | Toggle location | `src/components/leagues/league-location-tabs.tsx` |
| 8 | Tableau classement | `src/components/leagues/league-stats-table.tsx` |
| 9 | Sélecteur saison | `src/components/leagues/league-season-selector.tsx` |
| 10 | Page SSR | `src/app/league/[league_id]/stats/page.tsx` |
| 11 | Loading squelettes | `loading.tsx` + `error.tsx` |
| 12 | Navigation depuis LeagueBar | Modifier `FootballLeagueBar` → `router.push` |
| 13 | Registre composants | Mettre à jour `COMPONENTS.md` (+7 composants) |

### Roadmap temporelle

```
Phase 1 (MVP — S1)
  ├── Types + compute + API route (football, all location)
  ├── Page + tableau seul
  └── Cache L1

Phase 2 (Widgets — S2)
  ├── LeagueMarketWidget + LeagueMarketTops
  ├── LeagueLocationTabs
  └── Tri colonnes tableau

Phase 3 (Polish — S3)
  ├── Support xG (toutes ligues, via BSD actual_xg)
  ├── Sélecteur saison
  ├── Tests E2E Playwright
  └── Audit accessibilité

Phase 4 (Multi-sport — S4)
  ├── Support NBA/basket
  ├── Adaptation UI par sport
  └── COMPONENTS.md final
```

---

## Annexe A — Mapping BSD League IDs

```typescript
// src/lib/league-mapping.ts
export const BSD_LEAGUE_IDS: Record<string, number> = {
  ligue1: 103,
  epl: 8,
  laliga: 564,
  bundesliga: 82,
  seriea: 384,
  // ... à compléter depuis server.js ALL_LEAGUE_IDS
};
```

## Annexe B — Endpoints BSD utilisés

| Endpoint BSD | Usage |
|-------------|-------|
| `GET /matches/?season_id={id}&status=finished&limit=500` | Tous les matchs joués d'une saison |
| `GET /leagues/` | Liste des ligues disponibles |
| `GET /seasons/?league_id={id}` | Saisons disponibles |

Champs clés déjà typés dans `bsd-football-fetcher.ts`: `actual_home_xg`, `actual_away_xg`, `home_score`, `away_score`, `home_team_obj`, `away_team_obj`, `odds_btts_yes`, `odds_over_15`.

## Annexe C — Dépendances NPM (déjà installées)

- `swr` — data fetching + cache client (déjà utilisé)
- `@/components/ui/table` — shadcn/ui Table (existant)
- `@/components/ui/toggle-group` — shadcn/ui ToggleGroup (existant si ajouté, sinon `bunx shadcn@latest add toggle-group`)
- `@/components/ui/card` — shadcn/ui Card (existant)
- `@/components/ui/select` — shadcn/ui Select (existant)
- `@/components/ui/skeleton` — shadcn/ui Skeleton (existant)

  { key: "xG", label: "Attaque (xG)", icon: "⚽", higherIsBetter: true },
  { key: "xGA", label: "Défense (xGA)", icon: "🧤", higherIsBetter: false },
] as const;
```

  }
}
```

```

### 4.5 Estimation volumes

| Scénario | Appels BSD | Matchs à agréger |
|----------|-----------|-------------------|
| Ligue 1 (18 équipes × 34j) | 1 | ~306 |
| Premier League (20 × 38) | 1 | ~380 |
| Toutes ligues (~50) | 50 (batch) | ~15 000 |
| Avec cache 1h | 50/h max | Négligeable |
