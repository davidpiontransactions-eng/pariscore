# Contrat Data Tennis — Carte canonique

## Shape
{id, tab, tour, tournament, surface, round, bestOf, commence_time, status,
 player1/2: {id, name, country, flag, photo, rank, elo_surface, surf_rank, surf_rank_total, surf_form, l5_pts, l10_pts, powerscore, serve_index, receive_index, serve_hold_pct, return_pct, gamesLast14Days},
 odds: {p1:{odds,book}, p2:{odds,book}, stale, age_ms} | null,
 fair: {p1, p2, margin, method} | null,
 signal: {label, side, prob, ev_pct, odds, confidence, stale} | null,
 traps: [],
 _raw_predictions, _raw_best_ev_model}

## Règles de normalisation (côté serveur _serializeTennisCard)
- prob toujours 0-1 (×100 → prob_pct distinct si besoin)
- predictions toujours objet {elo:{p1,p2}, blended:{p1,p2}} (jamais number nu)
- best_ev_model toujours présent ou null
- valeurs manquantes = null, jamais undefined ou 0
- odds.stale = age_ms > 10min (live) ou > 4h (prematch)
- confidence: high si BSD + WElo surface + surf_rank_total>=150; medium si 1-2; low sinon
- traps: trap_bet, drift, fatigue (>12 matchs/14j), surface_elo_low (<20 matchs), data_insufficient

## Source unique
Calculé côté serveur par `_serializeTennisCard(m)` dans server.js (Task 1.1).
Le frontend (mapMatch) ne fait que transmettre.
