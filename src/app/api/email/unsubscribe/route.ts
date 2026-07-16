import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import {
  isValidEmail,
  normalizeEmail,
  subscribersRef,
} from "@/lib/email/store";

/**
 * POST /api/email/unsubscribe
 *
 * Body: `{ email: string }`
 *
 * Removes the email from the in-memory Map. Returns 200 even if the address
 * was not registered (idempotent) so the client can clear local state
 * optimistically without worrying about a 404.
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
    subscribersRef.delete(email);

    return NextResponse.json(
      { success: true, count: subscribersRef.size },
      { status: 200 }
    );
  } catch (err) {
    return apiErrorHandler(err, "email/unsubscribe");
  }
}
