import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";

// In-memory store of push subscriptions (replace with DB in production)
const subscriptions: PushSubscription[] = [];

export async function POST(request: Request) {
  try {
    const sub = (await request.json()) as PushSubscription;
    if (!sub || !sub.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 }
      );
    }
    // Dedupe by endpoint
    const exists = subscriptions.find((s) => s.endpoint === sub.endpoint);
    if (!exists) {
      subscriptions.push(sub);
    }
    return NextResponse.json(
      { success: true, count: subscriptions.length },
      { status: 201 }
    );
  } catch (err) {
    return apiErrorHandler(err, "push/subscribe");
  }
}

// Export for use by /api/push/test
export function getSubscriptions(): readonly PushSubscription[] {
  return subscriptions;
}

// PushSubscription is a global ServiceWorker type — not a local declaration,
// so it cannot be re-exported. /api/push/test should use the global type directly.
