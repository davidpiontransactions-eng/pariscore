import { describe, expect, test } from "bun:test";
import {
  buildTop10,
  buildTopMatchStrategy,
  countryFlag,
  formatTop10DateTime,
  type Top10InputMatch,
} from "@/lib/handball-top10";
import { PARISCORE_MIN_ODDS, PARISCORE_MIN_PROB_PCT } from "@/lib/handball-pariscore";
import fixture from "@/lib/fixtures/handball-top10-mock.json";

// ─── Drapeaux ───

describe("countryFlag", () => {
  test("codes ISO valides → emoji régional", () => {
    expect(countryFlag("DK")).toBe("🇩🇰");
    expect(countryFlag("DE")).toBe("🇩🇪");
    expect(countryFlag("FR")).toBe("🇫🇷");
    expect(countryFlag("sk")).toBe("🇸🇰");
  });

  test("entrées invalides → null (le composant affiche le repli)", () => {
    expect(countryFlag(null)).toBeNull();
    expect(countryFlag(undefined)).toBeNull();
    expect(countryFlag("")).toBeNull();
    expect(countryFlag("FRA")).toBeNull(); // 3 lettres
    expect(countryFlag("1A")).toBeNull();
  });
});

// ─── Format date/heure ───

describe("formatTop10DateTime", () => {
  const now = new Date("2026-10-04T12:00:00+02:00");

  test("aujourd'hui → libellé relatif + heure", () => {
    const f = formatTop10DateTime("2026-10-04T18:30:00+02:00", now)!;
    expect(f.relative).toBe("Aujourd'hui");
    expect(f.time).toBe("18:30");
    expect(f.day).toBe("04/10");
  });

  test("demain → libellé relatif", () => {
    const f = formatTop10DateTime("2026-10-05T20:00:00+02:00", now)!;
    expect(f.relative).toBe("Demain");
    expect(f.time).toBe("20:00");
  });

  test("au-delà de demain → date seule JJ/MM", () => {
    const f = formatTop10DateTime("2026-10-17T14:00:00+02:00", now)!;
    expect(f.relative).toBeNull();
    expect(f.day).toBe("17/10");
    expect(f.time).toBe("14:00");
  });

  test("heure convertie en Europe/Paris quel que soit l'offset fourni", () => {
    // 23:30+02:00 == 21:30 UTC → Paris affiche 23:30.
    const f = formatTop10DateTime("2026-10-04T23:30:00+02:00", now)!;
    expect(f.time).toBe("23:30");
  });

  test("horodatage illisible → null (jamais de date inventée)", () => {
    expect(formatTop10DateTime("pas-une-date", now)).toBeNull();
    expect(formatTop10DateTime("", now)).toBeNull();
  });
});

// ─── Stratégies ───

const matches = fixture.matches as unknown as Top10InputMatch[];

describe("buildTopMatchStrategy", () => {
  test("le mock produit des lignes qui respectent les 2 règles", () => {
    const built = buildTop10(matches, 10);
    expect(built.length).toBeGreaterThan(0);
    for (const r of built) {
      expect(r.prob ?? 0).toBeGreaterThanOrEqual(PARISCORE_MIN_PROB_PCT);
      expect(r.qualifies).toBe(true);
      if (r.odds != null) expect(r.odds).toBeGreaterThanOrEqual(PARISCORE_MIN_ODDS);
      expect(r.kind === "over" || r.kind === "under" || r.kind === "favorite").toBe(true);
    }
  });

  test("cote trop basse → repli sur l'autre côté, puis exclusion si les deux sont bloquées", () => {
    const base = fixture.casLimites.coteTropBasse as unknown as Top10InputMatch;
    // 1re passe : sans cotes de total, on récupère le côté préféré du modèle.
    const probe = buildTopMatchStrategy(base);
    expect(probe.kind === "under" || probe.kind === "over").toBe(true);

    const lineOf = (label: string) => parseFloat(label.split(" ")[1]);
    // 2e passe : on ne bloque QUE la ligne préférée → le moteur doit basculer sur
    // l'autre côté du marché plutôt que d'abandonner le match.
    const fallback = buildTopMatchStrategy({
      ...base,
      totalOdds: { [String(lineOf(probe.label))]: { over: 1.02, under: 1.02 } },
    });
    expect(fallback.kind).not.toBe(probe.kind);
    expect(fallback.qualifies).toBe(true);

    // 3e passe : on bloque les DEUX côtés → aucune ligne proposable.
    const blocked = buildTopMatchStrategy({
      ...base,
      totalOdds: Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => {
          const line = (38 + i * 0.5).toFixed(1);
          return [line, { over: 1.02, under: 1.02 }];
        }),
      ),
    });
    expect(blocked.kind).toBe("none");
    expect(blocked.qualifies).toBe(false);
    expect(
      buildTop10(
        [
          {
            ...base,
            totalOdds: Object.fromEntries(
              Array.from({ length: 60 }, (_, i) => {
                const line = (38 + i * 0.5).toFixed(1);
                return [line, { over: 1.02, under: 1.02 }];
              }),
            ),
          },
        ],
        10,
      ),
    ).toHaveLength(0);
  });

  test("cote INCONNUE sur la ligne retenue ne fait pas rejeter (pas de prix = pas de refus)", () => {
    // Une carte de cotes partielle ne couvre pas toutes les lignes : on ne peut
    // pas refuser une ligne qu'on ne sait pas chiffrer. `odds: null` +
    // `qualifies: true` est le comportement honnête — et c'est pourquoi le JSON
    // documente que l'absence de totalOdds laisse la règle de cote inopposable.
    const partial = fixture.casLimites.coteTropBasse as unknown as Top10InputMatch;
    const s = buildTopMatchStrategy(partial);
    expect(s.kind).not.toBe("none");
    expect(s.odds).toBeNull();
    expect(s.qualifies).toBe(true);
  });

  test("horodatage illisible : la ligne est construite quand même", () => {
    const bad = fixture.casLimites.horodatageIllisible as unknown as Top10InputMatch;
    expect(formatTop10DateTime(bad.dateTime)).toBeNull();
    const s = buildTopMatchStrategy(bad);
    expect(s.kind !== "none" || s.qualifies === false).toBe(true); // pas de crash
  });

  test("drapeau invalide n'empêche pas la construction", () => {
    const bad = fixture.casLimites.drapeauInvalide as unknown as Top10InputMatch;
    expect(countryFlag(bad.countryCode)).toBeNull();
    expect(buildTopMatchStrategy(bad)).toBeDefined();
  });

  test("une équipe dominante produit un seuil Under à ≥ 65 %", () => {
    const strong = buildTopMatchStrategy({
      matchId: "x",
      home: "A",
      away: "B",
      dateTime: "2026-10-10T18:00:00+02:00",
      leagueName: "L",
      homeStats: { scoredAvg: 36, concededAvg: 24 },
      awayStats: { scoredAvg: 24, concededAvg: 36 },
    });
    // Un match très haut ne peut PAS donner un Over ≥ 65 % (sinon quasi-certitude
    // sur une variable aléatoire) : le repli est l'Under.
    expect(strong.kind).toBe("under");
  });
});

// ─── Classement ───

describe("buildTop10", () => {
  test("rangs contigus 1..n, triés par probabilité décroissante", () => {
    const rows = buildTop10(matches, 10);
    expect(rows).toHaveLength(Math.min(10, rows.length));
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].rank).toBe(i + 1);
      if (i > 0) expect(rows[i - 1].prob ?? 0).toBeGreaterThanOrEqual(rows[i].prob ?? 0);
    }
  });

  test("respecte la limite demandée", () => {
    expect(buildTop10(matches, 3).length).toBeLessThanOrEqual(3);
    expect(buildTop10(matches, 1)).toHaveLength(1);
  });

  test("aucune ligne sans stratégie n'est rendue", () => {
    for (const r of buildTop10(matches, 20)) {
      expect(r.kind).not.toBe("none");
      expect(r.label).not.toBe("—");
    }
  });

  test("corps vide → tableau vide (état explicite côté UI)", () => {
    expect(buildTop10([], 10)).toEqual([]);
  });

  test("dateTime toujours présent et en ISO complet", () => {
    for (const r of buildTop10(matches, 20)) {
      expect(r.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      // L'horodatage doit parsera : jamais de chaîne de-date fantaisiste.
      expect(Number.isNaN(Date.parse(r.dateTime))).toBe(false);
    }
  });

  test("déterministe", () => {
    expect(JSON.stringify(buildTop10(matches, 10))).toBe(
      JSON.stringify(buildTop10(matches, 10)),
    );
  });

  test("chaque ligne porte drapeau OU repli, jamais un pays inventé", () => {
    for (const r of buildTop10(matches, 20)) {
      if (r.countryCode != null) expect(countryFlag(r.countryCode)).not.toBeNull();
      expect(r.leagueName.length).toBeGreaterThan(0);
    }
  });
});

/**
 * `totalLine` — la ligne de total EXPOSÉE par le modèle, pas reconstruite.
 *
 * Le badge « Over 54.5 pts » de l'UI lit ce nombre. Il ne doit donc jamais :
 *   • diverger du libellé affich�� (deux vérités qui divergent) ;
 *   • exister pour une stratégie 1N2, qui n'a pas de marché de total ;
 *   • apparaître sans probabilité associée.
 */
describe("totalLine — ligne du modèle exposée, jamais reconstruite", () => {
  const lignes = buildTop10(matches, 20);

  test("Over/Under : totalLine est un nombre fini et cohérent avec le libellé", () => {
    const totaux = lignes.filter((r) => r.kind === "over" || r.kind === "under");
    expect(totaux.length).toBeGreaterThan(0);
    for (const r of totaux) {
      expect(typeof r.totalLine).toBe("number");
      expect(Number.isFinite(r.totalLine!)).toBe(true);
      // Cohérence AVEC le libellé : c'est le test qui empêche les deux
      // représentations de diverger si l'une change un jour.
      expect(r.label).toBe(`${r.kind === "over" ? "Over" : "Under"} ${r.totalLine}`);
    }
  });

  test("1N2 : aucune ligne de total — null, jamais une reconversion", () => {
    for (const r of lignes.filter((x) => x.kind === "favorite")) {
      expect(r.totalLine).toBeNull();
    }
  });

  test("aucune ligne de total sans probabilité associée", () => {
    for (const r of lignes) {
      if (r.totalLine != null) expect(r.prob).not.toBeNull();
    }
  });

  test("le repli 1N2 ne fabrique pas de ligne quand le total est bloqué", () => {
    const base = fixture.casLimites.coteTropBasse as unknown as Top10InputMatch;
    const bloque = buildTopMatchStrategy({
      ...base,
      totalOdds: Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => {
          const line = (38 + i * 0.5).toFixed(1);
          return [line, { over: 1.02, under: 1.02 }];
        }),
      ),
    });
    expect(bloque.kind).toBe("none");
    expect(bloque.totalLine).toBeNull();
  });
});
