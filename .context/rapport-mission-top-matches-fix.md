# Rapport de Mission — Fix Top Matchs du Jour (sport=all)

## Date
2026-09-06

## Contexte
Le composant "Top Matchs du Jour" affichait "Aucun match top disponible" alors que des
données existent pour football, tennis, CS2, et autres sports.

## Diagnostic

### Analyse des APIs
Testé chaque sport individuellement sur le VPS (`https://pariscore.fr/api/v1/top-matches/all?sport=<sport>`):

| sport | Status | Résultat |
|-------|--------|----------|
| football | ✅ OK | 5 ligues avec matchs aujourd'hui (Sept 6) |
| cs2 | ✅ OK | 3 matchs live aujourd'hui |
| tennis | ✅ OK | 37 matchs demain (Sept 7) |
| nba/wnba/f1/mma/cycling/fiba | ✅ OK | Données présentes |
| **all** | ❌ **`{"groups":[]}`** |vide — cause du bug |

### Root Cause
Dans `src/lib/top-matches/types.ts`, le tableau `SPORT_TYPES` (aliassé `ALL_SPORTS`) contenait
`"basket"` — un type de sport **virtuel** qui n'a pas d'adaptateur correspondant dans
`src/lib/top-matches/index.ts` (`adapters` n'a pas de clé `basket`).

Flèche du bug :
1. `sport=all` → `fetchTopMatches('all', ...)` → `sports = ALL_SPORTS` (inclut `"basket"`)
2. `adapters["basket"].fetch(...)` → `TypeError: Cannot read properties of undefined`
3. Le try/catch de l'API route avait `catch { return { groups: [] } }` → **erreur avalée silencieusement**

### Pourquoi les sports individuels marchaient
Quand `sport=football`, `fetchTopMatches` fait `sports = ['football']` → seul l'adaptateur
football est appelé. Pas de `"basket"`. ✅

## Fix Appliqué

**Fichier** : `src/lib/top-matches/types.ts:70`

**Changement** : Suppression de `"basket"` du tableau `SPORT_TYPES`.

```diff
 export const SPORT_TYPES: SportType[] = [
   "football",
   "tennis",
-  "basket",
   "nba",
   "wnba",
   "f1",
   "cs2",
   "mma",
   "cycling",
   "fiba",
 ];
```

**Justification** : `"basket"` est un agrégateur logique (`sport=basket` → mappe vers
`['nba', 'wnba']` via le `else if` dans `index.ts`). Il ne doit PAS figurer dans
`ALL_SPORTS` car il n'a pas d'adaptateur. La route API valide toujours `basket` comme
entrée valide (via `VALID_SPORTS`), et `fetchTopMatches` gère la redirection.

## Commits & Déploiement

```
commit cc6c244f (HEAD -> main, origin/main)
Author: ...
Date:   ...

fix(top-matches): remove basket from ALL_SPORTS - adapter missing caused TypeError
 1 file changed, 1 deletion(-)
```

- ✅ Commit créé
- ✅ Poussé sur origin/main
- ✅ Build effectué sur VPS (31.8s compilation + TS check)
- ✅ PM2 redémarré (pariscore-next, pid 1721032)
- ✅ API `sport=all` retourne désormais des groupes

## Vérifications

### Typecheck & Lint
À faire localement si modification subséquente :
```bash
bun run typecheck
bun run lint
```

### Test API VPS
```bash
curl -s "https://pariscore.fr/api/v1/top-matches/all?limit=10&timeframe=today" | jq '.groups | length'
# Attendu: > 0 (au moins football + cs2)
```

## Session Context
- **Branche** : main (trunk-based)
- **Statut** : Fix déployé, API validée
- **Prochaine étape** : Aucune (bug résolu)
- **Notes** : Le `catch` silencieux dans l'API route devrait logger les erreurs pour
  faciliter le diagnostic futur. À considérer comme amélioration (non demandée).
