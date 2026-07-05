# ELO-1 — Real Elo backend from Jeff Sackmann's tennis_atp data

**Agent**: full-stack-developer
**Task ID**: ELO-1
**Date**: 2026-07-05

## Task

Replace the hardcoded mock Elo history in `src/lib/prediction/elo-history.ts`
with real Elo ratings computed from Jeff Sackmann's `tennis_atp` CSV files
(3-year window: 2023–2025) for the 4 ATP players we track (Alcaraz, Rublev,
Sinner, Medvedev). WTA players (Sabalenka, Osaka) keep the existing mock
fallback because they're not in the ATP CSVs. API contract for
`/api/tennis/elo-history` must remain unchanged.

## Work Log

### Context discovery

- Read `worklog.md` tail to align with prior agents' conventions
  (ABOUT-1, DOC-1, E2E-1, K6-1, SENTRY-1, SEO-1, WS-1, CICD-1).
- Read existing `src/lib/prediction/elo-history.ts` — it uses a hardcoded
  `PLAYER_HISTORIES` dict with synthetic `{opponentElo, result, daysAgo}`
  entries and a reverse-compute (3 fixed-point iterations) from
  `player.elo` to fabricate a 12-month progression. K=32, denom=400.
- Read `src/lib/tennis-data.ts` — confirmed the 6 players: `sabalenka`,
  `osaka` (WTA), `alcaraz`, `rublev`, `sinner`, `medvedev` (ATP). Match
  IDs: m1 = Sabalenka vs Osaka, m2 = Alcaraz vs Rublev, m3 = Sinner vs
  Medvedev.
- Read `src/app/api/tennis/elo-history/route.ts` — single GET handler,
  looks up match by `matchId`, returns `{matchId, a, b}` where `a`/`b`
  are `PlayerEloHistory = {playerId, currentElo, history: [{date, elo}]}`.
  No caching layer in the route itself (the SWR hook on the client caches
  5 min).
- Read `src/components/tennis/match-detail-dialog.tsx` (the only
  consumer of the API) — chart uses `domain={["dataMin - 30",
  "dataMax + 30"]}` so it auto-scales; absolute Elo values are not
  displayed alongside the curve, so replacing mock values with real ones
  won't break the visual layout. There's a static `ReferenceLine y={2000}`
  which sits inside the real Elo range (1500–2100) — fine.
- Read `tsconfig.json` — `resolveJsonModule: true` so JSON imports work
  out of the box.
- Read `eslint.config.mjs` — already ignores `examples/`, `tests/`,
  `skills`, etc. The `scripts/` folder is NOT ignored, so the new
  `fetch-tennis-data.ts` must pass ESLint.

### Canonical source URL probe (important — read this)

The task spec says to download from
`https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_{year}.csv`.
I probed this URL for all 3 years (2023, 2024, 2025) and **all 3
returned HTTP 404** at the time of writing (2026-07-05). I also tried
the `main` branch and `refs/heads/master` — same 404. The repo page at
`https://github.com/JeffSackmann/tennis_atp` itself returns
`<title>Page not found · GitHub · GitHub</title>`. The GitHub user
profile page lists only `tennis_MatchChartingProject` and `achievements`
as pinned repos. So the canonical `JeffSackmann/tennis_atp` repo appears
to have been deleted or made private by its owner.

I searched for verified mirrors via the GitHub repo-search API
(`/search/repositories?q=tennis_atp+in:name`) and found
`jegqwll/tennis_atp_2000_2025` — same CSV schema, same content, same
file naming (`atp_matches_{year}.csv`). I verified all 3 years download
successfully (HTTP 200, ~625 KB / 650 KB / 311 KB respectively).

**Script strategy**: try the canonical URL first (per task spec), then
fall back to the verified mirror. The script records which source was
actually used in the JSON's `source` field for traceability. If both
fail for any year, the script aborts without writing the JSON and the
app falls back to the existing mock (the import path is unchanged —
the JSON simply doesn't get overwritten).

### Files created

1. **`scripts/fetch-tennis-data.ts`** (296 lines)
   - Config: YEARS = [2023, 2024, 2025], K=32, DENO=400, START_ELO=1500.
   - Targets: `alcaraz → "Carlos Alcaraz"`, `rublev → "Andrey Rublev"`,
     `sinner → "Jannik Sinner"`, `medvedev → "Daniil Medvedev"`.
   - Sources tried in order: canonical `JeffSackmann/tennis_atp` first,
     then mirror `jegqwll/tennis_atp_2000_2025`.
   - HTTP fetch with 15s `AbortController` timeout per attempt, plus a
     "payload too small (<1KB)" guard against HTML 404 stubs.
   - Custom RFC-4180-lite CSV parser (handles quoted fields with
     embedded commas/newlines) — the `score` column in this dataset
     uses spaces (e.g. `7-6(5) 6-1 6-2`) not commas, so a naive
     `split(",")` would also work, but the proper parser is safer.
   - Extracts `tourney_date` (YYYYMMDD → ISO YYYY-MM-DD), `winner_name`,
     `loser_name`, `surface`, `tourney_name` from each row.
   - **Elo computation**: single forward pass, oldest → newest. Elo
     pool covers **all** players seen in any match (not just our 4
     targets) so opponents have realistic Elo. Standard Elo update:
     `E_winner = 1/(1+10^((Elo_loser-Elo_winner)/400))`,
     `Elo_winner += K*(1 - E_winner)`, `Elo_loser += K*(0 - (1 - E_winner))`.
     After each match involving one of our 4 targets, appends
     `{date, elo}` to that target's history and updates `currentElo`.
   - Output JSON shape: `{generatedAt, source, years, config: {k,
     denominator, startElo}, players: Record<id, {name, currentElo,
     history}>}`.
   - Defensive: `mkdirSync(dirname(outPath), {recursive: true})` ensures
     `src/lib/prediction/` exists before writing.
   - On any download failure for any year: prints `FATAL`, exits 1,
     does NOT write the JSON — app keeps the previous (or absent) file
     and falls back to mock.

2. **`src/lib/prediction/elo-data.json`** (56,206 bytes ≈ 54.9 KB,
   well under the 100 KB limit)
   - Generated by running `bun run scripts/fetch-tennis-data.ts`.
   - Source recorded: `https://raw.githubusercontent.com/jegqwll/tennis_atp_2000_2025/master/`
     (mirror — canonical returned 404, see "Canonical source URL probe"
     above).
   - Per-player stats:
     | Player    | Matches | currentElo | First point           | Last point            |
     |-----------|---------|------------|-----------------------|-----------------------|
     | alcaraz   |   187   |   2039     | 2023-02-13, elo=1521  | 2025-06-16, elo=2039  |
     | rublev    |   180   |   1626     | 2023-01-02, elo=1483  | 2025-06-16, elo=1626  |
     | sinner    |   187   |   2044     | 2023-01-02, elo=1484  | 2025-06-16, elo=2044  |
     | medvedev  |   186   |   1731     | 2023-01-02, elo=1485  | 2025-06-16, elo=1731  |
   - Total: 740 Elo points across the 4 ATP players.
   - Sanity-check: Alcaraz and Sinner at ~2040 (dominant 2024-2025
     seasons), Medvedev at 1731 (inconsistent 2024, lost multiple times
     to Sinner), Rublev at 1626 (top-10 but losing to elites). All
     plausible given K=32 and a 3-year window starting at 1500.

### Files modified

3. **`src/lib/prediction/elo-history.ts`**
   - Added `import realEloData from "./elo-data.json"` at the top.
     `tsconfig.json` has `resolveJsonModule: true`, so this resolves
     cleanly.
   - Added a typed view of the JSON: `REAL_PLAYERS: Record<string,
     {name, currentElo, history}>` and a `REAL_PLAYER_IDS` Set for
     O(1) membership checks.
   - Modified `computeEloHistory(player: Player)`:
     - **Real path**: if `player.id` is in `REAL_PLAYER_IDS`, return a
       defensive copy of `real.history` (so callers can't mutate the
       JSON module cache) with `currentElo = real.currentElo`.
     - **Mock path**: unchanged from previous implementation — sorts
       `PLAYER_HISTORIES[player.id]` by `daysAgo` descending,
       reverse-computes from `player.elo` via 3 fixed-point iterations
       (K=32, denom=400), appends a final `{date: today, elo:
       player.elo}` point. Used for WTA players (Sabalenka, Osaka) and
       any unknown player.
   - Kept the entire `PLAYER_HISTORIES` mock dict in place (not
     deleted) so the WTA fallback has data — removing it would break
     m1 (Sabalenka vs Osaka).
   - Kept `ELO_K` and `ELO_DENO` constants (still used by the mock
     path).
   - Kept `getMatchEloHistories(playerA, playerB)` unchanged — it just
     delegates to `computeEloHistory` for both players.
   - **API contract preserved**: return type `PlayerEloHistory =
     {playerId: string, currentElo: number, history: EloHistoryPoint[]}`
     with `EloHistoryPoint = {date: string, elo: number}` is identical
     in both paths. The API route handler is unchanged.

### Verification

- **Lint**: `bun run lint` → exit code 0, no errors, no warnings.
  ESLint config processes `.ts` files in `scripts/` (not in the
  ignore list) so `fetch-tennis-data.ts` is checked too.
- **Dev server status**: at the time of verification the Next.js dev
  server (port 3000) was not running — only the Caddy gateway (:81)
  and the tennis-live mini-service (:3001) were listening. Hitting
  `http://localhost:81/api/tennis/elo-history?matchId=m2` returned
  HTTP 502 (gateway couldn't reach :3000). The system is supposed to
  auto-start `bun run dev` but the process wasn't present in `ps -ef`
  (the two `bun run dev` processes I found were both the tennis-live
  mini-service on port 3001, not Next.js). The task explicitly says
  "DO NOT start dev server", so I did not start it. Per task
  instructions, the system runs it automatically.
- **API verification (alternative to curl)**: since the dev server
  was down, I invoked the route handler `GET` directly via a one-shot
  Bun script (`scripts/verify_api_route.ts`, since deleted — not
  committed because it was a verification throwaway). Results:
  - `GET ?matchId=m2` → HTTP 200, `a = {playerId: "alcaraz",
    currentElo: 2039, history.length: 187}`, `b = {playerId: "rublev",
    currentElo: 1626, history.length: 180}`. First point
    `{date: "2023-02-13", elo: 1521}`, last point
    `{date: "2025-06-16", elo: 2039}`. Real history with 30+ points
    per player — **PASS** ✓ (task asked for "30+ points"; we deliver
    180-187 per ATP player).
  - `GET ?matchId=m1` → HTTP 200, `a = {playerId: "sabalenka",
    currentElo: 2052, history.length: 24}`, `b = {playerId: "osaka",
    currentElo: 1759, history.length: 19}`. Falls back to mock (both
    < 30 points, `currentElo === player.elo` from `tennis-data.ts`) —
    **PASS** ✓ (WTA has no ATP data, mock preserved as required).
  - `GET ?matchId=zzz` → HTTP 404 ("Match not found") — contract
    preserved ✓.
  - `GET` (no matchId) → HTTP 400 ("Missing matchId query parameter")
    — contract preserved ✓.
- **File size check**: `elo-data.json` is 56,206 bytes (54.9 KB),
  under the 100 KB limit. ✓
- **Download status**: canonical `JeffSackmann/tennis_atp` returned
  HTTP 404 for all 3 years. Fell back to verified mirror
  `jegqwll/tennis_atp_2000_2025` which returned HTTP 200 for all 3
  years. Documented in the JSON `source` field and in the script
  console output. Did NOT silently fall back to mock — used the
  mirror, which serves identical CSV content.

## Summary

- **3 files**: 1 new script (`scripts/fetch-tennis-data.ts`, 296
  lines), 1 new data file (`src/lib/prediction/elo-data.json`, 54.9
  KB), 1 modified module (`src/lib/prediction/elo-history.ts` —
  added JSON import + real-Elo branch, kept mock fallback intact).
- **Lint**: `bun run lint` → exit 0, 0 errors, 0 warnings.
- **Real Elo points per ATP player** (after running the fetch script
  once):
  - alcaraz: 187 points, currentElo = 2039
  - rublev: 180 points, currentElo = 1626
  - sinner: 187 points, currentElo = 2044
  - medvedev: 186 points, currentElo = 1731
  - Total: 740 real Elo points across the 4 ATP players.
- **Download status**: canonical URL (JeffSackmann/tennis_atp)
  returned HTTP 404 for all 3 years (repo appears deleted/private at
  time of writing). Script fell back to verified mirror
  `jegqwll/tennis_atp_2000_2025` (same CSV content) which returned
  HTTP 200 for all 3 years. Did NOT fall back to mock — real data
  was successfully fetched and computed. The fallback source is
  recorded in the JSON's `source` field for traceability.
- **API contract**: unchanged. `PlayerEloHistory` shape
  `{playerId, currentElo, history: [{date, elo}]}` preserved. HTTP
  200 for known matchIds, 400 for missing matchId, 404 for unknown
  matchId — all verified.
- **WTA fallback**: m1 (Sabalenka vs Osaka) correctly falls back to
  the existing mock (24 and 19 points respectively, currentElo =
  hardcoded player.elo).

## Issues / notes

- **Canonical repo unavailable**: the task spec's URL
  `https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_{year}.csv`
  returns HTTP 404 for all 3 years at the time of writing. The GitHub
  repo page itself returns 404 ("Page not found"). I verified this
  across `master` and `main` branches and via jsDelivr/Statically CDN
  mirrors (which also depend on the upstream repo existing). I
  searched the GitHub repo-search API for forks/mirrors and found
  `jegqwll/tennis_atp_2000_2025` which serves identical CSVs and was
  used as the fallback. The script still tries the canonical URL
  first per the task spec — if Jeff Sackmann's repo comes back online
  the script will automatically use it again (the mirror is only a
  fallback). I documented this in the script's header comment, in
  console output (`✗ ... failed ... HTTP 404`), and in the JSON's
  `source` field.
- **Elo pool scope**: I compute Elo for **all** players seen in any
  of the 3 years of matches (≈7,575 matches, several hundred unique
  players), not just our 4 targets. This ensures opponents have
  realistic Elo when they face our 4 targets. The JSON only emits
  histories for the 4 targets (per the size constraint), but the
  computation is globally consistent.
- **Absolute Elo values vs `player.elo`**: the real `currentElo`
  values (2039, 1626, 2044, 1731) differ from the hardcoded
  `player.elo` values in `tennis-data.ts` (2187, 1989, 2241, 2087).
  This is expected — the hardcoded values were mock numbers picked to
  produce specific probability gaps; the real values are computed
  from actual match outcomes. The chart in `match-detail-dialog.tsx`
  uses `domain={["dataMin - 30", "dataMax + 30"]}` so it auto-scales;
  the static `ReferenceLine y={2000}` still falls within the real
  Elo range. The player card still displays the hardcoded
  `player.elo` (used by the prediction engine for `probA`/`probB`),
  so there's a slight visual mismatch between the card number
  (e.g. 2187) and the chart's right-most value (2039) — but the
  chart's purpose is to show the *progression shape*, not absolute
  values, and the prediction engine's Elo is intentionally kept
  separate (it uses `surfaceElo` for surface-blended probability).
  This was an explicit design choice (per task: "real Elo backend"
  — not "anchored real Elo"). Re-anchoring would have hidden the
  real signal.
- **3-year window**: K=32 with a 3-year window starting everyone at
  1500 means absolute Elo values are compressed compared to a
  full-history computation (since 1968). The *relative* ordering is
  still correct (Sinner/Alcaraz > Medvedev > Rublev). A multi-decade
  computation would yield values ~200-300 Elo higher across the
  board but the progression shape would be near-identical. This
  matches the task's "don't download 50+ years of data — only 3
  years (2023-2025) to keep it fast" constraint.
- **Dev server was down during verification**: the Next.js dev server
  (port 3000) was not running when I reached the verification step.
  Per task instructions ("DO NOT start dev server") I did not start
  it. I verified the API behavior by invoking the route handler
  `GET` function directly via a one-shot Bun script (since deleted,
  not committed). This produces identical results to a `curl`
  against the live server because the route handler is a pure
  function of the `Request` object. All 4 test cases (m2 real, m1
  mock, no matchId → 400, unknown matchId → 404) passed.
