import { describe, test, expect } from "bun:test";
import { AppError, ValidationError, NotFoundError } from "../src/lib/api-error";
import { apiErrorHandler } from "../src/lib/api-error-handler";
import { NextResponse } from "next/server";

// ── AppError ──────────────────────────────────────────────────────────

describe("AppError", () => {
  test("creates with defaults", () => {
    const err = new AppError("something broke");
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.statusCode).toBe(500);
    expect(err.isCatastrophic).toBe(false);
    expect(err.name).toBe("AppError");
  });

  test("creates with custom params", () => {
    const err = new AppError("bad input", "VALIDATION", 400, true);
    expect(err.code).toBe("VALIDATION");
    expect(err.statusCode).toBe(400);
    expect(err.isCatastrophic).toBe(true);
  });

  test("is instanceof Error", () => {
    expect(new AppError("x")).toBeInstanceOf(Error);
  });
});

// ── ValidationError ───────────────────────────────────────────────────

describe("ValidationError", () => {
  test("creates with 400 status", () => {
    const err = new ValidationError("invalid email");
    expect(err.message).toBe("invalid email");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(err.isCatastrophic).toBe(false);
    expect(err.name).toBe("ValidationError");
  });

  test("is instanceof AppError", () => {
    expect(new ValidationError("x")).toBeInstanceOf(AppError);
  });
});

// ── NotFoundError ─────────────────────────────────────────────────────

describe("NotFoundError", () => {
  test("creates with 404 status", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Resource not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
  });

  test("accepts custom message", () => {
    const err = new NotFoundError("Match not found");
    expect(err.message).toBe("Match not found");
  });
});

// ── apiErrorHandler ───────────────────────────────────────────────────

describe("apiErrorHandler", () => {
  test("handles AppError operational", () => {
    const err = new ValidationError("bad request");
    const res = apiErrorHandler(err, "test");
    expect(res.status).toBe(400);
  });

  test("handles AppError catastrophic", () => {
    const err = new AppError("fatal", "DB_DOWN", 500, true);
    const res = apiErrorHandler(err, "test");
    expect(res.status).toBe(500);
  });

  test("handles plain Error", () => {
    const err = new Error("unexpected");
    const res = apiErrorHandler(err, "test");
    expect(res.status).toBe(500);
  });

  test("handles string error", () => {
    const res = apiErrorHandler("crash", "test");
    expect(res.status).toBe(500);
  });

  test("calls fallback when provided on unexpected error", () => {
    const err = new Error("something bad");
    const fallback = () => NextResponse.json({ mock: true }, { status: 200 });
    const res = apiErrorHandler(err, "test", fallback);
    expect(res.status).toBe(200);
  });

  test("does NOT call fallback for typed AppError", () => {
    const err = new ValidationError("known issue");
    const fallback = () => NextResponse.json({ mock: true }, { status: 200 });
    const res = apiErrorHandler(err, "test", fallback);
    // ValidationError → 400, not 200 (fallback is for unknown errors only)
    expect(res.status).toBe(400);
  });
});
