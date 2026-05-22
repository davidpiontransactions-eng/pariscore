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
- [[stripe]] — Payment subscriptions Pro, code livré v12.43, pending DG checklist 9 sections
- [[gemini]] — Google AI 1.5 Flash, pay-as-you-go, AI Scout + Power Score + Pro Scout
- [[wikidata]] — Public domain CC0, tennis winners 56 entries wire Phase 2 (bd 6du6)
- [[matchstat]] — Tennis enrichment H2H + perf breakdown, 9 endpoints proxiés
- [[odds-api]] — Legacy cotes 20+ books, Free 500/mois, migration vers BSD en cours (bd zia)
- [[tennis-abstract]] — Site Jeff Sackmann scraping Elo + reports (distinct du dataset GitHub)
- [[transfermarkt]] — Sidecar self-host felipeall/transfermarkt-api, market values + transfers

## 🧮 Concepts (math / algorithms / patterns)

- [[poisson-bivarie]] — Modèle probabiliste markets BTTS/Over/CS/1X2 depuis xG home/away
- [[edge-no-vig]] — Devig Shin-Hurley + comparaison best-cote vs prob fair → opportunity score
- [[elo-dynamique]] — Rating équipes/joueurs avec ajustement post-match (foot + tennis surface)
- [[power-score]] — IA Gemini composite /100 (gauge modal Insights, SSE streaming)
- [[shin-hurley-devig]] — Devig probability extraction Shin (1991) + Hurley extension
- [[kelly-cap]] — Bankroll sizing Kelly Criterion + cap 25% (fractional Kelly)
- [[live-intensity]] — Score composite 0-100 dynamique match live (alertes + UI)
- [[ai-scout]] — Combiné du Jour Gemini 3 picks structurés (cache 6h)
- [[value-bet]] — Définition + critères BET stricts (EV>5% + IC>0 + PowerScore≥60)
- [[sse]] — Server-Sent Events pattern push live (cohérent zero-dep)

## 🎯 Features (product)

- [[modal-insights]] — Modal Hub Stats Elite multi-tabs (Resume/Stats/Graphique/Classement/Corners/PowerScore/H2H/Compos/Incidents/Shotmap/Scouting)
- [[live-dashboard-cockpit]] — Modal live in-play, Phase 1 livré v12.62, Phase 2/3 spec bd qe5
- [[tableau-foot]] — Page Matchs centrale, 18 colonnes, filtres avancés, mode live distinct
- [[mes-paris]] — Bet tracking + bankroll réelle + Kelly + auto-suggest règlement (v9.8)
- [[mobile-pwa]] — Version mobile parieur nomade, PWA install + push (Phase 5/7 livré)
- [[tableau-tennis]] — Page Value Bets ATP/WTA filtres tour/surface/format/strategie
- [[alertes-telegram]] — Push notifications value bets + live momentum (v9.9.5)
- [[comparateur]] — Modal cotes multi-bookmakers + affiliate CTA tracking

## 📋 Decisions (ADRs)

- [[zero-dep-node]] — Zero dependency Node.js (exception unique: `better-sqlite3`)
- [[sqlite-wal]] — SQLite WAL mode + better-sqlite3 binding (race-condition free)
- [[bsd-addon-5usd]] — Achat BSD Sports Addon $5/mo Bzzoiro (renew 2026-06-16)
- [[vps-ovh-prod]] — VPS OVH `/home/ubuntu/pariscore` PM2 (Render abandoned)
- [[sackmann-purge]] — Purge Sackmann tennis_atp CC BY-NC-SA → TML-DB MIT pending DG
- [[api-football-pro-upgrade]] — Upgrade Free → PRO $19/mo 7500/jour
- [[caveman-mode]] — Communication LLM agent caveman mode (~50% token reduction)

## 📜 Infra (méta)

- [[WIKI-SCHEMA]] — Config workflow + templates + naming + ingest protocol
- [[log]] — Append-only timeline (ingest / lint / changes)

---

## 📊 Stats

- **Pages:** 38 (3 infra + 13 entities + 10 concepts + 8 features + 7 decisions, wave 1+2+3)
- **Bootstrap date:** 2026-05-22 (wave 1 + wave 2 + wave 3)
- **Raw sources catalogued:** `.context/` 165 .md + `dataset_*.json` 3 + `CLAUDE.md` + `server.js` + `pariscore.html` + 12 commits session 22/05 + bd 50 tickets
- **Next wave 4 priority:** vendors (elofootball, openfootball, tennis-mylife, oddspapi, xvalue, rapidapi, aiscore) + concepts (momentum, bootstrap-uqd, smart-polling, dropping-odds, devig-methods) + features (ai-al-revue-presse, pro-scout-5-piliers)

---

## 🔍 How to query this wiki

1. `Grep` `.context/wiki/` first, NOT `.context/audits/`.
2. Follow `[[xref]]` chains.
3. If page missing → check `.context/audits/` raw sources for ingestable material → propose new wiki page.
4. Wiki updates compound. Stale = lint flag.
