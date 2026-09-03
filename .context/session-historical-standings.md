# Session: Enrichissement Classement Dom/Ext avec Saisons Historiques

**Date**: 2026-08-27
**Bead**: En cours (feature request)
**Scope**: Enrichir les standingStats (Domicile/Extérieur) des matchs prematch football en début de saison, en combinant les données de la saison courante (N) avec la saison précédente (N-1).

## Problème

En début de saison (Août 2026), la saison courante a trop peu de matchs joués (< 3 en dom ou ext) → `partial: true` → les classements Dom/Ext sont peu fiables. Les prédictions qui utilisent `standingStats.home.ppg` ou `standingStats.away.ppg` sont bruitées.

## Solution

Enrichissement avec les standings historiques (saison N-1) via **soccerstats.com** :
- URL pattern : `homeaway.asp?league={slug}_{year}` (ex: `england_2026` = saison 2025/26)
- Parsing HTML des tables "Home table" / "Away table"
- Blend pondéré : plus la saison courante a de matchs, moins l'historique pèse
- Cache 24h (données statiques saison terminée)

## Fichiers Modifiés

| Fichier | Action |
|---------|--------|
| `src/lib/football-historical-standings.ts` | **NOUVEAU** — Module complet (fetch + parse + blend + cache) |
| `src/lib/bsd-football-fetcher.ts` | Import + intégration blend dans `fetchBSDLeagueData()` |
| `src/lib/football-data.ts` | Ajout `historicalSeason?: string` à `StandingContext` |
| `src/components/football/football-match-card.tsx` | Indicateur UI "Stats enrichies avec saison N-1" |

## Architecture

```
football-historical-standings.ts
├── LEAGUE_SST_MAP          — Mapping PariScore slug → soccerstats slug + year
├── fetchHistoricalStandings()  — Fetch + cache 24h + parse HTML
├── parseHomeAwayHtml()      — Extraction regex tables Home/Away
├── blendWithHistorical()    — Blend pondéré current + historical
└── computeWeights()         — Courbe exponentielle (k=0.25)

bsd-football-fetcher.ts
├── fetchBSDLeagueData()     — Ajout: if (partial) → fetchHistorical → blend
└── attachDerivedData()      — Ajout: historicalSeason → StandingContext
```

## Algorithme de Blend

### Poids
```
currentWeight = min(1, 1 - e^(-0.25 * currentPlayed))
historicalWeight = 1 - currentWeight
```

| Matchs courants | Poids courant | Poids historique |
|----------------|---------------|------------------|
| 0 | 0% | 100% |
| 1 | 22% | 78% |
| 2 | 39% | 61% |
| 3 | 53% | 47% |
| 5 | 71% | 29% |
| 10 | 92% | 8% |
| 15+ | 100% | 0% (abandon) |

### Virtual Historical Played (L5 Rolling Window)
```
virtualHistoricalPlayed = max(0, min(5 - currentPlayed, 5))
```
- 0 matchs courants → 5 matchs historiques
- 2 matchs courants → 3 matchs historiques
- 5+ matchs courants → 0 (pas d'historique)

### Blend Formule
```
blended = (currentWeight * current + historicalWeight * historical * (vhp / historical.played))
```
Où `vhp` = nombre de matchs virtuels historiques pour atteindre le L5.

## Ligues Supportées

| PariScore slug | soccerstats slug | Saison hist. |
|---------------|------------------|--------------|
| epl | england_2026 | 2025/26 ✓ |
| laliga | spain_2026 | 2025/26 ✓ |
| ligue1 | france_2026 | 2025/26 ✓ |
| bundesliga | germany_2026 | 2025/26 ✓ |
| seriea | italy_2026 | 2025/26 ✓ |
| primeira_liga | portugal_2026 | 2025/26 ✓ |
| eredivisie | netherlands_2026 | 2025/26 ✓ |
| championship | england2_2026 | 2025/26 ✓ |
| laliga2 | spain2_2026 | 2025/26 ✓ |
| ligue2 | france2_2026 | 2025/26 ✓ |
| super_lig | turkey_2026 | 2025/26 ✓ |
| scot_prem | scotland_2026 | 2025/26 ✓ |
| super_league_swiss | switzerland_2026 | 2025/26 ✓ |
| liga_1_romania | romania_2026 | 2025/26 ✓ |
| argentina_primera | argentina2_2026 | 2025/26 ✓ |
| saudi_pro_league | saudiarabia_2026 | 2025/26 ✓ |
| allsvenskan | — | Non dispo |
| superleague_greece | — | Non dispo |
| jupiler | — | Non dispo |
| j1_league | — | Non dispo |
| k_league1 | — | Non dispo |

## UI Indicateur

Dans `football-match-card.tsx`, section "Classement (Dom / Ext)":
- Si `standing.historicalSeason` existe → affiche "Stats enrichies avec saison 2025/26 (début de saison — données combinées)"
- Sinon si `partial` → affiche "Données partielles — championnat en début de saison (< 3 matchs)"

## Type Modifications

```typescript
// football-data.ts
export type StandingContext = {
  home: TeamStandingStats;
  away: TeamStandingStats;
  historicalSeason?: string;  // AJOUTÉ
};

// bsd-football-fetcher.ts
type LeagueDerivedData = {
  teams: Map<string, TeamDerived>;
  rankings: MetricRankings;
  partial: boolean;
  historicalSeason?: string;  // AJOUTÉ
};
```

## Validation

- [x] TypeScript: 0 erreurs dans les fichiers modifiés
- [x] ESLint: 0 erreurs dans les fichiers modifiés
- [x] soccerstats URL pattern vérifié: `england_2026` retourne les tables Home/Away 2025/26
- [x] HTML parser: fix regex `<h2>Home table</h2>` pour matcher le vrai tag (pas le `<title>`)
- [x] FlareSolverr fallback: ajouté pour VPS (Cloudflare WAF bloque datacenter IPs)
- [x] Test live VPS: 25/100 matchs avec `historicalSeason: "2025/26"` — blend actif
- [x] Deploy: `d7e3b4f7` + `b248e712` + `be71af17` + `7aaf5eb8` → VPS OK
- [x] Team name overrides: étendu pour Saudi (Al-Hilal, Al-Nassr, etc.), Ligue 2, Serie A, Turkey, Argentina
- [ ] Quelques écarts restants: Neom SC, Abha (沙特), Real Racing Club (La Liga — équipe La Liga 2, pas en table L1)

## Issues Connus

1. **Ligues non couvertes**: `allsvenskan`, `superleague_greece`, `jupiler`, `j1_league`, `k_league1` — pas de données historiques soccerstats.
2. **Équipes hors tableau**: Les équipes promues/descendues (ex: Racing Santander en L2) n'apparaissent pas dans le tableau L1 de la saison précédente → 0gp (comportement attendu).

## Prochaines Étapes

1. **Team name normalization**: Étendre `TEAM_NAME_OVERRIDES` dans `football-historical-standings.ts` pour les ligues Saudi/Argentina
2. **Monitor**: Vérifier les logs `[hist-stand]` pour détecter les échecs de matching
3. **Future**: Étendre à d'autres sources (football-data.org, OddAlerts league_stats) si soccerstats ne couvre pas certaines ligues
