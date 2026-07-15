# Gantt — premierCard Refonte complète (mise à jour)

```
premierCard Refonte complète — bugs + typo + layout + Stratégies
══════════════════════════════════════════════════════════════════════
         R1              R2              R3              R4              R5
         Bugs struct.    Typo 4 tailles  Statline 2lgn   Stratégies      Tests+Deploy
──────────────────────────────────────────────────────────────────────────────────
Structure (fondation)
  ✅ B1 fix lookup Map       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ✅ B2 persistance Set      ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ✅ B3 icônes svgIcon       ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
──────────────────────────────────────────────────────────────────────────────────
Typo & Layout
  ✅ échelle 4 tailles           ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ✅ hiérarchie Edge/pname       ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ⬜ statline 2 lignes               ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (restant)
  ⬜ badge surface + mojibake           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (restant)
──────────────────────────────────────────────────────────────────────────────────
Section Stratégies
  ✅ _renderStrategies autonome            ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ✅ fallback m.predictions (API gated)    ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ✅ CSS .sc-strat-* charter                ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
──────────────────────────────────────────────────────────────────────────────────
Tests & Validation
  ✅ Analyse: Scouting Report rendu ✅                    ████████░░░░░░░░░░░░░░
  ✅ Stratégies: vraie section (plus de stub)             ████████░░░░░░░░░░░░░░
  ✅ déployé prod (6fa7b43)                                   ████████░░░░░░░░░░░░
══════════════════════════════════════════════════════════════════════
Commits: 7719b55 (spec) + bd55963 (R1+R2+R4) + 6fa7b43 (strategies autonome)
Restant: R3 statline 2 lignes + cleanup mojibake scoutProfile (cosmétique)
```

## Validation prod (Playwright 15/07)

| Section | Avant | Après |
|---------|-------|-------|
| **Analyse** | "Analyse non disponible." (toujours) | ✅ Scouting Report + stats joueurs + Lecture parieur |
| **Stratégies** | "prochaine version" (stub) | ✅ Victoire modèle + Hold S1 + Aces + Value bet EV |
| **Typo** | 7 tailles (8/9/10/11/13/14/15) | ✅ 4 tailles (11/15 + tokens charter) |
| **Icônes** | `?? Analyse` / `?? Stratégies` (mojibake) | ✅ svgIcon chart/target + é correct |
