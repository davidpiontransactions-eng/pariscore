# Trace T3 — Backfill League.espnSlug (SESSION-2026-09-09-CAL-FILTRES-H)

## Constat racine
Table `League` (dev.db) : 7 lignes, clés = slugs internes (`ligue1`, `epl`…), `bzzoiroId` NULL partout.
→ Voie `bzzoiroId` seule = 0 maj. Double clé nécessaire.

## Fichiers
- `scripts/backfill-espn-slug.mjs` (new) : voie 1 `bzzoiroId` + voie 2 slug interne (`SLUG_TO_BSD` miroir `BSD_LEAGUE_IDS`) ; `--dry-run` ; best-effort, jamais de création.
- `scripts/check-leagues.mjs` (sonde, à supprimer avant commit).

## Résultat
5 maj : `ligue1→fra.1`, `epl→eng.1`, `laliga→esp.1`, `bundesliga→ger.1`, `seriea→ita.1`.
`prisma validate` : OK.

## Reste
Pipeline d'ingestion ne renseigne pas `bzzoiroId` → backfill partiel par design. À terme : renseigner `bzzoiroId` à l'ingestion (voie 1 prendra le relais).

## Skill : caveman-code
