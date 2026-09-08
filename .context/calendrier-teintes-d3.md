# D3 — Restyle light prematch (skill: implement)

## Changement (1 seul point, pas de retouche classe par classe)
Branche prematch du dialog : surcharge locale des tokens shadcn en inline
(`style` > `.dark`) avec les teintes FotMob mesurées — `bg #fafafa`,
`card #fff`, ink `#222`, muted `#717171`, bordure `#f0f0f0`,
primary/ring `#00985f`, `colorScheme: light`.
Comparatif, 3 paris, marchés, heatmap basculent en clair sans toucher
leurs classes. Branche live inchangée (scope : blocs cités).

## Vérifications
- `bun run typecheck` : 0 erreur. `bun run lint` : 0 erreur.
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
- Rendu visuel : D4 (probe).
