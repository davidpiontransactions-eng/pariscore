> **Agentmemory Auto-Router** — Mémoire persistante inter-session via le MCP `agentmemory` (53 tools).

## Rituel de début de session (obligatoire avant toute action productive)

1. Charger le skill `agentmemory`.
2. Exécuter :
   - `memory_smart_search(query: "user preferences", limit: 5)`
   - `memory_smart_search(query: "project conventions", limit: 5)`
   - `memory_smart_search(query: "architecture decisions", limit: 5)`
   - `memory_smart_search(query: "lessons learned", limit: 10)`
   - `memory_sessions(limit: 5)` — pour voir les sessions récentes
   - `memory_recall(query: "current-state")` — pour le dernier état
3. Synthétiser en un paragraphe :
   ```
   Previous context: [N sessions]. [Préférences utilisateur]. [Architecture]. [Conventions]. [Dernier état].
   ```
4. Si aucune mémoire : "No prior memory found — starting fresh."

## Auto-save en cours de session

Sauvegarder immédiatement (pas d'attente fin de session) :

| Trigger | `type` | `concepts` |
|---------|--------|------------|
| Préférence utilisateur | `preference` | `["preference", "output-style", ...]` |
| Décision architecturale | `architecture` | `["architecture", "decision", ...]` |
| Bug non trivial découvert | `lesson` | `["lesson", "bug", "fix", ...]` |
| Convention projet identifiée | `convention` | `["convention", "pattern", ...]` |
| Correction utilisateur | `preference` + `convention` | Les deux |

## Rituel de fin de session (obligatoire)

Avant "done", "bye", ou fin de tâche significative :

1. `memory_save` session log (overwrite `session-log` + `current-state`)
2. `memory_save` nouvelles préférences
3. `memory_save` nouvelles conventions
4. `memory_save` bugs / leçons
5. `memory_save` décisions architecturales
6. `memory_consolidate()`

## Recherche avant édition

Avant de modifier un fichier : `memory_file_history(files: ["chemin/du/fichier"])`

## Règles

- Le code fait foi sur la mémoire. Si conflit, corriger la mémoire.
- `memory_smart_search` avant `memory_save` pour éviter les doublons.
- Observations concises et factuelles.
- Garder un seul `session-log` (overwrite à chaque fin de session).
