# Phase 2 — Déploiement Sofascore Microservice sur Render

> Architecture finale après Phase 1 wire : Node web service + Python pserv (worker privé) communiquant via DNS interne Render.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Render Web Service "pariscore" (Node, plan free)        │
│  - server.js                                             │
│  - Expose port 3000 publiquement                         │
│  - SOFA_SERVICE_BASE = http://pariscore-sofa:8765       │
└────────────────┬────────────────────────────────────────┘
                 │ fetch HTTP interne
                 │ Promise.race timeout 5s
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Render Private Service "pariscore-sofa" (Python, $7/mo) │
│  - scripts/sofa-microservice.py                          │
│  - Bind 0.0.0.0:8765 (interne, pas public)               │
│  - Stack : sofascore-wrapper + soccerdata + ScraperFC    │
│  - Chromium Playwright pre-installé au build             │
└─────────────────────────────────────────────────────────┘
                 │
                 ▼
        api.sofascore.com (Cloudflare bypassed)
```

## Pourquoi un service séparé ?

| Critère | Sur même dyno (supervisord) | Service séparé (pserv) |
|---------|----------------------------|------------------------|
| Coût | $0 supp | $7/mo Starter |
| RAM partagée | OUI (Node 200MB + Chromium 500MB sur même 512MB) → crash | NON (chacun isolé) |
| Restart indépendant | NON | OUI |
| Scaling indépendant | NON | OUI |
| Build complexity | Élevée (Procfile + supervisord) | Faible (deux services Render) |
| Verdict | À éviter | **Recommandé** |

## Fichiers ajoutés

| Fichier | Rôle |
|---------|------|
| `requirements.txt` | sofascore-wrapper, soccerdata, ScraperFC, playwright |
| `scripts/sofa-microservice.py` | HTTP server BaseHTTPRequestHandler, expose 7 routes |
| `render.yaml` | Blueprint Render, ajoute pserv `pariscore-sofa` |

## Variables d'environnement Render

| Variable | Service | Valeur | Notes |
|----------|---------|--------|-------|
| `SOFA_BIND` | pariscore-sofa | `0.0.0.0` | Obligatoire pour DNS interne Render |
| `SOFA_PORT` | pariscore-sofa | `8765` | Port d'écoute |
| `PYTHONUNBUFFERED` | pariscore-sofa | `1` | Logs Python en temps réel |
| `SOFA_SERVICE_BASE` | pariscore | `http://pariscore-sofa:8765` | URL DNS interne |

## Procédure de déploiement

### 1. Pre-checks locaux

```bash
# Vérifier requirements.txt
pip install -r requirements.txt
python -m playwright install chromium

# Tester le microservice en local
python scripts/sofa-microservice.py &
curl http://127.0.0.1:8765/health

# Tester le wire Node ↔ Python
SOFA_SERVICE_BASE=http://127.0.0.1:8765 node server.js &
curl http://localhost:3000/api/v1/live-dashboard/<matchId>
```

### 2. Commit + push

```bash
git add requirements.txt scripts/sofa-microservice.py render.yaml server.js
git commit -m "feat(deploy): Phase 2 Render multi-service Sofa worker"
git push origin main
```

### 3. Apply Blueprint sur Render

1. Dashboard Render → **Blueprints** → **New Blueprint Instance**
2. Sélectionner le repo `pariscore`
3. Render détecte `render.yaml` modifié → propose 2 services :
   - `pariscore` (web, existant)
   - `pariscore-sofa` (pserv, nouveau)
4. Apply
5. Attendre build (5-10 min pour pserv à cause de `playwright install chromium --with-deps` ~300 MB)

### 4. Vérification post-deploy

```bash
# Logs pserv
render logs pariscore-sofa

# Test interne via web service (depuis le dyno Node, pas depuis l'extérieur)
# → ouvrir une session shell Render sur pariscore et :
curl http://pariscore-sofa:8765/health

# Test end-to-end depuis Internet
curl https://pariscorebis.onrender.com/api/v1/live-dashboard/bsd_<id>
# → response.source doit contenir "+sofa"
```

## Coûts mensuels

| Service | Plan | Coût |
|---------|------|------|
| pariscore (web Node) | free | $0 |
| pariscore-sofa (pserv Python) | starter | **$7** |
| Disque persistant 1 GB | inclus | $0 |
| **Total** | | **$7/mo** |

## Limitations connues

1. **K-League stats vides** côté Sofa aussi (couverture insuffisante pour leagues exotiques). Fallback `sr_stats` BSD reste primary pour ces ligues.
2. **Build pserv ~10 min** à cause du download Chromium. Mitiger via cache `~/.cache/ms-playwright` persistant.
3. **Free tier web spin-down** après 15 min d'inactivité → premier appel `/api/v1/live-dashboard/:id` peut prendre 30s (cold start). Upgrade vers Starter ($7) si problématique.
4. **Render Free pserv inexistant** → le worker est forcément Starter $7. Pas de "free pserv".

## Plan B : single-dyno multi-process

Si budget tendu, alternative à $0 (mais risque OOM 512MB free plan) :

```bash
# Procfile racine
web: honcho start
# .env.honcho
node: node server.js
sofa: SOFA_BIND=127.0.0.1 SOFA_PORT=8765 python scripts/sofa-microservice.py
```

```yaml
# render.yaml single-service
services:
  - type: web
    name: pariscore
    runtime: node
    buildCommand: pip install -r requirements.txt && python -m playwright install chromium --with-deps && npm install honcho
    startCommand: honcho start
```

**Risque** : Chromium consomme 400-500 MB par instance → OOM kill sur free plan 512MB. Acceptable seulement sur plan Starter $7 (mais alors autant prendre la version 2 services pour isolation).

## Health check + monitoring

Le worker pserv n'a pas de healthCheckPath dans render.yaml (le type `pserv` ne le supporte pas). Monitoring manuel via :

```javascript
// server.js — ajout cron 60s qui ping le worker
setInterval(async () => {
  const ok = await fetch(`${SOFA_SERVICE_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    .then(r => r.ok).catch(() => false);
  if (!ok) console.warn('[health] sofa worker down');
}, 60000);
```

## Désactivation / rollback

Si le worker pose problème en prod, désactivation propre :

```bash
# Render dashboard → pariscore-sofa → Settings → Suspend Service
# Puis dans pariscore env vars : SOFA_SERVICE_BASE = "" (empty)
```

Le code Node `_sofaServiceFetch` gère gracieusement le miss (Promise.race timeout → null → fallback BSD). Aucune erreur visible utilisateur.

---

*Document : `.context/DEPLOY-SOFA-MICROSERVICE.md` — PariScore Phase 2 deploy guide.*
