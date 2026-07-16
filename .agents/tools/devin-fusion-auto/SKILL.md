---
name: devin-fusion-auto
description: Automatically adopt the Devin Fusion multi-agent pattern for any non-trivial software engineering task. Use this skill by default when the user asks to implement, fix, refactor, review, migrate, or analyze code.
---

# Devin Fusion Auto — Orchestration par défaut

## Quand s'activer

S'active automatiquement pour toute tâche d'ingénierie :

- Implémenter une feature, un composant, une API, une migration.
- Corriger un bug.
- Refactorer du code.
- Faire une code review.
- Analyser une architecture ou un problème technique.

Ne pas s'activer pour les questions purement conversationnelles ou les lectures seules sans modification.

## Pattern

Adopte Devin Fusion : deux boucles de raisonnement.

1. **Main loop** — raisonnement frontier. Planifie, interprète l'ambiguïté, délègue, décide, révise.
2. **Sidekick loop** — exécution mécanique. Recherche, édite, exécute des tests, rapporte.

## Procédure automatique

### 1. Classifier la requête

Évaluer :

- **Charge de jugement** : intention subtile, architecture, trade-offs ?
- **Charge mécanique** : nombreux fichiers, edits répétitifs, tests lents ?

### 2. Construire le plan

Plan numéroté. Chaque étape taguée `[main]` ou `[sidekick]`.

Exemple :

```markdown
1. [sidekick] Lister tous les usages de X dans le codebase.
2. [sidekick] Appliquer le refactor décrit ci-dessus.
3. [main] Review du diff pour vérifier les edge cases.
4. [sidekick] Lancer les tests et rapporter les échecs.
5. [main] Résumé final.
```

### 3. Exécuter les étapes sidekick

Pour chaque étape `[sidekick]`, opérer comme le sidekick :

- Lire uniquement le contexte local nécessaire.
- Préférer les outils mécaniques (Read, Grep, Edit, Bash).
- Ne pas prendre de décision architecturale ou produit.
- S'arrêter et demander en cas d'ambiguïté.
- Retourner un rapport structuré.

### 4. Router après chaque étape

- ✅ Accepter et continuer.
- 🔁 Refaire avec corrections.
- 🚀 Escalader vers main si du jugement est requis.

### 5. Review finale main

Vérifier :

- [ ] Requête initiale satisfaite.
- [ ] Pas de régressions.
- [ ] Tests / lint / typecheck passent.
- [ ] Implémentation aussi simple que possible.
- [ ] Résumé concis fourni.

## Fichier d'état

Maintenir `.opencode/fusion-state.json` (ou `.agents/fusion-state.json`) à jour avec le plan, l'étape courante et les décisions.

## Discipline de coût

- Main minimise les lectures/écritures directes.
- Sidekick ne raisonne pas sur la portée ou l'intention.
- Pas de sidekick pour les tâches d'une ligne.
- Découper les grosses tâches sidekick en morceaux vérifiables.
