# Audit de Bugs et Tâches de Développement Football & Tennis (Sidebar & Match Details)

## Phase 0: Audit et Diagnostic
- [x] Cartographié le flux d'événement de clic et le re-render via inspection du code.
- [x] Inspecté les événements de clic dans `src/components/layout/sports-sidebar.tsx` (MatchRow component).
- [x] Validé la mise à jour de l'état dans le store Zustand `useSportsSidebarStore`.
- [x] Diagnostiqué la chaîne d'ouverture des détails via l'événement personnalisé `open-match-detail`.
- [x] Vérifié que `src/app/page.tsx` écoute l'événement `open-match-detail` et ouvre le dialog de détails approprié.
- [x] Identifié le problème football : le clic sur le nom du match dans la sidebar ne déclenchait que `toggleSelection` (mise à jour de la sélection pour le filtrage) mais pas `openDetail` (ouverture des détails du match).
- [x] Identifié le problème tennis : la sidebar ne affichait que les matchs prématch (via `/api/tennis/prematch`) mais pas les matchs en direct, contrairement à l'onglet tennis principal qui affiche les deux via `useLiveMatches` et `usePrematchMatches`.
- [x] Identifié un problème supplémentaire de filtrage dans la fonction `tennisToRaw` où certains matchs étaient incorrectement filtrés en raison de vérifications insuffisantes sur la présence et la validité des noms de joueurs.

## Phase 1: Correction du Bug
- [x] Implémenté le correctif football dans `src/components/layout/sports-sidebar.tsx` : modifié le gestionnaire de clic du nom du match dans le composant `MatchRow` pour appeler à la fois `toggleSelection(match.id)` et `openDetail()`.
- [x] Implémenté le correctif tennis dans `src/hooks/use-sports-tree.ts` : modifié la fonction `loadTennis()` pour récupérer à la fois les matchs en direct (`/api/tennis/live`) et les matchs prématch (`/api/tennis/prematch`), les combiner, puis les traiter avec `tennisToRaw` et `groupRawMatches`.
- [x] Implémenté un correctif supplémentaire dans `src/lib/sports-tree.ts` : renforcé la fonction `tennisToRaw` pour utiliser des vérifications plus robustes sur la présence et la validité des noms de joueurs (`playerA.name` et `playerB.name`), en vérifiant explicitement qu'ils ne sont ni null, ni undefined, ni des chaînes vides.
- [x] Validé la syntaxe des trois correctifs (aucune erreur de syntaxe détectée).
- [x] Optimiser la gestion des états de chargement (Skeleton) et d'erreur dans le panneau de détails (à faire après validation du correctif principal).

## Phase 2: Tests et Validation
- [ ] Exécuter des tests de validation manuelle pour toutes les ligues et sports (football, tennis, etc.).
- [ ] Valider que les correctifs ne créent pas de régressions.
- [ ] Lancer les tests TypeScript : `npx tsc --noEmit`.

## Phase 3: Déploiement
- [ ] Commit Git & Déploiement VPS : `npm run deploy:vps`.