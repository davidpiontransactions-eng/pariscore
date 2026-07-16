import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";

export async function GET() {
  try {
    return NextResponse.json({ message: "Hello, world!" });
  } catch (err) {
    return apiErrorHandler(err, "api");
  }
}