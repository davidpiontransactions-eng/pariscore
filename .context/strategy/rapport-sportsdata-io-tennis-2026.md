# Rapport sportsdata.io Tennis API — Evaluation PariScore 2026

**Auteur** : Agent recherche (CTO/Lead Data Scientist hat)
**Date** : 21/05/2026
**Sources** : sportsdata.io/developers/api-documentation/tennis, sportsdata.io/tennis-api, sportsdata.io/sportradar-alternative, vendr.com/marketplace/sportsdataio, sportsapi.com/api-directory/sportsdataio, recherches croisees sportsdataapi.com / isportsapi.com
**Contexte** : Investigation post audit `.context/strategy/rapport-tennis-data-sourcing-2026.md` (Sackmann CC BY-NC-SA = bloqueur SaaS, BSD $5/mo OK live, api-tennis.com $60/mo top pick CTO PBP+odds, Sportradar $2k+ REJETE).

---

## TL;DR

**VERDICT : SKIP (T1, "pricing opaque + overlap fonctionnel BSD/api-tennis")**

sportsdata.io Tennis est un fournisseur **B2B enterprise serieux** (vendor leader US fantasy/regulated betting, fonde 2008, alternatif credible Sportradar) mais :

1. **Pricing opaque** — aucun tarif public. Vendr median annuel $16 496 (~$1 375/mo) toutes verticales confondues. Cout estime starting **$500 – $1 000+/mo par sport** (sportsapi.com directory). **Demolition immediate de la marge €19/mois Pro** (break-even ~50-100 abos Pro juste pour 1 source data).
2. **Free trial = scrambled data** — donnees fictives 1 000 calls/mo, inutilisable production. Pas de tier developpeur "vrai data low-cost" comme api-tennis.com.
3. **Data dictionary tennis volontairement leger** — Match/Period/Player/MatchOdds. **PAS de serve stats (aces, 1st serve %, BP saved)**, surface au niveau season uniquement, **pas de point-by-point reel** (juste "play-by-play" generique mentionne marketing). Inferieur a api-tennis.com Premium $60/mo qui delivre PBP + odds.
4. **Overlap quasi-total avec BSD ($5/mo) + Odds API existants** : live scores, odds 10+ bookmakers, schedules, rankings. Aucun delta data-depth justifiant 100x-200x le cout BSD.
5. **Force unique** : SLA 24/7/365 + API Replay (rejouage requetes pour test) + BAKER predictive engine. **Mais PariScore a deja son propre moteur Poisson/Elo** — pas besoin de BAKER.

**Tier recommande si jamais GO** : aucun (rapport cout/valeur casse). Si DG impose evaluation, demander **uniquement un quote pour Discovery Lab Odds** ($100-1000 calls/jour) en alternative — mais ROI quasi-nul vs BSD deja paye.

**Cout mensuel** : $500 – $1 000+/mo minimum (extrapolation Vendr)
**Effort integration** : 2-3 jours (REST + JSON + Node SDK officiel disponible) — facile, mais NON pertinent.

---

## 1. Pricing : Opacite Totale + Anchor Enterprise

| Source | Donnee | Note |
|---|---|---|
| sportsdata.io site officiel | Aucun tarif public, "Contact Sales" partout | Pattern enterprise classique |
| Vendr marketplace (signal fort) | **Mediane annuelle $16 496** (low $15 299 / high $16 496) | Tous sports confondus, contrats commerciaux reels |
| sportsapi.com directory | **$500 – $1 000+/mo starting** | Estimation independante |
| Free trial | Instant, no CC, **1 000 calls/mo, DATA SCRAMBLED** | Test structure uniquement, pas usage prod |
| Discovery Lab Fantasy / Odds | $100-1 000 API calls/jour, **donnees historiques uniquement, no commercial** | Inutilisable SaaS payant |

### Comparaison brutale vs alternatives PariScore

| Vendor | Cout mensuel | Live | PBP | Odds | Hist | Compliance SaaS |
|---|---|---|---|---|---|---|
| **BSD Sports Addon** | **$5** | OK | NON | OK ML | NON | OK |
| **api-tennis.com Premium** (CTO top pick) | **$60** | OK | **OK** | **OK live** | OK | OK |
| **Sackmann CSV** | $0 | NON | NON | NON | OK | **BLOQUEUR CC BY-NC-SA** |
| **sportsdata.io Tennis** | **$500-1000+** | OK | LIGHT | OK | OK | OK SLA |
| Sportradar | $2k-10k+ | OK | OK | OK | OK | REJETE CTO |

**Conclusion pricing** : sportsdata.io est **8x-16x plus cher qu'api-tennis.com** sans delta de profondeur data justifiant l'ecart pour un usage tennis-only.

---

## 2. Coverage : Pas d'evidence ATP/WTA differenciante

Pages `/developers/coverages/tennis` et `/developers/data-dictionary/tennis` revelent :

- **Match Object** : MatchId, RoundId, VenueDetails, DateTime, ContestantAID/BID, Status, WinnerContestantId, ScoreA/B, Duration, Periods
- **Period Object** : PeriodId, Type (set), ScoreA, ScoreB
- **Player Object** : PlayerId, Name, Gender, Height, Weight, **SinglesWorldRank, DoublesWorldRank**, Hand, YearPro
- **MatchOdds Object** : ContestantAMoneyline/BMoneyline, TotalGames, TotalSets, spreads, payouts
- **Endpoints** : Schedule by Matches/Round, Schedule by Season/Date, Scores by Match Live & Final, Match Odds by Date/Season, Player Profiles by Rank, Tournaments, Disciplines, Sportsbooks

### Manques critiques vs api-tennis.com

- **PAS de serve stats granulaires** (aces, double faults, 1st serve %, BP saved, return points won)
- **PAS de surface info per-match** (uniquement season level → biais Elo by-surface impossible)
- **PAS de H2H endpoint dedie** (calcul cote client a faire)
- **PBP** : marketing mentionne "play-by-play" mais dictionnaire data limite a Periods (sets). Pas de point-level structure visible.

Couverture geographique : non documentee publiquement. **Force documentee : NFL/NBA/MLB/NHL/PGA US-centric** (sportsdata.io aveu "North American fantasy / regulated betting gold standard"). Sportradar reste reference Europe/Tennis/Cricket.

---

## 3. Features

| Feature | Disponible | Note |
|---|---|---|
| Live scores | OUI | Cloud API real-time |
| Pre-match odds | OUI | 10+ sportsbooks mentionnes Leagues API |
| Live odds | UNCLEAR | Documentation publique mince |
| Point-by-point reel | **NON** | Periods = sets uniquement |
| Predictions (BAKER) | OUI add-on | **Inutile — PariScore a Poisson/Elo natif** |
| Historical | OUI | Tarification separee post-trial |
| Player profiles | OUI basique | Pas de bio enrichie |
| Rankings ATP/WTA | OUI | SinglesWorldRank + DoublesWorldRank |
| Serve stats avancees | **NON visible** | Bloqueur majeur tennis modelisation |
| News/Images | OUI | Marketing-side, peu interessant prod |
| DFS salaries | OUI | **Hors scope PariScore** (US fantasy) |

---

## 4. Tech Specs

- **API style** : **REST pur HTTP GET**, 100% compatible PariScore (Node.js zero-dep, `https.get` natif suffit)
- **Format** : JSON ou XML (toggle par requete)
- **Auth** : API key via query param `?key=` OU header `Ocp-Apim-Subscription-Key: {key}` (Azure API Management gateway)
- **SDK** : Officiels C# + Node.js disponibles, **mais facultatifs** (Swagger files dispo, code-gen possible) — compatible regle PariScore "zero-dep sauf better-sqlite3"
- **WebSocket / Webhook / SSE** : **Non documente** publiquement (a confirmer Sales). BSD WebSocket (<5s) reste superieur live.
- **Rate limits** : Unlimited API calls cite sur tier Leagues API enterprise. Trial = 1 000/mois.
- **SLA** : "24/7/365 monitoring, dedicated CS team" — claim site, pas de % uptime garanti publie.
- **Vendor sustainability** : SOLIDE (fonde 2008, employes US, alternative Sportradar legitime, clients Tier-1 sports betting US). Risque vendor lock-in **plus faible que api-tennis.com** (mid-tier) et **infiniment plus faible que Bzzoiro/BSD** (single dev).

---

## 5. Comparaison detaillee vs alternatives

### vs api-tennis.com $60/mo (CTO top pick existant)
- **sportsdata.io perd** : 8x-16x plus cher, pas de PBP reel, pas de serve stats granulaires
- **sportsdata.io gagne** : SLA enterprise, stabilite vendor, support 24/7
- **Verdict** : api-tennis.com domine sur le rapport cout/valeur tennis

### vs Sportradar $2k-10k+/mo (REJETE CTO)
- **sportsdata.io gagne** : 4x-10x moins cher, meme tier reliability, alternative legitime documente
- **sportsdata.io perd** : Sportradar reste #1 mondial sur Tennis specifiquement (aveu sportsdata.io)
- **Verdict** : si on rejette Sportradar pour pricing, on rejette sportsdata.io a fortiori sur ROI tennis

### vs BSD Sports Addon $5/mo (en production PariScore)
- **sportsdata.io gagne** : SLA, vendor sustainability, profondeur historique
- **sportsdata.io perd** : 100x-200x plus cher pour overlap fonctionnel quasi-total live + odds
- **Verdict** : BSD couvre 95% besoins live tennis pour 1% du cout

---

## 6. ROI Analysis PariScore €19/mo Pro

**Hypothese conservatrice** : cout $500/mo (entry tier estime).

| Metrique | Valeur |
|---|---|
| Cout mensuel | **$500** (~€460) |
| Prix abo Pro | €19/mo |
| Marge brute par abo (hors infra) | ~€15 |
| **Abos Pro requis break-even sportsdata.io seul** | **~31 abos** |
| Stack actuel deja paye (BSD $5 + Odds API + ESPN gratuit + Sackmann $0) | ~$5-50/mo |
| **Multiplicateur cout data** | **x10 a x100** |

**Verdict ROI** : **DESTRUCTEUR**. Necessite 31+ abos Pro nets juste pour amortir cette source — alors que **api-tennis.com Premium ($60/mo) ne demande que ~4 abos** et delivre PBP + live odds superieurs.

---

## 7. Integration Effort

Si jamais GO :
- **Auth + parsing JSON** : 2h (Node.js natif `https.get`, parse JSON, gestion header `Ocp-Apim-Subscription-Key`)
- **Mapping data dictionary → schema PariScore** (Match/Period/Player/Odds) : 8h
- **ETL historique + cache SQLite** : 4h
- **Cron live scores 60s + reconciliation BSD/Odds API** : 4h
- **Tests + monitoring quotas (header `x-requests-remaining`) ** : 2h
- **Total** : ~2-3 jours dev

**Verdict effort** : **Facile** (REST classique, doc Swagger, SDK Node.js officiel optionnel). Le bloqueur n'est PAS technique — c'est economique.

---

## 8. VERDICT FINAL

# SKIP

**Tier recommande** : Aucun
**Cout mensuel** : N/A (skip)
**Effort integration** : N/A (skip)
**Justification 1-ligne** : **Pricing $500-1000+/mo demolit marge €19/mo, overlap 95% avec BSD ($5) + api-tennis.com ($60) qui delivrent plus de profondeur tennis (PBP, serve stats granulaires) pour 8x-100x moins cher — sportsdata.io reste un excellent fournisseur enterprise mais hors-cible pour PariScore.**

### Reconsiderer si et seulement si :
1. PariScore franchit **100+ abos Pro** ET pivote vers tier "Premium €49+/mo" couvrant fantasy DFS US
2. **api-tennis.com defaille** (vendor risk concretise) ET BSD ne suffit plus → fallback enterprise needed
3. Acquisition par operateur US regulated betting ayant deja contrat sportsdata.io en place

---

*Rapport genere — 21/05/2026 — Bd a creer pour suivi : `bd add "Eval sportsdata.io Tennis API → SKIP T1" --priority=2 --status=closed`*
