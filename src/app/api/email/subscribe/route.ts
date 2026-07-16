import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import {
  isValidEmail,
  normalizeEmail,
  subscribersRef,
} from "@/lib/email/store";

/**
 * POST /api/email/subscribe
 *
 * Body: `{ email: string }`
 *
 * Validates the email format, normalizes it (trim + lowercase), dedupes by
 * email address (idempotent — re-subscribing the same address returns 201
 * without creating a duplicate), and stores it in the in-memory Map.
 *
 * SMTP credentials are NEVER touched here — subscription only records the
 * address. Sending happens in /api/email/test.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: unknown }
      | null;

    if (!body || !isValidEmail(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(body.email);
    subscribersRef.add(email);

    return NextResponse.json(
      { success: true, count: subscribersRef.size },
      { status: 201 }
    );
  } catch (err) {
    return apiErrorHandler(err, "email/subscribe");
  }
}
