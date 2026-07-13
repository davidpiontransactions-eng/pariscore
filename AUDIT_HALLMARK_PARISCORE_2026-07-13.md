# Audit Hallmark · pariscore.fr — 2026-07-13

> **Protocole** : `hallmark audit https://pariscore.fr/` — lecture de la cible,
> scoring contre la liste d'anti-patterns AI-slop, punch list triée par sévérité.
> Aucune édition effectuée (audit seul).
>
> **Source analysée** : code source local `pariscore.html` (1,5 Mo, 27 784 lignes)
> + 4 captures d'écran (`01_prematch.png`, `02_live.png`, `03_valuebets.png`,
> `04_analytics.png`). Le site live n'était pas fetchable (web_reader en 500),
> mais le code source local est plus précis que tout fetch superficiel.

---

## Pré-flight — système de design détecté

```
· Framework     : Vanilla HTML/JS (legacy) — migration vers Next.js 16 en cours
· Font stack    : 9 Google Fonts chargées (Poppins, Inter, DM Mono, Plus Jakarta,
                  JetBrains Mono, Barlow Condensed, Source Sans 3, Anton, Rajdhani)
                  Tokens actifs : --font-head=Poppins · --font-body=Inter · --font-mono=DM Mono
· Palette       : Dark navy #0b0e17 + accent vert néon #00e676 + rouge #ef4444 + bleu #0077ff
                  (charter "BETMART Dark Navy Premium")
· Motion        : Aucune lib (framer-motion/gsap non détecté) → motion-cut
                  CSS animations maison (skeleton shimmer, pulse, fade-up)
· Genre         : data-dashboard (pas landing page SaaS — règles différentes)
· Spacing       : pas d'échelle formalisée (mix px/rem ad hoc)
· Framework CSS : aucun (CSS inline dans 5 blocs <style>)
```

**Verdict immédiat** : la palette et le positionnement dark-neon évitent le pire
AI-slop tell (purple-gradient hero). Le système a une **identité réelle**. Mais
le fichier est obèse (1,5 Mo inline, 468 gradients, 100 backdrop-filter, 609
box-shadow) — le problème n'est pas l'esthétique mais la **discipline**.

---

## Findings — groupés par sévérité

### 🔴 Critical (ships as slop)

#### C1 · 9 polices chargées pour 3 rôles — `pariscore.html:280`

```
<link href="https://fonts.googleapis.com/css2?
  family=DM+Mono&family=JetBrains+Mono&family=Plus+Jakarta+Sans
  &family=Barlow+Condensed&family=Source+Sans+3&family=Anton
  &family=Rajdhani&family=Poppins&family=Inter" ...>
```

Seules 3 sont référencées dans `:root` (`--font-head=Poppins`, `--font-body=Inter`,
`--font-mono=DM Mono`). Les 6 autres (JetBrains Mono, Plus Jakarta, Barlow
Condensed, Source Sans 3, Anton, Rajdhani) sont probablement des reliques de
tests/itérations jamais nettoyées. **Impact perf** : ~800 Ko de fonts chargées
pour rien, coût LCP direct.

**Pourquoi c'est un tell** : une page qui charge 9 polices en trébuche sous son
propre poids. Le slop-test Hallmark gate 11 (font-discipline) échoue ici.

→ **Fix** : garder `Poppins + Inter + DM Mono`. Supprimer les 6 autres du
`<link>` Google Fonts. Si une section spécifique (CS2, F1, NBA) utilise
ponctuellement une autre police, la charger en `font-display: swap` uniquement
sur cette route.

---

#### C2 · Aurora-blob backgrounds sur sections (×12+) — `pariscore.html:13414, 14713, 14026, 4183, 19297, 6290, 13419`

```css
background: radial-gradient(ellipse 60% 30% at 70% 50%, rgba(0,230,118,0.04) 0%, transparent 60%);
/* section "historique", "fade-up", sport-hub-css, acca-panel, etc. */
```

Pattern massivement répété : `radial-gradient(ellipse ... rgba(<accent>, 0.04) ... transparent ...)`
sur fond de sections. C'est l'**aurora-blob signature** — l'anti-pattern Hallmark
*nommé* (`anti-patterns.md` § Aurora-blob background). Sur un dashboard dark,
ça lit comme "j'avais de l'espace à meubler, j'ai mis un halo".

**Pourquoi c'est un tell** : aurora-blobs = Dribbble 2022, pattern-match
immédiat en template-AI. Sur 12+ sections répétées, l'effet est inverse : au
lieu d'apporter de la profondeur, ça uniformise et aplatit.

→ **Fix** : remplacer par une surface unie `var(--bg2)` ou, si profondeur
vraiment nécessaire, un `linear-gradient(180deg, var(--bg), var(--bg2))`
2-stops strict (anti-patterns.md § Aurora fix). Supprimer 10 des 12 occurrences.

---

#### C3 · Bordures animées cyan→green (PLATINUM / HOT) — `pariscore.html:13465, 7855, 13465, 8839`

```css
background: linear-gradient(135deg, #00d4ff 0%, #00e676 100%);
/* "Best edge HOT cell : PLATINUM gradient + halo glow pulse" */
background: linear-gradient(90deg, var(--text) 0%, var(--accent) 100%);
```

Dégradés cyan→vert animés en bordure de cellules "premium". C'est le **gradient
purple-to-pink transposé** : même signature visuelle, juste sur une autre
palette. Hallmark flagge explicitement ce pattern
(`anti-patterns.md` § gradient headline, décliné).

**Pourquoi c'est un tell** : un utilisateur de paris qui voit une cellule qui
clignote en cyan-vert pense "effet spécial" pas "donnée fiable". Pour un produit
quantitatif qui se veut sérieux, l'effet nuit à la crédibilité.

→ **Fix** : pour distinguer les edges premium, utiliser un **accent solide**
(`var(--accent)` sur border-left 3px) ou un badge "HOT" typographique. Couper
l'animation — la donnée parle d'elle-même.

---

#### C4 · `transition: all` (×29 occurrences) — `pariscore.html` (diffus)

```css
transition: all 0.2s ease;
```

Présent 29 fois. `transition: all` anime **toutes** les propriétés — y compris
celles qui doivent être instantanées (`visibility`, focus rings, `display`).
C'est le microinteraction-tell nommé Hallmark (`anti-patterns.md` § transition-all).

**Pourquoi c'est un tell** : UI mollassonne, focus rings qui apparaissent en
fondu (fail accessibilité — gate 38b), hover qui animation des propriétés
inattendues lors d'update de state.

→ **Fix** : remplacer chaque occurrence par une liste explicite :
`transition: background-color 200ms var(--ease-out), transform 100ms var(--ease-out)`.

---

#### C5 · `fade-up` sur section (×24) — universal scroll-triggered — `pariscore.html:14026, 14713, 13414, 4183`

```html
<section class="section fade-up" ...>
```

Chaque section fade-in quand elle entre dans le viewport. 24 occurrences.
Hallmark nomme ça `Animate-on-scroll on everything`
(`anti-patterns.md`) : "Every section fades in when it enters the viewport.
The page never settles."

**Pourquoi c'est un tell** : sur un dashboard data-dense, l'utilisateur **scroll
pour comparer des données**, pas pour découvrir du contenu. Le fade-up à chaque
section ralentit la lecture, donne une impression de page qui "charge en
permanent", et sur mobile cause des janks.

→ **Fix** : une seule orchestrated entrance au premier load. Après ça, les
sections sont **just there**. Si tu veux signaler le live update, un pulse
ponctuel sur la cellule qui change — pas un fade global.

---

### 🟠 Major (looks AI-generated)

#### M1 · 100 occurrences de `backdrop-filter` (glassmorphism massif) — `pariscore.html` (diffus)

100 `backdrop-filter: blur(...)`. Le glassmorphism est utilisé comme **décoration**
sur des surfaces qui n'ont aucun contenu derrière à flouter. Hallmark :
"Glassmorphism can work when it communicates depth (overlay over content). It
cannot work as decoration" (`anti-patterns.md` § Glassmorphism without purpose).

**Coût caché** : `backdrop-filter` est l'une des props CSS les plus chères à
compositing — 100 occurrences = GPU saturé sur mid-range mobile.

→ **Fix** : réserver `backdrop-filter` aux overlays réels (modale par-dessus le
content, sticky header qui floute le scroll). Remplacer le reste par
`background: var(--bg2)` opaque ou `rgba()` semi-transparent sans blur.

---

#### M2 · 609 `box-shadow` — pollution visuelle — `pariscore.html` (diffus)

609 occurrences de box-shadow. Sur dark theme, Hallmark est explicite :
"On dark surfaces, use elevation via *lightness* (brighter surface = higher),
not shadow" (`anti-patterns.md` § Shadow-glow on dark). Les ombres sur dark
donnent un effet "glow halo" qui lit comme dashboard-template-2022.

→ **Fix** : remplacer par un système d'élévation par luminosité :
```
Niveau 0 (bg)      : #0b0e17
Niveau 1 (card)    : #0e121e  (+3% lightness)
Niveau 2 (raised)  : #131722  (+6%)
Niveau 3 (overlay) : #161c2a  (+9%)
```
Réserver `box-shadow` aux dropdowns/popovers qui flottent vraiment.

---

#### M3 · Poppins en display + Inter en body — la paire "safe" par excellence

`--font-head: 'Poppins'` + `--font-body: 'Inter'`. C'est la paire font la plus
utilisée des dashboards AI-generated 2024-2026. Pas un tell *critique* (les deux
sont compétentes), mais c'est la paire "default" — Hallmark appelle ça
`Inter-everywhere` décliné (`anti-patterns.md`).

Pour un produit qui se positionne en **quantitatif premium** (Poisson, Power
Score V2, calibration no-vig), une typographie plus distinctive renforcerait
l'identité. Poppins est arrondie/amicale — ça lit "consumer app", pas "engineered
tool".

→ **Fix** (optionnel, goût) : pour un positionnement plus "terminal/trader",
essayer `Space Grotesk` (head) + `Inter` (body) + `JetBrains Mono` (chiffres).
Pour du plus éditorial : `Instrument Serif` (head) + `Inter` (body). Le mono
dédié aux chiffres (DM Mono actuel) est **excellent** à garder — c'est ce qui
distingue un dashboard sérieux (chiffres alignés en tabular-nums).

---

#### M4 · Inline `style="..."` massif (headless CSS) — `pariscore.html:14123, 14713, 14026, 21832`

```html
<div style="background:linear-gradient(135deg,rgba(0,230,118,0.08),rgba(249,168,37,0.12));
            border:1px solid rgba(0,230,118,0.25);border-radius:10px;padding:12px 16px;...">
```

Des dizaines de blocs avec CSS inline complet. C'est du token improvisation
mid-render — l'anti-pattern Hallmark `Mid-render token improvisation`
(`anti-patterns.md`). Le fichier a un système de tokens `:root` (bien), mais
l'inline bypass ce système → dérive des couleurs au fil des éditions.

→ **Fix** : extraire chaque style inline dans une classe. Toute couleur doit
passer par `var(--token)`. Le test : `grep -c "rgba\|#[0-9a-f]" pariscore.html`
devrait tomber drastiquement.

---

#### M5 · `z-index` ad hoc — pas d'échelle nommée — `pariscore.html` (diffus)

Pas de système de z-index. Valeurs ad hoc (`z-index: 5`, `9999`, etc.) au fil
du code. Hallmark (`anti-patterns.md` § `z-index: 9999`) : utiliser une échelle
nommée à 6 niveaux.

→ **Fix** : définir dans `:root` :
```css
--z-base: 0; --z-raised: 10; --z-sticky: 100; --z-dropdown: 1000;
--z-overlay: 2000; --z-modal: 3000; --z-toast: 4000;
```

---

### 🟡 Minor (small taste issues)

#### m1 · `text-transform: uppercase` sur tous les labels

`text-transform: uppercase; letter-spacing: 0.04em;` sur `.mcd-reco`, `.mc-grp`,
`.mcd-c span`, etc. Très SaaS-template. Pas un slop dur, mais à utiliser avec
parcimonie — ça lit "kicker/eyebrow" si surutilisé.

→ **Fix** : varier — sentence case pour les labels principaux, upper uniquement
pour les tags courts (LIVE, HOT, PRO).

---

#### m2 · `border-radius` variables pas tout à fait cohérentes

```
--radius: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-sm: 6px; --radius-pill: 999px;
```
Échelle correcte, mais des `border-radius: 10px`, `4px`, `18px` inline parsèment
le code — bypass du token.

→ **Fix** : `grep -oE "border-radius:\s*[0-9]+px"` et remplacer par les tokens.

---

#### m3 · Mix de `px` et `rem` sans logique claire

Le `:root` définit du `8px`, `12px` etc. Les composants inline utilisent
`14px`, `9px`, `1rem`. Pas d'échelle de spacing formalisée.

→ **Fix** : échelle 4-pt (`--space-1: 4px` à `--space-16: 64px`), tout passer en
`rem` (sauf borders 1px).

---

## Résumé audit Hallmark

```
Summary — 5 critical · 5 major · 3 minor
Verdict — reads as data-dashboard with AI-template decoration layer.
          Identité de palette forte (dark navy + neon green), mais
          la couche ornementale (aurora-blobs, glassmorphism, bordures
          cyan-vert animées, fade-up) lit comme overlay template.
          Le squelette est bon ; le maquillage est à revoir.
```

**Le projet n'est pas "AI slop"**. La palette, le dark navy, le mono dédié aux
chiffres, la grille data-dense — tout ça a une **identité réelle**. Le problème
est une **couche décorative** empilée au fil des features (12 sports × 10
itérations = 468 gradients), qui masque cette identité sous des tells
reconnaissables. **Nettoyer la couche ornementale révèle la qualité du squelette.**

---

# Évolutions potentielles & améliorations

Au-delà de l'audit Hallmark, voici les axes d'évolution stratégiques pour
pariscore.fr, hiérarchisés par impact/valeur.

## 🚀 Priorité 1 — Performance & qualité perçue (1-2 semaines)

### 1.1 Purge des 9 → 3 fonts
Gain estimé : **-700 Ko** au premier load, -200 ms LCP.
- Garder : Poppins (display) + Inter (body) + DM Mono (chiffres).
- Vérifier les usages residuels des 6 autres (`grep "Barlow\|Rajdhani\|Anton\|..."`).
- Si section spécifique (CS2, F1) en a vraiment besoin → `font-display: swap`
  + lazy-load via `preload` uniquement sur cette route.

### 1.2 Déduplication des 468 gradients → 30 utility classes
Actuellement chaque développeur réinvente le même gradient inline. Créer :
```css
.g-bar-green      { background: linear-gradient(90deg, var(--accent), var(--accent-dim)); }
.g-bar-blue       { background: linear-gradient(180deg, var(--blue), #005ecb); }
.g-bar-red        { background: linear-gradient(135deg, var(--red), var(--red-bg)); }
.g-skeleton       { background: linear-gradient(100deg, var(--bg) 30%, var(--bg3) 50%, var(--bg) 70%); }
/* …10-15 patterns covering 90% des 468 occurrences */
```
Puis `grep -c "gradient"` doit tomber sous 50.

### 1.3 Glassmorphism audit (100 → 20 occurrences)
- Conserver `backdrop-filter` sur : sticky header, modale, popover, dropdown.
- Supprimer sur : cards statiques, sections, badges.
- Gain GPU sur mobile mid-range : significatif.

### 1.4 Lazy-load par route sport
CS2, F1, NBA, MMA ont leur propre bloc `<style id="sport-hub-css">` (ligne 13227),
`<style id="strategy-setup-css">` (13414). Charger ces blocs uniquement quand
l'onglet est activé, pas au load initial. **Gain estimé** : -200-400 Ko sur
first paint pour un user qui ne visite que football.

---

## 🎨 Priorité 2 — Identité visuelle distinctive (2-3 semaines)

### 2.1 Système d'élévation par luminosité (remplace 609 box-shadow)
Sur dark theme, les ombres lisent comme "glow template". Remplacer par :
```css
--elev-0: var(--bg);      /* page background */
--elev-1: var(--bg2);     /* card */
--elev-2: var(--bg3);     /* card hovered / active */
--elev-3: var(--bg4);     /* modal / overlay */
--elev-4: #1d2436;        /* toast / highest */
```
Chaque niveau = +3-4% lightness. L'œil perçoit la hiérarchie sans ombres.

### 2.2 Refonte de la couche "premium" (cyan→green animated borders)
Les cellules "HOT/PLATINUM/BEST EDGE" actuelles clignotent en cyan-vert.
Remplacer par un **langage de statut typographique** :
- Edge fort : `var(--accent)` sur border-left 3px + badge `HOT` mono-cap
- Edge très fort : badge `★★★` ou chiffre précis (Edge: +6.2%)
- Pas d'animation — la donnée parle.

### 2.3 Repenser les "aurora-blobs" en information
Les 12+ `radial-gradient(..., transparent 60%)` décoratifs sont du bruit.
**Conversion** : si la section mérite un signal visuel, faire parler la donnée
(encadrer un KPI, agrandir un chiffre), pas un halo. Si elle ne mérite pas de
signal, fond uni.

### 2.4 Système d'espacement formel
Définir dans `:root` :
```css
--space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem;
--space-6: 1.5rem; --space-8: 2rem; --space-12: 3rem; --space-16: 4rem;
```
Migrer les px/rem ad hoc vers ces tokens. Les sections gagneront en rythme.

---

## 🧱 Priorité 3 — Migration Next.js : opportunity design system (en cours)

Le projet migre de `pariscore.html` (vanilla 1.5 Mo) vers **Next.js 16 + shadcn/ui
+ Tailwind 4**. C'est **l'occasion** de faire les choses propres :

### 3.1 `tokens.css` central (anti inline-style)
Toute couleur passe par `var(--token)`. Avant chaque merge de route migrée,
checker : `grep "rgba\|#..." | wc -l` < 20. Au lieu de 4000+ actuels.

### 3.2 shadcn/ui components pour les patterns répétitifs
- Card match → `<MatchCard>` (au lieu de 12 variantes inline)
- Tabs → `<Tabs>` shadcn (au lieu des `data-tab` maison)
- Badge statut → `<Badge variant="hot|pro|live|edge">`
- Modal détaillée → `<Dialog>` Radix
Gain : -80% de CSS inline, +1 type de composant par pattern.

### 3.3 Route-level code splitting
Chaque sport en route Next.js (`app/(sports)/football/page.tsx`) charge uniquement
ses propres styles. Fin du monolithe 1.5 Mo.

### 3.4 Locker le système avec `design.md`
Quand la migration sera avancée, demander à Hallmark `lock the system` pour
générer un `design.md` portable — empêche la dérive future.

---

## 📊 Priorité 4 — Spécificités produit (data-dashboard)

Hallmark est calibré pour des landing pages ; un dashboard data a des règles
différentes. Ce qui compte pour pariscore.fr :

### 4.1 `tabular-nums` sur toutes les colonnes de chiffres
Hallmark le flagge (`anti-patterns.md` § Tabular data without tabular-nums).
Sur pariscore.fr les colonnes d'odds/proba doivent avoir :
```css
font-variant-numeric: tabular-nums;
font-feature-settings: 'tnum';
```
Sinon les chiffres bougent à chaque update live — effet "amateur".

### 4.2 Reduced-motion respect
`prefers-reduced-motion: reduce` doit couper skeleton shimmer, pulse, fade-up.
Actuellement partielle. Pour un user qui consulte les scores au travail, moins
de motion = plus lisible.

### 4.3 Skeleton → données transition
Actuellement le skeleton shimmer tourne jusqu'à fetch. Sur un dashboard
quantitatif, **un état "—" (em-dash, tabular-nums) vaut mieux qu'un shimmer** —
ça communique "donnée en attente" sans animation.

### 4.4 Live update affordance
Quand une odd change en live, un pulse ponctuel (1 fois, 200 ms) sur la cellule
est utile. Mais pas le `fade-up` global. Hallmark : "Pick one signal per element."

---

## 🎯 Priorité 5 — Audit annexe hors Hallmark (qualité code)

### 5.1 Le fichier `pariscore.html` (1,5 Mo, 27 784 lignes) est ingérable
C'est un monolithe. La seule lecture prend plusieurs secondes aux outils. Tout
édit coûte un scan complet. **La migration Next.js est la priorité absolue** —
chaque feature migrée diminue ce fichier.

### 5.2 XSS onclick template literals (déjà documenté)
Voir `AGENTS.md` § "Session: XSS onclick template literals (2026-07-05)". 20
handlers sanitisés via `_jsStr()`. Vérifier qu'aucune nouvelle interpolation
`${}` est apparue depuis.

### 5.3 CSS inline dans HTML → extraction
Le fichier mélange HTML + 5 blocs `<style>` + JS inline. Extraire le CSS dans
`/styles/*.css` avec cache-control longue durée. Gain de cache navigateur massif.

---

## 📋 Plan d'action recommandé (Quick wins first)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Purge fonts 9→3 | 0.5 j | LCP -200ms |
| 2 | Remplacer `transition: all` (29 occ) | 0.5 j | UX + a11y |
| 3 | Couper fade-up sur scroll (24 occ) | 0.5 j | UX mobile |
| 4 | Dédupliquer gradients en utility classes | 2 j | Maintenance |
| 5 | Glassmorphism 100→20 | 1 j | GPU mobile |
| 6 | Extraire styles inline → classes | 3 j | Cohérence tokens |
| 7 | Système z-index nommé | 0.5 j | Maintenabilité |
| 8 | `tabular-nums` sur colonnes chiffres | 0.5 j | Pro |
| 9 | Bordures cyan→vert → typographie statut | 1 j | Crédibilité |
| 10 | Système d'élévation luminosité | 2 j | Identité |
| 11 | Aurora-blobs → info ou fond uni | 1 j | Nettoyage |
| 12 | Lazy-load CSS par route sport | 2 j | First paint |

**Total** : ~15 jours pour transformer "dashboard avec overlay template" en
"outil quantitatif avec identité propre". À faire en parallèle de la migration
Next.js (chaque route migrée applique les nouveaux principes).

---

## Références Hallmark utilisées

- [`anti-patterns.md`](.agents/skills/hallmark/references/anti-patterns.md) — liste nommée des tells (critical/major/minor)
- [`verbs/audit.md`](.agents/skills/hallmark/references/verbs/audit.md) — protocole audit
- [`SKILL.md`](.agents/skills/hallmark/SKILL.md) § Disciplines (locked tokens, typography purity, mobile-responsive)

## Caveats

- **Audit basé sur code source local** + captures d'écran du 6 juillet 2026. Le
  site live n'était pas fetchable (`web_reader` en 500 — erreur réseau).
- **Hallmark calibré landing pages** : un dashboard data a des règles différentes.
  J'ai adapté les findings en gardant les tells pertinents (glassmorphism
  décoratif, transition:all, aurora-blobs) et en écartant ceux qui ne s'appliquent
  pas (hero gradient, AI nav, 3-column feature grid — pas pertinents pour un dashboard).
- **Aucune édition effectuée** (audit seul, conformément au protocole Hallmark).

---

*Rapport généré par `hallmark audit https://pariscore.fr/` — 2026-07-13.*
