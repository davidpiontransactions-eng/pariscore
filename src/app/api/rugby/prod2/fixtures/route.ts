import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/prod2/fixtures
 * Récupère les fixtures Pro D2 depuis le widget Idalgo Rugbyrama.
 * Source gratuite, pas de clé API requise.
 */

interface ProD2Match {
  id: string;
  date: string;
  time: string;
  status: "scheduled" | "inprogress" | "finished";
  home: { name: string; logo: string };
  away: { name: string; logo: string };
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
}

const IDALGO_URL =
  "https://www.rugbyrama.fr/idalgo/cache/page/rugby_widget_result.php?refProvider=0&refCompetition=7";

/** Logos Pro D2 — chargés depuis data/prod2-logos.json à chaque requête */
function loadLogos(): Record<string, string> {
  try {
    const logosPath = join(process.cwd(), "data", "prod2-logos.json");
    return JSON.parse(readFileSync(logosPath, "utf-8"));
  } catch {
    return {};
  }
}

const TEAM_NAME_MAP: Record<string, string> = {
  "Aurillac": "Aurillac",
  "Brive": "Brive",
  "Nice": "Nice",
  "Grenoble": "Grenoble",
  "Colomiers": "Colomiers",
  "Dax": "Dax",
  "Montauban": "Montauban",
  "Béziers": "Béziers",
  "BÃ©ziers": "Béziers",
  "Bï¿½ziers": "Béziers",
  "Narbonne": "Narbonne",
  "Angoulême": "Angoulême",
  "AngoulÃªme": "Angoulême",
  "Angoul&ecirc;me": "Angoulême",
  "Nevers": "Nevers",
  "Biarritz": "Biarritz",
  "Valence Romans": "Valence Romans",
  "Provence Rugby": "Provence Rugby",
  "Agen": "Agen",
  "Oyonnax": "Oyonnax",
  "Rouen": "Rouen",
  "Soyaux-Angoulême": "Soyaux-Angoulême",
  "SA XV": "Soyaux-Angoulême",
};

const MONTH_MAP: Record<string, number> = {
  janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
};

function parseWidgetText(text: string): ProD2Match[] {
  const matches: ProD2Match[] = [];
  const TEAM_LOGOS = loadLogos();

  // Normaliser l'encodage des caractères
  const normalize = (s: string) => {
    // Remplacer les entités HTML
    let result = s
      .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&agrave;/g, "à")
      .replace(/&ocirc;/g, "ô").replace(/&ccedil;/g, "ç").replace(/&ecirc;/g, "ê")
      .replace(/&iuml;/g, "ï").replace(/&icirc;/g, "î").replace(/&euml;/g, "ë")
      .replace(/&uuml;/g, "ü").replace(/&ucirc;/g, "û").replace(/&acirc;/g, "â")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

    // Remplacer les caractères mal encodés (UTF-8 → Latin-1)
    const replacements: [string, string][] = [
      ["Ã©", "é"], ["Ã¨", "è"], ["Ã ", "à"], ["Ã´", "ô"], ["Ã»", "û"],
      ["Ã¢", "â"], ["Ã§", "ç"], ["Ãª", "ê"], ["Ã«", "ë"], ["Ã¯", "ï"],
      ["Ã®", "î"], ["Ã¼", "ü"], ["Ã¹", "ù"], ["Ã‰", "É"], ["Ãˆ", "È"],
      ["Ã€", "À"], ["Ã'", "Ô"], ["Ã›", "Û"], ["Ã‚", "Â"], ["Ã‡", "Ç"],
      ["ÃŠ", "Ê"], ["Ã‹", "Ë"], ["ÃЏ", "Ï"], ["ÃŽ", "Î"], ["Ãœ", "Ü"],
      ["Ã™", "Ù"],
    ];
    for (const [from, to] of replacements) {
      result = result.split(from).join(to);
    }

    return result.trim();
  };

  // Le widget retourne du HTML — extraire le texte des spans/divs
  const htmlText = text
    // Décoder les entités HTML nommées
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&icirc;/g, "î")
    .replace(/&ccedil;/g, "ç")
    .replace(/&euml;/g, "ë")
    .replace(/&uuml;/g, "ü")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // Supprimer les balises HTML
    .replace(/<[^>]+>/g, "\n")
    // Décoder les entités numériques
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  const lines = htmlText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentDate = "";
  let currentYear = new Date().getFullYear();
  let i = 0;

  // Skip until first date line
  while (
    i < lines.length &&
    !lines[i].match(
      /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+\d{1,2}\s+\w+/i
    )
  ) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Date: "Jeudi 17 septembre 2026"
    const dateMatch = line.match(
      /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?$/i
    );
    if (dateMatch) {
      const [, , dayStr, monthName, yearStr] = dateMatch;
      if (yearStr) currentYear = parseInt(yearStr, 10);
      const month = MONTH_MAP[monthName.toLowerCase()] || 1;
      currentDate = `${currentYear}-${String(month).padStart(2, "0")}-${String(parseInt(dayStr, 10)).padStart(2, "0")}`;
      i++;
      continue;
    }

    // Time: "19:30" or minute: "64'"
    const timeMatch = line.match(/^(\d{1,2}:\d{2})$/);
    const minuteMatch = line.match(/^(\d+)'$/);

    if (timeMatch || minuteMatch) {
      const time = timeMatch ? timeMatch[1] : "";
      const minute = minuteMatch ? parseInt(minuteMatch[1], 10) : null;

      // Next lines: home, score (possibly split as "28" "-" "29"), away
      if (i + 3 < lines.length) {
        let homeRaw = lines[i + 1];
        let scoreRaw = lines[i + 2];
        let awayRaw = lines[i + 3];
        let consumed = 4; // base: time + home + score + away

        // Handle split score: "28" "-" "29" → merge to "28-29"
        if (
          i + 4 < lines.length &&
          scoreRaw.match(/^\d+$/) &&
          lines[i + 3] === "-" &&
          lines[i + 4]?.match(/^\d+$/)
        ) {
          scoreRaw = `${scoreRaw}-${lines[i + 4]}`;
          awayRaw = lines[i + 5] || "";
          consumed = 6;
        }

        // Skip if next line looks like another date or a section header
        if (
          homeRaw.match(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+\d/) ||
          homeRaw.match(/^(Voir|Classement|Résultats|Pro D2)/i)
        ) {
          i++;
          continue;
        }

        // Mapper les noms d'équipes (gère les problèmes d'encodage)
        const homeName = TEAM_NAME_MAP[homeRaw] || normalize(homeRaw);
        const awayName = TEAM_NAME_MAP[awayRaw] || normalize(awayRaw);

        // Debug encoding
        if (homeRaw.includes("ziers") || awayRaw.includes("ziers") || homeRaw.includes("oul") || awayRaw.includes("oul")) {
          console.log("[prod2/fixtures] Name debug:", { homeRaw, homeName, awayRaw, awayName });
        }

        const scoreMatch = scoreRaw.match(/^(\d+)\s*-\s*(\d+)$/);
        const isPending = scoreRaw === "-";

        let status: ProD2Match["status"] = "scheduled";
        let homeScore: number | null = null;
        let awayScore: number | null = null;

        if (scoreMatch) {
          homeScore = parseInt(scoreMatch[1], 10);
          awayScore = parseInt(scoreMatch[2], 10);
          status = minute != null && minute > 0 ? "inprogress" : "finished";
        }

        if (!currentDate || !awayName || awayName === "-") {
          i += consumed;
          continue;
        }

        const homeSlug = homeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const awaySlug = awayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        matches.push({
          id: `prod2-${currentDate}-${homeSlug}-${awaySlug}`,
          date: currentDate,
          time,
          status,
          home: { name: homeName, logo: TEAM_LOGOS[homeName] || "" },
          away: { name: awayName, logo: TEAM_LOGOS[awayName] || "" },
          homeScore,
          awayScore,
          minute,
        });

        i += consumed;
        continue;
      }
    }

    i++;
  }

  return matches;
}

export async function GET() {
  try {
    const res = await fetch(IDALGO_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/plain, */*",
        "Accept-Charset": "utf-8",
        Referer: "https://www.rugbyrama.fr/",
        Origin: "https://www.rugbyrama.fr",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Idalgo widget returned ${res.status}` },
        { status: 502 }
      );
    }

    // Forcer le décodage UTF-8
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    const matches = parseWidgetText(text);

    // Debug: dump the cleaned text to see what the parser works with
    const cleaned = text
      .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&agrave;/g, "à")
      .replace(/&ocirc;/g, "ô").replace(/&ucirc;/g, "û").replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, "\n").replace(/&#x27;/g, "'").replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 10)));
    const debugText = cleaned.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0).slice(0, 30);

    return NextResponse.json(
      {
        competition: "pro-d2",
        name: "Pro D2",
        country: "France",
        matches,
        fetchedAt: new Date().toISOString(),
        source: "rugbyrama-idalgo",
        _debug: { rawLength: text.length, cleanedLines: debugText },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[rugby/prod2/fixtures]", error);
    return NextResponse.json(
      { error: "Pro D2 data unavailable — retry later." },
      { status: 502 }
    );
  }
}
