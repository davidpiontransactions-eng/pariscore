# Mission Football — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution inline autorisée par l'utilisateur : GO T1→T6).

**Goal:** Restaurer le Top 10 football (root cause : env VPS + shape fallback cassée), scraper BeSoccer (compos/arbitre/météo/H2H), exposer les picks ≥60% Dixon-Coles+xG avec EV, refondre l'UI (terrain, table, widget conditions).

**Architecture:** Pipeline BSD conservé (route `/api/football/top5` → API bzzoiro → `computeStrategyTop5Matches`). Fallback en cascade : BSD → cache disque → shape vide complète. Nouveau service `football-analytics` au-dessus de `dixon-coles.ts` existant. Données BeSoccer dans SQLite via Prisma (`Lineup`, `BeSoccerAnalysis`).

**Tech Stack:** Next.js 16, Bun, Prisma/SQLite, SWR, Scrapling (Python), tailwind 4, lucide-react.

## Global Constraints
- TypeScript strict, pas de `any` ; commentaires en français ; Conventional Commits ≤72 chars.
- Charte : dark navy + `#00e676` ; composants référencés dans COMPONENTS.md obligatoirement mis à jour.
- Pas de nouvelle dépendance npm (Scrapling déjà présent côté Python).
- Jamais `git add .` global (worktree contient du snooker non lié).
- `.env` jamais commité ; `BSD_API_KEY` ajoutée au VPS via SSH.

---

### Task 1: Fix shape fallback + cache disque (T1)

**Files:**
- Modify: `src/app/api/football/top5/route.ts`
- Create: `src/lib/football-top5-cache.ts`

**Interfaces:**
- Produces: `emptyStrategyTop5(): StrategyTop5` (toutes les clés à []), `readFixturesCache(): {finished, fixtures, at} | null`, `writeFixturesCache(f, fx): void`.
- `StrategyTop5` = `{window:number; minPlayed:number; strategies: Record<StrategyTop5Key, StrategyMatchEntry[]>}` (existant).

- [ ] Step 1: `src/lib/football-top5-cache.ts` — `emptyStrategyTop5()` construit Record depuis `STRATEGY_TOP5_KEYS` ; cache disque `data/cache/bsd-fixtures.json` (readFileSync try/catch, TTL 6h, write après succès BSD).
- [ ] Step 2: route — le catch renvoie `readFixturesCache()` re-scorée via `computeStrategyTop5Matches` (meta.source `cache-fallback`) sinon `emptyStrategyTop5()` (meta.error préservée). SHAPE GARANTIE : toujours `strategies`.
- [ ] Step 3: probe locale → `strategies` présente dans les 2 branches.
- [ ] Step 4: commit `fix(football): top5 fallback returns complete strategies shape + disk cache`.

### Task 2: Prisma Lineup + BeSoccerAnalysis (T1 suite)

**Files:**
- Modify: `prisma/schema.prisma`
- [ ] Step 1: ajouter modèles (champs spec §3-T1, `@@map("lineups")`, `@@map("besoccer_analyses")`, index matchId).
- [ ] Step 2: `bun x prisma db push` → OK sans perte.
- [ ] Step 3: commit `feat(db): add Lineup and BeSoccerAnalysis models`.

### Task 3: Scraper BeSoccer (T2)

**Files:**
- Create: `scripts/scrape_besoccer.py` (StealthyFetcher, 4 parsers, CLI --limit/--ids/--dry-run)
- Create: `scripts/sync-besoccer-db.ts` (Bun, PrismaClient, upsert BeSoccerAnalysis + delete/create Lineups, lit data/besoccer/*.json)
- [ ] Step 1: scraper — `stealth_get(url)` (session réutilisée), `parse_analyse`, `parse_prematch`, `parse_lineups`, `parse_infos` (regex robustes double/simple quotes), sortie JSON `{matchId, url, fetchedAt, analysis, lineups, conditions}`.
- [ ] Step 2: test réel sur 1 match du jour → JSON cohérent.
- [ ] Step 3: sync-besoccer-db.ts → upsert OK.
- [ ] Step 4: commit `feat(scraper): BeSoccer stealth scraper + Prisma sync`.

### Task 4: football-analytics service + tests (T3)

**Files:**
- Create: `src/lib/services/football-analytics.ts`
- Test: `src/lib/services/football-analytics.test.ts` (bun:test)

**Interfaces:**
- Produces: `computeMatchPicks(input: PickInput): MatchPick[]` où `PickInput = {lambdaHome, lambdaAway, htShare?: number|null, odds?: {over15?: number|null, ahHomePlus15?: number|null, ahAwayPlus15?: number|null}|null, xgTotal?: number|null}`, `MatchPick = {type: "over15"|"dcOver15"|"ahPlus15"|"over05ht"; side?: "home"|"away"; prob: number; ev: number|null; trigger: string}` (prob ∈ [0,1], EV null si cote absente).
- Consumes: `dixonColesMarkets(lambdaHome, lambdaAway)` (existant, retourne Markets en %).

- [ ] Step 1: test échouant (module absent) ; Step 2: implémentation — matrice DC, seuils spec : over15 si xgTotal>2.6 ou null, dcOver15 = P(1X)−P(1X∧≤1 but), ahPlus15 = 1−P(défaite par ≥2), over05ht si htShare>0.65 ; filtre prob ≥ 0.60 ; Step 3: `bun test src/lib/services/football-analytics.test.ts` vert ; Step 4: brancher champ `picks` sur les 10 premiers de `strategies.over15` dans la route top5 ; Step 5: commit `feat(prediction): football picks engine ≥60% (DC + xG + EV)`.

### Task 5: UI Behance (T4)

**Files:**
- Create: `src/components/football/lineup-pitch.tsx`, `top-strategies-table.tsx`, `match-conditions-widget.tsx`
- Modify: `src/components/football/football-top10-widget.tsx` (rewire table + dark), `COMPONENTS.md`

**Interfaces:**
- Consumes: `StrategyMatchEntry` (existant), `MatchPick` (Task 4), `Lineup`/`BeSoccerAnalysis` via API (Task 2-3).

- [ ] Step 1: `top-strategies-table.tsx` — props `{rows, strategy, picksByMatch?}` ; badge confiance ≥70 vert « Confiance Élevée », 60-70 ambre « Confiance Moyenne ».
- [ ] Step 2: `lineup-pitch.tsx` — props `{lineups?: {home: PitchPlayer[]; away: PitchPlayer[]} | null, homeName, awayName}` ; `PitchPlayer = {player, position, rating?, isAbsence?}` ; rangées GK/D/M/A depuis schéma parse « 4-3-3 » ; fallback « Compositions indisponibles ».
- [ ] Step 3: `match-conditions-widget.tsx` — props `{conditions?: {refereeName, refereeYellowAvg, refereeRedAvg, stadium, weather} | null}` ; fallback discret.
- [ ] Step 4: rewire top10 widget (dark navy, table, section picks ≥60%).
- [ ] Step 5: COMPONENTS.md +3 entrées.
- [ ] Step 6: commit `feat(football): Behance UI — lineup pitch, strategies table, conditions widget`.

### Task 6: Gates + deploy (T5)

- [ ] `bun run typecheck && bun run lint && bun run build` → 0 erreur.
- [ ] SSH VPS : ajouter BSD_API_KEY à /var/www/pariscore/.env (si absente).
- [ ] `deploy.bat "feat(football): top10 fix + BeSoccer + picks engine + Behance UI"`.
- [ ] Probe prod : top5 source=bsd, strategies non vides.

### Task 7: Knowledge (T6)

- [ ] `graphify update .`
- [ ] Rapport `.context/rapport-mission-foot-debug.md` + commit `docs: add football mission report`.
