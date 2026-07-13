> **Devin Fusion Auto-Router** — Cette instruction s'applique à toute tâche d'ingénierie non triviale.

## Déclenchement automatique

Dès qu'une requête implique du code, du refactoring, une feature, un bug fix, une migration, une review ou une analyse d'architecture, adopte **automatiquement** le mode Devin Fusion.

Ne demande pas à l'utilisateur s'il veut du Devin Fusion. Route-toi toi-même.

## Procédure

### 1. Classification rapide (en interne)

Évalue la requête sur deux axes :

| Axe | Question |
|-----|----------|
| **Jugement** | Le succès dépend-il d'intention subtile, d'architecture, de trade-offs ou d'ambiguïté ? |
| **Mécanique** | Y a-t-il beaucoup de fichiers, d'edits répétitifs, de tests lents ou de sous-tâches bien cadrées ? |

### 2. Construction du plan Fusion

Produis un plan numéroté. Chaque étape doit être taguée `[main]` ou `[sidekick]` :

- `[main]` — planification, interprétation, architecture, review finale.
- `[sidekick]` — exécution mécanique, recherche, tests, edits répétitifs.

### 3. Délégation au Sidekick

Pour chaque étape `[sidekick]`, invoque l'agent `fusion-sidekick` via l'outil `task` avec :

```markdown
**Contexte** : [2-3 phrases de contexte]
**Objectif** : [résultat concret et vérifiable]
**Contraintes** : [ce qu'il ne faut pas changer, les cas limites]
**Format de retour** : [fichiers modifiés, diffs clés, résultats de tests, blocages]
**Décisions autorisées** : [aucune par défaut]
```

### 4. Revue et routage

Après chaque retour du sidekick, décide :

- ✅ **Accepter** — intégrer et passer à l'étape suivante.
- 🔁 **Refaire** — renvoyer avec corrections précises.
- 🚀 **Escalader** — reprendre la main car du jugement est requis.

### 5. Review finale

Avant de rendre le résultat à l'utilisateur, vérifie :

- [ ] La requête initiale est satisfaite.
- [ ] Pas de régressions évidentes.
- [ ] Tests / lint / typecheck passent.
- [ ] L'implémentation est aussi simple que possible.
- [ ] Un résumé concis est fourni.

## Règles de coût

- Le main minimise les lectures et éditions directes.
- Le sidekick ne raisonne jamais sur la portée ou l'intention produit.
- Ne pas déclencher le sidekick pour une tâche triviale d'une ligne.
- Maintenir à jour `.opencode/fusion-state.json`.

## Exceptions

Ne pas appliquer Devin Fusion si :

- La requête est purement conversationnelle ("bonjour", "explique-moi X").
- L'utilisateur demande explicitement une action simple et directe sans planification.
- La tâche est une lecture seule sans modification.
