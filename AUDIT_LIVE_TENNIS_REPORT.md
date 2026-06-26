# Audit Complet — Onglet LIVE Tennis

> **Date** : 2026-06-25
> **Auditeur** : Senior Engineer (audit Explore)
> **Périmètre** : `pariscore.js` L1602-2272, L3568-3569, L3847-3867, L26296-26305 ; `pariscore.html` L15795-15809 (panel LIVE), L16339-16383 (`tn2SwitchTab`), L16412-16543 (`tn2RenderLiveCards`), L16855-16874 (patch `renderTennisLive`), L24710-24723 (dead wrapper) ; `server.js` L22812-22818 (cache + TTL), L24162-24766 (`pollTennisLive`), L38906-38914 (routes `/api/v1/tennis/live` + `/live-raw`), L40221-40257 (routes livescore), L49729-49730 (cron boot).
> **Verdict global** : Fonctionnel par chance — 5 bugs **HIGH** (3 cassent l'UX user-facing, 2 sont des risques sécu/perf), 15 MED, 16 LOW. Beaucoup de code mort (`renderTennisLive`, `startTennisLive`, scrollbar sync, CSS `#tennis-live-table`) lié à une migration incomplète vers le nouveau rendu card `tn2RenderLiveCards`.

---

## Synthèse exécutive

| Domaine | HIGH | MED | LOW | Score |
|---|---|---|---|---|
| Code/Architecture | 3 | 9 | 11 | 4/10 |
| QA Fonctionnel | 1 | 4 | 3 | 4/10 |
| Design UI / A11y | 1 | 2 | 2 | 5/10 |
| Sécurité | 1 | 0 | 0 | 6/10 |
| **Total unique** | **5** (H1-H5) + 1 sécu | **15** | **16** | **4.5/10** |

**Recommandation** : Sprint dédié P0 (5 bugs HIGH, ~3h) avant toute nouvelle feature. L'onglet LIVE fonctionne aujourd'hui par effet de bord d'un patch monkey-patché — fragile.

---

## Bugs HIGH (5) — À traiter en priorité absolue

### H1 — Status badge `tn2-live-status` jamais mis à jour (ID mismatch)

**Fichiers** :
- `pariscore.html` L15799 : `<span class="tn2-refresh-time" id="tn2-live-status">—</span>`
- `pariscore.js` L2223 : `const statusEl = document.getElementById('tennis-live-status');`
- `pariscore.js` L2252, L2256 : `if (statusEl) statusEl.textContent = ...`

**Code exact** :
```js
// pariscore.js L2222-2225
async function tickTennisLive() {
  const statusEl = document.getElementById('tennis-live-status');  // ← toujours null
  try {
    if (statusEl) statusEl.textContent = 'Mise à jour…';           // ← jamais exécuté
```

```html
<!-- pariscore.html L15799 -->
<span class="tn2-refresh-time" id="tn2-live-status">—</span>
```

**Impact** : Le badge de statut en haut de l'onglet LIVE reste à `—` indéfiniment. L'utilisateur n'a aucun retour visuel sur :
- Le nombre de matchs live
- La source des données (BSD / LiveScore)
- L'heure du dernier refresh
- Les erreurs réseau (`'Erreur réseau'` à L2256 jamais affiché)

Conséquence user-facing : onglet qui paraît "mort" ou cassé. ~100% des utilisateurs impacted.

**Fix proposé** :
```js
// Option A (quick fix) : aligner le lookup JS sur l'ID HTML
const statusEl = document.getElementById('tn2-live-status');

// Option B (meilleure) : `tn2RenderLiveCards` met à jour le statut lui-même
// (puisque c'est LA fonction qui rend réellement les cards)
// Ajouter dans tn2RenderLiveCards après la boucle :
var statusEl = document.getElementById('tn2-live-status');
if (statusEl) statusEl.textContent = sorted.length + ' match(s) · ' + new Date().toLocaleTimeString('fr-FR');
```

### H2 — Auto-refresh 30s JAMAIS démarré (`startTennisLive` jamais appelé)

**Fichiers** :
- `pariscore.js` L2264-2268 : `function startTennisLive() { ... setInterval(tickTennisLive, 30 * 1000); }`
- `pariscore.js` L930 : `if (pageId === 'tennis') { tn2SwitchTab('matchs'); ... }` — n'appelle jamais `startTennisLive()`
- `pariscore.js` L867 : `if (pageId !== 'tennis' && typeof stopTennisLive === 'function') stopTennisLive();` — no-op car `_tennisTimer` reste `null`
- `pariscore.html` L16357-16359 : `case 'live': if (typeof tickTennisLive === 'function') tickTennisLive(); break;` — fetch unique, pas de timer

**Code exact** :
```js
// pariscore.js L1603 + L2264-2272
let _tennisTimer = null;                              // ← reste null ad vitam
function startTennisLive() {
  tickTennisLive();
  if (_tennisTimer) clearInterval(_tennisTimer);
  _tennisTimer = setInterval(tickTennisLive, 30 * 1000);  // ← JAMAIS EXÉCUTÉ
}
function stopTennisLive() {
  if (_tennisTimer) { clearInterval(_tennisTimer); _tennisTimer = null; }  // no-op
}
```

```js
// pariscore.html L16357-16359 — case 'live' de tn2SwitchTab
case 'live':
  if (typeof tickTennisLive === 'function') tickTennisLive();  // ← fetch unique, pas de timer
  break;
```

**Impact** : Aucun refresh automatique des scores live. Si un match évolue pendant que l'utilisateur regarde l'onglet, il doit cliquer manuellement 🔄 pour voir le nouveau score. Or **le ticket marketing de l'onglet LIVE est précisément la fraîcheur temps-réel**. Bug UX majeur.

Note : le CHANGELOG.md L1618 mentionne « `startTennisLive` / `stopTennisLive` montés/démontés via `showPage('tennis')` » — cette doc est **fausse** depuis qu'au moins un refactor a remplacé l'appel par `tn2SwitchTab('matchs')`.

**Fix proposé** :
```js
// Option A (quick) : brancher startTennisLive dans tn2SwitchTab case 'live'
// pariscore.html L16357-16359
case 'live':
  if (typeof startTennisLive === 'function') startTennisLive();  // ← fetch + timer 30s
  break;
// + ajout cleanup dans case autres tabs :
//   if (typeof stopTennisLive === 'function') stopTennisLive();
```

### H3 — Race condition : `fetch` sans `AbortController` + pas de garde anti-re-entry

**Fichiers** :
- `pariscore.js` L2227 : `const r = await fetch('/api/v1/tennis/live', { headers: { 'Accept': 'application/json' } });`
- `pariscore.js` L2236 : `const ls = await _fetchLivescoreFallback();`
- `pariscore.html` L15801 : `<button class="tn2-btn-glass" onclick="tickTennisLive()">🔄</button>` — pas de debounce/disabled

**Code exact** :
```js
// pariscore.js L2222-2229
async function tickTennisLive() {
  const statusEl = document.getElementById('tennis-live-status');
  try {
    if (statusEl) statusEl.textContent = 'Mise à jour…';
    const r = await fetch('/api/v1/tennis/live', { headers: { 'Accept': 'application/json' } });
    //                          ↑ pas de signal:AbortController, pas de garde if (_tennisFetching) return
```

**Impact** :
1. **Clics spam 🔄** : chaque clic déclenche un fetch ; les réponses peuvent arriver dans le désordre. Le `renderTennisLive` (et donc `tn2RenderLiveCards`) du plus ancien peut écraser la donnée plus récente.
2. **Switch rapide d'onglet** : user ouvre LIVE → fetch part → user switch vers MATCHS → fetch revient → `window._tennisLastFetch` est écrasé avec la donnée live (peut casser l'onglet MATCHS qui consomme `_tennisLastFetch` via `patchTennisLive`).
3. **Navigation hors tennis pendant fetch** : gaspillage bandwidth + render sur panel caché.

**Fix proposé** :
```js
let _tnLiveAbort = null;
let _tnLiveInFlight = false;
async function tickTennisLive() {
  if (_tnLiveInFlight) return;                 // anti-re-entry
  _tnLiveInFlight = true;
  if (_tnLiveAbort) _tnLiveAbort.abort();
  _tnLiveAbort = new AbortController();
  try {
    const r = await fetch('/api/v1/tennis/live', {
      headers: { 'Accept': 'application/json' },
      signal: _tnLiveAbort.signal
    });
    // ...
  } catch (e) {
    if (e.name === 'AbortError') return;       // ne pas afficher "Erreur réseau"
    // ...
  } finally {
    _tnLiveInFlight = false;
  }
}
// + bouton 🔄 : disabled pendant le fetch (visuel "…")
```

### H4 — Aucun feedback utilisateur en cas d'erreur réseau (grille figée sur "Chargement…")

**Fichiers** :
- `pariscore.js` L2256-2260 (catch block de `tickTennisLive`)
- `pariscore.js` L2223 (statusEl toujours null — cf H1)
- `pariscore.html` L15807 (`<div class="tn2-loading">Chargement...</div>`)

**Code exact** :
```js
// pariscore.js L2244-2261 (catch)
} catch (e) {
  console.warn('[Tennis] fetch error:', e.message);
  try {
    const ls = await _fetchLivescoreFallback();
    if (ls.length) { /* ... renderTennisLive(ls); return; */ }
  } catch (lsErr) { console.warn('[Tennis] livescore fallback (catch):', lsErr.message); }
  if (statusEl) statusEl.textContent = 'Erreur réseau';   // ← skipped (statusEl null per H1)
  const tbody = document.getElementById('tennis-live-tbody'); // ← toujours null
  if (tbody && !window._tennisLastFetch.length) {            // ← toujours false
    tbody.innerHTML = '<div role="row">...Erreur de chargement...</div>';
  }
  // → AUCUN rendu d'erreur dans tn2-live-grid (qui est le vrai conteneur)
}
```

**Impact** : Scénario pire cas — au 1er chargement, si `/api/v1/tennis/live` ET `/api/v1/tennis/livescore/day` tombent en erreur (502, timeout, DNS, etc.) :
- Console affiche 2 warnings
- Badge statut reste `—` (cf H1)
- `tn2-live-grid` garde son contenu initial `<div class="tn2-loading">Chargement...</div>` indéfiniment
- L'utilisateur ne sait pas qu'il y a eu une erreur, attend indéfiniment

Sur scénario subsequent (data déjà chargée, refresh échoue) : la grille reste sur les anciennes cards sans indication de fraîcheur → user croit voir du temps réel alors qu'il voit un snapshot figé.

**Fix proposé** : dans le catch, mettre à jour `tn2-live-grid` directement :
```js
const grid = document.getElementById('tn2-live-grid');
if (grid && !window._tennisLastFetch.length) {
  grid.innerHTML = '<div class="tn2-empty" style="color:var(--red,#ff4d4d);">'
    + 'Erreur de chargement. '
    + '<button class="tn2-btn-glass" onclick="tickTennisLive()">Réessayer</button>'
    + '</div>';
}
```

### H5 — XSS via `matchId` injecté dans attribut `onclick` (échappement HTML-only, pas JS-safe)

**Fichiers** :
- `pariscore.html` L16503-16504 : `var matchId = escapeHtml(String(m.id || ...)); html += '<div ... onclick="openTennisDetail(\'' + matchId + '\')" ...>'`
- `pariscore.html` L16850-16853 : `function escapeHtml(str) { ... replace(/'/g, '&#39;'); }` — encode `'` en `&#39;` (HTML-safe mais PAS JS-safe dans attribut event handler)

**Code exact** :
```js
// pariscore.html L16503-16504
var matchId = escapeHtml(String(m.id || m.match_id || m.bsd_id || m.event_id || ''));
html += '<div class="tn2-match-card" data-match-id="' + matchId + '" onclick="openTennisDetail(\'' + matchId + '\')" style="cursor:pointer;">';
```

```js
// pariscore.html L16850-16853
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

**Impact** : `escapeHtml` convertit `'` en `&#39;`. Quand ce matchId échappé est placé dans un attribut HTML `onclick="openTennisDetail('...')"`, le parseur HTML décode l'entité **avant** l'exécution JS. Donc `m.id = "'); alert('xss"` devient `onclick="openTennisDetail(''); alert('xss')"` → exécution arbitraire JS.

**Exploitation pratique** : aujourd'hui `m.id` provient du cache serveur `_tennisLiveCache.data` (IDs ESPN/BSD numériques, LiveScore préfixé `ls:`). Risque réel faible SAUF si :
- Un attaquant compromet l'upstream ESPN/BSD/LiveScore (MITM, DNS poisoning)
- Un bug de normalisation serveur laisse passer une valeur user-controlled
- Le cache serveur est pollué par la route debug `/api/v1/_debug/tennis-rehydrate-test` (server.js L40492-40545) qui accepte des `target.id` du cache VB (non-validés strictement)

Même pattern que H1 (MATCHS audit) — defense-in-depth cassée côté frontend.

**Fix proposé** (même que H1 MATCHS) : migrer vers `data-*` + event delegation
```js
// Render
html += '<div class="tn2-match-card" data-match-id="' + escapeHtml(matchId) + '" style="cursor:pointer;">';
// Pas d'onclick inline

// Event delegation (à poser une fois au setup)
document.getElementById('tn2-live-grid').addEventListener('click', function(e) {
  var card = e.target.closest('.tn2-match-card');
  if (!card) return;
  var id = card.dataset.matchId;
  if (id) openTennisDetail(id);
});
```

---

## Bugs MED (15) — À traiter dans le sprint suivant

### Code/Architecture (9)

| # | Bug | Fichier | Fix |
|---|---|---|---|
| M1 | `renderTennisLive` (L2135-2220, 85 lignes) toujours bail-out car `#tennis-live-tbody` n'existe pas en HTML. Ne survit que via le wrapper L16862 qui appelle `tn2RenderLiveCards` après. Code mort maintenu en charge mentale. | `pariscore.js` L2135-2220 | Supprimer `renderTennisLive` + son wrapper. Rendre `tn2RenderLiveCards` seule source de vérité. |
| M2 | `startTennisLive` (L2264-2268) jamais appelée → `_tennisTimer` reste `null` → `stopTennisLive` (L2270-2272) est un no-op (lié à H2 mais point distinct : code mort). | `pariscore.js` L2264-2272 | Soit brancher (cf H2 fix), soit supprimer. |
| M3 | Dual-scrollbar sync pour `#tennis-live-table` (L26296-26305) cherche élément inexistant → bloqué par `if (tnLvScrollTop && tnLvGrid)` → silently skipped. | `pariscore.js` L26296-26305 | Supprimer le bloc mort + nettoyer 50+ règles CSS `#tennis-live-table` (L5081-20300). |
| M4 | `_tn2Patch` (pariscore.html L16855-16874) wrap `window.renderTennisLive` APRÈS que `tn2SwitchTab('live')` ait été appelé dans le même handler DOMContentLoaded. Ne fonctionne que parce que `tickTennisLive` est `async` et defer son render après le `await fetch`. Fragile : un refactor qui rendrait le render synchrone (optimistic UI) casserait silencieusement l'onglet LIVE. | `pariscore.html` L16868-16870 | Inverser l'ordre : `_tn2Patch()` AVANT `tn2SwitchTab('live')`. Ou mieux : supprimer le patch en rendant `tn2RenderLiveCards` appelée directement par `tickTennisLive`. |
| M5 | `tn2SwitchTab('live')` appelé inconditionnellement sur `DOMContentLoaded` (L16869), même si l'utilisateur est sur homepage / football / basketball. Déclenche un fetch `/api/v1/tennis/live` inutile sur 100% des page loads. | `pariscore.html` L16868-16870 | Garde : `if (document.getElementById('page-tennis')?.style.display !== 'none') tn2SwitchTab('live');` Ou déplacer dans `showPage('tennis')`. |
| M6 | `setTennisSourceFilter` (pariscore.js L1850-1862) et filtre source dans `tn2RenderLiveCards` (L16420-16428) : code mort, plus aucun chip `.tn-src-filter-chip` n'existe en HTML (commentaire `<!-- src-filters removed v12.81 -->` L15803). | `pariscore.js` L1850-1862 + `pariscore.html` L16420-16428 | Soit ressusciter les chips (besoin UX ?), soit supprimer le code mort + le filter `m.source` dans `tn2RenderLiveCards` (attention : `m.source` n'est de toute façon pas peuplé côté serveur pour ESPN/BSD → filter cassé aussi). |
| M7 | `AppCache.set('/api/v1/tennis/live', data, 30000, 120000)` (L2230) écrit en cache mais **jamais lu** (grep confirmé : seul `AppCache.set` existe pour cette clé). Écriture ghost. | `pariscore.js` L2230 | Soit implémenter un read optimistic avant le fetch (rendu instantané), soit supprimer la ligne. |
| M8 | `patchTennisLive` (L3847-3867) appelée à chaque `tickTennisLive` mais bail-out immédiat sur `if(!tbody)return;` quand l'utilisateur n'est pas sur l'onglet PARIS (VB). ~30ms de wasted CPU toutes les 30s. | `pariscore.js` L2242 | Garde avant l'appel : `if (document.getElementById('tennis-vb-tbody')) patchTennisLive();` |
| M9 | Route `/api/v1/tennis/live` (server.js L38906-38910) ne set pas `Cache-Control: no-store`. `jsonResponse` (L21024-21039) ne l'ajoute pas non plus. Le navigateur peut heuristiquement cacher la réponse (10% de l'âge depuis Last-Modified), battant en brèche le poll 30s client. | `server.js` L38906-38910 | `res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')` avant `jsonResponse`. Ou ajouter un paramètre `noStore` à `jsonResponse`. |

### QA Fonctionnel (4)

| # | Bug | Scénario | Fix |
|---|---|---|---|
| Q1 | Checkbox `tennis-live-only` (L15802) n'a **pas de handler `onchange`**. Le user (un)check → rien ne se passe jusqu'au prochain refresh (qui n'arrive jamais auto, cf H2). `tn2RenderLiveCards` (L16421-16427) lit bien la valeur, mais n'est pas re-déclenchée. | User décoche "Live uniquement" pour voir les matchs à venir → rien ne change | Ajouter `onchange="tn2RenderLiveCards(window._tennisLastFetch||[])"` sur l'input. |
| Q2 | Bouton 🔄 (L15801) n'a pas de state "loading" : pas de `disabled` pendant le fetch, pas de spinner. User peut spammer (cf H3) sans feedback visuel. | User clique 🔄 → bouton reste identique → doute si ça a marché | Spinner/disabled pendant fetch, badge "MAJ il y a Xs" (cf L28 MATCHS audit). |
| Q3 | `tn2RenderLiveCards` n'affiche pas le badge source (BSD/ESPN/LiveScore/AISCORE). Le dead `renderTennisLive` l'affichait via `_tnRenderSourceBadge(m)` (L2198). L'utilisateur ne peut plus évaluer la fiabilité de la donnée. | User voit un score live mais ne sait pas s'il vient de BSD (officiel) ou LiveScore (proxy) | Ajouter le badge source dans la card `tn2-match-card`. |
| Q4 | Statut du refresh non propagé dans `tn2RenderLiveCards` : même si H1 est fixé, la fonction qui rend réellement les cards ne met PAS à jour `#tn2-live-status`. Le badge resterait `—` même après fix H1 option A. | Toutes les 30s (après fix H2), cards se rafraîchissent mais badge reste `—` | Ajouter la mise à jour du badge à la fin de `tn2RenderLiveCards` (cf H1 option B). |

### Design UI / A11y (2)

| # | Bug | Fix |
|---|---|---|
| D1 | `<img class="athlete-live-img" src="https://ui-avatars.com/api/?...">` (L16512, L16524) : pas d'attribut `onerror`. Si `ui-avatars.com` est down ou si l'URL ESPN CDN 404, image cassée 🖼️ avec border vide. Dépendance externe sans fallback. | Ajouter `onerror="this.onerror=null; this.src='data:image/svg+xml;base64,...';"` (SVG data-URI local avec initiales, cf L22 MATCHS audit). |
| D2 | `<button class="tn2-btn-glass" onclick="tickTennisLive()">🔄</button>` (L15801) sans `aria-label` ni `title`. Screen readers annoncent « 🔄 button » — incompréhensible. | `aria-label="Rafraîchir les matchs en direct" title="Rafraîchir"`. |

---

## Bugs LOW (16) — Polish

### Code (11)

| # | Bug | Fix |
|---|---|---|
| L1 | Magic numbers dans `tn2RenderLiveCards` : `prob=50` défaut (L16481), `(_fairP1 - 0.5) * 200` (L16497), `ev >= 3 ? 'vapeur' : ev > 0 ? 'valeur' : 'neutre'` (L16500). | Extraire dans `const TN_LIVE_PROB_DEFAULT = 50` etc. |
| L2 | Inline styles massifs dans `tn2RenderLiveCards` (L16504-16540) : `style="cursor:pointer;"`, `style="border-left:4px solid ...;"`, etc. | Migrer vers classes CSS dédiées (`.tn2-live-card`, `.tn2-live-card--vapeur`). |
| L3 | `var` partout dans `tn2RenderLiveCards` (L16412-16543) et le reste du bloc inline. Style pré-ES6. | Migration `const`/`let` progressive. |
| L4 | Commentaire mort `<!-- src-filters removed v12.81 -->` (L15803). | Supprimer. |
| L5 | Duplication de code : `escapeHtml` (pariscore.html L16850) vs `_escTennis` (pariscore.js L1606). Même logique. | Mutualiser (exposer `_escTennis` en global et l'utiliser partout). |
| L6 | 50+ règles CSS `#tennis-live-table ...` (pariscore.html L5081-20300) ciblent un élément inexistant. ~5 KB de CSS mort. | Nettoyer dans le même sprint que M3. |
| L7 | Wrapper `_origTn2SwitchTab` (L24717-24723) wrap `tn2SwitchTab` pour appeler `initTennisLive` sur tab 'paris'. Mais `initTennisLive` (L24710-24714) ne fait rien car `#tennis-live-section` n'existe pas. Wrapper fantôme. | Supprimer L24710-24723. |
| L8 | `_tennisTimer` déclaré avec `let` (L1603) au top-level. Si on garde `startTennisLive` (cf M2), devrait être encapsulé dans une factory ou un module. | Refactor minimal. |
| L9 | Hardcoded 30s server-side poll `setInterval(() => pollTennisLive(), 30 * 1000)` (server.js L49729). Pas overridable env. | `const TENNIS_POLL_MS = Number(process.env.TENNIS_POLL_MS) || 30000;` |
| L10 | `tn2RenderLiveCards` rend TOUTES les cards d'un coup (L16454 `for (var i = 0; i < sorted.length; i++)`). Pas de virtualisation. Sur 50+ matchs ATP+WTA, peut ramer sur mobile low-end. | Limit à 30 cards + bouton "Voir plus". |
| L11 | `tickTennisLive` appelle `try { patchTennisLive(); } catch (_) {}/*TN_UNIFY_TICK*/` (L2242) à chaque tick. Wrapper `try/catch` silencieux sans `_trackCatch`. Incohérent avec la policy P1.1 (25 catch wirés). | `catch (e) { _trackCatch && _trackCatch('tennis', 'patchTennisLive_tick', e); }` |

### QA (3)

| # | Bug | Fix |
|---|---|---|
| L12 | Checkbox `tennis-live-only` (L15802) : pas de `aria-label` sur l'`<input>`. Le `<label>` contient le texte mais pas de `for`/`id` explicite (input est imbriqué). OK pour a11y mais conventionnellement on externalise. | `<label for="tennis-live-only">…</label><input id="tennis-live-only" ...>` |
| L13 | `tn2-live-grid` `<div class="tn2-loading">Chargement...</div>` (L15807) n'a pas d'indicateur de spinner animé. Juste du texte. | Spinner SVG branded (cf Q6 MATCHS audit). |
| L14 | `tn2RenderLiveCards` ne distingue pas "0 matchs live" (brisé) de "0 matchs live" (réellement aucun live). Affiche `'Aucun match en direct'` (L16416) dans les 2 cas. | Ajouter un timestamp "MAJ il y a Xs" pour que l'utilisateur vérifie la fraîcheur. |

### Design (2)

| # | Bug | Fix |
|---|---|---|
| L15 | Card `tn2-match-card` (L16504) n'a pas de `aria-live`. Si un score change, les screen readers ne l'annoncent pas. | `aria-live="polite" aria-atomic="true"` sur la zone score. |
| L16 | Le bouton 🔄 (L15801) a un emoji 🔄 mais pas d'animation de rotation pendant le fetch. | `transform: rotate(360deg)` animé pendant fetch via class `is-loading`. |

---

## Plan d'action priorisé

### Sprint 1 — P0 (5 bugs HIGH, ~3h)

| # | Bug | Effort | Équipe |
|---|---|---|---|
| 1 | H1 — Status badge ID mismatch (`tennis-live-status` → `tn2-live-status`) + wiring dans `tn2RenderLiveCards` (Q4 en bonus) | 15 min | JS |
| 2 | H2 — Brancher `startTennisLive` dans `tn2SwitchTab('live')` + cleanup dans case autres tabs | 15 min | JS |
| 3 | H3 — `AbortController` + anti-re-entry + bouton 🔄 disabled pendant fetch | 30 min | JS |
| 4 | H4 — Erreur réseau : mettre à jour `tn2-live-grid` directement dans le catch avec bouton "Réessayer" | 15 min | JS |
| 5 | H5 — XSS `matchId` onclick : migration `data-match-id` + event delegation | 30 min | JS |

### Sprint 2 — P1 (15 bugs MED, ~6h)

Traitement par bloc :
- **Code mort cleanup** (M1, M2, M3, M6, M7, L4, L6, L7) — ~2h — Supprimer `renderTennisLive` (85 lignes), `startTennisLive`/`stopTennisLive` si H2 fix prend le relais, dual scrollbar, CSS `#tennis-live-table` (50+ règles), `setTennisSourceFilter`, `AppCache.set` ghost, `initTennisLive` wrapper. ~250 lignes/5 KB CSS supprimés.
- **Fix comportementaux** (M4, M5, M8, M9, Q1, Q2, Q3, Q4) — ~3h
- **A11y / robustesse** (D1, D2) — ~1h

### Sprint 3 — P2 (16 bugs LOW, ~3h rolling)

Polish et finition — traiter progressivement, surtout le cleanup `var`→`const` et l'extraction de magic numbers.

---

## Points forts à conserver

1. **Architecture de cache serveur solide** : `_tennisLiveCache` (server.js L22817) est rafraîchi par cron 30s (L49729), avec garde anti-re-entry `_isFetchingTennis` (L22818, L24163). Séparation claire entre le poll serveur et la route API.
2. **Fallback multi-sources** : `tickTennisLive` essaie BSD puis LiveScore (`_fetchLivescoreFallback`), le serveur `pollTennisLive` merge BSD+ESPN+MatchStat Challenger. Résilience réelle.
3. **Helper `_tnGetServingIdx`** (pariscore.js L2367-2395) : résolution robuste du serveur courant, tolérant aux variantes de payload (`serving:1`, `serving:'1'`, `player1.is_serving:true`, nested `_live.serving`). Belle défensive programming.
4. **Wrapper `_tn2Patch`** (pariscore.html L16855-16874) : même si fragile (cf M4), l'idée d'un point d'extension pour brancher un nouveau renderer sans toucher au legacy est bonne — il suffit de la solidifier.
5. **Card design `tn2-match-card`** : prob bar + EV + verdict + photos + sets/games/points = dense mais lisible. Responsive via `tn2-grid-3` → `tn2-grid-2` → `1fr` (pariscore.html L23590, L23597).
6. **KPI auto-update** : `tn2UpdateKPI` (L16385-16394) propagé depuis `tn2RenderLiveCards` (L16442-16451) → cohérence entre header KPIs et contenu.
7. **`_escTennis`** (pariscore.js L1606-1610) : escape HTML complet (5 chars) — correct pour les contextes HTML text/attribute. (NB : ne pas l'utiliser dans du JS inline, cf H5.)
8. **TTL cache serveur explicite** : `TENNIS_LIVE_TTL_MS = 30 * 1000` (L22812), aligné avec le poll client et le poll serveur. Cohérent.
9. **Sécurité headers sur `jsonResponse`** (server.js L21033-21036) : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, CSP stricte. Bon baseline.

---

## Recommandations stratégiques

1. **Unifier le rendu LIVE** : supprimer `renderTennisLive` (dead) et faire de `tn2RenderLiveCards` LA fonction de rendu. `tickTennisLive` appelle directement `tn2RenderLiveCards` sans passer par un patch. Élimine H5 (XSS via le patch), M4 (fragilité), M1/M6 (code mort). Effort : 2h, ROI énorme.

2. **Composant `LiveCard` réutilisable** : la card `tn2-match-card` (L16504-16540) partage 80% du markup avec la card TOP (L16577-16596). Extraire un helper `_renderTennisCard(m, opts)` paramétrable (variant, showEV, showPhoto, showSourceBadge). Réduit la duplication et garantit la cohérence visuelle.

3. **Event delegation globale** : au lieu d'`onclick` inline sur chaque card (H5), poser UNE fois un listener sur `#tn2-live-grid` qui lit `data-match-id`. Pattern appliquable à tous les onglets tennis (MATCHS, TOP, PARIS) → réduit la surface XSS, facilite l'a11y, améliore les perf (1 listener vs N).

4. **Auto-refresh piloté par visibilité** : utiliser `document.visibilityState` (Page Visibility API) pour pauser le poll 30s quand l'onglet navigateur est en arrière-plan. Économise ~50% des fetch en moyenne. Couplé avec un `requestIdleCallback` pour le rendu.

5. **Source filter ressuscité ou supprimé** : le code de filtre source (M6) existe côté JS+CSS mais pas d'UI. Décider : (a) ressusciter les chips `tn-src-filter-chip` si besoin user, (b) supprimer définitivement sinon. État actuel = mi-chemin = pire des deux.

6. **Cache optimistic côté client** : `AppCache.set` (M7) écrit mais ne lit pas. Implémenter : au tick, lire AppCache → render immédiat (perçu instantané) → fetch en arrière-plan → render diff à la réponse. UX hautement améliorée pour connexions lentes.

7. **Telemetry sur `tickTennisLive`** : wirer `_trackCatch('tennis', 'tickTennisLive', e)` (cf L11) + counters `live_fetch_ok` / `live_fetch_err` / `live_livescore_fallback` dans le dashboard admin P1.2 (server.js L34438). Permet de monitorer la santé réelle de l'onglet LIVE en production.

8. **Tests E2E** : scénarios minimum à automatiser :
   - Ouverture onglet LIVE → cards affichées en <2s
   - Clic 🔄 pendant fetch → pas de double-render
   - Switch LIVE→MATCHS→LIVE → pas de fuite `_tennisTimer` (après fix H2)
   - Fetch 502 → message d'erreur affiché avec bouton "Réessayer"

---

*Ce rapport est destiné à l'équipe ingénierie pour debug et amélioration de l'onglet LIVE Tennis. Référence format : `AUDIT_MATCHS_TENNIS_REPORT.md`.*
