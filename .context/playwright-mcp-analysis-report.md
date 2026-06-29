# Playwright MCP — Analyse & Installation PariScore

> **Date** : 2026-06-29
> **Source** : [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
> **Statut** : ✅ INSTALLÉ comme serveur MCP #7

## Résumé Exécutif

Playwright MCP est un serveur MCP officiel Microsoft qui expose les capacités d'automatisation navigateur de Playwright via le protocole MCP. Il permet aux LLMs de naviguer, cliquer, capturer des screenshots, exécuter du JS dans la page, et exporter des PDFs — le tout via des appels d'outils MCP standard.

**Verdict : AVANTAGEUX pour PariScore** — Installé comme 7ème serveur MCP dans `.mcp.json`.

## Architecture

```
Agent (ZCode/Claude/opencode)
    ↓ MCP protocol
@playwright/mcp (npx)
    ↓
Playwright Engine (Chromium / Firefox / WebKit)
    ↓
Page Web (localhost:3000, Flashscore, ATP, etc.)
```

## Avantages Identifiés pour PariScore

| # | Avantage | Métier Impacté | Détail |
|---|----------|----------------|--------|
| 1 | **E2E visuel post-déploiement** | Audit & QA | Naviguer pariscore.html, capturer screenshots chaque onglet, vérifier rendu |
| 2 | **Scraping fallback** | Recherche Web | Si API-football/Odds API down → naviguer directement Flashscore/SofaScore/ATP |
| 3 | **Extraction DOM brute** | Recherche Web | Parser des pages sans API (classements non couverts, stats brutes) |
| 4 | **Validation responsive** | Audit & QA | Simuler viewport mobile/desktop, vérifier media queries |
| 5 | **Debug visuel incidents** | Sécurité & SRE | Capturer screenshot d'un état buggé → joindre au post-mortem |
| 6 | **Tests navigateur pendant dev** | Ingénierie | Vérifier visuellement un changement CSS/JS sans quitter l'agent |
| 7 | **Export PDF rapports** | Chef de Projet | Générer des rapports automatiques depuis l'UI |

## Configuration Installée

`.mcp.json` — ajout serveur #7 :

```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

**Note** : Configuration minimale. Options avancées possibles :
- `--headless` (défaut) vs `--headed` (mode visible)
- `--browser chromium|firefox|webkit`
- `--viewport "1280,720"`

## Inventaire MCP PariScore — Avant/Après

### Avant (6 serveurs)

| # | Serveur | Technologie | Fonction |
|---|---------|-------------|----------|
| 1 | project_fs | npx filesystem | Navigation fichiers |
| 2 | memory | npx memory | Knowledge graph |
| 3 | git | uvx git | Opérations git |
| 4 | bzzoiro-sports | HTTP | Données sportives Bzzoiro |
| 5 | sportdbdotdev | HTTP | Données sportives SportDB |
| 6 | sportradar | npx mcp-remote | Sportradar |

### Après (7 serveurs)

| # | Serveur | Technologie | Fonction |
|---|---------|-------------|----------|
| 1 | project_fs | npx filesystem | Navigation fichiers |
| 2 | memory | npx memory | Knowledge graph |
| 3 | git | uvx git | Opérations git |
| 4 | bzzoiro-sports | HTTP | Données sportives Bzzoiro |
| 5 | sportdbdotdev | HTTP | Données sportives SportDB |
| 6 | sportradar | npx mcp-remote | Sportradar |
| **7** | **playwright** | **npx @playwright/mcp** | **Automatisation navigateur** |

## Métiers Mis à Jour

| Métier | Skills avant | Skills après | Changement |
|--------|-------------|-------------|------------|
| Audit & QA | 3 | 4 | +playwright-mcp (E2E visuel) |
| Recherche Web | 2 | 3 | +playwright-mcp (scraping fallback) |
| Sécurité & SRE | 3 | 4 | +playwright-mcp (debug visuel) |
| Ingénierie | 8 | 9 | +playwright-mcp (tests navigateur) |

## Limites & Risques

| Risque | Sévérité | Atténuation |
|--------|-----------|-------------|
| **Anti-bot** (Cloudflare, reCAPTCHA) | Moyen | Utiliser en fallback seulement, pas en source primaire |
| **Premier lancement lent** (~50MB) | Faible | Cache npm local après premier téléchargement |
| **Headless uniquement** | Faible | Pas d'UI visible — screenshots via `browser_screenshot` |
| **Network intercept** | Faible | Ne pas logger de tokens/sessions en clair |
| **Ressources navigateur** | Faible | Toujours `browser_close` après usage |

## Non-Pertinent pour PariScore

- **Upload de fichiers** — PariScore n'a pas d'upload
- **Multi-onglet complexe** — PariScore est SPA, pas besoin de multi-onglet
- **Geolocation/emulation** — Pas de feature géo-dépendante

## Comparaison avec Existant

| Capacité | Firecrawl (existant) | Playwright MCP (nouveau) |
|----------|---------------------|--------------------------|
| Scraping web | ✅ Structuré (API) | ✅ DOM brute (navigateur) |
| E2E testing | ❌ | ✅ Navigation + screenshots |
| Anti-bot bypass | ✅ Rotating proxies | ❌ Détecté par Cloudflare |
| Extraction données | ✅ Markdown clean | ✅ JS in-page + DOM |
| Coût | ✅ API gratuite (limitée) | ✅ Gratuit (local) |

**Conclusion** : Complémentaire à Firecrawl. Firecrawl pour le scraping structuré, Playwright pour l'E2E visuel et le fallback DOM.

## Fichiers Modifiés

| Fichier | Action |
|---------|--------|
| `.mcp.json` | Ajout serveur `playwright` |
| `.agents/skills/playwright-mcp/SKILL.md` | Nouveau — documentation skill |
| `.agents/skills/metier-audit-qa/SKILL.md` | +1 skill |
| `.agents/skills/metier-securite-sre/SKILL.md` | +1 skill |
| `.agents/skills/metier-ingenierie/SKILL.md` | +1 skill |
| `.agents/skills/metier-recherche-web/SKILL.md` | +1 skill |
| `.context/playwright-mcp-analysis-report.md` | Nouveau — ce rapport |
| `AGENTS.md` | MAJ table MCP (6→7 serveurs) |
| `.context/skills-registry.md` | Addendum VulnClaw + Playwright MCP |

## Recommandations

1. **Tester au prochain déploiement** : Lancer `browser_navigate` vers `localhost:3000` et capturer un screenshot de chaque onglet
2. **Créer un runbook E2E** : Séquence de navigations standard pour valider les 4 onglets (Football, Tennis, TennisScope, Admin)
3. **Monitoring premier lancement** : Vérifier que `npx @playwright/mcp@latest` se lance sans erreur dans l'environnement actuel
4. **Combiner avec Firecrawl** : Utiliser Playwright comme fallback si Firecrawl échoue sur une source
