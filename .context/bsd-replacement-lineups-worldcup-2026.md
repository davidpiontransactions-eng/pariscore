# Analyse de remplacement BSD — Compositions (Lineups) Coupe du Monde 2026

**Date :** 12 juin 2026 (màj 22 mai 2026 — stack finale)
**Contexte :** Élimination du routage BSD (Bzzoiro Sports Data, 5$/mo) pour les compositions.
**Projet :** PariScore — analyse de paris sportifs temps réel

---

## 1. État des lieux — Ce que BSD apportait

| Endpoint | Usage | Cache BSD |
|---|---|---|
| GET /v2/events/{id}/lineups/ | XI starters + banc + formation + absents | 30 min |
| GET /api/predicted-lineup/{eid}/ | Prédiction IA starters + blessures | 1 h |
| GET /player-stats/?event={id} | Scores ai_points par joueur | 30 min |
| GET /players/?team={id} | Roster complet + attributs | 24 h |

## 2. Solutions comparées — Lineups CDM 2026 (stack finale)

| Solution | Type | Coût CDM | Fiabilité | Intégration | Contrainte |
|---|---|---|---|---|---|
| **football-data.org (free)** | API | **0 EUR** | ★★★ | Très facile (déjà codé) | 10 req/min + rate-limiter FIFO |
| **Sofascore (direct)** | API | **0 EUR** | ★★★★★ | Très facile (microservice existant) | Aucune (sans clé, 100% CdM) |
| football-data.org Tier One | API | 49 EUR/mo | ★★★★ | Très facile (déjà codé) | 30 req/min |
| API-Football Pro | API | 19 USD/mo | ★★★★ | Facile (kill-switch) | 7 500 req/j |
| FIFA.com scraping | Scraping | 0 EUR | ★★★★★ | Moyen (BS4) | NON RETENU (Sofascore suffit) |
| Sofascore (Playwright) | Scraping | 0 EUR | ★★★ | Élevé (headless) | NON RETENU (API directe fonctionne) |
| Sportmonks Growth | API | 149 EUR/mo | ★★★★ | Facile | Trop cher |

## 3. Architecture implémentée (post-BSD)

```
Route : GET /api/v1/lineups/:matchId
         ↓
    L1: football-data.org (PRIMARY)
        - 12 compétitions free forever dont WC (FIFA World Cup)
        - Rate-limiter FIFO : 10 req/min max
        - Cache : confirmé=24h / prédit=5min / neg=5min
        - Format : XI + banc + formation + coach
        - Si vide → fallthrough L2
         ↓
    L2: Sofascore (FALLBACK, source réelle CdM)
        - /event/{id}/lineups (sans clé, 100% couverture)
        - findSofaEventId amélioré : 3 passes (ID direct → tournoi WC → search teams)
        - Cache : confirmé=24h / prédit=2min / neg=5min
        - Si vide → graceful 200 { lineups: null }
         ↓
    Frontend : loadLineups() dans modal Insights (onglet Compos)
        - Affiche XI + banc + absents (même format que BSD)
        - Auto-polling 10min si lineup_status !== 'confirmed'
        - Fallback gracieux si toutes sources vides
```

## 4. Détail technique des caches

| Cache | Clé | TTL confirmé | TTL prédit | TTL neg |
|---|---|---|---|---|
| FD lineups (route) | `fd_lineups_{matchId}` | 24h (86400000ms) | 5min (300000ms) | 5min |
| FD detail (général) | `fd_detail_{fdMatchId}` | 24h (pour bookings/refs/subs) | 24h | 1h |
| Sofa lineups (route) | `sofa_lineups_{sofaEventId}` | 24h via route | 2min (120000ms) | 2min |
| Sofa lineups (CRON) | appel direct, pas de cache | — | — | — |

## 5. Route CRON — Vérification 45min avant match

`checkLineups()` → `fetchLineups()` exécute la même cascade :
1. L1 football-data.org (via `fdRateLimit()`)
2. L2 Sofascore event
3. Fallback squad search par nom d'équipe
4. Fréquence : toutes les 15min

## 6. Recommandation finale

Stack **0 € / mois** opérationnelle :
- **PRIMARY** : football-data.org (gratuit, 10 req/min, 12 ligues dont WC)
- **FALLBACK** : Sofascore direct (gratuit, sans clé, 100% CdM)
- **PLAN B** : football-data.org Tier One (49 €/mois si 10 req/min insuffisant)

**Rate-limit** : FIFO queue intégré — safe.
**TTL** : compos confirmées = 24h (ne changent plus). Prédites = 5min.
**Déps** : ZÉRO (Node natif + Sofascore API déjà existante).

---

*Document généré le 12 juin 2026 — PariScore (màj 22 mai 2026)*
