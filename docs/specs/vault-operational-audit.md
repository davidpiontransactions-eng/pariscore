# Audit — Vault Operational Readiness

Date : 2026-06-13
Version : v1
Statut : 🟡 En cours

## Légende

- ✅ Terminé
- 🟡 Implémenté partiellement
- 🔴 Pas commencé
- ⚪ Non applicable / différé

---

## P0 — Fondation (MVP)

| Item | Statut | Notes |
|------|--------|-------|
| `scripts/vault-daily-summary.js` | ✅ | 408 lignes, toutes sections |
| `scripts/vault-config-reference.js` | ✅ | 200 lignes, toutes sections |
| `docs/specs/vault-daily-summary.md` | ✅ | Spec complet |
| `docs/specs/vault-config-reference.md` | ✅ | Spec complet |
| `docs/specs/vault-daily-example.md` | ✅ | Exemple visuel |
| `ecosystem.config.js` — cron vault-daily | 🟡 | Spec prête, ajout PM2 requis |
| `.env` — VAULT_PATH | 🔴 | Variable manquante, à configurer |
| Test dry-run exécuté | 🔴 | `node scripts/vault-daily-summary.js --dry` |

## P1 — Incidents & Stabilité

| Item | Statut | Notes |
|------|--------|-------|
| `docs/specs/vault-incidents.md` | ✅ | Spec complet, CLI args |
| `scripts/vault-incidents.js` | 🔴 | Pas encore buildé |
| Hook dans server.js catch global | 🔴 | Déclenchement auto sur erreur |
| Alerte Discord quand incident créé | 🔴 | Notification croisée |

## P2 — Hebdomadaire & Stratégies

| Item | Statut | Notes |
|------|--------|-------|
| `docs/specs/vault-models-tracking.md` | ✅ | Spec complet (vault-weekly-review) |
| `scripts/vault-weekly-review.js` | 🔴 | Pas encore buildé |
| Cron PM2 hebdo (lundi 08:00) | 🔴 | À ajouter dans ecosystem.config.js après build |
| Suivi des stratégies de pari | 🔴 | Nécessite données user_strategies + user_bets |

## P3 — Auto-réparation & Intelligence

| Item | Statut | Notes |
|------|--------|-------|
| Détection de dérive de modèle | 🔴 | Brier score > seuil → alerte |
| Résumé AI hebdo (via Gemini API) | 🔴 | Résumé NLP des performances |
| Comparaison semaine/semaine | 🔴 | Delta automatique |
| Recommandation réentraînement | 🔴 | Quand échantillon > 500 matchs depuis dernier train |

---

## Dépendances

### Ce qui fonctionne déjà dans PariScore

- ✅ SQLite database (pariscore.db) avec match_stats_history, tennis_matches_internal, user_bets, bankroll_transactions
- ✅ better-sqlite3 installé
- ✅ Pattern de script cron existant (cron_refresh_match_stats.js)
- ✅ PM2 ecosystem.config.js

### Ce qui est requis mais pas encore en place

| Dépendance | Pourquoi | Où |
|-----------|----------|-----|
| `VAULT_PATH` dans .env | Le script a besoin de savoir où écrire | `.env` ligne à ajouter |
| Dossier vault accessible | Les notes sont écrites sur le filesystem | Machine locale ou VPS |
| Git init dans le vault | Pour versionner les notes (optionnel mais recommandé) | `git init` dans le vault |

---

## Risques & Bloquants

### Risque 1 : Vault Path pas configuré 🔴
Le script vault-daily-summary.js exit avec code 1 si VAULT_PATH est absent du .env.
**Fix :** Ajouter la variable et pointer vers un vrai dossier.

### Risque 2 : Le vault peut être sur une machine différente ✅
PariScore tourne sur un VPS Linux, le vault Obsidian est sur un PC Windows. 
**Solution choisie : Git sync**
- Le script vault-daily-summary.js écrit dans `/home/ubuntu/PariScore-vault` sur le VPS
- Un commit + push est fait automatiquement (ou via `scripts/sync-vault-to-pc.sh`)
- Sur le PC Windows, on pull avec `scripts/sync-vault-from-pc.ps1`
- Le vault local est initialisé dans `C:\Users\david\Documents\PariScore-vault`

### Risque 3 : Pas de rollback si une note est corrompue
Si le script écrit une note vide ou mal formée, elle écrase la précédente.
**Fix :** Git (historique) ou backup daily/ directory. Déjà mitigé si git-first.

### Risque 4 : Fragilité des requêtes SQL
Les requêtes SQL dans vault-daily-summary.js dépendent du schéma exact de la DB.
Si le schéma change (migration), les scripts peuvent casser.
**Fix :** Ajouter des try/catch autour de chaque requête (déjà fait dans le script).

---

## Checklist de Mise en Production

### Étape 1 : Configuration
- [ ] Définir VAULT_PATH dans .env
- [ ] Créer le dossier daily/ dans le vault
- [ ] Vérifier que le dossier est accessible en écriture

### Étape 2 : Test local
- [ ] `node scripts/vault-daily-summary.js --dry` — vérifier le rendu markdown
- [ ] `node scripts/vault-config-reference.js --dry` — vérifier le rendu
- [ `node scripts/vault-daily-summary.js` — écriture réelle (avec --date=YYYY-MM-DD si pas de matchs)
- [ ] `node scripts/vault-config-reference.js` — écriture réelle

### Étape 3 : Déploiement VPS
- [ ] Copier les scripts sur le VPS (git pull)
- [ ] Ajouter VAULT_PATH dans .env du VPS
- [ ] Point VAULT_PATH vers un dossier synchronisé (git/Dropbox)

### Étape 4 : PM2
- [ ] `pm2 start ecosystem.config.js --only pariscore-vault-daily`
- [ ] `pm2 status` — vérifier que le process est bien enregistré
- [ ] Vérifier le log : `pm2 logs pariscore-vault-daily --lines 20`

### Étape 5 : Vault
- [ ] Ouvrir Obsidian et vérifier que vault/daily/YYYY-MM-DD.md apparaît
- [ ] Vérifier le rendu markdown (tableaux, emojis, frontmatter)
- [ ] Vérifier que le file watcher Obsidian détecte la nouvelle note

### Étape 6 : Boucle
- [ ] Vérifier le lendemain matin qu'une nouvelle note a été créée
- [ ] Configurer alertes d'échec (Discord si cron exit avec code 1 ou 2)

---

## Arbre de Décision — Où mettre le vault ?

```
PariScore tourne sur VPS Linux ? 
├── OUI → Le vault doit être accessible depuis le VPS
│   ├── Vault sur le même VPS ? 
│   │   ├── OUI → VAULT_PATH = /home/ubuntu/vault
│   │   └── NON → Synchronisation requise
│   │       ├── Git clone du vault sur le VPS
│   │       │   → VAULT_PATH = /home/ubuntu/vault (repo cloné)
│   │       │   → Le script écrit → git commit + push
│   │       │   → Obsidian pull = notes à jour
│   │       └── Dropbox/Nextcloud sur le VPS
│   │           → VAULT_PATH = /home/ubuntu/Dropbox/vault
│   │           → Synced automatiquement
│   └── (autre)
└── NON → PariScore en local Windows ?
    ├── Vault sur le même PC ?
    │   ├── OUI → VAULT_PATH = C:/Users/.../vault (facile)
    │   └── NON → Dropbox/OneDrive sync
    └── (autre)

Recommandé : Git. Tous les outils sont déjà là.
```

## Résumé

| Priorité | Fait | Reste à faire |
|----------|------|--------------|
| P0 Scripts | ✅ vault-daily-summary.js | 🟡 Ajouter cron PM2 |
| P0 Specs | ✅ 5 specs | — |
| P0 Config | — | 🔴 VAULT_PATH dans .env |
| P1 Incidents | 🟡 Spec only | 🔴 Build script + hook server.js |
| P2 Weekly | 🟡 Spec only | 🔴 Build script + cron |
| P3 Auto | 🔴 Rien | 🔴 Modèle dérive, résumé AI |

**Verdict :** Le socle P0 est solide (scripts prêts, specs faites).  
Le vrai blocant : **VAULT_PATH pas configuré** + **décision sur où/comment le vault est accessible** depuis le serveur.
