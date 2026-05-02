# 📊 Étude de Marché APIs Football — PariScore 2026
## Analyse Comparative & Plan d'Infrastructure pour 100 Utilisateurs

---

## 🎯 CONTEXTE

PariScore est une plateforme d'analyse de paris sportifs avec:
- **Modèle actuel**: Freemium (1/jour) → Matchday Pass (5/24h €4.99) → Premium (illimité €9.99/mo)
- **Objectif**: 100 membres actifs (mix freemium/premium)
- **Besoin**: Données football fiables, standings, cotes, stats avancées, xG, live scores
- **Problème actuel**: API-Football plan gratuit = 100 req/jour (quota épuisé en 2h)

---

## 📋 COMPARATIF DES APIs FOOTBALL (Mai 2026)

### 🏆 1. BSD — Bzzoiro Sports Data (RECOMMANDÉ)

| Critère | Détail |
|---------|--------|
| **Prix** | **100% GRATUIT** — pas de plan payant |
| **Rate Limits** | **AUCUN** — requêtes illimitées |
| **Ligues** | 47+ (top européennes + internationales) |
| **Données** | Live scores, standings, fixtures, odds 15+ bookmakers, xG, shot maps, lineups, injuries, ML predictions (CatBoost v5.0), managers, player stats 30+ champs, heatmaps |
| **Historique** | 15 ans (61,826+ matchs) |
| **Uptime** | 99.9% (BetterUptime monitoring) |
| **Cache** | 2 min (events), 5 min (leagues/teams), 30s (live) |
| **Auth** | Token-based (free registration) |
| **Format** | JSON RESTful, Swagger/OpenAPI docs |
| **Trafic réel** | 150K-740K req/jour, ~100-135 utilisateurs uniques/jour |
| **Support** | Discord communautaire, email dev |
| **Sponsor** | $12/an pour sponsoriser une ligue, $29 pour en importer une |
| **Limite** | Pas de ligues mineures (T2 hors Europe), pas de basketball/MMA (mais tennis/CS2 dispo) |

**⚡ Points forts:**
- Seul API gratuit sans rate limits du marché
- ML predictions intégrées (86% accuracy Over 1.5, 80% Over 2.5, 82% BTTS)
- Données spatiales (shot maps xG, momentum graphs, average positions)
- Multi-bookmaker odds (15+ bookmakers) inclus gratuitement
- Coach profiles avec tactical fingerprint

---

### 2. API-Football (API-Sports.io) — ACTUEL

| Critère | Détail |
|---------|--------|
| **Prix** | Gratuit: 100 req/jour |
| **Rate Limits** | 100 req/jour (free) → $19/mo (10K/j), $39/mo (30K/j), $79/mo (100K/j) |
| **Ligues** | 800+ (couverture mondiale) |
| **Données** | Standings, fixtures, live scores, predictions, odds (paid), injuries, lineups |
| **Historique** | 10+ ans (payant) |
| **Problème** | Quota épuisé en 2h avec 100 utilisateurs |

**❌ Points faibles:**
- Plan gratuit trop limité pour une production
- Odds = feature payante
- Pas de xG/shot maps gratuits
- Saison 2025 parfois inaccessible sur plan gratuit

---

### 3. SportMonks

| Critère | Détail |
|---------|--------|
| **Prix** | $20/mo (Basic), $50/mo (Plus), $100+/mo (Pro) |
| **Rate Limits** | Tier-based (varie par plan) |
| **Ligues** | 1500+ |
| **Données** | Très complet: livescores, standings, stats, players, transfers, odds |
| **Historique** | 10+ ans (payant) |
| **Support** | Email, documentation complète |

**❌ Points faibles:**
- $20-100+/mo minimum
- Fonctionnalités avancées réservées aux plans chers
- Pas de ML predictions

---

### 4. football-data.org

| Critère | Détail |
|---------|--------|
| **Prix** | Gratuit (12 ligues) → €10/mo (30 ligues) |
| **Rate Limits** | 10 req/min (free) |
| **Ligues** | 12 gratuites, 30+ payantes |
| **Données** | Basic: standings, fixtures, teams, players, live scores |
| **Historique** | 4 ans (free) |

**❌ Points faibles:**
- Couverture limitée sur plan gratuit
- Pas de cotes bookmakers
- Pas de xG, shot maps, ML predictions
- Pas de données avancées

---

### 5. SoccerDataAPI (StatPal)

| Critère | Détail |
|---------|--------|
| **Prix** | Gratuit: 75 req/jour → $14/mo (25K/j), $29/mo (150K/j), $79/mo (500K/j) |
| **Rate Limits** | 75/jour (free) |
| **Ligues** | 125+ |
| **Données** | Live scores, standings, lineups, injuries, AI match previews, weather, white label odds |
| **Historique** | 7 ans |

**❌ Points faibles:**
- 75 req/jour = très limité pour 100 utilisateurs
- AI previews = marketing, pas aussi bon que CatBoost BSD
- Odds = white label (pas de comparaison multi-bookmaker)

---

### 6. SportSRC V2

| Critère | Détail |
|---------|--------|
| **Prix** | Gratuit: 1000 req/jour → Business (100K+/j) |
| **Rate Limits** | 1000/jour (free) |
| **Ligues** | Major leagues |
| **Données** | Live scores, standings, odds (premium), shotmaps (premium), lineups, xG |
| **Spécifique** | Stream embeds (monétisé via ads) |

**❌ Points faibles:**
- Deep Data = payant
- Odds/shotmaps = premium uniquement
- Stream embeds avec pubs intrusives

---

## 💰 PLAN MENSUEL VIABLE POUR 100 MEMBRES

### Architecture Recommandée: BSD + The Odds API (fallback)

#### Coût Mensuel Estimé:

| Service | Coût/mois | Usage |
|---------|-----------|-------|
| **BSD Football** | **€0** | Standings, fixtures, stats, xG, live scores, ML predictions, managers, players |
| **BSD Tennis** | **€0** | Optionnel (si expansion tennis) |
| **BSD CS2** | **€0** | Optionnel (si expansion esports) |
| **The Odds API** | **€0** | Cotes complémentaires (free tier: 500 req/jour) |
| **Gemini AI** | **~€5-15** | Power Score analyses (API key gratuite avec limites) |
| **Hébergement (Render)** | **~€7-15** | Starter plan ($7/mo) ou Pro ($15/mo) |
| **Nom de domaine** | **~€1-2** | ~€12-24/an |
| **Stripe (frais)** | **1.5% + €0.25** | Par transaction (standard) |
| **TOTAL** | **~€13-32/mois** | **Pour 100 membres** |

---

### 📈 Modèle Économique Projections (100 membres)

#### Répartition des utilisateurs estimée:
- **Freemium (60%)**: 60 utilisateurs → 1 Power Score/jour = 60/jour
- **Matchday Pass (20%)**: 20 utilisateurs → 5 Power Score/jour = 100/jour (€4.99/24h)
- **Premium (20%)**: 20 utilisateurs → illimité → ~200/jour estimés (€9.99/mo)

#### Revenus Mensuels Estimés:
| Source | Calcul | Montant/mois |
|--------|--------|--------------|
| Matchday Pass | 20 users × €4.99 × ~8 passages/mois | ~€798 |
| Premium | 20 users × €9.99/mois | ~€200 |
| Affiliation (CPA) | 10 inscriptions bookmaker × €30 CPA | ~€300 |
| **TOTAL REVENUS** | | **~€1,298/mois** |

#### Coûts Mensuels:
| Poste | Montant/mois |
|-------|--------------|
| API (BSD) | €0 |
| API (Odds API) | €0 (free tier) |
| Gemini AI | €10 |
| Hébergement Render | €15 |
| Nom de domaine | €2 |
| Stripe fees (~2.9%) | €38 |
| **TOTAL COÛTS** | **~€65/mois** |

#### Marge Nette:
- **Revenus**: €1,298
- **Coûts**: €65
- **Marge**: **€1,233/mois (95%)**

---

## 🔍 ANALYSE DE RISQUE BSD

### ✅ Points Positifs
1. **Gratuité permanente**: "Free forever" — pas de risque de passage au payant
2. **Pas de rate limits**: Pas de quota à gérer, pas de surprise
3. **Données premium**: xG, shot maps, ML predictions inclus gratuitement
4. **Communauté active**: Discord, dev responsive
5. **Transparence**: Stats publiques (150K-740K req/jour, ~100-135 users/jour)
6. **Multi-sport**: Football + Tennis + CS2 avec même API key
7. **Sponsorisation optionnelle**: $12/an pour supporter une ligue (optional)

### ⚠️ Risques Identifiés
1. **Projet communautaire**: Dépend du développeur unique (bzzoiro@proton.me)
2. **Pas de SLA garanti**: Pas de contrat de service payant
3. **47 ligues**: Suffisant pour PariScore mais pas de ligues ultra-mineures
4. **Pas de support entreprise**: Communauté Discord uniquement

### 🛡️ Atténuation des Risques
1. **Fallback API-Football**: Déjà implémenté dans le code (pour ligues non couvertes)
2. **Cache local**: Données cachées 12h dans SQLite → tolérance aux pannes
3. **Mode démo**: 20 matchs démo si toutes les APIs down
4. **Monitoring**: BetterUptime public (bzzoiro.betteruptime.com)

---

## 📊 BENCHMARK COMPÉTITEURS PARISCORE

### Datafoot.fr (modèle de référence)
| Critère | Datafoot | PariScore |
|---------|----------|-----------|
| **API principale** | Probablement API-Football/SportMonks | **BSD (gratuit)** |
| **Coût API estimé** | €50-100/mois | **€0** |
| **ML predictions** | Probablement custom | **CatBoost v5.0 intégré** |
| **Transparence affiliation** | Non mentionné | **Toggle settings (OddAlerts style)** |
| **Modèle économique** | CPA inversé + partenariats | CPA + Premium + Matchday Pass |
| **Backtesting** | Non connu | **Rolling 30 + per-league + confidence tiers** |

### OddAlerts.com
| Critère | OddAlerts | PariScore |
|---------|-----------|-----------|
| **API** | Propriétaire (probablement payante) | **BSD (gratuit)** |
| **Odds comparison** | Oui (multi-bookmaker) | **Oui (15+ bookmakers BSD)** |
| **Value bets** | Oui | **Oui (Poisson + Edge detection)** |
| **Transparence affiliation** | Clean links toggle | **Clean links toggle** |
| **ML predictions** | Probablement | **CatBoost v5.0 (86% accuracy)** |

### Bettingexpert.com
| Critère | Bettingexpert | PariScore |
|---------|---------------|-----------|
| **Modèle** | Tipster community | **AI-powered analysis** |
| **API** | Custom | **BSD (gratuit)** |
| **Social proof** | Oui (tipsters publics) | **Hero accuracy badge** |
| **Monetization** | Ads + affiliations | CPA + Premium + Matchday Pass |

---

## 🏁 RECOMMANDATION FINALE

### ✅ BSD est la solution optimale pour PariScore

**Pour 100 membres, le coût API est de €0/mois avec BSD.**

#### Plan d'Action:
1. **Immédiat**: Utiliser BSD comme source principale (implémenté ✅)
2. **Fallback**: API-Football pour ligues non couvertes (~15 ligues T2)
3. **Cache**: SQLite 12h pour tolérance aux pannes (existant ✅)
4. **Monitoring**: Surveiller bzzoiro.betteruptime.com
5. **Sponsor**: Optionnel — $12/an pour supporter Ligue 1 ou autre ligue
6. **Expansion**: Tennis/CS2 via même API key si besoin

#### Économie vs Alternatives:
| Solution | Coût/an | Économie vs BSD |
|----------|---------|-----------------|
| **BSD** | **€0** | **-** |
| API-Football Pro ($39/mo) | €468 | €468/an |
| SportMonks Plus ($50/mo) | €600 | €600/an |
| SportMonks Pro ($100/mo) | €1,200 | €1,200/an |
| Multi-API (BSD + SportMonks) | €600-1200 | €600-1200/an |

---

## 📌 NOTES COMPLÉMENTAIRES

### BSD Coverage — Ligues Disponibles vs PariScore
| Ligue PariScore | BSD ID | Couverture BSD |
|-----------------|--------|----------------|
| Premier League | 1 | ✅ |
| La Liga | 3 | ✅ |
| Serie A | 4 | ✅ |
| Bundesliga | 5 | ✅ |
| Ligue 1 | 6 | ✅ |
| Champions League | 7 | ✅ |
| Europa League | 8 | ✅ |
| Eredivisie | 10 | ✅ |
| Championship | 12 | ✅ |
| Scottish Premiership | 13 | ✅ |
| Jupiler Pro League | 14 | ✅ |
| Super League (Suisse) | 15 | ✅ |
| Saudi Pro League | 17 | ✅ |
| MLS | 18 | ✅ |
| Liga MX | 19/20 | ✅ |
| Super League (Grèce) | 24 | ✅ |
| Allsvenskan | 26 | ✅ |
| World Cup 2026 | 27 | ✅ |
| Segunda División | 38 | ✅ |
| Liga Portugal | 2 | ✅ |
| Brasileirão | 9 | ✅ |
| J1 League | 49 | ✅ |
| K League 1 | 50 | ✅ |
| Süper Lig | 11 | ✅ |
| **Ligue 2** | ❌ | **Fallback API-Football** |
| **2. Bundesliga** | ❌ | **Fallback API-Football** |
| **Serie B** | ❌ | **Fallback API-Football** |
| Autres T2 | ❌ | **Fallback API-Football** |

### BSD Stats d'Utilisation (Avril 2026)
- **Moyenne quotidienne**: 211K-740K requêtes/jour
- **Utilisateurs uniques**: 100-135/jour
- **Tendance**: Stable avec pics le week-end
- **Fiabilité**: 99.9% uptime (BetterUptime)

### ML Predictions BSD — Performance
| Marché | Accuracy | Usage PariScore |
|--------|----------|-----------------|
| Over 1.5 | 86% | Validation Poisson |
| Over 2.5 | 80% | Validation Poisson |
| BTTS | 82% | Validation Poisson |
| 1X2 | ~70% estimée | Power Score V3 |

---

## 🎯 CONCLUSION

**BSD est la solution optimale pour PariScore avec 100 membres:**
- ✅ **Coût: €0/mois** (vs €50-100/mois pour alternatives)
- ✅ **Données premium** incluses (xG, shot maps, ML predictions)
- ✅ **Pas de rate limits** — scalable sans surcoût
- ✅ **Fallback implémenté** pour ligues non couvertes
- ✅ **Marge nette estimée: 95%** (€1,233/mois avec 100 membres)

**Recommandation: Utiliser BSD comme source principale + API-Football en fallback pour les ~15 ligues T2 non couvertes.**

---

*Document généré le 1er mai 2026 — PariScore v5.12*
*Sources: sports.bzzoiro.com, api-football.com, sportmonks.com, football-data.org, soccer-api.com*
