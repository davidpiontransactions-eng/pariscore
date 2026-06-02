Review the current diff/changes for PariScore-specific issues:

1. Syntax check first:
   ```bash
   node --check server.js
   ```
   STOP if any error.

2. Check for PariScore anti-patterns:
   - Bare `.toFixed()` without `safeFixed()` wrapper → crash on null
   - Hardcoded API keys or secrets in code
   - Missing mutex release in `finally` block for fetchOdds/fetchStats
   - `db.*` mutations outside mutex
   - SSE clients not cleaned up on `close` event
   - `best_edge` referenced without null guard (ReferenceError in mobile cards)

3. Math engine integrity (if server.js modified):
   - `computePoisson()` λ normalization constant still 1.35
   - Bayesian blend weights unchanged: Poisson 50% / Elo 25% / xG 25%
   - Kelly cap still 25% max

4. Run full code review:
   Use /code-review at effort=high

5. Output: verdict SHIP / HOLD + list of findings with file:line references.
