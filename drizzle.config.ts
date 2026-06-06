import type { Config } from "drizzle-kit";
import { loadEnvLocal } from "./scripts/load-env";

// Load .env.local so `drizzle-kit` works without manually exporting URLs.
loadEnvLocal();

// Migrations run against the session pooler (port 5432) via MEQ_DIRECT_URL;
// falls back to MEQ_DATABASE_URL if the direct URL isn't set.
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MEQ_DIRECT_URL || process.env.MEQ_DATABASE_URL!,
  },
} satisfies Config;
