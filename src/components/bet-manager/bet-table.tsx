"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Check, X, RotateCcw, Banknote, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bet, BetStatus } from "@/lib/bet-manager/types";
import type { BetInput } from "@/lib/bet-manager/api";
import { clvEdge } from "@/lib/bet-manager/stats";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_META: Record<BetStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  won: { label: "Gagné", className: "border-[#7B3FA0]/30 bg-[#7B3FA0]/10 text-[#7B3FA0]" },
  lost: { label: "Perdu", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  void: { label: "Remboursé", className: "border-[#E0D8F0] bg-[#EDE8F5] text-[#6B5B8D]" },
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
  onSettle: (id: string, status: BetStatus, payout?: number) => void;
  onDelete: (id: string) => void;
  /** Sauvegarde des champs éditables (fiche détail) — PATCH partiel. */
  onUpdate?: (id: string, data: Partial<BetInput>) => Promise<void>;
};

/** Fiche individuelle du pari : audit + édition inline des champs modifiables. */
function BetDetailDialog({
  bet,
  onUpdate,
  onDelete,
  onClose,
}: {
  bet: Bet;
  onUpdate?: (id: string, data: Partial<BetInput>) => Promise<void>;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    matchLabel: bet.matchLabel ?? "",
    market: bet.market ?? "",
    pick: bet.pick ?? "",
    stake: String(bet.stake),
    odds: String(bet.odds),
    bookmaker: bet.bookmaker ?? "",
    competition: bet.competition ?? "",
    tipster: bet.tipster ?? "",
    category: bet.category ?? "",
    tags: bet.tags ?? "",
    note: bet.note ?? "",
    closingOdd: bet.closingOdd ? String(bet.closingOdd) : "",
    placedAt: bet.placedAt.slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const edge = clvEdge(bet);
  const profit = bet.payout !== null && bet.payout !== undefined ? bet.payout - bet.stake : null;

  const field = (key: keyof typeof form, label: string, opts: { num?: boolean; wide?: boolean } = {}) => (
    <div className={opts.wide ? "sm:col-span-2" : ""}>
      <Label className="text-[10px] text-zinc-400">{label}</Label>
      <Input
        type={opts.num ? "number" : key === "placedAt" ? "date" : "text"}
        step={opts.num ? "0.01" : undefined}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1 h-8 font-mono text-xs"
      />
    </div>
  );

  const save = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(bet.id, {
        matchLabel: form.matchLabel || undefined,
        market: form.market || undefined,
        pick: form.pick || undefined,
        stake: parseFloat(form.stake) || 0,
        odds: parseFloat(form.odds) || 0,
        bookmaker: form.bookmaker || undefined,
        competition: form.competition || undefined,
        tipster: form.tipster || undefined,
        category: form.category || undefined,
        tags: form.tags || undefined,
        note: form.note || undefined,
        closingOdd: form.closingOdd ? parseFloat(form.closingOdd) : undefined,
        placedAt: form.placedAt || undefined,
      });
      toast.success("Pari mis à jour.");
      onClose();
    } catch (err: any) {
      toast.error("Sauvegarde impossible : " + (err.message ?? "erreur"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-white/10 bg-[#101420] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {bet.matchLabel || bet.pick || "Pari"}
            <StatusBadge status={bet.status} />
          </DialogTitle>
        </DialogHeader>

        {/* Audit : dates, réf, P/L, CLV */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[11px] sm:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#6B5B8D]">Placé le</div>
            <div className="font-mono text-zinc-200">{bet.placedAt.slice(0, 10)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#6B5B8D]">Réglé le</div>
            <div className="font-mono text-zinc-200">{bet.settledAt ? bet.settledAt.slice(0, 10) : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#6B5B8D]">P/L</div>
            <div className={cn("font-mono font-semibold", profit === null ? "text-zinc-500" : profit > 0 ? "text-emerald-400" : profit < 0 ? "text-red-400" : "text-zinc-300")}>
              {profit === null ? "—" : `${profit > 0 ? "+" : ""}${fmt(profit)} €`}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#6B5B8D]">CLV</div>
            <div className={cn("font-mono", edge === null ? "text-zinc-500" : edge > 0 ? "text-emerald-400" : "text-red-400")}>
              {edge === null
                ? bet.closingOdd
                  ? "—"
                  : "pas de clôture"
                : `${edge > 0 ? "+" : ""}${(edge * 100).toFixed(2)} pts`}
            </div>
          </div>
        </div>

        {/* Édition */}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("matchLabel", "Match / Événement", { wide: true })}
          {field("market", "Marché")}
          {field("pick", "Pronostic")}
          {field("stake", "Mise (€)", { num: true })}
          {field("odds", "Cote", { num: true })}
          {field("closingOdd", "Cote de clôture", { num: true })}
          {field("placedAt", "Date de placement")}
          {field("bookmaker", "Bookmaker")}
          {field("competition", "Compétition")}
          {field("tipster", "Tipster")}
          {field("category", "Catégorie")}
          {field("tags", "Tags")}
          {field("note", "Note", { wide: true })}
        </div>

        {/* Sélections (combo) */}
        {bet.legs.length > 0 && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B5B8D]">
              Sélections ({bet.legs.length})
            </div>
            <table className="w-full text-left text-xs">
              <tbody>
                {bet.legs.map((l, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-1.5 pr-2 text-zinc-300">{l.matchLabel}</td>
                    <td className="py-1.5 pr-2 text-[#6B5B8D]">{l.market ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-zinc-300">{l.pick ?? "—"}</td>
                    <td className="py-1.5 text-right font-mono text-[#7B3FA0]">{fmt(l.odds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-500/10"
            onClick={() => {
              onDelete(bet.id);
              onClose();
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !onUpdate}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BetTable({ bets, onSettle, onDelete, onUpdate }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Cashout avec payout saisi : montant réel reçu, pas le stake forcé.
  const [cashout, setCashout] = useState<{ id: string; value: string } | null>(null);
  const [detail, setDetail] = useState<Bet | null>(null);

  const confirmCashout = (id: string, raw: string) => {
    const v = parseFloat(raw);
    onSettle(id, "cashout", v > 0 ? v : undefined);
    setCashout(null);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03]">
      <table className="w-full min-w-[600px] text-left text-xs sm:min-w-[760px]">
        <thead>
          <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#6B5B8D]">
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
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[#6B5B8D]">
                    {b.placedAt.slice(0, 10)}
                  </td>
                  <td className="max-w-56 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setDetail(b)}
                      aria-label={`Ouvrir la fiche de ${b.matchLabel || b.pick || "ce pari"}`}
                      className="block w-full truncate text-left font-medium text-zinc-200 underline-offset-2 hover:text-white hover:underline"
                      title="Ouvrir la fiche du pari"
                    >
                      {b.matchLabel || b.pick || "—"}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#6B5B8D]">
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
                    <div className="truncate text-[#6B5B8D]">{b.pick || b.market || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#7B3FA0]">{fmt(b.odds)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#7B3FA0]">{fmt(b.stake)} €</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono font-semibold",
                      profit === null
                        ? "text-zinc-600"
                        : profit > 0
                          ? "text-emerald-400"
                          : profit < 0
                            ? "text-red-400"
                            : "text-[#6B5B8D]"
                    )}
                  >
                    {profit === null ? "—" : `${profit > 0 ? "+" : ""}${fmt(profit)} €`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      {b.status === "pending" ? (
                        cashout?.id === b.id ? (
                          <div className="flex items-center gap-1">
                            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- saisie cashout, une seule ligne concerne */}
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={cashout.value}
                              aria-label="Montant reçu au cashout"
                              placeholder="Montant €"
                              onChange={(e) => setCashout({ id: b.id, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmCashout(b.id, cashout.value);
                                if (e.key === "Escape") setCashout(null);
                              }}
                              className="h-6 w-24 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 font-mono text-[11px] text-sky-200 outline-none"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-sky-400 hover:bg-sky-500/10 sm:h-6 sm:w-6"
                              title="Valider le cashout"
                              aria-label="Valider le cashout"
                              onClick={() => confirmCashout(b.id, cashout.value)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-[#6B5B8D] hover:bg-white/10 sm:h-6 sm:w-6"
                              title="Annuler"
                              aria-label="Annuler le cashout"
                              onClick={() => setCashout(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-emerald-400 hover:bg-emerald-500/10 sm:h-6 sm:w-6"
                            title="Gagné"
                            aria-label="Marquer gagné"
                            onClick={() => onSettle(b.id, "won")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-400 hover:bg-red-500/10 sm:h-6 sm:w-6"
                            title="Perdu"
                            aria-label="Marquer perdu"
                            onClick={() => onSettle(b.id, "lost")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-[#6B5B8D] hover:bg-white/10 sm:h-6 sm:w-6"
                            title="Cashout"
                            aria-label="Cashout"
                            onClick={() => setCashout({ id: b.id, value: "" })}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-[#6B5B8D] hover:bg-white/10 sm:h-6 sm:w-6"
                            title="Remboursé (void)"
                            aria-label="Rembourser"
                            onClick={() => onSettle(b.id, "void")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        )
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-[#6B5B8D] hover:bg-white/10 sm:h-6 sm:w-6"
                            aria-label="Actions"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-white/10 bg-[#101420] text-zinc-100">
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-[#6B5B8D]">
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

      {detail && (
        <BetDetailDialog
          key={detail.id}
          bet={detail}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}