# CS2_QA_REPORT — Recette Refonte Expérience CS2 (HLTV + Moteur Prédictif)

**Date** : 2026-08-12
**Phase** : 2. QA Visual & Data Test (boucle 5 phases)
**Scope** : Calendrier HLTV, Feuille de match, Map Pool 3-6M, Moteur prédictif ML

---

## 1. Périmètre livré

| Livrable | Fichier | Statut |
|---|---|---|
| Moteur prédictif scientifique | `src/lib/prediction/cs2/cs2-predictive-ml-engine.ts` | ✅ |
| Adaptateur enrichissement→moteur | `src/lib/cs2/predict-adapter.ts` | ✅ |
| Types partagés + helpers | `src/lib/cs2/types.ts` | ✅ |
| Hook enrichissement SWR | `src/hooks/use-cs2-enrichment.ts` | ✅ |
| Route enrich / veto | `src/app/api/cs2/enrich/route.ts`, `src/app/api/cs2/veto/[id]/route.ts` | ✅ |
| Calendrier HLTV | `src/components/cs2/HLTVMatchSchedule.tsx` | ✅ |
| Feuille de match | `src/components/cs2/HLTVMatchSheetModal.tsx` | ✅ |
| Map Pool & H2H | `src/components/cs2/CS2MapPoolAnalytics.tsx` | ✅ |
| Intégration onglet | `src/components/cs2/cs2-tab-content.tsx` | ✅ |
| Détail H2H (maps + scores) | `services/cs2Service.js` (`buildH2H` → champ `detail`) | ✅ |

## 2. Vérification statique (automatisée)

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (fichiers CS2) | ✅ 0 erreur — les erreurs restantes du repo sont pré-existantes (tennis/football/tmp-rss), hors périmètre |
| `npx eslint` (fichiers CS2) | ✅ 0 erreur / 0 warning |
| `bun test` moteur | ✅ 15 pass / 0 fail |
| `node --check services/cs2Service.js` | ✅ syntaxe OK |

## 3. Étanchéité des données (contrôle anti-valeurs fictives)

- **Aucune donnée inventée** : tous les chiffres proviennent de `cs2Service.js` (BSD + csapi.de + fichiers HLTV locaux). Le moteur ne fait que **simuler** sur des inputs réels.
- **Cas limite « 0 match joué sur une map »** : `CS2MapPoolAnalytics` saute la ligne (aucun `NaN`) ; message explicite si aucune des 7 cartes n'a de données. `mapWinProb` retombe sur l'ELO quand le winrate est absent. ✅
- **Projection clairement étiquetée** : le breakdown MR12 round-par-round est marqué *« Monte-Carlo, 1 déroulement type »* — il ne prétend pas être le déroulé réel (donnée non exposée par l'API, conformément à la décision « Inférer + Monte-Carlo »).
- **Veto** : séquence réelle BSD si disponible (étiquetée « réelle »), sinon simulation rationnelle étiquetée « simulation ». Aucune ambiguïté.
- **Rôles joueurs** : label *Star / Rifler / Support* dérivé du rating (heuristique documentée), pas un champ source inexistant.

## 4. Marchés prédictifs (contrôle d'affichage)

- Vainqueur match : barre T1/T2 + `%` arrondis (`pct()`). ✅
- Vainqueur par map (3 cartes du BO3) : barres + `%`. ✅
- Over/Under rounds : ligne standard + signal `OVER/UNDER` seulement si confiance ≥ 65 %, sinon « — ». ✅
- Handicap rounds (map la plus probable) + Handicap maps (`-1.5 maps`). ✅
- **Aucune décimale flottante non formatée** : tout passe par `pct()` (arrondi entier) ou `toFixed(n)`. ✅

## 5. Bugs détectés et corrigés durant la review (Phase 3)

| # | Bug | Fix |
|---|---|---|
| R1 | `Map` (icône lucide) masquait `new Map()` → erreur TS « Only a void function can be called with new » | alias `Map as MapIcon` |
| R2 | Commentaire de section soudé à la signature `overUnderSignal` (syntaxe cassée) | newline restauré |
| R3 | `pool` mort + cast `never` dans `vetoSteps` | supprimé, passage direct du pool actif |
| R4 | `Star` importé inutilisé | supprimé |
| R5 | Veto réel BSD fetché mais jamais rendu | ajout `normalizeRealVeto` + rendu prioritaire |
| R6 | Directives `eslint-disable` inutiles (no-var-requires inactif) | supprimées |
| R7 | `Cs2H2H` sans détail maps/scores | ajout champ `detail` (orienté k1/k2) côté service |

## 6. Points d'attention / limites connues

1. **Granularité round-by-round** : la donnée réelle (élimination/bombe/explosion par round) n'existe pas dans le pipeline BSD/csapi.de — remplacée par la projection Monte-Carlo, honnêtement labellisée.
2. **Cache `/api/cs2/enrich` mono-slot** : correct (pas de fuite inter-duels via la clé `key`), mais un seul duel en cache à la fois — acceptable à faible concurrence.
3. **Taille d'échantillon par carte** non exposée par l'enrichissement → prior conservateur `DEFAULT_MAP_SAMPLE = 6` documenté dans `predict-adapter.ts`.
4. **Veto réel BSD** dépend de `map_picks` présent sur le détail match ; sinon repli simulation (non bloquant).
5. **Rendu visuel mobile/desktop** : vérifié statiquement (responsive Tailwind, `hidden sm:flex`/`lg:inline-flex`). **Recette visuelle navigateur à faire** (Playwright MCP) une fois le dev server lancé — non exécutée ici (server non démarré).

## 7. Verdict

**APPROUVÉ (statique) — prêt pour validation visuelle + déploiement.**
Tous les critères de clôture data/typage/tests sont remplis. La recette visuelle navigateur et le pipeline de déploiement constituent les étapes restantes.
