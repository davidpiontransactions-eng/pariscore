# Rapport QA — Calendrier Football Pariscore

**Date :** 2026-09-08  
**VPS :** ubuntu@51.75.21.239 (pariscore.fr)  
**Build :** commit `d3475496` (`fix(football): repair corrupted FootballCalendar component, restore export`)  
**Service :** pm2 `pariscore-next` — status **online** (pid 237639, 105 Mo)

---

## 1. Contexte

Déploiement de la page `/calendrier-foot` (Flashscore-style) + composant `FootballCalendar` + API `/api/football/calendar`.

Le build VPS échouait sur **2 erreurs TypeScript** dues à un fichier corrompu :

| Erreur | Localisation | Cause |
|--------|-------------|-------|
| TS2305 `FootballCalendar` not exported | `calendrier-foot/page.tsx:1` | export absent du composant corrompu |
| TS2304 `Cannot find name placeholder` | `football-calendar.tsx:98` | bloc JSX collé accidentellement dans le corps de `teamLogoUrl()` (lignes 54–97) |

Conséquence : `.next/standalone/server.js` jamais généré → pm2 `pariscore-next` en `errored` (`MODULE_NOT_FOUND`).

## 2. Correctifs appliqués

1. **`football-calendar.tsx` réécrit** (commit `d3475496`, pushé) : `teamLogoUrl` réparé, `FotMobLeagueHeader` autonome, export `FootballCalendar` restauré, UI complète (nav dates, filtres Tous/En direct/À venir/Terminés, recherche, groupement par ligue, collapse, skeletons, empty state).
2. **Pull VPS** : `git pull --rebase` fast-forward `5f959063..d3475496`.
3. **Rebuild VPS** : `TMPDIR=/home/ubuntu/build-tmp npm run build` — SUCCESS, `server.js` + `.next/BUILD_ID` générés.
4. **`pm2 restart pariscore-next`** → status `online`.

## 3. Résultats QA (curl http://127.0.0.1:3000)

### Pages

| Endpoint | Status | Détail |
|----------|--------|--------|
| `GET /` | ✅ 200 | HTML complet, 169 KB, ~207 ms |
| `GET /calendrier-foot` | ✅ 200 | HTML complet, 102 KB |

### APIs

| Endpoint | Status | Détail |
|----------|--------|--------|
| `GET /api/v1/multisport-calendar` | ✅ 200 | 429 matches (tennis + foot, source betexplorer+bsd) |
| `GET /api/football/calendar` | ✅ 200 | matches BSD avec ligue, pays, logo, cotes |
| `GET /api/tennis/prematch` | ✅ 200 | — |

### Assets statiques (public/)

| Asset | Status |
|-------|--------|
| `/icon-512.png` | ✅ 200 (avant : 500) |
| `/icon-192.png` | ✅ 200 (avant : 500) |
| `/favicon.svg` | ✅ 200 (avant : 500) |
| `/manifest.json` | ✅ 200 (avant : 500) |
| `/logo-header.svg` | ✅ 200 (avant : 500) |

Les 500 précédents étaient la conséquence du `standalone/` incomplet (pas de `server.js` ni assets copiés par `postbuild.mjs`). Après rebuild + `postbuild.mjs`, tout est servi.

## 4. Bugs corrigés

- ✅ **[CRITIQUE] Build VPS bloqué** (2 erreurs TS sur fichier corrompu) → `d3475496`
- ✅ **[CRITIQUE] PM2 `pariscore-next` errored** (`MODULE_NOT_FOUND` standalone/server.js) → rebuild + restart
- ✅ **[MAJOR] Assets statiques `public/` en 500** (5 fichiers) → résolu par le build complet

## 5. Bugs restants / observations

- ⚠️ **Infra** : `/tmp` était à 100 % (fichiers supprimés encore ouverts par des process). Nettoyé passivement (les process ont relâché) ; `TMPDIR=/home/ubuntu/build-tmp` utilisé par sécurité pour le build.
- ⚠️ **Observation** : log applicatif montre `[bsd-foot] Fetched 0 live matches` — le flux live BSD renvoie 0 match (probablement aucun match live au moment du test, à surveiller).

## 6. Scripts QA utilisés

- `qa_audit_vps.sh` — pages + APIs + assets (scp `/tmp/qa_audit.sh`)
- `qa_check.sh` / `qa_check2.sh` — checks ciblés

*(scripts temporaires locaux supprimés après usage)*

## 7. Recommandations

1. **Typecheck avant push** (`bun run typecheck`) — aurait intercepté la corruption en local.
2. **Vérifier `.next/standalone/server.js` existe après build** dans le script de deploy, sinon abort avant `pm2 restart`.
3. Surveiller `bsd-foot live` (0 match fetched) sur la prochaine session avec matchs réels.
