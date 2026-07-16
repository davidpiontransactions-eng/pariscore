# Spider Chart Premium

## Design Decisions
- **SVG pur choisi sur Chart.js** — meilleur controle du glow neon, zero dependance, points animables
- **Filtre feGaussianBlur** pour l'effet glow sur les polygones (stdDeviation=3)
- **Couleurs**: P1 = #0077ff (fill 0.18), P2 = #00e676 (fill 0.12)
- **Grilles**: rgba(255,255,255,0.04) — ultra-discretes, ne distraient pas
- **Labels**: #94a3b8, 9px, uppercase, centes sur chaque axe

## CSS Patterns
```css
/* Grilles du radar */
.radar-grid { stroke: rgba(255,255,255,0.04); stroke-width: 1; }
/* Labels d'axes */
.radar-label { fill: #94a3b8; font-size: 9px; font-weight: 600; }
/* Polygone Joueur 1 - Bleu Electrique */
.radar-p1 { fill: rgba(0,119,255,0.18); stroke: #0077ff; stroke-width: 2; }
/* Polygone Joueur 2 - Vert Neon */
.radar-p2 { fill: rgba(0,230,118,0.12); stroke: #00e676; stroke-width: 2; }
```

## HTML Structures
```html
<svg viewBox="0 0 400 300">
  <defs>
    <filter id="glow1"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <!-- Grilles concentriques (4 niveaux) -->
  <!-- Lignes radiales (6 axes) -->
  <!-- Labels axes -->
  <!-- Polygones P1 + P2 avec filtre glow -->
  <!-- Cercles aux sommets -->
</svg>
```

## What to Avoid
- Grilles trop visibles (rgba > 0.08) → aspect "grille technique" agressif
- Points sans glow → perte de l'effet premium
- Barres horizontales (Variant C) → perdent la vue d'ensemble instantanee du radar

## Origin
Synthesized from sketch: 001
Source: sources/001-spider-chart-premium/
