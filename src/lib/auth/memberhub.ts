/**
 * MEQ signs people in through MemberHub (same site: members.thecisosociety.com/meq), so there's
 * one login. We ask MemberHub who the cookie belongs to; only MemberHub staff get in.
 */
export const MEMBERHUB_URL = process.env.MEMBERHUB_URL ?? "https://members.thecisosociety.com";

export type HubUser = { email: string; name: string | null; staffRole: string };

export async function hubUserFromCookie(cookie: string | null | undefined): Promise<HubUser | null> {
  if (!cookie || !cookie.includes("better-auth.session_token")) return null;
  try {
    // Never hang a page on this: give MemberHub 3 seconds.
    const res = await fetch(`${MEMBERHUB_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { email?: string; name?: string; staffRole?: string | null } } | null;
    const u = data?.user;
    if (!u?.email || !u.staffRole) return null;
    return { email: u.email.toLowerCase(), name: u.name ?? null, staffRole: u.staffRole };
  } catch {
    return null;
  }
}

/**
 * MemberHub sign-in URL that returns to this MEQ page. Strips Next.js internals (.rsc data files,
 * _rsc params) so the return address is always a real page.
 */
export function memberHubSignIn(meqPath: string) {
  const [rawPath, rawQuery = ""] = meqPath.split("?");
  let path = rawPath.replace(/\.rsc$/, "").replace(/^\/meq(?=\/|$)/, "") || "/";
  if (path === "/index") path = "/";
  const query = rawQuery
    .split("&")
    .filter((kv) => kv && !kv.startsWith("_rsc="))
    .join("&");
  const target = `/meq${path === "/" ? "" : path}${query ? `?${query}` : ""}`;
  return `${MEMBERHUB_URL}/sign-in?next=${encodeURIComponent(target)}`;
}
