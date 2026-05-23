#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
//  PariScore — Cron Roland Garros prefetch (Phase 2 / rapport §5.1)
// ══════════════════════════════════════════════════════════════════════════════
//  Job découplé exécuté hors d'une requête utilisateur HTTP.
//
//  Architecture : ce script appelle la route admin localhost
//  POST /api/v1/admin/rg-refresh?token=...&tour=ATP|WTA du serveur principal.
//  Le serveur exécute _rgBuildFresh() (fetch BSD + Monte Carlo Worker thread
//  + write atomique data/rg_predictions_<tour>.json + cache SQLite).
//
//  Pourquoi pas un require(server.js) ? Les helpers Roland Garros sont
//  déclarés dans le scope du callback http.createServer (35 000 lignes
//  monolithiques). Les exporter exigerait un refactor risqué. Trigger via
//  HTTP localhost = découplé proprement, idempotent, observable.
//
//  Lancement :
//    - PM2 cron_restart '0 */2 * * *' (toutes les 2h pile)
//    - Manuel : node tools/cron-rg-prefetch.js
//    - Crontab système ok aussi
//
//  Variables d'environnement requises :
//    - RG_REFRESH_TOKEN ou ADMIN_PASSWORD : secret partagé avec server.js
//    - PORT (default 3000) : port du serveur PariScore principal
//
//  Exit codes :
//    0 = au moins 1 tour OK
//    1 = aucun tour OK (les 2 ont échoué)
//    2 = erreur de config (token absent, etc.)
// ══════════════════════════════════════════════════════════════════════════════
'use strict';

const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '127.0.0.1';
const TOKEN = process.env.RG_REFRESH_TOKEN || process.env.ADMIN_PASSWORD || '';
const REQUEST_TIMEOUT_MS = 90 * 1000; // 90s — laisse de la marge pour BSD lent

if (!TOKEN) {
  console.error('[cron-rg] FATAL : RG_REFRESH_TOKEN ou ADMIN_PASSWORD env requis');
  process.exit(2);
}

const startedAt = Date.now();
console.log(`[cron-rg] start at ${new Date().toISOString()} · target ${HOST}:${PORT}`);

function triggerRefresh(tour) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const params = new URLSearchParams({ token: TOKEN, tour, simN: '10000' }).toString();
    const opts = {
      hostname: HOST,
      port: PORT,
      path: `/api/v1/admin/rg-refresh?${params}`,
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        const ms = Date.now() - t0;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_) {}
        if (res.statusCode === 200 && parsed && parsed.ok) {
          console.log(`[cron-rg ${tour}] OK ${ms}ms · ${parsed.draw_size || 0} players · server-ms ${parsed.ms || '?'}`);
          resolve(true);
        } else if (res.statusCode === 200 && parsed && parsed.ok === false) {
          console.warn(`[cron-rg ${tour}] unavailable ${ms}ms : ${parsed.reason || 'unknown'}`);
          resolve(false);
        } else {
          console.error(`[cron-rg ${tour}] HTTP ${res.statusCode} ${ms}ms · body: ${body.slice(0, 300)}`);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`[cron-rg ${tour}] request error ${Date.now() - t0}ms :`, err && err.message);
      resolve(false);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      console.error(`[cron-rg ${tour}] timeout ${REQUEST_TIMEOUT_MS}ms`);
      try { req.destroy(); } catch (_) {}
      resolve(false);
    });
    req.end();
  });
}

(async () => {
  let okCount = 0;
  for (const tour of ['ATP', 'WTA']) {
    const ok = await triggerRefresh(tour);
    if (ok) okCount++;
  }
  const elapsed = Date.now() - startedAt;
  console.log(`[cron-rg] done · ${okCount}/2 tours OK · total ${elapsed}ms`);
  process.exit(okCount > 0 ? 0 : 1);
})();
