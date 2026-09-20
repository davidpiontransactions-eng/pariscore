# Traceabilité — Refonte Headbar ParisCore

**Sprint** : 1 + 2 + 3 (P0 + P1 + P2)
**Début** : 2026-09-20
**Statut** : ✅ Terminé

---

## Tâches

### T1 — Search API réelle (P0)
- **Statut** : ✅ Terminé
- **Fichiers modifiés** :
  - `src/app/api/v1/search/route.ts` (nouveau — API unifiée ligues + football + tennis)
  - `src/hooks/use-search-api.ts` (nouveau — hook debounced 250ms + cache local)
  - `src/components/layout/search-modal.tsx` (modifié — DEMO → API réelle, loading state, navigation href)
- **Vérification** : `tsc --noEmit` OK (erreur pre-existante dans top5/route.ts, non liée)

### T2 — Auth NextAuth UserMenu (P0)
- **Statut** : ✅ Terminé
- **Fichiers modifiés** :
  - `src/app/api/auth/[...nextauth]/route.ts` (nouveau — config NextAuth v4, Credentials + Google + GitHub providers)
  - `src/components/providers.tsx` (nouveau — SessionProvider wrapper)
  - `src/app/layout.tsx` (modifié — ajout Providers wrapper)
  - `src/components/layout/user-menu.tsx` (modifié — useSession, signIn/signOut, avatar initiales, badge connecté)
- **Vérification** : `tsc --noEmit` OK

### T3 — Live counts étendus (P0)
- **Statut** : ✅ Terminé
- **Fichiers modifiés** :
  - `src/hooks/use-sport-live-counts.ts` (nouveau — hook polling /api/v1/multisport-calendar?live=true toutes les 30s)
  - `src/components/layout/sport-tabs.tsx` (modifié — utilise multisportCounts comme fallback pour les 12 sports)
- **Vérification** : Tennis/foot hooks précis (prioritaires), multisport-calendar pour le reste

### T4 — Tokens charter headbar (P1)
- **Statut** : ✅ Terminé
- **Fichiers modifiés** :
  - `src/components/layout/site-header.tsx` — hardcodé `#1A1145`→`--foreground`, `#7B3FA0`→`--primary`, `#6B5B8D`→`--muted-foreground`, `#E0D8F0`→`--border`, `#F8F5FC`→`--secondary`, `purple-500`→`primary`, `bg-white`→`bg-background`
  - `src/components/layout/sport-tabs.tsx` — `#7B3FA0`→`--primary`, `#6B5B8D`→`--muted-foreground`, `#1A1145`→`--foreground`
  - `src/components/layout/search-modal.tsx` — `#1a1d2e`→`bg-card`, `#12162a`→`from-card/via-popover/to-card`
- **Vérification** : Plus de hardcodé dans les composants headbar

### T5 — COMPONENTS.md update (P1)
- **Statut** : ✅ Terminé
- **Fichier** : `COMPONENTS.md`
- **Ajouts** : site-header, sport-tabs, search-modal, notifications-dropdown, user-menu (5 composants)
- **Vérification** : Section Layout mise à jour 6 → 11 composants

---

## Journal

| Date | Action | Résultat |
|------|--------|----------|
| 2026-09-20 | Création traceabilité | ✅ |
| 2026-09-20 | Brainstorming + GO/NO-GO rapports | ✅ `docs/BRAINSTORMING-HEADBAR.md`, `docs/GO-NOGO-HEADBAR.md` |
| 2026-09-20 | T1 — Search API réelle | ✅ `api/v1/search/route.ts` + `use-search-api.ts` + search-modal.tsx modifié |
| 2026-09-20 | T2 — Auth NextAuth | ✅ `api/auth/[...nextauth]/route.ts` + `providers.tsx` + layout.tsx + user-menu.tsx modifié |
| 2026-09-20 | T3 — Live counts étendus | ✅ `use-sport-live-counts.ts` + sport-tabs.tsx modifié |
| 2026-09-20 | T4 — Tokens charter | ✅ site-header.tsx + sport-tabs.tsx + search-modal.tsx (hardcodé → shadcn vars) |
| 2026-09-20 | T5 — COMPONENTS.md | ✅ 5 composants ajoutés (6 → 11) |

## Fichiers créés/modifiés (Sprint 1)

| Fichier | Type | Tâche |
|---------|------|-------|
| `src/app/api/v1/search/route.ts` | Nouveau | T1 |
| `src/hooks/use-search-api.ts` | Nouveau | T1 |
| `src/components/layout/search-modal.tsx` | Modifié | T1, T4 |
| `src/app/api/auth/[...nextauth]/route.ts` | Nouveau | T2 |
| `src/components/providers.tsx` | Nouveau | T2 |
| `src/app/layout.tsx` | Modifié | T2 |
| `src/components/layout/user-menu.tsx` | Modifié | T2 |
| `src/hooks/use-sport-live-counts.ts` | Nouveau | T3 |
| `src/components/layout/sport-tabs.tsx` | Modifié | T3, T4 |
| `src/components/layout/site-header.tsx` | Modifié | T4 |
| `COMPONENTS.md` | Modifié | T5 |
| `docs/BRAINSTORMING-HEADBAR.md` | Nouveau | Brainstorming |
| `docs/GO-NOGO-HEADBAR.md` | Nouveau | GO/NO-GO |
| `docs/TRACEABILITE-HEADBAR.md` | Nouveau | Traceabilité |

---

# Sprint 3 — P2

## Tâches

### T11 — Odds sparklines (P2)
- **Statut** : ✅ Terminé
- **Fichiers** :
  - `src/components/ui/sparkline.tsx` (nouveau — SVG inline 48x14, tendance vert/rouge/gris)
  - `src/hooks/use-live-ticker.ts` (modifié — champ `odds?: number[]` dans TickerMatch)
  - `src/components/layout/live-ticker.tsx` (modifié — Sparkline intégré dans TickerItem)

### T12 — Notifications intelligentes (P2)
- **Statut** : ✅ Terminé
- **Fichiers** :
  - `src/hooks/use-notifications.ts` (nouveau — feed avec priorités LIVE/VALUE/ALERT/INFO, max 50 items)
  - `src/components/layout/notifications-dropdown.tsx` (modifié — feed récent + lazy mount hooks lourds)

### T13 — MobileBottomNav sync (P2)
- **Statut** : ✅ Terminé
- **Fichier** : `src/components/layout/mobile-bottom-nav.tsx` (modifié — tokens charter, useSportLiveCounts, inner component mobile-only)

### T14 — Athlete image dynamique (P2)
- **Statut** : ✅ Terminé
- **Fichier** : `src/components/layout/site-header.tsx` (modifié — `/athletes/{sport}-header.svg` + fallback onError)

### T15 — Performance audit (P2)
- **Statut** : ✅ Terminé
- **Fixes appliqués** :
  - 🔴 Supprimé `priority` sur image décorative (LCP)
  - 🔴 Supprimé hooks doublons sport-tabs (source unique useSportLiveCounts)
  - 🔴 Hooks lourds notifications lazy-mountés
  - 🟡 Garde page bounds use-live-ticker
  - 🟡 Mémoïsation total (use-sport-live-counts) + unread/byPriority (use-notifications)
  - 🟡 Polling désactivé sur desktop (mobile-bottom-nav)

## Bilan global

| Sprint | Tâches | Fichiers | Status |
|--------|--------|----------|--------|
| Sprint 1 (P0+P1) | T1–T5 | 14 | ✅ |
| Sprint 2 (P1) | T6–T10 | 8 | ✅ |
| Sprint 3 (P2) | T11–T15 | 9 | ✅ |
| **Total** | **15 tâches** | **22 fichiers uniques** | **✅** |

## Quality Gates

| Gate | Résultat |
|------|----------|
| `tsc --noEmit` | ✅ 0 erreurs |
| Sparkline duplication | ✅ Supprimé `ui/sparkline.tsx`, import corrigé vers `tennis/sparkline.tsx` |
| JSX fragment error | ✅ Corrigé `notifications-dropdown.tsx` |
| Git commit | ✅ `903e3036` — `feat(headbar): complete redesign` (24 files, +3410/-224) |
| Git push | ✅ origin/main |
| VPS deploy | ✅ `DEPLOY-OK` — health check OK, build ran, discord notification envoyée |

---

# Sprint 2 — P1 + P2

## Tâches

### T6 — Live ticker intégré N1 (P1)
- **Statut** : ✅ Terminé
- **Fichiers** :
  - `src/hooks/use-live-ticker.ts` (nouveau — polling 15s, rotation 8s, max 3 visibles)
  - `src/components/layout/live-ticker.tsx` (nouveau — composant compact sport-specific colors)
  - `src/components/layout/site-header.tsx` (modifié — LiveTicker entre search et actions)

### T7 — Sport tabs personnalisables (P1)
- **Statut** : ✅ Terminé
- **Fichiers** :
  - `src/hooks/use-sport-preferences.ts` (nouveau — localStorage favoris, max 5, reorder)
  - `src/components/layout/sport-tabs.tsx` (modifié — 5 favoris + dropdown "Plus" avec AnimatePresence)

### T8 — 3-mode Dark (P1)
- **Statut** : ✅ Terminé
- **Fichiers** :
  - `src/components/layout/user-menu.tsx` (modifié — cycle Light→Dark→Auto, icônes Sun/Moon/Monitor)
  - `src/app/layout.tsx` (modifié — ThemeProvider `enableSystem`)

### T9 — Navigation clavier sport tabs (P1)
- **Statut** : ✅ Terminé
- **Fichier** : `src/components/layout/sport-tabs.tsx` (modifié — ArrowLeft/Right/Home/End, roving tabindex)

### T10 — Supprimer !important CSS (P2)
- **Statut** : ✅ Terminé
- **Fichier** : `src/app/globals.css` (modifié — double class selector `.liquid-glass--animated.liquid-glass--animated::after`)

## Journal Sprint 2

| Date | Action | Résultat |
|------|--------|----------|
| 2026-09-20 | T6 — Live ticker | ✅ Hook + composant + intégration headbar |
| 2026-09-20 | T7 — Sport tabs personnalisables | ✅ Hook localStorage + dropdown "Plus" |
| 2026-09-20 | T8 — 3-mode Dark | ✅ UserMenu cycle + ThemeProvider enableSystem |
| 2026-09-20 | T9 — Keyboard nav | ✅ ArrowLeft/Right/Home/End + roving tabindex |
| 2026-09-20 | T10 — CSS !important | ✅ Double class selector (specificity > !important) |

## Fichiers créés/modifiés (Sprint 2)

| Fichier | Type | Tâche |
|---------|------|-------|
| `src/hooks/use-live-ticker.ts` | Nouveau | T6 |
| `src/components/layout/live-ticker.tsx` | Nouveau | T6 |
| `src/components/layout/site-header.tsx` | Modifié | T6 |
| `src/hooks/use-sport-preferences.ts` | Nouveau | T7 |
| `src/components/layout/sport-tabs.tsx` | Modifié | T7, T9 |
| `src/components/layout/user-menu.tsx` | Modifié | T8 |
| `src/app/layout.tsx` | Modifié | T8 |
| `src/app/globals.css` | Modifié | T10 |
