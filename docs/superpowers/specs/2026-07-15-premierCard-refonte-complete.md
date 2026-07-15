# Spec — Refonte complète premierCard tennis prematch

> Issue du brainstorming multi-expertise (CTO + UI/UX + Frontend + Data/Backend)
> Date : 2026-07-15
> Décision utilisateur : **Refonte complète** (bugs structurels + typo + layout + vraie section Stratégies)

## Contexte

L'audit a révélé que le mécontentement utilisateur n'était pas cosmétique mais **structurel**. Les patchs CSS précédents (commits `06b032e`, `881ca0e`) ne pouvaient pas réparer les 3 bugs critiques ci-dessous car ils sont dans la logique, pas le style.

## Les 3 bugs critiques structurels (vérifiés par audit code)

### B1 — La section Analyse ne marche JAMAIS
- **Cause racine** : `_togglePremier` (pariscore.html:26758) lit `TennisScope._state.matches`, mais `_state` est une variable privée de closure **jamais exposée** sur l'objet public `TennisScope`. → toujours `undefined` → lookup skip → "Analyse non disponible."
- **L'accessseur correct existe** : `TennisScope.getState()` (line 27430) retourne un clone avec `matches`.
- **Meilleur fix** : ne plus faire de lookup global. `premierCard` a déjà l'objet `m` — le stasher dans un `Map<id, match>` au rendu, `_togglePremier` lit depuis la Map.

### B2 — Les panels disparaissent après 60s
- **Cause racine** : `startAutoRefresh` (line 27317) set `setInterval(fetchData, 60000)` → `renderActiveTab` → `pEl.innerHTML = ...map(premierCard)...` remplace TOUT le grid DOM, écrasant les panels ouverts.
- **Contraste** : `liveCardCompact` (line 26304) gère ça correctement via `_expandedMatchIds` Set (line 26654) restauré au rendu.
- **Fix** : ajouter `_expandedPremierIds = new Set()`, mirror le pattern de `liveCardCompact`.

### B3 — Hiérarchie visuelle inversée
- **Symptôme** : les cotes (15px/800/mono) dominent visuellement ; l'Edge/Kelly (signal actionnable) est à 9px quasi-invisible.
- **Fix** : promouvoir Edge/Kelly à 11px, démoter les cotes à weight 700, promouvoir le nom joueur à 15px (co-primaire avec les cotes).

## Découvertes additionnelles (audit)

- **7 tailles de police** dans `.sc-premier-*` (8/9/10/11/13/14/15px) — pas d'échelle cohérente.
- **Section Stratégies est un stub hardcoded** : `"Strategies disponibles dans la prochaine version."` (line 26775).
- **MAIS** l'endpoint `/api/v1/tennis/strategies/:matchId` EXISTE DÉJÀ (server.js:41563) et retourne 5 stratégies + consensus. Non appelé par le frontend.
- **`m.predictive`** contient déjà des candidats multi-marchés classés (ML, Set 1, Total Games O/U, Sets O/U, ≥1 set) avec proba + EV + score. Disponible sur chaque match, non utilisé.
- **`#0284c7` sky-blue hardcodé** pour le badge surface : hors charte, fail WCAG AA (~4.0:1 sur blanc).
- **Deux bleus différents** pour "surface" dans la même carte (`#0077ff` header vs `#0284c7` statline).
- **Mojibake `??`** sur les boutons (emoji corrompus U+FFFD) — préexistant, pas causé par mes commits.

## Design — 4 sections d'implémentation

### Section 1 — Réparer les bugs structurels (fondation)

**1a. Fix lookup Analyse + persistance panels**
- Ajouter `var _premierMatchCache = new Map();` et `var _expandedPremierIds = new Set();` dans le Scope IIFE.
- Dans `premierCard`, au rendu : `_premierMatchCache.set(String(m.id), m);` + lire `_expandedPremierIds.has(String(m.id))` pour pré-rendre le panel si ouvert.
- Dans `_togglePremier` : `add`/`delete` sur le Set ; lire le match depuis `_premierMatchCache.get(mid)` au lieu de `TennisScope._state`.
- Au rendu, si `_expandedPremierIds.has(id)` → pré-rendre `scoutProfile/bettorRead/h2hBlock/topBets` inline (comme `liveCardCompact` fait à 26438-26441).

**1b. Fix icônes mojibake**
- Remplacer `?? Analyse` → `svgIcon('chart',12)+' Analyse'`
- Remplacer `?? Stratégies` → `svgIcon('target',12)+' Stratégies'` (fix le `é`)

### Section 2 — Unifier la typographie (4 tailles)

Échelle stricte, alignée sur tokens charter `--cf-fs-*` :

| Rôle | Taille | Poids | Police | Éléments |
|------|--------|-------|--------|----------|
| Méta | 11px | 600 | Inter | tournament, round, date, odd-lbl |
| Badge | 11px | 600 | mixte | surfrank, sps, chev |
| Primaire | 15px | 700 | Inter | pname |
| Ancre | 15px | 700 | DM Mono | odd-val, % |
| Statline | 11px | 500/600 | split | rank, elo, sps valeurs |

**Changements** : pname 13→15px, odd-val weight 800→700, tous les 9px→11px, 8px→11px, 14px→15px, decision-detail 9→11px (promouvoir le signal).

### Section 3 — Refonte statline (2 lignes, labels/valeurs split)

```
Row 1:  Rank #55     Elo 1758
Row 2:  SPS 49       #223 Clay
```

- `.sc-premier-prank` : retirer `font-family:var(--font-mono)` (les mots en Inter). Wrapper seulement les chiffres dans `<span class="num">` mono.
- Déplacer le badge surface vers le header `.sc-surface` (un seul endroit, couleur charter `var(--blue)`).
- Éliminer la duplication des bleus surface.

### Section 4 — Vraie section Stratégies

Wire l'endpoint existant + données déjà présentes :

**4a. Appel API** (au clic, lazy, cached par matchId) :
```js
fetch('/api/v1/tennis/strategies/' + mid)
  .then(r => r.json())
  .then(data => renderStrategies(data, m));
```

**4b. Rendu** — 3 composants :
1. **5 piliers en mini-gauges** : Momentum, Surface Specialist, Form Trend, Fatigue, Confidence — chacun avec probP1/probP2.
2. **Consensus global** : probP1/probP2 fusionné.
3. **Top paris multi-marchés** depuis `m.predictive` : top 3-5 candidats (ML, Set 1, Total Games) avec proba + EV% + badge confiance (`m.confidence_badge`).

**Fallback** : si l'API 404 (cache value-bets froid), afficher uniquement les candidats `m.predictive` (déjà en mémoire).

## Gestion des données manquantes

- Stratégie non disponible (API 404) → fallback sur `m.predictive` seul.
- `m.predictive` vide → "Aucune stratégie calculée pour ce match."
- Joueur sans SPS → `SPS —` (déjà géré).

## Périmètre exclu (YAGNI)

- **Pas de migration Next.js** pour premierCard (legacy est ce que voit l'utilisateur).
- **Pas de split du fichier 27k lignes** (trop risqué, hors scope).
- **Pas de récupération globale du mojibake** (3635 occurrences — archéologie git séparée). On fixe seulement les 2 boutons + les labels scoutProfile affectés.
- **Pas d'odds multi-marchés book** (Total Games/Handicaps book prices pas dans le payload — v2 future).

## Fichiers touchés

| Fichier | Changements |
|---------|-------------|
| `pariscore.html` CSS L25299-25346 | Échelle typo 4 tailles, couleurs charter, grid 4px |
| `pariscore.html` `premierCard` L26049-26137 | Statline 2 lignes, cache match, pré-rendu panel |
| `pariscore.html` `_togglePremier` L26746-26777 | Fix lookup Map, persistance Set, branche stratégies |
| `pariscore.html` nouveau `renderStrategies` | Rendu 5 piliers + consensus + predictive |

## Validation

1. **Bug B1** : cliquer Analyse → doit afficher scouting/bettorRead/h2h/topBets (plus "non disponible")
2. **Bug B2** : ouvrir Analyse, attendre 60s → panel reste ouvert
3. **Typo** : exactement 4 tailles visibles dans la card (vérifier computed styles)
4. **Stratégies** : clic → 5 piliers + consensus + top paris (pas le stub)
5. **Couleurs** : pas de `#0284c7` hardcodé, tout en `var(--*)`
6. **Playwright** : vérifier le rendu après déploiement

## Risques

| Risque | Mitigation |
|--------|-----------|
| Édition CP1252 corrompt d'autres caractères | Utiliser iconv-lite + tests ciblés (pas d'édition globale) |
| `renderStrategies` ajout de code dans fichier 27k lignes | Fonction isolée, testée isolément |
| API strategies 404 si cache froid | Fallback sur `m.predictive` |
| Régression layout existant | Screenshot Playwright avant/après |
