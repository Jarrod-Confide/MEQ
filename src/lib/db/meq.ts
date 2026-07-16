import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (!process.env.MEQ_DATABASE_URL) {
  throw new Error("MEQ_DATABASE_URL is not set");
}

const globalForMeq = global as unknown as {
  meqClient?: ReturnType<typeof postgres>;
};

const client =
  globalForMeq.meqClient ??
  postgres(process.env.MEQ_DATABASE_URL, {
    ssl: "require",
    max: 5, // don't lower: max 2 wedged parallel query batches — see db.ts
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // transaction pooler
  });

if (process.env.NODE_ENV !== "production") globalForMeq.meqClient = client;

/** MEQ's own database — canonical members roster. */
export const meqDb = drizzle(client, { schema });
/** Raw postgres-js client for aggregation queries that are cleaner in SQL. */
export const meqSql = client;
export { schema };
