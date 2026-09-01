"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Clock, AlertTriangle, X, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Session Reminder — rappels responsables de gambling.
 *
 * Affiche un rappel discret après une durée configurable de session.
 * Pattern Evangelista 2026 :transparence éthique comme USP.
 *
 * Fonctionnalités :
 * - Rappel configurable (30min, 1h, 2h)
 * - Pause / reprendre le minuteur
 * - Affiche le temps de session et le nombre de paris placés
 * - Fermeture uniquement par l'utilisateur (pas de fermeture auto)
 * - Persiste dans localStorage (pas de reset au refresh)
 */

const STORAGE_KEY = "pariscore.session-reminder";
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

type ReminderState = {
  /** Timestamp du début de session */
  sessionStart: number;
  /** Intervalle entre les rappels (ms) */
  intervalMs: number;
  /** Dernier rappel affiché */
  lastReminder: number;
  /** Pause du minuteur */
  paused: boolean;
};

function loadState(): ReminderState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: ReminderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

type Props = {
  /** Nombre de paris placés cette session */
  betsPlaced?: number;
  className?: string;
};

export function SessionReminder({ betsPlaced = 0, className }: Props) {
  const t = useTranslations("responsible");
  const [state, setState] = useState<ReminderState | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Initialiser la session au premier mount
  useEffect(() => {
    const existing = loadState();
    if (existing) {
      setState(existing);
    } else {
      const newState: ReminderState = {
        sessionStart: Date.now(),
        intervalMs: DEFAULT_INTERVAL_MS,
        lastReminder: 0,
        paused: false,
      };
      saveState(newState);
      setState(newState);
    }
  }, []);

  // Timer principal — met à jour le temps écoulé
  useEffect(() => {
    if (!state || state.paused) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - state.sessionStart;
      setElapsed(elapsed);

      // Vérifier si un rappel doit s'afficher
      const timeSinceLastReminder = now - state.lastReminder;
      if (
        state.lastReminder === 0
          ? elapsed >= state.intervalMs
          : timeSinceLastReminder >= state.intervalMs
      ) {
        setShowReminder(true);
        const newState = { ...state, lastReminder: now };
        saveState(newState);
        setState(newState);
      }
    }, 10000); // check toutes les 10s

    return () => clearInterval(timer);
  }, [state]);

  const handleDismiss = useCallback(() => {
    setShowReminder(false);
  }, []);

  const handlePause = useCallback(() => {
    if (!state) return;
    const newState = { ...state, paused: true };
    saveState(newState);
    setState(newState);
  }, [state]);

  const handleResume = useCallback(() => {
    if (!state) return;
    const newState = { ...state, paused: false, lastReminder: Date.now() };
    saveState(newState);
    setState(newState);
  }, [state]);

  const handleReset = useCallback(() => {
    const newState: ReminderState = {
      sessionStart: Date.now(),
      intervalMs: DEFAULT_INTERVAL_MS,
      lastReminder: 0,
      paused: false,
    };
    saveState(newState);
    setState(newState);
    setShowReminder(false);
  }, []);

  if (!state) return null;

  const elapsedMinutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}` : `${minutes}min`;

  // Ne pas afficher le badge si paused ou si le reminder n'est pas actif
  if (!showReminder && !state.paused) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[10px] text-muted-foreground", className)}>
        <Clock className="h-3 w-3" />
        <span className="font-mono tabular-nums">{timeStr}</span>
        {state.paused ? (
          <button
            onClick={handleResume}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Reprendre"
          >
            <Play className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Mettre en pause"
          >
            <Pause className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // Rappel overlay
  return (
    <>
      {/* Badge mini dans le header */}
      <div className={cn("flex items-center gap-1.5 text-[10px] text-muted-foreground", className)}>
        <Clock className="h-3 w-3" />
        <span className="font-mono tabular-nums">{timeStr}</span>
        <button
          onClick={handlePause}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Mettre en pause"
        >
          <Pause className="h-3 w-3" />
        </button>
      </div>

      {/* Modal de rappel */}
      {showReminder && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <h3 className="text-sm font-semibold">Rappel session</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Vous êtes connecté depuis <span className="font-mono font-medium text-foreground">{timeStr}</span>.
              </p>
              {betsPlaced > 0 && (
                <p>
                  <span className="font-mono font-medium text-foreground">{betsPlaced}</span> paris placés cette session.
                </p>
              )}
              <p className="text-xs">
                Prenez le temps de vérifier que vos paris sont conformes à votre stratégie.
                Les paris impulsifs sont la première cause de perte.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Continuer
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Nouvelle session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
