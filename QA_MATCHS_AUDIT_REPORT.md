# Rapport d'Audit QA Fonctionnel — Sous-onglet MATCHS (Tennis)

**Périmètre** : sous-onglet "MATCHS" du tab Tennis (Pariscore)
**Fichiers audités** :
- `pariscore.js` lignes 5259-5754 (recherche, 7 filtres, tri, rendering, popups, section tournois)
- `pariscore.html` lignes 15750-15792 (DOM du tab MATCHS)
- `server.js` lignes 41686-41926 (routes API) + 29581-30025 (fetchTexMatches/Calendar/Player) + 30582-30789 (fetchTexMatchDetail)

**Méthode** : revue de code statique + reproduction mentale des 10 scénarios + validation Node.js des hypothèses critiques.

**Verdict global** : **4 bugs HIGH, 11 bugs MED, 8 bugs LOW**. Le flux principal fonctionne mais plusieurs dysfonctionnements affectent l'UX quotidiennement.

---

## Synthèse des bugs par criticité

| ID | Sévérité | Zone | Résumé |
|----|----------|------|--------|
| H1 | HIGH | Tournois collapsible | `loadTexTournamentsToday()` jamais appelée à l'ouverture initiale → section vide |
| H2 | HIGH | Tournois collapsible | Filtre semaine cassé : `new Date("15.05.2026")` = Invalid Date → fallback 8 premiers tournois |
| H3 | HIGH | Popup fiche joueur | Bris onclick pour joueurs avec apostrophe (O'Connell, O'Mara…) → SyntaxError JS |
| H4 | HIGH | Popup fiche joueur | L5 "Derniers matchs" : `won` calculé mais jamais rendu + logique tautologique |
| M1 | MED | Tableau matchs | En-tête "Form" alors que le corps affiche Elo P1/P2 |
| M2 | MED | Toggle ATP/WTA | Recherche non réinitialisée au changement de tour → 0 résultats inattendus |
| M3 | MED | Tableau matchs | `colspan="6"` dans tourHeader alors que la table n'a que 5 colonnes |
| M4 | MED | Filtre "Heure" | Tri `localeCompare` lexicographique : cassé si heures non zero-padded ("2:00" > "12:00") |
| M5 | MED | Recherche | Pas de debounce → re-render complet à chaque keypress (lag sur 50+ matchs) |
| M6 | MED | Auto-refresh 5min | Timer jamais nettoyé au changement d'onglet/page → fetch inutiles en arrière-plan |
| M7 | MED | Popup fiche joueur | Elo lookup `LIKE %name%` peut matcher un mauvais joueur (homonymes) |
| M8 | MED | Popup fiche joueur | Photo toujours générique (ui-avatars) — photo TennisExplorer non extraite |
| M9 | MED | Popup match-detail | Colonne "Drift" affiche 2 valeurs (p1, p2) sans labels distincts |
| M10 | MED | Catégorisation tournois | Dubai mal classifié en `wta_1000` même pour ATP 500 |
| M11 | MED | Auto-refresh | Remplace `_texMatchsRawData` sans préserver la sélection/scroll utilisateur |
| L1 | LOW | Recherche | Pas de bouton "X" pour vider le champ |
| L2 | LOW | Popups | Pas de fermeture via touche Échap |
| L3 | LOW | Popups | Pas de focus-trap (accessibilité) |
| L4 | LOW | Images | Pas de `onerror` fallback sur `<img>` ui-avatars |
| L5 | LOW | Popup match-detail | "Moyenne : p1 p2" sans labels |
| L6 | LOW | Popup match-detail | H2H affiche "unknown" au lieu de "0 match" |
| L7 | LOW | Tournois collapsible | Pas d'auto-refresh de la section tournois (24h cache OK mais pas de timer) |
| L8 | LOW | Filtres | Bordure du bouton actif non accentuée (seulement bg/color) |

---

## Détail des bugs HIGH

### H1 — Section "Tournois du jour" vide à l'ouverture initiale

**Localisation** : `pariscore.html:16353-16355` (tn2SwitchTab case 'matchs') + `pariscore.js:5378`

**Description** :
Le `tn2SwitchTab('matchs')` appelle uniquement `loadTexMatchs()` à l'ouverture du tab. La fonction `loadTexTournamentsToday()` n'est appelée que depuis `texMatchsSetTour()` (boutons ATP/WTA). Conséquence : au premier affichage du tab MATCHS, la section collapsible "Tournois du jour" (`#tex-tournaments-today`) reste vide (`display:none` + innerHTML vide). L'utilisateur qui déplie voit un bloc vide.

**Scénario de repro** :
1. Ouvrir Pariscore → aller sur Tennis → tab MATCHS
2. Déplier la section "Tournois du jour" (cliquer sur le header "+")
3. **Observer** : bloc vide, aucun tournoi affiché
4. Cliquer WTA puis ATP → les tournois apparaissent enfin

**Fix proposé** : ajouter `loadTexTournamentsToday()` dans le `case 'matchs':` de `tn2SwitchTab` (pariscore.html:16354).

---

### H2 — Filtre semaine cassé → affiche les tournois de janvier

**Localisation** : `pariscore.js:5411-5416` (loadTexTournamentsToday)

**Description** :
Le parser serveur `_texParseCalendar` (server.js:29931) produit `start_date` au format **"DD.MM.YYYY"** (ex: "15.05.2026"). Le client fait :
```js
var d = new Date(t.start_date);  // new Date("15.05.2026")
return d >= weekStart && d <= weekEnd;
```
Or `new Date("15.05.2026")` retourne **Invalid Date** (format non-ISO, non-US). `NaN >= weekStart` = `false` pour tous les tournois → le filtre semaine échoue systématiquement → fallback `list.slice(0, 8)` qui affiche les 8 premiers tournois triés par catégorie (Grand Slams d'abord → Australian Open, Roland Garros, Wimbledon, US Open…).

**Validation Node.js** :
```
Test new Date("15.05.2026"): Invalid Date
Test isValid: false
```

**Scénario de repro** :
1. Ouvrir Tennis → MATCHS → basculer ATP/WTA pour déclencher `loadTexTournamentsToday`
2. Déplier "Tournois du jour"
3. **Observer** : en mai, on voit "Australian Open" (janvier) au lieu des tournois de la semaine courante

**Fix proposé** : parser la date côté client avec le même regex que le serveur (server.js:30003) :
```js
var parts = t.start_date.match(/(\d+)\.\s*(\d+)\.?\s*(\d{4})?/);
if (parts) {
  var d = new Date(parts[3] || new Date().getFullYear(), parseInt(parts[2],10)-1, parseInt(parts[1],10));
  return d >= weekStart && d <= weekEnd;
}
```
Ou mieux : faire retourner par l'API un champ `start_date_iso` normalisé.

---

### H3 — Bris onclick pour joueurs avec apostrophe (XSS / SyntaxError)

**Localisation** : `pariscore.js:5453-5454` (_renderTexMatchs, ligne 300-301 du dump)

**Description** :
Le rendu du nom joueur dans le tableau injecte le slug/name dans un attribut `onclick` via `_tnEsc` :
```js
'<a href="javascript:void(0)" onclick="event.stopPropagation();openPlayerProfile(\'' + _tnEsc(p1Slug) + '\',\'' + _tnEsc(m.player1.name||'') + '\',\'' + _tnEsc(m.surface||'') + '\')" ...>'
```
`_tnEsc` (pariscore.js:4372) convertit `'` en `&#39;`. Mais le navigateur **décode les entités HTML avant l'interprétation JS** de l'attribut `onclick`. Pour un joueur "Christopher O'Connell" :
- `_tnEsc("Christopher O'Connell")` → `"Christopher O&#39;Connell"`
- HTML : `onclick="...openPlayerProfile('slug','Christopher O&#39;Connell','Hard')"`
- JS décodé par le navigateur : `openPlayerProfile('slug','Christopher O'Connell','Hard')`
- **SyntaxError: missing ) after argument list**

**Validation Node.js** :
```
_tnEsc(name): Christopher O&#39;Connell
HTML décodé dans onclick JS: openPlayerProfile('slug','Christopher O'Connell','Hard')
JS ERROR: missing ) after argument list
```

**Scénario de repro** :
1. Ouvrir Tennis → MATCHS (ATP)
2. Trouver un match de Christopher O'Connell (ATP top 100)
3. Cliquer sur son nom
4. **Observer** : rien ne se passe (popup ne s'ouvre pas), erreur JS dans la console

**Joueurs ATP/WTA concernés** : Christopher O'Connell, et historiquement tout joueur avec une apostrophe (O'Mara, O'Brien, D'Avola…).

**Fix proposé** : utiliser `JSON.stringify` pour échapper les chaînes JS au lieu de l'échappement HTML :
```js
var args = JSON.stringify([p1Slug, m.player1.name||'', m.surface||'']);
'<a ... onclick="event.stopPropagation();openPlayerProfile.apply(null,' + args + ')" ...>'
```
Ou migrer vers `data-*` attributes + `addEventListener`.

---

### H4 — L5 "Derniers matchs" : pas de distinction victoire/défaite

**Localisation** : `pariscore.js:5529-5544` (openPlayerProfile, section L5)

**Description** :
Deux problèmes dans la section "Derniers matchs" de la popup fiche joueur :

1. **Logique `won` tautologique** (ligne 5737 du source, ligne 479 du dump) :
```js
var status = m.status || '';
var won = status === 'finished' ? (isP1 && /won/i.test(status)) : null;
```
`/won/i.test(status)` teste la chaîne `"finished"` qui ne contient jamais "won" → `won` est **toujours false**. La regex devrait tester un champ `winner` ou comparer le score, pas `status`.

2. **`won` calculé mais jamais utilisé** : la variable `won` n'est jamais insérée dans le HTML rendu. Aucune pastille verte/rouge n'indique si le joueur a gagné ou perdu chaque match du L5.

**Scénario de repro** :
1. Ouvrir MATCHS → cliquer sur un joueur (ex: Sinner)
2. Dans la popup, regarder la section "Derniers matchs"
3. **Observer** : chaque ligne affiche "Tournoi · Adversaire" + score, sans aucune indication V/D ou couleur différenciant victoire/défaite

**Fix proposé** :
- Corriger la détection : `var won = isP1 ? (m.winner === 'p1' || m.sets_won_p1 > m.sets_won_p2) : (m.winner === 'p2' || m.sets_won_p2 > m.sets_won_p1);`
- Ajouter une pastille colorée dans le HTML : `'<span style="color:' + (won ? '#00e676' : '#ef4444') + ';font-weight:700;">' + (won ? 'V' : 'D') + '</span>'`

---

## Détail des bugs MED

### M1 — En-tête "Form" alors que le corps affiche Elo

**Localisation** : `pariscore.js:5469` (header) vs `pariscore.js:5461` (body)

Le `<th>` dit "Form" mais la cellule du corps affiche `eloHtml` = "1900 / 1850" (Elo P1/P2). Incohérence : soit l'en-tête doit dire "Elo", soit le corps doit afficher la form récente (L5). Recommandation : renommer l'en-tête en "Elo" (cohérent avec la fonctionnalité réelle).

---

### M2 — Recherche non réinitialisée au changement de tour

**Localisation** : `pariscore.js:5366-5375` (texMatchsSetTour)

`texMatchsSetTour` modifie `_texMatchsTour` et appelle `loadTexMatchs()` mais ne vide pas `_texMatchsSearchQuery` ni le champ `#tex-matchs-search`. Si l'utilisateur cherche "Sinner" sur ATP puis bascule WTA, la recherche "sinner" persiste → 0 résultats WTA → message "Aucun match trouve pour 'sinner'" qui semble inexplicable.

**Fix proposé** :
```js
function texMatchsSetTour(tour) {
  _texMatchsTour = tour;
  _texMatchsSearchQuery = '';
  var searchInput = document.getElementById('tex-matchs-search');
  if (searchInput) searchInput.value = '';
  // ... reste inchangé
}
```

---

### M3 — `colspan="6"` mismatch (5 colonnes réelles)

**Localisation** : `pariscore.js:5473` (tourHeader)

Le tableau a 5 colonnes (Heure / Match / Form / Score / Cotes) mais l'en-tête de groupe tournoi utilise `colspan="6"`. Visuellement le navigateur lisse mais cela peut causer des soucis d'alignement sur certains navigateurs. **Fix** : `colspan="5"`.

---

### M4 — Tri "Heure" cassé si heures non zero-padded

**Localisation** : `pariscore.js:5294-5296` (case 'time')

```js
sorted.sort(function(a, b) {
  var ta = a.time_utc || '99:99';
  var tb = b.time_utc || '99:99';
  return ta.localeCompare(tb);
});
```

`localeCompare` est lexicographique. Si Tennis Explorer renvoie "2:00" (sans zero-pad), alors `'2:00'.localeCompare('12:00')` = **1** → 2:00 trié APRÈS 12:00 (incorrect chronologiquement).

**Validation Node.js** :
```
localeCompare 2:00 vs 12:00: 1   ← mauvais (devrait être -1)
localeCompare 02:00 vs 12:00: -1 ← correct
```

**Fix proposé** : normaliser en minutes avant tri :
```js
var toMin = function(t) { var p = (t||'99:99').split(':'); return (+p[0])*60 + (+p[1]); };
return toMin(ta) - toMin(tb);
```

---

### M5 — Pas de debounce sur le champ recherche

**Localisation** : `pariscore.html:15768` (`oninput="texMatchsSearch(this.value)"`) + `pariscore.js:5266`

Chaque keypress déclenche `texMatchsSearch` → `_renderTexMatchs` qui fait un `body.innerHTML = ...` complet. Pour 50+ matchs avec photos (`<img>`), c'est un re-render coûteux. Sur un appareil lent, frapper "sinner" (6 caractères) = 6 re-renders en rafale = lag visible.

**Fix proposé** : debouncer à 250ms :
```js
var _texSearchDebounce = null;
function texMatchsSearch(query) {
  clearTimeout(_texSearchDebounce);
  _texSearchDebounce = setTimeout(function() {
    _texMatchsSearchQuery = (query || '').toLowerCase().trim();
    if (_texMatchsRawData && _texMatchsRawData.matches) _renderTexMatchs(_texMatchsRawData);
  }, 250);
}
```

---

### M6 — Timer auto-refresh jamais nettoyé au changement d'onglet/page

**Localisation** : `pariscore.js:5477` (`_texMatchsTimer = setInterval(...)`)

Le timer 5min est créé dans `_renderTexMatchs` et nettoyé uniquement au re-render suivant. Si l'utilisateur bascule sur le tab "LIVE" ou "TOP" puis quitte la page Tennis, le timer continue de fetcher `/api/v1/tennis/tex/matches` toutes les 5min en arrière-plan, avec re-render d'un DOM caché. Gaspillage CPU/bandeille.

**Fix proposé** : clearInterval dans `tn2SwitchTab` quand on quitte le tab 'matchs', et dans le cleanup de page Tennis.

---

### M7 — Elo lookup `LIKE %name%` peut matcher un homonyme

**Localisation** : `server.js:41885`

```sql
SELECT player_name, elo, tour, surface, matches_count
FROM tennis_elo WHERE player_name LIKE ? COLLATE NOCASE
-- param: '%' + profile.name.toLowerCase() + '%'
```

Pour "Carlos Alcaraz", le LIKE `%alcaraz%` peut aussi matcher un junior "Alcaraz Garcia" si présent en base. Le `.get()` retourne la première ligne, potentiellement la mauvaise.

**Fix proposé** : préférer match exact puis fallback fuzzy :
```sql
SELECT ... WHERE player_name = ? COLLATE NOCASE
UNION ALL
SELECT ... WHERE player_name LIKE ? COLLATE NOCASE
ORDER BY length(player_name) ASC LIMIT 1
```

---

### M8 — Photo joueur toujours générique (ui-avatars)

**Localisation** : `server.js:41892-41894`

```js
profile.photo_url = profile.name
  ? 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.name) + '...'
  : null;
```

Tennis Explorer a des photos joueurs sur ses pages profil, mais `_texParsePlayerPage` ne les extrait pas. Toutes les photos sont des avatars à initiales. UX décevante pour un tab "MATCHS" qui se veut premium.

**Fix proposé** : extraire l'URL photo depuis `html.match(/<img[^>]+class="player-img[^"]*"[^>]+src="([^"]+)"/)` dans `_texParsePlayerPage` et l'exposer comme `texData.photo_url`.

---

### M9 — Colonne "Drift" du popup match-detail sans labels

**Localisation** : `pariscore.js:5509-5510` (openTexMatchDetail)

```js
'<td>...<span style="color:'+dColor(d1)+'">'+dTxt(d1)+'</span> <span style="color:'+dColor(d2)+'">'+dTxt(d2)+'</span></td>'
```

La colonne "Drift" affiche deux valeurs côte-à-côte (drift p1, drift p2) sans indiquer laquelle correspond à quel joueur. L'utilisateur doit deviner ou regarder l'ordre des colonnes précédentes.

**Fix proposé** : ajouter des micro-labels ou séparer en 2 sous-colonnes "Drift P1" / "Drift P2".

---

### M10 — Dubai mal classifié en `wta_1000` même pour ATP 500

**Localisation** : `server.js:29976`

```js
if (/\bwta\s*1000\b|dubai|qatar|guadalajara/i.test(n) && !/\b500\b/.test(n)) return 'wta_1000';
```

Le regex matche "dubai" dans n'importe quel nom. "Dubai ATP 500" (qui existe) est classifié `wta_1000` si le nom ne contient pas "500". Or "Dubai ATP 500" contient "500" → exclus → passe au suivant. OK pour ce cas. Mais "Dubai Championships" (sans "500") serait classifié `wta_1000` même si c'est un tournoi ATP.

**Fix proposé** : conditionner `dubai` à la présence de "wta" dans le nom, ou utiliser une liste explicite de slugs tournois.

---

### M11 — Auto-refresh remplace les données sans préserver la sélection/scroll

**Localisation** : `pariscore.js:5477` + `pariscore.js:5437-5450` (loadTexMatchs)

Toutes les 5min, `loadTexMatchs` fait un `body.innerHTML = ...` complet. Si l'utilisateur a scrollé dans le tableau et lit un match spécifique, le re-render remet le scroll en haut et le match peut disparaître (si retiré de la nouvelle réponse). Pas de préservation de la position ni du match survolé.

**Fix proposé** : sauvegarder `scrollTop` avant render et le restaurer après ; ou utiliser un diff DOM au lieu d'un innerHTML complet.

---

## Détail des bugs LOW

- **L1** — Pas de bouton "✕" pour vider rapidement la recherche (l'utilisateur doit effacer manuellement).
- **L2** — Pas de fermeture des popups via touche Échap (seul clic extérieur / bouton ✕ fonctionne).
- **L3** — Pas de focus-trap dans les popups (le Tab peut sortir du modal vers le fond). Accessibilité.
- **L4** — Pas de `onerror` sur les `<img>` ui-avatars : si le service est down, images cassées sans fallback.
- **L5** — `avgHtml` affiche "Moyenne : 1.85 2.10" sans label P1/P2.
- **L6** — H2H : si 0 match, affiche "unknown" au lieu de "0 match" (off-by-one : `length - 1` sur array vide = -1).
- **L7** — `loadTexTournamentsToday` n'a pas de timer auto-refresh (cache serveur 24h acceptable, mais pas de refresh client).
- **L8** — Bouton filtre actif : seul `background` + `color` sont updatés, pas la `border` (cosmétique).

---

## Tests par scénario — Résultats

| # | Scénario | Statut | Notes |
|---|----------|--------|-------|
| 1 | Flux utilisateur complet (MATCHS → recherche → filtre → clic joueur → popup → fermer) | ⚠️ PARTIEL | Brisé si joueur avec apostrophe (H3) |
| 2 | 7 filtres (Heure, Elo Delta, Value, Drift, Elite, Rating, Upset) | ✅ OK | Tous trient correctement ; Heure a caveat M4 |
| 3 | Recherche (nom joueur, tournoi, case, caractères spéciaux, vide) | ✅ OK | Case-insensitive ✓, caractères spéciaux ✓ (traits comme littéraux), vide ✓ |
| 4 | Popup fiche joueur (photo, classement, Elo, W-L surface, prize, L5) | ⚠️ PARTIEL | L5 sans distinction V/D (H4) ; photo générique (M8) |
| 5 | Popup match-detail (bookmakers, drift, H2H, average) | ⚠️ PARTIEL | Drift sans labels (M9) ; H2H "unknown" (L6) |
| 6 | Section tournois collapsible | ❌ KO | Vide à l'ouverture (H1) + filtre semaine cassé (H2) |
| 7 | Toggle ATP/WTA | ⚠️ PARTIEL | Recharge OK mais recherche persiste (M2) |
| 8 | Auto-refresh 5min (pas de flicker, pas de perte filtre/recherche) | ⚠️ PARTIEL | Pas de flicker ✓, filtre/recherche préservés ✓, MAIS scroll perdu (M11) + timer non nettoyé (M6) |
| 9 | Edge cases (0 match, API KO, joueur sans Elo, tournoi sans surface, match sans cotes) | ✅ OK | Tous gérés avec fallbacks "—" / messages d'erreur |
| 10 | Responsive mobile (tableau scrollable, filtres wrappent) | ✅ OK | `overflow-x:auto` ✓, `flex-wrap:wrap` ✓ ; pas de CSS dédié mais inline-style suffit |

---

## Points positifs

- **Architecture des 7 filtres** : switch-case clair, chaque filtre a son badge visuel dédié, re-tri sans refetch (utilise `_texMatchsRawData` en cache).
- **Value score / Match rating** : calcul serveur composite pondéré (Elo 30% + comp 25% + prestige 20% + drift 15% + odds 10%) — bien pensé.
- **Gestion des edge cases** : 0 match, API KO, joueur sans Elo, match sans cotes → tous ont un fallback visuel propre.
- **Auto-refresh sans flicker** : le test `body.innerHTML.includes('tex-matchs-table')` skip le loading state si la table existe déjà.
- **Préservation filtre/recherche au refresh** : `_texMatchsFilter` et `_texMatchsSearchQuery` sont module-scopés et non réinitialisés au render.
- **Caching serveur multi-niveau** : TEX_MATCHES_TTL 30min, TEX_PLAYER_TTL 24h, TEX_MATCH_DETAIL_TTL 6h, calendar 24h.
- **Multi-bookmakers match-detail** : parsing des 4 markets (home/away, O/U, AH, CS) avec best-odds highlighting.

---

## Recommandations prioritaires

### Sprint 1 (bloquants — corriger avant prod)
1. **H3** : migrer les onclick inline vers `data-*` + addEventListener (élimine la classe de bugs XSS/quote).
2. **H1** : ajouter `loadTexTournamentsToday()` dans `tn2SwitchTab('matchs')`.
3. **H2** : parser `start_date` côté client avec regex `(\d+)\.\s*(\d+)\.?\s*(\d{4})?` (même logique que serveur).
4. **H4** : corriger la détection `won` et rendre la pastille V/D dans le L5.

### Sprint 2 (qualité UX)
5. **M2** : reset recherche au changement de tour.
6. **M4** : tri "Heure" par minutes calculées.
7. **M5** : debounce recherche 250ms.
8. **M6** : cleanup timer au changement d'onglet.
9. **M1** : renommer en-tête "Form" → "Elo".
10. **M3** : colspan 6 → 5.

### Sprint 3 (polish)
11. **M7-M11** + tous les LOW.

---

## Annexes — Reproductions validées

### Validation Node.js (H2 + H3 + M4)
```
Test new Date("15.05.2026"): Invalid Date         ← H2 confirmé
Test isValid: false
_tnEsc("Christopher O'Connell"): Christopher O&#39;Connell
HTML décodé dans onclick JS: openPlayerProfile('slug','Christopher O'Connell','Hard')
JS ERROR: missing ) after argument list           ← H3 confirmé
localeCompare 2:00 vs 12:00: 1                    ← M4 confirmé (devrait être -1)
localeCompare 02:00 vs 12:00: -1                  ← M4 confirmé (zero-pad OK)
```

### Validation _upsetScore sans drift
```
upsetScore (no drift): 50   ← OK, pas de crash
```

### Validation logique L5 "won"
```
isP1: true
won: false                   ← BUG: /won/i testé sur "finished" → toujours false
won utilisé dans HTML? non   ← BUG: variable calculée mais jamais rendue
```

### Validation colspan
```
Header cols: 5
Tour header colspan: 6
mismatch: true               ← M3 confirmé
```

---

*Rapport généré par audit statique + validation runtime Node.js. Aucune modification de code effectuée — rapport de diagnostic seul.*
