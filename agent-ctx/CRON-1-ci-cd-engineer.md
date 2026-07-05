# Task CRON-1 — ci-cd-engineer

## Task
Add a monthly cron job to refresh Elo data automatically via GitHub Actions for the SetPoint Next.js 16 app at `/home/z/my-project`.

## Context I read before starting
- `/home/z/my-project/worklog.md` (758 lines) — confirmed prior agents (ELO-1, ELO-2) set up `scripts/fetch-tennis-data.ts` and `src/lib/prediction/elo-data.json` (6 players, 77 KB, 1,042 Elo points).
- `scripts/fetch-tennis-data.ts` (existing) — downloaded ATP+WTA CSVs from Jeff Sackmann mirror network, computed Elo with K=32/denom=400/startElo=1500, exited 0 on success and 1 on download failure (process.exit(1) BEFORE writeFileSync, so existing JSON was preserved on failure).
- `.github/workflows/lint.yml` + `build.yml` — used as style reference (oven-sh/setup-bun@v2, bun install --frozen-lockfile, concurrency group, timeout-minutes).
- `README.md` — needed a "Data refresh" section + CI/CD row update.
- `package.json` — confirmed `lint` = `eslint .`, no existing `fetch` script (the script is run directly with `bun run scripts/fetch-tennis-data.ts`).

## What I built

### 1. `.github/workflows/refresh-elo.yml` (NEW, 89 lines, 6 steps)

```yaml
name: Refresh Elo
on:
  schedule:
    - cron: "0 3 1 * *"          # 03:00 UTC on the 1st of every month
  workflow_dispatch:
    inputs:
      dry_run:                    # optional manual dry-run checkbox
        description: "Dry-run (do not write or commit)"
        type: boolean
        required: false
        default: false
concurrency:
  group: refresh-elo
  cancel-in-progress: false       # monthly runs must finish — no mid-flight cancel
permissions:
  contents: write                 # required for the bot's git push
jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0, persist-credentials: true }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun run scripts/fetch-tennis-data.ts ${{ inputs.dry_run == true && '--dry-run' || '' }}
      - id: diff                  # detect changes via git diff --quiet
        run: |
          if git diff --quiet -- src/lib/prediction/elo-data.json; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi
      - if: steps.diff.outputs.changed == 'true' && inputs.dry_run != true
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/lib/prediction/elo-data.json
          git commit -m "chore(data): refresh Elo data [skip ci]"
          git push
```

Key design decisions:
- `cron: "0 3 1 * *"` — 1st of each month at 03:00 UTC (low-traffic window, after month-end tournament finals).
- `[skip ci]` in the commit message — prevents re-triggering lint/build/e2e/load-test workflows on the bot's auto-commit (CI loop avoidance).
- `persist-credentials: true` on checkout — leaves the default `GITHUB_TOKEN` configured for `git push` (no PAT needed).
- `concurrency: cancel-in-progress: false` — never interrupt a monthly run mid-flight (would leave the repo without an updated JSON).
- `permissions: contents: write` — minimal scope; only what the bot needs to push.
- Optional `dry_run` workflow_dispatch input — useful for probing mirror health from the Actions tab without committing.
- The dry-run flag is conditionally passed via `${{ inputs.dry_run == true && '--dry-run' || '' }}` — when triggered by schedule, `inputs.dry_run` is null/undefined and the expression evaluates to `''`, so the script runs in normal write mode.

### 2. `scripts/fetch-tennis-data.ts` (MODIFIED, +33 lines, minimal additive change)

The script already had all the required robustness guarantees:
- ✅ Exits 0 on success (main resolves, no explicit exit)
- ✅ Exits non-zero on failure (`process.exit(1)` in `runTour()` when all sources fail for any year; `main().catch()` exits 1 on uncaught throws)
- ✅ Does NOT overwrite existing JSON on failure — `process.exit(1)` happens BEFORE `writeFileSync` is reached

The only missing piece was the `--dry-run` flag (task said "optional but nice"). Added minimally:

```ts
const DRY_RUN = process.argv.includes("--dry-run");

// ...later, in main(), at the very end before the write block:
if (DRY_RUN) {
  console.log(`\n[dry-run] NOT writing ${outPath}`);
  console.log(`  Would-write size: ${sizeKB} KB (limit: 100 KB)`);
  console.log(`  Players: ${Object.keys(mergedPlayers).length}`);
  for (const [tour, url] of Object.entries(sourceByTour)) {
    console.log(`  ${tour} source(s): ${url}`);
  }
  console.log(`\n✓ Dry-run complete — exiting 0 without modifying any files.`);
  return;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json, "utf8");
// ...existing success logs
```

Also:
- Added a "Mode: --dry-run (no file will be written)" log at the top of `main()` when DRY_RUN is true
- Updated the usage JSDoc block to document `--dry-run`, exit codes (0 = success, 1 = failure with existing JSON preserved), and the dry-run semantics

No changes to `fetchCsv`, `fetchYear`, `parseCsv`, `extractMatches`, `computeElo`, or `runTour` — the download/parse/Elo pipeline is untouched. The failure path (`process.exit(1)` when a year's download fails) is BEFORE the dry-run branch, so download failures still abort without writing even in dry-run mode.

### 3. `README.md` (MODIFIED, +35 lines)

- Tech stack table CI/CD row: `"lint / build / e2e / load-test"` → `"lint / build / e2e / load-test / refresh-elo"`
- New `## Data refresh` section between `## Common commands` and `## Project layout`:
  - Explains the monthly cron runs automatically on the 1st of each month at 03:00 UTC
  - Explains the `[skip ci]` commit message convention (avoids CI loop)
  - Manual trigger via `gh workflow run refresh-elo.yml` (and `-f dry_run=true` variant)
  - Local run via `bun run scripts/fetch-tennis-data.ts` (and `--dry-run` variant)
  - Failure-mode safety guarantee: download failure → non-zero exit → no JSON overwrite → app keeps serving previous month's data

## Verification

| Check | Result |
|---|---|
| `bun run lint` | exit 0 — 0 errors, 0 warnings |
| YAML syntax (Python `yaml.safe_load`) | valid — name, triggers, concurrency, permissions, 6 steps all parse |
| YAML `schedule.cron` value | `"0 3 1 * *"` ✓ |
| YAML `workflow_dispatch` | present with `dry_run` boolean input ✓ |
| YAML `concurrency` | `{group: refresh-elo, cancel-in-progress: false}` ✓ |
| YAML `permissions` | `{contents: write}` ✓ |
| YAML `runs-on` | `ubuntu-latest` ✓ |
| YAML step count | 6 ✓ |
| Script file exists with `#!/usr/bin/env bun` shebang | ✓ |
| Script `--dry-run` flag wired into main() | ✓ |
| Did NOT execute the fetch script | ✓ (per task constraint — 30 s + network) |
| Did NOT start the dev server | ✓ (per task constraint) |

## Deliverables

1. **Files created/modified:**
   - CREATED: `.github/workflows/refresh-elo.yml` (89 lines, 6 steps)
   - MODIFIED: `scripts/fetch-tennis-data.ts` (+33 lines: `--dry-run` flag + JSDoc)
   - MODIFIED: `README.md` (+35 lines: `## Data refresh` section + CI/CD row update)
   - APPENDED: `worklog.md` (+55 lines: CRON-1 entry)

2. **Lint status:** `bun run lint` → exit 0, 0 errors, 0 warnings ✓

3. **Cron schedule (human-readable):** 1st of each month at 03:00 UTC
   - Examples: 1 Jan 03:00 UTC, 1 Feb 03:00 UTC, 1 Mar 03:00 UTC, …
   - GitHub Actions cron runs may be delayed up to ~15 min during peak load, but 03:00 UTC is a low-traffic window.

4. **How to trigger manually:**
   - **Actions tab**: repo → Actions → "Refresh Elo" workflow → "Run workflow" button (with optional "Dry-run" checkbox)
   - **gh CLI**: `gh workflow run refresh-elo.yml` (or `gh workflow run refresh-elo.yml -f dry_run=true` for dry-run)
   - **Local**: `bun run scripts/fetch-tennis-data.ts` (or `bun run scripts/fetch-tennis-data.ts --dry-run` for dry-run)

## Notes for future agents

- The workflow does NOT run `bun run lint` or `bun run build` after regenerating the JSON — the JSON is a static data file consumed at runtime by `src/lib/prediction/elo-history.ts`, not at build time. The `[skip ci]` token in the commit message would also prevent those workflows from running on the auto-commit anyway.
- The workflow does NOT push tags or create a release — it only commits the regenerated JSON back to `main`. Any deployment that pulls `main` picks up the new data automatically.
- If you want a post-refresh sanity check, add a `bun run lint` step after the "Regenerate Elo data" step (before the commit). The existing failure mode (`process.exit(1)` aborts the job before the commit step) is currently sufficient.
- The script's download-failure path (`process.exit(1)` in `runTour()` before `writeFileSync`) is the critical safety guarantee — DO NOT move `writeFileSync` before the per-year download loop or the existing JSON could be overwritten with empty data on a partial failure.
