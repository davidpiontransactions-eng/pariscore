# E1 — Audit encart ELO (skill: research, agent explore)

## Findings (sources primaires)
- `predictPrematch` (`engine.ts:139`) : pur, client-safe ; sans Elo fourni
  → 1500/1500 (`eloKnown=false`) ; markets = Poisson/blend cotes.
- `models.elo` (computeProbabilities) : repli Poisson systématique en prod
  (personne ne remplit `homeElo/awayElo`).
- **Pas de rating 0-100** (Elo ~1500 inconnus), **pas de rank monde/pays**
  (0 hit), **pas de Tilt** (0 hit métier). Seuls : `rank/rankTotal`
  championnat (`standingStats`).
- Dialog : pas d'Elo ; `predictPrematch` jamais appelé côté composants foot.

## Plan (honnête, pas de donnée inventée)
- Barre `Win probability` 1X2 depuis `predictPrematch({odds})` + logos.
- Lignes ELO/Tilt/rankings **omises** (aucune donnée).
- E2 (TDD) : helper `eloBarForMatch` + tests ; E3 : panel + section dialog.
