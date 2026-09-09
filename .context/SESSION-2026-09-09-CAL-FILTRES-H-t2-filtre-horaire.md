# Trace T2 — Filtre horaire ≤1h→≤24h + visibilité (SESSION-2026-09-09-CAL-FILTRES-H)

## Cause
- Options `1h/2h/4h/8h/24h` : libellés ambigus (fenêtre ou tranche ?), pas de `16h` (demandé), `24h` seul au-delà de 8h.
- Pilule invisible : fond `#fff` + texte `text-xs font-medium` identique à l'état inactif, aucun marqueur actif.
- Compteur absent : l'utilisateur ne voit pas l'effet du filtre.

## Fichiers
- `fotmob-filter-bar.tsx` : `HOUR_OPTIONS` → labels `≤1h/≤2h/≤4h/≤8h/≤16h/≤24h` (+`hours` typé) ; prop `count?` ; `activeLabel` = `≤Xh (N)` ; pilule active verte `#00985f`/texte blanc (pattern "En direct") ; `aria-label` = "Matchs dans les X prochaines heures" ; garde-fou `v>0` ; options dropdown en `#222` (lisibles sur fond blanc natif).
- `top-multi-sport.tsx` : `count={filteredCal.length}` passé à la barre.
- `fotmob-filter.ts` : inchangé (`filterByKickoffWindow` déjà cumulatif `[now,now+H]`, live gardé).

## Vérifications
- Sémantique cumulative confirmée par utilisateur (fenêtre, pas tranches).
- lint/typecheck : timeouts runner (edit localisé, types inchangés sauf `count?` optionnel).
- QA manuelle : T4 (≤1h vs ≤16h, compteur, live gardé).

## Skill : design-md (style FotMob natif)
