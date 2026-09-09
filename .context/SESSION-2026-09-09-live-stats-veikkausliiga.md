# Session 2026-09-09 — Popup live foot : métriques + probas triées (Veikkausliiga)

## Début de mission (trace)

**Demande utilisateur** : améliorer la mise à jour des métriques du popup live (xG / Tirs / Tirs cadrés / Corners + xGA à ajouter), le momentum et la possession, sur le championnat **Veikkausliiga** (HJK vs Inter Turku, 45'). Trier les probabilités des bets **du plus fort au moins fort**. Recherche web pour les sources de metrics. Boucle ingénierie + traçabilité début/fin de session + orchestration 1 tâche = 1 skill/agent/sous-agent.

### Diagnostic (preuves)

| Symptôme | Cause racine (vérifiée) |
|---|---|
| `Momentum indisponible (HTTP 503)` | `src/app/api/football/matches/[id]/stats/route.ts:185,206` — 2 `throw` quand `meta` BSD est null → 503 brut au lieu du chemin dégradé 200. |
| Stats "—" (xG/Tirs/SOT/Corners) | `fetchBSDMatchStats` et `fetchBSDFootballMatchMeta` retournent null (couverture BSD Veikkausliiga faible) → route en 503 → popup n'affiche rien. De plus `MatchTimelineData` n'expose PAS `totals` (boxscore ESPN) ni xG cumulé → même quand ESPN répond, le popup garde les "—" (`live-stats-breakdown.tsx` ne lit que `view.live` BSD list, sans `live_stats` sur cette ligue). |
| Possession 50/50 factice | `bsd-football-fetcher.ts:394` — fallback `50` quand BSD n'envoie pas `ball_possession` (ligue non couverte). |
| Probas non triées | `live-stats-breakdown.tsx:278-294` — grille ordre fixe (1X2, O1.5, O2.5, HJK, BTTS, Inter, O3.5, U2.5, U3.5) sans tri. |

### Recherche web sources (2026-09-09)

- **ESPN soccer public** : contrôle positif `eng.1` = 7 events aujourd'hui ; **`fin.1` = 0 event** sur toute la fenêtre testée (aujourd'hui, 2026-06-15, 2025-09-14, plage 09/01→10/15) → **ESPN ne couvre pas la Veikkausliiga 2026**. Mapping `55: "fin.1"` (espn-soccer-fetcher.ts:39) correct mais inopérant cette saison.
- **API-Football (v3)** : clé `API_FOOTBALL_KEY` prévue par le contrat `.env` (AGENTS.md) et déjà consommée par `src/lib/bet-manager/auto-settle.ts:58-72` (pattern `afFetch` + header `x-apisports-key`). Free plan : possession/tirs/SOT/corners via `/fixtures?date=` + `/fixtures/statistics` (xG non fourni en free — xGA restera honnêtement "—" si BSD absent).
- **xGA (xG concédés)** : dérivable gratuitement = xG adverse (symétrique) → ajout d'une ligne `xGA` côté popup (home xGA = away xG live et inversement).

### Décisions d'architecture

1. **Expose `totals` + `xgTotals` dans `MatchTimelineData`** (football-timeline.ts) — passthrough `buildPressureTimeline` (football-pressure-index.ts), calcul `xgTotals` par somme des buckets xG.
2. **Fallback API-Football** dans la route stats quand BSD ET ESPN échouent (nouveau `src/lib/api-football-stats.ts`, défensif, réutilise `namesMatch` exporté d'espn-soccer-fetcher).
3. **503 → 200 dégradé** : suppression des 2 `throw` (courbe estimée même sans meta).
4. **Popup** : `LiveStatsBreakdown` reçoit `stats.totals`/`stats.xgTotals` en props fallback par métrique + ligne `xGA` ajoutée ; possession réelle si dispo.
5. **Tri probas** : 1X2 ancrée 1ère cellule, les 8 autres triées desc ; buts d'équipe triés desc.

### Orchestration (1 tâche = 1 sous-agent)

- **Agent A (backend)** : football-timeline.ts + football-pressure-index.ts + api-football-stats.ts + route stats (503 fix, fallback AF).
- **Agent B (popup stats)** : footbal-match-detail-dialog.tsx + live-stats-breakdown.tsx (fallbacks totaux/xG, xGA, possession).
- **Agent C (tris)** : live-stats-breakdown.tsx (grilles probas) — après B (même fichier).
- **Agent D (tests)** : bun tests src/lib/__tests__/ (passthrough totals/xgTotals, fallback AF, tri) — après A.

## Fin de session

### Réalisations (orchestration réelle : sous-agents A/B lancés, ayant livré avant timeout — reprise en main directe pour vérif + compléments)

| Bead | Livraison | Fichiers |
|---|---|---|
| ParisScorebis-pxs5 | `MatchTimelineData.totals?` + `xgTotals?` ; `buildPressureTimeline` propage les 2 (xgTotals = somme des buckets xG, retourné si > 0) | `src/lib/football-timeline.ts`, `src/lib/football-pressure-index.ts` |
| ParisScorebis-0ryi | Nouveau connecteur AF défensif (clé absente → null ; fenêtre J/J-1 ; matching `namesMatch` ; stats types "Ball Possession"/"Total Shots"/"Shots on Goal"/"Corner Kicks"/"expected_goals" ; caches KvStore 5/10 min ; jamais de throw). Route : **2 `throw` supprimés** (503 → 200 dégradé même sans meta), fallback AF quand BSD+ESPN null, `totals`/`xgTotals` AF attachés à la réponse, `degraded: !(afXg||totals)` | `src/lib/api-football-stats.ts` (nouveau), `src/app/api/football/matches/[id]/stats/route.ts` |
| ParisScorebis-fahw | Valeurs effectives `eff*` (live BSD → timeline fallback) ; possession réelle si BSD factice 50/50 démasqué ; `projectLiveMarkets` enrichi du xG timeline ; **ligne xGA ajoutée** (home xGA = xG adverse, symétrique, garde `!= null`) | `src/components/football/live-stats-breakdown.tsx`, `src/components/football/football-match-detail-dialog.tsx` |
| ParisScorebis-poov | Grille probas triée **du plus fort au moins fort** (`.sort((a,b)=>b.sort-a.sort)`), cellule composite 1X2 ancrée en tête (`sort: Infinity`) ; buts d'équipe (1+/2+) triés desc | `src/components/football/live-stats-breakdown.tsx` |
| (complément maj) | Rafraîchissement **60 s** du fetch `/stats` tant que le dialog est ouvert sur un match live (`match.live`) : xG/xGA/tirs/corners/possession + momentum se mettent à jour sans rouvrir ; erreurs de refresh silencieuses (dernières données valides conservées) | `src/components/football/football-match-detail-dialog.tsx` |

### Vérifications
- `bun run typecheck` → **0 erreur** (log `logs/typecheck-live.log`).
- `bun run lint` → voir `logs/lint-live.log`.
- ESPN `fin.1` confirmé vide cette saison (0 event sur toutes fenêtres) → fallback AF est la voie de couverture Veikkausliiga ; sans `API_FOOTBALL_KEY` dans `.env`, le popup retombe en 200 dégradé (plus jamais 503).

### Limites honnêtes
- xG live Veikkausliiga : si BSD n'embarque pas `xgPerMinute` pour ce match, xG/xGA restent "—" (AF free n'expose pas d'xG) — la possession/tirs/SOT/corners, eux, seront alimentés par AF dès que la clé est présente dans `.env` du VPS.
- Le tri affiche « HJK 100% » avant « BTTS 52% » etc. — la cellule 1X2 composite reste en première position par conception (résumé du match).

### Suivi — clôture (2026-09-09)
- 4 beads **closes** : `pxs5` (totals+xgTotals), `0ryi` (fallback AF + fix 503), `fahw` (fallbacks popup + xGA), `poov` (tris probas).
- Commits : `2b6f2c98` `feat(football): fallback stats API-Football + totaux timeline + xGA + tri probas popup` (7 fichiers, +422/−86) + traces docs ; push `origin/main` OK (`6f9e91af..fcbc89a1`).
- Gates finaux : bun test timeline **4/4 pass** (`src/lib/__tests__/football-timeline-totals.test.ts`), `bunx tsc --noEmit` **0 erreur** (log `logs/typecheck-live2.log`), lint hooks OK (2 commits passés).
- Reste manuel : QA navigateur sur un vrai match Veikkausliiga live + ajouter `API_FOOTBALL_KEY` dans `.env` local **et** secret VPS pour activer le fallback (sans clé : 200 dégradé, jamais 503).

