# DeepCode — install + config PariScore

> Source : https://github.com/HKUDS/DeepCode — analysé le 2026-09-03 (voir rapport session).
> Licence : **MIT**. CLI `deepcode-hku` **2.1.0** via `uv tool` (Python 3.12), Desktop Tauri non installé.

## Install (refaire sur nouveau poste)

```cmd
winget install --id astral-sh.uv --exact
uv tool install --python 3.12 deepcode-hku
C:\Users\David\.local\bin\deepcode.exe init
```

`uv tool` isole tout dans `%USERPROFILE%\.local\bin` : **rien dans le repo, rien en prod**.
Config user-privée : `%USERPROFILE%\.deepcode\` (credentials jamais dans l'historique ni le repo).

## Collision de nom (important)

`deepcode` sur le PATH = paquet npm `deepcode@0.1.34` (autre outil, pré-existant).
Toujours le chemin complet : `C:\Users\David\.local\bin\deepcode.exe`.
`%USERPROFILE%\.local\bin` n'est volontairement PAS ajouté au PATH global.

## Providers (vérifié `provider list`)

| Connexion | État | Note |
|-----------|------|------|
| `gemini` | ready | clé auto-détectée de l'env |
| `dashscope` | ready | idem (stack Bailian existante) |
| `ollama` | ready | Ollama local déjà présent — micro-tâches à coût nul |
| `vllm` | ready (base URL) | `http://localhost:8000/v1`, cf. `docs/vllm-local.md`, serveur down = à éviter |
| openrouter/openai/anthropic/deepseek… | credential needed | `provider set <id> --template … --api-key` (prompt masqué) |

Ajout vLLM effectué sans secret : `provider set vllm --api-base http://localhost:8000/v1`.

## Câblage projet (zéro config manuelle, vérifié)

- Instructions : DeepCode lit **`AGENTS.md`** tout seul (équivalent `DEEPCODE.md`).
- Skills : `.claude/skills` (nos junctions) découverts en scope `project` sans migration ;
  `deepcode skill --workspace . list` les montre (`active/project`).
- Scope `user`/`system` : skills globaux + 8 upstream pinnés (review, security…).
- **Frontmatter requis** : `SKILL.md` doit OUVRIR par `---` (`name:` + `description:`,
  pas de `allowed-tools` exotique) sinon statut `invalid`.
  Contre-exemple pré-existant : `impeccable` (`invalid allowed-tools entry`, à corriger à part).

## Ponts Opencode / Cline

- Skill **deepcode-runner** : source `.agents/tools/deepcode-runner/`,
  junctions `.cline/skills/` + `.claude/skills/` + `.agents/tools-active/`
  (donc visible Cline + DeepCode + Opencode). Délégation `exec`/`loop` avec garde-fous.
- **MCP volontairement non activé** : `deepcode mcp serve` existe, mais un serveur MCP
  toujours-on contredit notre budget tokens (<10 MCP). Snippet opt-in :
  ```json
  { "mcpServers": { "deepcode": { "command": "C:\\Users\\David\\.local\\bin\\deepcode.exe", "args": ["mcp", "serve"] } } }
  ```
- Premier run dans le repo : `--trust` (mémorisé, sans Full access). Jamais `--access full-access`
  sans demande explicite.

## Headless (cron / batch)

`deepcode exec "<but>. verify: <check>" --workspace . --access read-only --transcript summary`
et `deepcode loop "<goal>"` / `--resume <session-id>` pour le durable.
Voir `docs/HEADLESS_AND_AUTOMATION.md` upstream pour `schedule`/`automation`.
