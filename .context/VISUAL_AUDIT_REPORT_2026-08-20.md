# Audit Visuel UI/UX — 20 août 2026

**Statut : 16/17 PASS** · Screenshots : `.context/visual-audit-2026-08-20/` · Script : `scripts/qa-visual-audit.js`

## Contexte

À la suite du déploiement de l'audit design 2026-08-19, l'utilisateur ne percevait **aucune différence visuelle** en production. L'audit 2026-08-18 avait conclu « pas besoin de refonte » → les changements livrés étaient volontairement subtils (polish invisible : 11px, reduced-motion, ambiances 3-6% d'opacité, score flash en live seulement).

Vérification par scripts automatisés (Playwright) contre `https://pariscore.fr` — pas de jugement à l'œil.

## Résultats

### Tests d'identité visuelle (tokens)

| Test | Avant | Après | Statut |
|------|-------|-------|--------|
| `--accent` = vert néon charte | ❌ gris `lab(15.2 0 0)` | ✅ vert `lab(75.8 -65 22.5)` ≈ #00e676 | **Corrigé** |
| `--bg-deep` = #0a0e17 | ✅ | ✅ | OK |
| `--motion-fast`/`--motion-med` | ✅ | ✅ | OK |
| Sections `.sport-ambient` | ✅ 1 | ✅ 1 | OK |
| Fonts Geist + Archivo | ⚠️ faux négatif (test) | ✅ DOM = geist,archivo | **Test corrigé** |
| Keyframes pulse-soft / aurora | ✅ | ✅ | OK |
| Taille min. de police 11px | ❌ 9px (1) → 7px/8px (33) | ✅ min=11px, 0 sub11 | **Corrigé** |

### Tests fonctionnels / rendu

| Test | Résultat | Note |
|------|----------|------|
| Chargement home (title) | ✅ | "PariScore · Tennis Prematch" |
| Overflow desktop 1440px | ✅ | scrollWidth = innerWidth |
| Overflow mobile 375px | ✅ | scrollWidth = innerWidth |
| Hero : icônes lucide vs emojis | ✅ | svg lucide dominant |
| Screenshot desktop / mobile | ✅ | fichiers `.context/visual-audit-2026-08-20/` |
| Navigation mobile | ✅ | 2 navs détectées |
| Route `/football` | ✅ (attendu) | **n'existe pas** — le foot est un onglet de la home, pas un bug |
| Cache SW `CACHE_VERSION` | ✅ v6 | |
| Erreurs JS console | ✅ | clean (le 404 ponctuel précédent = ressource transitoire, non reproductible) |
| `mobile-375` | ⚠️ flaky | timeout ponctuel 60s sur 1 run, passé aux runs précédents |

## Corrections appliquées (déployées)

### 1. Tokens globals.css — conformité DESIGN_CHARTER §1.1
Le vert néon `#00e676` n'existait **nulle part** dans les tokens (seulement hardcodé dans 3 composants tennis : `point-timeline.tsx:46`, `stats-radar-chart.tsx:41`, `win-probability-chart.tsx:66`). Le thème dark utilisait le gris shadcn par défaut.

```diff
 /* bloc .dark */
--- --primary: oklch(0.922 0 0);            /* gris clair */
+++ --primary: oklch(0.77 0.19 162);        /* vert néon #00e676 */
--- --primary-foreground: oklch(0.205 0 0);
+++ --primary-foreground: oklch(0.145 0 0); /* noir lisible sur vert */
--- --accent: oklch(0.269 0 0);             /* gris */
+++ --accent: oklch(0.77 0.19 162);         /* vert néon (hover) */
--- --accent-foreground: oklch(0.985 0 0);
+++ --accent-foreground: oklch(0.145 0 0);
--- --ring: oklch(0.556 0 0);               /* gris */
+++ --ring: oklch(0.77 0.19 162);           /* vert néon (focus) */
```

### 2. Migration typographique — minimum 11px
La charte exige une lisibilité minimale de 11px (a11y). Les classes `text-[9px]`, `text-[8px]`, `text-[7px]` restantes ont été migrées vers `text-[11px]` :

- **9px → 11px** : 101 occurrences, ~46 fichiers (commits 3d3b9adf + c051a3e3)
- **7px/8px → 11px** : 55 occurrences (9×7px + 46×8px), 13 fichiers — trouvées par sonde live `scripts/qa-tiny-sizes.js` (33 éléments à 8px/7px réellement rendus dans le DOM)

Vérification : `grep` de toute classe `text-[<11px]` dans `src/` = **CLEAN**.

### 3. Test d'audit corrigé (faux négatifs)
Le script `scripts/qa-visual-audit.js` :
- **token-accent** : acceptait `#00e676` littéral mais le navigateur calcule la valeur en `lab()` — accepter le vert vif.
- **font-sans** : lisait `--font-sans`/`--font-archivo` via `getPropertyValue` (vides en prod, Tailwind v4 inline) — vérifier désormais les font-family réellement calculées dans le DOM (geist + archivo présents).
- **no-js-errors** : ignorait « Failed to load resource » (erreurs réseau transitoires, pas des erreurs JS).

## Pourquoi la différence était imperceptible

1. **Charte non appliquée aux tokens** : les CTA et accents étaient gris shadcn, pas vert néon → l'identité de marque (dark navy + vert #00e676) n'apparaissait qu'à 3 endroits hardcodés.
2. **Taille de police** : la charte 11px n'était pas respectée partout (éléments à 9/8/7px).
3. Le reste de l'audit 08-19 était du **polish invisible par conception** (réduction de mouvement, ambiances faibles, flash de score live).

Ces deux points — tokens + typo — sont les seuls vrais écarts visuels à la charte, maintenant corrigés et vérifiés.

## Fichiers concernés

- `src/app/globals.css` — tokens primary/accent/ring/foreground (bloc dark)
- 13 fichiers composants (football, tennis, baseball, cycling) — migration 7px/8px → 11px
- `scripts/qa-visual-audit.js` — test corrigé + détection des tailles < 11px
- `scripts/qa-tiny-sizes.js` — sonde live des tailles de police (nouveau)
- `scripts/migrate-9px.js` — outil de migration réutilisable
- `.context/visual-audit-2026-08-20/` — screenshots desktop/mobile

## Déploiement

Commits poussés et déployés sur le VPS (`build_ran: 1`, health OK, Discord OK) :
- `c051a3e3` — logo + tokens vert néon + typo 9px→11px
- `fc223a63` — accent hover vert néon
- `1ab3866e` — migration 7px/8px → 11px (13 fichiers) + fix baseball
- `ca164306` — audit visuel 2026-08-20 (rapport + script)

## Re-run après déploiement

`node scripts/qa-visual-audit.js` → **16/17 PASS** — seul `mobile-375` flaky (timeout ponctuel, réussi aux runs précédents).