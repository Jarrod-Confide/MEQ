import { timingSafeEqual } from "node:crypto";

/**
 * Bearer auth for MEQ's read API, one token per consuming app in its own
 * env var, fail-closed: an unset token means that app cannot call at all.
 * Same shape as Pulse's and CircleHub's, so Confide has one pattern.
 */
const TOKENS: Record<string, string> = {
  eventflow: "MEQ_TOKEN_EVENTFLOW",
};

export function callerFor(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const presented = Buffer.from(header.slice(7).trim());
  if (presented.length === 0) return null;
  for (const [system, envName] of Object.entries(TOKENS)) {
    const expected = process.env[envName];
    if (!expected) continue;
    const e = Buffer.from(expected);
    if (e.length === presented.length && timingSafeEqual(e, presented)) return system;
  }
  return null;
}
