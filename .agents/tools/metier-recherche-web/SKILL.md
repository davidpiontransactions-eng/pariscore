---
name: metier-recherche-web
description: "🔍 Orchestrateur Recherche Web / Scraping / Context — route vers les skills de collecte de données externes et extraction DOM. Disponible : /firecrawl-pilote, /sports-news, /playwright-mcp."
---

# 🔍 Métier — Recherche Web / Scraping / Context

> **Rôle** : Collecter, structurer et enrichir les données depuis des sources externes (web, APIs, scraping).

## Skills disponibles

| # | Skill | Nom d'appel | Fonction |
|---|-------|------------|----------|
| 1 | Firecrawl Pilote | `/firecrawl-pilote` | Scraping web structuré — Betfair WOM, ATP/WTA rankings, Transfermarkt, toute source web |
| 2 | Sports News | `/sports-news` | News RSS/Atom + Google News pour football, transfers, match reports |
| 3 | Playwright MCP | `/playwright-mcp` | Scraping fallback navigateur — extraction DOM directe si APIs down (Flashscore, SofaScore, ATP) |

## Quand utiliser ce métier

- Scraper une nouvelle source de données → `/firecrawl-pilote`
- Récupérer les dernières news sportives → `/sports-news`
- Scraping fallback navigateur / extraction DOM brute → `/playwright-mcp`
