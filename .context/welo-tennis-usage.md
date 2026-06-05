# WElo Tennis — Utilisation des Routes API

## Modèle Mathématique

Implémentation du modèle Weighted Elo (WElo) de Kovalchik (FiveThirtyEight).

### Formules

**1. Probabilité logistique (classique Elo)**
```
p_i,j = 1 / (1 + 10^(-(R_i - R_j)/400))
```

**2. K-factor dynamique (Kovalchik)**
```
K_i = 250 / (M_i + 5)^0.4
```
Décroît à mesure que le joueur accumule de l'expérience (M = nombre de matchs).

**3. Facteur Margin-of-Victory (MoV)**
```
f = games_won_by_winner / (games_won_by_winner + games_won_by_loser)
```
Pondère la mise à jour selon la marge de victoire (nombre de jeux).

**4. Mise à jour (WElo update rule)**
```
E_i(t+1) = E_i(t) + K_i(t) × [A_i(t) - p_i,j(t)] × f(G_i,j(t))
```
Où A_i = 1 (gagnant), 0 (perdant)

---

## Routes API

### 1. POST /api/v1/tennis/elo/process-match

Traiter un match et mettre à jour les ratings ELO.

**Request:**
```json
{
  "player1_id": "federer_r",
  "player2_id": "nadal_r",
  "player1_games_won": 11,
  "player2_games_won": 9,
  "winner_id": "federer_r",
  "tournament": "Roland Garros",
  "circuit": "ATP",
  "round": "Final"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "player1": {
      "id": "federer_r",
      "eloBefore": 1650.5,
      "eloAfter": 1658.3,
      "delta": 7.8,
      "matchesPlayed": 247
    },
    "player2": {
      "id": "nadal_r",
      "eloBefore": 1645.2,
      "eloAfter": 1637.4,
      "delta": -7.8,
      "matchesPlayed": 246
    }
  }
}
```

---

### 2. GET /api/v1/tennis/elo/rankings

Afficher les top joueurs par Elo.

**Query Parameters:**
- `limit` (optional, default=100, max=1000) — Nombre de joueurs à retourner
- `circuit` (optional: ATP|WTA) — Filtrer par circuit

**URL Example:**
```
GET /api/v1/tennis/elo/rankings?limit=50&circuit=ATP
```

**Response:**
```json
{
  "rankings": [
    {
      "rank": 1,
      "player_id": "djokovic_n",
      "elo_rating": 1750.45,
      "matches_played": 312
    },
    {
      "rank": 2,
      "player_id": "nadal_r",
      "elo_rating": 1720.12,
      "matches_played": 325
    }
  ],
  "count": 50
}
```

---

### 3. GET /api/v1/tennis/elo/player/:playerId

Détail d'un joueur.

**URL Example:**
```
GET /api/v1/tennis/elo/player/federer_r
```

**Response:**
```json
{
  "player_id": "federer_r",
  "player_name": "Roger Federer",
  "elo_rating": 1658.3,
  "matches_played": 247,
  "atp_rank": null,
  "wta_rank": null,
  "circuit": "ATP",
  "last_match_at": 1619884800
}
```

---

### 4. GET /api/v1/tennis/elo/stats

Statistiques globales du modèle.

**Response:**
```json
{
  "totalPlayers": 1247,
  "avgElo": 1525.3,
  "minElo": 1200.0,
  "maxElo": 1850.5,
  "totalMatches": 45230,
  "avgMatchesPerPlayer": 36.2
}
```

---

## Architecture SQLite

### Table `tennis_players_elo`

```sql
CREATE TABLE tennis_players_elo (
  player_id TEXT PRIMARY KEY,
  player_name TEXT,
  elo_rating REAL NOT NULL DEFAULT 1500,
  matches_played INTEGER NOT NULL DEFAULT 0,
  last_match_at INTEGER,
  atp_rank INTEGER,
  wta_rank INTEGER,
  circuit TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

Index: `elo_rating DESC`, `circuit, elo_rating DESC`

### Table `tennis_matches_elo`

```sql
CREATE TABLE tennis_matches_elo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT UNIQUE,
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  player1_name TEXT,
  player2_name TEXT,
  winner_id TEXT NOT NULL,
  player1_games_won INTEGER NOT NULL,
  player2_games_won INTEGER NOT NULL,
  player1_elo_before REAL,
  player2_elo_before REAL,
  player1_elo_after REAL,
  player2_elo_after REAL,
  player1_elo_delta REAL,
  player2_elo_delta REAL,
  k_factor_p1 REAL,
  k_factor_p2 REAL,
  mov_factor REAL,
  tournament TEXT,
  circuit TEXT,
  round TEXT,
  processed_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

Index: `match_id`, `player1_id, player2_id`, `winner_id`, `circuit, processed_at`

---

## Workflow Backtest

1. **Chargement historique** : Récupérer tous les matchs ATP/WTA depuis une source (BSD, ESPN, Sackmann, etc.)
2. **Tri chronologique** : Trier les matchs par date
3. **Boucle backtest** : Pour chaque match, appeler `POST /api/v1/tennis/elo/process-match`
4. **Validation** : Comparer prédictions Elo vs résultats réels → mesurer accuracy
5. **Calibrage** : Ajuster paramètres si nécessaire (K initial, initial rating 1500, etc.)

### Pseudo-code backtest

```javascript
const matches = await fetchHistoricalMatches({ sport: 'tennis', season: 2024 });
const sorted = matches.sort((a, b) => new Date(a.date) - new Date(b.date));

for (const match of sorted) {
  const response = await fetch('/api/v1/tennis/elo/process-match', {
    method: 'POST',
    body: JSON.stringify({
      player1_id: match.player1.id,
      player2_id: match.player2.id,
      player1_games_won: match.player1_games,
      player2_games_won: match.player2_games,
      winner_id: match.winner.id,
      tournament: match.tournament,
      circuit: match.circuit,
      round: match.round
    })
  });
  const result = await response.json();
  console.log(`${match.player1.name} vs ${match.player2.name}: ${result.result.player1.delta.toFixed(1)}`);
}

// Enfin, récupérer les stats finales
const stats = await fetch('/api/v1/tennis/elo/stats').then(r => r.json());
console.log('Modèle stats:', stats);
```

---

## Calibrage & Tuning

### Paramètres initiaux

- `initialRating` = 1500 (standard Elo)
- `K baseline` = 250 (Kovalchik formula with exponent 0.4)
- `K decay` = exponent 0.4 sur (matches_played + 5)

### Points de tuning

1. **K initial** : Augmenter si on veut plus de volatilité, diminuer pour stabilité
2. **Exponent MoV** : Actuellement (games_won_winner / total_games) — pourrait être polynomiel
3. **Circuit weighting** : Appliquer multiplicateurs par circuit (ATP ≠ WTA)
4. **Surface adjustment** : Ajouter facteur surface (clay, grass, hard)

---

## Notes d'implémentation

- **Persistence** : État du calculator chargé depuis SQLite au boot
- **In-memory** : Tous les calculs faits en mémoire, SQLite c'est du storage
- **Idempotence** : Même match processé 2× = résultats identiques (basé sur timestamps)
- **No rate limits** : Pas de throttling sur les routes (add si nécessaire)

---

*WElo Tennis — Version 1.0*
*Intégration Kovalchik FiveThirtyEight model*
*PariScore v12.66+*
