import { existsSync } from "node:fs"

import { defineConfig } from "drizzle-kit"

if (existsSync(".env")) {
  process.loadEnvFile()
}

// Migrations run over the direct connection: pgbouncer's transaction pooling
// doesn't suit them. Generating needs no credentials at all.
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
})
