---
name: skills-websearch-documentation
description: Catalogue des meilleurs skills Web Search, Scraping et Documentation pour Opencode. Routage automatique vers le bon skill selon l'intention. Use when: user asks about web search, scraping, documentation, API docs, recherche web, collecte données, or documentation technique.
---

# Skills Web Search & Documentation

## Web Search / Scraping — Hiérarchie de sélection

| Intention | Skill | Pourquoi |
|-----------|-------|----------|
| **Orchestrateur général** | `metier-recherche-web` | Route vers firecrawl, sports-news, playwright selon le besoin |
| **Scraping structuré (API)** | `firecrawl-pilote` | Betfair, ATP, transfermarkt — Firecrawl avec extraction JSON |
| **Anti-bot / Camoufox** | `scrapling` | Cloudflare, Datadome, JS lourd — 3 modes (statique/dynamique/stealth) |
| **Crawl massif** | `scrapy` | Sites entiers, pagination, pipelines, autothrottle |
| **Recherche approfondie** | `deep-research` | Multi-source, citations, firecrawl + exa MCP |
| **News sportives** | `sports-news` | RSS / Google News |
| **Page simple → Markdown** | `defuddle` | Extraction clean, pas de navigation |
| **Métadonnées / rate-limit** | `web-data-metadata-expert` | Exa API, Bing, contournement 429 |

## Documentation — Hiérarchie de sélection

| Intention | Skill | Pourquoi |
|-----------|-------|----------|
| **Orchestrateur général** | `metier-documentaliste` | Route vers API docs, schema extraction, comparatif providers |
| **Génération doc API** | `api-documentation` | Postman sync, endpoint contracts |
| **ADRs & décisions** | `aos-documentation-and-adrs` | Architecture Decision Records |
| **Docs framework à jour** | `documentation-lookup` | Context7 MCP — React, Next.js, Prisma, Zod |
| **Walkthroughs code** | `code-tour` | Fichiers `.tour` avec ancres fichier:ligne |
| **Comparatif providers** | `metier-documentaliste` (sous-routage) | API comparison, schema extraction |

## Routage automatique

```yaml
rules:
  - intent: "scraper une URL spécifique"
    skill: firecrawl-pilote
  - intent: "contourner un anti-bot / Cloudflare"
    skill: scrapling
  - intent: "crawler tout un site"
    skill: scrapy
  - intent: "recherche multi-source avec citations"
    skill: deep-research
  - intent: "actualités / news sportives"
    skill: sports-news
  - intent: "extraire le contenu texte d'une page"
    skill: defuddle
  - intent: "générer ou synchroniser une doc API"
    skill: api-documentation
  - intent: "documenter une décision d'architecture"
    skill: aos-documentation-and-adrs
  - intent: "chercher la doc à jour d'un framework"
    skill: documentation-lookup
  - intent: "créer un walkthrough du codebase"
    skill: code-tour
  - intent: "recherche web / scraping (non spécifique)"
    skill: metier-recherche-web
  - intent: "documentation technique (non spécifique)"
    skill: metier-documentaliste
```

## Vérification

Pour lister tous les skills installés :
```bash
ls .opencode/skills/ | grep -E "metier-|firecrawl|scrapling|scrapy|deep-research|sports-news|defuddle|api-documentation|aos-documentation|documentation-lookup|code-tour"
```

Pour synchroniser l'allowlist après modification :
```bash
node scripts/sync-skills.js
```
