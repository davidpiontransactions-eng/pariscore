# Tennis Prematch — Bug Elo/Ranking + Enrichissement SPS

> **Mission**: Régression `#—` / `Elo —` sur les PlayerCards Tennis Prematch + enrichissement 6 métriques.
> **Statut**: ✅ Implémentation terminée — typecheck OK (0 nouvelle erreur), en attente validation visuelle
> **Date**: 2026-07-14
- [x] Étape 1 : Debug (`#—` / `Elo —`) — diagnostic livré
- [x] Étape 2 : Enrichissement données (6 métriques) — couche DB + route API
- [x] Étape 3 : Intégration UI — composant PlayerStatline + tooltips
- [x] Câblage Graphify — graphe rafraîchi (23582 nœuds, commit fde22bb)
- [ ] Validation visuelle du match Zandschulp vs Vallejo (requiert DB peupleable)

## 📦 Fichiers livrés (implémentation)

| Action | Fichier | Rôle |
|--------|---------|------|
| Nouveau | `src/lib/tennis-stats/types.ts` | Type `PlayerStats` (6 métriques + bonus) |
| Nouveau | `src/lib/tennis-stats/db.ts` | Lecture pariscore.db via better-sqlite3 (readonly) + RANK() |
| Nouveau | `src/app/api/tennis/player-stats/route.ts` | `GET /api/tennis/player-stats?names=&surface=` (cache 60s) |
| Nouveau | `src/hooks/use-player-stats.ts` | Hook SWR (poll 5min, dégradation gracieuse) |
| Nouveau | `src/components/tennis/player-statline.tsx` | Statline primaire + tooltip shadcn |
| Modifié | `src/lib/tennis-data.ts` | Type `Player` étendu (champs optionnels) |
| Modifié | `src/components/tennis/match-card.tsx` | Intégration `<PlayerStatline>` (remplace lignes 728-731) |
| Modifié | `src/messages/fr.json` + `en.json` | Namespace `statline` (11 clés bilingues) |

---

## 🔬 Étape 1 — Diagnostic du bug

### Chaîne de données confirmée (via Graphify `query`)

```
The Odds API / BSD ─→ real-matches.ts:buildPlayer() / bsd-fetcher.ts:buildMatch()
                         │  rank: 0 (hardcodé)        ← BREAKPOINT RANKING
                         │  elo: findPlayerElo() ?? 1500
                         ▼
                  /api/tennis/prematch/route.ts (cascade BSD → Odds API → Mock)
                         ▼
                  usePrematchMatches() (SWR, poll 60s)  [hooks/use-prematch-matches.ts]
                         ▼
                  page.tsx:486 → <MatchCard>
                         ▼
                  match-card.tsx:729  <span>#{player.rank}</span>
                  match-card.tsx:731  <span>Elo {player.elo}</span>
```

### Causes racines (2 goulots)

| # | Symptôme | Cause racine | Localisation |
|---|----------|--------------|--------------|
| **B1** | `#—` (classement ATP/WTA absent) | **Le ranking n'est JAMAIS peuplé**. Les 2 fetchers hardcodent `rank: 0`. Ni The Odds API ni BSD n'exposent le rang ATP/WTA. Aucun code ne récupère le classement officiel. | `src/lib/real-matches.ts:304`, `src/lib/bsd-fetcher.ts:134` |
| **B2** | `Elo —` (Elo absent/faux) | `elo-data.json` ne contient que **6 joueurs** (alcaraz, rublev, sinner, medvedev, sabalenka, osaka). Zandschulp & Vallejo **absents** → `findPlayerElo()` retourne `null` → fallback Elo `1500`. | `src/lib/prediction/elo-data.json`, `src/lib/player-matcher.ts:79` |

### ⚠️ Divergence à éclaircir avec toi

Le code **actuel** (checkout `fde22bb`, clean git) rendrait littéralement :
- `#0` (car `rank: 0`) — **pas** `#—`
- `Elo 1500` (car fallback `DEFAULT_ELO`) — **pas** `Elo —`

Or ta capture montre `#—` et `Elo —` (em-dash). Il n'y a **aucun fallback `—`** dans le JSX (`match-card.tsx:729/731` interpolent la valeur brute). Le `—` vient donc probablement :
1. **D'un build déployé antérieur/différent** (le prod peut runner un bundle plus ancien où un guard `?? '—'` existait), ou
2. Les valeurs ont été **explicitement passées en string `"—"`** côté mock pour simuler l'absence.

➡️ **Ce point ne change pas la stratégie de réparation** : il faut de toute façon (a) un vrai ranking ATP/WTA et (b) un Elo réel pour tous les joueurs. Je propose en bonus d'ajouter le guard `—` pour masquer proprement les valeurs inconnues (meilleur UX que `#0`/`Elo 1500`).

### Ce qui existe DÉJÀ (infra cachée, non câblée au Next.js)

La DB `pariscore.db` (populée en **prod**, vide en local) contient TOUT :

| Table | Colonnes clés | Rôle |
|-------|---------------|------|
| `tennis_players_elo` | `atp_rank`, `wta_rank`, `elo_rating`, `circuit` | **Elo global + ranking ATP/WTA** |
| `tennis_elo` | `surface` (Hard/Clay/Grass/Carpet/ALL), `elo`, `matches_count` | **Elo Surface** par surface |
| `player_surface_scores` | `sps`, `aptitude_score`, `confidence_full` | **SPS** (cron Python) |
| `tennis_sps_weekly` | `surf_rank`, `ps_rank`, `surf_total`, `ps_total` | **Classements** SPS + Surface |

Le legacy `server.js` expose déjà ces données :
- `GET /api/v1/tennis/elo/rankings`, `/api/v1/sps?ids=`, `/api/v1/sps/:matchId`
- Enrichissement inline `elo_surface`, `surf_rank`, `powerscore`, `ps_rank` (`server.js:22685-22697`)

---

## 🎯 Étape 2 — Plan d'enrichissement (6 métriques)

### Stratégie recommandée : **réutiliser, pas réinventer**

Créer une route Next.js `GET /api/tennis/player-stats` qui lit directement `pariscore.db` (via `bun:sqlite`, 3-6x plus rapide) :

```ts
// Psuedo-query par player_name (normalisé)
SELECT te.surface, te.elo           AS elo_surface
FROM tennis_elo te
WHERE te.player_name = ?             -- "Botic van de Zandschulp"

SELECT tpe.atp_rank, tpe.wta_rank, tpe.elo_rating AS elo
FROM tennis_players_elo tpe WHERE tpe.player_id = ?

SELECT sps, confidence_full, matches_played
FROM player_surface_scores WHERE player_id = ? AND surface = ?

-- Classements calculés via RANK() OVER (PARTITION BY surface ORDER BY ...)
```

### Les 6 métriques cibles

| # | Métrique | Source DB | Dispo ? |
|---|----------|-----------|---------|
| 1 | Elo standard | `tennis_players_elo.elo_rating` | ✅ |
| 2 | Ranking ATP/WTA | `tennis_players_elo.atp_rank`/`wta_rank` | ✅ |
| 3 | Elo Surface | `tennis_elo.elo` WHERE surface=? | ✅ |
| 4 | Classement Elo Surface | `RANK() OVER (PARTITION BY surface)` sur `tennis_elo` | ⚠️ à calculer |
| 5 | SPS | `player_surface_scores.sps` | ✅ |
| 6 | Classement SPS | `RANK() OVER (PARTITION BY surface)` sur `player_surface_scores` | ⚠️ à calculer |

### Normalisation des noms (jointure)

Le join Odds-API → DB se fait via `normName()` (NFD → lowercase → strip diacritics). Algorithme **identique** en JS (`server.js:8087`), TS (`player-matcher.ts`), Python (`cron_sps_updater.py:534`). Aucun risque d'incohérence.

---

## 🎨 Étape 3 — UI livrée (Statline primaire + tooltips)

Layout choisi et implémenté dans `src/components/tennis/player-statline.tsx` :
- **Ligne primaire toujours visible** : `#85 · Elo 1845 · SPS 72 ⓘ` (ranking + Elo + SPS)
- **Tooltip shadcn au survol de ⓘ** : Elo Surface + rang, SPS + rang, confiance/nb matchs
- Valeurs manquantes → `—` (guard, plus propre que `#0`/`Elo 1500`)

---

## ⚙️ Décision d'architecture : fusion côté UI (pas dans les fetchers)

**Choix** : les stats enrichies sont récupérées via `usePlayerStats()` (SWR côté client) et fusionnées dans le `<PlayerStatline>`, **sans modifier** `buildPlayer()`/`buildMatch()`.

**Raisons** :
- Les fetchers tournent côté serveur dans la cascade prematch. Y ajouter une lecture DB synchrone les fragiliserait (si pariscore.db est absent/verrouillé, tout prematch tombe).
- L'approche client-side hook est **défensive par construction** : DB absente → map vide → statline affiche `—` sans impacter le reste de la carte (photos, odds, probas).
- `player.rank` et `player.elo` restent les valeurs "de base" (fallback); le statline préfère les valeurs DB quand elles existent.

**Bonus guard** : un Elo fallback à `1500` (joueur inconnu) s'affiche désormais comme `—` plutôt que `Elo 1500` (trompeur), via le flag `eloIsFallback`.

---

## 🔄 Backfill de la DB locale (pour test visuel)

Les tables tennis sont **vides en local**. Pour tester avec de vraies données :

```bash
# Option A : lancer le legacy server.js une fois (peuple computeTennisElo)
node server.js   # puis Ctrl+C après quelques minutes

# Option B : backfill direct depuis la prod (si accès VPS)
scp ubuntu@51.75.21.239:~/pariscore/pariscore.db ./pariscore.db

# Option C : lancer le cron SPS Python (remplit player_surface_scores)
python3 cron_sps_updater.py
```

Sans backfill, le statline affichera proprement `#— · Elo —` (le guard) pour tous les joueurs — c'est le comportement attendu en local dev.

---

## 🔧 Outils de suivi configurés

- **Obsidian vault** : `.obsidian/app.json` + `.notes/missions/` (ouvrable dans Obsidian)
- **Graphify 0.9.15** : `~/.local/bin/graphify.exe` — graphe rafraîchi (23582 nœuds, commit fde22bb = HEAD)
- **Câblage ZCode** : pas de runtime hook natif (graphify `install` ne supporte pas ZCode) → la directive `AGENTS.md` existante documente l'usage. Le binaire est à `~/.local/bin/graphify.exe`.
- **Validation qualité** : `npx tsc --noEmit` = 0 nouvelle erreur (les 3 erreurs match-card préexistentes sont confirmées par `git stash` comparatif). ESLint globalement cassé (problème `zod-validation-error` préexistant).
