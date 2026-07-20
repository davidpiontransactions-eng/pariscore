import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/tennis/player-profile-view";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Player profile page — destination of the future PlayerSearchBar (Phase 8).
 *
 * Route: /tennis/player/[slug]
 *
 * The slug matches `player.id` (lowercased name with underscores, see
 * `src/lib/tennis-data.ts`). Server Component — all data fetching happens
 * inside PlayerProfileView (client) via the player-stats API.
 *
 * TODO (Phase 8): replace placeholder with real data wiring once the
 * /api/tennis/player/[slug] route is implemented.
 */
export default async function PlayerPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  return <PlayerProfileView slug={slug} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const displayName = slug
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  return {
    title: `${displayName} — Profil ATP/WTA | SetPoint`,
    description: `Statistiques, forme récente, Elo surface et SPS de ${displayName}.`,
    robots: { index: true, follow: true },
  };
}
