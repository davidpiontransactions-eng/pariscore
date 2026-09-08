# G1 — Retrait 3 blocs (skill: caveman)

## Fait
- `page.tsx` : `ModeToggle` masqué si `activeTab === "football"`
  (autres sports inchangés — `headerMode` reste défaut `prematch` côté foot,
  sans effet : branche calendrier pilotée par date).
- `top-multi-sport.tsx` : pills horaires + pills sports rendues seulement si
  `activeSport !== "football"`.
- `caveman-code` : skill absent du registre → repli style terse (docuré ici).

## Vérifications
- `tsc --noEmit` : 0 erreur (JSX équilibré).
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
