# DeepSeek V4 — Anti-Blocage & Optimisation

## Règle d'Or : CMD uniquement

Le shell Bash (Git Bash / MSYS2) **freeze** le processus agent.
Toujours utiliser la syntaxe CMD. Voir la table de traduction dans AGENTS.md.

- ❌ `ls`, `cat`, `grep`, `cp -r`, `rm -rf`, `$VAR`, `2>/dev/null`
- ✅ `dir /b`, `type`, `findstr`, `xcopy /E/Y`, `rmdir /s/q`, `%VAR%`, `2>nul`

## Outil shell : `oc_bash` OBLIGATOIRE, `bash` INTERDIT

Le système expose DEUX outils shell :
- **`oc_bash`** (et `shell`) → utilisent **CMD** ✅ (fonctionnent)
- **`bash`** → utilise **Git Bash** ❌ (freeze)

**Règle : toujours utiliser `oc_bash`, JAMAIS `bash`.** Même pour `git status` / `git push` / `node --check`.

## Contexte : Économiser les tokens

DeepSeek a une fenêtre de contexte plus limitée que Claude.

1. **Réponses courtes** — < 4 lignes texte sauf demande explicite. Pas de préambule.
2. **Un seul bloc d'outils** — Paralléliser les appels, ne pas faire de chatter entre.
3. **Pas de narration** — Annoncer l'intention en 1 ligne, agir, résumer. Voir communication.md.
4. **Chargement skill à la demande** — Ne charger que le skill pertinent, pas tous.
5. **Éviter les globs `**/*`** sur `.next/`, `node_modules/`, `.git/` (890 Mo, 7890 fichiers).

## MCP : Charge minimale

21 serveurs MCP initialement — réduits à 5 dans `.mcp.json` (project_fs, memory, git, agentmemory, context7).
Si un MCP manquant est nécessaire, l'ajouter temporairement et le retirer après usage.
Ne PAS lancer de serveurs MCP lourds (playwright, scrapling, crawl4ai) sans nécessité explicite.

## Anti-Freeze : Timeouts et Recovery

| Situation | Action |
|-----------|--------|
| Commande shell bloquée > 30s | timeouter, vérifier si c'est Bash (→ CMD), réessayer |
| `npx` lent | Ajouter `-y` pour skip la confirmation |
| `copy`/`move` freeze | Utiliser `xcopy` / `robocopy` |
| MCP qui répond pas | Désactiver le serveur, continuer sans |
| Contexte plein | Compaction auto activée, `prune: true`. Attendre la compaction. |

## Erreurs fréquentes Windows

- `copy src dst` → utiliser `copy src dst` (pas de `-f`, fonctionne en CMD)
- `move src dst` → utiliser `move /y src dst`
- Chemins avec espaces → toujours des guillemets : `"C:\Program Files\..."`

## Qualité : Avant de compléter

1. `node --check` sur tout fichier JS/HTML modifié (syntaxe)
2. `bun run lint` si disponible
3. Vérifier que CMD ne freeze pas — ne PAS utiliser Bash
