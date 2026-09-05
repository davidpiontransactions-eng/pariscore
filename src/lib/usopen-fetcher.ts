// US Open Schedule Fetcher — fallback when BSD API doesn't have today's matches
// Source: usopen.org Schedule of Play page
// Returns matches in the format expected by the tennis prematch API

const US_OPEN_SCHEDULE_URL =
  "https://www.usopen.org/en_US/scores/schedule/index.html";

function parseUsOpenDate(isoDate: string): string {
  // usopen.org returns dates like "September 5" or "Sep 5"
  // Convert to ISO date string for comparison
  const monthMap: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const lower = isoDate.toLowerCase();
  for (const [month, num] of Object.entries(monthMap)) {
    if (lower.includes(month)) {
      // Extract day number
      const dayMatch = isoDate.match(/(\d+)(?:st|nd|rd|th)?/);
      const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
      const year = new Date().getFullYear();
      // usopen.org is current year, but we check if we're past Sept
      // For simplicity, always use current year; if date has passed, use next year
      const date = new Date(year, num, day);
      // If the date has already passed this year, use next year
      if (date < new Date()) {
        date.setFullYear(year + 1);
      }
      return date.toISOString().split("T")[0];
    }
  }
  return "";
}

export interface UsOpenMatch {
  id: string;
  playerA: string;
  playerB: string;
  scheduledAt: string;
  status: "live" | "scheduled" | "finished";
  tournament: string;
  round: string;
  court?: string;
  gender?: "men" | "women";
}

export async function fetchUsOpenMatches(): Promise<UsOpenMatch[]> {
  try {
    const res = await fetch(US_OPEN_SCHEDULE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
      // Timeout after 10 seconds
      timeout: 10000,
    });

    if (!res.ok) {
      console.error("[usopen] Failed to fetch schedule:", res.status);
      return [];
    }

    const html = await res.text();

    // Simple HTML parsing - extract match data from the schedule
    // The usopen.org schedule has specific HTML structure we need to parse
    const matches: UsOpenMatch[] = [];

    // Extract match information from HTML
    // Look for match entries in the schedule
    const matchSections = html.match(/Day \d[^<]*?<\/p>/gi) || [];

    for (const section of matchSections) {
      // Extract court/stadium name
      const courtMatch = section.match(/Arthur Ashe Stadium|Louis Armstrong Stadium|Court \d+/);
      const court = courtMatch ? courtMatch[0] : undefined;

      // Extract time
      const timeMatch = section.match(/(\d+:\d+)\s*(AM|PM)/);
      const time = timeMatch ? `${timeMatch[1]} ${timeMatch[2]}` : undefined;

      // Extract players and seeds - this is simplified parsing
      // The actual HTML structure is complex, so we extract what we can
      const playerMatches = section.match(/[A-Z][a-z]+ [A-Z][a-z]+(?: \([^)]*\))?/g) || [];

      if (playerMatches.length >= 2) {
        const playerA = playerMatches[0].replace(/[0-9\[\]]/g, "").trim();
        const playerB = playerMatches[1].replace(/[0-9\[\]]/g, "").trim();

        if (playerA && playerB && playerA !== playerB) {
          // Determine gender from context or default to men
          const genderMatch = section.match(/Men's|Women's/);
          const gender = genderMatch ? (section.includes("Women's") ? "women" : "men") : "men";

          // Determine round from context
          const roundMatch = section.match(/R[1-4]|Round [1-4]/);
          const round = roundMatch ? roundMatch[0] : "R3";

          // Determine status
          const statusMatch = section.match(/In Progress|Completed|Upcoming|Not before/);
          const status =
            statusMatch?.includes("In Progress") || section.includes("In Progress")
              ? "live"
              : statusMatch?.includes("Completed") || section.includes("Completed")
              ? "finished"
              : statusMatch?.includes("Upcoming") || section.includes("Upcoming")
              ? "scheduled"
              : "scheduled";

          matches.push({
            id: `usopen-${Math.random().toString(36).substr(2, 9)}`,
            playerA,
            playerB,
            scheduledAt: new Date().toISOString(), // Will be filtered by the adapter
            status,
            tournament: "US Open 2026",
            round,
            court,
            gender,
          });
        }
      }
    }

    // If we got matches, return them; otherwise return empty (caller will fall through)
    if (matches.length > 0) {
      console.log(
        `[usopen] Found ${matches.length} matches from official schedule`,
      );
      return matches;
    }

    // No matches found in HTML - this could mean the page structure changed
    // or there are no matches for today
    console.log("[usopen] No matches found in schedule HTML");
    return [];
  } catch (err) {
    console.error("[usopen] Error fetching schedule:", (err as Error).message);
    return [];
  }
}

export async function fetchUsOpenTodayMatches(): Promise<any[]> {
  // Fetch US Open matches and filter for today's matches
  const allMatches = await fetchUsOpenMatches();

  if (allMatches.length === 0) {
    return [];
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Filter matches scheduled for today
  const todayMatches = allMatches.filter((m) => {
    const matchDate = new Date(m.scheduledAt);
    return matchDate.toISOString().split("T")[0] === today;
  });

  // If no matches for today, return all (caller can decide)
  if (todayMatches.length === 0) {
    console.log(
      "[usopen] No matches for today (", today, "), returning all (",
      allMatches.length,
      ")",
    );
    return allMatches;
  }

  console.log(
    `[usopen] Found ${todayMatches.length} matches for ${today}`,
  );
  return todayMatches;
}