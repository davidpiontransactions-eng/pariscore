import { NextResponse } from "next/server";

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
    console.error("[push/subscribe] error", err);
    return NextResponse.json(
      { error: "Failed to store subscription" },
      { status: 500 }
    );
  }
}

// Export for use by /api/push/test
export function getSubscriptions(): readonly PushSubscription[] {
  return subscriptions;
}

// Type re-export for /api/push/test
export type { PushSubscription };
