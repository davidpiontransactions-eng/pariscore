# 🧪 AUDIT QA — Cohérence Données & Santé Serveur

**Date** : 2026-06-18 15:23
**Équipe** : GStack-QA
**Serveur** : localhost:3000 (Node v24.15, 166MB RAM, uptime 243h)

---

## 1. SYNTHÈSE EXÉCUTIVE

| Domaine | Statut | Score |
|---------|--------|-------|
| Serveur (uptime, RAM, shutdown) | 🟢 OK | 9/10 |
| Top10 Tennis (NaN, cohérence) | 🟢 OK | 8/10 |
| Live Tennis (ID joueurs) | 🟡 WARN | 5/10 |
| Football Matches | 🔴 ERROR | 3/10 |
| Métriques DATA_PIPELINE_V3 | 🟡 WARN | 4/10 |
| Logs erreur | 🟡 WARN | 6/10 |

**Score santé global** : 6/10

---

## 2. RÉSULTATS DÉTAILLÉS

### 2.1 Serveur — 🟢 OK

| Métrique | Valeur | Seuil |
|----------|--------|-------|
| HTTP Status | 200 | ✅ |
| RAM | 166 MB | ✅ (<500MB) |
| Uptime | 243h | ✅ |
| BSD connecté | true | ✅ |
| Cache buffer | 49 valides / 18 expirés | ✅ |
| Homepage TTFB | 14ms | ✅ (<100ms) |
| Top10 TTFB | 6ms | ✅ (<100ms) |
| Shutdown handler (SIGTERM) | gracefulShutdown() présent | ✅ |
| WAL checkpoint au shutdown | pragma wal_checkpoint(TRUNCATE) | ✅ |

### 2.2 Top10 Tennis — 🟢 OK

- **119 matchs actifs**, 10 dans le Top10
- **0 NaN, 0 Infinity**, 0 score hors bornes
- **0 joueur manquant** (player1/player2 toujours présents)
- Elo : null pour Challenger (attendu), OK pour ATP/WTA (ex: Shelton 1871)
- metrics object : **PRÉSENT** ✅ (grâce au fix P0-3 appliqué)
- **MAIS** tous les sous-champs metrics.* sont 
ull (voir section 2.4)

### 2.3 Live Tennis — 🟡 WARN

- **251 matchs live**
- **237 / 251 joueurs sans ID** (name = OK, id = null)
  - Cause : ESPN/BSD live feed n'inclut pas systématiquement l'ID joueur
  - Impact : les fonctions H2H, Elo lookup échouent pour ces joueurs
  - Gravité : MEDIUM — l'info de base (nom, score) est OK

### 2.4 Métriques DATA_PIPELINE_V3 — 🟡 WARN

**Bug confirmé** : Tous les metrics.* sont 
ull pour tous les matchs.

**Root cause** : computeAllMetrics() (l.48956) dépend de globalThis.__tennisVBWarmMatches et serve_index/eceive_index. Ces indices ne sont disponibles QUE pour les joueurs ATP/WTA avec historique Sackmann. Les Challenger/ITF (majorité du Top10 actuel) n'ont pas ces données.

**Logs confirment** : [BUG-001] __tennisPlayerMatches(X): serve_index ou receive_index manquants, retourne null partiel — flooding pour 20+ joueurs non-ATP.

### 2.5 Football Matches — 🔴 ERROR

- GET /api/v1/matches → {"error":"Inscription requise","code":"AUTH_REQUIRED"}
- La route football est protégée par authentification
- Non testable sans token — mais l'erreur est propre (HTTP 40x, pas 500)

### 2.6 Logs Erreur — 🟡 WARN

- [BUG-001] flooding : __tennisPlayerMatches spamme pour joueurs Challenger
- Aucune erreur critique (crash, OOM, SIGSEGV)
- Aucun log de NaN/Infinity dans les 100 dernières lignes

---

## 3. TABLEAU DES ANOMALIES

| # | Gravité | Localisation | Description | Impact |
|---|---------|-------------|-------------|--------|
| QA-1 | MEDIUM | server.js:49026 | __tennisPlayerMatches spamme [BUG-001] pour 20+ joueurs | Logs saturés |
| QA-2 | HIGH | server.js:48956 | metrics tous null — computeAllMetrics ne fonctionne que pour ATP/WTA | UI vide |
| QA-3 | LOW | API live tennis | 237/251 joueurs sans ID | H2H/Elo indispo |
| QA-4 | MEDIUM | /api/v1/matches | AUTH_REQUIRED — route football protégée | Non testable |

---

## 4. RECOMMANDATIONS

| # | Priorité | Action | Effort |
|---|----------|--------|--------|
| R1 | **P0** | Supprimer ou throttler le console.warn("[BUG-001]...") — il inonde les logs | 5 min |
| R2 | **P1** | Ajouter fallback pour computeAllMetrics quand serve_index est null (utiliser safePercent + valeur par défaut ATP/WTA) | 1h |
| R3 | **P1** | Pré-peupler serve_index pour les joueurs non-Sackmann via Tennis Abstract / UTR | 3h |
| R4 | P2 | Ajouter un log distinct pour null ID live (séparer de BUG-001) | 10 min |
