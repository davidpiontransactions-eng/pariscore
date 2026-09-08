# P0 — MatchRow façon FotMob (`football-calendar.tsx`)

## Objectif
Ligne match 5 zones : domicile · minute live · score/heure · extérieur · suivre.

## Changements
- `src/components/football/football-calendar.tsx` — `MatchRow` réécrit :
  - grille `grid-cols-[1fr_auto_auto_1fr_auto]`, hover slate conservé ;
  - pastille minute `w-7 tabular-nums text-emerald-400` (`66’`), cellule vide sinon (alignement) ;
  - centre `w-14` : score bold (live) / heure ou `Terminé`/`MT` (sinon) ;
  - logos 20px + `truncate` + `min-w-0` (noms longs) ;
  - `FollowButton` (`category="match"`, `size="sm"`, stopPropagation interne).
- Réutilisation (Le Ladder) : `FollowButton`, `teamLogoUrl`, `getScoreText/getTimeText` existants. Pas de navigation ligne (pas de routes détail foot — dialogs ailleurs).

## Data mapping
minute ← `live.minute` · score ← `live.homeScore/awayScore` · heure ← `parisKickoff(scheduledAt)` · statut ← `getStatus` (LIVE/HT/notstarted…).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (tâche UI-only).
- `graphify update .` : 21303 nœuds / 41457 arêtes, `graph.json` + `GRAPH_REPORT.md` régénérés.
- Gates complètes (lint + typecheck) : fin de boucle en P4.
