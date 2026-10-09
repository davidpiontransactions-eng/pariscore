// Tests du client ESPN NHL et de la bascule `unavailable` → `ready` du
// moteur hockey. La propriété verrouillée : un payload ESPN RÉEL (période +
// horloge + score) doit produire un `LiveBetsBundle` exploitable, et un payload
// incomplet doit rester `null` — jamais des probabilités inventées.
import { describe, expect, test } from "bun:test";
import {
  normalizeEspnNhlEvent,
  parseEspnClockToSeconds,
} from "@/lib/hockey/data/espn-nhl";
import { adaptHockey } from "@/lib/prediction/live-adapters";
import { buildBundle } from "@/hooks/use-live-predictive-bets";

/** Forme ESPN NHL réelle : `competitions[0].competitors` + `status`. */
const espnEvent = (over: Record<string, unknown> = {}) => ({
  id: "401585",
  date: "2026-10-09T23:00Z",
  name: "NY Rangers @ Toronto Maple Leafs",
  league: { abbreviation: "NHL", name: "National Hockey League" },
  competitions: [
    {
      id: "401585",
      competitors: [
        {
          homeAway: "home",
          score: "2",
          team: { id: "10", displayName: "Toronto Maple Leafs", abbreviation: "TOR" },
        },
        {
          homeAway: "away",
          score: "1",
          team: { id: "3", displayName: "New York Rangers", abbreviation: "NYR" },
        },
      ],
      status: {
        clock: 765,
        displayClock: "12:45",
        period: 3,
        type: { id: "STATUS_IN_PROGRESS", state: "in", completed: false, shortDetail: "12:45 - 3rd Period" },
      },
    },
  ],
  status: {
    clock: 765,
    displayClock: "12:45",
    period: 3,
    type: { id: "STATUS_IN_PROGRESS", state: "in", completed: false, shortDetail: "12:45 - 3rd Period" },
  },
  ...over,
});

// ─── Horloge ───────────────────────────────────────────────────────────────

describe("parseEspnClockToSeconds", () => {
  test("convertit mm:ss en secondes", () => {
    expect(parseEspnClockToSeconds("12:45")).toBe(765);
    expect(parseEspnClockToSeconds("20:00")).toBe(1200);
    expect(parseEspnClockToSeconds("0:07")).toBe(7);
  });

  test("valeurs non numériques → null (jamais 0 inventé)", () => {
    // "Intermission" est la valeur réelle d'ESPN entre deux périodes : la
    // convertir en 0 ferait croire à une fin de période.
    for (const v of ["Intermission", "", "Halftime", "End", undefined, null, 765]) {
      expect(parseEspnClockToSeconds(v as string | undefined)).toBeNull();
    }
  });

  test("secondes hors [0, 59] → null", () => {
    expect(parseEspnClockToSeconds("12:99")).toBeNull();
  });
});

// ─── Normalisation ESPN ────────────────────────────────────────────────────

describe("normalizeEspnNhlEvent", () => {
  test("match live 3e période → période + horloge + score", () => {
    const m = normalizeEspnNhlEvent(espnEvent());
    expect(m?.period).toBe(3);
    expect(m?.periodSecondsLeft).toBe(765);
    expect(m?.homeGoals).toBe(2);
    expect(m?.awayGoals).toBe(1);
    expect(m?.isLive).toBe(true);
    expect(m?.isFinished).toBe(false);
    expect(m?.homeName).toBe("Toronto Maple Leafs");
  });

  test("score en objet {value} (forme ESPN alternate) → lu", () => {
    const raw = espnEvent();
    const comps = raw.competitions as Array<{ competitors: Array<Record<string, unknown>> }>;
    comps[0]!.competitors[0]!.score = { value: 4, displayValue: "4" };
    expect(normalizeEspnNhlEvent(raw)?.homeGoals).toBe(4);
  });

  test("statut lu depuis `competitions[0]` quand `event.status` est absent", () => {
    // Le scraper NHL lit les DEUX emplacements (`scrape-nhl-schedule.mjs:238`).
    const raw = espnEvent();
    delete (raw as Record<string, unknown>).status;
    const m = normalizeEspnNhlEvent(raw);
    expect(m?.period).toBe(3);
    expect(m?.periodSecondsLeft).toBe(765);
  });

  test("prolongation : period 4 acceptée", () => {
    // `event.status` prime sur `competitions[0].status` (ordre du scraper NHL,
    // `scrape-nhl-schedule.mjs:238`) : les DEUX sont donc mis à 4.
    const otStatus = {
      displayClock: "4:30",
      period: 4,
      type: { state: "in", completed: false },
    };
    const raw = espnEvent({
      status: otStatus,
      competitions: [
        {
          competitors: [
            { homeAway: "home", score: "3", team: { displayName: "A" } },
            { homeAway: "away", score: "3", team: { displayName: "B" } },
          ],
          status: otStatus,
        },
      ],
    });
    const m = normalizeEspnNhlEvent(raw);
    expect(m?.period).toBe(4);
    expect(m?.periodSecondsLeft).toBe(270);
  });

  test("match terminé → isFinished, isLive false", () => {
    const raw = espnEvent({
      status: { displayClock: "0:00", period: 3, type: { state: "post", completed: true } },
    });
    const m = normalizeEspnNhlEvent(raw);
    expect(m?.isFinished).toBe(true);
    expect(m?.isLive).toBe(false);
  });

  test("période hors [1, 4] → null (jamais de période inventée)", () => {
    const raw = espnEvent({ status: { displayClock: "12:45", period: 0, type: { state: "in" } } });
    expect(normalizeEspnNhlEvent(raw)?.period).toBeNull();
  });

  test("sans competitors → null", () => {
    expect(normalizeEspnNhlEvent({ id: "1", competitions: [{ competitors: [] }] })).toBeNull();
    expect(normalizeEspnNhlEvent(null)).toBeNull();
    expect(normalizeEspnNhlEvent("event")).toBeNull();
  });
});

// ─── Bascule unavailable → ready ───────────────────────────────────────────

describe("adaptHockey — bascule unavailable → ready", () => {
  test("AVANT (payload historique /api/hockey/matches) → null", () => {
    // La forme réellement servie par `/api/hockey/matches` : isLive + noms,
    // aucun score, aucune période. C'est ce qui faisait « indisponible ».
    expect(adaptHockey({ id: "h1", isLive: true, homeName: "A", awayName: "B" })).toBeNull();
  });

  test("APRÈS (payload ESPN normalisé) → entrée exploitable", () => {
    const espn = normalizeEspnNhlEvent(espnEvent());
    const input = adaptHockey(espn);
    expect(input).not.toBeNull();
    expect(input?.period).toBe(3);
    expect(input?.periodSecondsLeft).toBe(765);
    expect(input?.homeScore).toBe(2);
    expect(input?.awayScore).toBe(1);
  });

  test("score présent mais période absente → null (λ serait faux)", () => {
    const espn = normalizeEspnNhlEvent(
      espnEvent({ status: { displayClock: "12:45", type: { state: "in" } } })
    );
    expect(adaptHockey(espn)).toBeNull();
  });
});

describe("buildBundle — hockey prêt", () => {
  const nhlPayload = () => ({
    matches: [normalizeEspnNhlEvent(espnEvent())],
    source: "espn-nhl",
    degraded: false,
  });

  test("bundle READY avec tous ses marchés", () => {
    const { bundle, reason } = buildBundle("hockey", nhlPayload(), "401585");
    expect(reason).toBeNull();
    expect(bundle).not.toBeNull();
    expect(bundle?.sport).toBe("hockey");
    expect(bundle?.scoreA).toBe(2);
    expect(bundle?.scoreB).toBe(1);
    expect(bundle?.clock).toBe("12:45 3e");
    expect(bundle?.markets.length).toBeGreaterThanOrEqual(4);
    // Les 4 marchés de la mission : TR, prolongation, avantage numérique, période.
    const ids = bundle?.markets.map((m) => m.id) ?? [];
    expect(ids).toContain("regulation-winner");
    expect(ids).toContain("winner-ot");
    expect(ids).toContain("power-play-goal");
    expect(ids).toContain("period-total");
  });

  test("invariant de somme 1 sur chaque marché", () => {
    const { bundle } = buildBundle("hockey", nhlPayload(), "401585");
    for (const m of bundle?.markets ?? []) {
      const sum = m.outcomes.reduce((a, o) => a + o.prob, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  test("avantage de 1 but à 12:45 de la 3e → domicile favori en TR", () => {
    const { bundle } = buildBundle("hockey", nhlPayload(), "401585");
    const home = bundle?.markets
      .find((m) => m.id === "regulation-winner")
      ?.outcomes.find((o) => o.id === "home")?.prob;
    const away = bundle?.markets
      .find((m) => m.id === "regulation-winner")
      ?.outcomes.find((o) => o.id === "away")?.prob;
    expect(home ?? 0).toBeGreaterThan(away ?? 1);
  });

  test("prolongation : issue ≥ issue TR (le nul ne disparaît pas)", () => {
    const { bundle } = buildBundle("hockey", nhlPayload(), "401585");
    const get = (id: string, o: string) =>
      bundle?.markets.find((m) => m.id === id)?.outcomes.find((x) => x.id === o)?.prob ?? 0;
    expect(get("winner-ot", "home")).toBeGreaterThanOrEqual(get("regulation-winner", "home"));
  });

  test("score plus serré à moins de temps → probabilité domicile plus forte", () => {
    const large = buildBundle("hockey", nhlPayload(), "401585").bundle;
    const serré = buildBundle(
      "hockey",
      {
        matches: [
          normalizeEspnNhlEvent(
            espnEvent({
              status: {
                displayClock: "0:15",
                period: 3,
                type: { state: "in", completed: false },
              },
            })
          ),
        ],
      },
      "401585"
    ).bundle;
    const p = (b: typeof large) =>
      b?.markets.find((m) => m.id === "regulation-winner")?.outcomes.find((o) => o.id === "home")
        ?.prob ?? 0;
    expect(p(serré)).toBeGreaterThan(p(large));
  });

  test("match sans période → indisponible AVEC la raison (pas de bundle)", () => {
    const { bundle, reason } = buildBundle(
      "hockey",
      { matches: [{ id: "h1", isLive: true, homeGoals: 1, awayGoals: 0 }] },
      "h1"
    );
    expect(bundle).toBeNull();
    expect(reason).toBeTruthy();
    expect(reason).not.toContain("archivé");
  });

  test("déterminisme : même payload → même bundle", () => {
    expect(buildBundle("hockey", nhlPayload(), "401585").bundle).toEqual(
      buildBundle("hockey", nhlPayload(), "401585").bundle
    );
  });
});

describe("degraded décrit la RÉPONSE, pas le contenu", () => {
  test("match terminé seul → PAS dégradé (état normal, aucun match en cours)", () => {
    // Un scoreboard qui répond 200 avec des matchs tous terminés est un état
    // NORMAL (journée sans direct). Le marquer « dégradé » ferait afficher une
    // panne pendant toute la journée.
    const m = normalizeEspnNhlEvent(
      espnEvent({
        status: { displayClock: "0:00", period: 3, type: { state: "post", completed: true } },
      })
    );
    expect(m?.isLive).toBe(false);
  });
});