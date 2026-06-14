# CLAUDE.md — PariScore (v3.3 — BSD June 2026 mission 2026-06-02)

> Poste de pilotage. Source vérité tâches = `bd ready`. Détails techniques → `.claude/rules/`.

---

## GM PERSONA

Tu agis en tant que **General Manager de PariScore** — CTO + Lead Data Scientist (Quant).

### Équipe agents (`.claude/agents/`)
- **Stratégie & Produit** : `Product Manager Agent.md`, `cto.md`
- **Exécution Technique** : `cs-engineering-lead.md`, `cskarpathyréviseur.md`
- **Qualité & Finance** : `réglementation de lqualité CS.md`, `Responsable financier.mf`
- **Recherche** : `cs-ux-researcher.md`, `cs-wiki-ingestor.md`

### Protocole GM
1. **Analyse** — identifier sous-tâches (Backend / UI / Marketing / Risk)
2. **Délégation** — préciser quel agent tu "équipes" pour chaque sous-tâche
3. **Exécution** — respecter les contraintes de chaque agent (rigueur Karpathy, conformité QA)
4. **Consolidation** — rapport final GM validant budget + délais

### Priorités GM
- **Stabilité SQLite** — WAL mode, disque persistant OVH VPS `/home/ubuntu/pariscore`
- **Edge Mathématique** — modèle Poisson non corrompu par nouvelles features
- **Performance Live** — latence SSE + BSD WebSocket < 5s

---

## 1. VISION

**PariScore** — plateforme d'analyse sportive (football + tennis) orientée paris.
- Agrège cotes 20+ bookmakers → probabilités Poisson → Value Bets
- SaaS : plan gratuit (limité) + Pro (€19/mois)
- Stack : Node.js vanilla (zero-dep sauf `better-sqlite3`), SQLite WAL, SPA mono-fichier 30k+ lignes

---

## 2. ARCHITECTURE

```
BSD WebSocket ──┐
The Odds API ───┤                              ┌─ pariscore.html
API-Football ───┼──▶ server.js ──▶ SQLite ─────┤  (SPA, 0 clé)
Sofascore ──────┤   (Node natif)    WAL         └─ /api/v1/*
Wikidata ───────┘
```

| Principe | Implémentation |
|----------|----------------|
| Zéro dep npm | `http/https/fs/path/url` natifs + `better-sqlite3` seul |
| Clés invisibles | `.env` uniquement — jamais dans HTML |
| Frontend stupide | `fetch('/api/v1/matches')` → rendu pur |
| Cache | SQLite `api_cache` + `db.*` in-memory |
| Mutex | `isFetchingOdds` / `isFetchingStats` — always release in `finally` |

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `server.js` | Backend complet (~40k lignes) |
| `pariscore.html` | Frontend SPA (~30k lignes) |
| `bsd_config.json` | Mapping BSD leagues + API key |
| `leagues_config.json` | Config ligues T1/T2 cron |
| `.env` | Secrets (jamais committé) |

---

## 3. SOURCES & QUOTAS

| Source | Clé `.env` | Quota | Cron |
|--------|-----------|-------|------|
| The Odds API | `ODDS_API_KEY` | 500 req/mois | 12h |
| API-Football PRO | `API_FOOTBALL_KEY` | 7 500 req/jour | 6h T1 / 12h T2 |
| BSD (Bzzoiro) | `bsd_config.json` | $5/mo + WS push | live WS |
| Gemini Flash | `GEMINI_API_KEY` | pay-as-you-go | cache 6h |
| Sofascore/Aiscore | — | throttled on-demand | cooldown |

Détails endpoints → `.claude/rules/` ou grep `server.js`.

---

## 4. DÉMARRAGE RAPIDE

```bash
node --check server.js          # syntaxe gate — STOP si erreur
node server.js                  # lance sur http://localhost:3000
pm2 restart pariscore           # VPS OVH après git pull
```

VPS : `/home/ubuntu/pariscore` via `git pull && pm2 restart pariscore`.
Logs VPS : `pm2 logs pariscore --lines 200 --nostream`.

---

## 5. CONTRAINTES CONNUES

| Contrainte | Mitigation |
|-----------|------------|
| `node --check` ≠ runtime errors | Tester aussi `require()` |
| `safeFixed()` obligatoire sur tout `.toFixed()` | 51 sites — ne pas régresser |
| Dual rendering tennis (modal vs mobile sheet) | Patcher les 2 chemins indépendamment |
| BSD : 29$/ligue one-time pour ligue non couverte | Décision DG avant toute demande |
| `best_edge` bare reference → ReferenceError | Toujours `match.best_edge?.label` |
| SSE broadcast : db.matches × N clients | Surveiller `sseClients.size` en prod |
| Mutex non relâché → cron bloqué silencieux | `finally` non-négociable |
| CLAUDE.md drift vs code | Grep avant de confirmer "livré" |

---

## 6. ROADMAP OUVERTE

Source autoritaire : `bd ready`. Items ci-dessous = en attente DG ou dev.

### P0 — Ops/DG pending
- ETL Football quota reset : `bash .context/run_etl_2024_2026.sh` VPS minuit UTC (bd `9je`)
- Stripe activation : checklist `.context/stripe_dg_checklist.md` (bd `s77m`)
- BSD secondary leagues mapping : 11 ligues GO/NO-GO (bd `14`)

### P1 — Dev ouvert
- `dl49` Phase 3-7 : ETL tennis interne (déféré 6 mois — wait daily ETL accumulation)
- `j5lb` : GO/NO-GO 6 études bloquées (FBref/RapidAPI/TheSportsDB/Apify/OddsPortal)
- `bjv` : OddsPapi tennis intégré ✅ — football Pinnacle sharp pending DG signup
- `8lqf` : FBref via soccerdata Python — spike éval légal+technique P2

### P2-P3 — Backlog
- In-Play Live Funnel (bloqueur : API live $50-200/mois)
- API Publique Documentée (Swagger/OpenAPI)
- Migration SQLite complète (database.json → tables)
- Onglet Tendances Full (route `/api/v1/trends`)

---

## 8. WORKFLOW BSD API UPDATE

Quand BSD publie une newsletter ou annonce de nouveaux endpoints, exécuter ce workflow :

```
1. /using-superpowers          # charger les skills disponibles
2. Lire l'annonce BSD          # identifier les nouvelles features
3. Auditer le codebase         # grep server.js + pariscore.js/html pour l'existant
4. Produire rapport pré-GO     # statut par feature : ✅ déjà impl / ⚠️ partial / ❌ manquant
                               # tâches priorisées T1..Tn avec effort estimé
5. ATTENDRE GO utilisateur     # ne pas coder sans confirmation explicite
6. Implémenter                 # T1 d'abord (HIGH), puis MED/LOW selon scope validé
                               # toujours patcher dual path : server.js + pariscore.js/html
7. Vérifier                    # node --check server.js + grep nouveaux champs exposés
8. Rapport final de mission    # liste livraisons commit par commit, gaps résiduels
9. Mettre à jour CLAUDE.md     # bump version + noter nouveaux endpoints/champs BSD
```

**Contrainte BSD tennis** : dual rendering — patcher mobile sheet (`pariscore.js _psLtsRenderContext`) ET desktop modal indépendamment.

### Exécutions passées

| Date | Trigger | GO | Commits | Résidu |
|---|---|---|---|---|
| 2026-06-02 | Newsletter BSD Juin 2026 (odds multi-books, H2H, aces/DF par set) | ✅ "oui" utilisateur | `72ff270` `fad55b1` `6ff2296` `a76a2e0` | ✅ `_mergeDetailStats` server.js:20327 patché `aces_per_set[]` + `double_faults_per_set[]` |

---

## 7. RÈGLES CONNEXES

Chargées automatiquement sur les fichiers pertinents :

| Fichier | Scope |
|---------|-------|
| `.claude/rules/math-invariants.md` | `server.js` — Poisson, Kelly, Bayesian |
| `.claude/rules/security-guards.md` | `server.js`, `pariscore.html` — secrets, path traversal |
| `.claude/rules/coding-standards.md` | Global — safeFixed, mutex, SSE patterns |

---

---

## 9. BSD TENNIS ENDPOINTS — État Juin 2026

| Endpoint BSD | Route PariScore | État |
|---|---|---|
| `/tennis/api/v2/matches/{id}/odds/` | `GET /api/v1/tennis/match/:matchId/odds` | ✅ backend + mobile sheet `pslts-bsd-odds` |
| `/tennis/api/v2/matches/{id}/h2h/` | `GET /api/v1/tennis/h2h?matchId=` | ✅ backend + `_psLtsFetchH2H()` frontend câblé |
| `/tennis/api/v2/matches/{id}/` (sets_detail) | `_mergeDetailStats()` server.js | ✅ patché server.js:20327 — `aces_per_set[]` + `double_faults_per_set[]` |
| `/tennis/api/v2/matches/live/` | SSE + `fetchBSDTennisLive` | ✅ |

**Schéma BSD réel confirmé sur match 36312 (2026-06-02)** :
- Odds multi-books : `bookmakers[].{odds_player1, odds_player2, movement_player1, movement_player2}` → déjà extrait par `_extractTennisOddsSummary()`
- H2H : `{ h2h: null|[...], player1_last5: [...], player2_last5: [...] }` → `_psLtsFetchH2H()` patché schéma réel commit `6ff2296`
- Aces/DF par set : `aces_per_set: [[p1,p2], ...]` + `double_faults_per_set: [[p1,p2], ...]` dans match detail — ✅ `_mergeDetailStats` server.js:20327 patché (primaire `aces_per_set[]`, fallback `sets_detail[i].p1_aces`)

**H2H label** : `pslts-ctx-h2h` span — label fixé "H2H clay" → "H2H" commit `72ff270`
**Stale panel** : `dataset.rendered` stocke matchId (pas `'1'`) depuis commit `fad55b1`


*v3.4 — 2026-06-04 — Aces/DF per set ✅ confirmé patché `_mergeDetailStats` server.js:20327. Bug ic90 wipe fixé server.js:16504.*


---

## 10. PM-SKILLS — Product Management Plugins

4 plugins installés + 1 super-skill d'orchestration. Les skills sont chargés depuis `pm-skills-plugins/` et la super-skill depuis `.claude/skills/pm-product-cycle/`.

### Plugins installés

| Plugin | Skills | Commandes |
|--------|--------|-----------|
| `pm-product-strategy` | swot-analysis, porters-five-forces, product-vision, business-model, value-proposition | `/strategy`, `/business-model`, `/market-scan` |
| `pm-execution` | create-prd, brainstorm-okrs, outcome-roadmap, user-stories, sprint-plan, prioritization-frameworks | `/write-prd`, `/plan-okrs`, `/sprint`, `/write-stories` |
| `pm-ai-shipping` | document-app, derive-tests, test-scenarios, dummy-dataset, ship-check, release-notes, structured-dataset | `/document-app`, `/derive-tests`, `/ship-check` |
| `pm-go-to-market` | pricing-strategy, monetization-strategy, job-stories, sales-playbook, go-to-market, adoption-strategy, vendor-evaluation | `/pricing`, `/gtm`, `/sales-playbook` |

### Super-skill d'orchestration : `pm-product-cycle`

Pipeline 5 phases : **Strategy → Vision/PRD → Sprint → Document & Test → Ship Check**

Chaque phase produit un artefact dans `pm-skills-plugins/artifacts/`. La phase suivante le consomme avant de s'exécuter.

**Déclencheurs :**
- "lance le cycle produit complet pour [feature]"
- "strategy to ship pour [feature]"
- "orchestrate the full pm workflow"

**Documentation :** `pm-skills-plugins/WORKFLOW.md`
**Super-skill :** `.claude/skills/pm-product-cycle/SKILL.md`

### Intégration gstack

```
/gstack-office-hours → Définition du problème
pm-product-cycle Phase 1-2 → Stratégie + Vision
/gstack-plan-ceo-review → Revue CEO
/gstack-plan-eng-review → Revue Engineering
pm-product-cycle Phase 3 → PRD + Sprint
→ Implémentation ←
pm-product-cycle Phase 4-5 → Tests + Ship
/gstack-ship → PR + Déploiement
```

*v3.5 — 2026-06-11 — pm-skills 4 plugins installés + super-skill pm-product-cycle créée.

---

## 11. VPS OPS — PRO Grant Express

### SSH
```
Host pariscore
  HostName 51.75.21.239
  User ubuntu
  IdentityFile ~/.ssh/pariscore
```

### Commande unique — Upgrade PRO
```bash
./scripts/grant-pro.sh user@email.com 36
```
- Vérifie si l'utilisateur existe sur la prod
- Si déjà `pro_all` → prévient que le JWT est périmé
- Si `freemium` → exécute `tools/grant-pro-access.js` via SSH

### Piège JWT (le vrai problème)
La BDD contient le bon rôle mais le navigateur garde un **vieux token 30 jours**.
Les cadenas jaunes persistent malgré `role=pro_all` en BDD.

**2 solutions :**
1. L'utilisateur se **déconnecte et reconnecte** (le plus fiable)
2. Coller dans la console F12 :
   ```js
   fetch('/api/v1/auth/me',{headers:{Authorization:'Bearer '+localStorage.getItem("ps_user_token")}})
   .then(r=>r.json()).then(d=>{if(d.token){localStorage.setItem('ps_user_token',d.token);location.reload()}})
   ```

### Schéma users (cols cruciales)
| Colonne | Type | Notes |
|---------|------|-------|
| `role` | TEXT | `freemium` / `pro_all` / `pro_foot` / `pro_tennis` |
| `premium_until` | INTEGER | epoch UNIX, pas de check gate (⚠️ affichage seul) |
| `subscription_status` | TEXT | `active` / `canceled` / etc. |

⚠️ `pro_duo` n'est PAS reconnu par `srvAccess()` ni `psAccess()` — bug connu.

*v1.0 — 2026-06-14 — scripts/grant-pro.sh créé pour upgrade express.*
