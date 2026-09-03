# Session : Popup Live Foot — Contrainte Viewport + Disclosure Académique

**Date** : 2026-08-26
**Bead** : ParisScorebis-av23 — `fix(football): popup Live contraint viewport + disclosure académique`

---

## Objectif

Corriger le popup "Live foot" (`football-match-detail-dialog.tsx`) qui déborde du viewport : ajouter contrainte `90dvh` + scroll interne + progressive disclosure (OODA) + échelle y momentum + tooltips transparence.

---

## Recherche académique synthétisée

### Sources primaires (peer-reviewed)

1. **Pu et al. 2024** — Systematic Review OODA (`IEEE/CAA J. Autom. Sinica 11(1):37-57`, doi:10.1109/JAS.2023.123807, 154 réf.) — Taxonomie observation-orientation-décision-action pour dashboards foot interactifs.
2. **Meander 2026** — Umeå Master Thesis, UCD Sportswik (`umu.diva-portal.org`, diva2:2068419) — 4 guidelines G1-G4, SUS 88.75 : G1 workflow integration, G2 cognitive simplicity, G3 progressive disclosure, G4 transparency.
3. **Benito Santos et al. 2018** — Visual Performance Analysis (`Front. Psychol. 9:2416`, PMC6290627) — Prototype géospatial, charge cognitive réduite par coordination spatial+temporel.
4. **Goes et al. 2021** — Unlocking Big Data for Tactical Analysis (`Eur. J. Sport Sci. 21(4):481-496`) — Donnée brute sans visu adaptée n'augmente pas la performance.

### Sources industrielles académiquement dérivées

5. **Opta Analyst — What is Match Momentum?** (Whitmore 2021) — Momentum = différence possession values max/min, cap 0-0.1, lissée sur 3-4'.
6. **InPlayGuru — Momentum Guide** — Recalcul 10' glissantes, fading visuel, badges dominance `H+27▲`.
7. **Sportmonks Pressure Index** — 1 valeur/min/pondérée attacks/dangerous/possession/shots.

### Convergences exploitables

- **Progressive disclosure > affichage total** — G3 + OODA : L1 glanceable → L2/L3 à la demande
- **Familiar charts + hiérarchie** — G2 : bar/line > radar exotique
- **Fenêtre 10' glissante** — InPlayGuru + Opta : aligné avec notre `momentum-chart.tsx`
- **Pression ≠ xG** — complémentarité à expliciter via tooltips (G4)

---

## Implémentation

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/components/football/football-match-detail-dialog.tsx` | `DialogContent max-h-[90dvh] w-[95vw] max-w-2xl overflow-hidden p-0 gap-0` + `DialogHeader sticky top-0 z-10` + `ScrollArea max-h-[calc(90dvh-80px)]` |
| `src/components/football/pressure-duo-donuts.tsx` | Ajout `title` tooltip définition pondération (attacks 0.35, dangerous 0.40, possession 0.15, tirs 0.10, 10' glissantes) |
| `src/components/football/momentum-chart.tsx` | Ajout axe Y `-100..+100` (5 ticks SVG text) pour transparence échelle |

### Architecture OODA (L1-L2-L3)

- **L1 Observation** — `DialogHeader` sticky (league logo + score + minute), hauteur fixe ~80px
- **L2 Orientation** — Contenu scrollable : EditorialInsight + PressReview + AIMatchReport + Score + WatchButton
- **L3 Décision** — Suite scroll : MomentumChart (110px + y-axis) + PressureDuoDonuts (80px donuts) + LiveStatsBreakdown (~350px)

---

## Vérification

- [x] `ScrollArea` import ajouté
- [x] `DialogContent` contraint `90dvh` + `overflow-hidden`
- [x] `DialogHeader` sticky `top-0 z-10 border-b`
- [x] `ScrollArea` wrapper avec `max-h-[calc(90dvh-80px)]`
- [x] MomentumChart axe Y `-100..+100`
- [x] PressureDuoDonuts tooltip transparence
- [x] Lint : 0 erreurs dans les fichiers modifiés (3 erreurs préexistantes basketball)
- [x] Typecheck : 0 erreurs dans les fichiers modifiés (erreurs préexistantes tools/skyvern)

---

## Prochaines étapes

1. **Vérification visuelle** — Ouvrir un match live en dev, confirmer scroll clavier + hauteur <90vh
2. **QA Playwright** — Screenshot 3 viewports (375/768/1280px)
3. **Legacy scope** — Si demandé : `pariscore.html:5271` ajuster `92vh → 90dvh`
4. **Fermeture bead** — `bd close ParisScorebis-av23 && bd dolt push`
