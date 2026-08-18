# Prompt — Améliorations onglet Baseball (chips prédictions & UX)

## Contexte

Check visuel réalisé le 2026-08-14 sur `https://pariscore.fr` (onglet Baseball, prod) après le fix
« verrou statsAvailable supprimé » (`6e1b7a72`). État actuel :

- Les cards affichent 3 chips quand `match.quick` est présent : **O/U {line} · Over {pct}**,
  **Total {x} attendu**, **✓ Over/Under · conf {pct}** (ou « Sous seuil 65 % »).
- Le winner (moneyline) n'apparaît **que dans la modal** « Analyse complète » (section
  « Vainqueur du match (Moneyline 1-2) »).
- Aucun `predictionBlockedReason` n'est plus affiché quand les stats de saison des partants
  sont absentes (le moteur retombe sur les moyennes de ligue — repli bayésien, aucun NaN,
  vérifié par `scripts/verify-baseball-quick-fix.ts`).
- Erreur console observée : `Failed to load resource: 404` (1 occurrence — ressource non
  identifiée, probablement favicon/asset).

Fichiers clés :
- `src/components/baseball/BaseballMatchCard.tsx` (chips, pied de carte)
- `src/components/baseball/BaseballMatchAnalysisModal.tsx` (modal détaillée)
- `src/components/baseball/baseball-tab-content.tsx` (onglet)
- `src/lib/baseball/data/provider.ts` (pipeline, quick + detail)
- `src/lib/baseball/types.ts` (contrats)

## Objectifs

Améliorer l'onglet Baseball à partir des observations du check visuel, **sans casser** le
pipeline existant (quick = prédiction légère dès les 2 partants annoncés, même sans stats
de saison).

## Tâches (par ordre d'impact)

### 1. Badge « Winner » sur la card (transparence du favori)
`BaseballMatchCard.tsx` : le `quick` contient `moneyline` ? **Vérifier d'abord** le type
`QuickPrediction` dans `src/lib/baseball/types.ts` — si `moneyline.homeProb` n'est pas dans
le quick, l'ajouter dans `computeQuickForMatch` (`provider.ts`) avec les mêmes itérations
rapides. Puis afficher un 4e chip compact : `Winner {Home/away city} · {pct}` avec le même
style que les chips O/U. **Ne jamais** afficher si les probas sont < 51 % (pas de favori
net).

### 2. Transparence « repli moyennes de ligue » (partants sans stats)
Quand `homePitcher.statsAvailable === false` (ou away), la card doit signaler honnêtement
que la prédiction utilise le repli bayésien : petit badge `repli ligue` dans le duel de
lanceurs (zone `PitcherBadge`), avec `title`/tooltip « Stats saison absentes — moyennes de
ligue utilisées ». Inspecter `PitcherBadge.tsx` : il affiche déjà « — » pour les stats
null ; ajouter le badge sans surcharger.

### 3. Symétrie O/U sur le chip (Over + Under)
Le chip actuel n'affiche que `Over {pct}`. Compléter : `Over {pct} · Under {pct2}` (ou
« Under » quand `overProb < 0.5` est mis en avant). La card est en `flex-wrap` — tester le
rendu mobile 360 px (aucun débordement horizontal).

### 4. Outil de calibration : prédiction vs résultat (innovation forte)
Ajouter dans la modal un bloc « Calibration » : quand `game.status === "final"`, afficher
la prédiction passée (cachée dans `predictionCache` de `provider.ts` — la persister via un
champ `finalResult` sur la prédiction au moment du passage final, ou re-jouer le hash) vs
le score réel : O/U gagné/perdu, moneyline gagnée/perdue. Objectif : construire la
confiance utilisateur (le site prédit, on vérifie).

### 5. Refresh live des cotes en cours de match
`baseball-tab-content.tsx` : vérifier l'intervalle de refetch existant (SWR/React Query).
Si les matchs `live` ne refetch pas la prédiction à chaque inning, ajouter un refetch
accéléré (30-60 s) pour les matchs `status === "live"` uniquement.

### 6. Accessibilité des chips
Les chips sont des `<span>` non-focusables : les transformer en éléments avec
`aria-label` descriptif (ex. « Ligne Over/Under 7.0, Over à 32,8 % »), `role="status"`
pour le chip recommandation (annonce AT des mises à jour live). Vérifier le contraste
`amber-300`/`emerald-400` sur fond `slate-800/70` (WCAG AA).

### 7. Identifier le 404 console
Reproduire avec DevTools (Playwright `page.on("response")` filtrant status 404) sur
l'onglet Baseball, corriger la ressource manquante (favicon, image logo, asset), ou
documenter si elle vient d'un provider tiers.

## Garde-fous

- Ne pas modifier `src/lib/baseball/engine/baseball-predictive-engine.ts` (moteur stable,
  tests verts 5/5).
- `quick` doit rester **léger** (QUICK_ITERATIONS) — ne pas y déplacer des calculs lourds.
- Tout champ ajouté aux types doit être **optionnel** ou initialisé (compat cache existant,
  hash `predictionInputHash` inchangé).
- Commentaires FR, camelCase, CRLF (utiliser node pour éditer les fichiers, pas les outils
  d'édition directs qui cassent sur les accents/CRLF).
- Ne pas toucher au design system (tokens, charte) — réutiliser les classes existantes.

## Validation

1. `node --check` sur les fichiers modifiés.
2. `npx tsc --noEmit` → 0 erreur hors `.next/dev/types` (préexistant).
3. `npx eslint src/components/baseball src/lib/baseball/data/provider.ts` → 0 erreur.
4. `node scripts/run-bun.js test src/lib/baseball` → 5 pass / 0 fail.
5. `node scripts/verify-baseball-quick-fix.ts` → 6/6 PASS.
6. Check visuel Playwright (réutiliser `scripts/check-baseball-chips.mjs` + adapter) :
   chips O/U + Winner visibles, badge repli ligue présent sur un match à partants
   rookie/sans stats, pas de débordement horizontal à 360 px, modal complète.
7. Screenshots avant/après dans `baseball-*.png` à la racine (pattern existant).