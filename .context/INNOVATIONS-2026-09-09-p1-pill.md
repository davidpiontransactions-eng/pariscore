# Rapport améliorations & innovations — P1 + pill Top Stratégie
**SESSION-2026-09-09-CAL-FILTRES-H T5 · 2026-09-09 · Fonctionnel / Graphique / Ergonomie / Datas / Visibilité**

## 1. Fonctionnel
- **Fait** : jointure calendrier↔Top10 (id normalisé + repli noms), toggle ★ Top filtrant, 1 fetch SWR partagé (0 requête extra), pas de tag sur live (Top10 = prematch seul).
- **Proposé** :
  - F2 : `?h=&date=&top=` en URL + relu au mount (deep-link, pattern Top10 `?strat=` existant). S.
  - F5b : clic pill → scroll/highlight vers la ligne Top10 correspondante (au lieu du dialog). S.
  - F6 : tri "Top d'abord" dans le calendrier (option, matchs à pill en tête de section). XS.
  - F7 : pastille live "Top en cours" quand un match tagué passe live (bridge prematch→live). M.

## 2. Graphique
- **Fait** : pastille verte `#00985f`/blanc + valeur mono, `+n` en `#007a4c` sur `#00985f1a` (contraste G5), emojis stratégie (mêmes que Top10).
- **Proposé** :
  - G6 : pastille large (desktop ≥1024px) avec cote + source (`forme`/`cotes`) ; compacte sur mobile (déjà fait). S.
  - G7 : section "★ Top du jour" épinglée en tête du calendrier (comme "Suivis"). S.
  - G3/G4 (rappel) : momentum + prématch → FOT.

## 3. Ergonomie
- **Fait** : segmented 1 tap (vs 2 au select), clic actif = reset, `aria-pressed`/`aria-label` FR, chip résumé `aria-live`.
- **Proposé** :
  - E3 : `aria-live` compteur + état vide explicite ("Aucun match ★ Top dans les 2h"). XS.
  - E5 : `Esc` réinitialise les filtres. XS.
  - E6 : sticky filter-bar au scroll. XS.

## 4. Datas
- **Fait** : index `byId`+`byNames` construit côté client depuis le payload Top10 (0 fetch, 0 DB).
- **Proposé** :
  - D6 : servir la corrélation depuis l'API calendar (`topTags` embarqués par match, jointure serveur sur ids BSD bruts → 0 heuristique client). M.
  - D2/D1 (rappel) : alias KR/JP en DB, monitor `estimated/total` par ligue.

## 5. Visibilité
- **Fait** : pill visible bureau + mobile (sous les noms, hors grille), toggle ★ Top avec compteur, chip résumé persistant.
- **Proposé** :
  - V2 : badge `LIVE n'` pulsant (rappel). XS.
  - V5 : dot sur l'onglet calendrier quand ≥1 match ★ Top le jour. XS.
  - V6 : push/notif quand un match ★ Top démarre dans 15min (web-push existe). M.

## Priorisation
P1 : F2 + E3 + G7. P2 : D6 + F6 + V5. P3 : F5b + F7 + V6 + G6.
