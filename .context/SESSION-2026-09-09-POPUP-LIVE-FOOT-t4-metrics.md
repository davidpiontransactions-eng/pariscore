# Trace T4 — Repasse calculs + metrics live (SESSION-2026-09-09-POPUP-LIVE-FOOT)

## Constats (audit, pas d'hypothèse)
- `projectLiveMarkets` EST déjà reconditionné sur score/minute (convolution
  depuis le score courant) : 6/21/73 à 0-1/61' est un output cohérent, mais le
  libellé `estimées pré-match` le faisait passer pour du stale.
- Vrais manques : cartons rouges jamais transmis (input supporté, appelant
  muet → 11v10 traité comme 11v11) ; calibration marché O2.5
  (`lambdaTotalFromOver25`) inactive car `over25Prob`/`awayProb` non transmis.

## Fichiers touchés
- `src/components/football/live-stats-breakdown.tsx` — prop `prematch`
  étendue (`awayProb?`, `over25Prob?`), transmission
  `homeRedCards`/`awayRedCards`, libellé source honnête :
  `basées xG live` | `score live + taux pré-match` (minute ≥ 1) |
  `estimées pré-match` (0').
- `src/components/football/football-match-detail-dialog.tsx` — prematch
  complet transmis (`awayProb`, `over25Prob`).
- `src/components/football/fotmob-match-stats.tsx` — possession arrondie +
  clampée 0-100 (anti `50.4%` / valeurs hors borne).

## Vérifications
- `bun run typecheck` : OK. `bun run lint` : 0 errors.
- Sonde runtime cas repro (0-1, 61', prematch 30/27/43, O2.5 52%) :
  `4/18/77, O1.5 64%, O2.5 27%` ; avec rouge extérieur :
  `8/24/68` (bascule cohérente) ; source xG dès xG live fournis.

## Skill : ps-test
