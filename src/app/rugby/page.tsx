import type { Metadata } from "next";
import { RugbyTabContent } from "@/components/rugby/rugby-tab-content";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pariscore.fr";

export const metadata: Metadata = {
  title: "PariScore Rugby — Prédictions, Elo & simulations",
  description:
    "Prédictions rugby (XV et XIII) : ratings Elo dynamiques, modèle Poisson, over/under, handicap, marqueurs d'essai et simulations Monte Carlo. Top 14, Six Nations, Super Rugby, NRL et plus.",
  keywords: [
    "rugby",
    "prédiction rugby",
    "Top 14",
    "Six Nations",
    "Super Rugby",
    "NRL",
    "Elo",
    "pronostic rugby",
  ],
  alternates: { canonical: `${SITE_URL}/rugby` },
  openGraph: {
    title: "PariScore Rugby — Prédictions & simulations",
    description:
      "Ratings Elo, modèle Poisson, marqueurs d'essai et Monte Carlo pour le rugby à XV et à XIII.",
    url: `${SITE_URL}/rugby`,
    siteName: "PariScore",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RugbyPage() {
  return (
    <main className="min-h-screen bg-bg-deep">
      <RugbyTabContent />
    </main>
  );
}
