/**
 * MEQ signs people in through MemberHub (same site: members.thecisosociety.com/meq), so there's
 * one login. We ask MemberHub who the cookie belongs to; only MemberHub staff get in.
 */
export const MEMBERHUB_URL = process.env.MEMBERHUB_URL ?? "https://members.thecisosociety.com";

export type HubUser = { email: string; name: string | null; staffRole: string };

export async function hubUserFromCookie(cookie: string | null | undefined): Promise<HubUser | null> {
  if (!cookie || !cookie.includes("better-auth.session_token")) return null;
  try {
    const res = await fetch(`${MEMBERHUB_URL}/api/auth/get-session`, { headers: { cookie }, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { email?: string; name?: string; staffRole?: string | null } } | null;
    const u = data?.user;
    if (!u?.email || !u.staffRole) return null;
    return { email: u.email.toLowerCase(), name: u.name ?? null, staffRole: u.staffRole };
  } catch {
    return null;
  }
}

export const memberHubSignIn = (meqPath: string) =>
  `${MEMBERHUB_URL}/sign-in?next=${encodeURIComponent(`/meq${meqPath === "/" ? "" : meqPath}`)}`;
