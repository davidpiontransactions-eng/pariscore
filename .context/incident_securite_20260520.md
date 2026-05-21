# INCIDENT SÉCURITÉ — Exfiltration server.js + rotation 8 clés

> **Date détection** : 20 mai 2026 ~23:30 UTC
> **Date incident** : 20 mai 2026 00:26:11 UTC
> **Sévérité** : 🔴 CRITIQUE — Confirmed breach
> **Bd ticket** : `ParisScorebis-c8m`
> **Document** : `.context/incident_securite_20260520.md` (traçabilité légale + post-mortem)

---

## 1. RÉSUMÉ EXÉCUTIF

Le 20 mai 2026 à 00:26:11 UTC, un attaquant a téléchargé avec succès le fichier `server.js` (196 KB) depuis le serveur de production https://pariscore.fr via HTTPS. Ce fichier contenait en clair les chemins d'accès et les structures référençant 8 clés/secrets stockés dans `.env`. Bien que `.env` lui-même n'ait pas été directement accessible (404 sur `/var/log/nginx/access.log` pour les tentatives), l'attaquant a pu identifier la stack Node.js et les noms des variables d'environnement utilisées, lui permettant ensuite de tester des chemins alternatifs.

Fix code déployé entre 00:26 et 00:50 UTC (BLOCKED_FILES + BLOCKED_DIRS dans `isSafePath`, commit `4e02a6a`). À 00:50:19 UTC, la même IP attaquante a retenté l'accès aux 3 fichiers sensibles et a été bloquée (HTTP 403).

**8 clés/secrets considérés compromis** — rotation immédiate engagée.

---

## 2. TIMELINE INCIDENT

| Heure UTC | IP | Action | Status HTTP |
|---|---|---|---|
| < 20 mai 00:26 | — | server.js servable sans guard | exposition latente |
| 20 mai 00:26:11 | `37.65.65.25` | `GET /server.js` | **200** — 196356 bytes téléchargés |
| 20 mai 00:30 (estim) | — | Deploy fix `BLOCKED_FILES` server.js | fix actif |
| 20 mai 00:50:08 | `51.75.21.239` | `HEAD /server.js` (curl test) | 403 — fix confirmed |
| 20 mai 00:50:19 | `37.65.65.25` | `HEAD /server.js/.env/database.json` | 403 — attaquant retry bloqué |
| 20 mai 23:30 | — | Détection incident (audit nginx logs) | — |
| 20 mai 23:45 | — | Rotation 8 clés engagée | en cours |

---

## 3. ATTAQUANT IDENTIFIÉ

### IP principale (breach)
- **IP** : `37.65.65.25`
- **Pays** : 🇫🇷 France
- **Ville** : Nantes (Pays de la Loire)
- **Code postal** : 44000
- **Coordonnées** : 47.2172, -1.5534
- **ISP** : Société Française Du Radiotéléphone — SFR SA (AS15557)
- **Type** : Connexion résidentielle SFR
- **User-Agent** : `curl/8.19.0`
- **Pattern attaque** : exécution manuelle ou script léger (pas bot massif)

### Scanners secondaires (bénins, bloqués)
- `78.153.140.x` (range, multiples sub-IPs) — Bot scanner depuis VPS UK (HOSTGLOBAL.PLUS LTD AS202306). Scan automatique masse `.env`, jamais atteint
- `185.213.174.34`, `45.148.10.62`, `64.89.163.38`, `185.177.72.67` — Scanners similaires masse `.env` toutes chemins (public/, api/, admin/, backend/, etc.)
- Tous bloqués par BLOCKED_FILES après fix

---

## 4. FICHIERS / CLÉS EXPOSÉS

### Fichier exfiltré
`server.js` — 196 356 bytes — contient en clair :
- Lignes 40-200 : config constants (PORT, TTL, BLOCKED_FILES, etc.)
- Lignes 1-50 : chargement `.env` via `fs.readFileSync('.env')`
- Multiples appels `process.env.<KEY>` à travers le code

### Clés référencées dans `.env`
Chaque clé compromise + sa surface d'attaque :

| Clé | Service | Risque max |
|---|---|---|
| `JWT_SECRET` | Auth interne | **CRITIQUE** — Forge tokens admin valides, impersonnation users |
| `ADMIN_PASSWORD` | admin.html login | Accès direct dashboard admin |
| `GA_POSTBACK_TOKEN` | Gambling-Affiliation S2S | Fraude conversions affiliation (€) |
| `TELEGRAM_BOT_TOKEN` | Bot Telegram alertes | Contrôle bot, spam users abonnés |
| `ODDS_API_KEY` | the-odds-api.com | Épuiser quota mensuel ($) |
| `GEMINI_API_KEY` | Google Gemini AI | Génération contenu sur crédit Google |
| `API_FOOTBALL_KEY` | api-football.com Pro | Quota Pro $19/mois exposé |
| `BSD_API_KEY` | Sports Addon BSD | Quota $5/mo exposé |

---

## 5. ACTIONS REMÉDIATION

### ✅ Phase 1 — Containment (immédiat, < 1h)
- [x] Fix code `BLOCKED_FILES` / `BLOCKED_DIRS` / `isSafePath` (commit `4e02a6a`)
- [x] Deploy VPS via WinSCP + `pm2 restart pariscore`
- [x] Test exposition `curl -I` → 403 confirmé 3 fichiers

### 🔄 Phase 2 — Rotation clés (en cours)
- [x] **`JWT_SECRET`** — Régénéré via `openssl rand -hex 64`, deployed VPS .env, pm2 restart
- [ ] **`ADMIN_PASSWORD`** — En attente confirmation
- [ ] **`GA_POSTBACK_TOKEN`** — En attente confirmation
- [ ] **`TELEGRAM_BOT_TOKEN`** — À faire via @BotFather `/revoke` + `/newtoken`
- [ ] **`ODDS_API_KEY`** — À faire dashboard the-odds-api.com
- [ ] **`GEMINI_API_KEY`** — À faire console aistudio.google.com
- [ ] **`API_FOOTBALL_KEY`** — À faire dashboard api-football.com
- [ ] **`BSD_API_KEY`** — En attente email vendeur bzzoiro@proton.me

### 🛡 Phase 3 — Hardening (à faire)
- [ ] Ban IP attaquant : `sudo ufw deny from 37.65.65.25 to any`
- [ ] Ban range scanner : `sudo ufw deny from 78.153.140.0/24 to any`
- [ ] Reload firewall : `sudo ufw reload`
- [ ] Vérifier `ufw status numbered`

### 🔍 Phase 4 — Audit post-breach
- [ ] Audit `user_bets` table — paris créés post 20/05 00:26 UTC avec patterns anormaux
- [ ] Audit `bankroll_transactions` — dépôts/retraits suspects
- [ ] Audit `affiliate_clicks` — conversions avec ip_external suspectes
- [ ] Audit logs `admin.html` — connexions admin avec IPs étrangères

### 📢 Phase 5 — Notification (à décider)
- [ ] Banner UI "Maintenance sécurité — Reconnexion requise" (forced post JWT rotate)
- [ ] Email users si données sensibles exposées (probablement non requis)
- [ ] Notification CNIL si breach impacte données personnelles (GDPR 72h)

### ⚖️ Phase 6 — Légal (optionnel)
- [ ] Signalement Cybermalveillance.gouv.fr
- [ ] Signalement CERT-FR (anssi.gouv.fr)
- [ ] Si dommage prouvé : plainte commissariat + dossier preuves (logs nginx complets)
- [ ] Si nécessaire : demande judiciaire SFR pour identité abonné IP `37.65.65.25` (date/heure précise breach)

---

## 6. PREUVES CONSERVÉES

### Logs nginx
- `/var/log/nginx/access.log` (jour J+0)
- `/var/log/nginx/access.log.1` (jour J-1)
- À archiver hors VPS pour préservation

### Snapshot incident
```
37.65.65.25 - - [20/May/2026:00:26:11 +0000] "GET /server.js HTTP/1.1" 200 196356 "-" "curl/8.19.0"
```

### Commits Git remédiation
- `4e02a6a` — Fix BLOCKED_FILES + isSafePath
- Hash commit post-rotation `.env` à ajouter ici

### Géolocalisation IP
- Source : ipinfo.io (consulté 20/05 ~23:45 UTC)
- Pays : FR — Région : Pays de la Loire — Ville : Nantes — ISP : SFR SA AS15557

---

## 7. LEÇONS APPRISES

### Root cause
Le handler statique nginx + Node.js servait `/server.js` directement depuis le filesystem sans whitelist. Aucun gate côté code Node.js pour bloquer ce path spécifique avant `BLOCKED_FILES`. Aucun ACL nginx pour bloquer extensions sensibles (`.js`, `.json`, `.env`).

### Mesures préventives futures
1. **Double layer protection** : `BLOCKED_FILES` Node.js (déjà fait) + ACL nginx (`location ~ \.(js|env|json|db)$ { deny all; }`)
2. **Bundler/minifier** : compiler `server.js` en `dist/` (intentions claires server-only) + ne JAMAIS exposer `dist/` via nginx
3. **`.env` outside web root** : déplacer `.env` vers `/etc/pariscore/secrets.env` (lu via path absolu) — impossible de l'atteindre via HTTP même si fix code casse
4. **Secret manager** : long terme migrer vers AWS Secrets Manager / HashiCorp Vault / 1Password CLI
5. **Pre-commit hook** : `gitleaks` / `trufflehog` scan automatique pour empêcher push secrets
6. **Monitoring** : alertes Prometheus/Grafana sur 403 spikes ou patterns d'attaque (>10 req sur fichiers sensibles / 5min → alerte Telegram)
7. **CSP nginx** : Content-Security-Policy strict + Subresource Integrity
8. **Fail2ban** : déjà installé ? Sinon activer pour ban automatique IPs scanners

### Backlog items à créer
- [ ] [SECURITY] Implémenter nginx ACL fichiers sensibles (location regex)
- [ ] [SECURITY] Déplacer `.env` hors web root → `/etc/pariscore/`
- [ ] [SECURITY] Pre-commit hook gitleaks
- [ ] [SECURITY] Monitoring 403 spikes alerts
- [ ] [SECURITY] Fail2ban config PariScore

---

## 8. STATUT FINAL

- **Containment** : ✅ Confirmé (403 sur fichiers sensibles)
- **Rotation clés** : 🔄 1/8 confirmé (JWT_SECRET), 7/8 en cours
- **Hardening** : ⏳ Ban IPs en attente
- **Audit DB** : ⏳ À effectuer
- **Notification** : ⏳ À décider
- **Légal** : ⏳ À décider après audit DB

**Document à mettre à jour au fil de la remédiation. Conservation 7 ans minimum (preuves légales).**

---

*Document créé le 21 mai 2026 par Lead Security Engineer PariScore.*
*Référence : bd `ParisScorebis-c8m`.*
*Confidentialité : interne — ne pas committer sur repo public.*
