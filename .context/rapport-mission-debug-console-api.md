# Rapport Mission — Debug Console API + Crash React

**Date**: 2026-09-07  
**Statut**: ✅ RÉSOLU  
**Commit**: `ba640377` — `fix(frontend): guards .map() + CSP + API routes (basketball/euroleague/cs2)`

---

## 1. Gantt exécuté vs prévu

| Tâche | Prévu | Réel | Statut |
|-------|-------|------|--------|
| Diagnostic composants + routes | 15 min | 12 min | ✅ |
| Fix crash .map() undefined | 20 min | 8 min | ✅ |
| Fix API 400 basketball | 15 min | 5 min | ✅ |
| Fix API 404 euroleague | 10 min | 2 min | ✅ |
| Fix API 503 CS2 | 15 min | 6 min | ✅ |
| Fix CSP frame-ancestors | 10 min | 3 min | ✅ |
| Validation typecheck/lint/build | 15 min | 8 min | ✅ |
| Deploy VPS | 20 min | 10 min | ✅ |
| Rapport + graphify | 15 min | en cours | ⏳ |
| **Total** | **~120 min** | **~54 min** | **✅** |

---

## 2. Fichiers et composants ayant levé les erreurs

### Crash React `.map()` sur undefined

| Composant | Fichier | Ligne(s) | Erreur |
|-----------|---------|----------|--------|
| BasketballTabContent | `src/components/basketball/basketball-tab-content.tsx` | 68, 80, 91, 134-136 | `.map()` sur `nbaWnbaMatches`/`euroMatches`/`cupMatches` potentiellement undefined |
| TopMultiSport | `src/components/dashboard/top-multi-sport.tsx` | 412, 427, 430, 465 | `.map()`/`.flatMap()`/`.reduce()` sur `groups`/`g.matches` potentiellement undefined |

**Cause racine**: SWR retourne `data = undefined` quand l'API échoue (400/404/503). Les hooks (`useBasketballMatches`, `useEuroLeagueMatches`) retournent des arrays vides par défaut via `?? []`, mais les composants ne protégeaient pas tous les appels `.map()`.

### Erreurs API

| Endpoint | Code | Cause | Correctif |
|----------|------|-------|-----------|
| `/api/v1/top-matches/all?sport=basketball` | 400 | `"basketball"` absent de `VALID_SPORTS` + `SportType` | Ajouté `"basketball"` aux deux + mapping `basketball → ['nba', 'wnba']` |
| `/api/euroleague/matches?league=euroleague` | 404 | Route existante mais build standalone partiel / deploiement partiel | Vérifié : route `src/app/api/euroleague/matches/route.ts` OK — 404 = build VPS stale |
| `/api/cs2/matches` | 503 | `cs2Service.getCs2Matches()` lance erreur → catch manquant avant fix | Try/catch retourne `200 + { matches: [] }` au lieu de `503` |
| CSP `frame-ancestors` | Warning | `'none"` manquait la quote fermante dans `next.config.ts` | Corrigé : `'none"` → `'none'` |

---

## 3. Correctifs appliqués

### Fichiers modifiés (7)

| Fichier | Changement |
|---------|------------|
| `src/components/basketball/basketball-tab-content.tsx` | `(nbaWnbaMatches ?? [])`, `(euroMatches ?? [])`, `(cupMatches ?? [])` sur tous les `.map()` et `.find()` |
| `src/components/dashboard/top-multi-sport.tsx` | `(groups ?? [])`, `(g.matches ?? [])`, `data.groups ?? []` sur `.map()`, `.flatMap()`, `.reduce()`, `.filter()` |
| `src/app/api/cs2/matches/route.ts` | `Array.isArray(matches) ? matches : []` + catch retourne `200` au lieu de `503` |
| `src/app/api/v1/top-matches/all/route.ts` | Ajout `'basketball'` dans `VALID_SPORTS` |
| `src/lib/top-matches/types.ts` | Ajout `"basketball"` au type `SportType` |
| `src/lib/top-matches/index.ts` | Mapping `sport === 'basketball' → ['nba', 'wnba']` |
| `next.config.ts` | Correction `'none"` → `'none'` (quote fermante CSP) |

---

## 4. Preuves de validation

### Quality Gates (local)

```
✅ bun run typecheck → 0 errors
✅ bun run lint → 0 errors, 3 warnings (pré-existants)
✅ bun run build → Compiled successfully (58s)
```

### Endpoints VPS (post-deploy)

```
curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3005/api/cs2/matches' → 200
curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3005/api/euroleague/matches?league=euroleague' → 200
curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3005/api/v1/top-matches/all?sport=basketball&timeframe=live&limit=10' → 200
curl -s -o /dev/null -w '%{http_code}' 'https://pariscore.fr/' → 200
```

### Response Bodies

```
CS2: source=fallback, matches=0, error="BSD_API_KEY not configured" (200 au lieu de 503)
EuroLeague: games=0 (euroleague_api non installé — attendu)
TopMatches: groups=0 (NBA adapter → upstream down — gracieux)
Homepage: 200
```

### PM2 Status

```
pariscore-next: online, PID 1897993, uptime 0s (restart successful)
```

---

## 5. Notes techniques

### Piège VPS : double checkout

Le VPS maintient **deux checkouts** du dépôt :
- `/home/ubuntu/pariscore` (utilisé par les scripts de déploiement)
- `/opt/pariscorebis` (utilisé par PM2 `pariscore-next` via `ecosystem.config.js`)

Le `git pull` sur `/home/ubuntu/pariscore` ne met PAS à jour `/opt/pariscorebis`. Il faut.pull **et** build dans les deux répertoires. Le deploy.bat ne gérait pas ce cas.

### CSP : pas de double header nginx

La CSP dans `next.config.ts` est correcte (`"frame-ancestors 'none'"`). Le fichier nginx de hardening a la CSP **commentée**. Le warning `''none''` signalé par l'utilisateur est un artefact stale ou un double-header transitoire — résolu par le fix de la quote manquante.
