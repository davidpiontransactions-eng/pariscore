# PariScore — Schéma routing global (v10.7, mai 2026)

> Carte exhaustive des routes HTTP, cron jobs, SSE, sources externes, et flow Live Dashboard V2.

---

## 1. NAVIGATION FRONTEND (12 pages SPA)

```
Header nav (pariscore.html:4350)
  ├─ Accueil          → #page-accueil (hero, stats, CTA matchs)
  ├─ Hot Picks        → #page-hot-picks (top edge bets du jour)
  ├─ Matchs           → #page-matchs (tableau central, filtres, modale Live V2)
  ├─ Sure Bets        → #page-sure-bets (arbitrage opportunities)
  ├─ Comparateur      → #page-comparateur (cotes par bookmaker)
  ├─ Top Stratégies   → #page-strategies (Poisson/Edge/AI Scout cards)
  ├─ Prédictions IA   → #page-predictions (Gemini deep analysis)
  ├─ Historique       → #page-historique (backtest accuracy + P&L)
  ├─ Tendances        → #page-tendances (BTTS, Over 2.5, séries)
  ├─ Alertes          → #page-alertes (config Telegram)
  ├─ Tarifs           → #page-tarifs (free / pro / annual)
  ├─ Guide            → #page-guide (doc utilisateur)
  └─ Paramètres       → #page-parametres (theme, langue, scroll lock)
```

---

## 2. BACKEND ROUTES (server.js, ~75 routes)

### 2.1 Data — Matches & stats
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/matches` | GET | 7716 | Tous matchs fusionnés (filtres ?league, ?day, ?live=true) |
| `/api/v1/match-details` | GET | 7807 | Détail d'un match précis |
| `/api/v1/leagues` | GET | 7823 | Liste 75 ligues configurées |
| `/api/v1/stats/:id` | GET | 7842 | Stats équipe historiques |
| `/api/v1/deep-stats/:id` | GET | 7854 | Full hydratation (ratings + Poisson + Squad) |
| `/api/v1/team-logo` | GET | 8168 | Proxy logos équipes |
| `/api/v1/team/:id` | GET | 8282 | Détail équipe |
| `/api/v1/player` | GET | 8241 | Détail joueur |
| `/api/v1/top-butteurs/:leagueId` | GET | 9165 | Top scorers ligue |

### 2.2 Live tracking
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/live` | GET (SSE) | 7690 | EventStream live (heartbeat 30s, broadcast `live_patch` + `matches_update`) |
| `/api/v1/live/bsd` | GET | 8461 | Liste matchs live (BSD enrichi) avec `?fresh=true` → force pollLiveScores |
| `/api/v1/live/predictions` | GET | 8507 | Top 5 paris live ajustés |
| `/api/v1/live-players/:id` | GET | 8421 | Top 3 joueurs live ratings |
| **`/api/v1/live-dashboard/:matchId`** | GET | **8433** | **Modal V2 — BSD detail + Sofa enrichment (Phase 1)** |

### 2.3 AI / Insights
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/insights/:id` | GET | 9216 | Insights complet (xG, forme, météo, blessures) |
| `/api/v1/quick-scout/:id` | GET | 10123 | Quick-Scout AI rapide |
| `/api/v1/deep-analysis-stream/:id` | GET (SSE) | 10151 | PowerScore stream Markdown |
| `/api/v1/deep-analysis/:id` | GET | 10294 | PowerScore one-shot |
| `/api/v1/predictions` | GET | 8698 | Prédictions IA |
| `/api/v1/gemini` | POST | 10429 | Proxy Gemini sécurisé |
| `/api/v1/gemini/test` | GET | 9623 | Test connectivité Gemini |
| `/api/v1/ai-scout` | GET | 9587 | Top 5 value bets analysés Gemini |
| `/api/v1/ai-quota` | GET | 10092 | Quota Gemini restant utilisateur |

### 2.4 Stratégies & odds
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/strategies` | GET | 8744 | Liste stratégies dispo |
| `/api/v1/top-strategy` | GET | 8723 | Top stratégie du jour |
| `/api/v1/top-matches` | GET | 8703 | Top matchs du jour |
| `/api/v1/hot-picks` | GET | 8756 | Hot picks edge max |
| `/api/v1/sure-bets` | GET | 8766 | Arbitrage opportunities |
| `/api/v1/arbitrage` | GET | 8778 | Calculateur arbitrage |
| `/api/v1/trends` | GET | 8789 | Tendances BTTS/Over |
| `/api/v1/history` | GET | 8795 | Archives matchs |
| `/api/v1/accuracy` | GET | 9108 | Précision Over25/BTTS/Edge |
| `/api/v1/accuracy/trends` | GET | 9149 | Évolution accuracy temps |
| `/api/v1/accuracy/public` | GET | 9155 | Stats publiques landing |
| `/api/v1/acca` | GET | 9659 | Combinés (parlay) |
| `/api/v1/odds/:id` | GET | 9847 | Cotes détaillées match |
| `/api/v1/bankroll` | GET | 9115 | Kelly criterion bankroll |

### 2.5 Auth & monétisation
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/auth/login` | POST | 8567 | Connexion JWT |
| `/api/v1/auth/register` | POST | 8595 | Inscription |
| `/api/v1/auth/me` | GET | 8623 | Profil utilisateur courant |
| `/api/v1/checkout/matchday` | POST | 8635 | Stripe checkout Matchday Pass €1,50 |
| `/api/v1/webhook/stripe` | POST | 8659 | Webhook Stripe (signature verify) |
| `/api/v1/matchday/status` | GET | 8687 | Statut pass utilisateur |

### 2.6 Alertes & Telegram
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/alerts/config` | GET/POST | 8806/8816 | Config alertes utilisateur |
| `/api/v1/alerts/history` | GET | 8839 | Historique alertes |
| `/api/v1/telegram/test` | POST | 8847 | Test envoi message Telegram |

### 2.7 Affiliates
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/affiliates` | GET/POST | 8990/8996 | CRUD codes affiliés |
| `/api/v1/affiliate/click` | POST | 9049 | Track click |
| `/api/v1/affiliate/stats` | GET | 9066 | Stats affiliés |
| `/api/v1/affiliate/link/:code` | GET | 9080 | Resolve affiliate link |

### 2.8 Admin
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/admin/status` | GET | 8857 | Dashboard admin KPIs |
| `/api/v1/admin/backtest-bsd` | POST | 8884 | Lance backtest BSD |
| `/api/v1/admin/change-password` | POST | 8969 | Changer mot de passe admin |

### 2.9 Cache & ops
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/status` | GET | 8350 | Health check serveur (uptime, quota) |
| `/api/v1/cache-status` | GET | 8559 | État caches mémoire/SQLite |
| `/api/v1/guide` | GET | 8368 | Markdown guide utilisateur |
| `/api/v1/refresh` | POST | 10491 | Force fetchOdds + fetchStats |
| `/api/v1/rebuild` | POST | 10469 | Rebuild complet DB |
| `/api/v1/force-refresh/:id` | POST | 9484 | Force refresh 1 match |
| `/api/v1/force-hydrate/:id` | POST | 9536 | Force re-hydratation 1 match |
| `/api/v1/click` | POST | 8313 | Track click bookmaker |
| `/api/v1/test/enable-mock` | GET | 8391 | Active mock match dev |
| `/api/v1/test/disable-mock` | GET | 8408 | Désactive mock match |

### 2.10 Press / TV
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/tv-channels` | GET | 8512 | Chaînes TV par date |
| `/api/v1/press-conferences` | GET | 8518 | Conférences presse |

### 2.11 RapidAPI bridges (legacy)
| Route | Méthode | Fichier:Ligne | Rôle |
|---|---|---|---|
| `/api/v1/rapidapi/parlay/test` | GET | 9595 | Test RapidAPI parlay |
| `/api/v1/rapidapi/gameforecast/test` | GET | 9603 | Test RapidAPI gameforecast |
| `/api/v1/rapidapi/dual-check` | GET | 9611 | Dual API check |

---

## 3. CRON & BACKGROUND PROCESSES

| Cron | Période | Fichier:Ligne | Rôle |
|---|---|---|---|
| `fetchOdds()` + `fetchStats()` | Boot + intervalles | server.js — bootInit | Hydratation initiale (Odds 12h / Stats 6h) |
| `archivePastMatches()` | 4h | 11069 | Déplace matchs terminés vers archives |
| `autoPurgeDatabase()` | 15 min | 11070 | Purge ghosts FT/AET/elapsed>120m |
| Cleanup SSE clients | (intra-loop) | 11072 | Ferme connexions SSE expirées |
| **`pollLiveScores()`** | **60 s** | **11077** | **BSD live + Sofa enrichment (Phase 1)** |
| `checkLineups()` | 15 min | 11255 | Compositions équipes |
| `checkPressConferenceVideos()` | 30 min | 11258 | Vidéos conf presse |
| Mock match updater | 10 s | 1115 | Dev only — simule match live |

---

## 4. SSE CHANNELS

| Channel | Émetteur | Payload | Consommateur frontend |
|---|---|---|---|
| `live_patch` | pollLiveScores (60s) | `{patches: [{id, live_score, live_minute, live_intensity, live_xg, live_possession, ...}]}` | Tableau matchs — patch diff in-place |
| `matches_update` | fetchOdds + fetchStats | `{matches: [...]}` | Reload complet tableau |
| `heartbeat` | toutes 30s | `: keepalive` | Maintien connexion |

---

## 5. SOURCES EXTERNES (data flow)

```
                    ┌──────────────────────────────────────┐
                    │     server.js (Node, port 3000)       │
                    └────┬──────────┬──────────┬───────────┘
                         │          │          │
        ┌────────────────┘          │          └────────────────┐
        ▼                           ▼                           ▼
┌──────────────┐          ┌────────────────┐          ┌──────────────────┐
│ The Odds API │          │ API-Football    │          │ BSD/Bzzoiro      │
│ Free 500/mo  │          │ Free 100/jour   │          │ Token + sr_stats │
│ 40 bookies   │          │ Standings 6h    │          │ 28 ligues live   │
└──────────────┘          └────────────────┘          └──────────────────┘
                                                                 │
                                                                 ▼
                                                       ┌──────────────────┐
                                                       │ Gemini 1.5 Flash │
                                                       │ Proxy /gemini    │
                                                       └──────────────────┘
                                                                 │
                                                                 ▼
                                                       ┌──────────────────┐
                                                       │ Stripe API       │
                                                       │ Matchday €1,50   │
                                                       └──────────────────┘

Phase 1 ajout (commit 179bc40) :
                    ┌──────────────────────────────────────┐
                    │     server.js                         │
                    └────┬──────────────────────────────────┘
                         │ fetchSofaMicroserviceEnrichment
                         ▼ Promise.all timeout 5s
              ┌─────────────────────────────────┐
              │ pariscore-sofa (Python pserv)   │
              │ 127.0.0.1:8765 (local)          │
              │ http://pariscore-sofa:8765      │ (Render Phase 2)
              │ ─ /find-match (resolve sofa_id) │
              │ ─ /match/:id/stats              │
              │ ─ /match/:id/momentum           │
              │ ─ /match/:id/shotmap            │
              │ ─ /match/:id/incidents          │
              └────┬────────────────────────────┘
                   ▼
            ┌──────────────────┐
            │ api.sofascore.com │
            │ Cloudflare 403    │
            │ bypassed via :    │
            │ - Playwright      │
            │ - tls_requests    │
            │ - botasaurus      │
            └──────────────────┘
```

---

## 6. LIVE DASHBOARD V2 — Fallback chain `/api/v1/live-dashboard/:matchId`

```
                    Frontend openLiveDetail(matchId)
                              │
                              ▼
                  GET /api/v1/live-dashboard/:matchId
                              │
        ┌─────────────────────┴────────────────────┐
        ▼ Promise.all                              ▼ Promise.all
┌────────────────────┐                  ┌──────────────────────┐
│ fetchBSDEventDetail │                  │ fetchSofaMicroserviceEnrichment │
│ - bsdFetch /events/{id}/ │            │ - resolveSofaEventId (cache 24h)  │
│ - sr_stats (possession,   │            │ - GET /find-match → sofa_event_id │
│   attack, dangerous_attack,│            │ - GET /match/:sid/stats           │
│   ball_safe_pct)           │            │ - GET /match/:sid/momentum        │
│ - actual_home_xg/away_xg   │            │ - GET /match/:sid/shotmap         │
│ - Cache 25s               │            │ - Parse %strings → numbers        │
└────────────────────┘                  └──────────────────────┘
        │                                          │
        └────────────────────┬─────────────────────┘
                             ▼
                  buildLiveDashboardPayload(match, detail)
                  + Sofa override (if sofa data present)
                             │
                             ▼
                  Payload DTO :
                  {
                    home_team, away_team, league, score, minute,
                    intensity,
                    possession {home, away},
                    shots {home, away},
                    shots_on_target {home, away},
                    corners {home, away},
                    xg {home, away},
                    momentum [{min, v}, ...],
                    shotmap [{minute, player, xg, xgot, x, y}, ...],
                    _source: 'bsd_sr_stats' | 'bsd_sr_stats+sofa'
                  }
                             │
                             ▼
                    Frontend updateLiveDetailModal
                    - setText pour valeurs scalaires
                    - style.width % pour barres (transition .4s)
                    - drawLDMomentumSVG (line + rects)
                    - rows display:none si source null
```

---

## 7. POLLING & CACHES (TTL)

| Cache | TTL | Localisation | Notes |
|---|---|---|---|
| ODDS_CACHE | 30 min | server.js:986 | Cotes par bookmaker |
| API_CACHE_TTL | 12 h | server.js:1251 | API responses SQLite |
| BSD_EVENT_DETAIL | 25 s | server.js (Phase 1) | Live dashboard absorb 30s polling |
| SOFA_LIVE_STATS | 60 s | server.js — legacy | Sofascore direct (403 → unused) |
| `_sofaEventIdMapping` | 24 h | server.js (Phase 1) | bsd_XXX → sofa_event_id |
| Sofa microservice in-memory | 30 s | sofa-microservice.py | live/find-match/stats/momentum/shotmap |
| Frontend polling modal | 30 s | pariscore.html | setInterval refreshLiveDetailModal |

---

## 8. SÉCURITÉ — Middleware chain

```
request → CORS allow ALLOWED_ORIGIN
        → static file guard (block .env, database.json, history.json, .git)
        → path traversal protection (path.resolve startsWith __dirname)
        → JSON body limit 1 Mo (readBodyLimited)
        → JWT verify (route-specific via verifyJwt)
        → admin password check (route-specific)
        → route handler
        → response
```

---

## 9. PROCHAINES ROUTES PLANIFIÉES (Phase 2+)

À implémenter selon roadmap CLAUDE.md :

- [ ] `/api/v1/sources/health` → check chaque provider + latence + quota (Routing report)
- [ ] `/api/v1/understat/match/:id` → xG post-match (rapport Understat scraper)
- [ ] `/api/v1/understat/forecast?league=X` → forecast 1X2 Understat
- [ ] `/api/v1/metrics` (Prometheus) → live_dispatch_total, latency_ms, degraded_ratio
- [ ] `/api/v1/affiliate/links` → CRUD complet liens
- [ ] `/api/v1/users/me/preferences` → préférences UI

---

## 10. RÉFÉRENCES

- Code : [server.js](../server.js), [pariscore.html](../pariscore.html), [scripts/sofa-microservice.py](../scripts/sofa-microservice.py)
- Configs : [render.yaml](../render.yaml), [bsd_config.json](../bsd_config.json), [leagues_config.json](../leagues_config.json)
- Études liées : [API-STUDY-FOOTBALL-2026.md](API-STUDY-FOOTBALL-2026.md), [ROUTING-LIVE-COVERAGE-2026.md](ROUTING-LIVE-COVERAGE-2026.md), [SOFASCORE-WRAPPERS-ANALYSIS-2026.md](SOFASCORE-WRAPPERS-ANALYSIS-2026.md), [DEPLOY-SOFA-MICROSERVICE.md](DEPLOY-SOFA-MICROSERVICE.md)
- Commits clés : `d971c6b` (Live filter restore), `f06072e` (BSD sr_stats route), `179bc40` (Sofa Phase 1 wire), `a14f7aa` (Phase 2 deploy)

*Document : `.context/ROUTING-SCHEMA-2026.md` — PariScore v10.7 — 12 mai 2026.*
