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
| Création bead `ParisScorebis-bogn` | bd create OK | ✅ |
| Claim bead | bd update --claim → in_progress | ✅ |
| Journal ouvert | section présente | ✅ |

### P1 — Fix root cause (null-guard)

| Action | Verify | Résultat |
|--------|--------|----------|
| Types nullable dans `bsd-tennis-service.ts` (`player1`/`player2`/`tournament`) | tsc passe | ✅ |
| Null-guard `buildMatch()` — `b.player1?.name`, `b.player2?.name`, `b.tournament?.name` | tsc passe | ✅ |
| Null-guard `fetchBSDMatches()` — `bsdMatch.tournament?.name` | tsc passe | ✅ |
| Non-null assertions post-guard (`b.player1!.id` etc) | 8 erreurs TS éliminées | ✅ |
| Fix collatéral `previous-match-highlights-service.ts` (même pattern) | 3 erreurs TS éliminées | ✅ |
| Deploy VPS (`bf807fb9`) | health OK | ✅ |
| **Vérification prod** : `curl /api/tennis/prematch` | **`source: "bsd"`, 6 vrais matchs** | ✅ |

**Avant** : `source: mock, matches=3, id=mock-m1, Wimbledon, Sabalenka vs Osaka`
**Après** : `source: bsd, matches=6, id=bsd-48095, Roehampton, Broom vs Loffhagen`

### P2 — Never-mock en prod

| Action | Verify | Résultat |
|--------|--------|----------|
| `mockForToday()` réservé `NODE_ENV !== "production"` | curl prod → jamais `source:"mock"` | ✅ |
| `PrematchResponse.source` étendu avec `"error"` | tsc passe | ✅ |
| `isDegraded` hook + composant incluent `"error"` | tsc passe | ✅ |
| `top-value-bets.tsx` garde `"error"` | tsc passe | ✅ |

### P3 — JSON-LD réel

| Action | Verify | Résultat |
|--------|--------|----------|
| `matchesWithLive.slice(0,50)` remplace `MATCHES` | DOM JSON-LD = vrais matchs | ✅ |
| `import { MATCHES }` supprimé (valeur) | 0 référence MATCHES dans le fichier | ✅ |

### P4 — DEMO_STATS honnête

| Action | Verify | Résultat |
|--------|--------|----------|
| `DEMO_STATS` → `EMPTY_STATS` (tous null, `_mock: false`) | pas de faux chiffres dans le drawer | ✅ |
| `isDemo` → `false` quand pas de données | badge « démo » masqué | ✅ |
| Commentaires mis à jour (démo → vide) | tsc passe | ✅ |

### P6 — Gates + deploy

| Gate | Commande | Résultat |
|------|----------|----------|
| Typecheck session | `tsc --noEmit` | ✅ 0 erreur sur les 9 fichiers modifiés (erreurs pré-existantes tests/tools hors scope) |
| Lint | `eslint` sur les 8 fichiers | ✅ 0 erreur |
| Commit | `fix(tennis): null-guard BSD + never-mock prod + JSON-LD reel + DEMO_STATS honnete` | ✅ `e33fb369` |
| Push origin/main | rebase + push | ✅ `bffb7d04` |
| Deploy VPS | `deploy.bat` | ✅ VPS_DEPLOY_OK, build_ran=1, health OK |
| QA prod | `curl /api/tennis/prematch` | ✅ `source: "bsd"`, 6 vrais matchs |

### P7 — Trace + close

| Action | Verify | Résultat |
|--------|--------|----------|
| Journal complété | trace complète | ✅ |
| Bead `ParisScorebis-bogn` fermé | bd close | ✅ `bffb7d04` |
| bd dolt push | données sync | ✅ Push complete |

## Pièges à retenir

- BSD scheduled renvoie des matchs avec `player1: null` / `player2: null` (team events BJK Cup, qualité TBD)
- `fetchBSDLiveMatches()` est déjà correct — seulement `fetchBSDMatches()` + `buildMatch()` sont cassés
- Odds API tennis 404 sur le free tier (ATP/WTA non couvert)
- `mockForToday()` re-date les 3 matchs Wimbledon sur la journée courante → pas de visibilité du mock côté client (source: "mock" bandera mais le user voit 3 matchs réalistes)
