# 🔥 Rapport d'analyse : Firecrawl pour PariScore

**Date :** 2026-06-28
**Auteur :** CTO & Lead Data Scientist (agent ZCode)
**Objet :** Évaluation de [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) — opportunité d'intégration dans le backend PariScore
**Verdict rapide :** ⚠️ **Intégration conditionnelle — à installer comme couche de fallback uniquement, pas comme source primaire.** Voir §6 (Recommandation).

---

## 1. Qu'est-ce que Firecrawl ?

[Firecrawl](https://github.com/firecrawl/firecrawl) est une plateforme open-source (licence AGPL-3.0) qui expose une **API REST unifiée** pour transformer n'importe quelle page web en **markdown propre, structuré et LLM-ready**, y compris sur des sites JavaScript-rendered (SPA React/Vue), protégés par anti-bot, ou derrière Cloudflare.

**4 primitives :**

| Primitive | Endpoint | Usage |
|---|---|---|
| `scrape` | `POST /v2/scrape` | 1 page → markdown/html/JSON structuré |
| `search` | `POST /v0/search` | Recherche Google + scrape des top résultats |
| `crawl` | `POST /v2/crawl` | Site entier (sitemap, multi-pages asynchrone) |
| `map` | `POST /v2/map` | Récupère tous les URLs d'un domaine sans scraping |
| `extract` | `POST /v2/extract` | **Extraction structurée par schéma JSON** (LLM-driven) |

**Deux modes de déploiement :**
1. **Cloud managé** (`api.firecrawl.dev`) — facturation au crédit (~1 crédit/page, Free tier 500 crédits/mois, plan Hobby $20/mo = 3 000 crédits, Growth $75/mo = 14 000 crédits)
2. **Self-hosted** (Docker) — gratuit mais lourd : Playwright + Chromium + Redis + workers Python/Node + BullMQ. ~1.5 Go RAM minimum.

---

## 2. État actuel de l'arsenal scraping PariScore

Avant d'évaluer Firecrawl, il faut cartographier ce qui existe **déjà**. PariScore a accumulé **6 systèmes de scraping hétérogènes**, chacun résolvant un cas précis :

| Système | Localisation | Cible | Stack | Statut |
|---|---|---|---|---|
| **FlareSolverr** | VPS docker `:8191` | betwatch.fr (passe Cloudflare) | Python proxy | ✅ Prod (via `FLARESOLVERR_URL`) |
| **Apify Transfermarkt** | `APIFY_TOKEN` (.env) | transfermarkt.com (voie D) | Actor `curious_coder` $15/mo | ✅ Prod |
| **gstack browse** | binaire local | betwatch.fr fallback | Chromium headed | ✅ Dev local |
| **Microservice Sofascore** | `render.yaml` pserv `:8765` | sofascore.com | Python + Playwright + Chromium | ✅ Render (plan starter) |
| **Scrapers ad-hoc Node** | `tools/scrape-*.js` | tennis-abstract, betwatch, flashscore, 1xbet | `fetch` HTTP + parsing manuel | ✅ Scripts |
| **Scrapers Python** | `scripts/scrape_*.py`, `fbref_extract.py` | fbref, understat, advanced stats | `requests` + BeautifulSoup | ✅ Scripts |

**Constat :** Le backend n'a **pas de couche d'abstraction unifiée** pour le scraping. Chaque source a son propre client, sa propre gestion d'erreur, son propre transport. C'est fragile et coûteux à maintenir (déjà 13 fichiers `tools/` dédiés).

---

## 3. Ce que Firecrawl apporterait à PariScore

### 3.1 ✅ Bénéfices réels (forte valeur)

#### A. Unification des 6 systèmes → 1 API cohérente
Aujourd'hui, ajouter une nouvelle source scrapée (ex: ATP Tour, WTA, OddsPortal) implique :
- Choisir entre FlareSolverr / Apify / Playwright selon la protection anti-bot
- Écrire un parser HTML ad-hoc (brittle : casse à chaque changement DOM)
- Gérer le transport (fetch / execFileSync / API externe)

Firecrawl remplace tout ça par **un seul appel HTTP POST** :
```js
POST https://api.firecrawl.dev/v2/scrape
{ "url": "https://...", "formats": ["markdown"], "onlyMainContent": true }
```
Le markdown retourné est stable : il résiste aux changements de classes CSS / structure DOM.

#### B. Extraction structurée par schéma (`/v2/extract`) — le gros gain
C'est la killer-feature pour PariScore. Au lieu de parser du HTML fragilement, on fournit un **schéma JSON** et Firecrawl (via LLM) extrait directement les champs :

```js
POST /v2/extract
{
  "urls": ["https://www.atptour.com/en/rankings/singles"],
  "prompt": "Extract top 100 players with rank, name, country, points",
  "schema": {
    "type": "object",
    "properties": {
      "rankings": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "rank": { "type": "number" },
            "name": { "type": "string" },
            "country": { "type": "string" },
            "points": { "type": "number" }
          }
        }
      }
    }
  }
}
```
→ Correspond exactement aux besoins de `seed_historique_*.js` (10 seeders historiques), `tools/scrape-tennis-abstract-elo.js`, `scrape-betfair-wom.js` (étude en cours, bd backlog).

#### C. Gestion native anti-bot (Cloudflare, Turnstile)
Le mode **stealth proxy** de Firecrawl gère Cloudflare/Turnstile sans FlareSolverr. Pour betwatch.fr qui passe déjà par FlareSolverr — Firecrawl cloud pourrait remplacer cette dépendance docker côté VPS.

#### D. Respect du robots.txt + rate limiting intégré
Évite les pièges de ToS que PariScore traque déjà scrupuleusement (cf. CLAUDE.md L417-438 sur Betfair, `.context/betwatch-wom-analysis.md`).

### 3.2 ❌ Points de friction

| Friction | Impact | Mitigation |
|---|---|---|
| **AGPL-3.0** sur le code self-hosted | Obligation de partager les modifs si on expose le service publiquement | Mode **cloud managé** = pas concerné (on consomme l'API, on ne modifie pas leur code) |
| **Coût au crédit** | Free tier = 500 pages/mo (1 crawl ATP Tour = ~100 pages = 20% du quota gratuit). Growth $75/mo = 14k pages | À comparer avec Apify Transfermarkt déjà à $15/mo — pas dominant |
| **Latence** (cloud) | ~3-8s/page vs fetch direct ~200ms | Inacceptable pour **live/in-play** (tennis live, momentum). OK pour **batch/nocturne** |
| **Dépendance externe supplémentaire** | Contredit le dogme "zero-dependency Node.js" du AGENTS.md | ❗ **CRITIQUE** — voir §5 |
| **Self-hosted = stack lourde** | Playwright + Redis + Chromium ~1.5 Go RAM | Incompatible plan free Render, mais compatible avec VPS OVH existant |

---

## 4. Cas d'usage concrets identifiés dans PariScore

### Cas 1 — Étude Betfair WOM (CLAUDE.md L417, bd backlog) 🎯 PRIORITÉ HAUTE
**Aujourd'hui :** étude de faisabilité bloquée (Turnstile + ToS sur betfair.com).
**Avec Firecrawl :** le mode stealth + extract structuré pourrait extraire les volumes BACK/LAY par joueur. **Mais** — Firecrawl respecte robots.txt et ToS, donc ne contournera pas un paywall explicite. À valider par un test ciblé sur 1 page.

### Cas 2 — Seeders historiques (10 fichiers `seed_historique_*.js`) 🎯 PRIORITÉ MOYENNE
Actuellement : parsing HTML fragile sur football-data.org, fbref, openfootball, wikidata. Firecrawl extract remplacerait ces parsers par des schémas déclaratifs. Gain : stabilité face aux changements DOM.

### Cas 3 — RSS News aggregation (server.js L321-339, 18 flux) 🎯 PRIORITÉ BASSE
Déjà fonctionnel via `fetch` sur flux RSS XML. Firecrawl n'apporterait rien ici (RSS = déjà structuré).

### Cas 4 — Sofascore Live Dashboard (render.yaml pserv) ❌ HORS SCOPE
Microservice Playwright pour données live temps réel. Latence Firecrawl (3-8s) incompatible avec le live in-play. **Garder Playwright.**

### Cas 5 — Cycling TDF 2026 (commit récent `cycling/`) ⚠️ À ÉVALUER
Plackett-Luce + 4000 sims. Si besoins de scraping données cyclisme (startlists, weather), Firecrawl extract serait pertinent.

---

## 5. ⚠️ Conflit critique avec l'architecture PariScore

Le `AGENTS.md` est explicite :

> **Zero-dependency Node.js backend.** No package.json — uses only Node.js native modules + `better-sqlite3` (C++ addon). DO NOT run `npm install` or add npm packages.

**Implication directe :**
- ❌ **NE PAS** `npm install firecrawl` (le SDK JS officiel)
- ✅ **OK** d'appeler l'API REST via `https.request` natif Node.js — comme le fait déjà PariScore pour football-data, api-sports, thesportsdb, gnews, etc.

**C'est le même pattern que tous les services existants** (`services/betexplorerService.js`, `liquipediaService.js`, etc.) : HTTP natif, pas de SDK. Firecrawl s'intègre donc **parfaitement** dans le dogme, à condition de ne pas ajouter le package npm.

---

## 6. Recommandation finale

### ⚖️ Verdict : **Installation PARTIELLE — couche de fallback, pas source primaire**

| Décision | Raison |
|---|---|
| ❌ **NE PAS** self-host sur Render | Stack trop lourde (Redis+Chromium), incompatibilité plan free |
| ⚠️ **À ÉVALUER** self-host sur VPS OVH | Si quota cloud insuffisant, Docker sur VPS existant viable |
| ✅ **INSTALLER** le client cloud managé via `https` natif | Zéro dépendance npm, conforme au dogme, activation par feature flag |
| ✅ **Tester** sur 2 POCs ciblés avant généralisation | Étude Betfair + 1 seeder tennis |

### 🎯 Plan d'intégration proposé (si validation)

**Phase 0 — POC non-intrusif (1h)**
1. Ajouter `FIRECRAWL_API_KEY` au `.env` (déjà protégé par `.gitignore`)
2. Créer `services/firecrawlService.js` (client HTTP natif, mirroir des conventions existantes)
3. Ajouter au `.env.example` et `render.yaml` (env var `sync: false`)
4. **NE PAS toucher** aux 6 systèmes existants

**Phase 1 — POC Betfair WOM (CLAUDE.md L417)**
- Cible : 1 page `betfair.com/sport/tennis` match
- Mesurer : succès extraction BACK/LAY par joueur, latence, coût crédits
- Décision GO/NO-GO basée sur ToS + faisabilité technique

**Phase 2 — Généralisation conditionnelle**
- Si Phase 1 OK : migrer progressivement les seeders `tools/seed_historique_*.js` les plus fragiles
- Garder FlareSolverr/Apify/Playwright pour leurs cas respectifs (déjà payés/optimisés)

### 🚦 Gate de décision

**Ne PAS généraliser Firecrawl tant que :**
1. Le POC Betfair n'a pas démontré un gain net (vs FlareSolverr existant)
2. Le coût/mois projeté n'est pas chiffré vs budget Apify $15/mo
3. La latence n'est pas validée pour les batchs nocturnes (cron `cron_refresh_match_stats.js`)

---

## 7. Synthèse exécutive

| Dimension | Note | Commentaire |
|---|---|---|
| **Adéquation technique** | 7/10 | API REST = parfait pour le dogme zero-dep ; latence cloud exclut le live |
| **Valeur métier** | 6/10 | Extraction structurée = vrai gain sur Betfair + seeders ; mais 6 systèmes existants déjà fonctionnels |
| **Coût** | 5/10 | Credits limités ; à mettre en concurrence avec Apify déjà en place |
| **Risque licence** | 9/10 | Aucun en mode cloud managé (AGPL ne s'applique pas) |
| **Effort d'intégration** | 8/10 | Faible si on reste sur HTTP natif (1 service file, 1 env var) |
| **Score global** | **7/10** | Intégrer comme **outil de fallback ciblé**, pas comme refonte |

**Recommandation :** Installer le client cloud managé via `services/firecrawlService.js` (HTTP natif, zéro dépendance), activer uniquement via feature flag, et lancer le POC Betfair WOM avant toute généralisation. Le self-host est à réserver au VPS OVH si le quota cloud devient limitant — jamais sur Render.

---

*Sources : [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl), [firecrawl.dev/pricing](https://www.firecrawl.dev/pricing), [firecrawl.dev/docs](https://docs.firecrawl.dev). Analyse croisée avec `CLAUDE.md` L417-438 (étude Betfair), `render.yaml` (microservice Sofascore), `.env` (FlareSolverr + Apify), `tools/scrape-*.js` (13 scrapers existants).*
