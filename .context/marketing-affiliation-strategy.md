# 🏟️ PariScore — Stratégie Marketing & Affiliation v5.10

**Date** : 01 Mai 2026  
**Version** : 5.10  
**Statut** : Document de référence

---

## 🎯 VISION

Transformer PariScore d'un outil d'analyse technique en une **plateforme de revenus** grâce à un écosystème marketing intégré et un système d'affiliation à double flux de trésorerie.

**Objectif** : €10,000+/mois de revenus combinés (Abonnements Premium + Affiliation Bookmakers) d'ici 6 mois.

---

## 1. 📊 ÉTUDE DE MARCHÉ

### 1.1 Paysage concurrentiel
| Plateforme | Modèle | Revenu Estimé | Faiblesse |
|------------|--------|---------------|-----------|
| **OddsChecker** | Affiliation pure | $10M+/an | Pas d'IA prédictive |
| **VegasInsider** | Contenu + affiliation | $5M+/an | Interface datée |
| **Action Network** | Freemium + affiliation | $20M+/an | Marché US uniquement |
| **BetExplorer** | Données + affiliation | $2M+/an | Pas de modèle premium |
| **PariScore** | **IA + Affiliation + Premium** | **€5M+ potentiel** | À construire |

### 1.2 Modèles de commissions betting
| Modèle | Fonctionnement | Revenu PariScore | Meilleur usage |
|--------|---------------|------------------|----------------|
| **RevShare** | % des pertes nettes (NGR) du joueur | 25-50% lifetime | Long terme, SEO |
| **CPA** | Paiement fixe par premier dépôt | €50-€800/FTD | Paid traffic |
| **Hybrid** | CPA initial + RevShare continu | €100 + 20-30% | Équilibré |
| **CPL** | Paiement par lead (inscription) | €2-€10 | Acquisition masse |

---

## 2. 🚀 STRATÉGIE MARKETING

### 2.1 Skills installés
| Skill | Installs | Usage PariScore |
|-------|----------|-----------------|
| `tiktok-ads` | 667 | Vidéos virales "IA vs Bookmaker" |
| `facebook-ads` | 408 | Ciblage 25-45 ans paris sportifs |
| `seo-monitoring` | 592 | Visibilité organique long terme |
| `twilio-sms` | 685 | Alertes premium freemium→payant |
| `affiliate-marketing` | 600 | Stratégie affiliation bookmakers |
| `referral-program` | 369 | Setup programme referral |

### 2.2 Canaux d'acquisition
| Canal | Budget | Stratégie | KPI Cible |
|-------|--------|-----------|-----------|
| **TikTok Ads** | €500-1000/mois | Contenu viral Power Score | CPA €3-5, CTR 2-4% |
| **Facebook/Instagram** | €800-1500/mois | Ciblage intérêts football/analytics | CPA €4-8, CTR 1-3% |
| **SEO/Content** | €300/mois | Articles techniques Poisson/xG | Top 3 Google sur "pronostic IA" |
| **Telegram Bot** | €0 (organique) | Alertes gratuites → conversion | 500 membres/mois |
| **SMS/Twilio** | €0.05/SMS | Alertes VIP value bets | Conversion 15% freemium→premium |

### 2.3 Stratégie de contenu
*   **Hook** : "L'IA bat le bookmaker 65% du temps sur ces matchs".
*   **Preuve** : Screenshots des résultats Power Score vs Réalité.
*   **CTA** : "Accède aux données brutes via le Matchday Pass".

---

## 3. 💰 STRATÉGIE D'AFFILIATION

### 3.1 Flux A : PariScore → Bookmakers (Revenus Passifs B2B)
PariScore intègre les meilleures cotes et redirige vers les partenaires.

**Programme cible** : **1xBet Partners**
*   RevShare : 15-40% lifetime
*   CPA : Négociable (jusqu'à $200/FTD)
*   Paiement : Hebdomadaire (min $30)
*   Lien inscription : https://1x.partners/sign-up

**Autres programmes potentiels** :
| Programme | RevShare | CPA | Min Payout |
|-----------|----------|-----|------------|
| Betway Partners | Up to 75% | Custom | $100 |
| 1win Partners | 50-60% | Weekly | $70 |
| Melbet Partners | Up to 50% | $150 | $30 |
| WagerPartner | Up to 40% | Custom | $100 |

### 3.2 Flux B : Affiliés → PariScore (Scale B2C)
Recrutement de tipsters/blogueurs pour promouvoir l'abonnement Premium.

*   **Modèle** : 20% récurrent sur chaque abonnement (€2/mois par utilisateur).
*   **Outils** : Dashboard affilié, codes promo uniques, liens trackés.
*   **Cibles** : YouTubeurs pronostics, Twitter tipsters, blogs football.

### 3.3 Revenus estimés
| Source | Trafic | Conversion | Revenu/Mois |
|--------|--------|------------|-------------|
| Affiliation 1xBet | 1000 visiteurs | 2% FTD × €100 CPA | €2,000 |
| Affiliés PariScore | 10 affiliés | 50 conversions | €1,000 |
| Abonnements Premium | 500 utilisateurs | 5% conversion | €2,500 |
| **Total** | | | **€5,500/mois** |

---

## 4. 🛠️ INFRASTRUCTURE TECHNIQUE

### 4.1 Base de données
Tables créées dans `pariscore.db` (SQLite) :

**Table `affiliates`** :
```sql
CREATE TABLE affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmaker TEXT NOT NULL,
  name TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  deeplink_template TEXT,
  promo_code TEXT,
  commission_type TEXT NOT NULL DEFAULT 'revshare',
  commission_rate REAL NOT NULL DEFAULT 30,
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

**Table `affiliate_clicks`** :
```sql
CREATE TABLE affiliate_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  match_id TEXT NOT NULL,
  user_ip TEXT,
  user_agent TEXT,
  clicked_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

### 4.2 API Endpoints
| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/api/v1/affiliates` | GET | Public | Liste des bookmakers affiliés actifs |
| `/api/v1/affiliates` | POST | Admin | Créer un nouvel affilié |
| `/api/v1/affiliates/:id` | PUT | Admin | Modifier un affilié |
| `/api/v1/affiliates/:id` | DELETE | Admin | Supprimer un affilié |
| `/api/v1/affiliate/click` | POST | Public | Track un clic affilié |
| `/api/v1/affiliate/stats` | GET | Admin | Stats d'affiliation (clics par jour/affilié) |
| `/api/v1/affiliate/link/:matchId` | GET | Public | Génère le meilleur lien affilié pour un match |

### 4.3 Seed 1xBet (pré-configuré)
```json
{
  "bookmaker": "1xbet",
  "name": "1xBet - Meilleures Cotes",
  "affiliate_link": "https://refpa7902968.top/L?tag=d_YOUR_TAG&site=YOUR_SITE_ID",
  "deeplink_template": "https://1xbet.com/fr/live?sport={sport}&event={event_id}",
  "promo_code": "PARISCORE2026",
  "commission_type": "revshare",
  "commission_rate": 30,
  "active": 1,
  "priority": 10
}
```

⚠️ **À faire** : Remplacer `YOUR_TAG`, `YOUR_SITE_ID` après inscription sur 1x.partners.

---

## 5. 🌍 ÉCOSYSTÈME D'AFFILIATION & RÉSEAUX (ÉTUDE DE MARCHÉ)

Au-delà des deals directs avec les bookmakers (comme 1xBet), il existe des **réseaux d'affiliation (CPA Networks)** et des **répertoires (Directories)** qui regroupent des centaines d'offres.

### 5.1 Plateformes & Réseaux Clés pour PariScore
| Plateforme | Type | Spécialité | Pourquoi pour PariScore ? |
|------------|------|------------|---------------------------|
| **G.Partners** | Réseau/Plateforme | 3,500+ offres iGaming | Idéal pour trouver des offres par GEO (ex: France, Afrique) |
| **Alfaleads** | Agence Performance | Betting & Crypto (2,000+ offres) | Offres exclusives, support réactif, paiements rapides |
| **AffPapa** | Répertoire/Directoire | Matchmaking Affiliés/Opérateurs | Pour trouver des deals directs et négocier de gros volumes |
| **MyLead** | Réseau Multi-vertical | Betting, Dating, Finance | 5,000+ offres, parfait pour diversifier les sources de revenus |
| **RevenueLab** | Réseau CPA iGaming | Depuis 2011 | Spécialiste pur iGaming, haute fiabilité |
| **CpaRoll** | Réseau CPA | Betting, Crypto, Gambling | Paiements flexibles (USDT, PayPal, Crypto) |

### 5.2 Stratégie de Diversification
1.  **Commencer par le Direct (1xBet)** : Plus de marge, pas d'intermédiaire.
2.  **S'inscrire sur G.Partners** : Pour accéder à des bookmakers alternatifs si 1xBet est bloqué dans certains GEOs.
3.  **Utiliser AffPapa** : Pour contacter directement les managers d'affiliation de gros groupes (Kindred/Unibet, Bet365) et négocier des deals "Whitelabel".

### 5.3 Comparatif des Réseaux (CPA vs RevShare)
| Réseau | Min Payout | Méthodes | Modèles |
|--------|------------|----------|---------|
| **G.Partners** | Variable | Virement, Crypto | CPA, RevShare, CPL |
| **Alfaleads** | $30 | USDT, Capitalist, Wire | CPA, RevShare, Hybrid |
| **MyLead** | $20 | Virement, PayPal, Crypto | CPA, CPL, RevShare |
| **RevenueLab** | $100 | Wire, WebMoney | CPA, RevShare |

**💡 Conseil GM** : Pour un site comme PariScore, le modèle **RevShare** via un réseau est souvent plus sûr au début car il garantit des revenus tant que les joueurs jouent, même si les CPA sont plus faibles.

---

## 6. 📋 ROADMAP

### Semaine 1
- [ ] Finaliser inscription **1xBet Partners** (https://1x.partners/sign-up)
- [ ] Mettre à jour le lien affilié dans la DB
- [ ] Contacter le manager 1xBet pour négocier CPA + RevShare hybride

### Semaine 2
- [ ] Intégrer bouton "Parier" sur pariscore.html (match cards)
- [ ] Ajouter widget comparateur de cotes avec liens affiliés
- [ ] Lancer campagnes TikTok Ads (budget test €500)

### Mois 1
- [ ] Recruter 5 affiliés (Tipsters Telegram/Twitter)
- [ ] Offrir 20% recurring sur abonnements Premium
- [ ] Créer dashboard affilié pour suivre les performances

### Mois 2
- [ ] Activer SMS/Twilio pour rétention utilisateurs Freemium
- [ ] Lancer programme SEO (10 articles/mois sur pronostics IA)
- [ ] Négocier deals hybrides avec 2-3 autres bookmakers

### Mois 3
- [ ] Scale à 15 affiliés actifs
- [ ] Lancer campagne retargeting Facebook Ads
- [ ] Ajouter tracking avancé (conversion par match/sport)

---

## 6. 📝 TEMPLATE CONTACT 1XBET

**Email** : `support@1xpartners.com`  
**Telegram** : `@News_1X_partners`

```
Subject: Partnership Request - PariScore (Sports Analytics Platform)

Hello 1xPartners Team,

I am the founder of PariScore, a sports analytics platform offering:
- AI-powered match predictions (Poisson + Market analysis)
- Live odds comparison across 20+ bookmakers
- 131+ matches, 178+ teams tracked daily
- Power Score IA with real-time insights

I want to register as an affiliate partner to promote 1xBet on our platform
through:
- "Bet Now" buttons on each match page with affiliate links
- Odds comparison widget highlighting 1xBet best odds
- Telegram bot alerts with 1xBet referral links
- Dedicated review/content page for 1xBet features

Expected traffic: 1000+ unique visitors/month, growing with marketing campaigns.
Target GEO: France, Belgium, Switzerland, Francophone Africa.

I would like to discuss:
- Starting with RevShare 30%+ (scaling based on performance)
- CPA deal for qualified first-time depositors
- Custom promo code for PariScore users
- Marketing materials (banners, odds widgets)

Looking forward to a profitable partnership.

Best regards,
[Ton nom]
[Ton email]
[Ton téléphone]
```

---

## 7. 💡 RECOMMANDATIONS CLÉS

1.  **Prioriser 1xBet** : Inscription immédiate sur 1x.partners + email au support pour deal hybride.
2.  **No Negative Carryover** : Négocier cette clause pour protéger tes revenus (1win, WagerPartner l'offrent).
3.  **Deeplinks** : Utiliser les liens pré-remplis (bet slip) pour maximiser les conversions.
4.  **Tracking SubID** : Taguer chaque campagne pour optimiser le ROI.
5.  **Conformité** : Respecter les régulations ANJ (France) pour les bookmakers licenciés.
6.  **Scale progressif** : Commencer par 1xBet → ajouter 2-3 bookmakers après 30 jours de data.

---

## 8. 📞 CONTACTS & LIENS

| Ressource | URL/Contact |
|-----------|-------------|
| **1xBet Partners** | https://1x.partners |
| **1xBet Signup** | https://1x.partners/sign-up |
| **Support 1xBet** | support@1xpartners.com |
| **Telegram 1xBet** | @News_1X_partners |
| **Skills Dashboard** | https://skills.sh |
| **PariScore Live** | http://localhost:3000 |

---

## 9. 🔍 ANALYSE DATAFOOT — LE MODÈLE DE JULIEN (Benchmark)

**Source** : datafoot.fr | datafoot.com | Team-Soccer-Bet.com | Bureau-des-Tipsters.com  
**Date d'analyse** : 01/05/2026  
**Utilisateurs** : 7,000+ FR, 250+ INT | **Lancement** : 2020

### 9.1 Modèle de Monétisation — Triple Flux

| Flux | Mécanisme | Prix | Revenu Estimé |
|------|-----------|------|---------------|
| **A — Abonnements directs** | 3 tiers + 1 add-on | €19/6mo, €29/an, €89 vie, €69 Datafoot+ | ~€200K/an |
| **B — CPA Bookmakers partenaires** | Inscription bookmaker = accès gratuit | PMU.fr, PokerStars Sport, Betsson | ~€50-100K/an |
| **C — Affiliation indirecte** | Partenaires tipsters avec liens affiliés | YouTube, Discord, blogs | Variable |

**Le génie de Julien** : Le "free access via bookmaker" transforme l'acquisition utilisateur en revenu. L'utilisateur ne paie pas → le bookmaker paie Datafoot en CPA. C'est du **CPA inversé** : au lieu de payer pour acquérir un client, Datafoot est payé par le bookmaker pour lui envoyer un client.

### 9.2 Stratégie de Contenu & Acquisition

| Canal | Usage | Fréquence | KPI |
|-------|-------|-----------|-----|
| **YouTube** | Pronos match + démo fonctionnalités | Hebdomadaire | 9,700+ abonnés (Team Soccer Bet) |
| **Twitter/X** | Algorithmes résultats, community building | Quotidien | @datafootfr |
| **Discord** | Canal dédié sur serveurs partenaires | Permanent | 30,000 messages/sem (Bureau des Tipsters) |
| **Blog SEO** | Articles "meilleur outil analyse paris sportifs" | Mensuel | Top Google sur mots-clés longue traîne |
| **Telegram** | Notifications cotes boostées bookmakers FR | Quotidien | Rétention utilisateurs |
| **Instagram** | Stories résultats, témoignages | 2-3x/sem | @datafoot.fr |

### 9.3 Réseau de Partenaires (6 piliers)

| Partenaire | Type | Audience | Rôle pour Datafoot |
|------------|------|----------|-------------------|
| **Team Soccer Bet** (Steven) | YouTube + Blog | 9,700 YT | Premier partenaire (2021), avis détaillé, tutoriel "accès gratuit" |
| **Bureau des Tipsters** | Discord + Blog | 30K msg/sem | Canal dédié Datafoot, crédibilité communauté |
| **MediaPronos** | Pronostics | Depuis 2012 | Référence historique, trafic qualifié |
| **Papa_rieur** (GG) | Twitter/X | Communautaire | Ton accessible, bons plans bookmakers |
| **PenseBet** | Blog + Réflexion | Américains | Complémentarité data/intuition |
| **Dorado** (Basket) | YouTube + Club Privé | 15 ans exp | Expertise value betting, CLV, résultats certifiés |

**Stratégie de Julien** : Il ne recrute pas des affiliés classiques. Il crée des **partenariats stratégiques** avec des créateurs de contenu qui ont déjà une communauté engagée. Chaque partenaire a un canal Discord dédié à Datafoot.

### 9.4 Positionnement & Messaging

**Slogan** : "L'outil d'analyse le plus complet pour réussir dans les paris sportifs"

**3 piliers marketing** :
1. ✅ **Statistiques** pour élaborer une stratégie solide
2. ✅ **Algorithmes** avec haut taux de réussite (>70%)
3. ✅ **Gestionnaire de bankroll** pour optimiser vos résultats

**Ton** : Professionnel, sérieux, PAS de "gains garantis". Julien met en avant la **data**, pas le rêve. Il se positionne comme un **outil d'aide à la décision**, pas un oracle.

**Preuve sociale** : 9+ témoignages sur la page d'accueil, résultats d'algorithmes publics (ROI +11%, 70% réussite, 162 paris validés 2024/2025).

### 9.5 Fonctionnalités Clés qui Convertissent

| Fonctionnalité | Impact Conversion | Pourquoi ça marche |
|----------------|-------------------|-------------------|
| **90+ championnats** | Haute | "Plus besoin de jongler entre 10 sites" |
| **Algorithmes >70%** | Très haute | Chiffre précis, pas vague |
| **Bankroll manager intégré** | Moyenne | Économise un outil externe |
| **Bêtes noires** | Haute | Concept unique, différenciant |
| **Fins de séries (40+)** | Haute | Données introuvables ailleurs |
| **Cotes boostées Telegram** | Moyenne | Rétention quotidienne |
| **Planning customisable** | Moyenne | UX personnelle, gain de temps |

### 9.6 Ce que PariScore DOIT copier/adaptater

| Élément Datafoot | Action PariScore | Priorité |
|------------------|------------------|----------|
| **CPA inversé via bookmakers ANJ** | Négocier avec Winamax/Unibet/Parions Sport : inscription = accès Matchday Pass gratuit | 🔴 P0 |
| **YouTube pronos + démo** | Créer chaîne YouTube "PariScore AI vs Reality" avec vidéos hebdo | 🔴 P0 |
| **Discord communautaire** | Créer Discord PariScore + partenariats serveurs existants | 🟡 P1 |
| **Blog SEO longue traîne** | Articles "pronostic IA football", "modèle Poisson paris" | 🟡 P1 |
| **Telegram alerts** | Notifications Value Bets quotidiennes (déjà prévu v5.10) | ✅ Fait |
| **Preuve sociale chiffrée** | Afficher accuracy publique : "65% sur 30 derniers paris" | 🔴 P0 |
| **Founder accessible** | David (GM) actif Twitter/X, répond à chaque suggestion | 🟡 P1 |
| **Bankroll manager** | Ajouter gestionnaire de bankroll dans onglet Historique | 🟢 P2 |
| **Concept différenciant** | "PariScore Shield" = convergence Poisson + Marché (notre unique selling point) | ✅ Fait |

### 9.7 Différenciation PariScore vs Datafoot

| Aspect | Datafoot | PariScore | Avantage |
|--------|----------|-----------|----------|
| **Moteur** | Algorithmes statistiques simples | IA Gemini + Poisson + Market | 🏆 PariScore |
| **Contenu** | Stats historiques | Analyse contextuelle (blessures, presse, YouTube) | 🏆 PariScore |
| **Temps réel** | Non | SSE live updates | 🏆 PariScore |
| **UI/UX** | Interface fonctionnelle mais datée | SPA moderne, charts interactifs | 🏆 PariScore |
| **Communauté** | 7,000+ utilisateurs, 6 ans | À construire | 🏆 Datafoot |
| **Crédibilité** | Résultats publics depuis 2020 | Nouveau, needs proof | 🏆 Datafoot |
| **Pricing** | €19-89 | Freemium + €4.99/24h + €9.99/mo | 🏆 PariScore (plus accessible) |
| **Affiliation** | CPA bookmakers ANJ seulement | Double flux (bookmakers + affiliés Premium) | 🏆 PariScore |

### 9.8 Plan d'Action Inspiré de Datafoot

**Semaine 1 — Foundation**
- [ ] Créer compte Twitter/X @PariScoreAI + bio professionnelle
- [ ] Publier 1er thread : "Notre IA a analysé 131 matchs voici les résultats"
- [ ] Contacter Team Soccer Bet (Steven) pour partenariat avis/review
- [ ] Contacter Bureau des Tipsters pour canal Discord dédié

**Semaine 2 — Content**
- [ ] Lancer chaîne YouTube : 1 vidéo "PariScore AI predicts 5 matchs this weekend"
- [ ] Publier 1er article blog : "Comment l'IA bat les bookmakers 65% du temps"
- [ ] Configurer Telegram bot pour notifications quotidiennes value bets

**Semaine 3 — Partnerships ANJ**
- [ ] Contacter Winamax affiliation pour deal "accès gratuit via inscription"
- [ ] Contacter Unibet Partners pour même modèle
- [ ] Mettre en place bouton "Parier" avec liens affiliés sur chaque match

**Mois 1 — Scale**
- [ ] Atteindre 500 utilisateurs actifs
- [ ] Recruter 3 partenaires tipsters (modèle Datafoot)
- [ ] Publier résultats accuracy mensuels publics (transparence = confiance)

---

*Document généré le 01/05/2026 — PariScore v5.10*
