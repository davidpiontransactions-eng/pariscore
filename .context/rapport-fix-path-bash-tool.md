# Rapport de fin de mission — Fix PATH tool bash OpenCode

**Date** : 2026-09-26 · **Bead** : `ParisScorebis-cand` (clos) · **Statut** : ✅ corrigé et vérifié en session

---

## 1. Le bug

```
'"node"' n'est pas reconnu en tant que commande interne ou externe,
un programme exécutable ou un fichier de commandes.
```

Depuis le tool `bash` natif d'OpenCode, **aucune commande externe** ne résolvait :
`node`, `git`, `npm`, `bd`, `findstr`, `where`, `reg`… alors que les MCP (spawn
`node …`) et le plugin `ps_shell` fonctionnaient normalement.

## 2. Diagnostic — cause racine

### Preuves collectées (toutes vérifiables)

| # | Observation | Méthode |
|---|---|---|
| 1 | Tool `bash` : `echo %PATH%` = **`C:\Users\David\.bun\bin`** uniquement | builtin CMD capturé |
| 2 | Tool `bash` : `process.env.PATH` = `C:\Users\David\.bun\bin` (confirmé par écriture de `probe-result.json` via node en chemin absolu) | sonde `.mjs` + effet de bord fichier |
| 3 | MCP `agentmemory` (commande `node C:\…\agentmemory-start.mjs`) **fonctionne** → les spawns MCP héritent d'un PATH complet | tools MCP actifs en session |
| 4 | `bd`/`git` s'exécutent dans `ps_shell` (pas de message « n'est pas reconnu », contrairement aux commandes à guillemets mangées) | sortie ps_shell |
| 5 | PATH réel du registre (HKCU\Environment) : node = `E:\Program Files\nodejs\`, git = `e:\Program Files\Git\cmd\` — **rien sur C:** | `reg query` via bash tool |
| 6 | Doc opencode : `shell` configuré = utilisé aussi pour les tool calls ; pas d'option `env` de substitution de PATH | opencode.ai/docs/config |

### Cause

Le **tool bash natif d'OpenCode (1.18.x, Windows)** spawn `cmd.exe` avec un
environnement **sanitarisé** dont `PATH` est remplacé par le seul répertoire bin
du runtime Bun (`~/.bun/bin`). C'est un comportement du binaire upstream — ce
n'est ni le PATH Windows (registre correct), ni la config projet
(`.opencode/opencode.json` n'a aucune clé `env`), ni le plugin ps-shell
(`env: process.env` complet, cf. `ps-shell.ts:34`).

Conséquence en cascade : `bd.cmd` (npm shim) échoue car il appelle `node` —
introuvable dans `.bun\bin`. Idem pour tout script npm.

### Bugs associés découverts (non corrigés, hors périmètre)

- **ps_shell** : le harness échappe les `"` en `\"` → toute commande avec guillemets
  échoue (`'"E:\…"' n'est pas reconnu`) ; la stdout des exécutables externes
  n'est jamais capturée (même redirigée `> fichier`). Contournement : chemins
  8.3 (`E:\PROGRA~1\…`) et effets de bord fichiers.
- La correction du PATH **ne dispense pas** des règles CMD : le tool bash reste
  CMD (jamais de syntaxe Bash).

## 3. Solution — pourquoi celle-ci est fiable à 100 %

**Shims `.cmd` dans `C:\Users\David\.bun\bin`** (seule entrée PATH garantie du
tool bash), pointant vers les vrais binaires en **chemin absolu**.

Fiable par construction :
1. `.bun\bin` est dans le PATH du tool bash **dans tous les scénarios**
   (PATH sanitarisé = ce répertoire ; PATH complet = il y est aussi, en fin).
2. Les shims ne dépendent d'aucune résolution PATH (chemins absolus en dur).
3. Les processus enfants (npm qui spawn node, git hooks, etc.) héritent de
   `PATH=.bun\bin` → résolvent les mêmes shims.
4. **Aucun effet de bord** pour les terminaux normaux : le PATH utilisateur
   résout les vrais binaires avant `.bun\bin` (ordre du registre).
5. Si upstream corrige le bug, les shims deviennent simplement redondants
   (inoffensifs).
6. Vérifiable **immédiatement en session** (pas de redémarrage requis) —
   contrairement à une modif de config opencode (`env`/`shell` custom) qui
   n'aurait pu être testée qu'après restart, avec risque de casser tous les
   tool calls si la convention d'arguments était mauvaise.

### Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| `env.PATH` dans opencode.json | Non documenté ; et le remplacement de PATH se produit **au spawn du tool**, la surcharge serait probablement écrasée. Invérifiable sans restart. |
| `shell` = wrapper custom | Convention d'appel des arguments non garantie (`/c` ? `-c` ?) → risque de casser TOUS les tool calls. Invérifiable sans restart. |
| Attendre le fix upstream (1.18.32+) | Le TUI courant présente le bug ; délai inconnu. |
| Junctions vers d'autres dirs | CMD cherche les exes directement dans les entrées PATH, pas les sous-dossiers. |

## 4. Livrables

| Fichier | Rôle |
|---|---|
| `scripts/install-bun-shims.cmd` | **Installateur reproductible** (fail-fast sur binaires manquants, variables adaptables en tête). 16 shims : node, npm, npx, git, bd, python, findstr, where, reg, curl, tar, powershell, sqz + déléguants graphify, graft, codegraph. |
| `C:\Users\David\.bun\bin\*.cmd` | Les shims installés (machine locale, hors repo). |
| `AGENTS.md` (section tool bash) | Documentation du bug + du fix + procédure de rejeu pour les sessions futures. |
| `.context/rapport-fix-path-bash-tool.md` | Ce rapport. |
| Beads | `ParisScorebis-cand` **clos** avec le fix en reason. `ParisScorebis-43ai` **créé** (P1) : hook post-commit agentmemory — la tâche précédente, débloquée par ce fix (elle exigeait `git` dans le tool bash). |

## 5. Vérification (exécutée depuis le tool bash, PATH sanitarisé)

```
node --version   → v26.5.0        ✓
git --version    → 2.55.0.windows.5 ✓
npm -v           → 11.17.0       ✓
bd ready         → 34 issues listées ✓
python --version → 3.14.7        ✓
findstr          → OK            ✓
```

## 6. Maintenance

- **Après un déplacement/réinstall de Node, Git ou Python** : éditer les variables
  en tête de `scripts/install-bun-shims.cmd` puis `call scripts\install-bun-shims.cmd`.
- **Ajouter un outil** : bloc 2 lignes dans l'installateur (bootstrap PATH + binaire absolu), cf. section 8.
- Ne jamais éditer les shims à la main sans mettre à jour l'installateur
  (source unique de vérité).

## 7. Reste à faire (recommandations)

1. `ParisScorebis-43ai` — le hook post-commit agentmemory (tâche d'origine de la
   session, maintenant exécutable). **[FAIT — clos, commit bdcf913b lié
   bidirectionnellement à la session]**
2. Signaler le bug upstream (anomalyco/opencode) : bash tool Windows sanitise le
   PATH en `~/.bun\bin` au spawn, écrasant le PATH process.
3. ps_shell : le bug d'échappement des guillemets (`\"`) mérite son propre bead
   (contournement actuel : chemins 8.3 / pas de guillemets).

## 8. Addendum v2 — bootstrap PATH embarqué (2026-09-26, bead `ParisScorebis-gtft`)

### Le problème découvert en production

`bd dolt push` échouait depuis le tool bash (`exit 3` sur `git remote add`)
alors que le même code marchait depuis un terminal normal. Le workaround
(`set PATH=E:\PROGRA~1\Git\cmd;…` manuel) prouvait que seule la résolution de
`git` était en cause.

### Cause racine

`bd` (node) → `dolt` (binaire **Go**, `os/exec.Command("git", …)`) → LookPath
trouve `git.cmd` (shim) dans `PATH=.bun\bin` → l'exécution native Go d'un
`.cmd` (re-parsing cmd.exe des arguments) casse l'appel. Les shims v1 règlent
le premier hop (CMD → outil) mais **pas les spawns imbriqués par des runtimes
non-CMD** (Go, Rust…).

### Fix v2 — fiable à 100 % par construction

Chaque shim devient **2 lignes** :
```cmd
@set "PATH=<vrais dirs: Git\cmd;nodejs;System32;PowerShell;Python;npm;.local\bin;.bun\bin>;%PATH%"
@"<binaire réel en absolu>" %*
```
Tout processus enfant (dolt, npm scripts, hooks git, outils Go/Rust…)
hérite d'un PATH contenant les **vrais `.exe` en premier** — les shims ne
servent plus qu'au premier hop. Aucune récursion possible (les vrais dirs
précèdent `.bun\bin`). Aucun effet de bord en terminal normal (les vrais
binaires sont déjà résolus en premier par le registre).

### Vérification (depuis le tool bash, sans workaround)

```
bd dolt push      → "Push complete."  ✓ (le cas d'échec exact, now fixed)
node --version    → v26.5.0           ✓ (régression OK)
git --version     → 2.55.0            ✓
bd ready          → OK                ✓
```

Maintenance inchangée : rejouer `scripts/install-bun-shims.cmd` (v2) après tout
déplacement de Node/Git/Python.
