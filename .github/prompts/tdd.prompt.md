# TDD (ECC, adapté PariScore)

Cycle RED-GREEN-REFACTOR strict pour tout code neuf ou bugfix.

## Règles

1. **RED** : écrire le test qui échoue d'abord (reproduit le bug ou spécifie la feature).
2. **GREEN** : implémentation minimale pour passer (pas de drive-by refactoring).
3. **REFACTOR** : simplifier, en gardant les tests verts. Tagguer la sur-complexité :
   `delete:` (code mort), `stdlib:` (utiliser stdlib), `native:` (utiliser plateforme),
   `yagni:` (abstraction inutile), `shrink:` (moins de lignes).
4. Bug fix = root cause, pas symptôme : Grep tous les appelants, corriger la fonction partagée une fois.
5. Chirurgical : toucher uniquement ce qui est nécessaire à la demande.

## Verify

`bun run lint` + `bun run typecheck` : 0 erreur avant de clamer fini.
