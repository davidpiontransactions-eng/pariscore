# ROUTING LIVE COVERAGE 2026 — PariScore Multi-Provider Strategy

> **Mission** : Couvrir ~75 ligues en LIVE (possession, tirs, SOT, corners, xG, momentum, incidents) avec une stratégie de double routage et fallback gracieux.
> **Date** : 12 mai 2026
> **Auteur** : Quant / CTO Layer
> **Statut actuel PariScore** : BSD seul (sr_stats partiel) + tentatives Sofascore (403) + API-Football Free (100 req/jour, statistics bloqué) + Understat post-match.

---

## 0. SYNTHÈSE PROVIDER (état des lieux 2026)

| Provider | Auth | Anti-bot | Coverage | LIVE stats | Coût | Verdict PariScore |
|---|---|---|---|---|---|---|
| **BSD (Bzzoiro proxy, Sportradar feed)** | Token interne | OK (proxy) | ~28 ligues actuelles avec `sr_stats` | Possession partielle, attack/dangerous_attack, ball_safe_pct. **Pas de SOT, pas de xG, pas de momentum graph** | Inclus actuel | Backbone score/incidents seulement |
| **API-Football PRO (api-sports.io)** | Header `x-apisports-key` | Aucun (REST clean) | 1200+ ligues | `fixtures/statistics` LIVE complet sur top-tier UE + MLS + J1/K1 + Liga MX + Brasileirao + Saudi Pro + AFC. xG natif sur ~25 top ligues. | **$29/mois Pro 75k req/jour** | **PRIMARY t1 & t2** |
| **Sportmonks** | Token | Aucun | 2500+ ligues, Pro plan = 120 ligues choisies | xG live add-on, possession/shots/corners/cards/dangerous_attacks minute-par-minute, momentum natif sur top-tier | **€89/mois Growth 30 leagues, €149/mois Pro 120 leagues** + xG add-on | **PRIMARY xG premium** (CL/EL/PL/Liga/Bundes) |
| **FotMob (unofficial API)** | Header signature `x-mas`/`x-fm-req` (rotates) | Modéré — Cloudflare leger, header obligatoire | 500+ ligues incl. women's | xG live + shotmap + momentum graph + stats détaillées | **Gratuit** (risque ToS + break) | **FALLBACK xG / momentum** quand API-Football n'a pas xG |
| **Sofascore (via Playwright wrapper)** | Headless Chromium | Cloudflare strict (403 direct) | 800+ ligues | Possession/shots/SOT/corners/xG/shotmap/momentum, identique BSD mais plus complet | Coût compute headless | **FALLBACK robust** pour ligues exotiques + momentum |
| **Sportradar / Goalserve** | Token | Aucun | 400+ ligues (Goalserve), 2000+ (Sportradar) | Goalserve : possession/shots/corners. Sportradar : tout, mais B2B contrat | Goalserve ~$200/mois flat. Sportradar contrat enterprise. | **Pas rentable** pour PariScore solo |
| **FlashScore (scraping)** | Aucun | Modéré | 100+ ligues | HTML scraping fragile, incidents oui, stats oui mais pas xG | Gratuit (compute) | **FALLBACK score-only** ligues T3 |
| **Understat** | HTML scrape | Aucun | 6 ligues seulement (PL, Liga, Bundes, Serie A, L1, RPL) | xG **post-match** uniquement | Gratuit | **Post-match historique seulement** |
| **LSports / SportsDataIO** | Contrat B2B | Aucun | Massif | Premium | $$$ enterprise | Hors budget |

---

## OUTPUT 1 — LIVE COVERAGE MATRIX

**Légende** :
- Y = couvert et fiable en LIVE
- P = partiel (couvert mais valeur incomplète/instable)
- N = non couvert ou indisponible
- Colonnes LIVE depth jugée VIA LE PROVIDER PRIMARY de la ligne.

### TIER 1 EUROPE (27 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| Ligue 1 | France | T1 | API-Football PRO | Sportmonks | Y | Y | Y | Y | Y | Y |
| Premier League | England | T1 | Sportmonks (xG premium) | API-Football PRO | Y | Y | Y | Y | Y | Y |
| La Liga | Spain | T1 | Sportmonks | API-Football PRO | Y | Y | Y | Y | Y | Y |
| Bundesliga | Germany | T1 | Sportmonks | API-Football PRO | Y | Y | Y | Y | Y | Y |
| Serie A | Italy | T1 | Sportmonks | API-Football PRO | Y | Y | Y | Y | Y | Y |
| Eredivisie | Netherlands | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | Y | P |
| Primeira Liga | Portugal | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | Y | P |
| Super Lig | Turkey | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | P | N |
| Jupiler Pro League | Belgium | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | Y | P |
| Scottish Premiership | Scotland | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | P |
| Super League | Greece | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | N | N |
| Super League | Switzerland | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | P | N |
| Allsvenskan | Sweden | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Ekstraklasa | Poland | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Liga 1 (Superliga) | Romania | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | N | N |
| OTP Bank Liga (NB I) | Hungary | T1 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Fortuna Liga | Slovakia | T1 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| Veikkausliiga | Finland | T1 | API-Football PRO | FlashScore | P | Y | P | Y | N | N |
| Premier Division | Ireland | T1 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| Bundesliga | Austria | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Czech First League | Czechia | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Superliga | Denmark | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Premier League | Ukraine | T1 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| Eliteserien | Norway | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Prva HNL | Croatia | T1 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| SuperLiga | Serbia | T1 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Parva Liga | Bulgaria | T1 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |

### TIER 2 EUROPE (17 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| Ligue 2 | France | T2 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Championship | England | T2 | API-Football PRO | FotMob | Y | Y | Y | Y | Y | P |
| Segunda División | Spain | T2 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| 2. Bundesliga | Germany | T2 | API-Football PRO | FotMob | Y | Y | Y | Y | Y | P |
| Serie B | Italy | T2 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |
| Liga Portugal 2 | Portugal | T2 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Challenger Pro League | Belgium | T2 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| Scottish Championship | Scotland | T2 | API-Football PRO | FlashScore | P | P | P | P | N | N |
| Super League 2 | Greece | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| Challenge League | Switzerland | T2 | API-Football PRO | FlashScore | P | Y | P | Y | N | N |
| Superettan | Sweden | T2 | API-Football PRO | FlashScore | P | Y | P | Y | N | N |
| I Liga | Poland | T2 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Liga 2 | Romania | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| NB II | Hungary | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| 2. Liga | Slovakia | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| Ykkönen | Finland | T2 | API-Football PRO | FlashScore | N | P | N | P | N | N |
| First Division | Ireland | T2 | FlashScore | BSD score-only | N | N | N | N | N | N |

### AMERICAS T1 (8 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| Liga MX | Mexico | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | Y | P |
| Brasileirão | Brazil | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | Y | P |
| Liga Profesional | Argentina | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | P | N |
| Campeonato Nacional | Chile | T1 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Liga BetPlay | Colombia | T1 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| LigaPro | Ecuador | T1 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| División Profesional | Paraguay | T1 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| MLS | USA/Canada | T1 | API-Football PRO | FotMob | Y | Y | Y | Y | Y | Y |

### AMERICAS T2 (8 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| Liga MX Expansión | Mexico | T2 | API-Football PRO | FlashScore | P | Y | P | Y | N | N |
| Brazilian Serie B | Brazil | T2 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Primera Nacional | Argentina | T2 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| Primera B | Chile | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| Primera B | Colombia | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| Serie B | Ecuador | T2 | API-Football PRO | FlashScore | P | P | N | P | N | N |
| Segunda División | Paraguay | T2 | FlashScore | BSD score-only | N | N | N | N | N | N |
| USL Championship | USA | T2 | API-Football PRO | FotMob | Y | Y | Y | Y | P | N |

### ASIA / MIDDLE EAST / AFRICA T1 (6 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| Saudi Pro League | Saudi Arabia | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | Y | P |
| J1 League | Japan | T1 | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | Y | P |
| K-League 1 | South Korea | T1 | **Sofascore wrapper** | API-Football PRO → BSD | Y | Y | Y | Y | P | N |
| Chinese Super League | China | T1 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| Botola Pro | Morocco | T1 | API-Football PRO | Sofascore wrapper | P | Y | P | Y | N | N |
| Ligue Pro 1 | Algeria | T1 | API-Football PRO | FlashScore | P | P | N | P | N | N |

### ASIA T2 (3 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| Saudi First Division | Saudi Arabia | T2 | API-Football PRO | FlashScore | P | Y | P | Y | N | N |
| J2 League | Japan | T2 | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| K-League 2 | South Korea | T2 | Sofascore wrapper | API-Football PRO | P | Y | P | Y | N | N |

### INTERNATIONAL (6 ligues)

| League | Country | Tier | Primary | Fallback | Possession | Shots | SOT | Corners | xG | Momentum |
|---|---|---|---|---|---|---|---|---|---|---|
| UEFA Champions League | UEFA | INT | Sportmonks (xG) | API-Football PRO | Y | Y | Y | Y | Y | Y |
| UEFA Europa League | UEFA | INT | Sportmonks (xG) | API-Football PRO | Y | Y | Y | Y | Y | Y |
| UEFA Conference League | UEFA | INT | API-Football PRO | Sportmonks | Y | Y | Y | Y | Y | P |
| Copa Libertadores | CONMEBOL | INT | API-Football PRO | Sofascore wrapper | Y | Y | Y | Y | P | P |
| Copa Sudamericana | CONMEBOL | INT | API-Football PRO | Sofascore wrapper | Y | Y | P | Y | N | N |
| CAF Champions League | CAF | INT | API-Football PRO | FlashScore | P | Y | P | Y | N | N |

---

## OUTPUT 2 — ROUTING STRATEGY

### 2.1 Per-tier rules

**TIER 1 EUROPE + INTL + TOP AMERICAS/ASIA (~40 ligues)** :
- **Primary** : Sportmonks (CL/EL/PL/Liga/Bundes/Serie A/Brasileirão/MLS — pour xG live premium et momentum natif)
- **Fallback** : API-Football PRO (toujours, sécurité)
- **Refresh** : 60s polling adaptatif. 30s en fin de match (>75').
- **Cache TTL** : 45s pour stats live, 0s pour score, 60s pour xG.

**TIER 2 + LIGUES MOYENNES (~25 ligues)** :
- **Primary** : API-Football PRO
- **Fallback** : FotMob (gratuit, xG quand dispo) ou Sofascore wrapper
- **Refresh** : 90s polling
- **Cache TTL** : 90s stats, 0s score

**LIGUES EXOTIQUES SANS xG (~10 ligues : Paraguay, Ecuador T2, K2, Algeria, Ireland, etc.)** :
- **Primary** : API-Football PRO ou BSD score-only
- **Fallback** : FlashScore scraping
- **Refresh** : 120s
- **Cache TTL** : 120s
- **Degrade** : si stats vide → afficher seulement score + incidents BSD.

### 2.2 Decision tree

```
INCOMING : GET /api/v1/live-dashboard/:matchId
  │
  ├── 1. resolveLeague(matchId) → { leagueId, country, tier, isXgLeague }
  │
  ├── 2. pickPrimary(league)
  │       ├── if isXgLeague (top 6 + CL/EL + MLS + Brasileirao) → Sportmonks
  │       ├── elif country in {Korea, K-League 1/2}            → Sofascore wrapper
  │       └── else                                              → API-Football PRO
  │
  ├── 3. fetchPrimary() with 6s timeout
  │       ├── 200 OK + payload non-vide → return DTO normalisé
  │       ├── 4xx/5xx/timeout/empty     → fallback step 4
  │       └── ratelimit (429)            → fallback step 4 + alerte SSE
  │
  ├── 4. fetchFallback() with 6s timeout
  │       ├── Same routing table column "Fallback"
  │       ├── OK → return DTO + flag source="fallback"
  │       └── KO → step 5
  │
  ├── 5. fetchDegraded() → BSD (sr_stats partiel) + score-only
  │       └── return DTO avec champs N/A explicites, flag source="degraded"
  │
  └── 6. Toujours retourner JSON valide. JAMAIS 500. Le frontend dégrade l'UI.
```

### 2.3 Caching strategy (par route)

| Route | TTL | Stratégie | Justification |
|---|---|---|---|
| `/live-dashboard/:id` (live match) | 45s | In-memory Map, SWR | Polling 60s frontend → 75% hit rate |
| `/live-dashboard/:id` (mi-temps) | 5 min | TTL étendu | Aucune stat ne bouge |
| `/sources/health` | 60s | In-memory | Ping check expensive |
| `/leagues/coverage` | 24h | SQLite | Statique |
| `/match-incidents/:id` (BSD) | 30s | Conservé | Score-critical |
| `/team-xg-recent/:teamId` | 6h | SQLite | xG historique stable |

### 2.4 Concurrency safety (mutex pattern PariScore)

Cohérent avec `isFetchingOdds` / `isFetchingStats` déjà en place :

```js
const inflightLiveDashboard = new Map(); // matchId → Promise

async function getLiveDashboard(matchId) {
  if (inflightLiveDashboard.has(matchId)) {
    return inflightLiveDashboard.get(matchId); // dedup
  }
  const p = (async () => {
    try {
      return await dispatcherLive(matchId);
    } finally {
      // libération différée pour amortir les bursts
      setTimeout(() => inflightLiveDashboard.delete(matchId), 1000);
    }
  })();
  inflightLiveDashboard.set(matchId, p);
  return p;
}
```

Avantages :
- Dédup les hits concurrents (10 clients/match = 1 fetch upstream)
- Pas de race condition
- Pattern identique au reste du code

### 2.5 Cost estimate (mensuel, 75 ligues, ~250 matchs live/jour)

| Provider | Plan | Coût | Usage estimé | Notes |
|---|---|---|---|---|
| **API-Football** | PRO ($29/mo) | **$29** | ~5 000 req/jour avec cache 45s. Quota PRO 75k req/jour → 7% utilisé. | Backbone universel. |
| **Sportmonks** | Growth 30 leagues + xG add-on | **€89 + €30 add-on = €119** | Top 30 ligues xG live, ~50 matchs/jour | xG premium UEFA + top 6 + MLS + Brasileirao. **Optionnel mois 1** : démarrer sans → API-Football suffit. |
| **FotMob** | Gratuit (unofficial) | **$0** | Fallback xG ligues T2 | Risque ToS — usage modéré, header rotation |
| **Sofascore wrapper** | Self-hosted Playwright | **~$20** (1 worker headless Render) | Fallback ligues exotiques + K-League | Compute container 512MB dédié |
| **FlashScore scraping** | Gratuit | **$0** | Dernier recours T3 | Compute mutualisé avec scraper existant |
| **BSD (existant)** | Inclus | **$0** | Score + incidents universels + sr_stats 28 ligues | Backbone score uniquement |
| **TOTAL minimum (mois 1-3)** | | **~$49/mois** (API-Football + Sofascore worker) | | Pas de Sportmonks → on accepte xG médiocre sur top-tier |
| **TOTAL recommandé** | | **~$168/mois** | Avec Sportmonks Growth + xG | xG premium UEFA + top 5 |
| **TOTAL premium** | | **~$330/mois** | Sportmonks Pro 120 leagues + xG | Couverture pro complète |

**Recommandation budget v1.0** : démarrer à **$49/mois** (API-Football PRO + Sofascore Playwright worker). Ajouter Sportmonks au mois 4 quand le revenu Pro arrive.

---

## OUTPUT 3 — DOUBLE ROUTING DESIGN

### 3.1 Backend route pattern

```
GET /api/v1/live-dashboard/:matchId

Response shape (always 200, never 500):
{
  "matchId": "abc123",
  "source": "primary" | "fallback" | "degraded",
  "provider": "api-football" | "sportmonks" | "sofascore" | "fotmob" | "bsd",
  "fetchedAt": "2026-05-12T20:14:32Z",
  "ttl": 45,
  "league": { "id": 292, "name": "K-League 1", "country": "Korea", "tier": 1 },
  "score": { "home": 1, "away": 1, "minute": 73 },
  "stats": {
    "possession":      { "home": 54, "away": 46, "available": true },
    "shots":           { "home": 12, "away": 8,  "available": true },
    "shotsOnTarget":   { "home": 5,  "away": 3,  "available": true },
    "corners":         { "home": 6,  "away": 2,  "available": true },
    "dangerousAttacks":{ "home": 41, "away": 27, "available": true },
    "xg":              { "home": 1.42, "away": 0.89, "available": true, "source": "sportmonks" },
    "momentum":        { "series": [...60 points...], "available": true }
  },
  "incidents": [ /* normalisé depuis BSD */ ],
  "degraded": {
    "missing": ["xg", "momentum"],   // toujours présent, liste vide si tout OK
    "reason": "league_not_xg_covered"
  }
}
```

### 3.2 Internal dispatcher (pseudo-code)

```js
// server.js — section LIVE DISPATCHER
// =====================================================

const SPORTMONKS_XG_LEAGUES = new Set([
  39,   // Premier League
  140,  // La Liga
  78,   // Bundesliga
  135,  // Serie A
  61,   // Ligue 1
  2,    // Champions League
  3,    // Europa League
  253,  // MLS
  71,   // Brasileirão
]);

const SOFASCORE_PRIMARY_LEAGUES = new Set([
  292,  // K-League 1 (BSD partial only, AF spotty)
  293,  // K-League 2
]);

async function dispatcherLive(matchId) {
  const match = await db.getMatch(matchId);
  if (!match) return buildEmptyDTO(matchId, 'unknown_match');

  const leagueId = match.league.id;
  const country  = match.league.country;

  // 1. Pick primary
  let primary;
  if (SPORTMONKS_XG_LEAGUES.has(leagueId) && process.env.SPORTMONKS_KEY) {
    primary = 'sportmonks';
  } else if (SOFASCORE_PRIMARY_LEAGUES.has(leagueId)) {
    primary = 'sofascore';
  } else {
    primary = 'api-football';
  }

  // 2. Try primary
  try {
    const dto = await Promise.race([
      providerCall(primary, matchId),
      timeout(6000)
    ]);
    if (isValid(dto)) {
      return tag(dto, primary, 'primary');
    }
  } catch (e) {
    logProviderFailure(primary, matchId, e);
  }

  // 3. Try fallback
  const fallback = pickFallback(primary, leagueId, country);
  try {
    const dto = await Promise.race([
      providerCall(fallback, matchId),
      timeout(6000)
    ]);
    if (isValid(dto)) {
      return tag(dto, fallback, 'fallback');
    }
  } catch (e) {
    logProviderFailure(fallback, matchId, e);
  }

  // 4. Degraded — BSD score + sr_stats partial
  try {
    const bsdDto = await providerCall('bsd', matchId);
    return tag(bsdDto, 'bsd', 'degraded');
  } catch (e) {
    return buildEmptyDTO(matchId, 'all_providers_failed');
  }
}

function pickFallback(primary, leagueId, country) {
  if (primary === 'sportmonks') return 'api-football';
  if (primary === 'sofascore')  return 'api-football';
  // primary = api-football
  if (SPORTMONKS_XG_LEAGUES.has(leagueId)) return 'sportmonks';
  if (['Korea', 'Japan', 'China'].includes(country)) return 'sofascore';
  if (isUEFA(country)) return 'fotmob';
  return 'flashscore';
}

function isValid(dto) {
  return dto
    && dto.stats
    && (dto.stats.possession?.available || dto.stats.shots?.available);
}
```

### 3.3 Fallback chain example — K-League 1

```
Match : Ulsan Hyundai vs Jeonbuk Motors (K-League 1, ID league=292)
  │
  ├─ 1. dispatcherLive() → primary = "sofascore" (override map)
  │
  ├─ 2. providerCall("sofascore", matchId)
  │     → Playwright headless worker hit https://api.sofascore.com/api/v1/event/{id}/statistics
  │     → 200 OK with possession/shots/SOT/corners/xG
  │     → return tag(dto, "sofascore", "primary")  ✓
  │
  ├─ 2bis. Si Playwright worker DOWN ou Cloudflare challenge :
  │     → pickFallback("sofascore", 292, "Korea") = "api-football"
  │     → providerCall("api-football", matchId)
  │     → GET /fixtures/statistics?fixture={id} (header x-apisports-key)
  │     → 200 OK probable (K1 couvert) avec possession/shots/SOT/corners, xG=null
  │     → return tag(dto, "api-football", "fallback")
  │     → degraded.missing = ["xg"]
  │
  └─ 3. Si AF aussi KO :
        → providerCall("bsd", matchId)
        → sr_stats : possession + dangerous_attacks + ball_safe_pct
        → return tag(dto, "bsd", "degraded")
        → degraded.missing = ["xg", "shots", "shotsOnTarget", "corners", "momentum"]
        → Frontend affiche Live Tracker minimal (score + possession + intensity)
```

### 3.4 Health check endpoint

```
GET /api/v1/sources/health

Response :
{
  "timestamp": "2026-05-12T20:00:00Z",
  "providers": [
    {
      "name": "api-football",
      "status": "ok",
      "latency_ms": 184,
      "quota_remaining": 69_842,
      "quota_total":     75_000,
      "last_error": null
    },
    {
      "name": "sportmonks",
      "status": "ok",
      "latency_ms": 211,
      "quota_remaining": "n/a (rate-limited)",
      "last_error": null
    },
    {
      "name": "sofascore",
      "status": "degraded",
      "latency_ms": 4_200,
      "last_error": "Cloudflare challenge solved (Playwright 2x retry)",
      "worker_uptime_pct": 99.2
    },
    {
      "name": "fotmob",
      "status": "ok",
      "latency_ms": 320,
      "last_error": null,
      "headers_rotation": "x-mas v2.4 OK"
    },
    {
      "name": "bsd",
      "status": "ok",
      "latency_ms": 95,
      "sr_stats_leagues_count": 28
    },
    {
      "name": "flashscore",
      "status": "ok",
      "latency_ms": 540
    }
  ],
  "overall": "ok"
}
```

Implémentation :
- Ping `/status` ou endpoint ping de chaque provider, timeout 3s.
- Cache 60s en mémoire.
- Sert pour dashboard admin (admin.html) + alerte Telegram si `status !== ok` 3 minutes consécutives.

### 3.5 Telemetry / logging

**Structured logs JSON** (vers stdout, ingéré par Render logs ou Loki) :

```json
{ "ts":"2026-05-12T20:14:32Z", "level":"info",  "module":"live-dispatch",
  "matchId":"abc123", "league":292, "primary":"sofascore", "result":"primary",
  "latency_ms":312 }

{ "ts":"2026-05-12T20:14:33Z", "level":"warn",  "module":"live-dispatch",
  "matchId":"def456", "league":61, "primary":"api-football", "result":"fallback",
  "fallback":"fotmob", "error":"primary timeout 6s" }

{ "ts":"2026-05-12T20:14:34Z", "level":"error", "module":"live-dispatch",
  "matchId":"ghi789", "league":292, "result":"degraded",
  "missing":["xg","momentum","corners"], "providers_tried":["sofascore","api-football","bsd"] }
```

**Métriques agrégées** (Prometheus-style ou exposées via `/api/v1/metrics`) :
- `live_dispatch_total{provider,result}` (counter)
- `live_dispatch_latency_ms{provider}` (histogram p50/p95/p99)
- `live_dispatch_degraded_ratio` (gauge)
- `provider_quota_remaining{provider}` (gauge)

**Alertes** :
- SSE push frontend si `live_dispatch_degraded_ratio > 0.10` (10% des matchs en mode dégradé) sur 5 min.
- Telegram admin si `provider_quota_remaining{api-football} < 10000` (< ~13% restant) → indique fuite quota.

---

## ANNEXE — Mapping leagueId → routing (template SQL/JSON pour `live_routing_table`)

```sql
CREATE TABLE live_routing (
  league_id      INTEGER PRIMARY KEY,
  league_name    TEXT NOT NULL,
  country        TEXT NOT NULL,
  tier           INTEGER NOT NULL,         -- 1,2,3
  primary_src    TEXT NOT NULL,            -- 'api-football' | 'sportmonks' | 'sofascore'
  fallback_src   TEXT NOT NULL,
  xg_available   INTEGER NOT NULL,         -- 0/1
  momentum_avail INTEGER NOT NULL,         -- 0/1
  cache_ttl_sec  INTEGER NOT NULL DEFAULT 45,
  notes          TEXT
);
```

Cette table est seedée depuis OUTPUT 1 ci-dessus. Le dispatcher lit `live_routing` au démarrage et garde en RAM (`Map<leagueId, RoutingRule>`).

---

*Document v1.0 — 12 mai 2026. À relire trimestriellement (provider drift attendu : FotMob signature, Sofascore Cloudflare, quotas).*
