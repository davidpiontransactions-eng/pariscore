# Traceabilité — Phase 1 : Data Layer Handball

**Date**: 2026-09-16
**Durée estimée**: 2h20

---

## Phase 1.1 — Service API-Sports Handball

**Skill utilisée**: `general` (subagent)
**Fichier créé**: `src/lib/handball-api.ts`

### Contenu
- `hbFetch<T>(path)` — fetch API-Sports avec `API_FOOTBALL_KEY`, 8s timeout, retourne `null` sur erreur
- `fetchHandballFixtures(date?)` — fixtures d'une date, TTL 5min via Prisma kvStore
- `fetchHandballLive()` — matchs live, TTL 30s
- `fetchHandballStandings(leagueId)` — classements
- Mapping API-Sports response → `HandballMatch`

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Phase 1.2 — Endpoint /api/handball/matches

**Skill utilisée**: `general` (subagent)
**Fichier créé**: `src/app/api/handball/matches/route.ts`

### Contenu
- `createTtlCache("__handballMatchesCache")` — cache globalThis
- GET → fetch fixtures + live, merge, retourne `{ matches, source, degraded, updatedAt }`
- TTL : 5 min
- Fallback stale si erreur (1h grace)

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Phase 1.3 — Endpoint /api/handball/live

**Skill utilisée**: `general` (subagent)
**Fichier créé**: `src/app/api/handball/live/route.ts`

### Contenu
- `createTtlCache("__handballLiveCache")`
- GET → live uniquement, retourne `{ matches, updatedAt }`
- TTL : 30s

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Phase 1.4 — Hook use-handball-matches

**Skill utilisée**: `general` (subagent)
**Fichier créé**: `src/hooks/use-handball-matches.ts`

### Contenu
- SWR sur `/api/handball/matches`
- Polling 60s, dedupe 30s
- Retourne `{ matches, isLoading, isValidating, error, mutate }`

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Phase 1.5 — Hook use-handball-live

**Skill utilisée**: `general` (subagent)
**Fichier créé**: `src/hooks/use-handball-live.ts`

### Contenu
- SWR sur `/api/handball/live`
- Polling 15s, dedupe 8s
- Retourne `{ matches, isLoading, isValidating, error, mutate }`

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Fichiers impactés (Phase 1)

| Fichier | Statut |
|---------|--------|
| `src/lib/handball-api.ts` | **NOUVEAU** |
| `src/app/api/handball/matches/route.ts` | **NOUVEAU** |
| `src/app/api/handball/live/route.ts` | **NOUVEAU** |
| `src/hooks/use-handball-matches.ts` | **NOUVEAU** |
| `src/hooks/use-handball-live.ts` | **NOUVEAU** |

---

## Phase 1 ✅ TERMINÉE
- Service API-Sports : ✅
- Endpoint matches : ✅
- Endpoint live : ✅
- Hook matches (SWR 60s) : ✅
- Hook live (SWR 15s) : ✅
- typecheck : 0 erreurs

## Prochaine tâche
Phase 2.1 : Moteur 8 stratégies (`src/lib/handball-strategy-top8.ts`)
