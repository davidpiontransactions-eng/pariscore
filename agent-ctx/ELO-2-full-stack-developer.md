# ELO-2 — WTA Elo data added to existing Elo backend

**Agent**: full-stack-developer
**Task ID**: ELO-2
**Date**: 2026-07-05

## Task

Extend the existing `scripts/fetch-tennis-data.ts` (built in ELO-1) so it also
downloads Jeff Sackmann's `tennis_wta` CSVs for 2023-2025, computes Elo for
Sabalenka + Osaka using the same K=32 algorithm, and merges ATP + WTA results
into `src/lib/prediction/elo-data.json`. After this task the WTA players must
use real data (no more mock fallback for them). Keep file < 100 KB. Lint must
pass. DO NOT start dev server. DO NOT break existing ATP data — merge, don't
overwrite. If no WTA mirror is available, generate synthetic data marked
`source: "synthetic"`.

This task continues directly from ELO-1 — see
`/home/z/my-project/agent-ctx/ELO-1-full-stack-developer.md` for the ATP-only
setup that was already in place (54.9 KB JSON, 740 ATP points across
alcaraz/rublev/sinner/medvedev).

## Work Log

### Context discovery

- Read `worklog.md` ELO-1 section (line 629+) and
  `agent-ctx/ELO-1-full-stack-developer.md` to align with the prior agent's
  conventions (canonical-then-mirror source strategy, K=32/denom=400
  algorithm, RFC-4180-lite CSV parser, defensive `mkdirSync` before write,
  exit 1 on download failure without overwriting the JSON).
- Read existing files:
  - `scripts/fetch-tennis-data.ts` (296 lines) — ATP-only single-phase
    pipeline. SOURCES array of URL templates, fetchYear tries each source
    with 15s timeout + payload-size guard, extractMatches pulls
    `tourney_date/winner_name/loser_name/surface/tourney_name`, computeElo
    does a single forward pass maintaining an Elo pool for ALL players seen
    (not just targets), output JSON shape
    `{generatedAt, source, years, config, players}`.
  - `src/lib/prediction/elo-history.ts` — `REAL_PLAYERS` dict built from
    JSON's `players` field, `REAL_PLAYER_IDS` Set for O(1) lookup,
    `computeEloHistory(player)` branches: real path if id in Set, mock path
    otherwise (reverse-compute from `player.elo` via 3 fixed-point
    iterations). Mock dict + ELO_K + ELO_DENO kept intact for WTA fallback.
  - `src/lib/prediction/elo-data.json` (54.9 KB) — 4 ATP players
    (alcaraz=187/2039, rublev=180/1626, sinner=187/2044, medvedev=186/1731),
    source field a single URL string pointing to the jegqwll ATP mirror.
- Read `src/lib/tennis-data.ts` — confirmed the 6 player IDs:
  sabalenka, osaka (WTA), alcaraz, rublev, sinner, medvedev (ATP). Match
  IDs: m1 = Sabalenka vs Osaka, m2 = Alcaraz vs Rublev, m3 = Sinner vs
  Medvedev.

### WTA mirror probe (the critical investigation for this task)

The task brief suggested trying `jegqwll/tennis_wta_2000_2025` (parallel to
the ATP mirror `jegqwll/tennis_atp_2000_2025`). I probed systematically:

1. **Canonical** `https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_{2023,2024,2025}.csv`
   — all 3 returned HTTP 404. Same situation as `tennis_atp` — the canonical
   repo appears deleted/private at time of writing (2026-07-05).

2. **Hinted mirror** `https://raw.githubusercontent.com/jegqwll/tennis_wta_2000_2025/master/wta_matches_2024.csv`
   — HTTP 404. Listed jegqwll's GitHub repos via the API: they only have
   `tennis_atp_2000_2025` (ATP), `Hang-man`, and `image_puzzle_game`. No WTA
   mirror exists under that user.

3. **GitHub repo-search** `?q=tennis_wta+in:name` → 25 results. Top
   candidate `ppaulojr/tennis_wta` (170 forks, default branch master,
   description "WTA Tennis Rankings, Results, and Stats"). Listed repo
   contents via API: `wta_matches_{1968..2015}.csv` only — NO 2023-2025
   files. Dead end for our 3-year window.

4. **Listed forks** of `ppaulojr/tennis_wta` via
   `/repos/ppaulojr/tennis_wta/forks?sort=newest` → found 2 forks pushed
   recently with a larger repo size (226296 vs base 222438, indicating
   additional commits beyond the fork point):
   - `mikecristancho/tennis_wta` — pushed 2026-05-06
   - `VictorSquidWei/tennis_wta` — pushed 2026-05-06

5. **Probed both forks** for `wta_matches_{2023,2024,2025}.csv` on the
   `master` branch — both returned HTTP 200 for all 3 years. Picked
   `mikecristancho/tennis_wta` as the verified WTA mirror.

6. **Verified the mirror**:
   - CSV header matches canonical schema (same 49 columns:
     `tourney_id, tourney_name, surface, draw_size, tourney_level,
     tourney_date, match_num, winner_id, winner_seed, winner_entry,
     winner_name, winner_hand, ...`).
   - Row counts: 2023=2,810 / 2024=2,689 / 2025=2,795 matches.
   - Sabalenka (Aryna Sabalenka) present 70 / 70 / 77 times per year
     (each match has her as either winner or loser once).
   - Osaka (Naomi Osaka) present 0 / 39 / 46 times per year — she took a
     maternity break in 2023 (announced July 2023, gave birth July 2023,
     returned at Brisbane International January 2024). 0 matches in 2023
     is correct, not a data gap.
   - Spot-checked a Sabalenka row: Brisbane 2024 final, Rybakina beat
     Sabalenka 6-0 6-3 — historically accurate.

Real WTA data was available, so the synthetic fallback path described in the
task brief was NOT needed.

### Files modified

#### 1. `scripts/fetch-tennis-data.ts` (refactored, ATP + WTA phases)

- **Extracted `TourConfig` type**: `{tour: "ATP"|"WTA", sources[], sourceNormalise, targetPlayers}`.
- **Two `TOURS` array entries**:
  - ATP: sources = `[canonical JeffSackmann/tennis_atp, jegqwll/tennis_atp_2000_2025]`; targetPlayers = `{alcaraz:"Carlos Alcaraz", rublev:"Andrey Rublev", sinner:"Jannik Sinner", medvedev:"Daniil Medvedev"}`.
  - WTA: sources = `[canonical JeffSackmann/tennis_wta, mikecristancho/tennis_wta]`; targetPlayers = `{sabalenka:"Aryna Sabalenka", osaka:"Naomi Osaka"}`.
- **`runTour(tour)` function**: downloads 3 years of CSVs for that tour, parses them via the existing `extractMatches`, computes Elo via the existing `computeElo` (parameterised by `targetPlayers` instead of hard-coded `TARGET_PLAYERS`). Returns `{histories, source}` where `source` is an array of normalised repo-root URLs.
- **`main()` runs both tours sequentially**, merges `histories` into a single `mergedPlayers` dict, builds `sourceByTour` record. JSON `source` field upgraded from `string | string[]` to `Record<"ATP"|"WTA", string | string[]>` for per-tour traceability.
- **CSV parser, `extractMatches`, `computeElo`, `fetchCsv`, `fetchYear`** — unchanged from ELO-1, just parameterised by `tour` config. `computeElo` now takes `targetPlayers` as a parameter so the same function serves both tours.
- **Defensive collision warning**: if a player id ever appears in both tours (shouldn't with current config), the later tour wins and a console warning is printed.
- The script header comment now documents both ATP and WTA source-fallback chains and notes that the synthetic fallback path is intentionally NOT implemented (a verified real mirror was found).

#### 2. `src/lib/prediction/elo-data.json` (regenerated)

- **6 players** (4 ATP + 2 WTA):
  | Player    | Tour | Matches | currentElo | First point           | Last point            |
  |-----------|------|---------|------------|-----------------------|-----------------------|
  | alcaraz   | ATP  |   187   |   2039     | 2023-02-13, elo=1521  | 2025-06-16, elo=2039  |
  | rublev    | ATP  |   180   |   1626     | 2023-01-02, elo=1483  | 2025-06-16, elo=1626  |
  | sinner    | ATP  |   187   |   2044     | 2023-01-02, elo=1484  | 2025-06-16, elo=2044  |
  | medvedev  | ATP  |   186   |   1731     | 2023-01-02, elo=1485  | 2025-06-16, elo=1731  |
  | sabalenka | WTA  |   217   |   2011     | 2023-01-02, elo=1516  | 2025-11-01, elo=2011  |
  | osaka     | WTA  |    85   |   1727     | 2024-01-01, elo=1483  | 2025-10-13, elo=1727  |
- **Total: 1,042 Elo points** (740 ATP from ELO-1, byte-identical + 302 WTA new).
- **File size**: 79,169 bytes (77.3 KB) — under the 100 KB limit ✓.
- **`source` field** is now an object:
  ```json
  "source": {
    "ATP": "https://raw.githubusercontent.com/jegqwll/tennis_atp_2000_2025/master/",
    "WTA": "https://raw.githubusercontent.com/mikecristancho/tennis_wta/master/"
  }
  ```
- **`generatedAt`**: refreshed to the current run timestamp.
- **`config`** unchanged: `{k:32, denominator:400, startElo:1500}`.

#### 3. `src/lib/prediction/elo-history.ts` (comments updated, code logic unchanged)

- The code logic did NOT need to change — `REAL_PLAYER_IDS` is built
  dynamically from `Object.keys(REAL_PLAYERS)`, so once sabalenka + osaka
  appear in the JSON's `players` field they automatically take the real
  path. No branch changes needed.
- **Updated comments** to reflect the new reality:
  - Header block now says "All 6 players we track — ATP (Alcaraz, Rublev,
    Sinner, Medvedev) and WTA (Sabalenka, Osaka) — get a real Elo history"
    instead of the ELO-1 phrasing "WTA players fall back to the synthetic
    mock history".
  - `PLAYER_HISTORIES` dict comment now marks it as "DEFENSIVE FALLBACK
    ONLY — all 6 current players have real Elo in elo-data.json and never
    reach this branch". Kept the dict intact as a safety net in case
    `elo-data.json` is ever missing/corrupted or a new player is added to
    `tennis-data.ts` before the next fetch run.
  - JSDoc on `computeEloHistory` updated to say "For the 6 players present
    in `elo-data.json` — ATP and WTA — this returns the real history"
    instead of "For ATP players present in `elo-data.json`".
  - Inline comment in the mock branch updated: "Mock fallback (defensive —
    unknown player id, or elo-data.json missing/corrupted). NOT reached by
    any of the 6 current players."

### Verification

- **Lint**: `bun run lint` → exit code 0, 0 errors, 0 warnings.
- **File size**: `elo-data.json` is 79,169 bytes (77.3 KB), under the 100
  KB limit. ✓
- **Player count**: 6 (alcaraz, rublev, sinner, medvedev, sabalenka, osaka)
  ✓.
- **WTA point thresholds**: sabalenka=217 (task asked ≥ 20) ✓, osaka=85
  (task asked ≥ 15) ✓.
- **ATP data preservation**: alcaraz=187/2039, rublev=180/1626,
  sinner=187/2044, medvedev=186/1731 — byte-identical to ELO-1 output
  (merge, didn't overwrite ✓).
- **Dev server status**: Next.js dev server was UP on port 3000 (confirmed
  via `dev.log` activity). Verified live API behavior via `curl`:
  - `GET /api/tennis/elo-history?matchId=m1` → HTTP 200, `a = {playerId:
    "sabalenka", currentElo: 2011, history.length: 217}`, first point
    `{date: "2023-01-02", elo: 1516}`, last point `{date: "2025-11-01",
    elo: 2011}`. `b = {playerId: "osaka", currentElo: 1727, history.length:
    85}`, first point `{date: "2024-01-01", elo: 1483}`, last point
    `{date: "2025-10-13", elo: 1727}`. **Real WTA data — no more mock
    fallback** ✓.
  - `GET /api/tennis/elo-history?matchId=m2` → HTTP 200, `a = {playerId:
    "alcaraz", currentElo: 2039, history.length: 187}`, `b = {playerId:
    "rublev", currentElo: 1626, history.length: 180}`. Real ATP data
    unchanged from ELO-1 ✓.

### Sanity check on WTA values

- **Sabalenka currentElo=2011**: plausible. Dominant 2023-2024 (won
  Australian Open 2023 + 2024, US Open 2024, reached #1 in September
  2023). Slight dip in 2025 (lost AO final to Keys, won Miami + Madrid).
  2011 from a 1500 baseline with K=32 over 217 matches is consistent with
  her elite tier. ~30 Elo below Alcaraz (2039) — both elite, the
  difference is within the noise of K=32 with a 3-year window.
- **Osaka currentElo=1727**: plausible. Returned January 2024 after
  maternity leave (first history point 2024-01-01 at elo=1483, Brisbane
  International). Won 0 titles since comeback, dropped out of top 50,
  flashes of form (4th-round runs at Slams) but no deep title runs. 1727
  is mid-tour level, consistent with her actual WTA ranking trajectory
  2024-2025.
- **Osaka 0 matches in 2023**: correct, not a data gap. She announced her
  pregnancy in January 2023, gave birth to daughter Shai in July 2023,
  returned to play at Brisbane International in January 2024. The Elo
  computation correctly resumes from a near-baseline Elo (1483) at her
  first 2024 match — this is the expected behavior given the 3-year
  window 2023-2025.

## Summary

- **3 files**: 1 refactored script (`scripts/fetch-tennis-data.ts`,
  generic per-tour pipeline, ATP + WTA phases), 1 regenerated data file
  (`src/lib/prediction/elo-data.json`, 77.3 KB, 6 players, 1,042 total
  Elo points), 1 modified module (`src/lib/prediction/elo-history.ts` —
  comments updated to reflect that all 6 players now use real data; code
  logic unchanged since `REAL_PLAYER_IDS` is built dynamically).
- **Lint**: `bun run lint` → exit 0, 0 errors, 0 warnings.
- **WTA points computed**: 302 total (sabalenka=217, osaka=85). Both
  exceed task thresholds (sabalenka ≥ 20, osaka ≥ 15).
- **Data source used**: **REAL mirror** (not synthetic). Canonical
  `JeffSackmann/tennis_wta` returned HTTP 404 for all 3 years. The task
  hint `jegqwll/tennis_wta_2000_2025` does not exist (jegqwll only has
  the ATP mirror). Searched GitHub repo-search API and the ppaulojr
  fork network; verified `mikecristancho/tennis_wta` (a fork of
  ppaulojr/tennis_wta, which is itself part of the original
  JeffSackmann fork network) serves all 3 years 2023-2025 with the same
  CSV schema as canonical. Both ATP and WTA source URLs recorded in the
  JSON `source` object for traceability.
- **ATP data preservation**: alcaraz=187/2039, rublev=180/1626,
  sinner=187/2044, medvedev=186/1731 — byte-identical to ELO-1 output
  (merge, didn't overwrite ✓).
- **API contract preserved**: `PlayerEloHistory` shape unchanged. HTTP
  200/400/404 status codes verified via live curl against the running
  dev server.

## Issues / notes

- **Canonical repo unavailable**: `JeffSackmann/tennis_wta` returns HTTP
  404 for all 3 years at time of writing (same situation as
  `tennis_atp`). The script still tries the canonical URL first per
  task spec — if Jeff Sackmann's repo comes back online the script will
  use it automatically (the mirror is only a fallback).
- **Task hint mirror does not exist**: the task brief mentioned
  `jegqwll/tennis_wta_2000_2025` as a possible mirror (parallel to the
  ATP mirror `jegqwll/tennis_atp_2000_2025`). That repo does NOT exist
  — jegqwll's GitHub profile only has `tennis_atp_2000_2025` plus two
  unrelated Python games (Hang-man, image_puzzle_game). I searched the
  GitHub repo-search API and the ppaulojr/tennis_wta fork network
  (sorted by pushed_at desc) to find the actual verified WTA mirror
  (`mikecristancho/tennis_wta`, pushed 2026-05-06, all 3 years
  present).
- **Synthetic fallback not needed**: the task brief said "If NO WTA
  mirror is available, generate realistic synthetic WTA data and
  document it clearly in the script + JSON `source` field". A verified
  real WTA mirror was found, so the synthetic path was NOT triggered.
  The script header documents this — if `mikecristancho/tennis_wta`
  ever goes dark, add a synthetic generator inside `runTour()` (or a
  new `runSyntheticWTA()` function) and mark
  `source: "synthetic"` for the WTA tour in the JSON `source` object.
- **Osaka history starts 2024-01-01, not 2023-01-02**: she took a
  maternity break in 2023 (announced pregnancy January 2023, gave birth
  July 2023, returned at Brisbane January 2024). The Elo computation
  correctly shows 0 history points for 2023 and resumes from a
  near-baseline Elo (1483) at her first 2024 match — this is the
  expected behavior given the 3-year window 2023-2025.
- **JSON `source` field changed shape**: from `string` in ELO-1 to
  `Record<"ATP"|"WTA", string|string[]>` in ELO-2. Any downstream
  consumer that was reading `source` as a string would need to be
  updated — but `elo-history.ts` does not read `source` (only the
  `players` field), so no code change was needed there. The
  `EloDataJson` type in the script was widened to accept both shapes
  for forward compatibility.
