# E2 — Panel Win probability TDD (skill: test-driven-development)

## RED
`tests/elo-bar.test.ts` (2 tests) avant le module → échec (manquant) ✓.

## GREEN
- `src/lib/elo-bar.ts` : `eloBarForMatch()` au-dessus de `predictPrematch`
  (blend Poisson/cotes, normalisé 100). Correctif tsc : objet `odds`
  conditionnel (type strict).
- `besoccer-elo-panel.tsx` : blasons 60px + barre 3 segments + labels
  (vert `#16a34a`/gris/foncé — approximation, sample sans mesure).
  **Honnêteté** : titre `Win probability` (pas `ELO`), lignes ELO/Tilt/
  rankings **omises** (données inexistantes, E1).
- Section ajoutée dans le dialog (prematch, après heatmap).
- `bun test` : **2 pass**. `tsc`/`lint` : 0 erreur.

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
