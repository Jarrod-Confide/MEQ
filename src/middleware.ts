import { NextResponse, type NextRequest } from "next/server";
import { hubUserFromCookie, memberHubSignIn } from "@/lib/auth/memberhub";

// /api/v1 is bearer-authenticated per route (src/lib/api-auth.ts). Paths are relative to /meq.
const PUBLIC_PATHS = ["/sign-in", "/api/auth", "/api/cron", "/api/health", "/api/v1"];

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const user = await hubUserFromCookie(req.headers.get("cookie"));
  if (!user) {
    // Background data requests (RSC/prefetch) get a plain 401 rather than a sign-in redirect.
    if (req.headers.get("rsc") === "1" || req.headers.get("next-router-prefetch")) {
      return new NextResponse(null, { status: 401 });
    }
    return NextResponse.redirect(memberHubSignIn(pathname + search));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|.*\\..*).*)"],
};
