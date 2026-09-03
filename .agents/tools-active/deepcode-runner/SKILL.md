---
name: deepcode-runner
description: Déléguer un objectif de code au CLI DeepCode en headless (deepcode exec/loop) avec garde-fous PariScore — livre les résultats, jamais de concurrence avec la session en cours
---

# DeepCode Runner — Délégation Headless

DeepCode (HKUDS, MIT, `deepcode-hku` 2.1.0 via `uv tool`) tourne en **headless**
pour les objectifs longs : boucles Goal-driven, audits, E2E. Cette session
(Opencode/Cline) reste le pilote ; DeepCode est l'exécutant isolé.

## Binaire (collision de nom !)

`deepcode` sur le PATH = paquet npm `deepcode@0.1.34` (autre outil).
Toujours appeler le chemin complet :

```cmd
C:\Users\David\.local\bin\deepcode.exe exec --workspace . --access read-only "..."
```

## Règles de délégation

1. **Jamais en concurrence** : DeepCode ne touche pas aux fichiers que cette session édite.
   Préférer `--access read-only` pour audit/exploration, `ask` par défaut sinon.
2. **Un objectif vérifiable** : prompt = but + critères (`verify: ...`), comme AGENTS.md.
3. **Connexions dispos** (`deepcode provider list`) : `gemini`, `dashscope`, `ollama`,
   `vllm` (sans serveur = à éviter). Choisir via `--connection <id>`.
   Toujours passer `--model` explicite : le défaut `openai/gpt-4o-mini` est invalide
   partout (vérifié le 2026-09-03). Pas cher : `--model gemini-3.5-flash-lite`.
   `ollama` exige en plus serveur démarré + modèle pullé (`ollama list`).
4. **Contexte partagé gratuit** : DeepCode lit `AGENTS.md` et `.claude/skills` tout seul.
   Inutile de recopier les conventions dans le prompt. `--skill <nom>` pour forcer un skill.
5. **Sortie exploitable** : `--transcript summary` (défaut sobre) ou `--json` (NDJSON) pour parser.
6. **Session durable** : noter le Session ID retourné ; reprise avec `--resume <id>`.
7. **Premier run** : le workspace doit être trusté (`--trust`, mémorisé, pas de Full access).
8. **Coûts** : chaque run consomme des tokens du provider choisi. Micro-tâches → `ollama`
   local ; jamais de boucle `deepcode loop` sans budget/validation utilisateur.

## Exemples

```cmd
C:\Users\David\.local\bin\deepcode.exe exec --workspace . --access read-only --connection ollama "Auditer les imports non utilisés dans src/lib, sans modifier aucun fichier. verify: liste des fichiers fautifs."
C:\Users\David\.local\bin\deepcode.exe exec --workspace . --transcript summary --skill systematic-debugging "Reproduire puis corriger le bug X. verify: bun run lint + bun run typecheck à 0 erreur."
```

## Ne jamais faire

- `deepcode` sans chemin complet (mauvais binaire npm).
- `--access full-access` sans demande explicite (désactive approvals + sandbox).
- `--workspace` hors du repo courant.
- Committer quoi que ce soit depuis un run DeepCode sans review (`requesting-code-review`).
