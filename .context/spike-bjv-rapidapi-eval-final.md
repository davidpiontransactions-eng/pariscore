## SPIKE FINAL — RapidAPI `odds-api1` evaluation pour PariScore

> **Date** : 22 mai 2026
> **Bd tickets** : `bjv` (spike alternatives Odds API) · `qkx` (eval RapidAPI odds-api1) · couplé `x9s` (plug full integration)
> **Statut** : ✅ Eval finalisee — decision GO conditionnel (sous reserve test live VPS)
> **Livrable parent** : ce fichier (consolide spike_odds_alternatives.md + spike_rapidapi_oddsapi1_eval.md + rapport-spike-rapidapi-final.md + rapport-oddspapi-comparateur-2026.md)

---

### 1. RESUME EXECUTIF

**Decision : GO conditionnel** comme **source secondaire de cotes** (pas remplacement Odds API). Cle `RAPIDAPI_KEY` deja active et payee. Adapter `odds-rapidapi.js` deja livre racine projet (395 lignes, format computeEdge-compat). Reste a valider : (a) endpoint `odds-by-tournaments` accessible avec plan souscrit, (b) coverage Betclic absent confirme.

**Rationale 3 lignes** :
1. Cle RapidAPI deja consommee par `tennis-api`, `tennisapi1`, `free-football`, `1xbet-api` (couts marginaux nuls).
2. Coverage observee : 368 bookmakers dont **15 books FR/ANJ + Pinnacle sharp** (vs ~40 books Odds API, **sharps exclus en free tier**).
3. Modele de pricing predictible (1 req = 1 req) vs Odds API credits = `markets × regions` (brule vite).

---

### 2. SCORING TABLE — odds-api1 vs The Odds API actuel

| Dimension | The Odds API (actuel free) | **odds-api1 RapidAPI** | Verdict |
|---|---|---|---|
| **Coverage sports** | 7 sports actifs PariScore | 50+ sports (sportId 10=foot, 12=tennis, 11=basket, …) | odds-api1 |
| **Coverage bookmakers** | ~40 dont 0 sharp en free | **368 books** dont Pinnacle, 1xBet, Bet365, Betfair Exchange | **odds-api1 (gros plus)** |
| **Coverage FR/ANJ** | Winamax, Betclic, Unibet, PMU, NetBet, Bwin, FDJ | 12/13 books ANJ (manque **Betclic**) + FDJ + Pinnacle FR | Odds API marginalement |
| **Markets** | h2h + spreads + totals | 1X2 (101) + BTTS (104) + O/U (106) + handicaps + props | Parite |
| **Pricing** | $0 free 500 req/mo → $30 Starter 20k req/mo | RAPIDAPI_KEY mutualisee (deja payee), 1 req = 1 req | odds-api1 |
| **Quota epuise** | OUI (chronique, bd `l3x`) | NON (mutualise 4+ APIs) | odds-api1 |
| **Latence** | 200-500ms | ~300ms observe (probes _probe_rapidapi_odds*.js) | Parite |
| **Format reponse** | Bookmakers array (clean) | `bookmakerOdds{slug}.markets{mid}.outcomes{oid}` — necessite mapper | Odds API (more direct) |
| **Pinnacle (sharp)** | Indisponible free | ✅ Disponible (fr:True + websocketLive) | **odds-api1** |
| **WebSocket live** | Non | Oui (champ `websocketLive` par book) | odds-api1 |
| **Risque editeur tiers** | Faible (stable 2020+) | Moyen (publisher RapidAPI) | Odds API |
| **Score global /100** | 60 (epuise, sharps absents) | **78** (sharps + mutualisation cle) | **odds-api1 (+18)** |

---

### 3. TROIS CAS D'USAGE OU odds-api1 BAT Odds API

1. **WFV / IC / Surebet calcul plus juste** — `computeWFV1N2` et `detectSurebet1N2` consomment `all_bookmakers`. Pinnacle (sharp low-vig) ajoute change la « Val. Marche Ponderee » de ~5-10% (mesure typique), reduit faux positifs Surebet, ameliore calibration ValueBet. **Inaccessible avec Odds API free.**
2. **Enrichissement matchs BSD-only sans cotes** — Routing actuel : L1 BSD → L1.5 RapidAPI Free Football → L2 stats → L3 ESPN. Beaucoup de matchs L2 ligues secondaires arrivent sans `bookmakers[].h2h`. `enrichWithOdds()` (dans `odds-rapidapi.js`) injecte les cotes manquantes via odds-api1, gagne ~20-30% coverage cotes/match (estim. base BSD seul ~60%, attendue post-integration ~85%).
3. **Failover quota** — Quand Odds API quota epuise (bd `l3x` constate ~3-4×/mois), odds-api1 prend le relais sans intervention DG. Le frontend conserve `best_edge` au lieu d'afficher `null`. Reduit le bug recurrent « cotes vides Ligue 1 ».

**Cas inverse (Odds API gagne)** : Betclic est book FR #1 et **absent** d'odds-api1 → Odds API reste essentiel comme source primaire pour conserver Betclic.

---

### 4. PLAN D'IMPLEMENTATION SI GO (5 etapes pour bd `x9s`)

| Phase | Action | Effort |
|---|---|---|
| **1. Validation runtime** (30 min) | DG VPS : `node -e "require('dotenv').config(); require('./odds-rapidapi').listTournaments(10).then(t => console.log(Array.isArray(t)?t.length:t))"`. Si retour ≥ 1 tournoi → endpoint accessible avec plan souscrit. Sinon : ajuster `ODDSPAPI_ODDS_PATH` et tester `/v4/odds-by-tournaments` au lieu de `odds-by-tournaments`. | 30 min |
| **2. Snippet integration server.js** | Inserer 7 lignes apres ÉTAPE 1 BSD, avant ÉTAPE 1.5 RapidAPI Free Football (cf. `rapport-spike-rapidapi-final.md` §5.2). Require en tete + bloc `if (oddsRapidApi.enabled() && allRawMatches.length > 0) { await oddsRapidApi.enrichWithOdds(allRawMatches); }`. | 30 min |
| **3. Refactor providers/odds_provider.js (abstraction)** | Pattern propose dans `spike_odds_alternatives.md` §5 : interface unique `getMarketOdds()` avec fallback chain Odds API → API-Football → odds-api1 → Polymarket → null. **Reporter Phase 4 (bd `x9s`)** — pas critique. | 2 jours |
| **4. Monitoring + badge UI source** | Logger `enriched` count par cycle dans `db.metrics`. Surface badge `Source: odds-api1` dans modal Insights Match (debug user). | 4h |
| **5. Tests E2E + canary deploy** | Tester 5 matchs foot + 5 matchs tennis (verifier `_odds_source` populated), comparer EV calculee vs cote actuelle Odds API. Deploy avec feature flag `ENABLE_ODDS_RAPIDAPI=true` (revert facile via env). | 1 jour |

**Effort total integration minimale (Phases 1+2+5)** : **~1 jour dev** (le module `odds-rapidapi.js` est deja code).
**Effort full abstraction (Phases 1-5)** : **~3 jours dev**.

---

### 5. RISQUES & BLOQUEURS IDENTIFIES

| Risque | Probabilite | Impact | Mitigation |
|---|---|---|---|
| Endpoint `odds-by-tournaments` non accessible avec plan RapidAPI souscrit | **Haute** (probes `/odds`, `/odds-feed`, `/prices` ont tous renvoye 404 dans `rapport-oddspapi-comparateur-2026.md` §0) | Bloquant | Phase 1 validation runtime obligatoire avant code |
| Betclic absent | Certaine | Faible (Odds API conservee comme primaire) | Garder source dual ; documenter dans badge UI |
| Editeur tiers RapidAPI publisher casse / disparait | Moyenne | Moyen | Fallback chain (Odds API reste primaire) |
| Quota RapidAPI partage epuise par autres APIs (tennis/1xbet/free-football) | Moyenne | Moyen | Cache 15 min deja code (CACHE_TTL_MS = 15 * 60 * 1000) ; cron 6-12h suffit |
| Schema reponse different du mock dans `odds-rapidapi.js` (lines 113-135) | **Haute** (schema reconstruit, jamais teste en live) | Moyen | Phase 1 valide + fixture reelle + ajuster `parseFixture()` si necessaire |
| Cle exposee en clair dans chat 21/05 (mentionnee dans `spike_rapidapi_oddsapi1_eval.md`) | Risque securite | Eleve | **Revoke immediate via dashboard RapidAPI** + generer nouvelle cle + stocker `.env` (jamais commit) |

---

### 6. ESTIMATION EFFORT INTEGRATION

- **Minimal (snippet enrichWithOdds dans fetchOdds())** : **1 jour** dev (test Phase 1 + snippet Phase 2 + tests Phase 5).
- **Complet (provider abstraction `providers/odds_provider.js` + badge UI + monitoring)** : **3 jours** dev (Phases 1-5).
- **Full scope bd `x9s` (refactor TOUS les champs cotes — fetchOdds + fetchTennisOddsAPI + tableau foot+tennis + Live + Bet modal + AI Scout + Affiliate + Hot Picks + Comparateur + Historique)** : **5-8 jours** dev comme deja estime dans bd `x9s`.

**Recommandation** : Demarrer par integration minimale (1j) en feature flag + canary 1 semaine en prod. Si metriques OK (enriched count ≥10/cycle, zero crash) → proceder full scope.

---

### 7. DECISION DG ATTENDUE

1. **GO test runtime Phase 1** (30 min, zero risque code) ? — recommande
2. **Si Phase 1 OK** : GO integration minimale 1j (snippet `enrichWithOdds`) ?
3. **Si canary 1 semaine OK** : GO full scope bd `x9s` 5-8j ?

**Action immediate (avant tout code)** :
- ⚠️ **Revoke cle RapidAPI exposee** dans chat 21/05 (cf. note securite `spike_rapidapi_oddsapi1_eval.md`).
- Generer nouvelle cle dans dashboard RapidAPI → `.env` VPS uniquement.

bd `bjv` reste in_progress jusqu'a decision DG Phase 1. bd `qkx` reste open. bd `x9s` reste open (bloque sur `qkx`).

---

*Rapport finalise 22/05/2026 — consolide 5 sources (spike_odds_alternatives.md, spike_rapidapi_oddsapi1_eval.md, rapport-spike-rapidapi-final.md, rapport-oddspapi-comparateur-2026.md, rapport-api-1xbet-rapidapi-2026.md) + audit codebase (odds-rapidapi.js, oddspapi.js, server.js, 5× _probe_rapidapi_odds*.js).*
*Spike read-only. Aucun code production touche.*
