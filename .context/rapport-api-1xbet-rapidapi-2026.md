# Rapport — API `1xbet-api` (RapidAPI / provider cosmx) pour PariScore

> Cible analysée : https://rapidapi.com/cosmx-cosmx-default/api/1xbet-api
> Host : `1xbet-api.p.rapidapi.com` · Date : 2026-05-15 · Statut : **ANALYSE — aucun code modifié**
> Contexte : l'utilisateur parie **principalement sur 1xBet** ; PariScore positionné FR/ANJ.

---

## 1. Faits vérifiés (test live)

| Test | Résultat |
|---|---|
| Accessibilité avec clé projet (`RAPIDAPI_KEY` partagée `.env`) | ✅ **`/sports` → HTTP 200** — pas de souscription supplémentaire requise |
| `/sports` | ✅ Retourne sports + ids : **Football=1**, Tennis=4, Basketball=3, Ice Hockey=2, Long-term=2999, … |
| `/matches` | ⚠️ Existe mais `{"message":"Missing required parameters"}` — **paramètres non documentés hors playground** |
| `/live`, `/leagues`, `/odds`, `/match`, `/champs` | ❌ N'existent pas sous ces noms |
| Nature | Wrapper RapidAPI **non officiel** de 1xBet (scrape la LineFeed 1xBet, exposé en API managée par l'éditeur tiers « cosmx ») |

**Point clé** : contrairement au feed agrégé `onexbet` de The Odds API (rapport précédent, Voie A), cette API expose **les cotes propres de 1xBet** — exactement les prix que l'utilisateur joue.

---

## 2. + (Avantages pour PariScore)

- **EV/Edge exact personnalisé** : cote 1xBet réelle → Value Bet calculé sur le prix *réellement jouable* par l'utilisateur (vs moyenne EU approximative de The Odds API).
- **Profondeur marchés potentielle** : 1xBet LineFeed = 1X2 + handicaps asiatiques + totals + props (vs The Odds API limité 1X2/totals). À confirmer une fois `/matches` documenté.
- **Infra managée** : le wrapper RapidAPI absorbe anti-bot/Cloudflare/miroirs/bans — **pas de maintenance scraping** côté PariScore (le gros − de la voie scraping direct disparaît).
- **Clé déjà disponible** : `RAPIDAPI_KEY` mutualisée `.env` fonctionne (testé). **0 nouvelle souscription, 0 € marginal vérifié sur `/sports`** (à confirmer pour `/matches` selon plan de l'API).
- **Boucle tracking cohérente** : module « Mes Paris » utilise déjà `1xbet` par défaut → cote→pari→règlement sur le même book.
- **Détection value sur mollesse 1xBet** : 1xBet a souvent des cotes hautes sur marchés secondaires → plus d'edges détectés vs books sharp.

## 3. − (Inconvénients / Risques)

- **Éditeur tiers indépendant** (« cosmx ») : pérennité/fiabilité dépend d'un seul publisher RapidAPI — peut casser ou disparaître. Risque single-point-of-failure.
- **Spec opaque** : params requis de `/matches` accessibles uniquement via le **playground RapidAPI souscrit** (non scrappable). Intégration bloquée tant que params inconnus.
- **Conflit ANJ inchangé** : données 1xBet, opérateur non licencié France. PariScore force-désactive books non-ANJ ([server.js:3013](server.js:3013)). → usage à garder **privé**, pas en vitrine publique.
- **Quota/pricing `/matches` inconnu** : `/sports` OK gratuit, mais l'endpoint data peut exiger un plan payant RapidAPI (réponse « Missing params » ≠ « not subscribed » → probablement accessible, à confirmer).
- **ToS sous-jacent** : reste un scrape de 1xBet médiatisé par RapidAPI — fraîcheur/latence à valider.

---

## 4. Comparatif vs rapport 1xBet précédent

| Critère | Voie A — The Odds API `onexbet` | **Cette API — `1xbet-api` RapidAPI** |
|---|---|---|
| Source cote | agrégat tiers ≈ 1xBet | **1xBet direct (LineFeed)** |
| Précision EV perso | moyenne | **élevée (prix réel joué)** |
| Profondeur marchés | 1X2/totals | potentiellement full (handicaps/props) |
| Maintenance | nulle | nulle (wrapper managé) |
| Légal/ToS | ✅ propre | ⚠️ gris (scrape médiatisé) |
| Pérennité | ✅ (Odds API établi) | ⚠️ (éditeur indé) |
| Clé/coût | quota Odds API | clé `.env` OK, pricing `/matches` à confirmer |
| Conflit ANJ | gérable privé | gérable privé |

**Verdict** : cette API est **supérieure pour l'objectif « EV sur la cote que je joue réellement »** (1xBet direct + infra managée), au prix d'une dépendance à un éditeur indé et d'une spec à débloquer.

---

## 5. Recommandation

**PoC privé recommandé**, en complément (pas remplacement) de The Odds API :

1. **Débloquer la spec** : depuis le playground RapidAPI souscrit (lien fourni), récupérer les **params requis de `/matches`** (probable : `sport`, + `champ`/`country`/`type=line|live` ou un id de compétition). → me les fournir.
2. **PoC isolé** : adapter `fetch1xbetOdds(sportId, …)` → mapper cotes 1xBet sur les matchs existants (jointure équipes/heure), **stocker comme cote secondaire `book=1xbet`**.
3. **EV « vs 1xBet » privé** : colonne/indicateur visible **uniquement** en mode connecté / Mes Paris — **jamais en vitrine publique** (respect ANJ + règle `aNJ:false` existante).
4. **Garde-fous** : cache (cron, pas temps réel), fallback silencieux si API down, flag config `ENABLE_1XBET_ODDS` off par défaut.
5. **Confirmer pricing/quota** `/matches` sur le plan RapidAPI avant prod.

### Décisions attendues (avant code)
- (a) GO PoC privé (EV vs 1xBet réel, non public) ?
- (b) Peux-tu fournir depuis le playground RapidAPI les **paramètres requis de `/matches`** (+ 1 réponse exemple) ? Bloquant technique.
- (c) Périmètre : Mes Paris/connecté uniquement (reco) ou vitrine publique (⚠ ANJ) ?
- (d) Plan RapidAPI de cette API : gratuit ou payant sur `/matches` ?

*Rapport pour validation. Aucune modification effectuée. Test API réel effectué le 2026-05-15.*

---

## 6. ADDENDUM — Cartographie complète des champs (sondage empirique 2026-05-15)

> **context7** : MCP de doc de **librairies open-source** (React, Prisma…). Ne contient **rien** sur cette API privée RapidAPI tierce — non pertinent ici. Seule doc fiable = sondage direct des endpoints (ci-dessous) ou le playground RapidAPI souscrit.

### Surface API confirmée (testée)

| Endpoint | Statut | Schéma de réponse vérifié |
|---|---|---|
| `GET /sports` | ✅ | `{ "data": [ { "id": int, "name": string } ] }` — **~50+ sports**. Ex : `{id:1,"Football"}`, `{id:4,"Tennis"}`, `{id:3,"Basketball"}`, `{id:2,"Ice Hockey"}`, `{id:6,"Volleyball"}`, `{id:10,"Table Tennis"}`, `{id:66,"Cricket"}`, `{id:13,"American Football"}`, `{id:40,"Esports"}`, `{id:5,"Baseball"}`, `{id:2999,"Long-term bets"}`, … |
| `GET /sports/{sportId}` | ✅ | `{ "data": { "id": int, "leagues": [ { "league_id": int, "league_name": string, "logo": url? } ] } }` — **compétitions/championnats par sport**. Foot ex : `{league_id:1413697,"Enhanced Daily Specials"}`, `{league_id:2989655,"Matches of the Day"}` (+ `logo` CDN `v3.traincdn.com/sfiles/logo-champ/…`). Tennis (`/sports/4`) : `{league_id:332467,"ATP. Rome. Doubles"}`, `{league_id:55381,"WTA. Rome"}`… |
| `GET /matches/{eventId}` | ⚠️ existe | Renvoie `{"message":"record not found","status":"error"}` sans id event valide → **endpoint détail match/cotes par event id**. Schéma exact (cotes/marchés) **non capturé** faute d'event id valide accessible. |
| `GET /matches?<params>` | ❌ bloqué | `{"message":"Missing required parameters"}` quel que soit le param testé (`sport`, `sportId`, `league(_id/Id)`, `champ(Id)`, `tournamentId`, `id`, `type`, `lang`, `live`, `query`, combos…). **Nom(s) de paramètre(s) requis non devinable — défini uniquement dans le playground RapidAPI souscrit.** |
| `/live`, `/odds`, `/leagues`, `/events`, `/countries`, `/tournaments`, `/feed`, POST `/matches` | ❌ | N'existent pas |

### Champs EXPLOITABLES confirmés aujourd'hui

✅ **Référentiel sports** : `id`, `name` (~50 sports — mapping multi-sport possible : foot, tennis, basket… aligné avec PariScore foot+tennis)
✅ **Référentiel compétitions/ligues 1xBet** : `league_id`, `league_name`, `logo` (URL CDN) — par sport. Utile pour : mapping ligues PariScore ↔ 1xBet, logos championnats.

### Champs NON confirmés (bloqués par spec `/matches`)

❓ **Cotes** (1X2, handicaps, totals, props), **équipes**, **date/heure event**, **score live**, **marchés détaillés** — tout cela passe par `/matches/{eventId}` ou `/matches?…`, **inaccessible sans** : (a) les params requis de `/matches?` (playground souscrit), OU (b) un `eventId` 1xBet valide pour tester `/matches/{id}`.

### Conclusion technique

L'API donne **gratuitement et de façon fiable** : référentiels **sports + compétitions + logos** 1xBet. La couche **cotes/matchs existe** (`/matches/{id}`) mais son **schéma de champs est non documenté hors playground RapidAPI souscrit**.

**Bloquant unique pour cartographier 100% des champs** : fournir, depuis le playground RapidAPI (ton lien souscrit), **soit** la liste des params requis de `/matches`, **soit** un `eventId` exemple + sa réponse JSON. Avec ça → je dumpe et documente l'intégralité des champs cotes/marchés en une passe.

*Sondage : 40+ requêtes test sur `1xbet-api.p.rapidapi.com` avec clé `.env` partagée, 2026-05-15.*

---

## 7. Test endpoint `markets/periods` (curl fourni par l'utilisateur)

`GET /matches/{id}/markets/periods?mode=line&lng=en` — **testé** (clé fournie, ids ligues + 1).

| Test | Réponse |
|---|---|
| `/matches/2989655/markets/periods?mode=line&lng=en` | `{"message":"record not found","status":"error"}` |
| `/matches/1413697/markets/periods?…` | idem `record not found` |
| `/matches/{id}/markets?…`, `/matches/{id}?…` | idem `record not found` |

**Conclusion** : l'endpoint **existe et est valide** (erreur sémantique `record not found`, ≠ `does not exist`). `{id}` = **event id 1xBet** (PAS league_id). Les `league_id` de `/sports/{sportId}` ne sont **pas** des event ids → toujours `record not found`.

**Paramètres confirmés** : `mode` ∈ {`line`,`live`}, `lng` (langue). Structure : `/matches/{eventId}` + sous-ressources `/markets`, `/markets/periods`.

**Chaînon manquant persistant** : aucun endpoint testé ne **liste les `eventId`**. `/matches?` reste `Missing required parameters` (60+ combos). La liste des matchs/events est l'endpoint **non identifié** (params définis dans l'onglet *Endpoints* du playground RapidAPI souscrit).

### Pour débloquer (1 seule info suffit)
Depuis le playground RapidAPI (ton lien souscrit), onglet **Endpoints**, donne-moi **l'un** de :
1. L'endpoint + params qui **liste les matchs/events** (ex : `GET /matches?xxx=…`) — le nom exact du/des param(s) requis.
2. **OU** un seul `eventId` 1xBet réel (visible dans un exemple de réponse du playground).

Avec ça → je teste `/matches/{eventId}/markets/periods`, dumpe le schéma **complet des cotes/marchés/périodes**, et documente 100% des champs en une passe.

---

## 8. ✅ SCHÉMA COMPLET — débloqué via event id réel (2026-05-15)

Event test : **`721402827`** (Aston Villa–Liverpool, EPL live). URL source : `1xlite-48727.bar/fr/live/football/88637-england-premier-league/721402827-…`.

> ⚠️ Les ids `alternative-matches` / `Daily Specials` (football **virtuel/simulé**) → `record not found`. Seuls les **vrais events** sont indexés. `mode=live` pour matchs en cours, `mode=line` pour prématch.

### Endpoints fonctionnels (confirmés)

| Endpoint | Retour |
|---|---|
| `GET /sports` | `[{id,name}]` ~50 sports |
| `GET /sports/{sportId}` | `{id, leagues:[{league_id,league_name,logo}]}` |
| `GET /matches/{eventId}?mode=line\|live&lng=en` | **Match complet : méta + 25 marchés + cotes + statistiques live** |
| `GET /matches/{eventId}/markets?mode=…` | Tous les marchés (objet) |
| `GET /matches/{eventId}/markets/periods?mode=…` | Périodes : `[{id,name:"2nd half"}]` |

### Schéma `/matches/{eventId}` (champs racine)

```
away_team, away_team_logo (CDN traincdn), home_team, home_team_logo,
country, id, league, league_logo, start_timestamp (unix),
markets {…}, statistics {…}
```

### `statistics` (live — RICHE)

```
current_round            : "2nd half"
full_score               : { "Aston Villa":3, "Liverpool":1 }
game_statistics[]        : [{ "<HomeTeam>":val, "<AwayTeam>":val, stat_name }]
  stat_name ∈ : xG · Attacks · Dangerous attacks · Possession % ·
                Shots on target · Shots off target · Yellow cards ·
                Saves · Corner  (+ autres)
```
→ **xG live + tirs cadrés + attaques dangereuses + possession + corners** = exactement les inputs de la *Danger Matrix* / *Live Intensity* PariScore (v9.7/v9.4).

### `markets` (25 marchés sur ce match, clé = marketId)

`{ "<marketId>": { name, outcomes:[ { blocked:bool, name:string, odds:float } ] } }`

| id | Marché | #out | id | Marché | #out |
|---|---|---|---|---|---|
| 1 | 1x2 | 3 | 99 | Asian Total | 3 |
| 2 | Handicap | 6 | 136 | Correct Score | 11 |
| 8 | Double Chance | 3 | 154 | Last Goal | 2 |
| 14 | Even/Odd | 2 | 275 | Any Team To Win By | 6 |
| 15 | Total 1 (équipe) | 2 | 285 | Total Each Team U/O | 2 |
| 17 | Total (match) | 5 | 2854 | Asian Handicap | 8 |
| 19 | Both Teams To Score | 2 | 3559 | Next Goal Handicap | 4 |
| 20 | Next Goal | 6 | 3561 | Next Goal Double Chance | 3 |
| 27 | European Handicap | 9 | 8427 | Asian Team Total 1 | 2 |
| 49 | Draw In ≥1 Half | 2 | 8429 | Asian Team Total 2 | 2 |
| 62 | Total 2 (équipe) | 4 | 87 | 3Way Total | 3 |
| 89 | Indiv 3Way Total 2 | 3 | 91/92 | Indiv Total Even/Odd | 2 |

`outcome` = `{ blocked:bool, name:str, odds:float }` (cote décimale). `blocked:true` = marché suspendu (live).

### Valeur concrète PariScore (champs → usages)

| Champ 1xBet | Usage PariScore |
|---|---|
| `markets.1` (1x2) odds HOME/Draw/AWAY | **EV/Edge exact vs cote réellement jouée** (cœur du besoin) |
| `markets.19` BTTS, `markets.17` Total, `markets.8` DC, `136` CS | Couverture marchés Poisson (BTTS/Over/CS/DC) — comparaison modèle↔1xBet |
| `markets.2854` Asian Handicap, `2`/`27` Handicaps | Profondeur absente de The Odds API |
| `statistics.game_statistics` (xG, tirs, attaques dang., possession, corners) | **Danger Matrix / Live Intensity** alimentées par la source du book joué |
| `full_score`, `current_round` | Score live + période |
| `*_logo`, `league`, `country`, `start_timestamp` | Affichage / mapping match |

**Conclusion** : l'API fournit **tout le nécessaire** — cotes 25 marchés (dont 1x2/BTTS/Total/Handicaps) **+ stats live xG/tirs/possession/corners** du book réel. Couverture **supérieure** à The Odds API (profondeur marchés) ET à BSD pour les ligues où 1xBet a la donnée. Reste : pas d'endpoint *liste d'events* identifié (param `/matches?` playground-locked) → il faut un **id event** par match (mapping via URL ou futur endpoint liste).

### Prochaine étape (sur GO)
PoC privé : `fetch1xbetMatch(eventId, mode)` → mapper `markets.1` sur cote EV perso + `statistics` sur Danger Matrix, **scope Mes Paris/connecté** (ANJ). Bloquant résiduel : obtenir l'endpoint **liste events** (sinon mapping event id manuel/URL). Demande au support RapidAPI ou onglet Endpoints du playground : « endpoint listant les matchs d'une ligue/sport ».
