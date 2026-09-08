# P3 — Perf (`football-calendar.tsx`, `layout.tsx`)

## Changements
- Sections ligue : `content-auto` (Tailwind v4 = `content-visibility: auto`)
  + `[contain-intrinsic-size:auto_300px]` (évite les sauts de scrollbar).
  Pas de virtualisation : listes journalières < 100 lignes, `content-visibility`
  suffit (guidelines perf).
- `src/app/layout.tsx` : `preconnect` + `dns-prefetch` vers
  `sports.bzzoiro.com` et `api.dicebear.com` (logos équipes, pattern existant
  du fichier).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré.
- Mesure rendu : P4 (probe chrono).
