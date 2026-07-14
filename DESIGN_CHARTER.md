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

| Rôle | Variable CSS | Famille | Fallback |
|---|---|---|---|
| Headings | `--font-head` | `'Poppins'` | `sans-serif` |
| Body | `--font-body` | `'Inter'` | `sans-serif` |
| Monospace | `--font-mono` | `'DM Mono'` | `monospace` |

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

**Interdiction formelle** d'utiliser `font-family` avec une chaîne directe (`'Poppins'`, `'Inter'`, etc.) hors variables `--font-*`. Toute référence doit passer par `var(--font-head/body/mono)`.

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

## 8. z-index

Le système de z-index sera formalisé en Phase 3.5. En attendant :

| Niveau | Valeur (approx.) | Usage |
|---|---|---|
| Base | `1` | Éléments dans le flux |
| Sticky nav | `9001` | Barre de navigation |
| Overlay | `9985` | Help, info |
| Modal | `10000` | Modales, popups |
| Système | `99999` | Toasts, notifications critiques |

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
- Utiliser `var(--font-head/body/mono)` pour toute déclaration `font-family`
- Utiliser `var(--cf-blur-light/medium/heavy)` pour tout `backdrop-filter`
- Utiliser les classes `.cf-u-*` utilitaires quand disponibles
- Utiliser `color-mix()` pour les variations de couleur plutôt que `rgba()` brut
- Grouper les transitions par propriété explicite (`transition: opacity .2s, transform .15s`)

### 10.2 À NE PAS FAIRE
- `transition: all` — toujours explicite
- `!important` sauf override CSS de librairie externe
- Valeurs `blur(Xpx)` en dur hors variables
- `rgba(X, Y, Z, 0.XX)` pour des backgrounds de carte — utiliser `--cf-glass-*`
- Noms de fontes en dur (`'Poppins'`, `'Inter'`) — toujours via `--font-*`
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
