# Tennis Prematch — Enrichissement complet des 6 métriques par joueur

> **Spec issue du brainstorming multi-expertise (data + backend + frontend engineer)**
> Date : 2026-07-15
> Contexte : Bug `#—` / `Elo —` sur pariscore.fr (legacy) — l'Elo est désormais corrigé
> (commit `ba5bf06`), mais 5 métriques sur 6 restent manquantes dans l'UI.

## Objectif

Afficher les **6 métriques** suivantes sous le nom de chaque joueur dans l'onglet
Tennis Prematch de pariscore.fr (frontend legacy `pariscore.html`), alimentées par
une chaîne data → backend → frontend cohérente et exhaustive :

1. **Elo standard** (overall)
2. **Ranking ATP ou WTA** actuel
3. **Elo Surface** (Elo spécifique à la surface du match)
4. **Classement Elo Surface** (rang du joueur sur cette surface)
5. **SPS** (Surface PowerScore [0-100])
6. **Classement SPS** (rang SPS sur cette surface)

## État constaté en production (diagnostic vérifié)

Mesures réelles sur `pariscore.db` (VPS `ubuntu@51.75.21.239`) :

| # | Métrique | Source | Population prod | Échantillon Zandschulp |
|---|----------|--------|-----------------|------------------------|
| 1 | Elo standard | `tennis_players_elo.elo_rating` | 6035 joueurs | 1724 ✅ |
| 2 | Rank ATP/WTA | `tennis_players_elo.atp_rank` | **0 / 6035** (null) | null ❌ |
| 2' | Rank (fallback) | `tennis_matches.winner_rank` | **25437 rows** | **26** (2026-05-25) ✅ |
| 3 | Elo Surface | `tennis_elo.elo` (per surface) | 15251 rows | Clay=1757 ✅ |
| 4 | Classement Elo Surface | calcul `RANK()` sur `tennis_elo` | computable (1346 ATP/Clay) | computable |
| 5 | SPS | `player_surface_scores.sps` | **0 rows** (cron ne tourne pas) | absent ❌ |
| 5' | SPS (weekly partiel) | `tennis_sps_weekly.sps_score` | 246 rows (top ~41/surface) | absent ❌ |
| 6 | Classement SPS | `tennis_sps_weekly.ps_rank` | 246 rows | absent ❌ |

**Le ranking ATP/WTA a une source viable** : `tennis_matches.winner_rank` contient
le rang officiel au moment du match (25437 rows, 99% de couverture).

**Le SPS est le gap principal** : le cron Python `cron_sps_updater.py` existe,
démarre sans erreur, mais ne trouve aucun match à enrichir (route `/upcoming`
vide) et n'écrit donc rien dans `player_surface_scores`.

## Décisions actées (brainstorming)

1. **SPS** : calculer pour TOUS les joueurs via le cron Python réparé (pas de
   métrique alternative, pas de calcul à la volée uniquement).
2. **Ranking** : utiliser `winner_rank`/`loser_rank` du match le plus récent dans
   `tennis_matches` comme source (les colonnes `atp_rank`/`wta_rank` sont vides).
3. **Frontend** : backend d'abord (server.js = source unique), affichage dans le
   legacy `pariscore.html` (ce que voit l'utilisateur sur pariscore.fr).
4. **Approche SPS** : Approche A — réparer le cron Python existant + backfill,
   plutôt qu'un batch JS à la volée.

## Architecture — 3 couches

### Couche 1 — Data (cron Python + DB)

**Composant : `cron_sps_updater.py` + pm2**

Le cron existe et tourne mais obtient 0 matchs car il lit
`/api/v1/tennis/upcoming` qui renvoie un format minimal (218 bytes, IDs seuls
sans noms joueurs exploitables). Deux changements :

- **Source de joueurs** : plutôt que dépendre de la route HTTP `/upcoming`
  (fragile, format changeant), le cron doit lire directement les joueurs actifs
  depuis `tennis_matches_internal` (23197 rows en prod) — tous les joueurs
  ayant joué dans les 12 derniers mois, groupés par surface. C'est plus robuste
  et couvre 100% des joueurs qu'on risque d'afficher.

  Concrètement : `SELECT DISTINCT winner_player_id, winner_name, surface FROM tennis_matches_internal WHERE match_date >= <12mo ago>` (et pareil pour `loser_*`), déduplication par `(player_id, surface)`. Le cron `cron_sps_updater.py:PlayerStatsSource.fetch_aggregate` lit déjà `tennis_matches_internal` (ligne ~274) — il faut juste remplacer l'étape 1 (fetch HTTP `/upcoming`) par cette requête SQL directe pour obtenir la liste des joueurs à traiter.
- **Branchement pm2** : ajouter un process `pariscore-cron-sps` dans
  `ecosystem.config.js` avec `cron_restart: '30 5,17 * * *'` (2×/jour, déjà
  prévu dans le docstring du script).
- **Backfill initial** : un lancement manuel unique pour peupler
  `player_surface_scores` (~1300 joueurs/surface × 6 surfaces, ~15 min).

Résultat attendu : `player_surface_scores` passe de 0 à ~7800 rows, couvrant
tous les joueurs actifs.

### Couche 2 — Backend (server.js, 3 changements ciblés)

**Changement 2a — `_getPlayerRank` (L39220) : fallback winner_rank**

Actuellement `_getPlayerRank` lit `tennis_players_elo.atp_rank` (toujours null).
Ajouter un fallback : si null, requêter le `winner_rank`/`loser_rank` du match le
plus récent du joueur dans `tennis_matches`.

```js
// Pseudo (statement préparé, réutilisé dans la boucle value-bets) :
const _stmtRecentRank = sqldb.prepare(`
  SELECT winner_rank AS rk FROM tennis_matches
    WHERE winner_name = ? AND winner_rank IS NOT NULL AND winner_rank > 0
    ORDER BY tourney_date DESC LIMIT 1
  UNION ALL
  SELECT loser_rank AS rk FROM tennis_matches
    WHERE loser_name = ? AND loser_rank IS NOT NULL AND loser_rank > 0
    ORDER BY tourney_date DESC LIMIT 1
  ORDER BY rk LIMIT 1
`);
// _getPlayerRank retourne atp_rank/wta_rank si présent, sinon le winner_rank récent.
```

**Changement 2b — `getTennisSurfStats` (L29602) : fiabiliser**

Vérifier que `surf_rank` et `ps_rank` sont bien calculés. Le gate actuel
(`eloRow.player_id` L29614) doit passer maintenant que `getTennisEloByName`
retourne des vraies lignes (post-fix surface). Si `player_surface_scores` est
encore vide (avant backfill), `powerscore`/`ps_rank` restent null — acceptable
(transitoire).

**Changement 2c — `_buildTennisValueBetsCore` (L39616) : attacher les 6 champs**

Les champs sont déjà attachés dans l'`Object.assign` (L39617-39628). Aucune
modification structurelle nécessaire — juste vérifier qu'ils ne sont pas
écrasés par null. L'audit a confirmé que `rank`, `elo_surface`, `surf_rank`,
`powerscore`, `ps_rank` sont tous présents dans la réponse (même si null).

### Couche 3 — Frontend (pariscore.html `premierCard`)

**Composant : `premierCard(m)` (L26045)**

Actuellement (L26100-26108) :
```
#{p1.rank||'—'}     Elo {p1.elo_surface||'—'}
```

Layout cible — **statline primaire + badges surface compacts** :
```
Botic Van De Zandschulp
#26 · Elo 1758 · SPS 42
[#12 Clay]  ← badge surface (Elo Surface rank)
```

- Ligne primaire (toujours visible) : `#26` (rank) · `Elo 1758` (elo_surface) · `SPS 42` (powerscore)
- Badge surface : `#12` (surf_rank) avec libellé surface. Masqué si null.
- Chaque valeur null → `—` (jamais `0` ou valeur bidon).
- Réutilisation des CSS hooks `.sc-premier-prank`, `.sc-premier-pelo` existants
  + ajout `.sc-premier-sps`, `.sc-premier-surfrank`.

Aucun changement à `mapMatch` (L26815) — il forward déjà tous les champs.

## Gestion des données manquantes

| Cas | Comportement UI |
|-----|-----------------|
| Elo null | `Elo —` (rare — 6035 joueurs en base) |
| Rank null | `#—` (transitoire si joueur pas dans tennis_matches) |
| Elo Surface null | `Elo —` (ne devrait plus arriver post-fix fallback ALL) |
| surf_rank null | badge surface masqué |
| SPS null (avant backfill) | `SPS —` (se remplit après backfill cron) |
| ps_rank null | omis |

Principe : **toujours afficher le label**, valeur `—` si inconnue. Pas de
masquage de ligne — l'utilisateur voit que la métrique existe.

## Plan de validation

1. **Backend** : `curl /api/v1/tennis/value-bets` → vérifier que Zandschulp a
   `rank: 26`, `elo_surface: 1757`, `surf_rank: <num>`, `powerscore: <num>`.
2. **Cron** : `python3 cron_sps_updater.py` manuel → vérifier
   `player_surface_scores` se remplit (COUNT > 0).
3. **Frontend** : Playwright sur pariscore.fr onglet Tennis → capturer premierCard,
   vérifier les 6 métriques rendues (pas de `—` pour Zandschulp).
4. **Non-régression** : les autres champs (probabilités, odds, serve_index)
   restent intacts.

## Périmètre exclu (YAGNI)

- **Pas de migration vers Next.js pour cet onglet** — le legacy est ce que voit
  l'utilisateur. Le code Next.js PlayerStatline existant (commit `841dddd`) reste
  pour la migration future mais n'est pas déployé.
- **Pas de recalcul du moteur de prédiction** (`predict()`, Markov) — on
  n'ajoute que de l'affichage de données déjà calculées.
- **Pas de nouvelle source de rang officiel** (feed ATP/WTA payant) —
  `winner_rank` Sackmann suffit pour la fraîcheur requise.
- **Pas de recalcul Elo** — `tennis_elo` est déjà peuplé par `computeTennisElo()`.

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Cron Python ne trouve toujours pas de joueurs | Lire `tennis_matches_internal` directement (pas HTTP) |
| `winner_rank` daté (dernier match, pas aujourd'hui) | Acceptable — le rang évolue lentement ; note en tooltip |
| Charge CPU backfill SPS (~15 min) | Lancer en manuel hors peak, une seule fois |
| Régression layout premierCard | Test Playwright avant/après sur pariscore.fr |

## Fichiers touchés

| Couche | Fichier | Changement |
|--------|---------|------------|
| Data | `cron_sps_updater.py` | Source joueurs : `tennis_matches_internal` au lieu de HTTP |
| Data | `ecosystem.config.js` | +process `pariscore-cron-sps` |
| Backend | `server.js` | `_getPlayerRank` fallback winner_rank |
| Backend | `server.js` | Vérification `getTennisSurfStats` (fiabilisation) |
| Frontend | `pariscore.html` | `premierCard` statline 6 métriques + badges |
