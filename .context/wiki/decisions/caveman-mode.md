---
type: decision
slug: caveman-mode
title: ADR — Caveman mode communication LLM agent
status: active
tags: [adr, communication, llm-agent, tokens, efficiency]
updated: 2026-05-22
sources: ["~/.claude/skills/caveman/", "session hooks"]
xref: [[zero-dep-node]]
---

# ADR — Caveman mode communication LLM agent

**Date:** session 22/05/2026 activé. **Statut:** ACTIF (level `full`, persistant).

## Décision

Agent LLM (Claude Opus 4.7) communique en **mode caveman** par défaut tout au long des sessions PariScore. Drop articles + filler + hedging + pleasantries. Fragments OK. Pattern: `[thing] [action] [reason]. [next step].`

## Pourquoi

1. **Token efficiency** — ~75% reduction output tokens utilisateur-facing → $$ saved (Opus expensive)
2. **Signal/noise** — densité info technique haute, pas de remplissage
3. **Speed** — réponses courtes = read time short = dev velocity haute
4. **Style match user** — David préfère terse direct

## Exceptions (auto-clarity drops caveman)

- **Security warnings** — clarté absolue requise
- **Irreversible action confirmations** — pas de fragments ambigus
- **Multi-step sequences** où order fragment risque misread
- **User asks clarification** — repassage normal mode
- **Code/commits/PRs/markdown** — écriture normale (lisible humain)

## Trigger

- Hook startup session affiche `CAVEMAN MODE ACTIVE — level: full`
- User commande `/caveman lite|full|ultra` pour switch
- User commande `stop caveman` / `normal mode` pour off
- UserPromptSubmit hook injecte reminder à chaque tour

## Levels disponibles

| Level | Reduction tokens | Behavior |
|---|---|---|
| `lite` | ~30% | Drop fillers seulement, full sentences |
| **`full`** ✅ active | ~50% | Drop articles + fragments OK + short synonyms |
| `ultra` | ~75% | Maximum compression, abbréviations |

## Patterns appliqués

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

## Boundaries strictes

- Code/commits/PRs: **write normal** (lisibilité team + tools)
- Memory frontmatter + wiki body: **write normal** (artefact durable)
- Bash command output rendering: caveman OK
- User-facing text intermédiaire: caveman OK

## Impact session 22/05

Session 13 commits + 13 wiki pages + 3 mémoires écrits intégralement en code/markdown normal. Updates user-facing réponses en caveman. Estimation ~40-50% reduction output tokens vs mode normal.

## Cohérence philosophie PariScore

Aligné avec [[zero-dep-node]] (minimalisme), pas de remplissage inutile, signal/noise ratio prioritaire.

## Related

- [[zero-dep-node]] — Même philosophie minimaliste

## Changelog

- 2026-05-22: ADR formalisé lors du bootstrap wiki — mode actif depuis session 22/05 startup hook
