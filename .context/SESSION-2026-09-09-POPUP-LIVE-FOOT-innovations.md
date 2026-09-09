# Rapport d'améliorations & innovations — Popup live Football
**Session : SESSION-2026-09-09-POPUP-LIVE-FOOT — 2026-09-09**

## 1. Design (charte Footmob claire)
- **Fait (T1)** : tokens `FOT` centralisés par composant (`#fff`/`#f0f0f0`/
  `#222`/`#717171`/`#1a1a1a`/`#bdbdbd`, accent `#00985f`) ; barres domicile
  foncées vs extérieur grises comme Footmob ; états vides lisibles.
- **Proposé** : extraire `FOT` dans `src/components/football/fotmob-theme.ts`
  partagé (1 source, 4 composants) ; badge `LIVE 61'` pulsant vert Footmob ;
  skeleton clair pendant `loading` (actuellement `Skeleton` thème sombre) ;
  mode daltonien optionnel (bleu/orange au lieu de noir/gris).

## 2. Fonctionnalités
- **Fait** : fallback estimé sans 503 ; courbe `estimated` badgée ; libellé
  de source des probas honnête.
- **Proposé** :
  - Timeline des buts interactive (cliquer un point ⚽ → score + buteur).
  - Toggle `xG cumulé` sur le momentum (données déjà là : `xgPerMinute`).
  - Cache `Match.espnEventId` : servir la résolution ESPN depuis la DB
    (1 requête scoreboard évitée par ouverture).
  - Bouton `Visionner en direct` : masquer quand aucun flux (état actuel :
    toujours affiché).
  - Alertes seuils : notifier quand `underdog_surge` se déclenche en live.

## 3. Nouveaux metrics
- **Fait (T4)** : rouges intégrés (Cerveny), calibration O2.5 (Clegg),
  `o05/o15` par équipe déjà calculés mais NON affichés.
- **Proposé** (données déjà disponibles, coût faible) :
  - Grille étendue : afficher `O3.5`, `U2.5`, `o05/o15` domicile/extérieur
    (calculés, jetés à l'affichage).
  - `Pression 10 min` chiffrée dans `LiveStatsBreakdown` (déjà dans donuts).
  - xG par tir (`xG/tirs`) = qualité des occasions — 1 ligne, 0 fetch.
  - `dangerous/90 projeté` : rythme d'attaques dangereuses extrapolé.
  - Backtest funnel : logger `FunnelHit[]` + résultat final → calibration
    des seuils (`LIVE_FUNNEL_THRESHOLDS`) sur données réelles.

## 4. Data & fiabilité
- **Fait (T2)** : mapping BSD→ESPN (34 ligues), matching KR tolérant,
  coercition numérique BSD.
- **Proposé** : table d'alias d'équipes KR/JP (`Team.alias`) pour fiabiliser
  `resolveESPNEvent` sans heuristique ; blend historique H/A dans le live
  (`blendWithHistorical` existe côté standings) ; monitor `estimated/total`
  par ligue → prioriser les ligues à enrichir.

## Priorisation suggérée
P1 : `fotmob-theme.ts` partagé + grille metrics étendue (afficher l'existant).
P2 : cache `espnEventId` + table alias KR/JP.
P3 : timeline buts interactive + alertes `underdog_surge` + backtest funnel.
