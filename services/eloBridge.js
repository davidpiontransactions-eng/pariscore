'use strict';
/**
 * eloBridge.js — Bridge PlayerElo ↔ ParisScore computeEloProbs (bd ParisScorebis-q57t)
 *
 * Permet de cross-valider les prédictions PariScore (basées sur stats BSD/elo interne)
 * avec celles de PlayerElo (player-level Elo sur 176 ligues).
 *
 * ⚠️  Ce module ne MODIFIE PAS computeEloProbs() — il l'appelle et fournit un
 *     second avis PlayerElo pour comparaison. Le wiring final dans le Bayesian
 *     blender reste un choix produit (cf. bead ParisScorebis-q57t suivi).
 *
 * Use cases :
 *   - /api/v1/elo/cross-validate?matchId=X → consumer UI peut afficher "ParisScore: 45% / PlayerElo: 48%"
 *   - backtest A/B : comparer ROI modèle interne vs modèle PlayerElo
 *   - détection d'arbitrage quand les 2 modèles divergent fortement
 *
 * Convention :
 *   - normalisation noms (lowercase + strip accents + alphanum) — cohérent avec _normName server.js
 *   - cache mémoire léger (TTL 5 min — prédictions live)
 *   - retourne null si l'un ou l'autre manque (graceful degradation)
 *
 * Zéro dépendance npm — Node natif.
 */

const playerEloService = require('./playerEloService');

const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 min
const _mem = new Map();

function _normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Récupère la prédiction PlayerElo pour un match PariScore.
 * Stratégie : load all predictions, fuzzy match home/away.
 * @param {Object} match - { home_team, away_team, commence_time, ... }
 * @returns {Object|null} prédiction formatée ou null
 */
async function _findPlayerEloPrediction(match) {
  if (!playerEloService.enabled() || !match || !match.home_team || !match.away_team) return null;
  const cacheKey = `pred:${_normName(match.home_team)}|${_normName(match.away_team)}`;
  const cached = _mem.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;

  const raw = await playerEloService.fetchPredictions();
  if (!Array.isArray(raw)) { _mem.set(cacheKey, { ts: Date.now(), data: null }); return null; }
  const target = `${_normName(match.home_team)}|${_normName(match.away_team)}`;
  let best = null;
  for (const p of raw) {
    if (!p) continue;
    const key = `${_normName(p.home_team || p.home)}|${_normName(p.away_team || p.away)}`;
    if (key === target) { best = p; break; }
  }
  // Fallback : match partiel (home exact, away commence par même préfixe)
  if (!best) {
    for (const p of raw) {
      if (!p) continue;
      const h = _normName(p.home_team || p.home);
      const a = _normName(p.away_team || p.away);
      const tH = _normName(match.home_team);
      const tA = _normName(match.away_team);
      if (h.startsWith(tH.slice(0, 6)) && a.startsWith(tA.slice(0, 6))) { best = p; break; }
    }
  }
  const shaped = best ? playerEloService.toValueBetShape(best) : null;
  _mem.set(cacheKey, { ts: Date.now(), data: shaped });
  return shaped;
}

/**
 * Cross-valide un match PariScore avec PlayerElo.
 * Retourne un objet comparatif, ou null si l'un des deux manque.
 *
 * @param {Object} match - match PariScore (doit avoir home_team, away_team, stats)
 * @param {Function} computeEloProbs - injecté pour éviter require circulaire avec server.js
 * @returns {Object|null} { pariscore, playerelo, delta, agreement, confidence }
 */
async function crossValidate(match, computeEloProbs) {
  if (!match || !match.home_team || !match.away_team) return null;
  const pariscore = typeof computeEloProbs === 'function' ? computeEloProbs(match) : null;
  const playerelo = await _findPlayerEloPrediction(match);
  if (!pariscore && !playerelo) return null;

  const delta = (pariscore && playerelo) ? {
    home: (playerelo.prob_home != null && pariscore.homeWin != null)
      ? Math.round((playerelo.prob_home * 100 - pariscore.homeWin)) : null,
    draw: (playerelo.prob_draw != null && pariscore.draw != null)
      ? Math.round((playerelo.prob_draw * 100 - pariscore.draw)) : null,
    away: (playerelo.prob_away != null && pariscore.awayWin != null)
      ? Math.round((playerelo.prob_away * 100 - pariscore.awayWin)) : null,
  } : null;

  const agreement = (delta && delta.home != null && delta.draw != null && delta.away != null)
    ? (Math.abs(delta.home) < 5 && Math.abs(delta.draw) < 5 && Math.abs(delta.away) < 5 ? 'high' :
       Math.abs(delta.home) < 12 && Math.abs(delta.draw) < 12 && Math.abs(delta.away) < 12 ? 'medium' : 'low')
    : null;

  return {
    source: 'elo-bridge',
    match: {
      home_team: match.home_team,
      away_team: match.away_team,
      commence_time: match.commence_time || null,
    },
    pariscore: pariscore ? {
      method: pariscore.method || 'elo',
      home_win_pct: pariscore.homeWin,
      draw_pct: pariscore.draw,
      away_win_pct: pariscore.awayWin,
      home_elo: pariscore.homeElo || null,
      away_elo: pariscore.awayElo || null,
    } : null,
    playerelo: playerelo ? {
      prob_home_pct: playerelo.prob_home != null ? Math.round(playerelo.prob_home * 100) : null,
      prob_draw_pct: playerelo.prob_draw != null ? Math.round(playerelo.prob_draw * 100) : null,
      prob_away_pct: playerelo.prob_away != null ? Math.round(playerelo.prob_away * 100) : null,
      fair_odds: playerelo.fair_odds,
      market_odds: playerelo.market_odds,
      value: playerelo.value,
    } : null,
    delta_pct: delta,                                    // playerelo - pariscore (en points %)
    agreement,                                           // 'high' (<5pts) | 'medium' (<12pts) | 'low'
    confidence: (pariscore && playerelo) ? 'full' : (pariscore ? 'pariscore-only' : 'playerelo-only'),
    ts: Date.now(),
  };
}

/**
 * Récupère le statut global du bridge (utilisé par /api/v1/integrations/status).
 */
function getBridgeStatus() {
  return {
    playerelo_enabled: playerEloService.enabled(),
    cache_entries: _mem.size,
    cache_ttl_ms: CACHE_TTL_MS,
  };
}

function _clearCache() { _mem.clear(); }

module.exports = {
  crossValidate,
  getBridgeStatus,
  _clearCache,
};