# DATA_RANKINGS_PIPELINE.md — Pipeline de Classement par Métrique Home/Away

> **Auteur :** Lead Data Engineer / Cloud Architect / Senior Fullstack  
> **Date :** 2026-02-08  
> **Statut :** Architecture proposée — PoC inclus  
> **Version :** 1.0

---

## Table des Matières

1. [Stratégie de Scraping & Sources](#1-stratégie-de-scraping--sources)
2. [Architecture 100 % Gratuite & Automatisation](#2-architecture-100--gratuite--automatisation)
3. [Moteur de Calcul & Normalisation](#3-moteur-de-calcul--normalisation-ranking-engine)
4. [Blueprint d'Intégration Frontend](#4-blueprint-dintégration-frontend-nextjs--swr)
5. [Schéma JSON Normalisé](#5-schéma-json-normalisé)
6. [Roadmap & Prochaines Étapes](#6-roadmap--prochaines-étapes)

---

## 1. Stratégie de Scraping & Sources

### 1.1 Comparatif Technique des Sources

| Critère | soccerstats.com | FBref.com |
|---------|-----------------|-----------|
| **Structure** | Tables HTML denses par ligue, colonnes fixes | Données ultra-précises, tables `squads/`, `scores/` |
| **Home/Away split** | Tableau dédié « Home / Away » natif sur la page ligue | Colonnes séparées dans la table de championnat (`home_games`, `away_games`) |
| **Anti-bot** | Faible — pas de Cloudflare détecté, User-Agent simple suffit | Cloudflare avec JS challenge + rate-limit strict |
| **Frais** | Gratuit, pas de ToS restrictive explicite sur la consultation | Gratuit mais ToS Sports Reference interdit tout usage commercial |
| **Métriques dispo** | PPG, Buts, Diff, Tirs, Corners, Attaques Dangereuses, clean sheets | xG, xGA, per90 stats, possession — plus riche mais sous ToS strict |
| **Lib Python existante** | Non — scraping custom nécessaire | Oui — `soccerdata` (déjà installé dans le projet) |
| **Fiabilité scraping** | Stable — sélecteurs CSS prévisibles | Fragile — changement fréquent de markup |
| **Recommandation PariScore** | ✅ **SOURCE PRINCIPALE** | ⚠️ **SOURCE RECHERCHE UNIQUEMENT** (`fbref_extract.py` existant — `research_only: true`) |

### 1.2 Décision Architecturale : soccerstats.com comme source primaire

**Justification :**
1. **Home/Away natif** : soccerstats expose directement des tableaux séparés par ligue, en évitant de devoir agréger match par match.
2. **Métriques exactes ciblées** : PPG, BP/BC, différentiel, tirs, tirs cadrés (SOT), attaques dangereuses, corners — toutes sur une seule page.
3. **Pas de ToS restrictive** : contrairement à FBref / Sports Reference, soccerstats n'interdit pas l'affichage de statistiques agrégées dans une UI tierce.
4. **Fingerprint léger** : un simple `requests` + `BeautifulSoup` avec un User-Agent standard suffit — pas de JS rendering.
5. **Fallback FBref** : le pipeline `fbref_extract.py` (recherche uniquement) sert de backup pour les métriques avancées.


### 1.3 Stack de Scraping Recommandée

```
┌──────────────────────────────────────────────────┐
│  PYTHON 3.11+ — SCRAPER LÉGER                   │
│                                                  │
│  requirements-rankings.txt :                     │
│    requests>=2.31.0                               │
│    beautifulsoup4>=4.12.0                         │
│    lxml>=5.0.0         ← parser rapide            │
│    tenacity>=8.0.0     ← retry avec backoff       │
│                                                  │
│  Script principal :                              │
│    scripts/scrape_rankings.py                     │
│    scripts/scrape_rankings_poc.py ← PoC demo      │
│                                                  │
│  Output :                                        │
│    /public/data/rankings/{league_id}.json         │
│    (fichier statique, servi via CDN Next.js)      │
└──────────────────────────────────────────────────┘
```

Pourquoi pas Playwright / Selenium : soccerstats.com ne nécessite pas de JS rendering. HTTP pur = 10-50x plus rapide, pas de binaire headless dans GitHub Actions.

### 1.4 Métriques Ciblées (Filtre Home/Away)

| Colonne soccerstats | Métrique PariScore | Clé JSON |
|---------------------|-------------------|----------|
| GP (Games Played) | Matchs joués | `played` |
| Pts (Points) | Points cumulés | `points` |
| PPG | Points Per Game | `ppg` |
| GF (Goals For) | Buts marqués | `goalsFor` |
| GA (Goals Against) | Buts encaissés | `goalsAgainst` |
| GD (Goal Diff) | Différence de buts | `goalDiff` |
| Shots PG | Tirs / match | `shotsPg` |
| SOT PG | Tirs cadrés / match | `sotPg` |
| Dang. Attacks PG | Attaques dangereuses / match | `attacksPg` |
| Corners PG | Corners / match | `cornersPg` |
| % Over 5.5 → 10.5 | % franchissement seuil | `cornersOver55` … `cornersOver105` |

---

## 2. Architecture 100 % Gratuite & Automatisation

### 2.1 Vue d'Ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                     GITHUB ACTIONS (CRON)                        │
│  schedule: 0 4 * * *   →  04:00 UTC quotidien                   │
│  schedule: 0 2 * * 0,6 →  02:00 UTC (2h avant matchs WE)        │
│                                                                  │
│  ┌─────────────────────┐     ┌──────────────────────────────┐   │
│  │ 1. Checkout repo    │────▶│ 2. Setup Python 3.11 + pip   │   │
│  └─────────────────────┘     └──────────────────────────────┘   │
│                                          │                        │
│                                          ▼                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 3. scripts/scrape_rankings.py --all                      │   │
│  │    → Itère 20+ ligues, scrape soccerstats.com            │   │
│  │    → Génère /public/data/rankings/{league_id}.json       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                     │                                             │
│                     ▼                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 4. git add /public/data/rankings/*.json                  │   │
│  │ 5. git commit -m "chore(data): refresh rankings [skip ci]"│   │
│  │ 6. git push                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                     │                                             │
│                     ▼                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ VERCEL CDN — /public/data/rankings/epl.json              │   │
│  │   → Latence < 10ms (Edge Network, zéro coût serveur)     │   │
│  │   → Cache automatique, pas de base de données            │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Détail du Workflow GitHub Actions

**Fichier :** `.github/workflows/refresh-rankings.yml`

```yaml
name: Refresh Rankings

on:
  schedule:
    - cron: "0 4 * * *"       # 04:00 UTC quotidien
    - cron: "0 2 * * 0,6"     # 02:00 UTC sam + dim
  workflow_dispatch:
    inputs:
      league:
        description: "League ID (blank = all)"
        type: string
        required: false

concurrency:
  group: refresh-rankings
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0, persist-credentials: true }
      - uses: actions/setup-python@v5
        with: { python-version: "3.11", cache: "pip" }
      - name: Install dependencies
        run: |
          pip install --upgrade pip
          pip install -r scripts/requirements-rankings.txt
      - name: Scrape rankings
        run: |
          python scripts/scrape_rankings.py \
            ${{ inputs.league || '--all' }} \
            --output-dir public/data/rankings
      - name: Detect changes
        id: diff
        run: |
          if git diff --quiet -- public/data/rankings/; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
            git diff --stat -- public/data/rankings/
          fi
      - name: Commit & push
        if: steps.diff.outputs.changed == 'true'
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/data/rankings/
          git commit -m "chore(data): refresh rankings [skip ci]"
          git push
```

### 2.3 Stratégie de Cache & Stockage

**Option A (retenue) : JSON statiques dans `/public/` → CDN Next.js/Vercel**

| Avantage | Détail |
|----------|--------|
| **Coût** | 0 € — aucun service externe, pas de DB |
| **Latence** | < 10ms (CDN edge, pas de cold start) |
| **Déploiement** | Atomique avec le push Git |
| **Rollback** | `git revert` natif |
| **Volume** | ~100 KB × 30 ligues = 3 MB → négligeable |
| **TTL** | 24h (rafraîchi par le CRON quotidien) |

**Option B (alternative) : Supabase PostgreSQL Free Tier**

| Avantage | Inconvénient |
|----------|-------------|
| Requêtes SQL filtrables | Cold start 500ms sur free tier |
| Pas de commit Git à chaque update | 500 MB limit |
| Jointure native avec matchs | Complexité ops supplémentaire |

→ **L'Option A est retenue** pour simplicité, coût zéro, et latence CDN optimale. L'Option B reste documentée comme fallback.



---

## 3. Moteur de Calcul & Normalisation (Ranking Engine)

### 3.1 Algorithme d'Indexation

```
POUR CHAQUE LIGUE:
│
├─ 1. TÉLÉCHARGEMENT
│   GET https://www.soccerstats.com/latest.asp?league={league_slug}
│   → Parse HTML avec BeautifulSoup + lxml
│
├─ 2. EXTRACTION DES TABLEAUX HOME / AWAY
│   Identifier les <table> contenant les headers "GP", "Pts", "PPG"
│   Extraire les lignes <tr> → colonnes <td>
│   Séparer Home / Away (basé sur les titres <h2>/<h3>)
│
├─ 3. PARSING PAR ÉQUIPE
│   Pour chaque ligne : nom, GP, Pts, PPG, GF, GA, GD
│   + Shots PG, SOT PG, Attaques PG, Corners PG (si présents)
│   + % Over Corners 5.5→10.5 (si présents)
│
├─ 4. TRI & ATTRIBUTION DES RANGS
│   Pour chaque métrique M :
│     Trier par M DESC (ou ASC pour GA)
│     Attribuer rank = 1..N
│     Égalités : même rang, skip suivant
│
├─ 5. MAPPING DES NOMS D'ÉQUIPES
│   normalizeTeamName() existant + dictionnaire overrides
│   "Bodø / Glimt" → "Bodo Glimt"
│   "Manchester Utd" → "Manchester United"
│   "Paris Saint-Germain" → "Paris SG"
│
└─ 6. GÉNÉRATION JSON
    → /public/data/rankings/{league_id}.json
```




### 3.2 Mapping des Noms d'Équipes

Le module `normalizeTeamName()` existant (`src/lib/normalize-team-name.ts`) gère la normalisation Unicode (NFD) et la suppression des préfixes clubs (FC, CF, AC, SSC...).

Dictionnaire d'overrides additionnel pour les cas particuliers :

```
# scripts/team_name_mapping.py
TEAM_NAME_OVERRIDES = {
    "Manchester Utd":         "Manchester United",
    "Wolverhampton":          "Wolves",
    "Sheffield Utd":          "Sheffield United",
    "West Brom":              "West Bromwich Albion",
    "Bodø / Glimt":           "Bodo Glimt",
    "Paris Saint-Germain":    "Paris SG",
    "Borussia M'gladbach":    "Borussia Monchengladbach",
    "Inter":                  "Inter Milan",
    "Atletico Madrid":        "Atletico Madrid",
    "Athletic Bilbao":        "Athletic Bilbao",
}
```

### 3.3 Comportement d'Erreur & Fallback

| Situation | Comportement |
|-----------|-------------|
| soccerstats.com down | Le JSON précédent reste servi |
| Ligue sans données | Tableau vide avec `partial: true` |
| Nom d'équipe non mappé | Utiliser le nom brut + log warning |
| Rate-limit (HTTP 429) | Retry exponential backoff × 3 |
| Timeout > 30s | Abandon ligue, continuer les autres |



---

## 4. Blueprint d'Intégration Frontend (Next.js / SWR)

### 4.1 Hook SWR — Consommation Directe CDN (Recommandé)

Les fichiers JSON dans `/public/data/rankings/` sont servis directement via le CDN Next.js/Vercel (latence < 10ms). Pas besoin de route API.

```typescript
// src/hooks/use-league-rankings.ts
import useSWR from "swr";
import type { MetricRankings } from "@/lib/football-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLeagueRankings(
  leagueId: string | null,
  side: "home" | "away" = "home"
) {
  const { data, error, isLoading, mutate } = useSWR(
    leagueId ? `/data/rankings/${leagueId}.json` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60 * 60 * 1000,
    }
  );

  return {
    rankings: (data?.[side] ?? {}) as MetricRankings,
    isLoading,
    error,
    refresh: () => mutate(),
  };
}
```



### 4.2 Intégration dans MetricLeaderboardTable

Le composant existant `MetricLeaderboardTable` (`src/components/football/MetricLeaderboardTable.tsx`) accepte déjà :
- `rankings: MetricRankings` — dictionnaire `{ "ppg-home": [...], "goals-scored-home": [...], ... }`
- `homeTeamName` / `awayTeamName` — pour le surlignage visuel

```tsx
// Dans football-match-detail-dialog.tsx
import { useLeagueRankings } from "@/hooks/use-league-rankings";
import { MetricLeaderboardTable } from "@/components/football/MetricLeaderboardTable";

function MatchDetail({ match }) {
  const { rankings: homeRankings } = useLeagueRankings(match.league.slug, "home");
  const { rankings: awayRankings } = useLeagueRankings(match.league.slug, "away");

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricLeaderboardTable
        rankings={homeRankings}
        homeTeamName={match.home.name}
        awayTeamName={match.away.name}
      />
      <MetricLeaderboardTable
        rankings={awayRankings}
        homeTeamName={match.home.name}
        awayTeamName={match.away.name}
      />
    </div>
  );
}
```

### 4.3 Route API Optionnelle

Route API `/api/football/rankings?leagueId=X&side=home` — redirige vers le fichier statique avec cache :

```typescript
// src/app/api/football/rankings/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId");
  const side = url.searchParams.get("side") || "home";
  if (!leagueId) {
    return NextResponse.json({ error: "leagueId required" }, { status: 400 });
  }
  try {
    const res = await fetch(`/data/rankings/${leagueId}.json`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const full = await res.json();
    return NextResponse.json(full[side] ?? {}, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Rankings unavailable" }, { status: 503 });
  }
}
```



---

## 5. Schéma JSON Normalisé

### 5.1 Types TypeScript (extension de football-data.ts)

```typescript
// Ajout dans src/lib/football-data.ts

/** Métadonnées d'un fichier de rankings. */
export type RankingsMeta = {
  schemaVersion: 1;
  leagueId: string;        // ex: "epl", "ligue1"
  leagueName: string;      // ex: "Premier League"
  season: string;          // ex: "2025-26"
  lastUpdated: string;     // ISO 8601
  source: "soccerstats.com" | "fbref-research";
  teamCount: number;
  partial: boolean;
};

/** Une équipe dans un classement de métrique. */
export type RankingEntry = {
  rank: number;
  teamId?: string;         // ID interne PariScore (si mappée)
  teamName: string;        // Nom standardisé
  value: number;
  played: number;
};

/** Fichier complet pour une ligue (Home + Away). */
export type LeagueRankingsFile = {
  meta: RankingsMeta;
  home: Record<string, RankingEntry[]>;
  away: Record<string, RankingEntry[]>;
  metricDefs: Record<string, {
    label: string;
    higherIsBetter: boolean;
    unit: string;
  }>;
};
```



### 5.2 Fichier JSON Exemple (`/public/data/rankings/epl.json`)

```json
{
  "meta": {
    "schemaVersion": 1, "leagueId": "epl", "leagueName": "Premier League",
    "season": "2025-26", "lastUpdated": "2026-02-08T04:05:23Z",
    "source": "soccerstats.com", "teamCount": 20, "partial": false
  },
  "home": {
    "ppg": [
      { "rank": 1, "teamId": "arsenal", "teamName": "Arsenal", "value": 2.55, "played": 12 },
      { "rank": 2, "teamId": "man-city", "teamName": "Manchester City", "value": 2.42, "played": 12 }
    ],
    "goalsFor": [
      { "rank": 1, "teamId": "arsenal", "teamName": "Arsenal", "value": 28, "played": 12 }
    ],
    "goalsAgainst": [
      { "rank": 1, "teamId": "arsenal", "teamName": "Arsenal", "value": 4, "played": 12 }
    ],
    "shotsPg": [
      { "rank": 1, "teamId": "man-city", "teamName": "Manchester City", "value": 18.4, "played": 12 }
    ],
    "cornersOver95": [
      { "rank": 1, "teamId": "man-city", "teamName": "Manchester City", "value": 75.0, "played": 12 }
    ]
  },
  "away": {
    "ppg": [
      { "rank": 1, "teamId": "liverpool", "teamName": "Liverpool", "value": 2.18, "played": 11 }
    ]
  },
  "metricDefs": {
    "ppg":           { "label": "PPG (Points Par Match)", "higherIsBetter": true,  "unit": "pts" },
    "goalsFor":      { "label": "Buts Marqués",          "higherIsBetter": true,  "unit": "buts" },
    "goalsAgainst":  { "label": "Buts Encaissés",        "higherIsBetter": false, "unit": "buts" },
    "goalDiff":      { "label": "Différence de Buts",    "higherIsBetter": true,  "unit": "buts" },
    "shotsPg":       { "label": "Tirs / Match",          "higherIsBetter": true,  "unit": "/match" },
    "sotPg":         { "label": "Tirs Cadrés / Match",   "higherIsBetter": true,  "unit": "/match" },
    "attacksPg":     { "label": "Attaques Dang. / Match","higherIsBetter": true,  "unit": "/match" },
    "cornersPg":     { "label": "Corners / Match",       "higherIsBetter": true,  "unit": "/match" },
    "cornersOver55": { "label": "% Over 5.5 Corners",    "higherIsBetter": true,  "unit": "%" },
    "cornersOver95": { "label": "% Over 9.5 Corners",    "higherIsBetter": true,  "unit": "%" }
  }
}
```



### 5.3 Compatibilité avec MetricRankings existant

Le type `MetricRankings` existant dans `src/lib/football-data.ts` est directement compatible — le mapping `RankingEntry[] → MetricRankingRow[]` est trivial :

```typescript
// Existing types (src/lib/football-data.ts):
export type MetricRankingRow = { teamId: string; name: string; value: number | null; rank: number; };
export type MetricRankings = Record<string, MetricRankingRow[]>;
```

---

## 6. Roadmap & Prochaines Étapes

### Phase 1 — PoC ✅ (CURRENT)
- [x] Rapport d'architecture (`DATA_RANKINGS_PIPELINE.md`)
- [x] Script PoC Python (`scripts/scrape_rankings_poc.py`)
- [ ] Validation manuelle des noms d'équipes sur 5 ligues majeures

### Phase 2 — Production Scraper (Semaine 1)
- [ ] Script production `scripts/scrape_rankings.py`
- [ ] Dictionnaire de mapping (`scripts/team_name_mapping.py`)
- [ ] Fichier `scripts/requirements-rankings.txt`
- [ ] Test local sur 5 ligues × 2 côtés

### Phase 3 — CI/CD (Semaine 2)
- [ ] Workflow `.github/workflows/refresh-rankings.yml`
- [ ] Premier run manuel → validation JSON
- [ ] Activation CRON quotidien

### Phase 4 — Intégration Frontend (Semaine 3)
- [ ] Hook `useLeagueRankings` dans `src/hooks/`
- [ ] Intégration dans `MetricLeaderboardTable` + `MetricComparePanel`
- [ ] Test E2E

### Phase 5 — Enrichissement (Semaine 4+)
- [ ] Métriques xG/xGA depuis FBref (recherche uniquement)
- [ ] Corners Over % depuis soccerstats
- [ ] Support ligues additionnelles
- [ ] Historique des rankings (snapshots hebdomadaires)

---

## Annexe A : Comparatif Stack Technique

| Composant | Choix | Alternative | Raison |
|-----------|-------|------------|--------|
| Scraper | Python + BS4 + requests | Node.js + Cheerio | Python plus mature pour parsing HTML |
| Parser HTML | lxml | html.parser | lxml 5-10x plus rapide |
| Stockage | JSON statique /public/ | Supabase/Turso | 0 coût, latence CDN < 10ms |
| Orchestration | GitHub Actions CRON | Vercel Cron | Gratuit, déjà utilisé (refresh-elo) |
| Cache CDN | Vercel Edge | Cloudflare Workers | Déjà déployé |
| Cache Client | SWR | React Query | SWR déjà dépendance du projet |

## Annexe B : Structure HTML sur soccerstats.com

```
https://www.soccerstats.com/latest.asp?league=england
├── Table "Home"  → GP, Pts, PPG, GF, GA, GD, Shots PG, SOT PG, Att. PG
├── Table "Away"  → Mêmes colonnes
├── Table "Corners Home" → Corners PG, % Over 5.5→10.5
└── Table "Corners Away" → Mêmes colonnes

Structure HTML typique :
<div class="box">
  <h2>Home</h2>
  <table class="tbl" cellpadding="2" cellspacing="1">
    <tr class="hed"><td>#</td><td>Team</td><td>GP</td><td>Pts</td>...</tr>
    <tr class="odd"><td>1</td><td><a>Arsenal</a></td><td>12</td>...</tr>
  </table>
</div>
```
