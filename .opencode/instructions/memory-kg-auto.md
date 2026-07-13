> **Memory KG Auto-Router** — Gère automatiquement la mémoire persistante via le MCP `memory` déjà configuré.

## Rituel de début de session (obligatoire)

Au démarrage de chaque session, avant toute action productive :

1. Charger le skill `memory-kg`.
2. Exécuter :
   - `search_nodes("pariscore")`
   - `search_nodes("architecture")`
   - `search_nodes("conventions")`
   - `search_nodes("bugs")`
   - `search_nodes("user preferences")`
   - `search_nodes("decisions")`
3. Si des entités pertinentes sont trouvées, appeler `open_nodes` pour les lire.
4. Synthétiser en un paragraphe :
   ```
   Previous context: [N sessions trouvées]. [Préférences]. [Architecture]. [Conventions]. [Dernier état].
   ```
5. Si aucune mémoire n'existe, répondre : "No prior memory found — starting fresh."

## Auto-save en cours de session

Sauvegarde immédiatement dans le Knowledge Graph quand l'un de ces événements survient :

| Trigger | Entité | Exemple |
|---------|--------|---------|
| L'utilisateur exprime une préférence | `user-preferences` | "Je préfère les messages courts" |
| Décision architecturale | `pariscore-architecture` | "On utilise Zod pour la validation" |
| Bug non trivial découvert | `pariscore-bugs` | "JWT expiry doit être validé avant payload" |
| Convention projet identifiée | `pariscore-conventions` | "Tous les services sont sous `src/services/`" |
| L'utilisateur corrige une approche | `user-preferences` + `pariscore-conventions` | "Ne pas utiliser de barrel exports" |

## Rituel de fin de session (obligatoire)

Avant la fin de session ("done", "bye", fin d'une tâche significative) :

1. Sauvegarder le log de session dans `pariscore-session-log`.
2. Sauvegarder les nouvelles préférences utilisateur.
3. Sauvegarder les nouvelles conventions.
4. Sauvegarder les bugs / leçons.
5. Sauvegarder les décisions architecturales.

## Recherche avant édition

Avant de modifier un fichier, vérifier s'il a un historique dans le Knowledge Graph :

```markdown
search_nodes("nom-du-fichier")
```

## Règles

- Toujours préférer le code comme source de vérité. Si la mémoire contredit le code, faire confiance au code et corriger la mémoire.
- Éviter les doublons : `search_nodes` avant `create_entities`.
- Garder les observations concises et factuelles.
- Relier les entités entre elles avec `create_relations` quand c'est pertinent.
