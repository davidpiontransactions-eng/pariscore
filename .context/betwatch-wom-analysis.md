# betwatch.fr — Betfair Weight-of-Money source analysis (bd 17y6)

Date: 2026-06-08. Verified live via gstack browse (CF-cleared headed session).

## What it is
betwatch.fr republishes **Betfair Exchange money matched ("Moneyway")** + dropping
odds + suspicious bets, football. FR-reachable (NOT geo-blocked like betfair.com).
Commercial product: Stripe subscriptions + official **API Access add-on**.

## Endpoints (internal JSON API, same-origin)
- `GET https://betwatch.fr/football/getMain?live_only=false&prematch_only=false&finished_only=false&favorite_only=false&utc=2&step=1&date=YYYY-MM-DD&order_by_time=false&not_countries=&not_leagues=`
  → fixtures + 1X2 odds. `i` = `[[selection, current_odds, opening_odds], ...]`
- `GET https://betwatch.fr/football/getMoney?...same params...`
  → **MONEYWAY (WOM)**. One (hottest) market per match.

## getMoney schema (per match in `data[]`)
| key | meaning |
|---|---|
| `m` | "Home - Away" |
| `ce` | commence time ISO UTC |
| `li`/`ln` | league id / name |
| `l` | live flag (1=live) |
| `n` | market name ("Match Odds", "Over/Under X.5 Goals", "Both teams to Score?") |
| `e` | **Betfair event id** |
| `iid` | internal id |
| `v` | € matched on THIS market |
| `vm` | € matched on the WHOLE event (liquidity weight) |
| `i` | `[[selection_label, MONEY_MATCHED, current_odds, opening_odds], ...]` |
| `ht/at/htn/atn` | team ids + names |

selection_label: Match Odds → `1`/`X`/`2`; O/U → `Over`/`Under`; BTTS → `Yes`/`No`.

## WOM extraction
```
WOM_pct(selection) = money_matched(selection) / Σ money_matched(all selections) * 100
```
Verified — France vs Northern Ireland (Match Odds, v=€29 480):
`1`=27410 (93.0%) · `X`=1554 (5.3%) · `2`=516 (1.8%).

Movement (dropping odds) = sign(opening_odds − current_odds): current<opening = shortening.

## Blockers
1. **Cloudflare** (Turnstile managed challenge) on every request. Headless gets 403
   "Just a moment". Passed only after a headed `connect` warmup → cf_clearance cookie.
   Server-side Node scraper from OVH VPS will be 403'd. Needs: headless-stealth browser
   OR a persisted cf_clearance cookie (IP+UA bound, expires) OR the official API.
2. **TOS / legal** — moneyway is betwatch's PAID product (they sell API access).
   Scraping it into PariScore (commercial €19/mo) = TOS violation + legal exposure.
   Clean path = buy betwatch API add-on.

## Recommendation
Official betwatch **API add-on** > scraping. Same data, stable, legal. If scraping
anyway: headless-stealth worker (Playwright + stealth) on a non-blocked egress,
cache getMoney per date, map to PariScore matches by Betfair `e` or normalized names.
