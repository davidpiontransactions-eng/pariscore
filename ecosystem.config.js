/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  PariScore — PM2 ecosystem config
 * ══════════════════════════════════════════════════════════════════════════════
 *  Deux process gérés par PM2 :
 *    1. `pariscore`         : serveur HTTP principal (Node.js + SSE + cron internes)
 *    2. `pariscore-cron-rg` : job découplé Roland Garros prefetch toutes les 2h
 *
 *  Lancement initial (VPS) :
 *    pm2 start ecosystem.config.js
 *    pm2 save                # persiste pour reboot
 *    pm2 startup             # génère le script systemd
 *
 *  Lancement targeted :
 *    pm2 start ecosystem.config.js --only pariscore
 *    pm2 start ecosystem.config.js --only pariscore-cron-rg
 *
 *  Logs :
 *    pm2 logs pariscore --lines 100
 *    pm2 logs pariscore-cron-rg --lines 50
 *
 *  Restart :
 *    pm2 restart pariscore
 *    pm2 restart pariscore-cron-rg     # force immediate refresh RG
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
  ],
};
