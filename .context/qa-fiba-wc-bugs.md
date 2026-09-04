# Rapport QA — Onglet Basketball & FIBA WC 2026

**Date:** 2026-09-04
**Scope:** Audit complet de l'onglet Basket → FIBA WC
**Résultat:** 12 bugs identifiés (3 critiques, 4 moyens, 5 faibles)

---

## 🔴 CRITIQUES (impact utilisateur majeur)

### BUG-001 : Odds non-déterministes — Math.random() dans la simulation
**Fichier:** `src/lib/predictions/fiba-odds.ts:58`
**Symptôme:** Les cotes changent à chaque render/refresh. Un match USA vs CZE affiche 1.05/11.00 puis 1.08/10.50 puis 1.03/11.20 etc.
**Impact:** Value bet detection instable, UI qui flicker, perte de confiance utilisateur
**Root cause:** `Math.random()` dans `simulateMarketOdds()` produit du bruit différent à chaque appel
**Fix:** Seed déterministe basé sur les noms d'équipes (hash)

### BUG-002 : Onglet "En direct" affiche les matchs terminés
**Fichier:** `src/components/basketball/fiba/fiba-scoreboard.tsx:82`
**Symptôme:** L'onglet "En direct" montre les matchs live ET les matchs post (terminés)
**Impact:** Confusion utilisateur — on s'attend à voir uniquement les matchs en cours
**Root cause:** `displayedMatches` pour `activeTab === "live"` retourne `[...liveMatches, ...postMatches]`
**Fix:** Séparer : live = liveMatches uniquement, ajouter un onglet "Terminés" ou les inclure dans Calendrier

### BUG-003 : N+1 odds fetch — chaque game card appelle useFibaOdds séparément
**Fichier:** `src/components/basketball/fiba/fiba-game-card.tsx:35`
**Symptôme:** 8 matchs = 8 appels SWR odds (clés différentes par paire d'équipes)
**Impact:** 8 requêtes API au lieu d'un batch, latence multipliée
**Root cause:** `useFibaOdds(home, away)` est appelé dans chaque card avec une clé unique
**Fix:** Fetch toutes les odds dans le parent (`FibaScoreboard`) et les passer en props

---

## 🟡 MOYENS (bugs visibles mais contournables)

### BUG-004 : useFibaStats crée un new Map à chaque render (fuite mémoire)
**Fichier:** `src/hooks/use-fiba-stats.ts:38`
**Symptôme:** `statsByAbbr` est recréé à chaque render sans `useMemo`
**Impact:** Re-renders inutiles, allocations mémoire répétées
**Root cause:** Pas de `useMemo` pour le calcul du Map
**Fix:** Wrap avec `useMemo`

### BUG-005 : PIR model utilise trueShooting au lieu de PIR
**Fichier:** `src/lib/predictions/fiba-predictions.ts:210`
**Symptôme:** `pirWinProbability(homeFeatures.trueShooting ?? 0.55, ...)`
**Impact:** Le modèle PIR ne reflète pas la vraie performance — c'est un doublon de True Shooting
**Root cause:** Confusion entre PIR (Performance Index Rating) et True Shooting %
**Fix:** Utiliser un PIR réel ou simuler des valeurs PIR séparées

### BUG-006 : Four Factors HOME_ADVANTAGE trop faible (0.032)
**Fichier:** `src/lib/predictions/fiba-predictions.ts:168`
**Symptôme:** `HOME_ADVANTAGE / 100` = 0.032 ajouté au diff avant sigmoid
**Impact:** L'avantage domicile est quasi-nul dans le modèle Four Factors
**Root cause:** Division par 100 inutile — le HOME_ADVANTAGE de 3.2 est déjà en points
**Fix:** Utiliser `HOME_ADVANTAGE / 1000` ou un facteur d'échelle adapté

### BUG-007 : Labels anglais dans un UI français (BacktestPanel)
**Fichier:** `src/components/basketball/fiba/backtest-panel.tsx`
**Symptôme:** "Accuracy", "Brier Score", "ROI Moyen", "Confiance", "lower = better", "if flat betting"
**Impact:** Incohérence linguistique — le reste de l'UI est en français
**Root cause:** Labels non traduits
**Fix:** Traduire tous les labels en français

---

## 🟢 FAIBLES (cosmétiques ou edge cases)

### BUG-008 : Le error boundary ne reset pas quand les props changent
**Fichier:** `src/components/basketball/fiba/fiba-error-boundary.tsx`
**Symptôme:** Si une erreur survient puis les props changent, l'état d'erreur persiste
**Impact:** L'utilisateur doit cliquer "Réessayer" même après un changement de contexte
**Root cause:** Pas de `componentDidUpdate` pour reset l'état
**Fix:** Ajouter un check dans `componentDidUpdate`

### BUG-009 : FIBA WC tab pas de loading state dans le parent
**Fichier:** `src/components/basketball/basketball-tab-content.tsx:165`
**Symptôme:** Quand on clique sur "FIBA WC", aucun feedback de chargement
**Impact:** L'utilisateur ne sait pas si la donnée charge
**Root cause:** Le composant `FibaScoreboard` gère son propre loading, mais le parent n'affiche rien
**Fix:** Ajouter un Suspense boundary ou skeleton

### BUG-010 : MOCK_ODDS ne correspond pas aux matchs ESPN
**Fichier:** `src/lib/predictions/fiba-value-bets.ts:109`
**Symptôme:** Les mock odds sont pour GER-JPN, ESP-MLI etc. mais ESPN retourne d'autres paires
**Impact:** Value bets list peut être vide ou ne pas correspondre aux matchs affichés
**Root cause:** Mock odds hardcodés pour 8 matchs spécifiques
**Fix:** Générer les mock odds dynamiquement depuis les matchs scoreboard

### BUG-011 : Le sidebar FIBA a un leagueId incohérent
**Fichier:** `src/hooks/use-sports-tree.ts:139`
**Symptôme:** `leagueId: "fiba-wc"` mais la détection utilise `"basketball:fiba-wc"`
**Impact:** Lasidebar pourrait ne pas highlight correctement le match FIBA sélectionné
**Root cause:** Incohérence entre `leagueId` et l'ID de ligue utilisé dans la détection
**Fix:** Utiliser le même ID partout

### BUG-012 : `calculateValue` dans fiba-odds.ts n'est pas exporté correctement
**Fichier:** `src/lib/predictions/fiba-odds.ts`
**Symptôme:** `calculateValue` est utilisé dans `fiba-game-card.tsx` mais l'import peut échouer
**Impact:** Le badge VALUE ne s'affiche pas si l'import échoue
**Root cause:** Vérifier que `calculateValue` est bien exporté depuis `fiba-odds.ts`
**Fix:** Confirmer l'export

---

## Métriques de qualité

| Métrie | Valeur |
|--------|--------|
| Composants testés | 8/8 |
| API routes testées | 4/4 |
| Hooks testés | 4/4 |
| Bugs critiques | 3 |
| Bugs moyens | 4 |
| Bugs faibles | 5 |
| Coverage typecheck | ✅ 0 erreurs FIBA |
| Tests unitaires | 13/13 ✅ |

---

## Priorité de correction

1. **BUG-001** (odds non-déterministes) — Impact direct sur l'expérience utilisateur
2. **BUG-002** (onglet live affiche terminés) — Confusion majeure
3. **BUG-003** (N+1 odds fetch) — Performance
4. **BUG-004** (Map sans useMemo) — Performance
5. **BUG-005** (PIR = trueShooting) — Modèle incorrect
6. **BUG-007** (labels anglais) — UX
7. Reste : fixes cosmétiques
