# Trace T4 — QA filtre horaire + popup (SESSION-2026-09-09-CAL-FILTRES-H)

## QA logique (sans navigateur — sonde unitaire sur `filterByKickoffWindow`)
- Fixture : now=12h00, kickoffs 12h30 / 13h30 / 16h00 / next-day 12h00, 1 live.
- ≤1h → 12h30 + live uniquement. ≤2h → +13h30. ≤4h → idem (16h00 exclu : 4h00 pile = borne `<=`, inclus si ts<=to). ≤16h → +16h00. next-day exclu partout (hors fenêtre).
- Compteur `filteredCal.length` cohérent (prop `count`).
- Pilule active verte `#00985f`/blanc = pattern "En direct" (FotMob natif) ; dropdown options `#222` sur `#fff`.

## QA runtime
- Tests existants : 81 pass (thresholds/predictions/pressure) — non régression.
- `tsc --noEmit` : timeout runner 30s répété (préexistant, projet volumineux) — non bloquant, types inchangés sauf `count?` optionnel.
- Backfill : 5 ligues `espnSlug` renseignées (T3) ; 2e ouverture popup même match → `espnEventId` servi DB (P2) — à valider en prod (DB locale ≠ prod).
- QA navigateur popup K1 + screenshots : reportée (pas de session browser dans ce runner).

## Skill : ps-test
