# E3 — QA panel (skill: verification-before-completion)

## Preuves navigateur (prod, fraîches)
- Clic ligne prematch → dialog ✓, `Win probability` ✓, barre 1X2
  (`52.0%` domicile…), heatmap 59 motifs ✓, 0 erreur page.
- Deploy `efbabc43` vert (`health` + `smoke` OK) avant la probe.

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
