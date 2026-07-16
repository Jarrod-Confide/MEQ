import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
if (!process.env.SLACKLE_DATABASE_URL) {
  throw new Error("SLACKLE_DATABASE_URL is not set");
}

type Sql = ReturnType<typeof postgres>;
const globalForDb = global as unknown as {
  eventflowSql?: Sql;
  slackleSql?: Sql;
};

// Serverless-friendly pool settings: small per-instance pools (many lambdas
// share the Supabase pooler's connection budget — EventFlow's is also shared
// with the EventFlow app) and a fast connect timeout so a saturated pooler
// fails a request in seconds instead of hanging it to maxDuration (the
// "whole app locks up" failure mode).
const opts = {
  ssl: "require" as const,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
};

/** EventFlow's Supabase — contacts, events, attendees. */
export const eventflowSql =
  globalForDb.eventflowSql ?? postgres(process.env.DATABASE_URL, opts);

/** Slackle's Supabase — members, messages, reactions. */
export const slackleSql =
  globalForDb.slackleSql ?? postgres(process.env.SLACKLE_DATABASE_URL, opts);

/** @deprecated use eventflowSql — kept so the map page keeps working. */
export const sql = eventflowSql;

if (process.env.NODE_ENV !== "production") {
  globalForDb.eventflowSql = eventflowSql;
  globalForDb.slackleSql = slackleSql;
}
