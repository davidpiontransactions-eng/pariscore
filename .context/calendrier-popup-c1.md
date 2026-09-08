# C1 — Audit popup vs page match FotMob (skill: research)

## Panneaux FotMob (fetch live `fotmob.com/fr/matches/...`)
Header (ligue/journée/stade/score/buteurs) · onglets (Résumé/Fil/Compos/
Classement/Stats/H2H) · **Meilleures stats** (possession %, xG, tirs) ·
**Événements** (buts/cartons/remplacements, minutes) · **Compos** (4-2-3-1,
notes, remplaçants, absents) · **Derniers matchs** (scores) · infos stade/
météo/arbitre · **H2H**.

## Mapping données PariScore
| FotMob | Dispo | Source |
|---|---|---|
| Header/score/minute | ✓ | `FootballMatch` + `live` |
| Top-3 (possession/xG/tirs) | ✓ | `live.*` (live) / `metricStats`+`xGa` (prematch) |
| Barres stats | ✓ partiel | `live` (9 champs) ; prematch : tirs/corners/xG si non-null |
| Forme W/D/L | ✓ | `team.form` (badges existent) |
| Stade | ✓ | `venue` (nom/ville/pays) |
| Arbitre (nom) | ✗ | `Prediction` n'a que `refereeCardRisk` (pas de nom) |
| Compos/notes | ✗ | endpoint BSD `lineups()` existe, **aucune route/UI** |
| H2H | ✗ | endpoint BSD `h2h()` existe, **aucune route/UI** |
| Fil événements | ~ | `live.goals[]` (minute/type) via `[id]/stats`, partiel |
| Derniers scores | ✗ | pas de résultats adverses (que badges) |

## Dialog actuel
`DialogContent max-w-2xl` (thème) + dock mobile `bg-card/90 backdrop-blur`
= translucidité vue. Sections dark existantes (comparatif, paris, markets).

## Plan C2 (scope verrouillé)
1. Coque opaque : `DialogContent` fond uni `#fafafa` (page FotMob),
   suppression `backdrop-blur` local ; sections existantes conservées
   (cartes sombres sur fond clair = blocs lisibles, pas de restyle global).
2. Nouveau `fotmob-match-stats.tsx` : `Top3Stats` (possession/xG/tirs) +
   `StatsBars` (dual bars horizontales style FotMob) depuis `live` puis
   repli `metricStats`/`xGa` ; section `Infos stade` (venue + kickoff).
3. Ligne manquante documentée phase 2 : compos/H2H/events (nouvelles routes).
