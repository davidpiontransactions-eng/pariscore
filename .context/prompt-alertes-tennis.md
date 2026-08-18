# PROMPT — Chef de projet : Alertes Tennis temps réel (son + visuel)

## Ton rôle
Tu es **chef de projet + architecte**. Tu ne codes pas tout seul : tu décomposes le chantier, tu **orchestres des agents et skills**, tu établis un **Gantt** (phases, dépendances, jalons), tu le **pilotes** (suivi, déblocage, arbitrages), et tu livres en production via **`deploy.bat`**.

## Contexte projet
- Repo `pariscore` : Next.js 16 + Bun + legacy vanilla JS (`pariscore.js` front, `server.js` monolithe ES5).
- `server.js` calcule déjà par match tennis live (poll 30s, `pollTennisLive`) : `dr_exact`, `liveProbability` (Markov), `serve_momentum`, `bppi` (Break Point Pressure Index), `set_ou` (o75/o85/u125), variance DR inter-sets.
- Alertes Discord existantes (pattern à réutiliser) : `broadcastTennisLiveAlert()`, cooldown `_tnAlertOnCooldown(key, 5*60*1000)` + `_tnAlertMark(key)`, seuils env `TENNIS_DR_DIFF_THRESHOLD` (0.20), `TENNIS_DR_VAR_THRESHOLD` (0.08).
- SSE existant : `broadcastSSE('bppi_spike', …)` ; client `EventSource` sur `/api/v1/live` et `/api/v1/tennis/rg-live-stream`.
- Client : onglet « Alertes » (id `alertes`), scaffold push `cfEnablePushNotifications()`.
- **Aucun son ni alerte visuelle n'existe côté client — c'est l'objet du chantier.**

## Objectif
Quand une carte match tennis live franchit une borne, le site affiche une **alerte écrite** (highlight carte + toast) et joue un **son tennis**, pour aider à décider de prendre ou non un pari.

## Métriques et bornes (validées — ne pas modifier)
| # | Métrique | Source | ⚠️ jaune | 🔴 rouge |
|---|----------|--------|---------|---------|
| 1 | Écart DR (domination) | `dr_exact.dr` | \|DR−1\| ≥ 0.20 | ≥ 0.35 |
| 2 | Variance DR/set | variance inter-sets | ≥ 0.08 | ≥ 0.15 |
| 3 | Spike BPPI (pression break) | `bppi` | Δ ≥ 15 pts | Δ ≥ 25 pts |
| 4 | Serve momentum gap | `serve_momentum` | écart ≥ 25 pts | ≥ 40 pts |
| 5 | Bascule proba live | `liveProbability` | Δ ≥ 0.10 | Δ ≥ 0.20 |
| 6 | Set Overs | `set_ou.o85` | ≥ 0.70 | ≥ 0.85 |

Règles : cooldown 5 min par (match × métrique) via `_tnAlertOnCooldown`/`_tnAlertMark` ; métrique 2 re-fire à chaque nouveau set complet ; métrique 5 = variation entre deux polls consécutifs.

## Comportement sonore (décision validée : rebond de balle de tennis)
Sons synthétisés **Web Audio API** — un « poc » de balle frappée par la raquette (oscillateur court + filtre, ~120ms, pas d'asset externe) :
- ⚠️ jaune : **1 poc** (volume modéré)
- 🔴 rouge : **2 pocs** (volume fort)
- 🔴 critique (rouge sur métrique 1 ou 3) : **3 pocs** (fort, tempo rapide)
Toggle global « Sons ON/OFF » persistant en localStorage, **défaut OFF** ; badge « son coupé » sur l'onglet Alertes.

## Alerte écrite
- **Highlight carte** : bordure jaune/rouge + badge de la métrique déclenchée sur la carte du match dans la vue tennis live.
- **Toast** haut de page : « 🎾 Djokovic vs Alcaraz — Écart DR 0.41 🔴 → parier sur le dominant », bouton « Voir le match » qui ouvre la carte.
- **Notification desktop** : optionnelle via `cfEnablePushNotifications` si permission accordée.

## Architecture cible
1. **Serveur** (`server.js`) : évaluateur d'alertes dans `pollTennisLive` (après les calculs DR/momentum/BPPI) émettant `broadcastSSE('tennis_alert', {id, metric, level, match, value, msg})` — cooldown par clé, seuils via `process.env.TENNIS_*_THRESHOLD` (pattern existant, défauts = bornes ci-dessus).
2. **Client** (`pariscore.js`) : handler SSE `tennis_alert` → pile de toasts + highlight carte + module son (3 intensités) + notification desktop optionnelle.

## Gantt (à établir et à piloter — tu es responsable de son suivi)
1. **Sprint 0 — Exploration** : services SSE, carte tennis live, points d'insertion ; tickets bd créés ; spec d'implémentation.
2. **Serveur** : évaluateur + SSE `tennis_alert` (validation curl).
3. **Client** : handler SSE, toasts, highlight, module son Web Audio, toggle, notification desktop.
4. **QA** : `node --check` sur tous les fichiers modifiés, test Playwright smoke (bornes forcées basses en dev), revue par agent code-reviewer.
5. **Deploy** : `deploy.bat "Alertes tennis : son + visuel (DR, BPPI, momentum, proba, overs)"` puis vérif `/api/v1/status` + smoke prod.

## Règles d'orchestration
- Délègue : exploration → agent explore ; tests → test-engineer ; revue → code-reviewer. Parallélise ce qui est indépendant.
- Skills : `ps-changelog` (après livraison), `ps-test` (QA module), `ps-deploy` (checklist déploiement).
- Suivi de tâches : **bd (beads)** — `bd prime`, tickets créés dès le Sprint 0, `bd update <id> --claim`, `bd close` quand terminé.
- Communication : annonce une fois, agis silencieusement, résume à la fin (`.opencode/instructions/communication.md`).

## Règles du repo (non négociables)
- **Shell : CMD uniquement** (le tool bash gèle sous Windows — jamais de syntaxe bash).
- Code legacy ES5, commentaires français, camelCase ; `_jsStr()` pour toute interpolation onclick (XSS).
- Pas de commit sans demande explicite ; déploiement via `deploy.bat` uniquement.

## Livrables
1. Gantt piloté (phases, jalons, statut).
2. Code serveur + client fonctionnel.
3. QA documentée.
4. Déploiement prod via `deploy.bat` + vérification post-deploy.
5. `bd close` des tickets + résumé final (fichiers modifiés, validation, prochaines étapes).