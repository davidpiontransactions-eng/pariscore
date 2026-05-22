# PariScore Wiki — Append-Only Log

> Per [[WIKI-SCHEMA]] section 9. Newest entries at TOP.

---

## 2026-05-22 16:15 — INGEST — wave 2 bootstrap

Pages created (17):
- Decisions (7): [[zero-dep-node]], [[sqlite-wal]], [[bsd-addon-5usd]], [[vps-ovh-prod]], [[sackmann-purge]], [[api-football-pro-upgrade]], [[caveman-mode]]
- Concepts (5): [[power-score]], [[shin-hurley-devig]], [[kelly-cap]], [[live-intensity]], [[ai-scout]]
- Features (3): [[live-dashboard-cockpit]], [[tableau-foot]], [[mes-paris]], [[mobile-pwa]]
- Entities (4): [[stripe]], [[gemini]], [[wikidata]], [[matchstat]]

Sources synthesized:
- CLAUDE.md ACTIONS OPS section, section 14 limites connues, innovation backlog
- bd tickets details: c5i, s77m, qe5, e7l, c0qo, p2if, 5iw, 6du6, 9je, 8uoc, bjv, ffh
- bsd_config.json + bsd_fr_leagues.json mapping audit (37/52 ligues mappées, 71% coverage)
- BSD MCP probes: list_leagues live = 52 ligues, drift vs snapshot (manque BSD 27 World Cup 2026 + 55 Veikkausliiga)

Operations:
- Refresh `bsd_fr_leagues.json` snapshot live (52 entries, IDs 27+55 captured)
- CLAUDE.md ACTIONS OPS table étendu: ajout actions 11 (snapshot refresh), 12 (mapper BSD 27 HIGH), 13 (mapper coupes domestiques HIGH), 14 (DG décision 11 ligues secondary)

Cross-refs systematic [[slug]] entre entités/concepts/features/decisions selon WIKI-SCHEMA section 7.

LINT pending wave 3: vérifier orphan pages + broken xref ([[odds-api]] [[momentum]] [[sse]] [[tennis-abstract]] etc référencés mais non créés encore).

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
