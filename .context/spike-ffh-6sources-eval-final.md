# SPIKE FINAL — bd `ffh` : 6 sources sport data foot

> **Date** : 22 mai 2026
> **Bd** : `ffh` (P2 spike) — sister `b3s` (4 autres sources DBs)
> **Statut** : eval read-only complete — recommandation prete pour decision DG
> **Sources evaluees** : Transfermarkt, FBref, Sofascore, Fotmob, The Analyst (Stats Perform Opta), xvalue.ai
> **Spikes parents consultes** : `etude-transfermarkt-vs-stack-actuel-2026.md` (TM voie D Apify), `etude-soccerdata-fbref.md` (FBref via soccerdata Python), `spike_odds_alternatives.md` + `spike-bjv-rapidapi-eval-final.md`

---

## 1. RESUME EXECUTIF

**1 GO ferme** : **xvalue.ai** (Soccerment) — seule source 6 a fournir une API REST publique commerciale avec free trial, xG avance + scouting clustering ML, 30 ligues, sans CF wall ni risque ToS. **POC 1j gratuit**, validation coverage vs BSD, puis decision $.

**1 GO conditionnel deja arbitre** : **Transfermarkt voie D (Apify curious_coder $15/mo)** — recommande dans `etude-transfermarkt-vs-stack-actuel-2026.md` si "Fiche Quant joueur" devient priorite produit. **Pas une nouvelle decision** dans ce spike, simplement confirmation arbitrage existant.

**4 NO-GO** : **FBref** (deja spike `8lqf` scaffolded Python microservice, latence post-match 1-2h incompatible runtime live, attente roadmap Bayesian P0/P1), **Sofascore** (deja couvert par BSD microservice live + soccerdata wrapper si besoin, redondant), **Fotmob** (lib JS wrapper inactif "based on old library no longer operational", undocumented endpoints fragiles, ToS scraping incertain), **The Analyst Stats Perform Opta** (enterprise B2B, custom MLA, prix non-publie mais estim. $10k-100k+/an + $500/1M API calls supplementaires, hors budget PariScore SaaS €19/mo).

---

## 2. SCORING TABLE 6 sources × 4 axes (/25 chacun, total /100)

| Source | Legal /25 | Technique /25 | Coverage utile /25 | ROI vs effort /25 | **Total /100** | Verdict |
|---|---|---|---|---|---|---|
| **xvalue.ai** | 25 (API REST officielle commerciale) | 22 (API HTTP simple, CSV export, auth standard) | 18 (xG + advanced metrics, clustering ML, 30 ligues) | 20 (free trial 1j POC, pricing on demand mais raisonnable startup) | **85 GO** | ✅ POC immediat |
| Transfermarkt (Apify D) | 18 (TM ToS hostile mais Apify gere proxies/CF) | 18 (HTTP run-sync, output generique parse maison) | 15 (valeur marchande series temps, fee transferts, blessures historique — pertinent SI Fiche Quant) | 14 ($15/mo + usage couplage Apify) | **65 GO conditionnel** | deja arbitre etude TM |
| FBref (soccerdata Python) | 15 (TOS Sports-Reference non-explicite SaaS commercial, scraping public toléré) | 14 (lib mature mais necessite microservice Python = stack hybride) | 22 (Opta-grade xG/PSxG/passing networks, > BSD profondeur) | 12 (1-2j POC + 6-8h batch nocturne, latence post-match 1-2h) | **63 defer P1 roadmap** | deja spike `8lqf` |
| Sofascore (wrappers) | 12 (ToS scraping interdit, Apify ou stealth) | 16 (multiple wrappers Python/PHP/JS, sofascore-wrapper 1.0.4) | 15 (deja couvert par BSD live + ratings post-match) | 10 (redondant BSD, effort 2-3j refacto pour gain marginal) | **53 NO-GO** | deja BSD primaire |
| Fotmob (wrappers undoc) | 10 (no official API, scraping endpoints undoc, ToS gris) | 8 (roimee6/fotmob "old library no longer operational", venkatramanareddy/fotmoby + fotmob-api PyPI, fragiles) | 14 (xG + 500+ leagues + lineups + momentum partiellement) | 8 (maintenance haute, breakage risk, doublon BSD/Sofa) | **40 NO-GO** | non maintenu |
| The Analyst (Opta SP) | 25 (commercial license MLA) | 20 (REST + push feeds, doc enterprise) | 25 (gold standard industrie, profondeur Opta complete) | **5 (pricing $10k-100k+/an minimum + $500/1M calls — hors budget €19/mo SaaS)** | **75 NO-GO budget** | revisit si revenue >$10k/mo |

---

## 3. DETAIL PAR SOURCE

### 3.1 ✅ xvalue.ai (Soccerment) — **GO**
- **URL** : https://xvalue.ai/ (FAQ https://xvalue.ai/faq)
- **Produit** : plateforme analytics fonde par Soccerment (cabinet italien football analytics, partenaires clubs Serie A)
- **Data** : xG avance, advanced metrics player/team season/match, **clustering ML pour profils joueurs** (unique vs autres sources), CSV export, **Scouting API service**, Generative AI rapports automatises
- **Coverage** : **30 ligues** (FAQ confirme) — moins large que FBref (50+) mais cible Big 5 + secondaires Europe
- **API** : REST publique, "simple API call", auth standard
- **Pricing** : "**contact support team**" mais **free trial offert** (acces complet features) → POC gratuit possible avant decision $
- **ToS / Legal** : commercial license officielle, B2B-friendly, **aucun risque scraping**
- **Cloudflare** : N/A (API directe, pas scraping)
- **Statut PariScore** : **jamais evalue** dans ce projet (nouvelle source pour ce spike)
- **Apports vs stack actuel** : compense BSD profondeur xG basique avec Opta-like advanced metrics + scouting ML utilisable pour ranking joueurs Player Props futur (cf. roadmap Rotowire benchmark bd `gz7s`)

### 3.2 ⚠ Transfermarkt — **deja arbitre etude TM, voie D Apify si Fiche Quant priorise**
- Recoupage detaille dans `etude-transfermarkt-vs-stack-actuel-2026.md` (2026-05-19)
- Voie D = Apify `curious_coder/transfermarkt` $15/mo + usage, preserve zero-dep, anti-bot delegue
- Apport vs stack : **valeur marchande serie temps + fee transferts + historique blessures carriere** (BSD/AF n'ont que scalaires courants)
- Decision DG en attente — pas reouvert ici

### 3.3 ⏸ FBref via soccerdata Python — **defer P1 roadmap (deja spike `8lqf`)**
- Recoupage detaille dans `etude-soccerdata-fbref.md` (2026-05-13)
- Pattern B batch nocturne 6-8h recommande (cron Python → JSON load Node.js)
- Latence post-match 1-2h **incompatible runtime live** (use case Bayesian Value Radar P0/P1 uniquement)
- Apport : profondeur Opta-grade (xG/PSxG/passing networks/defensive actions)
- TOS Sports-Reference gris pour SaaS commercial → relecture obligatoire avant prod

### 3.4 ❌ Sofascore — **NO-GO redondant**
- **Deja couvert** par BSD microservice live (`Sofa lineups + xG live + shotmap + possession`)
- Wrappers Python disponibles (sofascore-wrapper 1.0.4, apdmatos/sofascore-api swagger, devsmith88 PHP SDK) mais effort 2-3j refacto pour gain marginal vs BSD
- ToS Sofascore interdit scraping (necessite Apify ou stealth)
- **Verdict** : skip — BSD primaire suffit, fallback wrapper post-match si BSD down (out of scope)

### 3.5 ❌ Fotmob — **NO-GO non maintenu**
- **Pas d'API officielle**, scraping endpoints undocumented
- Wrappers communautaires :
  - `roimee6/fotmob` (JS) — **README explicite "based on an old library that is no longer operational and no longer maintained"** → red flag
  - `venkatramanareddy/fotmoby` (Python) — 7 commits, faible activite
  - `fotmob-api` PyPI / `pyfotmob` PyPI — undocumented, breakage risk
- Coverage potentielle : xG + 500+ leagues + lineups + momentum (mobile-first)
- **Verdict** : trop fragile pour SaaS commercial. Si besoin coverage etendu post-match, **FBref via soccerdata fait mieux** (lib mature + multi-sources). Skip.

### 3.6 ❌ The Analyst (Stats Perform Opta) — **NO-GO budget**
- **Gold standard industrie** (data utilisee par broadcasters, ESPN, bookmakers majeurs)
- Coverage parfaite : xG/xA/PSxG/event-level granular/play-by-play/lineup/injuries/transfers/odds
- **Pricing** :
  - Couvre jusqu'a 5M API calls/mois en base
  - **$500/1M API calls supplementaires** (overage)
  - Pas de tier public — custom MLA via sales team
  - **Estimation marche** : entry-level betting platform = $10k-100k+/an (FAQ Stats Perform mentionne "tailored licensing" + "scalable, high-quality data" pour "betting platforms")
- **Verdict** : hors budget PariScore SaaS €19/mo Pro. Revisit si revenue >$10k/mo et besoin gold-standard pour API publique payante.

---

## 4. RECOMMANDATION FINALE PRIORISEE

### Top 1 : GO ferme **xvalue.ai POC 1 jour gratuit**
- Inscription free trial → exploration API + coverage 30 ligues + sample CSV xG/advanced metrics
- Mesurer divergence xG xvalue vs xG BSD sur 30 matchs Big 5 (memo methodologie validee `etude-soccerdata-fbref.md` §10)
- Decision GO/NO-GO commercial apres POC (pricing on demand a obtenir)
- **Differenciation produit** : clustering ML scouting unique vs FBref/BSD → futur "Fiche Quant joueur" + Player Props (recoupe roadmap Rotowire `gz7s` + Fiche Quant CLAUDE.md)

### Top 2 (deja arbitre) : Transfermarkt voie D Apify SI Fiche Quant priorisee
- Voie D `curious_coder/transfermarkt` $15/mo + usage
- Couplage avec xvalue.ai = pile complete Fiche Quant (xvalue scouting metrics + TM valeur marchande historique + blessures)

### Defers
- **FBref soccerdata** → roadmap P1 Bayesian Value Radar
- **Sofascore wrappers** → standby fallback BSD down
- **Fotmob** → reject definitif (non maintenu)
- **The Analyst Opta** → revisit post-monetisation $10k/mo MRR

---

## 5. PLAN D'IMPLEMENTATION TOP 1 (xvalue.ai POC) — 4 etapes

| Phase | Action | Effort |
|---|---|---|
| **1. Inscription free trial** | xvalue.ai signup, recuperer API key, lire docs Scouting API | 30 min |
| **2. POC offline notebook** | Script Node ou Python : pull 30 matchs Big 5 saison 2025-26 → CSV → compare xG xvalue vs xG BSD (deja stocke `db.advancedTeamStats`) | 4-6h |
| **3. Rapport divergence** | Calculer correlation xG sources, taux match-up 30+ matchs, sample queries scouting clustering (Top 10 joueurs xG par cluster) | 2-3h |
| **4. Decision DG pricing** | Si POC concluant (correlation >0.85, scouting metrics inedits utiles), demander pricing officiel xvalue, arbitrer budget DG, decider integration prod ou non | DG only |

**Effort total POC** : **~1 jour dev**, zero cost (free trial), zero risque code prod (offline analysis).

---

## 6. COUT / EFFORT / RISQUES

| Source | Cout/mois | Effort POC | Effort prod si GO | Risque principal |
|---|---|---|---|---|
| **xvalue.ai** | $0 trial → TBD (pricing on demand, estim. $50-300/mo SaaS startup tier) | 1j POC gratuit | 2-3j (REST integration + cache 24h + UI badge source) | Pricing inconnu — possible blocker budget si >$300/mo |
| Transfermarkt Apify D | $15 + usage | 2-3h test | 3-5j (parser per page type + cache 24h + Fiche Quant UI) | Couplage Apify, parsing brittle |
| FBref soccerdata | $0 | 1-2j POC | 1-2j Pattern B batch | TOS gris SaaS commercial |
| Sofascore wrapper | $0 | 4h test | 2-3j refacto | Redondant BSD, ToS interdit |
| Fotmob wrappers | $0 | 2h test | n/a | Non maintenu, breakage |
| The Analyst Opta | $10k-100k+/an | n/a | n/a | Hors budget |

---

## 7. SOURCES UTILISEES

- `etude-transfermarkt-vs-stack-actuel-2026.md` (2026-05-19) — arbitrage TM voies A/B/C/D
- `etude-soccerdata-fbref.md` (2026-05-13) — spike FBref + 9 sources via soccerdata Python (bd `8lqf`)
- `spike_odds_alternatives.md` (2026-05-21) — Polymarket/Kalshi/Pinnacle eval
- `spike-bjv-rapidapi-eval-final.md` (2026-05-22) — RapidAPI odds-api1
- WebSearch `Fotmob API access scraping unofficial endpoints 2026` — confirme libs communautaires + breakage risk
- WebSearch `Stats Perform Opta API pricing commercial license` — confirme MLA enterprise + $500/1M overage
- WebSearch `xvalue.ai football betting data API pricing` — confirme free trial + Scouting API
- WebSearch `xvalue.ai coverage leagues data type free trial scouting api` — confirme 30 leagues + GenAI scouting
- WebSearch `Sofascore unofficial API wrapper github 2026` — 10+ wrappers Python/PHP/JS

---

## 8. DECISION DG ATTENDUE

1. **GO POC xvalue.ai 1j** (zero cout free trial) ? — recommande fortement, ROI potentiel eleve
2. **Defer FBref + Transfermarkt** jusqu'a roadmap P0/P1 priorisee ?
3. **Reject definitif Fotmob + Sofascore + Opta** ?

bd `ffh` reste `open` jusqu'a decision DG. Pas de code prod touche pendant spike.

---

*Spike read-only execute en worktree isole branch `agent-ae51419560f809c63`. Aucune modification server.js / pariscore.html / odds-rapidapi.js.*
*Livrable unique : ce fichier `.context/spike-ffh-6sources-eval-final.md`.*
