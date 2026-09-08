# F4 — Intégration (skill: finishing-a-development-branch)

## Step 1 — Suite verte (pré-requis du skill)
`bun test` ciblés : 8 pass / 0 fail ; suite `tests/` : exit 0
(75 tennis + rapports OK). `bun run lint` : 0 erreur.
`bun run typecheck` : 0 erreur.

## Intégration (trunk-based, choix pré-validé par ordres permanents)
- `c3d3f776` feat Suivis → push → deploy `deploy-20260908-214313` OK.
- `62daed6e` fix dedupe API → push → deploy OK.
- `0c8b3834` fix memo stale → push → deploy `deploy-20260908-220902`
  (`health OK`, `smoke OK`).

## Step 5 — Preuve finale (skill verification, navigateur frais)
Follow 1 étoile : `A: 4 sections/39 lignes` → `B: 5 sections/39 lignes`,
`Suivis / 1/1` première, équipe dans **1 seule** section, total stable,
0 erreur page, 0 requête 4xx.

## Leçons boucle
1. Partition correcte + `useMemo(groups, [matches])` stale → duplication.
   Vrai fix : deps `[rest]` (`0c8b3834`).
2. Fusion live/prematch sans dédupe (`62daed6e`) : durcissement valide
   (course de refetch), gardé.
3. `bunx prisma validate` à chaque tâche : schéma valide, 0 migration.
4. `graphify update .` à chaque tâche : graphe à jour.
