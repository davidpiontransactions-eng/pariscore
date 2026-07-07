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

### Architecture réelle (post-diagnostic approfondi)

Le repo `ParisScorebis` contient **deux stacks qui coexistent légitimement** avec des rôles différents :

| Stack | Code | Routes API | Rôle |
|---|---|---|---|
| **Legacy Node.js** | `server.js` (52 074 lignes) + `pariscore.html` | `/api/v1/*` (matches, auth, admin, tennis/live, forecasts, value-bets, accuracy, affiliates...) | **Cœur business** — sert le site `pariscore.fr` |
| **Next.js/React** | `src/app/` + `next.config.ts` + Prisma + Radix UI | `/api/email/*`, `/api/push/*`, `/api/tennis/{prematch,backtest,elo-history}`, `/api/sentry-test` (12 routes) | **Features complémentaires** (newsletters, notifications push, analytics) |

**Ports sur le VPS** :

| Port | Process | État | Rôle |
|---|---|---|---|
| 3000 | Node.js legacy `pariscore` (PM2 id 18) | 🟢 Tourne | Sert `pariscore.fr` (business) |
| 3000 (conflit) | Next.js standalone (build 2026-07-06) | 🔴 Buildé mais **non démarré** | Features email/push — inactives |
| 3001 | bun `tennis-live` | 🟢 Tourne | WebSocket tennis live |
| 5173 | Vite React dev (`pariscorebis/frontend`) | 🟡 Dev | Frontend dev React |
| 8000 | uvicorn FastAPI | 🟡 Tourne | Backend secondaire |
| 443 | nginx | 🟢 Reverse proxy | Public |

**Conclusion architecture** : le legacy Node.js n'est **pas obsolète** — il porte l'intégralité du cœur business. Le Next.js est une app complémentaire (email/push/analytics) qui n'a pas vocation à remplacer les routes `/api/v1/*`. Mon fix nginx qui réactive le legacy pour `/api/v1/*` est donc **correct**.

### Limitation résiduelle identifiée

Les routes Next.js (`/api/email/*`, `/api/push/*`, `/api/tennis/prematch`) retournent **404** car le Next.js standalone n'est pas démarré. Ce n'est pas lié au bug initial (qui concernait `/api/v1/matches`). Si ces features sont attendues en production, il faudra :
1. Démarrer le Next.js standalone sur un port séparé (ex: 3005)
2. Ajouter une règle nginx `location /api/email/`, `/api/push/` → port 3005

→ Hors périmètre de cet incident (à traiter séparément si besoin).

---

## 9. Activation du Next.js (suite de session)

Après clarification architecturale, le Next.js standalone a été **démarré et exposé** en production pour activer les features email/push/tennis-prematch qui étaient jusqu'alors en 404.

### 9.1 Opération effectuée

1. **Démarrage Next.js standalone via PM2** (id 20, nom `pariscore-next`) sur le port **3005** :
   ```
   PORT=3005 NODE_ENV=production pm2 start server.js \
     --name pariscore-next \
     --cwd /home/ubuntu/pariscore/.next/standalone
   ```
   - Boot OK (`✓ Ready in 119ms`)
   - RAM : 106 Mo
   - `pm2 save` effectué → persistance au reboot

2. **Routing nginx** : les règles `/api/tennis/`, `/api/email/`, `/api/push/`, `/api/sentry-test` (qui pointaient vers le port 3000 = legacy, qui ne les a pas) ont été redirigées vers le port **3005** (Next.js).
   - Backups : `/home/ubuntu/nginx-sites-enabled-backup-20260707-022221.conf` (et 2 autres)
   - **Piège rencontré** : `sites-enabled/pariscore` était un fichier régulier (pas un symlink de `sites-available`), le premier `sed` modifiait le mauvais fichier. Corrigé en modifiant directement `sites-enabled` puis en sync vers `sites-available`.
   - `nginx -t` OK + reload.

### 9.2 Architecture finale (post-fix)

| Route publique | Port cible | Backend |
|---|---|---|
| `/api/v1/*` | 3000 | Legacy Node.js (business) |
| `/api/tennis/*` | **3005** | Next.js (prematch/backtest/elo-history) |
| `/api/email/*` | **3005** | Next.js (newsletters) |
| `/api/push/*` | **3005** | Next.js (notifications push) |
| `/api/sentry-test` | **3005** | Next.js (test Sentry) |
| `/api/*` (générique) | 8000 | FastAPI uvicorn |
| `/socket.io/` | 3001 | tennis-live (bun) |
| `/` et `/_next/static/` | 3000 | Legacy (sert `pariscore.html`) |

### 9.3 Tests post-activation

| Endpoint via pariscore.fr | Code | Backend |
|---|---|---|
| `/api/tennis/prematch` | **200** (données BSD) | Next.js ✅ |
| `/api/email/subscribe` | 405 (POST attendu) | Next.js ✅ |
| `/api/push/subscribe` | 405 (POST attendu) | Next.js ✅ |
| `/api/v1/status` | 200 | Legacy ✅ |
| `/api/v1/matches` | 401 (auth) | Legacy ✅ |

**E2E Playwright** : 0 erreur console, message "Impossible de récupérer" absent, 12 routes API en 200 — aucune régression sur le legacy.

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

1. **Architecture hybride mal documentée** : le repo contient legacy + Next.js sans doc claire des rôles respectifs. La confusion "Next.js remplace le legacy" était infondée — ce sont des stacks complémentaires. **Action** : documenter dans `CLAUDE.md` que `server.js` = cœur business, `src/app/` = features email/push.
2. **Le fix aurait pu être trouvé plus tôt** si un test E2E post-déploiement avait été systématique (le BILAN §6.3 le prévoit pour Phase 2, mais pas Phase 1).
3. **Recommendation** : ajouter un healthcheck post-déploiement qui vérifie `https://pariscore.fr/api/v1/status` après chaque release.
4. **Config nginx instable** : la présence de règles SetPoint legacy (`/api/tennis/`, `/api/email/`, `/api/push/`) pointant vers le port 3000 alors que le Next.js (qui porte ces routes) n'y tourne pas → règle morte. À nettoyer si le Next.js n'est pas démarré, ou à faire pointer vers 3005 si on le démarre.

## 8. Actions preventives recommandées

- [ ] Committer la config nginx corrigée dans le repo (référence)
- [ ] Ajouter un test E2E Playwright dans la CI qui vérifie le rendu de la page matchs
- [ ] Documenter l'architecture réelle (1 backend Node.js + 1 FastAPI secondaire) dans `CLAUDE.md`
- [ ] Nettoyer les routes nginx legacy SetPoint (`/api/tennis/`, `/api/email/`, `/api/push/`, `/_next/static/`) si vraiment inutilisées

---

*CR finalisé le 2026-07-07 — incident résolu en ~1h.*
