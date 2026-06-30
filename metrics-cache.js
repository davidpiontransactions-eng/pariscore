const path = require('path');
const fs = require('fs');

const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'metrics-cache.db');

const MATCH_CONTEXT_KEYS = [
  'serve_index', 'receive_index', 'powerscore', 'serve_dominance',
  'market_confidence', 'rank_momentum', 'fatigue', 'log_diff',
  'totals_convergence', 'elo', 'glicko2', 'l5_pts', 'l10_pts',
  'ps_rank', 'ps_total'
];

function makeKey(playerName, tour, surface, metricName) {
  return `${playerName}|${tour}|${surface}|${metricName}`;
}

class MetricsCache {
  constructor(dbPath) {
    this.dbPath = dbPath || DEFAULT_DB_PATH;
    this.memory = new Map();
    this.db = null;

    try {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metrics_cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    } catch (err) {
      console.warn('[metrics-cache] SQLite unavailable, using memory fallback:', err.message);
      this.db = null;
    }
  }

  _run(query, params) {
    if (this.db) {
      return this.db.prepare(query).run(params);
    }
    return null;
  }

  _get(query, params) {
    if (this.db) {
      return this.db.prepare(query).get(params);
    }
    return null;
  }

  _all(query, params) {
    if (this.db) {
      return this.db.prepare(query).all(params);
    }
    return [];
  }

  _transaction(fn) {
    if (this.db) {
      return this.db.transaction(fn);
    }
    return fn;
  }

  makeKey(playerName, tour, surface, metricName) {
    return makeKey(playerName, tour, surface, metricName);
  }

  get(metricName, playerName, tour, surface) {
    const key = makeKey(playerName, tour, surface, metricName);

    if (this.db) {
      try {
        const row = this._get(
          'SELECT value FROM metrics_cache WHERE key = ?',
          [key]
        );
        if (row) {
          return JSON.parse(row.value);
        }
      } catch (err) {
        // fallback to memory
      }
    }

    if (this.memory.has(key)) {
      return JSON.parse(this.memory.get(key).value);
    }

    return null;
  }

  set(metricName, playerName, tour, surface, value) {
    const key = makeKey(playerName, tour, surface, metricName);
    const now = Date.now();
    const serialized = JSON.stringify(_sanitizeForJSON(value));

    if (this.db) {
      try {
        this._run(
          'INSERT OR REPLACE INTO metrics_cache (key, value, updated_at) VALUES (?, ?, ?)',
          [key, serialized, now]
        );
      } catch (err) {
        // fallback to memory
      }
    }

    this.memory.set(key, { value: serialized, updated_at: now });
  }

  mset(playerName, tour, surface, metricsObject) {
    const entries = Object.entries(metricsObject);
    if (entries.length === 0) return;

    const now = Date.now();

    if (this.db) {
      try {
        const insert = this.db.prepare(
          'INSERT OR REPLACE INTO metrics_cache (key, value, updated_at) VALUES (?, ?, ?)'
        );
        const batch = this.db.transaction((items) => {
          for (const [metricName, val] of items) {
            const key = makeKey(playerName, tour, surface, metricName);
            insert.run(key, JSON.stringify(_sanitizeForJSON(val)), now);
          }
        });
        batch(entries);
      } catch (err) {
        // fallback to memory below
      }
    }

    for (const [metricName, val] of entries) {
      const key = makeKey(playerName, tour, surface, metricName);
      this.memory.set(key, { value: JSON.stringify(_sanitizeForJSON(val)), updated_at: now });
    }
  }

  getMatchContext(playerName, tour, surface) {
    const prefix = `${playerName}|${tour}|${surface}|`;
    const context = {};
    let found = false;

    if (this.db) {
      try {
        const rows = this._all(
          'SELECT key, value FROM metrics_cache WHERE key LIKE ?',
          [prefix + '%']
        );
        for (const row of rows) {
          const metricName = row.key.slice(prefix.length);
          if (MATCH_CONTEXT_KEYS.includes(metricName)) {
            context[metricName] = JSON.parse(row.value);
            found = true;
          }
        }
      } catch (err) {
        // fallback to memory
      }
    }

    if (!found) {
      for (const [key, entry] of this.memory) {
        if (key.startsWith(prefix)) {
          const metricName = key.slice(prefix.length);
          if (MATCH_CONTEXT_KEYS.includes(metricName)) {
            context[metricName] = JSON.parse(entry.value);
            found = true;
          }
        }
      }
    }

    if (!found) return null;

    const result = {};
    for (const k of MATCH_CONTEXT_KEYS) {
      result[k] = context[k] !== undefined ? context[k] : null;
    }

    if (found && this.db) {
      try {
        const row = this._get(
          'SELECT updated_at FROM metrics_cache WHERE key = ?',
          [prefix + (Object.keys(context)[0] || 'serve_index')]
        );
        result.cached_at = row ? row.updated_at : null;
      } catch (err) {
        result.cached_at = null;
      }
    } else {
      const firstKey = prefix + (Object.keys(context)[0] || 'serve_index');
      result.cached_at = this.memory.has(firstKey) ? this.memory.get(firstKey).updated_at : null;
    }

    return result;
  }

  invalidatePlayer(playerName) {
    const prefix = `${playerName}|`;

    if (this.db) {
      try {
        this._run('DELETE FROM metrics_cache WHERE key LIKE ?', [prefix + '%']);
      } catch (err) {
        // fallback
      }
    }

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
  }


  prune(maxAgeMs = 43200000) {
    var now = Date.now();
    if (this.db) {
      try {
        this._run('DELETE FROM metrics_cache WHERE updated_at < ?', [now - maxAgeMs]);
      } catch (err) { /* best-effort */ }
    }
    for (var key of this.memory.keys()) {
      var entry = this.memory.get(key);
      if (entry && now - entry.updated_at > maxAgeMs) {
        this.memory.delete(key);
      }
    }
  }

  invalidateAll() {
    if (this.db) {
      try {
        this._run('DELETE FROM metrics_cache', []);
      } catch (err) {
        // fallback
      }
    }
    this.memory.clear();
  }

  getStaleness(metricName, playerName, tour, surface) {
    const key = makeKey(playerName, tour, surface, metricName);

    if (this.db) {
      try {
        const row = this._get(
          'SELECT updated_at FROM metrics_cache WHERE key = ?',
          [key]
        );
        if (row) {
          return Date.now() - row.updated_at;
        }
      } catch (err) {
        // fallback to memory
      }
    }

    if (this.memory.has(key)) {
      return Date.now() - this.memory.get(key).updated_at;
    }

    return Infinity;
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
      } catch (err) {
        // ignore
      }
    }
  }
}

module.exports = MetricsCache;
