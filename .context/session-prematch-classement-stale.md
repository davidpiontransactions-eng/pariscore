# Session — Prematch foot : Classement (Dom/Ext) non mis à jour

Bead : ParisScorebis-asqo (P1)
Statut : EN COURS

## Symptôme chef de projet
> Dans les cards prematch foot, les données "Classement (Dom / Ext)" ne semblent
> pas être mises à jour.

## Analyse (Phase 1 — cause racine)

### Chaîne de données
```
Client SWR use-sports-tree.ts (dedup 30s)
  → /api/football/matches (route.ts)          cache serveur 5 min
    → fetchBSDFootballPrematch()               bsd-football-fetcher.ts:500
      → per ligue: fetchBSDLeagueData(lid)     bsd-football-fetcher.ts:644
          ├– standingsCache module-level: TTL 6h   ← SUSPECT PRINCIPAL (577-578, 645-646)
          ├– /v2/leagues/{id}/season/          (cache BSD 30 min)
          ├– /v2/leagues/{id}/standings/?season_id   → injecte le TOTAL officiel
          ├– /events/?status=finished&limit=200 ×10   → construites splits Home/Away (703-735)
          └– si partial (<3 MJ): blend soccerstats saison N-1
      → attachDerivedData()                    bsd-football-fetcher.ts:834 → p.standingStats
  → football-match-card.tsx:811-835            rend standing.home / standing.away
```

### Constats clés
- Le bloc vient de `p.standingStats` (source BSD), PAS du pipeline soccerstats
  (`useLeagueRankings` n'est importé nulle part dans src/).
- `STANDINGS_TTL = 6h` (bsd-football-fetcher.ts:578) — cache mémoire module-level.
  Même si BSD met à jour scores/stands en continu, les cards prematch re-affichent
  les standings jusqu'à 6h en arrière.
- Les splits Home/Away proviennent uniquement des events `status=finished`.
- Aucun indicateur d'âge (updatedAt/asOf/source) n'est exposé dans standingStats :
  l'utilisateur n'a aucune visibilité de la fraîcheur.

### Hypothèse (Phase 2)
Le bloc Dom/Ext est figé par STANDINGS_TTL=6h + splits expirés venant des events,
sans indicateur d'âge visible côté UI.

## Correctifs prévus (root cause)
- Réduire / découpler le TTL du cache standings.
- Exposer l'âge de la donnée (asOf) + micro-tag UI "Maj HH:MM".
- Test unitaire reproduisant le bug (cache ne doit pas servir de la donnée expirée).

## Phase 1 — Preuve par couche (2026-08-29 UTC)

Sonde `scripts/probe-prematch-classement-freshness.ts` (read-only, BSD_API_KEY .env) :

| Lig | Saison BSD | Events finis aujourd'hui | Dernier event | Standings officiels |
|-----|-----------|--------------------------|---------------|---------------------|
| Ligue 1 (6) | 26/27, current | **33** | **2026-08-29** | 18 rows, max 2 MJ |
| EPL (1) | 26/27, current | **33** | **2026-08-29** | 20 rows, max 2 MJ |
| La Liga (3) | 26/27, current | **33** | **2026-08-29** | 20 rows, max 3 MJ |

**Conclusion : la source BSD est fraîche et bouge en continu (33 matchs finis ce jour).**
Le « Classement (Dom/Ext) » servi aux cards est donc figé par `STANDINGS_TTL=6h`
(bsd-football-fetcher.ts:578) — cache module-level qui resert de la donnée jusqu'à 6h d'âge.

### Autres constats
- Les splits Home/Away viennent uniquement des events `status=finished` (limit 200 ×10 pages).
- Aujourd'hui en début de saison : Ligue 1 / EPL à **2 MJ**, La Liga à **3 MJ** → beaucoup de ligues
  sont en état `partial` (<3 MJ), déclenchant le blend soccerstats N-1.
- Un joueur voit donc des chiffres Dom/Ext très faibles figés par le cache, sans indicateur d'âge.

## Correctifs prévus (root cause)
- [x] Réduire STANDINGS_TTL (6h → ~15-30 min) en conservant la perf (season/official cheap, scan events).
- [x] Exposer l'âge de la donnée (asOf) + micro-tag UI "Maj HH:MM".
- [x] Test unitaire reproduisant le bug (cache ne doit pas servir la donnée expirée).

## Phase 3 — Correction (root cause, 2026-08-29)

### 1. TTL cache standings réduit 6h → 20 min
- `src/lib/bsd-football-fetcher.ts:578-586` : commentaire + `STANDINGS_TTL = 20 * 60 * 1000` (exporté pour tests).

### 2. Âge de la donnée exposé
- `src/lib/football-data.ts:177-178` : champ optionnel `StandingContext.asOf?: string` (ISO).
- `src/lib/bsd-football-fetcher.ts:541-542` : `LeagueDerivedData.computedAt?: string`.
- `src/lib/bsd-football-fetcher.ts:836` : `computedAt: new Date().toISOString()` au moment du calcul.
- `src/lib/bsd-football-fetcher.ts:854` : `attachDerivedData` propage `asOf: data.computedAt` dans `standingStats`.

### 3. Micro-tag UI "Maj HH:MM"
- `src/components/football/football-match-card.tsx:69-75` : helper `fmtAsOfHour(iso)`.
- `src/components/football/football-match-card.tsx:822-831` : header du bloc « Classement (Dom / Ext) »
  devient flex avec badge droit « Maj HH:MM » + `title` explicatif.

### 4. Test unitaire
- `src/lib/__tests__/football-standings-freshness.test.ts` (bun:test) : TTL ≤ 30 min + présence de `asOf`.
  → `bun test`: **2 pass / 0 fail** (3 expect calls).

## Phase 4 — Qualité (2026-08-29)
- `typecheck` global : **rouge pré-existant** (tools/skyvern, tools/prompt-engineering, tests/*.spec.ts,
  football-strategy-top5) — AUCUNE erreur dans mes fichiers.
- `typecheck` isolé (tsconfig.isolate incluant mes 4 fichiers + deps) : **0 erreur**.
- `bun test` ciblé : **2 pass / 0 fail**.
- Note : `eslint` timeout (30s) sur ce repo Windows (non bloquant, sans lien avec mes fichiers).

## Fichiers modifiés
| Fichier | Changement |
|---------|-----------|
| `src/lib/bsd-football-fetcher.ts` | TTL 20 min + computedAt + propagation asOf |
| `src/lib/football-data.ts` | type StandingContext.asOf |
| `src/components/football/football-match-card.tsx` | micro-tag "Maj HH:MM" |
| `src/lib/__tests__/football-standings-freshness.test.ts` | test de régression (nouveau) |
| `scripts/probe-prematch-classement-freshness.ts` | sonde QA read-only (nouveau, non critique) |
| `.context/session-prematch-classement-stale.md` | journal de trace |