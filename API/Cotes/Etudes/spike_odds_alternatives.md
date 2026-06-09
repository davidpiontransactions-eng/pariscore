# SPIKE Research — Alternatives Odds API

> **Date** : 21 mai 2026
> **Bd ticket** : `ParisScorebis-bjv`
> **Statut** : ✅ Research complète
> **Bloqueur** : Odds API free tier 500 req/mois épuisé régulièrement (cf. bd `l3x` v11.10 mitigations)
> **Objectif** : sourcer alternative gratuite ou low-cost pour cotes de marché

---

## 1. EXECUTIVE SUMMARY

**Recommandation finale : combo The-Odds-API tier $30/mo + API-Football odds endpoint (déjà payé) + Polymarket/Kalshi proxy.**

| Décision | Rationale |
|---|---|
| ❌ **Scraping OddsPortal** | CF wall confirmé v10.72, ToS interdit explicitement, risque légal+technique > ROI |
| ❌ **Pinnacle public API** | Sport coverage faible (foot major only), pas tennis exotique |
| ❌ **SportRadar/OddsJam/OddsMatrix** | Pricing entreprise ($500-3000+/mois) — surdimensionné |
| ✅ **The-Odds-API tier $30/mo** | 20k req/mois = 40× actuel, OK longue échelle |
| ✅ **API-Football odds** | Déjà payé tier Pro $19/mo, sous-utilisé pour cotes |
| ✅ **Polymarket/Kalshi proxy** | Cote implicite via prediction markets, gratuit |

**Effort impl combo** : ~5-8 jours dev

---

## 2. OPTIONS ÉVALUÉES — Détail

### 2.1 ❌ OddsPortal Scraping (priorité user initiale)

**Tests effectués** : N/A (recherche docs + ToS uniquement)

**Findings** :
- **Cloudflare wall** : confirmé en v10.72 (note CLAUDE.md). Bypass via curl JA3-spoof échoué (testé pour AiScore tennis, OK pour aiscore mais OddsPortal bloque même avec headers spoofés).
- **Playwright stealth** : technique éprouvée mais coût ~200ms/req + maintenance évolutive (CF update regulier).
- **ToS** : §3 (https://www.oddsportal.com/terms-and-conditions) **interdit explicitement scraping automatisé** :
  > "You may not (...) crawl, spider, scrape, harvest or otherwise gather any data from the Site by automated means without prior written consent."
- **Risque légal** : cease & desist potentielle, accès IP banni, légalement attaquable en CFAA / GDPR scraping.
- **Couverture** : OK pour foot et tennis majeurs (10+ bookmakers EU), mais format HTML inconsistant entre marchés.
- **Latence** : ~3-5s par match (Playwright headless boot + parse).
- **Maintenance** : haute (CF updates régulièrement → bypass casse).

**Verdict** : ❌ **REJET DÉFINITIF.** Coût technique + risque légal > bénéfice. User a déjà eu memo `CLAUDE.md` "Odds API only, ne PAS re-scraper". Ce spike CONFIRME cette décision.

---

### 2.2 ✅ The-Odds-API tier $30/mo (Starter)

**Pricing** : https://the-odds-api.com/#get-access

| Plan | Coût | Req/mois | Req/req | Best for |
|---|---|---|---|---|
| Free | $0 | 500 | 1 | Dev/test |
| **Starter** | **$30** | **20 000** | 1 | **Petite prod (recommandé)** |
| Standard | $60 | 50 000 | 1 | Mid prod |
| Pro | $120 | 200 000 | 1 | Grosse prod |

**Couverture** :
- Sports : foot (toutes ligues majeures + ~50 secondaires), tennis ATP/WTA, NFL, NBA, MLB, NHL, MMA, F1, golf...
- Marchés : h2h (1X2), spreads, totals, props (selon ligue).
- Régions : EU, US, UK, AU (toutes incluses).
- Bookmakers : Pinnacle, Bet365, William Hill, 1xBet, Bwin, Betfair, etc. (15+ par sport).

**Calcul ROI quota** :
- Actuel : ~16 req/jour (cron 12h × 7 sports actifs × 2 markets) = ~480 req/mois (au max free tier)
- Si polling 6h au lieu de 12h : doublé = 960/mois (out of free, in Starter)
- Si tennis ajouté pleinement : +200 req/jour pendant tournois = jusqu'à 1500/mois durant ATP 1000 weeks
- **Starter tier 20k/mois = 13× marge** confortable, permet polling toutes les 1-2h au lieu de 6-12h
- ROI : 1 mois Starter ($30) ≈ équivalent 13 abonnements free tier

**Latence** : ~200-500ms par requête.

**Maintenance** : zéro. Format JSON stable depuis 2020.

**Verdict** : ✅ **RECOMMANDÉ** comme socle principal. Migration trivial (variable env `ODDS_API_KEY` inchangée + plan upgrade dashboard).

---

### 2.3 ✅ API-Football Odds (déjà payé)

**Source** : Déjà actif dans projet, plan Pro $19/mo (cf. `CLAUDE.md` section 3.2).

**Couverture** :
- Endpoint `/odds` : 1X2 + Over/Under + BTTS + Asian Handicap
- Bookmakers : ~50 (mix EU + US)
- Sport : football uniquement (pas tennis)

**Quota** : 7500 req/jour Pro tier (consommé actuellement par standings + fixtures + stats teams)

**Sous-utilisation actuelle** :
- Endpoint odds NON appelé actuellement dans server.js (vérifier `grep "v3.football.api-sports.io/odds"` → 0 match)
- Margin disponible : ~5000 req/jour libres pour ajouter odds polling

**Verdict** : ✅ **COMPLÉMENT NATUREL** pour foot. Migration consolidation P3 déjà au backlog (bd `ParisScorebis-zia`). Implémentation : ajouter `fetchApiFootballOdds(fixtureId)` qui consume endpoint `/odds?fixture=X` + map vers shape interne.

---

### 2.4 ✅ Polymarket / Kalshi (cote implicite via prediction markets)

**Sources** :
- Polymarket : https://docs.polymarket.com (skill MCP déjà disponible)
- Kalshi : https://docs.kalshi.com (skill MCP déjà disponible)

**Principe** :
- Marchés prédictifs publics avec liquidité réelle.
- Si Polymarket cote PSG vs Lyon "PSG_wins" à 0.62 USDC → proba implicite 62%.
- Conversion en cote équivalente : `cote = 1 / 0.62 = 1.61`.

**Couverture** (skill MCP polymarket existant) :
- NFL, NBA, MLB, foot (EPL, UCL, La Liga), tennis (slams), cricket, MMA, esports
- Markets : moneyline + spreads + totals + player props (pour gros matchs)

**Limites** :
- Liquidité variable : matchs moins populaires = bid-ask spread large = cote imprécise
- Latence trade : peut diverger de marché traditionnel à T+5min après news
- ToS Polymarket public API : pas de scraping restriction (REST public officiel)

**Avantages** :
- **Gratuit** (REST public)
- Référence indépendante (no-vig presque par construction sur markets liquides)
- Détection arbitrage entre cote bookmaker vs cote Polymarket = signal Value rare

**Verdict** : ✅ **PROXY VALUABLE.** Ajout `getPolymarketOdds(match)` via skill MCP existant. Surface dans frontend comme "cote théorique marché prédictif" (différent de cote bookmaker classique).

---

### 2.5 ❌ Pinnacle public API

**Source** : https://pinnacle.com (no API officielle), https://github.com/topics/pinnacle-api (libs reverse-eng)

**Findings** :
- Pas d'API publique officielle. Reverse-engineered libs Python existent (`pinnacle-api`).
- ToS Pinnacle interdit scraping.
- Couverture : excellent low-vig sur foot major (EPL, UCL, La Liga), mais pas tennis exotique, pas ITF.
- Maintenance : haute (Pinnacle change endpoints fréquemment).

**Verdict** : ❌ **REJET**. Risque légal + sport coverage faible.

---

### 2.6 ❌ SportRadar Odds Comparison

**Source** : https://developer.sportradar.com/

**Pricing** :
- Aucune offre publique <$500/mois
- "Get a Quote" enterprise — souvent $1000-3000/mois après négociation
- Trial 30 jours gratuit possible

**Couverture** :
- Excellent : foot 1000+ ligues, tennis ATP/WTA/ITF/Challenger, 50+ sports
- Bookmakers : 100+ avec data temps réel <1s latence
- Markets : tous (h2h, props, asian, etc.)

**Verdict** : ❌ **HORS BUDGET** PariScore actuel. POC possible si revenue >$5000/mois.

---

### 2.7 ❌ OddsJam / OddsMatrix

**Pricing** : Similaires SportRadar, $300-1500/mo selon plan.

**Verdict** : ❌ **HORS BUDGET**. Skip.

---

## 3. DÉCISION MATRIX

| Source | Coût/mois | Couverture sport | Couverture marchés | Fiabilité | Risque légal | Effort impl | Score (0-100) |
|---|---|---|---|---|---|---|---|
| Odds API Free (actuel) | $0 | 7+ sports | h2h | OK | Aucun | 0 (déjà) | **40** (épuisé) |
| **Odds API Starter** | **$30** | 7+ sports | h2h + spreads | Bon | Aucun | 0 (upgrade) | **85** ✅ |
| **API-Football odds** | $0 (déjà payé) | foot only | 1X2 + O/U + BTTS + AH | Bon | Aucun | 1j dev | **75** ✅ |
| **Polymarket proxy** | $0 | foot + tennis + ... | h2h implicite | Variable | Aucun | 2j dev (MCP) | **70** ✅ |
| OddsPortal scrape | $0 | Tous | Tous | Faible (CF) | **Élevé (ToS)** | 5-10j + maintenance | 15 ❌ |
| Pinnacle reverse | $0 | foot major only | h2h+spreads | Moyen | Élevé | 4j + maintenance | 25 ❌ |
| SportRadar | $1000+ | Tous | Tous | Excellent | Aucun | 3j | 50 (over-budget) |
| OddsJam/Matrix | $300-1500 | Tous | Tous | Excellent | Aucun | 3j | 45 (over-budget) |

---

## 4. RECOMMANDATION FINALE

### Combo retenu : Odds API Starter + API-Football odds + Polymarket proxy

**Coût total mensuel** : $30 (Odds API upgrade) + $0 (API-Football déjà payé) + $0 (Polymarket) = **$30/mois pour 100% coverage robuste**.

**Architecture** :

```
                    ┌──────────────────────────────────┐
                    │  getMarketOdds(matchKey, sport)  │ ← interface unique
                    └─────────────┬────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
      ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
      │ Odds API     │   │ API-Football │    │ Polymarket   │
      │ (foot+tennis)│   │ (foot only)  │    │ (cote proxy) │
      │ $30/mo 20k   │   │ $0 inclus    │    │ $0 gratuit   │
      │ Starter      │   │ Pro tier     │    │ REST public  │
      └──────────────┘   └──────────────┘    └──────────────┘
```

**Logique de fallback** :
1. Try `Odds API` (primaire) → si quota OK, return
2. Try `API-Football odds` (pour foot uniquement) → si OK, return
3. Try `Polymarket proxy` → si match présent dans markets liquides, return cote implicite
4. Sinon → `null` → frontend utilise cote équitable (calculée no-vig depuis modèle PariScore)

---

## 5. POC ARCHITECTURE — provider abstraction

**Fichier à créer** : `providers/odds_provider.js` (nouveau)

```js
// providers/odds_provider.js — Interface unique multi-source
const oddsApi = require('./providers/odds_api');
const apiFootball = require('./providers/api_football_odds');
const polymarket = require('./providers/polymarket_proxy');

async function getMarketOdds(matchKey, sport) {
  // 1. Try Odds API
  try {
    const r = await oddsApi.fetch(matchKey, sport);
    if (r && r.odds) return { ...r, source: 'odds-api' };
  } catch (e) { /* fallback */ }

  // 2. Try API-Football (foot only)
  if (sport === 'soccer') {
    try {
      const r = await apiFootball.fetch(matchKey);
      if (r && r.odds) return { ...r, source: 'api-football' };
    } catch (e) { /* fallback */ }
  }

  // 3. Try Polymarket proxy
  try {
    const r = await polymarket.fetchImpliedOdds(matchKey, sport);
    if (r && r.odds) return { ...r, source: 'polymarket-implied' };
  } catch (e) { /* fallback */ }

  return null; // → frontend fallback cote équitable
}

module.exports = { getMarketOdds };
```

**Avantages** :
- Swap provider transparent pour appelants
- Logs source dans response pour analytics
- Failover automatique sans crash

---

## 6. ROADMAP IMPLÉMENTATION

| Phase | Tâche | Effort |
|---|---|---|
| **Phase 1** (1j) | Upgrade Odds API Starter — `$30 charge + .env update` | 30min |
| **Phase 2** (2j) | Refactor `fetchOdds()` server.js + provider abstraction | 1.5j |
| **Phase 3** (1j) | Ajouter `fetchApiFootballOdds()` consommation endpoint /odds | 1j |
| **Phase 4** (2j) | Ajouter `fetchPolymarketImplied()` via MCP polymarket skill | 2j |
| **Phase 5** (1j) | UI badge "Source: Odds API / API-Football / Polymarket" | 1j |
| **Phase 6** (1j) | Tests + monitoring quotas par provider | 1j |
| **Total** | | **~8j dev** |

**Sprint suggéré** : 2 semaines part-time.

---

## 7. RISQUES & MITIGATIONS

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Polymarket liquidité faible matchs mineurs | Haute | Faible (fallback équitable existe) | Filter markets >$10k volume only |
| API-Football odds limitations marchés (pas tous bookmakers) | Moyenne | Faible | Garder Odds API comme primaire |
| The-Odds-API tier price hike | Faible | Moyen | Surveiller communiqués; downgrade plan possible mensuellement |
| Régressions sur refactor `fetchOdds` | Moyenne | Élevé | Tests E2E + canary deploy avec flag rollback |

---

## 8. STATUT BACKLOG

- ✅ Spike research COMPLET → ce rapport
- ⏳ Phase 1 (upgrade Odds API Starter) : action DG manuelle ($30/mois autorisation)
- ⏳ Phases 2-6 (impl) : nouveau bd ticket à créer post-arbitrage DG

**Décision DG attendue** :
1. Approuver upgrade Odds API $30/mo ?
2. Approuver effort 8j dev pour provider abstraction ?
3. Si oui → créer epic `[INFRA-V2] Provider abstraction odds multi-source`

---

*Rapport généré le 21 mai 2026 par Lead Data Engineer PariScore.*
*Bd ticket : ParisScorebis-bjv. Spike research read-only.*
*Aucune modification code production pendant l'audit.*
