---
name: firecrawl-pilote
description: |
  Pilot the Firecrawl structured web scraping service (services/firecrawlService.js) for PariScore.
  Use when: user asks to scrape a webpage, extract structured data from a URL, test Firecrawl,
  scrape Betfair WOM, scrape ATP/WTA rankings, scrape transfermarkt, or enrich PariScore data
  from any web source. Triggers on "firecrawl", "scrape", "extract from url", "extract data",
  "structured scraping", "firecrawl test", "firecrawl ping", "firecrawl poc".

  Don't use when: fetching from a known API endpoint (use the specific sport service instead),
  or handling live in-play data (latency too high — use Sofascore Playwright microservice).

  Requires: FIRECRAWL_API_KEY + FIRECRAWL_ENABLED=true in .env (disabled by default).
license: MIT
metadata:
  author: pariscore-cto
  version: "0.1.0"
---

# Firecrawl Pilot — PariScore Structured Scraping

Pilot `services/firecrawlService.js` to scrape, search, extract, or map web pages for PariScore data enrichment.

## Prerequisite

```bash
# Verify Firecrawl is configured
node -e "const fc=require('./services/firecrawlService'); console.log('enabled:', fc.enabled());"
```

If disabled, add to `.env`:
```
FIRECRAWL_API_KEY=fc-your-key-here
FIRECRAWL_ENABLED=true
```

## Commands

### 1. Ping (health check — 1 credit)
```bash
node -e "
const fc = require('./services/firecrawlService');
(async()=>{
  const r = await fc.ping();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
"
```

### 2. Scrape a single page → markdown
```bash
node tools/test-firecrawl.js scrape "https://example.com/page"
```

### 3. Extract structured data with JSON schema
```bash
node tools/test-firecrawl.js extract "https://www.atptour.com/en/rankings/singles" --schema '{"type":"object","properties":{"players":{"type":"array","items":{"type":"object","properties":{"rank":{"type":"number"},"name":{"type":"string"},"points":{"type":"number"}}}}}'
```

### 4. Search + scrape top results
```bash
node tools/test-firecrawl.js search "ATP rankings 2026 singles"
```

### 5. Map all URLs on a domain
```bash
node tools/test-firecrawl.js map "https://www.atptour.com"
```

## Decision Tree

```
What do you need?
│
├── Single page content (markdown)
│   └── scrape(url, { formats: ['markdown'], onlyMainContent: true })
│
├── Structured data extraction (JSON schema)
│   └── extract(urls, schema, { prompt: '...' })
│   └── Best for: rankings, player data, match fixtures, odds tables
│
├── Discover URLs on a site
│   └── mapSite(url)
│
├── Search + scrape results
│   └── search(query)
│
└── Verify API connectivity
    └── ping()
```

## PariScore Use Cases

### POC Betfair WOM (CLAUDE.md L417)
```js
const fc = require('./services/firecrawlService');
const schema = {
  type: 'object',
  properties: {
    players: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          backVolume: { type: 'number' },
          layVolume: { type: 'number' },
          backOdds: { type: 'number' },
          layOdds: { type: 'number' }
        }
      }
    }
  }
};
// Target: betfair.com/sport/tennis/<match-id>
const data = await fc.extract(['https://www.betfair.com/sport/tennis'], schema,
  { prompt: 'Extract BACK and LAY volumes per player for current tennis match' });
```

### Seeders historiques (tools/seed_historique_*.js)
Replace fragile HTML parsers with declarative JSON schemas:
```js
const data = await fc.extract(['https://fbref.com/en/comps/...'], fbrefSchema,
  { prompt: 'Extract player stats table: name, goals, assists, minutes' });
```

## Constraints

- **Zero npm dependencies** — uses Node.js native `https.request` only
- **Feature-flagged** — disabled by default (`FIRECRAWL_ENABLED=false`)
- **No live/in-play** — latency 3-8s too high (use Sofascore Playwright instead)
- **Credit-aware** — ~1 credit/scrape, ~5 credits/extract; monitor at firecrawl.dev/app
- **ToS compliant** — respects robots.txt; do NOT use for paywall bypass

## Reference Files

- `services/firecrawlService.js` — service module (JS natif, zero-dep)
- `tools/test-firecrawl.js` — CLI test/POC runner
- `.context/FIRECRAWL-ANALYSIS-2026.md` — full cost/benefit analysis
- `.env` — FIRECRAWL_API_KEY + FIRECRAWL_ENABLED
- `render.yaml` — FIRECRAWL_* env vars for Render.com
