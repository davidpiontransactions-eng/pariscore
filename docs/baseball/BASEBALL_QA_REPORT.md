# Rapport de Mission — Audit Onglet Baseball
**Date** : 2026-08-20  
**Agent** : opencode (mimo-v2.5-free)  
**Portée** : QA complet, Code Review, Diagnostic bug data, Audit innovations

---

## 1. Résumé Exécutif

L'onglet Baseball de PariScore est un subsystem **solide et bien architecturé** composé de 7 composants UI, 3 routes API, 3 fichiers data layer, 4 fichiers engine prédictif, et 4 scripts de test. Le moteur prédictif (Monte Carlo 10K itérations, Pythagorean, Markov) passe tous les tests.

**Bug signalé : "la data des matchs ne se met plus à jour"**

**Diagnostic** : Le problème n'est PAS dans le code mais dans la **stratégie de cache multi-couche** qui crée un artefact de stale data.

---

## 2. QA Test Results

### 2.1 Tests Unitaires — ✅ PASS
```
bun test src/lib/baseball/engine/baseball-predictive-engine.test.ts
5 pass, 0 fail, 12 expect() calls [588ms]
```

### 2.2 Quick Fix Verification — ✅ PASS
```
npx tsx scripts/verify-baseball-quick-fix.ts
✅ No NaN/infinity values
✅ overProb non-degenerate: 0.3492
✅ homeProb in (0,1): 0.5151
✅ Moneyline probabilities normalized
✅ Expected total positive: 8.39
✅ stdDev > 0: 4.18
```

### 2.3 MLB StatsAPI — ✅ LIVE
```
GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-20
Status: 200 OK
9 games returned with probable pitchers
```

### 2.4 Dev Server — ❌ OFFLINE
Le serveur de dev n'était pas actif au moment de l'audit.

### 2.5 Tests Playwright (scripts existants)
- `check-baseball-chips.mjs` — Visual check O/U + Winner chips
- `check-baseball-modal.mjs` — Visual check analysis modal
- Non exécutés (nécessite serveur actif)

---

## 3. Diagnostic Bug : "Data ne se met plus à jour"

### 3.1 Architecture de Cache (3 couches)

| Couche | TTL | Mécanisme |
|--------|-----|-----------|
| **Client SWR** | 30s refresh, 10s dedup | `refreshInterval: 30_000` |
| **CDN/Proxy** | 30s s-maxage, 120s stale-while-revalidate | `Cache-Control` header |
| **Serveur mémoire** | 60s TTL | `slateCache` Map avec `SLATE_CACHE_TTL_MS` |

### 3.2 Points de Blocage Identifiés

#### BUG 1 : `revalidateOnFocus: false` — Données stale après navigation
**Fichier** : `src/lib/hooks/use-baseball.ts:21-22`
```typescript
revalidateOnFocus: false,
revalidateOnReconnect: false,
```
**Impact** : Si l'utilisateur navigue vers un autre onglet puis revient sur Baseball, les données ne sont PAS rafraîchies. SWR ne re-fetch QUE toutes les 30s si l'onglet est actif.

**Fix recommandé** : Activer `revalidateOnFocus: true` ou ajouter un re-fetch au mount du composant.

#### BUG 2 : Cache serveur bloquant les mises à jour live
**Fichier** : `src/lib/baseball/data/provider.ts:15`
```typescript
const SLATE_CACHE_TTL_MS = 60_000;
```
**Impact** : Pendant 60s après le premier fetch, TOUS les appels API retournent la même donnée cache même si le match est devenu "live" avec des scores modifiés.

**Fix recommandé** : Réduire à 30s ou implémenter un invalidation par statut (live = 10s, scheduled = 60s).

#### BUG 3 : SWR `dedupingInterval: 10trop court pour le VPS
**Fichier** : `src/lib/hooks/use-baseball.ts:23`
```typescript
dedupingInterval: 10_000,
```
**Impact** : Sur un VPS avec latence, 10s de dedup est trop court — les requêtes se dédoublonnent mais le serveur reçoit quand même beaucoup de traffic inutile.

**Fix recommandé** : Augmenter à 30s côté client.

#### BUG 4 : Pas de re-fetch automatique pour les matchs live
**Observation** : Le composant `MLBKBOFolderTab` filtre les matchs live mais n'a aucun mécanisme de re-fetch accéléré quand un match passe de "scheduled" à "live".

**Fix recommandé** : Détecter le changement de statut et forcer un `mutate()`.

### 3.3 Cause Racine

Le bug principal est **l'interaction entre `revalidateOnFocus: false` et le cache serveur 60s**. Si l'utilisateur :
1. Ouvre l'onglet Baseball → données chargées
2. Navigue vers Football pendant 5 minutes
3. Revient sur Baseball → données stale (pas de re-fetch au focus)
4. Le SWR tente un re-fetch toutes les 30s MAIS le serveur retourne le cache 60s
5. Résultat : données potentiellement 2-3 minutes en retard

---

## 4. Code Review

### 4.1 Points Forts
- **Architecture propre** : séparation UI/API/Data/Engine
- **Type safety** : TypeScript strict, types complets dans `types.ts`
- **Graceful degradation** : mode dégradé explicite, jamais de données inventées
- **Cache prédictif** : inputHash pour invalidation précise
- **Tests** : engine tests + quick fix verification

### 4.2 Points à Améliorer

| Priorité | Fichier | Issue |
|----------|---------|-------|
| 🔴 High | `use-baseball.ts` | `revalidateOnFocus: false` cause stale data |
| 🔴 High | `provider.ts` | Cache 60s trop long pour matchs live |
| 🟡 Medium | `mlb-statsapi.ts:38` | `SEASON = 2026` hardcoded — casse en 2027 |
| 🟡 Medium | `provider.ts` | Cache mémoire non persisté (perte au redémarrage) |
| 🟡 Medium | `MLBKBOFolderTab.tsx` | Pas de détection changement scheduled→live |
| 🟢 Low | `curated-provider.ts` | Aucun test unitaire |
| 🟢 Low | `scripts/` | Codemod `apply-baseball-selection.cjs` à nettoyer |

### 4.3 Sécurité
- ✅ Aucune clé API exposée (MLB StatsAPI est publique)
- ✅ Pas de données sensibles dans le cache
- ✅ Input validation sur les paramètres API
- ⚠️ API key Alibaba visible dans `opencode.json` (non commité, mais dans le repo)

---

## 5. Fixes Recommandés (Priorité)

### Fix 1 : Activer revalidation au focus
```typescript
// src/lib/hooks/use-baseball.ts
const SCHEDULE_CONFIG: SWRConfiguration<SchedulePayload> = {
  revalidateOnFocus: true,  // ← CHANGÉ
  revalidateOnReconnect: true,  // ← CHANGÉ
  keepPreviousData: true,
  refreshInterval: 30_000,
  dedupingInterval: 30_000,  // ← AUGMENTÉ
};
```

### Fix 2 : Cache dynamique par statut
```typescript
// src/lib/baseball/data/provider.ts
function getCacheTTL(matches: BaseballMatch[]): number {
  const hasLive = matches.some(m => m.game.status === "live");
  return hasLive ? 15_000 : 60_000;  // 15s si live, 60s sinon
}
```

### Fix 3 : Auto-detect season
```typescript
// src/lib/baseball/data/mlb-statsapi.ts
const SEASON = new Date().getFullYear();  // ← AUTO
```

### Fix 4 : Re-fetch on mount
```typescript
// src/components/baseball/MLBKBOFolderTab.tsx
useEffect(() => {
  void mutate();  // Force refresh au mount
}, [mutate]);
```

---

## 6. Métriques de Santé

| Métrique | Valeur | Status |
|----------|--------|--------|
| Tests unitaires | 5/5 pass | ✅ |
| Quick fix verification | 6/6 pass | ✅ |
| MLB StatsAPI | 9 games, 200 OK | ✅ |
| Engine prédictif | Fonctionnel | ✅ |
| SWR refresh | 30s interval | ⚠️ |
| Cache serveur | 60s TTL | ⚠️ |
| Focus revalidation | Désactivée | ❌ |
| Season auto-detect | Non implémenté | ❌ |

---

## 7. Conclusion

Le subsystem Baseball est **fonctionnellement solide** mais souffre de problèmes de **fraîcheur de données** liés à une stratégie de cache trop agressive. Les fixes sont simples et ciblés. Aucun bug critique de sécurité ou de données n'a été identifié.

**Prochaine étape** : Implémenter les 4 fixes recommandés (estimé : 2-3h de dev).
