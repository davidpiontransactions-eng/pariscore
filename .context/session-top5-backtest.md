# Session : Backtest Top 5 par stratégie (football + tennis) + Saudi Pro League

> Beads `ParisScorebis-i889` (foot, CLOSED) + `ParisScorebis-eirp` (tennis) · 2026-08-25

## Scope livré

Backtest « historiques de résultats & stats de réussite » du **Top 5 matchs par stratégie**
(widget sidebar football) : 180 jours rejoués en walk-forward + snapshot quotidien prospectif.

## Décisions validées avec l'opérateur

| Décision | Choix |
|---|---|
| Mode | Hybride : backfill walk-forward 180 j (replay) + snapshot quotidien ensuite |
| Réussite foot | pick gagne (bestTeam/1x2), non-défaite (doubleChance), ≤1 encaissé (bestDefense), ≥3 buts (bestAttack), marchés directs over15/under35/btts/corners |
| ROI | flat 1u sur les picks avec cote pré-match BSD uniquement |
| Périmètre | Football complet ; tennis = bead séparé (voir limites) |

## Sondages API BSD (décisifs pour l'architecture)

| Constat | Conséquence |
|---|---|
| `date_from`/`date_to` supportés sur `/matches/?status=finished` (foot) | replay jour-par-jour possible |
| Sans dates, `finished&limit=100` ne renvoie que ~2 lignes | toujours paginer par jour dans le backfill |
| Une journée mondiale > 200 matchs | pagination `offset` jusqu'à 4 pages/jour |
| Scores : 100 % des finis | settlement buts fiable à 100 % |
| `live_stats.*.corner_kicks` : ~90 %+ (28 voids/180 j) | settle O6.5 corners fiable, nulls exclus |
| Cotes O/U 1.5 : 93 % à J-5 → 0 % à J-180 | ROI partiel par conception (« quand possible ») |

## Architecture

```
src/lib/top5-backtest/types.ts     entrées/stats/agrégation (sport-agnostique)
src/lib/top5-backtest/store.ts     JSON data/top5-backtest/{sport}.json (atomic tmp+rename,
                                   mutex anti-concurrence, cache mtime, MAX_ENTRIES 20k)
src/lib/top5-backtest/football.ts  replay walk-forward + règles de settlement + run daily
scripts/backfill-top5-backtest.ts  CLI --days/--mode=backfill|daily/--dry-run
src/app/api/football/top5/backtest/route.ts   GET agrégats + 30 derniers picks
src/hooks/use-football-top5-backtest.ts       SWR (dedup 10 min)
src/components/football/top5-backtest-strip.tsx  bandeau WR/ROI/série + drawer 10 picks
scripts/cron-top5-backtest.sh      wrapper cron (PATH bun)
ecosystem.config.js                pariscore-cron-top5-backtest, daily 05:15 UTC
```

**Honnêteté statistique (clé)** : le replay recalcule le top 5 de chaque jour D avec
UNIQUEMENT les matchs finis strictement avant D (`league.id neutralisé` → désactive les
overlays soccerstats/BetMines dont les tables ne sont pas archivées point-dans-le-temps).
Le replay mesure donc le moteur de forme BSD pur. Le snapshot quotidien capture lui ce que
voit l'UI (overlays inclus). Divergence documentée et assumée.

## Fix proxy corners inclus (signal inversé)

Avant : `over65Corners` classait par P(≥7 corners) d'un proxy buts→corners saturé (~88-90 %),
que le filtre `MAX_PROB_PCT` (<86,96 %) éliminait → le top 5 finissait dominé par des affiches
fermées (signal inversé).
Après : la stratégie classe par **λ corners attendus** (BetMines λ → proxy soccerstats →
corners réels L5 BSD), exemptée du filtre probabilité (foot-strategy-top5.ts). UI :
`X,X cor` au lieu de `%`.

## Saudi Pro League

- BSD id **17** → `BSD_LEAGUE_IDS.saudi_pro_league` (league-mapping.ts) ;
- soccerstats slug **`saudiarabia`** (404 sur `saudi`) ajouté aux dicts de
  `scrape_rankings.py` et `scrape_form.py` + overrides noms (tirets→espaces)
  dans `team_name_mapping.py` ;
- Run vérifié : `public/data/form/saudi_pro_league.json` + `public/data/rankings/saudi_pro_league.json`
  (18 équipes H/A). Les matchs saoudiens étaient déjà éligibles au top 5 brut (agrégat
  toutes ligues BSD) ; ils gagnent les enrichissements bestAttack/bestDefense/corners.
- BetMines/FD.co.uk ne couvrent pas la Saudi → fallback corners proxy/BSD (limite notée).

## Résultats du backfill (2026-08-25)

5323 entrées / 180 jours (won 3852 · lost 1443 · void 28) :

| Stratégie | n | WR | ROI 1u (n cotes) |
|---|---|---|---|
| bestTeam | 721 | 68,8 % | +2,3 % (589) |
| bestTeam1x2 | 589 | 77,6 % | +4,3 % (588) |
| bestAttack | 418 | 49,8 % | — |
| bestDefense | 418 | 65,3 % | — |
| doubleChance | 626 | 82,4 % | — |
| over15 | 708 | 81,9 % | +0,1 % (576) |
| under35 | 710 | 78,7 % | −4,2 % (561) |
| bttsYes | 721 | 61,3 % | +1,9 % (568) |
| over65Corners | 418 | 83,8 % | — (pas de cotes corners) |

⚠️ Lecture : WR élevé = par construction (on prend les picks les plus probables) ; ROI sans
marge/frais ni closing-line value. `under35` : bon WR mais ROI négatif → pas de valeur au
prix du marché. À re-passer après quelques semaines de snapshots prospectifs (plus rigoureux).

## Limites & suivi

1. ~~**Tennis non couvert**~~ → **Livré en 2ᵉ phase** (voir section tennis ci-dessous).
2. Snapshot quotidien à 05:15 UTC : les matchs démarrés avant ne passent pas le filtre
   `notstarted` (divergence mineure vs widget).
3. Pas de smoke-test serveur live effectué depuis ce shell (CMD) — QA manuelle remplacée par
   `scripts/qa-top5-backtest-ui.js` (Playwright, PASS foot + tennis).
4. Quality gates : typecheck + lint 0 erreur sur les fichiers touchés (bruit préexistant
   tools/tests hors scope).

## 🎾 Phase 2 — Tennis (bead `ParisScorebis-eirp`)

### Déblocage de la profondeur historique

| Constat | Conséquence |
|---|---|
| Tables « TennisAbstract » de la DB **toutes vides** (`tennis_ta_cache`, `koa_matchmx`, elo : 0 rows) | pas d'historique caché en local |
| **ADR `sackmann-purge` (bd 8uoc)** : Sackmann/TML = CC BY-NC-SA, interdits en commercial — purge déjà exécutée | re-scraping Sackmann/TA match data = **NO-GO légal définitif** |
| La sonde BSD tennis 404 était un mauvais path : base réelle = `sports.bzzoiro.com/tennis/api/v2/matches/` | profondeur réelle ≥ 190 jours |
| Détail `/matches/{id}/` répond aussi sur les vieux matchs (pct service/retour/TB + cotes) | métriques reconstructables point-dans-le-temps |

### Livré

- `scripts/backfill-tennis-history.ts` — backfill propriétaire BSD :
  - Phase A scores (~19 k matchs/190 j, upsert `ON CONFLICT` préservant les pct) ;
  - Phase B `--detail` : enrichissement % service/retour/TB via l'endpoint détail
    (18,6 k appels, lancé en arrière-plan, ~0 err ; les métriques service/retour montent
    progressivement avec la couverture).
- `src/lib/top5-backtest/tennis.ts` — replay incrémental (pass chronologique unique) :
  - **surfaceElo / eloGlobal** : Élo interne propriétaire (K=32, base 1500) — diverge de
    l'Élo TennisAbstract du payload live (non rejouable) ; divergence documentée ;
  - **momentum** : repli forme W/L du moteur prod (payload EWM non archivé) ;
  - **serveDominance / returnEfficiency / completeness / pressure** : formules prod
    (Dryja/Sipko) sur les pct stockés, minMatches=3.
- CLI `--sport=tennis` (backfill/daily), API `/api/tennis/top5/backtest`,
  bandeau UI généralisé (`Top5BacktestStrip sport="tennis"`), cron wrapper foot+tennis.

### Résultats backfill initial (190 j, avant fin d'enrichissement détail)

| Métrique | n | WR | ROI 1u (n cotes) |
|---|---|---|---|
| surfaceElo (Élo interne) | 911 | 71,8 % | +0,1 % (843) |
| eloGlobal (Élo interne) | 893 | 70,5 % | −4,3 % (851) |
| momentum (forme W/L) | 918 | 60,0 % | −6,0 % (764) |
| pressure (TB + sets décisifs) | 787 | 57,6 % | −2,5 % (765) |
| serveDominance / returnEfficiency / completeness | 50 chacune | 58-66 % | partiel |

→ Les 3 métriques service/retour monteront à ~900 picks quand le job détail aura couvert
les 190 jours (il traite du plus récent au plus ancien).

### QA

- `node scripts/qa-top5-backtest-ui.js http://localhost:3000 tennis` → PASS
  (strip « 911 picks · WR 72 % · ROI +0,1 % · série +2 », drawer 10 lignes, 0 erreur console)
- Idem football après refactor hook générique → PASS.

## Commandes utiles (tennis)

```bash
bun run scripts/backfill-tennis-history.ts --days=190 --detail --pause-ms=55  # scores+pcts
bun run scripts/backfill-top5-backtest.ts --sport=tennis --days=190 --dry-run # replay sans écriture
bun run scripts/backfill-top5-backtest.ts --mode=daily --sport=tennis         # settle+snapshot
curl localhost:3000/api/tennis/top5/backtest                                  # agrégats
```

## Commandes utiles

```bash
bun run scripts/backfill-top5-backtest.ts --days=180 --dry-run   # rejeu sans écriture
bun run scripts/backfill-top5-backtest.ts --mode=daily           # settle+snapshot manuel
pm2 start ecosystem.config.js --only pariscore-cron-top5-backtest  # (VPS)
curl localhost:3005/api/football/top5/backtest                   # agrégats
```
