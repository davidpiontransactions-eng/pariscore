import { describe, expect, test } from "bun:test";
import { parseTimeFilter, filterByToday, filterByTomorrow } from "@/lib/match-view";

type B = { start: string };

const list: B[] = [
  { start: "2026-10-03T18:00:00Z" }, // 20h00 Paris — aujourd'hui
  { start: "2026-10-04T18:00:00Z" }, // 20h00 Paris — demain
  { start: "2026-10-05T18:00:00Z" }, // 20h00 Paris — après-demain
];

// Ce que l'onglet MMA faisait avant : parseTimeFilter puis on ignorait
// `tomorrow`. La pastille « Demain » s'affichait et ne filtrait rien.
describe("parseTimeFilter — drapeaux complets", () => {
  test("chaque pastille produit un drapeau distinct", () => {
    expect(parseTimeFilter("all")).toEqual({ hours: null, today: false, tomorrow: false, weekend: false });
    expect(parseTimeFilter("today")).toEqual({ hours: null, today: true, tomorrow: false, weekend: false });
    expect(parseTimeFilter("tomorrow")).toEqual({ hours: null, today: false, tomorrow: true, weekend: false });
    expect(parseTimeFilter("weekend")).toEqual({ hours: null, today: false, tomorrow: false, weekend: true });
    expect(parseTimeFilter("2h").hours).toBe(2);
  });
});

describe("pastille Demain — filtre reellement applique", () => {
  const now = new Date("2026-10-03T12:00:00Z");

  test("filtre par demain et rien d'autre", () => {
    const { tomorrow } = parseTimeFilter("tomorrow");
    expect(tomorrow).toBe(true);
    const out = filterByTomorrow(list, (b) => b.start, now);
    expect(out).toHaveLength(1);
    expect(out[0].start).toBe("2026-10-04T18:00:00Z");
  });

  test("Aujourd'hui et Demain ne se confondent pas", () => {
    const t = parseTimeFilter("today");
    const tm = parseTimeFilter("tomorrow");
    const a = filterByToday(list, (b) => b.start, now);
    const b = filterByTomorrow(list, (b) => b.start, now);
    expect(a[0].start).toBe("2026-10-03T18:00:00Z");
    expect(b[0].start).toBe("2026-10-04T18:00:00Z");
    expect(a[0].start).not.toBe(b[0].start);
    expect(t.today && !tm.tomorrow === false).toBe(true);
  });

  test("le basculement heure d'ete ne deplace pas le jour de Paris", () => {
    // 22h30 UTC = 00h30 Paris le lendemain en hiver (UTC+1) : le combat du
    // 23h30 UTC appartient au 24, pas au 23. C'est le piege qui fait qu'un
    // calendrier Paris peut afficher un combat au mauvais jour.
    const nuit = new Date("2026-10-23T23:30:00Z");
    const nyc = new Date("2026-10-23T23:30:00Z");
    const journee = [
      { start: "2026-10-23T22:00:00Z" }, // 00h00 Paris le 24
      { start: "2026-10-24T18:00:00Z" }, // 20h00 Paris le 24
    ];
    const ref = new Date("2026-10-23T12:00:00Z");
    const out = filterByTomorrow(journee, (b) => b.start, ref);
    expect(out.map((o) => o.start)).toContain("2026-10-23T22:00:00Z");
    expect(nuit.getTime()).toBe(nyc.getTime());
  });
});