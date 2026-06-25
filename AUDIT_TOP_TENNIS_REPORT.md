# 🎾 Rapport d'Audit — Sous-onglet "Top" (Top Matchs Tennis)

> **Date** : 2026-06-25
> **Périmètre** : Sous-onglet "Top" de la page Tennis (cartes Top 10 matchs)
> **Agents** : frontend-styling-expert (audit visuel/CSS) + QA tester senior (audit fonctionnel)
> **Post-hotfix** : v12.86 restructuration 3 zones (header/body/footer) — commit `7b5e220`
> **Verdict global** : Le hotfix 3-zones résout bien le crash visuel du grid zigzag. Il reste **8 bugs HIGH** (3 visuels + 5 fonctionnels), **18 bugs MED** et **25+ améliorations LOW** à traiter.

---

## 📊 Synthèse exécutive

| Sévérité | Visuel/CSS | Fonctionnel | Total |
|---|---|---|---|
| 🔴 HIGH | 3 | 5 | **8** |
| 🟡 MED | 6 | 12 | **18** |
| 🟢 LOW | 7 | 10 | **17** |
| ⚠️ Edge cases | — | 15 | **15** |
| **Total** | **16** | **42** | **58** |

**Recommandation** : Traiter les 8 bugs HIGH en priorité (effort estimé ~4h), puis les 18 MED (~6h), puis les LOW en rolling.

---

## 🔴 BUGS CRITIQUES (HIGH) — À traiter en premier

### H1 — `#tn2-top-grid` reste à 2 colonnes sur mobile (`!important` tue le responsive)
**Source** : frontend-styling-expert
**Fichier** : `pariscore.html:19833`
**Sévérité** : 🔴 HIGH visuel

```css
#tn2-top-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
```

**Problème** : Le sélecteur d'ID + `!important` écrase les media queries responsive (`.tn2-grid-3` sans `!important`). Sur mobile ≤768px, **2 cartes de ~180px** avec `.ps-metrics-row` en grid 3 col → ~50px par cellule. Illisible.

**Fix** :
```css
#tn2-top-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (max-width: 768px) {
  #tn2-top-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
}
```

---

### H2 — HTML malformé des sparklines forecast (div non fermé si 1 seul joueur)
**Source** : frontend-styling-expert + QA tester (H4)
**Fichier** : `pariscore.js:4613-4614`
**Sévérité** : 🔴 HIGH visuel + structure DOM

**Problème** : L'ouverture du `<div class="tn-t10-fc-line">` est conditionnée par `fc_p1`, sa fermeture `</div>` par `fc_p2`. Si un seul joueur a un forecast → `<div>` jamais fermé → DOM corrompu, layout cassé aléatoirement.

**Fix** : Restructurer en un seul template conditionnel (voir H4 du QA pour le code complet).

---

### H3 — Bouton `P_BETS` en `width: 100%` casse la flex des chips
**Source** : frontend-styling-expert
**Fichier** : `pariscore.html:4652-4662`
**Sévérité** : 🔴 HIGH visuel

**Problème** : `.p-bets-btn` avec `width: 100%` dans `.tn-t10-chips` (flex) → bouton énorme en dessous des chips. `grid-column: 1 / -1` est du dead code.

**Fix** :
```css
.p-bets-btn { width: auto; flex-shrink: 0; margin-left: auto; }
/* supprimer grid-column: 1 / -1; */
```

---

### H4 — Mode `powerscore` mal mappé côté serveur → tri incorrect
**Source** : QA tester
**Fichier** : `server.js:22093`
**Sévérité** : 🔴 HIGH fonctionnel

**Problème** : Le bouton ⚡ PW SCR envoie `?mode=powerscore`, mais le serveur ne reconnaît que `'pwscr'` → tombe dans le fallback `'viewer'`. Le frontend affiche les barres PowerScore mais l'ordre des cartes est celui du mode FAN.

**Fix** :
```js
const mode = query.mode === 'bettor' ? 'bettor'
           : (query.mode === 'pwscr' || query.mode === 'powerscore') ? 'pwscr'
           : 'viewer';
```

---

### H5 — `showNotification` n'existe pas → bouton 🎯 (AI Discord) muet
**Source** : QA tester
**Fichier** : `pariscore.js:4878, 4880, 4882, 4886`
**Sévérité** : 🔴 HIGH fonctionnel

**Problème** : `aiSendToDiscord()` teste `typeof showNotification === 'function'` mais seule `showToast` existe (`pariscore.js:21267`). Aucun feedback visible après clic 🎯.

**Fix** : Remplacer les 4 appels par `showToast(msg, type)` avec mapping `'green'→'success'`, `'orange'→'warning'`, `'red'→'error'`.

---

### H6 — Race conditions multiples dans `fetchTennisTop10()` (pas d'AbortController)
**Source** : QA tester
**Fichier** : `pariscore.js:4735-4837`
**Sévérité** : 🔴 HIGH fonctionnel

**Problème** : 5 entry points déclenchent `fetchTennisTop10()` sans lock. Les compteurs `_retry`, `_errorCount`, `_pollCount` sont incrémentés par plusieurs calls concurrents. Mode switch mid-flight → données d'un mode précédent affichées.

**Fix** : Ajouter `AbortController` :
```js
if (_tnTop10Abort) try { _tnTop10Abort.abort(); } catch(_) {}
_tnTop10Abort = new AbortController();
const res = await fetch(url, { signal: _tnTop10Abort.signal });
```

---

### H7 — `_tnEsc` n'échappe pas l'apostrophe → XSS potentielle
**Source** : QA tester
**Fichier** : `pariscore.js:4370-4372`
**Sévérité** : 🔴 HIGH sécurité

**Problème** : `_tnEsc` échappe `& < > "` mais pas `'`. Or `safeId` est injecté dans `onclick="openTennisAnalysisModal('${safeId}')"` avec délimiteur `'`. Un nom comme "O'Connell" → XSS.

**Fix** :
```js
function _tnEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
```

---

### H8 — Structure HTML brisée quand un seul joueur a un forecast TimesFM
**Source** : QA tester (identique à H2 visuel)
**Fichier** : `pariscore.js:4613-4614`
**Sévérité** : 🔴 HIGH structure DOM

→ Fusionné avec H2 ci-dessus.

---

## 🟡 BUGS MODÉRÉS (MED)

### M1 — Couleur hover odds-box hors charte (`#0055cc`)
**Fichier** : `pariscore.html:20046`
**Fix** : `background: #0077ff` + `box-shadow: 0 0 10px rgba(0,119,255,.35)`

### M2 — Dead code grid dans `.tn-t10-odds-wrapper` et `.tn-t10-bets`
**Fichiers** : `pariscore.html:20030, 20060`
**Fix** : Supprimer `grid-column` / `grid-row` morts (parents sont flex)

### M3 — Double-spacing dans `.tn-t10-card-header` (gap flex + margin-bottom enfant)
**Fichiers** : `pariscore.html:19984, 19998`
**Fix** : `margin-bottom: 0` sur `.tn-t10-surface` et `.tn-t10-date-badge`

### M4 — Prob-fill gradient hors charte (violet au lieu de vert/bleu)
**Fichier** : `pariscore.html:19990`
**Fix** : `linear-gradient(90deg, #0077ff, #00e676)`

### M5 — `.tn-t10-bet-odds` couleur `#64b5f6` hors charte
**Fichier** : `pariscore.html:20069`
**Fix** : `color: #38bdf8`

### M6 — `transition` incomplète sur `.tn-t10-card:hover` (box-shadow saute)
**Fichier** : `pariscore.html:19846`
**Fix** : Ajouter `box-shadow .2s ease` à la transition

### M7 — `stopTennisTop10()` ne clear pas `_forecastTimer` → leak polling
**Fichier** : `pariscore.js:4852-4854`
**Fix** : Ajouter `clearInterval(_forecastTimer)`

### M8 — `startTennisTop10()` appelé sur `showPage('tennis')` même si user reste sur LIVE
**Fichier** : `pariscore.js:930`
**Fix** : Retirer l'appel de `showPage('tennis')`, le garder uniquement dans `tn2SwitchTab('top')`

### M9 — `AppCache.set('/api/v1/tennis/top10', ...)` est du code mort
**Fichier** : `pariscore.js:4798`
**Fix** : Implémenter stale-while-revalidate OU supprimer la ligne

### M10 — Match live avec `sets_live: []` → badge "🔴 EN DIRECT" mais pas de score
**Fichier** : `pariscore.js:4409-4414`
**Fix** : Afficher "🔴 Score live en attente…" si `sets_live` vide

### M11 — Après 5 retries, message "Aucun match disponible" trompeur
**Fichier** : `pariscore.js:4784-4808`
**Fix** : Return avec message "⏳ Cache en construction, réessaie dans 1 min…"

### M12 — Pas de handler ESC pour fermer les modales
**Fichier** : `pariscore.html:15964, 15903`
**Fix** : Ajouter `keydown` listener Escape dans `openTennisAnalysisModal` et `openPBets`

### M13 — Re-render complet toutes les 60s via `innerHTML` → flicker + perte hover
**Fichier** : `pariscore.js:4821`
**Fix** : Comparer un hash du payload et skip le render si identique

### M14 — `.tn-t10-odds-box` purement décoratif (pas de onclick)
**Fichier** : `pariscore.js:4518-4526`
**Fix** : Ajouter `onclick` + `role="button"` OU `aria-label="Cote indicative (non cliquable)"`

### M15 — `meta` variable morte (ligne 4435)
**Fichier** : `pariscore.js:4435`
**Fix** : Supprimer la ligne

### M16 — Diversité tournoi (max 3) non signalée à l'utilisateur
**Fichier** : `server.js:37197`
**Fix** : Ajouter `filtered_out_by_diversity` au payload + l'afficher

### M17 — Élément `tn-top10-status` référencé dans le JS mais absent du HTML
**Fichier** : `pariscore.js:4737` vs `pariscore.html:15764-15779`
**Fix** : Ajouter `<span id="tn-top10-status">` dans le HTML

### M18 — Toast `_tnTop10AlertNewEntry` spam pendant rebuilds
**Fichier** : `pariscore.js:4635-4651`
**Fix** : Debounce 30s sur les alerts

---

## 🟢 AMÉLIORATIONS COSMÉTIQUES (LOW)

### L1 — `.tn-t10-card-body` reste en grid 2 col sur mobile
**Fix** : Media query `@media (max-width: 540px) { grid-template-columns: 1fr; odds-block en row }`

### L2 — `.ps-metrics-row` grid 3 col inline → risque d'overflow en footer étroit
**Fix** : Sortir le style inline du JS + media queries responsive (1 col mobile, 2 col tablet)

### L3 — Carte non focusable clavier (pas de tabindex/role/onkeydown)
**Fix** : Ajouter `tabindex="0" role="button" aria-label="..." onkeydown="..."`

### L4 — Tailles de police sous le seuil a11y (8-10px)
**Fix** : Monter `.tn-t10-conf` et `.tn-t10-odds-label` à 10-11px minimum

### L5 — `.tn-t10-prob-row` défini deux fois (dead duplicate)
**Fix** : Supprimer la ligne 19956

### L6 — `.tn-t10-card-header` a trop d'air (padding-bottom + gap + border = 23px)
**Fix** : `padding-bottom: 0` (le gap + border suffisent)

### L7 — Erreur syntaxique CSS : `}` orphelin après `.ps-metric-xxl-value`
**Fichier** : `pariscore.html:23836`
**Fix** : Supprimer le `}` stray

### L8 — Pas de `loading="lazy"` sur les photos 48px
**Fix** : Ajouter `loading="lazy" decoding="async"` aux 4 `<img>`

### L9 — Tooltip explainability n'inclut pas la 6ᵉ dimension (`elo`)
**Fix** : Ajouter `+ (d.elo != null ? '\nElo: ' + d.elo : '')`

### L10 — Pas de `role="list"` / `role="listitem"` pour les screen readers
**Fix** : Ajouter les rôles ARIA sur `#tn2-top-grid` et `.tn-t10-card`

### L11 — Blocs métriques `.ps-metric-xxl` non accessibles clavier
**Fix** : Ajouter `tabindex="0" role="button" onkeydown="..."`

### L12 — Formatage live score : double espace + pas d'espace avant sets label
**Fix** : `sets_live.join(' ')` et `${setsStr} ${setsLabel}`

### L13 — `confidence_level.toLowerCase()` peut crasher si valeur non-string
**Fix** : `String(m.confidence_level || '').toLowerCase()`

### L14 — `_tnTop10AlertNewEntry` utilise `m.matchId` uniquement (pas de fallback)
**Fix** : `String(m.matchId || m.id || '')`

### L15 — Pas de `aria-live` sur le conteneur pour annoncer les changements de top 3
**Fix** : Ajouter `aria-live="polite"` sur `#tn2-top-grid`

### L16 — Bouton 🎯 n'a pas d'état disabled visuel clair
**Fix** : `.tn-t10-ai:disabled { opacity: 0.6; cursor: wait; }`

### L17 — Focus outline couleur hors charte (`#e2700a` au lieu de `#0077ff`)
**Fix** : `outline: 2px solid #0077ff`

---

## ⚠️ EDGE CASES NON GÉRÉS

| # | Cas | Comportement actuel | Comportement attendu |
|---|---|---|---|
| E1 | Match live avec `sets_live: []` | Badge "🔴 EN DIRECT" sans score | Placeholder "Score live en attente" |
| E2 | Match terminé entre 2 polls (60s) | Carte reste visible ; P_BETS affiche "Match terminé" | Invalidation immédiate via SSE |
| E3 | Mode `powerscore` | Retourne cache `viewer` | Retourner cache `pwscr` |
| E4 | Mode switch mid-flight | Pas d'abort, dernière réponse gagne | AbortController |
| E5 | Polls `building` concurrents | `setTimeout` pile + `setInterval` 60s → 2 fetchs parallèles | Lock/mutex |
| E6 | Nom joueur avec apostrophe | `_tnEsc` ne escape pas `'` → XSS | Échapper `'` → `&#39;` |
| E7 | Tournoi avec >3 matchs éligibles | Filtrage silencieux | Afficher "X matchs masqués" |
| E8 | ESC pour fermer modale | Ne fonctionne pas | Handler global Escape |
| E9 | Forecast pour 1 seul joueur | HTML mal formé | Un seul template conditionnel |
| E10 | PowerScore null pour 1 joueur | Affiche `?` mais barre rend 0% | "PS indispo" + barre grisée |
| E11 | `predictive.prematch` vide mais `kpi` présent | Verdict kpi non affiché | Afficher le verdict même sans prematch |
| E12 | Status "stale" (cache miss + pas de rebuild) | Retombe dans legacy retry → "Aucun match" | "Cache en construction" |
| E13 | Plus de 10 cartes reçues | Toutes affichées | OK (slice côté serveur) |
| E14 | `m.start_time` ISO vs Unix | Les deux gérés | Afficher la TZ pour clarté |
| E15 | Surface + round manquants | Pas de pill | OK |

---

## ✅ VÉRIFICATIONS CHARTE GRAPHIQUE (designui.md)

| Critère | Statut | Détail |
|---|---|---|
| Fond carte `#131722`-`#161c2a` | ⚠️ PARTIEL | `linear-gradient(145deg, #182030, #121824)` — `#182030` plus clair que la charte |
| Vert accent `#00e676` | ✅ | Utilisé partout (border-left, EV chips, score high) |
| Bleu accent `#0077ff`/`#38bdf8` | ⚠️ PARTIEL | `#64b5f6` (M5) et `#0055cc` (M1) au lieu de `#0077ff` |
| Rouge live `#ff3d00`/`#ef4444` | ⚠️ MINEUR | `#f44336` (Material Red) proche mais pas exact |
| Border-radius 6-8px | ✅ | Carte 8px, odds-box 6px |
| Bordures `rgba(255,255,255,.05-.08)` | ✅ | Respecté |
| DM Mono pour cotes | ✅ | score-badge, rank, odds-value, chips, bets |
| Instrument Sans pour noms | ✅ | `.tn-t10-player-name`, `.tn-t10-surface` |
| Hiérarchie 60-30-10 | ✅ | Fond sombre dominant, accents clairsemés |
| Odds-box "creux plus sombre" | ✅ | `#0e1420` vs carte `#182030` |
| Hover odds = "bleu électrique + lueur" | ❌ | `#0055cc` sans lueur → M1 |
| `inset` reflet de verre | ✅ | `inset 1px 1px 0 rgba(255,255,255,.02)` |

---

## ✅ STATUS DES BUGS CONNUS (cf todo.md)

| Bug | Statut |
|---|---|
| BUG-001 valeurs fictives EWMA | ✅ Déployé |
| safeFixed null logging | ✅ Actif |
| `__tennisVBWarmMatches` peuplé | ✅ Peuplé |
| Cache TTL Top10 (5min/3min) | ✅ Conforme |
| Boot warmer 5s | ✅ Conforme |
| Race condition `__top10RebuildPromise` | ✅ Conforme (Promise.race + finally) |
| Status API polling | ✅ Conforme (`building`/`ready`/`stale`) |

---

## 🎯 PLAN D'ACTION PRIORISÉ

### Sprint 1 — Bugs HIGH (effort ~4h)

| # | Tâche | Fichier | Effort | Équipe |
|---|---|---|---|---|
| 1 | H1 — Retirer `!important` + media query mobile | `pariscore.html:19833` | 5 min | CSS |
| 2 | H2/H8 — Refactor sparkline template | `pariscore.js:4613-4614` | 10 min | JS |
| 3 | H3 — `width: auto` sur `.p-bets-btn` | `pariscore.html:4659` | 2 min | CSS |
| 4 | H4 — Alias `powerscore` → `pwscr` côté serveur | `server.js:22093` | 2 min | Backend |
| 5 | H5 — Remplacer `showNotification` par `showToast` | `pariscore.js:4878-4886` | 10 min | JS |
| 6 | H6 — AbortController dans `fetchTennisTop10` | `pariscore.js:4735` | 20 min | JS |
| 7 | H7 — `_tnEsc` échapper `'` | `pariscore.js:4370` | 2 min | JS |

### Sprint 2 — Bugs MED (effort ~6h)

| # | Tâche | Effort |
|---|---|---|
| M1+M5 | Aligner bleus sur `#0077ff`/`#38bdf8` | 5 min |
| M2 | Supprimer dead code `grid-column` | 5 min |
| M3 | Retirer `margin-bottom` redondants | 5 min |
| M4 | Gradient prob-fill vert/bleu | 2 min |
| M6 | Ajouter `box-shadow` à la transition | 2 min |
| M7 | `stopTennisTop10()` clear `_forecastTimer` | 5 min |
| M8 | Retirer `startTennisTop10()` de `showPage('tennis')` | 5 min |
| M9 | Implémenter stale-while-revalidate AppCache | 20 min |
| M10 | Placeholder "Score live en attente" | 10 min |
| M11 | Message "Cache en construction" après 5 retries | 5 min |
| M12 | Handler ESC pour modales | 15 min |
| M13 | Hash comparison skip render | 15 min |
| M14 | odds-box onclick ou aria-label | 10 min |
| M15-M18 | Cleanup variables mortes + status element + debounce toast | 20 min |

### Sprint 3 — Améliorations LOW (effort ~3h, rolling)

| # | Tâche | Effort |
|---|---|---|
| L1+L2 | Media queries mobile `.tn-t10-card-body` + `.ps-metrics-row` | 15 min |
| L3+L11 | Accessibilité clavier (tabindex/role/onkeydown) | 20 min |
| L4 | Remonter tailles police 8→10-11px | 5 min |
| L5+L6+L7 | Cleanup duplicates + stray brace + spacing | 10 min |
| L8 | `loading="lazy"` sur photos | 5 min |
| L9-L17 | Divers améliorations fonctionnelles | 30 min |

---

## 📌 POINTS POSITIFS À CONSERVER

- ✅ Le hotfix 3-zones (header/body/footer) est **structurellement correct** et résout bien le zigzag grid
- ✅ La grid 2 col du body (`1fr auto` pour players|odds) est **bien isolée**
- ✅ Les bordures horizontales délimitent clairement les zones
- ✅ `.tn-t10-players-block { min-width: 0 }` permet la truncation correcte
- ✅ Les couleurs sémantiques par `data-reason` sont élégantes et conformes
- ✅ L'animation live pulse via `:has()` est moderne et propre
- ✅ L'accessibilité des boutons internes (🎯, P_BETS) est bonne
- ✅ Le cache serveur (TTL 5min/3min + warmer 5s + stale-while-revalidate) est robuste
- ✅ La race condition `__top10RebuildPromise` est bien gérée (Promise.race + finally)

---

## 📋 CONCLUSION

Le hotfix v12.86 a **correctement restauré la structure visuelle** des cartes Top Matchs Tennis. Le sous-onglet n'est plus "crashé" — les cartes s'affichent en 3 zones claires (header/body/footer) avec les joueurs à gauche et les cotes à droite.

Cependant, l'audit révèle **8 bugs HIGH** restants qui dégradent significativement l'UX :
- **3 visuels** : responsive mobile cassé, HTML malformé forecast, bouton P_BETS full-width
- **5 fonctionnels** : mode powerscore mal mappé, bouton 🎯 muet, race conditions, XSS potentiel, structure DOM forecast

**Recommandation** : traiter le Sprint 1 (8 bugs HIGH) en priorité absolue avant de considérer le sous-onglet "Top" comme stable. Les sprints 2 et 3 peuvent être rolling sur la semaine suivante.

Le rapport complet avec code de fix proposé pour chaque item est disponible ci-dessus. L'équipe coding/ingénierie peut attaquer directement les correctifs.
