# TODO — Corrections P0 (Audit Chaîne de Synchronisation)

> Généré le 17/06/2026 — Audit DATA_PIPELINE_V3
> Mis à jour le 18/06/2026 — Session restauration (5 commits)

---


## ✅ SESSION 18/06/2026 (PM) — REDESIGN MODAL AUTH — TERMINÉ

### Commits à venir : redesign auth modal (CSS + HTML + JS)

| Tâche | Détail | Fichier |
|-------|--------|---------|
| CSS h2 | Text-shadow 3D supprimé → style propre 32px | `pariscore.html` |
| CSS .auth-logo | Logo SVG 160px, drop-shadow | `pariscore.html` |
| CSS .auth-forgot | Lien "Mot de passe oublié", hover vert | `pariscore.html` |
| CSS .input-valid | Bordure verte validation temps réel | `pariscore.html` |
| CSS .btn-spinner | Animation rotation + .is-loading | `pariscore.html` |
| HTML logo | `<img>` au-dessus du titre h2 | `pariscore.html` |
| HTML forgot | `<a class="auth-forgot">` sous password | `pariscore.html` |
| JS validateEmailField | Validation onblur + .input-valid | `pariscore.js` |
| JS validatePasswordField | Validation onblur, 8 chars register | `pariscore.js` |
| JS attachAuthBlurValidators | Listeners blur sur 4 champs | `pariscore.js` |
| JS openAuthModal | Appelle attachAuthBlurValidators() | `pariscore.js` |
| JS showForgotPassword | Toast temporaire | `pariscore.js` |
| **Rapport** | Audit concurrentiel + 2 propositions | `.context/audit-auth-redesign-2026-06-18.md` |

### Backend — déjà conforme
- Rate limiting actif (5 tentatives/15min/IP)
- Message d''erreur uniforme (`Email ou mot de passe incorrect`)
- SQL parameterized (injection impossible)

### Restant (backlog)
- [ ] Route `/api/v1/auth/forgot-password` — nécessite config SMTP
- [ ] Migration JWT localStorage → httpOnly cookie
- [ ] Password breach check (HIBP k-anonymity)

## ✅ SESSION 18/06/2026 — TERMINÉ

| Commit | Description |
|--------|-------------|
| `590a2d7` | 🔧 Navbar : showPage + bnGo restaurés + cache bust v240618-1 |
| `b2e8be2` | 🔧 Login admin pariscore.html : accepte username sans @ |
| `b61e488` | 🔧 Admin login : error handling défensif, showDashboard isolé |
| `2d3cfc1` | 🆕 Bannière freemium "Mode Gratuit" sur page matchs |
| `22e17b7` | 🆕 Essai gratuit 24h auto à l'inscription + fix requireUserAuth |
| **Rapport** | `.context/ANALYSE-ODDALERTS-FREEMIUM.md` |

### Contexte technique
- **Navbar** : `pariscore.js` corrompu sur VPS (else if orphelin L6529) → SCP + fix
- **Auth admin** : validation `!includes('@')` bloquait username, catch générique masquait erreurs
- **Freemium** : backend gate existant (5 ligues, 10 vues/j), ajout bannière frontend + essai 24h matchday
- **requireUserAuth** : ne listait pas `matchday` → bloquait l'accès Pro pendant l'essai

### Fichiers modifiés
- `pariscore.js` : showPage, bnGo, submitLogin, updateNavAuthState, submitRegister
- `pariscore.html` : cache bust, bannière freemium
- `admin.html` : login error handling, showDashboard défensif
- `server.js` : register trial, requireUserAuth +matchday

---

## ✅ DÉJÀ CORRIGÉS DANS LE CODE ACTUEL

Ces bugs étaient mentionnés dans le rapport QA mais **le code source est déjà corrigé** :

| Bug | Correction | Fichier:Ligne |
|-----|-----------|---------------|
| BUG-002 | `bp_conv`, `bp_saved` intégrés dans `computeAllMetrics()` | `server.js:48958-48959` |
| BUG-003 | `srv_sparkline`, `ret_sparkline` intégrés dans `computeAllMetrics()` | `server.js:48960-48961` |
| Cache _tnTop10Cache viewer | TTL passé de 60s → **5min** | `server.js:25574` |
| Cache _tnTop10Cache bettor | TTL passé de 30s → **3min** | `server.js:25575` |
| Boot warmer Top10 | Délai passé de 60s → **5s** | `server.js:36259` |
| Cron refresh | `setInterval(_refreshTop10Cache, 5min)` actif | `server.js:36276` |

---

## 🔴 P0 — CORRECTIFS APPLIQUÉS (à déployer)

### P0.1 — BUG-001 : Valeurs fictives dans `__tennisPlayerMatches`
**Fichier :** `server.js:49003-49024`
**Symptôme :** `serve_index`, `receive_index`, `bp_won`, etc. remplacés par des valeurs par défaut fictives (30, 20, 3, 4, 2, 5, 1, 1) quand les vraies données sont absentes. Cela injectait des métriques fausses dans tout le pipeline EWMA.
**Correctif appliqué :**
- `srvIdx = playerSide.serve_index` (plus de fallback 30)
- `retIdx = playerSide.receive_index` (plus de fallback 20)
- `bp_won/bp_lost/bp_saved/bp_faced/tb_won/tb_lost` : plus de `||` avec valeurs par défaut
- `svr_pts_lost` et `ret_pts_lost` : calcul conditionnel (null si l'index est null)
- Ajout d'un `console.warn("[BUG-001] ...")` pour tracer les absences de données
**Action requise :** `git add server.js && git commit -m "bugfix: BUG-001 supprime les valeurs fictives dans __tennisPlayerMatches" && git push && ssh deploy`

---

## 🟡 P0 — CORRECTIFS À APPLIQUER

### P0.4 — safeFixed() muet sur les valeurs nulles
**Fichier :** `pariscore.js:14813-14817`
**Symptôme :** `safeFixed()` retourne `—` silencieusement sans aucun log. Impossible de savoir quelle métrique manque et pourquoi.
**Correctif proposé :**
```js
function safeFixed(val, digits = 2) {
  if (val == null || isNaN(val)) {
    console.warn('[safeFixed] Valeur nulle → "—" (stack)', new Error().stack?.split("\n").slice(2,4).join(" | "));
    return '—';
  }
  const n = Number(val);
  return isFinite(n) ? n.toFixed(digits) : '—';
}
```
**Action :** Appliquer le patch + commit + push

### P0.5 — Vérifier le peuplement de `__tennisVBWarmMatches`
**Fichier :** `server.js:36237` (stockage) / `server.js:48992` (lecture)
**Symptôme :** `__tennisPlayerMatches` dépend de `__tennisVBWarmMatches` (snapshot des matchs actifs). Si ce snapshot est vide ou jamais peuplé, toutes les métriques tennis retournent `null`.
**Vérification à faire :**
```bash
# Après déploiement, vérifier les logs :
grep "tennisVBWarmMatches" /path/to/logs
# Vérifier que la ligne 36237 s'exécute bien après le warm-up Top10
```
**Action :** Observation post-déploiement + correction si nécessaire

---

## 🟡 P1 — AMÉLIORATIONS

| # | Amélioration | Fichier | Détail |
|---|-------------|---------|--------|
| 1.1 | Logger les `catch` silencieux | `server.js` (multiple) | Ajouter `console.warn/error` dans tous les blocs `catch (_) { return ... }` |
| 1.2 | Dashboard erreurs par onglet | Nouveau endpoint | `GET /api/v1/admin/error-dashboard` avec compteurs par page |
| 1.3 | Timeout Monte Carlo RG >60s | `server.js` | Timeout asynchrone avec fallback plutôt que bloquer la réponse |
| 1.4 | SSE connection leak check | `server.js` + `pariscore.js` | Vérifier que les connexions EventSource sont bien fermées |

---

## 📋 PROCÉDURE DE DÉPLOIEMENT

```bash
# 1. Commit et push
cd "C:\Users\david\Documents\dev PariScore\ParisScorebis"
git add server.js
git commit -m "bugfix: BUG-001 — supprime valeurs fictives __tennisPlayerMatches + warn logger"
git pull --rebase
git push

# 2. Déploiement VPS OVH
ssh ubuntu@51.75.21.239
cd /path/to/pariscore
git pull
pm2 restart pariscore  # ou pm2 restart all
pm2 logs --lines 50    # vérifier que le serveur démarre sans erreur

# 3. Vérification post-déploiement
curl http://localhost:3000/api/v1/status
# Ouvrir l'UI → onglet Tennis → vérifier que les métriques s'affichent
# Vérifier la console navigateur pour les warn [BUG-001] et [safeFixed]
```

---

## 🔍 ÉTAT DES LIEUX POST-AUDIT

| Source | Statut | Taux d'échec estimé | Notes |
|--------|--------|---------------------|-------|
| BSD API (polling 30s) | 🟢 OK | <1% | WebSocket push + REST fallback |
| ESPN (polling 30s) | 🟡 À surveiller | ~5% | Rate limiting possible |
| Odds API (TTL 2h) | 🟢 OK | <1% | Free tier, quota limité |
| FBref / Sofascore | 🟡 À surveiller | ~10% | Blocage IP possible |
| Cache _tnTop10Cache | 🟢 OK (corrigé) | N/A | TTL 5min/3min + warmer 5s |
| BUG-001 (métriques fictives) | 🟢 CORRIGÉ | N/A | Plus de fausses données |
| safeFixed() logging | 🔴 À FAIRE | N/A | Patch en attente |

---

## ✅ SESSION 2026-06-18 (NIGHT) — SPIDER CHART — TERMINÉE

### 7 bugs corrigés + commit c04a5a5 poussé vers origin/main

| Bug | Sévérité | Fichier | Correction | Statut |
|-----|----------|---------|-----------|--------|
| B1 | P0 | pariscore.js:7070 | beginAtZero: true -> beginAtZero: false, min: 20, max: 100 | CORRIGÉ |
| B3 | P1 | pariscore.js:7020-7023 | Guards serve_index/receive_index tolèrent 1 null (?? 50) | CORRIGÉ |
| B4 | P1 | pariscore.js:7015-7016 | console.warn() sur l10_pts null | CORRIGÉ |
| B2 | P2 | pariscore.html | Classes mortes .spider-polygon-p1/p2 retirées | CORRIGÉ |
| B5 | P2 | pariscore.js:7025-7029 | Détection >=4/6 axes à 50 -> warn structuré | CORRIGÉ |
| B6 | P3 | pariscore.html | CSS .recharts-* legacy supprimée | CORRIGÉ |
| B7 | P3 | pariscore.js:7007-7009 | rankScore() sécurisé (r > 2000, Math.min(100, ...)) | CORRIGÉ |

### Bonus
- B1 cascadé sur renderTeamRadar() + renderAttributesRadar() — 3 radars fixés au lieu d'1
- Backend vérifié (server.js) : pipeline l10_pts, serve_index, receive_index sain

### Fichiers commités
- pariscore.js : renderTn2Radar() — 6 corrections (L6988-7116)
- pariscore.html : CSS mort remplacé par commentaires
- spider_chart_issue.md : nouveau rapport d'audit (107 lignes)
- CLAUDE.md, todo.md : documentation session

### Actions post-session (backlog)
- [ ] Tests fonctionnels : lancer node server.js (~4min warmup) et tester visuellement le radar tennis
- [ ] Déploiement VPS : ssh pariscore -> bash scripts/update_vps.sh
- [ ] Planifier migration Variant B (SVG natif glow) dans un sprint séparé

---

## 🔴 
## 🧠 SESSION 20/06/2026 — TIMESFM FORECAST ROUTES — TERMINÉ

### Routes API déployées dans server.js (commit 7668d06)
| Route | Statut | Données |
|-------|--------|---------|
| GET /api/v1/forecasts/tennis | ✅ 200 | 354 prévisions joueurs |
| GET /api/v1/forecasts/tennis/trending | ✅ 200 | Krajinovic +6.1%, Stearns -4.2% |
| GET /api/v1/forecasts/football | ✅ 200 | 437 prévisions équipes |
| GET /api/v1/forecasts/football/trending | ✅ 200 | Freiburg +403%, Volendam -86.8% |

### Problème corrigé
Routes placées après l'appel à handleAPI() dans http.createServer → dead code. Déplacées dans handleAPI() + fix noms colonnes (player_name→ntity_label, surface→context, db.sqlite?→sqldb, safeJsonParse→JSON.parse).

### Déploiement VPS — ✅ TERMINÉ
- [x] git push origin main → GitHub
- [x] ssh pariscore (config ~/.ssh/pariscore avec clé id_ed25519_vps)
- [x] git pull origin main — fast-forward c6c92e5..7668d06 (7 fichiers)
- [x] pm2 restart pariscore — process 4111055 redémarré, logs OK
- [x] Export table 	imesfm_forecasts (791 lignes) de la DB locale → import dans DB VPS
- [x] Vérifié count: SELECT COUNT(*) → 791 dans pariscore.db VPS
- [ ] 🔲 Tester curl les 4 routes sur le VPS (bloqué par quoting PowerShell, test manuel via navigateur)

### 🔲 P2 — UI TimesFM (frontend dans pariscore.html + pariscore.js)
- [ ] Badge tendance (↑ +X% / ↓ -X%) sur cartes joueurs/équipes
- [ ] Sparkline SVG (courbe des 6 points forecast) dans les cartes
- [ ] Alimenter la section "Tendances du moment" (#page-tendances) avec les données /trending — top risers + top decliners
- [ ] Rafraîchissement périodique (polling 5min) ou au changement d'onglet
- [ ] Test visuel dans le navigateur après déploiement
- [ ] Vérifier que la tâche CRON TimesFM tourne (build quotidien 03:00)

---

## 🔲 PROCHAINE SESSION — UI TIMESFM

### Prioritaire
1. **Badge tendance** — ntity_label + 	rend_pct injectés dans les cartes joueurs/équipes
2. **Sparkline SVG** — courbe des 6 orecast_ts dans chaque carte
3. **Section "Tendances du moment"** — #page-tendances alimentée via /api/v1/forecasts/{sport}/trending
4. **Vérification** — ouvrir le site, naviguer sur les pages Tennis + Football, confirmer l'affichage

### Post-déploiement
- [ ] Tester les 4 routes en production (navigateur → https://pariscore.com/api/v1/forecasts/tennis)
- [ ] Vérifier logs VPS (pm2 logs --lines 50 | grep -i timesfm
---

## SESSION 20/06/2026 - TIMESFM FORECAST ROUTES - TERMINE

### Routes API deployeees dans server.js (commit 7668d06)
| Route | Statut | Donnees |
|-------|--------|---------|
| GET /api/v1/forecasts/tennis | OK 200 | 354 previsions joueurs |
| GET /api/v1/forecasts/tennis/trending | OK 200 | Krajinovic +6.1%%, Stearns -4.2%% |
| GET /api/v1/forecasts/football | OK 200 | 437 previsions equipes |
| GET /api/v1/forecasts/football/trending | OK 200 | Freiburg +403%%, Volendam -86.8%% |

### Probleme corrige
Routes placees apres appel a handleAPI() dans http.createServer -> dead code. Deplacees dans handleAPI() + fix noms colonnes (player_name->entity_label, surface->context, db.sqlite?->sqldb, safeJsonParse->JSON.parse).

### Deploiement VPS - TERMINE
- [x] git push origin main -> GitHub
- [x] ssh pariscore
- [x] git pull origin main - fast-forward c6c92e5..7668d06
- [x] pm2 restart pariscore - logs OK
- [x] Export table timesfm_forecasts (791 lignes) importee dans DB VPS
- [x] Verifie count: 791 lignes dans pariscore.db VPS

### P2 - UI TimesFM (frontend)
- [ ] Badge tendance (+X%% / -X%%) sur cartes joueurs/equipes
- [ ] Sparkline SVG (courbe 6 points forecast) dans les cartes
- [ ] Alimenter la section Tendances du moment avec /trending
- [ ] Rafraichissement periodique (polling 5min)
- [ ] Test visuel navigateur
- [ ] Verifier tache CRON TimesFM (build quotidien 03:00)

---

## PROCHAINE SESSION - UI TIMESFM

### Prioritaire
1. Badge tendance sur cartes joueurs/equipes
2. Sparkline SVG dans chaque carte
3. Section Tendances du moment via /trending
4. Verification visuelle

### Post-deploiement
- [ ] Tester les 4 routes en production
- [ ] Verifier logs VPS (pm2 logs | grep timesfm)
