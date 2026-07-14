# PariScore — Todo / Follow-ups

## 🔴 PRIORITÉ DEMAIN (2026-07-14) — Unification du design system (post-audit Hallmark)

> ⚠️ **LIRE D'ABORD : `REDESIGN_WORKFLOW_OPENCODE.md`** — workflow complet avec Gantt,
> dépendances, chemin critique, protocole git/VPS strict, indicateurs de succès.
> Ce fichier (`todo.md`) reste la référence pour le détail des tâches (file:line).

### 📖 À lire avant de coder (ordre conseillé)

**1. Les 2 rapports d'audit (lecture intégrale obligatoire)**
- `AUDIT_HALLMARK_PARISCORE_2026-07-13.md` — audit home/football (13 findings, 5 critical)
- `AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md` — audit 25 pages (80 findings consolidés)

**2. Zones du code source à modifier (pariscore.html, 27 784 lignes)**
- **Home / global tokens** : `:root` principal L282-325 (palette BETMART, fonts Poppins/Inter/DM Mono)
- **Fonts `<link>`** : L278-280 (9 polices → réduire à 3)
- **Tennis — blocs à fusionner** :
  - `tn2-tennis-redesign` : L23134-24519 (bloc `:root` L23139-23169)
  - `ps-*` (DATA_PIPELINE_V3) : L24222-24519 (bloc `:root` L24226-24253)
  - `tl-*` (BETMART) : L24551-24953 (bloc `:root` L24551-24574)
  - `sc-tennis-scope-css` : L24955-25373 (déjà partiellement aligné, à étendre)
- **CS2 (le plus slop)** : L22215-22727 (cyan-green pulse L22365-22369, 5+ side-stripes, double thème L22215 dark + L22421 light L'Équipe)
- **MMA (token improvisation)** : L22929-23132 (hex inline partout) + body L25376-25392
- **F1** : L22734-22800 (tokens scopés `--f1-*` propres, neumorphism lourd L22751)
- **Cycling (MODÈLE à imiter)** : L22801-22928 (tokens `--cyc-*`, cards plates, SVG main)
- **NBA/WNBA** : L22118-22173 / L22178-22213 (WNBA = alias NBA)
- **Comparateur (fragmentation)** : L22049-22109 (`.comp-*` + `toggleCompTheme()` L22066)
- **Pages transverses slop** :
  - hot-picks : L14002-14022 ("15 AI Tipsters" inventé L14006, emojis 📊✅👤🔥 L14016-14018)
  - sure-bets : L14025-14042 ("hit rate ~40%" inventé L14029)
  - tarifs : L20553-20567 + renderer `pariscore.app.js` L26631-26653 (hero centré L20556, grille 4 col L8243, badge "POPULAIRE")
- **Eyebrows `.section-label`** (à désactiver) : ~10 pages (L14004, 14027, 14716, 15065, 15293, 15342, 15384, 22052…)
- **fade-up scroll-reveal** (à couper) : 24 occurrences home + CS2 L22673 + tennis L25368/L23671/L24487

**3. Code source dynamique**
- `pariscore.app.js` (1,8 Mo) — logique des pages, notamment `page-tarifs` renderer L26631-26653

**4. Références Hallmark (skill installé)**
- `.agents/skills/hallmark/SKILL.md` — protocole complet (design flow, slop-test, disciplines)
- `.agents/skills/hallmark/references/anti-patterns.md` — **liste nommée des tells** (critical/major/minor) avec fix pour chacun
- `.agents/skills/hallmark/references/verbs/audit.md` — format audit
- `.agents/skills/hallmark/references/verbs/redesign.md` — à consulter avant refonte (safety rails)
- `.agents/skills/hallmark/references/color.md` — recettes OKLCH, accent discipline
- `.agents/skills/hallmark/references/typography.md` — pairings, scales, hero headline sizing
- `.agents/skills/hallmark/references/motion.md` — durées, easings, reduced-motion
- `.agents/skills/hallmark/references/slop-test.md` — les 58 gates à vérifier avant merge

**5. Documentation projet connexe**
- `CLAUDE.md` — roadmap complète, version history
- `CHANGELOG.md` — historique détaillé par version
- `ARCHITECTURE.md` / `ARCHITECTURE-DIAGRAMS.md` — structure actuelle
- `.agents/skills/system-design/SKILL.md` — principes scalabilité (skill ajouté 2026-07-13)
- `docs/system-design-primer/README.md` — ressource de référence (clone local)

**6. Contexte migration Next.js (opportunité d'application)**
- `package.json` — stack Next.js 16 + Bun + React 19 + Prisma
- `tailwind.config.ts` — config Tailwind 4 (cible pour tokens centralisés)
- `prisma/schema.prisma` — schéma DB
- `app/` — routes Next.js en cours de migration (cible pour `app/(sports)/<sport>/page.tsx`)

**Méthode recommandée** : ouvrir les 2 rapports Hallmark en côte-à-côte avec le code source, puis attaquer Phase 1.1 (réconciliation tennis) — quick win au meilleur ratio effort/impact.

### 🤖 Skills & MCP à utiliser pour automatiser le chantier

**3 skills orchestration (déjà installés pour ZCode + OpenCode)** :

| Skill | Rôle | Invocation typique |
|---|---|---|
| `design-system-unify` | **Workflow orchestré** — exécute les 3 phases du plan avec garde-fous (snapshot avant → commit → modif → re-audit → snapshot après → commit) | "applique Phase 1.1" · "nettoie CS2" · "unifier le design" |
| `visual-regression` | **Screenshots avant/après** via Playwright MCP (déjà installé). Pas besoin de Chromatic — overkill sans Storybook. | "capture tennis avant modifs" · "compare les visuels" |
| `hallmark` | **Audit + redesign** de chaque zone. `audit` pour re-vérifier après modifs (le compte de findings doit diminuer). | "audit pariscore.fr" · "redesign l'onglet tennis" |

**MCP déjà configurés dans `.mcp.json`** :

| MCP | Rôle pour le chantier |
|---|---|
| `playwright` (Microsoft) | Captures avant/après — voir skill `visual-regression` pour la convention de nommage |
| `frontendchecklist` | Audit a11y + perf + SEO après chaque changement de tokens |
| `git` | Commits atomiques (1 commit = 1 sous-tâche) |
| `memory` | Stocker l'état d'avancement inter-session (quelle phase commencée, quels onglets faits) |

### Automation & Outils ajoutés cette session

- **Ray 2.56.0** installé (`pip install ray`) — fonctionne sous Windows, init ~7s
- **`scripts/ray-design-unify.py`** (338 lignes) — automate Ray pour unifier le design system :
  - `scan` : liste toutes les valeurs hex inline dans les blocs `<style>` de chaque sport
  - `analyze` : compare hex vs tokens, catégorise (match/mismatch/pending)
  - `replace` : remplace les hex identifiés par `var(--sport-accent)` — **⚠️ ATTENTION** : 14 hex restants après `analyze` sont des déclarations intentionnelles (pas de correspondance directe avec un token)
  - `validate` : vérifie que tous les hex remplaçables sont traités
- **MCP agentmemory** ajouté (commit `7fae0ca`) — connaissances persistantes inter-sessions
- **Blocké** : vLLM (pas de wheel Windows, build from source timeout 300s, GTX 1050 4Go VRAM insuffisante)

**À NE PAS installer (incompatibles avec le monolithe actuel)** :
- ❌ Chromatic MCP → nécessite Storybook + composants React isolés. Devient pertinent **après** migration Next.js.
- ❌ 21st.dev Magic MCP → génère du React/shadcn. Idem, après migration.
- ❌ Figma MCP → pertinent seulement si tu as des maquettes Figma à extraire.

**Workflow type pour demain** :
```
1. "applique Phase 1.1" → design-system-unify orchestre :
   - skill visual-regression : capture tennis AVANT
   - git : commit baseline
   - skill hallmark : aliaser --tn2-* vers les globals (passe 1/4)
   - skill visual-regression : capture tennis APRÈS
   - skill hallmark : audit → vérifier que le compte baisse
   - git : commit atomique
   - (répéter pour passes 2, 3, 4)
2. "compare les visuels tennis" → visual-regression affiche AVANT vs APRÈS
3. "passe à 1.2" → design-system-unify enchaîne
```

**Diagnostic clé des 2 rapports :**
Le projet n'est pas un AI-slop générique, mais sa **fragmentation structurelle**
empêche l'identité de la home de s'étendre aux autres onglets. Le tennis est
**4 fois redéveloppé** (4 blocs `:root` indépendants : `tn2`/`ps`/`tl`/`sc`).
L'identité chromatique par sport est **largement illusoire** (5/6 sports en
rouge/orange interchangeable). Le comparateur a son **propre design system +
toggle dark/light**. Cycling est le modèle de propreté à suivre.

### Plan d'action ordonné (Quick wins first — ~15 jours total)

#### Phase 1 — Réconciliation design system (priorité absolue, ~5 j)

- [x] **1.1 Réconcilier les 4 blocs `:root` du tennis en 1** — ✅ FAIT (2026-07-14)
  - Passe 1 : 18/31 `--tn2-*` aliasés → globaux (`a730fa3`)
  - Passe 2 : 18/25 `--ps-*` aliasés → globaux (`ac174c8`)
  - Passe 3 : 19/22 `--tl-*` aliasés → globaux (`7adab5e`)
  - Validation visuelle : `match: true`, `mismatchPercentage: 0.0` (`b8e4c4e`)
  - Bloc `sc-*` déjà 100% aligné (pas de `:root` dédié)
  - **Gain** : ~60 tokens supprimés, zéro régression visuelle

- [~] **1.2 Définir tokens `--sport-accent` par onglet** — 🟡 EN COURS (2026-07-14)
  - ✅ Tokens ajoutés dans `:root` global + `#page-*` selecteurs (commit `3062a64`)
  - ✅ NBA/WNBA : 6x `#ff6b00` → `var(--sport-accent)` safe alias (commit `4174e66`)
  - ✅ Tennis/F1 : remplacement `#ff6d2e`/`#ff0043` → `var(--sport-accent)` (color change)
  - ✅ Script `scripts/ray-design-unify.py` : Ray scan/analyze/replace/validate (7 workers/sport)
  - ⏳ CS2 : `#E3001B` → `var(--sport-accent)` (color change rouge→cyan `#00d4ff`)
  - ⏳ MMA : `#E3001B` → `var(--sport-accent)` (même rouge que CS2)
  - ⏳ Validation visuelle APRES vs baseline

- [ ] **1.3 Unifier le système de cards** — 1 j
  - Choisir UN système (le plus complet = `sc-card`/`sc-livecard` tennis)
  - Déprécier `tn2-match-card`, `tl-card`, `ps-metric-xxl`, `.comp-*`

- [ ] **1.4 Standardiser les keyframes partagés** — 0.5 j
  - 1 `@keyframes live-pulse` (remplace `cs2pulse`, `mma-pulse`, `pulse-dot`)
  - 1 `@keyframes skeleton-shimmer` (remplace `psmSkelShimmer`, `sc-skel`, etc.)

- [ ] **1.5 Réconcilier `comparateur`** (retirer `.comp-light`/toggle thème) — 0.5 j
  - `toggleCompTheme()` (L22066) = seul endroit du site avec son propre dark/light toggle

#### Phase 2 — Nettoyage Hallmark par onglet (~7 j)

- [ ] **2.1 Supprimer invented metrics** — 0.5 j
  - "15 AI Tipsters" (L14006 hot-picks) — personas, pas 15 agents réels
  - "Hit rate estimé ~40%" + "Rentabilité > 100%" (L14029 sure-bets) — non sourcés
  - Soit sourcer via backtest, soit remplacer par `—` + bloc neutre

- [ ] **2.2 Remplacer emojis-feature-icons par SVG** — 2 j
  - CS2 : 10+ emojis (L22675, 22680, 22686-22691, 22722, 22647-22659)
  - NBA/WNBA : 🏀🤖 (L22142, 22150, 22209)
  - MMA : 💰🔄 (L25386-25387)
  - hot-picks : 📊✅👤🔥 (L14004, 14016-14018)
  - tennis KPI bar : 🎾💰🏆🌍 (L16096-16113)
  - 404 : 🤔 (L25398)
  - **Bibliothèque cible** : Lucide (déjà partiellement utilisé via `svgIcon()` L25479)

- [ ] **2.3 Désactiver eyebrows décoratifs `.section-label`** — 0.5 j
  - Présent sur ~10 pages (L14004, 14027, 14716, 15065, 15293, 15342, 15384, 22052…)
  - Hallmark : eyebrows "default OFF", seulement si ordinal/chapitré

- [ ] **2.4 Couper fade-up scroll-reveal** — 0.5 j
  - 24 occurrences home + CS2 (L22673) + tennis (L25368 sc-fade, L23671, L24487)
  - Garder max 1 orchestrated entrance au premier load

- [ ] **2.5 Nettoyer CS2 (le plus slop)** — 2 j
  - Cyan-green animated pulse borders (L22365-22369, 22512-22516) → border statique + badge typo
  - 5+ side-stripes (L22393, 22451, 22576, 22340, 22370/22517) → hairline border
  - Double thème (orange dark L22215-22420 + rouge L'Équipe light L22421-22640) → 1 seul thème
  - Neumorphism (L22287) → box-shadow simple

- [ ] **2.6 Nettoyer MMA token improvisation** — 1 j
  - Hex inline partout (L22939, 22957, 22963, 22975-22981, 23003-23009, 23035, 23063, 23077…)
  - Définir `--mma-accent`, `--mma-gold`, `--mma-bg` scoped

- [ ] **2.7 transition:all → listes explicites** — 1 j
  - 29 occurrences home + 20 tennis + diffusion transverses
  - Remplacer par `transition: background-color .15s, color .15s, border-color .15s`

#### Phase 3 — Nettoyage home + systèmes globaux (~3 j)

- [ ] **3.1 Purge fonts 9 → 3** — 0.5 j
  - Garder Poppins + Inter + DM Mono (L318-320)
  - Supprimer JetBrains Mono, Plus Jakarta, Barlow Condensed, Source Sans 3, Anton, Rajdhani du `<link>` (L280)
  - **Gain** : -700 Ko fonts, LCP -200ms

- [ ] **3.2 Glassmorphism 100 → 20 occurrences** — 1 j
  - Conserver backdrop-filter sur : sticky header, modale, popover, dropdown
  - Supprimer sur : cards statiques, sections, badges

- [ ] **3.3 Système d'élévation par luminosité** — 1 j
  - Remplacer 609 box-shadow (sur dark theme, ombres = glow-template)
  ```css
  --elev-0: var(--bg); --elev-1: var(--bg2); --elev-2: var(--bg3);
  --elev-3: var(--bg4); --elev-4: #1d2436;
  ```

- [ ] **3.4 Dédupliquer 468 gradients → 15 utility classes** — 0.5 j
  - `.g-bar-green`, `.g-bar-blue`, `.g-bar-red`, `.g-skeleton`, etc.
  - Cible : `grep -c "gradient"` < 50 (vs 468 actuellement)

- [ ] **3.5 Système z-index nommé à 6 niveaux** — 0.5 j
  ```css
  --z-base: 0; --z-raised: 10; --z-sticky: 100; --z-dropdown: 1000;
  --z-overlay: 2000; --z-modal: 3000; --z-toast: 4000;
  ```

### Note stratégique

**La migration Next.js 16 en cours est l'opportunité exacte** pour appliquer ces
principes : chaque route migrée vers `app/(sports)/<sport>/page.tsx` doit hériter
du design system centralisé (shadcn/ui + Tailwind 4 + tokens `--sport-accent`)
et appliquer les principes **Cycling** (cards plates, SVG main, zéro fade-up,
zéro glassmorphism décoratif). Quand la migration sera avancée, demander à
Hallmark `lock the system` pour générer un `design.md` portable empêchant la
dérive future.

**Référence modèle** : onglet Cycling (`#page-cycling`) — le plus propre, à imiter.
**Référence contre-modèle** : onglet CS2 (`#page-cs2`) — le plus slop, à refondre.

---

## Tennis sidebar toggle (style 1xbet)

**Status:** Rollbacké le 2026-07-11 — à refaire proprement dans une session dédiée.

**Contexte:**
- Demande initiale : ajouter un bouton pour masquer/afficher la sidebar de l'onglet Tennis, comme le font 1xbet et les sites de paris concurrents.
- Tentatives faites : bouton flottant, toggle dans header, renommage de `pariscore.js` en `pariscore.app.js`, désactivation temporaire du Service Worker.
- Problèmes rencontrés : cache stale, Service Worker conflictuel, états désynchronisés, mise en page cassée.
- Décision : rollback complet le 2026-07-11 pour restaurer la stabilité. La sidebar tennis est de nouveau toujours visible sur desktop.

**Prochaines étapes:**
1. Benchmark des patterns d'UX chez 1xbet, Betclic, Winamax, etc. (toggle d'affichage de blocs, comportement desktop/mobile, gestion du cache).
2. Définir la spec exacte : position du bouton, états collapsed/expanded, transitions, responsive, accessibilité.
3. Maquetter la solution sans impacter la stabilité (branche/feature séparée si possible).
4. Implémenter le toggle en s'appuyant sur une classe CSS unique et un état JS simple.
5. Tests visuels et fonctionnels avant merge/déploiement.
6. Réactiver proprement le Service Worker ou le remplacer par une stratégie de cache sans risque de stale UI.

**Files concernés (historique):**
- `pariscore.html` : markup + CSS de la sidebar tennis.
- `pariscore.app.js` : logique `_psToggleTennisSidebar`, `showPage('tennis')`.
- `sw.js` : gestion du cache shell (désactivé côté client le 2026-07-11).
- `server.js` : headers `Cache-Control` et `Clear-Site-Data`.

**Notes:**
- Ne pas redéployer de toggle sans avoir testé tous les cas : desktop ouvert/fermé, mobile, navigation SPA, refresh, hard-refresh, retour depuis une autre page.
- Prévoir un mécanisme de cache-busting robuste (fichiers versionnés ou hashed) si le Service Worker est réactivé.

## Session 2026-07-12 — BSD API + FlareSolverr BetWatch

**Fait :**
- [x] `BSD_API_KEY` mis à jour dans `.env` et serveur legacy redémarré.
- [x] `FLARESOLVERR_URL=http://localhost:8191` configuré dans `.env`.
- [x] FlareSolverr v3.5.0 installé et démarré sur `localhost:8191`.
- [x] `tools/start-flaresolverr.cmd` créé pour redémarrer facilement le proxy.
- [x] `scrape-betwatch-wom.js` fonctionne : football ~15 marchés / ~9-10 WOM, tennis paywallé (attendu).

**Bloqué / À suivre :**
- [ ] WebSocket BSD retourne `subscription_required` — la clé API est valide mais l'abonnement WebSocket BSD ($3/mois) n'est pas actif. Sans ça, le push live <5s est désactivé (BSD reste en polling).
- [ ] `ODDS_API_KEY` manquante dans `.env` → warning au boot, certaines cotes/providers peuvent être indisponibles.
- [ ] Clés IA manquantes (`GEMINI_API_KEY` / `GROQ_API_KEY` / `XAI_API_KEY` / `OPENROUTER_API_KEY`) → analyses IA désactivées.

**Prochaines sessions possibles :**
- Fournir/régler l'abonnement WebSocket BSD.
- Renseigner `ODDS_API_KEY` et les clés IA manquantes.
- Reprendre le ticket beads `ParisScorebis-phlf` (Premier Card — in_progress).
- Traiter les tickets beads ouverts : `ParisScorebis-ufh6` (mobile responsive tennis), `ParisScorebis-k684` (teaser value bets freemium), `ParisScorebis-10kj` (SSE push live tennis).
