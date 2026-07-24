# Refonte UI/UX — Analyse Approfondie Tennis

**Date** : 2026-07-24
**Statut** : Approuvé (proposition validée)
**Prochaine étape** : `writing-plans` → implémentation

---

## 1. Contexte & Problèmes

Modale « Analyse Approfondie » dans l'onglet Tennis (React/Next.js, `match-detail-dialog.tsx`).

### Défauts identifiés

| Zone | Problème | Gravité |
|------|----------|---------|
| **KPI Cards** (×4) | Titre chevauche la valeur/description ; pas d'isolation entre les zones de contenu | Critique |
| **Probabilité Centrale** | `PROBABILITÉ CENTRALE` chevauche `61% / 39%` | Critique |
| **Modèle** | `Elo+Forme+Surface+H2H` chevauche la phrase de description | Critique |
| **Player Versus** | Trop d'espace vertical pour peu d'infos ; H2H non intégré | Moyen |
| **IC 95%** | Barre manque de précision visuelle, bornes peu claires | Moyen |

### Causes racines

- Pas de `min-height` ni de séparation `flex-col` + `flex-1` dans `KpiCard`
- Pas de tokens d'espacement standardisés entre les zones (header/value/footer)
- Player VS section conçue avec des éléments trop grands (avatars, barres séparées)
- IC 95% : affichage linéaire simple sans marqueur de point estimé visible

---

## 2. Principes directeurs

1. **Isolation totale** — chaque zone (header/value/description) dans un conteneur flex avec `flex-1` pour ne jamais empiéter
2. **Hiérarchie claire** — label (11px caps) → value (30px bold) → description (12px muted)
3. **Compacité réfléchie** — réduire la hauteur du VS block en intégrant H2H et surface
4. **Visibilité des données** — marqueurs visuels forts (diamants, pastilles, barres colorées)

---

## 3. Architecture Composants

### 3.1 `KpiCard` — Refonte complète

Structure interne (3 zones isolées en `flex flex-col h-full`) :

```
┌──────────────────────────────────┐  ──┐
│ [icon]  LABEL              badge │    │ Header
│                                  │    │ h-10 fixe, line-clamp-1
├──────────────────────────────────┤  ──┤
│                                  │    │
│            VALUE                 │    │ Value
│                                  │    │ flex-1, centré vertical
│                                  │    │ text-3xl font-bold tabular-nums
├──────────────────────────────────┤  ──┤
│ Description (xs, muted, 1 line)  │    │ Footer
└──────────────────────────────────┘  ──┘ h-6 fixe
```

**Règle** : chaque zone a `overflow-hidden` + une hauteur contrainte. Impossible de chevaucher.

**Cas spécifiques par carte :**

| Carte | Header | Value | Description |
|-------|--------|-------|-------------|
| **Modèle** | `TrendingUp` + "Modèle" | `Elo+Forme+Surface+H2H` en `text-lg font-bold` | "Modèle composite" en muted xs |
| **Probabilité Centrale** | `Activity` + "Probabilité" | `61%` / `39%` côte à côte avec noms joueuses en petit sous chaque valeur | "Confiance du modèle" |
| **Écart Elo** | `Scale` + "Écart Elo" | `+118` en `text-3xl` | "Surface: Terre battue" + pastille couleur |
| **Confiance** | `Target` + "Confiance" | `68%` en `text-3xl` | `IC 95% [55, 68]` en monospace |

### 3.2 `PlayerVsBlock` — Nouveau composant compact

Structure :

```
┌─────────────────────────────────────────────────────┐
│  [● drapeau] SHERIF      VS      KORPATSCH [●]     │
│  #45 WTA                       #67 WTA              │
│                                                      │
│  61% ████████████████████░░░░░░░░░░░  39%           │
│                                                      │
│  H2H : Sherif 2‑1 Korpatsch  │  Terre battue        │
└─────────────────────────────────────────────────────┘
```

**Dimensions** : ~140px de haut (vs ~250px avant)
**Avatars** : 40px cercle + drapeau pays (composant `<CountryFlag />`)
**Barre de proba** : barre unique CSS `linear-gradient(to right, colorA width%, colorB)`
**H2H** : intégré sous forme de `P1 X - Y P2` avec pastille surface

### 3.3 `ConfidenceIntervalV2` — Refonte

Structure à double piste horizontale :

```
┌───────────────────────────────────────────┐
│ 🔒 Intervalle de Confiance (IC 95%)       │
│                                           │
│  SHERIF                                   │
│  0% ──25% ── [███◈███░░] ──75% ──100%    │
│              61% IC [55, 68]              │
│                                           │
│  KORPATSCH                                │
│  0% ──[░░██◈████] ──75% ──100%           │
│              39% IC [32, 46]              │
│                                           │
│ ▶ Sherif est favorite avec un avantage     │
│   significatif (IC ne chevauche pas 50%)  │
└───────────────────────────────────────────┘
```

**Marqueurs** : losange/diamant (`◆`) pour le point estimé au lieu d'une fine ligne
**Pistes** : chaque joueur a sa propre piste avec son nom intégré
**Couleurs** : favorite en vert émeraude, outsider en ambre
**Étiquettes** : IC [low, high] directement sur la piste

---

## 4. Tokens & Hiérarchie Typographique

### Spacing

| Token | Valeur | Usage |
|-------|--------|-------|
| Card padding | `p-4` | Padding interne KPI card |
| Gap interne carte | `gap-1.5` | Entre icon/label, value, description |
| Gap grille KPI | `gap-3` | Entre les 4 cartes |
| Section spacing | `space-y-6` | Entre KPI grid / VS / IC |
| VS block padding | `p-4` | Padding interne PlayerVsBlock |

### Typographie

| Élément | Classe Tailwind |
|---------|-----------------|
| Label haut carte | `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground` |
| Valeur principale | `text-3xl font-bold tabular-nums leading-none` |
| Valeur secondaire (Modèle) | `text-lg font-bold leading-tight` |
| Description footer | `text-xs text-muted-foreground/80 leading-relaxed` |
| En-tête de section | `text-sm font-semibold uppercase tracking-wider text-muted-foreground` |
| H2H line | `text-xs font-medium` |
| IC interpretation | `text-sm text-muted-foreground italic` |
| IC label (monospace) | `text-xs font-mono tabular-nums` |

### Couleurs

| Rôle | Token |
|------|-------|
| Favorite (bar, IC) | `--color-emerald-500` (ou `--accent` / `#00e676`) |
| Outsider (bar, IC) | `--color-amber-500` |
| Surface clay | `--color-orange-400` |
| Surface hard | `--color-blue-400` |
| Surface grass | `--color-green-400` |

---

## 5. Comportement Responsive

| Breakpoint | Grille KPI | VS block | IC |
|------------|-----------|----------|-----|
| `lg` (1024+) | `grid-cols-4` | Horizontal compact | Double piste normale |
| `md` (768-1023) | `grid-cols-2` | Horizontal compact | Double piste |
| `sm` (<768) | `grid-cols-1` | Stack vertical (avatars réduits 32px) | Pistes réduites, texte plus petit |

---

## 6. États & Edge Cases

| Cas | Comportement |
|-----|-------------|
| Nom joueur très long | `text-ellipsis overflow-hidden whitespace-nowrap` sur le nom ; `max-w-[120px]` |
| H2H non disponible | Afficher `—` ou `N/A` en muted ; ne pas casser le layout |
| IC non disponible | Masquer l'interprétation texte, montrer les pistes vides |
| Probabilité = 50/50 | Centrer le diamant IC sur 50%, texte interprétation ajusté |
| Valeur négative Écart Elo | Afficher `-42` en rouge/ambre ; la carte doit gérer le signe |
| Mode dégradé (pas de données) | Skeleton shimmer sur les 4 cartes KPI, VS et IC |

---

## 7. Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/components/tennis/kpi-card.tsx` | Refonte structure interne (3 zones flex) |
| `src/components/tennis/match-detail-dialog.tsx` | Intégration nouveaux composants |
| `src/components/tennis/player-vs-block.tsx` | **Nouveau** — composant VS compact |
| `src/components/tennis/confidence-interval.tsx` | Refonte → `ConfidenceIntervalV2` |
| `src/components/tennis/country-flag.tsx` | **Nouveau** — drapeau joueur |
| `src/components/tennis/surface-badge.tsx` | **Nouveau** — pastille de surface |
| `src/components/tennis/stats-indicators-grid.tsx` | Ajustement si nécessaire |

---

## 8. Non-scope (hors périmètre)

- Ne pas toucher au legacy `pariscore.html` / `pariscore.js`
- Ne pas toucher aux modales AI « Analyse Pro » (`#deep-modal`)
- Ne pas toucher aux données API ni à la logique métier
- Ne pas toucher au radar Chart.js (tennis analysis modal legacy)
- Ne pas ajouter de nouvelles dépendances npm

---

*Document de design — validé par l'utilisateur le 2026-07-24. Prochaine étape : `writing-plans` pour le plan d'implémentation.*