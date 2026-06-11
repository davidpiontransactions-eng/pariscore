# .context/knowledge/ — Base de connaissance PariScore

Documentation persistante, décisions architecturales, invariants.

## Structure

| Dossier | Contenu |
|---------|---------|
| `architecture/` | Décisions architecturales, data flow, routes |
| `strategies/` | Implémentation des stratégies de pari, calibration |
| `etl/` | Pipelines ETL, sources, mappings |
| `math/` | Modèles mathématiques, formules, calibrations |
| `ops/` | Procédures ops, déploiement, monitoring |

## Règles

- Ne pas dupliquer ce qui est dans CLAUDE.md ou le code
- Préférer `bd remember` pour les notes de session
- Un fichier = un sujet. Liens internes en markdown.
