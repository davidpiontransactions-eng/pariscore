# Design — Moteur de prédictions algorithmiques Football (Prematch + Live)

**Date** : 2026-08-09 — **Statut** : validé (brainstorming, approche A approuvée par l'owner)
**Gate finale** : `bun run typecheck` + `bun test` (moteurs) + deploy VPS (`scripts/update_vps.sh`)

## Objectif (sous-projet 1/3)

Porter le moteur de probabilités football (Poisson, Dixon-Coles, Elo double home/away,
décroissance live) en TypeScript pur côté Next, exposé via une route dédiée. Les
sous-projets 2 (encart éditorial + 3 paris) et 3 (widget momentum live) consommeront
ce moteur — hors scope ici.

## Décisions validées (Q&A)

1. **Port complet Next/TS** — pas de wrapper legacy ; réutilise les maths validées de
   `server.js` (computePoisson l.8415, computeDixonColes l.8484, bayesianBlend l.8869,
   calibration l.8943, live inhomogène l.8579).
2. **Prematch + live ensemble** — un seul engine, une seule spec.
3. **Inputs via pipelines existants** — λ depuis les stats Home/Away (rankings statiques
   soccerstats 8 ligues + `metricStats`/`standingStats` BSD) ; Elo foot recalculé depuis
   l'historique de résultats (table legacy `history`).
4. **Momentum live en cascade** — Pressure Index ESPN (`football-pressure-index.ts`,
   spec 08-04) + xG cumulé BSD quand dispo.
5. **Élo double home/away (style ClubElo)** — deux ratings par équipe, décay temporel,
   K adaptatif.
6. **Route dédiée** `/api/football/prediction/[id]`, engine pur/testable, cache 60 s.
7. **Approche A** : replay de l'historique à la volée + mémoïsation LRU (pattern
   `src/lib/tennis-stats/db.ts` — better-sqlite3 dynamic import).

## Positionnement dans l'existant

- `server.js` legacy = source de vérité des maths (à porter, ne pas toucher).
- `src/lib/football-predictions.ts` : reste en place (métriques UI dérivées : double
  chance, over15, corner over…) — le moteur fournit les probabilités de base, pas de
  doublon. `computeCornerOver`/`poissonOver` y existent déjà → réutilisés pour corners.
- `src/lib/football-pressure-index.ts` + `football-timeline.ts` (spec 08-04) : fournissent
  momentum par bucket → input du module live.
- `src/lib/espn-soccer-fetcher.ts` : source xG/événements live gratuite.
- `src/lib/tennis-stats/db.ts` : pattern de lecture legacy DB depuis Next (à copier pour
  l'accès `history`).

## Architecture

```
src/lib/prediction/football/
├── types.ts          # contrats (FootballTeamInputs, EngineResult, LiveInputs…)
├── poisson.ts        # poissonPMF, buildScoreMatrix, marketsFromMatrix (1X2/OU/BTTS/DC/CS)
├── dixon-coles.ts    # τ(low-score), matrice corrigée, marchés
├── elo.ts            # ratings double home/away, K adaptatif, décay, marge de buts
├── elo-history.ts    # replay historique legacy → ratings mémoïsés (LRU, par équipe+saison)
├── live-decay.ts     # λ restant (temps), correction score, cartons rouges,
│                     #   bayesian update xG cumulé + momentum 15' (Pressure Index)
├── blend.ts          # bayesianBlend porté (Poisson 50 / Elo 25 / xG 25) + calibration
└── index.ts          # computePrediction(matchId) : assemble inputs → EngineResult
src/lib/prediction/football/*.test.ts   # tests unitaires par module
src/app/api/football/prediction/[id]/route.ts   # GET — cache 60 s, fallback gracieux
```

### Contrats clés (types.ts)

```ts
type ScoreMatrix = number[][];                    // P(home, away) normalisée
type Markets = {
  homeWin, draw, awayWin,                          // 0-100
  over05, over15, over25, over35, under15, under35,
  btts, dc: { selection: "1X"|"X2"|"12"; prob },
  topScores: { home; away; prob }[],               // top 5
  cornersOver: { line; prob } | null,
};
type EngineResult = {
  mode: "prematch" | "live";
  lambda?: { home; away },                          // λ utilisés
  markets: Markets;                                 // prematch : blend calibré
  live?: LiveMarkets;                               // live : conditionnels
  elo?: { home; away; homeAdv };                    // diagnostics
  modelSource: "poisson"|"dixon-coles"|"blend"|"live-decay";
  errors?: string[];                                // BAD_LAMBDA, NO_HISTORY…
};
```

### Flux route `/api/football/prediction/[id]`

1. `findMatchInPrisma(id)` → équipes, ligue, statut, score live, minute.
2. Inputs prematch : λ via rankings statiques (CDN soccerstats home/away GF/GA) sinon
   `metricStats` BSD sinon moyennes ligue ; Elo via replay `elo-history.ts`.
3. Poisson + Dixon-Coles + Elo → `bayesianBlend` → calibration → `markets`.
4. Si live : `live-decay.ts` (score, minute, cartons rouges, xG cumulé BSD/ESPN,
   momentum 15' via `buildPressureTimeline`) → `live.markets` conditionnels.
5. Réponse JSON + `Cache-Control: max-age=60`, fallback gracieux (jamais 5xx :
   erreurs dans `errors[]`, marchés absents).

### Maths portées (fidélité legacy)

- `poissonPMF(λ,k)`, matrice 0..8 tronquée puis renormalisation (cohérent server.js).
- Dixon-Coles : τ = 1 − λ·μ·ρ pour (0,0) ; +λ·ρ pour (1,0),(0,1) ; −ρ pour (1,1),
  ρ = −0.05.
- Élo : rating initial 1500, avantage home +100, expected = 1/(1+10^((rB−rA)/400)),
  K adaptatif (K=30 si écart<400 sinon 15), marge de buts (multiplieur 538 : 1, 1.5, 1.75,
  2.5+ selon GD), décay temporel : écart pondéré par max(0, 1 − jours/365) (saison glissante).
- Blend : Poisson 50 / Elo 25 / xG 25 (xG-logit porté depuis server.js).
- Calibration : tables legacy portées telles quelles (prematch + live).
- Live : λ_rest(h/a) = λ_pre × (minutes restantes / 90) × facteur carton rouge
  (±20 %/exclusion) ; bayesian update : poids momentum = 0.15 × tanh(normalisé 15');
  correction score via score-state actuel (matrice conditionnelle renormalisée).

## Fichiers

| Fichier | Type | Rôle |
|---|---|---|
| `src/lib/prediction/football/types.ts` | NEW | Contrats |
| `src/lib/prediction/football/poisson.ts` | NEW | PMF, matrice, marchés |
| `src/lib/prediction/football/dixon-coles.ts` | NEW | Correction τ |
| `src/lib/prediction/football/elo.ts` + `elo-history.ts` | NEW | Ratings + replay LRU |
| `src/lib/prediction/football/live-decay.ts` | NEW | Module live |
| `src/lib/prediction/football/blend.ts` | NEW | Blend + calibration |
| `src/lib/prediction/football/index.ts` | NEW | Orchestration |
| `src/lib/prediction/football/*.test.ts` | NEW | `bun test` |
| `src/app/api/football/prediction/[id]/route.ts` | NEW | Route, cache 60 s |
| `COMPONENTS.md` | — | inchangé (aucun composant) |

## Validation (engineering loop)

1. `bun test src/lib/prediction/football/` — unitaires (poisson/DC contre valeurs
   connues de server.js, élo replay sur historique synthétique, live-decay invariants
   : somme(1X2)=100, proba live monotone decroissante/score).
2. `bun run typecheck` + `eslint` — gate.
3. Smoke route en dev (`bun run dev`) : `/api/football/prediction/{id}` pour un match
   prematch et un match live (données réelles DB).
4. Commit → push → deploy VPS (`scripts/update_vps.sh`).

## Hors scope (sous-projets suivants)

- Encart éditorial + tendance + 3 paris (sous-projet 2 — consomme ce moteur).
- Widget momentum live / métriques de décision rapide (sous-projet 3).
- Modification de server.js (aucune), de `football-predictions.ts` (aucune).