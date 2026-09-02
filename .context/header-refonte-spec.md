# Cahier des Charges — Refonte Header PariScore

**Date** : 2026-09-02
**Objectif** : Refonte complète de la barre du haut pour une UX professionnelle, inspirée des meilleures plateformes sportives (Sofascore, FlashScore, Bet365, TradingView)

---

## 1. Analyse Concurrentielle (Synthèse)

### Patterns universels (10/10 plateformes)

| Pattern | Fréquence | Raison |
|---------|-----------|--------|
| Logo gauche, actions droite | 10/10 | Scan oculaire en Z |
| Onglets sport horizontaux | 9/10 | Switch sport le plus rapide |
| Header sticky | 9/10 | Navigation accessible pendant scroll |
| Barre nav mobile (bottom) | 8/10 | Ergonomie pouce |
| Barre de recherche | 10/10 | Affordance universelle |
| Thème sombre par défaut | 7/10 | Moins de fatigue oculaire |

### Patterns spécifiques betting

| Pattern | Plateformes | Valeur |
|---------|-------------|--------|
| Coupon/ticket toujours visible | Bet365, 1xBet, OddsPortal | Réduit friction pari |
| Indicateur live pulsant | Bet365, Sofascore, FlashScore | Crée urgence |
| Toggle format cotes | OddsPortal, 1xBet | Decimal/Fractional/American |
| Affichage solde en header | Bet365, 1xBet | conscience fonds |
| Toggle densité | FlashScore seul | Power users vs casual |

### Conclusion analyse

PariScore se positionne entre **FlashScore** (data-dense, dark mode) et **Sofascore** (UX clean, progressive disclosure). L'header actuel souffre de **12 éléments interactifs** dans une seule rangée, causant overflow et confusion cognitive.

---

## 2. Problèmes de l'Header Actuel

| Problème | Impact | Fréquence |
|----------|--------|-----------|
| **12 boutons dans le header** | Overflow flex-wrap, lignes multiples | Permanent |
| **Push + Email toggles** | Usage rare (1× après inscription) | Occasionnel |
| **Bankroll dialog + Bet Manager** | Redondance (2 façons d'accéder) | Permanent |
| **Paper Trading en header** | Feature power-user, pas centrale | Occasionnel |
| **120px chrome mobile** | 18% de l'écran perdu (iPhone SE) | Permanent |
| **Header spécifique à page.tsx** | Pas de cohérence sur /ligues, /settings | Permanent |
| **Pas de recherche Ctrl+K** | Standard 2025 non implémenté | Permanent |

---

## 3. Architecture Cible

### 3.1 Structure à 2 niveaux (Desktop)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]  PariScore          🔍 Recherche    🔔  👤  ⚙️       │  ← Niveau 1: 44px
├─────────────────────────────────────────────────────────────┤
│ ⚽ Football  🎾 Tennis  🏀 Basketball  🏉 Rugby  +5 More    │  ← Niveau 2: 36px (scrollable)
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Structure Mobile (Bottom Nav + Header minimal)

```
┌────────────────────────────────┐
│ [≡]  PariScore         🔍  👤  │  ← Header: 48px (minimal)
├────────────────────────────────┤
│                                │
│         CONTENU                │
│                                │
├────────────────────────────────┤
│  Accueil  Live  Value  Fav  ⚙️ │  ← Bottom nav: 60px
└────────────────────────────────┘
```

---

## 4. Composants Détaillés

### 4.1 Niveau 1 — Barre Principale (44px)

| Élément | Comportement | Taille |
|---------|--------------|--------|
| **Logo + "PariScore"** | Clic → home, toujours visible | 40×32px |
| **Barre de recherche** | `Ctrl+K` / clic → modal overlay, sport filter intégré | flex-1, max 280px |
| **🔔 Notifications** | Badge count live, dropdown: alerts + settings | 32×32px |
| **👤 Profil** | Avatar ou icône, dropdown: account, logout | 32×32px |
| **⚙️ Réglages** | Icône gear → `/settings` | 32×32px |

**Éléments SUPPRIMÉS du header** (déplacés ailleurs) :

| Élément | Destination |
|---------|-------------|
| LanguageToggle | Dropdown profil ou /settings |
| PushToggle | /settings (section Notifications) |
| EmailToggle | /settings (section Notifications) |
| TerminalToggle | /settings (section Affichage) |
| DensityToggle | Déjà dans /settings |
| ValueBetScannerIndicator | Badge count dans 🔔 Notifications |
| Bankroll dialog | Supprimé (garder seulement le lien Bet Manager) |
| Championnats link | Onglet sport dans niveau 2 |

### 4.2 Niveau 2 — Onglets Sport (36px, scrollable)

```
[⚽ Football] [🎾 Tennis] [🏀 Basketball] [🏉 Rugby] [🥊 MMA] [🚴 Cycling] [+5 More ▾]
```

- **Scroll horizontal** sur mobile, overflow hidden + gradient fade
- **"+5 More"** → dropdown avec sports restants (pattern Sofascore)
- **Badge live count** par sport (ex: "⚽ Football 12")
- **Rendu** : composant `SportTabs` dédié, importé dans le layout

### 4.3 Modal Recherche (Ctrl+K)

Inspiré Sofascore/Linear :
- Overlay sombre + backdrop-blur
- Input autofocus avec placeholder "Rechercher un match, équipe, ligue..."
- Résultats groupés par catégorie (Matchs, Équipes, Ligues)
- Navigation clavier (↑↓ Enter)
- Raccourci affiché : `⌘K` / `Ctrl+K`

### 4.4 Notifications Dropdown

Fusionne PushToggle + EmailToggle + ValueBetScannerIndicator :
- **Section "Alertes value bets"** : toggle on/off + configure
- **Section "Notifications push"** : toggle on/off
- **Section "Alertes email"** : toggle on/off + input email
- **Section "Alertes live"** : par sport/ligue
- Badge count total sur l'icône 🔔

---

## 5. Spécifications Techniques

### 5.1 Fichiers à modifier/créer

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/app/layout.tsx` | **MODIFIER** | Ajouter le header global (niveau 1 + 2) |
| `src/app/page.tsx` | **MODIFIER** | Supprimer l'ancien header, garder le contenu |
| `src/components/layout/site-header.tsx` | **CRÉER** | Composant principal header |
| `src/components/layout/sport-tabs.tsx` | **CRÉER** | Onglets sport niveau 2 |
| `src/components/layout/search-modal.tsx` | **CRÉER** | Modal recherche Ctrl+K |
| `src/components/layout/notifications-dropdown.tsx` | **CRÉER** | Dropdown notifications unifié |
| `src/components/layout/user-menu.tsx` | **CRÉER** | Menu profil/utilisateur |

### 5.2 Header dans layout.tsx

```tsx
// src/app/layout.tsx — ajout du header global
import { SiteHeader } from "@/components/layout/site-header";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <SiteHeader />  {/* ← NOUVEAU : header global */}
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 5.3 Comportement Auto-Hide

Garder le comportement actuel de `AutoHideHeader` :
- `sticky top-0 z-50`
- Cache au scroll-down (>50px delta), révèle au scroll-up
- `backdrop-blur-md` + `bg-bg-deep/80`
- Animation framer-motion `y: "-100%"` / `"0%"`

### 5.4 Responsive Breakpoints

| Breakpoint | Niveau 1 | Niveau 2 | Bottom Nav |
|------------|----------|----------|------------|
| `< 640px` (mobile) | Logo + Recherche + Profil | Onglets scrollables | Visible (5 items) |
| `640px - 1024px` (tablette) | Logo + Recherche + actions | Onglets scrollables | Masqué |
| `> 1024px` (desktop) | Logo + Recherche + actions | Onglets + "More" | Masqué |

### 5.5 Accessibilité

- `role="banner"` sur le header principal
- `role="navigation"` sur les onglets sport
- `aria-label` sur tous les boutons icônes
- `aria-current="page"` sur l'onglet sport actif
- Focus visible (`focus-visible:ring-2`) sur tous les éléments interactifs
- `aria-live="polite"` sur les compteurs de notifications
- Skip-to-content link : `<a href="#main-content" class="sr-only focus:not-sr-only">`

### 5.6 Performance

- Lazy-load du modal recherche (`React.lazy`)
- Le dropdown notifications ne charge les données quewhen open
- Onglets sport : données statiques (pas de fetch), badge count depuis store existant
- Pas de nouveau framework — rester sur framer-motion + tailwind existants

---

## 6. Migration — Ce qui change

### Avant (12 éléments en header)

```
[Logo] | [SidebarDrawer] [Lang] [Push] [Email] [Terminal] [ValueBet] [BetManager] [Championnats] [Bankroll] [PaperTrading] [Theme] [Settings]
```

### Après (5 éléments en header + 2 niveaux)

```
Niveau 1: [Logo] [——— Recherche ———] [🔔] [👤] [⚙️]
Niveau 2: [⚽ Football] [🎾 Tennis] [🏀 Basketball] ... [+5 More]
```

### Éléments déplacés vers /settings

| Composant | Section settings |
|-----------|-----------------|
| LanguageToggle | Profil ou header dropdown |
| PushToggle | Notifications |
| EmailToggle | Notifications |
| TerminalToggle | Affichage |
| DensityToggle | Affichage (déjà présent) |

### Éléments supprimés

| Composant | Raison |
|-----------|--------|
| Bankroll dialog trigger | Redondant avec /bankroll link |
| ValueBetScannerIndicator | Fusionné dans 🔔 Notifications |

---

## 7. Design Tokens

```css
/* Header-specific tokens */
--header-height-level1: 44px;
--header-height-level2: 36px;
--header-total-height: 80px;
--header-blur: blur(12px);
--header-bg: rgba(var(--bg-deep), 0.85);

/* Sport tab active */
--sport-tab-active-bg: rgba(0, 230, 118, 0.15);
--sport-tab-active-text: #00e676;
--sport-tab-active-border: #00e676;

/* Search modal */
--search-overlay-bg: rgba(0, 0, 0, 0.6);
--search-modal-bg: #1a1d2e;
--search-input-bg: #0f1117;
```

---

## 8. Plan d'Implémentation (Engineering Loop)

### Phase 1 : Fondations (créer les composants)
1. Créer `site-header.tsx` — shell avec AutoHideHeader + 2 niveaux
2. Créer `sport-tabs.tsx` — onglets sport scrollables
3. Créer `search-modal.tsx` — modal Ctrl+K
4. Créer `notifications-dropdown.tsx` — dropdown unifié
5. Créer `user-menu.tsx` — menu profil

### Phase 2 : Intégration
6. Ajouter `SiteHeader` dans `layout.tsx`
7. Supprimer l'ancien header de `page.tsx`
8. Déplacer les toggles vers `/settings`
9. Supprimer les imports inutilisés

### Phase 3 : Polish
10. Ajouter les animations (framer-motion)
11. Tester responsive (mobile/tablette/desktop)
12. Vérifier accessibilité (axe, clavier)
13. Lint + typecheck

### Phase 4 : Deploy
14. Commit + push
15. Deploy VPS
16. Vérifier en prod
