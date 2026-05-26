# Test Report — Tennis Stats Live Panel
**Date** : 2026-05-26
**Module** : `_tnToggleLiveStats` + `_tnRenderLiveStatsTable` + `_tnRenderServiceCircles`
**Commit de référence** : `c20dcea` (feat(tennis): Stats Live Panel + fix TT-OOP scope bug)

---

## ✅ Tests passés

- **Syntaxe** : `node --check server.js` → OK (0 erreur)
- **Payload API** : route `/tennis/api/v2/matches/live/` expose `live_stats: m._bsd_stats || null` dans le mapping objet match
- **`_normalizeBSDTennisMatch()`** : extrait 10 champs BSD avec `??` nullish coalescing (p1/p2_aces, p1/p2_df, p1/p2_first_pct + 4 champs étendus)
- **Toggle panel** : `_tnToggleLiveStats(matchId)` ouvre/ferme `#tnlsp-{id}` via attribut `hidden` + active/désactive class `.tn-stats-btn.active` — comportement validé par injection mock
- **Lazy-render guard** : `dataset.rendered = '1'` posé après render → 2ème clic ne re-rend pas la table (perf OK)
- **7 lignes stats** : Aces, Doubles fautes, 1er Service %, 1er Service gagné %, Balles de break sauvées, Retour gagné %, Total points
- **4 cercles SVG** : Service J1 (vert), Service J2 (bleu), Retour J1 (amber), Retour J2 (rouge) — `stroke-dashoffset` calculé dynamiquement sur pct
- **Code couleur comparatif** : valeur supérieure `.tn-sv` (vert `--green`), inférieure `.tn-sv-lo` (rouge `--red`) — logique symétrique J1 vs J2
- **Mock fallback** : si `live_stats` absent, injecte `_mock:true` + badge `[DEMO]` amber — données démo clairement identifiées
- **Design system** : tous les tokens CSS (`--blue`, `--green`, `--red`, `--amber`, `--bg2`, `--text3`, `--border`) hérités sans hardcoding
- **Intégrité grille** : bouton `📊 STATS` dans cellule status existante (flex gap:3px), panel `div.tn-live-stats-panel` inséré en frère du `.tn-live-row` → grid 11-colonnes non altérée
- **VB drawer gate** : section Stats dans `_tnRenderDrawerContent` gated sur `m.is_live && m.live_stats != null` → aucun `[DEMO]` sur entrées pre-match
- **TT-OOP boot-warm** : après relocalisation au scope module, log `[TT-OOP] ✓ 117 joueurs/courts pour "roland garros"` confirmé au démarrage — 0 crash
- **`_lastName()` helper** : null-safe pour noms joueurs vides/undefined

---

## ⚠️ Avertissements (non bloquants)

### W1 — BSD live ne fournit que 3/7 champs nativement
**Localisation** : `_normalizeBSDTennisMatch()` server.js ~18158 + lignes `_bsd_stats`
**Problème** : BSD live tennis feed expose seulement `p1_aces`, `p1_double_faults`, `p1_first_serve_pct`. Les 4 champs étendus (`p1_first_serve_won_pct`, `p1_break_points_saved`, `p1_return_points_won_pct`, `p1_total_points_won_pct`) sont absents → `null` → lignes correspondantes silencieuses (retournent `''`) en mode LIVE réel.
**Impact** : tableau live affiche 3 lignes peuplées + 4 lignes vides. Les cercles SVG "1er Service" et "Retour" seront vides si ces pcts manquent.
**Recommandation** : Contacter Bzzoiro (support Discord) pour demander l'ajout de ces champs au payload live tennis BSD. En attendant, la dégradation est gracieuse.

### W2 — Panel ne se rafraîchit pas automatiquement sur MAJ SSE
**Localisation** : `_tnToggleLiveStats()` pariscore.html + `window._tennisLastFetch` référence SSE
**Problème** : Une fois ouvert, `dataset.rendered='1'` empêche le re-render même si SSE pousse de nouvelles stats live. Les stats affiché correspondent à l'état au moment de l'ouverture.
**Impact** : faible — panel est un "snapshot" statique. L'utilisateur peut le fermer et rouvrir pour voir les stats fraîches.
**Recommandation** : À terme, invalider `delete panel.dataset.rendered` lors de chaque mise à jour SSE pour le match concerné (via `sse.addEventListener → matchId check`).

### W3 — Pas de bouton `📊 STATS` sur matchs VB (pre-match)
**Localisation** : `renderTennisValueBets()` pariscore.html — bouton conditionnel `m.is_live`
**Problème** : design attendu = bouton visible uniquement sur live. Correct. Mais le drawer VB avait auparavant une section Stats inconditionnelle qui affichait du `[DEMO]` sur les matchs pre-match.
**Impact** : corrigé (BUG-2 ci-dessous). Signalé ici comme avertissement résiduel : si un match passe de live à terminé pendant qu'un panel est ouvert, le bouton disparaît mais le panel reste visible (orphelin HTML). Impact cosmétique mineur.

---

## ❌ Bugs détectés

### BUG-1 — `ReferenceError: _runDailyTTOop is not defined` au boot
**Sévérité** : 🔴 CRITIQUE — crash serveur immédiat au démarrage
**Localisation** : `server.js` ~38022 (boot sequence) — appel `_runDailyTTOop()` au niveau module
**Code problématique** :
```javascript
// Ligne ~38022 — scope module
_runDailyTTOop(); // ReferenceError: _runDailyTTOop is not defined
// ...
// Ligne ~28900 — PROBLÈME : à l'intérieur de http.createServer(async (req,res) => {
async function _runDailyTTOop() { ... }
```
**Cause racine** : `http.createServer(async (req, res) => { ... })` est une arrow function de 14 000+ lignes. Les `async function` déclarées dans un bloc arrow ne sont PAS hissées au scope module — elles sont locales au bloc.
**Fix appliqué** : Extraction des 5 fonctions TT-OOP (`_TT_OOP_URLS`, `_ttOopCache`, `_parseTTOopHtml`, `_fetchTTOopForTournament`, `_ttLookupCourt`, `_runDailyTTOop`) vers le scope module (avant ligne 24315). Vérification par compteur de profondeur d'accolades.
**Commit** : `c20dcea`

### BUG-2 — VB drawer affichait `[DEMO]` sur matchs pre-match
**Sévérité** : 🟠 MOYEN — données trompeuses (fausses stats "live" sur matchs non commencés)
**Localisation** : `_tnRenderDrawerContent()` pariscore.html — section Stats Live
**Code problématique** :
```javascript
// Avant fix : gate insuffisant
${m.is_live ? `<div class="tn-drawer-section">..._tnRenderLiveStatsTable(m)...</div>` : ''}
// _tnRenderLiveStatsTable injecte mock si live_stats absent → [DEMO] sur matchs VB
```
**Fix appliqué** : Gate renforcé à `m.is_live && m.live_stats != null` — section Stats invisible sur pre-match et live sans données BSD.
**Commit** : `c20dcea`

### BUG-3 — Panel marqué `rendered` même si match absent du cache
**Sévérité** : 🟡 MINEUR — panel vide + retry impossible
**Localisation** : `_tnToggleLiveStats()` pariscore.html
**Code problématique** :
```javascript
const m = (window._tennisLastFetch || []).find(x => String(x.id) === String(matchId));
panel.innerHTML = m ? _tnRenderLiveStatsTable(m) : '';
panel.dataset.rendered = '1'; // ← marqué même si m = undefined → panel vide permanent
```
**Fix appliqué** : Early return `if (!m) return;` avant le set de `rendered`, permettant retry au prochain clic.
**Commit** : `c20dcea`

---

## 💡 Recommandations d'amélioration

1. **BSD champs étendus** — Ouvrir ticket Bzzoiro (Discord #support) : demander `p1_first_serve_won_pct`, `p1_break_points_saved`, `p1_return_points_won_pct`, `p1_total_points_won_pct` dans le payload live tennis. Estimé +4 champs → 7/7 rows peuplées en live réel. ROI élevé pour différenciation produit.

2. **Invalidation panel SSE** — Ajouter dans le handler SSE tennis live (`onmessage`) : pour chaque match mis à jour, `document.getElementById('tnlsp-' + m.id)?.removeAttribute('data-rendered')`. Ainsi le panel se re-render à la prochaine ouverture avec les stats fraîches. Effort ~30min.

3. **Masquer bouton si stats indisponibles (prod)** — En production sans mock, afficher `📊 STATS` uniquement si `m.live_stats != null` (pas juste `m.is_live`). Évite les panels vides. Pour dev local, le mock est utile → flag `STATS_DEMO_MODE=1` env optionnel.

---

*Rapport généré post-session 26/05/2026 — `/ps-test test localhost:3000`*
*Tous les bugs ❌ corrigés avant livraison. Feature déclarée livrée commit `c20dcea`.*
