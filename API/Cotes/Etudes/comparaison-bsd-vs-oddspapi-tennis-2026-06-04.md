# Comparaison Sources Côtes Tennis — BSD vs OddsPapi
> PariScore | Étude comparative | 2026-06-04

---

## 1. Contexte

PariScore utilise BSD (Bzzoiro Sports Addon, $5/mois) comme source principale de données tennis live.  
BSD expose un endpoint dédié côtes multi-bookmakers : `/tennis/api/v2/matches/{id}/odds/`.  
OddsPapi est un concurrent direct proposant 300+ bookmakers dont Pinnacle.

**Question** : OddsPapi justifie-t-il un abonnement payant supplémentaire pour enrichir le module bettor du Top 10 Tennis ?

---

## 2. OddsPapi — Schéma Données Côtes

### 2.1 Niveau Fixture
| Champ | Type | Description |
|---|---|---|
| `fixtureId` | string | ID unique match |
| `participant1Id` | integer | ID joueur 1 |
| `participant2Id` | integer | ID joueur 2 |
| `sportId` | integer | Sport |
| `tournamentId` | integer | Tournoi |
| `seasonId` | integer | Saison |
| `statusId` | integer | Statut (pre-match / live / terminé) |
| `startTime` | ISO 8601 | Heure prévue |
| `trueStartTime` | ISO 8601 \| null | Heure réelle départ |
| `trueEndTime` | ISO 8601 \| null | Heure réelle fin |
| `updatedAt` | ISO 8601 | Dernière MAJ côtes |
| `hasOdds` | boolean | Côtes disponibles |
| `bookmakerOdds` | object | Côtes imbriquées par bookmaker |

### 2.2 Niveau Bookmaker (`bookmakerOdds["pinnacle"]`)
| Champ | Type | Description |
|---|---|---|
| `bookmakerIsActive` | boolean | Bookmaker actif sur ce match |
| `bookmakerFixtureId` | string | Référence interne bookmaker |
| `fixturePath` | URL | Lien direct vers la côte sur le site |
| `markets` | object | Marchés disponibles, clé = market_id |

### 2.3 Niveau Marché → Outcome → Players
| Champ | Type | Description |
|---|---|---|
| `active` | boolean | Côte active (non suspendue) |
| `price` | decimal | Côte décimale |
| `changedAt` | ISO 8601 | Timestamp dernier mouvement |
| `limit` | integer | Stake max autorisé (proxy liquidité sharps) |
| `playerName` | string \| null | Nom joueur (pour props) |
| `betslip` | varies | Données betslip |
| `bookmakerOutcomeId` | string | Référence outcome côté bookmaker |
| `exchangeMeta` | object | Metadata exchange (Betfair etc.) |

### 2.4 Coverage & Technique
- **Bookmakers** : 300+ dont Pinnacle, FanDuel, DraftKings, Bet365, BetMGM
- **Sports** : 60+ (tennis inclus, non dédié)
- **Markets** : Winner, props joueurs, totaux, spreads, sets
- **Temps réel** : WebSocket low-latency
- **Historique** : Gratuit (endpoint dédié)
- **Quota gratuit** : **250 req/mois** (pas par jour)

---

## 3. BSD Tennis — Schéma Données Côtes

Endpoint : `GET /tennis/api/v2/matches/{id}/odds/`  
Implémenté dans `server.js` via `_fetchBSDTennisOdds()` + `_extractTennisOddsSummary()`.

### 3.1 Payload brut BSD
```json
{
  "bookmakers_count": 14,
  "bookmakers": [
    {
      "bookmaker_slug": "bet365",
      "odds_player1": 1.85,
      "odds_player2": 1.95,
      "movement_player1": "SHORTENING",
      "movement_player2": "DRIFTING",
      "updated_at": "2026-06-04T10:23:00Z"
    }
  ]
}
```

### 3.2 Champs extraits par `_extractTennisOddsSummary()`
| Champ | Description |
|---|---|
| `books_count` | Nombre de bookmakers couvrant le match |
| `best_p1` | Meilleure côte décimale joueur 1 |
| `best_p1_bk` | Bookmaker offrant la meilleure côte J1 |
| `best_p2` | Meilleure côte décimale joueur 2 |
| `best_p2_bk` | Bookmaker offrant la meilleure côte J2 |
| `fair_p1` | Probabilité fair J1 (Shin-Hurley no-vig, %) |
| `fair_p2` | Probabilité fair J2 (%) |
| `avg_implied_p1` | Prob implicite moyenne tous books J1 (%) |
| `avg_implied_p2` | Prob implicite moyenne tous books J2 (%) |
| `movement_p1` | Consensus mouvement J1 : SHORTENING / DRIFTING / null |
| `movement_p2` | Consensus mouvement J2 : SHORTENING / DRIFTING / null |
| `updated_at` | Timestamp dernière mise à jour |

- **Cache** : 3h in-memory (`_bsdTennisOddsCache`)
- **Bookmakers** : ~14 (books européens soft, sans Pinnacle confirmé)
- **Markets** : Winner match uniquement
- **Movement** : Consensus agrégé (Σ SHORTENING > DRIFTING → SHORTENING)

---

## 4. Tableau Comparatif Exhaustif

| Critère | BSD Tennis | OddsPapi | Avantage |
|---|---|---|---|
| **Coût** | Inclus dans $5/mois BSD | Extra payant (~$10-20/mois estimé) | BSD |
| **Bookmakers count** | ~14 (soft European) | 300+ | OddsPapi |
| **Pinnacle (sharp)** | ❌ Absent | ✅ `bookmakerOdds["pinnacle"]` | OddsPapi |
| **Prix décimal best** | ✅ `best_p1/p2` | ✅ `price` par book | Égalité |
| **Book meilleur prix** | ✅ `best_p1_bk` | ✅ par key bookmaker | Égalité |
| **Fair prob déviggée** | ✅ Calculée inline Shin-Hurley | ❌ À calculer manuellement | BSD |
| **Avg implied prob** | ✅ `avg_implied_p1/p2` | ❌ À calculer manuellement | BSD |
| **Consensus mouvement** | ✅ SHORTENING/DRIFTING agrégé | ❌ `changedAt` brut — calcul manuel | BSD |
| **Timestamp mouvement** | ✅ `updated_at` | ✅ `changedAt` par outcome (précis) | OddsPapi |
| **Stake limit** | ❌ Absent | ✅ `limit` par outcome | OddsPapi |
| **Liquidité sharps** | ❌ Proxy faible (nb books) | ✅ `limit` Pinnacle = signal direct | OddsPapi |
| **Betslip URL** | ❌ | ✅ `fixturePath` | OddsPapi |
| **Props joueurs** | ❌ | ✅ `playerName` + markets dédiés | OddsPapi |
| **Totaux / Sets O/U** | ❌ | ✅ | OddsPapi |
| **Historique côtes** | ❌ | ✅ Gratuit | OddsPapi |
| **WebSocket temps réel** | ❌ Cache 3h | ✅ Low-latency WS | OddsPapi |
| **Clé en main** | ✅ Déjà traité (devig, consensus) | ❌ Post-traitement requis | BSD |
| **Déjà câblé PariScore** | ✅ 100% opérationnel | ❌ POC pending (bd `bjv`) | BSD |
| **Quota gratuit** | N/A (illimité dans $5/mois) | 250 req/mois | BSD |

---

## 5. Analyse par Use Case PariScore

### 5.1 D_movement (Top 10 Tennis Scoring)
**→ BSD suffisant.**  
SHORTENING/DRIFTING consensus sur ~14 books = signal valide pour le ranking fan/viewer.  
Implémenté, opérationnel, gratuit.

### 5.2 CLV bettor mode (Closing Line Value — ancrage sharp)
**→ OddsPapi supérieur.**  
Sans Pinnacle, `fair_p1` BSD = moyenne de books soft (marge 5-8%).  
EV calculée = surestimée de ~3-5 points de %.  
Pinnacle (marge ~2%) = ancrage mathématiquement juste.  
`limit` Pinnacle = validation liquidité du signal.

### 5.3 Marchés additionnels (O/U sets, totaux jeux)
**→ OddsPapi uniquement.**  
BSD ne couvre que le vainqueur match.  
Pour enrichir `computeTennisGamesOverUnder()` avec des côtes marché réelles = OddsPapi.

### 5.4 Alertes steam move temps réel
**→ OddsPapi supérieur.**  
`changedAt` précis par outcome + WebSocket = détection mouvement sous 1s.  
BSD cache 3h = steam détecté avec retard.

---

## 6. Calcul Quota OddsPapi pour PariScore

| Scénario | Requêtes/mois | Tier requis |
|---|---|---|
| Top 10 Tennis seulement (10 matchs × 1 fetch/j × 30j) | 300 | Gratuit dépassé |
| Tous matchs actifs tennis (~30/j × 30j, 1 fetch/match) | 900 | Payant |
| Avec invalidations cache (×2) | ~1 800 | Payant |
| Tennis + Football | ~5 000+ | Payant premium |

**Quota gratuit = 250 req/mois = insuffisant même pour tennis seul.**

---

## 7. Recommandation GO/NO-GO

### Court terme (maintenant)
**→ Rester BSD uniquement.**  
D_movement opérationnel. CLV interne acceptable pour mode viewer.  
OddsPapi = 0% câblé, prix inconnu, coût supplémentaire non justifié sans backtest ROI.

### Moyen terme (si prix OddsPapi ≤ $15/mois pour 900 req tennis)
**→ GO partiel : Pinnacle tennis uniquement.**  
- Intégrer `bookmakerOdds["pinnacle"].price` comme `clv_anchor_pinnacle`
- Recalculer `D_ev` bettor mode avec ancrage Pinnacle vs ancrage interne
- Mesurer réduction faux positifs value bets sur 50 matchs backtest
- Validation : CLV_pinnacle > CLV_interne → Δ mesurable avant/après

### Long terme (si expansion football)
**→ GO si prix ≤ $30/mois pour 5 000 req.**  
Football Pinnacle = différenciation premium majeure.  
Champ `limit` = proxy liquidité sharps → enrichit `reliability_score` existant.

---

## 8. Actions Requises (DG)

| # | Action | Effort | Priorité |
|---|---|---|---|
| 1 | Aller sur oddspapi.io/us/pricing : tester `books=1` (Pinnacle) + `sports=1` (tennis) + `req=900` → noter prix | 5 min | MED |
| 2 | Si prix ≤ $15/mois → créer bd issue POC OddsPapi Pinnacle tennis | — | MED |
| 3 | Backtest 50 matchs CLV Pinnacle vs CLV interne BSD → mesurer biais | 3h dev | LOW |

---

*Rapport généré 2026-06-04 — PariScore API/Cotes/Etudes*  
*Sources : codebase server.js `_extractTennisOddsSummary()` + docs OddsPapi v4 scrapés*
