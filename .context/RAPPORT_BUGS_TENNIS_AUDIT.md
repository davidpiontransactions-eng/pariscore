# Rapport d'Audit Combiné QA + UI/UX — Onglet Tennis
## PariScore · 17 Juin 2026

---

## BUGS CRITIQUES (P0) — 5 bugs

### B1 — CSS Cassée : `}` manquante sur `.tn2-cal-prize`
- **Fichier**: `pariscore.html:22822-22824`
- **Impact**: Toute la CSS après la ligne 22824 parse de façon imprévisible. Les styles du modal tennis sont potentiellement tous corrompus.
- **Fix**: Ajouter `}` après la ligne 22823 (`border-radius: 6px;`), avant `.tn2-cal-matches-btn`.

### B2 — CSS Orpheline hors sélecteur
- **Fichier**: `pariscore.html:22904-22905`
- **Impact**: `border: 1px solid rgba(0, 230, 118, 0.15); }` flotte sans sélecteur parent. Cause un avertissement de parse.
- **Fix**: Supprimer les lignes 22904-22905 (artefact de copier-coller).

### B3 — Élément DOM manquant : `tam-h2h-avg-set`
- **Fichier**: `pariscore.js:6512`
- **Impact**: Le JS référence `document.getElementById('tam-h2h-avg-set')` mais cet élément n'existe PAS dans le HTML. Le score moyen par set en H2H n'est jamais affiché — feature morte.
- **Fix**: Soit ajouter `<span id="tam-h2h-avg-set"></span>` dans le widget H2H, soit supprimer le JS.

### B4 — Race condition : fetch sans AbortController
- **Fichier**: `pariscore.js:6463`
- **Impact**: Ouverture/fermeture rapide du modal → la réponse du 1er fetch peut écraser les données du 2e. Aucun `.catch()` non plus.
- **Fix**: Ajouter `const controller = new AbortController()` et passer `{ signal: controller.signal }` au fetch. Appeler `controller.abort()` dans `closeTennisAnalysisModal()`.

### B5 — Polices illisibles : 8px et 9px sur 7 sélecteurs
- **Fichier**: `pariscore.html:22967,22976,22981,22987,22989,22878`
- **Sélecteurs**: `.tam-surface-badge`, `.tam-round-badge`, `.tam-footer`, `.tam-metric-label`, `.tam-metric-sub`, `.tn2-tm-live`
- **Impact**: Texte illisible sur mobile (en dessous du minimum 10px)
- **Fix**: Passer tous ces sélecteurs à `font-size: 10px`

---

## BUGS MAJEURS (P1) — 8 bugs

### B6 — 8 `getElementById` sans null-check dans le bloc serve/receive
- **Fichier**: `pariscore.js:6720-6770`
- **Impact**: Si un élément HTML est renommé ou supprimé → `TypeError: Cannot set properties of null`
- **Sélecteurs**: `sr1`, `st1`, `rr1`, `rt1`, `sr2`, `st2`, `rr2`, `rt2`
- **Fix**: Ajouter `if (el) { el.textContent = ... }` autour de chaque accès.

### B7 — 4 rangées HTML jamais peuplées (métriques calculées mais jamais affichées)
- **Fichier**: `pariscore.js` (bloc `openTennisAnalysisModal`)
- **Métriques**: TB Record (`h2h-p1-tb-record`), Deciding Set (`h2h-p1-ds-record`), Pressure Index (`h2h-p1-pressure`), BP Ratio (`h2h-p1-bp-ratio`)
- **Impact**: Le serveur calcule ces données (8 requêtes SQL dans le payload), mais le frontend ne les affiche pas. Feature morte.
- **Fix**: Le code JS de population existe mais n'est pas exécuté dans le bon scope. Vérifier l'ordre d'exécution.

### B8 — Couleurs hors charte (5 violations)
- **Fichier**: `pariscore.html` lignes multiples
- | Sélecteur | Couleur actuelle | Charte |
  |---|---|---|
  | Modal background | `linear-gradient(#182030, #0f1622)` | `linear-gradient(#131722, #0b0e17)` |
  | `.tennis-surface-h2h-table` | `#121824` | `#131722` |
  | `.h2h-row-contour` | `#172132` | `#161c2a` |
  | `.tam-cyan` (ELO) | `#22d3ee` | `#0077ff` |
  | Avatar fallback | `#243045` | `#131722` |
- **Fix**: Remplacer chaque couleur par la valeur charte.

### B9 — Police `'Syne'` non conforme à la charte
- **Fichier**: `pariscore.html:22966,22988`
- **Impact**: `.tam-tournament` et `.tam-metric-value` utilisent `font-family: 'Syne'` → doit être `'Instrument Sans'` ou `'Plus Jakarta Sans'`
- **Fix**: Remplacer par `font-family: 'Instrument Sans', sans-serif`

### B10 — `closeTennisAnalysisModal` ne détruit pas le Chart radar
- **Fichier**: `pariscore.js:6820-6829`
- **Impact**: L'instance Chart.js reste en mémoire avec des références DOM. Pression mémoire sous open/close rapide.
- **Fix**: Ajouter `if (window.__tn2RadarChart) { window.__tn2RadarChart.destroy(); window.__tn2RadarChart = null; }` dans `closeTennisAnalysisModal`.

### B11 — `fixBrokenPlayerPhoto` remplace `<img>` par `<span>`, perd le `onerror`
- **Fichier**: `pariscore.js:14830`
- **Impact**: Si le `<span>` de fallback échoue → aucun autre fallback. Perd aussi les références externes à l'`<img>`.
- **Fix**: Garder l'`<img>` et juste changer `src` vers un data URI SVG inline.

### B12 — `initTennisProCharts` — guard pattern fragile
- **Fichier**: `pariscore.js:7960`
- **Impact**: `window._tnProCharts.radar` sans vérifier que `window._tnProCharts` existe
- **Fix**: `if (window._tnProCharts && window._tnProCharts.radar)`

### B13 — `h2h.surface.p1` peut être `null` → affiche "null"
- **Fichier**: `pariscore.js:6507`
- **Impact**: Si un joueur n'a pas de stats surface → affichage "Surface: 3-null"
- **Fix**: Ajouter `(h2h.surface.p1 ?? '?') + '-' + (h2h.surface.p2 ?? '?')`

---

## BUGS MODÉRÉS (P2) — 6 bugs

### B14 — Mobile : `.tennis-surface-h2h-table` padding/margin pas responsive
- **Fichier**: `pariscore.html:23002`
- **Impact**: `padding: 14px` + `margin: 20px 22px 0` → 44px perdus sur mobile 360px
- **Fix**: `@media (max-width:600px) { .tennis-surface-h2h-table { padding: 8px; margin: 12px 8px 0; } }`

### B15 — Mobile : `.h2h-row-contour` grid ne collapse pas
- **Fichier**: `pariscore.html:23019`
- **Impact**: `grid-template-columns: 1fr 1.5fr 1fr` → déborde sur 360px
- **Fix**: `@media (max-width:600px) { .h2h-row-contour { grid-template-columns: 1fr 1fr; } }`

### B16 — Pas de `:focus-visible` sur les boutons interactifs
- **Fichier**: `pariscore.html:22825,22884`
- **Impact**: Navigation clavier sans retour visuel
- **Fix**: Ajouter `:focus-visible { outline: 2px solid #0077ff; outline-offset: 2px; }`

### B17 — Padding hors grille 8px sur `.tn2-tm-pbets-btn`
- **Fichier**: `pariscore.html:22888`
- **Impact**: `padding: 3px 10px` (vertical 3px ≠ multiple de 8)
- **Fix**: `padding: 4px 12px`

### B18 — Border-radius inconsistant sur bouton
- **Fichier**: `pariscore.html:22889`
- **Impact**: `.tn2-tm-pbets-btn { border-radius: 4px }` → devrait être `6px`
- **Fix**: `border-radius: 6px`

### B19 — `parseInt` sans radix dans `fixBrokenPlayerPhoto`
- **Fichier**: `pariscore.js:14825`
- **Impact**: `parseInt(img.style.width)` sans second paramètre (radix). Mineur en ES5+.
- **Fix**: `parseInt(img.style.width, 10)`

---

## RÉSUMÉ

| Sévérité | Count | Impact |
|---|---|---|
| P0 | 5 | CSS cassée, feature morte, race condition, texte illisible |
| P1 | 8 | Null refs, couleurs hors charte, métriques non affichées, memory leak |
| P2 | 6 | Responsive, accessibilité, spacing, cohérence |

**Priorité de correction : B1 → B2 → B5 → B4 → B6 → B8 → B9 → B3 → B7 → B10 → B11 → B12 → B13 → B14-B19**

Le bug B1 (CSS `}` manquante) corrompt tous les styles du modal tennis. C'est le fix #1 absolu.
