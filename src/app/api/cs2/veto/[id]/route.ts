import { NextResponse } from "next/server";

/**
 * GET /api/cs2/veto/[id]
 * Séquence veto/map-picks réelle d'un match BSD (20s TTL côté service).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "match id requis" }, { status: 400 });
  }

  try {
    const cs2Service = require("../../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;
    const veto = await cs2Service.fetchMatchVeto(id, key);

    if (!veto) {
      return NextResponse.json({ veto: null, note: "veto indisponible (match sans map_picks ou endpoint absent)" });
    }
    return NextResponse.json({ veto });
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 veto unavailable", details: (err as Error).message },
      { status: 503 },
    );
  }
}
