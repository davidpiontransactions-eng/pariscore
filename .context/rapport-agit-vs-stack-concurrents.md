# Rapport comparatif — agit vs notre stack mémoire vs concurrents

**Date** : 2026-09-26 · **Auteur** : session opencode · **Statut** : analyse documentaire (sources vérifiées via API GitHub le jour même)

---

## 1. Résumé exécutif

**agit** (`agit-stuff/agit`) est un CLI Rust + serveur MCP qui capture le **raisonnement** (pourquoi/comment) parallèlement aux **changements de code** (quoi), en créant un « Neural Graph » miroir de l'historique Git, ancré au niveau **SHA de commit**.

**Verdict en une ligne** : concept élégant et différentiant (ancrage SHA ↔ raisonnement), mais projet **jeune (13★), figé depuis ~6 mois, mono-utilisateur** — et son « gap » revendiqué, nous l'avons **déjà** via `agentmemory` (`memory_commit_lookup` / `memory_commits`). Pas d'adoption recommandée ; 2-3 idées à emprunter.

---

## 2. Fiche d'identité agit (métadonnées vérifiées)

| Attribut | Valeur |
|---|---|
| Repo | https://github.com/agit-stuff/agit |
| Créé le | **2026-01-09** |
| Dernier push | **2026-04-06** — ⚠️ **~6 mois sans activité** |
| Stars / Forks | **13 ★ / 1 fork** (traction quasi nulle) |
| Langage | Rust (modules : cli, core, domain, git, mcp, safety, search, storage, templates) |
| Licences | Dual MIT / Apache-2.0 |
| Commits | 155 |
| Issues / PRs ouverts | 0 / 8 |
| Installation | Homebrew, Scoop (Windows), curl, `cargo install` |
| Soutien | Patreon + « backed by PCD Cooperation » (structure peu identifiable) |

---

## 3. Fonctionnement — « Neural Graph » et « Seamless Echo »

### 3.1 Principe

Git capture le **quoi** (diffs), agit capture le **pourquoi** (intent + raisonnement). Deux graphes en miroir :

- **Git graph** = changements de code dans le temps
- **Neural graph** = raisonnement derrière ces changements, lié SHA ↔ SHA

### 3.2 Stratégie « Seamless Echo » (inversion intéressante)

Le CLI **n'appelle jamais de LLM**. C'est l'**éditeur IA** (Cursor, Claude Code, Windsurf) qui pousse le contexte vers agit via MCP :

1. Utilisateur : « Fixe le bug d'auth » → l'IA log l'intent (`agit_log_step(role="user")`)
2. L'IA planifie → log le plan (`role="ai"`)
3. `git commit` normal → le **post-commit hook** agit synthétise Intent+Plan et crée le **NeuralCommit** lié au commit Git

### 3.3 Stockage — `.agit/` mime les internes de Git

```
.agit/
├── objects/       # content-addressable store (comme .git/objects)
├── refs/heads/   # pointeurs de branches neuraux
└── index          # staging area des pensées
```

`agit init` écrit aussi `.mcp.json`, `.cursor/mcp.json`, et **append** (sans écraser) ses règles dans `CLAUDE.md` / `.cursorrules`.

### 3.4 Outils MCP exposés (source : `src/mcp/tools/`)

| Outil | Rôle |
|---|---|
| `log_step` | Enregistrer une pensée (role, category, content) |
| `get_context` | Récupérer le contexte du commit courant |
| `get_file_history` | Historique de raisonnement par fichier |
| `get_recent_summaries` | Résumés récents |
| `read_roadmap` | Lire la roadmap projet |
| `relevant_context` | Contexte pertinent pour la tâche en cours |

### 3.5 CLI

`agit init` · `agit record` · `agit add` (stage + freeze contexte) · `agit status` · `agit commit` (double commit git + neural) · `agit log` · `agit show` · `agit search` · `agit server` (MCP).

**Résilience revendiquée** : survit à amend/rebase/switch de branche (grâce au stockage content-addressable et aux refs). **Dégradation gracieuse** : si agit est absent, git fonctionne normalement.

---

## 4. Points forts / points faibles

### ✅ Forces
- **Ancrage SHA de commit** — seul du marché vérifié à lier raisonnement ↔ commit exact (les concurrents sont session/workspace-scoped)
- **Zéro friction** : wrapper transparent, `git commit` inchangé, hooks automatiques
- **Zéro LLM dans le CLI** → pas de coût, pas de clé API, pas de latence ; la synthèse est faite par l'agent éditeur
- **Rust + libgit2** : rapide, binaire unique, cross-platform (brew/scoop/cargo)
- **Respect des fichiers existants** (append dans CLAUDE.md, pas d'écrasement) — rare et apprécié
- Architecture propre (domain/core/git/mcp séparés, tests + benches + CI)

### ❌ Faiblesses
- **Projet stagnant** : dernier push 2026-04-06, 13★, 1 fork, 8 PR non mergées → risque abandon élevé
- **Mono-utilisateur, pas de sync équipe** : `.agit/` est local, pas de push d'un « neural graph » distant
- **Recherche probablement lexicale** (module `search` naïf, pas d'embeddings sémantiques documentés)
- **Dépend à la discipline de l'agent** : si l'IA ne loggue pas ses steps, le neural commit est vide
- **Compatibilité éditeurs limitée** : Cursor + Claude Code seulement (pas Codex, OpenCode, Windsurf natifs)
- **Pas de consolidation/résumé LLM** des pensées accumulées — la « synthèse » du commit est un simple assemblage Intent+Plan
- Traction communautaire quasi nulle malgré 8 mois d'existence

---

## 5. Notre « coffre » — la stack context/mémoire de pariscore

| Brique | Rôle | Lien commit Git ? | Recherche |
|---|---|---|---|
| **agentmemory** (MCP) | Actions + dépendances, leases, lessons (confiance/decay), crystals, insights, graphe | ✅ **`memory_commit_lookup` (SHA → sessions agent) + `memory_commits`** | hybride sémantique + mots-clés (`smart_search`), facettes, graphe |
| **ai-memory** (MCP) | Wiki durable (pages .md, 4 tiers working→procedural, TTL, decay, lint), observations de session via hooks, **handoffs** cross-session/cross-agent, messagerie cross-projet | ❌ (scopé session/projet) | FTS5 + entités + graph RRF + vecteur RRF, `as_of` time-travel |
| **claude-mem** | Compression de mémoire inter-sessions (injectée au SessionStart) | ❌ | SQLite + FTS5 (+ vecteurs) |
| **graft** (`graft/`) | Graphe repo markdown, spans file:line exact, `ask`/`callers`/`skeleton` | ❌ (suit git via build) | ranking + grep exhaustif |
| **graphify** (`.graphify/`) | Graphe de connaissances code (god nodes, communautés) | ❌ | query/path/explain |
| **beads (bd)** | Issues dans Dolt DB, sync via ref git `refs/dolt/data` | partiel (lie travail ↔ commits via le workflow) | `bd ready/show` |
| **`.context/`** | Journaux de session manuels (ce rapport y vit) | ❌ | aucun (lecture directe) |
| Hooks/plugins | auto-lint, SessionStart/End handoff auto, ps-loop | — | — |

**Fait clé** : le « gap » qu'agit revendique (ancrage raisonnement ↔ SHA de commit, « nobody does commit-level linking ») — **notre stack l'a déjà**, via `agentmemory.memory_commit_lookup` : SHA de commit → session(s) agent qui l'ont produit, plus `memory_commits` (liste des commits liés aux sessions). Nous avons en plus la consolidation LLM, les lessons à décroissance de confiance, et le multi-outils (wiki + graphe + actions).

---

## 6. Comparatif agit vs notre stack

| Dimension | agit | Notre stack |
|---|---|---|
| Lien raisonnement ↔ commit SHA | ✅ natif, automatique (hook) | ✅ via `agentmemory` (lookup a posteriori, pas de hook) |
| Capture automatique | hook post-commit + MCP `log_step` | hooks lifecycle ai-memory (prompts, tool calls) + beads |
| Synthèse/résumé | assemblage Intent+Plan (pas de LLM) | ✅ consolidation LLM (ai-memory, crystals, reflect) |
| Recherche | lexicale (`agit search`) | ✅ hybride FTS + entités + graphe + vecteurs |
| Dépendances de tâches / workflow | ❌ | ✅ actions + frontier + leases + sentinels |
| Handoff inter-session/agent | ❌ | ✅ handoffs + messagerie inter-projet |
| Multi-agents / équipe | ❌ (local, mono-utilisateur) | ✅ (mesh sync, signals, team feed) |
| Rémanence hiérarchisée | ❌ (tout garde pour toujours) | ✅ 4 tiers + decay + TTL + lint |
| Langage | Rust (binaire isolé) | TS/Python/CLI hétérogène (plus lourd à maintenir, mais déjà installé et actif) |
| Maturité projet | 13★, figé 6 mois | outils actifs (ai-memory, claude-mem très actifs) |
| Friction d'adoption | quasi nulle (`agit init`) | déjà en place |

### Ce qu'agit fait de mieux que nous
1. **L'automatisation du lien SHA** : chez nous, le commit↔session existe mais n'est pas matérialisé par un hook — il faut interroger `memory_commit_lookup`. agit l'écrit **dans le flux du commit**, sans action.
2. **Zéro-config MCP** : `agit init` génère `.mcp.json` auto — nous le faisons à la main.
3. **Stockage git-like content-addressable** (.agit/objects) : résiste nativement à amend/rebase, vérifiable, diffable.

### Ce que nous faisons de mieux
Tout le reste : consolidation LLM, recherche hybride, hiérarchie de rémanence, workflow (actions/leases), handoffs, multi-agents, communauté outillage actif.

---

## 7. Paysage concurrentiel (vérifié 2026-09-26)

| Projet | Stars | Langue | Pitch | Lien commit ? | Recherche | Maturité |
|---|---|---|---|---|---|---|
| **agit** | 13 | Rust | Neural graph miroir de Git | ✅ SHA | lexicale | figé depuis 04/2026 |
| **claude-mem** (thedotmack) | **94,7k** | TS | Mémoire persistante multi-IDE (Claude Code, OpenCode, Codex, Gemini…) via hooks | ❌ | SQLite + FTS5 + **Chroma** (hybride) | très actif (push quotidien) |
| **Aider** (Aider-AI) | 49,2k | Python | Pair-programmeur git-native, auto-commits `aider:` | ❌ (chat historique gitignoré) | — | ralentit (05/2026) |
| **Serena** (oraios) | 29,8k | Python | « IDE pour l'agent » — toolkit sémantique LSP (code, pas raisonnement) | ❌ | symboles LSP | actif (09/2026) |
| **ConPort** (GreatScottyMac/context-portal) | 768 | Python | MCP memory bank, graphe de connaissances par workspace | ❌ | FTS5 + **embeddings** | refroidit (01/2026) |
| **projectmem** (riponcm) | 834 | Python | Enregistre issues/tentatives/fixes/décisions, avertit avant de répéter un échec | non vérifié | MCP local | actif (09/2026) — **plus proche chevauchement fonctionnel** avec le raisonnement d'échec/réussite |
| **memorix** (AVIDS2) | 808 | — | Couche mémoire MCP cross-agents | ❌ | — | actif |
| **GitMemo** (sahadev) | 61 | TS+Rust | Capture locale git-native vers un **repo de connaissances séparé** | ❌ (repo séparé) | FTS | petit |
| **memori** (Maan2003) | — | — | **Supprimé/privé (404)** — un MemoriLabs/Memori (16,9k★) existe sans lien de filiation confirmé | — | — | disparu |

**Note** : le repo viral « GitMemos / gitmemo.io » (HN ~10/2025) est **introuvable** aujourd'hui (404) — probablement renommé ou retiré.

**Trous de marché confirmés** : aucun concurrent vérifié n'ancre la mémoire au SHA de commit comme agit ; et agit n'a ni consolidation LLM, ni embeddings, ni équipe.

---

## 8. Recommandations

1. **N'adopte pas agit** : redondant avec agentmemory/ai-memory, projet dormant, mono-utilisateur, et le gain réel (hook SHA automatique) est mince chez nous puisque `memory_commit_lookup` existe déjà.
2. **Emprunte l'idée du hook** : un petit post-commit hook qui journalise `SHA + message + session` vers agentmemory rendrait notre lien commit↔session **automatique et bidirectionnel** (~30 lignes, zéro dépendance). Candidat bead : `feat(memory): post-commit hook agentmemory`.
3. **Emprunte le stockage content-addressable** si un jour nous matérialisons un « neural graph » local : diffable, resilient à rebase, greppable.
4. **Surveille projectmem** (834★, actif, MIT) : son angle « avertir l'agent avant qu'il répète une tentative échouée » est complémentaire de nos lessons agentmemory — inspiration pour `memory_lesson_recall` automatique au `bd ready`.
5. **Référence concurrentielle** : pour toute question « mémoire/agent », claude-mem (94,7k★, hybride Chroma, cross-IDE) reste l'étalon du segment — nos hooks ai-memory couvrent le même usage.

---

*Sources : API GitHub (repos, contents) + READMEs raw, consultés le 2026-09-26. Recherches concurrents effectuées via API search + vérification directe (les 404 sont explicités).*
