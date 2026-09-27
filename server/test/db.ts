import path from "node:path"

import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

import * as schema from "../db/schema.js"

const MIGRATIONS = path.join(import.meta.dirname, "../../drizzle/migrations")

// In-memory Postgres, migrated and seeded like production.
export async function createTestDb() {
  const db = drizzle({ client: new PGlite(), schema })
  await migrate(db, { migrationsFolder: MIGRATIONS })
  return db
}
