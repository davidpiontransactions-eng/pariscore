// GET /api/handball/h2h?home=…&away=…&limit=…
// DTO lecture seule « H2H + forme + mi-temps » pour la popup prématch
// handball (G9). Snapshot data/betexplorer_handball.json lu via fs
// (server-only), exactement comme /api/handball/players.
import { NextResponse } from "next/server";
import {
  getH2H,
  getHalftimeScores,
  getRecentForm,
  loadBetExplorerHandball,
  type BeH2H,
  type BeMatch,
  type BeScore,
} from "@/lib/betexplorer-handball";

type H2HPayload = {
  home: string;
  away: string;
  source: "betexplorer" | "none";
  scrapedAt: string | null;
  /** Confrontations directes, date desc. */
  h2h: BeH2H[];
  /** Derniers matchs terminés de chaque équipe (score + mi-temps). */
  form: { home: BeMatch[]; away: BeMatch[] };
  /** Mi-temps du dernier face-à-face terminé avec MT capturée. */
  lastHalftime: BeScore | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";
  const limitRaw = parseInt(searchParams.get("limit") ?? "5", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, limitRaw)) : 5;

  const snap = loadBetExplorerHandball();

  const h2h = getH2H(snap, home, away, limit);
  const payload: H2HPayload = {
    home,
    away,
    source: snap ? "betexplorer" : "none",
    scrapedAt: snap?.scraped_at ?? null,
    h2h,
    form: {
      home: getRecentForm(snap, home, limit),
      away: getRecentForm(snap, away, limit),
    },
    lastHalftime:
      h2h.find((m) => m.halftime !== null)?.halftime ??
      getHalftimeScores(snap, { home: { name: home }, away: { name: away } }),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=1800" },
  });
}
