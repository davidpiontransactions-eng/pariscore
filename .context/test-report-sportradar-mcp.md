# Test Report — Sportradar MCP Endpoints
**Date** : 2026-05-19
**Module** : MCP server `sportradar` (.mcp.json) — 14 endpoints

## Contexte
MCP server `sportradar` déclaré dans `.mcp.json`. AUCUNE intégration dans `server.js` ni `pariscore.html` (sportradar = MCP only). server.js utilise RapidAPI pour d'autres produits (free-football, matchstat tennis, parlay, gameforecast) avec headers corrects `x-rapidapi-key`/`x-rapidapi-host`.

## Endpoints exposés (14)
get_event, match_info, match_details_extended, match_timeline, match_timeline_delta, scorecard, stats_match_situation, stats_season_goals, stats_season_meta, stats_cup_brackets, livescore_statuscodes, IFRAME_LIVE_SCORE, Betfair_ID_to_Sport_Radar_ID, get_event.

## ❌ Bugs détectés

### BUG-1 — Auth MCP sportradar cassée : 401 "Invalid API key"
**Sévérité** : BLOQUANT (tous endpoints inutilisables)
**Localisation** : `.mcp.json` lignes 6-12
**Symptôme** : appel `scorelivescore_statuscodes` →
```json
{"message":"Invalid API key. Go to https://docs.rapidapi.com/docs/keys for more info."}
```
HTTP 401.

**Diagnostic** (tests curl isolés) :
- Clé `RAPIDAPI_KEY` (b0734...64c4) VALIDE — testée vs `free-api-live-football-data.p.rapidapi.com` → HTTP 429 (quota, mais auth OK).
- Même clé vs `mcp.rapidapi.com` / scheme `x-api-key` → 401 Invalid.
- `.mcp.json` cible base `https://mcp.rapidapi.com` + headers `x-api-host`/`x-api-key` (gateway MCP RapidAPI).
- server.js (produits qui marchent) utilise base `https://<slug>.p.rapidapi.com` + headers `x-rapidapi-key`/`x-rapidapi-host` (proxy RapidAPI classique).

**Cause racine** : 2 causes possibles, non exclusives —
1. **Non-substitution `${RAPIDAPI_KEY}`** : Claude Code ne charge PAS `.env` automatiquement. `${RAPIDAPI_KEY}` dans `.mcp.json` substitué depuis env du process Claude Code, pas depuis `.env` projet. Si var absente de l'env shell → clé vide/littérale envoyée → 401.
2. **Produit sportradar non souscrit sur le gateway `mcp.rapidapi.com`** : la clé marche sur le proxy `p.rapidapi.com` mais le gateway MCP exige souscription distincte au produit sport-radar-api.

**Fix proposé** :
- Étape 1 — exporter la clé dans l'env qui lance Claude Code (pas seulement `.env`) :
  - PowerShell : `$env:RAPIDAPI_KEY="b0734...64c4"` avant lancement, OU
  - settings Claude Code : ajouter `RAPIDAPI_KEY` dans `env` (update-config).
- Étape 2 — vérifier sur dashboard RapidAPI que le compte est souscrit à **sport-radar-api** ET que l'accès MCP gateway (`mcp.rapidapi.com`) est activé pour ce produit.
- Étape 3 — si sportradar dispo en proxy classique, reconfigurer `.mcp.json` vers `https://sport-radar-api.p.rapidapi.com` + `x-rapidapi-key`/`x-rapidapi-host` (cohérent avec server.js qui fonctionne).

## ⚠️ Avertissements

### W1 — Schémas params anémiques
`scorelivescore_statuscodes` / `IFRAME_LIVE_SCORE` descriptions vides (`" "`). `IFRAME_LIVE_SCORE.event_id` = Betfair event id (number) — coupler avec `Betfair_ID_to_Sport_Radar_ID` avant tout appel match (IDs Sportradar ≠ Betfair ≠ API-Football). Mapping ID obligatoire si intégration future.

### W2 — Aucune intégration server.js
Sportradar = MCP exploratoire seulement. Si destiné au routing live (CLAUDE.md P1 Live Intensity), prévoir : helper `getSportradarMatch()`, cache (rate limit RapidAPI inconnu), fallback gracieux, mapping ID. Non fait → hors scope actuel.

## Tests passés
- Découverte 14 endpoints + chargement schémas via ToolSearch : OK
- Validité clé `RAPIDAPI_KEY` confirmée (vs produit tiers) : OK
- Confirmation absence intégration code app (server.js/html) : OK

## Verdict
Endpoints **NON TESTABLES** tant que BUG-1 non résolu. Auth gateway MCP RapidAPI rejette la clé. Action requise côté config env + souscription RapidAPI avant tout test fonctionnel.

## 💡 Recommandations
1. Résoudre substitution env `${RAPIDAPI_KEY}` (cause #1 la plus probable — `.env` non auto-chargé par Claude Code).
2. Si sportradar souscrit en proxy classique : migrer `.mcp.json` vers schéma `p.rapidapi.com` + `x-rapidapi-*` (déjà prouvé fonctionnel dans server.js).
3. Re-run `/ps-test sportradar` après fix pour test fonctionnel réel des 14 endpoints.
