/**
 * Enable Row-Level Security on every public table that doesn't have it yet.
 * Idempotent — safe to run anytime; run after `drizzle-kit migrate` so any
 * NEW table is locked down (Supabase flags RLS-disabled public tables).
 *
 * Safe for the app: MEQ connects as the `postgres` owner role, which BYPASSES
 * RLS. With no policies, the Supabase REST/anon API gets zero access while the
 * app's direct connection is unaffected.
 *
 *   npx tsx scripts/enable-rls.ts
 */
import { loadEnvLocal } from "./load-env";
loadEnvLocal();

import postgres from "postgres";

async function main() {
  const url = process.env.MEQ_DIRECT_URL || process.env.MEQ_DATABASE_URL;
  if (!url) throw new Error("MEQ_DIRECT_URL / MEQ_DATABASE_URL not set");
  const sql = postgres(url, { ssl: "require" });

  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = false
    ORDER BY tablename`;

  if (tables.length === 0) {
    console.log("✅ All public tables already have RLS enabled. Nothing to do.");
  } else {
    for (const t of tables) {
      await sql.unsafe(`ALTER TABLE public.${t.tablename} ENABLE ROW LEVEL SECURITY`);
      console.log(`🔒 Enabled RLS: ${t.tablename}`);
    }
    console.log(`\nEnabled RLS on ${tables.length} table(s).`);
  }

  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
