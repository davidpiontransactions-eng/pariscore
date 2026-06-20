# RAPPORT DESIGN FINAL — Pariscore v3

## Dashboard Métriques Top 10 ATP — Desktop + Mobile

---

**Version :** 3.0 (Charte Pariscore + Avis 5 experts utilisateurs intégrés)
**Date :** 17 Juin 2026
**Équipe :** UI/UX Expert + Senior Frontend Developer + 5 profils utilisateurs experts

---

## 0. Résumé des Changements (vs v2)

Le brainstorming avec 5 profils d'utilisateurs experts (score moyen: 5/10) a identifié 10 améliorations critiques.
Cette v3 intègre les 3 changements bloquants à faire AVANT de coder :

| # | Changement | Demande | Priorité |
|---|------------|---------|----------|
| **1** | **Hiérarchie visuelle des métriques** | Top 3 en XXL, reste en second plan | 🔴 CRITIQUE |
| **2** | **Mode Tracker live** | Vue épurée proba + cote uniquement | 🔴 CRITIQUE |
| **3** | **Refonte mobile** | Bottom nav, touch targets, gestes natifs | 🔴 CRITIQUE |
| **4** | **Cote Pinnacle + flow 24h** | Comparaison marché vs estimée | 🟠 HAUTE |
| **5** | **Percentiles + moyenne Top 10** | Contexte immédiat des métriques | 🟠 HAUTE |
| **6** | **Sparkline 6 mois** | Évolution temporelle par métrique | 🟠 HAUTE |
| **7** | **Métriques cliquables** | Drawer détail EWMA par match | 🟠 HAUTE |
| **8** | **Swing Alert** | Notification visuelle retournement | 🟡 MOYENNE |
| **9** | **Design tokens documentés** | Système spacing + typo + couleurs | 🟡 MOYENNE |
| **10** | **H2H revisité** | Timeline visuelle, moins de colonnes | 🟡 MOYENNE |

---

## 1. Charte Graphique Pariscore (Design Tokens)

### 1.1 Palette de Couleurs

`
:root {
  /* FONDS & SURFACES (60%) */
  --color-bg-primary:     #0b0e17;  /* Bleu nuit profond */
  --color-bg-secondary:   #0e121e;  /* Nuance légère */
  --color-card:           #131722;  /* Surface cards */
  --color-card-hover:     #161c2a;  /* Hover cards */
  --color-odds-box:       #0b0e17;  /* Creux cotes */

  /* TEXTES & FRONTIÈRES (30%) */
  --color-text-primary:   #ffffff;
  --color-text-secondary: #94a3b8;
  --color-text-tertiary:  #707e94;
  --color-border:         rgba(255,255,255,0.05);
  --color-border-medium:  rgba(255,255,255,0.08);

  /* ACCENTS & SIGNAUX (10%) */
  --color-accent-green:   #00e676;  /* Action, EV+, positif */
  --color-accent-blue:    #0077ff;  /* Sélection, focus */
  --color-live:           #ff6d2e;  /* LIVE (moins agressif) */
  --color-danger:         #ff1744;  /* Alerte négatif */

  /* GLOWS */
  --glow-blue:  0 4px 12px rgba(0,119,255,0.3);
  --glow-green: 0 4px 12px rgba(0,230,118,0.3);

  /* BADGES CATÉGORIE */
  --cat-service:  #38bdf8;
  --cat-return:   #10b981;
  --cat-mental:   #ff6d2e;
  --cat-global:   #94a3b8;
}
`

### 1.2 Typographie

`
:root {
  --font-display: 'Poppins', sans-serif;  /* Titres, noms, KPI */
  --font-body:    'Inter', sans-serif;     /* Corps, labels, data */

  --text-kpi:        800 32px var(--font-display);
  --text-player:     700 20px var(--font-display);
  --text-odds:       700 18px var(--font-body);
  --text-metric:     700 16px var(--font-body);
  --text-title:      700 14px var(--font-body);
  --text-label:      500 13px var(--font-body);
  --text-meta:       400 12px var(--font-body);
  --text-context:    400 11px var(--font-body);
}
`

### 1.3 Espacement & Coins

`
:root {
  --space-xs:  4px;   --space-sm:  8px;
  --space-md:  16px;  --space-lg:  24px;
  --space-xl:  32px;  --space-2xl: 48px;
  --radius-card: 8px; --radius-btn: 6px; --radius-badge: 4px;
  --padding-card: 20px;
}
`

### 1.4 États Interactifs

| État | Style |
|------|-------|
| Normal | Fond #131722, bordure rgba(255,255,255,0.05) |
| Hover | Fond #161c2a, glow bleu si sélectionnable |
| Active | Fond #0077ff, texte blanc, glow |
| Value | Fond #00e676, texte blanc, glow vert |
| LIVE | Badge #ff6d2e, animation pulse lente |
| Swing Alert | Fond clignotant #ff1744 300ms |
| Disabled | Opacité 0.4, pas de hover |

---

## 2. Hiérarchie Visuelle des Métriques (Changement Critique #1)

### 2.1 Principe

Toutes les métriques ne se valent pas. Le Top 3 doit être visuellement dominant.

`
Niveau XXL (visibilité immédiate, 3 max) :
  SRV_PTS_WON_S, RET_PTS_WON_S, PRESSURE_INDEX
  → Poppins 800 32px, #ffffff, barre large, sparkline 6 mois intégrée

Niveau M (détaillable sur clic) :
  H2H_SURFACE, ELO_SURFACE, ATP_POINTS_6M
  → Inter 700 16px, card normale, clic = drawer

Niveau S (accordéon) :
  AGE.30, BP_CONV, BP_SAVED, WINNING_DERIV
  → Inter 400 12px, caché par défaut sous ▼
`

### 2.2 Badges de Catégorie

| Catégorie | Couleur | Métriques |
|-----------|---------|-----------|
| 🟦 Service    | #38bdf8 | SRV_PTS_WON_S, BP_SAVED |
| 🟩 Retour     | #10b981 | RET_PTS_WON_S, BP_CONV |
| 🟧 Mental     | #ff6d2e | PRESSURE_INDEX, WINNING_DERIV |
| ⬜ Global     | #94a3b8 | ELO_SURFACE, ATP_POINTS, AGE.30, H2H |

---

## 3. Mode Tracker Live (Changement Critique #2)

### 3.1 Le Problème

L'écran live actuel est trop chargé : 11 éléments visuels. En live, l'utilisateur n'a pas le temps de lire.

### 3.2 Solution : Deux Modes

Toggle en haut : [📊 COMPLET] — [🎯 TRACKER]

**MODE TRACKER** (par défaut, 4 éléments max) :
- Score + set + temps
- Barre de probabilité pleine largeur
- Cote Pinnacle + Value + Recommandation
- 3 métriques compactes (SRV, RET, MOM)

**MODE COMPLET** : tout afficher pour analystes

### 3.3 Swing Alert

Quand PRESSURE_INDEX ou MOMENTUM dépasse un seuil :
- Fond clignotant rgba(255,17,68,0.15) pendant 300ms
- Texte #ff1744 : "SWING DÉTECTÉ"
- Barre proba vibre (CSS shake)
- Notification push optionnelle

---

## 4. Refonte Mobile (Changement Critique #3)

### 4.1 Bottom Navigation

Tab Bar 4 items : [🎾 Matchs] [🔴 Live] [📊 Stats] [👤 Moi]
Fond: #0b0e17 | border-top: 1px solid rgba(255,255,255,0.05)
Hauteur: 64px | Touch targets: 48x48pt (Apple HIG)
Item actif: icône #0077ff + dot indicateur blanc

### 4.2 Écran Pré-Match Mobile

Layout vertical, top 3 métriques seulement, scroll horizontal pour les autres.

`
MATCH CARD (pleine largeur)
  DJOKOVIC   72.4% ▲   Cote: 1.72
  ALCARAZ    27.6% ▼   Cote: 4.50
  🟢 VALUE +8.2%        ROI: +10.3%

TOP 3 MÉTRIQUES (scroll horizontal)
  [🟦 SRV 72.4% ▲ +4%]  [🟩 RET 38.2% ▼ -2%]  [🟧 PRESS 1.24x ▲ +26%]

COMPARAISON RAPIDE
  SERVICE ████████████████░ 72% vs 68%
  RETOUR  ░░░░█████████████ 38% vs 42%

⭐ Voir l'analyse complète → bottom sheet
`

### 4.3 Touch Targets Minimum

| Élément | Taille mini mobile |
|---------|-------------------|
| Cotes (boutons) | 56px height |
| Cards match | Touchable, pas texte |
| Icônes tab bar | 48x48dp |
| Badges métriques | 44x44pt |
| Bouton Voir plus | 48px height |

### 4.4 Gestes Natifs

| Geste | Action |
|-------|--------|
| Swipe gauche/droite | Naviguer entre matchs |
| Pull-to-refresh | Rafraîchir live |
| Tap cote | Ajouter au panier |
| Long press métrique | Tooltip contexte |
| Swipe back | Revenir écran précédent |

---

## 5. Écran A — Pré-Match Desktop (Final)

### 5.1 Layout 3 Colonnes

`
┌─── 300px ───────┬──────────── 860px ───────────┬─── 760px ───────┐
│                │                               │                  │
│ FILTRES        │ MATCH CARD                    │ H2H TIMELINE     │
│ SURFACE        │ DJOKOVIC 72.4%  1.72         │ 5 ANS            │
│ PÉRIODE        │ ALCARAZ  27.6%  4.50         │ ●──○──○──●──●    │
│                │ ⚡ VALUE +8.2%               │                  │
│ MATCHS DU JOUR │                               │ SURFACE          │
│ 3 cards        │ TOP 3 MÉTRIQUES (XXL)         │ Dur: 8-3 Djoko   │
│                │ [SRV ▲] [RET ▼] [PRESS ▲]     │ Terre: 2-3       │
│ KPI COMPACTS   │ + sparkline 6 mois + badge    │                  │
│ Paris: 1234    │                               │ ANALYSE CROISÉE  │
│ ROI: +8.2%     │ TOP 4-8 MÉTRIQUES (M)         │ Quand J1 gagne:  │
│                │ [H2H] [ELO] [BP] cliquables   │ SRV=72% vs 65%   │
│                │                               │                  │
│                │ ▼ Toutes les métriques (...)   │                  │
│                │                               │                  │
│                │ RECOMMANDATION                │                  │
│                │ 💰 DJOKOVIC  👍 89%           │                  │
│                │ Cote marché: 1.85/Est: 1.72   │                  │
│                │ ═══ VALUE +8.2% ═══          │                  │
`

### 5.2 Drawer Détail Métrique (sur clic)

S'ouvre sur le côté quand on clique sur une métrique :

`
DRAWER — SRV_PTS_WON_S (Évolution EWMA par match)
  Match    | Gagné? | SRV_PTS | %   | EWMA
  ---------|--------|---------|-----|-------
  AO R1    |   ✅   | 32/40   | 80% | 74.2% ▲
  AO R2    |   ✅   | 28/38   | 74% | 73.8% —
  AO R3    |   ❌   | 25/38   | 66% | 71.2% ▼
  AO R4    |   ✅   | 30/40   | 75% | 72.4% ▲
`

---

## 6. Écran B — Live Desktop (Final)

### 6.1 Mode Tracker (par défaut)

`
┌────────────────── 60% ─────────────────┬────── 40% ──────────┐
│                                         │                    │
│  █████████████████████████░░░░░░ 68%    │ STATS COMPACT      │
│                                         │ SRV: 68% ▼        │
│  Cote: 1.85 | Pinnacle: 1.92 | Est: 1.72│ RET: 42% ▲        │
│              ⚡ VALUE: +8.2%              │ MOM: -0.18 ▼      │
│                                         │ PRESSURE: 1.24x   │
│  💰 Recommandation: DJOKOVIC            │                    │
│                                         │ SWING ALERT        │
│  SRV ⬆ 72% | RET ⬆ 34% | MOM -0.18    │ 🔴 Alcaraz prend  │
│                                         │ le momentum        │
│                                         │ 72% → 43%         │
`

---

## 7. Écran C — H2H Desktop (Final Revisité)

`
┌────────────────── 65% ─────────────────┬────── 35% ───────────┐
│                                         │                    │
│  H2H: DJOKOVIC vs ALCARAZ | 10 - 7      │ FILTRES            │
│  ⚡ Avantage Djokovic sur dur           │ SURFACE + ANNÉE   │
│                                         │                    │
│  TIMELINE VISUELLE                      │ SCORE PAR SURFACE  │
│  ●○○●○ → J1 gagne les 2 derniers        │ Dur:   8-3 Djoko  │
│  2022  ●──○──○──●──●                   │ Terre: 2-3 Alcaraz│
│  2023  ○──●──●──○──○                   │ Gazon: 0-1 Alcaraz│
│  2024  ●──○──●──●──○                   │                    │
│  2025  ●──●──○──○                      │ ANALYSE CROISÉE    │
│  2026  ●──○────────                    │ Quand J1 gagne :   │
│  ●=Alcaraz  ○=Djokovic                  │ SRV: 72% RET:38%  │
│                                         │                    │
│  TOP 3 DERNIERS MATCHS                  │ EXPORT CSV         │
│  2026 AO QF: Djoko 6-4 7-6 3-6 6-3     │ 📥 Données H2H    │
│  SRV:74% RET:38% BP:3/7 ACE:12 👁 Voir │                    │
│  2025 WB: Alcaraz 7-5 6-4 5-7 6-3      │                    │
`

---

## 8. Wireframes Mobile Complets

### 8.4 Gestes Mobile

| Geste | Action |
|-------|--------|
| Swipe gauche/droite | Naviguer entre les matchs du jour |
| Pull-to-refresh | Rafraichir les donnees live |
| Tap cote | Ajouter au panier (one-tap bet slip) |
| Long press metrique | Afficher tooltip contexte (percentile, tendance) |
| Swipe back | Revenir a l ecran precedent |

---

## 9. Specifications Techniques

### 9.1 Design Tokens CSS Complets

`css
:root {
  /* Couleurs */
  --color-bg-primary: #0b0e17;
  --color-bg-secondary: #0e121e;
  --color-card: #131722;
  --color-card-hover: #161c2a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #94a3b8;
  --color-text-tertiary: #707e94;
  --color-accent-green: #00e676;
  --color-accent-blue: #0077ff;
  --color-live: #ff6d2e;
  --color-danger: #ff1744;
  --color-cat-service: #38bdf8;
  --color-cat-return: #10b981;
  --color-cat-mental: #ff6d2e;
  --color-cat-global: #94a3b8;
  --color-border: rgba(255,255,255,0.05);

  /* Typographie */
  --font-display: 'Poppins', sans-serif;
  --font-body: 'Inter', sans-serif;
  --text-kpi: 800 32px var(--font-display);
  --text-player: 700 20px var(--font-display);
  --text-odds: 700 18px var(--font-body);
  --text-metric: 700 16px var(--font-body);
  --text-title: 700 14px var(--font-body);
  --text-label: 500 13px var(--font-body);
  --text-meta: 400 12px var(--font-body);

  /* Espacement */
  --space-xs: 4px; --space-sm: 8px; --space-md: 16px;
  --space-lg: 24px; --space-xl: 32px; --space-2xl: 48px;

  /* Coins */
  --radius-card: 8px; --radius-btn: 6px; --radius-badge: 4px;
  --padding-card: 20px;

  /* Glows */
  --glow-blue: 0 4px 12px rgba(0,119,255,0.3);
  --glow-green: 0 4px 12px rgba(0,230,118,0.3);
}
`

### 9.2 Composants et Bibliotheques

| Composant | Type | Bibliotheque | Format API |
|-----------|------|-------------|------------|
| MetricCardXXL | Card + sparkline | D3 sparkline + React | metric, value, percentile, sparkline_data, badge, trend |
| MetricCardM | Card cliquable | React | metric, value, badge, onClick |
| MetricCardS | Mini accordeon | React | metric, value |
| TrackerMode | Vue live epuree | React + Recharts | prob, odds, value_pct, recommendation |
| SwingAlert | Alerte animee | React | player, from_proba, to_proba |
| H2HTimeline | Timeline visuelle | D3.js | matches: date, winner, surface, score |
| OddsFlow | Graphique cote 24h | Recharts sparkline | odds_history, market, estimated |
| PercentileBadge | Badge contexte | React | value, percentile, top10_avg |

### 9.3 Nouveaux Types API

`	ypescript
interface MetricWithContext {
  metric: string;
  value: number;
  ewma_short: number;
  ewma_long: number;
  percentile: number;
  top10_average: number;
  sparkline_6m: number[];
  trend: 'up' | 'down' | 'stable';
  badge: 'service' | 'return' | 'mental' | 'global';
}

interface OddsWithMarket {
  estimated: number;
  market: number;
  market_source: string;
  flow_24h: number[];
  liquidity: 'low' | 'medium' | 'high';
  value_pct: number;
  is_value: boolean;
}

interface SwingAlert {
  player: string;
  description: string;
  proba_from: number;
  proba_to: number;
  strength: 'low' | 'medium' | 'high';
  timestamp: string;
  metrics_trigger: string[];
}
`

### 9.4 Accessibilite WCAG AA

| Regle | Statut |
|-------|--------|
| Contraste #fff sur #0b0e17 | 15.3:1 (AAA) |
| Contraste #94a3b8 sur #0b0e17 | 6.2:1 (AA) |
| Touch targets mobile | 48x48pt minimum |
| Roles ARIA | metricCard: region, swingAlert: alert, proba: progressbar |
| Navigation clavier | Tab, Enter, Escape, ArrowLeft/Right |
| Reduced motion | prefers-reduced-motion: reduce desactive animations |

### 9.5 Planification Sprints

| Sprint | Contenu | Story Points |
|--------|---------|-------------|
| Sprint 0 | Design tokens, hierarchie visuelle, layout mobile | 8 SP |
| Sprint 1 | MatchCard, MetricCardXXL/M/S, PercentileBadge, OddsFlow, drawer detail | 40 SP |
| Sprint 2 | TrackerMode, SwingAlert, H2HTimeline, live complet, notifications push | 38 SP |
| Sprint 3 | Bottom nav, gestes natifs, widget, cash-out simulator, exports CSV | 24 SP |
| **Total** | | **110 SP** |

---

## 10. Ce qui est Valide (Ne PAS toucher)

| Element | Valide par | Note |
|---------|-----------|------|
| Charte graphique (dark, bleu nuit, vert #00e676) | 5/5 profils | 8/10 |
| H2H contextuel (surface + poids temporel) | Analyste + Parieur + Designer | Killer feature |
| EWMA pour SRV/RET_PTS_WON | Analyste + Parieur | Valide scientifiquement |
| Puce VALUE (cote estimee vs marche) | Parieur + Tracker + Bettor | A garder |
| Badge LIVE qui pulse (#ff6d2e) | Designer + Tracker | Bon usage animation |
| Cards border-radius 8/6/4 | Designer | Coherent |
| Typographie Inter / Poppins | Designer + Parieur | Bon choix |
| Sparkline 6 mois par metrique | Analyste Data | Contexte temporel |
| Mode Tracker (deux vues) | Tracker + Parieur | Critique pour adoption |

---

*Rapport Design Final v3.0 — Pariscore*
*Charte Graphique : designui.jpg / design ui pariscore.md*
*Integre les retours de 5 profils d utilisateurs experts : Parieur Pro, Analyste Data, Tracker Live, Bettor Mobile, Designer UI*
*Score estime apres corrections v3 : 7.5/10*
*17 Juin 2026*
