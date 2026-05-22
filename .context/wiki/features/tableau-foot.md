---
type: feature
slug: tableau-foot
title: Tableau Foot (page Matchs centrale)
status: active
tags: [feature, ui, table, foot, primary, filters, premium-gated]
updated: 2026-05-22
sources: ["pariscore.html", "server.js (/api/v1/matches)", "CLAUDE.md"]
xref: [[poisson-bivarie]], [[edge-no-vig]], [[live-intensity]], [[flashscore]], [[bsd-bzzoiro]], [[modal-insights]]
---

# Tableau Foot (page Matchs centrale)

**TL;DR:** Page primaire `#page-matchs` PariScore. Tableau ~18 colonnes (heure / match / stats H/A / Poisson markets / xG / cotes / edge / IA). Filtres avancés client-side. Scroll horizontal 1400px min. Mode foot day vs live distinct.

## Structure verticale

1. `#ai-scout-panel` — encart [[ai-scout]] Combiné du Jour
2. `#status-bar` — état serveur + quota + bouton 🔄 Forcer l'actualisation
3. `#file-warning` — bannière démo (masquée prod)
4. **Filtres Jour:** Tous / Aujourd'hui / Demain / J+2 / J+3
5. **Filtres Ligue:** 8 boutons `data-sport` avec drapeaux country (cf. flags_config.json)
6. **Filtres avancés** `#filter-console`:
   - `#adv-input` Poisson min, range cotes, time-to-kickoff
   - `#fav-filter-chip` favoris uniquement
   - Filtre marché (1X2 / BTTS / O2.5 / CS)
   - `#bet-count` compteur live "X matchs — Y value bets"
7. **Tableau principal** scroll horizontal min 1400px
8. **Filtres période L5/L10/L25** chips `data-period`

## Colonnes (ordre)

| # | Colonne | Source |
|---|---|---|
| 1 | Match (noms + ligue + rang + LIVE/SIM/STREAM badges) | [[bsd-bzzoiro]] + [[flashscore]] livestream |
| 2 | Heure + date | event_date |
| 3 | PPG Dom/Ext | API-Football standings |
| 4 | Victoires % H/A | standings |
| 5 | Nuls % H/A | standings |
| 6 | Défaites % H/A | standings |
| 7 | **BTTS** (Poisson) | [[poisson-bivarie]] |
| 8 | **O 0.5** (Poisson) | [[poisson-bivarie]] |
| 9 | **O 1.5** (Poisson) | [[poisson-bivarie]] |
| 10 | **O 2.5** (Poisson) | [[poisson-bivarie]] |
| 11 | **O 3.5** (Poisson) | [[poisson-bivarie]] |
| 12 | Buts marqués % H/A | standings |
| 13 | Buts encaissés % H/A | standings |
| 14 | xG H/A | [[api-football]] advanced |
| 15 | Cote 1/N/2 | [[bsd-bzzoiro]] compare_odds |
| 16 | Edge % | [[edge-no-vig]] best_edge |
| 17 | Bouton ✦ Analyse IA | Gemini SSE → [[modal-insights]] |

## Code couleur cellules

| Couleur | Critère |
|---|---|
| 🟢 vert `rgba(0,165,81,0.18)` | >75% OR PPG≥2.0 |
| 🟠 orange `rgba(245,158,11,0.18)` | 50-75% OR PPG≥1.3 |
| 🔴 rouge `rgba(239,68,68,0.18)` | <50% |

Colonnes Poisson: en-têtes `var(--blue)` distinguer visuellement.

## Tri colonnes

- Clic `Dom`/`Ext` → tri décroissant (↓ vert)
- 2e clic → croissant (↑ vert)
- Default sans tri → par heure match

## Mode Live

`#tab-live` (pariscore.html:8653) — filtre matchs LIVE uniquement, thème rouge `.match-tab.live-tab.active`. Badge `.live-count-badge`. WS status dot `.ws-status-dot`.

Cellule LIVE:
- `🔴 live_score` + minute promue
- Barre [[live-intensity]] colorée 50px × 4px
- Container `data-live-container` position absolute top-right

## Wire data session 22/05 enrichments

- `m.has_live_stream` → pill `📡 STREAM` ambre next to TV badge (bd qm6a Plan F)
- `m.tv_channels[]` → pill `📺 X chaînes` bleu (bd 0hf4 Plan F)
- `m.flashscore_live_fallback` → fallback minute/score quand BSD/ESPN HS (bd qm6a Plan E)
- `m.live_intensity` → couleur barre + chiffre ⚡

## Drapeaux ligue

`sportFlagCodes` chargé depuis `flags_config.json` (pariscore.html:13750 + fetch :18091). Boutons filtre championnat avec drapeau country.

## Performance

- `/api/v1/matches` strip champs lourds (`_MATCH_LIST_STRIP_FIELDS` server.js:1309) ~210 KB économisés / 250 matchs
- DOM virtualization absente (load all rows) — OK <500 matchs/jour, scaling à surveiller

## Gates

`/api/v1/matches` requiert auth user logged-in (server.js:14504). Filtrage 5 ligues UE pour freemium, all leagues Pro.

## Code locations

- `pariscore.html` `#page-matchs` div container
- `pariscore.html:8588-8590` chips période L5/L10/L25
- `pariscore.html:21095+` `renderMatches()` row template
- `pariscore.html:21115` data-tv-badge slot
- `pariscore.html` `applyFilters()` filter pipeline
- `server.js` `matchesForBroadcast()` (server.js:1332)
- `server.js` `/api/v1/matches` GET handler

## Related

- [[poisson-bivarie]] — Source markets BTTS/Over/CS columns
- [[edge-no-vig]] — Source Edge % column
- [[live-intensity]] — Live mode badges/bars
- [[flashscore]] — TV stream pill data
- [[bsd-bzzoiro]] — Source live + odds compare
- [[modal-insights]] — Modal opened from ✦ button

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
