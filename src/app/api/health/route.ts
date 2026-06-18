import { NextResponse } from "next/server";
import { meqSql } from "@/lib/db/meq";
import { eventflowSql, slackleSql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitoring (e.g. Confide Heartbeat). Pings all three
 * databases. Returns 200 only if every dependency is reachable, else 503 —
 * so a monitor can alert the moment MEQ can't serve data.
 */
export async function GET() {
  const checks: Record<string, "ok" | "down"> = {};
  const probe = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = "ok";
    } catch {
      checks[name] = "down";
    }
  };

  await Promise.all([
    probe("meq", () => meqSql`SELECT 1`),
    probe("eventflow", () => eventflowSql`SELECT 1`),
    probe("slackle", () => slackleSql`SELECT 1`),
  ]);

  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    { ok, checks, at: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
