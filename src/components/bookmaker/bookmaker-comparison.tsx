"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { X, Check, Clock, ArrowUp, ArrowDown, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type BookmakerOdds = {
  bookmaker: string;
  odd: number;
  stake?: number;
  potential_payout?: number;
  is_best_odds?: boolean;
  is_fair_value?: boolean;
};

type BookmakerComparisonProps = {
  /** Match identifier */
  matchId: string;
  /** Odds from different bookmakers */
  odds: BookmakerOdds[];
  /** Fair value probability from the model (0-100) */
  fairValue: number;
  /** Odds conversion helper */
  oddToProbability: (odd: number) => number;
  /** On odds selection callback */
  onSelectOdds: (bookmaker: string, odd: number) => void;
};

/**
 * BookmakerComparison — Comparaison côte-à-cote des cotes des bookmakers.
 *
 * Affiche 3 cotes de bookmakers en colonnes avec :
 * - Cotes mises en avant (best odds) en vert
 * - Valeur équitable du modèle en gris
 * - Flèche indiquant si parier tôt ou attendre
 * - Bouton d'action pour chaque bookmaker
 */
export function BookmakerComparison({
  matchId,
  odds,
  fairValue,
  oddToProbability,
  onSelectOdds,
}: BookmakerComparisonProps) {
  const t = useTranslations("bookmaker");
  const [selected, setSelected] = useState<{ bookmaker: string; odd: number } | null>(null);

  // Trier les cotes : meilleures d'abord, puis valeur équitable
  const sortedOdds = [...odds].sort((a, b) => {
    const aIsBest = a.is_best_odds ?? false;
    const bIsBest = b.is_best_odds ?? false;
    if (aIsBest && !bIsBest) return -1;
    if (!aIsBest && bIsBest) return 1;
    // Si mêmes statut, trier par cote (la plus haute pour les gains)
    return b.odd - a.odd;
  });

  const handleSelect = (bookmaker: string, odd: number) => {
    setSelected({ bookmaker, odd });
    onSelectOdds(bookmaker, odd);
  };

  return (
    <Table responsive>
      <TableHeader>
        <TableRow>
          <TableCell className="text-sm font-semibold text-muted-foreground">
            {t("bookmaker")}
          </TableCell>
          <TableCell className="text-sm font-semibold text-muted-foreground">
            {t("odd")}
          </TableCell>
          <TableCell className="text-sm font-semibold text-muted-foreground">
            {t("potential_payout")}
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableHeader>

      <TableBody>
        {sortedOdds.map((odd, index) => (
          <TableRow key={odd.bookmaker}>
            <TableCell className="font-medium">
              {odd.bookmaker}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">
                  {odd.odd.toFixed(2)}
                </span>
                <small className="text-xs text-muted-foreground">
                  {t("decimal_format")}
                </small>
              </div>
            </TableCell>
            <TableCell>
              {odd.potential_payout !== undefined ? (
                <div className="text-lg font-bold">
                  {odd.potential_payout > 0 ? `+${odd.potential_payout}` : `${odd.potential_payout}`}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {t("unknown_payout")}
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button
                  variant={odd.is_best_odds ? "default" : "ghost"}
                  size="icon"
                  onClick={() => handleSelect(odd.bookmaker, odd.odd)}
                  title={t("select_odds", { bookmaker: odd.bookmaker })}
                  className="hover:text-primary"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {odd.is_best_odds ? t("best_odds") : t("not_best")}
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>

      <TableCaption>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{t("fair_value")}: {fairValue >= 0 ? `+${fairValue}` : fairValue}%</span>
          <span>{t("model")}</span>
        </div>
        {selected && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <ArrowRight className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            <span>{t("selected", { bookmaker: selected.bookmaker, odd: selected.odd })}</span>
          </div>
        )}
      </TableCaption>
    </Table>
  );
}