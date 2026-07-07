# PariScore — Plan de tâches détaillé · Redesign UI Tennis Prematch & Live

> **Date** : 2026-07-07
> **Auteur** : Chef de projet (agent ZCode)
> **Réf. Gantt** : `redesign-tennis/GANTT-REDESIGN-TENNIS.md`
> **Réf. design** : `redesign-tennis/DESIGN-DOC-REDESIGN-TENNIS.md`
> **Décision** : Hybride Dashboard-Carte (master-detail desktop + carte pédagogique mobile + toggle scan)

---

## Conventions de lecture

- **Priorité** : 🔴 Critique (chemin critique) · 🟠 Haute · 🟡 Moyenne · ⚪ Faible
- **Statut** : ⏳ À faire · 🟡 En cours · ✅ Fait · ⛔ Bloqué
- **Agent principal** : celui qui réalise (R dans la RACI)
- **Skills** : compétences invoquées via le tool `skill`

---

## PHASE 1 — Fondations backend + Design system (J+1 → J+3)

### 1.1 Serializer serveur `_serializeTennisCard(m)` 🔴
- **Objectif** : normaliser le payload tennis côté serveur AVANT envoi, pour que `mapMatch` (front, `pariscore.html:26581`) ne compense plus un backend instable.
- **Agent principal** : Backend Architect
- **Skills** : `agency-backend-architect`, `metier-ingenierie`
- **Entrées** : `server.js` (routes `/api/v1/tennis/value-bets`, `/live`), `buildTennisValueBets` (`server.js:38199`), `_buildTennisValueBetsCore` (`server.js:38896`).
- **Livrable** : fonction `_serializeTennisCard(m)` injectée dans les 2 routes principales.
- **Critère d'acceptation** : payload de test renvoie tous les champs canoniques (cf. 1.2), types garantis.
- **Estimation** : 1 j

### 1.2 Contrat data canonique + `mapMatch` allégé 🔴
- **Objectif** : définir le contrat canonique d'une carte tennis et alléger `mapMatch` (le front ne fait plus que transmettre).
- **Agent principal** : Backend Architect (R), Data Engineer (A)
- **Skills** : `agency-backend-architect`, `agency-database-optimizer`, `betting` (validation métier)
- **Contrat** (extrait) :
  ```jsonc
  {
    "id": "...", "tab": "prematch|live", "tour": "...", "tournament": "...",
    "surface": "...", "round": "...", "bestOf": 3,
    "commence_time": "ISO", "status": "...",
    "player1/2": { "id": "...", "name": "...", "flag": "...", "photo": "...",
                   "rank": 12, "elo_surface": 1842.5, "l5_pts": 4, "powerscore": 0.71 },
    "odds": { "p1": {"odds":1.85,"book":"Unibet"}, "p2": {...}, "stale": false, "age_ms": 12000 },
    "fair": { "p1": 0.62, "p2": 0.38, "margin": 0.04, "method": "shin" },
    "signal": { "label": "VALUE +6%", "side": "p1", "prob": 0.62, "ev_pct": 6.2,
                "confidence": "high", "stale": false }
  }
  ```
- **Règles de normalisation** : `prob` toujours 0-1 ; `predictions` toujours objet `{elo:{p1,p2}, blended:{p1,p2}}` ; `best_ev_model` toujours présent ou `null` ; `stale`/`age_ms` sur chaque cote.
- **Livrable** : doc de contrat `redesign-tennis/CONTRAT-DATA.md` + `mapMatch` simplifié.
- **Critère** : `mapMatch` ne contient plus de branches `typeof x === 'object'` défensive.
- **Estimation** : 1 j

### 1.3 Helper `valueBet(m)` unifié 🔴
- **Objectif** : supprimer la duplication de la logique value-bet (répétée dans `premierCard` `:25820-2528`, `liveCardCompact` `:26138-26146`, `topBets` `:25684-25696`, `prematchCard` `:25744-25754`).
- **Agent principal** : Data Scientist (R), Data Engineer (A)
- **Skills** : `betting` (Kelly/EV/edge), consultation interne data
- **Livrable** : helper `Scope.valueBet(m)` retournant `{label, side, prob, ev, ev_pct, tier, stale}` + tier = `min(tier_EV, tier_confiance)`.
- **Critère** : les 4 fonctions de rendu consomment le helper, zéro duplication.
- **Estimation** : 0,5 j

### 1.4 Design tokens + palette sémantique 🟠
- **Objectif** : créer les variables CSS du design system hybride.
- **Agent principal** : Webdesigner (R/A)
- **Skills** : `redesign-existing-projects` (lead), `ui-ux-pro-max` (palettes), `high-end-visual-design`
- **Livrable** : bloc CSS variables `.sc-*` (couleurs tier, spacing, radius, shadows, typography mono).
  - Palette : `#0B1120` fond · `#E2E8F0` texte · `#10B981` strong · `#F59E0B` moderate · `#64748B` neutral · `#EF4444` avoid · `#3B82F6` joueur 2.
- **Critère** : tokens documentés + appliqués à 1 carte de démo.
- **Estimation** : 0,5 j

### 1.5 Mini-store frontend + composant `<dialog>` natif 🔴
- **Objectif** : poser les fondations techniques du master-detail (state partagé liste↔détail) et de la modale Parier (dialog natif a11y). Sans cela, Phase 3 = dette a11y garantie (cf. vote frontend).
- **Agent principal** : Backend Architect (R), Webdesigner (C)
- **Skills** : `agency-backend-architect`, `frontend-design`
- **Livrable** :
  - `Scope.store` : mini store observable (`subscribe`/`emit`) pour `selectedMatchId`, `viewMode`, `filters`.
  - Composant `<dialog>` natif (HTML5) avec focus trap, Escape, scroll-lock, restore-focus.
- **Critère** : testable indépendamment (ouvrir/fermer dialog + notifier le store).
- **Estimation** : 1 j

### 🚪 Jalon J1 — Fondations validées
- **Vérification** : serializer + contrat + `valueBet` + tokens + store/dialog opérationnels.
- **Gate** : chef de projet + QA signent avant de lancer Phase 2.

---

## PHASE 2 — Composants UI (carte P2 + liste P1) (J+3 → J+7)

### 2.1 Carte P2 « Décision » (verdict + contexte + action) 🔴
- **Objectif** : réécrire `premierCard` (`:25811`) et `liveCard` (`:26066`) en carte verticale 3-zones.
- **Agent principal** : Webdesigner (R/A)
- **Skills** : `redesign-existing-projects` (lead), `high-end-visual-design`, `responsive-web-design`, `mobile-first-design`
- **Structure** : VERDICT (badge signal + joueur + EV% + verdict en mots) → CONTEXTE (proba vs implicite, fatigue, surface gap, chips marchés) → ACTION (bouton 🎯 Parier).
- **Livrable** : nouveau `Scope.decisionCard(m)` mobile-first.
- **Critère** : lisible en <1 s, zones tap ≥ 44 px, ARIA `aria-expanded` sur accordéons.
- **Estimation** : 1,5 j

### 2.2 Ligne P1 « Terminal » (verdict-list dense) 🟠
- **Objectif** : créer la vue liste dense pour le toggle "Scan rapide" (desktop grille + mobile fallback).
- **Agent principal** : Webdesigner (R)
- **Skills** : `redesign-existing-projects`, `design-taste-frontend`
- **Livrable** : `Scope.scanRow(m)` (ligne ~80 px, EV% 28 px à gauche, bordure tier 4 px, tap expand inline).
- **Critère** : 30+ matchs visibles desktop, contraste WCAG AA, bordure tier doublée d'un label texte (WCAG 1.4.1).
- **Estimation** : 1 j

### 2.3 Signal system (bordure tier + badges EV) 🟠
- **Objectif** : unifier le langage de signal (couleurs, icônes, pulse live).
- **Agent principal** : Webdesigner (R)
- **Skills** : `ui-ux-pro-max`, `high-end-visual-design`
- **Livrable** : classes `.sc-tier-strong|moderate|neutral|avoid` + `signalBadge` révisé + EV% typographie mono.
- **Critère** : distinction strong/moderate/avoid immédiate, pulse live sur `liveCard`.
- **Estimation** : 0,5 j

### 2.4 Chips marchés secondaires 🟡
- **Objectif** : valoriser Over/Under jeux (`set_ou`), Handicaps, `at_least_one_set` quand value ≥ 3 %.
- **Agent principal** : Webdesigner (R), Expert Paris (C)
- **Skills** : `redesign-existing-projects`, `betting`
- **Livrable** : composant `Scope.marketChips(m)` affiché dans la zone CONTEXTE.
- **Critère** : chip visible uniquement si `ev_pct ≥ 3`, label lisible par un récréatif.
- **Estimation** : 0,5 j

### 2.5 KPI bar (Edge / Value bets / Live / ROI) 🟡
- **Objectif** : remplacer les KPIs actuels (`tn2-kpi-live/bets/top/tournaments`, `pariscore.html:15876-15897`) par les 4 KPIs signal.
- **Agent principal** : Webdesigner (R)
- **Skills** : `redesign-existing-projects`, `chart-visualization` (mini deltas)
- **Livrable** : KPI bar sticky avec Edge moyen / Nb value bets strong / Live actifs / ROI Kelly cumulé.
- **Critère** : mis à jour par `tn2UpdateKPI` révisé.
- **Estimation** : 0,5 j

### 2.6 Toggle « Scan rapide » mobile 🟡
- **Objectif** : permettre la bascule carte P2 ↔ liste P1 sur mobile.
- **Agent principal** : Webdesigner (R)
- **Skills** : `responsive-web-design`, `mobile-touch`
- **Livrable** : segmented control en haut de liste (`scope.setView('card'|'scan')`).
- **Critère** : préférence persistée dans `ps_tennis_prefs`.
- **Estimation** : 0,5 j

### 🚪 Jalon J2 — Composants validés
- **Gate** : QA visuelle mobile + desktop, validation a11y sur carte et ligne.

---

## PHASE 3 — Master-detail desktop + Modale Parier + Live pulse (J+7 → J+11)

### 3.1 Master-detail desktop (split 40/60) 🔴
- **Objectif** : layout desktop avec liste persistante à gauche + panneau détail (carte P2) à droite. Le match reste visible pendant l'analyse.
- **Agent principal** : Webdesigner (R), Backend Architect (A)
- **Skills** : `redesign-existing-projects` (lead), `frontend-design`, `responsive-web-design`
- **Dépendance** : 1.5 (mini-store + dialog), 2.1 (carte P2).
- **Livrable** : layout `.sc-master-detail` desktop ≥ 1024 px, bascule auto vers carte simple < 1024 px.
- **Critère** : sélection d'un match met à jour le panneau via le store, pas de modale.
- **Estimation** : 2 j

### 3.2 Modale « Parier » (câble `/odds-comparison/:matchId`) 🔴
- **Objectif** : activer la route dormante (`server.js:41390`) via une modale de comparaison multi-bookmaker.
- **Agent principal** : Webdesigner (R), Backend Architect (A)
- **Skills** : `redesign-existing-projects`, `agency-api-tester` (validation route), `betting` (Kelly optionnel)
- **Comportement** : lazy au tap, timeout 6 s, retry 1× après 3 s, message "Préparation des cotes" si 404. Classement books par edge desc, best book surligné, deeplink, mise Kelly optionnelle.
- **Livrable** : `Scope.betModal(matchId)` + intégration `<dialog>` natif.
- **Critère** : route `/odds-comparison` consommée, 0 console.error sur timeout.
- **Estimation** : 1,5 j

### 3.3 Live pulse (BPPI / momentum / DR-divergent) 🟠
- **Objectif** : faire pulser la carte live sur les signaux déclencheurs.
- **Agent principal** : Webdesigner (R), Data Scientist (C)
- **Skills** : `css-animations`, `high-end-visual-design`
- **Déclencheurs** : BPPI critique, `momentum_shift`, DR divergent du score ("le score ment").
- **Livrable** : classes `.sc-pulse-break|momentum|drift` + labels "BREAK POINT", "MOMENTUM X", "score ment".
- **Critère** : pulse visible sans être agressif, respect `prefers-reduced-motion`.
- **Estimation** : 0,5 j

### 3.4 Stratégies P3 (câble `/strategies/:matchId`) 🟡
- **Objectif** : activer la route dormante (`server.js:41289`) dans la couche P3 (panneau détail / accordéon 2).
- **Agent principal** : Webdesigner (R), Data Scientist (C)
- **Skills** : `redesign-existing-projects`, `betting`
- **Livrable** : 5 jauges consensus (momentum/surface/form/fatigue/confidence) dans le panneau détail.
- **Critère** : bouton "Stratégies" non-plus placeholder, fetch lazy au tap.
- **Estimation** : 1 j

### 3.5 Pills pièges (trap_bet / drift / fatigue / surface Elo faible) 🟡
- **Objectif** : avertir le parieur sans détruire le signal fort.
- **Agent principal** : Webdesigner (R), Expert Paris (C)
- **Skills** : `redesign-existing-projects`, `betting`
- **Livrable** : pills ⚠ discrets en coin de carte, jamais bandeau rouge.
- **Critère** : visibles si `trap_bet=true` ou `odds.age_ms > 10 min` ou `fatigue.gamesLast14Days > 12`.
- **Estimation** : 0,5 j

### 3.6 Mode Pro dépliable 🟡
- **Objectif** : exposer la stack pro (proba brute, méthode WElo/blended, set_probs, DR per set, BPPI live, WOM Betfair, dropping odds) pour les pros sans polluer le signal.
- **Agent principal** : Webdesigner (R), Data Scientist (C)
- **Skills** : `redesign-existing-projects`, `betting`, `chart-visualization`
- **Livrable** : couche P4 repliable dans le panneau détail (desktop) / accordéon profond (mobile).
- **Critère** : caché par défaut, dépliable via bouton "Pro".
- **Estimation** : 0,5 j

### 🚪 Jalon J3 — Dashboard validé
- **Gate** : test des 3 personas (récréatif mobile, régulier desktop, pro) sur parcours type.

---

## PHASE 4 — Refactor dette + Câblage + QA (J+11 → J+14)

### 4.1 Purge `OLD_TENNIS_DEPRECATED` (20 blocs) 🟠
- **Objectif** : supprimer le CSS mort (`grep "OLD_TENNIS_DEPRECATED"` → 20 blocs).
- **Agent principal** : Data Engineer (R), Code Reviewer (A)
- **Skills** : `metier-ingenierie`, `agency-code-reviewer`, `caveman-review`
- **⚠️ Note** : `.tn2-*` est ACTIF (KPI bar, modales) — NE PAS purger. Seul `OLD_TENNIS_DEPRECATED` est mort.
- **Livrable** : diff CSS (-~22 blocs), screenshot diff avant/après.
- **Critère** : zéro régression visuelle, `node --check` passe.
- **Estimation** : 0,5 j

### 4.2 Refactor `liveCardCompact` (214 → ~90 lignes) 🟠
- **Objectif** : extraire les renderers P3 (`_duel`, `scoutProfile`, `h2hBlock`, `topBets`, `drChart`) en helpers lazy-load.
- **Agent principal** : Webdesigner (R), Code Reviewer (A)
- **Skills** : `redesign-existing-projects`, `agency-code-reviewer`, `caveman-review`
- **Livrable** : `liveCard` ~90 lignes (P1+P2), renderers P3 séparés chargés au tap.
- **Critère** : screenshot diff identique, lazy-load vérifié.
- **Estimation** : 1 j

### 4.3 Unification favoris 🟡
- **Objectif** : `ps_tennis_favs` (localStorage) devient source unique ; `m.favorite` dérivé au rendu.
- **Agent principal** : Data Engineer (R)
- **Skills** : `metier-ingenierie`
- **Livrable** : suppression de la lecture de `.favorite` côté payload.
- **Critère** : favoris cohérents entre master-detail et carte.
- **Estimation** : 0,5 j

### 4.4 Retrait `_auditLivePayload` + endpoint `/coverage` 🟡
- **Objectif** : remplacer le diagnostic en prod (`console.warn`, `pariscore.html:26745`) par un endpoint admin structuré.
- **Agent principal** : Backend Architect (R)
- **Skills** : `agency-backend-architect`, `metier-securite-sre`, `agency-sre`
- **Livrable** : `GET /api/v1/tennis/coverage` (admin-only) + logs structurés JSON.
- **Critère** : zéro `console.warn` de diagnostic dans la prod.
- **Estimation** : 0,5 j

### 4.5 Polling adaptatif 🟡
- **Objectif** : passer le polling de 60 s fixe à 20 s live / 90 s prematch.
- **Agent principal** : Backend Architect (R)
- **Skills** : `agency-backend-architect`, `nodejs-backend-patterns`
- **Livrable** : `TennisScope.startAutoRefresh` modifié (intervalle dynamique selon `isLive`).
- **Critère** : latence "live value" réduite sans surcharge serveur.
- **Estimation** : 0,5 j

### 4.6 QA finale (Playwright + a11y) 🔴
- **Objectif** : validation bout-en-bout sur les 3 personas + audit a11y.
- **Agent principal** : Reality Checker (R/A)
- **Skills** : `metier-audit-qa` (lead), `agency-reality-checker`, `agency-api-tester`, `playwright-mcp`, `web-quality-audit`
- **Parcours** :
  1. Récréatif mobile : ouvre prematch → carte P2 → bouton Parier.
  2. Régulier desktop : scan liste → sélectionne match → panneau détail → modale.
  3. Pro : mode Pro dépliable → stratégies → odds-comparison.
  4. Live : pulse BPPI/momentum/DR, polling adaptatif.
- **Livrable** : rapport QA avec captures, checklist WCAG, validation contrat data.
- **Critère** : 0 bloquant, ⚠ mineurs < 5, GO conditionnel documenté.
- **Estimation** : 1 j

### 4.7 Rapport de fin de mission ⚪
- **Objectif** : clôturer le chantier.
- **Agent principal** : Chef de projet
- **Livrable** : `redesign-tennis/RAPPORT-FIN-MISSION-REDESIGN-TENNIS.md` (à partir du template).
- **Estimation** : 0,25 j

---

## Synthèse d'affectation

> Charges alignées sur la matrice RACI du Gantt (§4). Ventilation fine par rôle.

| Rôle | Agent / skill lead | Tâches | Charge |
|---|---|---|---|
| Webdesigner | `redesign-existing-projects`, `ui-ux-pro-max`, `high-end-visual-design`, `frontend-design` | 1.4, 2.1-2.6, 3.1-3.6, 4.2 | ~6,5 j |
| Backend Architect | `agency-backend-architect`, `metier-ingenierie` | 1.1, 1.2, 1.5, 3.1(A), 3.2(A), 4.4, 4.5 | ~3,5 j |
| Data Engineer | `agency-backend-architect`, `agency-database-optimizer` | 1.2(A), 4.1, 4.3 + co-réa 1.5, 3.1 | ~4 j |
| Data Scientist | consultation interne + `betting` | 1.3, 2.4(C), 3.3(C), 3.4(C), 3.5(C), 3.6(C) | ~1,5 j |
| Expert Paris | `betting`, `tennis-data` | consult 2.4, 3.2, 3.5 + parcours QA | ~1,5 j |
| QA / Reality Checker | `metier-audit-qa`, `agency-reality-checker`, `agency-api-tester`, `playwright-mcp` | 4.6, validation jalons J1/J2/J3 | ~2 j |
| Chef de projet | ZCode | orchestration, jalons, rapports | ~1 j |
| **Total** | | | **~20 j-h** |

---

*Plan détaillé — découpage des tâches du Gantt. Chaque tâche = 1 ticket beads. Dernière MAJ : 2026-07-07.*
