# CLASSEMENT FINAL DES MÉTRIQUES — Pariscore Top 10 ATP

## Ranking simplifié : Science + Terrain = Décision

---

### Légende

| Symbole | Signification |
|---------|---------------|
| 🥇 | Noyau dur — valide scientifiquement ET par le terrain |
| 🥈 | Utile — validé par au moins une expertise |
| 🥉 | Optionnel — garder si pas de coût d'implémentation |
| ❌ | Rejeté — ne pas implémenter |
| 🔍 | Angle mort — non couvert par les thèses, source d'edge réelle |

---

## Classement Final (20 métriques + 6 angles morts)

### 🥇 Top 4 : Noyau Dur — À coder en PRIORITÉ (Sprint 1)

`
┌──────┬──────────────────────────────────────┬──────────┬──────────┬───────┬──────────────────────────────┐
│ RANG │ MÉTRIQUE                             │ NOTE DS  │ NOTE     │ EDGE  │ PRIORITÉ ENGINEERING         │
│      │                                      │          │ PARIEUR  │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥇1  │ SRV_PTS_WON_S                        │ LOFO     │ +8.400€  │ 7/10  │ MVP Sprint 1 — EWMA 5 matchs │
│      │ % points service gagnés (EWMA 5m)    │ −4.0 pts │ gagnés   │       │ α=0.18, disponibilité: ✅    │
│      │ "Mon arme secrète" — Parieur Pro     │          │          │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥇2  │ RET_PTS_WON_S                        │ LOFO     │ +5.200€  │ 6/10  │ MVP Sprint 1 — EWMA 5 matchs │
│      │ % points retour gagnés (EWMA 5m)     │ −3.5 pts │ gagnés   │       │ α=0.18, disponibilité: ✅    │
│      │ "Plus volatile que SRV, mais edge"   │          │          │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥇3  │ H2H_SURFACE_AUGMENTED                │ LOFO     │ "Repère  │ 4/10  │ Sprint 1 — H2H enrichi       │
│      │ H2H filtré par surface + année       │ −1.0 pt  │ mismatch"│       │ Disponibilité: ✅ Sackmann   │
│      │ + poids temporel (2 ans max)         │          │          │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥇4  │ PRESSURE_INDEX                       │ Donnée   │ +9.600€  │ 7/10  │ Sprint 2 — Scraping nécessaire│
│      │ Ratio points importants gagnés       │ difficile│ gagnés   │       │ Points break, 30-30, 4-4, TB │
│      │ "Personne ne regarde ça" — Parieur   │ ❌ dispo │ ✅ edge  │       │ Disponibilité: ⚠️ TennisViz │
└──────┴──────────────────────────────────────┴──────────┴──────────┴───────┴──────────────────────────────┘
`

### 🥈 Top 6 : Utiles — À implémenter en Sprint 1-2 (avec modulations)

`
┌──────┬──────────────────────────────────────┬──────────┬──────────┬───────┬──────────────────────────────┐
│ RANG │ MÉTRIQUE                             │ DS       │ PARIEUR  │ EDGE  │ DÉCISION                     │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥈5  │ ATP_POINTS                           │ ✅       │ ⚠️ "In-  │ 3/10  | Sprint 1 — tronquer sur 6   |
|      | Points ATP (tronqués 6 mois)         | LOFO     | clutent  |       | mois glissants, pas 52 sem.  |
│      │                                      │ −2.1 pts │ résultats│       │                              │
│      │                                      │          │ d'il y a │       │                              │
│      │                                      │          │ 1 an"    │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥈6  │ ELO_SURFACE                          │ ✅       │ ❌ "Déjà │ 2/10  │ Sprint 1 — à recalculer soi- │
│      │ Rating Elo par surface (recalculé)   │ LOFO     │ dans la  │       │ même (pas prendre une API)   │
│      │                                       │ −3.2 pts │ cote"    │       │ Pondération mois en cours: 60%│
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥈7  │ AGE.30                               │ ✅ +2.5% │ ❌       │ 1/10  │ Sprint 1 — gratuit, zéro     │
│      │ |age − 30| (SEL Buhamra)             │ accuracy │ "Inutile │       │ coût. Garder même si faible  │
│      │                                      │          │ en réel" │       │ impact. Coût: 0 ligne de code│
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥈8  │ BP_CONV                              │ ✅       │ ❌       │ 2/10  │ Sprint 2 — avec EWMA long    │
│      │ % conversion balles de break         │ LOFO     │ "Bruit   │       │ (α=0.05) pour lisser la     │
│      │                                      │ −1.5 pts │ d'échan- │       │ volatilité                   │
│      │                                      │          │ tillon"  │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥈9  │ BP_SAVED                             │ ✅       │ ⚠️       │ 3/10  │ Sprint 2 — garder en         │
│      │ % balles de break sauvées            │ LOFO     │ "Légère- │       │ combinaison avec BP_CONV     │
│      │                                      │ −1.5 pts │ ment +   │       │                              │
│      │                                      │          │ stable"  │       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥈10 │ WINNING_DERIV                        │ ❌       │ ✅       │ 5/10  │ Sprint 2 — avec garde-fou   │
│      │ Dérivée taux de victoire             │ Look-    │ +3.000€  │       │ anti look-ahead bias.        │
│      │ "capture le momentum avant marché"   │ ahead    │ gagnés   │       │ Surveillance dérive continue │
│      │                                      │ bias ⚠️  │          │       │                              │
└──────┴──────────────────────────────────────┴──────────┴──────────┴───────┴──────────────────────────────┘
`

### 🥉 Top 3 : Optionnels — Garder si zéro coût

`
┌──────┬──────────────────────────────────────┬──────────┬──────────┬───────┬──────────────────────────────┐
│ RANG │ MÉTRIQUE                             │ DS       │ PARIEUR  │ EDGE  │ DÉCISION                     │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥉11 │ ELO_GLOBAL                           │ ✅       │ ❌       │ 1/10  │ Garder comme baseline de     │
│      │ Rating Elo général                   │ LOFO     │ "Métri-  │       │ comparaison, pas comme       │
│      │                                      │ −2.8 pts │ que la   │       │ feature active si ELO_SURFACE│
│      │                                      │          │ plus     │       │ est déjà là                  │
│      │                                      │          │ bullshit"│       │                              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥉12 │ SERVE_DECAY                          │ ❌       │ ✅       │ 5/10  │ Garder pour les joueurs      │
│      │ Déclin dominance service avec l'âge  │ "Déjà   │ +4.200€  │       │ >32 ans uniquement. Feature  │
│      │                                      │ capturé"│ gagnés   │       │ conditionnelle.              │
├──────┼──────────────────────────────────────┼──────────┼──────────┼───────┼──────────────────────────────┤
│ 🥉13 │ CMPLT                                │ ⚠️       │ ⚠️       │ 5/10  │ Garder pour les modèles      │
│      │ Completeness = SRV×RET               │ LOFO     │ "Utile   │       │ linéaires uniquement. Pas    │
│      │                                      │ −1.8 pts │ pour     │       │ nécessaire en RF.            │
│      │                                      │          │ repérer  │       │                              │
│      │                                      │          │ complets"│       │                              │
└──────┴──────────────────────────────────────┴──────────┴──────────┴───────┴──────────────────────────────┘
`

### ❌ Rejetés — Ne PAS coder

`
┌──────┬──────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
│ RANG │ MÉTRIQUE                             │ RAISON DU REJET                                             │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌14 │ ATP_RANK                             │ Variance trop faible dans le Top 10 (rangs 1→15).            │
│      │ Classement ATP                       │ ATP_POINTS fait mieux (continue). LOFO −1.5 pts seulement.   │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌15 │ MOMENTUM                             │ Non reproductible sur 2015-2019 vs 2023-2024.                 │
│      │ EWMA_court − EWMA_long               │ "Mythe de commentateur TV" — Parieur. LOFO −1.2 pts.         │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌16 │ WINRATE_SURFACE                       │ Redondant avec ELO_SURFACE (r=0.6). Top 10: tout le monde    │
│      │ % victoires sur surface              │ gagne >65%. LOFO −2.0 pts mais déjà capturé.                 │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌17 │ H2H_TIEBREAK                         │ N catastrophique: 2-3 TB/match × 3 matchs H2H = 6-9 samples  │
│      │ H2H en tie-break                     │ Statistiquement insignifiant. LOFO −0.4 pt.                   │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌18 │ H2H_5TH_SET                          │ N < 5 sur carrière complète dans le Top 10.                   │
│      │ H2H en 5ème set                      │ Inexploitable. LOFO −0.3 pt.                                  │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌19 │ AGE.INT                              │ Redondant avec AGE.30 (r=0.7). Aucune valeur ajoutée.          │
│      │ distance à [28,32]                   │ LOFO −0.8 pt.                                                 │
├──────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ ❌20 │ SRV_ADV                              │ Redondant avec SRV_PTS_WON_S + RET_PTS_WON_S (r=0.6).         │
│      │ Service Advantage                    │ Garder uniquement pour modèles linéaires.                     │
└──────┴──────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
`

### 🔍 Angles Morts — À intégrer dans le produit final (edge réelle)

`
┌──────┬──────────────────────────────────────┬──────────┬──────────────────────────────────────────────────┐
│ RANG │ FACTEUR                              │ EDGE     │ INTÉGRATION TECHNIQUE                             │
├──────┼──────────────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ 🔍21 │ MOTIVATION                           │ 8/10     │ Tracker « dernière perf », statut tournoi,       │
│      │ Joueur après GC, petit tournoi, etc. │          │ distance au dernier match. SPRINT 1.             │
├──────┼──────────────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ 🔍22 │ FATIGUE DE VOYAGE / DÉCALAGE         │ 8/10     │ Dernier tournoi, distance géographique,          │
│      │ Arrivée d'Asie → Europe, etc.        │          │ jours de repos. SPRINT 1.                        │
├──────┼──────────────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ 🔍23 │ FACTEUR PUBLIC / NATIONALITÉ         │ 5/10     │ Nationalité joueur ≠ pays tournoi =             │
│      │ Joueur jouant à domicile             │          │ avantage. SPRINT 1 gratuit.                      │
├──────┼──────────────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ 🔍24 │ BLESSURES NON DÉCLARÉES              │ 9/10     │ Scrape médias locaux, Twitter internes,          │
│      │ Info non publique, blessure cachée   │          │ photos échauffement. SPRINT 2 (NLP).             │
├──────┼──────────────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ 🔍25 │ CLIMAT                               │ 7/10     │ OpenWeather API (gratuit). Chaleur, vent,        │
│      │ Chaleur, vent, humidité, indoor      │          │ humidité, indoor/outdoor. SPRINT 2.              │
├──────┼──────────────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ 🔍26 │ CHANGEMENT D'ENTRAÎNEUR              │ 6/10     │ Scrape news tennis, API ATP. Période             │
│      │ Transition, instabilité              │          │ d'instabilité 5 matchs. SPRINT 2.                │
└──────┴──────────────────────────────────────┴──────────┴──────────────────────────────────────────────────┘
`

---

## Synthèse pour l'Engineering : Ce qui doit être codé (et dans quel ordre)

`
SPRINT 1 (Semaines 1-2) — 7 features
  ├── 🥇 SRV_PTS_WON_S      (EWMA α=0.18, fenêtre 5 matchs)
  ├── 🥇 RET_PTS_WON_S      (EWMA α=0.18, fenêtre 5 matchs)
  ├── 🥇 H2H_SURFACE_AUG    (H2H par surface + poids temporel)
  ├── 🥈 ATP_POINTS_6M      (Points ATP sur 6 mois glissants)
  ├── 🥈 ELO_SURFACE        (Rating Elo recalculé, pondération mois courant 60%)
  ├── 🥈 AGE.30             (|age - 30|, gratuit)
  ├── 🔍 MOTIVATION         (Tracker dernière perf + statut tournoi)
  ├── 🔍 FATIGUE            (Distance géographique + jours de repos)
  └── 🔍 PUBLIC             (Nationalité ≠ pays tournoi)

SPRINT 2 (Semaines 3-4) — 5 features
  ├── 🥇 PRESSURE_INDEX     (Scraping TennisViz ou calcul manuel)
  ├── 🥈 BP_CONV + BP_SAVED (EWMA long α=0.05)
  ├── 🥈 WINNING_DERIV      (Avec garde-fou anti look-ahead)
  ├── 🔍 BLESSURES          (Scraping NLP médias)
  └── 🔍 CLIMAT             (OpenWeather API)
`

---

*Classement final produit par l'Expert Documentaire — Pariscore*
*Basé sur 14 thèses + Data Scientist + Parieur Pro*
*Juin 2026*
