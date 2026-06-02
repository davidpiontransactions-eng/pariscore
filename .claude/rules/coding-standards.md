---
description: PariScore coding standards — enforced in every code change
---

# Coding Standards

## Critical Patterns
- `safeFixed(value, digits)` — ALWAYS wrap `.toFixed()`. Bare `.toFixed()` on null/undefined = crash. 51 call sites patched in `izsn` — never regress.
- Zero npm dependencies (server.js): only `better-sqlite3` is allowed. All else = Node.js native modules.
- SQLite: WAL mode only. Never disable WAL. Check `PRAGMA journal_mode=WAL` on DB init.

## Concurrency Guards
```
isFetchingOdds   ← mutex for fetchOdds()
isFetchingStats  ← mutex for fetchStats()
```
ALWAYS release in `finally` block. No exceptions. Missing release = deadlock.

## SSE / WebSocket
- SSE clients: clean up on `req.on('close', ...)` — never accumulate dead connections
- `broadcastSSE(data)` — wrap in try/catch, remove dead clients silently

## Data Access
- `db.*` mutations → inside mutex only
- `api_cache` → always check TTL before fetch, always update after fetch
- BSD fetch → use `bsdFetch()` wrapper (handles auth + rate limit), never raw fetch to BSD

## UI (pariscore.html — 30k+ lines)
- Design system tokens: `--cf-*` — never hardcode colors
- `best_edge` — always null-guard: `match.best_edge?.label` not `match.best_edge.label`
- Mobile cards (`renderMobileCards`): `matchId` can be null → guard all field access
