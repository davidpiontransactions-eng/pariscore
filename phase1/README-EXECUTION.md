# Phase 1 — Guide d'exécution

> **Date** : 2026-07-06
> **Auteur** : Chef de projet
> **Statut** : ✅ Livrables prêts — ⏳ En attente d'exécution par l'équipe
> **Durée estimée** : 4 heures (avec 1 dev senior + 1 ops)
> **Prérequis** : accès SSH au VPS, accès admin au repo GitHub, Java installé (pour BFG)

---

## 0. Décision préalable (bloquant)

Avant de commencer, **valider avec la Direction** :

- [ ] Gel déploiement autorisé jusqu'à fin Phase 1
- [ ] Rotation du secret JWT autorisée (impact : invalidation de toutes les sessions users)
- [ ] Force-push GitHub autorisé (BFG réécrit l'historique)
- [ ] Vérifier si le repo est public : `curl -s https://api.github.com/repos/davidpiontransactions-eng/pariscore | grep -E '"private"|"visibility"'`
  - Si **public** : notifier le juridique immédiatement (obligation CNIL art. 33, sous 72h)
  - Si **privé** : continuer

---

## 1. Plan d'exécution (ordre strict)

### Étape 1 — Vérification pré-déploiement (15 min, Ops)

```bash
# Sur le VPS
scp /home/z/my-project/phase1/scripts/verify-vps-env.sh ubuntu@51.75.21.239:/tmp/
ssh ubuntu@51.75.21.239 'bash /tmp/verify-vps-env.sh'
```

**Verdict attendu avant Phase 1** : 🔴 (FAIL critiques attendus sur `JWT_SECRET`, `ADMIN_PASSWORD`, `BETA_TESTER_PASSWORD`, `ALLOWED_ORIGIN`, `/.jwt_secret` accessible). C'est normal — on va les corriger.

Si `MATCHES_AUTH_BYPASS=1` ou `TENNIS_DEV_BYPASS=1` sont présents : **stop immédiat**, retirer du `.env` d'abord.

### Étape 2 — Sauvegarde pré-déploiement (10 min, Ops)

```bash
# Sur le VPS — backup complet
ssh ubuntu@51.75.21.239 << 'EOF'
  cd /home/ubuntu/pariscore
  BACKUP_DIR="/home/ubuntu/.pre-phase1-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp -a .env "$BACKUP_DIR/.env"
  cp -a pariscore.db "$BACKUP_DIR/pariscore.db" 2>/dev/null
  cp -a pariscore.db-wal "$BACKUP_DIR/pariscore.db-wal" 2>/dev/null
  cp -a pariscore.db-shm "$BACKUP_DIR/pariscore.db-shm" 2>/dev/null
  pm2 save  # snapshot process list
  echo "Backup créé : $BACKUP_DIR"
  ls -la "$BACKUP_DIR"
EOF
```

### Étape 3 — Backup du repo GitHub local (5 min, Dev senior)

```bash
# Sur le poste du dev senior — cloner le repo fresh
git clone https://github.com/davidpiontransactions-eng/pariscore.git pariscore-phase1
cd pariscore-phase1

# Backup complet avant BFG
cp -r .git ../pariscore-git-backup-$(date +%Y%m%d)
```

### Étape 4 — Appliquer les patches de code (15 min, Dev senior)

```bash
cd pariscore-phase1

# Patch 1 : JWT_SECRET fail-fast + BLOCKED_FILES étendu
git apply /home/z/my-project/phase1/patches/patch-001-jwt-secret-failfast.patch

# Patch 2 : ADMIN_PASSWORD / BETA_TESTER_PASSWORD fail-fast
git apply /home/z/my-project/phase1/patches/patch-002-admin-password-failfast.patch

# Vérifier la syntaxe
node --check server.js

# Vérifier les diffs
git diff --stat

# Commit
git add server.js
git commit -m "fix(security): Phase 1 — JWT_SECRET + ADMIN_PASSWORD fail-fast + BLOCKED_FILES étendu

- BUG-001: Suppression fallback fichier .jwt_secret, fail-fast strict si JWT_SECRET absent ou < 32 chars
- BUG-004: Suppression mots de passe par défaut 'pariscore2026'/'Beta2026', fail-fast strict si ADMIN_PASSWORD/BETA_TESTER_PASSWORD absents ou < 12 chars
- BUG-019: BLOCKED_FILES étendu avec .jwt_secret + 13 fichiers sensibles supplémentaires

Refs: AUDIT-2026-07 Phase 1"
```

### Étape 5 — Nettoyer le tracking git (10 min, Dev senior)

```bash
# Appliquer le patch .gitignore
git apply /home/z/my-project/phase1/scripts/gitignore-additions.patch

# Retirer les fichiers sensibles du tracking (sans les supprimer physiquement)
bash /home/z/my-project/phase1/scripts/git-rm-sensitive.sh

# Vérifier le résultat
git status

# Commit
git add .gitignore
git commit -m "chore(security): Phase 1 — untrack sensitive files + enrich .gitignore

- 71 fichiers sensibles retirés du tracking (~78 Mo)
  - .jwt_secret (secret JWT)
  - pariscore.db-wal, pariscore.db-shm (données users)
  - database.db, data/*.db* (8 fichiers DB)
  - deploy-ovh.ps1, vps/deploy-ovh.ps1 (IP VPS hardcodée)
  - server*.log, server*.err (13 fichiers logs)
  - *.bak, *.backup (3 fichiers backup)
  - __pycache__/*.pyc (9 fichiers bytecode)
  - vps.zip, pariscore-fix.zip, etc. (7 archives)
- 25 patterns ajoutés au .gitignore

Refs: AUDIT-2026-07 Phase 1 (BUG-002, BUG-007, BUG-008, BUG-027, BUG-048)"
```

### Étape 6 — Push sur GitHub (5 min, Dev senior)

```bash
git push origin main
```

⚠️ **Attention** : à ce stade, le `.jwt_secret` est toujours dans l'historique git. Il faut faire le BFG (étape 7) pour le supprimer définitivement.

### Étape 7 — BFG cleanup (30 min, Dev senior)

```bash
# Prérequis : télécharger BFG
# https://rtyley.github.io/bfg-repo-cleaner/
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O /tmp/bfg.jar

# Lancer BFG en dry-run d'abord
bash /home/z/my-project/phase1/scripts/bfg-cleanup.sh --dry-run

# Si OK, lancer le vrai cleanup
bash /home/z/my-project/phase1/scripts/bfg-cleanup.sh

# Force-push (réécrit l'historique)
cd pariscore-phase1
git push --force --mirror origin
```

⚠️ **Impact** : tous les hashes de commit changent. Les contributeurs devront re-cloner le repo. Les PRs ouvertes seront invalidées.

### Étape 8 — Configurer le `.env` VPS (20 min, Ops)

```bash
# Sur le VPS
scp /home/z/my-project/phase1/configs/.env.production.template \
    ubuntu@51.75.21.239:/home/ubuntu/pariscore/.env.new

ssh ubuntu@51.75.21.239 << 'EOF'
  cd /home/ubuntu/pariscore
  
  # Éditer le .env.new avec les vraies valeurs
  nano .env.new
  # (remplir toutes les valeurs <REMPLIR...>)
  
  # Sauvegarder l'ancien .env
  mv .env .env.old-$(date +%Y%m%d)
  
  # Activer le nouveau
  mv .env.new .env
  
  # Sécuriser les permissions
  chmod 600 .env
  chown ubuntu:ubuntu .env
  
  # Afficher les variables sans révéler les valeurs
  grep -E '^[A-Z_]+=' .env | awk -F= '{print $1"=<SET>"}'
EOF
```

**Générer un nouveau JWT_SECRET** (ne pas réutiliser l'ancien !) :
```bash
openssl rand -hex 32
```

### Étape 9 — Déployer le code (10 min, Ops)

```bash
ssh ubuntu@51.75.21.239 << 'EOF'
  cd /home/ubuntu/pariscore
  
  # Pull du code corrigé
  git fetch origin
  git reset --hard origin/main
  
  # IMPORTANT : restaurer le .env (ne pas laisser git l'écraser)
  # Le .env n'est plus tracké, donc git reset ne le touche pas.
  # Mais vérifier quand même :
  ls -la .env
  
  # Restart PM2
  pm2 restart pariscore
  
  # Vérifier le boot
  pm2 logs pariscore --lines 30 --nostream
EOF
```

### Étape 10 — Vérification post-déploiement (10 min, Ops)

```bash
# Sur le VPS
ssh ubuntu@51.75.21.239 'bash /tmp/verify-vps-env.sh'
```

**Verdict attendu après Phase 1** : 🟢 (10/10 PASS)

Si 🔴 : ne pas continuer, diagnostiquer le FAIL avec le rapport du script.

### Étape 11 — Vérifications externes (5 min, Dev senior)

```bash
# Depuis l'extérieur
curl -sI https://pariscore.fr/.jwt_secret | head -1   # doit être 403 ou 404
curl -sI https://pariscore.fr/.env | head -1          # doit être 403 ou 404
curl -sI https://pariscore.fr/ecosystem.config.js | head -1  # doit être 403 ou 404
curl -s https://pariscore.fr/api/v1/status            # doit retourner 200 OK
curl -sI https://pariscore.fr/ -H "Origin: https://evil.com" | grep -i access-control  # ne doit PAS être *
```

### Étape 12 — Smoke test fonctionnel (10 min, Dev senior)

```bash
# Test login (avec nouveau mot de passe admin)
curl -X POST https://pariscore.fr/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<NOUVEAU_MOT_DE_PASSE>"}'
# → 200 OK + token JWT signé avec le nouveau secret

# Test login avec ancien mot de passe (doit échouer)
curl -X POST https://pariscore.fr/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pariscore2026"}'
# → 401 Unauthorized

# Test route protégée
curl -s https://pariscore.fr/api/v1/admin/status -H "Authorization: Bearer <token>"
# → 200 OK

# Test fetch matches (public)
curl -s https://pariscore.fr/api/v1/matches | head -c 200
# → JSON valide
```

### Étape 13 — Lancer l'audit VPS complet (15 min, Ops)

```bash
# Script déjà fourni dans la session précédente
scp /home/z/my-project/scripts/vps_audit.sh ubuntu@51.75.21.239:/tmp/
ssh ubuntu@51.75.21.239 'bash /tmp/vps_audit.sh' > vps_audit_output.txt 2>&1

# Coller le contenu de vps_audit_output.txt dans le chat
# → permettra de rédiger DIFF_GITHUB_VPS.md (écarts GitHub vs VPS)
```

### Étape 14 — Communication (15 min, Chef de projet)

1. Envoyer l'email de compte-rendu à l'équipe (cf. `communications/COMMUNICATIONS.md` §3.1).
2. Si des users actifs : envoyer la communication utilisateurs (§2.1 et §2.3).
3. Mettre à jour le `worklog.md` avec le résumé d'exécution.

---

## 2. Plan de rollback (en cas de problème)

### 2.1 Rollback code

```bash
# Sur le VPS
cd /home/ubuntu/pariscore
git log --oneline -5  # identifier le commit avant Phase 1
git reset --hard <commit-avant-phase1>
pm2 restart pariscore
```

### 2.2 Rollback .env

```bash
cd /home/ubuntu/pariscore
mv .env .env.failed-$(date +%Y%m%d)
mv .env.old-<DATE> .env
pm2 restart pariscore
```

### 2.3 Rollback DB (si corruption SQLite)

```bash
cd /home/ubuntu/pariscore
pm2 stop pariscore
mv pariscore.db pariscore.db.corrupt-$(date +%Y%m%d)
cp /home/ubuntu/.pre-phase1-backup-<DATE>/pariscore.db .
cp /home/ubuntu/.pre-phase1-backup-<DATE>/pariscore.db-wal . 2>/dev/null
cp /home/ubuntu/.pre-phase1-backup-<DATE>/pariscore.db-shm . 2>/dev/null
pm2 start pariscore
```

### 2.4 Rollback git history (post-BFG)

```bash
# Si le BFG a causé un problème, restaurer le backup .git
cd pariscore-phase1
rm -rf .git
cp -r ../pariscore-git-backup-<DATE>/.git .
git push --force --mirror origin
```

⚠️ **Tous les contributeurs devront re-cloner après un rollback d'historique.**

---

## 3. Critères de succès Phase 1

La Phase 1 est considérée comme **terminée et réussie** quand :

- [ ] `git ls-files .jwt_secret` retourne vide (sur le vrai repo)
- [ ] `curl -sI https://pariscore.fr/.jwt_secret | head -1` retourne 403 ou 404
- [ ] `curl -sI https://pariscore.fr/.env | head -1` retourne 403 ou 404
- [ ] `verify-vps-env.sh` retourne 🟢 (10/10 PASS)
- [ ] `verify-cleanup.sh` retourne 0 (toutes les vérifications PASS)
- [ ] Login avec ancien mot de passe `pariscore2026` → 401
- [ ] Login avec nouveau mot de passe admin → 200 + token valide
- [ ] `pm2 status` : `pariscore` online + 4 cron process présents
- [ ] `/api/v1/status` retourne 200
- [ ] `/api/v1/matches` retourne 200 (ou 401 si auth requise)
- [ ] Pas de spam `subscription_required` dans `~/.pm2/logs/pariscore-error.log` (dernière heure)
- [ ] Email de compte-rendu envoyé à la Direction
- [ ] Communication utilisateurs envoyée (si applicable)
- [ ] Audit VPS exécuté et sorties partagées avec le chef de projet

---

## 4. Structure des livrables Phase 1

```
/home/z/my-project/phase1/
├── README-EXECUTION.md              # Ce document — guide d'exécution
├── patches/
│   ├── patch-001-jwt-secret-failfast.patch   # BUG-001 + BUG-019
│   ├── patch-002-admin-password-failfast.patch  # BUG-004
│   └── REPORT.md                    # Détail des patches
├── scripts/
│   ├── gitignore-additions.patch    # 25 patterns .gitignore
│   ├── git-rm-sensitive.sh          # Retire 71 fichiers du tracking
│   ├── bfg-cleanup.sh               # BFG Repo-Cleaner (historique git)
│   ├── verify-cleanup.sh            # Vérification post-cleanup
│   ├── verify-vps-env.sh            # Vérification env VPS (10 checks)
│   ├── verify-vps-env-REPORT.md     # Doc du script VPS
│   └── REPORT.md                    # Détail des scripts git
├── configs/
│   └── .env.production.template     # Template .env exhaustif
└── communications/
    └── COMMUNICATIONS.md            # Templates emails (équipe, direction, users, juridique)
```

---

## 5. Affectation des ressources (Gantt Phase 1)

| Étape | Tâche | Owner | Durée | Dépendance |
|---|---|---|---|---|
| 0 | Décision préalable Direction | Chef de projet | — | — |
| 1 | Vérification pré-déploiement VPS | Ops | 15 min | — |
| 2 | Sauvegarde pré-déploiement | Ops | 10 min | — |
| 3 | Backup repo GitHub local | Dev senior | 5 min | — |
| 4 | Appliquer patches code | Dev senior | 15 min | 3 |
| 5 | Nettoyer tracking git | Dev senior | 10 min | 4 |
| 6 | Push sur GitHub | Dev senior | 5 min | 5 |
| 7 | BFG cleanup | Dev senior | 30 min | 6 |
| 8 | Configurer .env VPS | Ops | 20 min | 1, 2 |
| 9 | Déployer le code | Ops | 10 min | 7, 8 |
| 10 | Vérification post-déploiement | Ops | 10 min | 9 |
| 11 | Vérifications externes | Dev senior | 5 min | 10 |
| 12 | Smoke test fonctionnel | Dev senior | 10 min | 11 |
| 13 | Audit VPS complet | Ops | 15 min | 10 |
| 14 | Communication | Chef de projet | 15 min | 12 |

**Parallélisation possible** :
- Étapes 1+2+3 en parallèle (Ops + Dev senior)
- Étape 4 (Dev senior) en parallèle avec étapes 1+2 (Ops)
- Étape 8 (Ops prépare .env) en parallèle avec étapes 4-7 (Dev senior sur git)

**Durée totale critique (sans parallélisation)** : ~3h05
**Durée totale avec parallélisation** : ~2h15

---

## 6. Risques et mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| BFG casse l'historique git | Faible | Backup .git avant (étape 3) + plan rollback §2.4 |
| Force-push rejected par GitHub | Faible | Vérifier qu'aucune protection de branche n'empêche force-push |
| Corruption SQLite au restart | Moyenne | Backup DB (étape 2) + plan rollback §2.3 + `wal_checkpoint(TRUNCATE)` avant stop |
| Users ne peuvent plus se reconnecter | Certaine | Communication §2.1 + support prêt |
| Tests E2E cassés par les nouveaux mots de passe | Élevée | Auditer `tests/*.spec.ts` et `tests/test_api.py` pour credentials hardcodés |
| Dépendances manquantes au boot | Faible | `node --check server.js` (étape 4) + smoke test (étape 12) |
| Cron jobs cassés | Faible | Vérifier `pm2 status` après restart (étape 10) |

---

## 7. Status tracking

| Étape | Statut | Owner | Notes |
|---|---|---|---|
| 0 | ⏳ En attente validation Direction | Chef de projet | — |
| 1 | ⏳ En attente | Ops | — |
| 2 | ⏳ En attente | Ops | — |
| 3 | ⏳ En attente | Dev senior | — |
| 4 | ⏳ En attente | Dev senior | — |
| 5 | ⏳ En attente | Dev senior | — |
| 6 | ⏳ En attente | Dev senior | — |
| 7 | ⏳ En attente | Dev senior | — |
| 8 | ⏳ En attente | Ops | — |
| 9 | ⏳ En attente | Ops | — |
| 10 | ⏳ En attente | Ops | — |
| 11 | ⏳ En attente | Dev senior | — |
| 12 | ⏳ En attente | Dev senior | — |
| 13 | ⏳ En attente | Ops | — |
| 14 | ⏳ En attente | Chef de projet | — |

---

*Document de pilotage Phase 1 — à mettre à jour au fur et à mesure de l'exécution.*
