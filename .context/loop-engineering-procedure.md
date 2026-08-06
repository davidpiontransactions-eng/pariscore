# Loop Engineering — Procédure (retenue 2026-08-04)

Source : https://github.com/cobusgreyling/loop-engineering (Cobus Greyling, 9.8k stars).
Concept central : **"Stop prompting. Design the loop. Get a score."** (Steinberger / Boris Cherny).
Le point de levier n'est plus le prompt individuel mais **le système de contrôle qui orchestre les agents dans le temps**.

## Les 5 building blocks + mémoire

| Primitive | Rôle dans la boucle |
|---|---|
| Automations / Scheduling | Découverte + triage sur une cadence |
| Worktrees | Exécution parallèle isolée (1 worktree par tentative de fix) |
| Skills | Connaissance projet persistante |
| Plugins & Connectors (MCP) | Accès aux outils réels |
| Sub-agents | Split maker / checker (l'implémenteur ne note jamais son propre devoir) |
| **Mémoire / State** | Colonne vertébrale durable hors de toute conversation |

## Anatomie d'une boucle

```
Schedule → Triage → Read/Write STATE → Worktree isolé → Implémenteur
→ Vérifieur (tests + gates) → MCP/Git/Tickets → {Human Gate}
   → safe/allowlist  → Commit/PR/Action
   → risqué/ambigu   → Escale humain avec contexte complet
Puis → loop. Toujours état mis à jour (STATE.md).
```

## Procédure d'application

1. **Pick pattern** : `pattern-picker` (Daily Triage, PR Babysitter, CI Sweeper, Dependency Sweeper, Changelog Drafter, Post-Merge Cleanup, Issue Triage).
2. **Scaffold** : `npx @cobusgreyling/loop init . --pattern <p> --tool <grok|claude|codex|opencode>` → crée STATE.md, LOOP.md, loop-budget.md, loop-run-log.md + imprime Loop Ready score. Pour opencode : scheduling via cron/systemd + `opencode run "prompt" --agent loop-triage`, état dans STATE.md + skills/ en fichiers plats.
3. **Vérifier le coût** : `npx @cobusgreyling/loop cost --pattern <p> --level <L1|L2|L3> --cadence <c>`.
4. **Audit readiness** : `npx @cobusgreyling/loop doctor .` (audit + sync + top 3 actions) ou `loop audit . --suggest`. Score 0-100, ≥80 → suggère harness-foundry.
5. **Gate de merge** : `gate.yaml` avec `denylist` + `autoMergeAllowlist` (clés fixes). `npx @cobusgreyling/loop gate check --action auto-merge --paths ...`. Exit 0 = autorisé, 2 = escale humain.
6. **Circuit breaker (L2+)** : `loop context --check --ledger loop-ledger.json`. Exit 0 = continuer, 2 = escale humain (max itérations, erreur répétée N×, trop d'échecs consécutifs, cap budget). `budget-negotiator` peut demander +20% (jamais auto-raisonné — gate humaine obligatoire).
7. **Run** : Semaine 1 = **report-only (L1), jamais d'auto-fix ni auto-merge**. Lire STATE.md, mettre à jour les priorités, ne pas toucher au code. Graduer L1 → L2 (fix assisté en worktree, verifier APPROVE/REJECT) → L3 (sans surveillance).

## Règles d'or (safety & ops)

- La vérification reste la responsabilité du développeur : les boucles sans surveillance font des erreurs sans surveillance.
- Les tokens explosent avec les sub-agents + longues boucles → budget + run-log.
- **Dette de compréhension** : lire ce que la boucle produit (vérifier les diffs, pas juste "presser go").
- Ne jamais pusher sans PR draft + review humaine explicite sur les chemins denylistés.
- Deux personnes peuvent exécuter la même boucle avec des résultats opposés.
- Pause : désactiver cron/timer ou `loop-pause-all` dans STATE.md.

## Outils CLI (`npx @cobusgreyling/loop-*`)

- `loop` (front door) : init | doctor | status | audit | cost
- `loop-audit` : Loop Readiness Score CLI
- `loop-init` : scaffold starters + budget/run-log + constraints
- `loop-cost` : estimateur tokens
- `loop-sync` : détection de drift STATE.md ↔ LOOP.md
- `loop-context` : mémoire stateful + circuit breaker
- `loop-mcp-server` : lookup runtime patterns/skills/state
- `loop-worktree` : worktrees isolés par tentative de fix + advisory path locks
- `loop-sandbox` : worktree éphémère + capture de patch (repo intact)
- `loop-swarm` : consensus multi-agents (majorité de patches identiques)
- `loop-gate` : enforcement mécanique denylist + auto-merge allowlist
- `loop-action` : GitHub Composite Action pour CI

## Mapping opencode (mon cas)

- Scheduling : cron/systemd → `opencode run "Run loop-triage. Read STATE.md first. Update High Priority and Watch List. No auto-fix in week one." --agent loop-triage`
- Sub-agents opencode : `implementer` (modifications minimales en worktree) + `verifier` (APPROVE/REJECT seulement, voit le diff, n'édite pas).
- État : STATE.md à la racine (template STATE.md.example, gitignoré). **Utiliser bd (beads) comme spine d'état persistant dans ce repo** — c'est l'équivalent local natif (issues dans Dolt DB).
- Règle conservatrice repo : pas de commit/push sans demande explicite.