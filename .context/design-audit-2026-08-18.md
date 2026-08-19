# Audit Design PariScore — Visualisation & Fluidité du Match

> **⚠️ Mise à jour 2026-08-18 (implémentation)** : la vague **P0 est implémentée et validée** (typecheck, ESLint, build Next, détecteur impeccable 0 finding, 0 erreur console, 0 débordement 375px). Voir §8 « Statut d'implémentation » en fin de rapport.

> **Date** : 2026-08-18 · **Périmètre** : `src/app`, `src/components` (Next.js 16, React 19, Tailwind v4, framer-motion, recharts, SWR/SSE)
> **Méthodologie** : 4 sources design — **ui-ux-pro-max** (skill : design system + guidelines UX/charts), **impeccable** (skill : critique mode *Operate* + craft floor), **magic-ui** ✅ = **serveur MCP `magicui`** (`@magicuidesign/mcp@latest`, configuré dans `.mcp.json`) — registry de composants vérifié en direct (voir §7), **awesome-design-md** ✅ = **skill `design-md`** (collection locale de 74 DESIGN.md de marques réelles, `.agents/design-md/`) — benchmark de design systems du marché (voir §4bis). + **Playwright MCP** (QA visuel) et **Context7 MCP** (docs à jour).
> **Cible** : amélioration significative de la **visualisation du match** (live + prématch) et de la **fluidité** (motion, transitions, rafraîchissement).

---

## 1. Résumé exécutif

PariScore possède déjà une base design solide et cohérente : système de tokens achromatique + accents sport porteurs de sens, `tabular-nums` sur toutes les données, charts Tufte sans grid ni re-animation, et un composant flagship (`MomentumDR`) d'un niveau rare (spring physics, sparkline SVG maison, tooltip pop). L'audit conclut : **pas besoin de refonte, besoin d'une couche de « magic » maîtrisée** — de la présence visuelle (glow, ambiances, bento), de la **fluidité de navigation** (transitions d'onglets/pages absentes aujourd'hui), et de **signaux live plus intelligibles** (le score change sans aucune annonce visuelle dans les cartes classiques).

**3 constats majeurs** :

1. **Aucune transition** entre onglets sports / sous-onglets live↔prématch : rendu conditionnel brutal. C'est la première source de « raideur » perçue.
2. **Le score en live est visuellement silencieux** : le point gagnant ne produit ni flash ni pulsation (seuls les odds chips réagissent). Un match en cours doit « respirer ».
3. **Motion sans système** : 0 keyframe custom dans `globals.css`, durées éparpillées (0.15s / 0.3s / 0.5s / 0.7s / 1.1s), `animate-ping` répété à 7+ endroits — un token de motion + une politique `prefers-reduced-motion` manquent.

---

## 2. État des lieux — forces confirmées

| Force | Évidence |
|---|---|
| Probabilité = héro | `ProbabilityBar` (segments 700ms, IC95 + tick médian, décomposition Elo/Form/H2H), `ProbabilityRing` (rAF ease-out 1100ms) |
| Charts Tufte, pas de re-animation live | `WinProbabilityChart` (`isAnimationActive={false}`, ReferenceLine 50%, gradient vertical), `StatsRadarChart` (tooltip texte brut) |
| Données stables pendant les updates | `lib/live-state-builder.ts` → objets identité-stables → cartes mémoïsées ; SSE refcounté tennis, fallback REST 8s |
| A11y live exemplaire | `LiveScoreAnnouncer` (diff engine, `aria-live`), `MotionScoreDuo` réutilisable |
| Flagship motion | `MomentumDR` : balance bar gradients + needle spring (300/25), sparkline bezier avec double-dots de breaks, dots tous les 4 points, collapse height 0→auto |
| Identité par sport | `--sport-*` invariants de thème, cartes F1/MMA `rounded-2xl` + glow hover dédié |
| A11y diff scores | `LiveScoreAnnouncer` (tennis) — à étendre |

---

## 3. Constats détaillés (problèmes concrets)

### 3.1 Visualisation du match

- **[V1] Le score live est muet** — `set-scoreline.tsx` change le texte (bold emerald), `current-game-score.tsx` recalcule, mais **aucun flash/pulse** sur le point gagné dans `match-card.tsx` classique (seul `live-odds-panel.tsx` a un flash de direction). L'œil ne sait pas *où* le match a bougé.
- **[V2] Pas d'annonce du changement de probabilité** — `WinProbabilityChart` remet à jour la ligne mais le % courant (header) ne « respire » pas ; le `motion.circle` du MomentumDR (r 0→3) prouve que le pattern est possible et apprécié — il manque à la proba.
- **[V3] Hiérarchie du score en prématch** — le « VS circle » (`match-card.tsx:393`, `border-border/60 bg-muted/40`) est terne : c'est le point focal de la carte, il doit porter plus de présence (ring dégradé sport + glow).
- **[V4] Deux visualisations momentum non reliées** — `MomentumDR` (série DR) et `PointTimeline` (points + breaks) coexistent sans synchronisation temporelle : on ne peut pas voir « quand le break a-t-il fait basculer le DR ? ». Une timeline unifiée est l'innovation n°1 pour le tennis.
- **[V5] xG football sous-exploité** — `XGSparkline` (`football-live-card.tsx:14-84`) : strokes 1.5-1.8px, pas de remplissage cumulatif, pas de marqueur du dernier point — moins lisible que le DR sparkline tennis alors que c'est la donnée la plus valorisée en football.
- **[V6] Radar sans labels directs** — legend « initiales » en dehors du radar ; la lecture « qui domine quoi » demande un aller-retour œil/legend (Tufte : labels directs sur les axes).
- **[V7] Densité 10px** — micro-labels `text-[10px] uppercase tracking-[0.12em]` généralisés (ex. `momentum-dr.tsx:284`) : lisibilité marginale sur mobile, contrast 10px ≈ 7.5px effectif sur écrans 375px.

### 3.2 Fluidité & motion

- **[F1] Aucune transition d'onglet/page** — `tennis-tab-content` et les sous-onglets sont des rendus conditionnels ; le changement de sport dans `SportSwipeHeader` saute. Comparez : `mma-tab-content.tsx` utilise déjà `AnimatePresence mode="popLayout"` — le pattern existe, il n'est pas généralisé.
- **[F2] Pas de tokens de motion** — durées inline partout (0.15/0.3/0.5/0.7/1.1s), easings mélangés (`easeOut` vs `easeInOut` vs spring). `globals.css` : **0 keyframe custom**, tout vient de `tw-animate-css`.
- **[F3] `animate-ping` casino-adjacent** — 7+ occurrences (LIVE badge header/broadcast/odds/cs2/table) : le ping 2px blanc est exactement le type de pulsation que PRODUCT.md interdit (« no aggressive pulsing »). Un halo `pulse-soft` 3s ou un point statique + texte « LIVE » suffit.
- **[F4] Pas de `prefers-reduced-motion`** explicite — les springs et ping tournent toujours.
- **[F5] Football moins fluide que tennis** — SWR 30s (`use-live-football.ts:122`) vs SSE tennis 8s : la perception de « direct » varie selon le sport. Le tennis dispose d'un broker SSE déjà en place — pattern à étendre ou à ramener à 15s.
- **[F6] Skeleton générique** — pas de skeleton en forme de match-card ; le shimmer absent.
- **[F7] Scroll-jump au collapse** — `height 0→auto` (momentum, cartes) : pas de `useLayoutEffect` de garde anti-jitter sur les listes longues.

### 3.3 Système & cohérence

- **[S1] Glassmorphism non tokenisé dans Next** — `backdrop-blur-md` ad hoc (`page.tsx:225`) alors que la chartre définit `--cf-blur-*` / `--cf-glass-*` (DESIGN_CHARTER.md §3). Unifier : tokens + classes utilitaires.
- **[S2] Fond plat** — `--bg-deep: #0a0e17` uniforme : aucune ambiance (gradient radial, glow spots) pour différencier les sports et les états live.
- **[S3] Focus visibles** — la checklist ui-ux-pro-max exige focus-visible accentué ; audit rapide : les chips (OddChip) et les cartes cliquables n'ont pas tous un ring accent par sport.
- **[S4] Contraste live badge** — badge `bg-rose-600/90` sur image sportive (`match-card-broadcast.tsx:300`) : OK, mais les versions `bg-white/10` (prématch) doivent vérifier 4.5:1.
- **[S5] Aria-live des badges** — ui-ux-pro-max : les changements de badge (ex. count points) doivent être annoncés **contextuellement** (`role="status" aria-atomic="true"`, message complet), pas un chiffre nu. `LiveScoreAnnouncer` couvre le tennis ; les cartes football/CS2/NBA n'ont pas d'équivalent.

---

## 4. Recommandations & innovations design

### Axe A — Visualisation du match (impact le plus fort)

| **A1. Score Flash « point gagné »** *(P0, tennis + football + NBA)*
Sur changement de score, animer brièvement le bloc score : `scale 1→1.06→1` + glow sport (`box-shadow 0 0 24px color/25%`) pendant 700ms, et flash de couleur du côté du gagnant du point (rose pour B, emerald pour A). Réutilise le flash existant d'`OddChip` (`live-odds-panel.tsx:45-46`) mais appliqué au score. Le score devient le signal visuel n°1 — c'est la fluidité perçue d'un match. **Implémentation MCP** : composant Magic UI `number-ticker` (compteur animé, `useInView`-free, animate-to-target) pour le roll du score + flash local custom (DESIGN.md interdit le digit-roll *continu* ; un tick 300ms à chaque point est OK et c'est précisément ce que `number-ticker` fait).

**A2. Probabilité « vivante »** *(P0)*
Dans `WinProbabilityChart` : marqueur courant `motion.circle` (même pattern que `momentum-dr.tsx:505-513`, r 0→3 + halo) + léger « breath » sur le % du header quand Δprob > 3pts (fade opacity 0.4→1, 400ms). La courbe reste `isAnimationActive={false}` (perf), seul le point courant anime.

**A3. Momentum Timeline unifiée** *(P1, innovation flagship tennis)*
Fusionner `MomentumDR` + `PointTimeline` : une seule bande chronologique du match avec (a) sparkline DR en fond, (b) shade des sets (bandes alternées), (c) markers de breaks (double-dot doré existant) **alignés temporellement** sur la courbe DR, (d) axe « Set 1 · Set 2 · Set 3 ». Lecture causale : « le break à 3-2 a fait basculer le DR de -18 à +22 ». C'est la visualisation la plus différenciante du marché des apps de paris.

**A4. VS circle « point focal »** *(P0)*
Présence : dégradé concentrique sport (`conic-gradient` subtil 60% opacité), `glow` 12px couleur sport à 12% (tokens), taille `clamp()`. Le prématch doit « donner envie de cliquer », pas ressembler à un badge gris.

**A5. xG Sparkline 2.0** *(P1, football)*
Remplissage dégradé cumulatif (emerald/rose → transparent), marqueur du dernier point (cercle blanc ringé, déjà fait pour DR), annotation minute du dernier événement, et **barre de momentum xG** (ΔxG par tranche de 10') en mini-histogramme sous la courbe — remplace avantageusement le donut duo.

**A6. Radar labels directs** *(P1)*
Labels d'axes directement sur le pentagone (`Service`, `Retour`, …) à 10px, le legend disparaît ; la valeur max/min par axe en `tabular-nums`. (Tufte : data-ink ratio.)

**A7. Ambiances sport (fond)** *(P1, innovation identitaire)*
`--bg-deep` reste la base, mais chaque section sport porte un **radial gradient ambiant** très discret (opacité 3-6%, couleur `--sport-*`) derrière le hero et les cartes live — `pointer-events-none`, `fixed/absolute`. Coût ≈ 0 en perf (composé GPU), identité multipliée par 10. **Implémentation MCP** : variantes Magic UI `dot-pattern` / `grid-pattern` / `animated-grid-pattern` (SVG Tailwind, teintés `--sport-*` à 4-8% d'opacité) — plus riche qu'un gradient plat, zéro JS.
Le hero home devient un **bento grid** (ui-ux-pro-max, pattern bento) : 5 tuiles tendance sport + tuile « Live Now » + tuile « Value du jour ». **Implémentation MCP** : composant `bento-grid` (variants `bento-card`, `bento-demo`) — grid 3×3 responsive, prêt pour `density` custom.

### Axe B — Fluidité (motion & transitions)

**B1. Transitions d'onglets** *(P0)*
Généraliser le pattern `mma-tab-content.tsx` (`AnimatePresence mode="popLayout"`, `initial={false}`) aux sous-onglets tennis (Live/Aujourd'hui/Tournois) et au contenu `SportSwipeHeader` : fade 150ms + slide-y 8px. Première impression de fluidité immédiate, aucun risque de jank (mode popLayout = exit avant enter).

**B2. Motion tokens** *(P0)*
Dans `globals.css` :
```css
--motion-fast: 150ms; --motion-med: 300ms; --motion-slow: 500ms;
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1);
```
+ 2 keyframes custom : `pulse-soft` (halo 3s, remplace `animate-ping`) et `glow-pulse` (lueur score). Toutes les durées inline → variables.

**B3. Reduced motion systématique** *(P0)*
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .live-pulse { display: none; }
}
```
+ gate framer-motion : `const reduce = useReducedMotion()` → springs → tween 0.1s.

**B4. LIVE badge calme** *(P0)*
Remplacer `animate-ping` par `pulse-soft` (halo 3s, 30% opacité) + conserver le dot statique. Respecte PRODUCT.md (« calm under pressure ») tout en restant vivant. *Éviter* le `border-beam` Magic UI sur les cartes live permanentes (trop proche du casino) — le réserver à la carte « Match du jour » du hero bento, en rotation lente 8s.

**B5. Live dock sticky (mobile)** *(P1, innovation)*
Sur cartes live en viewport mobile : mini-barre glassmorphique sticky en bas de carte (au lieu de tout replier) — score compact + prob % + bouton « parier ». Motif « glanceable first » (PRODUCT.md §3) poussé à l'extrême : on ne perd jamais la ligne de score en scrollant dans les stats.

**B6. Football → SSE ou 15s** *(P1)*
Étendre le broker SSE tennis (`lib/live-stream-client.ts`) au football, sinon abaisser `refreshInterval` à 15s avec `dedupingInterval` 8s. La « fluidité » est aussi un contrat de fraîcheur.

**B7. Skeleton match-card** *(P1)*
Skeleton dédié (forme carte : avatars + VS + barre proba) avec shimmer `bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40` + `animate-pulse` 1.5s. Remplace le spinner générique.

### Axe C — Système & a11y

**C1. Tokens glass** *(P0)* — migrer `--cf-blur-*/--cf-glass-*` (DESIGN_CHARTER.md) dans `globals.css`/`@theme`, classes `glass-sm/md/lg`, appliquer à header sticky, live dock, modales. *(S1)*
**C2. Focus-visible par sport** *(P0)* — `focus-visible:ring-2 ring-offset-2 ring-[color:sport]` sur cartes, chips, tabs ; passer le checklist ui-ux-pro-max (contraste 4.5, hit areas ≥ 44px pour OddChip/Kelly chip). *(S3)*
**C3. Aria-live contextuel** *(P1)* — étendre `LiveScoreAnnouncer` (tennis) à football/CS2/NBA ; badges live avec `role="status"` message complet (« Point B, 40-15 »), jamais un chiffre nu. *(S5)*
**C4. Taille minimale 11px** *(P1)* — relever les `text-[10px]` à 11px sur mobile, réduire letter-spacing de 0.12em → 0.08em. *(V7)*
**C5. Contraste badges prématch** *(P1)* — vérifier `bg-white/10` à 4.5:1 ; sinon ajouter scrim 20% derrière. *(S4)*

---

## 4bis. Benchmark Awesome DESIGN.md — patterns transférables (ajout 2026-08-19)

**Source** : skill `design-md` (installé le 2026-08-19) — 74 DESIGN.md de marques réelles (miroir [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)). Sélection des 3 marques les plus proches du positionnement PariScore (dark data-dense + accent unique + sport/trading) : **Supabase** (dark emerald), **Shopify** (cinematic dark + neon green), **Binance** (dark trading, métier le plus proche).

| Marque | Pattern marquant | Transfert possible sur PariScore |
|---|---|---|
| **Supabase** (`#3ecf8e` unique) | L'accent vert est le **seul événement chromatique** sur monochrome quasi-total ; display humaniste à tracking négatif (-1.92px @64px) ; la structure vient des **hairlines cool** (#ededed), pas des bordures fortes | ① Confirme l'identité : le vert néon reste l'unique accent chromatique (anti-violet IA, cf. §3 #6) ② `letter-spacing` négatif sur `score-display`/titres ③ hairline `border-border/60` = bonne pratique déjà appliquée |
| **Shopify** (dark cinéma + aloe) | **Polarité de canvas = la marque** : marketing near-black vs transactions cream-mint ; pill CTA unique par écran ; display ultra-léger (weight 330 @96px = confiance par la taille, pas la graisse) | ① Séparer les états **live** (canvas near-black profond) vs **prématch** (surface légèrement plus claire) par polarité ② CTA unique par écran (ex. « Voir les value bets ») ③ scores en Archivo 300-400 + tabular-nums, pas de bold systématique |
| **Binance** (`#FCD535`) | La couleur de marque **ne concurrence jamais le signal directionnel** : jaune = CTA, vert `#0ecb81`/rouge `#f6465d` = prix up/down uniquement ; `number-display` dédié (BinancePlex 40px/700) ; 3 niveaux de surface `#0b0e11/#1e2329/#2b3139` | ① Le vert `#00e676` PariScore est à la fois marque ET signal up — cohérent mais : garder le **rouge live** (`#ff3856`) strictement réservé au signal directionnel ② Les scores = équivalent `number-display` : Archivo 700 `tabular-nums` (déjà en place) ③ Surfaces bg/bg2/bg3 validées (même architecture) |

**Verdict** : l'identité PariScore (dark navy `#0a0e17` + vert néon unique) est **alignée avec les 3 références du marché** les plus proches — pas de rebrand. À emprunter : tracking négatif display (Supabase), polarité canvas live/prématch + CTA unique (Shopify), discipline du signal directionnel (Binance).

---

## 7. MCP UI/UX — capacités vérifiées et mapping

### Serveurs MCP pertinents (`.mcp.json`)

| Serveur | Statut | Rôle UI/UX |
|---|---|---|
| **`magicui`** (`@magicuidesign/mcp`) | ✅ v2.0.0 (handshake OK, tools/list OK) | **Le serveur UI/UX n°1** — registry de composants « magic » |
| **`playwright`** | ✅ configuré | QA visuel : screenshots desktop/mobile 375px, détection débordement (déjà utilisé dans `tests/apk-webview.spec.ts`) |
| **`context7`** | ✅ configuré | Docs à jour recharts/framer-motion/Tailwind v4/shadcn — anti-hallucination API |
| `frontendchecklist` | ⚠️ **plus dans `.mcp.json`** (AGENTS.md obsolète) | Audit a11y/perf/SEO — à réinstaller si voulu |
| `stitch` | ⚠️ **plus dans `.mcp.json`**, skills `stitch-*` absents de `.opencode/skills` | Design → code Google Stitch — retiré du setup |

### Tools `magicui` exposés (vérifiés en direct)

1. `listRegistryItems` — inventaire registry (composant/exemple/style)
2. `getRegistryItem` — détail + **code source** d'un composant
3. `searchRegistryItems` — recherche par cas d'usage

### Composants Magic UI → recommandations de l'audit

| Composant (vérifié registry) | Mapping audit | Usage PariScore |
|---|---|---|
| `number-ticker` | **A1** | Compteur animé du score à chaque point (300ms, tick → pas de roll continu) |
| `bento-grid` (+ `bento-card`) | **A7** | Hero home : 5 tuiles tendance + Live Now + Value du jour |
| `dot-pattern` / `grid-pattern` / `animated-grid-pattern` | **A7** | Ambiances sport par `--sport-*` (SVG, 4-8% opacité, zéro JS) |
| `marquee` | A7 / FeaturedMatchesMarquee | Remplacer le carousel embla du marquee featured (infini, pause au hover, reduced-motion) |
| `border-beam` | **B4** (usage limité) | Carte « Match du jour » du hero uniquement, rotation 8s |
| `animated-beam` | — | Non adapté au live match (réservé data-pipeline si un jour) |
| `flickering-grid` / `interactive-grid-pattern` | — | ❌ rejetés (trop « casino » — viole PRODUCT.md anti-gambling) |

**Règle d'or MCP** : chaque composant est **porté** (code source extrait via `getRegistryItem` → adapté aux tokens PariScore), jamais installé tel quel — les dépendances Magic UI (animations etc.) doivent rester optionnelles et le bundle contrôlé (`bun run build` + analyse). Aucun composant animé en continu sur les cartes live (anti-casino).

---

## 5. Roadmap priorisée

| Priorité | Items | Effort | Impact |
|---|---|---|---|
| **P0 — Quick wins (2-3 j)** | A1 score flash, A2 prob vivante, A4 VS circle, B1 transitions onglets, B2 motion tokens, B3 reduced motion, B4 live badge calme, C1 tokens glass, C2 focus-visible | Faible | +++ |
| **P1 — Semaine 2** | A3 momentum timeline unifiée, A5 xG 2.0, A6 radar labels, A7 ambiances + bento hero, B5 live dock, B6 football 15s/SSE, B7 skeleton, C3 aria-live, C4 11px, C5 contraste | Moyen | ++++ |
| **P2 — Semaine 3-4** | B5 dock (tous sports), transitions pages (layout), A3 export partage (image), charts confidence band live (IC95 en continu) | Élevé | ++ |

**Règle d'or conservée** : tout motion passe par les tokens `--motion-*` + `prefers-reduced-motion` ; aucun `animate-ping` supplémentaire ; le glow ne dépasse jamais 25% d'opacité (anti-casino, « calm under pressure »).

---

## 6. Références

- Design system recommandé ui-ux-pro-max : dark tech `#0F172A`-ish, accent `#22C55E`, glassmorphism 10-20px blur — conforme à l'existant (les deux dialoguent, pas de changement de palette requis).
- Guideline ui-ux-pro-max appliquée : « Contextual Live Badge Updates » (badges live = messages contextuels aria-atomic, pas de chiffres nus).
- Chart guidance : gauge/bullet pour KPI vs cible (MomentumScore → dérivé bullet), line + confidence band pour le live prob (A2/P2).
- Impeccable : mode **Operate** — la sobriété data-first est préservée ; les innovations ci-dessus sont des précisions de hiérarchie visuelle, pas du spectacle.

---

*Note impeccable (contexte) : PRODUCT.md porte encore une section `Register` dépréciée (v4) et n'a pas de section `Platform` alors que le repo embarque `android/build.gradle` — lancer `impeccable init` (ou `doctor`) corrige les deux si souhaité.*

---

## 8. Statut d'implémentation (2026-08-18, vague P0)

### Implémenté et validé

| Item | Fichiers | Détail |
|---|---|---|
| **Motion tokens + keyframes maison** | `src/app/globals.css` | `--motion-fast/med/slow`, `--ease-standard/emphasized` ; keyframes `pulse-soft`, `glow-pulse`, `shimmer`, `aurora-drift`, `grid-pan` |
| **Ambiances sport (dot pattern + aurora)** | `globals.css` + `page.tsx` | Classe `.sport-ambient` teintée par `data-sport` (8 sports) — zéro JS, GPU-composé |
| **Glass system** | `globals.css` | Tokens `--glass-*` + classes `.glass-sm/md/heavy` (alignés DESIGN_CHARTER.md) |
| **Browser surfaces** | `globals.css` | ::selection verte, caret accent, scrollbar custom thumb-transparent |
| **prefers-reduced-motion** | `globals.css` | Gate globale (animations, transitions, scroll-behavior) |
| **Hero bento anti-IA** | `src/app/page.tsx` | Emojis remplacés par icônes lucide (Activity/CircleDot/Swords/Bike/Shield + Star/Timer/Sparkles), tuile tennis `col-span-2`, badge live value, cartouches icône accent |
| **Score Flash (point gagné)** | `score-flash.tsx` (nouveau) + `set-scoreline.tsx` + `current-game-score.tsx` | Composant framer-motion 450ms scale+fade, keyed par score, reduced-motion aware |
| **Probabilité vivante** | `win-probability-chart.tsx` | Dot custom : halo `pulse-soft` 3s sur le dernier point (CSS pur, pas de re-animation recharts) |
| **LIVE badge calme** | 9 fichiers | `animate-ping` remplacé par `scale-150 animate-pulse-soft` partout (tennis, football, cs2, dashboard, mobile-nav, momentum-storyline) |
| **VS circle présence** | `match-card.tsx` | Inset shadow doux ajouté |
| **Skeleton shimmer** | `ui/skeleton.tsx` | Balayage `animate-shimmer` gradient |
| **Transition changement de sport** | `page.tsx` | `motion.div` keyed par `activeTab` (fade 180ms + slide 8px, reduced-motion aware) |
| **Anti emoji-as-icon (craft floor)** | `page.tsx` | Tout le hero + ancres passés en lucide |

### Validation
`bun run typecheck` (src propre) · ESLint 0 erreur · `bun run build` OK · détecteur impeccable `[]` · rendu live : `sport-ambient`, `pulse-soft`, icônes lucide présents, 0 erreur console, pas de débordement horizontal 375px. Captures : `.context/design-check-{desktop,hero,mobile}.png`.

### Session 2026-08-19 (awesome-design-md + P0 ui-ux-pro-max + P1)

| Item | Fichiers | Détail |
|---|---|---|
| **4e source d'audit** | `.context/design-audit-2026-08-18.md` §4bis | Benchmark Supabase / Shopify / Binance (tokens, polarité canvas, signal directionnel) — verdict : pas de rebrand |
| **Gray-on-color ×8** | `BaseballMatchCard.tsx:200,236`, `MLBKBOFolderTab.tsx:87`, `cycling-tab-content.tsx:220`, `f1-driver-card.tsx:117`, `sports-sidebar.tsx:217`, `rugby-tab-content.tsx:171` | Fond translucide → teinte claire du hue ; fond plein → teinte foncée (amber-950/teal-950) ; décision : fixes inline (cas hétérogènes, pas de composant partagé) |
| **MotionConfig reducedMotion** | `motion-config.tsx` (nouveau) + `layout.tsx` | `reducedMotion="user"` global framer-motion — toutes les animations respectent la préférence |
| **animate-bounce → bounce-soft** | `globals.css` + `flashscore-match-list.tsx` | Keyframe maison 4px, 1.2s `--ease-emphasized` (anti-casino, cohérent DESIGN.md) |
| **Violet IA tokenisé** | `AIMatchReport.tsx`, `press-review-panel.tsx` | `violet-*` → token métier `ai-insight` (#A855F7, documenté DESIGN_CHARTER) — le violet IA est intentionnel, pas un « AI slop » |
| **Score Flash football** | `football-live-card.tsx`, `LiveDecisionMomentumWidget.tsx` | `ScoreFlash` déplacé tennis/ → `shared/` (3 imports mis à jour) + intégré aux 2 scores live foot |
| **aria-live football** | `football-live-card.tsx` | `role="status" aria-atomic` — score annoncé en toutes lettres à chaque but (message complet, jamais un chiffre nu) |
| **xG momentum bar** | `football-live-card.tsx` | ΔxG par tranches de 10' (barres emerald/rose autour d'une ligne médiane, tooltips `45'–55' ΔxG +0.42`) |
| **BetSlip live region** | `bet-slip.tsx` | Totaux (mise/gain/profit) en `role="status" aria-live="polite" aria-atomic` |
| **aria-busy skeletons** | `flashscore-match-list.tsx` | `FlashscoreSkeleton` → `role="status" aria-busy` |
| **C4 — 10px → 11px** | 94 fichiers (356 occurrences) | Migration globale scriptée `text-[10px]` → `text-[11px]` (tracking laissé tel quel, V7) |

**Validation session 2** : typecheck — zéro erreur nouvelle (erreurs restantes pré-existantes : nullabilité `live.*`, `indicatorClassName` Progress, `require()` routes basketball, `tools/` hors scope) · ESLint — zéro erreur nouvelle · `bun run build` OK (95s) · CSS généré : `animate-bounce-soft`, keyframes `bounce-soft`, `ai-insight` présents.

### Session 2026-08-19 (passe 2 — web-interface-guidelines + reliquats P1/P2)

| Item | Fichiers | Détail |
|---|---|---|
| **Skill Vercel installé** | `.agents/tools/web-design-guidelines/` + junctions (tools-active/.claude/.cline) | Règles fraîches fetchées avant chaque revue ; rapport : `.context/audits/vercel-web-interface-guidelines-audit-2026-08-19.md` |
| **transition-all → propriétés listées** | `bet-slip.tsx:134`, `football-live-card.tsx:211,216,266,391,394` | `transition` / `transition-[width]` / `transition-[border-color]` (0 `transition-all` restant) |
| **color-scheme + touch + overscroll** | `globals.css` | `color-scheme: dark`, `touch-action: manipulation`, `-webkit-tap-highlight-color`, `overscroll-behavior: contain` sur dialogs |
| **Safe area + aria-current** | `mobile-bottom-nav.tsx` | `pb-[env(safe-area-inset-bottom)]` (classe morte corrigée) ; `role="tab"` → `aria-current="page"` |
| **Skip link + main** | `layout.tsx` | `<a href="#main">` sr-only focus-visible + `<main id="main">` |
| **Form field conventions** | `bet-slip.tsx`, `flashscore-match-list.tsx` | `htmlFor`/`id`/`name`/`autoComplete` ; `type="search"` ; `Rechercher...` → `Rechercher…` |
| **text-wrap balance/pretty** | `globals.css` | `h1-h3 { text-wrap: balance }`, `h4-h6,p { text-wrap: pretty }` (anti-veuves) |
| **A6 — Radar labels directs** | `stats-radar-chart.tsx` | Valeur par axe directement sous le label (player A / A+B), `tabular-nums`, fontSize 10 (data-ink ratio) |
| **C3 — aria-live CS2** | `HLTVMatchSchedule.tsx` | Score maps en toutes lettres (« Score live — A 1 à 2 B ») + score visible `aria-hidden` |
| **B5 — Live dock sticky mobile** | `football-live-card.tsx` | Barre `sticky bottom-0` glassy : score compact + proba home + CTA « Parier » (zéro JS) |
| **A3 — Shade des sets** | `momentum-dr.tsx` | Bandes alternées `muted/5` derrière la sparkline (setDividers existants) — lecture causale set par set |
| **Daltonisme — pictos confidence** | `ReliabilityScore.tsx`, `FootballPressReviewWidget.tsx` | ✓ / ! / ▲ en plus des couleurs (high/mid/low) — jamais couleur seule |
| **OLED PWA** | `globals.css` | `@media (display-mode: standalone) + prefers-color-scheme: dark` → fond `#000` |

**Validation passe 2** : typecheck — zéro erreur nouvelle · ESLint — zéro erreur nouvelle · `bun run build` OK (75s) · CSS compilé vérifié : `color-scheme:dark`, `touch-action:manipulation`, `overscroll-behavior:contain`, `text-wrap:balance`, `safe-area-inset-bottom`, `transition-[width]`.

### Reste à faire (P1/P2 du rapport §5)
- **Football SSE** (B6 — alternative 15s active, SSE pas encore)
- **Heatmap drill-down** : non implémentable avec les données actuelles (cellules = agrégats sport×tournoi, pas de détail par bet) — nécessite une source détaillée
- **cacheTag classements** : sans objet — classements = JSON statiques CDN (SWR), pas de route dynamique
- **Virtualisation flashscore list** (constrat Vercel, non bloquant : < 50 items visibles)
- Composants Magic UI MCP (`number-ticker`, `bento-grid`, `dot-pattern`) — déjà couverts nativement (bounce-soft, sport-ambient, hero bento) ; `number-ticker` écarté : DESIGN.md interdit le digit-roll continu
