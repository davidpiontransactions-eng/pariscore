# Spec — vault-config-reference.js

Génère une note de référence dans le vault Obsidian listant toutes les configurations actives de PariScore. Une seule note, écrasée à chaque run.

## Fichier

scripts/vault-config-reference.js

## Schedule

À la main ou post-déploiement (pas de cron auto). Hook dans le script de déploiement scripts/update_vps.sh :

```bash
# Fin du script de déploiement
node scripts/vault-config-reference.js
```

## Structure du script

Même pattern que les autres scripts :
- 'use strict'
- fs.readFileSync(.env) pour les chemins
- fs.readFileSync() pour chaque fichier de config — pas de DB
- Frontmatter + sections markdown

## Données produites

Une note : ${VAULT_PATH}/config-reference.md (écrasée à chaque run)

## Sections de la note

### Frontmatter

```yaml
---
type: reference
title: Configuration PariScore
generated_at: 2026-06-13T05:00:00Z
sources:
  - .env
  - leagues_config.json
  - flags_config.json
  - bsd_config.json
  - cache_profiles.json
---
```

### 1. Endpoints API externes

Lecture : .env

```markdown
## 🌐 API Externes

| Service | Status | Clé présente |
|---------|--------|-------------|
| BSD API | ✅ | bsd_config.json |
| The Odds API | ✅ | .env |
| API-Football | ✅ | .env |
| Stripe | ✅ | .env |
| Gemini AI | ❌ | .env |
```

Pour chaque service, extraire les variables d'env pertinentes et vérifier si elles sont non-vides.
Statut : ✅ si clé présente, ❌ si absente.

### 2. Ligues suivies

Lecture : leagues_config.json

```markdown
## ⚽ Ligues Football

| Ligue | ID | Pays | Priorité |
|-------|----|------|----------|
| Ligue 1 | fr.1 | France | Haute |
| Premier League | en.1 | Angleterre | Haute |
| La Liga | es.1 | Espagne | Haute |
...
```

Généré depuis leagues_config.json — lister les 5-10 premières ligues actives.

### 3. Feature Flags

Lecture : flags_config.json

```markdown
## 🚩 Feature Flags

| Flag | Statut |
|------|--------|
| tennis_enabled | ✅ |
| cs2_enabled | ✅ |
| nba_enabled | ✅ |
| mma_enabled | ❌ |
| f1_enabled | ✅ |
```

Chaque flag avec son état (true = ✅, false = ❌).

### 4. Cache

Lecture : cache_profiles.json

```markdown
## ⚡ Profils Cache

| Type | TTL | Stratégie |
|------|-----|-----------|
| API Odds | 12h | stale-while-revalidate |
| Match Stats | 1h | write-through |
| Tennis Elo | 24h | cache-aside |
```

### 5. Cron Jobs Actifs

Lecture : ecosystem.config.js (parser les cron_restart)

```markdown
## ⏰ Cron Jobs

| Job | Schedule | Status |
|-----|----------|--------|
| pariscore | continu | ✅ |
| pariscore-cron-match-stats | 0 3 * * * | ✅ |
| pariscore-vault-daily | 0 5 * * * | ✅ |
| pariscore-cron-rg | 0 */2 * * * | ✅ |
```

### 6. Services

Lecture : from server.js pattern ou manuellement documentés

```markdown
## 🛠️ Services Actifs

| Service | Tech | Status |
|---------|------|--------|
| CatBoost | Python/Node | ✅ (v1) |
| CS2 | Node | ✅ |
| NBA | Node | ✅ |
| F1 | Node | ✅ |
| MMA | Node | ⚠️ (POC) |
| Tennis Elo | Node | ✅ |
| Surface PowerScore | Python | ✅ |
```

### 7. Base de données

Lecture : PRAGMA page_count + file size de pariscore.db

```markdown
## 💾 Base de Données

| Métrique | Valeur |
|----------|--------|
| Taille | 847 MB |
| WAL mode | ✅ |
| Tables | 28 |
| Matchs historiques | 245,000+ |
| Dernier seed | 2026-05-24 |
```

### 8. Serveurs

Lecture : ecosystem.config.js + .env

```markdown
## 🚀 Déploiement

| Plateforme | URL | Stats |
|------------|-----|-------|
| Production | https://pariscore.com | ✅ Up |
| VPS | IP:3000 | ✅ Up |
| Render | pariscore.onrender.com | ✅ Up |
```

## Edge cases

### .env introuvable
```markdown
⚠️ Fichier .env introuvable — les configurations API ne peuvent pas être vérifiées.
Tous les statuts API seront marqués ❌ Inconnu.
```

### Fichier de config JSON manquant
- Logger le fichier manquant
- Afficher ⚠️ dans la section concernée
- Continuer avec les sections suivantes

### Pas de vault
- Logger l'erreur
- Afficher dans stdout
- Exit 1

## Execution modes

```bash
node scripts/vault-config-reference.js              # Production
node scripts/vault-config-reference.js --dry         # Dry run
```

## Exit codes

- 0 = OK
- 1 = Erreur fatale (vault path manquant)

## Dépendances

- fs, path (natifs)

Pas de dépendances npm (pas de DB, pas de API calls).
