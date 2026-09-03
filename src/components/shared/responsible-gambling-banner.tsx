"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ShieldAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Bannière responsible gambling — affichée en bas de page.
 * Non intrusif : dismissable, rappelle le message i18n "footer.responsible".
 * Conforme aux guidelines éthiques Pariscore (pas de dark pattern).
 */
export function ResponsibleGamblingBanner() {
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem("rg-banner-dismissed") === "1");
    } catch {
      /* SSR / private browsing */
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("rg-banner-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-3",
        "border-t border-white/[0.06] bg-[#0a0e17]/90 backdrop-blur-md",
        "px-4 py-2.5 text-[11px] text-slate-400",
      )}
      role="note"
      aria-label="Avertissement responsible gambling"
    >
      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden />
      <span className="max-w-md text-center leading-snug">
        {t("footer.responsible", {
          defaultValue: "Pariez de manière responsable. 18+",
        })}
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="ml-2 shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-slate-300"
        aria-label="Fermer le rappel"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
