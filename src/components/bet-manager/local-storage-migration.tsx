"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const LEGACY_KEY = "setpoint-bankroll";
const MIGRATED_FLAG = "bm-migrated-setpoint";

type LegacyBet = {
  id: string;
  playerA: string;
  playerB: string;
  betOnName: string;
  stake: number;
  odd: number;
  status: string;
  placedAt: string;
};

/**
 * Bandeau de migration : détecte l'ancien module localStorage (setpoint-bankroll,
 * tennis) et propose l'import vers la base du Bet Manager. Une fois migré, un
 * flag localStorage empêche de re-proposer.
 */
export function LocalStorageMigration({ onMigrated }: { onMigrated?: () => void }) {
  const [legacy, setLegacy] = useState<{ initial: number; bets: LegacyBet[] } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(MIGRATED_FLAG)) return;
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.bets) && parsed.bets.length > 0) {
        setLegacy({ initial: parsed.initial ?? 1000, bets: parsed.bets });
      }
    } catch {
      /* localStorage corrompu — ignorer */
    }
  }, []);

  const migrate = useCallback(async () => {
    if (!legacy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/bm/import/local-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: legacy,
          bankrollName: "Bankroll migrée (ancien module)",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur inconnue");
      localStorage.setItem(MIGRATED_FLAG, String(Date.now()));
      toast.success(`${json.imported} paris migrés vers la base 🎉`);
      setLegacy(null);
      onMigrated?.();
    } catch (err: any) {
      toast.error("Migration échouée : " + (err.message ?? "erreur inconnue"));
    } finally {
      setBusy(false);
    }
  }, [legacy, onMigrated]);

  if (!legacy || dismissed) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
          <ArrowRightLeft className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {legacy.bets.length} pari{legacy.bets.length > 1 ? "s" : ""} trouvé{legacy.bets.length > 1 ? "s" : ""} dans l'ancien module
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            L'ancien suivi (localStorage navigateur, tennis) peut être migré vers la base de données
            du Bet Manager — bankroll « {legacy.initial.toLocaleString("fr-FR")} € », historique complet.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 text-xs text-zinc-400 hover:bg-white/5"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" /> Plus tard
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-sky-500 text-sky-950 hover:bg-sky-400"
          onClick={migrate}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
          Migrer vers la base
        </Button>
      </div>
    </div>
  );
}