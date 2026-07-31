import { StatsLeaderboard } from "@/components/tennis/stats-leaderboard";

/**
 * Page leaderboard statistiques joueurs — inspirée de l'ATP Tour Stats
 * Leaderboard (boards Service / Retour / Sous pression, filtres surface,
 * période, niveau d'adversaire).
 *
 * Route : /tennis/stats
 * Données : /api/tennis/stats-leaderboard (agrégation tennis_matches_internal).
 * Server Component — toute la donnée est fetchée côté client via SWR.
 */
export default function TennisStatsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <StatsLeaderboard />
    </main>
  );
}

export function generateMetadata() {
  return {
    title: "Statistiques joueurs — Leaderboard ATP/WTA | SetPoint",
    description:
      "Classements statistiques tennis type ATP : Serve Rating, Return Rating, " +
      "Under Pressure Rating, par surface et par période.",
    robots: { index: true, follow: true },
  };
}
