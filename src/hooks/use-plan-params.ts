"use client";

// Paramètres du plan (+20 %/j) chargés depuis localStorage — lecture seule
// pour le dashboard (colonne Retard + graphique objectif). La page
// /bankroll/plan reste propriétaire de l'écriture (PLAN_STORAGE_KEY partagé).
import { useEffect, useState } from "react";
import { PLAN_DEFAULTS, PLAN_STORAGE_KEY, type PlanParams } from "@/lib/bet-manager/plan";

export function usePlanParams(): PlanParams {
  const [params, setParams] = useState<PlanParams>(PLAN_DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        setParams((p) => {
          const next = { ...p };
          for (const k of Object.keys(PLAN_DEFAULTS) as (keyof PlanParams)[]) {
            if (saved[k] !== undefined && typeof saved[k] === typeof PLAN_DEFAULTS[k]) {
              (next as Record<string, unknown>)[k] = saved[k];
            }
          }
          return next;
        });
      }
    } catch {
      /* sauvegarde corrompue → défauts */
    }
  }, []);

  return params;
}
