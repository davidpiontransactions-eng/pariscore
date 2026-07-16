import { NextResponse } from "next/server";
import { AppError } from "./api-error";

export interface ErrorResponse {
  error: string;
  message: string;
}

export function apiErrorHandler(
  err: unknown,
  context: string,
  fallback?: () => NextResponse,
): NextResponse {
  if (err instanceof AppError) {
    if (err.isCatastrophic) {
      console.error(`[${context}] CATASTROPHIC`, err);
      return NextResponse.json(
        { error: err.code, message: "Internal server error" },
        { status: err.statusCode },
      );
    }
    console.warn(`[${context}] ${err.code}:`, err.message);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] UNEXPECTED:`, message);

  if (fallback) return fallback();

  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Internal server error" },
    { status: 500 },
  );
}
