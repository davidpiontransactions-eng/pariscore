# 🚴 PariScore Cycling Tab — Brainstorming Design Session

> **Session multi-persona** — 27 juin 2026
> Objectif : Concevoir l'onglet cyclisme ultime pour les parieurs, avec focus Tour de France et courses à étapes.

---

## 👥 Participants

| Persona | Expert | Rôle dans la session |
|---------|--------|---------------------|
| **🎨 Webdesigner** | UI/UX senior | Proposer la hiérarchie visuelle, l'expérience mobile, le design system dark |
| **🔧 Ingénieur réseau** | Data pipeline & perf | Garantir le temps réel, la fiabilité des données, l'architecture SSE |
| **🧪 Data Scientist** | Modèles prédictifs | Définir les algorithmes ELO, probas win/podium, value bets |
| **💰 Expert Paris Sportifs** | Connait 1xBet, Unibet, PMU | Lister tous les marchés pertinents, les formats de cotes |
| **🚴 Expert Cyclisme** | Ancien coureur / journaliste | Valider les datas, les favoris, les typologies d'étapes |

---

## 📊 1. Marchés de paris cyclisme (analyse 1xBet + concurrents)

### Marchés PRE-RACE (avant le départ de l'étape)

| # | Marché | Type | Description | Présent sur 1xBet |
|---|--------|------|-------------|:---:|
| 1 | **Vainqueur d'étape** | Simple | Vainqueur de l'étape du jour | ✅ |
| 2 | **Vainqueur chance double** | Combiné | Deux coureurs — si l'un des deux gagne, pari gagnant | ✅ |
| 3 | **Classement Général** | Outright | Vainqueur final du Tour | ✅ |
| 4 | **Podium (Top 3)** | Top-X | Coureur termine dans le top 3 du CG | ✅ |
| 5 | **Top 5 / Top 10** | Top-X | Coureur termine dans le top X de l'étape | ✅ |
| 6 | **Face-à-face (H2H)** | Duel | Qui termine devant l'autre sur l'étape / CG | ✅ |
| 7 | **Groupe** | Matchup | Vainqueur parmi un groupe de 3-5 coureurs | ✅ |
| 8 | **Maillot Vert (Points)** | Classification | Vainqueur du classement par points | ✅ |
| 9 | **Maillot à Pois (Montagne)** | Classification | Vainqueur du classement de la montagne | ✅ |
| 10 | **Maillot Blanc (Jeune)** | Classification | Meilleur moins de 26 ans | ✅ |
| 11 | **Classement par équipes** | Classification | Meilleure équipe au temps cumulé | ✅ |
| 12 | **Nationalité vainqueur** | Spécial | Nationalité du coureur qui gagne l'étape/Tour | ✅ |
| 13 | **Équipe gagne au moins 1 étape** | Spécial | Pari binaire sur l'équipe | ✅ |
| 14 | **Tout autre participant que X** | Spécial | Vainqueur sauf X (anti-favori) | ✅ |
| 15 | **Record de l'étape** | Spécial | Temps record battu ou non | 1xBet |
| 16 | **Vainqueur de chaque secteur** | Live | Gagnant de secteur intermédiaire | 1xBet |

### Marchés LIVE (pendant l'étape)

| # | Marché | Description |
|---|---------|-------------|
| 1 | **Vainqueur en direct** | Cotes qui évoluent avec le déroulement |
| 2 | **Prochain coureur à attaquer** | Qui va tenter une échappée |
| 3 | **Écart au sommet du col** | Différence en secondes en haut du col |
| 4 | **Gagnant du sprint intermédiaire** | Qui passe le checkpoint en tête |
| 5 | **H2H en direct** | Face-à-face dynamique entre 2 coureurs |
| 6 | **Évolution du maillot jaune** | Changement de leader virtuel |

**Sources de cotes à intégrer** : 1xBet, Unibet, Betclic, Winamax, PMU

---

## 🧪 2. Modèle de données — prédictions cyclisme (Data Scientist)

### Algorithme value bet — version adaptée du modèle F1

`
ELO_CYCLING = f(poids, spécialité, forme récente, historique col/plat/CLM)
              x coefficient parachute (fatigue L30)
              x terrain matchup (montagne > 2000m, sprint massif, baroudeurs)
              x forces équipières (UAE vs Visma vs INEOS vs Red Bull)
`

### 5 paris prédictifs PAR ÉTAPE

Pour chaque étape, ParisScore génère 5 bets avec cote estimée et proba :

| # | Bet | Produit | Explication |
|---|-----|---------|-------------|
| 1 | **🏆 Vainqueur d'étape** | P(victoire) × cote | Notre favori avec la meilleure value |
| 2 | **⚡ Podium** | P(Top 3) × cote | Moins risqué, meilleure proba |
| 3 | **🥊 Face-à-face** | P(A > B) × cote | Duel entre 2 leaders |
| 4 | **🎯 Anti-favori** | P(gagnant != 1er_favori) × cote | Prono outsider |
| 5 | **📊 Top 10** | P(Top 10) × cote | Sécurisé, pour les bankrolls prudentes |

### Indicateurs calculés par ParisScore

- **ELO** par terrain (montagne, contre-la-montre, sprint, collines, plat)
- **W/kg estimé** via corrélation VAM × résultats cols
- **VAM** (Vitesse Ascensionnelle Moyenne) sur chaque col
- **Fatigue L30** : jours dans les jambes depuis le début du Tour
- **Team Support Index** : nombre d'équipiers encore en course
- **Proximité Pogacar/Evenepoel/Vingegaard** : écart au GC

---

## 🎨 3. Design System — ParisScore Cycling (Webdesigner)

### Palette de couleurs

`
Fond principal : #0a1a0f   (vert forêt profond)
Fond carte     : #0f2416   (vert plus clair)
Bordure        : #1a3a24   (vert émeraude foncé)
Accent principal : #FFD700 (jaune maillot)
Accent secondaire: #FF6347 (rouge caravane / flamme rouge)
Accent tertiaire : #00E676 (vert fluo — points)
Texte principal  : #F5F5F5 (blanc cassé)
Texte secondaire : #A0B0A8 (gris vert)
Texte muted      : #557A5E (vert grisé)
Danger           : #FF1744 (rouge)
Succès           : #00E676 (vert)
Info             : #448AFF (bleu)
Jaune maillot    : #FFD700 #ffcc00
Rouge maillot    : #FF1744
Vert maillot     : #00E676
Blanc maillot    : #FFFFFF
Polka dots       : #FF1744 #FFFFFF (motif pois)
`

### Typographie

| Usage | Police | Poids | Taille |
|-------|--------|-------|--------|
| Titres h1-h2 | Inter / Montserrat | 700-800 | 1.5-2.5rem |
| Sous-titres | Inter SemiBold | 600 | 1.1rem |
| Corps | Inter | 400 | 0.95rem |
| Stats / data | JetBrains Mono | 400-700 | 0.85rem |
| Muted / labels | Inter | 300 | 0.75rem |

### Layout général

`
┌──────────────────────────────────────────────────────┐
│ 🚴 CYCLISME  [TDF 2026 ▼]  [Giro ▼]  [Vuelta ▼]   │
├──────────────────────────────────────────────────────┤
│ ┌───────── CARD: ÉTAPE DU JOUR ───────────────────┐ │
│ │ Étape 1 • 4 juillet • Barcelone > Barcelone     │ │
│ │ ⏱ 19.6 km  📐 TTT  🏔️ D+ 280m  🟡 Maillot     │ │
│ │ [Carte] [Profil] [Dénivelé]                      │ │
│ │ Description: CLM par équipes avec arrivée       │ │
│ │ au sommet de Montjuïc...                         │ │
│ │                                                  │ │
│ │ ⭐ FAVORIS DE L'ÉTAPE                            │ │
│ │ *** UAE Emirates (Pogacar)                       │ │
│ │ ** Visma | Lease a Bike (Vingegaard)             │ │
│ │ * Red Bull-BORA (Evenepoel), INEOS (Arensman)    │ │
│ │  🔍 Outsider: EF Education (Carapaz)             │ │
│ │                                                  │ │
│ │ ┌─ BETS ─────────────────────────────────────┐   │ │
│ │ │ 🏆 Vainqueur: Pogacar (2.10) ★★★ VALUE    │   │ │
│ │ │ ⚡ Podium: Evenepoel (1.45) ★★              │   │ │
│ │ │ 🥊 H2H: Vingegaard > Roglic (1.80) ★★★★   │   │ │
│ │ │ 🎯 Anti-favori: Arensman (9.00) ★★         │   │ │
│ │ │ 📊 Top10: Carapaz (1.25) ★★★★★              │   │ │
│ │ └────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌───────── TABLEAU DES ÉTAPES ────────────────────┐ │
│ │ #  Date  Parcours           km  Type  Favoris📊 │ │
│ │ 1  4/7   Barcelone-Barcelone 19.6 TTT  ⏱       │ │
│ │ 2  5/7   Tarragone-Barcelone 168. Collines 🏔️  │ │
│ │ ...                                             │ │
│ │ 21 26/7  Thoiry-Paris       133. Plat  🏁      │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌───────── GRILLE DES COUREURS ──────────────────┐ │
│ │ ⭐ Pogacar   UAE    ELO 1850  W/kg 7.2  P1 45%│ │
│ │ ⭐ Vingegaard Visma  ELO 1820  W/kg 7.0  P1 30%│ │
│ │ ...                                             │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
`

### Animations et micro-interactions

| Élément | Animation | Justification |
|---------|-----------|---------------|
| Changement d'étape | Slide horizontal fluide | Navigation naturelle sur mobile |
| Carte/profil | Zoom au hover + popup | Exploration détaillée sans rechargement |
| Cotes des bets | Pulse vert sur valeur positive | Feedback immédiat pour le parieur |
| Tableau des étapes | Sticky header + scroll horizontal | 21 étapes tiennent sur mobile |
| Alertes live | Badge clignotant | Départ réel / sprint / col |
| Transitions page | Fade 200ms | Cohérence avec le reste de ParisScore |

---

## 🔧 4. Architecture technique (Ingénieur réseau & Data)

### Flux de données

`
        ┌──────────────┐
        │ ProCyclingStats│
        │ (Python │
        │ scraping + API) │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ cycling-     │
        │ service.js   │
        │ (Node.js)    │
        └──────┬───────┘
               │ GET /api/v1/cycling
        ┌──────▼───────┐
        │ server.js    │
        │ (Express)    │
        └──────┬───────┘
               │ SSE stream ────► pariscore.html
               │ REST JSON ────► pariscore.js
`

### Points d'API

| Route | Méthode | Cache | Description |
|-------|---------|-------|-------------|
| /api/v1/cycling | GET | 300s | Données complètes + prédictions |
| /api/v1/cycling/races | GET | 3600s | Calendrier des courses |
| /api/v1/cycling/race?name=X | GET | 300s | Détail d'une course spécifique |
| /api/v1/cycling/riders | GET | 600s | Grille riders avec ELO |
| /api/v1/cycling/live | SSE | — | Mise à jour temps réel |

### Polling & cache

| Ressource | Intervalle | Stratégie |
|-----------|-----------|-----------|
| Étape du jour + favoris | 300s (5 min) | Serveur cache Redis |
| Grille riders + ELO | 600s (10 min) | Cache mémoire Node |
| Tableau des étapes | 3600s (1h) | Cache longue durée |
| Cotes bets | 120s (2 min) | Proxy bookmakers |

---

## 📱 5. Parcours utilisateur type (UX flow)

### Scénario : Un parieur veut jouer l'étape du jour

1. **Arrivée sur ParisScore**
2. **Navigation** : Clique sur "CYCLISME" dans le nav
3. **Page d'accueil cyclisme** : voit directement l'étape du jour en hero card
4. **Scrolling** : lit la description, le profil, les favoris
5. **Analyse** : regarde les 5 bets prédictifs avec value score
6. **Décision** : clique sur "🏆 Vainqueur: Pogacar (2.10)"
7. **Action** : la bet s'ajoute à son carnet de paris (ou lien externe vers bookmaker)
8. **Suivi** : regarde le tableau des 21 étapes pour planifier ses prochains paris
9. **Live** : active le suivi SSE pour les mises à jour en direct

### Mobile (scénario probable 70% des utilisateurs)

1. Bottom nav → 🚴 CYCLISME
2. Swipe horizontal entre les sections (stage → tableau → riders)
3. Tap table row → expand inline avec favoris + bets
4. Pull-to-refresh pour recalculer les cotes
5. Share button → partager une bet en image

---

## 🏁 6. Structure des fichiers de données (par étape)

Chaque étape aura son fichier .md (ex: stage-1-tdf-2026.md) contenant :

`yaml
---
stage: 1
date: 2026-07-04
route: "Barcelona - Barcelona"
km: 19.6
type: "TTT"
elevation_gain: 280
---
`

Avec les sections :
- **📍 Parcours détaillé** (description, points clés, timing)
- **⭐ Favoris** (***, **, *)
- **🎯 5 Paris Prédictifs** (avec cotes estimées, probas, value score)
- **📊 Analyse Data** (météo, historique, blessures)
- **🔄 H2H Comparateur** (tableau duel riders)

---

## ✅ Décisions de design finales

| Décision | Option choisie | Raison |
|----------|---------------|--------|
| Palette | Vert forêt + or (TDF) | Premium, immersive, correspond au cyclisme |
| Layout | Hero card → Tableau → Grille riders | Flow naturel « étape du jour → futur → global » |
| 5 bets fixes | Oui, toujours 5 | Habitude utilisateur, lisibilité, comparaison |
| Valeur ★★★★★ | Oui, affichée | Gamification, confiance, quick scan |
| Profil altitude | SVG inline | Pas de dépendance externe |
| Live SSE | Oui | Temps réel sans polling lourd |
| Mobile first | Oui | 70% du trafic estimé |
| Dark mode only | Oui (ParisScore) | Cohérence avec le reste de l'app |

---

## 🔜 Prochaines étapes

1. Rédaction du **UI-SPEC.md** complet
2. Création des **21 fichiers d'étapes** (stage-1 à stage-21)
3. Implémentation HTML/CSS dans pariscore.html
4. Backend cycling-service.js + routes server.js
5. Frontend JS pariscore.js (showPage + init + render)
6. Tests avec le serveur dev
7. Déploiement VPS

---

*Document généré par la session brainstorming multi-persona — 27 juin 2026*
