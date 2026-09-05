"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, PiggyBank, Calculator, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Bankroll } from "@/lib/bet-manager/types";

const TABS = [
  { href: "/bankroll", label: "Tableau de bord", icon: LineChart },
  { href: "/bankroll/bets", label: "Paris", icon: PiggyBank },
  { href: "/bankroll/tools", label: "Outils", icon: Calculator },
];

type Props = {
  bankrolls: (Bankroll & { _count: { bets: number } })[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function BetManagerNav({ bankrolls, activeId, onSelect, onCreate }: Props) {
  const pathname = usePathname();
  const active = bankrolls.find((b) => b.id === activeId);

  return (
    <div className="sticky top-14 z-40 border-b border-white/5 bg-bg-deep/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-[#7B3FA0]/10 text-[#7B3FA0] ring-1 ring-emerald-500/30"
                    : "text-[#6B5B8D] hover:bg-white/5 hover:text-white"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-white/10 text-xs font-medium text-zinc-200 hover:bg-white/5"
              >
                <PiggyBank className="h-3.5 w-3.5 text-emerald-400" />
                <span className="max-w-32 truncate">{active?.name ?? "—"}</span>
                <ChevronDown className="h-3 w-3 text-[#6B5B8D]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-white/10 bg-[#101420] text-zinc-100">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-[#6B5B8D]">
                Bankrolls
              </DropdownMenuLabel>
              {bankrolls.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onClick={() => onSelect(b.id)}
                  className={cn(
                    "cursor-pointer text-sm",
                    b.id === activeId && "text-emerald-400"
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{b.name}</span>
                    <span className="font-mono text-xs text-[#6B5B8D]">
                      {b.initial.toLocaleString("fr-FR")} € · {b._count.bets} paris
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={onCreate} className="cursor-pointer text-emerald-400">
                <Plus className="mr-2 h-4 w-4" /> Nouvelle bankroll
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}