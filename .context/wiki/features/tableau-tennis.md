---
type: feature
slug: tableau-tennis
title: Tableau Tennis (page Value Bets ATP/WTA)
status: active
tags: [feature, ui, table, tennis, atp, wta, filters, strategies]
updated: 2026-05-22
sources: ["pariscore.html (#page-tennis)", "server.js"]
xref: [[bsd-bzzoiro]], [[espn]], [[matchstat]], [[elo-dynamique]], [[modal-insights]], [[tableau-foot]]
---

# Tableau Tennis (page Value Bets ATP/WTA)

**TL;DR:** Page `#page-tennis` PariScore — value bets ATP+WTA filtrables par tour/surface/format/tier/stratégie. Distinct du tableau foot. Modal détail dédié `tennis-detail-modal` (point-by-point + serve stats BSD).

## Filtres `#tennis-vb-filters`

| Type | Valeurs |
|---|---|
| **Tour** | Tous / ATP / WTA |
| **Surface** | Toutes / 🏟️ Hard / 🟧 Clay / 🟩 Grass |
| **Format** ✅ bd 6jro Plan I | Tous / 👤 Singles / 👥 Doubles (heuristique slash-pair + tournament regex) |
| **Catégorie** | Toutes / GC (Grand Slam) / 1000 / 500 / 250 / 125 / ITF |
| **Stratégie** | Toutes / 🎯 Spécialiste Surface (SURFACE_SPEC) / ⚡ Serveur Lourd (ACES_SHOCK) / 📈 Value Forme (FORM_VALUE) / 🔥 Bascule Momentum (DR_SPIKE) / ⚠️ Favori en Danger (FAVORITE_DANGER) / 🔁 Remontée Algorithmique (COMEBACK) |
| **Recherche** | Texte libre (joueur/tournoi/round) |
| **Compétition** | Multi-select tournois actifs |

Toggles:
- `tennis-vb-elo-only` — uniquement matchs avec prediction Elo
- `tennis-vb-positive-ev` — uniquement EV > 0
- `tennis-vb-hide-finished` — masquer terminés
- `tennis-vb-live-only` — uniquement LIVE

## Colonnes tableau

- Match (joueurs + drapeau pays)
- Round + tournoi
- Tour (ATP/WTA badge)
- Surface badge
- Cote + odds tracker
- EV%
- Forme L5/L10 chips
- Rank ATP/WTA
- Elo surface
- Sets gagnés/perdus
- Actions (modal détail)

## Modal détail tennis-detail-modal

`openTennisDetail(matchId)`:
1. Fetch `/api/v1/tennis/match/:id` ([[bsd-bzzoiro]] BSD primary)
2. Fetch `/api/v1/tennis/predictions/:id` (ML predictions)
3. Render `renderTennisDashboard(matchData, predData)`
4. Lazy fetch `/api/v1/tennis/matchstat/enrich/:matchId` ([[matchstat]])
5. **bd 6jro Plan G** — Lazy fetch `/api/v1/tennis/sofa-profile?p1=&p2=` → render Section "🏆 HISTORIQUE GRAND CHELEM · SOFASCORE" (rankings + 4 GS × 5 années)

Auto-refresh 30s pour matchs LIVE.

## Status codes UI

- 503 BSD désactivé → empty state + MatchStat fallback
- 402 Sports Addon required → CTA upgrade Bzzoiro
- 404 BSD non résolvable → degraded detail rendering depuis cache mémoire
- 200 OK → full dashboard + MatchStat enrich + Sofa profile

## Sources data primary/secondary

| Source | Use |
|---|---|
| [[bsd-bzzoiro]] | Primary: match detail + predictions ML + serve stats |
| [[espn]] | Fallback scoreboard ATP+WTA (gratuit) |
| [[matchstat]] | Enrichissement H2H + perf breakdown |
| [[sofascore]] | Player profile + Grand Slam history (bd 6jro Plan G) |
| Sackmann/TML-DB | Elo surface historique ([[elo-dynamique]]) |

## Tennis-specific concepts

- **DR (Dynamic Rating)** — momentum tennis live
- **Break Point Pressure Index** — bd `6xw`
- **Aces shock / King of Aces** — favori aces P≥60%
- **Form L5/L10 chaude** — max pts ≥ 7 cumulés

## Gates

`/api/v1/tennis/*` requiert `a.tennisPro` (server.js:14509). 403 sinon.

## Code locations

- `pariscore.html:9665` — `#page-tennis` container
- `pariscore.html:9690-9745` — `#tennis-vb-filters` rendering
- `pariscore.html:14299` — `_tennisVbFilters` state init
- `pariscore.html:14376` — `applyTennisFilter(btnEl)`
- `pariscore.html:14388` — `_tvbTier(name)` heuristique tier
- `pariscore.html:15691` — `renderTennisValueBets(rawMatches)`
- `pariscore.html:16898` — `openTennisDetail(matchId)`
- `pariscore.html:17023` — `_fetchAndRenderTennisDetail(matchId)`

## Related

- [[bsd-bzzoiro]] — Source primary tennis
- [[espn]] — Fallback scoreboard
- [[matchstat]] — Enrichissement H2H
- [[elo-dynamique]] — Source surface rank
- [[modal-insights]] — Pattern modal alternative (foot equivalent)
- [[tableau-foot]] — Page jumelle foot

## Changelog

- 2026-05-22: création initiale wave 3
