// playerMomentum.js — OSS Pulse-inspired Momentum Score for Tennis/Football
// Adapts ErcinDedeoglu/oss-pulse methodology to sports player/team tracking
// Components: Velocity(40%) + Relative Growth(25%) + Acceleration(25%) + Consistency(10%)

class PlayerMomentumScorer {
  constructor() {
    // Store rolling windows of rating changes per player/team
    this.history = new Map(); // playerId → [{date, rating, timestamp}]
    this.maxHistory = 90; // keep 90 days of data
  }

  // Record a new rating snapshot for a player
  recordRating(playerId, rating, date = new Date()) {
    if (!this.history.has(playerId)) {
      this.history.set(playerId, []);
    }
    const hist = this.history.get(playerId);
    hist.push({ date: date.toISOString().split('T')[0], rating, ts: date.getTime() });
    if (hist.length > this.maxHistory) {
      this.history.set(playerId, hist.slice(-this.maxHistory));
    }
  }

  // Compute weekly gains for the last N weeks
  _computeWeeklyGains(snapshots, now) {
    const gains = [];
    for (let w = 1; w <= 4; w++) {
      const weekStart = now - w * 7 * 86400000;
      const weekEnd = now - (w - 1) * 7 * 86400000;
      const weekSnaps = snapshots.filter(s => s.ts >= weekStart && s.ts < weekEnd);
      if (weekSnaps.length >= 2) {
        const gain = weekSnaps[weekSnaps.length - 1].rating - weekSnaps[0].rating;
        gains.push(gain);
      }
    }
    return gains; // [thisWeek, lastWeek, 2weeksAgo, 3weeksAgo]
  }

  // Compute OSS Pulse-style momentum score (0-100)
  computeMomentumScore(playerId, now = Date.now()) {
    const snapshots = this.history.get(playerId) || [];
    if (snapshots.length < 3) return { score: 0, classification: 'insufficient_data', details: {} };

    const ratings = snapshots.map(s => s.rating);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const latest = snapshots[snapshots.length - 1].rating;
    const oldest = snapshots[0].rating;
    const totalGain = latest - oldest;

    // 1. Velocity (40%): absolute 7-day gain, normalized against rating scale
    const weekGains = this._computeWeeklyGains(snapshots, now);
    const thisWeekGain = weekGains[0] || 0;
    const velocityRaw = Math.max(0, thisWeekGain); // only positive counts
    const velocityPercentile = this._percentileScale(velocityRaw, 0, 50); // 50 rating points = max
    const velocity = Math.min(100, velocityPercentile * 100);

    // 2. Relative Growth (25%): gain as percentage of total rating
    const relGrowthRaw = avgRating > 0 ? (totalGain / avgRating) * 100 : 0;
    const relGrowth = this._clamp(relGrowthRaw * 20, 0, 100); // 5% growth = 100

    // 3. Acceleration (25%): this week vs last week
    const lastWeekGain = weekGains[1] || 0;
    const accelRaw = thisWeekGain - lastWeekGain;
    const acceleration = this._clamp(accelRaw * 5 + 50, 0, 100); // center at 50, 10pt diff = 100

    // 4. Consistency (10%): positive across 7/14/30 day windows
    let consistency = 0;
    const intervals = [7, 14, 30];
    for (const days of intervals) {
      const cutoff = now - days * 86400000;
      const period = snapshots.filter(s => s.ts >= cutoff);
      if (period.length >= 2) {
        const gain = period[period.length - 1].rating - period[0].rating;
        if (gain > 0) consistency += 100 / intervals.length;
      }
    }
    const consistencyScore = consistency;

    // Viral bonus: >5x baseline spike
    let viralBonus = 0;
    if (weekGains.length >= 3) {
      const baseline = (weekGains[1] + weekGains[2]) / 2;
      if (baseline > 0 && thisWeekGain > baseline * 5) viralBonus = 10;
    }

    // Weighted score
    const score = Math.round(
      velocity * 0.40 +
      relGrowth * 0.25 +
      acceleration * 0.25 +
      consistencyScore * 0.10 +
      viralBonus
    );

    // Classification (OSS Pulse quadrants)
    const isHighVolume = avgRating > 1500; // "big name" equivalent
    let classification;
    if (score >= 55 && isHighVolume) classification = 'hot';      // 🔥 Hot Giant
    else if (score >= 55 && !isHighVolume) classification = 'rising'; // 🚀 Rising Star
    else if (score < 55 && isHighVolume) classification = 'coasting'; // 🏔️ Coasting
    else classification = 'emerging'; // 🌱 Emerging

    return {
      score: Math.min(100, score),
      classification,
      details: {
        playerId,
        latestRating: Math.round(latest),
        avgRating: Math.round(avgRating),
        totalGain: Math.round(totalGain * 100) / 100,
        weekGains: weekGains.map(g => Math.round(g * 100) / 100),
        components: {
          velocity: Math.round(velocity),
          relativeGrowth: Math.round(relGrowth),
          acceleration: Math.round(acceleration),
          consistency: Math.round(consistencyScore),
          viralBonus,
        },
      },
    };
  }

  // Get top momentum players (for dashboard)
  getTopMomentum(limit = 20) {
    const results = [];
    for (const [id] of this.history) {
      const momentum = this.computeMomentumScore(id);
      if (momentum.score > 0) results.push(momentum);
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // Get all classifications
  getQuadrants() {
    return {
      hot: [], rising: [], coasting: [], emerging: [],
    };
  }

  _percentileScale(value, min, max) {
    if (value <= min) return 0;
    if (value >= max) return 1;
    return (value - min) / (max - min);
  }

  _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
}

module.exports = { PlayerMomentumScorer };
