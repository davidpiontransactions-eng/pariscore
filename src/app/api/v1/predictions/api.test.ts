/**
 * Tests d'intégration pour les API routes /api/v1/predictions/*.
 *
 * Teste chaque handler directement avec des objets Request mockés.
 * Les endpoints DB (health, drift) mockent prisma via mock.module AVANT l'import.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks AVANT les imports (ES modules = hoisting, mock.module doit précéder)
// ---------------------------------------------------------------------------

let mockPrisma: {
  modelVersion: {
    findFirst: ReturnType<typeof mock>;
    count: ReturnType<typeof mock>;
  };
  modelMetrics: {
    findFirst: ReturnType<typeof mock>;
  };
  predictionLog: {
    findMany: ReturnType<typeof mock>;
    count: ReturnType<typeof mock>;
  };
};

function resetMocks() {
  mockPrisma = {
    modelVersion: {
      findFirst: mock(() => Promise.resolve(null)),
      count: mock(() => Promise.resolve(0)),
    },
    modelMetrics: {
      findFirst: mock(() => Promise.resolve(null)),
    },
    predictionLog: {
      findFirst: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
    },
  };
}

resetMocks();

// Mock prisma —doit être appelé AVANT tout import de route
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock drift-detection
mock.module("@/lib/prediction/football/drift-detection", () => ({
  detectDrift: mock(() => ({
    drifted: false,
    summary: "Pas de drift détecté",
    metrics: [],
  })),
}));

// Mock BSD football fetcher —retourne des matchs terminés factices
mock.module("@/lib/bsd-football-fetcher", () => ({
  fetchFootballMatches: mock(() =>
    Promise.resolve([
      {
        id: "f1",
        league: { id: "L1", name: "Ligue 1", country: "France", countryCode: "FR", logo: "", tier: "T1" },
        round: "J1",
        scheduledAt: "2026-08-01T18:00:00Z",
        home: { id: "h1", name: "PSG", shortName: "PSG", logo: "", color: "#004170", form: [], rank: 1 },
        away: { id: "a1", name: "Marseille", shortName: "OM", logo: "", color: "#EF0107", form: [], rank: 3 },
        prediction: { homeProb: 65, drawProb: 20, awayProb: 15, bttsProb: 55, over25Prob: 60, model: "test" },
      },
      {
        id: "f2",
        league: { id: "L1", name: "Ligue 1", country: "France", countryCode: "FR", logo: "", tier: "T1" },
        round: "J2",
        scheduledAt: "2026-08-08T18:00:00Z",
        home: { id: "a1", name: "Marseille", shortName: "OM", logo: "", color: "#EF0107", form: [], rank: 3 },
        away: { id: "h1", name: "PSG", shortName: "PSG", logo: "", color: "#004170", form: [], rank: 1 },
        prediction: { homeProb: 30, drawProb: 30, awayProb: 40, bttsProb: 50, over25Prob: 50, model: "test" },
      },
    ]),
  ),
}));

// Mock walk-forward
mock.module("@/lib/prediction/football/walk-forward", () => ({
  walkForwardValidation: mock(() => ({
    predictions: [
      { pick: "HOME_WIN", predicted: 0.65, actual: 1, date: "2026-08-01" },
      { pick: "AWAY_WIN", predicted: 0.30, actual: 0, date: "2026-08-02" },
    ],
    metrics: {
      brierScore: 0.22,
      logLoss: 0.45,
      accuracy: 0.60,
      markets: {
        "1X2": { brier: 0.20, logLoss: 0.40, accuracy: 0.62, roi: 0.05, sampleSize: 2 },
        BTTS: { brier: 0.25, logLoss: 0.50, accuracy: 0.55, roi: -0.02, sampleSize: 2 },
        O25: { brier: 0.21, logLoss: 0.44, accuracy: 0.58, roi: 0.03, sampleSize: 2 },
      },
    },
    windows: 1,
  })),
}));

// Mock calibration curve
mock.module("@/lib/prediction/football/brier-score", () => ({
  calibrationCurve: mock(() => [
    { bin: "0.0-0.1", meanPredicted: 0.05, fractionPositive: 0.0, count: 0 },
    { bin: "0.6-0.7", meanPredicted: 0.65, fractionPositive: 1.0, count: 1 },
  ]),
}));

// ---------------------------------------------------------------------------
// Imports dynamiques APRÈS les mocks
// ---------------------------------------------------------------------------

const { POST: computePOST } = await import("./compute/route");
const { GET: healthGET } = await import("./health/route");
const { GET: accuracyGET } = await import("./accuracy/route");
const { GET: driftGET } = await import("./drift/route");

// ---------------------------------------------------------------------------
// Helpers — construction de Request pour chaque endpoint
// ---------------------------------------------------------------------------

function makeComputeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/v1/predictions/compute", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeAccuracyRequest(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return new Request(`http://localhost:3000/api/v1/predictions/accuracy${qs}`, {
    method: "GET",
  });
}

function makeDriftRequest(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return new Request(`http://localhost:3000/api/v1/predictions/drift${qs}`, {
    method: "GET",
  });
}

beforeEach(() => {
  resetMocks();
});

// ===========================================================================
// POST /api/v1/predictions/compute
// ===========================================================================

describe("POST /api/v1/predictions/compute", () => {
  test("POST avec matchId valide → 200 + objet prédiction", async () => {
    const req = makeComputeRequest({ matchId: "match-42" });
    const res = await computePOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.matchId).toBe("match-42");
    expect(data.model).toBeDefined();
    expect(data.confidence).toBeGreaterThanOrEqual(10);
    expect(data.confidence).toBeLessThanOrEqual(95);
  });

  test("POST sans matchId → 400", async () => {
    const req = makeComputeRequest({});
    const res = await computePOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("matchId");
  });

  test("POST avec body invalide (pas de JSON) → 400 ou 500", async () => {
    const req = new Request("http://localhost:3000/api/v1/predictions/compute", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await computePOST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("forme de la réponse : markets contient homeProb, drawProb, awayProb, bttsProb, over25Prob", async () => {
    const req = makeComputeRequest({ matchId: "match-1" });
    const res = await computePOST(req);
    const data = await res.json();

    expect(data.markets).toBeDefined();
    expect(typeof data.markets.homeProb).toBe("number");
    expect(typeof data.markets.drawProb).toBe("number");
    expect(typeof data.markets.awayProb).toBe("number");
    expect(typeof data.markets.bttsProb).toBe("number");
    expect(typeof data.markets.over25Prob).toBe("number");
  });

  test("forme de la réponse : champs model et confidence présents", async () => {
    const req = makeComputeRequest({ matchId: "match-2" });
    const res = await computePOST(req);
    const data = await res.json();

    expect(typeof data.model).toBe("string");
    expect(data.model.length).toBeGreaterThan(0);
    expect(typeof data.confidence).toBe("number");
  });

  test("POST avec homeElo et awayElo → 200 + edge éventuel", async () => {
    const req = makeComputeRequest({
      matchId: "match-elo",
      homeElo: 1800,
      awayElo: 1500,
    });
    const res = await computePOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.matchId).toBe("match-elo");
    if (data.edge !== undefined) {
      expect(typeof data.edge).toBe("number");
    }
  });

  test("POST avec homeElo non fini (string) → 400", async () => {
    const req = makeComputeRequest({
      matchId: "match-bad-elo",
      homeElo: "abc",
    });
    const res = await computePOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("homeElo");
  });
});

// ===========================================================================
// GET /api/v1/predictions/health
// ===========================================================================

describe("GET /api/v1/predictions/health", () => {
  test("GET → 200", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
  });

  test("forme de la réponse : status, model, metrics, drift, data, catboost", async () => {
    const res = await healthGET();
    const data = await res.json();

    expect(["healthy", "degraded", "critical"]).toContain(data.status);

    expect(data.model).toBeDefined();
    expect(typeof data.model.active).toBe("string");
    expect(typeof data.model.totalVersions).toBe("number");

    expect(data.metrics).toBeDefined();
    expect(typeof data.metrics.brierScore).toBe("number");
    expect(typeof data.metrics.accuracy).toBe("number");
    expect(typeof data.metrics.sampleSize).toBe("number");

    expect(data.drift).toBeDefined();
    expect(typeof data.drift.detected).toBe("boolean");
    expect(typeof data.drift.summary).toBe("string");

    expect(data.data).toBeDefined();
    expect(typeof data.data.totalPredictions).toBe("number");
    expect(typeof data.data.settledPredictions).toBe("number");
    expect(typeof data.data.pendingPredictions).toBe("number");

    expect(data.catboost).toBeDefined();
    expect(typeof data.catboost.enabled).toBe("boolean");
    expect(typeof data.catboost.available).toBe("boolean");
  });

  test("retourne critical quand aucun modèle production", async () => {
    // mockPrisma retourne null par défaut → pas de modèle production
    const res = await healthGET();
    const data = await res.json();
    expect(data.status).toBe("critical");
    expect(data.model.active).toBe("aucun");
  });
});

// ===========================================================================
// GET /api/v1/predictions/accuracy
// ===========================================================================

describe("GET /api/v1/predictions/accuracy", () => {
  test("GET avec paramètres par défaut → 200", async () => {
    const req = makeAccuracyRequest();
    const res = await accuracyGET(req);
    expect(res.status).toBe(200);
  });

  test("forme de la réponse : brierScore, accuracy, sampleSize", async () => {
    const req = makeAccuracyRequest();
    const res = await accuracyGET(req);
    const data = await res.json();

    expect(typeof data.brierScore).toBe("number");
    expect(typeof data.accuracy).toBe("number");
    expect(typeof data.sampleSize).toBe("number");
    expect(data.sampleSize).toBeGreaterThanOrEqual(0);
  });

  test("forme complète : calibration, period, markets, windows", async () => {
    const req = makeAccuracyRequest();
    const res = await accuracyGET(req);
    const data = await res.json();

    expect(Array.isArray(data.calibration)).toBe(true);

    expect(data.period).toBeDefined();
    expect(typeof data.period.from).toBe("string");
    expect(typeof data.period.to).toBe("string");
    expect(typeof data.period.matchCount).toBe("number");

    expect(data.markets).toBeDefined();
    expect(data.markets["1X2"]).toBeDefined();
    expect(data.markets.BTTS).toBeDefined();
    expect(data.markets.O25).toBeDefined();

    expect(typeof data.windows).toBe("number");
  });

  test("trainWindow trop petit → 400", async () => {
    const req = makeAccuracyRequest({ trainWindow: "5" });
    const res = await accuracyGET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("trainWindow");
  });

  test("testWindow invalide → 400", async () => {
    const req = makeAccuracyRequest({ testWindow: "0" });
    const res = await accuracyGET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("testWindow");
  });

  test("stepSize invalide → 400", async () => {
    const req = makeAccuracyRequest({ stepSize: "-1" });
    const res = await accuracyGET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("stepSize");
  });
});

// ===========================================================================
// GET /api/v1/predictions/drift
// ===========================================================================

describe("GET /api/v1/predictions/drift", () => {
  test("GET avec period=7d → 200", async () => {
    const req = makeDriftRequest({ period: "7d" });
    const res = await driftGET(req);
    expect(res.status).toBe(200);
  });

  test("forme de la réponse : drifted, summary, markets", async () => {
    const req = makeDriftRequest({ period: "7d" });
    const res = await driftGET(req);
    const data = await res.json();

    expect(typeof data.drifted).toBe("boolean");
    expect(typeof data.summary).toBe("string");
    expect(Array.isArray(data.markets)).toBe(true);
    expect(typeof data.checkedAt).toBe("string");
  });

  test("pas assez de données → drifted=false + details", async () => {
    const req = makeDriftRequest({ period: "7d" });
    const res = await driftGET(req);
    const data = await res.json();

    expect(data.drifted).toBe(false);
    expect(data.details).toBeDefined();
    expect(data.details.recentCount).toBe(0);
    expect(data.details.baselineCount).toBe(0);
  });

  test("period invalide (>365d) → 400", async () => {
    const req = makeDriftRequest({ period: "400d" });
    const res = await driftGET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("period");
  });

  test("baseline invalide (<7d) → 400", async () => {
    const req = makeDriftRequest({ period: "7d", baseline: "3d" });
    const res = await driftGET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("baseline");
  });
});
