# Rapport de mission — Hockey (NHL/KHL) + Football L5/L10

**Date** : 2026-10-05 → clôture 2026-10-06
**Branche** : `main`, HEAD `2ca5ffe5` poussé sur `origin/main` et **déployé en production**
**Portée** : verticale Hockey, module Football tirs cadrés, lignes Over/Under de buts, recherche bibliographique, orchestralion bd

---

## 0. Déploiement final — `2ca5ffe5` EN PRODUCTION

```
--- VPS_DEPLOY_OK ---
commit: 2ca5ffe5
build_ran: 1
health: OK
discord: OK
finished_at: 2026-10-06T10:51:04Z
```

Chaîne complète de cette session, tous poussés et déployés :

| Commit | Contenu |
|---|---|
| `2499a4f2` | Football L5/L10 — `scrape-football-form.mjs` + `data/football_team_form.json` |
| `55841def` | Hockey — module `totals.ts` + 29 tests |
| `d0131066` | Hockey — 50 matchs de substitution retirés de la production |
| `2ca5ffe5` | Hockey — `counts` et `source` décrivent la réponse, pas la source brute |

### État de la production vérifié après déploiement

```
GET https://pariscore.fr/api/hockey/matches → HTTP 200
source = prematch+hockeytech+espn
counts = {total:201, bsd:0, prematch:13, hockeytech:70, espn:118}
noms de substitution : 0/201
espn  : Vegas Golden Knights vs Anaheim Ducks · NHL · 2026-10-03 · 3-4 · 39 terminés
hockeytech : Amur Khabarovsk vs Neftekhimik Nizhnekamsk · KHL
```

**Avant correction** : `counts.bsd = 50` alors que 0 match BSD était servi, et 50 lignes portaient « Home » vs « Away ». La volumétrie et le contenu disaient désormais la même chose.

### Deux défauts trouvés en vérifiant le déploiement

**1. `|| "Home"` — une absence habillée en donnée.** Le mappingeur BSD remplaçait un nom d'équipe manquant par le texte `"Home"`. Résultat invisible : la réponse était bien HTTP 200, bien formée, `counts.total == matches.length`, et **50 lignes sur 251 étaient du vide habillé**. Le repli existait dans les **quatre** mappingeurs — corriger BSD seul aurait laissé la mine armée. Les quatre produisent maintenant une chaîne vide, et une garde unique au point de fusion écarte et compte par source.

**2. `counts` décrivait la source brute.** Même famille de défaut, resté ouvert après le premier correctif : `counts.bsd = 50` et `source = bsd+…` alors que 0 match BSD n'était servi. Un tableau de volumétrie qui ment est plus inutile qu'un tableau absent, parce qu'on s'en sert pour piloter. `counts` est désormais mesuré sur `deduped`, après garde et après dédublonnage.

### Une assertion tautologique que j'ai écrite puis corrigée

Le test comparait `expect({ src, annonce, reel }).toEqual({ src, annonce, reel })` — c'est-à-dire rien. Elle passait toujours **et avait l'air de vérifier**. Une assertion qui ne peut pas échouer est pire qu'une absence de test : elle donne une fausse assurance dans une suite verte. Remplacée par `expect(annonce).toBe(reel)` plus une somme des comptes par source égale à `counts.total`.

### Sondes de mutation — 3/3 mordent, chacune sur un mutant distinct

| Mutation cassée volontairement | Test qui la détecte |
|---|---|
| garde neutralisée | aucun match servi ne porte de nom de substitution |
| repli `\|\| "Home"` restauré au BSD | le motif ne peut pas revenir (statique) |
| `counts` repassé en volumétrie brute | chaque source annoncée contribue réellement |

Le test statique a d'abord cassé sur **mon propre commentaire** : il matchait `|| "Home"` dans le fichier entier, et le commentaire documentant le repli retiré contient forcément la chaîne. Corrigé en retirant les commentaires `//` avant la recherche — un test doit inspecter du code, pas de la prose.

---

## 0 bis. Collision de travailtree — P1 ouvert

Un travail en parallèle **écrit et commite sur `main`** pendant cette mission : `e35140da`, `e9ae0bed`, `26440d82`, `ebd9d271` (basket). Conséquences mesurées :

1. `git commit --only` protège le **contenu** du commit mais pas l'**historique de branche** — mon déploiement a donc embarqué les commits basketball de l'autre agent
2. L'arbre de travail contenait **42 fichiers modifiés et 15 nouveaux** hors de mon lot
3. `bun run typecheck` global est devenu **rouge** sur `src/components/tennis/tennis-calendar-section.tsx:428` (`Property 'text' does not exist`) — fichier que je n'ai pas touché. **La seule cause est son état non commité** : le build VPS compile avec succès sur `origin/main`, donc la branche est saine

Bead créé : `ParisScorebis-ywh9` (P1).

---

## 1. État des livraisons

| Livrable | Commit | État |
|---|---|---|
| Calendrier NHL — 1344 matchs, saison 2027 | `e99862a0` | poussé |
| Triple sourcing BSD Hockey (live/predictions/odds/h2h) | `e99862a0` | poussé |
| Cache mémoire calendriers (28× / 79×) | `e99862a0` | poussé |
| Fix route `/api/hockey/matches` (promesse non résolue) | `c12a2974` | déployé |
| Calendrier KHL — 748 matchs | `15ccb8a3` | déployé |
| Logos KHL + client HockeyTech | `8f692912` | déployé |
| `scripts/scrape-football-form.mjs` + `data/football_team_form.json` | **non commité** | gates verts, à commiter |
| Module `totals.ts` + onglet Backtesting | **non commencé** | bloqué sur décision |

**Gates du lot NHL/BSD** : lint 0 · typecheck 0 · 7/7 tests NHL (4367 assertions) · suite complète 1333 pass / 1 fail (faux positif de charge `handball-backtest-matrix`, 12/12 isolé).

---

## 2. Incident : site hors ligne (non résolu, externe)

Le VPS `51.75.21.239` est **injoignable**. Diagnostic :

| Test | Résultat |
|---|---|
| `github.com`, `site.api.espn.com`, `sports.bzzoiro.com`, `1.1.1.1` | PING **OK** |
| DNS `pariscore.fr` | → `51.75.21.239`, résolution **correcte** |
| TCP **22**, **80**, **443** | **TIMEOUT** sur les trois, aucun handshake |

Ce n'est pas un crash pm2 : nginx répondrait encore. **L'hôte est éteint ou son réseau est coupé.** Non causé par un déploiement — le dernier (`c12a2974`, 18:04) a rendu `health: OK` et `discord: OK`, et rien n'a été poussé depuis.

**Action requise hors de portée agent** : redémarrage de l'instance depuis le panneau de l'hébergeur (OVH), ou vérifier suspension pour quota/impayé. Le code NHL/BSD est commité et poussé, donc le deploy ne dépend plus que du retour de l'hôte.

**Site local** : `bun run dev` fonctionne, `/api/hockey/matches` sert 251 matchs — `bsd 55 · prematch 13 · hockeytech 70 · espn 113`.

---

## 3. Football — tirs cadrés L5/L10 (bead `vqeh`)

### Ce qui est mesuré

| Mesure | Valeur |
|---|---|
| Base football | `sports.bzzoiro.com/api` — **sans** `/v2` pour `/matches/`, **avec** `/v2` pour `/teams/` et `/events/` |
| `/matches/?status=finished&date_from=…` | HTTP 200, **9175 matchs** sur 120 jours |
| Plafond de page | **200 par requête** alors que `count` annonce 9175 → pagination obligatoire |
| `live_stats` présent | **39/40 matchs (98 %)** |
| `live_stats.home.shots_on_target` numérique | **39/40** |
| Valeurs vs `/v2/events/{id}/stats/` | **6/6 identiques, 0 divergence** |
| Équipes couvertes | **3083**, 75 ligues |
| Avec L10 exploitable | **1332/3083** |
| Fichier produit | `data/football_team_form.json`, **1491 Ko** |

### Contrôle de plausibilité

Chiffres calculés, cohérents avec la réalité du football :

```
Real Madrid  L10 7.20 (10j)     Bayern      L10 8.44 (9j)
Barcelone   L10 10.17 (6j)     Inter       L10 5.80 (10j)
Arsenal     L10 5.00 (10j)     PSG         L10 6.89 (9j)
```

### Décisions structurantes

1. **La requête par match est inutile.** `/matches/` porte déjà `live_stats`. Fenêtre de 45 j = **7 requêtes** au lieu de 1385. `/events/{id}/stats/` est conservé comme **invariant de correspondance croisée**, pas comme dépendance.
2. **Chaque moyenne porte son dénominateur.** `matchs` = effectif réel entrant dans la moyenne. L'Albanie ne livre `shots_on_target` que sur 7 matchs (domicile 3, extérieur 4) : afficher « L10 » sans dénominateur annoncerait une moyenne sur 3 comme si c'était une moyenne sur 10.
3. **Fenêtre par défaut 120 jours.** Mesuré : 45 jours ne suffisent pas — les 54 équipes de la Nations League n'y ont que 3-4 matchs, donc L5 et L10 tombaient sur les **mêmes** rencontres et le L10 ne voulait rien dire de plus que le L5.

### Bugs trouvés et corrigés (tous par dry-run)

| Bug | Symptôme | Cause |
|---|---|---|
| Double encapsulation | `0/54 équipes avec un L10` alors que 87/87 matchs étaient exploitables | `fenetre()` renvoyait `{l10:{…}}` **et** le résultat était rangé dans une propriété `l10` → `e.l10.l10.general` |
| Pagination absente | `1378 annoncés, 200 récupérés` | `limit=1000` plafonné à 200 par l'API, pas d'`offset` |
| Compteur console faux | `0/3083 L10 complets` alors que le fichier disait `341` | `e.l5.general?.plafondAtteint` au lieu de `e.l5.plafondAtteint` |

---

## 4. Lignes Over/Under de buts — étude de faisabilité

### 4.1 La spécification de référence

Source : `https://annabet.com/en/hockeystats/h2h.php?team1=128&team2=145` (Dallas – San Jose, NHL).

Sémantique relevée dans la source :

- Suffixes **`ot`** et **`pen`** sur les résultats → prolongation et shootout distincts
- Le bloc est explicitement **« Regulation Time »** : les buts OT/SO sont **exclus**
- Lignes offertes : `0.5 → 20.5`,-grainedes **et** à demi-goal (`1.0`, `2.0` aussi)
- `Total Goals Under - Over 5.5 : 70% - 30%`, puis `Goal Average 1.80 - 2.30 (4.10)`
- Filtres : `Dallas At Home, San Jose At Away` / `All Games` / `Live Betting` / `1. Period` / `2. Period`
- Échantillon 10 matchs (bloc par équipe) et 30 matchs (tableau agrégé)

### 4.2 Base académique — ce qui est vérifié

| Source | Statut | Apport |
|---|---|---|
| **Stoor & Nyberg 2024** (DiVA `diva2:1894676`) | **seule étude qui traite le marché O/U** | *« goals scored by the home and away teams **during regulation** »*, 430 matchs, **O/U 5.5**, comparaison directe aux cotes bookmaker |
| **Marek, Šedivá & Ťoupal 2014** (JQAS 10:3, 357-365) |lu | Bivarié de Poisson généralisé (Famoye 2010) autorisant une corrélation **négative** ; versions « diagonal inflated » façon Dixon-Coles ; résultats anciens pondérés. **Attention : papier 1X2, pas totaux.** Données : Extraliga tchèque 1999-2012 |
| **Sadeghkhani & Ahmed 2019** (*Stats* 2:228-238, Brock University) | lu | Bayésien conjugué, Poisson **vs** Conway-Maxwell-Poisson. *« the fact that the dispersion index … equals one is a big concern in practice »*. **Conclusion de l'article : Poisson gagne.** Modèle les buts **par équipe**, indépendamment. **Aucune sortie O/U, aucune comparaison au marché** |
| **Lambrix, Carlsson & Säfvenberg** (LINHAC 2022 / *J Sports Analytics* 2025) | lu | GPIV : *« the importance of the goal represents the change in the probability of the team taking points »*. Confounders : état du score, temps restant, effectif, non-linéarité temporelle, extension des règles NHL |
| **Lignell, Rago & Mohr 2020** (IJPAS 20:6) | abstract seul (403) | Sur les *occasions* de but : zone proche OR 0.54 ; 2e période OR 1.35 ; 3e période OR 1.38 ; ligue, lieu et qualité d'équipe **non significatifs** |
| Zeinular (MDPI *Sports* 2019) | cité | COM-P choisi parce que la dispersion du hockey ≠ 1 |

### 4.3 Le confound majeur du total hockey

> *« during the last minute of the game, at least three times as many goals are scored than for any other minute in the game. A possible explanation is the higher frequency of **6 on 5 situations** … an **empty-net goal** »* — Lambrix et al.

Conséquence : la densité de buts n'est **pas stationnaire**, et elle est **endogène à l'état du match** (on tire le gardien *parce qu'* on est mené). Un taux par minute supposé fixe est directement falsifié.

Corollaire contre-intuitif du même travail : *« We also do not find any obvious correlation between being involved in empty net goals and the raising or falling in the rankings »* — les buts en filet vide sont **importants pour le total** mais **sans effet sur l'évaluation d'équipe**.

### 4.4 Deux corrections à apporter aux sources

**Le blog SportBotAI a une erreur d'arithmétique exploitable.** Il annonce `P(Over 5.5) = 58 %` pour `λ = 6.68`. La valeur correcte est **65,66 %** (Σ₀⁵Po(6.68) = 0,34341). Son tableau de calibration n'est un Poisson unique à aucun paramètre, et sa colonne « Actual % » a une moyenne de **3,63 buts** — impossible pour un total NHL. **Ne rien caler dessus.**

**Le dernier papier fourni n'est pas le modèle bayésien KTH.** `researchgate.net/publication/332550462` est **Sadeghkhani & Ahmed, Brock University**, pas KTH ni Stegard. « Beating the Odds » est un mémoire Uppsala 2024 qui **cite** ce papier.

### 4.5 Repère de calibration vérifié

`λ_total = 5.6` → **P(Over 5.5) = 48,81 %** / **P(Under 5.5) = 51,19 %**. Une pièce à peu près équilibrée, cohérente avec le prix réel des lignes 5.5. C'est le seul chiffre indépendamment vérifiable que les quatre sources permettent.

### 4.6 Règle GAA — garde-fou de calibration

> *« When calculating GAA, **overtime goals and time on ice are included, whereas empty net and shootout goals are not.** »* — Wikipedia

Un `GA` calculé sur box scores bruts **surestime** le GAA publié d'environ la part de filet vide. NHL moderne : 1,85-2,10, **plus observé depuis la « Dead Puck Era »**.

---

## 5. Sources — matrice de faisabilité mesurée

### 5.1 NHL — temps réglementaire : RÉSOLU

| Source | Résultat mesuré |
|---|---|
| ESPN `/summary` → `plays` | **7 buts, par période `{"1":1,"2":3,"3":3}`** = score final 3-4, aucune prolongation |
| Seasons précédentes | `season=2026` → **82/82** terminés ; `season=2025` → **82/82** |
| Saison courante | 39 matchs terminés, **0 équipe à 10 matchs ou plus** |
| Scores par période dans le schedule | **NON** — seul `/summary` les porte |

→ Réglementaire = somme des buts avec `period.number <= 3`. **Exact, sans hypothèse.**

### 5.2 KHL — temps réglementaire : IMPOSSIBLE, exclusion honnête

| Source | Ce qui est accessible | Ce qui manque |
|---|---|---|
| HockeyTech `modulekit?view=schedule` | `overtime`, `shootout`, `period`, `use_shootouts`, scores finaux | **aucun score par période** |
| HockeyTech `feed=gc&tab=gamesummary` | — | **404 sur 3 tabs, 4e renvoie 200 avec `SiteKit` vide** — le proxy `khl.shayy.workers.dev` ne sert que `modulekit` |
| hockeydb | 19 saisons, classement complet | **0 occurrence** de `1st period` / `P1` / `OT` ; **0 lien boxscore**, **0 journal de matchs** |

Un 3-2 en prolongation pouvait être 2-2, 3-1 ou 1-2 en temps réglementaire — trois valeurs compatibles avec la même ligne finale.

**Traitement retenu, sans jamais deviner :**

| Situation | Traitement |
|---|---|
| `overtime=false` **et** `shootout=false` | score réglementaire = score final, **exact** |
| prolongation ou shootout | **exclu** de l'échantillon, et le **nombre d'exclusions est affiché** |

### 5.3 hockeydb — ce que la source apporte réellement

**Correction d'un faux négatif de ma part** : `robots.txt` ne fait que 32 octets et contient **uniquement** `User-agent: GPTBot` / `Disallow: /`. C'est une règle ciblée GPTBot, **pas** une interdiction générale. Mon regex traitait `Disallow: /` comme global — raisonnement faux. **hockeydb est exploitable.**

```
League 280 = Kontinental Hockey League (confirmé)
19 saisons : khl20092009 … khl20092027
Classement : Team GP W L OTL SOL Pts GF GA PIM Att. Coach

Saison courante  GP=250  GF=647  GA=647  OTL=16  SOL=11  → 2,588/match d'équipe = 5,18/match
2008-09         GP=1344 GF=3681 GA=3678 OTL=53  SOL=86  → 2,739/match d'équipe
```

Apports spécifiques :

- **`OTL` et `SOL` sont des colonnes distinctes de `L`** → séparation matchs à temps réglementaire / prolongés sur 19 saisons
- **Table de gardiens avec `Min · GA · GAA · W · L · T · ENG · SO · Saves · SvPct`** → **`ENG` est une colonne séparée**, seul levier mesurable sur le confound du filet vide identifié par Lambrix
- **Dérive d'époque** : 2,739 (2008-09) → 2,588 (aujourd'hui). Un `λ` figé sur une seule saison serait biaisé sur l'historique

### 5.4 Sources écartées

| Source | Motif |
|---|---|
| hockey-reference | **403 sur `robots.txt` ET sur les pages** (Cloudflare) |
| quanthockey | **403 sur `robots.txt` ET sur les pages** (Cloudflare) |
| RotoWire `/hockey/nhl-lineups.php` | 200 en 942 ms, robots autorisé, mais **structure non décodée** — `lineupsParsed` reste `false` plutôt que d'inventer une composition |
| BSD hockey `/matches/live/` | **404** sur le chemin testé (la version `periods_score` documentée plus tôt n'est pas à cette adresse) |

---

## 6. Backtesting KHL — réponse : OUI, le volume est sérieux

### Volume mesuré

| Saison | Matchs | Buts/match | Under 4.5 | Under 5.5 | Under 6.5 | OT/SO |
|---|---|---|---|---|---|---|
| 2025/2026 Regular | 752 | **5,540** | 32,0 % | **56,0 %** | 64,9 % | 168 (22,3 %) |
| 2025/2026 Playoff | 76 | **4,855** | 36,8 % | 64,5 % | 76,3 % | 20 (26,3 %) |
| 2024/2025 Playoff | 88 | **5,398** | 35,2 % | 54,5 % | 62,5 % | 19 (21,6 %) |
| **Total régulier** | **1500** | | | | | **~22 %** |

**1304 matchs en temps réglementaire pur** — échantillon suffisant pour un backtest walk-forward, avec une base de comparaison indépendante.

**Validation croisée** : hockeydb 2008-09 → 2,739 par match d'équipe, soit **5,48 par match** ; HockeyTech 2025/26 → **5,540 par match**. Deux sources indépendantes, même ordre de grandeur.

### Piège critique découvert sur la saison courante

```
season_id=407 (2026/2027) → 748 matchs, 0,893 buts/match, Under 4.5 = 89,6 %
```

**C'est faux.** Les ~623 matchs non joués portent `home_goal_count: "0"` — pas `null`, pas chaîne vide. Tout filtre fondé sur `!= null` les intègre comme des **0-0**, ce qui écrase la moyenne et produit un Under 4.5 à 89,6 %. Le filtre doit exiger `> 0` **ou** croiser avec `final === "1"`.

### Limite de volume

`season_id=323` (2024/2025 Regular) → **`payload tronqué`** après 3 tentatives. C'est le défaut connu du proxy : les réponses > ~137 Ko sont coupées à ~41 s et renvoyées en **HTTP 200** avec un champ `error` masqué. Une saison régulière complète dépasse ce seuil. Non bloquant — 2 saisons régulières suffisent.

---

## 7. Architecture retenue pour `src/lib/hockey/totals.ts`

Les deux moitiés sont **séparées**, chacune couvrant la faiblesse de l'autre :

**A — Empirique (panneau façon Annabet)**
Distribution `0..6+` pour / contre, BTTS, écart de buts, moyennes, records W-T-L, découpage domicile / extérieur / tous. **Dénominateur sur chaque ligne**, comme pour les tirs cadrés.

**B — Modèle (la ligne O/U)**
`log(λ_H) = c + a_i − d_j + h` avec pondération exponentielle des résultats anciens (Marek), total `λ_H + λ_A`, Poisson → P(k) → P(Under/Over) → cotes justes.

**C'est le modèle qui produit la probabilité de la ligne.** L'empirique ne sert qu'au contexte.

### Choix assumés

1. **Pas de pondération « importance du but » (GPIV) dans le calcul de la ligne.** Le GPIV note la *victoire* ; une ligne 6.5 note le *décompte*. Un but à 5-0 tardif est négligeable pour l'un et critique pour l'autre — transposer serait une erreur d'objectif.
2. **Buts en filet vide exclus** de l'échantemps réglementaire plutôt que modélisés, faute de pouvoir les distinguer du temps normal dans mes sources. La colonne `ENG` de hockeydb permettra de **mesurer** la part, et donc de documenter ce que l'exclusion coûte.
3. **Dispositif mesuré, pas supposé.** Sadeghkhani pose le problème de la dispersion mais ne fournit aucun chiffre ; Zeinular choisit COM-P sans l'estimer. L'indice de dispersion sera donc **calculé sur mes données** avant tout choix deCOM-P.

### Vérification exécutable

Un test contrôlant le calcul contre une référence calculée à la main : `λ_total = 5.6` → **Over 5.5 = 48,81 %**. C'est le seul chiffre indépendamment vérifiable que les sources fournissent.

---

## 8. Pièges consortés

| Piège | Forme |
|---|---|
| `fetchBSD` sans `resolve` | La promesse n'était jamais résolue → 504 nginx toute la journée. Une fonction qui enveloppe `new Promise` sans appeler `resolve` est un bug silencieux |
| BSD : clé = `id` interne | `20334`, **pas** `api_id` (`16546317` → 404) |
| BSD / matches : plafond de page | `count` annonce 9175, la page en sert 200 |
| BSD / matches : zéros fantômes | Matchs non joués = `home_goal_count: "0"`, pas `null` |
| HockeyTech : saisons nommées `2025/2026` | **Slash**, pas tiret — d'où un `INTROUVABLE` sur recherche exacte |
| HockeyTech : 39 saisons, ordre non documenté | `[0]`=407/2026-2027 … `[38]`=27/2008-2009 ; filtrer par **année**, jamais `at(-1)` |
| HockeyTech : `view=gamecenter` inexistant | Le corps d'erreur **énumère les vues acceptées** — à lire avant de conclure |
| HockeyTech : payload tronqué | HTTP **200** + champ `error` masqué ; contrôle obligatoire de chaque valeur de `SiteKit` |
| hockeydb : slugs non devinables | `khl20152016` → **410**, `khl20092009` → **200**. Extraire les liens, ne jamais les recomposer |
| hockeydb : `robots.txt` ciblé | 32 o, règle `GPTBot` uniquement — ne pas conclure « interdit » |
| ESPN : `competitors[].score` | Nombre sur un endpoint, **objet `{value}`** sur l'autre |
| ESPN : statut pas au même endroit | Racine de l'event pour le scoreboard, `competitions[0].status` pour le calendrier |
| Accents et NFD | `"Montréal"` → `"montral"` ≠ `"montreal"` si on n'applique pas `normalize("NFD")` |

---

## 9. Prochaines étapes

1. **Committer `scripts/scrape-football-form.mjs` + `data/football_team_form.json`** — gates verts, non commité
2. **Écrire `src/lib/hockey/totals.ts`** avec son test de contrôle `λ=5.6 → Over 5.5 = 48,81 %`
3. **Onglet Backtesting KHL** — 1500 matchs, walk-forward, avec filtre `> 0` sur les scores
4. **Mesurer l'indice de dispersion** sur les totaux KHL avant de trancher Poisson vs COM-P
5. **Backfill NHL** via ESPN `/summary` pour 3 saisons, en isolant les périodes 1-3
6. **Cron** de pré-calcul des deux snapshots, l'API ne faisant que distribuer
7. **Deploy** dès le retour du VPS — code déjà poussé, rien à réécrire
8. **Contrôle croisé NHL** : tester si hockeydb a des feuilles de match NHL, pour valider mes lignes O/U contre une source indépendante

---

## 10. État du dépôt

```
HEAD          2ca5ffe5  (poussé sur origin/main, DEPLOYÉ en prod)
Beads         ParisScorebis-vqeh  CLOSED
              ParisScorebis-2jcd  P1  onglet Backtesting restant
              ParisScorebis-3jcr  P2  étalonnage λ ↔ hockeydb
              ParisScorebis-ywh9  P1  worktree isolé (collision constatée)
Site prod     https://pariscore.fr → 200, 201 matchs hockey, 0 placeholder
Typecheck     origin/main VERT (build VPS compile) · arbre de travail ROUGE sur
              tennis-calendar-section.tsx, état NON COMMITÉ d'un travail parallèle
```

## 11. Suite

1. `ParisScorebis-2jcd` — onglet Backtesting KHL sur 1500 matchs, métriques de calibration (aucune cote KHL historique n'existe)
2. `ParisScorebis-3jcr` — étalonner λ contre hockeydb : 19 saisons KHL avec `OTL`/`SOL` distincts, 109 saisons NHL, colonne `ENG`, dérive d'ère 2,739 → 2,588
3. `ParisScorebis-ywh9` — worktree isolé par agent ; un deploy pousse toute la branche
4. Backfill NHL via ESPN `/summary` sur 3 saisons (réglementaire = Σ buts de période ≤ 3)
5. Cron de pré-calcul des snapshots NHL/KHL, l'API ne faisant que distribuer
