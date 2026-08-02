# Diagnostic — L'outil `bash` d'opencode bloque (Windows, PariScore)

**Date** : 2026-08-02 · **Statut** : CAUSE RACINE identifiée = couche PTY/spawn du
tool `bash` d'opencode (PATH corrigé et actif, gel persiste). Correctif appliqué :
tool `bash` désactivé dans `.opencode/opencode.json` (`"tools": { "bash": false }`).

## Symptôme

- L'outil `bash` d'opencode (le tool natif, pas `oc_bash`/`shell`) **gèle indéfiniment** :
  l'appel affiche `$ node ...` puis reste bloqué, et se termine par `Tool execution aborted`.
- Les outils `oc_bash` (CMD) et `shell` fonctionnent parfaitement.
- `AGENTS.md` documentait déjà ce comportement (« Git Bash/MSYS2 freeze ») sans en donner la cause.

## Trace du problème

### 1. `bash` n'était pas résolu par le PATH (résolu — voir §4)

```
> where bash
(rien)   ← ENOENT : aucune entrée bash.exe sur le PATH

> echo %PATH% | findstr git
D:\Program Files\Git\cmd     ← seul le dossier cmd\ de Git est sur le PATH
```

- Git for Windows est installé sur **`D:\Program Files\Git`** (pas `C:\Program Files\Git`).
- Le PATH ne contenait que `D:\Program Files\Git\cmd` — pas `\bin` ni `\usr\bin`,
  donc `bash.exe` n'était jamais trouvé.

### 2. WSL présent mais sans distribution (au moment du diagnostic)

- `wsl.exe` existe dans System32.
- `wsl --list --online` / `wsl -l -v` → aucune distro listée au 1er passage
  (sortie UTF-16 mal décodée par `findstr` — voir §5).
- `wsl bash -lc ...` → exit `4294967295` (0xFFFFFFFF, −1 non signé — erreur, pas de distro).

### 3. `bash.exe` seul fonctionne parfaitement (spawn direct)

Sonde node (`spawn` de `D:\Program Files\Git\bin\bash.exe`) — **6/6 OK** :

| Test | Résultat |
|------|----------|
| `bash -lc 'echo hi'` (pipe, windowsHide) | OK exit=0 |
| `bash --noprofile --norc -c 'echo hi'` | OK exit=0 |
| `bash -lc 'echo hi'` (stdio ignore) | OK exit=0 |
| `bash -lc 'echo hi'` (windowsHide=false) | OK exit=0 |
| `bash -lc 'echo hi'` (MSYS=enable_pcon) | OK exit=0 |
| `cmd /c echo hi` (contrôle) | OK exit=0 |

**Conclusion** : Git Bash n'est PAS intrinsèquement bugué sur ce poste.

### 4. Preuve décisive : le PATH corrigé ne change rien au gel (2026-08-02, nuit)

Après redémarrage d'opencode, le PATH corrigé est **actif et vérifié** :

```
> where bash
D:\Program Files\Git\usr\bin\bash.exe     ← bash résolu !
(User PATH contient bien D:\Program Files\Git\bin;D:\Program Files\Git\usr\bin)
```

Pourtant le probe bash-syntax via le tool `bash` natif gèle **ENCORE**
(`Tool execution aborted`) :

```
echo ok; pwd; ls -1 | wc -l
```

→ **La résolution du binaire n'est PAS en cause.** Le gel vient de la couche
PTY/spawn de l'implémentation du tool `bash` d'opencode sur ce poste
(read-loop ConPTY sur spawn de bash.exe en mode PTY, probable incompatibilité
MSYS2/ConPTY). Le spawn direct via node fonctionne (matrice 6/6 §3) — c'est le
tool lui-même qui est en cause, pas `bash.exe` ni le PATH.

### 5. Piège `findstr` + sortie UTF-16 de wsl

`wsl --list` émet de l'UTF-16LE ; `findstr` ne matche rien → fausse conclusion
« aucune distro ». Vérification fiable via PowerShell :

```
powershell -NoProfile -Command "wsl --list --verbose"
  → NAME: Ubuntu  STATE: Stopped  VERSION: 2
```

→ **Ubuntu WSL2 est en fait déjà installée** ; seul `wsl --install -d Ubuntu` renvoie
  `ERROR_ALREADY_EXISTS` (confirme l'existence).

## Causes racines (mises à jour)

1. ~~`bash` absent du PATH~~ → **REJETÉE** : PATH corrigé et vérifié (§4), gel persiste.
2. **Le tool `bash` natif d'opencode gèle dans sa couche PTY/spawn** — mécanisme
   exact non élucidé (hypothèse : read-loop ConPTY sur spawn de bash.exe en mode
   PTY, incompatible MSYS2). Le spawn direct node fonctionne, le tool non :
   l'implémentation du tool est en cause, pas bash.exe ni le PATH.
3. (Amélioration latérale, pas une cause racine) **Aucun profil de terminal Git
   Bash dans VS Code/Cline** (Git installé sur D:, VS Code ne détecte que
   `C:\Program Files\Git` par défaut).
4. Le process opencode **hérite du PATH au démarrage** : une modification du PATH
   n'est effective qu'après redémarrage d'opencode (l'ENV n'est pas relu à chaud).

## Correctifs appliqués

### A. PATH utilisateur — ajout de Git Bash (APPLIQUÉ et VÉRIFIÉ)

```powershell
$p = [Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path', $p + ';D:\Program Files\Git\bin;D:\Program Files\Git\usr\bin', 'User')
```

Vérifié après redémarrage :
```
where bash  → D:\Program Files\Git\usr\bin\bash.exe
```

### B. WSL — déjà fonctionnel

- Ubuntu WSL2 présente et démarrable : `wsl -d Ubuntu -- echo HELLO_FROM_WSL` → OK.
- Rien à installer ; si une distro manque un jour :
  `wsl --install -d Ubuntu` (admin requis pour l'activation du composant).

### C. VS Code / Cline — profil Git Bash explicite (workspace)

`.vscode/settings.json` (modifié) :
```json
{
  "terminal.integrated.profiles.windows": {
    "Git Bash (D:)": { "path": "D:\\Program Files\\Git\\bin\\bash.exe", "icon": "terminal-bash" }
  },
  "terminal.integrated.defaultProfile.windows": "Git Bash (D:)"
}
```
→ Cline et le terminal VS Code utilisent Git Bash quel que soit le chemin d'install.
(Note Cline : mode Background Exec utilise `COMSPEC`/cmd.exe par défaut — cmd.exe
fonctionne déjà ; le profil ci-dessus couvre le mode VS Code Terminal.)

### D. Correctif final — désactivation du tool `bash` natif (opencode.json)

`.opencode/opencode.json` (modifié) :
```json
{
  "shell": "cmd",
  "tools": { "bash": false },
  ...
}
```

- Clé `tools.bash` **documentée officiellement** (« You can manage the tools an LLM
  can use through the `tools` option ») — pas un hack.
- `oc_bash`/`shell` (CMD) restent actifs et fonctionnels — aucune perte de
  capacité shell.
- ⚠️ La clé `"shell": "cmd"` coexistait déjà avec le gel : elle n'a PAS empêché
  le tool `bash` de geler. Ne pas la présenter comme partie du correctif ; elle
  gouverne le shell par défaut (terminal + tool calls compatibles), pas la
  résolution interne du tool `bash`.
- Si `tools.bash: false` s'avérait inerte (schéma strict), la règle AGENTS.md
  « toujours `oc_bash`, jamais `bash` » reste le garde-fou.

## Validation requise (manuel)

1. **Redémarrer opencode** (relit le PATH utilisateur + la config modifiée).
2. `oc_bash`: `where bash` → doit lister `D:\Program Files\Git\bin\bash.exe`.
3. Le tool `bash` ne doit plus être listé/possible (désactivé) ; vérification
   positive : `opencode debug config` doit montrer `tools.bash = false`, ou
   lister les outils disponibles et constater l'absence de `bash`. Si la clé est
   inerte et qu'il gèle encore, confirmer que la règle « toujours oc_bash » est
   respectée — NE PAS réinvestiguer le PATH.
4. VS Code : ouvrir un terminal → profil « Git Bash (D:) » par défaut ; Cline : workflow
   utilisant bash doit passer.
5. `wsl -d Ubuntu -- echo OK` → `OK` (WSL2 prêt si besoin).

## Nettoyage post-incident

Si une commande `2>nul` a déjà été exécutée dans un vrai Git Bash, un fichier
littéral `nul` a pu être déposé dans le répertoire courant. Balayage one-shot
**scopé** (ne PAS traverser `.next/` — 890 Mo, ~7900 fichiers) :
```
dir /s /b nul src scripts public 2>nul
```
puis supprimer tout fichier trouvé nommé `nul` (résidus MSYS2).

## Règles de garde pour l'avenir (à maintenir dans AGENTS.md)

- ✅ **Utiliser `oc_bash`/`shell` (CMD) par défaut** — le plus fiable sur ce poste.
- ✅ **Ne JAMAIS invoquer le tool `bash` natif** — il gèle (couche PTY/spawn en
  cause, PATH résolu ; le correctif `tools.bash: false` l'exclut de la surface
  d'outils).
- Ne pas lancer `wsl --install` sans vérifier `wsl --list --all` d'abord
  (les sorties UTF-16 trompent `findstr` — utiliser PowerShell).
