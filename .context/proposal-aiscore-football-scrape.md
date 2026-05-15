# AiScore — Football Data Scraping (Update post-Skill `web-scraping`)

> Document : analyse extension + verdict révisé  
> Source : https://www.aiscore.com/  
> Date : 2026-05-15  
> Auteur : Agent (PariScore v10.11+) — using `web-scraping` skill cascade method  
> Statut : **PARTIELLEMENT FAISABLE** mais ROI faible — voir verdict §6

---

## 1. Contexte

User a demandé application du skill `web-scraping` installé pour cibler **football** sur aiscore.com après verdict initial SKIP. Le skill propose une méthodologie cascade : `requests` → `trafilatura` → Playwright stealth → undocumented API discovery via DevTools.

Cette analyse applique la cascade Node.js zero-dep pour confirmer/infirmer le verdict.

---

## 2. Cascade appliquée

### L0 — Session bootstrap + cookies

Résultat : `curl -c cookies.txt` → 0 cookie retourné par aiscore.com. Pas de session bootstrap classique. Cloudflare ne challenge pas immédiatement le User-Agent Chrome standard.

### L1 — Parse SSR HTML

URL pattern football : `/match-<team1>-<team2>/<id>` (ex : `/match-athletic-club-rc-celta/527r3i4vplob47e`).

Status 200, page 190KB rendue SSR. Mais **placeholders uniquement** dans le DOM — toutes les valeurs odds/scores/stats sont à `-` ou `0`. Données hydratées client-side post-load via JS.

### L1bis — Décodage NUXT IIFE

Le `window.__NUXT__` est un IIFE obfusqué (94KB code) avec variables substituées (a, b, c…). **Décodable** en `eval()` sandbox :

```js
const m = html.match(/window\.__NUXT__=(\(function[^<]*?\}\([^<]*?\)\));/);
const data = eval(m[1]);
// data.state.matchesFuture.matches[] — 20 matchs sidebar
// data.state.languageJsonMap.en — i18n
// data.state.matchesFuture.teams[] — 50 teams referenced
```

**Problème** : `matchesFuture` n'est PAS le match courant — c'est la liste des matchs à venir (sidebar widget). Le match displayed sur la page n'a pas son data dans state, il est fetché post-hydratation.

### L2 — Undocumented API discovery (skill méthodologie)

Le bundle Nuxt `25290c4.js` expose :
- `baseURL: https://api.aiscore.com`
- `withCredentials: true`
- `interceptors.request` **vide pass-through** (pas d'auth header injecté)

**Endpoints catalog extraits** (grep templates) :

| Resource | Endpoint | Param principal |
|----------|----------|-----------------|
| Match data | `/v1/web/api/match/data?match_id=&lang=` | match_id |
| Match odds detail | `/v1/web/api/match/odds/detail?match_id=` | match_id |
| Match odds list | `/v1/web/api/match/odds_list?match_id=` | match_id |
| Match stats | `/v1/web/api/match/stats?match_id=` | match_id |
| Match lineups | `/v1/web/api/match/lineups?match_id=` | match_id |
| Match incidents | `/v1/web/api/match/incidents?match_id=` | match_id |
| Match H2H | `/v1/web/api/match/h2h?sid=` | sid |
| Match history | `/v1/web/api/match/history?match_id=` | match_id |
| Match ball-by-ball | `/v1/web/api/match/ball_by_ball?match_id=` | match_id |
| Match live | `/v1/web/api/match/mlive?lang=` | lang |
| Football comp matches | `/v1/web/api/football/comp/matches?comp_id=` | comp_id |
| Football team matches | `/v1/web/api/football/team/matches?team_id=` | team_id |
| Football comp stats | `/v1/web/api/football/comp/stats?lang=` | lang |
| Football fifa ranking | `/v1/web/api/football/fifa/ranking?lang=` | lang |
| Football team transfers | `/v1/web/api/football/team/transfers?lang=` | lang |

### L2 verify — test endpoint réel

```
curl -A "Mozilla/5.0 ... Chrome/120" \
     -H "Origin: https://www.aiscore.com" \
     -H "Referer: https://www.aiscore.com/match-.../id" \
     -H "Accept: application/json" \
     "https://api.aiscore.com/v1/web/api/match/data?match_id=527r3i4vplob47e&lang=en"
→ status: 200 (size: 497 bytes)
```

**Browser-like headers passent le bot check** (vs 403 initial sans Referer/Origin).

### L3 — Inspection réponse

**Réponse = binary protobuf** (`application/octet-stream`) :

```
00000000: 7aee 030a 8e03 0a0f 3532 3772 3369 3476  z.......527r3i4v
00000010: 706c 6f62 3437 6510 0122 660a 0f79 7a72  plob47e.."f..yzr
00000020: 6b6e 3669 6f72 626a 716c 6534 1001 2a0f  kn6iorbjqle4..*.
00000030: 5370 616e 6973 6820 4c61 204c 6967 6142  Spanish La LigaB
```

Format : protobuf wire format (`0a` field tag length-delimited, varint length, then UTF-8 payload).

Contenu détecté (parsing manuel des strings UTF-8 lisibles) :
- match_id : `527r3i4vplob47e`
- comp_id : `yzrkn6iorbjqle4`
- comp_name : `Spanish La Liga`
- home_team : `Athletic Club`
- away_team : `RC Celta`
- venue : `San Mamés Stadium` `Bilbao` `Spain`
- weather : `15°C`
- 3D widget URL : `widgets.thesports01.com/en/3d/football?profile=74rekh26eseunr0&id=4358278`

---

## 3. Données disponibles (si décodage protobuf)

| Endpoint | Données utiles PariScore |
|----------|--------------------------|
| match/data | metadata match (teams, comp, venue, weather, kick-off time) |
| match/odds_list + odds/detail | **odds multi-bookmakers 1X2 / O-U / AH / CS** |
| match/stats | live possession, shots, attacks, corners |
| match/incidents | events (goals, cards, subs) |
| match/lineups | starting XI + bench |
| match/h2h | H2H historique |
| match/mlive | flux temps réel |
| football/comp/matches | fixtures par ligue |
| football/team/transfers | transfers récents |

---

## 4. Effort de décodage protobuf

Sans `.proto` schema fourni par aiscore, décodage requiert :

1. **Parser varint** Node.js zero-dep (~50 lignes)
2. **Walker protobuf wire format** générique :
   - Field tag = (field_number << 3) | wire_type
   - Wire type 0 (varint), 2 (length-delimited), 5 (fixed32)
3. **Field number mapping manuel** par endpoint (test+observation)
4. **Type interpretation** (string utf-8, nested message, int, float)

Estimation : **8-12h dev** pour décoder 4-5 endpoints clés (data, odds_list, stats, incidents).

Alternative : **bibliothèque `protobufjs`** — viole principe zero-dep PariScore (mais +200KB acceptable si data critique).

---

## 5. Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Cloudflare IP ban si scraping massif | Site bloque IP Render | Rate limit 1 req/3s + User-Agent rotation |
| Protobuf schema change | Decoder casse silencieusement | Tests fixtures + monitoring 200 OK + size > N |
| Match ID discovery massif | Besoin sitemap 15MB | Cron quotidien fetch sitemap + filter lastmod |
| TOS aiscore non-explicite | Risque juridique gray | Usage non-commercial OK, SaaS Pro = contact |
| robots.txt `Disallow /20*` | Page langues bloquées (non utilisé) | URL EN par défaut, OK |

---

## 6. Verdict révisé

### ✅ Faisabilité technique
- API accessible avec browser headers
- Catalog endpoints comprehensive (15+ /v1/web/api/...)
- Data complète disponible (odds multi-books, stats live, incidents)

### ⚠️ Effort prohibitif
- Protobuf decode 8-12h
- Maintenance schema = haute (rebuilds Nuxt = potentiel breaking)

### ❌ ROI vs sources actuelles

| Source PariScore (intégrée) | Couvre |
|-----------------------------|--------|
| BSD (server.js v10) | Fixtures + odds multi-books + ML preds + xG |
| Football-Data.org (L2 v10.7) | Fixtures + referees + lineups 12 ligues UE |
| The Odds API (L3) | Odds 20+ bookmakers (quota mensuel limité) |
| OpenFootball (L4) | Fixtures top 5 EU sans odds |
| Fallback Poisson local (Patch C v10.7) | Stats SQLite cache → Poisson local |

**aiscore.com football n'apporte rien que PariScore n'a déjà** :
- Odds → couvert L3 + BSD
- Fixtures → couvert L1+L2+L4
- Stats live → couvert BSD + API-Football PRO
- H2H → couvert BSD

### 🎯 Recommandation finale

**SKIP aiscore.com football**, malgré faisabilité technique. Effort 8-12h pour data déjà disponibilité via pipeline actuel = waste.

**Exception** : si BSD/Football-Data tombent en panne durable OU si user paye plan Pro nécessitant data live additionnelle, alors décodage protobuf justifié.

### Cas d'usage où aiscore EST utile

- **Sports NON couverts par BSD** : volleyball, handball, snooker, water polo, table tennis, badminton (aiscore catalog list)
- **Match 3D widget** (`widgets.thesports01.com/3d/...`) : feature visualisation unique pour Pro plan
- **mlive websocket** (port 8099) : live point-by-point ultra-low-latency

---

## 7. Si décodage souhaité — Plan minimal

```
Phase 1 (2h) — Node.js protobuf parser zero-dep
  parseVarint(buf, offset) → {value, nextOffset}
  parseField(buf, offset) → {tag, wireType, value, nextOffset}
  walkMessage(buf) → tree of {fieldN: value | nested}

Phase 2 (3h) — Endpoint /match/data field mapping
  Capture 5 sample matches binary
  Manual decode → field 1 = match_id, field 2 = competition, etc
  Build TypeScript interface or JSDoc schema

Phase 3 (3h) — Endpoints /odds_list, /stats, /incidents
  Same manual decode per endpoint
  Build adapter to PariScore Match model

Phase 4 (2h) — Cache + cron + routes
  fetchAiscoreFootballMatch(matchId) → 5min cache
  Route /api/v1/football/aiscore/:matchId
  Sitemap-driven match ID discovery hourly

Phase 5 (1h) — Frontend integration (optional)
  Button "AiScore data" on match cards → modal
```

**Total : 11h** (vs 8-12h estimation initiale, en ligne).

---

*Fin du document.*
