# 🏗️ Audit MCP × Tabs — PariScore

**Date :** 2026-06-28  
**Version :** v10.77+  
**Périmètre :** 6 serveurs MCP configurés × 25 onglets/apps PariScore

---

## 📡 État des 6 serveurs MCP

| # | Serveur | Type | Status | Réponse | Utilisation dans l'app |
|---|---------|------|--------|---------|----------------------|
| 1 | **bzzoiro-sports** | HTTP MCP | ✅ **Activé** | OK | **Profonde** — BSD est le hub data principal |
| 2 | **sportdbdotdev** | HTTP MCP | ⚠️ **Non utilisé** | N/A | **Zéro appel** dans server.js |
| 3 | **sportradar** | Remote MCP | ⚠️ **Non utilisé** | N/A | **Zéro appel** dans server.js |
| 4 | **project_fs** | stdio (npx) | ✅ Dev tool | OK | Outil de navigation fichiers pour l'agent |
| 5 | **memory** | stdio (npx) | ✅ Dev tool | OK | Knowledge Graph pour l'agent (non seedé) |
| 6 | **git** | stdio (uvx) | ✅ Dev tool | OK | Opérations git pour l'agent |

**Légende :**  
- ✅ **Activé** = configuré ET utilisé activement  
- ⚠️ **Non utilisé** = configuré mais l'app n'y fait jamais appel  
- ✅ **Dev tool** = outils pour l'agent, pas pour l'app utilisateur

---

## 🗺️ Mapping MCP × Onglets — Qui utilise quoi ?

### FOOTBALL (page `matchs`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **BSD (bzzoiro)** | REST API | ✅ Oui | Événements, équipes, joueurs, classements, pronostics, compositions, shotmaps, incidents, clips, polymarket, diffusions TV |
| **BSD MCP enrich** | JSON-RPC | ✅ **Oui** | Odds compare, prédictions ML, polymarket, managers — enrichi toutes les 5min (cron) |
| **Football-Data.org** | REST API | ❌ Non | Top 12 ligues gratuites (enrichissement L2) |
| **OpenFootball GitHub** | JSON statique | ❌ Non | Fallback L4 top 5 ligues |
| **ESPN Soccer** | REST API | ❌ Non | Scoreboard, équipes, classements |
| **TheSportsDB** | REST API | ❌ Non | Recherche événements TV, photos équipes |
| **Sofascore** | REST API | ❌ Non | Statistiques live (headers spoofés) |
| **API-Football (v3)** | REST API | ❌ Non | **KILLED** (AF_REMOVED=true) |
| **Gemini (LLM)** | IA | ❌ Non | Deep Analysis, Power Score, BSD MCP context |
| **Tennis** | HTML intégré | ❌ Non | Section Tennis Abstract MCP Leaders |

**✅ BSD MCP utilisé :** OUI — enrichissement Football via BSD MCP (odds, prédictions ML, polymarket, incidents timeline, shotmap)

---

### TENNIS (page `tennis`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **BSD Tennis MCP** | **JSON-RPC MCP** | ✅ **Oui** | Passthrough direct via `/api/v1/tennis/mcp` — données temps réel |
| **BSD Tennis REST** | REST API | ✅ Oui | REST v2 tennis |
| **Tennis Abstract** | HTML scrappé | ❌ Non | Rapports Elo, **MCP Leaders** (serve/return 52w), Lottery, Birthdays |
| **MatchStat (RapidAPI)** | REST API | ❌ Non | ATP/WTA/ITF fixtures, joueurs, H2H, rankings |
| **Oddspapi.io (OddsPapi)** | REST API | ❌ Non | Cotes set betting (Pinnacle, bet365) |
| **ESPN Tennis** | REST API | ❌ Non | Scoreboard ATP/WTA |
| **BetExplorer** | Scraper | ❌ Non | Dropping odds |
| **Betfair WOM** | Scraper + API | ❌ Non | Moneyflow tennis |
| **Tennis Temple** | Scrapé | ❌ Non | Roland Garros ordre du jeu |
| **TEX (Tennis Exchange)** | API | ❌ Non | Matchs, calendrier, historique cotes |

**✅ BSD MCP utilisé :** OUI — BSD Tennis MCP est un serveur MCP dédié, proxé via server.js

---

### CS2 (page `cs2`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **BSD CS2 Service** | Module interne | ⚠️ Via BSD | Matchs, rankings HLTV |
| **Berserk Service** | Module interne | ❌ Non | Berserk League 1v1 |
| **Liquipedia Service** | Module interne | ❌ Non | Tier3 matchs |

**❌ Aucun MCP dédié utilisé.** BSD est le hub via son SDK, pas via le MCP.

---

### MMA/UFC (page `mma`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **MMA Service** | Module interne | ❌ Non | Combats, cotes, analyse, breakdown |
| **NLP Injury Scraper** | Python tool | ❌ Non | Pipeline blessures |

**❌ Aucun MCP utilisé.** Données via services internes uniquement.

---

### NBA (page `nba`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **ESPN NBA** | REST API | ❌ Non | Matchs, scoreboard (via module basket) |
| **TheSportsDB** | REST API | ❌ Non | Photos joueurs |

**❌ Aucun MCP utilisé.** Données ESPN gratuites uniquement.

---

### WNBA (page `wnba`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **ESPN WNBA** | REST API | ❌ Non | Matchs, props |

**❌ Aucun MCP utilisé.**

---

### FORMULE 1 (page `f1`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **F1 Service** | Module (Jolpica-Ergast + ESPN) | ❌ Non | Calendrier, pilotes, value bets |

**❌ Aucun MCP utilisé.**

---

### CYCLISME (page `cycling`) — Sources de données

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **Cycling Service** | Module interne | ❌ Non | Tour de France, value bets |

**❌ Aucun MCP utilisé.**

---

### PAGES SYSTÈME (Accueil, Hot Picks, Sure Bets, Comparateur, etc.)

| Source | Type | MCP ? | Utilisation |
|--------|------|-------|-------------|
| **BSD** | REST | ✅ Oui | Données matchs pour l'accueil |
| **Gemini/Groq** | LLM | ❌ Non | Prédictions IA, analyses |
| **Stripe** | REST | ❌ Non | Paiements |

**❌ Aucun MCP spécifique utilisé hors BSD.**

---

## 📊 Score d'intégration MCP par onglet

| Onglet | Score MCP | Détail |
|--------|-----------|--------|
| Football | **🟢 8/10** | BSD MCP enrichit activement (odds, prédictions ML, polymarket, incidents) |
| Tennis | **🟢 8/10** | BSD Tennis MCP dédié, Tennis Abstract MCP Leaders |
| CS2 | **🟡 3/10** | Via BSD SDK mais pas de MCP dédié |
| MMA | **🔴 1/10** | Aucun MCP, tout en services internes |
| NBA | **🔴 1/10** | Aucun MCP, ESPN gratuit uniquement |
| WNBA | **🔴 1/10** | Aucun MCP, ESPN gratuit uniquement |
| F1 | **🔴 1/10** | Aucun MCP, Jolpica-Ergast + ESPN |
| Cyclisme | **🔴 1/10** | Aucun MCP, module interne |
| Accueil / Hot Picks / Strat. | **🟡 4/10** | BSD REST utilisé mais pas via MCP |

---

## 🚨 Gaps identifiés

### Gap #1 — sportdbdotdev MCP (TheSportsDB) jamais appelé
- **Serveur configuré** mais **0 appel** dans tout server.js
- Pourtant : TheSportsDB (REST, même source) est utilisé pour photos joueurs et logos
- **Potentiel :** remplacer les appels REST TheSportsDB par le MCP sportdbdotdev pour bénéficier du format standardisé

### Gap #2 — sportradar MCP jamais appelé
- **Serveur configuré** mais **0 appel** dans tout server.js
- Sportradar couvre : Football, Tennis, NBA, MLB, NHL, F1, MMA — TOUS les sports de PariScore
- **Potentiel :** enrichissement premium des données existantes (cotes, statistiques avancées, play-by-play)

### Gap #3 — MMA, F1, Cycling sans aucun MCP
- Ces 3 onglets utilisent uniquement des modules internes (maison)
- **Pas de fallback** ni d'enrichissement externe structuré
- **Risque :** si une source interne tombe (ex: scraper cassé), l'onglet devient vide

### Gap #4 — Memory server non seedé
- Le Knowledge Graph est configuré dans `.mcp.json` mais les 5 entités PariScore n'ont pas persisté
- Le script `scripts/seed-knowledge-graph.ps1` existe mais attend l'exécution
- Le fichier de stockage `memory.jsonl` est dans le cache npx (pas dans le projet)

### Gap #5 — Knowledge Graph pas relié à l'app
- Le Memory server est un outil **agent-only** (pour Claude/opencode)
- Il n'est pas relié au backend server.js — les décisions d'architecture, stratégies, bugs connus ne sont pas exploitables par l'app

---

## 🎯 Recommandations par priorité

### P0 — Corriger le seed du Knowledge Graph
- Configurer `MEMORY_FILE_PATH` dans `.mcp.json` → `data/memory.jsonl` dans le projet
- Exécuter `scripts/seed-knowledge-graph.ps1`
- Vérifier la persistance entre sessions

### P1 — Intégrer sportdbdotdev MCP
**Pourquoi :** déjà configuré, clé API BSD utilisée, même source que TheSportsDB
**Comment :** remplacer les appels REST `thesportsdb.com` par le MCP `sportdbdotdev` via un module wrapper
**Onglets impactés :** Football (photos joueurs, logos, events TV), NBA (photos joueurs)

### P2 — Évaluer sportradar MCP pour les onglets orphelins
**Pourquoi :** couvre MMA, NBA, WNBA, F1 — les 4 onglets les moins bien servis
**Comment :** créer un service `sportradarService.js` qui wrappe le MCP, l'utiliser comme source L2/L3
**Onglets impactés :** MMA, NBA, WNBA, F1

### P3 — Ajouter un Health Check MCP visible
**Pourquoi :** savoir en un coup d'œil si les serveurs MCP répondent
**Comment :** ajouter une section "MCP Status" dans la page `/api/v1/sources/health` et/ou dans le panneau d'admin

### P4 — Bridge Memory → API
**Pourquoi :** rendre le Knowledge Graph accessible à l'app
**Comment :** ajouter une route `/api/v1/knowledge/search` qui interroge le Memory server
**Cas d'usage :** retrouver les bugs connus, les décisions d'architecture, les patterns de stratégies

---

## 📋 Résumé exécutif

```
Serveurs MCP configurés :  6
  ├─ Utiles à l'app       :  1 (bzzoiro-sports — BSD)
  ├─ Inutilisés par l'app :  2 (sportdbdotdev, sportradar)
  └─ Dev tools (agent)    :  3 (project_fs, memory, git)

Taux d'utilisation MCP réel :  17% (1/6 serveurs utile à l'app)
Taux d'utilisation MCP total :  67% (4/6 répondent)

Onglets bien couverts :   2/10 (Football, Tennis)
Onglets sous-couverts :   6/10 (CS2, MMA, NBA, WNBA, F1, Cyclisme)
Onglets non couverts :    2/10 (système mais pas critique)
```

---

*Audit généré le 2026-06-28 par orchestration agents gstack.*
