---
name: ps-deploy
description: PariScore deployment checklist for Render.com — verifies syntax, environment variables, render.yaml config, and guides through the deploy steps.
---

# PariScore — Déploiement Render.com

## Déclencheur
Quand l'utilisateur veut déployer sur Render.com ou vérifier que tout est prêt pour la prod.

## Checklist pré-déploiement

### 1. Syntaxe obligatoire
```bash
node --check server.js
```
**STOP si erreur** — ne jamais déployer avec une erreur de syntaxe.

### 2. Variables d'environnement requises
Vérifier que `render.yaml` contient bien ces env vars (ou les configurer dans le dashboard Render) :

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `ODDS_API_KEY` | ✅ | The Odds API — 500 req/mois |
| `API_FOOTBALL_KEY` | ✅ | API-Football PRO — 7500 req/jour |
| `GEMINI_API_KEY` | ✅ | Google AI Gemini Flash |
| `JWT_SECRET` | ✅ | Auto-généré si absent (insécure en prod → forcer) |
| `ADMIN_PASSWORD` | ✅ | Changer de `pariscore2026` en prod |
| `PORT` | auto | Render injecte `$PORT` automatiquement |
| `ALLOWED_ORIGIN` | ✅ | Remplacer `*` par le domaine Render |
| `TELEGRAM_BOT_TOKEN` | ⚠️ optionnel | Alertes Telegram |
| `TELEGRAM_CHAT_IDS` | ⚠️ optionnel | IDs séparés par virgule |
| `ALERT_EDGE_THRESHOLD` | ⚠️ optionnel | Défaut : 8 |

### 3. Fichiers à NE PAS déployer
Vérifier `.gitignore` contient :
```
.env
database.json
history.json
ai_cache.json
pariscore.db
pariscore.db-shm
pariscore.db-wal
node_modules/
```

### 4. render.yaml — points clés
- `plan: starter` (ou supérieur pour le disque persistant)
- `disk` monté sur `/data` pour persister `pariscore.db`
- `SQLITE_FILE` doit pointer sur `/data/pariscore.db` en prod
- `buildCommand: npm install` (pour `better-sqlite3`)
- `startCommand: node server.js`

### 5. Vérifications post-déploiement

Tester les routes critiques après deploy :
```
GET /api/v1/status        → { status: "ok", matches: N, ... }
GET /api/v1/matches       → tableau de matchs (ou mode démo si APIs down)
GET /api/v1/accuracy      → métriques backtesting
GET /api/v1/ai-scout      → analyse Gemini (peut prendre 10-30s première fois)
GET /api/v1/top-strategy?type=BTTS_YES → { matches: [...] }
```

### 6. Commandes de déploiement

**Via GitHub (recommandé)** :
```bash
git add -A
git commit -m "deploy: description"
git push origin main
# Render redéploie automatiquement
```

**Manuel (Render CLI)** :
```bash
render deploy --service pariscore
```

### 7. Points de vigilance en prod

| Risque | Mitigation |
|--------|------------|
| `pariscore.db` perdu au redeploy | Disque persistant Render (`/data`) obligatoire |
| Quota Odds API 500/mois | Cron 12h — vérifier `x-requests-remaining` dans logs |
| Gemini quota | Cache 6h AI Scout + cache 24h par match |
| CORS trop large (`*`) | Setter `ALLOWED_ORIGIN=https://mondomaine.onrender.com` |
| JWT_SECRET faible | Générer avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 8. Après déploiement réussi
Mettre à jour `CLAUDE.md` pied de page avec l'URL de prod et la date.

## Gotchas (failure points observed in production)

- **`git add -A` en commit** → peut inclure `.env` ou `pariscore.db` si `.gitignore` mal configuré. Toujours `git add <specific files>`.
- **SQLite perdu au redeploy Render** → Render efface le filesystem entre deploys sauf disk persistant monté. Sans `/data`, toute la DB historique disparaît.
- **`node --check` passe mais runtime crash** → `node --check` valide la syntaxe, pas les imports. `require('better-sqlite3')` peut échouer si `npm install` n'a pas tourné (Render : vérifier `buildCommand`).
- **OVH VPS ≠ Render** → le projet déploie sur VPS OVH `/home/ubuntu/pariscore` via `git pull + pm2 restart`, PAS Render. Ne pas confondre les deux environnements.
- **pm2 restart ne prend pas le nouveau code** → toujours `git pull` PUIS `pm2 restart pariscore`. L'ordre compte.
- **BSD websocket silencieux après restart** → le WS BSD se reconnecte automatiquement via `reconnectBSDWebSocket()`, mais peut mettre 30s. Vérifier `pm2 logs pariscore | grep BSD` après restart.

