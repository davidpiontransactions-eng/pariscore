// Tests régression fenêtre de vue basket — boucle rouge debug 2026-09-23
// Bug : filterByStartWindow(48) inconditionnel drop tout match démarré >15min
// → live disparaît de toutes les vues 15 min après le tip-off

import { describe, test, expect } from "bun:test";
import { selectBasketballView } from "../basketball-view";

const NOW = new Date("2026-09-23T20:00:00Z");
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const live40min = { id: "live", status: "in-progress", scheduledAt: iso(-40 * 60_000) };
const upcoming2h = { id: "pre1", status: "pre", scheduledAt: iso(2 * 3_600_000) };
const old3d = { id: "old", status: "pre", scheduledAt: iso(-3 * 86_400_000) };
const all = [live40min, upcoming2h, old3d];

describe("selectBasketballView", () => {
  test("vue live : garde le match en cours démarré il y a 40 min", () => {
    const ids = selectBasketballView(all, "live", NOW).map((m) => m.id);
    expect(ids).toContain("live");
    expect(ids).not.toContain("pre1");
  });

  test("vue prematch : exclut les live, garde le à venir, drop le vieux", () => {
    const ids = selectBasketballView(all, "prematch", NOW).map((m) => m.id);
    expect(ids).toEqual(["pre1"]);
  });

  test("vue today : live conservé + prematch fenêtré, vieux exclu", () => {
    const ids = selectBasketballView(all, "today", NOW).map((m) => m.id);
    expect(ids).toContain("live");
    expect(ids).toContain("pre1");
    expect(ids).not.toContain("old");
  });
});
