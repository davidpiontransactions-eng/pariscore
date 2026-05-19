# Rapport — Tennis : scoreboard non activé sur certains matchs live

> Date : 2026-05-19 · Statut : **ANALYSE — aucun correctif appliqué** (validation DG requise avant patch)
> Cas observé : WTA Internationaux de Strasbourg — Peyton Stearns vs Daria Kasatkina — 19/05 13:20, terre battue. Cellules scoreboard = `—` (vides).

---

## 1. Symptôme

Match présent dans le tableau value-bets tennis (forme, rangs, SDI 1892→1714, H2H Kasatkina 2-0, probas 66.3%/73.1% affichés correctement) mais le **bloc scoreboard sets/jeux est en état vide** (`—` / `·`).

## 2. Chaîne de données (établie par trace read-only)

| Étage | Fichier:ligne | Rôle |
|---|---|---|
| Feed value-bets (la ligne de l'écran) | `pariscore.html:11913` `/api/v1/tennis/value-bets` | Données affichées |
| Feed live BSD | `pariscore.html:10945` `/tennis/api/v2/matches/live/` | Source live primaire |
| Fallback LiveScore | `pariscore.html:10895-10899` | **Déclenché SEULEMENT si BSD = tableau vide** (`10950 if(!list.length)`) |
| Jointure live↔value-bets | `pariscore.html:11597-11613` `buildUnifiedTennis` | Clé `_tnJoinKey = norm(p1\|p2\|tournoi)` (`11581`) |
| Détection live | `pariscore.html:10853-10894` `_lsIsLive` / `_lsMapEvents` | `is_live = !['NS','FT','Canc.','Postp.','Walkover','Abn.','Ret.'].includes(status_raw)` |
| Rendu cellule | `pariscore.html:11075-11089` `_tvbScoreCell` | Early-return état vide si `!m._isLive \|\| !lo` |
| Live "réel" strict | `pariscore.html:11584-11593` `_tnActuallyLive` | Exige `is_live===true` ET jeux/sets/points > 0 |
| Normalisation serveur | `server.js:16233-16367` `_lsNormEvent`/`getLivescoreTennis` | `NS`/`FT` passent en `status_raw`, aucun filtre ne supprime les matchs à venir |
| Live BSD serveur | `server.js:12711` | `is_live = (state === 'in')` (state ESPN) |

Le `—` n'est **pas un crash** : c'est l'état vide explicite de `_tvbScoreCell` (`11081`).

## 3. Causes racines — classées par probabilité

### (A) Match programmé, pas encore commencé — FAUX POSITIF probable
13:20 = heure de début. Si capture avant le coup d'envoi : `status_raw='NS'` (LiveScore) / `state='pre'` (ESPN/BSD) ⇒ `is_live=false` ⇒ `_tvbScoreCell` early-return `11081`. **Le `—` est alors le comportement correct.** À écarter en priorité (vérif horaire réel de la capture).

### (B) Échec de jointure dans `buildUnifiedTennis` — CAUSE BUG la plus probable
`_tnJoinKey` (`11581`) = fuzzy match `player1|player2|tournoi` entre feed value-bets et feed live. Le tournoi a des libellés divergents selon source : « Internationaux de Strasbourg presented by Mammotion » (value-bets) vs « Strasbourg » / « WTA Strasbourg » (live). Ordre joueurs p1/p2 potentiellement inversé entre sources. Pas de jointure ⇒ `m._live=null; m._isLive=false` (`11604`) ⇒ scoreboard vide **alors que le match est réellement live**. Le libellé long visible à l'écran renforce cette hypothèse.

### (C) Fallback LiveScore jamais déclenché — PLAUSIBLE
`tickTennisLive` ne bascule sur LiveScore que si BSD renvoie **tableau vide** (`10950`). Si BSD renvoie d'autres matchs live mais pas Stearns/Kasatkina, `list.length>0` ⇒ LiveScore jamais interrogé ⇒ ce match n'entre jamais dans `_tennisLastFetch` ⇒ aucune donnée à joindre.

### (D) `_tnActuallyLive` trop strict — MOINS PROBABLE
Même jointure réussie : si l'objet live a sets 0-0 / aucun point (échauffement, 1er jeu pas fini), `_tnActuallyLive` (`11588-11592`) classe la ligne non-live ⇒ `—` jusqu'au 1er jeu.

### (E) Routage préfixe `ls:` — IMPROBABLE
`openTennisDetail` (`12776`) gère `ls:` correctement. Impacte seulement la modale détail, pas les cellules scoreboard.

## 4. Vérification recommandée (avant tout patch)

1. **Confirmer/écarter (A)** : logguer `status_raw` + `state` du match au moment observé. Si `NS`/`pre` → faux positif, aucun bug.
2. **Confirmer (B)/(C)** : instrumenter `_tnJoinKey` — logger les clés des deux feeds côte à côte et détecter les non-collisions (tournoi/ordre joueurs). Vérifier si le match est présent dans le feed live BSD ou seulement LiveScore.

## 5. Correctifs proposés (NON appliqués — attente validation)

- **Fix B (jointure robuste)** : normaliser le tournoi (strip suffixes sponsors « presented by … », préfixes « WTA/ATP », accents) dans `_tnJoinKey` ; rendre la clé joueurs ordre-insensible (`sort([p1,p2])`).
- **Fix C (fallback)** : déclencher LiveScore en *complément* (merge) et non en substitution — fusionner BSD ∪ LiveScore par clé normalisée, au lieu du `if(!list.length)` exclusif (`10950`).
- **Fix D (tolérance)** : assouplir `_tnActuallyLive` pour accepter `is_live===true` même à 0-0 (afficher 0-0 plutôt que `—` dès que match en cours).
- **Fix A (UX)** : si match non-live mais kickoff < X min, afficher un état « à venir HH:MM » distinct du `—` ambigu.

## 6. Routing par match — état

- value-bets : `/api/v1/tennis/value-bets` (`11913`) — OK, données affichées.
- live BSD : `is_live=(state==='in')` (`server.js:12711`) — OK structurellement.
- fallback LiveScore : conditionnel **exclusif** (`10950`) — **point faible architectural** (cause C).
- jointure : fuzzy 3-champs sans normalisation tournoi/ordre — **point faible** (cause B).
- détail `ls:` : OK (`12776`).

---

**Décision attendue DG** : valider l'ordre des correctifs (recommandé : vérif 4.1 d'abord pour écarter A, puis Fix B + Fix C). Aucune modification code tant que non validé.
