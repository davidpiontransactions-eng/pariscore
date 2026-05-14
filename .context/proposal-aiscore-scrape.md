# AiScore — Scraping Proposal pour Onglet Tennis PariScore

> Document : analyse + proposition (verdict)  
> Source : https://www.aiscore.com/  
> Date : 2026-05-15  
> Auteur : Agent (PariScore v10.10+)  
> Statut : **NOT RECOMMENDED** — site hostile au scraping par design.

---

## 1. Résumé exécutif

AiScore.com offre des données tennis détaillées (live scores, predictions, H2H, odds) mais **rend l'extraction automatique techniquement coûteuse et légalement risquée** :

1. robots.txt restrictive sur 30+ paths (toutes pages avec préfixe langue/année)
2. Listing pages = Nuxt.js SSR avec skeleton placeholders → data hydrate uniquement côté client
3. API privée `api.aiscore.com` retourne 403 sur tous les paths sondés (auth requise)
4. 4 bots concurrence explicitement bloqués (AhrefsBot, SemrushBot, MJ12bot, DotBot)
5. Cloudflare en frontline + `cache-control: max-age=86400` agressif

**Verdict** : Skip aiscore.com. PariScore a déjà 5 sources tennis intégrées (Tennis Abstract, Tennis Explorer, MatchStat RapidAPI, Sackmann CSV, BSD) couvrant largement le scope. ROI scraping aiscore = négatif vs effort/risque.

---

## 2. Analyse technique détaillée

### 2.1 robots.txt

```
User-agent: *
Disallow: /user
Disallow: /match-*/*/standings$
Disallow: /20*
Disallow: /aa/20*  ... (30+ langues prefixed)

User-agent: AhrefsBot       → Disallow: /
User-agent: SemrushBot      → Disallow: /
User-agent: MJ12bot         → Disallow: /
User-agent: DotBot          → Disallow: /
User-agent: YandexBot       → Crawl-delay: 100
```

**Verdict robots.txt** : non-search-engine bots devraient s'auto-restreindre. Les match URLs `/tennis/match-<p1>-<p2>/<id>` ne tombent pas explicitement dans les patterns disallow, mais l'intention du site est claire.

### 2.2 Architecture frontend

- **Stack** : Nuxt.js SSR + Vue.js + Element UI
- **Données** : `window.__NUXT__` IIFE obfusqué avec variables substituées (a, b, c, ...) — décodage = exécuter le JS
- **Listing tennis** (`/tennis`) : skeleton placeholders, data hydratée par JS après load → **non-scrapable statiquement**
- **Match detail** (`/tennis/match-<p1>-<p2>/<id>`) : HTML rendu côté serveur, structure DOM extractable (scores, points, serve position)

### 2.3 API privée

- Host : `https://api.aiscore.com`
- Path patterns détectés dans bundles JS : `/sports/match/scores`, `/sports/match/odds`, `/prediction/`, `/h2h`, `/comparison/tennis/`
- **Tous les paths sondés retournent HTTP 403** sans auth
- Auth probable via headers signés ou session cookies (non documentée)

### 2.4 Sitemap

- `https://www.aiscore.com/sitemap/tennismatches.xml` (1.3 MB)
- Liste tous les match URLs publics — théoriquement utilisable pour ingest discovery
- Mais accès aux pages individuelles = scraping massif → risque ban Cloudflare

---

## 3. Données potentiellement utiles (si scrapables)

| Donnée | Source | État accès |
|--------|--------|-----------|
| Live scores point-par-point | Match detail page DOM | ✅ scrapable (1 match/page) |
| Score sets/games/points avec serve position | DOM classes `pointBox`, `scoreLeft`, `servePos` | ✅ scrapable |
| Predictions IA (probabilités) | Probable dans NUXT data | ⚠ obfusqué |
| Cotes 1xbet/Pinnacle/Bet365 | Probable dans `/match/odds` API | ❌ API 403 |
| H2H historique | Page H2H dédiée | ⚠ probable scrape mais auth |
| Player profiles | Pages player | ⚠ similaire match — probablement scrapable |

---

## 4. Options scraping (théoriques)

### Option A — Sitemap-driven match page scraping

```
1. Fetch tennismatches.xml hourly → liste match URLs
2. Filter par lastmod >= now - 24h → ~200-500 matchs/jour
3. Pour chaque match : scrape DOM → parse scoresBox/pointBox/servePos
4. Cache 5min par match (anti-poisoning)
```

**Pros** : data live points + serve position = unique vs autres sources  
**Cons** :
- 200-500 req/jour vers un site Cloudflare-protégé → risque ban IP
- Pas d'odds (API 403)
- Effort dev parser DOM Nuxt SSR ~6-8h
- Maintenance HTML structure change = haute (Nuxt rebuilds fréquents)

### Option B — Headless browser (Puppeteer/Playwright)

**Pros** : access à hydrated state, all data visible  
**Cons** :
- Brise principe PariScore "zero-dep" (Puppeteer = +200 MB Chromium)
- 10× plus lent que HTML scrape
- Cloudflare anti-bot avancé → besoin stealth plugins → mainteanance lourde
- Coût compute Render élevé

### Option C — API key officielle (commercial)

AiScore opère via [api.aiscore.com](https://api.aiscore.com) mais **n'expose pas de plan commercial public**. Contact direct nécessaire.

---

## 5. Comparaison ROI vs sources actuelles PariScore

| Source | Live points/serve | Odds bookmakers | Predictions IA | H2H | Player profile | Effort intég |
|--------|-------------------|-----------------|----------------|-----|----------------|--------------|
| **AiScore** | ✅ unique | ❌ (API 403) | ⚠ obfusqué | ⚠ | ⚠ | 6-8h + risque ban |
| **MatchStat (intégré)** | ❌ | ❌ | ❌ | ✅ | ✅ | déjà OK |
| **Tennis Abstract (v10.10)** | ❌ | ❌ | ✅ forecasts | ❌ | ✅ Elo + MCP | déjà OK |
| **Tennis Explorer (v10.9)** | ❌ | ✅ Δ% drift | ❌ | ⚠ via match-detail | ✅ rank+DOB | déjà OK |
| **Sackmann CSV (intégré)** | ❌ | ❌ | ❌ | ✅ via Elo | ❌ | déjà OK |
| **BSD Tennis (intégré)** | ✅ live score sets | ✅ multi-books | ✅ ML preds | ✅ | ⚠ | déjà OK |

**Conclusion** : la **seule** value-add aiscore vs intégrations actuelles serait le **point-par-point live + serve position**. Mais BSD couvre déjà live score sets, et le détail point-par-point a peu d'impact prédictif pour les paris (pas un signal exploitable à l'échelle).

---

## 6. Recommandation

**SKIP aiscore.com**.

Raisons :
1. Site hostile au scraping (robots.txt + Cloudflare + API auth)
2. Pas de value-add unique vs sources actuelles
3. Risque légal/éthique non négligeable (intention claire du site)
4. Coût d'opportunité : 6-8h dev mieux investies sur :
   - **Option α** : extension Tennis Explorer pour scraper `/match-detail/?id=N` → odds player 2 + multi-books (limite déjà identifiée v10.9)
   - **Option β** : intégration **WTAtour.com** ou **ATPtour.com** rankings officiels (data libre, plus stable)
   - **Option γ** : amélioration backtesting Sackmann (T9) avec Elo TA cross-validation

---

## 7. Si malgré tout l'intégration est demandée

Plan minimal Option A (sitemap-driven) :

| Phase | Tâche | Effort |
|-------|-------|--------|
| 1 | Fetch tennismatches.xml + parser (1.3MB XML) | 1h |
| 2 | Filter matchs récents + déduplication par match_id | 30min |
| 3 | Parser HTML match-detail (scoresBox/pointBox/servePos) | 3h |
| 4 | Cache 5min + rate limit 1 req/2s anti-CF-ban | 1h |
| 5 | Route `/api/v1/tennis/aiscore/match/:id` + frontend hook | 1.5h |
| 6 | Tests sur 10 matchs sample + monitoring 24h | 1h |
| **Total** | — | **8h** |

Coût additionnel récurrent : Cloudflare ban risk = potentiel block-out total nécessitant rotation proxy ou User-Agent cycling.

---

*Fin du document.*
