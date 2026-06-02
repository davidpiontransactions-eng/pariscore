# CLAUDE.md — PariScore (v3.2 — trimmed 2026-06-02)

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
- `968x` Phase 3 : SSR scores crawler
- `6jro` Plan J : Sofascore continuous scraper webhook

### P2-P3 — Backlog
- In-Play Live Funnel (bloqueur : API live $50-200/mois)
- API Publique Documentée (Swagger/OpenAPI)
- Migration SQLite complète (database.json → tables)
- Onglet Tendances Full (route `/api/v1/trends`)

---

## 7. RÈGLES CONNEXES

Chargées automatiquement sur les fichiers pertinents :

| Fichier | Scope |
|---------|-------|
| `.claude/rules/math-invariants.md` | `server.js` — Poisson, Kelly, Bayesian |
| `.claude/rules/security-guards.md` | `server.js`, `pariscore.html` — secrets, path traversal |
| `.claude/rules/coding-standards.md` | Global — safeFixed, mutex, SSE patterns |

---

*v3.2 — 2026-06-02 — 678→185 lignes. Source vérité tâches = `bd ready`.*
