import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/pariscore.html", request.url));
  }
}

export const config = {
  matcher: "/",
};