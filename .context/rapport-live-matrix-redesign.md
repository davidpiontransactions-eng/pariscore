# Rapport de redesign — « Live Matrix — évolution des cotes »

**Bead** : ParisScorebis-nwjk
**Date** : 2026-09-28
**Périmètre** : recherche + conception uniquement. Aucune ligne de code de production modifiée.
**Composants concernés** : `src/components/tennis/live-score-matrix.tsx` (rendu), `src/lib/prediction/live-matrix.ts` (modèle), encadrement dans `src/components/tennis/match-card.tsx:566` et `src/components/tennis/match-card-broadcast.tsx:500`.

---

## 1. Diagnostic du design actuel

### 1.1 Ce que le composant fait réellement

Le composant reproduit la « game matrix » de Bet Angel Tennis Trader (Peter Webb) : une grille 4×4 des états de points du jeu en cours (0 / 15 / 30 / 40), où chaque cellule affiche la cote juste A (principale, 11px) et B (secondaire, 9px) si le score atteint cet état. Un pied de page compare la cote 1xBet au modèle et affiche un éventuel badge de value.

Données réellement disponibles aujourd'hui (cartographie vérifiée dans le code) :

| Couche | Source | Champs |
|--------|--------|--------|
| États de points | `buildLiveMatrix` → `cells[4][4]` | `pGameA`, `pSetA`, `pMatchA`, `fairOddA`, `fairOddB` |
| État courant | `model.current` + `liveState` | points clampés, `server`, `games`, `sets` |
| Probas de service | `predictTotalGames` + `estimateServePointsWon` | `pServeA`, `pServeB` (blend stats BSD + récence) |
| Rupture de jeu | `matrixBreakPointSide` | `bpSide` ∈ {A, B, null} |
| Marché | `liveState.oddsA/oddsB` | cotes 1xBet live, `edgeA/edgeB` (> 3 % → badge value) |
| Contexte | `useTennisLiveStats` | `observedServeA/B`, `liveProbA/B` |
| Structure | modèle | `pWinSetFresh`, `bo3` |

Le modèle est riche. **C'est le rendu qui l'écrase.**

### 1.2 Pourquoi ça ne parle pas — points faibles concrets

1. **14 cellules sur 16 sont du bruit.** Depuis un état de points, seules **deux** issues sont possibles (A gagne le point → `(i+1, j)` ; B gagne → `(i, j+1)`). Le code le sait déjà : il pose `border border-primary/40` sur les cellules atteignables (`live-score-matrix.tsx:217`). Mais les 14 autres restent affichées au même volume visuel. L'utilisateur doit faire lui-même le calcul « et si… » au lieu de le voir.
2. **Surcharge numérique** : 16 cellules × 2 cotes = 32 nombres, + score, + serveur, + badge break, + cotes marché A/B, + cotes justes A/B, + badges value = **environ 38 chiffres** dans un encart d'une hauteur de quelques centaines de pixels, pour des polices de 9 à 11 px.
3. **Ambiguïté Deuce/Avantagé structurelle** : `clampPoints` (`live-matrix.ts:85`) écrase Av. A, 40-40 et Av. B dans **la même cellule (3,3)**. Trois états de match radicalement différents partagent un seul rectangle et une seule cote affichée. L'information la plus tendue du jeu (le point de break) est la plus mal servie.
4. **Mismatch sémantique grille/cote** : la grille est une grille de *points de jeu*, mais la cote affichée est la cote de *match*. L'utilisateur lit « 40-15 → 1.42 » et pense « proba que ce jeu soit gagné », il reçoit « proba que le match soit gagné ». Aucun libellé ne résout la confusion.
5. **Palette qui s'aplatit** : `cellTint` (`live-score-matrix.tsx:50`) déclenche à 0.65 / 0.5 / 0.35 sur `pMatchA`. Dans un match équilibré, les 16 cellules tombent toutes dans la bande ambre/ neutre → **aucune hiérarchie, aucun contraste, aucune information pré-attentive**.
6. **Zéro profondeur, zéro mouvement** : un `<table>` HTML plat, `border-spacing: 0.5`, un `ring-2` sur la cellule courante. Aucun changement d'état perceptible quand un point se joue — alors que l'info change à chaque point.
7. **L'information actionnable est enfouie** : le delta entre cote payée et cote juste (la seule chose qui déclenche une décision de pari) est en **11 px dans le pied de page**, sous la grille.
8. **Mobile 390 px** : `overflow-x-auto` sur un `<table>` à 5 colonnes → cellules ~60 px de large, fontes à 9-11 px, scroll horizontal caché. Illisible en une fraction de seconde, ce qui est exactement l'usage live.
9. **Redondance verticale** : dans `match-card.tsx`, juste au-dessus, `ProbabilityBar` + `MiniProbabilityCurve` affichent déjà P(A)/P(B). Trois affichages de probabilité empilés se disputent la même zone d'attention.
10. **Le titre est du jargon** : « Live Matrix » ne parle à personne hors traders Betfair. Le vocabulaire « cote juste », « matrice », « value » n'est pas celui d'un parieur mobile 390 px qui veut une réponse.

### 1.3 La leçon de référence (voir §2)

La critique du graphe de win probability d'ESPN (Defector, 2024) s'applique trait pour trait : une proba redondante avec le score affiché « ne parle pas » — elle ne devient parlante que si elle raconte **une conséquence** (« si X gagne ce point, ta cote passe de 1.72 à 1.44 »). Le problème du composant actuel n'est pas le calcul, c'est l'absence de conséquence mise en scène.

---

## 2. Benchmark web

| # | Source | URL | Ce qu'on emprunte |
|---|--------|-----|-------------------|
| 1 | Bet Angel — Tennis Trader (Peter Webb), page produit + article « Creating a tennis trading model » | https://www.betangel.com/tennis/ | La source d'origine de la « game matrix » et sa promesse verbale : *« where are the odds going »* / *« what will happen to the odds if there is a break of serve »*. On garde la question, on jette la grille tableur. |
| 2 | Stats Perform — Tennis Predictions Feed MA21 Detailed | https://developers.statsperform.com/feed-ma21-tennis-detailed-predictions | Deux champs à copier conceptuellement : `pointWinner.a/b` (proba du **prochain point**, la décision micro) et `leverage` (« how strongly the LWP will possibly change after the point », l'anticipation macro). Vocabulaire produit : *live probability widgets*, *leverage*, *clutch point*. |
| 3 | Defector — critique du graphe de win probability ESPN | https://defector.com/espns-win-probability-graphic-wants-to-give-you-gambling-brain | Leçon : une proba live qui double l'information du score est vécue comme du bruit ; elle ne fonctionne que transformée en **histoire/conséquence**, ou post-événement. Traduction : ne jamais afficher « P = 63 % » sans afficher « donc : cote 1.72 → 1.44 ». |
| 4 | Flat Studio — « Why your betslip is wrong : UX of a trading terminal » | https://www.flatstudio.co/blog/why-your-betslip-is-wrong-ux-of-a-trading-terminal | Deux mental models séparés (parieur casual vs exécutant), règle mobile **tap-to-reveal** de l'info secondaire, et la stabilité du layout comme critère n°1 en session live (« data density is never a layout problem, it's a mental model problem »). |
| 5 | Comparatif d'interfaces de paris live (2026) | https://social.japrime.id/read-blog/566618 | Règle de conception : **« the data can change quickly without the interface itself needing to behave unpredictably »**. La donnée bouge, l'UI reste stable ; les lignes ne doivent jamais sauter, sinon l'utilisateur re-scanne toute la zone. Aussi : distinguer vitesse technique et *vitesse de compréhension*. |
| 6 | CodeFronts — carte KPI à tilt CSS 3D | https://codefronts.com/components/css-3d-tilt-hover-cards/dashboard-analytics-kpi-widget-card/ | La recette 3D sans dépendance : `perspective(1600px)` + tilt borné à ±4° (perçu comme de l'élévation, pas de la rotation), `translateY(-6px)` + ombre portée qui s'approfondit en même temps, garde `prefers-reduced-motion` et `(hover:hover) and (pointer:fine)`. Leur principe : la 3D en dose homéopathique dans un dashboard. |
| 7 | RallyIQ — tracker win probability point-by-point tennis | https://github.com/Magi0721/RallyIQ | Architecture DP récursive jeu → set → match (déjà notre cas) + courbe WP rendue comme un récit, avec momentum EWMA séparé. Confirme que la forme « courbe + palier » est attendue par ce public. |
| 8 | ESPN / NFL Next Gen Stats — table AR et data-viz 3D broadcast | https://www.sportsvideo.org/2022/10/03/espn-dmed-break-new-ar-ground-with-real-time-data-visualization-on-monday-night-football/ | Le référentiel « 3D qui parle » : la profondeur sert à **hiérarchiser et à faire glisser l'œil**, jamais à représenter une valeur (sinon distorsion). Un replay 3D ne montre qu'**un** fait à la fois. |
| 9 | OddsPortal — cotes live + mouvements | https://www.oddsportal.com/ | Convention du graphique de mouvement de cotes (ligne historique + flèche de sens) : le mouvement de cote se lit comme une **tendance**, pas comme un tableau de chiffres. |
| 10 | Convention Sofascore / Flashscore (déjà suivie par `win-probability-chart.tsx`) | https://www.sofascore.com | Courbe d'aire unique, ligne de référence 50 %, label direct au lieu de légende, zéro chartjunk (Tufte) — à respecter pour rester cohérent avec le reste de la carte match. |

---

## 3. Panel d'experts — débat et convergence

Quatre voix, trois tours, puis convergence.

**Tour 1 — positions initiales**

- **UI designer** : « Le problème c'est le mot *matrice*. Une grille de 16 cases c'est un tableur, pas une prédiction. Je veux un objet unique, une scène, une question posée en gros : *qui prend ce point ?*. La 3D doit servir à ça — un truc qui se soulève, qui a une ombre, qui bouge quand le point se joue. »
- **Data-viz engineer** : « Attention : la 3D comme *encodage* de valeur est l'anti-pattern canonique — une tuile haute est systématiquement surestimée par rapport à une tuile large. Si on met de la profondeur, elle doit être **décorative et directionnelle** (qui est où, quoi est accessible), tandis que la valeur reste portée par la position 2D et la couleur. Et je refuse de réafficher 16 probabilités qu'on ne peut pas comparer entre elles de toute façon. »
- **Betting/trading UX** : « Vous parlez tous de symbole, moi je veux du **delta**. Le parieur ne décide pas sur « P(A) = 63 % », il décide sur « ma cote va passer de 1.72 à 1.44 ». Donc l'affordance centrale n'est pas la probabilité, c'est **l'écart de cote entre maintenant et le prochain point**. Et il ne faut que deux branches : ce qui peut arriver à l'instant suivant. Le reste, c'est du contexte pour les traders avertis — à mettre en second écran, pas en premier. »
- **Mobile UX 390 px** : « Tout le monde parle en desktop. Sur 390 px j'ai 358 px utiles. Une grille 5 colonnes c'est mort — déjà aujourd'hui. Je veux **une décision par pouce** : deux gros blocs côte à côte (A / B), au moins 72 px de haut, et tout le reste en tap-to-reveal. Le tilt souris, la rotation, l'ombre animée : désactivable, et coupé sur `(hover: none)`. »

**Tour 2 — arbitrages**

- Le designer cède sur le grand cartoule plein écran : « OK, une scène, mais j'ai besoin d'au moins un moment *spectaculaire* — sinon on perd le côté "plus visuel" que le client demande explicitement. »
- Le data-viz engineer obtient la règle : **profondeur = état et focus, jamais magnitude** ; et obtient la suppression des 14 cellules non atteignables de l'affichage primaire.
- Le trading UX obtient la règle : **le delta de cote est le héros**, la proba est l'accompagnement, la value reste en accessoire.
- Le mobile obtient la règle : **aucun scroll horizontal, cibles tactiles ≥ 44 px, hover-only interdit**.
- Désaccord maintenu : 3D réelle (WebGL) vs faux-3D CSS. Le data-viz tranche : « 16 tuiles et une sphère, aucun monde ne justifie 150 ko de three.js et un rendu client. CSS 3D + compositing GPU suffit. » — acté.

**Tour 3 — convergence en 3 modèles distincts et radicalement différents**

Le panel refuse un « compromis mou » et découpe l'espace en trois axes orthogonaux :

1. **Axe ÉTAT / DÉCISION** → on ne montre que l'instant suivant, en deux branches. → **Modèle A « La Fourche »**
2. **AXE ÉTAT / SCÈNE** → on garde les 16 états mais on les transforme en relief 3D navigable. → **Modèle B « Le Relief »**
3. **Axe TEMPS / PROJECTION** → on abandonne la grille, on montre d'où la cote vient et où elle peut aller. → **Modèle C « La Rivière »**

Ces trois modèles ne sont pas trois skins du même composant : ils changent la question posée (« quoi maintenant ? » / « où sont tous les états ? » / « où va le prix ? »).

---

## 4. Modèle A — « La Fourche »

**Concept** : une phrase — *on ne montre que les deux choses qui peuvent arriver au prochain point, et ce que chacune coûte ou rapporte en cote.*

### Description visuelle

- **Layout** : encart unique, deux registres.
  - **Registre haut (pivot)** : bandeau score `4-3 · 1-0 sets`, pastille serveur (bleu/rose), badge « balle de break pour A » en ambre, et **la cote 1xBet actuelle en gros** (`1.72 / 2.14`, chiffres 20-22 px tabular-nums). C'est le point d'ancrage : d'où on part.
  - **Registre bas (la fourche)** : deux **cartes-jumeaux** de largeur égale, séparées par un nœud central. `A gagne le point` à gauche, `B gagne le point` à droite. Chaque carte contient, en gros : la **cote juste résultante** (`1.44` / `2.90`), sous elle le **delta en points de cote** (`-0.28` / `+0.76`) coloré (vert si la cote baisse pour le favori, rose pour l'adversaire), puis en petit `P(jeu) 71 %` et `P(match) 58 %`.
  - **Nœud central** : petite carte carrée en retrait qui porte l'état de points courant (`40-15`) et d'où partent deux **connecteurs SVG** vers les deux cartes.
- **Profondeur 3D (faux-3D, discrète)** : le pivot est au plan `z = 0`, la carte-jumelle **favorie** (celle dont `pGameA` ou `1-pGameA` est le plus grand) est soulevée `translateZ(14px)` avec ombre portée plus dense et bordure emerald ; l'autre est enfoncée `translateZ(-6px)`, opacité 0.85. La branche dominante est donc physiquement *plus près* de l'utilisateur — la 3D encode le focus, pas la valeur (règle data-viz).
- **Couleurs** : fond `bg-card` de la charte, branche A accent `#00e676` en wash `emerald-500/12`, branche adverse en `rose-500/10`, delta négatif `rose`, delta positif `emerald`, badge break `amber-500/15`. Thème light et dark gérés par les tokens existants.
- **Mouvements** :
  - Changement de score → `framer-motion` `layout` : les deux cartes s'échangent la dominance (le soulevé devient enfoncé) en 220 ms `ease-out` ; les chiffres de cote défilent (count-up court, 180 ms) pour matérialiser le mouvement du prix.
  - Apparition : les deux connecteurs SVG se tracent (`stroke-dashoffset`, 300 ms) au montage, comme si la fourche se déploiyait depuis le pivot.
  - Badge break : pulse lent `opacity` 2 s, uniquement si `bpSide !== null`.
  - Toute animation coupée sous `prefers-reduced-motion: reduce`.

### Couches de données affichées

Cote 1xBet actuelle (A et B) · cote juste A après point · delta de cote · `pGameA` résultant · `pMatchA` résultant · serveur · état de points · break point · value éventuel (badge compact, une seule ligne).

### Affordance « qui gagne ce jeu ? »

La carte dominante est **plus haute, plus lumineuse, bordée vert néon, et porte le plus gros chiffre** (`P(jeu) 71 %` lisible en 1 s). Un seul regard répond à la question. Le libellé est explicite : `PREND LE JEU` en surtitre sur la carte dominante.

### Anticipation des cotes 1xBet

C'est le cœur du modèle : chaque branche affiche **la cote vers laquelle 1xBet va dériver si ce point est gagné par A ou par B**, avec le delta signé. L'utilisateur voit littéralement « le chemin du prix ». Une ligne secondaire ajoute l'écart avec la cote payée (edge) quand il dépasse 3 %.

### Comportement mobile 390 px

- Pivot en pleine largeur (score + cote 1xBet gros).
- Les deux cartes-jumeaux **côte à côte** : 2 × ~170 px utiles, hauteur mini 96 px → cibles tactiles larges, aucun scroll horizontal.
- Le détail `P(set)` / `P(match)` passe en tap-to-reveal (règle Flat Studio) : tap sur une carte = feuille vaul/Popover avec le détail.
- Pas de tilt souris, pas de `hover` requis pour rien lire (règle `(hover: none)`).
- Total visé : **< 320 px de haut** pour tenir au-dessus de la pliure dans `match-card-broadcast`.

### Stack technique — 100 % deps existantes (vérifiées dans `package.json`)

- `framer-motion` ^12.23.2 (déjà utilisé : `momentum-dr.tsx`, `tennis-player-card.tsx`) → `layout`, `AnimatePresence`.
- SVG inline (navigateur, zéro dep) → connecteurs, déploiement `stroke-dashoffset`.
- Tailwind CSS 4 + tokens de la charte (`cn`, classes `emerald/rose/amber` déjà utilisées par le composant actuel).
- `lucide-react` ^0.525.0 pour les icônes (`Zap`, `TrendingUp`).
- **Aucune nouvelle dépendance. Aucun three.js, aucun d3 direct** (recharts embarque ses internals, on ne l'utilise pas ici).

### Effort estimé

**8 à 10 h** (composant + i18n `liveMatrix` existant + intégration 2 points d'appel + QA 390 px + thème light/dark).

### Pros / cons

- **Pros** : réponse à la question n°1 immédiate ; charge cognitive minimale (2 choix, pas 16) ; le delta de cote devient le héros ; le moins cher ; le meilleur en mobile ; n'empêche pas de garder un mode « grille » repliable pour les traders.
- **Cons** : le côté « 3D/visuel » est volontairement discret (l'utilisateur a demandé *plus* de 3D) ; on perd la vue d'ensemble des 16 états (le « et si le score atteignait 40-40 » disparaît de l'écran primaire) ; à rejouer visuellement si le match est très équilibré (les deux cartes se ressemblent).

---

## 5. Modèle B — « Le Relief »

**Concept** : une phrase — *les 16 états deviennent une carte topographique en 3D : la hauteur montre à quel point ce point va faire bouger la cote, la couleur montre qui est favori, et une balle lumineuse marque où on en est.*

### Description visuelle

- **Layout** : conteneur unique de 160-180 px de haut, `perspective: 1100px` sur le wrapper, `transform: rotateX(52deg) rotateZ(-12deg)` sur le plateau (donne la plongée isométrique type table de jeu).
- **Plateau** : les 16 états sont posés sur une grille 4×4 **en perspective** (chacun est un `<button>` positionné par `grid` + `translate3d`). Axes annotés sur les arêtes du plateau : `points de A →` et `points de B ↙`, libellés 0/15/30/40 en 9-10 px.
- **Encodage 3D (règle du panel : profondeur = focus/état, pas magnitude)** :
  - **Hauteur des tuiles** = `leverage`, c'est-à-dire `|cote juste de cet état − cote juste de l'état courant|` borné et normalisé → une tuile plate = « rien ne change », une tuile haute = « le prix explose ». C'est l'encodage principal et il est **redondé** par l'opacité de la face supérieure pour rester lisible (double encoding, pas distorsion seule).
  - **Couleur de face** = favori selon `pMatchA` : emerald (≥0.65), emerald léger (≥0.5), ambre (≥0.35), rose — mêmes seuils que `cellTint` actuels mais appliqués sur un objet 3D isolé, donc perceptibles (le problème n°5 du diagnostic venait de 16 surfaces adjacentes de même teinte).
  - **État courant** = **sphère lumineuse** posée sur sa tuile : `radial-gradient` blanc → `#00e676`, `box-shadow` glow 20 px, diamètre 22 px. Elle a une vraie ombre portée sur le plateau (`box-shadow: 0 18px 12px -8px rgba(0,0,0,.55)`).
  - **Deux tuiles accessibles** = halo `ring` pulsant blanc opacité 0.35 → 0.7 → 0.35 (1.4 s), avec une mini-flèche SVG orientée vers la tuile.
  - **Tuiles inatteignables** : opacité 0.45, hauteur figée basse — présentes pour le contexte, visuellement silencieuses.
  - **Deuce/Avantagé** : le défaut n°3 est corrigé en scindant visuellement le coin (3,3) en **trois micro-tuiles** (`40-40`, `Av. A`, `Av. B`) — 18 éléments au total, le seul endroit où la grille est enrichie.
- **Couleurs** : plateau en dégradé sombre `from-slate-900/60` (dark) / `slate-100` (light), tuiles emerald/ambre/rose avec bordure `white/10`, sphère `#00e676`.
- **Mouvements** :
  - Changement de point → la sphère **roule** vers sa nouvelle tuile (`framer-motion` `animate` en `x/y/z` avec spring `stiffness 220, damping 26`), l'ombre suit.
  - Les hauteurs de tuiles se recalculent avec un `stagger` de 35 ms en vague depuis la sphère → on **voit** la cote se propager sur tout le plateau.
  - **Tilt pointeur** : ±4° max, `pointermove`, filtre `(hover:hover) and (pointer:fine)` + `prefers-reduced-motion` (recette CodeFronts, §2).
  - Pas de rotation automatique continue (instable en peripheric vision — règle CodeFronts).
- **HUD fixe** : bandeau au-dessus du plateau (non transformé, donc net) : score, serveur, break point, **cote 1xBet actuelle**, et la cote cible de la tuile survolée/tapée.

### Couches de données affichées

`leverage` (Δ cote) en hauteur · favori en couleur · `pGameA` de la tuile survolée · `pSetA` et `pMatchA` en popover · cote 1xBet actuelle (HUD) · break point (anneau ambre sur le coin de Avantagé) · serveur (pastille sur la sphère) · value edge (badge HUD).

### Affordance « qui gagne ce jeu ? »

Trois signaux convergents sur la sphère : (1) la tuile **où elle va rouler à l'issue du point la plus favorable** est la plus haute et la plus saturée ; (2) un surtitre `PREND LE JEU — 71 %` attaché à la sphère elle-même ; (3) le halo des deux destinations indique les deux issues possibles. La lecture est : *la sphère roule à gauche = A prend le jeu, et le plateau montre immédiatement ce que ça coûte*.

### Anticipation des cotes 1xBet

Le plateau **est** l'anticipation : la hauteur de chaque tuile est littéralement « combien ce point fera bouger le prix ». On répond en une phrase : « si A gagne ce point, la cote monte ici (tuile haute) ; sinon elle redescend là ». Le HUD affiche la cote cible chiffrée au survol/tap, avec le delta signé.

### Comportement mobile 390 px

- La perspective est réduite : `rotateX(42deg) rotateZ(-8deg)`, plateau ~150 px de haut, libellés réduits aux 4 valeurs.
- **Pas de tilt** (pas de survol sur `(hover: none)`) : la plongée est fixe.
- **Tap-to-reveal** : tap sur une tuile → feuille basse (vaul, déjà en dépendance) avec cote juste, `P(jeu)/P(set)/P(match)`, delta vs cote 1xBet.
- La sphère et le HUD restent toujours visibles sans interaction.
- Garde-fous perf mobile : `will-change: transform` sur les 18 tuiles, aucune animation de `filter`/`backdrop-filter`, `transform` + `opacity` uniquement (compositing GPU), animations coupées si `prefers-reduced-motion`.
- Si le device déclare `deviceMemory < 4` ou `prefers-reduced-data`, bascule automatique sur le **Modèle A** (fallback identique, aucune donnée perdue).

### Stack technique — 100 % deps existantes (vérifiées)

- CSS 3D natif : `perspective`, `transform-style: preserve-3d`, `translate3d`, `rotateX/rotateZ` — navigateur uniquement.
- `framer-motion` ^12.23.2 : déplacement de sphère (spring), stagger des hauteurs, `AnimatePresence` du popover.
- Tailwind CSS 4 (classes `transform-3d` / variables CSS custom).
- `vaul` ^1.1.2 (déjà en dépendance) pour le tap-to-reveal mobile.
- **Explicite : pas de `three` / `@react-three/fiber`** — justification : 18 éléments simples, aucune géométrie, aucun shader ; three.js ajouterait ~150-180 ko au bundle client et un hydratation dédiée pour un gain visuel nul sur ce volume. La justification est jugée *faible*, donc la dépendance est refusée au sens de la règle « AUCUNE nouvelle dépendance sans justification forte ».

### Effort estimé

**16 à 20 h** (plateau 3D + dérive des hauteurs + roulade de sphère + variantes mobile/desktop + fallback + QA perfs).

### Pros / cons

- **Pros** : répond exactement à la demande « plus 3D, plus visuel » ; garde la totalité des 16 états (aucune information perdue) ; la hauteur rend le *leverage* pré-attentif (on voit la secousse du prix avant de lire un chiffre) ; corrige le défaut de Deuce/Avantagé ; objet mémorable et différenciant.
- **Cons** : le plus cher et le plus risqué (temps de conception, perf mobile, régression d'accessibilité : les tuiles doivent rester `button` avec libellé `aria-label` complet) ; la 3D peut distraire de la décision si le mouvement est trop présent ; lecture d'une valeur dans la profondeur moins précise que sur un plat → exige le double encoding + HUD chiffré ; 18 éléments interactifs = surface de bugs plus large.

---

## 6. Modèle C — « La Rivière des cotes »

**Concept** : une phrase — *on supprime la grille : on montre d'où vient la cote 1xBet et, à droite, l'éventail des deux trajectoires possibles pour les prochains points.*

### Description visuelle

- **Layout** : graphique pleine largeur, 150 px de haut, structuré en deux zones.
  - **Zone gauche (~70 %) — le fleuve** : `ComposedChart` recharts. Axe X = ticks du set écoulés (points joués, buffer glissant max 50, mêmes conventions que `win-probability-chart.tsx`). Axe Y = **cote A, inversée** (cote basse en haut = favori en haut, lisibilité instinctive). Trois séries : ligne pleine épaisse 2 px = **cote 1xBet observée** (moyenne mobile 3 pts), ligne pointillée 1.5 px = **cote juste du modèle**, aire `emerald-500/10` entre les deux = **zone de value** quand le marché est sous-cote, ligne horizontale de référence 50 %-proba convertie en cote (2.00) en `stroke-dasharray` gris.
  - **Zone droite (~30 %) — l'éventail** : à partir du dernier point, deux **bandes SVG** qui s'écartent sur 4 pas à droite, chacune étiquetée en bout : `1.44` (A gagne le point) et `2.90` (B gagne le point). L'épaisseur de chaque bande = proba de l'issue (bande large = issue probable). Un point noir marque la cote actuelle au nœud de l'éventail.
  - **Sous le graphique — la barre de leverage** : histogramme fin (18 px) d'un point par pas, hauteur = `|Δ cote|` si ce point avait été gagné/perdu, couleur selon le signe. C'est la traduction du champ `leverage` de Stats Perform.
- **Profondeur 3D (la plus faible des trois, assumée)** : l'éventail est posé sur un léger `rotateX(8deg)` avec ombre portée, pour se détacher du fleuve comme une « feuille qui se déplie ». Le reste est plat.
- **Couleurs** : fond `bg-card`, ligne marché `#00e676` 2 px, ligne modèle `text-muted-foreground` pointillée, aire de value `emerald-500/10`, histogramme `emerald` (prix qui baisse) / `rose` (prix qui monte), repère 2.00 gris.
- **Mouvements** :
  - À chaque point : le fleuve **glisse** d'un pas (`transform: translateX` CSS sur le wrapper, 260 ms `ease-out`) — l'UI reste stable, seul le contenu défile (règle social.japrime.id, §2.5).
  - L'éventail se redéploie : `stroke-dasharray` réanimé 300 ms à chaque changement de score.
  - La ligne de cote modèle effectue un **count-up** court sur ses deux extrémités.
  - Aucune animation `isAnimationActive` recharts (désactivée pour perf) — le mouvement est porté par le wrapper CSS.

### Couches de données affichées

Historique cote 1xBet (buffer glissant) · cote juste modèle (historique) · zone de value · cote actuelle · **cotes cibles des 2 issues du prochain point** · barre de leverage par point · break point (marqueur ambre vertical sur le dernier pas) · serveur (bandeau) · score.

### Affordance « qui gagne ce jeu ? »

Moins directe que A et B : elle est portée par **la pente de la dernière portion du fleuve + l'étiquette haute de l'éventail**. On ajoute donc un surtitre explicite hors graphique : `PROCHAIN POINT — A favori 71 %` en tête de l'encart. La question reste répondable en un regard, mais elle demande une lecture de courbe, donc un effort cognitif supérieur.

### Anticipation des cotes 1xBet

C'est le point fort absolu du modèle : c'est le seul des trois qui montre **l'historique** (« la cote était à 2.30 il y a 10 points, elle est à 1.72 ») **et** la projection. On voit la tendance, l'accélération, et la fourchette de prix des deux issues suivantes. L'éventail répond littéralement « où va le prix selon le prochain point ».

### Comportement mobile 390 px

- Graphique pleine largeur, **120 px** de haut, `YAxis` et `XAxis` réduits à 2 ticks (recharts les masque nativement).
- L'éventail passe en **deux étiquettes seules** (pas de bandes pleines) sous le dernier point, empilées verticalement à droite.
- Barre de leverage conservée (elle ne coûte rien en largeur).
- Aucun geste requis : tout est lisible sans tap. Tap sur le graphique = tooltip recharts (existant).
- Zéro scroll horizontal.

### Stack technique — 100 % deps existantes (vérifiées)

- `recharts` ^2.15.4 (déjà utilisé dans `win-probability-chart.tsx`, `momentum-storyline.tsx`, `stats-radar-chart.tsx`) : `ComposedChart`, `Area`, `Line`, `ReferenceLine`, `Tooltip`, `ResponsiveContainer`.
- `framer-motion` ^12.23.2 (optionnel, glissement wrapper).
- SVG inline pour l'éventail de projection (recharts ne produit pas les bandes projetées).
- Tailwind CSS 4, `lucide-react`.
- **Aucune nouvelle dépendance.** Note : `chart.js` ^4.5.1 + `chartjs-plugin-annotation` sont présents mais **non utilisés côté tennis** — inutile d'introduire un second moteur de chart pour ce composant (règle de cohérence : un composant = la lib déjà utilisée par ses voisins).

### Effort estimé

**12 à 14 h** (chart recharts + éventail SVG projeté + barre de leverage + buffer d'historique + variantes mobile/desktop).

### Pros / cons

- **Pros** : le seul modèle qui répond à la fois à « d'où ça vient » et « où ça va » ; le delta de cote se lit comme une tendance (naturel pour un parieur) ; cohérent visuellement avec `WinProbabilityChart` déjà présent dans la même carte ; coût 3D modéré donc risque faible.
- **Cons** : **redondance de haut risque** — la carte contient déjà `ProbabilityBar` + `MiniProbabilityCurve` + `WinProbabilityChart` ; un quatrième graphique peut aggraver exactement le problème n°9 du diagnostic (surcharge d'affichages de proba) ; l'encodage le plus abstrait des trois (il faut lire une courbe pour répondre à « qui gagne ce jeu ») ; le moins « 3D » et le moins spectaculaire ; pire que A pour la décision instantanée.

---

## 7. Recommandation argumentée

### 7.1 Lecture croisée

Les deux objectifs déclarés de l'utilisateur ne sont pas de même nature :

- « décider VITE qui va gagner ce jeu » → c'est une **décision binaire à un pas** → le Modèle A est structurellement optimal (2 options, cibles larges, réponse en < 2 s).
- « anticiper l'évolution des cotes 1xBet selon le prochain point » → c'est une **projection de prix** → le Modèle A le couvre par le delta chiffré, le Modèle C le couvre par la tendance + projection, le Modèle B le couvre par la topographie du leverage.
- « plus parlant, plus 3D, plus visuel » → c'est une **exigence de forme** → seul le Modèle B la satisfait pleinement ; le Modèle A la satisfait partiellement (élévation/ombre, sans scène) ; le Modèle C non.

**Recommandation :** livrer le **Modèle A « La Fourche » en priorité** (socle de décision, 8-10 h, zéro risque perf, excellent en 390 px), et traiter le **Modèle B « Le Relief » comme phase 2 conditionnée à la validation visuelle de l'A** — l'A servant alors de **fallback mobile/faible-perf** du B, ce qui transforme l'investissement 3D en incrémental et non en tout-ou-rien. Le **Modèle C est déconseillé en solution principale** : meilleur sur l'anticipation pure, mais il ajouterait un 4e graphique de probabilité dans une carte qui en a déjà 3, donc il aggraverait la surcharge qu'on cherche à réduire.

En une phrase : **A d'abord pour prouver la clarté, B ensuite pour donner le « wow » 3D demandé, C à écarter sauf demande explicite d'historique de cotes.**

### 7.2 Matrice de décision (note / 5)

| Critère | A — La Fourche | B — Le Relief | C — La Rivière |
|---|---|---|---|
| 1. Décision « qui gagne ce jeu » en < 2 s | **5** | 3 | 3 |
| 2. Anticipation de la cote 1xBet (clarté du delta) | 4 | 4 | **5** |
| 3. Impact visuel / 3D demandée | 3 | **5** | 2 |
| 4. Lisibilité + perf mobile 390 px | **5** | 2 | 4 |
| 5. Effort / risque (5 = le moins cher et le moins risqué) | **5** | 2 | 3 |
| **Total** | **22** | **16** | **17** |

Pondération égale des 5 critères (défaut). Si l'utilisateur prime la **forme** (critère 3 doublé), l'ordre devient A = 25, B = 21, C = 19 → **B passe devant**, ce qui valide la séquençage A → B recommandé.

### 7.3 Risques communs aux 3 modèles

- **Cohérence de palette** : respecter `DESIGN_CHARTER.md` (dark navy + `#00e676`), teintes `emerald/rose/amber` déjà employées par `cellTint` — pas de nouvelle couleur.
- **Accessibilité** : `prefers-reduced-motion` obligatoire sur les trois ; contrastes AA sur les fontes < 12 px (aujourd'hui les 9 px `opacity-55` sont probablement en échec WCAG — à corriger quel que soit le modèle).
- **i18n** : clés `liveMatrix.*` existantes à étendre (nouvelles clés fr/en), pas de texte en dur.
- **Thème** : valider en dark **et** light (le composant actuel gère déjà les deux via `dark:` variants).
- **Synchronisation** : le modèle se recalcule à chaque poll (`clearAllMemos()` en tête de `buildLiveMatrix`) — toute animation doit être **déclenchée par le changement d'état**, jamais par un timer continu, sinon surcharge CPU sur match à plusieurs cartes visibles.

---

## 8. Questions de validation pour l'utilisateur

À cocher / répondre avant toute implémentation :

- [ ] **Périmètre** : le redesign vise-t-il les **deux** points d'appel (`match-card.tsx` et `match-card-broadcast.tsx`) ou d'abord un seul pour validation visuelle ?
- [ ] **Priorité absolue** : décision rapide (Modèle A) **ou** effet 3D/visuel (Modèle B) **ou** historique + projection des cotes (Modèle C) ?
- [ ] **3D réelle vs faux-3D** : confirmez-vous le refus de `three.js` / WebGL (faux-3D CSS recommandé, justification §5) ? Une 3D WebGL « vraie » est-elle une exigence non négociable ?
- [ ] **Budget perf** : combien de cartes match peuvent être visibles simultanément en live (limite actuelle `LIVE_CARD_LIMIT = 6` en football) ? Faut-il une bascule automatique sur le mode léger pour les cartes hors écran (`content-visibility: auto`) ?
- [ ] **Données affichées** : faut-il conserver **les 16 états** (Modèle B/C) ou se limiter aux **2 issues du prochain point** (Modèle A) ? Le détail `P(set)` est-il utile ou du bruit ?
- [ ] **Cote héros** : mettre en avant la **cote juste du modèle** ou la **cote 1xBet payée** (le marché étant ce que l'utilisateur voit dans l'app de paris) ?
- [ ] **Mode trader** : faut-il conserver l'ancienne grille Betfair en **second écran repliable** (onglet « Vue trader ») pour les utilisateurs avertis, ou la supprimer définitivement ?
- [ ] **Redondance** : que faire de `MiniProbabilityCurve` / `WinProbabilityChart` déjà dans la carte — les garder tels quels, ou fusionner avec le nouveau composant pour réduire la charge d'information ?
- [ ] **Séquençage** : validez-vous la livraison A (8-10 h) puis B (16-20 h) en deux lots, ou un seul lot B direct (20 h, risque de refonte si le rendu ne plaît pas) ?
- [ ] **Dégradation** : faut-il un fallback automatique (device faible / `prefers-reduced-motion` / data-saver) vers le Modèle A, ou un réglage utilisateur manuel ?
- [ ] **Libellés** : le titre « Live Matrix » est-il à renommer (ex. « Prochain point », « Évolution des cotes », « Où va la cote ? ») — et dans quelles langues (fr/en) ?

---

## 9. Annexes

### 9.1 Dépendances disponibles (vérifiées dans `package.json`, 2026-09-28)

| Dépendance | Version | Usage dans le projet | Pertinence pour ce redesign |
|---|---|---|---|
| `recharts` | ^2.15.4 | `win-probability-chart.tsx`, `momentum-storyline.tsx`, `stats-radar-chart.tsx`, `match-detail-dialog.tsx` | Modèle C |
| `framer-motion` | ^12.23.2 | `momentum-dr.tsx`, `tennis-player-card.tsx`, `tennis-top10-section.tsx` | Modèles A, B, C |
| `chart.js` + `chartjs-plugin-annotation` | ^4.5.1 / ^3.1.0 | non utilisé côté tennis | à éviter (second moteur) |
| `vaul` | ^1.1.2 | feuilles mobiles | Modèle B (tap-to-reveal) |
| `lucide-react` | ^0.525.0 | partout | les trois |
| Tailwind CSS | ^4 | partout | les trois |
| `three` / WebGL | **absent** | — | refusé (justification §5) |

### 9.2 pseudo-code d'illustration (2-3 lignes max, non exécutable)

Modèle A — encodage de la dominance par la profondeur :

```
carteDominante : transform="translateZ(14px)" boxShadow="0 18px 24px -14px rgba(0,0,0,.6)"
carteRecessive  : transform="translateZ(-6px)" opacity=.85
```

Modèle B — hauteur de tuile = leverage normalisé :

```
--z: clamp(0px, (|odd(i,j) − oddCourant| / maxDelta) * 44px, 44px)
transform: translate3d(x, y, var(--z))
```

### 9.3 Fichiers de référence lus

- `src/components/tennis/live-score-matrix.tsx` (295 lignes)
- `src/lib/prediction/live-matrix.ts` (204 lignes)
- `src/components/tennis/match-card.tsx:512-587` (encadrement)
- `src/components/tennis/match-card-broadcast.tsx:447-544` (encadrement)
- `src/components/tennis/win-probability-chart.tsx:1-60` (conventions Tufte à respecter)
- `package.json` (deps)
