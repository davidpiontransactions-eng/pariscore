# Chartre Graphique — PariScore Design System

> **Version** : 1.0 · **Dernière MAJ** : 2026-07-14  
> **Source** : `pariscore.html` (root `:root` + utility classes) · **Contexte** : DS-Unify Phase 1-3

---

## 1. Palette Couleurs

### 1.1 Dark Navy (thème par défaut)

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#0b0e17` | Fond page principal |
| `--bg2` | `#0e121e` | Fond carte / panel |
| `--bg3` | `#131722` | Fond carte hover / input |
| `--bg4` | `#161c2a` | Fond carte actif |
| `--accent` | `#00e676` | Vert néon — accent principal CTA |
| `--accent-dim` | `#00c853` | Vert néon atténué (hover) |
| `--accent-bg` | `rgba(0,230,118,0.12)` | Fond accent (ex: badge) |
| `--text` | `#ffffff` | Texte principal |
| `--text2` | `#e8eaed` | Texte secondaire |
| `--text3` | `#94a3b8` | Texte tertiaire / muted |
| `--border` | `rgba(255,255,255,0.08)` | Bordure par défaut |

### 1.2 Couleurs fonctionnelles

| Token | Valeur | Usage |
|---|---|---|
| `--green` | `#00e676` | Succès, positif |
| `--amber` | `#fbbf24` | Attention, moyen |
| `--red` | `#ff3856` | Erreur, négatif |
| `--blue` | `#29b6f6` | Info, lien |
| `--purple` | `#ab47bc` | IA, insight |

### 1.3 Couleurs sportives

| Token | Valeur | Usage |
|---|---|---|
| `--sport-primary` | `--accent` | Vert — football, défaut |
| `--sport-secondary` | `--blue` | Tennis (bleu) |
| `--sport-tertiary` | `#f59e0b` | MMA (ambre) |
| `--sport-accent` | Par sport | Surcharge par onglet |

---

## 2. Typographie

### 2.1 Font stack

> **MAJ 2026-09-02** : Le Next.js app utilise Geist (pas Poppins/Inter). Ce charter documente la source de vérité actuelle.

| Rôle | Variable CSS | Famille | Fallback | Usage |
|---|---|---|---|---|
| Body/Sans | `--font-sans` | `Geist` | `sans-serif` | Texte principal, labels, tout le body |
| Monospace | `--font-mono` | `Geist Mono` | `monospace` | Odds, stats, données tabulaires, code |
| Display | `--font-display` | `Archivo` | `sans-serif` | Scores broadcast, grands chiffres uniquement |

### 2.2 Poids

| Token | Valeur | Usage |
|---|---|---|
| `--fw-regular` | `400` | Corps de texte |
| `--fw-medium` | `500` | Labels |
| `--fw-semibold` | `600` | Boutons, sous-titres |
| `--fw-bold` | `700` | Titres |
| `--fw-black` | `800` | Hero, stats |

### 2.3 Tailles (Console Filter — `--cf-fs-*`)

| Token | Valeur | Usage |
|---|---|---|
| `--cf-fs-xs` | `10px` | Meta, timestamps |
| `--cf-fs-sm` | `11px` | Labels, badges |
| `--cf-fs-md` | `13px` | Corps |
| `--cf-fs-lg` | `15px` | Sous-titres |
| `--cf-fs-xl` | `18px` | Titres cards |
| `--cf-fs-2xl` | `24px` | Titres sections |
| `--cf-fs-3xl` | `32px` | Hero, stats grandes |

### 2.4 Règle

**Interdiction formelle** d'utiliser `font-family` avec une chaîne directe hors variables `--font-*`. Toute référence doit passer par `var(--font-sans/mono/display)`. Les classes Tailwind `font-sans`, `font-mono`, `font-display` mapent vers ces variables.

---

## 3. Glassmorphism

### 3.1 Niveaux de flou

| Token CSS | Valeur | Classe utilitaire | Usage |
|---|---|---|---|
| `--cf-blur-light` | `blur(6px)` | `.cf-u-glass-light` | Overlays légers, cartes hover |
| `--cf-blur-medium` | `blur(12px)` | `.cf-u-glass-medium` | Nav, modales, panneaux sticky |
| `--cf-blur-heavy` | `blur(20px)` | `.cf-u-glass-heavy` | Modales profondes, alertes critiques |

### 3.2 Niveaux d'opacité verre

| Token | Valeur | Usage |
|---|---|---|
| `--cf-glass-light` | `rgba(15,23,42,0.55)` | Fond verre léger |
| `--cf-glass-medium` | `rgba(15,23,42,0.78)` | Fond verre moyen |
| `--cf-glass-heavy` | `rgba(11,18,32,0.92)` | Fond verre épais |
| `--cf-glass-border` | `rgba(255,255,255,0.08)` | Bordure verre standard |
| `--cf-glass-border-hot` | `rgba(56,189,248,0.30)` | Bordure verre accentuée |

### 3.3 Règle

**Interdiction** d'écrire `backdrop-filter: blur(Xpx)` en dur. Toujours utiliser `var(--cf-blur-light/medium/heavy)` ou la classe `.cf-u-glass-*` correspondante.

---

## 4. Ombres (`--cf-shadow-*`)

| Token | Valeur | Usage |
|---|---|---|
| `--cf-shadow-sm` | `0 2px 8px -4px rgba(0,0,0,0.35)` | Cartes, badges |
| `--cf-shadow-md` | `0 8px 24px -12px rgba(0,0,0,0.45)` | Panneaux, dropdowns |
| `--cf-shadow-lg` | `0 30px 60px -30px rgba(0,0,0,0.60)` | Modales |

### Ombres directionnelles SUI (mobile)

| Token | Usage |
|---|---|
| `--sui-shadow-card-rest` | Carte au repos (coin supérieur gauche lumière) |
| `--sui-shadow-card-hover` | Carte survolée |
| `--sui-shadow-card-active` | Carte active/enfoncée |

---

## 5. Bordures (classes utilitaires)

| Classe | Effet |
|---|---|
| `.cf-u-border` | Bordure standard `1px solid var(--cf-glass-border)` |
| `.cf-u-border-hot` | Bordure accentuée `1px solid var(--cf-glass-border-hot)` |
| `.cf-u-border-cyan` | Bordure cyan |
| `.cf-u-border-emerald` | Bordure émeraude |
| `.cf-u-border-coral` | Bordure corail |

---

## 6. Coins arrondis (`--cf-radius-*`)

| Token | Valeur | Usage |
|---|---|---|
| `--cf-radius-chip` | `4px` | Badges, tags |
| `--cf-radius-btn` | `6px` | Boutons |
| `--cf-radius-card` | `8px` | Cartes |
| `--cf-radius-panel` | `12px` | Panneaux |
| `--cf-radius-modal` | `16px` | Modales |
| `--cf-radius-hero` | `20px` | Hero sections |

---

## 7. Ombres portées lumineuses (`--cf-glow-*`)

| Token | Couleur | Usage |
|---|---|---|
| `--cf-glow-cyan` | `--cf-cyan-glow` | Info, lien |
| `--cf-glow-emerald` | `--cf-emerald-glow` | Succès, positif |
| `--cf-glow-coral` | `--cf-coral-glow` | Alerte, négatif |
| `--cf-glow-amber` | `--cf-amber-glow` | Attention |

---

## 8. z-index (6 Tiers)

### 8.1 Variables CSS

| Token | Valeur | Niveau | Usage |
|---|---|---|---|
| `--cf-z-base` | `1` | **Sol** | Pseudo-elements, badges, cartes de fond |
| `--cf-z-sticky` | `2` | **Socle** | Sticky table cells, hero, hovers |
| `--cf-z-deco` | `5` | **Décoration** | En-têtes sticky, décorations de tableau |
| `--cf-z-floating` | `100` | **Flottant** | Dropdowns, tooltips, petites fenêtres |
| `--cf-z-panel` | `1000` | **Panneau** | Panneaux overlay, modales de base |
| `--cf-z-overlay` | `9000` | **Overlay** | Overlays d'arrière-plan, backdrops |

### 8.2 Classes utilitaires

| Classe | Z-index |
|---|---|
| `.cf-u-z-base` | `var(--cf-z-base)` |
| `.cf-u-z-sticky` | `var(--cf-z-sticky)` |
| `.cf-u-z-deco` | `var(--cf-z-deco)` |
| `.cf-u-z-floating` | `var(--cf-z-floating)` |
| `.cf-u-z-panel` | `var(--cf-z-panel)` |
| `.cf-u-z-overlay` | `var(--cf-z-overlay)` |

### 8.3 Règle

**Interdiction** d'écrire `z-index: 1`, `z-index: 2`, `z-index: 5/6`, `z-index: 100/200`, `z-index: 1000`, ou `z-index: 9000` en dur dans les feuilles de style. Ces valeurs doivent passer par `var(--cf-z-*)`.  
Les valeurs intermédiaires (ex: `10`, `50`, `1010-1100`, `9100-10002`) sont autorisées pour le calibrage fin entre composants d'un même niveau.

### 8.4 Architecture des niveaux supérieurs (9000+)

Les modales et overlays utilisent des valeurs fines (9000 → 10002) pour permettre l'imbrication. La section en fin de fichier CSS (`#theme-toggle` → `#page-locked`, lignes ~19710-19746) définit les priorités explicites via `!important` :

- `11000` — Theme toggle (floating bottom-right)
- `10002` — Skip link (accessibilité clavier)
- `10001` — Odds graph tooltip
- `10000` — MMA modal overlay
- `9999` — Auth modal / radar overlay / dh-drill / bm-modal
- `9998` — RG pick card
- `9997` — RG pick backdrop
- `9996` — Tennis modal
- `9990` — Radar overlay (override)
- `9989` — Security banner
- `9985` — Strat help overlay
- `9980` — Betmines modal
- `9950` — Drill modal
- `9500` — Profiles modal
- `9400` — Live tennis sheet
- `9300` — MLS panel dropdown
- `9200` — Mob filter sheet
- `9100` — Mob filter overlay
- `9001` — Bottom nav
- `9000` — Strategy setup, page-locked
- `7000` — Page lock overlay

---

## 9. Neon Accents (Console Filter)

| Token | Valeur | Usage |
|---|---|---|
| `--cf-emerald` | `#4ade80` | Accent vert vif |
| `--cf-emerald-soft` | `rgba(74,222,128,0.18)` | Fond vert doux |
| `--cf-emerald-glow` | `rgba(74,222,128,0.55)` | Glow vert |
| `--cf-coral` | `#ff3856` | Accent rouge vif |
| `--cf-coral-soft` | `rgba(255,56,86,0.16)` | Fond rouge doux |
| `--cf-coral-glow` | `rgba(255,56,86,0.55)` | Glow rouge |
| `--cf-amber-soft` | `rgba(251,191,36,0.16)` | Fond ambre doux |
| `--cf-amber-glow` | `rgba(251,191,36,0.55)` | Glow ambre |

---

## 10. Conventions Générales

### 10.1 À FAIRE
- Utiliser `var(--font-sans/mono/display)` pour toute déclaration `font-family`
- Utiliser `var(--cf-blur-light/medium/heavy)` pour tout `backdrop-filter`
- Utiliser les classes `.cf-u-*` utilitaires quand disponibles
- Utiliser `color-mix()` pour les variations de couleur plutôt que `rgba()` brut
- Grouper les transitions par propriété explicite (`transition: opacity .2s, transform .15s`)

### 10.2 À NE PAS FAIRE
- `transition: all` — toujours explicite
- `!important` sauf override CSS de librairie externe
- Valeurs `blur(Xpx)` en dur hors variables
- `rgba(X, Y, Z, 0.XX)` pour des backgrounds de carte — utiliser `--cf-glass-*`
- Noms de fontes en dur — toujours via `--font-sans/mono/display`
- `backdrop-filter` sans `-webkit-backdrop-filter` correspondant

### 10.3 Nommage des classes utilitaires
- `.cf-u-{propriété}` — utilitaires Console Filter
- `.sui-{composant}` — composants SUI (mobile V2)
- Éviter les classes ad-hoc pour des variations uniques

---

## 11. Gradients (à consolider en Phase 3.4)

En attendant, les gradients doivent :
- Utiliser `--accent`, `--bg*`, et `--sport-*` comme couleurs de base
- Être limités à `135deg` comme angle standard
- Ne pas dépasser 3 stops

---

## 12. Validation

Un script de validation (`scripts/validate-css-conventions.js`) permet de vérifier :

```bash
node scripts/validate-css-conventions.js
```

Il détecte automatiquement :
- `backdrop-filter: blur(Xpx)` en dur (hors variables)
- `font-family: '...'` hors variables `--font-*`
- `transition: all`
- `!important` non justifié (todo list)

---

## 13. Motion Policy (Phase 19 — 2026-09-03)

### 13.1 Règle d'or : Functional vs Decorative

> **Chaque animation doit répondre à la question : "Qu'est-ce qu'elle COMMUNIQUE ?"**
> Si la réponse est "rien" → supprimer ou gate `prefers-reduced-motion`.

### 13.2 Classification des animations existantes

| Animation | Keyframe | Catégorie | Justification |
|---|---|---|---|
| `glow-pulse` | `box-shadow` pulsation | **Fonctionnelle** ✅ | Indique l'état "LIVE" — information vitale |
| `shimmer` | `translateX` skeleton | **Fonctionnelle** ✅ | Feedback de chargement — l'utilisateur sait qu'on attend |
| `pulse-soft` | `opacity` pulsation | **Fonctionnelle** ✅ | Indique un état actif/sélectionné |
| `tab-fade-in` | `opacity + translateY` | **Fonctionnelle** ✅ | Transition d'onglet — guide l'œil vers le nouveau contenu |
| `aurora-drift` | `translate3d + scale` | **Décorative** ⚠️ | Ambiance visuelle — garder mais gate reduced-motion |
| `grid-pan` | `background-position` | **Décorative** ⚠️ | Pattern ambiant — garder mais gate reduced-motion |
| `bounce-soft` | `translateY` | **Limite** ⚠️ | Utiliser uniquement sur les CTA/boutons d'action |

### 13.3 Règles

1. **Fonctionnel** = peut être gardé même avec `prefers-reduced-motion: reduce` (avec `0.01ms` fallback)
2. **Décoratif** = DOIT être désactivé quand `prefers-reduced-motion: reduce` (déjà fait dans globals.css)
3. **bounce-soft** = réservé aux éléments cliquables (boutons, CTA). Jamais sur du contenu statique.
4. **Nouvelles animations** : justifier la catégorie "Fonctionnelle" avant d'ajouter un `@keyframes`
5. **Durée max** : 500ms pour les animations fonctionnelles. 26s pour les ambient (aurora/grid).

### 13.4 Gate reduced-motion

Toute animation décorative AJOUTÉE doit être incluse dans le bloc :
```css
@media (prefers-reduced-motion: reduce) {
  .sport-ambient::after,
  .sport-ambient::before,
  .nouvelle-animation-decorative {
    animation: none;
  }
}
```

---

## 14. Anti-Sameness Strategy (Phase 20 — 2026-09-03)

### 14.1 Identité Visuelle Pariscore — Notre ADN

> **Pariscore = Dark Navy + Vert Néon + Glass + Ambient Patterns.**
> Ce cocktail visuel EST notre identité. Pas de rebrand, pas de tendance qui le remplace.

| Élément | Valeur | Rôle |
|---|---|---|
| Fond | `#0a0e17` → `#1A1A2E` | immersion nocturne, contraste fort |
| Accent | `#00e676` vert néon | signal fort, action, confiance |
| Glass | blur + translucent | profondeur, hiérarchie spatiale |
| Ambient | dot pattern + aurora | texture vivante sans surcharge |
| Typo | Geist (body) + Archivo (scores) | neutralité + caractère broadcast |

### 14.2 Trend Filter — Checklist d'Évaluation

Avant d'adopter TENDANCE, chaque ajout doit répondre :

```
1. Est-ce que ça aide les parieurs à prendre des décisions ?    → Sinon : SKIP
2. Est-ce que ça améliore la lisibilité des données/scores ?    → Sinon : SKIP
3. Est-ce que ça renforce l'identité dark+vert+glass ?           → Sinon : SKIP
4. Est-ce que ça casse la performance mobile ?                   → Sinon : OK
5. Est-ce que c'est accessible (contraste, keyboard, motion) ?   → Sinon : FIX d'abord
```

### 14.3 Tendances Refusées — Anti-Patterns

| Tendance | Raison du refus |
|---|---|
| **Y2K / Chrome / Iridescent** | Inadapté au gambling sérieux — décalé |
| **Neo-Brutalism** | Bordures épaisses = mauvaise lisibilité des odds |
| **3D lourd (WebGL)** | Coût performance démesuré pour un site data-driven |
| **Hyper-Maximalism** | Surcharge cognitive = mauvaise UX pour les paris |
| **Stock photos** | On est data-driven, pas lifestyle |

### 14.4 Tendances Adoptées — avec modération

| Tendance | Application Pariscore | Limite |
|---|---|---|
| **Variable Fonts** | Scores broadcast (Archivo) + Geist variable | Pas de typo "fun" |
| **Glassmorphism** | Déjà en place (3 niveaux) | Pas de glass sur glass |
| **Micro-Interactions** | Feedback utilitaire (hover, focus, live pulse) | Pas de bounce décoratif |
| **Scroll Reveal** | Révéler les sections au scroll | Pas d'animation sur CHAQUE élément |
| **Bold Colors** | Gradients par sport (subtil) | Pas de rainbow partout |
| **Accessibility** | Built-in, pas widget overlay | Jamais accessiBe/UserWay |

### 14.5 Règle "One Bold Move"

> **Max 1 tendance "bold" par page.** Si la page a déjà du glass + animation + gradient, pas de +.
> Exemple : Dashboard = Glass (bold) + Scroll Reveal (modéré) = OK.
> Dashboard = Glass + Gradient + Animation + Cursor custom = OVERDESIGN → Simplifier.

---

## 15. Sport Gradients (Phase 17 — 2026-09-03)

> **Principe** : chaque sport a une couleur dominante utilisée en gradient subtil sur les headers/sections.

| Sport | Token CSS | Gradient CSS | Usage |
|---|---|---|---|
| Football | `--sport-football` | `#00e676 → 30% opacity → #0a0e17` | Headers, badges, accents |
| Tennis | `--sport-tennis` | `#29b6f6 → 30% opacity → #0a0e17` | Onglet tennis, cards match |
| MMA | `--sport-mma` | `#f59e0b → 30% opacity → #0a0e17` | Onglet MMA, fight cards |
| F1 | `--sport-f1` | `#ef4444 → 30% opacity → #0a0e17` | Onglet F1, race cards |
| Basketball | `--sport-basketball` | `#f97316 → 30% opacity → #0a0e17` | Onglet basketball |

### Classes utilitaires

| Classe | Description |
|---|---|
| `.gradient-sport-football` | Gradient vert football |
| `.gradient-sport-tennis` | Gradient bleu tennis |
| `.gradient-sport-mma` | Gradient ambre MMA |
| `.gradient-sport-f1` | Gradient rouge F1 |
| `.gradient-sport-basketball` | Gradient orange basketball |

### Règles

1. **Angle standard** : `135deg` (haut-gauche → bas-droite)
2. **3 stops max** : couleur dominante → 30% opacity → fond deep
3. **Usage** : backgrounds de sections, pas de texte
4. **Pas de gradient sur texte** sauf `.bg-clip-text` existant (hero title)

---

## 16. Liquid Glass Token (Phase 18 — 2026-09-03)

> **Inspiré Apple Liquid Glass** : glass plus blur (40-60px), saturé (1.5-1.8x), ombre inset subtile.

### Tokens CSS

| Token | Valeur | Usage |
|---|---|---|
| `--glass-liquid-bg` | `rgba(255,255,255,0.04)` | Fond glass léger |
| `--glass-liquid-border` | `rgba(255,255,255,0.08)` | Bordure glass |
| `--glass-liquid-shadow` | `0 8px 32px rgba(0,0,0,0.12) + inset 0 1px 0 rgba(255,255,255,0.05)` | Ombre + highlight inset |
| `--glass-liquid-blur` | `blur(40px) saturate(1.5)` | Flou + saturation |

### Classes utilitaires

| Classe | Description |
|---|---|
| `.glass-liquid` | Glass standard (40px blur) |
| `.glass-liquid-elevated` | Glass surélevé (60px blur, ombre forte) |

### Différence avec glass existant

| Aspect | Glass classique | Liquid Glass |
|---|---|---|
| Blur | 6-20px | 40-60px |
| Saturation | 1x | 1.5-1.8x |
| Inset highlight | Non | Oui (`inset 0 1px 0 rgba(255,255,255,0.05)`) |
| Usage | Modales, overlays | Hero sections, feature cards |

---

## 17. Glassmorphism Raffiné (Phase 4 — 2026-09-03)

> **Amélioration** : border glow subtil au focus-visible pour renforcer l'accessibilité keyboard.

### Classe

| Classe | Description |
|---|---|
| `.glass-focus` | Ajoute border emerald glow au `focus-visible` |

### Utilisation

```tsx
// Avant
<div className="glass-liquid">

// Après — avec feedback keyboard
<div className="glass-liquid glass-focus" tabIndex={0}>
```

### Règles

1. **Uniquement `focus-visible`** — pas de glow au click souris
2. **Couleur** : emerald (`rgba(0,230,118,0.4)`) — cohérent avec l'accent Pariscore
3. **Reset** : `:focus-visible:not(:focus-visible)` restaure le style glass de base
4. **Usage** : cartes interactives, boutons glass, panneaux navigables au clavier

---

## 18. Variable Fonts Avancé (Phase 3 — 2026-09-03)

> **Extension** : Space Grotesk ajouté comme font display UI pour les headers de section.

### Fonts disponibles

| Rôle | Variable CSS | Famille | Axes | Usage |
|---|---|---|---|---|
| Body | `--font-sans` | Geist | — | Texte principal |
| Mono | `--font-mono` | Geist Mono | — | Odds, stats, code |
| Display Score | `--font-display` | Archivo | `wdth` (62-125) | Scores broadcast, grands chiffres |
| **Display UI** | `--font-display-ui` | **Space Grotesk** | `wght` (300-700) | Headers de section, gros titres UI |

### Classes utilitaires

| Classe | Description |
|---|---|
| `.score-hero` | Score broadcast (Archivo wdth 118, weight 800) |
| `.score-hero-weight` | Score avec weight shift au hover (800→900) |
| `.score-hover` | Score interactif avec weight + color shift |
| `.font-display-ui` | Space Grotesk pour headers UI |

### Règles

1. **Archivo** = scores et numéros uniquement. Jamais pour du texte body.
2. **Space Grotesk** = headers de section, titres UI. Mood dashboard/analytics.
3. **Geist** = reste du body. Ne pas mélanger.

---

## 19. Dark Mode — Accent ≤ 5% (Phase 7 — 2026-09-03)

> **Règle d'or** : `#00e676` apparaît UNIQUEMENT sur les signaux. Tout le chrome = slate translucide.

### Sémantique accent

| Élément | Couleur | Raison |
|---|---|---|
| Value bet, win, confiance haute | `#00e676` | Signal positif |
| Live pulse | `#00e676` | État actif |
| CTA primaire | `#00e676` | Action principale |
| Bordures neutres | `rgba(148,163,184,0.12)` | Chrome |
| Icônes neutres | `rgba(148,163,184,0.7)` | Chrome |
| Boutons secondaires | `rgba(148,163,184,0.7)` | Chrome |

### Classes utilitaires

| Classe | Description |
|---|---|
| `.chrome-neutral` | Style neutre slate pour chrome |
| `.signal-accent` | Réservé aux éléments signalants |
| `.signal-accent-glow` | Glow vert sur éléments signal |

### Audit

Compter la surface de pixels `#00e676` sur la homepage. Objectif : **≤ 5%** de la surface totale.

---

## 20. Mobile-First Refinements (Phase 21 — 2026-09-03)

> **Safe areas + touch targets** pour PWA Capacitor (Android/iOS).

### Tokens / Classes

| Classe | Description |
|---|---|
| `.mobile-safe-top` | `padding-top: env(safe-area-inset-top)` |
| `.mobile-safe-bottom` | `padding-bottom: env(safe-area-inset-bottom)` |
| `.mobile-safe-x` | `padding-left/right: env(safe-area-inset-left/right)` |
| `.touch-target` | Min 44x44pt (Apple HIG / Material Design 3) |
| `.mobile-bottom-nav` | Bottom nav avec safe area auto |

### Règles

1. **Touch targets** : minimum 44x44pt sur tous les éléments interactifs
2. **Safe areas** : utiliser `env(safe-area-inset-*)` pour les PWA standalone
3. **Bottom nav** : toujours inclure `mobile-bottom-nav` pour le padding home indicator
4. **Tap highlight** : `-webkit-tap-highlight-color: transparent` sur tous les boutons/liens
