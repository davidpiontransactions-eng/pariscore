'use strict';

/**
 * services/liveLogoEnricher.js — Worker d'enrichissement de logos (équipes + championnats)
 * sur db.matches du serveur PariScore.
 *
 * Démarré dans bootInit() (server.js) après rebuildTeamLogosIndex, planifié toutes les 60s.
 *
 * Pour chaque match de db.matches :
 *   - ÉQUIPES (home/away) : si m.{side}_logo absent → lookupTeamLogo (cache DB team_logos)
 *     → si miss : cascade lib/logo-cascade → upsert team_logos → attache m.{side}_logo.
 *   - CHAMPIONNAT : si m.league_logo_url absent → lookupLeagueLogo (cache DB league_logos)
 *     → si miss : cascade lib/logo-cascade → upsert league_logos → attache m.league_logo_url.
 *
 * Anti-requêtes-redondantes :
 *   1. Cache DB d'abord (team_logos / league_logos).
 *   2. Set in-memory _attemptedTeams / _attemptedLeagues : une entité donnée ne déclenche
 *      la cascade AU PLUS une fois par vie du process.
 *   3. Batch limité MAX_NEW_PER_TICK pour respecter rate limits externes.
 *
 * Si une entité échoue (cascade=null), elle reste marquée attempted (pas de retry) ;
 * le fallback initiales côté UI prend le relais.
 *
 * Dépendances passées via init() — pattern identique à mmaService etc.
 */

const cascade = require('../lib/logo-cascade');
const {
  normalizeTeamName,
  resolveTeamLogo,
  resolveLeagueLogo,
  upsertTeamLogo,
  upsertLeagueLogo,
} = cascade;

// ─── State module (init via init()) ──────────────────────────────────────────
let _deps = null;          // { db, sqldb, lookupTeamLogo, broadcastSSE, matchesForBroadcast, buildMeta, sseClientsRef }
let _inited = false;
let _running = false;       // mutex enrichOnce (évite re-entry si cron < durée d'exécution)
let _timer = null;

// Caches in-memory persistants entre ticks (jamais reset sauf redémarrage)
const _attemptedTeams = new Set();    // name_norm déjà traités (succès ou échec)
const _attemptedLeagues = new Set();  // leagueKey déjà traités
const _leagueMemCache = new Map();    // name_norm → {url, bsdLeagueId} | null (miroir _teamLogoMemCache)

// Batch limit (par tick) — respecte rate limits TheSportsDB (2/s) + BSD (1/s) + API-Football (1/s)
const MAX_TEAM_LOOKUPS_PER_TICK = 4;
const MAX_LEAGUE_LOOKUPS_PER_TICK = 4;

/**
 * Initialise le worker. Idempotent.
 * @param {object} deps
 *   - db            : ref vers l'objet db global (db.matches)
 *   - sqldb         : better-sqlite3 Database (pour league_logos)
 *   - lookupTeamLogo: fn(name) → {url, bsdId} | null  (déjà définie côté server.js)
 *   - broadcastSSE  : fn(eventName, data)
 *   - matchesForBroadcast : fn() → array
 *   - buildMeta     : fn() → object
 *   - sseClientsRef : Set des clients SSE (pour guard)
 */
function init(deps) {
  if (_inited) return;
  if (!deps || !deps.db) {
    console.warn('[LogoEnricher] init: deps.db manquant — abort');
    return;
  }
  _deps = deps;
  // Création idempotente de league_logos (server.js la crée aussi dans initSQLite,
  // mais on garde le double here pour robustesse — CREATE IF NOT EXISTS).
  try {
    if (_deps.sqldb) {
      _deps.sqldb.exec(`
        CREATE TABLE IF NOT EXISTS league_logos (
          bsd_league_id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          name_norm TEXT NOT NULL,
          country TEXT,
          sport TEXT,
          logo_url TEXT NOT NULL,
          source TEXT,
          indexed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_league_logos_norm ON league_logos(name_norm);
        CREATE INDEX IF NOT EXISTS idx_league_logos_sport ON league_logos(sport);
      `);
    }
  } catch (e) {
    console.warn('[LogoEnricher] init: création league_logos échouée:', e.message);
  }
  _inited = true;
  console.log('  [LogoEnricher] activé — cron 60s + 1er tick boot 90s');
}

/**
 * Lookup league logo (miroir de lookupTeamLogo côté server.js).
 * Cache mémoire d'abord, puis DB league_logos (exact puis fuzzy).
 * @returns {{url, bsdLeagueId} | null}
 */
function lookupLeagueLogo(name, sport) {
  if (!_deps || !_deps.sqldb) return null;
  if (!name) return null;
  const norm = normalizeTeamName(name);
  if (!norm) return null;
  const cacheKey = sport ? `${norm}|${sport}` : norm;
  if (_leagueMemCache.has(cacheKey)) return _leagueMemCache.get(cacheKey);
  let result = null;
  try {
    let row;
    if (sport) {
      row = _deps.sqldb.prepare('SELECT bsd_league_id, logo_url FROM league_logos WHERE name_norm = ? AND sport = ? LIMIT 1').get(norm, sport);
    } else {
      row = _deps.sqldb.prepare('SELECT bsd_league_id, logo_url FROM league_logos WHERE name_norm = ? LIMIT 1').get(norm);
    }
    if (!row && norm.length >= 3) {
      row = _deps.sqldb.prepare(
        "SELECT bsd_league_id, logo_url FROM league_logos WHERE name_norm LIKE ? OR ? LIKE '%' || name_norm || '%' LIMIT 1"
      ).get(norm + '%', norm);
    }
    if (row) result = { url: row.logo_url, bsdLeagueId: row.bsd_league_id };
  } catch (e) { /* DB pas prête */ }
  _leagueMemCache.set(cacheKey, result);
  return result;
}

/**
 * Invalide une entrée du cache mémoire league (après upsert, pour forcer re-lookup).
 */
function _invalidateLeagueMemCache(name, sport) {
  const norm = normalizeTeamName(name);
  const cacheKey = sport ? `${norm}|${sport}` : norm;
  _leagueMemCache.delete(cacheKey);
}

/**
 * Une passe d'enrichissement sur db.matches.
 * Batch limité, async (cascade réseau), safe à appeler depuis setInterval.
 * @returns {Promise<{teamsAdded:number, leaguesAdded:number, changed:boolean}>}
 */
async function enrichOnce() {
  if (!_inited || !_deps || !_deps.db) return { teamsAdded: 0, leaguesAdded: 0, changed: false };
  if (_running) {
    if (process.env.LOGO_ENRICHER_VERBOSE) console.warn('[LogoEnricher] enrichOnce déjà en cours — skip');
    return { teamsAdded: 0, leaguesAdded: 0, changed: false, skipped: true };
  }
  _running = true;

  let teamsAdded = 0;
  let leaguesAdded = 0;
  let changed = false;
  let teamLookups = 0;
  let leagueLookups = 0;

  try {
    const matches = _deps.db.matches || [];
    for (const m of matches) {
      if (!m || !m.home_team || !m.away_team) continue;

      // ── ÉQUIPES (home + away) ──
      for (const side of ['home', 'away']) {
        const logoKey = side + '_logo';
        if (m[logoKey]) continue;                       // déjà résolu en mémoire
        const name = m[side + '_team'];
        if (!name) continue;
        const norm = normalizeTeamName(name);
        if (!norm || _attemptedTeams.has(norm)) continue;

        // Cache DB d'abord (via lookupTeamLogo du server.js, qui a son propre cache mémoire)
        let logo = _deps.lookupTeamLogo ? _deps.lookupTeamLogo(name) : null;

        // Miss → cascade (si quota disponible)
        if (!logo && teamLookups < MAX_TEAM_LOOKUPS_PER_TICK) {
          _attemptedTeams.add(norm);                    // marque tenté (succès ou échec)
          teamLookups++;
          try {
            const row = await resolveTeamLogo(name, { verbose: !!process.env.LOGO_ENRICHER_VERBOSE });
            if (row && row.logo_url) {
              try {
                upsertTeamLogo(_deps.sqldb, {
                  bsd_id: row.bsd_id,
                  name: row.name || name,
                  short_name: row.short_name || '',
                  country: row.country || '',
                  name_norm: norm,
                  logo_url: row.logo_url,
                });
                logo = { url: row.logo_url };
                teamsAdded++;
              } catch (e) {
                if (process.env.LOGO_ENRICHER_VERBOSE) console.warn(`[LogoEnricher] upsert team ${name} échoué:`, e.message);
              }
            }
          } catch (e) {
            if (process.env.LOGO_ENRICHER_VERBOSE) console.warn(`[LogoEnricher] cascade team ${name} échouée:`, e.message);
          }
        } else if (!logo) {
          // Quota épuisé : on marque quand même attempted pour éviter retry immédiat ?
          // Non — on laisse non-marqué pour retry au prochain tick (si match toujours actif).
        }

        if (logo && logo.url) {
          m[logoKey] = logo.url;
          changed = true;
        }
      }

      // ── CHAMPIONNAT ──
      if (!m.league || m.league_logo_url) continue;     // déjà résolu (BSD image_path ou enricher précédent)
      const leagueKey = m.league + '|' + (m.country || '') + '|' + (m.sport || '');
      if (_attemptedLeagues.has(leagueKey)) continue;
      if (leagueLookups >= MAX_LEAGUE_LOOKUPS_PER_TICK) continue;
      _attemptedLeagues.add(leagueKey);
      leagueLookups++;

      // Cache DB d'abord
      let logo = lookupLeagueLogo(m.league, m.sport);

      // Miss → cascade
      if (!logo) {
        try {
          const row = await resolveLeagueLogo({
            name: m.league,
            country: m.country,
            sport: m.sport,
            bsdLeagueId: m._bsd_league_id || null,
            imagePath: null, // pas d'imagePath ici — déjà résolu ci-dessus si présent
            verbose: !!process.env.LOGO_ENRICHER_VERBOSE,
          });
          if (row && row.logo_url) {
            try {
              upsertLeagueLogo(_deps.sqldb, {
                bsd_league_id: row.bsd_league_id,
                name: row.name || m.league,
                name_norm: normalizeTeamName(m.league),
                country: row.country || m.country || '',
                sport: row.sport || m.sport || '',
                logo_url: row.logo_url,
                source: row.source || 'unknown',
              });
              _invalidateLeagueMemCache(m.league, m.sport);
              logo = { url: row.logo_url };
              leaguesAdded++;
            } catch (e) {
              if (process.env.LOGO_ENRICHER_VERBOSE) console.warn(`[LogoEnricher] upsert league ${m.league} échoué:`, e.message);
            }
          }
        } catch (e) {
          if (process.env.LOGO_ENRICHER_VERBOSE) console.warn(`[LogoEnricher] cascade league ${m.league} échouée:`, e.message);
        }
      }

      if (logo && logo.url) {
        m.league_logo_url = logo.url;
        changed = true;
      }
    }

    // Broadcast SSE si au moins un logo ajouté (et clients connectés)
    if (changed && _deps.sseClientsRef && _deps.sseClientsRef.size > 0 && _deps.broadcastSSE) {
      try {
        _deps.broadcastSSE('matches_update', {
          matches: _deps.matchesForBroadcast(),
          meta: _deps.buildMeta(),
        });
      } catch (e) {
        if (process.env.LOGO_ENRICHER_VERBOSE) console.warn('[LogoEnricher] broadcast SSE échoué:', e.message);
      }
    }

    if ((teamsAdded || leaguesAdded) && process.env.LOGO_ENRICHER_VERBOSE) {
      console.log(`[LogoEnricher] tick: +${teamsAdded} teams, +${leaguesAdded} leagues${changed ? ' (broadcast)' : ''}`);
    }
  } finally {
    _running = false;
  }

  return { teamsAdded, leaguesAdded, changed };
}

/**
 * Démarre le cron. Idempotent.
 */
function start(intervalMs = 60 * 1000) {
  if (!_inited) { console.warn('[LogoEnricher] start: init() requis'); return; }
  if (_timer) return;
  _timer = setInterval(() => {
    enrichOnce().catch(e => console.warn('[LogoEnricher] cron:', e.message));
  }, intervalMs);
  if (typeof _timer.unref === 'function') _timer.unref(); // ne bloque pas l'exit du process
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = {
  init,
  lookupLeagueLogo,
  enrichOnce,
  start,
  stop,
  // Exposé pour tests / audit
  _state: () => ({
    inited: _inited,
    running: _running,
    attemptedTeams: _attemptedTeams.size,
    attemptedLeagues: _attemptedLeagues.size,
    leagueCacheSize: _leagueMemCache.size,
  }),
};
