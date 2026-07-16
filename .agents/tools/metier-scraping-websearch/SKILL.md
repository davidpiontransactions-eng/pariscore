---
name: metier-scraping-websearch
description: |
  🕸️ Orchestrateur Scraping & WebSearch LÉGITIME pour PariScore.
  Workflow automatisé de collecte de données externes (APIs publiques, RSS, scraping respectant robots.txt, WebSearch).
  Route vers firecrawl, WebSearch, MCP servers (sportdbdev, sportradar, bzzoiro-sports), playwright.
  Use when: user asks to scrape a source, research a topic, enrich PariScore data from the web, monitor a site,
  automate data collection, build a data pipeline. Triggers on "scraping", "websearch", "collecte données",
  "automatisation scraping", "pipeline data", "enrichir depuis le web", "monitoring source".
---

# 🕸️ Métier — Scraping & WebSearch Légitime

> **Rôle** : Collecter, structurer et enrichir les données PariScore depuis des sources externes **légitimes** (APIs publiques, RSS, scraping respectant `robots.txt` et ToS, WebSearch).

## ⚖️ Garde-fous LÉGAUX (OBLIGATOIRES)

Avant TOUTE collecte, vérifier :

1. **`robots.txt`** — la cible autorise-t-elle le chemin visé ? (`https://target.com/robots.txt`)
2. **ToS (Terms of Service)** — la cible autorise-t-elle l'accès automatisé ? Si ToS interdit → ❌ ABANDONNER.
3. **Données sous licence** — les données sont-elles propriétaires/licenciées (ex: ATP/WTA officielles via Sportradar/TDI) ? Si oui → ❌ ABANDONNER, orienter vers API officielle.
4. **Protection anti-bot** — Cloudflare Turnstile / reCAPTCHA / WAF présent ? Si oui → ❌ NE PAS contourner (evasion de mesure de sécurité).
5. **Cadre commercial** — PariScore monétise. L'usage de données non autorisées dans un produit payant = risque juridique asymétrique.

**Règle d'or** : Si tu doutes de la légalité → DEMANDE à l'utilisateur de confirmer l'autorisation. En cas de blocage → propose alternative légale (API officielle payante, source publique, RSS).

## Outils disponibles

### WebSearch (natif ZCode)
- `WebSearch(query)` — moteur de recherche US-only. Pour : veille, news, comparatifs API, recherche de sources.
- **Use case** : trouver une API officielle, vérifier la légalité d'une source, rechercher un comparatif.

### MCP Servers (déjà configurés dans `.mcp.json`)
| Serveur | Type | Données | Légal |
|---------|------|---------|-------|
| `bzzoiro-sports` | HTTP API | BSD Sports Addon (live scores, stats tennis/foot) — **déjà intégré PariScore** | ✅ clé API |
| `sportdbdotdev` | HTTP API | SportDB (résultats, classements multi-sports) | ✅ clé API |
| `sportradar` | RapidAPI | Sportradar API (scores, stats) | ✅ clé RapidAPI |
| `playwright` | npx MCP | Automatisation navigateur — extraction DOM | ⚠️ vérifier ToS cible |
| `memory` | npx MCP | Knowledge Graph persistant (mémoire entre sessions) | ✅ |
| `git` | uvx MCP | Opérations git structurées | ✅ |
| `project_fs` | npx MCP | Lecture/écriture fichiers projet | ✅ |

### Skills complémentaires (invocables)
| Skill | Rôle |
|-------|------|
| `/firecrawl-pilote` | Scraping structuré via Firecrawl (services/firecrawlService.js). Requiert `FIRECRAWL_API_KEY`. |
| `/sports-news` | News RSS/Atom + Google News pour football, transfers. |
| `/playwright-mcp` | Scraping fallback navigateur (extraction DOM directe). |
| `/metier-recherche-web` | Routeur simple vers les skills de collecte. |

## Workflow d'automatisation

### Phase 1 — ÉVALUATION LÉGALE (toujours en premier)
```
1. Identifier la cible (URL, API, source)
2. Vérifier robots.txt : curl -s https://cible.com/robots.txt
3. Vérifier ToS : WebSearch("cible.com terms of service scraping")
4. Vérifier licence données : WebSearch("cible.com data license provider")
5. Vérifier protection anti-bot : curl -sI https://cible.com/api → header Cloudflare/reCAPTCHA ?
6. VERDICT : ✅ LÉGITIME (proceed) / ⚠️ CONDITIONNEL (demander confirmation) / ❌ BLOQUÉ (proposer alternative)
```

### Phase 2 — CHOIX DE L'OUTIL
| Source | Outil |
|--------|-------|
| API publique (REST/JSON) | `curl`/`httpsGet` natif ou MCP HTTP |
| RSS/Atom feed | `curl` + parsing XML |
| HTML statique (robots OK) | `/firecrawl-pilote` ou `curl` + regex |
| HTML dynamique (SPA) | `/playwright-mcp` (render JS) |
| Recherche d'info | `WebSearch(query)` |
| Source multi-sports | MCP `sportdbdotdev` / `sportradar` / `bzzoiro-sports` |

### Phase 3 — COLLECTE & STRUCTURATION
```
1. Fetch via outil choisi
2. Parser (JSON natif / regex HTML / XML)
3. Normaliser vers le schéma PariScore (cf. tennis-live.js shapes)
4. Cache en mémoire (Map, TTL) ou DB (SQLite)
5. Hook dans pollTennisLive / cron / on-demand
```

### Phase 4 — INTÉGRATION PariScore
- **Service dédié** : `services/<source>Service.js` (mirror `betexplorerService.js` structure)
- **Feature flag** : `process.env.<SOURCE>_ENABLED` (default false)
- **Require défensif** : `let svc = null; try { svc = require('./services/...'); } catch(_) {}`
- **Hook poll/cron** : gated by flag + try/catch + fallback données précédentes

## Templates réutilisables

### Template service scraper (zero-dep)
Voir `services/betexplorerService.js` (référence) et `services/tnnsLiveScraper.js` (scaffold complet avec retry/backoff/UA rotation).

### Template WebSearch research
```
WebSearch("site:developer.sportradar.com tennis API pricing")
→ extraire prix, endpoints, limites
→ résumer dans un comparatif
```

### Template robots.txt check
```
curl -s https://target.com/robots.txt | grep -i "disallow: /api"
→ si Disallow /api/ → ❌ bloqué
→ si Allow / ou pas de règle → ✅ OK (vérifier ToS quand même)
```

## Cas d'usage PariScore fréquents

| Besoin | Source légitime | Outil |
|--------|----------------|-------|
| News blessures football | RSS Rotowire, physioroom | `/sports-news` + WebSearch |
| Classements ATP/WTA | SportDB MCP / sportradar MCP | MCP direct |
| Stats live tennis | BSD (bzzoiro MCP), aiscore PBP (déjà intégré) | httpsGet natif |
| Weather match | OpenWeatherMap API (publique) | WebSearch + curl |
| Cotes bookmakers | Odds API (déjà intégré) | httpsGet natif |
| Transferts | Transfermarkt (firecrawl si ToS OK) | `/firecrawl-pilote` |
| Étude API payante | WebSearch + doc officielle | WebSearch |

## Anti-patterns (À ÉVITER)

❌ Contourner Cloudflare/reCAPTCHA (evasion mesure de sécurité)
❌ Scraper des données sous licence sans autorisation (ATP/WTA officielles)
❌ Ignorer robots.txt
❌ Crawler sans rate-limit (DoS involontaire)
❌ Scrapper une SPA sans vérifier que les données ne sont pas derrière auth

## Mémoire inter-sessions

Stocker les sources validées dans le Knowledge Graph MCP `memory` :
- Entité `pariscore-data-sources` avec observations (URL, légal, qualité, latence)
- Relation `source → data-type` (ex: "BSD → tennis-live-stats")
- Permet de restaurer le contexte entre sessions sans re-vérifier la légalité

---

*Skill métier PariScore — automatisation scraping & websearch légitime.*
