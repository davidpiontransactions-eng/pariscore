// ═══ tennis-logic.js — Fonctions pures extraites pour tests unitaires ═══
//
// Ces fonctions sont des copies fidèles de la logique utilisée dans :
//   - pariscore.js (frontend) : _upsetScore, _sortTexMatchs, _texEscapeRegex
//   - server.js   (backend)   : _decodeHtmlEntities, _computeMatchRating
//
// But : permettre des tests unitaires sans dépendre du DOM ni du serveur.
// Quand vous modifiez la logique côté production, mettez à jour ces fonctions
// pour garder les tests synchronisés.
//
// Usage :
//   const logic = require('./lib/tennis-logic.js');
//   logic.upsetScore(match);

'use strict';

// ─────────────────────────────────────────────────────────────────────────
// TEX_RATING_CONFIG — extrait de server.js (L29588)
// ─────────────────────────────────────────────────────────────────────────
const TEX_RATING_CONFIG = {
  eloDeltaWeight: 0.5,
  driftNegP1Weight: 2,
  driftNegP2Weight: 2,
  eloAvgFloor: 1600,
  eloAvgCeil: 2200,
  compScoreDeltaCoeff: 0.5,
  bettingValueDriftCoeff: 10,
  eliteEloThreshold: 1900,
  weights: { elo: 0.30, comp: 0.25, prestige: 0.20, betting: 0.15, odds: 0.10 },
};

// ─────────────────────────────────────────────────────────────────────────
// TEX_PRESTIGE_RULES — extrait de server.js (L29601)
// ─────────────────────────────────────────────────────────────────────────
const TEX_PRESTIGE_RULES = [
  { score: 100, pattern: /grand\s*slam|roland[\s-]*garros|wimbledon|us\s*open|australian\s*open/i },
  { score: 80,  pattern: /masters(?:\s*1000)?|wta\s*1000|atp\s*1000|indian\s*wells|miami\s*open|madrid\s*open|internazionali|rome\s*masters|monte[\s-]*carlo|cincinnati|canada\s*masters|toronto|montreal|shanghai\s*masters|paris\s*masters/i },
  { score: 60,  pattern: /atp\s*500|wta\s*500|halle\s*open|queen'?s\s*club|barcelona\s*open|swiss\s*indoors|basel|vienna\s*open|tokyo\s*open|dubai\s*duty\s*free|acapulco/i },
  { score: 40,  pattern: /atp\s*250|wta\s*250/i },
];

// ─────────────────────────────────────────────────────────────────────────
// _decodeHtmlEntities — extrait de server.js (L29601)
// ─────────────────────────────────────────────────────────────────────────
function decodeHtmlEntities(s) {
  if (!s) return s;
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────
// _texEscapeRegex — extrait de pariscore.js (L5284)
// ─────────────────────────────────────────────────────────────────────────
function texEscapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────
// _upsetScore — extrait de pariscore.js (L5383)
// ─────────────────────────────────────────────────────────────────────────
function upsetScore(m) {
  if (!m.elo_surface || m.elo_surface.delta == null) return 0;
  var delta = m.elo_surface.delta;
  var upsetElo = Math.max(0, 100 - delta);
  var upsetDrift = 0;
  if (m.elo_surface.favorite === 'p1' && m.odds_drift_pct && m.odds_drift_pct.p2 < 0) {
    upsetDrift = Math.abs(m.odds_drift_pct.p2) * 3;
  } else if (m.elo_surface.favorite === 'p2' && m.odds_drift_pct && m.odds_drift_pct.p1 < 0) {
    upsetDrift = Math.abs(m.odds_drift_pct.p1) * 3;
  }
  return Math.round((upsetElo + upsetDrift) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────
// _sortTexMatchs — extrait de pariscore.js (L5320)
// Prend matches (array) + filter (string) au lieu de globals pour testabilité.
// ─────────────────────────────────────────────────────────────────────────
function sortTexMatchs(matches, filter) {
  var sorted = matches.slice();
  switch (filter) {
    case 'elo_delta':
      sorted.sort(function(a, b) {
        var da = (a.elo_surface && a.elo_surface.delta) || 0;
        var db = (b.elo_surface && b.elo_surface.delta) || 0;
        return db - da;
      });
      break;
    case 'value':
      sorted.sort(function(a, b) { return (b.value_score || 0) - (a.value_score || 0); });
      break;
    case 'drift':
      sorted.sort(function(a, b) { return (b.max_drift || 0) - (a.max_drift || 0); });
      break;
    case 'elite':
      sorted.sort(function(a, b) {
        var aElite = a.is_elite ? 1 : 0;
        var bElite = b.is_elite ? 1 : 0;
        if (aElite !== bElite) return bElite - aElite;
        var aSum = ((a.elo_surface && a.elo_surface.p1) || 0) + ((a.elo_surface && a.elo_surface.p2) || 0);
        var bSum = ((b.elo_surface && b.elo_surface.p1) || 0) + ((b.elo_surface && b.elo_surface.p2) || 0);
        return bSum - aSum;
      });
      break;
    case 'rating':
      sorted.sort(function(a, b) {
        var ar = (a.match_rating && a.match_rating.score) || 0;
        var br = (b.match_rating && b.match_rating.score) || 0;
        return br - ar;
      });
      break;
    case 'upset':
      sorted.sort(function(a, b) { return upsetScore(b) - upsetScore(a); });
      break;
    case 'time':
    default:
      sorted.sort(function(a, b) {
        var pad = function(t) {
          if (!t || typeof t !== 'string') return '99:99';
          var parts = t.match(/^(\d{1,2}):(\d{2})/);
          if (!parts) return '99:99';
          return parts[1].padStart(2, '0') + ':' + parts[2];
        };
        return pad(a.time_utc).localeCompare(pad(b.time_utc));
      });
      break;
  }
  return sorted;
}

// ─────────────────────────────────────────────────────────────────────────
// _computeMatchRating — extrait de server.js (L29927-29977)
// Prend un match déjà enrichi (avec elo_surface, odds_drift_pct, etc.) et
// retourne le match avec m.value_score, m.is_elite, m.max_drift, m.match_rating
// remplis. Pure function — ne mute pas l'objet passé (clone + enrich).
// ─────────────────────────────────────────────────────────────────────────
function computeMatchRating(m) {
  var out = Object.assign({}, m);

  // Value score
  var valueScore = 0;
  if (out.elo_surface && out.elo_surface.delta != null) {
    valueScore += out.elo_surface.delta * TEX_RATING_CONFIG.eloDeltaWeight;
  }
  if (out.odds_drift_pct) {
    if (out.odds_drift_pct.p1 != null && out.odds_drift_pct.p1 < 0) {
      valueScore += Math.abs(out.odds_drift_pct.p1) * TEX_RATING_CONFIG.driftNegP1Weight;
    }
    if (out.odds_drift_pct.p2 != null && out.odds_drift_pct.p2 < 0) {
      valueScore += Math.abs(out.odds_drift_pct.p2) * TEX_RATING_CONFIG.driftNegP2Weight;
    }
  }
  out.value_score = Math.round(valueScore * 10) / 10;

  // Elite flag — coerce to strict boolean via ternary (matches server.js L29935)
  var e1 = (out.elo_surface && out.elo_surface.p1) ? { elo: out.elo_surface.p1 } : null;
  var e2 = (out.elo_surface && out.elo_surface.p2) ? { elo: out.elo_surface.p2 } : null;
  out.is_elite = (e1 && e2 && e1.elo >= TEX_RATING_CONFIG.eliteEloThreshold && e2.elo >= TEX_RATING_CONFIG.eliteEloThreshold) ? true : false;

  // Drift max
  out.max_drift = Math.max(
    Math.abs((out.odds_drift_pct && out.odds_drift_pct.p1) || 0),
    Math.abs((out.odds_drift_pct && out.odds_drift_pct.p2) || 0)
  );

  // Composite rating
  var eloAvg = (out.elo_surface && out.elo_surface.p1 && out.elo_surface.p2)
    ? (out.elo_surface.p1 + out.elo_surface.p2) / 2
    : 0;
  var eloScore = Math.min(100, Math.max(0,
    (eloAvg - TEX_RATING_CONFIG.eloAvgFloor) / ((TEX_RATING_CONFIG.eloAvgCeil - TEX_RATING_CONFIG.eloAvgFloor) / 100)
  ));

  var eloDelta = (out.elo_surface && out.elo_surface.delta != null) ? out.elo_surface.delta : 999;
  var compScore = Math.max(0, 100 - eloDelta * TEX_RATING_CONFIG.compScoreDeltaCoeff);

  var tourName = (out.tournament || '').toLowerCase();
  var prestigeScore = 20;
  for (var i = 0; i < TEX_PRESTIGE_RULES.length; i++) {
    if (TEX_PRESTIGE_RULES[i].pattern.test(tourName)) {
      prestigeScore = TEX_PRESTIGE_RULES[i].score;
      break;
    }
  }

  var bettingValueScore = Math.min(100, (out.max_drift || 0) * TEX_RATING_CONFIG.bettingValueDriftCoeff);
  var oddsScore = (out.odds_current && out.odds_current.p1 && out.odds_current.p2) ? 100 : 0;

  var composite = Math.round(
    eloScore * TEX_RATING_CONFIG.weights.elo +
    compScore * TEX_RATING_CONFIG.weights.comp +
    prestigeScore * TEX_RATING_CONFIG.weights.prestige +
    bettingValueScore * TEX_RATING_CONFIG.weights.betting +
    oddsScore * TEX_RATING_CONFIG.weights.odds
  );

  out.match_rating = {
    score: composite,
    stars: Math.max(1, Math.min(5, Math.ceil(composite / 20))),
    breakdown: {
      elo_quality: Math.round(eloScore),
      competitiveness: Math.round(compScore),
      tournament_prestige: prestigeScore,
      betting_value: Math.round(bettingValueScore),
      odds_availability: oddsScore,
    },
  };

  return out;
}

module.exports = {
  TEX_RATING_CONFIG,
  TEX_PRESTIGE_RULES,
  decodeHtmlEntities,
  texEscapeRegex,
  upsetScore,
  sortTexMatchs,
  computeMatchRating,
};
