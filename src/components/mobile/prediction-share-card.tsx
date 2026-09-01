"use client";

import { useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Share2, Download, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * T27 — PredictionShareCard
 *
 * Carte de prédiction partageable (Underdog-style).
 * Génère une image shareable avec le picks, les odds et le branding.
 *
 * Pattern Underdog/Betstamp :
 * - Design minimaliste avec branding ParisScore
 * - Pick principal en grand
 * - Odds et edge affichés
 * - QR code ou lien
 * - Export en image (html2canvas ou canvas natif)
 *
 * Usage :
 * <PredictionShareCard
 *   match="Sinner vs Alcaraz"
 *   pick="Sinner gagne"
 *   odds={1.85}
 *   edge={8.5}
 *   confidence={72}
 * />
 */

type Props = {
  match: string;
  pick: string;
  odds: number;
  edge?: number;
  confidence?: number;
  sport?: string;
  tournament?: string;
  className?: string;
};

export function PredictionShareCard({
  match,
  pick,
  odds,
  edge,
  confidence,
  sport = "tennis",
  tournament,
  className,
}: Props) {
  const t = useTranslations("share");
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShareNative = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ParisScore - ${pick}`,
          text: `${match}\n${pick} @ ${odds.toFixed(2)}\nEdge: ${edge?.toFixed(1) ?? "?"}%`,
          url: window.location.href,
        });
      } catch {
        // Utilisateur a annulé
      }
    }
  }, [match, pick, odds, edge]);

  const handleCopyText = useCallback(() => {
    const text = `${match}\n${pick} @ ${odds.toFixed(2)}${edge ? `\nEdge: ${edge.toFixed(1)}%` : ""}`;
    navigator.clipboard.writeText(text);
  }, [match, pick, odds, edge]);

  const handleDownloadImage = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      // Canvas natif — même si html2canvas n'est pas dispo, on génère un fallback texte
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      canvas.width = 600;
      canvas.height = 400;

      // Fond
      ctx.fillStyle = "#0a0e17";
      ctx.fillRect(0, 0, 600, 400);

      // Texte
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(match, 300, 100);

      ctx.fillStyle = "#00e676";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(pick, 300, 180);

      ctx.fillStyle = "#ffffff";
      ctx.font = "16px monospace";
      ctx.fillText(`@ ${odds.toFixed(2)}`, 300, 240);

      if (edge !== undefined) {
        ctx.fillStyle = edge > 0 ? "#00e676" : "#ff5252";
        ctx.fillText(`Edge: ${edge > 0 ? "+" : ""}${edge.toFixed(1)}%`, 300, 280);
      }

      ctx.fillStyle = "#ffffff80";
      ctx.font = "12px sans-serif";
      ctx.fillText("parisscore.fr", 300, 360);

      const link = document.createElement("a");
      link.download = `pariscore-${pick.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: copier le texte
      handleCopyText();
    }
  }, [match, pick, odds, edge, handleCopyText]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Card preview */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-xl border border-border/60 bg-[#0a0e17] p-5"
      >
        {/* Branding */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20">
              <span className="text-xs font-bold text-emerald-500">PS</span>
            </div>
            <span className="text-xs font-semibold text-white/80">ParisScore</span>
          </div>
          {tournament && (
            <span className="text-[10px] text-white/40">{tournament}</span>
          )}
        </div>

        {/* Match */}
        <div className="mb-4 text-center">
          <div className="text-sm font-medium text-white/60">{match}</div>
        </div>

        {/* Pick principal */}
        <div className="mb-4 text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Pick
          </div>
          <div className="text-xl font-bold text-white">{pick}</div>
        </div>

        {/* Métriques */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-[10px] text-white/40">Cote</div>
            <div className="font-mono text-lg font-bold text-emerald-400">
              {odds.toFixed(2)}
            </div>
          </div>

          {edge !== undefined && (
            <div className="text-center">
              <div className="text-[10px] text-white/40">Edge</div>
              <div
                className={cn(
                  "font-mono text-lg font-bold",
                  edge > 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {edge > 0 ? "+" : ""}{edge.toFixed(1)}%
              </div>
            </div>
          )}

          {confidence !== undefined && (
            <div className="text-center">
              <div className="text-[10px] text-white/40">Confiance</div>
              <div className="font-mono text-lg font-bold text-sky-400">
                {confidence}%
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <div className="text-[10px] text-white/30">
            pariscore.fr • Prédiction IA
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleShareNative}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Partager</span>
        </button>

        <button
          onClick={handleCopyText}
          className="flex items-center justify-center rounded-lg border border-border/60 px-3 py-2.5 text-muted-foreground hover:bg-muted/50 transition-colors"
          aria-label="Copier le texte"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleDownloadImage}
          className="flex items-center justify-center rounded-lg border border-border/60 px-3 py-2.5 text-muted-foreground hover:bg-muted/50 transition-colors"
          aria-label="Télécharger l'image"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
