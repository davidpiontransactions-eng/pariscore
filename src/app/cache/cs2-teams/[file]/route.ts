import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

/**
 * Serveur statique de secours pour /cache/cs2-teams/.
 *
 * Le navigateur Next standalone ne sert que la copie de public/ figée au build :
 * les logos téléchargés au runtime vivent dans public/cache/cs2-teams/ à la
 * racine du projet — cette route sert ces fichiers frais (et ceux copiés au
 * build quand la route est atteinte en dev). Anti-traversal + nosniff + cache
 * 24h (les logos sont quasi immuables).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  if (!file || path.basename(file) !== file) {
    return new NextResponse(null, { status: 400 });
  }
  const p = path.join(process.cwd(), "public", "cache", "cs2-teams", file);
  try {
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).toLowerCase();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}