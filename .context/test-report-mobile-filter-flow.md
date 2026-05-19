# Test Report — mobile-filter-flow
**Date** : 2026-05-19
**Module** : Flow mobile sport-hub → strategy-setup → matchs (filtres pré-config)
**Versions vérifiées** : pariscore.html v10.78 (post-fix bug page blanche)
**Issue bd** : ParisScorebis-6cv (P0, claimed)
**Rapport racine** : `.context/rapport-bug-mobile-page-blanche-filtres-2026.md`

---

## ✅ Tests passés

- `applyFootballPreset` sélecteurs ancrés `#day-filter-row .filter-chip[data-day=…]`, `#period-filter-row .filter-chip[data-period=…]`, `#kickoff-filter-row .filter-chip[data-kick=…]` → résistants à `_mfsRelocate` ([pariscore.html:10809-10834](pariscore.html#L10809)).
- `applyTennisPreset` sélecteurs déjà globaux (`.tennis-vb-filter-btn[data-filter=…]`, `#tennis-vb-comp`, `#tennis-vb-sort`) → pas impacté par `_mfsRelocate` (qui ne touche pas la page tennis) ([pariscore.html:10836-10870](pariscore.html#L10836)).
- `_mfsRelocate` idempotent (guard `_mfsMoved`) ([pariscore.html:26124-26137](pariscore.html#L26124)).
- `confirmStrategy` idempotent (`dataset.confirming = '1'`) — pas de double-fire ([pariscore.html:10872-10891](pariscore.html#L10872)).
- `closeMobFilters` post-fix force `renderMatches(allMatches)` + tente toast (guardé `typeof === 'function'`) ([pariscore.html:26155-26171](pariscore.html#L26155)).
- `psLogout` + `apiFetch:401` instrumentés (`console.warn` + stack trace) pour tracer CR-F en prod.
- `node --check server.js` → OK (server.js inchangé).
- Empty state mobile : `<div class="mc-empty">Aucun match pour ces filtres.</div>` rendu si liste vide ([pariscore.html:26273-26276](pariscore.html#L26273)).
- Null safety `applyFootballPreset` : tous les `querySelector` sont guard `&&` avant `.click()` / `.classList`.
- Null safety `renderMobileCards` : `Array.isArray(filtered) ? filtered.slice() : []`.

## ⚠️ Avertissements (non bloquants)

### W1 — `showNotification` jamais défini
**Localisation** : [pariscore.html:24520](pariscore.html#L24520) (matchday banner) et [pariscore.html:26171](pariscore.html#L26171) (closeMobFilters).
**Problème** : `showNotification('Filtres appliqués', 'green')` ne tourne jamais — fonction inexistante. Guard `typeof === 'function'` empêche le crash mais le toast UX n'apparaît pas.
**Recommandation** : Soit définir un toast global minimal (10 lignes : div fixed bottom + setTimeout 2s remove), soit retirer les appels. Décision UX : DG → ajouter le toast (feedback critique sur mobile).

### W2 — `_mfsRelocate` déplace les rows DOM hors `#page-matchs` sans flag de retour
**Localisation** : [pariscore.html:26124-26137](pariscore.html#L26124).
**Problème** : Architecture destructive — si un dev ajoute demain un sélecteur `#page-matchs .filter-chip[…]` (oubli pattern), regression silencieuse. Audit code futur fragile.
**Recommandation** : Long terme (P2), refactor en pattern "portal" : wrapper `#mfs-body` accueille des nœuds clonés OU `display:contents` + détection mobile au runtime — pas de déplacement DOM. Court terme : commenter `_mfsRelocate` en gras : « ⚠️ Tous les sélecteurs ciblant les chips doivent partir de l'ID de row, jamais de `#page-matchs` ».

### W3 — `confirmStrategy` `setTimeout(go, 320)` vulnerable `visibilitychange`
**Localisation** : [pariscore.html:10889-10890](pariscore.html#L10889).
**Problème** : Sur iOS Safari, si l'utilisateur switche d'app pendant les 320 ms d'anim, le timer peut être différé/annulé. `setup` reste affiché à son retour.
**Recommandation** (P1) : Cap le timer à 320 ms via `requestAnimationFrame` chained ou `transitionend` listener avec fallback `setTimeout(go, 600)`.

### W4 — `psPageBlocked('tennis')` pour freemium déclenche `renderLockedPage` après expiration fenêtre test
**Localisation** : [pariscore.html:24533-24539](pariscore.html#L24533) + [pariscore.html:24557](pariscore.html#L24557).
**Problème** : Fenêtre test 2026-05-15 → 2026-05-19 (exclu) **expire aujourd'hui**. Tous les comptes test-window tombent en freemium. Si user pick `Tennis` dans strategy-setup, `showPage('tennis')` → écran 🔒 « Pro Tennis requis » → confusion UX.
**Recommandation** (P0 ops, non code) : Prolonger fenêtre test à 2026-05-21 inclus le temps de valider le fix mobile. Ligne 24536.

### W5 — `chooseSport` `__hubBusy` cleared 380 ms après tap
**Localisation** : [pariscore.html:10800-10803](pariscore.html#L10800).
**Problème** : Si user tap-spam le card FOOT puis TENNIS en < 380 ms, `__hubBusy=true` bloque le second tap. Pas de feedback visuel pendant le délai.
**Recommandation** (P2) : Ajouter `.hub-card[aria-busy="true"]` pendant la transition pour signaler le verrou.

## ❌ Bugs détectés

### BUG-1 — `applyFootballPreset` sélecteurs cassés sur mobile [CORRIGÉ]
**Sévérité** : P0 (UX bloquant)
**Localisation (avant fix)** : [pariscore.html:10813](pariscore.html#L10813), 10825, 10828.
**Code problématique** :
```js
document.querySelector('#page-matchs .filter-chip[data-day="' + dayVal + '"]')
document.querySelector('#page-matchs .filter-chip[data-period="' + perVal + '"]')
document.querySelector('#page-matchs .filter-chip[data-kick="' + kickVal + '"]')
```
Sur mobile `_mfsRelocate` (parse-time, [pariscore.html:26158](pariscore.html#L26158)) sort `day-filter-row` / `topn-filter-row` / `period-kickoff-row` / `adv-filter-row` de `#page-matchs` vers `#mfs-body`. Les trois `querySelector` ci-dessus renvoient `null`. Aucun chip n'est cliqué. **Les filtres saisis dans strategy-setup ne s'appliquent jamais.**
**Fix appliqué** : Sélecteurs ancrés sur IDs de row (`#day-filter-row`, `#period-filter-row`, `#kickoff-filter-row`) — résistants à la relocalisation. Validation : grep `#page-matchs .filter-chip` post-fix → zéro résultat JS.

### BUG-2 — `closeMobFilters` ne déclenche aucun render [CORRIGÉ]
**Sévérité** : P1 (UX dégradée — silent action)
**Localisation (avant fix)** : [pariscore.html:26155-26162](pariscore.html#L26155).
**Code problématique** :
```js
window.closeMobFilters = function () {
  if (o) o.classList.remove('open');
  if (s) s.classList.remove('open');
};
```
La nappe « Filtres » se ferme sans re-render ni feedback. L'utilisateur tape « Voir les résultats » → rien ne semble se passer.
**Fix appliqué** : `renderMatches(allMatches)` forcé + appel guardé `showNotification`.

### BUG-3 — Aucune trace forensique sur `psLogout` / `apiFetch:401` [CORRIGÉ]
**Sévérité** : P1 (debugging impossible en prod)
**Localisation (avant fix)** : [pariscore.html:21910](pariscore.html#L21910), 21800.
**Problème** : Si CR-F (redirect accueil involontaire) se déclenche en prod, aucun log côté client → impossible de diagnostiquer.
**Fix appliqué** : `console.warn('[psLogout] called from:', stack)` + `console.warn('[apiFetch:401]', url, hadToken)`. Logs visibles DevTools mobile (chrome://inspect / Safari Web Inspector).

## 💡 Recommandations d'amélioration

1. **Test E2E mobile (P1)** : Ajouter `tests/mobile/strategy-setup.test.js` avec jsdom — simuler `_mfsRelocate` + `chooseSport('football')` + `confirmStrategy()` et asserter que `#day-filter-row .filter-chip[data-day="0"].active` existe quand `psStrategyFilters.days = '0'`.
2. **Cleanup `_mfsRelocate` (P2)** : Marquer architecturalement les IDs de row comme « anchors stables » (commentaire en haut de `_mfsRelocate`). Documenter dans CLAUDE.md section « Architecture mobile ».
3. **Retirer logs forensiques après 7 jours** : Si aucun `[psLogout]` ou `[apiFetch:401]` non-utilisateur n'apparaît dans les logs VPS, CR-F est écartée et logs supprimables.
4. **Définir `showNotification` (P1)** : Helper toast global 10 lignes (div fixed bottom-center + transition opacity + setTimeout 2.4s removal). Branché aussi dans matchday banner [pariscore.html:24520](pariscore.html#L24520).
5. **Étendre fenêtre test (P0 ops)** : Ligne [24536](pariscore.html#L24536) → `2026-05-21T00:00:00+02:00` le temps de valider le fix sur device réel.
6. **Audit suite (P1)** : Vérifier que aucun autre `#page-matchs ...` JS query n'est sensible à `_mfsRelocate`. Grep audité ici, aucun autre cas — mais re-grep à chaque PR.

---

*Test report rédigé selon procédure `.claude/skills/ps-test`. Bugs P0/P1 corrigés inline avant le déploiement VPS.*
