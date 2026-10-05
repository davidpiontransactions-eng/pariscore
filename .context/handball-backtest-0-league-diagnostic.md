# Handball : le backtest prod renvoie 0 ligue — cause racine et correctif

**Date** : 2026-10-05 · **Statut** : cause racine identifiée, correctif d'audit posé,
rebuild du binding natif à faire.

## Symptôme

`GET /api/handball/backtest-db` répond `200` avec :

```json
{"league":null,"result":null,"reason":null,"leagues":[],"updatedAt":"..."}
```

et avec un paramètre `league` :

```json
{"reason":"Ligue inconnue du registre : starligue","leagues":[]}
```

Le sélecteur de backtest est vide en production.

## Le faux diagnostic (coût : deux cycles)

`getLeagueBacktest` produisait « Ligue inconnue du registre » pour **deux**
causes distinctes :

1. l'id demandé n'est pas au registre ;
2. `listBacktestLeagues()` renvoie `[]` parce que `getDb()` renvoie `null`.

Le second cas est **base injoignable**, mais le message accusait le registre —
qui était sain. Deux diagnostics ont été menés sur le registre (dont une
« régression » de `normalizeHandballLeague`) alors que le registre n'avait rien.

Le test de cette session a envoyé `?league=France: Starligue` — un **nom** —
alors que la route attend un **id**. Troisième sonde invalide de la même famille
qu'après la sonde BetExplorer : **mesurer l'instrument avant de conclure sur la
cible.**

## Cause racine : ABI Node v137 vs runtime Bun

Le process web est `pariscore-next`, lancé par `/home/ubuntu/.bun/bin/bun`
avec `cwd=/home/ubuntu/pariscore`. Les logs montrent `better-sqlite3` parcourir
tous ses candidats de binding sans succès :

```
→ /home/ubuntu/pariscore/lib/binding/node-v137-linux-x64/better_sqlite3.node
→ /home/ubuntu/pariscore/build/Release/better_sqlite3.node
  (+ 10 autres)
```

Le binding a été compilé pour l'ABI **Node v137** ; le runtime est **Bun**.

Chaîne complète :

1. `require("bun:sqlite")` échoue dans le bundle standalone (le bundler Require
   l'ABI Node) ;
2. `require("better-sqlite3")` charge le wrapper JS mais ne trouve pas le `.node`
   pour cet ABI ;
3. `getDb()` renvoie `null` → `listBacktestLeagues()` renvoie `[]` → l'API
   affiche « Ligue inconnue du registre ».

`serverExternalPackages: ["better-sqlite3", "pariscore-services"]` est **déjà**
déclaré dans `next.config.ts:87`. Ce n'est donc **pas** un problème de copie de
fichier : c'est un conflit d'ABI.

### Pistes écartées (avec preuve)

- **cwd standalone** — FAUX. `cwd=/home/ubuntu/pariscore`, donc
  `path.join(cwd, "pariscore.db")` pointe sur le bon fichier, qui existe
  (515 Mo). L'hypothèse « `.next/standalone/pariscore.db` absent » était
  plausible mais infirmée par `pm2 jlist`.
- **Base absente / vide** — FAUX. `handball_match_history` compte 9 000 matchs,
  `France: Starligue` = 276, colonnes de cotes présentes.
- **Registre** — SAIN. `VARIANT_TO_CANONICAL` contient `'france: starligue'` et
  `HAND_BALL_LEAGUES[0].id === 'starligue'`.
- **Requête par id** — l'id correct `starligue` échoue aussi, ce qui a éliminé
  l'erreur de paramètre comme cause unique.

## Correctif d'audit posé dans ce commit

Deux fichiers, aucun changement de comportement métier :

**`src/lib/handball-history-db.ts`**
- `getDb()` teste `existsSync(SQLITE_FILE)` **avant** d'ouvrir, et journalise
  `Base de données introuvable au chemin : …` avec `cwd` et `DATABASE_PATH`.
- Nouvelle export `historyDbError()` qui expose la raison de l'indisponibilité.

**`src/lib/handball-backtest-history.ts`**
- `getLeagueBacktest` distingue les deux causes : si la ligue **est** au
  registre (`getHandballLeague`) et que la base est muette, le message nomme la
  base. Sinon, et seulement sinon, « Ligue inconnue du registre ».

**`src/lib/__tests__/handball-db-unavailable.test.ts`** (nouveau, 3 tests)
- Un `DATABASE_PATH` inexistant est détecté sans requête et sans exception.
- `listBacktestLeagues()` renvoie bien un tableau quand la base est muette.
- Les 11 ligues restent déclarées au registre indépendamment de la base — c'est
  ce qui permet au message d'erreur de séparer les deux causes.

Gates : 1110/1110 tests, lint 0, typecheck 0.

## Correctif à venir — Voie B d'abord

Décision : **rebuild du binding natif pour Bun**, sans toucher au chemin de
lecture. `better-sqlite3` reste le chemin critique de tout le handball ; un
refactoring vers `bun:sqlite` dans le même gesto serait un changement à deux
variables, donc impossible à attribuer.

- **Voie B** — `bun pm trust` / rebuild de `better-sqlite3` pour l'ABI Bun.
  Aucun changement de code.
- **Voie A** — chantier dédié si B s'avère instable en standalone : faire
  résoudre `bun:sqlite` par un accès runtime non bundlé.

## Conséquences ouvertes

- **Le backfill VPS est bloqué.** La table y a 9 000 matchs, sans Superlig ni
  Liga Nationala Women. Tant que `getDb()` est muet, le cron écrit peut-être
  dans un mauvais fichier — à vérifier après le unlock.
- **`handball_match_history` mélange deux namings** sur la même table :
  BetExplorer (`France: Starligue`) et Flashscore (`A1`, `Allsvenskan`,
  `Poland: I Liga`, `World: Club Friendly`). C'est la raison d'être du registre,
  mais cela veut dire qu'un cron Flashscore et un cron BetExplorer écrivent dans
  la même table avec des conventions de nommage différentes.