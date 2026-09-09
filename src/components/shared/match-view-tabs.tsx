"use client";

import { useCallback, useId, useRef } from "react";
import { Radio, CalendarClock, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MatchViewMode } from "@/lib/match-view";

type Props = {
  active: MatchViewMode;
  onChange: (mode: MatchViewMode) => void;
  liveCount: number;
  prematchCount: number;
  idBase?: string;
  className?: string;
};

/* Teintes FotMob clair — identiques au calendrier */
const C = {
  bg: "#ffffff",
  border: "#f0f0f0",
  tabBg: "#f5f5f5",
  tabActiveBg: "#ffffff",
  text: "#222222",
  muted: "#717171",
  live: "#00985f",
  prematch: "#717171",
  rankings: "#717171",
} as const;

export function MatchViewTabs({
  active,
  onChange,
  liveCount,
  prematchCount,
  idBase,
  className,
}: Props) {
  const t = useTranslations("matchTabs");
  const liveRef = useRef<HTMLButtonElement>(null);
  const prematchRef = useRef<HTMLButtonElement>(null);
  const fallbackId = useId();
  const tabIdBase = idBase ?? fallbackId;

  const tabs: Array<{
    id: MatchViewMode;
    label: string;
    aria: string;
    count: number;
    ref: React.RefObject<HTMLButtonElement | null>;
    icon: typeof Radio;
    badgeBg: string;
  }> = [
    {
      id: "live",
      label: t("live"),
      aria: t("liveAria", { n: liveCount }),
      count: liveCount,
      ref: liveRef,
      icon: Radio,
      badgeBg: C.live,
    },
    {
      id: "prematch",
      label: t("prematch"),
      aria: t("prematchAria", { n: prematchCount }),
      count: prematchCount,
      ref: prematchRef,
      icon: CalendarClock,
      badgeBg: C.muted,
    },
    {
      id: "rankings",
      label: t("rankings", { defaultValue: "Classements" }),
      aria: t("rankingsAria", { defaultValue: "Classements" }),
      count: 0,
      ref: useRef<HTMLButtonElement>(null),
      icon: BarChart3,
      badgeBg: C.muted,
    },
  ];

  const activate = useCallback(
    (id: MatchViewMode) => {
      if (id !== active) onChange(id);
    },
    [active, onChange],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const current = active === "live" ? "live" : "prematch";
    let next: MatchViewMode;
    if (event.key === "Home") next = "live";
    else if (event.key === "End") next = "prematch";
    else next = current === "live" ? "prematch" : "live";
    activate(next);
    (next === "live" ? liveRef : prematchRef).current?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("tabsAriaLabel")}
      onKeyDown={onKeyDown}
      className={cn(
        "flex w-full gap-1 overflow-x-auto scroll-snap-x rounded-lg p-1",
        className,
      )}
      style={{ background: C.tabBg, border: `1px solid ${C.border}` }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            id={`${tabIdBase}-${tab.id}`}
            ref={tab.ref}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={tab.aria}
            aria-controls={`${tabIdBase}-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => activate(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            )}
            style={{
              background: isActive ? C.tabActiveBg : "transparent",
              color: isActive ? C.text : C.muted,
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
              ...(isActive ? { ["--tw-ring-color" as string]: C.live } : {}),
            }}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span>{tab.label}</span>
            <span
              aria-hidden
              className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[11px] font-bold tabular-nums"
              style={{
                background: tab.count > 0
                  ? isActive ? tab.badgeBg : `${C.muted}30`
                  : `${C.muted}20`,
                color: tab.count > 0
                  ? isActive ? "#ffffff" : C.muted
                  : `${C.muted}70`,
              }}
            >
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
