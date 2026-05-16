# Rapport — Coupes anglaises (FA Cup / Carabao Cup) — Routing

**Date** : 2026-05-16
**Déclencheur** : FA Cup Final manquante (Chelsea vs Manchester City, 2026-05-16 16:00 UTC).

## Diagnostic

Le match arrivait bien via le bulk BSD L1 (`/events/?date_from=&date_to=`, sans filtre ligue),
mais `resolveConfigLeagueForBSDMatch()` ne trouvait aucune `configLeague` → `_sport` retombait
sur `soccer_bsd` → pas de `SPORT_LABELS`, exclu du filtre pays Angleterre, invisible UI.

Cause racine : FA Cup / Carabao Cup absentes de `leagues_config.json` ET `bsd_config.json`.

## Analyse API (routing)

| Source | FA Cup ? | Coût | Verdict |
|--------|----------|------|---------|
| **BSD** | Oui — ligue 39 (FA Cup), 40 (Carabao Cup) | Gratuit, zéro rate limit | **Retenu (L1 primaire)** |
| API-Football | Oui — ligue 45 / 48 | Plan PRO payant, standings only (coupes = pas de table) | Fallback inutile |
| The Odds API | `soccer_fa_cup` / `soccer_england_efl_cup` | 500 req/mois | Secondaire |
| football-data.org | Non (free tier : pas de coupes nationales) | — | N/A |

Décision : BSD seul suffit. Correctif **config-only**, aucune modif code (pattern identique
à Coppa Italia `type:"CUP"` déjà mappée BSD 42 / config 137).

## Implémentation

`leagues_config.json` — ajout après Championship :
- `{ id:45, name:"FA Cup", country:"England", type:"CUP", odds_key:"soccer_fa_cup", cron_hours:24, sofa_id:null }`
- `{ id:48, name:"Carabao Cup", country:"England", type:"CUP", odds_key:"soccer_england_efl_cup", cron_hours:24, sofa_id:null }`

`bsd_config.json` :
- `bsd_to_config` : `"39"→{45,"FA Cup"}`, `"40"→{48,"Carabao Cup"}`
- `config_to_bsd` : `"45":39`, `"48":40`

(IDs API-Football 45/48 servent de `config_id` ; aucune collision avec BSD 39/40 = clés ligue BSD.)

## Vérification

Serveur redémarré. Logs :
- `[DATA AUDIT] "FA Cup" (BSD 39 / config 45)` ✓
- `[DATA AUDIT] "Carabao Cup" (BSD 40 / config 48)` ✓
- `db_matches` : `soccer_fa_cup | FA Cup | England | Chelsea vs Manchester City | 2026-05-16` ✓
- Snapshot cotes : `odds_snap_bsd_206701` présent ✓

Standings KO pour coupes = attendu/inoffensif (pas de classement, comme Coppa Italia).
Carabao Cup : 0 match aujourd'hui (saison terminée) — mapping prêt pour la prochaine saison.
