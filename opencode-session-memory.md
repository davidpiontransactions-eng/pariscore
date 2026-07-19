# Session Memory — 2026-07-18

## Task: Tennis Live Stats (BSD → SSE → React migration)

### Completed
1. **Diagnostic** : 3 bugs dans `BSD WS → SSE → _tnRenderLiveStatsTable`
   - Bug #1: `_bsd_stats` jamais mappé vers `live_stats` ni broadcast SSE → fallback DEMO
   - Bug #2: `sfx='%'` double quand BSD renvoie `"65%"` → `é%` display
   - Bug #3: `panel.dataset.rendered` empêche re-render après SSE update

2. **Fixes server.js** (48 lignes) :
   - `_bridgeTennisStats(match, data)` : copie `_bsd_stats` → `data.*` avec sanitization NaN/`%`
   - 14 keys tennis ajoutées à `live_stats` dans `applyLiveStats()`
   - `_bsd_stats` ajouté aux `fullPatches` SSE

3. **Fixes pariscore.js** (156 lignes) :
   - `_tnSafeStatVal(v)` : coercion null-safe + cleanup `%`
   - `_tnDataSentinel(m)` : validation stats avant render
   - `_tnNormalizeTennisStats(m)` : merge `_bsd_stats` > `live_stats` > `sets[]`
   - SSE live_patch handler : copie `_bsd_stats` → `live_stats` + invalide rendered flag
   - `_tnToggleLiveStats` : retry avec `fetchTennisTop10()` avant fallback DEMO
   - `_tnRenderServiceCircles()` : utilise `_tnSafeStatVal`
   - Per-set stats : inlined avec normalized data
   - Les deux fichiers passent `node --check`

4. **Config skills React** : 8 skills `jaballer/react-claude-skills` synchronisés
   - Créé `opencode.json` avec allowlist de 153 skills
   - Skills installés : `react-senior-ux`, `react-component-design`, `react-modern-react`, `react-api-consumer`, `react-performance`, `react-styling`, `react-utility-snippets`, `react-testing`

### Next steps (see todo.md)
1. Hook `use-tennis-live-stats.ts` (Data Sentinel + SSE + Zod validation)
2. Composant `live-stats-panel.tsx` (shadcn/ui Card/Table/Progress/Badge)
3. Intégration dans le match card + cleanup legacy JS

### Key files
- `pariscore.js` : legacy tennis live stats (~l.2324, SSE handler ~l.12458)
- `server.js` : `_bridgeTennisStats` (~l.48708), `applyLiveStats` (~l.48753)
- `src/hooks/use-live-matches.ts` : reference pattern socket.io hook
- `src/lib/tennis-data.ts` : types TennisMatch/Player existants
- `opencode.json` : skill allowlist (153 skills)
- `todo.md` : remaining actions

### Architecture notes
- Zod 4, socket.io-client ^4.8.3 disponibles
- shadcn/ui style new-york, 48 composants installés
- Tennis types existants dans `src/lib/tennis-data.ts` mais pas de types live stats React
- SSR guard dans les hooks déjà pattern établi (`if (typeof window === 'undefined') return`)

### Decisions
- **XSS** : `_jsStr()` escape `'` → `&#39;` dans onclick template literals — 20 locations fixées
- **Tennis live** : pas de React component existant → créer `src/components/tennis/`
- **Data flow** : BSD WS → server.js → SSE `live_patch` → `useTennisLiveStats` hook → React component
