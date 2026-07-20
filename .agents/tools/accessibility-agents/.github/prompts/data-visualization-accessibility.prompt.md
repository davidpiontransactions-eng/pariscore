---
name: data-visualization-accessibility
description: Audit chart, graph, and dashboard accessibility — SVG ARIA, data tables, color-safe palettes
mode: agent
agent: data-visualization-accessibility
tools:
  - askQuestions
  - readFile
  - search
---

# Data Visualization Accessibility Audit

Audit the specified scope for chart, graph, and dashboard accessibility issues using the Chartability framework.

## Input

**Scope:** `${input:scope}`

## Instructions

1. Identify the charting library in use (Highcharts, Chart.js, D3, Recharts, or other) and its accessibility API surface
2. Check every chart for a text alternative — data table, long description, or `aria-label`
3. Audit SVG elements for correct `role`, `aria-label`/`aria-labelledby`, and group structure
4. Test the color palette against color vision deficiency simulations (deuteranopia, protanopia, tritanopia)
5. Verify interactive charts support keyboard navigation (arrow keys, Enter/Space, Escape)
6. Check that chart titles and captions describe the key message, not just the chart type
7. Apply Chartability heuristics for comprehensive evaluation
8. Report findings with WCAG criterion references and remediation guidance
