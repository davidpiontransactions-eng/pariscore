"use client";

import { useState, useEffect } from "react";
import {
  loadBets,
  updateBetStatus,
  removeBet,
  getStats,
  type TrackedBet,
} from "@/lib/snooker/bet-tracker";

export function BetTrackerPanel() {
  const [bets, setBets] = useState<TrackedBet[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setBets(loadBets());
  }, []);

  const stats = getStats(bets);

  if (bets.length === 0) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#00985f] px-4 py-2.5 text-[11px] font-bold text-white shadow-lg transition-all hover:bg-[#007a4d] hover:shadow-xl active:scale-95 md:bottom-6 md:right-6"
        style={{
          boxShadow: "0 4px 20px rgba(0,152,95,0.3)",
        }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
        {stats.pending}
        {stats.totalPnl !== 0 && (
          <span className={`tabular-nums ${stats.totalPnl > 0 ? "text-emerald-200" : "text-red-200"}`}>
            {stats.totalPnl > 0 ? "+" : ""}{stats.totalPnl.toFixed(1)}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={() => setIsOpen(false)}>
          <div
            className="mx-0 max-h-[80vh] sm:max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white sm:mx-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">Mes paris suivis</h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-gray-100" aria-label="Fermer">
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-4 gap-2 border-b border-gray-50 bg-gray-50/50 px-4 py-3">
              {[
                { label: "Total", value: stats.total, color: "#374151" },
                { label: "En cours", value: stats.pending, color: "#f59e0b" },
                { label: "Gagnés", value: stats.won, color: "#10b981" },
                { label: "Perdus", value: stats.lost, color: "#ef4444" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* P&L + Win Rate */}
            <div className="flex items-center justify-around border-b border-gray-50 bg-gray-50/50 px-4 py-2">
              <div className="text-center">
                <div className={`text-sm font-bold tabular-nums ${stats.totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(2)} units
                </div>
                <div className="text-[9px] text-gray-500">P&L total</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-bold tabular-nums ${stats.roi >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                </div>
                <div className="text-[9px] text-gray-500">ROI</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold tabular-nums text-gray-700">{stats.winRate}%</div>
                <div className="text-[9px] text-gray-500">Win rate</div>
              </div>
            </div>

            {/* Bet list */}
            <div className="divide-y divide-gray-50">
              {bets.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  Aucun pari suivi. Cliquez sur « Suivre » pour commencer.
                </div>
              ) : (
                bets.map((bet) => (
                  <div key={bet.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-gray-800">{bet.match}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-[#00985f]">{bet.selection}</span>
                        <span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[10px] text-gray-500">{bet.probability.toFixed(1)}%</span>
                        {bet.odds && (
                          <>
                            <span className="text-[10px] text-gray-400">·</span>
                            <span className="text-[10px] text-gray-500">@{bet.odds.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {bet.status === "pending" ? (
                        <>
                          <button
                            onClick={() => {
                              const pnl = bet.odds ? bet.odds - 1 : 1;
                              updateBetStatus(bet.id, "won", pnl);
                              setBets(loadBets());
                            }}
                            className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-600 hover:bg-emerald-100"
                          >
                            W
                          </button>
                          <button
                            onClick={() => {
                              updateBetStatus(bet.id, "lost", -1);
                              setBets(loadBets());
                            }}
                            className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-bold text-red-600 hover:bg-red-100"
                          >
                            L
                          </button>
                          <button
                            onClick={() => {
                              removeBet(bet.id);
                              setBets(loadBets());
                            }}
                            className="rounded-full bg-gray-50 px-2 py-1 text-[9px] text-gray-400 hover:bg-gray-100"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            bet.status === "won"
                              ? "bg-emerald-500 text-white"
                              : bet.status === "lost"
                              ? "bg-red-500 text-white"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {bet.status === "won" ? `+${(bet.pnl ?? 0).toFixed(1)}` : bet.status === "lost" ? `${(bet.pnl ?? 0).toFixed(1)}` : "V"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
