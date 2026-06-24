/* ═══════════════════════════════════════════════════════════════
 * ParisScore — Tennis Live (Vanilla JS)
 * No React, no dependencies, no build step.
 * File: tennis-live.js
 * ═══════════════════════════════════════════════════════════════ */

var TennisLive = (function () {
  'use strict';

  var API_BASE = '/api/v1';
  var AUTOPLAY_MS = 1800;

  var state = {
    container: null,
    matches: [],
    top10Surface: 'hard',
    top10Gender: 'ATP',
    profileSlug: null,
    loading: true,
    _renderTimer: null
  };

  /* ── DR Engine ── */
  function computeDR(s) {
    var hs = s.p1ServeWon + s.p1ReturnWon;
    var as = s.p2ServeWon + s.p2ReturnWon;
    if (hs <= 0 || as <= 0) return { p1: 1, p2: 1, delta: 0, exact: false, reliable: false };
    var d = hs / as;
    return { p1: d, p2: 1 / d, delta: Math.abs(d - 1 / d), exact: true, reliable: (s.p1ReturnTotal || 0) >= 6 };
  }

  function formatDR(v) { return isFinite(v) ? v.toFixed(2) : '—'; }

  /* ── Match Sim ── */
  var PTS = ['0', '15', '30', '40'];

  function ptDisp(p1, p2) {
    if (p1 < 3 && p2 < 3) return [PTS[p1], PTS[p2]];
    if (p1 === p2) return ['40', '40'];
    if (p1 === p2 + 1) return ['Ad', '40'];
    if (p2 === p1 + 1) return ['40', 'Ad'];
    return [p1 > p2 ? 'Ad' : '40', p2 > p1 ? 'Ad' : '40'];
  }

  function gameWon(p1, p2) {
    if (p1 >= 4 && p1 - p2 >= 2) return { won: true, w: 'p1' };
    if (p2 >= 4 && p2 - p1 >= 2) return { won: true, w: 'p2' };
    return { won: false };
  }

  function setWon(g1, g2) {
    if (g1 >= 6 && g1 - g2 >= 2) return { won: true, w: 'p1' };
    if (g2 >= 6 && g2 - g1 >= 2) return { won: true, w: 'p2' };
    if (g1 === 7 && g2 === 6) return { won: true, w: 'p1' };
    if (g2 === 7 && g1 === 6) return { won: true, w: 'p2' };
    return { won: false };
  }

  function matchWon(sets) {
    var s1 = 0, s2 = 0;
    for (var i = 0; i < sets.length; i++) {
      if (sets[i].p1 > sets[i].p2) s1++; else if (sets[i].p2 > sets[i].p1) s2++;
    }
    if (s1 >= 2) return { won: true, w: 'p1' };
    if (s2 >= 2) return { won: true, w: 'p2' };
    return { won: false };
  }

  function createMatch(cfg) {
    var h = 0;
    for (var i = 0; i < cfg.id.length; i++) h = ((h * 31 + cfg.id.charCodeAt(i)) >>> 0);
    var off = h % 1500;
    var m = {
      id: cfg.id, tournament: cfg.tournament, round: cfg.round, surface: cfg.surface,
      p1: cfg.p1, p2: cfg.p2,
      _server: off % 2 === 0 ? 'p1' : 'p2',
      _sets: [{ p1: 0, p2: 0 }], _set: 1, _g1: 0, _g2: 0,
      _sw: { p1: 5 + (off % 4), p2: 6 + (off % 4) },
      _st: { p1: 9 + (off % 5), p2: 10 + (off % 5) },
      _rw: { p1: 0, p2: 0 }, _rt: { p1: 0, p2: 0 },
      _bp: { p1c: 0, p2c: 0, p1f: 0, p2f: 0 },
      _rall: [], _svc: [], _fin: false, _win: null,
      _lastBreak: false, _drHist: [], _timer: null,
      _apMs: AUTOPLAY_MS + off, _pts: []
    };
    m._rw.p1 = m._st.p2 - m._sw.p2; m._rt.p1 = m._st.p2;
    m._rw.p2 = m._st.p1 - m._sw.p1; m._rt.p2 = m._st.p1;
    return m;
  }

  function stepMatch(m) {
    if (m._fin) return false;
    var srv = m._server;
    var pct = srv === 'p1' ? m.p1.baseServePct : m.p2.baseServePct;
    var sw = Math.random() < pct;
    var w = sw ? srv : (srv === 'p1' ? 'p2' : 'p1');
    m._rall.push(Math.max(1, Math.round(3 + Math.random() * 8)));
    if (m._rall.length > 100) m._rall.shift();
    if (srv === 'p1') { m._st.p1++; m._rt.p2++; if (w === 'p1') m._sw.p1++; else m._rw.p2++; }
    else { m._st.p2++; m._rt.p1++; if (w === 'p2') m._sw.p2++; else m._rw.p1++; }
    if (w === 'p1') m._g1++; else m._g2++;
    var gc = gameWon(m._g1, m._g2);
    var isBreak = false;
    var cs = m._sets[m._sets.length - 1];
    if (gc.won) {
      isBreak = gc.w !== srv;
      m._svc.push({ s: srv, h: !isBreak });
      if (m._svc.length > 12) m._svc.shift();
      cs = { p1: cs.p1 + (gc.w === 'p1' ? 1 : 0), p2: cs.p2 + (gc.w === 'p2' ? 1 : 0) };
      m._sets[m._sets.length - 1] = cs;
      m._g1 = 0; m._g2 = 0;
      m._server = srv === 'p1' ? 'p2' : 'p1';
      var sc = setWon(cs.p1, cs.p2);
      if (sc.won) {
        var mc = matchWon(m._sets);
        if (mc.won) { m._fin = true; m._win = mc.w; }
        else { m._set++; m._sets.push({ p1: 0, p2: 0 }); }
      }
    }
    var dr = computeDR({ p1ServeWon: m._sw.p1, p1ReturnWon: m._rw.p1, p1ReturnTotal: m._rt.p1, p2ServeWon: m._sw.p2, p2ReturnWon: m._rw.p2, p2ReturnTotal: m._rt.p2 });
    m._drHist.push({ p1: dr.p1, p2: dr.p2 });
    if (m._drHist.length > 60) m._drHist.shift();
    m._lastBreak = isBreak;
    m._pts.push({});
    return !m._fin;
  }

  function getMatchState(m) {
    var dr = computeDR({ p1ServeWon: m._sw.p1, p1ReturnWon: m._rw.p1, p1ReturnTotal: m._rt.p1, p2ServeWon: m._sw.p2, p2ReturnWon: m._rw.p2, p2ReturnTotal: m._rt.p2 });
    var cs = m._sets[m._sets.length - 1] || { p1: 0, p2: 0 };
    var pd = ptDisp(m._g1, m._g2);
    var hs = null;
    if (m._svc.length > 0) {
      var r = m._svc.slice(-6);
      var g1 = r.filter(function (g) { return g.s === 'p1'; });
      var g2 = r.filter(function (g) { return g.s === 'p2'; });
      hs = { p1: g1.length > 0 ? Math.round(g1.filter(function (g) { return g.h; }).length / g1.length * 100) : 0, p2: g2.length > 0 ? Math.round(g2.filter(function (g) { return g.h; }).length / g2.length * 100) : 0 };
    }
    var ra = null;
    if (m._rall.length > 0) { var s = 0; for (var i = 0; i < m._rall.length; i++) s += m._rall[i]; ra = s / m._rall.length; }
    var pw = (m.p1.preWinProb || 0.5) * 100;
    var sl = m._sets.reduce(function (a, s) { return a + (s.p1 - s.p2); }, 0);
    var gl = cs.p1 - cs.p2;
    var di = dr.p1 - 1;
    var bp = (m._bp.p2f - m._bp.p1f) * 2;
    var lw = Math.max(2, Math.min(98, pw + sl * 18 + gl * 4 + di * 20 + bp));
    var xw = Math.round(lw - pw);
    var ds = Math.abs(dr.p1 - dr.p2);
    var tb = m._bp.p1f + m._bp.p2f;
    var cg = Math.abs(m._g1 - m._g2) <= 1 ? 10 : 0;
    var int = Math.round(Math.min(100, 20 + ds * 25 + tb * 6 + cg + Math.abs(gl) * 2));
    return { dr: dr, sets: m._sets.map(function (s) { return { p1: s.p1, p2: s.p2 }; }), set: m._set, server: m._server, p1Points: pd[0], p2Points: pd[1], finished: m._fin, winner: m._win, lastIsBreak: m._lastBreak, pit: { dr: dr.exact ? dr.p1 : null, holdStreak: hs, rallyAvg: ra, xWinDelta: xw, liveWinProb: lw, intensity: int }, drHistory: m._drHist };
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
      else if (k === 'style' && typeof attrs[k] === 'object') for (var sk in attrs[k]) n.style[sk] = attrs[k][sk];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (children) { if (!Array.isArray(children)) children = [children]; children.forEach(function (c) { if (c == null) return; n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }); }
    return n;
  }

  function sStyle(obj) { var s = ''; for (var k in obj) s += k + ':' + obj[k] + ';'; return s; }

  function renderCard(m) {
    var ms = getMatchState(m);
    var pr = computePressure(ms);
    var pt = pr >= 80 ? 'tense' : pr >= 60 ? 'tight' : 'calm';
    var pCol = pt === 'tense' ? '#EF4444' : pt === 'tight' ? '#F59E0B' : '#10B981';
    var sl = ms.finished ? 'Termine' : pr >= 80 ? 'Critique' : pr >= 60 ? 'Serre' : 'Calme';
    var p1L = ms.dr.p1 - ms.dr.p2 > 0.05;
    var p2L = ms.dr.p1 - ms.dr.p2 < -0.05;

    var c = el('article', 'tl-card');
    var h = el('div', 'tl-card-header');
    h.innerHTML = '<div class="tl-card-tournament"><span class="tl-tournament-name">' + m.tournament + '</span><span class="tl-tournament-round">' + m.round + '</span><span class="tl-tournament-round">' + m.surface + '</span></div><div>' + (ms.finished ? '' : '<span class="tl-badge-live">LIVE</span>') + '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 8px;border-radius:4px;color:' + pCol + ';background:' + (pt === 'tense' ? 'rgba(239,68,68,0.12)' : pt === 'tight' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)') + '">' + sl + '</span><span class="tl-card-pressure">PRESSURE: <span class="tl-pressure-value" style="color:' + pCol + '">' + pr + '</span></span></div>';
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
    pitDiv.innerHTML = '<div class="tl-pit-title"><span>PIT · 6 indicateurs</span><span class="tl-pit-source">' + (ms.dr.exact ? 'DR Sofascore exact' : 'DR proxy') + '</span></div><div class="tl-pit-grid">' + pitMetric('Dom. Ratio', pit.dr != null ? formatDR(pit.dr) : '—', '\u0394 ' + formatDR(ms.dr.delta)) + pitMetric('Hold Streak', pit.holdStreak ? pit.holdStreak.p1 + '/' + pit.holdStreak.p2 + '%' : '—', 'P1/P2 % service') + pitMetric('Rally Avg', pit.rallyAvg != null ? pit.rallyAvg.toFixed(1) : '—', 'shots/point') + pitMetric('xWin Δ', pit.xWinDelta != null ? (pit.xWinDelta > 0 ? '+' : '') + pit.xWinDelta + 'pts' : '—', 'WP ' + (pit.liveWinProb != null ? Math.round(pit.liveWinProb) + '%' : '—')) + pitMetric('Intensity', String(pit.intensity), '/ 100') + '</div>';
    c.appendChild(pitDiv);

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
    var photo = p.photoUrl ? '<img src="' + p.photoUrl + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/><div class="tl-initials" style="display:none">' + p.name.slice(0, 2).toUpperCase() + '</div>' : '<div class="tl-initials">' + p.name.slice(0, 2).toUpperCase() + '</div>';
    var srvBadge = isServing ? '<span style="font-size:11px;font-family:var(--tl-font-mono);text-transform:uppercase;color:#10B981;background:rgba(16,185,129,0.12);padding:2px 4px;border-radius:4px">service</span>' : '';
    return '<div class="tl-player-block' + (right ? ' right' : '') + '"><div class="tl-player-avatar">' + photo + srvDot + '</div><div><div class="tl-player-name' + (isLeading ? ' leading' : '') + '"' + (right ? ' style="justify-content:flex-end"' : '') + '>' + (right ? srvBadge : '') + '<span>' + p.name + '</span>' + (!right ? srvBadge : '') + '</div><div class="tl-player-rank"' + (right ? ' style="text-align:right"' : '') + '>RK ' + (p.rank || '—') + ' · ELO ' + (p.elo || '—') + '</div></div></div>';
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
    d.innerHTML = '<div class="tl-dr-sparkline-header"><span class="tl-dr-sparkline-label">Evolution DR · 30 derniers pts</span><div class="tl-dr-sparkline-legend"><span><span class="dot amber"></span>' + p1.name.split(' ').slice(-1)[0] + ' ' + formatDR(last.p1) + '</span><span><span class="dot green"></span>' + p2.name.split(' ').slice(-1)[0] + ' ' + formatDR(last.p2) + '</span></div></div><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;width:100%"><line x1="' + px + '" y1="' + eqY + '" x2="' + (w - px) + '" y2="' + eqY + '" stroke="rgba(148,163,184,0.35)" stroke-width="1" stroke-dasharray="2 3"/><text x="' + (w - px - 2) + '" y="' + (eqY - 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="rgba(148,163,184,0.55)">1.00</text><path d="' + p1p + '" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="' + p2p + '" fill="none" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + xF(hist.length - 1) + '" cy="' + yF(last.p1) + '" r="2" fill="#f59e0b"/><circle cx="' + xF(hist.length - 1) + '" cy="' + yF(last.p2) + '" r="2" fill="#10B981"/></svg>';
    return d;
  }

  function renderGrid() {
    var g = el('div', 'tl-match-grid');
    if (state.matches.length === 0) { g.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--tl-text-2)">Chargement…</div>'; return g; }
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

  function startSim() {
    state.matches.forEach(function (m) {
      if (m._timer) clearInterval(m._timer);
      m._timer = setInterval(function () {
        var ok = stepMatch(m);
        if (!ok) { clearInterval(m._timer); m._timer = null; }
        renderGridInto();
      }, m._apMs);
    });
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
    var live = state.matches.filter(function (m) { return !m._fin; }).length;
    return '<div class="tl-kpi-bar"><div class="tl-kpi-tile"><div class="tl-kpi-value green">' + live + '</div><div class="tl-kpi-label">Matchs Live</div></div><div class="tl-kpi-tile"><div class="tl-kpi-value blue">100</div><div class="tl-kpi-label">Joueurs DB</div></div><div class="tl-kpi-tile"><div class="tl-kpi-value amber">16</div><div class="tl-kpi-label">Tournois</div></div><div class="tl-kpi-tile"><div class="tl-kpi-value">96</div><div class="tl-kpi-label">Photos</div></div></div>';
  }

  /* ── Init ── */
  function init(containerId) {
    state.container = document.getElementById(containerId);
    if (!state.container) { console.error('[TennisLive] Container #' + containerId + ' not found'); return; }
    state.container.innerHTML = '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px"><h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#fff;margin:0">Value Bets Tennis</h2><span style="font-size:11px;font-family:var(--tl-font-mono);color:#64748B">6 matchs · grid 3 cols</span></div>' + renderKpi() + '<div class="tl-layout"><div class="tl-sidebar" id="tl-sidebar"></div><div class="tl-main"><div id="tl-match-grid"></div><div id="tl-top10-panel"></div></div></div>';
    var sb = state.container.querySelector('#tl-sidebar');
    sb.appendChild(renderSearch());
    var t10p = state.container.querySelector('#tl-top10-panel');
    t10p.appendChild(renderT10Panel());
    loadMock();
    fetchTop10();
    renderT10Into();
    startSim();
    renderGridInto();
  }

  function loadMock() {
    state.loading = false;
    var ps = [
      { name: 'Sinner Jannik', rank: 1, elo: 2320, baseServePct: 0.65, preWinProb: 0.65, photoUrl: '/assets/players/atp/sinner-jannik.jpg' },
      { name: 'Alcaraz Carlos', rank: 2, elo: 2167, baseServePct: 0.63, preWinProb: 0.55, photoUrl: '/assets/players/atp/alcaraz-carlos.jpg' },
      { name: 'Djokovic Novak', rank: 8, elo: null, baseServePct: 0.64, preWinProb: 0.60, photoUrl: '/assets/players/atp/djokovic-novak.jpg' },
      { name: 'Sabalenka Aryna', rank: 1, elo: null, baseServePct: 0.62, preWinProb: 0.60, photoUrl: '/assets/players/wta/sabalenka-aryna.jpg' },
      { name: 'Swiatek Iga', rank: 3, elo: null, baseServePct: 0.61, preWinProb: 0.55, photoUrl: '/assets/players/wta/swiatek-iga.jpg' },
      { name: 'Rybakina Elena', rank: 2, elo: null, baseServePct: 0.63, preWinProb: 0.58, photoUrl: '/assets/players/wta/rybakina-elena.jpg' }
    ];
    var ts = ['Wimbledon', 'Eastbourne', 'Mallorca', 'Berlin', 'Bad Homburg', 'Wimbledon'];
    var rs = ['Finale', 'Demi', 'Quart', '8e', '8e', '8e'];
    state.matches = [];
    for (var i = 0; i < 6; i++) {
      state.matches.push(createMatch({ id: 'm' + i, tournament: ts[i], round: rs[i], surface: 'Gazon', p1: ps[i % 3], p2: ps[(i + 3) % 6] }));
    }
  }

  function destroy() {
    state.matches.forEach(function (m) { if (m._timer) clearInterval(m._timer); });
    closeProfile();
  }

  return { init: init, destroy: destroy, openProfile: openProfile, closeProfile: closeProfile, computeDR: computeDR, formatDR: formatDR };
})();
