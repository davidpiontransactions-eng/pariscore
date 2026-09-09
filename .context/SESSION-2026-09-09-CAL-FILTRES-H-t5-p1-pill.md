# Trace T5 — P1 + pill Top Stratégie (SESSION-2026-09-09-CAL-FILTRES-H)

## Livré
- **E1** : `<select>` → segmented `≤1h…≤24h` (`HourSegments`, clic actif = reset, scroll-x mobile, `aria-pressed`).
- **V1** : chip résumé `N matchs · ≤Xh · ★ Top` (`aria-live="polite"`), bureau + mobile.
- **Toggle ★ Top** : filtre calendrier aux matchs corrélés Top10 + badge `topCount`.
- **E pill** (`TopStratPills`) : pastille `emoji Top <label> <valeur>` sous les noms (hors grille 5 col → layout intact), max 2 + `+n` (tooltip détaillé), clic → dialog analyse. Vert `#00985f`/blanc, `+n` en `#007a4c` (G5).
- **Corrélation** (`lib/top10-calendar-link.ts`) : `buildTopTags` (index byId + byNames) + `topTagsForMatch`. Jointure id normalisé d'abord, repli noms `normalizeTeamName` (même fn que `dedupeFootballMatches`). Pas de tag sur live (Top10 = prematch). 1 fetch SWR `useFootballTopN(10, null)` partagé (dedupe 20min → 0 requête extra si widget Top10 monté).
- **F2 URL** : non fait (reporté — `calHours`/`calDate` en `?h=&date=`, même pattern que Top10 `?strat=`).

## Fichiers
- `fotmob-filter-bar.tsx` (E1 + toggle Top), `fotmob-calendar-table.tsx` (`TopStratTag`/`stratTag`/`TopStratPills`/`topTagsFor` prop), `top10-calendar-link.ts` (new), `top-multi-sport.tsx` (SWR + filtre + chip), `__tests__/top10-calendar-link.test.ts` (5 tests).

## Gates
- 5/5 tests pill (id, noms, live exclu, inconnu, undefined). 81 tests existants pass.
- eslint full : timeout runner (préexistant).

## Skill : design-md (E1/V1/pill, style FotMob natif)
