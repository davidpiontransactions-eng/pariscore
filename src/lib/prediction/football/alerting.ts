/**
 * Système d'alerting pour la dégradation des performances du modèle.
 *
 * Vérifie périodiquement le drift via `detectDrift`, déclenche des alertes
 * via webhook (Slack/Discord), email (SMTP existant), et console.
 *
 * Cooldown : ne pas re-alert pour le même drift pendant 24h (mémoire in-memory).
 */

import { detectDrift, type DriftDetectionResult } from "./drift-detection";
import { sendEmail } from "@/lib/email/send";
import type { PredictionLog } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertLevel = "warning" | "critical";

export type AlertPayload = {
  level: AlertLevel;
  message: string;
  metrics: {
    markets: DriftDetectionResult["metrics"];
    recentCount: number;
    baselineCount: number;
  };
  timestamp: string;
};

type CooldownEntry = {
  lastAlerted: number;
  level: AlertLevel;
};

// ---------------------------------------------------------------------------
// État interne (in-memory)
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 heures
const cooldowns = new Map<string, CooldownEntry>();
const recentAlerts: AlertPayload[] = [];
const MAX_RECENT_ALERTS = 100;

let lastChecked: string | null = null;

// ---------------------------------------------------------------------------
// Clé de cooldown (basée sur les marchés driftés)
// ---------------------------------------------------------------------------

function buildCooldownKey(metrics: DriftDetectionResult["metrics"]): string {
  return metrics
    .filter((m) => m.significant)
    .map((m) => m.market)
    .sort()
    .join(",");
}

function isInCooldown(key: string, level: AlertLevel): boolean {
  if (key === "") return false; // pas de drift = pas de cooldown
  const entry = cooldowns.get(key);
  if (!entry) return false;
  // Sortir du cooldown si le niveau a augmenté (warning → critical)
  if (level === "critical" && entry.level === "warning") return false;
  return Date.now() - entry.lastAlerted < COOLDOWN_MS;
}

function markCooldown(key: string, level: AlertLevel): void {
  if (key === "") return;
  cooldowns.set(key, { lastAlerted: Date.now(), level });
}

// ---------------------------------------------------------------------------
// Canaux d'envoi
// ---------------------------------------------------------------------------

/**
 * Envoi via webhook (Slack/Discord compatible).
 * POST au DRIFT_WEBHOOK_URL si défini.
 */
async function sendWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.DRIFT_WEBHOOK_URL;
  if (!url) return;

  const emoji = payload.level === "critical" ? "🚨" : "⚠️";
  const body = {
    text: `${emoji} **${payload.level.toUpperCase()}** — ${payload.message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${payload.level.toUpperCase()}* — Drift détecté\n${payload.message}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Marchés driftés*\n${payload.metrics.markets.filter((m) => m.significant).map((m) => m.market.toUpperCase()).join(", ") || "aucun"}`,
          },
          {
            type: "mrkdwn",
            text: `*Échantillon récent*\n${payload.metrics.recentCount} matchs`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `PariScore drift alert — ${payload.timestamp}`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[drift-alert] webhook failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("[drift-alert] webhook error:", err);
  }
}

/**
 * Envoi via email (infrastructure Nodemailer existante).
 * Adresse destinataire : DRIFT_EMAIL_TO ou fallback console.
 */
async function sendEmailAlert(payload: AlertPayload): Promise<void> {
  const to = process.env.DRIFT_EMAIL_TO;
  if (!to) return;

  const emoji = payload.level === "critical" ? "🚨" : "⚠️";
  const driftedMarkets = payload.metrics.markets
    .filter((m) => m.significant)
    .map((m) => `${m.market.toUpperCase()}: Brier ${m.baselineBrier} → ${m.recentBrier} (+${m.drift})`)
    .join("\n");

  const subject = `${emoji} PariScore — Drift ${payload.level.toUpperCase()} détecté`;
  const text = [
    `Alerte drift PariScore`,
    ``,
    `Niveau : ${payload.level.toUpperCase()}`,
    `${payload.message}`,
    ``,
    `Détails par marché :`,
    driftedMarkets || "Aucun marché drifté",
    ``,
    `Échantillon : ${payload.metrics.recentCount} matchs récents vs ${payload.metrics.baselineCount} baseline`,
    ``,
    `Timestamp : ${payload.timestamp}`,
  ].join("\n");

  await sendEmail({ to, subject, text });
}

/**
 * Toujours logger en console (canal obligatoire).
 */
function sendConsole(payload: AlertPayload): void {
  const emoji = payload.level === "critical" ? "🚨" : "⚠️";
  console.log(`[drift-alert] ${emoji} ${payload.level.toUpperCase()}: ${payload.message}`);
  for (const m of payload.metrics.markets.filter((m) => m.significant)) {
    console.log(
      `[drift-alert]   ${m.market.toUpperCase()}: Brier ${m.baselineBrier} → ${m.recentBrier} (+${m.drift})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Fonction d'envoi multi-canal
// ---------------------------------------------------------------------------

/**
 * Envoie une alerte via tous les canaux disponibles (webhook, email, console).
 */
export async function sendAlert(alert: AlertPayload): Promise<void> {
  // Console toujours
  sendConsole(alert);

  // Webhook + email en parallèle
  await Promise.allSettled([sendWebhook(alert), sendEmailAlert(alert)]);

  // Stocker dans l'historique récent
  recentAlerts.unshift(alert);
  if (recentAlerts.length > MAX_RECENT_ALERTS) {
    recentAlerts.length = MAX_RECENT_ALERTS;
  }
}

// ---------------------------------------------------------------------------
// Vérification périodique
// ---------------------------------------------------------------------------

/**
 * Vérifie le drift et déclenche des alertes si nécessaire.
 *
 * @param recent   - logs de la période récente (ex: 7 derniers jours)
 * @param baseline - logs de la période de référence (ex: 90 jours)
 * @returns Résultat du drift + alerte envoyée ou non
 */
export async function checkAndAlert(
  recent: PredictionLog[],
  baseline: PredictionLog[],
): Promise<{
  drift: DriftDetectionResult;
  alerted: boolean;
  lastChecked: string;
}> {
  const result = detectDrift(recent, baseline);
  lastChecked = new Date().toISOString();

  if (!result.drifted) {
    return { drift: result, alerted: false, lastChecked };
  }

  // Déterminer le niveau d'alerte
  const maxDrift = Math.max(...result.metrics.map((m) => m.drift));
  const level: AlertLevel = maxDrift > 0.05 ? "critical" : "warning";

  // Vérifier le cooldown
  const cooldownKey = buildCooldownKey(result.metrics);
  if (isInCooldown(cooldownKey, level)) {
    return { drift: result, alerted: false, lastChecked };
  }

  // Construire le payload
  const driftedMarkets = result.metrics
    .filter((m) => m.significant)
    .map((m) => `${m.market.toUpperCase()} (+${m.drift})`)
    .join(", ");

  const payload: AlertPayload = {
    level,
    message: `Drift détecté sur ${driftedMarkets}. ${result.summary}`,
    metrics: {
      markets: result.metrics,
      recentCount: recent.filter((l) => l.settled).length,
      baselineCount: baseline.filter((l) => l.settled).length,
    },
    timestamp: new Date().toISOString(),
  };

  // Envoyer l'alerte et marquer le cooldown
  await sendAlert(payload);
  markCooldown(cooldownKey, level);

  return { drift: result, alerted: true, lastChecked };
}

// ---------------------------------------------------------------------------
// Accesseurs (pour l'API endpoint)
// ---------------------------------------------------------------------------

/** Retourne les alertes récentes (en mémoire). */
export function getRecentAlerts(): AlertPayload[] {
  return [...recentAlerts];
}

/** Retourne la dernière date de vérification. */
export function getLastChecked(): string | null {
  return lastChecked;
}
