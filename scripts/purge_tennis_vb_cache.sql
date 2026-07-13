-- ────────────────────────────────────────────────────────────────────────────
-- Purge one-shot du cache SQLite des matchs prematch tennis.
--
-- Contexte : fix "matchs fantômes" en prematch (match passé non reclassé par
-- BSD qui reste affiché des jours après). Le garde-fou temporel ajouté dans
-- _buildTennisValueBetsCore (server.js) exclut désormais les matchs passés au
-- service, MAIS le cache SQLite api_cache (TTL 4h pour les requêtes par date)
-- peut encore servir des entrées stale jusqu'à expiration.
--
-- Ce script vide les clés cache concernées pour forcer un re-fetch frais dès
-- le prochain appel (le filtre s'appliquera alors sur les nouvelles données).
--
-- Usage (sur le VPS, après deploy.sh + pm2 restart) :
--   sqlite3 pariscore.db < scripts/purge_tennis_vb_cache.sql
--
-- Idempotent : peut être relancé sans risque (DELETE sur clés déjà absentes).
-- ────────────────────────────────────────────────────────────────────────────

-- Cache des value-bets tennis (clés bsd_tennis_value_bets_<date|today>).
-- TTL normal : 4h (date-specific) / 30min (global scheduled).
DELETE FROM api_cache WHERE key LIKE 'bsd_tennis_value_bets_%';

-- Cache du passthrough /api/v1/tennis/matches (BSD brut, TTL 30min).
DELETE FROM api_cache WHERE key LIKE 'bsd_tennis_matches_%';

-- Cache des prédictions tennis (consommé sans freshness check, cf server.js).
DELETE FROM api_cache WHERE key LIKE 'bsd_tennis_preds_%';

-- Snapshots d'enrichissement tennis (table dédiée, non api_cache).
-- Permet de forcer la reconstruction complète au prochain cycle.
DELETE FROM tennis_enrich_snap;

-- Rapport : nombre de lignes restantes dans chaque table concernée
-- (pour vérification post-exécution).
SELECT 'api_cache total' AS table_name, COUNT(*) AS rows_left FROM api_cache
UNION ALL
SELECT 'tennis_enrich_snap', COUNT(*) FROM tennis_enrich_snap;
