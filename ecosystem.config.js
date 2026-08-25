/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  PariScore — PM2 ecosystem config
 * ══════════════════════════════════════════════════════════════════════════════
 *  Neuf process gérés par PM2 :
 *    1. `pariscore`                   : serveur HTTP principal (Node.js + SSE + cron internes)
 *    2. `pariscore-cron-rg`           : job découplé Roland Garros prefetch toutes les 2h
 *    3. `pariscore-cron-match-stats`  : rafraîchissement quotidien match_stats_history
 *    4. `pariscore-vault-daily`      : note quotidienne vault Obsidian (05:00 UTC)
 *    5. `pariscore-vault-weekly`     : revue hebdo modèles (lundi 08:00 UTC)
 *    6. `pariscore-cron-cycling`     : scraper cyclisme cyclingstage.com 3×/jour (Tour)
 *    7. `pariscore-cron-sps`         : SPS tennis (Surface PowerScore) 2×/jour
*    8. `pariscore-cron-dr`          : scraper DR tennis TennisAbstract quotidien 04:00 UTC
 *    9. `pariscore-cron-gemini`      : pré-calcul analyses Gemini matchs du jour (2h, 06:00-18:00 UTC)
 *   10. `pariscore-cron-press-review`: pré-chauffe cache revue de presse (quotidien 07:00 UTC, Zero-LLM)
 *   11. `pariscore-cron-elo-weekly`   : snapshots Elo surface TennisAbstract + matchs L10 (lundi 14h Paris)
 *   12. `pariscore-cron-top5-backtest`: settle + snapshot quotidien du backtest Top 5 foot (05:15 UTC)
 *
 *  Lancement initial (VPS) :
 *    pm2 start ecosystem.config.js
 *    pm2 save                # persiste pour reboot
 *    pm2 startup             # génère le script systemd
 *
 *  Lancement targeted :
 *    pm2 start ecosystem.config.js --only pariscore
 *    pm2 start ecosystem.config.js --only pariscore-cron-rg
 *    pm2 start ecosystem.config.js --only pariscore-cron-match-stats
 *    pm2 start ecosystem.config.js --only pariscore-vault-daily
 *    pm2 start ecosystem.config.js --only pariscore-vault-weekly
 *    pm2 start ecosystem.config.js --only pariscore-cron-cycling
 *
 *  Logs :
 *    pm2 logs pariscore --lines 100
 *    pm2 logs pariscore-cron-rg --lines 50
 *    pm2 logs pariscore-cron-match-stats --lines 50
 *
 *  Restart :
 *    pm2 restart pariscore
 *    pm2 restart pariscore-cron-rg     # force immediate refresh RG
 *    pm2 restart pariscore-cron-match-stats  # force run now
 *
 *  Status :
 *    pm2 status
 *    pm2 describe pariscore-cron-rg    # voir prochain cron_restart
 * ══════════════════════════════════════════════════════════════════════════════
 */
module.exports = {
  apps: [
    {
      // === Serveur HTTP principal ===
      name: 'pariscore',
      script: 'server.js',
      cwd: '/home/ubuntu/pariscore',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000, // laisse le graceful shutdown terminer wal_checkpoint(TRUNCATE) avant SIGKILL
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/pariscore.err.log',
      out_file: 'logs/pariscore.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job Roland Garros prefetch ===
      // Toutes les 2h pile (00:00, 02:00, 04:00, ...). Process meurt après
      // exécution, PM2 le relance au prochain tick cron.
      name: 'pariscore-cron-rg',
      script: 'tools/cron-rg-prefetch.js',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 */2 * * *', // chaque heure paire (UTC selon serveur)
      autorestart: false,           // PM2 ne redémarre PAS sur exit (cron only)
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // Note : ce script appelle le serveur principal via HTTP localhost
        // (POST /api/v1/admin/rg-refresh). Pas de require(server.js) donc
        // pas de SKIP_LISTEN nécessaire. RG_REFRESH_TOKEN doit matcher
        // celui défini dans .env du process 'pariscore'.
      },
      error_file: 'logs/cron-rg.err.log',
      out_file: 'logs/cron-rg.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job match_stats_history ===
      // Chaque nuit à 03:00 UTC. Upsert des matchs BSD "finished" depuis la
      // dernière run. Resume-safe via .cron_match_stats_state.json.
      name: 'pariscore-cron-match-stats',
      script: 'scripts/cron_refresh_match_stats.js',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 3 * * *', // chaque nuit à 03:00 UTC
      autorestart: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/cron-match-stats.err.log',
      out_file: 'logs/cron-match-stats.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job vault-daily ===
      // Chaque matin à 05:00 UTC. Génère la note quotidienne dans le vault Obsidian
      // avec les matchs du jour, picks, performance modèles et bankroll.
      name: 'pariscore-vault-daily',
      script: 'scripts/vault-daily-summary.js',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 5 * * *', // chaque matin à 05:00 UTC
      autorestart: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/vault-daily.err.log',
      out_file: 'logs/vault-daily.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron vault-weekly-review ===
      // Chaque lundi à 08:00 UTC. Génère la revue hebdomadaire de performance des modèles.
      name: 'pariscore-vault-weekly',
      script: 'scripts/vault-weekly-review.js',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 8 * * 1', // chaque lundi à 08:00 UTC
      autorestart: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/vault-weekly.err.log',
      out_file: 'logs/vault-weekly.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job cycling scraper (Tour de France 2026) ===
      // FIX 2026-07-13 : le pipeline cyclisme reposait uniquement sur setup-cycling-cron.sh
      // (crontab système manuel). Si oubli d'installation → données stale >24h →
      // getHealth() retourne stale → 503 sur /_health, sans mécanisme de relance
      // automatique. On ajoute un cron PM2 comme pour RG et match-stats, qui tourne
      // 3×/jour pendant le Tour (les favoris évoluent : abandons, météo, interviews).
      // Le scraper détermine l'étape du jour via stages-calendar.json (--current).
      // Période Tour : 4-26 juillet 2026 (hors période il ne fait rien de nuisible,
      // le scraper détecte l'absence d'étape et no-op).
      name: 'pariscore-cron-cycling',
      script: 'scripts/scraper-cyclingstage-favourites.js',
      args: '--current --force',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 6,12,18 * * *', // 3×/jour à 06:00, 12:00, 18:00 UTC
      autorestart: false,               // cron-only, ne redémarre pas sur exit
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/cron-cycling.err.log',
      out_file: 'logs/cron-cycling.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job SPS (Surface PowerScore) — tennis prematch enrichment ===
      // Calcule le SPS [0-100] de tous les joueurs actifs (tennis_matches_internal)
      // et peuple player_surface_scores. Sans ce cron, les métriques SPS + rang SPS
      // sont vides → affichage "SPS —" dans premierCard.
      // FIX 2026-07-15 : le cron lit tennis_matches_internal directement (5516
      // joueurs) au lieu de l'HTTP /upcoming (qui renvoyait 0 match).
      name: 'pariscore-cron-sps',
      script: 'cron_sps_updater.py',
      interpreter: 'python3',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '30 5,17 * * *', // 2×/jour à 05:30 et 17:30 UTC
      autorestart: false,             // cron-only
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        PARISCORE_DB_PATH: '/home/ubuntu/pariscore/pariscore.db',
      },
      error_file: 'logs/cron-sps.err.log',
      out_file: 'logs/cron-sps.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job DR Moyen (5M) — TennisAbstract /jsfrags/ scraper ===
      // Scrape le Dominance Ratio des 5 derniers matchs (filtré surface) de
      // chaque joueur top-200 ATP+WTA, peuple src/lib/tennis-dr/dr-cache.json.
      // Sans ce cron, le token "DR x.xx" reste masqué dans premierCard (cache vide).
      // ⚠️ /jsfrags/ est disallow par robots.txt TennisAbstract — le scraper
      // exige LEGAL_OVERRIDE_CONFIRMED=1. Throttle 1 req/1.5s.
      name: 'pariscore-cron-dr',
      script: 'scripts/cron-tennis-dr.sh',
      interpreter: 'bash',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 4 * * *', // quotidien à 04:00 UTC (DR évolue match-par-match)
      autorestart: false,        // cron-only
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        LEGAL_OVERRIDE_CONFIRMED: '1', // bypass du garde-fou (assumé par l'opérateur)
      },
      error_file: 'logs/cron-dr.err.log',
      out_file: 'logs/cron-dr.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job hebdo Elo Surface (lundi 14h Paris) ===
      // Scrape tennisabstract.com → snapshots Elo DB (TennisEloSnapshot) +
      // matchs récents par joueur (TennisPlayerMatch) pour le L10 Surface.
      // PM2 cron : 12:00 ET 13:00 UTC le lundi — le wrapper vérifie l'heure
      // Europe/Paris == 14h (été: 12 UTC, hiver: 13 UTC) pour ne scraper
      // qu'une fois, au bon créneau. Durée ≈ 15 min (top 300, 1 req/1.5s).
      name: 'pariscore-cron-elo-weekly',
      script: 'scripts/cron-tennis-elo-weekly.sh',
      interpreter: 'bash',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 12,13 * * 1', // lundi 12h + 13h UTC (garde 14h Paris dans le wrapper)
      autorestart: false,            // cron-only
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        LEGAL_OVERRIDE_CONFIRMED: '1', // bypass du garde-fou (assumé par l'opérateur)
      },
      error_file: 'logs/cron-elo-weekly.err.log',
      out_file: 'logs/cron-elo-weekly.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job Gemini (pré-calcul analyses matchs du jour) ===
      // Appelle la route Next.js GET /api/ai/gemini-cron (servie par
      // `pariscore-next`, port 3005) qui pré-calcule les analyses Gemini
      // des 5 premiers matchs tennis + 5 premiers foot du jour, stockées
      // dans le cache mémoire gemini-cache.ts (TTL 12h). Sans ce cron,
      // le service de bookings subit la latence de l'appel Gemini à la
      // demande → attente utilisateur. Toutes les 2h entre 06:00 et
      // 18:00 UTC : la dernière run (18:00) couvre les matchs du soir
      // sans jamais dépasser le TTL de 12h au prochain tick.
      // Le token CRON_SECRET est lu depuis .env par scripts/cron-gemini.sh
      // (fallback pariscore-cron-2026, comme dans la route).
      name: 'pariscore-cron-gemini',
      script: 'scripts/cron-gemini.sh',
      interpreter: 'bash',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 6,8,10,12,14,16,18 * * *', // toutes les 2h, 06:00-18:00 UTC
      autorestart: false,                          // cron-only, meurt après exécution
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        GEMINI_CRON_URL: 'http://localhost:3005', // pariscore-next (Next.js standalone)
      },
      error_file: 'logs/cron-gemini.err.log',
      out_file: 'logs/cron-gemini.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job Revue de Presse (pré-chauffe cache 24h, Zero-LLM) ===
      // Appelle la route Next.js GET /api/ai/press-review-cron (servie par
      // `pariscore-next`, port 3005) qui pré-remplit .cache/press-review/
      // pour les matchs du jour (tennis + football). Pipeline 100 % gratuit :
      // RSS Google News + connecteurs ciblés + synthèse déterministe, aucun
      // appel Gemini/LLM (fallback LLM supprimé).
      // Le token CRON_SECRET est lu depuis .env par scripts/cron-press-review.sh.
      name: 'pariscore-cron-press-review',
      script: 'scripts/cron-press-review.sh',
      interpreter: 'bash',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '0 7 * * *', // quotidien à 07:00 UTC (cache chaud pour la journée)
      autorestart: false,        // cron-only, meurt après exécution
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PRESS_CRON_URL: 'http://localhost:3005', // pariscore-next (Next.js standalone)
      },
      error_file: 'logs/cron-press-review.err.log',
      out_file: 'logs/cron-press-review.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job Stats Ligues OddAlerts (refresh quotidien) ===
      // Scrape les 1582 pages ligues oddalerts.com (stats buts/cartons/
      // corners/BTTS + fixtures cotes 1X2) et upserte la table SQLite
      // `league_season_stats` dans pariscore.db. Consommée par l'API Next.js
      // /api/v1/leagues-stats et les pages /ligues.
      // Skip-cache intégré (<20h) → un `pm2 restart` manuel ne re-scrape que
      // si nécessaire ; --force force le pass complet.
      name: 'pariscore-cron-oddalerts',
      script: 'scripts/scrape-oddalerts.js',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '30 4 * * *', // quotidien à 04:30 UTC (~2 min de run)
      autorestart: false,         // cron-only, meurt après exécution
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DATABASE_PATH: '/home/ubuntu/pariscore/pariscore.db',
      },
      error_file: 'logs/cron-oddalerts.err.log',
      out_file: 'logs/cron-oddalerts.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      // === Cron job Backtest Top 5 (settle + snapshot quotidien) ===
      // 1. Settle les picks du backtest Top 5 football dont la date est passée
      //    (résultats BSD) ; 2. Snapshot du top 5 du jour tel que rendu par le
      //    moteur prod → data/top5-backtest/football.json. Consommé par
      //    GET /api/football/top5/backtest (bandeau backtest du widget sidebar).
      // Idempotent : un re-run le même jour ne duplique rien.
      name: 'pariscore-cron-top5-backtest',
      script: 'scripts/cron-top5-backtest.sh',
      interpreter: 'bash',
      cwd: '/home/ubuntu/pariscore',
      cron_restart: '15 5 * * *', // quotidien à 05:15 UTC (après les crons de nuit)
      autorestart: false,         // cron-only, meurt après exécution
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        TOP5_BACKTEST_DIR: '/home/ubuntu/pariscore/data/top5-backtest',
      },
      error_file: 'logs/cron-top5-backtest.err.log',
      out_file: 'logs/cron-top5-backtest.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
  ],
};
