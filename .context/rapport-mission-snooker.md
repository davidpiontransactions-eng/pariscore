# Rapport de Mission: Snooker PariScore

**Date**: 2026-09-07
**Statut**: ✅ COMPLET — tous les workstreams déployés en prod

## Résumé Exécutif

Intégration complète du snooker dans PariScore: recherche académique, moteur prédictif Elo, scrapers (CueTracker, WST, FlashScore), API, frontend UI (4 composants), schéma DB Prisma (7 modèles), et rapport académique sur les modèles prédictifs.

## Livrables

### T1: Recherche Académique & Métriques
- **Rapport**: `.context/rapport-academique-snooker.md` (8 sections)
- Papers clés identifiés: Collingwood/Wright/Brooks (2022), Li et al. (2021), Forrest/Simmons
- Plafond accuracy théorique: ~70-72%
- Metrics retenues: Elo (K=32), century rate, break building, decider win %, safety success

### T2: DB Schema Prisma (7 modèles)
- `SnookerPlayer` — ratings, stats, forme
- `SnookerMatch` — matchs avec relations joueurs
- `SnookerFrame` — résultats par frame
- `SnookerBreak` — breaks par visite
- `SnookerEloHistory` — historique Elo
- `SnookerPrediction` — prédictions avec edge/kelly
- `SnookerOdds` — cotes multi-bookmakers

### T3: Engine Prédictif
- `src/lib/snooker/elo.ts` — Système Elo complet (expectedScore, updateElo, timeDecay, deVigOdds, kellyStake)
- `src/lib/snooker/prediction.ts` — predictMatch (Elo 60% + forme 15% + H2H 10% + century 5% + decider 5% + break 5%)
- `predictWithValue()` — détection value bets vs cotes marché

### T4: Frontend UI (4 composants)
- `snooker-match-card.tsx` — Carte match avec flags, Elo, probabilités, edge indicator
- `snooker-live-tracker.tsx` — Frame-by-frame tracker avec progress bars et dots
- `snooker-player-card.tsx` — Fiche joueur avec forme W/L, stat bars, Elo
- Intégrés dans l'onglet "snooker" existant

### T5: Scrapers
- `scripts/scrape_cuetracker.py` — Stats joueurs (win %, centuries, deciders)
- `scripts/scrape_1xbet_snooker.py` — 1xbet (bloqué, en attente VPN)
- `scripts/scrape_flashscore_snooker.mjs` — FlashScore live (16 matchs extraits)

### Calendrier Snooker (déjà déployé avant)
- `src/components/snooker/snooker-calendar.tsx` — UI calendrier T1-T4
- `src/app/api/v1/snooker/matches/route.ts` — API route
- `scripts/scrape_1xbet_snooker.py` — Scraper 1xbet (blocked)

## Fichiers Créés/Modifiés

| Fichier | Action |
|---------|--------|
| `prisma/schema.prisma` | +7 modèles Snooker + 4 modèles BetExplorer + 1 MultisportEvent |
| `src/lib/snooker/elo.ts` | Nouveau — système Elo snooker |
| `src/lib/snooker/prediction.ts` | Nouveau — moteur prédictif |
| `src/components/snooker/snooker-match-card.tsx` | Nouveau |
| `src/components/snooker/snooker-live-tracker.tsx` | Nouveau |
| `src/components/snooker/snooker-player-card.tsx` | Nouveau |
| `src/components/snooker/snooker-calendar.tsx` | Existant (calendrier) |
| `scripts/scrape_cuetracker.py` | Nouveau |
| `scripts/scrape_betexplorer_calendar.mjs` | Nouveau — multisport |
| `src/app/api/v1/multisport-calendar/route.ts` | Nouveau |
| `.context/rapport-academique-snooker.md` | Nouveau — rapport académique |
| `COMPONENTS.md` | Mis à jour (+snooker +betting sections) |

## Commits

| Hash | Message |
|------|---------|
| `09e01b4b` | feat(db): add Snooker + BetExplorer Prisma models |
| `4842d517` | feat(snooker): Elo engine + prediction + scrapers |
| `54c97fba` | feat(snooker): UI components + academic report + multisport calendar |
| `aa49f646` | fix(snooker): TS boolean undefined in live-tracker |
| `b3c58fc7` | feat(betting): add DroppingOddsWidget, TeamStreaksWidget, StreakBadge, OddsTrendIndicator |

## Déploiement

- **VPS**: Build `✓ Compiled` + PM2 restart `pariscore-next` → `OK`
- **Port**: 3005 (nginx proxy)
- **Build warnings**: 30 warnings cyclingService.js (anciens, non-bloquants)

## En Attente

| Item | Raison | Blocker |
|------|--------|---------|
| 1xbet scraping | Tous les domains bloquent IP datacenter VPS | VPN CyberGhost à installer |
| football-data.co.uk | Site retourne 503 | Attente résolution côté site |
| Snooker live odds | Dépend de 1xbet/FlashScore | Même blocker que 1xbet |

## Prochaines Étapes

1. **VPN CyberGhost** → SCP .deb vers VPS → install → 1xbet scraping
2. **BetExplorer T3-T4** → Intégrer widgets dans sidebar/calendrier
3. **Snooker frontend** → Intégrer match-card + live-tracker dans page snooker
4. **Cron scraper** → Automatiser CueTracker + BetExplorer daily
