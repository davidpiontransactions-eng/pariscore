# bd dl49 Phase 4.2 — Wire Consumers Serve Stats Source-Switch

> Spec préparatoire session future post-Phase 4.1.2 (BSD coverage probe result).
> Dernière mise à jour : 2026-05-24

---

## Contexte

Phase 4 partial (commit `8b4e2ec`) a livré `computeTennisElo` avec env-flag source switch (`legacy` / `internal` / `union`). Pattern à appliquer aux 5 autres consumers de `tennis_matches` :

1. `computeTennisServeStats` (T8) — serve stats per player per surface
2. `_computeTennisSetProfile` (T7) — set profile distribution
3. `tournament_alias surface_index` (server.js:21851) — tournament surface lookup
4. `tennis backtest T9` (server.js:20196) — model accuracy walk-forward
5. `BSD merger` (server.js:28284) — historical context per match

## Pattern à appliquer (chaque consumer)

```js
// Avant (legacy Sackmann hardcoded)
const rows = sqldb.prepare(`
  SELECT ... FROM tennis_matches WHERE ...
`).all();

// Après (env-flag source switch)
const eloSource = String(process.env.TENNIS_ELO_SOURCE || 'legacy').toLowerCase();
const rows = _buildTennisConsumerRows(eloSource, /* extra params */);
```

Avec helper `_buildTennisConsumerRows(source, params)` similaire à `_buildTennisEloRows` mais adapté à la signature query du consumer.

## Mapping cols par consumer

### T8 computeTennisServeStats

**Requires :** `w_svpt`, `w_1stIn`, `w_1stWon`, `w_2ndWon`, `w_SvGms`, `w_bpSaved`, `w_bpFaced`, `l_*` miroir

**Sackmann** : cols natives présentes (1968-présent)
**Internal BSD** : w_ace + l_ace + w_df + l_df mappés inline (commit `781a991`). Reste Sackmann-only via BSD `/stats/` endpoint (Phase 4.1.2 decision pending probe)

**Strategy** :
- `legacy` (default) : Sackmann full coverage
- `internal` : BSD ace/df seulement (queries WHERE w_svpt IS NOT NULL retourneront 0 rows → consumers gracefully dégradent OR use Sackmann fallback)
- `union` : Sackmann + internal — Sackmann data primaire pour cols avancées + internal augmente coverage récent

### T7 _computeTennisSetProfile

**Requires :** Score string parseable + `w_svpt` / `l_svpt` pour serve hold rate par set

**Strategy** : identique T8 — Sackmann legacy primaire, internal augmente échantillon récent

### Tournament alias surface index (server.js:21851)

**Requires :** `tourney_name` + `surface` distinct values

**Internal coverage** : ✅ complète (cols basics). Pattern simple SELECT DISTINCT.

**Strategy** : peut migrer vers `union` ou `internal` sans risque. Élargit catalogue tournois récents.

### Tennis backtest T9 (server.js:20196)

**Requires :** `winner_name`, `loser_name`, `score`, `tour`, `surface`, `tourney_date`, `winner_rank`

**Internal coverage** : ✅ complète cols basics. `winner_rank` NULL pour internal rows → backtest doit gérer NULL (fallback elo seed sans rank).

**Strategy** : `union` recommandé — augmente échantillon backtest sans break Sackmann data ranking.

### BSD merger (server.js:28284)

**Requires :** match lookup par tournament/players → enrichir live data avec historique

**Internal coverage** : ✅. Pattern lookup par normName winner/loser.

**Strategy** : `internal` natif (cohérence — BSD live + BSD historical depuis même source).

## Validation prod attendue (avant deploy `internal` source)

1. Run probe BSD endpoints (commit `563807e` tools/probe-bsd-tennis-stats.js)
2. Run ETL (`node tools/build-tennis-internal-history.js`)
3. Mesurer rows population :
   ```sql
   SELECT source, COUNT(*) FROM tennis_matches_internal GROUP BY source;
   SELECT source, COUNT(w_ace) AS ace_covered FROM tennis_matches_internal GROUP BY source;
   ```
4. Compare vs Sackmann backup (24995 rows) :
   - Si internal >= 10000 rows ATP/WTA settled → `union` mode OK
   - Si internal < 5000 rows → garder `legacy` default, soft-deprecate Sackmann (read-only)

## Ordre déploiement recommandé

1. **Phase 4.1.2** (post-probe) : étendre ETL avec fetch BSD `/stats/` si cols Sackmann présentes endpoint
2. **Phase 4.2.1** : refactor `computeTennisServeStats` + T7 + tournament_alias (queries simples cols basics)
3. **Phase 4.2.2** : refactor backtest T9 + BSD merger
4. **Phase 4.2.3** : Switch env-flag prod `TENNIS_ELO_SOURCE=union` (1 mois validation A/B)
5. **Phase 5** : Switch to `internal` only après validation OK
6. **Phase 6** : DROP TABLE tennis_matches (30j après Phase 5)
7. **Phase 7** : Strip dead code Sackmann (SACKMANN_REPOS, syncSackmannData, endpoints `/api/v1/tennis/sackmann/*`)

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Internal data noisy/incomplete vs Sackmann clean | `union` mode garde Sackmann backup. Validation A/B sur `/api/v1/accuracy/tennis-brier` |
| Elo regression (different keying ID vs normName) | Player key fallback `'n:' + normName` (commit 8b4e2ec). Audit `tennis_elo` table cohérence prod après switch |
| Stats avancées (svpt/1stIn) absent BSD endpoints | Accept Sackmann legacy permanent pour ces métriques OR build internal Elo only from rank+score (degraded mode) |
| DROP TABLE Sackmann perd backup légal | Backup audit trail `archives/tennis_matches_sackmann_pre_purge_*.json.gz` conservée (commit dd2bb75, SHA-256 documenté) |

## Effort estimé Phase 4.2 + 5-7

- Phase 4.1.2 ETL stats fetch (si cols Sackmann présent BSD) : 1-2j
- Phase 4.2.1+4.2.2 refactor 5 consumers : 2-3j
- Phase 4.2.3 A/B validation prod : 1 mois calendar (pas effort dev)
- Phase 5 switch internal default : 30min config change + monitoring
- Phase 6 DROP TABLE : 30min script + verification backup intact
- Phase 7 strip dead code : 1-2j (lots of cleanup across server.js)

**Total dev pur :** ~4-7j sur 2-3 sessions dédiées
**Total calendar :** ~2-3 mois (validation 30j × 2 phases)

---

*Spec maintenue par bd `dl49` — preparation Phase 4.2 sessions futures.*
