# Session: Tennis Live Stats — latence & réactivité (2026-08-05)

## Scope
Réduire la latence entre réception des données et rendu visuel de la carte Tennis
Live (`MatchCardBroadcast`), et rendre les stats live réellement fonctionnelles.

## Problème diagnostiqué
1. **Stats jamais affichées (bug racine)** : `useTennisLiveStats` écoutait `live_patch`
   sur un socket.io dédié (`io("/?XTransformPort=3001")` → `mini-services/tennis-live`,
   Bun :3001). Ce mini-service n'émet que `initial_state`/`match_update` (~5s), SANS
   stats → le hook retombait sur le fallback DEMO après 3 échecs (~10s) ou restait en
   loading. Latence perçue = stats absentes/demo.
2. **Stats jetées à la source** : `fetchBSDLiveMatches()` (bsd-fetcher.ts) droppait
   `p1_aces`, `p2_aces`, `p1_double_faults`, `p2_double_faults`, `p1_first_serve_pct`,
   `p2_first_serve_pct`, `p1_first_serve_won_pct`, `p2_first_serve_won_pct`,
   `p1_break_points_saved_pct`, `p2_break_points_saved_pct` alors que
   `BSDLiveMatch` (bsd-tennis-service.ts:94) les contient déjà.
3. **Re-renders en cascade** : chaque push (snapshot < 1s, broker 5s) reconstruisait
   TOUS les `LiveMatchState` + items de liste → toute la grille re-rendait, chaque
   carte re-computant `useMomentumDR` (y compris `drHistory` O(WINDOW_SIZE²)=O(24²)).
4. `live_patch` n'existe nulle part dans `src/` ni `server.js` (seulement legacy
   `vps/pariscore.js` + docs) — le canal stats était câblé sur un événement fantôme.

## Correctifs appliqués
- `src/lib/bsd-fetcher.ts` : `LiveMatchItem.live_stats` (nullable) + mapping des 10
  champs stats depuis BSD (null si aucun). Le payload voyage maintenant jusqu'au client.
- `src/lib/live-broker.ts` : `hashSnapshot` inclut `statsSig()` → un changement de
  stats pousse le snapshot même si le score n'a pas bougé.
- `src/lib/live-stream-client.ts` (NOUVEAU) : EventSource unique ref-counté.
  `subscribeLiveStream(listener, onStatus?)` ; 1er subscriber ouvre, dernier ferme.
  Payloads typés `{kind:"snapshot", matches, at}` / `{kind:"update", matches}`.
- `src/hooks/use-live-stream.ts` : abonné au client partagé + états IDENTITY-STABLE
  (signature par match → réutilisation de l'objet `LiveMatchState` si rien n'a bougé ;
  les stats ne font PAS partie de la signature pour ne pas re-render les cartes).
- `src/hooks/use-tennis-live-stats.ts` : socket.io REMPLACÉ par `subscribeLiveStream` —
  les stats arrivent < 1s via le même flux que le score. Demo conservée en fallback :
  3 pushes sans données (ou timeout 6s), jamais avant une vraie donnée.
- `src/components/tennis/match-card-broadcast.tsx` : export `memo(...)`.
- `src/components/football/tennis-tab-content.tsx` : `MemoMatchCardBroadcastItem = memo(MatchCardBroadcastItem)`.
- `src/hooks/use-momentum-dr.ts` : cache du résultat par identité de `liveState`
  (`cachedLiveRef`/`cachedResultRef` + `cacheAndReturn`) → un re-render interne
  (resolve playerStats, toggle Collapsible…) ne re-fait plus le calcul momentum.

## Contraintes / notes
- Unix stack : CMD obligatoire (jamais Bash ; cf. AGENTS.md). Tools shell : `oc_bash`.
- `SCRIPTS` validés : `bun run typecheck` ✅, eslint sur fichiers modifiés ✅.
- `ret_won` / `total_pts` non exposés par le endpoint BSD live → `--` dans l'UI
  (STAT_ROWS) : chose assumée (honnêteté plutôt que démo).
- mini-services/tennis-live (Bun :3001) RESTE pour le score/probas dans son propre
  contexte, mais plus utilisé pour les stats de `src/`. socket.io-client encore dans
  package.json (utilisé par le mini-service) — pas retiré du lockfile.
- TODO non traité : audit re-renders du polling fallback (`use-live-matches`, 8s) —
  pas de memo/identity là-bas (fallback only).

## URLs / référence
- BSD live : `https://www.soccerstats.com/…` non concerné. Endpoint BSD : `GET /api/v2/matches/live/` (via bsd-tennis-service).
- Routes : `GET /api/tennis/live` (REST, TTL 8s), `GET /api/tennis/live-stream` (SSE snapshot/update, heartbeat 25s, broker 5s).