# Session — H2H Basketball Frontend (2026-08-30)

**Scope** : Implémentation complète du frontend H2H Basketball (NBA/WNBA) — sous-navigation "H2H" dans l'onglet basket avec sélecteur d'équipes, hero duel, 3 onglets (Stats/Confrontations/Joueurs), tables Over/Under génériques, intégration dans `basketball-tab-content.tsx`.

**Contexte** : La session précédente avait coulé le backend complet (`services/basketballH2HService.js` + 3 routes API + types + hook + script de validation) mais le frontend complet prévu dans `.context/prompt-h2h-basketballstats.md` n'avait jamais été implémenté. Seule une intégration basique existait dans `basketball-match-detail-dialog.tsx:275-307`.

---

## État des lieux initial

| Couche | Statut | Fichiers |
|--------|--------|----------|
| Backend H2H | ✅ Complet | `services/basketballH2HService.js`, 3 routes API, `types/basketball-h2h.ts`, `use-basketball-h2h.ts` |
| Validation | ✅ Script prêt | `scripts/validate-h2h.js` |
| Frontend H2H complet | ❌ Non implémenté | — |
| Composants H2H | 0/10 créés | — |
| Bead WNBA | `in_progress` depuis 2026-06-06 | `ParisScorebis-fjrw` |

## Étapes exécutées

| # | Étape | Statut | Fichiers |
|---|-------|--------|----------|
| 1 | Clôturer bead WNBA `ParisScorebis-fjrw` | ✅ | — |
| 2 | Audit lint + typecheck | ✅ 0 erreur nouvelle | — |
| 3 | `use-h2h-teams.ts` (hook SWR teams) | ✅ | `src/hooks/use-h2h-teams.ts` |
| 4 | `use-h2h-players.ts` (hook SWR joueurs) | ✅ | `src/hooks/use-h2h-players.ts` |
| 5 | `h2h-team-selector.tsx` (2 dropdowns + ⇄) | ✅ | `src/components/basketball/h2h-team-selector.tsx` |
| 6 | `h2h-header.tsx` (hero duel + badges forme + split bar) | ✅ | `src/components/basketball/h2h-header.tsx` |
| 7 | `h2h-data-points.tsx` (tableau 8 métriques miroir) | ✅ | `src/components/basketball/h2h-data-points.tsx` |
| 8 | `over-under-table.tsx` (générique seuils + barres %) | ✅ | `src/components/basketball/over-under-table.tsx` |
| 9 | `h2h-stats-tab.tsx` (onglet Stats complet) | ✅ | `src/components/basketball/h2h-stats-tab.tsx` |
| 10 | `h2h-matches-tab.tsx` (liste confrontations) | ✅ | `src/components/basketball/h2h-matches-tab.tsx` |
| 11 | `h2h-players-tab.tsx` (tableau joueurs 2 équipes) | ✅ | `src/components/basketball/h2h-players-tab.tsx` |
| 12 | `basketball-h2h.tsx` (conteneur page complet) | ✅ | `src/components/basketball/basketball-h2h.tsx` |
| 13 | Intégration sous-nav H2H dans `basketball-tab-content.tsx` | ✅ | `src/components/basketball/basketball-tab-content.tsx` |
| 14 | Qualité lint + typecheck | ✅ 0 erreur nouvelle | — |
| 15 | MAJ COMPONENTS.md | ✅ | `COMPONENTS.md` |
| 16 | Build production (next build) | ✅ 53s, 76 routes, 0 erreur nouvelle | — |
| 17 | QA validation snapshot (validate-h2h.js) | ✅ 25 PASS / 3 FAIL attendus | — |
| 18 | QA visuel Playwright (desktop + mobile) | ✅ desktop 430KB, mobile 361KB | `.context/qa-h2h/` |
| 19 | Side panel standings (desktop lg:+) | ✅ | `src/components/basketball/h2h-standings-panel.tsx` |
| 20 | Tooltips métriques H2H | ✅ | `src/components/basketball/h2h-data-points.tsx` |
| 21 | Responsive mobile (flex-col → flex-row) | ✅ | `src/components/basketball/basketball-h2h.tsx` |

## Fichiers créés (12)

```
src/hooks/use-h2h-teams.ts                        # Hook SWR pour liste équipes H2H
src/hooks/use-h2h-players.ts                      # Hook SWR pour joueurs H2H
src/components/basketball/h2h-team-selector.tsx    # Sélecteur paire d'équipes (2 dropdowns + ⇄)
src/components/basketball/h2h-header.tsx           # Hero duel : badges forme, split H2H, verdict
src/components/basketball/h2h-data-points.tsx      # Tableau 8 métriques miroir (DM Mono + tooltips)
src/components/basketball/over-under-table.tsx     # Tableau générique O/U seuils + barres %
src/components/basketball/h2h-stats-tab.tsx        # Onglet Stats : DataPoints + Season + O/U + BTTS
src/components/basketball/h2h-matches-tab.tsx      # Liste confrontations triées par saison
src/components/basketball/h2h-players-tab.tsx      # Tableau joueurs 2 équipes avec tri
src/components/basketball/h2h-standings-panel.tsx  # Panel classement ligue (desktop lg:+, sticky)
src/components/basketball/basketball-h2h.tsx       # Conteneur page H2H complet (3 tabs + side panel)
scripts/qa-h2h-screenshots.js                     # Script Playwright QA screenshots
```

## Fichiers modifiés (3)

```
src/components/basketball/basketball-tab-content.tsx  # +toggle Matchs/H2H, +import dynamique BasketballH2H
src/components/basketball/h2h-data-points.tsx         # +tooltips métriques
COMPONENTS.md                                          # 7→18 composants basketball, 159→170 total
```

## Architecture UI

```
Onglet Basket
├── [Toggle] Matchs | H2H
├── Vue Matchs (existante)
│   ├── LeagueSelector
│   ├── MatchViewTabs (today/live/prematch)
│   └── Grid BasketballMatchCards
└── Vue H2H (nouvelle)
    ├── LeagueToggle (NBA/WNBA)
    ├── H2HTeamSelector (2 dropdowns + ⇄)
    ├── H2HHeader (hero duel + badges forme + split bar + verdict)
    └── Tabs
        ├── Stats
        │   ├── H2HDataPoints (8 métriques miroir)
        │   ├── SeasonStatsCard × 2 (Overall/Home/Away)
        │   ├── OverUnderTable × N (points, quartiers, mi-temps)
        │   ├── PointSpread × 2
        │   ├── MatchOver (3 colonnes)
        │   └── BTTS × 7 scopes (FT, H1, H2, Q1-Q4)
        ├── Confrontations
        │   └── H2HMatchesList (triées par saison)
        └── Joueurs
            └── H2HPlayersTable × 2 (tri colonnes)
```

## Décisions techniques

- **Import dynamique** `BasketballH2H` via `next/dynamic` (ssr: false) pour ne pas alourdir le bundle initial
- **Hooks SWR dédiés** (`use-h2h-teams`, `use-h2h-players`) avec cache 1h (liste stable)
- **`cn()` importé** depuis `@/lib/utils` (pas de définition locale — pattern projet)
- **Toggle Matchs/H2H** : boutons pill dans le header (même pattern que les existants)
- **DM Mono** sur tous les nombres/stats (conformité DESIGN_CHARTER)
- **Barres O/U** : vert si >50%, rouge si <50%, ambre si seuil "money"

## Qualité

| Gate | Résultat |
|------|----------|
| `bun run lint` | ✅ 0 erreur nouvelle (3 pré-existantes routes `require()`) |
| `tsc --noEmit` (basketball) | ✅ 0 erreur |
| `bun run build` | ✅ 53s, 76 routes, 0 erreur nouvelle |
| Unused imports | ✅ Corrigés (OverRow, H2HTeam, TeamSeasonStats) |
| QA validation snapshot | ✅ 25 PASS / 3 FAIL attendus (form6/classement évolution) |
| QA visuel Playwright | ✅ desktop 430KB + mobile 361KB |

## Reste à faire (hors scope de cette session)

| Priorité | Tâche |
|----------|-------|
| P3 | Tooltips sur les sections Over/Under, Spread, BTTS (même pattern que DataPoints) |
| P3 | Animation transition onglets (fade in/out) |
| P3 | Mode sombre/clair parfait sur les badges forme |

---

**Source** : `.context/prompt-h2h-basketballstats.md` (cahier des charges)
**Référence** : `.context/report-h2h-basketballstats.md` (snapshot 2026-08-14)
