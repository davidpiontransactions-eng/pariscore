# Architecture — Refonte Tennis PariScore

> **Date** : 2026-07-20
> **Branche** : `refonte-tennis-v2`
> **Scope** : intégration des 10 nouveaux composants (Phases 1-3) dans
> `MatchCard` + refonte prematch (Phase 4). Ce doc définit **où** chaque
> composant se branche, **quand** il s'affiche, et **comment** les données
> circulent.

---

## 1. Vue d'ensemble — arbre de rendu de `MatchCard`

```
MatchCard (src/components/tennis/match-card.tsx)
├── MatchCardHeader
│   ├── [tournoi · round · date i18n]
│   └── [si isLive] → LiveHeaderScore cluster
│       ├── SetScoreline          ✅ Phase 1 (intégré)
│       ├── CurrentGameScore      ✅ Phase 1 (intégré)
│       └── ServerIndicator       ✅ Phase 1 (intégré)
│
├── Corps — carte duelle (PlayerBlock A | VS | PlayerBlock B)
│   ├── PlayerStatline (chaque côté)
│   │   ├── #rank · Elo · SPS ⓘ
│   │   ├── FormDots
│   │   └── [Phase 4] Tooltip SPS restauré (lazy mount)
│   ├── ProbabilityBar (toujours, terminalMode → avec IC bracket)
│   │   └── [Phase 4] fix tick bg-foreground + décomposition interactive
│   └── QuickAddRing / BestOddBadge
│
├── [si isLive] → blocs live (DANS CET ORDRE)
│   ├── LiveScoreBar (existant, ancien format) ← RETIRER en Phase 4 (doublon avec header)
│   ├── MomentumDR
│   │   └── ✅ Phase 3 polish (typo 11px, ARIA, clavier, 5 sets)
│   ├── WinProbabilityChart      🆕 Phase 3 (à intégrer en Phase 4)
│   ├── PointTimeline            🆕 Phase 3 (à intégrer en Phase 4)
│   └── LiveStatsPanel
│       ├── <Table> STAT_ROWS (aces/DF/total)
│       ├── ServeStatsBars       ✅ Phase 2 (intégré)
│       ├── BreakPointsGrid      ✅ Phase 2 (intégré)
│       └── SetBySetTable        ✅ Phase 2 (intégré)
│
├── [si isLive] → LiveScoreAnnouncer (sr-only)   🆕 Phase 3 (à intégrer)
│
├── [chipsCollapsed ?] → StatsIndicatorsGrid
│   └── [Phase 4] fusion avec match-card-detail (single source of truth)
│
├── MatchCardFooter (actions)
│
└── [si open] → MatchCardDetail
    └── [Phase 4] remplacer par StatsIndicatorsGrid unifié

MatchDetailDialog (modal, on demand)
├── Tabs: overview / h2h / form / odds
├── [Phase 4] next/image (fallback + ratio fixe)
├── [Phase 4] LastMatchesList (remplace BarChart binaire dans tab form)
├── [Phase 4] StatsRadarChart    🆕 Phase 3 (à intégrer dans tab overview/h2h)
└── ProbabilityBar / IC viz / Recharts H2H par surface (existants)
```

---

## 2. Règles de rendu conditionnel

| Composant | Prematch | Live | Synthetic (fake) | Source de données |
|---|---|---|---|---|
| `SetScoreline` | ❌ | ✅ | ❌ | `liveState.scoreA.sets` |
| `CurrentGameScore` | ❌ | ✅ | ❌ | `liveState.scoreA.points` |
| `ServerIndicator` | ❌ | ✅ | ❌ | `liveState.server` |
| `ProbabilityBar` | ✅ | ✅ | ❌ | `match.probA` ou `liveState.liveProbA` |
| `StatsIndicatorsGrid` | ✅ | ✅ | ❌ | `match.stats` |
| `MomentumDR` | ❌ | ✅ | ❌ | `useMomentumDR(liveState)` |
| `WinProbabilityChart` | ❌ | ✅ | ❌ | `liveState.liveProbA` (historique interne) |
| `PointTimeline` | ❌ | ✅ | ❌ | `useMomentumDR(liveState).pointHistory` |
| `LiveStatsPanel` | ❌ | ✅ | ❌ | `useTennisLiveStats(matchId)` |
| `LiveScoreAnnouncer` | ❌ | ✅ | ❌ | `liveState` (sr-only, diff) |
| `StatsRadarChart` | ✅ (dialog) | ✅ (dialog) | ❌ | `ServiceStats` (depuis `useTennisLiveStats` ou API) |
| `LastMatchesList` | ✅ (dialog) | ✅ (dialog) | ❌ | API player-stats (à créer/étendre) |

**Règle synthetic** : les cartes "Live" sans prematch ID n'ont pas de données
fiables → on cache TOUS les composants prédictifs et on garde juste le badge
"synthetic" (`match.synthetic === true`).

---

## 3. Data flow

```
BSD Live API (https://api.bsd.tools/v2/matches/live/)
  ↓ (polled par /api/tennis/live, cache 30s)
LiveMatchResponseItem (setsDetail, currentGame, currentPoint, server, liveProbA)
  ↓ (use-live-matches.ts mappe vers LiveMatchState)
LiveMatchState { scoreA, scoreB, server, liveProbA, currentSet }
  ↓
  ├── MatchCardHeader (lit directement liveState)
  ├── useMomentumDR(liveState) → MomentumDRResult { pointHistory, drHistory, dr }
  │     ↓
  │     ├── MomentumDR (sparkline)
  │     ├── PointTimeline (filtre pointHistory par set+game)
  │     └── WinProbabilityChart (historique interne via liveProbA)
  └── useTennisLiveStats(matchId) → TennisLiveStats
        ↓
        ├── ServeStatsBars
        ├── BreakPointsGrid
        ├── SetBySetTable
        └── StatsRadarChart

API player-stats (route /api/tennis/player-stats)
  ↓
usePlayerStats(names, surface) → PlayerStatsMap
  ↓
  ├── PlayerStatline (rang, Elo surface, SPS)
  └── [Phase 4] LastMatchesList (à étendre — ajouter endpoint last-matches)
```

---

## 4. Performance — points d'attention

| Risque | Mitigation |
|---|---|
| Recharts lourd (Radar, WinProb) sur chaque carte live | **Lazy load** via `React.lazy` + `Suspense` (déjà fait pour MatchDetailDialog) |
| `useMomentumDR` re-compute à chaque tick | `useMemo` sur `pointHistory` (déjà dans le hook) |
| Multiplication des abonnements SSE | 1 seul hook `useLiveMatches` global, `liveStates[matchId]` lookup |
| Layout shift au passage prematch → live | `LiveHeaderScore` a une hauteur fixe réservée |
| i18n loading | Les clés tennis sont déjà dans le bundle principal (pas de async) |
| Images joueurs | `next/image` avec `fallback` + ratio fixe (Phase 4) |

---

## 5. Stratégie d'intégration progressive

**Principe** : chaque phase ajoute des composants SANS casser l'existant.
Si un composant nouvelle génération n'a pas ses données, il ne s'affiche pas
(garde conditionnelle `if (data)`).

### Phase 4 — Ordre d'intégration

1. **Retirer `LiveScoreBar`** de `match-card.tsx` (l.411-418) — désormais
   redondant avec `LiveHeaderScore` du header (SetScoreline +
   CurrentGameScore + ServerIndicator font le même boulot, mieux).
2. **Intégrer Phase 3 dans match-card.tsx** :
   - `WinProbabilityChart` après `MomentumDR`
   - `PointTimeline` après `WinProbabilityChart` (utilisent le même hook)
   - `LiveScoreAnnouncer` à la fin (sr-only)
3. **Intégrer StatsRadarChart dans MatchDetailDialog** (tab overview, à côté
   de la proba ring).
4. **Créer LastMatchesList** + l'intégrer dans MatchDetailDialog tab "form"
   (remplace le BarChart binaire).
5. **Refactors** : next/image, fusion StatsIndicatorsGrid, tooltip SPS,
   fixes a11y probability-bar / odds-comparator.

### Phase 5 — Validation

- `impeccable polish` pass final
- `hallmark` audit (anti-AI-slop)
- `visual-regression` screenshots avant/après
- `fec-accessibility-testing` axe-core
- Tests Playwright pérennes `tests/tennis-refactor.spec.ts`
- i18n cleanup complet
- `lighthouse` Core Web Vitals (LCP/INP/CLS)

### Phase 6 — Déploiement

- `bun run build` + `node --check` sur inline scripts
- Deploy VPS : `git pull && bun install && bun run build && pm2 restart pariscore-next`
- Vérif prod (0 pageerror, scores visibles)
- `bd close` tickets + `bd remember` décisions + `CHANGELOG.md`

---

## 6. Inventory des composants après refonte

| Statut | Composant | Lignes | Phase |
|---|---|---|---|
| ✅ Intégré | SetScoreline | 83 | P1 |
| ✅ Intégré | CurrentGameScore | 50 | P1 |
| ✅ Intégré | ServerIndicator | 48 | P1 |
| ✅ Intégré (LiveStatsPanel) | ServeStatsBars | 229 | P2 |
| ✅ Intégré (LiveStatsPanel) | BreakPointsGrid | 289 | P2 |
| ✅ Intégré (LiveStatsPanel) | SetBySetTable | 218 | P2 |
| 🟡 À intégrer | WinProbabilityChart | 204 | P3→P4 |
| 🟡 À intégrer | PointTimeline | 148 | P3→P4 |
| 🟡 À intégrer | StatsRadarChart | 311 | P3→P4 (dialog) |
| 🟡 À intégrer | LiveScoreAnnouncer | 344 | P3→P4 |
| ⏳ À créer | LastMatchesList | ~150 | P4 |
| 🔧 À refactorer | match-card-detail + stats-indicators-grid | fusion | P4 |
| 🔧 À migrer | match-detail-dialog (next/image) | modifs | P4 |
| 🔧 À fixer | probability-bar + odds-comparator (a11y) | modifs | P4 |
| 🔧 À restaurer | player-statline tooltip SPS | modifs | P4 |

**Total final attendu** : 14 composants tennis actifs (vs 6 avant refonte).
