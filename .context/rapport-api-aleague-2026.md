# Rapport — Intégration A-League (Australie) sur PariScore

> Étude API · comparatif · proposition routing gratuit + payant · 100 membres
> Statut : **RÉVISÉ post-vérification live — BLOQUÉ : refactor requis + quota API-Football + collision id**
> Date : 2026-05-15 · Ligue cible : **Isuzu UP A-League Men** (Australie, saison oct→mai)

---

## ⚠️ ADDENDUM 2026-05-15 — CORRECTION POST-VÉRIFICATION (prime sur §1-§4)

Vérification live (BSD MCP + API-Football) invalide les conclusions initiales :

| Hypothèse initiale | Réalité vérifiée |
|---|---|
| Sofascore/BSD couvre l'A-League | **FAUX** — proxy bzzoiro = 52 ligues fixes, **aucune australienne** |
| Coût marginal 0 € qualité ★★★★ | **FAUX** — sans BSD : pas de xG/lineups/live A-League |
| Routing config-only sans code | **FAUX** — nécessite refactor `api_football_id` |

**Faits durs :**
1. **Pipeline = BSD-primaire** : matchs construits depuis BSD events, cotes (Odds API) mergées dessus. A-League absente de BSD → **aucun fixture support** → cotes-seules **impossible** (rien sur quoi attacher).
2. **A-League fonctionne uniquement si wiring API-Football complet** (fixtures + standings + stats).
3. **Collision id** : id API-Football A-League = **188**. `leagues_config.json` utilise déjà **188 = Scottish Premiership**. Révèle bug latent préexistant : Scotland (id 188) interroge la mauvaise ligue API-Football (Scotland Prem réel ≈ 179), masqué car Scotland tourne effectivement sur BSD (sofa_id 36).
4. `l.id` consommé brut sur ~6 sites API-Football (standings `server.js:9014`, fixtures `next=100`, topscorers, topassists, h2h, advstats `teams/statistics`) — **pas de résolveur central**. Ajouter `api_football_id` = refactor traversant.
5. **API-Football quota jour épuisé** au moment de l'étude → ids **non testables** ce jour. Implémenter à l'aveugle = interdit (rigueur projet).

**Spec d'implémentation exacte (à exécuter quand quota API-Football reset + GO sur refactor) :**

- **B1 — Champ config** : ajouter à `leagues_config.json` une entrée A-League avec `id` interne **unique non utilisé** (ex : `600`) + nouveau champ `"api_football_id": 188` + `odds_key: "soccer_australia_aleague"` + `sofa_id: null` + `cron_hours: 24` + `type: "T2"` + `country: "Australia"`.
- **B2 — Helper résolveur** : `const apifId = l => l.api_football_id ?? l.id;` Remplacer `l.id` → `apifId(l)` **uniquement** aux ~6 points d'appel `https://v3.football.api-sports.io/...league=`. Rétrocompatible : les 50 ligues sans `api_football_id` gardent `l.id` (comportement inchangé).
- **B3 — Pas de mapping BSD** (pas de couverture). Le résolveur BSD doit *gracieusement skip* A-League (déjà le cas : `BSD_CONFIG_TO_BSD` absent → fallback API-Football).
- **B4 — Bug Scotland 188** : signalé, **hors scope** (ne pas corriger sans validation séparée — risque régression Scotland).
- **B5 — Test obligatoire** : quota reset → `curl .../leagues?id=188` confirme « A-League / Australia » ; puis `/matches?league=soccer_australia_aleague` doit renvoyer fixtures + standings dérivés.
- **B6 — Saison** : oct→mai. Mi-mai = fin de saison → peu/pas de fixtures à venir immédiatement (normal, pas un bug).

**Conséquence qualité** : A-League sera en **mode dégradé** (API-Football only) — pas de xG/lineups/live BSD comme les autres ligues. Coût € = 0 (plan PRO + Odds gratuit couvrent).

**Décisions requises avant code :**
- (a) OK A-League en mode dégradé API-Football-only ? (sinon : abandon)
- (b) Autorisation refactor B2 (`api_football_id` sur 6 sites) ?
- (c) Implémentation différée à demain (quota reset, pour tester) — accepté ?

---

## ✅ SOLUTION RETENUE — RapidAPI "Free API Live Football Data" (FotMob) — VÉRIFIÉE LIVE

Lève TOUS les bloqueurs ci-dessus. **Testé en direct le 2026-05-15, fonctionne.**

| Critère | Résultat vérifié |
|---|---|
| Clé | `FREE_FOOTBALL_RAPIDAPI_KEY` **déjà dans `.env`** (mutualisée RapidAPI) |
| Host | `free-api-live-football-data.p.rapidapi.com` |
| A-League id | **`113`** (`/football-leagues-search?search=A-League` → `{"id":"113","name":"A-League","ccode":"AUS"}`) |
| Fixtures | `/football-get-all-matches-by-league?leagueid=113` → **162 matchs** réels (ex: Newcastle Jets vs Sydney FC 2026-05-16) ✅ |
| Collision id | **Aucune** — chemin RapidAPI séparé du scheme `leagues_config.id` / API-Football |
| Quota | OK (clé dédiée, tennis l'utilise déjà légèrement) |
| Coût | **0 €** |
| Standings/rang | dérivables des events finis (pattern projet `fetchBSDStandingsFromEvents`) — sinon rang null gracieux (cf. Hongrie/Saoudie `sofa_id:null`) |

Shape match RapidAPI : `{ id, home:{id,name,score}, away:{id,name,score}, status:{utcTime,started,cancelled,finished}, notStarted }`.

### Spec d'implémentation turnkey (R1-R5)

- **R1 — Const** : `FREE_FOOTBALL_RAPIDAPI_KEY` + `FREE_FOOTBALL_RAPIDAPI_HOST` (✅ déjà ajoutés `server.js:60`).
- **R2 — `leagues_config.json`** : entrée A-League — `id` interne **unique inutilisé** (ex `600`), nouveau champ `"rapid_league_id": 113`, `odds_key: "soccer_australia_aleague"`, `country: "Australia"`, `type: "T2"`, `cron_hours: 24`, `sofa_id: null`.
- **R3 — Adapter pur** `rapidFreeToOddsApiFormat(rm, cfg)` → shape interne identique à `bsdToOddsApiFormat` output : `{ id:'raf_'+rm.id, sport_key:cfg.odds_key, sport_title:cfg.name, country:'Australia', commence_time:rm.status.utcTime, home_team:rm.home.name, away_team:rm.away.name, _sport:cfg.odds_key, _source:'rapidfree', _config_league_id:cfg.id, status: rm.status.finished?'finished':(rm.status.started?'inprogress':'notstarted') }`. Exclure `finished`/`cancelled`.
- **R4 — Fetch** `fetchRapidFreeFootballMatches()` : pour chaque `leaguesConfig.leagues` ayant `rapid_league_id`, GET `/football-get-all-matches-by-league?leagueid=${id}` (header `x-rapidapi-key`/`x-rapidapi-host`), filtrer fenêtre J→J+7, map via R3.
- **R5 — Injection** `fetchOdds()` après ÉTAPE 1 BSD (≈`server.js:8745`) : nouvelle **ÉTAPE 1.5** — `allRawMatches.push(...await fetchRapidFreeFootballMatches())`. Cotes : The Odds API `soccer_australia_aleague` mergées via cron `ALL_SPORTS` (auto, l'`odds_key` entre en config). **Point de vigilance** : les matchs RapidAPI n'ont pas de cotes natives → vérifier que le pipeline conserve un match sans bookmakers jusqu'au merge Odds API (le chemin BSD, lui, *drop* si pas de cotes). À tester après wiring ; si drop, ajouter placeholder neutre supprimé au merge (jamais de cote fabriquée).

**Risque** : R5 touche `fetchOdds` (chemin core des 50 ligues) + comportement matchs sans cotes non mappé → **édition à risque partagé, GO explicite requis**. R2/R3/R4 sont additifs/isolés (zéro risque régression).

**Reco finale : abandonner pistes B (API-Football collision/quota) → SOLUTION RapidAPI (R1-R5).** Décision : GO sur R2-R5 ? (R1 fait)

---

## 📋 DONNÉES DISPONIBLES — Free API Live Football Data × A-League (id 113)

> Inventaire **vérifié endpoint par endpoint** le 2026-05-15 (clé `.env`). Source = wrapper RapidAPI de FotMob.

### Endpoints fonctionnels pour l'A-League

| Endpoint | Donne | Champs clés |
|---|---|---|
| `/football-leagues-search?search=A-League` | Résolution ligue | `id:"113"`, `name:"A-League"`, `ccode:"AUS"` (+ A-League Women `9495`) |
| `/football-get-all-matches-by-league?leagueid=113` | **162 matchs** saison (passés + à venir) | par match : `id`, `home{id,name,score}`, `away{id,name,score}`, `status{utcTime,started,finished,cancelled,awarded,scoreStr,reason{short:"FT",long:"Full-Time"}}`, `notStarted`, `pageUrl`, `tournament.stage` |
| `/football-get-match-detail?eventid=<id>` | Méta match | `matchId`, `matchName`, `matchRound`, `leagueId/Name`, `parentLeagueId`, `countryCode`, `homeTeam{id,name}`, `awayTeam{id,name}`, `teamColors`, `matchTimeUTC`, `started`, `finished`, **`coverageLevel:"xG"`** |
| `/football-current-live` | Scores live **tous** (filtrable `leagueId`/`parentLeagueId=113`) | `id`, `leagueId`, `time`, `home/away{id,name,longName,score}` |

### Données EXPLOITABLES pour A-League

✅ **Calendrier complet** (162 fixtures, fenêtre saison oct→mai)
✅ **Scores finaux + mi-temps via scoreStr** (`"2 - 1"`, `reason:FT`)
✅ **Statut match** (notstarted / started / finished / cancelled / awarded)
✅ **Heure UTC précise** (`status.utcTime`)
✅ **IDs équipes FotMob** (jointure possible logos `images.fotmob.com/.../teamlogo/<id>`)
✅ **Scores live** (via `/football-current-live`, polling)
✅ **Round / journée** (`matchRound`)
✅ **Couleurs équipes** (UI badges)

### Données NON disponibles (limite du wrapper free)

❌ **Classement / standings** — `/football-get-standing-all?leagueid=113` → `"Request Failed"` systématique (non fourni pour A-League)
❌ **xG par match** — bien que `coverageLevel:"xG"` (la data existe chez FotMob), **aucun endpoint stats accessible** sur ce plan
❌ **Compositions / lineups** — endpoint inexistant
❌ **Événements match** (buts, cartons, minutes) — endpoint inexistant
❌ **Stats équipe/joueur, top buteurs, H2H, détail équipe** — endpoints inexistants

### Conséquences pour PariScore (mode dégradé A-League)

| Module PariScore | A-League via cette API |
|---|---|
| Tableau matchs (fixtures, heure, équipes) | ✅ OK |
| Score / résultat / live | ✅ OK |
| Cotes & EV | ✅ via The Odds API `soccer_australia_aleague` (séparé) |
| Classement / rang équipe | ⚠️ **Dérivé** des matchs finis (agrégation pts maison, pattern `fetchBSDStandingsFromEvents`) — sinon rang `null` |
| Poisson (avgScored/Conceded) | ⚠️ Calculable depuis scores finis agrégés (pas de stat API) |
| xG / PWR avancé / lineups / buteurs / KPI joueurs | ❌ Indisponible — colonnes vides/grisées pour A-League |
| Power Score IA / Insights profond | ⚠️ Limité (pas de xG/stats source) |

**Bilan** : suffisant pour un **produit pari fonctionnel** (matchs + scores + cotes + Poisson dérivé du réel), mais A-League restera une ligue **« light »** sans la profondeur (xG/lineups/joueurs) des ligues couvertes par BSD. Coût 0 €.

---

## 0. Contexte technique PariScore (rappel)

Architecture **serveur-centrique** : le frontend n'appelle JAMAIS une API externe. Tout passe par des **cron jobs cachés** (Odds 12h · Stats 6-12h · stats avancées 24h) écrivant dans le cache. **Conséquence économique majeure** : le coût API est piloté par les crons, **pas** par le nombre de membres. 100 membres ≈ même charge API que 1 membre. Le goulot d'étranglement à 100 membres est RAM/CPU serveur, pas le quota API.

Sources déjà intégrées :
- **BSD / Sofascore** (`sports.bzzoiro.com`) — microservice proxy, source **primaire** (xG, stats, lineups, live, incidents).
- **API-Football** (`v3.football.api-sports.io`) — plan **PRO $19/mois, 7 500 req/jour** déjà payé.
- **The Odds API** — cotes, plan **gratuit 500 req/mois**.
- **TheSportsDB** — fallback gratuit.
- **Sportmonks** — optionnel (clé non active).

---

## 1. Meilleure API A-League — rapport économique × qualité

L'A-League est une ligue **secondaire** mondialement → couverture inégale selon fournisseur.

**Verdict : aucune nouvelle API à acheter.** L'A-League est déjà couverte par les 3 sources déjà payées/intégrées. Le meilleur rapport éco/qualité = **réutiliser BSD/Sofascore (primaire) + API-Football id 188 (fallback) + The Odds API (cotes)**. Coût marginal = **0 €/mois**.

---

## 2. Rapport comparatif des API couvrant l'A-League

| API | Couvre A-League | Données | Qualité xG/live | Coût | Déjà intégré | Verdict |
|---|---|---|---|---|---|---|
| **Sofascore (via BSD bzzoiro)** | ✅ complet | scores, stats, lineups, incidents, xG (partiel) | ★★★★☆ | proxy interne, **0 € marginal** | ✅ primaire | **Source #1** |
| **API-Football** (id ligue **188**) | ✅ complet | fixtures, standings, stats équipe, live, predictions | ★★★★☆ | inclus plan **PRO déjà payé** ($19/mo) | ✅ | **Fallback #1** |
| **The Odds API** (`soccer_australia_aleague`) | ✅ cotes | h2h, totals, bookmakers | n/a (cotes) | gratuit 500 req/mo (suffit) | ✅ | **Cotes** |
| **TheSportsDB** | ✅ basique | scores, équipes, logos | ★★☆☆☆ | gratuit | ✅ fallback | Secours |
| **Sportmonks** | ✅ (hors plan free — free = 3 ligues EU) | stats riches + predictions + xG | ★★★★☆ | Worldwide ~**€39-129/mo** | ❌ | Inutile (redondant) |
| **Football-Data.org** | ❌ (≈12 compés EU only) | — | — | — | ❌ | Exclu — ne couvre pas |
| **SportRadar / Stats Perform** | ✅ premium | tout, temps réel pro | ★★★★★ | **enterprise (€€€€)** | ❌ | Hors budget |

**Lecture :** payer une nouvelle API (Sportmonks, SportRadar) = **redondant** — qualité équivalente ou marginale vs Sofascore+API-Football déjà en place. ROI négatif.

---

## 3. Proposition de routing

### 3.A — OPTION GRATUITE (recommandée) — 0 €/mois marginal

Cascade identique au pattern `tv-channel` existant (4 couches) :

```
A-League stats/fixtures/standings/live :
  1) BSD/Sofascore       (primaire — xG, lineups, live)
  2) API-Football id 188 (fallback — standings robustes, plan PRO déjà payé)
  3) TheSportsDB         (secours gratuit — scores basiques)

A-League cotes :
  → The Odds API  sport = "soccer_australia_aleague"  (cron 12h)
```

Modifs config (sans nouvelle dépendance ni clé) :
- `leagues_config.json` : ajouter entrée A-League (odds_key `soccer_australia_aleague`, id API-Football `188`, mapping BSD).
- `bsd_config.json` : mapping `config_to_bsd` / `bsd_to_config` pour l'A-League.
- Aucune modif `server.js` lourde — la ligue rentre dans les boucles cron existantes.

**Coût mensuel A-League : 0 €.** (tout dans les plans/quotas déjà payés)

### 3.B — OPTION PAYANTE (si exigence premium / scaling futur)

Seulement si besoin **xG live garanti + predictions pré-match** sur A-League :

| Upgrade | Prix | Gain | Pertinence 100 membres |
|---|---|---|---|
| API-Football **Mega** | $39/mo (75k req/j) | crons live plus fréquents multi-ligues | Inutile à 100 membres (cache absorbe) |
| Sportmonks **Worldwide** | ~€39-129/mo | xG + predictions A-League natifs | Marginal (Sofascore couvre déjà) |
| SportRadar enterprise | €€€€ | data pro temps réel | Hors échelle PariScore |

**Reco : ne PAS prendre l'option payante.** Aucun gain justifiant le coût à l'échelle 100 membres.

### 3.C — Charge réelle 100 membres (chiffrage)

Frontend → `/api/v1/matches` (cache JSON, **0 appel externe**). Externe = cron only :
- The Odds API : 1 ligue × 1 appel /12h ≈ **~60 req/mois** ≪ 500 gratuit ✅
- API-Football : +1 standings /12h ≈ négligeable vs 7 500/jour PRO ✅
- BSD : proxy, pas de quota public ✅

→ **100 membres = +0 € API.** Surveiller plutôt RAM/CPU (Bootstrap/Poisson) — non lié à l'A-League.

---

## 4. Plan d'implémentation (EN ATTENTE DE GO — non exécuté)

Si GO sur Option 3.A :
1. `leagues_config.json` — ajouter bloc A-League (odds_key, api-football id 188, pays AU, drapeau, type T2).
2. `bsd_config.json` — résoudre l'id BSD/Sofascore A-League + mapping bidirectionnel.
3. Vérifier que les crons (`fetchOdds`, `fetchStats`) prennent la nouvelle ligue sans patch code.
4. Test : `/api/v1/matches?league=...` renvoie matchs A-League avec stats + cotes.
5. Frontend : drapeau 🇦🇺 dans filtres ligues (déjà géré par `flags_config.json`).
6. Restart serveur + vérif.
7. Mise à jour CHANGELOG / CLAUDE.md.

**Aucune dépendance npm, aucune clé nouvelle, aucun coût.**

---

## Conclusion

| Question | Réponse |
|---|---|
| Meilleure API A-League éco×qualité | **Sofascore (BSD) + API-Football id 188** — déjà payés |
| Faut-il acheter une API ? | **Non** — redondant, ROI négatif |
| Routing gratuit | BSD → API-Football → TheSportsDB + Odds API (cotes) — **0 €** |
| Routing payant | Non recommandé (aucun gain à 100 membres) |
| Impact 100 membres | **+0 €** (architecture cache, charge API ≠ f(membres)) |
| Action | Ajout config-only — **attente GO** |

*Rapport généré pour validation. Implémentation déclenchée sur GO explicite.*
