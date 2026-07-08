// Idempotent seed of the known Confide staff who appear as referrers in the
// HubSpot 'Referred/Invited By' data. Regions are assigned in /admin/staff.
// Run: export env vars, then `npx tsx scripts/seed-staff.ts`
import { meqDb, schema } from "../src/lib/db/meq";
import { normalizeName } from "../src/lib/sync/referrals";

const SEED: { name: string; aliases: string[]; region?: string }[] = [
  { name: "Sean Navarro", aliases: ["sean"], region: "SE" },
  { name: "Jason Cenamor", aliases: ["jason"] },
  { name: "Larry Whiteside", aliases: ["larry whiteside jr", "larry whiteside jr.", "larry"] },
  { name: "George Kamide", aliases: [] },
];

async function main() {
  for (const s of SEED) {
    await meqDb
      .insert(schema.staff)
      .values({
        name: s.name,
        normalizedName: normalizeName(s.name),
        aliases: s.aliases,
        region: s.region ?? null,
      })
      .onConflictDoNothing();
    console.log(`seeded: ${s.name}${s.region ? ` (${s.region})` : ""}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
