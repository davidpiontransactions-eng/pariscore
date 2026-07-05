/**
 * Email transport — graceful degradation.
 *
 * If `SMTP_HOST` is configured, creates a real Nodemailer transporter using
 * the provided SMTP credentials. Otherwise, returns a console-logging mock so
 * the app still works end-to-end in dev / demo environments without an SMTP
 * server.
 *
 * SMTP credentials live ONLY in server environment variables — they are never
 * read by client code and never prefixed with `NEXT_PUBLIC_`.
 */

import type nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null | undefined;

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Lazily build (and cache) a Nodemailer transporter.
 *
 * Returns `null` when SMTP is not configured — callers should then fall back
 * to `sendConsoleEmail`. Returns the transporter instance when configured.
 */
async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (cachedTransporter !== undefined) return cachedTransporter;
  if (!isSmtpConfigured()) {
    cachedTransporter = null;
    return null;
  }
  try {
    // Dynamic import so the nodemailer dependency is only loaded on the server
    // when actually needed (it's a Node-only module).
    const mod = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? "587");
    cachedTransporter = mod.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
    return cachedTransporter;
  } catch (err) {
    console.error("[email] failed to create SMTP transporter", err);
    cachedTransporter = null;
    return null;
  }
}

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult =
  | { mode: "smtp"; success: true; messageId: string }
  | { mode: "smtp"; success: false; error: string }
  | { mode: "console"; success: true };

/**
 * Send an email to a single recipient.
 *
 * - If SMTP is configured, sends via Nodemailer.
 * - Otherwise, logs the message to the server console (graceful degradation).
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const transporter = await getTransporter();
  const from = process.env.SMTP_FROM ?? "noreply@setpoint.example";

  if (!transporter) {
    // Graceful degradation: log to console so the demo works without SMTP.
    console.log(
      `[email:console] ──────────────────────────────────────────────`
    );
    console.log(`[email:console] To:      ${msg.to}`);
    console.log(`[email:console] From:    ${from}`);
    console.log(`[email:console] Subject: ${msg.subject}`);
    console.log(`[email:console] Body:`);
    console.log(msg.text);
    console.log(`[email:console] ──────────────────────────────────────────────`);
    return { mode: "console", success: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { mode: "smtp", success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] SMTP send failed for ${msg.to}:`, error);
    return { mode: "smtp", success: false, error };
  }
}

/**
 * Build the value-bet alert email body for a match.
 */
export function buildValueBetEmail(params: {
  playerA: string;
  playerB: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
}): { subject: string; text: string; html: string } {
  const { playerA, playerB, probA, bookmaker, decimalA, impliedProbA } = params;
  const edge = Math.round(probA - impliedProbA);
  const subject = `🎾 Value bet détecté — ${playerA} vs ${playerB}`;
  const text = [
    `Value bet détecté par SetPoint`,
    ``,
    `Match : ${playerA} vs ${playerB}`,
    `Modèle SetPoint : ${playerA} à ${probA}%`,
    `Bookmaker ${bookmaker} : cote ${decimalA.toFixed(2)} (probabilité implicite ${impliedProbA}%)`,
    `Edge estimé : +${edge} points`,
    ``,
    `Cette alerte vous est envoyée parce que vous avez activé les alertes email SetPoint.`,
    `Vous pouvez vous désabonner à tout moment depuis l'application.`,
  ].join("\n");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #059669; margin: 0 0 16px;">🎾 Value bet détecté</h2>
      <p style="font-size: 15px; color: #374151; margin: 0 0 12px;">
        <strong>${playerA}</strong> vs <strong>${playerB}</strong>
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Modèle SetPoint (${playerA})</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${probA}%</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">${bookmaker} (cote ${decimalA.toFixed(2)})</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${impliedProbA}%</td></tr>
        <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 12px 0; color: #059669; font-weight: 600;">Edge estimé</td><td style="padding: 12px 0; text-align: right; font-weight: 700; color: #059669;">+${edge} pts</td></tr>
      </table>
      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0;">
        Alerte envoyée par SetPoint. Vous pouvez vous désabonner à tout moment depuis l'application.
      </p>
    </div>
  `;
  return { subject, text, html };
}
