import type { Metadata } from "next";
import { resolveLeagueIds } from "@/lib/league-id-bridge";
import { leagueXgRanking } from "@/lib/football-xg";
import LeagueDetailPage from "./page";

type Props = {
  params: Promise<{ country: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const ids = resolveLeagueIds(`${country}/${slug}`);

  const name = ids?.info?.name ?? slug.replace(/-/g, " ");
  const countryName = ids?.info?.country ?? country.replace(/-/g, " ");

  // Données xG pour meta description
  let desc = `Classement, stats et joueurs de ${name} (${countryName}).`;
  try {
    const xg = leagueXgRanking(ids?.slug ?? "", "2025");
    if (xg && xg.length > 0) {
      const top = xg[0] as { team: string; xgFor: number };
      desc += ` Leader xG : ${top.team} (${top.xgFor.toFixed(2)}).`;
    }
  } catch {
    // pas grave
  }

  // Sources disponibles
  const sources: string[] = [];
  if (ids?.hasBsd) sources.push("BSD");
  if (ids?.hasFbref) sources.push("FBref");
  if (ids?.hasUnderstat) sources.push("Understat");

  return {
    title: `${name} - Classement & Stats | PariScore`,
    description: desc,
    openGraph: {
      title: `${name} - PariScore`,
      description: desc,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name} - PariScore`,
      description: desc,
    },
  };
}

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
