# Session: Suppression SportTabs → Sidebar-Only Navigation

**Date**: 2026-08-29
**Objectif**: Supprimer la barre d'onglets horizontale SportTabs et faire de la sidebar le système de navigation unique.

## Contexte

PariScore avait deux systèmes de navigation redondants :
1. **SportTabs** (horizontal) — `sport-tabs.tsx` + `sport-swipe-header.tsx`
2. **SportsSidebar** (latéral) — `sports-sidebar.tsx`

Les deux contrôlaient le même store Zustand (`activeTab`). SportTabs était purement redondant.

## Recherche

### Analyse comparative (5 concurrents)
- 1xBet, Bet365, Sofascore, Flashscore, FotMob — tous utilisent la sidebar comme navigation principale
- Pattern commun : sidebar gauche + contenu central + bet slip droite

### Sources académiques (10 thèses)
- Kingsburg (2003) : left-top-top = 17s plus rapide
- Neuhaus (2021, N=462) : sidebar recall 37.5% vs 0% top nav
- NN/g (2021) : labels textuels obligatoires
- NN/g (2023) : multi-expand accordions
- Zaphiris (2002) : depth ≤ 3 idéal
- Yang (2024) : mix horizontal+vertical optimal

### Design web (8 sources)
- Linear : app-shell sidebar fixe w-64, bg #1c1c20
- shadcn/ui : CSS variables dark theme, variants collapsible
- BoxBet : navigation sidebar = système unique pre-match ↔ live
- WNNR : left sidebar compact + quick links
- Stripe : zéro ombre, depth par tint shifts
- EerieGG : neon green highlights
- Dribbble AI Football : dark UI high-contrast

## Changements

### Fichiers supprimés
- `src/components/layout/sport-swipe-header.tsx`
- `src/components/layout/sport-tabs.tsx`

### Fichiers modifiés
- `src/app/page.tsx` : suppression import + usage SportSwipeHeader
- `src/types/sports-sidebar.ts` : ajout `"home"` à SportTabId
- `src/lib/sports-tree.ts` : ajout entry `home` dans SPORT_META
- `src/components/layout/sports-sidebar.tsx` : header logo Accueil + live pulsing dot
- `COMPONENTS.md` : suppression entrées sport-swipe-header/sport-tabs

### Pas de changement
- Quick Links déjà positionné correctement dans la sidebar
- Edge badges déjà implémentés (EdgeBadge composant existant)
- Design tokens déjà appliqués via Tailwind (bg-[#0F172A], text-slate-200, etc.)

## Quality Gates
- `bun run lint` : 3 erreurs préexistantes (imports require basketball) — 0 nouvelle erreur
- `bun run typecheck` : erreurs préexistantes (tools/skyvern/, tests) — 0 nouvelle erreur

## Résultat
- SportTabs supprimé (2 fichiers, 2 imports, 1 usage)
- Sidebar = navigation unique avec header Accueil
- Live indicator = point rouge pulsant devant les sports live
- Edge badges = déjà opérationnels
