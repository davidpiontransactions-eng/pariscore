# Éval Repo — ruvnet/ruflo vs PariScore

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Repo cible** : https://github.com/ruvnet/ruflo
**Verdict** : ❌ **NO-GO** (dev tooling agents — pas un modèle prédictif sportif)

---

## 1. Ce qu'est le repo (verbatim)

> "Ruflo (formerly Claude Flow) is an **agent orchestration and development tooling framework**, not an ML or sports-prediction model. It's described as 'the leading agent meta-harness for Claude'."

> "One `npx ruvflo init` gives Claude Code a nervous system: agents self-organize into swarms, learn from every task, remember across sessions."

**Traduction** : framework d'orchestration multi-agents IA (swarm, MCP server, vector DB AgentDB/HNSW, federation cross-machine, RAG). C'est de l'**outillage dev pour piloter des agents**, pas un prédicteur de matchs.

---

## 2. Extraction (modèle / features / data / métriques)

| Champ attendu | Trouvé |
|---|---|
| **Modèle / algo** | ❌ AUCUN modèle prédictif sportif. "Intelligence system (SONA learning patterns)" = coordination d'agents, pas un classifier match. Zéro Poisson/Elo/layers/loss pour prédire un résultat. |
| **Features / target** | ❌ N/A. Pas de prédiction de match. |
| **Données** | Aucun dataset sportif. Vector DB pour mémoire agents (RAG). |
| **Métriques** | ❌ Aucune (accuracy/Brier/ROI/calibration). Rien à calibrer côté prédiction. |
| **Stack** | TypeScript 86% / JS 7.6% / Rust 0.6% / Svelte. MCP server + plugin marketplace (33 plugins) + AgentDB HNSW. |
| **Licence** | ✅ **MIT** (RuvNet). Pas de flag legal. |

---

## 3. Analyse vs PariScore

| Critère | Verdict |
|---|---|
| **Edge marché réel** | ❌ N/A — ne prédit rien, ne touche aucune cote. Aucun edge value-bet. |
| **Calibration / UQD** | ❌ N/A — pas de proba. |
| **Redondance vs existant** | N/A — domaine orthogonal (orchestration agents ≠ moteur math Poisson/Elo). |
| **Features inédites** | ❌ Rien pour `buildMatchRecord`. |
| **Compat stack** | 🔴 Anti-pattern produit : TS + Rust + vector DB + MCP federation. PariScore = Node vanilla zero-dep sauf better-sqlite3. Intégrer ça dans le produit = explosion deps. |
| **Légalité** | ✅ MIT OK (mais moot — rien à incorporer côté produit). |
| **Leçons passées** | Confirme : 4e cible /eval-repo hors-scope (booking-converter, sportradar, maintenant ruflo). Outil dev, pas modèle. |

---

## 4. Recommandation GM — ❌ NO-GO (produit)

1. **Hors mission produit** : `/eval-repo` évalue des **modèles prédictifs** à incorporer dans le moteur edge PariScore. ruflo = harness d'orchestration agents pour le *workflow de dev*. Zéro intersection avec Poisson/Elo/value-bet. Rien à extraire pour `buildMatchRecord`.
2. **Anti-stack produit** : TS/Rust/MCP/vector-DB incompatible avec la contrainte Node zero-dep du serveur PariScore. L'injecter dans le produit violerait la règle archi.
3. **Pas de données, pas de métriques** : aucun dataset, aucune calibration. Inéligible à la règle CLAUDE.md "pas de prod sans IC".

**Nuance (hors produit)** : MIT + outil d'orchestration agents → *pourrait* servir de **tooling de développement** (piloter des sub-agents pour coder PariScore plus vite), au même titre que superpowers/GSD déjà installés. Mais c'est une **décision outillage dev perso**, distincte de l'incorporation produit, et ça chevauche ce que tu as déjà (Workflow tool, GSD, dmux, superpowers). Risque : sur-outillage. À évaluer hors `/eval-repo` si intérêt.

**Effort incorporation produit** : N/A — rien à intégrer.

---

Attente : ton GO/NO-GO.
