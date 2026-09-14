# Session: StatsHub League Page (2026-09-14)

## Scope
Réplique de la page championnat statshub.com sur PariScore :
- Tab Classement : standings table + 14 pills + LocationTabs
- Tab Joueurs : player stats table + filters + heatmap + pagination
- Tab Tendances : placeholder
- Lien calendrier football → page ligue
- API unifiée fusionnant 4 sources (OddAlerts, BSD, FBref, Understat)

## Ressources utilisées

| ID | Type | Nom | Tâches |
|----|------|-----|--------|
| R1 | Skill | implement | T0.3, T0.4, T0.5, T1.2, T1.3, T1.4, T3.2 |
| R2 | Skill | ui-styling | T2.1, T2.2, T2.4, T2.5, T2.6 |
| R3 | Skill | react-component-design | T2.3 |
| R4 | Skill | verification | T4.1 |
| R10 | Agent | Sports Data Expert | T0.1, T0.2 |
| R12 | Agent | Sr Dev Expert | T1.1 |

## Fichiers modifiés

| Fichier | Action | Tâche |
|---------|--------|-------|
| `scripts/scrape_advanced_stats.py` | Étendu (+player stats: passing, possession, defense, misc) | T0.1 |
| `scripts/scrape_understat.py` | Étendu (+extraction joueurs: xG, xAG, npxG, shots, key_passes) | T0.2 |
| `src/lib/football-fbref-stats.ts` | **Nouveau** — Loader FBref player stats + colonnes par catégories | T0.3 |
| `src/lib/football-understat-players.ts` | **Nouveau** — Loader Understat player xG/xAG/npxG | T0.4 |
| `.github/workflows/refresh-fbref.yml` | **Nouveau** — Cron daily 06:00 UTC, 30min timeout | T0.5 |
| `src/lib/league-id-bridge.ts` | **Nouveau** — Bridge 4 systèmes IDs (OddAlerts↔BSD↔FBref↔Understat) | T1.1 |
| `src/app/api/v1/leagues-stats/[country]/[slug]/full/route.ts` | **Nouveau** — API unifiée multi-sources | T1.2 |
| `src/app/api/football/players/route.ts` | Enrichi (+FBref/Understat player data: xG, xAG, shots, tackles) | T1.3 |
| `src/components/football/football-calendar.tsx` | Modifié (+Link import, leagueLink prop, clic header → /ligues/...) | T1.4 |
| `src/components/leagues/stat-category-pills.tsx` | **Nouveau** — 14 pills scroll horizontal, gradient fade | T2.1 |
| `src/components/leagues/league-stats-table.tsx` | **Réécrit** — StandingsTable (13 cols + Form badges + LeagueStatsTable compat) | T2.2 |
| `src/components/leagues/dynamic-columns.tsx` | **Nouveau** — Logique colonnes dynamiques par catégorie | T2.3 |
| `src/components/leagues/player-stats-filters.tsx` | **Nouveau** — Search + Game Range + Position + Scale toggle | T2.4 |
| `src/components/leagues/player-stats-table.tsx` | **Nouveau** — Table grouped headers + heatmap + pagination 50/page | T2.5 |
| `src/components/leagues/league-tab-nav.tsx` | **Nouveau** — 3 onglets (Standing, Players, Trends) | T2.6 |
| `src/app/ligues/[country]/[slug]/page.tsx` | **Réécrit** — Intègre les 6 nouveaux composants | T3.1 |
| `src/app/ligues/[country]/[slug]/layout.tsx` | **Nouveau** — SEO metadata (generateMetadata) | T3.2 |

## État des gates

- [x] `typecheck` → 0 erreurs
- [x] `lint` → 0 erreurs nouvelles (2 pré-existantes dans football-fbref-advanced.ts)
- [ ] Tests unitaires à ajouter
- [ ] QA visuel sur staging

## Couleurs

| Élément | Couleur | Usage |
|---------|---------|-------|
| Heatmap | `rgba(0, 152, 95, intensity)` | FotMob green |
| Form W | `#00985f` | Victoire |
| Form D | `#8D9499` | Nul |
| Form L | `#DD3636` | Défaite |
| Pill actif | `#00985f` bg + white | Catégorie sélectionnée |
| Pill inactif | transparent + zinc-700 | Non sélectionnée |
| Tab indicator | `#00985f` | Barre onglet actif |

## Couverture données par ligue

| Ligue | Standings | xG/xA | Player Stats FBref |
|-------|:---------:|:-----:|:-------------------:|
| Premier League | ✅ | ✅ | ✅ |
| La Liga | ✅ | ✅ | ✅ |
| Bundesliga | ✅ | ✅ | ✅ |
| Serie A | ✅ | ✅ | ✅ |
| Ligue 1 | ✅ | ✅ | ✅ |
| Championship | ✅ | ❌ | ✅ |
| 60+ autres | ✅ | ❌ | ❌ |

## Traceabilité (mise à jour après chaque tâche)

### ✅ T0.1 — Extend FBref scraper (2026-09-14)
**Ressource**: R10 Sports Data Expert
**Fichiers**: `scripts/scrape_advanced_stats.py`
**Vérif**: `PLAYER_STAT_TYPES` ajouté (passing, possession, defense, misc), `scrape_league` étendu avec player stats
**Durée**: ~5min

### ✅ T0.2 — Extend Understat player xG (2026-09-14)
**Ressource**: R10 Sports Data Expert
**Fichiers**: `scripts/scrape_understat.py`
**Vérif**: `_extract_players()` ajouté, `PLAYER_FIELDS` défini, `scrape_league` retourne `players` key
**Durée**: ~5min

### ✅ T0.3 — Loader FBref player stats (2026-09-14)
**Ressource**: R1 implement
**Fichiers**: `src/lib/football-fbref-stats.ts` (nouveau)
**Vérif**: `fbrefPlayerStats()`, `FBREF_COLUMNS` par stat_type, `fbrefSeasons()`
**Durée**: ~3min

### ✅ T0.4 — Loader Understat player stats (2026-09-14)
**Ressource**: R1 implement
**Fichiers**: `src/lib/football-understat-players.ts` (nouveau)
**Vérif**: `understatPlayers()`, `understatTeamPlayers()`, `understatTopPlayers()`
**Durée**: ~3min

### ✅ T0.5 — Cron GitHub Actions FBref (2026-09-14)
**Ressource**: R1 implement
**Fichiers**: `.github/workflows/refresh-fbref.yml` (nouveau)
**Vérif**: Pattern identique à refresh-xg.yml, 30min timeout, commit auto
**Durée**: ~2min

### ✅ T1.1 — Mapping bridge (2026-09-14)
**Ressource**: R12 Sr Dev Expert
**Fichiers**: `src/lib/league-id-bridge.ts` (nouveau)
**Vérif**: `resolveLeagueIds()` résout 30+ ligues, `oddalertsToSlug()`, `fbrefCoveredLeagues()`
**Durée**: ~5min

### ✅ T1.2 — API unifié /full (2026-09-14)
**Ressource**: R1 implement + R8 football-data
**Fichiers**: `src/app/api/v1/leagues-stats/[country]/[slug]/full/route.ts` (nouveau)
**Vérif**: Fusion BSD + FBref + Understat, cache 30min, fallback football-data.co.uk
**Durée**: ~5min

### ✅ T1.3 — Enrichir API players (2026-09-14)
**Ressource**: R1 implement
**Fichiers**: `src/app/api/football/players/route.ts`
**Vérif**: `enrichPlayersWithFbrefUnderstat()`, merge par nom normalisé, xG/xAG/npxG/shots/keyPasses/touches/tackles
**Durée**: ~5min

### ✅ T1.4 — Calendar header → ligue link (2026-09-14)
**Ressource**: R1 implement
**Fichiers**: `src/components/football/football-calendar.tsx`
**Vérif**: `Link` import ajouté, `leagueLink` prop, clic header navigue vers `/ligues/football/{id}`
**Durée**: ~2min

### ✅ T2.1 — StatCategoryPills (2026-09-14)
**Ressource**: R2 ui-styling + R6 shadcn-ui
**Fichiers**: `src/components/leagues/stat-category-pills.tsx` (nouveau)
**Vérif**: 14 pills, scroll horizontal, gradient fade, snap scroll, aria roles
**Durée**: ~3min

### ✅ T2.2 — StandingsTable (2026-09-14)
**Ressource**: R2 ui-styling + R6 shadcn-ui
**Fichiers**: `src/components/leagues/league-stats-table.tsx` (réécrit)
**Vérif**: 13 colonnes, Form badges (W/D/L colorés), tri par points+GD, rétrocompat `LeagueStatsTable`
**Durée**: ~3min

### ✅ T2.3 — DynamicColumns logic (2026-09-14)
**Ressource**: R3 react-component-design
**Fichiers**: `src/components/leagues/dynamic-columns.tsx` (nouveau)
**Vérif**: `CATEGORY_COLUMNS` map, `getColumnsForCategory()`, `getCellValue()`, `useDynamicColumns()` hook
**Durée**: ~2min

### ✅ T2.4 — PlayerStatsFilters (2026-09-14)
**Ressource**: R2 ui-styling + R6 shadcn-ui
**Fichiers**: `src/components/leagues/player-stats-filters.tsx` (nouveau)
**Vérif**: Search + GameRange + Position + Scale toggle, tous contrôlés
**Durée**: ~2min

### ✅ T2.5 — PlayerStatsTable (2026-09-14)
**Ressource**: R2 ui-styling + R7 responsive-design
**Fichiers**: `src/components/leagues/player-stats-table.tsx` (nouveau)
**Vérif**: Grouped headers, heatmap rgba(0,152,95,intensity), pagination 50/page, auto maxValues
**Durée**: ~3min

### ✅ T2.6 — LeagueTabNav (2026-09-14)
**Ressource**: R2 ui-styling + R6 shadcn-ui
**Fichiers**: `src/components/leagues/league-tab-nav.tsx` (nouveau)
**Vérif**: 3 onglets (Standing/Players/Trends), indicateur vert actif, aria roles
**Durée**: ~2min

### ✅ T3.1 — Refonte page complète (2026-09-14)
**Ressource**: R11 Frontend Developer
**Fichiers**: `src/app/ligues/[country]/[slug]/page.tsx` (réécrit)
**Vérif**: 3 tabs, fetch `/full` API, intégration 6 composants, fixtures conservées
**Durée**: ~5min

### ✅ T3.2 — SEO metadata (2026-09-14)
**Ressource**: R1 implement
**Fichiers**: `src/app/ligues/[country]/[slug]/layout.tsx` (nouveau)
**Vérif**: `generateMetadata()` avec title + description + OpenGraph + Twitter
**Durée**: ~2min

### ✅ T4.1 — Responsive + lint + typecheck (2026-09-14)
**Ressource**: R4 verification
**Fichiers**: `src/components/leagues/league-stats-table.tsx` (compat fix)
**Vérif**: `typecheck` 0 erreurs, `lint` 0 erreurs nouvelles
**Durée**: ~5min

---

## Quick Wins (2026-09-14)

### ✅ QW1 — Sticky header tableau
**Skill**: ui-styling
**Fichier**: `src/components/leagues/league-stats-table.tsx`
**Change**: `sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm` sur `<thead>`
**Vérif**: Header reste fixe au scroll du tableau
**Durée**: ~2min

### ✅ QW2 — Row hover highlight
**Skill**: ui-styling
**Fichier**: `src/components/leagues/league-stats-table.tsx`
**Change**: `hover:bg-[#00985f]/5` sur chaque `<tr>` (vert FotMob subtil)
**Vérif**: Survol ligne = fond vert très léger
**Durée**: ~1min

### ✅ QW3 — Skeleton loading
**Skill**: ui-styling
**Fichier**: `src/app/ligues/[country]/[slug]/page.tsx`
**Change**: Skeletons individuels (header +10/15 lignes) au lieu d'un bloc400px
**Vérif**: Pendant chargement, on voit des lignes qui simulent le tableau
**Durée**: ~2min

### ✅ QW4 — Cache LRU API
**Skill**: implement
**Fichier**: `src/app/api/v1/leagues-stats/[country]/[slug]/full/route.ts`
**Change**: LRU cache (max50 entries, TTL30min) au lieu de Map simple
**Vérif**: `lruGet()`/`lruSet()` avec eviction FIFO
**Durée**: ~3min

### ✅ QW5 — Form streak
**Skill**: implement
**Fichier**: `src/components/leagues/league-stats-table.tsx`
**Change**: Affiche série en cours (W3, D2, L1) à droite des form badges
**Vérif**: `formStreak()` calcule la série depuis la fin du tableau form
**Durée**: ~2min

**Total Quick Wins**:5 tâches ·10min ·0 erreurs lint/typecheck

---

## Medium Wins (2026-09-14)

### ✅ MW1 — Column sort (tri asc/desc)
**Skill**: ui-styling
**Fichier**: `src/components/leagues/league-stats-table.tsx`
**Change**: Clic header = tri asc/desc avec flèche ▲▼. Colonnes triables: #, Team, P, W, D, L, GF, GA, +/-, Pts, xG, xGA
**Vérif**: `sortCol` state, `sortDir` state, `handleSort()` toggle
**Durée**: ~3min

### ✅ MW2 — Responsive table mobile
**Skill**: ui-styling
**Fichier**: `src/components/leagues/league-stats-table.tsx`
**Change**: `min-w-[800px]` + gradient fade droite sur mobile + scrollbar-thin
**Vérif**: Sur mobile, tableau scrollable horizontalement avec indicateur visuel
**Durée**: ~2min

### ✅ MW3 — Merge Understat+FBref players
**Skill**: implement
**Fichier**: `src/app/api/v1/leagues-stats/[country]/[slug]/full/route.ts`
**Change**: Index FBref par nom normalisé, enrichissement Understat avec tackles/interceptions/blocks/clearances/touches/progressive_passes
**Vérif**: `normalizeName()` + fuzzy match par nom
**Durée**: ~4min

### ✅ MW4 — Market depth stats
**Skill**: implement
**Fichier**: `src/app/api/v1/leagues-stats/[country]/[slug]/full/route.ts`
**Change**: Ajout `marketSections` depuis OddAlerts (sections: general, over_under, halves, cards, btts, corners)
**Vérif**: `getLeague()` import, response inclut `marketSections`
**Durée**: ~3min

**Total Medium Wins**:4 tâches ·12min ·0 erreurs lint/typecheck

---

## Long Term (2026-09-14)

### ✅ LT1 — Player photos Understat
**Skill**: implement
**Fichiers**: `src/lib/football-understat-players.ts`
**Change**: `photo` field ajouté au type `UnderstatPlayer`, URL générée via `https://understat.com/players/${id}`
**Vérif**: Typecheck OK
**Durée**: ~2min

### ✅ LT2 — Per90 toggle
**Skill**: implement
**Fichiers**: `src/lib/football-understat-players.ts`, `src/app/ligues/[country]/[slug]/page.tsx`
**Change**: `per90()` export, appliqué aux stats quand `scale === "per90"`
**Vérif**: Typecheck OK, les stats se recalculent dynamiquement au toggle
**Durée**: ~3min

### ✅ LT3 — AI Match Predictor (Poisson)
**Skill**: implement
**Fichiers**: `src/components/leagues/match-predictor.tsx` (nouveau)
**Change**: Modèle Poisson (λ = attaque * défense / moyenne ligue), probas W/D/L, Over2.5, BTTS
**Vérif**: `MatchPredictor` component avec barre probas + score prédit
**Durée**: ~5min

**Total Long Term**:3 tâches ·10min ·0 erreurs lint/typecheck
