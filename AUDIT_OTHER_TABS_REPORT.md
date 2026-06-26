# Audit Consolidé — Onglets LIVE / TOP / PARIS Tennis

> **Date** : 2026-06-26
> **Auditeurs** : 3 agents Explore (tasks 16-a, 16-b, 16-c)
> **Périmètre** : 3 onglets Tennis (hors MATCHS déjà traité)
> **Verdict global** : 98 bugs identifiés (14 HIGH + 43 MED + 41 LOW). 3 patterns transverses détectés — un fix structurel peut éliminer 30% des HIGH d'un coup.

---

## Synthèse exécutive

| Onglet | HIGH | MED | LOW | Total | Score | Rapport détaillé |
|--------|------|-----|-----|-------|-------|------------------|
| **LIVE** | 5 | 15 | 16 | 36 | 4.5/10 | `AUDIT_LIVE_TENNIS_REPORT.md` |
| **TOP**  | 4 | 14 | 13 | 31 | 6.5/10 | `AUDIT_TOP_TENNIS_REPORT_v2.md` |
| **PARIS**| 5 | 14 | 12 | 31 | 5.5/10 | `AUDIT_PARIS_TENNIS_REPORT.md` |
| **TOTAL**| **14** | **43** | **41** | **98** | **5.5/10** | — |

### Comparaison avec l'audit MATCHS (déjà traité)

| Onglet | HIGH | MED | LOW | Statut |
|--------|------|-----|-----|--------|
| MATCHS | 12 → 0 | 28 → 0 | 31 → 0 | ✅ **Sprint 1+2+3 terminés** (71/71 fixés) |
| LIVE | 5 | 15 | 16 | ⏳ En attente |
| TOP | 4 | 14 | 13 | ⏳ En attente |
| PARIS | 5 | 14 | 12 | ⏳ En attente |

---

## 3 patterns transverses détectés

### Pattern 1 — XSS onclick transitif (3 onglets impactés)

**Bug racine** : `_tnEsc` / `_escTennis` encode `'` en `&#39;` mais le parser HTML décode les entités **avant** l'exécution JS. Donc `onclick="fn('${id}')"` est vulnérable si `id` contient `'); alert('xss`.

**Onglets impactés** :
- LIVE → H5 (`matchId` dans `openTennisMatchDetail`)
- TOP → H1 (`safeId` dans `openTennisAnalysisModal` — H7 précédent marqué fixé mais inefficace)
- PARIS → H1 (5 occurrences : `_tnFavBtn`, `renderTennisValueBets`, `_tnExpandDrawer`)

**Fix structurel recommandé** (1 fix pour 3 bugs) :
```js
// Migration onclick inline → data-* + event delegation
// AVANT :
'<button onclick="openTennisMatchDetail(\'' + id + '\')">'

// APRÈS :
'<button data-match-id="' + _tnEsc(id) + '">'  // _tnEsc OK pour attribut HTML
// + 1 listener unique :
container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-match-id]');
  if (btn) openTennisMatchDetail(btn.dataset.matchId);
});
```

**Bénéfice** : 3 HIGH éliminés d'un coup + pattern réutilisable pour futures features.

### Pattern 2 — Leaks de timer (3 onglets impactés)

**Bug racine** : `setInterval` / `setTimeout` posés dans `tickTennis*` mais jamais nettoyés au switch intra-tennis (uniquement au `stopTennisTop10` global quand on quitte la page tennis).

**Onglets impactés** :
- LIVE → H2 (`startTennisLive` jamais appelé + pas d'auto-refresh)
- TOP → H2 (leak polling `_tnTop10Timer` sur tab switch intra-tennis)
- PARIS → H3 + H4 (`_tennisVbBuildRetries` setTimeout + `tickTennisValueBets` setInterval jamais nettoyés)

**Fix structurel recommandé** : centraliser tous les timers dans `stopTennisTop10()` (déjà étendu pour `_texMatchsTimer` au Sprint 2 Q4), étendre aux timers LIVE et PARIS.

### Pattern 3 — Code mort de migration incomplète

**LIVE** : `renderTennisLive` (85 lignes), `startTennisLive`, scrollbar sync, ~50 règles CSS `#tennis-live-table` mortes (~5 KB)
**TOP** : `tn2RenderTopCards` (55 lignes)
**PARIS** : 3 checkboxes HTML jamais définies mais référencées 6× dans le JS (`tennis-vb-elo-only`, `tennis-vb-positive-ev`, `tennis-vb-hide-finished`)

**Fix** : cleanup actif (~250 lignes + 5 KB CSS supprimés) dans le Sprint 2 MED.

---

## Plan d'action consolidé

### Sprint 4 — P0 (14 bugs HIGH, ~10h)

| # | Bug | Onglet | Effort | Fix |
|---|-----|--------|--------|-----|
| 1 | XSS onclick transitif | LIVE + TOP + PARIS | 2h | Pattern 1 ci-dessus (event delegation) |
| 2 | Status badge ID mismatch `tn2-live-status` | LIVE H1 | 5min | Renommer ID ou changer la référence |
| 3 | `startTennisLive` jamais appelé | LIVE H2 | 30min | Appeler dans `tn2SwitchTab('live')` |
| 4 | Pas d'AbortController (race clics 🔄) | LIVE H3 | 30min | AbortController comme `fetchTennisTop10` |
| 5 | Pas de feedback en cas d'erreur réseau | LIVE H4 | 30min | Try/catch avec message visible |
| 6 | NLP Injury Scraper silencieusement cassé | TOP H3 | 1h | Fixer `globalThis.__tnTop10Cache` + `Array.isArray` |
| 7 | `confidence_level` non-échappé dans `class` | TOP H4 | 15min | `_tnEsc` sur l'attribut class |
| 8 | 3 checkboxes fantômes PARIS | PARIS H2 | 1h | Ajouter les 3 checkboxes dans le HTML |
| 9 | `setTimeout` cold-start jamais nettoyé | PARIS H3 | 15min | Cleanup dans `stopTennisValueBets` |
| 10 | `setInterval` 5min jamais arrêté au switch | PARIS H4 | 15min | Cleanup dans `stopTennisTop10` |
| 11 | Race condition `_tennisVbBuildRetries` | PARIS H5 | 30min | AbortController ou reqId pattern |

### Sprint 5 — P1 (43 bugs MED, ~12h)

- Code mort cleanup : LIVE (~250 lignes) + TOP (55 lignes) + PARIS (checkboxes)
- 9 MED LIVE : code mort, monkey-patch `_tn2Patch`, scrollbar sync, etc.
- 14 MED TOP : `cursor:pointer` non cliquable, `filtered_out_by_diversity` caché, AppCache mode-agnostique, ESC handler manquant, etc.
- 14 MED PARIS : a11y, AppCache, ESC handler, etc.
- Étendre `stopTennisTop10()` à tous les timers (Pattern 2)

### Sprint 6 — P2 (41 bugs LOW, ~6h rolling)

- Polish : magic numbers, code mort résiduel, noms de variables
- Responsive : cards empilées < 768px comme MATCHS
- A11y : focus trap comme MATCHS Sprint 3 L21
- Tests : étendre `tests/tennis-matchs.test.js` à `computeScoreTop10Tennis` et `buildTennisValueBets`

---

## Recommandations stratégiques

### 1. Créer un composant modal réutilisable (transverse)

Les 3 onglets ont des popups (live match detail, top analysis modal, p-bets modal) qui dupliquent la logique Escape + focus trap + role/aria. **Recommandation** : extraire `_openTennisModal(html, options)` réutilisable — déjà fait en partie côté MATCHS (cf. `openTexMatchDetail` / `openPlayerProfile`).

### 2. Étendre les tests unitaires aux autres onglets

Après les 64 tests MATCHS (commit à venir), étendre à :
- `computeScoreTop10Tennis` (server.js L26180) — scoring engine Top 10
- `buildTennisValueBets` (server.js L37302) — value bets builder
- `_applyTop10DiversityFilter` (server.js L26352) — filtre diversité

### 3. Migration parser TE vers `cheerio` ou `node-html-parser`

Le parser regex `_texParseMatchesPage` (Sprint 2 M4 télémétrie ajoutée) reste fragile face aux changements HTML de TennisExplorer. Investir dans `cheerio` (~100 KB) réduirait le risque de casser silencieusement.

### 4. Pré-indexer `tennis_elo.player_slug` pour lookup exact

Le lookup Elo par nom (M5 Sprint 2) reste approximatif. Ajouter une colonne `player_slug` TE + index SQLite permettrait un match exact par slug — élimine les homonymes définitivement.

### 5. Adopter un framework de tests (Vitest + jsdom)

Les 64 tests actuels sont en Node natif (zéro dépendance). Pour tester les fonctions DOM (`_renderTexMatchs`, `renderTennisValueBets`, `tn2RenderLiveCards`), migrer vers **Vitest + jsdom**. Permettrait de couvrir le rendu HTML et les interactions.

---

## Bilan global du projet Tennis

| Périmètre | Bugs initiaux | Bugs fixés | Restant |
|-----------|---------------|------------|---------|
| MATCHS (Sprint 1+2+3) | 71 | 71 | 0 ✅ |
| LIVE | 36 | 0 | 36 |
| TOP | 31 | 0 | 31 |
| PARIS | 31 | 0 | 31 |
| **TOTAL** | **169** | **71 (42%)** | **98** |

**Prochaine étape recommandée** : déployer Sprint 1+2+3 MATCHS en prod, valider 24h, puis lancer Sprint 4 (14 HIGH des 3 autres onglets).

---

*Ce rapport consolide les 3 audits détaillés. Pour le détail code exact par bug, se référer aux 3 rapports source.*
