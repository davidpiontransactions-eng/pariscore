# Session: Tennis Tournament Draw + Singles Forecast (2026-08-30)

**Scope**: Tableaux principaux ATP/WTA avec Singles Forecast (TennisAbstract style) — brackets interactifs + probabilités de victoire par round.

## Objectifs
1. Scraper les draws TennisAbstract pour les tournois en cours
2. API endpoint pour servir les draws + forecasts
3. Composants UI : DrawForecastTable, DrawBracket, TournamentDrawView
4. Intégration dans tournament-view.tsx (remplacer placeholder)
5. Monterrey WTA500 live en priorité

## Fichiers créés
| Fichier | Rôle |
|---------|------|
| `src/lib/types/tennis-draw.ts` | Types partagés (DrawPlayer, DrawRound, TournamentDraw, ForecastRow) |
| `scripts/scrape-tennis-draw.js` | Scraper TennisAbstract → pariscore.db (28 joueurs Monterrey insérés) |
| `src/app/api/tennis/tournament/[slug]/draw/route.ts` | API endpoint draw + forecast (GET, TTL 5min) |
| `src/hooks/use-tournament-draw.ts` | Hook SWR pour les draws |
| `src/components/tennis/draw-forecast-table.tsx` | Table TennisAbstract améliorée (BarFill, color-coded, sticky header) |
| `src/components/tennis/draw-match-row.tsx` | Ligne de match dans le bracket |
| `src/components/tennis/round-badge.tsx` | Badge round (R32/R16/QF/SF/F) |
| `src/components/tennis/draw-bracket.tsx` | Bracket tree (desktop, simplified) |
| `src/components/tennis/tournament-draw-view.tsx` | Conteneur principal (toggle table/bracket, loading/error/empty) |

## Fichiers modifiés
| Fichier | Changement |
|---------|------------|
| `src/components/tennis/tournament-view.tsx` | Remplacer placeholder par TournamentDrawView |
| `COMPONENTS.md` | Ajouter les nouveaux composants tennis |

## Architecture données
```
TennisAbstract → scrape-tennis-draw.js → pariscore.db (tennis_draw_forecast)
                                            ↓
                              /api/tennis/tournament/[slug]/draw
                                            ↓
                              useTournamentDraw(slug) — SWR
                                            ↓
                              TournamentDrawView → DrawForecastTable | DrawBracket
```

## Décisions techniques
- **Scraper** : Node.js avec module `https` (pattern existant scrape-oddalerts.js)
- **Stockage** : SQLite via better-sqlite3 (pattern existant leagues-stats)
- **Frontend** : shadcn/ui + Tailwind (convention projet)
- **Probabilités** : colonnes R16/QF/SF/F/W = probabilité cumulée d'atteindre ce round
- **Convention** : French comments, DM Mono pour les chiffres, `cn()` depuis `@/lib/utils`

## Pièges connus
- TennisAbstract peut bloquer les IP datacenter → mode fallback avec cached data
- Les draws ont des tailles variables (128/96/64/32/28) → normaliser en rounds
- Les joueurs peuvent avoir des noms unicode → normaliser pour le matching
