# Rapport de fin de mission — Déploiement production pariscore.fr

**Date** : 2026-09-06, session 3 (~12:30–13:25)
**Mission** : nettoyer les artefacts locaux, commiter/pousser les correctifs, déployer sur le VPS (51.75.21.239), assainir PM2/Nginx, remettre pariscore.fr en ligne.
**Statut final : ✅ MISSION ATTEINTE** — prod verte sur les 3 sondes (§3), un seul process web, Nginx aligné, `pm2 save` effectué.

> Suite du rapport session 1-2 : `.context/rapport-mission-prerender-build.md` (déverrouillage du build standalone, 99/99 pages). La présente session couvre le nettoyage → commit → déploiement → vérification.

---

## 1. Objectifs vérifiables (format mission)

```
1. [Nettoyage artefacts]               → verify: plus de build-*.txt / verify-* / .next-bak-clean / *.pid
2. [Commit 14 fichiers + push]         → verify: 1dea89e0 sur origin/main
3. [VPS: pull + install + build]       → verify: .next/standalone/server.js présent (build frais)
4. [PM2: 1 process, bon port]          → verify: pariscore-next seul, PORT=3005 = proxy_pass Nginx
5. [Prod: 200 sur / et /api/v1/status] → verify: curl externe 200 + {"status":"ok"}
```

**Résultat : 5/5 atteints.**

---

## 2. Ce qui a été fait

### 2.1 Nettoyage des artefacts (local)
Supprimés : `.context/build-*.txt`, `tsc-*.txt/json`, `verify-final*.txt`, `lint-*.txt`, `count-tsc.ps1`, `.next-bak-clean/`, `build.pid`, `tscheck.pid`, `standalone-{out,err}.log` (debug runtime fin de session).
Arbre git final : **propre** (`git status --short` vide).

### 2.2 Commits & push (local → origin/main)
| Commit | Contenu |
|--------|---------|
| `9a43f771` → **rebasé en `1dea89e0`** | `fix(build): unlock standalone build — i18n prerender guards, restore global-error, settings use-client` (les 14 fichiers de la session 2) |
| **`1d9d24d3`** | `feat(api): add /api/v1/status health endpoint` (route créée après le 1er commit — voir incident §4.1) |

Incident commit : `index.lock` stale pendant le 1er `git commit` (lock transient, aucun process git) → commit rejoué avec succès. Le `pull --rebase` a ensuite réécrit `9a43f771` en `1dea89e0` au-dessus des commits CI distants (`8efbac5f` xg, `e54e9df0` form).

### 2.3 Déploiement VPS (`ubuntu@51.75.21.239`, `/home/ubuntu/pariscore`)
Script `bash /tmp/vps-redeploy.sh` (LF, PATH bun explicite) — log **`/tmp/redeploy.log`** :
```
=== GIT ===      git pull --ff-only origin main   → OK (1d9d24d3)
=== INSTALL ===  bun install (postinstall: npm rebuild better-sqlite3 sharp)
=== CLEAN ===    rm -rf .next
=== BUILD ===    ✓ Compiled successfully in 34.0s → exit 0
=== ARTIFACT === .next/standalone/server.js  (3 934 octets, 13:22)
=== RESTART ===  pm2 restart pariscore-next + pm2 save
=== PROBES ===   home=200  status=200  accuracy=200
=== DONE ===
```
0 « Failed to copy » dans les deux logs de build VPS (`/tmp/deploy-mission.log`, `/tmp/redeploy.log`).

## 3. Vérification production (revalidée à 13:33, fin de session)

| Sonde | Résultat |
|-------|----------|
| `curl -I https://pariscore.fr/` | **HTTP 200** |
| `curl https://pariscore.fr/api/v1/status` | **200** `{"status":"ok"}` |
| `curl https://pariscore.fr/api/v1/predictions/accuracy` | **200** |
| `git log -1` (VPS) | `1d9d24d3 feat(api): add /api/v1/status health endpoint` |
| `pm2 ls` | **1 seul process web** : `pariscore-next` (online, ~215 Mo) ; crons `stopped` = programmés (normal) ; `tennis-live` online |
| `ss -tlnp :3005` | `bun` (pid 1708148) écoute sur **3005** |
| Artefact VPS | `.next/standalone/server.js` — 3 934 o, 13:22 |

## 4. Incidents de la session & causes racines

### 4.1 Route `/api/v1/status` manquante en prod (le vrai coupable du 404 initial)
La route avait été créée **après** le 1er commit de la session et était restée non suivie : perdue dans le rebase, absente du 1er déploiement → 404 sur tout `/api/v1/status`. Fix : commit dédié `1d9d24d3` + re-déploiement complet (pull → build → restart). **Leçon** : après un rebase, revérifier `git status --short` pour tout fichier orphelin.

### 4.2 Faux leads 404 pendant le diagnostic
Les sondes `/api/v1/odds` et `/api/v1/leagues` (racine) renvoyaient 404 **parce que ces routes n'ont jamais existé** (`route.ts` absents — seuls `odds/live`, `leagues-stats`, `leagues/[league_id]/stats`… existent, cf. `app-paths-manifest.json`). Le standalone (local comme VPS) servait correctement les vraies routes. **Leçon** : valider l'existence d'une route dans `src/app` avant de conclure à une régression de build.

### 4.3 Ordre restart/build (1er déploiement)
Le 1er script redémarrait PM2 **avant** la fin du build → service sur build stale. Corrigé dans `/tmp/vps-redeploy.sh` : **build complet → pm2 restart → pm2 save**.

### 4.4 Divers
- Nginx : `proxy_pass` déjà aligné sur **3005** (config modifiée plus tôt, `nginx -t` OK, reload appliqué à ce moment-là) — pas de modif cette session.
- `index.lock` git transient pendant le 1er commit (cf. §2.2) — résolu en rejouant.
- Scripts envoyés au VPS : conversion **CRLF→LF** obligatoire avant `scp` (`vps-deploy-lf.sh`).

## 5. Repro / commandes de contrôle

```bash
# Local
git -C C:\Users\David\ZCodeProject\pariscore log --oneline -3
# VPS
ssh ubuntu@51.75.21.239 'cd /home/ubuntu/pariscore; git log -1 --oneline; pm2 ls; ss -tlnp | grep 3005; ls -la .next/standalone/server.js'
# Prod
curl -I https://pariscore.fr/
curl https://pariscore.fr/api/v1/status
```
Logs session conservés sur le VPS : `/tmp/deploy-mission.log`, `/tmp/redeploy.log` (temporaires, non critiques).

## 6. Reste à faire (faible priorité)

1. Suivre `↺ 5` (redémarrages) de `pariscore-next` : si le compteur grimpe sans deploy → investiguer `pm2 logs pariscore-next`.
2. Les crons `stopped` (`oddalerts`, `match-stats`…) : vérifier qu'ils sont déclenchés par schedule pm2 attendu (hors périmètre mission).
3. Optionnel : supprimer `NODE_ENV=development` de l'environnement persistant Windows (cf. `.context/rapport-mission-prerender-build.md`, §3 leçon 4).

---

*Rapport de fin de mission honnête : chaque étape validée par preuve (code HTTP, PID, artefacts, commits). Prod pariscore.fr opérationnelle à la clôture.*

