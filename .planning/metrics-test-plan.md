# Plan: Unit Tests for Prediction Infrastructure Metrics

**File**: `src/lib/prediction/football/metrics.test.ts` (new, ~300-400 lines)  
**Framework**: `bun:test` (describe, it, expect — matching `engine.test.ts` pattern)  
**Convention**: French comments, no comments unless non-obvious  

## Source Analysis

### brier-score.ts
- `brierScore(predicted[], actual[])` — returns NaN for empty/mismatched arrays; 0=perfect, 1=worst
- `logLoss(predicted[], actual[])` — returns NaN for empty/mismatched; 0=perfect
- `calibrationCurve(predicted[], actual[], bins=10)` — returns CalibrationBin[]; empty for bad input
- `rankedProbabilityScore(predicted[][], actual[])` — multiclasse RPS; 0=perfect, 1=worst
- `accuracy(predicted[], actual[])` — binary threshold 0.5; NaN for bad input

### walk-forward.ts
- `walkForwardValidation(matches: FootballMatch[], options: WalkForwardOptions)` — requires FootballMatch with `id`, `scheduledAt`, `live.status="FT"`, `live.homeScore`, `live.awayScore`, `odds.home`. Returns WalkForwardResult with predictions, metrics (per-market), windows count.
- Empty/too-small input → returns NaN metrics, 0 windows

### drift-detection.ts
- `detectDrift(recent: PredictionLog[], baseline: PredictionLog[])` — uses `brierScore` from brier-score.ts. DRIFT_THRESHOLD = 0.02. Returns DriftDetectionResult with `drifted: boolean`, per-market metrics, summary.
- Handles empty arrays gracefully (NaN → no drift)

### ab-testing.ts
- `assignVariant(matchId, variants[])` — deterministic hash, throws on empty variants
- `compareVariants(resultsA: PredictionLog[], resultsB: PredictionLog[])` — chi-squared test, p<0.05 = significant. Returns ComparisonResult.

### Prisma type (mock needed)
```typescript
type PredictionLog = {
  id: string; matchId: string; homeProb: number; drawProb: number; awayProb: number;
  bttsProb: number | null; over25Prob: number | null;
  settled: boolean; actualHome: number | null; actualAway: number | null;
  createdAt: Date;
}
```

### FootballMatch type (mock needed)
```typescript
type FootballMatch = {
  id: string; scheduledAt: string;
  live?: { status: string; homeScore: number; awayScore: number } | null;
  odds?: { home: number; draw: number; away: number };
  // ... other fields unused by walk-forward
}
```

## Test Structure (34 tests)

### describe("brierScore") — 4 tests
1. Perfect predictions (all 1.0 for actual=1) → 0
2. Worst predictions (all 0.0 for actual=1) → 1
3. Random predictions (~0.5 for actual random) → ~0.25
4. Empty arrays → NaN

### describe("logLoss") — 3 tests
5. Perfect predictions → ~0
6. Worst predictions (1.0 for actual=0) → high value (>5)
7. Empty arrays → NaN

### describe("calibrationCurve") — 3 tests
8. Well-calibrated data (pred ~actual) → bins close to diagonal
9. Empty arrays → empty result
10. Custom bins parameter (5 bins) → 5 bins returned

### describe("rankedProbabilityScore") — 3 tests
11. Perfect RPS prediction → 0
12. Worst RPS → high value
13. Empty arrays → NaN

### describe("accuracy") — 3 tests
14. All correct → 1.0
15. All wrong → 0.0
16. Empty arrays → NaN

### describe("walkForwardValidation") — 5 tests
17. Too few matches → empty result, NaN metrics
18. Valid dataset → predictions generated, windows > 0
19. No data leakage → all test dates > last train date
20. Per-market breakdown → 1X2, BTTS, O25 each have metrics
21. Metrics computed → brier, accuracy, roi are numbers

### describe("detectDrift") — 3 tests
22. Identical distributions → drifted: false
23. Clear drift (recent worse) → drifted: true
24. Empty arrays → drifted: false, no NaN in summary

### describe("assignVariant") — 3 tests
25. Same matchId → same variant (deterministic)
26. Different matchIds → distributed across variants
27. Empty variants array → throws

### describe("compareVariants") — 4 tests
28. Identical results → no winner (significant: false)
29. Clear winner → significant: true, winner set
30. Empty results → NaN metrics, significant: false
31. Metrics computed → brierScore, accuracy, logLoss are numbers

## Mock Helpers

```typescript
// PredictionLog mock factory
function makeLog(overrides: Partial<PredictionLog>): PredictionLog

// FootballMatch mock factory
function makeMatch(overrides: Partial<FootballMatch>): FootballMatch
```

## Verification
```bash
bun test src/lib/prediction/football/metrics.test.ts
```
