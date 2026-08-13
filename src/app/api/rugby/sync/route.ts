import { NextResponse } from "next/server";
import { runFullSync } from "@/lib/rugby/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/rugby/sync
 * Force une resynchronisation complète (ESPN → ratings → prédictions).
 * Protégée par la clé d'environnement RUGBY_SYNC_KEY (header x-sync-key) :
 * une resync déclenche ~100 appels ESPN sortants — elle ne doit pas être
 * déclenchable par n'importe qui (risque de rate-limit Akamai global).
 * GET renvoie un message d'aide.
 */
export async function POST(request: Request) {
  const expected = process.env.RUGBY_SYNC_KEY;
  if (expected) {
    const provided = request.headers.get("x-sync-key") ?? "";
    let ok = provided.length === expected.length;
    if (ok) {
      for (let i = 0; i < provided.length; i++) {
        if (provided.charCodeAt(i) !== expected.charCodeAt(i)) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      return NextResponse.json(
        { error: "Clé de synchronisation invalide (header x-sync-key)." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const result = await runFullSync();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      hint: "Envoyez une requête POST avec le header x-sync-key pour forcer une resynchronisation rugby.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}