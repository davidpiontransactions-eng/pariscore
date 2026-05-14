# Tennis Explorer — Scraping Proposal pour Onglet Tennis PariScore

> Document : analyse + proposition d'intégration  
> Source : https://www.tennisexplorer.com/  
> Date : 2026-05-15  
> Auteur : Agent (PariScore v10.8+)  
> Statut : **MVP A+B IMPLÉMENTÉ v10.9** (use cases C+D reportés).

---

## 1. Contexte

PariScore onglet Tennis dispose actuellement :
- **MatchStat (RapidAPI)** : fixtures ATP/WTA/ITF + H2H + rankings (memory `routing-multi-providers-v10`)
- **Sackmann CSV (CC BY-NC-SA)** : matchs historiques pour Elo (T4)
- **BSD Tennis** : odds primaires si BSD couvre tournoi
- **The Odds API** : odds h2h enrichissement
- **Tennis Abstract (scrape, v10.8)** : forecasts par tour (Rome 2026 ATP+WTA)

**Tennis Explorer** apporterait :
- Odds historiques (open + current) sur **20+ bookmakers** affichés par match
- Tableau matchs du jour (aujourd'hui + J+1 à J+7) toutes tournées en une page
- H2H instantané (lien `/match-detail/`)
- Player profiles (rank current/highest singles + doubles, hand, DOB, country)
- Liens cross-référencés vers stats avancées

---

## 2. Analyse de site

### 2.1 Robots / ToS

```
User-agent: *
Disallow: /redirect/
Disallow: /terms-of-use/
Disallow: /contact/
```

Aucune route data bloquée. Sitemap public. Posture conforme — usage non-commercial OK.

### 2.2 Structure URL

| Endpoint | Contenu | Pagination |
|----------|---------|------------|
| `/matches/?type=atp-single` | Matchs ATP du jour | date filter `?year=YYYY&month=MM&day=DD` |
| `/matches/?type=wta-single` | Matchs WTA du jour | idem |
| `/matches/?type=atp-double` | Doubles ATP | idem |
| `/matches/?type=wta-double` | Doubles WTA | idem |
| `/next/` | Matchs J+1 → J+7 (programme) | aucune |
| `/results/` | Résultats finis (date) | idem matches |
| `/picks/` | Pages homepage avec picks | aucune |
| `/match-detail/?id=N` | Détail match (H2H, odds full, sets) | aucune |
| `/player/<slug>/` | Profile joueur | aucune |
| `/list-players/` | Directory joueurs A-Z | letter param |

### 2.3 Structure HTML — page matches

Chaque match = 2 `<tr>` row jumelées (player1 row + player2 row) :

```html
<tr id="s<N>" class="one fRow bott">
  <td class="first time" rowspan="2">02:00</td>
  <td class="t-name"><a href="/player/karnani/">Karnani A.</a></td>
  <td class="result">&nbsp;</td>
  <td class="score">&nbsp;</td>  <!-- set 1 -->
  <td class="score">&nbsp;</td>  <!-- set 2 -->
  <td class="score">&nbsp;</td>  <!-- set 3 -->
  <td class="score">&nbsp;</td>  <!-- set 4 (5-set only) -->
  <td class="score">&nbsp;</td>  <!-- set 5 -->
  <td class="h2h">-</td>           <!-- H2H link/score -->
  <td class="coursew" rowspan="2">1.45</td>  <!-- opening odds player1 -->
  <td class="course" rowspan="2">1.31</td>   <!-- current odds player1 -->
  <td rowspan="2"><a href="/match-detail/?id=3202562">info</a></td>
</tr>
<tr id="s<N>b" class="one">
  <td class="t-name"><a href="/player/palomar-castello/">Palomar Castello H.</a></td>
  <td class="result">&nbsp;</td>
  ... (scores same structure)
  <td class="h2h">-</td>
</tr>
```

**Données extractibles par match :**
- Heure de début (HH:MM, UTC+1 par défaut, cookie `my_timezone` configure offset)
- Player 1 + slug + Player 2 + slug
- Score par set (5 sets max)
- H2H token (cliquable → match-detail)
- **Open odds** (`coursew`) + **Current odds** (`course`) — colonne par player
- match_detail_id

### 2.4 Structure HTML — player profile

```html
<table class="plDetail">
  <tbody>
    <tr>
      <td>Sinner Martin</td>
      <td>Country: Germany</td>
      <td>Age: 58 (7. 2. 1968)</td>
      <td>Current/Highest rank - singles: - / 114.</td>
      <td>Current/Highest rank - doubles: - / 445.</td>
      <td>Sex: man</td>
      <td>Plays: right</td>
    </tr>
  </tbody>
</table>
```

**Données extractibles par joueur :**
- Nom complet
- Country
- DOB (parsing FR `D. M. YYYY`)
- Rank singles current + highest
- Rank doubles current + highest
- Sex (man/woman)
- Plays (right/left)

### 2.5 Performance

| Page | Taille HTML |
|------|-------------|
| `/matches/` | ~280 KB |
| `/picks/` | ~560 KB |
| `/player/<slug>/` | ~95-110 KB |
| Match detail | non testé |

Acceptable. Pas de JS-rendering nécessaire (HTML statique server-rendered).

### 2.6 Rate limiting

Pas de header rate-limit documenté. Cookies session générés (`my_cookie_id_2`, `my_cookie_hash_2`) — anti-bot léger.  
Recommandation : **1 req/sec max**, User-Agent identifiable, respect du cache 6h+ pour minimiser traffic.

---

## 3. Use Cases pour PariScore Tennis tab

### 3.1 Use Case A — Comparaison odds drift (`coursew` vs `course`)

**Valeur** : détecter les chutes/montées de cote = sentiment marché.  
**UI** : nouvelle colonne "Δ%" dans tableau Tennis Value Bets :
- Δ > +10% → 🔻 cote chute (favori se dégage)
- Δ < -10% → 🔺 cote monte (outsider tendance)

**Impact pipeline** : enrichit `tennis-vb-section` existante.

### 3.2 Use Case B — Player profile cards

**Valeur** : afficher rank current + highest + DOB + hand au survol/clic player.  
**UI** : tooltip ou modal sur clic player name dans tableau.  
**Impact** : nouveau composant `_renderPlayerCard()` frontend.

### 3.3 Use Case C — Schedule J+1 → J+7

**Valeur** : preview matchs à venir 7 jours, anticipation paris.  
**UI** : nouveau filtre date dans #page-tennis (Aujourd'hui / Demain / J+2 → J+7).  
**Impact** : 7 requêtes / 24h = peu coûteux avec cache 6h.

### 3.4 Use Case D — Tournament context

**Valeur** : grouping par tournoi détecté dans page matches (header rows).  
**UI** : group headers déjà présents foot scope, réutilisable tennis.  
**Impact** : parser doit détecter `<h2>` ou `<tr class="head">` de section.

---

## 4. Proposition scraping technique

### 4.1 Architecture proposée

```
┌─────────────────────────────────────────────────────────┐
│  Tennis Explorer scraper (server-side, zero-dep)         │
│                                                          │
│  fetchTexFixtures(date, tour) ─┐                         │
│  fetchTexResults(date, tour)   ├─→ parseMatchRows(html)  │
│  fetchTexNext()                │   → {time, players,     │
│  fetchTexPlayer(slug)          │      odds_open,         │
│                                │      odds_current, h2h} │
│                                │                         │
│  Cache module-scope Map        │   parsePlayerProfile()  │
│  TTL : matches 30min           │   → {rank, dob, hand}   │
│        player profile 24h      │                         │
│                                │                         │
└──────────────┬──────────────────┴────────────────────────┘
               │
       Routes /api/v1/tennis/tex/...
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend : #page-tennis enrichissement                  │
│  - Nouvelle colonne Δ% dans tennis-vb table              │
│  - Player profile modal au clic name                     │
│  - Filtre date J+1 → J+7                                 │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Endpoints API proposés

| Route | Méthode | Params | Cache | Description |
|-------|---------|--------|-------|-------------|
| `/api/v1/tennis/tex/matches` | GET | `?date=YYYY-MM-DD&tour=ATP\|WTA` | 30min | Tableau du jour |
| `/api/v1/tennis/tex/next` | GET | `?days=7` | 1h | Programme J+1 → J+7 |
| `/api/v1/tennis/tex/results` | GET | `?date=YYYY-MM-DD&tour=ATP\|WTA` | 12h | Résultats |
| `/api/v1/tennis/tex/match/:id` | GET | — | 6h | Détail match (H2H + odds full) |
| `/api/v1/tennis/tex/player/:slug` | GET | — | 24h | Profile joueur |

### 4.3 Parser core — pseudo-code

```js
function parseTexMatches(html) {
  const out = [];
  // Match rows come in pairs: s<N> + s<N>b
  const trRe = /<tr id="s(\d+)"[^>]*class="(?:one|two)[^"]*"[^>]*>([\s\S]*?)<\/tr>\s*<tr id="s\1b"[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const [_, idx, row1, row2] = m;
    const time = (row1.match(/class="first time"[^>]*>([^<]+)</) || [])[1];
    const p1Name = (row1.match(/class="t-name"><a href="\/player\/([^"]+)\/?">([^<]+)<\/a>/) || []);
    const p2Name = (row2.match(/class="t-name"><a href="\/player\/([^"]+)\/?">([^<]+)<\/a>/) || []);
    const scoresP1 = [...row1.matchAll(/class="score"[^>]*>([^<]*)</g)].map(x => x[1].replace(/&nbsp;/g, '').trim());
    const scoresP2 = [...row2.matchAll(/class="score"[^>]*>([^<]*)</g)].map(x => x[1].replace(/&nbsp;/g, '').trim());
    const oddsOpen = [...row1.matchAll(/class="coursew"[^>]*>([^<]+)</g)].map(x => parseFloat(x[1]));
    const oddsCurr = [...row1.matchAll(/class="course"[^>]*>([^<]+)</g)].map(x => parseFloat(x[1]));
    const matchId = (row1.match(/href="\/match-detail\/\?id=(\d+)"/) || [])[1];
    out.push({
      id: matchId ? `tex_${matchId}` : `tex_idx_${idx}`,
      time, // HH:MM in Tennis Explorer TZ (configurable via cookie)
      player1: { slug: p1Name[1], name: p1Name[2], scores: scoresP1 },
      player2: { slug: p2Name[1], name: p2Name[2], scores: scoresP2 },
      odds_open: oddsOpen.length === 2 ? { p1: oddsOpen[0], p2: oddsOpen[1] } : null,
      odds_current: oddsCurr.length === 2 ? { p1: oddsCurr[0], p2: oddsCurr[1] } : null,
      odds_drift_pct: (oddsOpen[0] && oddsCurr[0]) ? ((oddsCurr[0] - oddsOpen[0]) / oddsOpen[0] * 100) : null,
    });
  }
  return out;
}
```

### 4.4 Cron schedule

| Job | Fréquence | Heure (Europe/Paris) |
|-----|-----------|----------------------|
| Refresh matches du jour (ATP+WTA single) | toutes les 30 min | continu |
| Refresh programme J+1 → J+7 | quotidien | 06:00 |
| Refresh results J-1 | quotidien | 03:00 |
| Refresh player profiles (Top 100) | hebdo | dimanche 04:00 |

### 4.5 Gestion timezone

Site Tennis Explorer affiche heure selon cookie `my_timezone` (défaut +1 UTC).  
Solution : **toujours envoyer cookie `my_timezone=0`** pour récupérer en UTC → convertir Europe/Paris côté serveur via `fmtKickoffTime` (helper v10.7).

```js
const res = await httpsGet(url, { 'Cookie': 'my_timezone=0', 'User-Agent': 'Mozilla/5.0 (PariScore)' });
```

### 4.6 Anti-poisoning

- Cache key versioning v1 → v2 si parser breaking change (cf memory `tv-channel-fallback-pattern`)
- `apiCacheSet(key, data, source, ttlMs)` 4ème arg honoré (cf memory)
- Failure mode : log warning + cache TTL court (5min négatif) pour éviter retry-storm

### 4.7 Sécurité

| Risque | Mitigation |
|--------|-----------|
| HTML structure change | Parser tolérant null + tests regression sur fixtures HTML sauvegardés |
| IP ban anti-bot | UA identifiable PariScore + 1 req/sec max + retry exponentiel |
| Cookie session expire | Re-fetch session si HTTP 403 ou redirect login |
| Charset / encoding | Forcer `Accept-Charset: utf-8` + buffer Buffer if encoding mismatch |

### 4.8 Estimation effort

| Phase | Effort |
|-------|--------|
| Backend scraper + parser + cache | 3-4h |
| Routes API + tests fixtures | 2h |
| Frontend column Δ% (use case A) | 1.5h |
| Frontend player modal (use case B) | 2h |
| Frontend schedule J+1→J+7 (use case C) | 2h |
| Documentation + tests boundary | 1h |
| **Total MVP (A+B uniquement)** | **8h** |
| **Total full (A+B+C+D)** | **12h** |

---

## 5. Risques et limites

1. **Licence** : Tennis Explorer n'expose pas de licence explicite. Usage **non-commercial** acceptable per robots.txt permissif. Pour SaaS payant PariScore Pro → besoin contact direct ou licence dédiée.
2. **Stabilité parsing** : site change rarement (HTML same structure pluri-annuelle observée sur forums). Risque faible mais non-nul. Wrapper try/catch + log alarmant si parser retourne `[]`.
3. **Doublon donnée** : MatchStat + BSD + Tennis Explorer peuvent retourner même match avec slugs différents. Solution : dedup via `(player1_normName, player2_normName, date_local)` + score-level cross-check.
4. **Throughput** : 1 req/sec → 30 min cron refresh OK. Pour live (< 5 min refresh) → besoin upgrade quota ou cache TTL plus court risqué.

---

## 6. Recommandation finale

**GO** sur use cases A (odds drift Δ%) + B (player profile modal) en MVP.  
**Reporter** use case C (programme J+1→J+7) après MatchStat évalué — risque doublon.  
**Skip** use case D (tournament grouping) — UI déjà couverte par filtre tournoi MatchStat.

---

## 7. Implémentation v10.9 (livré 2026-05-15)

### Backend (server.js)
- `_texFetchHtml(path)` — wrapper httpsGet + cookie `my_timezone=0` + UA `Mozilla/5.0 (PariScore/2.0)`
- `_texParseMatchesPage(html)` — paires `<tr id="s<N>">` + `<tr id="s<N>b">`, extract player1/2, scores, open/current odds (p1 only sur page /matches/), match_id, drift %
- `_texParsePlayerPage(html, slug)` — extract name, country, DOB ISO, height/weight, ranks singles+doubles (current/highest), sex, plays
- `fetchTexMatches(tour, dateISO)` — cache module-scope 30min
- `fetchTexPlayer(slug)` — cache module-scope 24h
- Routes :
  - `GET /api/v1/tennis/tex/matches?tour=atp|wta&date=YYYY-MM-DD`
  - `GET /api/v1/tennis/tex/player?slug=<slug>`
- Cron quotidien `_runTexDailyRefresh()` à 06:00 Europe/Paris (ATP + WTA single)

### Frontend (pariscore.html)
- Section `#tennis-tex-section` dans `#page-tennis` (après `#tennis-abstract-section`)
- Toggle ATP/WTA, button Actualiser, status badge (count + drift count + timestamp)
- Table cols : Heure UTC, Joueur 1 (clickable → modal), vs, Joueur 2 (clickable), Open, Current, Δ% (color-coded ▲ red ↑ / ▼ green ↓), info link Tennis Explorer
- Tri par ampleur drift abs desc (gros mouvements en haut)
- Badge "FAV" si current odd < 2
- Modal `#tex-player-modal` overlay full-screen avec card joueur
- Auto-load via `showPage('tennis')`

### Limite réelle découverte vs proposal initial
- Page `/matches/` affiche odds pour **player1 seul** (favori display), pas les deux. Pour player2 → besoin scrape `/match-detail/?id=N` (pas implémenté MVP).
- Drift % calculé pour player1 uniquement (suffisant pour signal sentiment marché).

### Echantillon data live (2026-05-15)
- 15 matchs ATP / 9 avec drift
- Plus grosses chutes favoris : Rengel Sierra T. 1.05→6.75 (+542%), Zamora N. 1.07→6.00 (+460%)
- Plus grosses montées : Pudney T. 9.00→1.01 (-88.8%), Berger B. 8.50→1.03 (-87.9%)
- Player profile Svitolina : Ukraine, 31 ans, 174cm/60kg, rank 10 (haut 3), gauche/droite, woman

---

*Fin du document.*
