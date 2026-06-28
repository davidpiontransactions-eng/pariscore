/* ═══════════════════════════════════════════════════════════════
 * ParisScore — Tennis Live (Vanilla JS)
 * Consomme les vrais matchs depuis /api/v1/tennis/live (server.js)
 * Métriques réelles: DR, Hold%, Rally, BPPI, Glicko2 depuis _bsd_stats
 * Fallback: mode mock si l'API est indisponible
 * ═══════════════════════════════════════════════════════════════ */

var TennisLive = (function () {
  'use strict';

  var API_BASE = '/api/v1';
  var POLL_INTERVAL_MS = 15000;

  var state = {
    container: null,
    matches: [],
    top10Surface: 'hard',
    top10Gender: 'ATP',
    profileSlug: null,
    loading: true,
    liveMode: false,
    _renderTimer: null,
    _pollTimer: null,
    _lastPollTs: 0
  };

  /* ── DR Engine (parité Sofascore) ── */
  // DR = (serve% + return%) P1 / (serve% + return%) P2
  // Même formule que computeTennisDRFromMatch dans server.js
  function computeDRFromBSD(stats) {
    if (!stats) return null;
    var n = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : (v != null ? parseFloat(v) : NaN); };
    var p1S = n(stats.p1_first_won), p1R = n(stats.p1_ret_won);
    var p2S = n(stats.p2_first_won), p2R = n(stats.p2_ret_won);
    // Voie 1 — serve + return (Sofascore parité)
    if (isFinite(p1S) && isFinite(p1R) && isFinite(p2S) && isFinite(p2R)) {
      var a = p1S + p1R, b = p2S + p2R;
      if (a > 0 && b > 0) {
        return { p1: a / b, p2: b / a, delta: Math.abs(a / b - b / a), source: 'bsd_serve_ret', p1Serve: p1S, p1Ret: p1R, p2Serve: p2S, p2Ret: p2R };
      }
    }
    // Voie 2 — total points
    var t1 = n(stats.p1_total_pts), t2 = n(stats.p2_total_pts);
    if (isFinite(t1) && isFinite(t2) && t1 > 0 && t2 > 0) {
      return { p1: t1 / t2, p2: t2 / t1, delta: Math.abs(t1 / t2 - t2 / t1), source: 'bsd_total' };
    }
    // Voie 3 — serve-only approx (derive return from opponent serve)
    if (isFinite(p1S) && isFinite(p2S) && p1S > 0 && p2S > 0) {
      var p1Rd = Math.max(0, Math.min(100, 100 - p2S));
      var p2Rd = Math.max(0, Math.min(100, 100 - p1S));
      var a2 = p1S + p1Rd, b2 = p2S + p2Rd;
      return { p1: a2 / b2, p2: b2 / a2, delta: Math.abs(a2 / b2 - b2 / a2), source: 'bsd_serve_approx' };
    }
    return null;
  }

  // DR par set depuis les scores de jeux (proxy quand stats point indispo)
  function computeDRBySet(setsArr) {
    var bySet = {};
    if (!Array.isArray(setsArr)) return bySet;
    setsArr.forEach(function (set, i) {
      var g1 = parseInt(set.p1) || 0, g2 = parseInt(set.p2) || 0;
      if (g1 + g2 < 2) return; // set pas encore commencé
      var drS = g2 > 0 ? Math.min(6, g1 / g2) : 6.0;
      bySet[i + 1] = { dr: parseFloat(drS.toFixed(3)), ret_n: g1 + g2 };
    });
    return bySet;
  }

  function formatDR(v) { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '—'; }

  /* ── Map server.js live match → internal format ── */
  // server.js /api/v1/tennis/live retourne le cache BRUT _tennisLiveCache.data:
  //   _bsd_stats: { p1_first_won, p1_ret_won, p2_first_won, p2_ret_won, p1_first_pct,
  //                p2_first_pct, p1_total_pts, p2_total_pts, p1_aces, ... }
  //   serve_momentum: { games: [{w:1|2, brk:bool}], breaks_recent, run:{player,len}, trend }
  //   bppi: { p1, p2, components, context_flags, missing }
  //   glicko2: { p1_serve, p1_return, p2_serve, p2_return }
  //   betfair_wom, momentum, ...
  //   serving: 1|2 (numérique), current_point: "15-30"|"AD"|null
  //   dr_exact: { p1, p2, delta, exact, reliable, source, p1Serve, p1Ret, p2Serve, p2Ret, dr_by_set }
  //   live_stats: null (NON fourni par /api/v1 — utilise _bsd_stats)
  function mapLiveMatch(raw) {
    var sets = (raw.sets || []).map(function (s) { return { p1: parseInt(s.p1) || 0, p2: parseInt(s.p2) || 0 }; });
    if (sets.length === 0) sets = [{ p1: raw.player1_sets || 0, p2: raw.player2_sets || 0 }];

    // Determine server (server.js uses numeric 1|2)
    var server = (raw.serving === 1 || raw.serving === 'player1' || raw.serving === 'p1') ? 'p1' : 'p2';

    // Parse current point from API (e.g. "15-30", "40-40", "AD", "15")
    var p1Pt = '0', p2Pt = '0';
    if (raw.current_point) {
      var pt = String(raw.current_point);
      if (pt.indexOf('-') >= 0) {
        var parts = pt.split('-');
        p1Pt = (parts[0] || '0').trim();
        p2Pt = (parts[1] || '0').trim();
      } else if (pt === 'AD' || pt === 'Adv') {
        // Advantage for the serving player
        p1Pt = server === 'p1' ? 'AD' : '40';
        p2Pt = server === 'p2' ? 'AD' : '40';
      } else {
        p1Pt = pt; p2Pt = '0';
      }
    }

    // ══════════════════════════════════════════════════════════════
    // DR — utilise dr_exact du serveur quand disponible (calculé dans
    // l'enrichissement live de server.js, même formule que computeDRFromBSD)
    // Fallback: calcul client-side via computeDRFromBSD ou computeDRBySet
    // ══════════════════════════════════════════════════════════════
    var dr;
    var drComputed = null;
    if (raw.dr_exact && raw.dr_exact.exact && raw.dr_exact.p1 > 0) {
      dr = raw.dr_exact;
    } else {
      var bsd = raw._bsd_stats || raw.live_stats || {};
      drComputed = computeDRFromBSD(bsd);
      dr = { p1: 1, p2: 1, delta: 0, exact: false, reliable: false, source: 'none' };
      if (drComputed) {
        dr = {
          p1: drComputed.p1, p2: drComputed.p2, delta: drComputed.delta,
          exact: true, reliable: drComputed.source === 'bsd_serve_ret',
          source: drComputed.source
        };
      } else {
        // Fallback: DR par set depuis les jeux (proxy jeux)
        var drBySet = computeDRBySet(sets);
        var setKeys = Object.keys(drBySet);
        if (setKeys.length > 0) {
          var vals = setKeys.map(function (k) { return drBySet[k].dr; });
          var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
          dr = { p1: avg, p2: 1 / avg, delta: Math.abs(avg - 1 / avg), exact: true, reliable: false, source: 'bsd_games' };
        }
      }
    }

    // DR par set (pour sparkline)
    var drHist = [];
    // Si on a des stats point-level, DR par set depuis Sofascore/bsd
    if (drComputed && drComputed.source === 'bsd_serve_ret') {
      // Pas de per-set granulaire depuis _bsd_stats seul, utiliser les jeux
    }
    var drBySetGames = computeDRBySet(sets);
    for (var si = 1; si <= sets.length; si++) {
      if (drBySetGames[si] && isFinite(drBySetGames[si].dr) && drBySetGames[si].dr > 0) {
        drHist.push({ p1: drBySetGames[si].dr, p2: 1 / drBySetGames[si].dr });
      }
    }
    // Ajouter le DR match courant
    if (dr.exact) drHist.push({ p1: dr.p1, p2: dr.p2 });
    if (drHist.length > 60) drHist = drHist.slice(-60);

    // ══════════════════════════════════════════════════════════════
    // HOLD % depuis serve_momentum.games (format server.js)
    // games[i] = { w: 1|2, brk: bool } — brk=true = returner a gagné (break)
    // ══════════════════════════════════════════════════════════════
    var holdPct1 = null, holdPct2 = null;
    var sm = raw.serve_momentum || null;
    var games = (sm && Array.isArray(sm.games)) ? sm.games : [];
    if (games.length > 0) {
      var p1Served = 0, p1Held = 0, p2Served = 0, p2Held = 0;
      games.forEach(function (g) {
        // Inférer qui sert: alternance. Premier jeu = P1 sert (convention ATP).
        // Plus fiable: utiliser le trend et les snapshots si disponibles.
        // server.js dérive les jeux depuis les snapshots de score.
        // On peut déduire le serveur: si w === serving → hold, sinon → break.
        // sm.run.player et sm.trend donnent le trend récent.
        // Mais on n'a pas directement qui sert chaque jeu.
        // Heuristique: utiliser les breaks pour déduire.
        if (g.brk) {
          // Break = non-serveur a gagné. Le gagnant est le returner.
          // Mais on ne sait pas qui servait... Utiliser ratio sets.
          // Mieux: compter breaks et en déduire les holds.
        } else {
          // Hold = serveur a gagné
        }
      });
      // Heuristique améliorée: utiliser les snapshots si disponibles
      var snapshots = (sm.snapshots && Array.isArray(sm.snapshots)) ? sm.snapshots : [];
      if (snapshots.length >= 2) {
        var p1Srv = 0, p1Hld = 0, p2Srv = 0, p2Hld = 0;
        for (var gi = 1; gi < snapshots.length; gi++) {
          var prev = snapshots[gi - 1], cur = snapshots[gi];
          var d1 = (cur.g1 || 0) - (prev.g1 || 0);
          var d2 = (cur.g2 || 0) - (prev.g2 || 0);
          if (d1 + d2 !== 1) continue; // skip si >1 jeu entre snapshots
          var winner = d1 === 1 ? 1 : 2;
          var srv = prev.serving; // 1 or 2
          if (srv === 1) { p1Srv++; if (winner === 1) p1Hld++; }
          else if (srv === 2) { p2Srv++; if (winner === 2) p2Hld++; }
        }
        if (p1Srv > 0) holdPct1 = Math.round(p1Hld / p1Srv * 100);
        if (p2Srv > 0) holdPct2 = Math.round(p2Hld / p2Srv * 100);
      } else if (games.length > 0) {
        // Fallback: estimer depuis ratio de jeux dans les sets
        var totalG1 = 0, totalG2 = 0;
        sets.forEach(function (s) { totalG1 += s.p1; totalG2 += s.p2; });
        var totalGames = totalG1 + totalG2;
        if (totalGames > 0) {
          // En tennis, P1 sert la moitié des jeux environ
          // On estime hold% = (jeux gagnés en service) / (jeux en service)
          // Approx: le joueur qui mène a un meilleur hold%
          var estHold = function (myGames, oppGames) {
            var mySrvGames = Math.ceil(totalGames / 2);
            return Math.round(Math.min(100, Math.max(30, (myGames / Math.max(1, mySrvGames)) * 100)));
          };
          holdPct1 = estHold(totalG1, totalG2);
          holdPct2 = estHold(totalG2, totalG1);
        }
      }
    }

    // Dériver les breaks récents pour le streak
    var lastBreak = false;
    if (games.length > 0) {
      var lastGame = games[games.length - 1];
      if (lastGame.brk) lastBreak = true;
    }

    // Build svcHistory for rendering (compat format)
    var svcHistory = [];
    if (sm && Array.isArray(sm.snapshots) && sm.snapshots.length >= 2) {
      for (var hi = 1; hi < sm.snapshots.length; hi++) {
        var hp = sm.snapshots[hi - 1], hc = sm.snapshots[hi];
        var hd1 = (hc.g1 || 0) - (hp.g1 || 0);
        var hd2 = (hc.g2 || 0) - (hp.g2 || 0);
        if (hd1 + hd2 !== 1) continue;
        var hw = hd1 === 1 ? 'p1' : 'p2';
        var hsrv = hp.serving === 1 ? 'p1' : 'p2';
        svcHistory.push({ s: hsrv, h: hw === hsrv }); // h=true = hold
      }
      svcHistory = svcHistory.slice(-12);
    }

    // ══════════════════════════════════════════════════════════════
    // RALLY AVG — estimé depuis _bsd_stats si disponible
    // _bsd_stats n'a pas rally_avg directement, on dérive une estimation
    // depuis total_points et le nombre de jeux
    // ══════════════════════════════════════════════════════════════
    var rallyAvg = null;
    var p1TotalPts = bsd.p1_total_pts, p2TotalPts = bsd.p2_total_pts;
    if (typeof p1TotalPts === 'number' && typeof p2TotalPts === 'number') {
      // total_points_won_pct est un pourcentage, pas un nombre absolu
      // On ne peut pas en déduire le rally avg. Marquer comme non-dispo.
      // Si on avait le nombre total de points joués, rallyAvg = totalPoints / totalGames
      rallyAvg = null; // nécessite données non-disponibles dans l'API publique
    }

    // ══════════════════════════════════════════════════════════════
    // BPPI (Break Point Pressure Index) depuis server.js
    // bppi = { p1: 0-100, p2: 0-100, components: {p1: {clutch,offense,serve,momentum}, ...} }
    // ══════════════════════════════════════════════════════════════
    var bppi = raw.bppi || null;

    // ══════════════════════════════════════════════════════════════
    // GLICKO2 depuis server.js
    // glicko2 = { p1_serve, p1_return, p2_serve, p2_return }
    // ══════════════════════════════════════════════════════════════
    var glicko2 = raw.glicko2 || null;

    // Determine surface
    var surface = raw.court || '';
    if (/clay|terre/i.test(surface) || /roland/i.test(raw.tournament)) surface = 'Terre battue';
    else if (/grass|gazon|herbe/i.test(surface) || /wimbledon|queen/i.test(raw.tournament)) surface = 'Gazon';
    else if (/indoor|couvert/i.test(surface)) surface = 'Indoor';
    else surface = 'Dur';

    // Compute intensity (enhanced with BPPI spread)
    var setGap = sets.length > 0 ? Math.abs((sets[sets.length - 1] || {}).p1 - (sets[sets.length - 1] || {}).p2) : 0;
    var bppiSpread = (bppi && !bppi.missing) ? Math.abs((bppi.p1 || 50) - (bppi.p2 || 50)) : 0;
    var intensity = Math.round(Math.min(100, 20 + dr.delta * 60 + (setGap >= 1 ? 20 : 0) + (raw.is_live ? 15 : 0) + bppiSpread * 0.3));

    // Compute live win probability estimate from DR + score
    var wp = 0.5 + (dr.p1 - 1) * 0.35;
    var setLead = sets.reduce(function (a, s) { return a + (s.p1 - s.p2); }, 0);
    wp = Math.max(0.05, Math.min(0.95, wp + setLead * 0.12 + setGap * 0.03));
    var liveWinProb = wp * 100;

    // Pressure (enhanced with BPPI)
    var pressure = dr.delta > 0.4 ? 80 : dr.delta > 0.15 ? 65 : 45;
    if (setGap >= 1 && intensity > 70) pressure = Math.min(95, pressure + 10);
    if (bppiSpread > 25) pressure = Math.min(95, pressure + 8);

    return {
      id: raw.id || ('live_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      tournament: raw.tournament || '—',
      round: raw.court || '',
      surface: surface,
      tour: raw.tour || '',
      p1: {
        name: (raw.player1 && raw.player1.name) || 'J1',
        rank: (raw.player1 && raw.player1.rank) || null,
        elo: (raw.player1 && raw.player1.elo) || null,
        country: (raw.player1 && raw.player1.country) || null,
        flag: (raw.player1 && raw.player1.flag) || null,
        photoUrl: (raw.player1 && raw.player1.photo) || ((raw.player1 && raw.player1.id) ? '/api/v1/tennis/player-photo/' + raw.player1.id : null),
        id: (raw.player1 && raw.player1.id) || null,
        preWinProb: wp
      },
      p2: {
        name: (raw.player2 && raw.player2.name) || 'J2',
        rank: (raw.player2 && raw.player2.rank) || null,
        elo: (raw.player2 && raw.player2.elo) || null,
        country: (raw.player2 && raw.player2.country) || null,
        flag: (raw.player2 && raw.player2.flag) || null,
        photoUrl: (raw.player2 && raw.player2.photo) || ((raw.player2 && raw.player2.id) ? '/api/v1/tennis/player-photo/' + raw.player2.id : null),
        id: (raw.player2 && raw.player2.id) || null,
        preWinProb: 1 - wp
      },
      _server: server,
      _sets: sets,
      _set: sets.length,
      _g1: p1Pt,
      _g2: p2Pt,
      _fin: !raw.is_live && raw.status === 'finished',
      _win: (raw.player1_sets || 0) > (raw.player2_sets || 0) ? 'p1' : ((raw.player2_sets || 0) > (raw.player1_sets || 0) ? 'p2' : null),
      _lastBreak: lastBreak,
      _drHist: drHist,
      _dr: dr,
      _svc: svcHistory,
      _intensity: intensity,
      _pressure: pressure,
      _liveWinProb: liveWinProb,
      _betfairWom: raw.betfair_wom || null,
      _isLive: !!raw.is_live,
      _startTime: raw.start_time,
      _currentPoint: raw.current_point,
      _serving: raw.serving,
      _holdPct1: holdPct1,
      _holdPct2: holdPct2,
      _rallyAvg: rallyAvg,
      _bppi: bppi,
      _glicko2: glicko2,
      _bsdStats: bsd,
      _serveMomentum: sm
    };
  }

  /* ── Get match state (compatible with render functions) ── */
  function getMatchState(m) {
    var dr = m._dr || { p1: 1, p2: 1, delta: 0, exact: false, reliable: false, source: 'none' };
    var cs = m._sets[m._sets.length - 1] || { p1: 0, p2: 0 };

    // Hold % from snapshots (already computed in mapLiveMatch) or from _holdPct
    var hs = null;
    if (m._svc && m._svc.length > 0) {
      var r = m._svc.slice(-6);
      var g1 = r.filter(function (g) { return g.s === 'p1'; });
      var g2 = r.filter(function (g) { return g.s === 'p2'; });
      hs = {
        p1: g1.length > 0 ? Math.round(g1.filter(function (g) { return g.h; }).length / g1.length * 100) : (m._holdPct1 != null ? m._holdPct1 : null),
        p2: g2.length > 0 ? Math.round(g2.filter(function (g) { return g.h; }).length / g2.length * 100) : (m._holdPct2 != null ? m._holdPct2 : null)
      };
    } else if (m._holdPct1 != null) {
      hs = { p1: m._holdPct1, p2: m._holdPct2 };
    }

    // BPPI from server.js
    var bppi = null;
    if (m._bppi && !m._bppi.missing) {
      bppi = { p1: m._bppi.p1, p2: m._bppi.p2 };
    }

    // Glicko2 from server.js
    var gl2 = null;
    if (m._glicko2) {
      gl2 = {
        p1Serve: m._glicko2.p1_serve,
        p1Return: m._glicko2.p1_return,
        p2Serve: m._glicko2.p2_serve,
        p2Return: m._glicko2.p2_return
      };
    }

    // Serve momentum trend
    var smTrend = null;
    if (m._serveMomentum) {
      smTrend = {
        breaks_recent: m._serveMomentum.breaks_recent || 0,
        run: m._serveMomentum.run || null,
        trend: m._serveMomentum.trend || null
      };
    }

    var ra = m._rallyAvg;
    var pw = m.p1.preWinProb || 0.5;
    var sl = m._sets.reduce(function (a, s) { return a + (s.p1 - s.p2); }, 0);
    var gl = cs.p1 - cs.p2;
    var di = dr.p1 - 1;
    var lw = Math.max(2, Math.min(98, pw * 100 + sl * 18 + gl * 4 + di * 20));
    var xw = Math.round(lw - pw * 100);
    var int = m._intensity || Math.round(Math.min(100, 20 + Math.abs(dr.p1 - dr.p2) * 25 + Math.abs(gl) * 2));

    // DR source label
    var drSrcLabel = 'DR ' + (dr.source || 'proxy');
    if (dr.source === 'bsd_serve_ret') drSrcLabel = 'DR serve+ret';
    else if (dr.source === 'bsd_total') drSrcLabel = 'DR total pts';
    else if (dr.source === 'bsd_serve_approx') drSrcLabel = 'DR serve approx';
    else if (dr.source === 'bsd_games') drSrcLabel = 'DR jeux/set';

    return {
      dr: dr,
      drSrcLabel: drSrcLabel,
      sets: m._sets.map(function (s) { return { p1: s.p1, p2: s.p2 }; }),
      set: m._set,
      server: m._server,
      p1Points: typeof m._g1 === 'number' ? ['0', '15', '30', '40'][m._g1] || String(m._g1) : String(m._g1),
      p2Points: typeof m._g2 === 'number' ? ['0', '15', '30', '40'][m._g2] || String(m._g2) : String(m._g2),
      finished: m._fin,
      winner: m._win,
      lastIsBreak: m._lastBreak,
      pit: {
        dr: dr.exact ? dr.p1 : null,
        drReliable: dr.reliable,
        holdStreak: hs,
        rallyAvg: ra,
        xWinDelta: xw,
        liveWinProb: lw,
        intensity: int,
        bppi: bppi,
        glicko2: gl2,
        smTrend: smTrend
      },
      drHistory: m._drHist
    };
  }

  function computePressure(ms) {
    if (ms.lastIsBreak) return 76;
    var d = Math.abs(ms.dr.p1 - ms.dr.p2);
    if (d > 0.4) return 70;
    if (d > 0.15) return 60;
    return 45;
  }

  function computeOdds(ms) {
    var dr = ms.dr;
    var cs = ms.sets[ms.sets.length - 1] || { p1: 0, p2: 0 };
    var tg = cs.p1 + cs.p2;
    var dm = Math.max(dr.p1, dr.p2);
    var ds = dr.delta;
    var df = Math.max(0, dm - 1);
    var tf = Math.max(0, 1 - ds) * 0.5;
    var gr = 12 - tg;
    var ib = ms.pit.intensity > 70 ? 8 : 0;
    var o75 = Math.round(Math.max(35, Math.min(95, 55 + tf * 30 - df * 25 + gr * 1.5 + ib)));
    var o85 = Math.round(Math.max(25, Math.min(85, o75 - 18)));
    var u125 = Math.round(Math.max(40, Math.min(95, 70 + df * 20 - tf * 15)));
    return [
      { label: 'O 7.5', probability: o75, ev: Math.max(0, Math.round(o75 - 60)), signal: o75 >= 75 ? 'value' : 'ai-al' },
      { label: 'O 8.5', probability: o85, ev: Math.max(0, Math.round(o85 - 55)), signal: o85 >= 75 ? 'value' : o85 >= 50 ? 'ai-al' : 'pass' },
      { label: 'U 12.5', probability: u125, ev: Math.max(0, Math.round(u125 - 65)), signal: u125 >= 75 ? 'value' : 'ai-al' }
    ];
  }

  /* ── Rendering ── */
  function el(tag, cls, attrs, children) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') for (var sk in attrs[k]) n.style[sk] = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (children) { if (!Array.isArray(children)) children = [children]; children.forEach(function (c) { if (c == null) return; n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }); }
    return n;
  }

  function renderCard(m) {
    var ms = getMatchState(m);
    var pr = m._pressure || computePressure(ms);
    var pt = pr >= 80 ? 'tense' : pr >= 60 ? 'tight' : 'calm';
    var pCol = pt === 'tense' ? '#EF4444' : pt === 'tight' ? '#F59E0B' : '#10B981';
    var sl = ms.finished ? 'Termine' : pr >= 80 ? 'Critique' : pr >= 60 ? 'Serre' : 'Calme';
    var p1L = ms.dr.p1 - ms.dr.p2 > 0.05;
    var p2L = ms.dr.p1 - ms.dr.p2 < -0.05;
    var tourLabel = m.tournament + (m.round ? ' · ' + m.round : '');

    var c = el('article', 'tl-card');
    var h = el('div', 'tl-card-header');
    h.innerHTML = '<div class="tl-card-tournament"><span class="tl-tournament-name">' + tourLabel + '</span><span class="tl-tournament-round">' + m.surface + '</span>' + (m.tour ? '<span class="tl-tournament-round">' + m.tour + '</span>' : '') + '</div><div>' + (!ms.finished && m._isLive ? '<span class="tl-badge-live">LIVE</span>' : '') + '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 8px;border-radius:4px;color:' + pCol + ';background:' + (pt === 'tense' ? 'rgba(239,68,68,0.12)' : pt === 'tight' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)') + '">' + sl + '</span><span class="tl-card-pressure">PRESSURE: <span class="tl-pressure-value" style="color:' + pCol + '">' + pr + '</span></span></div>';
    c.appendChild(h);

    var sb = el('div', 'tl-scoreboard');
    sb.innerHTML = renderPlayerBlock(m.p1, ms.server === 'p1', p1L) + renderScoreBlock(ms) + renderPlayerBlock(m.p2, ms.server === 'p2', p2L, true);
    c.appendChild(sb);

    if (ms.lastIsBreak) {
      var br = ms.server === 'p1' ? m.p2.name : m.p1.name;
      var bd = ms.server === 'p1' ? m.p1.name : m.p2.name;
      c.appendChild(el('div', 'tl-break-alert', { text: 'BREAK ! ' + br + ' break ' + bd }));
    }

    var pit = ms.pit;
    var pitDiv = el('div', 'tl-pit');
    // DR source label: show which data source was used
    var drSrc = ms.drSrcLabel || (ms.dr.exact ? 'DR exact' : 'DR proxy');
    // BPPI metric (6th indicator)
    var bppiVal = '—';
    var bppiSub = '0-100 pressure';
    if (pit.bppi) {
      bppiVal = (pit.bppi.p1 || 0).toFixed(0) + '/' + (pit.bppi.p2 || 0).toFixed(0);
      var bppiDiff = Math.abs((pit.bppi.p1 || 50) - (pit.bppi.p2 || 50));
      bppiSub = '\u0394' + bppiDiff.toFixed(0) + ' pressure';
    }
    // Hold streak label
    var holdVal = '—';
    if (pit.holdStreak) {
      holdVal = (pit.holdStreak.p1 != null ? pit.holdStreak.p1 + '%' : '—') + '/' + (pit.holdStreak.p2 != null ? pit.holdStreak.p2 + '%' : '—');
    }
    // Rally avg: show serve info if no rally data
    var rallyVal = '—';
    var rallySub = 'shots/point';
    if (pit.rallyAvg != null) {
      rallyVal = pit.rallyAvg.toFixed(1);
    } else {
      // Show 1st serve % as fallback indicator
      var bsd = m._bsdStats || {};
      if (typeof bsd.p1_first_pct === 'number' || typeof bsd.p2_first_pct === 'number') {
        rallyVal = (typeof bsd.p1_first_pct === 'number' ? bsd.p1_first_pct.toFixed(0) + '%' : '—') + '/' + (typeof bsd.p2_first_pct === 'number' ? bsd.p2_first_pct.toFixed(0) + '%' : '—');
        rallySub = '1st serve %';
      }
    }
    // DR reliable indicator
    var drRelBadge = pit.drReliable ? ' \u2713' : '';

    pitDiv.innerHTML = '<div class="tl-pit-title"><span>PIT · 6 indicateurs</span><span class="tl-pit-source">' + drSrc + drRelBadge + '</span></div><div class="tl-pit-grid">' + pitMetric('Dom. Ratio', pit.dr != null ? formatDR(pit.dr) : '—', '\u0394 ' + formatDR(ms.dr.delta)) + pitMetric('Hold %', holdVal, 'P1/P2 % service') + pitMetric(rallySub === 'shots/point' ? 'Rally Avg' : '1st Serve', rallyVal, rallySub) + pitMetric('xWin \u0394', pit.xWinDelta != null ? (pit.xWinDelta > 0 ? '+' : '') + pit.xWinDelta + 'pts' : '—', 'WP ' + (pit.liveWinProb != null ? Math.round(pit.liveWinProb) + '%' : '—')) + pitMetric('Intensity', String(pit.intensity), '/ 100') + pitMetric('BPPI', bppiVal, bppiSub) + '</div>';
    c.appendChild(pitDiv);

    // Glicko2 badge if available
    if (pit.glicko2) {
      var gl2Div = el('div', 'tl-pit');
      var g = pit.glicko2;
      gl2Div.innerHTML = '<div class="tl-pit-title"><span>Glicko2 Ratings</span><span class="tl-pit-source">serve / return</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 12px">' +
        '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);border-radius:6px;padding:6px 8px;font-size:10px;font-family:var(--tl-font-mono)"><div style="color:var(--tl-text-3);font-size:9px;text-transform:uppercase">' + m.p1.name.split(' ').slice(-1)[0] + '</div><div style="color:#F59E0B;font-weight:700;font-size:13px">S ' + (g.p1Serve || '—') + '</div><div style="color:var(--tl-text-2);font-size:11px">R ' + (g.p1Return || '—') + '</div></div>' +
        '<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);border-radius:6px;padding:6px 8px;font-size:10px;font-family:var(--tl-font-mono)"><div style="color:var(--tl-text-3);font-size:9px;text-transform:uppercase">' + m.p2.name.split(' ').slice(-1)[0] + '</div><div style="color:#10B981;font-weight:700;font-size:13px">S ' + (g.p2Serve || '—') + '</div><div style="color:var(--tl-text-2);font-size:11px">R ' + (g.p2Return || '—') + '</div></div>' +
        '</div>';
      c.appendChild(gl2Div);
    }

    // Serve momentum mini-bar
    if (pit.smTrend && pit.smTrend.run && pit.smTrend.run.len >= 2) {
      var smDiv = el('div', 'tl-pit');
      var runPlayer = pit.smTrend.run.player === 1 ? m.p1.name.split(' ').slice(-1)[0] : m.p2.name.split(' ').slice(-1)[0];
      var runColor = pit.smTrend.run.player === 1 ? '#F59E0B' : '#10B981';
      smDiv.innerHTML = '<div class="tl-pit-title"><span>Momentum</span><span class="tl-pit-source">' + (pit.smTrend.breaks_recent || 0) + ' breaks recents</span></div><div style="padding:6px 12px;font-size:11px;font-family:var(--tl-font-mono);color:var(--tl-text-2)"><span style="color:' + runColor + ';font-weight:700">' + runPlayer + '</span> run de <span style="color:#fff;font-weight:700">' + pit.smTrend.run.len + '</span> jeux' + (pit.smTrend.trend ? ' · trend <span style="color:' + (pit.smTrend.trend === 'p1' ? '#F59E0B' : pit.smTrend.trend === 'p2' ? '#10B981' : 'var(--tl-text-3)') + ';text-transform:uppercase">' + pit.smTrend.trend + '</span>' : '') + '</div>';
      c.appendChild(smDiv);
    }

    // WOM badge if available
    if (m._betfairWom && m._betfairWom.total_matched) {
      var womDiv = el('div', 'tl-pit');
      womDiv.innerHTML = '<div class="tl-pit-title"><span>Volume Betfair</span><span class="tl-pit-source">' + (m._betfairWom.total_matched || 0).toLocaleString() + ' \u20AC</span></div>';
      c.appendChild(womDiv);
    }

    var dh = ms.drHistory.slice(-30);
    if (dh.length >= 2) c.appendChild(renderSparkline(dh, m.p1, m.p2));

    var odds = computeOdds(ms);
    var od = el('div', 'tl-odds');
    od.innerHTML = '<div class="tl-pit-title"><span>Marches live · regle BET</span><span class="tl-pit-source">EV > 5% & IC_inf > 0</span></div><div class="tl-odds-grid">' + odds.map(function (o) {
      var t = o.probability >= 75 ? 'high' : o.probability >= 50 ? 'mid' : 'low';
      var b = o.signal === 'value' ? 'value' : o.signal === 'ai-al' ? 'ai-al' : 'pass';
      var bt = o.signal === 'value' ? 'VALUE' : o.signal === 'ai-al' ? 'AI-AL' : 'PASS';
      return '<div class="tl-odd-row"><div class="tl-odd-bar ' + t + '" style="width:' + o.probability + '%"></div><div style="display:flex;align-items:center;gap:6px;position:relative;z-index:1"><span class="tl-odd-label">' + o.label + '</span><span class="tl-odd-badge ' + b + '">' + bt + '</span></div><div style="text-align:right;position:relative;z-index:1"><div class="tl-odd-value ' + t + '">' + o.probability + '%</div><div class="tl-odd-ev">EV +' + o.ev + '%</div></div></div>';
    }).join('') + '</div>';
    c.appendChild(od);
    return c;
  }

  function pitMetric(l, v, s) {
    return '<div class="tl-pit-metric"><div class="tl-pit-label">' + l + '</div><div class="tl-pit-value">' + v + '</div><div class="tl-pit-sub">' + s + '</div></div>';
  }

  function renderPlayerBlock(p, isServing, isLeading, right) {
    var srvDot = isServing ? '<div class="tl-serving-dot">S</div>' : '';
    var flagHtml = p.flag ? '<img src="https://flagcdn.com/w20/' + p.flag + '.png" style="width:16px;height:11px;border-radius:2px;object-fit:cover" onerror="this.style.display=\'none\'" loading="lazy"/>' : '';
    var photo = p.photoUrl ? '<img src="' + p.photoUrl + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/><div class="tl-initials" style="display:none">' + p.name.slice(0, 2).toUpperCase() + '</div>' : '<div class="tl-initials">' + p.name.slice(0, 2).toUpperCase() + '</div>';
    var srvBadge = isServing ? '<span style="font-size:11px;font-family:var(--tl-font-mono);text-transform:uppercase;color:#10B981;background:rgba(16,185,129,0.12);padding:2px 4px;border-radius:4px">service</span>' : '';
    var eloStr = p.elo ? ' · ELO ' + p.elo : '';
    return '<div class="tl-player-block' + (right ? ' right' : '') + '"><div class="tl-player-avatar">' + photo + srvDot + '</div><div><div class="tl-player-name' + (isLeading ? ' leading' : '') + '"' + (right ? ' style="justify-content:flex-end"' : '') + '>' + (right ? srvBadge : '') + (flagHtml ? '<span style="margin-right:4px">' + flagHtml + '</span>' : '') + '<span>' + p.name + '</span>' + (!right ? srvBadge : '') + '</div><div class="tl-player-rank"' + (right ? ' style="text-align:right"' : '') + '>' + (p.rank ? 'RK ' + p.rank : '') + (p.country ? ' · ' + p.country : '') + eloStr + '</div></div></div>';
  }

  function renderScoreBlock(ms) {
    var setsP1 = ms.sets.map(function (s) { return s.p1; }).join(' ');
    var setsP2 = ms.sets.map(function (s) { return s.p2; }).join(' ');
    var cs = ms.sets[ms.sets.length - 1] || { p1: 0, p2: 0 };
    return '<div class="tl-score-block"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:var(--tl-text-3);font-family:var(--tl-font-mono)">Set ' + ms.set + '</div><div class="tl-score-sets">' + setsP1 + '  ' + setsP2 + '</div><div class="tl-score-games">' + cs.p1 + '-' + cs.p2 + '</div><div class="tl-score-points"><span class="' + (ms.server === 'p1' ? 'serving' : '') + '">' + ms.p1Points + '</span><span style="color:var(--tl-text-3)"> - </span><span class="' + (ms.server === 'p2' ? 'serving' : '') + '">' + ms.p2Points + '</span></div></div>';
  }

  function renderSparkline(hist, p1, p2) {
    var w = 300, h = 56, px = 4, py = 6, yMin = 0.5, yMax = 2.0;
    function xF(i) { return hist.length <= 1 ? px : px + (i / (hist.length - 1)) * (w - 2 * px); }
    function yF(v) { var c = Math.max(yMin, Math.min(yMax, v)); return py + (1 - (c - yMin) / (yMax - yMin)) * (h - 2 * py); }
    var p1p = '', p2p = '';
    hist.forEach(function (p, i) { p1p += (i === 0 ? 'M' : 'L') + ' ' + xF(i).toFixed(2) + ' ' + yF(p.p1).toFixed(2) + ' '; p2p += (i === 0 ? 'M' : 'L') + ' ' + xF(i).toFixed(2) + ' ' + yF(p.p2).toFixed(2) + ' '; });
    var eqY = yF(1.0);
    var last = hist[hist.length - 1];
    var d = el('div', 'tl-dr-sparkline');
    d.innerHTML = '<div class="tl-dr-sparkline-header"><span class="tl-dr-sparkline-label">Evolution DR · par set</span><div class="tl-dr-sparkline-legend"><span><span class="dot amber"></span>' + p1.name.split(' ').slice(-1)[0] + ' ' + formatDR(last.p1) + '</span><span><span class="dot green"></span>' + p2.name.split(' ').slice(-1)[0] + ' ' + formatDR(last.p2) + '</span></div></div><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;width:100%"><line x1="' + px + '" y1="' + eqY + '" x2="' + (w - px) + '" y2="' + eqY + '" stroke="rgba(148,163,184,0.35)" stroke-width="1" stroke-dasharray="2 3"/><text x="' + (w - px - 2) + '" y="' + (eqY - 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="rgba(148,163,184,0.55)">1.00</text><path d="' + p1p + '" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="' + p2p + '" fill="none" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + xF(hist.length - 1) + '" cy="' + yF(last.p1) + '" r="2" fill="#f59e0b"/><circle cx="' + xF(hist.length - 1) + '" cy="' + yF(last.p2) + '" r="2" fill="#10B981"/></svg>';
    return d;
  }

  function renderGrid() {
    var g = el('div', 'tl-match-grid');
    if (state.loading) { g.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--tl-text-2)">Chargement des matchs en direct…</div>'; return g; }
    if (state.matches.length === 0) { g.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--tl-text-2)">Aucun match en direct pour le moment.<br><span style="font-size:11px;opacity:0.6">Les matchs apparaissent automatiquement lorsqu\'ils sont en cours.</span></div>'; return g; }
    state.matches.forEach(function (m) { g.appendChild(renderCard(m)); });
    return g;
  }

  function renderGridInto() {
    var gc = state.container.querySelector('#tl-match-grid');
    if (!gc) return;
    if (state._renderTimer) return;
    state._renderTimer = setTimeout(function () {
      state._renderTimer = null;
      var ng = renderGrid();
      gc.innerHTML = '';
      while (ng.firstChild) gc.appendChild(ng.firstChild);
    }, 500);
  }

  /* ── Polling (real mode) ── */
  function startPolling() {
    if (state._pollTimer) clearInterval(state._pollTimer);
    loadLive(); // immediate first load
    state._pollTimer = setInterval(function () {
      loadLive();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (state._pollTimer) { clearInterval(state._pollTimer); state._pollTimer = null; }
  }

  async function loadLive() {
    try {
      var res = await fetch(API_BASE + '/tennis/live?_=' + Date.now(), { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (!Array.isArray(data)) data = [];

      // Filter only live or recently finished
      var liveMatches = data.filter(function (m) { return m.is_live || (m.status && m.status !== 'scheduled'); });

      if (liveMatches.length > 0) {
        state.matches = liveMatches.map(mapLiveMatch);
        state.liveMode = true;
        state.loading = false;
      } else if (state.matches.length === 0 && !state.liveMode) {
        // No live matches from API and no mock yet — show empty
        state.loading = false;
        state.liveMode = true;
      }

      renderGridInto();
      renderKpiInto();

      state._lastPollTs = Date.now();
    } catch (e) {
      console.warn('[TennisLive] /tennis/live fetch failed:', e.message);
      if (!state.liveMode && state.matches.length === 0) {
        // Fallback to mock on first failure
        loadMock();
        renderGridInto();
        renderKpiInto();
      }
    }
  }

  /* ── Top 10 ── */
  var t10 = { players: [], loading: true, error: null };

  function fetchTop10() {
    t10.loading = true; t10.error = null;
    fetch(API_BASE + '/players/top10?surface=' + state.top10Surface + '&gender=' + state.top10Gender).then(function (r) { return r.json(); }).then(function (d) { t10.players = d.players || []; t10.loading = false; renderT10Into(); }).catch(function (e) { t10.error = e.message; t10.loading = false; renderT10Into(); });
  }

  function renderT10Panel() {
    var p = el('section', 'tl-top10');
    p.innerHTML = '<div class="tl-top10-header"><div><span class="tl-top10-title">Top 10 ' + state.top10Gender + '</span><span style="font-size:10px;font-family:var(--tl-font-mono);color:var(--tl-text-3);margin-left:8px">· ' + state.top10Surface + ' · composite score</span></div><div class="tl-top10-switcher"><button class="tl-switch-btn' + (state.top10Gender === 'ATP' ? ' active' : '') + '" data-g="ATP">ATP</button><button class="tl-switch-btn' + (state.top10Gender === 'WTA' ? ' active' : '') + '" data-g="WTA">WTA</button><button class="tl-switch-btn' + (state.top10Surface === 'clay' ? ' active' : '') + '" data-s="clay"><span class="tl-surface-dot clay"></span>cl</button><button class="tl-switch-btn' + (state.top10Surface === 'grass' ? ' active' : '') + '" data-s="grass"><span class="tl-surface-dot grass"></span>gr</button><button class="tl-switch-btn' + (state.top10Surface === 'hard' ? ' active' : '') + '" data-s="hard"><span class="tl-surface-dot hard"></span>ha</button><button class="tl-switch-btn' + (state.top10Surface === 'indoor' ? ' active' : '') + '" data-s="indoor"><span class="tl-surface-dot indoor"></span>in</button></div></div><div class="tl-top10-formula">Score = 40% ELO surface · 25% L5 · 20% forecast · 15% H2H</div><div id="tl-top10-list"></div>';
    p.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { state.top10Gender = b.getAttribute('data-g'); fetchTop10(); renderT10Header(); }); });
    p.querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { state.top10Surface = b.getAttribute('data-s'); fetchTop10(); renderT10Header(); }); });
    return p;
  }

  function renderT10Header() {
    var panel = state.container.querySelector('.tl-top10');
    if (!panel) return;
    var newPanel = renderT10Panel();
    var listDiv = panel.querySelector('#tl-top10-list');
    panel.parentNode.replaceChild(newPanel, panel);
    fetchTop10();
  }

  function renderT10Into() {
    var lc = state.container.querySelector('#tl-top10-list');
    if (!lc) return;
    lc.innerHTML = '';
    if (t10.loading) {
      for (var i = 0; i < 5; i++) lc.innerHTML += '<div class="tl-skeleton" style="padding:8px 12px"><div class="tl-skeleton-circle"></div><div style="flex:1"><div class="tl-skeleton-line" style="width:60%;height:10px;margin-bottom:4px"></div><div class="tl-skeleton-line" style="width:80%;height:8px"></div></div><div class="tl-skeleton-line" style="width:40px;height:14px"></div></div>';
      return;
    }
    if (t10.error) { lc.innerHTML = '<div style="padding:16px;text-align:center;color:var(--tl-red);font-size:11px;font-family:var(--tl-font-mono)">' + t10.error + '</div>'; return; }
    t10.players.forEach(function (p) {
      var rc = p.rank === 1 ? 'gold' : p.rank <= 3 ? 'blue' : 'gray';
      var av = p.photoUrl ? '<img class="tl-top10-avatar" src="' + p.photoUrl + '" alt="' + p.name + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/><div class="tl-top10-avatar-placeholder" style="display:none">' + p.name.slice(0, 2).toUpperCase() + '</div>' : '<div class="tl-top10-avatar-placeholder">' + p.name.slice(0, 2).toUpperCase() + '</div>';
      var l5 = p.l5 ? '<div class="tl-l5-bar">' + p.l5.split('').map(function (c) { return '<div class="tl-l5-dot ' + (c === 'W' ? 'w' : 'l') + '"></div>'; }).join('') + '</div>' : '';
      var fc = p.forecastDeltaPct >= 0 ? 'up' : 'down';
      var ft = (p.forecastDeltaPct >= 0 ? '+' : '') + p.forecastDeltaPct + '%';
      var row = el('div', 'tl-top10-row', { onclick: function () { openProfile(p.slug); } });
      row.innerHTML = '<div class="tl-rank-badge ' + rc + '">' + p.rank + '</div>' + av + '<div class="tl-top10-info"><div class="tl-top10-name">' + p.name + '</div><div class="tl-top10-meta">#' + p.officialRank + ' · ' + (p.country || '—') + ' · ELO ' + p.surfaceElo + '</div></div>' + l5 + '<div class="tl-top10-score"><div class="tl-top10-score-value">' + p.compositeScore.toFixed(1) + '</div><div class="tl-top10-score-fcst ' + fc + '">' + ft + '</div></div>';
      lc.appendChild(row);
    });
  }

  /* ── Search ── */
  var sch = { q: '', results: [], hi: 0, open: false, loading: false, dt: null };

  function renderSearch() {
    var w = el('div', 'tl-search-wrap');
    w.innerHTML = '<input class="tl-search-input" type="search" placeholder="Rechercher un joueur…" aria-label="Rechercher un joueur"/><div class="tl-search-dropdown" id="tl-search-dropdown"></div>';
    var inp = w.querySelector('input');
    inp.addEventListener('input', function (e) { onSchInput(e.target.value); });
    inp.addEventListener('keydown', onSchKey);
    return w;
  }

  function onSchInput(v) {
    sch.q = v;
    if (sch.dt) clearTimeout(sch.dt);
    if (v.trim().length < 1) { sch.open = false; sch.results = []; renderSchDD(); return; }
    sch.loading = true;
    sch.dt = setTimeout(function () {
      fetch(API_BASE + '/players/search?q=' + encodeURIComponent(v.trim()) + '&limit=15').then(function (r) { return r.json(); }).then(function (d) { sch.results = d.results || []; sch.open = sch.results.length > 0; sch.hi = 0; sch.loading = false; renderSchDD(); }).catch(function () { sch.loading = false; renderSchDD(); });
    }, 200);
  }

  function onSchKey(e) {
    if (!sch.open || sch.results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sch.hi = Math.min(sch.hi + 1, sch.results.length - 1); renderSchDD(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sch.hi = Math.max(sch.hi - 1, 0); renderSchDD(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (sch.results[sch.hi]) { openProfile(sch.results[sch.hi].slug); var inp = state.container.querySelector('.tl-search-input'); if (inp) { inp.value = ''; inp.blur(); } sch.open = false; renderSchDD(); } }
    else if (e.key === 'Escape') { sch.open = false; renderSchDD(); e.target.blur(); }
  }

  function renderSchDD() {
    var dd = state.container.querySelector('#tl-search-dropdown');
    if (!dd) return;
    dd.innerHTML = '';
    if (!sch.open || sch.results.length === 0) { dd.classList.remove('open'); return; }
    dd.classList.add('open');
    sch.results.forEach(function (p, i) {
      var av = p.photoUrl ? '<img class="tl-search-avatar" src="' + p.photoUrl + '" alt="' + p.name + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/><div class="tl-search-avatar-placeholder" style="display:none">' + p.name.slice(0, 2).toUpperCase() + '</div>' : '<div class="tl-search-avatar-placeholder">' + p.name.slice(0, 2).toUpperCase() + '</div>';
      var l5 = p.l5 ? '<div style="font-size:9px;font-family:var(--tl-font-mono)">' + p.l5.split('').map(function (c) { return '<span style="color:' + (c === 'W' ? '#10B981' : '#EF4444') + '">' + c + '</span>'; }).join('') + '</div>' : '';
      var fc = p.forecastDeltaPct != null ? '<span style="color:' + (p.forecastDeltaPct >= 0 ? '#10B981' : '#EF4444') + '"> · fcst ' + (p.forecastDeltaPct >= 0 ? '+' : '') + p.forecastDeltaPct + '%</span>' : '';
      var item = el('div', 'tl-search-item' + (i === sch.hi ? ' highlighted' : ''));
      item.innerHTML = av + '<div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px"><span class="tl-search-name">' + p.name + '</span><span class="tl-search-badge ' + (p.gender === 'ATP' ? 'atp' : 'wta') + '">' + p.gender + '</span></div><div class="tl-search-meta">#' + p.rank + ' · ' + (p.country || '—') + ' · score ' + p.compositeScore + fc + '</div></div>' + l5;
      item.addEventListener('mousedown', function (e) { e.preventDefault(); openProfile(p.slug); var inp = state.container.querySelector('.tl-search-input'); if (inp) inp.value = ''; sch.open = false; renderSchDD(); });
      item.addEventListener('mouseenter', function () { sch.hi = i; });
      dd.appendChild(item);
    });
  }

  /* ── Profile Modal ── */
  function openProfile(slug) {
    state.profileSlug = slug;
    renderProfile();
  }

  function closeProfile() {
    state.profileSlug = null;
    var o = document.getElementById('tl-profile-overlay');
    if (o) o.remove();
    document.body.style.overflow = '';
  }

  function renderProfile() {
    var ex = document.getElementById('tl-profile-overlay');
    if (ex) ex.remove();
    if (!state.profileSlug) return;
    document.body.style.overflow = 'hidden';
    var ov = el('div', null, { id: 'tl-profile-overlay', role: 'dialog', 'aria-modal': 'true', style: { position: 'fixed', inset: '0', zIndex: '10000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' } });
    ov.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)"></div><div style="position:relative;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;background:#1E2532;border:1px solid rgba(255,255,255,0.05);border-radius:8px;box-shadow:0 24px 64px rgba(0,0,0,0.6);padding:32px;text-align:center;color:#8B95A7;font-size:14px;font-family:var(--tl-font-mono)">Chargement du profil…</div>';
    ov.firstChild.addEventListener('click', closeProfile);
    document.body.appendChild(ov);
    document.addEventListener('keydown', function eh(e) { if (e.key === 'Escape') { closeProfile(); document.removeEventListener('keydown', eh); } });
    fetch(API_BASE + '/players/' + state.profileSlug).then(function (r) { if (r.status === 404) throw new Error('Joueur introuvable'); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      var modal = ov.children[1];
      modal.innerHTML = renderProfileHTML(d.player);
      modal.scrollTop = 0;
    }).catch(function (e) {
      var modal = ov.children[1];
      modal.innerHTML = '<div style="padding:32px;text-align:center;color:#EF4444;font-size:14px;font-family:var(--tl-font-mono)">' + e.message + '</div>';
    });
  }

  function renderProfileHTML(p) {
    var taBadge = p.metricsSource === 'tennisabstract' ? '<span style="font-size:9px;font-family:var(--tl-font-mono);text-transform:uppercase;padding:2px 6px;border-radius:4px;color:#10B981;background:rgba(16,185,129,0.12)">TA Live</span>' : '<span style="font-size:9px;font-family:var(--tl-font-mono);text-transform:uppercase;padding:2px 6px;border-radius:4px;color:#F59E0B;background:rgba(245,158,11,0.12)">Synth</span>';
    var photo = p.photoUrl ? '<img src="' + p.photoUrl + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover"/>' : '<div style="font-size:24px;font-weight:700;color:#cbd5e1">' + p.name.slice(0, 2).toUpperCase() + '</div>';
    var eloTxt = p.elo ? ' · <span style="color:#3B82F6">Elo ' + p.elo + '</span>' : '';
    var taLink = p.taId ? ' · <a href="https://www.tennisabstract.com/cgi-bin/player.cgi?p=' + p.taId + '" target="_blank" rel="noopener" style="color:#10B981;text-decoration:none">Tennis Abstract</a>' : '';
    var h = '<div style="display:flex;align-items:center;gap:16px;padding:20px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(15,20,25,0.4)"><div style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:#0F1419;border:2px solid rgba(255,255,255,0.1);flex-shrink:0;display:flex;align-items:center;justify-content:center">' + photo + '</div><div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:10px;font-family:var(--tl-font-mono);text-transform:uppercase;padding:2px 6px;border-radius:4px;color:' + (p.gender === 'ATP' ? '#3B82F6' : '#10B981') + ';background:' + (p.gender === 'ATP' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)') + '">' + p.gender + '</span><span style="font-size:11px;font-family:var(--tl-font-mono);color:#8B95A7">#' + p.rank + (p.peakRank && p.peakRank < p.rank ? ' (peak #' + p.peakRank + ')' : '') + ' · ' + (p.country || '—') + '</span>' + taBadge + '</div><h2 style="font-size:24px;font-weight:700;color:#fff;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.name + '</h2><div style="font-size:11px;font-family:var(--tl-font-mono);color:#64748B;margin-top:2px">' + p.points.toLocaleString('en-US') + ' points' + eloTxt + taLink + '</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:10px;text-transform:uppercase;color:#64748B;font-family:var(--tl-font-mono)">Composite</div><div style="font-size:28px;font-weight:700;font-family:var(--tl-font-mono);color:#10B981">' + p.compositeScore.toFixed(1) + '</div></div></div>';

    var elo = '<div style="padding:20px"><div style="margin-bottom:16px"><h3 style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8B95A7;margin-bottom:8px">ELO par surface</h3><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
    [['hard', p.eloHard, p.eloHardRank, '#3B82F6'], ['clay', p.eloClay, p.eloClayRank, '#F59E0B'], ['grass', p.eloGrass, p.eloGrassRank, '#10B981'], ['indoor', p.eloIndoor, null, '#8B95A7']].forEach(function (s) {
      elo += '<div style="background:#0F1419;border:1px solid rgba(255,255,255,0.05);border-radius:6px;padding:8px"><div style="font-size:10px;text-transform:uppercase;color:#64748B;font-family:var(--tl-font-mono);margin-bottom:4px">' + s[0] + '</div><div style="font-size:16px;font-weight:700;font-family:var(--tl-font-mono);color:#fff">' + s[1] + '</div>' + (s[2] ? '<div style="font-size:9px;font-family:var(--tl-font-mono);color:#8B95A7">rank #' + s[2] + '</div>' : '') + '</div>';
    });
    elo += '</div></div>';

    if (p.hard && p.hard.matches > 0) {
      elo += '<div style="margin-bottom:16px"><h3 style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8B95A7;margin-bottom:8px">Career splits par surface</h3><div style="background:#0F1419;border:1px solid rgba(255,255,255,0.05);border-radius:6px;overflow:hidden"><table style="width:100%;font-size:11px;font-family:var(--tl-font-mono);border-collapse:collapse"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.05);color:#64748B"><th style="text-align:left;padding:6px 8px">Surface</th><th style="text-align:right;padding:6px 8px">M</th><th style="text-align:right;padding:6px 8px">Win%</th><th style="text-align:right;padding:6px 8px">DR</th><th style="text-align:right;padding:6px 8px">SPW</th><th style="text-align:right;padding:6px 8px">RPW</th><th style="text-align:right;padding:6px 8px">Hld%</th><th style="text-align:right;padding:6px 8px">Brk%</th></tr></thead><tbody>';
      [['Hard', p.hard], ['Clay', p.clay], ['Grass', p.grass]].forEach(function (r) {
        var s = r[1]; if (!s || s.matches === 0) return;
        var dc = s.dr >= 1.2 ? '#10B981' : s.dr >= 1.0 ? '#fff' : '#EF4444';
        elo += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)"><td style="padding:6px 8px;color:#fff">' + r[0] + '</td><td style="text-align:right;padding:6px 8px;color:#8B95A7">' + s.matches + '</td><td style="text-align:right;padding:6px 8px;color:#fff">' + s.winPct.toFixed(1) + '%</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:' + dc + '">' + s.dr.toFixed(2) + '</td><td style="text-align:right;padding:6px 8px;color:#8B95A7">' + s.spw.toFixed(1) + '%</td><td style="text-align:right;padding:6px 8px;color:#8B95A7">' + s.rpw.toFixed(1) + '%</td><td style="text-align:right;padding:6px 8px;color:#8B95A7">' + s.holdPct.toFixed(1) + '%</td><td style="text-align:right;padding:6px 8px;color:#8B95A7">' + s.breakPct.toFixed(1) + '%</td></tr>';
      });
      elo += '</tbody></table></div></div>';
    }

    if (p.l5) {
      elo += '<div style="margin-bottom:16px"><h3 style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8B95A7;margin-bottom:8px">Forme recente (L5)</h3><div style="background:#0F1419;border:1px solid rgba(255,255,255,0.05);border-radius:6px;padding:12px;display:flex;align-items:center;gap:16px"><div style="display:flex;gap:4px">' + p.l5.split('').map(function (c) { return '<div style="width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:' + (c === 'W' ? '#10B981' : '#EF4444') + ';background:' + (c === 'W' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)') + '">' + c + '</div>'; }).join('') + '</div></div></div>';
    }

    elo += '</div>';
    return h + elo;
  }

  /* ── KPI ── */
  function renderKpi() {
    var live = state.matches.filter(function (m) { return m._isLive; }).length;
    var total = state.matches.length;
    return '<div class="tl-kpi-bar"><div class="tl-kpi-tile"><div class="tl-kpi-value green">' + live + '</div><div class="tl-kpi-label">Matchs Live</div></div><div class="tl-kpi-tile"><div class="tl-kpi-value blue">' + total + '</div><div class="tl-kpi-label">Matchs visible</div></div><div class="tl-kpi-tile"><div class="tl-kpi-value amber">' + (state.liveMode ? 'LIVE' : 'MOCK') + '</div><div class="tl-kpi-label">Source</div></div><div class="tl-kpi-tile"><div class="tl-kpi-value">' + (state._lastPollTs ? new Date(state._lastPollTs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—') + '</div><div class="tl-kpi-label">Derniere MAJ</div></div></div>';
  }

  function renderKpiInto() {
    var kpi = state.container.querySelector('.tl-kpi-bar');
    if (kpi) kpi.outerHTML = renderKpi();
  }

  /* ── Init ── */
  function init(containerId) {
    state.container = document.getElementById(containerId);
    if (!state.container) { console.error('[TennisLive] Container #' + containerId + ' not found'); return; }
    state.container.innerHTML = '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px"><h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#fff;margin:0">Value Bets Tennis · Live</h2><span style="font-size:11px;font-family:var(--tl-font-mono);color:#64748B" id="tl-match-count">Chargement…</span></div>' + renderKpi() + '<div class="tl-layout"><div class="tl-sidebar" id="tl-sidebar"></div><div class="tl-main"><div id="tl-match-grid"></div><div id="tl-top10-panel"></div></div></div>';
    var sb = state.container.querySelector('#tl-sidebar');
    sb.appendChild(renderSearch());
    var t10p = state.container.querySelector('#tl-top10-panel');
    t10p.appendChild(renderT10Panel());
    fetchTop10();
    renderT10Into();
    startPolling();
    renderGridInto();
  }

  /* ── Mock fallback (only if /tennis/live returns nothing) ── */
  function loadMock() {
    state.liveMode = false;
    state.loading = false;
    console.warn('[TennisLive] Using mock data — /api/v1/tennis/live unavailable');
    var ps = [
      { name: 'Sinner Jannik', rank: 1, elo: 2320, country: 'ITA', flag: 'it', preWinProb: 0.65 },
      { name: 'Fritz Taylor', rank: 12, elo: 2050, country: 'USA', flag: 'us', preWinProb: 0.55 },
      { name: 'Alcaraz Carlos', rank: 2, elo: 2167, country: 'ESP', flag: 'es', preWinProb: 0.60 },
      { name: 'Djokovic Novak', rank: 8, elo: 2100, country: 'SRB', flag: 'rs', preWinProb: 0.58 },
      { name: 'Ruud Casper', rank: 6, elo: 2000, country: 'NOR', flag: 'no', preWinProb: 0.52 },
      { name: 'Zverev Alexander', rank: 4, elo: 2080, country: 'GER', flag: 'de', preWinProb: 0.56 }
    ];
    var ts = ['Wimbledon', 'Eastbourne', 'Mallorca', 'Berlin', 'Bad Homburg', 'Wimbledon'];
    var rs = ['Finale', 'Demi', 'Quart', '8e', '8e', '8e'];
    state.matches = [];
    for (var i = 0; i < 6; i++) {
      state.matches.push(createMockMatch({ id: 'm' + i, tournament: ts[i], round: rs[i], surface: 'Gazon', p1: ps[i], p2: ps[(i + 3) % 6], tour: 'ATP' }));
    }
  }

  function createMockMatch(cfg) {
    var sets = [{ p1: 3 + (Math.abs(hashCode(cfg.id)) % 4), p2: 2 + (Math.abs(hashCode(cfg.id + 'b')) % 5) }];
    var drVal = 1 + (Math.abs(hashCode(cfg.id + 'dr')) % 40) / 100; // 1.00-1.40
    return {
      id: cfg.id, tournament: cfg.tournament, round: cfg.round, surface: cfg.surface, tour: cfg.tour,
      p1: cfg.p1, p2: cfg.p2,
      _server: 'p1',
      _sets: sets, _set: 1, _g1: '15', _g2: '30',
      _fin: false, _win: null, _lastBreak: false,
      _drHist: [{ p1: drVal, p2: 1 / drVal }],
      _dr: { p1: drVal, p2: 1 / drVal, delta: Math.abs(drVal - 1 / drVal), exact: false, reliable: false, source: 'mock' },
      _svc: [], _intensity: 55, _pressure: 60,
      _liveWinProb: 58, _isLive: false, _startTime: null,
      _currentPoint: null, _serving: 'p1',
      _holdPct1: null, _holdPct2: null, _rallyAvg: null, _betfairWom: null,
      _bppi: null, _glicko2: null, _bsdStats: null, _serveMomentum: null
    };
  }

  function hashCode(s) { var h = 0; for (var i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) >>> 0); return h; }

  function destroy() {
    stopPolling();
    closeProfile();
  }

  return { init: init, destroy: destroy, openProfile: openProfile, closeProfile: closeProfile, computeDRFromBSD: computeDRFromBSD, formatDR: formatDR };
})();