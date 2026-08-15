# Filtres Ascenseur — Rapport d'Implémentation

**Date** : 2026-08-15  
**Statut** : ✅ Implémentation terminée, tests manuels requis  
**Scope** : Onglet Football (page Matchs)

---

## Résumé exécutif

Transformation des filtres championnats (`#ml-league`) et stratégies (`#ts-select`) de dropdowns `position:fixed` en panneaux accordéon inline toujours visibles, avec collapse/expand.

**Décision d'architecture** : Réutilisation du composant `.mls` existant avec ajout d'un mode `.mls-accordion` (vs création d'un nouveau composant).

**Justification** :
- La structure interne (pays → ligues) était déjà un accordéon (expand via `.mls-exp`)
- Les états `activeLeagues[]`, `activeStrategies[]` étaient déjà partagés entre onglets
- Seul le conteneur change : dropdown flottant → panneau inline collapsible
- Risque minimal : aucune modification des fonctions de sélection (`mlToggleCountry`, `mlToggleLeague`, `tsToggleStrat`)
- Sync `#ps-quick-filters` préservée (même état, même mécanisme)

---

## Modifications techniques

### 1. CSS — pariscore.html (lignes ~7219-7265)

**Ajout** : mode `.mls-accordion`

```css
.mls-accordion {
  position: relative; display: block; width: 100%; max-width: none;
  border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg);
  background: linear-gradient(180deg,#22262c 0%,#181b20 100%);
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}
.mls-accordion .mls-trigger { display: none; } /* Cache l'ancien trigger */
.mls-acc-header { /* Nouveau header cliquable */
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  cursor: pointer; user-select: none;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.mls-acc-body {
  max-height: 320px; overflow-y: auto; padding: 8px;
  transition: max-height .25s ease, opacity .2s;
}
.mls-accordion.collapsed .mls-acc-body {
  max-height: 0; overflow: hidden; padding: 0 8px; opacity: 0;
}
```

**Responsive** (mobile < 768px) :
```css
.mls-accordion { width: 100%; }
.mls-accordion .mls-acc-body { max-height: 260px; }
```

### 2. HTML — pariscore.html

#### #ml-league (ligne ~14304)
**AVANT** : dropdown avec trigger + panel `position:fixed`
```html
<div id="ml-league" class="mls">
  <button class="mls-trigger" onclick="mlToggle(event)">...</button>
  <div class="mls-panel" id="ml-panel">...</div>
</div>
```

**APRÈS** : accordéon inline
```html
<div id="ml-league" class="mls mls-accordion">
  <div class="mls-acc-header" onclick="mlAccToggle(event)" aria-expanded="true">
    <span class="mls-acc-title">Championnats</span>
    <span class="mls-acc-count" id="ml-label">Toutes les ligues</span>
    <svg class="mls-acc-caret">...</svg>
  </div>
  <div class="mls-acc-body" id="ml-panel">...</div>
</div>
```

#### #ts-select (ligne ~14321)
Même transformation (trigger → header, panel → body).

### 3. JavaScript — pariscore.js

#### mlAccToggle() (ligne 10668)
```javascript
function mlAccToggle(e) {
  if (e) e.stopPropagation();
  var wrap = document.getElementById('ml-league');
  if (!wrap) return;
  var collapsed = wrap.classList.toggle('collapsed');
  var header = wrap.querySelector('.mls-acc-header');
  if (header) header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}
```

#### tsAccToggle() (ligne 11355)
```javascript
function tsAccToggle(e) {
  if (e) e.stopPropagation();
  var wrap = document.getElementById('ts-select');
  if (!wrap) return;
  if (!document.querySelector('#ts-list .mls-row')) buildTSList();
  var collapsed = wrap.classList.toggle('collapsed');
  var header = wrap.querySelector('.mls-acc-header');
  if (header) header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}
```

**Note** : Les anciennes fonctions (`mlToggle`, `tsToggle`, `mlPosition`, `tsPosition`, `mlClose`, `tsClose`) sont conservées mais inutilisées (trigger masqué via CSS). Les handlers outside-click deviennent no-ops (vérifient `.open` class, plus définie).

---

## État existant réutilisé (aucune modification)

### Variables d'état (pariscore.js:11141+)
- `activeLeagues[]` — ligues sélectionnées
- `activeCountries[]` — pays sélectionnés
- `activeStrategies[]` — stratégies sélectionnées
- `activeMatchTab` — onglet actif ('all' | 'live' | 'prematch')

### Fonctions de sélection (inchangées)
- `mlToggleCountry(country)` — toggle pays
- `mlToggleLeague(sport)` — toggle ligue
- `mlPickAll()` — reset championnats
- `tsToggleStrat(key)` — toggle stratégie
- `tsPickAll()` — reset stratégies

### Rendu (inchangé)
- `renderMatches()` (ligne 14931) — applique filtres uniformément sur les 3 onglets
- `calcTopStrategiesScore()` (ligne 14470) — combine stratégies + confiance
- `buildLeagueMS()` (ligne 10572) — construit liste ligues (peuplée dans `#ml-list`)
- `buildTSList()` (ligne 11279) — construit liste stratégies (peuplée dans `#ts-list`)

### Mobile (inchangé)
- `_mfsRelocate()` (ligne 29149) — déplace filter-rows dans `#mfs-body`
- Structure DOM préservée → relogement automatique

---

## Validation technique

✅ `node --check pariscore.js` — syntaxe OK  
✅ `gantt-filters-ascenseur.json` + `.svg` générés  
✅ IDs préservés (`ml-label`, `ts-label`, `ml-panel`, `ts-panel`, `ml-list`, `ts-list`)  
✅ Accessibilité : `aria-expanded`, `aria-controls`, `aria-multiselectable`  
✅ XSS : `_mlEsc()` et `_jsStr()` conservés sur interpolations  
✅ Mobile : `_mfsRelocate()` compatible (structure inchangée)

---

## Tests manuels requis

### 1. Multi-choix championnats
- [ ] Ouvrir page Matchs (onglet Football)
- [ ] Vérifier accordéon "Championnats" visible par défaut (déplié)
- [ ] Cliquer pays (ex: France) → sélection multiple (checkbox rouge)
- [ ] Cliquer expand (▼) sur pays → liste ligues apparaît
- [ ] Cliquer ligue (ex: Ligue 2) → sélection indépendante
- [ ] Vérifier tableau filtré immédiatement
- [ ] Décocher pays/ligue → mise à jour immédiate
- [ ] Cliquer "Toutes les ligues" → reset complet
- [ ] Cliquer header "Championnats" → accordéon se plie (max-height: 0)
- [ ] Re-cliquer → accordéon se déplie

### 2. Multi-choix stratégies
- [ ] Vérifier accordéon "Stratégies" visible (dans `#topn-filter-row`)
- [ ] Cliheader → si première fois, `buildTSList()` peuplé
- [ ] Cocher 2 stratégies (ex: BTTS Oui + +2.5 buts)
- [ ] Slider confiance à 50% → filtre combiné (`calcTopStrategiesScore`)
- [ ] Vérifier tableau filtré
- [ ] Décocher stratégie → mise à jour immédiate
- [ ] Cliquer "Toutes stratégies" → reset

### 3. Persistance entre onglets
- [ ] Cocher 3 ligues + 2 stratégies (onglet All)
- [ ] Basculer onglet Live → filtres restent appliqués
- [ ] Basculer onglet Prematch → filtres restent appliqués
- [ ] Retourner onglet All → mêmes sélections
- [ ] Vérifier compteurs reflètent chaque onglet

### 4. Mobile (viewport < 768px)
- [ ] Ouvrir en mode mobile (Chrome DevTools → toggle device toolbar)
- [ ] Cliquer bouton "Filtres" (bottom-nav) → bottom-sheet s'ouvre
- [ ] Vérifier accordéons relogés dans `#mfs-body`
- [ ] Scroll interne fonctionnel (max-height: 260px)
- [ ] Collapse/expand fonctionne
- [ ] Pas de débordement horizontal

### 5. Recherche
- [ ] Taper dans `#ml-search` → filtre ligues (nom FR + EN)
- [ ] Taper dans `#ts-search` → filtre stratégies (label + tipster)
- [ ] Effacer → reset filtre

### 6. Sync rapide (`#ps-quick-filters`)
- [ ] Cliquer pill stratégie dans barre rapide → sync avec accordéon
- [ ] Cocher stratégie dans accordéon → sync avec pills
- [ ] Vérifier cohérence état

---

## Problèmes potentiels identifiés

### 1. Layout `#topn-filter-row`
**Problème** : L'accordéon stratégies prend `width:100%` dans un flex-container avec `flex-wrap:wrap`. Les éléments avant (chips TopN, label) et après (slider confiance, Value) seront sur des lignes séparées.

**Impact** : Verticalisation du `#topn-filter-row` (moins compact).

**Solution** : Si layout trop vertical, ajuster CSS :
```css
#topn-filter-row .mls-accordion {
  flex: 1 1 300px; /* Prend 300px min, grandit si espace */
  max-width: 400px;
}
```

### 2. Focus search input
**Problème** : L'ancien `mlToggle()` focus automatiquement `#ml-search` à l'ouverture. Le nouveau `mlAccToggle()` ne le fait pas (accordéon déjà visible par défaut).

**Impact** : Mineur — l'utilisateur peut cliquer dans la search manuellement.

**Solution** : Si souhaité, ajouter focus auto au premier expand :
```javascript
function mlAccToggle(e) {
  // ... existing code ...
  if (!collapsed) {
    var s = document.getElementById('ml-search');
    if (s) setTimeout(function(){ s.focus(); }, 100);
  }
}
```

### 3. Outside-click close
**Problème** : Les handlers `document.addEventListener('click', ...)` vérifient `.open` class, plus définie en mode accordéon.

**Impact** : Aucun — les accordéons ne se ferment pas au clic extérieur (comportement attendu).

**Solution** : Aucune — comportement correct.

---

## Gantt

**Fichier** : `gantt-filters-ascenseur.json` + `.svg`  
**Durée totale** : 1 jour (2026-08-15)  
**Tracks** : 7 (Recherche, Championnats, Stratégies, Live+Prematch, Mobile, QA, Pilotage)  
**Items** : 13 (11 done, 2 critical à tester)

---

## Décisions d'arbitrage

| Question | Décision | Justification |
|----------|----------|---------------|
| Réutiliser `.mls` vs nouveau composant | **Réutiliser** | Structure interne déjà accordéon, état partagé, risque minimal |
| Supprimer anciennes fonctions (mlToggle, etc.) | **Conserver** | Retro-compatibilité, aucun coût, fallback si bug |
| Focus auto search input | **Non** | Accordéon déjà visible, focus manuel OK |
| Outside-click close | **Non** | Comportement accordéon ≠ dropdown |
| Collapse par défaut | **Non** (déplié) | Visibilité immédiate des filtres |

---

## Livrables

- ✅ `pariscore.html` — CSS + HTML modifiés
- ✅ `pariscore.js` — fonctions `mlAccToggle()`, `tsAccToggle()` ajoutées
- ✅ `gantt-filters-ascenseur.json` — planning projet
- ✅ `gantt-filters-ascenseur.svg` — visualisation Gantt
- ✅ `node --check` — syntaxe validée

---

## Prochaines étapes

1. **Test manuel** — exécuter la checklist ci-dessus
2. **Ajustement layout** — si `#topn-filter-row` trop vertical, ajuster CSS
3. **QA mobile** — tester sur device réel (pas seulement DevTools)
4. **Code review** — faire relire par sub-agent (code-reviewer)
5. **Deploy** — si tests OK, déployer sur VPS via `deploy.bat`

---

**Contact** : Pour questions ou ajustements, relancer l'agent avec `bun run dev` + tests manuels.
