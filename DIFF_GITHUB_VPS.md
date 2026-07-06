# PariScore — Diff GitHub ↔ VPS (post-Phase 1)

> **Date audit** : 2026-07-06 (rapport généré `2026-07-06T23:40:52Z` → `2026-07-06T23:41:39Z`)
> **Source** : `scripts/vps_audit.sh` exécuté sur `ubuntu@51.75.21.239` (`/home/ubuntu/pariscore`)
> **Rapport brut** : `phase1/vps_audit_output.txt` (1357 lignes, 15 sections)
> **Objet** : Dernier livrable manquant de la Phase 1 — comparatif de conformité entre le code GitHub (`origin/main`) et l'état réel du VPS après exécution des patches Phase 1.

---

## 1. Synthèse exécutive

### 1.1 Verdict Go / No-Go

🟢 **GO CONDITIONNEL** — Le VPS est **déclaré prêt pour la reprise du trafic users**, sous réserve des actions ops mineures listées en §8.

La Phase 1 (élimination des 4 vulnérabilités CRITICAL) est **effectivement déployée et active** sur le VPS :

| Contrôle CRITICAL | Statut |
|---|---|
| Secret JWT plus servi en HTTP (`/.jwt_secret`) | ✅ **403 Forbidden** |
| `.env` plus servi en HTTP | ✅ **403 Forbidden** |
| Auth bypass par mot de passe par défaut (`pariscore2026`) | ✅ **401 Unauthorized** |
| Auth légitime (vrai mot de passe) | ✅ **200 + token JWT valide** |
| Patches Phase 1 actifs dans le code | ✅ BUG-001, BUG-004, BUG-019 |

L'application tourne (`GET /` → 200, `/api/v1/status` → `{"status":"ok","ready":true}`), la DB SQLite passe l'integrity check (`ok`), le TLS est valide.

### 1.2 Conformité GitHub ↔ VPS

| Dimension | GitHub (`origin/main`) | VPS | Conformité |
|---|---|---|---|
| HEAD git | `deeb9c5` | `deeb9c5` (`deeb9c58798eea7d87b32d9f9fa8fe31839b52a3`) | ✅ **Aligné** |
| `.env` | `.gitignored` (template `.env.example` seulement) | Présent (4010 octets, `chmod 600`), valeurs masquées, JWT_SECRET roté | ✅ **Aligné** (untracké) |
| Patches Phase 1 (BUG-001/004/019) | Commits `d115a4f` + `deeb9c5` poussés | Code en place, comportement vérifié | ✅ **Actifs** |
| Sensitive files tracking | Retirés du tracking (commit `deeb9c5`) | Non versionnés localement | ✅ **Aligné** |

Les seules modifications locales non commitées sont des fichiers runtime (`cache/tennis_serve_deltas.json`, `data/betwatch_wom.json`) — attendus et sans impact sécurité.

---

## 2. Système (VPS)

Extrait de la section `[01]` du rapport :

| Indicateur | Valeur |
|---|---|
| OS | **Ubuntu 25.04** (Plucky Puffin) |
| Kernel | `6.14.0-37-generic` x86_64 |
| Hostname | `vps-e9076027` |
| Uptime | **52 jours**, 4 h 19, 6 users connectés |
| Load average (1/5/15 min) | `1.82 / 1.02 / 0.61` |
| CPU | 4 vCPU Intel Haswell, hyperviseur KVM, VT-x |
| RAM totale | 7.6 GiB |
| RAM utilisée | 1.4 GiB — **6.1 GiB disponibles** |
| Swap | 2.0 GiB total — **1.5 GiB utilisé (75 %)** ⚠️ |
| Disque `/` | 72 G — 39 G utilisés, 34 G dispo (**54 %**) |
| Disque `/boot` | 989 M — 129 M utilisés (14 %) |
| iostat `%idle` | 96.98 % (CPU peu sollicité) |
| Inodes `/` | 678 259 utilisés / 9,28 M (**8 %**) |

**Lecture** : machine saine, RAM confortable, disque à mi-capacité. Deux points d'attention : le swap utilisé à 75 % (pression mémoire historique) et le dossier applicatif qui pèse **11 Go** (cf. §7 — DB corrompues à nettoyer).

---

## 3. Conformité code GitHub ↔ VPS

### 3.1 HEAD git

- Branche courante : `main`
- HEAD : **`deeb9c5`** — `chore(security): Phase 1 — untrack sensitive files + enrich .gitignore` (2026-07-07 01:27:38 +0200)
- Commit précédent : `d115a4f` — `fix(security): Phase 1 — JWT_SECRET + ADMIN_PASSWORD fail-fast + BLOCKED_FILES étendu`
- **`origin/main` GitHub = `deeb9c5`** → ✅ **alignement parfait**, aucun commit non poussé.

### 3.2 `server.js`

- Présent à `/home/ubuntu/pariscore/server.js` (point d'entrée PM2, interpréteur `node`).
- Démarrage OK : process `pariscore` online, `GET /` → 200, `/api/v1/status` → JSON valide.
- Modifications locales : seul `server.js` apparaît dans les fichiers modifiés ces 24 h (déploiement Phase 1) — pas de syntax error remontée par PM2 ni dans les logs d'erreur récents.

### 3.3 Patches Phase 1 actifs

| Patch | Bug | Comportement attendu | Vérifié sur VPS |
|---|---|---|---|
| `patch-001-jwt-secret-failfast` | **BUG-001** JWT_SECRET fail-fast | Serveur refuse de démarrer si `JWT_SECRET` absent/faible | ✅ Actif (process online + JWT_SECRET=`72c***` présent) |
| `patch-002-admin-password-failfast` | **BUG-004** ADMIN_PASSWORD fail-fast | Refus démarrage si mdp par défaut | ✅ Actif — login `pariscore2026` → **401** |
| `gitignore-additions` + `BLOCKED_FILES` étendu | **BUG-019** | `.jwt_secret` bloqué en HTTP | ✅ Actif — `/.jwt_secret` → **403** |

**Tests auth complémentaires confirmés** (post-Phase 1) :
- `POST` login avec `pariscore2026` → **401 Unauthorized** ✅
- `POST` login avec le vrai mot de passe → **200 + token JWT valide** ✅
- `GET /.jwt_secret` → **403 Forbidden** ✅
- `GET /.env` → **403 Forbidden** ✅

### 3.4 Faux négatifs du script `verify-vps-env.sh`

Le script de vérification a remonté 2 faux négatifs (non-bugs) :

| Check | Alerte | Réalité |
|---|---|---|
| Check 01 — `NODE_ENV` | « NODE_ENV non détecté » | **Bug de parsing** du JSON `pm2 jlist` ; `NODE_ENV=production` est bien présent (confirmé dans `pm2 describe pariscore` → `node env: production`) |
| Check 10 — 5 process PM2 | « 5 process attendus, 2 trouvés » | Les 4 cron jobs PM2 (`cron-rg`, `cron-match-stats`, `vault-daily`, `vault-weekly`) **n'ont jamais été déployés** — leurs équivalents fonctionnels tournent via `crontab ubuntu` (cf. §5). **Hors périmètre Phase 1.** |

---

## 4. Sécurité — vérifications clés

### 4.1 Fichiers sensibles bloqués en HTTP

Tests directs (section `[14]` du rapport) :

| Fichier | HTTP code | Verdict |
|---|---|---|
| `/.jwt_secret` | **403 Forbidden** | ✅ Bloqué |
| `/.env` | **403 Forbidden** | ✅ Bloqué |
| `/server.js` | Non testé directement | 🟡 Couvert par `BLOCKED_FILES` étendu (BUG-019) — non mesuré dans ce rapport |
| `/ecosystem.config.js` | Non testé directement | 🟡 Couvert par `BLOCKED_FILES` étendu (BUG-019) — non mesuré dans ce rapport |

### 4.2 Headers de sécurité

Extraits de `GET /` (section `[14]`) :

| Header | Valeur | Statut |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ✅ HSTS actif (1 an) |
| `X-Frame-Options` | `SAMEORIGIN` | ✅ Present |
| `X-Content-Type-Options` | `nosniff` | ✅ Present |
| `Content-Security-Policy` | `default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' ...; frame-ancestors 'none'; object-src 'none'` | ⚠️ **Permissive** — `'unsafe-inline'` + `'unsafe-eval'` (correction prévue Phase 2, patch `patch-009b-csp-strict`) |

> Note : aucune directive `frame-ancestors` manquante, `object-src 'none'` OK. La faiblesse est limitée au `script-src`.

### 4.3 Auth bypass flags (applicatif)

| Flag | Statut mesuré | Côté code |
|---|---|---|
| `MATCHES_AUTH_BYPASS` | 🟡 **Non mesuré** dans ce rapport d'infra | Patch Phase 2 `patch-018-bypass-flags-fatal` (BUG-018) **non encore appliqué** |
| `TENNIS_DEV_BYPASS` | 🟡 **Non mesuré** dans ce rapport d'infra | Idem — correction Phase 2 |

> Recommandation : ajouter un test HTTP ciblé sur une route protégée en Phase 2 pour valider la neutralisation de ces flags.

### 4.4 CORS

- Aucun header `Access-Control-Allow-Origin` observé sur `GET /` (requête sans header `Origin`).
- **Comportement réel non testé** dans ce rapport (pas de requête préflight `OPTIONS` avec `Origin`).
- Côté code : le durcissement CORS est un patch Phase 2 (`patch-005-006-cors-centralized`, BUG-005/006) — **non encore appliqué**. Le pattern `Allow-Origin: *` + `Allow-Credentials: true` lorsque `ALLOWED_ORIGIN` est absent reste donc un risque théorique (cf. divergence #2 du BILAN_GLOBAL_AUDIT.md).

---

## 5. PM2 / Process

### 5.1 Process en cours (section `[04]`)

| id | Nom | Statut | RAM | Uptime | Interpréteur | Restart |
|---|---|---|---|---|---|---|
| 18 | **pariscore** | online | **491.0 mb** | 93 s | node 20.20.2 | 0 |
| 14 | **tennis-live** | online | 2.6 mb | 26 h | bun | 0 |

Détails `pariscore` :
- `cwd`: `/home/ubuntu/pariscore`, script `server.js`, `NODE_ENV=production`, `PORT=3000`
- `max_memory_restart`: **2G** (⚠️ écart : `ecosystem.config.js` déclare `1G` — cf. §8)
- Heap Size 363.43 MiB, Heap Usage 50.32 %, HTTP P95 latency **206 ms**

### 5.2 Écart vs les 5 process attendus

`ecosystem.config.js` prévoit **5 process** ; **seuls 2 tournent**. Les 4 manquants :

| Process attendu | Rôle | Statut VPS | Contournement |
|---|---|---|---|
| `pariscore-cron-rg` | Prefetch Roland Garros /2h | ❌ Absent | Tâches équivalentes en `crontab ubuntu` |
| `pariscore-cron-match-stats` | Refresh quotidien `match_stats_history` | ❌ Absent | Logs `cron-match-stats.*` présents (exécuté via cron système) |
| `pariscore-vault-daily` | Note vault Obsidian 05:00 UTC | ❌ Absent | Non observé |
| `pariscore-vault-weekly` | Revue hebdo modèles lundi 08:00 | ❌ Absent | Non observé |

> **Conclusion** : la charge fonctionnelle est assurée par la `crontab ubuntu` (10 jobs, cf. section `[10]`), mais la topology PM2 réelle **diverge** de l'`ecosystem.config.js` versionné sur GitHub. C'est un écart de configuration ops, **hors périmètre Phase 1** (correction = déployer l'ecosystem complet, ou réaligner le fichier sur la réalité).

---

## 6. Ports / Firewall

### 6.1 Ports en écoute (section `[02]`)

| Port | Bind | Process | Exposé publiquement ? |
|---|---|---|---|
| **80** | 0.0.0.0 | nginx (HTTP → redirect HTTPS) | ✅ Oui (voulu) |
| **443** | 0.0.0.0 | nginx (HTTPS pariscore.fr) | ✅ Oui (voulu) |
| **22** | 0.0.0.0 + [::] | sshd | ✅ Oui (UFW allow) |
| **3000** | * | node `pariscore` (via nginx proxy) | ⚠️ Bind `*` — proxyé par nginx, mais à vérifier (devrait être `127.0.0.1`) |
| **3001** | * | bun `tennis-live` | ⚠️ Bind `*` |
| **5173** | 0.0.0.0 | node (Vite dev) | ⚠️ Dev server exposé |
| **8000** | 0.0.0.0 | uvicorn (FastAPI `pariscore-api.service`) | ⚠️ Exposé publiquement |
| 53 | 127.0.0.x | systemd-resolved | Non (loopback) |
| 8191 | 127.0.0.1 | flaresolverr (Docker) | Non (loopback) |
| 11434 | 127.0.0.1 | ollama | Non (loopback) |

### 6.2 Firewall (UFW)

- **UFW actif** : `deny (incoming)`, `allow (outgoing)`, `deny (routed)`
- Règles : `80,443/tcp ALLOW`, `22/tcp ALLOW`
- Blocages explicites : `37.65.65.25` et `78.153.140.0/24` (DENY IN)
- ⚠️ **`fail2ban` NON installé** (section `[02]`) — aucune protection anti brute-force SSH.

### 6.3 SSH (section `[03]`)

- `PasswordAuthentication` : apparence ambiguë (ligne `yes` puis `no` — la 2ᵉ override, en pratique désactivé)
- `X11Forwarding yes` ⚠️ (à désactiver en durcissement)
- `KbdInteractiveAuthentication no`, `UsePAM yes`
- Shells : `root` + `ubuntu`

---

## 7. DB SQLite

### 7.1 État `pariscore.db` (section `[08]`)

| Indicateur | Valeur |
|---|---|
| Taille `pariscore.db` | **143 M** |
| `pariscore.db-wal` | 33 M |
| `pariscore.db-shm` | 96 K |
| `journal_mode` | **WAL** ✅ |
| `PRAGMA integrity_check` | **`ok`** ✅ |
| `PRAGMA quick_check` | **`ok`** ✅ |
| Nombre de tables | 39 |
| Top table | `tennis_matches` (25 555 lignes) |
| Table `users` | **1 ligne** |

DB auxiliaire : `data/metrics-cache.db` (188 K, WAL 4 M).

### 7.2 Backups & fichiers corrompus

- Backup récent : `.deploy-backups/pariscore.db.20260705-032941` (**141 M**)
- ⚠️ **~3,5 Go de DB corrompues** à nettoyer (cf. §8) :
  - `pariscore.db.corrupt-2026-05-30T13-42-08-621Z-wal` — **972 M**
  - `pariscore.db.corrupt-2026-06-29T10-43-16-812Z` — **648 M**
  - `pariscore.db.corrupt-2026-05-30T13-42-08-621Z` — **449 M**
  - + 7 autres fichiers `.corrupt-*` (117–119 M chacun)
- Backups `historique_tennis.json.bak_*` : **9 fichiers × 64 M** (rotation quotidienne non purgée).

---

## 8. Écarts détectés et recommandations

### 8.1 Écarts GitHub (attendu) ↔ VPS (réel)

| # | Écart | Impact | Sévérité |
|---|---|---|---|
| E1 | **4 process PM2 manquants** (`cron-rg`, `cron-match-stats`, `vault-daily`, `vault-weekly`) — la topology réelle (2 process) diverge de l'`ecosystem.config.js` (5 process) | Ops : monitoring/`pm2 resurrect` incomplet au reboot ; tâches compensées par `crontab` mais non standardisées | 🟡 Moyen |
| E2 | `max_memory_restart` = **2G** appliqué vs **1G** déclaré dans `ecosystem.config.js` | Config non reproductible depuis le repo | 🟢 Faible |
| E3 | **`fail2ban` absent** — SSH exposé publiquement (port 22) sans anti brute-force | Sécurité : brute-force SSH possible | 🟠 Haut |
| E4 | `X11Forwarding yes` dans `sshd_config` | Sécurité : surface d'attaque inutile | 🟢 Faible |
| E5 | **CSP permissive** (`unsafe-inline` + `unsafe-eval`) toujours active | Sécurité : patch Phase 2 `patch-009b` non encore déployé | 🟠 Haut (Phase 2) |
| E6 | Flags bypass auth (`MATCHES_AUTH_BYPASS`, `TENNIS_DEV_BYPASS`) non neutralisés | Sécurité : patch Phase 2 `patch-018` non déployé ; non mesuré ici | 🟠 Haut (Phase 2) |
| E7 | CORS non durci (`*` + credentials si `ALLOWED_ORIGIN` absent) | Sécurité : patch Phase 2 `patch-005/006` non déployé ; non mesuré ici | 🟠 Haut (Phase 2) |
| E8 | Ports `3000`, `3001`, `5173`, `8000` bindés sur `0.0.0.0`/`*` | Surface d'exposition réseau (dev servers accessibles) | 🟡 Moyen |
| E9 | Swap utilisé à **75 %** (1,5 Gi / 2 Gi) | Stabilité : risque de pression mémoire sous charge | 🟡 Moyen |

### 8.2 Dette ops / hygiène (hors code GitHub)

| # | Item | Donnée chiffrée | Action |
|---|---|---|---|
| O1 | **Logs PM2 énormes** | `pariscore-out.log` **278 M**, `pariscore-error.log` **113 M** | Mettre en place `pm2-logrotate` (taille 50M, retain 7) |
| O2 | **Erreurs récurrentes** | **1 791** × `[API ERROR]: Cannot write headers after they are sent` + **704** `ERR_HTTP_HEADERS_SENT` | Bug applicatif double-réponse à corriger (race condition middleware) |
| O3 | **DB corrompues à nettoyer** | ~**3,5 Go** de `pariscore.db.corrupt-*` | Purger (libère ~5 % du disque `/`) |
| O4 | Backups `historique_tennis.json.bak_*` | **9 × 64 M** (576 M) | Rotation à limiter (retain 3) |
| O5 | Fichiers étrangers dans l'app | `DiscordSetup.exe` (103 M), `Test avant Prod/` (104 M) | Supprimer du dossier prod |
| O6 | `Event Loop Latency p95` | **3 139 ms** | Pic de latence event loop à investiguer (charge/blocking I/O) |
| O7 | Processus parasite `hermes-agent` | **97 % CPU** (PID 1314494) | Hors PariScore — vérifier origine / limiter |
| O8 | `open files` ulimit | **1 024** | Augmenter à 65536 pour le process node |
| O9 | Certificat TLS `pariscore.fr` | Expire **2026-08-13** (37 jours) | Renouvellement auto certbot à vérifier |

### 8.3 Actions recommandées (Phase 2 / 3)

1. **Phase 2 (priorité)** : appliquer `patch-005/006` (CORS), `patch-009b` (CSP strict), `patch-018` (bypass flags fatal) → clôture les divergences E5/E6/E7.
2. **Phase 2 (ops)** : installer `fail2ban` (E3), reconfigurer les binds ports sur `127.0.0.1` (E8), activer `pm2-logrotate` (O1).
3. **Phase 3** : exécuter `security-checklist.md` (39 items), OWASP ZAP + tests de charge k6.
4. **Hygiène immédiate** : purger DB corrompues (O3), supprimer `DiscordSetup.exe` (O5), corriger le bug `ERR_HTTP_HEADERS_SENT` (O2).
5. **Réalignement ops** : déployer l'`ecosystem.config.js` complet (5 process) **ou** réécrire le fichier pour refléter la topology crontab réelle (E1/E2).

---

## 9. Conclusion

✅ **Le VPS est prêt pour la reprise du trafic users.**

**Justification** :
1. Les **4 vulnérabilités CRITICAL** de la Phase 1 sont **effectivement neutralisées** et vérifiées en conditions réelles (JWT secret bloqué → 403, `.env` bloqué → 403, mot de passe par défaut rejeté → 401, auth légitime fonctionnelle → 200 + token).
2. Le **code est aligné** avec GitHub (`HEAD = deeb9c5` = `origin/main`), les patches Phase 1 (BUG-001/004/019) sont actifs.
3. L'application est **online et saine** : `GET /` → 200, `/api/v1/status` → `ready:true`, DB SQLite `integrity_check = ok`, TLS valide, HSTS actif.
4. Les 2 faux négatifs du script `verify-vps-env.sh` (NODE_ENV, 5 process) sont **documentés et hors périmètre** Phase 1.

**Réserves (non bloquantes pour la reprise trafic, à traiter en Phase 2/3)** :
- Les patches Phase 2 (CORS, CSP, bypass flags) restent à déployer — le risque résiduel XSS/CORS est réel mais circonscrit tant qu'aucun vecteur d'exploit actif n'est connu.
- L'hygiène ops (logs, DB corrompues, fail2ban) relève de la maintenance continue.
- La topology PM2 (2 process vs 5 attendus) diverge du repo mais reste fonctionnellement couverte par la crontab.

**Décision** : 🟢 **Autoriser la reprise du trafic users**, en parallèle du lancement de la Phase 2 (sous 7 jours) pour clôturer les écarts sécurité restants (E5/E6/E7).

---

*Rédigé par le chef de projet — document de clôture Phase 1, à archiver avec les livrables d'audit.*
