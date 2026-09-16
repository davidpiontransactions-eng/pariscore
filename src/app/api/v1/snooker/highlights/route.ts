import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/v1/snooker/highlights?q=Player+A+vs+Player+B+snooker+highlights
 * Recherche YouTube pour des highlights et retourne le premier résultat.
 * Pas de clé API YouTube requise — utilise l'embed oEmbed.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  try {
    // Recherche YouTube via scraping du HTML de recherche
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();

    // Extraire les video IDs du HTML (pattern: "videoId":"..." dans le JSON embedded)
    const videoIds: string[] = [];
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      if (!videoIds.includes(match[1])) videoIds.push(match[1]);
      if (videoIds.length >= 5) break;
    }

    if (videoIds.length === 0) {
      return NextResponse.json({ videos: [] });
    }

    // Récupérer les métadonnées via oEmbed (pas de clé API)
    const videos = await Promise.all(
      videoIds.slice(0, 3).map(async (id) => {
        try {
          const oembed = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
            { next: { revalidate: 86400 } }
          );
          if (!oembed.ok) return { id, title: "Highlights", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
          const data = await oembed.json();
          return {
            id,
            title: data.title ?? "Highlights",
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: data.author_name ?? "",
          };
        } catch {
          return { id, title: "Highlights", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
        }
      })
    );

    return NextResponse.json({ videos });
  } catch (err) {
    return NextResponse.json({ videos: [], error: String(err) });
  }
}
