# Crawl4AI — Skill Web Scraping

Utilise [Crawl4AI](https://github.com/unclecode/crawl4ai) v0.9.1 pour scraper
des sites web sportifs avec rendu JavaScript et anti-détection.

## Installation

```bash
pip install -U crawl4ai
crawl4ai-setup          # Setup Chromium
python -m playwright install --with-deps chromium   # fallback si besoin
```

## Scripts disponibles

| Script | Usage |
|---|---|
| `scripts/crawl4ai-wrapper.py` | Scraper générique (URL → Markdown/JSON/HTML) |
| `scripts/crawl4ai-scrape-logos.py` | Scraper dédié logos équipes football |

## Utilisation

### Scraper une page quelconque

```bash
python scripts/crawl4ai-wrapper.py --url <URL> [--output json|markdown|html] [--stealth]
```

### Scraper les logos d'une équipe

```bash
python scripts/crawl4ai-scrape-logos.py --team "Paris Saint-Germain" --source sofascore [--save-db]
```

### Batch — tous les logos manquants

```bash
python scripts/crawl4ai-scrape-logos.py --batch-missing --limit 20
```

## Architecture

```
Crawl4AI (stealth Playwright)
    ↓
    Extraction logos/images (Sofascore, Flashscore, Wikipedia)
    ↓
Cheerio (Node.js) → Normalisation noms → team_logos DB (SQLite)
    ↓
    API /api/v1/team-logos (server.js:22899) → client HybridHero
```

## Sources supportées

| Source | URL | Type |
|---|---|---|
| Sofascore | `api.sofascore.app/api/v1/team/{id}/image` | API directe + scraping |
| Flashscore | `flashscore.com/team/...` | Scraping HTML |
| Wikipedia | `en.wikipedia.org/api/rest_v1/page/summary/...` | API REST |
| API-Football | `media.api-sports.io/football/teams/{id}.png` | CDN direct |
| BSD CDN | `sports.bzzoiro.com/img/team/{id}` | CDN interne |

## Anti-bot

- Stealth mode activé par défaut dans Crawl4AI
- Rate limiting : 1.5s entre requêtes
- User-Agent réaliste (Chrome 130+)
- Cache mémoire des URLs déjà scrapées (évite doublons)

## Alternatives / Compléments

| Outil | Cas d'usage |
|-------|------------|
| **WebClaw** (global skill) | Extraction locale ultrarapide, 67% tokens en moins, MCP natif |
| **Extracto** (global skill) | Extraction structurée sans sélecteurs CSS, LLM-driven |
| **Wikipedia API** | Fallback fiable pour logos d'équipes (cf. `scripts/populate_team_logos.py`) |
