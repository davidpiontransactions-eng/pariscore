# Rapport Mission A1 + I5 — Onglets Basket/CS2/Darts & dialog détail

Date : 2026-08-04

## A1 — Onglets Best Matches câblés sur données réelles

| Onglet | Avant | Après |
|--------|-------|-------|
| Basketball | `matches: []` (vide permanent) | Données réelles NBA + WNBA via `/api/nba/matches` + `/api/wnba/matches` (ESPN) |
| CS2 | `matches: []` (vide permanent) | Données réelles via `/api/cs2/matches` (BSD, 14 matchs probés) |
| Darts | onglet inerte masqué | Onglet désactivé visible « Bientôt » (aria-disabled, tooltip) |

### Fichiers créés
- `src/hooks/use-basketball-matches.ts` — SWR, fusion NBA+WNBA, normalisation ESPN → `BasketballMatch` (id, league, scheduledAt, status, home/away abbr/name/score/record, pHome/pAway blend, edgeElo), filtre `status ≠ post|finished`, tri par date, poll 60s.
- `src/hooks/use-cs2-matches.ts` — SWR, normalisation BSD → `Cs2Match` (team names rétablis en casse lisible via `toTitleCase`, hltv_rank, bestOf, currentMap, tournament), filtre `status ≠ finished`, tri par date, poll 60s.

### Fichiers modifiés
- `src/components/dashboard/best-matches-tabs.tsx` :
  - `basketballMatches` / `cs2Matches` dérivés des hooks (détail1 : `ΔElo X · 59-41` pour basket, `HLTV #1 · #3` / `BO1 · map` pour CS2 ; détail2 : record/league / tournoi).
  - Tabs désormais filtrés sur `matches.length > 0 || loading || error` (un sport en erreur 503 reste visible avec son état d'erreur).
  - Darts : bouton désactivé « Bientôt » à droite de la liste des tabs (aucune route API darts).
  - Empty state : message distinct si erreur API (`Impossible de charger les données X`).

## I5 — Click "10 prochains matchs" → ouvre le dialog de détail

- `src/app/page.tsx` : listener global `window.addEventListener("open-match-detail")` dans `HomeInner`.
- L'event transporte `{ sport: "tennis" | "football", matchId }` (émis par `upcoming-ten-matches-table.tsx`).
- Résolution de l'objet match complet depuis `tennisData` / `footData` du `DashboardDataProvider`, puis rend du dialog correspondant en **lazy** (`MatchDetailDialog` tennis / `FootballMatchDetailDialog`), `open` forcé, `onOpenChange(false)` → remet `detail` à null.
- Type discriminant `DetailRequest = { sport: "tennis"; match: TennisMatch } | { sport: "football"; match: FootballMatch }`.
- Fichiers interdits respectés (aucune écriture dans gemini-insight, gemini-cron, gemini-cache.ts, ecosystem.config.js).

## Gates
- `npx tsc --noEmit` → 0 erreur
- `npx eslint` sur les 4 fichiers modifiés/créés → 0 erreur

## Tests manuels suggérés
1. Lancer `bun run dev` → onglet Basketball affiche les matchs NBA/WNBA avec ΔElo ; onglet CS2 affiche les matchs BSD avec ranks HLTV ; badge Darts grisé « Bientôt ».
2. Cliquer une ligne du tableau « 10 prochains matchs » tennis → dialog de détail tennis s'ouvre ; ESC le ferme.
3. Couper l'API (ex. retirer BSD_API_KEY du .env) → onglet CS2 affiche « Impossible de charger les données CS2 » au lieu de disparaître.
