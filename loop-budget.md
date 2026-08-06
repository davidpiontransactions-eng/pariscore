# Loop Budget — PariScore Daily Triage (L1)

## Daily caps

| Run | Cap tokens | Cap coût (approx.) | Notes |
|-----|-----------|--------------------|-------|
| Daily Triage (L1) | 150 000 | Bas (report-only) | Un seul run, zéro sub-agent |
| L2 (futur, après checklist) | 400 000 | Moyen | +1 implémenteur en worktree |

## Rules

- Si une exécution atteint 80% du cap quotidien → passer en report-only strict + escalader dans STATE.md.
- **Interdiction de s'auto-ratisser le cap** : seul un humain modifie ce fichier (cf. budget-negotiator policy).
- Réinitialisation : chaque jour à minuit (run log daté).

## Spends (log auto)

| Date | Run | Tokens | Résultat |
|------|-----|--------|----------|