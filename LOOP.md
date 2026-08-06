# Loop Configuration — Daily Triage (Opencode, poste local Windows)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Daily Triage | 1d | L1 report-only | `scripts/loop-triage.bat` via schtasks (Windows Task Scheduler) |

## Contexte PariScore

- Tracker d'issues : **bd (beads)** — `bd ready` liste les tâches prêtes, `bd show <id>` les détails.
- Shell : **CMD uniquement** (jamais Bash — freeze sous Windows). Voir `.opencode/instructions/deepseek-optimisation.md`.
- État persistant : `STATE.md` (spine de la boucle) + `bd` (issues durables). La boucle lit `bd ready`, met à jour `STATE.md`.
- Skills : la boucle utilise `skills/loop-triage/SKILL.md` (racine) — les skills projet sont dans `.opencode/skills/` (junction `.agents/tools-active/`).

## Human Gates

- Semaine 1 : **L1 report-only** — aucun auto-fix, aucun auto-merge. Lire ce que la boucle écrit avant de la laisser agir.
- Tous les chemins à risque exigent une review humaine (voir gate.yaml denylist).
- Ne jamais commiter/pousser sans demande explicite (profil conservateur).

## Worktrees

- L2+ : 1 `git worktree` par tentative de fix, `opencode run --dir <worktree>`, verifier APPROVE/REJECT, discard au REJECT.
- Jusqu'à validation L2 : implémenteur en worktree seulement.

## Connectors (MCP)

- L1 : MCP optionnel. Lire `bd` + git status suffisent.
- L2+ : scoper les connecteurs en lecture seule jusqu'à confiance.

## Budget

- Max sub-agents par run : 0 (L1).
- Si dépense tokens > 80% du cap quotidien → report-only (déjà L1).
- Cap quotidien : voir `loop-budget.md`.

## Scheduling Windows

```cmd
schtasks /Create /TN "PariScore-LoopTriage" /SC DAILY /ST 08:00 ^
  /TR "cmd /c C:\Users\David\ZCodeProject\pariscore\scripts\loop-triage.bat >> C:\Users\David\ZCodeProject\pariscore\loop-run-log.md 2>&1"
```

Logs : `loop-run-log.md` (run-log) · `loop-budget.md` (budget).

## Links

- Pattern: https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/daily-triage.md
- Procédure retenue : `.context/loop-engineering-procedure.md`
