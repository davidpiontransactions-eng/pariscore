---
type: decision
slug: vps-ovh-prod
title: ADR — VPS OVH prod (vs Render.com abandoned)
status: active
tags: [adr, infrastructure, deployment, hosting]
updated: 2026-05-22
sources: [".context/render.yaml (legacy)", "CLAUDE.md", "ecosystem.config.js"]
xref: [[zero-dep-node]], [[sqlite-wal]]
---

# ADR — VPS OVH prod (vs Render.com abandoned)

**Date:** ~2026-04 (migration). **Statut:** ACTIF.

## Décision

Production hébergée sur **VPS OVH** `/home/ubuntu/pariscore` géré via PM2. Render.com abandonné.

## Pourquoi migration depuis Render

1. **Coût** — Render plan payant $19/mo+ vs OVH VPS ~$5-10/mo (1 instance)
2. **SQLite persistance** — Render disk persistant tier complique. VPS = filesystem direct.
3. **Cron jobs** — Render Cron service additionnel $$ vs node-cron in-process gratuit
4. **Sock/WebSocket** — Render limitations vs full VPS control
5. **SSH access** — debug live impossible Render, trivial VPS
6. **No build step** — `git pull` + `pm2 restart` suffit ([[zero-dep-node]] cohérent)

## Workflow déploiement

```bash
# Local push GitHub
git push

# VPS pull + restart
ssh ovh
cd /home/ubuntu/pariscore
git pull
pm2 restart pariscore
```

OU upload direct via WinSCP (édition fichier précise).

## PM2 config

`ecosystem.config.js` racine:
```js
module.exports = {
  apps: [{
    name: 'pariscore',
    script: 'server.js',
    instances: 1,        // single instance (SSE state in-memory)
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' }
  }]
}
```

## Logs

```bash
pm2 logs pariscore --lines 200 --nostream | grep ...
pm2 monit
```

## Sauvegardes

- DB: `pariscore.db` snapshots manuels SCP (TODO automatiser)
- .env: copié séparément, JAMAIS dans git
- Code: GitHub authoritative

## Pitfalls connus

- **WinSCP upload pendant fetchOdds() cron** = file lock potentiel — éviter
- **`pm2 restart` perd state in-memory** (SSE clients, caches) — re-établi automatique
- **bd `b50`** — `SQLITE_NOTADB` runtime corruption observé — investigation ops VPS pending
- **Render.yaml + render-deploy skill** restent en repo legacy — pas utilisé

## Memory user

cf. `reference_deploy_vps.md` mémoire: "Prod = VPS OVH via WinSCP vers `/home/ubuntu/pariscore` (PAS Render); upload disque suffit, pas de restart"

⚠️ Note: pratique réelle = `git pull + pm2 restart` (pas upload disque seul) pour cohérence GitHub authoritative.

## Related

- [[zero-dep-node]] — Cohérence philosophie
- [[sqlite-wal]] — Backup strategy depending

## Changelog

- 2026-05-22: ADR formalisé lors du bootstrap wiki
