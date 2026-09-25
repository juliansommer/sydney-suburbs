import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { getPlatformProxy } from "wrangler"

const MIGRATIONS = path.join(import.meta.dirname, "../../drizzle/migrations")

async function migrationStatements() {
  const entries = await readdir(MIGRATIONS)
  const files = entries.filter((file) => file.endsWith(".sql")).toSorted()
  const sources = await Promise.all(
    files.map(
      async (file) => await readFile(path.join(MIGRATIONS, file), "utf-8"),
    ),
  )
  return sources.flatMap((sql) =>
    sql
      .split("--> statement-breakpoint")
      .map((s) => s.replaceAll(/^--.*$/gm, "").trim())
      .filter(Boolean),
  )
}

// The Worker's env with a real local D1 (the workerd-backed one `wrangler dev`
// uses), in memory and migrated and seeded like production.
export async function createTestEnv() {
  const proxy = await getPlatformProxy<Env>({ persist: false })
  const { DB } = proxy.env
  const statements = await migrationStatements()
  await DB.batch(statements.map((s) => DB.prepare(s)))
  return { env: proxy.env, dispose: proxy.dispose }
}
