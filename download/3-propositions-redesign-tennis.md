# SetPoint Tennis Prematch — 3 propositions d'amélioration

> Audit critique + 3 directions de refonte, chacune pilotée par une expertise (UI/UX, Data Science, Parieur Pro)
> Base : design SetPoint v10 actuel (cf. captures v9-final.png)
> Date : 2026-07-06

---

## 0. Diagnostic partagé (synthèse de l'audit VLM)

Le design SetPoint actuel est **utilitaire mais pas premium**. Voici les 6 problèmes identifiés qui serviront de base aux 3 propositions :

| # | Problème | Impact | Expert concerné |
|---|---|---|---|
| 1 | **Densité excessive** — 6 chips stats par carte + 3 CTA + header = surcharge cognitive | Lecture lente | UI/UX |
| 2 | **Hiérarchie rigide** — tout a le même poids visuel, manque de respiration | Œil ne sait pas où aller | UI/UX |
| 3 | **Style générique** — palette terne (gris/vert pâle), typographie sans caractère | Pas mémorable, pas premium | UI/UX |
| 4 | **Probabilité sans contexte** — "79%" affiché sans décomposition visible | Manque de crédibilité | Data Science |
| 5 | **Pas de value bet priorisé** — tous les matchs ont le même traitement | Décision difficile | Parieur Pro |
| 6 | **Aucune personnalisation** — pas de "matchs pour vous", pas de alertes visuelles | Expérience froide | Parieur Pro |

---

## Proposition 1 — « Editorial Sport Magazine »

### Pilote : UI/UX Designer + Graphiste

### Concept
Inspirer SetPoint du **The Athletic** et **ESPN+ match stories** : transformer la page d'accueil en **magazine sportif éditorial** plutôt qu'en dashboard froid. Le contenu raconte une histoire, pas juste des chiffres.

### Inspirations web
- The Athletic (mise en page éditoriale, grandes photos, typographie serif)
- ESPN+ match previews (hero card + story-driven)
- Apple News (sections, curateurs, "Pour vous")

### Changements clés

#### 1.1 Hero card éditoriale (above-the-fold)
Au lieu d'une grille de 3 cartes égales, la première carte devient un **hero** pleine largeur :
- Photo du favori en grand format (background, gradient overlay)
- Titre éditorial : "Sabalenka vs Osaka — Le choc de Wimbledon"
- Sous-titre : "La n°1 mondiale face au retour de la reine"
- Probabilité en overlay (gros chiffre, style magazine)
- Badge "MATCH DU JOUR" si value bet détecté

#### 1.2 Typographie éditoriale
- **Titres** : `Playfair Display` ou `Fraunces` (serif moderne, contraste avec le sans-serif)
- **Body** : `Inter` (déjà en place, garder)
- **Chiffres** : `JetBrains Mono` (déjà en place, garder)
- Hiérarchie : H1 32px serif → H2 22px sans → body 14px → meta 11px

#### 1.3 Palette enrichie par surface
Au lieu du gris tern, introduire une **couleur de surface** subtile dans chaque carte :
- **Gazon** → accent vert émeraude `#10B981`
- **Terre battue** → accent ocre `#D97706`
- **Dur** → accent bleu acier `#0EA5E9`
- La couleur apparaît sur le border-top de la carte + le ring du joueur favori

#### 1.4 Densité réduite — progressif disclosure
- **Vue par défaut** : carte avec photo + noms + proba + 1 seule stat clé (edge value bet)
- **Hover/tap** : expansion en accordéon révélant les 5 autres stats
- **Clic "Analyse"** : dialog complet (déjà existant)

#### 1.5 Sections éditoriales
Sous la grille de matchs, ajouter des sections magazine :
- **"À la une"** — 1 match mis en avant (hero card)
- **"Value bets du jour"** — 3 matchs avec edge ≥ 3pp, badge vert
- **"Tous les matchs"** — grille standard
- **"Analyses approfondies"** — liens vers les dialogs détaillés déjà ouverts

### Maquette ASCII

```
┌─────────────────────────────────────────────────────────────────┐
│  ╔═════════════════════════════════════════════════════════╗   │
│  ║  [Photo Sabalenka en background, gradient sombre]        ║   │
│  ║                                                          ║   │
│  ║  MATCH DU JOUR · Wimbledon                               ║   │
│  ║                                                          ║   │
│  ║  Sabalenka vs Osaka                                      ║   │
│  ║  Le choc de Wimbledon                                    ║   │
│  ║                                                          ║   │
│  ║  ┌──────────┐  ┌──────────┐                              ║   │
│  ║  │ 79%      │  │ 21%      │   Value bet: +5pp @ PMU     ║   │
│  ║  │ Sabalenka│  │ Osaka    │                              ║   │
│  ║  └──────────┘  └──────────┘                              ║   │
│  ╚═════════════════════════════════════════════════════════╝   │
│                                                                 │
│  💎 VALUE BETS DU JOUR                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Alcaraz 77% │ │ Sinner 68%  │ │ Rublev 71%  │               │
│  │ edge +4pp   │ │ edge +3pp   │ │ edge +5pp   │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
│  📅 TOUS LES MATCHS                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ (cartes simples, hover = expand)            │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### Pros / Cons

| Pros | Cons |
|---|---|
| Premium, mémorable, se distingue des concurrents | Demande du contenu éditorial (titres, sous-titres) |
| Story-driven → engagement + temps sur page | Plus lourd à maintenir (rédaction) |
| Hiérarchie claire (hero > value bets > tous) | Peut sembler trop "magazine" pour power users |
| Typographie serif = signal de qualité | Risque de surcharger le hero |

---

## Proposition 2 — « Quant Edge Terminal »

### Pilote : Data Scientist

### Concept
Inspirer SetPoint de **Bloomberg Terminal** et **FiveThirtyEight** : transformer la page en **terminal de trading quant** pour parieurs sérieux. La donnée est reine, la crédibilité est totale, tout est traçable et décomposable.

### Inspirations web
- Bloomberg Terminal (densité maîtrisée, codes couleur, sparklines)
- FiveThirtyEight (forecasts, IC visualisés, modèles transparents)
- QuantConnect (backtests, métriques de confiance)

### Changements clés

#### 2.1 Sparkline Elo (inline dans chaque carte)
Au lieu d'un ring de proba statique, ajouter une **sparkline** 30 jours de l'Elo du joueur, inline à côté de son nom :
- Ligne verte si Elo ↑, rouge si ↓
- Permet de voir la **tendance** en 1 coup d'œil, pas juste l'instantané

#### 2.2 Décomposition de probabilité (toujours visible)
Sous chaque probabilité "79%", afficher une **barre empilée horizontale** montrant la décomposition du modèle :
```
79% ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━
     [Elo 62%]  [Forme 12%]  [H2H 5%]              [21%]
```
L'utilisateur voit **d'où vient la proba** sans ouvrir le dialog.

#### 2.3 IC 95% visualisé inline
Au lieu d'un chip "IC 95% [72, 85]", afficher un **mini-intervalle** directement sur la barre de proba :
```
79% ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━╸━━━━━━
                                       ├─── IC 95% ───┤
                                       72%            85%
```
Le point = médiane, la barre = IC. Lecture immédiate de l'incertitude.

#### 2.4 Confidence score coloré
Le chip "Confiance 0.68" devient un **dial radial** (mini-jauge 20×20px) avec couleur :
- Vert ≥ 0.75 (haute confiance)
- Ambre 0.60-0.75 (modérée)
- Rouge < 0.60 (faible, à prendre avec précaution)

#### 2.5 Backtest badge
Sur chaque carte, un mini-badge "Model accuracy: 84% (last 100)" — la précision historique du modèle sur ce type de match (surface + écart Elo). Crédibilise la prédiction.

#### 2.6 Mode "Power user" (toggle)
Un toggle dans le header "Terminal mode" qui :
- Active toutes les visualisations avancées (sparklines, décompositions, IC)
- Désactive les photos (économise espace)
- Densité maximale pour analystes

### Maquette ASCII

```
┌─────────────────────────────────────────────────────────────────┐
│  [Terminal mode ON]                              [Power user]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ WIMBLEDON · 8èmes · Gazon                  ● Confiance  │   │
│  │                                                         │   │
│  │ Sabalenka #1  ━━━━━━━↗ 2052              ┌────────────┐ │   │
│  │               (sparkline 30j Elo ↑)      │     79%    │ │   │
│  │                                          │  ━━━━━●━━━ │ │   │
│  │ vs                                       │  72%   85% │ │   │
│  │                                          └────────────┘ │   │
│  │ Osaka #14     ━━━━━↘ 1759                               │   │
│  │               (sparkline 30j Elo ↓)                     │   │
│  │                                                         │   │
│  │ Décomposition: ▓▓▓▓▓▓▓▓▓▓▓ Elo ▓▓▓ Forme ▓ H2H         │   │
│  │ Model accuracy: 84% (last 100) · IC 95% [72, 85]       │   │
│  │                                                         │   │
│  │ [Détail]  [Analyse]  [Parier @ PMU 1.15 (+5pp value)]  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Pros / Cons

| Pros | Cons |
|---|---|
| Crédibilité maximale — tout est traçable | Densité élevée (même si maîtrisée) |
| Power users adorent — décision plus rapide | Peut intimider les débutants |
| IC + décomposition = transparence totale | Demande du backend (backtest accuracy) |
| Sparklines = tendance, pas juste instantané | Plus complexe à coder |

---

## Proposition 3 — « Bet Action Hub »

### Pilote : Parieur Pro

### Concept
Inspirer SetPoint de **DraftKings** et **BetBull** : transformer la page en **hub d'action** centré sur la décision de pari. Tout est optimisé pour répondre à la question "est-ce que je parie sur ce match, et si oui, où ?"

### Inspirations web
- DraftKings (mise en avant des bets, slip de pari, value bets)
- BetBull (social betting, copy bets)
- Pinnacle (value betting, sharp lines)

### Changements clés

#### 3.1 Tri par value bet (default)
L'ordre par défaut des cartes n'est plus chronologique mais par **edge décroissant** :
- Match avec +5pp edge en premier (value bet)
- Match avec +3pp edge ensuite
- Match sans value bet en dernier
- Badge "VALUE" vert sur les cartes concernées

#### 3.2 Best odds always visible
Au lieu de cacher les cotes dans un dialog, afficher **directement sur la carte** :
- Meilleure cote pour le favori (avec bookmaker)
- Bouton "Parier @ 1.15 PMU" cliquable (rouge si pas de value, vert si value)
- Mini-comparateur (3 bookmakers max) en hover

#### 3.3 Bet slip flottant (sticky)
Un **bet slip** en bas à droite (style DraftKings) qui se remplit quand on clique "Parier" :
- Liste des paris sélectionnés
- Mise totale + gain potentiel
- Bouton "Placer les N paris" → ouvre le BetDialog pour chaque
- Persistance entre navigations (localStorage)

#### 3.4 Value bet scanner badge (toujours visible)
Le scanner actuel est une cloche discrète. Le rendre **plus proéminent** :
- Un bandeau en haut de la page si value bet détecté : "💎 3 value bets détectés — voir maintenant"
- Couleur ambre qui pulse si edge ≥ 5pp
- Clic → filtre automatique sur "Value bets"

#### 3.5 Quick bet (1 clic)
Pour les power users, un mode "quick bet" :
- Clic sur la proba d'un joueur = ajoute au bet slip avec mise par défaut (10€)
- Pas de dialog intermédiaire
- Toggle "Quick bet" dans le header

#### 3.6 Forme récente visualisée (pastilles)
Au lieu du chip "5V-1D", afficher les **6 dernières pastilles** directement sur la carte :
```
Sabalenka  ●●●●●○  (5 victoires, 1 défaite récente)
Osaka      ○●●○●●  (3V-3D, irrégulière)
```
Lecture immédiate de la forme, pas besoin d'ouvrir le dialog.

### Maquette ASCII

```
┌─────────────────────────────────────────────────────────────────┐
│  💎 3 VALUE BETS DÉTECTÉS — VOIR MAINTENANT        [×]          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💎 VALUE +5pp · Wimbledon · Gazon                       │   │
│  │                                                         │   │
│  │ ●●●●●○ Sabalenka #1            ┌──────────────────────┐ │   │
│  │ ○●●○●● Osaka #14               │  79%                 │ │   │
│  │                                │  Best @ PMU 1.15     │ │   │
│  │                                │  [Parier +5pp value] │ │   │
│  │                                └──────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💎 VALUE +4pp · Wimbledon                               │   │
│  │ ●●●●●● Alcaraz #2              [77% @ Bwin 1.40]        │   │
│  │ ●○●●○● Rublev #8               [Parier +4pp value]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │ 🎫 BET SLIP (2)                             │  ← floating  │
│  │ ─────────────────────────────────────────── │   bottom-    │
│  │ Sabalenka @ 1.15 · 10€ → 11.50€            │   right      │
│  │ Alcaraz  @ 1.40 · 10€ → 14.00€             │              │
│  │ ─────────────────────────────────────────── │              │
│  │ Total: 20€ → Gain potentiel: 25.50€        │              │
│  │           [Placer les 2 paris]              │              │
│  └─────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Pros / Cons

| Pros | Cons |
|---|---|
| Action-oriented — conversion maximale | Moins "magazine", plus "betting" |
| Value bets priorisés — décision rapide | Bet slip complexe à coder |
| Forme visualisée = lecture 1s | Peut sembler trop chargé si beaucoup de matchs |
| Quick bet = friction réduite | Risque de paris impulsifs (à équilibrer avec RGPD) |

---

## Tableau comparatif

| Critère | P1 — Editorial Magazine | P2 — Quant Terminal | P3 — Bet Action Hub |
|---|---|---|---|
| **Cible primaire** | Grand public, fans de tennis | Power users, analystes | Parieurs actifs |
| **Style** | The Athletic / ESPN+ | Bloomberg / FiveThirtyEight | DraftKings / BetBull |
| **Densité** | Faible (progressive disclosure) | Élevée (mais maîtrisée) | Moyenne (action-focused) |
| **Crédibilité data** | Moyenne (story > data) | Maximale (IC + décomposition + backtest) | Moyenne (value bet > détail) |
| **Conversion pari** | Faible (lecture passive) | Moyenne (décision éclairée) | Maximale (bet slip + quick bet) |
| **Complexité code** | Moyenne (hero + sections) | Élevée (sparklines + backtest backend) | Élevée (bet slip + quick bet) |
| **Différenciation** | Forte (peu de sites sportifs éditoriaux) | Forte (peu de sites betting quant) | Moyenne (DraftKings-like) |
| **Maintenance contenu** | Élevée (titres éditoriaux) | Faible (auto-généré) | Faible (auto-généré) |

---

## Recommandation initiale (non contraignante)

> **🎯 Ma recommandation : Proposition 2 — « Quant Edge Terminal »**

**Pourquoi** :
1. SetPoint a déjà un **moteur de prédiction réel** (Elo + forme + H2H + bootstrap IC) — le thème "quant" valorise cet investissement
2. La **transparence** (IC + décomposition + backtest) est un différentiateur fort vs DraftKings/ESPN+ qui sont des boîtes noires
3. Le **mode "Power user" toggle** permet de servir à la fois les débutants (simple) et les pros (dense)
4. Sparklines + IC inline = **plus d'info dans le même espace** sans surcharge

**Mais** :
- Si votre objectif est l'**acquisition grand public** → **Proposition 1** (editorial)
- Si votre objectif est la **conversion pari maximale** → **Proposition 3** (bet hub)

---

## Prochaines étapes

1. **Choisissez une proposition** (ou demandez une fusion, ex. "P2 + bet slip de P3")
2. Je produis un **prototype HTML/CSS standalone** cliquable avec les 3 matchs Sabalenka/Osaka
3. Validation visuelle → implémentation dans le composant `MatchCard` existant
4. Tests A/B vs design actuel (PostHog déjà en place)

---

## Annexes — sources d'inspiration vérifiées

- The Athletic : https://theathletic.com (mise en page éditoriale sport)
- ESPN+ match previews : https://www.espn.com/espnplus/
- Bloomberg Terminal UI : https://www.bloomberg.com/professional/
- FiveThirtyEight forecasts : https://fivethirtyeight.com/
- DraftKings : https://www.draftkings.com/
- BetBull (social betting) : https://www.betbull.com/
- Pinnacle (value betting) : https://www.pinnacle.com/
