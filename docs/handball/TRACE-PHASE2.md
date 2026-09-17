# Traceabilité — Phase 2 : Moteur Stratégies Handball

**Date**: 2026-09-16

---

## Phase 2.1 — Moteur 8 stratégies

**Skill utilisée**: `caveman` + recherche académique
**Fichier créé**: `src/lib/handball-strategy-top8.ts`

### 8 stratégies implémentées

| # | Clé | Modèle | Source académique |
|---|-----|--------|-------------------|
| 1 | `bestTeam` | PPG pondéré L5(60%)+L10(40%) | Felice 2025 (strength estimate = SHAP #1) |
| 2 | `bestTeam1x2` | De-vig odds marché | Shin probabilities |
| 3 | `over55` | CMP sous-dispersé P(total ≥ 56) | Karlis 2026 (ν=1.3) |
| 4 | `under62` | CMP P(total ≤ 62) | Karlis 2026 |
| 5 | `handicap` | Skellam P(diff ≥ 5) | Karlis 2026 |
| 6 | `btts30` | Bivarié P(P1≥30) × P(P2≥30) | Krawczyk 2025 |
| 7 | `htLeader` | HT dominance + copula HT→FT | Karlis 2026 |
| 8 | `valueBet` | EV+ = P(model) - P(market) | Felice 2025 + de-vig |

### Métriques pondérées

- **Team Strength**: 35% (Felice 2025)
- **Goalkeeper Save %**: 20% (Daza 2017)
- **Fast-break Efficiency**: 15% (Krawczyk 2025)
- **6m Shooting Accuracy**: 15% (Krawczyk 2025)
- **7m Penalty Count**: 10% (Daza 2017)
- **H2H Record**: 5% (empirique)

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Phase 2.2 — Endpoint /api/handball/strategy-top8

**Fichier créé**: `src/app/api/handball/strategy-top8/route.ts`

### Contenu
- `createTtlCache("__handballStrategyCache")` — 5 min TTL
- GET → `?strat=<key|all>&win=<today|tomorrow|all>`
- Pipeline : fetchHandballFixtures + fetchHandballLive → computeHandballStrategyTop8
- Supporte `?strat=all` (8 stratégies) ou `?strat=bestTeam` (1 seule)

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Phase 2.3 — Hook use-handball-top8

**Fichier créé**: `src/hooks/use-handball-top8.ts`

### Contenu
- SWR sur `/api/handball/strategy-top8`
- Dedupe 5 min
- `matchesFor(key)` — accesseur par stratégie
- `{ data, error, isLoading, isReady, matchesFor }`

### Vérification
- `npx tsc --noEmit` : ✅ 0 erreurs

---

## Fichiers impactés (Phase 2)

| Fichier | Statut |
|---------|--------|
| `src/lib/handball-strategy-top8.ts` | **NOUVEAU** |
| `src/app/api/handball/strategy-top8/route.ts` | **NOUVEAU** |
| `src/hooks/use-handball-top8.ts` | **NOUVEAU** |

---

## Phase 2 ✅ TERMINÉE
- Moteur 8 stratégies (CMP/Skellam/de-vig) : ✅
- Endpoint strategy-top8 : ✅
- Hook SWR : ✅
- typecheck : 0 erreurs

## Prochaine tâche
Phase 3 : UI onglet principal (4 composants)
