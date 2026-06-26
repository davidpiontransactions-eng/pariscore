# Audit Complet — Sous-onglet MATCHS (Tennis)

> **Date** : 2026-06-25
> **Auditeurs** : Senior Reviewer, QA Tester Senior, Directeur Design UI
> **Périmètre** : `pariscore.js` L5259-5754, `server.js` L29593-29906 + routes L41686-41925, `pariscore.html` L15752-15792
> **Verdict global** : Fonctionnel mais **12 bugs HIGH** (5 code + 4 QA + 3 design), **28 MED**, **31 LOW**

---

## Synthèse exécutive

| Domaine | HIGH | MED | LOW | Score |
|---|---|---|---|---|
| Code/Architecture | 5 | 12 | 20 | 5/10 |
| QA Fonctionnel | 4 | 11 | 8 | 6/10 |
| Design UI | 3 | 5 | 3 | 6/10 |
| **Total unique** | **12** | **28** | **31** | **5.5/10** |

**Recommandation** : Sprint dédié P0 (12 bugs HIGH, ~6h) avant toute nouvelle feature.

---

## Bugs HIGH (12) — À traiter en priorité absolue

### H1 — XSS / crash JS : noms avec apostrophe (Reviewer + QA)
**Fichiers** : `pariscore.js` L5558-5559
**Impact** : ~5% des clics joueurs silencieusement cassés (O'Connell, Dell'Acqua, etc.)
**Fix** : Migration onclick → `data-*` + event delegation (`addEventListener`)

### H2 — `delta || 999` : match_rating inversé pour matchs équilibrés (Reviewer)
**Fichier** : `server.js` L29870
**Impact** : `compScore = 0` au lieu de `100` quand delta=0 → rating faux pour 100% des matchs serrés
**Fix** : `var eloDelta = (m.elo_surface && m.elo_surface.delta != null) ? m.elo_surface.delta : 999;`

### H3 — Lookup Elo homonymes (Reviewer)
**Fichier** : `server.js` L29836-29840
**Impact** : `k.includes('lee')` matche n'importe quel "Lee" → Elo faux sur ~10-20% des matchs
**Fix** : Matcher par slug TE au lieu de `lastName.includes()`, ou exiger 2+ mots matchés

### H4 — Race condition `texMatchsSetTour` (Reviewer)
**Fichier** : `pariscore.js` L5366-5375
**Impact** : Clics ATP→WTA→ATP rapides → matchs WTA affichés sous label ATP
**Fix** : Token de génération (`_texMatchsReqId++`) ou `AbortController`

### H5 — Auto-refresh meurt à la 1ère erreur (Reviewer)
**Fichier** : `pariscore.js` L5449-5452
**Impact** : `setInterval` posé seulement dans `_renderTexMatchs` (chemin succès) → F5 manuel requis
**Fix** : Poser le timer dans `finally` ou replanifier dans `catch` avec backoff 60s

### H6 — `loadTexTournamentsToday()` jamais appelée à l'ouverture (QA)
**Fichier** : `pariscore.html` L16354 (case 'matchs' de `tn2SwitchTab`)
**Impact** : Section "Tournois du jour" vide tant que l'utilisateur ne bascule pas ATP↔WTA
**Fix** : Ajouter `loadTexTournamentsToday()` dans le case 'matchs' de `tn2SwitchTab`

### H7 — Filtre semaine cassé : `new Date("15.05.2026")` = Invalid Date (QA)
**Fichier** : `pariscore.js` L5391-5397
**Impact** : Fallback `list.slice(0, 8)` affiche les tournois de janvier en juin
**Fix** : Parser date TE (`DD.MM.YYYY` → split + `new Date(year, month-1, day)`)

### H8 — L5 "Derniers matchs" : `won` toujours faux (Reviewer + QA)
**Fichier** : `pariscore.js` L5737
**Impact** : `/won/i.test("finished")` = toujours false + `won` jamais inséré dans le HTML
**Fix** : Exposer `won: true|false` côté serveur depuis BSD `m.winner`

### H9 — En-tête "Form" mais contenu = Elo (Design)
**Fichier** : `pariscore.js` L5570 vs L5561
**Impact** : Confusion sémantique — l'utilisateur lit "Form" et voit des nombres Elo
**Fix** : Renommer en "Index" ou "Rating" (éviter "Elo" = secret de fabrication)

### H10 — Cotes P1 ET P2 affichées en vert (Design)
**Fichier** : `pariscore.js` L5550
**Impact** : Vert = value/favori dans la charte → afficher les 2 en vert casse la sémantique
**Fix** : Couleur neutre par défaut, vert uniquement si `value_score > 0`

### H11 — Popups sans accessibilité (Design)
**Fichiers** : `pariscore.js` L5585-5594, L5648-5657
**Impact** : Pas de `role="dialog"`, pas d'Escape, pas de focus trap, bouton ✕ sans `aria-label`
**Fix** : Ajouter `role/aria-modal/aria-label` + écouteur Escape + focus management

### H12 — `isP1` toujours vrai si `r.name` vide (Reviewer)
**Fichier** : `pariscore.js` L5733
**Impact** : `''.includes('')` = true → mauvais adversaire affiché dans L5
**Fix** : `var lastWord = ...filter(Boolean).pop() || null; if (!lastWord) return;`

---

## Bugs MED (28) — À traiter dans le sprint suivant

### Code/Architecture (12)
| # | Bug | Fichier | Fix |
|---|---|---|---|
| M1 | Headers tournoi cassés hors tri "time" | `pariscore.js` L5512 | Désactiver headers hors tri time OU regrouper par tournoi |
| M2 | `won` L5 logique fausse (cf H8) | `pariscore.js` L5737 | Exposer `won` côté serveur |
| M3 | `isP1` vide (cf H12) | `pariscore.js` L5733 | Skip si pas de lastWord |
| M4 | Parser HTML regex fragile | `server.js` L29622 | Ajouter télémétrie + envisager cheerio |
| M5 | Elo profil `LIKE '%name%'` homonymes | `server.js` L41885 | Match exact + filtre tour/surface |
| M6 | Map Elo ne garde qu'une surface | `server.js` L29817 | `Map<name, Map<surface, elo>>` |
| M7 | Division par zéro drift | `server.js` L29667 | Clamp `Math.max(1.01, oddsOpen[0])` |
| M8 | HTML entities non décodés | `server.js` L29654 | `decodeHtmlEntities()` |
| M9 | Filtre semaine UTC vs local | `pariscore.js` L5391 | `setHours(0,0,0,0)` + lundi-dimanche |
| M10 | Caches non bornés (LRU) | `server.js` L29584 | LRU eviction |
| M11 | `oddsOpen[0]` nullsafe | `server.js` L29667 | OK mais lisibilité faible |
| M12 | `setInterval` dans `_renderTexMatchs` | `pariscore.js` L5577 | Poser dans `loadTexMatchs` uniquement |

### QA Fonctionnel (11)
| # | Bug | Scénario | Fix |
|---|---|---|---|
| Q1 | Recherche persiste au changement de tour | ATP "Sinner" → WTA = 0 résultats | Clear `_texMatchsSearchQuery` dans `texMatchsSetTour` |
| Q2 | Tri "Heure" `localeCompare` cassé si heures non zero-padded | `'2:00' > '12:00'` | Zero-pad les heures |
| Q3 | Pas de debounce recherche | Lag sur 50+ matchs | `debounce(200ms)` |
| Q4 | Timer 5min jamais nettoyé au changement d'onglet | Fetch inutiles en arrière-plan | `stopTennisTop10()` étendu |
| Q5 | Auto-refresh perd le scroll et la sélection | Refresh 5min → retour en haut | Comparer hash payload avant re-render |
| Q6 | Popup match-detail : pas de loading state propre | Overlay vide pendant 2s | Afficher spinner |
| Q7 | Popup fiche joueur : `rank_singles.current = 0` affiche "—" | Joueur non classé | `!= null ?` au lieu de `||` |
| Q8 | Toggle ATP/WTA : `loadTexTournamentsToday` appelé mais panel caché | Gaspillage API | Vérifier `display` avant fetch |
| Q9 | Section tournois fermée par défaut | Utilisateur ne sait pas qu'il y a des tournois | Ouvrir par défaut ou afficher count |
| Q10 | Fallback `list.slice(0, 8)` montre tournois futurs | Label "Tournois du jour" trompeur | Renommer en "À venir" |
| Q11 | Status bar expose clé technique `_texMatchsFilter` | "elo_delta" brut | Mapper vers libellés FR |

### Design UI (5)
| # | Bug | Fix |
|---|---|---|
| D1 | Border-color vert sur `.tn2-mode-btn.active` | `rgba(0,119,255,0.25)` |
| D2 | Boutons filtres contournent design system `.tn2-f-btn` | Migrer vers classe existante |
| D3 | `outline:none` sur recherche sans focus ring alternatif | `:focus-visible { outline: 2px solid var(--tn2-accent) }` |
| D4 | Couleurs hors-charte (#FFD700, #fbbf24, #ce93d8) | Utiliser tokens CSS |
| D5 | Toggle tournois `+`/`-` texte — UX faible | Button + chevron SVG + `aria-expanded` |

---

## Bugs LOW (31) — Polish

### Code (20)
| # | Bug | Fix |
|---|---|---|
| L1 | `t.singles_draw \|\| '—') + 'S'` affiche `—S` | `t.singles_draw ? t.singles_draw + 'S' : '—'` |
| L2 | `tourHeaders.find()` O(n²) | Pré-build `Map<name, slug>` |
| L3 | Regex prestige `paris` matche `Paris Challenger` | Liste exhaustive ou matcher sur slug |
| L4 | Magic numbers non calibrés (`*0.5`, `*2`, `*3`) | Extraire dans config + tests |
| L5 | Fallback `list.slice(0, 8)` sous label "du jour" | Label "À venir" |
| L6 | `innerHTML.includes('tn-t10-loading')` fragile | Variable d'état |
| L7 | `if (rec)` truthy pour `{}` → `undefined-undefined` | `rec.wins != null` |
| L8 | Précédence `rec.wins + rec.losses > 0` | Parenthèses |
| L9 | `tex_match_id` pas défensif côté client | `Number.isFinite()` check |
| L10 | `dateISO.slice(0, 4)` sans validation | Déjà validé par route, OK |
| L11 | Cache retourne vieille date si `today` | Comparer `cached.data.date` |
| L12 | `rank_singles.current = 0` affiche "—" | `!= null ?` |
| L13 | Modaux sans Escape | `addEventListener('keydown', ...)` |
| L14 | Recherche pas de debounce | `debounce(200ms)` |
| L15 | TTL cache 30min pour matchs du jour | 5min pour date du jour |
| L16 | `loadTexTournamentsToday` si panel caché | Vérifier `display` |
| L17 | Prize money fallback double-compte | Exclure ligne "Career" |
| L18 | Précision `value_score` vs `match_rating` incohérente | Uniformiser |
| L19 | `lastTournament` jamais reset entre renders | OK (local) mais surveiller |
| L20 | `tourHeadRe.lastIndex` si remonté module-level | Garder local |

### QA (8)
| # | Bug | Fix |
|---|---|---|
| L21 | Popups pas de focus management | Focus trap |
| L22 | Photos `ui-avatars.com` dépendance externe | SVG data-URI local |
| L23 | `onerror` manquant sur photos | Fallback initiales |
| L24 | Responsive popup padding trop généreux mobile | `@media 480px { padding: 16px }` |
| L25 | Section tournois pas de count dans le header | Afficher `(8)` |
| L26 | Filtre "Elite" vide si pas d'Elo en DB | Message "Données indisponibles" |
| L27 | Recherche avec caractères regex spéciaux | Échapper ou utiliser `includes` |
| L28 | Auto-refresh sans indicateur visuel | Badge "MAJ il y a Xs" |

### Design (3)
| # | Bug | Fix |
|---|---|---|
| L29 | Tableau non responsive <768px | `@media` → cards empilées |
| L30 | `ui-avatars` sans `onerror` fallback | SVG data-URI local |
| L31 | Densité trop chargée (7 filtres + recherche + 5 colonnes) | Réduire ou grouper |

---

## Plan d'action priorisé

### Sprint 1 — P0 (12 bugs HIGH, ~6h)

| # | Bug | Effort | Équipe |
|---|---|---|---|
| 1 | H1 — onclick → event delegation | 30 min | JS |
| 2 | H2 — `delta \|\| 999` → `!= null` | 5 min | Backend |
| 3 | H3 — Elo lookup par slug | 1h | Backend |
| 4 | H4 — Race condition reqId | 20 min | JS |
| 5 | H5 — Auto-refresh `finally` | 10 min | JS |
| 6 | H6 — `loadTexTournamentsToday` dans tn2SwitchTab | 5 min | HTML |
| 7 | H7 — Parser date TE | 15 min | JS |
| 8 | H8 — `won` L5 côté serveur | 30 min | Backend |
| 9 | H9 — Header "Form" → "Index" | 1 min | JS |
| 10 | H10 — Cotes neutres + vert si value | 10 min | JS |
| 11 | H11 — Popups a11y (role/aria/Escape) | 30 min | JS |
| 12 | H12 — `isP1` vide → skip | 10 min | JS |

### Sprint 2 — P1 (28 bugs MED, ~8h)

Voir détail ci-dessus — traiter par bloc :
- Code : M1-M12 (~4h)
- QA : Q1-Q11 (~3h)
- Design : D1-D5 (~1h)

### Sprint 3 — P2 (31 bugs LOW, ~4h rolling)

Polish et robustesse — traiter progressivement.

---

## Points forts à conserver

1. Architecture fetch/render séparée (`_texMatchsRawData` cache pour re-tri sans refetch)
2. 7 filtres intelligents avec badges visuels dédiés
3. Match rating composite pondéré (5 critères, score 0-100, 1-5 étoiles)
4. Caching serveur multi-niveau (30min / 24h / 6h)
5. Retry + `_trackCatch` sur `_texFetchHtml`
6. Secret de fabrication respecté (aucune référence externe visible)
7. Distinction best-odd en vert dans le popup multi-bookmakers
8. Hover state cohérent `rgba(0,119,255,0.06)` sur les rows
9. Couleurs des surfaces sémantiques (Clay/Hard/Grass)
10. Tous les edge cases ont un fallback visuel propre

---

## Recommandations stratégiques

1. **Étendre la charte designui.md** avec couleurs sémantiques (gold/amber/purple/surfaces)
2. **Créer une classe CSS `.tex-filter-bar`** dédiée (au lieu de styles inline)
3. **Adopter un composant modal réutilisable** pour les 2 popups
4. **Concevoir une vue card mobile** réutilisable entre MATCHS / TOP / LIVE
5. **Migration parser TE** vers `cheerio` ou `node-html-parser` pour robustesse
6. **Pré-indexer `tennis_elo.player_slug`** pour lookup exact par slug TE
7. **Tests unitaires** sur `match_rating`, `_upsetScore`, `_sortTexMatchs`

---

*Ce rapport est destiné à l'équipe ingénierie pour debug et amélioration du sous-onglet MATCHS.*
