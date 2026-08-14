# Propositions — Élever l'onglet Football de PariScore

**Source d'inspiration** : « Championship Predictions: Week 1 + League One & League Two | EFL 26/27 »
(lecture impossible en transcription directe — YouTube 429/bot-block — mais format clair : pronostics hebdomadaires EFL, 3 divisions, match par match).

**Constat** : l'onglet Football (`src/components/football/`) est **déjà très avancé** — filtres value/topConf/corners/BTTS, cartes avec xP, momentum sparkline, radar attaque/défense/forme, xG, classement dom/ext, comparateurs de métriques, insight éditorial, cartes live. La force a analyser n'est donc **pas** « ajouter de la donnée », mais **structurer l'expérience « pronostics de journée »** comme le fait la vidéo : une lecture humaine, hiérarchisée et actionnable des pronostics.

Les propositions ci-dessous sont classées par **impact sur l'expérience** (pas par effort de code).

---

## 1. Panneau « Journée X » — rythme éditorial hebdomadaire (★★★★★)

La vidéo est ancrée sur **une journée de championnat** (Week 1), pas sur un flux brut de matchs.

- **Regrouper les cartes par journée** : un en-tête de section `Journée 5 — Weekend du 22-24/08` au lieu d'une grille plate. Grouper par `match.round` (déjà présent dans les données) avec un petit résumé : `5 matchs · 3 pronos forts · 1 banker`.
- **Badge « Match du week-end »** : mettre en avant (surbrillance emerald + étiquette) UN match par ligue/journée — le match le plus lisible/attendu. Miroir du « feature » de la vidéo mais escamotable.
- **Cohérence multi-divisions** : pour les ligues à plusieurs divisions (ex. Angleterre Championship/League One/League Two), offrir un toggle de **division** dans `FootballLeagueBar` (Championship | League One | League Two) plutôt que de tout mélanger dans un seul flux, exactement comme la vidéo traite les 3 exclusivement.

**Implémentation** : dans `football-tab-content.tsx`, un `useMemo` qui regroupe `prematchMatches` par `round` (ou par week-end dérivé de `scheduledAt`) → rendu de sections. Faible risque, fort effet « produit ».

---

## 2. « Le pronostic de la semaine » + « Banker du week-end » (★★★★★)

Cœur éditorial des vidéos de pronos EFL : **un gros pick argumenté**, pas 50 picks timides.

- **Widget en tête d'onglet** (au-dessus des filtres) : sélectionne automatiquement LE match le plus confiant (cf. filtre `topConf` existant : `doubleChance.prob >= 75` etc.) et l'affiche en **grande carte éditoriale** :
  - pronostic principal + score probable,
  - **« Pourquoi ? »** rédigé (appuyer sur le module `EditorialInsight` déjà présent dans `football-match-card.tsx`),
  - boutons d'action : ouvrir le détail, comparer les cotes, ajouter au combinateur (cf. prop 4),
  - badge `Banker` / `Value` / `Spe`.
- **Charriot « les 3 du weekend »** : sous le banker, une barre de 3 cartes compactes (les 2-3 autres meilleurs picks) → on recrée la hiérarchie « Banker + 2-3 trebles » typique des vidéos EFL.

**Implémentation** : nouveau composant `FootballBankerWidget.tsx` (dans `src/components/football/`) branché sur `useFootballMatches`. Réutilise `FootballMatchCard`/`FootballLiveCard` en mode compact.

---

## 3. Correct Score (score exact) — module prono manquant (★★★★☆)

Les pronos EFL insistent lourdement sur le **score exact**, absent de l'onglet actuel (on a DC, O/U, BTTS, corners — pas le score probable).

- **Score prédit sur chaque carte** : à côté du score en live / du `VS` prématch, afficher le score le plus probable (`1-0`, `2-1`…) extrait de la distrib xG déjà calculée (masse de probabilité sur les résultats 0-0 → 4-4).
- **Filtre « ⚽ Score exact »** : ajouter aux `FILTERS` un filtre qui ne montre que les matchs où le score prédit a une proba ≥ seuil (ex. 12%+), donnant une échelle de lecture « score exact » à la vidéo.
- **Badge score exact dans `predictionBadges`** : réutiliser le mécanisme existant pour afficher `Score 2-1 (14%)`.

**Implémentation** : dériver d'une distrib de Poisson à partir de `p.xGa.home` / `p.xGa.away` (déjà exposés) — purement frontend, sans nouvelle donnée.

---

## 4. Combinateur / Accumulateur en un clic (★★★☆☆)

Les vidéos construisent toujours un **multipari** à la fin (« voici le combo du weekend »).

- **Sélectionner plusieurs picks « Forte Confiance »** (via le filtre topConf) et un **panneau combinateur** latéral/abas qui les cumule : cote totale calculée (multiplication), gain potentiel pour une mise donnée, et un CTA « Voir les cotes » / partage.
- Réutilise l'existant : `View`/`WatchButton`, `bookmaker-comparator-dialog`, et le écosystème odds déjà présent.

**Implémentation** : état `selectedPicks: Set<matchId>` + composant `FootballAccumulatorPanel.tsx`. Interaction native, valeur perçue forte.

---

## 5. « Pourquoi ce prono » — narration humaine (★★★☆☆)

Au-delà des chiffres, la crédibilité des vidéos tient à **l'argumentaire**.

- **Étendre `EditorialInsight`** (`src/components/ai/editorial-insight.tsx`) en mode « narration par match » : une à trois phrases générées par match (« X reste sur 4 victoires à domicile et affronte Y, dernier de la forme away ») alignées sur le pick principal, au lieu d'un insight général.
- **Tooltip explicatif sur chaque badge** : quand on survole `BTTS (78%)`, un micro-texte « les 2 équipes marquent dans 4 de leurs 5 derniers matchs ».

**Implémentation** : enrichir les badges existants d'un `title`/tooltip + appels ponctuels au générateur IA existant (clé GEMINI déjà en config).

---

## 6. Bilan de journée / « à venir » (★★☆☆☆)

- **En-tête de section bilan** : pour la journée en cours, `3/5 pronos corrects · ROI +12%` quand des résultats du round sont passés (FT), donnant une **confiance mesurée** à la communauté — le facteur rétention des chaînes de pronos.

**Implémentation** : dans le regroupement par journée (prop 1), croiser les matchs `FT` avec les pronoms passés pour calculer taux + ROI simple.

---

## 7. Couverture EFL / ligues secondaires (★★☆☆☆)

- La vidéo traite **Championship, League One, League Two**. Vérifier que ces 3 divisions sont bien servies par `football-data.ts` / `bsd-football-fetcher.ts` ; si non, les ajouter au mapping (cf. pattern classements dans `scripts/scrape_rankings.py` + `team_name_mapping.py`), afin que le « mode EFL à 3 divisions » de la prop 1 ait des données réelles.

---

## Priorisation recommandée

| Prop | Impact | Effort | Ordre conseillé |
|------|--------|--------|-----------------|
| 1 – Journée X multi-divisions | Très haut | Moyen | 1 |
| 2 – Banker du week-end | Très haut | Faible/Moyen | 2 |
| 3 – Correct Score | Haut | Faible | 3 |
| 4 – Combinateur | Haut | Moyen | 4 |
| 5 – Narration éditoriale | Moyen/Haut | Faible | 5 |
| 6 – Bilan de journée | Moyen | Faible | 6 |
| 7 – Couverture EFL | Moyen | Moyen | 7 (selon données) |

**Fil rouge** : l'onglet Football de PariScore est déjà plus riche en données que la vidéo ; l'écart est **structurel et éditorial**. Les 3 premières propositions transforment un flux de calculs en une « journée de pronos » qu'on lit et qu'on lui, exactement le produit des meilleures chaînes EFL.