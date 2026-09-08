# P1 — Header ligue FotMob (`football-calendar.tsx`)

## Objectif
Header h-12 avec logo, badge compteur live et collapse animé accessible.

## Changements (`FotMobLeagueHeader` + appelant)
- h-11 → **h-12** ; logo ligue `img` 20px si `league.logo`, sinon drapeau/`🏆`.
- Badge compteur **toujours visible** : `x/y` vert (`bg-emerald-600`) si live > 0, sinon `N` gris ; `tabular-nums`.
- `aria-expanded` sur les deux boutons toggle (barre + chevron).
- Collapse animé façon FotMob : `grid transition-[grid-template-rows]` (`0fr`/`1fr`, 300ms) + `motion-reduce:transition-none` (guidelines animation).
- `liveCount` calculé à l'appel (`g.matches.filter(isLive).length`).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré (`graph.json`, `GRAPH_REPORT.md`).
- QA visuelle (compteurs, collapse, clavier) : P4.
