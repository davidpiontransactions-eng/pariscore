---
sketch: "001"
name: spider-chart-premium
question: "Comment rendre les 6 axes radar instantanement lisibles et premium dark ?"
winner: B
tags: [chart, radar, premium-dark, data-viz]
---

# Sketch 001: Spider Chart Premium

## Design Question
Comment afficher un graphique radar de comparaison 6 axes (ELO, PowerScore, Momentum, Niveau, Experience, Efficacite) qui respecte la charte PariScore (#0b0e17, #00e676, #0077ff) et reste lisible sur fond sombre ?

## How to View
open .planning/sketches/001-spider-chart-premium/index.html

## Variants
- **A: Chart.js Radar** — Implementation standard avec fond sombre, grilles ultra-discretes (rgba 0.05), dataset Bleu/Vert. Approche la plus simple a implementer.
- **B: SVG Custom Glow** — Radar en SVG pur avec filtres feGaussianBlur pour un effet neon glow. Zero dependance. Points animes.
- **C: Horizontal Bars** — Abandonne le radar au profit de barres horizontales comparatives. Plus lisible pour les differences fines.

## What to Look For
- Lisibilite des labels sur fond sombre
- Contraste entre les polygones Bleu et Vert
- Clarte des grilles (trop visibles = agressives, trop discretes = inutiles)
- Quel format communique le mieux le desequilibre Auger (80-90) vs Tien (55-65) ?

