# Test Report — LiveScore Tennis (API publique JSON)
**Date** : 2026-05-19
**Module** : Intégration LiveScore tennis — bd `ParisScorebis-dnm`

## Contexte / inputs utilisateur
- `https://www.livescore.com/en/tennis/` — source visée
- Script GitHub `haroldmli/04-Tennis-Point-by-Point` (Selenium scoreboard.com) → **OBSOLÈTE** (scoreboard.com redirige flashscore, Selenium non installable en Node zero-dep). Rejeté.
- Log Apify flashscore Scrapy actor : x-fsign extrait mais **0 items** (`scraped 0 items`, input/proxy config absent). Cassé, non pertinent.
- Log Apify oddsportal Playwright : `locator.waitFor Timeout 15000ms` sur `[data-testId=sport-country-league-item]`, 0 crawlé. Anti-bot oddsportal, non pertinent.

→ Décision : intégrer l'**API JSON publique LiveScore** (propre, officielle) plutôt que scrape HTML/Selenium.

## Découverte technique
- API base : `https://prod-cdn-public-api.livescore.com` (extrait de `__NEXT_DATA__` `PUBLIC_API_URL`)
- **Node `https` natif passe** (200, zéro Cloudflare/JA3) → contrairement à aiscore, **AUCUNE dépendance curl**, zero-dep préservé, pas de token
- Endpoints validés :
  - `GET /v1/api/app/date/tennis/{YYYYMMDD}/0?locale=en&MD=1` → 200, ~63KB (Stages→Events)
  - `GET /v1/api/app/live/tennis/0?locale=en&MD=1` → 200 (live only)
  - `GET /v1/api/app/scoreboard/tennis/{Eid}?locale=en` → 200 (détail match)
- Champs : `Tr1/Tr2`=sets gagnés, `Tr{n}S{k}`=jeux set k (+`Tr{n}S{k}T`=tiebreak), `Eps`=statut, `Esd`=YYYYMMDDHHMMSS UTC, `T1/T2[0]`={Nm,Abr,ID,CoNm,CoId}, `Venue`, `Stg`.

## Périmètre livré
server.js module (natif httpsGet, zero-dep) + 3 routes Pro tennis :
- `GET /api/v1/tennis/livescore/day?date=YYYYMMDD` (défaut = aujourd'hui UTC) — cache 5min
- `GET /api/v1/tennis/livescore/live` — cache 30s
- `GET /api/v1/tennis/livescore/match/:eid` — cache 30s

## ✅ Tests passés
- Parsers offline vs payload réel : 10 stages / 154 events, competition/stage, players, `Tr{n}S{k}` sets (ex Singh 5-5 set1), statut mappé (NS→not_started, Int.→interrupted), Esd→ISO UTC
- Route DAY : 200, stages 10, events 154, date résolue
- Route LIVE : 200 (0 events à 02:05 UTC — API renvoie Stages vide, normal hors heures de jeu)
- Route MATCH : 200, venue "Court 13", competition "French Open", stage "Men's Qualification"
- Cache TTL Map (5min/30s/30s) — pattern identique texCache/aiscoreCache
- `node --check` : OK

## ❌ Bug détecté & corrigé (QA)
### BUG-1 — date invalide silencieusement = aujourd'hui (CORRIGÉ)
`?date=abc` → `replace(/\D/g,'')` → "" → branche défaut → 200 (mauvaise donnée masquée). Fix : distinguer param absent (→ aujourd'hui) vs param présent invalide (→ 400). Vérifié : `date=abc`→400, `date=123`→400, absent→200, `date=20260519`→200.

## ⚠️ Avertissements (non bloquants)
### W1 — Point-by-point ABSENT de l'API (constat définitif, RÉSOLU)
Re-test 02:11 UTC sur match en cours `Int.` Palan vs Isomura (Tr1=1, S1 6-4, S2 2-1) + endpoint `scoreboard` : **aucun champ point-score / serveur / pbp** (`Tr1PS`/`Scp`/`Serv` inexistants, même sur match interrompu en cours). LiveScore tennis API expose UNIQUEMENT sets gagnés + jeux par set + statut. Le mapping spéculatif `point_score` (Tr1PS/Tr2PS) a été **supprimé** (dead code, fausse capacité). Pour point-par-point + serve position → source **aiscore** (déjà intégrée, commit `9719361`). Pas une limitation bloquante : LiveScore = live score sets/jeux propre ; aiscore = granularité point. Complémentaires.
### W2 — Champ `country` = slug compétition
`stage.country` mappé sur `CnmT` (translit nom compétition, ex "french-open"), pas un vrai code pays. Le vrai pays joueur est dans `scoreboard` `T{n}[0].CoNm/CoId` (exposé par route match, pas par day). Cosmétique.
### W3 — Statuts live non exhaustifs
`_lsLabelStatus` mappe NS/FT/Int./Canc./Postp./Ret./Walkover/Abn. Statuts live en cours (ex "Set 2", "1st set") passent en fallback lowercased — à enrichir après observation match live.

## 💡 Recommandations
1. Re-test pendant heures de jeu (Roland-Garros quali en cours) → confirmer W1 (point_score) + W3 (statuts live).
2. Comparatif sources tennis : LiveScore = officiel/propre/zero-dep, **supérieur à aiscore** pour le live score (mais aiscore garde point-par-point + serve position). Complémentaires.
3. Frontend hook = follow-up (contrainte style Flashscore×L'Équipe).

## Verdict
LiveScore tennis **livré + testé end-to-end**, zero-dep natif (pas de curl/CF/token). 1 bug QA corrigé. Source la plus propre des intégrations tennis. Limitations W1-W3 documentées (à lever sur match live). Script Selenium GitHub rejeté (obsolète). Actors Apify cassés = hors scope.
