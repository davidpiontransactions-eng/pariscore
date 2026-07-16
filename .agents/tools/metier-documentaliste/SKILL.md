---
name: metier-documentaliste
description: |
  📚 Orchestrateur Documentation & Recherche API pour PariScore.
  Automatise la création de documentation technique (API docs, schema extraction, comparatifs providers),
  la recherche d'API/SDK, et la capitalisation knowledge base.
  Use when: user asks to document an API, compare providers, research a library/API, extract schema,
  generate API reference, build a knowledge base, create integration guide. Triggers on "documenter",
  "documentation", "comparatif API", "recherche provider", "API doc", "schema extraction", "intégration guide".
---

# 📚 Métier — Documentaliste API & Recherche Web

> **Rôle** : Documenter, comparer, rechercher et capitaliser sur les APIs/librairies/sources de données pour PariScore.

## Workflow d'automatisation

### Phase 1 — RECHERCHE (WebSearch + MCP)
```
1. WebSearch("provider.com API documentation endpoints fields pricing")
2. mcp__web_reader__webReader(url="https://docs.provider.com/") → markdown complet
3. Extraire: endpoints, auth, response schema, pricing, rate limits, coverage
4. Si image/screenshot → mcp__4_5v_mcp__analyze_image
```

### Phase 2 — DOCUMENTATION (.md)
```
Structure type:
# Provider API — Documentation
## 1. Vue d'ensemble (provider, sport, formats, prix)
## 2. Architecture d'accès (REST/WS/Webhook, auth)
## 3. Endpoints (chemin, méthode, params, response shape)
## 4. Champs — mapping complet (champ provider → champ PariScore)
## 5. Comparaison vs sources existantes PariScore (BSD, ESPN, aiscore)
## 6. Plan d'intégration (phases, feature flags, effort)
```

### Phase 3 — CAPITALISATION (Knowledge Graph MCP memory)
```
1. create_entities([{name:"provider-api", entityType:"api-source", observations:[...]}])
2. create_relations([{from:"provider-api", to:"pariscore-tennis-live", type:"candidate-for"}])
3. Permet restauration contexte entre sessions sans re-rechercher
```

### Phase 4 — INTÉGRATION (si GO)
```
1. services/providerService.js (mirror betexplorerService.js)
2. Feature flag process.env.PROVIDER_ENABLED (default false)
3. Hook pollTennisLive / cron / on-demand
4. Doc livrée dans DOCS_PROVIDER.md à la racine
```

## Outils disponibles

### Recherche
| Outil | Usage |
|-------|-------|
| `WebSearch(query)` | Recherche web US, titres + URLs |
| `mcp__web_reader__webReader(url)` | Fetch URL → markdown propre |
| `mcp__4_5v_mcp__analyze_image(url)` | Analyse screenshots/doc images |

### MCP Servers (data sources à documenter)
| MCP | Données |
|-----|---------|
| `bzzoiro-sports` | BSD Sports (déjà intégré) |
| `sportdbdotdev` | SportDB |
| `sportradar` | Sportradar (RapidAPI) |

### Génération doc
| Outil | Usage |
|-------|-------|
| `project_fs` (MCP) | Écriture fichiers doc |
| `memory` (MCP) | Knowledge Graph persistant |
| `git` (MCP) | Versioning doc |
| gstack `/document-release` | MAJ docs après ship |

### Skills complémentaires
| Skill | Rôle |
|-------|------|
| `/metier-scraping-websearch` | Scraping légitime (robots.txt) |
| `/metier-recherche-web` | Routeur collecte web |
| `/firecrawl-pilote` | Scraping structuré Firecrawl |
| `/playwright-mcp` | Scraping navigateur fallback |
| `/sports-news` | News RSS |

## Templates

### Template doc API provider
Voir `DOCS_GOALSERVE_TENNIS_API.md` (référence complète, 6 sections).

### Template comparatif providers
```markdown
| Critère | Provider A | Provider B | Provider C |
|---------|-----------|-----------|-----------|
| Point-by-point | ❌ | ✅ | ✅ |
| WebSocket | ❌ | ✅ | ✅ |
| Prix | $5/mois | $150/mois | $$$ |
| Latence | 30-60s | <2s | <1s |
```

### Template knowledge entity
```
create_entities([{
  name: "goalserve-tennis-api",
  entityType: "api-source",
  observations: [
    "Prix $150/mois, PBP live via WebSocket",
    "Champ state_info contient serve/return/break points temps réel",
    "DR dérivable directement (total_pts p1/p2)",
    "Mapping vers _bsd_stats documenté dans DOCS_GOALSERVE_TENNIS_API.md",
    "Alternative BSD pour temps réel <2s"
  ]
}])
```

## Cas d'usage PariScore

| Besoin | Action |
|--------|--------|
| Documenter une nouvelle API | Phase 1-2 complet |
| Comparer 3 providers tennis | WebSearch + tableau comparatif |
| Capitaliser une recherche | Phase 3 (memory MCP) |
| Préparer intégration | Phase 4 (service + feature flag) |
| MAJ doc après ship | gstack `/document-release` |
| Extraire schéma DB PariScore | `project_fs` + `sqlite3 .schema` |

## Anti-patterns
❌ Documenter sans vérifier la source primaire (toujours WebSearch + webReader)
❌ Oublier le mapping PariScore (la doc sans mapping = inutile)
❅ Ne pas capitaliser dans memory (perte contexte inter-session)

---
*Skill métier PariScore — documentaliste API & recherche web automatisée.*
