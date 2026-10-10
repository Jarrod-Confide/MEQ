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
  if (!user) return NextResponse.redirect(memberHubSignIn(pathname + search));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|.*\\..*).*)"],
};
