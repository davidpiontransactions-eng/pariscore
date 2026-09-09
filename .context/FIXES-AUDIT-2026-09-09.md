# Trace FIXES-AUDIT — correctifs HIGH + MEDIUM (2026-09-09, suite audit)

## H1 — Allowlist statuts live (`bsd-football-fetcher.ts`)
- `isBsdLiveStatus()` exporté (source unique) : `1H/2H/HT/LIVE/inplay/…`.
  `cancelled`, `FT`, `AET`, `PEN`, `abandoned`, `walkover`… → non-live.
- Utilisé dans `mapLiveState` + `fetchBSDFootballMatchMeta` (denylist supprimée).
- Bonus : `homePossession` clampée 0-100, `minute` clampée 0-130.

## H2 — namesMatch (`espn-soccer-fetcher.ts`)
- ≥2 tokens communs → match ; token unique → match sauf générique bloqué
  (`city/real/madrid/milan/…`) et nom court ≤14 car. (`Man United` OK,
  `Man Utd↔Newcastle` KO, derbies bloqués).
- `namesMatch` exporté + `__tests__/espn-matching.test.ts` (8 tests : alias
  KR/JP, slugs BSD, allowlist statuts).

## H3 — funnel-log (`live-funnel-log/route.ts`)
- `signals` validés ⊆ vocabulaire, marchés clampés 0-100, scores ≤20,
  rate-limit 1/30 s par (IP, match) → 429, purge opportuniste de la map.

## MEDIUM/LOW rapides
- `projectLiveMarkets` : minutes 90+ (stoppage +6, `phaseSum` étendue, seuil
  terminé 120) + 2 tests (90+4 non figé, 11v10).
- Stats route : `matchId ^\d+$` → 400 (anti path forgé).
- Dialog : `encodeURIComponent`, `AbortSignal.timeout(15000)`, reset synchrone
  (anti flash match A/B), `shortName ?? name`, erreur `délai dépassé`.
- Beacon : deps scalaires + refs, skip `document.hidden`.
- Lignes fautes/jaunes/rouges affichées si un seul camp non-null.

## Vérifications
- typecheck OK · lint 0 errors · 89 tests pass (4 fichiers).
