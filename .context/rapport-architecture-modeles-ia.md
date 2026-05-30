# Rapport — Architecture Modèles IA PariScore : Backend → Frontend

**Date** : 2026-05-30  
**Objet** : Brainstorming + Audit + QA — intégration complète des 5 modèles IA dans le frontend  
**Auteurs** : QA Agent (ps-test/ps-audit) + Backend Architect + Frontend UX

---

## 1. État des lieux — Ce qui a été construit

### Modèles backend opérationnels

| Modèle | Fichier | API | Sport |
|---|---|---|---|
| **WElo** | `eloCalculator.js` | `/api/v1/tennis/elo/*` | Tennis |
| **Glicko-2** | `glicko2Calculator.js` | `/api/v1/tennis/glicko2/*` | Tennis |
| **K-Flow + SM** | `momentumTennis.js` | `/api/v1/tennis/momentum?matchId=X` | Tennis |
| **Player Momentum** | `playerMomentum.js` | `/api/v1/players/momentum` | Both |
| **Dixon-Coles** | `server.js:computeDixonColes()` | Intégré dans `m.dixonColes` | Foot |

### Ce qui fonctionne (curl vérifié)

```bash
curl /api/v1/tennis/live → glicko2: {p1_serve:1500, ...}, momentum: {kfs_direction:'p1', ...}
curl /api/v1/tennis/glicko2/stats → {serve: {totalPlayers:0}, return: {...}}
curl /api/v1/players/momentum → {top: [...], count: ...}
```

---

## 2. ROOT CAUSE — Pourquoi le frontend n'affiche rien

### Architecture actuelle (cassée)

```
┌──────────────┐     fetch('/tennis/api/v2/matches/live/')
│  Navigateur  │ ──────────────────────────────────────────→ BSD Raw API
│  (frontend)  │     (données brutes, pas d'enrichissement)
└──────────────┘

┌──────────────┐     pollTennisLive()  (toutes les 30s)
│  Serveur     │ ────→ normalize → enrich (glicko2, momentum, odds) → cache
│  (backend)   │     DONNÉES ENRICHIES stockées dans _tennisLiveCache
└──────────────┘
```

**Le frontend NE lit PAS le cache enrichi du serveur.** Il appelle BSD raw directement.

### Problèmes identifiés

| # | Problème | Sévérité | État |
|---|---|---|---|
| 1 | `tickTennisLive()` fetchait BSD raw, pas `/api/v1/tennis/live` enrichi | CRITIQUE | ✅ Fixé (commit c4969ac) |
| 2 | Badges `overflow:hidden` par `.tn-live-cell` | HAUT | Partiel |
| 3 | Taille police 9px + inline-block cassé par flex parent | MOYEN | ✅ Fixé (11px inline-flex) |
| 4 | L'endpoint enrichi était protégé par le plan gate | HAUT | ✅ Fixé |
| 5 | Pas de barre de statut "Modèles actifs" visible | MOYEN | ✅ Fixé |
| 6 | Les modules momentumTennis.js/playerMomentum.js absents du VPS | CRITIQUE | ✅ Transférés |
| 7 | `patchTennisLive()` écrase périodiquement le rendu | HAUT | À fixer |
| 8 | Pas de dashboard dédié pour les modèles | STRATÉGIQUE | À concevoir |

---

## 3. Architecture Proposée — Modèle Frontend Propre

### Principe : Séparation des préoccupations

```
┌─────────────────────────────────────────────────────────┐
│                    PAGE TENNIS                           │
├─────────────────────────────────────────────────────────┤
│ [BARRE MODÈLES] ⬡ Glicko-2:1564 ⚡ Momentum:ON 💰 Odds │
├──────────────────────┬──────────────────────────────────┤
│  TABLEAU LIVE        │  PANEL MODÈLES (sidebar droite)  │
│  (données brutes)    │  - Glicko-2 serve/retour         │
│  Joueurs, scores,    │  - Momentum K-Flow / SM          │
│  sets, statut        │  - Elo rating                    │
│                      │  - Prediction proba              │
│  → Hover sur joueur  │  → Clic sur joueur = détail     │
│    = badge Elo +     │    complet dans le panel        │
│    badge Glicko-2    │                                 │
└──────────────────────┴──────────────────────────────────┘
```

### Données : un seul flux

```
Navigateur → fetch('/api/v1/tennis/live') → données enrichies
           → renderTennisLive(matches)     → tableau
           → _tnUpdateModelsBar(matches)   → barre modèles
           → _tnUpdateSidebar(matches)     → panel détail
```

---

## 4. Plan d'implémentation

### Phase 1 — Déjà fait ✅

- [x] Backend enrichit les matchs avec `glicko2`, `momentum`, `odds_player1/2`
- [x] API `/api/v1/tennis/live` sert les données enrichies
- [x] Barre de statut modèles en haut de page
- [x] Badges Glicko-2 + Momentum dans les cellules joueur

### Phase 2 — Stabilisation (maintenant)

- [ ] **Fix `patchTennisLive`** : ne pas écraser le rendu live avec des données VB sans modèles
- [ ] **Fix `overflow:hidden`** : ajouter `flex-shrink:0` aux badges
- [ ] **Ajouter attributs `data-*`** : `data-glicko-serve`, `data-momentum` sur les rows

### Phase 3 — Panel modèles (prochaine session)

- [ ] **Sidebar droite** : affiche Glicko-2, Momentum, Elo du match sélectionné
- [ ] **Tab "Modèles"** dans le dashboard tennis
- [ ] **Graphiques** : courbe momentum live, évolution Glicko-2

### Phase 4 — Dixon-Coles frontend

- [ ] **Colonne "DC"** dans le tableau foot (Over25/BTTS Dixon-Coles vs Poisson)
- [ ] **Indicateur ρ** (rho) visible dans le comparateur

---

## 5. Quick Fix — Correction immédiate

### Fix 1 : `overflow:hidden` sur les badges

```css
#tennis-live-table .tn-glicko-badge,
#tennis-live-table .tn-mom-badge { 
  flex-shrink: 0 !important;  /* empêche le clip */
}
```

### Fix 2 : `patchTennisLive` protège le rendu live

```js
// Dans patchTennisLive, après avoir patché les cellules :
// Ne pas déclencher renderTennisValueBets si on a des données enrichies
```

### Fix 3 : Ajouter un compteur de modèles dans la barre

```js
// _tnUpdateModelsBar compte combien de matchs ont chaque modèle
```

---

## 6. Recommandations stratégiques

1. **Un seul flux de données** : Le frontend doit utiliser UN SEUL endpoint enrichi par le serveur. Jamais fetch BSD raw directement.

2. **Modèles = citoyens de première classe** : Chaque modèle a son endpoint API, sa colonne/section UI, et sa documentation.

3. **Ne pas lutter contre le CSS existant** : Ajouter les données modèles via `data-*` attributs + hover tooltips plutôt que d'essayer de tout caser dans les cellules existantes.

4. **Dashboard Modèles séparé** : Un onglet dédié "🧠 Modèles IA" qui montre tous les modèles actifs, leurs métriques, et l'historique.

5. **Priorité P0** : Terminer Dixon-Coles frontend (le plus d'impact pour les parieurs foot).

---

## 7. Fichiers concernés

| Fichier | Modifications |
|---|---|
| `server.js` | Déjà enrichi (glicko2, momentum, odds, dixonColes) |
| `pariscore.js` | `renderTennisLive`, `_tnUpdateModelsBar`, `_tnGlickoBadge`, `_tnMomentumBadge` |
| `pariscore.html` | CSS badges, barre modèles, panel sidebar (futur) |
| `glicko2Calculator.js` | ✅ |
| `momentumTennis.js` | ✅ |
| `playerMomentum.js` | ✅ |

---

*Rapport généré par ps-test + ps-audit + brainstorming — 2026-05-30 02:30 UTC*
