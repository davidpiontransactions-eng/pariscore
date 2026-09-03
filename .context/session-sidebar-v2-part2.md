# Session: Sidebar v2 — Part 2 (2026-08-28 evening)

## Résumé
Activation des funnel stat sliders (P2) en enrichissant `TreeMatchSummary` avec les stats live BSD.

## Fichiers modifiés

| Fichier | Changements |
|---------|-------------|
| `src/types/sports-sidebar.ts` | `TreeMatchSummary` + `liveMinute`, `pressure`, `homeXg`, `awayXg`, `homeDangerous`, `awayDangerous`, `homeSOT`, `awaySOT` |
| `src/lib/sports-tree.ts` | `RawTreeMatch` étendu, `MinimalFootballMatch` aligné sur `FootballLiveState`, `footballToRaw()` extrait stats live, `groupRawMatches()` propage vers `TreeMatchSummary` |
| `src/components/layout/sports-sidebar.tsx` | Filtre funnel activé (décommenté), import `matchPassesStatFilters` rétabli |

## Commit
`645570db` — feat(sidebar): enrich TreeMatchSummary with live stats for funnel sliders (P2)

## Quality Gates
- **Lint**: 0 nouvelles erreurs (3 préexistantes basketball)
- **Typecheck**: 0 nouvelles erreurs (toutes préexistantes tennis-ml, top5-backtest, tests, tools, skyvern)

## Fonctionnel maintenant
Les 4 sliders dans le panel "Stat Filters" (icône Filter sous TimePills) filtrent en temps réel :
- **Pressure** 0-100% (dérivé possession BSD)
- **Dangerous Attacks** 0-50 (somme home+away)
- **xG** 0-5 (max home/away)
- **Shots on Target** 0-30 (somme home+away)

## Prochaines étapes (pour demain)
1. **i18n** : remplacer "My Teams", "Picks", "Follow teams to see them here" par clés `t("...")`
2. **Tests Playwright** : screenshots 375/768/1280, vérif roving, motion, sliders, sparkline
3. **bd dolt push** : synchroniser les beads (échec timeout ce soir)
4. **Optionnel** : MomentumSparkline avec vraies données `momentum` BSD au lieu du proxy `edgePct*10`

## Beads fermés
- ✅ ParisScorebis-krse (P0 hero blur + FilterTree counts)
- ✅ ParisScorebis-4l5s (P2 enrich TreeMatchSummary live stats)

## État git
Branche `main` à jour, working tree clean.