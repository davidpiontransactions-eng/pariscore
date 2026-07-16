---
name: design-system-unify
description: |
  Workflow orchestré pour l'unification du design system PariScore post-audit Hallmark.
  Exécute pas à pas les 3 phases du plan (réconciliation tokens → nettoyage onglets →
  nettoyage global) avec garde-fous anti-régression (commit atomique par sous-tâche,
  screenshots avant/après via Playwright MCP, re-audit Hallmark après chaque phase).
  Use when: user asks to unify the design system, reconcile tennis tokens, clean up CS2,
  apply Hallmark audit fixes, remove AI-slop tells, standardise cards/eyebrows/fade-up,
  refactor pariscore.html design, "applique Phase X.Y du plan", "unifier le design",
  "réconcilier les tokens", "nettoyer l'onglet X".
  Triggers: "design system", "unifier", "réconcilier tokens", "applique Phase",
  "nettoyer onglet", "standardiser cards", "enlever slop", "redesign pariscore",
  "audit Hallmark fix", "Phase 1", "Phase 2", "Phase 3".

  Requires: pariscore.html (monolithe 1,5 Mo), 2 rapports Hallmark à la racine,
  Playwright MCP pour screenshots, skill `hallmark` installé.
license: MIT
metadata:
  author: pariscore-cto
  version: "1.0.0"
  source: interne (plan todo.md + AUDIT_HALLMARK_PARISCORE_*.md)
---

# design-system-unify — Workflow d'unification du design system PariScore

> **Rôle** : Orchestrer l'exécution du plan d'unification post-audit Hallmark
> en 3 phases, avec garde-fous anti-régression. L'agent suit ce workflow pour
> ne pas casser 25 pages en modifiant le monolithe 1,5 Mo.

## Contexte (obligatoire à lire avant toute exécution)

- **2 rapports source** (lecture intégrale avant de coder) :
  - `AUDIT_HALLMARK_PARISCORE_2026-07-13.md` (home/football, 13 findings)
  - `AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md` (25 pages, 80 findings)
- **Plan d'action ordonné** : `todo.md` section "PRIORITÉ DEMAIN" — 3 phases, 17 sous-tâches
- **Modèle à imiter** : onglet Cycling (`#page-cycling` L22801-22928) — tokens scopés, cards plates, SVG main, zéro slop
- **Contre-modèle** : onglet CS2 (`#page-cs2` L22215-22727) — cyan-green pulse, 5+ side-stripes, double thème
- **Tokens globaux de référence** : `:root` L282-325 (`--bg: #0b0e17`, `--accent: #00e676`, `--font-head: Poppins`, `--font-body: Inter`, `--font-mono: DM Mono`)

## ⚙️ Garde-fous obligatoires (à chaque sous-tâche)

Avant de modifier une seule ligne, ces 5 étapes sont **non-négociables** :

### 1. Snapshot avant (Playwright MCP)
Capturer l'état visuel de la zone modifiée AVANT :
```
playwright_navigate → http://localhost:3000/<onglet>
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-AVANT.png
```
Si le serveur n'est pas démarré : `bun run dev` d'abord (port 3000).

### 2. Commit atomique avant modification
Sur `main` ou branche dédiée (la décision appartient à l'utilisateur) :
```
git add -A
git commit -m "chore(design): baseline avant Phase X.Y — <description>"
```
Si pas de git : créer un backup `pariscore.html.bak.YYYYMMDD-HHMM`.

### 3. Modification ciblée (scope strict)
Une sous-tâche = un type de modif. Ne pas mélanger "je change les tokens" et
"je nettoie les emojis" dans le même passage. Coder la modif minimale.

### 4. Re-audit Hallmark sur la zone modifiée
```
hallmark audit <zone modifiée>
```
Le compte de findings doit **diminuer**. S'il augmente, rollback et re-diagnostiquer.

### 5. Snapshot après + diff visuel
```
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-APRES.png
```
Comparer AVANT vs APRÈS. L'objectif n'est PAS que la page change visuellement de
façon dramatique — c'est qu'elle garde son apparence tout en étant nettoyée.
**Une réconciliation de tokens ne doit PAS changer visuellement la page** ; si
c'est le cas, l'aliasing est mauvais.

### 6. Commit atomique après validation
```
git add -A
git commit -m "refactor(design): Phase X.Y — <sous-tâche>

- <détail 1>
- <détail 2>

Audit Hallmark: <N> → <M> findings (delta -<X>)
Screenshots: .hallmark-baseline/<...>-AVANT/APRES.png"
```

---

## Phase 1 — Réconciliation design system (~5 jours)

### Phase 1.1 — Réconcilier les 4 blocs `:root` du tennis en 1 ⭐ priorité absolue

**Cible** : 4 blocs `:root` indépendants dans la zone tennis :
- `tn2-tennis-redesign` : `:root` L23139-23169 (tokens `--tn2-*`)
- `ps-*` (DATA_PIPELINE_V3) : `:root` L24226-24253 (tokens `--ps-*`)
- `tl-*` (BETMART) : `:root` L24551-24574 (tokens `--tl-*`)
- `sc-tennis-scope-css` : L24955-25373 (déjà partiellement aligné via `var(--bg2)`)

**Procédure** :
1. Lire les 4 blocs `:root` en entier.
2. Pour chaque token scopé (`--tn2-bg`, `--ps-card`, `--tl-accent`…), identifier la variable globale équivalente :
   - `--tn2-bg: #0e1420` → `var(--bg2)` (`#0e121e`)
   - `--tn2-card: #172132` → `var(--bg3)` (`#131722`)
   - `--tl-accent: #0077ff` → `var(--blue)` (déjà défini L299)
   - etc.
3. **Ne pas supprimer les blocs `:root` d'un coup**. Procéder en 4 passes :
   - Passe 1 : aliaser `--tn2-*` vers les globals, vérifier visuellement, commit.
   - Passe 2 : idem pour `--ps-*`.
   - Passe 3 : idem pour `--tl-*`.
   - Passe 4 : supprimer les définitions `:root` maintenant inutilisées (les alias sont dans les globals).
4. Après chaque passe : screenshot tennis AVANT/APRES + re-audit Hallmark.

**Critère de succès** : la page tennis doit visuellement rester identique. Si
un changement apparaît, l'aliasing est mauvais (mauvaise correspondance de
teinte) — ajuster.

**Gain** : cohérence + -300 lignes CSS.

### Phase 1.2 — Définir tokens `--sport-accent` par onglet

**Cible** : ajouter dans le `:root` global (L282-325) :
```css
:root {
  --sport-accent: var(--accent);
  --sport-bg: var(--bg);
  --sport-card: var(--bg2);
}
#page-tennis  { --sport-accent: #ccff00; }  /* jaune balle */
#page-cycling { --sport-accent: #f4d03f; }  /* jaune maillot TdF */
#page-mma     { --sport-accent: #E3001B; --sport-secondary: #D4AF37; }
#page-f1      { --sport-accent: #ff0043; }
#page-cs2     { --sport-accent: #00d4ff; }  /* cyan neon gamer */
#page-nba, #page-wnba { --sport-accent: #ff6b00; }
```

Puis remplacer dans chaque sport les hex inline (`#ff6b00`, `#ff6d2e`, `#ff0043`…)
par `var(--sport-accent)`. C'est le travail le plus volumineux mais le plus
mécanique — grep + remplacement.

### Phase 1.3 — Unifier le système de cards

**Cible** : 6 systèmes distincts → 1 (basé sur `sc-card` / `sc-livecard` tennis,
le plus complet). Déprécier `tn2-match-card`, `tl-card`, `ps-metric-xxl`, `.comp-*`.

**Procédure prudente** : ne PAS tout refaire d'un coup. Pour chaque système
déprécié :
1. Identifier toutes les utilisations (`grep -n "class=\"tn2-match-card" pariscore.html`).
2. Créer la classe équivalente dans le système unifié.
3. Remplacer progressivement (1 occurrence par commit).

### Phase 1.4 — Standardiser les keyframes partagés

**Cible** : `cs2pulse`, `mma-pulse`, `pulse-dot`, `psmSkelShimmer`, `sc-skel` →
1 `@keyframes live-pulse` + 1 `@keyframes skeleton-shimmer` partagés.

### Phase 1.5 — Réconcilier `comparateur`

**Cible** : retirer `.comp-light` / `toggleCompTheme()` (L22066) — seul endroit
du site avec son propre dark/light toggle. Soit réconcilier (supprimer le toggle,
forcer le dark global), soit assumer la divergence en la documentant explicitement.

---

## Phase 2 — Nettoyage Hallmark par onglet (~7 jours)

### Phase 2.1 — Supprimer invented metrics
- "15 AI Tipsters" (L14006 hot-picks) → remplacer par `—` ou sourcer
- "Hit rate estimé ~40%" + "Rentabilité > 100%" (L14029 sure-bets) → idem

### Phase 2.2 — Remplacer emojis-feature-icons par SVG
**Bibliothèque cible** : Lucide (déjà partiellement utilisé via `svgIcon()` L25479).
- CS2 : 10+ emojis (L22675, 22680, 22686-22691, 22722, 22647-22659)
- NBA/WNBA : 🏀🤖 (L22142, 22150, 22209)
- MMA : 💰🔄 (L25386-25387)
- hot-picks : 📊✅👤🔥 (L14004, 14016-14018)
- tennis KPI bar : 🎾💰🏆🌍 (L16096-16113)
- 404 : 🤔 (L25398)

### Phase 2.3 — Désactiver eyebrows décoratifs `.section-label`
~10 pages (L14004, 14027, 14716, 15065, 15293, 15342, 15384, 22052…).
Conserver UNIQUEMENT si ordinal/chapitré.

### Phase 2.4 — Couper fade-up scroll-reveal
24 occurrences home + CS2 (L22673) + tennis (L25368, L23671, L24487).
Garder max 1 orchestrated entrance au premier load.

### Phase 2.5 — Nettoyer CS2 (le plus slop)
- Cyan-green animated pulse borders (L22365-22369, 22512-22516) → border statique + badge typo
- 5+ side-stripes (L22393, 22451, 22576, 22340, 22370/22517) → hairline border
- Double thème (orange dark L22215-22420 + rouge light L22421-22640) → 1 seul thème
- Neumorphism (L22287) → box-shadow simple

### Phase 2.6 — Nettoyer MMA token improvisation
Hex inline partout (L22939, 22957, 22963, 22975-22981, 23003-23009, 23035, 23063, 23077…).
Définir `--mma-accent`, `--mma-gold`, `--mma-bg` scoped.

### Phase 2.7 — transition:all → listes explicites
29 occurrences home + 20 tennis + diffusion transverses.
Remplacer par `transition: background-color .15s, color .15s, border-color .15s`.

---

## Phase 3 — Nettoyage home + systèmes globaux (~3 jours)

### Phase 3.1 — Purge fonts 9 → 3
Supprimer JetBrains Mono, Plus Jakarta, Barlow Condensed, Source Sans 3, Anton,
Rajdhani du `<link>` (L280). Garder Poppins + Inter + DM Mono.

### Phase 3.2 — Glassmorphism 100 → 20 occurrences
Conserver `backdrop-filter` sur : sticky header, modale, popover, dropdown.
Supprimer sur : cards statiques, sections, badges.

### Phase 3.3 — Système d'élévation par luminosité
Remplacer 609 box-shadow (sur dark theme, ombres = glow-template) par :
```css
--elev-0: var(--bg); --elev-1: var(--bg2); --elev-2: var(--bg3);
--elev-3: var(--bg4); --elev-4: #1d2436;
```

### Phase 3.4 — Dédupliquer 468 gradients → 15 utility classes
`.g-bar-green`, `.g-bar-blue`, `.g-bar-red`, `.g-skeleton`, etc.
Cible : `grep -c "gradient"` < 50 (vs 468 actuellement).

### Phase 3.5 — Système z-index nommé à 6 niveaux
```css
--z-base: 0; --z-raised: 10; --z-sticky: 100; --z-dropdown: 1000;
--z-overlay: 2000; --z-modal: 3000; --z-toast: 4000;
```

---

## Comment l'utilisateur pilote ce skill

L'utilisateur n'a pas besoin de détailler chaque étape. Phrases courantes qui
déclenchent le workflow :

| L'utilisateur dit | L'agent exécute |
|---|---|
| "applique Phase 1.1" | Snapshot tennis AVANT + commit baseline + réconciliation tokens en 4 passes + re-audit + snapshot APRÈS + commit |
| "nettoie CS2" | Phase 2.5 complète avec garde-fous |
| "unifier le design" | Demande clarification : "Par quelle phase commencer ? 1.1 (tennis tokens) est recommandé." |
| "vérifie l'onglet tennis après mes modifs" | Re-audit Hallmark + screenshot + diff visuel |
| "rollback Phase X.Y" | `git revert <hash du commit>` ou restaure backup |

## Anti-patterns (à refuser)

- ❌ Modifier plusieurs phases en même temps sans commit intermédiaire.
- ❌ Changer le visuel d'une page pendant une réconciliation de tokens (ça doit être invisible).
- ❌ Supprimer un bloc `:root` scopé sans avoir d'abord aliasé toutes ses références.
- ❌ Embark sur Phase 2 avant d'avoir terminé Phase 1 (le design system doit être stabilisé d'abord).
- ❌ Skip le screenshot APRÈS — c'est ta seule garantie de non-régression sur 25 pages.
- ❌ Remplacer tous les hex par des tokens d'un coup sans test intermédiaire.

## Outils utilisés

- **Skill `hallmark`** — audit + redesign de chaque zone
- **MCP `playwright`** — screenshots avant/après
- **MCP `git`** — commits atomiques (ou shell `git`)
- **MCP `memory`** — stocker l'état d'avancement inter-session

## Fichiers de référence

- `todo.md` section "PRIORITÉ DEMAIN" — plan détaillé avec file:line
- `AUDIT_HALLMARK_PARISCORE_2026-07-13.md` — rapport home/football
- `AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md` — rapport 25 pages
- `.agents/skills/hallmark/references/anti-patterns.md` — liste des tells
- `pariscore.html` — monolithe source (27 784 lignes)

---

*Skill orchestration PariScore — workflow d'unification du design system.*
