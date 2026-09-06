# PariScore Codebase Structure Overview

## src/components/ - .tsx files (first 20)

1. ab-test-debug.tsx
2. about-dialog.tsx
3. analytics-provider.tsx
4. api-docs-dialog.tsx
5. bankroll-dialog.tsx
6. consent-banner.tsx
7. consent-provider.tsx
8. email-toggle.tsx
9. feedback-widget.tsx
10. language-toggle.tsx
11. motion-config.tsx
12. paper-trading-dialog.tsx
13. privacy-dialog.tsx
14. sentry-error-boundary.tsx
15. sport-chips.tsx
16. stat-tooltips.tsx
17. sw-register.tsx
18. theme-toggle.tsx
19. value-bet-scanner-indicator.tsx

*Note: 19 .tsx files at root level; additional files in subdirectories (ai, basketball, baseball, bankroll, h2h, etc.)*

## src/hooks/ - .ts files (first 10)

1. use-bankroll.ts
2. use-basketball-h2h.ts
3. use-basketball-matches.ts
3. use-bet-manager.ts
4. use-bet-notify.ts
5. use-bet-slip.ts
6. use-bsd-match-detail.ts
7. use-contenders-matches.ts
8. use-cornervalue-stats.ts
9. use-cs2-enrichment.ts
10. use-cs2-matches.ts

*Total: 73 hook files covering bankroll, betting, basketball, CS2, email, elo, football, favorites, fiba, live matches, mobile, tennis, tournaments, value bets*

## src/app/ - Top-level files and directories

**Files:** error.tsx, global-error.tsx, globals.css, layout.tsx, loading.tsx, not-found.tsx, page.tsx, sitemap.ts

**Directories:** (protected), admin, api, bankroll, cache, league, ligues, results, rugby, setpoint, settings, tennis

**globals.css** at src/app/globals.css

## Summary for Micro-Interactions

- 19+ component categories in src/components/
- 73 hooks in src/hooks/  
- 12 top-level route groups in src/app/
- Global CSS at src/app/globals.css