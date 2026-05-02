# 🏟️ PariScore - Poste de Pilotage (v5.18)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **General Manager (GM)**, **Chef de Projet** et **Manager de l'équipe d'agents PariScore**.
- **Posture** : Tu es responsable de la fiabilité du produit. Anticipe les dérives et n'attends pas d'ordres pour corriger les données.
- **Autorité** : Si une compétence manque, agis en **Recruteur** : propose un nouvel agent spécialisé ou un outil MCP.
- **Rigueur** : Une erreur de donnée est une défaillance de ton équipe que tu dois auditer et résoudre immédiatement.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES
1. **Auto-Maintenance** : À la fin de chaque opération, transfère le compte-rendu dans `ARCHIVE_PROJECT.md` et nettoie `CLAUDE.md`.
2. **Gestion du Contexte** : Maintenir ce fichier sous les 30k caractères en permanence.
3. **Validation Data** : Vérification systématique Home/Away via `sqlite-inspector` avant clôture.

## ✅ v5.20 Final — Roadmap 100% livrée

Projet en état de lancement. Tous les items P0/P1/P2 sont terminés.

### Sessions archivées
Voir `ARCHIVE_PROJECT.md.md` pour le détail complet des sessions v5.9 → v5.20 :
- P0 : Bug sync, auth PBKDF2, CORS, backtest rolling30
- P1 : Insights, monétisation IA (freemium/premium), marketing/affiliation, live predictions
- P2 : H2H filter, accuracy trend chart, bankroll, auto-alerte, corners data, H2H matchups
- Semaine Zéro Erreur : 4 bugs corrigés, backtest O25 67% BTTS 73%

## 🏗️ ARCHITECTURE & STACK

### Backend (`server.js` — ~4800 lignes)
- **Runtime** : Node.js natif, zéro framework HTTP (pas Express)
- **DB** : SQLite3 WAL mode (`pariscore.db`) via `better-sqlite3` (seule dépendance npm)
- **Persistance** : KV store table `kv` + tables `users`, `matchday_passes`, `ai_feedback`
- **Auth** : JWT custom HMAC-SHA256 + PBKDF2 (100k itérations), rôles freemium/premium/admin/matchday
- **Admin auth** : PBKDF2 salé en mémoire (USERS Map), force_change au 1er login

### APIs externes intégrées
| API | Usage | Cron | Cache |
|-----|-------|------|-------|
| **The Odds API** | Cotes bookmakers (20+) | 12h | Remplacement complet |
| **API-Football** | Standings, fixtures, live, injuries, topscorers, **players** | 6h T1 / 12h T2 | 6h standings, 24h avancées |
| **Gemini AI** | Power Score analysis, Scout reports | On-demand | 24h par match |
| **Stripe** | Matchday Pass payments | On-demand | — |
| **RSS/GNews** | Contexte presse Power Score V2 (4 sources) | On-demand | 24h |
| **Telegram Bot** | Alertes value bets | On odds refresh | — |

### Core algorithmes
- **Poisson** : Matrice 7×7 → probs 1N2, BTTS, Over/Under, scores probables
- **Edge** : Détection value bets (fair odds vs best bookmaker)
- **PariScore Shield** : Convergence Poisson + Marché sur même résultat
- **findFuzzy()** : Matching équipes (exact → prefix → Levenshtein strict ≤1/2)

### Frontend (`pariscore.html` — ~5870 lignes)
- **SPA** : 6 onglets (Accueil, Historique, Stratégies, Insights, Admin, Premium)
- **Temps réel** : SSE (Server-Sent Events) pour updates
- **Charts** : Chart.js P&L Over 2.5 + BTTS + badges league accuracy + rolling 30
- **Live** : Top 5 panel + modal detail (xG timeline + momentum)
- **Fallback** : 20 matchs démo si APIs down

### Déploiement
- **Platform** : Render.com (`render.yaml`)
- **Live** : Smart polling scores 19h-23h Paris
- **Archive** : Cron 4h `archivePastMatches()` + retry unverified >24h

### Skills
- Suite `Caveman` (review, compress, commit) dans `./.agents/skills/`
- Skills PariScore (`ps-audit`, `ps-test`, `ps-changelog`, `ps-deploy`, `ps-add-strategy`) dans `./.claude/skills/`

## 📈 ROADMAP COURTE TERME
1. **P1** : ✅ Dashboard Mes Alertes (per-user Telegram) livré.
2. **P1** : ✅ SSE Architecture `/api/v1/live` → EventSource frontend.
3. **P1** : ✅ Gestion Quotas T1/T2 différenciés (cron 1h, gating per-league).
4. **P1** : ✅ Dropping Odds Tracker — colonne Δ + CSS up/down/flat.
5. **P0** : ✅ Sécurité Admin PBKDF2 salé + change-password.
6. **P0** : ✅ CORS hardening + security headers.
7. **P1** : ✅ Back-testing rolling window + per-league + confidence tiers + BTTS chart.
8. **P1** : ✅ Insights Hub P1 fixes (averages, position ratings, xG label).
9. **P0** : ✅ Bug ai-stream 500 (error handling + diagnostic match lookup).
10. **P1** : ✅ AI Modal streaming SSE + Prompt V3 (YouTube + consensus).
11. **P1** : ✅ Marketing & Affiliation v5.11 (hero accuracy badge, CPA inversé, partenaires, boutons parier).
12. **P1** : ✅ Live Top 5 + Detail modal v5.16 (xG charts, momentum, incidents).
13. **P1** : ✅ Live Stats Panel Redesign v5.18 (side-by-side bars, 9 stats).
14. **P1** : ✅ Live Predictions v5.19 — Scénarios Poisson + xG + momentum (Top 5).
15. **P1** : ✅ Live Stats Panel — intégrer Attaques Dangereuses, Passes, Précision si dispo.
16. **P1** : ✅ Streaks & Forme 5 matchs sur match cards.
17. **P1** : ✅ Momentum Bar Live (style Sofascore) — dans le modal live detail.
18. **P1** : ✅ H2H Filtre Dom/Ext.
19. **P1** : ✅ Semaine Zéro Erreur (QA + backtests O25 67% BTTS 73%).
20. **P2** : ✅ Accuracy Trend Chart (weekly rolling average).
21. **P2** : ✅ Units/bankroll tracking (flat 1u).
22. **P2** : ✅ Auto-alerte accuracy < 45% sur 20 derniers.
23. **P2** : ✅ Corners data (BSD history).
24. **P2** : ✅ H2H Matchups (API-Football headtohead).

## 📋 PRÊT POUR LANCEMENT

> ✅ v5.20 Final — Roadmap P0/P1/P2 100% livrée.

### Post-lancement (optionnel)
- Dashboard Mes Alertes Telegram (per-user)
- Dropping Odds Tracker temps réel
- Migration SQLite complète (bets, users)
- API Publique documentée (Swagger)
- Units tracking avec vraies cotes

---
*Historique complet dans `ARCHIVE_PROJECT.md`.*
