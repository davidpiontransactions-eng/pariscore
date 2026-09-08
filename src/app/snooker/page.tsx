import type { Metadata } from "next";
import { SnookerTabContent } from "@/components/snooker/snooker-tab-content";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pariscore.fr";

export const metadata: Metadata = {
  title: "PariScore Snooker — Prédictions, statistiques et paris",
  description:
    "Prédictions snooker : modèle Elo × stats CueTracker, probabilités pre-match et live, top picks 65%+, century rate, décider win rate, frames tracker. Crucible, Masters, UK Championship.",
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
      "Top picks 65%+, Elo ratings, century rate, décider win rate et tracker frames live.",
    url: `${SITE_URL}/snooker`,
    siteName: "PariScore",
    locale: "fr_FR",
    type: "website",
  },
};

export default function SnookerPage() {
  return (
    <main className="min-h-screen bg-bg-deep">
      <SnookerTabContent />
    </main>
  );
}