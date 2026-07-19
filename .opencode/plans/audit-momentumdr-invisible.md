# Audit : MomentumDR invisible sur le frontend

**Date :** 2026-07-18

---

## Résumé

Le composant MomentumDR (graphique momentum EWMA) a été livré dans `f888b7b`. Rebuildé et déployé sur le VPS (Jul 18 19:18). Deux causes racines expliquent pourquoi l'utilisateur ne le voit pas.

---

## Cause A : Deux serveurs, tester le bon URL

| URL | Serveur | Port | Technologie | Contient MomentumDR ? |
|-----|---------|------|-------------|----------------------|
| `https://pariscore.fr/` | **Legacy** | 3000 | `server.js` + `pariscore.html` | **NON** (a `momentumChart()` SVG, ancien) |
| `https://pariscore.fr/setpoint/` | **Next.js** | 3005 | Next.js 16 + React 19 | **OUI** (compilé, verifié) |

**Preuve :**
```bash
curl -s https://pariscore.fr/ | grep -c "momentum"     # → 6 (ancien code SVG)
grep -rl "MomentumDR" /home/ubuntu/pariscore/.next/standalone/.next/static/chunks/
# → 1rpbs2ltap6vf.js (build OK)
```

---

## Cause B : Aucun match live — garde-fou `isLive` bloque

Dans `match-card.tsx` (l.230-238) :
```tsx
const isLive = liveState?.isLive === true;
{isLive && liveState && <MomentumDR liveState={liveState} ... />}
```

**Trois conditions nécessaires :**

| Condition | Source | Statut | Preuve |
|-----------|--------|--------|--------|
| match existe dans prematch | API `/api/tennis/prematch` | ✅ OK | 10 matchs BSD, HTTP 200 |
| `liveStates[match.id]` défini | socket.io (tennis-live, port 3001) | ❌ | Badge "Connexion..." persistant |
| `liveState.isLive === true` | Événement `match_update` | ❌ | Tous les matchs sont "Prematch" |

### Flux de données

```
tennis-live (port 3001, socket.io)
    ↓ events: initial_state + match_update
use-live-matches.ts → liveStates: Record<string, LiveMatchState>
    ↓
page.tsx → <MatchCard liveState={liveStates[match.id]}>
    ↓
match-card.tsx → isLive = liveState?.isLive === true
    ├── true  → <MomentumDR />   ← route désirée
    └── false → (rien)           ← état actuel
```

---

## Build VPS — Verifié OK

| Vérification | Statut | Preuve |
|-------------|--------|--------|
| Build ID | ✅ | Jul 18 19:18 |
| App React accessible | ✅ | 200 OK, `<title>SetPoint · Tennis Prematch</title>` |
| MomentumDR dans bundle | ✅ | `grep -rl Momentum .next/static/chunks/` → trouvé |
| Nginx /setpoint/ | ✅ | `proxy_pass http://localhost:3005/` |

---

## Plan de tests formalisé

### Test 1 — Build integrity
```bash
grep -rl "MomentumDR" /home/ubuntu/pariscore/.next/standalone/.next/static/chunks/
grep -rl "useMomentumDR\|use-momentum-dr" /home/ubuntu/pariscore/.next/standalone/.next/server/
```

### Test 2 — Vérifier les deux URLs
```bash
curl -s https://pariscore.fr/ | grep -c "MomentumDR"              # → 0 (legacy)
curl -s https://pariscore.fr/setpoint/ | grep -c "MomentumDR"      # → 0 (SSR, pas hydraté)
```

### Test 3 — Vérifier service tennis-live
```bash
pm2 list | grep tennis-live         # online ?
pm2 logs tennis-live --lines 30     # events recus ?
curl -s http://localhost:3001       # répond ?
```

### Test 4 — Vérifier avec un navigateur réel (Page Agent)
```bash
# Ouvrir /setpoint/
# Console : aucune erreur JS rouge ?
# Network > WS > socket.io : events recus ?
# Elements : chercher "MomentumDR" dans le DOM hydraté
```

### Test 5 — Injection d'un match live factice
```javascript
// Dans la console navigateur de /setpoint/ :
window.__debugInjectLiveMatch = {
  id: "test-match", isLive: true,
  scoreA: { sets: [6, 3], games: 0, points: 0 },
  scoreB: { sets: [4, 6], games: 0, points: 15 },
  pointsTracked: 24, momentumA: [], momentumB: [], settled: true
};
// Puis vérifier si MomentumDR apparait
```

### Test 6 — Legacy momentumChart intact
```bash
grep -c "function momentumChart" /home/ubuntu/pariscore/pariscore.html   # → 1
grep -c "momentum_series" /home/ubuntu/pariscore/pariscore.html          # → N > 0
grep -c "momentum_series" /home/ubuntu/pariscore/server.js               # → N > 0
```

### Test 7 — Verifier dépendances dans le bundle
```bash
strings /home/ubuntu/pariscore/.next/standalone/.next/static/chunks/1rpbs2ltap6vf.js | grep -c "framer-motion"
```

---

## Risques identifiés (meme apres correction)

| Risque | Impact | Detection |
|--------|--------|-----------|
| `diffPoints()` echoue si saut score > 6 points | MomentumDR reste en `opacity-60` | Silencieux, pas d'erreur |
| `ignoreBuildErrors: true` | Types TS invalides mais build OK | Build reussit avec code casse |
| SentryErrorBoundary global | Erreur dans MomentumDR → page blanche | Pas de recovery local |
| Pas de fallback offline | Sans socket.io, composant jamais visible | Aucune notification utilisateur |

---

## Recommandations

**Court terme :**
1. Verifier/demarrer le service tennis-live (port 3001)
2. Tester sur `https://pariscore.fr/setpoint/` (pas `/`)
3. Injecter un match live factice pour valider le rendu

**Moyen terme :**
4. Ajouter tennis-live dans ecosystem.config.js
5. Ajouter un fallback offline base sur les donnees historiques
6. Remplacer `ignoreBuildErrors: true` par des verifications strictes
