"use client";

// Emprunt banque (bead v1v8) : montant/date/durée persistés en localStorage —
// lecture seule au mount, écriture à chaque setLoan. amount = 0 = inactif.
import { useCallback, useEffect, useState } from "react";
import { LOAN_STORAGE_KEY, type BankLoan } from "@/lib/bet-manager/plan";

const EMPTY: BankLoan = { amount: 0, startDate: "", days: 0 };

export function useBankLoan(): { loan: BankLoan; setLoan: (l: BankLoan) => void } {
  const [loan, setLoanState] = useState<BankLoan>(EMPTY);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOAN_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (
        saved &&
        typeof saved === "object" &&
        typeof saved.amount === "number" &&
        typeof saved.startDate === "string" &&
        typeof saved.days === "number"
      ) {
        setLoanState({ amount: saved.amount, startDate: saved.startDate, days: saved.days });
      }
    } catch {
      /* sauvegarde corrompue → pas d'emprunt */
    }
  }, []);

  const setLoan = useCallback((l: BankLoan) => {
    setLoanState(l);
    try {
      if (l.amount > 0) localStorage.setItem(LOAN_STORAGE_KEY, JSON.stringify(l));
      else localStorage.removeItem(LOAN_STORAGE_KEY);
    } catch {
      /* quota */
    }
  }, []);

  return { loan, setLoan };
}
