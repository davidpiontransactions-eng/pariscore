import { describe, expect, test } from "bun:test";
import {
  HANDBALL_MAX_DURATION_MS,
  resolveHandballLifecycle,
} from "../handball-flashscore";

// Bead 4pvy — cycle de vie RÉEL : le flag live du feed Flashscore ment
// (match fini resté isLive:true) → le coup de sifflet final prime.

const T0 = Date.parse("2026-09-28T16:00:00Z"); // « maintenant » figé

describe("resolveHandballLifecycle", () => {
  test("isFinished gagne toujours (même flag live + heure fraîche)", () => {
    expect(
      resolveHandballLifecycle(
        { time: "2026-09-28T15:30:00Z", isLive: true, isFinished: true },
        T0,
      ),
    ).toBe("finished");
  });

  test("flag live PÉRIMÉ : kickoff > 3 h → finished (cas Nordsjaelland-Skjern)", () => {
    expect(
      resolveHandballLifecycle(
        { time: "2026-09-27T13:00:00Z", isLive: true, isFinished: false },
        T0,
      ),
    ).toBe("finished");
  });

  test("flag live FRAIS : kickoff il y a 30 min → live", () => {
    expect(
      resolveHandballLifecycle({ time: "2026-09-28T15:30:00Z", isLive: true }, T0),
    ).toBe("live");
  });

  test("flag live mais coup d'envoi dans le futur (hors marge 15 min) → upcoming", () => {
    expect(
      resolveHandballLifecycle({ time: "2026-09-28T18:30:00Z", isLive: true }, T0),
    ).toBe("upcoming");
  });

  test("marge 15 min avant coup d'envoi : live accepté (pré-match feed)", () => {
    expect(
      resolveHandballLifecycle({ time: "2026-09-28T15:50:00Z", isLive: true }, T0),
    ).toBe("live");
  });

  test("sans heure : seul le flag parle (jamais de finished inventé)", () => {
    expect(resolveHandballLifecycle({ isLive: true }, T0)).toBe("live");
    expect(resolveHandballLifecycle({}, T0)).toBe("upcoming");
    expect(resolveHandballLifecycle({ isFinished: true }, T0)).toBe("finished");
  });

  test("kickoff passé sans flag → upcoming (le feed n'a rien dit, pas de faux finished)", () => {
    expect(
      resolveHandballLifecycle({ time: "2026-09-28T14:00:00Z" }, T0),
    ).toBe("upcoming");
  });

  test("borne exacte 3 h : strictement > pour finished", () => {
    const kickoff = "2026-09-28T13:00:00Z"; // T0 = +3 h pile
    expect(resolveHandballLifecycle({ time: kickoff, isLive: true }, T0)).toBe("live");
    expect(
      resolveHandballLifecycle({ time: kickoff, isLive: true }, T0 + 1),
    ).toBe("finished");
  });

  test("constante de durée = 3 h", () => {
    expect(HANDBALL_MAX_DURATION_MS).toBe(3 * 3_600_000);
  });
});
