> **Token Saver Auto-Router** — Active automatiquement les skills de réduction de tokens quand c'est pertinent.

## Règles d'activation

### 1. Mode caveman (réduction des tokens de sortie)

Active le skill `caveman` automatiquement quand l'utilisateur utilise l'un de ces signaux :

- "caveman", "mode caveman", "parle comme un caverne"
- "be brief", "sois bref", "less tokens", "moins de tokens"
- "résumé", "concis", "terse", "compressed"

Par défaut, reste en mode normal. Ne force pas caveman sur les conversations générales.

### 2. Cavecrew pour les subagents (réduction des tokens d'entrée)

Quand tu délègues à un subagent pour une tâche mécanique (recherche, edit, review), préfère les presets `cavecrew` au lieu des subagents verbeux :

- Recherche de code / localisation → `cavecrew-investigator`
- Edit chirurgical ≤ 2 fichiers → `cavecrew-builder`
- Review de diff → `cavecrew-reviewer`

Utilise les subagents verbeux (`Explore`, `Code Reviewer`) seulement quand l'utilisateur demande explicitement des explications longues ou une revue architecturale.

### 3. Caveman-compress (réduction des fichiers mémoire)

Si tu détectes que des fichiers mémoire naturels du projet sont verbeux (`CLAUDE.md`, `AGENTS.md`, `worklog.md`, `README.md` projet > 500 lignes), propose automatiquement :

> "Je peux compresser `CLAUDE.md` avec `/caveman:compress` pour réduire les tokens chargés à chaque session. Tu veux ?"

N'exécute pas sans confirmation car cela modifie un fichier lu à chaque session.

### 4. Compaction stratégique

Quand le contexte devient long (> 20 messages ou > 15k tokens estimés), propose une compaction :

- Résumer les décisions prises.
- Mettre à jour `.opencode/fusion-state.json` si une session Fusion est active.
- Sauvegarder dans la mémoire MCP (`memory-kg`) avant compaction.

## Ce qu'il ne faut PAS faire

- Ne pas activer caveman sur les messages de sécurité, confirmations d'actions destructrices, ou explications pédagogiques.
- Ne pas compresser les fichiers source (`.ts`, `.js`, `.json`, `.yaml`).
- Ne pas déléguer à cavecrew pour des tâches nécessitant du jugement architectural.
