# Handoff — 2026-07-19 (soir) — Football BSD + reprise demain

## TL;DR

1. **Football BSD** : le fetcher a été corrigé (bon endpoint). Commit `378ea77` **poussé sur `main`**.
2. **Build VPS cassé** : le shim `pariscore-services` (F1) n’était que dans `node_modules/` (gitignored) → Turbopack ne le trouve plus au rebuild.
3. **Fix préparé localement** (à committer / déployer demain) : package versionné `packages/pariscore-services/` + dep workspace dans `package.json`.

---

## Ce qui a été fait aujourd’hui

### F1 (déjà en prod avant ce handoff)
- API `GET /api/f1` OK (Jolpica, 22 drivers, Belgian GP)
- Shim runtime `require("pariscore-services")` pour contourner Turbopack qui trace les `require` hors `src/`
- Problème : le shim était **uniquement** sous `node_modules/pariscore-services/` → **non versionné**

### Tennis
- Elo arrondis entiers : `Math.round()` dans `src/components/tennis/player-statline.tsx` (commit `cca322e`)

### Football BSD (cœur de la session)
**Root cause mock data** : mauvais base URL.

| Avant (404) | Après (OK) |
|-------------|------------|
| `https://sports.bzzoiro.com/football/api/v2/matches/` | `https://sports.bzzoiro.com/api/` |

**Endpoints validés** (token `BSD_API_KEY` dans `.env` VPS) :

```
GET https://sports.bzzoiro.com/api/                  → index endpoints
GET https://sports.bzzoiro.com/api/matches/?status=notstarted&limit=100
GET https://sports.bzzoiro.com/api/live/?limit=50
GET https://sports.bzzoiro.com/api/leagues/
GET https://sports.bzzoiro.com/api/fixtures/
GET https://sports.bzzoiro.com/api/teams/             → pas de logos
```

**Shape match BSD** (résumé) :
- `home_team` / `away_team` = **string**
- `home_team_obj` / `away_team_obj` = objets `{ id, name, short_name }`
- Odds **directes** : `odds_home`, `odds_draw`, `odds_away` (+ O/U, BTTS)
- Live : `status` ∈ `1st_half` | `2nd_half` | `HT` | `finished` | `notstarted`
- Stats : `live_stats.home|away` (possession, shots, corners…)
- Couleurs maillot : `jerseys.home.player.base` (hex sans `#`)

**Fichier modifié** : `src/lib/bsd-football-fetcher.ts`  
**Commit** : `378ea77` — déjà sur `origin/main`

**Contexte calendrier** : mi-juillet = hors-saison big-5 EU. Données live/prematch réelles = USL, NWSL, Liga MX, Allsvenskan, K League, friendlies, etc. (pas EPL/L1/LaLiga en ce moment).

---

## État git / VPS au moment du handoff

### Local
```
branch: main
origin/main: 378ea77  (football fetcher)
working tree: dirty après ce handoff (packages/pariscore-services + package.json)
```

### VPS (`ubuntu@51.75.21.239`, clé `~/.ssh/id_rsa_pariscore`)
- Code tiré jusqu’à `378ea77`
- **Dernier `bun run build` ÉCHOUÉ** :
  ```
  Module not found: Can't resolve 'pariscore-services'
  ./src/app/api/f1/route.ts
  ```
- PM2 au moment du test :
  - `pariscore-next` (port via nginx → 3005) : **encore sur l’ancien build** (F1 OK tant qu’on ne rebuild/restart pas)
  - `pariscore` (legacy) : online
- Bun path VPS : `/home/ubuntu/.bun/bin/bun` (pas toujours dans le PATH non-interactif)

### Frontend football (prod actuelle)
- Hook `src/hooks/use-football-matches.ts` : fallback mock `ALL_FOOTBALL_MATCHES` si API vide/erreur
- Routes API déjà branchées sur le fetcher :
  - `src/app/api/football/matches/route.ts`
  - `src/app/api/football/live/route.ts`
  - `src/app/api/football/prematch/route.ts`
- **Le nouveau fetcher n’est PAS encore en prod** (build VPS bloqué par F1 shim)

---

## Fix F1 shim (à finir demain — déjà écrit localement)

```
packages/pariscore-services/
  package.json   # name: "pariscore-services"
  index.js       # re-export getF1Drivers / getF1Races depuis services/f1Service.js

package.json root:
  "workspaces": ["packages/*"]   # déjà là
  "dependencies": {
    "pariscore-services": "workspace:*"   # AJOUTÉ
  }

next.config.ts:
  serverExternalPackages: ["better-sqlite3", "pariscore-services"]  # déjà là
```

### Commandes reprise (ordre)

```powershell
cd C:\Users\David\ZCodeProject\pariscore
git status
# vérifier packages/pariscore-services + package.json

# Commit + push
git add packages/pariscore-services package.json bun.lock
git commit -m "fix: version pariscore-services workspace package for F1 Turbopack bridge"
git push origin main

# Deploy VPS
ssh -i $env:USERPROFILE\.ssh\id_rsa_pariscore ubuntu@51.75.21.239
# puis:
export PATH="/home/ubuntu/.bun/bin:$PATH"
cd /home/ubuntu/pariscore
git pull
bun install
bun run build
pm2 restart pariscore-next
pm2 logs pariscore-next --lines 30
```

### Vérifs post-deploy

```bash
# F1 toujours OK
curl -s http://127.0.0.1:3005/api/f1 | head -c 200

# Football réel (plus de 503 / empty)
curl -s http://127.0.0.1:3005/api/football/matches | head -c 400
curl -s http://127.0.0.1:3005/api/football/live | head -c 400
curl -s http://127.0.0.1:3005/api/football/prematch | head -c 400

# Auth BSD (si besoin debug)
# Token dans /home/ubuntu/pariscore/.env → BSD_API_KEY
curl -s -H "Authorization: Token $BSD_API_KEY" \
  "https://sports.bzzoiro.com/api/live/?limit=2"
```

UI : https://pariscore.fr → onglet Football → plus de PSG/City mock si API OK.

---

## Suite fonctionnelle (après deploy)

1. **Logos équipes foot** — BSD `/api/teams/` ne renvoie **pas** de logo. Options :
   - table `team_logos` + skill `ps-scrape-logos`
   - Wikipedia / TheSportsDB
   - couleurs jersey BSD déjà mappées dans le fetcher
2. **Filtres ligues** — optionnel `?league=1` (EPL id=1) quand la saison reprend
3. **Retirer / réduire le mock fallback** dans `use-football-matches.ts` une fois l’API stable
4. **graphify update .** après modifs code

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/lib/bsd-football-fetcher.ts` | Mapping BSD → `FootballMatch` |
| `src/lib/football-data.ts` | Types + mock UI |
| `src/hooks/use-football-matches.ts` | Client + fallback mock |
| `src/app/api/football/*/route.ts` | API Next |
| `packages/pariscore-services/` | Bridge F1 (nouveau, versionné) |
| `src/app/api/f1/route.ts` | `require("pariscore-services")` |
| `next.config.ts` | `serverExternalPackages` |
| `services/f1Service.js` | Source F1 legacy |

---

## Secrets / ops

- SSH : `ubuntu@51.75.21.239` — `C:\Users\David\.ssh\id_rsa_pariscore`
- nginx : `pariscore.fr` → `localhost:3005` (`pariscore-next`)
- `.env` VPS : `BSD_API_KEY`, `API_FOOTBALL_KEY`, etc. — **ne pas committer**
- Ne pas rebuild VPS sans le package `pariscore-services` versionné (sinon casse F1)

---

## Graphify (mis à jour 2026-07-19 soir)

- Doc : `.context/docs/bsd-football-api-endpoints.md`
- `graphify update .` → 31180+ nodes
- Nœuds curés : `bsd_api_root`, `bsd_api_matches_notstarted`, `bsd_api_live`, `bsd_api_leagues`, `bsd_api_fixtures`, `bsd_api_teams`, `bsd_wrong_base_url`
- Chemins vérifiés :
  - `fetchBSDFootballPrematch()` → `BSD GET /api/matches/?status=notstarted`
  - `bsd-football-fetcher.ts` → `fetchBSDFootballLive()` → `BSD GET /api/live/`
- Query demain : `graphify query "BSD football API endpoints"`

## Prompt de reprise (copier-coller demain)

```
Reprise session 2026-07-19. Lis .context/HANDOFF-2026-07-19-football-bsd.md

Priorité 1: commit + push packages/pariscore-services + package.json workspace dep (déjà sur main si b7c6970),
deploy VPS (bun install && bun run build && pm2 restart pariscore-next),
vérifier /api/f1 et /api/football/matches|live|prematch.

Priorité 2: logos équipes foot si football réel OK.
```
