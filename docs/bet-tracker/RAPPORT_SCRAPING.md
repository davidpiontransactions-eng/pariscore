# Rapport de Scraping — Veille concurrentielle Trackers de paris

**Date** : 2026-08-20
**Cibles** : Bet-Analytix (`bet-analytix.com`) · BettingTracker (`bettingtracker.net`)
**Méthode** : récupération des pages publiques (marketing/features/outils) + sources tierces de comparaison (parisportifbankroll.com, bureau-des-tipsters.com, parisportifexplication.com).

---

## 1. Fiche Bet-Analytix (bet-analytix.com/fr)

**Positionnement** : « la référence francophone » — 700 000+ utilisateurs annoncés, app iOS/Android + web. La plateforme ne manipule **aucun argent réel** (explicite dans leur footer : les montants sont des nombres fictifs).

### Fonctionnalités constatées
| Module | Détails |
|---|---|
| Suivi des paris | Simples, combinés, **systèmes**, **back/lay** (exchange), pari live, pari gratuit, cashout, bonus de gain, commission, each-way |
| Bankrolls | **Multi-bankrolls** + **bilans consolidés** (stats globales de plusieurs bankrolls réunies) |
| Statistiques | ROI, yield, % de réussite, cote moyenne, gains/pertes, performance par sport / type de pari / catégorie / compétition / tipster / **closing odds** — filtres (date, sport, cote min/max, mise min/max, type) |
| Analyzer | Analyse de performance multi-axes pour réduire le risque et augmenter le ROI |
| Optimizer | Stratégies de mise basées sur les résultats passés + **simulation sur données aléatoires** |
| Montantes | Outil de progression de mise : calcule automatiquement mises/cotes cibles palier par palier |
| Social | Suivi de **tipsters** (bankrolls publiques), partage 1-click, notifications email à chaque pari ajouté |
| Export | Export/téléchargement complet de la bankroll (données hors-ligne) |
| Personnalisation | Champs personnalisés par pari (tipster, catégorie, compétition, type, closing odds…) |

### Outils gratuits (page /fr/outils — 9 calculateurs)
Cote → probabilité implicite · Surebet · Probabilités de match (démarginalisation) · Dutching · Répartiteur de mises (double chance / remboursé si nul) · TRJ (taux de retour au joueur) · Couverture live · Bénéfice à acquérir · Mise en % du capital.

### Prix (source tierce, 2025-10)
- Gratuit : stats limitées à **30 jours** (verrouillage mesquin).
- Premium : **9,90 €/mois** ou **79 €/an**.
- Import automatique des paris : seulement quelques bookmakers ; sinon saisie manuelle.

### Points faibles rapportés
- App mobile « catastrophe » (lag, crash, batterie) ; la web mobile est plus stable.
- Stats > 30 jours payantes même pour l'essentiel.
- Import bookmakers limité.

---

## 2. Fiche BettingTracker (bettingtracker.net)

**Positionnement** : plateforme « reconstruite de zéro » — 37 sports, 190+ bookmakers, 7 200+ compétitions / 66 000+ équipes, PWA (installable), mode clair/sombre, recherche globale.

### Fonctionnalités constatées
| Module | Détails |
|---|---|
| Import | **OCR par photo/screenshot du ticket** (import automatique), saisie manuelle, **import/export CSV** |
| Résultats automatiques | Résolution automatique des paris à la fin du match (plus de saisie du résultat) |
| Multi-bankroll | Bankrolls + bookmakers indépendants |
| Dashboard | KPIs temps réel + graphiques |
| Stats par sport | Performance par sport, compétition, équipe, type de pari |
| Livescore | Scores en direct intégrés, livescore enrichi dans le détail du match |
| Calendrier | Matchs du jour, planification des paris, page Coupe du Monde 2026 |
| Devises | Support multi-devises avec conversion auto (source tierce) |
| Conformité | RGPD, chiffrement 256 bits, hébergement UE, sauvegardes quotidiennes |

### 17 calculateurs (page /fr/tools)
- **Gratuits (7)** : Remboursé si nul · Double chance · Taux de retour · Convertisseur de cotes (décimal/fractionnel/US) · Calculateur combiné · Seuil de rentabilité (break-even) · Convertisseur handicap (européen/asiatique/spread US).
- **PRO (6)** : Critère de **Kelly** · Couverture (garantir un profit en cours de pari) · **Dutching** · **Valeur attendue (EV)** · Cotes justes sans marge · Pari Lay (exchanges).
- **Expert (4)** : Détecteur d'**arbitrage** · Pari **Middle** · **Simulateur de bankroll Monte Carlo** (1 000 trajectoires) · **Plan de mise** (comparaison de stratégies sur l'historique réel).

### Prix (page tarifs, 2026)
| Plan | Prix | Contenu |
|---|---|---|
| Gratuit | 0 € | Paris illimités, 1 bankroll, dashboard basique, calendrier, 7 calculateurs |
| PRO | 4,99 €/mois | Bankrolls illimitées, résultats auto, dashboard complet + graphiques, CSV import/export, notifications email, 13 calculateurs, 1 partage public |
| Expert | 9,99 €/mois | Tout PRO + partages illimités, support prioritaire, AI Insights (bientôt), digest hebdo, 17 outils (Monte Carlo, staking plans), OCR illimité |

### Points faibles rapportés (source tierce)
- Stats avancées (par sport/bookmaker/type) verrouillées en gratuit.
- Pas de montantes ni d'outils de planification avancée (tracking pur).
- Communauté plus petite que BA.
- Prix 25 % plus cher que Bet-Analytix pour moins de fonctionnalités d'analyse.

---

## 3. Tableau comparatif condensé

| Critère | Bet-Analytix | BettingTracker |
|---|---|---|
| Multi-bankroll | ✅ + bilans consolidés | ✅ |
| ROI / Yield / évolution capital | ✅ (payant > 30 j) | ✅ (basique gratuit) |
| Types de paris | Simples, combinés, systèmes, back/lay, cashout, each-way | Simples/combinés (via OCR) |
| Import automatique | Quelques bookmakers | **OCR photo de ticket** + CSV |
| Résultats auto | ❌ | ✅ fin de match |
| Calculateurs | 9 gratuits | 17 (7 gratuits) : Kelly, arbitrage, Monte Carlo, Dutching… |
| Simulation stratégies | Optimizer + montantes + données aléatoires | Simulateur Monte Carlo + plan de mise |
| Stats par sport/tipster/closing odds | ✅ très riche | ✅ par sport/compétition/équipe |
| Tipsters / partage social | ✅ (700 k users) | ✅ partage public intégrable |
| Live/caléndrier | ❌ | ✅ livescore + calendrier |
| App | iOS/Android (mauvaise qualité rapportée) | PWA |
| Prix | 9,90 €/mois | 0 / 4,99 / 9,99 €/mois |

---

## 4. Best-of — fonctionnalités retenues pour « PariScore Bet Manager »

**Venu de Bet-Analytix**
1. Multi-bankrolls + bilans consolidés.
2. Types de paris riches : simple, combiné (legs), système, back/lay, cashout.
3. Métadonnées par pari : sport, compétition, tipster, catégorie, closing odds, tags.
4. Analytics : ROI, yield, % réussite, cote moyenne, variance, performance par dimension (sport/type/plage de cote/jour), courbe de bankroll.
5. Optimizer de mises (fixe, % bankroll, montante) + simulation sur historique réel.
6. Export CSV complet.

**Venu de BettingTracker**
7. **Import OCR** du ticket 1xbet (screenshot → extraction cotes/mises) — en local (Tesseract.js), aucune capture ne quitte la machine.
8. Import/export **CSV** (format standard : date, sport, match, type, cote, mise, résultat).
9. Résolution semi-automatique des résultats (sync via API-football déjà présente dans PariScore).
10. 17 calculateurs : Kelly, EV, surebet/arbitrage, Dutching, double chance, Remboursé si nul, TRJ, break-even, convertisseur cotes, handicap, middle, lay, Monte Carlo (1 000 trajectoires), plan de mise.
11. Dashboard KPIs + graphiques (courbe capital, monthly P/L, heatmap sports).
12. Mode clair/sombre + PWA (PariScore est déjà PWA).

**Non retenus (bruit)**
- Partage public de bankroll / réseau social tipsters (hors sujet pour un usage perso).
- Notifications email de tipsters.
- Couverture 37 sports avec DB d'équipes exhaustive (PariScore cible football/tennis/basket/MMA via API-football existante).
- Prix SaaS — le site est un outil perso gratuit.

---

## 5. Import 1xbet — analyse honnête et méthode recommandée

**Question posée : « si je te donne login + mot de passe 1xbet, es-tu capable d'importer mes résultats ? »**

Réponse technique : **oui, techniquement possible** (Playwright/Scrapling stealth + session utilisateur), **mais je refuse par principe** :

1. **Sécurité** : je ne stocke et ne manipule jamais des identifiants en clair. Un vol = compromission du compte + du moyen de paiement associé.
2. **CGU 1xbet** : l'automatisation est interdite par leurs conditions. Risque réel : **bannissement du compte et gel des fonds** (1xbet est particulièrement agressif sur l'anti-bot : Datalock, fingerprinting, vérifications d'identité).
3. **Pratique des trackers pros** : aucun (BA, BT, Smart Bet Tracker) ne se connecte à 1xbet — ils utilisent tous **OCR de ticket** ou **CSV** pour cette raison.

**Méthode recommandée (celle de BettingTracker, version safe)**
- **P1 — OCR ticket** : tu captures l'écran de ton ticket 1xbet (ou de l'historique) → OCR local (Tesseract.js) → pré-remplissage du formulaire de pari → tu valides. 100 % local, 5-10 s/pari, aucun risque.
- **P2 — CSV** : copier-coller de ton historique 1xbet (pagination) ou export tiers → import en masse avec mapping de colonnes.
- **P3 — (déconseillé) scraping avec ta session** : browser persistant où TU te connectes toi-même, l'agent lit ton historique — aucune manip d'identifiants de mon côté, mais reste contraire aux CGU → risque ban.

---

## 6. Sources
- https://www.bet-analytix.com/fr (features, outils)
- https://www.bet-analytix.com/fr/outils (9 calculateurs)
- https://www.bettingtracker.net/ (features, pricing, comparatif)
- https://www.bettingtracker.net/fr/tools (17 calculateurs)
- https://parisportifbankroll.com/applications-gestion-bankroll (comparatif indépendant 2025-10)
- https://www.bureau-des-tipsters.com/bet-analytix-loutil-de-gestion-de-bankroll-indispensable (revue détaillée BA)
- https://parisportifexplication.com/gestion-de-bankroll-paris-sportifs (formules ROI/Yield/Kelly)