# Propositions v2 — Fonctionnalités « AI pricing & value » (source : Odd Alerts AI)

**Source** : vidéo « Odd Alerts AI — create winning systems », été 26/27 (transcription fournie).
Plateforme cible : **filtres rapides IA, scanner live (funnel), value bets, profit/reliability, bet-slip generator, page de prédictions football IA**.

**Constat** : PariScore possède déjà les briques computationnelles (`prediction-ml-engine`, `predictive-bets-engine`, `use-paper-trading`, `bankroll-dialog`, `EditorialInsight`, `FootballPressReviewWidget`, `bookmaker-comparator-dialog`), ainsi que mes ajouts récents (Banker, Journée X). L'écart avec Odd Alerts n'est PAS la donnée, c'est :
1. **l'expression en langage naturel** des filtres,
2. **l'orchestration « système profitable »** (backtest, bankroll, fiabilité, amélioration),
3. **le correct score + rapport de match IA** généré depuis *le propre modèle* de PariScore.

Les propositions suivent, classées par impact.

---

## A. Filtres rapides en langage naturel → règles compilées (★★★★★)

>Le cœur du produit Odd Alerts : « construis un filtre avec l'IA ». L'utilisateur écrit une phrase, l'IA génère des **règles actionnables** sur les données existantes.

**Exemple réel de la vidéo (BTTS away)** :
« Filtre BTTS focalisé sur les équipes visiteuses ; l'équipe à domicile ne doit pas être terrible (1.2 PPG minimum à domicile) ; proba BTTS ≥ 55 % » → compile en :
- record de buts à l'extérieur ≥ 80 %,
- PPG domicile (équipe 1) ≥ 1.2,
- proba modèle BTTS ≥ 55 %.

**PariScore déjà compatible** : les règles ciblent des champs déjà exposés dans `FootballMatch.prediction` (bttsProb, over15/under35, doubleChance, bestCornerOver, xGa, standingStats.home.played/ppg/goalsFor, away scoring record, odds). On peut compiler dans `applyPresetFilter`-like (`top-teams-presets-bar.tsx`).

**Filtres live par « écarts relatifs »** (autre idée forte) : « le domicile a eu 5 tirs de plus que l'extérieur », « 10 attaques dangereuses de plus » → règles **delta** au lieu de seuils fixes, sur les champs déjà suivis en live (possession, tirs, tirs cadrés, corners, momentum).

**Implémentation** : `src/components/football/AIFilterBuilderDialog.tsx` + `src/lib/football-nl-filter.ts` (prompt GEMINI → JSON de règles typé → parseur → masque de filtrage réutilisable dans `applyPresetFilter`). Le filtre IA devient un **preset utilisateur sauvegardé** (Zustand/localStorage) qui s'affiche comme les pills de `TopTeamsPresetsBar`.

---

## B. Rapport de match IA généré depuis le modèle PariScore (★★★★★)

>Odd Alerts : « génère un AI match report » qui résume le match en une lecture : « Stocksund sans victoire sur ses 10 derniers matchs à domicile, défense concède 2+ buts dans 70% des matchs, 0 clean sheet ; victoire extérieure à 2.35, suggéré : away win + over 3.5 ».

PariScore a `EditorialInsight` (articles scrapés whitelist) mais **aucun rapport narratif qui synthétise SES PROPRES prédictions** (`prediction-ml-engine`, standingStats, forme, momentum, xGd).

**Implémentation** : `src/components/football/AIMatchReport.tsx` + hook `useAIMatchReport(matchId)` (clé GEMINI déjà en config). Le prompt reçoit le payload structuré (prédictions, standing dom/ext, forme L5, momentum, odds, classement) et produit : un paragraphe « pourquoi », les 3 stats clés, **et la suggestion de combinateur** (ex. « DC 1X + plus de 1.5 »).

---

## C. Correct Score + tri par « edge » (★★★★☆)

>La page preds Odd Alerts surface le modèle **Correct Score** (0-0, 1-0, 2-0…) et permet de **trier par edge** (valeur vs cote du bookmaker).

Absent de l'onglet Football actuel. Réutilise ma Proposition v1 #3 (distrib Poisson depuis `xGa`).

**Implémentation** : score probable sur chaque carte (`football-match-card.tsx`), badge `Score 2-1 (14%)`, filtre « ⚽ Score exact », **et tri/edge apparent** : `edge = prob_modèle − prob_implicite_cote` pour BTTS / DC / Over (>5 pts). Bouton « Tri par value » sur la liste, à côté du mode cartes/liste.

---

## D. Profit calculator + bankroll simulator + note de fiabilité (★★★☆☆)

>Odd Alerts : backtest 120 jours, unités de profit + jolie courbe, **[bankroll simulator]** (bankroll de départ + staking 1/2/5% ou Kelly), et **[reliability rating] 0-100** = échantillon, retour global, résultats récents, **consistance dans le temps**, **mix ligues** (surdépendance à une ligue ?), **downside risk** (série perdante), + split 70/30 par périodes.

PariScore a `use-paper-trading` et `bankroll-dialog` (génériques). Transposer cela **par stratégie**, avec le calcul déjà disponible dans `football-predictions` / historique (il existe des fichiers `seed_historique_*.js`, un historique backend).

**Implémentation** : `src/hooks/use-football-backtest.ts` + `src/components/football/BacktestPanel.tsx` (courbe unités, positions P&L), `BankrollSimulator` (staking), et `ReliabilityScore` (échantillon, ROI, L10, consistance, mix ligue, downside) — composants réutilisables dans le dialog détail d'un match et dans une future page « Capacités ».

---

## E. Onglet « Améliorer » (auto-variation des réglages) (★★★☆☆)

>« Améliorer » teste automatiquement des **variations proches des réglages** (ex. hausser la cote mini à 2.75) et affiche le **changement de yield %** sur la même période, puis crée une **nouvelle stratégie** (sans écraser).

Idéal derrière D : pour un filtre/preset utilisateur, énumérer 3-5 variantes de seuil (cote mini, pct. ≥, range de value) et rapporter le yield sur l'historique. Améliorer une stratégie devient 1 clic.

---

## F. Générateur de bulletin + swap/lock + push planifié (★★☆☆☆)

>Bet-slip generator : profils de réglages, génération programmée (8h/18h) **envoyée par Telegram**, **swap une sélection**, **lock une sélection** puis re-génération.

Se connecte à ma Prop v1 #4 (combinateur/accumulateur). Le **swap/lock** est l'idée différenciante : remplacer les jambes d'un combo sans tout régénérer. PariScore a déjà les notifications web-push (`web-push`).

---

## G. Liens bookmakers en deep-link (non affilié) (★★☆☆☆)

>Directeurs, zéro affiliation, cohérent avec la position éditoriale.

`bookmaker-comparator-dialog` existe ; ajouter un CTA « sur le bookmaker » en deep-link (fr/bet365…). Simple, renforce la crédibilité.

---

## Priorisation recommandée

| Prop | Impact | Effort | Ordre |
|------|--------|--------|-------|
| A – Filtres NL (dont écarts relatifs) | ★★★★★ | Moyen | 1 |
| B – Rapport IA + suggestion combo | ★★★★★ | Moyen | 2 |
| C – Correct Score + tri edge | ★★★★ | Faible | 3 |
| D – Profit/Bankroll/Fiabilité | ★★★★ | Moyen | 4 |
| E – Onglet Améliorer | ★★★ | Faible (sur D) | 5 |
| F – Bulletin combo swap/lock | ★★ | Moyen | 6 |
| G – Deep-links bookmakers | ★★ | Faible | 7 |

**Fil rouge** : parier sur **la boucle « lire un prono → le backtester → l'améliorer → le jouer en combo »**. Les propositions A et B taillent l'expérience « système de paris »; C, D, E la rendent **mesurable et fiable**; F, G la rendent **actionnable**. C'est exactement là où Odd Alerts nous distance aujourd'hui.