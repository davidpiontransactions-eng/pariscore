// glicko2Calculator.js — Glicko-2 Tennis Rating System
// Implémentation du modèle Glicko-2 (Mark E. Glickman) adapté au tennis
// Modélise séparément les skills au service et au retour (Korzekwa, 2013)
// 
// Formules : http://www.glicko.net/glicko/glicko2.pdf
// Tennis adaptation : danielkorzekwa/tennis-player-compare

class Glicko2Player {
  constructor(rating = 1500, deviation = 350, volatility = 0.06) {
    this.rating = rating;        // μ: interval scale rating
    this.deviation = deviation;  // φ: rating deviation (RD)
    this.volatility = volatility;// σ: volatility (consistency)
    this.lastUpdate = null;      // timestamp of last update
  }
}

class Glicko2Calculator {
  constructor(tau = 0.5, discountDays = 180) {
    this.tau = tau;                     // system constant (0.3-1.2, default 0.5)
    this.discountDays = discountDays;   // time discount in days (decay)
    this.players = new Map();           // playerId → Glicko2Player
    this.TAU_SCALE = 173.7178;          // Glicko-2 rating conversion constant
    this.PI = Math.PI;
  }

  // Initialize or retrieve a player
  getPlayer(playerId) {
    if (!this.players.has(playerId)) {
      this.players.set(playerId, new Glicko2Player());
    }
    return this.players.get(playerId);
  }

  // Convert rating to Glicko-2 scale: μ = (r - 1500) / 173.7178
  _toScale(rating) { return (rating - 1500) / this.TAU_SCALE; }

  // Convert Glicko-2 scale back to rating: r = μ * 173.7178 + 1500
  _fromScale(mu) { return mu * this.TAU_SCALE + 1500; }

  // g(φ) = 1 / sqrt(1 + 3φ²/π²)
  _g(phi) { return 1 / Math.sqrt(1 + 3 * phi * phi / (this.PI * this.PI)); }

  // E(μ, μj, φj) = 1 / (1 + exp(-g(φj)(μ - μj)))
  _E(mu, muj, phij) {
    return 1 / (1 + Math.exp(-this._g(phij) * (mu - muj)));
  }

  // Compute time discount factor for deviation increase between matches
  _timeDecay(player, now) {
    if (!player.lastUpdate) return 0;
    const daysElapsed = (now - player.lastUpdate) / (1000 * 60 * 60 * 24);
    return Math.min(daysElapsed / this.discountDays, 1.0);
  }

  // Increase deviation to account for time since last match
  _applyTimeDecay(player, now) {
    const decay = this._timeDecay(player, now);
    if (decay > 0 && this.discountDays > 0) {
      const phi = player.deviation / this.TAU_SCALE;
      const phiNew = Math.sqrt(phi * phi + decay * (0.06 * 0.06));
      player.deviation = phiNew * this.TAU_SCALE;
    }
  }

  // Compute expected score (0-1) for player A against player B
  computeExpectedScore(playerAId, playerBId) {
    const a = this.getPlayer(playerAId);
    const b = this.getPlayer(playerBId);
    const mu = this._toScale(a.rating);
    const muj = this._toScale(b.rating);
    const phij = b.deviation / this.TAU_SCALE;
    return this._E(mu, muj, phij);
  }

  // Probability of winning a point on serve by player A against player B on return
  // P_s(P1|P2) ≈ ratingServe(P1) vs ratingReturn(P2)
  computeServeWinProbability(serverId, returnerId, serveRatings, returnRatings) {
    const srv = serveRatings || this;
    const ret = returnRatings || this;
    const server = srv.getPlayer(serverId);
    const returner = ret.getPlayer(returnerId);
    const mu = this._toScale(server.rating);
    const muj = this._toScale(returner.rating);
    const phij = returner.deviation / this.TAU_SCALE;
    return this._E(mu, muj, phij);
  }

  // Update rating after observing a match period result
  // score: observed ratio (0-1) of points won by player A against player B
  // opponentIds: array of opponent player IDs played against in this period
  // opponentRatings: array of opponent rating objects { rating, deviation }
  // scores: array of observed scores
  _playerUpdate(player, now, opponentRatings, scores) {
    if (!opponentRatings.length) return;

    // Step 2: Convert to Glicko-2 scale
    const mu = this._toScale(player.rating);
    const phi = player.deviation / this.TAU_SCALE;
    const sigma = player.volatility;

    // Step 3: Compute v (estimated variance)
    let vInv = 0;
    for (let j = 0; j < opponentRatings.length; j++) {
      const op = opponentRatings[j];
      const muj = this._toScale(op.rating);
      const phij = op.deviation / this.TAU_SCALE;
      const gVal = this._g(phij);
      const EVal = this._E(mu, muj, phij);
      vInv += gVal * gVal * EVal * (1 - EVal);
    }
    const v = vInv > 0 ? 1 / vInv : 1e10;

    // Step 4: Compute Δ (estimated improvement)
    let delta = 0;
    for (let j = 0; j < opponentRatings.length; j++) {
      const op = opponentRatings[j];
      const muj = this._toScale(op.rating);
      const phij = op.deviation / this.TAU_SCALE;
      delta += this._g(phij) * (scores[j] - this._E(mu, muj, phij));
    }
    delta *= v;

    // Step 5: Determine new volatility σ' (iterative)
    const a = Math.log(sigma * sigma);
    const epsilon = 0.000001;
    const tauSq = this.tau * this.tau;

    const f = (x) => {
      const ex = Math.exp(x);
      const phiSqPlusVEx = phi * phi + v + ex;
      return ex * (delta * delta - phi * phi - v - ex) / (2 * phiSqPlusVEx * phiSqPlusVEx) - (x - a) / tauSq;
    };

    let A = a;
    let B;
    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * tauSq) < 0) k++;
      B = a - k * this.tau;
    }

    let fA = f(A), fB = f(B);
    let iter = 0;
    while (Math.abs(B - A) > epsilon && iter < 20) {
      const C = A + (A - B) * fA / (fB - fA);
      const fC = f(C);
      if (fC * fB <= 0) { A = B; fA = fB; }
      else { fA /= 2; }
      B = C; fB = fC;
      iter++;
    }
    const sigmaPrime = Math.exp(A / 2);

    // Step 6: Update deviation
    const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

    // Step 7: Update deviation and rating
    const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    const muPrime = mu + phiPrime * phiPrime * (delta / v);

    // Convert back to Glicko scale
    player.rating = this._fromScale(muPrime);
    player.deviation = phiPrime * this.TAU_SCALE;
    player.volatility = sigmaPrime;
    player.lastUpdate = now;
  }

  // Process a match result with serve points data
  // p1ServeWon, p1ServeTotal: serve stats for player 1
  // p2ServeWon, p2ServeTotal: serve stats for player 2
  // Returns: { p1Serve, p1Return, p2Serve, p2Return } with before/after ratings
  processMatchResult(player1Id, player2Id, 
    p1ServeWon, p1ServeTotal, p2ServeWon, p2ServeTotal,
    matchTime = Date.now()) {

    const p1 = this.getPlayer(player1Id);
    const p2 = this.getPlayer(player2Id);

    // Calculate observed ratios
    const p1ServeRatio = p1ServeTotal > 0 ? p1ServeWon / p1ServeTotal : 0.5;
    const p2ServeRatio = p2ServeTotal > 0 ? p2ServeWon / p2ServeTotal : 0.5;
    const p1ReturnRatio = p2ServeTotal > 0 ? 1 - p2ServeRatio : 0.5;
    const p2ReturnRatio = p1ServeTotal > 0 ? 1 - p1ServeRatio : 0.5;

    // Apply time decay
    this._applyTimeDecay(p1, matchTime);
    this._applyTimeDecay(p2, matchTime);

    const before = {
      p1Serve: { rating: p1.rating, deviation: p1.deviation, volatility: p1.volatility },
      p2Serve: { rating: p2.rating, deviation: p2.deviation, volatility: p2.volatility },
    };

    // Update P1 serve skill vs P2 return skill
    // P1 serve against P2 return: P1's serve rating competes against P2's return rating
    this._playerUpdate(p1, matchTime,
      [{ rating: p2.rating, deviation: p2.deviation }],
      [p1ServeRatio]
    );

    // Update P2 serve skill vs P1 return skill
    this._playerUpdate(p2, matchTime,
      [{ rating: p1.rating, deviation: p1.deviation }],
      [p2ServeRatio]
    );

    const after = {
      p1Serve: { rating: p1.rating, deviation: p1.deviation, volatility: p1.volatility },
      p2Serve: { rating: p2.rating, deviation: p2.deviation, volatility: p2.volatility },
    };

    return {
      player1Id, player2Id,
      before, after,
      p1ServeRatio, p2ServeRatio,
      p1ReturnRatio, p2ReturnRatio,
      delta: {
        p1Rating: after.p1Serve.rating - before.p1Serve.rating,
        p2Rating: after.p2Serve.rating - before.p2Serve.rating,
      }
    };
  }

  // Export state for persistence
  exportState() {
    const state = {};
    for (const [id, p] of this.players) {
      state[id] = {
        rating: p.rating,
        deviation: p.deviation,
        volatility: p.volatility,
        lastUpdate: p.lastUpdate,
      };
    }
    return { players: state, tau: this.tau, discountDays: this.discountDays };
  }

  // Import state from persistence
  loadState(state) {
    if (!state || !state.players) return;
    this.tau = state.tau || this.tau;
    this.discountDays = state.discountDays || this.discountDays;
    for (const [id, data] of Object.entries(state.players)) {
      const p = new Glicko2Player(data.rating, data.deviation, data.volatility);
      p.lastUpdate = data.lastUpdate;
      this.players.set(id, p);
    }
  }

  // Get top players by rating
  getTopPlayers(limit = 100) {
    const result = [];
    for (const [id, p] of this.players) {
      result.push({ playerId: id, ...p });
    }
    result.sort((a, b) => b.rating - a.rating);
    return result.slice(0, limit);
  }

  // Get global statistics
  getStats() {
    const all = Array.from(this.players.values());
    const ratings = all.map(p => p.rating);
    const deviations = all.map(p => p.deviation);
    return {
      totalPlayers: all.length,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      maxRating: ratings.length ? Math.max(...ratings) : 0,
      minRating: ratings.length ? Math.min(...ratings) : 0,
      avgDeviation: deviations.length ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 350,
    };
  }
}

// ── Tennis-specific wrapper: 2 Glicko-2 systems (serve + return) ──────────────
class TennisGlicko2 {
  constructor(tau = 0.5, discountDays = 180) {
    this.serveCalc = new Glicko2Calculator(tau, discountDays);
    this.returnCalc = new Glicko2Calculator(tau, discountDays);
  }

  getServeRating(playerId) {
    return this.serveCalc.getPlayer(playerId);
  }

  getReturnRating(playerId) {
    return this.returnCalc.getPlayer(playerId);
  }

  // Initialize a new player with defaults
  initializePlayer(playerId, serveRating = 1500, returnRating = 1500) {
    const sp = this.serveCalc.getPlayer(playerId);
    sp.rating = serveRating;
    const rp = this.returnCalc.getPlayer(playerId);
    rp.rating = returnRating;
  }

  // P_s(P1|P2): probability P1 wins a point on serve against P2 on return
  computeServeWinProbability(serverId, returnerId) {
    return this.serveCalc.computeServeWinProbability(
      serverId, returnerId, this.serveCalc, this.returnCalc
    );
  }

  // P_r(P1|P2) = 1 - P_s(P2|P1): probability P1 wins a point on return
  computeReturnWinProbability(returnerId, serverId) {
    return 1 - this.computeServeWinProbability(serverId, returnerId);
  }

  // Process a full match result
  processMatchResult(player1Id, player2Id,
    p1ServeWon, p1ServeTotal, p2ServeWon, p2ServeTotal,
    matchTime = Date.now()) {

    const p1ServeRatio = p1ServeTotal > 0 ? p1ServeWon / p1ServeTotal : 0.5;
    const p2ServeRatio = p2ServeTotal > 0 ? p2ServeWon / p2ServeTotal : 0.5;

    // P1's serve skill vs P2's return skill
    const srvP1 = this.serveCalc.getPlayer(player1Id);
    const retP2 = this.returnCalc.getPlayer(player2Id);
    this.serveCalc._applyTimeDecay(srvP1, matchTime);
    this.returnCalc._applyTimeDecay(retP2, matchTime);

    const beforeP1Serve = { ...srvP1 };
    const beforeP2Return = { ...retP2 };

    this.serveCalc._playerUpdate(srvP1, matchTime,
      [{ rating: retP2.rating, deviation: retP2.deviation }],
      [p1ServeRatio]
    );
    this.returnCalc._playerUpdate(retP2, matchTime,
      [{ rating: beforeP1Serve.rating, deviation: beforeP1Serve.deviation }],
      [1 - p1ServeRatio]
    );

    // P2's serve skill vs P1's return skill
    const srvP2 = this.serveCalc.getPlayer(player2Id);
    const retP1 = this.returnCalc.getPlayer(player1Id);
    this.serveCalc._applyTimeDecay(srvP2, matchTime);
    this.returnCalc._applyTimeDecay(retP1, matchTime);

    const beforeP2Serve = { ...srvP2 };
    const beforeP1Return = { ...retP1 };

    this.serveCalc._playerUpdate(srvP2, matchTime,
      [{ rating: retP1.rating, deviation: retP1.deviation }],
      [p2ServeRatio]
    );
    this.returnCalc._playerUpdate(retP1, matchTime,
      [{ rating: beforeP2Serve.rating, deviation: beforeP2Serve.deviation }],
      [1 - p2ServeRatio]
    );

    return {
      player1Id, player2Id,
      p1: {
        serveBefore: beforeP1Serve, serveAfter: { ...srvP1 },
        returnBefore: beforeP1Return, returnAfter: { ...retP1 },
      },
      p2: {
        serveBefore: beforeP2Serve, serveAfter: { ...srvP2 },
        returnBefore: beforeP2Return, returnAfter: { ...retP2 },
      },
    };
  }

  // Export both systems
  exportState() {
    return {
      serve: this.serveCalc.exportState(),
      return: this.returnCalc.exportState(),
    };
  }

  // Import both systems
  loadState(state) {
    if (state.serve) this.serveCalc.loadState(state.serve);
    if (state.return) this.returnCalc.loadState(state.return);
  }

  getStats() {
    return {
      serve: this.serveCalc.getStats(),
      return: this.returnCalc.getStats(),
    };
  }
}

module.exports = { Glicko2Player, Glicko2Calculator, TennisGlicko2 };
