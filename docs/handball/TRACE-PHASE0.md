# Traceabilité — Phase 0 : Fondation Handball

**Date**: 2026-09-16
**Durée estimée**: 45 min

---

## Phase 0.1 — Types HandballMatch + HandballLeague

**Skill utilisée**: `general` (subagent)
**Fichier créé**: `src/lib/handball-data.ts`

### Types exportés
- `HandballLeague` — id, name, country, countryCode, logo, season
- `HandballTeam` — id, name, shortName, logo
- `HandballScore` — home, away, homeHalf, awayHalf
- `HandballMatchStatus` — not_started | live | halftime | finished | postponed | cancelled
- `HandballMatch` — match complet avec league, home/away, kickoff, status, score, minute, odds, stats

### Vérification
- `bun run typecheck` : ✅ 0 erreurs

---

## Phase 0.2 — Enregistrement "handball" dans les systèmes de sport

**Skill utilisée**: `general` (subagent)
**Fichiers modifiés**:

| Fichier | Modification |
|---------|-------------|
| `src/types/sports-sidebar.ts` | `| "handball"` ajouté à `SportTabId` |
| `src/lib/top-matches/types.ts` | `| "handball"` ajouté à `SportType` + `"handball"` ajouté à `SPORT_TYPES[]` + `LIVE_STATUS_PATTERNS` |
| `src/lib/match-view.ts` | Filtres `over55`/`under62` ajoutés à `StrategyFilter` + labels + `STRATEGY_FILTERS_BY_SPORT.handball` |
| `src/lib/sports-tree.ts` | `handball: { name: "Handball", icon: "Circle" }` ajouté à `SPORT_META` |

### Vérification
- `bun run typecheck` : ✅ 0 erreurs

---

## Fichiers impactés (Phase 0)

| Fichier | Statut |
|---------|--------|
| `src/lib/handball-data.ts` | **NOUVEAU** |
| `src/types/sports-sidebar.ts` | MODIFIÉ |
| `src/lib/top-matches/types.ts` | MODIFIÉ |
| `src/lib/match-view.ts` | MODIFIÉ |
| `src/lib/sports-tree.ts` | MODIFIÉ |

---

## Phase 0.3 — SportAdapter Handball

**Skill utilisée**: `caveman` (communication directe)
**Fichier créé**: `src/lib/top-matches/handball.ts`

### Contenu
- `handballAdapter: SportAdapter` — sport: "handball"
- `fetch(limit)` → appelle `/api/handball/matches`
- Mapping `HandballMatch` → `TopMatch` avec badges (LIVE, Imminent)
- Couleurs ligues : Starligue bleu, HBL jaune, EHF violet, ASOBAL rouge
- LiveScore : current, minute, halfTime

### Enregistrement
- `src/lib/top-matches/index.ts` — `handballAdapter` ajouté au registre (12 adapters)

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Fichiers impactés (Phase 0 complète)

| Fichier | Statut |
|---------|--------|
| `src/lib/handball-data.ts` | **NOUVEAU** |
| `src/lib/top-matches/handball.ts` | **NOUVEAU** |
| `src/types/sports-sidebar.ts` | MODIFIÉ |
| `src/lib/top-matches/types.ts` | MODIFIÉ |
| `src/lib/top-matches/index.ts` | MODIFIÉ |
| `src/lib/match-view.ts` | MODIFIÉ |
| `src/lib/sports-tree.ts` | MODIFIÉ |

---

## Phase 0 ✅ TERMINÉE
- Types HandballMatch/HandballLeague : ✅
- Enregistrement SportTabId/SportType/SPORT_TYPES : ✅
- SportAdapter handball (12e adapter) : ✅
- typecheck : 0 erreurs

## Prochaine tâche
Phase 1.1 : Service API-Sports Handball (`src/lib/handball-api.ts`)
