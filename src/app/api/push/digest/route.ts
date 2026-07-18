import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { ValidationError } from "@/lib/api-error";
import { getSubscriptions } from "@/app/api/push/subscribe/route";
import type { PushSubscription as WebPushSubscription } from "web-push";

/**
 * POST /api/push/digest
 *
 * Sends a SINGLE push notification to every stored push subscriber with a
 * digest summary of the day's value bets.
 *
 * Body: `{ bets: Array<{ matchId, playerA, probA, bookmaker, decimalA, impliedProbA }> }`
 *
 * The push notification:
 *   - Title: "SetPoint — N value bets aujourd'hui"
 *   - Body : top 3 value bets (one line each, "• {player} @ {bookmaker} ({cote})")
 *
 * Graceful degradation:
 *   - If there are no subscribers → 200 `{ mode: "no-subscribers" }`.
 *   - If VAPID env vars are not configured → logs the digest to the server
 *     console and returns 200 `{ mode: "console" }` (mirrors the email
 *     transport's graceful-degradation pattern).
 *   - Otherwise sends via web-push to each subscriber, returns 200 with
 *     `{ mode: "web-push", sent, failed, total }`.
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

function buildDigestTitle(count: number): string {
  return `SetPoint — ${count} value bet${count > 1 ? "s" : ""} aujourd'hui`;
}

function buildDigestBody(bets: DigestBet[]): string {
  const top3 = bets.slice(0, 3);
  if (top3.length === 0) return "Aucun value bet aujourd'hui";
  return top3
    .map((b) => `• ${b.playerA} @ ${b.bookmaker} (${b.decimalA.toFixed(2)})`)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!isDigestPayload(body)) {
      throw new ValidationError("Invalid digest payload");
    }

    const bets = body.bets;
    const count = bets.length;
    const title = buildDigestTitle(count);
    const bodyText = buildDigestBody(bets);

    const subs = getSubscriptions();

    if (subs.length === 0) {
      return NextResponse.json({
        success: true,
        mode: "no-subscribers",
        sent: 0,
        failed: 0,
        total: 0,
        title,
        body: bodyText,
      });
    }

    const vapidSubject = process.env.VAPID_SUBJECT;
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidConfigured = Boolean(
      vapidSubject && vapidPublicKey && vapidPrivateKey
    );

    if (!vapidConfigured) {
      // Graceful degradation: log the digest to the server console so the
      // demo works end-to-end without a VAPID keypair configured.
      console.log(
        "[push:digest:console] ──────────────────────────────────────────────"
      );
      console.log(`[push:digest:console] Subscribers: ${subs.length}`);
      console.log(`[push:digest:console] Title: ${title}`);
      console.log("[push:digest:console] Body:");
      console.log(bodyText);
      console.log(
        "[push:digest:console] ──────────────────────────────────────────────"
      );
      return NextResponse.json({
        success: true,
        mode: "console",
        sent: 0,
        failed: 0,
        total: subs.length,
        title,
        body: bodyText,
      });
    }

    // Real send via web-push (dynamic import — Node-only module)
    const webpush = await import("web-push");
    webpush.setVapidDetails(
      vapidSubject as string,
      vapidPublicKey as string,
      vapidPrivateKey as string
    );

    const payload = JSON.stringify({ title, body: bodyText, count });

    let sent = 0;
    let failed = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            sub as unknown as WebPushSubscription,
            payload
          );
          sent++;
        } catch (err) {
          console.error(
            "[push:digest] send failed for",
            (sub as { endpoint?: string })?.endpoint,
            err
          );
          failed++;
        }
      })
    );

    return NextResponse.json({
      success: true,
      mode: "web-push",
      sent,
      failed,
      total: subs.length,
      title,
      body: bodyText,
    });
  } catch (err) {
    return apiErrorHandler(err, "push/digest");
  }
}
