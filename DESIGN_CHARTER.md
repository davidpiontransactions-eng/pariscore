# Charte Graphique — PariScore Design System

> **Version** : 2.0 · **Dernière MAJ** : 2026-10-09
> **Source de vérité** : `src/app/globals.css` (tokens), `src/components/ui/` (primitives)
> **Remplace** : la v1.0 (2026-07-14), qui documentait des tokens absents du code
> **Complément** : `DESIGN.md` (réponse « à quoi ça ressemble »), `DESIGN_SYSTEM_CAHIER_DES_CHARGES.md` (benchmark + plan)

---

## 0. Comment lire ce document

**Les tokens de ce document sont ceux de `globals.css`.** Si un token listé ici n'est pas
dans `globals.css`, c'est un bug de ce document — le corriger, pas contourner.

La v1.0 listait `--accent: #00e676`, `--bg*`, `--cf-*`, `--cf-radius-*`, `--cf-z-*`. **Aucun
de ces tokens n'existe** dans le code actuel. La v2.0 supprime cette dette.

Elle listait aussi un script de validation CSS qui **n'a jamais été commité** — voir §14.

---

## 1. Thème

### 1.1 Modèle

**Dual-theme, class-based** (`next-themes`, `attribute="class"`). Thème par défaut
**dark** — `src/app/layout.tsx` : `defaultTheme="dark"`.

Le dark est le thème de référence produit (le live betting se joue la nuit, sur téléphone).
Le light existe et est complet : il n'est pas un inversé afterthought, il a ses propres
tokens de surface.

### 1.2 Structure des blocs

| Bloc | Emplacement | Rôle |
|---|---|---|
| `@theme inline` | `globals.css:16-95` | Expose les tokens sémantiques à Tailwind (`--color-*`, `--font-*`) |
| `:root` | `globals.css:97-161` | Valeurs **light** |
| `.dark` | `globals.css:163-238` | Valeurs **dark** + tokens Bento Grid |
| `:root` (Liquid Glass) | `globals.css:696-731` | `--lg-*`, **non thémé** (voir §6.3) |
| `@layer base` | `globals.css:240+` | Reset, theming navigateur, mobile refinements |

### 1.3 Règle

Les composants consomment des **classes Tailwind sémantiques** (`bg-card`,
`text-muted-foreground`, `border-border`). **Jamais** une valeur hexadécimale brute en
dur dans un composant — sauf valeur d'accent sportexplicitement documentée en §4.

---

## 2. Couleurs structurelles

Neutres. **Ne portent aucun sens** — c'est la palette de marque qui porte le sens (§4).

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#F0ECF8` | `#0E1217` | Fond page |
| `--bg-deep` | `#F0ECF8` | `#0A0E14` | Fond profond (hero, empty states) |
| `--foreground` | `#1A1145` | `#E2E8F0` | Texte principal |
| `--card` | `#FFFFFF` | `#1E2433` | Surface carte |
| `--card-foreground` | `#1A1145` | `#E2E8F0` | Texte sur carte |
| `--popover` | `#FFFFFF` | `#1E2433` | Surface flottante |
| `--secondary` | `#EDE8F5` | `#1A1F2E` | Surface secondaire |
| `--muted` | `#EDE8F5` | `#1A1F2E` | Surface atténuée |
| `--muted-foreground` | `#6B5B8D` | `#94A3B8` | Texte tertiaire |
| `--border` | `#E0D8F0` | `#2D3748` | Bordure standard |
| `--input` | `#E0D8F0` | `#2D3748` | Bordure input |
| `--ring` | `#7B3FA0` | `#7B3FA0` | Anneau focus |
| `--surface-dark` | `#EDE8F5` | `#1A1F2E` | Surface sombre explicite |
| `--surface-card` | `#FFFFFF` | `#1E2433` | Surface carte explicite |

### 2.1 Couleurs de marque

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--primary` | `#7B3FA0` | `#7B3FA0` | Actions principales, structure |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | Texte sur primary |
| `--accent` | `#FF6D00` | `#FF6D00` | **Accent unique** — CTA, mise en avant |
| `--accent-foreground` | `#FFFFFF` | `#FFFFFF` | Texte sur accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Erreur, action destructive |

> **`--accent` est identique dans les deux thèmes.** C'est un choix délibéré : l'orange est
> le signal de marque, il ne change pas de valeur au switch de thème. Ne pas le convertir
> en token sémantique.

---

## 3. Couleurs fonctionnelles — le contrat sémantique

**C'est le seul niveau où la couleur encode du sens.** Ces tokens sont **identiques dans les
deux thèmes** : ils doivent signifier la même chose en clair et en sombre.

| Token | Valeur | Sémantique |
|---|---|---|
| `--edge-positive` | `#FF6D00` | Value, edge au-dessus du seuil |
| `--edge-negative` | `#EF4444` | Piège, cote trop courte |
| `--confidence-high` | `#4CAF50` | IC étroit, données suffisantes |
| `--confidence-mid` | `#FF6D00` | IC modéré |
| `--confidence-low` | `#EF4444` | IC large ou données insuffisantes |
| `--live-pulse` | `#4CAF50` | Match en cours |
| `--ai-insight` | `#7B3FA0` | Analyse IA (Gemini) |

### 3.1 Convention de lecture

```
--edge-positive  et --accent   = #FF6D00  → « ça vaut quelque chose »
--confidence-high et --live-pulse = #4CAF50  → « fiable » / « en cours »
--edge-negative  et --confidence-low = #EF4444  → « piège » / « incertain »
```

### 3.2 Collision sémantique connue : `live-pulse` est vert

Le vert de `--live-pulse` n'est pas la convention du secteur (le rouge y signifie
« live »). Ici, le rouge est déjà pris par `edge-negative` / `confidence-low` : le faire
servir aussi au live rendrait un même rouge ambigu entre « piège » et « en cours ».

**Règle** : `--live-pulse` reste vert. La distinction **live vs terminé** ne repose
**jamais sur la couleur seule** — voir `MatchStateBadge` (`src/components/shared/`) :
icône + libellé + `title`, toujours.

### 3.3 Règle dure : aucun signal par la couleur seule

Tout signal codé par une couleur doit porter un **second canal** : icône, forme, libellé
texte ou position. Non négociable — c'est un défaut WCAG 1.4.1 et une source de
confusion pour les déficiences de vision des couleurs.

### 3.4 Budget d'accent

La surface de pixels de `--accent` doit rester **≤ 5 %** de la surface visible sur un
écran d'onglet sport. Le chrome (entêtes, sidebar, chrome de navigation) est neutre ;
l'accent ne sert que les **signaux**.

---

## 4. Couleurs par sport

| Token | Light | Dark |
|---|---|---|
| `--sport-tennis` | `#7B3FA0` | `#60A5FA` |
| `--sport-football` | `#7B3FA0` | `#7B3FA0` |
| `--sport-basketball` | `#7B3FA0` | `#F97316` |
| `--sport-cycling` | `#7B3FA0` | `#7B3FA0` |
| `--sport-rugby` | `#7B3FA0` | `#7B3FA0` |
| `--sport-mma` | `#EF4444` | `#EF4444` |
| `--sport-f1` | `#EF4444` | `#EF4444` |
| `--sport-cs2` | `#FF6D00` | `#FF6D00` |

### 4.1 Gradients sport

Cinq classes existent : `.gradient-sport-football`, `-tennis`, `-mma`, `-f1`,
`-basketball`. Angle `135deg`, 3 stops maximum, **fonds de sections uniquement** —
jamais sur du texte (sauf `.bg-clip-text` existant).

> Il n'existe **pas** de gradient pour basketball/handball/hockey/snooker/baseball. Ne pas
> supposer leur existence ; ajouter la classe si le besoin est réel.

---

## 5. Typographie

### 5.1 Familles

| Rôle | Token Tailwind | Famille | Usage |
|---|---|---|---|
| Body / UI | `font-sans` | **Geist** | Tout le texte courant |
| Nombres / code | `font-mono` | **Geist Mono** | Cotes, stats tabulaires |
| Scores | `font-display` | **Archivo** | Scores broadcast, grands chiffres |
| Titres UI | `font-display-ui` | **Space Grotesk** | Headers de section |

### 5.2 Chiffres tabulaires — règle de base, obligation globale

`font-variant-numeric: tabular-nums` est posé **sur `body`** (`globals.css`, `@layer base`).
Donc tout le site en bénéficie : cotes, probabilités, scores, minutes, classements, ROI,
horodatages.

**Pourquoi en base plutôt que composant par composant.** La première version de cette
charte demandait la classe sur chaque composant numérique. L'audit a trouvé **57 fichiers**
concernés. Une règle Distributed sur 57 fichiers n'est pas tenable : la règle oubliée dans
un composant est une colonne qui vibre au tick live, et personne ne la voit relancer. Une
règle en base ne peut pas être oubliée.

**Échappement** : `.tabular-nums-off` remet un sous-arbre en chiffres proportionnels, pour
un passage de texte non chiffré où le tabulaire gêne.

**Ce qui reste à faire à la main** : `font-mono` sur les valeurs numériques critiques
(cotes, scores). `--font-mono` est un choix de famille, pas un correctif de vibration —
`tabular-nums` fait le travail. Ne pas ajouter `font-mono` partout « par principe » :
Geist Mono sur un corps de texte coûte de la lisibilité.

**Audit** :
```bash
bun scripts/audit-tabular-nums.ts
```
Recense les **désactivations** locales (`.tabular-nums-off`, `font-variant-numeric`
concurrent) — plus les 57 fichiers du type « nombre rendu sans tabular-nums » ne sont plus
possibles, la règle étant en base. Sortie dans `logs/audit-tabular.txt`.

### 5.3 Règle d'usage

- `Archivo` : scores et grands chiffres **uniquement**. Jamais pour du texte courant.
- `Space Grotesk` : titres de section. Jamais pour du corps de texte.
- `Geist Mono` : toute valeur numérique. Jamais pour de la prose.
- Interdiction de `font-family` en dur hors variables `--font-*`.

### 5.4 Classes utilitaires

| Classe | Effet |
|---|---|
| `.score-hero` | Score broadcast (Archivo, fort, condensé) |
| `.score-hero-weight` | Weight shift au hover |
| `.font-display-ui` | Space Grotesk pour headers UI |

---

## 6. Liquid Glass

### 6.1 Tokens `--lg-*`

Définis dans un **second bloc `:root`** (`globals.css:696-731`) — donc **non thémés**.

| Catégorie | Tokens | Valeurs |
|---|---|---|
| Blur | `--lg-blur-sm/md/lg/xl` | 8px, 20px, 40px, 60px |
| Saturation | `--lg-sat-sm/md/lg` | 1.2, 1.5, 1.8 |
| Noise | `--lg-noise-opacity`, `--lg-noise-url` | 0.03, SVG fractalNoise |
| Lens | `--lg-lens-angle`, `--lg-lens-spread` | 135deg, 120% |
| Couleurs | `--lg-bg`, `--lg-bg-elevated`, `--lg-border`, `--lg-border-elevated`, `--lg-shadow`, `--lg-shadow-elevated` | **valeurs light** |
| Tints sport | `--lg-tint-tennis/football/mma/cycling/f1/cs2/basketball/rugby` | 12% sport, transparent |

### 6.2 Classes

| Classe | Effet |
|---|---|
| `.glass-liquid` | Base (blur 40px, saturate 1.5) |
| `.glass-liquid-elevated` | Surélevé (blur 60px, saturate 1.8) |
| `.glass-tennis` … `.glass-rugby` | Tint sport 12% |
| `.glass-focus` | Glow violet au `focus-visible` |
| `.lg-no-sheen` | Masque le `::after` (lens gradient) |
| `.liquid-glass--animated` | Sheen drift (navbar uniquement) |

### 6.3 Limite connue : les couleurs glass sont light-only

`--lg-bg: rgba(255,255,255,0.85)` et `--lg-border: #E0D8F0` **ne sont pas redéfinis pour
`.dark`**. Conséquence : une surface glass en thème sombre est un voile blanc translucide
sur fond navy — lisible sur le texte clair, mais la bordure lavande est presque invisible.

**Règle** : le glass est réservé aux surfaces de détail (drawer, modale, sheet, header
collant). **Jamais** sur un fond de grille de matchs. Plafond : **1 niveau** de glass
empilé. Interdiction formelle du glass sur glass.

### 6.4 Gates

| Gate | Condition | Effet |
|---|---|---|
| Reduced transparency | `prefers-reduced-transparency: reduce` | `--lg-noise-opacity: 0` |
| Reduced motion | `prefers-reduced-motion: reduce` | Lens 0deg/100%, sheen off, blur réduit |
| FPS | FPS < 30 pendant 3s | `.glass-off` sur `<html>` (voir `use-liquid-glass`) |

**Ne pas contourner le FPS guard.** C'est lui qui tient la promesse « aucun retard sur les
cotes live ».

### 6.5 Feature flag

`liquid-glass-v1` (PostHog). Flag désactivée → `<LiquidGlass>` rend un `<div>` nu.
C'est le kill switch. Rollout par pourcentage dans PostHog.

### 6.6 HTML laissés sans effet

`.glass-liquid--clear` (cité dans `DESIGN_SYSTEM_CAHIER_DES_CHARGES.md` §1.2 de la v1 du
cahier) **n'existe pas dans `globals.css`**. Seuls `.glass-liquid` et
`.glass-liquid-elevated` existent. Utiliser l'un des deux.

---

## 7. Rayons

| Token | Valeur |
|---|---|
| `--radius` | `0.625rem` (10px) |

Dérivation Tailwind : `sm` 6px · `md` 8px · `lg` 10px · `xl` 14px.

Cartes et dialogs : `rounded-lg`. Badges et pilules : `rounded-full`. **Ne pas introduire
`rounded-3xl` (24px) sans arbitrage explicite** : la base 10px est calibrée avec
`LiquidGlass`, `DESIGN.md` et les cartes existantes. Un rayon à 24px est un changement de
silhouette de toute l'application, pas un réglage.

Tokens Bento Grid (dark uniquement, `globals.css:227-237`) : `--bento-gap` 16px,
`--bento-radius` 20px, `--bento-radius-sm` 16px.

---

## 8. Ombres

| Token / classe | Valeur | Usage |
|---|---|---|
| `--lg-shadow` | `0 2px 12px rgba(123,63,160,.08), 0 1px 3px rgba(0,0,0,.04)` | Cartes glass |
| `--lg-shadow-elevated` | `0 4px 20px rgba(123,63,160,.12), 0 2px 6px rgba(0,0,0,.06)` | Panneaux glass |
| `.glass-focus:focus-visible` | glow violet | Focus clavier |

Ombres SUI (mobile) : `--sui-shadow-card-rest/-hover/-active`.

---

## 9. Motion

### 9.1 Tokens

| Token | Valeur |
|---|---|
| `--motion-fast` | 150ms |
| `--motion-med` | 300ms |
| `--motion-slow` | 500ms |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-emphasized` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

### 9.2 Animations declarées

| Token | Keyframe | Catégorie |
|---|---|---|
| `--animate-pulse-soft` | `pulse-soft` 3s | Fonctionnelle — état actif |
| `--animate-glow-pulse` | `glow-pulse` 2.4s | Fonctionnelle — état LIVE |
| `--animate-shimmer` | `shimmer` 1.6s | Fonctionnelle — chargement |
| `--animate-aurora` | `aurora-drift` 26s | **Décorative** |
| `--animate-grid-pan` | `grid-pan` 24s | **Décorative** |
| `--animate-bounce-soft` | `bounce-soft` 1.2s | Limite — CTA uniquement |

### 9.3 Règle d'or

**Chaque animation doit répondre à : « qu'est-ce qu'elle COMMUNIQUE ? »**
Si la réponse est « rien » → supprimer, ou gate `prefers-reduced-motion`.

1. **Fonctionnelle** : survit à `prefers-reduced-motion: reduce` (avec fallback `0.01ms`).
2. **Décorative** : **doit** être désactivée sous `reduce`.
3. **Animation de cote** : **bornée en durée**. Elle signale le changement puis se rend à
   l'état stable. Une animation de cote qui pulse en continu est un défaut WCAG 2.2.2
   (Pause, Stop, Hide) et une charge cognitive en live.
4. Durée max des animations fonctionnelles : **500ms**.
5. Nouveaux `@keyframes` : justifier la catégorie « fonctionnelle » avant d'ajouter.

Quatre blocs de gate existent dans `globals.css` (lignes 490, 605, 622, 874). Tout ajout
décoratif doit y être inscrit.

### 9.4 Règles de style

- `transition: all` **interdit** — toujours explicite.
- `!important` uniquement pour override CSS de librairie externe.

---

## 10. z-index

La v1.0 documentait `--cf-z-base/sticky/deco/floating/panel/overlay`. **Ces tokens
n'existent pas** dans `globals.css`. Le code utilise des valeurs en dur.

Convention à respecter en attendant un token :

| Niveau | Usage typique |
|---|---|
| `1-5` | Pseudo-éléments, badges, décorations de tableau |
| `100` | Dropdowns, tooltips |
| `1000` | Panneaux overlay, modales de base |
| `9000+` | Modales et overlays imbriqués (réservé) |

---

## 11. Mobile & safe areas

Classes définies dans `globals.css` :

| Classe | Effet |
|---|---|
| `.mobile-safe-top` | `padding-top: env(safe-area-inset-top)` |
| `.mobile-safe-bottom` | `padding-bottom: env(safe-area-inset-bottom)` |
| `.mobile-safe-x` | `padding-left/right: env(safe-area-inset-left/right)` |
| `.touch-target` | `min-height: 44px; min-width: 44px` |
| `.mobile-bottom-nav` | Bottom nav avec safe area |

### 11.1 Règles

1. **Touch targets ≥ 44×44 px** sur tout élément interactif (Apple HIG / Material 3).
2. Safe areas via `env(safe-area-inset-*)` pour la PWA standalone (Capacitor Android/iOS).
3. `touch-action: manipulation` et `-webkit-tap-highlight-color: transparent` sont déjà
   posés globalement sur `button`, `a`, `[role="button"]` (`globals.css:274-279`).
4. PWA standalone en dark : fond `#000` pur (économie batterie + contraste Android),
   `globals.css:281-285`.

---

## 12. Accessibilité — règles dures

Le corpus de benchmark du cahier des charges ne documente **rien** en accessibilité
(0 mention WCAG sur 7 sources). Ces règles sont importées en dur, pas sourcées.

| Règle | Seuil |
|---|---|
| Contraste texte courant | ≥ 4.5:1 |
| Contraste texte large (≥ 18px bold / 24px) et composants | ≥ 3:1 |
| Signal jamais par la couleur seule | Second canal obligatoire (§3.3) |
| Focus visible | Tout élément interactif, `:focus-visible` |
| Navigation clavier | Complète — aucun piège de focus |
| `prefers-reduced-motion` | Tout décoratif désactivé (§9.3) |
| `prefers-reduced-transparency` | Noise désactivé |
| Lecteur d'écran | `aria-label` / `title` sur tout élément à signal non textuel |

---

## 13. Ce qui a été supprimé depuis la v1.0

Liste explicite, pour qu'un agent qui cherche un token ne le cherche pas :

| Token / classe v1.0 | Statut |
|---|---|
| `--accent: #00e676` | **Supprimé** — `--accent` est `#FF6D00` |
| `--bg`, `--bg2`, `--bg3`, `--bg4`, `--text`, `--text2`, `--text3` | **N'ont jamais existé** sous ces noms — utiliser `--background`, `--card`, `--foreground`, `--muted-foreground` |
| `--green`, `--amber`, `--red`, `--blue`, `--purple` | **N'ont jamais existé** — utiliser `--edge-*`, `--confidence-*`, `--destructive` |
| `--cf-radius-*` (6 tokens) | **N'ont jamais existé** — utiliser `--radius` |
| `--cf-blur-*`, `--cf-glass-*` | **N'ont jamais existé** — utiliser `--lg-*` |
| `--cf-shadow-*`, `--cf-glow-*` | **N'ont jamais existé** — utiliser `--lg-shadow*` |
| `--cf-z-*` (6 tokens) | **N'ont jamais existé** — voir §10 |
| `.cf-u-*` (toutes) | **N'ont jamais existé** |
| `.cf-fs-*` | **N'ont jamais existé** — échelle Tailwind standard |
| `.cf-emerald`, `--cf-coral` | **N'ont jamais existé** |
| `.glass-liquid--clear` | **N'existe pas** — `.glass-liquid` / `.glass-liquid-elevated` (§6.6) |
| Poppins / Inter (`--font-head`, `--font-body`) | **N'ont jamais existé** — Geist |

---

## 14. Validation

**Il n'existe aucun script de validation CSS dans ce dépôt.** La v1.0 de cette charte en
mentionnait un (`scripts/validate-css-conventions.js`) — il n'a jamais été commité. Ne pas
le chercher, ne pas le citer.

Vérification manuelle des 4 conventions, en attendant un outil :

| Convention | Recherche |
|---|---|
| `backdrop-filter: blur(Xpx)` en dur | `backdrop-filter: blur(` hors variables `--lg-*` |
| `font-family` hors variables | `font-family:` avec une chaîne littérale |
| `transition: all` | `transition: all` |
| `!important` non justifié | `!important` hors override de librairie externe |

Gates obligatoires après toute modification :
```bash
bun run lint
bun run typecheck
```

---

*Version 2.0 — 2026-10-09. Contrat aligné sur `src/app/globals.css`. Spec de refonte et
benchmark : `DESIGN_SYSTEM_CAHIER_DES_CHARGES.md`.*