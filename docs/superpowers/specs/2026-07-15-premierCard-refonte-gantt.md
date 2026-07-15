# Gantt — premierCard Refonte complète

```
premierCard Refonte complète — bugs + typo + layout + Stratégies
══════════════════════════════════════════════════════════════════════
         R1              R2              R3              R4              R5
         Bugs struct.    Typo 4 tailles  Statline 2lgn   Stratégies      Tests+Deploy
──────────────────────────────────────────────────────────────────────────────────
Structure (fondation)
  B1 fix lookup Map       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  B2 persistance Set      ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  B3 icônes svgIcon       ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
──────────────────────────────────────────────────────────────────────────────────
Typo & Layout
  échelle 4 tailles           ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  hiérarchie Edge/pname       ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  statline 2 lignes               ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  badge surface → header              ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
──────────────────────────────────────────────────────────────────────────────────
Section Stratégies
  renderStrategies 5 piliers                ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  wire API + m.predictive                   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  fallback predictive                            ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
──────────────────────────────────────────────────────────────────────────────────
Tests & Déploiement
  Playwright B1+B2                                            ████████░░░░░░░░
  Playwright typo+Stratégies                                      ████████████░░
  commit + push + VPS                                                 ████████
══════════════════════════════════════════════════════════════════════
Spec: 2026-07-15-premierCard-refonte-complete.md
Aucun travail backend (endpoint strategies + m.predictive déjà existants)
```
