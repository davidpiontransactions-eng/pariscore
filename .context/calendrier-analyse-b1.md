# B1 — Audit datas analyse prematch (skill: research)

## Sources primaires (agent explore)
- `predictive-engine.ts` : `computeProbabilities` → 1X2 (poisson/dixonColes/
  elo/powerScore/ensemble), markets O/U + BTTS, EV. **Pas de scores exacts.**
- `prediction/football/poisson.ts:29` : `buildScoreMatrix(λh,λa,max=8)`,
  `marketsFromMatrix` (topScores[5]). `dixon-coles.ts:43` idem (rho=0.05).
  `engine.ts:139 predictPrematch`. Lambdas via `aggregateFromSources`
  (cotes 1X2, total λ=2.70).
- `FootballMatch` : `prediction` (probs + xGa/xGd/stats), `odds`, `live|null`.
- `FootballMatchDetailDialog` (props `match/open/onOpenChange`) : déjà
  comparatif, 3 paris, markets 1X2/DC/O/U/BTTS/corners + **Score Exact
  approximatif** (`approxTopScores`, top 3 depuis 1X2 — à remplacer par
  vraie matrice).
- Aucune route analyse par match ; `top5` = par stratégie.

## BeSoccer live
Fetch page : coquille JS + gate âge, **0 donnée match** (client-render).
Référence = sample HTML utilisateur (grille scores 0-10 + colonne marges,
opacité ∝ proba, `FM`, cartons rouges, pastille minute).

## Plan B2-B4
- **B2** (TDD) : `scoreMatrixForMatch()` dans `lib/` au-dessus de
  `aggregateFromSources` + `buildScoreMatrix` (max 10 + colonne marges
  `+N`) ; tests : somme≈1, symétrie λ égaux, top score `1-0/2-1` sur
  λ typiques, marges = somme diagonales.
- **B3** (ui) : `besoccer-score-matrix.tsx` (poss-box : win prob + blason +
  xG ; grille + marges, opacité verte) ; clic ligne `FotmobMatchRow`
  → `onSelect` → `TopMultiSport` monte `FootballMatchDetailDialog`
  (+ section heatmap en branche prematch) ; teintes mesurées Playwright
  (repli : tokens T1).
- **B4** : QA probe (heatmap rendue, clic→dialog, FM/MT), gates, commit, deploy.
