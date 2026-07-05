import { NextResponse } from "next/server";
import { subscribersRef } from "@/lib/email/store";
import { sendEmail, type SendResult } from "@/lib/email/send";

/**
 * POST /api/email/digest
 *
 * Sends a SINGLE digest email to every email subscriber with an HTML
 * summary of the day's value bets.
 *
 * Body: `{ bets: Array<{ matchId, playerA, probA, bookmaker, decimalA, impliedProbA }> }`
 *
 * Graceful degradation:
 *   - If there are no subscribers → 200 `{ mode: "no-subscribers" }`.
 *   - If SMTP env vars are not configured → `sendEmail()` logs the email
 *     to the server console (see `src/lib/email/send.ts`) and returns
 *     `{ mode: "console" }`.
 *   - Otherwise sends via Nodemailer → `{ mode: "smtp" }`.
 *
 * Each subscriber receives a separate email (BCC would hide
 * per-recipient failures). Returns aggregate `sent` / `failed` / `total`.
 */

type DigestBet = {
  matchId: string;
  playerA: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
};

type DigestPayload = { bets: DigestBet[] };

function isDigestBet(v: unknown): v is DigestBet {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.matchId === "string" &&
    typeof o.playerA === "string" &&
    typeof o.probA === "number" &&
    typeof o.bookmaker === "string" &&
    typeof o.decimalA === "number" &&
    typeof o.impliedProbA === "number"
  );
}

function isDigestPayload(v: unknown): v is DigestPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.bets)) return false;
  return o.bets.every(isDigestBet);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDigestEmail(bets: DigestBet[]): {
  subject: string;
  text: string;
  html: string;
} {
  const count = bets.length;
  const top5 = bets.slice(0, 5);
  const subject = `🎾 SetPoint — ${count} value bet${
    count > 1 ? "s" : ""
  } aujourd'hui`;

  // Plain-text fallback
  const textLines: string[] = [
    `SetPoint Daily Digest — ${count} value bet${
      count > 1 ? "s" : ""
    } aujourd'hui`,
    "",
  ];
  if (top5.length === 0) {
    textLines.push("Aucun value bet aujourd'hui.");
  } else {
    textLines.push(`Top ${top5.length} value bets :`);
    textLines.push("");
    top5.forEach((b, i) => {
      const edge = Math.round(b.probA - b.impliedProbA);
      textLines.push(
        `${i + 1}. ${b.playerA} — modèle ${b.probA}% vs ${b.bookmaker} cote ${b.decimalA.toFixed(
          2
        )} (implied ${b.impliedProbA}%, edge +${edge} pts)`
      );
    });
  }
  textLines.push("");
  textLines.push(
    "Ce digest vous est envoyé parce que vous avez activé le digest quotidien SetPoint."
  );
  textLines.push(
    "Vous pouvez vous désabonner à tout moment depuis l'application."
  );
  const text = textLines.join("\n");

  // HTML version
  const rowsHtml = top5
    .map((b, i) => {
      const edge = Math.round(b.probA - b.impliedProbA);
      return `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 24px;">${i + 1}.</td>
          <td style="padding: 8px 12px; font-weight: 600; color: #111827;">${escapeHtml(
            b.playerA
          )}</td>
          <td style="padding: 8px 12px; text-align: right; color: #374151;">${b.probA}%</td>
          <td style="padding: 8px 12px; text-align: right; color: #374151;">${escapeHtml(
            b.bookmaker
          )} @ ${b.decimalA.toFixed(2)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #059669; font-weight: 700;">+${edge} pts</td>
        </tr>`;
    })
    .join("");

  const tableHtml =
    top5.length === 0
      ? `<p style="color: #6b7280; font-size: 14px;">Aucun value bet aujourd'hui.</p>`
      : `
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 8px 0; text-align: left; color: #6b7280;">#</th>
              <th style="padding: 8px 12px; text-align: left; color: #6b7280;">Joueur</th>
              <th style="padding: 8px 12px; text-align: right; color: #6b7280;">Modèle</th>
              <th style="padding: 8px 12px; text-align: right; color: #6b7280;">Bookmaker</th>
              <th style="padding: 8px 12px; text-align: right; color: #6b7280;">Edge</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #059669; margin: 0 0 16px;">🎾 SetPoint Daily Digest</h2>
      <p style="font-size: 15px; color: #374151; margin: 0 0 12px;">
        <strong>${count}</strong> value bet${
    count > 1 ? "s" : ""
  } détecté${count > 1 ? "s" : ""} aujourd'hui.
      </p>
      ${tableHtml}
      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0;">
        Digest envoyé par SetPoint. Vous pouvez vous désabonner à tout moment depuis l'application.
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!isDigestPayload(body)) {
      return NextResponse.json(
        { error: "Invalid digest payload" },
        { status: 400 }
      );
    }

    const { subject, text, html } = buildDigestEmail(body.bets);

    const subscribers = subscribersRef.snapshot();

    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        mode: "no-subscribers",
        sent: 0,
        failed: 0,
        total: 0,
        subject,
      });
    }

    let sent = 0;
    let failed = 0;
    let mode: SendResult["mode"] = "console";

    for (const sub of subscribers) {
      const res = await sendEmail({ to: sub.email, subject, text, html });
      // Track the mode from the latest result — they're all the same since
      // the transporter is cached module-level.
      mode = res.mode;
      if (res.success) sent++;
      else failed++;
    }

    return NextResponse.json({
      success: true,
      mode,
      sent,
      failed,
      total: subscribers.length,
      subject,
    });
  } catch (err) {
    console.error("[email/digest] error", err);
    return NextResponse.json(
      { error: "Failed to send digest" },
      { status: 500 }
    );
  }
}
