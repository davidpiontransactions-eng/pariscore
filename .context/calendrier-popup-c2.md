# C2 — Popup opaque + encarts FotMob (skill: implement)

## Changements
- `DialogContent` : `bg-[#fafafa] text-[#222] border-[#f0f0f0]` uni
  (fini la translucidité ; sections sombres existantes conservées en blocs).
- Nouveau `fotmob-match-stats.tsx` : `Meilleures statistiques` (possession /
  xG / tirs + barres duales tirs cadrés, corners, fautes) depuis `live`,
  repli prematch (`xGa`, buts marqués/encaissés pg) ; lignes omises si vide ;
  ligne stade (venue + ville/pays + coup d'envoi).
- Inséré après le header dans `football-match-detail-dialog.tsx`
  (live ET prematch).
- Correctif : `MetricValue` (`{value}`) via `fmtMv` (tsc).
- Hors scope documenté phase 2 : compos/notes, H2H, fil événements
  (endpoints BSD existent, aucune route/UI), nom arbitre, derniers scores.

## Vérifications
- `bun run typecheck` : 0 erreur. `bun run lint` : 0 erreur.
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
- QA visuelle popup : C3.
