# PariScore Wiki — Append-Only Log

> Per [[WIKI-SCHEMA]] section 9. Newest entries at TOP.

---

## 2026-05-22 14:55 — BOOTSTRAP — initial wiki seed

Pages created (13):
- Infra: [[WIKI-SCHEMA]], [[index]], [[log]]
- Entities: [[bsd-bzzoiro]], [[sofascore]], [[flashscore]], [[espn]], [[api-football]], [[apify]]
- Concepts: [[poisson-bivarie]], [[edge-no-vig]], [[elo-dynamique]]
- Features: [[modal-insights]]

Sources synthesized:
- `CLAUDE.md` (project pilot doc v12.65 + section 15 cahier des charges)
- `.claude/CLAUDE.md` (cahier des charges v3.1)
- `server.js` HEAD (Vanilla Node 30k+ lines, zero-dep sauf better-sqlite3)
- `pariscore.html` HEAD (SPA 30k+ lines)
- `bd ready` + `bd list --status=in_progress` (50 tickets, 11 in_progress + 47 ready)
- `dataset_flashscore-*.json` + `dataset_sofascore-*.json` (3 Apify dumps racine projet)
- BSD MCP probes (`mcp__bsd-sports__list_*`, 28 endpoints) + REST direct probes
- Session 22/05 last 9 commits (ca15c1f → b59ce37) — qm6a Plans A/D/E/F + 6jro Plans G/H/I + ueg0 + j6pz + 82th

Bootstrap follows [[WIKI-SCHEMA]] Karpathy pattern. Next ingest waves:
1. Vendors restant: [[stripe]] [[gemini]] [[wikidata]] [[matchstat]] [[odds-api]] [[tennis-abstract]] [[elofootball]] [[openfootball]] [[transfermarkt]] [[apify]] [[oddspapi]] [[xvalue]]
2. Concepts: [[edge-no-vig]] (étendre Shin-Hurley details), [[power-score]], [[live-intensity]], [[momentum]], [[kelly-cap]], [[bootstrap-uqd]], [[shin-hurley-devig]], [[ai-scout]]
3. Features: [[live-dashboard-cockpit]], [[tableau-foot]], [[tableau-tennis]], [[mes-paris]], [[mobile-pwa]], [[alertes-telegram]], [[ai-al-revue-presse]]
4. Decisions ADRs: `zero-dep-node`, `sqlite-wal`, `bsd-addon-5usd`, `vps-ovh-prod`, `sackmann-purge`, `api-football-pro-upgrade`, `caveman-mode`

Operator: Claude Opus 4.7 (1M context). Curator: David (DG).
