/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  PariScore — PM2 ecosystem config
 * ══════════════════════════════════════════════════════════════════════════════
 *  Six process gérés par PM2 :
 *    1. `pariscore`                   : serveur HTTP principal (Node.js + SSE + cron internes)
 *    2. `pariscore-cron-rg`           : job découplé Roland Garros prefetch toutes les 2h
 *    3. `pariscore-cron-match-stats`  : rafraîchissement quotidien match_stats_history
 *    4. `pariscore-vault-daily`      : note quotidienne vault Obsidian (05:00 UTC)
 *    5. `pariscore-vault-weekly`     : revue hebdo modèles (lundi 08:00 UTC)
 *    6. `pariscore-cron-cycling`     : scraper cyclisme cyclingstage.com 3×/jour (Tour)
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
  ],
};
