# Tests — Pariscore Tennis

## Structure

```
tests/
├── lib/
│   └── tennis-logic.js      # Fonctions pures extraites (frontend + backend)
├── tennis-matchs.test.js    # 64 tests unitaires sur la logique MATCHS
├── responsive.spec.js       # Tests E2E Playwright (pré-existant)
└── README.md                # Ce fichier
```

## Exécuter les tests

### Tests unitaires (zéro dépendance)

```bash
node tests/tennis-matchs.test.js
```

**Couverture** (64 tests) :
- `decodeHtmlEntities` (8 tests) — HTML entity decoding (fix M8)
- `texEscapeRegex` (5 tests) — regex escaping (fix L27)
- `upsetScore` (12 tests) — score d'upset (delta Elo + drift)
- `sortTexMatchs` (13 tests) — 7 filtres de tri (time, elo_delta, value, drift, elite, rating, upset)
- `computeMatchRating` (26 tests) — composite 0-100 + 1-5 étoiles (fixes H2, L3, L4, M6, L18)

### Tests E2E Playwright (déjà existants)

```bash
npx playwright test tests/responsive.spec.js
```

## Maintenance

### Quand modifier ce dossier ?

**Oui** si vous modifiez dans `pariscore.js` ou `server.js` :
- `_upsetScore` (pariscore.js L5383)
- `_sortTexMatchs` (pariscore.js L5320)
- `_texEscapeRegex` (pariscore.js L5284)
- `_decodeHtmlEntities` (server.js L29601)
- `_computeMatchRating` (server.js L29927 — logique inline dans `fetchTexMatches`)
- `TEX_RATING_CONFIG` (server.js L29588)
- `TEX_PRESTIGE_RULES` (server.js L29601)

→ Reportez les changements dans `tests/lib/tennis-logic.js` pour garder les tests synchronisés.

**Non** sinon.

### Ajouter un test

```js
test('mon nouveau test', () => {
  const result = logic.upsetScore({ elo_surface: { delta: 0 } });
  eq(result, 100);
});
```

## Score actuel

```
════════════════════════════════════════════════
  RAPPORT TESTS UNITAIRES — Tennis MATCHS
════════════════════════════════════════════════
  Passés : 64
  Échoués: 0
  Skip   : 0
  Total  : 64
════════════════════════════════════════════════
```

## Tests non couverts (limites actuelles)

Les fonctions qui dépendent du DOM (`_renderTexMatchs`, `loadTexMatchs`, `openTexMatchDetail`, `openPlayerProfile`) ne sont pas testées ici car elles nécessitent un mock DOM complet. Pour les couvrir, envisager :
- **jsdom** : `npm i -D jsdom` puis `const { JSDOM } = require('jsdom');`
- **Playwright** : tests E2E plus complets
- **Vitest** : framework moderne avec environnement jsdom intégré

Ces tests unitaires couvrent uniquement la **logique pure** (calculs, tri, escaping) — pas le rendu HTML ni les appels API.
