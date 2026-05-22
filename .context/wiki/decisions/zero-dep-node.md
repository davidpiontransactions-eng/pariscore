---
type: decision
slug: zero-dep-node
title: ADR — Zero dependency Node.js backend
status: active
tags: [adr, architecture, backend, principle]
updated: 2026-05-22
sources: [".claude/CLAUDE.md", "server.js", "package.json"]
xref: [[sqlite-wal]], [[caveman-mode]]
---

# ADR — Zero dependency Node.js backend

**Date:** projet initial 2026-04-27. **Statut:** ACTIF, immuable sauf exception explicite.

## Décision

Backend `server.js` n'utilise **AUCUNE dépendance npm** sauf `better-sqlite3` (driver SQLite binding native). Modules Node.js natifs uniquement: `http`, `https`, `fs`, `path`, `url`, `crypto`, `worker_threads`.

## Pourquoi

1. **Sécurité supply chain** — chaque dep npm = vecteur d'attaque potentiel (event-stream, colors, faker incidents historiques). PariScore = données financières (cotes + paris user) — surface attaque minimale obligatoire.
2. **Performance boot** — pas de `npm install` 5min sur VPS OVH.
3. **Maintenance** — pas de dependabot, pas de lockfile drift, pas de breaking changes hebdo.
4. **Portabilité** — `git pull` + `node server.js` suffit. Pas de Docker, pas de bundler.
5. **Compréhension** — code lisible bout-en-bout sans abstractions library.

## Exception unique justifiée

**`better-sqlite3`** — binding C natif vers SQLite3 lib système. Bénéfices:
- Sync API (compatible single-thread Node, pas de callback hell)
- WAL mode performant (cf. [[sqlite-wal]])
- Largement adopté + audité (used by VS Code, Notion)
- Pas d'alternative pure-JS viable performance

## Conséquences

✅ **Pros:**
- Server.js 30k+ lignes mais lisible
- Boot <1s
- VPS OVH zero ops surcharge
- Pas de vulnerability scan continu npm

❌ **Cons:**
- Réécriture composants existants (HTTP parser, cookie parser, etc) — assumé
- Pas de framework Express/Fastify routing — switch case `pathname.startsWith()` manuel
- Pas de middleware ecosystem (auth, validation, etc) — codé maison

## Patterns dérivés

- **Routing:** `if/else` sur `pathname` (cf. server.js ~700 routes)
- **HTTP:** `httpsGet(url, headers)` helper natif promisifié
- **JSON:** `jsonResponse(res, status, data)` helper
- **Body parsing:** `readBodyLimited(req, maxBytes)` avec protection OOM
- **Auth:** PBKDF2 + JWT custom impl
- **Workers:** `worker_threads` pour calculs Bootstrap (innovation backlog)

## Frontend pendant

`pariscore.html` = SPA mono-fichier ~30k lignes. **Zero framework** (pas React/Vue/Svelte). Vanilla JS + DOM API. Cohérent avec philosophie backend.

## Related

- [[sqlite-wal]] — Exception dependency justifiée
- [[caveman-mode]] — Posture minimaliste cohérente

## Changelog

- 2026-05-22: ADR formalisé lors du bootstrap wiki — pratique déjà appliquée depuis projet initial
