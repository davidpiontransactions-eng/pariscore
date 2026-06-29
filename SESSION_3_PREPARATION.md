# Session 3 — Atelier Feature Engineering : Kit de Préparation

**Objet :** Remobiliser le Data Scientist et le Parieur Pro pour trancher les 6 métriques en désaccord et débloquer le Sprint 1.

**Constat :** La Session 1 (Kickoff) a produit une priorisation claire, mais la Session 2 (Data Dive) n'a pas eu lieu. Nous sommes donc en mode **S2+S3 fusionnées** : le Data Scientist apporte une validation rapide sur données (même partielles), le Parieur Pro challenge terrain, et on tranche ensemble.

---

## 1. Où en sommes-nous exactement ?

```
Plan initial :                    Réalité :
  S1 — Kickoff        ✅            S1 — Kickoff        ✅
  S2 — Data Dive      ⏳            S2 — Pas de data    ❌
  S3 — Feature Eng    ❌            S3 — Bloqué         🔴
  S4 — Stratégies     ❌            S4 — Pas commencé   ❌
  S5 — Specs Eng      ❌            S5 — Pas commencé   ❌

Conséquence : 6 métriques en désaccord non arbitrées → périmètre Sprint 1 indéfini
```

### Ce qui est déjà acté (non négociable)

| Métrique | Priorité | Statut |
|----------|----------|--------|
| SRV_PTS_WON_S | Sprint 1 — MVP | ✅ Accord total |
| RET_PTS_WON_S | Sprint 1 — MVP | ✅ Accord total |
| H2H_SURFACE_AUG | Sprint 1 | ✅ Accord total |
| AGE.30 | Sprint 1 — gratuit | ✅ Coût nul, garder |
| PRESSURE_INDEX | Sprint 2 | ✅ Reporté S2 (scraping) |
| BP_CONV + BP_SAVED | Sprint 2 si validé | ✅ Reporté S2 |
| WINNING_DERIV | Sprint 2 si validé | ⚠️ À arbitrer |
| SERVE_DECAY | Sprint 2 — conditionnel | ⚠️ À arbitrer |

### Les 3 angles morts Sprint 1 (aussi à valider)

| Facteur | Edge | Capture technique | Statut |
|---------|------|-------------------|--------|
| MOTIVATION | 8/10 | Dernière perf + statut tournoi | À valider |
| FATIGUE | 8/10 | Distance géo + jours de repos | À valider |
| PUBLIC | 5/10 | Nationalité ≠ pays | À valider |

---

## 2. Pré-work pour chaque participant

### À faire par le Data Scientist (AVANT la session — 2h)

L'objectif n'est pas une validation exhaustive (pas de données réelles), mais des **simulations sur les données Kaggle Dryja** disponibles pour éclairer les décisions :

```
1. SRV_PTS_WON_S → Tester 4 fenêtres EWMA (3, 5, 8, 15 matchs)
   → Apporter : courbe accuracy par fenêtre + recommandation

2. RET_PTS_WON_S → Symétrique
   → Apporter : idem

3. H2H_SURFACE → Tester 3 fenêtres temporelles (1 an, 2 ans, illimité)
   → Apporter : N échantillons par fenêtre + accuracy

4. Matrice de corrélation : Toutes les métriques candidates (20)
   → Apporter : heatmap + paires corrélées > 0.7

5. WINNING_DERIV → Test de look-ahead bias
   → Apporter : analyse de risque + proposition de garde-fou
```

**Livrable :** Un notebook (ou slide deck) de 5 slides max, un point par métrique. Pas de perfection — des tendances.

### À faire par le Parieur Pro (AVANT la session — 1h)

```
1. Pour chaque métrique en désaccord (6) :
   - Quel est LE match récent qui prouve que cette métrique marche ou ne marche pas ?
   - Dans quelle condition cette métrique serait-elle utile ?
   - Quel est le seuil à partir duquel elle devient actionable ?

2. Apporter 3 scénarios de paris réels (gagnés ou perdus) où ces métriques
   auraient fait la différence.

3. Réfléchir aux 3 angles morts (Motivation, Fatigue, Public) :
   - Les utiliseriez-vous déjà en l'état, ou faut-il les enrichir ?
   - Quel poids approximatif leur donner dans une décision de pari ?
```

**Livrable :** 1 page A4 ou un message vocal de 5 minutes — l'instinct du métier, pas de la théorie.

### À faire par l'Expert Documentaire (= nous, avant la session)

Ce document-ci sert de préparation. Il sera distribué aux participants 48h avant la session.

---

## 3. Agenda proposé — Session 3 (2h30)

```
┌─────────────────────────────────────────────────────────────────┐
│ SESSION 3 — ATELIER FEATURE ENGINEERING                        │
│ Durée : 2h30 | Participants : DS + Parieur + Expert Doc        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 0:00 — 0:10  CONTEXTE (10 min)                                 │
│   • Où on en est : le constat d'arrêt                           │
│   • Ce qui est déjà décidé (non négociable)                     │
│   • Objectif de la session : 6 décisions, pas une de plus       │
│   • Animé par : Expert Doc                                      │
│                                                                 │
│ 0:10 — 0:40  DONNÉES (30 min) — mené par le DS                 │
│   • Résultats des simulations sur données Kaggle                │
│   • Matrice de corrélation : les paires problématiques          │
│   • WINNING_DERIV : le test de look-ahead bias                  │
│                                                                 │
│ 0:40 — 1:10  TERRAIN (30 min) — mené par le Parieur            │
│   • Les 3 matchs réels qui prouvent chaque position             │
│   • Réaction aux simulations du DS                              │
│   • Les angles morts : motivation, fatigue, public              │
│                                                                 │
│ 1:10 — 2:00  ARBITRAGE (50 min) — mené par l'Expert Doc        │
│   │                                                             │
│   │   DOUBT SESSION — format accéléré :                        │
│   │   Pour chaque métrique (5 min max) :                       │
│   │   1. Le DS présente son verdict + preuve                   │
│   │   2. Le Parieur répond + son contre-exemple                │
│   │   3. Décision : GARDER / GARDER MODULÉ / REJETER          │
│   │                                                             │
│   ┌──────┬──────────────────────┬──────────┬──────────────────┐ │
│   │  #   │ Métrique             │ Désaccord│ Temps            │ │
│   ├──────┼──────────────────────┼──────────┼──────────────────┤ │
│   │  1   │ ATP_POINTS           │ DS ✅ /   │ 7 min            │ │
│   │      │                      │ Parieur ⚠️ │                  │ │
│   │  2   │ BP_CONV              │ DS ✅ /   │ 7 min            │ │
│   │      │                      │ Parieur ❌ │                  │ │
│   │  3   │ BP_SAVED             │ DS ✅ /   │ 7 min            │ │
│   │      │                      │ Parieur ⚠️ │                  │ │
│   │  4   │ WINNING_DERIV        │ DS ❌ /   │ 10 min ⭐ risqué │ │
│   │      │                      │ Parieur ✅ │                  │ │
│   │  5   │ SERVE_DECAY          │ DS ❌ /   │ 7 min            │ │
│   │      │                      │ Parieur ✅ │                  │ │
│   │  6   │ MOMENTUM (revisit)   │ Rejeté    │ 5 min            │ │
│   │      │                      │ S1, mais  │                  │ │
│   │      │                      │ Parieur ? │                  │ │
│   ├──────┼──────────────────────┼──────────┼──────────────────┤ │
│   │  7   │ MOTIVATION           │ Angle     │ 5 min            │ │
│   │  8   │ FATIGUE              │ mort      │ 5 min            │ │
│   │  9   │ PUBLIC               │ Sprint 1  │ 3 min            │ │
│   └──────┴──────────────────────┴──────────┴──────────────────┘ │
│                                                                 │
│ 2:00 — 2:20  MÉTRIQUES COMPOSÉES (20 min)                      │
│   • SERVE_EDGE = (SRV_PTS_WON_S − RET_PTS_WON_OPP_S) × poids   │
│   • CLUTCH_FACTOR = (BP_CONV × BP_SAVED × TB_WINRATE)^(1/3)   │
│   • H2H_CONTEXT_SCORE = combinaison pondérée H2H               │
│   → Valider les formules ou les modifier                        │
│                                                                 │
│ 2:20 — 2:30  VERDICT & PROCHAINES ÉTAPES (10 min)             │
│   • Récapitulatif des 6 décisions                              │
│   • Périmètre Sprint 1 gelé : ce qu'on code, ce qu'on reporte │
│   • Planification Session 4 (Stratégies) ou code direct        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Fiches de Décision par Métrique

### Fiche #1 : ATP_POINTS (Points ATP, tronqué 6 mois)

| | Arguments |
|---|----------|
| **DS** ✅ | LOFO −2.1 pts, continue, bonne discrimination Top 10. Meilleur que ATP_RANK (rejeté). |
| **Parieur** ⚠️ | "Inclut des résultats d'il y a 1 an — Rublev top 5 jouait top 30". |
| **Proposition** | ✅ GARDER — mais tronquer à 6 mois glissants (au lieu de 52 semaines ATP). Solution acceptée en S1. |
| **Coût** | 1 ligne de SQL supplémentaire dans la fenêtre. |
| **Décision finale :** | `[ ] Garder (6 mois)  [ ] Garder (52 sem)  [ ] Rejeter` |

---

### Fiche #2 : BP_CONV (% conversion balles de break)

| | Arguments |
|---|----------|
| **DS** ✅ | Klaassen 2023 : −1.5 pts LOFO, stable dans le temps. |
| **Parieur** ❌ | "Bruit d'échantillonnage immense — un joueur passe de 55% à 35% sur 5 matchs". |
| **Proposition** | ✅ GARDER AVEC EWMA LONG (α=0.05). Le DS valide que ça existe. Le Parieur n'a pas tort sur la volatilité — un EWMA long règle le problème. |
| **Compromis** | Si le Parieur reste opposé même avec EWMA long, la garder en feature optionnelle (pas dans le modèle principal). |
| **Décision finale :** | `[ ] Garder EWMA long  [ ] Garder optionnelle  [ ] Rejeter` |

---

### Fiche #3 : BP_SAVED (% balles de break sauvées)

| | Arguments |
|---|----------|
| **DS** ✅ | Synergie avec BP_CONV, corrélation r=0.4 avec SRV_PTS_WON. LOFO −1.5 pts. |
| **Parieur** ⚠️ | "Jamais un facteur unique de décision mais utile en combinaison". |
| **Proposition** | ✅ GARDER EN COMBINAISON — ne pas utiliser seule. Uniquement dans CLUTCH_FACTOR. |
| **Coût** | Nul si BP_CONV est déjà codé (même source de données). |
| **Décision finale :** | `[ ] Garder (combinaison)  [ ] Garder (seule)  [ ] Rejeter` |

---

### Fiche #4 : WINNING_DERIV (Dérivée taux de victoire) ⭐ RISQUÉ

| | Arguments |
|---|----------|
| **DS** ❌ | Look-ahead bias si mal bordé. Corrélation r=0.8 avec MOMENTUM_LIVE. |
| **Parieur** ✅ | "Capte le momentum de performance avant que le marché ne l'intègre". +3000€ documentés. |
| **Proposition** | ⚠️ GARDER AVEC GARDE-FOU. 3 conditions strictes : 1) Calcul uniquement sur matchs terminés (pas en cours) 2) Fenêtre fixe de 10 matchs exactement 3) Validation hebdomadaire de la corrélation avec les autres features |
| **Risque** | Élevé. Si mal codé, peut introduire une fuite de données qui fausse tout le modèle. |
| **Compromis** | Si le DS refuse toujours : la déplacer en Sprint 2 avec un POC de validation sur données avant intégration. |
| **Décision finale :** | `[ ] Garder (garde-fou)  [ ] Sprint 2 (POC)  [ ] Rejeter` |

---

### Fiche #5 : SERVE_DECAY (Déclin service avec l'âge)

| | Arguments |
|---|----------|
| **DS** ❌ | "Déjà capturé par SRV_PTS_WON_S — corrélation r>0.6". Sous-spécifié. |
| **Parieur** ✅ | +4 200€ sur Isner US Open. Le marché n'avait pas intégré le déclin de son service. |
| **Proposition** | ✅ GARDER CONDITIONNELLE — n'ajouter de la valeur que pour les joueurs > 32 ans. Dans le Top 10, ça concerne ~2-3 joueurs (Djokovic 37, et selon l'année). |
| **Implémentation** | `if age > 32: feature = SRV_PTS_WON_S * AGE_DECAY_FACTOR else: feature = 0` |
| **Décision finale :** | `[ ] Garder conditionnelle (>32 ans)  [ ] Garder universelle  [ ] Rejeter` |

---

### Fiche #6 : MOMENTUM (revisit) — le retour ?

| | Arguments |
|---|----------|
| **Session 1** | ❌ Rejeté par les deux ! Non reproductible 2015-19 vs 2023-24. Parieur : "7 000€ perdus". |
| **Mais...** | La métrique composée MOMENTUM_ELITE (EWMA_court − EWMA_long × TOP10_BOOST) est différente du momentum simple. Elle ajoute le contexte Top 10 et la consistance de surface. |
| **Proposition** | ❌ RESTER SUR LA DÉCISION S1. Ne pas rouvrir ce débat. MOMENTUM_ELITE pourra être testée en Sprint 3 si le Parieur insiste, mais pas maintenant. |
| **Décision finale :** | `[ ] Rester sur "Rejeté"  [ ] Rouvrir le débat` |

---

### Angles Morts Sprint 1

| Facteur | Edge | Capture | Proposition |
|---------|------|---------|-------------|
| **MOTIVATION** | 8/10 | Dernière perf + statut tournoi + jours depuis dernier match | ✅ GARDER — facile (2 colonnes dans la DB) |
| **FATIGUE** | 8/10 | Distance géographique dernier tournoi + jours de repos | ✅ GARDER — facile (API géoloc gratuite) |
| **PUBLIC** | 5/10 | Nationalité joueur ≠ pays du tournoi | ✅ GARDER — gratuit (1 booléen) |

**Proposition commune :** Les 3 angles morts Sprint 1 sont validés d'office — coût quasi nul, edge potentielle documentée par le Parieur. Les intégrer tous les 3.

---

## 5. Règles du jeu pour la session

1. **Pas de nouveau débat sur ce qui est déjà tranché.** Les métriques rejetées en S1 (ATP_RANK, MOMENTUM, H2H_TIEBREAK, H2H_5TH_SET, AGE.INT) ne sont pas rouvertes.

2. **Chaque décision doit avoir un "gardien"** : la personne la plus opposée à la métrique devient responsable de sa surveillance en production. Exemple : si le Parieur accepte BP_CONV avec EWMA long, c'est lui qui valide après 100 matchs qu'elle n'introduit pas de bruit.

3. **Quand le DS et le Parieur sont en désaccord égal, le CEO tranche.** Les deux camps présentent leurs arguments, le CEO décide, et tout le monde s'aligne.

4. **Le coût d'implémentation est un argument recevable.** Si une métrique coûte 2 semaines de dev pour un gain marginal, elle peut être repoussée en V2.

---

## 6. Résultat attendu de la session

```
À la fin des 2h30, on doit avoir :

✅ Périmètre SPRINT 1 gelé (features + formules exactes)
   → L'engineering peut coder sans ambiguïté

✅ 6 décisions sur les métriques en désaccord
   → État : GARDÉ / GARDÉ MODULÉ / REJETÉ / REPORTÉ S2

✅ 3 angles morts validés ou rejetés

✅ Date de la Session 4 (Stratégies) ou GO pour coder directement
```

---

## 7. Proposition de fusion S2+S3

Plutôt que de faire la Session 2 (Data Dive) puis la Session 3 séparément, je propose de **fusionner les deux en un seul atelier de 2h30** :

```
Phase 1 (30 min) — DATA : Le DS présente ses simulations rapides
Phase 2 (30 min) — TERRAIN : Le Parieur réagit avec ses cas concrets
Phase 3 (50 min) — ARBITRAGE : On tranche métrique par métrique
Phase 4 (20 min) — COMPOSÉES : On valide les formules
Phase 5 (10 min) — VERDICT : On gèle le périmètre Sprint 1
```

**Condition de succès :** Le DS doit avoir fait son pré-work (2h de simulations sur données Kaggle). Sans ça, la session part dans le mur.

---

## 8. Proposition de date et logistique

```
Format : Visio (ou en présentiel si possible — le débat est plus riche)
Durée : 2h30 (pas 2h — les 30 min supplémentaires évitent de couper le débat)
Pré-work : À envoyer 48h avant

Proposition de créneaux :
  - Jeudi après-midi (14h-16h30)
  - Vendredi matin (9h30-12h)
  - Lundi (10h-12h30)

Après la session :
  - H-0 : Compte-rendu des décisions (par l'Expert Doc)
  - H+24h : Périmètre Sprint 1 gelé dans Pariscore_Implementation_Plan.md
  - H+48h : L'engineering peut démarrer
```

---

*Document préparé par l'Expert Documentaire — Pariscore*
*Basé sur les travaux du Data Scientist et du Parieur Pro — Juin 2026*
