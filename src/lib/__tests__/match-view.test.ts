import { describe, test, expect } from "bun:test";
import { filterByNextDays, filterByToday, filterByTomorrow } from "../match-view";

//NOW = 07/10 14:00 Europe/Paris. Midi ⇒ la date Paris est la même quelle que
// soit la machine, donc le test ne dépend pas du TZ du runner.
const NOW = new Date("2026-10-07T12:00:00Z");

const kickoff = (s: string) => s;
const at = (x: string | null | undefined) => x;

const rows = [
  { id: "aujourdhui", ko: kickoff("2026-10-07T20:45:00+02:00") },
  // 23:30 UTC = 01:30 le 08/10 à Paris : c'est DÉMAIN, pas aujourd'hui.
  { id: "frontiere-paris", ko: kickoff("2026-10-07T23:30:00Z") },
  { id: "demain", ko: kickoff("2026-10-08T18:30:00+02:00") },
  { id: "j2", ko: kickoff("2026-10-09T18:30:00+02:00") },
  { id: "j3", ko: kickoff("2026-10-10T18:30:00+02:00") },
  { id: "j4", ko: kickoff("2026-10-11T18:30:00+02:00") },
  { id: "absent", ko: null },
  { id: "invalide", ko: "pas-une-date" },
];

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("filterByNextDays", () => {
  test("days=1 → demain seul (aujourd'hui est exclu par construction)", () => {
    expect(ids(filterByNextDays(rows, 1, (r) => r.ko, NOW))).toEqual([
      "frontiere-paris",
      "demain",
    ]);
  });

  test("days=3 → J+1..J+3, borné au jour civil Paris (J+4 exclu)", () => {
    // La frontière UTC (23:30Z = 01:30 Paris J+1) ne doit PAS glisser J+1
    // dans « aujourd'hui », ni J+4 dans la fenêtre.
    expect(ids(filterByNextDays(rows, 3, (r) => r.ko, NOW))).toEqual([
      "frontiere-paris",
      "demain",
      "j2",
      "j3",
    ]);
  });

  test("days<=0 → liste vide (fenêtre nulle, pas de liste entière)", () => {
    expect(filterByNextDays(rows, 0, (r) => r.ko, NOW)).toEqual([]);
  });

  test("date absente ou illisible → exclue dès qu'une fenêtre est engagée", () => {
    const out = ids(filterByNextDays(rows, 3, (r) => at(r.ko), NOW));
    expect(out).not.toContain("absent");
    expect(out).not.toContain("invalide");
  });

  test("les 3 jours + aujourd'hui = 4 jours civils distincts, sans doublon", () => {
    const j3 = ids(filterByNextDays(rows, 3, (r) => r.ko, NOW));
    const j0 = ids(filterByToday(rows, (r) => r.ko, NOW));
    const all = [...j0, ...j3];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual(["aujourdhui", "frontiere-paris", "demain", "j2", "j3"]);
  });

  test("régression : filterByTomorrow = demain seul, filterByToday = aujourd'hui seul", () => {
    expect(ids(filterByToday(rows, (r) => r.ko, NOW))).toEqual(["aujourdhui"]);
    expect(ids(filterByTomorrow(rows, (r) => r.ko, NOW))).toEqual([
      "frontiere-paris",
      "demain",
    ]);
  });
});
