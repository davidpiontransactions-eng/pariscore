# F3 — QA + root cause doublons (skill: verification-before-completion)

## Preuves navigateur (prod, avant fix doublons)
- `?sport=football` frais : 5 ligues, 41 lignes, pas de Suivis.
- Follow 2 étoiles → `Suivis / 2/2` **première**, unfollow → `1/1`,
  reload → persistance `1/1`. 0 erreur page, 0 requête 4xx.
- Anomalie relevée (skill : ne pas affirmer sans preuve) : ligne suivie
  visible à la fois en Suivis ET en ligue (`AFC Stoneham`).

## Root cause (pas le composant)
`GET /api/football/calendar` fusionnait `[...live, ...prematch, ...olb]`
**sans dédupliquer** : un fixture présent dans les deux flux BSD (ids
différents) apparaît deux fois. Preuve : unité logique (une seule ligne
Stoneham dans le flux au moment du curl, course au refetch ensuite).

## Fix cause racine (fonction partagée, une fois)
- `dedupeFootballMatches` dans `bsd-football-fetcher.ts` (clé
  `normalizeTeamName`, existant — Le Ladder ; garde noms vides ;
  conserve la 1re occurrence = live prioritaire).
- Appliqué aux routes `football/calendar` ET `football/matches`.

## Vérifications (fraîches, cf. skill)
- `bun test tests/fotmob-follow.test.ts tests/football-calendar-dedupe.test.ts` :
  **8 pass / 0 fail** (RED préalable constaté pour les 2 fichiers).
- `bun run lint` : 0 erreur. `bun run typecheck` : 0 erreur.
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré.
- Re-probe Suivis après deploy : F4.
