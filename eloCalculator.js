// eloCalculator.js — WElo (Weighted Elo) Tennis
// Kovalchik FiveThirtyEight Model
// Formules: K-factor dynamique, Margin-of-Victory pondéré, logistique classique

class EloCalculator {
  constructor(initialRating = 1500) {
    this.playerState = new Map(); // { playerId → { elo, matchesPlayed } }
    this.initialRating = initialRating;
  }

  /**
   * Initialiser un joueur. Appel une fois au boot du modèle.
   * @param {string} playerId
   * @param {number} elo - Rating initial (défaut 1500)
   */
  initializePlayer(playerId, elo = this.initialRating) {
    if (!this.playerState.has(playerId)) {
      this.playerState.set(playerId, {
        elo: elo,
        matchesPlayed: 0
      });
    }
  }

  /**
   * Récupère l'état actuel d'un joueur
   * @param {string} playerId
   * @returns {{ elo: number, matchesPlayed: number }}
   */
  getPlayer(playerId) {
    this.initializePlayer(playerId);
    return this.playerState.get(playerId);
  }

  /**
   * Probabilité logistique : P(i gagne contre j)
   * p_{i,j}(t) = 1 / (1 + 10^(-(R_i(t) - R_j(t)) / 400))
   * @param {number} ratingI - Elo du joueur i
   * @param {number} ratingJ - Elo du joueur j
   * @returns {number} Probabilité [0, 1]
   */
  computeWinProbability(ratingI, ratingJ) {
    const eloGap = ratingI - ratingJ;
    return 1 / (1 + Math.pow(10, -eloGap / 400));
  }

  /**
   * K-Factor Dynamique Kovalchik
   * K_i(t) = 250 / (M_i(t) + 5)^0.4
   * Décroît à mesure que le joueur accumule de l'expérience
   * @param {number} matchesPlayed - Nombre total de matchs joués par ce joueur
   * @returns {number} K-factor
   */
  computeKFactor(matchesPlayed) {
    return 250 / Math.pow(matchesPlayed + 5, 0.4);
  }

  /**
   * Modificateur Margin-of-Victory (MoV)
   * Pondère la mise à jour selon la marge de victoire (nombre de jeux)
   *
   * Si gagnant : f = gamesWonByWinner / (gamesWonByWinner + gamesWonByLoser)
   * Si perdant : f = gamesWonByWinner / (gamesWonByWinner + gamesWonByLoser)
   *
   * Résultat: plus la victoire est nette, plus le coefficient est proche de 1
   * @param {number} gamesWonByWinner
   * @param {number} gamesWonByLoser
   * @returns {number} MoV factor [0.5, 1)
   */
  computeMarginalityOfVictoryFactor(gamesWonByWinner, gamesWonByLoser) {
    const totalGames = gamesWonByWinner + gamesWonByLoser;
    if (totalGames === 0) return 0.5; // Fallback (ne devrait pas arriver)
    return gamesWonByWinner / totalGames;
  }

  /**
   * Traiter un résultat de match et mettre à jour les Elos
   *
   * Pseudocode WElo:
   *   K_i = computeKFactor(M_i)
   *   p_i,j = computeWinProbability(R_i, R_j)
   *   f = computeMarginalityOfVictoryFactor(gamesWon_i, gamesWon_j)
   *
   *   Si i a gagné:
   *     A_i = 1
   *     ΔR_i = K_i × (1 - p_i,j) × f
   *   Sinon:
   *     A_i = 0
   *     ΔR_i = K_i × (0 - p_i,j) × f
   *
   *   R_i_new = R_i + ΔR_i
   *   R_j_new = R_j + ΔR_j (symétrique, A_j inverse)
   *   M_i += 1, M_j += 1
   *
   * @param {string} player1Id
   * @param {string} player2Id
   * @param {number} p1GamesWon - Jeux gagnés par player1
   * @param {number} p2GamesWon - Jeux gagnés par player2
   * @param {string} winnerId - ID du gagnant (player1Id ou player2Id)
   * @returns {{ player1: { elo: number, delta: number }, player2: { elo: number, delta: number } }}
   */
  processMatchResult(player1Id, player2Id, p1GamesWon, p2GamesWon, winnerId) {
    // Initialiser si besoin
    this.initializePlayer(player1Id);
    this.initializePlayer(player2Id);

    const p1State = this.playerState.get(player1Id);
    const p2State = this.playerState.get(player2Id);

    // Ratings avant mise à jour
    const r1Before = p1State.elo;
    const r2Before = p2State.elo;

    // K-factors
    const k1 = this.computeKFactor(p1State.matchesPlayed);
    const k2 = this.computeKFactor(p2State.matchesPlayed);

    // Probabilités de victoire
    const p1WinsProb = this.computeWinProbability(r1Before, r2Before);
    const p2WinsProb = 1 - p1WinsProb;

    // Facteur MoV (même pour les deux : c'est la marge de la victoire)
    const movFactor = this.computeMarginalityOfVictoryFactor(
      Math.max(p1GamesWon, p2GamesWon),
      Math.min(p1GamesWon, p2GamesWon)
    );

    // Déterminer qui a gagné
    const p1Won = winnerId === player1Id;
    const p2Won = winnerId === player2Id;

    // Mises à jour
    const delta1 = k1 * (p1Won ? 1 - p1WinsProb : 0 - p1WinsProb) * movFactor;
    const delta2 = k2 * (p2Won ? 1 - p2WinsProb : 0 - p2WinsProb) * movFactor;

    // Appliquer les mises à jour
    p1State.elo += delta1;
    p2State.elo += delta2;
    p1State.matchesPlayed += 1;
    p2State.matchesPlayed += 1;

    return {
      player1: {
        id: player1Id,
        eloBefore: r1Before,
        eloAfter: p1State.elo,
        delta: delta1,
        matchesPlayed: p1State.matchesPlayed
      },
      player2: {
        id: player2Id,
        eloBefore: r2Before,
        eloAfter: p2State.elo,
        delta: delta2,
        matchesPlayed: p2State.matchesPlayed
      }
    };
  }

  /**
   * Importer un dump JSON d'état (pour reload persiste)
   * @param {Object} state - { playerState: { playerId: { elo, matchesPlayed } } }
   */
  loadState(state) {
    if (state && state.playerState) {
      for (const [playerId, playerData] of Object.entries(state.playerState)) {
        this.playerState.set(playerId, playerData);
      }
    }
  }

  /**
   * Exporter l'état complet (pour persistence)
   * @returns {Object}
   */
  exportState() {
    const state = {};
    for (const [playerId, playerData] of this.playerState.entries()) {
      state[playerId] = playerData;
    }
    return { playerState: state };
  }

  /**
   * Récupérer tous les joueurs triés par Elo (top N)
   * @param {number} limit - Nombre de joueurs à retourner
   * @returns {Array<{ playerId, elo, matchesPlayed }>}
   */
  getTopPlayers(limit = 100) {
    const players = [];
    for (const [playerId, state] of this.playerState.entries()) {
      players.push({ playerId, ...state });
    }
    players.sort((a, b) => b.elo - a.elo);
    return players.slice(0, limit);
  }

  /**
   * Statistiques globales du modèle
   * @returns {Object}
   */
  getStats() {
    const players = Array.from(this.playerState.values());
    const elos = players.map(p => p.elo);
    const matchesPlayed = players.map(p => p.matchesPlayed);

    return {
      totalPlayers: players.length,
      avgElo: elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0,
      minElo: elos.length > 0 ? Math.min(...elos) : 0,
      maxElo: elos.length > 0 ? Math.max(...elos) : 0,
      totalMatches: matchesPlayed.reduce((a, b) => a + b, 0),
      avgMatchesPerPlayer: matchesPlayed.length > 0
        ? matchesPlayed.reduce((a, b) => a + b, 0) / matchesPlayed.length
        : 0
    };
  }

  /**
   * Validation : comparer Elo prédicted vs réel historique
   * Utile pour calibrage modèle post-training
   * @param {Array<Object>} testMatches - [{ player1Id, player2Id, p1Games, p2Games, winnerId }, ...]
   * @returns { accuracy, predictions: { correctlyPredicted, totalMatches } }
   */
  validateOnTestSet(testMatches) {
    let correctlyPredicted = 0;

    for (const match of testMatches) {
      const p1State = this.getPlayer(match.player1Id);
      const p2State = this.getPlayer(match.player2Id);

      const p1WinsProb = this.computeWinProbability(p1State.elo, p2State.elo);

      // Prédiction : si proba > 0.5, on prédit player1 gagnant
      const predicted = p1WinsProb > 0.5 ? match.player1Id : match.player2Id;
      const actual = match.winnerId;

      if (predicted === actual) {
        correctlyPredicted++;
      }
    }

    return {
      accuracy: testMatches.length > 0 ? (correctlyPredicted / testMatches.length) : 0,
      predictions: {
        correctlyPredicted,
        totalMatches: testMatches.length
      }
    };
  }
}

// Export pour Node.js
module.exports = EloCalculator;
