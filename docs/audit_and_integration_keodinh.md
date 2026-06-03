# Audit & Plan d'Intégration — KèoĐỉnh.org → PariScore
> Dark Premium Design System v1.0 · 2026-06-03

---

## Étape 1 : Anatomie de KèoĐỉnh.org

### 1. Palette de Couleurs

| Rôle | Couleur | Usage |
|------|---------|-------|
| Fond global | `#060b26` | Corps de page, background profond |
| Fond cartes | `#0b132b` → `#111a36` | Conteneurs sections, panels |
| Texte principal | `#f1f5f9` | Noms équipes, scores, labels clés |
| Texte secondaire | `#94a3b8` | Métadonnées, sous-titres, cotes |
| Accent ambre | `#f59e0b` | Titres de sections (border-left), CTAs, actifs |
| Vert positif | `#22c55e` | Victoires, value bets positifs, sélections actives |
| Rouge accent | `#ed1c24` | Badges LIVE, alertes, accent PariScore conservé |

**Philosophie** : évite le noir pur agressif (`#000`). Le bleu nuit `#060b26` crée une profondeur premium sans fatigue oculaire. Accent ambre systématique comme repère visuel hiérarchique.

### 2. Structure en Blocs (Card-Based Layout)

- Chaque section = conteneur autonome avec `border-radius: 14-16px`
- Bordure ultra-subtile `1px solid rgba(255,255,255,0.03-0.05)` — visible seulement en lumière directe
- Hiérarchie stricte : `fond page (#060b26)` < `fond carte (#111a36)` < `fond header (#0e1525)`
- Séparation par **espace** (gap 16-24px), jamais par ligne de séparation
- Padding interne généreux : 18-24px H / 16-20px V

### 3. Équilibre et Espacement

- Section title pattern : `border-left: 3px solid #f59e0b` + `padding-left: 10px` + `font-weight: 700`
- Typographie sans-serif medium weight pour données statistiques (lisibilité dense)
- Hover sur lignes : `rgba(255,255,255,0.04)` — feedback subtil sans disruption
- Sidebar navigation : dark cards empilées, items `color: #94a3b8` → `#e2e8f0` au hover

---

## Étape 2 : Table Ronde Experts PariScore

### 🎨 Expert UI/UX
> **Verdict** : Basculement complet via tokens `:root`. La ligne d'accentuation verticale orange (`.section-title-premium`) doit remplacer progressivement les `<h2>` actuels. Priority visuellement : filter chips ambre actif > vert pour confirmés value bets. Le sidebar déjà implémenté (dark #0e1525) est cohérent avec la charte.

### 💻 Frontend Developer
> **Verdict** : CSS Grid `280px + 1fr` opérationnel pour Football/Tennis. Tokens `:root` cascadent sur ~95% des éléments. Override block `desktop-filters-flat` remplacé. Radius augmenté `4/6/10 → 8/12/16px` pour cartes plus arrondies. Mobile tokens (bottom nav/sheet) passés en dark navy. **Risques résiduels** : `--cf-*` fallbacks (tennis sheet), inline styles `#ffffff` dans anciens modals.

---

## Étape 3 : Modifications Déployées

### A. Tokens `:root` (pariscore.html)

| Token | Avant (Light) | Après (Dark) |
|-------|--------------|-------------|
| `--bg` | `#f4f6f8` | `#060b26` |
| `--bg2` | `#ffffff` | `#111a36` |
| `--bg3` | `#efefef` | `#0e1525` |
| `--bg4` | `#e4e4e4` | `#1a2548` |
| `--text` | `#111111` | `#f1f5f9` |
| `--text2` | `#4a4a4a` | `#94a3b8` |
| `--text3` | `#888888` | `#64748b` |
| `--amber` | `#b45309` | `#f59e0b` |
| `--green` | `#1a8c45` | `#22c55e` |
| `--red` | `#cc1a1a` | `#f87171` |
| `--blue` | `#1558d6` | `#60a5fa` |
| `--border` | `rgba(0,0,0,0.09)` | `rgba(255,255,255,0.06)` |
| `--border2` | `rgba(0,0,0,0.16)` | `rgba(255,255,255,0.12)` |
| `--radius` | `4px` | `8px` |
| `--radius-lg` | `6px` | `12px` |
| `--radius-xl` | `10px` | `16px` |
| `--psm-bn-bg` | `rgba(255,255,255,0.78)` | `rgba(11,19,43,0.92)` |
| `--psm-bs-bg` | `rgba(255,255,255,0.96)` | `rgba(14,21,37,0.98)` |

### B. Override Block `desktop-filters-flat` → Dark

- Filter chips inactifs : `#1a2548` bg, `#94a3b8` text, border `rgba(255,255,255,0.08)`
- Active : ambre `rgba(245,158,11,0.15)` bg, `#f59e0b` text
- Hover : `rgba(255,255,255,0.06)` bg
- Panel dropdown : `#0e1525` bg, ombre noire profonde
- Options sélectionnées : vert `rgba(34,197,94,0.12)`
- Confidence card : dark `#1a2548`, slider thumb ambre

### C. Nouvelles Utilities CSS

```css
.section-title-premium {
  border-left: 3px solid #f59e0b;
  padding-left: 10px;
  font-weight: 700;
}
.match-row:hover { background: rgba(255,255,255,0.04) !important; }
.tn-vb-row:hover { background: rgba(255,255,255,0.04) !important; }
```

---

## Zones Résiduelles à Traiter

| Zone | Statut | Action |
|------|--------|--------|
| `--cf-*` tokens tennis mobile sheet | ⚠️ Fallbacks `#ffffff` hardcodés | Session suivante — définir dans `:root` |
| Modales football (`#insights-modal`) | ✅ héritent `var(--bg2)` darkened | OK |
| CS2 HLTV theme | ✅ déjà dark, indépendant | OK |
| `rg-pc-card` Roland Garros aside | ✅ `position:fixed`, style propre | OK |
| Nav bar | ✅ hérite `var(--bg2)` | OK |
| Inline `#ffffff` dans anciens blocs | ⚠️ Quelques occurrences | Audit ciblé si visible |

---

## Résumé Commit

```
feat(ui): Dark Premium theme — KèoĐỉnh × PariScore

- :root tokens basculés light → dark (#060b26 / #111a36 / #0e1525)
- Radius augmenté 4/6/10 → 8/12/16px
- Mobile nav/sheet tokens dark navy
- desktop-filters-flat: filter chips + dropdowns + conf dark
- .section-title-premium border-left ambre
- .match-row/.tn-vb-row hover rgba(255,255,255,0.04)
```
