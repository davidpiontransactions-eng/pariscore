# Snooker — plafond de précision du modèle prédictif

> Document de référence pour l'onglet snooker. Écrit le 2026-10-01.
> Source : validation walk-forward exécutée sur `data/snooker_history.db`.

## TL;DR

**Le modèle de prédiction de snooker plafonne autour de 61,5 % d'accuracy, et c'est
normal.** Ce n'est ni un bug ni un tuning raté. La documentation existe pour que la
question « pourquoi on n'atteint pas 67 % ? » ne soit pas reposée à chaque revue.

---

## Le problème à connaître : la base stocke le vainqueur en premier

**Avant toute mesure de performance, il faut savoir ceci.**

`data/snooker_history.db` (source SnookerDB/CueTracker, GPL-3.0) présente **le
vainqueur en `player_1` dans 96,72 % des lignes** — 121 343 sur 121 345.

Conséquences directes :

| Conséquence | Détail |
|---|---|
| `player_1_score > player_2_score` | Vrai presque toujours → **ne porte aucune information** |
| Un modèle « le slot 1 gagne » | Remporte **96,7 % sans rien prédire** |
| Toute accuracy mesurée sur l'ordre de la base | Faussée — soit ~41 %, soit 96,7 % selon le sens |

Cas réel, impossible, présent dans la base :

```
match_id 313074 · O'Sullivan 10 – Trump 7 · winner = "Judd Trump"
```

### La règle

**Ne jamais déduire le vainqueur d'une comparaison de scores.** Le résoudre par
**identité** via `winner_url`, qui désigne l'un des deux joueurs dans 100 % des cas
(18 189 / 18 189 sur 2020+). C'est fait dans les deux lecteurs :

- `src/lib/snooker/snooker-history-l10.ts` (L5/L10)
- `src/lib/snooker/snooker-history-db.ts` (backtest de production)

Le contrat aval est explicite : `SnookerMatchRow.winner` porte l'identité du
vainqueur, `playerA` / `playerB` restent les deux participants dans l'ordre de la
base. Aucun module ne suppose « A == vainqueur ».

**Neutraliser le biais de présentation.** Même avec de bonnes étiquettes, prédire
« le joueur du slot A gagne » vaut 96,7 %. La validation inverse donc
déterministiquement l'ordre des slots sur le hash du `match_id` (flip mesuré à
50,0 %). Sans ça, aucun chiffre d'accuracy n'est interprétable.

---

## Les résultats mesurés

Walk-forward sur 115 862 matchs, TEST = 17 345 matchs du 2020-07-01 au plus tard,
Élo gelé avant chaque match, fenêtres excluant le match à prédire.

| Modèle | Accuracy | Brier | logLoss |
|---|---|---|---|
| **Élo (référence)** | **61,55 %** | **0,2328** | **0,6626** |
| L10 — composite 7 métriques | 59,76 % | 0,2444 | 0,6821 |
| L5 — composite 7 métriques | 58,61 % | 0,2466 | 0,6865 |
| Élo fenêtré sur 5 matchs | 57,95 % | 0,2396 | 0,6718 |
| Élo fenêtré sur 10 matchs | 57,84 % | 0,2397 | 0,6719 |

**Référence théorique** : Stefani (2011) — aléatoire = 50 %, un modèle bien
construit devrait atteindre **≥ 67 %**.

**Constat : aucun de nos modèles n'atteint 67 %. L'Élo seul est le meilleur des
quatre sur les trois critères.**

---

## Pourquoi le plafond est là

La littérature de référence situe les meilleurs systèmes connus aux alentours de
**67-68 %** :

> **Collingwood, Wright & Brooks**, *Evaluating the effectiveness of different player
> rating systems in predicting the results of professional snooker matches*,
> **EJOR 296(3):1025-1035 (2022)**, DOI `10.1016/j.ejor.2021.04.056`
>
> World Rankings (dollars de prix), win%, Bradley-Terry et Elo ont des accuracies
> proches ; Élo et Bradley-Terry ont la meilleure **discrimination** ; ils
> **surestiment les meilleurs joueurs** ; les modèles à 2 ans battent ceux à 1 an ;
> la force d'adversaire compte surtout pour les joueurs les mieux classés.

61,5 % est donc cohérent avec l'état de l'art sur des données **match + frame**.
Passer au-dessus demanderait le niveau de détail qui manque.

### Ce qui manque concrètement

Nos données vont jusqu'au **frame** (score, points, plus gros break). Elles
s'arrêtent là. Or les indicateurs qui font la différence sont **par tir** :

| Indicateur | Disponible ? | Pourquoi |
|---|---|---|
| Pot % (réussite de pot) | **Non** | Uniquement pour les matchs diffusés, jamais conservé systématiquement |
| Safety % (réussite de sécurité) | **Non** | Idem |
| Long pot % | **Non** | Idem |
| Temps de tir moyen | **Partiel** | Publié par la WST par saison (BBC 2019), pas par match |
| Points par frame | **Oui** | Colonne `scores` |
| Century / frame | **Oui** | Colonne `scores`, parenthèses |
| Force à la table (Chung 2014) | **Non** | Nécessite les tirs |

> Chung et al. (2014), *A Systematic Snooker Skills Test to Analyse
> Player Performance*, IJSSC 9(5). Les éléments de compétence mesurés sont le
> contrôle de la puissance, les angles, l'effet, le jeu de position et la sécurité —
> tous nécessitent des données par tir.

**Conclusion : le plafond tient à la granularité des données, pas au modèle.** Tant
que nous n'avons pas le tir, ajouter des métriques ne sert à rien — ce que la
validation a mesuré, pas supposé.

---

## Pistes déjà explorées et rejetées (ne pas les retenter)

Ces quatre pistes ont été **mesurées** sur 17 345 matchs, pas estimées. Elles sont
conservées dans `snooker-power-score-validate.ts` comme témoins.

| Piste | Résultat | Cause mesurée |
|---|---|---|
| **Composite 7 métriques** (L5/L10) | 58,6-59,8 % | Les 6 métriques formelles diluent un bon signal avec du bruit |
| **Élo fenêtré** (fenêtre seule, sans les 6 autres) | 57,8-58,0 % | Le rétrécissement bayésien `n/(n+8)` tasse les écarts vers zéro. Plus la fenêtre est courte, plus c'est pire |
| **Poids ajustés par régression logistique L2** (cible frame, λ en walk-forward) | Σ\|w\| = 0,121 | Solution quasi plate : après standardisation, les 6 métriques n'apportent **rien** de plus que l'Élo |
| **Allonger la fenêtre Élo** | Non testé | Déjà couvert par `eloW10`, pas mieux que `elo` |

Deux métriques du composite se sont révélées **quasi binaires** sur données réelles
(documenté dans `L10_METRIC_CAVEATS`) :

- `decider` : absente de **37,4 %** des fenêtres L5, et p25 = 0 / p75 = 100 quand elle existe
- `resilience` : p50 = p75 = **100 %** — elle ne sépare pas « gagne souvent » de « gagne en se faisant rattraper »

---

## Ce qui est en production

| Élément | Statut |
|---|---|
| `pFrame` (prédictions live / over / handicap) | **Élo** — le meilleur modèle mesuré |
| `scoreFromPowerScore` (PowerScore de carrière) | Actif — 6 copies dédoublonnées en une source unique (`src/lib/snooker/player-score.ts`) |
| L5 / L10 (PowerScore fenêtré) | **Affichage seul** via `/api/v1/snooker/power-score` — jamais branché sur `pFrame` |

Le fait que L5/L10 ne soit pas en production **n'est pas une prudence de façade** :
c'est la sortie des gates. Brancher un modèle moins bon que la référence produirait
des prédictions moins bonnes, avec une confiance affichée plus élevée — le pire
des deux mondes.

---

## Reproduire la validation

```bash
# Le harness est pur : il prend des lignes et rend des métriques.
# Aucune écriture, aucun accès réseau.
bun test src/lib/__tests__/snooker-power-score.test.ts
```

La validation complète (walk-forward sur 115 862 matchs) est un appel unique :

```ts
import { validatePowerScore } from "@/lib/snooker/snooker-power-score-validate";
const result = validatePowerScore(loadSnookerL10Rows());
console.log(result.gates.pass, result.gates.failed);
```

Découpage : TRAIN ≤ 2014-06-30 · VALIDATE → 2019-06-30 · **TEST ≥ 2020-07-01 lu une
seule fois**.

---

## Si la question revient

1. **« Peut-on faire mieux que 61,5 % ? »** → Oui, mais il faut des données par
   tir. Voir « Ce qui manque concrètement » ci-dessus.
2. **« Pourquoi tester 3 modèles si l'Élo suffit ? »** → Parce que c'est **mesuré**,
   pas supposé. Le harness conserve les modèles rejetés pour que personne ne
   refasse le chemin.
3. **« La base est-elle fiable ? »** → Voir la section « le vainqueur en premier ».
   Les taux de victoire par joueur sont plausibles (O'Sullivan 75,5 %, bas de
   tableau 20-29 %), donc la reconstruction tient.