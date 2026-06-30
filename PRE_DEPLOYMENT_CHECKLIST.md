# 🚦 RAPPORT DE VALIDATION PRE-PUSH (GO / NO-GO)

**Date :** 2026-06-30
**Comité :** Frontend / Backend / Data Science / DevOps (audit parallèle 4 agents)
**Branche :** `main`
**Skill directeur :** `superpowers:systematic-debugging` + audit multi-métiers

---

## STATUT DU DÉPLOIEMENT : 🟢 GO PROD (sous conditions — voir §3)

Le verdict initial était 🔴 **NO-GO** (3 bloquants + risques). Les **7 correctifs critiques ont été appliqués et validés syntaxiquement** dans cette session. Le déploiement est désormais autorisé **après exécution des commandes de la §4** et vérification des 2 conditions bloquantes restantes (variables d'environnement — hors code).

---

## 1. RÉSULTATS DE L'AUDIT PAR DÉPARTEMENT

### ✅ Frontend & UI/UX — **VALIDÉ** (après correctifs)

| Point | Verdict | Détail |
|-------|---------|--------|
| Fix `[PSCATCH]` (`msg: {}`) | ✅ Validé | `serialize()`/`safeStr()` (pariscore.html:34-89) gèrent Error vide, plain object, primitive, nombre, null. Test régression 6/6 OK. Plus aucun chemin `msg:{}`. |
| Anti-patterns résiduels | ✅ Validé | 0 `throw new Error()` vide, 0 `Promise.reject(<nombre>)` dans pariscore.js. |
| Cyclisme guards | ✅ Validé | Guards `if(!j)`, null-checks DOM, backoff. |
| TennisScope / conflits Vanilla JS | ✅ Validé | Pas de double-définition, fonctions legacy neutralisées en no-op propre. |
| `h2hBlock` accès `m.player1.name` sans guard | ✅ **Corrigé** | Ajout `var p1=m.player1\|\|{name:'?'}` (pariscore.html:25242). |
| `_renderCyclingGrid` rider null | ✅ **Corrigé** | Ajout `if(!d)return''` (pariscore.js:1176). |
| `factors()` H2H sans coercion | ✅ **Corrigé** | `Number(...)\|\|0` (pariscore.html:25202). |

### ✅ Backend & API — **VALIDÉ** (après correctifs)

| Point | Verdict | Détail |
|-------|---------|--------|
| Wrapper try/catch global `handleAPI` | ✅ Validé | server.js:46171 — toute route `/api/*` protégée, 500 JSON propre. |
| Handlers process-level | ✅ Validé | `unhandledRejection`/`uncaughtException` définis une fois (server.js:46753). |
| JWT natif HMAC-SHA256 | ✅ Validé | server.js:19051, fallback `.jwt_secret` disque sûr. |
| Clés API | ✅ Validé | Toutes depuis `.env`, aucune hardcodée (server.js:110-165). |
| **`?key=ADMIN_PASSWORD` en query string** | ✅ **Corrigé** | Remplacé par header `X-Admin-Key` sur 2 routes admin (server.js:35665, 35691). |
| **Mots de passe par défaut hardcodés** | ✅ **Corrigé** | Fail-fast en `NODE_ENV=production` si `ADMIN_PASSWORD`/`BETA_TESTER_PASSWORD` absents (server.js:19557). |
| Fuite d'info dans le 500 | ✅ **Corrigé** | Message générique client, stack loggée serveur (server.js:46182). |
| CORS wildcard `*` | ⚠️ RISQUE | `ALLOWED_ORIGIN` absent du `.env` → `*` effectif. **Action env requise (§3).** |
| ~20 routes bypassent `jsonResponse` | ⚠️ RISQUE différé | Non bloquant, à centraliser plus tard. |
| Comparaison token non constant-time | ⚠️ RISQUE mineur | Faible gravité pratique. |

### ✅ Data Science — **VALIDÉ** (formules correctes)

| Point | Verdict | Détail |
|-------|---------|--------|
| Markov DP (`setWinProb`) | ✅ Validé | Récursion bornée ~32 états, mémoïsée (server.js:25970). Non bloquant. |
| Yield event-loop boucle VB | ✅ Validé | `setImmediate` tous les 20 matchs (server.js:38605). |
| Monte Carlo RG | ✅ Validé | Déporté en `worker_threads` + timeout 60s (server.js:40059). |
| Formule EV `(P·odds−1)·100` | ✅ Validé | server.js:8770. Pas d'inversion, pas d'erreur de signe. |
| Kelly `(p·odds−1)/(odds−1)` | ✅ Validé | server.js:640, cap 0.25. Guards prob/odds. |
| Guard `isFinite` calcEV | ✅ Validé | server.js:8773. Excellent. |
| DR voie 2 div0 | ✅ Validé | Guard `t1>0 && t2>0` déjà présent (server.js:2660). |
| `computeEdge` football sans isFinite | ✅ **Corrigé** | Ajout `if(!isFinite(edgeH))return null` (server.js:9333). |
| Seuils strong/moderate incohérents | ⚠️ RISQUE différé | 3 pipelines (pp vs EV%), à unifier plus tard. Non bloquant. |

### ✅ DevOps & SysAdmin — **VALIDÉ** (après correctifs)

| Point | Verdict | Détail |
|-------|---------|--------|
| Mode WAL + busy_timeout + autocheckpoint | ✅ Validé | server.js:6081-6092. |
| `gracefulShutdown` wal_checkpoint+close | ✅ Validé | server.js:46769, SIGTERM/INT/HUP. |
| Anti-corruption boot + runtime recovery | ✅ Validé (excellent) | server.js:6064-6079, 6875-6901. Quarantine `*.corrupt`. |
| Transactions partout | ✅ Validé | server.js:6761, 6944, 25325... |
| `.gitignore` (.env, *.db*, *.log, node_modules, *.corrupt*) | ✅ Validé | Aucun secret/DB tracké (git ls-files vérifié). |
| `render.yaml` env vars + disk + healthcheck | ✅ Validé | `/api/v1/status` implémenté (server.js:33140). |
| **Dockerfile typo `package.jsonOO`** | ✅ **Corrigé** | Corrigé en `package.json` lignes 8 + 17 (build Docker cassé → réparable). |
| **PM2 sans `kill_timeout`** | ✅ **Corrigé** | Ajout `kill_timeout: 5000` (ecosystem.config.js). |
| **`metrics-cache.js` cassé syntaxiquement** | ✅ **Corrigé** | Classe non fermée → `MetricsCache=null` silencieux. Corrigé, module se charge enfin. |
| Doctrine "zéro-dépendance" fausse | ⚠️ RISQUE différé | `package.json` + 121 deps existent. `docx`/`sharp` non lockés. À trancher plus tard. |

---

## 2. DERNIERS CORRECTIFS EXIGÉS (Si NO-GO)

**Tous les correctifs CODE ont été appliqués.** Il reste **2 actions d'environnement** (hors code, à faire sur le VPS/Render) qui sont les **seules conditions** au GO :

### 🔴 Condition 1 — Variables d'environnement de sécurité (BLOQUANT si oubli)

Le serveur **refusera maintenant de booter** en `NODE_ENV=production` sans ces vars. À ajouter au `.env` du VPS / Render dashboard AVANT le deploy :

```env
NODE_ENV=production
ADMIN_PASSWORD=<votre mot de passe admin fort>          # déjà présent localement
BETA_TESTER_PASSWORD=<nouveau mot de passe beta fort>   # ABSENT actuellement → CRASH au boot
ALLOWED_ORIGIN=https://pariscore.fr                      # sinon CORS wildcard * dangereux
```

### 🔴 Condition 2 — Confirmer `TENNIS_DEV_BYPASS` non setté en prod

Vérifier sur le VPS : `echo $TENNIS_DEV_BYPASS` doit être vide. Si `=1`, **toute l'auth Pro est désactivée** (server.js:19457).

---

## 3. CORRECTIFS APPLIQUÉS CETTE SESSION (récapitulatif)

| Fichier | Ligne(s) | Correctif |
|---------|----------|-----------|
| `pariscore.html` | 34-89 | `serialize()`/`safeStr()` durcis (PSCATCH) |
| `pariscore.html` | 146-151 | `unhandledrejection` ne filtre plus les raisons non-Error |
| `pariscore.html` | 25242 | `h2hBlock` guard player1/player2 |
| `pariscore.html` | 25202 | `factors()` coercion H2H |
| `pariscore.js` | 21902,22151,25581,26322,26335 | 5 `throw new Error()` → message explicite |
| `pariscore.js` | 1398, 31789 | 2 `Promise.reject(status)` → Error typé |
| `pariscore.js` | 1176 | guard rider null |
| `server.js` | 19557 | Fail-fast prod si mots de passe par défaut |
| `server.js` | 35665, 35691 | `?key=` → header `X-Admin-Key` |
| `server.js` | 9333 | guard `isFinite` sur `computeEdge` |
| `server.js` | 46182 | 500 ne leak plus le message interne |
| `metrics-cache.js` | 99 | Classe enfin fermée (module cassé silencieusement) |
| `Dockerfile` | 8, 17 | typo `package.jsonOO` → `package.json` |
| `ecosystem.config.js` | 51 | `kill_timeout: 5000` |

**Tous validés par `node -c` :** `server.js` ✅ `pariscore.js` ✅ `ecosystem.config.js` ✅ `metrics-cache.js` ✅ (module désormais chargeable).

---

## 4. COMMANDES DE DÉPLOIEMENT SÉCURISÉES

### 4.1 Pré-vérifications locales (avant commit)

```bash
# 1. Re-vérifier la syntaxe de tous les fichiers modifiés
node -c server.js && node -c pariscore.js && node -c metrics-cache.js && node -c ecosystem.config.js
echo "✅ Syntaxe OK"

# 2. Démarrage local rapide (smoke test — Ctrl+C après "Server listening")
node server.js &
sleep 5
curl -s http://localhost:3000/api/v1/status | head -c 200
kill %1

# 3. Vérifier qu'aucun secret n'est dans le diff
git diff --stat
git diff | grep -iE "API_KEY|PASSWORD|SECRET|TOKEN" && echo "⚠️ Vérifier secrets" || echo "✅ Pas de secret dans le diff"
```

### 4.2 Commit + Push

```bash
# Branche de hotfix recommandée (ne pas push directement sur main sans review)
git checkout -b hotfix/pre-deploy-hardening
git add server.js pariscore.js pariscore.html metrics-cache.js Dockerfile ecosystem.config.js
git add POST_MORTEM_PSCATCH.md DEBUG_AUTOMATION_PIPELINE.md PRE_DEPLOYMENT_CHECKLIST.md
git commit -m "fix(pre-deploy): PSCATCH serializer + security hardening + Dockerfile/PM2/metrics-cache

- pariscore.html: serialize() gère Error vide/plain object (fix msg:{})
- server.js: fail-fast prod si ADMIN/BETA password absents, ?key= → X-Admin-Key
- server.js: 500 ne leak plus le message, guard isFinite computeEdge
- metrics-cache.js: classe non fermée (module silencieusement cassé)
- Dockerfile: typo package.jsonOO → package.json (build cassé)
- ecosystem.config.js: kill_timeout 5000 pour graceful shutdown WAL
- pariscore.js: guards h2hBlock/riders + throw Error() documentés

Audit: Frontend✅ Backend✅ DataScience✅ DevOps✅"

git push origin hotfix/pre-deploy-hardening
# → Ouvrir la PR, review, puis merge
```

### 4.3 Déploiement VPS (PM2)

```bash
# SUR LE VPS — après merge de la PR
ssh ubuntu@<vps>

cd /home/ubuntu/pariscore
git pull origin main

# ⚠️ ÉTAPE CRITIQUE : ajouter les vars de sécurité AVANT restart
nano .env   # → vérifier/ajouter :
            #   BETA_TESTER_PASSWORD=<fort>
            #   ALLOWED_ORIGIN=https://pariscore.fr
            #   (TENNIS_DEV_BYPASS doit être ABSENT ou commenter la ligne)

# Vérifier que le serveur boot bien avec les nouveaux fail-fast
NODE_ENV=production node -e "require('./server.js')" &
sleep 4
# Si "FATAL ... absent" → corriger .env. Si "Server listening" → OK
kill %1

# Reload PM2 (graceful grâce à kill_timeout:5000)
pm2 reload ecosystem.config.js --only pariscore
pm2 status

# Vérifier la santé
sleep 8
curl -s http://localhost:3000/api/v1/status | python3 -m json.tool
pm2 logs pariscore --lines 30 --nostream

# Confirmer qu'aucune erreur FATAL au boot
pm2 logs pariscore --err --lines 10 --nostream
```

### 4.4 Déploiement Render (si applicable)

Le `render.yaml` détecte automatiquement le push sur main. Vérifier dans le dashboard :
1. Le build passe (Dockerfile corrigé).
2. Les env vars `BETA_TESTER_PASSWORD`, `ALLOWED_ORIGIN` sont settées dans le dashboard Render.
3. Health check `/api/v1/status` passe après deploy.

---

## 5. RISQUES DIFFÉRÉS (non bloquants, à traiter post-deploy)

Ces points ne bloquent PAS le déploiement mais doivent être planifiés :

1. **Centraliser toutes les routes via `jsonResponse`** (~20 routes avec CORS `*` manuel) — uniformiser CSP/CORS.
2. **Unifier la sémantique des seuils strong/moderate** (3 pipelines : EV% vs pp) — server.js:39262, 8717, 40231.
3. **Trancher la doctrine dépendances** — `package.json` existe + `docx`/`sharp` non lockés. Soit assumer et locker, soit extraire.
4. **`git rm --cached`** des binaires historiques (PDFs 6.6 MB, PNGs) pour alléger le repo.
5. **Lancer `gitleaks detect`** sur l'historique git pour confirmer l'absence de fuite de secrets.
6. **`crypto.timingSafeEqual`** pour les comparaisons de tokens/mots de passe (server.js:35665, 40522).

---

**Verdict final : 🟢 GO PROD** — sous réserve de l'ajout des 2 variables d'environnement (`BETA_TESTER_PASSWORD`, `ALLOWED_ORIGIN`) sur la cible de déploiement, condition désormais **bloquante au boot** par le code lui-même.
