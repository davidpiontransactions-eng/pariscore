import { NextResponse, type NextRequest } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MLB_TEAM_SEEDS } from "@/lib/baseball/registry";

export const dynamic = "force-dynamic";

const CACHE_DIR = join(process.cwd(), "public", "cache", "baseball-teams");

interface SyncResult {
  cached: string[];
  failed: string[];
  dir: string;
}

/**
 * POST /api/baseball/logos/sync
 * Synchronise les logos MLB officiels (CDN mlbstatic.com) dans le cache VPS
 * /public/cache/baseball-teams/ — le composant <TeamLogo> les sert ensuite
 * localement avec fallback SVG aux couleurs de l'équipe.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }

    const cached: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      MLB_TEAM_SEEDS.map(async (team) => {
        const url = `https://www.mlbstatic.com/team-logos/${team.mlbId}.svg`;
        const fileName = `MLB_${team.code}.svg`;
        const target = join(CACHE_DIR, fileName);
        if (existsSync(target)) {
          cached.push(fileName);
          return;
        }
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const svg = await res.text();
          if (svg.includes("<svg")) {
            writeFileSync(target, svg, "utf8");
            cached.push(fileName);
          } else {
            failed.push(fileName);
          }
        } catch {
          failed.push(fileName);
        }
      }),
    );

    const result: SyncResult = { cached, failed, dir: CACHE_DIR };
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[baseball/logos/sync]", error);
    return NextResponse.json({ ok: false, error: "Sync échouée." }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  const files = existsSync(CACHE_DIR)
    ? MLB_TEAM_SEEDS.map((t) => ({
        code: t.code,
        path: `/cache/baseball-teams/MLB_${t.code}.svg`,
        cached: existsSync(join(CACHE_DIR, `MLB_${t.code}.svg`)),
      }))
    : [];
  return NextResponse.json({ dir: CACHE_DIR, total: files.length, cached: files.filter((f) => f.cached).length, files });
}
