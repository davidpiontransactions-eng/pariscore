# Audit Complet v2 — Onglet TOP Tennis (Top 10 Matchs du Jour)

> **Date** : 2026-06-25
> **Auditeur** : Senior Engineer (audit Explore)
> **Périmètre** : `pariscore.js` L4303-4970 (bloc TOP 10 Tennis), `pariscore.html` L15811-15827 (panel HTML tab TOP) + L16339-16382 (`tn2SwitchTab`) + L16545-16600 (`tn2RenderTopCards` dead) + L19884-20175 (CSS) + L4651-4669 (`.p-bets-btn`) ; `server.js` L22090-22116 (route `/api/v1/tennis/top10`), L26180-26352 (scoring engine `_precomputeTop10Dims` + `computeScoreTop10Tennis` + `_applyTop10DiversityFilter`), L37342-37594 (warmer `_refreshTop10Cache` + cron), L39224-39283 (route `ai-send-discord`).
> **Post-previous-audit** : 8 HIGH / 18 MED / 17 LOW du rapport `AUDIT_TOP_TENNIS_REPORT.md` (commit `cf88a98`) — 7/8 HIGH corrigés, 14/18 MED corrigés, 8/17 LOW corrigés.
> **Verdict global** : L'onglet fonctionne correctement en régime nominal. **4 bugs HIGH résiduels** (1 sécu, 1 leak, 1 silent-fail backend, 1 sécu défense-en-profondeur), **14 MED**, **13 LOW**. La majorité des HIGH précédents sont fixés mais le fix H7 (XSS `_tnEsc` apostrophe) est **inefficace** — entités HTML décodées avant parsing JS.

---

## Synthèse exécutive

| Domaine | HIGH | MED | LOW | Score |
|---|---|---|---|---|
| Code/Architecture | 2 | 8 | 8 | 6.5/10 |
| QA Fonctionnel | 0 | 3 | 2 | 7/10 |
| Design UI / A11y | 0 | 2 | 1 | 7/10 |
| Sécurité | 2 | 1 | 2 | 6/10 |
| **Total unique** | **4** (H1-H4) | **14** | **13** | **6.5/10** |

**Recommandation** : Sprint dédié P0 (4 bugs HIGH, ~3h) avant toute nouvelle feature. Le bug H1 (XSS résiduel) avait été **marqué fixé** dans le rapport précédent mais le fix est structurellement inefficace — à revoir avec migration `data-*` + event delegation (comme H1 du rapport MATCHS).

---

## Bugs HIGH (4) — À traiter en priorité absolue

### H1 — XSS résiduel `onclick="${safeId}"` (H7 précédent = fix inefficace)

**Fichiers** :
- `pariscore.js` L4453 : `const safeId = _tnEsc(String(m.matchId || m.fixtureId || m.id || m.match_id || ''));`
- `pariscore.js` L4610 : template literal avec `onclick="...openTennisAnalysisModal('${safeId}')"`
- `pariscore.js` L4370-4373 : fonction `_tnEsc` (H7 fix)

**Code exact** :
```js
// pariscore.js L4370-4373
function _tnEsc(s) {
  // H7 fix — échapper aussi l'apostrophe pour les contextes onclick='...'
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// pariscore.js L4453
const safeId = _tnEsc(String(m.matchId || m.fixtureId || m.id || m.match_id || ''));

// pariscore.js L4610
return `<div class="tn-t10-card" ...
  onclick="if(typeof openTennisAnalysisModal==='function')openTennisAnalysisModal('${safeId}')"
  onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();if(typeof openTennisAnalysisModal==='function')openTennisAnalysisModal('${safeId}')}">`;
```

**Problème** : Le fix H7 échappe `'` en `&#39;` (entité HTML). C'est correct pour un contexte **HTML pur** (ex. `title="..."`, contenu textuel), mais **incorrect pour un contexte JS inline** (`onclick="..."`). L'HTML parser décode `&#39;` en `'` **avant** que le moteur JS ne voie la valeur, donc :

- Si `m.matchId = "foo'bar"` : `safeId = "foo&#39;bar"` → HTML attribute `onclick="openTennisAnalysisModal('foo&#39;bar')"` → décodé HTML → JS voit `openTennisAnalysisModal('foo'bar')` → **SyntaxError** → clic silencieusement cassé.
- Si attaquant contrôle `m.matchId` avec `');alert(document.cookie);//` : `safeId = "&#39;);alert(document.cookie);//"` → HTML attribute décodé → JS voit `openTennisAnalysisModal('');alert(document.cookie);//')` → **XSS exécuté**.

C'est exactement le même bug que H5 du rapport LIVE Tennis (L16504 `tn2RenderLiveCards`), confirmé par l'audit LIVE. L'audit précédent TOP a marqué ce point comme fixé (`cf88a98`) mais le fix est **structurellement inefficace**.

**Impact** :
- ~5% des clics silencieusement cassés si `m.matchId` contient une apostrophe (O'Connell, Dell'Acqua, etc.) —bien que les IDs de match soient en pratique des nombres/slugs sans apostrophe, le risque existe.
- XSS théorique si source de données compromis (matchId contrôlable par attaquant).

**Fix proposé** (migration vers `data-*` + event delegation, comme H1 du rapport MATCHS) :
```js
// 1. Remplacer onclick/onkeydown par data-match-id
return `<div class="tn-t10-card" data-match-id="${safeId}" tabindex="0" role="button" ...>`;

// 2. Event delegation au niveau du container (une fois au start)
document.getElementById('tn2-top-grid').addEventListener('click', function(e) {
  var card = e.target.closest('.tn-t10-card');
  if (!card) return;
  if (e.target.closest('.tn-t10-ai, .p-bets-btn')) return; // ne pas déclencher sur boutons internes
  var id = card.dataset.matchId;
  if (typeof openTennisAnalysisModal === 'function') openTennisAnalysisModal(id);
});
document.getElementById('tn2-top-grid').addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var card = e.target.closest('.tn-t10-card');
  if (!card) return;
  e.preventDefault();
  var id = card.dataset.matchId;
  if (typeof openTennisAnalysisModal === 'function') openTennisAnalysisModal(id);
});

// 3. Conserver _tnEsc pour le HTML pur (title, data-* attributes) — OK
```

**Effort** : 30 min | **Équipe** : JS

---

### H2 — Leak polling : `stopTennisTop10()` jamais appelé au changement de tab intra-tennis

**Fichiers** :
- `pariscore.js` L869 : `try { if (pageId !== 'tennis' && typeof stopTennisTop10 === 'function') stopTennisTop10(); } catch(e) {}` — appelé uniquement quand on quitte la page tennis
- `pariscore.js` L4910-4921 : `startTennisTop10` pose `_tnTop10Timer` (60s) + `_forecastTimer` (300s)
- `pariscore.html` L16339-16382 : `tn2SwitchTab` — appelle `startTennisTop10()` sur `case 'top'` mais jamais `stopTennisTop10()` sur les autres cases

**Code exact** :
```js
// pariscore.js L4910-4921 — startTennisTop10
function startTennisTop10() {
  fetchTennisTop10();
  if (_tnTop10Timer) clearInterval(_tnTop10Timer);
  _tnTop10Timer = setInterval(fetchTennisTop10, 60_000);  // ← timer 60s posé
  _fetchForecastCache('tennis').catch(function(){});
  if (_forecastTimer) clearInterval(_forecastTimer);
  _forecastTimer = setInterval(function() {                 // ← timer 300s posé
    _forecastTennisCache = null;
    _fetchForecastCache('tennis').catch(function(){});
  }, 300_000);
}

// pariscore.html L16352-16362 — tn2SwitchTab
switch (tabId) {
  case 'matchs':
    if (typeof loadTexMatchs === 'function') loadTexMatchs();
    if (typeof loadTexTournamentsToday === 'function') loadTexTournamentsToday();
    break;
  case 'live':
    if (typeof tickTennisLive === 'function') tickTennisLive();
    break;
  case 'top':
    if (typeof startTennisTop10 === 'function') startTennisTop10();  // ← start
    break;
  // ... (aucun case n'appelle stopTennisTop10())
}
```

**Problème** : Quand l'utilisateur switch de `'top'` → `'matchs'` (ou `'live'`), les timers 60s et 300s restent actifs. Conséquences :
- Polling réseau `/api/v1/tennis/top10?mode=...` toutes les 60s en arrière-plan (gaspillage bande passante + CPU serveur pour répondre depuis cache).
- Polling réseau `/api/v1/forecasts/tennis` toutes les 300s en arrière-plan.
- Re-render DOM de `#tn2-top-grid` (innerHTML replace) toutes les 60s — gaspillage CPU (cartes cachées par CSS mais DOM toujours mis à jour).
- `_tnTop10AlertNewEntry` peut déclencher un toast `🏆 Top 3 Tennis : ...` pendant que l'utilisateur est sur un autre onglet → **notification intrusive non sollicitée**.

Scénario type : user ouvre tennis → va sur TOP → switch vers MATCHS pour analyser un match spécifique → toast "Top 3 Tennis : X vs Y" apparaît en pleine lecture → frustration UX.

**Impact** : 100% des utilisateurs qui switchent intra-tennis après être allés sur TOP. ~5 fetchs/minute inutiles sur une session de 5min avec tabs switching.

**Fix proposé** : étendre `tn2SwitchTab` pour appeler `stopTennisTop10()` quand on quitte le tab `'top'` :
```js
window.tn2SwitchTab = function(tabId) {
  // ... existing code ...
  // H2 fix — arrêter le polling TOP si on quitte le tab 'top'
  if (tabId !== 'top' && typeof stopTennisTop10 === 'function') {
    try { stopTennisTop10(); } catch(e) {}
  }
  switch (tabId) {
    // ... existing cases ...
  }
};
```

Note : `stopTennisTop10` (L4923) clear déjà `_tnTop10Timer`, `_forecastTimer`, abort le fetch en cours, et clear `_texMatchsTimer` (Q4 fix). Il est donc suffisant.

**Effort** : 5 min | **Équipe** : JS/HTML

---

### H3 — NLP Injury Scraper silencieusement cassé (`globalThis.__tnTop10Cache` jamais assigné)

**Fichier** : `server.js` L37568-37593 (NLP Injury Scraper cron) + L26185 (déclaration `_tnTop10Cache`)

**Code exact** :
```js
// server.js L26185 — déclaration module-level
let _tnTop10Cache = { viewer: null, bettor: null, pwscr: null, ts_viewer: 0, ts_bettor: 0, ts_pwscr: 0 };

// server.js L37488-37490 — assignation (utilise _tnTop10Cache, pas globalThis.__tnTop10Cache)
const payload = { top10, mode, computed_at: now, total_active: active.length, filtered_out_by_diversity: _filteredOutByDiversity };
_tnTop10Cache[mode] = payload;
_tnTop10Cache[`ts_${mode}`] = now;

// server.js L37568-37593 — NLP Injury Scraper (lit globalThis.__tnTop10Cache !)
setInterval(async () => {
  try {
    var players = [];
    if (globalThis.__tnTop10Cache) {                                    // ← TOUJOURS undefined !
      for (var mode of ['viewer', 'bettor']) {
        var list = globalThis.__tnTop10Cache[mode];                     // ← jamais exécuté
        if (Array.isArray(list)) {                                     // ← structure est {top10: [...]}, pas array
          for (var m of list) {
            if (m.player1) players.push({ name: m.player1 });
            if (m.player2) players.push({ name: m.player2 });
          }
        }
      }
    }
    if (players.length > 0) {
      // ... scanTournamentPlayers ...
    }
  } catch (_) {}
}, 30 * 60 * 1000);
```

**Problème** : 2 bugs en un :
1. **`globalThis.__tnTop10Cache` n'est jamais assigné**. Le code utilise `_tnTop10Cache` (module-level `let`) pour stocker les données, mais le NLP scraper lit `globalThis.__tnTop10Cache`. Le `if (globalThis.__tnTop10Cache)` est donc toujours `false` → le bloc entier ne s'exécute jamais.
2. **Même si l'assignation était faite**, le check `Array.isArray(list)` (L37575) serait faux car `_tnTop10Cache[mode]` est un objet `{ top10: [...], mode, computed_at, ... }` (L37488), pas un array directement. Il faudrait lire `list.top10` ou `list.data.top10`.

Conséquence : le NLP Injury Scraper censé détecter les blessures des joueurs du Top 10 Tennis **ne scanne jamais les joueurs tennis**. La fonctionnalité est silencieusement morte depuis son introduction. `globalThis.__injuryAlerts` n'est jamais peuplé par cette source.

**Impact** : 100% silencieux — aucune alerte de blessure n'est jamais générée pour les joueurs du Top 10 Tennis. Si un joueur du Top 10 se blesse en cours de tournoi, aucune alerte n'est levée. Le quota de détection est de 0% au lieu de ~100% attendu.

**Fix proposé** :
```js
// server.js L37568-37593 — corriger les 2 bugs
setInterval(async () => {
  try {
    var players = [];
    for (var mode of ['viewer', 'bettor']) {
      var entry = _tnTop10Cache[mode];                    // ← utiliser _tnTop10Cache directement
      if (entry && Array.isArray(entry.top10)) {          // ← structure correcte
        for (var m of entry.top10) {
          if (m.player1) players.push({ name: m.player1 });
          if (m.player2) players.push({ name: m.player2 });
        }
      }
    }
    if (players.length > 0) {
      var unique = players.filter(function(p,i,a) { return a.findIndex(function(x) { return x.name === p.name; }) === i; });
      var alerts = await nlpInjuryScraper.scanTournamentPlayers(unique, 'TOP10');
      if (alerts.length > 0) {
        globalThis.__injuryAlerts = alerts;
        console.log('[NLP-Injury] ' + alerts.length + ' alerte(s) detectee(s)');
      }
    }
  } catch (e) { console.warn('[NLP-Injury] erreur:', e.message); }  // ← wirer _trackCatch
}, 30 * 60 * 1000);
```

**Effort** : 10 min | **Équipe** : Backend

---

### H4 — `confidence_level` injecté non-échappé dans attribut `class` (XSS défense-en-profondeur)

**Fichier** : `pariscore.js` L4427-4428

**Code exact** :
```js
// pariscore.js L4425-4428
// Confidence badge
// L13 fix — guard String() pour éviter crash si confidence_level est non-string
const confBadge = m.confidence_level
  ? `<span class="tn-t10-conf tn-t10-conf-${String(m.confidence_level).toLowerCase()}">${_tnEsc(m.confidence_level)}</span>` : '';
```

**Problème** : Le contenu textuel (`${_tnEsc(m.confidence_level)}`) est bien échappé, mais l'injection dans l'attribut `class` (`tn-t10-conf-${String(m.confidence_level).toLowerCase()}`) ne l'est **pas**. Si `m.confidence_level` est contrôlable et contient `" onclick="alert(1)`, le HTML généré devient :
```html
<span class="tn-t10-conf tn-t10-conf-" onclick="alert(1)"">...</span>
```
Le `"` ferme l'attribut `class`, puis `onclick="alert(1)"` est interprété comme un nouvel attribut → XSS.

À comparer avec le code voisin L4499-4501 (`verdictTone`) qui, lui, applique bien `_tnEsc` dans l'attribut class :
```js
const verdictTone = String(kpi.tone || 'pass');
const verdictBadge = kpi.verdict
  ? `<span class="tn-t10-verdict tn-t10-verdict-${_tnEsc(verdictTone)}">...`   // ← échappé
```

**Impact** : En pratique, `confidence_level` provient de `e.confidence_badge.level` (server L37457), valorisé par la logique serveur (`'high'`, `'medium'`, `'low'`, `'sparse'`) — pas directement par une API externe. Le risque d'exploitation réelle est faible. Mais c'est une **faille structurelle** qui devient critique si la source de données change ou si un bug serveur laisse passer une valeur non-validée.

**Fix proposé** :
```js
const confCls = _tnEsc(String(m.confidence_level).toLowerCase());
const confBadge = m.confidence_level
  ? `<span class="tn-t10-conf tn-t10-conf-${confCls}">${_tnEsc(m.confidence_level)}</span>` : '';
```

Note : appliquer le même pattern à `tagCss = 'tn-t10-tag-' + reasonRaw.replace(/ /g, '')` (L4399) bien que `reasonRaw` soit aujourd'hui un enum serveur contrôlé.

**Effort** : 5 min | **Équipe** : JS

---

## Bugs MED (14) — À traiter dans le sprint suivant

| # | Bug | Fichier | Fix |
|---|---|---|---|
| M1 | `cursor: pointer !important` sur `.tn-t10-odds-box:hover` mais élément non cliquable (trap UX) | `pariscore.html` L20122-20127 | Retirer `cursor: pointer` OU ajouter `onclick` ouvrant le détail cotes |
| M2 | `filtered_out_by_diversity` ajouté au payload serveur (L37488) mais jamais affiché côté client | `pariscore.js` fetchTennisTop10 | Lire `data.filtered_out_by_diversity` et l'afficher dans le statut : "3 matchs masqués (diversité)" |
| M3 | `tn2RenderTopCards` (L16545-16600, ~55 lignes) dead code — confirmé par grep : jamais appelé | `pariscore.html` L16545-16600 | Supprimer (render actif = `_tnTop10Card` côté JS) |
| M4 | `AppCache.set('/api/v1/tennis/top10', data, ...)` clé mode-agnostique → stale-while-revalidate peut servir données d'un autre mode | `pariscore.js` L4790 + L4856 | Clé = `/api/v1/tennis/top10?mode=${_tnTop10Mode}` |
| M5 | `showMetricDetail` affiche un placeholder "Les données détaillées EWMA par match seront disponibles avec l'activation du module BSD." en production | `pariscore.js` L4731 | Soit implémenter le drawer avec données réelles, soit masquer les blocs `.ps-metric-xxl` cliquables tant que le module BSD n'est pas activé |
| M6 | `openPBets` n'a pas son propre handler ESC — dépend de `openTennisAnalysisModal` ESC handler (L7432) préalablement bindé. Si user clique `P_BETS` directement sans passer par la modale analyse, ESC ne ferme pas | `pariscore.html` L16603-16632 | Binder ESC dans `openPBets` (ou factoriser un helper `_bindEscHandler(overlayId, closeFn)`) |
| M7 | `pBetsOverlay` manque `role="dialog"` `aria-modal="true"` `aria-labelledby` (a11y) | `pariscore.html` L15951-15961 | Ajouter `role="dialog" aria-modal="true" aria-labelledby="pbet-header-title"` |
| M8 | `_tnT10Urgency` (server L26222) traite `start_time` nombre comme **ms** ; frontend `pariscore.js` L4474 traite nombre comme **seconds** (`new Date(m.start_time * 1000)`) — inconsistance | `server.js` L26222 + `pariscore.js` L4474 | Documenter le format côté serveur (ISO string recommandé) ou normaliser les deux côtés |
| M9 | `.tn-t10-prob-row` défini 2 fois à l'identique (L20034 + L20066) — L5 LOW précédent non fixé | `pariscore.html` L20034 | Supprimer la ligne 20034 |
| M10 | `_tnTop10AlertNewEntry` utilise `alert-toast` single-instance (L22079 `getElementById`) → si 2 alerts en <30s, la 2e overwrite la 1ère | `pariscore.js` L4682-4686 + L22075-22098 | Soit utiliser `_showAlertToast` (stack empilée L22103), soit queue les alerts |
| M11 | ui-avatars.com hard dependency (1er fallback `fixBrokenPlayerPhoto` L16128) — dépendance externe, timeout 3s si offline | `pariscore.js` L16128 | Sauter directement au fallback SVG local (supprimer le 1er fallback ui-avatars) |
| M12 | `.ps-metrics-row` inline `style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"` non responsive — L1/L2 LOW précédent non fixé | `pariscore.js` L4567 | Sortir le style inline + `@media (max-width:540px) { .ps-metrics-row { grid-template-columns: 1fr; } }` |
| M13 | `tn2-top-grid` a `aria-live="polite"` mais `fetchTennisTop10` fait `container.innerHTML = ...` (remplacement complet du subtree) → screen readers annoncent toutes les cartes à chaque poll 60s (spam) | `pariscore.html` L15824 | Soit `aria-live="off"` + ticker dédié pour annonces, soit diff DOM updates au lieu de innerHTML replace |
| M14 | `.tn-t10-date-badge` a `margin-bottom: 6px` (L20076) en plus du `gap: 6px` du parent `.tn-t10-card-header` (L19950) → double-spacing résiduel (M3 précédent partiellement fixé) | `pariscore.html` L20076 | `margin-bottom: 0` |

---

## Bugs LOW (13) — Polish

| # | Bug | Fichier | Fix |
|---|---|---|---|
| L1 | Magic numbers weights `W = { e: 0.20, ev: 0.30, elo: 0.20, stakes: 0.05, urgency: 0.15, move: 0.10 }` non calibrés / non testés | `server.js` L26295-26297 | Extraire dans config + tests unitaires |
| L2 | Magic thresholds `_tnT10Urgency` (0.3, 0.7, 0.9, 0.75, 0.5, 0.2) non calibrés | `server.js` L26219-26230 | Idem + tests Brier/calibration |
| L3 | `tagCss = 'tn-t10-tag-' + reasonRaw.replace(/ /g, '')` — fragile si `reasonRaw` contient chars spéciaux (aujourd'hui enum serveur) | `pariscore.js` L4399 | `_tnEsc(reasonRaw.replace(/[^A-Za-z]/g, ''))` ou hash |
| L4 | `chips.slice(0, 4)` magic number — aucun label "X chips masqués" | `pariscore.js` L4489 | Extraire constante + indicateur "+N" |
| L5 | `_sig` (L4881) inclut `m.live_score` qui n'existe pas dans le payload serveur — champ fantôme (silencieusement `undefined`) | `pariscore.js` L4881 | Retirer `m.live_score` du tableau ou ajouter le champ serveur |
| L6 | `Number(m.odds_p1).toFixed(2)` produit "NaN" si `odds_p1` non-coercible — guard `if (m.odds_p1 && m.odds_p2)` laisse passer les strings non numériques | `pariscore.js` L4534-4535 | `Number.isFinite(Number(m.odds_p1)) ? Number(m.odds_p1).toFixed(2) : '—'` |
| L7 | Commentaire "60s écoulées, warm-up initial..." (L37540) alors que le délai est `5_000` ms (L37539) — comment stale | `server.js` L37540 | Mettre à jour le commentaire |
| L8 | `_tnTop10Cache` est un `let` module-level (L26185) — pas synchronisé avec `globalThis.__tnTop10Cache` (cause racine de H3) | `server.js` L26185 | Soit `globalThis.__tnTop10Cache = _tnTop10Cache;` après déclaration, soit utiliser `globalThis` dès le départ |
| L9 | `_tnTop10AlertNewEntry` msg construit avec raw `m.player1`, `m.player2`, `m.reason` (sans `_tnEsc`) — safe via `showToast`→`textContent` mais brittle | `pariscore.js` L4680 | Si `showToast` change pour innerHTML un jour, XSS. Documenter ou sanitizer par défense |
| L10 | Strings "Moy. Top 10: 68.2%" (L4573) et "Moy. Top 10: 36.8%" (L4582) hardcoded dans le template | `pariscore.js` L4573, L4582 | Extraire dans config ou calculer dynamiquement |
| L11 | `try { ... } catch(_fe) { /* TimesFM enrichment non-bloquant */ }` (L4877) — erreur silencieuse sans `_trackCatch` | `pariscore.js` L4877 | `catch(_fe) { if (typeof _trackCatch === 'function') _trackCatch(_fe, 'fetchTennisTop10:forecast'); }` |
| L12 | `_tnTop10PrevTop3` (L4666) jamais reset dans `stopTennisTop10` — état persiste entre sessions, peut fire toasts sur "nouvelles entrées" qui sont juste le retour à un état précédent | `pariscore.js` L4666 + L4923 | Ajouter `_tnTop10PrevTop3 = [];` dans `stopTennisTop10` |
| L13 | `__previousTennisMatches` (L37516) est un `Map` mais typage non documenté ; risque de confusion avec `__tennisVBWarmMatches` (array, L37517) | `server.js` L37516-37517 | Commenter le type ou renommer `__previousTennisMatchesMap` |

---

## Plan d'action priorisé

### Sprint 1 — P0 (4 bugs HIGH, ~3h)

| # | Bug | Effort | Équipe |
|---|---|---|---|
| 1 | H1 — Migration onclick → `data-match-id` + event delegation | 30 min | JS |
| 2 | H2 — `stopTennisTop10()` dans `tn2SwitchTab` quand `tabId !== 'top'` | 5 min | JS/HTML |
| 3 | H3 — Fix NLP Injury Scraper (`_tnTop10Cache[mode].top10` au lieu de `globalThis.__tnTop10Cache[mode]`) | 10 min | Backend |
| 4 | H4 — `_tnEsc` sur `confidence_level` dans l'attribut `class` | 5 min | JS |

### Sprint 2 — P1 (14 bugs MED, ~5h)

| # | Bug | Effort |
|---|---|---|
| M1 | Retirer `cursor: pointer` sur odds-box (ou ajouter onclick) | 5 min |
| M2 | Afficher `filtered_out_by_diversity` dans le statut | 15 min |
| M3 | Supprimer `tn2RenderTopCards` dead code (~55 lignes) | 5 min |
| M4 | AppCache key avec mode | 10 min |
| M5 | `showMetricDetail` placeholder → implémenter ou masquer | 30 min |
| M6 | Handler ESC dans `openPBets` | 15 min |
| M7 | `role="dialog"` + `aria-modal` sur `pBetsOverlay` | 5 min |
| M8 | Normaliser `start_time` serveur/frontend | 20 min |
| M9 | Supprimer duplicate `.tn-t10-prob-row` | 1 min |
| M10 | Stack toasts ou queue alerts | 20 min |
| M11 | Sauter ui-avatars.com fallback | 10 min |
| M12 | Responsive `.ps-metrics-row` | 15 min |
| M13 | `aria-live`策略 pour `tn2-top-grid` | 15 min |
| M14 | `margin-bottom: 0` sur `.tn-t10-date-badge` | 1 min |

### Sprint 3 — P2 (13 bugs LOW, ~3h rolling)

Voir détail ci-dessus. Priorité : L8 (cause racine H3), L11 (wirer `_trackCatch`), L6 (defensive `Number.isFinite`), L5 (champ fantôme `_sig`).

---

## Points forts à conserver

1. **Architecture scoring multi-dimensions** (`_precomputeTop10Dims` + `computeScoreTop10Tennis`) — 6 dimensions (entropy, ev, elo, stakes, urgency, movement) avec poids par mode, dataGate sur complétude < 60%. Robuste et extensible.
2. **Cache multi-niveau serveur** : 3 modes (viewer 5min / bettor 3min / pwscr 5min) + warmer boot 5s + cron 5min + `__top10RebuildPromise` race-condition-safe via `Promise.race` + timeout 60s + finally cleanup.
3. **Stale-while-revalidate client** (AppCache L4856 : TTL 30s, staleTTL 120s) avec rendu immédiat depuis cache si container vide — évite flash "Chargement…".
4. **Skip-render si payload identique** (M13 fix précédent, L4880-4890) via signature JSON — évite flicker + perte hover à chaque poll 60s.
5. **Polling status `building`/`ready`/`stale`** (B1 fix, L4811-4833) avec timeout 10min + estimated_seconds adaptatif.
6. **Diversité tournoi** (`_applyTop10DiversityFilter` server L26345) — max 3 matchs/tournoi pour éviter qu'un tournoi monopolise le Top 10.
7. **Filtre top 120 ATP/WTA** (server L37477-37483) — exclut les matchs Challenger/ITF hors scope.
8. **Alerte nouvelle entrée Top 3** (`_tnTop10AlertNewEntry` L4668) avec debounce 30s (M18 fix) — UX notified des changements majeurs sans spam.
9. **3 modes FAN/PARIEUR/PW SCR** avec scoring et tri distincts (`pwscr` trie par `Math.max(powerscore_p1, powerscore_p2)` L37473).
10. **After-match cache invalidation** (L37494-37508) — quand un match live devient `finished`, le metrics cache des joueurs est invalidé.
11. **Hotfix v12.86 restructuration 3-zones** (header/body/footer) — solution structurelle propre au crash visuel grid zigzag.
12. **`_tnEsc` fonction centralisée** — utilisée partout dans le template, bonne pratique (mais insuffisante pour onclick JS, cf H1).
13. **AbortController** (H6 fix L4777-4779) sur `fetchTennisTop10` — annule les requêtes concurrentes sur mode switch mid-flight.
14. **Échappement apostrophe dans `_tnEsc`** (H7 fix L4372) — correct pour contextes HTML purs (`title`, `data-*`, contenu textuel).
15. **Cache-busting `?_=${Date.now()}`** (L4805) — évite les proxies cache.

---

## Recommandations stratégiques

1. **Migration globale onclick → event delegation** : H1 est le 3ᵉ bug XSS de la même famille (après H1 MATCHS et H5 LIVE). Le pattern `onclick="fn('${escaped}')"` est **structurellement faux** car les entités HTML sont décodées avant le parsing JS. La solution standard est `data-*` + `addEventListener`. Recommandation : audit global de tous les `onclick="...${...}..."` dans pariscore.js + pariscore.html, migration systématique.

2. **Cycle de vie timers SPA** : H2 révèle un pattern récurrent — `startX()` appelé sur entrée tab/page, `stopX()` appelé seulement sur sortie page. Pour une SPA multi-tabs, il faut `stopX()` sur **sortie tab** aussi. Recommandation : pattern `useTennisTabLifecycle(tabId)` factorisant start/stop par tab.

3. **`globalThis` vs module-scope** : H3 révèle que `globalThis.__tnTop10Cache` est référencé mais jamais assigné. Recommandation : lint rule ou convention — toute lecture `globalThis.__foo` doit être précédée d'une assignation `globalThis.__foo = ...` dans le même fichier (ou via un helper `getGlobal(key, fallback)`).

4. **Tests unitaires backend** : les magic numbers (L1, L2) et la structure de cache (H3) n'ont pas de tests. Recommandation : tests sur `computeScoreTop10Tennis`, `_precomputeTop10Dims`, `_applyTop10DiversityFilter`, et un smoke test du NLP Injury Scraper cron.

5. **`showMetricDetail` placeholder** (M5) : bloquer le clic tant que les données EWMA ne sont pas disponibles, plutôt que d'afficher un placeholder "en attente du module BSD" — confusion utilisateur.

6. **Unification `start_time`** : M8 — adopter ISO 8601 string comme format canonique dans tous les payloads serveur, et `new Date(iso)` côté frontend. Bannir les nombres Unix dans les payloads.

7. **`aria-live` strategy** : M13 — pour les conteneurs re-rendered fréquemment, préférer `aria-live="off"` + un ticker dédié qui annonce les changements importants (nouveau match dans le top 3, match qui commence).

8. **Dead code cleanup** : M3 `tn2RenderTopCards` (~55 lignes), L5 `_sig` champ fantôme, L11 (cf88a98 `renderTennisLive` mentionné dans audit LIVE) — un sprint de cleanup supprimerait ~150 lignes de code mort et faciliterait la maintenance.

9. **Toast stack** : M10 — la fonction `showToast` (L22075) utilise un seul `#alert-toast` element. La fonction `_showAlertToast` (L22103) stacke mais n'est pas appelée par `_tnTop10AlertNewEntry`. Unifier sur `_showAlertToast` pour tous les appels internes.

10. **Wirer `_trackCatch`** : L11 + plusieurs `catch (_) {}` silencieux dans `_refreshTop10Cache` (L37416, L37591). Le système `_trackCatch` existe (cf worklog task 12), il faut l'étendre à tous les catch silencieux du module TOP10.

---

## Vérification des fixes du rapport précédent (AUDIT_TOP_TENNIS_REPORT.md, cf88a98)

| Bug précédent | Statut | Vérification |
|---|---|---|
| H1 (!important responsive) | ✅ Fixé | `pariscore.html` L19885-19890 — `!important` retiré hors media query, conservé dans media query mobile |
| H2/H8 (sparkline template) | ✅ Fixé | `pariscore.js` L4628-4638 — template unique IIFE, plus de `<div>` non fermé |
| H3 (p-bets-btn width:100%) | ✅ Fixé | `pariscore.html` L4660-4662 — `width: auto; flex-shrink: 0; margin-left: auto;` |
| H4 (powerscore server alias) | ✅ Fixé | `server.js` L22094 — accepte `'pwscr'` et `'powerscore'` |
| H5 (showNotification → showToast) | ✅ Fixé | `pariscore.js` L4957-4965 — utilise `showToast` |
| H6 (AbortController) | ✅ Fixé | `pariscore.js` L4777-4779 — AbortController + abort précédent |
| H7 (_tnEsc apostrophe) | ❌ **Ineffectif** | `pariscore.js` L4372 — `&#39;` décodé par HTML parser avant JS, ne protège pas le contexte onclick. Voir H1 ci-dessus. |
| M1 (#0055cc hover) | ✅ Fixé | `pariscore.html` L20123-20125 — `#0077ff` + box-shadow |
| M2 (dead grid-column) | ✅ Fixé | `pariscore.html` L20106, L20138 — plus de grid-column mort |
| M3 (double-spacing) | ⚠️ Partiel | `.tn-t10-surface` L20062 `margin-bottom: 0` ✅, mais `.tn-t10-date-badge` L20076 `margin-bottom: 6px` persistant → M14 |
| M4 (gradient prob-fill) | ✅ Fixé | `pariscore.html` L20068 — `linear-gradient(90deg, #0077ff, #00e676)` |
| M5 (#64b5f6 bet-odds) | ✅ Fixé | `pariscore.html` L20147 — `color: #38bdf8` |
| M6 (transition card:hover) | ✅ Fixé | `pariscore.html` L19924 — `transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease` |
| M7 (clear _forecastTimer) | ✅ Fixé | `pariscore.js` L4926 |
| M8 (startTennisTop10 in showPage) | ✅ Fixé | `pariscore.js` L930 — n'appelle plus startTennisTop10 |
| M9 (AppCache.set dead) | ✅ Fixé | `pariscore.js` L4856 + L4790 — stale-while-revalidate implémenté |
| M10 (live sets_live:[]) | ✅ Fixé | `pariscore.js` L4416-4418 — placeholder "Score live en attente…" |
| M11 (cache en construction msg) | ✅ Fixé | `pariscore.js` L4846 |
| M12 (ESC handler modales) | ⚠️ Partiel | `pariscore.js` L7432-7447 — ESC pour analysis modal ✅, mais `openPBets` n'a pas son propre handler → M6 |
| M13 (hash skip render) | ✅ Fixé | `pariscore.js` L4880-4890 |
| M14 (odds-box onclick/aria) | ⚠️ Partiel | `pariscore.js` L4534-4535 — `aria-label` ajouté ✅, mais `cursor: pointer !important` (L20126) toujours là → M1 |
| M15 (meta variable morte) | ✅ Fixé | `pariscore.js` L4440 — comment "M15 fix — variable 'meta' supprimée" |
| M16 (diversity filter info) | ⚠️ Partiel | `server.js` L37488 — payload inclut `filtered_out_by_diversity` ✅, mais frontend ne l'affiche pas → M2 |
| M17 (tn-top10-status) | ✅ Fixé | `pariscore.html` L15816 — `<span id="tn-top10-status">` présent |
| M18 (toast debounce) | ✅ Fixé | `pariscore.js` L4671 — debounce 30s |
| L5 (.tn-t10-prob-row dup) | ❌ Non fixé | `pariscore.html` L20034 + L20066 → M9 |
| L7 (stray `}` after .ps-metric-xxl-value) | (non vérifié hors périmètre) | — |
| L8 (loading="lazy" photos) | ✅ Fixé | `pariscore.js` L4458, L4460, L4463, L4465 — `loading="lazy" decoding="async"` |
| L9 (tooltip 6e dim elo) | ✅ Fixé | `pariscore.js` L4448 — `(d.elo != null ? '\n\Elo: ' + d.elo : '')` |
| L13 (confidence_level.toLowerCase crash) | ✅ Fixé | `pariscore.js` L4428 — `String(m.confidence_level).toLowerCase()` |
| L22 (ui-avatars → SVG local) | ❌ Non fixé | `pariscore.js` L16128 — ui-avatars.com encore 1er fallback → M11 |
| L1/L2 (responsive .tn-t10-card-body / .ps-metrics-row) | ⚠️ Partiel | `.tn-t10-card-body` media query L19892-19896 ✅, mais `.ps-metrics-row` inline non responsive → M12 |

**Score récapitulatif fixes précédents** : 7/8 HIGH ✅ (H7 ineffectif), 12/18 MED ✅, 8/17 LOW ✅. Taux de fix global ≈ 65%. Le rapport v2 couvre les 33 bugs résiduels + 11 nouveaux bugs identifiés (4 HIGH + 7 MED/LOW).

---

*Ce rapport est destiné à l'équipe ingénierie pour debug et amélioration de l'onglet TOP Tennis. Les 4 bugs HIGH doivent être traités en Sprint 1 priorité absolue avant toute nouvelle feature.*
