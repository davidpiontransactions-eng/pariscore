// ═══════════════════════════════════════════════════════════════════════
// tennis-serializer.js — Serializer canonique des cartes Tennis (shared module)
// ═══════════════════════════════════════════════════════════════════════
// Module partagé entre server.js (production) et test-serializer.js (tests).
// Avant : les 3 fonctions étaient dupliquées → notice de sync manuelle.
// Maintenant : source unique dans ce fichier, require() des deux côtés.
//
// Contrat data : voir redesign-tennis/CONTRAT-DATA.md
// Le frontend ne doit plus deviner le type des champs (proba 0-1 vs 65, etc.).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

/**
 * Sérialise un match tennis en "card" canonique.
 * Normalise tous les champs : players (objets), odds (objet|null avec stale/age_ms),
 * fair (proba 0-1), signal (EV% pilote), traps (array jamais undefined).
 * @param {object} m - match brut issu du pipeline tennis
 * @returns {object|null} card canonique, ou null si m invalide
 */
function serializeTennisCard(m) {
  if (!m || typeof m !== 'object') return null;

  // --- Joueurs (toujours objets, champs null si absents) ---
  function serializePlayer(p) {
    p = p || {};
    return {
      id: p.id || null,
      name: p.name || null,
      country: p.country || null,
      flag: p.flag || null,
      photo: p.photo || null,
      rank: (typeof p.rank === 'number') ? p.rank : (p.rank ? Number(p.rank) : null),
      elo_surface: (typeof p.elo_surface === 'number') ? p.elo_surface : null,
      surf_rank: p.surf_rank || null,
      surf_rank_total: p.surf_rank_total || null,
      surf_form: p.surf_form || null,
      l5_pts: (typeof p.l5_pts === 'number') ? p.l5_pts : null,
      l10_pts: (typeof p.l10_pts === 'number') ? p.l10_pts : null,
      powerscore: (typeof p.powerscore === 'number') ? p.powerscore : null,
      serve_index: p.serve_index || null,
      receive_index: p.receive_index || null,
      serve_hold_pct: p.serve_hold_pct || null,
      return_pct: p.return_pct || null,
      gamesLast14Days: p.gamesLast14Days || null
    };
  }

  var p1 = serializePlayer(m.player1);
  var p2 = serializePlayer(m.player2);

  // --- Cotes (toujours objet ou null, stale + age_ms) ---
  var odds = null;
  if (m.odds && m.odds.p1 && m.odds.p2) {
    var oddsTs = m.odds.ts || m._odds_ts || Date.now();
    var ageMs = Date.now() - oddsTs;
    var isLive = (m.is_live || m.status === 'live' || m.tab === 'live');
    var staleThreshold = isLive ? 600000 : 14400000; // 10min live, 4h prematch
    odds = {
      p1: { odds: Number(m.odds.p1.odds) || null, book: m.odds.p1.book || null },
      p2: { odds: Number(m.odds.p2.odds) || null, book: m.odds.p2.book || null },
      stale: ageMs > staleThreshold,
      age_ms: ageMs
    };
  }

  // --- Fair (Shin devig, toujours objet ou null, proba 0-1) ---
  var fair = null;
  if (m.fair && m.fair.p1 != null) {
    fair = {
      p1: normalizeProb(m.fair.p1),
      p2: normalizeProb(m.fair.p2),
      margin: m.fair.margin != null ? Number(m.fair.margin) : null,
      method: m.fair.method || null
    };
  }

  // --- Signal (EV% pilote, toujours objet ou null) ---
  var signal = computeSignal(m, odds, fair);

  // --- Traps (array, jamais undefined) ---
  var traps = [];
  if (m.trap_bet) traps.push('trap_bet');
  if (odds && odds.stale) traps.push('drift');
  if (m.player1 && m.player1.gamesLast14Days > 12) traps.push('fatigue');
  if (m.player2 && m.player2.gamesLast14Days > 12) traps.push('fatigue');
  if ((p1.surf_rank_total !== null && p1.surf_rank_total < 20) ||
      (p2.surf_rank_total !== null && p2.surf_rank_total < 20)) {
    traps.push('surface_elo_low');
  }
  if (!signal && (!p1.elo_surface || !p2.elo_surface)) {
    traps.push('data_insufficient');
  }

  return {
    id: String(m.id || ''),
    tab: m.is_live || m.status === 'live' ? 'live' : 'prematch',
    is_live: !!(m.is_live || m.status === 'live'),
    tour: m.tour || null,
    tournament: m.tournament || null,
    surface: m.surface || null,
    round: m.round || null,
    bestOf: Number(m.best_of || m.bestOf || 3),
    commence_time: m.start_time || m.commence_time || null,
    status: m.status || null,
    player1: p1,
    player2: p2,
    odds: odds,
    fair: fair,
    signal: signal,
    traps: traps,
    // ── Champs score live (fix bug score figé — régression B2) ──
    // Transfert direct depuis le cache _tennisLiveCache. Le frontend les lit
    // conditionnellement (pariscore.html mapMatch), donc ils DOIVENT survivre
    // au serializer, sinon le score live (sets/jeux/point/service) disparaît.
    player1_sets: (m.player1_sets != null) ? m.player1_sets : null,
    player2_sets: (m.player2_sets != null) ? m.player2_sets : null,
    sets: Array.isArray(m.sets) ? m.sets : null,
    current_set_index: (m.current_set_index != null) ? m.current_set_index : null,
    current_point: (m.current_point != null) ? m.current_point : null,
    serving: (m.serving != null) ? m.serving : null,
    current_game_p1: (m.current_game_p1 != null) ? m.current_game_p1 : null,
    current_game_p2: (m.current_game_p2 != null) ? m.current_game_p2 : null,
    // Cotes live flat (distinctes de odds structuré ci-dessus — legacy front)
    odds_player1: (m.odds_player1 != null) ? m.odds_player1 : null,
    odds_player2: (m.odds_player2 != null) ? m.odds_player2 : null,
    // Momentum/champs live enrichis par pollTennisLive (préserver pour le front)
    momentum: m.momentum || null,
    momentum_series: m.momentum_series || null,   // chart DR évolution (pariscore.html momentumChart)
    dr_series: m.dr_series || null,               // série temporelle Dominance Ratio
    dr_per_set: m.dr_per_set || null,             // DR agrégé par set
    bppi: m.bppi || null,                         // Break Point Pressure Index
    liveProbability: (m.liveProbability != null) ? m.liveProbability : null, // proba live réajustée au score
    _raw_predictions: m.predictions || null,
    _raw_best_ev_model: m.best_ev_model || null
  };
}

/**
 * Normalise une proba : accepte 0.62, 62, "62%", renvoie toujours 0-1 (ou null).
 * @param {*} p - proba brute
 * @returns {number|null} proba normalisée 0-1
 */
function normalizeProb(p) {
  if (p == null) return null;
  var n = Number(p);
  if (!isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

/**
 * Calcule le signal canonique {label, side, prob, ev_pct, confidence, stale}.
 * EV% = valeur attendue du meilleur côté (proba_modèle × cote − 1).
 * @param {object} m - match brut
 * @param {object|null} odds - cotes sérialisées
 * @param {object|null} fair - probas fair sérialisées
 * @returns {object|null} signal canonique
 */
function computeSignal(m, odds, fair) {
  if (!odds || !odds.p1.odds || !odds.p2.odds) return null;
  if (!fair || fair.p1 == null) return null;

  var be = m.best_ev_model;
  var side, probModel, evPct, oddsVal;
  if (be && be.odds) {
    side = be.side || (be.ev >= 0 ? 'p1' : 'p2');
    probModel = be.p_model || (side === 'p1' ? fair.p1 : fair.p2);
    oddsVal = Number(be.odds);
    evPct = (typeof be.ev === 'number') ? be.ev : ((probModel * oddsVal - 1) * 100);
  } else {
    var ev1 = fair.p1 * odds.p1.odds - 1;
    var ev2 = fair.p2 * odds.p2.odds - 1;
    if (ev1 >= ev2) {
      side = 'p1'; probModel = fair.p1; oddsVal = odds.p1.odds; evPct = ev1 * 100;
    } else {
      side = 'p2'; probModel = fair.p2; oddsVal = odds.p2.odds; evPct = ev2 * 100;
    }
  }

  var hasBSD = m.predictions && m.predictions.bsd;
  var hasWEloSurface = m.player1 && m.player2 && m.player1.elo_surface && m.player2.elo_surface;
  // Échantillon surface suffisant (>= 150 matchs) : gate de fiabilité de l'ELO surface.
  var hasSurfSample = m.player1 && m.player2 &&
    (m.player1.surf_rank_total >= 150) && (m.player2.surf_rank_total >= 150);
  var confScore = (hasBSD ? 1 : 0) + (hasWEloSurface ? 1 : 0) + (hasSurfSample ? 1 : 0);
  // Sans échantillon surface suffisant, l'ELO surface n'est pas fiable → plafond 'medium'.
  var confidence = (!hasSurfSample)
    ? (confScore >= 1 ? 'medium' : 'low')
    : (confScore >= 2 ? 'high' : confScore === 1 ? 'medium' : 'low');

  return {
    label: 'VALUE ' + (evPct >= 0 ? '+' : '') + evPct.toFixed(1) + '%',
    side: side,
    prob: probModel,
    ev_pct: Math.round(evPct * 10) / 10,
    odds: oddsVal,
    confidence: confidence,
    stale: odds.stale
  };
}

module.exports = {
  serializeTennisCard: serializeTennisCard,
  normalizeProb: normalizeProb,
  computeSignal: computeSignal
};
