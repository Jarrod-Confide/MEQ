/**
 * One-off / repeatable backfill of message content scores.
 * Run locally (no 300s function limit). Requires env: ANTHROPIC_API_KEY,
 * SLACKLE_DATABASE_URL, MEQ_DATABASE_URL (exported in the shell).
 *
 *   npx tsx scripts/backfill-scores.ts [limit]
 */
import { scoreMessages } from "../src/lib/sync/message-scores";

const limit = process.argv[2] ? Number(process.argv[2]) : undefined;

scoreMessages({ limit })
  .then((stats) => {
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
