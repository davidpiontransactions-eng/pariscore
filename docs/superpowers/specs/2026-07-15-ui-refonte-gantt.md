# Gantt Chart — Refonte UI statline 6 métriques

```
Tennis Prematch — Refonte UI statline 6 métriques
═══════════════════════════════════════════════════════════════
            S1        S2        S3        S4        S5        S6
            Décision  CSS       Template  Test      Deploy    Valid
─────────────────────────────────────────────────────────────────
Design
  valider layout  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────
CSS (charte)
  B1 surfrank 9px     ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  B2 prank text2      ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  B3 pelo text3       ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  font-mono valeurs   ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────
Template
  éditer L26100+L26107        ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  validate-css-conventions         ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────
Déploiement
  commit + push                       ░░░░░░░░░░░░░░██████░░░░░░░░░░
  ssh VPS + pm2 restart                            ██████░░░░░░░░░░
  Playwright validation                                      ██████
═══════════════════════════════════════════════════════════════
Durée estimée : ~1h (CSS + template ciblés, pas de refonte globale)
```

> Source JSON : `2026-07-15-ui-refonte-gantt.json`
> Rendu SVG : `python3 scripts/render_gantt.py` (nécessite package `gantt_chart_skill` — non installé)
