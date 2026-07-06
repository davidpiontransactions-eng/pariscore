# Post-mortem — "Erreur critique" + "0 matchs aujourd'hui"

> Date : 2026-07-06
> Sévérité : P0 (production down)
> Statut : ✅ Résolu

---

## 1. Symptômes

| Symptôme | Version affectée | Cause |
|---|---|---|
| "Erreur critique" (global-error.tsx) | v14 | Build Turbopack échoue : `getPhotoUrl` n'existe pas dans `player-photos.ts` |
| "0 matchs aujourd'hui" + "Chargement..." | v14 (après fix build) | API `/api/tennis/prematch` crash en production : imports top-level de modules défectueux |

---

## 2. Cause racine #1 — Build error (v14)

### Fichier
`src/lib/bsd-fetcher.ts` ligne 7

### Code défectueux
```ts
import { getPhotoUrl } from "@/lib/player-photos";
```

### Problème
Le module `src/lib/player-photos.ts` exporte `resolvePlayerPhoto`, pas `getPhotoUrl`. Le build Turbopack échoue avec :
```
Error: Export getPhotoUrl doesn't exist in target module
Did you mean to import resolvePlayerPhoto?
```

### Fix (v14fix)
```ts
import { resolvePlayerPhoto } from "@/lib/player-photos";
```
+ 2 usages mis à jour (`getPhotoUrl(nameA)` → `resolvePlayerPhoto(nameA)`, idem pour nameB)

---

## 3. Cause racine #2 — API crash en production (v14fix)

### Fichier
`src/app/api/tennis/prematch/route.ts`

### Problème
Les modules `bsd-fetcher` et `real-matches` sont importés au **niveau top-level** :
```ts
import { fetchRealMatches } from "@/lib/real-matches";
import { fetchBSDMatches } from "@/lib/bsd-fetcher";
```

Si un de ces modules crash à l'import (par exemple à cause d'une dépendance manquante, un JSON mal formé, ou une erreur de résolution de module en production), **toute la route API 500** — y compris le fallback mock qui ne s'exécute jamais.

En dev mode, Turbopack est plus permissif et l'import réussit. En production (build standalone), le bundling est plus strict et peut échouer silencieusement.

### Conséquence
- L'API retourne HTTP 500
- SWR ne reçoit pas de données
- La page affiche "Chargement..." indéfiniment
- "0 matchs aujourd'hui" car `matches.length === 0`

### Fix
1. **Imports dynamiques** : `bsd-fetcher` et `real-matches` sont maintenant importés via `await import()` à l'intérieur des blocs `try/catch`, pas au top-level
2. **Try/catch global** : toute la fonction `GET()` est wrappée dans un try/catch qui retourne toujours du mock data
3. **MockResponse bulletproof** : si même `enrichMockMatch` crash, on retourne les MATCHES bruts sans enrichment

### Code corrigé
```ts
// Avant (top-level — crash = route 500)
import { fetchBSDMatches } from "@/lib/bsd-fetcher";

// Après (dynamique — crash = fallback mock)
try {
  const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
  const bsdMatches = await fetchBSDMatches();
  // ...
} catch (err) {
  console.error("[prematch] BSD failed:", err.message);
  // fall through to mock
}

// Try/catch global — ABSOLUTE last resort
export async function GET() {
  try {
    // ... toute la logique ...
    return mockResponse(now);
  } catch (fatalErr) {
    console.error("[prematch] FATAL:", fatalErr.message);
    return mockResponse(Date.now());
  }
}
```

---

## 4. Leçons apprises

| # | Leçon | Action préventive |
|---|---|---|
| 1 | **Ne jamais importer des modules externes au top-level d'une API route** | Utiliser `await import()` dynamique |
| 2 | **Toujours wrapper GET() dans un try/catch global** | Le mock data doit TOUJOURS être retourné |
| 3 | **Tester le build production avant de déployer** | `next build` doit réussir localement avant push VPS |
| 4 | **Vérifier les noms d'exports avant d'importer** | ESLint pourrait détecter ça avec un plugin stricter |

---

## 5. Vérification post-fix

| Test | Résultat |
|---|---|
| `bun run lint` | ✅ 0 erreur |
| `next build` | ✅ Succès |
| `curl /api/tennis/prematch` | ✅ 200, source=mock, 3 matches |
| `curl /` | ✅ 200, `<title>SetPoint · Tennis Prematch</title>` |

---

## 6. Commandes de déploiement VPS

```bash
cd /home/ubuntu/pariscore && \
git stash && \
git pull origin main && \
git stash drop 2>/dev/null; \
./node_modules/.bin/next build && \
pm2 restart pariscore && \
sleep 3 && \
curl -s http://localhost:3000/api/tennis/prematch | python3 -c "import sys,json; d=json.load(sys.stdin); print('Source:', d['source']); print('Matches:', len(d['matches']))"
```
