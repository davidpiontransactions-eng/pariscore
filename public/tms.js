/* ═══ TOP MULTI-SPORT — Client JS ═══ */
(function () {
  'use strict';

  var POLL_MS = 120000;
  var CACHE_MS = 60000;
  var API = '/api/v1/top-matches/all';

  var _cache = {};
  var _pollTimer = null;
  var _currentSport = 'all';

  /* XSS protection */
  function _tmsEsc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _cacheKey(sport) { return sport + ':' + Date.now(); }

  function _isFresh(key) {
    var e = _cache[key];
    return e && (Date.now() - e.ts) < CACHE_MS;
  }

  /* Fetch with cache */
  function fetchTop(sport, cb) {
    var key = sport;
    if (_isFresh(key)) { cb(_cache[key].data); return; }
    var url = API + '?sport=' + encodeURIComponent(sport) + '&limit=10';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _cache[key] = { data: d, ts: Date.now() };
        cb(d);
      })
      .catch(function () { cb({ groups: [] }); });
  }

  /* Render one match row */
  function renderMatch(m) {
    var odds = '';
    if (m.odds) {
      var boxes = [];
      if (m.odds.home != null) {
        var cls = m.odds.best === 'home' ? ' tms-odds--best' : '';
        boxes.push('<div class="tms-odds-box' + cls + '">' + _tmsEsc(m.odds.home) + '</div>');
      }
      if (m.odds.draw != null) {
        var cls2 = m.odds.best === 'draw' ? ' tms-odds--best' : '';
        boxes.push('<div class="tms-odds-box' + cls2 + '">' + _tmsEsc(m.odds.draw) + '</div>');
      }
      if (m.odds.away != null) {
        var cls3 = m.odds.best === 'away' ? ' tms-odds--best' : '';
        boxes.push('<div class="tms-odds-box' + cls3 + '">' + _tmsEsc(m.odds.away) + '</div>');
      }
      odds = '<div class="tms-match-odds">' + boxes.join('') + '</div>';
    }

    var metric = '';
    if (m.metric) {
      metric = '<div class="tms-metric"><div class="tms-metric-value">' +
        _tmsEsc(m.metric.value) + (m.metric.max ? '/' + _tmsEsc(m.metric.max) : '') +
        '</div><div class="tms-metric-label">' + _tmsEsc(m.metric.label) + '</div></div>';
    }

    var badge = '';
    if (m.badge) {
      badge = '<div class="tms-badge" style="background:' + _tmsEsc(m.badge.color) + '">' +
        _tmsEsc(m.badge.label) + '</div>';
    }

    var ko = m.kickoff ? new Date(m.kickoff) : null;
    var time = ko ? (ko.getHours().toString().padStart(2, '0') + ':' + ko.getMinutes().toString().padStart(2, '0')) : '--:--';
    var date = ko ? ko.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';

    var homeLogo = m.home && m.home.logo ? '<img class="tms-team-logo" src="' + _tmsEsc(m.home.logo) + '" alt="">' : '';
    var awayLogo = m.away && m.away.logo ? '<img class="tms-team-logo" src="' + _tmsEsc(m.away.logo) + '" alt="">' : '';

    var scoreEl = m.score ? ' <span style="color:#999;font-size:11px">' + _tmsEsc(m.score) + '</span>' : '';
    var statusLive = m.status === 'live' ? ' <span style="color:#f44336;font-size:10px;font-weight:700">LIVE</span>' : '';

    return '<div class="tms-match-row">' +
      '<div class="tms-match-time"><div>' + _tmsEsc(time) + '</div><div class="tms-date">' + _tmsEsc(date) + '</div></div>' +
      '<div class="tms-match-teams">' +
        '<div class="tms-team">' + homeLogo + '<span class="tms-team-name">' + _tmsEsc(m.home ? m.home.name : '') + (m.home && m.home.rank ? ' <span style="color:#999;font-size:10px">#' + m.home.rank + '</span>' : '') + scoreEl + statusLive + '</span></div>' +
        '<div class="tms-team">' + awayLogo + '<span class="tms-team-name">' + _tmsEsc(m.away ? m.away.name : '') + (m.away && m.away.rank ? ' <span style="color:#999;font-size:10px">#' + m.away.rank + '</span>' : '') + '</span></div>' +
      '</div>' +
      odds + metric + badge +
    '</div>';
  }

  /* Render all leagues */
  function tmsRender(data) {
    var el = document.getElementById('tms-leagues');
    var countEl = document.getElementById('tms-count');
    var emptyEl = document.getElementById('tms-empty');
    if (!el) return;

    var groups = (data && data.groups) || [];
    if (!groups.length) {
      el.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      if (countEl) countEl.textContent = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var totalMatches = 0;
    var html = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      totalMatches += g.matches.length;
      var matchesHtml = '';
      for (var j = 0; j < g.matches.length; j++) {
        matchesHtml += renderMatch(g.matches[j]);
      }
      html += '<div class="tms-league-card">' +
        '<div class="tms-league-header" style="background:' + _tmsEsc(g.leagueColor) + '">' +
          '<span>' + _tmsEsc(g.leagueIcon) + ' ' + _tmsEsc(g.league) + '</span>' +
          '<div class="tms-league-cols"><span>1</span><span>N</span><span>2</span></div>' +
        '</div>' +
        matchesHtml +
      '</div>';
    }
    el.innerHTML = html;
    if (countEl) countEl.textContent = totalMatches + ' matchs';
  }

  /* Sport switch */
  window.tmsSwitchSport = function (sport, btn) {
    _currentSport = sport;
    var tabs = document.querySelectorAll('.tms-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    if (btn) btn.classList.add('active');
    fetchTop(sport, tmsRender);
  };

  /* Manual refresh */
  window.tmsRefresh = function () {
    var btn = document.getElementById('tms-refresh');
    if (btn) { btn.classList.add('tms-spinning'); setTimeout(function () { btn.classList.remove('tms-spinning'); }, 500); }
    _cache = {};
    fetchTop(_currentSport, tmsRender);
  };

  /* Polling */
  function startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(function () { fetchTop(_currentSport, tmsRender); }, POLL_MS);
  }

  /* Init */
  window.initTopMultiSport = function () {
    fetchTop('all', tmsRender);
    startPolling();
  };

  /* Auto-init if #top-multi-sport already exists */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.getElementById('top-multi-sport')) initTopMultiSport();
    });
  } else if (document.getElementById('top-multi-sport')) {
    initTopMultiSport();
  }
})();
