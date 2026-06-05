/**
 * Backfill weekly engagement snapshots retroactively.
 *   npx tsx scripts/backfill-snapshots.ts [weeks=12]
 * Requires env: DATABASE_URL, SLACKLE_DATABASE_URL, MEQ_DATABASE_URL.
 */
import { backfillSnapshots } from "../src/lib/sync/snapshots";

async function main() {
  const weeks = process.argv[2] ? Number(process.argv[2]) : 12;
  const stats = await backfillSnapshots(weeks);
  for (const s of stats) console.log(`${s.weekStart.slice(0, 10)}  rows ${s.rows}`);
  console.log(`\nBackfilled ${stats.length} weekly snapshots.`);
}
main().then(() => process.exit(0));
