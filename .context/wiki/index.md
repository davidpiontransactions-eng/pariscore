# PariScore Wiki — Index

> Catalog of all wiki pages. Maintained per [[WIKI-SCHEMA]] section 8.
> **Source of truth tâches:** `bd ready`. **Source of truth code:** repo HEAD. **Wiki:** synthesized durable knowledge.

---

## 🏢 Entities (vendors / APIs / datasets / tools)

- [[bsd-bzzoiro]] — Bzzoiro Sports addon $5/mo, 28+ MCP endpoints, WS push, core data source
- [[sofascore]] — Apify scraper one-shot datasets (player profile + match detail) + considered live source (NO-GO ffh)
- [[flashscore]] — Apify scraper one-shot datasets (team stats + live matches), logos backup + livestream flag
- [[espn]] — Public scoreboard API (football+tennis), free, scoreboard live fallback
- [[api-football]] — Plan PRO $19/mo 7500 req/day, standings + xG + Cartons + Smart Polling live
- [[apify]] — Platform Sofascore/Flashscore scrapers (one-shot vs continuous decision)

## 🧮 Concepts (math / algorithms / patterns)

- [[poisson-bivarie]] — Modèle probabiliste markets BTTS/Over/CS/1X2 depuis xG home/away
- [[edge-no-vig]] — Devig Shin-Hurley + comparaison best-cote vs prob fair → opportunity score
- [[elo-dynamique]] — Rating équipes/joueurs avec ajustement post-match (foot + tennis surface)

## 🎯 Features (product)

- [[modal-insights]] — Modal Hub Stats Elite multi-tabs (Resume/Stats/Graphique/Classement/Corners/PowerScore/H2H/Compos/Incidents/Shotmap/Scouting)

## 📋 Decisions (ADRs)

*(à venir — bootstrap pending)*

## 📜 Infra (méta)

- [[WIKI-SCHEMA]] — Config workflow + templates + naming + ingest protocol
- [[log]] — Append-only timeline (ingest / lint / changes)

---

## 📊 Stats

- **Pages:** 10 (3 infra + 6 entities + 3 concepts + 1 feature + 0 decision)
- **Bootstrap date:** 2026-05-22
- **Raw sources catalogued:** `.context/` 165 .md + `dataset_*.json` 3 + `CLAUDE.md` + `server.js` + `pariscore.html`
- **Next priority:** create [[stripe]] [[gemini]] [[wikidata]] [[matchstat]] entities + [[live-dashboard-cockpit]] [[ai-scout]] [[power-score]] features + ADRs decisions/

---

## 🔍 How to query this wiki

1. `Grep` `.context/wiki/` first, NOT `.context/audits/`.
2. Follow `[[xref]]` chains.
3. If page missing → check `.context/audits/` raw sources for ingestable material → propose new wiki page.
4. Wiki updates compound. Stale = lint flag.
