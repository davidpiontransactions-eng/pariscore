# Session Rugby — Audit, fixes, code review, benchmark, deploy (2026-08-14)

## Résultat final
**Mission rugby terminée et déployée en production.** Commit `ba7fa6d2` (171 fichiers) sur main, déploiement VPS OK, endpoints rugby vérifiés en prod.

## Phase 1 — Audit + corrections (toutes appliquées)
Fixes audit A–H :
- **A** : timezone `Europe/Paris` dans `fmtDate`/`fmtTime`/`fmtDateLong` (`rugby-ui.tsx`)
- **B** : `cleanForm` → W/L/D uniquement (`espn.ts`)
- **C** : `RugbyTeamLogo` fallback initiales sur `onError` (import `useState` ajouté)
- **D** : filtre `isCancelledOrPostponed` (`espn.ts`)
- **E** : `fmtHandicap` (line>0 → « Domicile -9.5 ») dans `RugbyMatchCard` + `RugbyMatchDetailModal`
- **F** : `restDays` injectés dans les ratings clonés (`engine.ts` `readMatchDetail`)
- **H** : pool de concurrence 4 dans `getCompetitionsPayload`

## Phase 1b — Code review (subagent) : REQUEST CHANGES, toutes les corrections appliquées
- **MAJOR 1** : normalisation grille Poisson (Σ grid = 1) — `models.ts`
- **MAJOR 2** : points par code — `computeStandings` (`LEAGUE` 2/1/0, `UNION` 4/2/0) + param `points` de `simulateSeason`
- Route sync gated : `RUGBY_SYNC_KEY` env + header `x-sync-key` (temps constant)
- Échec total cache froid : `if (!anySuccess) { cs.degraded = true; return; }` — `lastSyncAt` non marqué
- Latence cold-cache : `isCompStale` exporté (engine) + `getCompetitionsPayload` sert immédiatement + resync arrière-plan (pool 3) + SWR refreshInterval 60/300/120 s (`use-rugby.ts`)
- Cap Elo `Math.min(2.5, marginMultiplier(...))`
- `readMatchDetail` clone les ratings (plus de mutation partagée)
- Minors : guard `data?.competition?.slug === slug` + groupement Paris (`fr-CA`/`Europe/Paris`) ; `FormBadges` `role="img"` ; `ProbBar` `a = 100 - h - d` ; OU = ligne la plus proche du total ; `th scope="col"` ; date H2H `truncate`

## Validations
- Scripts temporaires `__audit-check.ts` / `__verify.ts` (supprimés après) : ALL_CHECKS_PASS
  - NRL : 310 matchs, 31 à venir, form propre (0 non-WLD), 0 annulé/reporté, repos 6j/6j, 5 marqueurs, 2 H2H
  - Points : NRL Panthers 48 pts / 34 matchs (2/1/0), Six Nations France 16 pts (4/2/0)
  - Payload comps : 14 comps, rapide, `degraded=true` ; standings 19 rows ; sims 2000
- Typecheck : aucun erreur rugby (erreurs pré-existantes hors rugby : `scripts/tmp-rss-*.ts`, `LiveDecisionMomentumWidget.tsx(62,47)`, `live-decision-badges.tsx(61,31)`, `bsd-fetcher.ts`, `.next/dev/types/validator.ts` — NE PAS corriger)
- ESLint périmètre rugby : LINT_OK

## Phase 2 — Benchmark + roadmap
- Benchmark : RugbyVision (ratings points-exchange, home adv 5.5, 10k sims, calibration publiée 85.4 % favoris / erreur 13.2 pts / spread 56-58 %), Forebet (Poisson + Kelly/Value), RugbyPass (éditorial, zéro modèle), Flashscore (livescore, zéro prédiction)
- Roadmap : `.context/rugby-innovation-roadmap.md`
  - P0 : PowerScore & Fair Handicap Predictor
  - P1 : Kicking & Weather Impact Index, Try Scorer Value, Distribution des marges 1-12/13+
  - P2 backlog : bonus points union (nécessitent summary ESPN), live scoring, tests unitaires, calibration publique, cotes bookmakers, contraste slate-500

## Phase 3 — Commit + push + deploy (FAIT)

## Phase 4 — P0 PowerScore & Fair Handicap + P1 (commit `346e37c2`, déployé)
- **PowerScore 0-100** : `computePowerScore` (models.ts) = 0.45·eloScore (50+(elo-1500)/12) + 0.55·factorScore (eff=(attack+(2-defence))/2, ±40 pts), régression vers 50 si gamesPlayed < minGames (3), clamp 5-95. Test : moyenne 50, fort 62, faible 40, peu de matchs 54, extrême 74.
- `powerScore` injecté dans `StandingRow` et `RugbyPrediction` (engine.ts) ; badge « PowerScore 78 · 62 » sur RugbyMatchCard ; ligne « PowerScore » dans les standings API.
- **API** : `GET /api/rugby/power?slug=` (top 10 par compétition) + `GET /api/rugby/backtest?slug=` (slug optionnel → toutes comps).
- **Backtest spread** : `src/lib/rugby/backtest.ts` — store `data/rugby-backtest.json` (gitignored, ajout au .gitignore), écriture atomique tmp+rename, mutex queue() anti-courses entre syncs pool, MAX_ENTRIES 3000. Snapshot ligne au moment de la prédiction (jamais recalculée), settlement à la fin du match. Stats par bande homeWinProb <40 % / 40-60 % / ≥60 % + total (home/away cover rate, push exclus). Test local : 2 entrées, settle 31-20 vs ligne 5.5 → home cover 100 %.
- **Page Marchés** : `RugbyMarketsView.tsx` — table des marchés par match (spread + prob couverture home/away, total OU, score probable, confiance) + panneau backtest (couverture par bande, « en collecte » si n=0). ViewToggle 3 onglets.
- **P1 modal** : histogramme des bandes de marge (barres empilées home/away) + Try Scorer Value (badge Top 1-3, anytime + 1er essai).
- **P1 météo Open-Meteo : BLOQUÉ** — les fixtures ESPN n'ont pas de coordonnées de stade, pas de géocodage dispo → backlog (nécessite base stades→coords, ex. via venue name + geocoding).
- Vérifs : typecheck rugby 0 erreur, eslint 0, build Next 70s OK (routes /api/rugby/power + /api/rugby/backtest), tests live locaux OK, prod OK (power: France 59/Ireland 57/Scotland 51 ; backtest en collecte n=0 ; page /rugby 200 ; match detail 200).
- ⚠️ Au deploy : une session parallèle a poussé `0218eb54` (ai-pricing) par-dessus mon commit — `346e37c2` est ancêtre de origin/main, le VPS a les deux. Le script update_vps.sh est en CRLF en local → scp puis `sed -i 's/\r$//'` sur le VPS avant `bash` (sinon syntax error ligne 97).
1. Supprimé `{const` (0 octet, artefact shell) ; `git add .` ; commit `ba7fa6d2` « fix(rugby): audit complet, correction des types, des scores et de la gestion des handicaps »
2. `git push origin main` OK
3. `scripts/update_vps.sh` OK (build Next 32.3s, 56/56 pages, pm2 online : pariscore, pariscore-next, pariscore-cron-match-stats)
4. **BUG PROD trouvé + corrigé** : `/api/rugby/*` → 404 (le legacy next 3005 répondait 200, le catch-all nginx `/api/` → uvicorn 8000 interceptait). Fix : bloc `location /api/rugby/ { proxy_pass http://localhost:3005; }` (modèle `/api/cs2/`) inséré dans `/etc/nginx/sites-enabled/pariscore` (backup `pariscore.bak.rugby`), `nginx -t` OK, reload OK.

## Vérifications production (post-fix)
- `GET /api/rugby/competitions` → 200 (1.5 s)
- `GET /api/rugby/predictions?slug=nrl` → 200 (0.6 s), 31 matchs
- `GET /api/rugby/standings?slug=nrl` → 200 (0.4 s)
- `GET /api/rugby/match?slug=nrl&id=603427` → 200, detail complet (homeRating.restDays, h2h 2, tryScorers 5, prediction complète)
- `GET /rugby` → 200

## Notes utiles pour la suite
- **Routage nginx prod** : `/api/<sport-next>/` doit être déclaré AVANT le catch-all `location /api/` → uvicorn 8000. Les blocs existants : tennis, mma, cycling, f1, email, push, v1, football, nba, wnba, baseball, cs2, rugby. Toute nouvelle route API Next nécessite un bloc nginx (config serveur, pas versionnée — ne pas oublier).
- Le port 3000 = legacy server.js (pas exposé par nginx pour /api). Next standalone = 3005.
- Match détail : `?slug=` requis (validation Zod, sinon 400).