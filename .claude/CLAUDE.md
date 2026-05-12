# CLAUDE.md — PariScore : Cahier des Charges & Plan Projet

> Document de référence pour Claude et les contributeurs. Retrace l'intégralité des décisions techniques, de l'architecture, des contraintes et de la roadmap du projet.
> **Dernière mise à jour : 27 avril 2026 — v3.0 (en cours)**

---

## 👑 PERSONA : GENERAL MANAGER (GM)
Tu agis désormais en tant que **General Manager de PariScore**. Ton rôle n'est plus seulement d'exécuter du code, mais d'orchestrer l'ensemble des agents situés dans `.claude/agents/` pour atteindre les objectifs stratégiques du DG.

### 🤖 TON ÉQUIPE D'AGENTS (Dossier : .claude/agents/)
Avant chaque tâche complexe, tu dois "consulter" mentalement en français ou charger les instructions des agents concernés :
- **Stratégie & Produit** : `Product Manager Agent.md`, `cto.md`.
- **Exécution Technique** : `cs-engineering-lead.md`, `cskarpathyréviseur.md`.
- **Qualité & Finance** : `réglementation de lqualité CS.md`, `Responsable financier.mf`.
- **Recherche** : `cs-ux-researcher.md`, `cs-wiki-ingestor.md`.

### 📋 PROTOCOLE DE PILOTAGE
Dès que je te soumets un objectif, tu dois suivre ce workflow de GM :
1. **Analyse de l'Objectif** : Identifier les sous-tâches nécessaires (Backend, UI, Marketing, Risk).
2. **Délégation Virtuelle** : Préciser quel agent tu "équipes" pour chaque sous-tâche (ex: "Je prends le rôle de l'Engineering Lead pour auditer SQLite").
3. **Exécution & Arbitrage** : Exécuter le code en respectant les contraintes de chaque agent (ex: rigueur de Karpathy pour le code, conformité pour la qualité).
4. **Consolidation** : Me faire un rapport final en tant que GM, validant que le travail respecte le budget et les délais de mai 2026.

### 🛠️ PRIORITÉS DU GM POUR PARISCORE
- **Stabilité SQLite** : Maintenir le mode WAL et la gestion des disques persistants sur Render.
- **Edge Mathématique** : Garantir que le modèle de Poisson n'est pas corrompu par de nouvelles fonctionnalités.
- **Performance Live** : Surveiller la latence des flux SSE et WebSocket.

## 1. VISION & CONTEXTE

### 1.1 Concept
PariScore est une **plateforme d'analyse football orientée paris sportifs**, inspirée d'[OddAlerts](https://www.oddalerts.com/). Elle agrège les cotes de 20+ bookmakers, calcule des probabilités mathématiques (modèle de Poisson), détecte les opportunités de valeur ("Value Bets") et fournit une analyse IA des meilleurs paris du jour.

### 1.2 Positionnement
- **Public cible** : parieurs sportifs sérieux cherchant un avantage mathématique sur les bookmakers
- **Philosophie** : données → probabilités → décision. Pariez avec les maths, pas l'instinct.
- **Modèle** : SaaS avec plan gratuit (limité) et plan Pro (€19/mois)

### 1.3 Origine
Projet initié le 27 avril 2026, parti d'un prototype HTML statique "CoteAlerte" renommé PariScore, progressivement transformé en application full-stack avec backend Node.js.

---

## 2. ARCHITECTURE TECHNIQUE (v2.0 — Serveur-Centrique)

### 2.1 Vue d'ensemble

```
  ┌─────────────────────┐      ┌─────────────────────┐
  │  The Odds API        │─────▶│                     │
  │  cotes live (12h)    │      │   server.js          │──▶ database.json
  └─────────────────────┘      │   (Node.js natif)    │──▶ history.json
                                │                     │
  ┌─────────────────────┐      │   Cron Jobs          │
  │  API-Football        │─────▶│   Fusion + Poisson   │
  │  standings (6h)      │      │   API REST interne   │
  └─────────────────────┘      │   Proxy Gemini       │
                                └──────────┬──────────┘
                                           │ /api/v1/matches
                                ┌──────────▼──────────┐
                                │  pariscore.html      │
                                │  Frontend "stupide"  │
                                │  0 clé · 0 cache     │
                                └─────────────────────┘
```

### 2.2 Principes d'architecture
| Principe | Implémentation |
|----------|----------------|
| **Zéro dépendance npm** | Modules Node.js natifs uniquement (`http`, `https`, `fs`, `path`, `url`) |
| **Clés API invisibles** | Chargées depuis `.env`, jamais dans le HTML |
| **Frontend stupide** | `fetch('/api/v1/matches')` → rendu pur, aucun calcul |
| **Cache persistant** | `database.json` — rechargé au boot, survit aux redémarrages |
| **Fallback automatique** | 20 matchs démo si les APIs échouent |
| **Rate limiting défensif** | Cron 12h (Odds) + 6h (Stats) pour respecter les quotas gratuits |

### 2.3 Fichiers du projet

| Fichier | Rôle | Généré par |
|---------|------|-----------|
| `server.js` | Backend complet : cron, API REST, proxy, calculs | Manuel |
| `pariscore.html` | Frontend SPA 6 onglets | Manuel |
| `.env` | Clés API (jamais committé) | Utilisateur |
| `database.json` | Cache persistant des matchs fusionnés | `server.js` au runtime |
| `history.json` | Archives + métriques de backtesting | `server.js` au runtime |
| `CHANGELOG.md` | Journal des modifications | Manuel |
| `AUDIT.md` | Rapport d'audit technique 360° | Manuel |
| `CLAUDE.md` | Ce fichier — cahier des charges | Manuel |
| `admin.html` | Dashboard admin (JWT, KPIs, accuracy, Telegram) | Manuel |
| `render.yaml` | Blueprint de déploiement Render.com | Manuel |

---

## 3. SOURCES DE DONNÉES & QUOTAS

### 3.1 The Odds API
- **URL** : `https://api.the-odds-api.com/v4/`
- **Usage** : cotes live de 20+ bookmakers, ligues actives
- **Clé** : `ODDS_API_KEY` dans `.env`
- **Plan gratuit** : 500 req/mois ⚠️
- **Fréquence cron** : toutes les 12h = ~480 req/mois (< 500 ✅)
- **Endpoints utilisés** :
  - `GET /v4/sports/?apiKey=...` → liste des sports actifs
  - `GET /v4/sports/{sport}/odds/?apiKey=...&regions=eu&markets=h2h&oddsFormat=decimal` → cotes h2h
- **Fenêtre temporelle** : `commenceTimeFrom` → `commenceTimeTo` (J à J+7)
- **Headers clés retournés** : `x-requests-remaining`, `x-requests-used`

### 3.2 API-Football (MISE À JOUR v4.0)
- **URL** : `https://v3.football.api-sports.io/`
- **Usage** : standings home/away, stats avancées, scores live, backtesting
- **Clé** : `API_FOOTBALL_KEY` dans `.env`
- **Plan actuel** : **PRO — 19$/mois — 7 500 req/jour** (nécessaire pour 18 ligues + Stats Avancées)
- **Header requis** : `x-apisports-key: {KEY}`
- **Endpoints utilisés** :
  - `GET /fixtures?next=100&timezone=Europe/Paris` → matchs à venir (IDs de ligues)
  - `GET /standings?league={id}&season={year}` → standings par ligue
  - `GET /fixtures?date={YYYY-MM-DD}&status=FT` → scores réels (backtesting)
  - `GET /fixtures?live=all` → scores live (Smart Polling)
  - `GET /teams/statistics?team={id}&league={id}&season={year}` → xG, Cartons, Tirs
- **Saison** : calculée dynamiquement (`mois >= 7 ? année : année-1`)
- **Stratégie de cache** :
  - `standings` : toutes les **12h** (données peu volatiles)
  - `fixtures?live=all` : **Smart Polling 60s** — actif uniquement de 19h à 23h (heure Paris)
  - `teams/statistics` (xG, Cartons) : cache strict **24h** dans `db.advancedTeamStats`

### 3.3 Gemini 2.0 Flash (Google AI)
- **URL** : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Usage** : analyse IA de matchs + AI Scout (combiné du jour)
- **Clé** : `GEMINI_API_KEY` dans `.env`
- **Plan** : pay-as-you-go
- **Proxy obligatoire** : `/api/v1/gemini` (clé jamais exposée au client)
- **Cache AI Scout** : 6h (variable `aiScoutCache`)
- **Payload max** : 1 Mo (protection OOM via `readBodyLimited`)

### 3.4 Ligues couvertes
| Clé The Odds API | Nom affiché |
|-----------------|-------------|
| `soccer_france_ligue1` | Ligue 1 |
| `soccer_epl` | Premier League |
| `soccer_uefa_champs_league` | Champions League |
| `soccer_spain_la_liga` | La Liga |
| `soccer_germany_bundesliga` | Bundesliga |
| `soccer_italy_serie_a` | Serie A |
| `soccer_uefa_europa_league` | Europa League |

---

## 4. MOTEUR DE CALCUL

### 4.1 Edge No-Vig (Valeur de Paris)
Détecte les cotes sous-évaluées par les bookmakers.

```
1. Pour chaque bookmaker : prob_implicite = 1 / cote
2. Marge bookmaker = Σ(prob_implicites) - 1
3. Prob fair = prob_implicite / Σ(prob_implicites)  [normalisation no-vig]
4. Edge = meilleure_cote × prob_fair - 1  [en %]
5. Edge > 0 → opportunité de valeur
```

### 4.2 Distribution de Poisson (v3.0)
Calcul probabiliste rigoureux basé sur les Expected Goals.

```
// Facteur d'attaque/défense normalisé par la moyenne de ligue (1.35 buts)
λ_dom = (avgScored_dom / 1.35) × avgConceded_ext
λ_ext = (avgScored_ext / 1.35) × avgConceded_dom

// Matrice de scores (0-6 × 0-6)
P(h,a) = Poisson(λ_dom, h) × Poisson(λ_ext, a)

// Probabilités de marchés dérivées
BTTS    = Σ P(h>0, a>0)
Over 0.5 = Σ P(h+a > 0)
Over 1.5 = Σ P(h+a > 1)
Over 2.5 = Σ P(h+a > 2)
Over 3.5 = Σ P(h+a > 3)
```

**Outputs Poisson** par match :
- `over05`, `over15`, `over25`, `over35` (en %)
- `btts`, `under15`, `cs00` (clean sheet)
- `homeWin`, `draw`, `awayWin`
- `topScores` : top 5 scores les plus probables
- `expectedGoals` : `{ home, away }` (les λ)

### 4.3 Matching des équipes (Odds API ↔ API-Football)
Problème : les noms d'équipe diffèrent entre les deux APIs.

```javascript
// Normalisation
normName(name) → minuscules + sans accents + sans caractères spéciaux

// Matching exact → fuzzy
1. Lookup exact dans db.teamStats[normName(team)]
2. Fuzzy : premier mot du nom ≥ 3 chars → inclus dans une clé connue
```

⚠️ **Limite connue** : risque de faux positif sur noms courts ("Inter", "Sporting"). À améliorer avec Levenshtein (roadmap P2).

### 4.4 Stats d'équipe
Deux sources possibles, avec badge d'indication :

| Source | Badge | Qualité |
|--------|-------|---------|
| Standings API-Football | `LIVE` (bleu) | Réelles |
| Fonction `simStats()` (hash déterministe) | `SIM` (gris) | Estimées |

---

## 5. API REST INTERNE

### 5.1 Routes disponibles

| Route | Méthode | Params | Description |
|-------|---------|--------|-------------|
| `/api/v1/matches` | GET | `?league=`, `?day=` | Tous les matchs fusionnés |
| `/api/v1/stats/:id` | GET | — | Détail d'un match |
| `/api/v1/status` | GET | — | État serveur, quotas, uptime |
| `/api/v1/accuracy` | GET | — | Taux de réussite des algorithmes |
| `/api/v1/ai-scout` | GET | — | Top 5 value bets analysés par Gemini |
| `/api/v1/gemini` | POST | body JSON | Proxy Gemini sécurisé |
| `/api/v1/refresh` | POST | — | Force MAJ Stats + Odds + Archive |

### 5.2 Structure d'un objet Match (réponse `/api/v1/matches`)

```json
{
  "id": "abc123",
  "sport": "soccer_france_ligue1",
  "league": "Ligue 1",
  "commence_time": "2026-04-28T18:00:00Z",
  "home_team": "PSG",
  "away_team": "Olympique Lyonnais",
  "home_rank": 1,
  "away_rank": 4,
  "odds": { "home": 1.42, "draw": 4.50, "away": 7.50 },
  "bookmakers": { "home": "Pinnacle", "draw": "Bet365", "away": "Unibet" },
  "fair": { "home": 0.68, "draw": 0.19, "away": 0.13 },
  "edge": { "home": -3.4, "draw": 1.5, "away": -2.5 },
  "best_edge": { "label": "Nul", "odds": 4.50, "edge": 1.5, "bk": "Bet365" },
  "poisson": {
    "over05": 94, "over15": 75, "over25": 52, "over35": 31,
    "btts": 48, "under15": 25, "cs00": 6,
    "homeWin": 68, "draw": 19, "awayWin": 13,
    "topScores": [{"score": "1-0", "prob": 14}, {"score": "2-0", "prob": 11}, ...],
    "method": "poisson"
  },
  "expectedGoals": { "home": 1.82, "away": 0.74 },
  "stats": {
    "home": { "ppg": 2.31, "wins": 72, "draws": 12, "losses": 16, "scored": 88, "conceded": 41, "avgScored": 2.4, "avgConceded": 0.8 },
    "away": { "ppg": 1.54, "wins": 44, "draws": 22, "losses": 34, "scored": 68, "conceded": 62, "avgScored": 1.4, "avgConceded": 1.6 },
    "isReal": true
  }
}
```

---

## 6. SÉCURITÉ

### 6.1 Mesures en place

| Mesure | Implémentation |
|--------|----------------|
| Clés API invisibles | `.env` côté serveur, jamais dans le HTML |
| Fichiers sensibles protégés | `.env`, `database.json`, `history.json`, `.git/` → HTTP 403 |
| Path traversal bloqué | `path.resolve().startsWith(__dirname)` |
| Proxy Gemini | La clé Google ne quitte jamais le serveur |
| Limite POST | `readBodyLimited(req, 1Mo)` → HTTP 413 si dépassé |
| CORS | Wildcard `*` en local — à restreindre en production |

### 6.2 Fichier `.env` (modèle)

```bash
# PariScore — Clés API (ne jamais committer ce fichier)
PORT=3000
ODDS_API_KEY=votre_cle_the_odds_api
API_FOOTBALL_KEY=votre_cle_api_football
GEMINI_API_KEY=votre_cle_gemini
JWT_SECRET=                    # auto-généré si absent
ADMIN_PASSWORD=pariscore2026   # changer en production
TELEGRAM_BOT_TOKEN=            # optionnel — alertes Telegram
TELEGRAM_CHAT_IDS=             # IDs séparés par virgule
ALERT_EDGE_THRESHOLD=8         # edge % minimum pour alertes
ALLOWED_ORIGIN=*               # restreindre en production
```

---

## 7. FRONTEND (pariscore.html)

### 7.1 Structure SPA — 6 onglets

| Onglet | ID | Contenu | Chargement |
|--------|-----|---------|------------|
| Accueil | `page-accueil` | Hero, stats, features, tarifs | Statique |
| Matchs | `page-matchs` | Tableau stats + filtres + AI Scout | `fetch('/api/v1/matches')` au 1er clic |
| Prédictions IA | `page-predictions` | Cartes de prédiction | Statique (à connecter) |
| Tendances | `page-tendances` | BTTS, buts, forme | Statique (à connecter) |
| Alertes | `page-alertes` | Config Telegram | Statique (à connecter) |
| Tarifs | `page-tarifs` | Plans Gratuit / Pro / Annuel | Statique |

### 7.2 Onglet Matchs — détail

**Composants dans l'ordre vertical :**
1. `#ai-scout-panel` — encart IA "L'avis de l'Expert" (chargé via `/api/v1/ai-scout`)
2. `#status-bar` — statut serveur + quota + bouton 🔄 Forcer l'actualisation
3. `#file-warning` — bannière (masquée normalement)
4. Filtres **Jour** : Tous / Aujourd'hui / Demain / J+2 / J+3
5. Filtres **Ligue** : 8 boutons `data-sport`
6. Tableau principal (scroll horizontal, 1400px min)

**Tableau des matchs — colonnes :**
1. Match (noms équipes + ligue + rang + badge LIVE/SIM)
2. Heure + date
3. PPG Dom/Ext
4. Victoires % Dom/Ext
5. Nuls % Dom/Ext
6. Défaites % Dom/Ext
7. **BTTS** (Poisson — colonne unifiée)
8. **O 0.5** (Poisson)
9. **O 1.5** (Poisson)
10. **O 2.5** (Poisson)
11. **O 3.5** (Poisson)
12. Buts Marqués % Dom/Ext
13. Buts Encaissés % Dom/Ext
14. xG Dom/Ext (Expected Goals)
15. Cote 1 / N / 2
16. Edge % (badge vert/orange)
17. Bouton ✦ Analyse IA (Gemini)

**Code couleur des cellules :**
- 🟢 Vert `rgba(0,165,81,0.18)` : valeur favorable (>75% ou PPG≥2.0)
- 🟠 Orange `rgba(245,158,11,0.18)` : valeur moyenne (50-75% ou PPG≥1.3)
- 🔴 Rouge `rgba(239,68,68,0.18)` : valeur défavorable (<50%)
- Colonnes Poisson : en-têtes en `var(--blue)` pour distinguer visuellement

**Tri des colonnes :**
- Clic sur `Dom`/`Ext` → tri décroissant (↓ vert)
- 2ème clic → tri croissant (↑ vert)
- Sans tri actif → tri par heure de match (defaut)

---

## 8. CRON JOBS & PIPELINE DE DONNÉES

```
┌─────────────────────────────────────────────────────────┐
│  Boot (node server.js)                                   │
│    1. loadDB() + loadHistory()                           │
│    2. fetchStats() → fetchOdds() → archivePastMatches()  │
│    3. Si 0 matchs → buildDemoMatches()                   │
└────────────────┬────────────────────────────────────────┘
                 │
  ┌──────────────▼──────────────┐
  │  Cron Stats (toutes les 6h) │
  │  fetchStats()               │
  │  → /fixtures?next=100       │
  │  → /standings?league={id}   │
  │  → db.teamStats mise à jour │
  │  → fetchOdds() (re-fusion)  │
  └──────────────┬──────────────┘
                 │
  ┌──────────────▼──────────────┐
  │  Cron Odds (toutes les 12h) │
  │  fetchOdds()                │
  │  → /sports (actifs)         │
  │  → /odds par ligue          │
  │  → buildMatchRecord()       │
  │     ├── computeEdge()       │
  │     ├── computePoisson()    │
  │     └── merge stats         │
  │  → saveDB()                 │
  │  → archivePastMatches()     │
  └─────────────────────────────┘
```

**Mutex (anti-race-condition) :**
- `isFetchingOdds` : empêche deux `fetchOdds()` simultanés
- `isFetchingStats` : empêche deux `fetchStats()` simultanés
- Relâchés dans `finally` (garanti même en cas d'erreur)

---

## 9. BACKTESTING (Option B — v3.0)

### 9.1 Principe
- `archivePastMatches()` déplace les matchs terminés (>3h après kick-off) de `database.json` vers `history.json`
- Récupère les scores réels via API-Football (`/fixtures?date=...&status=FT`)
- Compare les prédictions Poisson aux résultats réels

### 9.2 Métriques calculées
| Métrique | Condition de "prédiction" | Vérifié si |
|----------|--------------------------|------------|
| Over 2.5 | `poisson.over25 > 55%` | total buts > 2 |
| BTTS | `poisson.btts > 55%` | les deux équipes ont marqué |
| Edge | `best_edge.edge > 5%` | le favori de l'edge a gagné |

### 9.3 Route de consultation
`GET /api/v1/accuracy` → affiché dans la barre de statut frontend

```json
{
  "total_verified": 47,
  "over25": { "rate": 68, "sample": 31 },
  "btts":   { "rate": 61, "sample": 28 },
  "edge":   { "rate": 55, "sample": 19 }
}
```

---

## 10. AI SCOUT (Option C — v3.0)

### 10.1 Principe
Route `GET /api/v1/ai-scout` → prend les 5 matchs avec le plus gros edge → envoie à Gemini → retourne 3 phrases structurées.

### 10.2 Structure de la réponse
- 🎯 **Le Combiné du Jour** : 2-3 paris combinés avec cote estimée
- 💎 **La Grosse Confiance** : pari le plus sûr (edge élevé + Poisson convergent)
- 🎲 **L'Outsider à tenter** : pari risqué mais edge intéressant

### 10.3 Cache
- TTL : 6h (`AI_SCOUT_TTL`)
- Invalidé automatiquement à l'expiration
- Affiché dans le panneau `#ai-scout-panel` en haut de l'onglet Matchs

---

## 11. DESIGN SYSTEM

### 11.1 Variables CSS
```css
--bg: #0a0d0f         /* Fond principal */
--bg2: #111417        /* Cartes, tableaux */
--bg3: #181c20        /* Hover */
--bg4: #1e2328        /* Inputs, badges */
--green: #00e676      /* Accent principal, edge positif */
--red: #ff4d4d        /* Erreur, défaite */
--amber: #ffa726      /* Avertissement, mode démo */
--blue: #29b6f6       /* Colonnes Poisson, badge LIVE */
--text: #e8eaed       /* Texte principal */
--text2: #8d9399      /* Texte secondaire */
--text3: #5a6068      /* Texte tertiaire, labels */
```

### 11.2 Typographies
- **Syne** (700-800) : titres, logo, chiffres forts
- **Instrument Sans** (400-600) : corps de texte, UI
- **DM Mono** (400-500) : cotes, stats, codes, badges

### 11.3 Principes UX
- Fond noir "data terminal" avec accents vert néon
- Données compactes sur fond sombre — scrollable horizontalement
- Code couleur immédiat : vert = bon, orange = moyen, rouge = mauvais
- Badges LIVE/SIM pour la transparence des données
- Badge `≈` sur les colonnes Poisson pour distinguer calcul vs historique

---

## 12. ROADMAP

Phases 1–5 (MVP → Production) : toutes livrées. Voir `CHANGELOG.md` et section 15 pour la suite.

---

## 13. LANCEMENT & DÉVELOPPEMENT

### 13.1 Prérequis
- Node.js >= 16 (modules natifs `fs`, `https`, `path`, `url`)
- Fichier `.env` avec les 3 clés API

### 13.2 Démarrage

```bash
# 1. Cloner / copier les fichiers dans un dossier
# 2. Créer le .env
cat > .env << 'EOF'
PORT=3000
ODDS_API_KEY=votre_cle_odds
API_FOOTBALL_KEY=votre_cle_football
GEMINI_API_KEY=votre_cle_gemini
EOF

# 3. Lancer le serveur
node server.js

# 4. Ouvrir dans le navigateur
open http://localhost:3000
```

### 13.3 Ce que fait le serveur au démarrage
1. Parse `.env` (arrêt si absent)
2. Charge `database.json` et `history.json` (si existants)
3. Lance `fetchStats()` → `fetchOdds()` → `archivePastMatches()`
4. Si 0 matchs après fetch → charge `buildDemoMatches()` (20 matchs fictifs)
5. Démarre les cron jobs (12h + 6h)
6. Écoute sur `http://localhost:3000`

### 13.4 Logs serveur
```
╔══════════════════════════════════════════════════════╗
║           PariScore v2.0 — Backend API              ║
╠══════════════════════════════════════════════════════╣
║  Serveur      → http://localhost:3000               ║
║  API          → /api/v1/matches                     ║
║  Cron Odds    → toutes les 12h                      ║
║  Cron Stats   → toutes les 6h                       ║
╚══════════════════════════════════════════════════════╝

  ✓ database.json chargé (47 matchs, 320 équipes)
  ✓ history.json chargé (12 matchs archivés)
  [Cron:Stats] Ligue 61 → OK ...
  [Cron:Odds] soccer_epl → 10 matchs ...
  [Cron:Odds] ✓ 47 matchs fusionnés et sauvegardés
  ✓ Prêt — 47 matchs disponibles
```

---

## 14. CONTRAINTES & LIMITES CONNUES

| Contrainte | Impact | Mitigation |
|-----------|--------|------------|
| The Odds API : 500 req/mois | Cron max 12h | Bouton refresh manuel |
| API-Football PRO : 7 500 req/jour | Budget ample pour 18 ligues + live | Smart Polling 60s (19h-23h) + cache 24h |
| Matching noms d'équipe approximatif | Faux positifs fuzzy | Roadmap : Levenshtein |
| Poisson : moyenne de ligue fixe à 1.35 | Biais pour ligues défensives | Roadmap : moyenne dynamique |
| BTTS/Over = calcul indirect | Pas d'historique réel | Badge LIVE/SIM + tooltip ≈ |
| Saison 2024 codée en dur | Casse en juillet 2026 | Roadmap : dynamique |
| Gemini : facturation à l'usage | Coût variable | Cache 6h AI Scout |
| JSON concurrent (write) | Race condition théorique | Roadmap : SQLite |
| Mobile : tableau 1400px | Scroll horizontal | UX roadmap |
| Code mort résiduel après migration | SyntaxError fatale silencieuse | Toujours vérifier `node --check` après str_replace |
| IntersectionObserver + `display:none` | Contenu à `opacity:0`, invisible | Dans `showPage()`, forcer `.visible` sur tous les `.fade-up` |
| Colonnes Poisson avec `rowspan="2"` | Style incohérent, pas de tri | Utiliser `colspan="5"` en ligne 1 + `<th sortable>` en ligne 2 |
| Apostrophes dans strings JS | Double-échappement en cascade | Préférer les guillemets doubles pour les strings avec apostrophes |

---

## 15. TODOLIST — Roadmap v4.x

> Mis à jour le 29 avril 2026. Priorités révisées suite au passage au plan API-Football PRO.
> 🔥 P0 (Semaines 1-2 — Fiabilisation) · 🟡 P1 (Semaines 3-4 — Mode Live) · 🔮 P2-P3 (Long terme)

### 🔥 PRIORITÉ 0 — Quick Wins & Fiabilisation (Semaines 1-2)

- [ ] **Filtres L5/L10/L25 Client-Side** (temps dev: 2h)
  - PPG et forme sur X derniers matchs sans appel API supplémentaire
  - Utilise la chaîne `form` déjà transmise dans `/api/v1/matches` (`home_form`/`away_form`)
  - Filtres dans le tableau principal (dropdown au-dessus du tableau)
  - Déjà implémenté dans le modal Classement — étendre au tableau principal

- [ ] **Filtres avancés dans le tableau** (temps dev: 4-6h)
  - Probabilité Poisson min (slider Over 2.5 / BTTS)
  - Range de cotes (ex: 1.50 → 5.00)
  - Time to Kickoff (next-12h / next-24h / next-7d)
  - Filtre marché : 1X2 · BTTS · Over 2.5 · CS
  - Compteur live : "42 matchs — 8 value bets"

- [ ] **Page "Historique & Backtesting"** (temps dev: 1-2 jours)
  - Graph P&L cumulé (Chart.js — déjà inclus via CDN)
  - Tableau des 50 derniers paris vérifiés
  - KPIs : Win Rate, ROI, Longest Streak
  - Route existante : `GET /api/v1/history?limit=100`

### 🟡 PRIORITÉ 1 — Mode "Live" & Expérience Temps Réel (Semaines 3-4)

- [ ] **Architecture SSE (Server-Sent Events)** (temps dev: 1 jour)
  - Route `GET /api/v1/live` → flux SSE — zéro dépendance WebSocket
  - Frontend : `new EventSource('/api/v1/live')` → màj automatique des scores
  - Élimine le polling frontend de 5 min pour les matchs en cours
  - Déclencheur : `fixtures?live=all` toutes les 60s de 19h à 23h (Smart Polling)

- [ ] **Live Intensity Score** (temps dev: 2 jours)
  - Calcul en direct des dynamiques de pression (possession, tirs, corners)
  - Score composite 0-100 mis à jour à chaque poll live
  - Affiché dans la colonne Match et dans le modal Insights
  - Source : `fixtures?live=all` → champ `statistics` par équipe

- [ ] **Gestion Intelligente des Quotas API** (temps dev: 2h)
  - Utiliser le champ `"type": "T1/T2"` de `leagues_config.json`
  - T1 : rafraîchissement toutes les 6h (ligues majeures)
  - T2 : rafraîchissement toutes les 12h (ligues secondaires)

- [ ] **Dropping Odds Tracker** (temps dev: 2-3 jours)
  - Enregistrer snapshot cotes toutes les 2h dans `oddsHistory[]`
  - Colonne "Δ Odds" avec flèche ↓ rouge si baisse > 5%
  - Graph évolution cotes (Chart.js line) au clic
  - Filtre "Chutes > X%" dans la barre de filtres

- [ ] **Power Score V2 — Web Scraping Presse** (temps dev: 3-4 jours)
  - Intégrer L'Équipe, Marca (scraping ou API si disponible)
  - Enrichir `synthese_globale_web` avec vraies sources
  - Cache 24h pour éviter rate limiting
  - Fallback gracieux si scraping échoue

- [x] **Dashboard "Mes Alertes"** (v9.9.5 — livré 2026-05-13)
  - Page dédiée pour configurer alertes Telegram par utilisateur (`#page-alertes`)
  - Filtres personnalisés : Sport, Ligue, Marché, Edge min, Proba min
  - Toggle ON/OFF par alerte (value bets + live)
  - Preview dernières alertes envoyées (`/api/v1/alerts/history`)
  - Bouton "Tester l'alerte" → `/api/v1/alerts/test` (user-scoped, message simple)
  - Moteur alertes live momentum/pressure dans `pollLiveScores` (60s)
  - Cooldown 15min par (user, match) — anti-spam
  - Trigger : `live_intensity ≥ intensityMin` OU `|pressure.delta| ≥ pressureDeltaMin`
  - Persistance DB (kv `alert_prefs_<userId>`) + miroir localStorage (chatId)

- [ ] **Système de favoris** (temps dev: 2h)
  - Star icon sur chaque match
  - localStorage ou JWT-protected endpoint
  - Filtre "Mes Favoris" dans la barre de navigation
- ### 📊 DÉVELOPPEMENT : MODULE MOMENTUM LIVE
**Objectif :** Visualiser la pression offensive en temps réel.

- [ ] **Task : Algorithme Momentum (Backend)**
  - **Formule** : Créer un score composite `PressureIndex = (AttaquesDangereuses * 0.5) + (Tirs * 1.5) + (Corners * 1.0)`.
  - **Flux** : Calculer ce score toutes les 5 minutes et l'envoyer via SSE.

- [ ] **Task : Composant Graphique (UI Designer)**
  - **Outil** : Utiliser `Chart.js` ou un SVG dynamique.
  - **Design** : 
    - Courbe de type "Area Chart" avec un gradient.
    - Haut (Vert Néon #00e676) pour Leeds / Bas (Magenta #ff4d4d) pour Burnley.
    - Ligne centrale (0) pour l'équilibre.
  - **Placeholder** : Remplir le bloc "MOMENTUM DU MATCH" de l'image 1eb73c.png avec ce graphique.

### 🚀 MISE À JOUR UI : FILTRES AVANCÉS & DRAPEAUX
**Objectif :** Améliorer la navigation et l'engagement en direct.

- [ ] **Task : Intégration des Drapeaux dans les Filtres Championnat**
  - **Action** : Modifier le composant de génération des boutons de ligue dans `pariscore.html`.
  - **Mécanisme** : Utiliser le fichier `flags_config.json` existant pour injecter une balise `<img class="country-flag-mini">` à l'intérieur de chaque bouton de filtre (ex: 🇫🇷 Ligue 1).
  - **Design** : Les drapeaux doivent être circulaires (32px), placés à gauche du texte de la ligue.

- [ ] **Task : Nouveau Filtre "🔴 MATCHS EN LIVE"**
  - **Action** : Ajouter un bouton "LIVE" distinct au début de la liste des filtres (juste après "Toutes").
  - **Logique** : Ce filtre doit isoler les matchs dont le statut est actuellement en cours (en utilisant les données SSE existantes).
  - **Visuel** : Utiliser un badge pulsé rouge ou une icône 🔴 pour attirer l'attention.

- [ ] **Règle de Nettoyage Automatique** : Une fois ces éléments UI fonctionnels et le commit effectué, archiver cette tâche dans `ARCHIVE_PROJECT.md`.

### 🔮 PRIORITÉ 2-3 — Vision Long Terme (Mois 2-3)

- [ ] **In-Play Live Funnel** (temps dev: 1 semaine | Bloqueur: API live payante $50-200/mois)
  - Nécessite API-Football Live endpoints ou scraping Bet365
  - Scan continu matchs live avec stats (possession, tirs, pressure)
  - Alertes configurables : "Cote Home > 2.00 + domicile a 60% possession"
  - Décision : Reporter après monétisation (plan Pro)

- [x] **Bet Tracking Utilisateur** (v9.8 — livré 2026-05-12)
  - Page `Mes Paris` : KPIs + chart bankroll réelle + 3 tabs + filtres + modals (saisie/règlement/dépôt) + Kelly + export CSV
  - Tables `user_bets` + `bankroll_transactions`, scope `user_id`, INTEGER cents
  - Auto-suggestion de règlement quand match archivé verified (jamais auto-applied)
  - Reste hors scope : combinés/parlay, scraping 1xbet, cashout live

- [ ] **API Publique Documentée** (temps dev: 3-4 jours)
  - Swagger/OpenAPI auto-généré
  - Plan tarifaire : Free (100 req/j) / Pro (10k req/j, €19/mois) / Business (illimité, €99/mois)
  - Endpoints : `/api/value-bets`, `/api/predictions`, `/api/fixtures`, `/api/standings`
  - Rate limiting par token (Redis ou in-memory Map)
  - Documentation interactive (Swagger UI)

- [ ] **Migration SQLite** (temps dev: 2 jours)
  - Remplace `database.json` et `history.json`
  - Tables : `matches`, `history`, `users`, `bets`, `alerts`
  - Migrations Knex.js ou migration manuelle avec schema.sql
  - Backup automatique daily

- [ ] **Monétisation** (temps dev: 1 semaine)
  - Plan tarifaire : Gratuit (10 matchs/jour) / Pro (€19/mois illimité) / API (€39/mois)
  - Stripe integration (checkout + webhooks)
  - Landing page marketing + SEO
  - Tableau de bord abonnements (admin.html)

- [ ] **Onglet Tendances — Version Full** (temps dev: 5h | voir `oddalertstrend.md`)
  - Route `/api/v1/trends` + `generateTrends()` + `parseFormStreak()`
  - Frontend : trend-cards verticales, filtres marché (Win/BTTS/Over2.5/CS), durée min
  - Cron Premium optionnel : 30 req/jour pour BTTS/Over2.5/CS via `/fixtures?team&last=5`
  - Gate 🔒 Pro pour Super Tendances

### 🎯 Objectifs 3 Mois
100+ users · 10+ Pro payants · Accuracy >65% O2.5 · 1000+ matchs vérifiés · ROI positif "Edge>5%+Proba>60%"

### 💡 Positionnement
> *"L'alternative francophone premium avec IA explicative Gemini — comprendre POURQUOI parier, pas juste OÙ."*
Différenciation vs OddAlerts : Power Score IA · UI/UX terminal moderne · Backend zero-dep · Francophone

---

*PariScore — Cahier des charges v6.3 — 29 avril 2026*
*SQLite ✅ — Plan API-Football PRO. Prochaine étape : SSE Live → Smart Polling 60s → Filtres avancés.*

