# 🚴 ParisScore Cycling Tab — UI-SPEC.md

> **Design Specification** — v1.0
> Date : 27 juin 2026
> Statut : 📐 Design Review

---

## Table des matières

1. [Scope & Objectifs](#1-scope--objectifs)
2. [Architecture de la page](#2-architecture-de-la-page)
3. [Navigation & Intégration](#3-navigation--intégration)
4. [Design System](#4-design-system)
5. [Composants UI](#5-composants-ui)
6. [Sections de la page](#6-sections-de-la-page)
7. [Marchés de Paris & Bets Prédictifs](#7-marchés-de-paris--bets-prédictifs)
8. [Responsive Breakpoints](#8-responsive-breakpoints)
9. [État Loading / Error / Empty](#9-état-loading--error--empty)
10. [Données Mock — /api/v1/cycling](#10-données-mock--apiv1cycling)
11. [Plan d'implémentation](#11-plan-dimplémentation)

---

## 1. Scope & Objectifs

### 1.1 Objectif

Créer un onglet **Cyclisme** complet dans ParisScore, calqué sur l'architecture F1 existante, qui offre :

- **Stage recap** type cyclingstage.com (profil, description, favoris)
- **Paris prédictifs** type 1xBet (vainqueur, podium, H2H, etc.)
- **Calendrier** des étapes avec navigation
- **Grille riders** avec classements ELO internes
- **Données en temps réel** via SSE

### 1.2 Courses supportées (v1)

| Course | Priorité | Détail |
|--------|----------|--------|
| **Tour de France** | P0 | 21 étapes, juillet |
| **Giro d'Italia** | P1 | 21 étapes, mai |
| **La Vuelta** | P1 | 21 étapes, août-septembre |
| **Monuments** | P2 | Roubaix, LBL, MSR, FW, Lombardia |

### 1.3 Cibles utilisateur

- **Pariseur casual** (70%) : veut voir l'étape du jour et ses 5 bets vite
- **Pariseur expert** (20%) : analyse les grilles riders, ELO, value scores
- **Spectateur** (10%) : regarde les profils d'étape sans parier

---

## 2. Architecture de la page

### 2.1 Patterns exacts à suivre (copiés de F1)

`
┌──────────────────────────────┐
│ showPage('cycling', this)     │ → showPage() switch (pariscore.js L942)
├──────────────────────────────┤
│ cleanup                       │ → stopCyclingPage() (SSE + timers)
├──────────────────────────────┤
│ initCyclingPage()             │ → appel API + render
├──────────────────────────────┤
│ _fetchAndRenderCycling()      │ → fetch /api/v1/cycling + hydrate
├──────────────────────────────┤
│ _renderCyclingHTML(data)      │ → construit le DOM complet
├──────────────────────────────┤
│ renderCycling                │ → Alias global pour les templates inline
└──────────────────────────────┘
`

### 2.2 API Routes

| Route | Méthode | Cache | SSE |
|-------|---------|-------|-----|
| /api/v1/cycling | GET | 300s | ✅ via stream |
| /api/v1/cycling/races | GET | 3600s | ❌ |
| /api/v1/cycling/riders | GET | 600s | ❌ |
| /api/v1/cycling/live | GET | — | ✅ EventSource |

### 2.3 Flow de données

`
cycling-service.js (Python scraping)
        ↓ AGREGATION + ELO CALC
server.js route : GET /api/v1/cycling
        ↓ JSON 300s cache
pariscore.js → _fetchAndRenderCycling()
        ↓ DOM
#page-cycling
`

---

## 3. Navigation & Intégration

### 3.1 Desktop Nav (pariscore.html ~L12409)

**Emplacement** : après F1 (L12409), avant worldcup (L12410)

`html
<a href=\"javascript:void(0)\" onclick=\"showPage('cycling',this);return false;\"
   data-page=\"cycling\" aria-label=\"Cyclisme\" data-i18n=\"nav.cycling\">
  🚴 CYCLISME
</a>
`

### 3.2 Mobile Bottom Nav (pariscore.html)

**Emplacement** : après F1 dans le bottom-nav

`html
<a onclick=\"return bnGo('cycling',this)\" data-page=\"cycling\" data-i18n=\"bnav.cycling\">
  <span class=\"bnav-icon\">🚴</span>
  <span class=\"bnav-label\" data-i18n=\"bnav.cycling\">Cyclisme</span>
</a>
`

### 3.3 showPage switch (pariscore.js L942)

`javascript
try { if (pageId !== 'cycling' && typeof stopCyclingPage === 'function') stopCyclingPage(); } catch(e) {}
if (pageId === 'cycling') try { initCyclingPage(); } catch(e) {}
`

### 3.4 showPage titles (pariscore.js ~L977)

`javascript
'cycling': 'Cyclisme - Tour de France & Paris Prédictifs',
`

### 3.5 page-container (pariscore.html)

`html
<div id=\"page-cycling\" class=\"page\" style=\"display:none;\">
  <!-- will be rendered by JS -->
</div>
`

---

## 4. Design System

### 4.1 Palette de couleurs

`css
--cycling-bg:          #0a1a0f;  /* vert forêt profond */
--cycling-bg-card:     #0f2416;  /* vert carte */
--cycling-bg-hover:    #132e1a;  /* vert hover */
--cycling-border:      #1a3a24;  /* vert émeraude */
--cycling-accent:      #FFD700;  /* maillot jaune ⭐ */
--cycling-accent-gold: linear-gradient(135deg, #FFD700, #FFA500);
--cycling-accent-red:  #FF6347;  /* flamme rouge / caravane */
--cycling-accent-green:#00E676;  /* maillot vert */
--cycling-accent-blue: #448AFF;  /* bleu informatif */
--cycling-accent-white:#FFFFFF;  /* maillot blanc */
--cycling-polkadot:    #FF1744;  /* maillot à pois */
--cycling-text:        #F5F5F5;
--cycling-text-secondary: #A0B0A8;
--cycling-text-muted:  #557A5E;
--cycling-danger:      #FF1744;
--cycling-success:     #00E676;
`

### 4.2 Typographie

`css
--font-heading: 'Inter', 'Montserrat', sans-serif;
--font-body:   'Inter', -apple-system, sans-serif;
--font-mono:   'JetBrains Mono', 'Fira Code', monospace;

/* Titres */
--text-h1:     700 1.75rem var(--font-heading);
--text-h2:     600 1.35rem var(--font-heading);
--text-h3:     600 1.10rem var(--font-heading);

/* Corps */
--text-body:   400 0.95rem var(--font-body);
--text-small:  400 0.85rem var(--font-body);
--text-muted:  300 0.78rem var(--font-body);

/* Data */
--text-mono:   500 0.88rem var(--font-mono);
--text-mono-lg:600 1.10rem var(--font-mono);
`

### 4.3 Espacement

`css
--space-xs:  4px;
--space-sm:  8px;
--space-md:  16px;
--space-lg:  24px;
--space-xl:  32px;
--space-2xl: 48px;
`

### 4.4 Bordure & Ombre

`css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 20px;
--shadow-card: 0 2px 12px rgba(0,0,0,0.3);
--shadow-glow: 0 0 20px rgba(255,215,0,0.15);
`

---

## 5. Composants UI

### 5.1 HeroCard (Stage Spotlight)

`css
.cycling-hero-card {
  background: linear-gradient(135deg, #0f2416, #132e1a);
  border: 1px solid var(--cycling-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}
`

**Contenu** :
- 🟢 Badge LIVE si la course est en cours
- En-tête : Nom de l'étape, date, km, type (Montagne/Plat/CLM)
- Profil d'altitude SVG inline
- Description de l'étape (2-3 lignes)
- ⭐ Favoris tier-list
- 🎯 5 Predictive Bets

### 5.2 FavoritePill

`
*** Favorite (⭐⭐⭐) = vert + jaune, bold
** Contender (⭐⭐)  = vert, normal
* Outsider (⭐)      = muted, small
🔍 Dark horse       = gris, italic
`

### 5.3 BetCard

`css
.cycling-bet-card {
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--cycling-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  transition: all 0.2s;
  cursor: pointer;
}
.cycling-bet-card:hover {
  border-color: var(--cycling-accent);
  background: rgba(255,215,0,0.05);
}
.cycling-value-high   { color: var(--cycling-accent); }     /* ★★★★+ */
.cycling-value-medium { color: var(--cycling-accent-green); } /* ★★-★★★ */
.cycling-value-low    { color: var(--cycling-text-muted); }  /* ★ */
`

### 5.4 StageTable

`css
.cycling-stage-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 4px;
}
.cycling-stage-row {
  background: var(--cycling-bg-card);
  border-radius: var(--radius-sm);
  transition: background 0.15s;
  cursor: pointer;
}
.cycling-stage-row:hover {
  background: var(--cycling-bg-hover);
}
`

### 5.5 RiderGrid

`css
.cycling-rider-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--cycling-bg-card);
  border-radius: var(--radius-md);
}
`

### 5.6 SectionTitle

`css
.cycling-section-title {
  font: var(--text-h2);
  color: var(--cycling-accent);
  border-bottom: 2px solid var(--cycling-border);
  padding-bottom: var(--space-sm);
  margin-bottom: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
`

---

## 6. Sections de la page

### 6.1 Structure complète (top → bottom)

`
┌─ #page-cycling ─────────────────────────────────────┐
│                                                       │
│  [SECTION 1] Sub-navigation (TDF │ Giro │ Vuelta)    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 🚴 TOUR DE FRANCE 2026  │ 🇮🇹 GIRO 2026 │ 🇪🇸 VUELTA 2026 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [SECTION 2] Hero — Étape du Jour (cycling-hero)     │
│  ┌─────────────────────────────────────────────────┐ │
│  │ STAGE 1: Barcelona - Barcelona                   │ │
│  │ 4 July • 19.6 km • TTT • +280m                  │ │
│  │ 🟢 LIVE (départ dans 2h)                         │ │
│  │                                                  │ │
│  │ [PROFIL D'ALTITUDE — SVG INLINE]                │ │
│  │                                                  │ │
│  │ « Le Grand Départ 2026 s'élance de Barcelone    │ │
│  │   avec un contre-la-montre par équipes... »      │ │
│  │                                                  │ │
│  │ ⭐ FAVORIS                                       │ │
│  │  *** UAE Emirates (Pogacar)                      │ │
│  │  ** Visma | Lease a Bike (Vingegaard)            │ │
│  │  * Red Bull-BORA (Evenepoel)                     │ │
│  │  🔍 EF Education (Carapaz)                       │ │
│  │                                                  │ │
│  │ ┌─── PRÉDICTIONS PARISSCORE ──────────────────┐  │ │
│  │ │ 🏆 Vainqueur  │ Poga 2.10 │ ★★★★ VALUE ⭐  │  │ │
│  │ │ ⚡ Podium     │ Even 1.45 │ ★★★ VALUE      │  │ │
│  │ │ 🥊 H2H        │ Vinge >   │ ★★★★★ VALUE ⭐  │  │ │
│  │ │               │ Roglic    │                 │  │ │
│  │ │              │ 1.80      │                 │  │ │
│  │ │ 🎯 Surprise  │ Arensman  │ ★★ VALUE        │  │ │
│  │ │              │ 9.00      │                 │  │ │
│  │ │ 📊 Top 10    │ Carapaz   │ ★★★★★ VALUE ⭐  │  │ │
│  │ │              │ 1.25      │                 │  │ │
│  │ └────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [SECTION 3] Stage Calendar (cycling-stage-table)    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 📅 CALENDRIER DES ÉTAPES                         │ │
│  │                                                  │ │
│  │ Étape 1  Jul 4  Barcelona TTT      19.6km  ⏱    │ │
│  │ Étape 2  Jul 5  Tarragone→BCN Coll 168km  🏔️    │ │
│  │ Étape 3  Jul 6  ...                ...     ...   │ │
│  │ ...                                              │ │
│  │ Étape 21 Jul 26 Thoiry→Paris  Plat 133km  🏁    │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [SECTION 4] Value Bets (across remaining stages)    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 💰 VALUE BETS — Meilleures cotes du Tour         │ │
│  │                                                  │ │
│  │ CG: Pogacar (1.72) ★★★★                         │ │
│  │ Vert: Philipsen (2.50) ★★★                      │ │
│  │ Montagne: Carapaz (4.00) ★★★★                   │ │
│  │ Blanc: Ayuso (3.00) ★★★                         │ │
│  │ Équipes: UAE (2.10) ★★★★                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [SECTION 5] Rider Grid (cycling-rider-grid)         │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 🏆 GRILLE DES COUREURS                           │ │
│  │                                                  │ │
│  │ ⭐ 1. Pogacar    UAE     ELO 1850  W/kg 7.2    │ │
│  │ ⭐ 2. Vingegaard Visma   ELO 1820  W/kg 7.0    │ │
│  │ ⭐ 3. Evenepoel  RB-BORA ELO 1790  W/kg 6.9    │ │
│  │ ...                                              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [SECTION 6] Live Updates (cycling-live)             │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 🔴 SUIVI LIVE (SSE activé)                       │ │
│  │  > km 45 : Échappée de 3 coureurs (Ganna, ...)  │ │
│  │  > km 52 : Écart 2'45\" avec le peloton         │ │
│  │  > km 78 : Début du Col de la Madeleine...      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
└─────────────────────────────────────────────────────┘
`

### 6.2 Mobile Layout

`
┌─── #page-cycling (mobile) ──────────────────┐
│                                              │
│  🚴 CYCLISME  [TDF ▼]                       │
├──────────────────────────────────────────────┤
│  ┌── STAGE SPOTLIGHT ───────────────────┐   │
│  │ Stage 1 · 19.6km TTT                 │   │
│  │ Barcelona - Barcelona                │   │
│  │ +280m 🕒 départ 14:30                │   │
│  │ [Profile SVG]                        │   │
│  │ *** UAE ● ● Visma ● RB-BORA         │   │
│  │ ⭐ 5 BETS ⭐                         │   │
│  │ Poga 2.10 ★★★★ │ Ev 1.45 ★★★       │   │
│  │ Vinge>Rog 1.80★★★│ Arensman 9★     │   │
│  │ Carapaz 1.25 ★★★★★                  │   │
│  └────────────────────────────────────┘   │
│                                           │
│  ┌── STAGE TABLE ──────────────────────┐  │
│  │ #1 TTT 19.6km · Jul 4              │  │
│  │ #2 Coll 168km · Jul 5              │  │
│  │ #3 ...                             │  │
│  │ #21 Plat 133km · Jul 26            │  │
│  └────────────────────────────────────┘  │
│                                           │
│  ┌── RIDERS ───────────────────────────┐ │
│  │ Pogacar UAE   ELO 1850 ★★★★        │ │
│  │ Vingegaard Vis ELO 1820 ★★★★       │ │
│  │ ...                                 │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
`

---

## 7. Marchés de Paris & Bets Prédictifs

### 7.1 Les 5 Bets fixes par étape

| # | Icône | Nom | Produit | Type de cote | Value seuil |
|---|-------|-----|---------|-------------|-------------|
| 1 | 🏆 | **Stage Winner** | P(victoire) × cote | Fractionnelle → Décimale | > 1.0 |
| 2 | ⚡ | **Podium Top 3** | P(Top 3) × cote | Décimale | > 1.2 |
| 3 | 🥊 | **H2H Duel** | P(Rider A > Rider B) × cote | Décimale | > 1.1 |
| 4 | 🎯 | **Surprise / Anti-favori** | P(!1st_fav) × cote | Décimale | > 1.5 |
| 5 | 📊 | **Top 10** | P(Top 10) × cote | Décimale | > 1.0 |

### 7.2 Affichage Value Score

`
★★★★★ = Value exceptionnelle (> 2.0)
★★★★  = Très bonne value (1.5-2.0)
★★★   = Bonne value (1.2-1.5)
★★    = Value modérée (1.0-1.2)
★     = Value faible / neutre
`

### 7.3 Marchés additionnels (hors 5 bets fixes)

Ces marchés sont affichés dans la section **Value Bets** (section 4) :

| Marché | Visibilité |
|--------|-----------|
| Vainqueur Classement Général | Section Value Bets + Hero |
| Maillot Vert (Points) | Value Bets |
| Maillot à Pois (Montagne) | Value Bets |
| Maillot Blanc (Jeune) | Value Bets |
| Classement par Équipes | Value Bets |
| Podium CG (Top 3 final) | Value Bets |
| Victoire d'étape par équipe | Value Bets |
| Top 5 d'étape | Value Bets (si cote intéressante) |

---

## 8. Responsive Breakpoints

| Breakpoint | Largeur | Comportement |
|------------|---------|-------------|
| **Mobile** | < 480px | Stack vertical, boutons plein largeur, grille 1 col |
| **Mobile+** | 481-768px | 2 colonnes pour bets, tableau scroll horizontal |
| **Tablet** | 769-1024px | Hero + bets en grille 3-2, riders 2 col |
| **Desktop** | 1025-1440px | Layout complet, grille 4 col pour riders |
| **Wide** | > 1440px | Max-width 1400px centré, espacement augmenté |

### 8.1 Mobile spécifique

`css
@media (max-width: 768px) {
  .cycling-hero-card { padding: var(--space-md); }
  .cycling-hero-header { flex-direction: column; }
  .cycling-bets-grid { grid-template-columns: 1fr; }
  .cycling-rider-grid { grid-template-columns: 1fr; }
  .cycling-stage-table { display: block; overflow-x: auto; white-space: nowrap; }
}
`

---

## 9. État Loading / Error / Empty

### 9.1 Loading

`html
<div id=\"page-cycling\">
  <div class=\"cycling-loading\">
    <div class=\"cycling-spinner\"></div>
    <p>Chargement du Tour de France 2026...</p>
  </div>
</div>
`

`css
.cycling-spinner {
  width: 40px; height: 40px;
  border: 3px solid var(--cycling-border);
  border-top-color: var(--cycling-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
`

### 9.2 Error

`html
<div class=\"cycling-error\">
  <span class=\"cycling-error-icon\">⚠️</span>
  <p>Impossible de charger les données cyclisme.</p>
  <button onclick=\"initCyclingPage()\">Réessayer</button>
</div>
`

### 9.3 Empty (hors saison)

`html
<div class=\"cycling-empty\">
  <span class=\"cycling-empty-icon\">🚴</span>
  <h3>Aucune course en cours</h3>
  <p>Le Tour de France 2026 débutera le 4 juillet.</p>
  <p>Prochaine course : Paris-Roubaix (12 avril 2026)</p>
</div>
`

---

## 10. Données Mock — /api/v1/cycling

### 10.1 Structure JSON response

`json
{
  "race": {
    "name": "Tour de France 2026",
    "status": "upcoming",
    "current_stage": 0,
    "total_stages": 21,
    "start_date": "2026-07-04",
    "end_date": "2026-07-26"
  },
  "stage": {
    "number": 1,
    "date": "2026-07-04",
    "departure": "Barcelona",
    "arrival": "Barcelona",
    "km": 19.6,
    "type": "TTT",
    "elevation_gain": 280,
    "description_fr": "Le Grand Départ 2026 s'élance de Barcelone...",
    "profile_svg": "<svg>...</svg>",
    "is_live": false,
    "favorites": {
      "top": [
        {"rider": "Tadej Pogacar", "team": "UAE Emirates", "tier": 3, "odds": 2.10},
        {"rider": "Jonas Vingegaard", "team": "Visma | Lease a Bike", "tier": 2, "odds": 3.50}
      ],
      "contenders": [
        {"rider": "Remco Evenepoel", "team": "Red Bull-BORA", "tier": 1, "odds": 5.00}
      ],
      "outsiders": [
        {"rider": "Thymen Arensman", "team": "INEOS Grenadiers", "tier": 0, "odds": 9.00}
      ],
      "dark_horses": [
        {"rider": "Richard Carapaz", "team": "EF Education", "tier": -1, "odds": 15.00}
      ]
    },
    "predictions": [
      {"id": "stage_winner", "label": "🏆 Vainqueur d'étape", "rider": "Tadej Pogacar", "odds": 2.10, "value_score": 4, "value_label": "★★★★ VALUE"},
      {"id": "podium", "label": "⚡ Podium", "rider": "Remco Evenepoel", "odds": 1.45, "value_score": 3, "value_label": "★★★"},
      {"id": "h2h", "label": "🥊 H2H", "rider_a": "Jonas Vingegaard", "rider_b": "Primož Roglič", "odds": 1.80, "value_score": 5, "value_label": "★★★★★ VALUE ⭐"},
      {"id": "surprise", "label": "🎯 Surprise", "rider": "Thymen Arensman", "odds": 9.00, "value_score": 2, "value_label": "★★"},
      {"id": "top10", "label": "📊 Top 10", "rider": "Richard Carapaz", "odds": 1.25, "value_score": 5, "value_label": "★★★★★ VALUE ⭐"}
    ]
  },
  "stages": [
    {"number": 1, "date": "2026-07-04", "departure": "Barcelona", "arrival": "Barcelona", "km": 19.6, "type": "TTT", "elevation": 280},
    {"number": 2, "date": "2026-07-05", "departure": "Tarragona", "arrival": "Barcelona", "km": 168.3, "type": "Hills", "elevation": 2100},
    {"number": 3, "date": "2026-07-06", "departure": "Vilanova i la Geltrú", "arrival": "Lleida", "km": 195.0, "type": "Flat", "elevation": 950}
  ],
  "riders": [
    {"rank": 1, "name": "Tadej Pogacar", "team": "UAE Emirates", "uci_points": 6250, "elo": 1850, "wkg": 7.2, "specialty": "GC", "win_prob_p1": 45},
    {"rank": 2, "name": "Jonas Vingegaard", "team": "Visma | Lease a Bike", "uci_points": 5800, "elo": 1820, "wkg": 7.0, "specialty": "GC", "win_prob_p1": 30}
  ],
  "value_bets": [
    {"market": "CG Winner", "label": "🏆 Classement Général", "rider": "Tadej Pogacar", "odds": 1.72, "value_score": 4},
    {"market": "Points Jersey", "label": "🟢 Maillot Vert", "rider": "Jasper Philipsen", "odds": 2.50, "value_score": 3},
    {"market": "Mountains Jersey", "label": "🔴 Maillot à Pois", "rider": "Richard Carapaz", "odds": 4.00, "value_score": 4},
    {"market": "Young Jersey", "label": "⚪ Maillot Blanc", "rider": "Juan Ayuso", "odds": 3.00, "value_score": 3},
    {"market": "Team GC", "label": "🏢 Classement Équipes", "rider": "UAE Emirates", "odds": 2.10, "value_score": 4}
  ],
  "live_updates": [
    {"km": 45, "text": "Échappée de 3 coureurs", "rider": "Filippo Ganna"},
    {"km": 52, "text": "Écart: 2'45\"", "gap": "2:45"},
    {"km": 78, "text": "Début Col de la Madeleine", "col": "Col de la Madeleine"}
  ]
}
`

---

## 11. Plan d'implémentation

### Phase 1 — UI-SPEC (ce document) ✅
- [x] Recherche marchés 1xBet
- [x] Analyse cyclingstage.com
- [x] Définition palette / design system
- [x] Architecture et composants
- [x] Wireframe complet

### Phase 2 — Backend data (cycling-service.js)
- [ ] Créer cycling-service.js (miroir de 1-service.js)
- [ ] Implémenter les routes API dans server.js
- [ ] Scraper ProCyclingStats / FirstCycling
- [ ] Calcul ELO cyclisme + probas

### Phase 3 — Frontend (pariscore.html + pariscore.js)
- [ ] Ajouter #page-cycling container
- [ ] Ajouter nav desktop (L12410)
- [ ] Ajouter bottom mobile nav
- [ ] Implémenter showPage('cycling') + switch
- [ ] initCyclingPage() + _fetchAndRenderCycling()
- [ ] Template HTML inline
- [ ] CSS scoped dans #page-cycling

### Phase 4 — Tests & Deploy
- [ ] Tester serveur dev (node server.js)
- [ ] Vérifier navigation desktop + mobile
- [ ] Vérifier responsive mobile
- [ ] Déployer VPS

---

## Annexes

### A. Variables i18n à ajouter

`javascript
// pariscore.js
'nav.cycling':    'Cyclisme',
'bnav.cycling':   'Cyclisme',
'cycling.title':  'Cyclisme - Tour de France & Paris Prédictifs',
'cycling.stage':  'Étape',
'cycling.live':   'EN DIRECT',
'cycling.bets':   'Paris Prédictifs',
'cycling.calendar':'Calendrier',
'cycling.riders': 'Grille des Coureurs',
'cycling.value':  'Value Bets',
'cycling.loading':'Chargement du Tour de France 2026...',
'cycling.empty':  'Aucune course en cours',
'cycling.retry':  'Réessayer',
`

### B. Emoji stack pour les maillots

`javascript
// ParisScore code pariscore.js
var CYC_JERSEYS = {
  yellow: { emoji: '🟡', name: 'Maillot Jaune', color: '#FFD700' },
  green:  { emoji: '🟢', name: 'Maillot Vert',  color: '#00E676' },
  polka:  { emoji: '🔴', name: 'Maillot à Pois',color: '#FF1744' },
  white:  { emoji: '⚪', name: 'Maillot Blanc',  color: '#FFFFFF' }
};
`

### C. Couleurs des équipes (pour badges)

`javascript
var CYC_TEAM_COLORS = {
  'UAE Emirates':         '#CC0000',
  'Visma | Lease a Bike': '#FFD700',
  'Red Bull-BORA':        '#0033FF',
  'INEOS Grenadiers':     '#000080',
  'EF Education':         '#FF6600',
  'Soudal Quick-Step':    '#00AA00',
  'Lidl-Trek':            '#FF0000',
  'Decathlon AG2R':       '#00AAFF',
  'Groupama-FDJ':         '#FFFFFF',
  'Movistar':             '#0055CC',
  'Jayco-AlUla':          '#333333',
  'DSM-Firmenich':        '#000000',
  'Alpecin-Deceuninck':   '#CC0000',
  'Intermarché-Wanty':    '#FFCC00',
  'Cofidis':              '#FF0000',
  'Astana':               '#0033FF',
  'Arkéa-B&B Hotels':     '#FF0000',
  'Israel-Premier Tech':  '#0000FF',
  'Bahrain Victorious':   '#FF6600',
  'TotalEnergies':        '#CC0000'
};
`

---

*Document generated by gstack-ui-ux designer — 27 juin 2026*
