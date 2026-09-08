# T2 — Tableau clair `fotmob-calendar-table.tsx`

## Fichier (nouveau)
`src/components/football/fotmob-calendar-table.tsx` — styles inline aux hex
**mesurés** (T1), aucun token PariScore dans ce composant (réplique exacte,
cadre blanc isolé du thème dark).

## Contenu
- `FotmobCalendarTable` : groupes par ligue (live d'abord), `Tout masquer`,
  état vide.
- `FotmobLeagueSection` : carte `#fff` radius 16 / bordure `#f0f0f0`,
  header h-12 `#f5f5f5`, logo ligue ou drapeau, badge `x/y` `#00985f`
  (total : gris `#9e9e9e`, seule approximation — badge total non mesurable
  en live), chevron triangle FotMob, collapse `grid-rows` + `reduced-motion`.
- `FotmobMatchRow` : grille 5 zones, minute `#00985f`, score `#222` 14/500,
  heure `#717171`, noms `#222` 14/400 `truncate`, `tabular-nums`,
  `data-testid` identiques (`livescores-league/match`, `status-score/live/time/reason`).
- `FotmobFollowStar` : SVG pillule 28×16 du sample, câblé `useFollowStore`
  (`category: "match"`), `aria-label` + `aria-pressed` (mieux que `title`
  seul chez FotMob).
- États `FM` (pastille + raison `#717171`) et `MT` rendus si présents
  (feed actuel : rarement fournis — défensif).
- Non repris (pas de donnée) : icônes TV/audio, liens `/fr/matches|leagues`,
  pillules `Groupe X` (`round` constant `"Match"` côté API).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré.
- QA navigateur + gates : T4.
