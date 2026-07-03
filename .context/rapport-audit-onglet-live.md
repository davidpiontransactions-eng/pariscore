# Rapport d'Audit QA — Onglet Tennis Live (Pariscore / Tenniscope.ai)

**Date** : 2026-07-02  
**Périmètre** : Onglet "LIVE" du dashboard Tennis Live (cartes match, accordéon "Analyse détaillée", popup DR evolution, polling, fallback momentum)  
**Fichier audité** : `/home/z/my-project/download/pariscore.html` (version VPS patchée, 26 941 lignes)  
**Méthodologie** : Audit statique ligne par ligne + tests dynamiques Playwright + croisement avec rapports d'audit existants (`.context/RAPPORT_BUGS_TENNIS_*.md`, `rapport-investigation-tennis-loading-2026.md`, `test-report-tennis-stats-live.md`)  
**Équipe** : Lead Engineer + Senior QA Engineer (méthodologie `testeur senior.md` + `cskarpathyréviseur.md`)

---

## 📊 Synthèse Exécutive

| Sévérité | Count | Statut |
|---|---|---|
| 🔴 P0 — Critique | 0 | — |
| 🟠 P1 — Majeur | 5 | À corriger en priorité |
| 🟡 P2 — Mineur | 13 | À planifier |
| ⚪ P3 — Cosmétique | 7 | Backlog |
| **Total** | **25** | +1 connexe prematch |

**Tests dynamiques Playwright** : 8 cas testés, **6 bugs confirmés en reproduction live** (LIVE-005, LIVE-009, LIVE-010, LIVE-016, LIVE-017, LIVE-020). Le fix DR popup (mission MAIN-1) est **validé fonctionnel**.

**Récurrences** : 2 bugs sont des récurrences de patterns déjà identifiés (pattern apostrophe → LIVE-026 ; race condition fetch → LIVE-018).

---

## 🎯 Bugs confirmés par test dynamique Playwright

Les bugs suivants ont été **reproduits en conditions réelles** (chargement du fichier VPS patché dans Chromium, rendu via `Scope.liveCard()`) :

| Bug ID | Sévérité | Test dynamique | Résultat |
|---|---|---|---|
| LIVE-005 | P1 | `liveProbability=65` | ✅ Barre proba affiche "6500%" + `width:6500%` (overflow confirmé) |
| LIVE-009 | P2 | `set_ou={}` | ✅ Pills affichent "O7.5 undefined%" |
| LIVE-010 | P2 | `serving="1"` (string) | ✅ Classe `.serving` absente + indicateur "🎾 B" au lieu de "🎾 A" |
| LIVE-016 | P2 | Inspect `aria-expanded` | ✅ Aucun `aria-expanded` / `aria-controls` sur bouton accordéon |
| LIVE-017 | P2 | Inspect bouton ✕ popup DR | ✅ Tag `<a>` sans `href` ni `role` → non focusable clavier |
| LIVE-020 | P3 | `dr_exact.dr=0` | ✅ Affiche "DR P2 Infinity" |

---

## 🐛 Détail des 25 Bugs Identifiés

### Bugs P1 — Majeurs (à corriger en priorité)

---

#### LIVE-001 [P1] — Perte d'état de l'accordéon à chaque re-render

**Fichier** : `pariscore.html:26521-26588` (`renderActiveTab`), `26652` (setInterval 60s), `26262-26263` (`renderLiveGrid` → `el.innerHTML = ...`)  
**Description** : L'état ouvert/fermé des boutons `.sc-expand` est stocké uniquement dans le DOM (classes `.open`). `renderActiveTab()` reconstruit tout le panel via `el.innerHTML = matches.map(liveCardCompact).join('')`. Aucun `_state.expandedMatchIds` n'est conservé.  
**Impact** : L'utilisateur qui lit le Scouting Report / H2H / Top 3 Bets d'une carte se voit refermer la carte en plein milieu (toutes les 60s au pire), ou à chaque recherche/filtre.  
**Reproduction** : 1) Onglet Live → 2) Cliquer « Analyse détaillée » → 3) Attendre ≤60s ou taper dans la recherche → 4) La carte se referme silencieusement.  
**Correctif suggéré** :
```js
// Dans _state : expandedMatchIds: new Set()
// Dans _toggle : if(open) _state.expandedMatchIds.add(id); else _state.expandedMatchIds.delete(id);
// Dans liveCardCompact : var open=_state.expandedMatchIds.has(String(m.id));
//   html+='<button class="sc-expand'+(open?' open':'')" ...>';
//   html+='<div class="sc-detail'+(open?' open':'')+'">';
```
**Statut** : NOUVEAU  
**✅ À valider pour correction** : ☐ Oui ☐ Non ☐ Plus tard

---

#### LIVE-002 [P1] — `_state.matches` écrasé par le fetch live-only → onglets prematch/valuebets vides intermittent

**Fichier** : `pariscore.html:26404` (`_state.matches = liveMatches;`)  
**Description** : `fetchData()` affecte `_state.matches = liveMatches` (uniquement les live) AVANT le fetch value-bets (qui ajoute les prematch en asynchrone). Pendant la fenêtre 1-5s entre les deux, `_state.matches` ne contient que les live.  
**Impact** : Sur l'onglet Prematch/ValueBets/Analytics pendant un refresh, l'utilisateur voit « Aucun match à venir » pendant 1-5s, puis les matchs réapparaissent. Scintillement frustrant toutes les 60s.  
**Reproduction** : 1) Aller sur onglet Prematch → 2) Attendre le prochain polling → 3) Le panel clignote brièvement.  
**Correctif suggéré** : Merger au lieu d'écraser :
```js
var liveIds = {}; liveMatches.forEach(function(m){ liveIds[m.id] = m; });
_state.matches = liveMatches.concat(
  _state.matches.filter(function(m){ return !m._isLive && !liveIds[m.id]; })
);
```
**Statut** : NOUVEAU  
**✅ À valider pour correction** : ☐ Oui ☐ Non ☐ Plus tard

---

#### LIVE-003 [P1] — Race condition entre fetch live et fetch value-bets → doublons prematch

**Fichier** : `pariscore.html:26406` (`_state.loading = false;` trop tôt), `26412-26442` (fetch value-bets sans guard)  
**Description** : `_state.loading` est remis à `false` dès la fin du fetch live, AVANT la fin du fetch value-bets. Si l'utilisateur clique « Rafraîchir » dans cette fenêtre, un nouveau `fetchData()` démarre et lance un nouveau fetch value-bets B pendant que A est encore en vol. Les deux `.then` concatènent les prematch à `_state.matches` sans dédoublonner.  
**Impact** : Matchs prematch dupliqués → cartes en double, KPI gonflés, recherche instable.  
**Reproduction** : 1) Lancer un refresh → 2) Re-cliquer « Rafraîchir » dans la seconde → 3) Inspecter `_state.matches` → doublons.  
**Correctif suggéré** :
```js
// Maintenir _state.loading=true jusqu'à la fin du fetch value-bets (success OU fail).
// Ou utiliser un requestId (token) pour ignorer les réponses d'un fetch précédent :
var _reqId = 0;
function fetchData(){
  _reqId++; var myId = _reqId;
  // ...
  .then(function(data){ if(myId !== _reqId) return; /* apply */ });
}
```
**Statut** : NOUVEAU  
**✅ À valider pour correction** : ☐ Oui ☐ Non ☐ Plus tard

---

#### LIVE-004 [P1] — XSS potentiel via nom joueur non échappé dans l'indicateur de service

**Fichier** : `pariscore.html:25957` (`(m.serving===1?p1n:p2n)`), `26003` (`(run.player===1?p1n:p2n)`)  
**Description** : `p1n = shortName(m.player1 && m.player1.name || '?')`. `shortName` ne fait aucun échappement. Aux lignes 25956 et 25958 le nom est bien passé dans `esc()`, mais aux lignes 25957 (indicateur `🎾 serveur`) et 26003 (série en cours) il est interpolé **brut** dans le HTML.  
**Impact** : Injection HTML/JS possible depuis un nom joueur malformé ou malicieux (source BSD/ESPN — confiance faible). Cassure de layout garantie sur un nom contenant `<` ou `"`.  
**Reproduction** : Mock `_state.matches` avec `player1.name = "Test<img src=x onerror=alert(1)>"` et `m.serving=1` → `renderActiveTab()` → le script s'exécute.  
**Correctif suggéré** :
```js
// L25957 : remplacer p1n par esc(p1n) / p2n par esc(p2n)
(m.serving===1?esc(p1n):esc(p2n))
// L26003 : idem
(run.player===1?esc(p1n):esc(p2n))
```
**Statut** : NOUVEAU  
**✅ À valider pour correction** : ☐ Oui ☐ Non ☐ Plus tard

---

#### LIVE-005 [P1] — `liveProb` non normalisé 0-1 → layout cassé et EV aberrants ✅ CONFIRMÉ DYNAMIQUEMENT

**Fichier** : `pariscore.html:25874` (`var liveProb=m.liveProbability!=null?m.liveProbability:p1WinProb(m);`), `25972` (largeur `%`), `25938` (EV)  
**Description** : `p1WinProb` retourne toujours un float 0.02-0.98 (clamped). Mais `m.liveProbability` est utilisé tel quel. Si le backend renvoie `65` (pourcentage) au lieu de `0.65`, alors `liveProb*100 = 6500` → `width:6500%` (la barre `sc-lc-proba-p1` déborde), et `ev1 = 65*o1-1` (EV aberrant).  
**Impact** : Carte live illisible (barre proba explosée), value bet affiché avec EV `+6400%`, label `6500%` dans la barre.  
**Test Playwright** : ✅ Confirmé — `liveProbability=65` produit `width:6500%` et `6500%` visible dans le HTML rendu.  
**Reproduction** : Mock `m.liveProbability = 65` → `renderActiveTab()` → barre proba cassée.  
**Correctif suggéré** :
```js
var liveProb = m.liveProbability!=null ? Number(m.liveProbability) : p1WinProb(m);
if (liveProb > 1) liveProb = liveProb / 100;   // normaliser pourcentage
liveProb = Math.max(0.001, Math.min(0.999, liveProb));
```
**Statut** : NOUVEAU  
**✅ À valider pour correction** : ☐ Oui ☐ Non ☐ Plus tard

---

### Bugs P2 — Mineurs (à planifier)

---

#### LIVE-006 [P2] — Onglet Live n'affiche pas « Chargement… » pendant le fetch initial

**Fichier** : `pariscore.html:26541-26543`  
**Description** : Pour prematch (26535) le message tient compte de `_state.loading`. Pour live (26542) aucun check.  
**Impact** : Utilisateur qui switch vers Live pendant le 1er fetch voit « Aucun match en direct » alors que la requête est en cours.  
**Correctif** :
```js
var _msgL = _state.loading ? 'Chargement des matchs live…' : (_q ? 'Aucun match trouvé pour « ' + _q + ' ».' : 'Aucun match en direct pour le moment.');
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-007 [P2] — Onglet Live ne reflète pas l'état d'erreur réseau

**Fichier** : `pariscore.html:26445-26453` (catch), `26540-26543` (render live)  
**Description** : En cas d'échec fetch, le catch met `_state.liveError=true` mais `renderActiveTab` pour la tab live ne lit ni `_state.liveError` ni `_state.error`.  
**Impact** : Erreur invisible dans le panel. Données potentiellement stale affichées sans avertissement.  
**Correctif** :
```js
if (_state.liveError) {
  pEl.innerHTML = emptyState('⚠️ Erreur live : ' + (_state.error || 'réseau') + ' — réessai automatique dans 60 s.');
}
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-008 [P2] — `_pct`/`_duel` confondent « donnée manquante » et « 0 » → affichent « 0.00% » au lieu de « — »

**Fichier** : `pariscore.html:25150` (`num`), `25898` (`_pct`), `25910-25934` (`_duel`), `26004-26008` (appel)  
**Description** : `num(v)` retourne `0` pour `undefined`/`null`/`NaN`. `_pct` ne distingue plus ces cas. Dans `_duel`, `has1 = n1!=null && !isNaN(n1)` → `true` pour 0 → affiche `0.00` au lieu de `—`.  
**Impact** : Pour un match sans `_bsd_stats`, les duels `% 1ère balle gagnée`, `Aces`, `Double fautes` affichent « 0.00% / 0.00% » et « 0 / 0 » au lieu de « — / — ». L'utilisateur pense que les joueurs ont 0 aces / 0% première balle.  
**Correctif** :
```js
// _pct : tester v==null AVANT num
function _pct(v){ if(v==null||v===''||isNaN(Number(v))) return null; var n=Number(v); return n>1?n:n*100; }
// _duel : idem, tester v1/v2==null avant num
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-009 [P2] — Pills Over/Under affichent « undefined% » quand `set_ou` est incomplet ✅ CONFIRMÉ

**Fichier** : `pariscore.html:25986-25991`  
**Description** : `if(m.set_ou){ var ou=m.set_ou; ... 'O7.5 '+ou.o75+'%' ... }`. Le guard ne vérifie que l'objet est truthy, pas que `o75`/`o85`/`u125` existent. Si `set_ou = {}` → `ou.o75` est `undefined` → `"O7.5 undefined%"`.  
**Test Playwright** : ✅ Confirmé — `set_ou={}` produit `O7.5 undefined%`.  
**Correctif** :
```js
if(m.set_ou){
  var ou=m.set_ou;
  if(ou.o75!=null) html+='<span class="sc-lc-ou-pill'+(ou.o75>=65?' hi':'')+'">O7.5 '+ou.o75+'%</span>';
  if(ou.o85!=null) html+='<span class="sc-lc-ou-pill'+(ou.o85>=65?' hi':'')+'">O8.5 '+ou.o85+'%</span>';
  if(ou.u125!=null) html+='<span class="sc-lc-ou-pill'+(ou.u125>=65?' hi':'')+'">U12.5 '+ou.u125+'%</span>';
}
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-010 [P2] — `m.serving` strict `===1` mais guard truthy → styling et label divergent si string ✅ CONFIRMÉ

**Fichier** : `pariscore.html:25956-25958`, `26003`  
**Description** : `m.serving===1` (strict) est utilisé pour la classe CSS et pour choisir `p1n`/`p2n`. Mais le guard qui décide d'afficher l'indicateur est `(m.serving?...:'')` (truthy). Si serveur renvoie `m.serving="1"` (string), `===1` false → pas de classe `.serving`, MAIS l'indicateur s'affiche et pointe sur p2n (car `"1"` truthy et `===1` false).  
**Test Playwright** : ✅ Confirmé — `serving="1"` produit indicateur "🎾 B" (au lieu de A) sans classe `.serving`.  
**Correctif** :
```js
// Normaliser en int dès mapMatch
mapped.serving = m.serving!=null ? parseInt(m.serving,10) || 0 : 0;
// Ou utiliser == au lieu de === : m.serving==1
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-011 [P2] — Interceptor `renderTennisValueBets` écrase `_state.matches` (bug latent)

**Fichier** : `pariscore.html:26764-26780`  
**Description** : L'interceptor wrap `window.renderTennisValueBets` si elle existe. À chaque appel legacy, il fait `_state.matches = arr.map(mapMatch).filter(Boolean);` — remplacement total. Les rapports indiquent que le legacy est mort, mais l'interceptor reste comme mine latente.  
**Impact** : Si le code legacy est réactivé, les live scores disparaissent instantanément.  
**Correctif** : Soit supprimer l'interceptor (legacy mort confirmé), soit merger au lieu d'écraser.  
**Statut** : NOUVEAU (latent)  ☐ Valider

---

#### LIVE-012 [P2] — KPI bar non mise à jour en cas d'erreur fetch

**Fichier** : `pariscore.html:26445-26453` (catch sans `updateKpiBar`)  
**Description** : Le chemin success appelle `updateKpiBar(_state.matches)`. Le chemin catch appelle `renderActiveTab()` mais PAS `updateKpiBar`. La KPI bar conserve donc les anciennes valeurs.  
**Impact** : KPI bar affiche des chiffres obsolètes (ex: « 5 live » alors que le serveur ne répond plus).  
**Correctif** :
```js
.catch(function (err) {
  clearTimeout(timeout);
  _state.loading = false;
  _state.liveError = true;
  _state.error = err && err.message || String(err);
  updateKpiBar(_state.matches);   // ← ajouter
  publishStatus('Erreur live : ' + _state.error, true);
  renderActiveTab();
  return [];
});
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-013 [P2] — `trapFocus` accumule des listeners keydown (memory leak)

**Fichier** : `pariscore.html:26882` (appel), `pariscore.js:27357-27371` (définition)  
**Description** : `openDRPopup` appelle `trapFocus(modal)` à chaque ouverture. `trapFocus` fait `modal.addEventListener('keydown', _tfHandler)` sans jamais retirer le listener. Après N ouvertures, N handlers keydown sont attachés.  
**Impact** : Fuite mémoire légère + comportement Tab dupliqué (N interceptions par pression).  
**Correctif** : Stocker le handler sur l'élément, le retirer avant ajout, et dans `closeDRPopup` :
```js
function trapFocus(modal){
  if(!modal) return;
  if(modal._tfHandler) modal.removeEventListener('keydown', modal._tfHandler);
  // ... définir _tfHandler ...
  modal._tfHandler = _tfHandler;
  modal.addEventListener('keydown', _tfHandler);
  // Déplacer le focus dans le modal à l'ouverture
  if(f.length) f[0].focus();
}
```
**Statut** : NOUVEAU (cross-file)  ☐ Valider

---

#### LIVE-014 [P2] — Échap ne ferme pas le popup DR

**Fichier** : `pariscore.html:26790`, `26882`, `pariscore.js:27373-27389`  
**Description** : Le handler Escape global ferme les modales en testant `classList.contains('open')`. Le popup DR n'utilise pas `.open` mais `style.display='flex'`. Il n'est donc jamais fermé par Échap.  
**Impact** : Utilisateur clavier bloqué dans le popup DR.  
**Correctif** : Ajouter un handler Échap dédié dans `openDRPopup`, OU ajouter le check dans le handler global :
```js
// Dans pariscore.js handler global (ligne 27373) :
if (d.getElementById('dr-popup-modal') && d.getElementById('dr-popup-modal').style.display==='flex') {
  closeDRPopup(); return;
}
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-015 [P2] — Pas de listener `visibilitychange` → polling continue en arrière-plan

**Fichier** : `pariscore.html:26650-26657` (`startAutoRefresh`)  
**Description** : `startAutoRefresh` vérifie `page.style.display !== 'none'` (visibilité intra-page) mais pas `document.hidden` (visibilité de l'onglet navigateur).  
**Impact** : Bande passante gaspillée, charge serveur inutile, batterie mobile drainée.  
**Correctif** :
```js
document.addEventListener('visibilitychange', function(){
  if(document.hidden) { /* pause */ }
});
// Dans le tick : if (document.hidden) return;
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-016 [P2] — Bouton accordéon sans `aria-expanded`/`aria-controls` (a11y) ✅ CONFIRMÉ

**Fichier** : `pariscore.html:25995` (live), `25704` (prematch), `26276` (`_toggle`)  
**Description** : Le bouton bascule la classe `.open` mais ne met jamais à jour `aria-expanded`. Le panneau `.sc-detail` n'a pas `id` ni `role="region"`.  
**Test Playwright** : ✅ Confirmé — aucun `aria-expanded` ni `aria-controls` dans le HTML rendu.  
**Impact** : Non-conformité WCAG 2.1 (4.1.2 Name, Role, Value).  
**Correctif** :
```js
html+='<button class="sc-expand" aria-expanded="false" aria-controls="det-'+esc(m.id)+'" ...>';
html+='<div class="sc-detail" id="det-'+esc(m.id)+'" role="region">';
// Dans _toggle :
btn.setAttribute('aria-expanded', open ? 'true' : 'false');
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-017 [P2] — Bouton fermeture popup DR est un `<a>` sans `href`/`role` ✅ CONFIRMÉ

**Fichier** : `pariscore.html:26795`  
**Description** : Le bouton de fermeture est un `<a>` sans `href`, sans `role="button"`, sans `tabindex`. Il n'est pas focusable au clavier. Le trapFocus ne peut pas l'atteindre.  
**Test Playwright** : ✅ Confirmé — tag `A`, pas de `href`, pas de `role`, `isFocusable: false`.  
**Impact** : Sortie du modal impossible au clavier (le seul ✕ est inatteignable, et Échap ne marche pas — cf LIVE-014).  
**Correctif** :
```html
<button type="button" class="tn2-modal-close" onclick="closeDRPopup()" aria-label="Fermer le popup Dominance Ratio">✕</button>
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-018 [P2] — Fetch value-bets/upcoming/top10 sans AbortController ni timeout (RÉCURRENCE)

**Fichier** : `pariscore.html:26412` (value-bets), `26417` (upcoming), `26688` (top10)  
**Description** : Le fetch live (26377) a un AbortController + timeout 25s. Mais les 3 fetchs secondaires n'en ont aucun. Si le serveur est lent, ces fetchs peuvent rester pending indéfiniment.  
**Impact** : Récurrence partielle du bug B4 (rapport `RAPPORT_BUGS_TENNIS_AUDIT.md`) et de la reco #1 du rapport d'investigation. Le value-bets fetch peut s'éterniser et causer le bug LIVE-003.  
**Correctif** : Factoriser dans un helper `apiFetch(url, opts)` partagé avec AbortController + timeout 25s.  
**Statut** : RECURRENCE (cf `RAPPORT_BUGS_TENNIS_AUDIT.md` B4)  ☐ Valider

---

### Bugs P3 — Cosmétiques (backlog)

---

#### LIVE-019 [P3] — Backslash visible dans le label du bouton accordéon live (`Masquer l\'analyse`)

**Fichier** : `pariscore.html:25995`  
**Description** : `data-label-open="Masquer l\'analyse"`. Dans un attribut HTML double-quoted, `\'` n'est pas une séquence d'échappement valide — c'est le littéral backslash + apostrophe. Quand `_toggle` fait `lbl.textContent = btn.getAttribute('data-label-open')`, le label devient `Masquer l\'analyse` (backslash visible).  
**Correctif** : `data-label-open="Masquer l'analyse"` (apostrophe simple dans attribut double-quoted, valide en HTML).  
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-020 [P3] — DR = 0 affiche « P2 Infinity » ✅ CONFIRMÉ

**Fichier** : `pariscore.html:25984`  
**Description** : Le guard `m.dr_exact.dr != null` laisse passer `dr=0` (0 n'est pas null). Ensuite `dr>=1` false → branche `1/dr` = `1/0` = `Infinity`. `Infinity.toFixed(2)` = `"Infinity"`.  
**Test Playwright** : ✅ Confirmé — `dr_exact.dr=0` produit `Infinity` dans le HTML.  
**Correctif** : `if(m.dr_exact && m.dr_exact.dr != null && m.dr_exact.dr > 0){...}` ou `var v = dr>0 ? (dr>=1?dr:(1/dr)) : 0;`.  
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-021 [P3] — Code mort : `_fmt` et `_vs` définis jamais appelés

**Fichier** : `pariscore.html:25897` (`_fmt`), `25899-25906` (`_vs`)  
**Description** : Restes d'une itération précédente remplacée par `_duel`. Jamais appelés.  
**Correctif** : Supprimer les deux fonctions (8 lignes).  
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-022 [P3] — Bouton « Rafraîchir » non désactivé pendant le fetch

**Fichier** : `pariscore.html:15918` (HTML), `26367` (`fetchData` early-return), `26749` (wireUp click)  
**Description** : `fetchData()` early-return si `_state.loading`, mais le bouton `#sc-refresh-btn` n'est jamais désactivé. L'utilisateur peut spammer le bouton ; chaque clic est silencieusement no-op.  
**Correctif** :
```js
var btn = document.getElementById('sc-refresh-btn');
function fetchData(){
  if(btn) btn.disabled = true;
  // ...
  .finally(function(){ if(btn) btn.disabled = false; });
}
```
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-023 [P3] — Conflit z-index `.sc-wm` (5 vs 0)

**Fichier** : `pariscore.html:24705` (`.sc-wm{...z-index:5;...}`), `25053` (`.sc-wm{...z-index:0;...}`)  
**Description** : Deux définitions de `.sc-wm` avec des z-index différents. La seconde gagne. La première est entièrement écrasée.  
**Correctif** : Supprimer la définition 24705 (ou la 25053 selon l'intention).  
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-024 [P3] — Label du bouton accordéon prematch reste bloqué sur « Masquer l'analyse » après 1er toggle

**Fichier** : `pariscore.html:25704` (bouton sans `data-label-*`), `26276` (`_toggle`)  
**Description** : Le bouton prematch (25704) n'a ni `data-label-closed` ni `data-label-open` ni `span.lbl`. `_toggle` perd le texte initial après la première ouverture.  
**Correctif** : Ajouter `data-label-closed`/`data-label-open` au bouton prematch, OU capturer le label initial dans `_toggle`.  
**Statut** : NOUVEAU  ☐ Valider

---

#### LIVE-025 [P3] — Collision potentielle d'IDs de gradient SVG si match IDs dupliqués

**Fichier** : `pariscore.html:25855`  
**Description** : L'ID du `<linearGradient>` SVG du momentum chart est dérivé du hash de `m.id`. Si deux matchs ont le même `m.id` (doublons possibles via LIVE-003), les deux charts référencent le même gradient.  
**Correctif** : Utiliser un compteur module-level : `var _chartSeq=0; var gid='mg'+(_chartSeq++);`.  
**Statut** : NOUVEAU  ☐ Valider

---

### Bug connexe (module Scope, hors onglet Live strict)

---

#### LIVE-026 [P1] — `playerBlock` photo `onerror` casse sur apostrophe dans le nom (RÉCURRENCE pattern MAIN-1)

**Fichier** : `pariscore.html:25721`  
**Description** : `onerror="this.onerror=null;var n=encodeURIComponent(\''+esc(String(p.name||'?')).replace(/'/g,"\\'")+'\');..."`. `esc()` remplace déjà `'` par `&#39;`. Le `.replace(/'/g,"\\'")` suivant ne trouve plus de `'`. Quand le browser décode l'attribut HTML, `&#39;` redevient `'` → le code JS devient `encodeURIComponent('O'Connor')` → `SyntaxError`. Même pattern que le bug DR popup (mission MAIN-1), non patché dans `playerBlock`.  
**Impact** : Cartes prematch avec photo cassée → photo ne se charge pas en fallback sur nom à apostrophe (O'Connor, L'Hôte, etc.).  
**Correctif** : Appliquer le même pattern que le fix DR popup — utiliser `data-*` attribute + `this.getAttribute(...)` :
```js
var _phImg=_phUrl?('<img src="'+_phUrl+'" alt="" loading="lazy" data-player-name="'+esc(String(p.name||'?'))+'" onerror="this.onerror=null;var n=encodeURIComponent(this.getAttribute(\'data-player-name\'));this.src=\'https://ui-avatars.com/api/?name=\'+n+\'&background=172132&color=fff&size=80\';">'):'';
```
**Statut** : RECURRENCE (cf worklog MAIN-1)  ☐ Valider

---

## 🔍 Patterns anti-patterns transversaux

| # | Pattern | Impact | Recommandation |
|---|---|---|---|
| 1 | **Re-render complet par `innerHTML`** à chaque polling/recherche/toggle | Provoque LIVE-001, jank sur 50+ matchs, empêche transitions CSS | Patcher le score/games/proba in-place (data-match-id → querySelector + textContent), ou mini-vdom |
| 2 | **État UI confondu avec état données** | Expansion cartes, sélection value-bets, scroll position perdus | Externaliser `_state.expandedMatchIds: Set`, `_state.scrollTop` |
| 3 | **`num()` collapse undefined/null/NaN → 0** | Propage un faux « 0 » dans tous les helpers | `num` devrait retourner `null` pour invalid |
| 4 | **Inline `onclick` partout** (sauf DR popup et fav corrigés) | Pattern fragile, CSP strict désactivée | Migrer vers `addEventListener` délégué |
| 5 | **`setInterval` 60s sans backoff** | Hammer serveur en cas d'erreur persistante | Backoff exponentiel (60 → 120 → 300s) |
| 6 | **Polling au lieu de SSE/WebSocket** | Latence jusqu'à 60s | Implémenter SSE (cf mission précédente) |
| 7 | **Mix `escapeHtml` / `esc` / `_esc`** (3 fonctions équivalentes) | Risque d'incohérence et d'oublis | Factoriser en une seule `escapeHtml` globale |
| 8 | **`_state.loading` relâché trop tôt** | Race window LIVE-003 | Maintenir jusqu'à la fin des deux fetchs |
| 9 | **Pas de trap focus cleanup, pas de focus move** | Fuite mémoire + a11y | Stocker handler, removeEventListener, focus first element |
| 10 | **Guards `_isLive` redondants** | Code mort, maintenance difficile | Simplifier mapMatch |

---

## 🎯 Plan d'action recommandé (par priorité)

### 🚨 Sprint 1 — Corrections critiques (P1, 1-2 jours)

1. **LIVE-001** — Persister l'état d'expansion (`_state.expandedMatchIds`) + patch in-place du DOM au lieu de `innerHTML` complet
2. **LIVE-002 + LIVE-003** — Merger au lieu d'écraser `_state.matches` + maintenir `_state.loading` jusqu'à la fin des deux fetchs + requestId anti-race
3. **LIVE-004** — Échapper `p1n`/`p2n` systématiquement avec `esc()`
4. **LIVE-005** — Normaliser `liveProb` (0-1) et `m.serving` (int) dans `mapMatch`
5. **LIVE-026** — Appliquer le pattern `data-*` à `playerBlock` (récurrence pattern MAIN-1)

### ⚙️ Sprint 2 — Stabilisation (P2, 2-3 jours)

6. **LIVE-006 + LIVE-007 + LIVE-012** — États loading/error visibles dans le panel + KPI bar mise à jour en cas d'erreur
7. **LIVE-008** — `num()` retourne `null` pour invalid → `_pct`/`_duel` affichent « — »
8. **LIVE-009** — Guards null sur `set_ou.o75`/`o85`/`u125`
9. **LIVE-013 + LIVE-014 + LIVE-017** — `trapFocus` cleanup + handler Échap + bouton `<button>` pour close popup
10. **LIVE-015** — `visibilitychange` pour pause polling onglet caché
11. **LIVE-016** — A11y : `aria-expanded`/`aria-controls`/`role="region"` sur accordéon
12. **LIVE-018** — Factoriser `apiFetch(url, opts)` avec AbortController + timeout 25s
13. **LIVE-011** — Supprimer ou merger l'interceptor legacy

### 🎨 Sprint 3 — Polish (P3, 1 jour)

14. **LIVE-019** — Backslash `data-label-open`
15. **LIVE-020** — Guard `dr > 0` avant division
16. **LIVE-021** — Supprimer code mort `_fmt`/`_vs`
17. **LIVE-022** — Bouton Rafraîchir désactivé pendant fetch
18. **LIVE-023** — Conflit z-index `.sc-wm`
19. **LIVE-024** — Label bouton prematch
20. **LIVE-025** — Compteur unique pour IDs gradient SVG

### 🏗️ Sprint 4 — Architecture long terme

21. Migrer vers SSE (mission précédente) pour remplacer le polling 60s
22. Factoriser les 3 fonctions d'échappement en une seule
23. Ajouter des tests Playwright couvrant : carte live avec données vides, polling pendant accordéon ouvert, refresh rapide (race), nom joueur avec apostrophe/HTML, `liveProbability` en pourcentage
24. Considérer une migration React progressive du composant `liveCardCompact` (le squelette `frontend/` existe déjà — mais l'utilisateur a confirmé que ce n'est PAS pertinent pour l'instant)

---

## 📊 Risk Score Global

| Dimension | Score | Justification |
|---|---|---|
| Stabilité actuelle de l'onglet Live | 65/100 | Fonctionne en nominal mais bugs P1 dégradent l'UX |
| Risque de regression si déploiement VPS | 20/100 | Fix DR popup validé, autres bugs ne sont pas bloquants |
| Effort correctif Sprint 1 (P1) | 1-2 jours | 5 bugs, correctifs localisés |
| Effort correctif Sprint 2 (P2) | 2-3 jours | 13 bugs, dont a11y + race conditions |
| Effort correctif Sprint 3 (P3) | 1 jour | 7 bugs cosmétiques |
| Confiance dans le diagnostic | 95/100 | 6 bugs confirmés dynamiquement, audit statique ligne par ligne |

---

## 📋 Checklist de validation pour l'utilisateur

Pour chaque bug, merci de cocher :
- ☐ **Oui** — corriger maintenant
- ☐ **Non** — ne pas corriger (justification bienvenue)
- ☐ **Plus tard** — backlog

| Bug ID | Sévérité | Validé | Priorité |
|---|---|---|---|
| LIVE-001 | P1 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 1 |
| LIVE-002 | P1 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 1 |
| LIVE-003 | P1 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 1 |
| LIVE-004 | P1 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 1 |
| LIVE-005 | P1 ✅ | ☐ Oui ☐ Non ☐ Plus tard | Sprint 1 |
| LIVE-006 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-007 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-008 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-009 | P2 ✅ | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-010 | P2 ✅ | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-011 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-012 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-013 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-014 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-015 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-016 | P2 ✅ | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-017 | P2 ✅ | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-018 | P2 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 2 |
| LIVE-019 | P3 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-020 | P3 ✅ | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-021 | P3 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-022 | P3 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-023 | P3 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-024 | P3 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-025 | P3 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 3 |
| LIVE-026 | P1 | ☐ Oui ☐ Non ☐ Plus tard | Sprint 1 |

---

## 📦 Livrables produits

| Fichier | Rôle |
|---|---|
| `/home/z/my-project/download/rapport-audit-onglet-live.md` | **Présent rapport** |
| `/home/z/my-project/scripts/audit_live_tab.js` | Script de test dynamique Playwright (8 cas) |
| `/home/z/my-project/scripts/live-audit-results.json` | Résultats bruts des tests dynamiques |
| `/home/z/my-project/worklog.md` | Worklog mis à jour (Task ID: QA-STATIC-1) |

---

## ✅ Conclusion

L'audit a identifié **25 bugs** sur l'onglet Tennis Live, dont **5 P1 majeurs** et **13 P2 mineurs**. Six bugs ont été **confirmés par reproduction dynamique Playwright**. Aucun bug P0 bloquant — l'onglet fonctionne en nominal, mais souffre de :

1. **Perte d'état à chaque polling** (LIVE-001) — l'UX la plus dégradée
2. **Race conditions** entre fetchs live et value-bets (LIVE-002, LIVE-003)
3. **XSS potentiel** via noms joueurs non échappés (LIVE-004)
4. **Edge cases** non gérés (liveProb en pourcentage, serving en string, set_ou vide, dr=0)
5. **A11y défaillante** (pas d'aria-expanded, bouton close non focusable, Échap ne marche pas)

**Recommandation** : valider Sprint 1 (P1) en priorité — impact utilisateur maximal pour un effort modéré (1-2 jours). Le fix DR popup (mission MAIN-1) reste **validé et opérationnel**.

L'utilisateur est invité à remplir la checklist de validation ci-dessus pour que je puisse générer les patches correspondants.

---

*Rapport généré le 2026-07-02 par le Lead Engineer + Senior QA Engineer, selon la méthodologie `testeur senior.md` + `cskarpathyréviseur.md` du projet Pariscore.*
