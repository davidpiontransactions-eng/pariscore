# RAPPORT D'INNOVATION : Tennis Table V3
## Table Ronde d'Urgence — Architecture Design Mobile-First

> **Date :** 25 mai 2026  
> **Version cible :** V3.0  
> **Statut :** Brainstorming validé — en attente GO production

---

## DIAGNOSTIC : Autopsie de l'Échec V2

### Inventaire du désastre actuel

**17 colonnes** dans `#tennis-vb-table`. Largeur réelle cumulée des `<colgroup>` : **~1930px**.  
Le `min-width: 1020px` est un mensonge — le tableau fait presque **2× cette valeur**.

| Col | Label header | Largeur px | Problèmes |
|-----|-------------|-----------|-----------|
| 1 | ★ | 40 | OK |
| 2 | Date/Heure/Surface | 140 | 3 lignes dans le `<th>` |
| 3 | Match | 200 | OK — cellule la plus dense |
| 4 | **Bets Prédictifs** | 170 | `<br>` + `<button>` + `<span>` dans `<th>` · popup absolue qui écrase cols 5-6 |
| 5 | Score | 120 | `.tn-sb { display:inline-grid }` dans `td { width:1%; white-space:nowrap }` → contradiction CSS mortelle |
| 6 | Elo | 100 | Trop court pour deux chiffres + espace |
| 7 | Proba Vic match | 130 | `<svg>` + texte multi-mots dans `<th>` |
| 8 | Score Sets / Gagne au moins 1 set | 110 | **2 lignes** dans le `<th>` + sous-texte |
| 9 | Forme (Pts) / PowerScore | 110 | **Titre le plus long du tableau** + `<button>` inline |
| 10 | King of Aces | 120 | Fantaisie métaphorique = colonne obscure |
| 11 | Gain Set 1 | 110 | Doublon avec col 8 dans l'esprit utilisateur |
| 12 | Gain Set 2 | 130 | Idem |
| 13 | Jeux O/U | 110 | `<button>` dans `<th>` |
| 14 | Mental | 120 | `<svg>` + texte |
| 15 | Value (EV+) | 100 | Trop court, tronqué |
| 16 | Confiance | 120 | — |
| 17 | Alerte IA | 120 | `<svg>` + texte |

### Les 5 bugs structurels racine

**BUG-CSS-1 : La popup absolue fugitive**  
Le panneau "DR P1~ / DR P2~ / DR J1/set / DR J2/set" est `position:absolute` sans `position:relative` établi sur son `<td>` ancêtre direct. Il échappe au flux → écrase les colonnes Score, ELO, Proba Vic.

**BUG-CSS-2 : Contradiction `width:1% + white-space:nowrap`**  
```css
/* PROBLÈME dans le code actuel */
#tennis-vb-table td.tvb-score-col { width:1%; white-space:nowrap; padding:8px 10px; }
#tennis-vb-table .tn-sb { display:inline-grid; ... }
```
Sur `table-layout:fixed`, `width:1%` est ignoré — la largeur vient du `<colgroup>` (120px). `white-space:nowrap` force l'`inline-grid` à ne jamais wrapper → débordement.

**BUG-CSS-3 : Chaos z-index sans stacking context**  
Valeurs trouvées dans le fichier : 1, 2, 6, 10, 100, 200, 1000, 1020, 9000, 9400, 11000.  
Aucune couche n'est documentée. Les `<td>` avec `position:relative` créent des stacking contexts locaux qui font "monter" des éléments au-dessus de modals.

**BUG-CSS-4 : `<th>` comme fourre-tout HTML**  
Chaque `<th>` contient : `<br>`, `<span>`, `<button>`, `<svg>`, texte brut.  
Sur viewport < 1400px, aucun `<th>` ne peut se tronquer proprement.

**BUG-CSS-5 : `overflow:hidden !important` sur le wrapper scroll**  
Trouvé à la ligne 2410. Un `overflow:hidden` quelque part dans la chaîne parente tue la capacité des colonnes sticky à rester visibles en dehors de leur scroll container.

---

## TABLE RONDE — 4 EXPERTS

---

### [EXPERT 1] LEAD PARIEUR PRO
*Filtre le bruit. Priorise par valeur décisionnelle.*

**Règle d'or parieur :** en moins de 2 secondes, il faut lire : qui joue, qui va gagner, combien ça vaut.

#### Hiérarchie décisionnelle

| Tier | Donnée | Pourquoi indispensable |
|------|--------|----------------------|
| **T0 — Vue immédiate** | SIGNAL (BET FORT / VALUE / PASS) | La seule décision binaire : je mise ou je passe |
| **T0 — Vue immédiate** | Match identity (J1 vs J2, surface, rank) | Sans ça, je ne sais pas de quoi on parle |
| **T0 — Vue immédiate** | Score live + serveur | Contexte live = alpha non-pricé |
| **T0 — Vue immédiate** | Win Probability % + EV | EV > 5% + proba > 55% = GO |
| **T1 — Expansion rapide** | Détail paris (DR P1~/P2~, odds J1/J2 set) | Pour confirmer la mise et les cotes |
| **T1 — Expansion rapide** | ELO gap + confiance | Valide la solidité du modèle |
| **T2 — Drawer complet** | King of Aces, Gain Set 1/2, Jeux O/U | Pour stratèges : marchés alternatifs |
| **T2 — Drawer complet** | Mental, Forme/PowerScore, Alerte IA | Contexte approfondi |

**Ce qui doit disparaître du premier écran :**
- "Forme (Pts) / PowerScore" avec sa formule dans le header → T2
- "King of Aces" → T2 (marché de niche)
- "Gain Set 1 / Set 2" colonnes séparées → fusionner dans une section "Marchés Sets" en T2
- "Mental (Réaction/Enchaîne)" → T2
- "Alerte IA" colonne → badge icône dans la colonne Match (économise 120px)
- "Confiance" → tooltip sur le chip SIGNAL

**Résumé : T0 = 5 colonnes max. Tout le reste = drawer.**

---

### [EXPERT 2] LEAD DATAVIZ
*Applique la hiérarchie Cleveland-McGill : Position > Longueur > Angle > Aire > Couleur.*

#### Problème actuel : trop de texte, pas assez de position

Le tableau affiche des probabilités sous forme de chiffres `68%`, `41/100`, `81.4%` côte à côte. L'œil doit lire 3 chiffres pour comparer 2 joueurs. **Catastrophique en surcharge cognitive.**

#### Micro-visualisations proposées

**1. ELO Gap → Dual Minibar horizontal (30px de haut)**
```
J1: ████████░░░░ 1902
J2: ████████████ 2150
     ←──────────→
     Δ -248  (rouge si gap > 200)
```
Implémentation : `<div style="width:Xpx; height:6px; border-radius:3px;">` × 2.  
Pas besoin de SVG. Un simple ratio `elo / max_elo_affiché` → `width` en %.

**2. Win Probability → Gros chiffre coloré + barre 4px**
```
68%   ← texte 22px bold, couleur = gradient vert>amber>rouge
████████████░░░░░  ← barre 4px height, 100% width container
```
Palette : ≥65% → `#00e676`, 45-65% → `#ffa726`, <45% → `#ff4d4d`.  
**Jamais de jauge circulaire** (angle = encoding moins précis que longueur).

**3. Forme (L5) → 5 dots sparkline (20px wide, 8px tall)**
```
● ● ○ ● ●   = W W L W W   (● vert = win, ○ rouge = loss)
```
Implémentation : 5 `<span>` de 6×6px inline. Zéro texte, lecture instantanée.  
Remplace "Forme (Pts) / PowerScore" par 5 pixels.

**4. Sets Proba → Matrice compacte (top score only)**
```
2-0 ▓▓▓▓  42%
2-1 ▓▓░░  28%
```
Afficher uniquement les 2 issues dominantes. **Supprimer** la répétition J1/J2 dans deux colonnes séparées.

**5. SIGNAL chip → traffic light sémantique**
```
[● BET FORT]   ← fond vert, texte blanc
[◐ VALUE]      ← fond amber foncé, texte amber
[○ PASS]       ← fond bg4, texte text3
[⚡ LIVE HOT]  ← fond rouge pulsant, texte blanc
```
EV% affiché juste à droite du chip : `+11.2%` en vert small. 

**6. Score live → conserver `.tn-sb` mais contraindre**  
Le widget `.tn-sb` existant est bien conçu. Il faut juste lui donner un `max-width: 140px; overflow: hidden;` et retirer le `width:1%` du `<td>` parent.

#### Règle dataviz absolue pour cette V3
> **Tout chiffre isolé sans contexte de comparaison = interdit en T0.**  
> Si on affiche `1902`, on affiche aussi `2150` sur la même ligne de référence.

---

### [EXPERT 3] LEAD UI/UX DESIGNER
*Structure l'espace. Résout desktop et mobile.*

#### Desktop V3 — 8 Colonnes (cible : confortable à 1100px)

| # | Colonne | Largeur | Contenu | Groupe CSS |
|---|---------|---------|---------|-----------|
| 1 | ★ | 36px | Star fav | sticky-1 |
| 2 | Date + Surface | 120px | `HH:MM` + badge surface couleur + tour | sticky-2 |
| 3 | Match | 230px | J1 vs J2, ranks `#XX`, serving ball 🎾, tournoi pill | sticky-3 |
| 4 | **SIGNAL** | 155px | Chip BET FORT/VALUE/PASS + EV% + `ⓘ` confidence | primary |
| 5 | Score | 150px | `.tn-sb` widget autonome | primary |
| 6 | ELO + Proba | 140px | Dual minibar ELO + `68%` avec barre | primary |
| 7 | Value (EV+) | 110px | Cote best odds + badge edge | primary |
| 8 | ▸ | 32px | Expand drawer button | control |

**Total Desktop : 973px** — confortable à 1024px, spacieux à 1280px.

**3 colonnes sticky (position:sticky; z-index:20)** = identité toujours visible au scroll horizontal.

#### Hiérarchie visuelle Desktop

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ★ │ 14:30       │ ● Samsonova RK39      │ [BET FORT +11%] │ 6 6 ·15·│ELO ████ 68%│ 3.20▲ │ ▸ │
│   │ TERRE BATT  │   Teichmann  RK66     │   conf: ●●●●○   │ 4 3      │ELO ████████│       │   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Typographie Desktop :**
- Noms joueurs : `DM Mono 13px 600` (lisibilité rangs + noms)
- Ranking `#39` : `DM Mono 11px` couleur `--text3` + pill vert si top10
- SIGNAL chip : `Instrument Sans 12px 700` uppercase
- EV% : `DM Mono 13px 700` couleur verte/amber
- Cote : `DM Mono 14px 600`

**Espacement (tokens existants `--cf-*` à respecter) :**
- Padding cellule : `8px 10px` (réduit de 11px actuel → -3px/col = -51px sur 17 cols)
- Gap colonnes : géré par `padding`, pas par `gap` (table layout)
- Border-top : conserver `1px solid var(--border)` existant

#### Mobile V3 — Match Card (≤768px)

Transformer chaque `<tr>` en carte avec CSS. Aucun changement HTML nécessaire côté serveur.

```
┌─────────────────────────────────────────┐
│ ROLAND GARROS · TERRE BATT             │
│ Tour R32 · 14:30                    WTA │
├─────────────────────────────────────────┤
│ ● Samsonova    #39   6  6  ·15·  68%   │
│   Teichmann    #66   4  3              │
├─────────────────────────────────────────┤
│ [● BET FORT]  EV+11.2%    Cote 3.20▲  │
│                           ▸ Détails    │
└─────────────────────────────────────────┘
```

**Grid Template Mobile :**
```css
.tvb-card {
  display: grid;
  grid-template-areas:
    "meta   meta   meta"
    "player player prob"
    "signal signal odds";
  grid-template-columns: 1fr 1fr auto;
  grid-template-rows: auto auto auto;
  gap: 8px 12px;
}
```

**Zones mobiles :**
- `meta` → tournoi + surface + heure + circuit
- `player` → J1 sur ligne 1 / J2 sur ligne 2 — flex avec rang + score
- `prob` → `68%` gros + barre verticale (uniquement sur mobile)
- `signal` → chip SIGNAL + EV%
- `odds` → cote + edge badge

**Touch targets (44px min selon WCAG 2.5.5) :**
- Toute la card = tappable → ouvre le drawer
- Étoile ★ = bouton séparé 44×44px coin haut-gauche
- "▸ Détails" = bouton 44px height en bas de card

**Drawer mobile (expand) :**
```
[Drawer expanded]
─────────────────────────────
  ELO J1: ████████░░  1902
  ELO J2: ████████████ 2150
  Δ ELO: -248 ← avantage J2
─────────────────────────────
  Sets:  2-0 42%  2-1 28%  
         0-2 18%  1-2 12%
─────────────────────────────
  Forme J1: ● ● ○ ● ●  (L5)
  Forme J2: ○ ● ● ○ ●  (L5)
─────────────────────────────
  Jeux O/U:  O8.5 67% | U8.5 33%
  King Aces: Samsonova 58%
  Mental:    Réaction J1 72%
─────────────────────────────
  [🔔 Alerte IA]  [📊 Deep Analysis]
```

---

### [EXPERT 4] LEAD FRONTEND DEV
*Analyse le chaos HTML/CSS. Prescrit les nouvelles fondations.*

#### Autopsie technique complète

**Problème 1 : La popup flottante orpheline**

Le panneau "DR P1~ / DR P2~" visible sur le screenshot est `position:absolute` sans ancrage clair. Il faut tracer son origine dans le JS (ligne ~17161 et ~19313 : `const lab = (side === 'p1' ? 'DR P1' : 'DR P2') + suffix`). Ce popup est injecté en dehors du flux normal de la cellule.

*Fix V3 :* Supprimer la popup absolue. La remplacer par une **drawer row** — une `<tr>` collapsible insérée après chaque ligne principale.

```html
<!-- Structure V3 -->
<tr class="tvb-row" data-match-id="X">
  <!-- 8 colonnes seulement -->
</tr>
<tr class="tvb-drawer-row" data-match-id="X" hidden>
  <td colspan="8">
    <!-- Contenu secondaire : DR P1/P2, sets, forme, etc. -->
    <div class="tvb-drawer-inner">...</div>
  </td>
</tr>
```

Aucun `position:absolute`. Aucun `z-index`. Le drawer pousse le flux vers le bas naturellement.

**Problème 2 : Z-index sans couches documentées**

**ÉTAT ACTUEL (chaos) :**
```
z-index: 1 → 2 → 6 → 10 → 100 → 200 → 1000 → 1020 → 9000 → 9400 → 11000
```
Ces valeurs sont dispersées sur ~14 000 lignes de CSS inline + `<style>`.

**SYSTÈME V3 (7 couches nommées) :**
```css
:root {
  --z-base:     auto;   /* flux normal */
  --z-sticky:   20;     /* colonnes sticky */
  --z-hover:    30;     /* highlights hover */
  --z-tooltip:  100;    /* titres, info-bulle */
  --z-dropdown: 200;    /* menus déroulants */
  --z-modal:    1000;   /* modals #score-modal, #deep-modal */
  --z-overlay:  9000;   /* overlays plein-écran */
  --z-toast:    11000;  /* notifications toast */
}
```
→ Jamais de valeur hardcodée hors de ces 7. Jamais de `!important` sur z-index.

**Problème 3 : Contradiction `width:1% + white-space:nowrap` sur `.tvb-score-col`**

```css
/* ACTUEL — contradictoire */
#tennis-vb-table td.tvb-score-col { width:1%; white-space:nowrap; }
#tennis-vb-table .tn-sb { display:inline-grid; }
/* Sur table-layout:fixed, width:1% est ignoré.
   white-space:nowrap empêche le grid de wrapper → débordement */

/* V3 — cohérent */
#tennis-vb-table td.tvb-score-col {
  /* width gérée par colgroup uniquement */
  white-space: normal;  /* permet le wrap */
  vertical-align: middle;
}
#tennis-vb-table .tn-sb {
  display: inline-grid;
  max-width: 100%;        /* contraint au TD */
  overflow: hidden;       /* ne déborde plus */
  box-sizing: border-box;
}
```

**Problème 4 : `<th>` surchargés**

```html
<!-- ACTUEL — structure toxique -->
<th style="...">
  <svg class="i3d-th">...</svg>
  Proba Vic match
</th>

<th style="...">
  <span class="tgou-hwrap">
    Bets Prédictifs
    <button type="button" class="tgou-info" onclick="...">i</button>
  </span>
  <br><span class="tvb-th-sub">conseillés</span>
</th>

<!-- V3 — propre -->
<th class="tvb-th" data-col="signal" title="BET FORT / VALUE / PASS — EV modèle + confiance calibration + accord Elo/BSD">
  SIGNAL
</th>
```
**Règle V3 :** Un `<th>` = texte court + `title` pour tooltip natif. Les `<button>` info sont déplacés dans le drawer header ou dans un overlay séparé.

**Problème 5 : Sticky columns avec z-index:6**

```css
/* ACTUEL — z-index:6 ne suffit pas contre position:relative sur les TD suivants */
#tennis-vb-table thead th:nth-child(1) { z-index: 6; }

/* V3 — couche sticky dédiée */
#tennis-vb-table th:nth-child(1),
#tennis-vb-table td:nth-child(1) { position: sticky; left: 0;   z-index: var(--z-sticky); background: var(--bg3); }

#tennis-vb-table th:nth-child(2),
#tennis-vb-table td:nth-child(2) { position: sticky; left: 36px;  z-index: var(--z-sticky); background: var(--bg3); }

#tennis-vb-table th:nth-child(3),
#tennis-vb-table td:nth-child(3) { position: sticky; left: 156px; z-index: var(--z-sticky); background: var(--bg3); }

/* THEAD sticky doit avoir z-index supérieur aux TD sticky */
#tennis-vb-table thead th { z-index: calc(var(--z-sticky) + 1); }
```

**Problème 6 : overflow:hidden sur le scroll container**

Le `.table-responsive-wrapper` (ou un ancêtre) a un `overflow:hidden` qui casse le sticky.

```css
/* V3 — scroll container correct */
.table-responsive-wrapper {
  overflow-x: auto;          /* scroll horizontal */
  overflow-y: visible;        /* ne clip pas les sticky */
  position: relative;         /* stacking context local */
  -webkit-overflow-scrolling: touch;
}
/* JAMAIS overflow:hidden sur cet élément ni ses ancêtres directs */
```

---

## ANATOMIE FINALE V3

### Desktop — 8 Colonnes (973px total)

```
┌──┬──────────┬──────────────────────┬───────────────────┬──────────────┬──────────────────┬──────────┬──┐
│★ │Date+Surf │      Match           │     SIGNAL        │    Score     │  ELO + Proba     │ Value    │▸ │
│  │          │                      │                   │              │                  │          │  │
│36│  120px   │       230px          │     155px         │   150px      │     140px        │  110px   │32│
└──┴──────────┴──────────────────────┴───────────────────┴──────────────┴──────────────────┴──────────┴──┘
 STICKY (z:21)  STICKY (z:20)  STICKY (z:20)          PRIMARY (non-sticky)
```

**Colonne 2 — Date+Surface (120px) :**
```
14:30          ← DM Mono 14px bold
ROLAND GARROS  ← text3 11px truncate
● TERRE BATT   ← surface badge pill
```

**Colonne 3 — Match (230px) :**
```
● Samsonova  #39   ← ● = serving ball | #39 = rank pill
  Teichmann  #66   ← 2ème ligne
[WTA] [R32]        ← circuit + tour pills
```

**Colonne 4 — SIGNAL (155px) :**
```
[● BET FORT]       ← chip couleur sémantique
+11.2% EV  ●●●●○  ← EV% + 5 dots confiance
```

**Colonne 5 — Score (150px) :**
```
6  6  ·15·         ← .tn-sb widget (existant, conservé)
4  3               ← contraindre max-width:140px
```

**Colonne 6 — ELO + Proba (140px) :**
```
████████░░ 1902    ← dual minibar J1
████████████ 2150  ← dual minibar J2
68%  ██████████░░  ← win proba + barre 4px
```

**Colonne 7 — Value EV+ (110px) :**
```
3.20             ← cote décimale DM Mono 16px
▲ +8.3% EV      ← delta badge vert/rouge
```

**Colonne 8 — ▸ (32px) :**
```
▸              ← bouton expand, rotation 90° = ▼ si ouvert
```

---

### Mobile — Match Card (≤768px)

```
┌─────────────────────────────────────────────────────┐
│  ★  ROLAND GARROS · TERRE BATTUE          WTA  R32  │
│     25 mai · 14:30                                  │
├─────────────────────────────────────────────────────┤
│  ● Samsonova    #39    6  6  ·15·           68%     │
│    Teichmann    #66    4  3                 ███████░ │
├─────────────────────────────────────────────────────┤
│  [● BET FORT]  +11.2% EV        Cote 3.20 ▲ +8.3% │
│                                      ▸ Voir détails │
└─────────────────────────────────────────────────────┘
```

**Drawer mobile (tap ▸ Voir détails) :**
```
┌─────────────────────────────────────────────────────┐
│  ELO Surface                                        │
│  Samsonova  ████████░░  1902                        │
│  Teichmann  ████████████ 2150  Δ -248               │
├─────────────────────────────────────────────────────┤
│  Paris Conseillés                                   │
│  DR Samsonova win   0.33  ▼ Δ 0.00  S1 0.33~       │
│  DR Teichmann win   3.00  ▲ Δ 0.00  S1 3.00~       │
├─────────────────────────────────────────────────────┤
│  Issue Sets           Forme L5                      │
│  2-0  42% ████        Samsonova  ● ● ○ ● ●         │
│  2-1  28% ██          Teichmann  ○ ● ● ○ ●         │
├─────────────────────────────────────────────────────┤
│  Marchés Alternatifs                                │
│  Jeux O8.5  67%  |  King Aces: Samsonova 58%       │
│  Set1 J1:   38%  |  Mental Réaction J1:  72%       │
├─────────────────────────────────────────────────────┤
│  [🔔 Alerte IA]               [📊 Analyse Profonde] │
└─────────────────────────────────────────────────────┘
```

---

## PLAN DE NETTOYAGE CSS

### RÈGLES À BANNIR (liste noire production)

```css
/* ❌ BANNI-1 : popup absolue dans TD sans ancrage */
.tvb-bets-popup { position: absolute; z-index: 9000; }
/* → REMPLACER par : drawer row <tr hidden> */

/* ❌ BANNI-2 : width:1% dans table-layout:fixed (contradiction) */
#tennis-vb-table td.tvb-score-col { width: 1%; }
/* → REMPLACER par : laisser colgroup gérer la largeur */

/* ❌ BANNI-3 : white-space:nowrap sur parent d'inline-grid */
#tennis-vb-table td.tvb-score-col { white-space: nowrap; }
/* → REMPLACER par : white-space:normal ou rien */

/* ❌ BANNI-4 : overflow:hidden sur scroll wrapper */
.table-responsive-wrapper { overflow: hidden !important; }
/* → REMPLACER par : overflow-x:auto; overflow-y:visible */

/* ❌ BANNI-5 : z-index hardcodé hors des 7 couches */
#some-td { z-index: 9000 !important; }
/* → REMPLACER par : var(--z-overlay) */

/* ❌ BANNI-6 : <br> dans <th> */
/* Pas de solution CSS — change le HTML uniquement */
/* → REMPLACER par : title="" attr + white-space:nowrap sur th */

/* ❌ BANNI-7 : inline style="" sur <th> avec width */
<th style="text-align:center;color:#00e676;width:170px;">
/* → REMPLACER par : class="tvb-th tvb-col--signal" dans CSS dédié */

/* ❌ BANNI-8 : z-index:6 sur thead sticky (insuffisant) */
#tennis-vb-table thead th:nth-child(1) { z-index: 6; }
/* → REMPLACER par : var(--z-sticky) = 20, thead th : 21 */

/* ❌ BANNI-9 : animation CSS sur éléments non-transform/opacity */
/* Toute animation qui n'utilise pas transform ou opacity → force repaint */
/* Exceptions autorisées : filter:drop-shadow sur SVG légers */
```

### FONDATIONS V3 À IMPLÉMENTER

```css
/* ✅ FONDATION-1 : Variables de couches z-index */
:root {
  --z-sticky:   20;
  --z-hover:    30;
  --z-tooltip:  100;
  --z-dropdown: 200;
  --z-modal:    1000;
  --z-overlay:  9000;
  --z-toast:    11000;
}

/* ✅ FONDATION-2 : Scroll container correct */
.table-responsive-wrapper {
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

/* ✅ FONDATION-3 : Table V3 base */
#tennis-vb-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  min-width: 973px; /* = somme des 8 colonnes */
}

/* ✅ FONDATION-4 : Colgroup V3 (8 cols) */
/* col 1 : 36px | col 2 : 120px | col 3 : 230px | col 4 : 155px */
/* col 5 : 150px | col 6 : 140px | col 7 : 110px | col 8 : 32px */

/* ✅ FONDATION-5 : Sticky 3 colonnes identité */
#tennis-vb-table th:nth-child(1),
#tennis-vb-table td:nth-child(1) {
  position: sticky;
  left: 0;
  z-index: var(--z-sticky);
  background: var(--bg3);
}
#tennis-vb-table th:nth-child(2),
#tennis-vb-table td:nth-child(2) {
  position: sticky;
  left: 36px;
  z-index: var(--z-sticky);
  background: var(--bg3);
}
#tennis-vb-table th:nth-child(3),
#tennis-vb-table td:nth-child(3) {
  position: sticky;
  left: 156px; /* 36 + 120 */
  z-index: var(--z-sticky);
  background: var(--bg3);
}
#tennis-vb-table thead th {
  z-index: calc(var(--z-sticky) + 1);
}

/* ✅ FONDATION-6 : <th> headers propres */
#tennis-vb-table th.tvb-th {
  padding: 8px 10px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  background: var(--bg3);
  border-bottom: 1px solid var(--border);
  user-select: none;
}

/* ✅ FONDATION-7 : Score widget autonome */
#tennis-vb-table .tn-sb {
  display: inline-grid;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

/* ✅ FONDATION-8 : Drawer row */
#tennis-vb-table .tvb-drawer-row {
  background: var(--bg2);
}
#tennis-vb-table .tvb-drawer-row[hidden] {
  display: none;
}
#tennis-vb-table .tvb-drawer-inner {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  padding: 16px 20px;
}

/* ✅ FONDATION-9 : Mobile card transform */
@media (max-width: 768px) {
  .table-responsive-wrapper {
    overflow-x: visible; /* plus de scroll horizontal sur mobile */
  }
  #tennis-vb-table {
    display: block;
    min-width: unset;
  }
  #tennis-vb-table thead { display: none; }
  #tennis-vb-table tbody {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px;
  }
  #tennis-vb-table tr.tvb-row {
    display: grid;
    grid-template-areas:
      "meta   meta   meta"
      "player player prob"
      "signal signal odds";
    grid-template-columns: 1fr 1fr auto;
    gap: 6px 8px;
    background: var(--bg2);
    border-radius: 10px;
    border: 1px solid var(--border);
    padding: 12px;
    cursor: pointer;
  }
  #tennis-vb-table td { display: block; padding: 0; border: none; }
  #tennis-vb-table td[data-area="meta"]   { grid-area: meta; }
  #tennis-vb-table td[data-area="player"] { grid-area: player; }
  #tennis-vb-table td[data-area="prob"]   { grid-area: prob; }
  #tennis-vb-table td[data-area="signal"] { grid-area: signal; }
  #tennis-vb-table td[data-area="odds"]   { grid-area: odds; }
  /* Drawer mobile */
  #tennis-vb-table .tvb-drawer-row {
    /* Pas de grid-area, s'insère entre les cards comme block */
    display: block;
    border-radius: 0 0 10px 10px;
    margin-top: -8px;
    border: 1px solid var(--border);
    border-top: none;
  }
  #tennis-vb-table .tvb-drawer-inner {
    grid-template-columns: 1fr 1fr; /* 2 cols sur mobile */
  }
}

/* ✅ FONDATION-10 : SIGNAL chip */
.tvb-signal-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-family: 'Instrument Sans', sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .3px;
  white-space: nowrap;
}
.tvb-signal-chip--bet   { background: rgba(0,230,118,.18); color: #00e676; border: 1px solid rgba(0,230,118,.35); }
.tvb-signal-chip--value { background: rgba(255,167,38,.14); color: #ffa726; border: 1px solid rgba(255,167,38,.30); }
.tvb-signal-chip--pass  { background: var(--bg4); color: var(--text3); border: 1px solid var(--border); }
.tvb-signal-chip--live  { background: rgba(239,68,68,.18); color: #ff4d4d; border: 1px solid rgba(239,68,68,.35); animation: psDivergencePulse-cyan 1.4s ease-in-out 2; }

/* ✅ FONDATION-11 : ELO dual minibar */
.tvb-elo-bar-wrap { display: flex; flex-direction: column; gap: 4px; }
.tvb-elo-bar-row  { display: flex; align-items: center; gap: 6px; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text2); }
.tvb-elo-bar      { height: 5px; border-radius: 3px; background: var(--bg4); flex: 1; overflow: hidden; }
.tvb-elo-bar-fill { height: 100%; border-radius: 3px; transition: width .3s ease; }
.tvb-elo-bar-fill--j1 { background: #29b6f6; }
.tvb-elo-bar-fill--j2 { background: #a78bfa; }
.tvb-elo-val      { min-width: 36px; text-align: right; }

/* ✅ FONDATION-12 : Form sparkline 5 dots */
.tvb-form-dots { display: inline-flex; align-items: center; gap: 3px; }
.tvb-form-dot   { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 7px; }
.tvb-form-dot--w { background: #00e676; }
.tvb-form-dot--l { background: rgba(255,77,77,.55); }
.tvb-form-dot--u { background: var(--bg4); border: 1px solid var(--border); }
```

---

## RÉSUMÉ EXÉCUTIF

| Dimension | V2 (actuel) | V3 (cible) |
|-----------|-------------|-----------|
| Colonnes visibles | 17 | 8 |
| Largeur totale | ~1930px | 973px |
| Colonnes sticky | 3 (buggy) | 3 (z-index:20) |
| Popup absolue flottante | ✗ (position:absolute) | ✓ Drawer row |
| Headers multi-lignes | ✗ (15/17 ont `<br>` ou `<button>`) | ✓ Texte court + `title` |
| Mobile support | ✗ Scroll horizontal infini | ✓ Match Card CSS Grid |
| Z-index système | ✗ Chaos 1→11000 | ✓ 7 couches nommées `--z-*` |
| Micro-visualisations | ✗ Texte pur | ✓ Minibars + dots + chips |
| Overflow bug | ✗ `hidden` sur scroll wrapper | ✓ `auto` + `visible` |

---

## PROCHAINES ÉTAPES (après GO)

### Sprint 1 — Fondations HTML (priorité critique)
1. Réduire le `<colgroup>` à 8 cols + mettre à jour les JS `renderTennisVB*` pour émettre 8 `<td>` + 1 `<td colspan="8">` drawer
2. Nettoyer tous les `<th>` → texte court + `title` attr
3. Ajouter attributs `data-area` sur chaque `<td>` pour le mapping mobile

### Sprint 2 — CSS Fondations (priorité haute)
4. Implémenter les 12 fondations CSS ci-dessus dans le bloc `<style>` tennis (lignes ~4645→14513)
5. Supprimer toutes les règles de la liste noire
6. Valider sticky sur Chrome + Safari (overflow-y:visible fix Safari)

### Sprint 3 — Micro-visualisations (priorité moyenne)
7. `tvb-elo-bar-wrap` dans la colonne ELO
8. `tvb-form-dots` dans le drawer
9. `tvb-signal-chip` en remplacement de la structure actuelle

### Sprint 4 — Mobile (priorité moyenne)
10. Activer le CSS Grid card transform `@media (max-width:768px)`
11. Tester touch targets 44px
12. Valider drawer expand/collapse sur iOS Safari

---

*Document généré par table ronde design d'urgence — PariScore V3*  
*Expert Parieur Pro · Expert DataViz (Cleveland-McGill) · Expert UI/UX · Expert Frontend Dev*  
*En attente GO production — aucune modification de code production effectuée*
