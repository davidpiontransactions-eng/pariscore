import type { Metadata } from "next";
import { ResultsClient } from "@/components/results/results-client";

export const metadata: Metadata = {
  title: "Résultats de matchs — PariScore",
  description:
    "Résultats des matchs terminés avec scores finaux, ligues et dates – tous sports",
  keywords: ["résultats", "matchs", "scores", "ligues", "football", "tennis", "basketball"],
};

export default function ResultsPage() {
  return <ResultsClient />;
}