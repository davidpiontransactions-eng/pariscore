# Structure Onglet Tennis — Refonte V2

> **Date** : 2026-07-20
> **Scope** : refonte de l'UX de l'onglet tennis + ajout module recherche +
> vraies heures via TennisTemple.

## 1. Architecture actuelle (avant refonte)

```
src/app/page.tsx
└── <SportTabs> (8 onglets : tennis, football, cs2, mma, nba, wnba, cycling, f1)
└── {activeTab === "tennis" && <TennisTabContent />}
    └── TennisTabContent (src/components/football/tennis-tab-content.tsx)
        ├── Hero (titre + filtres: all/favorites/balanced/starred + sort rank/elo)
        └── Grid de <MatchCard> (prematch + synthetic live)
```

**Limitations actuelles** :
- ❌ Pas de séparation Live / Aujourd'hui / Tournois (tout mélangé)
- ❌ Pas de recherche joueur/tournoi (2194 joueurs ATP+WTA invisibles)
- ❌ Heure affichée = soit `scheduledAt` BSD (parfois faux), soit `new Date()` (fallback trompeur)
- ❌ Pas de page dédiée joueur/tournoi (lien mort)

## 2. Architecture cible (après refonte)

```
src/app/page.tsx (onglet "tennis")
└── <SportTabs>
└── {activeTab === "tennis" && <TennisTabContent />}
    └── TennisTabContent (refactoré)
        ├── Hero
        │   └── 🔍 CombinedSearchBar (joueurs + tournois, debounced 200ms)
        ├── <TennisSubTabs> (3 sous-onglets)
        │   ├── 🟢 Live       → grid matchs live (synthetic+real)
        │   ├── 📅 Aujourd'hui → grid matchs du jour (prematch+live)
        │   └── 🏆 Tournois    → <TournamentsList> (grille ATP/WTA/ITF)
        └── Filtres + Sort (inchangés)

src/app/tennis/player/[slug]/page.tsx (NOUVEAU)
└── PlayerProfilePage
    ├── Header (photo + nom + drapeau + rang ATP/WTA + surface préf)
    ├── Stats card (Elo surface, SPS, forme, W/L last 10)
    ├── <LastMatchesList> (10 derniers matchs)
    ├── <StatsRadarChart> (vs moyenne top 10)
    └── Upcoming matches

src/app/tennis/tournament/[slug]/page.tsx (NOUVEAU)
└── TournamentPage
    ├── Header (logo + nom + pays + surface + date)
    ├── Bracket (si Simple Élimination)
    ├── Tableau des matchs (live + à venir + résultats)
    └── Players list ( Top seeds + joueurs FR)
```

## 3. Composants à créer (5 nouveaux)

| Composant | Rôle | Inspiré de |
|---|---|---|
| `tennis-sub-tabs.tsx` | 3 sous-onglets (Live/Aujourd'hui/Tournois) | Sofascore |
| `tournaments-list.tsx` | Grille tournois du jour (logo + nom + surface + pays) | ATP Tour |
| `player-search-bar.tsx` | Autocomplete joueurs avec photo + drapeau | ESPN search |
| `tournament-search-bar.tsx` | Autocomplete tournois | Sofascore |
| `combined-search-bar.tsx` | Recherche unifiée joueurs+tournois | Sofascore |

## 4. APIs à créer (3 nouvelles routes)

| Route | Source | Cache | Rôle |
|---|---|---|---|
| `/api/tennis/tournaments` | BSD `/api/v2/tournaments/?date=today` | 5 min | Liste tournois du jour |
| `/api/tennis/search?q=` | DB prisma (`players` + `tournaments`) | 60s | Autocomplete unifié |
| `/api/tennis/schedule` | **TennisTemple scrapé** + fallback BSD | 5 min | Vraies heures matchs |

## 5. Module TennisTemple — vraies heures

### Pourquoi
BSD fournit `start_time` mais il est souvent :
- En UTC sans timezone explicite du tournoi
- Manquant → fallback `new Date()` qui affiche l'heure actuelle (trompeur)
- En décalage avec l'heure officielle (ex: ATP Madrid 16:00 CET affiché 14:00 UTC sans contexte)

### Comment
**Tennistemple.com n'a pas d'API publique** (vérifié via WebSearch). Donc **scraping légal** via le MCP `scrapling` installé.

### Workflow
```
1. scripts/scrap-tennistemple.ts (cron ou à la demande)
   ↓ scrap en.tennistemple.com/competitions/atp/<année> + /wta/<année>
   ↓ extract {tournament, player1, player2, scheduledTime, timezone}
2. src/lib/tennistemple-parser.ts
   ↓ normalize → UTC ISO + préserve timezone IANA du tournoi
3. src/lib/schedule-merger.ts
   ↓ match par nom joueur (normForLookup) entre schedule TT et matches BSD
   ↓ enrichir scheduledAt BSD avec vraie heure TT
4. /api/tennis/schedule
   ↓ cache 5 min (les horaires ne changent pas souvent)
   ↓ fallback BSD si TT indispo
5. MatchCardHeader
   ↓ affiche heure dans timezone du tournoi (ex: "16:00 à Madrid")
```

### Format de données
```ts
type ScheduleEntry = {
  player1Name: string;
  player2Name: string;
  tournamentName: string;
  /** Heure UTC ISO */
  scheduledAtUTC: string;
  /** Timezone IANA du tournoi (ex: "Europe/Madrid") */
  timezone: string;
  /** Heure locale au tournoi (pré-calculée pour affichage) */
  localTime: string;  // "16:00"
  source: "tennistemple" | "bsd" | "fallback";
};
```

### Affichage dans `match-card-header.tsx`
```tsx
// Avant : new Intl.DateTimeFormat(getDateLocaleTag(locale), { hour: ..., minute: ... })
//         → affiche dans la timezone du navigateur utilisateur

// Après : afficher dans la timezone du tournoi
new Intl.DateTimeFormat(getDateLocaleTag(locale), {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: match.timezone ?? undefined,  // ← timezone du tournoi
  timeZoneName: "short",
}).format(new Date(match.scheduledAt))
// Résultat : "16:00 CEST (à Madrid)" au lieu de "14:00 UTC"
```

## 6. Plan de migration progressif

| Phase | Changement | Risque | Rollback |
|---|---|---|---|
| P7.1 | Ajouter sous-onglets (sans casser liste actuelle) | Faible | Désactiver sous-onglets |
| P7.2 | Ajouter TournamentsList | Faible | Masquer sous-onglet Tournois |
| P8.1 | Ajouter search bars (sans pages cibles) | Faible | Masquer barre |
| P8.2 | Créer pages joueur/tournoi | Faible | 404 géré par Next |
| P9.1 | Scraper TT en parallèle (sans remplacer BSD) | Faible | Désactiver merger |
| P9.2 | Basculer affichage sur schedule TT | Moyen | Revenir à scheduledAt BSD |

**Principe** : chaque phase est réversible. On n'écrase jamais la source BSD sans
garde `fallback`.

## 7. Données existantes à exploiter

Vérifier dans `prisma/schema.prisma` :
- Table `players` : ~2194 joueurs ATP+WTA (slug, name, photoUrl, country, rank)
- Table `tournaments` : à vérifier (probablement à enrichir)
- Table `matches` : historique

Si `tournaments` n'existe pas, créer le model et le peupler depuis BSD.
