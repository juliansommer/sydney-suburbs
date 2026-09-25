import { defineConfig } from "drizzle-kit"

// Generate only. Migrations are applied by wrangler (pnpm db:migrate:*), which
// tracks them in D1 itself, so drizzle-kit never needs database credentials.
export default defineConfig({
  dialect: "sqlite",
  schema: "./worker/db/schema.ts",
  out: "./drizzle/migrations",
})
