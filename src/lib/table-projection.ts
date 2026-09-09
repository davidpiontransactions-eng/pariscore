import { buildScoreMatrix, marketsFromMatrix } from "./prediction/football/poisson";

type Team = { id: string; name: string; played: number; points: number; gf: number; ga: number };
type Fixture = { homeId: string; awayId: string };

export type SimResult = {
  expPts: number;
  best: number;
  worst: number;
  titleProb: number;
  top4Prob: number;
  relegProb: number;
  expRank: number;
};

type FinalStanding = { id: string; pts: number; gd: number; gf: number };

const BTW = 2.70;

function sampleMatch(homeXg: number, awayXg: number): { hp: number; ap: number } {
  const mx = buildScoreMatrix(homeXg, awayXg, 8);
  const m = marketsFromMatrix(mx);
  const r = Math.random();
  const hw = m.homeWin / 100, dr = m.draw / 100;
  if (r < hw) return { hp: 3, ap: 0 };
  if (r < hw + dr) return { hp: 1, ap: 1 };
  return { hp: 0, ap: 3 };
}

function rankStanding(rows: FinalStanding[]): FinalStanding[] {
  return [...rows].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

export function simulateTable(
  teams: Team[],
  fixtures: Fixture[],
  n = 2000
): Record<string, SimResult> {
  const base = new Map(teams.map((t) => [t.id, { ...t }]));
  const totalTeams = teams.length;

  const agg = new Map<string, { ptsSum: number; best: number; worst: number; count: number; ranks: number[] }>();
  for (const t of teams) agg.set(t.id, { ptsSum: 0, best: totalTeams, worst: 1, count: 0, ranks: [] });

  for (let i = 0; i < n; i++) {
    const pts = new Map(teams.map((t) => [t.id, base.get(t.id)!.points]));

    for (const f of fixtures) {
      const ht = base.get(f.homeId);
      const at = base.get(f.awayId);
      if (!ht || !at) continue;
      const hEff = (ht.gf / Math.max(ht.played, 1)) * (at.ga / Math.max(at.played, 1)) * BTW;
      const aEff = (at.gf / Math.max(at.played, 1)) * (ht.ga / Math.max(ht.played, 1)) * BTW;
      const { hp, ap } = sampleMatch(hEff, aEff);
      pts.set(f.homeId, (pts.get(f.homeId) ?? 0) + hp);
      pts.set(f.awayId, (pts.get(f.awayId) ?? 0) + ap);
    }

    const standing: FinalStanding[] = teams.map((t) => ({
      id: t.id,
      pts: pts.get(t.id) ?? 0,
      gd: (base.get(t.id)!.gf - base.get(t.id)!.ga),
      gf: base.get(t.id)!.gf,
    }));
    const sorted = rankStanding(standing);

    for (let pos = 0; pos < sorted.length; pos++) {
      const id = sorted[pos].id;
      const a = agg.get(id)!;
      a.ptsSum += sorted[pos].pts;
      a.best = Math.min(a.best, pos + 1);
      a.worst = Math.max(a.worst, pos + 1);
      a.ranks.push(pos + 1);
      a.count++;
    }
  }

  const out: Record<string, SimResult> = {};
  for (const t of teams) {
    const a = agg.get(t.id)!;
    const titleCount = a.ranks.filter((r) => r === 1).length;
    const top4Count = a.ranks.filter((r) => r <= 4).length;
    const relegCount = a.ranks.filter((r) => r === totalTeams).length;
    const c = Math.max(a.count, 1);
    const avgRank = a.ranks.length > 0 ? a.ranks.reduce((s, r) => s + r, 0) / a.ranks.length : totalTeams;
    out[t.id] = {
      expPts: Math.round(a.ptsSum / c * 10) / 10,
      best: a.best,
      worst: a.worst,
      expRank: avgRank,
      titleProb: Math.round(titleCount / c * 1000) / 1000,
      top4Prob: Math.round(top4Count / c * 1000) / 1000,
      relegProb: Math.round(relegCount / c * 1000) / 1000,
    };
  }
  return out;
}

export function trajectory(
  results: { round: number; homeId: string; awayId: string; hs: number; as: number }[],
  teamIds: string[]
): Record<string, number[]> {
  const sorted = [...results].sort((a, b) => a.round - b.round);
  const pts = new Map(teamIds.map((id) => [id, 0]));
  const gd = new Map(teamIds.map((id) => [id, 0]));
  const gf = new Map(teamIds.map((id) => [id, 0]));
  const out = new Map(teamIds.map((id) => [id, [] as number[]]));

  for (const r of sorted) {
    pts.set(r.homeId, (pts.get(r.homeId) ?? 0) + (r.hs > r.as ? 3 : r.hs === r.as ? 1 : 0));
    pts.set(r.awayId, (pts.get(r.awayId) ?? 0) + (r.as > r.hs ? 3 : r.hs === r.as ? 1 : 0));
    gd.set(r.homeId, (gd.get(r.homeId) ?? 0) + r.hs - r.as);
    gd.set(r.awayId, (gd.get(r.awayId) ?? 0) + r.as - r.hs);
    gf.set(r.homeId, (gf.get(r.homeId) ?? 0) + r.hs);
    gf.set(r.awayId, (gf.get(r.awayId) ?? 0) + r.as);

    const snap: FinalStanding[] = teamIds.map((id) => ({
      id, pts: pts.get(id) ?? 0, gd: gd.get(id) ?? 0, gf: gf.get(id) ?? 0,
    }));
    const ranked = rankStanding(snap);
    for (let i = 0; i < ranked.length; i++) out.get(ranked[i].id)!.push(i + 1);
  }

  const res: Record<string, number[]> = {};
  for (const id of teamIds) res[id] = out.get(id) ?? [];
  return res;
}
