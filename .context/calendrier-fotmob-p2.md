# P2 — Groupes + Tout masquer (`football-calendar.tsx`)

## Analyse data (décision)
`GET /api/football/calendar` expose bien `round`, mais la valeur est le
placeholder constant `"Match"` (`round_name` BSD vide → fallback
`buildMatch`). Des pillules « Groupe X » afficheraient « Match » partout :
**abandonné** (bruit, pas de valeur). À réactiver quand BSD fournit
`round_name`/`stage` réels.

## Changements
- Repli global façon FotMob : bouton `Tout masquer` / `Tout afficher`
  (au-dessus de la liste, `aria-expanded`), pilote le state `collapsed`
  existant par `leagueId`. FR hardcodé (convention du fichier).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré.
- QA fonctionnelle (toggle global + collapse) : P4.
