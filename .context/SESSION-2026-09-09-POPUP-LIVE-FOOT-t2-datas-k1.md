# Trace T2 — Enrichissement datas K1 + championnats (SESSION-2026-09-09-POPUP-LIVE-FOOT)

## Cause racine (root cause, pas symptôme)
`fetchBSDFootballMatchMeta` renvoie un VRAI id BSD (K League 1 = 50) mais
`leagueToEspnSlug` (`espn-soccer-fetcher.ts`) n'était indexé que sur les ids
legacy ≈ API-Football (K1 = 292) → `leagueToEspnSlug(50) = null` → ESPN jamais
interrogé pour la K1 (et routé vers la MAUVAISE ligue pour BSD 39/40/88…).
En cascade : pas de buckets minute, pas de totaux boxscore → `Meilleures
statistiques` réduite à la possession + `503 aucune source` dès que BSD
faiblit. Second facteur : `namesMatch` strict échouait sur les variantes KR
("Jeju SK" ↔ "Jeju United") ; `mapLiveState` rejetait les valeurs numériques
en chaînes.

## Fichiers touchés
- `src/lib/espn-soccer-fetcher.ts` — `BSD_TO_ESPN_SLUG` (34 ligues BSD→slug,
  dont 50→`kor.1`, 49→`jpn.1`), `leagueToEspnSlug` priorise BSD puis legacy ;
  `namesMatch` accepte un token significatif commun ≥ 4 lettres.
- `src/lib/bsd-football-fetcher.ts` — `mapLiveState` : `num()` à coercition
  (`Number(v)`), possession repliée sur `100 − away` si home absente,
  scores/minute coercés.

## Vérifications
- `bun run typecheck` : OK. `bun run lint` : 0 errors (warnings préexistants).
- Sonde runtime : `50→kor.1`, `49→jpn.1`, `1→eng.1`, `292→kor.1` (repli),
  `null→null`.
- Reste à valider en live : popup Gwangju/Jeju remonte tirs/corners/xG.

## Skill : scrapling (résolution multi-source) — appliqué en équivalent
## codebase (pas de nouveau provider, allowlist respectée)
