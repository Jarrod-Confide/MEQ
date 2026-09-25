import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

// /api/v1 is bearer-authenticated per route (src/lib/api-auth.ts).
const PUBLIC_PATHS = ["/sign-in", "/api/auth", "/api/cron", "/api/health", "/api/v1"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|.*\\..*).*)"],
};
