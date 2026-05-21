-- ════════════════════════════════════════════════════════════════════
-- AUDIT DB POST-BREACH — Incident 20 mai 2026 00:26 UTC
-- Bd: ParisScorebis-c8m
-- ════════════════════════════════════════════════════════════════════
-- USAGE: sqlite3 pariscore.db < audit_db_post_breach.sql
-- Cherche activite suspecte: paris/dépôts/conversions post-incident
-- ════════════════════════════════════════════════════════════════════

-- 1. Tous les paris créés APRES le breach (00:26:11 UTC le 20/05)
-- → Si patterns anormaux (paris massifs, montants élevés, comptes nouveaux)
.headers on
.mode column
.width 12 20 12 10 10 8 12

SELECT '═══ PARIS POST-BREACH ═══' AS section;

SELECT
  id AS bet_id,
  user_id,
  substr(created_at, 1, 19) AS created,
  bookmaker,
  market,
  stake_cents/100.0 AS stake_eur,
  status,
  sport
FROM user_bets
WHERE created_at >= '2026-05-20T00:26:11Z'
ORDER BY stake_cents DESC
LIMIT 30;

-- 2. Volume agrégé par user post-breach (top stakers)
SELECT '═══ TOP STAKERS POST-BREACH ═══' AS section;

SELECT
  user_id,
  COUNT(*) AS nb_bets,
  SUM(stake_cents)/100.0 AS total_stake_eur,
  MAX(stake_cents)/100.0 AS max_bet_eur,
  MIN(created_at) AS first_bet,
  MAX(created_at) AS last_bet
FROM user_bets
WHERE created_at >= '2026-05-20T00:26:11Z'
GROUP BY user_id
HAVING SUM(stake_cents) > 50000  -- > 500€ total post-breach
ORDER BY total_stake_eur DESC;

-- 3. Bankroll transactions suspectes
SELECT '═══ TRANSACTIONS POST-BREACH ═══' AS section;

SELECT
  id AS tx_id,
  user_id,
  substr(created_at, 1, 19) AS created,
  type,
  amount_cents/100.0 AS amount_eur,
  description
FROM bankroll_transactions
WHERE created_at >= '2026-05-20T00:26:11Z'
ORDER BY ABS(amount_cents) DESC
LIMIT 30;

-- 4. Affiliate clicks post-breach (fraude potentielle)
SELECT '═══ AFFILIATE CLICKS POST-BREACH ═══' AS section;

SELECT
  click_id,
  user_id,
  substr(created_at, 1, 19) AS created,
  network,
  context,
  market,
  selection,
  converted_at,
  payout_cents/100.0 AS payout_eur,
  conversion_type
FROM affiliate_clicks
WHERE created_at >= '2026-05-20T00:26:11Z'
ORDER BY (CASE WHEN payout_cents > 0 THEN payout_cents ELSE 0 END) DESC
LIMIT 50;

-- 5. Conversions affiliation post-breach (specifique)
SELECT '═══ CONVERSIONS AFFILIATION POST-BREACH ═══' AS section;

SELECT
  click_id,
  user_id,
  substr(converted_at, 1, 19) AS converted,
  network,
  context,
  payout_cents/100.0 AS payout_eur,
  conversion_type
FROM affiliate_clicks
WHERE converted_at IS NOT NULL
  AND converted_at >= '2026-05-20T00:26:11Z'
ORDER BY payout_cents DESC;

-- 6. Bet import audit post-breach (CSV imports manuels)
SELECT '═══ BET IMPORT AUDIT POST-BREACH ═══' AS section;

SELECT
  id,
  user_id,
  substr(created_at, 1, 19) AS created,
  ip,
  filename,
  rows_parsed,
  rows_inserted,
  rows_skipped
FROM bet_import_audit
WHERE created_at >= '2026-05-20T00:26:11Z'
ORDER BY created_at DESC;

-- 7. Patterns IP/UA suspect (si table session existe — verifier)
-- A adapter selon schema reel
SELECT '═══ SESSIONS POST-BREACH (si table existe) ═══' AS section;

-- Decommenter et adapter selon schema:
-- SELECT user_id, ip, user_agent, COUNT(*) AS reqs, MIN(ts), MAX(ts)
-- FROM session_log
-- WHERE ts >= '2026-05-20T00:26:11Z'
-- GROUP BY user_id, ip
-- HAVING reqs > 50
-- ORDER BY reqs DESC;

-- 8. Total compte verification (sanity check)
SELECT '═══ STATS GLOBALES ═══' AS section;

SELECT
  COUNT(*) AS total_users
FROM (SELECT DISTINCT user_id FROM user_bets);

SELECT
  COUNT(*) AS total_bets,
  SUM(stake_cents)/100.0 AS total_stake_eur,
  SUM(CASE WHEN created_at >= '2026-05-20T00:26:11Z' THEN 1 ELSE 0 END) AS bets_post_breach,
  SUM(CASE WHEN created_at >= '2026-05-20T00:26:11Z' THEN stake_cents ELSE 0 END)/100.0 AS stake_post_breach_eur
FROM user_bets;

-- ════════════════════════════════════════════════════════════════════
-- INTERPRETATION:
--
-- ✅ NORMAL: paris/transactions cohérents avec activité historique
--           (rate journalier similaire, montants raisonnables)
--
-- ⚠️ SUSPECT:
--    - Pari unique > 1000€ après le 20/05 00:26
--    - Nouveau compte créé après breach avec activité immédiate
--    - Conversions affiliation avec payout > 50€ et click_id non-PariScore
--    - IPs inattendues (autres pays) sur sessions admin
--
-- 🔴 BREACH USAGE CONFIRMED:
--    - Tokens admin générés avec JWT forgé (impossible à détecter directement
--      mais session_log peut montrer accès admin avec UA/IP étranger)
--    - Wave de conversions affiliation simultanées (fraude monétaire)
--
-- ACTIONS si signaux suspects:
--   1. Rollback des transactions/paris suspects
--   2. Suspendre comptes utilisateurs concernés
--   3. Contacter Gambling-Affiliation.com si fraude conversions
--   4. Plainte commissariat avec dossier preuves
-- ════════════════════════════════════════════════════════════════════
