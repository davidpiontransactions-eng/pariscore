/**
 * Sonde diagnostic — réplique exactement loadTennis() de use-sports-tree.ts
 * (fetch live + prematch → tennisToRaw → groupRawMatches) et imprime le
 * résultat à chaque étape pour localiser la perte éventuelle.
 *
 * Usage : bun scripts/diag-tennis-tree.ts [baseUrl]
 */
export {};

const BASE = process.argv[2] ?? "http://localhost:3000";

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [liveJson, prematchJson] = await Promise.all([
    getJson(`${BASE}/api/tennis/live`).catch(() => ({ matches: [] })),
    getJson(`${BASE}/api/tennis/prematch`).catch(() => ({ matches: [] })),
  ]);
  const all = [...(liveJson?.matches ?? []), ...(prematchJson?.matches ?? [])];
  console.log("[1] payload brute: live =", liveJson?.matches?.length ?? "ERR", "| prematch =", prematchJson?.matches?.length ?? "ERR", "| total =", all.length);

  const { tennisToRaw, groupRawMatches } = await import("../src/lib/sports-tree");
  const raws = tennisToRaw(all);
  console.log("[2] après tennisToRaw:", raws.length, "(filtrés:", all.length - raws.length + ")");

  const dropped = all.filter(
    (m: any) => !m?.playerA?.name || !m?.playerB?.name ||
      m.playerA.name === "" || m.playerB.name === "",
  );
  if (dropped.length) {
    console.log("    matchs filtrés (nom manquant):", dropped.slice(0, 3).map((m: any) => m.id));
  }

  const node = groupRawMatches("tennis", raws as any);
  console.log("[3] après groupRawMatches: totalMatches =", node.totalMatches,
    "| liveMatches =", node.liveMatches,
    "| pays =", node.countries.length);
  for (const c of node.countries.slice(0, 8)) {
    const n = c.leagues.reduce((s, l) => s + l.matchCount, 0);
    console.log(`    - ${c.name}: ${n} matchs / ${c.leagues.length} ligues`);
  }

  // Fenêtres temporelles (time pills) : combien survivent par fenêtre ?
  const now = Date.now();
  for (const h of [1, 2, 4, 6, 12, 24] as const) {
    const kept = (raws as any[]).filter((r) => {
      const t = Date.parse(r.scheduledAt ?? "");
      return Number.isFinite(t) && t >= now && t <= now + h * 3600_000;
    });
    const liveCount = kept.filter((r) => r.isLive).length;
    console.log(`[4] fenêtre ${h}h: ${kept.length} matchs (dont ${liveCount} live)`);
  }
}

main().catch((e) => { console.error("DIAG FAIL:", e); process.exit(1); });
