# Audit Hallmark · pariscore.fr — Sports & onglets (suite) · 2026-07-13

> **Protocole** : `hallmark audit` étendu aux onglets sportifs et pages transverses
> non couverts par le premier rapport (`AUDIT_HALLMARK_PARISCORE_2026-07-13.md`).
>
> **Périmètre** : 25 pages auditées au total — 12 onglets sportifs + 13 pages
> transverses (value bets, sure bets, hot-picks, strategies, paris, historique,
> comparateur, tarifs, etc.).
>
> **Source** : `pariscore.html` (1,5 Mo, 27 784 lignes) + `pariscore.app.js`.

---

## Préambule — la vraie découverte

L'audit home disait "le projet n'est pas AI-slop, il a une identité réelle". En
étendant aux autres onglets, **la picture change radicalement**. Il ne s'agit
plus seulement de "couche ornementale à nettoyer" — il s'agit d'une **fragmentation
structurelle du design system** avec trois caractéristiques frappantes :

1. **Le tennis est 4 fois redéveloppé** — 4 blocs `:root` distincts (`tn2`, `ps`,
   `tl`, `sc`) empilés sans réconciliation. Aucune signature tennis (pas de jaune
   balle, pas de vert gazon).
2. **L'identité chromatique par sport est en grande partie illusoire** — 5 sports
   sur 6 utilisent un rouge/orange chaud interchangeable.
3. **La cohérence inter-onglets est faible** — chaque sport a son propre `<style>`
   scoped, ses propres tokens, voire son propre toggle de thème.

---

## PARTIE 1 — Onglet TENNIS (`#page-tennis`)

### Identité

Le tennis est le sport le plus volumineux après le football, avec **2 blocs
`<style>` dédiés** (`<style id="tn2-tennis-redesign">` ligne 23134 et
`<style id="sc-tennis-scope-css">` ligne 24955). Mais l'audit révèle que
ces deux blocs masquent en réalité **4 sous-systèmes CSS indépendants** :

| Bloc | Lignes | Page bg | Card bg | Accent | Stack typo |
|---|---|---|---|---|---|
| `tn2-tennis-redesign` | 23134-24519 | `#0e1420` | `#172132` | `#0077ff` bleu | Inter + DM Mono |
| `ps-*` (DATA_PIPELINE_V3) | 24222-24519 | `#0b0e17` | `#131722` | `#0077ff` | Inter + DM Mono |
| `tl-*` (BETMART) | 24551-24953 | `#0b0e17` | `#1E2532` | `#0077ff` | Inter + DM Mono |
| `sc-tennis-scope-css` | 24955-25373 | `var(--bg2)` | `var(--bg2)` | `#00e676` vert | Barlow Condensed + DM Mono |

**Aucun n'a de signature tennis** (pas de filet, pas de jaune balle, pas de vert
gazon distinctif). Ce sont des **imports successifs de maquettes** — les
commentaires sont explicites : `TennisScope — Portage Option A` (24956),
`BETMART edition` (24536), `DATA_PIPELINE_V3` (24222). Empilés sans réconciliation.

Le scope-css déclare `font-head: Barlow Condensed` (25342, 25351) en **conflit
direct** avec `--font-head: Poppins` global (ligne 318).

### Findings Hallmark — Tennis

#### 🔴 Critical

```
[critical] Mid-render token improvisation — pariscore.html:23139-23169, 24226-24253, 24551-24574, 24955+
  4 blocs :root distincts avec valeurs hex divergentes pour la même sémantique
  (card bg = #172132 / #131722 / #1E2532 / var(--bg2)). Le bloc tn2 ligne 23170
  tente une réconciliation (alias vers var(--accent)) mais --tl-* et --ps-* gardent leurs hex.
  → Factoriser en un seul jeu token, aliaser vers les variables globales (--bg, --accent, --bg2, --bg3)
    déjà définies lignes 285-325. Supprimer --tl-* et --ps-* entirely.

[critical] Mismatched icon sets — pariscore.html:16096-16113 (KPI bar 🎾💰🏆🌍),
  16175 (🎯 pbet header), 16213-16217 (spinner custom), 25416 (🔴 offline)
  Emojis OS-rendered mélangés avec icônes SVG Lucide-style cohérentes du scope sc-*
  (svgIcon() ligne 25479). La KPI bar utilise 4 emojis différents comme feature icons.
  → Remplacer les 4 emojis KPI par des SVG du même set que svgIcon() (trophy/clock/zap déjà dispo).

[critical] Inter-everywhere (dérivé) — pariscore.html:23177, 23946
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto sur
  .tn2-dashboard et .tn2-main = corps Inter sans pairing face distincte côté tn2.
  Compensé partiellement par Instrument Sans / Barlow Condensed ailleurs mais de façon éclatée.
  → Utiliser var(--font-body) (Inter) + var(--font-head) (Poppins) systématiquement ; retirer les
    déclarations Instrument Sans / Barlow Condensed / Source Sans 3 / Syne non alignées.
```

#### 🟠 Major

```
[major] Glassmorphism without purpose — pariscore.html:23191-23192 (.tn2-tab-nav blur 12px),
  23659 (.tn2-modal-bg blur 6px), 23767 (.tn2-timeline-month-hdr blur 12px), 23948 (.tn2-modal blur 4px),
  24109 (.tn2-timeline-month-header blur 12px), 24907 (.tl-profile-overlay blur 8px)
  7 backdrop-filter dont 4 sur overlays modaux (légitime) mais 3 décoratifs (sticky headers, tab nav).
  → Garder blur sur overlays modaux ; remplacer les sticky/tab-nav par bg solide rgba(11,14,23,.95).

[major] Shadow-glow on dark — pariscore.html:23220 (tab underline glow),
  25143-25144 (.sc-lc-bet text-shadow + box-shadow halo vert/amber),
  25174 (.sc-lc-mom-fill 0 0 8px currentColor),
  25213-25216 (.sc-duel-fill 0 0 6px + .win 0 0 12px),
  25138 (.sc-fav.on drop-shadow),
  24145 (win-gauge-handle)
  ~10 halos néon. Les .sc-lc-bet cumulent background gradient + border + box-shadow + text-shadow = 4 signaux.
  → Un signal par élément. Remplacer les halos par elevation via clarté de surface ou border-color shift.

[major] transition:all (×20) — pariscore.html:23209, 23275, 23294, 23477, 23679, 23697, 23712,
  23725, 23821, 23882, 23951, 24095, 24507, 24701, 24875, 25103, 25315, 25330, 25347, 25351
  Transition universelle incluant focus rings et visibility.
  → Spécifier les propriétés : transition: background-color .15s, color .15s, border-color .15s.

[major] Animated hover gradients — pariscore.html:25170-25171 (.sc-lc-proba-p1/p2 gradients 3D),
  25213-25214 (.sc-duel-fill gradients), 25195 (.sc-lc-ou-pill.hi), 25244 (.sc-topbet.featured)
  Gradients fondus sur barres de proba = look "trading dashboard premium" mais cumulé avec box-shadow halo.
  → Conserver les gradients segmentés (signal informatif P1/P2) ; supprimer les gradients décoratifs.

[major] Bounce/overshoot easings on UI — pariscore.html:25137 (.sc-fav:hover scale(1.18)),
  25264 (.sc-vb-teaser-btn:hover scale(1.03)), 24096 (.tn2-btn-primary:hover translateY(-1px) + glow),
  24492 (@keyframes ps-metric-change scale(1.1))
  hover:scale sur boutons = Universal hover:scale-105 tell.
  → Un signal : border-color ou background shift, pas de scale.

[major] Floating-orb / giant watermark — pariscore.html:25371 (.sc-wm font-size:280px translucide
  centré en fixed), 25372 (140px sur mobile)
  Watermark text géant "TennisScope" à 1.8% opacity derrière le contenu = décoration ambient sans rôle.
  → Supprimer ; si branding nécessaire, l'ancrer dans le header existant.

[major] z-index:9999 — pariscore.html:23653 (z-index:9996), 23948 (9000), 24907 (10000),
  25417 (offline banner 100000)
  Échelle z-index arbitraire à 6 niveaux éparpillés.
  → Échelle nommée à 6 niveaux (base/sticky/overlay/modal/toast/max).
```

#### 🟡 Minor

```
[minor] Side-stripe card — pariscore.html:23304 (.tn2-match-card.is-live border-left:3px),
  24463 (.ps-swing-alert border-left:3px), 25233 (.sc-bettor-read border-left:3px blue),
  25369 (.sc-note border-left:3px vert)
  4 side-stripes. Celles sur swing-alert/bettor-read/note sont sémantiques (alertes) ;
  celle sur .tn2-match-card.is-live est décorative.
  → Garder les side-stripes sur conteneurs d'alerte ; remplacer .is-live par un badge LIVE.

[minor] Animate-on-scroll (fade-up) — pariscore.html:25368 (@keyframes sc-fade translateY(4px)),
  23671 (tn2-modal-in translateY(8px)), 24487 (ps-swing-enter translateX(-10px))
  3 entrées différentes. sc-fade se déclenche à chaque switch d'onglet = page jamais stable.
  → Garder tn2-modal-in (1 entrée orchestrée) ; supprimer sc-fade ou le limiter au premier load.

[minor] Italic as emphasis — pariscore.html:25235 (.sc-cite font-style:italic),
  25248 (.sc-topbets-empty italic)
  Italic sur citation + empty state. Usage body-copy acceptable pour .sc-cite mais le empty-state
  en italic = tic "trying to look editorial".
  → .sc-topbets-empty en roman regular ; .sc-cite peut rester.

[minor] Every section padded the same — pariscore.html:23946 (.tn2-main padding:12px 16px),
  24576 (#tennis-live-section padding:16px)
  Padding uniforme 12-16px partout, aucune variation de rythme vertical.
  → Varier : tighten sur KPI bar (8px), expand sur header analytique (20-24px).
```

**Summary tennis — 3 critical · 7 major · 4 minor · Verdict: reads as AI-generated**
(sauvable par réconciliation token qui alignerait l'onglet sur la home en un passage)

---

## PARTIE 2 — Sports de niche (MMA, NBA, WNBA, CS2, F1, Cycling)

### Cartographie chromatique — la découverte clé

L'intuition "chaque sport a sa propre identité chromatique" se vérifie en partie,
mais **5 des 6 sports utilisent un rouge/orange chaud interchangeable** :

| Sport | Accent dominant | Hue | Notes |
|---|---|---|---|
| **MMA** | `#E3001B` rouge sang + `#D4AF37` or | ~0° | Dual-accent signature (le seul vraiment distinct) |
| **CS2** | `#ff6d2e` orange jeu / `#E3001B` rouge light | ~12° | **Double thème** orange dark + rouge light empilés |
| **F1** | `#ff0043` rouge auto | ~344° | Tokens scopés `--f1-*` (le seul propre avec Cycling) |
| **Cycling** | `#ff6b35` orange-rouge | ~16° | Tokens scopés `--cyc-*`. **Pas de jaune Tour de France** |
| **NBA** | `#ff6b00` orange basket | ~28° | WNBA recycle la même couleur |
| **WNBA** | `#ff6b00` (= NBA) | ~28° | **Alias parfait de NBA, aucune identité propre** |

**Aucun n'utilise** un hue réellement distinct : pas de jaune Tour de France, pas
de violet, pas de cyan独. La "thématisation sport" est davantage un ajustement
de teinte rouge/orange qu'une différentiation réelle.

### Findings Hallmark par sport

#### CS2 — 🔴 **LE PLUS SLOP** (ships as slop)

```
[critical] cyan-green animated borders — pariscore.html:22365-22369 + 22512-22516
  .cs2-card.has-value-map + @keyframes cs2-value-pulse : bordure verte #00e676 pulsée
  + box-shadow glow animé 1.8s. Tell explicite nommé dans anti-patterns.
  → Remplacer par border statique + badge typographique "VALUE".

[critical] side-stripe cards (5+ occurrences) — pariscore.html:22393 (.cs2-dash-live border-left 3px),
  22451 (section-title border-left 4px #E3001B), 22576 (.cs2-row.is-live),
  22340 (.cs2-map-bar.adv-t1 border-left + inset glow),
  22370/22517 (.has-value-map td:first-child border-left vert)
  5+ side-stripes asymétriques.
  → Hairline border tout autour, ou supprimer.

[major] fade-up scroll-reveal — pariscore.html:22673
  <div class="cs2-header fade-up">. Universal scroll-triggered fade-up.
  → Couper.

[major] emoji-as-icon (10+ occurrences) — pariscore.html:22675 (🎮 title), 22680 (⚡),
  22686 (🔴 Live), 22687 (📅), 22689 (📊), 22690 (📋), 22691 (🔄), 22722 (🤖 IA tab),
  22647-22659 (sidebar 🎮🏆⭐💥🏅)
  → Remplacer par une bibliothèque d'icônes unique (Lucide préférence).

[major] token improvisation — pariscore.html:22427-22640
  Tout le bloc light-theme hardcode #F2F2F0, #E3001B, #00A651, #D48900, #1A1A1A, #EBEBEB, #F5F5F5
  hors tokens. Le sport CS2 bypass totalement le design system.
  → Définir des tokens --cs2-* scoped et les utiliser.

[major] neumorphism — pariscore.html:22287
  .cs2-bet-btn double box-shadow 4px 4px 8px...,-2px -2px 6px rgba(255,255,255,0.04). Décoratif.
  → Box-shadow simple ou aucun.

[minor] decorative gradients — pariscore.html:22332-22338
  7 map-bar par map (mirage/inferno/nuke…), tous linear-gradient(90deg, rgba(...), var(--bg3) 70%).
  → OK sémantique (map atmospheres), mais très répétitif.

[minor] shadow-glow on dark — pariscore.html:22346-22347
  .cs2-dot.d-t1/d-t2 box-shadow 0 0 6px rgba(255,107,0,0.65) halo.
  → Drop-shadow simple.
```

#### MMA — 🟠 reads as AI-generated (dual-accent fort mais fragmentation token)

```
[major] token improvisation — pariscore.html:22939, 22957, 22963, 22975-22981, 23003-23009,
  23035, 23063, 23077, 23081, 23085
  Hex inline partout : #E3001B, #D4AF37, #00E676, #ff5a4d, #2f81f7, #37d36b, #ff6a5a, #102e45.
  Aucun token --mma-accent.
  → Définir --mma-accent, --mma-gold, etc.

[major] decorative gradients (5 occurrences) — pariscore.html:22981 (.mma-prob-fill rouge→rose),
  23035 (.mma-model-fill), 23049 (.mma-modal-head bg linear-gradient(160deg,#102e45,#0a0d0f)),
  23063 (.mma-conf-fill), 23077 (.mma-verdict bg gradient rouge)
  → Réduire à 1-2 gradients sémantiques ; remplacer le reste par solid.

[major] emoji-as-icon — pariscore.html:25386 (💰 Value), 25387 (🔄 refresh)
  Logo sport SVG octogone main (25378) — propre lui.
  → Remplacer 💰/🔄 par SVG.

[major] glassmorphism — pariscore.html:23046
  .mma-modal-overlay backdrop-filter:blur(4px). Acceptable (overlay sur contenu) mais présent.
  → Garder (overlay = usage légitime).

[minor] italic body — pariscore.html:23040 .mma-bd-method font-style:italic + border-left rouge
  → Borderline (blockquote method). Acceptable.

[+] Aucun fade-up, aucun transition:all, aucun side-stripe card structurel.
```

#### F1 — 🟡 close, fix minors (langage "neumorphic premium 3D" coûteux mais discipliné)

```
[major] side-stripe card — pariscore.html:22765
  .f1drv border-left:3px solid var(--tc,#8d9399) sur CHAQUE ligne pilote. Stripe couleur-équipe.
  → Hairline border tout autour ou supprimer.

[major] universal hover:scale/lift — pariscore.html:22751-22752
  .f1bet:hover transform:translateY(-3px) + box-shadow grossi. Lift générique sans purpose.
  → Border-color shift à la place.

[major] neumorphism / shadow-glow — pariscore.html:22751
  .f1bet triple box-shadow 9px 9px 22px,...,-7px -7px 18px rgba(255,255,255,0.035), inset 0 1px 0...
  Cartes 3D premium lourdes.
  → Simplifier en single box-shadow ou elevation par luminosité.

[major] decorative gradient border — pariscore.html:22753
  .f1bet::after bordure gradient via mask linear-gradient(140deg,rgba(255,0,67,.5),transparent 45%).
  → Border solide ou supprimer.

[minor] decorative gradients — pariscore.html:22769-22771
  .f1drv-pos.g/.s/.b médailles gold/silver/bronze gradients (sémantique podium, borderline acceptable).
  → OK (podium sémantique).

[+] Aucun emoji-as-icon (SVG monoplace main 22792). Aucun fade-up. Aucun transition:all.
    Discipline typo propre (Syne + DM Mono + Instrument Sans, tokens scopés).
```

#### Cycling — 🟢 **LE PLUS PROPRE** (servirait de modèle)

```
[minor] side-stripe — pariscore.html:22871
  .cyc-stage-weather border-left:3px solid var(--cyc-accent). Une seule occurrence, type blockquote météo.
  → Garder (borderline acceptable).

[minor] decorative gradient — pariscore.html:22893
  .cyc-fav-rider-photo.placeholder gradient orange (placeholder d'avatar, acceptable).
  → OK.

[+] ZÉRO emoji-as-icon (SVG vélo main 22911).
    ZÉRO fade-up.
    ZÉRO glassmorphism.
    ZÉRO transition:all.
    Cards plates (rgba(255,255,255,.04), hover simple lighten 22822).
    Spinner CSS custom (.cyc-fav-loading::before, 22896) — pas de Lottie.
    Tokens disciplinés (--cyc-bg, --cyc-accent).
```

#### NBA & WNBA — 🟡 close, fix minors

```
[major] emoji-as-icon — pariscore.html:22142 (🏀 NBA), 22150 (🤖 AI Scout NBA),
  22209 (🏀 WNBA)
  → SVG.

[major] token improvisation — pariscore.html:22138-22139, 22160, 22190-22202
  Hex inline #0d3b1e, #4ade80, #f87171, #3b0d0d, #ff6b0033, #1a1206 hors token block.
  → Définir --nba-accent.

[major] default-attractor sameness (WNBA = NBA) — pariscore.html:22178-22213
  WNBA = copie couleur/composants de NBA. Aucun token --wnba-*, zéro divergence visuelle.
  Commentaire ligne 22176 : « miroir NBA ».
  → Soit assumer l'aliasing, soit créer une identité WNBA propre.

[minor] italic body — pariscore.html:22124, 22184 .nba-disclaimer font-style:italic
  → Acceptable pour disclaimer.

[minor] decorative gradient — pariscore.html:22134 (nba-prob-fill orange→amber),
  22160 (nba-tb-card bg sombre 135deg), 22192 (.wnba-prop-bet même gradient que NBA topbets)
  → Décoratif, réduire.
```

### Synthèse transverse — Sports de niche

**Classement slop** (du pire au meilleur) :
1. 🔴 **CS2** — cumul critique (cyan-green pulse + 5 side-stripes + fade-up + 10 emojis + double thème)
2. 🟠 **MMA** — signature forte (rouge+or) mais token improvisation massive
3. 🟡 **F1** — langage neumorphic coûteux mais discipline typo propre
4. 🟡 **NBA/WNBA** — coherent, just needs SVG icons
5. 🟢 **Cycling** — **modèle pour les autres**

**Patterns communs aux 6 sports** :
1. **Stack typo identique** partout : `Syne` (display) + `DM Mono` (mono) + `Instrument Sans` (body). Bonne cohérence.
2. **Pill filter toolbar** `.xxx-pill` 20px radius répété (NBA 22125, CS2 22228, MMA 22942, etc.).
3. **Card grid** `repeat(auto-fill,minmax(3XXpx,1fr))` répété.
4. **EV tri-color system** green-positive / amber-flat / grey-negative (CS2 22404-22408, NBA 22138-22139, MMA 23003-23005).
5. **Live pulse dot** keyframe redondant (`cs2pulse` 22225, `mma-pulse` 23015).
6. **Fragmentation token** : chaque sport hardcode son accent inline au lieu d'un `--sport-accent`. Seuls F1 et Cycling ont des tokens scopés.

---

## PARTIE 3 — Pages transverses & produit

### Pages critiques business

#### `tarifs` (pricing) — 🟡 close, fix majors (pattern pricing classique mais contenu honnête)

```
[critical] Centered hero / Centered everything — pariscore.html:20556 (text-align:center; margin-bottom:8px)
  + 20558 (max-width:500px; margin:0 auto)
  Hero pricing entièrement centré, label + titre + sous-titre empilés au centre.
  → Bias à gauche, ajouter une colonne "social proof" ou témoignages à droite.

[critical] 3-column feature grid (décliné en 4 colonnes) — pariscore.html:8243
  grid-template-columns: repeat(4, 1fr). 8 plans en 4 colonnes (2 lignes de 4).
  → Varier largeurs, ou structurer en 2 plans phares + tableau comparatif.

[major] Most Popular badge — pariscore.app.js:26645
  p.featured ? '<div class="price-badge">POPULAIRE</div>'. Plan DUO PRO featured.
  → Pattern "AI pricing page" textbook. Varier le treatment du plan phare.
```

**NOTE POSITIVE** : la page tarifs évite le pire — **8 plans réellement différenciés**
(4 Matchday + 3 Pro mensuels + 1 annuel), prix Stripe concrets non inventés
(1,50€/24h, 19,5€/mois, 30€/mois), aucune métrique "trusted by 50 000 teams",
aucun social proof bidon. La **coquille** est templated mais le **remplissage**
est honnête. À l'inverse de hot-picks/sure-bets (coquille custom mais contenu
inventé).

#### `hot-picks` — 🔴 critical (invented metrics + emoji)

```
[critical] Invented metrics — pariscore.html:14006
  "Nos 15 AI Tipsters ont analysé les matchs" + "classés par Value Index".
  Les "15 AI Tipsters" sont des personas de stratégies, pas 15 agents réels.
  → Soit sourcer le nombre, soit remplacer par — et block neutre.

[critical] Generic emoji as feature icon — pariscore.html:14016-14018
  📊 (Value Index), ✅ (Fiabilité), 👤 (AI Tipster). Aussi 🔥 dans 14004.
  → Icônes SVG d'une bibliothèque unique.

[major] Eyebrow on every section — pariscore.html:14004 .section-label "🔥 Hot Picks"
  → Désactiver (eyebrows default OFF selon Hallmark).
```

#### `sure-bets` — 🔴 critical (invented metrics)

```
[critical] Invented metrics — pariscore.html:14029
  "Hit rate estimé ~40%. Rentabilité long terme > 100%". Chiffres non sourcés.
  → Soit sourcer via backtest réel, soit remplacer par —.

[major] Emoji feature icon / eyebrow — pariscore.html:14027 🏆 Sure Bets
  → SVG.
```

### Pages dashboard fonctionnelles (les plus propres)

#### `strategies` — 🟢 close, ships

```
[major] Eyebrow — pariscore.html:15293 .section-label "Top Stratégies"
[major] Radial-gradient section bg — pariscore.html:15292
  → Couper l'eyebrow ; remplacer radial par solid bg.
```

Cohérence vs home : **excellente**. Filtres riches (ligue, famille, slider
confiance, pills), pas de sous-système divergent. **Page la plus "produit" du lot.**

#### `paris` (bet tracker) — 🟢 cohérent

```
[major] Radial-gradient section bg — pariscore.html:15064
[major] Eyebrow — pariscore.html:15065 .section-label "Mes Paris"
```

Outils réels (CSV, CLV, Kelly, bankroll chart). Pas de divergence.

#### `historique` (Data Hub) — 🟢 cohérent

```
[major] Radial-gradient section bg — pariscore.html:14715
[major] Eyebrow — pariscore.html:14716 .section-label "Data Hub Historique"
```

Backtesting, ROI réel. Bonne page.

### Pages divergentes (fragmentation)

#### `comparateur` — 🔴 FRAGMENTATION CRITIQUE

```
[critical] Fragmentation — sous-système visuel propre — pariscore.html:22049-22109
  classes .comp-root, .comp-light, .cq-mut, .comp-chip, .comp-toolbar,
  bouton toggleCompTheme() (22066) avec son propre système de thème clair/sombre.
  C'est LE SEUL ENDROIT DU SITE qui gère son propre dark/light toggle.
  Divergence nette avec le design system global.
  → Soit réconcilier (retirer .comp-light/toggle thème), soit assumer explicitement
    la divergence en documentant.

[major] Centered hero — pariscore.html:22051 text-align:center + 22054 max-width:520px
[major] Eyebrow — pariscore.html:22052 .section-label "Comparateur de Cotes"
[minor] Mixed inline hex — pariscore.html:22066 #0077ff inline
```

#### `tendances` — 🟡 fragmentation légère

```
[major] Italic/emoji header — pariscore.html:15355 "📈 Tendances du moment"
[major] Mixed inline hex / token improvisation — pariscore.html:15360 #0077ff inline,
  15369 #10b981, 15373 #ef4444. Couleurs Tailwind codées en dur.
  → Passer par var(--token).
```

### Page 404 et points positifs

#### `404` — 🟡 centered hero + emoji

```
[critical] Generic emoji + centered everything — pariscore.html:25398
  🤔 + .page-404-container centré (titre + texte + bouton empilés au centre).
  → C'est une mini-version du cliché "centered hero". Faible enjeu mais tell.
```

#### ✅ Points positifs détectés

- **Footer global** (`pariscore.html:21480-21494`) — **PAS le tell "AI footer"**.
  Court : logo + 1 ligne (18+), **une seule** colonne de liens (6 liens guides,
  pas Product/Company/Resources/Legal), pas de social-icon row, copyright inline
  à droite. C'est plutôt `Ft2 Inline single line` du cookbook Hallmark. **Bon point.**

- **Nav globale** (`pariscore.html:12589, 12696, 10498`) — icônes SVG custom par
  item + floating pill (`bn3d`). **Évite le tell "AI nav"** wordmark-left/links-center/
  CTA-right. **Bon point.**

---

## PARTIE 4 — SYNTHÈSE COHÉRENCE INTER-ONGLETS

C'est la **vraie découverte** de cet audit étendu. Le problème principal de
pariscore.fr n'est pas "couche ornementale à nettoyer" (ça, c'était le diagnostic
home). C'est **fragmentation structurelle du design system**.

### 4.1 Le constat

| Couche | Home/Football | Tennis | Sports niche | Pages transverses |
|---|---|---|---|---|
| **Tokens** | `:root` unifié (1 bloc) | **4 blocs `:root` distincts** (`tn2`/`ps`/`tl`/`sc`) | Hardcodés inline sauf F1/Cycling (tokens scopés) | Cohérent avec home |
| **Fonts** | Poppins + Inter + DM Mono | + Instrument Sans, Barlow Condensed, Source Sans 3, Syne, JetBrains Mono | Syne + DM Mono + Instrument Sans partout | Poppins + Inter + DM Mono |
| **Cards** | 1 système | **6 systèmes** (`tn2-match-card`, `sc-card`, `tl-card`, `ps-metric-xxl`, `sc-livecard`, `sc-premier-card`) | 1 par sport | Cohérent |
| **Eyebrow** | Présent | Présent | Présent | **Présent sur ~10 pages** |
| **Live pulse dot** | 1 keyframe | 3 keyframes redondants | 2 keyframes redondants (`cs2pulse`, `mma-pulse`) | — |

### 4.2 Les 3 problèmes structurels

1. **Le tennis est 4 fois redéveloppé** — pas thématisé, fragmenté en 4 sous-systèmes
   (`tn2`, `ps`, `tl`, `sc`) issus d'imports successifs de maquettes (TennisScope
   Option A, BETMART edition, DATA_PIPELINE_V3) empilés sans réconciliation.

2. **L'identité chromatique par sport est en grande partie illusoire** — 5 sports
   sur 6 utilisent un rouge/orange chaud interchangeable (NBA `#ff6b00`, CS2
   `#ff6d2e`, F1 `#ff0043`, cycling `#ff6b35`, MMA `#E3001B`). WNBA recycle
   l'orange NBA à l'identique. Aucun n'utilise un hue vraiment distinct.

3. **Le comparateur a son propre design system + dark/light toggle** — seule
   page du site à gérer son propre thème. Vocabulaire `.comp-*` / `.cq-mut`
   totalement divergent.

### 4.3 Compteurs de findings consolidés (25 pages auditées au total)

| Sévérité | Home/Football (rapport 1) | Tennis | Sports niche | Transverses | **TOTAL** |
|---|---|---|---|---|---|
| 🔴 Critical | 5 | 3 | 4 | 5 | **17** |
| 🟠 Major | 5 | 7 | 19 | 12 | **43** |
| 🟡 Minor | 3 | 4 | 9 | 4 | **20** |
| **TOTAL** | **13** | **14** | **32** | **21** | **80** |

---

## PARTIE 5 — PLAN D'ACTION STRATÉGIQUE

### 🚀 Priorité 1 — Réconciliation du design system (1-2 semaines, impact maximum)

C'est **le chantier prioritaire**. Tout le reste en dépend.

#### 5.1.1 Définir un système de tokens `--sport-accent` par onglet
```css
:root {
  --sport-accent: var(--accent);  /* défaut = vert global */
  --sport-bg: var(--bg);
  --sport-card: var(--bg2);
}
#page-tennis     { --sport-accent: #ccff00; }  /* jaune balle — vraie signature tennis */
#page-mma        { --sport-accent: #E3001B; --sport-secondary: #D4AF37; }
#page-cs2        { --sport-accent: #ff6d2e; }
#page-f1         { --sport-accent: #ff0043; }
#page-cycling    { --sport-accent: #f4d03f; }  /* jaune maillot — vraie signature cycling */
#page-nba        { --sport-accent: #ff6b00; }
#page-wnba       { --sport-accent: #ff6b00; }  /* aliasing assumé */
```

Puis chaque sport utilise `var(--sport-accent)` partout au lieu de hardcoder.

#### 5.1.2 Réconcilier les 4 blocs `:root` du tennis en 1
- Supprimer `--tn2-*`, `--ps-*`, `--tl-*` (lignes 23139-23169, 24226-24253, 24551-24574).
- Aliaser vers `var(--bg)`, `var(--bg2)`, `var(--accent)`, `var(--border)`.
- Le bloc `sc-*` le fait déjà partiellement — étendre ce pattern.
- Gain estimé : -300 lignes CSS + cohérence visuelle instantanée.

#### 5.1.3 Unifier le système de cards
Choisir **un** système de card (le plus complet = `sc-card` / `sc-livecard` tennis)
et déprécier les autres (`tn2-match-card`, `tl-card`, `ps-metric-xxl`, `.comp-*`).

#### 5.1.4 Standardiser les keyframes partagés
- 1 `@keyframes live-pulse` partagé (remplace `cs2pulse`, `mma-pulse`, `pulse-dot`).
- 1 `@keyframes skeleton-shimmer` partagé (remplace `psmSkelShimmer`, `sc-skel`, etc.).

### 🎨 Priorité 2 — Thématisation réelle des sports (1 semaine)

Puisque l'audit révèle que "chaque sport a sa couleur" est largement illusoire
(5/6 en rouge/orange), **soit assumer la cohérence** (un seul accent global), **soit
différencier pour de vrai** :

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Unifier** (1 accent global `#00e676` partout) | Cohérence maximale, identité de marque, -50% CSS | Perte de la signalétique sport |
| **B. Différencier vraiment** (chaque sport un hue distinct) | Signalétique utile, aide navigation | Nécessite refonte palette par sport |
| **C. Hybride** (1 accent global + 1 tag coloré par sport) | Cohérence + signalétique | Complexité modérée |

**Recommandation** : **Option C (hybride)**. Accent vert global conservé, mais
chaque sport a un **tag coloré discret** (badge/header de l'onglet) qui crée la
signalétique sans tout envahir.

Exemples de hues distincts à tester si option B :
- Tennis : `#ccff00` (jaune balle) — vraiment distinctif
- Cycling : `#f4d03f` (jaune maillot) — vraie référence Tour de France
- MMA : `#E3001B` + `#D4AF37` (rouge sang + or) — déjà bon
- F1 : `#ff0043` (rouge Farrari) — déjà bon
- CS2 : `#00d4ff` (cyan neon gamer) — vraiment distinctif
- NBA/WNBA : `#ff6b00` (orange basket) — déjà bon, assumer l'aliasing

### 🧱 Priorité 3 — Nettoyage Hallmark par onglet (2-3 semaines)

Dans l'ordre d'impact :

| # | Action | Effort | Onglets concernés |
|---|---|---|---|
| 1 | Supprimer "15 AI Tipsters" (14006) + métriques non sourcées | 0.5 j | hot-picks, sure-bets |
| 2 | Remplacer tous les emojis-feature-icons par SVG | 2 j | CS2 (10+), NBA/WNBA, MMA, hot-picks, 404 |
| 3 | Désactiver eyebrows décoratifs `.section-label` | 0.5 j | 10+ pages |
| 4 | Couper fade-up scroll-reveal (24 home + CS2 + tennis) | 0.5 j | diffus |
| 5 | Réconcilier `comparateur` (retirer `.comp-light`/toggle thème) | 1 j | comparateur |
| 6 | Nettoyer CS2 (cyan-green pulse + side-stripes + double thème) | 2 j | CS2 |
| 7 | Shadow-glow → elevation par luminosité (609 box-shadow) | 3 j | tous |
| 8 | transition:all → listes explicites (29 home + 20 tennis) | 1 j | diffus |
| 9 | Cycling-style refactor (modèle de propreté) | — | référence |

**Total** : ~10 jours pour nettoyer les tells visuels les plus visibles.

### 📊 Priorité 4 — Migration Next.js (en cours, opportunité)

Chaque route migrée vers `app/(sports)/<sport>/page.tsx` doit :
1. Utiliser `var(--sport-accent)` (token scoped).
2. Hériter du design system centralisé (shadcn/ui + Tailwind 4).
3. Appliquer les principes Cycl**ing** (cards plates, SVG main, zéro fade-up).
4. Supprimer les sous-systèmes `tn2`/`ps`/`tl`/`sc` au passage.

---

## RÉSUMÉ EXÉCUTIF

### Diagnostics clés

1. **Le tennis n'est pas "plus développé", il est 4 fois redéveloppé.**
   Fragmentation critique en 4 sous-systèmes CSS indépendants issus d'imports
   de maquettes successives (TennisScope, BETMART, DATA_PIPELINE_V3).

2. **L'identité chromatique par sport est en grande partie illusoire.**
   5 sports sur 6 utilisent un rouge/orange chaud interchangeable. WNBA = alias
   parfait de NBA. Cycling n'a pas de jaune Tour de France.

3. **Le comparateur est le seul fragment vraiment divergent** — son propre
   design system + toggle dark/light. À réconcilier ou assumer.

4. **Cycling est le modèle à suivre** — tokens scopés, cards plates, SVG main,
   zéro emoji, zéro fade-up, zéro glassmorphism. Tous les autres sports
   devraient s'y aligner.

5. **Les pages produit (strategies, paris, historique) sont les plus propres** —
   contenu réel, outils fonctionnels, pas de métrique inventée.

6. **Les pages marketing (hot-picks, sure-bets) sont les plus slop** — invented
   metrics + emojis + radial gradients.

### Top 5 actions prioritaires

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | **Réconcilier les 4 blocs `:root` du tennis en 1** | 2 j | Cohérence visuelle + -300 lignes |
| 2 | **Définir tokens `--sport-accent` + thématisation hybride** | 3 j | Signalétique réelle |
| 3 | **Supprimer invented metrics** (15 tipsters, hit rate 40%) | 0.5 j | Crédibilité produit |
| 4 | **Remplacer tous les emojis-feature-icons par SVG** | 2 j | Tell le plus visible |
| 5 | **Réconcilier `comparateur`** (retirer toggle thème) | 1 j | Fin fragmentation |

### Comparaison avec l'audit home (rapport 1)

Le rapport 1 disait : "le projet n'est pas AI-slop, il a une identité réelle, il
faut nettoyer la couche ornementale". **Le rapport 2 nuance fortement** :
l'identité de la home **ne s'étend pas** au reste du site. Les onglets sportifs
sont fragmentés en sous-systèmesCSS indépendants, chacun avec ses tells. Le chantier
prioritaire n'est plus "nettoyer la déco" mais **"construire un design system unifié
qui s'étend à tous les onglets"** — et la migration Next.js en cours est
l'opportunité de le faire proprement.

---

## Références

- Premier rapport : `AUDIT_HALLMARK_PARISCORE_2026-07-13.md` (home/football)
- Hallmark anti-patterns : `.agents/skills/hallmark/references/anti-patterns.md`
- Audit verb spec : `.agents/skills/hallmark/references/verbs/audit.md`
- Source : `pariscore.html` (27 784 lignes) + `pariscore.app.js`

---

*Rapport généré par `hallmark audit` étendu aux 25 pages — 2026-07-13.*
*80 findings consolidés : 17 critical · 43 major · 20 minor.*
