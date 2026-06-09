# Audit bd `3u9` — État API-Football post-production (kill-switch v10.77)

> Date : 2026-05-22 · Auteur : CTO PariScore (audit) · Fichier analysé : `server.js`
> Objet : clarifier l'état réel d'API-Football après le kill-switch v10.77, croiser avec la doc `CLAUDE.md` (contradiction "Plan PRO 7500 req/jour") et les findings bd `zia` (compte actuel Free 100 req/jour), et délivrer 3 scénarios DG.
> Cross-ref : bd `3u9` (P2 suivi post-prod), bd `zia` (P2 migration odds AF, IN_PROGRESS), audit existant `audit-api-football-suppression-2026.md`.

---

## 1. État réel kill-switch (production)

| Élément | Valeur observée | Locus |
|---|---|---|
| Flag | `const AF_REMOVED = true;` | `server.js:69` |
| Effet | `API_FOOTBALL_KEY = AF_REMOVED ? '' : process.env.API_FOOTBALL_KEY` | `server.js:70` |
| Log boot | `[AF] API-Football RETIRÉ (kill-switch v10.77) — fallbacks BSD/ESPN/felipeall actifs` | `server.js:71` |
| Warning prod | `if (!API_FOOTBALL_KEY && !AF_REMOVED) console.warn(...)` (silencieux quand kill-switch ON) | `server.js:163` |
| Réversibilité | `const AF_REMOVED = false` réactive le routage AF (env.var redevient pris en compte) | constant unique |
| Vérification prod | v10.77 CHANGELOG : boot 271 matchs sans AF, zéro SyntaxError | `CHANGELOG.md:225` |

**Mécanisme** : kill-switch à la source (clé forcée vide), pas suppression brute. Les ~23 call sites AF gardent leur garde `if (!API_FOOTBALL_KEY) return null` et les fallbacks BSD/ESPN/felipeall (livrés v10.72→v10.76) prennent automatiquement le relais.

**Exception opt-in** : `USE_API_FOOTBALL_ODDS=1` (`server.js:77`) lit `process.env.API_FOOTBALL_KEY` directement via `odds-apifootball.js` — **indépendant du kill-switch stats**. Permet d'activer cotes AF sans réactiver stats AF (bd `zia` Phase 2). Actuellement OFF par défaut.

---

## 2. Plan tier compte actuel (cross-ref bd `zia`)

| Élément | Valeur |
|---|---|
| Plan AF actuel | **Free — 100 req/jour cap** (bd `zia` finding, commit `b764005`) |
| Plan documenté CLAUDE.md §3.2 | "PRO — 19$/mois — 7 500 req/jour" → **doc obsolète/aspirationnelle** |
| Restriction Free | season >=2022, fenêtre J+0..J+2 (bd `zia` notes) |
| Coût upgrade Pro | $19/mo |
| Math viable Pro pour bd `zia` cotes | 200 req/jour cumulés ≤ 2.7 % du quota Pro (viable) |

**Contradiction confirmée** : `.claude/CLAUDE.md` §3.2 et §14 décrivent un plan Pro actif que le compte ne possède pas. À aligner après décision DG.

---

## 3. Tableau usages AF par feature (post-AF_REMOVED)

| Feature | Locus | État avec AF_REMOVED=true | Fallback livré |
|---|---|---|---|
| **Stats équipe (`fetchStats` phase 2)** | `server.js:13866` | Branche skipée (`if (API_FOOTBALL_KEY && ...)`) | BSD phase 1 primaire, ESPN/Sofa survie |
| **Standings/teamStats sanitize** | `server.js:5247, 6995, 13725` | Purge active des lignes `_source:'api-football'` périmées des ligues BSD | Auto-cleanup |
| **Cotes (`fetchOdds` L1.6)** | `server.js:13516` | Désactivé sauf `USE_API_FOOTBALL_ODDS=1` ET clé `.env` présente | BSD/odds-api1/ESPN |
| **Scores finaux (`archivePastMatches`)** | `server.js:8170, 8296` | `if (!realScore && API_FOOTBALL_KEY)` → skip | BSD `/events?finished` primaire |
| **Stats avancées équipe (`fetchTeamAdvancedStats`)** | `server.js:10075` | Early-return null | `buildAdvancedStatsFromStandings` (v10.76) calcul interne depuis BSD `_raw` |
| **Prédictions (`/api/v1/af/predictions/:id`)** | `server.js:30251` | AF skipée, fallback BSD direct | `fetchBsdPredictionNormalized` (v10.75) |
| **Transferts (`/api/v1/af/transfers/:id`)** | `server.js:30268` | **503 gracieux** (orphelin assumé) | felipeall `/api/v1/transfermarkt` |
| **H2H, key players, top scorers** | divers | Early-return null | ESPN/BSD/local |
| **Player bio (`fetchAPIFootballPlayer`)** | `server.js:714` | Early-return null | TheSportsDB + ESPN, CDN photos cassé sans `api_football_id` |
| **Position ratings (`fetchTeamPositionRatings`)** | `server.js:10312` | Early-return null | Pas de fallback (sunset assumé) |
| **Topscorers/topassists (`fetchApifTopPlayersByLeague`)** | `server.js:10975, 11154` | Early-return `[]` | BSD `/player-stats` primaire |
| **Fixtures par date (`fetchFixturesFromAPIFootballByDateRange`)** | `server.js:12099` | Branche `if (API_FOOTBALL_KEY)` skipée | BSD `/matches` |
| **CDN photos/logos `media.api-sports.io`** | clé-zéro | **Non concerné** (continue) | — |

**Bilan** : aucun crash, aucune régression bloquante. Routes ex-AF restituent 503 (transfers) ou shape vide gracieux. UI doit déjà tolérer (CHANGELOG v10.77 confirmait 271 matchs chargés OK).

---

## 4. Recommandations DG — 3 scénarios

### Scénario A — Maintenir kill-switch + cleanup ciblé (reco court terme)

- `AF_REMOVED=true` reste actif.
- Aligner doc : `.claude/CLAUDE.md` §3.2 → marquer "AF retiré v10.77, fallbacks BSD/ESPN actifs ; plan compte Free dormant ($0/mois)" ; §14 retirer la mention quota PRO.
- bd `zia` : NO-GO sur l'activation `USE_API_FOOTBALL_ODDS=1` tant que le plan reste Free (200 req/j cumulés ≫ cap 100/j).
- Suivi : observer logs VPS 14 jours pour valider qu'aucun consumer ne dépend silencieusement d'un champ AF orphelin.
- **Coût** : 0 €/mois.
- **Conséquence** : 5 features sunsetées définitivement (déjà fallback-couvertes 4/5 — voir tableau §3).

### Scénario B — Upgrade Pro $19/mo + réactiver AF + GO bd `zia` cotes

- `AF_REMOVED=false` (réactive routage stats AF en fallback phase 2).
- Souscrire plan Pro $19/mo → 7500 req/jour → bd `zia` `USE_API_FOOTBALL_ODDS=1` viable (200 req/j ≤ 2.7 % quota).
- Bénéfice marginal : libère 500 req/mois Odds API pour expansion tennis/basket (bd `zia` synergy).
- Restaure 5 features orphelines (transferts, prédictions AF natives, ratings poste, bio joueur enrichie, fixtures full saison).
- **Coût** : $19/mo (~17,5 €/mo) ; ROI = expansion sport + redondance odds sharp.
- **Conséquence** : 1 SPOF (compte AF) à surveiller + facturation CB.

### Scénario C — Cleanup total (suppression dead code AF)

- Garder `AF_REMOVED=true` + supprimer physiquement les ~23 call sites + 8 fonctions 100 % AF (`fetchAPIFootballTeamId`, `fetchAPIFootballPlayer`, `fetchTeamAdvancedStats`, `fetchAFPredictions`, `fetchAFTransfers`, `fetchTeamPositionRatings`, `splitTeamPlayers`, `fetchTeamLastFixtures`, `fetchApifTopPlayersByLeague`).
- Estim diff : 500–800 lignes inertes supprimées, simplifie `server.js`.
- **Risque** : régression silencieuse si un consumer non audité dépend d'un champ AF (UI vide non détectée). Test régression manuel 6 sports requis.
- **Coût** : 0 €/mois + 4-6 h dev.
- **Conséquence** : Réversibilité perdue (`AF_REMOVED=false` n'a plus rien à réactiver) ; tout retour AF = re-developpement.

---

## 5. Synergy bd `zia` (migration odds AF)

bd `zia` IN_PROGRESS (commit `b764005`) livre `odds-apifootball.js` (11 fonctions) + flag `USE_API_FOOTBALL_ODDS`. Activation **viable uniquement Scénario B** (Pro). Tant que plan Free → bd `zia` reste **CODE LIVRÉ MAIS DÉSACTIVÉ**.

Décision couplée : Scénario A → fermer bd `zia` `wont_fix` (code dormant utile en cas de pivot). Scénario B → close `zia` après 7 jours d'activation prod validée. Scénario C → archiver `odds-apifootball.js` + `zia` `wont_fix`.

---

## 6. Recommandation CTO

**Scénario A** (conservateur, $0/mois) jusqu'à ce qu'une feature business justifie réactivation :
1. Decision DG bd `s77m` (Stripe activation, revenue) → si SaaS rentable → re-évaluer Scénario B comme dépense opex acceptable.
2. Si expansion tennis/basket prioritaire → Scénario B justifié (bd `zia` libère 500 req/mois Odds API).
3. Sinon → Scénario A indéfiniment, doc `.claude/CLAUDE.md` à corriger immédiatement (drift documentaire).

**Non-recommandé court terme** : Scénario C (perte réversibilité + risque régression silencieuse non couvert par test auto).

---

## 7. Résiduel — décisions DG attendues

| # | Question | Bloquant |
|---|---|---|
| 1 | Maintenir Scénario A (kill-switch) ou upgrade Pro $19/mo (Scénario B) ? | bd `zia` activation + doc CLAUDE.md sync |
| 2 | Si A : autoriser cleanup total (Scénario C) plus tard ? | dead code 500-800 lignes |
| 3 | bd `zia` : close `wont_fix` (A/C) ou attendre activation prod (B) ? | bd hygiene |
| 4 | Drift documentaire `.claude/CLAUDE.md` §3.2 §14 → corriger maintenant ? | source vérité doc |

---

*Audit livré 2026-05-22 · bd `3u9` P2 — fermeture conditionnelle à décision DG ci-dessus.*
