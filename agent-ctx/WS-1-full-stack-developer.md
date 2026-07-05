# WS-1 — full-stack-developer

## Task
Build WebSocket live tennis updates mini-service + client hook + UI integration.

## Status: DONE

## Artifacts
- `mini-services/tennis-live/package.json` — independent Bun project (socket.io dep)
- `mini-services/tennis-live/index.ts` — socket.io server, port 3001 (HARDCODED), path `/`, simulation loop (5s tick), `initial_state` / `match_update` / `subscribe_match` / `ping`/`pong` events
- `src/hooks/use-live-matches.ts` — SSR-safe client hook, `io('/?XTransformPort=3001')`, returns `{ liveStates, connectionStatus, latency }`, all setState in event callbacks (react-hooks/set-state-in-effect compliant)
- `src/components/tennis/probability-ring.tsx` — modified: `fromRef` tracks current progress so live updates interpolate smoothly (was: always from 0)
- `src/components/tennis/match-card.tsx` — modified: `liveState?` + `disconnected?` props, LIVE badge (red pulse), LiveScoreBar component ("6-4, 3-2 · 30-15 · Sinner au service"), live probs override static, offline footer indicator
- `src/app/page.tsx` — modified: `useLiveMatches()` integration, ConnectionStatusIndicator in header (green/amber/red)

## Mini-service running
- PID 5065, port 3001, started via `cd mini-services/tennis-live && bun run dev`
- Restart: `cd /home/z/my-project/mini-services/tennis-live && bun run dev`

## Lint: 0 errors

## Critical integration notes for main agent
1. Mini-service MUST be running for live updates. UI degrades gracefully when down (red "Hors ligne" indicator, static prematch data).
2. Gateway URL is STRICTLY `io('/?XTransformPort=3001')` with path `/`. NEVER `localhost:3001`.
3. Mini-service auto-restarts matches after they finish (best-of-3) so demo produces updates indefinitely.
4. ProbabilityRing change is backward-compatible: first mount reveals from 0, subsequent updates interpolate from current.
5. Match IDs m1/m2/m3 in mini-service must stay in sync with src/lib/tennis-data.ts.
6. `curl http://localhost:3001/` returns `{"code":0,"message":"Transport unknown"}` — socket.io owns path `/`, this is expected.
