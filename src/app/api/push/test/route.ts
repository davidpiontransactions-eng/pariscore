import { NextResponse } from "next/server";
import webpush from "web-push";
import { getSubscriptions } from "../subscribe/route";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:contact@setpoint.example",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

type TestAlertBody = {
  matchId: string;
  playerA: string;
  playerB: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
};

export async function POST(request: Request) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      {
        error:
          "VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as TestAlertBody;
  const subs = getSubscriptions();
  if (subs.length === 0) {
    return NextResponse.json(
      { error: "No subscriptions registered" },
      { status: 400 }
    );
  }

  const payload = JSON.stringify({
    title: "Value bet détecté",
    body: `${body.playerA} : modèle ${body.probA}% vs ${body.bookmaker} ${body.impliedProbA}% @ ${body.decimalA}`,
    data: { matchId: body.matchId, url: "/" },
    tag: `value-bet-${body.matchId}`,
    actions: [
      { action: "view", title: "Voir le match" },
      { action: "dismiss", title: "Ignorer" },
    ],
  });

  let succeeded = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub as unknown as webpush.PushSubscription, payload);
      succeeded++;
    } catch (err) {
      console.error("[push/test] send failed for", sub.endpoint, err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    sent: succeeded,
    failed,
    total: subs.length,
  });
}
