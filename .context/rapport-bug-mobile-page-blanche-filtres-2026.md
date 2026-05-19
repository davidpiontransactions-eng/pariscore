# RAPPORT DE BUG — Mobile : Page blanche après paramétrage des filtres

**Date :** 2026-05-19
**Sévérité :** P0 (UX bloquant onboarding mobile)
**Plateforme :** Mobile (≤768px)
**Version :** v10.78
**Reporter :** DG (David)
**Auteur rapport :** GM PariScore (analyse code)

---

## 1. Symptôme observé (capture utilisateur)

Après que l'utilisateur a « paramétré les filtres » sur la version mobile :
- Le **contenu principal est vide** (zone blanche large).
- La **bottom-nav** est visible avec `PLUS` actif (souligné rouge).
- Le **toggle flottant « Nuit »** est visible en bas à droite.

## 2. Lecture forensique de la capture

Deux indices CSS croisés permettent d'identifier la page active sans ambiguïté :

| Indice                                | Règle CSS responsable                                                              | Conclusion                       |
| ------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `#theme-toggle` flottant visible      | `body[data-page="accueil"] #theme-toggle { display:inline-block !important }`      | `body.data-page === "accueil"`   |
| Onglet `PLUS` actif (et pas FOOTBALL) | Wrap `bnSetActive(bnPages.indexOf(pageId)>=0 ? pageId : '__more')` ([pariscore.html:26077-26088](pariscore.html#L26077)) | `pageId ∉ {matchs,tennis,strategies,paris}` |

➡️ **L'utilisateur est sur `#page-accueil`**, et non sur la page Matchs comme attendu après confirmation de stratégie.

## 3. Flow mobile attendu vs réel

### Flow attendu (au boot)
1. `DOMContentLoaded` → `showPage('accueil')` + `wireSportHub()` + `#sport-hub` affiché plein écran (`z:9000`)
2. User tape carte FOOTBALL/TENNIS → `chooseSport(sport)` → `#strategy-setup` affiché
3. User configure les filtres (Dropping/Jours/Période/Kickoff…) → tape **« Appliquer la stratégie et voir les matchs »**
4. `confirmStrategy()` → après 320 ms → `go()` :
   - `setup.style.display = 'none'`
   - `showPage(target)` avec `target ∈ {matchs, tennis}` ([pariscore.html:10872-10891](pariscore.html#L10872))
   - `setTimeout(applyFn, 80)` puis `setTimeout(applyFn, 700)`
5. `applyFootballPreset()` ou `applyTennisPreset()` applique les filtres en cliquant les chips DOM correspondants.

### Réel observé
Le `body[data-page]` reste sur **`accueil`** après que l'utilisateur ait validé.

## 4. Causes racine candidates (ordre de probabilité)

### 🔴 CR-A — `applyFootballPreset` cherche les chips dans `#page-matchs`, mais ils ont été **déplacés** dans `#mfs-body`

C'est la cause racine la plus défendable mécaniquement.

À l'ouverture mobile, l'IIFE bottom-nav exécute :

```js
// pariscore.html:26157-26158
if (isMobile()) { try { _mfsRelocate(); } catch (e) {} }
```

`_mfsRelocate()` ([pariscore.html:26125-26137](pariscore.html#L26125)) **déplace** quatre `.filter-row` hors de `#page-matchs` :

```js
['day-filter-row', 'topn-filter-row', 'period-kickoff-row', 'adv-filter-row']
  .forEach(id => { var el = document.getElementById(id); if (el) body.appendChild(el); });
```

→ Les chips quittent `#page-matchs` et atterrissent dans `#mfs-body` (sous `#mob-filter-sheet`).

Puis `applyFootballPreset()` ([pariscore.html:10809-10834](pariscore.html#L10809)) interroge :

```js
document.querySelector('#page-matchs .filter-chip[data-day="' + dayVal + '"]')
document.querySelector('#page-matchs .filter-chip[data-period="' + perVal + '"]')
document.querySelector('#page-matchs .filter-chip[data-kick="' + kickVal + '"]')
```

➡️ **Tous renvoient `null`** sur mobile. **Aucun chip n'est cliqué.** Les préférences saisies dans `#strategy-setup` ne touchent jamais l'état runtime du tableau.

Effet de bord : `mlPickAll()` et le slider `#o25-slider` restent en revanche fonctionnels (sélecteurs globaux). Le rendu n'est donc pas vide en soi — mais la promesse « voir les matchs filtrés » est rompue silencieusement.

### 🟠 CR-B — Le moteur d'affichage attend `loadMatches()` mais celui-ci échoue silencieusement (auth/quota/réseau)

Au-delà de `showPage('matchs')`, c'est `loadMatches()` ([pariscore.html:14414-14517](pariscore.html#L14414)) qui peuple `#vb-cards` via `renderMatches → renderMobileCards`.

Trois chemins d'échec ne ramènent **pas** à l'accueil :

1. `403 FREEMIUM_VIEW_QUOTA` → écran 🔒 dédié dans `#vb-body` (table desktop, pas mobile cards).
2. `429` → bannière d'erreur, pas de redirect.
3. 3 retries puis `showError` + `setTimeout(loadMatches, 30s)`.

Aucun de ces chemins ne met `body[data-page] = "accueil"`. **CR-B ne peut donc pas seul expliquer la capture.**

### 🟠 CR-C — Routage auth : `psPageBlocked` + `renderLockedPage`

`psPageBlocked('matchs')` ([pariscore.html:24553-24559](pariscore.html#L24553)) :
- guest non connecté → `{need:'register'}` → `renderLockedPage('matchs', …)`
- logged-in freemium → `null` (matchs OK) → flow normal

`renderLockedPage` ([pariscore.html:24561-24595](pariscore.html#L24561)) :
- masque `div[data-page]`, affiche `#page-locked` (créé dynamiquement, `data-page="locked"`)
- **ne réécrit pas** `body.dataset.page` (déjà set à `'matchs'` par `showPage` ligne 10650 **avant** le gate)
- bottom-nav wrap → `bnPages.indexOf('matchs') >= 0` → `FOOTBALL` actif

➡️ Ce chemin produirait l'écran lock (🔒 + CTA inscription), pas l'accueil blanc. **CR-C ne colle pas non plus.**

### 🔴 CR-D — Fenêtre de test gratuite expirée + état `matchesLoaded` parasite

`psAccess()` ([pariscore.html:24522-24547](pariscore.html#L24522)) ouvrait Pro à tous du **2026-05-15 00:00 → 2026-05-19 00:00 (exclu)**. Aujourd'hui = **2026-05-19** ⇒ fenêtre **CLOSE**.

Conséquences pour un user logged-in sans Pro :
- foot : autorisé (gratuit logged-in), `loadMatches()` filtre `allMatches` aux 5 ligues UE.
- tennis : `tennisPro=false` ⇒ `renderLockedPage` (écran 🔒).

Mais ici on ne change toujours pas le `body.data-page = "accueil"`. **Idem CR-C, ne suffit pas.**

### 🟢 CR-E — `confirmStrategy` jamais déclenché (touche capturée ailleurs)

Hypothèse : sur certains devices Android/iOS, le double-handler `onclick` + `touchend` (capture phase) peut court-circuiter le `confirmStrategy`. Le `dataset.confirming = '1'` rend idempotent mais ne re-tente pas si le `setTimeout(go, 320)` est annulé par un `pagehide`/`visibilitychange` (Safari iOS background tab).

Pas de preuve directe ici. **À écarter en priorité 3.**

### 🔴 CR-F — `psLogout()` involontaire ramène à l'accueil

`psLogout()` ([pariscore.html:21907-21915](pariscore.html#L21907)) **est la seule fonction** du codebase qui appelle `showPage('accueil')` après le DOMContentLoaded :

```js
function psLogout() {
  psClearToken();
  updateNavAuthState();
  matchesLoaded = false;
  allMatches = [];
  document.getElementById('vb-body').innerHTML = '';
  showPage('accueil', document.querySelector('[data-page="accueil"]'));
}
```

Hypothèse forte : un handler ou un cycle de validation token déclenche `psLogout()` côté front (mauvaise réception d'un 401 sur une route périphérique : `/ai-scout`, `/sse`, `/buteurs`, etc.).

**Si vrai :** scénario exact reproduit dans la capture :
1. User valide `#strategy-setup` → `showPage('matchs')`
2. `loadMatches()` + appels parallèles (`loadAIScout`, `lazyLoadButeurs`, `startLiveTop5Refresh`, `initSSE`)
3. Un appel renvoie 401 (token mal stocké / serveur sans la nouvelle clé / fenêtre 2026-05-15→18 stockée localement et invalidée)
4. `apiFetch` → `openAuthModal('login')` + `throw AUTH_REQUIRED` — **OK ce chemin n'appelle pas psLogout**.

Donc CR-F seul ne suffit pas non plus, sauf à exister un handler qui catch `AUTH_REQUIRED` et redirige vers accueil. À chercher.

## 5. Diagnostic combiné (hypothèse de travail)

Le bug visible = **chaîne CR-A + CR-F** :

1. **CR-A** : Sur mobile, dès le boot, `_mfsRelocate()` déplace les filter rows hors de `#page-matchs`. Conséquence : `applyFootballPreset()` clique des chips inexistants — **les filtres ne s'appliquent pas réellement**.
2. **CR-F** ou équivalent : Après validation, un retour réseau intermédiaire (probablement 401 sur une route Pro après expiration de la fenêtre test 15→18 mai) déclenche un redirect vers accueil — soit via `psLogout()`, soit via un fallback OAuth/SSE qui clear le token et re-init la page.

Le user perçoit : « j'ai validé les filtres → je tombe sur une page blanche sans nom ».

## 6. Plan de vérification (à exécuter dans /gsd-debug)

| # | Action                                                                                 | Attendu sain                                                                                  |
| - | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1 | Ouvrir mobile, **avant** de toucher le sport-hub : `document.querySelector('#page-matchs .filter-chip[data-day="all"]')` | doit retourner un nœud — si `null`, **CR-A confirmé**                            |
| 2 | Idem : `document.getElementById('day-filter-row').parentElement.id`                    | si `mfs-body` ⇒ **CR-A confirmé**                                                             |
| 3 | Loguer dans `applyFootballPreset` : ajouter `console.log('[ssApply] dayBtn=', dayBtn)`  | si `null` après tap « Appliquer » ⇒ **CR-A confirmé**                                         |
| 4 | DevTools Network onglet XHR : observer toute requête → `401` post-confirm              | si 401 sur `/api/v1/ai-scout` ou `/api/v1/sse` → racine CR-F                                  |
| 5 | `console.log` dans `psLogout` au tout début                                            | si appelé après confirmStrategy ⇒ **CR-F confirmé**                                           |
| 6 | `console.log` dans `showPage` : `pageId + ' from=' + new Error().stack`                | trace exacte du re-routing vers accueil                                                       |

## 7. Correctifs proposés (à valider avec /ps-test puis Engineering Lead)

### Fix 1 (CR-A) — Sélecteurs `applyFootballPreset` insensibles à la relocalisation

Remplacer `#page-matchs .filter-chip[data-day=…]` par un sélecteur **document-wide scoped par data-attribute**. Les rows déplacés gardent leurs ids — donc cibler par id parent + chip :

```js
function applyFootballPreset() {
  try {
    const F = window.psStrategyFilters || {};
    const dayVal = F.days || 'all';
    // AVANT : '#page-matchs .filter-chip[data-day=…]'
    // APRÈS : recherche globale tolérante à _mfsRelocate
    const dayBtn = document.querySelector('#day-filter-row .filter-chip[data-day="' + dayVal + '"]');
    if (dayBtn && !dayBtn.classList.contains('active')) dayBtn.click();

    if ((F.leagues || 'all') === 'all' && typeof mlPickAll === 'function') mlPickAll();

    const steam = document.getElementById('steam-filter-chip');
    const steamOn = steam && steam.classList.contains('active');
    if (steam && typeof toggleSteamFilter === 'function' && !!F.dropping !== !!steamOn) toggleSteamFilter();

    const sl = document.getElementById('o25-slider');
    if (sl) {
      sl.step = '1'; sl.value = '8'; _ssFire(sl, 'input'); _ssFire(sl, 'change');
      const v = document.getElementById('o25-val'); if (v) v.textContent = '8%';
    }

    const perVal = F.period || 'season';
    const per = document.querySelector('#period-filter-row .filter-chip[data-period="' + perVal + '"]');
    if (per && !per.classList.contains('active') && typeof setPeriod === 'function') setPeriod(perVal, per);

    const kBtn = document.querySelector('#kickoff-filter-row .filter-chip[data-kick="' + (F.kickoff || '0') + '"]');
    if (kBtn && !kBtn.classList.contains('active')) kBtn.click();

    if (typeof renderMatches === 'function' && Array.isArray(allMatches)) renderMatches(allMatches);
  } catch (e) { console.warn('[applyFootballPreset]', e); }
}
```

### Fix 2 (CR-F) — Tracer toute remise à zéro de session post-confirm

Ajouter un guard temporaire dans `psLogout()` :

```js
function psLogout() {
  console.warn('[psLogout] called from:', new Error().stack);
  // … reste inchangé
}
```

Idem dans le `401 handler` côté `apiFetch` :

```js
if (res.status === 401) {
  console.warn('[apiFetch:401]', url, 'token=', !!token);
  openAuthModal('login');
  throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
}
```

→ Vérifier dans DevTools mobile si le 401 vient d'une route Pro (`/ai-scout`, `/predictions/live`, `/insights`) et router proprement le fallback (ne pas ouvrir le modal sur des routes Pro pour un user freemium — gérer en 200 + flag `locked:true`).

### Fix 3 (UX, indépendant) — Confirmer visuellement l'application des filtres mobile

Aujourd'hui le mfs-apply (`<button class="mfs-apply" onclick="closeMobFilters()">`) ferme juste la nappe — sans toast/render explicite. Ajouter :

```js
window.closeMobFilters = function () {
  // … unchanged …
  if (typeof renderMatches === 'function' && Array.isArray(allMatches)) renderMatches(allMatches);
  if (typeof showNotification === 'function') showNotification('Filtres appliqués', 'green');
};
```

## 8. Recommandations d'équipe (Brainstorm GM)

| Rôle agent                              | Action attendue                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| **CTO / cs-engineering-lead**           | Valide Fix 1 (sélecteurs insensibles à la relocalisation) — coût ~5 min                       |
| **karpathy reviewer**                   | Audite que `#day-filter-row` etc. restent uniques en DOM (pas de duplication)                |
| **cs-ux-researcher**                    | Décide UX : strategy-setup garde son rôle de « pré-config rapide » OU on supprime la double saisie filtres |
| **Quality / réglementation CS**         | Vérifie que le fix ne déregresse pas desktop (les sélecteurs `#page-matchs .filter-chip` restent valides — `#day-filter-row` y est aussi enfant **avant** relocate) |
| **Responsable financier**               | Note : fenêtre test 15→18 mai expirée → recommande prolongation à 2026-05-21 le temps du fix |

## 9. Checklist de clôture

- [ ] Reproduire bug sur mobile réel (iOS Safari + Chrome Android) — `bd remember` les conditions exactes
- [ ] Appliquer **Fix 1** à `applyFootballPreset` + `applyTennisPreset`
- [ ] Logger **Fix 2** (psLogout + apiFetch:401) pour récolter trace côté VPS
- [ ] Tester confirmStrategy → showPage('matchs') → render chips actifs sur mobile
- [ ] `node --check server.js` + boot local OK
- [ ] Upload `pariscore.html` sur VPS OVH (`/home/ubuntu/pariscore`) via WinSCP
- [ ] PM2 restart si server.js touché (sinon disque suffit)
- [ ] Vérification iOS Safari live
- [ ] `git push` + close beads issue

---

*Rapport préparé pour /gsd-debug — investigation systématique à enchaîner.*
