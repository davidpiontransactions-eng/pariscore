// Test de la route GET /api/handball/analysis (DTO « Over & Buteurs »).
// Robuste à l'absence de DB : les assertions structurelles (échelle, bornes,
// monotonie) tiennent même sans historique — seules les valeurs métier sont
// conditionnées à la présence de `handball_match_history`.
import { describe, expect, test } from "bun:test";
import { GET } from "../../app/api/handball/analysis/route";

async function fetchAnalysis(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await GET(new Request(`http://localhost/api/handball/analysis?${qs}`));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/handball/analysis", () => {
  test("400 sans home/away", async () => {
    const { status } = await fetchAnalysis({});
    expect(status).toBe(400);
  });

  test("payload complet : échelle 8 lignes, bornes et monotonie", async () => {
    const { status, body } = await fetchAnalysis({
      home: "Kiel",
      away: "Flensburg-H.",
      league: "Bundesliga",
      date: "2026-09-26T16:00:00.000Z",
    });
    expect(status).toBe(200);
    expect(body.ok).toBeTrue();

    // Échelle Over : 59.5 → 52.5 (8 lignes), bornes [0;1], croissante
    expect(body.over.lines).toHaveLength(8);
    expect(body.over.lines[0].line).toBe(59.5);
    expect(body.over.lines[7].line).toBe(52.5);
    expect(body.over.floor).toBe(0.55);
    for (const l of body.over.lines) {
      expect(l.over).toBeGreaterThanOrEqual(0);
      expect(l.over).toBeLessThanOrEqual(1);
      expect(l.playable).toBe(l.over >= body.over.floor);
    }
    for (let i = 1; i < body.over.lines.length; i++) {
      expect(body.over.lines[i].over).toBeGreaterThanOrEqual(body.over.lines[i - 1].over - 1e-6);
    }
    // Pick = plus haute ligne jouable, ou null
    if (body.over.pick) {
      expect(body.over.pick.playable).toBeTrue();
      expect(body.over.pick.line).toBe(
        body.over.lines.find((l: { playable: boolean }) => l.playable)!.line
      );
    }

    // 1X2 normalisé
    const s = body.match1x2.home + body.match1x2.draw + body.match1x2.away;
    expect(s).toBeGreaterThan(99);
    expect(s).toBeLessThan(101);

    // Modèle : total attendu positif et raisonnable (40 → 80 buts)
    expect(body.model.expectedTotal).toBeGreaterThan(40);
    expect(body.model.expectedTotal).toBeLessThan(80);
    expect(body.model.base).toBe(60);
    expect(body.model.nu).toBeGreaterThanOrEqual(0.7);
    expect(body.model.nu).toBeLessThanOrEqual(2.5);

    // Documentation présente (6 entrées mini)
    expect(Array.isArray(body.method)).toBeTrue();
    expect(body.method.length).toBeGreaterThanOrEqual(5);
  });

  test("profils équipes : winrate et splits L5/L10 dom/ext typés", async () => {
    const { body } = await fetchAnalysis({ home: "Kiel", away: "Flensburg-H." });
    const home = body.teams.home;
    // DB présente en CI locale → l'équipe doit avoir ses splits ; sinon null.
    if (home == null) return;
    expect(home.n).toBeGreaterThan(0);
    expect(home.winrate).toBeGreaterThanOrEqual(0);
    expect(home.winrate).toBeLessThanOrEqual(1);
    for (const side of [home.home, home.away]) {
      for (const w of [side.l5, side.l10, side.all]) {
        expect(w.n).toBeGreaterThanOrEqual(0);
        if (w.n > 0) {
          expect(w.scored).not.toBeNull();
          expect(w.conceded).not.toBeNull();
          expect(w.ppg).toBeGreaterThanOrEqual(0);
          expect(w.ppg).toBeLessThanOrEqual(3);
          expect(w.diff).toBeCloseTo((w.scored ?? 0) - (w.conceded ?? 0), 1);
        }
      }
    }
  });

  test("buteurs : 2 par équipe max, probas bornées et décroissantes", async () => {
    const { body } = await fetchAnalysis({
      home: "Kiel",
      away: "Flensburg-H.",
      league: "Bundesliga",
    });
    for (const list of [body.scorers.home, body.scorers.away]) {
      expect(list.length).toBeLessThanOrEqual(2);
      for (const p of list) {
        expect(p.lambda).toBeGreaterThan(0);
        expect(p.probs).toHaveLength(4);
        expect(p.probs.map((t: { n: number }) => t.n)).toEqual([2, 3, 4, 5]);
        for (let i = 1; i < p.probs.length; i++) {
          expect(p.probs[i].p).toBeLessThanOrEqual(p.probs[i - 1].p);
        }
        for (const t of p.probs) {
          expect(t.p).toBeGreaterThanOrEqual(0);
          expect(t.p).toBeLessThanOrEqual(1);
          expect(t.playable).toBe(t.p >= 0.55);
        }
      }
    }
  });
});
