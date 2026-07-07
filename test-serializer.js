// test-serializer.js — Test du serializer tennis canonique
// Version standalone : les 3 fonctions sont copiées de server.js pour éviter
// de démarrer le serveur (port 3000) lors d'un test unitaire.
// ⚠️ Si tu modifies _serializeTennisCard/_normalizeProb/_computeSignal dans
// server.js, reporte les changements ici (ou passe à un extraction en module).

// ── Début : copie conforme depuis server.js ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
// Serializer tennis canonique — normalise un match avant envoi HTTP.
// Le frontend ne doit plus deviner le type des champs (proba 0-1 vs 65, etc.).
// Contrat : voir redesign-tennis/CONTRAT-DATA.md
// ═══════════════════════════════════════════════════════════════════════
function _serializeTennisCard(m) {
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
      p1: _normalizeProb(m.fair.p1),
      p2: _normalizeProb(m.fair.p2),
      margin: m.fair.margin != null ? Number(m.fair.margin) : null,
      method: m.fair.method || null
    };
  }

  // --- Signal (EV% pilote, toujours objet ou null) ---
  var signal = _computeSignal(m, odds, fair);

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
    _raw_predictions: m.predictions || null,
    _raw_best_ev_model: m.best_ev_model || null
  };
}

// Normalise une proba : accepte 0.62, 62, "62%", renvoie toujours 0-1
function _normalizeProb(p) {
  if (p == null) return null;
  var n = Number(p);
  if (!isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

// Calcule le signal canonique {label, side, prob, ev_pct, confidence, stale}
function _computeSignal(m, odds, fair) {
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
// ── Fin : copie conforme depuis server.js ──────────────────────────────────

// ── Tests ──────────────────────────────────────────────────────────────────
var assert = require('assert');

var mockMatch = {
  id: 'test-1', tour: 'ATP', tournament: 'Doha', surface: 'Hard', round: 'QF',
  best_of: 3, start_time: '2026-07-08T13:00:00Z',
  player1: { id: 'p1', name: 'Djokovic', country: 'SRB', flag: '🇷🇸', photo: 'http://x/p1.jpg', rank: 1, elo_surface: 2150, surf_rank_total: 120, l5_pts: 4, powerscore: 0.85 },
  player2: { id: 'p2', name: 'Sinner', country: 'ITA', flag: '🇮🇹', photo: 'http://x/p2.jpg', rank: 4, elo_surface: 2050, surf_rank_total: 100, l5_pts: 3, powerscore: 0.78 },
  odds: { p1: { odds: 1.85, book: 'Unibet' }, p2: { odds: 2.10, book: 'Unibet' } },
  fair: { p1: 0.62, p2: 0.38, margin: 0.04, method: 'shin' },
  edge: { p1: 0.08, p2: -0.02 },
  best_ev_model: { side: 'p1', player: 'Djokovic', odds: 1.85, book: 'Unibet', ev: 14.7, p_model: 0.62 },
  predictions: { elo: { p1: 0.62, p2: 0.38 }, blended: { p1: 0.62, p2: 0.38 }, bsd: { p1: 0.60, p2: 0.40 } }
};

var out = _serializeTennisCard(mockMatch);

assert.strictEqual(out.id, 'test-1', 'id');
assert.strictEqual(out.tab, 'prematch', 'tab défaut prematch');
assert.strictEqual(out.surface, 'Hard', 'surface');
assert.strictEqual(out.bestOf, 3, 'bestOf');
assert.strictEqual(out.player1.rank, 1, 'rank p1');
assert.ok(out.odds.stale === false, 'odds.stale bool');
assert.ok(typeof out.odds.age_ms === 'number', 'odds.age_ms');
assert.ok(out.signal !== null, 'signal non null');
assert.strictEqual(out.signal.side, 'p1', 'signal side');
assert.ok(out.signal.ev_pct > 0, 'ev_pct positif');
assert.strictEqual(out.signal.confidence, 'medium', 'confidence medium (pas high car surf_rank_total < 150)');
assert.deepStrictEqual(out.traps, [], 'pas de traps');

console.log('✅ Task 1.1 : serializer OK');
console.log(JSON.stringify(out.signal, null, 2));
