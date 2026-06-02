---
name: ps-deploy
description: PariScore VPS deployment via scripts/update_vps.sh — git sync, npm rebuild, pm2 restart, post-restart stability check. Use when deploying to production, pushing a hotfix, after commits pushed to main, or when user says "déploie", "deploy", "push sur le VPS", "mets à jour le VPS".
---

# PariScore — Déploiement VPS OVH

## Infos VPS
- SSH alias : `pariscore` (→ ubuntu@51.75.21.239)
- Répertoire : `/home/ubuntu/pariscore`
- Process PM2 : `server` (id 6) — **pas** `pariscore`
- Script deploy : `scripts/update_vps.sh`

---

## Étape 1 — Syntaxe gate (local, obligatoire)

```bash
node --check server.js
```

**STOP si erreur.** Ne jamais déployer avec une erreur de syntaxe.

---

## Étape 2 — Push local → remote

```bash
git pull --rebase && git push
```

Vérifier que `git status` affiche "up to date with origin/main" avant deploy.

---

## Étape 3 — Déploiement VPS

```bash
ssh pariscore "cd /home/ubuntu/pariscore && bash scripts/update_vps.sh"
```

Le script fait (6 étapes) :
1. `git fetch --all`
2. `git reset --hard origin/main`
3. `git pull --rebase origin main`
4. `npm install --omit=dev`
5. `npm rebuild better-sqlite3` ← guard Node version mismatch
6. `pm2 restart server --update-env`

---

## Étape 4 — Vérification stabilité post-restart

Attendre 12 secondes puis vérifier :

```bash
ssh pariscore "sleep 12 && pm2 list && pm2 logs server --lines 10 --nostream 2>&1 | tail -15"
```

**Critères de succès :**
- PM2 status = `online`
- Même PID après 12s (pas de crash loop)
- Mémoire > 100MB (serveur chargé)
- Restart count n'a pas augmenté depuis le restart initial
- Logs out : lignes `✓ leagues_config.json` / `✓ bsd_config.json` / `✓ VAPID keys`
- Logs err : warnings métier uniquement (Poisson λ invalide, Fuzzy match, Standings BSD) — pas d'erreur `MODULE_VERSION` ou `Cannot find module`

**Si crash loop (restart count monte rapidement) :**
```bash
ssh pariscore "cd /home/ubuntu/pariscore && npm rebuild better-sqlite3 && pm2 restart server --update-env"
```
Cause probable : Node version mismatch sur `better-sqlite3` binary.

---

## Routes critiques à vérifier

```
GET /api/v1/status          → { status: "ok", matches: N }
GET /api/v1/matches         → tableau matchs (ou mode démo si APIs down)
GET /api/v1/tennis/matches  → matchs tennis BSD+ESPN
GET /api/v1/cs2/matches     → matchs CS2 (HLTV + BSD)
```

---

## Gotchas production

| Risque | Mitigation |
|--------|------------|
| `better-sqlite3` Node mismatch | `npm rebuild better-sqlite3` puis restart |
| `git pull` bloqué par fichier local | `git reset --hard origin/main` force-align |
| PM2 process name = `server` pas `pariscore` | Toujours `pm2 restart server` |
| BSD WS silencieux après restart | Reconnect auto via `reconnectBSDWebSocket()` — attendre 30s, vérifier `pm2 logs server \| grep BSD` |
| Mutex non relâché → cron bloqué | Check `pm2 logs server \| grep -i "mutex\|isFetching"` |
| `.env` absent ou incomplet | `pm2 logs server \| grep -i "error\|missing\|undefined"` au boot |
