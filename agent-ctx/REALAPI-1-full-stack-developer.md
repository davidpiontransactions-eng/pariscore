# Task REALAPI-1 — Real Tennis API Integration

**Agent:** full-stack-developer
**Task:** Connect SetPoint Tennis Prematch app to real tennis APIs (The Odds API) instead of mock data, with graceful fallback.

---

## Work Log

### Files Read (Context Gathering)
- `src/lib/tennis-data.ts` — 3 mock matches, `TennisMatch`/`BookmakerOdd`/`Player` types, seeded `PHOTO_URLS`.
- `src/app/api/tennis/prematch/route.ts` (pre-modification) — had a `fetchFromOddsApi()` that was broken: it only matched the 3 mock player names against the live Odds API feed, never returning real matches. Returned `source: "mock"` whenever `ODDS_API_KEY` was unset.
- `src/lib/prediction/engine.ts` — `predict()` with Elo+form+H2H weighted blend + 1000-resample bootstrap IC.
- `src/lib/prediction/elo-history.ts` + `elo-data.json` — 1042 Elo points across 6 players (sabalenka / osaka / alcaraz / rublev / sinner / medvedev). Computed offline by `scripts/fetch-tennis-data.ts` from Jeff Sackmann's ATP+WTA match CSVs (3-year window, 2023–2025).
- `src/hooks/use-prematch-matches.ts` — SWR polling hook (60s interval).
- `src/app/page.tsx` — already had badge logic: `source === "odds-api"` → green "Live odds" badge, `source === "mock"` → amber "Démo" badge.
- `agent-ctx/*.md` — read prior task work patterns for consistency.

### Files Created / Modified

1. **NEW `src/lib/player-matcher.ts`** (114 lines)
   - `findPlayerElo(name: string): PlayerEloMatch | null` — fuzzy name → Elo resolver.
   - 4-stage matching strategy (each step case- and diacritic-insensitive):
     1. Exact normalized name match
     2. Surname substring match (handles "Sabalenka" or "A. Sabalenka")
     3. Initial + surname pattern (handles "A. Sabalenka" ↔ "Aryna Sabalenka" via initials map)
     4. Surname prefix match (handles minor spelling variations)
   - Also exports `extractFormFromHistory(history, windowSize=6)` — infers W/L from consecutive Elo deltas (rise = W, drop = L).

2. **NEW `src/lib/player-photos.ts`** (87 lines)
   - `resolvePlayerPhoto(name: string, playerId?: string): string`
   - Resolution order: exact seeded name → fuzzy partial seeded name → player id → DiceBear initials avatar fallback (deterministic per name).
   - DiceBear URL: `https://api.dicebear.com/7.x/initials/svg?seed=<name>&backgroundType=gradientLinear&fontWeight=600`.

3. **NEW `src/lib/real-matches.ts`** (333 lines)
   - `fetchRealMatches(apiKey: string): Promise<TennisMatch[]>`
   - Parallel fetch of ATP + WTA singles from The Odds API (2 credits per call, 8s timeout).
   - Handles HTTP 429 (rate limit) and 401 (bad key) with descriptive errors.
   - De-duplicates by API match id; sorts by commence_time ascending.
   - For each match: identifies players via first bookmaker's `h2h` market, resolves Elo via `findPlayerElo()`, builds Player objects, extracts form from Elo history, runs `predict()`, swaps A/B if A is not the favorite (favorite gets emerald `#1B4332`, challenger gets violet `#5C2D91`), extracts multi-bookmaker odds (vig-removed), synthesizes H2H history placeholder for UI.
   - Skips matches where neither player is in elo-data.json.
   - Returns up to MAX_MATCHES=10 (per spec).
   - Throws Error on total failure (caller falls back to mock).

4. **MODIFIED `src/app/api/tennis/prematch/route.ts`** (146 lines, was 187)
   - Two-tier cache TTL: 5min for real-API data, 60s for mock.
   - Cache entry now stores both data AND source label.
   - In-flight deduplication lock prevents bursty concurrent requests from triggering multiple Odds API calls.
   - Flow: cache hit (per-source TTL) → real API if `ODDS_API_KEY` set → mock fallback on any failure.
   - Mock fallback uses `enrichMockMatch()` helper that recomputes `probA/probB/IC/confidence/eloGap` via `predict()` (preserves the "real probabilities on mock data" behavior).
   - Removed the broken `fetchFromOddsApi()` that only matched mock player names.

---

## Verification

### Lint
- `bun run lint` → **0 errors**.
- Pre-existing TypeScript errors in `match-card.tsx`, `sentry-error-boundary.tsx`, `use-push-notifications.ts`, `use-value-bet-scanner.ts`, `bookmaker-comparator-dialog.tsx` are unrelated to this task — none touch my new files (`real-matches.ts`, `player-matcher.ts`, `player-photos.ts`, modified `route.ts`).

### Functional Tests (via tmp Bun scripts)

**Player matcher** (verified empirically):
```
Aryna Sabalenka        → sabalenka  elo=2011 form=WLWWWW
A. Sabalenka           → sabalenka  elo=2011 form=WLWWWW
SABALENKA              → sabalenka  elo=2011 form=WLWWWW
sabalenka              → sabalenka  elo=2011 form=WLWWWW
Sabalenka A.           → sabalenka  elo=2011 form=WLWWWW
Carlos Alcaraz         → alcaraz    elo=2039 form=WWWWWW
C. Alcaraz             → alcaraz    elo=2039 form=WWWWWW
Jannik Sinner          → sinner     elo=2044 form=WWWLWL
Daniil Medvedev        → medvedev   elo=1731 form=LWWWWL
D. Medvedev            → medvedev   elo=1731 form=LWWWWL
Naomi Osaka            → osaka      elo=1727 form=LLWLWW
Andrey Rublev          → rublev     elo=1626 form=WWWLWL
Roger Federer          → NO MATCH
Rafael Nadal           → NO MATCH
```

**Photo resolver** (verified):
- "Aryna Sabalenka" → OSS photo
- "A. Sabalenka" → same OSS photo (fuzzy match)
- "Roger Federer" / "Novak Djokovic" → DiceBear URLs

**API route without `ODDS_API_KEY`** (curl against live dev server):
```
HTTP 200
source: mock
match ids: ['m1', 'm2', 'm3']
```

**API route with invalid `ODDS_API_KEY`** (simulated 401):
```
[prematch] fetchRealMatches failed: Both ATP and WTA fetches failed: ATP=The Odds API unauthorized (401) — bad API key, WTA=The Odds API unauthorized (401) — bad API key
[prematch] Real API failed, falling back to mock: ...
source: mock
matches count: 3
```

**API route with valid simulated Odds API response** (Sinner vs Alcaraz):
```
source: odds-api
matches count: 1
  real-abc123: Carlos Alcaraz (2039, #1B4332) vs Jannik Sinner (2044, #5C2D91) | probA=55 probB=45 | odds=2 bookmakers
```
- Alcaraz correctly assigned as favorite (55% vs 45%) — his perfect 6W-0L form outweighs the tiny 5-point Elo gap.
- Colors correctly swapped (Alcaraz emerald = favori, Sinner violet = challenger).
- 2 bookmakers (Bet365, Unibet) extracted.

### Dev Server Health
- `curl http://localhost:3000/` → HTTP 200 (page renders).
- `curl http://localhost:3000/api/tennis/prematch` → HTTP 200 (API responds).
- Did NOT start the dev server (it was already running on PID 25113 from system init).

---

## Stage Summary

### Artifacts
- **NEW:** `src/lib/player-matcher.ts` (114 lines)
- **NEW:** `src/lib/player-photos.ts` (87 lines)
- **NEW:** `src/lib/real-matches.ts` (333 lines)
- **MODIFIED:** `src/app/api/tennis/prematch/route.ts` (146 lines, was 187)

### Behavior Matrix
| State | source | matches returned | UI badge |
|---|---|---|---|
| `ODDS_API_KEY` set + API reachable | `odds-api` | up to 10 real matches (`real-<apiId>`) | green pulsing "Live odds" |
| `ODDS_API_KEY` set + API fails (401/429/network/empty) | `mock` | 3 seeded matches with real predictions | amber "Démo" |
| `ODDS_API_KEY` unset (current default) | `mock` | 3 seeded matches with real predictions | amber "Démo" |

### Cache Strategy
- Real-API data: 5-min TTL (protects 500 req/month free tier; spec mandates ≥5 min).
- Mock data: 60-s TTL (no API cost; keeps dev feeling fresh).
- In-flight promise lock deduplicates concurrent requests.

### Rate-limit & Error Handling
- HTTP 429 → descriptive error → automatic fallback to mock.
- HTTP 401 → descriptive error → automatic fallback to mock.
- Network timeout (8s) → automatic fallback to mock.
- Empty ATP + WTA response → automatic fallback to mock.
- Both ATP + WTA fetches failed → automatic fallback to mock.

### How to Test
- **WITHOUT API key (current state):** `curl http://localhost:3000/api/tennis/prematch` → `source: "mock"`, 3 matches (m1/m2/m3). UI shows amber "Démo" badge.
- **WITH valid API key:** add `ODDS_API_KEY=<key>` to `.env`, restart dev server, hit the same URL → `source: "odds-api"`, up to 10 real matches. UI shows pulsing emerald "Live odds" badge, "Démo" badge hidden.
- **WITH invalid API key:** set `ODDS_API_KEY=invalid` → `source: "mock"`, 3 matches. Server logs the failure. UI shows amber "Démo" badge.

---

## Issues
None.

## Critical Constraints Honored
- ✅ Did NOT start dev server (already running).
- ✅ Did NOT break the mock fallback (verified — identical pre-task behavior without key).
- ✅ Cache TTL ≥ 5 min for real-API data (used 5 min exactly).
- ✅ HTTP 429 handled gracefully (→ mock fallback).
- ✅ Player name matching is case-insensitive and handles common variations ("A. Sabalenka" ↔ "Aryna Sabalenka", all-caps, surname-only, etc.).
- ✅ Lint passes (0 errors).
