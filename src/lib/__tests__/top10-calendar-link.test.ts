import { buildTopTags, topTagsForMatch } from "@/lib/top10-calendar-link";

describe("top10-calendar-link", () => {
  const cal = (id: string, home: string, away: string, status?: string) => ({
    id, scheduledAt: "2026-09-09T18:00:00Z",
    home: { name: home }, away: { name: away },
    live: status ? { status } : null,
  }) as Parameters<typeof topTagsForMatch>[1];

  const entry = (matchId: string, home: string, away: string, value = 78) => ({
    matchId, home: { teamName: home }, away: { teamName: away }, value,
  }) as never;

  test("jointure id normalisé bsd-12 ↔ 12", () => {
    const idx = buildTopTags({ over15: [entry("12", "X", "Y")] });
    expect(topTagsForMatch(idx, cal("bsd-12", "X", "Y"))).toHaveLength(1);
  });

  test("repli noms normalisés (accents/casse)", () => {
    const idx = buildTopTags({ bttsYes: [entry("999", "Paris SG", "Marseille")] });
    expect(topTagsForMatch(idx, cal("bsd-1", "PARIS SG", "marseille"))).toHaveLength(1);
  });

  test("pas de tag sur le live (Top10 = prematch)", () => {
    const idx = buildTopTags({ over15: [entry("12", "X", "Y")] });
    expect(topTagsForMatch(idx, cal("bsd-12", "X", "Y", "LIVE"))).toHaveLength(0);
    expect(topTagsForMatch(idx, cal("bsd-12", "X", "Y", "HT"))).toHaveLength(0);
  });

  test("match inconnu → aucun tag", () => {
    const idx = buildTopTags({ over15: [entry("12", "X", "Y")] });
    expect(topTagsForMatch(idx, cal("bsd-77", "A", "B"))).toHaveLength(0);
  });

  test("strategies undefined → index vide", () => {
    expect(topTagsForMatch(buildTopTags(undefined), cal("bsd-12", "X", "Y"))).toHaveLength(0);
  });
});
