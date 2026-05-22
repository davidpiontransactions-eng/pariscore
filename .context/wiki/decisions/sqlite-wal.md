---
type: decision
slug: sqlite-wal
title: ADR — SQLite WAL mode + better-sqlite3
status: active
tags: [adr, architecture, database, persistence]
updated: 2026-05-22
sources: [".claude/CLAUDE.md", "server.js"]
xref: [[zero-dep-node]], [[vps-ovh-prod]]
bd: [b50]
---

# ADR — SQLite WAL mode + better-sqlite3

**Date:** v8.x migration depuis `database.json` + `history.json`. **Statut:** ACTIF.

## Décision

Persistance principale = **SQLite3 single-file** (`pariscore.db`) en mode **WAL** (Write-Ahead Logging) via binding `better-sqlite3`.

Tables principales: `users`, `user_bets`, `bankroll_transactions`, `api_cache`, `archive_matches`, `archive_tennis_matches`, `kv`, `stripe_events`, `oddsHistory`, `webhook_subscriptions`.

Race condition theoretical JSON read+write éliminée.

## Pourquoi WAL

- **Reads concurrents** pendant writes (vs DELETE mode bloqué)
- **Crash recovery** propre via journal séparé `.wal`
- **Performance** writes plus rapides (séquentielles vs random)
- **Multi-process safe** (cron + serveur + ETL tools concurrent OK)

## Pourquoi better-sqlite3 (vs node-sqlite3 async)

- **Sync API** compatible single-thread Node, pas de callback hell
- **Prepared statements** cached
- **Transactions atomic** `db.transaction(() => {...})()`
- **Performance** 4-5x faster vs node-sqlite3 (sync = pas de scheduler overhead)
- **Type safety** strict (errors on schema mismatch immediate)

## Patterns code

```js
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');  // tradeoff durability/perf

// Read
const row = db.prepare('SELECT ... WHERE id = ?').get(id);

// Write atomic batch
const stmt = db.prepare('INSERT OR REPLACE INTO ... VALUES (?, ?, ?)');
db.transaction(() => {
  for (const x of arr) stmt.run(x.a, x.b, x.c);
})();

// LIKE escape
db.prepare("SELECT ... WHERE key LIKE 'prefix\\_%' ESCAPE '\\'").all();
```

## Backup

- Render disk persistant (legacy plan) — abandonné
- VPS OVH `pariscore.db` snapshots manuels via SCP (TODO automatiser)
- `.wal` + `.shm` co-fichiers, NE PAS sync séparément (intégrité)

## Risques connus

- **bd `b50` P1** — `SQLITE_NOTADB` runtime corruption observé, investigation ops VPS pending
- WAL grow indéfini si checkpoint absent (pragma `wal_checkpoint(TRUNCATE)` périodique)
- Backup pendant write = lock potentiel (utiliser `.backup()` API better-sqlite3)

## Locations

- `server.js:3658+` — schema users + cols stripe
- `server.js:3855+` — `archive_tennis_matches`
- `server.js:3902+` — `api_cache` schema (key, data, source, created_at, expires_at)
- `pariscore.db` racine projet (gitignored)

## Related

- [[zero-dep-node]] — Exception dependency justifiée (seule lib npm)
- [[vps-ovh-prod]] — Backup strategy lieé déploiement

## Changelog

- 2026-05-22: ADR formalisé lors du bootstrap wiki
