import { notFound } from "next/navigation";
import { TournamentView } from "@/components/tennis/tournament-view";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Tournament page — destination of the future TournamentSearchBar (Phase 8).
 *
 * Route: /tennis/tournament/[slug]
 *
 * The slug is derived from the tournament name (URL-friendly). Server
 * Component — data fetching happens inside TournamentView (client) via the
 * /api/tennis/tournament/[slug] route (TODO Phase 8).
 *
 * For now this is a placeholder skeleton. The view component will be wired
 * to real data once the API lands.
 */
export default async function TournamentPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  return <TournamentView slug={slug} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const displayName = slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  return {
    title: `${displayName} — Tableau & matchs | SetPoint`,
    description: `Matchs en direct, résultats et à venir pour ${displayName}.`,
    robots: { index: true, follow: true },
  };
}
