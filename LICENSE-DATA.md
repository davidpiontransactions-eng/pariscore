# Data Sources Licensing — PariScore

> Document de transparence légale sur les sources de données utilisées par PariScore.
> Service commercial (Pro €19/mo via Stripe) → toutes sources DOIVENT être compatibles usage commercial.
>
> Dernière mise à jour : 2026-05-24

---

## Sources actives (production)

### 1. BSD — Bzzoiro Sports Addon

- **URL** : https://sports.bzzoiro.com/
- **License** : Commercial subscription (`$5/mo Sports Addon` souscrit DG)
- **Usage** : core data sport (matches, odds, stats, predictions, lineups, shotmap, incidents, social items, referees, venues, leagues, manager, squad, fixtures). Live WebSocket push <5s pour foot Coupe du Monde 2026.
- **Coverage** : foot 49 ligues mappées (Big5 + UCL/UEL + secondaires) · tennis ATP/WTA settled + live
- **Statut commercial** : ✅ Conforme commercial
- **Backup script** : `tools/backup-tennis-matches.js` (audit trail bd 8uoc)

### 2. ESPN public endpoints

- **URL** : `https://site.api.espn.com/apis/site/v2/sports/...`
- **License** : Public unauthenticated JSON endpoints (no API key required)
- **Usage** : standings fallback ligues sans BSD coverage, tennis live secondary fallback, NFL/NBA optional
- **Coverage** : 10 ligues ESPN-only mappées (Danish Superliga, Liga Profesional Arg, Serie B Italia, Liga BetPlay Col, LigaPro Ecu, Austrian BL, Campeonato Chi, División Profesional Par, A-League Australie, Tunisian Pro)
- **Statut commercial** : ✅ Conforme (public endpoints, attribution implicite via UI)

### 3. The Odds API

- **URL** : https://api.the-odds-api.com/v4/
- **License** : Commercial API plan (free tier 500 req/mo OR paid)
- **Usage** : cotes h2h 20+ bookmakers, ligues actives, marchés 1X2/spreads/totals
- **Statut commercial** : ✅ Conforme commercial plan

### 4. API-Football

- **URL** : `https://v3.football.api-sports.io/`
- **License** : PRO plan commercial $19/mo (7500 req/jour) — actuellement DÉSACTIVÉ via kill-switch v10.77 (`AF_REMOVED=true`)
- **Usage historique** : standings home/away advanced, fixtures live, teams/statistics (xG, cartons, tirs), backtesting
- **Statut commercial** : ✅ Conforme (kill-switch actif, fallbacks BSD/ESPN/felipeall couvrent)
- **bd suivi** : `3u9` DG decision 4 questions pending

### 5. Gemini 2.0 Flash (Google AI)

- **URL** : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **License** : Pay-as-you-go commercial Google Cloud
- **Usage** : IA analyse match + AI Scout (combiné du jour), revue de presse, conversational mode
- **Statut commercial** : ✅ Conforme

### 6. openfootball (datasets foot historiques)

- **URL** : https://github.com/openfootball/football.json
- **License** : **ODbL** (Open Database License) — commercial OK avec attribution
- **Usage** : seed historique foot ETL pre-2024
- **Attribution requise** : "Data: © openfootball (ODbL)" visible dans `/about` E-E-A-T section
- **Statut commercial** : ✅ Conforme (ODbL permet commercial avec attribution + share-alike sur dérivations DB)

### 7. Wikidata

- **URL** : https://www.wikidata.org/ (SPARQL endpoint)
- **License** : **CC0 1.0** (Creative Commons Zero / Public Domain)
- **Usage** : seed historique tennis champions (Phase 2 wikidata wire — 56 winners GS livrés v12.62)
- **Attribution** : aucune obligation (CC0) mais courtoisie : "Source: Wikidata (CC0)"
- **Statut commercial** : ✅ Conforme (CC0 = libre commercial sans restrictions)

### 8. felipeall/transfermarkt-api

- **URL** : Sidecar self-hosted Python (GitHub: felipeall/transfermarkt-api)
- **License** : Code MIT, scraping transfermarkt.com (ToS gris)
- **Usage** : market values équipes/joueurs, transfers historique
- **Statut commercial** : ⚠️ Code self-host OK MIT. Data scraping transfermarkt = ToS gris (pas explicit interdit usage commercial UI affichage chiffres normalisés open knowledge)
- **Mitigation** : self-host = pas de proxy redistribution. Attribution UI "Source: Transfermarkt".

### 9. elofootball.com (community Elo ratings)

- **URL** : https://www.elofootball.com/
- **License** : Community-curated rankings, pas de ToS commercial restrictif identifié
- **Usage** : Elo historique foot (Phase 1-3 livrées v12.31-v12.40, 1902 matchs + 50 rankings)
- **Statut commercial** : ✅ Conforme (rankings = œuvre dérivée free)

### 10. aiscore.com (tennis on-demand throttled)

- **URL** : https://www.aiscore.com/
- **License** : Public site, ToS scraping non explicit interdit
- **Usage** : tennis serving fallback v12.65 — on-demand throttled (max 5/poll + cooldown 10min/miss)
- **Mitigation** : throttle agressif minimise charge, scraping HTML public pages, attribution UI implicite via badge "via aiscore"
- **Statut commercial** : ⚠️ ToS gris — auto-modération throttle + skip si bot-detected

### 11. Open-Meteo (météo)

- **URL** : `https://api.open-meteo.com/v1/forecast` + geocoding-api
- **License** : **CC-BY 4.0** (Creative Commons Attribution) — commercial OK avec attribution
- **Usage** : Context Engine météo bd cy9h (temp, précipitation, vent par match)
- **Attribution** : "Météo: Open-Meteo (CC-BY 4.0)" visible dans badge UI
- **Statut commercial** : ✅ Conforme (CC-BY permet commercial avec attribution)

### 12. Flashscore datasets (Apify one-shot)

- **URL** : https://apify.com/ datasets one-shot exports
- **License** : Apify ToS — exports = données one-shot owned par user qui a triggered le crawl
- **Usage** : 6 plans qm6a livrés (logos backup, standings fallback, live stats, livestream, venue/referee, naming audit)
- **Statut commercial** : ✅ Conforme (data ownership user via Apify subscription)

### 13. Sofascore datasets (Apify one-shot)

- **URL** : Similaire Flashscore Apify
- **License** : Apify ToS — one-shot exports
- **Usage** : 3 plans 6jro livrés (tennis player profile, editorial article, format filter)
- **Statut commercial** : ✅ Conforme

---

## Sources purgées (légalement incompatibles)

### Jeff Sackmann tennis_atp / tennis_wta — PURGE 2026-05-23

- **URL** : https://github.com/JeffSackmann/tennis_atp + tennis_wta
- **License** : **CC BY-NC-SA 4.0** (NonCommercial, ShareAlike)
- **Statut commercial** : ❌ INCOMPATIBLE (clause NonCommercial)
- **Action prise** :
  - DG decision bd `8uoc` Q1 GO purge 2026-05-23
  - Phase 1 backup snapshot livré (`tools/backup-tennis-matches.js` — 24995 rows ATP/WTA archive `tennis_matches_sackmann_pre_purge_20260523_170309.json.gz` SHA-256 `5df1ae741f78fc08e38ea2a2cc2e5bd3345d4c559995f1484f19231cb49ace26`)
  - Phase 2 sync HTTP désactivé via `SACKMANN_SYNC_DISABLED=true` (commit `dd2bb75`)
  - Phase 3 ETL replacement scaffold `tools/build-tennis-internal-history.js` livré (commit `797a064`) — `tennis_matches_internal` propriétaire BSD/ESPN
  - Phases 4-7 (refactor consumers + DROP TABLE + strip dead code + this LICENSE-DATA.md) en cours
- **Backup légal** : `archives/tennis_matches_sackmann_pre_purge_20260523_170309.json.gz` (audit trail compliance)

### TennisMyLife/TML-Database — INVALIDÉE 2026-05-23

- **URL** : https://github.com/TennisMyLife/TML-Database
- **License** : **"Non-commercial unless explicitly permitted"** (dérivé Sackmann CC-BY-NC-SA)
- **Statut commercial** : ❌ INCOMPATIBLE (même infraction NC que Sackmann)
- **Action prise** : NEVER USED. Considéré comme alternative initialement (research v2 bd `8uoc` commit `2ce9463` revendiquait MIT — VÉRIFICATION GitHub 2026-05-23 prouve faux). bd memory persisté pour future reference.

### Tennis Abstract scraper — WONTFIX 2026-05-23

- **URL** : https://www.tennisabstract.com/
- **License** : **CC BY-NC-SA 4.0** (identique Sackmann)
- **Statut commercial** : ❌ INCOMPATIBLE
- **Action prise** : bd `h6a` Tennis Abstract scraper weekly drift check closed `wontfix-legal-CC-BY-NC-SA-incompatible-commercial`. Replacement = internal Elo via bd `dl49`.

### Kaggle guillemservera/tennis — WONTFIX 2025

- **URL** : https://www.kaggle.com/datasets/guillemservera/tennis
- **License** : CC BY-NC-SA 4.0 (mirror Sackmann)
- **Statut commercial** : ❌ INCOMPATIBLE
- **Action prise** : bd `bbul` closed wontfix dès découverte license.

---

## Sources en attente DG (signups user-side)

### xvalue.ai — POC pending

- **URL** : https://xvalue.ai/
- **License** : Commercial API (free trial 1j)
- **Use case** : xG advanced + ML scouting clustering 30 ligues
- **bd suivi** : `ffh` GO ferme 85/100 (eval déjà livrée). User signup pending pour POC.

### OddsPapi.io — POC pending

- **URL** : https://oddspapi.io/
- **License** : Free tier 250 req/mo + paid plans
- **Use case** : Pinnacle sharp odds calibration (anchor low-vig pour computeWFV1N2)
- **bd suivi** : `bjv` Phase 1 RapidAPI odds-api1 NO-GO, OddsPapi alternative pending signup.

---

## Compliance checklist (mise à jour à chaque release)

- [x] Aucune source CC BY-NC-SA active en production
- [x] Backup audit trail pour sources purgées (Sackmann)
- [x] Attribution visible UI pour CC-BY sources (Open-Meteo, openfootball ODbL)
- [x] Self-host pour scraping gris (transfermarkt sidecar)
- [x] Throttle agressif pour sources ToS gris (aiscore on-demand 5/poll cooldown 10min)
- [x] Kill-switch documenté pour sources commerciales payantes (API-Football AF_REMOVED)
- [x] LICENSE-DATA.md root document maintenu (this file)

---

## Process pour ajouter nouvelle source

1. Vérifier license officielle (GitHub LICENSE file, ToS site, contact owner si ambigü)
2. Si **NC (NonCommercial)** clause présente → **NE PAS UTILISER** (PariScore = SaaS commercial)
3. Si CC-BY ou ODbL ou MIT-like → ajouter section dans Sources actives + attribution UI
4. Si commercial subscription → vérifier plan inclut redistribution dérivée (model outputs)
5. Si ToS gris (scraping) → mitigation throttle + skip si bot-detected + audit régulier
6. Mettre à jour cette LICENSE-DATA.md + commit dédié

---

## Contacts compliance

- **DG (Founder)** : david.piontransactions@gmail.com
- **BSD vendor** : bzzoiro@proton.me (renouvellement abo, ajout ligues 29$ one-time)
- **OVH VPS hosting** : `/home/ubuntu/pariscore` (FR-EU jurisdiction RGPD)

---

*Document maintenu par bd `dl49` Phase 8 — Sackmann purge legal compliance package.*
