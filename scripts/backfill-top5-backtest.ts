/**
 * Backfill / run quotidien du backtest « Top 5 par stratégie ».
 *
 * Usage :
 *   bun run scripts/backfill-top5-backtest.ts --sport=football --days=180
 *   bun run scripts/backfill-top5-backtest.ts --mode=daily --sport=football
 *
 * Options :
 *   --sport=football|tennis   (défaut football — tennis : bead séparé)
 *   --days=N                  profondeur du backfill (défaut 180)
 *   --mode=backfill|daily     backfill walk-forward ou cron quotidien
 *   --dry-run                 calcule sans écrire le store
 */

import { replayFootballDays, runFootballDaily } from "@/lib/top5-backtest/football";
import { replayTennisDays, runTennisDaily, TENNIS_BACKTEST_KEYS } from "@/lib/top5-backtest/tennis";
import { loadTop5Entries, upsertTop5Entries } from "@/lib/top5-backtest/store";

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v] as const;
  }),
);

async function main(): Promise<void> {
  const sport = (argv.get("sport") ?? "football") as "football" | "tennis";
  const mode = argv.get("mode") ?? "backfill";
  const days = Number(argv.get("days") ?? 180);
  const dryRun = argv.has("dry-run");
  const t0 = Date.now();
  let entries: import("@/lib/top5-backtest/types").Top5BacktestEntry[] = [];

  if (sport === "tennis") {
    if (mode === "daily") {
      const res = await runTennisDaily();
      console.log(`[daily] settled=${res.settled} snapshotted=${res.snapshotted} en ${Date.now() - t0}ms`);
      return;
    }
    entries = await replayTennisDays(days, (p) => {
      if (p.dayIndex % 20 === 0 || p.dayIndex === p.totalDays) {
        console.log(`[backfill] jour ${p.dayIndex}/${p.totalDays} (${p.dayISO}) — cumul picks +${p.nPicks}`);
      }
    });
    const wonT = entries.filter((e) => e.status === "won").length;
    const lostT = entries.filter((e) => e.status === "lost").length;
    console.log(`[backfill] ${entries.length} entrées sur ${days} jours — won=${wonT} lost=${lostT}`);
    if (dryRun) {
      for (const key of TENNIS_BACKTEST_KEYS.slice(0, 3)) {
        for (const e of entries.filter((x) => x.strategyKey === key).slice(0, 2)) {
          console.log(`  ex ${key}: ${e.kickoff.slice(0, 10)} ${e.pickDesc} val=${e.value.toFixed(1)} → ${e.status}`);
        }
      }
      return;
    }
    const resT = await upsertTop5Entries("tennis", entries);
    console.log(`[store] added=${resT.added} updated=${resT.updated} — total ${loadTop5Entries("tennis").length} entrées en ${Date.now() - t0}ms`);
    return;
  }

  if (sport !== "football") {
    console.error("[top5-backtest] sport non supporté:", sport);
    process.exit(1);
  }

  if (mode === "daily") {
    const res = await runFootballDaily();
    console.log(`[daily] settled=${res.settled} snapshotted=${res.snapshotted} en ${Date.now() - t0}ms`);
    return;
  }

  entries = await replayFootballDays(days, (p) => {
    if (p.dayIndex % 20 === 0 || p.dayIndex === p.totalDays) {
      console.log(`[backfill] jour ${p.dayIndex}/${p.totalDays} (${p.dayISO}) — cumul picks ${p.nPicks > 0 ? "+" : ""}${p.nPicks}`);
    }
  });

  const won = entries.filter((e) => e.status === "won").length;
  const lost = entries.filter((e) => e.status === "lost").length;
  const voided = entries.filter((e) => e.status === "void").length;
  console.log(`[backfill] ${entries.length} entrées sur ${days} jours — won=${won} lost=${lost} void=${voided}`);

  if (dryRun) {
    for (const key of ["bestTeam", "over15", "over65Corners"]) {
      const sample = entries.filter((e) => e.strategyKey === key).slice(0, 3);
      for (const e of sample) {
        console.log(`  ex ${key}: ${e.kickoff.slice(0, 10)} ${e.pickDesc} val=${e.value.toFixed(1)} → ${e.status} ${e.score ?? ""}`);
      }
    }
    return;
  }

  const res = await upsertTop5Entries("football", entries);
  console.log(`[store] added=${res.added} updated=${res.updated} — total ${loadTop5Entries("football").length} entrées en ${Date.now() - t0}ms`);
}

void main().catch((err) => {
  console.error("[top5-backtest] FATAL:", err);
  process.exit(1);
});
