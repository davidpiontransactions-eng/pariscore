# Test Report — Wave 1 QA Fixes (strategies-wave1-fixes)
**Date** : 2026-04-30
**Testeur** : Agent QA (audit statique post-fix)
**Fichiers analysés** : `server.js`, `pariscore.html`
**Fixes audités** : W1 (confClass), W2 (openInsightsById guard), W3 (filtre league), W4 (slider minConfidence)

---

## ✅ Tests passés

- **TASK-001 — confClass() adaptatif** : `CONF_THRESHOLDS` défini pour CS_00 {high:25,mid:12}, DRAW {high:35,mid:25}, UNDER_2_5 {high:70,mid:55}, VERROU_TACTIQUE {high:72,mid:58}. Fallback `{ high:75, mid:60 }` pour les autres stratégies. Appel `confClass(m.confidence, key)` correctement mis à jour ✅
- **TASK-002 — Guard openInsightsById()** : Double guard — première tentative de chargement si `allMatches` vide, puis vérification finale avec `console.warn` et `return` si match toujours absent ✅
- **TASK-003 — Filtre league server** : `getTopMatchesByStrategy` accepte `league`, filtre `(m.sport||'').toLowerCase() === leagueFilter`, bornage correct, transmission depuis route `/api/v1/top-strategy` via `query.league` ✅
- **TASK-003 — Dropdown UI** : Éléments `<select id="strat-league-select">` avec 8 options (Toutes + 7 ligues), handler `onStratLeagueChange()`, variable `activeStratLeague` ✅
- **TASK-004 — Slider minConfidence** : `<input type="range" id="strat-conf-slider">`, variable `activeStratConf=50`, handler `onStratConfChange()`, passé dans l'URL fetch ✅
- **Null safety** : `activeStratLeague` et `activeStratConf` initialisés avant tout appel → pas de `undefined` dans l'URL ✅
- **resetStratFilters()** : remet les 3 éléments DOM (select, slider, label) + relance `loadStrategy` ✅
- **URL fetch** : `leagueParam` conditionnel (`activeStratLeague ? ... : ''`) → pas de `&league=` vide en URL ✅
- **node --check server.js** : syntaxe valide ✅
- **BUG-1 (VERROU_TACTIQUE SIM)** : déjà corrigé dans session précédente — vérifié présent ✅

---

## ⚠️ Avertissements (non bloquants)

### W1 — meta.innerHTML "≥ 50%" hardcodé → corrigé en cours de QA
**Localisation** : `pariscore.html` ligne 3403
**Problème** : Le label affichait "confiance ≥ 50%" même quand le slider était à 30% ou 70%.
**Statut** : **Corrigé immédiatement** — affiche désormais `≥ ${activeStratConf}%` + nom de la ligue sélectionnée.

### W2 — ANGLE_CORNERS absent de CONF_THRESHOLDS
**Localisation** : `pariscore.html` — `CONF_THRESHOLDS`
**Observation** : ANGLE_CORNERS utilise `over25` (plage 30-80%) → les seuils par défaut (high:75, mid:60) sont corrects pour ce marché. Pas de correction nécessaire.

### W3 — strategiesPageInitialized non réinitialisé sur resetStratFilters()
**Observation** : Comportement correct — on veut juste re-fetcher, pas recréer les pills. Pas de bug.

---

## ❌ Bugs détectés

Aucun bug bloquant après correction du W1 méta.

---

## 💡 Recommandations roadmap

1. **Ajouter GOLDEN_PPG_GAP dans CONF_THRESHOLDS** si on constate que la plage naturelle de `homeWin`/`awayWin` diffère du marché standard (P2 — observation en prod requise)
2. **SSE delta-only** pour broadcasts live (W5 du rapport précédent) — toujours ouvert en roadmap P2
3. **Double Chance** (DC_HOME 1X / DC_AWAY X2) — Wave 2 prévue
