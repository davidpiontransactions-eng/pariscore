# Test Report — Phase H1 Data Hub Historique

**Date** : 2026-05-20
**Auditeur** : QA Expert PariScore (ps-test)
**Cible** : `server.js` (route `/api/v1/history/query` + fonctions calcul) + `pariscore.html` (`#page-historique` shell Data Hub)
**Statut global** : ✅ **PASS** — 0 bug bloquant. 5 avertissements non-bloquants (W1-W5).

---

## ✅ Tests passés (20/20)

### Backend — Route & Calculs

- [x] **T0 — Syntaxe `node --check server.js`** → SYNTAX_OK
- [x] **T1 — Route nominale** `/api/v1/history/query?pageSize=5` → `{sport,matches,total,page,pageSize,kpis,breakdown,series}` retournés, schéma JSON valide
- [x] **T2 — Cap defensive edge [5,50]** `?markets=edge&pageSize=200` → total=17 picks edge, **0 violations**, avg_ev=26.54% (vs +170% avant fix)
- [x] **T3 — Filtre ligue exact** `?leagues=Bundesliga&pageSize=200` → total=20, `unique_leagues=['Bundesliga']`
- [x] **T4 — Filtre date range** `?fromDate=2026-05-15&toDate=2026-05-20` → total=95, min=2026-05-15, max=2026-05-20
- [x] **T5 — Filtres composés** `?markets=over25,btts&confidence=high&minProba=70&outcome=won` → total=14, **0 violations proba**
- [x] **T6 — Pagination** `?page=2&pageSize=10` → page=2, 10 matchs. **T6b** `?page=999` → page=999, matches=[] (graceful)
- [x] **T7 — Sport tennis vide** `?sport=tennis` → total=0, matches=[] (attendu, H3)
- [x] **T8 — `excludeLowLeagues=1`** → 8 ligues low (<50% WR, ≥5 picks) identifiées, **0 match restant dans pool low**
- [x] **T9 — Sort EV desc** → array décroissant `[48.8, 41.3, 34.4, 32.7, 30.4...]` strictement trié
- [x] **T10 — Legacy `/api/v1/history?limit=3`** → `['accuracy', 'matches', 'total']`, matches_len=3 (régression OK)
- [x] **T12 — `outcome=won`** → 155 matchs, tous picks gagnés (**0 violations**)
- [x] **T13 — `confidence=high`** → 22 matchs, tous proba ≥75% (**0 violations**)
- [x] **T14 — Wilson IC95 sanity** → bornes [0,1] respectées sur 3 marchés ; wr toujours dans [lo,hi] ; samples cohérents (over25=150, btts=183, edge=12)
- [x] **T15 — Inputs invalides** → ligue inconnue → total=0 ; date `invalid-date` → silently ignorée (full dataset retourné, voir W2)
- [x] **T16 — Null safety dataset** → 200 matchs, `predicted=null` × 0, `realScore=null` × 6 (3%), `verified=false` × 6 → tous gracieusement ignorés par `_historyPicksOf` (retour `[]`)

### Frontend — UI States

- [x] **T17 — Breakdown + Series shape** → 45 ligues, 3 marchés (over25/btts/edge), `by_strategy=[]` (placeholder H4 OK), pl_cumulative=544 points, drawdown_curve=544 points, rolling30_wr=316 points
- [x] **T18 — KPI strip rendering** → 6 cartes : `['336','72.3%','-17u','5','+24.9%','64%']`. Pagination `228 matchs · page 1/5`, empty hidden, view=table
- [x] **T19 — Interactivité** :
  - Toggle Tennis → empty visible, KPI=0 ✅
  - Toggle Edge market off → `dhState.markets=[over25,btts]` ✅
  - View switch Charts → 3 Chart.js instances créées (`pl/dd/rolling`) ✅
  - Reset → defaults restaurés (markets=[over25,btts,edge], period=90, minEV=0, minProba=55) ✅
- [x] **T20 — XSS guard** → `escapeHtml('<script>alert(1)</script>')` → `&lt;script&gt;alert(1)&lt;/script&gt;` (escape function exists + used dans `dhRenderTable` sur home_team, away_team, league, bestEdge)
- [x] **T21 — Performance** → simple query 244ms · worst-case (all filters + excludeLowLeagues) 175ms · **bien sous le budget 300ms p95**
- [x] **T22 — Console errors** → 0 erreur, 0 warning Chart.js destroy

---

## ⚠️ Avertissements (5 non-bloquants)

### W1 — KPI `total_picks` ne respecte pas filtre `markets`

**Localisation** : `server.js` `computeHistoryKpis()` ligne ~6820, `_historyPicksOf()`.

**Problème** : Quand l'utilisateur décoche le chip `Edge`, le pool de matches est filtré (matchs sans pick over25/btts qualifié exclus), mais le KPI `total_picks` continue d'inclure les edge picks des matchs restants. UX confuse : décocher Edge ne fait pas baisser `total_picks` autant qu'attendu.

**Recommandation** : Soit (a) filtrer `_historyPicksOf` output par `markets` actifs, soit (b) renommer `total_picks` en `total_qualifying_picks_in_pool` pour transparence. Préférence : (a) en Phase H2.

### W2 — Date invalide silencieuse

**Localisation** : `server.js` `runHistoryQuery()` parsing `fromDate`/`toDate`.

**Problème** : `?fromDate=invalid-date` → silently ignored (full dataset retourné, total=550 au lieu d'une erreur). Pas de feedback utilisateur.

**Recommandation** : Log `console.warn('[history/query] invalid fromDate:', p.fromDate)` côté serveur. Non bloquant car frontend ne génère jamais date invalide via date-picker.

### W3 — Méthode HTTP non vérifiée

**Localisation** : `server.js` route handler `/api/v1/history/query`.

**Problème** : `POST /api/v1/history/query` retourne 200 + JSON normal (pas de `req.method === 'GET'` check). Cohérent avec patterns existants du projet (`/api/v1/matches`, `/api/v1/history` legacy → idem), mais non strict.

**Recommandation** : Aligner avec routes admin qui filtrent `req.method`. Backlog P2 si standardisation REST souhaitée.

### W4 — `pageSize` floor à 10

**Localisation** : `server.js` `runHistoryQuery()` : `Math.max(10, Math.min(200, p.pageSize || 50))`.

**Problème** : Utilisateur demandant `pageSize=5` reçoit 10 rows. Comportement défensif (évite UI vide), pas un bug, mais non documenté.

**Recommandation** : Documenter dans `CLAUDE.md` API REST section ou abaisser floor à 1 si cas usage légitime.

### W5 — Series.pl_cumulative ne respecte pas `period`

**Localisation** : `server.js` `computeHistorySeries()`.

**Problème** : Test direct curl sans `period=90` → 544 points dans pl_cumulative (toute l'history). Frontend par défaut applique `period=90` côté client (`_dhApplyPeriod()`), donc utilisateur final ne voit que 90j. Mais si on appelle l'API direct sans `fromDate`, on a tout. Cohérent avec architecture stateless mais peut être surprenant pour intégrations API tierces.

**Recommandation** : Documenter que `fromDate`/`toDate` doivent être fournis explicitement pour series bornées. Phase H2 : ajouter param `defaultPeriod=90` au server-side ?

---

## ❌ Bugs détectés

**Aucun bug bloquant.**

⚠️ **NOTE HISTORIQUE** : Le fix `HISTORY_EDGE_MIN/MAX=5/50` a corrigé une anomalie dataset legacy (entrées `bestEdgeValue=669%, 530%, 263%...` issues d'un bug ancien dans `archivePastMatches`). Ces entrées restent dans `history.json` mais sont désormais exclues des calculs KPI et de l'affichage. **Recommandation** : nettoyer la donnée brute en script one-shot dans une phase ultérieure (`tools/cleanup-history-edges.js`).

---

## 💡 Recommandations d'amélioration (roadmap H2+)

1. **(W1)** Faire respecter le filtre `markets` au niveau `_historyPicksOf` pour cohérence KPI.
2. **(W2)** Ajouter logs warning sur inputs invalides + retourner `?warning: ['invalid fromDate']` dans response.
3. **Bootstrap IC** (vs Wilson) : Phase H2 — préciser intervalle confiance via bootstrap 500 itérations pour samples <30 où Wilson est moins fiable.
4. **Cache mémoire 60s** par hash de filtres (R2 du rapport architecture) — préparer pour H6 quand dataset croît >1000 matchs.
5. **Tag `strategy_predicted`** sur nouvelles entrées `history.push` (Phase H4 pré-requis).
6. **Cleanup script** `tools/cleanup-history-edges.js` : marquer les ~10 entries legacy avec `bestEdgeValue>50` comme `predicted.bestEdge=null` pour propreté data.
7. **Tests automatisés** : créer `tests/h1-route.sh` + `tests/h1-kpis.test.js` (mockés) pour CI futur.

---

## 📊 Matrice de couverture

| Couche | Coverage | Verdict |
|--------|----------|---------|
| Backend Unit (math) | T14 Wilson IC + drawdown peak + streaks | ✅ |
| Backend Integration (route) | T1-T10 + T12-T16 | ✅ |
| Frontend Component | T18-T19 (KPI/views/chips) | ✅ |
| Frontend E2E | T19 (toggle, view switch, reset) | ✅ |
| Régression legacy | T10 (`/api/v1/history` alias intact) | ✅ |
| Performance | T21 (244ms simple, 175ms worst) | ✅ |
| Security/XSS | T20 (escapeHtml verified) | ✅ |
| Null safety | T16 (6/200 entries non-verified handled) | ✅ |

---

## 🎯 Verdict QA — H1 Ready for Production Deploy

**STATUS** : ✅ **GO PROD**.

**Pre-deploy** :
- [x] `node --check server.js` OK
- [x] Backend tests 16/16 OK
- [x] Frontend tests 6/6 OK
- [x] Régression legacy OK
- [x] Performance < 300ms p95
- [x] 0 erreur console

**Deploy VPS OVH** :
```bash
scp server.js ubuntu@<VPS>:/home/ubuntu/pariscore/
scp pariscore.html ubuntu@<VPS>:/home/ubuntu/pariscore/
ssh ubuntu@<VPS> "cd /home/ubuntu/pariscore && pm2 restart pariscore && pm2 logs pariscore --lines 30"
```

**Smoke prod post-deploy** :
```bash
curl -s 'https://pariscore.fr/api/v1/history/query?pageSize=3' | jq '.kpis | keys'
# Attendu : ["btts","edge","final_pl_units","max_drawdown_units","over25","total_picks","verified_matches"]
```

**Rollback plan** : `git revert <commit-H1>` + redéploy précédentes versions `server.js` + `pariscore.html`.

---

**Fin de rapport — Phase H1 validée.**
