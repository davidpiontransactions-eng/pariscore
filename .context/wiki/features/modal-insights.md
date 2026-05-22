---
type: feature
slug: modal-insights
title: Modal Insights (Hub Stats Elite)
status: active
tags: [feature, modal, multi-tab, foot, insights, elite, premium]
updated: 2026-05-22
sources: ["pariscore.html", "server.js"]
xref: [[bsd-bzzoiro]], [[sofascore]], [[poisson-bivarie]], [[edge-no-vig]], [[power-score]], [[live-dashboard-cockpit]]
bd: []
---

# Modal Insights (Hub Stats Elite)

**TL;DR:** Modal central PariScore foot — déclenché par clic ligne tableau matchs. 9+ onglets (Résumé / Stats / Graphique / Classement / Corners / PowerScore / H2H / Compos / Incidents / Shotmap / Scouting). Consomme `/api/v1/insights/:matchId` enrichi cross-sources.

## Tabs

| Tab id | Builder | Source data | Status |
|---|---|---|---|
| `ins-tab-resume` | `buildResumeTab(d)` | Forme L5 + xG + sections enrichies (editorial / venue/referee / social buzz) | ✅ |
| `ins-tab-stats` | `buildStatsTab(d)` | Stats avancées home/away (saison + splits L5/L10) | ✅ |
| `ins-tab-graphique` | `buildGraphiqueTab(d)` | Charts radar attaque/défense | ✅ |
| `ins-tab-classement` | `buildClassementTab(d)` | Standings ligue trié | ✅ |
| `ins-tab-corners` | `buildCornersTab(matchId)` | Corners H2H + asymétrie | ✅ |
| `ins-tab-powerscore` | `buildPowerScoreTab(matchId)` SSE | AI Gemini streaming powerscore /100 | ✅ |
| `ins-tab-h2h` | `buildH2HTab(d)` | Head-to-head 10 derniers + breakdown | ✅ |
| `ins-tab-compos` | (lazy) | BSD lineups `/api/v1/bsd/lineups/:id` | ✅ |
| `ins-tab-incidents` | (lazy auto-refresh 30s) | BSD incidents `/api/v1/bsd/incidents/:id` | ✅ |
| `ins-tab-shotmap` | `buildBsdShotmap(matchId)` | BSD shotmap+stats+momentum (fix [[bsd-bzzoiro]] j6pz) | ✅ refactored |
| `ins-tab-scouting` | `buildScoutingTab(matchId)` SSE | Gemini Pro Scout 5 Piliers | ✅ |

## Enrichissements onglet Resume (session 22/05)

Wave bootstrap wiki = sections livrées dans `buildResumeTab(d)` tête onglet:

1. **📰 AVANT-MATCH · SOFASCORE** — article éditorial Sofascore (bd `6jro` Plan H, commit `f8cd143`)
2. **🏟️ STADE & ARBITRE · SOFASCORE** — venue (nom+capa+ville+flag) + arbitre (YC/match + RC/match) (bd `qm6a` Plan D, commit `58119d7`)
3. **#ins-social-buzz-slot** — placeholder lazy fetch `/api/v1/social/match/:id` → section "📢 BUZZ RÉSEAUX SOCIAUX" (sentiment + top 5 items) (bd `ueg0`, commit `6e9a882`)

Plus pour tennis modal (`tennis-detail-modal` distinct):
- **🏆 HISTORIQUE GRAND CHELEM · SOFASCORE** — rankings + 4 tournois × 5 années récentes (bd `6jro` Plan G, commit `dc7b3ae`)

## Endpoint backend

`GET /api/v1/insights/:matchId` retourne payload riche:
```js
{
  match, homeStats, awayStats, homeAdv, awayAdv,
  standings, topScorers, homeKeyPlayers, awayKeyPlayers,
  homeBSDSquad, awayBSDSquad, homeBSDRatings, awayBSDRatings,
  bsdCoverage: { available, home, away, pct },
  homeCorners, awayCorners, h2h,
  homeLastHome, awayLastAway,
  homeAllFixtures, awayAllFixtures,  // last 15 form spine
  homeTopPerformers, awayTopPerformers, top_players,
  unified_stats,  // v49.0 Hermes
  sofascore_editorial,           // bd 6jro Plan H
  sofascore_venue_referee,       // bd qm6a Plan D
  flashscore_live_stats,         // bd qm6a Plan E
  bsd_referee_id, bsd_venue_id, bsd_league_id  // bd 82th Phase 4
}
```

## Code locations

- `pariscore.html:13493` — `#insights-panel-inner` DOM
- `pariscore.html:24119` — `async function openInsights(matchId)`
- `pariscore.html:22398` — `function buildResumeTab(d)` (avec enrich sections session 22/05)
- `pariscore.html:22281` — `async function buildBsdShotmap(matchId)` (refactored bd j6pz)
- `server.js:26872-27180` — handler `/api/v1/insights/:id`

## Gates & auth

`/api/v1/insights/` dans FOOT_PRO set → requiert plan Pro Foot / Duo (server.js:14514). 403 sinon.

## Tabs futurs (innovation)

- **AI Live Bet** (Phase 2/3 [[live-dashboard-cockpit]] bd `qe5`)
- **Bookmaker Spread** (visualisation cotes 14 books bd j6pz best_odds)
- **Polymarket Sharp** (bd j6pz polymarket integration)

## Related

- [[bsd-bzzoiro]] — Source primary majorité tabs (lineups, shotmap, incidents, predictions, social, broadcasts)
- [[sofascore]] — Source 3 sections enrichies onglet Resume + tennis profile
- [[flashscore]] — Source live_stats fallback + livestream flag
- [[poisson-bivarie]] — Output dans Résumé/Stats
- [[edge-no-vig]] — Best edge metadata header
- [[power-score]] — Onglet dédié Gemini SSE
- [[live-dashboard-cockpit]] — Feature parallèle (modal Live in-play)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse pariscore.html + 4 sessions enrichments session 22/05
