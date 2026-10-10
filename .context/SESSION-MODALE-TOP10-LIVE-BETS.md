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

## Étape 3 — Contrat de données Value Edge

### Étape 3a (ingestion cote) — ❌ IMPOSSIBLE, mesuré

La mission demande de transmettre « la cote live issue du flux (OddsPapi / BSD) ».

**Le flux ne contient aucune cote.** Mesuré sur la production,
`GET /api/football/live` → **200, 19 matchs** :

- `live` est **`null` sur les 19 matchs** — aucun état live transmis (ni score, ni minute) ;
- le payload expose `id, league, round, scheduledAt, home, away, prediction, live, venue` ;
- `prediction` porte des **probabilités modèle** (`homeProb: 33`), pas des prix ;
- aucun champ `odds_home` / `odds` / équivalent dans le flux.

`FootballLiveInput` (`live-football.ts:51-66`) ne porte donc aucun champ de cote, et
`adaptFootball` (`live-adapters.ts:92-104`) n'a rien à transmettre. Étendre le type
n'ingérerait **rien** : le prop serait toujours `undefined`, et le widget afficherait un
écart partout — un chiffre sans source.

### Étape 3b (normalisation + écart conditionnel) — ✅ LIVRÉE

`src/lib/prediction/value-edge.ts` + `src/lib/__tests__/value-edge.test.ts`.

La logique d'écart est isolée du composant : c'est la seule partie qui puisse produire
un nombre absurde, donc la seule qui mérite un test.

**Ce que le module garantit** (11 tests, 193 assertions) :

| Invariant | Test |
|---|---|
| fraction [0,1] → pourcentage | `toPercent(0.69) === 69` |
| pourcentage **non** re-multiplié | `toPercent(69) === 69` — c'est l'artefact « 6900 % » |
| écart toujours dans [−100, +100] | 40 combinaisons modèle × cote |
| pas de cote → pas d'écart | `edgePts === null`, `modelPct` reste affichable |
| écart < 3 pts = bruit | filtré par `meaningful` |

**Choix explicite** : `toPercent` **borne** une valeur > 1 au lieu de la multiplier par
100. Multiplier une entrée déjà en pourcentage par 100 produirait précisément l'artefact
que la mission voulait empêcher ; la borne le rend inoffensif.

**Ce que le module ne fait pas, délibérément** : pas d'EV. Un EV exige
`p × (cote × stakes − 1) − (1 − p) × stakes`, qui dépend de la gestion de mise et de la
marge du bookmaker. Ici on compare deux probabilités — une indication d'écart, pas une
espérance de gain.

### Pour brancher le widget (reste ouvert)

1. Récupérer des **cotes live réelles** (source externe ou BSD live) et les faire
   transiter par `adaptFootball` → `FootballLiveInput` → `LiveOutcome.odd`.
2. Ou, si les cotes ne sont pas disponibles : laisser `edgePts === null` et afficher le
   badge `value` heuristique actuel.

Le module est prêt pour le branchement dans les deux cas — c'est un contrat de données
qui manque, pas du code d'UI.