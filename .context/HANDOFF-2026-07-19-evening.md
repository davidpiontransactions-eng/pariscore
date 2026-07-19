# Handoff — 2026-07-19 soir (23:25) — Orchestration multi-agents Session 9

## TL;DR

1. **12 commits poussés sur `origin/main`** (`66437e2`..`ce26a61`)
2. **2 deploys VPS** : `bc2805f` (commits + nginx) puis `ce26a61` (fix hot loop)
3. **Hot loop CPU 100% résolu à la racine** : cache `globalThis` partagé multi-worker
4. **6/8 alertes résolues** ; 2 en attente (simu tennis-live + 404 elo-history)
5. **Prod stable et optimisée** : CPU 0%, endpoints 200, steady state confirmé

---

## Ce qui a été fait aujourd'hui (16:00 → 23:25)

### Orchestration multi-agents (12 agents détachés, 10 terminés)

| Agent | Mission | Statut | Livrable |
|---|---|---|---|
| Direct (moi) | Vérif VPS + root cause hot loop | ✅ | Source-side fix `ce26a61` |
| `04b0ad83` | Sécurité synthetic cards | ✅ | 0 vuln bloquante, 1 🔴 deception |
| `4253382b` | Audit 3 processes VPS | ✅ | tennis-live = simu, pariscore-next 100% CPU |
| `b1f9fb60` | Commits atomiques (6) | ✅ | `ed7e6ad`..`f5eeb9c` |
| `b28baee8` | Code review SPS | ✅ | 4 bugs bloquants identifiés |
| `d57ac9cc` | Fix synthetic badge | ✅ | `616c502` |
| `61a814c1` | Fix tools SPS P0-2/P0-3 | ✅ | `af487e1` |
| `587b2d94` | Fix frontend SPS P0-1/P0-4 | ✅ | `bacc68d` |
| `594fa28b` | Audit visuel Playwright | ✅ | Prod OK + bug 404 elo-history découvert |
| `cbc0fb8d` 🚨 | Diagnostic CPU | ⏹ stoppé | Root cause trouvée source-side par moi-même |
| `8f103161` | Plan remplacement simu | 🟡 running | — |
| `d3e4e50d` | Fix 404 elo-history | 🟡 running | Pas encore commit à 23:25 |

### Commits (12 poussés, ordre chronologique)

```
ce26a61 fix(api): make route caches multi-worker safe via globalThis  ← HOT LOOP TUÉ
65adc9f docs: deploy bc2805f recap + nginx patch football/nba/wnba
bc2805f docs: session 9 orchestration recap (GANTT + todo + screenshots)
bacc68d fix(tennis): exclude synthetic from rank/elo sort + add experimental badge to SPS
af487e1 fix(tools): use real circuit in WTA sync + apply norm() to rank matching
616c502 fix(tennis): add disclaimer badge for synthetic live cards (deception perçue)
f5eeb9c chore: track qa-node-check.js (narrow qa-*.js gitignore to root only)
958111c chore: update graphify opencode plugin
e3bc13e chore: add opencode config
b1c17f2 chore: document free providers env keys in .env.example
ec8648a docs: add free providers API map (TheRundown/PropLine/Cloudbet + 8 wiki-entities)
ed7e6ad chore: add bun path resolver for cross-platform npm scripts
```

---

## 🎯 Découverte majeure — Root cause hot loop CPU 100%

**Symptôme** : `pariscore-next` (PM2 id 2) tournait à **100% CPU en continu**.
Logs : **70× `[bsd] Fetched 30 matches`** dans les 100 dernières lignes.

**Source** (trouvée par grep dans `src/`, pas par l'agent VPS) :
- `bsd-fetcher.ts:319` log après chaque `fetchBSDMatches()` (route prematch)
- Route `prematch/route.ts` : `let cache = null` au niveau module + `CACHE_TTL = 5min`
- Client hook `use-prematch-matches.ts` : `refreshInterval: 60s` via SWR
- **Bug** : en prod standalone Next.js, **chaque worker a sa propre variable `cache`**
  (non partagée). Avec 5+ workers × poll client 60s = dizaines de fetch BSD / min.

**Fix** (`ce26a61`) :
- Nouveau helper `src/lib/cached-route.ts` : `createTtlCache(globalKey)` + `isFresh()`
- Persiste sur `globalThis` (partagé entre workers, survit au hot-reload)
- **7 routes migrées** : `tennis/{prematch,live}`, `football/{matches,live}`,
  `cs2/matches`, `cycling`, `f1`

**Validation prod** :
```
Avant : 70× [bsd] Fetched dans 100 lignes de log, CPU 100% saturation
Après  : pm2 flush + 90s sans charge = 1 seul fetch (vs 38 avant fix)
        CPU stable 0%, 0 unstable restart
```

---

## 🟡 Ce qui reste à faire demain (J+1)

### Priorité 1 — Push fix elo-history (`d3e4e50d` en cours)

```bash
# Quand l'agent aura commit :
git pull origin main  # récupère le commit du fix
# Vérifier puis deploy :
ssh -i $USERPROFILE/.ssh/id_rsa_pariscore ubuntu@51.75.21.239 \
  'export PATH="/home/ubuntu/.bun/bin:$PATH"; cd ~/pariscore && git pull && bun run build && pm2 restart pariscore-next'
```

**Bug** : `/api/tennis/elo-history?matchId=bsd-XXXXX` retourne 404 × 76 par
chargement de page tennis. Root cause : route cherche seulement dans le tableau
statique `MATCHES`, pas les IDs BSD live. → 57 cartes × 1 fetch = 57 erreurs/page.

### Priorité 2 — Décision simu tennis-live (`8f103161` en cours)

Agent prépare un plan comparatif pour remplacer la simulation `Math.random()`
du mini-service `tennis-live` (port 3001) par du vrai polling BSD.

**Options en évaluation** :
- A. Garder socket.io, remplacer `Math.random` par fetch `/api/tennis/live` (effort faible)
- B. Supprimer `tennis-live`, switch frontend SSE direct (effort moyen)
- C. Hybride : fallback simu SEULEMENT si BSD vide/erreur + disclaimer

**Décision produit** : scope = "tout corriger" — enclencher après réception du plan.

### Backlog reporté

- [ ] **Déprécier `pariscore` legacy (id 5)** : monolithe `server.js` 52 435 lignes
      en doublon avec pariscore-next. `max_memory_restart: 2G` override manuel.
- [ ] **Backtest Brier SPS** à publier dans la doc avant mise en avant produit
      (règle `pas de prod sans IC`).
- [ ] **Tests unitaires** `sps-utils.ts` (8 fonctions pures, 0 test).
- [ ] **Fix `npm run lint` OOM** sur `.venv-langflow/.../assets/index-CUSa5eDp.js`.
- [ ] **Pérenniser tests Playwright** dans `tests/` (scripts temporaires supprimés).
- [ ] **`/api/cs2/matches` 404** : pas dans nginx config (à ajouter si CS2 actif).

---

## État git / VPS au moment du handoff

### Local
```
branch: main
origin/main: ce26a61  (cache multi-worker safe)
working tree: propre
```

### VPS (`ubuntu@51.75.21.239`)
- HEAD `ce26a61` déployé
- PM2 `pariscore-next` online, CPU 0% stable, 27 restarts cumulés
- nginx patché : 3 règles `/api/{football,nba,wnba}/` → :3005
- Backup nginx : `/home/ubuntu/nginx-backups/pariscore.bak-20260719-223957`

### Endpoints prod (tous 200 sauf cs2 préexistant)
```
/api/f1                  → 200
/api/football/matches    → 200 (World Cup 2026, NWSL réels)
/api/football/live       → 200
/api/football/prematch   → 200
/api/nba/matches         → 200
/api/wnba/matches        → 200
/api/tennis/prematch     → 200
/api/tennis/live         → 200 (Lorenzo Claverie vs Bruno Kuzuhara)
/api/cycling             → 200
/api/cs2/matches         → 404 (préexistant — pas dans nginx config)
```

---

## Fichiers clés session

| Fichier | Rôle |
|---|---|
| `src/lib/cached-route.ts` | Helper cache multi-worker (NEW) |
| `src/app/api/tennis/{prematch,live}/route.ts` | Migrés vers `globalThis` |
| `src/app/api/football/{matches,live}/route.ts` | Migrés vers `globalThis` |
| `src/app/api/{cs2/matches,cycling,f1}/route.ts` | Migrés vers `globalThis` |
| `src/components/football/tennis-tab-content.tsx` | Badge synthetic |
| `src/components/tennis/match-card.tsx` | Masquage composants prédictifs si synthetic |
| `src/components/tennis/player-statline.tsx` | Badge « beta » SPS |
| `src/hooks/use-match-filter.ts` | Exclusion synthetic du tri rank/elo |
| `src/lib/bsd-fetcher.ts:319` | Source du log hot loop `[bsd] Fetched` |
| (VPS) `~/pariscore/mini-services/tennis-live/index.ts` | Simu socket.io port 3001 |

## Graphify

Mis à jour à 23:00 (avant deploy `ce26a61`). Pour rafraîchir après fixes demain :

```bash
"/c/Users/David/AppData/Roaming/Python/Python312/Scripts/graphify.exe" update .
```

---

*Handoff écrit 2026-07-19 23:25. Session 9 — 12 commits, 2 deploys, hot loop résolu.*
