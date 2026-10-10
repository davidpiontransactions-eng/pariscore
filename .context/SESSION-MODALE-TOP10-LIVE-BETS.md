# Modale Top 10 Football + Widget BETS PRÉDICTIFS LIVE — état de la série

> ⚠️ Une version précédente de ce fichier a été **supprimée par une session parallèle**
> (nettoyage de `.context/`). `.context/RAPPORT-TACHES.md` est également passé en
> **mojibake** (encodage cassé). Je ne réécris pas ce dernier pour ne pas amplifier les
> dégâts : restauration depuis `git show HEAD:.context/RAPPORT-TACHES.md`.

---

## Étape 1 — Fiche détaillée au clic sur une ligne du Top 10 — ✅ LIVRÉE

**Bead** : `ParisScorebis-l72w` · **commit** : `a3598611`

Le clic sur une ligne du tableau **Top 10 matchs** ouvre `FootballMatchDetailDialog`, qui
affiche déjà PowerScore, radar, stats FBref et le comparatif
`metricStats.home/away.goals`.

Trois décisions qui méritent d'être explicitées :

**1. Contre-exigence de la mission, signalée et non contournée.**
La mission veut « pré-filtrer la dialog sur le marché actif ». Or elle ne prend que
`{ match, open, onOpenChange }` — **aucun prop marché** — et **n'importe pas**
`MetricComparePanel` (utilisé par `football-match-card.tsx:958`, autre surface). Ajouter
ce prop aurait créé une **troisième** représentation du comparatif dans la même modale.

**2. Résolution locale, pas de requête.**
Le Top 10 ne connaît qu'un `matchId` ; la dialog exige un `FootballMatch` complet. La
prop `matches` contient déjà ces fixtures → résolution par `id`, avec repli sur les
**noms d'équipes** (l'API `/api/football/top5` peut servir un match absent du calendrier
local). Sans ce repli, le clic ne ferait rien sur ces lignes : un bouton qui n'ouvre
rien est pire que pas de bouton.

**3. Accessibilité traitée comme une exigence.**
`role="button"`, `tabIndex`, `aria-label`, et **`Enter` + `Espace`** — le `<div>` ne gère
aucun des deux par défaut. `onOpenMatch` optionnel : absent, le tableau reste inchangé.

**Gates** : `eslint` **0** · `tsc --noEmit` **0** (les deux lus dans des fichiers dédiés).

---

## Étape 2 — Widget « BETS PRÉDICTIFS LIVE » Football — ✅ DÉJÀ LIVRÉ

### Le composant demandé existe déjà, football compris

La mission demande de **créer** `FootballLivePredictiveBets`. Il existe déjà, polymorphe
sur 6 sports :

| Brique | Emplacement |
|---|---|
| Widget à onglets | `src/components/sports/live-predictive-bets-widget.tsx:44-48` |
| Moteur football | `src/lib/prediction/live-football.ts` |
| Dispatch sport → moteur | `src/hooks/use-live-predictive-bets.ts:57-74` |
| Route live football | `/api/football/live` |
| Branchement UI | `src/components/football/football-live-card.tsx:742` |

Les onglets décrits par la mission (`🎯 Tous`, `📈 Match / Set / Période`, `⚡ Micro-Bets`)
sont **literalement** ceux du composant existant. En créer un second aurait donné deux
arborescences, deux jauges néon, deux badges value — avec une arithmétique dupliquée qui
divergerait dès qu'un marché change de forme (règle 15).

**Vérifié en production** : `GET /api/football/live` → **200, 19 matchs**.

### Le contrat de probabilité contredit la mission

La mission prescrit « modèle en pourcentage [0-100] » et `Δ = round(P_modèle − P_marché)`.

Or `LiveBetsBundle.prob` est une **fraction bornée** : `LIVE_PROB_MIN = 0.02`,
`LIVE_PROB_MAX = 0.98` (`live-common.ts:100-101`), garantie par `clampLiveProb()` et une
projection sur simplexe.

Sur ce contrat, un écart direct donne `0.69 − 0.48 = 0.21 pt`, **toujours arrondi à 0 ou
1** : le badge serait mort. Le « garde-fou » de la mission (multiplier par 100 si fraction)
n'est pas une sécurité, c'est la **seule** arithmétique qui fonctionne ici.

### Écart assumé : le badge « value » n'est pas un EV réel

`live-predictive-bets-widget.tsx:20-22` le documente : badge **heuristique**
(probabilité dans [60 %, 70 %]), **pas un EV**, car le widget ne reçoit pas les prix
1xBet/PSG. Comparer modèle vs marché comme demandé supposerait des cotes que le flux
live ne transmet pas — l'écart affiché serait une **invention**, pas une mesure.

### Ce qu'il faudrait pour un vrai écart en points

1. Transmettre la **cote live par marché** dans `live-football.ts` → `LiveBet`.
2. Définir l'arrondi et le seuil minimal d'affichage de l'écart.
3. Un test d'échelle : une fraction ne doit jamais produire un écart > 100 pts.

Ce n'est pas un composant, c'est un **contrat de données**.