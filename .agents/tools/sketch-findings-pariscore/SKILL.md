---
name: sketch-findings-pariscore
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments for PariScore premium dark redesign. Auto-loaded during UI implementation.
---

<context>
## Project: ParisScorebis (PariScore)

Refonte premium dark de l'interface PariScore — charte #0b0e17 (fond), #131722 (surface), #00e676 (vert accent), #0077ff (bleu accent). Validation visuelle sur 3 composants critiques : spider chart de comparaison, modal d'analyse tennis (20+ metriques), et barre de navigation (18 sports).

Sketch sessions wrapped: 2026-06-17
</context>

<design_direction>
## Overall Direction

**Palette**: Dark premium monochrome avec accents neon (#00e676 / #0077ff). Fond principal #0b0e17, surface secondaire #131722. Texte primaire #e8eaed, secondaire #94a3b8.

**Typographie**: DM Mono pour les donnees/chiffres/metrics, Instrument Sans pour l'UI et les titres. Tailles minimum 10px (jamais en dessous).

**Spacing**: Grille 8px (4, 8, 12, 16, 24). Border-radius 8px sur les cartes, 4px sur les badges.

**Composants**: SVG pur pour les graphiques (glow neon via feGaussianBlur), grille 3 colonnes pour les tableaux comparatifs, icones vectorielles inline via mask CSS pour la navigation.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Spider Chart | references/spider-chart.md | SVG pur avec feGaussianBlur, zero dependance, glow neon Bleu/Vert |
| Modal Tennis | references/modal-tennis.md | Tableau H2H 3 colonnes, 15+ metriques, header + hero + widget + footer |
| Navbar | references/navbar.md | Scroll horizontal avec icones SVG inline mask CSS, barre active glow verte |

## Theme

The winning theme file is at `sources/themes/default.css`. CSS custom properties: --bg (#0b0e17), --surface (#131722), --green (#00e676), --blue (#0077ff), --font-data (DM Mono), --font-ui (Instrument Sans).

## Source Files

Original sketch HTML files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Sketches

- 001-spider-chart-premium (winner: B — SVG Custom Glow)
- 002-modal-analyse-tennis (winner: A — Tableau H2H)
- 003-navbar-premium (winner: A — Scroll Horizontal)
</metadata>
