"use client";

import { LayoutGrid, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useAnalytics } from "@/components/analytics-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Header toggle that flips between the beginner-friendly "simple" layout
 * (photos + probability rings) and the dense "terminal" power-user layout
 * (no photos, sparklines enlarged, decomposition + IC always visible,
 * stats chips always expanded, tighter padding, denser grid).
 *
 * Sits next to the other ghost-icon toggles in the page header. When
 * terminal mode is ON the icon turns emerald so the user always knows
 * which layout is active. The flag is persisted by `useTerminalMode`
 * under `setpoint-terminal-mode` and synced across tabs.
 *
 * Each toggle fires a PostHog `terminal_mode_toggled` event carrying the
 * new mode so we can later correlate engagement / bet CTR against the
 * chosen layout.
 */
export function TerminalToggle() {
  const t = useTranslations("terminal");
  const { terminalMode, toggle } = useTerminalMode();
  const { track } = useAnalytics();

  const handleClick = () => {
    const next = !terminalMode;
    toggle();
    track("terminal_mode_toggled", {
      terminal_mode: next,
      mode: next ? "terminal" : "simple",
    });
  };

  const tooltipText = terminalMode ? t("simpleMode") : t("terminalMode");

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label={t("toggle")}
            aria-pressed={terminalMode}
            title={t("tooltip")}
            className={cn(
              "relative",
              terminalMode &&
                "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            )}
          >
            {terminalMode ? (
              <Terminal className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
            {terminalMode && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
