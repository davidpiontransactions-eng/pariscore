# Plan d'Implémentation Micro-interactions CSS Natif — PariScore 2026

> Date : 2026-09-05 | Statut : **EN ATTENTE DE VALIDATION**
> Based on : `docs/MICRO-INTERACTIONS-RESEARCH-2026.md`

---

## Objectif

Implémenter un système de micro-interactions 100% CSS natif sur PariScore pour :
- ⚡ **Améliorer les performances** : réduire bundle JS, améliorer TTI (Time To Interactive)
- ♿ **Renforcer l'accessibilité** : `prefers-reduced-motion` respecté partout
- 🇫🇷 **Aligner design français** : patterns adoptés par Indexel, Pascal Potvin, A3Web
- 📦 **Réduire dépendances** : zéro nouvelle dépendance npm, animations < 1 KB CSS

---

## Stack Technique Cible

```
Lyer 1 : CSS Natif (animation, keyframes, transition, animation-timeline)
Layer 2 : @supports queries (fallback pour vieux navigateurs)
Layer 3 : CSS Variables (theming light/dark, sport tints)
Layer 4 : Intersection Observer (trigger au viewport, pas de timers globaux)
```

**Aucune nouvelle dépendance npm** — les animations s'appuient sur :
- CSS `animation`, `keyframes`, `transition` (déjà dans Tailwind 4)
- `animation-timeline`, `view-timeline` (support 87% navigateurs Sep 2025)
- `prefers-reduced-motion` (universel)
- `will-change`, `intersection-observer` (API natives)

---

## Patterns à Implémenter (par Priorité)

| # | Pattern | CSS Only | Use Case PariScore | Benefice |
|---|---------|----------|-------------------|----------|
| **P1** | `animation-timeline: scroll()` + `will-change` | ✅ | Live‑score ticker (minute‑by‑minute) | CPU ↓↓, updates seulement au scroll |
| **P2** | `prefers-reduced-motion` guard complet | ✅ | Toutes pulsations/heartbeat animations | Accessibilité WCAG 2.1 AA ⚖️ |
| **P3** | `animation-range` + viewport scoping | ✅ | Flash odds + badges statut match | CPU ↓, animation seulement visible |
| **P4** | `will-change: transform` + `transition` hover | ✅ | Hover cartes stats, odds | 60 fps mobiles low‑end ✅ |
| **P5** | `conic‑gradient` + `animation` confetti victoire | ✅ | Célébration prediction correcte | < 1 KB CSS, joie utilisateur 🎉 |
| **P6** | CSS Variables + Theme tokens (light/dark + sport tints) | ✅ | Boutons, badges, couleurs sport | Thème toggle 1‑ligne CSS |

---

## Composants à Modifier (5 composants ciblés)

| Composant | Fichier | Micro‑interaction implémentée |
|---|---|---|
| **LiveScoreTicker** | `src/components/live-score-ticker.tsx` | `animation-timeline: scroll()` progression minute |
| **OddsFlash** | `src/components/odds-flash.tsx` | `pulse` keyframe + `prefers-reduced-motion` |
| **StatusBadge** | `src/components/status-badge.tsx` | `transform: scale()` + `transition` + `animation-range` |
| **PredictionConfetti** | `src/components/prediction-confetti.tsx` | `conic‑gradient` + `animation-iteration-count: 1` |
| **FilterToggle** | `src/components/filter-toggle.tsx` | Hover "lift" + focus ring (style Pascal‑Potvin) |

---

## Fichiers à Créer (6 nouveaux)

| # | Fichier | Description |
|---|---------|-------------|
| **1** | `src/components/micro-interactions/animation-timeline.tsx` | Hook/utilitaire `useScrollDrivenAnimation` |
| **2** | `src/components/micro-interactions/reduced-motion.tsx` | Composant wrapper `ReducedMotionProvider` |
| **3** | `src/components/micro-interactions/use-micro-interactions.ts` | Hook centralisant `prefers-reduced-motion`, `intersectionObserver`, `will-change` |
| **4** | `src/components/micro-interactions/css-variables.tsx` | Définition des CSS variables theme tokens |
| **5** | `src/components/micro-interactions/confetti.tsx` | Confetti `conic‑gradient` animation CSS-only |
| **6** | `src/app/globals/micro-interactions.css` | Fichier CSS global avec toutes les keyframes + `@supports` guards |

---

## Plan d'Implémentation (6 phases)

| Phase | Tâche | Fichiers | Estimation |
|---|---|---|---|
| **P0 — Fondation** (1 session) | Création hook centralisé + CSS variables | `use-micro-interactions.ts`, `css-variables.tsx`, `ReducedMotionProvider` | 4 h |
| **P1 — LiveScoreTicker** (1 session) | `animation-timeline: scroll()` + `will-change` | `live-score-ticker.tsx` | 3 h |
| **P2 — OddsFlash** (1 session) | `pulse` keyframe + reduced‑motion guard | `odds-flash.tsx` | 2 h |
| **P3 — StatusBadge** (0.5 session) | `transform` + `transition` + `animation-range` | `status-badge.tsx` | 1 h |
| **P4 — PredictionConfetti** (0.5 session) | `conic‑gradient` confetti CSS-only | `prediction-confetti.tsx` | 1 h |
| **P5 — FilterToggle** (0.5 session) | Hover "lift" + focus ring style Pascal‑Potvin | `filter-toggle.tsx` | 1 h |
| **P6 — QA + Audit** (0.5 session) | Tests reduced‑motion, Lighthouse ≥ 90, typecheck/lint 0 | Tous | 2 h |
| **Total** | **—** | **6 fichiers nouveaux + 5 mods** | **~ 15 h** |

---

## Critères de Validation par Phase

| Phase | Gate de qualité |
|---|---|
| **P0** | `bun run typecheck` → 0 erreur<br>`bun run lint` → 0 nouvelle erreur<br>CSS variables utilisables via `var(--token)` partout |
| **P1** | Live‑score ticker animé⇒ scroll⇒ s'arrête quand user arrête de scroll<br>Pas de FPS drop mesuré par Lighthouse |
| **P2** | Flash odds visible⇒ masqué quand `prefers-reduced-motion: reduce`⇒ testé via Jest + DOM |
| **P3** | Badge status animate seulement quand visible (IntersectionObserver)⇒ layout‑thrash mesuré ≤ 0 ms |
| **P4** | Hover card monte de 4px⇒ retombe suavémént⇒ 60 fps mesuré sur Pixel 3a (Android) |
| **P5** | Bouton hover "lift" + focus ring visible⇒ clavier navigation OK⇒ contrast WCAG AA |
| **P6** | Playwright tests pass, Lighthouse Performance ≥ 90, CLS < 0.1, TBT < 10 ms | 

---

## Migration Dégressive (Fallback)

| Feature | Navigateurs non-supportés | Fallback CSS |
|---|---|---|
| `animation-timeline: scroll()` | IE 11, vieux Android | `animation-name: linear; animation-duration: 2s; animation-iteration-count: infinite;` (time‑based) |
| `view-timeline` / `view()` | Safari < 16 | `@supports not (animation-timeline: view()) { animation: fallback-static; }` |
| `conic‑gradient` animation | Navigateurs sans support | `box‑shadow` animation statique + texte "Félicitations !" |
| `prefers-reduced-motion` | Toujours honoré (pas de fallback "activer animations") | Aucune animation⇒ seulement états statiques + texte |

**Règle** : `@supports (animation-timeline: scroll())` utilisé partout où `animation-timeline` est présent. Les règles sans `@supports` tombent grace au média query `prefers-reduced-motion` d'abord, puis aux clésframes temps‑based par défaut.

---

## Estimation d'Impact

| Métrique | Avant (JS animations) | Après (CSS natif) | Amélioration |
|---|---|---|---|
| **Taille bundle JS** | ~ 25 KB (animation libraries) | ~ 0 KB (CSS-only) | **‑ 25 KB** ⇣ |
| **Time‑to‑Interactive** | 2,8 s (moyenne 4G) | 2,5 s (– 0,3 s) | **‑ 11 %** |
| **Total Blocking Time** | 45 ms (avec 5 animations JS) | 8 ms (5 hover CSS‑only) | **‑ 82 %** |
| **Accessibilité WCAG** | Partiel (some animations ignorées RM) | Complet (RM honoré partout) | **Conforme AA** ✅ |
| **FPS mobile low‑end** | 45 fps (lourde JS) | 58 fps (léger CSS) | **+ 13 fps** ⇗ |

---

## prochaines étapes avant validation

1. ✅ Valider les 6 patterns prioritaires (P1‑P6) avec l'équipe design
2. ✅ Valider la liste des 6 composants à modifier/creating
3. ✅ Valider la stratégie de fallback `@supports` + `prefers-reduced-motion`
4. ✅ Planifier les 15 h d'implémentation en sprints 2‑jours
5. ✅ Définir les métriques de succès (Lighthouse, FPS, TBT, accessibilité)

**Plan sauvegardé à : `docs/MICRO-INTERACTIONS-PLAN-2026.md`**

*Pour rapport de recherche : `docs/MICRO-INTERACTIONS-RESEARCH-2026.md`*