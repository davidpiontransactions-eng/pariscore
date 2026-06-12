# BSD Replacement Analysis — World Cup 2026 Lineups

**Date:** June 12, 2026 (updated May 22, 2026 — final stack)
**Context:** Elimination of BSD (Bzzoiro Sports Data, $5/mo) routing for team lineups.
**Project:** PariScore — real-time sports betting analysis platform

---

## 1. Current State — What BSD Provided

| Endpoint | Usage | BSD Cache |
|---|---|---|
| GET /v2/events/{id}/lineups/ | Starting XI + bench + formation + unavailable | 30 min |
| GET /api/predicted-lineup/{eid}/ | AI predicted starters + injuries | 1 h |
| GET /player-stats/?event={id} | Player ai_points scores | 30 min |
| GET /players/?team={id} | Full roster + attributes | 24 h |

## 2. Solution Comparison — WC 2026 Lineups (final stack)

| Solution | Type | WC Cost | Reliability | Integration | Constraint |
|---|---|---|---|---|---|
| **football-data.org (free)** | API | **0 EUR** | ★★★ | Very Easy (already coded) | 10 req/min + FIFO rate-limiter |
| **Sofascore (direct)** | API | **0 EUR** | ★★★★★ | Very Easy (existing microservice) | None (no key, 100% WC) |
| football-data.org Tier One | API | 49 EUR/mo | ★★★★ | Very Easy (already coded) | 30 req/min |
| API-Football Pro | API | 19 USD/mo | ★★★★ | Easy (flip kill-switch) | 7 500 req/d |
| FIFA.com scraping | Scraping | 0 EUR | ★★★★★ | Medium (BS4) | NOT SELECTED (Sofascore sufficient) |
| Sofascore (Playwright) | Scraping | 0 EUR | ★★★ | High (headless) | NOT SELECTED (direct API works) |
| Sportmonks Growth | API | 149 EUR/mo | ★★★★ | Easy | Expensive |

## 3. Implemented Architecture (post-BSD)

```
Route : GET /api/v1/lineups/:matchId
         ↓
    L1: football-data.org (PRIMARY)
        - 12 competitions free forever including WC (FIFA World Cup)
        - FIFO rate-limiter: 10 req/min max
        - Cache: confirmed=24h / predicted=5min / neg=5min
        - Format: XI + bench + formation + coach
        - If empty → fallthrough L2
         ↓
    L2: Sofascore (FALLBACK, real WC source)
        - /event/{id}/lineups (no key, 100% coverage)
        - Enhanced findSofaEventId: 3 passes (direct ID → WC tournament → search teams)
        - Cache: confirmed=24h / predicted=2min / neg=5min
        - If empty → graceful 200 { lineups: null }
         ↓
    Frontend : loadLineups() in Insights modal (Compos tab)
        - Displays XI + bench + unavailable (same format as BSD)
        - Auto-polling 10min if lineup_status !== 'confirmed'
        - Graceful fallback if all sources empty
```

## 4. Cache Detail

| Cache | Key | Confirmed TTL | Predicted TTL | Neg TTL |
|---|---|---|---|---|
| FD lineups (route) | `fd_lineups_{matchId}` | 24h (86400000ms) | 5min (300000ms) | 5min |
| FD detail (general) | `fd_detail_{fdMatchId}` | 24h (bookings/refs/subs) | 24h | 1h |
| Sofa lineups (route) | `sofa_lineups_{sofaEventId}` | 24h via route | 2min (120000ms) | 2min |
| Sofa lineups (CRON) | direct call, no cache | — | — | — |

## 5. CRON Route — 45min pre-match check

`checkLineups()` → `fetchLineups()` executes the same cascade:
1. L1 football-data.org (via `fdRateLimit()`)
2. L2 Sofascore event
3. Fallback squad search by team name
4. Frequency: every 15min

## 6. Final Recommendation

Stack **0 € / month** operational:
- **PRIMARY**: football-data.org (free, 10 req/min, 12 leagues including WC)
- **FALLBACK**: Sofascore direct (free, no key, 100% WC coverage)
- **PLAN B**: football-data.org Tier One (49 €/month if 10 req/min insufficient)

**Rate-limit**: FIFO queue built-in — safe.
**TTL**: confirmed lineups = 24h (won't change). Predicted = 5min.
**Deps**: ZERO (Node native + existing Sofascore API).

---

*Document generated June 12, 2026 — PariScore (updated May 22, 2026)*
