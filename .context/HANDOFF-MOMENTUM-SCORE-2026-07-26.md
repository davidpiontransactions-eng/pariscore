# Handoff — Session "Momentum Score" (2026-07-26)

> **Reprise demain** : lire ce fichier en premier, puis la section "À faire".
> Le plan Momentum Score a été **approuvé puis annulé (fin de session)** — tout
> est prêt pour implémenter sans repartir de zéro.

---

## Contexte — ce qui a été livré cette session

7 features déployées en production (`https://pariscore.fr`), toutes sur `main` :

| Commit | Feature |
|---|---|
| `91bb185` | Fix merge cache intelligent + calibration papier Lei 2024 (Δ=0.72, TB=1.25, α serveur) |
| `5c808b5` | Most Aces — comparaison A vs B + Over/Under total (Poisson-Skellam) |
| `2608a47` | Fix build : import circulaire node:fs client→serveur |
| `c68c8c5` | 3 paris prédictifs Over/Under Games (18.5/19.5/21.5, Barnett-Clarke + Poisson) |
| `85d2111` | Fix doublon score live (set en cours affiché 2 fois) |
| (précédents) | DR Moyen (5M), browser-act skill installé |

**Toutes validées en prod** via `https://pariscore.fr/api/tennis/prematch`.

---

## Infrastructure clé (à connaître pour reprendre)

### Cache DR — `src/lib/tennis-dr/dr-cache.json`
- Peuplé par cron PM2 `pariscore-cron-dr` (04:00 UTC quotidien).
- **IMPORTANT** : le runtime lit `.next/standalone/src/lib/tennis-dr/dr-cache.json` (pas `src/`).
  Le cron sync les deux (`scripts/cron-tennis-dr.sh` ligne ~40).
- Format actuel : `{ players: { <key>: { name, all, Hard, Clay, Grass, serveStats: { all, Hard, Clay, Grass: { servePtsWonPct, acesPct, dfPct, n } } } } }`
- 400 joueurs (top 200 ATP + 200 WTA), 203 ont `acesPct Hard`.
- Le scraper exige `LEGAL_OVERRIDE_CONFIRMED=1` (robots.txt disallow `/jsfrags/`).

### Pipeline de prédiction — `src/lib/prediction/`
- `engine.ts` — match-winner (Elo+Forme+Surface+H2H), existe depuis avant.
- `total-games.ts` — Over/Under games (Barnett-Clarke + Poisson), calibration validée.
- `most-aces.ts` — Most Aces (Poisson-Skellam + Bessel `I_k`), validé numériquement.

### Hooks / composants Tennis
- `use-momentum-dr.ts` — EWMA momentum live (decay **0.72** depuis Lei 2024, était 0.88).
- `predictive-bets.tsx` — composant client, recoit `serveStatsA/B` en props (PAS d'import node:fs).
- `most-aces-compare.tsx` — idem pattern.
- Cartes : `match-card.tsx` (prematch) + `match-card-broadcast.tsx` (live), les deux insèrent PredictiveBets + MostAcesCompare.

### VPS prod
- `ubuntu@51.75.21.239`, repo à `~/pariscore`.
- Build wrapper : `/tmp/dr_run_build.sh` (PATH bun explicite, copie dr-cache → standalone).
- PM2 : `pariscore-next` (Next.js standalone, port 3005) + `pariscore` (legacy server.js, port 3000).
- Cron DR : `pariscore-cron-dr` (id 17), 04:00 UTC, persisté (`pm2 save`).

---

## À FAIRE — Momentum Score (plan approuvé, pas encore codé)

**Plan approuvé** via `ExitPlanMode` puis **annulé** (l'utilisateur a dit "on continue demain").

### Décisions prises (confirmées avec l'utilisateur)
- **Portée** : score par joueur 0-100, visible prematch + live.
- **Poids** : EWM calibré sur top-100 (fidèle au papier Lei 2024).

### Méthode EWM (Entropy Weight Method, équations 4-6 du papier)
```
Pour chaque feature j (sur n joueurs de référence) :
  1. Normalisation : x'_ij = (x_ij − min_j) / (max_j − min_j)        ∈ [0,1]
  2. Proportion    : p_ij = x'_ij / Σ_i x'_ij
  3. Entropie      : E_j = −k · Σ_i p_ij · ln(p_ij),   k = 1/ln(n)
  4. Poids         : w_j = (1 − E_j) / Σ_j (1 − E_j)   ∈ [0,1], Σw_j = 1
```
Intuition : feature discriminante (varie beaucoup entre joueurs) → poids élevé.

### Les 5 signaux à agréger (par joueur)
1. **DR Moyen (5M)** — cache DR — 0.8..1.8 (1.0 = neutre)
2. **λ aces attendus** — most-aces.ts — 0..15
3. **servePtsWonPct** — cache DR — 0.55..0.78
4. **form récente** — player.form — 0..1
5. **momentum live EWMA** — useMomentumDR — 0..100 (null en prematch)

### Fichiers à créer
1. `src/lib/prediction/ewm-calibration.ts` — algorithme EWM + `calibrateFromCache()`.
2. `src/lib/prediction/momentum-score.ts` — normalisation + `computeMomentumScore()`.
3. `src/components/tennis/momentum-score.tsx` — composant anneau SVG 60×60.

### Fichiers à éditer
1. `scripts/scrape-tennis-dr.ts` — appeler `calibrateFromCache` après scrape, écrire `ewm-weights.json`.
2. `src/lib/tennis-data.ts` — `Player.momentumScore?` + `TennisMatch.momentumScoreA/B?`.
3. `src/lib/bsd-fetcher.ts` — construire `PlayerSignals` + calculer scores dans `buildMatch`.
4. `src/components/tennis/match-card.tsx` + `match-card-broadcast.tsx` — insertion `<MomentumScore>`.
5. i18n `fr.json` + `en.json` — namespace `momentumScore`.

### Poids fallback DEFAULT_EWM_WEIGHTS (si ewm-weights.json absent)
```ts
{ dr: 0.25, aces: 0.20, servePts: 0.20, form: 0.20, momentum: 0.15 }
```

### Bornes de normalisation (min-max empiriques ATP)
- DR Moyen : `(dr − 0.8) / (1.8 − 0.8)`
- λ aces : `λ / 15`
- servePtsWonPct : `(pct − 0.55) / (0.78 − 0.55)`
- form : déjà [0,1]
- momentum live : `/ 100`

### Risques identifiés
- EWM instable si peu de joueurs couverture → filtrer top-100 par Elo depuis `tennis-elo/abstract-cache.json` ; si <30 → fallback DEFAULT.
- Normalisation sensible aux outliers (Isner 18% aces) → bornes plafonnées (max 15λ, DR max 1.8).
- Saut prematch→live (momentum live s'active) → lissage : signal #5 = moyenne pondérée form + EWMA.

---

## Commandes utiles pour reprendre

```bash
# État local
git log --oneline -7
git status --short | grep -vE "\.opencode|pariscore-design-fix"

# Vérif cache DR VPS (acesPct présent ?)
ssh ubuntu@51.75.21.239 'python3 -c "import json; d=json.load(open(\"/home/ubuntu/pariscore/src/lib/tennis-dr/dr-cache.json\")); p=d[\"players\"]; sinner=p.get(\"jannik_sinner\",{}).get(\"serveStats\",{}).get(\"Hard\",{}); print(\"Sinner Hard:\", sinner)"'

# API prod (Most Aces différenciés ?)
curl -s "https://pariscore.fr/api/tennis/prematch?limit=5" | python3 -c "import json,sys; d=json.load(sys.stdin); [print(m[\"playerA\"][\"name\"][:14],\"vs\",m[\"playerB\"][\"name\"][:14],\"λA=\"+str(m.get(\"mostAcesPredictions\",{}).get(\"lambdaA\")),\"λB=\"+str(m.get(\"mostAcesPredictions\",{}).get(\"lambdaB\"))) for m in d.get(\"matches\",[])[:5]]"

# Build VPS (wrapper existant)
ssh ubuntu@51.75.21.239 'setsid bash /tmp/dr_run_build.sh > /tmp/dr_build.log 2>&1 < /dev/null &'

# Restart pariscore-next
ssh ubuntu@51.75.21.239 'pm2 restart pariscore-next --update-env'

# Re-scrape DR complet (avec merge intelligent)
ssh ubuntu@51.75.21.239 'cd ~/pariscore && setsid bash -c "export PATH=\$HOME/.bun/bin:\$PATH && LEGAL_OVERRIDE_CONFIRMED=1 bun run scripts/cron-tennis-dr.sh > /tmp/dr_scrape.log 2>&1" < /dev/null > /dev/null 2>&1 &'
```

---

## Sources académiques (pour reprendre la calibration)
- [Lei, Lin, Cao — Rhythms of Victory, IEEE Access 2024](https://www.researchgate.net/publication/383161788) — méthode EWM + poids empiriques (Technique 0.485, Scoring 0.403, Mistake 0.112).
- [Barnett & Clarke 2005](https://www.researchgate.net/publication/228614352) — combining serve/return stats.
- [Bevc 2015 (thèse Glasgow)](https://www.dcs.gla.ac.uk/~srogers/files/projects/MSci_project_1006404b.pdf) — chaîne Markov point→game.

---

## Vérifications de fin de session (toutes ✅)
- Dernier commit : `91bb185` (pushé sur origin/main).
- Aucun fichier non commité de mon fait (uniquement `dr-cache.json` peuplé par le re-scrape VPS, attendu).
- API prod : Most Aces différenciés (Borna Gojo λA=10 vs Mayo λB=4, P(A>)=93%).
- Cache VPS : 400 joueurs, 203 avec acesPct Hard, Sinner aces=15.55% (all).
- Build VPS : `✓ Compiled successfully in 22.0s`, pariscore-next online.

---

*Dernière maj : 2026-07-26, session terminée proprement (tout commité, rien en cours).*
