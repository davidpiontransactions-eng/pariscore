'use strict';

/**
 * basketballStandingsService.js — stats par équipe pour le sous-onglet
 * « Stats & Classements » basket (classement filtrable + heatmap de rangs).
 *
 * Sources :
 *  - ESPN /teams/{id}/statistics?season=Y (1 requête / équipe, // x4, cache disque
 *    data/basketball_h2h/{league}_teamstats_{season}_v2.json TTL 12h) ;
 *  - ESPN /standings (conférence + V-D) ;
 *  - SQLite pariscore.db.basketball_match_history (entry 100) → PPG / PPG Home /
 *    PPG Away / Points saison / points encaissés (source exacte home/away).
 *
 * Cache mémoire de process devant les caches disque (pattern basketballH2HService).
 */

const path = require('path');

// Réutilise les helpers du service H2H (même dossier) : _espnGet, caches, SQLite.
const h2h = require('./basketballH2HService.js');

const TTL_TEAMSTATS = 12 * 3600 * 1000;

const LEAGUE_SPORT_PATH = { nba: 'basketball/nba', wnba: 'basketball/wnba' };
// Saison civile pour la requête statistics ESPN (l'API répond avec la saison courante
// si le paramètre est absent/incohérent — comportement constaté 2026-09-30).
function statsSeason(league) {
  const d = new Date();
  if (league === 'wnba') return d.getMonth() + 1 >= 11 ? d.getFullYear() + 1 : d.getFullYear();
  return d.getMonth() + 1 >= 10 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Stats par équipe → { [teamId]: {fgPct, twoPct, ...} } (null si indispo). */
async function _espnTeamStats(league, season) {
  const file = `${league}_teamstats_${season}_v3.json`;
  const cached = h2h._loadJson(file, TTL_TEAMSTATS);
  if (cached) return cached;
  const teams = await h2h.getTeams(league);
  const sportPath = LEAGUE_SPORT_PATH[league];
  const out = {};
  // concurrence 4 — anti rate-limit
  const ids = teams.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 4) {
    const chunk = ids.slice(i, i + 4);
    const results = await Promise.all(chunk.map(async (id) => {
      try {
        const d = await h2h._espnGet(
          `/apis/site/v2/sports/${sportPath}/teams/${id}/statistics?season=${season}`
        );
        const cats = (d && d.results && d.results.stats && d.results.stats.categories) || [];
        const pick = (name) => {
          for (const c of cats) {
            const s = (c.stats || []).find((x) => x.name === name);
            if (s && Number.isFinite(s.value)) return s.value;
          }
          return null;
        };
        // % ESPN en base 10000 (0.4623 = 46.23 %) — certains feeds renvoient
        // directement 0..1, d'autres 0..10000 : normalisation défensive.
        const pct = (name) => {
          const v = pick(name);
          if (v == null) return null;
          return v <= 1.5 ? 100 * v : (v <= 100 ? v : v / 100);
        };
        return { id, v: {
          fgPct: pct('fieldGoalPct'),
          twoPct: pct('twoPointFieldGoalPct'),
          threePct: pct('threePointPct'),
          ftPct: pct('freeThrowPct'),
          rpg: pick('avgRebounds'),
          orpg: pick('avgOffensiveRebounds'),
          drpg: pick('avgDefensiveRebounds'),
          apg: pick('avgAssists'),
          tpg: pick('avgTurnovers'),
          spg: pick('avgSteals'),
          bpg: pick('avgBlocks'),
          fpg: pick('avgFouls'),
        } };
      } catch (_) {
        return { id, v: null };
      }
    }));
    for (const r of results) if (r.v) out[r.id] = r.v;
  }
  if (Object.keys(out).length) h2h._saveJson(file, out);
  return out;
}

/** Standings ESPN → { [teamId]: {conference, rank, wins, losses} }. */
async function _espnStandings(league) {
  const file = `${league}_standings_v2.json`;
  const cached = h2h._loadJson(file, 6 * 3600 * 1000);
  if (cached) return cached;
  const sportPath = LEAGUE_SPORT_PATH[league];
  const d = await h2h._espnGet(`/apis/v2/sports/${sportPath}/standings`).catch(() => null);
  const out = {};
  const children = (d && Array.isArray(d.children)) ? d.children : [];
  for (const ch of children) {
    const entries = (ch.standings && ch.standings.entries) || [];
    for (const e of entries) {
      if (!e.team || !e.team.id) continue;
      const stat = (name) => {
        const s = (e.standings && e.standings.stats ? e.standings.stats : e.stats || []).find
          ? (e.standings && e.standings.stats || e.stats || []).find((x) => x.name === name)
          : null;
        return s ? s.value : null;
      };
      out[String(e.team.id)] = {
        conference: ch.abbreviation === 'West' ? 'West' : 'East',
        rank: stat('playoffSeed') || stat('rank') || null,
        wins: stat('wins') != null ? Math.round(stat('wins')) : null,
        losses: stat('losses') != null ? Math.round(stat('losses')) : null,
      };
    }
  }
  if (Object.keys(out).length) h2h._saveJson(file, out);
  return out;
}

/**
 * Stats SQLite (entry 100) : { [abbr]: {games, ppg, ppgHome, ppgAway, points, oppg} }
 * sur la saison en cours (fenêtre civil du calendrier de la ligue).
 */
function _sqliteSeasonStats(league) {
  const db = h2h._historyDb();
  if (!db) return {};
  const lg = league === 'nba' ? 'NBA' : 'WNBA';
  const d = new Date();
  let from, to;
  if (league === 'wnba') {
    from = `${d.getFullYear()}-05-01`; to = `${d.getFullYear()}-10-31`;
  } else {
    const seasonStart = d.getMonth() + 1 >= 10 ? d.getFullYear() : d.getFullYear() - 1;
    from = `${seasonStart}-10-01`; to = `${seasonStart + 1}-06-30`;
  }
  let rows;
  try {
    rows = db.prepare(
      "SELECT home_key, home_score, away_key, away_score FROM basketball_match_history WHERE league = ? AND date >= ? AND date <= ?"
    ).all(lg, from, to);
  } catch (e) {
    console.warn('[basket-standings] lecture SQLite échouée:', e.message);
    return {};
  }
  const map = new Map();
  for (const r of rows) {
    for (const [k, sc, op, isHome] of [[r.home_key, r.home_score, r.away_score, 1], [r.away_key, r.away_score, r.home_score, 0]]) {
      const t = map.get(k) || { games: 0, pts: 0, opp: 0, hg: 0, hpts: 0, ag: 0, apts: 0, wins: 0, losses: 0 };
      t.games++; t.pts += sc; t.opp += op;
      if (sc > op) t.wins++; else t.losses++;
      if (isHome) { t.hg++; t.hpts += sc; } else { t.ag++; t.apts += sc; }
      map.set(k, t);
    }
  }
  const out = {};
  for (const [k, t] of map) {
    out[k] = {
      games: t.games,
      wins: t.wins,
      losses: t.losses,
      ppg: t.games ? +(t.pts / t.games).toFixed(2) : null,
      ppgHome: t.hg ? +(t.hpts / t.hg).toFixed(2) : null,
      ppgAway: t.ag ? +(t.apts / t.ag).toFixed(2) : null,
      points: t.pts,
      oppg: t.games ? +(t.opp / t.games).toFixed(2) : null,
    };
  }
  return out;
}

/**
 * Payload complet pour l'UI : une ligne par équipe (abbl, conf, V-D, toutes les
 * métriques du classement). Les ids ESPN servent de clé, l'abbr SQLite fait le
 * lien avec PPG Home/Away.
 */
async function getStandingsFull(league) {
  const teams = await h2h.getTeams(league);
  const season = statsSeason(league);
  const [espnStats, standings, sqlite] = await Promise.all([
    _espnTeamStats(league, season).catch(() => ({})),
    _espnStandings(league).catch(() => ({})),
    Promise.resolve(_sqliteSeasonStats(league)),
  ]);
  return {
    league,
    season,
    teams: teams.map((t) => {
      const st = espnStats[t.id] || {};
      const sq = sqlite[t.abbr] || {};
      const sd = standings[t.id] || {};
      return {
        id: t.id,
        name: t.name,
        abbr: t.abbr,
        logo: t.logo,
        conference: sd.conference || null,
        rank: sd.rank || null,
        wins: sq.wins != null ? sq.wins : (sd.wins && (sd.wins || sd.losses) ? sd.wins : null),
        losses: sq.losses != null ? sq.losses : (sd.losses && (sd.wins || sd.losses) ? sd.losses : null),
        games: sq.games || null,
        ppg: sq.ppg || null,
        ppgHome: sq.ppgHome || null,
        ppgAway: sq.ppgAway || null,
        points: sq.points || null,
        oppg: sq.oppg || null,
        fgPct: st.fgPct != null ? +st.fgPct.toFixed(1) : null,
        twoPct: st.twoPct != null ? +st.twoPct.toFixed(1) : null,
        threePct: st.threePct != null ? +st.threePct.toFixed(1) : null,
        ftPct: st.ftPct != null ? +st.ftPct.toFixed(1) : null,
        rpg: st.rpg != null ? +st.rpg.toFixed(1) : null,
        orpg: st.orpg != null ? +st.orpg.toFixed(1) : null,
        drpg: st.drpg != null ? +st.drpg.toFixed(1) : null,
        apg: st.apg != null ? +st.apg.toFixed(1) : null,
        tpg: st.tpg != null ? +st.tpg.toFixed(1) : null,
        spg: st.spg != null ? +st.spg.toFixed(1) : null,
        bpg: st.bpg != null ? +st.bpg.toFixed(1) : null,
        fpg: st.fpg != null ? +st.fpg.toFixed(1) : null,
      };
    }),
    generatedAt: new Date().toISOString(),
  };
}

/** Invalidation manuelle (debug/ops). */
function invalidateStandingsCache(league) {
  h2h.invalidateCache(`${league}_teamstats`);
  h2h.invalidateCache(`${league}_standings`);
}

module.exports = { getStandingsFull, invalidateStandingsCache, statsSeason };
