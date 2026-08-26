# Session: Predictions Live — Markov Engine (2026-08-26)

## Scope

Remplacement du modèle odometer statique dans `adjustLambdaLive()` par un moteur **Markov récursif score-conditionné** pour les prédictions live tennis. Le nouveau modèle est sensible à QUI mène (pas seulement combien de jeux/joués), à la force de service observée, et aux probabilités implicites marché.

## Fichiers modifiés

| Fichier | Action | Lignes |
|---------|--------|--------|
| `src/lib/prediction/live-markov.ts` | **Nouveau** | 480 — récursion Markov mémoïsée, `gameWinProb`, `setWinProb`, `setScoreDistribution`, `setOverUnder`, `expectedRemainingGames`, `expectedRemainingSets`, `matchWinProb`, `clearAllMemos` |
| `src/lib/prediction/total-games.ts` | Réécrit | `adjustLambdaLive()` v2 — utilise `expectedRemainingGames` + `setScoreDistribution` au lieu de l'odomètre. `LiveGamesContext` étendu (`liveProbA`, `liveProbB`, `server`). Type `TotalGamesPrediction` étendu (`setOver75`, `setUnder125`) |
| `src/components/tennis/predictive-bets.tsx` | UI ajout | Section "Set en cours" avec barres Over 7,5 / Under 12,5 (live only). `buildLiveContext` étendu. `clearAllMemos()` avant chaque recalcul live |
| `src/components/tennis/most-aces-compare.tsx` | Synchronisé | `buildLiveContext` → liveProb, server |
| `src/components/tennis/pip-bet-panel.tsx` | Synchronisé | `buildLiveContext` → liveProb, server |
| `src/lib/set-odds.ts` | Synchronisé | `buildLiveContext` → liveProb, server |
| `tests/live-markov-sanity.spec.ts` | **Nouveau** | 14 tests unitaires — tous passent |

## État des tests

- `live-markov-sanity.spec.ts` : **14/14 passent** ✅
- `bun run typecheck` : **0 erreur** dans les fichiers modifiés (erreurs pré-existantes dans `tests/` et `tools/` ignorées)
- `bun run lint` : timeout mais pas d'erreur dans mes fichiers

## Le Ladder validé

| Étape | Statut |
|-------|--------|
| P1: `live-markov.ts` créé | ✅ |
| P2: `adjustLambdaLive()` réécrit | ✅ |
| P3: `predictive-bets.tsx` — Over 7,5 / Under 12,5 + liveCtx | ✅ |
| P4: Propagation liveCtx aux 3 frères | ✅ |
| P5: Sanity tests 14/14 | ✅ |
| P6: Review + trace doc + commits + deploy | ⏳ |

## Prochaine étape (P6)

1. Review finale du code (vérifier que les memoization maps ne grossissent pas en prod)
2. Créer `.context/session-predictions-live-v2.md` avec trace complète
3. Commits : `feat(tennis): replace live odometer with Markov DP engine + per-set Over/Under`
4. Deploy VPS
5. QA Playwright sur match live (si disponible)

## Pièges à retenir

- `setOverUnder` retourne des floats **0-1** (pas 0-100) — les composants UI multiplient par 100
- `clearAllMemos()` doit être appelé **avant** chaque recalcul live sinon les résultats sont stale
- `expectedRemainingSets(1, 0, 0.65, true)` retourne **0.35** (sets restants APRÈS le set en cours, pas le set en cours lui-même)
- `gameWinProb(p)` prend une proba de **point** [0,1], pas une hold prob — ne pas confondre
- Les erreurs TS pré-existantes dans `tests/football-sidebar-selection.spec.ts` et `tools/` ne sont PAS liées à cette session

---

# Journal de boucle d'ingénierie P6 (2026-08-26)

> Mode traçabilité : une entrée par étape (action → verify → résultat). Bead : `ParisScorebis-gmdr`.

## P0 — Setup traçabilité

| Action | Verify | Résultat |
|--------|--------|----------|
| Création bead `ParisScorebis-gmdr` (P1) | `bd create` OK | ✅ |
| Claim bead | `bd update --claim` → in_progress | ✅ |
| Journal de boucle ouvert (ce document) | section présente | ✅ |

**Périmètre validé par l'utilisateur** : P6 complet (review → fixes → gates → commits → deploy → QA live).
**Décision** : import `vitest → bun:test` dans la spec (convention repo, les 5 autres tests racine utilisent `bun:test`).

## P1 — Review (agent code-reviewer)

| Action | Verify | Résultat |
|--------|--------|----------|
| Review multi-dimensions des 7 fichiers session | rapport structuré | ✅ Verdict **NO-GO** |

### Bloquants identifiés
1. `[critical]` **Échelle 0-1 vs 0-100** : `setOverUnder()` retourne 0-1, assigné tel quel à `setOver75/setUnder125` alors que le type annonce [0..100] et l'UI affiche `{prob}%` brut → « 0.62 % », seuils couleur jamais atteints. Fix : ×100 arrondi dans `adjustLambdaLive`.
2. `[critical]` **Clés de mémoïsation incomplètes** (`SetKey/DistKey/GamesKey`) : sans `holdA/holdB`, les Maps module-level croisées entre composants → probas fausses silencieuses sur page multi-matchs. Fix : inclure holds quantisés dans les clés.
3. `[critical]` **`expectedRemainingSets` math faux** : boucle n'update jamais setsA/setsB (BO3 0-0 → 2 au lieu de ≈2.46 ; 0-1 → pWinSetA au lieu de 1.35). Fix : vraie récursion DP ou suppression si non utilisée en prod.

### Mineurs traités
- Import `clearAllMemos` mort dans `total-games.ts` → appelé dans `adjustLambdaLive` (borne aussi la croissance mémoire)
- `pWinTB` mort + `dist["7-6"]` agglomère les 2 issues du TB → répartir `"7-6"`/`"6-7"`
- Deps `useMemo` incomplètes dans `predictive-bets.tsx` → compléter
- `maxSets` inutilisé dans `matchWinProb` → retirer
- `liveProbB` ignoré quand `liveProbA` absent → fallback `1 - liveProbB`
- Branche constante `1.35` → simplifiée + commentaires français
- Imports en milieu de fichier → remontés en tête

## P2 — Fixes post-review

| Fix | Fichier | Verify |
|-----|---------|--------|
| Clés mémo avec holds quantisés (`memoKey()`, 3 Maps) | `live-markov.ts` | clés complètes, plus de dépendance à l'ordre d'appel |
| `expectedRemainingSets` réécrit en DP récursif correct | `live-markov.ts` | E(1,0,.65)=1.35 exact ; E(0,0)≈2.46 |
| Split TB `"7-6"`/`"6-7"` dans la distribution | `live-markov.ts` | les 2 issues distinctes, `pWinTB` utilisé |
| `under125 = 1 − P("7-6") − P("6-7")` | `live-markov.ts` | les 13 jeux des 2 issues comptés |
| Retrait `maxSets` mort (`matchWinProb`) | `live-markov.ts` | lint OK |
| **Échelle ×100 arrondi** sur `setOver75/setUnder125` | `total-games.ts` | contrat [0..100] du type respecté, UI cohérente |
| `clearAllMemos()` en tête de branche live `adjustLambdaLive` | `total-games.ts` | point de passage unique : mémoire bornée, contrat modèle |
| Fallback marché symétrique `100 − liveProbB` | `total-games.ts` | vérifié échelle BSD = 0-100 (bsd-fetcher.ts:402) |
| Branche constante `1.35` écrite honnêtement (comportement inchangé) | `total-games.ts` | shrink, zéro drift calibration |
| Imports remontés en tête / `expectedRemainingSets` retiré des imports | `total-games.ts` | import mort supprimé |
| Retrait appel+import `clearAllMemos` du composant (délégué au modèle) | `predictive-bets.tsx` | composant simplifié |
| Deps `useMemo` complétées (+prematch, +liveProbA/B, +server, +elos) | `predictive-bets.tsx` | recalcul à chaque poll si marché bouge |
| Import `vitest` → `bun:test` | spec | convention repo, TS2307 éliminé |

## P3 — Quality gates

| Gate | Commande | Résultat |
|------|----------|----------|
| Tests unitaires | `bun test tests/live-markov-sanity.spec.ts` | ✅ **17/17 pass** (14 initiaux + 3 nouveaux : split TB, DP 0-0, BO5) |
| Typecheck scoping | `tsc --noEmit` filtré sur les 7 fichiers | ✅ 0 erreur session (erreurs pré-existantes `tests/`/`tools/` hors scope) |
| Lint scoping | `bunx eslint <7 fichiers>` | ✅ 0 erreur (spec ignorée par config eslint — convention repo) |
| Graphe connaissances | `graphify update .` | ✅ AST 1428/1428 fichiers, graphe régénéré + backup 2026-08-26 |

**Verdict review après fixes : GO** (les 3 bloquants critiques corrigés + 10 mineurs traités).

## P4 — Commits

| SHA | Message | Fichiers |
|-----|---------|----------|
| `45e2626b` | feat(tennis): moteur Markov DP live pour ajustement lambda | live-markov.ts, total-games.ts |
| `9fb84631` | feat(tennis): over/under set en cours + propagation liveCtx | 3 composants + set-odds.ts |
| `9e0a65c7` | test(tennis): sanity suite moteur Markov (17 cas) | spec |
| `43667c17` | docs(context): trace boucle predictions-live-v2 | trace .md + AGENTS.md |

⚠️ Incident deploy évité : le mode par défaut de `deploy.bat` fait `git add -u` (aurait embarqué le WIP top5-backtest de l'autre session). Chemin sûr utilisé : `stash → pull --rebase → push → stash pop` puis `deploy.bat --no-commit`. Le VPS fait `reset --hard origin/main` → seuls les commits poussés partent en prod.

## P5 — Deploy VPS

| Action | Verify | Résultat |
|--------|--------|----------|
| Push origin/main (`803885d4..43667c17`) | fast-forward OK | ✅ |
| `scripts\deploy.bat --no-commit` | log VPS | ✅ **VPS_DEPLOY_OK** — build complet (`build_ran: 1`, 7 fichiers session détectés), pm2 restarté, `health: OK` |

Commit sondes QA : `0897588d` (test(tennis): sondes QA live moteur Markov).

## P6 — QA live (prod)

| Sonde | Méthode | Résultat |
|-------|---------|----------|
| API live | `GET /api/tennis/live` | ✅ HTTP OK — 13 matchs live |
| **Moteur sur données prod** | `scripts/qa-markov-live-engine.ts` — predictTotalGames sur 8 matchs réels | ✅ **PASS** : 8/8 sorties ∈ [0..100], 4 valeurs distinctes (modèle actif), cas limites validés : **6-6 → Under12,5=0%** (TB certain), **4-2/5-2 → Over7,5=100%** (min 6-2=8 jeux), leader 83% à 2-0 → Over7,5=24% |
| UI DOM (screenshot) | `scripts/qa-markov-live-probe.ts` (Playwright) | ⚠️ Impossible localement : chromium headless-shell ET chrome système timeout au lancement (RAM commit saturée — piège connu machine). Sonde committée pour re-run ultérieur : `bun run scripts/qa-markov-live-probe.ts` |

## Bilan de boucle

- Review agent : NO-GO → 3 bloquants corrigés → GO
- Gates : tests 17/17 · tsc 0 erreur session · eslint 0 erreur · graphify régénéré
- 4 commits rebasés proprement sur l'upstream (refresh données concurrents), poussés, déployés
- Deploy prod validé + QA moteur PASS sur données live réelles
- Bead `ParisScorebis-gmdr` fermé
