# TODO — Corrections P0 (Audit Chaîne de Synchronisation)

> Généré le 17/06/2026 — Audit DATA_PIPELINE_V3

---

## ✅ DÉJÀ CORRIGÉS DANS LE CODE ACTUEL

Ces bugs étaient mentionnés dans le rapport QA mais **le code source est déjà corrigé** :

| Bug | Correction | Fichier:Ligne |
|-----|-----------|---------------|
| BUG-002 | `bp_conv`, `bp_saved` intégrés dans `computeAllMetrics()` | `server.js:48958-48959` |
| BUG-003 | `srv_sparkline`, `ret_sparkline` intégrés dans `computeAllMetrics()` | `server.js:48960-48961` |
| Cache _tnTop10Cache viewer | TTL passé de 60s → **5min** | `server.js:25574` |
| Cache _tnTop10Cache bettor | TTL passé de 30s → **3min** | `server.js:25575` |
| Boot warmer Top10 | Délai passé de 60s → **5s** | `server.js:36259` |
| Cron refresh | `setInterval(_refreshTop10Cache, 5min)` actif | `server.js:36276` |

---

## 🔴 P0 — CORRECTIFS APPLIQUÉS (à déployer)

### P0.1 — BUG-001 : Valeurs fictives dans `__tennisPlayerMatches`
**Fichier :** `server.js:49003-49024`
**Symptôme :** `serve_index`, `receive_index`, `bp_won`, etc. remplacés par des valeurs par défaut fictives (30, 20, 3, 4, 2, 5, 1, 1) quand les vraies données sont absentes. Cela injectait des métriques fausses dans tout le pipeline EWMA.
**Correctif appliqué :**
- `srvIdx = playerSide.serve_index` (plus de fallback 30)
- `retIdx = playerSide.receive_index` (plus de fallback 20)
- `bp_won/bp_lost/bp_saved/bp_faced/tb_won/tb_lost` : plus de `||` avec valeurs par défaut
- `svr_pts_lost` et `ret_pts_lost` : calcul conditionnel (null si l'index est null)
- Ajout d'un `console.warn("[BUG-001] ...")` pour tracer les absences de données
**Action requise :** `git add server.js && git commit -m "bugfix: BUG-001 supprime les valeurs fictives dans __tennisPlayerMatches" && git push && ssh deploy`

---

## 🟡 P0 — CORRECTIFS À APPLIQUER

### P0.4 — safeFixed() muet sur les valeurs nulles
**Fichier :** `pariscore.js:14813-14817`
**Symptôme :** `safeFixed()` retourne `—` silencieusement sans aucun log. Impossible de savoir quelle métrique manque et pourquoi.
**Correctif proposé :**
```js
function safeFixed(val, digits = 2) {
  if (val == null || isNaN(val)) {
    console.warn('[safeFixed] Valeur nulle → "—" (stack)', new Error().stack?.split("\n").slice(2,4).join(" | "));
    return '—';
  }
  const n = Number(val);
  return isFinite(n) ? n.toFixed(digits) : '—';
}
```
**Action :** Appliquer le patch + commit + push

### P0.5 — Vérifier le peuplement de `__tennisVBWarmMatches`
**Fichier :** `server.js:36237` (stockage) / `server.js:48992` (lecture)
**Symptôme :** `__tennisPlayerMatches` dépend de `__tennisVBWarmMatches` (snapshot des matchs actifs). Si ce snapshot est vide ou jamais peuplé, toutes les métriques tennis retournent `null`.
**Vérification à faire :**
```bash
# Après déploiement, vérifier les logs :
grep "tennisVBWarmMatches" /path/to/logs
# Vérifier que la ligne 36237 s'exécute bien après le warm-up Top10
```
**Action :** Observation post-déploiement + correction si nécessaire

---

## 🟡 P1 — AMÉLIORATIONS

| # | Amélioration | Fichier | Détail |
|---|-------------|---------|--------|
| 1.1 | Logger les `catch` silencieux | `server.js` (multiple) | Ajouter `console.warn/error` dans tous les blocs `catch (_) { return ... }` |
| 1.2 | Dashboard erreurs par onglet | Nouveau endpoint | `GET /api/v1/admin/error-dashboard` avec compteurs par page |
| 1.3 | Timeout Monte Carlo RG >60s | `server.js` | Timeout asynchrone avec fallback plutôt que bloquer la réponse |
| 1.4 | SSE connection leak check | `server.js` + `pariscore.js` | Vérifier que les connexions EventSource sont bien fermées |

---

## 📋 PROCÉDURE DE DÉPLOIEMENT

```bash
# 1. Commit et push
cd "C:\Users\david\Documents\dev PariScore\ParisScorebis"
git add server.js
git commit -m "bugfix: BUG-001 — supprime valeurs fictives __tennisPlayerMatches + warn logger"
git pull --rebase
git push

# 2. Déploiement VPS OVH
ssh ubuntu@51.75.21.239
cd /path/to/pariscore
git pull
pm2 restart pariscore  # ou pm2 restart all
pm2 logs --lines 50    # vérifier que le serveur démarre sans erreur

# 3. Vérification post-déploiement
curl http://localhost:3000/api/v1/status
# Ouvrir l'UI → onglet Tennis → vérifier que les métriques s'affichent
# Vérifier la console navigateur pour les warn [BUG-001] et [safeFixed]
```

---

## 🔍 ÉTAT DES LIEUX POST-AUDIT

| Source | Statut | Taux d'échec estimé | Notes |
|--------|--------|---------------------|-------|
| BSD API (polling 30s) | 🟢 OK | <1% | WebSocket push + REST fallback |
| ESPN (polling 30s) | 🟡 À surveiller | ~5% | Rate limiting possible |
| Odds API (TTL 2h) | 🟢 OK | <1% | Free tier, quota limité |
| FBref / Sofascore | 🟡 À surveiller | ~10% | Blocage IP possible |
| Cache _tnTop10Cache | 🟢 OK (corrigé) | N/A | TTL 5min/3min + warmer 5s |
| BUG-001 (métriques fictives) | 🟢 CORRIGÉ | N/A | Plus de fausses données |
| safeFixed() logging | 🔴 À FAIRE | N/A | Patch en attente |
