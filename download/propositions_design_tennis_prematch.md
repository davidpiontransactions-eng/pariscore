# Tennis Prematch — Refonte de l'encart « 84 % »

> Livrable de phase de conception (validation requise avant implémentation)
> Date : 2026-07-05
> Contributeurs simulés : Lead UI/UX · Graphiste senior · Data Scientist

---

## 0. Contexte et diagnostic partagé

### 0.1 État actuel (capture fournie)

L'onglet **Tennis Prematch** affiche actuellement un duel **Aryna Sabalenka (#1, Elo 2052) vs Naomi Osaka (#14, Elo 1759)**. Au centre, un encart **« 84 % »** flanqué de deux barres verticales (verte à gauche, grise à droite) indique la probabilité de victoire du favori.

### 0.2 Ce qui ne va pas (cadrage par les 3 expertises)

**Lead UI/UX**
- L'encart 84 % **flotte** sans conteneur, sans bordure, sans fond : il n'a pas d'ancrage spatial et casse la grille.
- La **hiérarchie visuelle est inversée** : le chiffre 84 % attire l'œil plus que les noms des joueuses, alors qu'il devrait être une *lecture secondaire* après l'identité du match.
- Aucune **affordance** : l'utilisateur ne sait pas s'il peut interagir (voir le détail du modèle ? changer de marché ?).
- Pas de **responsive story** : sur mobile étroit, l'empilement vertical actuel devient illisible.

**Graphiste senior**
- Typographie du 84 % en **gras brut, sans coquille** → look daté « pari sportif 2015 ».
- La **barre verte / barre grise** est asymétrique sémantiquement (le gris n'est pas la couleur d'Osaka, c'est juste « l'autre »).
- **Palette absente** : aucun système de couleur (pas d'accent, pas de token dark/light).
- Aucun **micro-détail** : pas d'ombre portée, pas de verre dépoli, pas de grain, pas de motion.

**Data Scientist**
- Un seul nombre **84 %** sans source, sans intervalle de confiance, sans modèle sous-jacent → l'utilisateur averti ne fait pas confiance.
- L'écart Elo (2052 vs 1759 = +293) correspond environ à ~83-85 % sur surface dure : c'est cohérent, mais le **« 16 % » implicite d'Osaka est invisible** (la barre grise ne le dit pas).
- Aucune **décomposition** : forme récente, surface, H2H, fatiguerait aiderait à crédibiliser le chiffre.
- Le **sens** du chiffre (84 % pour Sabalenka) n'est pas explicité : un utilisateur peut penser « 84 % de chance que le match se joue ».

### 0.3 Brief consolidé

| Dimension | Objectif |
|---|---|
| Hiérarchie | Identité du match > probabilité > contexte |
| Densité info | Garder la lecture en < 3 s, mais révéler 1 niveau de détail au hover/tap |
| Style | Premium sport-tech (Apple TV Sports / ESPN+ / The Athletic) |
| Couleur | Système dark + light, accent jouable |
| Data | Probabilité crédibilisée + décomposition accessible |
| Responsive | Mobile-first, empilement propre ≤ 480 px |

---

## 1. Méthodologie

1. **Recherche web** (Dribbble, UX Design, OddsMatrix, MDPI tennis prediction models, Flerlage Twins radial progress, datavizproject.com, Elo tennis rescaling).
2. **Trois directions** volontairement contrastées pour couvrir l'espace de solution :
   - **Proposition A — Split Battle Card** (carte duelle horizontale, gradient VS)
   - **Proposition B — Radial Gauge Hub** (jauge circulaire centrale premium)
   - **Proposition C — Tactical Tug-of-War Bar** (barre fluide horizontale analytique)
3. Chaque proposition est évaluée sur 4 axes : **UI/UX**, **Graphisme**, **Data**, **Implémentation**.

---

## 2. Proposition A — « Split Battle Card »

### 2.1 Concept

Une **carte unique** découpée en deux moitiés qui se font face. La probabilité de victoire est **intégrée à chaque moitié** sous forme d'un arc de cercle en bas du blason joueur. Le centre est occupé par un **« VS » minimaliste** dans un cercle verre-dépoli. Aucun encart 84 % isolé : le chiffre **84** est attaché à Sabalenka, le **16** à Osaka — chacun dans sa couleur.

**Inspirations web** : Apple TV MLS Season Pass (cards duel), ESPN+ match facts, Dribbble "match prediction card", The Athletic match hub.

### 2.2 Mockup ASCII (desktop ≥ 768 px)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌───────────────────────┐   ┌───┐   ┌───────────────────────┐ │
│   │                       │   │VS │   │                       │ │
│   │      [Photo S.]       │   │ • │   │      [Photo O.]       │ │
│   │                       │   └───┘   │                       │ │
│   │   ARYNA SABALENKA     │           │   NAOMI OSAKA         │ │
│   │   #1   ·   Elo 2052   │           │   #14  ·   Elo 1759   │ │
│   │                       │           │                       │ │
│   │   ╭───────────────╮   │           │   ╭───────────────╮   │ │
│   │   │  84%  WIN      │   │           │   │  16%  WIN      │   │ │
│   │   │ ██████████░░   │   │           │   │ ██░░░░░░░░░░   │   │ │
│   │   ╰───────────────╯   │           │   ╰───────────────╯   │ │
│   │   Surface dur · 5-2 H2H│          │   Forme : 3V-2D       │ │
│   └───────────────────────┘           └───────────────────────┘ │
│                                                                 │
│   [Détail modèle ▾]                              [Voir cotes →] │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Palette

| Token | Valeur (light) | Valeur (dark) | Usage |
|---|---|---|---|
| `--bg` | `#F7F8FA` | `#0B0F14` | Fond page |
| `--surface` | `#FFFFFF` | `#161B22` | Carte |
| `--player-a` | `#1B4332` (vert profond) | `#51CF66` | Sabalenka (favori) |
| `--player-b` | `#5C2D91` (violet) | `#B197FC` | Osaka (challenger) |
| `--accent` | `#FFB020` | `#FFD43B` | Highlight VS, hover |
| `--text` | `#0F1419` | `#F0F3F5` | Noms |
| `--text-muted` | `#6B7280` | `#9AA4AE` | Elo, surface |
| `--border` | `#E5E7EB` | `#2A313C` | Séparateurs |

> **Note graphiste** : la couleur du favori n'est plus « verte par défaut » — elle est **attachée au joueur** et dérivée de son pays/équipe/identité. Ici, Sabalenka en vert profond rappelle son sponsor, Osaka en violet son identité visuelle.

### 2.4 Typographie

- **Noms** : `Inter` 22 px / 600 / -0.02em (tracking serré pour impact)
- **Rang & Elo** : `Inter` 13 px / 500 / `--text-muted`, tabular nums
- **Probabilité (84 %)** : `Inter` 28 px / 700, **tabular nums** pour alignement
- **Label « WIN »** : `Inter` 11 px / 600 / letter-spacing 0.08em / uppercase
- **VS** : `Inter` 14 px / 700 dans un cercle 44 px, fond `rgba(255,255,255,0.06)` en dark

### 2.5 Spécifications UI/UX

- **Carte** : border-radius 20 px, padding 24 px, shadow `0 8px 32px rgba(0,0,0,0.08)` (light) / `0 8px 32px rgba(0,0,0,0.4)` (dark), border 1 px `--border`.
- **Photo joueur** : 96 × 96 px, border-radius 50 %, ring 2 px dans la couleur joueur.
- **Arc de probabilité** : anneau SVG 8 px d'épaisseur, départ à 12 h, sens horaire. La portion remplie prend la couleur joueur, le reste est `--border`. **Le nombre 84 % est centré sur l'anneau**, à droite du nom.
- **Hover** : élévation `translateY(-2px)`, ombre plus marquée, l'arc s'anime (1 s ease-out, `stroke-dashoffset`).
- **Tap / clic** : expansion d'un panneau détail (modèle, surface, H2H, forme) en accordéon sous la carte — pas de navigation.

### 2.6 Data Science

- **Deux nombres visibles** (84 / 16), pas un seul → **suppression de l'ambiguïté** sur le sens.
- **Légende** « WIN » attachée → l'utilisateur comprend que c'est une probabilité de victoire, pas un taux de réussite passé.
- **Panneau détail** révèle : modèle (Elo + forme + surface), intervalle de confiance [78 %, 89 %], contribution des facteurs.
- **Source affichée** en footer de carte : « Modèle propriétaire · MAJ il y a 12 min ».

### 2.7 Pros / Cons

| Pros | Cons |
|---|---|
| Très lisible, hiérarchie claire | Demande 2 anneaux SVG (légère complexité) |
| Chaque joueur a sa couleur → identité forte | Sur mobile, les deux moitiés se stacked → nécessite variante |
| Premium, aligné Apple TV / ESPN+ | Peut sembler moins « analytique » pour power users |
| Responsive naturel via grid | Nécessite un système de couleur joueur (gestion config) |

### 2.8 Skeleton HTML/CSS

```html
<article class="match-card">
  <div class="player player--a">
    <img class="player__photo" src="sabalenka.jpg" alt="Sabalenka" />
    <h3 class="player__name">Aryna Sabalenka</h3>
    <p class="player__meta">#1 · Elo 2052</p>
    <div class="prob">
      <svg class="prob__ring" viewBox="0 0 80 80">
        <circle class="prob__track" cx="40" cy="40" r="34" />
        <circle class="prob__fill prob__fill--a" cx="40" cy="40" r="34"
                stroke-dasharray="213.6" stroke-dashoffset="34.2" />
      </svg>
      <div class="prob__label">
        <span class="prob__value">84%</span>
        <span class="prob__caption">WIN</span>
      </div>
    </div>
  </div>

  <div class="vs"><span>VS</span></div>

  <div class="player player--b">
    <!-- miroir pour Osaka, prob__fill--b, dashoffset=179.4 -->
  </div>

  <details class="match-card__details">
    <summary>Détail du modèle</summary>
    <!-- modèle, IC, surface, H2H -->
  </details>
</article>
```

```css
.match-card {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
}
.player { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.prob { position: relative; width: 96px; height: 96px; }
.prob__ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.prob__track { fill: none; stroke: var(--border); stroke-width: 8; }
.prob__fill { fill: none; stroke-width: 8; stroke-linecap: round; transition: stroke-dashoffset 1s ease-out; }
.prob__fill--a { stroke: var(--player-a); }
.prob__fill--b { stroke: var(--player-b); }
.prob__label {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.prob__value { font: 700 28px/1 'Inter'; font-variant-numeric: tabular-nums; }
.prob__caption { font: 600 11px/1 'Inter'; letter-spacing: 0.08em; color: var(--text-muted); }
.vs {
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
  display: grid; place-items: center;
  font: 700 14px/1 'Inter';
}
@media (max-width: 480px) {
  .match-card { grid-template-columns: 1fr; }
  .vs { transform: rotate(90deg); margin: -8px auto; }
}
```

---

## 3. Proposition B — « Radial Gauge Hub »

### 3.1 Concept

La probabilité de victoire devient une **jauge radiale centrale** (demi-cercle de 180°), inspirée des dashboards Tesla, des applications fitness Apple Watch et des jauges Bloomberg. Les deux joueuses sont positionnées en **piliers latéraux** ; le **pourcentage est affiché au centre de la jauge** avec le nom du favori en sous-titre. La couleur de la jauge **change en fonction du favori**.

**Inspirations web** : Flerlage Twins radial progress, Tableau half-donut, datavizproject.com gauge, Reddit r/dataisbeautiful match prediction threads, Bloomberg analytics.

### 3.2 Mockup ASCII (desktop ≥ 768 px)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────────┐    ╭───────────────────╮    ┌──────────────┐ │
│   │              │    │        84%        │    │              │ │
│   │  [Photo S.]  │    │                   │    │  [Photo O.]  │ │
│   │              │    │  SABALENKA WIN    │    │              │ │
│   │ ARYNA        │    │ ───────────────── │    │  NAOMI       │ │
│   │ #1  Elo 2052 │    │   ┌─ Favori ─┐    │    │  #14 Elo 1759│ │
│   │              │    │   │ Modèle   │    │    │              │ │
│   │ ●●●●●○       │    │   │ Elo+Form │    │    │ ○○●●●○       │ │
│   │ Forme 5V-1D  │    │   │ IC [78,89]│    │    │ Forme 3V-2D  │ │
│   │              │    │   └──────────┘    │    │              │ │
│   └──────────────┘    ╰───────────────────╯    └──────────────┘ │
│                                                                 │
│   Surface : Dur dur · H2H : 5-2 Sabalenka · Dernière MAJ 12 min │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Palette

| Token | Valeur (dark — recommandé pour ce concept) | Usage |
|---|---|---|
| `--bg` | `#0A0E13` (charbon) | Fond |
| `--surface` | `#11161D` | Carte |
| `--gauge-favori` | gradient `#00D9A3 → #00B4D8` (vert-émeraude → cyan) | Jauge favori |
| `--gauge-rest` | `#1F2933` | Piste jauge |
| `--accent-warn` | `#FFB020` | Si proba ∈ [45 %, 55 %] (match équilibré) |
| `--accent-fire` | `#FF4D6D` | Si proba > 90 % (domination) |
| `--text` | `#F0F3F5` | |
| `--text-muted` | `#7A858F` | |

> **Note graphiste** : le **gradient cyan-vert** est volontairement « sport-tech ». Évite le rouge/vert binaire (problème daltonisme). En cas de match serré (< 55 %), la jauge vire au ambre pour signaler l'incertitude.

### 3.4 Typographie

- **Probabilité centrale** : `Inter` ou `Geist` **56 px / 700 / tabular nums** — c'est le point focal assumé.
- **Sous-titre « SABALENKA WIN »** : `Inter` 13 px / 600 / uppercase / tracking 0.1em.
- **Noms joueurs (piliers)** : `Inter` 18 px / 600.
- **Méta** : `Inter` 12 px / 500 / `--text-muted`.
- **Chips « Modèle / IC »** : `JetBrains Mono` 11 px / 500 (donne un côté data/tech).

### 3.5 Spécifications UI/UX

- **Carte** : border-radius 24 px, padding 32 px, fond `--surface`, border 1 px `rgba(255,255,255,0.04)`, **shadow interne** `inset 0 1px 0 rgba(255,255,255,0.04)` pour effet verre.
- **Jauge** : demi-cercle SVG 280 × 140 px, stroke 16 px, linecap round. Départ à 180°, arrivée à 360°.
- **Animation** : au mount, `stroke-dashoffset` de plein → cible en 1.2 s `cubic-bezier(0.22, 1, 0.36, 1)`. Le nombre 84 % **compte** de 0 à 84 (1.2 s, eased).
- **Piliers joueurs** : largeur fixe 200 px, photo 80 × 80 px en haut, **forme récente** en 6 pastilles (●/○) sous le nom.
- **Ligne de pied** : surface + H2H + MAJ, séparateurs `·`, en `--text-muted` 12 px.
- **Dark mode natif** : ce concept est pensé dark-first (lecture nocturne des paris).

### 3.6 Data Science

- **Jauge = un seul nombre**, mais **explicitement attribué** (« SABALENKA WIN » en sous-titre) → pas d'ambiguïté de sens.
- **IC affiché** [78, 89] sous forme de chip → crédibilise.
- **Pastilles de forme** (5V-1D / 3V-2D) → l'utilisateur voit un signal concret derrière le chiffre.
- **Changement de couleur** si proba < 55 % (ambre « match serré ») → **signal d'incertitude** au lieu d'une fausse précision.
- Si proba > 90 % → couleur `fire` qui signale « domination attendue ».

### 3.7 Pros / Cons

| Pros | Cons |
|---|---|
| Très impactant visuellement | Dark-first : déclinaison light à retravailler |
| Nombre focal = lecture en 1 s | Moins symétrique que A : Osaka « perd » sa proba |
| Signal d'incertitude (couleur) | Plus de complexité d'implémentation (animation, gradient) |
| Premium, mémorable | Risque de surcharger si on ajoute trop de chips |

### 3.8 Skeleton HTML/CSS

```html
<article class="gauge-card">
  <div class="pillar pillar--a">
    <img class="pillar__photo" src="sabalenka.jpg" alt="" />
    <h3 class="pillar__name">ARYNA</h3>
    <p class="pillar__meta">#1 · Elo 2052</p>
    <div class="form form--a" aria-label="Forme 5 victoires 1 défaite">
      <span class="form__dot form__dot--w"></span>
      <span class="form__dot form__dot--w"></span>
      <span class="form__dot form__dot--w"></span>
      <span class="form__dot form__dot--w"></span>
      <span class="form__dot form__dot--w"></span>
      <span class="form__dot form__dot--l"></span>
    </div>
  </div>

  <div class="gauge">
    <svg class="gauge__svg" viewBox="0 0 280 160">
      <path class="gauge__track" d="M20,140 A120,120 0 0 1 260,140" />
      <path class="gauge__fill" d="M20,140 A120,120 0 0 1 260,140"
            stroke-dasharray="377" stroke-dashoffset="60.3" />
    </svg>
    <div class="gauge__readout">
      <span class="gauge__value">84%</span>
      <span class="gauge__caption">SABALENKA WIN</span>
      <div class="gauge__chips">
        <span class="chip">Elo+Form</span>
        <span class="chip">IC [78, 89]</span>
      </div>
    </div>
  </div>

  <div class="pillar pillar--b">
    <!-- miroir Osaka -->
  </div>

  <footer class="gauge-card__foot">
    Surface : Dur · H2H : 5-2 Sabalenka · MAJ 12 min
  </footer>
</article>
```

```css
.gauge-card {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
  gap: 32px;
  padding: 32px;
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 24px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.4);
  color: var(--text);
}
.gauge { position: relative; display: grid; place-items: center; }
.gauge__svg { width: 280px; height: 160px; }
.gauge__track { fill: none; stroke: var(--gauge-rest); stroke-width: 16; stroke-linecap: round; }
.gauge__fill {
  fill: none; stroke: url(#grad-favori); stroke-width: 16; stroke-linecap: round;
  transition: stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.gauge__readout { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 16px; }
.gauge__value { font: 700 56px/1 'Inter'; font-variant-numeric: tabular-nums; }
.gauge__caption { font: 600 13px/1 'Inter'; letter-spacing: 0.1em; color: var(--text-muted); margin-top: 6px; }
.gauge__chips { display: flex; gap: 6px; margin-top: 10px; }
.chip { font: 500 11px/1.6 'JetBrains Mono'; padding: 2px 8px; border-radius: 6px; background: rgba(255,255,255,0.05); color: var(--text-muted); }
.form { display: flex; gap: 4px; margin-top: 8px; }
.form__dot { width: 10px; height: 10px; border-radius: 50%; }
.form__dot--w { background: var(--gauge-favori); }
.form__dot--l { background: var(--gauge-rest); border: 1px solid var(--text-muted); }
@media (max-width: 480px) {
  .gauge-card { grid-template-columns: 1fr; }
  .gauge__value { font-size: 44px; }
}
```

---

## 4. Proposition C — « Tactical Tug-of-War Bar »

### 4.1 Concept

La probabilité devient une **barre horizontale fluide** qui **se tirent** l'un l'autre. La barre est divisée en deux segments proportionnels aux probas (84 % / 16 %), avec un **curseur médian animé** qui se déplace selon la dynamique. Les couleurs sont dérivées de **gradient verso/recto** : la gauche prend la couleur du joueur A, la droite celle du joueur B, et le curseur central est un **point lumineux** qui indique la bascule.

**Inspirations web** : FiveThirtyEight forecasts (modèle Elo), Bloomberg election tug-of-war, The Athletic prediction bars, Reddit r/sportsbook thread visuals, FlowingData tug-of-war dataviz.

### 4.2 Mockup ASCII (desktop ≥ 768 px)

```
┌─────────────────────────────────────────────────────────────────┐
│  TENNIS · PREMATCH                       Modèle Elo+Form · 12min│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐                                     ┌──────────┐ │
│   │ [Photo]  │  ARYNA SABALENKA    NAOMI OSAKA     │ [Photo]  │ │
│   │          │  #1 · Elo 2052       #14 · Elo 1759 │          │ │
│   └──────────┘                                     └──────────┘ │
│                                                                 │
│   ◄──────────────────────────────●──────────────────────────►  │
│   ████████████████████████████████ ░░░░░░░░░░░░░░░░░░░░░░░░░  │
│   84%  SABALENKA                   │                       16% │
│                                   OSAKA                          │
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│   │ Forme   5V-1D   │  │ Surface   Dur   │  │ H2H     5-2     ││
│   │ Elo gap  +293   │  │ IC       [78,89]│  │ Confiance 0.81 ││
│   └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                                                                 │
│   [Explorer le modèle →]              [Voir les cotes du match →]│
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Palette

| Token | Valeur (light) | Valeur (dark) | Usage |
|---|---|---|---|
| `--bg` | `#FAFBFC` | `#0E1217` | Fond |
| `--surface` | `#FFFFFF` | `#161B22` | Carte |
| `--player-a` | `#0F4C81` (bleu marine) | `#4DABF7` | Sabalenka (segment gauche) |
| `--player-b` | `#C9184A` (rouge carmin) | `#FF6B9D` | Osaka (segment droit) |
| `--cursor` | `#FFFFFF` (light) / `#0E1217` (dark) | | Point central |
| `--cursor-glow` | `#FFB020` | `#FFD43B` | Halo du curseur |
| `--chip-bg` | `#F1F3F5` | `#1F2933` | Pastilles stats |
| `--text` | `#0F1419` | `#F0F3F5` | |
| `--text-muted` | `#6B7280` | `#9AA4AE` | |

> **Note graphiste** : on évite le vert/rouge (daltonisme) en faveur de **bleu marine vs rouge carmin** — duo classique et contrasté, lisible en light et dark. Le **halo doré** du curseur signale « l'équilibre théorique à 50 % » : si le curseur s'en éloigne, la couleur reste, c'est sa position qui parle.

### 4.4 Typographie

- **Titre section** : `Inter` 11 px / 700 / tracking 0.12em / uppercase / `--text-muted`.
- **Noms joueurs** : `Inter` 18 px / 600.
- **Rang & Elo** : `Inter` 12 px / 500 / `--text-muted`, tabular nums.
- **Pourcentages (84 % / 16 %)** : `Inter` 22 px / 700, tabular nums.
- **Labels « SABALENKA / OSAKA »** : `Inter` 10 px / 600 / uppercase / tracking 0.1em / `--text-muted`.
- **Stats chips** : `Inter` 12 px / 500, label en `--text-muted` + valeur en `--text`.
- **CTA liens** : `Inter` 13 px / 600, accent `--cursor-glow`.

### 4.5 Spécifications UI/UX

- **Barre** : hauteur 36 px, border-radius 18 px, largeur 100 %. Segment gauche : `background: var(--player-a)` avec gradient subtil `linear-gradient(90deg, transparent, rgba(255,255,255,0.12))`. Segment droit idem avec `--player-b`.
- **Curseur** : cercle 14 px, border 3 px `--cursor`, shadow `0 0 0 4px var(--cursor-glow)` (halo). Positionnée à 84 % de la largeur.
- **Animation** : au mount, le segment gauche **pousse** de 0 % à 84 % en 1.5 s ease-out, le curseur suit.
- **Légendes** : pourcentages **au-dessus** de la barre (à gauche et à droite), labels joueur **en dessous**.
- **Hover sur la barre** : tooltip apparaît (« 84% pour Sabalenka · modèle Elo+Form · IC [78,89] »).
- **Stats chips** : 3 cartes de 1 ligne chacune, fond `--chip-bg`, border-radius 8 px, padding 10 × 14 px.
- **Responsive** : sur mobile, la barre reste horizontale (jamais verticale — ça casserait la métaphore « tug-of-war ») ; les chips passent en grille 1 colonne.

### 4.6 Data Science

- **Barre = décomposition visuelle immédiate** : 84 % vs 16 % se **voient** en un coup d'œil, sans calcul mental.
- **Curseur central** = seuil 50 % : l'utilisateur **voit** à quel point le match est déséquilibré (très loin du curseur = domination).
- **Stats chips** crédibilisent : forme, surface, H2H, IC, confiance du modèle.
- **Tooltip** au hover = couche 2 d'explication sans clutter.
- **Pas d'ambiguïté de sens** : chaque segment porte le nom du joueur + son pourcentage.

### 4.7 Pros / Cons

| Pros | Cons |
|---|---|
| Métaphore intuitive (tug-of-war) | Moins « premium » que B, plus analytique |
| Lecture instantanée des proportions | Demande de la largeur (peu adapté à < 320 px) |
| Excellent pour power users | Peut sembler trop « dataviz » pour grand public |
| Très responsive (barre s'adapte) | Stats chips ajoutent de la hauteur |

### 4.8 Skeleton HTML/CSS

```html
<article class="tug-card">
  <header class="tug-card__head">
    <span class="eyebrow">Tennis · Prematch</span>
    <span class="meta">Modèle Elo+Form · MAJ 12 min</span>
  </header>

  <div class="tug-card__players">
    <div class="player-tug player-tug--a">
      <img src="sabalenka.jpg" alt="" class="player-tug__photo" />
      <div class="player-tug__info">
        <h3>Aryna Sabalenka</h3>
        <p>#1 · Elo 2052</p>
      </div>
    </div>
    <div class="player-tug player-tug--b">
      <div class="player-tug__info">
        <h3>Naomi Osaka</h3>
        <p>#14 · Elo 1759</p>
      </div>
      <img src="osaka.jpg" alt="" class="player-tug__photo" />
    </div>
  </div>

  <div class="tug">
    <div class="tug__labels">
      <span class="tug__pct tug__pct--a">84%</span>
      <span class="tug__pct tug__pct--b">16%</span>
    </div>
    <div class="tug__bar" role="img" aria-label="Probabilité de victoire">
      <div class="tug__fill tug__fill--a" style="--w: 84%"></div>
      <div class="tug__fill tug__fill--b" style="--w: 16%"></div>
      <div class="tug__cursor" style="--pos: 84%"></div>
    </div>
    <div class="tug__names">
      <span class="tug__name tug__name--a">SABALENKA</span>
      <span class="tug__name tug__name--b">OSAKA</span>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><span>Forme</span><strong>5V-1D</strong></div>
    <div class="stat"><span>Elo gap</span><strong>+293</strong></div>
    <div class="stat"><span>Surface</span><strong>Dur</strong></div>
    <div class="stat"><span>H2H</span><strong>5-2</strong></div>
    <div class="stat"><span>IC</span><strong>[78, 89]</strong></div>
    <div class="stat"><span>Confiance</span><strong>0.81</strong></div>
  </div>

  <footer class="tug-card__foot">
    <a class="link" href="#">Explorer le modèle →</a>
    <a class="link" href="#">Voir les cotes du match →</a>
  </footer>
</article>
```

```css
.tug-card { padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; }
.tug-card__head { display: flex; justify-content: space-between; align-items: baseline; }
.eyebrow { font: 700 11px/1 'Inter'; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
.meta { font: 500 12px/1 'Inter'; color: var(--text-muted); }
.tug-card__players { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0 24px; }
.player-tug { display: flex; gap: 12px; align-items: center; }
.player-tug--b { justify-content: flex-end; }
.player-tug__photo { width: 48px; height: 48px; border-radius: 50%; }
.tug { margin: 24px 0; }
.tug__labels, .tug__names { display: flex; justify-content: space-between; }
.tug__pct { font: 700 22px/1 'Inter'; font-variant-numeric: tabular-nums; }
.tug__pct--a { color: var(--player-a); }
.tug__pct--b { color: var(--player-b); }
.tug__bar {
  position: relative; height: 36px; margin: 8px 0;
  border-radius: 18px; overflow: hidden;
  background: var(--player-b);
}
.tug__fill--a {
  position: absolute; inset: 0 auto 0 0; width: var(--w);
  background: linear-gradient(90deg, var(--player-a), color-mix(in srgb, var(--player-a) 85%, white));
  border-radius: 18px 0 0 18px;
  animation: tug-grow 1.5s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes tug-grow { from { width: 0; } to { width: var(--w); } }
.tug__cursor {
  position: absolute; top: 50%; left: var(--pos); transform: translate(-50%, -50%);
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--cursor); border: 3px solid var(--cursor);
  box-shadow: 0 0 0 4px var(--cursor-glow), 0 2px 6px rgba(0,0,0,0.2);
  transition: left 1.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.tug__name { font: 600 10px/1 'Inter'; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
.stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 20px 0; }
.stat { padding: 10px 14px; background: var(--chip-bg); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
.stat span { font: 500 11px/1 'Inter'; color: var(--text-muted); }
.stat strong { font: 600 14px/1 'Inter'; font-variant-numeric: tabular-nums; }
.tug-card__foot { display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--border); }
.link { font: 600 13px/1 'Inter'; color: var(--cursor-glow); text-decoration: none; }
@media (max-width: 640px) {
  .stats { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 480px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
}
```

---

## 5. Tableau comparatif

| Critère | A — Split Battle Card | B — Radial Gauge Hub | C — Tactical Tug-of-War |
|---|---|---|---|
| **Lecture 1 s** | ★★★★☆ | ★★★★★ | ★★★★★ |
| **Premium / moderne** | ★★★★★ | ★★★★★ | ★★★★☆ |
| **Crédibilité data** | ★★★★☆ | ★★★★☆ | ★★★★★ |
| **Symétrie joueurs** | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| **Responsive mobile** | ★★★★☆ | ★★★★☆ | ★★★★★ |
| **Accessibilité (daltonisme)** | ★★★★☆ | ★★★★☆ | ★★★★★ |
| **Complexité implémentation** | Moyenne | Élevée | Faible |
| **Coût motion design** | Faible | Élevé | Moyen |
| **Cible privilégiée** | Grand public premium | Power users premium | Analystes / dataviz |
| **Inspirations clés** | Apple TV, ESPN+, The Athletic | Tesla, Apple Watch, Bloomberg | FiveThirtyEight, The Athletic |

---

## 6. Recommandation initiale (non contraignante)

Sans avoir votre retour, mon **choix par défaut** serait la **Proposition A — Split Battle Card**, car elle :
- résout tous les problèmes identifiés (hiérarchie, ancrage, couleur attachée au joueur),
- s'inscrit dans la **tendance premium actuelle** (Apple TV Sports, ESPN+),
- reste **implémentable sans excès** (SVG rings + grid CSS),
- se décline bien en **light et dark**.

**Mais** la Proposition C est meilleure si votre audience est **plus analytique / parieurs sérieux**, et la Proposition B si vous voulez un **effet wow mémorable** en page d'accueil.

---

## 7. Prochaines étapes (après votre validation)

1. Vous choisissez **une** proposition (ou me demandez de fusionner, ex. « A + stats chips de C »).
2. Je produis un **prototype HTML/CSS standalone** cliquable (avec données mockées Sabalenka vs Osaka) dans `/home/z/my-project/download/prototype.html`.
3. Validation visuelle → **intégration** dans le composant React/Next.js existant de l'onglet Tennis Prematch.
4. Tests : responsive 320/768/1280, dark/light, daltonisme (simulateur), Lighthouse perf.

---

## 8. Sources web consultées

- Dribbble — *sports odds / win probability / match prediction card* : https://dribbble.com/search/sports-odds , https://dribbble.com/search/win-probability , https://dribbble.com/search/match-prediction-card
- Dribbble — *TennisBetting Web Match Overview Dashboard* : https://dribbble.com/shots/26651591
- UX Design — *« Winning » by design: deceptive UX patterns and sports betting apps* : https://uxdesign.cc/winning-by-design-deceptive-ux-patterns-and-sports-betting-apps-1a9f0e1deaad
- OddsMatrix — *UI/UX Tips for Flawless Betting User Experience* : https://oddsmatrix.com/betting-user-experience
- Medium — *Good UI/UX For Sports Betting Platform* : https://medium.com/@spachorkar/good-ui-ux-for-sports-betting-platform-is-it-important-63de0aa7a3d0
- MDPI — *Tennis Game Dynamic Prediction Model* (précision moyenne 84 %) : https://www.mdpi.com/2673-9909/5/3/77
- Tennis API — *How to Build a Tennis Prediction Model* : https://tennis-api.com/news/how-to-build-a-tennis-prediction-model-using-tennis-api-data
- The Flerlage Twins — *Radial Progress Bars* : https://www.flerlagetwins.com/2019/03/radial-progress-bars_19.html
- Dataviz Project : https://datavizproject.com
- Reddit r/MLS — *Apple TV MLS Season Pass UX feedback* : https://www.reddit.com/r/MLS/comments/17glnje/5_ways_to_make_apple_tvs_mls_season_pass_better
- Elo rating tennis — rescaling (250 pts = 75 % win proba) : https://www.tumblr.com/fbitennis/129032969454/rescaling-elo-for-tennis
- Wikipedia — *Elo rating system* : https://en.wikipedia.org/wiki/Elo_rating_system
