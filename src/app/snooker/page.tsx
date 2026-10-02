import type { Metadata } from "next";
import { SnookerTabContent } from "@/components/snooker/snooker-tab-content";
import { SportPageSync } from "@/components/layout/sport-page-sync";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pariscore.fr";

export const metadata: Metadata = {
  title: "PariScore Snooker — Prédictions, statistiques et paris",
  description:
    "Prédictions snooker : modèle Elo validé à 61,5 % de précision, probabilités pre-match et live, century rate, décider win rate, frames tracker. Crucible, Masters, UK Championship.",
  keywords: [
    "snooker",
    "prédiction snooker",
    "Crucible",
    "Masters",
    "UK Championship",
    "Ronnie O'Sullivan",
    "Judd Trump",
    "pronostic snooker",
    "Paris sportifs snooker",
  ],
  alternates: { canonical: `${SITE_URL}/snooker` },
  openGraph: {
    title: "PariScore Snooker — Prédictions & statistiques live",
    description:
      "Modèle Elo validé à 61,5 % de précision, century rate, décider win rate et tracker frames live.",
    url: `${SITE_URL}/snooker`,
    siteName: "PariScore",
    locale: "fr_FR",
    type: "website",
  },
};

export default function SnookerPage() {
  return (
    <main className="min-h-screen bg-bg-deep">
      {/* Positionne selectedSportId → header « Snooker » actif + rangée de
          sous-onglets rendue (sinon early return, et les vues Résultats /
          Backtesting restent inaccessibles). */}
      <SportPageSync sport="snooker" />
      <SnookerTabContent />
    </main>
  );
}