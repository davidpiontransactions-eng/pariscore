"use client";

import { useState } from "react";
import { MoreHorizontal, Check, X, RotateCcw, Banknote, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bet, BetStatus } from "@/lib/bet-manager/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_META: Record<BetStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  won: { label: "Gagné", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  lost: { label: "Perdu", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  void: { label: "Remboursé", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400" },
  cashout: { label: "Cashout", className: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
};

function StatusBadge({ status }: { status: BetStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={cn("border px-1.5 py-0 font-mono text-[10px]", meta.className)}>
      {meta.label}
    </Badge>
  );
}

type Props = {
  bets: Bet[];
  onSettle: (id: string, status: BetStatus) => void;
  onDelete: (id: string) => void;
};

export function BetTable({ bets, onSettle, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03]">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500">
            <th className="px-3 py-2.5 font-semibold">Date</th>
            <th className="px-3 py-2.5 font-semibold">Pari</th>
            <th className="px-3 py-2.5 font-semibold">Marché</th>
            <th className="px-3 py-2.5 text-right font-semibold">Cote</th>
            <th className="px-3 py-2.5 text-right font-semibold">Mise</th>
            <th className="px-3 py-2.5 text-right font-semibold">P/L</th>
            <th className="px-3 py-2.5 text-center font-semibold">Statut</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {bets.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-zinc-600">
                Aucun pari. Ajoute ton premier pari ci-dessus.
              </td>
            </tr>
          ) : (
            bets.map((b) => {
              const profit = b.payout !== null && b.payout !== undefined ? b.payout - b.stake : null;
              return (
                <tr
                  key={b.id}
                  className="group border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500">
                    {b.placedAt.slice(0, 10)}
                  </td>
                  <td className="max-w-56 px-3 py-2.5">
                    <div className="truncate font-medium text-zinc-200">{b.matchLabel || b.pick || "—"}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="uppercase">{b.sport}</span>
                      {b.bookmaker ? <span>· {b.bookmaker}</span> : null}
                      {b.tipster ? <span>· {b.tipster}</span> : null}
                      {b.betType !== "single" ? (
                        <span className="rounded bg-emerald-500/10 px-1 py-px font-mono uppercase text-emerald-400">
                          {b.betType}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="truncate text-zinc-400">{b.pick || b.market || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{fmt(b.odds)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{fmt(b.stake)} €</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono font-semibold",
                      profit === null
                        ? "text-zinc-600"
                        : profit > 0
                          ? "text-emerald-400"
                          : profit < 0
                            ? "text-red-400"
                            : "text-zinc-500"
                    )}
                  >
                    {profit === null ? "—" : `${profit > 0 ? "+" : ""}${fmt(profit)} €`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {b.status === "pending" ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-emerald-400 hover:bg-emerald-500/10"
                            title="Gagné"
                            onClick={() => onSettle(b.id, "won")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-400 hover:bg-red-500/10"
                            title="Perdu"
                            onClick={() => onSettle(b.id, "lost")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:bg-white/10"
                            title="Cashout"
                            onClick={() => onSettle(b.id, "cashout")}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-500 hover:bg-white/10"
                            title="Remboursé (void)"
                            onClick={() => onSettle(b.id, "void")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-500 hover:bg-white/10"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-white/10 bg-[#101420] text-zinc-100">
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-500">
                            Actions
                          </DropdownMenuLabel>
                          {b.status === "pending" ? (
                            <>
                              <DropdownMenuItem onClick={() => onSettle(b.id, "won")} className="cursor-pointer">
                                <Check className="mr-2 h-4 w-4 text-emerald-400" /> Marquer gagné
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onSettle(b.id, "lost")} className="cursor-pointer">
                                <X className="mr-2 h-4 w-4 text-red-400" /> Marquer perdu
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onSettle(b.id, "void")} className="cursor-pointer">
                                <RotateCcw className="mr-2 h-4 w-4" /> Remboursé (void)
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => onSettle(b.id, "pending")} className="cursor-pointer">
                              <RotateCcw className="mr-2 h-4 w-4" /> Remettre en attente
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-white/10" />
                          <DropdownMenuItem
                            className="cursor-pointer text-red-400"
                            onClick={() => {
                              if (confirmId === b.id) {
                                onDelete(b.id);
                                setConfirmId(null);
                              } else {
                                setConfirmId(b.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {confirmId === b.id ? "Confirmer ?" : "Supprimer"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}