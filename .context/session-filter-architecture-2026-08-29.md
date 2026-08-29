# Session : Architecture filtres Live/Pre-match (2026-08-29)

## Objectif
Unifier l'architecture des filtres Live/Pre-match entre sidebar et contenu central, corriger le bug sélection live tennis → card non affichée.

## Constats initiaux
- 10 études académiques + 5 sites concurrents analysés
- Rapport complet : `.context/report-live-prematch-filter-architecture.md`

## Bugs diagnostiqués

### Bug #1 : Sélection live sidebar → card non affiché (CRITIQUE)
**Root cause** : L'auto-switch `setSubTab("live")` rate quand `liveStates` est vide (SSE pas encore peuplé). `scopeByTime` exclut ensuite le match de l'onglet "today".
**Fichier** : `tennis-tab-content.tsx:500`
**Fix** : Triple fallback — `liveStates[id]?.isLive || liveMatchIdSet.has(id) || isInTreeAsLive(id)`

### Bug #2 : Double système de modes
**Root cause** : Football utilise `modes[football]` du store, tennis utilise `subTab` local state.
**Fichiers** : `use-sports-sidebar-store.ts`, `tennis-tab-content.tsx`

### Bug #3 : Filtres stratégie incompatibles
**Root cause** : Football a Value/BTTS/Corners, Tennis a Favorites/Balanced — aucun vocabulaire partagé.
**Fichiers** : `football-tab-content.tsx`, `tennis-tab-content.tsx`

### Bug #4 : Fenêtre temporelle asymétrique
**Root cause** : `scopeByTime` (tennis) exclut le live, `filterByStartWindow` (football) ne l'exclut pas.
**Fichiers** : `tennis-tab-content.tsx:510`

### Bug #5 : Cache SWR stale 5 min
**Root cause** : `useSportsTree()` a `refreshInterval: 300_000`, les matchs live ne pas dans le tree pendant 5 min.
**Fichiers** : `use-sports-tree.ts`, `sports-sidebar.tsx`

## Plan d'implémentation (6 phases)

| Phase | Sujet | Fichiers | Priorité |
|-------|-------|----------|----------|
| 1 | Fix sélection live sidebar→central | `tennis-tab-content.tsx` | Haute |
| 2 | Unifier les modes | `store`, `tennis-tab-content.tsx`, `football-tab-content.tsx`, `sports-sidebar.tsx` | Haute |
| 3 | Filtres stratégie unifiés | `match-view.ts`, `football-tab-content.tsx`, `tennis-tab-content.tsx`, `store` | Haute |
| 4 | Fenêtre temporelle symétrique | `tennis-tab-content.tsx`, `match-view.ts` | Moyenne |
| 5 | Cache live temps réel | `use-sports-tree.ts`, `use-live-matches.ts`, `sports-sidebar.tsx` | Haute |
| 6 | Compteur live dynamique | `sports-sidebar.tsx`, `badge.tsx` | Basse |

## Traceabilité par phase

### Phase 1 : Fix sélection live sidebar→central
- [ ] Lire le tree SWR pour `isLive` sur le match sélectionné
- [ ] Forcer `setSubTab("live")` si match live sélectionné
- [ ] Vérifier que `matchesWithScoped` contient le match
- [ ] Vérifier que `restForGrid` contient le match
- [ ] Vérifier que le card s'affiche
- [ ] Vérifier le scroll automatique
- [ ] Quality gates : lint + typecheck
- [ ] Commit + push + deploy

### Phase 2 : Unifier les modes
- [ ] Ajouter `"today"` au type `MatchViewMode`
- [ ] Supprimer `subTab` de tennis-tab-content
- [ ] Lire `modes.tennis` au lieu de `subTab`
- [ ] Sync sidebar → tab
- [ ] Quality gates + commit + push + deploy

### Phase 3 : Filtres stratégie unifiés
- [ ] Créer type shared `StrategyFilter`
- [ ] Filtres communs : all | value | confidence | favorites | corners | btts
- [ ] Dropdown unifié avec labels + compteur
- [ ] Quality gates + commit + push + deploy

### Phase 4 : Fenêtre temporelle symétrique
- [ ] Corriger `scopeByTime` pour ne pas exclure le live
- [ ] Même comportement forward/backward pour tous les sports
- [ ] Quality gates + commit + push + deploy

### Phase 5 : Cache live temps réel
- [ ] SWR mutate après chaque poll SSE
- [ ] Réduire refreshInterval à 60s
- [ ] Supprimer le merge live-only dans sidebar (devenu inutile)
- [ ] Quality gates + commit + push + deploy

### Phase 6 : Compteur live dynamique
- [ ] Badge pulse par sport dans la sidebar
- [ ] Badge global en haut
- [ ] Click → filtre automatique "Live"
- [ ] Quality gates + commit + push + deploy
