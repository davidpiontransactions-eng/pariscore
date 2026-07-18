/**
 * Tennis Live Updates — WebSocket mini-service (Bun + socket.io)
 *
 * Port: 3001 (HARDCODED — do not use env PORT, per gateway convention)
 * Path: "/" (Caddy uses this to forward via ?XTransformPort=3001)
 *
 * Events:
 *   Server → Client:
 *     - "initial_state": LiveMatchState[]  (sent once on connection)
 *     - "match_update":  LiveMatchState    (broadcast every ~5s)
 *   Client → Server:
 *     - "subscribe_match": { matchId: string }  (logged only, for future use)
 *     - "ping":  any                          → "pong": { t: number }
 */

import { createServer } from "http";
import { Server } from "socket.io";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SideScore = {
  sets: number[]; // past set wins per side, e.g. [6, 4] = won set 1 6-4
  games: number; // games in current set
  points: number; // 0/1/2/3 = 0/15/30/40 (deuce handled via +2 lead)
};

export type LiveMatchState = {
  matchId: string;
  isLive: boolean;
  currentSet: number; // 1-5
  scoreA: SideScore;
  scoreB: SideScore;
  liveProbA: number; // 0-100
  liveProbB: number; // 0-100
  server: "A" | "B";
  lastUpdate: string; // ISO timestamp
};

// ─── Fallback demo state (used if BSD prematch API is unreachable) ───────────

const FALLBACK_SEEDS: { matchId: string; seedProbA: number; startServer: "A" | "B" }[] = [
  { matchId: "m1", seedProbA: 84, startServer: "A" }, // Sabalenka vs Osaka
  { matchId: "m2", seedProbA: 71, startServer: "A" }, // Alcaraz vs Rublev
  { matchId: "m3", seedProbA: 58, startServer: "A" }, // Sinner vs Medvedev
];

function createInitialMatch(
  matchId: string,
  seedProbA: number,
  startServer: "A" | "B",
): LiveMatchState {
  return {
    matchId,
    isLive: true,
    currentSet: 1,
    scoreA: { sets: [], games: 0, points: 0 },
    scoreB: { sets: [], games: 0, points: 0 },
    liveProbA: seedProbA,
    liveProbB: 100 - seedProbA,
    server: startServer,
    lastUpdate: new Date().toISOString(),
  };
}

function loadFallbackMatches(): Map<string, LiveMatchState> {
  const m = new Map<string, LiveMatchState>();
  for (const seed of FALLBACK_SEEDS) {
    m.set(seed.matchId, createInitialMatch(seed.matchId, seed.seedProbA, seed.startServer));
  }
  return m;
}

let matches = loadFallbackMatches();
let matchIds = Array.from(matches.keys());

// ─── Fetch real matches from BSD prematch API ────────────────────────────────
// Replaces the fallback demo matches with real ones so that match IDs match
// the prematch API (e.g. "bsd-42759") and MomentumDR can render via the
// liveState[match.id] lookup in page.tsx.

async function tryLoadRealMatches(): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("http://localhost:3005/api/tennis/prematch");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { matches?: any[] };
      const real = (data.matches ?? []).slice(0, 8);
      if (real.length < 2) throw new Error("less than 2 matches returned");

      const m = new Map<string, LiveMatchState>();
      for (const r of real) {
        const probA = typeof r.probA === "number" ? r.probA : 50;
        m.set(r.id, {
          matchId: r.id,
          isLive: true,
          currentSet: 1,
          scoreA: { sets: [], games: 0, points: 0 },
          scoreB: { sets: [], games: 0, points: 0 },
          liveProbA: probA,
          liveProbB: 100 - probA,
          server: "A",
          lastUpdate: new Date().toISOString(),
        });
      }

      matches = m;
      matchIds = Array.from(m.keys());
      console.log(`[tennis-live] loaded ${matchIds.length} real matches: ${matchIds.join(", ")}`);
      return true;
    } catch (err) {
      console.log(`[tennis-live] attempt ${attempt + 1}/3 to load real matches failed:`, (err as Error)?.message ?? err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  console.log(`[tennis-live] using ${matchIds.length} fallback demo matches: ${matchIds.join(", ")}`);
  return false;
}

// Best-of-3 → first to 2 sets wins. Adjust to 3 for best-of-5.
const SETS_TO_WIN = 2;

// ─── Simulation logic ────────────────────────────────────────────────────────
// Each tick (every 5s) advances ONE match by one point. We rotate through
// matches so updates feel staggered and "alive" rather than 8 simultaneous
// score bumps.

let matchRotation = 0;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pointWinProbability(liveProbA: number, server: "A" | "B"): number {
  // Base probability that A wins the next point comes from the live match prob.
  // A small serve bonus (±3%) makes the server slightly more likely to win
  // their own service point.
  const base = liveProbA / 100;
  const serveAdj = server === "A" ? 0.03 : -0.03;
  return clamp(base + serveAdj, 0.05, 0.95);
}

function advancePoint(state: LiveMatchState): LiveMatchState {
  if (!state.isLive) return state;

  const pAWinsPoint = Math.random() < pointWinProbability(state.liveProbA, state.server);

  const winner = pAWinsPoint ? "A" : "B";
  const loser = pAWinsPoint ? "B" : "A";

  const scoreW = winner === "A" ? state.scoreA : state.scoreB;
  const scoreL = loser === "A" ? state.scoreA : state.scoreB;

  scoreW.points += 1;

  // Game win: need at least 4 points AND 2-point lead (handles deuce/advantage)
  const gameWon = scoreW.points >= 4 && scoreW.points - scoreL.points >= 2;

  if (gameWon) {
    scoreW.games += 1;
    scoreW.points = 0;
    scoreL.points = 0;

    // Set win: 6 games w/ 2 lead, OR 7 games (tiebreak at 6-6 → 7-6)
    const setWon =
      (scoreW.games >= 6 && scoreW.games - scoreL.games >= 2) || scoreW.games >= 7;

    if (setWon) {
      // Snapshot the set score into the sets array (always A first, B second)
      const setA = state.scoreA.games;
      const setB = state.scoreB.games;
      state.scoreA.sets = [...state.scoreA.sets, setA];
      state.scoreB.sets = [...state.scoreB.sets, setB];
      state.scoreA.games = 0;
      state.scoreB.games = 0;

      const setsWonA = state.scoreA.sets.length
        ? state.scoreA.sets.filter((_, i) => state.scoreA.sets[i] > state.scoreB.sets[i]).length
        : 0;
      const setsWonB = state.scoreA.sets.length
        ? state.scoreB.sets.filter((_, i) => state.scoreB.sets[i] > state.scoreA.sets[i]).length
        : 0;

      if (setsWonA >= SETS_TO_WIN || setsWonB >= SETS_TO_WIN) {
        state.isLive = false;
      } else {
        state.currentSet += 1;
      }
    }

    // Switch server after every completed game (standard tennis alternation)
    if (state.isLive) {
      state.server = state.server === "A" ? "B" : "A";
    }
  }

  // Recompute live probability: small random walk + drift toward point winner
  const walk = (Math.random() - 0.5) * 1.2; // ±0.6
  const drift = winner === "A" ? 0.5 : -0.5;
  let nextProbA = state.liveProbA + walk + drift;

  // If set/match just swung, add a slightly larger nudge
  if (gameWon) nextProbA += winner === "A" ? 1.5 : -1.5;

  state.liveProbA = clamp(Math.round(nextProbA * 10) / 10, 2, 98);
  state.liveProbB = clamp(Math.round((100 - state.liveProbA) * 10) / 10, 2, 98);

  state.lastUpdate = new Date().toISOString();
  return state;
}

function tick(io: Server) {
  // Advance ONE match per tick (rotation) so updates feel staggered.
  const matchId = matchIds[matchRotation % matchIds.length];
  matchRotation += 1;

  const state = matches.get(matchId);
  if (!state) return;

  // If this match finished, restart it so the demo keeps producing live
  // updates indefinitely.  For fallback matches, restore the original seed
  // probability.  For real matches, default to 50/50 on restart.
  if (!state.isLive) {
    const seed = FALLBACK_SEEDS.find((s) => s.matchId === matchId);
    const restartProb = seed ? seed.seedProbA : 50;
    const restartServer = seed ? seed.startServer : "A";
    matches.set(matchId, createInitialMatch(matchId, restartProb, restartServer));
    io.emit("match_update", matches.get(matchId));
    return;
  }

  advancePoint(state);
  io.emit("match_update", state);
}

// ─── HTTP + Socket.io server ─────────────────────────────────────────────────

const httpServer = createServer((_req, res) => {
  // Tiny health endpoint — useful for debugging the gateway.
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      service: "tennis-live",
      port: PORT,
      clients: io.engine.clientsCount,
      matches: matchIds,
    }),
  );
});

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses "/" to forward via ?XTransformPort=3001
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

io.on("connection", (socket) => {
  console.log(`[tennis-live] client connected: ${socket.id}`);

  // Send the full current state to the new client.
  socket.emit("initial_state", Array.from(matches.values()));

  // Per-match subscription hook (logged only, for future use).
  socket.on("subscribe_match", (payload: unknown) => {
    console.log(`[tennis-live] subscribe_match from ${socket.id}:`, payload);
  });

  // Latency probe.
  socket.on("ping", (data: unknown) => {
    socket.emit("pong", { t: Date.now(), echo: data ?? null });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[tennis-live] client disconnected: ${socket.id} (${reason})`);
  });

  socket.on("error", (err) => {
    console.error(`[tennis-live] socket error (${socket.id}):`, err);
  });
});

// ─── Boot ────────────────────────────────────────────────────────────────────

const PORT = 3001; // HARDCODED per spec — do not use env PORT

httpServer.listen(PORT, async () => {
  console.log(`[tennis-live] WebSocket server listening on port ${PORT} (path: /)`);

  // Try to load real BSD matches in background.  The initial_state event sent
  // to early clients will contain fallback data; once real matches arrive the
  // map is replaced and subsequent clients will get real IDs.
  tryLoadRealMatches().then((ok) => {
    if (ok) {
      // Broadcast the updated state to all currently connected clients so they
      // don't need to reconnect.
      io.emit("initial_state", Array.from(matches.values()));
      console.log(`[tennis-live] broadcasted real match state to ${io.engine.clientsCount} client(s)`);
    }
  });
});

// Re-fetch the prematch API every 60 seconds so match IDs stay in sync
// with what the page sees (SWR fetches on every page load, but tennis-live
// fetches once at startup — without this, IDs would drift over time).
const REFRESH_MS = 60_000;
let doRefresh: boolean = true;
(async function refreshLoop() {
  while (doRefresh) {
    await new Promise((r) => setTimeout(r, REFRESH_MS));
    await tryLoadRealMatches();
    io.emit("initial_state", Array.from(matches.values()));
  }
})();

// Broadcast a match update every 5 seconds.
const TICK_MS = 5_000;
const interval = setInterval(() => tick(io), TICK_MS);
interval.unref?.();

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[tennis-live] received ${signal}, shutting down...`);
  doRefresh = false;
  clearInterval(interval);
  io.close(() => {
    httpServer.close(() => {
      console.log("[tennis-live] closed");
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
