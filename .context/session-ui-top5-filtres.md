# Session UI top5 filtres — correction layout

## Contexte

Widgets **Top 5 matchs** (foot & tennis) affichaient les filtres temporels (Jour / 48h / Semaine + L5 / L10) **collés au bord droit** de la sidebar (~19rem), avec une typographie `text-[9px] font-mono uppercase` illisible.

## Décision d'ingénierie

Suppression de `justify-between` sur la rangée wrapper + augmentation de la taille de police pour atteindre la lisibilité minimale (10px). Les filtres restent dans la même structure DOM mais ne sont plus forcés à l'extrême droite ; ils s'alignent naturellement à gauche.

### Football (`football-strategy-top5-widget.tsx`)
- `flex items-center justify-between pr-2.5` → `flex items-center pr-2.5`
- Boutons `text-[9px]` → `text-[10px]` ; `px-1.5 py-px` → `px-2 py-0.5`

### Tennis (`tennis-strategy-top5-widget.tsx`)
- Même changement de classe wrapper
- Boutons `text-[9px]` → `text-[10px]` ; `px-1.5 py-px` → `px-2 py-0.5`

## Résultat visuel

| Avant | Après |
|---|---|
| Titre + filtres groupés collés à droite, boutons 9px | Titre seul sur sa ligne, filtres sur rangée dédiée dessous, boutons 10px, espacement confortable |
| Sidebar ~19rem, texte illisible au bord | Texte lisible, marge intérieure, pas de débordement |

## Trace

- **Fichiers modifiés** : `src/components/football/football-strategy-top5-widget.tsx`, `src/components/tennis/tennis-strategy-top5-widget.tsx`
- **Gates** : `bun run lint` ⇐ 0 erreur nouvelle ; `bun run typecheck` ⇐ erreurs préexistantes uniquement
- **Débloyage** : lancer `bun run dev` → onglet Football / Tennis → bandeau « Backtest » → vérifier que les filtres sont visibles et non écrassés contre le bord