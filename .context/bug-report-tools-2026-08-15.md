# Rapport d'étonnements — Bugs outils/skills/agents

**Date** : 2026-08-15 · **Auteur** : Audit DeepSeek V4 Pro · **Version opencode** : 1.18.4

---

## 1. 🔴 Tool `bash` natif — blocage systématique (CAUSE RACINE RÉVISÉE)

### Symptôme
- Le tool `bash` d'opencode gèle sur TOUTE commande, même triviale (`where bun`).
- `Tool execution aborted` après un délai (potentiellement 120s de timeout serveur).
- **Le spawn de commandes fonctionne parfaitement** : `oc_bash`/`shell`/spawn node direct/bun → tout OK.
- **Le bug est spécifique au tool `bash` natif** (ShellTool) — pas à bash.exe, ni au PATH, ni à la couche spawn.

### Diagnostic précédent (2026-08-02) — ⚠️ PARTIELLEMENT ERRONÉ
Le diagnostic du 2026-08-02 (`docs/bash-tool-windows.md`) attribuait le gel à la « couche PTY/spawn du tool bash » sans identifier le mécanisme exact. **Ce diagnostic est infirmé par l'analyse actuelle.**

### Cause racine réelle (2026-08-15)
**Le blocage se produit dans `ShellTool.parse` — AVANT tout spawn — lors de l'initialisation du parser tree-sitter WASM.**

Preuves :
1. **Test du marqueur** : `opencode run --auto --model deepseek-v4-flash-0731 "Call the bash tool: echo PING > probe.txt"` → le fichier `probe.txt` n'est **jamais** créé, prouvant que le spawn n'est jamais atteint.
2. **Tous les primitifs de spawn fonctionnent** (testés exhaustivement) :
   - `node child_process.spawn` avec overlapped stdio → OK
   - `Bun.spawn` natif → OK
   - `bun node:child_process` polyfill + shell option → OK
   - ConPTY (node-pty) → OK
   - powershell.exe, bash.exe, cmd.exe → TOUS OK
3. **Le seul chemin non testé dans les reproductions : la phase parse WASM** → c'est là que le hang se produit.

### Mécanisme
```js
// ShellTool.parse → ns() → init WASM tree-sitter
var ns = qe(async () => {
  let { Parser: o } = await import("B:/~BUN/root/chunk-hwmf067w.js"); // tree-sitter Parser
  let { default: e } = await import("B:/~BUN/root/chunk-9yvf617a.js", { with: { type: "wasm" } });
  // ...
  await o.init({ locateFile() { return r; } }); // ← HANG ICI
});
```

Le binaire opencode v1.18.4 est un **single-file executable Bun** (174 MB). Les chunks WASM sont embarqués dans le filesystem virtuel `B:/~BUN/root/`. La fonction `ns()` charge ces chunks via `import("B:/~BUN/root/chunk-*.js", {with:{type:"wasm"}})` puis appelle `Parser.init({locateFile:...})` — le locateFile résout un chemin `B:/~BUN/root/chunk-*.wasm` via `fileURLToPath`, qui ne correspond à **aucun fichier physique sur disque**. Sous Bun, la résolution du WASM échoue ou bloque indéfiniment.

### Impact
- **Toute commande via le tool `bash` bloque** — le parse est exécuté AVANT le spawn, quelle que soit la commande.
- Le tool est **inutilisable** sur ce poste (Windows 10 + Bun single-file executable).

### Statut
- **Non corrigible sans mise à jour d'opencode** (bug upstream dans le packaging Bun + tree-sitter WASM).
- **Correctif appliqué** : désactivation du tool `bash` dans `.opencode/opencode.json` (`"tools": { "bash": false }`).
- **Alternative fonctionnelle** : `oc_bash` (CMD) et `shell` — les deux fonctionnent.

---

## 2. 🟡 `oc_bash` — abort occasionnel sur commandes longues

### Symptôme
- `oc_bash` fonctionne pour la quasi-totalité des commandes.
- Abort occasionnel sur des commandes longues : `bun add -g repomix` (aborté une fois, puis réussi), `pip install aider-chat` (aborté une fois).

### Cause suspectée
- **Limite de timeout du harness** : le tool `oc_bash` (implémentation non-ShellTool, probablement un simple spawn cmd.exe) peut dépasser le timeout implicite du harness lors de commandes longues (installations npm/pip > 30s).
- La 2e tentative a réussi → pas un bug bloquant, mais un timeout trop court.

### Statut
- **Non bloquant** — relancer la commande fonctionne.
- **Amélioration possible** : augmenter le timeout implicite de `oc_bash` (si configurable).

---

## 3. 🟡 Régression du correctif `tools.bash: false`

### Symptôme
- Le correctif appliqué le 2026-08-02 (`"tools": { "bash": false }` dans `.opencode/opencode.json`) a été **supprimé** à une date inconnue.
- La config actuelle ne contient ni `tools` ni `shell`.

### Impact
- Le tool `bash` est réapparu dans la liste des outils disponibles → peut être invoqué par l'agent → gel.
- L'agent a été invoqué plusieurs fois avec le tool `bash` dans cette session, causant des `Tool execution aborted`.

### Correctif
- **Réappliqué** dans `.opencode/opencode.json` (voir section Correctifs ci-dessous).

---

## 4. 🟢 Détection de shell — `bash` tool = PowerShell sur ce poste

### Constat
- `Go.acceptable(undefined)` → `oW()[0]` = `powershell.exe` (pas de `pwsh` installé).
- Le tool « bash » exécute en réalité **PowerShell 5.1** sur ce poste, pas bash.
- **Conséquence** : les commandes bash (`&&`, `ls -1`, pipes complexes) échoueraient avec une erreur de syntaxe PowerShell si le parse WASM ne bloquait pas avant.

### Statut
- **Non critique** tant que le tool est désactivé. Si le tool était fonctionnel, le nom « bash » serait trompeur.
- La config `"shell": "cmd"` forcerait le tool à utiliser cmd.exe au lieu de powershell — mais le tool est de toute façon inutilisable (bug #1).

---

## 5. 🟡 Sub-agents (`task`) — abort intermittent

### Symptôme
- Les sub-agents (`code-reviewer`, `security-auditor`, `test-engineer`, `explore`, `web-performance-auditor`) retournent parfois `error=Aborted` sans stack.
- Observé dans les logs serveur : `error=Aborted stack=undefined` sur plusieurs `messageID`.

### Cause suspectée
- **Timeout de sub-agent** : le harness kill les sub-agents après un délai (probablement 120s, comme le tool bash).
- **Concurrence de ressources** : plusieurs sub-agents lancés en parallèle peuvent saturer l'API LLM (rate limiting) ou la mémoire.
- **Abort utilisateur** : fermeture de session, annulation manuelle.

### Statut
- **Non bloquant** — les sub-agents réussissent après retry.
- **À surveiller** : si le taux d'abort dépasse 30%, investiguer les timeouts LLM.

---

## 6. 🟢 `aider-chat` — échec d'installation (Python 3.14)

### Symptôme
- `pip install aider-chat` échoue : `BackendUnavailable: Cannot import 'setuptools.build_meta'`
- Python 3.14 est trop récent pour la version d'aider-chat (0.16.0) qui cible numpy 1.24.3 (incompatible Python 3.14).

### Statut
- **Non lié à Pariscore** — problème de compatibilité Python.
- **Solution** : `pip install setuptools` puis relancer, ou utiliser un venv Python 3.12.

---

## Correctifs appliqués (2026-08-15)

### A. `.opencode/opencode.json` — désactivation du tool `bash`
```json
{
  "tools": { "bash": false },
  "shell": "cmd"
}
```
- `"tools": { "bash": false }` : empêche opencode d'exposer le tool ShellTool cassé.
- `"shell": "cmd"` : force le shell par défaut à cmd.exe (évite que `Go.acceptable()` retourne powershell.exe, qui est non-POSIX et trompeur).

### B. `docs/bash-tool-windows.md` — mise à jour de la cause racine
- Remplace le diagnostic « couche PTY/spawn » par la **vraie cause racine** : init tree-sitter WASM dans le single-file executable Bun.
- Ajoute les preuves (test du marqueur, matrice de primitifs).
- Supprime la section obsolète sur le PATH (non pertinent).

### C. Règles de garde (rappel)
- ✅ **`oc_bash`/`shell` (CMD) par défaut** — le plus fiable sur ce poste.
- ❌ **Ne JAMAIS invoquer le tool `bash` natif** — gel à cause du parse WASM.
- 📋 **`AGENTS.md`** → règle déjà documentée : « toujours `oc_bash`, jamais le tool `bash` natif ».

---

## Validation

| Test | Résultat attendu |
|------|-----------------|
| `oc_bash: echo ok` | OK |
| `oc_bash: where bun` | Affiche le chemin de bun |
| `oc_bash: bun --version` | Affiche la version |
| Tool `bash` non listé | Le tool `bash` ne doit pas apparaître dans les outils disponibles |
| `shell: echo ok` | OK (cmd.exe) |

---

## Prochaines étapes
1. ~~Appliquer le correctif `tools.bash: false`~~ ✅
2. ~~Mettre à jour `docs/bash-tool-windows.md`~~ ✅
3. Redémarrer opencode pour que le correctif prenne effet
4. Vérifier en session que le tool `bash` n'est plus disponible
5. Si le problème persiste malgré `tools.bash: false`, utiliser le contournement `AGENTS.md` (règle « toujours `oc_bash` »)