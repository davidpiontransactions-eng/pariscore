import { test, expect } from "@playwright/test";

/**
 * Fiche équipe — recette API (T14).
 * UI (dialog) alimentée par GET /api/football/teams/profile : on verrouille
 * le contrat que le popup consomme (3 venues, verdict, heatmap, alertes,
 * value). Pas de dépendance aux données live BSD.
 */

const base = "/api/football/teams/profile?league=epl&team=Arsenal";

async function profile(request: import("@playwright/test").APIRequestContext, venue: string, market = "") {
  const res = await request.get(`${base}&venue=${venue}${market}`);
  expect(res.ok()).toBeTruthy();
  const { profile } = await res.json();
  return profile;
}

test("3 venues : scope reflété et scores différenciés", async ({ request }) => {
  const home = await profile(request, "home");
  const away = await profile(request, "away");
  const overall = await profile(request, "overall");
  expect(home.venue).toBe("home");
  expect(away.venue).toBe("away");
  expect(overall.venue).toBe("overall");
  // Attaque domicile ≠ extérieur (splits réels FD).
  expect(home.attack.score).not.toBe(away.attack.score);
  for (const p of [home, away, overall]) {
    expect(p.standing.rank).toBeGreaterThanOrEqual(1);
    expect(p.attack.score).toBeGreaterThanOrEqual(5);
    expect(p.attack.score).toBeLessThanOrEqual(95);
  }
});

test("verdict complet : elo, infirmerie, alertes, discipline, congestion, steam, arbitre", async ({
  request,
}) => {
  const p = await profile(request, "home");
  // Verdict header.
  expect(p.defense.score).toBeGreaterThanOrEqual(5);
  expect(p.elo.elo).toBeGreaterThan(1500);
  // Heatmap : metrics avec rangs.
  expect(p.attack.metrics.length).toBeGreaterThanOrEqual(4);
  for (const m of [...p.attack.metrics, ...p.defense.metrics]) {
    expect(m.display).toBeTruthy();
  }
  // Vague 2-3.
  expect(p.sos).toBeGreaterThan(1400);
  expect(typeof p.ppmAjuste).toBe("number");
  expect(Array.isArray(p.alerts)).toBeTruthy();
  expect(Array.isArray(p.injuries.list)).toBeTruthy();
  expect(p.discipline.sample).toBeGreaterThan(0);
  expect(Number.isInteger(p.congestion.restDays)).toBeTruthy();
  expect(p.clv.samples).toBeGreaterThan(0);
  expect(p.referee.name.length).toBeGreaterThan(1);
  // Sans marché : pas de value.
  expect(p.value).toBeNull();
});

test("value avec marché : edge numérique", async ({ request }) => {
  const p = await profile(
    request,
    "home",
    "&fairH=55&fairD=25&fairA=20&oddsH=1.85&oddsD=3.6&oddsA=4.4",
  );
  expect(p.value.side).toBe("home");
  expect(p.value.edgePct).toBeGreaterThan(0);
  expect(p.value.edgePct).toBeLessThan(15);
});
