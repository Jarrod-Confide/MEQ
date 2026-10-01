import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Unit tests never touch a database. Some modules build their postgres
    // clients at import time and throw without a URL; postgres-js connects
    // lazily, so placeholders that point nowhere are safe.
    env: {
      DATABASE_URL: "postgres://test@127.0.0.1:1/never",
      SLACKLE_DATABASE_URL: "postgres://test@127.0.0.1:1/never",
      MEQ_DATABASE_URL: "postgres://test@127.0.0.1:1/never",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
