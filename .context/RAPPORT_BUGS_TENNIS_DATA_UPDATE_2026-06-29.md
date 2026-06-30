# Rapport d'Audit — Bugs Mise à Jour Données Onglet Tennis
## PariScore · 29 Juin 2026

---

## DIAGNOSTIC PRINCIPAL

**Cause racine : Décalage architectural entre le système legacy `tn2SwitchTab` et le système TennisScope `sc-*`.**

L'HTML a été refactorisé pour utiliser le système TennisScope (classes `sc-panel`, `sc-tab-btn`, IDs `sc-panel-prematch|live|valuebets|analytics`), mais `showPage` et `tn2SwitchTab` n'ont jamais été mis à jour. Toutes les fonctions legacy ciblent des éléments DOM qui **n'existent plus**. Résultat : la majorité du code de mise à jour est du code mort qui échoue silencieusement.

**Seul TennisScope fonctionne** — il s'initialise indépendamment à DOMContentLoaded et fetch via `/api/v1/tennis/value-bets`.

---

## BUGS CRITIQUES (P0) — Données non mises à jour

### D1 — `showPage('tennis')` appelle `tn2SwitchTab('matchs')` → NO-OP complet
- **Fichier**: `pariscore.js:930`
- **Détail**: `tn2SwitchTab` recherche `.tn2-tab-panel[data-tab="matchs"]` et `.tn2-tab-btn[data-tab="matchs"]`. Ces éléments n'existent pas. Les IDs réels sont `sc-panel-prematch` avec `data-tab="prematch"`.
- **Impact**: Aucune des fonctions de chargement legacy n'est jamais appelée (`loadTexMatchs`, `startTennisValueBets`, `startTennisTop10`, `tn2LoadRankings`). Le tab 'matchs' n'existe pas dans le nouveau système.
- **Statut**: Code mort total.

### D2 — `startTennisLive()` + `renderTennisLive()` ciblent `tennis-live-tbody` (inexistant)
- **Fichier**: `pariscore.js:2219-2358`
- **Détail**: `renderTennisLive()` vérifie `document.getElementById('tennis-live-tbody')` et return immédiatement. Le polling `/api/v1/tennis/live` tourne toutes les 30s mais ne rend jamais rien.
- **Impact**: Matchs live jamais affichés via le système legacy. Gaspillage réseau.

### D3 — `tickTennisValueBets()` + `renderTennisValueBets()` ciblent `tennis-vb-tbody` (inexistant)
- **Fichier**: `pariscore.js:4382-4463`
- **Détail**: Même pattern — les IDs cibles n'existent pas dans le HTML.
- **Impact**: Value bets legacy jamais rendues.

### D4 — `TennisLive.init()` jamais appelé (conteneur `tennis-live-section` inexistant)
- **Fichier**: `pariscore.html:24818-24834`, `tennis-live.js:846`
- **Détail**: `initTennisLive()` vérifie `document.getElementById('tennis-live-section')` → null → module 908 lignes jamais initialisé.
- **Impact**: Le module TennisLive complet (DR, Hold%, sparklines, BPPI, Glicko2 live) est inutilisé.

### D5 — `showPage` tennis : contradiction start/stop race
- **Fichier**: `pariscore.js:930`
- **Détail**: `tn2SwitchTab('matchs')` appelle `stopTennisLive()` (cas 'matchs'), puis la ligne suivante `startTennisLive()`. Stop-start immédiat = race condition.
- **Impact**: Inconsistance de design (actuellement no-op grâce aux bugs D1-D2).

### D6 — `_psSbPickTennis()` toggue uniquement une classe CSS, ne filtre pas les matchs
- **Fichier**: `pariscore.js:10531-10535`
- **Détail**: La fonction ne fait que `classList.toggle('is-active')` sur les boutons sidebar. Elle ne filtre PAS `_state.matches` ni ne re-rend TennisScope.
- **Impact**: Cliquer sur un tournoi dans la sidebar ne fait rien visuellement sur les données. L'utilisateur voit toujours tous les matchs.

---

## BUGS MAJEURS (P1)

### D7 — `startAutoRefresh()` TennisScope tourne en permanence (pas de start/stop)
- **Fichier**: `pariscore.html:25748-25754`
- **Détail**: L'auto-refresh est lancé une fois à DOMContentLoaded et **jamais stoppé**. Le `setInterval` tourne même quand l'utilisateur est sur une autre page.
- **Impact**: Gaspillage CPU (DOM query chaque 60s). Devrait être start/stop synchronisé avec `showPage('tennis')`.

### D8 — Visibilité check utilise `.tn2-main.offsetParent` (fragile)
- **Fichier**: `pariscore.html:25752`
- **Détail**: `offsetParent` est `null` quand `display:none` ET quand l'élément est `position:fixed`. C'est fragile et dépendant du layout.
- **Impact**: Potentiel faux négatif → auto-refresh ne marche pas quand il devrait.

### D9 — `tn2SwitchTab` cache de chargement empêche re-fetch
- **Fichier**: `pariscore.html:16179-16181`
- **Détail**: Les tabs 'paris', 'clas', 'tnos', 'cal' ne sont chargés qu'une fois (`window[key] = true`). Les données deviennent stale.
- **Impact**: Code mort actuellement mais serait un problème si réparé sans retirer le cache.

### D10 — Compat interceptor `tickTennisLive` wrapé par TennisScope appelle `fetchData()` en double
- **Fichier**: `pariscore.html:25832-25839`
- **Détail**: L'interceptor remplace `tickTennisLive` pour appeler `fetchData()` en plus de l'original. Mais l'original cible un DOM inexistant. Si le code legacy est réparé sans supprimer l'interceptor → double fetch.
- **Impact**: Double appel réseau si le legacy est réparé.

---

## PLAN DE CORRECTION

### 1. Réparer `showPage('tennis')` (D1, D5, D7)
- Remplacer l'appel `tn2SwitchTab('matchs')` par `TennisScope.refresh()` pour déclencher un fetch au changement de page
- Garder les fonctions utilitaires qui marchent encore (`loadTennisAbstractRome`, `loadTexCalendar`, etc.)
- Ajouter `TennisScope.startAutoRefresh()` et `TennisScope.stopAutoRefresh()`

### 2. Ajouter `startAutoRefresh` / `stopAutoRefresh` au TennisScope bridge (D7)
- Exposer `startAutoRefresh()` et `stopAutoRefresh()` dans l'API publique `root.TennisScope`
- Appeler `stopAutoRefresh()` quand on quitte la page tennis, `startAutoRefresh()` quand on y revient

### 3. Corriger `_psSbPickTennis` pour filtrer réellement les matchs (D6)
- Stocker le tournoi sélectionné dans le state TennisScope
- Re-rendre l'onglet actif avec filtre appliqué

### 4. Nettoyer le code mort legacy (D2, D3, D4, D9, D10)
- Supprimer ou neutraliser les appels legacy dans `showPage` qui ne font rien
- Supprimer l'interceptor `tickTennisLive` dans le compat bridge

---

## SYSTÈME QUI FONCTIONNE (à préserver)

Le **TennisScope bridge** (pariscore.html:25544-25844) est le seul système fonctionnel :
- `wireUp()` à DOMContentLoaded → `TennisScope.init()`
- `fetchData()` → `/api/v1/tennis/value-bets`
- `renderActiveTab()` → `Scope.renderPrematchGrid/LiveGrid/ValueBets/Analytics`
- Auto-refresh 60s avec check visibilité
- Tab switching via `#sc-nav button` click handlers
- Fallback vers `/api/v1/tennis/top10` si 0 matchs
