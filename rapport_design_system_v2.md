# Rapport Design System V2.0 — Terminal Trading Sportif Premium

> **Date** : 21 mai 2026
> **Document** : `rapport_design_system_v2.md`
> **Auteur** : Lead UI/UX Engineer (PariScore)
> **Périmètre** : `pariscore.html` — onglets `#page-matchs` (Football), `#page-tennis`, `#page-historique`
> **Bd ticket** : `ParisScorebis-70r`
> **Statut** : DRAFT — en attente d'arbitrage DG avant application
> **Règle** : zéro modif logique data/calcul/endpoint. CSS + DOM classes uniquement.

---

## 1. EXECUTIVE SUMMARY

### Constat audit V1
- **2 palettes** (Light + Dark) avec **40 CSS variables totales** (cohérent)
- **1 palette scoped** Historique (16 vars `--dh-*`) découplée du reste
- **19 sites glassmorphism** (`backdrop-filter: blur(6-20px)`) — pas de scale sémantique
- **8 valeurs border-radius** distinctes (3/4/6/8/10/12/14/20px) — semi-anarchique
- **7 font-families** utilisées (Barlow Condensed, Source Sans 3, DM Mono, Inter, JetBrains Mono, Plus Jakarta Sans, Syne) — décorrelées entre tabs
- **1314 inline styles** dans renderMatches/renderTennisValueBets — opportunité massive d'utility classes
- **38 classes `.dh-*`** Historique scope-locked — duplique partiellement les patterns Foot/Tennis

### Verdict
**Le V1 est fonctionnel mais hétérogène**. Le passage V2.0 doit :
1. **Centraliser** la palette en `:root` unifiée (1 source de vérité)
2. **Sémantiser** border-radius et spacing en échelles 4/6/8/12/16/24
3. **Standardiser** glassmorphism en 3 niveaux (light/medium/heavy)
4. **Réduire** font-families à 2-3 maximum (Inter + DM Mono + Syne titres)
5. **Migrer** les inline styles vers utility classes `.cf-*`
6. **Unifier** Historique avec foot/tennis (suppression du scope `--dh-*` isolé)

**Aucun changement de logique data, calcul, endpoint, render flow.** CSS + classes HTML uniquement.

---

## 2. PALETTE V2.0 — TOKENS CENTRALISÉS

### 2.1 Tokens base (root, dark mode actif par défaut)

```css
:root {
  /* ── Backgrounds (Trading Terminal Dark) ── */
  --cf-bg-0:          #020617;  /* deepest — page ground */
  --cf-bg-1:          #0b1220;  /* primary panels */
  --cf-bg-2:          #0f172a;  /* secondary panels */
  --cf-bg-3:          #1e293b;  /* hover/active surfaces */
  --cf-bg-4:          #334155;  /* borders raised */

  /* ── Glassmorphism layers (rgba) ── */
  --cf-glass-light:   rgba(15, 23, 42, 0.55);
  --cf-glass-medium:  rgba(15, 23, 42, 0.78);
  --cf-glass-heavy:   rgba(11, 18, 32, 0.92);
  --cf-glass-border:  rgba(255, 255, 255, 0.08);
  --cf-glass-border-hot: rgba(56, 189, 248, 0.30);

  /* ── Néon accents (data + value + danger) ── */
  --cf-cyan:          #38bdf8;  /* data, info, scoreboard */
  --cf-cyan-soft:     rgba(56, 189, 248, 0.18);
  --cf-cyan-glow:     rgba(56, 189, 248, 0.55);

  --cf-emerald:       #4ade80;  /* value, momentum positif */
  --cf-emerald-soft:  rgba(74, 222, 128, 0.18);
  --cf-emerald-glow:  rgba(74, 222, 128, 0.55);

  --cf-coral:         #ff3856;  /* danger, value négatif, live */
  --cf-coral-soft:    rgba(255, 56, 86, 0.16);
  --cf-coral-glow:    rgba(255, 56, 86, 0.55);

  --cf-amber:         #fbbf24;  /* warning, balance */
  --cf-amber-soft:    rgba(251, 191, 36, 0.16);
  --cf-amber-glow:    rgba(251, 191, 36, 0.55);

  /* ── Tennis surface accents (subtle reflections) ── */
  --cf-surface-clay:  #c97a3f;
  --cf-surface-grass: #16a34a;
  --cf-surface-hard:  #2563eb;

  /* ── Text hierarchy ── */
  --cf-text-strong:   #f1f5f9;
  --cf-text:          #e8eaed;
  --cf-text-muted:    #94a3b8;
  --cf-text-dim:      #64748b;
  --cf-text-faint:    #475569;

  /* ── Spacing scale (8px base) ── */
  --cf-space-1:       4px;
  --cf-space-2:       8px;
  --cf-space-3:       12px;
  --cf-space-4:       16px;
  --cf-space-5:       24px;
  --cf-space-6:       32px;
  --cf-space-7:       48px;
  --cf-space-8:       64px;

  /* ── Border radius scale (sémantique) ── */
  --cf-radius-chip:   4px;   /* badges, chips, micro-tags */
  --cf-radius-btn:    6px;   /* buttons, inputs */
  --cf-radius-card:   8px;   /* cells, small cards */
  --cf-radius-panel:  12px;  /* widgets, sections */
  --cf-radius-modal:  16px;  /* modals, hero cards */
  --cf-radius-hero:   24px;  /* landing, large heroes */

  /* ── Shadows (depth + neon glow) ── */
  --cf-shadow-sm:     0 2px 4px rgba(0,0,0,0.20);
  --cf-shadow-md:     0 8px 24px -12px rgba(0,0,0,0.45);
  --cf-shadow-lg:     0 30px 60px -30px rgba(0,0,0,0.60);
  --cf-glow-cyan:     0 0 14px var(--cf-cyan-glow);
  --cf-glow-emerald:  0 0 14px var(--cf-emerald-glow);
  --cf-glow-coral:    0 0 14px var(--cf-coral-glow);

  /* ── Blur tiers ── */
  --cf-blur-light:    blur(6px);
  --cf-blur-medium:   blur(12px);
  --cf-blur-heavy:    blur(20px);

  /* ── Typography ── */
  --cf-font-sans:     'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif;
  --cf-font-mono:     'DM Mono', 'JetBrains Mono', 'Roboto Mono', monospace;
  --cf-font-display:  'Syne', 'Inter', sans-serif;  /* titres + KPI hero */
  --cf-fw-regular:    400;
  --cf-fw-medium:     500;
  --cf-fw-semibold:   600;
  --cf-fw-bold:       700;
  --cf-fw-black:      800;

  /* ── Transitions ── */
  --cf-ease:          cubic-bezier(.4, 0, .2, 1);
  --cf-dur-fast:      .15s;
  --cf-dur-medium:    .25s;
  --cf-dur-slow:      .4s;
}
```

### 2.2 Light theme override (pour conservation backwards compat)

Si user toggle light : remap les `--cf-bg-*` vers blancs + ajuste contrastes texte. **Recommandation** : déprécier light mode (PariScore = trading terminal = dark only). Économise ~150 lignes CSS de override.

---

## 3. TYPOGRAPHIE V2.0

### 3.1 Réduction à 3 fontes (vs 7 actuellement)

| Rôle | Famille | Poids | Usage |
|---|---|---|---|
| **Display** | `Syne` | 700-900 | Titres pages, KPI hero (e.g. "FOOTBALL", "TENNIS", grands chiffres) |
| **Sans body** | `Inter` | 400/500/600/700 | UI body, labels, navigation, paragraphes |
| **Mono data** | `DM Mono` | 500/700/800 | Chiffres, cotes, scores, badges, EV%, IC90 |

**Déprécier** : Barlow Condensed, Source Sans 3, JetBrains Mono, Plus Jakarta Sans (toutes redondantes avec Inter + DM Mono).

### 3.2 Échelle taille type

```
--cf-fs-xs:   10px   /* badge mono, micro-label */
--cf-fs-sm:   11px   /* chip text, table footer */
--cf-fs-md:   13px   /* body table cell */
--cf-fs-lg:   15px   /* section heading inline */
--cf-fs-xl:   18px   /* card title */
--cf-fs-2xl:  24px   /* page subtitle */
--cf-fs-3xl:  32px   /* hero KPI */
--cf-fs-4xl:  48px   /* landing hero */
```

### 3.3 Letter-spacing tracker

- Mono uppercase labels : `letter-spacing: .12em`
- Display titres : `letter-spacing: .04em`
- Body : `letter-spacing: normal`
- Chiffres tabular : `font-variant-numeric: tabular-nums`

---

## 4. GLASSMORPHISM SCALE (3 niveaux)

| Niveau | Class | Blur | Background | Border | Usage |
|---|---|---|---|---|---|
| **Light** | `.cf-glass-light` | `blur(6px)` | `rgba(15,23,42,.55)` | `rgba(255,255,255,.06)` | Chips, micro-widgets, banners discrets |
| **Medium** | `.cf-glass-medium` | `blur(12px)` | `rgba(15,23,42,.78)` | `rgba(255,255,255,.08)` | Cards, panels, table wrappers — default |
| **Heavy** | `.cf-glass-heavy` | `blur(20px)` | `rgba(11,18,32,.92)` | `rgba(56,189,248,.18)` | Modals, hero panels, deep dives |

**Performance guard** :
- Mobile <768px : downgrade `heavy → medium` via `@media`
- iOS Safari : ajouter `-webkit-backdrop-filter` partout (audit QA flagged 22 sites manquants)

---

## 5. COMPONENT RULES PAR ONGLET

### 5.1 Onglet Football (`#page-matchs`)

**Refonte ligne tableau = widget technologique** :
```css
#vb-body tr {
  background: var(--cf-glass-light);
  border-bottom: 1px solid var(--cf-glass-border);
  transition: background var(--cf-dur-fast) var(--cf-ease),
              box-shadow var(--cf-dur-fast) var(--cf-ease);
  position: relative;
}
#vb-body tr:hover {
  background: linear-gradient(90deg, var(--cf-cyan-soft), transparent 65%);
  box-shadow: inset 0 0 0 1px var(--cf-cyan-soft), var(--cf-shadow-md);
}
#vb-body tr.match-row-live::before {
  /* Pulse néon corail à gauche */
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--cf-coral); box-shadow: var(--cf-glow-coral);
  animation: cfLivePulse 1.6s ease-in-out infinite;
}
```

**Scoreboard digital (col VALUE hero)** :
- Gradient `linear-gradient(135deg, var(--cf-emerald) 0%, var(--cf-emerald) 100%)` pour edge > 5%
- Inset glow `box-shadow: inset 0 0 12px var(--cf-emerald-glow)`
- Mono tabular numbers

**Progress bars** :
- Remplacer `background: #F4F4F4` hardcoded par `linear-gradient(90deg, var(--cf-cyan), var(--cf-emerald))`

### 5.2 Onglet Tennis (`#page-tennis`)

**Reflet contextuel surface** (NOUVELLE micro-interaction) :
```css
/* Halo discret bas de carte par surface */
.tennis-vb-row[data-surface="clay"]::after  { background: radial-gradient(120% 60% at 50% 100%, rgba(201,122,63,.08), transparent 60%); }
.tennis-vb-row[data-surface="grass"]::after { background: radial-gradient(120% 60% at 50% 100%, rgba(22,163,74,.08), transparent 60%); }
.tennis-vb-row[data-surface="hard"]::after  { background: radial-gradient(120% 60% at 50% 100%, rgba(37,99,235,.08), transparent 60%); }
.tennis-vb-row::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  opacity: 0; transition: opacity var(--cf-dur-medium);
}
.tennis-vb-row:hover::after { opacity: 1; }
```

**Scoreboard digital tennis (`.tvb-score-col`)** :
- Background `linear-gradient(180deg, rgba(7,11,20,.92), rgba(15,23,42,.78))`
- Border-radius `var(--cf-radius-card)`
- Inset shadow cyan `box-shadow: inset 0 0 0 1px var(--cf-cyan-soft), inset 0 0 22px -8px var(--cf-cyan-glow)`
- Text cyan `text-shadow: 0 0 8px var(--cf-cyan-glow)`
- Font `var(--cf-font-mono)` tabular

**DR bar (Dominance Ratio)** :
- Gradient progressif réactif à la puissance :
  - DR > 1.20 : `linear-gradient(90deg, var(--cf-emerald), #16a34a)`
  - DR 0.90-1.20 : `linear-gradient(90deg, var(--cf-amber), #d97706)`
  - DR < 0.90 : `linear-gradient(90deg, var(--cf-coral), #b91c1c)`
- Hauteur 6px, inset shadow conditional sur classe `.tn-dr-dom/.tn-dr-bal/.tn-dr-sub`

### 5.3 Onglet Historique (`#page-historique`) — Data Hub Bloomberg-style

**Migration complète des 38 classes `.dh-*` vers tokens globaux** :
- `.dh-card` → `.cf-card .cf-glass-medium`
- `.dh-toggle` → `.cf-toggle`
- `.dh-kpi-strip` → `.cf-stats-strip`
- `.dh-kpi` → `.cf-kpi-tile`
- `.dh-chip` → `.cf-chip`
- `.dh-table` → `.cf-table-data`
- Suppression des 16 vars `--dh-*` (remplacé par tokens globaux)

**Layout Bloomberg-style** :
```css
.cf-stats-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--cf-space-3);
  padding: var(--cf-space-3);
  background: var(--cf-glass-medium);
  backdrop-filter: var(--cf-blur-medium);
  border: 1px solid var(--cf-glass-border);
  border-radius: var(--cf-radius-panel);
}
.cf-kpi-tile {
  display: flex; flex-direction: column; gap: var(--cf-space-1);
  padding: var(--cf-space-3) var(--cf-space-4);
  background: var(--cf-glass-light);
  border-radius: var(--cf-radius-card);
}
.cf-kpi-tile .cf-kpi-label {
  font: var(--cf-fw-bold) var(--cf-fs-xs) / 1 var(--cf-font-mono);
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--cf-text-muted);
}
.cf-kpi-tile .cf-kpi-value {
  font: var(--cf-fw-black) var(--cf-fs-2xl) / 1 var(--cf-font-display);
  color: var(--cf-text-strong);
  font-variant-numeric: tabular-nums;
}
```

**Density max** : `padding: var(--cf-space-2) var(--cf-space-3)` sur cellules table (au lieu du 8px 10px actuel).

**Badges stratégies pilules** :
```css
.cf-chip-strategy {
  display: inline-flex; align-items: center; gap: var(--cf-space-1);
  padding: var(--cf-space-1) var(--cf-space-3);
  font: var(--cf-fw-bold) var(--cf-fs-xs) / 1 var(--cf-font-mono);
  letter-spacing: .10em; text-transform: uppercase;
  background: var(--cf-glass-light);
  border: 1px solid var(--cf-glass-border);
  border-radius: 999px;
  color: var(--cf-text-muted);
}
.cf-chip-strategy.is-active {
  background: var(--cf-cyan-soft);
  border-color: var(--cf-cyan);
  color: var(--cf-cyan);
  box-shadow: var(--cf-glow-cyan);
}
```

---

## 6. SCROLLBARS CUSTOM (universelle)

```css
/* Scope = body global (override .nav-links, #table-scroll, .dh-table) */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--cf-cyan-soft), rgba(56,189,248,.10));
  border-radius: var(--cf-radius-btn);
  border: 1px solid var(--cf-glass-border);
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, var(--cf-cyan), var(--cf-cyan-soft));
  box-shadow: var(--cf-glow-cyan);
}
* { scrollbar-color: var(--cf-cyan-soft) transparent; scrollbar-width: thin; }
```

**Sticky col Match conservée** sur petits écrans :
- Foot : `left: 0` (col 1) + `left: 60px` (col 2) — z-index 2
- Tennis : `left: 0` (col 1) + `left: 90px` (col 2) — z-index 3
- Standardisation via `--cf-sticky-col2-offset: 80px;` (au lieu de 60/90/140 incohérents)

---

## 7. MICRO-INTERACTIONS V2.0

### Pulse néon Live (toutes lignes live unifiées)

```css
@keyframes cfLivePulse {
  0%, 100% { box-shadow: 0 0 10px var(--cf-coral-glow); opacity: 1; }
  50%      { box-shadow: 0 0 22px var(--cf-coral-glow); opacity: .55; }
}
.cf-pulse-live { animation: cfLivePulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cf-pulse-live { animation: none; box-shadow: var(--cf-glow-coral); }
}
```

### Hover row glow doux

```css
.cf-row-trading {
  transition: box-shadow var(--cf-dur-fast) var(--cf-ease),
              transform var(--cf-dur-fast) var(--cf-ease);
}
.cf-row-trading:hover {
  box-shadow: inset 0 0 0 1px var(--cf-cyan-soft), var(--cf-shadow-md);
  transform: translateY(-1px);
}
@media (prefers-reduced-motion: reduce) {
  .cf-row-trading, .cf-row-trading:hover { transition: none; transform: none; }
}
```

---

## 8. UTILITY CLASSES `.cf-u-*` (réduction des 1314 inline styles)

```css
/* Spacing */
.cf-u-p-1 { padding: var(--cf-space-1); }
.cf-u-p-2 { padding: var(--cf-space-2); }
/* … 3 à 6 */
.cf-u-px-3 { padding-left: var(--cf-space-3); padding-right: var(--cf-space-3); }
.cf-u-mt-2 { margin-top: var(--cf-space-2); }
/* … */

/* Text */
.cf-u-text-cyan { color: var(--cf-cyan); }
.cf-u-text-emerald { color: var(--cf-emerald); }
.cf-u-text-coral { color: var(--cf-coral); }
.cf-u-text-mono { font-family: var(--cf-font-mono); font-variant-numeric: tabular-nums; }
.cf-u-text-display { font-family: var(--cf-font-display); font-weight: var(--cf-fw-black); }
.cf-u-text-uppercase { text-transform: uppercase; letter-spacing: .12em; }

/* Layout */
.cf-u-flex { display: flex; }
.cf-u-flex-col { display: flex; flex-direction: column; }
.cf-u-items-center { align-items: center; }
.cf-u-gap-1 { gap: var(--cf-space-1); }
.cf-u-gap-2 { gap: var(--cf-space-2); }

/* Surface */
.cf-u-glass-light  { background: var(--cf-glass-light); backdrop-filter: var(--cf-blur-light); -webkit-backdrop-filter: var(--cf-blur-light); border: 1px solid var(--cf-glass-border); }
.cf-u-glass-medium { background: var(--cf-glass-medium); backdrop-filter: var(--cf-blur-medium); -webkit-backdrop-filter: var(--cf-blur-medium); border: 1px solid var(--cf-glass-border); }
.cf-u-glass-heavy  { background: var(--cf-glass-heavy); backdrop-filter: var(--cf-blur-heavy); -webkit-backdrop-filter: var(--cf-blur-heavy); border: 1px solid var(--cf-glass-border-hot); }

/* Glow */
.cf-u-glow-cyan { box-shadow: var(--cf-glow-cyan); }
.cf-u-glow-emerald { box-shadow: var(--cf-glow-emerald); }
.cf-u-glow-coral { box-shadow: var(--cf-glow-coral); }
```

**Impact estimé** : migration progressive de ~600 inline `background: var(--bg2)` vers `.cf-u-glass-medium` ou similar. Réduction taille HTML ~30 KB.

---

## 9. CHANGEMENTS PRÉVUS (par fichier)

### `pariscore.html`

| Section | Changement | Effort |
|---|---|---|
| `:root` + `body.dark-theme` (l.40-108) | Remplacer par `:root` unifié 60 tokens (V2 section 2) | 1h |
| 19 sites glassmorphism (l.259-3225) | Migrer vers `.cf-u-glass-{light,medium,heavy}` | 2h |
| `#vb-table` styles (l.1305-1599) | Refonte ligne widget tradeur + sticky cols standardisés | 2h |
| `#tennis-vb-table` styles (l.1515-1564, 10014+) | Refonte LCD scoreboard + DR gradient + halo surface | 2h |
| `#page-historique` 38 `.dh-*` classes (l.2821-3267) | Migrer vers `.cf-*` globales, suppression vars `--dh-*` | 4h |
| CF v11.x block (l.10413-10827) | Refactorer pour utiliser nouveaux tokens | 1h |
| Scrollbar global rules | Unifier (suppression 6 rules redondantes) | 30min |
| Sport hub mobile (l.7599-7800) | Reuse nouveaux tokens (déjà partiellement v11.8) | 30min |
| Utility classes injection | Nouveau bloc `<style id="cf-utility">` ~150 lignes | 1h |
| Removal Light mode override (optionnel) | Suppression ~150 lignes `body:not(.dark-theme) ...` | 1h |

**Total effort : ~15h dev** (équivalent ~2 sprints)

### Aucun changement
- `server.js` (zéro touche)
- `leagues_config.json`, `flags_config.json` (zéro touche)
- Render functions JS (`renderMatches`, `renderTennisValueBets`, etc.) — uniquement les classes HTML générées changent

---

## 10. RÈGLES DE LISIBILITÉ "500ms"

Pour atteindre le scan visuel < 500ms sur ligne tableau :

| Règle | Application |
|---|---|
| **3 niveaux saturation max** | Désaturé (text muted) / Standard / Saturé (VALUE+EV). Le 3e attire l'œil |
| **Tabular numbers partout** | `font-variant-numeric: tabular-nums` sur tous chiffres mono. Alignement vertical strict |
| **Letter-spacing labels** | `.12em` uppercase sur labels mono. Hiérarchie typo immédiate |
| **Hover state unique direction** | Inset border cyan + glow + translateY(-1px). Pas d'animations multiples |
| **Live = corail pulse, Value = emerald glow** | Code couleur strict, jamais inversion |
| **Glassmorphism max 12px** sur tables | Heavy 20px réservé aux modals (perf) |
| **Animations parallèles max 2** | Pulse Live + Glow Value. Reste désactivé sur scroll |

---

## 11. PLAN D'EXÉCUTION RECOMMANDÉ

### Phase 1 — Tokens centralisés (3h) ✨ standalone
- Injecter nouveau `:root` 60 tokens
- Ajouter utility classes `.cf-u-*`
- Garder anciennes vars en alias (backwards compat)

### Phase 2 — Foot + Tennis refonte (4h)
- Lignes widget tradeur
- LCD scoreboard tennis
- DR gradient reactif
- Halo surface tennis

### Phase 3 — Historique migration (4h)
- 38 `.dh-*` → `.cf-*`
- Suppression vars `--dh-*` scoped
- KPI tiles Bloomberg-style

### Phase 4 — Polish (4h)
- Scrollbar global unifié
- Anim parallèles audit + `prefers-reduced-motion` complet
- `-webkit-backdrop-filter` Safari fallback partout
- Suppression light mode (optionnel)

### Phase 5 — QA visuelle (2h)
- Test multi-écran (mobile/tablette/desktop/4K)
- Screenshots avant/après
- Validation manuelle DG

**Total effort : ~17h dev étalé sur 2-3 sprints**

---

## ⏸️ EN ATTENTE D'ARBITRAGE DG

**Aucune modification appliquée au code.** Ce rapport est une proposition stratégique.

DG (David) arbitre :
1. ✅ Approche unifiée 60 tokens OR garder les 2 palettes (Light + Dark) existantes ?
2. ✅ Déprécier Light Mode (économie 150 lignes CSS) OR conserver ?
3. ✅ Migration Historique `.dh-*` → `.cf-*` immédiate OR progressive en parallèle ?
4. ✅ Utility classes `.cf-u-*` accepté OR refonte inline strict ?
5. ✅ Quelles phases lancer (1, 1+2, 1+2+3, ALL) ?
6. ✅ Effort 17h dev étalé OR sprint dédié monobloc ?

Sprint design system V2.0 démarre uniquement après "GO" explicite DG.

**Modifications restent dans backlog tant que GO non donné** (per user directive).

---

*Rapport généré le 21 mai 2026 par Lead UI/UX Engineer PariScore.*
*Source de vérité : pariscore.html (30k+ lignes) audit read-only via agent investigator.*
*Aucune modification fichier source pendant audit.*
*Bd ticket : ParisScorebis-70r — reste OPEN jusqu'à GO + application.*
