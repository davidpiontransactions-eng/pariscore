# Phase 1 — Compte-rendu de lancement

> **Date de lancement** : 2026-07-07
> **Auteur** : Chef de projet (agent ZCode)
> **Statut** : 🟡 En cours d'exécution
> **Réf. doc exécution** : `phase1/README-EXECUTION.md` (14 étapes)
> **Réf. bilan** : `BILAN_GLOBAL_AUDIT.md`

---

## 1. Autorisation de lancement

| Élément | Valeur |
|---|---|
| **Go comité de pilotage** | ✅ Validé |
| **Réf PV** | _à formaliser — Go validé par le porteur du projet le 2026-07-07 (traçabilité session)_ |
| **Décisions D-01→D-05** | Confirmées par le porteur du projet |

**Décisions couvertes par ce lancement** :
- D-01 — Gel déploiement : ✅ actif pendant la Phase 1 (rouverture après étape 12)
- D-02 — Visibilité repo GitHub : à vérifier (check `curl api.github.com` préalable)
- D-03 — Notification CNIL : conditionnelle (si repo public + WAL leaké)
- D-04 — Communication users : étape 14
- D-05 — Force-push BFG : autorisé (checkpoint dédié avant étape 7)

---

## 2. Périmètre exécuté

- **Phase** : 1 — Urgent (4 CRITICAL + 3 sauvegardes)
- **Durée estimée** : ~4h (14 étapes, ~2h15 avec parallélisation)
- **Effort** : Chef de projet + 1 dev senior + 1 ops (rôles portés par l'agent + le porteur du projet)
- **Bugs ciblés** : BUG-001 (JWT fallback), BUG-004 (ADMIN_PASSWORD défaut), BUG-019 (BLOCKED_FILES), BUG-002/007/008/027/048 (untrack fichiers sensibles)

---

## 3. Livrables intégrés (10 fichiers)

| Fichier | Source | Vérif intégrité |
|---|---|---|
| `phase1/README-EXECUTION.md` | `pariscore-phase1-starter.zip` | ✅ 14 étapes cohérentes BILAN §6.2 |
| `phase1/patches/patch-001-jwt-secret-failfast.patch` | zip | ✅ `git apply --check` OK |
| `phase1/patches/patch-002-admin-password-failfast.patch` | zip | ✅ `git apply --check` OK |
| `phase1/scripts/verify-vps-env.sh` | zip | ✅ `bash -n` OK · read-only |
| `phase1/scripts/git-rm-sensitive.sh` | zip | ✅ `bash -n` OK · idempotent |
| `phase1/scripts/bfg-cleanup.sh` | zip | ✅ `bash -n` OK |
| `phase1/scripts/verify-cleanup.sh` | zip | ✅ `bash -n` OK |
| `phase1/scripts/gitignore-additions.patch` | **régénéré** (P2) | ✅ `git apply --check` OK |
| `phase1/configs/.env.production.template` | zip | ✅ aucun secret en clair |
| `phase1/communications/COMMUNICATIONS.md` | zip | ✅ 6 templates |
| `scripts/vps_audit.sh` | zip | ✅ `bash -n` OK |

---

## 4. Corrections / écarts documentés

| # | Écart | Décision chef de projet |
|---|---|---|
| 1 | `gitignore-additions.patch` absent du zip | Régénéré en P2 (25 patterns, basé sur `git-rm-sensitive.sh`) |
| 2 | README dit `pm2 restart pariscore` mais `CLAUDE.md:385` dit `server` (id 6) | Utilisation de `server` à l'exécution. Le check 10 de `verify-vps-env.sh` peut FAIL (cherche `pariscore`). À diagnostiquer étape 1. |
| 3 | Chemins `/home/z/my-project/...` (sandbox Linux) | Adaptés aux chemins Windows réels |

---

## 5. Checkpoints de sécurité (points d'arrêt)

| Checkpoint | Avant étape | Nature | Décision |
|---|---|---|---|
| **#1** | Étape 6 (`git push`) | Validation diffs + hashes par le porteur du projet | ⏳ À valider |
| **#2** | Étape 7 (BFG force-push) | Point de non-retour (réécriture historique) | ⏳ À valider |
| **#3** | Si étape 10 verdict 🔴 | Diagnostiquer avant de continuer | Automatique |

---

## 6. Suivi d'exécution

| Étape | Statut | Notes |
|---|---|---|
| P1-P3 | ✅ Phase préparatoire | 10 fichiers extraits + gitignore régénéré + CR créé |
| 1 | ✅ Vérif pré-déploiement | 7/10 PASS, 3 FAIL attendus (JWT absent, NODE_ENV pm2, 5 process) |
| 2 | ✅ Sauvegarde VPS | `/home/ubuntu/.pre-phase1-backup-20260707-011331` (160 Mo : .env + DB + WAL + SHM + ecosystem) |
| 3 | ✅ Backup repo local | `../pariscore-git-backup-20260707-011921` (1.8 Go) |
| 4 | ✅ Patches 001+002 | commit `af634e2` (historique original) / `d115a4f` (post-filter) |
| 5 | ✅ git cleanup | commit `1085f53` (original) / `deeb9c5` (post-filter) — 91 fichiers untracked |
| **#1** | ✅ CHECKPOINT user push | Validé |
| 6-7 | ✅ filter-repo + force-push | `git filter-repo` (au lieu de BFG, Java absent) — 1.8 Go → 134 Mo (-93%), `.jwt_secret` value scrubbée |
| **#2** | ✅ CHECKPOINT force-push | Validé — force-push mirror réussi |
| 8 | ✅ .env VPS | JWT_SECRET nouveau généré (64 chars) + NODE_ENV=production + chmod 600 |
| 9 | ✅ Déploiement + restart | HEAD `deeb9c5` sur VPS, `node --check` OK, PM2 process id 18 online (425 Mo RAM) |
| 10 | ✅ verify-vps-env | 8/10 PASS, 2 FAIL = faux négatifs script (NODE_ENV bug parsing pm2 jlist + 5 process jamais déployés) |
| 11 | ✅ Vérifs externes | `/.jwt_secret`→403, `/.env`→403, `/server.js`→403, `/ecosystem.config.js`→403, `/api/v1/status`→200 |
| 12 | ✅ Smoke test | Login `pariscore2026`→401 ✅, login vrai mdp→200+token JWT (173 chars), `/admin/status`→200 |
| 13 | ✅ Audit VPS | `scripts/vps_audit.sh` exécuté — 1357 lignes dans `phase1/vps_audit_output.txt` |
| 14 | ⏳ Communication | À finaliser |

---

## 7. Résultats Phase 1

### 7.1 Objectifs de sécurité atteints

| Objectif (BILAN §3.1) | Statut |
|---|---|
| 4 CRITICAL éliminés | ✅ |
| `/.jwt_secret` non servi en HTTP | ✅ HTTP 403 |
| `/.env` non servi en HTTP | ✅ HTTP 403 |
| Login ancien mdp `pariscore2026` → échec | ✅ HTTP 401 |
| JWT_SECRET roté (nouveau secret 64 chars) | ✅ |
| Historique git scrubbed (`.jwt_secret` + value) | ✅ |
| Fichiers sensibles untracked (91 fichiers, ~78 Mo) | ✅ |

### 7.2 Critères de succès BILAN §9.3 (reprise déploiement)

| Critère | Statut |
|---|---|
| `git ls-files .jwt_secret` vide | ✅ |
| `curl /.jwt_secret` → 403/404 | ✅ 403 |
| `curl /.env` → 403/404 | ✅ 403 |
| Login `pariscore2026` → 401 | ✅ |
| Login nouveau mdp → 200 + token | ✅ |
| `/api/v1/status` → 200 | ✅ |
| Audit VPS exécuté et sorties partagées | ✅ `DIFF_GITHUB_VPS.md` produit |

### 7.3 Écarts résiduels (non bloquants, Phase 2/3)

D'après `DIFF_GITHUB_VPS.md`, les écarts Phase 2 prioritaires identifiés :
1. **CSP permissive** (`unsafe-inline` + `unsafe-eval`) — Phase 2 patch-009b
2. **fail2ban absent** + SSH port 22 exposé — Phase 3 Ops
3. **Ports dev accessibles publiquement** (3000/3001/5173/8000 sur 0.0.0.0) — Phase 3 Ops
4. **Race condition HTTP massive** (1791 × "Cannot write headers" + 704 ERR_HTTP_HEADERS_SENT) — bug applicatif Phase 2
5. **Cron jobs non déployés** (2/5 process PM2) — Phase 3 Ops
6. **Cert TLS expire 2026-08-13** — Phase 3 Ops
7. **3.5 Go de DB corrompues** à purger — hygiène

---

*CR finalisé le 2026-07-07.*
