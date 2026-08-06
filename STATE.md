# Loop State — PariScore

Last run: 2026-08-05 (R9 + UAT SSE → 10kj closed; v6ka builder identity-stable → closed)

## High Priority (loop is acting or waiting on human)

- P1 P3-F (3.15) OWASP ZAP + tests charge + QA Phase 3 (ParisScorebis-lp62) — en cours (claimé), infra Docker ZAP dispo sur VPS, cible = prod.
- P1 Mobile responsive adaptation Tennis (ufh6) — ready.
- P1 C5 teaser value bets freemium (k684) — ready.
- P1 C3 SSE push liste live tennis (10kj) — ✅ **CLOSED** (2026-08-05) : UAT passée sur prod-like (17 matchs Toronto/Montreal, 2 snapshots live en 12s avec live_stats réels via `/api/tennis/live-stream` + `/api/tennis/live`).
- v6ka (identity-stable polling fallback) — ✅ **CLOSED** (2026-08-05) : builder partagé `src/lib/live-state-builder.ts` (matchSig/toLiveState/buildLiveStates/emptyLiveStateCache), utilisé par SSE + polling. typecheck + eslint + review (2× APPROVE). Suivant : commit R9+v6ka.

## Watch List

- DiceBear avatars tennis : servis en SVG → `unoptimized` requis (fait). Vérifier qu'aucun autre CDN photo ne par en SVG (img.tennis-warehouse.com = JPEG OK).
- PWA auto-open widget (`?openWidget=1`) : lit `pipSupportedRef` au call-time (fix stale-closure). Bénéficiaires iOS/Android à confirmer (DocPiP = Chromium only).
- Crash silencieux onglet tennis : toute erreur `next/image` → `TennisErrorBoundary` vide tout l'onglet. Toute nouvelle source photo doit être ajoutée à `images.remotePatterns`.

## Recent Noise (ignored this run)

- `qa_tennis_full.png` : 0 card détectée (sélecteur `[data-match-card]` inactif) mais 53 rangs + drapeaux rendus correctement, prematch 200 → rendering OK, sélecteur QA à corriger pour les runs futurs.
- `em_dash_sharp` 39-41 = fallback défensif `#—` pour joueurs au rang inconnu (dont A. Donski rank=0) — comportement attendu, pas un bug.

---
Run log: qa-tennis-2026-08-05 (voir loop-run-log.md)
