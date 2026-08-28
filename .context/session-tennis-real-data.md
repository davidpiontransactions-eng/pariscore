# Session: Tennis Real Data — Fix mock root cause + hardening

## Scope

Prod pariscore.fr sert `source: "mock"` (3 matchs Wimbledon en dur) au lieu des 347 matchs BSD réels. Root cause : un seul match "TBD" (`player1: null`, `player2: null`) dans la réponse BSD scheduled crashe `buildMatch()` → tout le pipeline prematch tombe → fallback mock.

## Root cause

```
[prematch] BSD failed: Cannot read properties of null (reading 'name')
```

- `bsd-fetcher.ts:71` → `b.player1.name` (player1 null sur match BJK Cup id 39282)
- `bsd-fetcher.ts:479` → `bsdMatch.tournament.name` (tournament null possible)
- `fetchBSDLiveMatches()` déjà correct (garde `m.player1?.name`) — seul prematch cassé
- Odds API tennis 404 (free tier ne couvre pas tennis ATP/WTA) → pas de filet

## Fichiers modifiés

| Fichier | Action | Lignes |
|---------|--------|--------|
| `src/lib/bsd-tennis-service.ts` | Types player1/player2/tournament nullable | types BSDMatch |
| `src/lib/bsd-fetcher.ts` | Null-guard buildMatch + fetchBSDMatches | ~471-489, ~70-75 |
| `src/app/api/tennis/prematch/route.ts` | mockForToday() réservé dev | GET handler |
| `src/components/football/tennis-tab-content.tsx` | JSON-LD réel (matchesWithLive) | ~594 |
| `src/hooks/use-tennis-live-stats.ts` | DEMO_STATS → afficher — | fallbackToDemo |

## Journal de boucle d'ingénierie

> Mode traçabilité : une entrée par étape (action → verify → résultat).

### P0 — Setup traçabilité

| Action | Verify | Résultat |
|--------|--------|----------|
| Création bead | bd create OK | ⏳ |
| Journal ouvert | section présente | ✅ |

### P1 — Fix root cause (null-guard)

| Action | Verify | Résultat |
|--------|--------|----------|
| Types nullable dans bsd-tennis-service.ts | tsc passe | ⏳ |
| Null-guard buildMatch + fetchBSDMatches | tsc passe | ⏳ |
| Deploy VPS + curl /api/tennis/prematch | source: "bsd" | ⏳ |

### P2 — Never-mock en prod

| Action | Verify | Résultat |
|--------|--------|----------|
| mockForToday() réservé dev | curl simule prod → pas de mock | ⏳ |

### P3 — JSON-LD réel

| Action | Verify | Résultat |
|--------|--------|----------|
| matchesWithLive remplace MATCHES | DOM plus de 2026-07 | ⏳ |

### P4 — DEMO_STATS honnête

| Action | Verify | Résultat |
|--------|--------|----------|
| afficher — au lieu de chiffres | drawer pas de faux chiffres | ⏳ |

### P5 — Fallback ESPN gratuit (passe 2)

| Action | Verify | Résultat |
|--------|--------|----------|
| ESPN tennis fetcher | BSD+Odds KO → vraies données | ⏳ |

### P6 — Gates + deploy

| Action | Verify | Résultat |
|--------|--------|----------|
| bun run lint | 0 erreur | ⏳ |
| bun run typecheck | 0 erreur | ⏳ |
| deploy VPS | health OK | ⏳ |

### P7 — Trace + close

| Action | Verify | Résultat |
|--------|--------|----------|
| Journal complété | trace complète | ⏳ |
| bd close | bead fermé | ⏳ |
| bd dolt push | données sync | ⏳ |

## Pièges à retenir

- BSD scheduled renvoie des matchs avec `player1: null` / `player2: null` (team events BJK Cup, qualité TBD)
- `fetchBSDLiveMatches()` est déjà correct — seulement `fetchBSDMatches()` + `buildMatch()` sont cassés
- Odds API tennis 404 sur le free tier (ATP/WTA non couvert)
- `mockForToday()` re-date les 3 matchs Wimbledon sur la journée courante → pas de visibilité du mock côté client (source: "mock" bandera mais le user voit 3 matchs réalistes)
