# Audit Flashscore team naming — Plan C (bd qm6a)

> Généré 2026-05-22T15:10:03.989Z via `tools/audit-flashscore-team-naming.js`
> Source : dataset Apify Flashscore team-stats (sport=football)
> Canonique : ⚠ database.json absent — mode offline

## Récapitulatif

- **Total équipes Flashscore** : 20
- Mode offline : pas de match canonique (charger `database.json` pour comparaison)

## England | Premier League
- configId=39

| # | Team | normName | Flags | Match | Fuzzy candidates |
|---|---|---|---|---|---|
| 1 | Arsenal | `arsenal` | — | — | — |
| 2 | Manchester City | `manchester city` | — | — | — |
| 3 | Manchester Utd | `manchester utd` | — | — | — |
| 4 | Aston Villa | `aston villa` | — | — | — |
| 5 | Liverpool | `liverpool` | — | — | — |
| 6 | Bournemouth | `bournemouth` | — | — | — |
| 7 | Brighton | `brighton` | — | — | — |
| 8 | Chelsea | `chelsea` | — | — | — |
| 9 | Brentford | `brentford` | — | — | — |
| 10 | Sunderland | `sunderland` | — | — | — |
| 11 | Newcastle | `newcastle` | — | — | — |
| 12 | Everton | `everton` | — | — | — |
| 13 | Fulham | `fulham` | — | — | — |
| 14 | Leeds | `leeds` | — | — | — |
| 15 | Crystal Palace | `crystal palace` | — | — | — |
| 16 | Nottingham | `nottingham` | — | — | — |
| 17 | Tottenham | `tottenham` | — | — | — |
| 18 | West Ham | `west ham` | — | — | — |
| 19 | Burnley | `burnley` | — | — | — |
| 20 | Wolves | `wolves` | — | — | — |

## ⚠ Heuristique offline — shorthand suspect

Noms Flashscore probablement raccourcis vs canonical (API-Football/BSD/ESPN). Validation manuelle requise quand `database.json` chargé.

| Ligue | Flashscore | normName | Probable full name canonique |
|---|---|---|---|
| England | Premier League | Manchester Utd | `manchester utd` | `manchester united` |
| England | Premier League | Brighton | `brighton` | `brighton hove albion` |
| England | Premier League | Newcastle | `newcastle` | `newcastle united` |
| England | Premier League | Leeds | `leeds` | `leeds united` |
| England | Premier League | Nottingham | `nottingham` | `nottingham forest` |
| England | Premier League | Tottenham | `tottenham` | `tottenham hotspur` |
| England | Premier League | West Ham | `west ham` | `west ham united` |
| England | Premier League | Wolves | `wolves` | `wolverhampton wanderers` |

## Action items DG

- Mode offline : run sur VPS avec `database.json` runtime pour audit complet
  ```
  scp ubuntu@vps:/home/ubuntu/pariscore/database.json /tmp/
  node tools/audit-flashscore-team-naming.js --db=/tmp/database.json
  ```
