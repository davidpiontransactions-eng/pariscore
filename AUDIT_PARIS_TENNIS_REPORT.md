# Audit Complet — Onglet PARIS (Tennis Value Bets / Paris Recommandés)

> **Date** : 2026-06-25
> **Auditeur** : Senior Reviewer (Explore agent — task 16-c)
> **Périmètre** :
> - `pariscore.js` L868 (stop hook), L1429 + L1495-1514 (`chooseSport`/`applyTennisPreset`), L2275-2292 (filtres), L3555-3621 (helpers live/unify), L3847-3867 (`patchTennisLive`), L3898-4094 (`renderTennisValueBets`), L4220-4301 (`tickTennisValueBets`/`start`/`stop`), L1885-1893 (`_tnFavBtn`), L1896-1920 (`_tnExpandDrawer`), L1937-1965 (`_tnRenderBSDOddsSection`), L28796-28821 (snapshot/restore filtres), L7440-7448 (handler Escape), L1590 (hydrateHubCounters)
> - `pariscore.html` L15733-15734 (tab button), L15830-15874 (panel tab PARIS), L15951-15961 (modal P_BETS), L16339-16383 (`tn2SwitchTab`), L16590-16763 (`openPBets`/`closePBets`/`renderPBetsV2`/`renderPBetsLegacy`)
> - `server.js` L22298-22378 (route `/api/v1/predictions/p-bets/`), L37161-37165 (cache `_tennisVBCache`/TTL), L37302-37341 (`buildTennisValueBets` + warmer), L3895-3908 (`_pBetsCache` + invalidation), L19597-19600 (gate auth tennis), L37538-37565 (boot warmer + `__tennisVBWarmMatches`), L40347-40355 (route `/api/v1/tennis/value-bets`)
> **Verdict global** : Fonctionnel en régime nominal, **5 bugs HIGH** (XSS résiduel + checkboxes fantômes + 2 leaks de timer + race condition), **14 MED**, **12 LOW**

---

## Synthèse exécutive

| Domaine | HIGH | MED | LOW | Score |
|---|---|---|---|---|
| Code/Architecture | 4 | 8 | 8 | 5.5/10 |
| QA Fonctionnel | 1 | 4 | 2 | 5/10 |
| Design UI | 0 | 2 | 2 | 6/10 |
| **Total unique** | **5** | **14** | **12** | **5.5/10** |

**Recommandation** : Sprint dédié P0 (5 bugs HIGH, ~3h30) avant nouvelle feature. Pattern XSS (H1) déjà signalé dans LIVE (H5) et TOP v2 (H1) — fix structurel transverse requis.

---

## Bugs HIGH (5) — À traiter en priorité absolue

### H1 — XSS onclick : `escapeHtml` encode `'` en `&#39;` mais le parser HTML décode avant exec JS
**Fichiers** : `pariscore.js` L1887, L1943, L4048, L4050, L4091 — 5 occurrences
**Pattern** : `onclick="fn('${id}')"` où `id` est passé par `_escTennis` (L1606-1609) qui encode `'` → `&#39;`. Le parser HTML décode `&#39;` en `'` **avant** le parsing JS, donc un id contrôlé par l'attaquant comme `'); alert('xss` devient `onclick="fn(''); alert('xss')"`. Si l'id provient d'une source manipulable (BSD pollué, ESPN spoofé, injection DB), exécution JS arbitraire.
**Code incriminé** (3 exemples représentatifs) :
```js
// L1887 — _tnFavBtn
const id = String(matchId).replace(/'/g, "&#39;");
return `<button type="button" class="${cls}" onclick="event.stopPropagation();toggleFavorite('${id}',this)" ...>★</button>`;

// L4048 + L4050 — renderTennisValueBets
const onclick = _tnDetailId ? `onclick="openTennisDetail('${_tnDetailId}')"` : '';
const aiBtn = matchId
  ? `<button class="ai-gen-btn" onclick="event.stopPropagation();analyzeTennisMatch('${matchId}')" ...>AI-AL</button>`;

// L4091 — renderTennisValueBets drawer toggle
<button class="tn-expand-btn" aria-label="Détails ${ariaLbl}" aria-expanded="false" aria-controls="${drawerId}"
  onclick="event.stopPropagation();_tnExpandDrawer('${matchId}')">▸</button>
```
**Impact** : XSS transitif si données serveur compromises (5 paths distincts). Même racine que H1 (TOP v2) et H5 (LIVE).
**Fix** : Migration `onclick="..."` → `data-match-id="..."` + event delegation unique sur `tbody` :
```js
tbody.addEventListener('click', (e) => {
  const row = e.target.closest('[data-match-id]');
  if (!row) return;
  const id = row.dataset.matchId;
  if (e.target.closest('.tn-fav-btn')) return toggleFavorite(id, e.target);
  if (e.target.closest('.ai-gen-btn')) return analyzeTennisMatch(id);
  if (e.target.closest('.tn-expand-btn')) return _tnExpandDrawer(id);
  openTennisDetail(id);
});
```

### H2 — 3 checkboxes filtres référencées 6× dans le JS mais JAMAIS définies dans le HTML
**Fichier** : `pariscore.html` L15830-15874 (panel tab PARIS)
**Détail** : `tennis-vb-elo-only`, `tennis-vb-positive-ev`, `tennis-vb-hide-finished` sont lus/écrits dans :
- `pariscore.js` L3909-3911 (rendu `renderTennisValueBets`)
- `pariscore.js` L1506-1509 (`applyTennisPreset`)
- `pariscore.js` L28726 + L28739 (wire/unwire listeners)
- `pariscore.js` L28802-28804 (snapshot télémétrie)
- `pariscore.js` L28819-28821 (restore profile)
…mais `grep` confirme qu'**aucun de ces IDs n'existe dans `pariscore.html`**.
**Code incriminé** :
```js
// pariscore.js L3909-3912 — renderTennisValueBets
const eloOnly = document.getElementById('tennis-vb-elo-only')?.checked;       // toujours undefined
const positiveEv = document.getElementById('tennis-vb-positive-ev')?.checked;  // toujours undefined
const hideFinished = document.getElementById('tennis-vb-hide-finished')?.checked; // toujours undefined
const liveOnly = document.getElementById('tennis-vb-live-only')?.checked;     // OK, présent L15850
```
```html
<!-- pariscore.html L15849-15852 — seuls live-only est présent -->
<div class="tn2-fg">
  <label class="tn2-toggle"><input type="checkbox" id="tennis-vb-live-only" onchange="..."> LIVE</label>
</div>
<!-- MANQUENT : tennis-vb-elo-only, tennis-vb-positive-ev, tennis-vb-hide-finished -->
```
**Impact** : 3 filtres premium (Elo uniquement, EV+ uniquement, Masquer terminés) silencieusement désactivés. L'utilisateur ne peut pas les activer. La persistance profil (L28819-28821) et la télémétrie (L28802-28804) sont no-ops pour ces 3 filtres.
**Fix** : Ajouter les 3 checkboxes dans le panel HTML L15849-15852 :
```html
<div class="tn2-fg">
  <label class="tn2-toggle"><input type="checkbox" id="tennis-vb-live-only" onchange="renderTennisValueBets(window._tennisVbLastFetch||[])"> LIVE</label>
  <label class="tn2-toggle"><input type="checkbox" id="tennis-vb-elo-only" onchange="renderTennisValueBets(window._tennisVbLastFetch||[])"> Elo</label>
  <label class="tn2-toggle"><input type="checkbox" id="tennis-vb-positive-ev" onchange="renderTennisValueBets(window._tennisVbLastFetch||[])"> EV+</label>
  <label class="tn2-toggle"><input type="checkbox" id="tennis-vb-hide-finished" onchange="renderTennisValueBets(window._tennisVbLastFetch||[])"> ≠ Terminés</label>
</div>
```

### H3 — `setTimeout(tickTennisValueBets, 2500)` jamais nettoyé par `stopTennisValueBets`
**Fichier** : `pariscore.js` L4249 (cold start) + L4282 (erreur réseau) + L4299-4301 (stop)
**Code incriminé** :
```js
// L4247-4249 — cold start retry
if (window._tennisVbBuildRetries <= 30) {
  if (statusEl) statusEl.textContent = `⏳ Préparation… (${window._tennisVbBuildRetries})`;
  setTimeout(tickTennisValueBets, 2500);   // ← jamais référencé pour cleanup
}

// L4276-4282 — erreur réseau retry
if (window._tennisVbBuildRetries <= 30) {
  ...
  setTimeout(tickTennisValueBets, 2500);   // ← idem
}

// L4299-4301 — stop nettoie seulement le setInterval, pas les setTimeout
function stopTennisValueBets() {
  if (_tennisVbTimer) { clearInterval(_tennisVbTimer); _tennisVbTimer = null; }
  // ← MANQUE : clearTimeout des retries pending
}
```
**Impact** : Si user navigue vers MATCHS/LIVE/TOP pendant un cold start, les retries 2.5s continuent en arrière-plan → fetch inutiles + state pollution (compteur `_tennisVbBuildRetries` partagé). Cumulé avec H4, on peut avoir 3-4 retries simultanés qui s'empilent.
**Fix** : Tracker les timeouts dans un array et les clear dans `stop` :
```js
let _tennisVbRetryTimers = [];
function _scheduleRetry() {
  const t = setTimeout(() => {
    _tennisVbRetryTimers = _tennisVbRetryTimers.filter(x => x !== t);
    tickTennisValueBets();
  }, 2500);
  _tennisVbRetryTimers.push(t);
}
function stopTennisValueBets() {
  if (_tennisVbTimer) { clearInterval(_tennisVbTimer); _tennisVbTimer = null; }
  _tennisVbRetryTimers.forEach(clearTimeout);
  _tennisVbRetryTimers = [];
}
```

### H4 — `setInterval(tickTennisValueBets, 5min)` jamais arrêté en quittant l'onglet PARIS
**Fichiers** : `pariscore.html` L16339-16383 (`tn2SwitchTab`) + `pariscore.js` L4296 (start) + L868 (stop hook global)
**Code incriminé** :
```js
// pariscore.html L16350 — anti double-fire qui ne s'applique PAS à 'paris' donc toujours re-start
if ((tabId !== 'live' && tabId !== 'top' && tabId !== 'matchs') && window[key]) return;
window[key] = true;
switch (tabId) {
  case 'paris':
    if (typeof startTennisValueBets === 'function') startTennisValueBets();
    break;
  // ... autres cases ne call PAS stopTennisValueBets()
}

// pariscore.js L868 — stop hook global, mais seulement si on quitte la PAGE tennis
try { if (pageId !== 'tennis' && typeof stopTennisValueBets === 'function') stopTennisValueBets(); } catch(e) {}
```
**Impact** : Si user navigue paris→matchs→top→paris, le timer 5min continue pendant toute la session intra-tennis. À chaque tick : `fetch('/api/v1/tennis/value-bets')` + `renderTennisValueBets(200 rows)` sur un tbody **caché**. Gaspillage CPU/réseau + maj silencieuse du DOM.
À comparer avec H2 du rapport TOP v2 (même pattern avec `startTennisTop10`).
**Fix** : Dans `tn2SwitchTab`, appeler `stopTennisValueBets()` avant tout switch :
```js
window.tn2SwitchTab = function(tabId) {
  // Stop tous les pollers au switch
  if (typeof stopTennisValueBets === 'function') stopTennisValueBets();
  if (typeof stopTennisTop10 === 'function') stopTennisTop10();
  // ... etc pour les autres pollers
  ...
  switch (tabId) { ... }
};
```

### H5 — Race condition : `_tennisVbBuildRetries` partagé entre navigations → faux "Build trop long"
**Fichier** : `pariscore.js` L4242, L4255, L4275
**Code incriminé** :
```js
// L4242-4253 — cold start
window._tennisVbBuildRetries = (window._tennisVbBuildRetries || 0) + 1;
...
if (window._tennisVbBuildRetries <= 30) {
  if (statusEl) statusEl.textContent = `⏳ Préparation… (${window._tennisVbBuildRetries})`;
  setTimeout(tickTennisValueBets, 2500);  // ← H3 : retry non-nettoyé
} else if (statusEl) {
  statusEl.textContent = 'Build trop long — réessaie plus tard';  // ← grippage
}

// L4255 — reset uniquement sur succès complet
window._tennisVbBuildRetries = 0;
```
**Impact** : Combiné à H3 (leak setTimeout), si user navigue paris→matchs→paris pendant un cold start serveur (typique au boot VPS), 2-3 chaînes de retries s'exécutent en parallèle et incrémentent le même compteur `_tennisVbBuildRetries`. Au bout de 30 incréments (75s), on abandonne même si le serveur a fini son build → message trompeur "Build trop long — réessaie plus tard" et user bloqué.
**Fix** : Token de génération `_tennisVbReqId++` à chaque `startTennisValueBets()`, vérifier `if (myReqId !== _tennisVbReqId) return;` en début de `tickTennisValueBets`. Permet aussi de stopper les retries obsolètes.

---

## Bugs MED (14) — À traiter dans le sprint suivant

### Code/Architecture (8)
| # | Bug | Fichier | Fix |
|---|---|---|---|
| M1 | Headers 3 colonnes vertes sans sémantique (cf H10 MATCHS) | `pariscore.html` L15860, L15863, L15865 | Couleur neutre par défaut, vert si cell EV+ |
| M2 | `_pBetsCache` Map non bornée (TTL 48h, pas de LRU) | `server.js` L3895 | LRU eviction 1000 entries |
| M3 | `_tennisVBCache` Map non bornée (key=date) | `server.js` L37165 | LRU eviction 30 entries |
| M4 | `patchTennisLive` (L3861-3865) trigger full re-render si `data-tn-pred` manquant → boucle possible | `pariscore.js` L3861 | Limiter à 1 retry/session + log unique |
| M5 | `hydrateHubCounters` (L1590) `fetch` direct sans `apiFetch` (credentials?) | `pariscore.js` L1590 | Utiliser `apiFetch` ou documenter cookie-only |
| M6 | `tickTennisValueBets` Promise.race timeout 25s sans cleanup du setTimeout | `pariscore.js` L4226-4229 | `clearTimeout(t)` dans `.finally()` |
| M7 | `applyTennisPreset` (L1506-1509) silencieux si checkboxes manquantes (cf H2) | `pariscore.js` L1506 | `console.warn` si checkbox missing |
| M8 | `renderPBetsV2` (L16686) `(p1.elo \|\| '—')` non échappé → XSS potentiel si string | `pariscore.html` L16686 | `escapeHtml(String(p1.elo \|\| '—'))` |

### QA Fonctionnel (4)
| # | Bug | Scénario | Fix |
|---|---|---|---|
| Q1 | `renderPBetsV2` (L16676) `country_code.toLowerCase()` non validé dans URL src | `cc = "fr/404' onerror='alert(1)"` → XSS | Valider `/^[a-z]{2}$/i.test(cc)` avant URL |
| Q2 | Deux écouteurs Escape pour `closePBets` (L7440-7444 + L16761-16763) — doublon | ESC déclenche 2× (no-op au 2e mais dead code) | Factoriser en 1 handler global |
| Q3 | `tickTennisValueBets` 401/403 → lock "Accès réservé" sans retry auto si user upgrade plan | User Pro Tennis → relogin → message persiste | Poll 60s tant que statusEl = "Accès réservé" pour détecter upgrade |
| Q4 | `renderPBetsV2` (L16719) `conf.toFixed(1)` si `conf=NaN` → "NaN/10" | `b.confidence = "abc"` | `var conf = parseFloat(b.confidence) \|\| 5;` |

### Design UI (2)
| # | Bug | Fix |
|---|---|---|
| D1 | `pBetsOverlay` (L15951) sans `role="dialog"` `aria-modal="true"` `aria-labelledby` (vs `tennis-detail-modal` L15970 qui les a) | Ajouter role/aria-modal/aria-labelledby |
| D2 | 9 colonnes tableau (L15856-15867) trop chargé sur mobile <768px | `@media` → cards empilées avec `data-label` (cf L29 MATCHS fix) |

---

## Bugs LOW (12) — Polish

### Code (8)
| # | Bug | Fichier | Fix |
|---|---|---|---|
| L1 | Commentaire "60s écoulées" pour un wait 5s | `server.js` L37540 | Corriger en "5s écoulées" |
| L2 | `bets.splice(0, bets.length, ...mapped)` inutile — utiliser `mapped` directement | `server.js` L22368 | `return { bets: mapped, ... };` |
| L3 | `var tennisPbetsCtx = found && found._pBetsTennisCtx \|\| null;` précédence ambiguë | `server.js` L22345 | `(found && found._pBetsTennisCtx) \|\| null` |
| L4 | `matchStatus.includes('LIVE')` case-sensitive | `server.js` L22331 | `/live/i.test(matchStatus)` |
| L5 | `?date=YYYY-MM-DD` filter non validé format | `server.js` L37303 | `if (!/^\d{4}-\d{2}-\d{2}$/.test(dateClean)) return ...` |
| L6 | `setChk('tennis-vb-elo-only', ...)` skip silencieux si checkbox missing (cf H2) | `pariscore.js` L28817-28821 | Dépend de H2 |
| L7 | Magic number `2 * 60 * 60 * 1000` (match terminé >2h) | `server.js` L22330 | Extraire constante `_PBETS_TERMINATED_MS = 2*3600*1000` |
| L8 | Magic number `5 * 60 * 1000` (refresh interval) non calibré | `pariscore.js` L4296 | Adapter : live → 30s, normal → 5min |

### QA (2)
| # | Bug | Fix |
|---|---|---|
| L9 | `<div id="tennis-live-section"></div>` (L15831) vide jamais rempli — code mort | Supprimer ou wirer avec `tickTennisLive` |
| L10 | `var canonId = fixtureId;` (L22299) — `var` au lieu de `let` | `let canonId = fixtureId;` |

### Design (2)
| # | Bug | Fix |
|---|---|---|
| L11 | `<span class="tn2-th" style="color:#00e676;">` inline style anti-pattern | Classe `.tn2-th-bets { color: var(--tn2-green) }` |
| L12 | Placeholder initial `Chargement...` (L15870) sans `role="row"` (vs renders JS qui le mettent) | `<div class="tn2-tr" role="row">` |

---

## Plan d'action priorisé

### Sprint 1 — P0 (5 bugs HIGH, ~3h30)

| # | Bug | Effort | Équipe |
|---|---|---|---|
| 1 | H1 — XSS onclick → event delegation (5 occ.) | 1h | JS |
| 2 | H2 — Ajouter 3 checkboxes manquantes dans HTML | 15 min | HTML |
| 3 | H3 — Cleanup setTimeout retries dans stop() | 30 min | JS |
| 4 | H4 — stopTennisValueBets() dans tn2SwitchTab | 20 min | JS/HTML |
| 5 | H5 — Token de génération `_tennisVbReqId` | 30 min | JS |
| 6 | H1 transverse — factoriser le pattern event delegation avec LIVE (H5) et TOP (H1) | 1h | JS |

### Sprint 2 — P1 (14 bugs MED, ~5h)

Voir détail ci-dessus — traiter par bloc :
- Code : M1-M8 (~3h)
- QA : Q1-Q4 (~1h30)
- Design : D1-D2 (~30 min)

### Sprint 3 — P2 (12 bugs LOW, ~2h rolling)

Polish et robustesse — traiter progressivement. L1, L6 quick wins.

---

## Points forts à conserver

1. **Cache stale-while-revalidate** dans `buildTennisValueBets` (L37312-37324) — sert le stale immédiatement, rebuild en bg sans bloquer la requête. Pattern exemplaire.
2. **Dedup guard** `_vbGuard` (L37306-37311) — évite un 2e build parallèle si un rebuild est en cours pour la même key. Bonne gestion de concurrence.
3. **Cold-start async** (L37326-37336) — retourne `{loading:true, building:true}` immédiatement et build en fond avec yields event-loop, évite le timeout proxy/UI.
4. **Retry borné** `_tennisVbBuildRetries <= 30` (L4247, L4276) — empêche le retry infini, avec message clair à l'utilisateur. Manque juste le cleanup H3.
5. **Race condition 401/403** gérée proprement (L4230-4235) — affiche un message "Module Tennis réservé Pro Tennis / Duo" avec CTA implicite.
6. **Snapshot enrichment** `_tnSnapshotStore` / `_tnApplySnapshot` (L3586-3597) — protège contre la dégradation serveur (BSD qui drop les predictions/elo au passage live).
7. **Unified tennis view** `buildUnifiedTennis` (L3570-3621) — fusion VB + live avec 2 index (exact pair + last-name fallback) + réhydratation snapshot.
8. **Validation fixtureId** côté serveur `/^[a-zA-Z0-9_-]+$/` (L22300) — bon input sanitization.
9. **Live-only filter intelligent** `_tnActuallyLive` (L3557-3566) — exige du jeu effectif (sets joués, points), évite faux positifs "is_live" ESPN/BSD.
10. **Tri multi-critère** `_tnRank` + heure (L3954-3963) — live en tête, puis par proximité temporelle. UX cohérente.
11. **Pin-to-top favoris** (L3966-3972) — _tvbFavCount + header "MES FAVORIS" dédié.
12. **Lazy drawer** `_tnExpandDrawer` (L1911-1916) — render du détail uniquement sur 1er expand, économise CPU.

---

## Recommandations stratégiques

1. **Fix structurel XSS transverse** — H1 (PARIS) + H5 (LIVE) + H1 (TOP v2) sont le même pattern. Créer un utilitaire `_tnDataAttrs(id)` + composant event delegation réutilisable sur les 3 onglets. Sinon le bug reviendra à chaque nouvelle feature.
2. **Cleanup des pollers intra-tennis** — `tn2SwitchTab` devrait appeler `stop*()` pour tous les pollers (ValueBets, Top10, Live) au switch. Actuellement seule la navigation hors-page tennis déclenche les stop (L867-869). Pattern identique au fix à appliquer.
3. **LRU cache unifié** — `_tennisVBCache`, `_pBetsCache`, `_tnTop10Cache`, etc. devraient partager une classe `LRUCache(maxSize)` pour éviter la duplication et garantir l'éviction.
4. **Tests unitaires** sur `buildUnifiedTennis` (fusion VB+live), `_tnActuallyLive` (edge cases ESPN), `tickTennisValueBets` (cold start + retry).
5. **Télémétrie filtres** — corriger H2 permettrait d'avoir une vraie visibilité sur l'usage des filtres premium (elo_only, positive_ev, hide_finished) dans la snapshot `cfSnapshotCurrentTennisFilters` (L28796-28808). Actuellement toujours `false` → données faussées.
6. **Migration `cheerio`** pour le parser HTML TE/BSD — déjà mentionné dans MATCHS, reste pertinent pour `buildTennisValueBets` qui parse du HTML.
7. **Composant modal P_BETS réutilisable** — D1 + Q2 montrent que le panel P_BETS réinvente ce que `tennis-detail-modal` fait déjà (role/aria/Escape). Factoriser en `<ps-modal>` réutilisable.

---

*Ce rapport est destiné à l'équipe ingénierie pour debug et amélioration de l'onglet PARIS Tennis. Cross-références : AUDIT_MATCHS_TENNIS_REPORT.md (H10 colors, M10 LRU), AUDIT_LIVE_TENNIS_REPORT.md (H5 XSS), AUDIT_TOP_TENNIS_REPORT_v2.md (H1 XSS, H2 poller leak).*
