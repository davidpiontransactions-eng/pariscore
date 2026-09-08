# B3 — UI réplique + clic ligne (skill: impeccable)

## Composant (nouveau)
`besoccer-score-matrix.tsx` : poss-box double (win prob + blason + xG=λ,
domicile ET extérieur — le sample ne montrait que t-1) + grille 10 lignes
(scores `d..10` + marge `+d`), opacité `p/0.15` (scores) / `p/0.25` (marges),
ratios **vérifiés** sur le sample ; texte blanc > 0.5, `#1a1a1a` sinon
(contraste) ; `<0%` sous 0.05% ; `tabular-nums` ; `role="img"` + aria-label.
Vert `#16a34a` (approximation — sample sans couleur mesurable).

## Câblage clic
- `FotmobMatchRow` : `onSelect?` → `role="button"` + clavier + focus ring
  (étoile isolée par `stopPropagation` existant) ; propagé via
  `FotmobLeagueSection` → `FotmobCalendarTable onSelectMatch`.
- `TopMultiSport` : `detailMatch` + `FootballMatchDetailDialog` (cast
  documenté : objets API complets au runtime).
- Dialog : section heatmap après marchés (prematch uniquement), λ/cotes du match.

## Vérifications
- `bun test besoccer-matrix` : 4 pass (dont `awayWin` ajouté).
- `bun run lint` : 0 erreur. `bun run typecheck` : 0 erreur
  (après fix `awayWinPct` → `awayWin * 100`).
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
- QA clic→dialog : B4.
