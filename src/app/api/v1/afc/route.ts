import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * AFC Champions League data — GET /api/v1/afc?competition=elite|two|index
 *
 * Source : scripts/scrape-afc-champions.py → public/data/afc/
 * Données FotMob scrapées via scrapling (stealth).
 *
 * Paramètres :
 *   - competition: "elite" | "two" | "index" (défaut: "index")
 *
 * Réponse : JSON brut du fichier correspondant.
 */

const AFC_DATA_DIR = join(process.cwd(), "public", "data", "afc");

const ALLOWED = new Set(["elite", "two", "index"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get("competition") ?? "index";

  if (!ALLOWED.has(competition)) {
    return NextResponse.json(
      { error: `competition invalide: ${competition}. Valeurs: elite, two, index` },
      { status: 400 },
    );
  }

  try {
    const filePath = join(AFC_DATA_DIR, `${competition}.json`);
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: "Données AFC non disponibles. Lancez: python scripts/scrape-afc-champions.py" },
        { status: 404 },
      );
    }
    throw err;
  }
}
