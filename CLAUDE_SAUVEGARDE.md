# CLAUDE.md — PariScore : Cahier des Charges & Plan Projet

> Document de référence pour Claude et les contributeurs. Retrace l'intégralité des décisions techniques, de l'architecture, des contraintes et de la roadmap du projet.
> **Dernière mise à jour : 27 avril 2026 — v3.0 (en cours)**

---

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

### ✅ Phase 1 — MVP (v1.0)
- [x] Prototype HTML statique (CoteAlerte → PariScore)
- [x] SPA 6 onglets (Accueil, Matchs, Prédictions, Tendances, Alertes, Tarifs)
- [x] Connexion The Odds API (côté client)
- [x] Calcul edge no-vig
- [x] Filtres jour + ligue
- [x] Tableau style OddAlerts (double en-tête, code couleur)
- [x] Tri des colonnes
- [x] Analyse Gemini par match (modal)

### ✅ Phase 2 — Architecture (v2.0)
- [x] Migration vers architecture serveur-centrique
- [x] `server.js` Node.js natif (zéro dépendance)
- [x] Cron jobs (12h Odds, 6h Stats)
- [x] `database.json` persistant
- [x] API REST interne (`/api/v1/matches`, `/status`, `/refresh`, `/gemini`)
- [x] Frontend "stupide" — un seul `fetch()`
- [x] Audit sécurité 360° + correctifs P0/P1
  - [x] Blocage `.env`, `database.json`, path traversal (403)
  - [x] Mutex anti-race-condition
  - [x] `writeFile` asynchrone
  - [x] Limite POST 1 Mo
  - [x] Fix double tri frontend
  - [x] Couleur colonne Moy. Buts

### ✅ Phase 3 — Intelligence (v3.0)
- [x] **Option A** — Distribution de Poisson (remplacement formules linéaires)
  - [x] `poissonPMF()` + `computePoisson()`
  - [x] Matrice 7×7 → Over 0.5/1.5/2.5/3.5, BTTS, top 5 scores
  - [x] Expected Goals (`λ_dom`, `λ_ext`) dans la réponse API
  - [x] Colonnes Poisson unifiées dans le tableau (bleu)
- [x] **Option B** — Backtesting
  - [x] `archivePastMatches()` → `history.json`
  - [x] Récupération scores réels API-Football
  - [x] Métriques Over 2.5 / BTTS / Edge
  - [x] Route `/api/v1/accuracy`
- [x] **Option C** — AI Scout
  - [x] Route `/api/v1/ai-scout` (top 5 edges → Gemini)
  - [x] 3 sections : Combiné / Confiance / Outsider
  - [x] Cache 6h
  - [x] Panneau `#ai-scout-panel` dans l'onglet Matchs
- [x] Mise à jour CHANGELOG.md v3.0
- [x] Tests syntaxiques automatisés (node --check)

### ✅ Phase 4 — Fiabilisation (v3.1)
- [x] Matching équipes : algorithme Levenshtein / distance bigramme
- [x] Saison API-Football calculée dynamiquement (`currentSeason()`)
- [x] Nettoyage automatique des matchs expirés dans `database.json` (`cleanExpiredMatches()`)
- [x] Refresh automatique frontend toutes les 5 min (`startAutoRefresh()`)
- [x] Filtre Edge minimum dans le tableau (Tous / +1% / +3% / +5%★ / +10%)
- [x] Gestion 429 : `db.status = quota_epuise` + message frontend spécifique

### ✅ Phase 5 — Production (v4.0)
- [~] Base de données SQLite — requiert `npm install better-sqlite3` (reporté)
- [x] Authentification JWT (HMAC-SHA256, natif Node.js crypto) — `POST /api/v1/auth/login`
- [x] Alertes Telegram : `sendValueBetAlerts()` + route `/api/v1/telegram/test`
- [~] Comparateur de cotes — section statique (données live en roadmap v4.1)
- [x] Page Prédictions connectée à `/api/v1/predictions` (Poisson + recommandations)
- [x] Page Tendances connectée à `/api/v1/trends` (agrégats Poisson par ligue)
- [x] Dashboard admin `admin.html` (JWT, KPIs, accuracy, value bets, actions Telegram)
- [x] `render.yaml` — blueprint Render.com avec disque persistant et variables documentées
- [x] CORS configurable via `ALLOWED_ORIGIN` dans `.env`
- [~] HTTPS — géré par Render.com automatiquement en production

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

- [x] **Migration SQLite** ✅ FAIT (29 avril 2026)
  - `better-sqlite3` + `pariscore.db` — WAL mode — transactions atomiques
  - Migration one-shot depuis JSON au premier boot (`*.migrated`)
  - `db` en mémoire inchangé — zéro refactoring des 91 accès `db.*`

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

- [ ] **Dashboard "Mes Alertes"** (temps dev: 1-2 jours)
  - Page dédiée pour configurer alertes Telegram par utilisateur
  - Filtres personnalisés : Sport, Ligue, Marché, Edge min, Proba min
  - Toggle ON/OFF par alerte
  - Preview dernières alertes envoyées

- [ ] **Système de favoris** (temps dev: 2h)
  - Star icon sur chaque match
  - localStorage ou JWT-protected endpoint
  - Filtre "Mes Favoris" dans la barre de navigation

### 🔮 PRIORITÉ 2-3 — Vision Long Terme (Mois 2-3)

- [ ] **In-Play Live Funnel** (temps dev: 1 semaine | Bloqueur: API live payante $50-200/mois)
  - Nécessite API-Football Live endpoints ou scraping Bet365
  - Scan continu matchs live avec stats (possession, tirs, pressure)
  - Alertes configurables : "Cote Home > 2.00 + domicile a 60% possession"
  - Décision : Reporter après monétisation (plan Pro)

- [ ] **Bet Tracking Utilisateur** (temps dev: 1 semaine)
  - Prérequis : SQLite migration (remplace database.json)
  - CRUD paris : date, match, marché, cote, mise, statut
  - Auto-settlement après match terminé
  - Dashboard P&L graphique (Chart.js)
  - Support multiples, bet builders, accumulators

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

### 🎯 Objectifs 3 Mois Post-Audit

- [ ] 100+ utilisateurs actifs
- [ ] 10+ utilisateurs Pro payants
- [ ] Accuracy > 65% sur Over 2.5 buts
- [ ] 1000+ matchs vérifiés dans `history.json`
- [ ] ROI positif sur stratégie "Edge > 5% + Proba > 60%"

### 💡 Positionnement Stratégique

**PariScore ne doit PAS être un clone d'OddAlerts.**

Positionnement :
> *"L'alternative francophone premium avec IA explicative Gemini — pour les parieurs qui veulent comprendre **POURQUOI** parier, pas juste **OÙ** parier."*

**Différenciation :**
- OddAlerts = data-driven, froid, mathématique, UK-centric
- PariScore = data-driven + IA explicative (Power Score), chaud, pédagogique, francophone

**Nos avantages uniques :**
1. Power Score IA (Gemini) — analyse 5 piliers + Top 5 Paris recommandés
2. UI/UX Premium — design terminal moderne (Syne + DM Mono)
3. Backend Zero-Dependency — déployable partout, lightweight
4. Gratuit & Open — pas de paywall initial

---

*PariScore — Cahier des charges v6.3 — 29 avril 2026*
*SQLite ✅ — Plan API-Football PRO. Prochaine étape : SSE Live → Smart Polling 60s → Filtres avancés.*

---

## 16. Tâches Accomplies — Hors Roadmap Principale

> Fonctionnalités livrées en dehors des Phases 1→5. Voir `CHANGELOG.md` pour les détails d'implémentation.

### Tableau des Matchs — Améliorations Visuelles (28 avril 2026)
- [x] **Drapeaux pays réels** : `flags_config.json` + FlagCDN `<img class="country-flag">` dans colonne Match (fetch parallèle avec `/api/v1/matches`)
- [x] **Séparateurs de groupes** : classe `.sc.grp` (border-left 2px) + 4e paramètre `grp=true` dans `sc()` / `scp()`
- [x] **Uniformisation home/away** : suppression `color:var(--text2)` sur away_team → même style blanc que home_team
- [x] **"BTTS + Over Buts"** : renommage du groupe "Poisson" dans l'en-tête du tableau
- [x] **Buts en moyennes décimales** : `avgScored` / `avgConceded` remplacent les %, types `avg` et `avg-neg` dans `sc()` (green ≤1.0, orange ≤1.5, red >1.5)
- [x] **Score Prédit** : bouton ⚽ `openScoreMatrix(idx)` → modal 7×7 organisé par k=h-a, `poissonPMFClient()` client-side, probas résumées 1/N/2, style BeSoccer
- [x] **Groupe "Cotes"** : `<th colspan="3" class="stat-group">Cotes</th>` + sous-colonnes `1 / N / 2`
- [x] **Top 5 Scores Probables** : colonne Score ≈ puis upgrade en modal Score Prédit complet (⚽ button + matrice Poisson)

### Spider Chart Radar APT (28 avril 2026)
- [x] Chart.js CDN `@4.4.0` ajouté dans `<head>` (cause racine du radar vide identifiée et corrigée)
- [x] `maintainAspectRatio: false` → canvas remplit le conteneur `height:360px`
- [x] Axes traduits en français : **Note, Attaque, Effectif, Gardiens, Défense, Milieu**

### Expansion Catalogue — 18 Ligues (28 avril 2026)
- [x] `leagues_config.json` : 18 ligues T1/T2 avec `id`, `odds_key`, `cron_hours`
  - T1 Europe : Ligue 1(61), PL(39), CL(2), LaLiga(140), BL(78), SerieA(135), EL(3), CEL(848)
  - T1 Monde : MLS(253), Brasileirão(71), J1(98), K-League(292), Saudi Pro(307)
  - T2 Europe : Championship(40), Ligue 2(62), 2.BL(79), Serie B(136), Segunda(141)
- [x] `server.js` : `SPORT_LABELS`, `ALL_SPORTS`, `ALL_LEAGUE_IDS` construits dynamiquement depuis le JSON au boot
- [x] `fetchStats()` démarre avec `ALL_LEAGUE_IDS` + complète avec IDs découverts via fixtures

### Statistiques Avancées + Cache IA par Match (28 avril 2026)
- [x] `fetchTeamAdvancedStats(teamKey, teamId, leagueId, season)` : endpoint `/teams/statistics`, cache 24h dans `db.advancedTeamStats`
- [x] `generateAIScout()` enrichi : bloc `[DATA STATISTIQUES AVANCÉES]` avec 5 piliers par équipe via `Promise.all` (max 10 req/jour)
- [x] `ai_cache.json` : cache dédié per-match pour Power Score Gemini (TTL 24h), isolé de `database.json`, ajouté à `BLOCKED_FILES`
- [x] `_match_key` transparent : extrait du body (`delete parsed._match_key`) avant envoi à Gemini — jamais transmis à l'API

### Audit Stratégique OddAlerts Trends (28 avril 2026)
- [x] `oddalertstrend.md` : audit complet — UX/UI trend-cards, faisabilité data lean (0 API call extra pour Free tier), monétisation gate 🔒 Pro, plan technique détaillé
- [x] Architecture documentée : `generateTrends()`, `parseFormStreak()`, route `/api/v1/trends`, frontend HTML+CSS+JS, cron Premium optionnel

### Bugfixes Modals — Index Mismatch & Stats Fallback (28 avril 2026)
- [x] **Bug critique : mauvais match dans les modals** — `openInsights/openGemini/openScoreMatrix/openAttributesRadar` utilisaient `allMatches[idx]` où `idx` était l'index dans le tableau **filtré**, pas dans le tableau complet → le modal ouvrait un match aléatoire quand un filtre ligue/jour était actif.
- [x] **Correction** : tous les boutons du tableau passent désormais `m.id` (chaîne) au lieu de `idx` (entier) ; les 4 fonctions font `allMatches.find(x => x.id === matchId)`.
- [x] **Stats manquantes pour ligues mineures** : `buildResumeTab` et `buildStatsTab` fallback sur `d.match.stats?.home/away` quand l'équipe n'est pas trouvée dans `db.teamStats`.
- [x] **Migration cache v4.0** : `fetchTeamAdvancedStats` invalide les entrées `advancedTeamStats` antérieures à v4.0 (champ `shots_on_total` absent) → re-fetch automatique avec les nouveaux champs.

### Hub de Statistiques "Elite" — Modal PariScore Insights (28 avril 2026)
- [x] Modal de détails de match avec 9 piliers de données (route `/api/v1/insights/:matchId`, cache 24h).
- [x] Intégration des Cartons (yellow/red total depuis `/teams/statistics`) et xG/xGA (Poisson λ).
- [x] Module "Top Players" : buteurs + passeurs filtrés par équipe, mini-cartes avec photos, badge ★ MVP (meilleur rating).
- [x] Calculateur hybride IA/Poisson : `calculatePoisson(lH, lA, max)` + `poissonPMFClient()` côté client.
- [x] Classement dynamique avec filtres **Global / Dom. / Ext.** et tri multi-critères (Points / Buts+ / Buts- / Cartons).
- [x] Notes par Secteur (Attaque/Défense barres 0-10), Tirs cadrés Dom/Ext, xG Différentiel.
- [x] Pilier 4 (Corners) — non disponible dans `/teams/statistics` → classé P2 roadmap (requiert `/fixtures` stats, budget API).

### Quick Wins UX + Inspiration Datafoot (29 avril 2026)
- [x] **Sparklines de forme** : `formSparkline(form)` → SVG 40×16px inline dans colonne Match, dot coloré sur dernier résultat (W=vert, D=orange, L=rouge).
- [x] **Favoris localStorage** : bouton ★ sur chaque ligne, `ps_fav` localStorage Set, filtre chip "★ Favoris" dans barre Edge, `toggleFavorite(matchId, el)` + `toggleFavFilter()`.
- [x] **Match count sur filtres Jour** : "Aujourd'hui (8)" — compté depuis `allMatches` à chaque rendu, mis à jour dynamiquement.
- [x] **Onglet Graphique** : 5ème onglet dans modal Insights, `buildGraphiqueTab(d)` → SVG form evolution (polyline + dots W/D/L) pour home et away, + barres de bilan saison (V/N/D %).
- [x] **Accuracy pills** : badges colorés O2.5/BTTS/Edge dans status bar (vert ≥65%, orange ≥55%) — `<div id="accuracy-pills">` peuplé par `updateStatusBar()`.
- [x] **Badges de zone Rankings** : `.rk-zone-cl` (bleu, #1-4) / `.rk-zone-el` (vert, #5-6) / `.rk-zone-rel` (rouge, 3 derniers).
- [x] **`home_form`/`away_form`** dans `buildMatchRecord` (server.js) — transmis dans `/api/v1/matches`.
- [x] **Mobile compact** : `@media (max-width:768px)` masque Nuls/Défaites/xG.

### Onglet Classement — Refonte Rankings/Standings (28 avril 2026)
- [x] **Vue Rankings** : liste `# | Équipe [H/A] | Valeur | Barre` style BeSoccer/SofaScore, barres colorées selon Home/Away.
- [x] **Vue Standings** : tableau classique conservé, badges H/A sur les équipes du match.
- [x] **3 dropdowns** : Lieu (Global/Dom./Ext.) · Période (Saison/L5/L10/L25) · Critère (PPG/Buts+/Buts-/Cartons).
- [x] **PPG L5/L10/L25** calculé côté client depuis la chaîne `form` — zéro appel API.
- [x] Switch Rankings ↔ Standings instantané via `_rebuildClassement()`.

# TASK : Implémentation du module "Top Matchs par Stratégie" pour PariScore

## 🎯 Contexte et Objectif
PariScore est une plateforme d'analyse de paris sportifs. L'objectif de cette session est de développer une "killer feature" : un module permettant aux utilisateurs de voir instantanément les meilleurs matchs à jouer selon une stratégie précise (ex: BTTS, Over 2.5, Victoire Domicile), basés sur le plus haut pourcentage de confiance de notre algorithme.

## 🛠️ Spécifications Techniques

### 1. Backend / Traitement des données
- **Analyse préalable :** Identifie comment les matchs, les prédictions et les cotes sont actuellement modélisés et récupérés depuis la base de données ou l'API.
- **Création du service :** Implémente une fonction/endpoint `getTopMatchesByStrategy(strategyType, limit)` :
  - `strategyType` (string/enum) : La stratégie sélectionnée (ex: 'BTTS_YES', 'OVER_2_5', 'HOME_WIN').
  - `limit` (number) : Le nombre de matchs à retourner (par défaut 5 ou 10).
- **Logique métier :** La fonction doit filtrer les matchs à venir, isoler la prédiction correspondante à la stratégie, et trier les résultats par `% de confiance` en ordre décroissant (du plus sûr au moins sûr).

### 2. Frontend / UI
- **Composant de Navigation :** Crée un sélecteur de stratégie (ex: `StrategySelector`). Utilise des "Tabs" (onglets) ou des "Pills" pour que l'utilisateur puisse basculer rapidement d'une stratégie à l'autre.
- **Affichage des résultats :** Crée un composant d'affichage (ex: `TopMatchesList` ou grille de cartes).
- **Data UI :** Chaque carte de match doit afficher clairement :
  - Les équipes (Domicile vs Extérieur).
  - L'heure du coup d'envoi.
  - La cote actuelle pour cette stratégie.
  - **Le % de confiance** (Élément central : utiliser un code couleur type Vert > 75%, Orange > 60%, Rouge < 60% ou une barre de progression circulaire/linéaire).

### 3. Résilience et Scalabilité
- **Architecture Modulaire :** Gère la liste des stratégies via un objet de configuration ou un Enum centralisé pour faciliter l'ajout futur de nouvelles stratégies (ex: 'UNDER_3_5', 'DRAW_NO_BET') sans toucher au composant principal.
- **UX States :** - Implémente un état `Loading` (Skeleton loaders) pendant le changement de stratégie.
  - Implémente un état `Empty` (ex: "Aucun match avec une confiance suffisante pour cette stratégie aujourd'hui").

## 🚦 Instructions d'exécution pour Claude Code
1. Lis l'architecture actuelle du projet (fichiers de types, services API, composants UI principaux).
2. Fais-moi un résumé des fichiers que tu prévois de modifier ou de créer.
3. Attends ma validation ("GO") avant de commencer à écrire et injecter le code.