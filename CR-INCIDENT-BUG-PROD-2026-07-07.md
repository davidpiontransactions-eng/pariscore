# CR d'incident — Bug production "Impossible de récupérer les matchs"

> **Date** : 2026-07-07
> **Sévérité** : 🔴 Production down (affichage matchs cassé)
> **Auteur** : Chef de projet (agent ZCode)
> **Statut** : ✅ **RÉSOLU**

---

## 1. Symptôme

Sur `https://pariscore.fr/`, les utilisateurs voient en boucle le message :

> « Erreur de chargement / Impossible de récupérer les matchs. Réessayer »

Les matchs ne s'affichent pas, l'application est inutilisable.

## 2. Root cause

**Config nginx héritée de la période SetPoint** : la règle `location /api/` routait **toutes** les routes API génériques vers `127.0.0.1:8000` (serveur FastAPI uvicorn) au lieu du serveur Node.js `pariscore` (`localhost:3000`).

Le frontend `pariscore.html` (servi par le Node.js sur `/`) appelle `/api/v1/matches` qui était donc routé vers la FastAPI — qui ne connaît pas cette route → **404 `{"detail":"Not Found"}`**.

Le frontend recevait donc un 404 au lieu du 401 `AUTH_REQUIRED` attendu, et affichait le message d'erreur générique au lieu d'ouvrir le modal d'authentification.

### Architecture réelle (post-diagnostic)

| Port | Process | Rôle |
|---|---|---|
| 3000 | Node.js `pariscore` (PM2 id 18) | **Backend officiel** : sert `pariscore.html` + routes `/api/v1/*` |
| 3001 | bun `tennis-live` (PM2 id 14) | WebSocket tennis live |
| 5173 | node dev server | Dev (à investiguer) |
| 8000 | uvicorn FastAPI | Backend secondaire (routes `/api/*` non-`v1`) |
| 443 | nginx | Reverse proxy public |

**Note** : SetPoint (Next.js) **n'est pas actif** sur pariscore.fr — le backend officiel est bien le Node.js `server.js`.

## 3. Diagnostic (étapes)

1. `curl https://pariscore.fr/api/v1/matches` → 404 (alors que `curl http://localhost:3000/api/v1/matches` → 401, route qui existe)
2. Inspection config nginx `/etc/nginx/sites-enabled/pariscore` : règle `location /api/ { proxy_pass http://127.0.0.1:8000/; }` à la ligne 101
3. Confirmation : le HTML servi est bien `pariscore.html` (commentaire `bd ParisScorebis-qt49`), **sans marqueur Next.js** (`__NEXT_DATA__`, `_next/static` absents)
4. Test `apiFetch` frontend : ajoute `Authorization: Bearer <token>`, intercepte le 401 pour ouvrir le modal d'auth — mais recevait un 404 qui n'était pas géré

## 4. Fix appliqué

Ajout d'une règle nginx **avant** la règle générique `/api/` (longest-prefix match) :

```nginx
# FIX BUG PROD 2026-07-07 : /api/v1/* doit aller vers Node.js pariscore (port 3000)
location /api/v1/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 10s;
}
```

- Backup config : `/home/ubuntu/nginx-pariscore-backup-20260707-020724.conf`
- Validation : `sudo nginx -t` ✅
- Application : `sudo systemctl reload nginx`

## 5. Vérifications post-fix

### Tests API (curl)

| Endpoint via pariscore.fr | Avant | Après |
|---|---|---|
| `/api/v1/status` | 404 | **200** (`matchCount: 37`) |
| `/api/v1/matches` sans token | 404 | **401** (→ modal login propre) |
| `/api/v1/auth/login` admin | 404 | **200 + token JWT** |
| `/api/v1/matches` avec token | 404 | **200 + 36 matchs** ✅ |

### Test E2E navigateur (Playwright Chromium)

| Contrôle | Résultat |
|---|---|
| Page d'accueil charge | ✅ Titre correct |
| Message "Impossible de récupérer" | ✅ ABSENT |
| Message "Erreur de chargement" | ✅ ABSENT |
| Modal d'auth (visiteur non connecté) | ✅ Visible (comportement attendu) |
| Erreurs console | ✅ Aucune |
| Routes API `/api/v1/*` | ✅ **Toutes 200** (tennis/live, top-matches, accuracy, affiliates, forecasts, value-bets, player-photos) |

## 6. Impact

- **Utilisateurs** : l'application est de nouveau fonctionnelle. Les visiteurs non connectés voient le modal d'inscription (freemium), les utilisateurs connectés voient les matchs (36 actuellement).
- **Données** : aucune perte (le serveur Node.js tournait correctement avec 37 matchs en mémoire pendant tout l'incident — seul le routage nginx était en cause).

## 7. Leçons

1. **Migration SetPoint → PariScore inachevée** : la config nginx a été adaptée pour SetPoint mais n'a jamais été restaurée pour le backend Node.js `pariscore`. Le `CR-LANCEMENT` Phase 1 mentionnait bien le serveur Node.js comme backend, mais la confusion "SetPoint est le nouveau backend" a failli nous induire en erreur.
2. **Le fix aurait pu être trouvé plus tôt** si un test E2E post-déploiement avait été systématique (le BILAN §6.3 le prévoit pour Phase 2, mais pas Phase 1).
3. **Recommendation** : ajouter un healthcheck post-déploiement qui vérifie `https://pariscore.fr/api/v1/status` après chaque release.

## 8. Actions preventives recommandées

- [ ] Committer la config nginx corrigée dans le repo (référence)
- [ ] Ajouter un test E2E Playwright dans la CI qui vérifie le rendu de la page matchs
- [ ] Documenter l'architecture réelle (1 backend Node.js + 1 FastAPI secondaire) dans `CLAUDE.md`
- [ ] Nettoyer les routes nginx legacy SetPoint (`/api/tennis/`, `/api/email/`, `/api/push/`, `/_next/static/`) si vraiment inutilisées

---

*CR finalisé le 2026-07-07 — incident résolu en ~1h.*
