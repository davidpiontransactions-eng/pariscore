# Design — Filtre latéral multi-sports (1xBet) sur PariScore

Date: 2026-08-15 · Source: `.context/pm/prompt-filtre-1xbet-sidebar.md` · Statut: approuvé (scope « tree complet tous sports »)

## Contexte codebase (audit réel)

- Aucun store Zustand n'existait dans `src/` (zustand 5 installé) → ce feature crée le premier.
- Infra existante réutilisée : `src/lib/match-view.ts` (`filterByStartWindow`, `TIME_RANGE_OPTIONS`), `time-range-filter.tsx`, `use-tab-view.ts` (Live/Line persisté localStorage), `flag-utils.ts`, shadcn `sheet`.
- Sources de données réelles (10 sports) : football (`/api/v2/matches` + legacy), tennis (`/api/tennis/prematch`), cs2 (`/api/cs2/matches`), nba/wnba (`/api/{nba,wnba}/matches`), mma (`/api/mma/fights`), cycling (`/api/cycling`), f1 (`/api/f1`), baseball (`/api/baseball/schedule`), rugby (`/api/rugby/competitions`).
- Audit live 1xbet.rs/1xbet.com impossible (anti-bot, page JS) → patterns documentés dans le prompt §2.1.

## Architecture

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `src/types/sports-sidebar.ts` | Types spec §2.3 (`SportNode`, `CountryNode`, `LeagueNode`, `TimeFilterHours`) + résumé match niveau 4 |
| `src/lib/sports-tree.ts` | Builders purs par sport → `SportNode[]`, agrégation, filtre recherche, filtre temporel sur counts |
| `src/hooks/use-sports-tree.ts` | Agrégation SWR (`Promise.allSettled` sur 10+ endpoints, refresh 5 min, dédup) |
| `src/stores/use-sports-sidebar-store.ts` | Zustand v5 + `persist` (favoris, expanded, modes live/prematch) + sync URL `history.replaceState` (`?sport=&league=&time=&q=&view=`) |
| `src/components/layout/sports-sidebar.tsx` | UI 5 blocs (recherche, pills horaires, favoris épinglés, accordéon Sport→Pays→Ligue→Matchs, toggle Live/Line) ; aside sticky `lg+`, Sheet mobile |

### Fichiers modifiés

- `src/app/page.tsx` : layout flex (sidebar + contenu), sync `store.selectedSportId ↔ activeTab`, bouton `ListFilter` dans le header (mobile).
- `src/components/shared/time-range-filter.tsx` : interface étendue à `TimeFilterKey` (+ pill « Aujourd'hui »).
- `src/components/football/football-tab-content.tsx` : `selectedLeague`, `timeRange`, `mode` → store (source de vérité unique).
- `src/components/football/tennis-tab-content.tsx` : `timeRange` → store (helper `scopeByTime`).
- Tabs NBA, WNBA, CS2, MMA, baseball (`MLBKBOFolderTab`), rugby : fenêtre horaire + mode Live/Line migrés de `useTabView`/state local vers le store — le toggle Live/Pre-match de la sidebar agit sur tous les onglets.
- `src/lib/match-view.ts` : + `TimeFilterKey`, `parseTimeFilter()` (`'2h'` → heures, `'today'` → flag) et `filterByToday()`.
- `src/hooks/use-football-matches.ts` : export de `transformV2` (réutilisé par l'agrégateur).
- `src/messages/{fr,en}.json` : namespaces `sportsSidebar` + `matchTabs.timeToday`.
- `COMPONENTS.md` : enregistrement.

### Décisions

1. **Couplage grille** : le store est source de vérité pour ligue/temps/mode du football et temps du tennis. Les composants existants (`FootballLeagueBar`, `TimeRangeFilter`, `MatchViewTabs`) restent affichés et écrivent dans le store.
2. **URL sync** : `history.replaceState` (pas de refonte du routing Next ; la décision localStorage de `use-tab-view` reste valable pour les onglets non couplés).
3. **Tree complet** : les 10 sports ont de vraies données agrégées ; le baseball agrège ses 7 ligues ; le rugby utilise `upcomingCount` ; niveau 4 (matchs) = résumé 8 prochaines rencontres, clic → `open-match-detail` (foot/tennis) ou bascule d'onglet.
4. **Favoris par défaut** (aucune personnalisation) : Champions League, Premier League, Ligue 1, Grand Slam, NBA (match par nom).
5. **Live/Line** : store `modes[sport]` ; tous les onglets à liste de matchs (football, tennis via sub-tabs, CS2, NBA, WNBA, MMA, baseball, rugby) lisent le store — le toggle de la sidebar et les `MatchViewTabs` partagent le même état. `use-tab-view.ts` (localStorage) est supprimé : plus aucun consommateur.

### Hors scope (YAGNI)

- Refonte du routing par sport (URL params seulement).
- Recherche dans la grille centrale (la recherche filtre l'arborescence, comme 1xBet).
- Niveau 4 interactif pour les sports sans dialog de détail.
