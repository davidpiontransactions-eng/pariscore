import type { Metadata } from "next";
import { FootballCalendar } from "@/components/football/football-calendar";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pariscore.fr";

export const metadata: Metadata = {
  title: "PariScore Football — Calendrier des matchs & prédictions",
  description:
    "Calendrier football : matchs en direct, à venir et terminés par ligue, avec prédictions 1X2, BTTS et over/under.",
  alternates: { canonical: `${SITE_URL}/calendrier-foot` },
  openGraph: {
    title: "PariScore Football — Calendrier & prédictions",
    url: `${SITE_URL}/calendrier-foot`,
    siteName: "PariScore",
  },
};

export default function CalendrierFootPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <FootballCalendar />
    </main>
  );
}