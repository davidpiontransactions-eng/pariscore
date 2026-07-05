import { NextResponse } from "next/server";
import { buildValueBetEmail, sendEmail } from "@/lib/email/send";
import { subscribersRef } from "@/lib/email/store";

/**
 * POST /api/email/test
 *
 * Body: `{ matchId, playerA, playerB, probA, bookmaker, decimalA, impliedProbA }`
 *
 * Sends a value-bet alert email to every registered subscriber. When SMTP is
 * not configured (no `SMTP_HOST` env), emails are logged to the server
 * console instead (graceful degradation) so the endpoint remains useful in
 * dev / demo environments.
 *
 * Returns 200 with the number of recipients the message was sent to. If no
 * subscribers are registered, returns 200 with `sent: 0` (the call is still
 * "successful" — there's just no audience yet).
 */
type TestAlertBody = {
  matchId: string;
  playerA: string;
  playerB: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
};

function isTestAlertBody(v: unknown): v is TestAlertBody {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.matchId === "string" &&
    typeof o.playerA === "string" &&
    typeof o.playerB === "string" &&
    typeof o.probA === "number" &&
    typeof o.bookmaker === "string" &&
    typeof o.decimalA === "number" &&
    typeof o.impliedProbA === "number"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!isTestAlertBody(body)) {
      return NextResponse.json(
        { error: "Invalid payload — expected matchId, playerA, playerB, probA, bookmaker, decimalA, impliedProbA" },
        { status: 400 }
      );
    }

    const subs = subscribersRef.snapshot();
    if (subs.length === 0) {
      // No audience — still 200 so the client treats it as a successful test.
      return NextResponse.json({
        success: true,
        sent: 0,
        mode: process.env.SMTP_HOST ? "smtp" : "console",
        total: 0,
      });
    }

    const { subject, text, html } = buildValueBetEmail({
      playerA: body.playerA,
      playerB: body.playerB,
      probA: body.probA,
      bookmaker: body.bookmaker,
      decimalA: body.decimalA,
      impliedProbA: body.impliedProbA,
    });

    let sent = 0;
    let failed = 0;
    for (const sub of subs) {
      const result = await sendEmail({
        to: sub.email,
        subject,
        text,
        html,
      });
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subs.length,
      mode: process.env.SMTP_HOST ? "smtp" : "console",
    });
  } catch (err) {
    console.error("[email/test] error", err);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
