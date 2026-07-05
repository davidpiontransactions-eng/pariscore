# Task SEO-1 — SEO Optimization (full-stack-developer)

## Objective
Add SEO optimization to the Next.js 16 Tennis Prematch app at `/home/z/my-project`:
robots.txt, dynamic sitemap, JSON-LD structured data (WebApplication + SportsEvent),
OpenGraph/Twitter meta, canonical URL.

## Files touched
- **Created** `src/app/sitemap.ts` — Next.js App Router `MetadataRoute.Sitemap`,
  single `/` entry, lastModified=now, changeFrequency="hourly", priority=1.0,
  absolute URL via `process.env.NEXT_PUBLIC_SITE_URL` (fallback
  `https://setpoint.example`).
- **Rewrote** `public/robots.txt` — `User-agent: *`, Allow `/`, Disallow `/api/`,
  Disallow `/api/sentry-test`, Crawl-delay: 1, Sitemap: https://setpoint.example/sitemap.xml.
- **Modified** `src/app/layout.tsx`:
  - Added module-level `SITE_URL` (env with fallback, trailing-slash stripped).
  - Added `OG_LOCALE` map (fr→fr_FR, en→en_US).
  - Added `webAppJsonLd` constant (WebApplication schema, exact fields from task spec)
    rendered as `<script type="application/ld+json">` in `<head>`.
  - Enriched `generateMetadata`: `alternates.canonical`, `openGraph` (type, title,
    description, url, siteName, locale, images=[/icon-512.png 512×512]),
    `twitter` (card=summary_large_image, title, description, images=[/icon-512.png]).
- **Modified** `src/app/page.tsx`:
  - Imported `MATCHES` from `@/lib/tennis-data` (page is `"use client"` with no
    SSR fetch → static mock is the intended fallback per the task spec).
  - Added `buildSportsEventJsonLd(match)` helper (SportsEvent schema with name,
    sport="Tennis", startDate, location, homeTeam/awayTeam as SportsTeam + athlete).
  - Rendered one `<script type="application/ld+json">` per match in the JSX (3
    total: m1 sabalenka/osaka, m2 alcaraz/rublev, m3 sinner/medvedev). Server-rendered
    in initial HTML.
- **Modified** `.env.example` — added `NEXT_PUBLIC_SITE_URL=https://setpoint.example`
  with documentation comment.

## Verification results
- `bun run lint` → exit 0, 0 errors, 0 warnings.
- `curl -i http://localhost:3000/robots.txt` → 200, Content-Type: text/plain; charset=UTF-8.
- `curl -i http://localhost:3000/sitemap.xml` → 200, content-type: application/xml,
  valid `<urlset>` with single `<url>` for `https://setpoint.example/`, changefreq=hourly, priority=1.
- `curl http://localhost:3000/` view-source → 4 distinct `<script type="application/ld+json">`
  tags in DOM: 1× WebApplication + 3× SportsEvent. All valid JSON (parses with json.loads).
  (A 5th `application/ld+json` substring appears in the RSC streaming payload — expected
  Next.js behaviour, not a duplicate DOM node.)
- Single `<link rel="canonical" href="https://setpoint.example/">` (no duplicates).
- OG tags: og:type=website, og:title, og:description, og:url, og:site_name,
  og:locale=fr_FR (flips to en_US when NEXT_LOCALE cookie=en), og:image with width/height/alt.
- Twitter tags: twitter:card=summary_large_image, twitter:title, twitter:description, twitter:image.
- Dev log: clean, no compile errors, GET / 200 (~80-100ms warm), GET /robots.txt 200,
  GET /sitemap.xml 200.

## Notes / known limitations
- SportsEvent JSON-LD uses the static `MATCHES` mock (m1/m2/m3) rather than live
  SSR-fetched data, because page.tsx is `"use client"` and fetches via SWR client-side
  only. This is the explicit fallback called for in the task spec. A future refactor
  (split into a server component wrapper that fetches server-side) would make the
  structured data reflect live API match data. Out of scope for SEO-1.
- Placeholder domain `setpoint.example` used as the fallback. Once the real production
  domain is known, set `NEXT_PUBLIC_SITE_URL` in the deployment env and all
  canonical/OG/sitemap/JSON-LD URLs update automatically.
- No application features modified — only SEO/meta layer added. Single visible route
  `/` preserved (no new routes added).
- Dev server was already running on port 3000 — not started/stopped.
