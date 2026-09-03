# Session: Sidebar v2 — P0/P1/P2 Enhancements (2026-08-28)

## Résumé
Implémentation complète des 3 paliers planifiés pour l'évolution de la sidebar PariScore sans la refondre (sidebar conservée telle quelle, évolution par ajouts).

## Fichiers modifiés

| Fichier | Phase | Changements |
|---------|-------|-------------|
| `src/components/layout/sport-tabs.tsx` | P0a | Suppression hero blur L85-92 (`absolute inset-0 opacity-50` + `SportImage`/`getSportBg`), imports nettoyés, `nav relative bg-[#0F0F1A]` conservé |
| `src/components/layout/sports-sidebar.tsx` | P0b/P1/P2 | LiveLineToggle enrichi (comptes, icônes, motion, roving, tooltip), chrono sort toggle, hide odds, auto-refresh stamp, funnel sliders panel, MyTeamsBlock, Picks dans QuickLinksBlock, MomentumSparkline dans LeagueRow |
| `src/stores/use-sports-sidebar-store.ts` | P0c/P1/P2 | `partialize` + `expandedLeagues`, URL sync `treeStatus`/`selectedMatchIds`, `hideOdds`, `namedLeagueSets` (Top 5, Grand Slams), `followedTeamIds` + actions |
| `src/lib/sports-tree.ts` | P1/P2 | `sortSportsTreeChronological()` pure, `collectPicksConsensus()` retourne `QuickLinkMatch[]` |
| `src/lib/football-live-thresholds.ts` | P2 | `LiveStatFilters`, `DEFAULT_LIVE_STAT_FILTERS`, `matchPassesStatFilters()` |
| `src/components/football/momentum-sparkline.tsx` | P2 | Nouveau composant SVG 80×20 bicolor (vert domicile/bleu extérieur) |

## Détails par palier

### P0 — Socle (3 fichiers chirurgicaux)
- **Hero blur removal** : suppression barre décorative hors flux, double-blur, lazy w800 q60 blur=20 — safe delete vérifié vs `page.tsx:371` flex aside/main
- **LiveLineToggle comptes** : `useMemo` sur `useSportsTree().data` → total/live/prematch, `aria-live="polite"`, format `(142)` ou `(—)`, icônes `Layers/Radio/Clock`, indicateur `motion.div layoutId="filter-tree-indicator"` (spring stiffness 500 damping 35 cohérent sport-tabs.tsx:121), roving tabindex ArrowLeft/Right/Home/End (pattern sport-tabs.tsx:55)
- **Store persistence** : `expandedLeagues` ajouté à `partialize` (fix collapse au reload), URL sync `treeStatus` → `?view=all|live|prematch` + `selectedMatchIds` → `?ids=id1,id2`

### P1 — Filtres & tri concurrents
- **Chrono sort** : `sortSportsTreeChronological()` (4 étapes: flatten→sort→rebuild→recount), toggle A-Z/Time près search bar, localStorage non persisté (reset au reload)
- **Hide odds** : toggle Eye/EyeOff, store `hideOdds` persisté, masque 3 cellules odds → `—`
- **Named league sets** : `namedLeagueSets: Record<string,string[]>` + `activeLeagueSet`, défaut "Top 5" (5 ligues football) + "Grand Slams" (4 tournois tennis), CRUD save/load/delete/clear, persistance
- **Auto-refresh stamp** : `useSportsTree()` SWR `dataUpdatedAt` → "Last sync HH:MM:SS" + point vert pulse sur `isValidating`

### P2 — Innovations PariScore
- **Funnel stat sliders** : panel collapsible (icône Filter) sous TimePills, football seulement, 4 sliders range (Pressure 0-100%, Dangerous 0-50, xG 0-5, SOT 0-30), valeurs live — **TODO**: intégration live stats (TreeMatchSummary n'a pas pressure/xG/dangerous/SOT, nécessite enrichment depuis live-broker/live-state-builder)
- **MomentumSparkline** : composant SVG pur 80×20, `viewBox`, aire bicolore (vert `#22c55e` >0, bleu `#3b82f6` <0), accessible `role="img"` + aria-label dynamique, état vide placeholder muted
- **LeagueRow sparkline** : affiché si 2+ matchs live dans la ligue, utilise `edgePct*10` comme proxy momentum (pas de `live.minute` dans TreeMatchSummary)
- **My Teams** : `followedTeamIds[]` + `toggleFollowedTeam/isFollowedTeam`, bloc au-dessus FavoritesBlock, noms résolus via `homeName/awayName`, bouton X unfollow
- **Picks consensus** : `collectPicksConsensus()` score 0-3 critères (edge>0, isLive, odds complet), garde `score>=2`, tri score↓ puis edge↓, retourne `QuickLinkMatch[]` (match+league), QuickLinksBlock ajoute ligne "Picks" (dot violet `#a855f7`)

## Quality Gates
- **Lint** : 0 nouvelles erreurs (3 préexistantes basketball routes `@typescript-eslint/no-require-imports`)
- **Typecheck** : 0 nouvelles erreurs (toutes préexistantes dans football-strategy-top5, tennis-ml, top5-backtest, tests, tools, skyvern)
- **Pas de régression** : code existant intact, patterns réutilisés (roving, motion, SWR, store)

## Risques identifiés & mitigation
| Risque | Mitigation |
|--------|------------|
| Comptes toggle à 0 | Affichage `(—)` pas `0`, évite bruit |
| Migration `expandedLeagues` | `undefined` → `{}` doux, pas de wipe |
| Momentum sans live.minute | Proxy `edgePct*10` + index*15, fallback `—` |
| Stat filters sans données live | Panel UI présent, filtrage désactivé (TODO commenté), prêt pour enrichment |
| Picks sans _consensusScore persisté | Runtime-only via type assertion, pas d'impact stockage |

## Prochaines étapes
1. **Enrichissement TreeMatchSummary** : ajouter `live?: { minute: number; pressure?: {homePct,awayPct}; homeXg,awayXg; homeDangerous,awayDangerous; homeSOT,awaySOT }` via merge live-broker dans sports-tree.ts
2. **Activer stat filters** : décommenter bloc dans SportsSidebarContent une fois données dispo
3. **i18n keys** : remplacer chaînes en dur ("My Teams", "Picks", "Follow teams...") par clés `t("...")`
4. **Tests Playwright** : screenshots 375/768/1280, vérif roving tabindex, motion, sliders, sparkline
5. **bd dolt push** : synchroniser les beads

## Commit
`ece62318` — feat(sidebar): P0/P1/P2 enhancements (6 files changed, 804 insertions, 47 deletions)